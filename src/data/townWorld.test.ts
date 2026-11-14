import { describe, expect, it } from 'vitest';
import { findPath, walkable } from '../core/town/map';
import {
  DECORATION_IDS,
  footprintTiles,
  groundAt,
  PLACE_IDS,
  TOWN_WORLD,
  WORLD_DECORATIONS,
  WORLD_PLACES,
  WORLD_PROPS,
  WORLD_ROWS,
  worldFountain,
  worldPlace,
  worldTrees,
  type DecorationId,
  type PlaceId,
  type Tile,
} from './townWorld';

const ALL_PLACES: PlaceId[] = ['square', 'cafe', 'friend', 'home', 'shop', 'office', 'school', 'station', 'clinic', 'cinema', 'phone', 'park', 'board'];
const ALL_DECORATIONS: DecorationId[] = ['lamps1', 'flowers', 'benches', 'blossom', 'lamps2', 'lights', 'lilies', 'stall', 'fountain', 'balloons', 'flags', 'cat'];
const key = (t: Tile) => `${t.x},${t.y}`;

describe('the ground', () => {
  it('is a square grid of known characters', () => {
    expect(WORLD_ROWS).toHaveLength(TOWN_WORLD.size);
    for (const row of WORLD_ROWS) {
      expect(row).toHaveLength(TOWN_WORLD.size);
      expect(row).toMatch(/^[.=o~TtF]+$/);
    }
  });

  it('has a round plaza around one fountain, a pond, paths and trees', () => {
    const f = worldFountain();
    expect(f).toEqual({ x: 10, y: 10 });
    expect(groundAt(f!)).toBe('plaza');
    const { plaza } = TOWN_WORLD;
    let plazaTiles = 0;
    let water = 0;
    for (let y = 0; y < TOWN_WORLD.size; y++) {
      for (let x = 0; x < TOWN_WORLD.size; x++) {
        const g = groundAt({ x, y });
        if (g === 'water') water++;
        if (g !== 'plaza') continue;
        plazaTiles++;
        // every cobbled tile has its centre inside the drawn circle
        expect(Math.hypot(x + 0.5 - plaza.x, y + 0.5 - plaza.y)).toBeLessThanOrEqual(plaza.r);
      }
    }
    expect(plazaTiles).toBeGreaterThan(30);
    expect(water).toBeGreaterThanOrEqual(5);
    expect(worldTrees().length).toBeGreaterThan(30);
    expect(new Set(worldTrees().map((t) => t.kind))).toEqual(new Set(['round', 'pine']));
    expect(groundAt({ x: -1, y: 0 })).toBeNull();
    expect(groundAt({ x: 0, y: 21 })).toBeNull();
    expect(groundAt({ x: 0.5, y: 1 })).toBeNull();
  });

  it('four streets leave the plaza', () => {
    for (const t of [{ x: 6, y: 10 }, { x: 14, y: 10 }, { x: 10, y: 6 }, { x: 10, y: 14 }]) expect(groundAt(t)).toBe('path');
  });
});

describe('places', () => {
  it('every place id has a footprint, a door and a resident spot', () => {
    expect([...PLACE_IDS].sort()).toEqual([...ALL_PLACES].sort());
    expect(new Set(PLACE_IDS).size).toBe(13);
    for (const id of ALL_PLACES) {
      const p = worldPlace(id)!;
      expect(p, id).toBeDefined();
      expect(p.name.length, id).toBeGreaterThan(0);
      expect(p.resident.length, id).toBeGreaterThan(0);
      expect([`${p.w}x${p.d}`], id).toEqual(expect.arrayContaining([expect.stringMatching(/^(2x2|3x2|2x3)$/)]));
      expect(footprintTiles(p)).toHaveLength(p.w * p.d);
    }
    expect(new Set(WORLD_PLACES.map((p) => p.resident)).size).toBe(13);
    expect(worldPlace('nowhere')).toBeUndefined();
  });

  it('the door is on a face the viewer sees, right in front of the footprint', () => {
    for (const p of WORLD_PLACES) {
      if (p.face === 'x') {
        expect(p.door.x, p.id).toBe(p.x + p.w);
        expect(p.door.y, p.id).toBeGreaterThanOrEqual(p.y);
        expect(p.door.y, p.id).toBeLessThan(p.y + p.d);
      } else {
        expect(p.door.y, p.id).toBe(p.y + p.d);
        expect(p.door.x, p.id).toBeGreaterThanOrEqual(p.x);
        expect(p.door.x, p.id).toBeLessThan(p.x + p.w);
      }
    }
  });

  it('doors and resident spots are walkable and reachable from the start', () => {
    const { start } = TOWN_WORLD;
    expect(walkable(start)).toBe(true);
    for (const p of WORLD_PLACES) {
      for (const [what, t] of [['door', p.door], ['spot', p.spot]] as const) {
        expect(walkable(t), `${p.id} ${what}`).toBe(true);
        expect(findPath(start, t).length, `${p.id} ${what}`).toBeGreaterThan(0);
      }
      // the resident waits a short walk from the door
      expect(Math.max(Math.abs(p.spot.x - p.door.x), Math.abs(p.spot.y - p.door.y)), p.id).toBeLessThanOrEqual(2);
    }
  });

  it('no pocket: every walkable tile can be reached from the start', () => {
    const { start, size } = TOWN_WORLD;
    const seen = new Set<string>([key(start)]);
    const queue: Tile[] = [start];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: at.x + dx, y: at.y + dy };
        if (!walkable(next) || seen.has(key(next))) continue;
        seen.add(key(next));
        queue.push(next);
      }
    }
    const cut: string[] = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (walkable({ x, y }) && !seen.has(key({ x, y }))) cut.push(key({ x, y }));
    expect(cut).toEqual([]);
  });

  it('a resident is never hidden right behind a house, a lot or a tree', () => {
    // the tile one step towards the viewer (x+1, y+1) holds nothing tall
    const tall = new Set<string>();
    for (const p of WORLD_PLACES) footprintTiles(p).forEach((t) => tall.add(key(t)));
    for (const t of worldTrees()) tall.add(key(t));
    for (const s of WORLD_DECORATIONS.blossom) tall.add(key(s));
    for (const p of WORLD_PLACES) {
      expect(tall.has(key({ x: p.spot.x + 1, y: p.spot.y + 1 })), p.id).toBe(false);
      expect(tall.has(key({ x: p.spot.x + 2, y: p.spot.y + 2 })), p.id).toBe(false);
    }
  });
});

describe('nothing overlaps', () => {
  it('footprints, trees, props, the fountain, solid decorations, doors and residents each have their own tile', () => {
    const used = new Map<string, string>();
    const claim = (t: Tile, what: string) => {
      expect(Number.isInteger(t.x) && Number.isInteger(t.y), what).toBe(true);
      expect(t.x >= 0 && t.y >= 0 && t.x < TOWN_WORLD.size && t.y < TOWN_WORLD.size, what).toBe(true);
      expect(used.get(key(t)), `${what} on ${key(t)}`).toBeUndefined();
      used.set(key(t), what);
    };
    for (const p of WORLD_PLACES) footprintTiles(p).forEach((t) => claim(t, `place ${p.id}`));
    for (const t of worldTrees()) claim(t, 'tree');
    claim(worldFountain()!, 'fountain');
    for (const prop of WORLD_PROPS) prop.tiles.forEach((t) => claim(t, `prop ${prop.kind}`));
    for (const id of DECORATION_IDS) {
      // the bigger fountain replaces the fountain on its own tile
      if (id === 'fountain') continue;
      for (const s of WORLD_DECORATIONS[id]) if (s.solid) claim(s, `decoration ${id}`);
    }
    for (const p of WORLD_PLACES) {
      claim(p.door, `door ${p.id}`);
      claim(p.spot, `resident ${p.id}`);
    }
    claim(TOWN_WORLD.start, 'start');
  });

  it('buildings, lots and solid things stand on dry land; water is only water', () => {
    for (const p of WORLD_PLACES) for (const t of footprintTiles(p)) expect(groundAt(t), p.id).not.toBe('water');
    for (const id of DECORATION_IDS) {
      for (const s of WORLD_DECORATIONS[id]) if (s.solid) expect(groundAt(s), id).not.toBe('water');
    }
    for (const t of worldTrees()) expect(groundAt(t)).toBe('grass');
  });
});

describe('decorations', () => {
  it('every decoration id has at least one spot inside the map', () => {
    expect([...DECORATION_IDS].sort()).toEqual([...ALL_DECORATIONS].sort());
    for (const id of ALL_DECORATIONS) {
      const spots = WORLD_DECORATIONS[id];
      expect(spots.length, id).toBeGreaterThan(0);
      for (const s of spots) {
        expect(s.x >= 0 && s.y >= 0 && s.x < TOWN_WORLD.size && s.y < TOWN_WORLD.size, id).toBe(true);
      }
    }
  });

  it('the bigger fountain is the fountain, lilies float on the pond, benches look somewhere', () => {
    expect(WORLD_DECORATIONS.fountain).toEqual([{ ...worldFountain()!, solid: true }]);
    for (const s of WORLD_DECORATIONS.lilies) expect(groundAt({ x: Math.floor(s.x), y: Math.floor(s.y) })).toBe('water');
    for (const s of WORLD_DECORATIONS.benches) expect(s.dir).toBeDefined();
    // loose decorations never block a tile
    for (const id of ['lilies', 'balloons', 'cat'] as const) for (const s of WORLD_DECORATIONS[id]) expect(s.solid).toBe(false);
  });
});
