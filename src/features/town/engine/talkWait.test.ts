import { describe, expect, it } from 'vitest';
import { DECORATION_IDS, PLACE_IDS, TOWN_WORLD, type PlaceId } from '../../../data/townWorld';
import { TownSim } from './sim';
import { outsideSpots, outsideTalkStep, TALK_WAIT_MOST, TALK_WALK_WATCH } from './staging';

// The player never stands watching a resident walk up to a talk (owner, 2026-11-28: "tao bấm vào nhà rồi phải đợi một
// đống thời gian cho bà già đi về nhà?"): at the spot, a short walk left is waited for, a longer one ends in a dip.

describe('outsideTalkStep', () => {
  it('waits for a walk of up to TALK_WALK_WATCH seconds; a longer one, or a wait past TALK_WAIT_MOST, is a dip', () => {
    expect(outsideTalkStep(0, 0)).toBe('wait');
    expect(outsideTalkStep(TALK_WALK_WATCH, 0)).toBe('wait');
    expect(outsideTalkStep(TALK_WALK_WATCH + 0.1, 0)).toBe('dip');
    expect(outsideTalkStep(8, 0)).toBe('dip');
    expect(outsideTalkStep(Infinity, 0)).toBe('dip');
    expect(outsideTalkStep(1, TALK_WAIT_MOST + 0.01)).toBe('dip');
  });
});

describe('TownSim: a talk outside opens within a moment of the player being there', () => {
  it('every resident called from the farthest spot of their day: no more than TALK_WAIT_MOST seconds standing at the spot', { timeout: 120000 }, () => {
    const L = TOWN_WORLD.life!;
    const stands = [...L.tend, ...L.fish, ...L.read, ...L.shop].map((s) => ({ x: s.at.x + 0.5, y: s.at.y + 0.5 }));
    const slow: string[] = [];
    let dips = 0;
    let walked = 0;
    for (const id of PLACE_IDS as readonly PlaceId[]) {
      const sp = outsideSpots(TOWN_WORLD, id, id);
      if (!sp) continue;
      const sim = new TownSim(TOWN_WORLD, () => 0.5, TOWN_WORLD.start, { life: false });
      sim.setState({ built: [...PLACE_IDS], decorations: [...DECORATION_IDS], sites: [] });
      if (!sim.residents.get(id)) continue;
      // the farthest of the day's spots from where the talk happens
      const far = stands.reduce((a, b) => (Math.hypot(b.x - sp.resident.x, b.y - sp.resident.y) > Math.hypot(a.x - sp.resident.x, a.y - sp.resident.y) ? b : a));
      sim.jumpResident(id, far);
      // the player is at the spot already (the worst case: no walk of theirs to cover the resident's)
      sim.placePlayer(sp.player, 0);
      let arrived = false;
      if (!sim.gather(id, sp.resident, sp.player, () => (arrived = true))) continue;
      let waited = 0;
      let opened = -1;
      for (let i = 0; i < 400 && opened < 0; i++) {
        sim.update(0.05);
        if (!arrived) continue;
        const r = sim.residents.get(id)!;
        if (r.path.length === 0 && Math.hypot(r.x - sp.resident.x, r.y - sp.resident.y) < 0.2) {
          opened = waited;
          walked++;
        } else if (outsideTalkStep(sim.walkSecondsLeft(id), waited) === 'dip') {
          opened = waited;
          dips++;
        }
        waited += 0.05;
      }
      if (opened < 0 || opened > TALK_WAIT_MOST + 0.05) slow.push(`${id}: ${opened.toFixed(2)} s`);
    }
    expect(dips).toBeGreaterThan(0);
    expect(slow).toEqual([]);
    expect(dips + walked).toBeGreaterThan(5);
  });
});
