// The living part of the town, without any drawing: where the player, the residents and the cat are, how they walk
// along a path, when a resident wanders, and "walk there, then call back". Plain TypeScript; time comes in as `dt`
// seconds and randomness as a function, so tests can run it step by step.
//
// How people move (docs/town.md §7 "Motion"): speeds are GROUND speeds (tiles per second, the same whichever way on
// the screen); a click walk follows the A* path pulled straight wherever the way is clear (smoothPath), so a walk
// across the plaza is one line, not a staircase; the walk cycle is driven by the distance covered (`phase`, one cycle
// per `stride` tiles), so the feet do not slide; a walk eases in and out; a person turns 45° at a time (`oct` →
// `want`), never in one frame, and a direction needs a clear lead, or a moment, before the body turns
// (hysteresis); the last stride is fitted so the step lands as the body stops (`land`); walks go round people and a
// resident waits for somebody in the way (`giveWay`). The player moves by rules of their own (docs/town.md §7 "Moving
// about"): steered directly (any direction, no tiles), a circle that slides along walls and round people (`moveCircle`,
// `wayAlong`, `TownSim.move`).

import { BODY_RADIUS, distanceTo, inside as isInside, pushOut, walkWorld, type WalkState } from '../../../core/town/colliders';
import type { CropStage } from '../../../core/town/farm';
import { canStep, findPath, lineFits, nearestWalkable, NEIGHBOURS, sameTile, solidsNear, STEP_STRAIGHT, walkable } from '../../../core/town/map';
import { TOWN_WORLD, type ActivitySpot, type Collider, type ActivitySpotId, type PlaceId, type Seat, type Tile, type TownWorld, type WorldPlace } from '../../../data/townWorld';
import { EXTRA_DECOR } from './extraDecor';
import { CAT_STRIDE, personStride } from './gait';
import { activitySeconds, dayPart, folkCount, kidsOut, minutesNow, pickActivity, type Activity } from './life';
import type { TownTheme } from './palette';

/**
 * What floats over a resident's tag: 'new' lines not understood yet, 'repeat' only repeats left, 'heart' all
 * understood on the first listen; 'story' an episode of "Chuyện ở thị trấn" to hear, 'relisten' one due again.
 */
/** The player ("Bạn") and one resident per place. */
export type CharacterId = 'player' | PlaceId;

/** What the player wears and who follows them (loot ids of data/townGame LOOT; an outfit may be a hex colour). */
export interface PlayerLook {
  hat?: string;
  outfit?: string;
  pet?: string;
}

export type Marker = 'new' | 'repeat' | 'heart' | 'story' | 'relisten';

/** Everything the stage is told from outside: plain data the game shell computes. */
/** A child of the learner's character who walks behind them (docs/town.md §15). */
export interface StageKid {
  id: string;
  /** Looks: a seeded child look with the player's skin and a parent's hair colour; smaller while a toddler. */
  skin: string;
  hair: string;
  toddler: boolean;
}

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
  /** What the player wears and who follows them. Left out = nothing worn, nobody following. */
  look?: PlayerLook;
  /** The learner's own character (three/chars/looks playerLookKey): a new key rebuilds the player's model. */
  body?: string;
  /** Their character's name over their head (default "Bạn"). */
  playerName?: string;
  /** Their children old enough to walk (docs/town.md §15): they follow the player, the youngest last. */
  kids?: readonly StageKid[];
  /** Ids of town "projects" decorations to draw (engine/extraDecor.ts knows where each one stands; unknown ids are skipped). */
  extraDecor?: readonly string[];
  /**
   * The farm field's crops, one per planting spot (core/town/farm.ts fieldLook: the learner's review cards as seedlings,
   * growing, ripe or wilting crops). Left out = a calm field of young plants.
   */
  farm?: readonly CropStage[];
}

export type ActorKind = 'player' | 'resident' | 'cat' | 'folk';

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
  /** The way the body faces: an octant of the tile grid (OCTANTS: 0 = +x = SE on the screen, 1 = S …). */
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
  /**
   * The body's direction, radians on the tile grid (atan2(dy, dx)): walking, it steers along the path (corners as
   * arcs) and the walk follows it; standing, it eases to `oct`. Left out (tests), it is taken from `oct`.
   */
  yaw?: number;
  /** Seconds it still stands after the gap rule stopped it, and seconds stopped so in this walk (BUMP_WAIT). */
  bump?: number;
  bumped?: number;
  /** Seconds it has had pace but no way on (advance re-plans the walk). */
  stuck?: number;
  /**
   * Standing, the body keeps the free direction it stopped in (the player under direct control) instead of easing to
   * its octant, until it is asked to turn (face, settle).
   */
  holdYaw?: boolean;
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
  /** Where they live: their place's spot, or (life, their place not built yet) a spot in the boarding house's yard. */
  home: Tile;
  /** Lodging at the boarding house: their place is not built yet (life). */
  lodger: boolean;
  /** What they are doing (life); null = nothing planned yet. */
  doing: Doing | null;
  /** Inside, behind a lit window (life): not drawn, in nobody's way, cannot be clicked. */
  hidden: boolean;
  /** Seated on this seat (life). */
  seat: Seat | null;
  /** Seconds until they may wave at the player again. */
  waveIn: number;
  /** The player was close last frame (they wave when the player comes close, not all the time). */
  sawPlayer: boolean;
  /** Their order in the town (their liking, life.ts). */
  index: number;
}

/** A resident's activity (life): where to, what to face there, until when, with whom. */
export interface Doing {
  kind: Activity;
  /** Where to stand (null: a seat, or nowhere in particular). */
  at: Tile | null;
  /** Which way to face there (an octant), null = settle to the viewer. */
  oct: number | null;
  /** Sim time it ends (set when they get there; a jog: when it began). */
  until: number;
  arrived: boolean;
  seat?: Seat;
  /** What it holds (a seat, a chat spot, a place to stand): nobody else takes it meanwhile. */
  claim?: string;
  /** Chatting with this resident; the one who began the chat leads (it says when somebody speaks). */
  mate?: PlaceId;
  lead?: boolean;
  /** When the next one speaks in a chat (sim time). */
  sayAt?: number;
  /** The jog's next point (index into WORLD_LIFE.jog). */
  leg?: number;
  /** The pace to go back to after a jog. */
  speed?: number;
  /** In front of a seat, turned round: the sim time they sit down. */
  sitAt?: number;
}

/** In front of a seat, turned round, a person waits this long (s) before sitting down; getting up takes RISE_TIME. */
const SIT_TURN_PAUSE = 0.25;
const RISE_TIME = 0.6;

/**
 * Where a person stands to sit on a seat: right in front of it (the way it faces), at the edge of the tile they come
 * from, never on the seat's own tile; sitting down they back onto it, getting up they step forward to here.
 */
export function seatFront(seat: Seat): { x: number; y: number } {
  const o = OCTANTS[seat.oct];
  const l = Math.hypot(o.x, o.y);
  const x = seat.x + (o.x / l) * 0.55;
  const y = seat.y + (o.y / l) * 0.55;
  return Math.floor(x) === seat.from.x && Math.floor(y) === seat.from.y ? { x, y } : centre(seat.from);
}

/** A passer-by (life): a townsperson with no name, with a seeded look of its own (three/characters passerLook). */
export interface Folk extends Actor {
  kind: 'folk';
  /** Whose pace and stride it walks with (a resident of FOLK_BASES). */
  base: CharacterId;
  /** Index into the engine's looks (colours, a child's size). */
  look: number;
  kid: boolean;
  /** Not in town right now (gone off the island's edge, or not come yet). */
  hidden: boolean;
  /** Points still to walk past, the last one the street's end it leaves by. */
  route: Tile[];
  /** Seconds it stands at a point before walking on. */
  pauseIn: number;
  /** Seconds before it comes back into town. */
  spawnIn: number;
}

/** What happened in the sim that the engine shows: a wave at the player, a nod in a chat, a "…" bubble. */
export interface SimEvent {
  kind: 'wave' | 'nod' | 'say';
  id: string;
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

export type Arrival = { kind: 'talk'; placeId: PlaceId } | { kind: 'lot'; placeId: PlaceId } | { kind: 'tile'; tile: Tile } | { kind: 'activity'; id: ActivitySpotId };

/** Options of the sim. `life`: everyday life (docs/town.md §7 "Life"); off, the town of before (tests). */
export interface SimOptions {
  life?: boolean;
  /** Minutes since local midnight (life.ts minutesNow): what the residents feel like doing. */
  clock?: () => number;
}

/** A jog is this much faster than a stroll. */
const JOG_SPEED = 1.55;
/** A child's pace (tiles a second) and size (the stride is this much shorter). */
export const KID_SCALE = 0.74;
const KID_SPEED = 0.75;
/** The passers-by: how many there are at most, and which of them are children. */
const FOLK_POOL = 7;
const FOLK_KIDS = new Set([5, 6]);
/** Whose stride each passer-by walks with. */
export const FOLK_BASES: readonly CharacterId[] = ['shop', 'office', 'home', 'cinema', 'station', 'friend', 'school'];
/** Within this (world px on the screen) a resident notices the player coming and waves (now and then). */
const WAVE_NEAR = 112;

interface Errand {
  target: Tile;
  arrival: Arrival;
  then?: () => void;
}

/**
 * Ground speeds, tiles per second: the player walks and runs a long click walk (or with Shift held), residents stroll
 * (each ±10%), the cat pads along. The legs set the cadence (chars/anim.ts stepLength). The player's pace is for
 * exploring a 44-tile town under direct control (2026-11-21, after the owner found 1.05 / 2.1 sluggish and the keys
 * "delayed"): responsiveness first, the cadence follows.
 */
export const PLAYER_SPEED = 1.6;
export const PLAYER_RUN = 2.8;
/**
 * The player's own motion (docs/town.md §7 "Moving about"): full pace in PLAYER_ACCEL seconds, a stop in PLAYER_STOP
 * (keys let go) or PLAYER_ARRIVE (the end of a click walk, braking on the distance left), the body turning at
 * PLAYER_TURN rad/s (90° in about 0.1 s) and the walk following the body, a circle of PLAYER_RADIUS against walls.
 */
export const PLAYER_ACCEL = 0.09;
export const PLAYER_STOP = 0.07;
export const PLAYER_ARRIVE = 0.14;
export const PLAYER_TURN = 16;
export const PLAYER_RADIUS = BODY_RADIUS;
/** A held key pushing into somebody standing in the way this long (s): they step aside. */
const PUSH_ASIDE = 0.4;
/** A click walk making (almost) no way this long (s): it looks for another way, or asks somebody to step aside. */
const STALL_REPATH = 0.3;
/** A click walk longer than this (tiles of path) is run; the run turns back into a walk this far from its end. */
export const RUN_FAR = 7;
const RUN_UNTIL = 2.2;
export const RESIDENT_SPEED = 0.7;
export const CAT_SPEED = 0.65;
/** From standing to full pace, and from full pace to a stop, seconds. */
export const START_TIME = 0.14;
export const STOP_TIME = 0.28;
/** A turn takes this long per 45° (the first step at once): walking (or about to), and standing (an easy turn). */
export const TURN_STEP = 0.07;
export const TURN_STEP_STAND = 0.12;
/**
 * Standing this long after a walk (still), a person turns three-quarters to the viewer: not at once (a robot), only
 * once they have plainly stopped there.
 */
export const SETTLE_AFTER = 1.5;
/**
 * The body's own direction (`yaw`, radians on the grid) while walking: it steers toward a point CARROT tiles on along
 * the path (corners become arcs), turning at a rate of YAW_GAIN × the error, never quicker than a turn of TURN_RADIUS
 * at this pace (on the spot: YAW_STAND rad/s); the walk follows the body, and slows while the body is off its way
 * (no walking sideways or backwards). Standing, the yaw eases to the octant the person faces.
 */
const CARROT = 0.45;
const YAW_GAIN = 14;
const TURN_RADIUS = 0.28;
const YAW_STAND = 7;
/** A path point this near (tiles) with more of the path after it counts as passed (the arc goes inside it). */
const PASSED = 0.3;
/** After being stopped by the gap rule (MIN_GAP), a walker stands this long before it moves again (no creeping). */
const BUMP_WAIT = 0.35;
/** A resident or passer-by stopped this often by the gap rule (seconds stopped in one walk) finds another way. */
const BUMP_GIVE_UP = 0.9;
/**
 * Walking, the body changes direction at once when the way lies more than HYSTERESIS degrees past the edge of its
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
/** While the town has just opened (sim seconds), a new suggested resident further than HINT_HOME_FAR tiles is put by their door. */
const HINT_HOME_UNTIL = 1;
const HINT_HOME_FAR = 7;
/** A resident walking to a staged talk (gather) goes at least this fast (tiles/s): a brisk walk, not a jog. */
export const HURRY_SPEED = 1.25;
/** Two people talking stand this far apart (tiles): close enough to talk, apart on the screen. */
export const TALK_GAP = 1.05;
/** A conversation that begins with the resident further than this (tiles) from the player brings them over at once. */
export const ENGAGE_FAR = 2.5;
/** The cat sits down or gets up in this many seconds. */
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
    yaw: octAngle(1),
    bump: 0,
    bumped: 0,
  };
}

/**
 * A step of a walk to (nx, ny) heading for point c: onto open ground, or onto c's own tile (a bench is walked onto),
 * or anywhere when it stands on blocked ground already (it walks off it).
 */
function mayStep(a: Actor, nx: number, ny: number, c: Pt2, world: TownWorld): boolean {
  if (openAt(nx, ny, world) || !openAt(a.x, a.y, world)) return true;
  return Math.floor(nx) === Math.floor(c.x) && Math.floor(ny) === Math.floor(c.y);
}

/** People near a walker (advance): reused every call, no garbage. */
const NEAR: Pt2[] = [];

/** The direction of an octant, radians on the tile grid. */
export function octAngle(oct: number): number {
  const o = OCTANTS[((oct % 8) + 8) % 8];
  return Math.atan2(o.y, o.x);
}

/** Shortest signed angle from a to b (radians). */
function angleTo(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Where a walker heads for: a point CARROT tiles on along its path (round a corner of it already), when the straight
 * line there is clear; otherwise the next point of the path itself.
 */
function carrot(a: Actor, world: TownWorld, people: readonly Pt2[]): Pt2 {
  for (let k = 0; k < 2; k++) {
    let left = k === 0 ? CARROT : CARROT * 0.5;
    let px = a.x;
    let py = a.y;
    let found = false;
    for (const t of a.path) {
      const cx = t.x + 0.5;
      const cy = t.y + 0.5;
      const l = Math.hypot(cx - px, cy - py);
      if (l >= left) {
        AIM.x = px + ((cx - px) * left) / l;
        AIM.y = py + ((cy - py) * left) / l;
        found = true;
        break;
      }
      left -= l;
      px = cx;
      py = cy;
    }
    if (!found) {
      AIM.x = px;
      AIM.y = py;
    }
    if (lineClear(a.x, a.y, AIM.x, AIM.y, world, people)) return AIM;
  }
  AIM.x = a.path[0].x + 0.5;
  AIM.y = a.path[0].y + 0.5;
  return AIM;
}

/** The point a walker heads for (carrot): one shared object, read straight away (no garbage every frame). */
const AIM: Pt2 = { x: 0, y: 0 };

// ───────────────────────── straight lines through the grid ─────────────────────────

/** A point of the tile grid is on a walkable tile. */
function openAt(x: number, y: number, world: TownWorld): boolean {
  return walkable({ x: Math.floor(x), y: Math.floor(y) }, world);
}

/**
 * The straight line from (ax, ay) to (bx, by) stays on walkable tiles with CLEARANCE to spare on both sides (so it
 * never grazes the corner of a house or cuts between two blocked tiles that touch at a corner), or it is a squeeze the
 * path finder takes: within one tile or one diagonal step it allows (map.ts canStep: between two trees standing corner
 * to corner, a body fits), with a body's room to spare from the real colliders (map.ts lineFits).
 */
export function lineClear(ax: number, ay: number, bx: number, by: number, world: TownWorld = TOWN_WORLD, people: readonly Pt2[] = []): boolean {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-9) return openAt(ax, ay, world);
  if (!tilesClear(ax, ay, bx, by, len, world) && !squeezeClear(ax, ay, bx, by, world)) return false;
  if (people.length === 0) return true;
  // nobody walks through (or brushes past) a person: PASS to spare; somebody the walker already stands beside: the
  // line may go on past them, but never nearer
  const n = Math.ceil(len / 0.05);
  const from = people.map((p) => Math.hypot(p.x - ax, p.y - ay));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const x = ax + (bx - ax) * k;
    const y = ay + (by - ay) * k;
    for (let j = 0; j < people.length; j++) {
      const d = Math.hypot(people[j].x - x, people[j].y - y);
      if (d < PASS && !(from[j] < PASS && d >= from[j] - 0.02)) return false;
    }
  }
  return true;
}

/** The line stays on walkable tiles with CLEARANCE to spare on both sides (the ends: the tiles only). */
function tilesClear(ax: number, ay: number, bx: number, by: number, len: number, world: TownWorld): boolean {
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  const n = Math.ceil(len / 0.05);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = ax + (bx - ax) * k;
    const y = ay + (by - ay) * k;
    if (!openAt(x, y, world)) return false;
    if (i > 0 && i < n && (!openAt(x + nx * CLEARANCE, y + ny * CLEARANCE, world) || !openAt(x - nx * CLEARANCE, y - ny * CLEARANCE, world))) return false;
  }
  return true;
}

/** Within one tile, or one diagonal step canStep allows, and a body fits along the line among the real colliders. */
function squeezeClear(ax: number, ay: number, bx: number, by: number, world: TownWorld): boolean {
  const ta = { x: Math.floor(ax), y: Math.floor(ay) };
  const dx = Math.floor(bx) - ta.x;
  const dy = Math.floor(by) - ta.y;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx !== 0 && dy === 0) || (dx === 0 && dy !== 0)) return false;
  if (!walkable(ta, world)) return false;
  if ((dx !== 0 || dy !== 0) && !canStep(ta, { x: dx, y: dy }, world)) return false;
  return lineFits(world, ax, ay, bx, by, PLAYER_RADIUS);
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
  const here = { x: Math.floor(x), y: Math.floor(y) };
  // (standing on a closed tile, beside a post: straight on to the first tile, never back to that tile's centre)
  if (walkable(here, world) && !lineClear(ax, ay, tiles[0].x + 0.5, tiles[0].y + 0.5, world, people)) {
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
export function advance(a: Actor, dt: number, more?: () => Tile | null, cap = Infinity, world: TownWorld = TOWN_WORLD, people: readonly Pt2[] = []): boolean {
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
    a.bumped = 0;
    if (a.yaw === undefined) a.yaw = octAngle(a.oct);
  }
  // only those near enough to matter for the next stretch of the way
  NEAR.length = 0;
  for (const o of people) if (Math.abs(o.x - a.x) < 1.6 && Math.abs(o.y - a.y) < 1.6) NEAR.push(o);
  people = NEAR;
  // points already passed (the arc round a corner goes inside them) are done with
  while (a.path.length >= 2) {
    const p0 = centre(a.path[0]);
    const p1 = centre(a.path[1]);
    const d0 = Math.hypot(p0.x - a.x, p0.y - a.y);
    const ahead = (a.x - p0.x) * (p1.x - p0.x) + (a.y - p0.y) * (p1.y - p0.y) > 0;
    // (never when the way on from here would brush past somebody: then it goes to the point itself)
    if (d0 > 1e-6 && !((d0 < PASSED || (d0 < 0.8 && ahead)) && lineClear(a.x, a.y, p1.x, p1.y, world, people))) break;
    a.path.shift();
  }
  // held keys: the next tile is asked for before this one is reached (the turn into it is an arc too); none (a
  // wall, somebody in the way): this is the last tile, and the walk eases to a stop on it, never an abrupt halt
  let last = false;
  if (more && a.path.length === 1) {
    const n = more();
    if (n && !sameTile(n, a.path[0])) {
      const c = centre(a.path[0]);
      if (Math.hypot(c.x - a.x, c.y - a.y) < CARROT) a.path.push(n);
    } else if (!n) last = true;
  }
  // which way: towards the next point, with hysteresis on the body's direction
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
  // the body steers toward a point a little way on along the path, never quicker than a tight turn at this pace
  let yaw = a.yaw ?? octAngle(a.oct);
  let off = 0;
  let aim: Pt2 | null = null;
  if (a.path.length > 0) {
    aim = carrot(a, world, people);
    const way = Math.atan2(aim.y - a.y, aim.x - a.x);
    const err = angleTo(yaw, way);
    const most = Math.max(YAW_STAND, a.v / TURN_RADIUS) * dt;
    yaw = angleTo(0, yaw + Math.max(-most, Math.min(most, err * (1 - Math.exp(-YAW_GAIN * dt)))));
    off = Math.abs(angleTo(yaw, way));
  }
  a.yaw = yaw;
  // the walk goes the way the body faces: well off its way it slows (a sharp turn), half a turn off it turns on the spot
  const gate = Math.max(0, Math.min(1, (Math.cos(off) - 0.2) / 0.7));
  let top = Math.min(cap, a.speed * gate);
  // somebody in the way: no stride is fitted to a stop that is not the end of the walk (the legs close the step)
  if (cap === 0) a.land = null;
  const before = more && !last ? Infinity : pathLeft(a);
  if (!more || last) top = Math.min(top, Math.max(a.speed * 0.3, Math.sqrt((2 * a.speed * before) / STOP_TIME)));
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
    // along the body's direction (an arc round a corner); the last few hundredths straight onto the end point
    const ux = Math.cos(yaw);
    const uy = Math.sin(yaw);
    const along = (c.x - a.x) * ux + (c.y - a.y) * uy;
    if (d > left && (a.path.length > 1 || d > 0.12) && along > 0) {
      const nx = a.x + ux * left;
      const ny = a.y + uy * left;
      // (grazing a corner: along the clear line to the point aimed at instead, never a step sideways)
      const al = aim ? Math.hypot(aim.x - a.x, aim.y - a.y) : 0;
      const ax = aim && al > 1e-6 ? a.x + ((aim.x - a.x) * left) / al : nx;
      const ay = aim && al > 1e-6 ? a.y + ((aim.y - a.y) * left) / al : ny;
      const ok = mayStep(a, nx, ny, c, world) ? 1 : al > left && mayStep(a, ax, ay, c, world) ? 2 : 0;
      if (ok > 0) {
        a.x = ok === 1 ? nx : ax;
        a.y = ok === 1 ? ny : ay;
        moved += left;
        left = 0;
        a.tile = { x: Math.floor(a.x), y: Math.floor(a.y) };
        break;
      }
    }
    // the point is behind (the arc went past it): on to the next one; the end of the walk: no walking backwards,
    // the body turns to it first
    if (along <= 0 && d > 0.12) {
      if (a.path.length > 1) {
        a.path.shift();
        continue;
      }
      left = 0;
      break;
    }
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
      const nx = a.x + ((c.x - a.x) * left) / d;
      const ny = a.y + ((c.y - a.y) * left) / d;
      // never onto a blocked tile: grazing a corner, it slides along the edge (one axis at a time)
      for (const [sx, sy] of [
        [nx, ny],
        [nx, a.y],
        [a.x, ny],
      ]) {
        if (!mayStep(a, sx, sy, c, world)) continue;
        moved += Math.hypot(sx - a.x, sy - a.y);
        a.x = sx;
        a.y = sy;
        a.tile = { x: Math.floor(a.x), y: Math.floor(a.y) };
        break;
      }
      left = 0;
    }
  }
  if (a.starting && a.v >= a.speed * 0.6) a.starting = false;
  // pace, facing the way, but (almost) no way on (an arc that came too near a corner: a slide along a wall at a
  // crawl): after a moment the rest of the walk is found afresh
  if (a.v > 0.05 && off < 0.5 && moved < 0.3 * a.v * dt && a.path.length > 0) {
    a.stuck = (a.stuck ?? 0) + dt;
    if (a.stuck > 0.25) {
      a.stuck = 0;
      const end = a.path[a.path.length - 1];
      const tiles = findPath(a.tile, tileOf(centre(end)), world);
      if (tiles.length > 0) {
        const again = smoothPath(a.x, a.y, tiles, world);
        // the end may be a point off its tile's centre (a seat's front, a talk spot): kept as it was
        again[again.length - 1] = end;
        // (smoothPath goes first to the middle of the tile it stands on only when the way on is not clear from here)
        a.path = again;
      }
    }
  } else a.stuck = 0;
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
 * Walking: look (and face) the way of the step (dx, dy). The body takes a new octant at once when the way is
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
  // the player stopped in a free direction keeps it until asked to turn
  if (a.holdYaw && a.want !== a.oct) a.holdYaw = false;
  turn(a, dt);
  // the body eases round to the octant it faces (a turn on the spot, never a snap)
  const goal = octAngle(a.oct);
  const yaw = a.yaw ?? goal;
  const err = angleTo(yaw, goal);
  const most = YAW_STAND * dt;
  if (!a.holdYaw) a.yaw = Math.abs(err) < 1e-4 ? goal : angleTo(0, yaw + Math.max(-most, Math.min(most, err * (1 - Math.exp(-YAW_GAIN * 0.6 * dt)))));
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

/** Beyond this angle (radians) between the body and somebody it looks at, the body turns too (the head does the rest). */
export const HEAD_REACH = (70 * Math.PI) / 180;

/**
 * Look at a point, the way a person does: the head turns (the engine), the body only when the point lies further
 * round than HEAD_REACH from where the body faces (no turning to and fro as somebody walks past).
 */
export function faceIfFar(a: Actor, x: number, y: number): void {
  const to = Math.atan2(y - a.y, x - a.x);
  if (Math.abs(angleTo(octAngle(a.want), to)) <= HEAD_REACH) return;
  face(a, x, y);
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

// ───────────────────────── the player's body: a circle among walls and people ─────────────────────────

/** Somebody the player keeps clear of: where they stand and how near the player may come (centre to centre). */
export interface Body {
  x: number;
  y: number;
  gap: number;
}

/**
 * The solid things a walker's centre stands inside (it was put there, or something was built round it): left alone
 * by its moves, so it walks off them. Null = none (the usual case).
 */
type Inside = readonly Collider[] | null;

function insideAt(x: number, y: number, world: TownWorld): Inside {
  let out: Collider[] | null = null;
  solidsNear(world, x, y, x, y, (c) => {
    if (isInside(c, x, y)) (out ??= []).push(c);
  });
  return out;
}

/**
 * Push a circle (centre x, y; radius r) out of every solid thing it overlaps (core/town/colliders.ts: a post, a trunk,
 * a house, the water's tiles…): along a wall it slides, round a corner or a post it rounds it. What the circle started
 * inside (`inside`) is left alone: it walks off it.
 */
function outOfWalls(x: number, y: number, r: number, world: TownWorld, inside: Inside): Pt2 {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    const ax = x;
    const ay = y;
    solidsNear(world, ax - r, ay - r, ax + r, ay + r, (c) => {
      if (inside && inside.includes(c)) return;
      const to = pushOut(c, x, y, r);
      if (!to) return;
      x = to.x;
      y = to.y;
      moved = true;
    });
    if (!moved) break;
  }
  return { x, y };
}

/** The circle overlaps nothing solid (but what it stood inside). */
function wallsFree(x: number, y: number, r: number, world: TownWorld, inside: Inside): boolean {
  let free = true;
  solidsNear(world, x - r, y - r, x + r, y + r, (c) => {
    if (free && !(inside && inside.includes(c)) && distanceTo(c, x, y) < r - 1e-6) free = false;
  });
  return free;
}

/** A body of radius `r` fits at (x, y): nothing solid under it (core/town/colliders.ts). */
export function bodyFits(x: number, y: number, r: number, world: TownWorld = TOWN_WORLD): boolean {
  return wallsFree(x, y, r, world, null);
}

/**
 * The nearest point to (x, y) where a body of radius `r` fits (something was built or bought where it stood): rings
 * of points round it, closest first. (x, y) itself when it fits already; null when nothing fits within 4 tiles.
 */
export function nearestFit(x: number, y: number, r: number, world: TownWorld = TOWN_WORLD): Pt2 | null {
  if (wallsFree(x, y, r, world, null)) return { x, y };
  for (let d = 0.05; d <= 4; d += 0.05) {
    const n = Math.max(8, Math.ceil((Math.PI * 2 * d) / 0.05));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (wallsFree(px, py, r, world, null)) return { x: px, y: py };
    }
  }
  return null;
}

/**
 * Move a circle of radius `r` by (dx, dy): it slides along walls and round corners and round people (never nearer to
 * anybody than their `gap`, or than it already was), and never into a wall. Pure: the same on the screen and in tests.
 */
export function moveCircle(x: number, y: number, dx: number, dy: number, r: number, world: TownWorld = TOWN_WORLD, people: readonly Body[] = []): Pt2 {
  const inside = insideAt(x, y, world);
  const len = Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(len / 0.1));
  let px = x;
  let py = y;
  for (let k = 0; k < n; k++) {
    const sx = px;
    const sy = py;
    let at = outOfWalls(px + dx / n, py + dy / n, r, world, inside);
    // people: pushed out to their gap (never nearer than this sub-step began), then out of the walls again
    for (let pass = 0; pass < 2; pass++) {
      let pushed = false;
      for (const o of people) {
        const was = Math.hypot(o.x - sx, o.y - sy);
        const limit = Math.min(o.gap, was);
        const ox = at.x - o.x;
        const oy = at.y - o.y;
        const d = Math.hypot(ox, oy);
        if (d >= limit - 1e-9) continue;
        if (d < 1e-9) continue;
        at = { x: o.x + (ox / d) * (limit + 1e-6), y: o.y + (oy / d) * (limit + 1e-6) };
        pushed = true;
      }
      if (!pushed) break;
      at = outOfWalls(at.x, at.y, r, world, inside);
    }
    // squeezed between a wall and somebody: this sub-step is not taken
    const bad = people.some((o) => {
      const d = Math.hypot(o.x - at.x, o.y - at.y);
      return d < Math.min(o.gap, Math.hypot(o.x - sx, o.y - sy)) - 1e-9;
    });
    if (bad || !wallsFree(at.x, at.y, r, world, inside)) break;
    // a slide never goes further than the step asked (a push round somebody adds no pace)
    const want = len / n;
    const got = Math.hypot(at.x - sx, at.y - sy);
    if (got > want + 1e-9) {
      const k = want / got;
      const cx = sx + (at.x - sx) * k;
      const cy = sy + (at.y - sy) * k;
      if (wallsFree(cx, cy, r, world, inside) && people.every((o) => Math.hypot(o.x - cx, o.y - cy) >= Math.min(o.gap, Math.hypot(o.x - sx, o.y - sy)) - 1e-9)) at = { x: cx, y: cy };
    }
    px = at.x;
    py = at.y;
  }
  return { x: px, y: py };
}

/**
 * Where a walker of radius `r` really goes when it heads along `u` (a unit vector) from (x, y): `u` itself on open
 * ground; along the wall or round the person it would meet (a slide); and, pressed head-on against a wall's end with
 * a way past just beside it (a corner, a gate), a sidestep into that way (`face` half way between: a step round the
 * corner, never a sideways shuffle).
 */
export function wayAlong(x: number, y: number, u: Pt2, r: number, world: TownWorld = TOWN_WORLD, people: readonly Body[] = []): { move: Pt2; face: Pt2; blocked: boolean } {
  const L = 0.16;
  const px = -u.y;
  const py = u.x;
  const inside = insideAt(x, y, world);
  // somebody about to be met nearly head on: round them, on the side the walker already leans to (a slide off a
  // circle met straight on would only creep)
  let who: Body | null = null;
  for (const o of people) {
    const ox = o.x - x;
    const oy = o.y - y;
    const d = Math.hypot(ox, oy);
    if (d < o.gap + L && (ox * u.x + oy * u.y) / Math.max(1e-6, d) > 0.7 && (!who || d < Math.hypot(who.x - x, who.y - y))) who = o;
  }
  if (who) {
    const ox = who.x - x;
    const oy = who.y - y;
    const d = Math.max(1e-6, Math.hypot(ox, oy));
    // which side of the way they stand (+ = to the left of it)
    const lean = ox * px + oy * py;
    const sides = Math.abs(lean) > 1e-3 ? [-Math.sign(lean)] : [1, -1];
    for (const side of [...sides, -sides[0]]) {
      // only a side with room to pass them (the body fits beside them there)
      const bx = who.x + px * side * (who.gap + 0.02);
      const by = who.y + py * side * (who.gap + 0.02);
      if (!wallsFree(bx, by, r, world, inside) || people.some((o) => o !== who && Math.hypot(o.x - bx, o.y - by) < o.gap)) continue;
      // the tangent round them on that side, a little forward
      const tx = (-oy / d) * side;
      const ty = (ox / d) * side;
      const k = Math.hypot(tx + u.x * 0.2, ty + u.y * 0.2);
      const mv = { x: (tx + u.x * 0.2) / k, y: (ty + u.y * 0.2) / k };
      const go = moveCircle(x, y, mv.x * L, mv.y * L, r, world, people);
      if (Math.hypot(go.x - x, go.y - y) > 0.5 * L) return { move: mv, face: mv, blocked: false };
    }
  }
  const to = moveCircle(x, y, u.x * L, u.y * L, r, world, people);
  const mx = to.x - x;
  const my = to.y - y;
  const m = Math.hypot(mx, my);
  // free, or a slide (along a wall, round somebody): the body faces the way it really goes. Nearly head-on into a wall
  // (under a third of the way left) is no slide: it stands rather than shoot off along the wall
  if (m > 0.3 * L) return { move: { x: mx / m, y: my / m }, face: { x: mx / m, y: my / m }, blocked: false };
  // head on into a wall: a way past a little to one side (the corner of a house, a gap in a fence)?
  for (const s of [0.1, 0.2, 0.3, 0.4]) {
    for (const side of [1, -1]) {
      const ox = x + px * side * s;
      const oy = y + py * side * s;
      if (!wallsFree(ox, oy, r, world, inside) || people.some((o) => Math.hypot(o.x - ox, o.y - oy) < o.gap)) continue;
      // the sidestep itself must be clear, and from there the way on
      const side1 = moveCircle(x, y, px * side * s, py * side * s, r, world, people);
      if (Math.hypot(side1.x - ox, side1.y - oy) > 0.02) continue;
      const on = moveCircle(ox, oy, u.x * 0.35, u.y * 0.35, r, world, people);
      if (Math.hypot(on.x - ox, on.y - oy) < 0.3) continue;
      const k = Math.hypot(px * side + u.x * 0.35, py * side + u.y * 0.35);
      const move = { x: (px * side + u.x * 0.35) / k, y: (py * side + u.y * 0.35) / k };
      // the body turns half way into the sidestep (a step round the corner, not a sideways shuffle)
      const f = Math.hypot(move.x + u.x, move.y + u.y);
      return { move, face: { x: (move.x + u.x) / f, y: (move.y + u.y) / f }, blocked: false };
    }
  }
  return { move: u, face: u, blocked: true };
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

/** How big each town project's piece is on the ground (three/scene/props3d.ts buildProject); none on the water. */
const PROJECT_HALF: Readonly<Record<string, { x: number; y0: number; y1: number }>> = {
  'proj-clock-tower': { x: 0.35, y0: -0.35, y1: 0.35 },
  'proj-festival': { x: 0.8, y0: -0.5, y1: 0.5 },
  'proj-garden': { x: 0.9, y0: -0.9, y1: 0.9 },
};

/** The colliders of the town projects built (engine/extraDecor.ts EXTRA_DECOR spots). */
export function projectColliders(ids: readonly string[] | undefined): Collider[] {
  const out: Collider[] = [];
  for (const id of ids ?? []) {
    const h = PROJECT_HALF[id];
    if (!h) continue;
    (EXTRA_DECOR[id] ?? []).forEach((s, i) => out.push({ kind: 'box', x0: s.at.x - h.x, y0: s.at.y + h.y0, x1: s.at.x + h.x, y1: s.at.y + h.y1, what: `proj:${id}:${i}` }));
  }
  return out;
}

/** How far a forest block keeps in from its tile's edges (tiles): two side by side leave a gap no body fits through. */
const FOREST_INSET = 0.1;

/**
 * The woods as solid blocks: a tree of the map (WORLD_ROWS) that has another tree right beside it (not only corner to
 * corner) blocks its whole tile, not only its trunk, so a body never squeezes in between the trunks of a wood and
 * gets wedged there (a lone tree, and two trees corner to corner, keep their round trunks).
 */
export function forestColliders(world: TownWorld): Collider[] {
  const tree = (x: number, y: number) => {
    const c = world.rows[y]?.[x];
    return c === 'T' || c === 't';
  };
  const out: Collider[] = [];
  for (let y = 0; y < world.rows.length; y++) {
    for (let x = 0; x < world.rows[y].length; x++) {
      if (!tree(x, y) || !(tree(x - 1, y) || tree(x + 1, y) || tree(x, y - 1) || tree(x, y + 1))) continue;
      out.push({ kind: 'box', x0: x + FOREST_INSET, y0: y + FOREST_INSET, x1: x + 1 - FOREST_INSET, y1: y + 1 - FOREST_INSET, what: `wood:${x},${y}` });
    }
  }
  return out;
}

const FORESTS = new WeakMap<TownWorld, Collider[]>();
function forestOf(world: TownWorld): Collider[] {
  let f = FORESTS.get(world);
  if (!f) {
    f = forestColliders(world);
    FORESTS.set(world, f);
  }
  return f;
}

export class TownSim {
  /** The town as it stands now (core/town/colliders.ts walkWorld: what is built and bought blocks the way). */
  world: TownWorld;
  /** The town as given, before any state. */
  private readonly base: TownWorld;
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
  /** The way the keys steer the player (a unit vector on the tile grid), null = no key held. */
  private steerDir: Pt2 | null = null;
  /** The player's intended pace along the body (tiles/s; `player.v` is the pace really made). */
  private drive = 0;
  /** Seconds a held key has pushed into somebody standing in the way; seconds a click walk has made no way. */
  private pushFor = 0;
  private stallFor = 0;
  /** Where the player is walking to (for the marker on the ground), if anywhere. */
  goal: Tile | null = null;
  /** The resident in a conversation with the player: the others keep their distance and stop strolling. */
  private talking: PlaceId | null = null;
  /** Sim time the player's click walk last looked for a way round somebody in it. */
  private repathAt = -Infinity;
  /** Somebody the player's click walk squeezes past (SQUEEZE_AFTER): not in its way, and no gap kept to them. */
  private squeeze: Actor | null = null;
  /** Shift held (run), and the click walk being long enough to run (RUN_FAR). */
  private running = false;
  private errandRun = false;
  /** Everyday life (docs/town.md §7 "Life"): everybody in town from the first day, schedules, passers-by. */
  readonly life: boolean;
  private readonly clock: () => number;
  /** What the engine shows of the sim's life this frame (waves, nods, "…" bubbles); it empties the list. */
  readonly events: SimEvent[] = [];
  /** The passers-by (life). */
  readonly folk: Folk[] = [];
  /** What is held: seats, chat spots, places to stand, by key → who holds it. */
  private claims = new Map<string, string>();
  private decorations = new Set<string>();
  /** The resident the main button suggests: never goes inside (the player is sent to them). */
  private hinted: PlaceId | null = null;
  /** Residents placed at their first activity at once (the town is already alive when the page opens). */
  private seeded = false;
  /** Residents hurrying to a staged talk (gather), with the pace they had before. */
  private readonly hurried = new Map<string, number>();

  constructor(world: TownWorld = TOWN_WORLD, rng: () => number = Math.random, start?: Tile, opts: SimOptions = {}) {
    this.world = world;
    this.base = world;
    this.rng = rng;
    this.life = !!opts.life && !!world.life;
    this.clock = opts.clock ?? (() => minutesNow());
    const at = start && walkable(start, world) ? start : world.start;
    this.player = makeActor('player', 'player', at, PLAYER_SPEED, personStride('player'));
    if (this.life) {
      for (let i = 0; i < FOLK_POOL; i++) {
        const base = FOLK_BASES[i % FOLK_BASES.length];
        const kid = FOLK_KIDS.has(i);
        const f: Folk = {
          ...makeActor(`folk${i}`, 'folk', world.start, kid ? KID_SPEED : RESIDENT_SPEED * (1 + this.rng() * 0.25), personStride(base) * (kid ? KID_SCALE : 1)),
          kind: 'folk',
          base,
          look: i,
          kid,
          hidden: true,
          route: [],
          pauseIn: 0,
          spawnIn: 0,
        };
        this.folk.push(f);
      }
    }
  }

  /** The resident the main button suggests (life: they stay out on the street to be found). */
  setHint(id: PlaceId | null): void {
    this.hinted = id;
    const r = id ? this.residents.get(id) : null;
    if (r && r.doing?.kind === 'inside') this.endDoing(r);
    // the town just opened: the suggested resident is found by their own door, not across the island on an errand
    // (easy to find; the camera only follows the player)
    if (r && this.time < HINT_HOME_UNTIL && !r.hidden && !r.engaged && Math.hypot(r.x - this.player.x, r.y - this.player.y) > HINT_HOME_FAR) {
      this.endDoing(r);
      this.begin(r, 'home', true);
    }
  }

  /**
   * Residents appear with their place and leave with it (life: everybody is in town, lodging until then); the cat
   * comes when bought. What is built and bought blocks the way from now on (walkWorld); whoever stood where it went up
   * steps out to the nearest free spot (`makeRoom`).
   */
  setState(state: Pick<StageState, 'built' | 'decorations' | 'sites' | 'extraDecor'>): void {
    this.built = new Set(state.built);
    this.sites = state.sites ? new Set(state.sites) : null;
    this.decorations = new Set(state.decorations);
    const walk: WalkState = { built: state.built, sites: state.sites, decorations: state.decorations, extraDecor: state.extraDecor };
    const was = this.world;
    this.world = walkWorld(this.base, walk, [...forestOf(this.base), ...projectColliders(state.extraDecor)]);
    if (this.world !== was) this.makeRoom();
    this.world.places.forEach((p, index) => {
      const has = this.residents.has(p.id);
      const here = this.life || this.built.has(p.id);
      if (here && !has) {
        const lodger = !this.built.has(p.id);
        const home = lodger ? this.yardSpot(index) : p.spot;
        const r: Resident = {
          ...makeActor(p.id, 'resident', home, RESIDENT_SPEED * (0.9 + this.rng() * 0.2), personStride(p.id)),
          kind: 'resident',
          place: p,
          wanderIn: 3 + this.rng() * 8,
          lookIn: 2 + this.rng() * 4,
          engaged: false,
          avoid: null,
          closeFor: 0,
          home,
          lodger,
          doing: null,
          hidden: false,
          seat: null,
          waveIn: 2 + this.rng() * 6,
          sawPlayer: false,
          index,
        };
        // everybody breathes at their own moment
        r.restSince = this.time - this.rng() * 1.3;
        // look towards the middle of town
        face(r, this.world.plaza.x, this.world.plaza.y);
        r.oct = r.want;
        this.residents.set(p.id, r);
      } else if (!here && has) {
        this.residents.delete(p.id);
      } else if (has) {
        const r = this.residents.get(p.id)!;
        const lodger = !this.built.has(p.id);
        if (r.lodger !== lodger) {
          // their house was built: they move in (and the other way, a reset: back to the boarding house)
          r.lodger = lodger;
          r.home = lodger ? this.yardSpot(index) : p.spot;
          if (r.doing && !r.engaged) this.endDoing(r);
        }
      }
    });
    if (this.life && !this.seeded) {
      this.seedLife();
      this.seeded = true;
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

  /**
   * Something went up (a house built, a decoration bought): nobody is left inside it. The player's body steps out to
   * the nearest spot it fits and a click walk through it is planned again; a resident, the cat or a passer-by on a
   * tile now closed steps to the nearest open one and starts afresh (a walk through it is dropped). Seated people and
   * those inside stay.
   */
  private makeRoom(): void {
    const p = this.player;
    const fit = nearestFit(p.x, p.y, PLAYER_RADIUS, this.world);
    if (fit && (fit.x !== p.x || fit.y !== p.y)) {
      p.x = fit.x;
      p.y = fit.y;
      p.tile = tileOf(fit);
    }
    const shut = (t: Tile) => !openAt(t.x + 0.5, t.y + 0.5, this.world);
    if (p.path.some(shut)) {
      const e = this.errand;
      const path = e ? this.playerPath(e.target) : [];
      if (path.length > 0) p.path = path;
      else {
        p.path = [];
        this.cancelErrand();
      }
    }
    const others: Actor[] = [...this.residents.values(), ...this.folk];
    if (this.cat) others.push(this.cat);
    for (const a of others) {
      if ((a as Resident).hidden || (a as Resident).seat) continue;
      const blocked = !openAt(a.x, a.y, this.world);
      if (!blocked && !a.path.some(shut)) continue;
      if (blocked) {
        const t = nearestWalkable(tileOf({ x: a.x, y: a.y }), this.world, tileOf({ x: a.x, y: a.y }));
        if (t) {
          a.x = t.x + 0.5;
          a.y = t.y + 0.5;
          a.tile = { ...t };
        }
      }
      a.path = [];
      a.moving = false;
      a.v = 0;
      a.land = null;
      a.stepping = false;
      const r = a as Resident;
      if (r.kind === 'resident' && r.doing && !r.engaged) this.endDoing(r);
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
    if (id.startsWith('folk')) return this.folk.find((f) => f.id === id && !f.hidden) ?? null;
    const r = this.residents.get(id as PlaceId);
    return r && !r.hidden ? r : null;
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
    // whatever they were doing waits: up from the bench, out of the door
    this.wake(r);
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
    if (!this.send(best, { kind: 'talk', placeId: id }, then)) return false;
    this.closeIn(stand);
    return true;
  }

  /**
   * Walk to an activity's spot (the pier, the farm field, the egg kiosk, the boarding house's door, the notice board)
   * and look at it; `then` runs on arrival. Whoever stands right there makes way. False when there is no way.
   */
  walkToActivity(id: ActivitySpotId, then?: () => void): boolean {
    const spot: ActivitySpot | undefined = this.world.activities?.[id];
    if (!spot) return false;
    this.release();
    for (const o of this.othersOf(this.player)) {
      if (Math.hypot(o.x - spot.stand.x - 0.5, o.y - spot.stand.y - 0.5) >= 0.8) continue;
      if (o.kind === 'resident') this.endDoing(o as Resident);
      if (o.path.length === 0) this.stepAside(o, this.player, [spot.stand]);
    }
    const look = () => {
      face(this.player, spot.look.x, spot.look.y);
      // an activity is done looking at it, even with the back to the viewer
      this.player.want = octantOf(spot.look.x - this.player.x, spot.look.y - this.player.y);
      then?.();
    };
    return this.send(spot.stand, { kind: 'activity', id }, look);
  }

  /** Walk to the door of a place (an empty lot's gate). */
  walkToDoor(id: PlaceId, then?: () => void): boolean {
    const p = this.world.places.find((q) => q.id === id);
    if (!p) return false;
    this.release();
    return this.send(p.door, { kind: this.built.has(id) ? 'talk' : 'lot', placeId: id }, then);
  }

  /**
   * Keys held: the way to go, any direction on the tile grid (the engine turns the screen's arrows with the camera),
   * null (or zero) = no key. The player goes that way at once, continuously (no tile to tile), and stops where they
   * are when it is let go. Taking the keys cancels a click walk at once.
   */
  steer(dir: Pt2 | null): void {
    const l = dir ? Math.hypot(dir.x, dir.y) : 0;
    if (!dir || l < 1e-6) {
      this.steerDir = null;
      return;
    }
    this.steerDir = { x: dir.x / l, y: dir.y / l };
    if (this.errand || this.player.path.length > 0) {
      this.cancelErrand();
      this.player.path = [];
    }
  }

  /** The keys as a step on the tile grid (keysToDelta): steer that way. */
  hold(delta: Tile): void {
    this.steer(delta.x === 0 && delta.y === 0 ? null : delta);
  }

  /** The way the keys steer now (a unit vector), or null. */
  get steering(): Pt2 | null {
    return this.steerDir;
  }

  /** Shift held: the player runs (keys and clicks). */
  setRun(on: boolean): void {
    this.running = on;
  }

  /**
   * The last point of a walk up to somebody standing at `at`: moved in along the way to TALK_GAP from them (two
   * people talking stand about a tile apart), when that spot is open and the way there clear.
   */
  private closeIn(at: Pt2): void {
    const p = this.player;
    const e = this.errand;
    const last = p.path[p.path.length - 1];
    if (!e || !last) return;
    const c = centre(last);
    const d = Math.hypot(c.x - at.x, c.y - at.y);
    if (d <= TALK_GAP + 0.02) return;
    const x = at.x + ((c.x - at.x) * TALK_GAP) / d;
    const y = at.y + ((c.y - at.y) * TALK_GAP) / d;
    const prev = p.path.length > 1 ? centre(p.path[p.path.length - 2]) : { x: p.x, y: p.y };
    const t = tileOf({ x, y });
    if (!walkable(t, this.world) || !lineClear(prev.x, prev.y, x, y, this.world)) return;
    p.path[p.path.length - 1] = { x: x - 0.5, y: y - 0.5 };
    e.target = t;
    this.goal = t;
  }

  /** Let go of the resident being talked to: they wander again (at their own pace: a staged walk hurried them). */
  release(): void {
    for (const r of this.residents.values()) r.engaged = false;
    for (const [id, speed] of this.hurried) {
      const r = this.residents.get(id as PlaceId);
      if (r) r.speed = speed;
    }
    this.hurried.clear();
  }

  /** Another resident (not `except`) stands on or next to this tile, or the cat sits within SPACE of it. */
  private crowded(t: Tile, except: PlaceId): boolean {
    for (const o of this.residents.values()) {
      if (o.place.id === except || o.hidden) continue;
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
    this.wake(r);
    r.engaged = true;
    stopAhead(r, this.world);
    face(r, this.player.x, this.player.y);
    face(this.player, r.x, r.y);
  }

  /**
   * A conversation began with the resident far from the player (further than ENGAGE_FAR: a link straight to it, or no
   * way to walk there): they are put beside the player at once, on the best free talk spot (talkSpotCost), so the two
   * stand together. Nothing happens when they are near already. Call after engage().
   */
  bringOver(id: PlaceId): void {
    const r = this.residents.get(id);
    if (!r || r.hidden || Math.hypot(r.x - this.player.x, r.y - this.player.y) <= ENGAGE_FAR) return;
    const p = this.player.tile;
    let best: Tile | null = null;
    let cost = Infinity;
    for (const d of TALK_SPOTS) {
      // TALK_SPOTS are where the player stands from the resident: the resident stands the other way round
      const c = { x: p.x - d.x, y: p.y - d.y };
      if (!walkable(c, this.world) || this.occupied(c, r, r.place.id)) continue;
      const k = talkSpotCost(d);
      if (k < cost) {
        cost = k;
        best = c;
      }
    }
    if (!best) return;
    r.path = [];
    const pl = this.player;
    const bx = best.x + 0.5 - pl.x;
    const by = best.y + 0.5 - pl.y;
    const bl = Math.hypot(bx, by) || 1;
    const near = { x: pl.x + (bx / bl) * TALK_GAP, y: pl.y + (by / bl) * TALK_GAP };
    const at = walkable(tileOf(near), this.world) ? near : centre(best);
    r.x = at.x;
    r.y = at.y;
    r.tile = tileOf(at);
    r.v = 0;
    r.moving = false;
    r.stepping = false;
    r.land = null;
    face(r, this.player.x, this.player.y);
    face(this.player, r.x, r.y);
  }

  // ───────────────────────── staging (engine/staging.ts) ─────────────────────────

  /**
   * A talk is staged somewhere (docs/town.md §7 "Staging"): the resident is held for it (nobody else strolls near the
   * two, whoever stands close steps aside) and, given `residentAt`, walks there at a brisk pace (HURRY_SPEED); the
   * player walks to `playerAt`, and `then` runs when they get there (at once when already there). Both points are
   * exact points of the grid, not tile centres. With `residentAt` null the resident stays where they are (a talk in a
   * room: a resident inside a house stays inside). False when the player cannot get there (nothing changes then).
   */
  gather(id: PlaceId, residentAt: Pt2 | null, playerAt: Pt2, then?: () => void): boolean {
    const r = this.residents.get(id);
    if (!r) return false;
    const target = tileOf(playerAt);
    if (!walkable(target, this.world)) return false;
    this.release();
    if (!this.send(target, { kind: 'talk', placeId: id }, then)) return false;
    const p = this.player;
    const end = { x: playerAt.x - 0.5, y: playerAt.y - 0.5 };
    if (p.path.length > 0) p.path[p.path.length - 1] = end;
    else if (Math.hypot(playerAt.x - p.x, playerAt.y - p.y) > 1e-3) p.path = [end];
    this.talking = id;
    r.engaged = true;
    if (residentAt) {
      if (r.doing || r.hidden || r.seat) this.endDoing(r);
      this.walkResident(r, residentAt);
    } else if (!r.hidden) {
      if (r.doing || r.seat) this.endDoing(r);
      stopAhead(r, this.world);
    }
    return true;
  }

  /** The resident walks to an exact point at a brisk pace (a stage's walk to a talk); false when there is no way. */
  private walkResident(r: Resident, at: Pt2): boolean {
    const t = tileOf(at);
    const end = { x: at.x - 0.5, y: at.y - 0.5 };
    let path: Tile[];
    if (sameTile(r.tile, t)) path = [end];
    else {
      path = walkable(t, this.world) ? this.walkPath(r, t) : [];
      if (path.length === 0) return false;
      path[path.length - 1] = end;
    }
    r.path = path;
    if (!this.hurried.has(r.place.id)) this.hurried.set(r.place.id, r.speed);
    r.speed = Math.max(r.speed, HURRY_SPEED);
    r.waited = 0;
    r.bumped = 0;
    return true;
  }

  /** A staged walk of the resident stopped short (given up behind somebody): set off again. */
  hurryOn(id: PlaceId, at: Pt2): boolean {
    const r = this.residents.get(id);
    if (!r || r.hidden) return false;
    if (Math.hypot(r.x - at.x, r.y - at.y) < 0.05) return true;
    return this.walkResident(r, at);
  }

  /**
   * The resident is put at `at` at once, with `path` left to walk (the stage skips the part of a walk nobody sees);
   * with no walk left they face the player.
   */
  jumpResident(id: PlaceId, at: Pt2, path: readonly Tile[] = []): void {
    const r = this.residents.get(id);
    if (!r) return;
    if (r.doing || r.hidden || r.seat) this.endDoing(r);
    r.x = at.x;
    r.y = at.y;
    r.tile = tileOf(at);
    r.path = path.map((t) => ({ ...t }));
    r.v = 0;
    r.moving = false;
    r.stepping = false;
    r.land = null;
    r.bump = 0;
    r.bumped = 0;
    if (r.path.length === 0) {
      face(r, this.player.x, this.player.y);
      r.oct = r.want;
      r.yaw = octAngle(r.want);
    }
  }

  /** Where a resident's walk goes now (tile corners; the last point may be an exact point). */
  pathOf(id: PlaceId): readonly Tile[] {
    return this.residents.get(id)?.path ?? [];
  }

  /**
   * The resident goes into a room with the player (`door`: the tile in front of it): hidden in there for `seconds`,
   * then everyday life brings them out of that door again.
   */
  goInside(id: PlaceId, door: Tile, seconds: number): void {
    const r = this.residents.get(id);
    if (!r) return;
    if (r.seat || (r.doing && !r.hidden)) this.endDoing(r);
    r.doing = { kind: 'inside', at: { ...door }, oct: null, until: this.time + seconds, arrived: true };
    r.hidden = true;
    r.path = [];
    r.x = door.x + 0.5;
    r.y = door.y + 0.5;
    r.tile = { ...door };
    r.v = 0;
    r.moving = false;
    r.stepping = false;
    r.land = null;
  }

  /** The player is put at a point at once (out of a room's door), facing `heading` (radians on the grid). */
  placePlayer(at: Pt2, heading: number): void {
    this.cancelErrand();
    this.putPlayer(at, heading);
  }

  /** Ground distance (tiles) left on the player's click walk; null with no click walk under way. */
  walkLeft(): number | null {
    return this.errand ? pathLeft(this.player) : null;
  }

  /**
   * "Đến ngay" during a click walk (docs/town.md §7 "Moving about"): the walk is over at once. The player stands where it
   * ends, facing the way they were going (a talk: the two face each other), and its `then` runs as on arrival. False
   * with no click walk under way.
   */
  finishWalk(): boolean {
    const e = this.errand;
    const p = this.player;
    if (!e) return false;
    const end = p.path.length > 0 ? centre(p.path[p.path.length - 1]) : { x: p.x, y: p.y };
    const heading = Math.hypot(end.x - p.x, end.y - p.y) > 1e-3 ? Math.atan2(end.y - p.y, end.x - p.x) : (p.yaw ?? octAngle(p.oct));
    this.putPlayer(end, heading);
    this.errand = null;
    this.goal = null;
    this.squeeze = null;
    if (e.arrival.kind === 'talk') {
      const r = this.residents.get(e.arrival.placeId);
      if (r) {
        face(p, r.x, r.y);
        face(r, p.x, p.y);
      }
    }
    e.then?.();
    return true;
  }

  /** The player stands at a point at once, facing `heading` (radians on the grid); whatever they were doing stays. */
  private putPlayer(at: Pt2, heading: number): void {
    const p = this.player;
    p.path = [];
    p.x = at.x;
    p.y = at.y;
    p.tile = tileOf(at);
    p.v = 0;
    p.moving = false;
    p.stepping = false;
    p.land = null;
    p.yaw = heading;
    p.oct = p.want = octantOf(Math.cos(heading), Math.sin(heading));
    p.heading = { ...OCTANTS[p.oct] };
    p.holdYaw = true;
    p.autoSettle = false;
    p.rest = 0;
    p.restSince = this.time;
    this.drive = 0;
  }

  /** The player's walk stops where they are (a talk being walked to given up with Esc). */
  halt(): void {
    this.cancelErrand();
    stopAhead(this.player, this.world);
  }

  /** The staged talk is over (or given up): nobody is held, the resident walks at their own pace again. */
  endGather(): void {
    this.talking = null;
    this.release();
  }

  /** Before an emote (rendered three-quarters only): somebody facing the viewer straight on turns a little. */
  turnForEmote(id: string): void {
    const a = this.actor(id);
    if (a && a.kind !== 'cat') threeQuarter(a);
  }

  /**
   * The tile the player's walks start from: the one under them, or, when the body stands on a tile closed to the
   * path finder (right by a lamp post, a trunk, a bench: the body is free to stand there), the open tile beside it
   * nearest the body.
   */
  private from(): Tile {
    const p = this.player;
    if (walkable(p.tile, this.world)) return { ...p.tile };
    let best: Tile | null = null;
    let bestD = Infinity;
    for (const d of NEIGHBOURS) {
      const c = { x: p.tile.x + d.x, y: p.tile.y + d.y };
      if (!walkable(c, this.world)) continue;
      const dist = Math.hypot(c.x + 0.5 - p.x, c.y + 0.5 - p.y);
      if (dist < bestD) {
        best = c;
        bestD = dist;
      }
    }
    return best ?? { ...p.tile };
  }

  /** A walk from where `a` stands to `to`, round the people standing about and never through them; [] = no way. */
  private walkPath(a: Actor, to: Tile): Tile[] {
    const people = this.peopleExcept(a);
    // a passer-by goes round a conversation (two tiles clear of the pair), not through it
    const pair = a.kind === 'folk' ? this.pairTiles() : null;
    const near = (t: Tile) => !!pair && pair.some((q) => Math.max(Math.abs(q.x - t.x), Math.abs(q.y - t.y)) <= 2);
    const path = findPath(a.tile, to, this.world, (t) => (people.some((o) => Math.hypot(o.x - t.x - 0.5, o.y - t.y - 0.5) < PERSONAL) ? DETOUR : 0) + (near(t) ? DETOUR * 2 : 0));
    return path.length > 0 ? smoothPath(a.x, a.y, path, this.world, people) : [];
  }

  /** Everybody else (the player, the residents, the cat), but `a` and resident `skip`. */
  private othersOf(a: Actor, skip: PlaceId | null = null): Actor[] {
    const out: Actor[] = [];
    if (a !== this.player) out.push(this.player);
    for (const r of this.residents.values()) if (r !== a && r.place.id !== skip && !r.hidden) out.push(r);
    if (this.cat && this.cat !== a) out.push(this.cat);
    for (const f of this.folk) if (f !== a && !f.hidden) out.push(f);
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
  private blocker(a: Actor, path: readonly Tile[], ignore: Actor | null = null, predict = true): Actor | null {
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
      if (at === Infinity && predict && o.v > 0.05 && way) {
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
    if (a.v === 0 && a.waited > (still ? WAIT_STILL : WAIT_MOVING)) {
      // never left standing on a doorstep: whoever stands in the way there makes room instead
      if (a.kind !== 'cat' && this.world.places.some((q) => sameTile(q.door, a.tile))) {
        if (still) this.stepAside(b, a);
        a.waited = 0;
        return 0;
      }
      // a curve round them, when there is one clear of everybody; else the walk is given up
      if (a.kind !== 'cat') {
        const end = a.path[a.path.length - 1];
        const round = this.walkPath(a, tileOf(centre(end)));
        if (round.length > 0 && passes(a, round, b) >= SIDE && !this.blocker(a, round)) {
          a.path = round;
          a.waited = 0;
          return Infinity;
        }
      }
      this.giveUp(a);
    }
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
   * Everybody the player keeps clear of, near enough to matter this frame, with their gap (MIN_GAP); not the one a
   * click walk squeezes past (SQUEEZE_AFTER).
   */
  private bodiesNear(): Body[] {
    const p = this.player;
    const out: Body[] = [];
    for (const o of this.othersOf(p)) {
      if (o === this.squeeze) continue;
      if (Math.abs(o.x - p.x) > 2 || Math.abs(o.y - p.y) > 2) continue;
      out.push({ x: o.x, y: o.y, gap: MIN_GAP });
    }
    return out;
  }

  /**
   * The player's own motion (docs/town.md §7 "Moving about"), for the keys and a click walk alike: `want` is the way to
   * go (a unit vector; null = stop where you are), `top` the pace, `brake` a cap on it (the distance left of a click
   * walk). The body turns toward where it will really go (along a wall, round somebody: `wayAlong`) at PLAYER_TURN, the
   * walk goes the way the body faces (no crab walk; a sharp turn slows it, a half turn turns on the spot), the pace
   * reaches full in PLAYER_ACCEL and a stop takes PLAYER_STOP. Returns the ground covered this frame.
   */
  private move(dt: number, want: Pt2 | null, top: number, brake: number, reach: number, keys: boolean, aimAt = Infinity): number {
    const p = this.player;
    const bodies = this.bodiesNear();
    let yaw = p.yaw ?? octAngle(p.oct);
    let dir: Pt2 = { x: Math.cos(yaw), y: Math.sin(yaw) };
    let goal = 0;
    if (want) {
      const way = wayAlong(p.x, p.y, want, PLAYER_RADIUS, this.world, bodies);
      const to = Math.atan2(way.face.y, way.face.x);
      const err = angleTo(yaw, to);
      const most = PLAYER_TURN * dt;
      yaw = angleTo(0, yaw + Math.max(-most, Math.min(most, err)));
      const off = Math.abs(angleTo(yaw, to));
      // within 60° of the way: full pace; a half turn (past ~127°): on the spot first
      const gate = Math.max(0, Math.min(1, (Math.cos(off) + 0.6) / 1.1));
      goal = way.blocked ? 0 : Math.min(top * gate, brake);
      // a click walk aiming at a point close by: never faster than the body can turn onto it (no circling round it)
      if (aimAt < Infinity) goal = Math.min(goal, (PLAYER_TURN * aimAt) / (2 * Math.max(0.05, Math.abs(Math.sin(angleTo(yaw, Math.atan2(want.y, want.x)))))));
      // along the body; a sidestep past a corner goes the way past it, the body still facing ahead; the last few
      // tenths of a click walk go straight onto its end
      const side = way.move.x !== way.face.x || way.move.y !== way.face.y;
      dir = side || reach < 0.4 ? way.move : { x: Math.cos(yaw), y: Math.sin(yaw) };
      if (way.blocked && keys) this.pushInto(want, dt);
      else this.pushFor = 0;
    } else this.pushFor = 0;
    // the pace: up quickly; down quickly for a turn or the end of a click walk; let go, a stop at once
    const fast = Math.max(top, this.drive);
    const rate = !want ? fast / PLAYER_STOP : goal < this.drive ? fast / (brake < Infinity ? PLAYER_STOP : PLAYER_ARRIVE) : top / PLAYER_ACCEL;
    this.drive = goal > this.drive ? Math.min(goal, this.drive + rate * dt) : Math.max(goal, this.drive - rate * dt);
    if (this.drive < 1e-4) this.drive = 0;
    p.yaw = yaw;
    let moved = 0;
    if (this.drive > 0) {
      const len = Math.min(this.drive * dt, reach);
      const to = moveCircle(p.x, p.y, dir.x * len, dir.y * len, PLAYER_RADIUS, this.world, bodies);
      moved = Math.hypot(to.x - p.x, to.y - p.y);
      p.x = to.x;
      p.y = to.y;
      p.tile = tileOf(to);
    }
    p.v = dt > 0 ? moved / dt : 0;
    p.phase += (moved * Math.PI * 2) / p.stride;
    const was = p.moving;
    p.moving = this.drive > 0 || !!want;
    p.stepping = false;
    p.land = null;
    p.starting = false;
    if (p.moving) {
      // the octant (for whatever still asks it) follows the body
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      p.oct = p.want = octantOf(c, s);
      p.heading = { x: c, y: s };
      if (c - s > 1e-6) p.facing = 1;
      else if (c - s < -1e-6) p.facing = -1;
      p.holdYaw = true;
      p.autoSettle = false;
      p.rest = 0;
      p.waited = 0;
    } else if (was) {
      // stopped: the body keeps the way it faced; after a while standing it turns three-quarters to the viewer (SETTLE_AFTER)
      p.rest = 0;
      p.restSince = Number.NaN;
      p.holdYaw = true;
      p.autoSettle = true;
    }
    return moved;
  }

  /**
   * A held key pushing into somebody standing right in the way (no slide round them: a narrow way): after PUSH_ASIDE
   * they step aside out of the next three tiles that way.
   */
  private pushInto(u: Pt2, dt: number): void {
    const p = this.player;
    let who: Actor | null = null;
    for (const o of this.othersOf(p)) {
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < MIN_GAP + 0.25 && (dx * u.x + dy * u.y) / Math.max(1e-6, d) > 0.5 && o.v < 0.05) who = o;
    }
    if (!who) {
      this.pushFor = 0;
      return;
    }
    this.pushFor += dt;
    if (this.pushFor < PUSH_ASIDE) return;
    this.pushFor = 0;
    const way: Tile[] = [];
    for (let k = 1; k <= 3; k++) {
      const t = tileOf({ x: p.x + u.x * k, y: p.y + u.y * k });
      if (!walkable(t, this.world)) break;
      way.push(t);
    }
    if (way.length > 0) this.stepAside(who, p, way);
  }

  /**
   * A click walk this frame: the way to the point a little on along the path (`carrot`: corners are arcs), and the
   * distance left. Points passed are dropped; at the end the player stands exactly there and the path is empty.
   */
  private followPath(): { want: Pt2 | null; left: number; aimAt: number } {
    const p = this.player;
    const near = this.bodiesNear();
    while (p.path.length >= 2) {
      const p0 = centre(p.path[0]);
      const p1 = centre(p.path[1]);
      const d0 = Math.hypot(p0.x - p.x, p0.y - p.y);
      const ahead = (p.x - p0.x) * (p1.x - p0.x) + (p.y - p0.y) * (p1.y - p0.y) > 0;
      // (standing on it: passed, whoever is about; the body slides round them)
      if (!(d0 < 0.12 || ((d0 < PASSED || (d0 < 0.8 && ahead)) && lineClear(p.x, p.y, p1.x, p1.y, this.world, near)))) break;
      p.path.shift();
    }
    // the last point taken by somebody standing on it (a resident at their spot): there as near as the gap lets
    if (p.path.length === 1) {
      const end = centre(p.path[0]);
      if (Math.hypot(end.x - p.x, end.y - p.y) < MIN_GAP + 0.3 && near.some((o) => Math.hypot(o.x - end.x, o.y - end.y) < 0.35)) {
        p.path = [];
        return { want: null, left: 0, aimAt: 0 };
      }
    }
    const left = pathLeft(p);
    if (left < 0.02) {
      const end = centre(p.path[p.path.length - 1]);
      if (wallsFree(end.x, end.y, PLAYER_RADIUS * 0.5, this.world, null) && near.every((o) => Math.hypot(o.x - end.x, o.y - end.y) >= Math.min(o.gap, Math.hypot(o.x - p.x, o.y - p.y)))) {
        p.x = end.x;
        p.y = end.y;
        p.tile = tileOf(end);
      }
      p.path = [];
      return { want: null, left: 0, aimAt: 0 };
    }
    const aim = carrot(p, this.world, near);
    let ax = aim.x - p.x;
    let ay = aim.y - p.y;
    let l = Math.hypot(ax, ay);
    if (l < 1e-6) {
      // standing on the point aimed at: on to the end
      const end = centre(p.path[p.path.length - 1]);
      ax = end.x - p.x;
      ay = end.y - p.y;
      l = Math.max(1e-6, Math.hypot(ax, ay));
    }
    return { want: { x: ax / l, y: ay / l }, left, aimAt: l };
  }

  /**
   * A click walk making (almost) no way: somebody stands in it or the body caught on a corner. Now and then it looks
   * for a way round (or asks them to step aside); near the end, it is there; after SQUEEZE_AFTER behind somebody who
   * cannot make way, it squeezes past them.
   */
  private unstall(dt: number, moved: number): void {
    const p = this.player;
    const e = this.errand;
    if (!e || p.path.length === 0 || moved > 0.3 * p.speed * dt) {
      this.stallFor = 0;
      return;
    }
    this.stallFor += dt;
    if (this.stallFor < STALL_REPATH) return;
    // within reach of the end: it is there
    if (pathLeft(p) < 0.35) {
      p.path = [];
      this.stallFor = 0;
      return;
    }
    const b = this.blocker(p, p.path, this.squeeze, false);
    if (this.stallFor > SQUEEZE_AFTER + STALL_REPATH && b) {
      this.squeeze = b;
      this.stallFor = 0;
      return;
    }
    if (this.time - this.repathAt < 0.35) return;
    this.repathAt = this.time;
    const path = this.playerPath(e.target);
    if (path.length > 0 && (!b || passes(p, path, b) >= SIDE)) {
      const end = p.path[p.path.length - 1];
      // (the end may be a point off its tile's centre: a talk spot moved in, kept as it was)
      if (sameTile(tileOf(centre(path[path.length - 1])), tileOf(centre(end)))) path[path.length - 1] = end;
      p.path = path;
    } else if (b && b.v < 0.05) this.stepAside(b, p);
  }

  /**
   * Somebody standing in the player's only way (a narrow path by a house) steps aside: to the nearest free tile next
   * to them that is clear of the player's walk, and later home again. Nobody held for a conversation moves.
   */
  private stepAside(o: Actor, p: Actor, way: readonly Tile[] = p.path): void {
    if (o.kind === 'player' || o.path.length > 0) return;
    if (o.kind === 'resident' && ((o as Resident).engaged || (o as Resident).place.id === this.talking || (o as Resident).seat)) return;
    // whatever they were doing there ends (they come back to it later)
    if (o.kind === 'resident' && (o as Resident).doing) this.endDoing(o as Resident);
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

  /** The player's walk to `target` round the people about (the one walked up to as well), never through them. */
  private playerPath(target: Tile): Tile[] {
    const p = this.player;
    const people = this.peopleExcept(p);
    const from = this.from();
    const path = findPath(from, target, this.world, (t) => (people.some((o) => Math.hypot(o.x - t.x - 0.5, o.y - t.y - 0.5) < PERSONAL) ? DETOUR : 0));
    // standing by a post on a closed tile: first onto the open tile the walk starts from
    if (path.length > 0 && !sameTile(from, p.tile)) path.unshift(from);
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
    this.stallFor = 0;
    this.errandRun = pathLeft(p) > RUN_FAR;
    this.errand = { target, arrival, then };
    this.goal = target;
    return true;
  }

  // ───────────────────────── time ─────────────────────────

  /** Advance everything by `dt` seconds. Returns what the player reached during this step (at most one thing). */
  update(dt: number): Arrival | null {
    this.time += dt;
    const p = this.player;
    const keys = this.steerDir !== null;
    // the keys always win over a click walk
    if (keys && (this.errand || p.path.length > 0)) {
      this.cancelErrand();
      p.path = [];
    }
    // a long click walk is run, back to a walk for its last tiles; Shift runs whatever the walk
    p.speed = this.running || (this.errand !== null && this.errandRun && pathLeft(p) > RUN_UNTIL) ? PLAYER_RUN : PLAYER_SPEED;
    // past the one a click walk squeezed by: the usual rules again
    if (this.squeeze && (!this.errand || Math.hypot(this.squeeze.x - p.x, this.squeeze.y - p.y) > LOOK + 0.5)) this.squeeze = null;
    let want: Pt2 | null = this.steerDir;
    let brake = Infinity;
    let reach = Infinity;
    let aimAt = Infinity;
    if (!keys && p.path.length > 0) {
      const f = this.followPath();
      want = f.want;
      aimAt = f.aimAt;
      if (want) {
        // braking on the distance left: it stands still exactly at the end
        brake = Math.sqrt((2 * p.speed * f.left) / PLAYER_ARRIVE);
        if (p.path.length === 1) reach = f.left;
      } else this.drive = 0;
    }
    const moved = dt > 0 ? this.move(dt, want, p.speed, brake, reach, keys, aimAt) : 0;
    if (!keys) this.unstall(dt, moved);
    standTick(p, dt, this.time);

    let arrived: Arrival | null = null;
    if (this.errand && p.path.length === 0) {
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
    if (this.life) this.updateFolk(dt);
    return arrived;
  }

  /**
   * advance() with one hard rule over whatever the planning decided: a step that would bring `a` nearer than
   * MIN_GAP to somebody (and nearer than it was) is not taken: the body, the legs and the path stay as they were, and
   * it stands there (giveWay then waits, goes round or asks them to step aside). Nobody walks into anybody. (The
   * player moves on its own rules: TownSim.move, moveCircle.)
   */
  private step(a: Actor, dt: number, more?: () => Tile | null, cap = Infinity): boolean {
    // stopped by the gap rule a moment ago: it stands a little (no creeping into them again frame after frame)
    if ((a.bump ?? 0) > 0) {
      a.bump = Math.max(0, (a.bump ?? 0) - dt);
      cap = 0;
    }
    const before = { x: a.x, y: a.y, tile: a.tile, phase: a.phase, path: a.path.slice(), land: a.land, starting: a.starting };
    const others = this.othersOf(a);
    const done = advance(a, dt, more, cap, this.world, others);
    if (a.x === before.x && a.y === before.y) return done;
    for (const o of others) {
      // the player squeezing past somebody who could not make way (SQUEEZE_AFTER), and they by the player
      if (this.squeeze && ((a === this.player && o === this.squeeze) || (a === this.squeeze && o === this.player))) continue;
      const now = Math.hypot(o.x - a.x, o.y - a.y);
      if (now >= MIN_GAP || now >= Math.hypot(o.x - before.x, o.y - before.y)) continue;
      Object.assign(a, before);
      a.v = 0;
      a.land = null;
      a.bump = BUMP_WAIT;
      a.bumped = (a.bumped ?? 0) + BUMP_WAIT;
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

  /**
   * Stopped again and again by the gap rule on one walk (two people brushing past each other on a narrow way): it
   * takes a way round (a curve clear of them), or, with none, gives the walk up and stands. Never a creep.
   */
  private unbump(a: Actor): void {
    if ((a.bumped ?? 0) < BUMP_GIVE_UP || (a.bump ?? 0) > 0) return;
    a.bumped = 0;
    const end = a.path[a.path.length - 1];
    const round = this.walkPath(a, tileOf(centre(end)));
    if (round.length > 0 && !this.blocker(a, round)) {
      a.path = round;
      return;
    }
    if (a.kind === 'folk') {
      a.path = [];
      stopHere(a);
      (a as Folk).pauseIn = 0.8 + this.rng();
    } else this.giveUp(a);
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
    if (r.hidden) {
      this.lifeInside(r, dt);
      return;
    }
    if (r.path.length > 0) {
      // somebody in the way: slow to a stand and wait for them (a resident never walks through anybody)
      const cap = this.giveWay(r, dt);
      if (r.path.length > 0) this.step(r, dt, undefined, cap);
      if (r.path.length > 0) this.unbump(r);
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
    if (this.life) {
      this.lifeTick(r, dt);
      return;
    }
    const near = gridDistance(r.x, r.y, this.player.x, this.player.y) < 78;
    if (r.engaged || near) {
      // somebody is close: look at them (now and then, not every frame: no flicker as the player passes) and wait
      r.lookIn -= dt;
      if (near && r.lookIn <= 0) {
        faceIfFar(r, this.player.x, this.player.y);
        r.lookIn = 0.35;
      }
      return;
    }
    const home = r.home;
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
        r.lookIn = 6 + this.rng() * 8;
      } else {
        // straight at the viewer, or across to the other side (still a face, never the back of the head)
        r.want = this.rng() < 0.6 ? 1 : FRONT[2 - front];
        r.lookIn = 2.5 + this.rng() * 3;
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
    // somebody seated stays on their bench (off the way); the one the main button suggests is not sent off either
    if (!other || r.seat || r.place.id === this.hinted) return;
    const pair = [this.player.path[this.player.path.length - 1] ?? this.player.tile, other.path[other.path.length - 1] ?? other.tile].map((t) => tileOf(centre(t)));
    const gap = (t: Tile) => Math.min(...pair.map((p) => Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y))));
    if (gap(r.tile) > 2) return;
    // nowhere to go last time: look again in a moment, not every frame
    if (r.wanderIn > 0 && r.wanderIn < 1) return;
    let best: Tile[] | null = null;
    const home = r.home;
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
      if (r.doing) this.endDoing(r);
      r.path = smoothPath(r.x, r.y, best, this.world, this.peopleExcept(r));
      r.wanderIn = 3 + this.rng() * 4;
    } else {
      r.wanderIn = 0.9;
    }
  }

  /** Where the two in a conversation stand (or are walking to), null when nobody is talking. */
  private pairTiles(): Tile[] | null {
    const other = this.talking ? this.residents.get(this.talking) : null;
    if (!other) return null;
    return [this.player.path[this.player.path.length - 1] ?? this.player.tile, other.path[other.path.length - 1] ?? other.tile].map((t) => tileOf(centre(t)));
  }

  // ───────────────────────── everyday life (docs/town.md §7 "Life") ─────────────────────────

  /** A lodger's spot in the boarding house's yard (by their order, so two lodgers rarely share one). */
  private yardSpot(index: number): Tile {
    const yard = this.world.life?.inn.yard ?? [];
    return yard.length > 0 ? { ...yard[index % yard.length] } : { ...this.world.start };
  }

  private freeKey(key: string, who: string): boolean {
    const h = this.claims.get(key);
    return !h || h === who;
  }

  /** A tile to go and stand on: walkable, nobody on it or about to be, and not held by somebody else. */
  private standable(t: Tile, r: Actor, key?: string): boolean {
    // and not crowding the player: they walk about here, the town keeps a little room round them
    const p = this.player;
    return walkable(t, this.world) && (!key || this.freeKey(key, r.id)) && this.spaceAt(t, r) >= 0.9 && Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - p.y) >= (this.seeded ? 1.6 : 2.6);
  }

  private pick<T>(list: readonly T[]): T | undefined {
    return list.length > 0 ? list[Math.min(list.length - 1, Math.floor(this.rng() * list.length))] : undefined;
  }

  /** The residents (and passers-by) placed at their first activity at once: the town is alive when the page opens. */
  private seedLife(): void {
    const order = [...this.residents.values()].sort(() => this.rng() - 0.5);
    for (const r of order) {
      if (r.doing) continue;
      const a = pickActivity(dayPart(this.clock()), this.rng, { index: r.index, not: this.notNow(r) });
      if (!this.begin(r, a, true)) this.begin(r, 'home', true);
    }
    const part = dayPart(this.clock());
    let adults = folkCount(part);
    for (const f of this.folk) {
      if (f.kid ? !kidsOut(part) : adults-- <= 0) {
        f.spawnIn = 2 + this.rng() * 8;
        continue;
      }
      this.spawnFolk(f, true);
    }
  }

  /** What a resident may not choose now. */
  private notNow(r: Resident): Set<Activity> {
    const not = new Set<Activity>();
    if (this.hinted === r.place.id) not.add('inside');
    if (dayPart(this.clock()) !== 'morning') not.add('jog');
    return not;
  }

  /**
   * Begin an activity: find where (a free seat, a chat spot and somebody to chat with, a place to stand), hold it, and
   * walk there (or, `instant`, be there already). False when there is no such place free now.
   */
  private begin(r: Resident, kind: Activity, instant: boolean): boolean {
    const L = this.world.life;
    if (!L) return false;
    const id = r.place.id;
    const has = (needs?: string) => !needs || this.decorations.has(needs);
    let d: Doing | null = null;
    let mate: { q: Resident; d: Doing } | null = null;
    switch (kind) {
      case 'home': {
        const spots = r.lodger ? L.inn.yard.filter((t) => this.standable(t, r)) : [r.home];
        const at = this.pick(spots) ?? r.home;
        d = { kind, at: { ...at }, oct: null, until: 0, arrived: false };
        break;
      }
      case 'inside':
        d = { kind, at: { ...(r.lodger ? L.inn.door : r.place.door) }, oct: null, until: 0, arrived: false };
        break;
      case 'sit': {
        const free = L.seats.map((s, i) => ({ s, i })).filter(({ s, i }) => has(s.needs) && this.freeKey(`seat:${i}`, id) && walkable(s.from, this.world) && this.spaceAt({ x: Math.floor(s.x), y: Math.floor(s.y) }, r) >= 0.3);
        const c = this.pick(free);
        if (!c) return false;
        d = { kind, at: { ...c.s.from }, oct: c.s.oct, seat: c.s, claim: `seat:${c.i}`, until: 0, arrived: false };
        break;
      }
      case 'chat': {
        const pairs = L.chats.map((p, i) => ({ p, i })).filter(({ p, i }) => this.freeKey(`chat:${i}`, id) && p.every((t) => this.standable(t, r)));
        const c = this.pick(pairs);
        if (!c) return false;
        const mid = { x: (c.p[0].x + c.p[1].x) / 2 + 0.5, y: (c.p[0].y + c.p[1].y) / 2 + 0.5 };
        let best: Resident | null = null;
        let bestD = Infinity;
        for (const q of this.residents.values()) {
          if (q === r || q.hidden || q.engaged || q.seat || q.path.length > 0 || q.place.id === this.talking) continue;
          if (q.doing && q.doing.kind !== 'home' && q.doing.kind !== 'stroll') continue;
          const dist = Math.hypot(q.x - mid.x, q.y - mid.y);
          if (dist < bestD && (instant || dist < 12)) {
            best = q;
            bestD = dist;
          }
        }
        if (!best) return false;
        // the left one on the screen (smaller x − y) looks SE, the right one SW: the two face each other
        const [left, right] = c.p[0].x - c.p[0].y < c.p[1].x - c.p[1].y ? [c.p[0], c.p[1]] : [c.p[1], c.p[0]];
        const rLeft = Math.hypot(r.x - left.x - 0.5, r.y - left.y - 0.5) <= Math.hypot(best.x - left.x - 0.5, best.y - left.y - 0.5);
        d = { kind, at: { ...(rLeft ? left : right) }, oct: rLeft ? 0 : 2, mate: best.place.id, lead: true, claim: `chat:${c.i}`, until: 0, arrived: false };
        this.endDoing(best);
        mate = { q: best, d: { kind, at: { ...(rLeft ? right : left) }, oct: rLeft ? 2 : 0, mate: id, lead: false, until: 0, arrived: false } };
        break;
      }
      case 'tend':
      case 'fish':
      case 'read':
      case 'shop': {
        const free = L[kind].map((s, i) => ({ s, i })).filter(({ s, i }) => has(s.needs) && this.standable(s.at, r, `${kind}:${i}`));
        const c = this.pick(free);
        if (!c) return false;
        d = { kind, at: { ...c.s.at }, oct: c.s.oct, claim: `${kind}:${c.i}`, until: 0, arrived: false };
        break;
      }
      case 'jog': {
        let leg = 0;
        L.jog.forEach((t, i) => {
          if (Math.hypot(t.x + 0.5 - r.x, t.y + 0.5 - r.y) < Math.hypot(L.jog[leg].x + 0.5 - r.x, L.jog[leg].y + 0.5 - r.y)) leg = i;
        });
        d = { kind, at: { ...L.jog[leg] }, oct: null, leg, speed: r.speed, until: this.time + activitySeconds('jog', this.rng), arrived: false };
        r.speed = JOG_SPEED;
        break;
      }
      case 'stroll': {
        const options: Tile[] = [];
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 2) continue;
            const t = { x: r.tile.x + dx, y: r.tile.y + dy };
            if (this.standable(t, r) && !this.world.places.some((q) => sameTile(q.door, t))) options.push(t);
          }
        }
        const at = this.pick(options);
        if (!at) return false;
        d = { kind, at, oct: null, until: 0, arrived: false };
        break;
      }
    }
    if (!d) return false;
    if (d.claim) this.claims.set(d.claim, id);
    r.doing = d;
    if (mate) mate.q.doing = mate.d;
    const go = (a: Resident, dd: Doing): boolean => {
      const at = dd.at!;
      if (instant) {
        a.x = at.x + 0.5;
        a.y = at.y + 0.5;
        a.tile = { ...at };
        a.path = [];
        this.arrive(a);
        return true;
      }
      if (sameTile(a.tile, at)) {
        a.path = Math.hypot(at.x + 0.5 - a.x, at.y + 0.5 - a.y) > 1e-6 ? [{ ...at }] : [];
        return true;
      }
      const path = this.walkPath(a, at);
      if (path.length === 0) return false;
      a.path = path;
      return true;
    };
    if (!go(r, d) || (mate && !go(mate.q, mate.d))) {
      this.endDoing(r);
      return false;
    }
    if (d.kind === 'sit' && d.seat) {
      // on to the spot in front of the seat in one walk (no stop on the tile before it)
      const f = seatFront(d.seat);
      d.at = null;
      if (instant) {
        r.x = f.x;
        r.y = f.y;
        r.oct = r.want = d.seat.oct;
        r.yaw = octAngle(d.seat.oct);
      } else r.path.push({ x: f.x - 0.5, y: f.y - 0.5 });
    }
    return true;
  }

  /** Got where the activity is (or a walk there was given up: then it ends). */
  private arrive(r: Resident): void {
    const d = r.doing;
    if (!d) return;
    if (d.at && Math.hypot(r.x - d.at.x - 0.5, r.y - d.at.y - 0.5) > 0.45) {
      this.endDoing(r);
      r.wanderIn = 1 + this.rng() * 2;
      return;
    }
    if (d.kind === 'jog') {
      const L = this.world.life!;
      if (this.time >= d.until) {
        this.endDoing(r);
        r.wanderIn = 0.5 + this.rng();
        return;
      }
      // on round the plaza
      d.leg = ((d.leg ?? 0) + 1) % L.jog.length;
      d.at = { ...L.jog[d.leg] };
      const path = this.walkPath(r, d.at);
      if (path.length === 0) {
        this.endDoing(r);
        r.wanderIn = 1;
      } else r.path = path;
      return;
    }
    if (d.kind === 'sit' && d.seat && d.at) {
      // the last steps: to the spot right in front of the seat (never onto the bench's own tile)
      d.at = null;
      const f = seatFront(d.seat);
      r.path = [{ x: f.x - 0.5, y: f.y - 0.5 }];
      return;
    }
    if (d.kind === 'sit' && d.seat && !r.seat) {
      // (a walk there given up on the way: no sitting down from afar)
      const f = seatFront(d.seat);
      if (Math.hypot(r.x - f.x, r.y - f.y) > 0.3) {
        this.endDoing(r);
        r.wanderIn = 1 + this.rng() * 2;
        return;
      }
      // there: turn round, the back to the seat, a moment, then sit down (the engine backs them onto it)
      r.want = d.seat.oct;
      r.facing = d.seat.oct === 2 ? -1 : 1;
      r.autoSettle = false;
      const turned = r.oct === r.want && Math.abs(angleTo(r.yaw ?? octAngle(r.oct), octAngle(r.want))) < 0.2;
      if (!turned) {
        d.sitAt = undefined;
        return;
      }
      d.sitAt ??= this.time + SIT_TURN_PAUSE;
      if (this.time < d.sitAt) return;
    }
    d.arrived = true;
    d.until = this.time + activitySeconds(d.kind, this.rng);
    r.autoSettle = false;
    if (d.kind === 'sit' && d.seat) {
      r.seat = d.seat;
      r.x = d.seat.x;
      r.y = d.seat.y;
      r.oct = r.want = d.seat.oct;
      r.facing = d.seat.oct === 2 ? -1 : 1;
      r.restSince = this.time;
      return;
    }
    if (d.kind === 'inside') {
      r.hidden = true;
      return;
    }
    if (d.kind === 'chat') d.sayAt = this.time + 0.6 + this.rng() * 1.2;
    if (d.oct !== null) {
      const o = OCTANTS[d.oct];
      r.heading = { ...o };
      r.facing = o.x - o.y > 0 ? 1 : -1;
      r.want = d.oct;
    } else settle(r);
  }

  /** An activity being done: its time runs out, a chat's lines and nods. */
  private perform(r: Resident): void {
    const d = r.doing!;
    if (d.kind === 'chat') {
      const m = d.mate ? this.residents.get(d.mate) : undefined;
      if (!m || m.doing?.kind !== 'chat' || m.doing.mate !== r.place.id) {
        this.endDoing(r);
        r.wanderIn = 1 + this.rng() * 2;
        return;
      }
      if (!d.lead) return;
      if (m.doing.arrived && this.time >= (d.sayAt ?? 0)) {
        const speaker = this.rng() < 0.5 ? r : m;
        const other = speaker === r ? m : r;
        this.events.push({ kind: 'say', id: speaker.id });
        if (this.rng() < 0.4) this.events.push({ kind: 'nod', id: other.id });
        d.sayAt = this.time + 2.2 + this.rng() * 2.6;
      }
      if (!m.doing.arrived) d.until = Math.max(d.until, this.time + 1);
    }
    if (this.time >= d.until && (d.kind !== 'chat' || d.lead)) {
      const seat = r.seat;
      if (seat) {
        // up off the seat, forward onto the spot in front of it (the engine eases it), and a moment standing before
        // the next walk begins
        r.seat = null;
        this.endDoing(r);
        const f = seatFront(seat);
        r.x = f.x;
        r.y = f.y;
        r.tile = { ...seat.from };
        r.path = [];
        r.restSince = this.time;
        r.wanderIn = RISE_TIME + this.rng() * 2.5;
        return;
      } else this.endDoing(r);
      r.wanderIn = 0.5 + this.rng() * 2.5;
      return;
    }
    if (d.kind === 'home' || d.kind === 'stroll') this.lookRound(r);
  }

  /** Standing about: now and then a look round, then back to the front (never the back of the head). */
  private lookRound(r: Resident): void {
    if (r.lookIn > 0 || r.oct !== r.want || r.rest <= 1) return;
    const front = r.facing > 0 ? 0 : 2;
    if (r.want !== front) {
      settle(r);
      r.lookIn = 6 + this.rng() * 8;
    } else {
      r.want = this.rng() < 0.6 ? 1 : FRONT[2 - front];
      r.lookIn = 2.5 + this.rng() * 3;
    }
  }

  /** What they were doing ends: the seat and spot are let go, up from the bench, out of the door, a chat partner free. */
  endDoing(r: Resident): void {
    const d = r.doing;
    r.doing = null;
    if (d?.claim && this.claims.get(d.claim) === r.place.id) this.claims.delete(d.claim);
    if (d?.speed) r.speed = d.speed;
    if (r.seat) {
      const f = r.seat.from;
      r.x = f.x + 0.5;
      r.y = f.y + 0.5;
      r.tile = { ...f };
      r.seat = null;
      r.restSince = this.time;
      settle(r);
      r.oct = r.want;
    }
    if (r.hidden) {
      r.hidden = false;
      const door = d?.at ?? r.place.door;
      r.x = door.x + 0.5;
      r.y = door.y + 0.5;
      r.tile = { ...door };
      r.path = [];
      r.restSince = this.time;
      settle(r);
      r.oct = r.want;
    }
    if (d?.kind === 'chat' && d.mate) {
      const m = this.residents.get(d.mate);
      if (m?.doing?.kind === 'chat' && m.doing.mate === r.place.id) {
        this.endDoing(m);
        m.wanderIn = 1 + this.rng() * 2;
      }
    }
  }

  /** Before talking to them: whatever they do stops (up from the bench, out of the door). */
  private wake(r: Resident): void {
    if (r.doing || r.hidden || r.seat) this.endDoing(r);
  }

  /** At home behind a window: out again when the time is up (at night they mostly stay in), or when the player is sent to them. */
  private lifeInside(r: Resident, dt: number): void {
    const d = r.doing;
    r.wanderIn -= dt;
    if (d && this.time < d.until && this.hinted !== r.place.id) return;
    const part = dayPart(this.clock());
    if (d && this.hinted !== r.place.id && (part === 'night' || part === 'late') && this.rng() < 0.8) {
      d.until = this.time + activitySeconds('inside', this.rng);
      return;
    }
    // nobody stepping out of the door into the player standing at it
    const door = d?.at ?? r.place.door;
    if (Math.hypot(this.player.x - door.x - 0.5, this.player.y - door.y - 0.5) < 0.8) {
      if (d) d.until = this.time + 1.5;
      return;
    }
    this.endDoing(r);
    r.wanderIn = 0.4 + this.rng();
  }

  /** A resident standing (life): waves at the player coming close, looks at them, does what they do, plans the next thing. */
  private lifeTick(r: Resident, dt: number): void {
    const p = this.player;
    const dist = gridDistance(r.x, r.y, p.x, p.y);
    const d = r.doing;
    r.waveIn -= dt;
    r.lookIn -= dt;
    const close = dist < WAVE_NEAR && !this.talking;
    const free = !d || d.kind === 'home' || d.kind === 'stroll' || (d.kind === 'shop' && d.arrived);
    if (close && !r.sawPlayer && r.waveIn <= 0 && !r.seat && !r.engaged && free && this.time > 1.5) {
      face(r, p.x, p.y);
      this.events.push({ kind: 'wave', id: r.id });
      r.waveIn = 30 + this.rng() * 30;
    }
    r.sawPlayer = close;
    if (r.engaged) {
      if (dist < 78 && r.lookIn <= 0) {
        faceIfFar(r, p.x, p.y);
        r.lookIn = 0.35;
      }
      return;
    }
    if (d && !d.arrived) {
      this.arrive(r);
      return;
    }
    if (dist < 78 && (!d || d.kind === 'home' || d.kind === 'stroll')) {
      // somebody close: the head follows them (the engine), the body turns only when they are well round to the side
      if (r.lookIn <= 0) {
        faceIfFar(r, p.x, p.y);
        r.lookIn = 0.35;
      }
      if (d) d.until += dt;
      return;
    }
    if (!d) {
      r.wanderIn -= dt;
      if (r.wanderIn > 0) {
        this.lookRound(r);
        return;
      }
      const a = pickActivity(dayPart(this.clock()), this.rng, { index: r.index, not: this.notNow(r) });
      if (!this.begin(r, a, false) && !this.begin(r, 'home', false)) r.wanderIn = 1 + this.rng() * 2;
      return;
    }
    this.perform(r);
  }

  /** A place was just built: its resident comes out of its door, theirs now, and stands by it. */
  moveIn(id: PlaceId): void {
    const r = this.residents.get(id);
    if (!r) return;
    this.endDoing(r);
    r.lodger = false;
    r.home = { ...r.place.spot };
    r.path = [];
    const door = r.place.door;
    r.x = door.x + 0.5;
    r.y = door.y + 0.5;
    r.tile = { ...door };
    r.doing = { kind: 'home', at: { ...r.home }, oct: null, until: 0, arrived: false };
    const path = this.walkPath(r, r.home);
    if (path.length > 0) r.path = path;
    else this.arrive(r);
  }

  // ───────────────────────── passers-by ─────────────────────────

  /** A passer-by comes into town at a street's end (or, `mid`, already on its way), with a few points to walk past. */
  private spawnFolk(f: Folk, mid: boolean): void {
    const L = this.world.life;
    if (!L) return;
    const route: Tile[] = [];
    if (f.kid) {
      // children run round the plaza for a while
      const k = Math.floor(this.rng() * L.jog.length);
      const n = 3 + Math.floor(this.rng() * 4);
      for (let i = 0; i < n; i++) route.push({ ...L.jog[(k + i * (this.rng() < 0.5 ? 1 : 2)) % L.jog.length] });
    } else {
      const n = 1 + Math.floor(this.rng() * 2);
      for (let i = 0; i < n; i++) route.push({ ...this.pick(L.via)! });
    }
    const from = mid ? route.shift()! : this.pick(L.ends)!;
    const out = this.pick(L.ends.filter((e) => !sameTile(e, from))) ?? L.ends[0];
    route.push({ ...out });
    if (!this.standable(from, f) || this.spaceAt(from, f) < 1) {
      f.spawnIn = 1 + this.rng() * 2;
      return;
    }
    f.hidden = false;
    f.x = from.x + 0.5;
    f.y = from.y + 0.5;
    f.tile = { ...from };
    f.path = [];
    f.route = route;
    f.pauseIn = mid ? this.rng() * 2 : 0;
    f.v = 0;
    f.moving = false;
    f.restSince = this.time - this.rng();
  }

  private updateFolk(dt: number): void {
    const part = dayPart(this.clock());
    const want = folkCount(part);
    let adults = this.folk.filter((f) => !f.hidden && !f.kid).length;
    for (const f of this.folk) {
      if (f.hidden) {
        f.spawnIn -= dt;
        if (f.spawnIn > 0) continue;
        if (f.kid ? kidsOut(part) : adults < want) {
          this.spawnFolk(f, false);
          if (!f.kid && !f.hidden) adults++;
        } else f.spawnIn = 2 + this.rng() * 4;
        continue;
      }
      if (f.path.length > 0) {
        const cap = this.giveWay(f, dt);
        if (f.path.length > 0) this.step(f, dt, undefined, cap);
        if (f.path.length > 0) this.unbump(f);
        standTick(f, dt, this.time);
        continue;
      }
      standTick(f, dt, this.time);
      if (f.stepping) continue;
      // standing by a conversation: on at once (round it)
      const pair = this.pairTiles();
      if (pair && pair.some((q) => Math.max(Math.abs(q.x - f.tile.x), Math.abs(q.y - f.tile.y)) <= 2)) f.pauseIn = Math.min(f.pauseIn, 0);
      // a stop of its route by the conversation is skipped (not the street's end it leaves by)
      if (pair && f.route.length > 1 && pair.some((q) => Math.max(Math.abs(q.x - f.route[0].x), Math.abs(q.y - f.route[0].y)) <= 2)) f.route.shift();
      const next = f.route[0];
      if (!next) {
        // the street's end: gone on out of town, back later
        f.hidden = true;
        f.spawnIn = 3 + this.rng() * 10;
        continue;
      }
      if (Math.hypot(f.x - next.x - 0.5, f.y - next.y - 0.5) < 0.6) {
        f.route.shift();
        f.pauseIn = f.route.length > 1 ? (f.kid ? 0.2 + this.rng() * 0.6 : 0.8 + this.rng() * 2.5) : 0;
        continue;
      }
      f.pauseIn -= dt;
      if (f.pauseIn > 0) continue;
      const path = this.walkPath(f, next);
      if (path.length > 0 && this.canSetOff(f, path)) f.path = path;
      else {
        f.pauseIn = 0.5 + this.rng();
        // a point nobody can get to now: skip it
        if (path.length === 0 || this.rng() < 0.2) f.route.shift();
      }
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
