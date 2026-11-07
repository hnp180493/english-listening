// Pairs → Ôn tập (docs/review-system.md §5): which pair-set cards a finished round grades or enrols, and the
// muted line RoundResults shows. Pure; imports specific core/review files, never the barrel (§11).

import { availableAt, type Grade } from '../../core/srs';
import { PAIR_ENROL_ANSWERS } from '../../core/review/constants';
import { gradePairSet } from '../../core/review/grading';
import { makeCardId } from '../../core/review/ids';
import { formatDueVi } from '../../core/review/time';
import type { ApplyReason, CardId, ReviewCard } from '../../core/review/types';
import type { PairsProgress, RoundSummary } from './game';

export interface PairReviewCall {
  id: CardId; // pair:<setId>
  setId: string;
  grade: Grade;
  enrol: boolean;
  /** Every first answer right: a budgeted enrolment even when the grade is 'hard' (a 2-question round). */
  success: boolean;
}

/** First answers given to the items of one set so far (all rounds). */
export function setAnswerCount(progress: PairsProgress, items: readonly string[]): number {
  let n = 0;
  for (const id of items) n += progress.items[id]?.seen ?? 0;
  return n;
}

/**
 * One call per set played in the round (first answers only): the grade from `gradePairSet`, enrolled on a miss or
 * once the set has PAIR_ENROL_ANSWERS first answers (counted in `progressAfter`, which includes this round).
 * Sets missing from `setItems` (content gone) are skipped.
 */
export function pairSetReviewCalls(
  summary: Pick<RoundSummary, 'bySet'>,
  progressAfter: PairsProgress,
  setItems: Readonly<Record<string, readonly string[]>>,
): PairReviewCall[] {
  const out: PairReviewCall[] = [];
  const done = new Set<string>();
  for (const b of summary.bySet) {
    if (done.has(b.setId) || !Object.hasOwn(setItems, b.setId)) continue;
    done.add(b.setId);
    const grade = gradePairSet(b.correct, b.total);
    if (!grade) continue;
    const enrol = b.correct < b.total || setAnswerCount(progressAfter, setItems[b.setId]) >= PAIR_ENROL_ANSWERS;
    out.push({ id: makeCardId('pair', b.setId), setId: b.setId, grade, enrol, success: b.correct >= b.total });
  }
  return out;
}

const SCHEDULED: ReadonlySet<ApplyReason> = new Set<ApplyReason>([
  'enrolled',
  'graded',
  'lapsed',
  'pulled-in',
  'skipped-not-due',
]);

/** The card has a place in Ôn tập after this answer (not suspended, not declined). */
export function isScheduled(r: { reason: ApplyReason; current: ReviewCard | null }): r is {
  reason: ApplyReason;
  current: ReviewCard;
} {
  return SCHEDULED.has(r.reason) && !!r.current && !r.current.suspended;
}

/**
 * RoundResults line: "Bộ này sẽ quay lại trong Ôn tập ngày mai." for a single-set round, else
 * "{k} nhóm âm sẽ quay lại trong Ôn tập.". Undefined when no set is scheduled.
 */
export function pairsReviewNote(
  results: readonly { reason: ApplyReason; current: ReviewCard | null }[],
  singleSet: boolean,
  now: number,
): string | undefined {
  const scheduled = results.filter(isScheduled);
  if (scheduled.length === 0) return undefined;
  if (singleSet && scheduled.length === 1) {
    return `Bộ này sẽ quay lại trong Ôn tập ${formatDueVi(availableAt(scheduled[0].current), now)}.`;
  }
  return `${scheduled.length} nhóm âm sẽ quay lại trong Ôn tập.`;
}
