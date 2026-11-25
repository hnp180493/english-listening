// Who sounds like whom in "Thị trấn": every resident and the learner's character have their own Gemini voice, so the
// town trains the ear on several speakers instead of one. Voice names are Gemini prebuilt voices (GEMINI_VOICES
// in core/ai/defaults.ts). `accent` is added to the style prompt when the clip is made; `gender` picks a matching
// browser voice when a clip is missing.
//
// Changing a voice or accent changes the clip keys of every line that character says (core/audioKey): new clips must
// be generated (npm run audio:generate). What a line plays (text, mode, voice): storyLinePlayback in ./storyAudio.ts;
// docs/audio.md → Voices.

import type { StorySpeaker } from './story';

export interface CastVoice {
  /** Gemini prebuilt voice name. */
  voice: string;
  gender: 'female' | 'male';
  /** Short English accent note for the style prompt, e.g. 'light British accent'. Omitted = General American. */
  accent?: string;
}

/** Keyed by place id (the resident who lives there) and 'player'. */
export const CAST_VOICES: Readonly<Record<string, CastVoice>> = {
  player: { voice: 'Puck', gender: 'male' },
  square: { voice: 'Fenrir', gender: 'male' }, // Leo
  cafe: { voice: 'Aoede', gender: 'female' }, // Emma
  friend: { voice: 'Leda', gender: 'female' }, // Mia
  home: { voice: 'Gacrux', gender: 'female', accent: 'light British accent' }, // Grace
  shop: { voice: 'Charon', gender: 'male' }, // Ben
  office: { voice: 'Sulafat', gender: 'female' }, // Sarah (not Kore: Kore is the voice of the rest of the app)
  school: { voice: 'Iapetus', gender: 'male', accent: 'light British accent' }, // Daniel
  station: { voice: 'Algenib', gender: 'male' }, // Sam
  clinic: { voice: 'Despina', gender: 'female' }, // Kim
  cinema: { voice: 'Zephyr', gender: 'female' }, // Zoe
  phone: { voice: 'Orus', gender: 'male', accent: 'light Australian accent' }, // Max
  park: { voice: 'Laomedeia', gender: 'female' }, // Lily
  board: { voice: 'Umbriel', gender: 'male' }, // Tom
};

/** The learner's children: a small boy's and a small girl's voice (courtship scenes, the city's family outings). */
export const KID_VOICES: Readonly<Record<'boy' | 'girl', CastVoice>> = {
  boy: { voice: 'Achird', gender: 'male', accent: "small child's high, playful voice" },
  girl: { voice: 'Autonoe', gender: 'female', accent: "small child's high, playful voice" },
};

/** The voice of whoever says a line of an episode set at `placeId`. */
export function voiceOf(who: StorySpeaker, placeId: string): CastVoice {
  const key = who === 'you' ? 'player' : who === 'them' ? placeId : who;
  return CAST_VOICES[key] ?? CAST_VOICES.player;
}
