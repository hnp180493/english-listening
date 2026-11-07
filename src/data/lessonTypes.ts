// Lesson content contracts, shared by every course (src/data/lessons.ts = course "connected",
// src/data/courses/*.ts = the other courses). Authoring guide with examples: docs/courses.md.
//
// Text fields marked "md-lite" use: paragraphs separated by a blank line, lines starting with "- " form a
// bullet list, **bold** marks emphasis. Vietnamese prose, English examples stay English. Respellings follow the
// convention at the top of src/core/decoder/tables.ts and are plain text (never `code`/backticks).
import type { LessonMeta } from '../core/lessons';
import type { Phenomenon } from '../core/types';

export type { CourseId, CourseMeta, LessonMeta } from '../core/lessons';

/** One English phrase/sentence shown decoded (connected speech) with play buttons. */
export interface LessonExample {
  text: string; // natural written English
  note?: string; // short Vietnamese note
  /**
   * Connected TTS text: how the engine must SAY it, in conservative eye dialect ("Tellim I'll callim back.").
   * Played by "Nghe" (speakableFor(text, say)); "Đọc rõ từng từ" plays `text`. Absent = decode(text).speakText.
   * ASCII letters, apostrophes, spaces and the sentence's punctuation only (docs/courses.md).
   */
  say?: string;
}

/**
 * One row of a 'words' table: a single English word (or short phrase) and how it is said.
 *
 * `mark` (optional) highlights letters of `word`. It is `word` written again with marked letter groups in
 * brackets; deleting every bracket character must give back `word` exactly (same letters, same case):
 *   [..]  letters the row is about, e.g. the spelling that makes the sound: { word: 'laugh', mark: 'lau[gh]' }
 *   (..)  silent letters: shown faded and struck through: { word: 'knight', mark: '(k)ni(gh)t' }
 * Groups are not nested and not empty. Both kinds may appear in one word: { word: 'listen', mark: 'lis(t)[en]' }.
 */
export interface WordItem {
  word: string; // English, as written
  sound: string; // respelling in the app convention (tables.ts), e.g. 'ker-nəl'; plain text, no slashes
  ipa?: string; // General American IPA with slashes, e.g. '/ˈkɝnəl/'; shown only when Settings → IPA is on
  note?: string; // Vietnamese, one short line under the row
  why?: string; // Vietnamese md-lite: short origin story, behind a small "Vì sao?" disclosure
  mark?: string; // see above
  say?: string; // TTS text instead of `word` (heteronyms: a context sentence, e.g. 'I read it yesterday.')
  /**
   * Gets a word card in Ôn tập once the lesson is passed. Absent = the course default: true for 'irregular' and
   * 'loanwords', false for 'spelling' and 'connected' (core/review/words.ts, docs/courses.md).
   */
  review?: boolean;
}

export type LessonBlock =
  | { type: 'text'; md: string }
  | { type: 'rule'; title: string; body: string }
  | { type: 'examples'; title?: string; items: LessonExample[] }
  /**
   * Careful word-by-word form vs. natural speech; both playable. `say`: standard text with the reductions
   * ("What do you wanna do?"), decoded for the respelling hint AND the TTS text of `natural`. `ttsText`: exact
   * eye dialect for the engine when the decoder cannot produce it ("Is this shur bag?"), used before `say` for
   * playback only (docs/courses.md).
   */
  | { type: 'compare'; clear: string; natural: string; note: string; say?: string; ttsText?: string }
  | { type: 'tip'; md: string }
  /** A calm word table: word (with marked letters), respelling, [IPA], play + slow, note, "Vì sao?" story. */
  | { type: 'words'; title?: string; items: WordItem[] }
  /** "Vì sao lại thế?" story card (md-lite). `words`: English words the story is about, playable at the bottom. */
  | { type: 'story'; title: string; md: string; words?: string[] };

export interface LessonSection {
  title: string;
  blocks: LessonBlock[];
}

interface QuizBase {
  /** Vietnamese explanation shown after answering. */
  explain: string;
  /**
   * Connected-speech phenomena this item tests (feeds the per-phenomenon weakness stats). Defaults to the lesson's
   * phenomenon. Lessons outside the 'connected' course leave it out: their items record no phenomenon.
   */
  phenomena?: Phenomenon[];
}

/** Listen to one of the options (TTS) and pick the written sentence you heard. */
export interface ListenChooseItem extends QuizBase {
  type: 'listen-choose';
  options: string[]; // 3–4 written sentences/words that SOUND different (never homophones)
  answer: number; // index into options; this option is what gets spoken
  say?: string; // optional TTS override (defaults to options[answer])
}

/** Listen to the full sentence and type the missing word(s), marked [like this] in `text`. */
export interface ListenTypeItem extends QuizBase {
  type: 'listen-type';
  text: string; // e.g. "I'm [going to] call you."
}

/** Read the sentence and tap where the phenomenon happens. */
export interface SpotItem extends QuizBase {
  type: 'spot';
  text: string;
  prompt: string; // Vietnamese question
  unit: 'boundary' | 'word'; // tap a word boundary ("turn it") or a single word ("water")
  answers: string[]; // accepted options, written as they appear ("turn it" / "water"), case-insensitive
}

/** See written → spoken and pick the phenomenon that explains it. */
export interface WhichRuleItem extends QuizBase {
  type: 'which-rule';
  written: string;
  spoken: string;
  options: Phenomenon[];
  answer: Phenomenon;
}

/**
 * Plain multiple choice. With `play` it is a listening item (auto-played, "Nghe" button, counts as listening in
 * Ôn tập); without it, a reading item. Options may be English words, respellings or Vietnamese.
 */
export interface ChooseItem extends QuizBase {
  type: 'choose';
  prompt: string; // Vietnamese question, e.g. 'Chữ "gh" trong từ này đọc thế nào?'
  show?: string; // English word/sentence shown big under the prompt
  play?: string; // English text spoken by TTS (heteronyms: a full sentence, never the bare word)
  options: string[]; // 2–4, unique
  answer: number; // index into options
}

/** Tap the letters of `word` that are not pronounced, then check. Correct iff the set matches exactly. */
export interface SilentLetterItem extends QuizBase {
  type: 'silent-letter';
  word: string; // one English word, e.g. 'knight'
  silent: number[]; // 0-based indices into `word` of every silent letter, e.g. [0, 3, 4] for knight
  prompt?: string; // Vietnamese; default "Chạm vào các chữ câm (viết nhưng không đọc)."
  say?: string; // TTS text instead of `word` (rarely needed)
}

export type QuizItem = ListenChooseItem | ListenTypeItem | SpotItem | WhichRuleItem | ChooseItem | SilentLetterItem;

export interface Lesson extends LessonMeta {
  /** One-line goal shown in the lesson header. */
  goal: string;
  sections: LessonSection[];
  quiz: QuizItem[];
}
