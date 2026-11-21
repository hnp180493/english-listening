import { describe, expect, it } from 'vitest';
import { basisOf, PITCH } from '../three/scene/cameraRig';
import {
  arrowRotation,
  clampView,
  fitView,
  liftPx,
  MAP_READABLE,
  MAP_TILT,
  MAP_YAW0,
  miniView,
  openView,
  panBy,
  scaleLimits,
  toBox,
  toGrid,
  viewMatrix,
  yawFromForward,
  zoomAt,
  type MapView,
} from './mapView';

const BOX = { w: 1200, h: 700 };
const SIZE = 44;
const view = (patch: Partial<MapView> = {}): MapView => ({ cx: 22, cy: 22, scale: 12, yaw: MAP_YAW0, tilt: MAP_TILT, ...patch });
const close = (a: number, b: number, d = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(d);

describe('world → map coordinates', () => {
  it('turns like the default camera: the tile (0, 0) is the top corner, the farm corner on the right', () => {
    const v = view();
    const top = toBox(v, BOX, 0, 0);
    const right = toBox(v, BOX, SIZE, 0);
    const left = toBox(v, BOX, 0, SIZE);
    const bottom = toBox(v, BOX, SIZE, SIZE);
    close(top.x, BOX.w / 2);
    expect(top.y).toBeLessThan(left.y);
    expect(top.y).toBeLessThan(right.y);
    expect(right.x).toBeGreaterThan(BOX.w / 2);
    expect(left.x).toBeLessThan(BOX.w / 2);
    expect(bottom.y).toBeGreaterThan(right.y);
  });

  it('puts the view centre in the middle of the box', () => {
    const p = toBox(view({ cx: 10, cy: 31 }), BOX, 10, 31);
    close(p.x, BOX.w / 2);
    close(p.y, BOX.h / 2);
  });

  it('goes back and forth between the grid and the box at any turn and slant', () => {
    for (const yaw of [MAP_YAW0, 0, -0.6, 1.9]) {
      for (const tilt of [1, MAP_TILT, 0.3]) {
        const v = view({ yaw, tilt, cx: 17.3, cy: 25.1, scale: 9.5 });
        for (const [x, y] of [
          [0, 0],
          [3.5, 40.2],
          [43, 11],
        ]) {
          const b = toBox(v, BOX, x, y);
          const g = toGrid(v, BOX, b.x, b.y);
          close(g.x, x);
          close(g.y, y);
        }
      }
    }
  });

  it('the canvas matrix says the same as toBox', () => {
    const v = view({ yaw: 0.3, cx: 12, cy: 30 });
    const [a, b, c, d, e, f] = viewMatrix(v, BOX);
    for (const [x, y] of [
      [5, 7],
      [40, 2],
    ]) {
      const p = toBox(v, BOX, x, y);
      close(a * x + c * y + e, p.x);
      close(b * x + d * y + f, p.y);
    }
  });

  it('lifts what stands up only when the map looks at a slant', () => {
    expect(liftPx(view({ tilt: 1 }), 2)).toBe(0);
    expect(liftPx(view({ tilt: MAP_TILT, scale: 10 }), 1)).toBeCloseTo(10 * Math.sqrt(1 - MAP_TILT * MAP_TILT));
    const v = view();
    expect(toBox(v, BOX, 5, 5, 1).y).toBeLessThan(toBox(v, BOX, 5, 5).y);
  });

  it('up on the map is the way the camera looks', () => {
    for (const yaw of [MAP_YAW0, MAP_YAW0 + 0.9, MAP_YAW0 - 1]) {
      const v = view({ yaw, tilt: 1 });
      const f = basisOf(yaw, PITCH).fwd;
      const a = toBox(v, BOX, 20, 20);
      const b = toBox(v, BOX, 20 + f.x, 20 + f.z);
      // a step the camera's way goes straight up the map
      close(b.x, a.x, 1e-6);
      expect(b.y).toBeLessThan(a.y);
    }
  });
});

describe('the camera turn and the arrow', () => {
  it('reads the yaw back from the camera forward vector', () => {
    for (const yaw of [MAP_YAW0, 0.1, -0.8, 2.2]) {
      const f = basisOf(yaw, PITCH).fwd;
      close(yawFromForward(f.x, f.z), Math.atan2(Math.sin(yaw), Math.cos(yaw)));
    }
    expect(yawFromForward(0, 0)).toBe(MAP_YAW0);
  });

  it('points the arrow up when the player faces away from the camera, down when facing it', () => {
    const yaw = MAP_YAW0;
    close(Math.abs(arrowRotation(yaw + Math.PI, yaw)), 0);
    close(Math.abs(arrowRotation(yaw, yaw)), Math.PI);
    // screen right on the ground is (sin yaw, −cos yaw): a quarter turn clockwise
    close(arrowRotation(Math.atan2(-Math.cos(yaw), Math.sin(yaw)), yaw), Math.PI / 2);
  });

  it('turns with the camera: the same heading turns the other way on the map', () => {
    const h = 0.4;
    const a = arrowRotation(h, MAP_YAW0);
    const b = arrowRotation(h, MAP_YAW0 + 0.3);
    close(b - a, -0.3, 1e-9);
  });
});

describe('fitting, zooming and dragging', () => {
  it('fits the whole town in the box with its padding', () => {
    for (const yaw of [MAP_YAW0, 0.2, 1.3]) {
      const v = fitView(BOX, SIZE, yaw, MAP_TILT, 24);
      for (const [x, y] of [
        [0, 0],
        [SIZE, 0],
        [0, SIZE],
        [SIZE, SIZE],
      ]) {
        const p = toBox(v, BOX, x, y);
        expect(p.x).toBeGreaterThanOrEqual(23.9);
        expect(p.x).toBeLessThanOrEqual(BOX.w - 23.9);
        expect(p.y).toBeGreaterThanOrEqual(23.9);
        expect(p.y).toBeLessThanOrEqual(BOX.h - 23.9);
      }
    }
  });

  it('opens on the whole town on a laptop, closer and round the player on a phone', () => {
    const desk = openView({ w: 1550, h: 670 }, SIZE, MAP_YAW0, MAP_TILT, { x: 5, y: 40 });
    expect(desk.cx).toBe(SIZE / 2);
    expect(desk.scale).toBeGreaterThanOrEqual(MAP_READABLE);
    const phone = openView({ w: 390, h: 600 }, SIZE, MAP_YAW0, MAP_TILT, { x: 5, y: 40 });
    expect(phone.scale).toBe(MAP_READABLE);
    expect(phone.cx).toBe(5);
    expect(phone.cy).toBe(40);
  });

  it('zooms round the pointer: the ground under it stays', () => {
    const v = view();
    const limits = scaleLimits(BOX, SIZE, v.yaw, v.tilt);
    const before = toGrid(v, BOX, 300, 200);
    const z = zoomAt(v, BOX, 1.6, 300, 200, SIZE, limits);
    expect(z.scale).toBeCloseTo(v.scale * 1.6);
    const after = toGrid(z, BOX, 300, 200);
    close(after.x, before.x, 1e-6);
    close(after.y, before.y, 1e-6);
  });

  it('keeps the zoom within reason', () => {
    const v = view();
    const limits = scaleLimits(BOX, SIZE, v.yaw, v.tilt);
    expect(zoomAt(v, BOX, 100, 600, 350, SIZE, limits).scale).toBe(limits.max);
    expect(zoomAt(v, BOX, 0.001, 600, 350, SIZE, limits).scale).toBe(limits.min);
    expect(limits.min).toBeLessThanOrEqual(fitView(BOX, SIZE, v.yaw, v.tilt).scale);
  });

  it('drags the ground with the pointer and stops over the edge of the town', () => {
    const v = view();
    const limits = scaleLimits(BOX, SIZE, v.yaw, v.tilt);
    const under = toGrid(v, BOX, 500, 300);
    const moved = panBy(v, 40, -25, SIZE, limits);
    const now = toBox(moved, BOX, under.x, under.y);
    close(now.x, 540, 1e-6);
    close(now.y, 275, 1e-6);
    const far = panBy(v, -100000, -100000, SIZE, limits);
    expect(far.cx).toBeGreaterThanOrEqual(0);
    expect(far.cx).toBeLessThanOrEqual(SIZE);
    expect(far.cy).toBeGreaterThanOrEqual(0);
    expect(far.cy).toBeLessThanOrEqual(SIZE);
    expect(clampView({ ...v, cx: -5, cy: 99 }, SIZE, limits)).toMatchObject({ cx: 0, cy: SIZE });
  });

  it('the minimap is centred on the player, straight down, its rim `radius` tiles away', () => {
    const m = miniView({ x: 12.5, y: 30.2 }, 0.9, 66, 11);
    expect(m.tilt).toBe(1);
    const c = toBox(m, { w: 132, h: 132 }, 12.5, 30.2);
    close(c.x, 66);
    close(c.y, 66);
    const rim = toBox(m, { w: 132, h: 132 }, 12.5 + 11, 30.2);
    close(Math.hypot(rim.x - 66, rim.y - 66), 66, 1e-6);
  });
});
