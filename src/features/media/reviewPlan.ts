// Spaced review of video transcript lines (docs/review-system.md §5, media row). Pure. Imports specific
// core/review files, never the barrel (§11).

import { gradeDictation } from '../../core/review/grading';
import type { Grade } from '../../core/srs';

/** The parts of a DictationPanel check the review grade needs (CheckOutcome). */
export interface MediaReviewCheck {
  retry: boolean;
  hinted: boolean;
  total?: number;
  matched?: number;
  extra?: number;
  revealed?: boolean;
}

/**
 * How one checked transcript line is graded, or null when it is not: a retry ("Thử lại câu này") is practice
 * only, an item that only lives in memory (session-only) has no stable id to come back to, and a check without
 * word counts cannot be graded. `enrol`: only imperfect lines enter Ôn tập (a perfect line still grades an
 * existing card), so a whole video cannot flood the queue.
 */
export function mediaReviewPlan(o: MediaReviewCheck, sessionOnly: boolean): { grade: Grade; enrol: boolean } | null {
  if (o.retry || sessionOnly || typeof o.total !== 'number') return null;
  const grade = gradeDictation({
    total: o.total,
    matched: o.matched ?? 0,
    extra: o.extra ?? 0,
    hinted: o.hinted,
    revealed: !!o.revealed,
    firstTry: false,
    kind: 'media',
  });
  return { grade, enrol: grade !== 'good' && grade !== 'easy' };
}

/** The `unit` route param of #/media (a transcript line index, e.g. from "Mở video" in Ôn tập), else undefined. */
export function parseUnitParam(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || !/^\d{1,6}$/.test(raw)) return undefined;
  return Number(raw);
}
