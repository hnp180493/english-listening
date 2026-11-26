// IO of "Giao hàng cho Emma" (docs/town.md §18): the order being carried (this tab only: a reload drops it, nothing
// was paid yet), and the calls the town makes. Who had a delivery today is the town-progress daily set `sent`
// (union over browsers); xu and friendship go through ./store commitTown.

import { useSyncExternalStore } from 'react';
import { residentArc } from '../../data/stories';
import { TOWN_PLACES } from '../../data/town';
import { DELIVERIES } from '../../data/townDeliveries';
import { loadTownCafe } from './cafeStore';
import { deliveriesLeft, DELIVERY_BOND, DELIVERY_MISSES, deliveryXu, pickDelivery } from './delivery';
import type { DeliveryOrder } from './deliveryTypes';
import { addFriendPoints, friendHearts } from './friendship';
import { addEarned, dayHas, townDay, updateDaily } from './progress';
import type { StoryLine } from './story';
import { commitTown, loadTownProgress, townDevice } from './store';

export interface Carrying {
  order: DeliveryOrder;
  /** Times Emma's words were played. */
  plays: number;
  /** Wrong people tried. */
  misses: number;
  /** 'carrying': on the way; 'done': handed to the right person; 'cold': too many wrong people. */
  state: 'carrying' | 'done' | 'cold';
  /** The last wrong person tried (their place id), for the note. */
  wrong: string | null;
  /** When the clock runs out (epoch ms; null: not started, the learner is still with Emma), and how long it was (s). */
  until: number | null;
  seconds: number;
  /** Set when done: what it paid (`rush`: in time, its bonus included) and what they said. */
  result: { xu: number; bond: number; rush: boolean; thanks: StoryLine | null } | null;
}

let carrying: Carrying | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The order being carried in this tab (null: none). */
export function useCarrying(): Carrying | null {
  return useSyncExternalStore(subscribe, getCarrying, getCarrying);
}
export function getCarrying(): Carrying | null {
  return carrying;
}

const sentToday = (now: number): string[] => {
  const p = loadTownProgress();
  const day = townDay(now);
  return TOWN_PLACES.map((x) => x.id).filter((id) => dayHas(p, day, 'sent', id));
};

/** Orders Emma still has for the learner today (from the shifts worked today, all browsers). */
export function deliveriesLeftNow(now: number = Date.now()): number {
  const rows = Object.values(loadTownCafe().days[townDay(now)] ?? {});
  return deliveriesLeft(rows.reduce((n, d) => n + d.runs, 0), sentToday(now).length);
}

/** Emma hands over the next order (null: none left today). */
export function takeDelivery(now: number = Date.now()): DeliveryOrder | null {
  if (carrying?.state === 'carrying') return carrying.order;
  if (deliveriesLeftNow(now) <= 0) return null;
  const sent = new Set(sentToday(now));
  const p = loadTownProgress();
  const order = pickDelivery(DELIVERIES, (id) => sent.has(id), (id) => friendHearts(p, id), now);
  if (!order) return null;
  carrying = { order, plays: 0, misses: 0, state: 'carrying', wrong: null, until: null, seconds: 0, result: null };
  notify();
  return order;
}

/** The learner sets off with the order (Emma's panel closed): the clock starts, once. */
export function startDeliveryClock(seconds: number, now: number = Date.now()): void {
  if (carrying?.state !== 'carrying' || carrying.until !== null) return;
  carrying = { ...carrying, seconds, until: now + seconds * 1000 };
  notify();
}

/** Emma's words were played once more. */
export function noteDeliveryPlay(): void {
  if (carrying?.state !== 'carrying') return;
  carrying = { ...carrying, plays: carrying.plays + 1 };
  notify();
}

/**
 * The order is offered to the resident of `placeId`: the right one takes it (xu, friendship once a day, their
 * thanks); a wrong one does not, and after DELIVERY_MISSES of them it has gone cold.
 */
export function handDelivery(placeId: string, now: number = Date.now()): Carrying | null {
  const c = carrying;
  if (!c || c.state !== 'carrying') return c;
  if (placeId !== c.order.to) {
    const misses = c.misses + 1;
    carrying = { ...c, misses, wrong: placeId, state: misses >= DELIVERY_MISSES ? 'cold' : 'carrying' };
    notify();
    return carrying;
  }
  const device = townDevice();
  const day = townDay(now);
  const before = loadTownProgress();
  const rush = c.until !== null && now <= c.until;
  const xu = deliveryXu(c.plays, c.misses, rush);
  let next = addEarned(before, device, xu);
  let bond = 0;
  if (!dayHas(before, day, 'sent', placeId)) {
    const w = addFriendPoints(next, placeId, DELIVERY_BOND, device);
    bond = w.points;
    next = updateDaily(w.progress, day, device, (d) => ({ ...d, sent: [...(d.sent ?? []), placeId] }), false);
  }
  commitTown(next, now);
  const thanks = residentArc(placeId)?.reactions.likes ?? null;
  carrying = { ...c, state: 'done', wrong: null, result: { xu, bond, rush, thanks: thanks && thanks.text.trim() ? thanks : null } };
  notify();
  return carrying;
}

/** The order is put down (delivered and read, gone cold, or given up). */
export function dropDelivery(): void {
  if (!carrying) return;
  carrying = null;
  notify();
}
