// Birds over the town and the city (owner, 2026-11-26: "đồ hoạ … giờ hơi đơn điệu"): two small flocks in a loose V,
// circling high over where the camera looks, wings beating then gliding; home before dark. One instanced mesh (a
// dozen birds, 24 triangles each): next to nothing a frame.

import { InstancedMesh, Matrix4, Object3D, type BufferGeometry, type Material } from 'three';
import { Merge, shapes } from './merge';

const FLOCKS = 2;
const PER_FLOCK = 6;

/** A bird: two thin wings in a shallow V and a small body, seen from below or from the side. */
function birdGeometry(): BufferGeometry {
  const m = new Merge();
  const ink = '#3a3d4a';
  for (const s of [-1, 1]) m.add(shapes.box(0.07, 0.012, 0.2, 0.004, 1), ink, { x: 0, y: 0.02, z: s * 0.1, rx: s * 0.35 }, { ao: false });
  m.add(shapes.box(0.12, 0.03, 0.035, 0.012, 1), ink, { x: 0.01, y: 0, z: 0 }, { ao: false });
  return m.build()!;
}

export class Birds {
  readonly mesh: InstancedMesh;
  private readonly geo: BufferGeometry;
  private readonly o = new Object3D();
  private readonly m = new Matrix4();
  /** Where each flock circles (it drifts after the camera's target, slowly). */
  private readonly centres: { x: number; z: number }[] = [];

  constructor(material: Material) {
    this.geo = birdGeometry();
    this.mesh = new InstancedMesh(this.geo, material, FLOCKS * PER_FLOCK);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'birds';
  }

  /**
   * Each frame: `t` seconds, the point the camera looks at (tile grid: x, z), `night` 0 … 1 (none after dusk),
   * `still` (reduced motion: they hold still in the sky).
   */
  update(t: number, target: { x: number; z: number }, night: number, still: boolean, dt: number): void {
    this.mesh.visible = night < 0.55;
    if (!this.mesh.visible) return;
    for (let f = 0; f < FLOCKS; f++) {
      const c = (this.centres[f] ??= { x: target.x + (f ? 6 : -5), z: target.z + (f ? -4 : 5) });
      // the flock's circle drifts after the view (a minute to catch up)
      const k = Math.min(1, dt / 60);
      c.x += (target.x + (f ? 6 : -5) - c.x) * k;
      c.z += (target.z + (f ? -4 : 5) - c.z) * k;
      const r = f ? 11 : 8;
      const speed = f ? -0.11 : 0.14;
      const a = (still ? 0 : t * speed) + f * 2.1;
      const h = f ? 7.5 : 6;
      // the way the flock flies: along the circle
      const heading = a + (speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      for (let i = 0; i < PER_FLOCK; i++) {
        // a loose V behind the leader: rows of two
        const row = Math.ceil(i / 2);
        const side = i === 0 ? 0 : i % 2 ? 1 : -1;
        const back = row * 0.55;
        const across = side * row * 0.45;
        const bx = c.x + Math.cos(a) * r - Math.cos(heading) * back - Math.sin(heading) * across;
        const bz = c.z + Math.sin(a) * r - Math.sin(heading) * back + Math.cos(heading) * across;
        // beating then gliding, each bird a little out of step
        const beat = still ? 0 : Math.max(0, Math.sin(t * 1.3 + f + i * 0.4)) * Math.sin(t * 11 + i * 1.7);
        this.o.position.set(bx, h + Math.sin(t * 0.7 + i) * 0.15, bz);
        this.o.rotation.set(beat * 0.5, -heading, 0, 'YXZ');
        this.o.scale.setScalar(1.6);
        this.o.updateMatrix();
        this.m.copy(this.o.matrix);
        this.mesh.setMatrixAt(f * PER_FLOCK + i, this.m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
  }
}
