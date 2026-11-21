import { describe, expect, it } from 'vitest';
import { OCTANTS } from '../../engine/sim';
import { angleDiff, gridToScene, groundOf, hash2, headingOf, middleOf, octantHeading, sceneToGrid, tileAt, valueNoise } from './coords';
import { TOWN_WORLD } from '../../../../data/townWorld';

describe('3D town coordinates', () => {
  it('puts a point of the sim grid on the ground plane (x → X, y → Z)', () => {
    expect(gridToScene(3.5, 4.5)).toEqual({ x: 3.5, y: 0, z: 4.5 });
    expect(gridToScene(1, 2, 0.8)).toEqual({ x: 1, y: 0.8, z: 2 });
    expect(sceneToGrid({ x: 7.25, z: 1.5 })).toEqual({ x: 7.25, y: 1.5 });
  });

  it('finds the tile under a point, null off the map', () => {
    expect(tileAt({ x: 3.9, z: 0.1 }, 21)).toEqual({ x: 3, y: 0 });
    expect(tileAt({ x: -0.1, z: 3 }, 21)).toBeNull();
    expect(tileAt({ x: 21, z: 3 }, 21)).toBeNull();
  });

  it('measures headings like the contract (atan2(dz, dx)) and agrees with the sim octants', () => {
    OCTANTS.forEach((o, i) => {
      expect(Math.abs(angleDiff(headingOf(o.x, o.y), octantHeading(i)))).toBeLessThan(1e-9);
    });
    expect(octantHeading(9)).toBeCloseTo(Math.PI / 4);
  });

  it('takes the short way round', () => {
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(angleDiff(0, Math.PI)).toBeCloseTo(Math.PI);
  });

  it('hashes to [0, 1), the same every time', () => {
    for (let i = 0; i < 200; i++) {
      const h = hash2(i, i * 7 - 3, 5);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(hash2(i, i * 7 - 3, 5)).toBe(h);
    }
    expect(hash2(1, 2, 0)).not.toBe(hash2(2, 1, 0));
  });

  it('gives smooth noise within [0, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const v = valueNoise(i * 0.37, i * 0.11);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      // a tiny step changes it only a little
      expect(Math.abs(valueNoise(i * 0.37 + 0.001, i * 0.11) - v)).toBeLessThan(0.01);
    }
  });

  it('reads the ground of the map', () => {
    const w = TOWN_WORLD;
    for (let y = 0; y < w.size; y++) {
      for (let x = 0; x < w.size; x++) {
        const ch = w.rows[y][x];
        const g = groundOf(w, x, y);
        if (ch === '=') expect(g).toBe('path');
        else if (ch === '~') expect(g).toBe('water');
        else if (ch === 'o' || ch === 'F') expect(g).toBe('plaza');
        else expect(g).toBe('grass');
      }
    }
    expect(groundOf(w, -1, 0)).toBeNull();
  });

  it('finds the middle of tiles', () => {
    expect(middleOf([{ x: 1, y: 1 }, { x: 2, y: 1 }])).toEqual({ x: 2, y: 1.5 });
    expect(middleOf([])).toBeNull();
  });
});
