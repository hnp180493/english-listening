// Merge two copies of the app's stored data: this browser's localStorage and the data file in
// the synced folder (OneDrive). Pure and defensive: values may be corrupt, partial or from an
// older version. The rule is "never lose progress": per-item progress keeps the most advanced
// record, lists are unioned, and only plain preferences take the newer side as a whole.

import { mergeHistoryStores, parseHistory } from './history';
import { STORAGE_PREFIX } from './storage';

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
  const nd = isObj(n.daily) ? n.daily : null;
  const od = isObj(o.daily) ? o.daily : null;
  if (nd && od && typeof nd.day === 'string' && nd.day === od.day) {
    const ids = new Set<unknown>([...(Array.isArray(od.studiedIds) ? od.studiedIds : []), ...(Array.isArray(nd.studiedIds) ? nd.studiedIds : [])]);
    out.daily = {
      ...od,
      ...nd,
      newIntroduced: maxOf(nd.newIntroduced, od.newIntroduced),
      extraNew: maxOf(nd.extraNew, od.extraNew),
      reviews: maxOf(nd.reviews, od.reviews),
      studiedIds: [...ids].filter((x) => typeof x === 'string'),
    };
  } else if (nd && od) {
    out.daily = String(od.day ?? '') > String(nd.day ?? '') ? od : nd;
  } else {
    out.daily = nd ?? od ?? undefined;
  }
  return out;
};

/** Same lineage: the later `last` wins as a whole. Ties: more reps, longer interval, more lapses, later due. */
function laterCard(a: Obj, b: Obj): Obj {
  const d =
    num(a.last) - num(b.last) ||
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
 */
function mergeReviewCard(a: Obj, b: Obj): Obj {
  if (num(a.born) === num(b.born)) return laterCard(a, b);
  const d =
    (isGradedCard(a) ? 1 : 0) - (isGradedCard(b) ? 1 : 0) ||
    num(a.interval) - num(b.interval) ||
    num(a.reps) - num(b.reps) ||
    num(a.last) - num(b.last) ||
    num(a.due) - num(b.due);
  const [win, lose] = d >= 0 ? [a, b] : [b, a];
  if (lose.lastGrade !== 'again' || !isGradedCard(win) || num(lose.last) <= num(win.last)) return win;
  const pulled = Math.min(num(win.due), nextLocalMidnight(num(lose.last)));
  if (!(pulled < num(win.due))) return win;
  const out: Obj = { ...win, due: pulled, lastGrade: 'again', last: num(lose.last) };
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

  const nd = isObj(n.daily) ? n.daily : null;
  const od = isObj(o.daily) ? o.daily : null;
  let daily: unknown;
  if (nd && od && typeof nd.day === 'string' && nd.day === od.day) {
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
    daily = {
      ...od,
      ...nd,
      ids,
      exempt: ids.filter((x) => !spent.has(x)),
      extraSec: maxOf(nd.extraSec, od.extraSec),
      enrolled: maxOf(nd.enrolled, od.enrolled),
      // word cards answered for the first time today (WORD_NEW_PER_DAY); only written once it exists
      ...(nd.newWords !== undefined || od.newWords !== undefined ? { newWords: maxOf(nd.newWords, od.newWords) } : {}),
    };
  } else if (nd && od) {
    daily = String(od.day ?? '') > String(nd.day ?? '') ? od : nd;
  } else {
    daily = nd ?? od ?? undefined;
  }

  const sinces = [n.since, o.since].filter((t): t is number => finite(t) && t > 0);
  const nn = isObj(n.notice) ? n.notice : null;
  const on = isObj(o.notice) ? o.notice : null;
  const notice = nn && on ? (num(on.at) > num(nn.at) ? on : nn) : (nn ?? on ?? null);
  return {
    ...o,
    ...n,
    cards,
    daily,
    since: sinces.length ? Math.min(...sinces) : 0,
    notice,
    noticeSeenAt: maxOf(n.noticeSeenAt, o.noticeSeenAt),
  };
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

/** custom-sentences: [{ id, text, vi, level, createdAt }] */
export const mergeCustomSentences: Merger = (newer, older) => {
  const list = unionById(Array.isArray(newer) ? newer : [], Array.isArray(older) ? older : []);
  return list
    .map((it, i) => ({ it, i }))
    .sort((a, b) => num(isObj(a.it) ? a.it.createdAt : 0) - num(isObj(b.it) ? b.it.createdAt : 0) || a.i - b.i)
    .map((x) => x.it);
};

function mergeMediaItem(n: Obj, o: Obj): Obj {
  const base = num(o.openedAt) > num(n.openedAt) ? o : n;
  const np = isObj(n.progress) ? n.progress : {};
  const op = isObj(o.progress) ? o.progress : {};
  const done = new Set<number>();
  for (const p of [np, op]) if (Array.isArray(p.done)) for (const d of p.done) if (finite(d)) done.add(d);
  const scores: Obj = {};
  for (const p of [op, np]) {
    if (!isObj(p.scores)) continue;
    for (const [k, v] of Object.entries(p.scores)) if (!UNSAFE.has(k) && finite(v)) scores[k] = Math.max(num(scores[k]), v);
  }
  const bp = base === n ? np : op;
  return {
    ...base,
    progress: { ...bp, done: [...done].sort((a, b) => a - b), scores },
  };
}

/** media-library: { items: MediaItem[], prefs } (or the legacy bare array of items). */
export const mergeMedia: Merger = (newer, older) => {
  const n: Obj = Array.isArray(newer) ? { items: newer } : isObj(newer) ? newer : {};
  const o: Obj = Array.isArray(older) ? { items: older } : isObj(older) ? older : {};
  const items = unionById(Array.isArray(n.items) ? n.items : [], Array.isArray(o.items) ? o.items : [], mergeMediaItem);
  return { ...o, ...n, items };
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

/** Deterministic tie-break between two records with the same id (keeps the merge commutative). */
const stableLast = (a: Obj, b: Obj): Obj => (JSON.stringify(a) >= JSON.stringify(b) ? a : b);

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

/** Short key (without prefix) → merge strategy. Keys not listed (settings, unknown): newer side wins. */
const MERGERS: Record<string, Merger> = {
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

/**
 * Merge this browser's data with the folder file's data. Keys present on one side only are kept.
 * `remoteNewer`: the folder file was saved after the last local change (decides plain preferences).
 */
export function mergeData(local: DataMap, remote: DataMap, remoteNewer: boolean): DataMap {
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
  return out;
}
