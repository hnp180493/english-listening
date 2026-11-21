// What a hooked fish says, as the rest of the app plays that item (docs/town.md §10, AGENTS.md §6 Playback). Pure;
// useFishVoice plays it.
//
// - a chunk: its connected `ttsText`, mode 'connected', at the learner's rate (as Cụm từ);
// - one sentence of a minimal pair: the sentence mode-less (as Phân biệt âm);
// - a dictation sentence: `dictationAudio(line).connected`, mode 'connected', at the dictation rate (as a town
//   conversation and Chép chính tả).
// Every one is a shipped clip. 'careful' ("Rõ từng từ") is offered only after the answer, and only where the app has a
// careful version: a chunk (citationText of the written words, as Cụm từ) and a dictation sentence. A minimal pair is
// already the written words.

import { CAREFUL_RATE } from '../../../../core/playback';
import type { FishItem } from '../../../../core/town/fishing';
import { dictationAudio } from '../../../dictation/decodeCache';
import { playbackFor } from '../../../dictation/usePlayer';
import { citationText } from '../../../drill/match';

export type FishPlay = 'main' | 'careful';

export interface FishPlan {
  text: string;
  /** undefined = the learner's rate (speak reads Settings). */
  rate?: number;
  mode?: 'connected' | 'careful';
}

export function fishPlans(item: FishItem, baseRate: number): { main: FishPlan; careful: FishPlan | null } {
  if (item.play.kind === 'line') {
    const audio = dictationAudio(item.play.line);
    const n = playbackFor('normal', audio, baseRate);
    const c = playbackFor('careful', audio, baseRate);
    return { main: { text: n.text, rate: n.rate, mode: 'connected' }, careful: { text: c.text, rate: c.rate, mode: 'careful' } };
  }
  const main: FishPlan = { text: item.play.text, mode: item.play.mode };
  if (item.kind === 'chunk') return { main, careful: { text: citationText(item.reveal.text), rate: CAREFUL_RATE, mode: 'careful' } };
  return { main, careful: null };
}
