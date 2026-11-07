// CardId → what the Ôn tập session renders (docs/review-system.md §6.1). Pure: the page passes the
// learner's custom sentences and media library in; the static content is imported here.

import { estimateLevel, toSentence, wordCount, type CustomSentence } from '../../core/dictation/custom';
import { parseCardId, parseMediaRef } from '../../core/review/ids';
import { PAIR_REVIEW_SIZE } from '../../core/review/constants';
import type { CardId } from '../../core/review/types';
import { wordIndex, type WordSource } from '../../core/review/words';
import type { Chunk, Sentence } from '../../core/types';
import { CHUNKS } from '../../data/chunks';
import { LESSONS, type Lesson } from '../../data/lessons';
import { PAIR_SETS, type PairSet } from '../../data/pairs';
import { SENTENCES } from '../../data/sentences';
import { annotationCount, detectedPhenomena } from '../dictation/decodeCache';
import { sanitizeChunks } from '../drill/chunkData';
import type { MediaItem } from '../media/library';
import { createRng, itemPriority, type PairsProgress, type Question } from '../pairs/game';

export const ALL_CHUNKS: readonly Chunk[] = sanitizeChunks(CHUNKS);

const SENTENCE_BY_ID = new Map(SENTENCES.map((s) => [s.id, s]));
const CHUNK_BY_ID = new Map(ALL_CHUNKS.map((c) => [c.id, c]));
const LESSON_BY_ID = new Map(LESSONS.filter((l) => l.quiz.length > 0).map((l) => [l.id, l]));
const SET_BY_ID = new Map(PAIR_SETS.filter((s) => s.items.some((i) => i.options.length >= 2)).map((s) => [s.id, s]));

export type Resolved =
  | { kind: 'dict'; id: CardId; ref: string; sentence: Sentence; custom: boolean }
  | { kind: 'media'; id: CardId; ref: string; sentence: Sentence; itemId: string; unit: number; title: string }
  | { kind: 'pair'; id: CardId; ref: string; set: PairSet }
  | { kind: 'lesson'; id: CardId; ref: string; lesson: Lesson }
  | { kind: 'chunk'; id: CardId; ref: string; chunk: Chunk }
  | { kind: 'word'; id: CardId; ref: string; source: WordSource };

export interface ResolveSources {
  customs: readonly CustomSentence[];
  media: readonly MediaItem[];
}

export interface Resolver {
  resolve(id: CardId): Resolved | null;
  /** Main phenomenon of an item (spreads phenomena inside a session block). */
  phenomenonOf(id: CardId): string | undefined;
}

/** A transcript line served as TTS dictation. */
export function mediaSentence(id: CardId, item: Pick<MediaItem, 'title'>, text: string): Sentence {
  return {
    id,
    text,
    vi: '',
    level: estimateLevel(wordCount(text), annotationCount(text)),
    topic: item.title,
    focus: detectedPhenomena(text),
  };
}

export function createResolver(src: ResolveSources): Resolver {
  const customs = new Map(src.customs.map((c) => [c.id, c]));
  const media = new Map(src.media.map((m) => [m.id, m]));
  const memo = new Map<CardId, Resolved | null>();

  const build = (id: CardId): Resolved | null => {
    const p = parseCardId(id);
    if (!p) return null;
    const { kind, ref } = p;
    switch (kind) {
      case 'dict': {
        const builtin = SENTENCE_BY_ID.get(ref);
        if (builtin) return { kind, id, ref, sentence: builtin, custom: false };
        const c = customs.get(ref);
        if (!c || !c.text.trim()) return null;
        return { kind, id, ref, sentence: toSentence(c, detectedPhenomena(c.text)), custom: true };
      }
      case 'media': {
        const m = parseMediaRef(ref);
        const item = m ? media.get(m.itemId) : undefined;
        const unit = m && item ? item.units[m.unit] : undefined;
        if (!m || !item || !unit || !unit.text.trim()) return null;
        return {
          kind,
          id,
          ref,
          sentence: mediaSentence(id, item, unit.text.trim()),
          itemId: item.id,
          unit: m.unit,
          title: item.title,
        };
      }
      case 'pair': {
        const set = SET_BY_ID.get(ref);
        return set ? { kind, id, ref, set } : null;
      }
      case 'lesson': {
        const lesson = LESSON_BY_ID.get(ref);
        return lesson ? { kind, id, ref, lesson } : null;
      }
      case 'chunk': {
        const chunk = CHUNK_BY_ID.get(ref);
        return chunk ? { kind, id, ref, chunk } : null;
      }
      case 'word': {
        const source = wordIndex().byId.get(id);
        return source ? { kind, id, ref, source } : null;
      }
    }
  };

  const resolve = (id: CardId): Resolved | null => {
    if (!memo.has(id)) memo.set(id, build(id));
    return memo.get(id) ?? null;
  };

  const phenomenonOf = (id: CardId): string | undefined => {
    const r = resolve(id);
    if (!r) return undefined;
    switch (r.kind) {
      case 'dict':
      case 'media':
        return r.sentence.focus[0];
      case 'pair':
        return r.set.phenomenon;
      case 'lesson':
        return r.lesson.phenomenon ?? undefined;
      case 'chunk':
        return r.chunk.phenomena[0];
      case 'word':
        return `lesson:${r.source.lessonId}`; // words of one lesson spread apart inside a block
    }
  };

  return { resolve, phenomenonOf };
}

/** FNV-1a: a stable seed from a string. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Random jitter added to item priority, as in a pairs round. */
const JITTER = 0.4;

/**
 * The questions of one pair-set review: PAIR_REVIEW_SIZE distinct items, weakest first (itemPriority desc with
 * a seeded jitter), each with a seeded random answer. Deterministic for a given seed.
 */
export function pairReviewQuestions(set: PairSet, progress: PairsProgress, now: number, seed: number): Question[] {
  const rng = createRng(seed);
  const seen = new Set<string>();
  const scored: { id: string; options: number; score: number }[] = [];
  for (const item of set.items) {
    if (item.options.length < 2 || seen.has(item.id)) continue;
    seen.add(item.id);
    scored.push({ id: item.id, options: item.options.length, score: itemPriority(progress.items[item.id], now) + rng() * JITTER });
  }
  scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return scored.slice(0, PAIR_REVIEW_SIZE).map((c) => ({
    key: `${c.id}#0`,
    setId: set.id,
    itemId: c.id,
    answer: Math.floor(rng() * c.options),
    requeue: false,
  }));
}
