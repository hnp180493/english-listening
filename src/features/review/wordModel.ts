// Ôn tập word cards (docs/review-system.md §13): which of the two item modes a review uses, what it plays, and the
// listening options. Pure.
//
// Modes:
// - 'listen' (Nghe → nhận ra, auto-graded): the word is played, not shown; the learner picks the written word among
//   3–4 options whose sounds all differ from the answer (and from each other). A heteronym (read: reed / red) plays
//   its context sentence and asks which READING was said instead (task 'reading': the options are its respellings).
// - 'read' (Đọc → nói, self-graded): the word is shown plain; the learner reads it aloud, flips the card (respelling,
//   marks, note, story, audio) and grades themself. A heteronym shows its context sentence on the front.
//
// Rule: new cards (never answered), cards missed last time and cards still in a learning step use 'read' (learn the
// sound first). Graduated cards alternate on `reps + lapses`: odd listens, even reads. A lapse resets `reps` to 1 and
// adds one to `lapses`, so a word missed by ear is read once (the recovery) and then listened to again. A heteronym
// can only be listened to in its context sentence (`say` with more than one word): TTS of the bare spelling says one
// reading whatever the card. A homophone (knight / night) is safe bare: no option ever sounds like the answer. A
// word-pick listen review needs at least 2 safe distractors, else 'read'.

import type { CardState } from '../../core/srs';
import {
  isSentence,
  looseSound,
  normWord,
  wordAmbiguity,
  wordReadings,
  type WordAmbiguity,
  type WordIndex,
  type WordRow,
  type WordSource,
} from '../../core/review/words';
import { hashSeed } from './resolve';

export type WordMode = 'listen' | 'read';

/** Distractors per listening review (4 options with the answer); 2 is the minimum (3 options). */
export const WORD_OPTIONS = 4;
const MIN_DISTRACTORS = 2;

export interface WordAudio {
  text: string; // what TTS says
  context: boolean; // a sentence around the word (the word is not said alone)
}

/**
 * What a listening review plays: the context sentence when the row has one (heteronyms; words whose bare TTS is
 * ambiguous), a single-word `say` (a TTS spelling fix), else the word.
 */
export function wordAudio(item: Pick<WordSource['item'], 'word' | 'say'>): WordAudio {
  const say = item.say?.trim();
  if (say && isSentence(say)) return { text: say, context: true };
  if (say) return { text: say, context: false };
  return { text: item.word, context: false };
}

/** normWord without diacritics (résumé → resume), for whole-word matching. */
const bare = (s: string) => normWord(s).normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');

/** Does `word` occur in `text` as a whole word (case- and diacritic-insensitive)? */
export function containsWord(text: string, word: string): boolean {
  const w = bare(word);
  if (!w) return false;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}'])${esc}($|[^\\p{L}'])`, 'iu').test(bare(text));
}

/** `text` split around whole-word occurrences of `word` (case-insensitive), for bolding it in a sentence. */
export function markWordIn(text: string, word: string): { text: string; hit: boolean }[] {
  const w = (word ?? '').trim();
  if (!w) return [{ text, hit: false }];
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]");
  const re = new RegExp(`(?<![\\p{L}'’])${esc}(?![\\p{L}'’])`, 'giu');
  const out: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ text: text.slice(at, i), hit: false });
    out.push({ text: m[0], hit: true });
    at = i + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Up to `n` distractor words for a listening review of `answer`. Never: the same spelling, a word the content says
 * with the answer's sound in any of its readings (homophones, the heteronym spelling of that sound, stress-only
 * variants: `rows` gives every reading), a word that sounds like another option, or a word said in the context
 * sentence being played. Same lesson first, then the same course, then any.
 */
export function listenDistractors(
  answer: WordSource,
  pool: readonly WordSource[],
  seed: number,
  n = WORD_OPTIONS - 1,
  rows: readonly WordRow[] = [],
): WordSource[] {
  const rnd = mulberry32(seed);
  const audio = wordAudio(answer.item);
  const lessons = new Set(answer.lessons);
  // every way the content says a spelling (lead: leed and led), so no option can be read as the answer's sound
  const said = new Map<string, Set<string>>();
  const hear = (word: string, sound: string) => {
    const k = normWord(word);
    const set = said.get(k) ?? new Set<string>();
    set.add(looseSound(sound));
    said.set(k, set);
  };
  for (const r of rows) hear(r.word, r.loose);
  for (const c of [answer, ...pool]) hear(c.item.word, c.item.sound);
  const soundsOf = (c: WordSource) => said.get(normWord(c.item.word)) ?? new Set([looseSound(c.item.sound)]);
  const words = new Set([normWord(answer.item.word)]);
  const sounds = new Set([looseSound(answer.item.sound)]);
  const ok = (c: WordSource) =>
    c.id !== answer.id &&
    !words.has(normWord(c.item.word)) &&
    ![...soundsOf(c)].some((x) => sounds.has(x)) &&
    !(audio.context && containsWord(audio.text, c.item.word));
  const tiers = [
    pool.filter((c) => c.lessons.some((l) => lessons.has(l))),
    pool.filter((c) => c.course === answer.course && !c.lessons.some((l) => lessons.has(l))),
    pool.filter((c) => c.course !== answer.course),
  ];
  const out: WordSource[] = [];
  for (const tier of tiers) {
    for (const c of shuffled(tier, rnd)) {
      if (out.length >= n) return out;
      if (!ok(c)) continue;
      out.push(c);
      words.add(normWord(c.item.word));
      for (const x of soundsOf(c)) sounds.add(x);
    }
  }
  return out;
}

/** The mode rule (see the file header). `listenable`: a safe listening variant exists for this word. */
export function chooseWordMode(
  state: (Pick<CardState, 'interval' | 'reps' | 'lastGrade'> & { lapses?: number }) | undefined,
  listenable: boolean,
): WordMode {
  if (!listenable) return 'read';
  if (!state || state.lastGrade === undefined || state.lastGrade === 'again' || state.interval === 0) return 'read';
  const lapses = typeof state.lapses === 'number' && Number.isFinite(state.lapses) ? state.lapses : 0;
  return (state.reps + lapses) % 2 === 1 ? 'listen' : 'read';
}

/**
 * A heteronym can be listened to only in a context sentence (bare TTS says one reading whatever the card). A
 * homophone is safe bare: the distractors never include a word with the answer's sound.
 */
export function listenSafe(amb: WordAmbiguity, audio: WordAudio): boolean {
  return !amb.heteronym || audio.context;
}

export interface WordPlan {
  mode: WordMode;
  /**
   * What a listen review asks: 'word' = which written word was heard (or is in the sentence); 'reading' = how a
   * heteronym was said in its sentence (the options are respellings). Always 'word' in 'read' mode.
   */
  task: 'word' | 'reading';
  audio: WordAudio;
  /** Listening options (written words, or respellings for 'reading'; answer included, shuffled); empty in 'read'. */
  options: string[];
  /** Respelling of each option (same order), shown after a wrong pick: "từ đó đọc là …". */
  sounds: string[];
  answer: number; // index of the answer in `options`; -1 in 'read'
  ambiguity: WordAmbiguity;
}

/** Everything one review of a word card shows. Deterministic for a given card state and seed. */
export function wordPlan(
  source: WordSource,
  state: Pick<CardState, 'interval' | 'reps' | 'lastGrade' | 'lapses'> | undefined,
  index: Pick<WordIndex, 'all' | 'rows'>,
  seed: number,
): WordPlan {
  const audio = wordAudio(source.item);
  const ambiguity = wordAmbiguity(source, index.rows);
  const s = (hashSeed(`${source.id}:${state?.reps ?? 0}:${state?.lapses ?? 0}`) ^ seed) >>> 0;
  const read: WordPlan = {
    mode: 'read',
    task: 'word',
    audio,
    options: [],
    sounds: [],
    answer: -1,
    ambiguity,
  };

  // A heteronym in its sentence: which reading was said? (read~reed and read~red get different answers.)
  if (ambiguity.heteronym) {
    const readings = audio.context ? wordReadings(source, index.rows).slice(0, WORD_OPTIONS) : [];
    if (chooseWordMode(state, readings.length >= 2) === 'read') return read;
    const order = shuffled(
      readings.map((_, i) => i),
      mulberry32(s ^ 0x5bd1e995),
    );
    const options = order.map((i) => readings[i]);
    return {
      mode: 'listen',
      task: 'reading',
      audio,
      options,
      sounds: options,
      answer: order.indexOf(0),
      ambiguity,
    };
  }

  const distractors = listenSafe(ambiguity, audio)
    ? listenDistractors(source, index.all, s, WORD_OPTIONS - 1, index.rows)
    : [];
  if (chooseWordMode(state, distractors.length >= MIN_DISTRACTORS) === 'read') return read;
  const all = shuffled([source, ...distractors], mulberry32(s ^ 0x5bd1e995));
  return {
    mode: 'listen',
    task: 'word',
    audio,
    options: all.map((w) => w.item.word),
    sounds: all.map((w) => w.item.sound),
    answer: all.indexOf(source),
    ambiguity,
  };
}
