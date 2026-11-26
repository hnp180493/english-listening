// Westbay's traffic (docs/town.md §28): a few cars driving the car streets of the network (./streets.ts), keeping to
// their lane (on the left), turning at junctions, stopping at a red or amber light, and stopping for anybody or
// anything in front of them. Pure: a step is a function of the cars, the seconds gone by, the clock (for the lights)
// and the bodies on the road; the stage draws what it returns (features/town/three/scene/traffic.ts).
//
// The rule that keeps a moving thing from trapping the player: a car never moves its front closer to a body than
// BODY_GAP. It waits instead (the player can always walk off; a car stopped in its lane leaves the other lane open).

import { compassOf, exitsOf, junctionAt, laneOf, lightFor, OPPOSITE, STEP, streetById, type Compass, type Junction, type RoadNet, type Street } from './streets';

export interface TrafficCar {
  id: number;
  x: number;
  y: number;
  dir: Compass;
  street: string;
  /** Tiles a second now. */
  speed: number;
  /** Which colour (the vehicle models' index). */
  v: number;
  /** The way out of the junction ahead, once chosen (null: not chosen yet). */
  next: Compass | null;
  /** The junction it is turning in (so a turn happens once). */
  turning: string | null;
}

export interface Pt {
  x: number;
  y: number;
}

/** Cruising pace (tiles/s): under a borrowed car's 5.6, so the learner can pass. */
export const TRAFFIC_SPEED = 3.2;
const ACCEL = 4;
const BRAKE = 9;
/** A car's length on the road (tiles, as drawn at the avatars' scale) and the gap it keeps behind another. */
export const CAR_LEN = 1.45;
const CAR_GAP = 0.6;
/** A car's front stops this far from a body (centre to the front of the car, tiles). */
export const BODY_GAP = 1.1;
/** Side to side, a body this close to a lane's middle is in the car's way. */
const LANE_HALF = 0.75;
/** A car stops this far before a junction's box on red. */
const STOP_LINE = 0.25;

const along = (dir: Compass, p: Pt): number => (dir === 'east' ? p.x : dir === 'west' ? -p.x : dir === 'south' ? p.y : -p.y);
const across = (dir: Compass, p: Pt): number => (dir === 'east' || dir === 'west' ? p.y : p.x);

/** The junctions on a street ahead of a car (nearest first), as the distance from the car's front to each box's near edge. */
function junctionsAhead(net: RoadNet, c: TrafficCar): { j: Junction; d: number }[] {
  const front = along(c.dir, c) + CAR_LEN / 2;
  const out: { j: Junction; d: number }[] = [];
  for (const j of net.junctions) {
    if (j.ew !== c.street && j.ns !== c.street) continue;
    const box = c.dir === 'east' ? j.x : c.dir === 'west' ? -(j.x + 2) : c.dir === 'south' ? j.y : -(j.y + 2);
    const d = box - front;
    if (d >= -0.05) out.push({ j, d });
  }
  return out.sort((a, b) => a.d - b.d);
}

/** Where a street ends ahead of a car (the distance from its front to the end of the paving). */
function endAhead(s: Street, c: TrafficCar): number {
  const front = along(c.dir, c) + CAR_LEN / 2;
  const end = c.dir === 'east' || c.dir === 'south' ? s.to + 1 : -s.from;
  return end - front;
}

/** The distance from a car's front to the nearest thing in its lane ahead (another car, a body), or Infinity. */
export function clearAhead(c: TrafficCar, cars: readonly TrafficCar[], bodies: readonly Pt[], net?: RoadNet): number {
  const me = along(c.dir, c) + CAR_LEN / 2;
  const lane = across(c.dir, c);
  let best = Infinity;
  const inBox = (p: Pt) => net && !!junctionAt(net, p.x, p.y);
  for (const o of cars) {
    if (o === c) continue;
    // a car across the way counts while it is across this lane; one already in a junction box clears it first
    const perp = (o.dir === 'east' || o.dir === 'west') !== (c.dir === 'east' || c.dir === 'west');
    if (perp && inBox(c)) continue;
    if (Math.abs(across(c.dir, o) - lane) > (perp ? CAR_LEN / 2 + 0.35 : 0.55)) continue;
    const back = along(c.dir, o) - (perp ? 0.45 : CAR_LEN / 2);
    const d = back - me - CAR_GAP;
    if (along(c.dir, o) > along(c.dir, c) && d < best) best = d;
  }
  for (const b of bodies) {
    if (Math.abs(across(c.dir, b) - lane) > LANE_HALF) continue;
    const d = along(c.dir, b) - along(c.dir, c) - BODY_GAP;
    if (along(c.dir, b) > along(c.dir, c) - 0.2 && d < best) best = d;
  }
  return best;
}

/** Cars on the car streets at the start: spread along them, in their lanes, by `seed`. */
export function seedTraffic(net: RoadNet, n: number, seed: number): TrafficCar[] {
  let r = Math.abs(Math.floor(seed)) % 2147483647 || 7;
  const rnd = () => (r = (r * 48271) % 2147483647) / 2147483647;
  const streets = net.streets.filter((s) => s.cars);
  const out: TrafficCar[] = [];
  for (let i = 0; i < n * 8 && out.length < n; i++) {
    const s = streets[i % streets.length];
    const dirs: Compass[] = s.axis === 'x' ? ['east', 'west'] : ['north', 'south'];
    const dir = dirs[Math.floor(rnd() * 2)];
    const t = s.from + 2 + rnd() * (s.to - s.from - 3);
    const lane = laneOf(s, dir);
    const p = s.axis === 'x' ? { x: t, y: lane } : { x: lane, y: t };
    // not in a junction, not on top of another
    if (junctionAt(net, p.x, p.y) || out.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < CAR_LEN * 2.5)) continue;
    out.push({ id: out.length, ...p, dir, street: s.id, speed: TRAFFIC_SPEED * 0.6, v: Math.floor(rnd() * 3), next: null, turning: null });
  }
  return out;
}

/** Context of a step: the network, the clock (ms) for the lights, the bodies on the road, a random source for turns. */
export interface TrafficCtx {
  net: RoadNet;
  nowMs: number;
  bodies: readonly Pt[];
  rnd: () => number;
}

/** One car one step (the others as they were at the start of the step). */
function stepCar(c0: TrafficCar, dt: number, all: readonly TrafficCar[], ctx: TrafficCtx): TrafficCar {
  const c = { ...c0 };
  const s = streetById(ctx.net, c.street);
  if (!s) return c;
  // how far it may go: the way clear ahead, a light, the end of the street
  let room = clearAhead(c0, all, ctx.bodies, ctx.net);
  const inBox = junctionAt(ctx.net, c.x + STEP[c.dir].x * (CAR_LEN / 2), c.y + STEP[c.dir].y * (CAR_LEN / 2));
  const ahead = junctionsAhead(ctx.net, c)[0];
  if (ahead && !inBox) {
    const light = lightFor(ctx.net, ahead.j, c.dir, ctx.nowMs);
    if (light === 'red' || (light === 'amber' && ahead.d > 0.8)) room = Math.min(room, ahead.d - STOP_LINE);
  }
  // speed: brake to stop within the room, else up to the cruise
  const want = room <= 0.02 ? 0 : Math.min(TRAFFIC_SPEED, Math.sqrt(2 * BRAKE * Math.max(0, room)));
  c.speed = want < c.speed ? Math.max(want, c.speed - BRAKE * dt) : Math.min(want, c.speed + ACCEL * dt);
  let go = Math.min(c.speed * dt, Math.max(0, room));
  if (go <= 0) {
    c.speed = 0;
    return c;
  }
  // a dead end ahead (no junction before the street's end): turn round in the street
  const end = endAhead(s, c);
  if (end < 0.4 && (!ahead || ahead.d > end)) {
    c.dir = OPPOSITE[c.dir];
    const lane = laneOf(s, c.dir);
    if (s.axis === 'x') c.y = lane;
    else c.x = lane;
    c.next = null;
    return c;
  }
  // into a junction: choose the way out, and turn where the new lane crosses
  const box = junctionAt(ctx.net, c.x, c.y);
  if (box && c.turning !== box.id) {
    if (c.next === null) {
      const exits = exitsOf(ctx.net, box, c.dir);
      c.next = exits[Math.floor(ctx.rnd() * exits.length) % exits.length] ?? c.dir;
    }
    if (c.next === OPPOSITE[c.dir]) {
      // nowhere else to go: round in the box, into the other lane
      c.dir = c.next;
      const lane = laneOf(s, c.dir);
      if (s.axis === 'x') c.y = lane;
      else c.x = lane;
      c.turning = box.id;
      c.next = null;
      return c;
    }
    if (c.next !== c.dir) {
      const into = streetById(ctx.net, c.next === 'east' || c.next === 'west' ? box.ew : box.ns)!;
      const at = laneOf(into, c.next);
      const pos = c.dir === 'east' || c.dir === 'west' ? c.x : c.y;
      const sign = c.dir === 'east' || c.dir === 'south' ? 1 : -1;
      const left = (at - pos) * sign;
      if (left <= go) {
        if (c.dir === 'east' || c.dir === 'west') c.x = at;
        else c.y = at;
        go -= Math.max(0, left);
        c.dir = c.next;
        c.street = into.id;
        c.turning = box.id;
        c.next = null;
      }
    } else {
      c.turning = box.id;
      c.next = null;
    }
  }
  if (!box) c.turning = null;
  c.x += STEP[c.dir].x * go;
  c.y += STEP[c.dir].y * go;
  return c;
}

/** All the cars one step (`dt` seconds). */
export function stepTraffic(cars: readonly TrafficCar[], dt: number, ctx: TrafficCtx): TrafficCar[] {
  return cars.map((c) => stepCar(c, Math.max(0, Math.min(0.1, dt)), cars, ctx));
}

/** The circles a car is to a walker (its middle and both ends): what the stage gives the sim as bodies. */
export function carCircles(c: Pick<TrafficCar, 'x' | 'y' | 'dir'>): Pt[] {
  const d = STEP[c.dir];
  const k = CAR_LEN / 2 - 0.32;
  return [
    { x: c.x - d.x * k, y: c.y - d.y * k },
    { x: c.x, y: c.y },
    { x: c.x + d.x * k, y: c.y + d.y * k },
  ];
}

/** A walker's gap from a car's circles and from the patrol (tiles, centre to centre). */
export const CAR_BODY_GAP = 0.55;

/**
 * What stands in a walker's way at `p` this frame: every car's circles and the patrol, LEFT OUT when the walker is
 * already inside one (a car turning across them, the patrol pulling up): nothing that moves can shut them in. The
 * fixed things (`posts`) are given as they are.
 */
export function blockersFor(p: Pt, cars: readonly Pick<TrafficCar, 'x' | 'y' | 'dir'>[], patrol: Pt | null, posts: readonly (Pt & { gap: number })[]): (Pt & { gap: number })[] {
  const inside = (b: Pt & { gap: number }) => Math.hypot(b.x - p.x, b.y - p.y) < b.gap - 0.05;
  const out: (Pt & { gap: number })[] = [];
  for (const c of cars) {
    const circles = carCircles(c).map((q) => ({ ...q, gap: CAR_BODY_GAP }));
    if (!circles.some(inside)) out.push(...circles);
  }
  if (patrol) {
    const b = { x: patrol.x, y: patrol.y, gap: CAR_BODY_GAP };
    if (!inside(b)) out.push(b);
  }
  return [...out, ...posts];
}

/** The heading of a car as an angle on the map (radians, 0 = east, +y south). */
export const carAngle = (dir: Compass): number => Math.atan2(STEP[dir].y, STEP[dir].x);

export { compassOf };
