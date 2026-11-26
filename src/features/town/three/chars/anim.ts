// The animation brain of one person: pure numbers, no three.js (tested in node).
//
// Every frame it builds a pose (joint angles, hip offsets, prop weights) from layers blended by weights that ease in
// and out, so nothing ever pops:
//   1. idle (always): breathing, weight shift, small look-arounds;
//   2. locomotion: a bouncy walk ↔ run (a foot on the ground stays put while the leg reaches, then glides on; the other swings to
//      the next plant point; the legs reach them by IK), the cycle driven by the ground covered;
//   3. one loop activity at a time (sit, talk, drink, water, fish, read), faded in and out;
//   4. one-shots (wave, yes, no, cheer) on top, with an envelope, then back to the loop;
//   5. look-at / look-around on the head, the eased turn, soft springs on top (lean, roll, a small squash on setting
//      off and stopping, the head steadying itself), hair springs.
// Units: "design" units (an adult is 1.0 tall); the 3D wrapper scales the body to tiles.

import type { CharAction } from '../contracts';
import { rng } from './looks';

// ───────────────────────── pose layout ─────────────────────────

/** Joints, in skeleton order. Each has three rotation channels (x, y, z) at J*3. */
export const J = {
  hips: 0,
  spine: 1,
  head: 2,
  shL: 3,
  elL: 4,
  shR: 5,
  elR: 6,
  thL: 7,
  knL: 8,
  anL: 9,
  thR: 10,
  knR: 11,
  anR: 12,
} as const;
export const JOINT_COUNT = 13;

/** Scalar channels after the joint rotations. */
export const C = {
  hipX: 39,
  hipY: 40,
  hipZ: 41,
  /** Breathing −1…1 (chest scale). */
  breath: 42,
  /** Squash/stretch of the whole body (0 = none, + = stretch, − = squash). */
  squash: 43,
  /** Prop weights 0…1 (shown by scale). */
  cup: 44,
  can: 45,
  rod: 46,
  book: 47,
  /** Tilt of the watering can (pouring), radians. */
  canTilt: 48,
  /** Fishing line bob 0…1 (a tug). */
  tug: 49,
  /** Cup at the mouth 0…1 (the cup tilts toward the face). */
  sip: 50,
} as const;
export const CHANNELS = 51;

export type Pose = Float32Array;
export const newPose = (): Pose => new Float32Array(CHANNELS);

const setRot = (p: Pose, j: number, x: number, y: number, z: number): void => {
  p[j * 3] = x;
  p[j * 3 + 1] = y;
  p[j * 3 + 2] = z;
};

// ───────────────────────── small maths ─────────────────────────

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Hermite smoothstep of t in [a, b]. */
export function smoothstep(a: number, b: number, t: number): number {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}
/** Fractional part (0…1, also for negatives). */
export const frac = (x: number): number => x - Math.floor(x);
/** Ease in-out (cubic) on 0…1. */
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Exponential approach factor for a rate (1/s) over dt: frame-rate independent. */
export const approach = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
/** Shortest signed angle from a to b, in (−π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** One step of a critically damped spring (exact for any dt): returns [value, velocity]. */
export function springStep(x: number, v: number, goal: number, omega: number, dt: number): [number, number] {
  const e = Math.exp(-omega * dt);
  const d = x - goal;
  const j = (v + omega * d) * dt;
  return [goal + (d + j) * e, (v - omega * j) * e];
}

/**
 * A damped spring stepped in place (no allocation): `zeta` 1 eases in and out, below 1 it overshoots a little and
 * settles (0.7: about 5%, 0.4: about 25%). Sub-stepped so a long frame (up to 0.1 s) stays stable.
 */
export class Spring {
  x: number;
  v = 0;
  constructor(x = 0) {
    this.x = x;
  }
  step(goal: number, omega: number, zeta: number, dt: number): number {
    if (dt <= 0) return this.x;
    const n = Math.max(1, Math.ceil((dt * omega) / 0.4));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (-2 * zeta * omega * this.v - omega * omega * (this.x - goal)) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
  /** A kick to the velocity (a footfall, setting off, a stop). */
  kick(dv: number): void {
    this.v += dv;
  }
}

/** Smooth wandering noise from a few incommensurate sines, about −1…1. */
export function wander(t: number, seed: number): number {
  return (Math.sin(t * 1.31 + seed) * 0.5 + Math.sin(t * 2.17 + seed * 1.7) * 0.3 + Math.sin(t * 3.73 + seed * 2.3) * 0.2);
}

// ───────────────────────── actions ─────────────────────────

export const LOOP_ACTIONS = ['idle', 'walk', 'run', 'sit', 'talk', 'drink', 'water', 'fish', 'read'] as const;
export const ONE_SHOTS = ['wave', 'yes', 'no', 'cheer'] as const;
export type Activity = 'sit' | 'talk' | 'drink' | 'water' | 'fish' | 'read';
export const ACTIVITIES: readonly Activity[] = ['sit', 'talk', 'drink', 'water', 'fish', 'read'];
type OneShot = (typeof ONE_SHOTS)[number];

export const isOneShot = (a: CharAction): a is OneShot => (ONE_SHOTS as readonly string[]).includes(a);
export const isActivity = (a: CharAction): a is Activity => (ACTIVITIES as readonly string[]).includes(a);

/** One-shot lengths (s), and the length of one cycle of each loop (0 = no cycle). */
export const ACTION_SECONDS: Readonly<Record<CharAction, number>> = {
  idle: 0,
  walk: 0,
  run: 0,
  sit: 0.45,
  talk: 2.4,
  drink: 4.2,
  water: 4,
  fish: 6,
  read: 5,
  wave: 1.7,
  yes: 0.95,
  no: 1.1,
  cheer: 1.35,
};

/** How fast a one-shot comes in and goes out (s). */
const SHOT_IN = 0.22;
const SHOT_OUT = 0.3;
/** Activities fade at this rate (1/s): about 0.35 s to settle. */
const ACTIVITY_RATE = 9;

/** The envelope of a one-shot at time t of its duration: 0 → 1 → 0, eased. */
export function shotEnvelope(t: number, dur: number): number {
  if (t <= 0 || t >= dur) return 0;
  return smoothstep(0, SHOT_IN, t) * (1 - smoothstep(dur - SHOT_OUT, dur, t));
}

// ───────────────────────── walking ─────────────────────────

// A swinging walk (2026-11-22), the way Cozyverse Town walks its chibis (the owner: "mày không xem được cozyverse rồi
// bắt chước à"; its client code read in the owner's browser: each leg swings from the hip on a sine of time, the
// arms against them, the body a little lower as the legs reach out, every joint eased toward its goal). Ours before
// it planted each foot on the ground and bent the legs to reach it (IK): the feet had to glide on to keep up with the
// body, the legs pulled the hips down at a landing, a turn splayed a leg; however it was tuned it shivered ("nhân vật
// di chuyển cứ rung rung", "mỗi lần đổi hướng như bị gãy chân"). Now, walking:
// - the legs swing from the hips on a sine (SWING_RATE: about 3.4 steps a second at the player's walk), the knee of
//   the leg coming forward bending to lift its foot, the soles level; nothing is planted, nothing is solved;
// - the body is as much lower as the standing leg leans out (the foot stays on the ground): a smooth wave, about 2% of
//   the height;
// - the arms swing against the legs, the pelvis turns a little with them, the head steady;
// - the swing fades in and out with the walk (`move`), over the standing pose.
// Standing still the feet stand on the ground where they are (IK): a turn on the spot steps round, the last step of a
// walk closes the stance, one foot at a time.

/** The paces of the town (tiles/s): the player's walk and run (engine/sim.ts PLAYER_SPEED, PLAYER_RUN). */
export const DEFAULT_WALK_SPEED = 1.6;
export const DEFAULT_RUN_SPEED = 2.8;
/** From this pace on (tiles/s) the gait turns into a run (blended between these two); a jog (sim.ts) runs anyway. */
const RUN_FROM = 1.9;
const RUN_FULL = 2.5;

/**
 * How much longer the legs are than in the first build (design units, 2026-11-21): everything above them is raised
 * this much (body.ts), the head kept its size.
 */
export const LEG_GROW = 0.06;
/** Leg geometry in design units (body.ts BONE_REST): thigh pivot → knee → ankle; the ankle's height over the sole. */
export const LEG = { thigh: 0.12, shin: 0.105, ankle: 0.05, hipY: 0.23 + LEG_GROW, thighDrop: 0.015, width: 0.062 } as const;
/** How far the leg reaches (thigh pivot to ankle), a hair short of straight so the knee never snaps. */
export const LEG_REACH = (LEG.thigh + LEG.shin) * 0.998;
/**
 * Beyond this reach the leg straightens softly (the hips come down to keep the feet within it). The knee angle is
 * steep near straight: at 97.5% of the reach the knee stayed bent 28°; at 99.6% it is about 11°.
 */
const LEG_SOFT = LEG_REACH * 0.996;
/** The leg folds no shorter than this (thigh pivot to ankle): the knee bends at most about 120°. */
const LEG_FOLD = (LEG.thigh + LEG.shin) * 0.53;
/** Feet rest this far (design units) to each side of the body's middle. */
const FOOT_SIDE = 0.058;
/** Standing, a foot further than this (design units) from under its hip steps back under it. */
const SETTLE_ERROR = 0.03;
/** A settling step (a turn on the spot, closing the stance) takes this long (s). */
const SETTLE_STEP = 0.17;
/** A jump of the body further than this (tiles) in one frame is a teleport: the feet are put under it again. */
const TELEPORT = 0.45;

/** Thigh pivot to ankle (design units) with the knee bent `knee` radians. */
export function legLength(knee: number): number {
  return Math.sqrt(LEG.thigh * LEG.thigh + LEG.shin * LEG.shin + 2 * LEG.thigh * LEG.shin * Math.cos(knee));
}
/** The knee of the standing leg (radians): a soft bend, never locked straight. */
const STANCE_KNEE = 0.16;
/** How far the hips stand lower walking for that bend (design units). */
const STANCE_DROP = legLength(0) - legLength(STANCE_KNEE);

/**
 * How fast the legs swing (radians of the cycle a second; two steps a cycle) at a pace of `paceDesign` design units a
 * second: about 8 strolling (2.6 steps a second), 10.8 at the player's walk (3.4; Cozyverse's walk is 11), 14.4 running.
 */
export function swingRate(paceDesign: number): number {
  return clamp(6 + 2.25 * paceDesign, 6, 15.5);
}

/** Steps a second at a pace in tiles/s for a body of `tiles` world units per design unit (adult 0.75). */
export function stepsPerSecond(paceTiles: number, tiles = 0.75): number {
  return swingRate(paceTiles / tiles) / Math.PI;
}

/** How far each leg swings from the hip (radians, either way) at a pace (design units/s) and a run share. */
export function swingAmp(paceDesign: number, run: number): number {
  return lerp(lerp(0.3, 0.42, smoothstep(0.4, 2.2, paceDesign)), 0.62, run);
}

/**
 * How much lower the hips are (design units) with the standing leg swung `a` radians from straight down: its foot
 * then stays on the ground.
 */
export function swingDip(a: number): number {
  return legLength(STANCE_KNEE) * (1 - Math.cos(a)) + STANCE_DROP;
}

// ───────────────────────── seat ─────────────────────────

/** The seat the sit pose expects, in design units (adult about 1.05 tall). Tiles: × 0.75 × scale (SEAT_HEIGHT). */
export const SEAT_DESIGN = 0.18 / 0.75;
/** Where the hip joint sits above the seat top (the round bottom of the body). */
const SEAT_TO_HIP = 0.055;
const THIGH = LEG.thigh;
/** From the knee to the sole of a hanging foot. */
const SHIN_TO_SOLE = LEG.shin + LEG.ankle;

/**
 * How far the knees rise above level for a seat this high (design units), so the feet never go into the ground; on a
 * seat higher than the lower legs the thighs slope down a little instead (at most about 15°), the feet nearer the
 * ground.
 */
export function kneeRaiseForSeat(seat: number): number {
  const hipY = seat + SEAT_TO_HIP;
  // sole = hipY + THIGH * sin(raise) − SHIN_TO_SOLE ≥ 0.005
  return Math.asin(clamp((SHIN_TO_SOLE + 0.005 - hipY) / THIGH, -0.26, 1));
}

// ───────────────────────── face ─────────────────────────

export type EyeState = 'open' | 'half' | 'closed' | 'happy' | 'wide';
export type MouthState = 'smile' | 'neutral' | 'talkA' | 'talkO' | 'grin' | 'o';
export interface FaceState {
  eyes: EyeState;
  mouth: MouthState;
}

/** Blink: open → half → closed → half → open over this many seconds. */
export const BLINK_SECONDS = 0.16;
export function blinkEyes(t: number): EyeState | null {
  if (t < 0 || t >= BLINK_SECONDS) return null;
  const k = t / BLINK_SECONDS;
  return k < 0.28 || k > 0.72 ? 'half' : 'closed';
}

// ───────────────────────── the animator ─────────────────────────

/** Rest heights of the body (design units), for the hip offset maths. */
export const BODY = { hipY: LEG.hipY, headPivot: 0.53 + LEG_GROW, headTop: 0.98 + LEG_GROW } as const;

export interface AnimatorOptions {
  seed?: number;
  /** 1 = adult, children about 0.75 (the body is that much smaller in the world). */
  scale?: number;
  /** World units (tiles) per design unit: TILE_SCALE × scale (default 0.75 × scale). */
  tiles?: number;
  /** Seat height in design units (default SEAT_DESIGN). */
  seat?: number;
  /** Portrait / still mood. */
  mood?: 'neutral' | 'happy';
}

interface Shot {
  action: OneShot;
  t: number;
  dur: number;
  /** When it was cut short: the weight it fades from, and how long it has been fading. */
  fadeFrom?: number;
  fadeT?: number;
}

/** A foot standing still: planted (0), or taking a settling step (2). */
const PLANTED = 0;
const SETTLE = 2;

/**
 * Animation state of one person. Each frame: `placeAt(x, z)` (where the body stands in the world, if it does) then
 * `update(dt, speed)`, and read `pose`, `face`, `heading`, `hair` (ponytail / pigtail sway), `seatBlend`. Without
 * `placeAt` the animator walks a ground of its own at `speed` along its heading (portraits, tests).
 */
export class Animator {
  readonly pose: Pose = newPose();
  readonly face: FaceState = { eyes: 'open', mouth: 'smile' };
  /** Current (eased) heading, radians, and its angular velocity. */
  heading = 0;
  headingVel = 0;
  /**
   * How quickly the drawn body turns to its heading (a spring, 1/s), walking and standing, and its damping: about
   * critical, so a turn eases in and settles without swinging past (that read as a wobble). Somebody the learner steers
   * (the player) turns quicker: their own sim already eases the turn.
   */
  turnWalk = 16;
  turnStand = 11;
  turnZeta = 0.95;
  /** Feet that landed while walking or running (a counter: the scene puffs dust under a runner), and the last one. */
  footfalls = 0;
  lastFoot: 0 | 1 = 0;
  /** Hair spring angles: [x (forward/back), z (side)] for the tail bones. */
  readonly hair = new Float32Array(4);
  /** 0…1: how seated the person is (props and the cheer's jump look at it). */
  seatBlend = 0;
  /** Locomotion weight 0…1 and the run share 0…1 (read by tests and the harness). */
  move = 0;
  runShare = 0;
  /** Walk phase, radians (2π a cycle of two steps): the legs swing on its sine (swingRate). */
  phase = 0;
  /** World units per design unit. */
  readonly tiles: number;

  private targetHeading = 0;
  private loop: CharAction = 'idle';
  private readonly weights: Record<Activity, number> = { sit: 0, talk: 0, drink: 0, water: 0, fish: 0, read: 0 };
  private readonly clocks: Record<Activity, number> = { sit: 0, talk: 0, drink: 0, water: 0, fish: 0, read: 0 };
  private shots: Shot[] = [];
  private time = 0;
  private readonly rand: () => number;
  private readonly seed: number;
  seat: number;
  mood: 'neutral' | 'happy';

  // ground: where the body is (world), last frame, its smoothed velocity
  private gx = 0;
  private gz = 0;
  private pgx = 0;
  private pgz = 0;
  private placed = false;
  private feetReady = false;
  private vx = 0;
  private vz = 0;
  /** Pace (tiles/s) the gait is shaped for. */
  private pace = 0;
  private moving = false;
  // feet (index 0 = left, 1 = right): world ground point, lift (design units), state, swing start and progress
  private readonly fx = new Float64Array(2);
  private readonly fz = new Float64Array(2);
  private readonly lift = new Float64Array(2);
  private readonly state = new Uint8Array(2);
  private readonly fromX = new Float64Array(2);
  private readonly fromZ = new Float64Array(2);
  private readonly fromLift = new Float64Array(2);
  /** The foot's pitch when its swing began (a swing taken over mid-air carries it on, easing out: no snap). */
  private readonly fromPitch = new Float64Array(2);
  private readonly prog = new Float64Array(2);
  /** Where each foot is now (swing included) in the body's frame, design units: x (left), y (up), z (forward). */
  private readonly lx = new Float64Array(2);
  private readonly ly = new Float64Array(2);
  private readonly lz = new Float64Array(2);
  private readonly pitch = new Float64Array(2);
  /** Where each foot's ground point is now (world), swing included. */
  private readonly cx = new Float64Array(2);
  private readonly cz = new Float64Array(2);
  private settleWait = 0;
  /** How far the hips are lowered for the legs to reach (design units), and the frame's time step. */
  private drop = 0;
  private dt = 0;

  // look
  private lookTarget: [number, number] | null = null;
  private readonly lookYawS = new Spring();
  private readonly lookPitchS = new Spring();
  private readonly turnS = new Spring();
  // the lively layer on top of every pose: lean (pace, speed-up, stop), roll into turns, squash kicks, the head's lag
  private readonly leanS = new Spring();
  private readonly rollS = new Spring();
  private readonly sqS = new Spring();
  private readonly headPS = new Spring();
  private readonly headRS = new Spring();
  private accel = 0;
  private cruise = 0;
  private lastEff = 0;
  private aroundYaw = 0;
  private aroundPitch = 0;
  private aroundUntil = 2;
  // blink
  private blinkAt = 1.5;
  private blinkT = -1;
  // hair springs (x, z) × value/velocity
  private readonly hairV = new Float32Array(4);
  private lastSpeed = 0;
  private lastHipY = 0;
  // talking mouth
  private mouthT = 0;
  private mouthShape: MouthState = 'talkA';
  private readonly tmp: Pose = newPose();

  constructor(opts: AnimatorOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.rand = rng(this.seed);
    this.tiles = opts.tiles ?? 0.75 * (opts.scale ?? 1);
    this.seat = opts.seat ?? SEAT_DESIGN;
    this.mood = opts.mood ?? 'neutral';
    this.time = this.rand() * 10; // desynchronise idle breathing between people
    this.blinkAt = this.time + 0.8 + this.rand() * 3;
    this.aroundUntil = this.time + 1 + this.rand() * 2;
    this.lx[0] = FOOT_SIDE;
    this.lx[1] = -FOOT_SIDE;
    this.evaluate(0);
  }

  get action(): CharAction {
    return this.loop;
  }

  setHeading(rad: number, instant = false): void {
    this.targetHeading = rad;
    if (instant) {
      this.heading = rad;
      this.headingVel = 0;
      this.feetReady = false;
    }
  }

  /** Where the body stands in the world this frame (tiles; three X and Z). */
  placeAt(x: number, z: number): void {
    this.gx = x;
    this.gz = z;
    this.placed = true;
  }

  setAction(action: CharAction): void {
    if (isOneShot(action)) {
      for (const s of this.shots) {
        if (s.fadeFrom === undefined) {
          s.fadeFrom = shotEnvelope(s.t, s.dur);
          s.fadeT = 0;
        }
      }
      this.shots.push({ action, t: 0, dur: ACTION_SECONDS[action] });
      return;
    }
    if (action === this.loop) return;
    if (isActivity(action) && this.weights[action] < 0.02) this.clocks[action] = 0;
    this.loop = action;
  }

  /** Look toward a direction relative to the body: yaw (radians, + = to the person's left), pitch (+ = down). */
  setLook(yaw: number | null, pitch = 0): void {
    this.lookTarget = yaw === null ? null : [clamp(yaw, -1.15, 1.15), clamp(pitch, -0.4, 0.45)];
  }

  /** A one-shot is playing (with weight above 0.05). */
  busy(): boolean {
    return this.shots.some((s) => s.fadeFrom === undefined && shotEnvelope(s.t, s.dur) > 0.05);
  }

  /** World position of a foot's ground point (tests): [x, z, lift in design units]. */
  foot(i: 0 | 1): [number, number, number] {
    return [this.fx[i], this.fz[i], this.lift[i]];
  }

  /** `speed` = the body's ground pace (tiles/s) as the caller moves it; the steps follow the ground covered. */
  update(dt: number, speed: number): void {
    dt = clamp(dt, 0, 0.1);
    this.time += dt;
    this.dt = dt;
    const pace = Math.abs(speed);

    // heading: a spring about critical (eases in and settles, no swing past: that read as a wobble); quicker walking
    const goal = this.heading + angleDelta(this.heading, this.targetHeading);
    const ts = this.turnS;
    const h0 = this.heading;
    ts.x = this.heading;
    ts.v = this.headingVel;
    ts.step(goal, this.moving ? this.turnWalk : this.turnStand, this.turnZeta, dt);
    this.heading = angleDelta(0, ts.x);
    this.headingVel = ts.v;
    // the feet turn with the body, pivoting where they stand (people turn on the ball of the foot): a foot left where
    // it was while the body swings round it splayed the leg 25–35° sideways, a broken-looking leg at every change of
    // direction (the owner, 2026-11-22: "mỗi lần đổi hướng nhân vật như bị gãy chân"). Standing, a big turn still
    // ends with a settling step for the part not pivoted.
    this.pivotFeet(angleDelta(h0, this.heading) * (this.moving ? 1 : 0.6));

    // the ground: told where the body is, or (portraits, tests) walking a ground of its own along the heading
    if (!this.placed) {
      this.gx += Math.cos(this.heading) * pace * dt;
      this.gz += Math.sin(this.heading) * pace * dt;
    }
    this.placed = false;
    let dx = this.gx - this.pgx;
    let dz = this.gz - this.pgz;
    this.pgx = this.gx;
    this.pgz = this.gz;
    let dist = Math.hypot(dx, dz);
    if (!this.feetReady || dist > TELEPORT) {
      this.plantHome();
      dx = dz = dist = 0;
    } else if (dist > 0 && (this.loop === 'sit' || this.weights.sit > 0.02)) {
      // hopping onto a seat or off it: the feet go with the body (no steps, and the sit is not taken for a walk)
      for (let i = 0; i < 2; i++) {
        this.fx[i] += dx;
        this.fz[i] += dz;
        this.cx[i] += dx;
        this.cz[i] += dz;
        this.fromX[i] += dx;
        this.fromZ[i] += dz;
      }
      dx = dz = dist = 0;
    }
    const raw = dt > 0 ? dist / dt : 0;
    if (dt > 0) {
      const k = approach(14, dt);
      this.vx += (dx / dt - this.vx) * k;
      this.vz += (dz / dt - this.vz) * k;
    }
    const wasMoving = this.moving;
    this.moving = raw > 0.02;
    const eff = this.moving ? Math.max(pace, raw * 0.5) : 0;
    this.pace = eff;
    // speeding up and slowing down (tiles/s², smoothed); a squash as the walk sets off and as it stops
    if (dt > 0) this.accel += ((eff - this.lastEff) / dt - this.accel) * approach(18, dt);
    this.lastEff = eff;
    if (this.moving && !wasMoving) this.sqS.kick(-0.25);
    else if (!this.moving && wasMoving && this.cruise > 0.3) this.sqS.kick(-0.15 - 0.08 * Math.min(2.5, this.cruise));
    // the pace somebody was keeping (falls off slowly): how hard a stop is
    this.cruise = Math.max(eff, this.cruise - 1.5 * dt);

    const moveTarget = smoothstep(0.03, 0.35, eff);
    this.move = lerp(this.move, moveTarget, approach(moveTarget > this.move ? 12 : 8, dt));
    if (this.move < 0.001) this.move = 0;
    const runTarget = this.loop === 'run' && eff > 0.3 ? 1 : smoothstep(RUN_FROM, RUN_FULL, eff);
    this.runShare = lerp(this.runShare, runTarget, approach(6, dt));
    this.swingOn(dt);
    this.stepFeet(dt);

    // activities fade; walking puts down everything but talking
    for (const a of ACTIVITIES) {
      let target = a === this.loop ? 1 : 0;
      if (a !== 'talk' && this.move > 0.3) target = 0;
      // (no time passing: with motion reduced the engine advances nobody, and somebody seated must still be seated)
      this.weights[a] = lerp(this.weights[a], target, dt > 0 ? approach(ACTIVITY_RATE, dt) : 1);
      if (this.weights[a] < 0.002 && target === 0) this.weights[a] = 0;
      if (this.weights[a] > 0) this.clocks[a] += dt;
    }
    this.seatBlend = smoothstep(0, 1, this.weights.sit);
    // seated (the legs all the pose's own: no jump shows), the feet are put back under the hips for getting up
    if (this.weights.sit > 0.98) this.plantHome();

    // one-shots
    for (const s of this.shots) {
      s.t += dt;
      if (s.fadeT !== undefined) s.fadeT += dt;
    }
    if (this.shots.length > 0) this.shots = this.shots.filter((s) => s.t < s.dur && (s.fadeT === undefined || s.fadeT < SHOT_OUT));

    this.updateLook(dt);
    this.evaluate(dt);
    this.updateHair(dt, eff);
    this.updateFace(dt);
  }

  // ───────────── feet ─────────────

  /** Turn the feet (planted, drawn and where a swing began) round the body's ground point by `da` radians. */
  private pivotFeet(da: number): void {
    if (!this.feetReady || Math.abs(da) < 1e-7) return;
    const c = Math.cos(da);
    const s = Math.sin(da);
    const ox = this.gx;
    const oz = this.gz;
    const turn = (xs: Float64Array, zs: Float64Array, i: number) => {
      const dx = xs[i] - ox;
      const dz = zs[i] - oz;
      xs[i] = ox + dx * c - dz * s;
      zs[i] = oz + dx * s + dz * c;
    };
    for (let i = 0; i < 2; i++) {
      turn(this.fx, this.fz, i);
      turn(this.cx, this.cz, i);
      turn(this.fromX, this.fromZ, i);
    }
  }

  /** Both feet under the hips, on the ground (a spawn, a teleport, a seat). */
  private plantHome(): void {
    for (let i = 0; i < 2; i++) {
      this.homeOf(i);
      this.fx[i] = this.cx[i] = this.hx;
      this.fz[i] = this.cz[i] = this.hz;
      this.lift[i] = 0;
      this.state[i] = PLANTED;
      this.prog[i] = 0;
    }
    this.pgx = this.gx;
    this.pgz = this.gz;
    this.feetReady = true;
  }

  private hx = 0;
  private hz = 0;
  /** Where foot i rests (world), under its hip: into this.hx / this.hz. */
  private homeOf(i: number): void {
    const side = (i === 0 ? 1 : -1) * FOOT_SIDE * this.tiles;
    // the body's left (+X in design units) is (sin h, −cos h) on the ground
    this.hx = this.gx + Math.sin(this.heading) * side;
    this.hz = this.gz - Math.cos(this.heading) * side;
  }

  /**
   * The walk's swing: the phase runs on at the pace's rate while the walk shows (it keeps going as the walk fades, so
   * the legs never stop mid-swing), and a foot comes down at the front of each swing (the footfalls a runner puffs
   * dust at).
   */
  private swingOn(dt: number): void {
    if (this.move <= 0 && !this.moving) return;
    const before = Math.floor((this.phase - Math.PI / 2) / Math.PI);
    this.phase += swingRate(Math.max(this.pace, this.cruise) / this.tiles) * dt;
    const after = Math.floor((this.phase - Math.PI / 2) / Math.PI);
    if (after !== before && this.moving) {
      this.footfalls++;
      this.lastFoot = ((after % 2) + 2) % 2 === 0 ? 0 : 1;
    }
    // (kept small: a float's precision; the sine does not care)
    if (this.phase > Math.PI * 128) this.phase -= Math.PI * 128;
  }

  /**
   * The feet on the ground. Walking, the legs swing on their own (swingLegs) and the feet are kept under the hips, so
   * a stop stands on them at once. Standing, a foot in the air finishes its step under the hip; then a foot out of
   * place (a turn on the spot) steps back under it, one at a time. Then where each foot is, in the body's frame.
   */
  private stepFeet(dt: number): void {
    if (this.moving) {
      for (let i = 0; i < 2; i++) {
        this.homeOf(i);
        this.fx[i] = this.hx;
        this.fz[i] = this.hz;
        this.state[i] = PLANTED;
        this.prog[i] = 0;
        this.fromLift[i] = 0;
        this.fromPitch[i] = 0;
      }
    } else {
      let swinging = false;
      for (let i = 0; i < 2; i++) {
        if (this.state[i] === PLANTED) continue;
        this.prog[i] = Math.min(1, this.prog[i] + dt / SETTLE_STEP);
        if (this.prog[i] >= 1) this.land(i);
        else swinging = true;
      }
      this.settleWait -= dt;
      if (!swinging && this.settleWait <= 0) {
        let worst = -1;
        let err = SETTLE_ERROR * this.tiles;
        for (let i = 0; i < 2; i++) {
          this.homeOf(i);
          const e = Math.hypot(this.fx[i] - this.hx, this.fz[i] - this.hz);
          if (e > err) {
            err = e;
            worst = i;
          }
        }
        if (worst >= 0) {
          this.beginSwing(worst);
          this.state[worst] = SETTLE;
          this.prog[worst] = 0;
        }
      }
    }
    // where the stepping feet are now, and both feet in the body's frame
    const psi = Math.PI / 2 - this.heading;
    const cp = Math.cos(psi);
    const sp = Math.sin(psi);
    for (let i = 0; i < 2; i++) {
      let wx = this.fx[i];
      let wz = this.fz[i];
      let up = 0;
      let pitch = 0;
      if (this.state[i] !== PLANTED) {
        const s = this.prog[i];
        this.homeOf(i);
        const e = s * s * (3 - 2 * s);
        wx = this.fromX[i] + (this.hx - this.fromX[i]) * e;
        wz = this.fromZ[i] + (this.hz - this.fromZ[i]) * e;
        // up and down softly (no kick as it leaves or lands), carrying on from a lift it had
        const arc = Math.sin(Math.PI * s);
        up = Math.max(0.035 * arc * Math.sqrt(arc), this.fromLift[i] * (1 - s) * (1 - s));
        pitch = this.fromPitch[i] * (1 - s) * (1 - s);
      }
      this.lift[i] = up;
      this.pitch[i] = pitch;
      this.cx[i] = wx;
      this.cz[i] = wz;
      const ox = (wx - this.gx) / this.tiles;
      const oz = (wz - this.gz) / this.tiles;
      this.lx[i] = ox * cp - oz * sp;
      this.lz[i] = ox * sp + oz * cp;
      this.ly[i] = up;
    }
  }

  private beginSwing(i: number): void {
    // from where the foot is now (a settling step taken over mid-air starts from its spot in the air)
    if (this.state[i] !== PLANTED) {
      this.fromX[i] = this.cx[i];
      this.fromZ[i] = this.cz[i];
      this.fromLift[i] = this.lift[i];
      this.fromPitch[i] = this.pitch[i];
    } else {
      this.fromX[i] = this.fx[i];
      this.fromZ[i] = this.fz[i];
      this.fromLift[i] = 0;
      this.fromPitch[i] = 0;
    }
    this.prog[i] = 0;
  }

  private land(i: number): void {
    this.homeOf(i);
    this.fx[i] = this.hx;
    this.fz[i] = this.hz;
    this.state[i] = PLANTED;
    this.prog[i] = 0;
    this.fromLift[i] = 0;
    this.fromPitch[i] = 0;
    this.settleWait = 0.04;
  }

  /** Weight of a one-shot right now (cut-short ones fade from where they were). */
  private shotWeight(s: Shot): number {
    if (s.fadeFrom !== undefined) return s.fadeFrom * (1 - smoothstep(0, SHOT_OUT, s.fadeT ?? 0));
    return shotEnvelope(s.t, s.dur);
  }

  private updateLook(dt: number): void {
    // idle look-around now and then when nothing is looked at and nobody walks
    if (this.time > this.aroundUntil) {
      const calm = this.move < 0.2 && !this.busy();
      if (calm && this.rand() < 0.55) {
        this.aroundYaw = (this.rand() * 2 - 1) * 0.6;
        this.aroundPitch = (this.rand() - 0.6) * 0.18;
      } else {
        this.aroundYaw = 0;
        this.aroundPitch = 0;
      }
      this.aroundUntil = this.time + 1.6 + this.rand() * 3.2;
    }
    let yaw = this.lookTarget ? this.lookTarget[0] : this.aroundYaw * (1 - this.move);
    let pitch = this.lookTarget ? this.lookTarget[1] : this.aroundPitch * (1 - this.move);
    // the head leads a turn a little
    yaw += clamp(this.headingVel * -0.06, -0.3, 0.3);
    if (this.weights.read > 0.5 && !this.lookTarget) {
      yaw *= 0.3;
      pitch *= 0.3;
    }
    // a glance swings a hair past and settles (a curious little look, not a servo)
    this.lookYawS.step(yaw, 8, 0.78, dt);
    this.lookPitchS.step(pitch, 8, 0.8, dt);
  }

  // ───────────── the pose ─────────────

  private evaluate(dt: number): void {
    const p = this.pose;
    const t = this.time;
    idlePose(p, t, this.seed);

    if (this.move > 0) {
      const tmp = this.tmp;
      tmp.set(p);
      this.gaitUpper(tmp);
      blendInto(p, tmp, this.move);
    }

    for (const a of ACTIVITIES) {
      const w = this.weights[a];
      if (w <= 0) continue;
      const tmp = this.tmp;
      tmp.set(p);
      ACTIVITY_POSES[a](tmp, this.clocks[a], this);
      blendInto(p, tmp, smoothstep(0, 1, w));
    }

    let cheer = 0;
    for (const s of this.shots) {
      const w = this.shotWeight(s);
      if (w <= 0) continue;
      const tmp = this.tmp;
      tmp.set(p);
      SHOT_POSES[s.action](tmp, s.t, s.dur, this);
      blendInto(p, tmp, w);
      if (s.action === 'cheer') cheer = Math.max(cheer, w);
    }

    // head: look-at / look-around on top (less while nodding or shaking)
    const headFree = 1 - this.shots.reduce((m, s) => (s.action === 'yes' || s.action === 'no' ? Math.max(m, this.shotWeight(s)) : m), 0) * 0.7;
    const lookYaw = this.lookYawS.x;
    p[J.head * 3 + 1] += lookYaw * 0.75 * headFree;
    p[J.spine * 3 + 1] += lookYaw * 0.25 * headFree;
    p[J.head * 3] += this.lookPitchS.x * headFree;
    // a glance aside tilts the head a little (curious), standing
    p[J.head * 3 + 2] += -lookYaw * 0.22 * headFree * (1 - this.move);
    this.lively(p, dt);

    // the legs: walking they swing from the hips; standing they reach the feet on the ground (seated, and in a cheer's
    // jump, the pose's own legs)
    const legs = (1 - smoothstep(0, 1, this.weights.sit)) * (1 - cheer * (1 - this.seatBlend));
    if (legs > 0.001 && this.move > 0) this.swingLegs(p, legs);
    const ik = legs * (1 - this.move);
    if (ik > 0.001) this.solveLegs(p, ik);
    void dt;
  }

  /**
   * The upper body of a walk or a run on the legs' swing: the hips as much lower as the standing leg leans out (its
   * foot stays on the ground; a run a little higher at mid-stride), a sway of a degree onto the standing foot, a lean
   * into the pace, the pelvis turning a little with the forward leg and the shoulders against it, the head steady, the
   * arms swinging against the legs.
   */
  private gaitUpper(p: Pose): void {
    const run = this.runShare;
    const vd = Math.max(this.pace, this.cruise) / this.tiles;
    const sn = Math.sin(this.phase);
    const cs = Math.cos(this.phase);
    // +1: the left leg forward (the right back), −1 the other way
    const swing = sn;
    // the weight over the standing foot: −1 on the left, +1 on the right
    const side = cs;
    const brisk = smoothstep(0.4, 2.2, vd);
    p[C.hipY] = -swingDip(swingAmp(vd, run) * sn) + run * 0.016 * cs * cs;
    p[C.squash] = 0;
    const waddle = lerp(1, 0.4, run) * lerp(0.8, 1, brisk);
    p[C.hipX] = -0.006 * side * waddle;
    p[C.hipZ] = 0;
    const twist = -lerp(0.12, 0.16, run) * swing;
    setRot(p, J.hips, 0, twist, 0.02 * side * waddle);
    setRot(p, J.spine, lerp(0.04 + 0.02 * Math.min(vd, 2.2), 0.16, run), -twist * 1.2, -0.01 * side * waddle);
    // the head stays steady: level eyes against the lean, the sway and the pelvis' turn
    setRot(p, J.head, -lerp(0.04 + 0.02 * Math.min(vd, 2.2), 0.15, run), -twist * 0.2, -0.01 * side * waddle);
    // arms against the legs (the left arm back with the left leg forward), a little out from the round body; elbows
    // bend more coming forward
    const armA = lerp(lerp(0.32, 0.5, brisk), 0.8, run);
    const elA = lerp(0.42, 1.45, run);
    const out = ARM_OUT + 0.08 + run * 0.1;
    setRot(p, J.shL, armA * swing, 0, out + 0.05 * Math.max(0, swing));
    setRot(p, J.elL, -elA - 0.4 * Math.max(0, -swing) * (1 - run), 0, 0);
    setRot(p, J.shR, -armA * swing, 0, -out - 0.05 * Math.max(0, -swing));
    setRot(p, J.elR, -elA - 0.4 * Math.max(0, swing) * (1 - run), 0, 0);
  }

  /**
   * The legs of a walk or a run, swinging from the hips (no feet planted, nothing solved): each leg's line from the hip
   * to the ankle swings forward and back on the walk's sine, the leg coming forward bends its knee to lift its foot
   * (most at mid-swing, none at either end), the standing leg keeps a soft bend; the thigh leans ahead of that line as
   * far as the bent knee needs, the sole stays level. Blended over the pose's own legs by `w`.
   */
  private swingLegs(p: Pose, w: number): void {
    const run = this.runShare;
    const vd = Math.max(this.pace, this.cruise) / this.tiles;
    const amp = swingAmp(vd, run);
    const sn = Math.sin(this.phase);
    const cs = Math.cos(this.phase);
    const hx = p[J.hips * 3];
    const hz = p[J.hips * 3 + 2];
    const lift = lerp(lerp(0.55, 0.8, smoothstep(0.4, 2.2, vd)), 1.3, run);
    for (let i = 0; i < 2; i++) {
      // forward is a negative angle; the left leg is forward while the sine is positive
      const a = (i === 0 ? -1 : 1) * amp * sn;
      const fwd = i === 0 ? cs : -cs;
      const knee = STANCE_KNEE + (fwd > 0 ? lift * fwd * fwd : 0);
      const lean = Math.atan2(LEG.shin * Math.sin(knee), LEG.thigh + LEG.shin * Math.cos(knee));
      const thighW = a - lean;
      const th = (i === 0 ? J.thL : J.thR) * 3;
      const kn = (i === 0 ? J.knL : J.knR) * 3;
      const an = (i === 0 ? J.anL : J.anR) * 3;
      p[th] += (thighW - hx - p[th]) * w;
      p[th + 1] += (0 - p[th + 1]) * w;
      p[th + 2] += (0 - p[th + 2]) * w;
      p[kn] += (knee - p[kn]) * w;
      p[kn + 1] += (0 - p[kn + 1]) * w;
      p[kn + 2] += (0 - p[kn + 2]) * w;
      p[an] += (-thighW - knee - p[an]) * w;
      p[an + 1] += (0 - p[an + 1]) * w;
      p[an + 2] += (-hz - p[an + 2]) * w;
    }
  }

  /**
   * On top of whatever the body does (walking, standing, a one-shot): springs that make it feel alive. A lean into a
   * speed-up (the top dragged back a moment, then forward) and over a stop (it pitches on and rocks back to stand), a
   * roll into a turn (more the faster), small squash kicks as a walk sets off and stops, and the big head steadying
   * itself against the lean and the roll (no nod a step: at four steps a second that read as a shiver).
   */
  private lively(p: Pose, dt: number): void {
    const vd = this.pace / this.tiles;
    const leanGoal = clamp(-this.accel * 0.011, -0.06, 0.12) * (1 - this.seatBlend);
    this.leanS.step(leanGoal, 9, 0.75, dt);
    const roll = clamp(this.headingVel * (0.004 + 0.008 * Math.min(vd, 3)), -0.1, 0.1) * (1 - this.seatBlend);
    this.rollS.step(roll, 10, 0.85, dt);
    this.sqS.step(0, 14, 0.7, dt);
    p[J.hips * 3] += this.leanS.x * 0.35;
    p[J.spine * 3] += this.leanS.x * 0.65;
    p[J.spine * 3 + 2] += this.rollS.x;
    p[J.hips * 3 + 2] += this.rollS.x * 0.4;
    p[C.squash] += clamp(this.sqS.x, -0.08, 0.06) * (1 - this.seatBlend);
    const tilt = p[J.hips * 3 + 2] + p[J.spine * 3 + 2];
    // the head steadies itself (people keep their eyes level): only against the lean and the roll, no nod a step
    this.headPS.step(-this.leanS.x * 0.7, 10, 0.8, dt);
    this.headRS.step(-tilt * 0.5, 10, 0.8, dt);
    p[J.head * 3] += this.headPS.x;
    p[J.head * 3 + 2] += this.headRS.x;
  }

  /**
   * Two-bone IK: thigh and knee angles that put each ankle where its foot is, the hips lowered just enough for the
   * legs to reach, the soles level. Blended over the pose's own legs by `w`.
   */
  private solveLegs(p: Pose, w: number): void {
    const hx = p[J.hips * 3];
    const hy = p[J.hips * 3 + 1];
    const hz = p[J.hips * 3 + 2];
    const cx = Math.cos(hx);
    const sx = Math.sin(hx);
    const cy = Math.cos(hy);
    const sy = Math.sin(hy);
    const cz = Math.cos(hz);
    const sz = Math.sin(hz);
    // the squash scales the body round the feet: the feet's targets in the scaled frame
    const sq = p[C.squash];
    const kxz = 1 / (1 - sq * 0.5);
    const ky = 1 / (1 + sq);
    // the hips come down as far as the legs need to reach the feet on the ground (a foot in the air bends its knee)
    let drop = 0;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      // thigh pivot = hips + R · (side·width, −thighDrop, 0), R = Rx·Ry·Rz
      const ax = side * LEG.width * cz + LEG.thighDrop * sz;
      const ay = side * LEG.width * sz - LEG.thighDrop * cz;
      const bx = ax * cy;
      const bz = -ax * sy;
      const jx = p[C.hipX] + bx;
      const jy = LEG.hipY + p[C.hipY] + ay * cx - bz * sx;
      const jz = p[C.hipZ] + ay * sx + bz * cx;
      const tx = this.lx[i] * kxz;
      const tz = this.lz[i] * kxz;
      const ty = (LEG.ankle + this.ly[i]) * ky;
      const horiz2 = (tx - jx) * (tx - jx) + (tz - jz) * (tz - jz);
      const room = Math.sqrt(Math.max(0, LEG_SOFT * LEG_SOFT - horiz2));
      // a foot just lifting still holds the hips down until it has swung in under them, a foot coming down already
      // does (no drop of the hips the moment it lands)
      const pr = this.prog[i];
      const hold = this.state[i] === PLANTED ? 1 : Math.max(1 - smoothstep(0, 0.45, pr), smoothstep(0.55, 1, pr));
      drop = Math.max(drop, (jy - ty - room) * hold);
    }
    drop = clamp(drop, 0, 0.1);
    // going down at once (a foot would not reach), coming back up at most this fast (no hop as a foot lifts)
    // (eased down over a few frames, never a jump: a missing millimetre of reach is a softer sight than a jolt)
    this.drop = drop >= this.drop ? this.drop + (drop - this.drop) * approach(30, this.dt) : Math.max(drop, this.drop - 0.9 * this.dt);
    if (this.drop > 0) p[C.hipY] -= this.drop;
    const Hx = p[C.hipX];
    const Hy = LEG.hipY + p[C.hipY];
    const Hz = p[C.hipZ];
    const l1 = LEG.thigh;
    const l2 = LEG.shin;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      // the ankle's target in the hips' frame: Rᵀ (T − H) = Rz(−hz) Ry(−hy) Rx(−hx) (T − H)
      let vx = this.lx[i] * kxz - Hx;
      let vy = (LEG.ankle + this.ly[i]) * ky - Hy;
      let vz = this.lz[i] * kxz - Hz;
      let t1 = vy * cx + vz * sx;
      vz = -vy * sx + vz * cx;
      vy = t1;
      t1 = vx * cy - vz * sy;
      vz = vx * sy + vz * cy;
      vx = t1;
      t1 = vx * cz + vy * sz;
      vy = -vx * sz + vy * cz;
      vx = t1;
      // from the thigh pivot
      const qx = vx - side * LEG.width;
      let qy = vy + LEG.thighDrop;
      const qz = vz;
      // a foot lifted high right under the hip would fold the leg shut (the knee flips there): it stays a little lower
      if (qx * qx + qy * qy + qz * qz < LEG_FOLD * LEG_FOLD) qy = -Math.sqrt(Math.max(0, LEG_FOLD * LEG_FOLD - qx * qx - qz * qz));
      const len = Math.hypot(qx, qy, qz);
      // soft near straight: the knee keeps a little bend and never snaps through the last degrees
      const d = len <= LEG_SOFT ? Math.max(len, LEG_FOLD) : LEG_SOFT + (LEG_REACH - LEG_SOFT) * (1 - Math.exp(-(len - LEG_SOFT) / (LEG_REACH - LEG_SOFT)));
      const k = len > 1e-9 ? d / len : 0;
      const cosK = clamp((d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
      const knee = Math.acos(cosK);
      const A = l1 + l2 * cosK;
      const B = l2 * Math.sin(knee);
      const out = Math.asin(clamp((qx * k) / A, -1, 1));
      const Cc = A * Math.cos(out);
      const thigh = angleDelta(0, Math.atan2(qz * k, qy * k) - Math.atan2(-B, -Cc));
      const th = (i === 0 ? J.thL : J.thR) * 3;
      const kn = (i === 0 ? J.knL : J.knR) * 3;
      const an = (i === 0 ? J.anL : J.anR) * 3;
      const ankle = this.pitch[i] - hx - thigh - knee;
      p[th] += (thigh - p[th]) * w;
      p[th + 1] += (0 - p[th + 1]) * w;
      p[th + 2] += (out - p[th + 2]) * w;
      p[kn] += (knee - p[kn]) * w;
      p[kn + 1] += (0 - p[kn + 1]) * w;
      p[kn + 2] += (0 - p[kn + 2]) * w;
      p[an] += (ankle - p[an]) * w;
      p[an + 1] += (0 - p[an + 1]) * w;
      p[an + 2] += (-out - hz - p[an + 2]) * w;
    }
  }

  private updateHair(dt: number, eff: number): void {
    const accel = dt > 0 ? (eff - this.lastSpeed) / dt : 0;
    this.lastSpeed = eff;
    const hipY = this.pose[C.hipY];
    const bobV = dt > 0 ? (hipY - this.lastHipY) / dt : 0;
    this.lastHipY = hipY;
    const head = this.pose;
    // drive: hair trails back when moving / speeding up, swings out on turns, flicks with the bob and the head
    const tilt = head[J.hips * 3 + 2] + head[J.spine * 3 + 2] + head[J.head * 3 + 2];
    const driveX = 0.22 * this.move + clamp(accel * 0.05, -0.3, 0.3) - head[J.head * 3] * 0.6 + clamp(bobV * 2.2, -0.35, 0.35) + head[J.spine * 3] * -0.4;
    const driveZ = clamp(this.headingVel * 0.12, -0.45, 0.45) - tilt * 1.1 + head[J.head * 3 + 1] * 0.3;
    const k = 60;
    const c = 6;
    for (let i = 0; i < 2; i++) {
      const goal = i === 0 ? driveX : driveZ;
      const a = -k * (this.hair[i] - goal) - c * this.hairV[i];
      this.hairV[i] += a * dt;
      this.hair[i] += this.hairV[i] * dt;
      this.hair[i] = clamp(this.hair[i], -0.9, 0.9);
    }
    // second pair (pigtail on the other side) mirrors the side swing with a little lag
    this.hair[2] = this.hair[0];
    this.hair[3] = lerp(this.hair[3], -this.hair[1], approach(20, dt));
  }

  private updateFace(dt: number): void {
    let eyes: EyeState = this.mood === 'happy' ? 'happy' : 'open';
    let mouth: MouthState = this.mood === 'happy' ? 'grin' : 'smile';
    // activities
    if (this.weights.read > 0.5) eyes = 'half';
    if (this.weights.drink > 0.5 && drinkSip(this.clocks.drink) > 0.6) {
      eyes = 'closed';
      mouth = 'o';
    }
    if (this.weights.talk > 0.5) {
      this.mouthT -= dt;
      if (this.mouthT <= 0) {
        const r = this.rand();
        this.mouthShape = r < 0.42 ? 'talkA' : r < 0.7 ? 'talkO' : r < 0.85 ? 'smile' : 'neutral';
        this.mouthT = 0.07 + this.rand() * 0.1;
      }
      mouth = this.mouthShape;
    }
    // one-shots win
    let best = 0;
    for (const s of this.shots) {
      const w = this.shotWeight(s);
      if (w < 0.45 || w < best) continue;
      best = w;
      if (s.action === 'cheer') {
        eyes = 'happy';
        mouth = 'grin';
      } else if (s.action === 'wave') {
        eyes = s.t > 0.35 && s.t < 1.2 ? 'happy' : 'open';
        mouth = 'grin';
      } else if (s.action === 'yes') {
        eyes = 'happy';
        mouth = 'smile';
      } else {
        eyes = 'open';
        mouth = 'neutral';
      }
    }
    // blink
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT >= BLINK_SECONDS) {
        this.blinkT = -1;
        // now and then a double blink
        this.blinkAt = this.time + (this.rand() < 0.18 ? 0.12 : 1.8 + this.rand() * 3.4);
      }
    } else if (this.time >= this.blinkAt) {
      this.blinkT = 0;
    }
    const b = blinkEyes(this.blinkT);
    const shown = eyes as EyeState;
    this.face.eyes = b && (shown === 'open' || shown === 'wide' || shown === 'half') ? (shown === 'half' ? 'closed' : b) : shown;
    this.face.mouth = mouth;
  }

  /** Weight of an activity (tests, props). */
  weight(a: Activity): number {
    return this.weights[a];
  }
}

/** out = lerp(out, layer, w) on every channel. */
export function blendInto(out: Pose, layer: Pose, w: number): void {
  if (w <= 0) return;
  if (w >= 1) {
    out.set(layer);
    return;
  }
  for (let i = 0; i < CHANNELS; i++) out[i] += (layer[i] - out[i]) * w;
}

// ───────────────────────── poses ─────────────────────────

/** Arms rest a little away from the round body. */
const ARM_OUT = 0.13;

/** Standing about: breathing, a slow weight shift from foot to foot. */
export function idlePose(p: Pose, t: number, seed: number): void {
  p.fill(0);
  const breath = Math.sin((t * Math.PI * 2) / 3.2 + seed);
  const shift = Math.sin((t * Math.PI * 2) / 6.5 + seed * 0.7) * 0.8 + wander(t * 0.25, seed) * 0.2;
  p[C.breath] = breath;
  // breathing lifts the body a hair and stretches it a touch (soft, alive), the weight goes from foot to foot
  p[C.squash] = breath * 0.006;
  p[C.hipX] = shift * 0.014;
  p[C.hipY] = -Math.abs(shift) * 0.005 + breath * 0.0025;
  setRot(p, J.hips, 0, 0, shift * 0.04);
  setRot(p, J.spine, 0.02 + breath * 0.015, 0, -shift * 0.055);
  setRot(p, J.head, -0.02 - breath * 0.015, wander(t * 0.3, seed + 5) * 0.05, shift * 0.04 + wander(t * 0.4, seed + 3) * 0.045);
  setRot(p, J.shL, 0.04 + breath * 0.025, 0, ARM_OUT + breath * 0.03 + shift * 0.02);
  setRot(p, J.shR, 0.04 + breath * 0.025, 0, -ARM_OUT - breath * 0.03 + shift * 0.02);
  setRot(p, J.elL, -0.18, 0, 0);
  setRot(p, J.elR, -0.18, 0, 0);
  // the free leg relaxes a little (its knee bends) as the weight goes onto the other one
  const kl = Math.max(0, -shift) * 0.16;
  const kr = Math.max(0, shift) * 0.16;
  setRot(p, J.thL, -kl * 0.5, 0, -shift * 0.035);
  setRot(p, J.knL, kl, 0, 0);
  setRot(p, J.anL, -kl * 0.5, 0, shift * 0.035);
  setRot(p, J.thR, -kr * 0.5, 0, -shift * 0.035);
  setRot(p, J.knR, kr, 0, 0);
  setRot(p, J.anR, -kr * 0.5, 0, shift * 0.035);
}

/** The sip of a drink cycle: 0 holding, 1 cup at the mouth. */
export function drinkSip(t: number): number {
  const k = t % ACTION_SECONDS.drink;
  return smoothstep(1.4, 2.0, k) * (1 - smoothstep(2.9, 3.5, k));
}

type ActivityPose = (p: Pose, t: number, a: Animator) => void;
type ShotPose = (p: Pose, t: number, dur: number, a: Animator) => void;

const sitPose: ActivityPose = (p, t, a) => {
  const raise = kneeRaiseForSeat(a.seat);
  const hipY = a.seat + SEAT_TO_HIP - BODY.hipY;
  p[C.hipY] = hipY;
  p[C.hipX] = 0;
  p[C.hipZ] = -0.035;
  setRot(p, J.hips, 0, 0, 0);
  setRot(p, J.spine, -0.06 + p[C.breath] * 0.012, 0, Math.sin(t * 0.7) * 0.02);
  // thighs forward (a little up for a low seat), shins hanging; the feet swing now and then
  const swing = Math.sin(t * 2.6) * 0.18 * smoothstep(0.3, 1.5, Math.sin(t * 0.37) + 0.6);
  const th = -Math.PI / 2 - raise;
  setRot(p, J.thL, th, 0, 0.1);
  setRot(p, J.thR, th, 0, -0.1);
  setRot(p, J.knL, Math.PI / 2 + raise + swing, 0, 0);
  setRot(p, J.knR, Math.PI / 2 + raise - swing, 0, 0);
  setRot(p, J.anL, -0.15 - swing * 0.4, 0, 0);
  setRot(p, J.anR, -0.15 + swing * 0.4, 0, 0);
  // hands on the lap
  setRot(p, J.shL, -0.42, 0, ARM_OUT + 0.08);
  setRot(p, J.shR, -0.42, 0, -ARM_OUT - 0.08);
  setRot(p, J.elL, -0.75, 0, 0);
  setRot(p, J.elR, -0.75, 0, 0);
};

const talkPose: ActivityPose = (p, t, a) => {
  const n1 = wander(t * 1.3, 11);
  const n2 = wander(t * 1.1, 23);
  const n3 = wander(t * 0.9, 37);
  const beat = Math.max(0, Math.sin(t * 6.2)) * 0.5 + Math.max(0, Math.sin(t * 3.9 + 1)) * 0.5;
  const seated = a.seatBlend;
  // the right hand talks the most, the left joins in
  setRot(p, J.shR, -0.45 - 0.35 * n1 - (1 - seated) * 0.05, 0.15, -ARM_OUT - 0.25 - 0.18 * n2);
  setRot(p, J.elR, -1.15 - 0.45 * n2 - beat * 0.25, 0.25, 0);
  setRot(p, J.shL, lerp(-0.05, -0.4, seated) - 0.35 * Math.max(0, n3), -0.1, ARM_OUT + 0.1 + 0.12 * Math.max(0, n3));
  setRot(p, J.elL, lerp(-0.4, -0.75, seated) - 0.7 * Math.max(0, n3), 0, 0);
  p[J.head * 3] += 0.05 * Math.sin(t * 4.1) * beat + 0.03 * n1;
  p[J.head * 3 + 2] += 0.07 * n2;
  p[J.head * 3 + 1] += 0.08 * n3;
  p[J.spine * 3 + 1] += 0.05 * n1;
  p[J.spine * 3] += 0.03 * beat;
};

const drinkPose: ActivityPose = (p, t) => {
  const sip = easeInOut(drinkSip(t));
  setRot(p, J.shR, lerp(-0.35, -1.25, sip), lerp(0.3, 0.6, sip), -ARM_OUT - 0.1);
  setRot(p, J.elR, lerp(-1.6, -2.05, sip), 0.2, 0);
  p[C.sip] = sip;
  p[J.head * 3] += lerp(0.05, -0.28, sip);
  p[J.spine * 3] += lerp(0, -0.05, sip);
  setRot(p, J.shL, -0.1, 0, ARM_OUT + 0.02);
  p[C.cup] = 1;
};

const waterPose: ActivityPose = (p, t) => {
  const sweep = Math.sin((t * Math.PI * 2) / ACTION_SECONDS.water);
  setRot(p, J.shR, -0.85, 0.1, -ARM_OUT - 0.25);
  setRot(p, J.elR, -0.35, 0, 0);
  setRot(p, J.shL, -0.25, 0, ARM_OUT + 0.05);
  setRot(p, J.elL, -0.9, 0, 0);
  p[J.spine * 3] += 0.14;
  p[J.spine * 3 + 1] += 0.3 * sweep;
  p[J.head * 3] += 0.22;
  p[J.head * 3 + 1] += 0.1 * sweep;
  p[C.can] = 1;
  p[C.canTilt] = 0.55 + 0.12 * Math.sin(t * 5.3);
};

const fishPose: ActivityPose = (p, t) => {
  const k = t % ACTION_SECONDS.fish;
  const tug = smoothstep(3.6, 3.75, k) * (1 - smoothstep(3.75, 4.3, k));
  setRot(p, J.shR, -0.75 - tug * 0.25, 0.25, -ARM_OUT - 0.1);
  setRot(p, J.elR, -0.75 - tug * 0.3, 0.3, 0);
  setRot(p, J.shL, -0.95 - tug * 0.25, -0.35, ARM_OUT + 0.02);
  setRot(p, J.elL, -0.65, -0.3, 0);
  p[J.spine * 3] += -0.04 - tug * 0.08 + Math.sin(t * 0.8) * 0.015;
  p[J.head * 3] += 0.12;
  p[C.rod] = 1;
  p[C.tug] = tug;
};

const readPose: ActivityPose = (p, t) => {
  const k = t % ACTION_SECONDS.read;
  const turn = smoothstep(3.6, 3.9, k) * (1 - smoothstep(4.1, 4.5, k));
  setRot(p, J.shL, -0.62, 0, ARM_OUT + 0.12);
  setRot(p, J.elL, -1.25, -0.55, 0);
  setRot(p, J.shR, -0.62 - turn * 0.2, 0, -ARM_OUT - 0.12);
  setRot(p, J.elR, -1.25 - turn * 0.35, 0.55 + turn * 0.3, 0);
  p[J.head * 3] += 0.3 - turn * 0.08 + Math.sin(t * 1.7) * 0.02;
  p[J.head * 3 + 1] += Math.sin((k / ACTION_SECONDS.read) * Math.PI * 2) * 0.05;
  p[C.book] = 1;
};

export const ACTIVITY_POSES: Readonly<Record<Activity, ActivityPose>> = {
  sit: sitPose,
  talk: talkPose,
  drink: drinkPose,
  water: waterPose,
  fish: fishPose,
  read: readPose,
};

const wavePose: ShotPose = (p, t, dur) => {
  const up = smoothstep(0, 0.3, t) * (1 - smoothstep(dur - 0.35, dur, t));
  const wag = Math.sin((t - 0.25) * Math.PI * 2 * 2.1) * smoothstep(0.2, 0.4, t);
  setRot(p, J.shR, lerp(p[J.shR * 3], -0.35, up), 0, lerp(p[J.shR * 3 + 2], -1.75, up));
  setRot(p, J.elR, -0.1, 0, lerp(-0.2, -1.25, up) - 0.4 * wag);
  p[J.head * 3 + 2] += 0.1 * up;
  p[J.spine * 3 + 2] += 0.05 * up;
  p[J.head * 3] -= 0.06 * up;
};

const yesPose: ShotPose = (p, t) => {
  // two nods, the first deeper
  const k = clamp(t / 0.85, 0, 1);
  const nod = Math.pow(Math.sin(k * Math.PI * 2), 2) * (k < 0.5 ? 1 : 0.7);
  // the whole upper body bows a little with the head (a head-only nod is lost at the town's zoom)
  p[J.head * 3] += 0.36 * nod;
  p[J.spine * 3] += 0.16 * nod;
  p[C.hipY] -= 0.006 * nod;
};

const noPose: ShotPose = (p, t, dur) => {
  const k = clamp(t / dur, 0, 1);
  const shake = Math.sin(k * Math.PI * 2 * 2.4) * (1 - k * 0.6);
  // the shoulders turn with the head (a head-only shake is lost at the town's zoom), the arms swing out a little
  p[J.head * 3 + 1] += 0.45 * shake;
  p[J.spine * 3 + 1] += 0.2 * shake;
  p[J.hips * 3 + 1] += 0.05 * shake;
  p[J.shL * 3 + 2] += 0.08 * Math.abs(shake);
  p[J.shR * 3 + 2] -= 0.08 * Math.abs(shake);
  p[J.head * 3] += 0.06;
};

/** Height (design units) of the cheer's jump at time t (two hops), for tests and the pose. */
export function cheerHop(t: number): number {
  const hop = (a: number, b: number, h: number) => (t > a && t < b ? h * Math.sin(((t - a) / (b - a)) * Math.PI) : 0);
  return hop(0.18, 0.56, 0.12) + hop(0.72, 1.0, 0.06);
}

const cheerPose: ShotPose = (p, t, _dur, a) => {
  const free = 1 - a.seatBlend; // seated: arms only
  const crouch = smoothstep(0, 0.14, t) * (1 - smoothstep(0.14, 0.22, t)) + smoothstep(0.52, 0.6, t) * (1 - smoothstep(0.62, 0.74, t)) * 0.8 + smoothstep(0.96, 1.02, t) * (1 - smoothstep(1.04, 1.2, t)) * 0.5;
  const hop = cheerHop(t);
  const arms = smoothstep(0.08, 0.3, t);
  const shakeArms = Math.sin(t * 18) * 0.12 * arms;
  setRot(p, J.shL, lerp(p[J.shL * 3], -0.3, arms), 0, lerp(p[J.shL * 3 + 2], 2.25 + shakeArms, arms));
  setRot(p, J.shR, lerp(p[J.shR * 3], -0.3, arms), 0, lerp(p[J.shR * 3 + 2], -2.25 + shakeArms, arms));
  setRot(p, J.elL, -0.25, 0, 0.35);
  setRot(p, J.elR, -0.25, 0, -0.35);
  p[J.head * 3] -= 0.18 * arms;
  if (free > 0) {
    p[C.hipY] += (hop - crouch * 0.05) * free;
    // stretched in the air, squashed in the crouch, eased between (a switch at take-off popped)
    const up = smoothstep(0, 0.03, hop);
    p[C.squash] += (0.06 * up - 0.07 * crouch * (1 - up)) * free;
    for (const [th, kn, an] of [
      [J.thL, J.knL, J.anL],
      [J.thR, J.knR, J.anR],
    ]) {
      p[th * 3] += (-0.55 * crouch - 0.25 * (hop / 0.12)) * free;
      p[kn * 3] += (1.1 * crouch + 0.45 * (hop / 0.12)) * free;
      p[an * 3] += (-0.55 * crouch) * free;
    }
    p[J.spine * 3] += (0.18 * crouch - 0.08 * (hop / 0.12)) * free;
  }
};

export const SHOT_POSES: Readonly<Record<OneShot, ShotPose>> = { wave: wavePose, yes: yesPose, no: noPose, cheer: cheerPose };
