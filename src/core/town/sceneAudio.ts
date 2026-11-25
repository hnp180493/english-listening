// How a line of a "cảnh nghe" (./sceneTypes) is said: a resident in their own Gemini voice (./voices: a shipped clip
// once the owner generates them, the browser's voice of their sex until then), somebody only heard (SCENE_VOICES) in
// the browser's voice of their sex, always. Connected by default (anything shown decoded must sound decoded:
// core/playback.ts); the careful version only after the questions.

import { dictationAudio } from '../../features/dictation/decodeCache';
import { CAREFUL_RATE } from '../playback';
import type { SpeakOptions, SpeakVoice } from '../tts';
import { SCENE_VOICES, type SceneLine } from './sceneTypes';
import { CAST_VOICES } from './voices';

export interface SceneLinePlayback {
  text: string;
  options: SpeakOptions;
  /** A resident's line: its clip ships once generated (core/audioInventory). False: the browser's voice only. */
  ships: boolean;
}

/** The voice of whoever says a scene's line; null for a speaker nobody knows (the learner's own voice then). */
export function sceneVoice(who: string): { voice: SpeakVoice; ships: boolean } | null {
  const cast = Object.hasOwn(CAST_VOICES, who) ? CAST_VOICES[who] : undefined;
  if (cast) return { voice: cast, ships: true };
  const heard = Object.hasOwn(SCENE_VOICES, who) ? SCENE_VOICES[who] : undefined;
  // a name of its own (not a Gemini voice's): no clip is ever looked up or made under it, and the browser gives each
  // such speaker a voice of their own among those of their sex
  return heard ? { voice: { voice: `scene-${who}`, gender: heard.gender }, ships: false } : null;
}

/**
 * What to pass to speak() for a line: `speak(p.text, p.options)`. `browserOnly` always: a scene never makes a paid
 * request (shipped clips still play).
 */
export function sceneLinePlayback(line: Pick<SceneLine, 'who' | 'text' | 'say'>, level: number, careful = false): SceneLinePlayback {
  const audio = dictationAudio({ text: line.text, level, ...(line.say ? { say: line.say } : {}) });
  const v = sceneVoice(line.who);
  const voice = v?.voice ?? null;
  return careful
    ? { text: audio.careful.trim(), options: { mode: 'careful', rate: CAREFUL_RATE, voice, browserOnly: true }, ships: !!v?.ships }
    : { text: audio.connected.trim(), options: { mode: 'connected', voice, browserOnly: true }, ships: !!v?.ships };
}
