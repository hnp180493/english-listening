// Idempotent enrolment of existing practice history (docs/review-system.md §3.7). Pure.
// Every record the hooks would always enrol (failures, lessons) gets a card here when it has none:
// history from before the review layer, from another device, or from an older build.

import { needsReview } from '../dictation/modes';
import type { ProgressMap } from '../dictation/progress';
import { PASS_SCORE, type LessonProgress } from '../lessons';
import { availableAt, START_EASE } from '../srs';
import { isWeak, type PairsProgress } from '../../features/pairs/game';
import { PAIR_ENROL_ANSWERS, SEED_PER_DAY } from './constants';
import { makeCardId, mediaRef } from './ids';
import { localDayDiff, startOfLocalDay } from './time';
import type { CardId, ReviewCard } from './types';

export interface ReconcileInput {
  dictation: ProgressMap; // core/dictation/progress.sanitizeProgress
  sentenceIds: ReadonlySet<string>; // built-in ids + custom ids that exist now
  pairs: PairsProgress; // features/pairs/game.sanitizeProgress
  pairSets: Readonly<Record<string, readonly string[]>>; // data/pairIndex PAIR_SET_ITEMS
  lessons: LessonProgress; // core/lessons.loadLessonProgress()
  lessonIds: ReadonlySet<string>; // LESSONS with quiz.length > 0
  media: {
    itemId: string;
    unitCount: number;
    scores: Record<number, number>;
  }[]; // saved (not session-only) items
  shadowWeak: { id: string; best: number }[]; // shadowing history ids that are built-in sentence ids
  /** Lesson id → its word card ids (core/review/words lessonWordMap). Absent → no word cards. */
  lessonWords?: Readonly<Record<string, readonly CardId[]>>;
}

export interface ReconcileOptions {
  since: number;
  now: number;
  exclude?: CardId;
}

export interface ReconcileResult {
  cards: Record<string, ReviewCard>; // only new or re-spread cards
  created: number; // every new card, word cards included
  words: number; // of which word cards
  moved: number;
}

type TemplateName = 'WEAK' | 'LEARNED1' | 'NEW' | 'KNOWN' | 'STRONG' | 'WORD';

interface Template {
  interval: number;
  reps: number;
  bucket: number;
  minDay: number;
}

export const TEMPLATES: Readonly<Record<TemplateName, Template>> = {
  WEAK: { interval: 0, reps: 0, bucket: 0, minDay: 0 },
  LEARNED1: { interval: 1, reps: 1, bucket: 1, minDay: 0 },
  NEW: { interval: 0, reps: 0, bucket: 2, minDay: 1 },
  KNOWN: { interval: 3, reps: 1, bucket: 3, minDay: 1 },
  STRONG: { interval: 7, reps: 2, bucket: 4, minDay: 2 },
  /** A word of a passed lesson: new, never answered. From tomorrow when the lesson was passed today. */
  WORD: { interval: 0, reps: 0, bucket: 2, minDay: 0 },
};

interface Candidate {
  id: CardId;
  t: Template;
  lastAt: number;
  minDay?: number; // overrides t.minDay
  rank?: number; // tie-break after lastAt (teaching order of words)
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Never graded, never touched by the learner: a reconciled card (it may be re-spread). */
export function isSeeded(c: ReviewCard): boolean {
  return c.last === 0 && c.lastGrade === undefined && !c.suspended;
}

const isWordId = (id: string) => id.startsWith('word:');

/**
 * A seeded word card is paced by the queue (WORD_NEW_PER_DAY new words a day), not by the seeding load: it never
 * counts against SEED_PER_DAY and is never re-spread, so waiting words cannot push other catch-up (or the words of a
 * lesson passed later) weeks ahead.
 */
const isSeededLoad = (c: ReviewCard) => isSeeded(c) && !isWordId(c.id);

function candidates(input: ReconcileInput, since: number, now: number): Candidate[] {
  const out: Candidate[] = [];
  const add = (id: CardId, name: TemplateName, lastAt: number) => out.push({ id, t: TEMPLATES[name], lastAt });

  for (const [sid, p] of Object.entries(input.dictation)) {
    if (!p || !(p.attempts > 0) || !input.sentenceIds.has(sid)) continue;
    const id = makeCardId('dict', sid);
    const lastAt = finite(p.lastAt) ? p.lastAt : 0;
    if (needsReview(p)) add(id, 'WEAK', lastAt);
    else if (lastAt < since)
      add(id, p.best === 1 && p.attempts === 1 && !((p.hints ?? 0) > 0) ? 'STRONG' : 'KNOWN', lastAt);
  }

  for (const [setId, itemIds] of Object.entries(input.pairSets)) {
    const stats = itemIds.map((i) => input.pairs.items[i]).filter((s) => !!s && s.seen > 0);
    if (stats.length === 0) continue;
    const id = makeCardId('pair', setId);
    const lastAt = Math.max(0, ...stats.map((s) => s.lastAt));
    const sumSeen = stats.reduce((n, s) => n + s.seen, 0);
    if (stats.some((s) => isWeak(s))) add(id, 'WEAK', lastAt);
    else if (stats.some((s) => s.correct < s.seen)) add(id, 'KNOWN', lastAt);
    else if (sumSeen >= PAIR_ENROL_ANSWERS && lastAt < since) {
      const strong = stats.every((s) => s.streak >= 3) && stats.length * 2 >= itemIds.length;
      add(id, strong ? 'STRONG' : 'KNOWN', lastAt);
    }
  }

  for (const [lid, r] of Object.entries(input.lessons)) {
    if (!r || !(r.completedAt > 0) || !input.lessonIds.has(lid)) continue;
    const id = makeCardId('lesson', lid);
    if (r.bestScore >= 0.9) add(id, 'KNOWN', r.completedAt);
    else if (r.bestScore >= PASS_SCORE) add(id, 'LEARNED1', r.completedAt);
  }

  for (const m of input.media) {
    for (const [k, score] of Object.entries(m.scores)) {
      const unit = Number(k);
      if (!Number.isInteger(unit) || unit < 0 || unit >= m.unitCount || !finite(score) || score >= 1) continue;
      add(makeCardId('media', mediaRef(m.itemId, unit)), 'WEAK', 0);
    }
  }

  for (const s of input.shadowWeak) {
    if (!finite(s.best) || s.best >= 0.7 || !input.sentenceIds.has(s.id)) continue;
    if (input.dictation[s.id]) continue;
    add(makeCardId('dict', s.id), 'NEW', 0);
  }
  out.push(...wordCandidates(input.lessons, input.lessonWords, now));
  return out;
}

/** Word cards of passed lessons (`only`: of that lesson alone). Every word of a passed lesson always gets one. */
function wordCandidates(
  lessons: LessonProgress,
  lessonWords: Readonly<Record<string, readonly CardId[]>> | undefined,
  now: number,
  only?: string,
): Candidate[] {
  const out: Candidate[] = [];
  if (!lessonWords) return out;
  for (const [lid, ids] of Object.entries(lessonWords)) {
    if (only !== undefined && lid !== only) continue;
    const r = lessons[lid];
    if (!r || !(r.completedAt > 0) || !Array.isArray(ids)) continue;
    // passed today: the quiz just practised them, the first review is tomorrow
    const minDay = localDayDiff(r.completedAt, now) <= 0 ? 1 : 0;
    ids.forEach((id, i) =>
      out.push({
        id,
        t: TEMPLATES.WORD,
        lastAt: r.completedAt,
        minDay,
        rank: i,
      }),
    );
  }
  return out;
}

/**
 * Cards for history that should have one and does not, spread at most SEED_PER_DAY per day (word cards: on their
 * first day, paced by the queue instead).
 */
export function reconcileCards(
  input: ReconcileInput,
  existing: Readonly<Record<string, ReviewCard>>,
  o: ReconcileOptions,
): ReconcileResult {
  return place(candidates(input, o.since, o.now), existing, o.now, o.exclude, true);
}

/**
 * Word cards of one just-passed lesson (`lessonId`), or of every passed lesson, placed like reconcile does, without
 * re-spreading anything. Used right after a lesson pass, so the words are in the schedule before the next page load.
 */
export function reconcileWordCards(
  input: Pick<ReconcileInput, 'lessons' | 'lessonWords'>,
  existing: Readonly<Record<string, ReviewCard>>,
  o: { now: number; lessonId?: string; exclude?: CardId },
): ReconcileResult {
  return place(wordCandidates(input.lessons, input.lessonWords, o.now, o.lessonId), existing, o.now, o.exclude, false);
}

function place(
  cands: readonly Candidate[],
  existing: Readonly<Record<string, ReviewCard>>,
  now: number,
  exclude: CardId | undefined,
  respread: boolean,
): ReconcileResult {
  const cards: Record<string, ReviewCard> = {};
  let moved = 0;

  // 1. Today's and later loads of seeded cards (overdue → day 0).
  const byDay = new Map<number, ReviewCard[]>();
  for (const c of Object.values(existing)) {
    if (!isSeededLoad(c)) continue;
    const d = Math.max(0, localDayDiff(now, availableAt(c)));
    const list = byDay.get(d);
    if (list) list.push(c);
    else byDay.set(d, [c]);
  }
  const load = new Map<number, number>();
  for (const [d, list] of byDay) load.set(d, list.length);
  const loadOf = (d: number) => load.get(d) ?? 0;
  const firstFree = (from: number) => {
    let d = from;
    while (loadOf(d) >= SEED_PER_DAY) d++;
    return d;
  };

  // 2. Re-spread piles (cards merged in from other devices).
  if (respread) {
    for (const d of [...byDay.keys()].sort((a, b) => a - b)) {
      const list = byDay.get(d) ?? [];
      if (list.length <= SEED_PER_DAY) continue;
      const sorted = [...list].sort((a, b) => b.interval - a.interval || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
      for (const c of sorted.slice(0, list.length - SEED_PER_DAY)) {
        const to = firstFree(d + 1);
        load.set(d, loadOf(d) - 1);
        load.set(to, loadOf(to) + 1);
        cards[c.id] = { ...c, due: startOfLocalDay(now, to) };
        moved++;
      }
    }
  }

  // 3. New candidates, weakest and oldest first. Word cards start on their first day (today, or tomorrow for a lesson
  //    passed today) whatever the load: the queue admits WORD_NEW_PER_DAY new words a day, newest lessons first and
  //    in teaching order (queue.ts sortDue), so they need no spreading here.
  const seen = new Set<string>();
  const list = cands.filter((c) => {
    if (seen.has(c.id) || c.id === exclude || Object.prototype.hasOwnProperty.call(existing, c.id)) return false;
    seen.add(c.id);
    return true;
  });
  list.sort(
    (a, b) =>
      a.t.bucket - b.t.bucket ||
      a.lastAt - b.lastAt ||
      (a.rank ?? 0) - (b.rank ?? 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  let words = 0;
  for (const c of list) {
    const word = isWordId(c.id);
    const d = word ? (c.minDay ?? c.t.minDay) : firstFree(c.minDay ?? c.t.minDay);
    if (word) words++;
    else load.set(d, loadOf(d) + 1);
    cards[c.id] = {
      id: c.id,
      due: d === 0 ? now : startOfLocalDay(now, d),
      interval: c.t.interval,
      ease: START_EASE,
      reps: c.t.reps,
      lapses: 0,
      last: 0,
      born: now,
    };
  }
  return { cards, created: list.length, words, moved };
}
