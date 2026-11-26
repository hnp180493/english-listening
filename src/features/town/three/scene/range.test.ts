// The range behind a world's far sides (./range): the town's stays as it was, and a world whose passes carry roads
// (the city, data/cityWorld.ts: "đường đâu mà xe bus chạy", owner 2026-11-25) has a level way right through it.
import { describe, expect, it } from 'vitest';
import { CITY_WORLD } from '../../../../data/cityWorld';
import { CUT_FLOOR, EDGE_LIFT, FALLS_Z, mountainHeight, RANGE_DEPTH, ROAD_CLIMB, TOWN_RANGE } from './range';

describe('the mountains', () => {
  it('never lie in the island\'s plane at its edge (the flicker of 2026-11-26)', () => {
    for (const shape of [TOWN_RANGE, CITY_WORLD.range!]) {
      for (let along = 0; along < 72; along += 0.5) {
        for (const d of [0.01, 0.2, 0.5, 1, 1.5]) {
          // (the falls' stream runs out of the range into the island's lake there: water, on purpose)
          if (!(shape.falls && Math.abs(along - FALLS_Z) < 4.5)) expect(mountainHeight(-d, along, 72, shape), `west ${along} ${d}`).toBeGreaterThanOrEqual(EDGE_LIFT - 1e-9);
          expect(mountainHeight(along, -d, 72, shape), `north ${along} ${d}`).toBeGreaterThanOrEqual(EDGE_LIFT - 1e-9);
        }
      }
    }
  });

  it("the town's range is the default: its two passes dip, its falls cut a ravine", () => {
    for (const [x, z] of [[-8, 10], [20, -9], [-12, 41], [53.5, -8], [-9, 32.5]] as const) expect(mountainHeight(x, z, 84)).toBe(mountainHeight(x, z, 84, TOWN_RANGE));
    expect(mountainHeight(53.5, -12, 84)).toBeLessThan(mountainHeight(40, -12, 84));
  });

  it('every street of the city that reaches a far edge runs on through the range on a gentle, level floor', () => {
    const shape = CITY_WORLD.range!;
    const S = CITY_WORLD.size;
    expect(shape.roads).toBe(true);
    expect(shape.falls).toBe(false);
    // the passes are where the streets are: a street's two tiles meet at the pass's line
    for (const at of shape.west) for (const y of [at - 1, at]) expect(CITY_WORLD.rows[y][0], `row ${y} at the west edge`).toBe('=');
    for (const at of shape.north) for (const x of [at - 1, at]) expect(CITY_WORLD.rows[0][x], `column ${x} at the north edge`).toBe('=');
    const check = (h: (d: number, off: number) => number, name: string) => {
      let high = 0;
      for (let d = 0.5; d < RANGE_DEPTH - 3; d += 0.5) {
        // the floor: the road's own height, the same across its width
        for (const off of [-1, 0, 1]) expect(h(d, off), `${name} ${d} out, ${off} across`).toBeLessThanOrEqual(EDGE_LIFT + d * ROAD_CLIMB + 1e-9);
        high = Math.max(high, h(d, CUT_FLOOR + 9), h(d, -CUT_FLOOR - 9));
      }
      // and it is a cutting: the range stands high beside it
      expect(high, `${name}: mountains beside the road`).toBeGreaterThan(3);
    };
    for (const at of shape.west) check((d, off) => mountainHeight(-d, at + off, S, shape), `west pass ${at}`);
    for (const at of shape.north) check((d, off) => mountainHeight(at + off, -d, S, shape), `north pass ${at}`);
  });
});
