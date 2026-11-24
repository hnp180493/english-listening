// Trees, bushes, grass tufts and flowers of the 3D town: a handful of shapes drawn many times each (instancing),
// swaying gently in the wind (materials.ts `sway`; none under reduced motion). Each kind is drawn per CELL × CELL
// tiles of the map (one instanced mesh each), so the camera and the shadow pass skip what they do not see: since the
// countryside grew round the town (72 × 72 tiles, 2026-11-22) most of the trees are far from the player.

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
  } else if (kind === 'palm') {
    palmParts(m);
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

/** A palm: a ringed trunk leaning towards +x, a crown of drooping fronds (two greens) and coconuts. About 1.8 tall. */
function palmParts(m: Merge): void {
  const H = 1.7;
  const lean = 0.34;
  const N = 7;
  const pt = (t: number): [number, number] => [lean * t * t, H * t];
  for (let k = 0; k < N; k++) {
    const [x0, y0] = pt(k / N);
    const [x1, y1] = pt((k + 1) / N);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const r0 = 0.15 - 0.07 * (k / N);
    const r1 = 0.15 - 0.07 * ((k + 1) / N);
    m.add(shapes.cyl(r1, r0, Math.hypot(dx, dy) * 1.04, 8), k % 2 ? C.palmRing : C.palmTrunk, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rz: -Math.atan2(dx, dy) }, { ao: k === 0 });
  }
  const [tx, ty] = pt(1);
  const FR = 8;
  for (let f = 0; f < FR; f++) {
    const a = (f / FR) * Math.PI * 2 + 0.3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const col = f % 2 ? C.palmLeaf : C.palmLeafDeep;
    // a frond: leaf-shaped flat blobs along an arc that rises, then bends down
    let px = 0;
    let py = 0;
    let ang = 0.5 - (f % 3) * 0.12;
    const segs = 4;
    for (let s = 0; s < segs; s++) {
      const L = 0.2;
      const nx = px + Math.cos(ang) * L;
      const ny = py + Math.sin(ang) * L;
      const size = 0.13 - s * 0.012;
      const mx = (px + nx) / 2;
      const my = (py + ny) / 2;
      // placed in the frond's own plane (local x outwards, y up), then turned about Y to its direction
      m.add(shapes.sphere(size, 6, 4), col, { x: tx + ca * mx, y: ty + my + 0.02, z: -sa * mx, ry: a, rz: ang, s: [1.5, 0.16, 0.8] }, { ao: false });
      px = nx;
      py = ny;
      ang -= 0.42;
    }
  }
  m.add(shapes.sphere(0.07, 6, 4), C.palmLeaf, { x: tx, y: ty + 0.04 }, { ao: false });
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + 0.4;
    m.add(shapes.sphere(0.06, 6, 5), C.coconut, { x: tx + Math.cos(a) * 0.09, y: ty - 0.07, z: Math.sin(a) * 0.09 }, { ao: false });
  }
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

/** Tiles per side of a cell of nature (one instanced mesh per kind per cell, culled as a whole). */
export const CELL = 12;

/** The items grouped by the cell of the map they stand in. */
export function byCell<T extends { x: number; z: number }>(items: readonly T[]): T[][] {
  const cells = new Map<string, T[]>();
  for (const it of items) {
    const k = `${Math.floor(it.x / CELL)},${Math.floor(it.z / CELL)}`;
    let list = cells.get(k);
    if (!list) cells.set(k, (list = []));
    list.push(it);
  }
  return [...cells.values()];
}

/** How high the ground is under a point (the hill: data/townWorld.ts groundHeight); flat when not given. */
export type Lift = (x: number, z: number) => number;
const FLAT: Lift = () => 0;

/** One instanced mesh per kind of tree and cell of the map, each tree a little different (size, turn, colour), standing on the ground. */
export function buildTrees(spots: readonly TreeSpot[], mats: Materials, castShadow = true, lift: Lift = FLAT): Nature {
  const group = new Group();
  group.name = 'trees';
  const geos: BufferGeometry[] = [];
  const kinds: TreeSpot['kind'][] = ['round', 'pine', 'bush', 'blossom', 'palm'];
  for (const kind of kinds) {
    const all = spots.filter((s) => s.kind === kind);
    if (all.length === 0) continue;
    const geo = treeGeometry(kind);
    geos.push(geo);
    for (const list of byCell(all)) {
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
  const make = (geo: BufferGeometry, all: readonly Tuft[], tint: (t: Tuft) => Color) => {
    if (all.length === 0) return;
    geos.push(geo);
    for (const items of byCell(all)) {
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
    }
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
