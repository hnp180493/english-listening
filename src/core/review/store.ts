// Review store: parse/sanitise + pure transitions (docs/review-system.md §3.6). No storage access here.

import { GRADES, MAX_INTERVAL_DAYS, MIN_EASE, START_EASE, type Grade } from '../srs';
import { EXTRA_STEP_SEC } from './constants';
import { parseCardId, STORED_KINDS } from './ids';
import { localDay } from './time';
import type { CardId, ReviewCard, ReviewDaily, ReviewStore, SeedNotice, StoredKind } from './types';

const MAX_EASE = 5;
const STORED = new Set<string>(STORED_KINDS);
const GRADE_SET = new Set<string>(GRADES);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown, fallback: number) => (finite(v) ? v : fallback);
const count = (v: unknown) => Math.max(0, Math.floor(num(v, 0)));
const nonNeg = (v: unknown) => (finite(v) && v >= 0 ? v : 0);

export function emptyDaily(now: number): ReviewDaily {
  return { day: localDay(now), ids: [], exempt: [], extraSec: 0, enrolled: 0 };
}

export function emptyReviewStore(now: number): ReviewStore {
  return {
    version: 1,
    cards: {},
    daily: emptyDaily(now),
    since: 0,
    notice: null,
    noticeSeenAt: 0,
  };
}

function sanitizeCard(id: string, v: unknown, now: number): ReviewCard | null {
  if (!isRecord(v)) return null;
  const card: ReviewCard = {
    id,
    due: num(v.due, now),
    interval: Math.min(MAX_INTERVAL_DAYS, Math.max(0, num(v.interval, 0))),
    ease: Math.min(MAX_EASE, Math.max(MIN_EASE, num(v.ease, START_EASE))),
    reps: count(v.reps),
    lapses: count(v.lapses),
    last: nonNeg(v.last), // kept raw even in the future: the sync merge compares it
  };
  if (typeof v.lastGrade === 'string' && GRADE_SET.has(v.lastGrade)) card.lastGrade = v.lastGrade as Grade;
  if (v.suspended === true) card.suspended = true;
  if (finite(v.born) && v.born > 0) card.born = v.born;
  if (finite(v.seenAt) && v.seenAt >= 0) card.seenAt = v.seenAt;
  return card;
}

/** Whatever was stored (corrupt, partial, older) → a valid store. Never throws. */
export function parseReviewStore(raw: unknown, now: number): ReviewStore {
  const out = emptyReviewStore(now);
  if (!isRecord(raw)) return out;
  if (isRecord(raw.cards)) {
    for (const [key, v] of Object.entries(raw.cards)) {
      const p = parseCardId(key);
      if (!p || !STORED.has(p.kind)) continue;
      const c = sanitizeCard(key, v, now);
      if (c) out.cards[key] = c;
    }
  }
  const d = raw.daily;
  if (isRecord(d) && d.day === out.daily.day) {
    const idList = (v: unknown, within?: ReadonlySet<string>): CardId[] => {
      const list: CardId[] = [];
      const seen = new Set<string>();
      if (!Array.isArray(v)) return list;
      for (const x of v) {
        if (typeof x !== 'string' || seen.has(x) || !parseCardId(x) || (within && !within.has(x))) continue;
        seen.add(x);
        list.push(x as CardId);
      }
      return list;
    };
    const ids = idList(d.ids);
    const exempt = idList(d.exempt, new Set(ids));
    out.daily = {
      day: out.daily.day,
      ids,
      exempt,
      extraSec: count(d.extraSec),
      enrolled: count(d.enrolled),
    };
    if (count(d.newWords) > 0) out.daily.newWords = count(d.newWords);
  }
  out.since = nonNeg(raw.since);
  out.noticeSeenAt = nonNeg(raw.noticeSeenAt);
  const n = raw.notice;
  if (isRecord(n) && finite(n.count) && finite(n.at) && n.count >= 0 && n.at >= 0) {
    out.notice = { count: Math.floor(n.count), at: n.at } satisfies SeedNotice;
    if (finite(n.words) && n.words > 0) out.notice.words = Math.min(out.notice.count, Math.floor(n.words));
  }
  return out;
}

/** New local day → empty daily counters. Same object when nothing changes. */
export function rollReviewDaily(store: ReviewStore, now: number): ReviewStore {
  const day = localDay(now);
  if (store.daily.day === day) return store;
  return { ...store, daily: emptyDaily(now) };
}

export function withCard(store: ReviewStore, card: ReviewCard): ReviewStore {
  return { ...store, cards: { ...store.cards, [card.id]: card } };
}

/**
 * Roll the day, then append `id` to today's reviewed ids (once). `exempt`: the item was already touched today
 * before this grade (practice failure, learning step), so it does not spend the daily budget.
 */
export function withReviewed(store: ReviewStore, id: CardId, now: number, exempt = false): ReviewStore {
  const s = rollReviewDaily(store, now);
  if (s.daily.ids.includes(id)) return s;
  const daily = { ...s.daily, ids: [...s.daily.ids, id] };
  if (exempt) daily.exempt = [...s.daily.exempt, id];
  return { ...s, daily };
}

export function withEnrolled(store: ReviewStore, now: number): ReviewStore {
  const s = rollReviewDaily(store, now);
  return { ...s, daily: { ...s.daily, enrolled: s.daily.enrolled + 1 } };
}

/** A word card answered for the first time: one new item (NEW_ENROL_PER_DAY) and one new word (WORD_NEW_PER_DAY). */
export function withNewWord(store: ReviewStore, now: number): ReviewStore {
  const s = rollReviewDaily(store, now);
  return {
    ...s,
    daily: {
      ...s.daily,
      enrolled: s.daily.enrolled + 1,
      newWords: (s.daily.newWords ?? 0) + 1,
    },
  };
}

export function withExtra(store: ReviewStore, now: number): ReviewStore {
  const s = rollReviewDaily(store, now);
  return {
    ...s,
    daily: { ...s.daily, extraSec: s.daily.extraSec + EXTRA_STEP_SEC },
  };
}

/** Sets `since` when it is 0; same object otherwise. */
export function withSince(store: ReviewStore, since: number): ReviewStore {
  if (store.since > 0 || !(since > 0)) return store;
  return { ...store, since };
}

/** Stored cards of one kind keyed by ref (orphans included). */
export function cardsOfKind(store: ReviewStore, kind: StoredKind): Record<string, ReviewCard> {
  const out: Record<string, ReviewCard> = {};
  const prefix = `${kind}:`;
  for (const [id, c] of Object.entries(store.cards)) if (id.startsWith(prefix)) out[id.slice(prefix.length)] = c;
  return out;
}

const CARD_FIELDS = [
  'due',
  'interval',
  'ease',
  'reps',
  'lapses',
  'lastGrade',
  'last',
  'suspended',
  'born',
  'seenAt',
] as const;

function cardsEqual(a: ReviewCard, b: ReviewCard): boolean {
  if (a.id !== b.id) return false;
  for (const f of CARD_FIELDS) if (a[f] !== b[f]) return false;
  return true;
}

/** Cheap deep compare, used to skip no-op saves. */
export function storesEqual(a: ReviewStore, b: ReviewStore): boolean {
  if (a === b) return true;
  if (a.version !== b.version || a.since !== b.since || a.noticeSeenAt !== b.noticeSeenAt) return false;
  if ((a.notice?.count ?? -1) !== (b.notice?.count ?? -1) || (a.notice?.at ?? -1) !== (b.notice?.at ?? -1))
    return false;
  if ((a.notice?.words ?? 0) !== (b.notice?.words ?? 0)) return false;
  const da = a.daily;
  const db = b.daily;
  if (da.day !== db.day || da.extraSec !== db.extraSec || da.enrolled !== db.enrolled) return false;
  if ((da.newWords ?? 0) !== (db.newWords ?? 0)) return false;
  if (da.ids.length !== db.ids.length || da.ids.some((x, i) => x !== db.ids[i])) return false;
  if (da.exempt.length !== db.exempt.length || da.exempt.some((x, i) => x !== db.exempt[i])) return false;
  if (a.cards === b.cards) return true;
  const ka = Object.keys(a.cards);
  if (ka.length !== Object.keys(b.cards).length) return false;
  for (const k of ka) {
    const cb = b.cards[k];
    if (!cb || !Object.prototype.hasOwnProperty.call(b.cards, k) || !cardsEqual(a.cards[k], cb)) return false;
  }
  return true;
}
