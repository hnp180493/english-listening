// Westbay's streets as a network with names (docs/town.md §28, docs/gta-plan.md M2): every street of the city's map
// (data/cityWorld.ts paints them as two-tile bands of '=' tiles; their names were only in its comments, now here and in
// docs/city.md §17), the junctions where two cross, which of them have traffic lights, and the compass. The map is
// drawn north up: +x is east, +y is south. Westbay drives on the left: on a street running east–west the eastbound
// lane is the north one, on a street running north–south the northbound lane is the west one.
//
// Pure. The streets are written in the map's first layout and moved by its stretch (CITY_CUTS_X / _Y), like every
// other coordinate of the city; a test checks every tile of every street is still paved.

import { CITY_CUTS_X, CITY_CUTS_Y, CITY_SIZE } from '../../data/cityWorld';
import { axisMap } from '../../data/stretchWorld';

export type Compass = 'north' | 'south' | 'east' | 'west';
export const COMPASS: readonly Compass[] = ['north', 'east', 'south', 'west'];

/** A unit step for a heading (map tiles: +x east, +y south). */
export const STEP: Readonly<Record<Compass, { x: number; y: number }>> = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };
export const OPPOSITE: Readonly<Record<Compass, Compass>> = { north: 'south', south: 'north', east: 'west', west: 'east' };

/** The heading of a move (the larger of its two parts), or null for no move. */
export function compassOf(dx: number, dy: number): Compass | null {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
}

export interface Street {
  id: string;
  /** Its name, as people say it ("Market Street"). */
  name: string;
  /** 'x': it runs east–west (its two lanes are rows `at`, `at + 1`); 'y': north–south (columns `at`, `at + 1`). */
  axis: 'x' | 'y';
  at: number;
  /** Its first and last tile along its length (inclusive). */
  from: number;
  to: number;
  /** Cars drive it (a lane through a square, a park path or the promenade: people only). */
  cars: boolean;
}

export interface Junction {
  id: string;
  /** The top-left tile of its 2 × 2 box. */
  x: number;
  y: number;
  /** The street running east–west through it, and the one running north–south. */
  ew: string;
  ns: string;
  /** Traffic lights: both are car streets and both run on past the box on both sides (a crossing, not a T). */
  lights: boolean;
}

export interface RoadNet {
  size: number;
  streets: readonly Street[];
  junctions: readonly Junction[];
}

/** A street in the first layout of the map (data/cityWorld.ts buildRows `fill`), before the stretch. */
interface RawStreet {
  id: string;
  name: string;
  axis: 'x' | 'y';
  at: number;
  from: number;
  to: number;
  cars: boolean;
}

/** Westbay's streets: the names of docs/city.md §13 and §17. */
const RAW_STREETS: readonly RawStreet[] = [
  { id: 'station-avenue', name: 'Station Avenue', axis: 'x', at: 24, from: 0, to: 67, cars: true },
  { id: 'market-street', name: 'Market Street', axis: 'x', at: 12, from: 14, to: 67, cars: true },
  { id: 'arts-street', name: 'Arts Street', axis: 'x', at: 36, from: 14, to: 67, cars: true },
  { id: 'quay-street', name: 'Quay Street', axis: 'x', at: 54, from: 38, to: 67, cars: true },
  { id: 'pier-road', name: 'Pier Road', axis: 'x', at: 66, from: 38, to: 67, cars: true },
  { id: 'promenade', name: 'the Promenade', axis: 'x', at: 40, from: 4, to: 67, cars: false },
  { id: 'station-road', name: 'Station Road', axis: 'y', at: 14, from: 0, to: 41, cars: true },
  { id: 'bay-road', name: 'Bay Road', axis: 'y', at: 42, from: 0, to: 67, cars: true },
  { id: 'college-road', name: 'College Road', axis: 'y', at: 54, from: 0, to: 67, cars: true },
  { id: 'east-road', name: 'East Road', axis: 'y', at: 66, from: 12, to: 67, cars: true },
  { id: 'fountain-lane', name: 'Fountain Lane', axis: 'y', at: 30, from: 14, to: 41, cars: false },
  { id: 'park-path', name: 'the park path', axis: 'y', at: 8, from: 31, to: 39, cars: false },
];

/** The junctions of a set of streets: wherever an east–west band and a north–south band share a 2 × 2 box. */
export function buildNet(streets: readonly Street[], size: number): RoadNet {
  const junctions: Junction[] = [];
  for (const h of streets.filter((s) => s.axis === 'x'))
    for (const v of streets.filter((s) => s.axis === 'y')) {
      const x = v.at;
      const y = h.at;
      if (x < h.from || x + 1 > h.to || y < v.from || y + 1 > v.to) continue;
      const through = (s: Street, lo: number) => s.from < lo && s.to > lo + 1;
      junctions.push({ id: `${h.id}*${v.id}`, x, y, ew: h.id, ns: v.id, lights: h.cars && v.cars && through(h, x) && through(v, y) });
    }
  return { size, streets, junctions };
}

let westbay: RoadNet | null = null;
/** Westbay's network, on the map as it stands (stretched). */
export function westbayNet(): RoadNet {
  if (westbay) return westbay;
  const mx = axisMap(CITY_CUTS_X);
  const my = axisMap(CITY_CUTS_Y);
  const streets = RAW_STREETS.map((s): Street => {
    const across = s.axis === 'x' ? my : mx;
    const along = s.axis === 'x' ? mx : my;
    // a cut along the street lengthens it (the copies of a column it crosses are paved too)
    return { ...s, at: across(s.at), from: along(s.from), to: along(s.to + 1) - 1 };
  });
  westbay = buildNet(streets, CITY_SIZE);
  return westbay;
}

export const streetById = (net: RoadNet, id: string): Street | undefined => net.streets.find((s) => s.id === id);

/** The street whose band a tile is in (in a junction: the one along `heading`, else the east–west one). */
export function streetAt(net: RoadNet, x: number, y: number, heading?: Compass | null): Street | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const hits = net.streets.filter((s) => (s.axis === 'x' ? ty >= s.at && ty <= s.at + 1 && tx >= s.from && tx <= s.to : tx >= s.at && tx <= s.at + 1 && ty >= s.from && ty <= s.to));
  if (hits.length === 0) return null;
  const want = heading === 'north' || heading === 'south' ? 'y' : 'x';
  return hits.find((s) => s.axis === want) ?? hits[0];
}

/** The junction whose box holds a point. */
export function junctionAt(net: RoadNet, x: number, y: number): Junction | null {
  return net.junctions.find((j) => x >= j.x && x < j.x + 2 && y >= j.y && y < j.y + 2) ?? null;
}

/** The middle of the lane a car going `dir` keeps to on a street (driving on the left). */
export function laneOf(s: Street, dir: Compass): number {
  if (s.axis === 'x') return s.at + (dir === 'east' ? 0.5 : 1.5);
  return s.at + (dir === 'north' ? 0.5 : 1.5);
}

/** The ways a car may leave a junction (along car streets that run on past its box), never back the way it came. */
export function exitsOf(net: RoadNet, j: Junction, from: Compass): Compass[] {
  const out: Compass[] = [];
  const h = streetById(net, j.ew)!;
  const v = streetById(net, j.ns)!;
  if (h.cars && h.to > j.x + 1) out.push('east');
  if (h.cars && h.from < j.x) out.push('west');
  if (v.cars && v.from < j.y) out.push('north');
  if (v.cars && v.to > j.y + 1) out.push('south');
  const back = out.filter((d) => d !== OPPOSITE[from]);
  return back.length > 0 ? back : out;
}

// ───────────────────────── traffic lights ─────────────────────────

export type Light = 'green' | 'amber' | 'red';

/** One cycle of every set of lights (real seconds): east–west green, amber, all red, north–south green, amber, all red. */
export const LIGHT_CYCLE = 26;
const PHASES: readonly [number, Light, Light][] = [
  [10, 'green', 'red'],
  [12, 'amber', 'red'],
  [13, 'red', 'red'],
  [23, 'red', 'green'],
  [25, 'red', 'amber'],
  [26, 'red', 'red'],
];

/**
 * The lights of a junction at a moment: a pure function of the real clock (like core/town/sky.ts: nothing stored, the
 * same on every machine), each junction offset from the next so the city does not change all at once.
 */
export function lightAt(net: RoadNet, j: Junction, nowMs: number): { ew: Light; ns: Light } {
  const i = net.junctions.indexOf(j);
  const s = (((nowMs / 1000 + i * 7) % LIGHT_CYCLE) + LIGHT_CYCLE) % LIGHT_CYCLE;
  const [, ew, ns] = PHASES.find(([end]) => s < end) ?? PHASES[PHASES.length - 1];
  return { ew, ns };
}

/** The light facing somebody going `dir` through a junction with lights (null: no lights there). */
export function lightFor(net: RoadNet, j: Junction, dir: Compass, nowMs: number): Light | null {
  if (!j.lights) return null;
  const l = lightAt(net, j, nowMs);
  return dir === 'east' || dir === 'west' ? l.ew : l.ns;
}

/**
 * Did a move from `a` to `b` go into a junction with lights against a red one? (An amber is never an offence: fair.)
 * The move enters the box when `a` is outside it and `b` inside.
 */
export function ranRed(net: RoadNet, a: { x: number; y: number }, b: { x: number; y: number }, nowMs: number): Junction | null {
  const j = junctionAt(net, b.x, b.y);
  if (!j || !j.lights || junctionAt(net, a.x, a.y) === j) return null;
  const dir = compassOf(b.x - a.x, b.y - a.y);
  if (!dir) return null;
  return lightFor(net, j, dir, nowMs) === 'red' ? j : null;
}
