// What Ôn tập serves and when (docs/review-system.md §3.9). Pure: every function takes `now`.

import { availableAt, MATURE_DAYS, type CardState } from '../srs';
import type { DrillStore } from '../../features/drill/drillStore';
import type { Catalog } from './catalog';
import {
  INTERLEAVE_BLOCK,
  KIND_ORDER,
  KIND_SECONDS,
  LEARN_AHEAD_MS,
  LESSON_PER_DAY,
  LESSON_PER_SESSION,
  MAX_SESSION_ITEMS,
  MIN_SESSION_ITEMS,
  NEW_ENROL_PER_DAY,
  SESSION_SEC,
  TAP_KINDS,
  WORD_NEW_PER_DAY,
} from './constants';
import { kindSeconds, makeCardId, parseCardId } from './ids';
import { seenToday } from './schedule';
import { localDay, localDayDiff, nextLocalMidnight } from './time';
import { wordIndex } from './words';
import type { CardId, ForecastDay, KindCount, ReviewEntry, ReviewKind, ReviewStore, ReviewSummary } from './types';

const KIND_RANK: Record<ReviewKind, number> = Object.fromEntries(KIND_ORDER.map((k, i) => [k, i])) as Record<
  ReviewKind,
  number
>;

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byKindThenId = (a: ReviewEntry, b: ReviewEntry) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || cmpStr(a.id, b.id);

function emptyKindRecord<T>(make: () => T): Record<ReviewKind, T> {
  return Object.fromEntries(KIND_ORDER.map((k) => [k, make()])) as Record<ReviewKind, T>;
}

/** Every schedulable item: stored cards (suspended, orphaned and retired lessons left out) + drill chunks. */
export function collectEntries(store: ReviewStore, drill: DrillStore, catalog: Catalog, now: number): ReviewEntry[] {
  const today = localDay(now);
  const out: ReviewEntry[] = [];
  for (const [key, card] of Object.entries(store.cards)) {
    const p = parseCardId(key);
    if (!p || p.kind === 'chunk' || card.suspended) continue;
    const id = key as CardId;
    if (!catalog.has(id)) continue;
    if (p.kind === 'lesson' && card.interval >= MATURE_DAYS) continue; // retired
    const rank = p.kind === 'word' ? wordIndex().byId.get(id)?.rank : undefined;
    out.push({
      id,
      kind: p.kind,
      ref: p.ref,
      state: card,
      last: card.last,
      ...(card.seenAt !== undefined ? { seenAt: card.seenAt } : {}),
      availableAt: availableAt(card),
      touchedToday: seenToday(card, now),
      ...(rank !== undefined ? { rank } : {}),
    });
  }
  const studiedToday = drill.daily.day === today ? new Set(drill.daily.studiedIds) : new Set<string>();
  for (const [ref, state] of Object.entries(drill.cards)) {
    const id = makeCardId('chunk', ref);
    if (!parseCardId(id) || !catalog.has(id)) continue;
    const studied = studiedToday.has(ref);
    out.push({
      id,
      kind: 'chunk',
      ref,
      state,
      // The drill page handles its own same-day learning steps: hide them from Ôn tập until tomorrow.
      availableAt: studied && state.interval === 0 ? nextLocalMidnight(now) : availableAt(state),
      touchedToday: studied,
    });
  }
  return out.sort(byKindThenId);
}

/** Never graded in this layer: a reconciled (catch-up) card or an enrolled-but-unseen one. Never a chunk. */
const isUngraded = (e: ReviewEntry) => e.kind !== 'chunk' && e.state.lastGrade === undefined;

/** A word card never answered yet: new learning, admitted at most WORD_NEW_PER_DAY a day, after everything else. */
export const isNewWord = (e: Pick<ReviewEntry, 'kind' | 'state'>): boolean =>
  e.kind === 'word' && e.state.lastGrade === undefined;

/**
 * New words among themselves: the newest first-day first (the words of the lesson passed last come before words that
 * have waited longer: their first spaced review matters most), then teaching order (`rank`), then id.
 */
function byNewWordOrder(a: ReviewEntry, b: ReviewEntry): number {
  const da = localDay(a.availableAt);
  const db = localDay(b.availableAt);
  if (da !== db) return da < db ? 1 : -1;
  return (a.rank ?? Infinity) - (b.rank ?? Infinity) || cmpStr(a.id, b.id);
}

/**
 * Learning first, then graded before never-graded catch-up, then most overdue, then KIND_ORDER, then id; ids in
 * `later` after those (same relative order); new words after everything, `later` included (byNewWordOrder, `later`
 * ones last). Catch-up cards come after graded ones so the budget keeps what the learner already reviews on
 * schedule, and only catch-up waits when the day is full. New words come after skipped items too, so admitToday
 * meets every graded item (and knows whether one is held back) before it admits a new word.
 */
function sortDue(list: readonly ReviewEntry[], later?: ReadonlySet<CardId>): ReviewEntry[] {
  const rest = list
    .filter((e) => !isNewWord(e))
    .sort(
      (a, b) =>
        (a.state.interval === 0 ? 0 : 1) - (b.state.interval === 0 ? 0 : 1) ||
        (isUngraded(a) ? 1 : 0) - (isUngraded(b) ? 1 : 0) ||
        a.state.due - b.state.due ||
        byKindThenId(a, b),
    );
  const fresh = list.filter((e) => isNewWord(e)).sort(byNewWordOrder);
  if (!later || later.size === 0) return [...rest, ...fresh];
  const now = (e: ReviewEntry) => !later.has(e.id);
  const skipped = (e: ReviewEntry) => later.has(e.id);
  return [...rest.filter(now), ...rest.filter(skipped), ...fresh.filter(now), ...fresh.filter(skipped)];
}

interface DailyView {
  ids: CardId[];
  exempt: CardId[];
  extraSec: number;
  enrolled: number;
  newWords?: number;
}

function todayOf(store: ReviewStore, now: number): DailyView {
  const d = store.daily;
  return d.day === localDay(now) ? d : { ids: [], exempt: [], extraSec: 0, enrolled: 0, newWords: 0 };
}

/**
 * New words that may still start today: WORD_NEW_PER_DAY minus those answered today, and never more than the
 * shared new-item budget (NEW_ENROL_PER_DAY − enrolled) leaves.
 */
export function newWordsLeft(store: ReviewStore, now: number): number {
  const d = todayOf(store, now);
  return Math.max(0, Math.min(WORD_NEW_PER_DAY - (d.newWords ?? 0), NEW_ENROL_PER_DAY - d.enrolled));
}

function secondsOf(list: readonly { kind: ReviewKind }[]): number {
  let s = 0;
  for (const e of list) s += KIND_SECONDS[e.kind];
  return s;
}

/**
 * Seconds the learner can still spend today: reviewMinutes budget + "Ôn thêm" − what was reviewed. Items already
 * touched today when reviewed (daily.exempt) are budget-exempt, so they spend nothing.
 */
function budgetOf(store: ReviewStore, budgetSec: number, now: number) {
  const d = todayOf(store, now);
  const total = Math.max(0, budgetSec) + d.extraSec;
  const exempt = new Set(d.exempt);
  let spent = 0;
  for (const id of d.ids) if (!exempt.has(id)) spent += kindSeconds(id);
  return { daily: d, total, spent, capLeft: Math.max(0, total - spent) };
}

export interface Admission {
  touched: ReviewEntry[];
  admitted: ReviewEntry[];
  /** Graded items over the budget: the backlog that turns back-pressure on. */
  held: ReviewEntry[];
  /**
   * Waiting for a later day without blocking new learning: lessons over LESSON_PER_DAY, catch-up over the budget,
   * new words over the budget or over the day's new-word allowance.
   */
  deferred: ReviewEntry[];
}

/**
 * Split today's due entries: touched today (budget-exempt), admitted within the budget, held back (graded, over
 * the budget) and deferred (over the lesson cap, or never-graded catch-up over the budget).
 */
export function admitToday(
  entries: readonly ReviewEntry[],
  store: ReviewStore,
  budgetSec: number,
  now: number,
  later?: ReadonlySet<CardId>,
): Admission {
  const due = sortDue(
    entries.filter((e) => e.availableAt <= now),
    later,
  );
  const { daily, capLeft } = budgetOf(store, budgetSec, now);
  const touched: ReviewEntry[] = [];
  const admitted: ReviewEntry[] = [];
  const held: ReviewEntry[] = [];
  const deferred: ReviewEntry[] = [];
  let acc = 0;
  let lessons = daily.ids.filter((id) => id.startsWith('lesson:')).length;
  let words = newWordsLeft(store, now);
  for (const e of due) {
    if (e.touchedToday) {
      touched.push(e);
      continue;
    }
    if (isNewWord(e)) {
      // last in the order: admitted only from budget nothing else needs, never while items are held back
      if (words > 0 && held.length === 0 && acc < capLeft) {
        admitted.push(e);
        acc += KIND_SECONDS[e.kind];
        words--;
      } else deferred.push(e);
      continue;
    }
    if (e.kind === 'lesson' && lessons >= LESSON_PER_DAY) {
      deferred.push(e);
      continue;
    }
    if (acc < capLeft) {
      admitted.push(e);
      acc += KIND_SECONDS[e.kind];
      if (e.kind === 'lesson') lessons++;
    } else if (isUngraded(e)) deferred.push(e);
    else held.push(e);
  }
  return { touched, admitted, held, deferred };
}

/**
 * Load per day from today (day 0 includes everything overdue). No time budget applied, but new words start at most
 * WORD_NEW_PER_DAY a day (today: what is left of today's allowance, when `store` is given), so words waiting for
 * their turn move to the following days as they will.
 */
export function forecast(entries: readonly ReviewEntry[], now: number, days = 7, store?: ReviewStore): ForecastDay[] {
  const out: ForecastDay[] = [];
  const base = new Date(now);
  for (let k = 0; k < days; k++) {
    const t = new Date(base.getFullYear(), base.getMonth(), base.getDate() + k).getTime();
    out.push({ day: localDay(t), offset: k, count: 0, seconds: 0 });
  }
  const fresh: number[] = [];
  for (const e of entries) {
    const k = Math.max(0, localDayDiff(now, e.availableAt));
    if (k >= days) continue;
    if (isNewWord(e)) {
      fresh[k] = (fresh[k] ?? 0) + 1;
      continue;
    }
    out[k].count++;
    out[k].seconds += KIND_SECONDS[e.kind];
  }
  let waiting = 0;
  for (let k = 0; k < days; k++) {
    waiting += fresh[k] ?? 0;
    const cap = k === 0 && store ? Math.min(WORD_NEW_PER_DAY, newWordsLeft(store, now)) : WORD_NEW_PER_DAY;
    const n = Math.min(waiting, cap);
    waiting -= n;
    out[k].count += n;
    out[k].seconds += n * KIND_SECONDS.word;
  }
  return out;
}

/** Earliest availableAt strictly after `now` (optionally of one kind), else null. */
export function nextAvailable(entries: readonly ReviewEntry[], now: number, kind?: ReviewKind): number | null {
  let best: number | null = null;
  for (const e of entries) {
    if (kind && e.kind !== kind) continue;
    if (e.availableAt > now && (best === null || e.availableAt < best)) best = e.availableAt;
  }
  return best;
}

/**
 * Counters for badges, Home and Stats. `catalog` (optional) limits `suspended` to cards whose content
 * still exists; without it every suspended stored card counts.
 */
export function summarize(
  entries: readonly ReviewEntry[],
  store: ReviewStore,
  budgetSec: number,
  now: number,
  catalog?: Catalog,
): ReviewSummary {
  const { daily, total, spent, capLeft } = budgetOf(store, budgetSec, now);
  const adm = admitToday(entries, store, budgetSec, now);
  const dueByKind = emptyKindRecord(() => 0);
  let due = 0;
  for (const e of entries) {
    if (e.availableAt > now) continue;
    due++;
    dueByKind[e.kind]++;
  }
  const today = [...adm.touched, ...adm.admitted];
  const dueTodaySec = secondsOf(today);
  const heldBackSec = secondsOf(adm.held);
  const fc = forecast(entries, now, 8, store);
  let free = 0;
  for (let k = 1; k <= 7; k++) free += Math.max(0, Math.max(0, budgetSec) - fc[k].seconds);
  let suspended = 0;
  for (const [id, c] of Object.entries(store.cards))
    if (c.suspended && (!catalog || catalog.has(id as CardId))) suspended++;
  const heldBack = adm.held.length;
  const wordsWaiting = adm.deferred.filter(isNewWord).length;
  return {
    now,
    tracked: entries.length,
    due,
    dueByKind,
    dueToday: today.length,
    dueTodaySec,
    minutesToday: dueTodaySec > 0 ? Math.max(1, Math.ceil(dueTodaySec / 60)) : 0,
    heldBack,
    heldBackSec,
    deferred: adm.deferred.length - wordsWaiting,
    wordsWaiting,
    newWordsLeft: heldBack > 0 ? 0 : newWordsLeft(store, now),
    backlogClears: heldBackSec <= free,
    reviewedToday: daily.ids.length,
    budgetSec: total,
    spentSec: spent,
    capLeftSec: capLeft,
    enrolLeft: heldBack > 0 ? 0 : Math.max(0, NEW_ENROL_PER_DAY - daily.enrolled),
    suspended,
    nextAt: nextAvailable(entries, now),
  };
}

export interface QueueOptions {
  sessionSec?: number; // default SESSION_SEC
  kinds?: readonly ReviewKind[];
  later?: ReadonlySet<CardId>; // skipped today: moved to the end of the order
  phenomenonOf?: (id: CardId) => string | undefined; // for the in-block phenomenon spread
}

/** One session (about SESSION_SEC, at least MIN_SESSION_ITEMS, at most MAX_SESSION_ITEMS), interleaved. */
export function buildReviewQueue(
  entries: readonly ReviewEntry[],
  store: ReviewStore,
  budgetSec: number,
  now: number,
  opts: QueueOptions = {},
): CardId[] {
  const sessionSec = opts.sessionSec ?? SESSION_SEC;
  const kinds = opts.kinds ? new Set(opts.kinds) : null;
  const list = kinds ? entries.filter((e) => kinds.has(e.kind)) : entries;
  const adm = admitToday(list, store, budgetSec, now, opts.later);
  const pool = sortDue([...adm.touched, ...adm.admitted], opts.later);

  const picked: ReviewEntry[] = [];
  let sec = 0;
  let lessons = 0;
  const take = (cands: readonly ReviewEntry[]) => {
    for (const e of cands) {
      if (picked.length >= MAX_SESSION_ITEMS) return;
      if (picked.length >= MIN_SESSION_ITEMS && sec >= sessionSec) return;
      if (e.kind === 'lesson' && lessons >= LESSON_PER_SESSION) continue;
      picked.push(e);
      sec += KIND_SECONDS[e.kind];
      if (e.kind === 'lesson') lessons++;
    }
  };
  take(pool);
  if (sec < sessionSec) {
    const soon = list
      // learning steps only: a never-graded card (a new word or catch-up seeded for tomorrow) waits for its day, the
      // new-word allowance and the budget
      .filter(
        (e) => e.state.interval === 0 && !isUngraded(e) && e.availableAt > now && e.availableAt <= now + LEARN_AHEAD_MS,
      )
      .sort((a, b) => a.state.due - b.state.due || byKindThenId(a, b));
    take(soon);
  }
  return interleaveByKind(picked, opts.phenomenonOf).map((e) => e.id);
}

/** Reorder a block so consecutive items differ in phenomenon when possible (greedy, otherwise stable). */
function spreadPhenomena<T extends { id: CardId }>(
  block: T[],
  phenomenonOf: (id: CardId) => string | undefined,
  prev: string | undefined,
): T[] {
  const rest = [...block];
  const out: T[] = [];
  let last = prev;
  while (rest.length) {
    let i = rest.findIndex((x) => {
      const p = phenomenonOf(x.id);
      return p === undefined || last === undefined || p !== last;
    });
    if (i < 0) i = 0;
    const [x] = rest.splice(i, 1);
    out.push(x);
    last = phenomenonOf(x.id);
  }
  return out;
}

/**
 * Tap kinds (pair, chunk, lesson) first, typing kinds (dict, media) after; in each group, blocks of up to
 * INTERLEAVE_BLOCK same-kind items rotating over kinds in order of first appearance.
 */
export function interleaveByKind<T extends { id: CardId; kind: ReviewKind }>(
  list: readonly T[],
  phenomenonOf?: (id: CardId) => string | undefined,
): T[] {
  const tap = new Set<ReviewKind>(TAP_KINDS);
  const out: T[] = [];
  for (const group of [list.filter((x) => tap.has(x.kind)), list.filter((x) => !tap.has(x.kind))]) {
    const queues = new Map<ReviewKind, T[]>();
    for (const x of group) {
      const q = queues.get(x.kind);
      if (q) q.push(x);
      else queues.set(x.kind, [x]);
    }
    while ([...queues.values()].some((q) => q.length)) {
      for (const q of queues.values()) {
        if (!q.length) continue;
        const block = q.splice(0, INTERLEAVE_BLOCK);
        const prev = out.length && phenomenonOf ? phenomenonOf(out[out.length - 1].id) : undefined;
        out.push(...(phenomenonOf ? spreadPhenomena(block, phenomenonOf, prev) : block));
      }
    }
  }
  return out;
}

/** Per kind: tracked / due now / learning (interval < MATURE_DAYS) / mature. Every kind key is present. */
export function kindCounts(entries: readonly ReviewEntry[], now: number): Record<ReviewKind, KindCount> {
  const out = emptyKindRecord<KindCount>(() => ({
    tracked: 0,
    due: 0,
    learning: 0,
    mature: 0,
  }));
  for (const e of entries) {
    const c = out[e.kind];
    c.tracked++;
    if (e.availableAt <= now) c.due++;
    if (e.state.interval >= MATURE_DAYS) c.mature++;
    else c.learning++;
  }
  return out;
}

/** Minutes a list of items takes: max(1, round(seconds / 60)). */
export function estimateMinutes(ids: readonly CardId[]): number {
  let s = 0;
  for (const id of ids) s += kindSeconds(id);
  return Math.max(1, Math.round(s / 60));
}

/** { ref: state } of one kind (catalog-filtered entries, so no orphans). */
export function statesByRef(entries: readonly ReviewEntry[], kind: ReviewKind): Record<string, CardState> {
  const out: Record<string, CardState> = {};
  for (const e of entries) if (e.kind === kind) out[e.ref] = e.state;
  return out;
}
