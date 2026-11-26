// "Chạy taxi cho Rico" in Westbay (docs/town.md §21; content data/city/taxiFares.ts): the rules. A passenger SAYS
// where to go; the learner picks the place among three, then drives (or walks, or runs) there before the clock runs
// out. Pure: the IO is ./taxiStore.ts. What paid today is the daily set `heard` of town-progress (fare ids `tx-…`),
// like the scenes of the world (./world.ts), so nothing new is stored or synced.

import type { Level } from '../types';

export interface TaxiFare {
  /** Stable id `tx-<n>`. Never change it. */
  id: string;
  level: Level;
  /** The browser voice that says it (the city's people never have clips). */
  gender: 'male' | 'female';
  /** What the passenger says: everyday spoken English, 6–24 words. Names or implies the place. */
  text: string;
  /** Natural Vietnamese meaning (shown after the answer). */
  vi: string;
  /** Authored connected spelling, when the generated one would be wrong. */
  say?: string;
  /** Where to (a place id of data/cityWorld.ts; never 'rico'). */
  to: string;
  /** The two wrong places offered: what a careless ear would take instead. */
  near: readonly [string, string];
}

/** Fares that pay in a day (the rest still play, for nothing). */
export const TAXI_PAID_A_DAY = 8;
/** On time. */
export const TAXI_XU = 5;
/** On time, and the passenger was heard once only. */
export const TAXI_FIRST_XU = 1;
/** There, but after the clock ran out. */
export const TAXI_LATE_XU = 2;
/** Close enough to the place's door to set the passenger down (tiles). */
export const TAXI_ARRIVE = 2.2;

/**
 * Seconds to get there from `tiles` away (straight line): a little to set off, then about half a second a tile, which
 * a borrowed car or one's own vehicle makes with ease, running only just, walking not.
 */
export function rideSeconds(tiles: number): number {
  return Math.max(20, Math.min(70, Math.round(15 + 0.5 * Math.max(0, tiles))));
}

/** The three places offered, in an order fixed by `seed` (the right one not always first). */
export function taxiOptions(fare: TaxiFare, seed: number): string[] {
  const all = [fare.to, ...fare.near];
  const k = ((Math.floor(seed) % 3) + 3) % 3;
  return [...all.slice(k), ...all.slice(0, k)];
}

/** The next fare: one not paid today and not the last one, by `seed`; else any but the last. */
export function pickFare(fares: readonly TaxiFare[], paidToday: ReadonlySet<string>, last: string | null, seed: number): TaxiFare | null {
  const fresh = fares.filter((f) => !paidToday.has(f.id) && f.id !== last);
  const pool = fresh.length > 0 ? fresh : fares.filter((f) => f.id !== last);
  if (pool.length === 0) return fares[0] ?? null;
  const s = Math.abs(Math.floor(seed));
  return pool[s % pool.length];
}

export interface TaxiPay {
  xu: number;
  /** Nothing paid because today's fares were all paid already, or this one was. */
  capped: boolean;
}

/** What a ride pays: `paidToday` = the fare ids paid today (all browsers). A wrong place pays nothing. */
export function taxiPay(fare: Pick<TaxiFare, 'id'>, right: boolean, late: boolean, plays: number, paidToday: ReadonlySet<string>): TaxiPay {
  if (!right) return { xu: 0, capped: false };
  const paid = [...paidToday].filter((id) => id.startsWith('tx-')).length;
  if (paidToday.has(fare.id) || paid >= TAXI_PAID_A_DAY) return { xu: 0, capped: true };
  return { xu: late ? TAXI_LATE_XU : TAXI_XU + (plays <= 1 ? TAXI_FIRST_XU : 0), capped: false };
}
