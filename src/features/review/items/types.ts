// Shared contract between ReviewPage and its item views.

import type { CardState, Grade } from '../../../core/srs';

/** What an item reports once it is graded (once per session position). */
export interface GradeOutcome {
  grade: Grade;
  correct: boolean;
  /** The card's state after this answer (null when nothing could be scheduled). */
  current: CardState | null;
}

export interface ItemBaseProps {
  /** This session position already has a result: further answers are practice only. */
  graded: boolean;
  /** State of the card before this answer (entry state, or the state after an earlier answer this session). */
  state: CardState | undefined;
  onGraded: (o: GradeOutcome) => void;
  onNext: () => void;
}
