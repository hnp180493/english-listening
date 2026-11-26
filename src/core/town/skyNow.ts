// The town's clock and sky at this moment (core/town/sky.ts), by today's own weather (worldStore `townToday`).

import { skyAt, type SkyNow } from './sky';
import { wetAt } from './sunPath';
import { townToday } from './worldStore';

/**
 * Dev only: a sky and a wetness held for a picture (the engine's debugSky sets it), so what reads the sky as a RULE
 * (core/town/skyRules.ts: slippery roads, the radio breaking up, the HUD's words) shows the held weather too. Null = the
 * real one.
 */
let held: { sky: SkyNow; wet: number } | null = null;
export function holdSky(h: { sky: SkyNow; wet: number } | null): void {
  held = h;
  cache.at = -Infinity;
}

export function skyNow(now: number = Date.now()): SkyNow {
  if (held) return held.sky;
  return skyAt(now, townToday(now).weather);
}

/** How wet the town's ground is at this moment (core/town/sunPath.ts), each past moment by its own day's weather. */
export function wetNow(now: number = Date.now()): number {
  if (held) return held.wet;
  return wetAt(now, (ms) => townToday(ms).weather);
}

const cache = { at: -Infinity, wet: 0 };

/** wetNow worked out at most every two seconds (for what reads it every frame: the traffic, the rides). */
export function wetSoon(now: number = Date.now()): number {
  if (held) return held.wet;
  if (now - cache.at > 2000 || now < cache.at) {
    cache.at = now;
    cache.wet = wetNow(now);
  }
  return cache.wet;
}
