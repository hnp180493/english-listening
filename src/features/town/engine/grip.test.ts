// Wet roads in the sim (core/town/skyRules.ts rideGrip, docs/town.md §33): a vehicle ridden stops later and turns
// slower when the grip is down; walking is never affected.
import { describe, expect, it } from 'vitest';
import type { TownWorld } from '../../../data/townWorld';
import { rideGrip } from '../../../core/town/skyRules';
import { TownSim } from './sim';

const ROWS = ['##############################', ...Array.from({ length: 12 }, () => '#............................#'), '##############################'];
const WORLD: TownWorld = { size: ROWS[0].length, rows: ROWS, places: [], props: [], decorations: {} as TownWorld['decorations'], plaza: { x: 1, y: 1, r: 0 }, start: { x: 2, y: 6 } };

let s = 7;
const rnd = () => {
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
};

function sim(wet: number, ride: boolean): TownSim {
  const t = new TownSim(WORLD, rnd, { x: 2, y: 6 });
  if (ride) t.setRideSpeed(5);
  t.setGrip(rideGrip(wet));
  t.placePlayer({ x: 2.5, y: 6.5 }, 0);
  return t;
}

/** Ride east for a second, let go: how far it goes after letting go. */
function stopDistance(t: TownSim): number {
  t.steer({ x: 1, y: 0 });
  for (let k = 0; k < 60; k++) t.update(1 / 60);
  const x0 = t.player.x;
  t.steer(null);
  for (let k = 0; k < 120; k++) t.update(1 / 60);
  return t.player.x - x0;
}

/** Ride east, then steer south: the heading turned after a tenth of a second. */
function turnIn(t: TownSim): number {
  t.steer({ x: 1, y: 0 });
  for (let k = 0; k < 30; k++) t.update(1 / 60);
  t.steer({ x: 0, y: 1 });
  for (let k = 0; k < 6; k++) t.update(1 / 60);
  return Math.abs(t.player.yaw ?? 0);
}

describe('wet roads in the sim', () => {
  it('a vehicle ridden stops later on a wet road', () => {
    const dry = stopDistance(sim(0, true));
    const wet = stopDistance(sim(1, true));
    expect(wet).toBeGreaterThan(dry + 0.5);
  });

  it('a vehicle ridden turns slower on a wet road', () => {
    const dry = turnIn(sim(0, true));
    const wet = turnIn(sim(1, true));
    expect(wet).toBeLessThan(dry);
  });

  it('walking is the same whatever the road', () => {
    expect(stopDistance(sim(1, false))).toBeCloseTo(stopDistance(sim(0, false)), 5);
    expect(turnIn(sim(1, false))).toBeCloseTo(turnIn(sim(0, false)), 5);
  });
});
