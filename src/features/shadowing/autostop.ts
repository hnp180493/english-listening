// When to end a take by itself. Recognition runs in continuous mode (so a short pause
// mid-sentence does not cut the take); the take ends after a quiet spell instead, which is
// short once the learner has reached the end of the sentence and longer while they are still
// in the middle of it.

import { align } from '../../core/dictation/align';
import { splitWords } from '../../core/dictation/normalize';

/** True when the transcript already reaches the end of the target sentence. */
export function transcriptCoversTarget(targetRaw: readonly string[], transcript: string): boolean {
  const answer = splitWords(transcript);
  if (answer.length === 0) return false;
  const al = align(targetRaw, answer);
  const last = al.target.words.length - 1;
  if (last < 0) return true;
  if (al.answer.words.length >= al.target.words.length) return true;
  const lastOp = al.ops.find((o) => o.canonIndex === last);
  return !!lastOp && lastOp.kind !== 'del';
}

export const QUIET_MS = {
  finalComplete: 900,
  finalPartial: 2600,
  interimComplete: 1800,
  interimPartial: 3500,
} as const;

/** How long to wait for more speech after a recognition result before ending the take. */
export function quietDelayMs(isFinal: boolean, complete: boolean): number {
  if (isFinal) return complete ? QUIET_MS.finalComplete : QUIET_MS.finalPartial;
  return complete ? QUIET_MS.interimComplete : QUIET_MS.interimPartial;
}
