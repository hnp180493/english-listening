// The town's clock and sky at this moment (core/town/sky.ts), by today's own weather (worldStore `townToday`).

import { skyAt, type SkyNow } from './sky';
import { townToday } from './worldStore';

export function skyNow(now: number = Date.now()): SkyNow {
  return skyAt(now, townToday(now).weather);
}
