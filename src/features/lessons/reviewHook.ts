// Lessons → Ôn tập (docs/review-system.md §5): the review call a finished practice quiz makes, and the muted
// line QuizResult shows. Pure; imports specific core/review files, never the barrel (§11).

import { PASS_SCORE } from '../../core/lessons';
import { availableAt, MATURE_DAYS, type Grade } from '../../core/srs';
import { gradeLessonScore } from '../../core/review/grading';
import { makeCardId } from '../../core/review/ids';
import { formatDueVi } from '../../core/review/time';
import type { ApplyReason, CardId, ReviewCard } from '../../core/review/types';

export interface LessonReviewCall {
  id: CardId; // lesson:<lessonId>
  grade: Grade; // used when the card exists
  enrol: boolean;
  firstGrade: Grade; // used when the card is created
}

/**
 * A finished practice quiz (`questions` answered, `score` 0..1). A pass enrols the lesson with a first interval of
 * 1 day (`firstGrade` 'good'); an existing card is graded with `gradeLessonScore`. A failed retake of a lesson
 * completed earlier also enrols (graded as it went), so a completed lesson always has a card even when reconcile
 * did not create one. Null when the quiz had no questions.
 */
export function lessonReviewCall(
  lessonId: string,
  score: number,
  questions: number,
  wasCompleted = false,
): LessonReviewCall | null {
  if (!lessonId || !(questions > 0)) return null;
  const s = Number.isFinite(score) ? score : 0;
  const grade = gradeLessonScore(s);
  const passed = s >= PASS_SCORE;
  return {
    id: makeCardId('lesson', lessonId),
    grade,
    enrol: passed || wasCompleted,
    firstGrade: passed ? 'good' : grade,
  };
}

const SCHEDULED: ReadonlySet<ApplyReason> = new Set<ApplyReason>([
  'enrolled',
  'graded',
  'lapsed',
  'pulled-in',
  'skipped-not-due',
]);

/**
 * QuizResult line: "Bài này sẽ quay lại trong Ôn tập ngày mai.". A retired lesson card (interval >= MATURE_DAYS)
 * is no longer served, so it says so instead. Undefined when the lesson has no live card.
 */
export function lessonReviewNote(
  r: { reason: ApplyReason; current: ReviewCard | null } | null | undefined,
  now: number,
): string | undefined {
  if (!r || !SCHEDULED.has(r.reason) || !r.current || r.current.suspended) return undefined;
  if (r.current.interval >= MATURE_DAYS) return 'Bạn đã nhớ chắc bài này, Ôn tập sẽ không hỏi lại nữa.';
  return `Bài này sẽ quay lại trong Ôn tập ${formatDueVi(availableAt(r.current), now)}.`;
}
