import { describe, expect, it } from 'vitest';
import { onLand } from '../../../core/town/map';
import { CITY_WORLD } from '../../../data/cityWorld';
import { TOWN_WORLD } from '../../../data/townWorld';
import { spotFits, TownSim } from './sim';

// A street spot remembered on this browser is put back only when it is still good in the world as it is now
// (features/town/townSpot.ts, docs/town.md §7 "Moving about"): checked against the map, never trusted from storage.

const state = { built: [] as string[], sites: [] as string[], decorations: [] as string[] };

function simWith(s: { built: string[]; sites: string[]; decorations: string[] } = state): TownSim {
  const sim = new TownSim(TOWN_WORLD, () => 0.5, TOWN_WORLD.start, { life: false });
  sim.setState({ ...s, built: [...s.built], decorations: [...s.decorations], sites: [...s.sites] });
  return sim;
}

/** A point of the open street at least `far` tiles from the start. */
function farOpenSpot(world = TOWN_WORLD, far = 12): { x: number; y: number } {
  const st = world.start;
  for (let y = 2; y < world.rows.length - 2; y++)
    for (let x = 2; x < world.rows[0].length - 2; x++) {
      const p = { x: x + 0.5, y: y + 0.5 };
      if (Math.hypot(p.x - st.x, p.y - st.y) < far) continue;
      const fit = spotFits(world, p.x, p.y);
      if (fit && fit.x === p.x && fit.y === p.y && spotFits(world, p.x + 2, p.y) && spotFits(world, p.x + 1, p.y)) return p;
    }
  throw new Error('no open spot');
}

describe('spotFits: a remembered spot in the world as it is now', () => {
  const sim = simWith();
  const world = sim.world;

  it('a spot of the open street is kept where it was', () => {
    const p = farOpenSpot(world);
    expect(spotFits(world, p.x, p.y)).toEqual(p);
  });

  it('off the map, or not a number: none', () => {
    expect(spotFits(world, -3, 10)).toBeNull();
    expect(spotFits(world, 10, world.rows.length + 4)).toBeNull();
    expect(spotFits(world, Number.NaN, 10)).toBeNull();
    expect(spotFits(world, 10, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('in the drawn water: none', () => {
    let wet: { x: number; y: number } | null = null;
    for (let y = 1; y < world.rows.length - 1 && !wet; y++)
      for (let x = 1; x < world.rows[0].length - 1 && !wet; x++) if (!onLand(world, x + 0.5, y + 0.5)) wet = { x: x + 0.5, y: y + 0.5 };
    expect(wet).not.toBeNull();
    expect(spotFits(world, wet!.x, wet!.y)).toBeNull();
  });

  it('inside a house built since, or a lot that became a construction site: none (never pushed out of a building)', () => {
    const place = TOWN_WORLD.places[0];
    const mid = { x: place.x + place.w / 2, y: place.y + place.d / 2 };
    expect(spotFits(simWith({ ...state, built: [place.id] }).world, mid.x, mid.y)).toBeNull();
    expect(spotFits(simWith({ ...state, sites: [place.id] }).world, mid.x, mid.y)).toBeNull();
  });

  it('a spot from the other map: checked against this one (off the map of the town, or wherever it falls)', () => {
    // Westbay's map is the wider: a spot near its far edge is off the town's
    const cityOnly = { x: CITY_WORLD.rows[0].length - 3.5, y: 10.5 };
    expect(cityOnly.x).toBeGreaterThan(TOWN_WORLD.rows[0].length);
    expect(spotFits(TOWN_WORLD, cityOnly.x, cityOnly.y)).toBeNull();
    const c = farOpenSpot(CITY_WORLD, 6);
    expect(spotFits(CITY_WORLD, c.x, c.y)).toEqual(c);
  });
});

describe('TownSim.restorePlayer', () => {
  it('a good spot: the player stands there, facing that way, and walks on from it', () => {
    const sim = simWith();
    const p = farOpenSpot(sim.world);
    expect(sim.restorePlayer(p, 0)).toBe(true);
    expect(sim.player.x).toBeCloseTo(p.x, 5);
    expect(sim.player.y).toBeCloseTo(p.y, 5);
    expect(sim.player.yaw).toBe(0);
    sim.steer({ x: 1, y: 0 });
    for (let i = 0; i < 60; i++) sim.update(1 / 30);
    sim.steer(null);
    expect(sim.player.x - p.x).toBeGreaterThan(0.8);
  });

  it('a spot no good any more: false, and the player stays at the start', () => {
    const sim = simWith();
    const before = { x: sim.player.x, y: sim.player.y };
    expect(sim.restorePlayer({ x: -5, y: 3 }, 1)).toBe(false);
    expect({ x: sim.player.x, y: sim.player.y }).toEqual(before);
  });
});
