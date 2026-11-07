// What a lesson quiz item's listen buttons and auto-play speak (pure, tested). See src/core/playback.ts.

import { decode } from '../../core/decoder';
import { CONNECTED_SLOW_RATE, connectedText, type SpeechMode } from '../../core/playback';
import type { QuizItem } from '../../data/lessonTypes';
import { isConnectedSpeechItem, itemAudio } from './logic';

/** Turtle rate of word/spelling items (single words: the careful reading IS the point). Same as Blocks' SLOW_RATE. */
export const WORD_SLOW_RATE = 0.6;

/** What a quiz item's listen buttons and auto-play speak. */
export interface QuizPlayback {
  text: string;
  /** 'connected' for connected-speech items; undefined for word/spelling items (default AI style). */
  mode?: SpeechMode;
  /** Rate of the slow (turtle) button. */
  slowRate: number;
}

/**
 * Connected-speech listening items (course 'connected') play the CONNECTED version (the item's `say`, else the
 * decoder's speakText): that is what the learner must decode. Their turtle is the same connected version, slower;
 * the careful word-by-word version would give the answer away, so it is offered only in the feedback after
 * answering. Other items (words, spelling) play their text as before.
 */
export function quizPlayback(item: QuizItem, course: string): QuizPlayback | null {
  const audio = itemAudio(item);
  if (!audio) return null;
  if (!isConnectedSpeechItem(item, course)) return { text: audio, slowRate: WORD_SLOW_RATE };
  const say = item.type === 'listen-choose' ? item.say : undefined;
  let decoded = null;
  if (!say) {
    try {
      decoded = decode(audio);
    } catch {
      decoded = null;
    }
  }
  return { text: connectedText(audio, decoded, say), mode: 'connected', slowRate: CONNECTED_SLOW_RATE };
}

