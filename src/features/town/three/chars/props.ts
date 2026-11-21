// Things people hold: a cup, a watering can (with drops), a fishing rod (with a line and a bobber) and a book.
// Prop space: origin at the grip, +Y up, +Z forward. Geometries are shared by everybody (built once).

import { Color, type BufferGeometry, Group, Mesh, type Material, Object3D, Quaternion, Vector3 } from 'three';
import { cylinder, FULL, GeoBuilder, lathe, mat, roundBox, smoothProfile, sphere, taperBetween, torus } from './build';

export type PropId = 'cup' | 'can' | 'rod' | 'book';

const geos = new Map<string, BufferGeometry>();

function geo(key: string, make: (b: GeoBuilder) => void): BufferGeometry {
  let g = geos.get(key);
  if (!g) {
    const b = new GeoBuilder();
    make(b);
    g = b.build(false);
    geos.set(key, g);
  }
  return g;
}

const d = FULL;

const cupGeo = () =>
  geo('cup', (b) => {
    const c = new Color('#f4efe6');
    b.add(lathe(smoothProfile([[0.0, -0.03], [0.026, -0.03], [0.03, -0.02], [0.033, 0.03], [0.029, 0.032]], 3), 18), mat(), c);
    b.add(cylinder(0.028, 0.028, 0.004, d), mat([0, 0.026, 0]), new Color('#7a4a32'));
    b.add(torus(0.016, 0.005, d, Math.PI * 1.3), mat([0.033, 0.002, 0], [0, 0, -Math.PI * 0.65]), c);
    b.add(cylinder(0.0335, 0.0335, 0.012, d, true), mat([0, 0.0, 0]), new Color('#e88a7a'));
  });

const canGeo = () =>
  geo('can', (b) => {
    const c = new Color('#7cc3d6');
    b.add(lathe(smoothProfile([[0, -0.05], [0.045, -0.05], [0.05, -0.03], [0.05, 0.03], [0.04, 0.045], [0, 0.048]], 3), 20), mat([0, 0, 0.02]), c);
    taperBetween(b, [0, -0.005, 0.06], [0, 0.04, 0.15], 0.012, 0.008, new Color('#6ab0c4'), {}, d);
    b.add(lathe(smoothProfile([[0.006, 0], [0.02, 0.01], [0.022, 0.02], [0, 0.021]], 2), 12), mat([0, 0.04, 0.152], [0.9, 0, 0]), new Color('#5a9fb3'));
    b.add(torus(0.035, 0.008, d, Math.PI), mat([0, 0.045, 0.02], [0, Math.PI / 2, 0]), new Color('#5a9fb3'));
  });

const dropGeo = () => geo('drop', (b) => b.add(sphere(0.008, d, 8, 6), mat([0, 0, 0], [0, 0, 0], [1, 1.4, 1]), new Color('#bfe8ff')));

const rodGeo = () =>
  geo('rod', (b) => {
    // long and dark enough to read against the water from the town's camera (a thin short rod vanished)
    taperBetween(b, [0, -0.05, 0], [0, 0.07, 0], 0.016, 0.015, new Color('#c9905e'), {}, d);
    taperBetween(b, [0, 0.07, 0], [0, ROD_LENGTH, 0], 0.012, 0.005, new Color('#5e3f26'), {}, d);
    b.add(cylinder(0.026, 0.026, 0.02, d), mat([0.026, 0.02, 0], [0, 0, Math.PI / 2]), new Color('#b8c0c8'));
  });

/** The rod's length (design units, grip to tip). */
const ROD_LENGTH = 0.9;

const lineGeo = () => geo('line', (b) => b.add(cylinder(0.004, 0.004, 1, { seg: 0.5 }), mat([0, -0.5, 0]), new Color('#f4f4f4')));
const bobberGeo = () =>
  geo('bobber', (b) => {
    b.add(sphere(0.026, d, 10, 8), mat([0, 0.006, 0], [0, 0, 0], [1, 0.9, 1]), new Color('#e8574f'));
    b.add(sphere(0.025, d, 10, 8), mat([0, -0.006, 0], [0, 0, 0], [1, 0.9, 1]), new Color('#fafafa'));
  });

const bookGeo = () =>
  geo('book', (b) => {
    const cover = new Color('#d9685a');
    const page = new Color('#fbf6ea');
    for (const side of [1, -1]) {
      b.add(roundBox(0.085, 0.11, 0.008, 0.25, d), mat([side * 0.044, 0, 0], [0, side * -0.25, 0]), cover);
      b.add(roundBox(0.078, 0.1, 0.012, 0.3, d), mat([side * 0.042, 0, 0.007], [0, side * -0.25, 0]), page);
    }
  });

export interface PropRig {
  root: Object3D;
  /** Animate inner parts (drops, line). */
  tick(dt: number, extra: number): void;
  /** The rod only: run the line from the tip straight to this world point (a cast float on the water), or hang it (null). */
  aim?(point: Vector3 | null): void;
}

const _tipAt = new Vector3();
const _toward = new Vector3();
const _scale = new Vector3();
const _undo = new Quaternion();
const DOWN = new Vector3(0, -1, 0);

/** Build a prop (meshes share the given material). */
export function makeProp(id: PropId, material: Material): PropRig {
  const root = new Group();
  root.name = `prop-${id}`;
  const add = (g: BufferGeometry, parent: Object3D = root) => {
    const m = new Mesh(g, material);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  if (id === 'cup') {
    add(cupGeo()).scale.setScalar(1.45);
    return { root, tick: () => {} };
  }
  if (id === 'book') {
    add(bookGeo()).scale.setScalar(1.3);
    return { root, tick: () => {} };
  }
  if (id === 'can') {
    add(canGeo());
    const drops: Mesh[] = [];
    const spout = new Group();
    spout.position.set(0, 0.045, 0.165);
    root.add(spout);
    for (let i = 0; i < 4; i++) drops.push(add(dropGeo(), spout));
    let t = 0;
    return {
      root,
      tick(dt, tilt) {
        t += dt;
        const on = tilt > 0.35;
        drops.forEach((m, i) => {
          const k = (t * 1.6 + i / drops.length) % 1;
          m.visible = on;
          // fall "down" in can space: forward and down along the tilt
          m.position.set(0, -k * 0.16, k * 0.03);
          m.scale.setScalar(1 - k * 0.4);
        });
      },
    };
  }
  // rod: the line hangs from the tip straight down in the world (re-aimed every frame), with a bobber
  add(rodGeo());
  const tip = new Group();
  tip.position.set(0, ROD_LENGTH, 0);
  root.add(tip);
  const hang = new Group();
  tip.add(hang);
  const line = add(lineGeo(), hang);
  const bob = add(bobberGeo(), hang);
  let t = 0;
  let cast: Vector3 | null = null;
  return {
    root,
    aim(point) {
      cast = point;
    },
    tick(dt, tug) {
      t += dt;
      if (cast) {
        // the line straight out to the float on the water (the float is the town's own, in the world)
        tip.updateWorldMatrix(true, false);
        tip.getWorldPosition(_tipAt);
        _toward.copy(cast).sub(_tipAt);
        const far = _toward.length();
        tip.getWorldQuaternion(_undo).invert();
        _toward.applyQuaternion(_undo).normalize();
        hang.quaternion.setFromUnitVectors(DOWN, _toward);
        tip.getWorldScale(_scale);
        line.scale.set(1, far / Math.max(1e-4, _scale.y), 1);
        bob.visible = false;
        return;
      }
      bob.visible = true;
      // keep the line vertical: undo the tip's world rotation
      tip.updateWorldMatrix(true, false);
      tip.getWorldQuaternion(hang.quaternion).invert();
      // the line's length in the tip's (scaled) space: about 0.5 design units, longer on a tug
      const len = 0.5 + 0.06 * tug + 0.01 * Math.sin(t * 2.1);
      line.scale.set(1, len, 1);
      bob.position.set(0.01 * Math.sin(t * 1.3), -len - 0.015, 0);
    },
  };
}

export function disposeProps(): void {
  for (const g of geos.values()) g.dispose();
  geos.clear();
}
