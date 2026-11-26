// The police of Westbay, non-violent (docs/town.md §28, docs/gta-plan.md §4.1): an offence on the road raises the heat
// (./heat.ts); above PATROL_AT a patrol car comes looking, along the roads, for what was DESCRIBED (on what, what
// colour, what top), and the scanner says what the police know (./scanner.ts). Getting away: out of the patrol's sight
// for LOSE_AFTER seconds, or no longer looking like the description (another vehicle, off it, another top: the patrol
// does not know you), or a place to cool down (`coolDown`). Caught: stopped, a word with the officer, a fine; no game
// over. Pure: the hook in features/town/streets drives it with the real positions.

import type { VehicleKind } from '../../data/townWorld';
import type { Compass } from './streets';
import type { Pt } from './traffic';

export type Offence = 'red' | 'car' | 'thing';
/** What an offence adds to the heat. */
/** (A red light run brings a patrol by itself: the clearest offence, and the one the lights make fair to see.) */
export const OFFENCE_HEAT: Readonly<Record<Offence, number>> = { red: 3, car: 2, thing: 1 };
/** A patrol comes looking from this heat up. */
export const PATROL_AT = 3;
/** A patrol sees the learner this near (tiles). */
export const SIGHT = 8;
/** Stopped when the patrol is this near, seeing them, for CATCH_TIME seconds. */
export const CATCH_DIST = 1.7;
export const CATCH_TIME = 1.2;
/** Out of sight this long and the search is given up. */
export const LOSE_AFTER = 25;
/** Dispatch says where they were last seen about this often (s). */
export const BULLETIN_EVERY = 16;
/** The patrol's pace (tiles/s): faster than the traffic, slower than a borrowed car (5.6). */
export const PATROL_SPEED = 4.4;
/** Without a search, the heat cools by one this often (s). */
export const COOL_EVERY = 40;

/** How the learner looks to the police: on foot or on what, its colour, the colour of their top (English words). */
export interface Look {
  on: VehicleKind | 'foot';
  colour: string | null;
  outfit: string | null;
}

/** The same person as described: on the same thing (the same colour) and in the same top. */
export function sameLook(described: Look, now: Look): boolean {
  if (described.on !== now.on) return false;
  if (described.on !== 'foot' && described.colour !== now.colour) return false;
  return described.outfit === now.outfit;
}

/** Where the learner is and how they look, as the police would put it. */
export interface Seen extends Pt {
  look: Look;
  /** The street they are on (its name), the way they are going, the place they are near (its spoken name). */
  road: string | null;
  heading: Compass | null;
  near: string | null;
}

export interface Search {
  /** The patrol's call sign number. */
  unit: number;
  /** What was described (the learner at the offence). */
  look: Look;
  offence: Offence;
  /** What was knocked over (an offence of kind 'thing'), in English. */
  thing: string | null;
  /** The last the police knew. */
  last: Seen;
  patrol: Pt & { route: Pt[]; heading: number };
  /** Seconds out of the patrol's sight (or not matching the description). */
  unseen: number;
  /** Seconds within catching distance. */
  close: number;
  /** Seconds to the next bulletin. */
  bulletinIn: number;
}

export type PoliceEvent = 'spotted' | 'bulletin' | 'lost' | 'caught';

export const UNITS: readonly number[] = [7, 12, 15, 20];

/** A search begins: the patrol sets off from `from` (a point on a road out of sight), the learner as they were. */
export function startSearch(me: Seen, offence: Offence, thing: string | null, from: Pt, unit: number): Search {
  return { unit, look: me.look, offence, thing, last: me, patrol: { x: from.x, y: from.y, route: [], heading: 0 }, unseen: 0, close: 0, bulletinIn: BULLETIN_EVERY };
}

/** The patrol sees the learner: near enough, and they still look as described. */
export function sees(s: Pick<Search, 'patrol' | 'look'>, me: Seen): boolean {
  return Math.hypot(me.x - s.patrol.x, me.y - s.patrol.y) <= SIGHT && sameLook(s.look, me.look);
}

/**
 * One step of a search (`dt` seconds): the patrol drives toward where the learner was last known (`route`: along the
 * roads), sees them or not, closes in, gives up. Returns null when the search is over (lost or caught: the events say).
 */
export function policeStep(s0: Search, dt: number, me: Seen, route: (a: Pt, b: Pt) => readonly Pt[]): { search: Search | null; events: PoliceEvent[] } {
  const events: PoliceEvent[] = [];
  const s: Search = { ...s0, patrol: { ...s0.patrol, route: [...s0.patrol.route] } };
  const seeing = sees(s, me);
  if (seeing) {
    if (s.unseen >= 4) events.push('spotted');
    s.unseen = 0;
    // the target moved on: a new way there
    if (Math.hypot(me.x - s.last.x, me.y - s.last.y) > 1.5 || s.patrol.route.length === 0) s.patrol.route = [...route(s.patrol, me)];
    s.last = me;
  } else {
    s.unseen += dt;
    if (s.patrol.route.length === 0 && Math.hypot(s.last.x - s.patrol.x, s.last.y - s.patrol.y) > 1) s.patrol.route = [...route(s.patrol, s.last)];
  }
  if (s.unseen >= LOSE_AFTER) return { search: null, events: [...events, 'lost'] };
  // the patrol drives on, but never onto the learner (it pulls up beside them)
  const gap = Math.hypot(me.x - s.patrol.x, me.y - s.patrol.y);
  let go = gap <= CATCH_DIST * 0.8 && seeing ? 0 : PATROL_SPEED * dt;
  while (go > 0 && s.patrol.route.length > 0) {
    const q = s.patrol.route[0];
    const d = Math.hypot(q.x - s.patrol.x, q.y - s.patrol.y);
    if (d > 1e-6) s.patrol.heading = Math.atan2(q.y - s.patrol.y, q.x - s.patrol.x);
    if (d <= go) {
      s.patrol.x = q.x;
      s.patrol.y = q.y;
      s.patrol.route.shift();
      go -= d;
    } else {
      s.patrol.x += ((q.x - s.patrol.x) / d) * go;
      s.patrol.y += ((q.y - s.patrol.y) / d) * go;
      go = 0;
    }
  }
  s.close = seeing && Math.hypot(me.x - s.patrol.x, me.y - s.patrol.y) <= CATCH_DIST ? s.close + dt : 0;
  if (s.close >= CATCH_TIME) return { search: null, events: [...events, 'caught'] };
  s.bulletinIn -= dt;
  if (s.bulletinIn <= 0) {
    s.bulletinIn = BULLETIN_EVERY;
    events.push('bulletin');
  }
  return { search: s, events };
}

/** The heat after an offence (never above 10). */
export function heatAfterOffence(heat: number, o: Offence): number {
  return Math.min(10, Math.max(0, heat) + OFFENCE_HEAT[o]);
}

/** Got away (lost the patrol): the heat drops under the patrol's line, so it does not start again at once. */
export const heatAfterLost = (heat: number): number => Math.min(heat, PATROL_AT - 1);

/** The fine when stopped (xu): 30 + 10 a point of heat, 120 at most; three quarters when the officer's question was
 * answered (still 30 at least); never more than the learner has. */
export function fineFor(heat: number, answered: boolean, balance: number): number {
  const full = Math.max(30, Math.min(120, 30 + 10 * Math.max(0, heat)));
  const due = answered ? Math.max(30, Math.round(full * 0.75)) : full;
  return Math.max(0, Math.min(due, Math.floor(balance)));
}

/** A point on a road to start a patrol from: of `candidates` (junction middles), the first between 16 and 34 tiles away (else the farthest). */
export function patrolStart(me: Pt, candidates: readonly Pt[], pick: number): Pt {
  const ok = candidates.filter((c) => {
    const d = Math.hypot(c.x - me.x, c.y - me.y);
    return d >= 16 && d <= 34;
  });
  if (ok.length > 0) return ok[Math.abs(Math.floor(pick)) % ok.length];
  return [...candidates].sort((a, b) => Math.hypot(b.x - me.x, b.y - me.y) - Math.hypot(a.x - me.x, a.y - me.y))[0] ?? me;
}
