// The living part of the town, without any drawing: where the player, the residents and the cat are, how they walk
// along a path, when a resident wanders, and "walk there, then call back". Plain TypeScript; time comes in as `dt`
// seconds and randomness as a function, so tests can run it step by step.
//
// How people move (docs/town.md §7 "Motion"): speeds are GROUND speeds (tiles per second, the same whichever way on
// the screen); a click walk follows the A* path pulled straight wherever the way is clear (smoothPath), so a walk
// across the plaza is one line, not a staircase; the walk cycle is driven by the distance covered (`phase`, one cycle
// per `stride` tiles), so the feet do not slide; a walk eases in and out; a person turns 45° at a time (`oct` →
// `want`), never in one frame, and a direction needs a clear lead, or a moment, before the sprite changes
// (hysteresis); the last stride is fitted so the step lands as the body stops (`land`); walks go round people and a
// resident waits for somebody in the way (`giveWay`).

import { canStep, findPath, nearestWalkable, NEIGHBOURS, sameTile, STEP_STRAIGHT, walkable } from '../../../core/town/map';
import { TOWN_WORLD, type PlaceId, type Tile, type TownWorld, type WorldPlace } from '../../../data/townWorld';
import { CAT_STRIDE, personStride } from './gait';
import type { TownTheme } from './palette';

/**
 * What floats over a resident's tag: 'new' lines not understood yet, 'repeat' only repeats left, 'heart' all
 * understood on the first listen; 'story' an episode of "Chuyện ở thị trấn" to hear, 'relisten' one due again.
 */
export type Marker = 'new' | 'repeat' | 'heart' | 'story' | 'relisten';

/** Everything the stage is told from outside: plain data the game shell computes. */
export interface StageState {
  /** Ids of the places that are built (the others are empty lots, and their residents are not in town). */
  built: readonly string[];
  /**
   * Empty lots shown as construction sites (with their price): the next ones the learner works toward. The others
   * are plain nature until they come up. Left out = every empty lot is a site.
   */
  sites?: readonly string[];
  /** Ids of the decorations bought. */
  decorations: readonly string[];
  /** Per place, 0..1: how much of its windows glow (the share of its lines understood). */
  lit: Readonly<Record<string, number>>;
  /** Per place: what floats over its resident's head. */
  marker: Readonly<Record<string, Marker>>;
  theme: TownTheme;
}

export type ActorKind = 'player' | 'resident' | 'cat';

export interface Actor {
  id: string;
  kind: ActorKind;
  /** Position on the tile grid (the centre of tile (3,4) is (3.5, 4.5)). */
  x: number;
  y: number;
  /** The tile it stands on (while walking: the tile under it). */
  tile: Tile;
  /** Points still to walk to, in order (tile centres; a click walk keeps only the corners of its path). */
  path: Tile[];
  /** Full pace, ground tiles per second. */
  speed: number;
  /** Pace now (eases up from a stand and down to a stop), tiles per second. */
  v: number;
  /** Ground tiles one walk cycle covers (gait.ts). */
  stride: number;
  /** Where it walks or looks, as a step on the tile grid (any length): (1, 1) = towards the viewer. */
  heading: Tile;
  /** 1 = looks right on the screen, -1 = left. */
  facing: 1 | -1;
  /** The way the sprite looks: an octant of the tile grid (OCTANTS: 0 = +x = SE on the screen, 1 = S …). */
  oct: number;
  /** The octant it is turning to, one 45° step at a time (TURN_STEP). */
  want: number;
  /** Seconds until the next 45° step of a turn. */
  turnIn: number;
  /** Walking: a new nearest octant that is not clearly ahead yet, and how long it has been nearest (`look`). */
  pend: number;
  pendFor: number;
  /** On its way along a path (the body may still be turning before it sets off). */
  moving: boolean;
  /** The body stopped, the legs still close the step (the walk cycle runs on to legs-together). */
  stepping: boolean;
  /** Grows with the distance walked: drives the walk cycle (2π per stride). */
  phase: number;
  /**
   * The last stride of a walk: the cycle is stretched or squeezed a little (by the distance left) so that the step
   * lands, legs together (`target`, a multiple of π), just as the body stops at `end`.
   */
  land: { end: Tile; left0: number; phase0: number; target: number } | null;
  /** Setting off: the legs lift at a least cadence while the body is still slow (no gliding on closed legs). */
  starting: boolean;
  /** Seconds it has waited for somebody in the way (residents and the cat). */
  waited: number;
  /** Seconds standing since the last walk. */
  rest: number;
  /** Sim time this stand began: the idle loop starts there. */
  restSince: number;
  /** Turn three-quarters to the viewer once it has stood SETTLE_AFTER seconds (set at the end of a walk). */
  autoSettle: boolean;
}

export interface Resident extends Actor {
  kind: 'resident';
  place: WorldPlace;
  /** Seconds until the next little walk (or the walk back home). */
  wanderIn: number;
  /** Seconds until they look round (or back to the front) while standing. */
  lookIn: number;
  /** Held in place (the player is coming to talk, or is talking). */
  engaged: boolean;
  /** A heading (octant) a stroll was given up on, not tried again until `until` (sim time). */
  avoid: { oct: number; until: number } | null;
  /** Seconds standing too near somebody else (they move off after a moment). */
  closeFor: number;
}

export interface Cat extends Actor {
  kind: 'cat';
  /** Seconds it keeps sitting. */
  sitFor: number;
  /** 0 = standing … 1 = seated: sitting down and getting up take CAT_SIT_TIME (drawn with the `down` frames). */
  sit: number;
  /** Sim time it finished sitting down (the tail's loop starts there). */
  sitSince: number;
  /** Seconds somebody has stood right by it while it sits (it gets up and goes after a moment). */
  closeFor: number;
}

export type Arrival = { kind: 'talk'; placeId: PlaceId } | { kind: 'lot'; placeId: PlaceId } | { kind: 'tile'; tile: Tile };

interface Errand {
  target: Tile;
  arrival: Arrival;
  then?: () => void;
}

/** Ground speeds, tiles per second: the player walks briskly, residents stroll (each ±10%), the cat pads along. */
export const PLAYER_SPEED = 2.2;
export const RESIDENT_SPEED = 0.8;
export const CAT_SPEED = 0.75;
/** From standing to full pace, and from full pace to a stop, seconds. */
export const START_TIME = 0.14;
export const STOP_TIME = 0.28;
/** A turn takes this long per 45° (the first step at once): walking (or about to), and standing (an easy turn). */
export const TURN_STEP = 0.07;
export const TURN_STEP_STAND = 0.12;
/** Standing this long after a walk, a person turns three-quarters to the viewer (the turn starts as the step lands). */
export const SETTLE_AFTER = 0.12;
/**
 * Walking, the sprite changes direction at once when the way lies more than HYSTERESIS degrees past the edge of its
 * octant; nearer the edge, only once the new octant has been the nearest for HYSTERESIS_TIME seconds (no flicker on a
 * zig-zag, and no walking crabwise along a long straight line either).
 */
const HYSTERESIS = 12;
export const HYSTERESIS_TIME = 0.14;
/** Legs close the step at this many cycles per second after the body stopped (only when the last stride could not land). */
const CLOSE_RATE = 2.4;
/** A stride less than this far begun (share of a step) when the body stops goes back down instead of on. */
const CLOSE_BACK = 0.3;
/** Setting off, the legs move at least this many cycles per second while the body is still slow. */
const START_CADENCE = 0.6;
/**
 * Setting off from a stand the other way, a person turns on the spot first, this long per 45° (the first step at
 * once), and walks once the way is within 45°: no spinning while already sliding off.
 */
export const TURN_STEP_START = 0.09;
/** A tile within this (tiles) of a person costs a path finder detour: their own tile. */
const PERSONAL = 0.6;
/**
 * A path finder takes a detour of up to about four steps round somebody standing on its way (in open ground that is
 * one step); a longer one, it goes that way and they step aside when the walker comes (TownSim.stepAside). In the
 * path finder's own units, screen px (map.ts findPath `extra`): it was once 8 px, under a quarter of a step, so
 * walks went straight through the tile where somebody stood and shoved them aside even on the open plaza.
 */
const DETOUR = 4 * STEP_STRAIGHT;
/** A straight line of a walk passes nobody nearer than this (tiles). */
export const PASS = 0.55;
/**
 * Somebody within LOOK tiles ahead, and less than SIDE to the side of the way: a walker slows to a stand and waits
 * (stopping about 0.8 tile short of them). A resident or the cat gives the walk up after WAIT_STILL seconds behind
 * somebody standing, WAIT_MOVING behind somebody walking (they will pass).
 */
const LOOK = 0.9;
const SIDE = 0.5;
/** Nobody ever steps nearer than this (tiles) to somebody else (TownSim.step): two figures about 0.45 wide. */
const MIN_GAP = 0.5;
/** A walk does not end nearer somebody than this (tiles): they are seen this far past its end. */
const END_ROOM = 0.6;
/** How far ahead in time (seconds) a walker sees somebody walking across its way. */
const AHEAD = 0.4;
const WAIT_STILL = 0.4;
const WAIT_MOVING = 1.2;
/**
 * The player's click walk has waited this long (seconds) behind somebody with no way round them and nobody stepping
 * aside (a one-tile road with people in it): it squeezes past that one person instead of standing there for good.
 */
const SQUEEZE_AFTER = 1.5;
/** A heading a walk was given up on is not tried again for this long (seconds): no turn, freeze, turn back loop. */
const AVOID_FOR = 4;
/** Where somebody rests (a stroll's end, the cat's seat), nobody else stands nearer than this (tiles). */
const SPACE = 1;
/** Standing this near somebody else (tiles) for a moment, a resident (or the cat) moves off. */
const TOO_CLOSE = 0.8;
/** The cat sits down or gets up in this many seconds (world.mjs CAT_ANIMS.down). */
export const CAT_SIT_TIME = 0.5;
/** How far the walker keeps from blocked tiles when a path is pulled straight (tiles). */
const CLEARANCE = 0.22;

/** The eight octants of the tile grid, by angle: 0 = +x (SE on the screen), 1 = +x+y (S), … 7 = +x−y (E). */
export const OCTANTS: readonly Tile[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];
/** Octants that show a face (SE, S, SW). */
const FRONT = [0, 1, 2];

const centre = (t: Tile) => ({ x: t.x + 0.5, y: t.y + 0.5 });
/** The tile a point of the grid lies on (a path point need not be a tile centre: cutLastCorner). */
const tileOf = (p: { x: number; y: number }): Tile => ({ x: Math.floor(p.x), y: Math.floor(p.y) });

/** Screen distance (world pixels) between two points of the tile grid. */
export function gridDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot((dx - dy) * 32, (dx + dy) * 16);
}

/** The octant of a step on the tile grid. */
export function octantOf(dx: number, dy: number): number {
  return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
}

/** The octant of a step, keeping `current` while the step is within HYSTERESIS degrees past its edge. */
export function octantSticky(dx: number, dy: number, current: number): number {
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  const off = Math.abs(((a - current * 45 + 540) % 360) - 180);
  return off <= 22.5 + HYSTERESIS ? current : octantOf(dx, dy);
}

/** Signed steps from octant a to b, the short way (−4 for half a turn). */
function ringStep(a: number, b: number): number {
  return ((b - a + 12) % 8) - 4;
}

/** Turning a half turn: round through the side that passes the front (the face), not the back of the head. */
function halfTurnSign(from: number): number {
  for (let k = 1; k <= 3; k++) if ((from + k) % 8 === 1) return 1;
  return -1;
}

/**
 * Turn towards `want`, one octant per TURN_STEP: the first step at once, unless the last step of a turn was less
 * than TURN_STEP ago (two turns in a row never make two steps in two frames).
 */
export function turn(a: Actor, dt: number): void {
  a.turnIn -= dt;
  if (a.oct === a.want) {
    a.turnIn = Math.max(0, a.turnIn);
    return;
  }
  while (a.turnIn <= 0 && a.oct !== a.want) {
    let d = ringStep(a.oct, a.want);
    if (d === -4) d = 4 * halfTurnSign(a.oct);
    a.oct = (a.oct + Math.sign(d) + 8) % 8;
    // walking: quick; about to set off (or waiting) on the spot: a little slower; standing about: an easy turn
    a.turnIn += a.moving ? (a.v > 0 ? TURN_STEP : TURN_STEP_START) : TURN_STEP_STAND;
  }
}

function makeActor(id: string, kind: ActorKind, tile: Tile, speed: number, stride: number): Actor {
  return {
    id,
    kind,
    ...centre(tile),
    tile: { ...tile },
    path: [],
    speed,
    v: 0,
    stride,
    heading: { x: 1, y: 1 },
    facing: 1,
    oct: 1,
    want: 1,
    turnIn: 0,
    pend: 1,
    pendFor: 0,
    moving: false,
    stepping: false,
    phase: 0,
    land: null,
    starting: false,
    waited: 0,
    rest: 0,
    restSince: 0,
    autoSettle: false,
  };
}

// ───────────────────────── straight lines through the grid ─────────────────────────

/** A point of the tile grid is on a walkable tile. */
function openAt(x: number, y: number, world: TownWorld): boolean {
  return walkable({ x: Math.floor(x), y: Math.floor(y) }, world);
}

/**
 * The straight line from (ax, ay) to (bx, by) stays on walkable tiles with CLEARANCE to spare on both sides (so it
 * never grazes the corner of a house or cuts between two blocked tiles that touch at a corner).
 */
export function lineClear(ax: number, ay: number, bx: number, by: number, world: TownWorld = TOWN_WORLD, people: readonly Pt2[] = []): boolean {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-9) return openAt(ax, ay, world);
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  const n = Math.ceil(len / 0.05);
  // somebody the walker already stands beside: the line may go on past them, but never nearer
  const from = people.map((p) => Math.hypot(p.x - ax, p.y - ay));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = ax + (bx - ax) * k;
    const y = ay + (by - ay) * k;
    if (!openAt(x, y, world)) return false;
    // the ends are tile centres (or where the walker stands): clearance only along the way
    if (i > 0 && i < n && (!openAt(x + nx * CLEARANCE, y + ny * CLEARANCE, world) || !openAt(x - nx * CLEARANCE, y - ny * CLEARANCE, world))) return false;
    // nobody walks through (or brushes past) a person: PASS to spare
    if (i > 0) {
      for (let j = 0; j < people.length; j++) {
        const d = Math.hypot(people[j].x - x, people[j].y - y);
        if (d < PASS && !(from[j] < PASS && d >= from[j] - 0.02)) return false;
      }
    }
  }
  return true;
}

/** A point of the tile grid. */
interface Pt2 {
  x: number;
  y: number;
}

/**
 * A path of tiles as the points to walk to from (x, y): every tile that can be skipped on a clear straight line is
 * dropped ("string pulling"), so the walker goes straight across open ground instead of zig-zagging along the
 * tile grid. When even the first tile cannot be reached in a straight line, the walker first goes to the centre of
 * the tile it stands on.
 */
export function smoothPath(x: number, y: number, tiles: readonly Tile[], world: TownWorld = TOWN_WORLD, people: readonly Pt2[] = []): Tile[] {
  const out: Tile[] = [];
  if (tiles.length === 0) return out;
  let ax = x;
  let ay = y;
  let i = 0;
  if (!lineClear(ax, ay, tiles[0].x + 0.5, tiles[0].y + 0.5, world, people)) {
    const here = { x: Math.floor(x), y: Math.floor(y) };
    if (Math.abs(x - here.x - 0.5) > 1e-6 || Math.abs(y - here.y - 0.5) > 1e-6) out.push(here);
    ax = here.x + 0.5;
    ay = here.y + 0.5;
  }
  while (i < tiles.length) {
    let far = i;
    for (let k = i + 1; k < tiles.length; k++) {
      if (lineClear(ax, ay, tiles[k].x + 0.5, tiles[k].y + 0.5, world, people)) far = k;
      else break;
    }
    out.push({ ...tiles[far] });
    ax = tiles[far].x + 0.5;
    ay = tiles[far].y + 0.5;
    i = far + 1;
  }
  cutLastCorner(x, y, out, world, people);
  return out;
}

/**
 * The last corner of a walk (along a row, then a 90° turn for the last tile): cut it, turning off the second-to-last
 * line as early as the way to the end is clear. The corner point is then not a tile centre (a path point is any
 * point of the grid, given as the tile whose centre it would be: x − 0.5, y − 0.5).
 */
function cutLastCorner(x: number, y: number, out: Tile[], world: TownWorld, people: readonly Pt2[]): void {
  const n = out.length;
  if (n < 2) return;
  const a = n >= 3 ? centre(out[n - 3]) : { x, y };
  const b = centre(out[n - 2]);
  const c = centre(out[n - 1]);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 0.3) return;
  for (let s = 0; s < len - 0.15; s += 0.1) {
    const px = a.x + ((b.x - a.x) * s) / len;
    const py = a.y + ((b.y - a.y) * s) / len;
    if (!lineClear(px, py, c.x, c.y, world, people)) continue;
    if (s < 1e-6) out.splice(n - 2, 1);
    else out[n - 2] = { x: px - 0.5, y: py - 0.5 };
    return;
  }
}

/**
 * Somebody ahead walking the same way (within 60°): follow at their pace, not stop and start behind them. The pace
 * cap, or null (they stand, or cross the way: wait).
 */
function following(a: Actor, b: Actor): number | null {
  if (b.v < 0.05 || a.path.length === 0) return null;
  const g = centre(a.path[0]);
  const ax = g.x - a.x;
  const ay = g.y - a.y;
  const al = Math.hypot(ax, ay);
  const bd = wayOf(b);
  if (al < 1e-9 || !bd) return null;
  if ((ax * bd.x + ay * bd.y) / al < 0.5) return null;
  // closer than half a tile: let them get ahead
  return Math.hypot(b.x - a.x, b.y - a.y) < 0.6 ? 0 : b.v * 0.95;
}

/**
 * Which way somebody walking is going (a unit vector): towards the first point of its path at least 0.3 tile off (a
 * last few hundredths to a tile centre say nothing about it). Null = not walking anywhere.
 */
function wayOf(b: { x: number; y: number; path: readonly Tile[] }): Pt2 | null {
  for (const t of b.path) {
    const c = centre(t);
    const l = Math.hypot(c.x - b.x, c.y - b.y);
    if (l >= 0.3) return { x: (c.x - b.x) / l, y: (c.y - b.y) / l };
  }
  return null;
}

/** How near (tiles) a walk from where `a` stands along `path` comes to point `o`. */
export function passes(a: Pt2, path: readonly Tile[], o: Pt2): number {
  let best = Infinity;
  let ax = a.x;
  let ay = a.y;
  for (const t of path) {
    const b = centre(t);
    const dx = b.x - ax;
    const dy = b.y - ay;
    const l2 = dx * dx + dy * dy;
    const k = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.y - ay) * dy) / l2));
    best = Math.min(best, Math.hypot(ax + dx * k - o.x, ay + dy * k - o.y));
    ax = b.x;
    ay = b.y;
  }
  return best;
}

/** Ground distance left along an actor's path. */
function pathLeft(a: Actor): number {
  let d = 0;
  let x = a.x;
  let y = a.y;
  for (const t of a.path) {
    const c = centre(t);
    d += Math.hypot(c.x - x, c.y - y);
    x = c.x;
    y = c.y;
  }
  return d;
}

/**
 * Move an actor along its path for `dt` seconds. Speeds are ground speeds (a step up the screen covers as much
 * ground as a step across it). It eases in from a stand and out to a stop at the end of its path, unless `more`
 * (held keys) gives the next tile when the path runs out: then it walks on without slowing, carrying over the
 * distance left in the frame. Before setting off the other way it turns on the spot (more than 90° off: no walking
 * sideways or backwards). `cap` limits the pace (0: somebody is in the way, it slows to a stand and waits, legs
 * closing). The last stride is fitted so the step lands just as the body stops (`land`). Returns true when it
 * reached the end of its path during this call.
 */
export function advance(a: Actor, dt: number, more?: () => Tile | null, cap = Infinity): boolean {
  if (a.path.length === 0 && more) {
    const n = more();
    if (n) a.path.push(n);
  }
  if (a.path.length === 0) {
    a.moving = false;
    a.v = 0;
    return false;
  }
  if (!a.moving) {
    a.moving = true;
    a.starting = true;
    a.land = null;
    // a walk starts with the legs together, unless the last step is still closing
    if (!a.stepping) a.phase = Math.round(a.phase / Math.PI) * Math.PI;
    a.stepping = false;
  }
  // which way: towards the next point, with hysteresis on the sprite's direction
  let g = centre(a.path[0]);
  while (Math.hypot(g.x - a.x, g.y - a.y) < 1e-9 && a.path.length > 0) {
    a.tile = tileOf(g);
    a.path.shift();
    if (a.path.length === 0 && more) {
      const n = more();
      if (n) a.path.push(n);
    }
    if (a.path.length === 0) break;
    g = centre(a.path[0]);
  }
  if (a.path.length > 0) look(a, g.x - a.x, g.y - a.y, dt);
  turn(a, dt);
  const off = Math.abs(ringStep(a.oct, a.want));
  // setting off from a stand: turn on the spot until the way is within 45° (the first 45° step is at once)
  const turning = a.starting && a.v === 0 && off >= 2;
  let top = Math.min(cap, turning ? 0 : a.speed * (off >= 3 ? 0 : off === 2 ? 0.4 : 1));
  // somebody in the way: no stride is fitted to a stop that is not the end of the walk (the legs close the step)
  if (cap === 0) a.land = null;
  const before = more ? Infinity : pathLeft(a);
  if (!more) top = Math.min(top, Math.max(a.speed * 0.3, Math.sqrt((2 * a.speed * before) / STOP_TIME)));
  if (a.v < top) a.v = Math.min(top, a.v + (a.speed / START_TIME) * dt);
  else a.v = Math.max(top, a.v - (a.speed / STOP_TIME) * dt * 1.5);
  // the last stride: fit the cycle so that it reaches "legs together" exactly at the end of the path
  if (!more && a.path.length > 0 && cap > 0) {
    const end = a.path[a.path.length - 1];
    if (a.land && (!sameTile(a.land.end, end) || before > a.land.left0 + 1e-6)) a.land = null;
    if (!a.land && before <= a.stride && before > 1e-6) {
      const per = (Math.PI * 2) / a.stride;
      const natural = a.phase + before * per;
      let target = Math.round(natural / Math.PI) * Math.PI;
      if (target <= a.phase + 1e-6) target += Math.PI;
      // no more than about a quarter faster or slower than the walk (a short walk may close its step after it)
      const k = (target - a.phase) / (before * per);
      if (k >= 0.6 && k <= 1.6) a.land = { end: { ...end }, left0: before, phase0: a.phase, target };
    }
  } else {
    a.land = null;
  }
  let left = a.v * dt;
  let moved = 0;
  while (left > 0 && a.path.length > 0) {
    const c = centre(a.path[0]);
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    if (d <= left) {
      a.x = c.x;
      a.y = c.y;
      a.tile = tileOf(c);
      a.path.shift();
      left -= d;
      moved += d;
      if (a.path.length === 0 && more) {
        const n = more();
        if (n) {
          a.path.push(n);
          look(a, n.x + 0.5 - a.x, n.y + 0.5 - a.y, 0);
        }
      }
    } else {
      a.x += ((c.x - a.x) * left) / d;
      a.y += ((c.y - a.y) * left) / d;
      moved += left;
      left = 0;
      a.tile = { x: Math.floor(a.x), y: Math.floor(a.y) };
    }
  }
  if (a.starting && a.v >= a.speed * 0.6) a.starting = false;
  if (a.land) {
    a.phase = a.land.target - (a.land.target - a.land.phase0) * (pathLeft(a) / a.land.left0);
  } else {
    let step = (moved * Math.PI * 2) / a.stride;
    // setting off: the first step lifts as the body starts to move, not after it has glided a while
    if (a.starting && moved > 0) step = Math.max(step, START_CADENCE * Math.PI * 2 * dt);
    if (moved === 0 && a.v === 0) step = closeStep(a, dt);
    a.phase += step;
  }
  if (a.path.length === 0) {
    stopHere(a);
    return true;
  }
  return false;
}

/** A walk is over (its path ran out, or it was given up): the body stands, the legs close the step if they must. */
function stopHere(a: Actor): void {
  a.moving = false;
  a.v = 0;
  a.land = null;
  a.starting = false;
  // the legs close the step: on to the next "legs together" (a multiple of π), unless the last stride landed it
  a.stepping = a.phase % Math.PI > 0.05 && Math.PI - (a.phase % Math.PI) > 0.05;
  if (!a.stepping) a.phase = Math.round(a.phase / Math.PI) * Math.PI;
  a.rest = 0;
  a.restSince = Number.NaN;
  a.autoSettle = true;
  a.waited = 0;
}

/**
 * Where the player may stand to talk to somebody, as steps from them on the tile grid: the eight neighbours, and the
 * spots two tiles off that still stand apart on the screen.
 */
export const TALK_SPOTS: readonly Tile[] = [
  ...NEIGHBOURS,
  { x: 2, y: -1 },
  { x: 1, y: -2 },
  { x: -2, y: 1 },
  { x: -1, y: 2 },
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
  { x: 0, y: -2 },
];

/**
 * Walking up to somebody to talk, the extra cost (in path steps) of standing at `d` from them. A person is about 29
 * world px wide; the two must stand apart on the screen, never one partly hiding the other:
 * - side by side across the screen (a diagonal step: 64 px apart, level): best;
 * - two tiles off, a little up or down the screen (96 px across, 16 down or up): next, nearer the viewer first;
 * - two tiles along a row or a column (64 px across, 32 down or up);
 * - one tile along a row or a column (32 px across, 16 down or up: the figures overlap): only when nothing else is free;
 * - straight in front or behind on the screen (a diagonal the other way): last of all.
 */
export function talkSpotCost(d: Tile): number {
  const near = d.x + d.y > 0;
  const far = Math.max(Math.abs(d.x), Math.abs(d.y)) === 2;
  if (d.x === -d.y && !far) return 0;
  if (far && Math.abs(d.x) + Math.abs(d.y) === 3) return near ? 1.5 : 2;
  if (far) return near ? 2.2 : 2.8;
  if (d.x === d.y) return 10;
  return near ? 7 : 8;
}

/** Standing in place mid-stride (waiting, turning on the spot): the phase to add to close the step. */
function closeStep(a: Actor, dt: number): number {
  const to = closeTarget(a.phase);
  const d = to - a.phase;
  if (Math.abs(d) < 1e-6) return d;
  const most = dt * CLOSE_RATE * Math.PI * 2;
  return Math.sign(d) * Math.min(Math.abs(d), most);
}

/**
 * Where the legs close to when the body stands mid-stride: the next "legs together" (a multiple of π), or back to the
 * last one when the stride has barely begun (a foot just lifted goes back down; no whole step taken on the spot).
 */
export function closeTarget(phase: number): number {
  const base = Math.floor(phase / Math.PI) * Math.PI;
  return phase - base < CLOSE_BACK * Math.PI ? base : base + Math.PI;
}

/**
 * Walking: look (and face) the way of the step (dx, dy). The sprite takes a new octant at once when the way is
 * clearly in it, otherwise once it has been the nearest for HYSTERESIS_TIME (`dt` = the time this way has held).
 */
function look(a: Actor, dx: number, dy: number, dt: number): void {
  if (Math.abs(dx) + Math.abs(dy) < 1e-9) return;
  a.heading = { x: dx, y: dy };
  const sdx = dx - dy;
  if (sdx > 1e-6) a.facing = 1;
  else if (sdx < -1e-6) a.facing = -1;
  const near = octantOf(dx, dy);
  if (near === a.want) {
    a.pendFor = 0;
    return;
  }
  if (octantSticky(dx, dy, a.want) !== a.want) {
    a.want = near;
    a.pendFor = 0;
    return;
  }
  if (a.pend !== near) {
    a.pend = near;
    a.pendFor = 0;
  }
  a.pendFor += dt;
  if (a.pendFor >= HYSTERESIS_TIME - 1e-9) {
    a.want = near;
    a.pendFor = 0;
  }
}

/**
 * Standing (or at the end of every frame): the turn goes on, the legs close the step, the stand is timed and the
 * person settles to face the viewer. `now` = sim time.
 */
export function standTick(a: Actor, dt: number, now: number): void {
  // walking, advance() turns them
  if (a.moving) return;
  turn(a, dt);
  if (a.stepping) {
    a.phase += closeStep(a, dt);
    if (Math.abs(a.phase - Math.round(a.phase / Math.PI) * Math.PI) < 1e-9) {
      a.phase = Math.round(a.phase / Math.PI) * Math.PI;
      a.stepping = false;
    }
    return;
  }
  if (Number.isNaN(a.restSince)) a.restSince = now;
  a.rest += dt;
  if (a.autoSettle && a.rest >= SETTLE_AFTER) {
    a.autoSettle = false;
    settle(a);
  }
}

/**
 * Look at a point of the tile grid (`facing` does not change when it is straight above or below on the screen). The
 * person turns there 45° at a time.
 */
export function face(a: Actor, x: number, y: number): void {
  a.autoSettle = false;
  const sdx = x - a.x - (y - a.y);
  // standing, a person turns three-quarters towards the viewer on that side (a step of +x or +y on the grid):
  // a straight side view hides the face behind the hair
  if (sdx > 0.05) {
    a.facing = 1;
    a.heading = { x: 1, y: 0 };
  } else if (sdx < -0.05) {
    a.facing = -1;
    a.heading = { x: 0, y: 1 };
  } else if (x + y > a.x + a.y + 0.05) {
    a.heading = { x: 1, y: 1 };
  } else {
    // straight above on the screen: never the back of the head, three-quarters on the side it already looks to
    settle(a);
    return;
  }
  a.want = octantOf(a.heading.x, a.heading.y);
}

/**
 * Standing still, a person turns three-quarters towards the viewer on the side they look to (SE or SW): with these
 * blocky heads a back view is a box of hair, so nobody rests with their back to the camera.
 */
export function settle(a: Actor): void {
  a.autoSettle = false;
  a.heading = a.facing === 1 ? { x: 1, y: 0 } : { x: 0, y: 1 };
  a.want = octantOf(a.heading.x, a.heading.y);
}

/** For an emote (rendered three-quarters only): somebody facing straight at the viewer turns to SE / SW first. */
export function threeQuarter(a: Actor): void {
  if (a.want === 1 || a.oct === 1) settle(a);
}

/**
 * Arrow keys / WASD → a step on the tile grid. The keys mean SCREEN directions: up = away from the viewer
 * (x-1, y-1), right = across the screen (x+1, y-1). Two keys give a step along a row or a column.
 */
export function keysToDelta(k: { up: boolean; down: boolean; left: boolean; right: boolean }): Tile {
  const v = (k.down ? 1 : 0) - (k.up ? 1 : 0);
  const h = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  return { x: Math.sign(v + h), y: Math.sign(v - h) };
}

/**
 * The step actually taken for a held direction: the direction itself when free; for a blocked diagonal, sliding
 * along the side that is free (so holding "up" against a house walks along its wall). `free` (optional) says a step
 * is not into somebody: a person blocks like a wall. Null = stay.
 */
export function slideStep(from: Tile, delta: Tile, world: TownWorld = TOWN_WORLD, free: (d: Tile) => boolean = () => true): Tile | null {
  if (delta.x === 0 && delta.y === 0) return null;
  const ok = (d: Tile) => canStep(from, d, world) && free(d);
  if (ok(delta)) return delta;
  if (delta.x !== 0 && delta.y !== 0) {
    const a = { x: delta.x, y: 0 };
    const b = { x: 0, y: delta.y };
    if (ok(a)) return a;
    if (ok(b)) return b;
  }
  return null;
}

/**
 * Cut a walk short: stop at the next tile centre ahead (a resident called to talk, keys taking over a click walk),
 * or at the point being walked to. Only a centre AHEAD on the way (within 45° of it) will do: the tile under the
 * walker is still the one it is leaving for the first part of a step, and its centre lies behind (turning round to
 * walk back to it, then round again, was a jerky about-face).
 */
function stopAhead(a: Actor, world: TownWorld): void {
  if (a.path.length === 0) return;
  const c = centre(a.path[0]);
  const d = Math.hypot(c.x - a.x, c.y - a.y);
  if (d <= 0.75) {
    a.path.length = 1;
    return;
  }
  const ux = (c.x - a.x) / d;
  const uy = (c.y - a.y) / d;
  for (let s = 0.25; s < d - 0.25; s += 0.25) {
    const t = { x: Math.floor(a.x + ux * s), y: Math.floor(a.y + uy * s) };
    const along = (t.x + 0.5 - a.x) * ux + (t.y + 0.5 - a.y) * uy;
    const side = Math.abs((t.x + 0.5 - a.x) * uy - (t.y + 0.5 - a.y) * ux);
    if (along < 0.1 || side > along) continue;
    if (walkable(t, world) && lineClear(a.x, a.y, t.x + 0.5, t.y + 0.5, world)) {
      a.path = [t];
      return;
    }
  }
  a.path = [a.path[0]];
}

export class TownSim {
  readonly world: TownWorld;
  private readonly rng: () => number;
  readonly player: Actor;
  /** Residents in town (built places only), by place id. */
  readonly residents = new Map<PlaceId, Resident>();
  cat: Cat | null = null;
  /** Seconds since the sim began (the idle loops start from it). */
  time = 0;
  private built = new Set<string>();
  private sites: Set<string> | null = null;
  private errand: Errand | null = null;
  private held: Tile = { x: 0, y: 0 };
  /** Where the player is walking to (for the marker on the ground), if anywhere. */
  goal: Tile | null = null;
  /** The resident in a conversation with the player: the others keep their distance and stop strolling. */
  private talking: PlaceId | null = null;
  /** Sim time the player's click walk last looked for a way round somebody in it. */
  private repathAt = -Infinity;
  /** Somebody the player's click walk squeezes past (SQUEEZE_AFTER): not in its way, and no gap kept to them. */
  private squeeze: Actor | null = null;
  /** Seconds the click walk has stood behind somebody in its way (p.waited is the keys' count, reset every frame). */
  private stuckFor = 0;

  constructor(world: TownWorld = TOWN_WORLD, rng: () => number = Math.random, start?: Tile) {
    this.world = world;
    this.rng = rng;
    const at = start && walkable(start, world) ? start : world.start;
    this.player = makeActor('player', 'player', at, PLAYER_SPEED, personStride('player'));
  }

  /** Residents appear with their place and leave with it; the cat comes when bought. */
  setState(state: Pick<StageState, 'built' | 'decorations' | 'sites'>): void {
    this.built = new Set(state.built);
    this.sites = state.sites ? new Set(state.sites) : null;
    for (const p of this.world.places) {
      const has = this.residents.has(p.id);
      if (this.built.has(p.id) && !has) {
        const r: Resident = {
          ...makeActor(p.id, 'resident', p.spot, RESIDENT_SPEED * (0.9 + this.rng() * 0.2), personStride(p.id)),
          kind: 'resident',
          place: p,
          wanderIn: 3 + this.rng() * 8,
          lookIn: 2 + this.rng() * 4,
          engaged: false,
          avoid: null,
          closeFor: 0,
        };
        // everybody breathes at their own moment
        r.restSince = this.time - this.rng() * 1.3;
        // look towards the middle of town
        face(r, this.world.plaza.x, this.world.plaza.y);
        r.oct = r.want;
        this.residents.set(p.id, r);
      } else if (!this.built.has(p.id) && has) {
        this.residents.delete(p.id);
      }
    }
    const wantsCat = state.decorations.includes('cat');
    if (wantsCat && !this.cat) {
      const spot = this.world.decorations.cat[0] ?? centre(this.world.start);
      const tile = nearestWalkable({ x: Math.floor(spot.x), y: Math.floor(spot.y) }, this.world) ?? this.world.start;
      this.cat = { ...makeActor('cat', 'cat', tile, CAT_SPEED, CAT_STRIDE), kind: 'cat', sitFor: 2, sit: 1, sitSince: this.time - this.rng() * 2, closeFor: 0 };
      this.cat.oct = this.cat.want = 0;
    } else if (!wantsCat) {
      this.cat = null;
    }
  }

  isBuilt(id: string): boolean {
    return this.built.has(id);
  }

  /** An empty lot shown as a construction site (one of the next to build): it can be clicked and built from the world. */
  isSite(id: string): boolean {
    return !this.built.has(id) && (this.sites === null || this.sites.has(id));
  }

  actor(id: string): Actor | null {
    if (id === 'player') return this.player;
    if (id === 'cat') return this.cat;
    return this.residents.get(id as PlaceId) ?? null;
  }

  // ───────────────────────── the player ─────────────────────────

  /** Walk to a tile (or to the nearest walkable one; somebody standing there: the nearest free tile by them). */
  walkToTile(tile: Tile, then?: () => void): boolean {
    let target = nearestWalkable(tile, this.world, this.player.tile);
    if (!target) return false;
    if (this.occupied(target, this.player)) {
      // never walk onto a person: the free neighbour nearest to the player
      const p = this.player;
      let best: Tile | null = null;
      let bestD = Infinity;
      for (const d of NEIGHBOURS) {
        const c = { x: target.x + d.x, y: target.y + d.y };
        if (!walkable(c, this.world) || this.occupied(c, p)) continue;
        const dist = Math.hypot(c.x + 0.5 - p.x, c.y + 0.5 - p.y);
        if (dist < bestD) {
          best = c;
          bestD = dist;
        }
      }
      if (best) target = best;
    }
    this.release();
    return this.send(target, { kind: 'tile', tile: target }, then);
  }

  /**
   * Walk up to a resident and stop beside them. The resident waits. `then` runs once, on arrival (at once when the
   * player already stands next to them). False when the resident is not in town or cannot be reached.
   */
  walkToResident(id: PlaceId, then?: () => void): boolean {
    const r = this.residents.get(id);
    if (!r) return false;
    this.release();
    r.engaged = true;
    // the resident finishes the step they are in and stays there
    stopAhead(r, this.world);
    const at = tileOf(centre(r.path[r.path.length - 1] ?? r.tile));
    // where they will stand (not always a tile centre: a stroll given up halfway stops where it was)
    const stand = r.path.length > 0 ? centre(r.path[r.path.length - 1]) : { x: r.x, y: r.y };
    const from = this.from();
    let best: Tile | null = null;
    let bestLen = Infinity;
    for (const d of TALK_SPOTS) {
      const c = { x: at.x + d.x, y: at.y + d.y };
      if (!walkable(c, this.world)) continue;
      // a spot whose centre is right by them (they stand near the edge of their tile): the player could not get there
      // without walking into them (step keeps MIN_GAP), and would wait there for good
      if (Math.hypot(c.x + 0.5 - stand.x, c.y + 0.5 - stand.y) < 0.85) continue;
      const here = sameTile(c, from);
      // never a spot somebody else stands on (two people in one spot read as one with two heads)
      if (!here && this.occupied(c, this.player, id)) continue;
      const steps = here ? 0 : findPath(from, c, this.world).length || Infinity;
      // nor a spot whose way leads past them (they wait for the talk: they would not step aside)
      if (!here && steps < bestLen && passes(this.player, this.playerPath(c), centre(at)) < PASS) continue;
      // where the two stand apart on the screen (talkSpotCost); away from the others; already standing there, stay
      const len = steps + talkSpotCost(d) + (!here && this.crowded(c, id) ? 6 : 0);
      if (len < bestLen) {
        best = c;
        bestLen = len;
      }
    }
    if (!best) {
      r.engaged = false;
      return false;
    }
    return this.send(best, { kind: 'talk', placeId: id }, then);
  }

  /** Walk to the door of a place (an empty lot's gate). */
  walkToDoor(id: PlaceId, then?: () => void): boolean {
    const p = this.world.places.find((q) => q.id === id);
    if (!p) return false;
    this.release();
    return this.send(p.door, { kind: this.built.has(id) ? 'talk' : 'lot', placeId: id }, then);
  }

  /** Keys held: a step on the tile grid (see keysToDelta), {0,0} = none. Taking the keys cancels a click walk. */
  hold(delta: Tile): void {
    this.held = { x: Math.sign(delta.x), y: Math.sign(delta.y) };
    if (this.held.x !== 0 || this.held.y !== 0) {
      this.cancelErrand();
      // finish the step being walked (to the next tile centre), then follow the keys
      stopAhead(this.player, this.world);
    }
  }

  /** Let go of the resident being talked to: they wander again. */
  release(): void {
    for (const r of this.residents.values()) r.engaged = false;
  }

  /** Another resident (not `except`) stands on or next to this tile, or the cat sits within SPACE of it. */
  private crowded(t: Tile, except: PlaceId): boolean {
    for (const o of this.residents.values()) {
      if (o.place.id === except) continue;
      const at = tileOf(centre(o.path[o.path.length - 1] ?? o.tile));
      if (Math.abs(at.x - t.x) <= 1 && Math.abs(at.y - t.y) <= 1) return true;
    }
    const c = this.cat;
    if (c && Math.hypot(c.x - t.x - 0.5, c.y - t.y - 0.5) < SPACE) return true;
    return false;
  }

  /** Somebody (not `a`, not resident `skip`) stands within PERSONAL of this tile's centre. */
  private occupied(t: Tile, a: Actor, skip: PlaceId | null = null): boolean {
    return this.peopleExcept(a, skip).some((o) => Math.hypot(o.x - t.x - 0.5, o.y - t.y - 0.5) < PERSONAL);
  }

  /**
   * Hold a resident where they are (a conversation is open; null = it closed). While it lasts nobody else strolls,
   * and whoever stands close to the two steps aside, so the pair is never crowded.
   */
  engage(id: PlaceId | null): void {
    this.release();
    const r = id ? this.residents.get(id) : null;
    this.talking = r ? r.place.id : null;
    if (!r) return;
    r.engaged = true;
    stopAhead(r, this.world);
    face(r, this.player.x, this.player.y);
    face(this.player, r.x, r.y);
  }

  /** Before an emote (rendered three-quarters only): somebody facing the viewer straight on turns a little. */
  turnForEmote(id: string): void {
    const a = this.actor(id);
    if (a && a.kind !== 'cat') threeQuarter(a);
  }

  private from(): Tile {
    return { ...this.player.tile };
  }

  /** A walk from where `a` stands to `to`, round the people standing about and never through them; [] = no way. */
  private walkPath(a: Actor, to: Tile): Tile[] {
    const people = this.peopleExcept(a);
    const path = findPath(a.tile, to, this.world, (t) => (people.some((o) => Math.hypot(o.x - t.x - 0.5, o.y - t.y - 0.5) < PERSONAL) ? DETOUR : 0));
    return path.length > 0 ? smoothPath(a.x, a.y, path, this.world, people) : [];
  }

  /** Everybody else (the player, the residents, the cat), but `a` and resident `skip`. */
  private othersOf(a: Actor, skip: PlaceId | null = null): Actor[] {
    const out: Actor[] = [];
    if (a !== this.player) out.push(this.player);
    for (const r of this.residents.values()) if (r !== a && r.place.id !== skip) out.push(r);
    if (this.cat && this.cat !== a) out.push(this.cat);
    return out;
  }

  /** Where everybody else stands (the player, the residents, the cat), but `a` and resident `skip`. */
  private peopleExcept(a: Actor, skip: PlaceId | null = null): Pt2[] {
    return this.othersOf(a, skip).map((o) => ({ x: o.x, y: o.y }));
  }

  /**
   * The first person in the way of `a` walking along `path` (from where it stands): within LOOK ahead along the way
   * (round its corners too; up to END_ROOM past its end), less than SIDE to the side; or somebody walking who will be
   * there in a moment (AHEAD). Null = the way is free.
   */
  private blocker(a: Actor, path: readonly Tile[], ignore: Actor | null = null): Actor | null {
    if (path.length === 0) return null;
    const way = wayOf({ x: a.x, y: a.y, path });
    // where `a` will be in a moment at its full pace (somebody crossing its way is seen before they are in it). Not at
    // its pace now: that made a see-saw, the walker slowing for somebody it then no longer saw, speeding up, seeing
    // them again, its speed going up and down every frame
    const fx = a.x + (way?.x ?? 0) * a.speed * AHEAD;
    const fy = a.y + (way?.y ?? 0) * a.speed * AHEAD;
    let best: Actor | null = null;
    let bestAt = Infinity;
    for (const o of this.othersOf(a)) {
      if (o === ignore) continue;
      // along the way, segment by segment
      let px = a.x;
      let py = a.y;
      let done = 0;
      let at = Infinity;
      for (let k = 0; k < path.length && done < LOOK; k++) {
        const c = centre(path[k]);
        const len = Math.hypot(c.x - px, c.y - py);
        if (len < 1e-9) continue;
        const ux = (c.x - px) / len;
        const uy = (c.y - py) / len;
        const along = (o.x - px) * ux + (o.y - py) * uy;
        const side = Math.abs((o.x - px) * uy - (o.y - py) * ux);
        const reach = Math.min(LOOK - done, len + (k === path.length - 1 ? END_ROOM : 0));
        if (along > (k === 0 ? 0.05 : -SIDE / 2) && along < reach && side < SIDE) {
          at = done + Math.max(0, along);
          break;
        }
        done += len;
        px = c.x;
        py = c.y;
      }
      if (at === Infinity && o.v > 0.05 && way) {
        // the two a moment from now: the other walking on along its own way
        const ow = wayOf(o);
        if (ow) {
          const ox = o.x + ow.x * o.v * AHEAD;
          const oy = o.y + ow.y * o.v * AHEAD;
          const fAlong = (ox - a.x) * way.x + (oy - a.y) * way.y;
          if (fAlong > 0.05 && fAlong < LOOK + a.speed * AHEAD && Math.hypot(ox - fx, oy - fy) < TOO_CLOSE) at = fAlong;
        }
      }
      if (at < bestAt) {
        best = o;
        bestAt = at;
      }
    }
    return best;
  }

  /**
   * A resident (or the cat) walking: somebody within LOOK ahead on its way makes it slow to a stand and wait (the idle
   * loop plays while it waits, legs together); it gives the walk up after WAIT_STILL seconds behind somebody standing,
   * WAIT_MOVING behind somebody walking, and does not try that way again for AVOID_FOR seconds. Returns the pace cap
   * for advance().
   */
  private giveWay(a: Actor, dt: number): number {
    if (a.path.length === 0) return Infinity;
    const b = this.blocker(a, a.path);
    if (!b) {
      a.waited = 0;
      return Infinity;
    }
    const behind = following(a, b);
    if (behind !== null) {
      a.waited = 0;
      return behind;
    }
    // the wait begins: the idle loop (engine pose) starts from here
    if (a.waited === 0) a.restSince = this.time;
    a.waited += dt;
    const still = b.v < 0.05;
    if (a.v === 0 && a.waited > (still ? WAIT_STILL : WAIT_MOVING)) this.giveUp(a);
    return 0;
  }

  /** A walk given up (somebody in the way): it stands here, and that heading is left alone a while. */
  private giveUp(a: Actor): void {
    const since = a.restSince;
    const oct = a.want;
    a.path = [];
    stopHere(a);
    // it was already standing (legs together, the idle loop on): the loop goes on, no restart
    if (!a.stepping) a.restSince = since;
    if (a.kind === 'resident') {
      const r = a as Resident;
      r.avoid = { oct, until: this.time + AVOID_FOR };
      r.wanderIn = 1.5 + this.rng() * 1.5;
    } else if (a.kind === 'cat') {
      (a as Cat).sitFor = 1.5 + this.rng() * 2;
    }
  }

  /**
   * The player's click walk with somebody in the way: look for a way round them (now and then, not every frame) and
   * wait for them meanwhile. Keys: wait for somebody walking across; somebody standing ends the step (the keys
   * choose another way). Returns the pace cap for advance().
   */
  private playerWay(dt: number, keys: boolean): number {
    const p = this.player;
    // past the one it squeezed by: the usual rules again
    if (this.squeeze && (!this.errand || Math.hypot(this.squeeze.x - p.x, this.squeeze.y - p.y) > LOOK + 0.5)) this.squeeze = null;
    if (p.path.length === 0) return Infinity;
    const b = this.blocker(p, p.path, this.squeeze);
    if (!b) {
      p.waited = 0;
      this.stuckFor = 0;
      return Infinity;
    }
    const behind = following(p, b);
    if (behind !== null) {
      p.waited = 0;
      this.stuckFor = 0;
      return behind;
    }
    p.waited += dt;
    if (p.v === 0) this.stuckFor += dt;
    if (this.errand) {
      if (this.time - this.repathAt >= 0.35) {
        this.repathAt = this.time;
        const path = this.playerPath(this.errand.target);
        // a way round them (all of it clear of them, not only its first line)
        if (path.length > 0 && passes(p, path, b) >= SIDE && !this.blocker(p, path)) {
          p.path = path;
          return Infinity;
        }
        // no way round (a narrow way): somebody standing there steps aside
        if (b.v < 0.05) this.stepAside(b, p);
      }
      // still there after a good while (nowhere for them to go, or the cat getting up and sitting down again): the
      // walk squeezes past them rather than standing behind them for good
      if (this.stuckFor > SQUEEZE_AFTER) {
        this.squeeze = b;
        this.stuckFor = 0;
        return Infinity;
      }
      return 0;
    }
    if (keys && p.v === 0 && (b.v < 0.05 || p.waited > 0.6)) {
      p.path = [];
      stopHere(p);
    }
    return 0;
  }

  /**
   * Somebody standing in the player's only way (a narrow path by a house) steps aside: to the nearest free tile next
   * to them that is clear of the player's walk, and later home again. Nobody held for a conversation moves.
   */
  private stepAside(o: Actor, p: Actor, way: readonly Tile[] = p.path): void {
    if (o.kind === 'player' || o.path.length > 0) return;
    if (o.kind === 'resident' && ((o as Resident).engaged || (o as Resident).place.id === this.talking)) return;
    const here = tileOf(o);
    let best: Tile[] | null = null;
    let bestLen = Infinity;
    // the nearest free spot clear of the player's walk; in a narrow way that may be a few tiles on, out of it
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const t = { x: here.x + dx, y: here.y + dy };
        if ((dx === 0 && dy === 0) || !walkable(t, this.world) || this.world.places.some((q) => sameTile(q.door, t))) continue;
        if (passes(p, way, centre(t)) < 1 || this.spaceAt(t, o) < TOO_CLOSE) continue;
        const tiles = findPath(here, t, this.world);
        if (tiles.length === 0 || tiles.length > 6 || tiles.length >= bestLen) continue;
        let walk = this.walkPath(o, t);
        // not first back to the centre of its own tile (a few hundredths, maybe towards the one it makes way for)
        if (walk.length > 1 && Math.hypot(centre(walk[0]).x - o.x, centre(walk[0]).y - o.y) < 0.35) walk = walk.slice(1);
        // never by squeezing past the player (no nearer them than where it stands, or SIDE)
        if (walk.length > 0 && passes(o, walk, p) >= Math.min(SIDE, Math.hypot(o.x - p.x, o.y - p.y)) - 0.02 && !this.blocker(o, walk)) {
          best = walk;
          bestLen = tiles.length;
        }
      }
    }
    if (!best) return;
    o.path = best;
    if (o.kind === 'resident') (o as Resident).wanderIn = 4 + this.rng() * 3;
    if (o.kind === 'cat') (o as Cat).closeFor = 0;
  }

  /**
   * A held key against somebody standing in the way (not a wall): after half a second they step aside, as for a click
   * walk, out of the next three tiles that way.
   */
  private keysBlocked(dt: number): void {
    const p = this.player;
    const d = slideStep(p.tile, this.held, this.world);
    if (!d) return;
    const way: Tile[] = [];
    for (let k = 1; k <= 3; k++) {
      const t = { x: p.tile.x + d.x * k, y: p.tile.y + d.y * k };
      if (!walkable(t, this.world)) break;
      way.push(t);
    }
    const o = way.length > 0 ? this.blocker(p, way) : null;
    if (!o || o.v > 0.05) {
      p.waited = 0;
      return;
    }
    p.waited += dt;
    if (p.waited > 0.5) {
      this.stepAside(o, p, way);
      p.waited = 0;
    }
  }

  /** The player's walk to `target` round the people about (the one walked up to as well), never through them. */
  private playerPath(target: Tile): Tile[] {
    const p = this.player;
    const people = this.peopleExcept(p);
    const path = findPath(this.from(), target, this.world, (t) => (people.some((o) => Math.hypot(o.x - t.x - 0.5, o.y - t.y - 0.5) < PERSONAL) ? DETOUR : 0));
    return path.length > 0 ? smoothPath(p.x, p.y, path, this.world, people) : [];
  }

  private cancelErrand(): void {
    this.errand = null;
    this.goal = null;
    this.squeeze = null;
    this.release();
  }

  private send(target: Tile, arrival: Arrival, then?: () => void): boolean {
    const p = this.player;
    const from = this.from();
    if (sameTile(from, target)) {
      // already on that tile: to its centre (no path when already there)
      p.path = Math.hypot(target.x + 0.5 - p.x, target.y + 0.5 - p.y) > 1e-6 ? [{ ...target }] : [];
    } else {
      // round the people standing about (the one walked up to as well), never through them
      const path = this.playerPath(target);
      if (path.length === 0) {
        if (arrival.kind === 'talk') this.release();
        return false;
      }
      p.path = path;
    }
    this.repathAt = this.time;
    this.squeeze = null;
    this.stuckFor = 0;
    this.errand = { target, arrival, then };
    this.goal = target;
    this.held = { x: 0, y: 0 };
    return true;
  }

  /**
   * The next tile for the held keys, from the tile just reached (null: none held, or the way is blocked by a wall or
   * by somebody: a person is never walked into).
   */
  private heldStep = (): Tile | null => {
    if (this.held.x === 0 && this.held.y === 0) return null;
    const p = this.player;
    const free = (t: Tile) => !this.occupied(t, p) && lineClear(p.x, p.y, t.x + 0.5, t.y + 0.5, this.world, this.peopleExcept(p));
    const d = slideStep(p.tile, this.held, this.world, (d) => free({ x: p.tile.x + d.x, y: p.tile.y + d.y }));
    return d ? { x: p.tile.x + d.x, y: p.tile.y + d.y } : null;
  };

  // ───────────────────────── time ─────────────────────────

  /** Advance everything by `dt` seconds. Returns what the player reached during this step (at most one thing). */
  update(dt: number): Arrival | null {
    this.time += dt;
    const p = this.player;
    const keys = this.held.x !== 0 || this.held.y !== 0;
    if (keys && p.path.length === 0 && !this.heldStep()) {
      face(p, p.x + this.held.x, p.y + this.held.y);
      this.keysBlocked(dt);
    } else if (!keys) p.waited = 0;
    const cap = this.playerWay(dt, keys);
    this.step(p, dt, keys ? this.heldStep : undefined, cap);
    standTick(p, dt, this.time);
    // keys held against a wall: no turning back to the viewer
    if (keys && !p.moving) p.autoSettle = false;

    let arrived: Arrival | null = null;
    if (this.errand && p.path.length === 0 && sameTile(p.tile, this.errand.target)) {
      const e = this.errand;
      this.errand = null;
      this.goal = null;
      this.squeeze = null;
      arrived = e.arrival;
      if (e.arrival.kind === 'talk') {
        const r = this.residents.get(e.arrival.placeId);
        if (r) {
          face(p, r.x, r.y);
          face(r, p.x, p.y);
        }
      }
      e.then?.();
    }

    for (const r of this.residents.values()) this.updateResident(r, dt);
    if (this.cat) this.updateCat(this.cat, dt);
    return arrived;
  }

  /**
   * advance() with one hard rule over whatever the planning decided: a step that would bring `a` nearer than
   * MIN_GAP to somebody (and nearer than it was) is not taken: the body, the legs and the path stay as they were, and
   * it stands there (giveWay / playerWay then wait, go round or ask them to step aside). Nobody walks into anybody.
   */
  private step(a: Actor, dt: number, more?: () => Tile | null, cap = Infinity): boolean {
    const before = { x: a.x, y: a.y, tile: a.tile, phase: a.phase, path: a.path.slice(), land: a.land, starting: a.starting };
    const done = advance(a, dt, more, cap);
    if (a.x === before.x && a.y === before.y) return done;
    for (const o of this.othersOf(a)) {
      // the player squeezing past somebody who could not make way (SQUEEZE_AFTER), and they by the player
      if (this.squeeze && ((a === this.player && o === this.squeeze) || (a === this.squeeze && o === this.player))) continue;
      const now = Math.hypot(o.x - a.x, o.y - a.y);
      if (now >= MIN_GAP || now >= Math.hypot(o.x - before.x, o.y - before.y)) continue;
      Object.assign(a, before);
      a.v = 0;
      a.land = null;
      // a point of the path just by it (a tile centre a few hundredths back towards them) is passed over
      if (a.path.length > 0 && Math.hypot(centre(a.path[0]).x - a.x, centre(a.path[0]).y - a.y) < 0.35) a.path.shift();
      a.moving = a.path.length > 0;
      if (!a.moving) stopHere(a);
      // standing there, the legs close the step (never a stride held mid-air)
      else a.phase += closeStep(a, dt);
      return false;
    }
    return done;
  }

  /** Standing (not `a`, the player aside): somebody else stands nearer than TOO_CLOSE. */
  private tooClose(a: Actor): boolean {
    for (const o of this.othersOf(a)) {
      if (o === this.player || o.v > 0.05) continue;
      if (Math.hypot(o.x - a.x, o.y - a.y) < TOO_CLOSE) return true;
    }
    return false;
  }

  private updateResident(r: Resident, dt: number): void {
    if (r.path.length > 0) {
      // somebody in the way: slow to a stand and wait for them (a resident never walks through anybody)
      const cap = this.giveWay(r, dt);
      if (r.path.length > 0) this.step(r, dt, undefined, cap);
      standTick(r, dt, this.time);
      return;
    }
    standTick(r, dt, this.time);
    if (r.stepping) return;
    if (this.talking && this.talking !== r.place.id) {
      if (r.wanderIn > 0 && r.wanderIn < 1) r.wanderIn = Math.max(0, r.wanderIn - dt);
      this.keepClear(r);
      return;
    }
    const near = gridDistance(r.x, r.y, this.player.x, this.player.y) < 78;
    if (r.engaged || near) {
      // somebody is close: look at them (now and then, not every frame: no flicker as the player passes) and wait
      r.lookIn -= dt;
      if (near && r.lookIn <= 0) {
        face(r, this.player.x, this.player.y);
        r.lookIn = 0.35;
      }
      return;
    }
    const home = r.place.spot;
    // standing right by somebody (a walk given up beside them, the cat at their feet): away from home, they go
    // home in a moment; at home, the other one moves
    if (this.tooClose(r) && !sameTile(r.tile, home)) {
      r.closeFor += dt;
      if (r.closeFor > 0.6) r.wanderIn = Math.min(r.wanderIn, 0);
    } else {
      r.closeFor = 0;
    }
    // standing about: now and then a look round, then back to the front
    r.lookIn -= dt;
    if (r.lookIn <= 0 && r.oct === r.want && r.rest > 1) {
      const front = r.facing > 0 ? 0 : 2;
      if (r.want !== front) {
        settle(r);
        r.lookIn = 3 + this.rng() * 5;
      } else {
        // straight at the viewer, or across to the other side (still a face, never the back of the head)
        r.want = this.rng() < 0.6 ? 1 : FRONT[2 - front];
        r.lookIn = 1.2 + this.rng() * 2;
      }
    }
    r.wanderIn -= dt;
    if (r.wanderIn > 0) return;
    if (!sameTile(r.tile, home)) {
      // a stroll ends where it began: back by the door, and a long wait there
      r.wanderIn = 6 + this.rng() * 8;
      const back = this.walkPath(r, home);
      if (back.length > 0 && this.canSetOff(r, back)) r.path = back;
      else {
        // somebody standing in the way home (a narrow way): they step aside, and this one goes in a moment
        const b = back.length > 0 ? this.blocker(r, back) : null;
        if (b && b.v < 0.05) this.stepAside(b, r, back);
        r.wanderIn = 1 + this.rng() * 1.5;
      }
      return;
    }
    // a stroll of a few tiles round the spot where they wait (never onto a doorstep, never by somebody), a short
    // stand there, then home
    const options: Tile[] = [];
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 2) continue;
        const c = { x: home.x + dx, y: home.y + dy };
        if (!walkable(c, this.world)) continue;
        if (this.world.places.some((q) => sameTile(q.door, c))) continue;
        if (this.crowded(c, r.place.id) || this.spaceAt(c, r) < SPACE) continue;
        options.push(c);
      }
    }
    r.wanderIn = 2 + this.rng() * 3;
    // a few tries: a stroll that would set off straight into somebody (or the way just given up) is not begun
    for (let tries = 0; tries < 4 && options.length > 0 && r.path.length === 0; tries++) {
      const i = Math.min(options.length - 1, Math.floor(this.rng() * options.length));
      const to = options.splice(i, 1)[0];
      const path = findPath(r.tile, to, this.world);
      if (path.length === 0 || path.length > 5) continue;
      const walk = this.walkPath(r, to);
      if (walk.length > 0 && this.canSetOff(r, walk)) r.path = walk;
    }
    if (r.path.length === 0) r.wanderIn = 1 + this.rng() * 2;
  }

  /** A walk can begin: nobody right in its way, and not the heading a walk was just given up on. */
  private canSetOff(a: Actor, path: readonly Tile[]): boolean {
    const g = centre(path[0]);
    if (this.blocker(a, path)) return false;
    const avoid = a.kind === 'resident' ? (a as Resident).avoid : null;
    if (avoid && this.time < avoid.until && octantOf(g.x - a.x, g.y - a.y) === avoid.oct) return false;
    return true;
  }

  /** How far the nearest other person (or where a walking resident is going) is from the centre of tile `t`. */
  private spaceAt(t: Tile, a: Actor): number {
    let d = Infinity;
    const cx = t.x + 0.5;
    const cy = t.y + 0.5;
    for (const o of this.othersOf(a)) {
      d = Math.min(d, Math.hypot(o.x - cx, o.y - cy));
      const end = o.path[o.path.length - 1];
      if (end) d = Math.min(d, Math.hypot(end.x + 0.5 - cx, end.y + 0.5 - cy));
    }
    return d;
  }

  /**
   * A conversation is going on: a resident within two tiles of either speaker walks off to the nearest tile at
   * least three away from both (home when that is far enough), then waits there facing the viewer.
   */
  private keepClear(r: Resident): void {
    const other = this.talking ? this.residents.get(this.talking) : null;
    if (!other) return;
    const pair = [this.player.path[this.player.path.length - 1] ?? this.player.tile, other.path[other.path.length - 1] ?? other.tile].map((t) => tileOf(centre(t)));
    const gap = (t: Tile) => Math.min(...pair.map((p) => Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y))));
    if (gap(r.tile) > 2) return;
    // nowhere to go last time: look again in a moment, not every frame
    if (r.wanderIn > 0 && r.wanderIn < 1) return;
    let best: Tile[] | null = null;
    const home = r.place.spot;
    if (gap(home) >= 3) {
      const back = findPath(r.tile, home, this.world);
      if (back.length > 0) best = back;
    }
    if (!best) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const c = { x: r.tile.x + dx, y: r.tile.y + dy };
          if (gap(c) < 3 || !walkable(c, this.world)) continue;
          if (this.world.places.some((q) => sameTile(q.door, c))) continue;
          if (this.spaceAt(c, r) < SPACE) continue;
          const path = findPath(r.tile, c, this.world);
          if (path.length > 0 && (!best || path.length < best.length)) best = path;
        }
      }
    }
    if (best) {
      r.path = smoothPath(r.x, r.y, best, this.world, this.peopleExcept(r));
      r.wanderIn = 3 + this.rng() * 4;
    } else {
      r.wanderIn = 0.9;
    }
  }

  /**
   * The cat: it sits (the tail sways), gets up (CAT_SIT_TIME, the `down` frames backwards) before a walk, and after
   * one turns to the front standing, then sits down: it never turns while seated, nor pops from standing to seated.
   * It sits only where nobody stands within SPACE, and leaves when somebody comes to stand right by it.
   */
  private updateCat(c: Cat, dt: number): void {
    const rate = dt / CAT_SIT_TIME;
    if (c.path.length > 0) {
      if (c.sit > 0) {
        // up first
        c.sit = Math.max(0, c.sit - rate);
        return;
      }
      const cap = this.giveWay(c, dt);
      if (c.path.length > 0 && this.step(c, dt, undefined, cap)) c.sitFor = 2 + this.rng() * 5;
      standTick(c, dt, this.time);
      return;
    }
    standTick(c, dt, this.time);
    // standing after a walk: once it has turned to the front (standTick: settle), it sits down
    if (!c.stepping && !c.autoSettle && c.oct === c.want && c.rest > 0.15 && c.sit < 1) {
      c.sit = Math.min(1, c.sit + rate);
      if (c.sit >= 1) c.sitSince = this.time;
    }
    // somebody has come to stand right by it: it gets up and goes after a moment
    if (this.tooClose(c) || this.othersOf(c).some((o) => o === this.player && !o.moving && Math.hypot(o.x - c.x, o.y - c.y) < 0.6)) {
      c.closeFor += dt;
      if (c.closeFor > 1.2) c.sitFor = Math.min(c.sitFor, 0);
    } else {
      c.closeFor = 0;
    }
    c.sitFor -= dt;
    // (never in the middle of sitting down)
    if (c.sitFor > 0 || (c.sit > 0 && c.sit < 1)) return;
    // somewhere on or around the plaza, with room round it
    const { plaza } = this.world;
    for (let tries = 0; tries < 8; tries++) {
      const a = this.rng() * Math.PI * 2;
      const d = 1.2 + this.rng() * (plaza.r + 0.6);
      const want = { x: Math.floor(plaza.x + Math.cos(a) * d), y: Math.floor(plaza.y + Math.sin(a) * d) };
      const to = nearestWalkable(want, this.world, c.tile);
      if (!to || sameTile(to, c.tile) || this.spaceAt(to, c) < SPACE) continue;
      const path = this.walkPath(c, to);
      if (path.length > 0 && !this.blocker(c, path)) {
        c.path = path;
        c.closeFor = 0;
        return;
      }
    }
    c.sitFor = 1;
  }
}
