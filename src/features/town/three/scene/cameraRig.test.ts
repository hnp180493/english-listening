import { describe, expect, it } from 'vitest';
import { springStep } from '../../engine/spring';
import { basisOf, cameraPosition, clampToIsland, EDGE_HOLD, fitDistance, FOLLOW_LEAD, FOLLOW_W, followPoint, FOV, groundHalfExtent, insetShift, keyDirection, PITCH, restDistance, YAW0, YAW_PER_PX, yawAfter, ZOOM_MAX, ZOOM_MIN, zoomAfter, followStiffness, followLead, FOLLOW_W_NARROW } from './cameraRig';
import type { P3 } from './coords';

const dot = (a: P3, b: P3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: P3) => Math.sqrt(dot(a, a));

/** Where a point lands on the screen, -1..1 both ways (perspective, as three.js draws it). */
function project(p: P3, target: P3, yaw: number, pitch: number, dist: number, aspect: number): { x: number; y: number; z: number } {
  const b = basisOf(yaw, pitch);
  const cam = cameraPosition(target, yaw, pitch, dist);
  const r = { x: p.x - cam.x, y: p.y - cam.y, z: p.z - cam.z };
  const depth = dot(r, b.fwd);
  const t = Math.tan((FOV * Math.PI) / 360);
  return { x: dot(r, b.right) / depth / (t * aspect), y: dot(r, b.up) / depth / t, z: depth };
}

describe('3D town camera rig', () => {
  it('has an orthonormal basis, screen right along +x −y of the grid by default', () => {
    const b = basisOf(YAW0, PITCH);
    for (const v of [b.right, b.up, b.fwd]) expect(len(v)).toBeCloseTo(1);
    expect(dot(b.right, b.up)).toBeCloseTo(0);
    expect(dot(b.right, b.fwd)).toBeCloseTo(0);
    expect(dot(b.up, b.fwd)).toBeCloseTo(0);
    expect(b.right.x).toBeGreaterThan(0);
    expect(b.right.z).toBeLessThan(0);
    expect(b.right.y).toBe(0);
    // looking down, towards −x −y
    expect(b.fwd.y).toBeLessThan(0);
    expect(b.fwd.x).toBeLessThan(0);
    expect(b.fwd.z).toBeLessThan(0);
  });

  it('stands the camera at its distance, above and towards the viewer', () => {
    const t = { x: 10, y: 0, z: 10 };
    const c = cameraPosition(t, YAW0, PITCH, 15);
    expect(len({ x: c.x - t.x, y: c.y - t.y, z: c.z - t.z })).toBeCloseTo(15);
    expect(c.x).toBeGreaterThan(t.x);
    expect(c.z).toBeGreaterThan(t.z);
    expect(c.y).toBeCloseTo(15 * Math.sin(PITCH));
    // the target is in the middle of the picture
    const p = project(t, t, YAW0, PITCH, 15, 16 / 9);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('fits every point inside the asked share of the view', () => {
    const pts: P3[] = [
      { x: 2, y: 0, z: 3 },
      { x: 9, y: 0, z: 5 },
      { x: 5, y: 1.5, z: 1 },
      { x: 4, y: 0.2, z: 8 },
    ];
    const c = { x: 5, y: 0.4, z: 4 };
    for (const aspect of [16 / 9, 390 / 844]) {
      const d = fitDistance(pts, c, YAW0, PITCH, aspect, 0.8);
      let worst = 0;
      for (const p of pts) {
        const s = project(p, c, YAW0, PITCH, d, aspect);
        expect(s.z).toBeGreaterThan(0);
        worst = Math.max(worst, Math.abs(s.x), Math.abs(s.y));
      }
      // inside, and tight (some point touches the edge of the share)
      expect(worst).toBeLessThanOrEqual(0.8 + 1e-6);
      expect(worst).toBeGreaterThan(0.79);
    }
  });

  it('rests so that a person is a readable size, closer on a phone than its height alone asks', () => {
    const desk = restDistance(1600, 900);
    const phone = restDistance(390, 844);
    expect(desk).toBeGreaterThan(5);
    expect(desk).toBeLessThan(40);
    // a grown-up (0.75 tall) about a ninth of a laptop's stage high, and about 60 px on a phone
    const tall = (d: number, h: number) => (0.75 * Math.cos(PITCH) * h) / (2 * Math.tan((FOV * Math.PI) / 360) * d);
    const laptop = restDistance(1224, 672);
    expect(tall(laptop, 672)).toBeGreaterThan(70);
    expect(tall(laptop, 672)).toBeLessThan(80);
    expect(tall(phone, 844)).toBeGreaterThan(55);
    expect(tall(phone, 844)).toBeLessThan(65);
    expect(tall(desk, 900)).toBeLessThanOrEqual(100.01);
    expect(Number.isFinite(phone)).toBe(true);
    expect(restDistance(0, 0)).toBeGreaterThan(0);
  });

  it('keeps the target over the island', () => {
    const size = 44;
    const d = restDistance(1600, 900);
    const e = groundHalfExtent(d, PITCH, 16 / 9);
    expect(e.deep).toBeGreaterThan(e.across / 2);
    const c = clampToIsland({ x: -5, y: 0, z: 60 }, size, d, PITCH, 16 / 9);
    expect(c.x).toBeGreaterThan(0);
    expect(c.z).toBeLessThan(size);
    // the middle of the island stays where it is
    expect(clampToIsland({ x: 22, y: 0, z: 22 }, size, d, PITCH, 16 / 9)).toEqual({ x: 22, y: 0, z: 22 });
    // a tiny island: the target goes to its middle
    const tiny = clampToIsland({ x: 0, y: 0, z: 0 }, 4, 40, PITCH, 1);
    expect(tiny.x).toBeCloseTo(2);
    expect(tiny.z).toBeCloseTo(2);
  });

  it('turns the keys with the camera: up = away from it on the screen, right = screen right, diagonals of length 1', () => {
    const none = { up: false, down: false, left: false, right: false };
    const up = keyDirection({ ...none, up: true }, YAW0)!;
    expect(up.x).toBeCloseTo(-Math.SQRT1_2, 9);
    expect(up.y).toBeCloseTo(-Math.SQRT1_2, 9);
    const right = keyDirection({ ...none, right: true }, YAW0)!;
    // screen right of the basis, on the ground (x, z)
    const b = basisOf(YAW0, PITCH);
    expect(right.x).toBeCloseTo(b.right.x, 9);
    expect(right.y).toBeCloseTo(b.right.z, 9);
    const diag = keyDirection({ ...none, up: true, right: true }, YAW0)!;
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1, 9);
    expect(diag.x).toBeCloseTo(0, 9);
    expect(diag.y).toBeCloseTo(-1, 9);
    expect(keyDirection(none, YAW0)).toBeNull();
    expect(keyDirection({ ...none, left: true, right: true }, YAW0)).toBeNull();
    // the camera turned: up is still away from it
    const yaw = YAW0 + 0.7;
    const away = keyDirection({ ...none, up: true }, yaw)!;
    expect(away.x).toBeCloseTo(-Math.cos(yaw), 9);
    expect(away.y).toBeCloseTo(-Math.sin(yaw), 9);
  });

  it('follows the player: in the middle of the island exactly, held back only a little at its edge', () => {
    const d = restDistance(1224, 672);
    const mid = followPoint({ x: 20, z: 21 }, { x: 0, z: 0 }, 44, d, PITCH, 1224 / 672);
    expect(mid).toEqual({ x: 20, y: 0.3, z: 21 });
    // walking: a little ahead of them
    const ahead = followPoint({ x: 20, z: 21 }, { x: 1.6, z: 0 }, 44, d, PITCH, 1224 / 672);
    expect(ahead.x).toBeCloseTo(20 + 1.6 * FOLLOW_LEAD, 9);
    // at the very edge: never more than EDGE_HOLD off
    const edge = followPoint({ x: 1, z: 1 }, { x: 0, z: 0 }, 44, d, PITCH, 1224 / 672);
    expect(Math.hypot(edge.x - 1, edge.z - 1)).toBeLessThanOrEqual(EDGE_HOLD + 1e-9);
  });

  it('a walk and a stop: the follow spring keeps the walker near the middle and never overshoots', () => {
    // a run at 2.8 tiles/s, up to pace in 0.09 s, a stop in 0.07 s; 60 frames a second
    let p = 0;
    let pv = 0;
    let c = 0;
    let cv = 0;
    // the pace as the engine reads it (smoothed at 40/s)
    let ps = 0;
    let most = 0;
    let past = 0;
    const dt = 1 / 60;
    for (let t = 0; t < 3; t += dt) {
      const want = t < 1.5 ? 2.8 : 0;
      pv = pv < want ? Math.min(want, pv + (2.8 / 0.09) * dt) : Math.max(want, pv - (2.8 / 0.07) * dt);
      p += pv * dt;
      ps += (pv - ps) * (1 - Math.exp(-40 * dt));
      [c, cv] = springStep(c, cv, p + ps * FOLLOW_LEAD, FOLLOW_W, dt);
      most = Math.max(most, Math.abs(p - c));
      if (t > 1.5) past = Math.max(past, c - p);
    }
    // about a tenth of a second behind at most (0.3 tile at a run: a few hundredths of a laptop's stage)
    expect(most).toBeLessThan(0.3);
    // (a ten-thousandth of a tile is a hundredth of a pixel)
    expect(past).toBeLessThan(1e-4);
  });

  it('centres in what panels and buttons leave free', () => {
    expect(insetShift(1600, 900, { right: 0, bottom: 0 }, { top: 0, right: 0, bottom: 0, left: 0 })).toEqual({ x: 0, y: 0 });
    expect(insetShift(1600, 900, { right: 400, bottom: 0 }, { top: 60, right: 0, bottom: 80, left: 0 })).toEqual({ x: -200, y: -10 });
    // never more than half the view less 60 px
    expect(insetShift(400, 300, { right: 2000, bottom: 0 }, { top: 0, right: 0, bottom: 0, left: 0 }).x).toBe(-140);
  });

  it('clamps the learner’s zoom and turn', () => {
    let z = 1;
    for (let i = 0; i < 100; i++) z = zoomAfter(z, { wheel: 200 });
    expect(z).toBe(ZOOM_MAX);
    for (let i = 0; i < 100; i++) z = zoomAfter(z, { pinch: 1.5 });
    expect(z).toBe(ZOOM_MIN);
    expect(zoomAfter(1, { wheel: -100 })).toBeLessThan(1);
    expect(zoomAfter(1, { pinch: 2 })).toBeCloseTo(Math.max(ZOOM_MIN, 0.5));
    // the turn has no stop: a long drag goes all the way round (and on), and back the same way
    let y = YAW0;
    const round = (2 * Math.PI) / YAW_PER_PX;
    for (let i = 0; i < 100; i++) y = yawAfter(y, round / 100);
    expect(y).toBeCloseTo(YAW0 - 2 * Math.PI);
    expect(Math.cos(y)).toBeCloseTo(Math.cos(YAW0));
    for (let i = 0; i < 300; i++) y = yawAfter(y, -round / 200);
    expect(y).toBeCloseTo(YAW0 + Math.PI);
  });
});

describe('a narrow stage follows more stiffly', () => {
  it('a phone gets FOLLOW_W_NARROW and a shorter lead; a run lags a third less there', () => {
    expect(followStiffness(1224)).toBe(FOLLOW_W);
    expect(followStiffness(390)).toBe(FOLLOW_W_NARROW);
    expect(followLead(FOLLOW_W)).toBe(FOLLOW_LEAD);
    expect(followLead(FOLLOW_W_NARROW)).toBeCloseTo(0.8 / FOLLOW_W_NARROW);
    // steady lag behind a runner of a critically damped follow with a lead: v (2/w − lead)
    const lag = (w: number) => 2.8 * (2 / w - followLead(w));
    expect(lag(FOLLOW_W_NARROW)).toBeLessThan(lag(FOLLOW_W) * 0.66);
  });
});
