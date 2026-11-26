// Where clues are earned (docs/gta-plan.md §17, data/city/clues.ts): a scene heard through (the city's and the town's
// listening scenes call `heardScene`), Bay FM's bulletin (./radioStore radioHeard grants what it read), a job's step
// (features/town/jobs: its `clue`). All go through ./jobsStore grantClue.

import { cluesOfScene } from '../../data/city/clues';
import { grantClue } from './jobsStore';

/** A scene was heard through: the clues it gives are earned (the new ones are returned). */
export function heardScene(sceneId: string, now: number = Date.now()): string[] {
  return cluesOfScene(sceneId).filter((id) => grantClue(id, now));
}
