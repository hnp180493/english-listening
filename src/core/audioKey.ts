// Stable key for a pre-generated (shipped) audio clip.
//
// Shared by the playback router (tts.ts) and the inventory/generator
// (audioInventory.ts + scripts). Changing anything here changes every key,
// which means every shipped clip must be regenerated — bump
// AUDIO_STYLE_VERSION deliberately (e.g. when the Gemini style prompt
// changes), never by accident.

export const AUDIO_VOICE = 'gemini-kore'
export const AUDIO_STYLE_VERSION = 3

/**
 * 'connected' / 'careful': the playback modes of src/core/playback.ts. 'plain': a playback without a mode (single
 * words, minimal pairs, story words, the as-written courses), spoken in the AI layer's default style. Adding a mode
 * changes no existing key (the mode is part of the hashed string).
 */
export type AudioClipMode = 'connected' | 'careful' | 'plain'

const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK_64 = 0xffffffffffffffffn

const encoder = new TextEncoder()

/** FNV-1a 64-bit over UTF-8 bytes, rendered base36 (≤ 13 chars). */
export function fnv1a64(input: string): string {
  let h = FNV_OFFSET
  for (const byte of encoder.encode(input)) {
    h ^= BigInt(byte)
    h = (h * FNV_PRIME) & MASK_64
  }
  return h.toString(36)
}

/** Gemini prebuilt voice of every clip without a voice of its own (AUDIO_VOICE = `gemini-${lowercase}`). */
export const DEFAULT_CLIP_VOICE = 'Kore'

/**
 * Who speaks a clip: a Gemini prebuilt voice name and an optional accent note for the style prompt ("Thị trấn"
 * residents, src/core/town/voices.ts CastVoice fits this shape). Omitted = DEFAULT_CLIP_VOICE, no accent.
 */
export interface ClipVoice {
  voice: string
  accent?: string
}

/** The accent note as it enters keys and style prompts: trimmed, single spaces, no '|' (the key separator). */
export function normalizeAccent(accent: string | null | undefined): string {
  return typeof accent === 'string' ? accent.replace(/\|/g, '/').replace(/\s+/g, ' ').trim() : ''
}

/** True when `v` is the default voice of the shipped clips (Kore, no accent), or no voice at all. */
export function isDefaultClipVoice(v: ClipVoice | null | undefined): boolean {
  if (!v) return true
  const name = typeof v.voice === 'string' ? v.voice.trim() : ''
  return (!name || name.toLowerCase() === DEFAULT_CLIP_VOICE.toLowerCase()) && !normalizeAccent(v.accent)
}

/**
 * The voice part of the hashed string: AUDIO_VOICE ('gemini-kore') for the default voice, so every key made before
 * voices existed is unchanged; else `gemini-<voice>` plus `~<accent>` when there is one.
 */
export function clipVoiceId(v: ClipVoice | null | undefined): string {
  if (isDefaultClipVoice(v)) return AUDIO_VOICE
  const name = (v?.voice ?? '').trim() || DEFAULT_CLIP_VOICE
  const accent = normalizeAccent(v?.accent)
  return `gemini-${name.toLowerCase().replace(/[|~]/g, '')}${accent ? `~${accent}` : ''}`
}

/**
 * Key of the clip for exactly this (mode, text, voice). The text is normalised only by trimming: any other
 * difference (case, punctuation, respelling) is a different clip, because it sounds different. Without a voice (or
 * with the default Kore and no accent) the key is the one every shipped clip was made with.
 */
export function audioKey(mode: AudioClipMode, text: string, voice?: ClipVoice | null): string {
  return fnv1a64(`${clipVoiceId(voice)}|${AUDIO_STYLE_VERSION}|${mode}|${text.trim()}`)
}

/**
 * The delivery style a clip is made (and an AI clip requested) with, for a speaker with an accent: the mode's style
 * with "American English" made plain "English" and the accent appended. No accent = the style unchanged (undefined
 * stays undefined: the AI layer's default style). `defaultStyle` stands in for undefined when there is an accent.
 */
export function styleWithAccent(style: string | undefined, accent: string | null | undefined, defaultStyle: string): string | undefined {
  const a = normalizeAccent(accent)
  if (!a) return style
  return `${(style ?? defaultStyle).replace(/American English/g, 'English')}, spoken with a ${a}`
}

/** File name of a clip inside public/audio (and <portable>/audio). */
export function audioFileName(key: string): string {
  return `${key}.mp3`
}
