import { describe, expect, it } from 'vitest';
import { walkable } from '../../../core/town/map';
import { CITY_WORLD } from '../../../data/cityWorld';
import { TOWN_WORLD, type ActivitySpotId, type TownWorld } from '../../../data/townWorld';
import { asideSpots, thingSeat } from './listenSpots';
import { OCTANTS } from './sim';

// A scene at a bench sits the player on THAT bench and the two overheard stand in front of it (owner, 2026-11-28:
// "ngồi ở ghế này bị teleport tới ghế khác?": the page had passed the bench of the scene before).

describe.each([
  ['the town', TOWN_WORLD],
  ['Westbay', CITY_WORLD],
] as const)('every bench of %s', (_name, world: TownWorld) => {
  // (the town's radio has the café's stool; Westbay's is heard standing)
  const benches = Object.keys(world.activities ?? {}).filter((id) => id.startsWith('thing:bench-') || (id === 'thing:radio' && world === TOWN_WORLD)) as ActivitySpotId[];

  it('has its own seat, within half a tile of the bench itself', () => {
    expect(benches.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const id of benches) {
      const box = world.activities![id].box!;
      const seat = thingSeat(world, id);
      if (!seat) bad.push(`${id}: no seat`);
      else if (Math.hypot(seat.x - box.x, seat.y - box.y) > 0.5 + 1e-9 && id !== 'thing:radio') bad.push(`${id}: seat ${seat.x},${seat.y} off ${box.x},${box.y}`);
      // and no other bench's seat is taken for it
      for (const other of benches) if (other !== id && seat && thingSeat(world, other) === seat) bad.push(`${id} shares its seat with ${other}`);
    }
    expect(bad).toEqual([]);
  });

  it('the two overheard stand in front of it, on open ground', () => {
    const bad: string[] = [];
    for (const id of benches) {
      const seat = thingSeat(world, id);
      if (!seat) continue;
      const a = asideSpots(world, seat, seat.oct, 2);
      if (!a) {
        bad.push(`${id}: nowhere to stand`);
        continue;
      }
      const o = OCTANTS[seat.oct];
      for (const s of a.spots) {
        if (!walkable({ x: Math.floor(s.x), y: Math.floor(s.y) }, world)) bad.push(`${id}: a speaker on a closed tile`);
        // in front or beside (a bench facing the water: at its sides), never behind, within a few tiles
        const ahead = (s.x - seat.x) * o.x + (s.y - seat.y) * o.y;
        if (ahead < -1e-6 || Math.hypot(s.x - seat.x, s.y - seat.y) > 4) bad.push(`${id}: a speaker behind it or far (${s.x.toFixed(1)},${s.y.toFixed(1)})`);
      }
    }
    expect(bad).toEqual([]);
  });
});
