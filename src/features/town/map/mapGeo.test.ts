import { describe, expect, it } from 'vitest';
import { walkable } from '../../../core/town/map';
import { TOWN_WORLD, WORLD_ACTIVITIES, worldPlace } from '../../../data/townWorld';
import { districtAt, doorHeading, PLACE_ART, targetPoint, warpSpot } from './mapGeo';

const tileOf = (p: { x: number; y: number }) => ({ x: Math.floor(p.x), y: Math.floor(p.y) });

describe('districtAt', () => {
  it('names the part of town a point is in', () => {
    expect(districtAt(37.5, 33.5)?.id).toBe('plaza');
    expect(districtAt(56.5, 15.5)?.id).toBe('farm');
    expect(districtAt(21.5, 27.5)?.id).toBe('park');
    expect(districtAt(19.5, 43.5)?.id).toBe('homes');
    // the countryside round the town (2026-11-22)
    expect(districtAt(9.5, 11.5)?.id).toBe('forest');
    expect(districtAt(40.5, 3.5)?.id).toBe('fields');
    expect(districtAt(7.5, 41.5)?.id).toBe('lake');
    expect(districtAt(40.5, 64.5)?.id).toBe('hills');
    expect(districtAt(65.5, 30.5)?.id).toBe('country');
  });
  it('takes the smaller district where two overlap', () => {
    // the bus station's box sits in the corner of the main road's
    expect(districtAt(53.5, 47.5)?.id).toBe('station');
  });
  it('is null outside every district and the island', () => {
    expect(districtAt(-3, 4)).toBeNull();
    expect(districtAt(80, 80)).toBeNull();
  });
});

describe('warpSpot: where "Đến ngay" puts the player', () => {
  it('a place: on its door tile, looking out to the street', () => {
    for (const p of TOWN_WORLD.places) {
      const s = warpSpot({ kind: 'place', id: p.id }, [], 0)!;
      expect(tileOf(s)).toEqual(p.door);
      expect(s.heading).toBe(doorHeading(p));
    }
  });

  it('never on somebody: a resident on the door tile moves the player beside it', () => {
    const cafe = worldPlace('cafe')!;
    const s = warpSpot({ kind: 'place', id: 'cafe' }, [{ id: 'cafe', x: cafe.door.x + 0.5, y: cafe.door.y + 0.5 }], 0)!;
    expect(tileOf(s)).not.toEqual(cafe.door);
    expect(walkable(tileOf(s))).toBe(true);
    expect(Math.hypot(s.x - cafe.door.x - 0.5, s.y - cafe.door.y - 0.5)).toBeLessThan(2.3);
  });

  it('a resident: beside them on a free walkable tile, facing them', () => {
    const who = { id: 'friend', x: 13.5, y: 31.5 };
    const s = warpSpot({ kind: 'resident', id: 'friend' }, [who], 0)!;
    expect(walkable(tileOf(s))).toBe(true);
    const d = Math.hypot(s.x - who.x, s.y - who.y);
    expect(d).toBeGreaterThan(0.84);
    expect(d).toBeLessThan(1.5);
    const look = Math.atan2(who.y - s.y, who.x - s.x);
    expect(Math.abs(Math.atan2(Math.sin(look - s.heading), Math.cos(look - s.heading)))).toBeLessThan(1e-9);
  });

  it('a resident not in the snapshot: their place door', () => {
    const s = warpSpot({ kind: 'resident', id: 'home' }, [], 0)!;
    expect(tileOf(s)).toEqual(worldPlace('home')!.door);
  });

  it('an activity: on its spot, looking at it', () => {
    for (const [id, spot] of Object.entries(WORLD_ACTIVITIES)) {
      const s = warpSpot({ kind: 'activity', id: id as keyof typeof WORLD_ACTIVITIES }, [], 0)!;
      expect(tileOf(s)).toEqual(spot.stand);
      expect(s.heading).toBeCloseTo(Math.atan2(spot.look.y - s.y, spot.look.x - s.x), 9);
    }
  });

  it('a patch of ground: that tile, or the walkable one nearest to it (the lake shore), keeping the heading', () => {
    const s = warpSpot({ kind: 'tile', x: 24.3, y: 36.8 }, [], 1.2)!;
    expect(tileOf(s)).toEqual({ x: 24, y: 36 });
    expect(s.heading).toBe(1.2);
    const lake = warpSpot({ kind: 'tile', x: 7.5, y: 15.5 }, [], 0)!;
    expect(walkable(tileOf(lake))).toBe(true);
  });

  it('every spot it gives is walkable', () => {
    const people = TOWN_WORLD.places.map((p) => ({ id: p.id, x: p.spot.x + 0.5, y: p.spot.y + 0.5 }));
    for (const p of TOWN_WORLD.places) {
      for (const kind of ['place', 'resident'] as const) {
        const s = warpSpot(kind === 'place' ? { kind, id: p.id } : { kind, id: p.id }, people, 0);
        expect(s, `${kind} ${p.id}`).not.toBeNull();
        expect(walkable(tileOf(s!)), `${kind} ${p.id}`).toBe(true);
      }
    }
  });
});

describe('targetPoint and the art table', () => {
  it('is the door, the resident, the spot or the point', () => {
    const cafe = worldPlace('cafe')!;
    expect(targetPoint({ kind: 'place', id: 'cafe' }, [])).toEqual({ x: cafe.door.x + 0.5, y: cafe.door.y + 0.5 });
    expect(targetPoint({ kind: 'resident', id: 'cafe' }, [{ id: 'cafe', x: 3, y: 4 }])).toEqual({ x: 3, y: 4 });
    expect(targetPoint({ kind: 'tile', x: 1.5, y: 2.5 }, [])).toEqual({ x: 1.5, y: 2.5 });
    expect(targetPoint({ kind: 'activity', id: 'fish' }, [])).toEqual({ x: WORLD_ACTIVITIES.fish.stand.x + 0.5, y: WORLD_ACTIVITIES.fish.stand.y + 0.5 });
  });
  it('has a look for every place', () => {
    for (const p of TOWN_WORLD.places) expect(PLACE_ART[p.id], p.id).toBeDefined();
  });
});
