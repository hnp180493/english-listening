// Merge two copies of the app's stored data: this browser's localStorage and the data file in
// the synced folder (OneDrive). Pure and defensive: values may be corrupt, partial or from an
// older version. The rule is "never lose progress": per-item progress keeps the most advanced
// record, lists are unioned, and only plain preferences take the newer side as a whole.

import { mergeHistoryStores, parseHistory } from './history';
import { KEYS, STORAGE_PREFIX } from './storage';
import {
  mergeReset,
  mergeTombstones,
  parseReset,
  parseTombstones,
  resetTimeFor,
  tombstoneAt,
  type ResetMarker,
  type TombKind,
  type Tombstones,
} from './syncMarkers';
import { mergeTownProgress, parseTownProgress } from './town/progress';

/** Full storage key (with prefix) → raw stored JSON string, as in Backup.data. */
export type DataMap = Record<string, string>;

type Obj = Record<string, unknown>;
/** (newer, older) → merged value. May throw on unexpected shapes; the caller falls back to the newer side. */
type Merger = (newer: unknown, older: unknown) => unknown;

/** Same cap as core/stats.ts (MAX_ATTEMPTS). */
export const STATS_MAX_ATTEMPTS = 1000;
/** Same limits as features/shadowing/store.ts. */
const SHADOW_HISTORY_LEN = 5;
const SHADOW_MAX_ITEMS = 400;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown): number => (finite(v) ? v : 0);
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

function maxOf(...xs: unknown[]): number {
  let m = 0;
  for (const x of xs) if (finite(x) && x > m) m = x;
  return m;
}

/** Deterministic tie-break between two different values (keeps a merge commutative). */
const stableLast = (a: Obj, b: Obj): Obj => (JSON.stringify(a) >= JSON.stringify(b) ? a : b);

/**
 * Two versions of a value that is replaced as a whole (settings, media prefs): the one changed last wins, by its
 * own `stampField`, not by when either machine last wrote anything. When neither has a stamp (written before the
 * field existed) the newer side wins, as before; an equal non-zero stamp is broken deterministically.
 */
function changedLast(newer: unknown, older: unknown, stampField: string): unknown {
  if (!isObj(newer)) return isObj(older) ? older : newer;
  if (!isObj(older)) return newer;
  const d = num(newer[stampField]) - num(older[stampField]);
  if (d !== 0) return d > 0 ? newer : older;
  return num(newer[stampField]) === 0 ? newer : stableLast(newer, older);
}

/** settings: the copy changed last (Settings.changedAt) wins as a whole. */
export const mergeSettings: Merger = (newer, older) => changedLast(newer, older, 'changedAt');

/**
 * Union of two id → record maps; `both` decides when an id exists on both sides. `preferRecord`: when only one
 * side's value is a record, it wins over junk (null, string, number, array) on the other side.
 */
function mergeMap(newer: unknown, older: unknown, both: (n: Obj, o: Obj) => Obj, preferRecord = false): Obj {
  const n = isObj(newer) ? newer : {};
  const o = isObj(older) ? older : {};
  const out: Obj = {};
  for (const id of new Set([...Object.keys(o), ...Object.keys(n)])) {
    if (UNSAFE.has(id)) continue;
    const a = n[id];
    const b = o[id];
    if (isObj(a) && isObj(b)) out[id] = both(a, b);
    else if (preferRecord && isObj(b) && !isObj(a)) out[id] = b;
    else if (a !== undefined) out[id] = a;
    else out[id] = b;
  }
  return out;
}

// ───────────────────────── stats ─────────────────────────

interface AttemptLike extends Obj {
  at: number;
}

function attemptsOf(s: Obj): AttemptLike[] {
  return Array.isArray(s.attempts) ? s.attempts.filter((a): a is AttemptLike => isObj(a) && finite(a.at)) : [];
}

const attemptKey = (a: Obj) => `${String(a.at)}|${String(a.module)}|${String(a.itemId)}`;

/** Per-phenomenon counters added by `attempts`, counted the way recordAttempt does. */
function contribution(attempts: AttemptLike[]): Record<string, { seen: number; missed: number }> {
  const out: Record<string, { seen: number; missed: number }> = {};
  const bump = (p: unknown, field: 'seen' | 'missed') => {
    if (typeof p !== 'string' || UNSAFE.has(p)) return;
    out[p] ??= { seen: 0, missed: 0 };
    out[p][field] += 1;
  };
  for (const a of attempts) {
    for (const p of new Set(Array.isArray(a.seen) ? a.seen : [])) bump(p, 'seen');
    for (const p of new Set(Array.isArray(a.missed) ? a.missed : [])) bump(p, 'missed');
  }
  return out;
}

/**
 * Attempts that only `other` has, minus those `side` most likely dropped because its list hit the
 * cap (older than its oldest kept attempt): those are already in its counters.
 */
function missingFrom(side: AttemptLike[], other: AttemptLike[], sideKeys: Set<string>): AttemptLike[] {
  const full = side.length >= STATS_MAX_ATTEMPTS;
  const oldest = side.length ? Math.min(...side.map((a) => a.at)) : -Infinity;
  return other.filter((a) => !sideKeys.has(attemptKey(a)) && (!full || a.at >= oldest));
}

export const mergeStats: Merger = (newer, older) => {
  const n = isObj(newer) ? newer : {};
  const o = isObj(older) ? older : {};
  const na = attemptsOf(n);
  const oa = attemptsOf(o);
  const nKeys = new Set(na.map(attemptKey));
  const oKeys = new Set(oa.map(attemptKey));

  const byKey = new Map<string, AttemptLike>();
  for (const a of [...oa, ...na]) byKey.set(attemptKey(a), a);
  const attempts = [...byKey.values()].sort((x, y) => x.at - y.at).slice(-STATS_MAX_ATTEMPTS);

  // Each side's counters plus what the other side did that it has not seen. The exact total is
  // the larger of the two estimates (truncated histories can only make an estimate too small).
  const nBy = isObj(n.byPhenomenon) ? n.byPhenomenon : {};
  const oBy = isObj(o.byPhenomenon) ? o.byPhenomenon : {};
  const addN = contribution(missingFrom(na, oa, nKeys));
  const addO = contribution(missingFrom(oa, na, oKeys));
  const byPhenomenon: Obj = {};
  for (const p of new Set([...Object.keys(oBy), ...Object.keys(nBy), ...Object.keys(addN), ...Object.keys(addO)])) {
    if (UNSAFE.has(p)) continue;
    const nv = isObj(nBy[p]) ? (nBy[p] as Obj) : {};
    const ov = isObj(oBy[p]) ? (oBy[p] as Obj) : {};
    byPhenomenon[p] = {
      seen: Math.max(num(nv.seen) + (addN[p]?.seen ?? 0), num(ov.seen) + (addO[p]?.seen ?? 0)),
      missed: Math.max(num(nv.missed) + (addN[p]?.missed ?? 0), num(ov.missed) + (addO[p]?.missed ?? 0)),
    };
  }

  const days = new Set<string>();
  for (const s of [o, n]) {
    if (Array.isArray(s.activeDays)) for (const d of s.activeDays) if (typeof d === 'string') days.add(d);
  }
  return { ...o, ...n, attempts, byPhenomenon, activeDays: [...days].sort() };
};

// ───────────────────────── per-item progress maps ─────────────────────────

/** dictation-progress: id → { best, attempts, lastAt, hints?, cleanAt?, hintAt? } */
export const mergeDictation: Merger = (newer, older) =>
  mergeMap(newer, older, (n, o) => {
    const base = num(o.lastAt) > num(n.lastAt) ? o : n;
    const out: Obj = { ...base, best: maxOf(n.best, o.best), attempts: maxOf(n.attempts, o.attempts), lastAt: maxOf(n.lastAt, o.lastAt) };
    for (const f of ['hints', 'cleanAt', 'hintAt']) {
      const v = maxOf(n[f], o[f]);
      if (v > 0) out[f] = v;
      else delete out[f];
    }
    return out;
  });

/** lessons-progress: id → { completedAt (first pass, 0 = not yet), bestScore, attempts } */
export const mergeLessons: Merger = (newer, older) =>
  mergeMap(newer, older, (n, o) => {
    const passes = [n.completedAt, o.completedAt].filter((t): t is number => finite(t) && t > 0);
    return {
      ...o,
      ...n,
      completedAt: passes.length ? Math.min(...passes) : 0,
      bestScore: maxOf(n.bestScore, o.bestScore),
      attempts: maxOf(n.attempts, o.attempts),
    };
  });

/** pairs-progress: { items: id → { seen, correct, streak, lastAt }, sets: id → { best, plays, lastAt } } */
export const mergePairs: Merger = (newer, older) => {
  const n = isObj(newer) ? newer : {};
  const o = isObj(older) ? older : {};
  const items = mergeMap(n.items, o.items, (a, b) => {
    const base = num(b.lastAt) > num(a.lastAt) ? b : a;
    const seen = maxOf(a.seen, b.seen);
    const correct = Math.min(seen, maxOf(a.correct, b.correct));
    return { ...base, seen, correct, streak: Math.min(correct, num(base.streak)), lastAt: maxOf(a.lastAt, b.lastAt) };
  });
  const sets = mergeMap(n.sets, o.sets, (a, b) => ({
    ...b,
    ...a,
    best: maxOf(a.best, b.best),
    plays: maxOf(a.plays, b.plays),
    lastAt: maxOf(a.lastAt, b.lastAt),
  }));
  return { ...o, ...n, items, sets };
};

function shadowLastAt(item: unknown): number {
  if (!isObj(item) || !Array.isArray(item.attempts)) return 0;
  return maxOf(...item.attempts.map((a) => (isObj(a) ? a.at : 0)));
}

/** shadowing-progress: id → { attempts: [{at, score, self?}] (last 5), total, best, text? } */
export const mergeShadowing: Merger = (newer, older) => {
  const merged = mergeMap(newer, older, (n, o) => {
    const byKey = new Map<string, Obj>();
    for (const list of [o.attempts, n.attempts]) {
      if (!Array.isArray(list)) continue;
      for (const a of list) if (isObj(a) && finite(a.at)) byKey.set(`${a.at}|${String(a.score)}`, a);
    }
    const attempts = [...byKey.values()].sort((x, y) => num(x.at) - num(y.at)).slice(-SHADOW_HISTORY_LEN);
    const out: Obj = {
      ...o,
      ...n,
      attempts,
      total: Math.max(maxOf(n.total, o.total), attempts.length),
      best: maxOf(n.best, o.best, ...attempts.map((a) => a.score)),
    };
    const text = typeof n.text === 'string' && n.text ? n.text : o.text;
    if (typeof text === 'string' && text) out.text = text;
    return out;
  });
  const ids = Object.keys(merged);
  if (ids.length > SHADOW_MAX_ITEMS) {
    ids.sort((x, y) => shadowLastAt(merged[x]) - shadowLastAt(merged[y]));
    for (const id of ids.slice(0, ids.length - SHADOW_MAX_ITEMS)) delete merged[id];
  }
  return merged;
};

/**
 * drill-cards: { version, newPerDay, cards: id → CardState, daily }. Cards carry no review time,
 * so the card with more history wins: more lapses (only ever grows), then more reps, then later due.
 */
export const mergeDrill: Merger = (newer, older) => {
  const n = isObj(newer) ? newer : {};
  const o = isObj(older) ? older : {};
  const cards = mergeMap(n.cards, o.cards, (a, b) => {
    const d = num(a.lapses) - num(b.lapses) || num(a.reps) - num(b.reps) || num(a.due) - num(b.due);
    return d >= 0 ? a : b;
  });
  const out: Obj = { ...o, ...n, cards };
  const days = mergeDays(n, o, (nd, od) => {
    const ids = new Set<unknown>([...(Array.isArray(od.studiedIds) ? od.studiedIds : []), ...(Array.isArray(nd.studiedIds) ? nd.studiedIds : [])]);
    return {
      ...od,
      ...nd,
      newIntroduced: maxOf(nd.newIntroduced, od.newIntroduced),
      extraNew: maxOf(nd.extraNew, od.extraNew),
      reviews: maxOf(nd.reviews, od.reviews),
      studiedIds: [...ids].filter((x) => typeof x === 'string').sort(),
    };
  });
  out.daily = days.daily;
  if (days.otherDaily) out.otherDaily = days.otherDaily;
  else delete out.otherDaily;
  return out;
};

/**
 * Today's counters (`daily`, plus `otherDaily`) of drill-cards / review-cards. Machines can be on different local
 * days (around midnight, other timezone): the counters of the two latest days are kept, each day merged on its own
 * (`sameDay(newer, older)`), so a machine still on the earlier day keeps its spent budget instead of starting a
 * fresh one because another machine's date is ahead. The store parsers pick the day matching the local date.
 */
function mergeDays(n: Obj, o: Obj, sameDay: (newer: Obj, older: Obj) => Obj): { daily: unknown; otherDaily?: Obj } {
  const byDay = new Map<string, Obj>();
  for (const d of [o.otherDaily, o.daily, n.otherDaily, n.daily]) {
    if (!isObj(d) || typeof d.day !== 'string' || d.day === '') continue;
    const cur = byDay.get(d.day);
    // a lone day is normalised the same way (sameDay with itself), so merging again changes nothing
    byDay.set(d.day, sameDay(d, cur ?? d));
  }
  const days = [...byDay.keys()].sort().reverse();
  if (days.length === 0) return { daily: isObj(n.daily) ? n.daily : isObj(o.daily) ? o.daily : undefined };
  const daily = byDay.get(days[0]);
  return days.length > 1 ? { daily, otherDaily: byDay.get(days[1]) } : { daily };
}

/**
 * `last` of the card's own lineage. A copy pulled in by another lineage's miss (mergeReviewCard) carries that miss
 * time in `last` (= `missAt`) and its own in `baseLast`; once regraded locally `last` moves on and differs from
 * `missAt`, so the stale fields are ignored.
 */
function lineageLast(c: Obj): number {
  return finite(c.missAt) && c.missAt === c.last && finite(c.baseLast) ? c.baseLast : num(c.last);
}

/** Same lineage: the later `last` wins as a whole. Ties: more reps, longer interval, more lapses, later due. */
function laterCard(a: Obj, b: Obj): Obj {
  const d =
    lineageLast(a) - lineageLast(b) ||
    num(a.reps) - num(b.reps) ||
    num(a.interval) - num(b.interval) ||
    num(a.lapses) - num(b.lapses) ||
    num(a.due) - num(b.due);
  return d >= 0 ? a : b;
}

/** Local midnight that starts the day after `t` (as core/review/time, kept local so this file stays a leaf). */
function nextLocalMidnight(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

const isGradedCard = (c: Obj) => typeof c.lastGrade === 'string';

/**
 * One review card on both sides. Same `born` (or both from before `born` existed): one copy descends from the
 * other, so the later `last` wins. Different `born`: two devices created the card independently (one practised
 * before its folder copy arrived), and `last` says nothing about which is further: keep the most advanced copy
 * (graded beats never graded, then longer interval, more reps, later `last`). A miss on the other copy after it
 * only pulls the due date in, to the next day at the latest, as a miss on a not-due card does locally.
 *
 * The time of such a foreign miss travels with the card (`missAt`, max of all seen), and the pulled copy keeps its
 * lineage's own `last` in `baseLast`. So a later regrade of the winning lineage still beats the pulled copy, and the
 * miss is applied again on top of it: the result no longer depends on the order in which three copies meet.
 */
function mergeReviewCard(a: Obj, b: Obj): Obj {
  const same = num(a.born) === num(b.born);
  let win: Obj;
  let lose: Obj;
  if (same) {
    win = laterCard(a, b);
    lose = win === a ? b : a;
  } else {
    const d =
      (isGradedCard(a) ? 1 : 0) - (isGradedCard(b) ? 1 : 0) ||
      num(a.interval) - num(b.interval) ||
      num(a.reps) - num(b.reps) ||
      lineageLast(a) - lineageLast(b) ||
      num(a.due) - num(b.due);
    [win, lose] = d >= 0 ? [a, b] : [b, a];
  }
  let miss = maxOf(a.missAt, b.missAt);
  if (!same && lose.lastGrade === 'again') miss = Math.max(miss, num(lose.last));
  const own = lineageLast(win);
  // a miss before the winner's own last grade (or on a never graded card) changes nothing and is not kept
  if (!(miss > own) || !isGradedCard(win)) return win;
  const out: Obj = { ...win, missAt: miss };
  const pulled = Math.min(num(win.due), nextLocalMidnight(miss));
  if (!(pulled < num(win.due))) return out;
  out.due = pulled;
  out.lastGrade = 'again';
  out.baseLast = own;
  out.last = miss;
  const seen = maxOf(win.seenAt, lose.seenAt);
  if (seen > 0) out.seenAt = seen;
  return out;
}

/**
 * review-cards: { version, cards, daily, since, notice, noticeSeenAt } (docs/review-system.md §9).
 * Per card see mergeReviewCard (suspension follows the winning copy); `last` is monotonic per card, so a regrade
 * built on a copy with a skewed future `last` still wins. A corrupt card value never replaces a valid one.
 * Cards of kinds this build does not know are kept as they are.
 */
export const mergeReview: Merger = (newer, older) => {
  const n = isObj(newer) ? newer : {};
  const o = isObj(older) ? older : {};
  const cards = mergeMap(n.cards, o.cards, mergeReviewCard, true);

  const days = mergeDays(n, o, (nd, od) => {
    const union = (lists: unknown[]): string[] => {
      const set = new Set<string>();
      for (const list of lists) if (Array.isArray(list)) for (const x of list) if (typeof x === 'string') set.add(x);
      return [...set];
    };
    const ids = union([od.ids, nd.ids]);
    // exempt only when exempt on every side that reviewed it: a budgeted review on either device spent budget
    const spent = new Set<string>();
    for (const d of [od, nd]) {
      const ex = new Set(union([d.exempt]));
      for (const x of union([d.ids])) if (!ex.has(x)) spent.add(x);
    }
    return {
      ...od,
      ...nd,
      ids,
      exempt: ids.filter((x) => !spent.has(x)),
      extraSec: maxOf(nd.extraSec, od.extraSec),
      enrolled: maxOf(nd.enrolled, od.enrolled),
      // word cards answered for the first time today (WORD_NEW_PER_DAY); only written once it exists
      ...(nd.newWords !== undefined || od.newWords !== undefined ? { newWords: maxOf(nd.newWords, od.newWords) } : {}),
    };
  });

  const sinces = [n.since, o.since].filter((t): t is number => finite(t) && t > 0);
  const nn = isObj(n.notice) ? n.notice : null;
  const on = isObj(o.notice) ? o.notice : null;
  const notice = nn && on ? (num(on.at) > num(nn.at) ? on : nn) : (nn ?? on ?? null);
  const out: Obj = {
    ...o,
    ...n,
    cards,
    daily: days.daily,
    since: sinces.length ? Math.min(...sinces) : 0,
    notice,
    noticeSeenAt: maxOf(n.noticeSeenAt, o.noticeSeenAt),
  };
  if (days.otherDaily) out.otherDaily = days.otherDaily;
  else delete out.otherDaily;
  return out;
};

// ───────────────────────── lists keyed by id ─────────────────────────

/** Union by `id`; the newer side's record wins. Order: by createdAt (stable), as lists are appended. */
function unionById(newer: unknown[], older: unknown[], pick: (n: Obj, o: Obj) => Obj = (n) => n): unknown[] {
  const out: unknown[] = [];
  const index = new Map<string, number>();
  const olderById = new Map<string, Obj>();
  for (const it of older) if (isObj(it) && typeof it.id === 'string') olderById.set(it.id, it);
  for (const it of newer) {
    if (!isObj(it) || typeof it.id !== 'string') {
      out.push(it);
      continue;
    }
    if (index.has(it.id)) continue;
    const o = olderById.get(it.id);
    index.set(it.id, out.length);
    out.push(o ? pick(it, o) : it);
  }
  for (const it of older) {
    if (!isObj(it) || typeof it.id !== 'string') continue;
    if (index.has(it.id)) continue;
    index.set(it.id, out.length);
    out.push(it);
  }
  return out;
}

/** When a custom sentence last changed: its edit time, else its creation time. */
export const customStamp = (r: Obj): number => Math.max(num(r.updatedAt), num(r.createdAt));

/**
 * custom-sentences: [{ id, text, vi, level, createdAt, updatedAt? }]. Union by id; per sentence the version edited
 * last wins (updatedAt, else createdAt), whatever else either machine did since. Two versions without updatedAt
 * (from before it existed) keep the newer side, as before. Ordered by createdAt, then id. Deleted ids are removed
 * by mergeData (tombstones).
 */
export const mergeCustomSentences: Merger = (newer, older) => {
  const pick = (n: Obj, o: Obj): Obj => {
    const d = customStamp(n) - customStamp(o);
    if (d !== 0) return d > 0 ? n : o;
    return n.updatedAt === undefined && o.updatedAt === undefined ? n : stableLast(n, o);
  };
  const list = unionById(Array.isArray(newer) ? newer : [], Array.isArray(older) ? older : [], pick);
  return list
    .filter((it): it is Obj => isObj(it) && typeof it.id === 'string')
    .sort((a, b) => num(a.createdAt) - num(b.createdAt) || (a.id === b.id ? 0 : (a.id as string) < (b.id as string) ? -1 : 1));
};

/** When a media item last changed in a way a delete must respect: added or opened. */
export const mediaStamp = (r: Obj): number => Math.max(num(r.createdAt), num(r.openedAt));

/** An item without its merged progress lists: the tie-break key (unchanged by a merge, so the merge is associative). */
function mediaTieKey(it: Obj): string {
  const p = isObj(it.progress) ? { ...it.progress, done: undefined, scores: undefined, heard: undefined } : it.progress;
  return JSON.stringify({ ...it, progress: p });
}

function mergeMediaItem(n: Obj, o: Obj): Obj {
  const d = num(n.openedAt) - num(o.openedAt);
  const base = d > 0 ? n : d < 0 ? o : mediaTieKey(n) >= mediaTieKey(o) ? n : o;
  const np = isObj(n.progress) ? n.progress : {};
  const op = isObj(o.progress) ? o.progress : {};
  const done = new Set<number>();
  for (const p of [np, op]) if (Array.isArray(p.done)) for (const x of p.done) if (finite(x)) done.add(x);
  const best: Obj = {};
  for (const p of [op, np]) {
    if (!isObj(p.scores)) continue;
    for (const [k, v] of Object.entries(p.scores)) if (!UNSAFE.has(k) && finite(v)) best[k] = Math.max(num(best[k]), v);
  }
  const scores: Obj = {};
  for (const k of Object.keys(best).sort()) scores[k] = best[k];
  // lines whose audio was played on either machine (MediaProgress.heard): union, left out while empty
  const heard = new Set<number>();
  for (const p of [np, op]) if (Array.isArray(p.heard)) for (const x of p.heard) if (finite(x)) heard.add(x);
  const bp = base === n ? np : op;
  const progress: Obj = { ...bp, done: [...done].sort((a, b) => a - b), scores };
  if (heard.size) progress.heard = [...heard].sort((a, b) => a - b);
  else delete progress.heard;
  return { ...base, progress };
}

/**
 * media-library: { items: MediaItem[], prefs } (or the legacy bare array of items). Items: union by id, progress
 * merged, newest added first (createdAt, then id). prefs: the copy changed last (prefs.changedAt) wins as a whole.
 * Deleted ids are removed by mergeData (tombstones).
 */
export const mergeMedia: Merger = (newer, older) => {
  const n: Obj = Array.isArray(newer) ? { items: newer } : isObj(newer) ? newer : {};
  const o: Obj = Array.isArray(older) ? { items: older } : isObj(older) ? older : {};
  const items = unionById(Array.isArray(n.items) ? n.items : [], Array.isArray(o.items) ? o.items : [], mergeMediaItem)
    .filter((it): it is Obj => isObj(it) && typeof it.id === 'string')
    .sort((a, b) => num(b.createdAt) - num(a.createdAt) || (a.id === b.id ? 0 : (a.id as string) < (b.id as string) ? -1 : 1));
  const out: Obj = { ...o, ...n, items };
  const prefs = changedLast(n.prefs, o.prefs, 'changedAt');
  if (prefs !== undefined) out.prefs = prefs;
  return out;
};

/** decoder-history: recent inputs, newest first. */
export const mergeHistory: Merger = (newer, older) => {
  const n = Array.isArray(newer) ? newer : [];
  const o = Array.isArray(older) ? older : [];
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const t of [...n, ...o]) {
    if (typeof t !== 'string' || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.slice(0, Math.max(n.length, o.length));
};

/** onboarding: once finished on any machine it stays finished. */
export const mergeOnboarding: Merger = (newer, older) => {
  const done = (v: unknown) => v === true || (isObj(v) && v.done === true);
  return !done(newer) && done(older) ? older : newer;
};

// ───────────────────────── listening log, checkups, progress archive ─────────────────────────

/** Records of `{ [listKey]: [...] }` (or a bare array) that have a string id and pass `ok`. */
function recordsOf(v: unknown, listKey: string, ok: (r: Obj) => boolean): Obj[] {
  const list = Array.isArray(v) ? v : isObj(v) && Array.isArray(v[listKey]) ? (v[listKey] as unknown[]) : [];
  return list.filter((r): r is Obj => isObj(r) && typeof r.id === 'string' && r.id !== '' && !UNSAFE.has(r.id) && ok(r));
}

/**
 * listening-log: { version, entries: [entry | { id, updatedAt, deleted: true }] }. Union by id; the newer
 * `updatedAt` wins, a tombstone wins a tie (a delete is never undone by a merge), so deletes reach every machine.
 * Commutative and idempotent; entries sorted by id.
 */
export const mergeListeningLog: Merger = (newer, older) => {
  const n = isObj(newer) ? newer : {};
  const o = isObj(older) ? older : {};
  const byId = new Map<string, Obj>();
  for (const r of [...recordsOf(older, 'entries', (x) => finite(x.updatedAt)), ...recordsOf(newer, 'entries', (x) => finite(x.updatedAt))]) {
    const id = r.id as string;
    const cur = byId.get(id);
    if (!cur) {
      byId.set(id, r);
      continue;
    }
    const d = num(r.updatedAt) - num(cur.updatedAt) || (r.deleted === true ? 1 : 0) - (cur.deleted === true ? 1 : 0);
    byId.set(id, d > 0 ? r : d < 0 ? cur : stableLast(r, cur));
  }
  const entries = [...byId.values()].sort((a, b) => ((a.id as string) < (b.id as string) ? -1 : 1));
  return { ...o, ...n, version: 1, entries };
};

/** checkup-results: { version, results: CheckupResult[] }. Union by id (a result never changes); sorted by time. */
export const mergeCheckups: Merger = (newer, older) => {
  const n = isObj(newer) ? newer : {};
  const o = isObj(older) ? older : {};
  const byId = new Map<string, Obj>();
  for (const r of [...recordsOf(older, 'results', (x) => finite(x.at)), ...recordsOf(newer, 'results', (x) => finite(x.at))]) {
    const cur = byId.get(r.id as string);
    byId.set(r.id as string, cur ? stableLast(r, cur) : r);
  }
  const results = [...byId.values()].sort((a, b) => num(a.at) - num(b.at) || ((a.id as string) < (b.id as string) ? -1 : 1));
  return { ...o, ...n, version: 1, results };
};

/** progress-history: per-device daily buckets, max per device/day/field (core/history explains why). */
export const mergeProgressHistory: Merger = (newer, older) => mergeHistoryStores(parseHistory(newer), parseHistory(older));

/**
 * town-progress (Thị trấn, core/town/progress): everything in it only grows, so nothing needs a change time.
 * Lines: per line the max of best / tries / at. Xu earned: one bucket per browser, max per browser (a browser only
 * adds to its own). Purchases: a union. Daily counters: max / union per day and browser. Active days: a union.
 * Junk and unknown fields are dropped; a version 1 value (lines only) merges as it is.
 */
export const mergeTown: Merger = (newer, older) => mergeTownProgress(parseTownProgress(newer), parseTownProgress(older));

/** Short key (without prefix) → merge strategy. Keys not listed (unknown): newer side wins. */
const MERGERS: Record<string, Merger> = {
  settings: mergeSettings,
  tombstones: mergeTombstones,
  reset: mergeReset,
  stats: mergeStats,
  'dictation-progress': mergeDictation,
  'lessons-progress': mergeLessons,
  'pairs-progress': mergePairs,
  'shadowing-progress': mergeShadowing,
  'drill-cards': mergeDrill,
  'review-cards': mergeReview,
  'custom-sentences': mergeCustomSentences,
  'media-library': mergeMedia,
  'decoder-history': mergeHistory,
  onboarding: mergeOnboarding,
  'listening-log': mergeListeningLog,
  'checkup-results': mergeCheckups,
  'progress-history': mergeProgressHistory,
  'town-progress': mergeTown,
};

function tryParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/**
 * Merge one key's two raw values. A side that is not valid JSON loses; if both are broken the
 * newer raw value is kept as is.
 */
export function mergeValue(shortKey: string, localRaw: string, remoteRaw: string, remoteNewer: boolean): string {
  const newerRaw = remoteNewer ? remoteRaw : localRaw;
  const l = tryParse(localRaw);
  const r = tryParse(remoteRaw);
  if (!l.ok && !r.ok) return newerRaw;
  if (!l.ok) return remoteRaw;
  if (!r.ok) return localRaw;
  const merger = Object.prototype.hasOwnProperty.call(MERGERS, shortKey) ? MERGERS[shortKey] : null;
  if (!merger) return newerRaw;
  try {
    const merged = remoteNewer ? merger(r.value, l.value) : merger(l.value, r.value);
    const text = JSON.stringify(merged);
    return typeof text === 'string' ? text : newerRaw;
  } catch {
    return newerRaw;
  }
}

const RESET_KEY = STORAGE_PREFIX + KEYS.reset;
const TOMBSTONES_KEY = STORAGE_PREFIX + KEYS.tombstones;
/** Bookkeeping keys: they make deletes stick but are not learner data on their own. */
const BOOKKEEPING = new Set([RESET_KEY, TOMBSTONES_KEY]);

/** The data holds something besides sync bookkeeping (reset marker, tombstones). */
export function hasUserData(data: DataMap): boolean {
  return Object.keys(data).some((k) => k.startsWith(STORAGE_PREFIX) && !BOOKKEEPING.has(k));
}

function parsedOr(raw: string | undefined): unknown {
  if (typeof raw !== 'string') return null;
  const p = tryParse(raw);
  return p.ok ? p.value : null;
}

/**
 * Drop the values of each side that are older than a reset the other side has seen ("Xóa dữ liệu" or a restore on
 * another machine: `all`; "Xóa lịch sử luyện tập": per key). Decided by the markers, not by clocks.
 */
function dropPreReset(local: DataMap, remote: DataMap): [DataMap, DataMap] {
  const ml = parseReset(parsedOr(local[RESET_KEY]));
  const mr = parseReset(parsedOr(remote[RESET_KEY]));
  const keep = (side: DataMap, mine: ResetMarker, theirs: ResetMarker): DataMap => {
    const out: DataMap = {};
    for (const k of Object.keys(side)) {
      if (!k.startsWith(STORAGE_PREFIX)) continue;
      const short = k.slice(STORAGE_PREFIX.length);
      if (k !== RESET_KEY && resetTimeFor(mine, short) < resetTimeFor(theirs, short)) continue;
      out[k] = side[k];
    }
    return out;
  };
  return [keep(local, ml, mr), keep(remote, mr, ml)];
}

/** Remove deleted custom sentences / media items that came back from a copy that still had them. */
function applyTombstones(out: DataMap): DataMap {
  const raw = out[TOMBSTONES_KEY];
  if (typeof raw !== 'string') return out;
  const t: Tombstones = parseTombstones(parsedOr(raw));
  // a record changed after its delete survives; a delete wins a tie
  const keep = (kind: TombKind, stampOf: (r: Obj) => number) => (r: unknown) => {
    if (!isObj(r) || typeof r.id !== 'string') return true;
    const at = tombstoneAt(t, kind, r.id);
    return at === 0 || at < stampOf(r);
  };
  const ck = STORAGE_PREFIX + KEYS.customSentences;
  const cs = parsedOr(out[ck]);
  if (Array.isArray(cs)) {
    const kept = cs.filter(keep('custom', customStamp));
    if (kept.length !== cs.length) out[ck] = JSON.stringify(kept);
  }
  const mk = STORAGE_PREFIX + KEYS.media;
  const lib = parsedOr(out[mk]);
  const items = Array.isArray(lib) ? lib : isObj(lib) && Array.isArray(lib.items) ? lib.items : null;
  if (items) {
    const kept = items.filter(keep('media', mediaStamp));
    if (kept.length !== items.length) out[mk] = JSON.stringify(Array.isArray(lib) ? kept : { ...(lib as Obj), items: kept });
  }
  return out;
}

export interface MergeDataOptions {
  /**
   * Drop values older than a reset the other side has seen (default true). Off for a first connection, where the
   * learner explicitly chose to combine both copies.
   */
  honorReset?: boolean;
}

/**
 * Merge this browser's data with the folder file's data. Keys present on one side only are kept.
 * `remoteNewer`: the folder file was saved after the last local change (decides keys without a merger).
 * Values older than a reset on the other side are dropped first; deleted items (tombstones) are removed last.
 */
export function mergeData(local: DataMap, remote: DataMap, remoteNewer: boolean, opts: MergeDataOptions = {}): DataMap {
  if (opts.honorReset !== false) [local, remote] = dropPreReset(local, remote);
  const out: DataMap = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const k of [...keys].sort()) {
    if (!k.startsWith(STORAGE_PREFIX)) continue;
    const a = Object.prototype.hasOwnProperty.call(local, k) ? local[k] : undefined;
    const b = Object.prototype.hasOwnProperty.call(remote, k) ? remote[k] : undefined;
    if (typeof a !== 'string') {
      if (typeof b === 'string') out[k] = b;
      continue;
    }
    if (typeof b !== 'string' || a === b) {
      out[k] = a;
      continue;
    }
    out[k] = mergeValue(k.slice(STORAGE_PREFIX.length), a, b, remoteNewer);
  }
  return applyTombstones(out);
}
