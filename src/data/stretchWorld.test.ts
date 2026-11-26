import { describe, expect, it } from 'vitest';
import { axisMap, stretchRows, stretchWorld } from './stretchWorld';
import type { TownWorld } from './townWorld';
import { CITY_CUTS_X, CITY_CUTS_Y, CITY_SIZE, CITY_WORLD } from './cityWorld';

const W = (rows: string[], extra: Partial<TownWorld> = {}): TownWorld => ({
  size: rows.length,
  rows,
  places: [],
  props: [],
  decorations: {} as TownWorld['decorations'],
  plaza: { x: 1.5, y: 1.5, r: 1 },
  start: { x: 0, y: 0 },
  ...extra,
});

describe('stretching a map', () => {
  it('moves a coordinate on by every cut at or before its tile', () => {
    const m = axisMap([{ at: 2, by: 3 }, { at: 5, by: 1 }]);
    expect([m(0), m(1.9), m(2), m(2.5), m(4), m(5), m(9)]).toEqual([0, 1.9, 5, 5.5, 7, 9, 13]);
  });

  it('copies the cut row and column without their trees; a street runs on', () => {
    const rows = ['====', '.T..', '....', '....'];
    const out = stretchRows(rows, [{ at: 1, by: 2 }], [{ at: 1, by: 1 }]);
    expect(out).toEqual(['======', '......', '...T..', '......', '......']);
  });

  it('keeps a house, its door and spot together and refuses a cut through them', () => {
    const rows = ['......', '......', '......', '......', '......', '......'];
    const place = { id: 'cafe', name: '', resident: '', x: 1, y: 1, w: 2, d: 2, face: 'y', door: { x: 1, y: 3 }, spot: { x: 2, y: 3 } } as TownWorld['places'][number];
    const ok = stretchWorld(W(rows, { places: [place] }), [{ at: 4, by: 2 }], [{ at: 0, by: 2 }]);
    expect(ok.size).toBe(8);
    expect(ok.places[0]).toMatchObject({ x: 1, y: 3, w: 2, d: 2, door: { x: 1, y: 5 }, spot: { x: 2, y: 5 } });
    expect(() => stretchWorld(W(rows, { places: [place] }), [{ at: 2, by: 1 }], [{ at: 0, by: 1 }])).toThrow(/place cafe/);
    expect(() => stretchWorld(W(rows, { places: [place] }), [{ at: 0, by: 1 }], [{ at: 3, by: 1 }])).toThrow(/place cafe/);
  });

  it('grows a block of flats that stands across a cut', () => {
    const rows = ['....', '....', '....', '....'];
    const block = { kind: 'block' as const, tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }], h: 3, v: 0 };
    const out = stretchWorld(W(rows, { scenery: [block] }), [{ at: 2, by: 2 }], [{ at: 3, by: 2 }]);
    expect(out.scenery![0].tiles.map((t) => t.x)).toEqual([1, 2, 3, 4]);
  });
});

describe('Westbay is a city, not a village (owner, 2026-11-26)', () => {
  it('is stretched to a square of 96, every row as long', () => {
    expect(CITY_SIZE).toBe(72 + CITY_CUTS_X.reduce((n, c) => n + c.by, 0));
    expect(CITY_SIZE).toBe(72 + CITY_CUTS_Y.reduce((n, c) => n + c.by, 0));
    expect(CITY_WORLD.rows.length).toBe(CITY_SIZE);
    for (const r of CITY_WORLD.rows) expect(r.length).toBe(CITY_SIZE);
  });

  it('has blocks of flats on the new ground, never on a street, a square, the water or a tree', () => {
    const blocks = (CITY_WORLD.scenery ?? []).filter((s) => s.kind === 'block');
    expect(blocks.length).toBeGreaterThan(60);
    for (const b of blocks.slice(16)) for (const t of b.tiles) expect(CITY_WORLD.rows[t.y][t.x], `${t.x},${t.y}`).toBe('.');
  });
});
