import { describe, expect, it } from 'vitest';
import { DirectionalLight, Vector3 } from 'three';
import { SUN_DIR, lightBasis, shadowCenter, type LightBasis } from './world3d';
import { angleDeg, stepSun, sunAt } from '../../../../core/town/sunPath';

describe('the sun shadow box follows the camera in whole texels of its own view', () => {
  it('a point on the ground lands on the same spot within a shadow texel wherever the box is (no crawling shadows)', () => {
    const texel = 30 / 2048;
    const light = new DirectionalLight();
    const ground = new Vector3(3.3, 0, 7.1);
    const fracs: Array<[number, number]> = [];
    for (let i = 0; i < 40; i++) {
      // a camera gliding along with a walker, a little each frame
      const at = { x: 10 + i * 0.0271, z: 12 + i * 0.0193 };
      const c = shadowCenter(at, texel);
      light.position.set(c.x + SUN_DIR.x * 30, c.y + SUN_DIR.y * 30, c.z + SUN_DIR.z * 30);
      light.target.position.set(c.x, c.y, c.z);
      light.updateMatrixWorld();
      light.target.updateMatrixWorld();
      light.shadow.camera.position.setFromMatrixPosition(light.matrixWorld);
      light.shadow.camera.lookAt(light.target.position);
      light.shadow.camera.updateMatrixWorld();
      const p = ground.clone().applyMatrix4(light.shadow.camera.matrixWorldInverse);
      const f = (v: number) => ((v / texel) % 1 + 1) % 1;
      fracs.push([f(p.x), f(p.y)]);
      // the box stays centred on the view within a texel
      expect(Math.hypot(c.x - at.x, c.z - at.z)).toBeLessThan(texel * 2);
    }
    for (const [fx, fy] of fracs) {
      const d = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
      expect(d(fx, fracs[0][0])).toBeLessThan(1e-3);
      expect(d(fy, fracs[0][1])).toBeLessThan(1e-3);
    }
  });

  /** Where a ground point falls in shadow texels for a light held at `basis`, the box following `at`. */
  const texelsOf = (basis: LightBasis, at: { x: number; z: number }, ground: Vector3, texel: number, texelUp: number): [number, number] => {
    const light = new DirectionalLight();
    const c = shadowCenter(at, texel, basis, texelUp);
    light.position.set(c.x + basis.dir.x * 30, c.y + basis.dir.y * 30, c.z + basis.dir.z * 30);
    light.target.position.set(c.x, c.y, c.z);
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
    light.shadow.camera.position.setFromMatrixPosition(light.matrixWorld);
    light.shadow.camera.lookAt(light.target.position);
    light.shadow.camera.updateMatrixWorld();
    const p = ground.clone().applyMatrix4(light.shadow.camera.matrixWorldInverse);
    return [p.x / texel, p.y / texelUp];
  };
  const frac = (v: number) => ((v % 1) + 1) % 1;
  const near = (a: number, b: number) => Math.min(Math.abs(frac(a) - frac(b)), 1 - Math.abs(frac(a) - frac(b)));

  it('with a moving sun: between its small steps the snapping holds for every direction of the day', () => {
    const texel = 30 / 2048;
    const ground = new Vector3(-4.2, 0, 9.7);
    for (let h = 0; h < 24; h += 0.37) {
      const basis = lightBasis(sunAt(h).dir);
      // the basis is the light's own: right and up are unit, at right angles, and both at right angles to the light
      const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z;
      expect(Math.abs(dot(basis.right, basis.up))).toBeLessThan(1e-9);
      expect(Math.abs(dot(basis.right, basis.dir))).toBeLessThan(1e-9);
      expect(Math.abs(dot(basis.up, basis.dir))).toBeLessThan(1e-9);
      // (the box is shorter along the light's up axis when the sun is low: its own texel there)
      const texelUp = texel * Math.min(1, basis.dir.y + 0.1);
      const first = texelsOf(basis, { x: 20, z: 15 }, ground, texel, texelUp);
      for (let i = 1; i < 30; i++) {
        const at = { x: 20 + i * 0.0311, z: 15 - i * 0.0173 };
        const [u, v] = texelsOf(basis, at, ground, texel, texelUp);
        expect(near(u, first[0])).toBeLessThan(1e-3);
        expect(near(v, first[1])).toBeLessThan(1e-3);
        const c = shadowCenter(at, texel, basis, texelUp);
        expect(Math.hypot(c.x - at.x, c.z - at.z)).toBeLessThan(texel * 2);
      }
    }
  });

  it('the light is re-aimed in steps of a fraction of a degree, a step every few real seconds, never every frame', () => {
    // two real minutes of frames at 60 a second, from 09:00 of the game (an hour of the game is two real minutes)
    let held = lightBasis(sunAt(9).dir);
    let steps = 0;
    let still = 0;
    let longest = 0;
    let worst = 0;
    for (let f = 0; f < 120 * 60; f++) {
      const want = sunAt(9 + f / (60 * 120)).dir;
      const next = stepSun(held.dir, want);
      if (next !== held.dir) {
        held = lightBasis(next);
        steps++;
        longest = Math.max(longest, still);
        still = 0;
      } else still++;
      worst = Math.max(worst, angleDeg(held.dir, want));
    }
    expect(worst).toBeLessThan(0.3);
    // the sun turns about 15 degrees an hour of the game: some 50 steps, each held for over a hundred frames
    expect(steps).toBeGreaterThan(20);
    expect(steps).toBeLessThan(120);
    expect(longest).toBeGreaterThan(100);
  });
});

