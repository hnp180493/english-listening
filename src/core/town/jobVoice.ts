// Who speaks a line of a Westbay job (core/town/job.ts, data/city/jobs): somebody of the city or a voice only heard
// (Bay FM's Marcus), ALWAYS in the browser's voice (owner, 2026-11-25: the city's people never have clips). A name of
// the job's own (`scene-<who>`: no Gemini voice's name, so no clip is ever looked up or made under it) and the
// speaker's sex, so each speaker keeps one browser voice of their sex (tts.ts pickSpeakerVoice), in the job and in
// Ôn tập alike.

import type { SpeakVoice } from '../tts';
import { cityPerson } from './cityPeople';
import { SCENE_VOICES } from './sceneTypes';
import { CAST_VOICES } from './voices';
import { townPlace } from '../../data/town';
import { tl } from '../../i18n';

/**
 * The learner's own lines in a job (an answer by intent; docs/gta-story.md §1 "Giọng của người chơi"). Approved by the
 * owner on 2026-11-27 (docs/city.md §5: the learner speaks, in jobs and in every talk they begin): with
 * PLAYER_VOICE on, the learner's line is shown and said in a browser voice of their character's sex; off, it is shown
 * as text only. One switch for every job.
 */
export const PLAYER_VOICE = true;

export function jobVoice(who: string, playerGender: 'male' | 'female' = 'male'): SpeakVoice | null {
  if (who === 'player') return { voice: 'scene-player', gender: playerGender };
  // a town resident: their own Gemini voice (their clips; the browser's voice of their sex until they are generated)
  if (who !== 'player' && Object.hasOwn(CAST_VOICES, who)) return CAST_VOICES[who];
  const gender = cityPerson(who)?.gender ?? (Object.hasOwn(SCENE_VOICES, who) ? SCENE_VOICES[who].gender : undefined);
  return gender ? { voice: `scene-${who}`, gender } : null;
}

/** The real names of people a job does not name while it plays (the man in the grey coat is Lyle Penn). */
const REVEALED: Readonly<Record<string, string>> = { lyle: 'Lyle Penn' };

/**
 * Who said a line, once the job is over (the debrief, a review card, the hideout's tape): a forged line (JobLine `as`,
 * core/town/jobDoc.ts header) says who really said it: "Lyle Penn (nhại Rico)", or "Marcus (băng ghép)" for a tape cut
 * together. Without `as`, the speaker's name as ever.
 */
export function revealedName(line: { who: string; as?: string }): string {
  if (!line.as) return jobSpeakerName(line.who);
  if (line.as === 'splice') return tl`${jobSpeakerName(line.who)} (băng ghép)`;
  return tl`${REVEALED[line.as] ?? jobSpeakerName(line.as)} (nhại ${jobSpeakerName(line.who)})`;
}

/** The speaker's name as the panels show it. */
export function jobSpeakerName(who: string): string {
  if (who === 'player') return 'Bạn';
  const resident = townPlace(who)?.resident;
  if (resident) return resident;
  return cityPerson(who)?.name ?? (Object.hasOwn(SCENE_VOICES, who) ? SCENE_VOICES[who].name : who);
}
