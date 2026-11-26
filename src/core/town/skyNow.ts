// The town's clock and sky at this moment (core/town/sky.ts), by today's own weather (worldStore `townToday`).

import { skyAt, type SkyNow } from './sky';
import { wetAt } from './sunPath';
import { townToday } from './worldStore';

export function skyNow(now: number = Date.now()): SkyNow {
  return skyAt(now, townToday(now).weather);
}

/** How wet the town's ground is at this moment (core/town/sunPath.ts), each past moment by its own day's weather. */
export function wetNow(now: number = Date.now()): number {
  return wetAt(now, (ms) => townToday(ms).weather);
}
