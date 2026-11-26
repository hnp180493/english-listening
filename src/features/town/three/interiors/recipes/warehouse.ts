// Inside warehouse fifteen on Westbay's harbour (data/city/warehouses.ts; docs/gta-story-2.md job 10 "Kho 15"; docs/town.md
// §32): Bayline's store of everything its scanners heard. Tall steel shelves of tape boxes along the back wall, crates
// marked M and N (the M ones under the staircase: "the one under the stairs"), a staircase up the left wall to an office
// door, the back door on the back wall, the water gate on the left wall (the bay side) with its chains, one hanging bulb.
// The job puts people in it (TownStageHandle.enterOwnRoom with a cast: features/town/city/warehouse.ts): the host
// (Mrs Delaney), a visitor (who came in with the learner), two more at the room's `extras` (Shona at the gate, Kemp…).

import { shapes, type Merge, type Place } from '../../scene/merge';
import { C } from '../../scene/palette3d';
import { facing, people, shell, type Cast, type Room } from '../build';
import { pendant, shelfUnit } from '../furniture';

const TAPES = ['#2f3442', '#4b5d8c', '#7d6b5a', '#3f5b4e', '#8a3f3c', '#5c4f6e'] as const;
const CRATE = '#b48a5c';
const PAINT = '#24262d';

/** A letter M or N painted on a face (strokes in a box `w` wide, `h` tall), at a placer. */
function letter(m: Merge, ch: 'M' | 'N', at: (lx: number, ly: number, extra?: Place) => Place, w: number, h: number): void {
  const t = w * 0.18;
  const stroke = (x: number, y: number, len: number, rz: number) => m.add(shapes.box(t, len, 0.01, 0.003, 1), PAINT, at(x, y, { rz }), { ao: false });
  stroke(-w / 2 + t / 2, 0, h, 0);
  stroke(w / 2 - t / 2, 0, h, 0);
  if (ch === 'N') stroke(0, 0, Math.hypot(w - t, h), Math.atan2(w - t, h));
  else {
    const half = (w - t) / 2;
    const len = Math.hypot(half, h * 0.6);
    stroke(-half / 2, h * 0.2, len, Math.atan2(half, h * 0.6));
    stroke(half / 2, h * 0.2, len, -Math.atan2(half, h * 0.6));
  }
}

/** A crate on the floor (or on another), its letter on the front (+z) face. */
function crate(r: Room, x: number, y: number, z: number, s: number, ch: 'M' | 'N', ry = 0): void {
  const f = r.furn;
  f.add(shapes.box(s, s * 0.8, s, 0.015, 1), CRATE, { x, y: y + s * 0.4, z, ry });
  for (const k of [-1, 1]) f.add(shapes.box(s + 0.01, 0.03, 0.03, 0.006, 1), C.woodDark, { x, y: y + s * 0.4 + k * s * 0.28, z: z + s / 2, ry }, { ao: false });
  const c = Math.cos(ry);
  const sn = Math.sin(ry);
  letter(f, ch, (lx, ly, extra = {}) => ({ ...extra, x: x + lx * c + (s / 2 + 0.008) * sn, y: y + s * 0.4 + ly, z: z - lx * sn + (s / 2 + 0.008) * c, ry }), s * 0.42, s * 0.36);
  r.block(x, z, s / 2, s / 2, 'crate ' + ch, ry);
}

export function warehouse(r: Room): Cast {
  shell(r, { wall: '#b7a79a', wallLeft: '#a99686', floor: 'stone', floorA: '#8e8f94', floorB: '#83858a', tile: 0.8, skirting: '#5d6170', cut: '#6b6e78' });
  const f = r.furn;
  const back = -r.D / 2;
  const left = -r.W / 2;

  // steel shelves of tape boxes along the back wall (labels gone: Shona took them off)
  for (const x of [0.25, 1.55]) {
    const sx = x;
    const put = (lx: number, ly: number, lz: number, extra: Place = {}): Place => ({ ...extra, x: sx + lx, y: ly, z: back + 0.05 + lz });
    const ys = shelfUnit(r, put, 1.2, 1.7, 0.36, '#6f7684', 4);
    ys.slice(0, 4).forEach((y, i) => {
      let lx = -0.54;
      let k = i * 3 + Math.round(sx * 10);
      while (lx < 0.52) {
        const w = 0.07 + (k % 3) * 0.015;
        f.add(shapes.box(w, 0.2, 0.26, 0.008, 1), TAPES[k % TAPES.length], put(lx + w / 2, y + 0.1, 0.17), { ao: false });
        lx += w + 0.012;
        k++;
      }
    });
    r.block(sx, back + 0.23, 0.6, 0.2, 'shelf');
  }

  // the staircase up the left wall to an office door, the M crates under it
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const h = ((i + 1) * 1.5) / steps;
    f.add(shapes.box(0.42, 0.06, 0.24, 0.01, 1), '#5d6170', { x: left + 0.24, y: h - 0.03, z: 1.4 - i * 0.24 });
  }
  f.add(shapes.box(0.04, 1.6, 2.3, 0.01, 1), '#4b4f5c', { x: left + 0.46, y: 0.8, z: 0.45, rx: 0 }, { ao: false });
  f.add(shapes.box(0.7, 0.06, 0.6, 0.01, 1), '#5d6170', { x: left + 0.36, y: 1.5, z: -0.95 });
  f.add(shapes.box(0.04, 0.72, 0.38, 0.01, 1), C.woodDark, { x: left + 0.02, y: 1.88, z: -0.95 }, { ao: false });
  r.block(left + 0.25, 0.4, 0.25, 1.25, 'stairs');
  crate(r, left + 0.3, 0, 0.95, 0.4, 'M', Math.PI / 2);
  crate(r, left + 0.3, 0, 0.45, 0.4, 'M', Math.PI / 2);
  crate(r, left + 0.3, 0.32, 0.7, 0.34, 'M', Math.PI / 2);

  // the N crates in the open, stacked
  crate(r, 0.9, 0, 0.35, 0.44, 'N');
  crate(r, 1.38, 0, 0.42, 0.44, 'N', 0.2);
  crate(r, 1.1, 0.35, 0.38, 0.38, 'N', -0.1);

  // the back door (to Quay Street), right of the shelves
  const bd = r.back(r.W / 2 - 0.5, 0);
  r.shell.add(shapes.box(0.52, 0.92, 0.04, 0.01, 1), C.trim, bd(0, 0.46, 0.02), { ao: false });
  r.shell.add(shapes.box(0.44, 0.86, 0.04, 0.01, 1), '#23252c', bd(0, 0.43, 0.04), { ao: false });
  r.shell.add(shapes.box(0.12, 0.05, 0.05, 0.01, 1), C.metal, bd(0.12, 0.45, 0.07), { ao: false });

  // the water gate on the left wall (the bay side): two wide wooden leaves, a beam, chains, a strip of water under it
  const gz = -1.5;
  const gate = (lx: number, ly: number, lz = 0, extra: Place = {}): Place => ({ ...extra, x: left + 0.03 + lz, y: ly, z: gz + lx, ry: Math.PI / 2 });
  for (const s of [-1, 1]) r.shell.add(shapes.box(0.48, 1.1, 0.05, 0.01, 1), '#6b4b36', gate(s * 0.25, 0.55, 0.02), { ao: false });
  for (const s of [-1, 1]) for (const y of [0.25, 0.85]) r.shell.add(shapes.box(0.44, 0.05, 0.04, 0.01, 1), C.metal, gate(s * 0.25, y, 0.05), { ao: false });
  r.shell.add(shapes.box(1.2, 0.1, 0.1, 0.01, 1), '#4b4f5c', gate(0, 1.2, 0.06), { ao: false });
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) f.add(shapes.torus(0.025, 0.006, 6), C.metal, gate(s * 0.55, 1.12 - k * 0.05, 0.1, { rx: (k % 2) * (Math.PI / 2) }), { ao: false });
  r.shell.add(shapes.box(0.38, 0.012, 1.0, 0.004, 1), '#2d5f7a', { x: left + 0.22, y: 0.006, z: gz }, { ao: false });

  // one bulb, and the lamp's light
  pendant(r, 0.4, r.H - 0.5, 0.2, '#3d4150', r.H + 0.4, { light: true });
  r.lamp(0.4, r.H - 0.6, 0.2);

  // who stands where: the host (Mrs Delaney) by the shelves, the learner in the middle, a visitor by the crates, two
  // more at the gate and the back door (`extras`: the job's own people, never passers-by)
  const extras = [facing(left + 0.9, gz, 0.4, 0.3, null, 0), facing(r.W / 2 - 0.5, back + 0.6, 0.4, 0.3, null, 0)];
  return people({ x: 0.55, z: -0.75 }, { x: 0.35, z: 0.75 }, { x: 1.55, z: 1.05 }, extras, { y: 0.55 });
}
