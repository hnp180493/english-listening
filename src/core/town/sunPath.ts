// What the clock and the weather do to the picture, as pure functions of the hour and the real time (core/town/sky.ts
// keeps the clock; docs/town.md §24). As in GTA you should tell the hour from the light and the weather from the
// ground: the sun travels an arc (low in the east at dawn, high at noon, low in the west at dusk) so shadows turn and
// lengthen, the same light is the moon on its own arc at night; the ground darkens and shines when it rains and dries
// over a few hours of the game after; mist lies at dawn and in the rain. Nothing here is stored: the wetness at any
// moment is worked out from the sky of the hours before it, which is itself a function of the time.

import type { Weather } from './sceneTypes';
import { GAME_DAY_MS, skyAt, type SkyMix } from './sky';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * The sun at noon, the scene's default (scene/world3d.ts SUN_DIR, the offscreen studios use it too): towards the
 * viewer's left and in front of the town, so the faces with doors are lit. Not normalised (as it always was).
 */
export const NOON_SUN: Vec3 = { x: -0.42, y: 0.78, z: 0.46 };

const DEG = Math.PI / 180;
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const NOON = unit(NOON_SUN);
/** The noon sun's height and the way it comes from on the ground (radians; 0 = +x, the east). */
const NOON_EL = Math.asin(NOON.y);
const NOON_AZ = Math.atan2(NOON.z, NOON.x);

/** No light ever comes from lower than this while it lights the town (a shadow is at most 4 times as long as tall). */
export const MIN_ELEVATION = 14 * DEG;

/**
 * The sun is up from SUNRISE to SUNSET (game hours), the moon the rest of the night: the hand-overs fall where the
 * town is already all but night (sky.ts nightOf: dawn 05:00–07:00, dusk 17:30–20:00), so the low gold sun of dawn and
 * dusk is at its full strength.
 */
export const SUNRISE = 5.25;
export const SUNSET = 19.6;
/** The sun is highest here: the noon direction is exactly NOON_SUN. */
const SUN_NOON = (SUNRISE + SUNSET) / 2;
/** How far the sun's way on the ground turns from noon to rising or setting. */
const SUN_SWEEP = 95 * DEG;
/** The moon's arc: lower than the sun's, a little turned from it. */
const MOON_EL = 46 * DEG;
const MOON_TURN = 18 * DEG;
const MOON_SWEEP = 80 * DEG;
/** The light fades out to nothing over this long before it hands over, and in after (game hours). */
const SUN_RAMP = 1.0;
const MOON_RAMP = 1.0;
/** Round the hand-over the direction swings from where the sun sets to where the moon rises, while almost dark. */
const SWAP_HALF = 0.25;

export interface SunNow {
  /** Unit vector TOWARDS the light (the way a directional light's position sits from its target). */
  dir: Vec3;
  /** How much of its full strength this light gives now, 0 … 1 (0 at the hand-over between sun and moon). */
  strength: number;
  /** True while the light is the moon. */
  moon: boolean;
}

function onArc(u: number, elMax: number, az0: number, sweep: number): Vec3 {
  // the height eases from the lowest (at rising and setting) to the highest (at the arc's middle)
  const el = MIN_ELEVATION + (elMax - MIN_ELEVATION) * Math.cos((u * Math.PI) / 2);
  const az = az0 + u * sweep;
  const c = Math.cos(el);
  return { x: c * Math.cos(az), y: Math.sin(el), z: c * Math.sin(az) };
}

/** Where the sun is at a game hour inside its day (SUNRISE … SUNSET). */
function sunDir(h: number): Vec3 {
  const u = Math.max(-1, Math.min(1, (h - SUN_NOON) / ((SUNSET - SUNRISE) / 2)));
  return onArc(u, NOON_EL, NOON_AZ, SUN_SWEEP);
}

/** Where the moon is at an hour of the night counted on from SUNSET (SUNSET … SUNRISE + 24). */
function moonDir(h: number): Vec3 {
  const half = (SUNRISE + 24 - SUNSET) / 2;
  const u = Math.max(-1, Math.min(1, (h - (SUNSET + half)) / half));
  return onArc(u, MOON_EL, NOON_AZ + MOON_TURN, MOON_SWEEP);
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Along the great circle from a to b (both unit, never opposite here): an even turn, always above the lower of the two. */
function blend(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const th = Math.acos(d);
  if (th < 1e-6) return a;
  const ka = Math.sin((1 - t) * th) / Math.sin(th);
  const kb = Math.sin(t * th) / Math.sin(th);
  return unit({ x: a.x * ka + b.x * kb, y: a.y * ka + b.y * kb, z: a.z * ka + b.z * kb });
}

/**
 * The light over the town at a game hour (0 … 24, wrapped): the sun from SUNRISE to SUNSET, the moon the rest. The
 * direction is continuous over the whole day: round each hand-over it swings from one to the other while the light's
 * strength is near nothing, so the swap is not seen.
 */
export function sunAt(hour: number): SunNow {
  const h = ((hour % 24) + 24) % 24;
  // the hand-overs: at dusk sun → moon, at dawn moon → sun
  for (const [swap, sunFirst] of [[SUNSET, true], [SUNRISE, false]] as const) {
    if (Math.abs(h - swap) < SWAP_HALF) {
      const a = swap - SWAP_HALF;
      const b = swap + SWAP_HALF;
      const from = sunFirst ? sunDir(a) : moonDir(a + 24);
      const to = sunFirst ? moonDir(b) : sunDir(b);
      const t = smooth(a, b, h);
      return { dir: blend(from, to, t), strength: strengthAt(h), moon: sunFirst ? h > swap : h < swap };
    }
  }
  if (h >= SUNRISE && h <= SUNSET) return { dir: sunDir(h), strength: strengthAt(h), moon: false };
  return { dir: moonDir(h < SUNRISE ? h + 24 : h), strength: strengthAt(h), moon: true };
}

function strengthAt(h: number): number {
  if (h >= SUNRISE && h <= SUNSET) return smooth(0, SUN_RAMP, h - SUNRISE) * smooth(0, SUN_RAMP, SUNSET - h);
  const n = h < SUNRISE ? h + 24 : h;
  return smooth(0, MOON_RAMP, n - SUNSET) * smooth(0, MOON_RAMP, SUNRISE + 24 - n);
}

/** The angle between two directions, in degrees. */
export function angleDeg(a: Vec3, b: Vec3): number {
  const ua = unit(a);
  const ub = unit(b);
  const d = Math.max(-1, Math.min(1, ua.x * ub.x + ua.y * ub.y + ua.z * ub.z));
  return Math.acos(d) / DEG;
}

/**
 * The direction the shadows are drawn with: it moves only once the light has turned by `stepDeg` (a fraction of a
 * degree), so the shadow map is not re-aimed every frame (a re-aim moves every shadow edge by up to a texel: done
 * every frame it shimmers). Returns `held` itself when it has not turned enough.
 */
export function stepSun(held: Vec3, want: Vec3, stepDeg = 0.3): Vec3 {
  return angleDeg(held, want) >= stepDeg ? unit(want) : held;
}

// ───────────────────────── the ground ─────────────────────────

const GAME_HOUR_MS = GAME_DAY_MS / 24;
/** Wet ground dries out over this many hours of the game after the rain stops (6 real minutes). */
export const DRY_HOURS = 4;
/** The past is looked at in steps of this many game hours (10 game minutes). */
const WET_STEP = 1 / 6;

/** How hard it rains at a time, by the day's weather (a function of the time, or one weather for every moment). */
type DayOf = Weather | ((ms: number) => Weather);

/**
 * How wet the ground is at a real time, 0 … 1: it gets wet with the rain (a little more than the rain: a moderate
 * rain soaks it) and dries out over DRY_HOURS after. Worked out from the sky of the hours before, so every machine and
 * every reload sees the same.
 */
export function wetAt(nowMs: number, day: DayOf): number {
  const dayAt = typeof day === 'function' ? day : () => day;
  let w = 0;
  const n = Math.ceil(DRY_HOURS / WET_STEP);
  for (let k = 0; k <= n; k++) {
    const age = k * WET_STEP;
    const left = 1 - age / DRY_HOURS;
    if (left <= w) break;
    const at = nowMs - age * GAME_HOUR_MS;
    const rain = skyAt(at, dayAt(at)).mix.rain;
    w = Math.max(w, Math.min(1, rain * 1.4) * left);
  }
  return w;
}

/**
 * How misty the air is, 0 … 1: none at a clear noon, a light mist at dawn (heavier on wet ground), a little at
 * night, more in the rain, most in a storm.
 */
export function hazeOf(hour: number, mix: SkyMix, wet: number): number {
  const h = ((hour % 24) + 24) % 24;
  const bump = (a: number, peak: number, b: number): number => (h <= a || h >= b ? 0 : h < peak ? smooth(a, peak, h) : 1 - smooth(peak, b, h));
  const dawn = bump(4, 6.2, 9.5) * (0.45 + 0.4 * wet);
  const night = 0.12 * (h < 12 ? 1 - smooth(4, 6, h) : smooth(19.5, 21.5, h));
  const weather = 0.18 * mix.cloud + 0.4 * mix.rain + 0.25 * mix.storm;
  return Math.min(1, Math.max(dawn, night) + weather);
}
