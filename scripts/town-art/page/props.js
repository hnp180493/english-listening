// Everything in the town that is not a place: empty lots (a construction site, a grass patch), trees, bushes,
// rocks, the decorations the learner buys, the bus, the café's terrace, string lights and the cat. Same units and
// colours as places.js.

import { addRecipes, kit } from './recipes.js';
import { C, THREE, box, cyl, ball, group, mat } from './parts.js';

const hash = (...n) => {
  let h = 2166136261;
  for (const v of n) h = Math.imul(h ^ Math.floor(v * 1000 + 7), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

/** Leaves as a cluster of faceted blobs (Kenney's nature style). */
function crown(blobs, color, light, { detail = 1 } = {}) {
  const g = group();
  blobs.forEach(([x, y, z, r], i) => g.add(ball(r, i % 3 === 2 ? light : color, { x, y, z, detail })));
  return g;
}

function flowerHeads(n, r, y, seed, colors) {
  const g = group();
  for (let i = 0; i < n; i++) {
    const a = hash(seed, i) * Math.PI * 2;
    const d = Math.sqrt(hash(i, seed, 3)) * r;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const h = y + hash(seed, i, 5) * 0.06;
    g.add(box(0.012, h, 0.012, C.leafDark, { x, z }));
    g.add(ball(0.045, colors[i % colors.length], { x, y: h + 0.02, z, detail: 1 }));
    g.add(ball(0.018, C.yellow, { x, y: h + 0.045, z, detail: 0 }));
  }
  return g;
}

const RECIPES = {
  // ---- empty lots ------------------------------------------------------------------------------------------------

  /** The next place to build: bare earth, barriers, cones, a lamp, planks and bricks waiting. args { w, d } (tiles). */
  async lotSite({ w, d }) {
    const iw = w - 0.3;
    const id = d - 0.3;
    const g = group(box(iw, 0.04, id, C.dirt, { r: 0.02 }));
    // furrows
    for (let i = 0; i < 3; i++) g.add(box(iw * 0.7, 0.02, 0.05, '#b48a5c', { y: 0.03, z: -id / 4 + (i * id) / 4 }));
    // a low striped fence round the plot, open at the front corner; cones on the far corners
    const fence = (len, x, z, ry) => {
      const f = group();
      const n = Math.max(2, Math.round(len / 0.34));
      for (let i = 0; i <= n; i++) f.add(box(0.04, 0.26, 0.04, C.woodDark, { x: -len / 2 + (len / n) * i }));
      for (let i = 0; i < n; i++) {
        for (const y of [0.1, 0.19]) f.add(box(len / n - 0.02, 0.05, 0.02, i % 2 ? '#ffffff' : '#f28a3c', { x: -len / 2 + (len / n) * (i + 0.5), y }));
      }
      f.position.set(x, 0, z);
      f.rotation.y = ry;
      g.add(f);
    };
    fence(iw, 0, -id / 2, 0);
    fence(id, -iw / 2, 0, Math.PI / 2);
    fence(iw * 0.6, iw * 0.2, id / 2, 0);
    fence(id * 0.6, iw / 2, -id * 0.2, Math.PI / 2);
    for (const [x, z] of [[-iw / 2 + 0.12, id / 2 - 0.12], [iw / 2 - 0.12, id / 2 - 0.12]]) {
      g.add(await kit('road/construction_pylon', { x, z, s: 3.4 }));
    }
    // the wooden frame of the house to come, at the back
    const fw = Math.min(iw, id) * 0.55;
    const fx = -iw / 2 + fw / 2 + 0.2;
    const fz = -id / 2 + fw / 2 + 0.2;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.06, 0.9, 0.06, '#d9a16e', { x: fx + (dx * fw) / 2, z: fz + (dz * fw) / 2 }));
    g.add(box(fw + 0.06, 0.06, 0.06, '#d9a16e', { x: fx, y: 0.9, z: fz - fw / 2 }), box(fw + 0.06, 0.06, 0.06, '#d9a16e', { x: fx, y: 0.9, z: fz + fw / 2 }));
    g.add(box(0.06, 0.06, fw + 0.06, '#d9a16e', { x: fx - fw / 2, y: 0.9 }).translateZ(fz), box(0.06, 0.06, fw + 0.06, '#d9a16e', { x: fx + fw / 2, y: 0.9 }).translateZ(fz));
    g.add(box(fw + 0.06, 0.06, 0.06, '#d9a16e', { x: fx, y: 0.45, z: fz + fw / 2 }));
    const brace = box(0.05, Math.hypot(fw, 0.9), 0.05, '#c98f5e', { x: fx, y: 0, z: fz - fw / 2 });
    brace.position.set(fx, 0.45, fz - fw / 2);
    brace.rotation.z = Math.atan2(fw, 0.9);
    g.add(brace);
    g.add(await kit('road/construction_light', { x: iw / 2 - 0.05, z: id / 2 - 0.05, s: 3.2, glow: { light: '#ffb347' } }));
    // a stack of planks and a pallet of bricks
    for (let i = 0; i < 4; i++) g.add(box(0.7, 0.05, 0.1, i % 2 ? C.wood : '#d9a16e', { x: -0.15, y: 0.04 + i * 0.05, z: -0.25 + (i % 2) * 0.02, ry: 0.1 }));
    const bricks = group(box(0.44, 0.05, 0.34, C.wood));
    for (let i = 0; i < 12; i++) bricks.add(box(0.13, 0.07, 0.07, '#d77a5c', { x: -0.14 + (i % 3) * 0.14, y: 0.05 + Math.floor(i / 6) * 0.075, z: -0.12 + (Math.floor(i / 3) % 2) * 0.12 + 0.06 }));
    bricks.position.set(iw / 2 - 0.5, 0, -0.1);
    g.add(bricks);
    // a little sign board with the construction stripes (no words)
    const sign = group(box(0.04, 0.5, 0.04, C.woodDark, { x: -0.18 }), box(0.04, 0.5, 0.04, C.woodDark, { x: 0.18 }));
    const plate = group();
    for (let i = 0; i < 5; i++) plate.add(box(0.09, 0.22, 0.03, i % 2 ? '#2b2f45' : C.yellow, { x: -0.18 + i * 0.09, y: 0.32 }));
    sign.add(plate);
    sign.position.set(-iw / 2 + 0.45, 0, id / 2 - 0.25);
    g.add(sign);
    return { object: g };
  },

  /** A lot not on offer yet: a soft grass patch with flowers and two stakes. args { w, d }. */
  async lotGrass({ w, d }) {
    const iw = w - 0.3;
    const id = d - 0.3;
    const g = group(box(iw, 0.03, id, '#a6d987', { r: 0.015 }));
    g.add(flowerHeads(Math.round(iw * id * 4), Math.min(iw, id) * 0.42, 0.06, w * 7 + d, [C.white, C.yellow, C.pink, '#c9b1ff']));
    for (const [x, z] of [[-iw / 2 + 0.05, id / 2 - 0.05], [iw / 2 - 0.05, -id / 2 + 0.05], [iw / 2 - 0.05, id / 2 - 0.05]]) {
      g.add(box(0.04, 0.16, 0.04, C.wood, { x, z }));
    }
    for (let i = 0; i < 3; i++) g.add(ball(0.06 + hash(i, w) * 0.04, C.stone, { x: -iw / 3 + hash(w, i) * iw * 0.6, y: 0.02, z: -id / 3 + hash(d, i, 2) * id * 0.6, detail: 0, s: [1, 0.6, 1] }));
    return { object: g };
  },

  // ---- trees, bushes, rocks -------------------------------------------------------------------------------------

  /** A round leafy tree (variant 0..2). */
  async treeRound({ v = 0 }) {
    const s = [1, 0.9, 1.1][v];
    const tint = [[C.leaf, C.leafLight], ['#7cc96a', '#a5dd7d'], ['#5fb35e', C.leafLight]][v];
    const g = group(cyl(0.07 * s, 0.6 * s, C.trunk, { top: 0.05 * s, seg: 7 }));
    g.add(box(0.03, 0.2, 0.03, C.trunk, { x: 0.08, y: 0.3 * s, rz: -0.7 }));
    const blobs = [
      [[0, 0.95, 0, 0.42], [-0.22, 0.75, 0.08, 0.3], [0.24, 0.78, -0.05, 0.31], [0.05, 1.22, 0.05, 0.28], [0.02, 0.7, 0.24, 0.26]],
      [[0, 0.9, 0, 0.4], [-0.2, 0.72, -0.12, 0.28], [0.18, 0.7, 0.16, 0.28], [-0.05, 1.15, 0.0, 0.3]],
      [[0, 1.0, 0, 0.44], [0.25, 0.82, 0.1, 0.3], [-0.24, 0.85, -0.04, 0.32], [0.0, 1.3, -0.04, 0.27], [-0.05, 0.75, 0.26, 0.24]],
    ][v];
    const c = crown(blobs.map(([x, y, z, r]) => [x * s, y * s, z * s, r * s]), tint[0], tint[1]);
    g.add(c);
    return { object: g };
  },

  /** A pine: stacked cones (variant 0..1). */
  async treePine({ v = 0 }) {
    const s = [1, 0.85][v];
    const g = group(cyl(0.06 * s, 0.3 * s, C.trunk, { seg: 6 }));
    const tiers = [[0.42, 0.55, 0.22], [0.34, 0.5, 0.55], [0.25, 0.45, 0.86], [0.15, 0.32, 1.14]];
    tiers.forEach(([r, h, y], i) => g.add(cyl(r * s, h * s, i % 2 ? C.pine : '#46a37f', { top: 0.0, y: y * s, seg: 7, m: { flat: true } })));
    return { object: g };
  },

  /** Kenney's slim poplar, recoloured. */
  async treePoplar({ v = 0 }) {
    const t = await kit(v ? 'sub/tree_small' : 'sub/tree_large', { s: 1.9, paint: { roof: v ? '#5fb35e' : C.leaf, wood: C.trunk } });
    return { object: t };
  },

  /** The cherry blossom the learner buys: a round tree in pinks, with petals on the ground. */
  async blossom() {
    const g = group(cyl(0.07, 0.6, '#7a5544', { top: 0.05, seg: 7 }));
    g.add(box(0.035, 0.26, 0.035, '#7a5544', { x: -0.08, y: 0.3, rz: 0.7 }));
    g.add(crown([[0, 0.95, 0, 0.42], [-0.24, 0.78, 0.05, 0.3], [0.24, 0.8, -0.04, 0.3], [0.04, 1.22, 0.04, 0.27], [0.0, 0.74, 0.25, 0.25], [-0.15, 1.08, -0.18, 0.22]], C.blossom, C.blossomLight));
    for (let i = 0; i < 9; i++) {
      const a = hash(i, 4) * Math.PI * 2;
      const d = 0.15 + hash(i, 9) * 0.35;
      g.add(box(0.05, 0.008, 0.04, i % 2 ? C.blossom : C.blossomLight, { x: Math.cos(a) * d, z: Math.sin(a) * d, ry: a }));
    }
    return { object: g };
  },

  async bush({ v = 0 }) {
    const g = v === 0
      ? crown([[0, 0.16, 0, 0.2], [0.17, 0.12, 0.05, 0.15], [-0.15, 0.12, 0.04, 0.15]], C.leafDark, C.leaf)
      : crown([[0, 0.14, 0, 0.17], [0.12, 0.1, -0.1, 0.13], [-0.1, 0.1, 0.1, 0.12]], '#5fb35e', C.leafLight);
    if (v === 0) g.add(ball(0.035, C.pink, { x: 0.05, y: 0.33, z: 0.12, detail: 1 }), ball(0.035, C.white, { x: -0.12, y: 0.24, z: 0.12, detail: 1 }));
    return { object: g };
  },

  async rock({ v = 0 }) {
    const g = v === 0
      ? group(ball(0.16, C.stoneDark, { y: 0.08, detail: 0, s: [1.2, 0.7, 1] }), ball(0.09, C.stone, { x: 0.17, y: 0.04, z: 0.06, detail: 0 }))
      : group(ball(0.1, C.stone, { y: 0.05, detail: 0, s: [1.3, 0.8, 1] }));
    return { object: g };
  },

  // ---- decorations ------------------------------------------------------------------------------------------------

  /** Street lamps: v 0 = the curved one (lamps1), 1 = the square one (lamps2). */
  async lamp({ v = 0 }) {
    const name = v ? 'road/light_square' : 'road/light_curved';
    const color = v ? '#3f6b5a' : C.iron;
    const S = 2.6;
    const l = await kit(name, { s: S, paint: { pavement: color, _defaultMat: '#fff6d6', light: '#fff6d6' } });
    // Kenney's lamp light faces the ground, out of sight from above: a glowing bulb under the head instead
    const head = v ? [0.58, 0.19] : [0.65, 0.18];
    const bulb = ball(0.065, mat('#fff3c4', { glow: '#ffe08a' }), { y: head[0] * S - 0.05, z: head[1] * S, s: [1, 0.8, 1], detail: 2 });
    // the arm points to the right of the screen, where it is seen side on
    const turned = group(l, bulb);
    turned.rotation.y = (3 * Math.PI) / 4;
    return { object: group(turned, cyl(0.09, 0.05, color)) };
  },

  /** A round flower bed in a low stone ring. */
  async flowers() {
    const g = group(cyl(0.34, 0.12, C.stoneDark, { seg: 18 }), cyl(0.3, 0.13, '#8a6a4c', { seg: 18 }));
    g.add(flowerHeads(14, 0.24, 0.2, 3, [C.pink, C.yellow, C.white, '#c9b1ff', '#ff9f6b']));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(ball(0.07, C.leaf, { x: Math.cos(a) * 0.2, y: 0.15, z: Math.sin(a) * 0.2, detail: 0 }));
    }
    return { object: g };
  },

  /** A park bench facing dir: 's' = +Z (towards the viewer, down-left), 'e' = +X (down-right), 'w' = -X. */
  async bench({ dir = 's' }) {
    const b = group(
      box(0.66, 0.045, 0.22, C.wood, { y: 0.22, r: 0.01 }),
      box(0.66, 0.045, 0.22, '#b07a4f', { y: 0.18, r: 0.01 }),
      box(0.66, 0.16, 0.035, C.wood, { y: 0.3, z: -0.1, r: 0.01 }),
      box(0.05, 0.22, 0.2, C.iron, { x: -0.27 }),
      box(0.05, 0.22, 0.2, C.iron, { x: 0.27 }),
      box(0.04, 0.24, 0.04, C.iron, { x: -0.27, y: 0.22, z: -0.1 }),
      box(0.04, 0.24, 0.04, C.iron, { x: 0.27, y: 0.22, z: -0.1 }),
    );
    b.rotation.y = { s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[dir];
    return { object: group(b) };
  },

  /** The pole the string lights hang from. info.top = where the strings are tied. */
  async lightPole() {
    const g = group(cyl(0.08, 0.06, C.stoneDark), cyl(0.035, 1.72, C.wood, { seg: 8 }), ball(0.05, C.woodDark, { y: 1.74, detail: 1 }));
    return { object: g, info: { top: new THREE.Vector3(0, 1.7, 0) } };
  },

  /**
   * One string of bulbs from a to b (three.js units from the item's origin, which is on the ground under the
   * middle), sagging in the middle. args { a: [x,y,z], b: [x,y,z], seed }.
   */
  async lights({ a, b, seed = 0 }) {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const sag = Math.min(0.5, len * 0.12);
    const at = (t) => A.clone().lerp(B, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag, 0));
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push(at(i / 24));
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.008, 4), mat('#3a3550'));
    wire.userData.noShadow = true;
    const g = group(wire);
    const inks = ['#ffd76b', '#ff8fab', '#8fd1ff', '#b8f08a'];
    const n = Math.max(4, Math.round(len / 0.32));
    for (let i = 1; i < n; i++) {
      const q = at(i / n);
      const col = inks[(i + seed) % inks.length];
      const bulb = ball(0.045, mat(col, { glow: col }), { x: q.x, y: q.y - 0.06, z: q.z, s: [1, 1.25, 1], detail: 3 });
      bulb.userData.noShadow = true;
      g.add(bulb);
    }
    return { object: g };
  },

  /** A water lily pad (v 0 with a pink flower). */
  async lily({ v = 0 }) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.22, 0.35, Math.PI * 2 - 0.1, false);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false, curveSegments: 18 });
    geo.rotateX(-Math.PI / 2);
    const pad = new THREE.Mesh(geo, mat(v ? '#7cc96a' : C.leaf));
    pad.rotation.y = v * 1.3;
    const g = group(pad);
    if (v === 0) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(ball(0.045, i % 2 ? C.blossomLight : '#ffffff', { x: -0.03 + Math.cos(a) * 0.04, y: 0.05, z: Math.sin(a) * 0.04, s: [1, 0.6, 1.6], ry: -a, detail: 1 }));
      }
      g.add(ball(0.025, C.yellow, { x: -0.03, y: 0.07, detail: 1 }));
    }
    return { object: g };
  },

  /** A market stall: counter with a cloth, fruit, a striped canopy and a lantern. */
  async stall() {
    const w = 0.8;
    const g = group(box(w, 0.4, 0.36, C.wood, { z: 0.05 }), box(w + 0.02, 0.18, 0.02, '#7ad1c2', { y: 0.12, z: 0.24 }));
    for (let i = 0; i < 4; i++) g.add(box(0.1, 0.18, 0.025, '#fffaf0', { x: -w / 2 + 0.1 + i * 0.2, y: 0.12, z: 0.245 }));
    const goods = [C.orange, C.coral, C.leafLight, C.yellow, C.orange, '#c9b1ff'];
    goods.forEach((col, i) => g.add(ball(0.06, col, { x: -0.25 + (i % 3) * 0.25, y: 0.46, z: -0.03 + Math.floor(i / 3) * 0.13, detail: 1 })));
    for (const x of [-w / 2, w / 2]) {
      g.add(box(0.04, 1.05, 0.04, C.woodDark, { x, z: -0.15 }));
      g.add(box(0.04, 0.85, 0.04, C.woodDark, { x, z: 0.25 }));
    }
    const stripes = 6;
    const a = Math.atan2(0.22, 0.5);
    for (let i = 0; i < stripes; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry((w + 0.2) / stripes, 0.03, 0.58), mat(i % 2 ? '#fffaf0' : C.pink));
      p.position.set(-(w + 0.2) / 2 + ((w + 0.2) / stripes) * (i + 0.5), 0.95, 0.06);
      p.rotation.x = a;
      g.add(p);
      g.add(box((w + 0.2) / stripes, 0.07, 0.02, i % 2 ? '#fffaf0' : C.pink, { x: -(w + 0.2) / 2 + ((w + 0.2) / stripes) * (i + 0.5), y: 0.76, z: 0.33 }));
    }
    g.add(ball(0.05, mat(C.gold, { glow: '#ffe08a' }), { y: 0.7, z: 0.22, detail: 3 }));
    return { object: g };
  },

  /** The plaza's fountain: v 0 = the small one always there, 1 = the big two-tier one the learner buys. */
  async fountain({ v = 0 }) {
    const water = mat('#8fd8ef', { rough: 0.25 });
    const g = group();
    if (v === 0) {
      g.add(cyl(0.4, 0.16, C.stone, { seg: 24 }), cyl(0.33, 0.14, water, { seg: 24, y: 0.03 }));
      g.add(cyl(0.06, 0.34, C.stone, { seg: 10 }), cyl(0.12, 0.05, C.stone, { y: 0.34, seg: 12 }));
      g.add(cyl(0.04, 0.12, mat('#d5f3fb', { opacity: 0.85, rough: 0.2 }), { y: 0.38, top: 0.01 }));
    } else {
      g.add(cyl(0.62, 0.08, C.stoneDark, { seg: 32 }), cyl(0.58, 0.2, C.stone, { seg: 32 }), cyl(0.52, 0.18, water, { seg: 32, y: 0.04 }));
      g.add(cyl(0.1, 0.55, C.stone, { seg: 12 }), cyl(0.3, 0.07, C.stone, { y: 0.52, seg: 24, top: 0.32 }), cyl(0.27, 0.05, water, { y: 0.55, seg: 24 }));
      g.add(cyl(0.05, 0.25, C.stone, { y: 0.58, seg: 10 }), ball(0.08, C.stone, { y: 0.84, detail: 3 }));
      const spray = mat('#d5f3fb', { opacity: 0.8, rough: 0.2 });
      g.add(cyl(0.05, 0.22, spray, { y: 0.88, top: 0.015 }));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const pts = [new THREE.Vector3(Math.cos(a) * 0.27, 0.6, Math.sin(a) * 0.27), new THREE.Vector3(Math.cos(a) * 0.36, 0.5, Math.sin(a) * 0.36), new THREE.Vector3(Math.cos(a) * 0.42, 0.22, Math.sin(a) * 0.42)];
        const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.018, 5), spray);
        t.userData.noShadow = true;
        g.add(t);
      }
    }
    return { object: g };
  },

  /** Three balloons tied to a little weight. */
  async balloons() {
    const g = group(box(0.07, 0.05, 0.07, C.stoneDark));
    const set = [[-0.16, 1.12, 0.02, C.pink], [0.06, 1.3, -0.04, C.yellow], [0.2, 1.08, 0.06, C.sky]];
    for (const [x, y, z, col] of set) {
      const s = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(x * 0.4, y * 0.5, z * 0.5), new THREE.Vector3(x, y - 0.14, z)]), 12, 0.006, 4), mat('#8a8fa8'));
      s.userData.noShadow = true;
      g.add(s);
      g.add(ball(0.13, mat(col, { rough: 0.45 }), { x, y, z, s: [1, 1.18, 1], detail: 3 }));
      g.add(cyl(0.025, 0.04, col, { x, y: y - 0.18, z, top: 0.0 }));
    }
    return { object: g };
  },

  /** A festival pole with a pennant and bunting down to two pegs (v = the colour set). */
  async flag({ v = 0 }) {
    const inks = [C.coral, C.teal, C.purple, C.yellow, C.pink];
    const g = group(cyl(0.06, 0.05, C.stoneDark), cyl(0.025, 1.6, '#f4efe4', { seg: 8 }), ball(0.05, C.yellow, { y: 1.62, detail: 3 }));
    const pen = new THREE.Shape();
    pen.moveTo(0, 0);
    pen.lineTo(0.42, -0.1);
    pen.lineTo(0, -0.24);
    const pg = new THREE.ExtrudeGeometry(pen, { depth: 0.012, bevelEnabled: false });
    const p = new THREE.Mesh(pg, mat(inks[v % inks.length], { double: true }));
    p.position.set(0.02, 1.55, 0);
    p.rotation.y = Math.PI / 4;
    g.add(p);
    for (const side of [-1, 1]) {
      const top = new THREE.Vector3(0, 1.2, 0);
      const peg = new THREE.Vector3(side * 0.55, 0.05, side * -0.1 + 0.3);
      const at = (t) => top.clone().lerp(peg, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 0.12, 0));
      const pts = [];
      for (let i = 0; i <= 10; i++) pts.push(at(i / 10));
      const w = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.006, 4), mat('#8a8fa8'));
      w.userData.noShadow = true;
      g.add(w);
      for (let i = 0; i < 5; i++) {
        const q0 = at((i + 0.6) / 6);
        const q1 = at((i + 1.2) / 6);
        const tri = new THREE.BufferGeometry().setFromPoints([q0, q1, q0.clone().lerp(q1, 0.5).add(new THREE.Vector3(0, -0.13, 0))]);
        tri.computeVertexNormals();
        g.add(new THREE.Mesh(tri, mat(inks[(i + v + (side > 0 ? 2 : 0)) % inks.length], { double: true })));
      }
      g.add(box(0.04, 0.06, 0.04, C.woodDark, { x: peg.x, z: peg.z }));
    }
    return { object: g };
  },

  /** The café's terrace: a round table, two stools, a striped parasol. */
  async terrace() {
    const g = group(cyl(0.03, 0.34, C.iron, { seg: 8 }), cyl(0.2, 0.03, '#fffaf0', { y: 0.34, seg: 20 }));
    for (const x of [-0.3, 0.3]) g.add(cyl(0.02, 0.2, C.iron, { x, seg: 6 }), cyl(0.09, 0.04, C.pink, { x, y: 0.2, seg: 14 }));
    g.add(cyl(0.04, 0.05, C.woodDark, { x: -0.06, y: 0.37, seg: 10 }), cyl(0.04, 0.05, C.teal, { x: 0.07, y: 0.37, z: 0.04, seg: 10 }));
    g.add(cyl(0.015, 1.25, C.woodDark, { seg: 6 }));
    const umb = new THREE.ConeGeometry(0.62, 0.26, 12, 1, true).toNonIndexed();
    const cols = [];
    const c = new THREE.Color();
    for (let i = 0; i < umb.attributes.position.count; i++) {
      c.set(Math.floor(i / 3) % 2 ? '#fffaf0' : C.pink).convertSRGBToLinear();
      cols.push(c.r, c.g, c.b);
    }
    umb.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    umb.computeVertexNormals();
    umb.translate(0, 1.18, 0);
    g.add(new THREE.Mesh(umb, mat('#ffffff', { vertexColors: true, flat: true, double: true })));
    return { object: g };
  },

  /** The town bus, waiting along the road (its length along +Z, the nose towards the viewer). */
  async bus() {
    const L = 1.62;
    const W = 0.62;
    const H = 0.7;
    const body = '#ffc93c';
    const g = group(box(W, H, L, body, { y: 0.12, r: 0.08 }));
    g.add(box(W + 0.02, 0.06, L + 0.02, '#e0a52a', { y: 0.22, r: 0.02 }));
    g.add(box(W - 0.06, 0.05, L - 0.08, '#ffe08a', { y: 0.82, r: 0.02 }));
    // windows along both sides and the windscreen
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        g.add(box(0.02, 0.24, 0.26, mat('#bfe3ff', { glow: '#ffd27a', rough: 0.3 }), { x: side * (W / 2 + 0.005), y: 0.48, z: -L / 2 + 0.26 + i * 0.33 }));
      }
    }
    g.add(box(W - 0.12, 0.3, 0.02, mat('#bfe3ff', { glow: '#ffd27a', rough: 0.3 }), { y: 0.46, z: L / 2 + 0.005 }));
    g.add(box(W - 0.06, 0.06, 0.03, C.stone, { y: 0.16, z: L / 2 + 0.01 }));
    for (const x of [-0.2, 0.2]) g.add(ball(0.045, mat('#fffaf0', { glow: '#fff3c4' }), { x, y: 0.3, z: L / 2 + 0.01, detail: 2 }));
    // wheels
    for (const z of [-L / 2 + 0.32, L / 2 - 0.32]) {
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16), mat(C.ink));
        w.rotation.z = Math.PI / 2;
        w.position.set(side * (W / 2 - 0.02), 0.13, z);
        g.add(w);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 10), mat(C.stone));
        hub.rotation.z = Math.PI / 2;
        hub.position.set(side * (W / 2 - 0.01), 0.13, z);
        g.add(hub);
      }
    }
    // the door on the right side
    g.add(box(0.02, 0.5, 0.24, '#e0a52a', { x: W / 2 + 0.006, y: 0.2, z: L / 2 - 0.28 }));
    return { object: g };
  },
};

// ---- the cat ------------------------------------------------------------------------------------------------------

const CAT = { fur: '#f2a65a', dark: '#d9853a', white: '#fff6ea', ink: C.ink, nose: C.pink };

/** A small low-poly ginger cat facing +Z, with poses for its walk and its sitting tail. */
function catModel() {
  const root = group();
  const body = group(box(0.17, 0.15, 0.34, CAT.fur, { y: -0.075, r: 0.06 }));
  body.add(box(0.12, 0.05, 0.26, CAT.white, { y: -0.085, r: 0.02 }));
  for (const z of [-0.06, 0.04]) body.add(box(0.172, 0.03, 0.04, CAT.dark, { y: 0.035, z }));
  body.position.set(0, 0.2, 0);
  root.add(body);
  const head = group(box(0.2, 0.17, 0.17, CAT.fur, { y: -0.085, r: 0.06 }));
  head.add(box(0.12, 0.07, 0.04, CAT.white, { y: -0.08, z: 0.08, r: 0.02 }));
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.08, 4), mat(CAT.fur, { flat: true }));
    ear.position.set(s * 0.06, 0.11, -0.01);
    ear.rotation.z = -s * 0.25;
    head.add(ear);
    head.add(box(0.03, 0.035, 0.012, CAT.ink, { x: s * 0.045, y: 0.0, z: 0.086, r: 0.005 }));
  }
  head.add(box(0.03, 0.02, 0.012, CAT.nose, { y: -0.035, z: 0.088 }));
  root.add(head);
  const legs = [];
  const legBase = [];
  for (const [x, z] of [[-0.05, 0.12], [0.05, 0.12], [-0.05, -0.12], [0.05, -0.12]]) {
    const leg = group(box(0.05, 0.14, 0.05, CAT.fur, { y: -0.14, r: 0.015 }), box(0.055, 0.03, 0.06, CAT.white, { y: -0.15, z: 0.005, r: 0.01 }));
    leg.position.set(x, 0.15, z);
    legBase.push([x, z]);
    root.add(leg);
    legs.push(leg);
  }
  const tail = new THREE.Mesh(new THREE.BufferGeometry(), mat(CAT.dark));
  root.add(tail);
  const setTail = (pts) => {
    tail.geometry.dispose();
    tail.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 16, 0.025, 6);
  };
  return { root, body, head, legs, legBase, setTail };
}

addRecipes({
  ...RECIPES,
  /**
   * The cat: poses = walk (6 frames) and sit (4 frames, the tail swaying), each in the directions `dirs`
   * (yaw as the people: render.js DIR_YAW). Keys `walk/<dir>/<i>`, `sit/<dir>/<i>`.
   */
  async cat({ dirs, walkFrames = 6, sitFrames = 4, yaw }) {
    const m = catModel();
    const outer = group(m.root);
    const poses = [];
    for (const dir of dirs) {
      for (let i = 0; i < walkFrames; i++) {
        const ph = (i / walkFrames) * Math.PI * 2;
        poses.push({
          key: `walk/${dir}/${i}`,
          apply() {
            m.root.rotation.set(0, yaw[dir], 0);
            m.body.position.set(0, 0.2 + Math.abs(Math.sin(ph)) * 0.01, 0);
            m.body.rotation.set(0, 0, 0);
            m.head.position.set(0, 0.32 + Math.abs(Math.sin(ph)) * 0.01, 0.2);
            m.head.rotation.set(0, 0, 0);
            m.legs.forEach((l, k) => {
              l.position.set(m.legBase[k][0], 0.15, m.legBase[k][1]);
              l.rotation.set(Math.sin(ph + (k === 0 || k === 3 ? 0 : Math.PI)) * 0.55, 0, 0);
            });
            const sw = Math.sin(ph) * 0.04;
            m.setTail([[0, 0.24, -0.16], [sw, 0.34, -0.24], [sw * 2, 0.46, -0.24], [sw * 2.5, 0.52, -0.18]]);
          },
        });
      }
      for (let i = 0; i < sitFrames; i++) {
        const sw = Math.sin((i / sitFrames) * Math.PI * 2);
        poses.push({
          key: `sit/${dir}/${i}`,
          apply() {
            m.root.rotation.set(0, yaw[dir], 0);
            m.body.position.set(0, 0.2, -0.04);
            m.body.rotation.set(-0.75, 0, 0);
            m.head.position.set(0, 0.42, 0.06);
            m.head.rotation.set(0.1, sw * 0.12, 0);
            m.legs.forEach((l, k) => {
              if (k < 2) {
                l.position.set(m.legBase[k][0], 0.15, 0.06);
                l.rotation.set(0, 0, 0);
              } else {
                l.position.set(m.legBase[k][0], 0.08, -0.1);
                l.rotation.set(-1.4, 0, 0);
              }
            });
            m.setTail([[0, 0.05, -0.16], [0.12 + sw * 0.02, 0.03, -0.12], [0.16, 0.03, 0.02], [0.1 + sw * 0.03, 0.04, 0.14]]);
          },
        });
      }
    }
    // the box used to frame every pose: the cat standing and sitting, turned every way
    poses[0].apply();
    return { object: outer, poses, frameBox: { r: 0.42, h: 0.62 } };
  },
});
