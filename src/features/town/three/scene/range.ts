// The mountains round the island's far sides (docs/town.md §7 "The coast and the mountains"): their height at any
// point of the tile grid outside the island, shared by the 3D backdrop (three/scene/backdrop.ts) and the map
// (map/drawMap.ts). Pure: no three.js here, so the map does not load it.

import { valueNoise } from './coords';

/** How far the mountains reach out from the island's far sides (tiles). */
export const RANGE_DEPTH = 32;
/** The falls: where they come over the cliff (tiles out from the west side) and along which row they fall. */
export const FALLS_Z = 41;
export const FALLS_TOP = 5.2;
export const FALLS_OUT = 5;

/** The ravine's floor below the falls: under the town's water (terrain.ts POND_BED − 0.1). */
const BASIN = -0.44;

export const smooth = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * How a world's range is cut (TownWorld.range): where its passes are (the tile along the north side, x, and along the
 * west side, z), whether the falls come down its west side, and whether a road runs on through each pass (then the
 * pass is a level cutting right through the range: the way a bus leaves by).
 */
export interface RangeShape {
  north: readonly number[];
  west: readonly number[];
  falls: boolean;
  roads: boolean;
}

/** The town's: the passes the farm lane (north, x 53) and the shore walk (west, z 32) leave the map by, and the falls. */
export const TOWN_RANGE: RangeShape = { north: [53.5], west: [32.5], falls: true, roads: false };

/** A road through a pass climbs this much a tile, from the map's edge (a gentle hill road). */
export const ROAD_CLIMB = 0.045;
/** Half the width of the level floor of a road's cutting, and where its banks have risen back to the mountain. */
export const CUT_FLOOR = 1.5;
export const CUT_BANK = 5;

/** Ridged noise in [0, 1]: sharp crests (the peaks and ridges of a range). */
function ridged(x: number, z: number, seed: number): number {
  let sum = 0;
  let amp = 0.55;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    const n = 1 - Math.abs(valueNoise(x * f, z * f, seed + o) * 2 - 1);
    sum += n * n * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/**
 * The mountains' height (tile edges) at a point of the grid outside the island: 0 at the island's far edges, up
 * through foothills to peaks of about 9 to 17 some 10 to 22 tiles out, down into the sea beyond; lower towards the
 * near ends (they fall to the coast), two passes, the cliff and ravine of the falls.
 */
export function mountainHeight(x: number, z: number, size: number, shape: RangeShape = TOWN_RANGE): number {
  if (x >= 0 && z >= 0) return 0;
  const d = Math.max(-x, -z);
  const u = x < 0 && z < 0 ? Math.min(-x, -z) : x < 0 ? z : x;
  // the range: up over the first 11 tiles, high till 22, down into the sea by 31
  const rise = smooth(0.6, 11, d);
  const fall = 1 - smooth(21, RANGE_DEPTH - 1, d);
  // lower and broken up towards the near ends, where the range comes down to the coast
  const end = 1 - smooth(size - 18, size + 6, u);
  const peaks = 3.2 + ridged(x * 0.062, z * 0.062, 41) * 15.5 + valueNoise(x * 0.21, z * 0.21, 43) * 1.4;
  let h = peaks * rise * fall * (0.25 + 0.75 * end) - (1 - fall) * 2.5 - (1 - end) * smooth(4, 20, d) * 3;
  // foothills: gentle bumps close to the island
  h += (valueNoise(x * 0.35, z * 0.35, 44) - 0.45) * 1.2 * smooth(0.5, 4, d) * (1 - smooth(6, 12, d));
  // the passes: a dip in the range, or (a road) a level cutting right through it, climbing gently from the map's edge
  const pass = (along: number, at: number) => Math.exp(-((along - at) ** 2) / 22) * (1 - smooth(10, 20, d));
  const cut = (along: number, at: number) => {
    const k = 1 - smooth(CUT_FLOOR, CUT_BANK, Math.abs(along - at));
    if (k > 0) h = h * (1 - k) + Math.min(h, d * ROAD_CLIMB) * k;
  };
  const through = (along: number, at: number) => {
    if (shape.roads) cut(along, at);
    else h *= 1 - 0.8 * pass(along, at);
  };
  if (z < 0 && x >= 0) for (const at of shape.north) through(x, at);
  if (x < 0 && z >= 0) for (const at of shape.west) through(z, at);
  // the falls (west, row 41): a ravine whose floor is level at the top of the falls, a cliff, a pool at its foot
  if (shape.falls && x < 0 && z >= 0) {
    const across = Math.abs(z - FALLS_Z);
    if (across < 4.5) {
      const ravine = 1 - smooth(1.2, 4.5, across);
      if (d > FALLS_OUT) h = h * (1 - ravine) + Math.min(h, FALLS_TOP - 0.05 + Math.max(0, d - 12) * 0.3) * ravine;
      else h = h * (1 - ravine) + Math.min(h, BASIN) * ravine;
    }
  }
  return h;
}

