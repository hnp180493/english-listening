// The town's clock and weather (owner, 2026-11-26: "tham khảo thời gian rồi thời tiết này nọ của gta rồi mô phỏng theo
// đi"; before, day or night was the app's light or dark theme and the weather a word in "Việc hôm nay"). As in GTA V
// a day in the game takes 48 real minutes (an hour of the game is two minutes), the light follows the hour through
// dawn, day, dusk and night, and the weather changes by itself every few hours of the game, one kind easing into the
// next. Everything here is a pure function of the real time, so every machine sees the same hour and the same sky, a
// reload changes nothing, and nothing is stored. The day's own weather (core/town/world.ts `weatherOf`, what the
// radio reads) leans the odds: on a "rain" day it rains most of the time, on a clear one seldom.

import type { Weather } from './sceneTypes';

/** A day of the game in real milliseconds (GTA V: 48 minutes). */
export const GAME_DAY_MS = 48 * 60 * 1000;
const MINUTES = 24 * 60;

/** The kinds of sky. */
export type Sky = 'clear' | 'cloudy' | 'rain' | 'storm';
export const SKIES: readonly Sky[] = ['clear', 'cloudy', 'rain', 'storm'];

/** Minutes since the game's midnight (0 … 1440) at a real time. */
export function gameMinutes(nowMs: number): number {
  const m = ((nowMs % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS;
  return (m / GAME_DAY_MS) * MINUTES;
}

/** The game's hour as a number (13.5 = 13:30). */
export function gameHour(nowMs: number): number {
  return gameMinutes(nowMs) / 60;
}

/** "13:30": the clock on the HUD (the minutes in fives: a game minute is two real seconds, too quick to read). */
export function clockLabel(nowMs: number): string {
  const m = Math.floor(gameMinutes(nowMs) / 5) * 5;
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Dawn 05:00–07:00, dusk 17:30–20:00. */
export const DAWN = [5, 7] as const;
export const DUSK = [17.5, 20] as const;

/** How much of the night it is at an hour: 0 by day, 1 at night, easing through dawn and dusk. */
export function nightOf(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h < 12) return 1 - smooth(DAWN[0], DAWN[1], h);
  return smooth(DUSK[0], DUSK[1], h);
}

/** How golden the light is: up to 1 in the middle of dawn and of dusk, 0 at noon and at night. */
export function glowOf(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const bump = (a: number, b: number): number => {
    if (h <= a || h >= b) return 0;
    const t = (h - a) / (b - a);
    return Math.sin(t * Math.PI);
  };
  return Math.max(bump(DAWN[0] - 0.3, DAWN[1] + 0.8), bump(DUSK[0] - 1.2, DUSK[1] - 0.3));
}

// ───────────────────────── the weather ─────────────────────────

/** A stretch of weather lasts this many hours of the game (12 real minutes); the last one eases into the next. */
export const SLOT_HOURS = 6;
const SLOT_MS = (GAME_DAY_MS / 24) * SLOT_HOURS;
const EASE_MS = GAME_DAY_MS / 24;

/** The odds of each sky by the day's own weather (in the order of SKIES). */
const ODDS: Readonly<Record<Weather, readonly number[]>> = {
  clear: [62, 26, 9, 3],
  cloudy: [22, 50, 22, 6],
  rain: [8, 24, 48, 20],
};

function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** The sky of a stretch (its number counted from 1970), by the day's weather. */
export function skyOfSlot(slot: number, day: Weather): Sky {
  const odds = ODDS[day];
  const total = odds.reduce((a, b) => a + b, 0);
  let r = hash(slot) * total;
  for (let i = 0; i < SKIES.length; i++) {
    r -= odds[i];
    if (r < 0) return SKIES[i];
  }
  return 'clear';
}

/** How much there is of each thing in the sky, 0 … 1 (a mix while one kind eases into the next). */
export interface SkyMix {
  /** Cloud cover: the sun dimmed and greyed. */
  cloud: number;
  rain: number;
  /** Thunder and lightning. */
  storm: number;
  wind: number;
}

const MIX: Readonly<Record<Sky, SkyMix>> = {
  clear: { cloud: 0, rain: 0, storm: 0, wind: 0 },
  cloudy: { cloud: 0.7, rain: 0, storm: 0, wind: 0.25 },
  rain: { cloud: 0.9, rain: 0.75, storm: 0, wind: 0.5 },
  storm: { cloud: 1, rain: 1, storm: 1, wind: 1 },
};

export interface SkyNow {
  /** The game's hour (13.5 = 13:30). */
  hour: number;
  /** The sky that counts now (the next one once more than half eased in). */
  sky: Sky;
  mix: SkyMix;
  /** 0 by day … 1 at night. */
  night: number;
  /** The gold of dawn and dusk, 0 … 1 (less under cloud). */
  glow: number;
}

/** The clock and the sky at a real time, by the day's own weather. */
export function skyAt(nowMs: number, day: Weather): SkyNow {
  const slot = Math.floor(nowMs / SLOT_MS);
  const into = nowMs - slot * SLOT_MS;
  const a = skyOfSlot(slot, day);
  const b = skyOfSlot(slot + 1, day);
  // the last hour of a stretch eases into the next one
  const t = smooth(SLOT_MS - EASE_MS, SLOT_MS, into);
  const ma = MIX[a];
  const mb = MIX[b];
  const mix: SkyMix = {
    cloud: ma.cloud + (mb.cloud - ma.cloud) * t,
    rain: ma.rain + (mb.rain - ma.rain) * t,
    storm: ma.storm + (mb.storm - ma.storm) * t,
    wind: ma.wind + (mb.wind - ma.wind) * t,
  };
  const hour = gameHour(nowMs);
  return { hour, sky: t > 0.5 ? b : a, mix, night: nightOf(hour), glow: glowOf(hour) * (1 - 0.7 * mix.cloud) };
}

/**
 * Lightning: whether a flash is on at a real time in a storm of strength `storm`, and how bright (0 … 1). A flash
 * is two quick strokes; in a full storm one comes about every nine seconds. Pure, so the picture (the engine) and the
 * thunder (the page) agree without talking to each other.
 */
export function lightningAt(nowMs: number, storm: number): number {
  if (storm < 0.35) return 0;
  const second = Math.floor(nowMs / 1000);
  // (the last three seconds: a flash lasts under one, the thunder is asked about a little later)
  for (let s = second; s > second - 1; s--) {
    if (hash(s * 7 + 13) > 0.11 * storm) continue;
    const at = s * 1000 + hash(s * 31 + 5) * 600;
    const dt = nowMs - at;
    if (dt < 0) continue;
    if (dt < 90) return 1;
    if (dt > 170 && dt < 250) return 0.7;
  }
  return 0;
}

/** The real time of the flash that struck in the second of `nowMs`, or null: for the thunder that follows it. */
export function strikeIn(nowMs: number, storm: number): number | null {
  if (storm < 0.35) return null;
  const s = Math.floor(nowMs / 1000);
  if (hash(s * 7 + 13) > 0.11 * storm) return null;
  return s * 1000 + hash(s * 31 + 5) * 600;
}

/** The Vietnamese name of a sky (the HUD's label). */
export const SKY_NAME: Readonly<Record<Sky, string>> = { clear: 'Trời quang', cloudy: 'Nhiều mây', rain: 'Trời mưa', storm: 'Mưa giông' };
