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
import { CAST_VOICES, voiceOf, type CastVoice } from './voices';
import { hasShippedClip, peekAudioManifest } from '../audioManifest';
import { audioKey } from '../audioKey';

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

/**
 * The voice a quick chat line of `placeId` is said in (owner, 2026-11-22: every resident their own voice, the street
 * talks too): the resident's own once that line's clip in their voice ships (npm run audio:generate), else null = the
 * app's voice, the same clip as Chép chính tả (so nothing falls back to the browser voice before the clips are made).
 */
export function quickChatVoice(placeId: string, line: Pick<StoryLine, 'text' | 'say'>): CastVoice | null {
  const voice = CAST_VOICES[placeId];
  const m = peekAudioManifest();
  if (!voice || !m) return null;
  return hasShippedClip(m, audioKey('connected', dictationAudio(line).connected.trim(), voice)) ? voice : null;
}
