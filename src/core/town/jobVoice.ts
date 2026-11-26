// Who speaks a line of a Westbay job (core/town/job.ts, data/city/jobs): somebody of the city or a voice only heard
// (Bay FM's Marcus), ALWAYS in the browser's voice (owner, 2026-11-25: the city's people never have clips). A name of
// the job's own (`scene-<who>`: no Gemini voice's name, so no clip is ever looked up or made under it) and the
// speaker's sex, so each speaker keeps one browser voice of their sex (tts.ts pickSpeakerVoice), in the job and in
// Ôn tập alike.

import type { SpeakVoice } from '../tts';
import { cityPerson } from './cityPeople';
import { SCENE_VOICES } from './sceneTypes';

export function jobVoice(who: string): SpeakVoice | null {
  const gender = cityPerson(who)?.gender ?? (Object.hasOwn(SCENE_VOICES, who) ? SCENE_VOICES[who].gender : undefined);
  return gender ? { voice: `scene-${who}`, gender } : null;
}

/** The speaker's name as the panels show it. */
export function jobSpeakerName(who: string): string {
  return cityPerson(who)?.name ?? (Object.hasOwn(SCENE_VOICES, who) ? SCENE_VOICES[who].name : who);
}
