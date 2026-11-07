// Auto-grading per kind (docs/review-system.md §3.5). Pure; core must not import features, so the
// small PRNG helpers are local copies.

import type { CardState, Grade } from '../srs';
import { LESSON_REVIEW_SIZE } from './constants';

export interface DictationCheck {
  total: number; // AlignResult.total
  matched: number; // AlignResult.matched (typo matches count as matched)
  extra: number; // AlignResult.extra
  hinted: boolean;
  revealed: boolean; // "Chịu, xem đáp án"
  firstTry: boolean; // no dictation attempt for this id before this check
  kind: 'dict' | 'media';
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Missed target words plus extra words typed. */
export function dictationErrors(c: Pick<DictationCheck, 'total' | 'matched' | 'extra'>): number {
  const total = count(c.total);
  return Math.max(0, total - Math.min(total, count(c.matched))) + count(c.extra);
}

export function gradeDictation(c: DictationCheck): Grade {
  const total = count(c.total);
  if (c.revealed || total <= 0) return 'again';
  const errors = dictationErrors(c);
  if (errors === 0 && !c.hinted && c.firstTry) return 'easy';
  if (errors === 0 && !c.hinted) return 'good';
  if (errors === 0) return 'hard';
  if (errors === 1 && total >= 4) return 'hard';
  if (c.kind === 'media' && total > 12 && errors <= 2) return 'hard';
  return 'again';
}

/** First answers of one pair set in a round (or a 4-question review). null when nothing was answered. */
export function gradePairSet(correct: number, total: number): Grade | null {
  const t = count(total);
  if (t <= 0) return null;
  const c = Math.min(t, count(correct));
  if (c === t && t >= 4) return 'good';
  if (c === t) return 'hard';
  if (t - c === 1 && t >= 4) return 'hard';
  return 'again';
}

/** Lesson quiz (8 questions) or lesson review (4 questions), score 0..1. */
export function gradeLessonScore(score: number): Grade {
  const s = Number.isFinite(score) ? score : 0;
  if (s >= 0.9) return 'good';
  if (s >= 0.7) return 'hard';
  return 'again';
}

/**
 * Word card, listening review (hear the word, pick the written word): right on the first pick 'good', a wrong pick
 * or "xem đáp án" 'again'. The reading review is self-graded with the four buttons.
 */
export function gradeWordChoice(correct: boolean): Grade {
  return correct === true ? 'good' : 'again';
}

export type LessonItemType = 'listen-choose' | 'listen-type' | 'spot' | 'which-rule' | 'choose' | 'silent-letter';

/**
 * Quiz item kinds that count as listening. 'listen' is the generic token callers pass for any item answered by ear
 * (features/lessons/logic isListeningItem: the listening types and 'choose' with `play`).
 */
const LISTENING = new Set<string>(['listen', 'listen-choose', 'listen-type', 'spot']);

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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

/** Fisher–Yates, the same algorithm as core/dictation/progress.shuffled. */
function shuffled<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Quiz indices for one lesson review: listening items first (up to LESSON_REVIEW_SIZE), rule items only
 * to fill. Deterministic per (lesson, reps, lapses), so successive reviews rotate.
 */
export function lessonReviewItems(
  lessonId: string,
  types: readonly string[],
  card: Pick<CardState, 'reps' | 'lapses'> | undefined,
): number[] {
  const listening: number[] = [];
  const rule: number[] = [];
  types.forEach((t, i) => (LISTENING.has(t) ? listening : rule).push(i));
  const mix = Math.imul((card?.reps ?? 0) * 31 + (card?.lapses ?? 0) * 7 + 1, 0x9e3779b1);
  const seed = (fnv1a(lessonId) ^ mix) >>> 0;
  const rnd = mulberry32(seed);
  const l = shuffled(listening, rnd);
  const r = shuffled(rule, rnd);
  if (l.length >= LESSON_REVIEW_SIZE) return l.slice(0, LESSON_REVIEW_SIZE);
  return [...l, ...r].slice(0, LESSON_REVIEW_SIZE);
}
