// "Nghe lại băng" in the hideout (docs/town.md §29): the review cards of the lines missed in Westbay's jobs (`talk:job-…`)
// and of the calls heard wrong at Rico's dispatch office (`talk:disp-…`), resolved to what to play and show, as Ôn tập
// resolves them (features/review/resolve.ts): the same speaker's voice (the browser's for Westbay's people), the same
// connected text.

import type { SpeakVoice } from '../../../core/tts';
import type { TapeCard } from '../../../core/town/hideout';
import { jobSpeakerName, jobVoice } from '../../../core/town/jobVoice';
import { DISPATCH_CALLER, DISPATCH_TITLE, dispatchCallByRef, dispatchVoice } from '../../../data/city/dispatch';
import { jobLineByRef } from '../../../data/city/jobs';

export interface TapeLine {
  ref: string;
  /** What was said (the English shown after listening) and its meaning. */
  text: string;
  vi: string;
  /** Authored connected spelling, when there is one. */
  say?: string;
  /** Who said it and where (a job's title, the dispatch office). */
  speaker: string;
  where: string;
  voice: SpeakVoice | null;
  /** The voice is a Westbay person's: the browser's, never a paid clip (as Ôn tập plays it). */
  browserOnly: boolean;
  added: number;
  due: number;
}

/** A card of the tape as a line to play; null when its content is gone (a job rewritten since). */
export function tapeLine(card: TapeCard): TapeLine | null {
  const job = jobLineByRef(card.ref);
  if (job) {
    const voice = jobVoice(job.line.who);
    if (!voice) return null;
    return { ref: card.ref, text: job.line.text, vi: job.line.vi, ...(job.line.say ? { say: job.line.say } : {}), speaker: jobSpeakerName(job.line.who), where: job.job.title, voice, browserOnly: true, added: card.added, due: card.due };
  }
  const call = dispatchCallByRef(card.ref);
  if (call) return { ref: card.ref, text: call.text, vi: call.vi, ...(call.say ? { say: call.say } : {}), speaker: DISPATCH_CALLER, where: DISPATCH_TITLE, voice: dispatchVoice(call), browserOnly: true, added: card.added, due: card.due };
  return null;
}

/** The tape's lines whose content is known, in the tape's order (newest first). */
export function tapeLines(cards: readonly TapeCard[]): TapeLine[] {
  return cards.map(tapeLine).filter((l): l is TapeLine => l !== null);
}
