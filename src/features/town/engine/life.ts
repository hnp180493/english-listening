// Everyday life in "Thị trấn" (docs/town.md §7 "Life"), the pure part: what part of the day it is by the GAME's
// clock (since 2026-11-27, docs/town.md §24: the light and the people keep the same hour, a game day being 48 real
// minutes), what a resident feels like doing then, for how long, and how many townsfolk pass through. The sim
// (sim.ts) walks them there and the engine draws it. No randomness of its own: the caller passes `rng`.

import { gameMinutes } from '../../../core/town/sky';

/** What a resident is doing. */
export type Activity =
  /** standing about by their door (their own house, or the boarding house's yard) */
  | 'home'
  /** at home behind a lit window: not on the street */
  | 'inside'
  /** on a bench or the café's stool */
  | 'sit'
  /** talking with another resident, the two side by side */
  | 'chat'
  /** watering a planter, the flowers or the farm field */
  | 'tend'
  /** a line in the pond */
  | 'fish'
  /** reading the notice board */
  | 'read'
  /** at a market stall or the egg kiosk */
  | 'shop'
  /** a brisk loop round the plaza (mornings) */
  | 'jog'
  /** a few tiles' walk and back */
  | 'stroll';

export type DayPart = 'night' | 'morning' | 'work' | 'noon' | 'afternoon' | 'evening' | 'late';

/** Minutes since midnight of the game's clock → the part of the day. */
export function dayPart(minutes: number): DayPart {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (m < 6 * 60) return 'night';
  if (m < 9 * 60) return 'morning';
  if (m < 12 * 60) return 'work';
  if (m < 14 * 60) return 'noon';
  if (m < 17 * 60 + 30) return 'afternoon';
  if (m < 21 * 60 + 30) return 'evening';
  return 'late';
}

/**
 * The time of day that everyday life follows: the GAME's clock (core/town/sky.ts gameMinutes, through the one gate
 * core/town/gameClock.ts gameNow, so a sleep in the hideout moves it too), the hour the sky shows. Only the hour:
 * what is counted per REAL day (the daily tasks and allowances, the weekly get-togethers by the learner's weekday,
 * who comes up to Westbay) keeps reading the real date.
 */
export function lifeMinutes(nowMs: number = Date.now()): number {
  return gameMinutes(nowMs);
}

/**
 * How likely each activity is in each part of the day. 'home' doubles as "at work" in the day: a resident with a
 * house of their own stands by its door, a lodger in the boarding house's yard.
 */
export const DAY_WEIGHTS: Readonly<Record<DayPart, Readonly<Partial<Record<Activity, number>>>>> = {
  night: { inside: 10, sit: 0.6, home: 0.4 },
  morning: { jog: 3, sit: 2.5, tend: 2.5, home: 2, shop: 1, read: 1, stroll: 1, chat: 1.5 },
  work: { home: 5, shop: 2, tend: 1.5, read: 1, stroll: 1.5, chat: 1.5, fish: 0.6, sit: 1.2 },
  noon: { sit: 3.5, chat: 3, shop: 1.5, home: 1.5, stroll: 1, fish: 0.6 },
  afternoon: { home: 4, tend: 1.5, shop: 1.5, chat: 2, stroll: 1.5, fish: 1, read: 0.8, sit: 1 },
  evening: { chat: 4, sit: 3, stroll: 2, fish: 1.5, home: 2, shop: 1, read: 0.6 },
  late: { inside: 6, sit: 1.5, chat: 1.5, home: 1 },
};

/** Each resident has a liking (by their order in the town): it weighs three times as much for them. */
const LIKINGS: readonly Activity[] = ['chat', 'sit', 'tend', 'fish', 'read', 'shop', 'jog', 'stroll', 'tend', 'sit', 'fish', 'chat', 'read'];

export function likingOf(index: number): Activity {
  return LIKINGS[((index % LIKINGS.length) + LIKINGS.length) % LIKINGS.length];
}

export interface PickOptions {
  /** The resident's order in the town (its liking). */
  index: number;
  /** What it may not do now (no seat free, nobody to chat with, the main button points at them: never inside…). */
  not?: ReadonlySet<Activity>;
}

/** A weighted draw of what to do next. Never returns something in `not`; 'home' when nothing else is left. */
export function pickActivity(part: DayPart, rng: () => number, o: PickOptions): Activity {
  const like = likingOf(o.index);
  const entries = (Object.entries(DAY_WEIGHTS[part]) as [Activity, number][])
    .filter(([a]) => !o.not?.has(a))
    .map(([a, w]) => [a, a === like ? w * 3 : w] as const);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return 'home';
  let r = rng() * total;
  for (const [a, w] of entries) {
    r -= w;
    if (r < 0) return a;
  }
  return entries[entries.length - 1][0];
}

/** How long (seconds) an activity lasts once there: long enough to be seen, short enough to keep the town moving. */
export function activitySeconds(a: Activity, rng: () => number): number {
  const span: Record<Activity, [number, number]> = {
    home: [10, 22],
    inside: [40, 90],
    sit: [18, 40],
    chat: [14, 30],
    tend: [10, 20],
    fish: [20, 45],
    read: [6, 12],
    shop: [6, 14],
    jog: [25, 45],
    stroll: [3, 6],
  };
  const [a0, a1] = span[a];
  return a0 + rng() * (a1 - a0);
}

/** How many townsfolk (without a name: they are only passing through) are about in a part of the day. */
export function folkCount(part: DayPart): number {
  return { night: 0, morning: 3, work: 4, noon: 5, afternoon: 4, evening: 5, late: 1 }[part];
}

/** Children play on the plaza in the day and early evening. */
export function kidsOut(part: DayPart): boolean {
  return part === 'work' || part === 'noon' || part === 'afternoon' || part === 'evening';
}
