// Which card ids still have content (docs/review-system.md §3.8). Light: only ids and unit counts are
// kept. Pair data comes from data/pairIndex so the 34 kB pairs file stays out of the main bundle.

import { sanitizeCustom } from '../dictation/custom';
import { KEYS, loadJSON } from '../storage';
import { CHUNKS } from '../../data/chunks';
import { LESSONS } from '../../data/lessons';
import { PAIR_SET_ITEMS } from '../../data/pairIndex';
import { SENTENCES } from '../../data/sentences';
import { sanitizeChunks } from '../../features/drill/chunkData';
import { sanitizeLibrary } from '../../features/media/library';
import { parseCardId, parseMediaRef } from './ids';
import { wordIndex } from './words';
import type { CardId } from './types';

export interface Catalog {
  has(id: CardId): boolean;
}

export interface CatalogInput {
  builtinSentenceIds: ReadonlySet<string>;
  customSentenceIds: ReadonlySet<string>;
  lessonIds: ReadonlySet<string>;
  chunkIds: ReadonlySet<string>;
  pairSetIds: ReadonlySet<string>;
  media: ReadonlyMap<string, number>; // itemId → unitCount
  /** Refs of word cards ('<word>~<sound>', core/review/words). Absent → no word card has content. */
  wordRefs?: ReadonlySet<string>;
}

export function buildCatalog(input: CatalogInput): Catalog {
  return {
    has(id: CardId): boolean {
      const p = parseCardId(id);
      if (!p) return false;
      switch (p.kind) {
        case 'dict':
          return input.builtinSentenceIds.has(p.ref) || input.customSentenceIds.has(p.ref);
        case 'lesson':
          return input.lessonIds.has(p.ref);
        case 'chunk':
          return input.chunkIds.has(p.ref);
        case 'pair':
          return input.pairSetIds.has(p.ref);
        case 'media': {
          const m = parseMediaRef(p.ref);
          if (!m) return false;
          const units = input.media.get(m.itemId);
          return units !== undefined && m.unit < units;
        }
        case 'word':
          return !!input.wordRefs?.has(p.ref);
      }
    },
  };
}

// ───────────── static content ids (computed once, on first use) ─────────────

interface StaticIds {
  builtinSentenceIds: ReadonlySet<string>;
  lessonIds: ReadonlySet<string>;
  chunkIds: ReadonlySet<string>;
  pairSetIds: ReadonlySet<string>;
  wordRefs: ReadonlySet<string>;
}

let staticIds: StaticIds | null = null;

export function staticContentIds(): StaticIds {
  staticIds ??= {
    builtinSentenceIds: new Set(SENTENCES.map((s) => s.id)),
    lessonIds: new Set(LESSONS.filter((l) => l.quiz.length > 0).map((l) => l.id)),
    chunkIds: new Set(sanitizeChunks(CHUNKS).map((c) => c.id)),
    pairSetIds: new Set(Object.keys(PAIR_SET_ITEMS)),
    wordRefs: new Set(wordIndex().all.map((w) => w.ref)),
  };
  return staticIds;
}

/**
 * Ids of the learner's own dictation sentences, as DictationPage and Ôn tập see them (sanitizeCustom: duplicate
 * texts dropped, broken ids repaired), so a card counts only when the session can serve it.
 */
export function readCustomSentenceIds(): Set<string> {
  return new Set(sanitizeCustom(loadJSON<unknown>(KEYS.customSentences, [])).map((c) => c.id));
}

/** Saved media items (session-only items are never stored): itemId → unit count. */
export function readMediaUnits(): Map<string, number> {
  const lib = sanitizeLibrary(loadJSON<unknown>(KEYS.media, null));
  return new Map(lib.items.map((it) => [it.id, it.units.length]));
}

let cached: Catalog | null = null;

/** IO; cached until invalidateCatalog(). */
export function readCatalog(): Catalog {
  if (cached) return cached;
  const s = staticContentIds();
  cached = buildCatalog({
    ...s,
    customSentenceIds: readCustomSentenceIds(),
    media: readMediaUnits(),
  });
  return cached;
}

/** Custom sentences or the media library changed. */
export function invalidateCatalog(): void {
  cached = null;
}
