// Memoised, crash-proof access to the decoder for the dictation page.

import { decode } from '../../core/decoder';
import { clozeTokens } from '../../core/dictation/cloze';
import { splitWords } from '../../core/dictation/normalize';
import type { DecodeResult, Phenomenon } from '../../core/types';

const MAX_CACHE = 800;
const cache = new Map<string, DecodeResult>();

function empty(text: string): DecodeResult {
  return { input: text, tokens: [], annotations: [], segments: [], spokenText: '' };
}

/** decode() that never throws and always returns well-formed arrays. Cached by text. */
export function safeDecode(text: string): DecodeResult {
  const key = typeof text === 'string' ? text : '';
  const hit = cache.get(key);
  if (hit) return hit;
  let r: DecodeResult = empty(key);
  try {
    const d = decode(key);
    if (d && Array.isArray(d.tokens) && Array.isArray(d.annotations) && Array.isArray(d.segments)) r = d;
  } catch {
    // decoder failure must never break dictation
  }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(key, r);
  return r;
}

/** Phenomena the decoder finds in `text`, deduped, sentence order. */
export function detectedPhenomena(text: string): Phenomenon[] {
  return [...new Set(safeDecode(text).annotations.map((a) => a.type))];
}

export function annotationCount(text: string): number {
  return safeDecode(text).annotations.length;
}

/** True when "Điền từ" can make at least one blank (annotated words or the function-word fallback). */
export function hasCloze(text: string): boolean {
  return clozeTokens(safeDecode(text)).length > 0;
}

/** Written tokens of the sentence (decoder tokens, or a whitespace split as fallback). */
export function targetTokens(decoded: DecodeResult, text: string): string[] {
  return decoded.tokens.length ? decoded.tokens.map((t) => t.raw) : splitWords(text);
}

/** Fallback chunks when the decoder gives no segments: split at punctuation, max 4 words. */
function fallbackChunks(words: readonly string[]): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[,.;:!?]$/.test(w) || cur.length >= 4) {
      out.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

/** Sound-chunks for "Từng cụm" playback. */
export function chunksOf(decoded: DecodeResult, words: readonly string[]): string[] {
  const segs = decoded.segments.map((s) => s.written).filter((w) => w && /[\p{L}\p{N}]/u.test(w));
  return segs.length ? segs : fallbackChunks(words);
}
