// Where the practice text comes from: built-in sentences, chunk examples, or the learner's own text.

import type { Chunk, Level, Phenomenon, Sentence } from '../../core/types';
import { customItemId, type ShadowState } from './store';

export type SourceKind = 'sentence' | 'chunk' | 'custom';

export interface ShadowSource {
  kind: SourceKind;
  itemId: string; // sentence id, chunk id or "custom:<hash>"
  text: string; // English sentence to shadow
  /** Authored connected text of a built-in sentence (Sentence.say): what the model playback speaks. */
  say?: string;
  vi?: string; // Vietnamese translation
  level?: Level;
  topic?: string;
  chunk?: { written: string; spoken: string; meaning: string };
  focus: Phenomenon[];
}

export const MAX_CUSTOM_LENGTH = 300;

/** "Gợi ý: bấm để điền" chips of the custom-text tab (built-in texts: their clips ship with the app). */
export const CUSTOM_EXAMPLES: readonly string[] = ['What are you going to do about it?', "I don't know what you're talking about.", 'Let me get back to you on that.'];

/**
 * Collapse whitespace and cap the length of a typed sentence. Over the limit, the text is
 * cut at the last word boundary before it (never mid-word); a single very long "word"
 * falls back to a hard cut.
 */
export function cleanCustomText(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_CUSTOM_LENGTH) return t;
  // A space right at the limit means the first MAX_CUSTOM_LENGTH chars end on a whole word.
  const cut = t.lastIndexOf(' ', MAX_CUSTOM_LENGTH);
  if (cut < MAX_CUSTOM_LENGTH / 2) return t.slice(0, MAX_CUSTOM_LENGTH).trim();
  const kept = t
    .slice(0, cut)
    .replace(/[\s,;:\-–—]+$/, '')
    .trim();
  return kept || t.slice(0, MAX_CUSTOM_LENGTH).trim();
}

export function sentenceSource(s: Sentence): ShadowSource {
  const src: ShadowSource = { kind: 'sentence', itemId: s.id, text: s.text, vi: s.vi, level: s.level, topic: s.topic, focus: s.focus };
  if (s.say?.trim()) src.say = s.say;
  return src;
}

export function chunkSource(c: Chunk): ShadowSource {
  return {
    kind: 'chunk',
    itemId: c.id,
    text: c.example,
    vi: c.exampleVi,
    chunk: { written: c.written, spoken: c.spoken, meaning: c.meaning },
    focus: c.phenomena,
  };
}

export function customSource(text: string): ShadowSource | null {
  const t = cleanCustomText(text);
  if (!/[a-zA-Z]/.test(t)) return null;
  return { kind: 'custom', itemId: customItemId(t), text: t, focus: [] };
}

/** Resolve the route params (id=<sentenceId|chunkId> or text=<sentence>) to a source. */
export function resolveSource(
  params: Record<string, string>,
  sentences: readonly Sentence[],
  chunks: readonly Chunk[],
): ShadowSource | null {
  const id = params.id?.trim();
  if (id) {
    const s = sentences.find((x) => x.id === id);
    if (s) return sentenceSource(s);
    const c = chunks.find((x) => x.id === id);
    if (c) return chunkSource(c);
  }
  if (params.text) {
    // Text of a built-in item (e.g. sent back from the decoder) keeps that item's identity:
    // translation, "next" and history stay attached to its real id.
    const t = cleanCustomText(params.text);
    const key = foldText(t);
    if (key) {
      const s = sentences.find((x) => foldText(x.text) === key);
      if (s) return sentenceSource(s);
      const c = chunks.find((x) => foldText(x.example) === key);
      if (c) return chunkSource(c);
    }
    return customSource(t);
  }
  return null;
}

/** Lowercase, strip Vietnamese diacritics, unify quotes: "Công việc" → "cong viec". */
export function foldText(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[‘’`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAll(haystack: string, query: string): boolean {
  const terms = foldText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const h = foldText(haystack);
  return terms.every((t) => h.includes(t));
}

export function filterSentences(
  sentences: readonly Sentence[],
  opts: { level: Level | 0; query: string },
): Sentence[] {
  return sentences.filter(
    (s) => (opts.level === 0 || s.level === opts.level) && matchesAll(`${s.text} ${s.vi} ${s.topic}`, opts.query),
  );
}

export function filterChunks(chunks: readonly Chunk[], query: string): Chunk[] {
  return [...chunks]
    .sort((a, b) => a.rank - b.rank)
    .filter((c) => matchesAll(`${c.written} ${c.spoken} ${c.example} ${c.exampleVi} ${c.meaning}`, query));
}

/** Id of the item after `itemId` in its list (wraps around); null for custom text. */
export function nextItemId(
  itemId: string,
  sentences: readonly Sentence[],
  chunks: readonly Chunk[],
): string | null {
  const si = sentences.findIndex((s) => s.id === itemId);
  if (si >= 0 && sentences.length > 0) {
    const cur = sentences[si];
    const sameLevel = sentences.filter((s) => s.level === cur.level);
    const k = sameLevel.findIndex((s) => s.id === itemId);
    return sameLevel[(k + 1) % sameLevel.length].id;
  }
  const sorted = [...chunks].sort((a, b) => a.rank - b.rank);
  const ci = sorted.findIndex((c) => c.id === itemId);
  if (ci >= 0) return sorted[(ci + 1) % sorted.length].id;
  return null;
}

/**
 * Suggest a sentence to practise: the first never-shadowed sentence (easiest level first);
 * when everything has been tried, the one with the lowest best score.
 */
export function suggestSentence(sentences: readonly Sentence[], history: ShadowState): Sentence | null {
  if (sentences.length === 0) return null;
  const byLevel = [...sentences].sort((a, b) => a.level - b.level);
  const fresh = byLevel.find((s) => !history[s.id]);
  if (fresh) return fresh;
  return byLevel.reduce((worst, s) => ((history[s.id]?.best ?? 0) < (history[worst.id]?.best ?? 0) ? s : worst));
}
