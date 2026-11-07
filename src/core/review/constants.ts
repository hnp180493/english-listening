// Constants of the review layer (docs/review-system.md §2). A leaf module: only type imports, so
// core/settings.ts can read the defaults without pulling in the rest of core/review.

import type { RouteId } from '../nav';
import type { ReviewKind, StoredKind } from './types';

const MINUTE = 60_000;

/** "Thời lượng ôn mỗi ngày" choices, in minutes. */
export const REVIEW_MINUTES_OPTIONS: readonly number[] = [5, 10, 15, 20];
export const DEFAULT_REVIEW_MINUTES = 10;
/** Target length of one session (seconds). */
export const SESSION_SEC = 300;
/** A session takes at least this many items when available. */
export const MIN_SESSION_ITEMS = 5;
/** Hard ceiling per session. */
export const MAX_SESSION_ITEMS = 30;
/** "Ôn thêm 5 phút" raises today's budget by this (seconds). */
export const EXTRA_STEP_SEC = 300;
/** Budgeted (successful) new enrolments per local day. Tuned down from 15: the 60-day simulation in queue.test.ts
 * peaked at 55 held-back items with 15 (12: 35, drifting up); 10 keeps the backlog bounded. */
export const NEW_ENROL_PER_DAY = 10;
/** A pair set with this many first answers enrols even without a miss (budgeted). */
export const PAIR_ENROL_ANSWERS = 20;
export const LESSON_PER_SESSION = 2;
export const LESSON_PER_DAY = 4;
export const LESSON_REVIEW_SIZE = 4;
export const PAIR_REVIEW_SIZE = 4;
/** Same-kind block length in a session. */
export const INTERLEAVE_BLOCK = 3;
/** Learning cards due within this window fill a short session. */
export const LEARN_AHEAD_MS = 20 * MINUTE;
/** Floor for a learning-step due date set in practice context. */
export const PRACTICE_STEP_MS = 60 * MINUTE;
/** Fraction of the interval a lapse keeps. */
export const LAPSE_KEEP = 0.25;
/** Growth of a recovering card (last grade 'again') on 'good'. */
export const RECOVER_MULT = 1.5;
/** An auto 'hard' never pushes ease below this. */
export const AUTO_HARD_MIN_EASE = 2.0;
/** Max reconciled (never graded) cards per day. 8 × 40 s is about half the default budget: tuned down from 12, which
 * kept back-pressure on for weeks after migrating a large history (graded follow-ups + 12 new ones a day). */
export const SEED_PER_DAY = 8;
/** A reconcile run that creates at least this many cards raises the seed notice. */
export const NOTICE_MIN = 5;
/**
 * New word cards (never answered) admitted to Ôn tập per local day. They also count against NEW_ENROL_PER_DAY,
 * stop while anything is held back (back-pressure) and come last in the day's order, so they only use budget that
 * is left. words.test.ts simulates a 15-word lesson every 2 days: with 6 a day, words alone settle at about 35
 * reviews a day (≈ 9 min at 15 s); with 8 they fill the whole 10-minute budget by day 50, leaving nothing for
 * sentences.
 */
export const WORD_NEW_PER_DAY = 6;

export const KIND_ORDER: readonly ReviewKind[] = ['dict', 'pair', 'chunk', 'lesson', 'media', 'word'];
export const TAP_KINDS: readonly ReviewKind[] = ['pair', 'chunk', 'word', 'lesson'];
export const TYPING_KINDS: readonly ReviewKind[] = ['dict', 'media'];

export const KIND_LABEL: Readonly<Record<ReviewKind, string>> = {
  dict: 'Chép chính tả',
  pair: 'Phân biệt âm',
  chunk: 'Cụm từ',
  lesson: 'Bài học',
  media: 'Câu từ video',
  word: 'Từ đã học',
};

export const KIND_SHORT: Readonly<Record<ReviewKind, string>> = {
  dict: 'Câu',
  pair: 'Nhóm âm',
  chunk: 'Cụm từ',
  lesson: 'Bài học',
  media: 'Câu video',
  word: 'Từ',
};

export const KIND_ROUTE: Readonly<Record<ReviewKind, RouteId>> = {
  dict: 'dictation',
  pair: 'pairs',
  chunk: 'drill',
  lesson: 'lessons',
  media: 'media',
  word: 'lessons',
};

/** Time estimate per item (seconds). */
export const KIND_SECONDS: Readonly<Record<ReviewKind, number>> = {
  dict: 40,
  media: 40,
  pair: 45,
  chunk: 12,
  lesson: 75,
  word: 15, // one tap (listen → choose) or read aloud + flip + self-grade
};

/** Kinds whose successful enrolments count against NEW_ENROL_PER_DAY. */
export const BUDGETED_KINDS: readonly StoredKind[] = ['dict', 'pair'];
