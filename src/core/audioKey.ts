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

/**
 * Key of the clip for exactly this (mode, text). The text is normalised only
 * by trimming: any other difference (case, punctuation, respelling) is a
 * different clip, because it sounds different.
 */
export function audioKey(mode: AudioClipMode, text: string): string {
  return fnv1a64(`${AUDIO_VOICE}|${AUDIO_STYLE_VERSION}|${mode}|${text.trim()}`)
}

/** File name of a clip inside public/audio (and <portable>/audio). */
export function audioFileName(key: string): string {
  return `${key}.mp3`
}
