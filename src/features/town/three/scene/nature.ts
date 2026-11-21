// Trees, bushes, grass tufts and flowers of the 3D town: a handful of shapes drawn many times each (instancing),
// swaying gently in the wind (materials.ts `sway`; none under reduced motion).

import { Color, Group, InstancedMesh, Object3D, type BufferGeometry } from 'three';
import type { TreeSpot, Tuft } from './layout';
import type { Materials } from './materials';
import { Merge, shadeColor, shapes } from './merge';
import { C, FLOWERS } from './palette3d';

/** The shape of each kind of tree, its origin at the foot of the trunk. */
export function treeGeometry(kind: TreeSpot['kind']): BufferGeometry {
  const m = new Merge();
  if (kind === 'pine') {
    m.add(shapes.cyl(0.06, 0.09, 0.42, 8), C.trunk, { y: 0.21 });
    const tiers: [number, number, number][] = [
      [0.46, 0.52, 0.5],
      [0.37, 0.46, 0.8],
      [0.26, 0.4, 1.07],
    ];
    tiers.forEach(([r, h, y], i) => m.add(shapes.cone(r, h, 10), i === 1 ? C.pine : C.pineDeep, { y, ry: i * 0.4 }, { top: C.pine, shade: i * 0.05 }));
  } else if (kind === 'bush') {
    m.add(shapes.sphere(0.27, 10, 7), C.leafDeep, { y: 0.2, s: [1, 0.85, 1] }, { top: C.leaf });
    m.add(shapes.sphere(0.2, 10, 7), C.leafDeep, { x: 0.2, y: 0.15, z: 0.08, s: [1, 0.85, 1] }, { top: C.leaf });
    m.add(shapes.sphere(0.18, 10, 7), C.leafDeep, { x: -0.12, y: 0.14, z: 0.18, s: [1, 0.85, 1] }, { top: C.leaf });
  } else {
    const crown = kind === 'blossom' ? C.blossom : C.leafDeep;
    const top = kind === 'blossom' ? '#ffd9e6' : C.leaf;
    m.add(shapes.cyl(0.07, 0.1, 0.62, 8), C.trunk, { y: 0.31 });
    m.add(shapes.cyl(0.035, 0.05, 0.3, 6), C.trunk, { x: 0.1, y: 0.62, rz: -0.6 });
    m.add(shapes.sphere(0.44, 11, 8), crown, { y: 0.95 }, { top });
    m.add(shapes.sphere(0.3, 10, 7), crown, { x: 0.28, y: 0.82, z: 0.1 }, { top });
    m.add(shapes.sphere(0.28, 10, 7), crown, { x: -0.22, y: 0.8, z: 0.2 }, { top });
    m.add(shapes.sphere(0.26, 10, 7), crown, { x: 0.05, y: 1.22, z: -0.08 }, { top });
    if (kind === 'blossom') {
      // a few white flowers in the crown
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        m.add(shapes.sphere(0.05, 6, 4), '#ffffff', { x: Math.cos(a) * 0.4, y: 0.95 + Math.sin(i * 1.7) * 0.25, z: Math.sin(a) * 0.4 }, { ao: false });
      }
    }
  }
  return m.build()!;
}

function tuftGeometry(): BufferGeometry {
  const m = new Merge();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    m.add(shapes.cone(0.03, 0.17, 4), i % 2 ? C.grassLight : C.grass, { x: Math.cos(a) * 0.04, y: 0.07, z: Math.sin(a) * 0.04, rx: Math.sin(a) * 0.35, rz: -Math.cos(a) * 0.35 }, { ao: false });
  }
  return m.build()!;
}

function flowerGeometry(): BufferGeometry {
  const m = new Merge();
  m.add(shapes.cyl(0.008, 0.01, 0.12, 4), C.leafDeep, { y: 0.06 }, { ao: false });
  m.add(shapes.cyl(0.06, 0.05, 0.025, 5), '#ffffff', { y: 0.125 }, { ao: false });
  m.add(shapes.sphere(0.024, 5, 3), '#ffd54a', { y: 0.14 }, { ao: false });
  return m.build()!;
}

export interface Nature {
  group: Group;
  dispose: () => void;
}

const o = new Object3D();

/** How high the ground is under a point (the hill: data/townWorld.ts groundHeight); flat when not given. */
export type Lift = (x: number, z: number) => number;
const FLAT: Lift = () => 0;

/** One instanced mesh per kind of tree, each tree a little different (size, turn, colour), standing on the ground. */
export function buildTrees(spots: readonly TreeSpot[], mats: Materials, castShadow = true, lift: Lift = FLAT): Nature {
  const group = new Group();
  group.name = 'trees';
  const geos: BufferGeometry[] = [];
  const kinds: TreeSpot['kind'][] = ['round', 'pine', 'bush', 'blossom'];
  for (const kind of kinds) {
    const list = spots.filter((s) => s.kind === kind);
    if (list.length === 0) continue;
    const geo = treeGeometry(kind);
    geos.push(geo);
    const inst = new InstancedMesh(geo, mats.sway, list.length);
    list.forEach((s, i) => {
      o.position.set(s.x, lift(s.x, s.z), s.z);
      o.rotation.set(0, s.seed * Math.PI * 2, 0);
      o.scale.setScalar(s.scale);
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
      const c = new Color('#ffffff');
      shadeColor(c, -s.seed * 0.18);
      if (kind === 'round') c.lerp(new Color(s.seed > 0.6 ? '#e8ffd0' : '#d8f0ff'), 0.25);
      inst.setColorAt(i, c);
    });
    inst.castShadow = castShadow;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }
  return {
    group,
    dispose: () => {
      for (const g of geos) g.dispose();
      group.children.forEach((c) => (c as InstancedMesh).dispose());
    },
  };
}

/** Grass tufts and little flowers on the free grass. */
export function buildTufts(list: readonly Tuft[], mats: Materials, lift: Lift = FLAT): Nature {
  const group = new Group();
  group.name = 'tufts';
  const geos: BufferGeometry[] = [];
  const grass = list.filter((t) => t.kind === 'grass');
  const flowers = list.filter((t) => t.kind === 'flower');
  const make = (geo: BufferGeometry, items: readonly Tuft[], tint: (t: Tuft) => Color) => {
    if (items.length === 0) return;
    geos.push(geo);
    const inst = new InstancedMesh(geo, mats.sway, items.length);
    items.forEach((t, i) => {
      o.position.set(t.x, lift(t.x, t.z), t.z);
      o.rotation.set(0, t.rot, 0);
      o.scale.setScalar(t.s);
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
      inst.setColorAt(i, tint(t));
    });
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
  };
  make(tuftGeometry(), grass, (t) => shadeColor(new Color('#ffffff'), (t.s - 1) * 0.4));
  make(flowerGeometry(), flowers, (t) => new Color(FLOWERS[t.c % FLOWERS.length]));
  return {
    group,
    dispose: () => {
      for (const g of geos) g.dispose();
      group.children.forEach((c) => (c as InstancedMesh).dispose());
    },
  };
}
