// What a recorded attempt was about, for the "Lượt luyện gần đây" list (no raw ids such as s044 or walk-3).

import type { Attempt } from '../../core/stats';
import { KIND_LABEL } from '../../core/review/constants';
import { wordIndex } from '../../core/review/words';
import { CHUNKS } from '../../data/chunks';
import { lessonLabel } from '../../data/courses';
import { LESSONS } from '../../data/lessons';
import { PAIR_SETS } from '../../data/pairs';
import { SENTENCES } from '../../data/sentences';

export interface AttemptText {
  /** Sentence, phrase or title, in its own language. */
  text: string;
  /** Chunks: how the phrase is said ("wanna"), shown as a respelling after the written form. */
  spoken?: string;
  /** English content (sentences, phrases); false for Vietnamese titles. */
  en: boolean;
}

let index: {
  sentences: Map<string, string>;
  chunks: Map<string, { written: string; spoken: string }>;
  pairs: Map<string, string>;
  lessons: Map<string, string>;
} | null = null;

function build() {
  if (index) return index;
  const sentences = new Map<string, string>();
  for (const s of Array.isArray(SENTENCES) ? SENTENCES : []) if (s && typeof s.text === 'string') sentences.set(s.id, s.text);
  const chunks = new Map<string, { written: string; spoken: string }>();
  for (const c of Array.isArray(CHUNKS) ? CHUNKS : []) {
    if (c && typeof c.written === 'string') chunks.set(c.id, { written: c.written, spoken: String(c.spoken ?? '') });
  }
  const pairs = new Map<string, string>();
  for (const set of Array.isArray(PAIR_SETS) ? PAIR_SETS : []) {
    for (const item of Array.isArray(set?.items) ? set.items : []) if (item && typeof item.id === 'string') pairs.set(item.id, set.title);
  }
  const lessons = new Map<string, string>();
  for (const l of Array.isArray(LESSONS) ? LESSONS : []) if (l && typeof l.id === 'string') lessons.set(l.id, lessonLabel(l));
  index = { sentences, chunks, pairs, lessons };
  return index;
}

/** A word card answered in Ôn tập (module 'lesson', itemId 'word:<ref>', docs/review-system.md §13). */
export function isWordAttempt(a: Pick<Attempt, 'module' | 'itemId'>): boolean {
  return a.module === 'lesson' && typeof a.itemId === 'string' && a.itemId.startsWith('word:');
}

/** The source line under an attempt: "Từ đã học" for a word review, else the module name. */
export function attemptSource(a: Pick<Attempt, 'module' | 'itemId'>, moduleName: string): string {
  return isWordAttempt(a) ? KIND_LABEL.word : moduleName;
}

/** null when the item is unknown (custom sentences, media lines, deleted content): show the module name alone. */
export function attemptText(a: Pick<Attempt, 'module' | 'itemId'>): AttemptText | null {
  const id = typeof a.itemId === 'string' ? a.itemId : '';
  if (!id) return null;
  if (isWordAttempt(a)) {
    const src = wordIndex().byId.get(id as `word:${string}`);
    return src ? { text: src.item.word, spoken: src.item.sound, en: true } : null;
  }
  const ix = build();
  if (a.module === 'lesson') {
    const title = ix.lessons.get(id.split(':')[0]);
    return title ? { text: title, en: false } : null;
  }
  if (a.module === 'pairs') {
    const title = ix.pairs.get(id);
    return title ? { text: title, en: false } : null;
  }
  const sentence = ix.sentences.get(id);
  if (sentence) return { text: sentence, en: true };
  const chunk = ix.chunks.get(id);
  if (chunk) return { text: chunk.written, spoken: chunk.spoken && chunk.spoken !== chunk.written ? chunk.spoken : undefined, en: true };
  return null;
}
