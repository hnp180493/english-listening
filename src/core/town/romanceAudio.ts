// What a line of "Hẹn hò, cưới, con" sends to the voice (docs/town.md §15): owner, 2026-11-22, "mỗi người nên một
// giọng vì đây là game mà, vẫn xài gemini đi". The one place the scene player (features/town/romance/StoryChat) and
// the audio inventory (core/audioInventory → scripts/generate-audio.mjs) get a line's text and voice from, so a
// generated clip is exactly the clip speak() looks up (audioKey(mode, text, voice)).
//
// - 'them': the one courted / the spouse, in their own voice (./voices CAST_VOICES);
// - 'you': the learner's character, a man's voice (Puck) or a woman's (PLAYER_FEMALE), by who they court;
// - 'kid': a child, a boy's or a girl's voice styled as a small child;
// - narration is not spoken.
// A name the learner chose ({name}, {kid}) cannot be in a shipped clip: a name called out at the start or the end of a
// line is left out of the audio (the text still shows it); a line that needs a name in the middle has no clip and the
// browser voice reads it.

import { suitorOf } from '../../data/romance';
import type { SpeechMode } from '../playback';
import type { ChatLine, PlayerGender } from './romanceTypes';
import { CAST_VOICES, KID_VOICES, type CastVoice } from './voices';

export { KID_VOICES };

/** The learner's character as a woman (a man is CAST_VOICES.player). */
export const PLAYER_FEMALE: CastVoice = { voice: 'Callirrhoe', gender: 'female' };

/** Who is in the scene: the one courted / the spouse (place id), and the child's sex in a child's scene. */
export interface SceneCast {
  placeId: string;
  kid?: 'boy' | 'girl';
}

/** The learner's character's sex in a scene with this resident (who courts them). */
export function playerGenderWith(placeId: string): PlayerGender {
  return suitorOf(placeId)?.courtedBy ?? 'male';
}

/** The voice of whoever says `who` in a scene with `cast`; null for narration. */
export function romanceVoice(who: ChatLine['who'], cast: SceneCast): CastVoice | null {
  if (who === 'narr') return null;
  if (who === 'them') return CAST_VOICES[cast.placeId] ?? CAST_VOICES.player;
  if (who === 'kid') return KID_VOICES[cast.kid ?? 'girl'];
  return playerGenderWith(cast.placeId) === 'female' ? PLAYER_FEMALE : CAST_VOICES.player;
}

/**
 * The English a clip says for `en`: a name called out at the start ("{name}, …") or the end ("…, {name}.") is left
 * out; null when a name is still needed (the line is read by the browser voice with the name filled in).
 */
export function romanceAudioText(en: string): string | null {
  let t = en.trim();
  // "…, {name}!" / "… {name}?" at the end
  t = t.replace(/,?\s*\{(name|kid)\}\s*([.!?…]*)\s*$/u, (_m, _w, p: string) => p || '.');
  // "{name}, …" / "{name}! …" at the start
  t = t.replace(/^\{(name|kid)\}\s*[,!.…]?\s*/u, '');
  // ", {name}," in the middle as a vocative
  t = t.replace(/,\s*\{(name|kid)\}\s*,/gu, ',');
  if (/\{(name|kid)\}/.test(t)) return null;
  t = t.trim();
  if (!/[\p{L}\p{N}]/u.test(t)) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** One playback of a scene line: speak(text, { mode, voice }). */
export interface RomancePlayback {
  /** What the clip says (a name left out); null: no clip can say it (read `fallback` with the browser voice). */
  clip: string | null;
  /** The line as shown, names filled in. */
  fallback: string;
  mode: SpeechMode;
  voice: CastVoice;
}

/** The playback of `line` in a scene with `cast` (`filled`: the line's English with the names filled in). */
export function romancePlayback(line: Pick<ChatLine, 'who' | 'en'>, cast: SceneCast, filled: string): RomancePlayback | null {
  const voice = romanceVoice(line.who, cast);
  if (!voice || !line.en) return null;
  return { clip: romanceAudioText(line.en), fallback: filled, mode: 'connected', voice };
}
