// A patrol a job calls (docs/town.md §28 "A job's patrol"; Act II, docs/gta-story-2.md §7): a police car that drives
// one named street of Westbay once, at a moment the job chooses, while the scanner says lines the job wrote. What the
// job gets back is whether the learner was SEEN: within the patrol's sight (police.ts SIGHT) for longer than a short
// grace, never while indoors (a room, the hideout). It never stops or fines anybody: the job decides what follows.
// While it runs, the heat and the ordinary search wait (`coolStep` with `paused`). Pure: the streets layer
// (features/town/streets/jobPolice.ts) drives it with the real positions.

import { SIGHT } from './police';
import { junctionAt, laneOf, streetById, type Compass, type RoadNet, type Street } from './streets';
import type { Pt } from './traffic';

/** Seen only after this long in sight without a break (s): a glimpse across a junction is not being seen. */
export const SEEN_GRACE = 0.8;

/**
 * Where a job's patrol comes from and goes to: an end of the street by its compass side ('west' = its west end), or a
 * street that crosses it (the junction's middle). Left out: from the street's first end to its other.
 */
export type PatrolEnd = Compass | string;

export interface JobPatrolSpec {
  /** The street's id or its name (core/town/streets.ts: 'market-street' or 'Market Street'). */
  street: string;
  from?: PatrolEnd;
  to?: PatrolEnd;
  /** How long the drive takes (s). */
  seconds: number;
}

export interface PatrolPath {
  street: Street;
  from: Pt;
  to: Pt;
  /** The way it drives, and the heading as a map angle (radians, 0 = east, +y south). */
  dir: Compass;
  heading: number;
}

/** The street by id or name (null: no such street, or one cars do not drive). */
export function findStreet(net: RoadNet, key: string): Street | null {
  const k = key.trim().toLowerCase();
  const s = net.streets.find((x) => x.id === k || x.name.toLowerCase() === k || x.name.toLowerCase() === `the ${k}`) ?? null;
  return s && s.cars ? s : null;
}

/** The position along a street (its own axis) of one end of a patrol, or null when it does not name one. */
function endAlong(net: RoadNet, s: Street, end: PatrolEnd): number | null {
  const low = s.from + 0.5;
  const high = s.to + 0.5;
  if (end === 'west' || end === 'north') return low;
  if (end === 'east' || end === 'south') return high;
  const cross = findStreet(net, end) ?? streetById(net, end) ?? net.streets.find((x) => x.name.toLowerCase() === end.trim().toLowerCase());
  if (!cross || cross.axis === s.axis) return null;
  const j = net.junctions.find((x) => (s.axis === 'x' ? x.ew === s.id && x.ns === cross.id : x.ns === s.id && x.ew === cross.id));
  if (!j) return null;
  return (s.axis === 'x' ? j.x : j.y) + 1;
}

/** The patrol's way: along the lane of its direction (Westbay drives on the left), one end to the other. Null: no such street or end. */
export function patrolPath(net: RoadNet, spec: Pick<JobPatrolSpec, 'street' | 'from' | 'to'>): PatrolPath | null {
  const s = findStreet(net, spec.street);
  if (!s) return null;
  const a = endAlong(net, s, spec.from ?? (s.axis === 'x' ? 'west' : 'north'));
  // no `to`: on to the far end of the street from where it came in
  const low = s.from + 0.5;
  const high = s.to + 0.5;
  const b = spec.to !== undefined ? endAlong(net, s, spec.to) : a === null ? null : Math.abs(a - low) > Math.abs(a - high) ? low : high;
  if (a === null || b === null || Math.abs(b - a) < 1) return null;
  const dir: Compass = s.axis === 'x' ? (b > a ? 'east' : 'west') : b > a ? 'south' : 'north';
  const lane = laneOf(s, dir);
  const pt = (t: number): Pt => (s.axis === 'x' ? { x: t, y: lane } : { x: lane, y: t });
  const heading = dir === 'east' ? 0 : dir === 'west' ? Math.PI : dir === 'south' ? Math.PI / 2 : -Math.PI / 2;
  return { street: s, from: pt(a), to: pt(b), dir, heading };
}

/** Where the patrol is `t` seconds into a drive of `seconds` (it stays at the end once there). */
export function patrolAt(path: PatrolPath, t: number, seconds: number): Pt {
  const k = seconds <= 0 ? 1 : Math.max(0, Math.min(1, t / seconds));
  return { x: path.from.x + (path.to.x - path.from.x) * k, y: path.from.y + (path.to.y - path.from.y) * k };
}

/** The learner as a job's patrol sees them: where, and whether they are indoors (never seen there). */
export interface Watched extends Pt {
  indoors: boolean;
}

export interface JobPatrolRun {
  path: PatrolPath;
  seconds: number;
  t: number;
  /** Seconds in sight without a break, now. */
  inSight: number;
  seen: boolean;
}

export function startJobPatrol(path: PatrolPath, seconds: number): JobPatrolRun {
  return { path, seconds: Math.max(1, seconds), t: 0, inSight: 0, seen: false };
}

/** In the patrol's sight: near enough (police.ts SIGHT) and out of doors. */
export function inSight(patrol: Pt, me: Watched): boolean {
  return !me.indoors && Math.hypot(me.x - patrol.x, me.y - patrol.y) <= SIGHT;
}

/** One step of a job's patrol: it drives on, and the learner is seen once in sight longer than the grace. */
export function jobPatrolStep(run: JobPatrolRun, dt: number, me: Watched): { run: JobPatrolRun; at: Pt; done: boolean } {
  const t = run.t + Math.max(0, dt);
  const at = patrolAt(run.path, t, run.seconds);
  const inside = inSight(at, me);
  const held = inside ? run.inSight + dt : 0;
  const next = { ...run, t, inSight: held, seen: run.seen || held > SEEN_GRACE };
  return { run: next, at, done: t >= run.seconds };
}

/** The heat's clock without a search (it cools by one every `every` s) — held still while a job's patrol runs. */
export function coolStep(heat: number, cool: number, dt: number, searching: boolean, paused: boolean, every: number): { heat: number; cool: number } {
  if (paused) return { heat, cool };
  if (searching || heat <= 0) return { heat, cool: 0 };
  const c = cool + dt;
  return c >= every ? { heat: heat - 1, cool: 0 } : { heat, cool: c };
}

/** A point on the patrol's path is on the street (for the tests and a check in dev). */
export const onStreet = (net: RoadNet, p: Pt): boolean => !!junctionAt(net, p.x, p.y) || net.streets.some((s) => (s.axis === 'x' ? p.y >= s.at && p.y < s.at + 2 && p.x >= s.from && p.x < s.to + 1 : p.x >= s.at && p.x < s.at + 2 && p.y >= s.from && p.y < s.to + 1));
