// Contract for the periodic listening check ("Kiểm tra định kỳ"). Content lives in
// src/data/benchmark.ts; scoring in src/core/benchmark.ts. See docs/progress-report.md.

import type { Level, Phenomenon } from '../core/types';

/** Parallel forms rotate A → B → C … so the learner never retakes a form they remember. */
export type BenchmarkFormId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** Part 1: hear one sentence (natural speed, max 2 plays), type it. Scored by word accuracy. */
export interface BenchmarkSentence {
  id: string; // unique across all forms, e.g. "bA-s01"
  text: string; // natural spoken-style English, 6–16 words
  vi: string; // Vietnamese translation, shown only on the result screen
  level: Level;
  focus: Phenomenon[]; // main connected-speech phenomena present (author-labelled, checked against the decoder)
}

/** Part 2: hear a short passage (2–4 sentences, max 2 plays), answer one gist/detail question. */
export interface BenchmarkQuestion {
  id: string; // unique across all forms, e.g. "bA-q1"
  lines: string[]; // spoken in order with a short pause between lines (one TTS voice, so a monologue or a message)
  question: string; // Vietnamese
  options: string[]; // Vietnamese, 3–4 options, one correct
  answer: number; // index into options
  why: string; // Vietnamese, 1–2 sentences: which words in the audio give the answer (shown after the test)
  focus: Phenomenon[]; // phenomena that make the key words hard to catch
}

export interface BenchmarkForm {
  id: BenchmarkFormId;
  sentences: BenchmarkSentence[]; // exactly 10
  questions: BenchmarkQuestion[]; // exactly 4
}
