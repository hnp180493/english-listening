// The one way into the game's time (docs/town.md §33 "Waiting for an hour"): `gameNow(real)`. The game's clock is a
// function of the real time, the same on every machine (./clockMath.ts, ./sky.ts), except that a learner may sleep in
// their hideout until the evening (18:00) or the morning (06:00): THIS machine's clock then runs on by a few hours of
// the game, for a while, and comes back to the shared clock by itself at the first moment both clocks show the same
// light (both night, or both day), so the jump back is not seen as a change of light.
//
// What moves with it: everything that reads the hour (./sky.ts gameMinutes / gameHour / clockLabel and skyAt's hour,
// hence the light, the sun, the HUD, Bay FM's time and forecast, Westbay's opening hours, the phone's call-back
// deadlines, the jobs' appointments). What does NOT: the weather (its stretches are the real time's on every machine:
// sleeping never dodges the rain), and anything counted per REAL day or that pays (the daily tasks and allowances, a
// chapter a day, the office's word of the game day, the hideout's rest of the hour): those read the real time, so a
// sleep is never a way to a new day's rewards (tested: gameClock.test.ts).
//
// Stored per browser (KEYS.gameClock, device-local: never synced, never in a backup). The rule "once a real hour" is a
// guess against abuse.

import { KEYS, loadJSON, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import { clockMinutes, GAME_DAY_MS, GAME_HOUR_MS, GAME_MINUTE_MS, glowOf, nightOf } from './clockMath';

/** This machine's clock, moved on by a sleep: shown time = real time + `offset` while the real time is before `until`. */
export interface Shift {
  /** Real ms added to the real time (a part of a game day: 0 … GAME_DAY_MS). */
  offset: number;
  /** The real time the clock comes back to the shared one. */
  until: number;
  /** The real time of the last sleep (one a real hour). */
  slept: number;
}

/** A sleep is allowed once in this long (real ms: one real hour). A guess. */
export const SLEEP_EVERY_MS = 60 * 60 * 1000;
/** After a sleep the clock stays moved on at least this long (real ms: two hours of the game), then rejoins. */
export const MIN_SHIFT_MS = 2 * GAME_HOUR_MS;

export type SleepTo = 'evening' | 'morning';
/** The hour a sleep wakes at. */
export const WAKE_HOUR: Readonly<Record<SleepTo, number>> = { evening: 18, morning: 6 };

/** Real ms added at a real time (0 without a shift or after it ended). */
export function offsetAt(real: number, shift: Shift | null): number {
  return shift && real < shift.until ? shift.offset : 0;
}

/** The game's time (ms on the game's clock) at a real time, by a shift. */
export function shownAt(real: number, shift: Shift | null): number {
  return real + offsetAt(real, shift);
}

/** Which sleep fits an hour of the game: by day, to the evening; in the evening and the night, to the morning. */
export const sleepFor = (hour: number): SleepTo => {
  const h = ((hour % 24) + 24) % 24;
  return h >= WAKE_HOUR.morning && h < WAKE_HOUR.evening ? 'evening' : 'morning';
};

/** A sleep is allowed now (once a real hour). */
export function canSleep(shift: Shift | null, real: number): boolean {
  return !shift || real - shift.slept >= SLEEP_EVERY_MS || real < shift.slept;
}

/** Real ms until the next sleep is allowed (0 = now). */
export function sleepWait(shift: Shift | null, real: number): number {
  return canSleep(shift, real) ? 0 : shift!.slept + SLEEP_EVERY_MS - real;
}

/**
 * When a clock moved on by `offset` comes back: the first moment, at least MIN_SHIFT_MS after `from`, when the shared
 * clock and the moved one show the same light (night and gold within a hair). Pure; within three game days (a day's
 * offset is the shared clock itself, so it always ends).
 */
export function rejoinAt(from: number, offset: number): number {
  const step = 5 * GAME_MINUTE_MS;
  for (let t = from + MIN_SHIFT_MS; t < from + 3 * GAME_DAY_MS; t += step) {
    const real = clockMinutes(t) / 60;
    const moved = clockMinutes(t + offset) / 60;
    if (Math.abs(nightOf(real) - nightOf(moved)) < 0.02 && Math.abs(glowOf(real) - glowOf(moved)) < 0.1) return t;
  }
  return from + MIN_SHIFT_MS;
}

/**
 * The shift after sleeping now until `to` (the next 18:00 or 06:00 of the clock as it shows now; on top of a shift
 * still running). The offset is kept within a game day (a whole day more is the same clock).
 */
export function sleepShift(real: number, to: SleepTo, prev: Shift | null): Shift {
  const before = offsetAt(real, prev);
  const shown = clockMinutes(real + before);
  const wake = WAKE_HOUR[to] * 60;
  const ahead = (((wake - shown) % 1440) + 1440) % 1440;
  const offset = (((before + ahead * GAME_MINUTE_MS) % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS;
  return { offset, until: offset === 0 ? real : rejoinAt(real, offset), slept: real };
}

/** A stored value, cleaned (anything broken counts as no shift). */
export function parseShift(raw: unknown): Shift | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!ok(r.offset) || !ok(r.until) || !ok(r.slept)) return null;
  if (r.offset < 0 || r.offset >= GAME_DAY_MS) return null;
  return { offset: r.offset, until: r.until, slept: r.slept };
}

// ───────────────────────── this browser's shift ─────────────────────────

let cached: Shift | null | undefined;
let hooked = false;
const listeners = new Set<() => void>();

function current(): Shift | null {
  if (cached === undefined) {
    cached = typeof window === 'undefined' ? null : parseShift(loadJSON<unknown>(KEYS.gameClock, null));
    if (!hooked && typeof window !== 'undefined') {
      hooked = true;
      onAppWrite((key) => {
        if (key === KEYS.gameClock || key === '*') cached = undefined;
      });
      try {
        window.addEventListener('storage', (e) => {
          if (e.key === null || e.key === STORAGE_PREFIX + KEYS.gameClock) {
            cached = undefined;
            listeners.forEach((fn) => fn());
          }
        });
      } catch {
        // no DOM
      }
    }
  }
  return cached;
}

/** This browser's shift (null: the shared clock). */
export const currentShift = (): Shift | null => current();

/** THE game's time now (or at a real time), as this machine's clock shows it. */
export function gameNow(real: number = Date.now()): number {
  return shownAt(real, current());
}

/** Sleep now until the evening or the morning; null when a sleep is not allowed yet. */
export function sleepUntil(to: SleepTo, real: number = Date.now()): Shift | null {
  const prev = current();
  if (!canSleep(prev, real)) return null;
  const next = sleepShift(real, to, prev);
  cached = next;
  saveJSON(KEYS.gameClock, next);
  listeners.forEach((fn) => fn());
  return next;
}

/** Subscribe to the shift changing (a sleep, another tab). */
export function onShift(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Tests only: a shift held in memory (null: none), nothing stored. */
export function setShiftForTests(s: Shift | null): void {
  cached = s;
}
