// New street furniture, PROPOSED (owner, 2026-11-26: "đồ đạc cũng đa dạng khác biệt lên"): benches of four kinds, two
// more lamps, bins, a bike rack, a post box, crates and barrels, flower pots, a hydrant, a newspaper box, a picnic
// table. Built in code in the town's style (Merge + palette3d), shown only on the admin page's preview
// (features/admin/LookPreview.tsx, via ../thumbs.ts renderFurniture) until the owner says which go into the town.

import type { BufferGeometry } from 'three';
import { LAMP_HEIGHT } from './layout';
import { Merge, shapes } from './merge';
import { C } from './palette3d';
import { SEAT_TOP } from './props3d';

export const FURNITURE_IDS = [
  'bench-park',
  'bench-stone',
  'bench-log',
  'bench-picnic',
  'lamp-lantern',
  'lamp-globes',
  'bins',
  'bike-rack',
  'postbox',
  'crates',
  'pots',
  'hydrant',
  'news-box',
] as const;
export type FurnitureId = (typeof FURNITURE_IDS)[number];

/** Vietnamese names for the preview. */
export const FURNITURE_NAMES: Readonly<Record<FurnitureId, string>> = {
  'bench-park': 'Ghế công viên tay vịn sắt',
  'bench-stone': 'Ghế đá',
  'bench-log': 'Ghế khúc gỗ',
  'bench-picnic': 'Bàn ghế dã ngoại',
  'lamp-lantern': 'Đèn lồng phố cổ',
  'lamp-globes': 'Đèn hai bóng tròn',
  bins: 'Thùng rác và thùng tái chế',
  'bike-rack': 'Giá để xe đạp',
  postbox: 'Hòm thư đỏ',
  crates: 'Thùng gỗ và thùng tô nô',
  pots: 'Chậu hoa',
  hydrant: 'Trụ cứu hỏa',
  'news-box': 'Hộp báo',
};

export interface FurnitureModel {
  body: BufferGeometry | null;
  bulbs: BufferGeometry | null;
  sway: BufferGeometry | null;
}

const GREEN_IRON = '#3f6b55';
const seat = SEAT_TOP - 0.025;

function benchPark(m: Merge): void {
  // three slats on the seat, two on the back, cast-iron sides with arms
  for (let i = 0; i < 3; i++) m.add(shapes.box(0.78, 0.035, 0.07, 0.012, 1), C.woodLight, { y: seat, z: -0.08 + i * 0.08 });
  for (let i = 0; i < 2; i++) m.add(shapes.box(0.78, 0.06, 0.03, 0.012, 1), C.woodLight, { y: seat + 0.11 + i * 0.09, z: -0.14 - i * 0.015, rx: -0.18 });
  for (const k of [-1, 1]) {
    m.add(shapes.box(0.04, seat, 0.04, 0.01, 1), GREEN_IRON, { x: k * 0.37, y: seat / 2, z: 0.09 });
    m.add(shapes.box(0.04, seat + 0.24, 0.04, 0.01, 1), GREEN_IRON, { x: k * 0.37, y: (seat + 0.24) / 2, z: -0.13, rx: -0.12 });
    m.add(shapes.box(0.05, 0.035, 0.26, 0.012, 1), GREEN_IRON, { x: k * 0.39, y: seat + 0.1, z: -0.01 });
    m.add(shapes.torus(0.045, 0.01, 10), GREEN_IRON, { x: k * 0.39, y: seat + 0.045, z: 0.1, ry: Math.PI / 2 });
  }
}

function benchStone(m: Merge): void {
  m.add(shapes.box(0.8, 0.07, 0.28, 0.025, 2), C.stone, { y: seat - 0.01 });
  for (const k of [-1, 1]) m.add(shapes.box(0.12, seat - 0.04, 0.22, 0.02, 1), C.stoneDark, { x: k * 0.27, y: (seat - 0.04) / 2 });
  // a little moss at one end
  m.add(shapes.dome(0.05, 10, 5), C.leafDeep, { x: -0.33, y: seat + 0.02, z: 0.06, s: [1, 0.35, 1] });
}

function benchLog(m: Merge): void {
  // a half log on two stumps
  m.add(shapes.cyl(0.11, 0.11, 0.82, 12), C.trunk, { y: seat - 0.04, rz: Math.PI / 2, s: [1, 1, 0.75] });
  m.add(shapes.box(0.8, 0.02, 0.17, 0.008, 1), C.woodLight, { y: seat + 0.035 });
  for (const k of [-1, 1]) {
    m.add(shapes.cyl(0.075, 0.085, seat - 0.08, 10), C.woodDark, { x: k * 0.28, y: (seat - 0.08) / 2 });
    m.add(shapes.cyl(0.11, 0.11, 0.012, 12), C.woodLight, { x: k * 0.41, y: seat - 0.04, rz: Math.PI / 2 });
  }
}

function benchPicnic(m: Merge): void {
  const top = SEAT_TOP + 0.13;
  m.add(shapes.box(0.82, 0.04, 0.42, 0.012, 1), C.wood, { y: top });
  for (const z of [-0.33, 0.33]) m.add(shapes.box(0.82, 0.035, 0.14, 0.012, 1), C.wood, { y: seat, z });
  for (const k of [-1, 1]) {
    // the crossed legs, one A on each side
    m.add(shapes.box(0.04, 0.5, 0.05, 0.01, 1), C.woodDark, { x: k * 0.3, y: top / 2, z: -0.16, rx: 0.62 });
    m.add(shapes.box(0.04, 0.5, 0.05, 0.01, 1), C.woodDark, { x: k * 0.3, y: top / 2, z: 0.16, rx: -0.62 });
    m.add(shapes.box(0.04, 0.035, 0.82, 0.01, 1), C.woodDark, { x: k * 0.3, y: seat - 0.035 });
  }
  // a cloth and a jug on it
  m.add(shapes.box(0.36, 0.006, 0.36, 0.002, 1), C.coral, { y: top + 0.023, ry: 0.4 });
  m.add(shapes.cyl(0.035, 0.045, 0.1, 10), C.white, { x: 0.1, y: top + 0.07, z: -0.04 });
}

function lampLantern(m: Merge, bulbs: Merge): void {
  const h = LAMP_HEIGHT * 0.92;
  m.add(shapes.box(0.16, 0.08, 0.16, 0.02, 1), C.woodDark, { y: 0.04 });
  m.add(shapes.box(0.06, h, 0.06, 0.01, 1), C.woodDark, { y: h / 2 });
  // the lantern: a frame, four panes, a little roof
  const y = h + 0.12;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.add(shapes.box(0.02, 0.22, 0.02, 0.004, 1), C.woodDark, { x: x * 0.08, y, z: z * 0.08 });
  m.add(shapes.box(0.2, 0.03, 0.2, 0.008, 1), C.woodDark, { y: y - 0.12 });
  m.add(shapes.cone(0.17, 0.1, 4), C.coral, { y: y + 0.16, ry: Math.PI / 4 });
  m.add(shapes.sphere(0.025, 8, 6), C.woodDark, { y: y + 0.23 }, { ao: false });
  bulbs.add(shapes.box(0.14, 0.19, 0.14, 0.01, 1), C.glow, { y });
}

function lampGlobes(m: Merge, bulbs: Merge): void {
  const h = LAMP_HEIGHT;
  m.add(shapes.cyl(0.08, 0.1, 0.1, 10), C.stoneDark, { y: 0.05 });
  m.add(shapes.cyl(0.03, 0.04, h, 8), C.metal, { y: h / 2 });
  m.add(shapes.box(0.44, 0.03, 0.03, 0.008, 1), C.metal, { y: h - 0.02 });
  for (const k of [-1, 1]) {
    m.add(shapes.torus(0.07, 0.01, 10), C.metal, { x: k * 0.12, y: h - 0.08, rx: 0 }, { ao: false });
    m.add(shapes.cyl(0.03, 0.03, 0.03, 8), C.metal, { x: k * 0.21, y: h + 0.005 });
    bulbs.add(shapes.sphere(0.075, 12, 10), C.glow, { x: k * 0.21, y: h + 0.09 });
  }
  m.add(shapes.cone(0.03, 0.08, 8), C.metal, { y: h + 0.06 });
}

function bins(m: Merge): void {
  // a green bin with a domed lid, a blue recycling bin with a slot
  m.add(shapes.cyl(0.13, 0.11, 0.3, 14), C.leafDeep, { x: -0.16, y: 0.15 });
  m.add(shapes.dome(0.135, 14, 6), C.leafDeep, { x: -0.16, y: 0.3, s: [1, 0.45, 1] });
  m.add(shapes.torus(0.13, 0.012, 14), C.metal, { x: -0.16, y: 0.25, rx: Math.PI / 2 }, { ao: false });
  m.add(shapes.box(0.24, 0.32, 0.22, 0.03, 2), C.blue, { x: 0.16, y: 0.16 });
  m.add(shapes.box(0.26, 0.03, 0.24, 0.012, 1), C.navy, { x: 0.16, y: 0.335 });
  m.add(shapes.box(0.12, 0.006, 0.03, 0.002, 1), C.stoneDark, { x: 0.16, y: 0.352 });
  // the recycling mark: three little arrows round
  for (let i = 0; i < 3; i++) m.add(shapes.box(0.05, 0.012, 0.006, 0.002, 1), C.white, { x: 0.16 + Math.cos((i * Math.PI * 2) / 3) * 0.03, y: 0.18 + Math.sin((i * Math.PI * 2) / 3) * 0.03, z: 0.111, rz: (i * Math.PI * 2) / 3 + Math.PI / 2 });
}

function wheel(m: Merge, x: number, z: number): void {
  m.add(shapes.torus(0.1, 0.014, 18), C.stoneDark, { x, y: 0.11, z, ry: Math.PI / 2 });
  m.add(shapes.cyl(0.015, 0.015, 0.03, 8), C.metal, { x, y: 0.11, z, rx: Math.PI / 2, ry: Math.PI / 2 });
}

function bikeRack(m: Merge): void {
  // three hoops, a yellow bike leaning in the middle one
  for (const x of [-0.25, 0, 0.25]) m.add(shapes.torus(0.13, 0.014, 14), C.metal, { x, y: 0.02, ry: Math.PI / 2, s: [1, 1.2, 1] });
  const bx = 0.06;
  wheel(m, bx, -0.17);
  wheel(m, bx, 0.17);
  m.add(shapes.box(0.02, 0.02, 0.3, 0.006, 1), C.mustard, { x: bx, y: 0.2, rx: 0.1 });
  m.add(shapes.box(0.02, 0.17, 0.02, 0.006, 1), C.mustard, { x: bx, y: 0.17, z: -0.05, rx: -0.25 });
  m.add(shapes.box(0.02, 0.15, 0.02, 0.006, 1), C.mustard, { x: bx, y: 0.19, z: 0.14, rx: 0.3 });
  m.add(shapes.box(0.04, 0.02, 0.07, 0.008, 1), C.woodDark, { x: bx, y: 0.27, z: -0.08 });
  m.add(shapes.box(0.16, 0.015, 0.015, 0.004, 1), C.stoneDark, { x: bx, y: 0.28, z: 0.12 });
  // a basket on the front
  m.add(shapes.box(0.11, 0.06, 0.08, 0.01, 1), C.wood, { x: bx, y: 0.26, z: 0.2 });
}

function postbox(m: Merge): void {
  m.add(shapes.cyl(0.12, 0.13, 0.42, 16), C.red, { y: 0.21 });
  m.add(shapes.dome(0.125, 16, 6), C.red, { y: 0.42, s: [1, 0.55, 1] });
  m.add(shapes.cyl(0.14, 0.14, 0.04, 16), C.stoneDark, { y: 0.02 });
  m.add(shapes.box(0.12, 0.018, 0.02, 0.004, 1), C.stoneDark, { y: 0.34, z: 0.12 });
  m.add(shapes.box(0.08, 0.05, 0.01, 0.003, 1), C.white, { y: 0.24, z: 0.128 });
  m.add(shapes.torus(0.13, 0.008, 16), C.mustard, { y: 0.4, rx: Math.PI / 2 }, { ao: false });
}

function crates(m: Merge): void {
  const crate = (x: number, y: number, z: number, ry: number, col: string) => {
    m.add(shapes.box(0.22, 0.18, 0.22, 0.01, 1), col, { x, y: y + 0.09, z, ry });
    for (const dy of [0.04, 0.14]) m.add(shapes.box(0.23, 0.02, 0.23, 0.005, 1), C.woodDark, { x, y: y + dy, z, ry });
  };
  crate(-0.15, 0, 0.02, 0.1, C.woodLight);
  crate(0.1, 0, -0.06, -0.25, C.wood);
  crate(-0.08, 0.18, -0.02, 0.5, C.woodLight);
  // apples in the top one
  for (let i = 0; i < 5; i++) m.add(shapes.sphere(0.03, 8, 6), C.red, { x: -0.08 + ((i % 3) - 1) * 0.055, y: 0.37, z: -0.02 + (i < 3 ? -0.03 : 0.04) });
  // a barrel
  m.add(shapes.cyl(0.11, 0.11, 0.3, 14), C.wood, { x: 0.24, y: 0.15, z: 0.18 });
  m.add(shapes.sphere(0.13, 14, 10), C.wood, { x: 0.24, y: 0.15, z: 0.18, s: [1, 1.05, 1] });
  for (const y of [0.05, 0.25]) m.add(shapes.torus(0.12, 0.01, 14), C.metal, { x: 0.24, y, z: 0.18, rx: Math.PI / 2 }, { ao: false });
}

function pots(m: Merge, sway: Merge): void {
  const pot = (x: number, z: number, r: number, h: number, col: string, flower: string | null) => {
    m.add(shapes.cyl(r, r * 0.78, h, 14), col, { x, y: h / 2, z });
    m.add(shapes.cyl(r * 0.92, r * 0.92, 0.01, 14), C.soilDark, { x, y: h - 0.01, z });
    if (flower) {
      sway.add(shapes.blob(r * 0.9, 1), C.leaf, { x, y: h + r * 0.55, z });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        sway.add(shapes.sphere(r * 0.28, 8, 6), flower, { x: x + Math.cos(a) * r * 0.6, y: h + r * 0.9, z: z + Math.sin(a) * r * 0.6 });
      }
    } else {
      // a little tree in a pot
      m.add(shapes.cyl(0.015, 0.02, 0.2, 6), C.trunk, { x, y: h + 0.1, z });
      sway.add(shapes.blob(0.12, 1), C.leafDeep, { x, y: h + 0.27, z });
    }
  };
  pot(-0.18, 0.05, 0.09, 0.14, C.coral, C.butter);
  pot(0.05, -0.1, 0.11, 0.18, C.cream, null);
  pot(0.2, 0.12, 0.07, 0.11, C.sky, C.pink);
}

function hydrant(m: Merge): void {
  m.add(shapes.cyl(0.07, 0.08, 0.26, 12), C.red, { y: 0.13 });
  m.add(shapes.dome(0.075, 12, 6), C.red, { y: 0.26 });
  m.add(shapes.cyl(0.02, 0.02, 0.03, 8), C.red, { y: 0.34 });
  m.add(shapes.cyl(0.095, 0.095, 0.03, 12), C.red, { y: 0.03 });
  for (const k of [-1, 1]) m.add(shapes.cyl(0.03, 0.03, 0.06, 10), C.white, { x: k * 0.08, y: 0.17, rz: Math.PI / 2 });
  m.add(shapes.cyl(0.04, 0.04, 0.05, 10), C.white, { y: 0.14, z: 0.08, rx: Math.PI / 2 });
}

function newsBox(m: Merge): void {
  m.add(shapes.box(0.04, 0.16, 0.04, 0.01, 1), C.metal, { y: 0.08 });
  m.add(shapes.box(0.3, 0.3, 0.26, 0.025, 2), C.teal, { y: 0.3 });
  m.add(shapes.box(0.24, 0.13, 0.01, 0.004, 1), C.cream, { y: 0.33, z: 0.132 });
  // a headline and a photo on the paper behind the window
  m.add(shapes.box(0.18, 0.02, 0.004, 0.002, 1), C.stoneDark, { y: 0.375, z: 0.139 });
  m.add(shapes.box(0.07, 0.05, 0.004, 0.002, 1), C.sky, { x: -0.06, y: 0.32, z: 0.139 });
  m.add(shapes.box(0.32, 0.03, 0.28, 0.01, 1), C.navy, { y: 0.465 });
  m.add(shapes.box(0.08, 0.015, 0.02, 0.004, 1), C.metal, { y: 0.24, z: 0.135 });
}

/** The model of one piece, standing at the origin and facing +z. */
export function buildFurniture(id: FurnitureId): FurnitureModel {
  const m = new Merge();
  const bulbs = new Merge();
  const sway = new Merge();
  switch (id) {
    case 'bench-park':
      benchPark(m);
      break;
    case 'bench-stone':
      benchStone(m);
      break;
    case 'bench-log':
      benchLog(m);
      break;
    case 'bench-picnic':
      benchPicnic(m);
      break;
    case 'lamp-lantern':
      lampLantern(m, bulbs);
      break;
    case 'lamp-globes':
      lampGlobes(m, bulbs);
      break;
    case 'bins':
      bins(m);
      break;
    case 'bike-rack':
      bikeRack(m);
      break;
    case 'postbox':
      postbox(m);
      break;
    case 'crates':
      crates(m);
      break;
    case 'pots':
      pots(m, sway);
      break;
    case 'hydrant':
      hydrant(m);
      break;
    case 'news-box':
      newsBox(m);
      break;
  }
  return { body: m.build(), bulbs: bulbs.build(), sway: sway.build() };
}
