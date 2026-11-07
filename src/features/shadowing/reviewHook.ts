// Shadowing → Ôn tập (docs/review-system.md §5, D2): a weak take of a built-in sentence only enrols its
// dictation card (dict:<sentence id>); shadowing never grades. Pure.

import type { ShadowSource } from './sources';
import type { ShadowAttempt, ShadowState } from './store';

/** Below this score (auto score, or a self rating 'ok'/'bad') the sentence comes back in Ôn tập as dictation. */
export const WEAK_TAKE = 0.7;

/** True when this saved take should enrol the sentence's dictation card. Chunk and typed-in sources never do. */
export function shouldEnrolTake(
  source: Pick<ShadowSource, 'kind' | 'itemId'> | null | undefined,
  attempt: Pick<ShadowAttempt, 'score'> | null | undefined,
): boolean {
  if (!source || source.kind !== 'sentence' || !source.itemId || !attempt) return false;
  return typeof attempt.score === 'number' && Number.isFinite(attempt.score) && attempt.score < WEAK_TAKE;
}

/** The newest saved take of `itemId` in the state PracticePanel hands to onSaved. */
export function newestAttempt(state: ShadowState, itemId: string): ShadowAttempt | undefined {
  const item = Object.hasOwn(state, itemId) ? state[itemId] : undefined;
  return item?.attempts[item.attempts.length - 1];
}
