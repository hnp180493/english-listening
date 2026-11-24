import { describe, expect, it } from 'vitest';
import { walkWorld } from '../core/town/colliders';
import { canStep, findPath, NEIGHBOURS, walkable } from '../core/town/map';
import {
  DECORATION_IDS,
  footprintTiles,
  groundAt,
  groundHeight,
  PLACE_IDS,
  TOWN_WORLD,
  WORLD_ACTIVITIES,
  WORLD_DECORATIONS,
  WORLD_DISTRICTS,
  WORLD_LIFE,
  WORLD_PLACES,
  WORLD_PROPS,
  WORLD_ROWS,
  WORLD_SCENERY,
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
const { size, start } = TOWN_WORLD;

/** Every tile a walk from the start reaches, four ways (the strictest: no diagonal needed). */
function reachable(): Set<string> {
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
  return seen;
}
const REACHED = reachable();

/** How far a walk is over the ground, tiles (a diagonal step is √2). */
function walkLength(from: Tile, path: readonly Tile[]): number {
  let at = from;
  let sum = 0;
  for (const t of path) {
    sum += t.x !== at.x && t.y !== at.y ? Math.SQRT2 : 1;
    at = t;
  }
  return sum;
}

describe('the ground', () => {
  it('is a square grid of known characters, 84 tiles a side', () => {
    expect(size).toBe(84);
    expect(WORLD_ROWS).toHaveLength(size);
    for (const row of WORLD_ROWS) {
      expect(row).toHaveLength(size);
      expect(row).toMatch(/^[.=o~TtF:p]+$/);
    }
  });

  it('has a round plaza around one fountain, a lake, paths and plenty of trees', () => {
    const f = worldFountain();
    expect(f).toEqual({ x: 37, y: 33 });
    expect(groundAt(f!)).toBe('plaza');
    const { plaza } = TOWN_WORLD;
    let plazaTiles = 0;
    let water = 0;
    let path = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const g = groundAt({ x, y });
        if (g === 'water') water++;
        if (g === 'path') path++;
        if (g !== 'plaza') continue;
        plazaTiles++;
        // every cobbled tile has its centre inside the drawn circle
        expect(Math.hypot(x + 0.5 - plaza.x, y + 0.5 - plaza.y)).toBeLessThanOrEqual(plaza.r);
      }
    }
    expect(plazaTiles).toBeGreaterThan(60);
    expect(water).toBeGreaterThanOrEqual(40);
    expect(path).toBeGreaterThan(200);
    expect(worldTrees().length).toBeGreaterThan(200);
    expect(new Set(worldTrees().map((t) => t.kind))).toEqual(new Set(['round', 'pine', 'palm']));
    expect(groundAt({ x: -1, y: 0 })).toBeNull();
    expect(groundAt({ x: 0, y: size })).toBeNull();
    expect(groundAt({ x: 0.5, y: 1 })).toBeNull();
  });

  it('five streets leave the plaza, none of them one straight line', () => {
    const exits = [
      { x: 37, y: 28 }, // the market street (north)
      { x: 32, y: 33 }, // to the lake (west)
      { x: 42, y: 33 }, // the east lane
      { x: 41, y: 37 }, // the main road (south-east)
      { x: 34, y: 37 }, // the residential lane (south-west)
    ];
    for (const t of exits) {
      expect(groundAt(t), key(t)).toBe('path');
      expect(NEIGHBOURS.some((d) => groundAt({ x: t.x + d.x, y: t.y + d.y }) === 'plaza'), key(t)).toBe(true);
    }
    // the main road bends: its tiles do not all lie on one diagonal or one row
    const road = WORLD_ROWS.flatMap((row, y) => [...row].map((c, x) => ({ c, x, y }))).filter((t) => t.c === '=' && t.x >= 41 && t.y >= 37 && t.x < 60 && t.y < 56);
    expect(new Set(road.map((t) => t.x - t.y)).size).toBeGreaterThan(4);
  });

  it('three lakes (the park lake, the big lake, the pond), each round: its middle on the water, ducks on it; the sea along the coast', () => {
    const water: Tile[] = [];
    WORLD_ROWS.forEach((row, y) => [...row].forEach((c, x) => c === '~' && water.push({ x, y })));
    const left = new Set(water.map(key));
    const bodies: Tile[][] = [];
    for (const t of water) {
      if (!left.has(key(t))) continue;
      left.delete(key(t));
      const body = [t];
      for (let i = 0; i < body.length; i++) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = { x: body[i].x + dx, y: body[i].y + dy };
          if (left.has(key(n))) {
            left.delete(key(n));
            body.push(n);
          }
        }
      }
      bodies.push(body);
    }
    // the sea: what reaches the map's near edges (the coast, x or y 72 and on); the lakes: the rest
    const sea = bodies.filter((b) => b.some((t) => t.x === size - 1 || t.y === size - 1));
    for (const b of sea) for (const t of b) expect(t.x >= 72 || t.y >= 72, key(t)).toBe(true);
    const lakes = bodies.filter((b) => !sea.includes(b));
    expect(lakes).toHaveLength(3);
    // the stream that brings the falls (outside the map, beyond its west edge) into the big lake
    const stream = (t: Tile) => t.x <= 2 && (t.y === 40 || t.y === 41);
    for (const body of lakes) {
      expect(body.length).toBeGreaterThanOrEqual(20);
      const mid = { x: Math.floor(body.reduce((s, t) => s + t.x + 0.5, 0) / body.length), y: Math.floor(body.reduce((s, t) => s + t.y + 0.5, 0) / body.length) };
      expect(groundAt(mid), key(mid)).toBe('water');
      // no water at the island's rim (its frame of grass): two tiles clear of the edge
      for (const t of body) if (!stream(t)) expect(Math.min(t.x, t.y, size - 1 - t.x, size - 1 - t.y), key(t)).toBeGreaterThanOrEqual(3);
      const ducks = WORLD_SCENERY.filter((s) => s.kind === 'duck' && body.some((t) => t.x === Math.floor(s.at!.x) && t.y === Math.floor(s.at!.y)));
      expect(ducks.length, key(body[0])).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(WORLD_SCENERY.filter((s) => s.kind === 'hill').map((h) => [`${h.at!.x},${h.at!.y}`, h] as const))('the hill at %s rises smoothly to its top and the rest of the town is flat', (_, hill) => {
    const top = { x: hill.at!.x + 0.5, y: hill.at!.y + 0.5 };
    expect(groundHeight(top.x, top.y)).toBeCloseTo(hill.h!);
    // a level top (the viewpoint's benches), then down
    expect(groundHeight(top.x + 1, top.y)).toBeCloseTo(hill.h!);
    expect(groundHeight(top.x + 2, top.y)).toBeLessThan(hill.h!);
    expect(groundHeight(top.x + 3, top.y)).toBeLessThan(groundHeight(top.x + 2, top.y));
    // never steeper than about 32°: people walk up it
    for (let d = 0; d < hill.r!; d += 0.05) expect(groundHeight(top.x + d, top.y) - groundHeight(top.x + d + 0.05, top.y)).toBeLessThan(0.05 * 0.62);
    expect(groundHeight(top.x + hill.r!, top.y)).toBe(0);
    expect(groundHeight(TOWN_WORLD.plaza.x, TOWN_WORLD.plaza.y)).toBe(0);
    expect(groundHeight(1, 1, { ...TOWN_WORLD, scenery: undefined })).toBe(0);
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

  it('every door opens onto a street or the plaza (on it or right beside it)', () => {
    const paved = (t: Tile) => groundAt(t) === 'path' || groundAt(t) === 'plaza';
    for (const p of WORLD_PLACES) {
      expect(paved(p.door) || NEIGHBOURS.some((d) => d.x === 0 || d.y === 0 ? paved({ x: p.door.x + d.x, y: p.door.y + d.y }) : false), p.id).toBe(true);
    }
  });

  it('doors and resident spots are walkable and reachable from the start', () => {
    expect(walkable(start)).toBe(true);
    expect(groundAt(start)).toBe('plaza');
    for (const p of WORLD_PLACES) {
      for (const [what, t] of [['door', p.door], ['spot', p.spot]] as const) {
        expect(walkable(t), `${p.id} ${what}`).toBe(true);
        expect(findPath(start, t).length, `${p.id} ${what}`).toBeGreaterThan(0);
      }
      // the resident waits a short walk from the door
      expect(Math.max(Math.abs(p.spot.x - p.door.x), Math.abs(p.spot.y - p.door.y)), p.id).toBeLessThanOrEqual(2);
    }
  });

  it('the farthest door is a walk of under 25 s at the player\'s pace (sim.ts PLAYER_SPEED 2.2 tiles a second)', () => {
    let farthest = 0;
    for (const p of WORLD_PLACES) farthest = Math.max(farthest, walkLength(start, findPath(start, p.door)));
    expect(farthest).toBeGreaterThan(20);
    expect(farthest).toBeLessThan(2.2 * 25);
  });

  it('no pocket: every walkable tile can be reached from the start', () => {
    const cut: string[] = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (walkable({ x, y }) && !REACHED.has(key({ x, y }))) cut.push(key({ x, y }));
    expect(cut).toEqual([]);
  });

  it('a resident is never hidden right behind a house, a lot or a tree', () => {
    // the tile one step towards the viewer (x+1, y+1) holds nothing tall
    const tall = new Set<string>();
    for (const p of WORLD_PLACES) footprintTiles(p).forEach((t) => tall.add(key(t)));
    for (const t of worldTrees()) tall.add(key(t));
    for (const s of WORLD_DECORATIONS.blossom) tall.add(key(s));
    for (const s of WORLD_SCENERY) if (s.kind === 'barn') s.tiles.forEach((t) => tall.add(key(t)));
    for (const p of WORLD_PLACES) {
      expect(tall.has(key({ x: p.spot.x + 1, y: p.spot.y + 1 })), p.id).toBe(false);
      expect(tall.has(key({ x: p.spot.x + 2, y: p.spot.y + 2 })), p.id).toBe(false);
    }
  });
});

describe('districts', () => {
  it('eighteen parts of town, each named, inside the map, with a reachable street to arrive on', () => {
    expect(WORLD_DISTRICTS).toHaveLength(18);
    expect(new Set(WORLD_DISTRICTS.map((d) => d.id)).size).toBe(18);
    expect(TOWN_WORLD.districts).toBe(WORLD_DISTRICTS);
    for (const d of WORLD_DISTRICTS) {
      expect(d.name.length, d.id).toBeGreaterThan(0);
      expect(d.x >= 0 && d.y >= 0 && d.x + d.w <= size && d.y + d.d <= size, d.id).toBe(true);
      const a = d.arrive;
      expect(a.x >= d.x && a.x < d.x + d.w && a.y >= d.y && a.y < d.y + d.d, d.id).toBe(true);
      expect(walkable(a), d.id).toBe(true);
      expect(REACHED.has(key(a)), d.id).toBe(true);
      expect(['path', 'plaza']).toContain(groundAt(a));
    }
  });

  it('every place stands in a district', () => {
    for (const p of WORLD_PLACES) {
      expect(WORLD_DISTRICTS.some((d) => p.x >= d.x && p.y >= d.y && p.x + p.w <= d.x + d.w && p.y + p.d <= d.y + d.d), p.id).toBe(true);
    }
  });
});

describe('everyday life has room all over town', () => {
  it('every activity spot, seat, chat spot and place to stand is reachable from the start', () => {
    const L = WORLD_LIFE;
    const tiles: [string, Tile][] = [
      ...Object.entries(WORLD_ACTIVITIES).map(([id, a]) => [`activity ${id}`, a.stand] as [string, Tile]),
      ...L.seats.map((s) => ['seat', s.from] as [string, Tile]),
      ...L.chats.flat().map((t) => ['chat', t] as [string, Tile]),
      ...[...L.tend, ...L.fish, ...L.read, ...L.shop].map((s) => ['stand', s.at] as [string, Tile]),
      ...[...L.jog, ...L.ends, ...L.via, ...L.inn.yard, L.inn.door].map((t) => ['life', t] as [string, Tile]),
    ];
    for (const [what, t] of tiles) expect(REACHED.has(key(t)), `${what} ${key(t)}`).toBe(true);
  });

  it('spread over the districts, not crowded on the plaza', () => {
    const L = WORLD_LIFE;
    const inPlaza = (t: Tile) => Math.hypot(t.x + 0.5 - TOWN_WORLD.plaza.x, t.y + 0.5 - TOWN_WORLD.plaza.y) <= TOWN_WORLD.plaza.r + 1;
    expect(L.chats.length).toBeGreaterThanOrEqual(10);
    expect(L.chats.filter(([a]) => inPlaza(a)).length).toBeLessThanOrEqual(2);
    const seatsOut = L.seats.filter((s) => !inPlaza({ x: Math.floor(s.x), y: Math.floor(s.y) }));
    expect(seatsOut.length).toBeGreaterThan(L.seats.length / 2);
    expect(L.ends.length).toBeGreaterThanOrEqual(4);
    // the ways out are at the map's far edges (the mountains' passes) or at the harbour, where the jetty starts
    const jetty = WORLD_SCENERY.find((s) => s.kind === 'jetty')!.at!;
    for (const t of L.ends) expect(t.x === 0 || t.y === 0 || Math.hypot(t.x + 0.5 - jetty.x, t.y + 0.5 - jetty.y) < 1.5, key(t)).toBe(true);
    // the jog keeps to the plaza
    for (const t of L.jog) expect(groundAt(t), key(t)).toBe('plaza');
  });

  it('anglers stand on the shore with the water in front of them', () => {
    const OCT: Record<number, Tile> = { 0: { x: 1, y: 0 }, 2: { x: 0, y: 1 }, 4: { x: -1, y: 0 }, 6: { x: 0, y: -1 } };
    for (const s of WORLD_LIFE.fish) {
      const d = OCT[s.oct];
      expect(groundAt({ x: s.at.x + d.x, y: s.at.y + d.y }), key(s.at)).toBe('water');
    }
  });
});

describe('nothing overlaps', () => {
  it('footprints, trees, props, scenery, the fountain, solid decorations, doors and residents each have their own tile', () => {
    const used = new Map<string, string>();
    const claim = (t: Tile, what: string) => {
      expect(Number.isInteger(t.x) && Number.isInteger(t.y), what).toBe(true);
      expect(t.x >= 0 && t.y >= 0 && t.x < size && t.y < size, what).toBe(true);
      expect(used.get(key(t)), `${what} on ${key(t)}`).toBeUndefined();
      used.set(key(t), what);
    };
    for (const p of WORLD_PLACES) footprintTiles(p).forEach((t) => claim(t, `place ${p.id}`));
    for (const t of worldTrees()) claim(t, 'tree');
    claim(worldFountain()!, 'fountain');
    for (const prop of WORLD_PROPS) prop.tiles.forEach((t) => claim(t, `prop ${prop.kind}`));
    for (const s of WORLD_SCENERY) s.tiles.forEach((t) => claim(t, `scenery ${s.kind}`));
    for (const id of DECORATION_IDS) {
      // the bigger fountain replaces the fountain on its own tile
      if (id === 'fountain') continue;
      for (const s of WORLD_DECORATIONS[id]) if (s.solid) claim(s, `decoration ${id}`);
    }
    for (const p of WORLD_PLACES) {
      claim(p.door, `door ${p.id}`);
      claim(p.spot, `resident ${p.id}`);
    }
    claim(start, 'start');
  });

  it('buildings, lots, props, scenery and solid things stand on dry land; water is only water', () => {
    for (const p of WORLD_PLACES) for (const t of footprintTiles(p)) expect(groundAt(t), p.id).not.toBe('water');
    for (const p of WORLD_PROPS) for (const t of p.tiles) expect(groundAt(t), p.kind).not.toBe('water');
    for (const s of WORLD_SCENERY) for (const t of s.tiles) expect(groundAt(t), s.kind).not.toBe('water');
    for (const id of DECORATION_IDS) {
      for (const s of WORLD_DECORATIONS[id]) if (s.solid) expect(groundAt(s), id).not.toBe('water');
    }
    for (const t of worldTrees()) expect(groundAt(t), key(t)).toBe(t.kind === 'palm' ? 'sand' : 'grass');
  });

  it('scenery: things that block have tiles, ducks swim, the hill is walkable ground', () => {
    expect(TOWN_WORLD.scenery).toBe(WORLD_SCENERY);
    for (const s of WORLD_SCENERY) {
      if (s.kind === 'duck' || s.kind === 'boat') {
        expect(s.tiles).toHaveLength(0);
        // a boat may lie on the sea beyond the map's edge
        const g = groundAt({ x: Math.floor(s.at!.x), y: Math.floor(s.at!.y) });
        expect(g === 'water' || (s.kind === 'boat' && g === null), `${s.kind} ${s.at!.x},${s.at!.y}`).toBe(true);
      } else if (s.kind === 'jetty') {
        // from the shore out over the sea
        expect(s.tiles).toHaveLength(0);
        expect(s.len).toBeGreaterThan(2);
        const d = s.dir === 'y' ? { x: 0, y: 1 } : { x: 1, y: 0 };
        expect(walkable({ x: Math.floor(s.at!.x - d.x * 0.7), y: Math.floor(s.at!.y - d.y * 0.7) })).toBe(true);
        expect(groundAt({ x: Math.floor(s.at!.x + d.x * 1.5), y: Math.floor(s.at!.y + d.y * 1.5) })).toBe('water');
      } else if (s.kind === 'hill') {
        expect(s.tiles).toHaveLength(0);
        // walkable, or the lighthouse stands on its top
        const lighthouse = WORLD_SCENERY.some((o) => o.kind === 'lighthouse' && o.tiles.some((t) => t.x === s.at!.x && t.y === s.at!.y));
        expect(walkable(s.at!) || lighthouse, `hill ${key(s.at!)}`).toBe(true);
      } else {
        expect(s.tiles.length, s.kind).toBeGreaterThan(0);
        for (const t of s.tiles) expect(walkable(t), `${s.kind} ${key(t)}`).toBe(false);
      }
    }
  });
});

describe('decorations', () => {
  it('every decoration id has at least one spot inside the map', () => {
    expect([...DECORATION_IDS].sort()).toEqual([...ALL_DECORATIONS].sort());
    for (const id of ALL_DECORATIONS) {
      const spots = WORLD_DECORATIONS[id];
      expect(spots.length, id).toBeGreaterThan(0);
      for (const s of spots) {
        expect(s.x >= 0 && s.y >= 0 && s.x < size && s.y < size, id).toBe(true);
      }
    }
  });

  it('street lamps stand beside a path or the plaza with their arm over it', () => {
    const paved = (x: number, y: number) => {
      const g = groundAt({ x, y });
      return g === 'path' || g === 'plaza';
    };
    for (const id of ['lamps1', 'lamps2'] as const) {
      for (const s of WORLD_DECORATIONS[id]) {
        // the arm reaches right on the screen (x+1 or y-1), mirrored left (x-1 or y+1)
        const over = s.flip ? [paved(s.x - 1, s.y), paved(s.x, s.y + 1)] : [paved(s.x + 1, s.y), paved(s.x, s.y - 1)];
        expect(over.some(Boolean), `${id} at ${s.x},${s.y}`).toBe(true);
      }
    }
  });

  it('nothing solid stands on the start tile or next to it', () => {
    for (const spots of Object.values(WORLD_DECORATIONS)) {
      for (const s of spots) {
        if (!s.solid) continue;
        expect(Math.max(Math.abs(s.x - start.x), Math.abs(s.y - start.y)), `${s.x},${s.y}`).toBeGreaterThan(1);
      }
    }
  });

  it('no bench stands next to the water (its picture would reach into the lake)', () => {
    for (const s of WORLD_DECORATIONS.benches) {
      // a bench reaches along its sides, not across the corners of its tile
      for (const d of NEIGHBOURS.filter((n) => n.x === 0 || n.y === 0)) expect(groundAt({ x: s.x + d.x, y: s.y + d.y }), `${s.x},${s.y}`).not.toBe('water');
    }
  });

  it('the bigger fountain is the fountain, lilies float on the lake, benches look somewhere', () => {
    expect(WORLD_DECORATIONS.fountain).toEqual([{ ...worldFountain()!, solid: true }]);
    for (const s of WORLD_DECORATIONS.lilies) expect(groundAt({ x: Math.floor(s.x), y: Math.floor(s.y) })).toBe('water');
    for (const s of WORLD_DECORATIONS.benches) expect(s.dir).toBeDefined();
    // loose decorations never block a tile
    for (const id of ['lilies', 'balloons', 'cat'] as const) for (const s of WORLD_DECORATIONS[id]) expect(s.solid).toBe(false);
  });
});

describe('nothing bought gets in the way', () => {
  const everything = walkWorld(TOWN_WORLD, { built: ALL_PLACES, decorations: ALL_DECORATIONS });
  const solids = Object.entries(WORLD_DECORATIONS).flatMap(([id, spots]) => spots.filter((s) => s.solid).map((s) => ({ id, x: s.x, y: s.y })));

  it('no solid decoration stands at an activity spot or right beside it (the egg kiosk keeps its front)', () => {
    const bad: string[] = [];
    for (const [a, spot] of Object.entries(WORLD_ACTIVITIES)) {
      for (const s of solids) if (Math.max(Math.abs(s.x - spot.stand.x), Math.abs(s.y - spot.stand.y)) <= 1) bad.push(`${s.id} at ${s.x},${s.y} by ${a}`);
    }
    expect(bad).toEqual([]);
  });

  it('no solid decoration stands on a door or right in front of it', () => {
    for (const p of WORLD_PLACES) {
      const front = p.face === 'x' ? { x: p.door.x + 1, y: p.door.y } : { x: p.door.x, y: p.door.y + 1 };
      for (const s of solids) {
        expect(s.x === p.door.x && s.y === p.door.y, `${s.id} on ${p.id}'s door`).toBe(false);
        expect(s.x === front.x && s.y === front.y, `${s.id} before ${p.id}'s door`).toBe(false);
      }
    }
  });

  it('no solid decoration closes a way: the open tiles round it stay joined to each other', () => {
    const bad: string[] = [];
    for (const s of solids) {
      // the ring of eight round it, walked one step at a time without going through it
      const ring = NEIGHBOURS.map((d) => ({ x: s.x + d.x, y: s.y + d.y })).filter((t) => walkable(t, everything));
      if (ring.length < 2) continue;
      const seen = new Set([key(ring[0])]);
      const queue = [ring[0]];
      for (let i = 0; i < queue.length; i++) {
        const at = queue[i];
        for (const d of NEIGHBOURS) {
          const next = { x: at.x + d.x, y: at.y + d.y };
          if (seen.has(key(next)) || !ring.some((t) => t.x === next.x && t.y === next.y)) continue;
          if (!canStep(at, d, everything)) continue;
          seen.add(key(next));
          queue.push(next);
        }
      }
      if (seen.size !== ring.length) bad.push(`${s.id} at ${s.x},${s.y}`);
    }
    expect(bad).toEqual([]);
  });
});
