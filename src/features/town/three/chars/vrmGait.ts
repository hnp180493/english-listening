// How fast an avatar's legs go and how much of a run its gait is (./vrmBody.ts). Pure.
//
// The town's ground speeds were set for the round code body and are quick for a figure of real proportions: the
// player's everyday pace (1.6 tiles/s) is 2.6 of an avatar's own heights a second, which for a person is a run, and
// the run (2.8 tiles/s) is a sprint. The first avatar gait turned the legs as fast as the ground went by under a
// WALKING stride, so no foot slid: six steps a second at the everyday pace and seven running, three times what legs
// do (owner, 2026-11-27: "chân nó chuyển động nhiều quá … tao thấy không tự nhiên", and the speed is to stay).
//
// So the legs keep a person's own rhythm whatever the ground speed, and the gait changes with the pace instead of the
// rhythm: a stroll is a walk, the everyday pace an easy jog, the run a run. A jog and a run have a moment in the air
// each step, so a step covers more ground than the legs span and the feet still do not slide much.

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/** Steps a second at the slowest stroll and at the fastest run: what a person's legs do. */
export const CADENCE_MIN = 1.7;
export const CADENCE_MAX = 3.3;
/** The pace (the body's own heights a second) up to which the gait is a walk, and from which it is a full run. */
export const WALK_UP_TO = 1.5;
export const RUN_FROM = 3.6;

/** A pace in the body's own heights a second (`speed` and `tall` in the same unit). */
export const paceInHeights = (speed: number, tall: number): number => Math.abs(speed) / Math.max(0.05, tall);

/**
 * Steps a second of an avatar `tall` high moving at `speed`: about 2 strolling, 2.7 at the player's everyday pace,
 * 3.3 running. Standing still: none.
 */
export function avatarCadence(speed: number, tall: number): number {
  if (Math.abs(speed) < 0.02) return 0;
  return clamp(1.55 + 0.45 * paceInHeights(speed, tall), CADENCE_MIN, CADENCE_MAX);
}

/** How much of a run the gait is at that pace (0 a walk, about a half the everyday jog, 1 a run). */
export function avatarRunShare(speed: number, tall: number): number {
  return clamp((paceInHeights(speed, tall) - WALK_UP_TO) / (RUN_FROM - WALK_UP_TO), 0, 1);
}
