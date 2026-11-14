// The thirteen places of "Thị trấn" (src/data/townWorld.ts), each recognisable at a glance and with no words on
// it. Built with the door on +Z, `front` tiles along X and `deep` along Z, centred on the origin; the recipe
// `place` turns a place whose door is on the +X face a quarter turn. Kenney's suburban houses where a house fits;
// the rest is composed from kit parts and plain shapes in the kits' flat colours.

import { addRecipes, kit, bounds } from './recipes.js';
import { C, THREE, box, cyl, ball, group, mat, gableRoof, pyramidRoof, windows, door, awning, discSign, symbol, glassMat } from './parts.js';

/** Margin between a building and the edge of its footprint (tiles). */
const M = 0.14;
/** Kenney's houses are low for our chunky people: stretched up this much (their roofs get a little steeper). */
const HOUSE_STRETCH = 1.32;

/** A Kenney suburban house fitted to the footprint, door on +Z. */
async function house(name, front, deep, paint, { stretch = HOUSE_STRETCH, fill = 1, glow = true } = {}) {
  const h = await kit(`sub/${name}`, { center: true, paint, glow: glow ? { window: '#ffd27a' } : undefined });
  const b = bounds(h);
  const s = Math.min(((front - 2 * M) * fill) / (b.max.x - b.min.x), ((deep - 2 * M) * fill) / (b.max.z - b.min.z));
  h.scale.set(s, s * stretch, s);
  return h;
}

/** A little garden strip: low hedges / flowers along a side of the footprint. */
function hedge(len, { x = 0, z = 0, ry = 0, color = C.leafDark, h = 0.2 } = {}) {
  return box(len, h, 0.2, color, { x, z, ry, r: 0.07 });
}

function flowersRow(len, { x = 0, z = 0, ry = 0, colors = [C.pink, C.yellow, C.white, C.red] } = {}) {
  const g = group(box(len, 0.08, 0.2, C.woodDark, { r: 0.02 }), box(len - 0.04, 0.03, 0.16, C.earth, { y: 0.07 }));
  const n = Math.max(2, Math.round(len / 0.11));
  for (let i = 0; i < n; i++) {
    const u = -len / 2 + (len / n) * (i + 0.5);
    g.add(ball(0.035, C.leafDark, { x: u, y: 0.13, z: (i % 2) * 0.05 - 0.025, detail: 0 }));
    g.add(ball(0.04, colors[i % colors.length], { x: u, y: 0.18, z: (i % 2) * 0.05 - 0.025, detail: 1 }));
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  return g;
}

/** A pole with a hanging square sign facing +z, the sign's centre at height y. */
function hangingSign(sym, { x = 0, z = 0, y = 0.9, board = C.cream, rim = C.woodDark, size = 0.3, turn = Math.PI / 5 } = {}) {
  const g = group(
    box(0.05, y + 0.25, 0.05, C.iron, { x: 0, z: 0 }),
    box(0.36, 0.04, 0.04, C.iron, { x: 0.16, y: y + 0.2 }),
    box(size + 0.08, size + 0.08, 0.05, rim, { x: 0.22, y: y - (size + 0.08) / 2 + 0.08 }),
    box(size, size, 0.06, board, { x: 0.22, y: y - size / 2 + 0.08 }),
  );
  const s = sym;
  s.position.set(0.22, y + 0.08 - size / 2, 0.05);
  g.add(s);
  // turned a little round the pole, so the symbol faces the viewer
  g.rotation.y = turn;
  g.position.set(x, 0, z);
  return g;
}

const RECIPES = {
  /** Leo: the bandstand in the plaza, an eight-sided pavilion with a striped roof and a flag. */
  async square({ front }) {
    const r = front / 2 - M - 0.05;
    const g = group();
    g.add(cyl(r + 0.06, 0.1, C.stoneDark, { seg: 8 }));
    g.add(cyl(r, 0.08, C.white, { seg: 8, y: 0.1 }));
    // a step up at the front
    g.add(box(0.5, 0.06, 0.2, C.stone, { z: r + 0.04 }));
    const H = 1.05;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * (r - 0.1);
      const z = Math.sin(a) * (r - 0.1);
      g.add(cyl(0.045, H, C.white, { x, z, y: 0.18, seg: 8 }));
      // railings between the posts, open at the front (towards +z)
      const b = a + Math.PI / 8;
      if (Math.abs(b - Math.PI / 2) > 0.3) {
        const rx = Math.cos(b) * (r - 0.12) * Math.cos(Math.PI / 8);
        const rz = Math.sin(b) * (r - 0.12) * Math.cos(Math.PI / 8);
        const len = 2 * (r - 0.1) * Math.sin(Math.PI / 8);
        g.add(box(len, 0.04, 0.04, C.white, { x: rx, z: rz, y: 0.46, ry: -b + Math.PI / 2 }));
        for (const t of [-0.25, 0, 0.25]) {
          g.add(box(0.025, 0.28, 0.025, C.white, { x: rx + Math.cos(b - Math.PI / 2) * len * t, z: rz + Math.sin(b - Math.PI / 2) * len * t, y: 0.18 }));
        }
      }
    }
    // the roof: a ring of eaves, an eight-sided cone in stripes, a finial and a flag
    g.add(cyl(r + 0.14, 0.08, C.orange, { seg: 8, y: 0.18 + H }));
    const roof = new THREE.ConeGeometry(r + 0.16, 0.62, 8, 1, true);
    const colors = [];
    const pos = roof.attributes.position;
    // stripes: colour each of the eight faces in turn
    const nonIndexed = roof.toNonIndexed();
    const p2 = nonIndexed.attributes.position;
    const col = new THREE.Color();
    for (let i = 0; i < p2.count; i++) {
      const face = Math.floor(i / 6);
      col.set(face % 2 === 0 ? C.orange : C.cream).convertSRGBToLinear();
      colors.push(col.r, col.g, col.b);
    }
    void pos;
    nonIndexed.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    nonIndexed.computeVertexNormals();
    nonIndexed.rotateY(Math.PI / 8);
    nonIndexed.translate(0, 0.18 + H + 0.08 + 0.31, 0);
    g.add(new THREE.Mesh(nonIndexed, mat('#ffffff', { vertexColors: true, flat: true, double: true })));
    const top = 0.18 + H + 0.08 + 0.62;
    g.add(ball(0.07, C.gold, { y: top + 0.03, detail: 3 }));
    g.add(cyl(0.02, 0.36, C.white, { y: top }));
    const flag = box(0.24, 0.14, 0.015, C.coral, { x: 0.13, y: top + 0.2 });
    g.add(flag);
    // bulbs under the eaves (lit at night)
    const bulbInks = [C.gold, C.pink, C.sky, C.leafLight];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const col = bulbInks[i % 4];
      g.add(ball(0.035, mat(col, { glow: col }), { x: Math.cos(a) * (r + 0.1), y: 0.18 + H - 0.04, z: Math.sin(a) * (r + 0.1), detail: 2 }));
    }
    // a little lantern hanging inside
    g.add(box(0.012, 0.18, 0.012, C.iron, { y: 0.18 + H - 0.18 }));
    g.add(ball(0.07, mat(C.gold, { glow: '#ffe08a' }), { y: 0.18 + H - 0.24, detail: 3 }));
    return { object: g, info: { top: new THREE.Vector3(0, top + 0.05, 0) } };
  },

  /** Emma: a cream café with a teal roof, a striped awning, a cup sign and a chalkboard. */
  async cafe({ front, deep }) {
    const h = await house('house_type03', front, deep, { _defaultMat: C.cream, roof: C.teal, door: C.wood, border: '#d8cbb0' });
    const b = bounds(h);
    const g = group(h);
    const zf = b.max.z;
    g.add(awning(b.max.x - b.min.x - 0.25, zf * 2, 0.62, [C.pink, C.white], { out: 0.3, drop: 0.14, stripes: 9 }));
    const cupSign = hangingSign(symbol('cup', 0.36), { x: b.max.x - 0.12, z: zf + 0.22, y: 1.0, size: 0.44 });
    g.add(cupSign);
    // a chalkboard A-frame by the door
    const board = group(box(0.22, 0.32, 0.03, C.ink, { rx: -0.2 }), box(0.26, 0.04, 0.05, C.wood, { y: 0.3 }));
    board.position.set(b.min.x + 0.35, 0, zf + 0.32);
    g.add(board);
    g.add(flowersRow(0.5, { x: b.min.x + 0.45, z: zf + 0.12 }));
    return { object: g };
  },

  /** Mia: a two-storey house with a porch, pink roof, a mailbox and flowers. */
  async friend({ front, deep }) {
    const h = await house('house_type12', front, deep, { _defaultMat: '#fff0e6', roof: C.pink, door: C.purple, border: '#e8d6cc' });
    const b = bounds(h);
    const g = group(h);
    g.add(flowersRow(0.42, { x: b.min.x + 0.32, z: b.max.z + 0.1 }));
    const mailbox = group(box(0.04, 0.34, 0.04, C.woodDark), box(0.14, 0.12, 0.2, C.coral, { y: 0.34, r: 0.04 }), box(0.02, 0.08, 0.02, C.yellow, { x: 0.08, y: 0.4 }));
    mailbox.position.set(b.max.x - 0.08, 0, b.max.z + 0.18);
    g.add(mailbox);
    return { object: g };
  },

  /** Grace: a cosy cottage with a purple roof, a chimney, a bench and a garden. */
  async home({ front, deep }) {
    const h = await house('house_type05', front, deep, { _defaultMat: '#fdf3e0', roof: C.purple, door: '#e0795b', border: '#e2d3b8' });
    const b = bounds(h);
    const g = group(h);
    // a brick chimney with a wisp of smoke
    g.add(box(0.18, 0.5, 0.18, '#c8735a', { x: b.min.x + 0.45, y: (b.max.y * 0.62), z: b.min.z + 0.5 }));
    g.add(box(0.22, 0.05, 0.22, '#a95d48', { x: b.min.x + 0.45, y: b.max.y * 0.62 + 0.5, z: b.min.z + 0.5 }));
    g.add(flowersRow(0.45, { x: b.min.x + 0.32, z: b.max.z + 0.12 }));
    g.add(flowersRow(0.45, { x: b.max.x - 0.32, z: b.max.z + 0.12, colors: [C.purple, C.white, C.pink] }));
    return { object: g };
  },

  /** Ben: a one-storey shop with an orange roof, a striped awning, crates of fruit and a basket sign. */
  async shop({ front, deep }) {
    const h = await house('house_type07', front, deep * 0.85, { _defaultMat: '#fff4d9', roof: C.orange, door: '#5aa469', border: '#e0d2b2' });
    const b = bounds(h);
    h.position.z -= deep * 0.06;
    const g = group(h);
    const zf = b.max.z - deep * 0.06;
    g.add(awning(b.max.x - b.min.x - 0.1, zf * 2, 0.6, [C.coral, C.white], { out: 0.32, drop: 0.14, stripes: 9 }));
    // fruit crates under the awning
    const fruitColors = [C.red, C.orange, C.leafLight, C.yellow];
    [-0.5, 0.42].forEach((x, k) => {
      const crate = group(box(0.34, 0.2, 0.24, C.wood, { r: 0.015 }));
      for (let i = 0; i < 6; i++) crate.add(ball(0.055, fruitColors[(i + k * 2) % 4], { x: -0.11 + (i % 3) * 0.11, y: 0.22, z: -0.05 + Math.floor(i / 3) * 0.1, detail: 1 }));
      crate.position.set(x, 0, zf + 0.22);
      g.add(crate);
    });
    // the sign on the roof: a basket
    const sign = group(box(0.62, 0.42, 0.05, C.cream, { r: 0.03 }), box(0.66, 0.46, 0.03, C.coral, { z: -0.02, r: 0.03 }));
    const sym = symbol('basket', 0.36);
    sym.position.set(0, 0.24, 0.05);
    sign.add(sym);
    sign.position.set(0, b.max.y - 0.02, zf - 0.35);
    g.add(sign);
    return { object: g };
  },

  /** Sarah: a modern three-storey office of glass bands, a blue trim and a rooftop with plants. */
  async office({ front, deep }) {
    const w = front - 2 * M - 0.1;
    const d = deep - 2 * M - 0.1;
    const floors = 3;
    const fh = 0.68;
    const H = floors * fh + 0.12;
    const g = group(box(w, H, d, '#e9eff9'));
    // glass bands on every face, with mullions
    for (let f = 0; f < floors; f++) {
      const y = 0.12 + f * fh + 0.16;
      for (const face of ['+z', '-z']) {
        const us = [];
        const n = 5;
        for (let i = 0; i < n; i++) us.push(-w / 2 + (w / n) * (i + 0.5));
        if (!(f === 0 && face === '+z')) g.add(windows(face, w, d, us, y, w / n - 0.12, 0.36, { frame: '#5b8fd9', sill: false, cross: false, glass: '#9fd0f0' }));
      }
      for (const face of ['+x', '-x']) {
        const us = [];
        const n = 3;
        for (let i = 0; i < n; i++) us.push(-d / 2 + (d / n) * (i + 0.5));
        g.add(windows(face, w, d, us, y, d / n - 0.12, 0.36, { frame: '#5b8fd9', sill: false, cross: false, glass: '#9fd0f0' }));
      }
      g.add(box(w + 0.04, 0.05, d + 0.04, '#5b8fd9', { y: 0.12 + (f + 1) * fh - 0.06 }));
    }
    // the entrance: glass doors under a canopy
    g.add(door(d, 0, { w: 0.6, h: 0.56, glass: true, frame: '#3f6fb8', step: C.stone }));
    g.add(box(1.0, 0.06, 0.4, '#3f6fb8', { y: 0.72, z: d / 2 + 0.18 }));
    g.add(windows('+z', w, d, [-w / 2 + 0.45, w / 2 - 0.45], 0.28, 0.5, 0.38, { frame: '#5b8fd9', sill: false, cross: false, glass: '#9fd0f0' }));
    // the roof: a parapet, an AC unit, potted plants
    g.add(box(w + 0.06, 0.12, d + 0.06, '#d5deeb', { y: H }));
    g.add(box(w - 0.1, 0.02, d - 0.1, '#b9c4d6', { y: H + 0.11 }));
    g.add(box(0.4, 0.22, 0.3, C.stone, { x: -w / 4, y: H + 0.12, z: -0.1, r: 0.03 }));
    g.add(cyl(0.09, 0.03, C.stoneDark, { x: -w / 4, y: H + 0.34, z: -0.1 }));
    for (const x of [w / 4, w / 4 + 0.3]) {
      g.add(cyl(0.08, 0.12, C.coral, { x, y: H + 0.12, z: 0.1, top: 0.1 }));
      g.add(ball(0.13, C.leaf, { x, y: H + 0.33, z: 0.1, detail: 1 }));
    }
    return { object: g };
  },

  /** Daniel: a red-roofed school with a clock tower, a flag and a bell. */
  async school({ front, deep }) {
    const w = front - 2 * M;
    const d = deep - 2 * M - 0.25;
    const wall = '#f8dcc0';
    const H = 1.0;
    const g = group(box(w, H, d, wall), box(w + 0.04, 0.1, d + 0.04, '#e0b894'));
    g.add(gableRoof(w, d, H, 0.5, '#e0685a', wall, { ov: 0.12 }));
    const us = [-w / 2 + 0.35, -w / 2 + 0.8, w / 2 - 0.8, w / 2 - 0.35];
    g.add(windows('+z', w, d, us, 0.32, 0.3, 0.42));
    g.add(windows('-z', w, d, us, 0.32, 0.3, 0.42));
    g.add(windows('+x', w, d, [0], 0.32, 0.3, 0.42));
    g.add(windows('-x', w, d, [0], 0.32, 0.3, 0.42));
    // the tower in the middle of the front, with the clock and a little roof
    const tw = 0.62;
    const tz = d / 2 - tw / 2 + 0.16;
    g.add(box(tw, 1.72, tw, wall, { z: tz }));
    g.add(box(tw + 0.06, 0.08, tw + 0.06, '#e0b894', { y: 1.0, z: tz }));
    g.add(door(tz * 2 + tw, 0, { w: 0.36, h: 0.62, color: '#8a5a3a' }));
    const clock = symbol('clock', 0.4);
    clock.position.set(0, 1.4, tz + tw / 2 + 0.03);
    g.add(clock);
    const clock2 = symbol('clock', 0.4);
    clock2.position.set(tw / 2 + 0.03, 1.4, tz);
    clock2.rotation.y = Math.PI / 2;
    g.add(clock2);
    const clock3 = symbol('clock', 0.4);
    clock3.position.set(-tw / 2 - 0.03, 1.4, tz);
    clock3.rotation.y = -Math.PI / 2;
    g.add(clock3);
    g.add(pyramidRoof(tw * 0.82, 0.5, 1.72, '#e0685a'));
    g.add(ball(0.05, C.gold, { y: 2.24, z: tz, detail: 3 }));
    // the flag pole beside it
    const fx = w / 2 - 0.12;
    const fz = d / 2 + 0.22;
    g.add(cyl(0.06, 0.06, C.stone, { x: fx, z: fz }));
    g.add(cyl(0.022, 1.9, C.white, { x: fx, z: fz }));
    g.add(ball(0.04, C.gold, { x: fx, y: 1.92, z: fz, detail: 3 }));
    g.add(box(0.42, 0.28, 0.015, C.blue, { x: fx - 0.22, y: 1.5, z: fz }));
    g.add(box(0.42, 0.09, 0.02, C.yellow, { x: fx - 0.22, y: 1.6, z: fz }));
    return { object: g };
  },

  /** Sam: the bus stop: a ticket booth, a glass shelter with a bench, a round bus sign. */
  async station({ front, deep }) {
    const g = group();
    const pad = box(front - 2 * M, 0.05, deep - 2 * M, C.paving, { r: 0.02 });
    g.add(pad);
    // the booth at the back
    const bw = 0.8;
    const bd = 0.7;
    const bx = -front / 2 + M + bw / 2 + 0.05;
    const bz = -deep / 2 + M + bd / 2 + 0.05;
    const booth = group(box(bw, 0.95, bd, '#e6f2f5'), box(bw + 0.12, 0.08, bd + 0.12, '#4f9fd8', { y: 0.95 }));
    booth.add(pyramidRoof(0.62, 0.26, 1.03, '#4f9fd8', { sx: 1.1, sz: 1 }));
    booth.add(windows('+z', bw, bd, [0], 0.4, 0.5, 0.34, { frame: '#2f6f9f', cross: false }));
    booth.add(windows('+x', bw, bd, [0.05], 0.4, 0.4, 0.34, { frame: '#2f6f9f', cross: false }));
    booth.add(box(0.56, 0.05, 0.12, '#2f6f9f', { y: 0.38, z: bd / 2 + 0.05 }));
    booth.position.set(bx, 0.05, bz);
    g.add(booth);
    // the shelter: posts, a glass back, a blue roof, a bench
    const sw = 1.1;
    const sx = 0.22;
    const sz = 0.3;
    const sh = 0.95;
    const shelter = group(
      box(sw, 0.06, 0.55, '#4f9fd8', { y: sh, r: 0.02 }),
      box(0.05, sh, 0.05, C.iron, { x: -sw / 2 + 0.05, z: -0.22 }),
      box(0.05, sh, 0.05, C.iron, { x: sw / 2 - 0.05, z: -0.22 }),
      box(0.05, sh, 0.05, C.iron, { x: -sw / 2 + 0.05, z: 0.2 }),
      box(0.05, sh, 0.05, C.iron, { x: sw / 2 - 0.05, z: 0.2 }),
      box(sw - 0.1, sh - 0.15, 0.03, mat('#bfe6f5', { opacity: 0.55, rough: 0.2 }), { y: 0.1, z: -0.22 }),
      box(0.03, sh - 0.15, 0.4, mat('#bfe6f5', { opacity: 0.55, rough: 0.2 }), { x: -sw / 2 + 0.05, y: 0.1 }),
      box(sw - 0.3, 0.05, 0.2, C.wood, { y: 0.28, z: -0.08 }),
      box(sw - 0.3, 0.2, 0.04, C.wood, { y: 0.34, z: -0.18 }),
      box(0.04, 0.28, 0.04, C.iron, { x: -0.3, z: -0.08 }),
      box(0.04, 0.28, 0.04, C.iron, { x: 0.3, z: -0.08 }),
    );
    shelter.position.set(sx, 0.05, sz);
    g.add(shelter);
    // the round sign on a pole: a bus
    const pole = group(cyl(0.03, 1.3, C.iron));
    const disc = discSign(0.22, C.blue);
    disc.position.y = 1.36;
    const bus = symbol('bus', 0.42);
    bus.position.set(0, 1.4, 0.04);
    pole.add(disc, bus);
    pole.position.set(front / 2 - M - 0.1, 0.05, deep / 2 - M - 0.08);
    g.add(pole);
    return { object: g };
  },

  /** Kim: a white clinic with a mint trim and red crosses (on the roof and over the door). */
  async clinic({ front, deep }) {
    const w = front - 2 * M - 0.1;
    const d = deep - 2 * M - 0.15;
    const H = 1.45;
    const g = group(box(w, H, d, C.white), box(w + 0.04, 0.12, d + 0.04, C.mint));
    for (const [face, n] of [['+z', 3], ['-z', 3], ['+x', 2], ['-x', 2]]) {
      const len = face[1] === 'z' ? w : d;
      const us = [];
      for (let i = 0; i < n; i++) us.push(-len / 2 + (len / n) * (i + 0.5));
      g.add(windows(face, w, d, us, 0.82, 0.3, 0.34, { frame: C.mint }));
      if (face !== '+z') g.add(windows(face, w, d, us, 0.24, 0.3, 0.34, { frame: C.mint }));
    }
    g.add(windows('+z', w, d, [-w / 2 + 0.3, w / 2 - 0.3], 0.24, 0.3, 0.34, { frame: C.mint }));
    g.add(door(d, 0, { w: 0.5, h: 0.6, glass: true, frame: C.mint }));
    g.add(box(0.9, 0.06, 0.38, C.mint, { y: 0.72, z: d / 2 + 0.16 }));
    // a red cross over the entrance and a big one on the roof
    const c1 = symbol('cross', 0.3, C.red);
    c1.position.set(0, 0.98 + 0.15 - 0.15, d / 2 + 0.05);
    const plate = box(0.4, 0.4, 0.03, C.white, { y: 0.88, z: d / 2 + 0.02 });
    g.add(plate);
    c1.position.set(0, 1.08, d / 2 + 0.04);
    g.add(c1);
    g.add(box(w + 0.06, 0.1, d + 0.06, C.mint, { y: H }));
    const sign = group(box(0.62, 0.62, 0.06, C.white, { r: 0.04 }), box(0.05, 0.3, 0.05, C.stoneDark, { y: -0.3 }));
    const c2 = symbol('cross', 0.46, C.red);
    c2.position.set(0, 0.31, 0.04);
    sign.add(c2);
    sign.position.set(0, H + 0.3, 0);
    sign.rotation.y = -Math.PI / 4;
    g.add(sign);
    return { object: g };
  },

  /** Zoe: a purple cinema with a stepped front, a marquee of bulbs, posters and a film-reel sign. */
  async cinema({ front, deep }) {
    const w = front - 2 * M - 0.1;
    const d = deep - 2 * M - 0.2;
    const H = 1.35;
    const wall = '#8d6fd6';
    const g = group(box(w, H, d, wall), box(w + 0.04, 0.1, d + 0.04, C.violet));
    // the stepped false front rising over the door
    g.add(box(w * 0.5, 0.36, 0.14, wall, { y: H, z: d / 2 - 0.07 }));
    g.add(box(w * 0.26, 0.22, 0.14, wall, { y: H + 0.36, z: d / 2 - 0.07 }));
    g.add(box(w + 0.06, 0.06, d + 0.06, C.violet, { y: H }));
    const reel = symbol('reel', 0.5);
    reel.position.set(0, H + 0.3, d / 2 + 0.02);
    g.add(reel);
    const star = symbol('star', 0.26);
    star.position.set(0, H + 0.62, d / 2 - 0.04);
    g.add(star);
    // the marquee: a gold canopy edged with bulbs
    const mw = w * 0.62;
    const mz = d / 2 + 0.2;
    g.add(box(mw, 0.18, 0.42, C.gold, { y: 0.82, z: mz - 0.02 }));
    g.add(box(mw - 0.08, 0.04, 0.4, '#3b2d6b', { y: 0.8, z: mz - 0.02 }));
    const bulb = mat('#fff3c4', { glow: '#fff0b0' });
    const n = 11;
    for (let i = 0; i < n; i++) {
      const x = -mw / 2 + 0.05 + ((mw - 0.1) / (n - 1)) * i;
      g.add(ball(0.03, bulb, { x, y: 0.91, z: mz + 0.2, detail: 1 }));
    }
    for (let i = 0; i < 4; i++) {
      const z = mz + 0.2 - (0.4 / 4) * (i + 0.5);
      g.add(ball(0.03, bulb, { x: mw / 2 + 0.01, y: 0.91, z, detail: 1 }));
      g.add(ball(0.03, bulb, { x: -mw / 2 - 0.01, y: 0.91, z, detail: 1 }));
    }
    g.add(door(d, -0.2, { w: 0.34, h: 0.62, glass: true, frame: C.gold, step: '#c94a5a' }));
    g.add(door(d, 0.2, { w: 0.34, h: 0.62, glass: true, frame: C.gold, step: '#c94a5a' }));
    // posters in lit frames on both sides
    const posters = [C.coral, C.sky, C.yellow, C.pink];
    [-w / 2 + 0.3, w / 2 - 0.3].forEach((x, i) => {
      g.add(box(0.34, 0.5, 0.03, C.gold, { x, y: 0.2, z: d / 2 + 0.01 }));
      g.add(box(0.27, 0.42, 0.04, mat(posters[i], { glow: '#ffe7b0' }), { x, y: 0.24, z: d / 2 + 0.015 }));
      g.add(box(0.12, 0.12, 0.05, '#ffffff', { x, y: 0.38, z: d / 2 + 0.02 }));
    });
    // a tall blade sign at the front corner: red with a gold rim, bulbs down both edges, a star on top
    const blade = group(box(0.07, 1.0, 0.32, '#e0485a', { r: 0.02 }), box(0.05, 1.06, 0.38, C.gold, { y: -0.03, r: 0.02 }));
    for (let i = 0; i < 7; i++) {
      for (const zz of [-0.13, 0.13]) blade.add(ball(0.025, bulb, { x: 0.045, y: 0.1 + i * 0.13, z: zz, detail: 1 }));
    }
    const bstar = symbol('star', 0.2);
    bstar.position.set(0, 1.12, 0);
    bstar.rotation.y = Math.PI / 4;
    blade.add(bstar);
    blade.position.set(w / 2 - 0.1, H - 0.55, d / 2 + 0.2);
    g.add(blade);
    // side windows high up
    g.add(windows('+x', w, d, [-d / 4, d / 4], 0.9, 0.22, 0.22, { frame: C.violet, cross: false }));
    g.add(windows('-x', w, d, [-d / 4, d / 4], 0.9, 0.22, 0.22, { frame: C.violet, cross: false }));
    return { object: g };
  },

  /** Max: a small phone shop: a big glass front, a blue sign band and a giant phone on the roof. */
  async phone({ front, deep }) {
    const w = front - 2 * M - 0.15;
    const d = deep - 2 * M - 0.35;
    const H = 1.05;
    const g = group(box(w, H, d, '#eaf4ff'));
    g.add(box(w + 0.06, 0.24, d + 0.06, C.blue, { y: H - 0.24 }));
    g.add(box(w + 0.1, 0.06, d + 0.1, '#2f62b8', { y: H }));
    // the shop window, all glass, with a counter of phones behind it
    g.add(box(w - 0.2, 0.52, 0.04, glassMat('#bfe3ff'), { y: 0.14, z: d / 2 + 0.01 }));
    g.add(box(w - 0.14, 0.05, 0.06, C.blue, { y: 0.12, z: d / 2 + 0.02 }));
    g.add(box(0.04, 0.52, 0.06, C.blue, { x: 0.18, y: 0.14, z: d / 2 + 0.02 }));
    g.add(door(d, 0.48, { w: 0.34, h: 0.62, glass: true, frame: C.blue }));
    g.add(windows('+x', w, d, [0], 0.3, 0.5, 0.36, { frame: C.blue, cross: false }));
    g.add(windows('-x', w, d, [0], 0.3, 0.5, 0.36, { frame: C.blue, cross: false }));
    // phone icons on the band (front) and a giant phone on the roof
    for (const x of [-w / 2 + 0.3, 0.1]) {
      const p = symbol('phone', 0.2);
      p.position.set(x, H - 0.03, d / 2 + 0.05);
      g.add(p);
    }
    const big = symbol('phone', 0.62);
    big.position.set(-0.1, H + 0.62, 0);
    // turned to face the viewer (the shop is turned a quarter: its door is on the +X face)
    big.rotation.y = -Math.PI / 4;
    g.add(big);
    g.add(box(0.3, 0.08, 0.2, C.stoneDark, { x: -0.1, y: H + 0.05 }));
    // a little canopy over the door
    g.add(box(0.5, 0.04, 0.26, C.blue, { x: 0.48, y: 0.74, z: d / 2 + 0.12 }));
    return { object: g };
  },

  /** Lily: the park: a hedge round a lawn, a wooden gate arch with a leaf sign, trees, flowers and a bench. */
  async park({ front, deep }) {
    const w = front - 2 * M;
    const d = deep - 2 * M;
    const g = group(box(w, 0.04, d, '#86c96a', { r: 0.02 }));
    // hedges round three sides and the front on both sides of the gate
    g.add(hedge(w, { z: -d / 2 + 0.1, h: 0.26 }));
    g.add(hedge(d, { x: -w / 2 + 0.1, ry: Math.PI / 2, h: 0.26 }));
    g.add(hedge(d, { x: w / 2 - 0.1, ry: Math.PI / 2, h: 0.26 }));
    const gap = 0.56;
    const side = (w - gap) / 2;
    g.add(hedge(side, { x: -w / 2 + side / 2, z: d / 2 - 0.1, h: 0.26 }));
    g.add(hedge(side, { x: w / 2 - side / 2, z: d / 2 - 0.1, h: 0.26 }));
    // the path from the gate
    g.add(box(0.42, 0.05, d * 0.55, C.sand, { z: d / 2 - d * 0.275, r: 0.02 }));
    // the arch
    const ax = gap / 2 + 0.02;
    const az = d / 2 - 0.1;
    g.add(box(0.08, 1.1, 0.08, C.wood, { x: -ax, z: az }), box(0.08, 1.1, 0.08, C.wood, { x: ax, z: az }));
    for (const x of [-ax - 0.12, ax + 0.12]) {
      g.add(box(0.03, 0.6, 0.03, C.iron, { x, z: az + 0.02 }), ball(0.06, mat(C.gold, { glow: '#ffe08a' }), { x, y: 0.66, z: az + 0.02, detail: 2 }));
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(ax, 0.045, 8, 20, Math.PI), mat(C.wood));
    arch.position.set(0, 1.1, az);
    g.add(arch);
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI;
      g.add(ball(0.06, i % 2 ? C.leaf : C.pink, { x: Math.cos(a) * ax, y: 1.1 + Math.sin(a) * ax, z: az + 0.03, detail: 1 }));
    }
    const sign = discSign(0.15, C.cream, C.wood);
    sign.position.set(0, 1.1 + ax + 0.12, az + 0.02);
    const leaf = symbol('leaf', 0.22);
    leaf.position.set(0, 1.1 + ax + 0.12, az + 0.06);
    g.add(sign, leaf);
    // two round trees, flowers, a bench
    for (const [x, z, s] of [[-w / 2 + 0.45, -d / 2 + 0.45, 1], [w / 2 - 0.42, -d / 2 + 0.55, 0.85]]) {
      g.add(cyl(0.05, 0.5 * s, C.trunk, { x, z, top: 0.035 }));
      g.add(ball(0.32 * s, C.leaf, { x, y: 0.62 * s, z, detail: 1 }));
      g.add(ball(0.22 * s, C.leafLight, { x: x - 0.12 * s, y: 0.78 * s, z: z + 0.08, detail: 1 }));
    }
    g.add(flowersRow(0.5, { x: -w / 2 + 0.45, z: 0.15, colors: [C.pink, C.yellow, C.white] }));
    g.add(flowersRow(0.5, { x: w / 2 - 0.45, z: 0.15, colors: [C.purple, C.pink, C.white] }));
    const bench = group(box(0.5, 0.04, 0.16, C.wood, { y: 0.2 }), box(0.5, 0.14, 0.03, C.wood, { y: 0.26, z: -0.07 }), box(0.04, 0.2, 0.12, C.iron, { x: -0.2 }), box(0.04, 0.2, 0.12, C.iron, { x: 0.2 }));
    bench.position.set(0.05, 0, -d / 2 + 0.38);
    g.add(bench);
    return { object: g };
  },

  /** Tom: the notice board: a roofed wooden board covered in notes, on a little paved square with planters. */
  async board({ front, deep }) {
    const w = front - 2 * M;
    const d = deep - 2 * M;
    const g = group(box(w * 0.92, 0.05, d * 0.7, C.paving, { r: 0.02, z: 0.1 }));
    const bw = 1.3;
    const by = 0.32;
    const bh = 0.72;
    const bz = -0.1;
    g.add(box(0.08, by + bh + 0.2, 0.08, C.woodDark, { x: -bw / 2 - 0.02, z: bz }), box(0.08, by + bh + 0.2, 0.08, C.woodDark, { x: bw / 2 + 0.02, z: bz }));
    g.add(box(bw, bh, 0.08, C.woodDark, { y: by, z: bz }));
    g.add(box(bw - 0.1, bh - 0.1, 0.04, '#d9b07a', { y: by + 0.05, z: bz + 0.04 }));
    const notes = [
      [-0.45, 0.62, 0.26, 0.3, C.white],
      [-0.12, 0.7, 0.22, 0.2, C.yellow],
      [0.2, 0.6, 0.3, 0.26, C.pink],
      [0.46, 0.72, 0.18, 0.2, C.sky],
      [-0.36, 0.38, 0.22, 0.2, C.leafLight],
      [0.0, 0.36, 0.26, 0.24, C.white],
      [0.36, 0.4, 0.24, 0.2, C.yellow],
    ];
    for (const [x, y, nw, nh, col] of notes) {
      g.add(box(nw, nh, 0.012, col, { x, y: by + y - nh / 2 + 0.08, z: bz + 0.065, rz: (x * 7) % 0.12 }));
      g.add(ball(0.018, C.red, { x, y: by + y + 0.08 - 0.03, z: bz + 0.08, detail: 1 }));
    }
    g.add(gableRoof(bw + 0.2, 0.36, by + bh + 0.18, 0.2, '#7ab66a', C.woodDark, { ov: 0.06 }).translateZ(bz));
    // a lantern under the roof's front edge
    g.add(box(0.015, 0.12, 0.015, C.iron, { y: by + bh + 0.06, z: bz + 0.2 }), box(0.09, 0.12, 0.09, mat(C.gold, { glow: '#ffe08a' }), { y: by + bh - 0.07, z: bz + 0.2, r: 0.02 }));
    for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) {
      g.add(box(0.3, 0.22, 0.3, C.wood, { x, z: d / 2 - 0.25, r: 0.03 }));
      g.add(ball(0.16, C.leaf, { x, y: 0.32, z: d / 2 - 0.25, detail: 1 }));
      g.add(ball(0.05, C.pink, { x: x + 0.08, y: 0.42, z: d / 2 - 0.18, detail: 1 }));
    }
    return { object: g };
  },
};

addRecipes({
  /**
   * A place: args { id, front, deep, face }. face 'x' = the door on the +X face: built facing +Z and turned.
   */
  async place({ id, front, deep, face }) {
    const built = await RECIPES[id]({ front, deep });
    const outer = group(built.object);
    if (face === 'x') built.object.rotation.y = Math.PI / 2;
    outer.updateMatrixWorld(true);
    const info = {};
    for (const [k, v] of Object.entries(built.info ?? {})) info[k] = built.object.localToWorld(v.clone());
    return { object: outer, info };
  },
});

export { RECIPES as PLACE_RECIPES };
