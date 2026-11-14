// What a line of "Chuyện ở thị trấn" sends to the voice: the one place the town UI (Thị trấn) and the audio inventory
// (core/audioInventory → scripts/generate-audio.mjs) get the text, mode and voice of a story line from, so the clip
// the generator makes is exactly the clip speak() looks up (audioKey(mode, text, voice), docs/audio.md).
//
//  - 'connected' (the line as people really say it, the main playback): the same text dictation plays for a sentence
//    (dictationAudio: the authored `say`, else the decoder's speakText, else the written text);
//  - 'careful' ("Rõ từng từ"): the written text, at CAREFUL_RATE.
// The voice is the speaker's (voiceOf(line.who, episode.placeId)).

import { CAREFUL_RATE, type SpeechMode } from '../playback';
import { dictationAudio } from '../../features/dictation/decodeCache';
import type { StoryEpisode, StoryLine } from './story';
import { voiceOf, type CastVoice } from './voices';

/** One playback of a story line: speak(text, { mode, rate, voice }). `rate` undefined = the learner's rate. */
export interface StoryLinePlayback {
  text: string;
  mode: SpeechMode;
  rate?: number;
  voice: CastVoice;
}

/** The playback of `line` (said in `episode`) in `mode`: pass it straight to speak(p.text, { mode: p.mode, rate: p.rate, voice: p.voice }). */
export function storyLinePlayback(line: Pick<StoryLine, 'text' | 'who' | 'say'>, episode: Pick<StoryEpisode, 'placeId'>, mode: SpeechMode): StoryLinePlayback {
  const voice = voiceOf(line.who, episode.placeId);
  const audio = dictationAudio(line);
  return mode === 'careful' ? { text: audio.careful.trim(), mode, rate: CAREFUL_RATE, voice } : { text: audio.connected.trim(), mode, voice };
}
