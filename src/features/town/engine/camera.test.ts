import { describe, expect, it } from 'vitest';
import { baseZoom, Camera } from './camera';

function camera(): Camera {
  const c = new Camera();
  c.setView(800, 600);
  return c;
}

describe('Camera', () => {
  it('screen ↔ world round trip at any zoom', () => {
    const c = camera();
    c.lookAt({ x: 120, y: -40 }, 1.7);
    c.snap();
    for (const p of [{ x: 0, y: 0 }, { x: 400, y: 300 }, { x: 799, y: 12 }]) {
      const back = c.worldToScreen(c.screenToWorld(p));
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
    // what it looks at is in the middle of the view
    expect(c.worldToScreen({ x: 120, y: -40 })).toEqual({ x: 400, y: 300 });
  });

  it('eases towards its target and gets there', () => {
    const c = camera();
    c.lookAt({ x: 0, y: 0 }, 1);
    c.snap();
    c.lookAt({ x: 300, y: 100 }, 1.5);
    c.update(0.016);
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(300);
    expect(c.zoom).toBeGreaterThan(1);
    expect(c.zoom).toBeLessThan(1.5);
    let prev = c.x;
    for (let i = 0; i < 400; i++) {
      c.update(0.016);
      expect(c.x).toBeGreaterThanOrEqual(prev);
      prev = c.x;
    }
    expect(c.x).toBeCloseTo(300, 1);
    expect(c.y).toBeCloseTo(100, 1);
    expect(c.zoom).toBe(1.5);
  });

  it('instant: no easing (first frame, reduced motion)', () => {
    const c = camera();
    c.lookAt({ x: 300, y: 100 }, 2);
    c.update(0.016, true);
    expect([c.x, c.y, c.zoom]).toEqual([300, 100, 2]);
  });

  it('stays inside the world; a view larger than the world is centred', () => {
    const c = camera();
    c.bounds = { x0: -1000, y0: -200, x1: 1000, y1: 800 };
    c.lookAt({ x: 5000, y: 5000 }, 1);
    c.snap();
    expect(c.x).toBe(1000 - 400);
    expect(c.y).toBe(800 - 300);
    c.lookAt({ x: -5000, y: -5000 }, 1);
    c.snap();
    expect([c.x, c.y]).toEqual([-600, 100]);
    // zoomed far out: the world is smaller than the view
    c.lookAt({ x: 700, y: 700 }, 0.25);
    c.snap();
    expect([c.x, c.y]).toEqual([0, 300]);
  });

  it('the resting zoom grows with the stage and stays within its limits', () => {
    expect(baseZoom(390, 500)).toBeLessThan(baseZoom(1240, 660));
    expect(baseZoom(200, 200)).toBe(0.62);
    expect(baseZoom(4000, 2000)).toBe(1.45);
  });
});
