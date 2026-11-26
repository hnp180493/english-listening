// How a line of a "cảnh nghe" (./sceneTypes) is said: ALWAYS in the browser's voice, never a Gemini clip. The owner,
// 2026-11-25: "mấy phần này nghe cho vui nên không cần xài giọng gemini, bỏ ra đi khỏi tốn token tạo giọng". So no
// scene line is in the clip inventory (core/audioInventory), none is ever generated, and none makes a paid request.
// Each speaker still has a voice of their own among the browser's voices of their sex (tts.ts pickSpeakerVoice).
//
// Connected by default (anything shown decoded must sound decoded: core/playback.ts); the careful version only after
// the questions. A browser voice reads word by word and reduces little: these scenes are for following a talk, not
// the place to train the ear on connected speech (that is Chép chính tả and the residents' own episodes).

import { dictationAudio } from '../../features/dictation/decodeCache';
import { CAREFUL_RATE } from '../playback';
import { getSettings } from '../settings';
import type { SpeakOptions, SpeakVoice } from '../tts';
import { SCENE_VOICES, type SceneLine } from './sceneTypes';
import { CAST_VOICES } from './voices';

export interface SceneLinePlayback {
  text: string;
  options: SpeakOptions;
}

/**
 * The voice of whoever says a scene's line: a name of the scene's own (`scene-<who>`, no Gemini voice's name, so no
 * clip is ever looked up or made under it) and the speaker's sex, a resident's (./voices) or a heard-only speaker's
 * (SCENE_VOICES). Null for a speaker nobody knows (the learner's own voice then).
 */
export function sceneVoice(who: string): SpeakVoice | null {
  const gender = (Object.hasOwn(CAST_VOICES, who) ? CAST_VOICES[who] : undefined)?.gender ?? (Object.hasOwn(SCENE_VOICES, who) ? SCENE_VOICES[who] : undefined)?.gender;
  return gender ? { voice: `scene-${who}`, gender } : null;
}

/** What to pass to speak() for a line: `speak(p.text, p.options)`. `browserOnly` always. */
export function sceneLinePlayback(line: Pick<SceneLine, 'who' | 'text' | 'say'>, level: number, careful = false): SceneLinePlayback {
  const audio = dictationAudio({ text: line.text, level, ...(line.say ? { say: line.say } : {}) });
  const voice = sceneVoice(line.who);
  if (careful) return { text: audio.careful.trim(), options: { mode: 'careful', rate: CAREFUL_RATE, voice, browserOnly: true } };
  // a heard-only speaker's manner (Bay FM's callers): faster, quieter (the learner's own rate times theirs)
  const manner = Object.hasOwn(SCENE_VOICES, line.who) ? SCENE_VOICES[line.who] : undefined;
  const options: SpeakOptions = { mode: 'connected', voice, browserOnly: true };
  if (manner?.rate) options.rate = Math.min(1.6, (getSettings().rate || 1) * manner.rate);
  if (manner?.volume) options.volume = manner.volume;
  return { text: audio.connected.trim(), options };
}
