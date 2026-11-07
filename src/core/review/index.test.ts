// The barrel exposes everything the other groups rely on (docs/review-system.md §4.3).
import { describe, expect, it } from 'vitest';
import * as review from './index';
import type { CardId, DictationCheck, RecordResult, ReviewSnapshot } from './index';

const VALUES = [
  // HOOKS-A
  'useReview',
  'statesOfKind',
  'nextAvailable',
  'isDueToday',
  'availableAt',
  'formatDueVi',
  'recordReview',
  'resetCard',
  'gradeDictation',
  'makeCardId',
  'mediaRef',
  // HOOKS-B
  'enrolSeen',
  'gradePairSet',
  'gradeLessonScore',
  'PAIR_ENROL_ANSWERS',
  // UI
  'getReviewSnapshot',
  'buildReviewQueue',
  'reviewBudgetSec',
  'recordChunkReview',
  'unlockExtra',
  'suspendCard',
  'dismissSeedNotice',
  'lessonReviewItems',
  'summarize',
  'forecast',
  'estimateMinutes',
  'contextLineVi',
  'growthLineVi',
  'parseCardId',
  'parseMediaRef',
  'kindSeconds',
  'KIND_LABEL',
  'KIND_SHORT',
  'KIND_ROUTE',
  'KIND_SECONDS',
  'EXTRA_STEP_SEC',
  'SEED_PER_DAY',
  'PAIR_REVIEW_SIZE',
  'LESSON_REVIEW_SIZE',
  // SURFACES
  'kindCounts',
  'unsuspendAll',
  'REVIEW_MINUTES_OPTIONS',
  'DEFAULT_REVIEW_MINUTES',
  'REVIEW_KINDS',
  // word cards (§13)
  'WORD_NEW_PER_DAY',
  'isNewWord',
  'newWordsLeft',
  'gradeWordChoice',
  'lessonWordIds',
  'wordCardId',
  'wordIndex',
] as const;

describe('core/review barrel', () => {
  it('exports every value the other groups use', () => {
    const mod = review as unknown as Record<string, unknown>;
    for (const name of VALUES) expect(mod[name], name).toBeDefined();
  });

  it('exports the types the other groups use', () => {
    // Compile-time check: these would fail `tsc -b` if a type went missing.
    const id: CardId = 'dict:s001';
    const check: DictationCheck = {
      total: 1,
      matched: 1,
      extra: 0,
      hinted: false,
      revealed: false,
      firstTry: false,
      kind: 'dict',
    };
    const r: RecordResult | null = null;
    const s: ReviewSnapshot | null = null;
    expect([id, check.kind, r, s]).toEqual(['dict:s001', 'dict', null, null]);
  });

  it('KIND_* tables cover every kind', () => {
    for (const k of review.REVIEW_KINDS) {
      expect(review.KIND_LABEL[k]).toBeTruthy();
      expect(review.KIND_SHORT[k]).toBeTruthy();
      expect(review.KIND_ROUTE[k]).toBeTruthy();
      expect(review.KIND_SECONDS[k]).toBeGreaterThan(0);
    }
  });
});
