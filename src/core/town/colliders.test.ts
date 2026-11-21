import { describe, expect, it } from 'vitest';
import { TOWN_WORLD, WORLD_DECORATIONS, WORLD_PLACES, type Collider, type TownWorld } from '../../data/townWorld';
import { collidersOf, distanceTo, GRID_CLEAR, inside, lotOf, NO_STATE, pushOut, walkKey, walkWorld } from './colliders';
import { collidersIn, solidsNear, walkable } from './map';

const P = (x: number, y: number) => ({ x, y });
const C = (x: number, y: number, r: number): Collider => ({ kind: 'circle', x, y, r, what: 't' });
const B = (x0: number, y0: number, x1: number, y1: number): Collider => ({ kind: 'box', x0, y0, x1, y1, what: 't' });

describe('shapes', () => {
  it('distance, inside and push-out of a circle and a box', () => {
    expect(distanceTo(C(1, 1, 0.5), 2, 1)).toBeCloseTo(0.5);
    expect(distanceTo(C(1, 1, 0.5), 1.2, 1)).toBe(0);
    expect(distanceTo(B(0, 0, 1, 1), 2, 1)).toBeCloseTo(1);
    expect(inside(B(0, 0, 1, 1), 0.5, 0.5)).toBe(true);
    expect(inside(C(0, 0, 1), 1, 0)).toBe(false);
    // a body of 0.2 touching a post of 0.1 from the side goes out to 0.3
    const a = pushOut(C(0, 0, 0.1), 0.25, 0, 0.2)!;
    expect(a.x).toBeCloseTo(0.3);
    expect(pushOut(C(0, 0, 0.1), 0.31, 0, 0.2)).toBeNull();
    // against a wall it goes out along its normal; a centre inside leaves by the nearest side
    expect(pushOut(B(0, 0, 1, 1), 1.1, 0.5, 0.2)).toEqual({ x: 1.2, y: 0.5 });
    expect(pushOut(B(0, 0, 1, 1), 0.9, 0.5, 0.2)).toEqual({ x: 1.2, y: 0.5 });
  });
});

describe('what stands in town for a state', () => {
  it('a lot is a site, a house or nature; decorations block only once bought', () => {
    expect(lotOf('cafe', { built: [] })).toBe('site');
    expect(lotOf('cafe', { built: [], sites: ['home'] })).toBe('nature');
    expect(lotOf('cafe', { built: ['cafe'], sites: [] })).toBe('built');
    const none = collidersOf(TOWN_WORLD, NO_STATE);
    expect(none.some((c) => c.what.startsWith('decor:'))).toBe(false);
    const lamps = collidersOf(TOWN_WORLD, { built: [], decorations: ['lamps1'] }).filter((c) => c.what.startsWith('decor:'));
    expect(lamps).toHaveLength(WORLD_DECORATIONS.lamps1.length);
    // a lamp post is thin: the body can stand right beside it on its own tile
    for (const c of lamps) expect(c.kind === 'circle' && c.r <= 0.12).toBe(true);
  });

  it('the plaza is open until the fountain is bought; the decorations\' tiles open until then', () => {
    const fresh = walkWorld(TOWN_WORLD, NO_STATE);
    const all = walkWorld(TOWN_WORLD, { built: [], decorations: Object.keys(WORLD_DECORATIONS) });
    for (const [id, spots] of Object.entries(WORLD_DECORATIONS)) {
      for (const s of spots) {
        if (!s.solid) continue;
        expect(walkable(s, fresh), `${id} ${s.x},${s.y}`).toBe(true);
        expect(walkable(s, all), `${id} ${s.x},${s.y}`).toBe(false);
      }
    }
  });

  it('a nature lot opens where it has no tree; a built station leaves the back of its lot open', () => {
    const station = WORLD_PLACES.find((p) => p.id === 'station')!;
    const built = walkWorld(TOWN_WORLD, { built: ['station'], decorations: [] });
    expect(walkable(P(station.x, station.y), built)).toBe(true); // the grass behind the shelter
    expect(walkable(P(station.x, station.y + 1), built)).toBe(false); // the shelter
    // every lot, as a site, is closed tile by tile
    for (const p of WORLD_PLACES) for (let y = p.y; y < p.y + p.d; y++) for (let x = p.x; x < p.x + p.w; x++) expect(walkable(P(x, y)), p.id).toBe(false);
  });

  it('a tile is closed when a collider comes within GRID_CLEAR of its centre', () => {
    const rows = ['....', '....', '....', '....'];
    const empty = { lamps1: [], flowers: [], benches: [], blossom: [], lamps2: [], lights: [], lilies: [], stall: [], fountain: [], balloons: [], flags: [], cat: [] };
    const base: TownWorld = { size: 4, rows, places: [], props: [], decorations: { ...empty, lamps1: [{ x: 1, y: 1, solid: true }] }, plaza: { x: 2, y: 2, r: 1 }, start: P(0, 0) };
    const lit = walkWorld(base, { built: [], decorations: ['lamps1'] });
    expect(walkable(P(1, 1), lit)).toBe(false);
    expect(walkable(P(2, 1), lit)).toBe(true);
    expect(GRID_CLEAR).toBeLessThan(0.5);
    const near: Collider[] = [];
    solidsNear(lit, 1.2, 1.2, 1.8, 1.8, (c) => near.push(c));
    expect(near.map((c) => c.what)).toEqual(['decor:lamps1:0']);
    // outside the map is solid too
    const edge: Collider[] = [];
    solidsNear(lit, -0.5, 0.5, -0.1, 0.6, (c) => edge.push(c));
    expect(edge.map((c) => c.what)).toEqual(['edge']);
  });

  it('the same state gives the same world (cached), a new one a new world; keys ignore order', () => {
    const a = walkWorld(TOWN_WORLD, { built: ['cafe', 'square'], decorations: ['flags'] });
    const b = walkWorld(TOWN_WORLD, { built: ['square', 'cafe'], decorations: ['flags'] });
    expect(b).toBe(a);
    expect(walkWorld(a, { built: [], decorations: [] })).toBe(walkWorld(TOWN_WORLD, { built: [], decorations: [] }));
    expect(walkKey({ built: ['b', 'a'], decorations: [] })).toBe(walkKey({ built: ['a', 'b'], decorations: [] }));
    expect(collidersIn(a)).toBe(a.walk!.colliders);
  });
});
