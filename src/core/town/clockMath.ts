// The game's clock as plain arithmetic (docs/town.md §24, §33): a day of the game is 48 real minutes, the light of an
// hour (night, the gold of dawn and dusk). No state and no imports: ./sky.ts (the clock everybody reads, through this
// machine's sleep shift: ./gameClock.ts) and ./gameClock.ts (the shift itself) both build on it.

/** A day of the game in real milliseconds (GTA V: 48 minutes). */
export const GAME_DAY_MS = 48 * 60 * 1000;
/** An hour and a minute of the game in real milliseconds (two minutes, two seconds). */
export const GAME_HOUR_MS = GAME_DAY_MS / 24;
export const GAME_MINUTE_MS = GAME_DAY_MS / (24 * 60);

/** Minutes since the game's midnight (0 … 1440) of a time on the GAME's clock (ms; no sleep shift applied here). */
export function clockMinutes(ms: number): number {
  const m = ((ms % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS;
  return (m / GAME_DAY_MS) * 24 * 60;
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
