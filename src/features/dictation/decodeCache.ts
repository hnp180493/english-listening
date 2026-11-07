// Memoised, crash-proof access to the decoder for the dictation page.

import { decode } from '../../core/decoder';
import { clozeTokens } from '../../core/dictation/cloze';
import { splitWords } from '../../core/dictation/normalize';
import { connectedText, sayOf, segmentSpeech } from '../../core/playback';
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

/** A chunk too small to be spoken alone: one short word ("A" is read as the letter /eɪ/, "I'm", "just"). */
function tooShort(chunk: string): boolean {
  const ws = chunk.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return ws.length === 1 && ws[0].replace(/[^\p{L}]/gu, '').length <= 4;
}

/**
 * Join one-short-word chunks to their neighbour ("A" + "cuppa" → "A cuppa", "I'm" + "just" → "I'm just", a final
 * "it." joins the chunk before): alone, an engine reads "A" as a letter, and every chunk is one more voice request.
 */
export function mergeShortChunks(chunks: readonly string[]): string[] {
  const out: string[] = [];
  let carry = '';
  for (let k = 0; k < chunks.length; k++) {
    const c = carry ? `${carry} ${chunks[k]}` : chunks[k];
    carry = '';
    const endsPhrase = /[,.;:!?…]["'”’)]*$/.test(c);
    if (tooShort(c) && !endsPhrase && k < chunks.length - 1) {
      carry = c; // said together with the next chunk
    } else if (tooShort(c) && endsPhrase && out.length > 0) {
      out[out.length - 1] = `${out[out.length - 1]} ${c}`; // a short phrase end ("it.") joins the previous chunk
    } else {
      out.push(c);
    }
  }
  if (carry) out.push(carry);
  return out;
}

/**
 * Sound-chunks for "Từng cụm" playback: each segment's speakable (connected) form, else its words, with one-short-
 * word chunks joined to a neighbour (mergeShortChunks).
 */
export function chunksOf(decoded: DecodeResult, words: readonly string[]): string[] {
  const segs = decoded.segments
    .filter((s) => s.written && /[\p{L}\p{N}]/u.test(s.written))
    .map((s) => segmentSpeech(s))
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  return mergeShortChunks(segs.length ? segs : fallbackChunks(words));
}

/** What a dictation sentence sounds like in the exercise: the connected version, and the careful (standard) text. */
export interface DictationAudio {
  /** Connected version (authored `say`, else the decoder's speakText, else the text): the exercise audio. */
  connected: string;
  /** Standard written text: "Rõ từng từ", only after checking. */
  careful: string;
  level?: number;
}

export function dictationAudio(sentence: { text: string; level?: number }): DictationAudio {
  return {
    connected: connectedText(sentence.text, safeDecode(sentence.text), sayOf(sentence)),
    careful: sentence.text,
    level: sentence.level,
  };
}
