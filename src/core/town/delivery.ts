// The rules of "Giao hàng cho Emma" (docs/town.md §18), pure. The games of the town belong together: a shift at the
// café makes deliveries (DELIVERY_PER_SHIFT each, DELIVERY_DAY a day); a delivery is for somebody the learner must
// recognise from what Emma SAYS, and the better they know that resident (friendship hearts) the less Emma spells out:
// a stranger is named, an acquaintance is described by their job, a friend by what the learner knows of their life.

import type { Level } from '../types';
import type { DeliveryOrder } from './deliveryTypes';

/** Orders a finished café shift makes, and the most a day carries. */
export const DELIVERY_PER_SHIFT = 2;
export const DELIVERY_DAY = 4;
/** Xu for a delivery handed to the right person; more when Emma was heard once and nobody else was tried. */
export const DELIVERY_XU = 4;
export const DELIVERY_CLEAN_XU = 2;
/** Handed over before the clock ran out (owner, 2026-11-26: a rush like GTA's; startDeliveryClock). */
export const DELIVERY_RUSH_XU = 2;
/** Friendship with the one it was for (once a day each). */
export const DELIVERY_BOND = 8;
/** Wrong people tried before the order goes cold. */
export const DELIVERY_MISSES = 2;

/** Orders still to carry today. */
export function deliveriesLeft(shiftsToday: number, sentToday: number): number {
  return Math.max(0, Math.min(DELIVERY_DAY, Math.max(0, shiftsToday) * DELIVERY_PER_SHIFT) - Math.max(0, sentToday));
}

/** How much Emma spells out for somebody the learner knows this well (friendship hearts). */
export function deliveryLevel(hearts: number): Level {
  return hearts >= 3 ? 3 : hearts >= 1 ? 2 : 1;
}

/**
 * The next order: for a resident who has had none today (`sent`), at the level their friendship asks for (the
 * nearest level they have), by `seed`. Null: everybody has had one today.
 */
export function pickDelivery(orders: readonly DeliveryOrder[], sent: (placeId: string) => boolean, hearts: (placeId: string) => number, seed: number): DeliveryOrder | null {
  const people = [...new Set(orders.map((o) => o.to))].filter((p) => !sent(p)).sort();
  if (people.length === 0) return null;
  const s = Math.floor(Math.abs(seed));
  const to = people[s % people.length];
  const mine = orders.filter((o) => o.to === to);
  const want = deliveryLevel(hearts(to));
  for (const level of [want, want - 1, want + 1, want - 2, want + 2]) {
    const pool = mine.filter((o) => o.level === level);
    if (pool.length > 0) return pool[Math.floor(s / people.length) % pool.length];
  }
  return mine[0] ?? null;
}

/** Xu of a delivery that reached the right person. */
export function deliveryXu(plays: number, misses: number, rush = false): number {
  return DELIVERY_XU + (plays <= 1 && misses === 0 ? DELIVERY_CLEAN_XU : 0) + (rush ? DELIVERY_RUSH_XU : 0);
}

/**
 * Seconds to take an order `tiles` away (straight line, from where the learner stands when Emma's panel closes): about
 * 0.7 s a tile and a little to set off, which a run makes, a ride makes with ease, a stroll to the far side not.
 */
export function deliverySeconds(tiles: number): number {
  return Math.max(25, Math.min(80, Math.round(20 + 0.7 * Math.max(0, tiles))));
}
