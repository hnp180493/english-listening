// SM-2 style spaced-repetition scheduler for the "Cụm từ" drill (manual grades). The review layer
// (core/review, docs/review-system.md) reuses CardState and the queue helpers; its auto-graded kinds
// schedule with core/review/schedule.gradeAuto instead of `grade`.
// Pure module: no DOM, no storage. Times are epoch ms; intervals are in days.

import { startOfLocalDay } from './review/time';

export type Grade = 'again' | 'hard' | 'good' | 'easy';
export const GRADES: readonly Grade[] = ['again', 'hard', 'good', 'easy'] as const;

export interface CardState {
  id: string;
  due: number; // epoch ms when the card should be shown again
  interval: number; // days; 0 = still learning / relearning
  ease: number; // >= MIN_EASE, starts at START_EASE
  reps: number; // successful reviews in a row since the last lapse
  lapses: number; // times the card was forgotten ("again")
  lastGrade?: Grade;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const START_EASE = 2.5;
export const MIN_EASE = 1.3;
/** "again" → show the card again after this delay (same session). */
export const RELEARN_MS = MINUTE;
/** "hard" on a card that has not graduated yet → short learning step. */
export const HARD_LEARNING_MS = 10 * MINUTE;
/** Interval (days) from which a card counts as "Thuộc". */
export const MATURE_DAYS = 21;
export const MAX_INTERVAL_DAYS = 36500;

export function newCard(id: string, now: number): CardState {
  return { id, due: now, interval: 0, ease: START_EASE, reps: 0, lapses: 0 };
}

function clampEase(e: number): number {
  return Math.max(MIN_EASE, Math.round(e * 100) / 100);
}

function clampInterval(d: number): number {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(d)));
}

function isGraduated(card: CardState): boolean {
  return card.reps > 0 && card.interval >= 1;
}

/** Interval in days a "good" answer would give. */
function goodInterval(card: CardState): number {
  if (!isGraduated(card)) return 1;
  // Second step of a freshly graduated card: 1 day → 3 days. A card that graduated with a
  // longer interval (e.g. "easy" → 4 days) must not shrink back to a fixed small step.
  if (card.reps === 1 && card.interval < 3) return 3;
  return clampInterval(Math.max(card.interval + 1, card.interval * card.ease));
}

/** Apply a grade and return the new card state (the input is not mutated). */
export function grade(card: CardState, g: Grade, now: number): CardState {
  const graduated = isGraduated(card);
  switch (g) {
    case 'again':
      return {
        ...card,
        reps: 0,
        interval: 0,
        // Only a card that was already learned can be "forgotten" (lapse) and lose ease.
        lapses: graduated ? card.lapses + 1 : card.lapses,
        ease: graduated ? clampEase(card.ease - 0.2) : card.ease,
        due: now + RELEARN_MS,
        lastGrade: g,
      };
    case 'hard': {
      if (!graduated) {
        // Learning step: ease is only adjusted on real reviews (same as "again").
        return { ...card, interval: 0, due: now + HARD_LEARNING_MS, lastGrade: g };
      }
      const ease = clampEase(card.ease - 0.15);
      const interval = clampInterval(card.interval * 1.2);
      return { ...card, ease, interval, reps: card.reps + 1, due: now + interval * DAY, lastGrade: g };
    }
    case 'good': {
      const interval = goodInterval(card);
      return { ...card, interval, reps: card.reps + 1, due: now + interval * DAY, lastGrade: g };
    }
    case 'easy': {
      const good = goodInterval(card);
      const interval = graduated ? clampInterval(Math.max(good + 1, good * 1.3)) : 4;
      return {
        ...card,
        ease: clampEase(card.ease + 0.15),
        interval,
        reps: card.reps + 1,
        due: now + interval * DAY,
        lastGrade: g,
      };
    }
  }
}

export function isDue(card: CardState, now: number): boolean {
  return card.due <= now;
}

/**
 * When the card can be served in Ôn tập: local midnight of the due day for graduated cards
 * (calendar-day due), the exact due time for learning cards (interval 0).
 */
export function availableAt(card: CardState): number {
  return card.interval >= 1 ? startOfLocalDay(card.due) : card.due;
}

/** True when the card can be served now (calendar-day due for graduated cards). */
export function isDueToday(card: CardState, now: number): boolean {
  return availableAt(card) <= now;
}

/** Short Vietnamese duration label: "<1 phút", "10 phút", "3 giờ", "4 ngày", "2 tháng", "1,5 năm". */
export function formatInterval(ms: number): string {
  if (ms <= MINUTE) return '<1 phút';
  if (ms < HOUR - MINUTE / 2) return `${Math.round(ms / MINUTE)} phút`;
  if (ms < DAY - HOUR / 2) return `${Math.max(1, Math.round(ms / HOUR))} giờ`;
  const days = ms / DAY;
  if (days < 30) return `${Math.max(1, Math.round(days))} ngày`;
  if (days < 365) return `${Math.max(1, Math.round(days / 30))} tháng`;
  const years = Math.round((days / 365) * 10) / 10;
  return `${String(years).replace('.', ',')} năm`;
}

/** Label shown under each grade button: when the card would come back. */
export function previewIntervals(card: CardState, now: number): Record<Grade, string> {
  const out = {} as Record<Grade, string>;
  for (const g of GRADES) out[g] = formatInterval(grade(card, g, now).due - now);
  return out;
}

/** Anything the queue helpers can order: an id plus an optional rank (missing rank = 0). */
export interface QueueItem {
  id: string;
  rank?: number;
}

export interface QueueOptions {
  newPerDay?: number; // daily limit of new cards (default 10)
  newIntroducedToday?: number; // new cards already started today
  learnAheadMs?: number; // also include cards due within this window, after everything else
}

/**
 * Order of today's work: due reviews (most overdue first), then new cards by rank
 * up to the remaining daily limit, then (optionally) cards due soon (learning steps).
 */
export function buildQueue<T extends QueueItem>(
  chunks: readonly T[],
  states: Readonly<Record<string, CardState | undefined>>,
  now: number,
  opts: QueueOptions = {},
): T[] {
  const newPerDay = opts.newPerDay ?? 10;
  const introduced = opts.newIntroducedToday ?? 0;
  const learnAhead = Math.max(0, opts.learnAheadMs ?? 0);

  const due: { c: T; due: number }[] = [];
  const soon: { c: T; due: number }[] = [];
  const fresh: T[] = [];
  const seen = new Set<string>();

  for (const c of chunks) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const s = states[c.id];
    if (!s) fresh.push(c);
    else if (isDue(s, now)) due.push({ c, due: s.due });
    else if (learnAhead > 0 && s.due <= now + learnAhead) soon.push({ c, due: s.due });
  }

  const rank = (x: T) => x.rank ?? 0;
  const byDue = (a: { c: T; due: number }, b: { c: T; due: number }) =>
    a.due - b.due || rank(a.c) - rank(b.c) || a.c.id.localeCompare(b.c.id);
  due.sort(byDue);
  soon.sort(byDue);
  fresh.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));

  const room = Math.max(0, newPerDay - introduced);
  return [...due.map((x) => x.c), ...fresh.slice(0, room), ...soon.map((x) => x.c)];
}

export type CardStatus = 'new' | 'learning' | 'mature';

export function cardStatus(state: CardState | undefined): CardStatus {
  if (!state) return 'new';
  return state.interval >= MATURE_DAYS ? 'mature' : 'learning';
}

/** Number of started cards (among `chunks`) that are due now. */
export function countDue<T extends { id: string }>(
  chunks: readonly T[],
  states: Readonly<Record<string, CardState | undefined>>,
  now: number,
): number {
  let n = 0;
  for (const c of chunks) {
    const s = states[c.id];
    if (s && isDue(s, now)) n += 1;
  }
  return n;
}

/** Earliest due time strictly after `now` among started cards, or null. */
export function nextDue<T extends { id: string }>(
  chunks: readonly T[],
  states: Readonly<Record<string, CardState | undefined>>,
  now: number,
): number | null {
  let best: number | null = null;
  for (const c of chunks) {
    const s = states[c.id];
    if (s && s.due > now && (best === null || s.due < best)) best = s.due;
  }
  return best;
}
