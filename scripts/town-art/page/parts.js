// Shared building parts for the town's recipes: colours, roofs, windows, doors, awnings, signs with symbols.
// One three.js unit = one tile edge; a person stands about 1.17 units tall, so a storey is about 0.85.

import { THREE, box, cyl, ball, group, mat, slab } from './recipes.js';

/** The town's colours (screen colours, sRGB). The places keep the roof colours the learner already knows. */
export const C = {
  white: '#fbfaf6',
  cream: '#fbf1dc',
  sand: '#f3e3c3',
  peach: '#f8dcc0',
  wood: '#c98f5e',
  woodDark: '#8a5a3a',
  trunk: '#8d6548',
  iron: '#4a4f66',
  stone: '#cfd3dc',
  stoneDark: '#a9aebb',
  paving: '#e6dccb',
  glass: '#a9d8f2',
  glassDark: '#6fa8cf',
  door: '#7a5a48',
  leaf: '#6fbf63',
  leafLight: '#8fd16a',
  leafDark: '#4fa15a',
  pine: '#3f9a78',
  pineDark: '#2f7d68',
  blossom: '#f7a8c6',
  blossomLight: '#ffd3e2',
  pink: '#f58fb0',
  red: '#ef5d5d',
  coral: '#ef6b5b',
  orange: '#f2a541',
  yellow: '#ffc93c',
  gold: '#ffcf6a',
  teal: '#3fb7a6',
  mint: '#63c7b2',
  blue: '#4f8fe0',
  sky: '#8fd1ff',
  purple: '#8f73d6',
  violet: '#6a51b5',
  green: '#6fbf63',
  earth: '#b98a5e',
  dirt: '#c9a273',
  water: '#7fcfe6',
  ink: '#2b2f45',
};

/** Warm window light at night (the lit layer). */
export const WINDOW_GLOW = '#ffd27a';

export const glassMat = (color = C.glass) => mat(color, { glow: WINDOW_GLOW, rough: 0.35 });

/**
 * A pitched roof along X over a `len` × `span` box whose walls end at height `y`: two roof planes `h` high with
 * an overhang, and the gable walls (triangles) in `wall` colour. Ridge along X at z = 0.
 */
export function gableRoof(len, span, y, h, roof, wall, { ov = 0.1, t = 0.07 } = {}) {
  const half = span / 2;
  const a = Math.atan2(h, half);
  const L = Math.hypot(half, h) + ov;
  const g = group();
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(len + ov * 2, t, L), mat(roof));
    // the plane runs from the ridge down to past the eave
    const mid = new THREE.Vector3(0, y + h - (Math.sin(a) * L) / 2, s * ((Math.cos(a) * L) / 2));
    const n = new THREE.Vector3(0, Math.cos(a), s * Math.sin(a));
    p.position.copy(mid.addScaledVector(n, t / 2));
    p.rotation.x = s * a;
    g.add(p);
  }
  const tri = new THREE.Shape();
  tri.moveTo(-half, 0);
  tri.lineTo(half, 0);
  tri.lineTo(0, h);
  tri.closePath();
  const geo = new THREE.ExtrudeGeometry(tri, { depth: len - 0.02, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  geo.translate((len - 0.02) / 2, y, 0);
  g.add(new THREE.Mesh(geo, mat(wall)));
  // a ridge cap
  g.add(box(len + ov * 2 + 0.02, 0.05, 0.08, roof, { y: y + h - 0.01 }));
  return g;
}

/** A pyramid / cone roof: `seg` sides (4 = a square hip roof turned to the walls). */
export function pyramidRoof(r, h, y, color, { seg = 4, sx = 1, sz = 1 } = {}) {
  const geo = new THREE.ConeGeometry(r, h, seg, 1);
  if (seg === 4) geo.rotateY(Math.PI / 4);
  geo.scale(sx, 1, sz);
  geo.translate(0, y + h / 2, 0);
  return new THREE.Mesh(geo, mat(color, { flat: true }));
}

/**
 * Windows on a wall face. face: '+z' | '-z' | '+x' | '-x' of a box `w` (x) × `d` (z) centred on the origin;
 * `us` = positions along the face, at height y (bottom), each ww × wh, with a frame.
 */
export function windows(face, w, d, us, y, ww, wh, { frame = C.white, glass = C.glass, sill = true, cross = true } = {}) {
  const g = group();
  const axis = face[1];
  const sign = face[0] === '+' ? 1 : -1;
  const out = (axis === 'z' ? d : w) / 2;
  for (const u of us) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, 0.04), glassMat(glass));
    const fr = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.08, wh + 0.08, 0.03), mat(frame));
    const parts = [fr, pane];
    if (cross) {
      parts.push(new THREE.Mesh(new THREE.BoxGeometry(0.03, wh, 0.05), mat(frame)));
      parts.push(new THREE.Mesh(new THREE.BoxGeometry(ww, 0.03, 0.05), mat(frame)));
    }
    if (sill) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.14, 0.04, 0.09), mat(frame));
      s.position.set(0, -wh / 2 - 0.03, 0.03);
      parts.push(s);
    }
    const one = group(parts);
    one.position.y = y + wh / 2;
    if (axis === 'z') {
      one.position.x = u;
      one.position.z = sign * (out + 0.01);
      one.rotation.y = sign > 0 ? 0 : Math.PI;
    } else {
      one.position.z = u;
      one.position.x = sign * (out + 0.01);
      one.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    g.add(one);
  }
  return g;
}

/** A door on the +z face of a box `d` deep, at x = u: frame, panel, knob, a step. */
export function door(d, u, { w = 0.38, h = 0.66, color = C.door, frame = C.white, glass = false, step = C.stone } = {}) {
  const z = d / 2;
  const g = group(
    box(w + 0.1, h + 0.06, 0.04, frame, { x: u, z: z + 0.01 }),
    glass
      ? box(w, h, 0.05, glassMat(), { x: u, z: z + 0.02 })
      : box(w, h, 0.05, color, { x: u, z: z + 0.02 }),
    ball(0.025, C.gold, { x: u + w * 0.32, y: h * 0.5, z: z + 0.06 }),
    step ? box(w + 0.24, 0.06, 0.18, step, { x: u, z: z + 0.09 }) : null,
  );
  if (glass) g.add(box(0.03, h, 0.06, frame, { x: u, z: z + 0.03 }));
  return g;
}

/** A striped awning over the +z face (along x, `w` wide), sloping out from height y. */
export function awning(w, d, y, colors, { out = 0.34, drop = 0.16, stripes = 7, valance = true } = {}) {
  const g = group();
  const a = Math.atan2(drop, out);
  const L = Math.hypot(out, drop);
  const sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    const col = colors[i % colors.length];
    const p = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.002, 0.03, L), mat(col));
    p.position.set(-w / 2 + sw * (i + 0.5), y - drop / 2, d / 2 + out / 2);
    p.rotation.x = a;
    g.add(p);
    if (valance) {
      // the hanging edge
      g.add(box(sw, 0.08, 0.025, col, { x: -w / 2 + sw * (i + 0.5), y: y - drop - 0.08, z: d / 2 + out + 0.005 }));
    }
  }
  return g;
}

/** A round sign disc facing +z (a symbol goes on it), on a bracket. */
export function discSign(r, color, rim = C.white) {
  const g = group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 28), mat(color));
  disc.rotation.x = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 28), mat(rim));
  g.add(disc, ring);
  return g;
}

// ---- symbols (no words): small 3D pictograms, built facing +z, about 1 unit across before scaling ----------------

export const SYMBOLS = {
  /** A coffee cup with steam. */
  cup(color = C.white, ink = C.woodDark) {
    const cup = cyl(0.26, 0.42, color, { top: 0.3, y: -0.25, seg: 20 });
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 8, 16), mat(color));
    handle.position.set(0.3, -0.04, 0);
    const coffee = cyl(0.27, 0.02, ink, { y: 0.16, seg: 20 });
    const saucer = cyl(0.42, 0.04, color, { y: -0.3, seg: 24 });
    const steam = [-0.08, 0.1].map((x) =>
      new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.25, 0), new THREE.Vector3(x + 0.07, 0.37, 0), new THREE.Vector3(x - 0.04, 0.5, 0), new THREE.Vector3(x + 0.04, 0.62, 0)]), 12, 0.025, 6),
        mat(color),
      ),
    );
    return group(cup, handle, coffee, saucer, steam);
  },
  /** A shopping basket. */
  basket(color = C.orange, fruit = [C.red, C.leafLight, C.yellow]) {
    const b = cyl(0.32, 0.3, color, { top: 0.42, y: -0.3, seg: 4 });
    b.rotation.y = Math.PI / 4;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 20, Math.PI), mat(color));
    handle.position.y = 0;
    const fr = fruit.map((c, i) => ball(0.12, c, { x: -0.16 + i * 0.16, y: 0.03 + (i % 2) * 0.05, z: 0.05 }));
    return group(b, handle, fr);
  },
  /** A phone: a dark rounded slab with a light screen. */
  phone(body = C.ink, screen = C.sky) {
    return group(
      box(0.5, 0.86, 0.1, body, { y: -0.43, r: 0.08 }),
      box(0.4, 0.62, 0.02, mat(screen, { glow: '#bfe8ff' }), { y: -0.3, z: 0.055 }),
      ball(0.04, C.stone, { y: -0.36, z: 0.06 }),
    );
  },
  /** A cross (the clinic). */
  cross(color = C.red) {
    return group(box(0.26, 0.8, 0.12, color, { y: -0.4 }), box(0.8, 0.26, 0.12, color, { y: -0.13 }));
  },
  /** A film reel. */
  reel(color = C.gold, hole = C.violet) {
    const g = group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 32), mat(color));
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), mat(hole));
      h.rotation.x = Math.PI / 2;
      h.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.01);
      g.add(h);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), mat(hole));
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.01;
    g.add(hub);
    return g;
  },
  /** A five-pointed star. */
  star(color = C.gold, r = 0.5) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
    return new THREE.Mesh(geo, mat(color));
  },
  /** A bus seen from the front-side: the bus stop's sign. */
  bus(color = C.white) {
    return group(
      box(0.7, 0.5, 0.06, color, { y: -0.3, r: 0.06 }),
      box(0.56, 0.2, 0.02, C.blue, { y: -0.04, z: 0.035 }),
      ball(0.08, color, { x: -0.2, y: -0.34, z: 0 }),
      ball(0.08, color, { x: 0.2, y: -0.34, z: 0 }),
    );
  },
  /** A leaf (the park). */
  leaf(color = C.leaf) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.45);
    s.quadraticCurveTo(0.42, -0.1, 0, 0.45);
    s.quadraticCurveTo(-0.42, -0.1, 0, -0.45);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 12 });
    const m = new THREE.Mesh(geo, mat(color));
    m.rotation.z = -0.5;
    return group(m, box(0.03, 0.5, 0.11, C.leafDark, { y: -0.3, rz: -0.5 }));
  },
  /** A clock face (the school). */
  clock(face = C.white, rim = C.woodDark) {
    const g = group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 32), mat(face));
    disc.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 32), mat(rim));
    g.add(disc, ring);
    const hand = (len, a, t) => {
      const m = box(t, len, 0.03, C.ink, { y: 0 });
      m.geometry.translate(0, 0, 0);
      const p = group(m);
      p.rotation.z = a;
      p.position.z = 0.04;
      return p;
    };
    g.add(hand(0.3, -0.9, 0.05), hand(0.22, 0.6, 0.06));
    return g;
  },
};

/** A symbol scaled to `size` units, on a sign. */
export function symbol(name, size, ...args) {
  const s = SYMBOLS[name](...args);
  s.scale.setScalar(size);
  return s;
}

export { THREE, box, cyl, ball, group, mat, slab };
