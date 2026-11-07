// Word cards of Ôn tập (docs/review-system.md §13): one card per distinct word + pronunciation taught in a 'words'
// block. Pure helpers plus a cached index over the lesson content. Imports specific files, never the barrel.

import type { CourseId } from '../lessons';
import type { Lesson, WordItem } from '../../data/lessonTypes';
import { LESSONS } from '../../data/lessons';
import { makeCardId } from './ids';
import type { CardId } from './types';

/** `WordItem.review` when absent: words of these courses get cards once the lesson is passed. */
export const WORD_REVIEW_DEFAULT: Readonly<Record<CourseId, boolean>> = {
  connected: false,
  spelling: false,
  irregular: true,
  loanwords: true,
};

/** The row gets a word card (its own flag, else the course default; unknown courses: no). */
export function isReviewWord(item: Pick<WordItem, 'review'>, course: string): boolean {
  if (typeof item.review === 'boolean') return item.review;
  return (WORD_REVIEW_DEFAULT as Record<string, boolean | undefined>)[course] ?? false;
}

/** Written word as a key: NFC, lower case, straight apostrophes, single spaces. */
export function normWord(word: string): string {
  return (word ?? '').normalize('NFC').replace(/[‘’]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Respelling as part of a card id: NFC, no slashes or brackets, words joined by '-'. Case is kept: capitals mark
 * the stressed syllable, and some heteronyms differ only there (IN-krees / in-KREES).
 */
export function soundKey(sound: string): string {
  return (sound ?? '')
    .normalize('NFC')
    .replace(/[/[\]()]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * How a respelling sounds, for "same sound?" checks: letters only, lower case (stress and hyphens dropped, so
 * near-identical stress variants also count as the same sound).
 */
export function looseSound(sound: string): string {
  return (sound ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '');
}

/** Card ref: `<normWord>~<soundKey>`, e.g. 'read~red', 'colonel~KER-nəl'. */
export function wordRef(word: string, sound: string): string {
  return `${normWord(word)}~${soundKey(sound)}`;
}

/** Card id of a words-table row, e.g. 'word:read~red'. */
export function wordCardId(item: Pick<WordItem, 'word' | 'sound'>): CardId {
  return makeCardId('word', wordRef(item.word, item.sound));
}

/** A row can make a card: a word and a respelling, and an id short enough for parseCardId. */
function usable(item: WordItem | undefined): item is WordItem {
  return (
    !!item &&
    typeof item.word === 'string' &&
    typeof item.sound === 'string' &&
    !!normWord(item.word) &&
    !!soundKey(item.sound) &&
    wordRef(item.word, item.sound).length <= 200
  );
}

function* wordRows(lesson: Lesson): Generator<WordItem> {
  for (const section of lesson.sections ?? []) {
    for (const block of section.blocks ?? []) {
      if (block.type !== 'words') continue;
      for (const item of block.items ?? []) if (usable(item)) yield item;
    }
  }
}

/** Distinct word card ids of one lesson, in teaching order (rows with review off left out). */
export function lessonWordIds(lesson: Pick<Lesson, 'course' | 'sections'>): CardId[] {
  const out: CardId[] = [];
  const seen = new Set<string>();
  for (const item of wordRows(lesson as Lesson)) {
    if (!isReviewWord(item, lesson.course)) continue;
    const id = wordCardId(item);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** One word card's content: the first row that teaches it, missing fields filled from later rows. */
export interface WordSource {
  id: CardId;
  ref: string;
  item: WordItem;
  lessonId: string; // first lesson (course order) that teaches it
  course: string;
  lessons: string[]; // every lesson that teaches it (with review on), in course order
  /** Position in the content (course, lesson, row order): teaching order for sorting. */
  rank: number;
}

/** One row of any words table (review on or off): the pool for homophone / heteronym checks. */
export interface WordRow {
  word: string; // normWord
  loose: string; // looseSound
  ref: string;
  sound: string; // the respelling as written (shown as an option of a heteronym listening review)
}

export interface WordIndex {
  /** Cards (rows with review on), by id. */
  byId: ReadonlyMap<CardId, WordSource>;
  /** Lesson id → its word card ids, teaching order. */
  byLesson: ReadonlyMap<string, readonly CardId[]>;
  /** Every card, teaching order. */
  all: readonly WordSource[];
  /** Every row of every words table (review on or off), one per distinct ref. */
  rows: readonly WordRow[];
}

const FILL: readonly (keyof WordItem)[] = ['ipa', 'note', 'why', 'mark', 'say'];

/** Index of word cards over lessons (sorted by course then order, as LESSONS). */
export function buildWordIndex(lessons: readonly Lesson[]): WordIndex {
  const byId = new Map<CardId, WordSource>();
  const byLesson = new Map<string, CardId[]>();
  const rows = new Map<string, WordRow>();
  let rank = 0;
  for (const lesson of lessons) {
    if (!lesson || typeof lesson.id !== 'string') continue;
    const ids: CardId[] = [];
    for (const item of wordRows(lesson)) {
      const ref = wordRef(item.word, item.sound);
      if (!rows.has(ref))
        rows.set(ref, {
          word: normWord(item.word),
          loose: looseSound(item.sound),
          ref,
          sound: item.sound,
        });
      if (!isReviewWord(item, lesson.course)) continue;
      const id = makeCardId('word', ref);
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, {
          id,
          ref,
          item: { ...item },
          lessonId: lesson.id,
          course: lesson.course,
          lessons: [lesson.id],
          rank: rank++,
        });
      } else {
        if (!prev.lessons.includes(lesson.id)) prev.lessons.push(lesson.id);
        const merged: WordItem = { ...prev.item };
        for (const f of FILL) {
          if (merged[f] === undefined && item[f] !== undefined)
            (merged as unknown as Record<string, unknown>)[f] = item[f];
        }
        prev.item = merged;
      }
      if (!ids.includes(id)) ids.push(id);
    }
    if (ids.length) byLesson.set(lesson.id, ids);
  }
  return { byId, byLesson, all: [...byId.values()], rows: [...rows.values()] };
}

let cached: WordIndex | null = null;

/** The index over the app's lessons (computed once, on first use). */
export function wordIndex(): WordIndex {
  cached ??= buildWordIndex(LESSONS);
  return cached;
}

/** Lesson id → word card ids, for reconcile. */
export function lessonWordMap(index: WordIndex = wordIndex()): Record<string, readonly CardId[]> {
  return Object.fromEntries(index.byLesson);
}

export interface WordAmbiguity {
  /** Another word in the content sounds the same (knight / night). */
  homophone: boolean;
  /** The same spelling is taught with another pronunciation (read: reed / red). */
  heteronym: boolean;
}

/**
 * Two respellings of one word that differ only by an elided schwa (FA-mə-li / FAM-li): one pronunciation said
 * carefully or fast, not two readings. A stress-only difference (IN-krees / in-KREES) is NOT a variant.
 */
export function isSoundVariant(looseA: string, looseB: string): boolean {
  return looseA !== looseB && looseA.replace(/ə/g, '') === looseB.replace(/ə/g, '');
}

/** Whether the word alone, heard without context, could be another word of the content. */
export function wordAmbiguity(source: Pick<WordSource, 'ref' | 'item'>, rows: readonly WordRow[]): WordAmbiguity {
  const w = normWord(source.item.word);
  const loose = looseSound(source.item.sound);
  let homophone = false;
  let heteronym = false;
  for (const r of rows) {
    if (r.ref === source.ref) continue;
    // same spelling, another respelling (also a stress-only difference: IN-krees / in-KREES), not a fast variant
    if (r.word === w) heteronym ||= !isSoundVariant(r.loose, loose);
    else if (r.loose === loose) homophone = true;
  }
  return { homophone, heteronym };
}

/**
 * Every reading the content gives this spelling (read: red, reed), the card's own first; fast variants of one
 * reading left out. One entry per respelling, as written.
 */
export function wordReadings(source: Pick<WordSource, 'ref' | 'item'>, rows: readonly WordRow[]): string[] {
  const w = normWord(source.item.word);
  const loose = looseSound(source.item.sound);
  // letters with their case (stress capitals kept, hyphens dropped): 'kloh-z' and 'klohz' are one reading
  const shape = (sound: string) => sound.normalize('NFC').replace(/[^\p{L}]/gu, '');
  const out = [source.item.sound];
  const looses = [loose];
  const shapes = new Set([shape(source.item.sound)]);
  for (const r of rows) {
    if (r.word !== w || shapes.has(shape(r.sound))) continue;
    if (looses.some((l) => isSoundVariant(l, r.loose))) continue;
    shapes.add(shape(r.sound));
    looses.push(r.loose);
    out.push(r.sound);
  }
  return out;
}

/** A context sentence (more than one word), as `say` holds for heteronyms. */
export function isSentence(text: string | undefined): text is string {
  return typeof text === 'string' && /\S\s+\S/.test(text.trim());
}
