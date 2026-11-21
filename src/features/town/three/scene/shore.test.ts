import { describe, expect, it } from 'vitest';
import { BODY_RADIUS } from '../../../../core/town/colliders';
import { TOWN_WORLD } from '../../../../data/townWorld';
import { groundOf } from './coords';
import { chaikin, LAND_SLACK, ShoreField, shoreLoops, smoothShore, WATER_SLACK } from './shore';

const S = TOWN_WORLD.size;
const isWater = (x: number, y: number) => groundOf(TOWN_WORLD, x, y) === 'water';

describe('the rounded shore', () => {
  it('one tile of water is one loop of four edges, water on its left', () => {
    const loops = shoreLoops((x, y) => x === 2 && y === 3, 6);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
    const field = new ShoreField(loops.map((l) => chaikin(chaikin(chaikin(l)))), 6);
    expect(field.inWater(2.5, 3.5)).toBe(true);
    expect(field.inWater(1.5, 3.5)).toBe(false);
    expect(field.signed(2.5, 3.5)).toBeLessThan(0);
    expect(field.signed(4.5, 3.5)).toBeGreaterThan(0);
  });

  it('the lake is one closed loop, its curve close to the tiles (a little into the land, more over the water)', () => {
    const loops = smoothShore(isWater, S);
    expect(loops.length).toBeGreaterThanOrEqual(1);
    
    for (const loop of loops) {
      for (const p of loop) {
        // distance to the other kind of tile than the one it lies on
        const water = isWater(Math.floor(p.x), Math.floor(p.y));
        let best = Infinity;
        for (let y = Math.floor(p.y) - 1; y <= Math.floor(p.y) + 1; y++) {
          for (let x = Math.floor(p.x) - 1; x <= Math.floor(p.x) + 1; x++) {
            if (isWater(x, y) === water) continue;
            const cx = Math.max(x, Math.min(p.x, x + 1));
            const cy = Math.max(y, Math.min(p.y, y + 1));
            best = Math.min(best, Math.hypot(p.x - cx, p.y - cy));
          }
        }
        expect(best, `${p.x},${p.y}`).toBeLessThanOrEqual((water ? WATER_SLACK : LAND_SLACK) + 1e-6);
      }
    }
  });

  it('a body standing against the water (BODY_RADIUS from its tiles) stands on the drawn land', () => {
    const field = new ShoreField(smoothShore(isWater, S), S);
    let checked = 0;
    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        if (isWater(tx, ty)) continue;
        for (let sy = 0; sy <= 10; sy++) {
          for (let sx = 0; sx <= 10; sx++) {
            const px = tx + sx / 10;
            const py = ty + sy / 10;
            // clear of every water tile by a body's radius (where the sim lets a body stand)
            let clear = true;
            for (let y = ty - 1; y <= ty + 1 && clear; y++) {
              for (let x = tx - 1; x <= tx + 1; x++) {
                if (!isWater(x, y)) continue;
                const cx = Math.max(x, Math.min(px, x + 1));
                const cy = Math.max(y, Math.min(py, y + 1));
                if (Math.hypot(px - cx, py - cy) < BODY_RADIUS) {
                  clear = false;
                  break;
                }
              }
            }
            if (!clear) continue;
            checked++;
            expect(field.inWater(px, py), `${px},${py}`).toBe(false);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
