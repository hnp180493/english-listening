// How a line of a city scene (./cityTypes CityScene) is said (docs/town.md §20, owner 2026-11-25: "nhân vật cũ vẫn
// xài giọng gemini, nhân vật mới có thể xài giọng trình duyệt"; asked again the same day, "vẫn đảm bảo rule … đúng
// không?", and the outings were found to break it, then fixed):
//  - somebody of the city, or somebody only heard: the BROWSER's voice, always (./sceneAudio sceneLinePlayback: never
//    a clip, never a paid request);
//  - a town resident up in the city: their own Gemini voice for the connected line, the same way a line of their own
//    episodes is said (the clip is in the inventory: core/audioInventory `cityScenes`; until the owner generates it
//    the browser's voice of their sex plays). Their careful version ("Rõ từng từ") is the written text read slowly,
//    which a browser voice does well: no clip is made for it, to keep the clips few;
//  - an outing's partner (a town resident, whoever the learner is with) and child: in their own Gemini voices too, as
//    in the courtship's scenes (./romanceAudio): the partner's line has a clip in the voice of every resident who can
//    be courted, the child's in both children's voices (core/audioInventory `cityOutings`).
// The city's get-togethers and festivals are NOT here: they are "cảnh nghe" (./sceneAudio), browser voice for
// everybody, as the town's own get-togethers (owner: "nghe cho vui … bỏ ra đi khỏi tốn token").
// The one place the panel and the inventory get a city line's text and voice from.

import { dictationAudio } from '../../features/dictation/decodeCache';
import type { SpeakOptions } from '../tts';
import { YOU, type SceneLine } from './sceneTypes';
import { sceneLinePlayback, type SceneLinePlayback } from './sceneAudio';
import { CAST_VOICES, KID_VOICES, type CastVoice } from './voices';

/** The Gemini voice of a town resident (a place id), or null for anybody else. */
export function cityCastVoice(who: string): CastVoice | null {
  return who !== 'player' && Object.hasOwn(CAST_VOICES, who) ? CAST_VOICES[who] : null;
}

/** The connected text of a line (what the clip of a town resident's line says). */
export function cityLineText(line: Pick<SceneLine, 'text' | 'say'>, level: number): string {
  return dictationAudio({ text: line.text, level, ...(line.say ? { say: line.say } : {}) }).connected.trim();
}

/** Who plays the roles of an outing (cityTypes OUTING_ROLES): the partner's place id, the child's sex. */
export interface OutingCast {
  partner?: string;
  kid?: 'boy' | 'girl';
  /** The learner's character's sex (their own lines, sceneTypes YOU). */
  you?: 'male' | 'female';
}

/** The Gemini voice of an outing's role, or null (nobody in that role). */
export function outingVoice(who: 'partner' | 'kid', cast: OutingCast): CastVoice | null {
  if (who === 'kid') return cast.kid ? KID_VOICES[cast.kid] : null;
  return cast.partner ? cityCastVoice(cast.partner) : null;
}

/** What to pass to speak() for a line of a city scene: `speak(p.text, p.options)`. */
export function cityLinePlayback(line: Pick<SceneLine, 'who' | 'text' | 'say'>, level: number, careful = false, cast: OutingCast = {}): SceneLinePlayback {
  // the learner's own line: the browser's voice of their character's sex, never a clip
  if (line.who === YOU) {
    const p = sceneLinePlayback(line, level, careful);
    return { text: p.text, options: { ...p.options, voice: { voice: 'scene-you', gender: cast.you ?? 'male' }, browserOnly: true } };
  }
  // the partner and the child of an outing: their own Gemini voice for "Nghe"; the careful version in the browser's
  // voice of their sex (as for every town resident in the city)
  if (line.who === 'partner' || line.who === 'kid') {
    const v = outingVoice(line.who, cast);
    if (v && !careful) return { text: cityLineText(line, level), options: { mode: 'connected', voice: v } };
    const p = sceneLinePlayback(line, level, careful);
    return { text: p.text, options: { ...p.options, voice: v ? { voice: `scene-${line.who}`, gender: v.gender } : null, browserOnly: true } };
  }
  const voice = cityCastVoice(line.who);
  if (!voice || careful) return sceneLinePlayback(line, level, careful);
  const options: SpeakOptions = { mode: 'connected', voice };
  return { text: cityLineText(line, level), options };
}
