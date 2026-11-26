// IO of "Chạy taxi cho Rico" (./taxi.ts): the ride under way (this tab only: a reload drops it, nothing was paid
// yet), and the calls Westbay's page makes. Paid fares go into the daily set `heard` of town-progress, xu into its
// `earned` (./store commitTown).

import { useSyncExternalStore } from 'react';
import { TAXI_FARES } from '../../data/city/taxiFares';
import { addEarned, townDay, updateDaily } from './progress';
import { commitTown, loadTownProgress, townDevice } from './store';
import { pickFare, rideSeconds, taxiOptions, taxiPay, type TaxiFare } from './taxi';
import { scenesHeard } from './worldStore';

export interface TaxiRide {
  fare: TaxiFare;
  /** The three places offered (place ids). */
  options: readonly string[];
  /** Times the passenger's words were played. */
  plays: number;
  /** 'ask': listening and picking; 'riding': on the way to the right place; 'wrong': a wrong place was picked; 'done': set down. */
  state: 'ask' | 'riding' | 'wrong' | 'done';
  /** The place picked. */
  pick: string | null;
  /** When the clock runs out (epoch ms), and how long it was (s), once riding. */
  until: number | null;
  seconds: number;
  /** Set when done. */
  result: { xu: number; late: boolean; capped: boolean } | null;
}

let ride: TaxiRide | null = null;
let last: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useTaxiRide(): TaxiRide | null {
  return useSyncExternalStore(subscribe, getTaxiRide, getTaxiRide);
}
export function getTaxiRide(): TaxiRide | null {
  return ride;
}

/** The fare ids paid today on every browser. */
export function taxiPaidToday(now: number = Date.now()): Set<string> {
  return new Set(scenesHeard(loadTownProgress(), townDay(now)).filter((id) => id.startsWith('tx-')));
}

/** Rico sends a passenger (the one under way, if any, stays). */
export function takeFare(now: number = Date.now()): TaxiRide {
  if (ride && (ride.state === 'ask' || ride.state === 'riding')) return ride;
  const fare = pickFare(TAXI_FARES, taxiPaidToday(now), last, Math.floor(now / 1000))!;
  last = fare.id;
  ride = { fare, options: taxiOptions(fare, Math.floor(now / 7000)), plays: 0, state: 'ask', pick: null, until: null, seconds: 0, result: null };
  notify();
  return ride;
}

export function noteTaxiPlay(): void {
  if (ride?.state !== 'ask') return;
  ride = { ...ride, plays: ride.plays + 1 };
  notify();
}

/** The place picked; `tiles` = how far the right one is from the player (straight line), for the clock. */
export function chooseTaxi(placeId: string, tiles: number, now: number = Date.now()): TaxiRide | null {
  if (ride?.state !== 'ask') return ride;
  if (placeId !== ride.fare.to) {
    ride = { ...ride, state: 'wrong', pick: placeId };
  } else {
    const seconds = rideSeconds(tiles);
    ride = { ...ride, state: 'riding', pick: placeId, seconds, until: now + seconds * 1000 };
  }
  notify();
  return ride;
}

/** Set down at the place: paid (on time or late), within the day's allowance. */
export function arriveTaxi(now: number = Date.now()): TaxiRide | null {
  const r = ride;
  if (!r || r.state !== 'riding') return r;
  const late = r.until !== null && now > r.until;
  const pay = taxiPay(r.fare, true, late, r.plays, taxiPaidToday(now));
  if (!pay.capped) {
    const device = townDevice();
    let next = updateDaily(loadTownProgress(), townDay(now), device, (d) => ({ ...d, heard: [...(d.heard ?? []), r.fare.id] }), true);
    if (pay.xu > 0) next = addEarned(next, device, pay.xu);
    commitTown(next, now);
  }
  ride = { ...r, state: 'done', result: { xu: pay.xu, late, capped: pay.capped } };
  notify();
  return ride;
}

/** The ride is over (read, given up, or the page left). */
export function dropTaxi(): void {
  if (!ride) return;
  ride = null;
  notify();
}
