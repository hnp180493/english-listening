import { describe, expect, it } from 'vitest';
import { depthOfFootprint, depthOfPoint, TILE_H, TILE_W, toTile, toWorld, worldBounds } from './iso';

describe('projection', () => {
  it('tile → world → tile is the same point', () => {
    for (const [x, y] of [[0, 0], [3, 4], [10.5, 12.5], [20.25, 0.75], [-2, 7]]) {
      const w = toWorld(x, y);
      const t = toTile(w.x, w.y);
      expect(t.x).toBeCloseTo(x, 9);
      expect(t.y).toBeCloseTo(y, 9);
    }
  });

  it('x runs down-right, y down-left, height straight up', () => {
    expect(toWorld(0, 0)).toEqual({ x: 0, y: 0 });
    expect(toWorld(1, 0)).toEqual({ x: TILE_W / 2, y: TILE_H / 2 });
    expect(toWorld(0, 1)).toEqual({ x: -TILE_W / 2, y: TILE_H / 2 });
    expect(toWorld(1, 1)).toEqual({ x: 0, y: TILE_H });
    expect(toWorld(2, 2, 10)).toEqual({ x: 0, y: 2 * TILE_H - 10 });
  });

  it('a world point falls into the tile whose diamond holds it', () => {
    const c = toWorld(7.5, 3.5);
    for (const [dx, dy] of [[0, 0], [20, 0], [-20, 0], [0, 10], [0, -10]]) {
      const t = toTile(c.x + dx, c.y + dy);
      expect([Math.floor(t.x), Math.floor(t.y)]).toEqual([7, 3]);
    }
    const t = toTile(c.x + 40, c.y);
    expect([Math.floor(t.x), Math.floor(t.y)]).not.toEqual([7, 3]);
  });

  it('the bounds hold the whole town', () => {
    const b = worldBounds(21);
    for (const [x, y] of [[0, 0], [21, 0], [0, 21], [21, 21]]) {
      const w = toWorld(x, y, 60);
      expect(w.x).toBeGreaterThan(b.x0);
      expect(w.x).toBeLessThan(b.x1);
      expect(w.y).toBeGreaterThan(b.y0);
      expect(w.y).toBeLessThan(b.y1);
    }
  });
});

describe('depth order', () => {
  const centre = (x: number, y: number) => depthOfPoint(x + 0.5, y + 0.5);

  it('nearer the viewer = larger', () => {
    expect(centre(5, 5)).toBeGreaterThan(centre(4, 5));
    expect(centre(5, 5)).toBeGreaterThan(centre(5, 4));
    expect(centre(3, 6)).toBe(centre(6, 3));
  });

  it('somebody standing on any tile around a house is on the right side of it', () => {
    for (const [w, d] of [[2, 2], [3, 2], [2, 3]]) {
      const x = 4;
      const y = 6;
      const house = depthOfFootprint(x, y, w, d);
      // in front: the row below and the column to the right
      for (let i = 0; i < w; i++) expect(centre(x + i, y + d)).toBeGreaterThan(house);
      for (let j = 0; j < d; j++) expect(centre(x + w, y + j)).toBeGreaterThan(house);
      // behind: the row above and the column to the left
      for (let i = 0; i < w; i++) expect(centre(x + i, y - 1)).toBeLessThan(house);
      for (let j = 0; j < d; j++) expect(centre(x - 1, y + j)).toBeLessThan(house);
      expect(centre(x - 1, y - 1)).toBeLessThan(house);
      expect(centre(x + w, y + d)).toBeGreaterThan(house);
    }
  });
});
