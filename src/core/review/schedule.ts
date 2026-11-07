// Scheduling rules of the review layer (docs/review-system.md §3.4). Pure: every function takes `now`.

import {
  DAY,
  HARD_LEARNING_MS,
  isDueToday,
  MATURE_DAYS,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  newCard,
  RELEARN_MS,
} from '../srs';
import type { CardState, Grade } from '../srs';
import { AUTO_HARD_MIN_EASE, BUDGETED_KINDS, LAPSE_KEEP, PRACTICE_STEP_MS, RECOVER_MULT } from './constants';
import { parseCardId } from './ids';
import { localDay, localDayDiff, nextLocalMidnight, startOfLocalDay } from './time';
import type { ApplyResult, CardId, ReviewCard, ReviewContext, ReviewKind, StoredKind } from './types';

const roundEase = (e: number) => Math.round(e * 100) / 100;
const clampDays = (d: number) => Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(d)));

function isGraduated(card: CardState): boolean {
  return card.reps > 0 && card.interval >= 1;
}

/** SM-2 variant for auto-graded kinds. Pure; the input is not mutated. Never used for chunks. */
export function gradeAuto(card: CardState, g: Grade, now: number): CardState {
  const day = (n: number) => startOfLocalDay(now, n);

  if (!isGraduated(card)) {
    switch (g) {
      case 'again':
        return {
          ...card,
          interval: 0,
          reps: 0,
          due: now + RELEARN_MS,
          lastGrade: g,
        };
      case 'hard':
        if (card.lastGrade === undefined)
          return {
            ...card,
            interval: 0,
            due: now + HARD_LEARNING_MS,
            lastGrade: g,
          };
        return { ...card, interval: 1, reps: 1, due: day(1), lastGrade: g };
      case 'good':
        return { ...card, interval: 1, reps: 1, due: day(1), lastGrade: g };
      case 'easy':
        return {
          ...card,
          interval: 4,
          reps: 1,
          ease: roundEase(card.ease + 0.15),
          due: day(4),
          lastGrade: g,
        };
    }
  }

  const overdue = Math.max(0, localDayDiff(card.due, now));
  const goodDays = (): number => {
    if (card.reps === 1 && card.interval < 3) return 3;
    if (card.lastGrade === 'again') return clampDays(Math.max(card.interval + 1, card.interval * RECOVER_MULT));
    return clampDays(Math.max(card.interval + 1, (card.interval + overdue / 2) * card.ease));
  };

  switch (g) {
    case 'again': {
      const interval = Math.max(1, Math.round(card.interval * LAPSE_KEEP));
      return {
        ...card,
        interval,
        reps: 1,
        lapses: card.lapses + 1,
        ease: roundEase(Math.max(MIN_EASE, card.ease - 0.15)),
        due: day(1),
        lastGrade: g,
      };
    }
    case 'hard': {
      const interval = clampDays(Math.max(card.interval + 1, Math.round(card.interval * 1.2)));
      const ease = card.ease > AUTO_HARD_MIN_EASE ? Math.max(AUTO_HARD_MIN_EASE, card.ease - 0.05) : card.ease;
      return {
        ...card,
        interval,
        reps: card.reps + 1,
        ease: roundEase(ease),
        due: day(interval),
        lastGrade: g,
      };
    }
    case 'good': {
      const interval = goodDays();
      return {
        ...card,
        interval,
        reps: card.reps + 1,
        due: day(interval),
        lastGrade: g,
      };
    }
    case 'easy': {
      const G = goodDays();
      const interval = clampDays(Math.max(G + 1, G * 1.3));
      return {
        ...card,
        interval,
        reps: card.reps + 1,
        ease: roundEase(card.ease + 0.15),
        due: day(interval),
        lastGrade: g,
      };
    }
  }
}

/** max(now, prev.last + 1): a new write always beats the version it was built on, even with a skewed clock. */
export function nextLast(prev: { last?: number } | undefined, now: number): number {
  const p = prev?.last;
  return Math.max(now, (typeof p === 'number' && Number.isFinite(p) ? p : 0) + 1);
}

/**
 * When the learner last met the item, or undefined when unknown: `seenAt`, else `last` (cards written before
 * `seenAt` existed). A time more than a day ahead of `now` came from a device with a fast clock: unknown.
 */
export function seenTime(c: { seenAt?: number; last?: number }, now: number): number | undefined {
  const t = c.seenAt ?? c.last;
  return typeof t === 'number' && Number.isFinite(t) && t > 0 && t <= now + DAY ? t : undefined;
}

/** The learner met the item today (budget-exempt in Ôn tập). */
export function seenToday(c: { seenAt?: number; last?: number }, now: number): boolean {
  const t = seenTime(c, now);
  return t !== undefined && localDay(Math.min(t, now)) === localDay(now);
}

/** `seenAt` to carry over on a write that is not a meeting (suspend, reset): frozen from `last` on older cards. */
function keptSeen(prev: ReviewCard): { seenAt?: number } {
  const t = prev.seenAt ?? prev.last;
  return typeof t === 'number' && Number.isFinite(t) && t >= 0 ? { seenAt: t } : {};
}

/** Due now (calendar day), never graded (reconciled), or a retired lesson. */
export function isEffectivelyDue(prev: ReviewCard, kind: ReviewKind, now: number): boolean {
  return isDueToday(prev, now) || prev.lastGrade === undefined || (kind === 'lesson' && prev.interval >= MATURE_DAYS);
}

export interface ApplyOptions {
  ctx: ReviewContext;
  enrol: boolean; // create the card when absent
  firstGrade?: Grade; // grade used when the card is created (default: the given grade)
  enrolLeft: number; // remaining new-card budget (api passes summary.enrolLeft)
  /** The answer had no miss although its grade is below 'good' (a perfect 2-question pair set): budgeted. */
  success?: boolean;
  now: number;
}

const isSuccess = (g: Grade) => g === 'good' || g === 'easy';

function result(
  card: ReviewCard | null,
  prev: ReviewCard | undefined,
  reason: ApplyResult['reason'],
  budgeted = false,
): ApplyResult {
  return { card, current: card ?? prev ?? null, reason, budgeted };
}

/** Grade one answer on a stored kind. See the decision table in docs/review-system.md §3.4. */
export function applyReview(prev: ReviewCard | undefined, id: CardId, g: Grade, o: ApplyOptions): ApplyResult {
  const parsed = parseCardId(id);
  if (!parsed || parsed.kind === 'chunk') return result(null, prev, 'not-enrolled');
  const kind = parsed.kind as StoredKind;
  const { now, ctx } = o;

  const finish = (c: CardState): ReviewCard => {
    let due = c.due;
    if (ctx === 'practice' && c.interval === 0) due = Math.max(due, now + PRACTICE_STEP_MS);
    if (kind === 'lesson' && c.interval === 0) due = Math.max(due, nextLocalMidnight(now));
    const out: ReviewCard = {
      ...c,
      id,
      due,
      last: nextLast(prev, now),
      seenAt: now,
    };
    return out;
  };

  if (!prev) {
    if (!o.enrol) return result(null, prev, 'not-enrolled');
    const g0 = o.firstGrade ?? g;
    const budgeted = (isSuccess(g0) || o.success === true) && BUDGETED_KINDS.includes(kind);
    if (budgeted && o.enrolLeft <= 0) return result(null, prev, 'over-budget');
    const fresh: ReviewCard = { ...newCard(id, now), last: 0, born: now };
    return result(finish(gradeAuto(fresh, g0, now)), prev, 'enrolled', budgeted);
  }

  if (prev.suspended) return result(null, prev, 'suspended');

  const due = isEffectivelyDue(prev, kind, now);
  const learning = prev.interval === 0;
  if ((ctx === 'review' && (due || learning)) || (ctx === 'practice' && due)) {
    const lapse = g === 'again' && isGraduated(prev);
    return result(finish(gradeAuto(prev, g, now)), prev, lapse ? 'lapsed' : 'graded');
  }

  // Not due: only a miss counts, and it only pulls the due date in (no lapse, no growth).
  if (g === 'again') {
    const pulled = Math.min(prev.due, nextLocalMidnight(now));
    if (pulled < prev.due) return result(finish({ ...prev, due: pulled, lastGrade: 'again' }), prev, 'pulled-in');
    return result(null, prev, 'pulled-in');
  }
  return result(null, prev, 'skipped-not-due');
}

/** A card for an item practised badly outside grading (shadowing): never graded, available tomorrow. */
export function enrolSeenCard(prev: ReviewCard | undefined, id: CardId, now: number): ReviewCard | null {
  if (prev) return null;
  return {
    ...newCard(id, now),
    due: nextLocalMidnight(now),
    last: now,
    born: now,
    seenAt: now,
  };
}

/**
 * Back to a fresh card (custom sentence words changed). Clears `suspended`. Same lineage (`born`): the reset is a
 * later version of this card, so the later `last` wins the sync merge.
 */
export function resetCardState(prev: ReviewCard | undefined, id: CardId, now: number): ReviewCard | null {
  if (!prev) return null;
  const card: ReviewCard = {
    ...newCard(id, now),
    due: nextLocalMidnight(now),
    last: nextLast(prev, now),
    ...keptSeen(prev),
  };
  if (prev.born !== undefined) card.born = prev.born;
  return card;
}

/**
 * Suspend (on) or resume (off) a card; null when absent or already in that state. `last` moves (the merge needs
 * it) but `seenAt` does not: toggling is not meeting the item, so it never makes a card "touched today".
 */
export function suspendCardState(prev: ReviewCard | undefined, on: boolean, now: number): ReviewCard | null {
  if (!prev || !!prev.suspended === on) return null;
  const last = nextLast(prev, now);
  if (on) return { ...prev, suspended: true, last, ...keptSeen(prev) };
  const rest: ReviewCard = { ...prev, last, ...keptSeen(prev) };
  delete rest.suspended;
  return rest;
}
