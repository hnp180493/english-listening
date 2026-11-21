import { describe, expect, it } from 'vitest';
import { DirectionalLight, Vector3 } from 'three';
import { SUN_DIR, shadowCenter } from './world3d';

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
});
