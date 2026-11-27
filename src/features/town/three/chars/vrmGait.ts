// How fast an avatar's legs go and how much of a run its gait is (./vrmBody.ts). Pure.
//
// The town's ground speeds were set for the round code body and are quick for a figure of real proportions: the
// player's everyday pace (1.6 tiles/s) is 2.6 of an avatar's own heights a second, which for a person is a run, and
// the run (2.8 tiles/s) is a sprint. The first avatar gait turned the legs as fast as the ground went by under a
// WALKING stride, so no foot slid: six steps a second at the everyday pace and seven running, three times what legs
// do (owner, 2026-11-27: "chân nó chuyển động nhiều quá … tao thấy không tự nhiên", and the speed is to stay).
//
// So the legs keep a person's own rhythm whatever the ground speed (at most 3.3 steps a second). The everyday pace was
// first an easy jog, so that its moment in the air covered the ground; the owner, after playing it (2026-11-27): "sao đi
// mà vung tay nhiều dữ vậy, chạy mới vung tay nhiều chứ, đi tự nhiên như nhân vật nữ này đc nè" (a resident strolling,
// her arms hanging nearly straight, swinging a little). So every pace up to the player's everyday one is a WALK (the
// arms hanging, the elbows nearly straight, no lean, no moment in the air), with a longer step the quicker it goes
// (`avatarWalkReach`); only a real run (Shift, `PLAYER_RUN`, or somebody set running) is a run. The rhythm is not
// raised to make up for it: the feet slide a little more at the everyday pace, which the owner has never minded, and
// legs going too fast he has.

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/** Steps a second at the slowest stroll and at the fastest run: what a person's legs do. */
export const CADENCE_MIN = 1.7;
export const CADENCE_MAX = 3.3;
/**
 * The pace (the body's own heights a second) up to which the gait is a walk, and from which it is a full run: a grown-up
 * avatar walks at the player's everyday 1.6 tiles a second (2.56 of its heights) and runs at 2.8 (4.5).
 */
export const WALK_UP_TO = 2.6;
export const RUN_FROM = 4.4;
/** How much longer a walking step is at the top of the walk than at a stroll. */
export const WALK_REACH_MAX = 1.22;

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

/** How much of a run the gait is at that pace (0 a walk, the everyday pace too; 1 a run). */
export function avatarRunShare(speed: number, tall: number): number {
  return clamp((paceInHeights(speed, tall) - WALK_UP_TO) / (RUN_FROM - WALK_UP_TO), 0, 1);
}

/**
 * How much longer than a stroll's a walking step is at that pace (1 at a stroll, `WALK_REACH_MAX` at the top of the
 * walk): a quicker walk takes longer steps, so the feet slide less without the legs going faster.
 */
export function avatarWalkReach(speed: number, tall: number): number {
  const k = clamp((paceInHeights(speed, tall) - 1.2) / (WALK_UP_TO - 1.2), 0, 1);
  return 1 + (WALK_REACH_MAX - 1) * k;
}
