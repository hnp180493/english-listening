import { describe, expect, it } from 'vitest';
import { baseZoom, Camera, cameraDt } from './camera';

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

  it('eases in as well as out: a new target starts from rest (no lurch in the first frame), no overshoot, no faster than 1200 px/s', () => {
    const c = camera();
    c.lookAt({ x: 0, y: 0 }, 1.4);
    c.snap();
    // a conversation: the camera pans 600 world px and zooms in
    c.lookAt({ x: 600, y: 0 }, 1.6);
    const xs: number[] = [c.x];
    const zs: number[] = [c.zoom];
    for (let i = 0; i < 120; i++) {
      c.update(1 / 60);
      xs.push(c.x);
      zs.push(c.zoom);
    }
    const steps = xs.slice(1).map((x, i) => (x - xs[i]) * zs[i + 1] * 60);
    // the first frame barely moves (the old exponential ease moved 48 px of 600 at once, its fastest frame) and it
    // speeds up from there
    expect((xs[1] - xs[0]) * zs[1]).toBeLessThan(10);
    expect(steps[0]).toBeLessThan(steps[3]);
    expect(zs[1] - zs[0]).toBeLessThan((zs[4] - zs[3]) * 0.5);
    // steady, capped, never past the target
    for (const s of steps) expect(s).toBeLessThanOrEqual(1200 + 1e-6);
    for (const x of xs) expect(x).toBeLessThanOrEqual(600 + 1e-9);
    for (const z of zs) expect(z).toBeLessThanOrEqual(1.6 + 1e-9);
    expect(c.x).toBeCloseTo(600, 0);
    // a long frame (the dt the engine passes is at most 0.05 s) moves no more than the cap allows
    c.lookAt({ x: 0, y: 0 }, 1.4);
    const before = c.x;
    c.update(0.05);
    expect(Math.abs(c.x - before) * c.zoom).toBeLessThanOrEqual(1200 * 0.05 + 1e-6);
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

  it('keeps to the island (little sky in the corners) but never loses what it follows', () => {
    const c = camera();
    c.island = { cx: 0, cy: 336, hw: 672, hh: 336 };
    // the far left corner of the island: pulled in towards the middle…
    c.lookAt({ x: -640, y: 336 }, 1);
    c.snap();
    expect(c.x).toBeGreaterThan(-640);
    // …but the target stays inside the view, with room to spare
    const s = c.worldToScreen({ x: -640, y: 336 });
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(800);
    // the middle of the island is left alone
    c.lookAt({ x: 10, y: 330 }, 1);
    c.snap();
    expect([c.x, c.y]).toEqual([10, 330]);
  });

  it('the player it keeps stays well inside the view whatever it aims at (hint blend, island, world edges, a side panel)', () => {
    const half = 21 * 32;
    for (const [w, h] of [
      [1225, 672],
      [390, 560],
    ]) {
      for (const zoom of [1, 1.46, 2.2]) {
        for (const shift of [0, -120]) {
          const c = new Camera();
          c.setView(w, h);
          c.bounds = { x0: -half - 40, y0: -60, x1: half + 40, y1: half + 60 };
          c.island = { cx: 0, cy: half / 2, hw: half, hh: half / 2 };
          c.shiftTo(shift, shift / 2);
          // the player at each corner of the island, the hinted resident at the far side: the aim lies between them
          const corners = [
            { x: -half + 40, y: half / 2 },
            { x: half - 40, y: half / 2 },
            { x: 0, y: 30 },
            { x: 0, y: half - 30 },
          ];
          for (const p of corners) {
            const far = { x: -p.x, y: half - p.y };
            c.keep = { x: p.x, y: p.y, up: 46 };
            c.lookAt({ x: (p.x + far.x) / 2, y: (p.y + far.y) / 2 }, zoom);
            c.snap();
            for (let i = 0; i < 90; i++) c.update(1 / 60);
            const feet = c.worldToScreen(p);
            const head = c.worldToScreen({ x: p.x, y: p.y - 46 });
            const mx = 0.15 * (w / 2) - 0.5;
            expect(feet.x, `${w} z${zoom} ${JSON.stringify(p)}`).toBeGreaterThanOrEqual(mx);
            expect(feet.x).toBeLessThanOrEqual(w - mx);
            expect(head.y).toBeGreaterThanOrEqual(0.15 * (h / 2) - 0.5);
            expect(feet.y).toBeLessThanOrEqual(h - 0.15 * (h / 2) + 0.5);
          }
        }
      }
    }
  });

  it('loose (a conversation): the target goes exactly where asked, even by the edge of the world', () => {
    const c = camera();
    c.bounds = { x0: -100, y0: -100, x1: 100, y1: 100 };
    c.island = { cx: 0, cy: 0, hw: 100, hh: 50 };
    c.lookAt({ x: 95, y: -90 }, 2);
    c.snap();
    expect([c.x, c.y]).not.toEqual([95, -90]);
    c.loose = true;
    c.snap();
    expect([c.x, c.y]).toEqual([95, -90]);
  });

  it('the resting zoom grows with the stage and stays within its limits', () => {
    expect(baseZoom(390, 500)).toBeLessThan(baseZoom(1240, 660));
    expect(baseZoom(200, 200)).toBe(0.8);
    expect(baseZoom(4000, 2000)).toBe(1.8);
  });
});

describe('cameraDt', () => {
  it('gives the camera real time at a steady 30, 60 or 144 Hz, and only a short step for a late frame', () => {
    for (const hz of [24, 30, 60, 120, 144]) expect(cameraDt(1 / hz, 1 / hz)).toBeCloseTo(1 / hz, 9);
    // a frame three times late at 60 Hz: the camera moves as if 1.5 frames went by, not 3
    expect(cameraDt(0.05, 1 / 60)).toBeCloseTo(1 / 40, 9);
    expect(cameraDt(0.05, 1 / 144)).toBeCloseTo(1 / 50, 9);
  });
});
