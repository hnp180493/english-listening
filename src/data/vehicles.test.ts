import { describe, expect, it } from 'vitest';
import { walkable } from '../core/town/map';
import { walkWorld } from '../core/town/colliders';
import { CITY_DECOR_ON, CITY_PLACE_IDS, CITY_WORLD } from './cityWorld';
import { DECORATION_IDS, PLACE_IDS, TOWN_WORLD, type TownWorld } from './townWorld';

// Vehicles parked about (owner, 2026-11-26): on open ground, clear of doors, the spots people use and each other.
function check(name: string, world: TownWorld, built: string[], decorations: string[]) {
  describe(`${name}'s vehicles`, () => {
    const W = walkWorld(world, { built, decorations });
    it('stand on walkable ground, a tile clear of every door, spot, seat and chat', () => {
      const vs = world.vehicles ?? [];
      expect(vs.length).toBeGreaterThanOrEqual(4);
      const busy: { x: number; y: number; what: string }[] = [];
      for (const p of world.places) busy.push({ ...p.door, what: `door ${p.id}` }, { ...p.spot, what: `spot ${p.id}` });
      for (const [id, a] of Object.entries(world.activities ?? {})) busy.push({ ...a.stand, what: id });
      for (const s of world.life?.seats ?? []) busy.push({ ...s.from, what: 'seat' });
      for (const c of world.life?.chats ?? []) for (const t of c) busy.push({ ...t, what: 'chat' });
      vs.forEach((v, i) => {
        expect(walkable(v.at, W), `${v.kind} ${v.at.x},${v.at.y}`).toBe(true);
        for (const b of busy) expect(Math.max(Math.abs(b.x - v.at.x), Math.abs(b.y - v.at.y)), `${v.kind} ${v.at.x},${v.at.y} by ${b.what}`).toBeGreaterThan(1);
        vs.forEach((o, j) => j > i && expect(Math.hypot(o.at.x - v.at.x, o.at.y - v.at.y)).toBeGreaterThan(2));
      });
    });
  });
}
check('the town', TOWN_WORLD, [...PLACE_IDS], [...DECORATION_IDS]);
check('Westbay', CITY_WORLD, ['station', ...CITY_PLACE_IDS], [...CITY_DECOR_ON]);
