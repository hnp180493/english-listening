import { describe, expect, it } from 'vitest';
import { onLand, waterEdge } from '../../../core/town/map';
import { CITY_WORLD } from '../../../data/cityWorld';
import { DECORATION_IDS, PLACE_IDS, TOWN_WORLD, type PlaceId } from '../../../data/townWorld';
import { HELD_ACTIVITIES, OCTANTS, SPOT_SLACK, TownSim } from './sim';

// Something in the hands (a rod, a watering can, a book) only right where it is done (owner, 2026-11-28: "sao con
// emma này cầm cần câu đi linh tinh vậy, bug à?": Emma held her rod out on the paving by a lamp, the float on the stones).

/** Water within 1.5 tiles of a point (shoreDistance stops counting at 1, so the drawn land is probed). */
function nearWater(x: number, y: number): boolean {
  for (let k = 0.3; k <= 1.5; k += 0.15) for (let a = 0; a < 16; a++) if (!onLand(TOWN_WORLD, x + Math.cos((a / 16) * Math.PI * 2) * k, y + Math.sin((a / 16) * Math.PI * 2) * k)) return true;
  return false;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('the fishing spots', () => {
  it.each([
    ['the town', TOWN_WORLD],
    ['Westbay', CITY_WORLD],
  ] as const)('every one in %s looks over water within reach (the line goes into water, not onto stone)', (_n, world) => {
    for (const s of world.life?.fish ?? []) {
      const e = waterEdge(world, s.at.x + 0.5, s.at.y + 0.5, OCTANTS[s.oct]);
      expect(e, `${s.at.x},${s.at.y}`).not.toBeNull();
      // and out past the edge it is water
      const u = OCTANTS[s.oct];
      const l = Math.hypot(u.x, u.y);
      expect(onLand(world, e!.x + (u.x / l) * 1.6, e!.y + (u.y / l) * 1.6), `${s.at.x},${s.at.y}`).toBe(false);
    }
  });
});

describe('TownSim: a held activity only on its spot', () => {
  it('over game hours, with the player walking up, calling, clicking and leaving each resident, nobody holds anything off its spot', { timeout: 120000 }, () => {
    let minutes = 6 * 60;
    const sim = new TownSim(TOWN_WORLD, seeded(7), TOWN_WORLD.start, { life: true, clock: () => minutes });
    sim.setState({ built: [...PLACE_IDS], decorations: [...DECORATION_IDS], sites: [] });
    const ids = [...sim.residents.keys()] as PlaceId[];
    const bad: string[] = [];
    let held = 0;
    const check = (when: string) => {
      for (const [id, r] of sim.residents) {
        const kind = sim.doingHere(r);
        if (!kind || !HELD_ACTIVITIES.has(kind)) continue;
        held++;
        const d = r.doing!;
        if (!d.spot || Math.hypot(r.x - d.spot.x, r.y - d.spot.y) > SPOT_SLACK) bad.push(`${when}: ${id} ${kind} off its spot`);
        if (r.engaged || r.moving || r.path.length > 0) bad.push(`${when}: ${id} ${kind} while held or walking`);
        if (kind === 'fish' && !nearWater(r.x, r.y)) bad.push(`${when}: ${id} fishing away from the water`);
      }
    };
    const run = (seconds: number, when: string) => {
      for (let t = 0; t < seconds; t += 1 / 10) {
        sim.update(1 / 10);
        minutes = (minutes + 0.2) % 1440;
      }
      check(when);
    };
    for (let round = 0; round < 3; round++) {
      run(90, `round ${round} free`);
      for (const id of ids) {
        const r = sim.residents.get(id)!;
        if (r.hidden) continue;
        // walk up beside them and stand there
        sim.placePlayer({ x: r.x + 1.2, y: r.y + 0.3 }, Math.PI);
        run(3, `${id} walked up`);
        // clicked: they are held for a talk, then let go
        sim.walkToResident(id);
        run(2, `${id} clicked`);
        sim.engage(id);
        run(2, `${id} talking`);
        sim.engage(null);
        sim.release();
        // moved by the stage (put by their door, a scene aside) while doing something
        sim.jumpResident(id, { x: r.x + 3, y: r.y });
        run(2, `${id} moved`);
      }
    }
    expect(held).toBeGreaterThan(0);
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('a walk to the water given up on the way (somebody in it) is not fishing there', () => {
    let minutes = 9 * 60;
    const sim = new TownSim(TOWN_WORLD, seeded(5), TOWN_WORLD.start, { life: true, clock: () => minutes });
    sim.setState({ built: [...PLACE_IDS], decorations: [...DECORATION_IDS], sites: [] });
    const inner = sim as unknown as { begin(r: unknown, kind: string, instant: boolean): boolean; giveUp(a: unknown): void };
    let tried = 0;
    for (const r of sim.residents.values()) {
      if (r.hidden) continue;
      // from the plaza, far from any water
      sim.jumpResident(r.place.id, { x: TOWN_WORLD.start.x + 0.5, y: TOWN_WORLD.start.y + 0.5 });
      sim.endDoing(r);
      if (nearWater(r.x, r.y) || !inner.begin(r, 'fish', false) || r.path.length < 3) continue;
      tried++;
      // a few steps on, then the way is blocked: the walk is given up where they stand, far from the water
      for (let i = 0; i < 5; i++) sim.update(0.1);
      minutes += 1;
      inner.giveUp(r);
      sim.update(0.1);
      sim.update(0.1);
      const fishing = sim.doingHere(r) === 'fish';
      expect(fishing && !nearWater(r.x, r.y), `${r.place.id} fishing on dry land`).toBe(false);
      expect(r.doing?.kind === 'fish' && r.doing.arrived && !nearWater(r.x, r.y), `${r.place.id} arrived to fish on dry land`).toBe(false);
    }
    expect(tried).toBeGreaterThan(0);
  });

  it('a resident pushed off the spot of a held activity puts it away at once', () => {
    let minutes = 9 * 60;
    const sim = new TownSim(TOWN_WORLD, seeded(3), TOWN_WORLD.start, { life: true, clock: () => minutes });
    sim.setState({ built: [...PLACE_IDS], decorations: [...DECORATION_IDS], sites: [] });
    let found = false;
    for (let t = 0; t < 600 && !found; t += 0.1) {
      sim.update(0.1);
      minutes += 0.2;
      for (const r of sim.residents.values()) {
        const k = sim.doingHere(r);
        if (!k || !HELD_ACTIVITIES.has(k)) continue;
        found = true;
        // nudged two tiles off by something else, the activity kept on paper
        r.x += 2;
        expect(sim.doingHere(r)).toBeNull();
        sim.update(0.1);
        expect(r.doing === null || !HELD_ACTIVITIES.has(r.doing.kind) || !r.doing.arrived).toBe(true);
        break;
      }
    }
    expect(found).toBe(true);
  });
});
