// How a line of a city scene (./cityTypes CityScene) is said (docs/town.md §20, owner 2026-11-25: "nhân vật cũ vẫn
// xài giọng gemini, nhân vật mới có thể xài giọng trình duyệt"):
//  - somebody of the city, or somebody only heard: the BROWSER's voice, always (./sceneAudio sceneLinePlayback: never
//    a clip, never a paid request);
//  - a town resident up in the city: their own Gemini voice for the connected line, the same way a line of their own
//    episodes is said (the clip is in the inventory: core/audioInventory `cityScenes`; until the owner generates it
//    the browser's voice of their sex plays). Their careful version ("Rõ từng từ") is the written text read slowly,
//    which a browser voice does well: no clip is made for it, to keep the clips few.
// The one place the panel and the inventory get a city line's text and voice from.

import { dictationAudio } from '../../features/dictation/decodeCache';
import type { SpeakOptions } from '../tts';
import type { SceneLine } from './sceneTypes';
import { sceneLinePlayback, type SceneLinePlayback } from './sceneAudio';
import { CAST_VOICES, type CastVoice } from './voices';

/** The Gemini voice of a town resident (a place id), or null for anybody else. */
export function cityCastVoice(who: string): CastVoice | null {
  return who !== 'player' && Object.hasOwn(CAST_VOICES, who) ? CAST_VOICES[who] : null;
}

/** The connected text of a line (what the clip of a town resident's line says). */
export function cityLineText(line: Pick<SceneLine, 'text' | 'say'>, level: number): string {
  return dictationAudio({ text: line.text, level, ...(line.say ? { say: line.say } : {}) }).connected.trim();
}

/** What to pass to speak() for a line of a city scene: `speak(p.text, p.options)`. */
export function cityLinePlayback(line: Pick<SceneLine, 'who' | 'text' | 'say'>, level: number, careful = false): SceneLinePlayback {
  const voice = cityCastVoice(line.who);
  if (!voice || careful) return sceneLinePlayback(line, level, careful);
  const options: SpeakOptions = { mode: 'connected', voice };
  return { text: cityLineText(line, level), options };
}
