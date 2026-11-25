// The eighteen places of Westbay (data/cityWorld.ts CITY_PLACES), each built in code in the town's one style
// (three/scene/kit.ts): registered with the town's recipes (three/scene/places3d.ts) when the city's page loads.
// A place blocks as much as its lot less 0.14 all round (core/town/colliders.ts placeColliders, the default): what
// stands on the ground stays inside that.
//
// Each says something about its owner (docs/city.md §2–3): the station's clock tower and arched entrance, the blue
// scarf on Pete's rail, Tess's cart under its umbrella, Rico's chequered band and roof light, Nora's sunflowers in
// buckets, Maya's pram with a sunflower on its hood, Frank's crates of comics, Poppy's two chimneys, Gianna's
// red-white-green awning and chalkboard, Hal's ice and Amira's bowls of spice, Jonah's open guitar case, Bo's pink neon
// and stage light, Dana's table for two, the Lumen's marquee and blade sign, Wren's booth, the bookshop's cart of books
// and Bay FM's ON AIR light and mast.
//
// The three later districts add nineteen: Meridian's glass head office and its globe, Whitlock's kiosk of papers, the
// Loom's saw-tooth workshop and mural, Hana's "i", FreshWay's leaf, Dev's monitors under a half-up shutter, the hospital's
// red crosses and helipad, Bridget's wheelchair, the phonetics lab's sound waves, ivy and cupola, the library's portico,
// Yuki's laptop and bicycle, Nell's green cross and scale, Jun's shelves of radios, Marcus's stage, Fay's big wheel,
// Captain Odile's lifebuoy and gangway, Gus's barrier, Mei's steamers and Sol's lanterns. (The bulb material has one
// colour of its own: whatever must read in a colour by day is body, with bulbs beside it for the night.)
import { CylinderGeometry, ExtrudeGeometry, Matrix4, Shape, TorusGeometry, type ColorRepresentation } from 'three';
import { awning, chimney, door, flatRoof, flowerBox, gableRoof, hipRoof, onFace, pot, pyramid, rel, signBoard, walls, windowOn, type Kit } from '../three/scene/kit';
import { shapes, type Merge, type Place } from '../three/scene/merge';
import { C } from '../three/scene/palette3d';
import { registerRecipes, type Recipe } from '../three/scene/places3d';

// ───────────────────────── shapes and helpers ─────────────────────────

/** A half ring standing up (an arch over a door or a window), its feet at y = 0. */
const arch = (r: number, tube: number) => shapes.custom(`cityArch${r},${tube}`, () => new TorusGeometry(r, tube, 6, 16, Math.PI));

/** A half disc standing up, its flat side down at y = 0, `t` thick along Z (a fan light, a sunburst). */
const halfDisc = (r: number, t: number) => shapes.custom(`cityHalfDisc${r},${t}`, () => new CylinderGeometry(r, r, t, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2));

/**
 * Build the house set back from the front of its lot by `back`: the walls stand in the back part, the strip in front
 * (inside the lot's collider) is left for what stands outside the door (buckets, a cart of books, a chalkboard).
 * The kit handed to `build` is the house's own (its D shorter, its middle moved back).
 */
function setBack(k: Kit, back: number, build: (s: Kit) => number): number {
  const m = new Matrix4().makeTranslation(0, 0, -back / 2);
  const s: Kit = { ...k, D: k.D - back };
  k.body.base = m;
  k.glass.base = m;
  k.bulbs.base = m;
  try {
    return build(s);
  } finally {
    k.body.base = null;
    k.glass.base = null;
    k.bulbs.base = null;
  }
}

/** The wider stretch of the front beside the door: its middle and its room. */
function besideDoor(k: Kit, u: number): { at: number; room: number } {
  const lo = -k.W / 2 + 0.08;
  const hi = k.W / 2 - 0.08;
  const left = u - 0.3 - lo;
  const right = hi - (u + 0.3);
  return right >= left ? { at: (u + 0.3 + hi) / 2, room: right } : { at: (lo + u - 0.3) / 2, room: left };
}

/** A wide shop window on the front: frame, glass, a sill. */
function shopWindow(k: Kit, at: number, v: number, w: number, h: number, frame: ColorRepresentation): void {
  const f = onFace(k, 'front', at, v, 0);
  k.body.add(shapes.box(w + 0.08, h + 0.08, 0.05, 0.02, 1), frame, rel(f, 0, 0, 0.02), { ao: false });
  k.glass.add(shapes.box(w, h, 0.03, 0.01, 1), C.glass, rel(f, 0, 0, 0.04));
  k.body.add(shapes.box(0.022, h, 0.025), frame, rel(f, 0, 0, 0.06), { ao: false });
  k.body.add(shapes.box(w + 0.14, 0.04, 0.1, 0.015, 1), frame, rel(f, 0, -h / 2 - 0.05, 0.05), { ao: false });
}

/** An awning of stripes in several colours (the café's awning, but any number of colours). */
function awningN(k: Kit, u: number, v: number, w: number, colors: readonly ColorRepresentation[], depth = 0.36): void {
  const f = onFace(k, 'front', u, v, 0);
  const n = Math.max(3, Math.round(w / 0.12));
  const sw = w / n;
  const tilt = 0.42;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + sw * (i + 0.5);
    const c = colors[i % colors.length];
    k.body.add(shapes.box(sw + 0.002, 0.04, depth, 0.015, 1), c, rel(f, x, -Math.sin(tilt) * depth * 0.5, Math.cos(tilt) * depth * 0.5, { rx: tilt }), { ao: false });
    k.body.add(shapes.sphere(sw * 0.5, 8, 5), c, rel(f, x, -Math.sin(tilt) * depth - 0.01, Math.cos(tilt) * depth, { s: [1, 0.55, 0.4] }), { ao: false });
  }
}

/**
 * A market stall's frame: four posts and a striped canopy sloping from `yBack` over the back down to `yFront` a little
 * past the front (over the customer's head, never on the ground outside the lot).
 */
function stall(k: Kit, yBack: number, yFront: number, colors: readonly ColorRepresentation[], post: ColorRepresentation = C.woodDark): void {
  const over = 0.22;
  const z0 = -k.D / 2 - 0.04;
  const z1 = k.D / 2 + over;
  const yAt = (z: number) => yBack - ((z - z0) / (z1 - z0)) * (yBack - yFront);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const z = sz * (k.D / 2 - 0.04);
      const h = yAt(z) - 0.02;
      k.body.add(shapes.box(0.06, h, 0.06, 0.02, 1), post, { x: sx * (k.W / 2 - 0.04), y: h / 2, z });
    }
  const len = Math.hypot(z1 - z0, yBack - yFront);
  const a = Math.atan2(yBack - yFront, z1 - z0);
  const w = k.W + 0.14;
  const n = Math.max(3, Math.round(w / 0.14)) | 1;
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + sw * (i + 0.5);
    const c = colors[i % colors.length];
    k.body.add(shapes.box(sw + 0.002, 0.04, len, 0.015, 1), c, { x, y: (yBack + yFront) / 2 + 0.02, z: (z0 + z1) / 2, rx: a }, { ao: false });
    k.body.add(shapes.sphere(sw * 0.5, 8, 5), c, { x, y: yFront - 0.01, z: z1, s: [1, 0.55, 0.4] }, { ao: false });
  }
}

/** An arched window: a tall window with a half-round fan light over it. */
function archWindow(k: Kit, face: 'front' | 'left' | 'right', at: number, v: number, w: number, h: number, frame: ColorRepresentation): void {
  windowOn(k, face, at, v, { w, h, frame });
  const f = onFace(k, face, at, v + h / 2 + 0.04, 0);
  k.glass.add(halfDisc(w / 2, 0.03), C.glass, rel(f, 0, 0, 0.04));
  k.body.add(arch(w / 2 + 0.03, 0.035), frame, rel(f, 0, 0, 0.03), { ao: false });
}

/** A sunflower facing front: a stem, a ring of petals as one disc, a brown middle. */
function sunflower(k: Kit, x: number, y: number, z: number, lean = 0): void {
  k.body.add(shapes.cyl(0.012, 0.014, y, 5), C.leafDeep, { x, y: y / 2, z, rz: lean }, { ao: false });
  const hx = x - Math.sin(lean) * y * 0.5;
  k.body.add(shapes.cyl(0.075, 0.075, 0.025, 10), C.mustard, { x: hx, y, z: z + 0.02, rx: Math.PI / 2 - 0.35 }, { ao: false });
  k.body.add(shapes.sphere(0.04, 8, 5), '#8a5a3c', { x: hx, y: y + 0.01, z: z + 0.04, s: [1, 1, 0.55] }, { ao: false });
}

const COMICS = [C.red, C.blue, C.mustard, C.mint, C.rose, C.orange, C.lilac, C.white] as const;

/** A number 0..1 that looks random but is always the same for the same `i` (ivy, bricks). */
function hash(i: number): number {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Like setBack, and also in from the right (+X) side by `side`: the strip along the right is left for what stands
 * there (a gangway). `build` gets the house's own kit and the door's offset along its narrower front.
 */
function setIn(k: Kit, back: number, side: number, build: (s: Kit, u: number) => number, u: number): number {
  const m = new Matrix4().makeTranslation(-side / 2, 0, -back / 2);
  const s: Kit = { ...k, W: k.W - side, D: k.D - back };
  k.body.base = m;
  k.glass.base = m;
  k.bulbs.base = m;
  try {
    return build(s, Math.max(-s.W / 2 + 0.3, Math.min(s.W / 2 - 0.3, u + side / 2)));
  } finally {
    k.body.base = null;
    k.glass.base = null;
    k.bulbs.base = null;
  }
}

/** A right-angled wedge `w` wide (X), `len` deep (Z): `h` high at its front (+Z) face, down to 0 at its back; foot at y = 0. */
const wedge = (w: number, len: number, h: number) =>
  shapes.custom(`cityWedge${w.toFixed(3)},${len.toFixed(3)},${h.toFixed(3)}`, () => {
    const sh = new Shape();
    sh.moveTo(0, 0);
    sh.lineTo(len, 0);
    sh.lineTo(0, h);
    sh.lineTo(0, 0);
    const g = new ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    g.translate(-(b.min.x + b.max.x) / 2, 0, -(b.min.z + b.max.z) / 2);
    return g;
  });

/** A triangle facing front (+Z), base `span` at y = 0, apex `h` up, `t` thick (a pediment). */
const pediment = (span: number, h: number, t: number) =>
  shapes.custom(`cityPediment${span.toFixed(3)},${h.toFixed(3)},${t.toFixed(3)}`, () => {
    const sh = new Shape();
    sh.moveTo(-span / 2, 0);
    sh.lineTo(span / 2, 0);
    sh.lineTo(0, h);
    sh.lineTo(-span / 2, 0);
    return new ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2);
  });

/** Half a drum standing up, its round side to the front (+Z), its flat side at z = 0 (a curved counter). */
const halfDrum = (r: number, h: number) => shapes.custom(`cityHalfDrum${r},${h}`, () => new CylinderGeometry(r, r, h, 16, 1, false, -Math.PI / 2, Math.PI));

/** A quarter ring (a radio wave), the same shape as Bay FM's sign. */
const waveArc = (r: number) => shapes.custom(`cityWave${r}`, () => new TorusGeometry(r, 0.015, 4, 10, Math.PI / 2));

/** A cross of two bars on a face spot (the hospital's red cross, the pharmacy's green one). */
function crossOn(m: Merge, p: Place, size: number, color: ColorRepresentation, t = 0.03): void {
  m.add(shapes.box(size, size * 0.32, t, 0.01, 1), color, p, { ao: false });
  m.add(shapes.box(size * 0.32, size, t, 0.01, 1), color, p, { ao: false });
}

/** A paper lantern hanging from a cord: its paper in a colour, a lit band round its middle, dark caps top and bottom. */
function lantern(k: Kit, x: number, y: number, z: number, color: ColorRepresentation, r = 0.055, cord = 0.08, tassel?: ColorRepresentation): void {
  k.body.add(shapes.cyl(0.004, 0.004, cord, 3), C.woodDark, { x, y: y + r * 1.2 + cord / 2, z }, { ao: false });
  k.body.add(shapes.cyl(r * 0.55, r * 0.55, 0.02, 8), '#3d4150', { x, y: y + r * 1.15, z }, { ao: false });
  // the paper in its colour; a band round its middle glows at night (the bulb material has one colour of its own)
  k.body.add(shapes.sphere(r, 10, 7), color, { x, y, z, s: [1, 1.2, 1] }, { ao: false });
  k.bulbs.add(shapes.cyl(r * 1.01, r * 1.01, r * 0.42, 10), C.glow, { x, y, z });
  k.body.add(shapes.cyl(r * 0.5, r * 0.5, 0.02, 8), '#3d4150', { x, y: y - r * 1.15, z }, { ao: false });
  if (tassel !== undefined) k.body.add(shapes.cone(0.015, 0.07, 5), tassel, { x, y: y - r * 1.15 - 0.045, z, rz: Math.PI }, { ao: false });
}

/** A planter box with a round shrub (in front of the offices). */
function planter(k: Kit, x: number, z: number, w = 0.4, color: ColorRepresentation = C.stone): void {
  k.body.add(shapes.box(w, 0.24, 0.24, 0.03, 1), color, { x, y: 0.12, z });
  k.body.add(shapes.box(w - 0.06, 0.02, 0.18, 0.01, 1), C.soil, { x, y: 0.245, z }, { ao: false });
  for (let i = 0; i < Math.max(1, Math.round(w / 0.22)); i++) {
    const n = Math.max(1, Math.round(w / 0.22));
    const sx = x - w / 2 + (w / n) * (i + 0.5);
    k.body.add(shapes.blob(0.12, 1), i % 2 ? C.leaf : C.leafDeep, { x: sx, y: 0.34, z, s: [1, 0.9, 0.9] }, { ao: false });
  }
}

/** An open crate of comics standing on end (seen from the front). */
function comicCrate(k: Kit, x: number, y: number, z: number, seed: number): void {
  k.body.add(shapes.box(0.36, 0.14, 0.26, 0.02, 1), C.woodLight, { x, y: y + 0.07, z });
  for (let i = 0; i < 5; i++) k.body.add(shapes.box(0.28, 0.17, 0.03, 0.008, 1), COMICS[(i + seed) % COMICS.length], { x, y: y + 0.13 + (i % 2) * 0.012, z: z - 0.09 + i * 0.045, rx: -0.12 }, { ao: false });
}

// ───────────────────────── the recipes ─────────────────────────

export const CITY_RECIPES: Readonly<Record<string, Recipe>> = {
  // Central Station: sandstone, an arched entrance in a raised front, arched windows, a glass-ridged barrel roof over
  // the hall and the clock tower Mrs Okafor sets her watch by
  okafor: (k, u) => {
    const sand = '#f3e2c2';
    walls(k, 1.5, sand, { plinth: C.stoneDark });
    k.body.add(shapes.box(k.W + 0.06, 0.07, k.D + 0.06, 0.02, 1), C.trim, { y: 1.06 }, { ao: false });
    const roof = flatRoof(k, 1.5, C.stoneDark, { ledge: C.trim });
    // the hall's barrel roof, glass along its ridge, iron ribs across it
    const bw = k.W * 0.84;
    const br = k.D / 2 - 0.14;
    k.body.add(shapes.cyl(1, 1, 1, 20), C.teal, { y: roof - 0.08, rz: Math.PI / 2, s: [0.68, bw, br] }, { ao: false });
    k.glass.add(shapes.cyl(1, 1, 1, 20), C.glass, { y: roof - 0.08, rz: Math.PI / 2, s: [0.705, bw - 0.1, br * 0.34] });
    for (let i = 0; i < 5; i++) k.body.add(shapes.torus(1, 0.025, 20), C.trim, { x: -bw / 2 + 0.1 + ((bw - 0.2) * i) / 4, y: roof - 0.08, ry: Math.PI / 2, s: [br + 0.02, 0.7, 1] }, { ao: false });
    // the raised front with the arched entrance
    const f = onFace(k, 'front', u, 0, 0);
    const pw = 1.7;
    k.body.add(shapes.box(pw, 2.0, 0.34, 0.05, 2), sand, rel(f, 0, 1.0, -0.15));
    k.body.add(shapes.box(pw + 0.12, 0.09, 0.42, 0.03, 1), C.trim, rel(f, 0, 2.02, -0.15), { ao: false });
    for (const s of [-1, 1]) k.body.add(shapes.box(0.13, 1.86, 0.05, 0.02, 1), C.trim, rel(f, s * (pw / 2 - 0.1), 0.98, 0.03), { ao: false });
    door(k, u, { color: C.navy, glass: true, w: 0.62, h: 0.82 });
    k.glass.add(halfDisc(0.3, 0.03), C.glass, rel(f, 0, 0.9, 0.05));
    k.body.add(arch(0.38, 0.05), C.trim, rel(f, 0, 0.9, 0.05), { ao: false });
    k.body.add(shapes.box(0.1, 0.13, 0.06, 0.02, 1), C.mustard, rel(f, 0, 1.3, 0.06), { ao: false });
    const sg = signBoard(k, u, 1.56, 1.1, 0.18, C.navy, C.trim);
    for (let i = 0; i < 5; i++) k.body.add(shapes.box(0.12, 0.05, 0.02), C.mustard, rel(sg, -0.36 + i * 0.18, 0, 0.01), { ao: false });
    // wall lamps either side of the arch
    for (const s of [-1, 1]) {
      k.body.add(shapes.box(0.05, 0.05, 0.1), C.metal, rel(f, s * 0.6, 1.0, 0.05), { ao: false });
      k.bulbs.add(shapes.sphere(0.055, 8, 6), C.glow, rel(f, s * 0.6, 0.96, 0.11));
    }
    // two pennants on the front's corners
    for (const s of [-1, 1]) {
      k.body.add(shapes.cyl(0.012, 0.012, 0.5, 4), C.metal, rel(f, s * (pw / 2 - 0.08), 2.3, -0.15), { ao: false });
      k.body.add(shapes.box(0.22, 0.13, 0.01), s < 0 ? C.red : C.teal, rel(f, s * (pw / 2 - 0.08) + 0.11, 2.46, -0.15), { ao: false });
    }
    // the arched windows of the hall: along the front and on both ends
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const at = u + s * (pw / 2 + 0.42 + i * 0.66);
        if (Math.abs(at) > k.W / 2 - 0.3) continue;
        archWindow(k, 'front', at, 0.66, 0.34, 0.56, C.trim);
      }
    for (const face of ['left', 'right'] as const) for (const at of [-1.3, 0, 1.3]) archWindow(k, face, at, 0.66, 0.34, 0.56, C.trim);
    // the clock tower behind the entrance
    const t = rel(f, 0, 0, -0.8);
    k.body.add(shapes.box(0.92, 1.6, 0.92, 0.05, 2), sand, rel(t, 0, 2.3, 0));
    k.body.add(shapes.box(1.0, 0.08, 1.0, 0.03, 1), C.trim, rel(t, 0, 2.2, 0), { ao: false });
    for (const [along, out, rz, rx] of [
      [0, 0.47, 0, Math.PI / 2],
      [0.47, 0, Math.PI / 2, 0],
    ] as const) {
      k.body.add(shapes.cyl(0.33, 0.33, 0.05, 24), C.trim, rel(t, along, 2.62, out, { rx, rz }), { ao: false });
      k.bulbs.add(shapes.cyl(0.28, 0.28, 0.055, 24), '#fff3d8', rel(t, along * 1.02, 2.62, out * 1.02, { rx, rz }));
      // the hands (ten to two) and the marks at twelve, three, six and nine
      const hand = (a: number, len: number) => {
        const d = len * 0.5;
        const spot = along ? rel(t, 0.515, 2.62 + Math.cos(a) * d, -Math.sin(a) * d, { ry: Math.PI / 2, rz: -a }) : rel(t, Math.sin(a) * d, 2.62 + Math.cos(a) * d, 0.515, { rz: -a });
        k.body.add(shapes.box(0.03, len, 0.02), C.navy, spot, { ao: false });
      };
      hand(-1.0, 0.2);
      hand(1.1, 0.14);
      for (let m = 0; m < 4; m++) {
        const a = (m * Math.PI) / 2;
        const mx = Math.sin(a) * 0.23;
        k.body.add(shapes.box(0.035, 0.035, 0.02), C.navy, rel(t, along ? 0.515 : mx, 2.62 + Math.cos(a) * 0.23, along ? -mx : 0.515), { ao: false });
      }
    }
    k.body.add(shapes.box(1.02, 0.1, 1.02, 0.03, 1), C.trim, rel(t, 0, 3.14, 0), { ao: false });
    for (const [dx, dz] of [
      [-0.36, -0.36],
      [0.36, -0.36],
      [-0.36, 0.36],
      [0.36, 0.36],
    ])
      k.body.add(shapes.box(0.08, 0.32, 0.08, 0.02, 1), C.trim, rel(t, dx, 3.35, dz), { ao: false });
    k.body.add(shapes.sphere(0.11, 10, 8), C.mustard, rel(t, 0, 3.32, 0), { ao: false });
    k.body.add(pyramid(), C.teal, rel(t, 0, 3.74, 0, { s: [1.12, 0.5, 1.12] }), { ao: false });
    k.body.add(shapes.sphere(0.05, 8, 6), C.mustard, rel(t, 0, 4.02, 0), { ao: false });
    return 4.05;
  },

  // the lost property office: a small blue-grey office with a serving hatch and its bell, a rail of things left on the
  // no. 9 on its side (the blue scarf among them), an umbrella stand and a pile of suitcases in front
  pete: (k, u) =>
    Math.max(
    setBack(k, 0.3, (s) => {
      walls(s, 1.05, '#cdd8e6', { plinth: C.stoneDark });
      door(s, u, { color: C.navy, glass: true, lamp: true });
      const b = besideDoor(s, u);
      const hw = Math.min(0.56, b.room - 0.06);
      const f = onFace(s, 'front', b.at, 0, 0);
      if (hw > 0.25) {
        k.body.add(shapes.box(hw + 0.08, 0.44, 0.05, 0.02, 1), C.trim, rel(f, 0, 0.62, 0.02), { ao: false });
        k.glass.add(shapes.box(hw, 0.36, 0.03, 0.01, 1), C.glass, rel(f, 0, 0.62, 0.04));
        k.body.add(shapes.box(hw + 0.12, 0.04, 0.16, 0.015, 1), C.woodDark, rel(f, 0, 0.4, 0.08), { ao: false });
        k.body.add(shapes.dome(0.035, 10, 5), C.mustard, rel(f, hw / 2 - 0.08, 0.42, 0.1), { ao: false });
        // a little sign over the hatch: an umbrella
        const sg = signBoard(s, b.at, 0.94, Math.min(0.46, hw), 0.15, C.mustard, C.trim);
        k.body.add(shapes.dome(0.06, 10, 4), C.navy, rel(sg, 0, -0.01, 0.01, { s: [1, 0.7, 0.3] }), { ao: false });
        k.body.add(shapes.box(0.012, 0.07, 0.012), C.navy, rel(sg, 0, -0.04, 0.01), { ao: false });
      }
      // the rail of lost things on the right wall: a hat, the blue scarf, a yellow umbrella
      const r = onFace(s, 'right', 0, 0.78, 0);
      k.body.add(shapes.box(0.7, 0.03, 0.03), C.woodDark, rel(r, 0, 0, 0.05), { ao: false });
      k.body.add(shapes.box(0.06, 0.38, 0.02, 0.01, 1), C.blue, rel(r, -0.02, -0.18, 0.07, { rz: 0.04 }), { ao: false });
      k.body.add(shapes.box(0.06, 0.3, 0.02, 0.01, 1), C.blue, rel(r, 0.06, -0.14, 0.075, { rz: -0.05 }), { ao: false });
      k.body.add(shapes.cone(0.06, 0.34, 8), C.mustard, rel(r, 0.24, -0.2, 0.08, { rz: Math.PI }), { ao: false });
      k.body.add(shapes.cyl(0.08, 0.08, 0.02, 10), C.coral, rel(r, -0.24, -0.06, 0.09, { rx: Math.PI / 2 }), { ao: false });
      k.body.add(shapes.cyl(0.05, 0.05, 0.06, 10), C.coral, rel(r, -0.24, -0.04, 0.09, { rx: Math.PI / 2 }), { ao: false });
      const top = hipRoof(s, 1.05, 0.42, C.navy);
      chimney(s, -s.W * 0.2, -s.D * 0.1, 1.15, 0.4, C.stoneDark);
      return top;
    }),
    (() => {
      // outside, in the strip in front: an umbrella stand and a pile of suitcases, on the side away from the door
      const side = u > 0 ? -1 : 1;
      const z = k.D / 2 - 0.15;
      const sx = side * (k.W / 2 - 0.14);
      k.body.add(shapes.cyl(0.08, 0.07, 0.24, 10), C.metal, { x: sx, y: 0.12, z });
      for (const [dx, c] of [
        [-0.03, C.red],
        [0.03, C.teal],
      ] as const)
        k.body.add(shapes.cyl(0.012, 0.012, 0.4, 4), c, { x: sx + dx, y: 0.36, z, rz: dx * 3 }, { ao: false });
      k.body.add(shapes.torus(0.03, 0.01, 8), C.woodDark, { x: sx - 0.03 - 0.03, y: 0.57, z, rz: 0 }, { ao: false });
      const cx = sx - side * 0.36;
      k.body.add(shapes.box(0.34, 0.14, 0.2, 0.03, 2), C.woodDark, { x: cx, y: 0.07, z });
      k.body.add(shapes.box(0.26, 0.12, 0.16, 0.03, 2), C.coral, { x: cx + 0.02, y: 0.2, z, ry: 0.15 });
      k.body.add(shapes.box(0.08, 0.03, 0.02), C.metal, { x: cx + 0.02, y: 0.28, z, ry: 0.15 }, { ao: false });
      return 0;
    })(),
    ),

  // Tess's coffee cart: a mint cart on two wheels, a coffee machine and cups on its top, a coral-and-cream umbrella
  tess: (k) => {
    const w = Math.min(0.58, k.W - 0.04);
    k.body.add(shapes.box(w, 0.36, 0.38, 0.05, 2), C.mint, { y: 0.38 });
    k.body.add(shapes.box(w + 0.04, 0.04, 0.42, 0.015, 1), C.woodLight, { y: 0.58 }, { ao: false });
    // the cup on its front panel
    k.body.add(shapes.cyl(0.07, 0.055, 0.12, 12), C.cream, { x: 0, y: 0.38, z: 0.2, rx: 0 }, { ao: false });
    k.body.add(shapes.torus(0.035, 0.012, 10), C.cream, { x: 0.08, y: 0.39, z: 0.2 }, { ao: false });
    // wheels
    for (const s of [-1, 1]) {
      k.body.add(shapes.torus(0.11, 0.025, 14), C.metal, { x: s * (w / 2 + 0.005), y: 0.13, z: 0.02, ry: Math.PI / 2 }, { ao: false });
      k.body.add(shapes.cyl(0.03, 0.03, 0.03, 8), C.metal, { x: s * (w / 2), y: 0.13, z: 0.02, rz: Math.PI / 2 }, { ao: false });
    }
    k.body.add(shapes.box(0.04, 0.2, 0.04), C.metal, { x: 0, y: 0.1, z: -0.12 });
    // the coffee machine, cups, a jar of biscuits
    k.body.add(shapes.box(0.22, 0.17, 0.15, 0.03, 2), C.metal, { x: -0.1, y: 0.685, z: -0.08 }, { ao: false });
    k.body.add(shapes.box(0.23, 0.03, 0.16, 0.01, 1), C.red, { x: -0.1, y: 0.78, z: -0.08 }, { ao: false });
    k.body.add(shapes.cyl(0.02, 0.02, 0.05, 6), C.white, { x: -0.1, y: 0.63, z: 0.0 }, { ao: false });
    for (let i = 0; i < 3; i++) k.body.add(shapes.cyl(0.03, 0.025, 0.05, 8), C.white, { x: 0.1 + (i % 2) * 0.07, y: 0.625 + Math.floor(i / 2) * 0.05, z: 0.06 }, { ao: false });
    k.body.add(shapes.cyl(0.045, 0.045, 0.1, 10), C.butter, { x: 0.18, y: 0.65, z: -0.1 }, { ao: false });
    // the umbrella
    k.body.add(shapes.cyl(0.015, 0.015, 0.8, 5), C.trim, { x: 0.2, y: 0.98, z: -0.14 }, { ao: false });
    k.body.add(shapes.cone(0.5, 0.2, 10), C.coral, { x: 0.12, y: 1.42, z: -0.06 }, { ao: false });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      k.body.add(shapes.sphere(0.06, 6, 4), i % 2 ? C.coral : C.cream, { x: 0.12 + Math.cos(a) * 0.48, y: 1.32, z: -0.06 + Math.sin(a) * 0.48, s: [1, 0.6, 1] }, { ao: false });
    }
    k.body.add(shapes.sphere(0.035, 6, 4), C.mustard, { x: 0.12, y: 1.54, z: -0.06 }, { ao: false });
    for (let i = 0; i < 3; i++) {
      const a = 0.5 + i * 0.7;
      k.bulbs.add(shapes.sphere(0.025, 6, 4), C.glow, { x: 0.12 + Math.cos(a) * 0.4, y: 1.22, z: -0.06 + Math.sin(a) * 0.4 });
    }
    return 1.56;
  },

  // the taxi rank's office: taxi-yellow walls with a chequered band, a wide window, a phone on the wall, a bench to wait
  // on and a taxi light on the roof (Rico's dream of a dispatch office)
  rico: (k, u) =>
    Math.max(
    setBack(k, 0.28, (s) => {
      walls(s, 1.02, C.mustard, { plinth: C.navy });
      door(s, u, { color: C.navy, glass: true, lamp: true });
      const b = besideDoor(s, u);
      if (b.room > 0.4) shopWindow(s, b.at, 0.58, Math.min(0.62, b.room - 0.1), 0.36, C.trim);
      windowOn(s, 'right', 0, 0.58, { frame: C.trim, bars: false });
      windowOn(s, 'left', 0, 0.58, { frame: C.trim, bars: false });
      // the chequered band, front and right
      const dark = '#3d4150';
      for (const face of ['front', 'right'] as const) {
        const len = face === 'front' ? s.W : s.D;
        const f = onFace(s, face, 0, 0.9, 0);
        k.body.add(shapes.box(len + 0.02, 0.12, 0.02), C.white, rel(f, 0, 0, 0.015), { ao: false });
        const n = Math.floor(len / 0.12);
        for (let i = 0; i < n; i++) k.body.add(shapes.box(0.06, 0.06, 0.02), dark, rel(f, -len / 2 + 0.06 + i * 0.12, i % 2 ? 0.03 : -0.03, 0.025), { ao: false });
      }
      // the phone on the wall by the door
      const p = onFace(s, 'front', u - 0.36, 0.55, 0);
      if (Math.abs(u - 0.36) < s.W / 2 - 0.1) {
        k.body.add(shapes.box(0.14, 0.22, 0.06, 0.02, 1), C.red, rel(p, 0, 0, 0.04), { ao: false });
        k.body.add(shapes.box(0.04, 0.14, 0.04, 0.015, 1), dark, rel(p, -0.03, 0.01, 0.09), { ao: false });
      }
      const top = flatRoof(s, 1.02, C.stoneDark, { ledge: C.navy });
      // the taxi light on the roof and a radio aerial
      k.body.add(shapes.box(0.5, 0.06, 0.24, 0.02, 1), dark, { y: top + 0.03, z: 0.05 }, { ao: false });
      k.bulbs.add(shapes.box(0.42, 0.15, 0.18, 0.05, 2), '#ffd84a', { y: top + 0.13, z: 0.05 });
      k.body.add(shapes.cyl(0.01, 0.012, 0.6, 4), C.metal, { x: -s.W * 0.35, y: top + 0.3, z: -s.D * 0.25 }, { ao: false });
      k.bulbs.add(shapes.sphere(0.025, 6, 4), C.red, { x: -s.W * 0.35, y: top + 0.6, z: -s.D * 0.25 });
      return top + 0.22;
    }),
    (() => {
      // the bench in front, on the wider side of the door
      const b = besideDoor(k, u);
      const z = k.D / 2 - 0.14;
      const bw = Math.min(0.55, b.room - 0.05);
      if (bw > 0.3) {
        k.body.add(shapes.box(bw, 0.04, 0.16, 0.015, 1), C.woodLight, { x: b.at, y: 0.24, z });
        k.body.add(shapes.box(bw, 0.12, 0.03, 0.015, 1), C.woodLight, { x: b.at, y: 0.36, z: z - 0.08 });
        for (const sx of [-1, 1]) k.body.add(shapes.box(0.03, 0.22, 0.14), C.metal, { x: b.at + sx * (bw / 2 - 0.06), y: 0.11, z });
      }
      return 0;
    })(),
    ),

  // Sunflower Corner: a cream shop with a teal roof, a yellow-and-white awning, a sunflower on the sign, zinc buckets of
  // sunflowers on one side of the door and a stand of potted flowers on the other
  nora: (k, u) =>
    Math.max(
    setBack(k, 0.36, (s) => {
      walls(s, 1.06, C.cream, { plinth: C.leafDeep });
      for (const sd of [-1, 1]) {
        const at = u + sd * 0.72;
        if (Math.abs(at) > s.W / 2 - 0.3) continue;
        shopWindow(s, at, 0.56, Math.min(0.7, s.W / 2 - Math.abs(u) - 0.42), 0.4, C.leafDeep);
      }
      windowOn(s, 'right', 0, 0.6, { shutters: C.teal, flowers: true });
      windowOn(s, 'left', 0, 0.6, { shutters: C.teal });
      door(s, u, { color: C.leafDeep, glass: true, lamp: true });
      awning(s, 0, 0.98, s.W - 0.08, C.mustard, C.white, 0.36);
      const top = gableRoof(s, 1.06, 0.56, C.teal, { wall: C.cream });
      chimney(s, -s.W * 0.3, -s.D * 0.1, 1.2, 0.5, C.coral);
      // the sign: a sunflower on green
      const sg = signBoard(s, u, 1.36, 0.7, 0.24, C.leafDeep, C.cream);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        k.body.add(shapes.sphere(0.035, 6, 4), C.mustard, rel(sg, -0.18 + Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.01, { s: [1, 1, 0.5] }), { ao: false });
      }
      k.body.add(shapes.sphere(0.04, 8, 5), '#8a5a3c', rel(sg, -0.18, 0, 0.02, { s: [1, 1, 0.5] }), { ao: false });
      k.body.add(shapes.box(0.3, 0.05, 0.02), C.cream, rel(sg, 0.1, 0.03, 0.01), { ao: false });
      k.body.add(shapes.box(0.22, 0.04, 0.02), C.mustard, rel(sg, 0.06, -0.05, 0.01), { ao: false });
      return top;
    }),
    (() => {
      // in front: buckets of sunflowers on one side, a stand of pots on the other
      const z = k.D / 2 - 0.17;
      const left = u - (-k.W / 2) > k.W / 2 - u;
      const sd = left ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const x = u + sd * (0.5 + i * 0.27);
        if (Math.abs(x) > k.W / 2 - 0.12) break;
        k.body.add(shapes.cyl(0.1, 0.08, 0.22, 10), '#b9c6cf', { x, y: 0.11, z });
        k.body.add(shapes.torus(0.1, 0.012, 10), C.metal, { x, y: 0.22, z, rx: Math.PI / 2 }, { ao: false });
        for (let j = 0; j < 3; j++) sunflower(k, x + (j - 1) * 0.05, 0.42 + ((i + j) % 3) * 0.07, z + (j === 1 ? -0.03 : 0.02), (j - 1) * 0.15);
      }
      const ox = u - sd * 0.62;
      if (Math.abs(ox) < k.W / 2 - 0.3) {
        k.body.add(shapes.box(0.5, 0.04, 0.24, 0.015, 1), C.woodLight, { x: ox, y: 0.22, z });
        k.body.add(shapes.box(0.5, 0.04, 0.14, 0.015, 1), C.woodLight, { x: ox, y: 0.42, z: z - 0.06 });
        for (const sx of [-1, 1]) k.body.add(shapes.box(0.04, 0.44, 0.22), C.woodDark, { x: ox + sx * 0.24, y: 0.22, z: z - 0.01 });
        pot(k.body, ox - 0.13, z + 0.04, 0.24, C.coral);
        pot(k.body, ox + 0.13, z + 0.04, 0.24, C.teal);
        pot(k.body, ox, z - 0.06, 0.44, C.mustard);
      }
      return 0;
    })(),
    ),

  // baby Maya's pram: sky blue on four little wheels, its hood up, a pink blanket, a sunflower from her mum's shop
  theo: (k) => {
    k.body.add(shapes.box(0.46, 0.2, 0.3, 0.08, 3), C.sky, { y: 0.42 });
    k.body.add(shapes.box(0.26, 0.04, 0.24, 0.02, 1), C.pink, { x: 0.07, y: 0.53 }, { ao: false });
    k.body.add(shapes.dome(0.17, 14, 6), C.navy, { x: -0.08, y: 0.5, rz: 0.75 }, { ao: false });
    k.body.add(shapes.torus(0.17, 0.014, 14), C.trim, { x: -0.08, y: 0.5, ry: -Math.PI / 2, rx: 0.75 - Math.PI / 2 }, { ao: false });
    // a sunflower tucked into the hood
    k.body.add(shapes.cyl(0.05, 0.05, 0.02, 10), C.mustard, { x: -0.14, y: 0.6, z: 0.14, rx: Math.PI / 2 }, { ao: false });
    k.body.add(shapes.sphere(0.025, 6, 4), '#8a5a3c', { x: -0.14, y: 0.6, z: 0.155, s: [1, 1, 0.5] }, { ao: false });
    // the chassis and wheels
    k.body.add(shapes.box(0.4, 0.025, 0.025), C.metal, { y: 0.26, z: 0.1 }, { ao: false });
    k.body.add(shapes.box(0.4, 0.025, 0.025), C.metal, { y: 0.26, z: -0.1 }, { ao: false });
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        k.body.add(shapes.box(0.02, 0.16, 0.02), C.metal, { x: sx * 0.15, y: 0.2, z: sz * 0.13 }, { ao: false });
        k.body.add(shapes.torus(0.075, 0.022, 12), C.metal, { x: sx * 0.17, y: 0.09, z: sz * 0.15 }, { ao: false });
      }
    // the handle
    for (const sz of [-1, 1]) k.body.add(shapes.cyl(0.012, 0.012, 0.34, 5), C.metal, { x: 0.26, y: 0.62, z: sz * 0.12, rz: -0.36 }, { ao: false });
    k.body.add(shapes.cyl(0.022, 0.022, 0.3, 8), C.navy, { x: 0.32, y: 0.79, rx: Math.PI / 2 }, { ao: false });
    // a little star toy on a string
    k.body.add(shapes.sphere(0.03, 6, 4), C.mustard, { x: 0.12, y: 0.66, z: 0.0 }, { ao: false });
    return 0.85;
  },

  // Frank's comics stall: a red-and-cream striped canopy on four posts, shelves of comics at the back, a counter of
  // open crates, a spinner rack and his folding chair
  frank: (k) => {
    stall(k, 1.5, 1.28, [C.red, C.cream]);
    // the back with three shelves of comics
    const bz = -k.D / 2 + 0.08;
    k.body.add(shapes.box(k.W - 0.1, 1.14, 0.06, 0.02, 1), C.wood, { y: 0.6, z: bz });
    for (let r = 0; r < 3; r++) {
      const y = 0.42 + r * 0.3;
      k.body.add(shapes.box(k.W - 0.16, 0.03, 0.16, 0.01, 1), C.woodLight, { y, z: bz + 0.1 }, { ao: false });
      const n = 8;
      for (let i = 0; i < n; i++) k.body.add(shapes.box(0.13, 0.18, 0.025, 0.006, 1), COMICS[(i * 3 + r) % COMICS.length], { x: -k.W / 2 + 0.2 + i * ((k.W - 0.4) / (n - 1)), y: y + 0.1, z: bz + 0.09, rx: -0.15 }, { ao: false });
    }
    // the counter of crates
    const cz = k.D / 2 - 0.24;
    const cw = k.W - 0.5;
    const cx = -0.2;
    k.body.add(shapes.box(cw, 0.48, 0.36, 0.03, 2), C.woodDark, { x: cx, y: 0.24, z: cz });
    k.body.add(shapes.box(cw + 0.04, 0.03, 0.4, 0.01, 1), C.woodLight, { x: cx, y: 0.495, z: cz }, { ao: false });
    for (let i = 0; i < 3; i++) comicCrate(k, cx - cw / 2 + 0.22 + i * ((cw - 0.44) / 2), 0.51, cz, i);
    // the spinner rack
    const sx = k.W / 2 - 0.2;
    const sz = k.D / 2 - 0.22;
    k.body.add(shapes.cyl(0.015, 0.015, 1.0, 5), C.metal, { x: sx, y: 0.5, z: sz }, { ao: false });
    k.body.add(shapes.cyl(0.1, 0.12, 0.03, 10), C.metal, { x: sx, y: 0.015, z: sz }, { ao: false });
    for (let t = 0; t < 3; t++)
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + t * 0.6;
        k.body.add(shapes.box(0.1, 0.14, 0.02, 0.005, 1), COMICS[(t * 3 + i) % COMICS.length], { x: sx + Math.sin(a) * 0.07, y: 0.45 + t * 0.2, z: sz + Math.cos(a) * 0.07, ry: a }, { ao: false });
      }
    // his folding chair behind the counter
    k.body.add(shapes.box(0.24, 0.03, 0.22, 0.01, 1), C.teal, { x: cx + 0.1, y: 0.36, z: -0.1 }, { ao: false });
    k.body.add(shapes.box(0.24, 0.24, 0.03, 0.01, 1), C.teal, { x: cx + 0.1, y: 0.52, z: -0.22, rx: -0.12 }, { ao: false });
    for (const s of [-1, 1]) k.body.add(shapes.box(0.02, 0.38, 0.02), C.metal, { x: cx + 0.1 + s * 0.1, y: 0.18, z: -0.1, rx: s * 0.3 }, { ao: false });
    // bulbs along the canopy's edge
    for (let i = 0; i < 5; i++) k.bulbs.add(shapes.sphere(0.025, 6, 4), C.glow, { x: -k.W / 2 + 0.1 + (i * (k.W - 0.2)) / 4, y: 1.2, z: k.D / 2 + 0.12 });
    return 1.6;
  },

  // Twin Ovens: a peach bakery with a cocoa roof and TWO chimneys (two ovens, two sisters), a cocoa-and-cream awning
  // over its window, a loaf on its hanging sign, a bench of loaves and baguettes outside, sacks of flour
  poppy: (k, u) =>
    Math.max(
    setBack(k, 0.3, (s) => {
      const cocoa = '#b0705a';
      walls(s, 1.08, C.peach, { plinth: C.stoneDark });
      door(s, u, { color: cocoa, glass: true, lamp: true });
      const b = besideDoor(s, u);
      const ww = Math.min(0.62, b.room - 0.12);
      if (ww > 0.3) {
        shopWindow(s, b.at, 0.55, ww, 0.4, C.trim);
        awning(s, b.at, 0.94, ww + 0.16, cocoa, C.cream, 0.3);
      }
      windowOn(s, 'right', 0, 0.58, { shutters: cocoa, flowers: true });
      windowOn(s, 'left', 0, 0.58, { shutters: cocoa });
      const top = gableRoof(s, 1.08, 0.55, cocoa, { wall: C.peach });
      // the two chimneys, a puff over one
      chimney(s, -s.W * 0.26, -s.D * 0.12, 1.2, 0.58, C.coral);
      chimney(s, s.W * 0.26, -s.D * 0.12, 1.2, 0.5, C.coral);
      k.body.add(shapes.sphere(0.09, 8, 6), C.white, { x: -s.W * 0.26 + 0.04, y: 1.98, z: -s.D * 0.12 }, { ao: false });
      k.body.add(shapes.sphere(0.06, 8, 6), C.white, { x: -s.W * 0.26 + 0.12, y: 2.1, z: -s.D * 0.12 }, { ao: false });
      // the hanging sign with a loaf
      const g = onFace(s, 'front', u - 0.4 < -s.W / 2 + 0.1 ? u + 0.4 : u - 0.4, 0.86, 0);
      k.body.add(shapes.box(0.04, 0.04, 0.28), C.metal, rel(g, 0, 0, 0.14), { ao: false });
      k.body.add(shapes.cyl(0.13, 0.13, 0.04, 16), C.cream, rel(g, 0, -0.16, 0.2, { rz: Math.PI / 2 }), { ao: false });
      k.body.add(shapes.sphere(0.08, 10, 6), C.woodLight, rel(g, 0.03, -0.16, 0.2, { s: [0.5, 0.6, 1.3] }), { ao: false });
      k.body.add(shapes.sphere(0.08, 10, 6), C.woodLight, rel(g, -0.03, -0.16, 0.2, { s: [0.5, 0.6, 1.3] }), { ao: false });
      return top;
    }),
    (() => {
      // outside: a bench of loaves and a basket of baguettes; flour sacks by the other side of the door
      const b = besideDoor(k, u);
      const z = k.D / 2 - 0.15;
      if (b.room > 0.5) {
        const bx = b.at;
        k.body.add(shapes.box(0.56, 0.04, 0.22, 0.015, 1), C.woodLight, { x: bx, y: 0.3, z });
        for (const sx of [-1, 1]) k.body.add(shapes.box(0.04, 0.3, 0.2), C.woodDark, { x: bx + sx * 0.25, y: 0.15, z });
        for (let i = 0; i < 3; i++) k.body.add(shapes.sphere(0.07, 10, 6), i === 1 ? C.mustard : C.woodLight, { x: bx - 0.17 + i * 0.12, y: 0.37, z, s: [1, 0.65, 0.8] }, { ao: false });
        k.body.add(shapes.cyl(0.07, 0.06, 0.12, 10), C.wood, { x: bx + 0.18, y: 0.38, z });
        for (let i = 0; i < 3; i++) k.body.add(shapes.cyl(0.018, 0.022, 0.32, 6), C.woodLight, { x: bx + 0.16 + i * 0.02, y: 0.5, z: z - 0.02 + i * 0.015, rz: 0.15 - i * 0.12 }, { ao: false });
      }
      const fx = b.at > u ? u - 0.42 : u + 0.42;
      if (Math.abs(fx) < k.W / 2 - 0.1) {
        k.body.add(shapes.blob(0.1, 1), C.cream, { x: fx, y: 0.1, z, s: [1, 1.2, 0.85] });
        k.body.add(shapes.blob(0.08, 1), C.cream, { x: fx + 0.04, y: 0.25, z: z + 0.01, s: [1, 1.1, 0.85] });
      }
      return 0;
    })(),
    ),

  // Gianna's: two storeys of warm ochre, a terracotta hip roof, a red-white-green awning, shutters and a small balcony
  // upstairs, potted lemon trees (Emma's grandmother's lemon cake), a chalkboard by the door, lights strung over it
  gianna: (k, u) =>
    Math.max(
    setBack(k, 0.34, (s) => {
      const ochre = '#f4cf9c';
      walls(s, 1.9, ochre, { plinth: C.stoneDark });
      k.body.add(shapes.box(s.W + 0.06, 0.06, s.D + 0.06, 0.02, 1), C.trim, { y: 1.02 }, { ao: false });
      door(s, u, { color: C.leafDeep, glass: true, w: 0.42 });
      for (const sd of [-1, 1]) {
        const at = u + sd * 0.72;
        if (Math.abs(at) > s.W / 2 - 0.3) continue;
        shopWindow(s, at, 0.55, Math.min(0.62, s.W / 2 - Math.abs(u) - 0.45), 0.42, C.leafDeep);
      }
      awningN(s, 0, 0.96, s.W - 0.08, [C.leafDeep, C.white, C.red], 0.36);
      // upstairs: shuttered windows, the middle one opening on a balcony of flowers
      const up = 1.5;
      for (const at of [-s.W * 0.33, 0, s.W * 0.33]) windowOn(s, 'front', at, up, { w: 0.3, h: 0.4, shutters: C.leafDeep });
      const f = onFace(s, 'front', 0, 0, 0);
      flowerBox(s, f, 0.5, 1.21);
      for (const face of ['left', 'right'] as const) {
        windowOn(s, face, -0.5, 0.58, { shutters: C.leafDeep });
        windowOn(s, face, 0.5, 0.58, { shutters: C.leafDeep });
        windowOn(s, face, 0, up, { shutters: C.leafDeep });
      }
      const top = hipRoof(s, 1.9, 0.55, C.coral);
      chimney(s, s.W * 0.26, -s.D * 0.12, 2.05, 0.55, C.stone);
      // the name board over the awning
      const sg = signBoard(s, 0, 1.13, 1.1, 0.14, C.cream, C.leafDeep);
      k.body.add(shapes.box(0.16, 0.06, 0.02), C.leafDeep, rel(sg, -0.32, 0, 0.01), { ao: false });
      k.body.add(shapes.box(0.16, 0.06, 0.02), C.white, rel(sg, -0.16, 0, 0.01), { ao: false });
      k.body.add(shapes.box(0.16, 0.06, 0.02), C.red, rel(sg, 0, 0, 0.01), { ao: false });
      k.body.add(shapes.box(0.36, 0.04, 0.02), C.navy, rel(sg, 0.28, 0, 0.01), { ao: false });
      // lights strung under the balcony
      for (let i = 0; i < 9; i++) {
        const x = -s.W / 2 + 0.15 + (i * (s.W - 0.3)) / 8;
        k.bulbs.add(shapes.sphere(0.025, 6, 4), C.glow, rel(f, x, 1.8 - (i % 2) * 0.03, 0.06));
      }
      return top;
    }),
    (() => {
      const z = k.D / 2 - 0.17;
      // potted lemon trees either side of the door
      for (const sd of [-1, 1]) {
        const x = u + sd * 0.42;
        if (Math.abs(x) > k.W / 2 - 0.15) continue;
        k.body.add(shapes.cyl(0.11, 0.08, 0.18, 10), C.coral, { x, y: 0.09, z });
        k.body.add(shapes.cyl(0.018, 0.022, 0.3, 5), C.trunk, { x, y: 0.32, z }, { ao: false });
        k.body.add(shapes.sphere(0.15, 10, 8), C.leafDeep, { x, y: 0.56, z }, { top: C.leaf, ao: false });
        for (let i = 0; i < 4; i++) {
          const a = i * 1.7 + sd;
          k.body.add(shapes.sphere(0.03, 6, 4), C.mustard, { x: x + Math.cos(a) * 0.13, y: 0.54 + (i % 2) * 0.06, z: z + Math.sin(a) * 0.1 + 0.03 }, { ao: false });
        }
      }
      // the chalkboard on the wider side
      const b = besideDoor(k, u);
      const cx = b.at > u ? u + 0.95 : u - 0.95;
      if (Math.abs(cx) < k.W / 2 - 0.2) {
        for (const sz of [-1, 1]) k.body.add(shapes.box(0.32, 0.46, 0.03, 0.01, 1), C.woodDark, { x: cx, y: 0.22, z: z + sz * 0.06, rx: -sz * 0.22 });
        k.body.add(shapes.box(0.26, 0.38, 0.02, 0.01, 1), '#3f4a46', { x: cx, y: 0.23, z: z + 0.08, rx: -0.22 }, { ao: false });
        for (let i = 0; i < 4; i++) k.body.add(shapes.box(0.1 + (i % 2) * 0.06, 0.015, 0.01), i === 0 ? C.butter : C.white, { x: cx - 0.02, y: 0.34 - i * 0.07, z: z + 0.1 - i * 0.016, rx: -0.22 }, { ao: false });
      }
      return 0;
    })(),
    ),

  // Hal's fish stall: a blue-and-white canopy, a counter of crushed ice with fish laid on it, his scales, polystyrene
  // ice crates stacked at the side, a fish on the sign
  hal: (k) => {
    stall(k, 1.42, 1.24, [C.blue, C.white], C.trim);
    const cz = 0.02;
    k.body.add(shapes.box(k.W - 0.12, 0.5, 0.46, 0.03, 2), C.navy, { y: 0.25, z: cz });
    k.body.add(shapes.box(k.W - 0.08, 0.06, 0.5, 0.02, 1), '#e6f4fa', { y: 0.53, z: cz }, { ao: false });
    // ice and fish
    for (let i = 0; i < 7; i++) {
      const x = -k.W / 2 + 0.3 + i * ((k.W - 0.72) / 6);
      const z = cz + (i % 2 ? 0.08 : -0.08);
      const silver = i % 3 === 1 ? C.coral : '#b8c7d6';
      k.body.add(shapes.sphere(0.05, 8, 5), silver, { x, y: 0.58, z, ry: 0.4 * (i % 2 ? 1 : -1), s: [2.1, 0.6, 0.85] }, { ao: false });
      k.body.add(shapes.cone(0.035, 0.07, 4), silver, { x: x + (i % 2 ? -0.1 : -0.1), y: 0.58, z: z + (i % 2 ? 0.04 : -0.04), rz: Math.PI / 2, s: [1, 1, 0.4] }, { ao: false });
    }
    for (let i = 0; i < 6; i++) k.body.add(shapes.blob(0.035, 0), C.white, { x: -k.W / 2 + 0.2 + i * 0.2, y: 0.57, z: cz + 0.18 }, { ao: false });
    // the scales on the end of the counter
    const sx = k.W / 2 - 0.2;
    k.body.add(shapes.box(0.14, 0.08, 0.12, 0.02, 1), C.white, { x: sx, y: 0.6, z: cz - 0.1 }, { ao: false });
    k.body.add(shapes.cyl(0.07, 0.07, 0.015, 10), C.metal, { x: sx, y: 0.65, z: cz - 0.1 }, { ao: false });
    // ice crates stacked at the back corner
    k.body.add(shapes.box(0.3, 0.16, 0.18, 0.02, 1), C.white, { x: -k.W / 2 + 0.22, y: 0.08, z: -k.D / 2 + 0.11 });
    k.body.add(shapes.box(0.3, 0.16, 0.18, 0.02, 1), C.white, { x: -k.W / 2 + 0.24, y: 0.24, z: -k.D / 2 + 0.11, ry: 0.08 });
    // the sign hanging from the canopy: a fish
    const g = { x: 0, y: 1.08, z: k.D / 2 + 0.1 };
    k.body.add(shapes.box(0.36, 0.16, 0.03, 0.02, 1), C.white, g, { ao: false });
    k.body.add(shapes.sphere(0.05, 8, 5), C.blue, { ...g, z: g.z + 0.02, s: [1.8, 0.8, 0.4] }, { ao: false });
    k.body.add(shapes.cone(0.04, 0.06, 4), C.blue, { x: g.x + 0.11, y: g.y, z: g.z + 0.02, rz: -Math.PI / 2, s: [1, 1, 0.4] }, { ao: false });
    return 1.5;
  },

  // Amira's spice stall: a saffron-and-butter canopy, two tiers of bowls heaped with spices of every colour, strings of
  // dried chillies from the canopy, sacks of spice at the back
  amira: (k) => {
    stall(k, 1.42, 1.24, [C.orange, C.butter]);
    const spices = [C.red, C.mustard, '#8a5a3c', C.orange, C.leafDeep, '#c2452d', C.butter, '#d98a3a'] as const;
    // the tiered counter
    k.body.add(shapes.box(k.W - 0.12, 0.42, 0.44, 0.03, 2), C.woodDark, { y: 0.21, z: 0.02 });
    k.body.add(shapes.box(k.W - 0.14, 0.16, 0.2, 0.02, 1), C.wood, { y: 0.5, z: -0.09 });
    const n = Math.max(3, Math.floor((k.W - 0.2) / 0.22));
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < n; i++) {
        const x = -(n - 1) * 0.11 + i * 0.22;
        const y = row ? 0.6 : 0.44;
        const z = row ? -0.09 : 0.14;
        const c = spices[(i + row * 3) % spices.length];
        k.body.add(shapes.cyl(0.085, 0.06, 0.05, 10), C.woodLight, { x, y: y - 0.005, z }, { ao: false });
        k.body.add(shapes.dome(0.075, 10, 4), c, { x, y: y + 0.02, z, s: [1, 0.75, 1] }, { ao: false });
      }
    // strings of chillies from the front of the canopy
    for (const sx of [-1, 1]) {
      const x = sx * (k.W / 2 - 0.22);
      k.body.add(shapes.cyl(0.006, 0.006, 0.3, 3), C.woodDark, { x, y: 1.06, z: k.D / 2 + 0.08 }, { ao: false });
      for (let i = 0; i < 4; i++) k.body.add(shapes.cone(0.022, 0.09, 5), C.red, { x: x + (i % 2 ? 0.025 : -0.025), y: 1.16 - i * 0.07, z: k.D / 2 + 0.08, rz: Math.PI + (i % 2 ? -0.4 : 0.4) }, { ao: false });
    }
    // sacks at the back
    for (const sx of [-1, 1]) {
      const x = sx * (k.W / 2 - 0.18);
      k.body.add(shapes.blob(0.12, 1), '#dcc093', { x, y: 0.13, z: -k.D / 2 + 0.13, s: [1, 1.1, 0.8] });
      k.body.add(shapes.dome(0.08, 10, 4), sx < 0 ? C.mustard : C.red, { x, y: 0.25, z: -k.D / 2 + 0.13, s: [1, 0.5, 1] }, { ao: false });
    }
    return 1.5;
  },

  // Jonah's pitch: a rose rug, his open guitar case (red lining, a few coins), a little amp and a stool
  jonah: (k) => {
    const s = Math.min(k.W, k.D);
    k.body.add(shapes.box(s, 0.02, s, 0.01, 1), C.rose, { y: 0.01 }, { ao: false });
    k.body.add(shapes.box(s - 0.1, 0.022, s - 0.1, 0.01, 1), C.butter, { y: 0.012 }, { ao: false });
    k.body.add(shapes.box(s - 0.16, 0.024, s - 0.16, 0.01, 1), C.rose, { y: 0.014 }, { ao: false });
    // the open case, its lid leaning back
    const cz = 0.12;
    k.body.add(shapes.box(0.44, 0.07, 0.18, 0.03, 2), '#3d4150', { x: -0.02, y: 0.05, z: cz });
    k.body.add(shapes.box(0.38, 0.02, 0.13, 0.02, 1), C.red, { x: -0.02, y: 0.08, z: cz }, { ao: false });
    k.body.add(shapes.box(0.44, 0.03, 0.18, 0.02, 1), '#3d4150', { x: -0.02, y: 0.13, z: cz - 0.15, rx: -1.15 }, { ao: false });
    for (let i = 0; i < 4; i++) k.body.add(shapes.cyl(0.018, 0.018, 0.008, 8), C.mustard, { x: -0.12 + i * 0.07, y: 0.093, z: cz + (i % 2 ? 0.03 : -0.02) }, { ao: false });
    // the amp
    k.body.add(shapes.box(0.2, 0.2, 0.14, 0.03, 2), '#3d4150', { x: 0.2, y: 0.1, z: -0.14 });
    k.body.add(shapes.cyl(0.06, 0.06, 0.02, 12), C.metal, { x: 0.2, y: 0.09, z: -0.07, rx: Math.PI / 2 }, { ao: false });
    k.body.add(shapes.box(0.16, 0.025, 0.02), C.mustard, { x: 0.2, y: 0.17, z: -0.065 }, { ao: false });
    // the stool
    k.body.add(shapes.cyl(0.09, 0.09, 0.04, 12), C.woodLight, { x: -0.16, y: 0.4, z: -0.14 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      k.body.add(shapes.cyl(0.012, 0.016, 0.4, 5), C.woodDark, { x: -0.16 + Math.cos(a) * 0.055, y: 0.2, z: -0.14 + Math.sin(a) * 0.055, rx: Math.sin(a) * 0.12, rz: -Math.cos(a) * 0.12 }, { ao: false });
    }
    return 0.45;
  },

  // Bo's karaoke bar: two storeys of night-plum, round windows, a pink neon microphone on its sign, a stage light on a
  // bracket, musical notes up the wall, brass posts and a red rope at the door
  bo: (k, u) =>
    Math.max(
    setBack(k, 0.3, (s) => {
      const wall = '#7d6aa8';
      const neon = '#ff6fc4';
      walls(s, 1.8, wall, { plinth: C.navy });
      k.body.add(shapes.box(s.W + 0.06, 0.06, s.D + 0.06, 0.02, 1), C.lilac, { y: 1.0 }, { ao: false });
      door(s, u, { color: C.navy, glass: true, w: 0.42 });
      const f = onFace(s, 'front', 0, 0, 0);
      k.body.add(shapes.box(0.56, 0.74, 0.03, 0.02, 1), neon, rel(f, u, 0.39, 0.012), { ao: false });
      // round windows downstairs, two upstairs
      for (const sd of [-1, 1]) {
        const at = u + sd * 0.72;
        if (Math.abs(at) < s.W / 2 - 0.25) windowOn(s, 'front', at, 0.56, { w: 0.34, round: true, frame: C.lilac });
      }
      for (const at of [-s.W * 0.3, s.W * 0.3]) windowOn(s, 'front', at, 1.42, { w: 0.3, h: 0.36, frame: C.lilac, bars: false });
      windowOn(s, 'right', 0, 0.56, { w: 0.3, round: true, frame: C.lilac });
      windowOn(s, 'right', 0, 1.42, { frame: C.lilac, bars: false });
      windowOn(s, 'left', 0, 1.42, { frame: C.lilac, bars: false });
      // the neon sign: a dark board, a pink microphone, pink lines and stars
      const sg = signBoard(s, 0, 1.42, 0.86, 0.36, '#3d3354', neon);
      k.bulbs.add(shapes.sphere(0.06, 10, 8), neon, rel(sg, -0.28, 0.05, 0.02));
      k.bulbs.add(shapes.box(0.03, 0.14, 0.02), neon, rel(sg, -0.28, -0.07, 0.02));
      k.bulbs.add(shapes.box(0.36, 0.035, 0.02), neon, rel(sg, 0.1, 0.06, 0.02));
      k.bulbs.add(shapes.box(0.26, 0.035, 0.02), '#8fe3ff', rel(sg, 0.05, -0.05, 0.02));
      for (let i = 0; i < 3; i++) k.bulbs.add(shapes.sphere(0.02, 6, 4), C.glow, rel(sg, 0.32, 0.1 - i * 0.08, 0.02));
      // the stage light on a bracket at the corner, aimed at the door
      const g = onFace(s, 'front', s.W / 2 - 0.2, 1.14, 0);
      k.body.add(shapes.box(0.04, 0.04, 0.2), C.metal, rel(g, 0, 0, 0.1), { ao: false });
      k.body.add(shapes.cyl(0.06, 0.08, 0.16, 10), '#3d4150', rel(g, 0, -0.06, 0.2, { rz: 0.9 }), { ao: false });
      k.bulbs.add(shapes.cyl(0.065, 0.065, 0.02, 10), C.glow, rel(g, -0.07, -0.12, 0.2, { rz: 0.9 }));
      // notes up the right wall
      const r = onFace(s, 'right', 0, 0, 0);
      for (const [a, v, c] of [
        [-0.45, 0.95, C.pink],
        [0.45, 1.15, C.butter],
      ] as const) {
        k.body.add(shapes.sphere(0.05, 8, 5), c, rel(r, a, v, 0.03, { s: [1.2, 0.9, 0.5] }), { ao: false });
        k.body.add(shapes.box(0.02, 0.2, 0.02), c, rel(r, a + 0.045, v + 0.1, 0.03), { ao: false });
      }
      const top = flatRoof(s, 1.8, C.navy, { ledge: C.lilac });
      return top;
    }),
    (() => {
      // brass posts and a red rope beside the door
      const z = k.D / 2 - 0.14;
      const b = besideDoor(k, u);
      const x0 = b.at > u ? u + 0.36 : u - 0.36;
      const x1 = b.at > u ? x0 + 0.5 : x0 - 0.5;
      if (Math.abs(x1) < k.W / 2 - 0.05) {
        for (const x of [x0, x1]) {
          k.body.add(shapes.cyl(0.02, 0.02, 0.38, 6), C.mustard, { x, y: 0.19, z }, { ao: false });
          k.body.add(shapes.cyl(0.07, 0.07, 0.02, 10), C.mustard, { x, y: 0.01, z }, { ao: false });
          k.body.add(shapes.sphere(0.03, 6, 4), C.mustard, { x, y: 0.4, z }, { ao: false });
        }
        k.body.add(shapes.torus(0.25, 0.015, 12), C.red, { x: (x0 + x1) / 2, y: 0.36, z, rz: Math.PI, s: [1, 0.5, 1] }, { ao: false });
      }
      return 0;
    })(),
    ),

  // Dana's table outside Bo's: a little round table with lunch on it, two bistro chairs and a mint parasol
  dana: (k) => {
    k.body.add(shapes.cyl(0.2, 0.2, 0.03, 16), C.white, { y: 0.44 }, { ao: false });
    k.body.add(shapes.cyl(0.02, 0.025, 0.42, 6), C.metal, { y: 0.22 }, { ao: false });
    k.body.add(shapes.cyl(0.1, 0.12, 0.02, 10), C.metal, { y: 0.01 }, { ao: false });
    // lunch: a box, a cup, a little vase
    k.body.add(shapes.box(0.12, 0.05, 0.09, 0.02, 1), C.teal, { x: -0.05, y: 0.48, z: 0.05 }, { ao: false });
    k.body.add(shapes.cyl(0.03, 0.025, 0.06, 8), C.cream, { x: 0.09, y: 0.485, z: 0.06 }, { ao: false });
    k.body.add(shapes.cyl(0.02, 0.025, 0.07, 6), C.sky, { x: 0.02, y: 0.49, z: -0.09 }, { ao: false });
    k.body.add(shapes.sphere(0.025, 6, 4), C.pink, { x: 0.02, y: 0.55, z: -0.09 }, { ao: false });
    // two chairs
    for (const sx of [-1, 1]) {
      const x = sx * 0.24;
      k.body.add(shapes.cyl(0.08, 0.08, 0.025, 12), C.coral, { x, y: 0.28 }, { ao: false });
      k.body.add(shapes.box(0.025, 0.24, 0.14, 0.01, 1), C.coral, { x: x + sx * 0.07, y: 0.42, rz: sx * 0.12 }, { ao: false });
      for (const sz of [-1, 1]) k.body.add(shapes.cyl(0.008, 0.008, 0.28, 4), C.metal, { x: x - sx * 0.02, y: 0.14, z: sz * 0.05 }, { ao: false });
    }
    // the parasol
    k.body.add(shapes.cyl(0.012, 0.012, 0.8, 5), C.trim, { y: 0.86 }, { ao: false });
    k.body.add(shapes.cone(0.44, 0.18, 10), C.mint, { y: 1.32 }, { ao: false });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      k.body.add(shapes.sphere(0.055, 6, 4), i % 2 ? C.mint : C.white, { x: Math.cos(a) * 0.42, y: 1.23, z: Math.sin(a) * 0.42, s: [1, 0.6, 1] }, { ao: false });
    }
    k.body.add(shapes.sphere(0.03, 6, 4), C.mustard, { y: 1.43 }, { ao: false });
    return 1.45;
  },

  // the Lumen: a navy art-deco cinema with cream bands, a stepped front crowned by a sunburst, a marquee rimmed with
  // bulbs, lit poster frames, and a blade sign of lights at its corner
  iris: (k, u) => {
    walls(k, 1.95, C.navy, { plinth: C.plum });
    for (const y of [1.05, 1.75]) k.body.add(shapes.box(k.W + 0.05, 0.06, k.D + 0.05, 0.02, 1), C.cream, { y }, { ao: false });
    const f = onFace(k, 'front', 0, 0, 0);
    // the stepped front and its sunburst
    k.body.add(shapes.box(1.7, 0.36, 0.16, 0.04, 2), C.cream, rel(f, u, 2.1, -0.05), { ao: false });
    k.body.add(shapes.box(1.0, 0.3, 0.16, 0.04, 2), C.cream, rel(f, u, 2.42, -0.05), { ao: false });
    k.body.add(halfDisc(0.36, 0.06), C.mustard, rel(f, u, 2.56, -0.02), { ao: false });
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI;
      k.body.add(shapes.box(0.03, 0.2, 0.02), C.cream, rel(f, u + Math.cos(a) * 0.2, 2.56 + Math.sin(a) * 0.2, 0.02, { rz: a - Math.PI / 2 }), { ao: false });
    }
    // the marquee
    const mw = 1.5;
    k.body.add(shapes.box(mw, 0.28, 0.44, 0.04, 2), C.plum, rel(f, u, 1.02, 0.2), { ao: false });
    k.body.add(shapes.box(mw - 0.12, 0.16, 0.02, 0.02, 1), C.cream, rel(f, u, 1.02, 0.43), { ao: false });
    for (let i = 0; i < 9; i++) k.body.add(shapes.box(0.08, 0.08, 0.02), i % 2 ? C.navy : C.red, rel(f, u - 0.48 + i * 0.12, 1.02, 0.44), { ao: false });
    for (let i = 0; i <= 12; i++) {
      const a = -mw / 2 + 0.04 + (i * (mw - 0.08)) / 12;
      k.bulbs.add(shapes.sphere(0.024, 6, 4), C.glow, rel(f, u + a, 1.17, 0.42));
      k.bulbs.add(shapes.sphere(0.024, 6, 4), C.glow, rel(f, u + a, 0.87, 0.42));
    }
    door(k, u - 0.22, { color: C.red, w: 0.38, glass: true });
    door(k, u + 0.22, { color: C.red, w: 0.38, glass: true });
    // poster frames either side, lit at night
    const posters = [C.sky, C.rose, C.mint, C.butter];
    let pi = 0;
    for (const sd of [-1, 1])
      for (let i = 0; i < 2; i++) {
        const at = u + sd * (0.95 + i * 0.5);
        if (Math.abs(at) > k.W / 2 - 0.22) continue;
        k.body.add(shapes.box(0.32, 0.46, 0.03, 0.01, 1), C.mustard, rel(f, at, 0.56, 0.03), { ao: false });
        k.body.add(shapes.box(0.26, 0.38, 0.03, 0.01, 1), posters[pi++ % posters.length], rel(f, at, 0.56, 0.045), { ao: false });
        k.bulbs.add(shapes.box(0.32, 0.025, 0.02), C.glow, rel(f, at, 0.82, 0.05));
      }
    // upstairs: a row of tall narrow windows
    for (let i = 0; i < 5; i++) {
      const at = -k.W / 2 + 0.4 + (i * (k.W - 0.8)) / 4;
      if (Math.abs(at - u) < 0.55) continue;
      windowOn(k, 'front', at, 1.42, { w: 0.18, h: 0.42, frame: C.cream, bars: false });
    }
    for (const face of ['left', 'right'] as const) {
      windowOn(k, face, -0.6, 1.42, { w: 0.18, h: 0.42, frame: C.cream, bars: false });
      windowOn(k, face, 0.6, 1.42, { w: 0.18, h: 0.42, frame: C.cream, bars: false });
    }
    const r = onFace(k, 'right', 0, 0, 0);
    k.body.add(shapes.box(0.32, 0.46, 0.03, 0.01, 1), C.mustard, rel(r, 0, 0.56, 0.03), { ao: false });
    k.body.add(shapes.box(0.26, 0.38, 0.03, 0.01, 1), C.lilac, rel(r, 0, 0.56, 0.045), { ao: false });
    const top = flatRoof(k, 1.95, C.stoneDark, { ledge: C.cream });
    // the projection room on the roof, its little window towards the screen
    k.body.add(shapes.box(0.9, 0.36, 0.6, 0.04, 2), C.plum, { x: -u * 0.5, y: top + 0.055, z: -k.D / 2 + 0.5 });
    k.body.add(shapes.box(0.98, 0.05, 0.68, 0.02, 1), C.cream, { x: -u * 0.5, y: top + 0.25, z: -k.D / 2 + 0.5 }, { ao: false });
    k.glass.add(shapes.box(0.2, 0.12, 0.02), C.glass, { x: -u * 0.5, y: top + 0.08, z: -k.D / 2 + 0.81 });
    for (const sx of [-1, 1]) k.body.add(shapes.box(0.3, 0.16, 0.24, 0.03, 1), C.stone, { x: sx * k.W * 0.3, y: top - 0.045, z: 0.1 });
    // the blade sign at the front corner on the far side from the door
    const bx = u > 0 ? -k.W / 2 + 0.3 : k.W / 2 - 0.3;
    const bz = k.D / 2 + 0.14;
    k.body.add(shapes.box(0.1, 1.2, 0.34, 0.04, 2), C.plum, { x: bx, y: 2.25, z: bz }, { ao: false });
    k.body.add(shapes.box(0.12, 1.1, 0.26, 0.03, 1), C.cream, { x: bx, y: 2.25, z: bz }, { ao: false });
    for (let i = 0; i < 5; i++) {
      k.bulbs.add(shapes.box(0.13, 0.13, 0.13, 0.03, 1), i % 2 ? '#ffe08a' : '#ffb0d0', { x: bx, y: 2.68 - i * 0.21, z: bz });
    }
    k.bulbs.add(shapes.sphere(0.06, 8, 6), C.glow, { x: bx, y: 2.9, z: bz });
    return Math.max(top, 2.95);
  },

  // the ticket booth: a little round-cornered kiosk with glass all round, a plum dome with a gold knob, a ledge with
  // red tickets and a lamp
  wren: (k) => {
    const w = Math.min(0.58, k.W - 0.04);
    k.body.add(shapes.box(w, 0.6, w, 0.08, 3), C.cream, { y: 0.3 });
    k.body.add(shapes.box(w + 0.04, 0.08, w + 0.04, 0.03, 1), C.plum, { y: 0.05 }, { ao: false });
    k.glass.add(shapes.box(w - 0.04, 0.4, w - 0.04, 0.06, 2), C.glass, { y: 0.81 });
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) k.body.add(shapes.box(0.05, 0.42, 0.05, 0.02, 1), C.mustard, { x: sx * (w / 2 - 0.04), y: 0.81, z: sz * (w / 2 - 0.04) }, { ao: false });
    k.body.add(shapes.box(w + 0.06, 0.06, w + 0.06, 0.03, 1), C.mustard, { y: 1.04 }, { ao: false });
    k.body.add(shapes.dome(w / 2 + 0.04, 16, 6), C.plum, { y: 1.06, s: [1, 0.8, 1] }, { ao: false });
    k.body.add(shapes.sphere(0.05, 8, 6), C.mustard, { y: 1.34 }, { ao: false });
    // the ledge, the window slot, tickets
    k.body.add(shapes.box(w - 0.1, 0.03, 0.08, 0.01, 1), C.woodDark, { y: 0.62, z: w / 2 + 0.03 }, { ao: false });
    k.body.add(shapes.box(0.06, 0.03, 0.04), C.red, { x: 0.12, y: 0.645, z: w / 2 + 0.03, ry: 0.3 }, { ao: false });
    k.body.add(shapes.box(0.06, 0.03, 0.04), C.red, { x: 0.15, y: 0.66, z: w / 2 + 0.035, ry: -0.2 }, { ao: false });
    // a panel with a star on the front
    k.body.add(shapes.box(w - 0.16, 0.3, 0.02, 0.01, 1), C.rose, { y: 0.3, z: w / 2 + 0.005 }, { ao: false });
    k.body.add(shapes.sphere(0.05, 6, 4), C.mustard, { y: 0.3, z: w / 2 + 0.02, s: [1, 1, 0.4] }, { ao: false });
    k.bulbs.add(shapes.box(w - 0.12, 0.03, 0.02), C.glow, { y: 0.98, z: w / 2 + 0.03 });
    return 1.4;
  },

  // Harbour Press: two storeys, cream over a bottle-green shopfront with two bay windows, a navy roof with a dormer, an
  // open book on its hanging sign, a cart of books outside
  claire: (k, u) =>
    Math.max(
    setBack(k, 0.34, (s) => {
      const green = '#4f8a72';
      walls(s, 1.78, C.cream, { plinth: C.stoneDark });
      const f = onFace(s, 'front', 0, 0, 0);
      // the shopfront: a green panel across the ground floor with a fascia
      k.body.add(shapes.box(s.W - 0.04, 0.98, 0.05, 0.02, 1), green, rel(f, 0, 0.53, 0.015), { ao: false });
      k.body.add(shapes.box(s.W + 0.04, 0.16, 0.12, 0.03, 1), green, rel(f, 0, 1.02, 0.05), { ao: false });
      k.body.add(shapes.box(s.W * 0.6, 0.08, 0.02), C.mustard, rel(f, 0, 1.02, 0.115), { ao: false });
      for (const sd of [-1, 1]) {
        const at = u + sd * 0.74;
        if (Math.abs(at) > s.W / 2 - 0.3) continue;
        shopWindow(s, at, 0.56, Math.min(0.66, s.W / 2 - Math.abs(u) - 0.45), 0.46, C.cream);
        // a row of books on the sill
        for (let i = 0; i < 6; i++) k.body.add(shapes.box(0.05, 0.12 + (i % 3) * 0.02, 0.08, 0.008, 1), COMICS[(i + (sd > 0 ? 3 : 0)) % COMICS.length], rel(f, at - 0.22 + i * 0.075, 0.37, 0.07), { ao: false });
      }
      door(s, u, { color: green, glass: true, lamp: true });
      for (const at of [-s.W * 0.3, s.W * 0.3]) windowOn(s, 'front', at, 1.42, { flowers: true, shutters: C.navy });
      for (const face of ['left', 'right'] as const) {
        windowOn(s, face, 0, 0.58, { frame: green });
        windowOn(s, face, 0, 1.42, { shutters: C.navy });
      }
      const top = gableRoof(s, 1.78, 0.56, C.navy, { wall: C.cream });
      // a dormer in the roof over the door
      const dz = s.D / 2 - 0.14;
      k.body.add(shapes.box(0.4, 0.34, 0.3, 0.03, 2), C.cream, { x: u, y: 2.0, z: dz });
      k.body.add(pyramid(), C.navy, { x: u, y: 2.27, z: dz, s: [0.5, 0.2, 0.42] }, { ao: false });
      k.body.add(shapes.box(0.26, 0.24, 0.02, 0.01, 1), C.trim, { x: u, y: 2.0, z: dz + 0.15 }, { ao: false });
      k.glass.add(shapes.box(0.2, 0.18, 0.02), C.glass, { x: u, y: 2.0, z: dz + 0.165 });
      chimney(s, -s.W * 0.32, -s.D * 0.12, 1.85, 0.5, C.coral);
      // the hanging sign: an open book
      const g = onFace(s, 'front', u + (u + 0.5 < s.W / 2 ? 0.48 : -0.48), 1.3, 0);
      k.body.add(shapes.box(0.04, 0.04, 0.3), C.metal, rel(g, 0, 0, 0.15), { ao: false });
      k.body.add(shapes.box(0.04, 0.24, 0.3, 0.02, 1), green, rel(g, 0, -0.16, 0.22, { ry: Math.PI / 2 }), { ao: false });
      for (const sd of [-1, 1]) k.body.add(shapes.box(0.11, 0.14, 0.012), C.white, rel(g, 0.035, -0.16, 0.22 + sd * 0.06, { ry: Math.PI / 2 - sd * 0.3 }), { ao: false });
      return top;
    }),
    (() => {
      // the cart of books outside, on the wider side of the door
      const b = besideDoor(k, u);
      const z = k.D / 2 - 0.17;
      const x = b.at;
      if (b.room > 0.6) {
        k.body.add(shapes.box(0.6, 0.2, 0.26, 0.03, 2), C.woodDark, { x, y: 0.3, z });
        for (let i = 0; i < 9; i++) k.body.add(shapes.box(0.05, 0.14 + (i % 3) * 0.02, 0.18, 0.008, 1), COMICS[(i * 5) % COMICS.length], { x: x - 0.24 + i * 0.06, y: 0.47, z, rz: i === 8 ? 0.3 : 0 }, { ao: false });
        for (const sx of [-1, 1]) k.body.add(shapes.torus(0.09, 0.02, 12), C.metal, { x: x + sx * 0.2, y: 0.1, z: z + 0.1 }, { ao: false });
        k.body.add(shapes.box(0.04, 0.2, 0.2), C.woodDark, { x: x + sx0(b.at, u) * 0.3, y: 0.1, z });
      }
      return 0;
    })(),
    ),

  // Bay FM: a white studio with blue bands, a long studio window, the red ON AIR light over the door, a round sign of
  // radio waves, a satellite dish and the antenna mast on the roof, its red light on top
  kit: (k, u) => {
    walls(k, 1.85, '#eef3f8', { plinth: C.navy });
    for (const y of [0.98, 1.7]) k.body.add(shapes.box(k.W + 0.05, 0.08, k.D + 0.05, 0.02, 1), C.blue, { y }, { ao: false });
    door(k, u, { color: C.blue, glass: true, w: 0.42 });
    const f = onFace(k, 'front', 0, 0, 0);
    // the ON AIR light over the door
    k.body.add(shapes.box(0.52, 0.18, 0.08, 0.03, 2), '#3d4150', rel(f, u, 0.85, 0.05), { ao: false });
    k.body.add(shapes.box(0.44, 0.11, 0.03, 0.02, 1), C.red, rel(f, u, 0.85, 0.09), { ao: false });
    for (let i = 0; i < 5; i++) k.bulbs.add(shapes.box(0.05, 0.04, 0.02), '#ffe3e0', rel(f, u - 0.14 + i * 0.07, 0.85, 0.105));
    // the studio windows either side
    for (const sd of [-1, 1]) {
      const at = u + sd * 0.78;
      if (Math.abs(at) > k.W / 2 - 0.3) continue;
      shopWindow(k, at, 0.55, Math.min(0.66, k.W / 2 - Math.abs(u) - 0.45), 0.36, C.navy);
    }
    // upstairs: a long window band
    k.body.add(shapes.box(k.W - 0.5, 0.4, 0.05, 0.02, 1), C.navy, rel(f, 0, 1.34, 0.02), { ao: false });
    k.glass.add(shapes.box(k.W - 0.58, 0.32, 0.03, 0.01, 1), C.glass, rel(f, 0, 1.34, 0.04));
    for (let i = 1; i < 4; i++) k.body.add(shapes.box(0.03, 0.32, 0.025), C.navy, rel(f, -(k.W - 0.58) / 2 + (i * (k.W - 0.58)) / 4, 1.34, 0.06), { ao: false });
    for (const face of ['left', 'right'] as const) {
      windowOn(k, face, -0.5, 0.58, { frame: C.navy, bars: false });
      windowOn(k, face, 0.5, 0.58, { frame: C.navy, bars: false });
      windowOn(k, face, 0, 1.34, { w: 0.6, frame: C.navy, bars: false });
    }
    const top = flatRoof(k, 1.85, C.stoneDark, { ledge: C.blue });
    const sg = { x: 0, y: top + 0.32, z: k.D / 2 - 0.12 };
    k.body.add(shapes.box(0.05, 0.3, 0.05), C.metal, { x: sg.x, y: top + 0.08, z: sg.z }, { ao: false });
    k.body.add(shapes.cyl(0.26, 0.26, 0.06, 24), C.blue, { ...sg, rx: Math.PI / 2 }, { ao: false });
    k.body.add(shapes.cyl(0.21, 0.21, 0.065, 24), C.white, { ...sg, rx: Math.PI / 2 }, { ao: false });
    k.body.add(shapes.sphere(0.04, 8, 6), C.red, { ...sg, z: sg.z + 0.04 }, { ao: false });
    for (const r of [0.09, 0.15]) {
      k.body.add(shapes.custom(`cityWave${r}`, () => new TorusGeometry(r, 0.015, 4, 10, Math.PI / 2)), C.blue, { ...sg, z: sg.z + 0.04, rz: -Math.PI / 4 }, { ao: false });
      k.body.add(shapes.custom(`cityWave${r}`, () => new TorusGeometry(r, 0.015, 4, 10, Math.PI / 2)), C.blue, { ...sg, z: sg.z + 0.04, rz: (Math.PI * 3) / 4 }, { ao: false });
    }
    // a dish
    k.body.add(shapes.cyl(0.03, 0.03, 0.16, 6), C.metal, { x: k.W * 0.28, y: top + 0.08, z: 0.2 }, { ao: false });
    k.body.add(shapes.dome(0.2, 12, 5), C.white, { x: k.W * 0.28, y: top + 0.2, z: 0.25, rx: 1.0, s: [1, 0.4, 1] }, { ao: false });
    // the mast: three legs tapering to a point, cross bars, a red light on top
    const mx = -k.W * 0.25;
    const mz = -k.D * 0.2;
    const mh = 1.85;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const r0 = 0.2;
      const lean = Math.atan2(r0 - 0.03, mh);
      k.body.add(shapes.cyl(0.018, 0.022, mh / Math.cos(lean), 5), C.red, { x: mx + Math.cos(a) * (r0 + 0.03) / 2, y: top + mh / 2, z: mz + Math.sin(a) * (r0 + 0.03) / 2, rx: -Math.sin(a) * lean, rz: Math.cos(a) * lean }, { ao: false });
    }
    for (let j = 1; j < 4; j++) {
      const t = j / 4;
      const rr = 0.2 - (0.2 - 0.03) * t;
      k.body.add(shapes.torus(rr, 0.012, 12), j % 2 ? C.white : C.red, { x: mx, y: top + mh * t, z: mz, rx: Math.PI / 2 }, { ao: false });
    }
    k.body.add(shapes.cyl(0.012, 0.012, 0.3, 4), C.metal, { x: mx, y: top + mh + 0.15, z: mz }, { ao: false });
    k.body.add(shapes.sphere(0.055, 8, 6), C.red, { x: mx, y: top + mh + 0.3, z: mz }, { ao: false });
    k.bulbs.add(shapes.sphere(0.03, 6, 4), '#ff4d4d', { x: mx, y: top + mh + 0.36, z: mz });
    k.bulbs.add(shapes.sphere(0.035, 6, 4), '#ff4d4d', { x: mx, y: top + mh * 0.5, z: mz + 0.1 });
    return top + mh + 0.4;
  },

  // ───────────────────────── the office district ─────────────────────────

  // Meridian's head office: three storeys of pale stone with a glass front, a revolving door under a canopy, a flat
  // roof with the company's globe in a sign frame and plant on it; planters out front
  priya: (k, u) =>
    Math.max(
      setBack(k, 0.42, (s) => {
        const stone = '#ece7dd';
        const mull = '#5a6f95';
        const H = 2.7;
        walls(s, H, stone, { plinth: C.stoneDark });
        for (const y of [0.92, 1.8]) k.body.add(shapes.box(s.W + 0.05, 0.07, s.D + 0.05, 0.02, 1), C.trim, { y }, { ao: false });
        // the glass: a curtain wall on the front and a band per storey on the sides
        const band = (face: 'front' | 'left' | 'right', len: number) => {
          const f = onFace(s, face, 0, 0, 0);
          const gw = len - 0.5;
          const n = Math.max(2, Math.round(gw / 0.42));
          for (const [v, h] of [
            [0.5, 0.62],
            [1.36, 0.66],
            [2.22, 0.66],
          ] as const) {
            k.glass.add(shapes.box(gw, h, 0.03, 0.01, 1), '#9cc9ec', rel(f, 0, v, 0.03));
            for (let i = 0; i <= n; i++) k.body.add(shapes.box(0.035, h + 0.04, 0.04), mull, rel(f, -gw / 2 + (i * gw) / n, v, 0.05), { ao: false });
            k.body.add(shapes.box(gw + 0.04, 0.035, 0.04), mull, rel(f, 0, v + h / 2, 0.05), { ao: false });
            k.body.add(shapes.box(gw + 0.04, 0.035, 0.04), mull, rel(f, 0, v - h / 2, 0.05), { ao: false });
          }
        };
        band('front', s.W);
        band('right', s.D);
        band('left', s.D);
        // the revolving door: a glass drum, its four wings, a cap and a canopy over it
        const f = onFace(s, 'front', u, 0, 0);
        k.body.add(shapes.cyl(0.33, 0.33, 0.04, 20), C.stoneDark, rel(f, 0, 0.02, 0.1), { ao: false });
        k.glass.add(shapes.cyl(0.29, 0.29, 0.72, 20), '#b9dcf3', rel(f, 0, 0.4, 0.1));
        for (const a of [0.4, 0.4 + Math.PI / 2]) k.body.add(shapes.box(0.56, 0.68, 0.025), mull, rel(f, 0, 0.4, 0.1, { ry: a }), { ao: false });
        k.body.add(shapes.cyl(0.32, 0.32, 0.08, 20), mull, rel(f, 0, 0.8, 0.1), { ao: false });
        k.body.add(shapes.box(1.4, 0.06, 0.56, 0.02, 1), mull, rel(f, 0, 0.96, 0.24), { ao: false });
        k.glass.add(shapes.box(1.3, 0.02, 0.48), '#d8ecfa', rel(f, 0, 0.995, 0.24));
        for (let i = 0; i < 5; i++) k.bulbs.add(shapes.sphere(0.022, 6, 4), C.glow, rel(f, -0.5 + i * 0.25, 0.92, 0.46));
        const top = flatRoof(s, H, C.stoneDark, { ledge: C.trim });
        // the sign frame on the roof's front: the globe of Meridian (a ring, a meridian, the equator, a gold dot)
        const sz = s.D / 2 - 0.16;
        for (const sx of [-1, 1]) k.body.add(shapes.box(0.06, 0.62, 0.06), C.metal, { x: sx * 0.72, y: top + 0.28, z: sz }, { ao: false });
        k.body.add(shapes.box(1.8, 0.56, 0.08, 0.03, 2), C.navy, { y: top + 0.5, z: sz }, { ao: false });
        k.body.add(shapes.box(1.86, 0.04, 0.1), C.trim, { y: top + 0.79, z: sz }, { ao: false });
        const g = { x: -0.5, y: top + 0.5, z: sz + 0.05 };
        k.body.add(shapes.torus(0.18, 0.025, 20), C.white, g, { ao: false });
        k.body.add(shapes.torus(0.18, 0.02, 20), C.white, { ...g, s: [0.42, 1, 1] }, { ao: false });
        k.body.add(shapes.box(0.36, 0.025, 0.02), C.white, g, { ao: false });
        k.body.add(shapes.sphere(0.04, 8, 6), C.mustard, { ...g, x: g.x + 0.13, y: g.y + 0.13 }, { ao: false });
        k.body.add(shapes.box(0.74, 0.08, 0.02), C.white, { x: 0.3, y: top + 0.55, z: sz + 0.05 }, { ao: false });
        k.body.add(shapes.box(0.5, 0.05, 0.02), C.sky, { x: 0.18, y: top + 0.42, z: sz + 0.05 }, { ao: false });
        for (let i = 0; i < 6; i++) k.bulbs.add(shapes.sphere(0.02, 6, 4), '#dff1ff', { x: -0.75 + i * 0.3, y: top + 0.2, z: sz + 0.06 });
        // the plant on the roof: two units with fans, a mast
        for (const sx of [-1, 1]) {
          k.body.add(shapes.box(0.6, 0.3, 0.5, 0.04, 2), C.stone, { x: sx * s.W * 0.28, y: top - 0.01, z: -s.D * 0.22 });
          k.body.add(shapes.cyl(0.16, 0.16, 0.03, 14), C.metal, { x: sx * s.W * 0.28, y: top + 0.15, z: -s.D * 0.22 }, { ao: false });
        }
        k.body.add(shapes.cyl(0.015, 0.02, 0.7, 5), C.metal, { x: s.W * 0.4, y: top + 0.2, z: s.D * 0.1 }, { ao: false });
        k.bulbs.add(shapes.sphere(0.03, 6, 4), C.red, { x: s.W * 0.4, y: top + 0.56, z: s.D * 0.1 });
        return top + 0.84;
      }),
      (() => {
        // planters either side of the door
        const z = k.D / 2 - 0.17;
        for (const sd of [-1, 1]) {
          const x = u + sd * 1.0;
          if (Math.abs(x) < k.W / 2 - 0.3) planter(k, x, z, 0.56);
        }
        return 0;
      })(),
    ),

  // Mr Whitlock's newspaper kiosk: a green eight-sided stand, racks of papers and magazines on its faces, a striped
  // roof with a gold knob, a tied bundle of today's papers at its foot
  whitlock: (k) => {
    const green = '#4f8a72';
    const r = Math.min(0.29, k.W / 2 - 0.03);
    const oct = Math.PI / 8;
    k.body.add(shapes.cyl(r + 0.02, r + 0.03, 0.08, 8), C.stoneDark, { y: 0.04, ry: oct });
    k.body.add(shapes.cyl(r - 0.02, r - 0.02, 0.62, 8), green, { y: 0.39, ry: oct });
    k.body.add(shapes.cyl(r + 0.02, r + 0.02, 0.03, 8), C.woodLight, { y: 0.71, ry: oct }, { ao: false });
    // the window band over the ledge and its posts
    k.glass.add(shapes.cyl(r - 0.05, r - 0.05, 0.22, 8), C.glass, { y: 0.84, ry: oct });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.body.add(shapes.box(0.03, 0.24, 0.03), green, { x: Math.sin(a) * (r - 0.04), y: 0.84, z: Math.cos(a) * (r - 0.04) }, { ao: false });
    }
    // papers and magazines in the racks on the four faces seen
    const d = (r - 0.02) * Math.cos(oct);
    let c = 0;
    for (const a of [0, Math.PI / 4, Math.PI / 2, -Math.PI / 4])
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 2; i++) {
          const along = (i - 0.5) * 0.1;
          const x = Math.sin(a) * (d + 0.02) + Math.cos(a) * along;
          const z = Math.cos(a) * (d + 0.02) - Math.sin(a) * along;
          const mag = (c++ % 3) === 1;
          k.body.add(shapes.box(0.085, 0.12, 0.012, 0.004, 1), mag ? COMICS[c % COMICS.length] : C.white, { x, y: 0.3 + row * 0.18, z, ry: a, rx: -0.12 }, { ao: false });
          if (!mag) k.body.add(shapes.box(0.07, 0.02, 0.006), c % 2 ? C.red : C.navy, { x: x + Math.sin(a) * 0.008, y: 0.34 + row * 0.18, z: z + Math.cos(a) * 0.008, ry: a, rx: -0.12 }, { ao: false });
        }
    // the striped roof
    k.body.add(shapes.cyl(r + 0.05, r + 0.05, 0.05, 8), green, { y: 0.97, ry: oct }, { ao: false });
    k.body.add(shapes.cone(r + 0.1, 0.24, 8), C.cream, { y: 1.12, ry: oct }, { ao: false });
    for (let i = 0; i < 8; i += 2) {
      const a = (i / 8) * Math.PI * 2 + oct;
      k.body.add(shapes.box(0.09, 0.02, 0.36), green, { x: Math.sin(a) * 0.17, y: 1.1, z: Math.cos(a) * 0.17, ry: a, rx: 0.62 }, { ao: false });
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.body.add(shapes.sphere(0.045, 6, 4), i % 2 ? green : C.cream, { x: Math.sin(a) * (r + 0.08), y: 0.98, z: Math.cos(a) * (r + 0.08), s: [1, 0.6, 1] }, { ao: false });
    }
    k.body.add(shapes.sphere(0.04, 8, 6), C.mustard, { y: 1.26 }, { ao: false });
    k.bulbs.add(shapes.sphere(0.03, 6, 4), C.glow, { y: 0.92, z: r + 0.02 });
    // the bundle of papers, tied with string
    k.body.add(shapes.box(0.14, 0.1, 0.1, 0.01, 1), C.cream, { x: 0.2, y: 0.05, z: 0.22, ry: 0.3 });
    k.body.add(shapes.box(0.145, 0.012, 0.105), C.woodDark, { x: 0.2, y: 0.07, z: 0.22, ry: 0.3 }, { ao: false });
    return 1.3;
  },

  // the Loom: a converted brick workshop, a big steel-framed studio window, a mural of colour blocks on its right
  // wall, a saw-tooth roof with its glass to the front, three squares of colour over the door
  vivian: (k, u) => {
    const brick = '#c47a62';
    const H = 1.32;
    walls(k, H, brick, { plinth: C.stoneDark });
    // darker bricks here and there on the two walls seen
    for (const face of ['front', 'right'] as const) {
      const len = face === 'front' ? k.W : k.D;
      const f = onFace(k, face, 0, 0, 0);
      for (let i = 0; i < 26; i++) {
        const along = (hash(i * 3 + (face === 'front' ? 0 : 100)) - 0.5) * (len - 0.2);
        const up = 0.2 + hash(i * 7 + 5) * (H - 0.3);
        k.body.add(shapes.box(0.12, 0.05, 0.02, 0.008, 1), '#a9604d', rel(f, along, up, 0.006), { ao: false });
      }
    }
    k.body.add(shapes.box(k.W + 0.06, 0.07, k.D + 0.06, 0.02, 1), C.stone, { y: H - 0.03 }, { ao: false });
    door(k, u, { color: C.mustard, glass: true, lamp: true });
    // the studio window: a steel grid on the wider side of the door
    const b = besideDoor(k, u);
    const ww = Math.min(1.9, b.room - 0.15);
    const dark = '#3d4150';
    if (ww > 0.4) {
      const f = onFace(k, 'front', b.at, 0.62, 0);
      const wh = 0.8;
      k.body.add(shapes.box(ww + 0.08, wh + 0.08, 0.05, 0.02, 1), dark, rel(f, 0, 0, 0.02), { ao: false });
      k.glass.add(shapes.box(ww, wh, 0.03, 0.01, 1), C.glass, rel(f, 0, 0, 0.04));
      const cols = Math.max(2, Math.round(ww / 0.3));
      for (let i = 1; i < cols; i++) k.body.add(shapes.box(0.025, wh, 0.025), dark, rel(f, -ww / 2 + (i * ww) / cols, 0, 0.06), { ao: false });
      for (const v of [-wh / 6, wh / 6]) k.body.add(shapes.box(ww, 0.025, 0.025), dark, rel(f, 0, v, 0.06), { ao: false });
      k.body.add(shapes.box(ww + 0.16, 0.09, 0.08, 0.02, 1), C.stone, rel(f, 0, wh / 2 + 0.08, 0.04), { ao: false });
    }
    // three squares of colour over the door: the studio's mark
    const sf = onFace(k, 'front', u, 1.0, 0);
    for (const [i, c] of [
      [-1, C.coral],
      [0, C.mustard],
      [1, C.teal],
    ] as const)
      k.body.add(shapes.box(0.12, 0.12, 0.03, 0.01, 1), c, rel(sf, i * 0.14, 0, 0.02), { ao: false });
    windowOn(k, 'left', 0, 0.62, { w: 0.6, h: 0.6, frame: dark });
    // the mural on the right wall: bold blocks of colour, a circle, a diagonal
    const r = onFace(k, 'right', 0, 0, 0);
    const m = (along: number, up: number, w: number, h: number, c: ColorRepresentation, out: number, rz = 0) =>
      k.body.add(shapes.box(w, h, 0.02, 0.01, 1), c, rel(r, along, up, out, { rz }), { ao: false });
    m(-0.65, 0.62, 0.9, 0.86, C.mustard, 0.012);
    m(0.15, 0.82, 0.7, 0.62, C.teal, 0.016);
    m(0.75, 0.42, 0.6, 0.5, C.rose, 0.014);
    m(-0.2, 0.32, 0.5, 0.36, C.navy, 0.02);
    k.body.add(shapes.cyl(0.26, 0.26, 0.02, 24), C.coral, rel(r, 0.6, 0.92, 0.024, { rx: Math.PI / 2 }), { ao: false });
    m(-0.3, 0.9, 1.0, 0.08, C.white, 0.026, 0.5);
    // the saw-tooth roof: three teeth, their glass to the front
    const n = 3;
    const L = k.D / n;
    const th = 0.44;
    const slate = '#7d8aa0';
    const a = Math.atan2(th, L);
    for (let i = 0; i < n; i++) {
      const z = -k.D / 2 + L * (i + 0.5);
      k.body.add(wedge(k.W + 0.06, L, th), brick, { y: H, z }, { ao: false });
      k.body.add(shapes.box(k.W + 0.14, 0.05, Math.hypot(L, th) + 0.04, 0.02, 1), slate, { y: H + th / 2 + 0.03, z, rx: -a }, { ao: false });
      k.glass.add(shapes.box(k.W - 0.24, th - 0.12, 0.03, 0.01, 1), C.glass, { y: H + th / 2 - 0.01, z: z + L / 2 + 0.005 });
      for (let j = 1; j < 6; j++) k.body.add(shapes.box(0.025, th - 0.12, 0.03), dark, { x: -(k.W - 0.24) / 2 + (j * (k.W - 0.24)) / 6, y: H + th / 2 - 0.01, z: z + L / 2 + 0.02 }, { ao: false });
    }
    // a flue at the back corner
    k.body.add(shapes.cyl(0.06, 0.06, 0.6, 8), C.metal, { x: -k.W / 2 + 0.3, y: H + 0.5, z: -k.D / 2 + 0.25 }, { ao: false });
    k.body.add(shapes.cyl(0.1, 0.06, 0.06, 8), C.metal, { x: -k.W / 2 + 0.3, y: H + 0.82, z: -k.D / 2 + 0.25 }, { ao: false });
    return H + th + 0.55;
  },

  // Hana's information desk outdoors: a curved teal counter, leaflets and a bell on its top, a small canopy, a lit
  // round "i" sign on a post over it
  hana: (k) => {
    const r = Math.min(0.27, k.W / 2 - 0.04);
    const cz = -0.06;
    k.body.add(halfDrum(r, 0.5), C.teal, { y: 0.25, z: cz });
    k.body.add(shapes.box(r * 2, 0.5, 0.04, 0.01, 1), C.teal, { y: 0.25, z: cz - 0.02 });
    k.body.add(halfDrum(r + 0.035, 0.04), C.woodLight, { y: 0.52, z: cz }, { ao: false });
    k.body.add(halfDrum(r + 0.005, 0.06), C.white, { y: 0.36, z: cz }, { ao: false });
    // leaflets in a rack, a bell, a little plant
    for (let i = 0; i < 3; i++) k.body.add(shapes.box(0.05, 0.08, 0.015, 0.004, 1), [C.coral, C.mustard, C.sky][i], { x: -0.14 + i * 0.06, y: 0.58, z: cz + 0.12, rx: -0.2 }, { ao: false });
    k.body.add(shapes.dome(0.03, 10, 5), C.mustard, { x: 0.1, y: 0.54, z: cz + 0.12 }, { ao: false });
    pot(k.body, 0.15, cz + 0.02, 0.54, C.white);
    // the canopy on two posts at the back
    for (const sx of [-1, 1]) k.body.add(shapes.cyl(0.015, 0.015, 1.0, 5), C.metal, { x: sx * (k.W / 2 - 0.04), y: 0.5, z: -k.D / 2 + 0.05 }, { ao: false });
    k.body.add(shapes.box(k.W + 0.06, 0.04, k.D - 0.02, 0.015, 1), C.white, { y: 1.02, z: 0.02, rx: 0.1 }, { ao: false });
    for (let i = 0; i < 7; i++) {
      const x = -(k.W + 0.06) / 2 + ((k.W + 0.06) / 7) * (i + 0.5);
      k.body.add(shapes.sphere((k.W + 0.06) / 14, 8, 5), i % 2 ? C.white : C.teal, { x, y: 0.97, z: k.D / 2 + 0.01, s: [1, 0.55, 0.4] }, { ao: false });
    }
    // the round "i" sign on a short post over the canopy
    k.body.add(shapes.cyl(0.015, 0.015, 0.2, 5), C.metal, { y: 1.13, z: -0.02 }, { ao: false });
    k.body.add(shapes.cyl(0.13, 0.13, 0.04, 20), C.blue, { y: 1.34, z: -0.02, rx: Math.PI / 2 }, { ao: false });
    k.body.add(shapes.torus(0.13, 0.015, 20), C.white, { y: 1.34, z: 0.0 }, { ao: false });
    k.bulbs.add(shapes.sphere(0.022, 8, 6), '#fffbe8', { y: 1.41, z: 0.01 });
    k.bulbs.add(shapes.box(0.035, 0.1, 0.02, 0.008, 1), '#fffbe8', { y: 1.3, z: 0.01 });
    return 1.48;
  },

  // FreshWay's regional office: two neat storeys of white with a FreshWay-green band, a round green sign with a white
  // leaf, solar panels on the roof; a shopping trolley and a tub of herbs outside
  colin: (k, u) =>
    Math.max(
      setBack(k, 0.38, (s) => {
        const green = '#4fae6a';
        walls(s, 1.86, C.white, { plinth: green });
        k.body.add(shapes.box(s.W + 0.06, 0.14, s.D + 0.06, 0.03, 1), green, { y: 1.0 }, { ao: false });
        door(s, u, { color: green, glass: true, w: 0.42 });
        for (const sd of [-1, 1]) {
          const at = u + sd * 0.74;
          const w = Math.min(0.66, s.W / 2 - Math.abs(u) - 0.45);
          if (Math.abs(at) > s.W / 2 - 0.3 || w < 0.3) continue;
          shopWindow(s, at, 0.55, w, 0.42, green);
        }
        for (const at of [-s.W * 0.33, s.W * 0.33]) windowOn(s, 'front', at, 1.44, { w: 0.5, h: 0.36, frame: green, bars: false });
        for (const face of ['left', 'right'] as const)
          for (const at of [-0.8, 0, 0.8]) {
            windowOn(s, face, at, 0.58, { w: 0.4, frame: green, bars: false });
            windowOn(s, face, at, 1.44, { w: 0.4, frame: green, bars: false });
          }
        // the round sign between the upstairs windows: a white leaf on green
        const f = onFace(s, 'front', 0, 1.44, 0);
        k.body.add(shapes.cyl(0.27, 0.27, 0.05, 24), C.white, rel(f, 0, 0, 0.03, { rx: Math.PI / 2 }), { ao: false });
        k.body.add(shapes.cyl(0.23, 0.23, 0.05, 24), green, rel(f, 0, 0, 0.05, { rx: Math.PI / 2 }), { ao: false });
        k.body.add(shapes.sphere(0.12, 12, 8), C.white, rel(f, 0.01, 0.01, 0.08, { rz: -0.7, s: [0.5, 1.2, 0.22] }), { ao: false });
        k.body.add(shapes.box(0.012, 0.2, 0.01), green, rel(f, 0.01, 0.01, 0.105, { rz: -0.7 }), { ao: false });
        k.body.add(shapes.box(0.02, 0.08, 0.015), C.white, rel(f, -0.09, -0.11, 0.08, { rz: -0.7 }), { ao: false });
        const top = flatRoof(s, 1.86, C.stoneDark, { ledge: green });
        // solar panels on the roof
        for (let i = 0; i < 3; i++) {
          const x = -s.W * 0.3 + i * s.W * 0.3;
          k.body.add(shapes.box(0.04, 0.16, 0.04), C.metal, { x, y: top + 0.0, z: -s.D * 0.15 }, { ao: false });
          k.body.add(shapes.box(0.8, 0.03, 0.6, 0.01, 1), '#3f5f8f', { x, y: top + 0.12, z: -s.D * 0.15, rx: -0.35 }, { ao: false });
          for (let j = 1; j < 4; j++) k.body.add(shapes.box(0.01, 0.035, 0.58), C.sky, { x: x - 0.4 + j * 0.2, y: top + 0.125, z: -s.D * 0.15, rx: -0.35 }, { ao: false });
        }
        return top + 0.3;
      }),
      (() => {
        const b = besideDoor(k, u);
        const z = k.D / 2 - 0.18;
        // the shopping trolley, a little shopping in it
        const tx = b.at;
        const steel = '#c9d3da';
        k.body.add(shapes.box(0.34, 0.18, 0.22, 0.02, 1), steel, { x: tx, y: 0.44, z });
        k.body.add(shapes.box(0.3, 0.02, 0.18), '#7b8794', { x: tx, y: 0.535, z }, { ao: false });
        k.body.add(shapes.sphere(0.05, 8, 6), C.orange, { x: tx - 0.08, y: 0.56, z: z + 0.03 }, { ao: false });
        k.body.add(shapes.blob(0.06, 1), C.leaf, { x: tx + 0.02, y: 0.57, z: z - 0.02 }, { ao: false });
        k.body.add(shapes.box(0.12, 0.06, 0.06, 0.02, 1), C.woodLight, { x: tx + 0.1, y: 0.56, z: z + 0.04, ry: 0.4 }, { ao: false });
        k.body.add(shapes.cyl(0.018, 0.018, 0.26, 6), C.red, { x: tx + 0.21, y: 0.58, z, rx: Math.PI / 2 }, { ao: false });
        for (const sz of [-1, 1]) k.body.add(shapes.box(0.12, 0.02, 0.02), C.metal, { x: tx + 0.16, y: 0.54, z: z + sz * 0.1 }, { ao: false });
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) {
            k.body.add(shapes.box(0.02, 0.32, 0.02), C.metal, { x: tx + sx * 0.14, y: 0.2, z: z + sz * 0.08 }, { ao: false });
            k.body.add(shapes.sphere(0.03, 6, 4), '#3d4150', { x: tx + sx * 0.14, y: 0.03, z: z + sz * 0.08 }, { ao: false });
          }
        // a tub of herbs on the other side
        const hx = b.at > u ? u - 0.5 : u + 0.5;
        if (Math.abs(hx) < k.W / 2 - 0.2) planter(k, hx, z, 0.3, '#4fae6a');
        return 0;
      })(),
    ),

  // Dev's computer workshop: a small blue-grey unit, its roller shutter half up over a shelf of monitors and a tower,
  // a dish and an aerial on the roof, cables down the wall; an old tower and a coil of cable outside
  dev: (k, u) =>
    Math.max(
      setBack(k, 0.26, (s) => {
        walls(s, 1.06, '#a9b8c9', { plinth: C.navy });
        door(s, u, { color: C.navy, glass: true });
        const b = besideDoor(s, u);
        const ww = Math.min(0.8, b.room - 0.1);
        if (ww > 0.3) {
          const f = onFace(s, 'front', b.at, 0, 0);
          k.body.add(shapes.box(ww + 0.1, 0.72, 0.05, 0.02, 1), C.trim, rel(f, 0, 0.5, 0.02), { ao: false });
          k.body.add(shapes.box(ww, 0.64, 0.03, 0.01, 1), '#3a3f4f', rel(f, 0, 0.5, 0.035), { ao: false });
          k.body.add(shapes.box(ww, 0.03, 0.12, 0.01, 1), C.woodLight, rel(f, 0, 0.33, 0.07), { ao: false });
          // the monitors, their screens lit, and a tower at the end
          const n = Math.max(1, Math.floor((ww - 0.12) / 0.2));
          const screens = ['#8fe3ff', '#b7f5c4', '#ffd98a'];
          for (let i = 0; i < n; i++) {
            const x = -ww / 2 + 0.12 + i * 0.2;
            k.body.add(shapes.box(0.17, 0.13, 0.04, 0.01, 1), '#2b2f3a', rel(f, x, 0.44, 0.08), { ao: false });
            k.bulbs.add(shapes.box(0.14, 0.1, 0.01), screens[i % 3], rel(f, x, 0.445, 0.102));
            k.body.add(shapes.box(0.03, 0.03, 0.03), '#2b2f3a', rel(f, x, 0.36, 0.08), { ao: false });
          }
          k.body.add(shapes.box(0.08, 0.17, 0.09, 0.01, 1), '#d7dce3', rel(f, ww / 2 - 0.07, 0.43, 0.08), { ao: false });
          k.bulbs.add(shapes.sphere(0.01, 4, 3), '#7dff9a', rel(f, ww / 2 - 0.07, 0.48, 0.126));
          // the roller shutter, half up: ribs, a handle, its box at the top
          k.body.add(shapes.box(ww + 0.06, 0.3, 0.04, 0.01, 1), '#c5ccd6', rel(f, 0, 0.7, 0.07), { ao: false });
          for (let i = 0; i < 5; i++) k.body.add(shapes.box(ww + 0.06, 0.012, 0.01), '#8d96a3', rel(f, 0, 0.58 + i * 0.055, 0.092), { ao: false });
          k.body.add(shapes.box(0.12, 0.03, 0.03), C.metal, rel(f, 0, 0.57, 0.1), { ao: false });
          k.body.add(shapes.box(ww + 0.12, 0.1, 0.1, 0.02, 1), '#8d96a3', rel(f, 0, 0.9, 0.06), { ao: false });
        }
        windowOn(s, 'right', 0, 0.6, { frame: C.trim, bars: false });
        // the sign over the door: a little monitor on navy
        const sg = signBoard(s, u, 0.92, 0.34, 0.14, C.navy, C.trim);
        k.body.add(shapes.box(0.12, 0.08, 0.01, 0.01, 1), C.white, rel(sg, 0, 0.01, 0.005), { ao: false });
        k.bulbs.add(shapes.box(0.09, 0.055, 0.01), '#8fe3ff', rel(sg, 0, 0.012, 0.012));
        const top = flatRoof(s, 1.06, C.stoneDark, { ledge: C.navy });
        // the dish and the aerial
        const dx = s.W * 0.22;
        k.body.add(shapes.cyl(0.025, 0.025, 0.16, 6), C.metal, { x: dx, y: top + 0.06, z: 0.0 }, { ao: false });
        k.body.add(shapes.dome(0.2, 12, 5), C.white, { x: dx, y: top + 0.2, z: 0.05, rx: 1.0, s: [1, 0.4, 1] }, { ao: false });
        k.body.add(shapes.cyl(0.008, 0.008, 0.18, 4), C.metal, { x: dx, y: top + 0.25, z: 0.17, rx: 0.6 }, { ao: false });
        k.body.add(shapes.cyl(0.01, 0.012, 0.6, 4), C.metal, { x: -s.W * 0.3, y: top + 0.25, z: -s.D * 0.2 }, { ao: false });
        for (let i = 0; i < 3; i++) k.body.add(shapes.box(0.22 - i * 0.05, 0.012, 0.012), C.metal, { x: -s.W * 0.3, y: top + 0.32 + i * 0.1, z: -s.D * 0.2 }, { ao: false });
        // the cables from the dish down the right wall
        const r = onFace(s, 'right', 0, 0, 0);
        for (const [along, c] of [
          [0.1, '#2b2f3a'],
          [0.16, C.red],
        ] as const) {
          k.body.add(shapes.cyl(0.012, 0.012, 1.0, 4), c, rel(r, along, 0.62, 0.03, { rz: 0.05 }), { ao: false });
          k.body.add(shapes.torus(0.05, 0.012, 8), c, rel(r, along + 0.03, 0.1, 0.05, { rx: Math.PI / 2 }), { ao: false });
        }
        return top + 0.45;
      }),
      (() => {
        const z = k.D / 2 - 0.14;
        const ox = u + (u < 0 ? 0.4 : -0.4);
        if (Math.abs(ox) < k.W / 2 - 0.1) {
          k.body.add(shapes.box(0.1, 0.24, 0.18, 0.015, 1), '#d7dce3', { x: ox, y: 0.12, z, ry: 0.2 });
          k.body.add(shapes.box(0.02, 0.2, 0.15), '#9aa3b0', { x: ox + 0.05, y: 0.13, z, ry: 0.2 }, { ao: false });
          k.body.add(shapes.torus(0.07, 0.015, 10), '#2b2f3a', { x: ox + 0.16, y: 0.015, z, rx: Math.PI / 2 }, { ao: false });
          k.body.add(shapes.torus(0.05, 0.015, 10), '#2b2f3a', { x: ox + 0.16, y: 0.04, z, rx: Math.PI / 2 }, { ao: false });
        }
        return 0;
      })(),
    ),

  // ───────────────────────── the hospital and the university ─────────────────────────

  // Westbay Hospital: three storeys of white with pale blue bands and an ambulance-yellow stripe, rows of windows, a
  // wide canopy over the glass doors, red crosses lit at night, a helipad and plant on the roof
  osei: (k, u) =>
    Math.max(
      setBack(k, 0.42, (s) => {
        const H = 2.76;
        walls(s, H, C.white, { plinth: C.stoneDark });
        for (const y of [0.96, 1.86]) k.body.add(shapes.box(s.W + 0.06, 0.1, s.D + 0.06, 0.03, 1), C.sky, { y }, { ao: false });
        k.body.add(shapes.box(s.W + 0.05, 0.06, s.D + 0.05, 0.02, 1), C.mustard, { y: 0.24 }, { ao: false });
        k.body.add(shapes.box(s.W + 0.05, 0.04, s.D + 0.05, 0.015, 1), C.blue, { y: 0.31 }, { ao: false });
        // rows of windows: front (leaving the entrance and the cross), sides (leaving the cross on the right)
        const rows = [0.6, 1.44, 2.3];
        const across = (len: number) => {
          const out: number[] = [];
          const n = Math.floor((len - 0.7) / 0.6);
          for (let i = 0; i <= n; i++) out.push(-((n * 0.6) / 2) + i * 0.6);
          return out;
        };
        for (const at of across(s.W))
          rows.forEach((v, r) => {
            if (r === 0 && Math.abs(at - u) < 1.05) return;
            if (r === 1 && Math.abs(at - u) < 0.4) return;
            windowOn(s, 'front', at, v, { w: 0.36, h: 0.4, frame: C.sky, bars: false });
          });
        for (const face of ['left', 'right'] as const)
          for (const at of across(s.D))
            rows.forEach((v, r) => {
              if (face === 'right' && r === 2 && Math.abs(at) < 0.45) return;
              windowOn(s, face, at, v, { w: 0.36, h: 0.4, frame: C.sky, bars: false });
            });
        // the glass doors and a fanlight
        const f = onFace(s, 'front', u, 0, 0);
        door(s, u - 0.24, { color: C.sky, glass: true, w: 0.44, h: 0.68 });
        door(s, u + 0.24, { color: C.sky, glass: true, w: 0.44, h: 0.68 });
        k.glass.add(shapes.box(0.92, 0.12, 0.03), C.glass, rel(f, 0, 0.82, 0.04));
        // the canopy on two posts, a blue edge and lights under it
        k.body.add(shapes.box(2.0, 0.08, 0.66, 0.03, 2), C.white, rel(f, 0, 1.06, 0.3), { ao: false });
        k.body.add(shapes.box(2.04, 0.06, 0.04, 0.02, 1), C.blue, rel(f, 0, 1.06, 0.64), { ao: false });
        for (const sd of [-1, 1]) k.body.add(shapes.cyl(0.03, 0.03, 1.04, 8), C.trim, rel(f, sd * 0.86, 0.52, 0.38), { ao: false });
        for (let i = 0; i < 4; i++) k.bulbs.add(shapes.sphere(0.03, 6, 4), C.glow, rel(f, -0.6 + i * 0.4, 1.0, 0.36));
        // the red crosses: over the canopy, and high on the right wall
        for (const p of [rel(f, 0, 1.46, 0), rel(onFace(s, 'right', 0, 2.3, 0), 0, 0, 0)]) {
          k.body.add(shapes.box(0.56, 0.56, 0.03, 0.05, 2), C.white, rel(p, 0, 0, 0.02), { ao: false });
          crossOn(k.body, rel(p, 0, 0, 0.04), 0.44, C.red);
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            k.bulbs.add(shapes.sphere(0.025, 6, 4), '#ff7a7a', rel(p, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.045));
          }
        }
        const top = flatRoof(s, H, C.stoneDark, { ledge: C.sky });
        // the helipad: a grey disc, a white ring, a yellow ring, lights round it
        const hx = s.W * 0.16;
        const hz = -s.D * 0.06;
        const pad = Math.min(1.05, s.D / 2 - 0.4);
        k.body.add(shapes.cyl(pad, pad, 0.04, 28), '#6b7080', { x: hx, y: top - 0.11, z: hz }, { ao: false });
        k.body.add(shapes.torus(pad - 0.12, 0.03, 28), C.white, { x: hx, y: top - 0.085, z: hz, rx: Math.PI / 2 }, { ao: false });
        k.body.add(shapes.torus(pad * 0.45, 0.03, 20), C.mustard, { x: hx, y: top - 0.085, z: hz, rx: Math.PI / 2 }, { ao: false });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          k.bulbs.add(shapes.sphere(0.03, 6, 4), '#9fe0ff', { x: hx + Math.cos(a) * (pad - 0.03), y: top - 0.07, z: hz + Math.sin(a) * (pad - 0.03) });
        }
        // the plant on the other side: two units with fans, a lift-house
        const px = -s.W * 0.33;
        for (const dz of [-0.7, 0.4]) {
          k.body.add(shapes.box(0.7, 0.32, 0.5, 0.04, 2), C.stone, { x: px, y: top + 0.0, z: dz });
          k.body.add(shapes.cyl(0.17, 0.17, 0.03, 14), C.metal, { x: px, y: top + 0.17, z: dz }, { ao: false });
        }
        k.body.add(shapes.box(0.6, 0.5, 0.6, 0.04, 2), C.white, { x: -s.W * 0.1, y: top + 0.1, z: -s.D * 0.34 });
        k.body.add(shapes.box(0.66, 0.05, 0.66, 0.02, 1), C.sky, { x: -s.W * 0.1, y: top + 0.37, z: -s.D * 0.34 }, { ao: false });
        return top + 0.42;
      }),
      (() => {
        // planters at the front corners, a bench by one
        const z = k.D / 2 - 0.17;
        for (const sd of [-1, 1]) {
          const x = sd * (k.W / 2 - 0.45);
          if (Math.abs(x - u) > 1.3) planter(k, x, z, 0.6);
        }
        const bx = u + (u > 0 ? -1.75 : 1.75);
        if (Math.abs(bx) < k.W / 2 - 0.9) {
          k.body.add(shapes.box(0.6, 0.04, 0.16, 0.015, 1), C.woodLight, { x: bx, y: 0.24, z });
          k.body.add(shapes.box(0.6, 0.12, 0.03, 0.015, 1), C.woodLight, { x: bx, y: 0.36, z: z - 0.08 });
          for (const sx of [-1, 1]) k.body.add(shapes.box(0.03, 0.22, 0.14), C.metal, { x: bx + sx * 0.24, y: 0.11, z });
        }
        return 0;
      })(),
    ),

  // Bridget's nurses' station outdoors: a small white booth with a blue cross, a hatch with a first-aid box on its
  // ledge and a lamp, a wheelchair waiting beside it
  bridget: (k) => {
    const bw = 0.38;
    const bd = 0.42;
    const bx = -k.W / 2 + bw / 2 + 0.03;
    const bz = -0.08;
    k.body.add(shapes.box(bw + 0.04, 0.08, bd + 0.04, 0.02, 1), C.sky, { x: bx, y: 0.04, z: bz });
    k.body.add(shapes.box(bw, 0.84, bd, 0.05, 2), C.white, { x: bx, y: 0.46, z: bz });
    k.body.add(shapes.box(bw + 0.02, 0.05, bd + 0.02, 0.02, 1), C.blue, { x: bx, y: 0.8, z: bz }, { ao: false });
    // the hatch, its ledge, the first-aid box
    const fz = bz + bd / 2;
    k.body.add(shapes.box(0.28, 0.22, 0.03, 0.01, 1), C.blue, { x: bx, y: 0.6, z: fz + 0.005 }, { ao: false });
    k.glass.add(shapes.box(0.24, 0.18, 0.02, 0.01, 1), C.glass, { x: bx, y: 0.6, z: fz + 0.015 });
    k.body.add(shapes.box(0.3, 0.03, 0.09, 0.01, 1), C.woodLight, { x: bx, y: 0.48, z: fz + 0.04 }, { ao: false });
    k.body.add(shapes.box(0.1, 0.07, 0.06, 0.015, 1), '#4fae6a', { x: bx - 0.07, y: 0.53, z: fz + 0.04 }, { ao: false });
    crossOn(k.body, { x: bx - 0.07, y: 0.53, z: fz + 0.072 }, 0.05, C.white, 0.006);
    // the blue crosses, on the front and on the right side
    crossOn(k.body, { x: bx, y: 0.27, z: fz + 0.01 }, 0.17, C.blue);
    crossOn(k.body, { x: bx + bw / 2 + 0.01, y: 0.56, z: bz, ry: Math.PI / 2 }, 0.17, C.blue);
    // the roof and a lamp over the hatch
    k.body.add(shapes.box(bw + 0.12, 0.05, bd + 0.14, 0.02, 1), C.blue, { x: bx, y: 0.92, z: bz + 0.02, rx: 0.12 }, { ao: false });
    k.body.add(shapes.box(0.04, 0.04, 0.06), C.metal, { x: bx + 0.1, y: 0.82, z: fz + 0.03 }, { ao: false });
    k.bulbs.add(shapes.sphere(0.03, 8, 6), C.glow, { x: bx + 0.1, y: 0.79, z: fz + 0.06 });
    // the wheelchair, side on
    const wx = k.W / 2 - 0.15;
    const wz = 0.06;
    k.body.add(shapes.box(0.17, 0.03, 0.18, 0.01, 1), C.blue, { x: wx, y: 0.27, z: wz }, { ao: false });
    k.body.add(shapes.box(0.17, 0.2, 0.03, 0.01, 1), C.blue, { x: wx, y: 0.39, z: wz - 0.09, rx: -0.12 }, { ao: false });
    for (const sx of [-1, 1]) {
      k.body.add(shapes.torus(0.12, 0.014, 14), C.metal, { x: wx + sx * 0.11, y: 0.13, z: wz - 0.02, ry: Math.PI / 2 }, { ao: false });
      k.body.add(shapes.torus(0.1, 0.008, 12), C.metal, { x: wx + sx * 0.125, y: 0.13, z: wz - 0.02, ry: Math.PI / 2 }, { ao: false });
      k.body.add(shapes.sphere(0.025, 6, 4), '#3d4150', { x: wx + sx * 0.07, y: 0.025, z: wz + 0.1 }, { ao: false });
      k.body.add(shapes.box(0.015, 0.22, 0.015), C.metal, { x: wx + sx * 0.08, y: 0.14, z: wz + 0.09 }, { ao: false });
      k.body.add(shapes.box(0.02, 0.02, 0.16), '#3d4150', { x: wx + sx * 0.09, y: 0.36, z: wz }, { ao: false });
      k.body.add(shapes.cyl(0.012, 0.012, 0.08, 5), '#3d4150', { x: wx + sx * 0.08, y: 0.5, z: wz - 0.15, rx: Math.PI / 2 }, { ao: false });
    }
    return 1.0;
  },

  // the phonetics lab: an old two-storey brick building with stone corners, tall arched windows, ivy up the back of
  // its right wall, a slate roof with a cupola and its clock, a sign of sound waves over the door
  adeyemi: (k, u) =>
    Math.max(
      setBack(k, 0.32, (s) => {
        const brick = '#b9654f';
        const cream = '#f1e4c8';
        const H = 1.92;
        walls(s, H, brick, { plinth: C.stoneDark });
        k.body.add(shapes.box(s.W + 0.06, 0.07, s.D + 0.06, 0.02, 1), cream, { y: 1.13 }, { ao: false });
        // stone corners on the two front corners and the back right one
        for (const [cx, cz] of [
          [-1, 1],
          [1, 1],
          [1, -1],
        ] as const)
          for (let i = 0; i < 8; i++) {
            const y = 0.26 + i * 0.22;
            k.body.add(shapes.box(0.12, 0.1, 0.12, 0.02, 1), cream, { x: cx * (s.W / 2 - 0.05), y, z: cz * (s.D / 2 - 0.05), s: [i % 2 ? 1.3 : 1, 1, i % 2 ? 1 : 1.3] }, { ao: false });
          }
        // the door under an arch, steps up to it
        door(s, u, { color: C.navy, glass: true, w: 0.42, h: 0.7 });
        const f = onFace(s, 'front', u, 0, 0);
        k.glass.add(halfDisc(0.2, 0.03), C.glass, rel(f, 0, 0.74, 0.04));
        k.body.add(arch(0.25, 0.04), cream, rel(f, 0, 0.74, 0.04), { ao: false });
        k.body.add(shapes.box(0.9, 0.06, 0.3, 0.02, 1), C.stone, rel(f, 0, 0.03, 0.17));
        // the sign: sound waves on navy
        const sg = signBoard(s, u, 1.32, 0.66, 0.18, C.navy, cream);
        for (let i = 0; i < 11; i++) {
          const h = 0.03 + Math.abs(Math.sin(i * 0.9)) * 0.1 * (1 - Math.abs(i - 5) / 7);
          k.body.add(shapes.box(0.025, h, 0.012), C.mustard, rel(sg, -0.25 + i * 0.05, 0, 0.005), { ao: false });
        }
        // tall arched windows, both floors
        for (const sd of [-1, 1])
          for (let i = 0; i < 3; i++) {
            const at = u + sd * (0.62 + i * 0.52);
            if (Math.abs(at) > s.W / 2 - 0.28) continue;
            archWindow(s, 'front', at, 0.55, 0.26, 0.5, cream);
            archWindow(s, 'front', at, 1.46, 0.26, 0.38, cream);
          }
        for (const at of [-1.0, -0.36]) {
          archWindow(s, 'right', at, 0.55, 0.26, 0.5, cream);
          archWindow(s, 'right', at, 1.46, 0.26, 0.38, cream);
        }
        for (const at of [-0.8, 0, 0.8]) {
          archWindow(s, 'left', at, 0.55, 0.26, 0.5, cream);
          archWindow(s, 'left', at, 1.46, 0.26, 0.38, cream);
        }
        // ivy up the back half of the right wall
        const r = onFace(s, 'right', 0, 0, 0);
        for (let i = 0; i < 46; i++) {
          const along = 0.2 + hash(i * 5 + 1) * (s.D / 2 - 0.3);
          const up = Math.pow(hash(i * 11 + 3), 0.8) * (H - 0.15) + 0.08;
          if (up > 1.1 + (along - 0.2) * 0.8) continue;
          const sz = 0.07 + hash(i * 13) * 0.06;
          k.body.add(shapes.sphere(sz, 6, 5), i % 3 ? C.leafDeep : C.leaf, rel(r, along, up, 0.03, { s: [1, 1, 0.45] }), { ao: false });
        }
        const top = gableRoof(s, H, 0.6, '#6d7b98', { wall: brick });
        // the cupola on the ridge: a stone base with the clock, posts, a copper dome
        const cy = H + 0.5;
        k.body.add(shapes.box(0.5, 0.42, 0.5, 0.03, 2), cream, { y: cy + 0.21 });
        k.body.add(shapes.cyl(0.15, 0.15, 0.03, 20), C.white, { y: cy + 0.23, z: 0.26, rx: Math.PI / 2 }, { ao: false });
        k.body.add(shapes.torus(0.15, 0.018, 20), C.navy, { y: cy + 0.23, z: 0.27 }, { ao: false });
        k.body.add(shapes.box(0.02, 0.1, 0.01), C.navy, { x: 0.02, y: cy + 0.26, z: 0.285, rz: -0.4 }, { ao: false });
        k.body.add(shapes.box(0.02, 0.07, 0.01), C.navy, { x: 0.025, y: cy + 0.22, z: 0.285, rz: -2.0 }, { ao: false });
        k.body.add(shapes.box(0.56, 0.05, 0.56, 0.02, 1), cream, { y: cy + 0.44 }, { ao: false });
        for (const [dx, dz] of [
          [-0.2, -0.2],
          [0.2, -0.2],
          [-0.2, 0.2],
          [0.2, 0.2],
        ])
          k.body.add(shapes.box(0.05, 0.24, 0.05, 0.015, 1), cream, { x: dx, y: cy + 0.58, z: dz }, { ao: false });
        k.bulbs.add(shapes.sphere(0.06, 8, 6), C.glow, { y: cy + 0.56 });
        k.body.add(shapes.dome(0.27, 14, 6), '#7cc2a8', { y: cy + 0.7 }, { ao: false });
        k.body.add(shapes.cyl(0.012, 0.012, 0.2, 4), C.metal, { y: cy + 1.04 }, { ao: false });
        k.body.add(shapes.sphere(0.035, 6, 4), C.mustard, { y: cy + 1.15 }, { ao: false });
        return Math.max(top, cy + 1.18);
      }),
      0,
    ),

  // the library: pale stone with a copper-green roof, a portico of four columns on steps with a pediment and its round
  // window, lamps by the door, the book-return box on the steps' side
  finch: (k, u) =>
    Math.max(
      setBack(k, 0.6, (s) => {
        const stone = '#efe6d4';
        walls(s, 1.5, stone, { plinth: C.stoneDark });
        door(s, u, { color: C.woodDark, glass: true, w: 0.42, h: 0.74 });
        const f = onFace(s, 'front', u, 0, 0);
        for (const sd of [-1, 1]) {
          k.body.add(shapes.box(0.05, 0.05, 0.08), C.metal, rel(f, sd * 0.36, 0.72, 0.05), { ao: false });
          k.bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, rel(f, sd * 0.36, 0.68, 0.1));
        }
        for (const face of ['left', 'right'] as const)
          for (const at of [-0.6, 0.6]) archWindow(s, face, at, 0.66, 0.28, 0.62, C.trim);
        for (const sd of [-1, 1]) {
          const at = u + sd * 0.95;
          if (Math.abs(at) < s.W / 2 - 0.2) windowOn(s, 'front', at, 0.66, { w: 0.24, h: 0.6, frame: C.trim });
        }
        return gableRoof(s, 1.5, 0.52, '#7cc2a8', { ridge: 'z', wall: stone, cap: '#5fa98f' });
      }),
      (() => {
        // the portico in the front strip: a platform of steps, four columns, the entablature and the pediment
        const front = k.D / 2 - 0.6;
        const depth = 0.56;
        const zc = front + depth / 2;
        const pw = Math.min(2.0, k.W - 0.5);
        const px = Math.max(-k.W / 2 + pw / 2 + 0.04, Math.min(k.W / 2 - pw / 2 - 0.04, u));
        k.body.add(shapes.box(pw + 0.08, 0.08, depth, 0.02, 1), C.stone, { x: px, y: 0.04, z: zc });
        k.body.add(shapes.box(0.7, 0.05, 0.14, 0.02, 1), C.stone, { x: u, y: 0.025, z: k.D / 2 - 0.04 });
        const cz = k.D / 2 - 0.14;
        for (const c of [-0.5, -0.17, 0.17, 0.5]) {
          const x = px + c * (pw - 0.2);
          k.body.add(shapes.box(0.16, 0.06, 0.16, 0.02, 1), C.trim, { x, y: 0.11, z: cz }, { ao: false });
          k.body.add(shapes.cyl(0.06, 0.07, 1.26, 10), C.trim, { x, y: 0.77, z: cz });
          k.body.add(shapes.box(0.16, 0.06, 0.16, 0.02, 1), C.trim, { x, y: 1.42, z: cz }, { ao: false });
        }
        k.body.add(shapes.box(pw + 0.1, 0.14, depth + 0.04, 0.03, 1), '#efe6d4', { x: px, y: 1.52, z: zc + 0.02 }, { ao: false });
        k.body.add(pediment(pw + 0.16, 0.42, depth + 0.06), '#7cc2a8', { x: px, y: 1.59, z: zc + 0.02 }, { ao: false });
        k.body.add(pediment(pw - 0.12, 0.3, 0.04), '#efe6d4', { x: px, y: 1.62, z: zc + depth / 2 + 0.04 }, { ao: false });
        k.body.add(shapes.torus(0.075, 0.018, 14), C.trim, { x: px, y: 1.73, z: zc + depth / 2 + 0.065 }, { ao: false });
        k.glass.add(shapes.cyl(0.065, 0.065, 0.02, 14), C.glass, { x: px, y: 1.73, z: zc + depth / 2 + 0.06, rx: Math.PI / 2 });
        // the book-return box beside the portico, on the wider side
        const right = k.W / 2 - (px + pw / 2);
        const left = px - pw / 2 + k.W / 2;
        const room = Math.max(right, left);
        const bx = right >= left ? k.W / 2 - room / 2 : -k.W / 2 + room / 2;
        if (room > 0.26) {
          const bz = k.D / 2 - 0.16;
          k.body.add(shapes.box(0.2, 0.34, 0.18, 0.03, 2), C.navy, { x: bx, y: 0.17, z: bz });
          k.body.add(shapes.dome(0.1, 12, 5), C.navy, { x: bx, y: 0.34, z: bz, s: [1, 0.6, 0.9] }, { ao: false });
          k.body.add(shapes.box(0.12, 0.025, 0.01), '#2b2f3a', { x: bx, y: 0.28, z: bz + 0.092 }, { ao: false });
          k.body.add(shapes.box(0.07, 0.05, 0.01), C.mustard, { x: bx, y: 0.17, z: bz + 0.092 }, { ao: false });
        }
        return 2.05;
      })(),
    ),

  // Yuki's study table outdoors: a picnic table, a stack of books, an open laptop with its screen lit, a cup of tea and
  // her bicycle leaning on the end of it
  yuki: (k) => {
    const tw = Math.min(0.5, k.W - 0.16);
    const tx = -0.05;
    k.body.add(shapes.box(tw, 0.04, 0.3, 0.015, 1), C.woodLight, { x: tx, y: 0.42 });
    for (const sz of [-1, 1]) {
      k.body.add(shapes.box(tw, 0.035, 0.09, 0.012, 1), C.woodLight, { x: tx, y: 0.25, z: sz * 0.24 });
      for (const sx of [-1, 1]) k.body.add(shapes.box(0.03, 0.46, 0.03), C.wood, { x: tx + sx * (tw / 2 - 0.05), y: 0.21, z: sz * 0.1, rx: sz * 0.45 }, { ao: false });
    }
    k.body.add(shapes.box(0.03, 0.03, 0.56), C.wood, { x: tx - tw / 2 + 0.05, y: 0.2 }, { ao: false });
    k.body.add(shapes.box(0.03, 0.03, 0.56), C.wood, { x: tx + tw / 2 - 0.05, y: 0.2 }, { ao: false });
    // books
    for (let i = 0; i < 3; i++) k.body.add(shapes.box(0.13, 0.03, 0.09, 0.008, 1), [C.coral, C.sky, C.mustard][i], { x: tx - 0.15, y: 0.455 + i * 0.03, z: -0.06, ry: 0.15 * (i - 1) }, { ao: false });
    k.body.add(shapes.box(0.12, 0.01, 0.09, 0.004, 1), C.white, { x: tx - 0.12, y: 0.445, z: 0.08, ry: -0.3 }, { ao: false });
    // the laptop, its screen lit
    k.body.add(shapes.box(0.15, 0.012, 0.1, 0.004, 1), '#c9ced6', { x: tx + 0.06, y: 0.447, z: 0.02 }, { ao: false });
    k.body.add(shapes.box(0.15, 0.1, 0.01, 0.004, 1), '#c9ced6', { x: tx + 0.06, y: 0.5, z: -0.035, rx: -0.25 }, { ao: false });
    k.bulbs.add(shapes.box(0.13, 0.08, 0.004), '#cfe9ff', { x: tx + 0.06, y: 0.5, z: -0.028, rx: -0.25 });
    k.body.add(shapes.cyl(0.025, 0.02, 0.05, 8), C.white, { x: tx + 0.18, y: 0.465, z: 0.07 }, { ao: false });
    // the bicycle leaning on the table's end
    const bx = k.W / 2 - 0.06;
    const lean = 0.12;
    const bk = (y: number, z: number, extra: Place = {}) => ({ x: bx - y * Math.sin(lean), y, z, rz: lean, ...extra });
    for (const sz of [-1, 1]) {
      k.body.add(shapes.torus(0.12, 0.012, 14), '#3d4150', { ...bk(0.13, sz * 0.18), ry: Math.PI / 2 }, { ao: false });
      k.body.add(shapes.cyl(0.012, 0.012, 0.03, 5), C.metal, { ...bk(0.13, sz * 0.18), rz: Math.PI / 2 }, { ao: false });
    }
    k.body.add(shapes.cyl(0.012, 0.012, 0.3, 5), C.rose, bk(0.26, 0.0, { rx: Math.PI / 2 }), { ao: false });
    k.body.add(shapes.cyl(0.012, 0.012, 0.24, 5), C.rose, bk(0.2, -0.08, { rx: 0.75 }), { ao: false });
    k.body.add(shapes.cyl(0.012, 0.012, 0.24, 5), C.rose, bk(0.2, 0.09, { rx: -0.6 }), { ao: false });
    k.body.add(shapes.box(0.04, 0.02, 0.08, 0.01, 1), '#3d4150', bk(0.34, -0.08), { ao: false });
    k.body.add(shapes.cyl(0.01, 0.01, 0.16, 5), C.metal, bk(0.36, 0.14, { rz: Math.PI / 2 + lean }), { ao: false });
    k.body.add(shapes.box(0.1, 0.06, 0.07, 0.015, 1), C.woodLight, bk(0.3, 0.17), { ao: false });
    return 0.6;
  },

  // Nell's pharmacy: white walls, a mint-and-white awning, bottles on the window's sill, a teal roof, a lit green cross
  // on a blade sign at the corner; the old weighing scale outside
  nell: (k, u) =>
    Math.max(
      setBack(k, 0.28, (s) => {
        walls(s, 1.06, C.white, { plinth: C.teal });
        door(s, u, { color: C.teal, glass: true });
        const b = besideDoor(s, u);
        const ww = Math.min(0.66, b.room - 0.12);
        if (ww > 0.3) {
          shopWindow(s, b.at, 0.56, ww, 0.4, C.teal);
          const f = onFace(s, 'front', b.at, 0, 0);
          const bottles = [C.mint, '#b9e3f2', C.coral, '#e0a040', C.lilac];
          const n = Math.floor((ww - 0.06) / 0.09);
          for (let i = 0; i < n; i++) {
            const x = -ww / 2 + 0.07 + i * 0.09;
            const h = 0.1 + (i % 3) * 0.03;
            k.body.add(shapes.cyl(0.03, 0.03, h, 8), bottles[i % bottles.length], rel(f, x, 0.36 + h / 2 + 0.02, 0.1), { ao: false });
            k.body.add(shapes.cyl(0.018, 0.018, 0.03, 6), C.white, rel(f, x, 0.36 + h + 0.035, 0.1), { ao: false });
          }
        }
        awning(s, 0, 0.98, s.W - 0.06, C.mint, C.white, 0.3);
        windowOn(s, 'right', 0, 0.6, { shutters: C.mint, flowers: true });
        windowOn(s, 'left', 0, 0.6, { shutters: C.mint });
        const top = hipRoof(s, 1.06, 0.42, C.teal);
        // the blade sign at the corner away from the door: a lit green cross both ways
        const cx = (b.at > u ? 1 : -1) * (s.W / 2 - 0.04);
        const cz = s.D / 2 + 0.02;
        k.body.add(shapes.box(0.03, 0.03, 0.26), C.metal, { x: cx, y: 1.3, z: cz + 0.1 }, { ao: false });
        k.body.add(shapes.box(0.06, 0.34, 0.34, 0.03, 2), C.white, { x: cx, y: 1.3, z: cz + 0.26 }, { ao: false });
        crossOn(k.body, { x: cx, y: 1.3, z: cz + 0.26, ry: Math.PI / 2 }, 0.27, '#3fbf6a', 0.08);
        for (const [dy, dz] of [
          [0.15, 0],
          [-0.15, 0],
          [0, 0.15],
          [0, -0.15],
        ])
          k.bulbs.add(shapes.sphere(0.022, 6, 4), C.glow, { x: cx, y: 1.3 + dy, z: cz + 0.26 + dz });
        return top;
      }),
      (() => {
        // the weighing scale outside, on the side away from the window
        const b = besideDoor(k, u);
        const x = b.at > u ? u - 0.42 : u + 0.42;
        const z = k.D / 2 - 0.14;
        if (Math.abs(x) < k.W / 2 - 0.12) {
          k.body.add(shapes.box(0.2, 0.05, 0.2, 0.02, 1), C.white, { x, y: 0.025, z });
          k.body.add(shapes.box(0.16, 0.012, 0.16, 0.005, 1), '#3d4150', { x, y: 0.055, z }, { ao: false });
          k.body.add(shapes.cyl(0.03, 0.035, 0.48, 8), C.mint, { x, y: 0.3, z: z - 0.08 });
          k.body.add(shapes.cyl(0.09, 0.09, 0.04, 16), C.mint, { x, y: 0.6, z: z - 0.07, rx: Math.PI / 2 }, { ao: false });
          k.body.add(shapes.cyl(0.07, 0.07, 0.02, 16), C.white, { x, y: 0.6, z: z - 0.045, rx: Math.PI / 2 }, { ao: false });
          k.body.add(shapes.box(0.01, 0.06, 0.006), C.red, { x: x + 0.01, y: 0.62, z: z - 0.033, rz: -0.5 }, { ao: false });
        }
        return 0;
      })(),
    ),

  // ───────────────────────── the harbour ─────────────────────────

  // Jun's repair stall: an open-fronted market unit with a corrugated roof, shelves of radios and phones on its back
  // wall, a workbench with a lamp and a phone in pieces, strings of bulbs, a hand-truck with a box
  jun: (k) => {
    const wall = '#8fa7bb';
    const H = 1.28;
    k.body.add(shapes.box(k.W, 0.05, k.D, 0.015, 1), C.stone, { y: 0.025 });
    k.body.add(shapes.box(k.W, H, 0.08, 0.03, 2), wall, { y: H / 2, z: -k.D / 2 + 0.04 });
    k.body.add(shapes.box(k.W - 0.16, H - 0.1, 0.02), '#efe6d2', { y: H / 2, z: -k.D / 2 + 0.09 }, { ao: false });
    for (const sx of [-1, 1]) {
      k.body.add(shapes.box(0.08, H, k.D, 0.03, 2), wall, { x: sx * (k.W / 2 - 0.04), y: H / 2 });
      k.body.add(wedge(0.08, k.D, 0.2), wall, { x: sx * (k.W / 2 - 0.04), y: H - 0.01 }, { ao: false });
      k.body.add(shapes.box(0.02, H - 0.1, k.D - 0.2), '#efe6d2', { x: sx * (k.W / 2 - 0.09), y: H / 2 }, { ao: false });
    }
    // the corrugated roof: a lean-to, high over the open front
    const z0 = -k.D / 2 - 0.06;
    const z1 = k.D / 2 + 0.24;
    const y0 = H - 0.0;
    const y1 = H + 0.2;
    const len = Math.hypot(z1 - z0, y0 - y1);
    const a = Math.atan2(y0 - y1, z1 - z0);
    const rc = { y: (y0 + y1) / 2 + 0.02, z: (z0 + z1) / 2 };
    k.body.add(shapes.box(k.W + 0.12, 0.04, len, 0.015, 1), '#b8c2cc', { ...rc, rx: a }, { ao: false });
    const nr = Math.round((k.W + 0.1) / 0.11);
    for (let i = 0; i < nr; i++) k.body.add(shapes.cyl(0.02, 0.02, len, 5), '#c9d2db', { x: -(k.W + 0.1) / 2 + 0.055 + i * 0.11, y: rc.y + 0.03, z: rc.z, rx: Math.PI / 2 + a }, { ao: false });
    // the fascia under the roof's front: a phone and a lightning bolt
    const fz = k.D / 2 - 0.02;
    k.body.add(shapes.box(k.W - 0.1, 0.2, 0.05, 0.02, 1), C.navy, { y: H + 0.04, z: fz });
    k.body.add(shapes.box(0.08, 0.13, 0.02, 0.015, 1), C.white, { x: -0.25, y: H + 0.04, z: fz + 0.03 }, { ao: false });
    k.bulbs.add(shapes.box(0.06, 0.09, 0.01), '#8fe3ff', { x: -0.25, y: H + 0.045, z: fz + 0.042 });
    k.body.add(shapes.box(0.03, 0.1, 0.02), C.mustard, { x: 0.22, y: H + 0.07, z: fz + 0.03, rz: -0.5 }, { ao: false });
    k.body.add(shapes.box(0.03, 0.1, 0.02), C.mustard, { x: 0.25, y: H + 0.0, z: fz + 0.03, rz: -0.5 }, { ao: false });
    k.body.add(shapes.box(0.06, 0.025, 0.02), C.mustard, { x: 0.235, y: H + 0.045, z: fz + 0.03 }, { ao: false });
    // the shelves of radios and phones on the back wall
    const bz = -k.D / 2 + 0.16;
    const things = [C.coral, C.teal, C.mustard, C.sky, C.rose, C.mint];
    for (let r = 0; r < 3; r++) {
      const y = 0.42 + r * 0.27;
      k.body.add(shapes.box(k.W - 0.24, 0.03, 0.18, 0.01, 1), C.woodLight, { y, z: bz }, { ao: false });
      const n = Math.floor((k.W - 0.36) / 0.22);
      for (let i = 0; i < n; i++) {
        const x = -(n - 1) * 0.11 + i * 0.22;
        const c = things[(i + r * 2) % things.length];
        if ((i + r) % 2 === 0) {
          // a radio: a box, its speaker, a dial, an aerial
          k.body.add(shapes.box(0.17, 0.11, 0.08, 0.02, 1), c, { x, y: y + 0.07, z: bz }, { ao: false });
          k.body.add(shapes.cyl(0.03, 0.03, 0.01, 10), '#3d4150', { x: x - 0.04, y: y + 0.07, z: bz + 0.045, rx: Math.PI / 2 }, { ao: false });
          k.body.add(shapes.box(0.05, 0.02, 0.01), C.cream, { x: x + 0.04, y: y + 0.08, z: bz + 0.045 }, { ao: false });
          k.body.add(shapes.cyl(0.004, 0.004, 0.14, 3), C.metal, { x: x + 0.06, y: y + 0.18, z: bz, rz: -0.4 }, { ao: false });
        } else {
          // two phones standing up
          for (const dx of [-0.04, 0.04]) {
            k.body.add(shapes.box(0.05, 0.1, 0.012, 0.01, 1), '#2b2f3a', { x: x + dx, y: y + 0.065, z: bz + 0.02, rx: -0.15 }, { ao: false });
            k.bulbs.add(shapes.box(0.04, 0.08, 0.004), dx < 0 ? '#bfe8ff' : c, { x: x + dx, y: y + 0.066, z: bz + 0.028, rx: -0.15 });
          }
        }
      }
    }
    // the workbench, a phone in pieces, a screwdriver, the lamp
    const wz = 0.16;
    const ww = k.W - 0.7;
    k.body.add(shapes.box(ww, 0.05, 0.38, 0.015, 1), C.woodLight, { y: 0.47, z: wz });
    for (const sx of [-1, 1]) k.body.add(shapes.box(0.05, 0.45, 0.32), C.woodDark, { x: sx * (ww / 2 - 0.05), y: 0.225, z: wz });
    k.body.add(shapes.box(ww - 0.06, 0.02, 0.3), '#4f8a72', { y: 0.5, z: wz }, { ao: false });
    k.body.add(shapes.box(0.07, 0.012, 0.13, 0.006, 1), '#2b2f3a', { x: -0.1, y: 0.515, z: wz + 0.02, ry: 0.3 }, { ao: false });
    k.body.add(shapes.box(0.06, 0.008, 0.11), C.sky, { x: 0.0, y: 0.513, z: wz + 0.04, ry: -0.2 }, { ao: false });
    k.body.add(shapes.box(0.04, 0.01, 0.03), C.mustard, { x: 0.06, y: 0.513, z: wz - 0.04 }, { ao: false });
    k.body.add(shapes.cyl(0.008, 0.008, 0.12, 4), C.red, { x: -0.22, y: 0.52, z: wz + 0.06, rz: Math.PI / 2, ry: 0.4 }, { ao: false });
    const lx = ww / 2 - 0.15;
    k.body.add(shapes.cyl(0.05, 0.06, 0.02, 10), '#3d4150', { x: lx, y: 0.52, z: wz - 0.08 }, { ao: false });
    k.body.add(shapes.cyl(0.01, 0.01, 0.26, 4), '#3d4150', { x: lx - 0.04, y: 0.64, z: wz - 0.08, rz: 0.3 }, { ao: false });
    k.body.add(shapes.cyl(0.01, 0.01, 0.2, 4), '#3d4150', { x: lx - 0.14, y: 0.78, z: wz - 0.08, rz: -1.1 }, { ao: false });
    k.body.add(shapes.cone(0.06, 0.09, 10), C.mustard, { x: lx - 0.23, y: 0.78, z: wz - 0.08, rz: 0.4 }, { ao: false });
    k.bulbs.add(shapes.sphere(0.03, 6, 4), C.glow, { x: lx - 0.24, y: 0.74, z: wz - 0.08 });
    // his stool behind the bench
    k.body.add(shapes.cyl(0.09, 0.09, 0.04, 12), C.coral, { x: 0.1, y: 0.36, z: -0.2 }, { ao: false });
    k.body.add(shapes.cyl(0.02, 0.03, 0.34, 6), C.metal, { x: 0.1, y: 0.17, z: -0.2 }, { ao: false });
    // the strings of bulbs along the roof's front
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const x = -k.W / 2 + 0.1 + t * (k.W - 0.2);
      k.bulbs.add(shapes.sphere(0.028, 6, 4), i % 2 ? C.glow : '#ffe3a0', { x, y: H - 0.05 - Math.sin(t * Math.PI * 2) ** 2 * 0.06, z: k.D / 2 + 0.12 });
    }
    // the hand-truck in the front corner with a box on it
    const hx = k.W / 2 - 0.24;
    const hz = k.D / 2 - 0.14;
    for (const sx of [-1, 1]) k.body.add(shapes.cyl(0.012, 0.012, 0.7, 5), C.red, { x: hx + sx * 0.08, y: 0.36, z: hz - 0.06, rx: -0.2 }, { ao: false });
    k.body.add(shapes.box(0.2, 0.015, 0.1), C.metal, { x: hx, y: 0.02, z: hz + 0.0 }, { ao: false });
    k.body.add(shapes.cyl(0.012, 0.012, 0.2, 5), C.red, { x: hx, y: 0.7, z: hz - 0.13, rz: Math.PI / 2 }, { ao: false });
    for (const sx of [-1, 1]) k.body.add(shapes.cyl(0.05, 0.05, 0.03, 10), '#3d4150', { x: hx + sx * 0.11, y: 0.05, z: hz - 0.05, rz: Math.PI / 2 }, { ao: false });
    k.body.add(shapes.box(0.18, 0.18, 0.14, 0.015, 1), '#d9b48a', { x: hx, y: 0.12, z: hz - 0.02 });
    k.body.add(shapes.box(0.185, 0.02, 0.03), '#c49b6d', { x: hx, y: 0.21, z: hz - 0.02 }, { ao: false });
    // on the right wall outside: a big battery, three green bars
    const rw = onFace(k, 'right', 0.1, 0.7, 0);
    k.body.add(shapes.box(0.5, 0.26, 0.03, 0.04, 2), C.white, rel(rw, 0, 0, 0.02), { ao: false });
    k.body.add(shapes.box(0.04, 0.1, 0.03, 0.01, 1), C.white, rel(rw, 0.27, 0, 0.02), { ao: false });
    for (let i = 0; i < 3; i++) k.body.add(shapes.box(0.11, 0.18, 0.02, 0.01, 1), C.leafDeep, rel(rw, -0.16 + i * 0.14, 0, 0.04), { ao: false });
    return H + 0.22;
  },

  // Bay FM's open-air stage: a wooden stage under a truss with a navy canopy, a banner of radio waves, spotlights lit
  // on the front beam, speaker stacks either side, a microphone on its stand, the mixing desk on the ground in front
  marcus: (k, u) => {
    const sd = k.D - 0.52;
    const sz = -k.D / 2 + sd / 2;
    const deck = 0.38;
    k.body.add(shapes.box(k.W, deck, sd, 0.03, 2), C.woodDark, { y: deck / 2, z: sz });
    k.body.add(shapes.box(k.W - 0.04, 0.03, sd - 0.04, 0.01, 1), C.woodLight, { y: deck + 0.005, z: sz }, { ao: false });
    k.body.add(shapes.box(k.W - 0.08, deck - 0.1, 0.02, 0.01, 1), C.navy, { y: deck / 2, z: sz + sd / 2 + 0.005 }, { ao: false });
    for (let i = 0; i < 7; i++) k.body.add(shapes.sphere(0.025, 6, 4), C.mustard, { x: -k.W / 2 + 0.3 + (i * (k.W - 0.6)) / 6, y: deck / 2, z: sz + sd / 2 + 0.02, s: [1, 1, 0.4] }, { ao: false });
    // steps up at the door's side
    const fx = Math.max(-k.W / 2 + 0.4, Math.min(k.W / 2 - 0.4, u));
    k.body.add(shapes.box(0.6, 0.13, 0.22, 0.02, 1), C.woodLight, { x: fx, y: 0.065, z: sz + sd / 2 + 0.11 });
    k.body.add(shapes.box(0.6, 0.12, 0.12, 0.02, 1), C.woodLight, { x: fx, y: 0.19, z: sz + sd / 2 + 0.06 });
    // the backdrop: navy with stars
    const bz = -k.D / 2 + 0.06;
    k.body.add(shapes.box(k.W - 0.24, 1.5, 0.04, 0.02, 1), C.blue, { y: deck + 0.75, z: bz });
    for (let i = 0; i < 9; i++) k.bulbs.add(shapes.sphere(0.022, 6, 4), '#fff3c8', { x: -k.W / 2 + 0.3 + hash(i) * (k.W - 0.6), y: deck + 0.5 + hash(i + 20) * 0.9, z: bz + 0.03 });
    // the truss: four towers, beams round the top
    const TH = 2.2;
    const tower = (x: number, z: number) => {
      for (const [dx, dz] of [
        [-0.05, -0.05],
        [0.05, -0.05],
        [-0.05, 0.05],
        [0.05, 0.05],
      ])
        k.body.add(shapes.cyl(0.012, 0.012, TH - deck, 4), C.metal, { x: x + dx, y: deck + (TH - deck) / 2, z: z + dz }, { ao: false });
      for (let j = 0; j < 6; j++) k.body.add(shapes.box(0.1, 0.012, 0.012), C.metal, { x, y: deck + 0.15 + j * 0.3, z: z + 0.05, rz: j % 2 ? 0.8 : -0.8, s: [1.4, 1, 1] }, { ao: false });
    };
    const tx = k.W / 2 - 0.08;
    const tz0 = sz - sd / 2 + 0.12;
    const tz1 = sz + sd / 2 - 0.08;
    for (const sx of [-1, 1]) {
      tower(sx * tx, tz0);
      tower(sx * tx, tz1);
    }
    const beam = (len: number, p: Place) => {
      k.body.add(shapes.box(len, 0.1, 0.1, 0.01, 1), '#8d96a3', p, { ao: false });
    };
    beam(k.W - 0.06, { y: TH, z: tz1 });
    beam(k.W - 0.06, { y: TH, z: tz0 });
    for (const sx of [-1, 1]) beam(tz1 - tz0, { x: sx * tx, y: TH, z: (tz0 + tz1) / 2, ry: Math.PI / 2 });
    // the canopy over the truss
    k.body.add(shapes.box(k.W + 0.12, 0.05, sd + 0.1, 0.02, 1), C.navy, { y: TH + 0.08, z: sz }, { ao: false });
    k.body.add(pyramid(), C.navy, { y: TH + 0.25, z: sz, s: [k.W + 0.1, 0.32, sd + 0.08] }, { ao: false });
    for (let i = 0; i < 9; i++) {
      const w = k.W + 0.12;
      k.body.add(shapes.sphere(w / 18, 8, 5), i % 2 ? C.mustard : C.navy, { x: -w / 2 + (w / 9) * (i + 0.5), y: TH + 0.04, z: sz + sd / 2 + 0.05, s: [1, 0.55, 0.4] }, { ao: false });
    }
    // the banner hanging from the front beam: radio waves either side of a red dot
    const bn = { x: 0, y: TH - 0.27, z: tz1 + 0.07 };
    k.body.add(shapes.box(1.5, 0.34, 0.03, 0.02, 1), C.white, bn, { ao: false });
    k.body.add(shapes.box(1.42, 0.27, 0.03, 0.02, 1), C.blue, { ...bn, z: bn.z + 0.008 }, { ao: false });
    k.body.add(shapes.sphere(0.045, 8, 6), C.red, { ...bn, z: bn.z + 0.03 }, { ao: false });
    for (const r of [0.09, 0.15]) {
      k.body.add(waveArc(r), C.white, { ...bn, z: bn.z + 0.03, rz: -Math.PI / 4 }, { ao: false });
      k.body.add(waveArc(r), C.white, { ...bn, z: bn.z + 0.03, rz: (Math.PI * 3) / 4 }, { ao: false });
    }
    for (const sd2 of [-1, 1]) k.body.add(shapes.box(0.36, 0.05, 0.02), C.mustard, { x: sd2 * 0.48, y: bn.y, z: bn.z + 0.025 }, { ao: false });
    // spotlights on the front beam, lit
    for (const x of [-k.W * 0.36, -k.W * 0.18, k.W * 0.18, k.W * 0.36]) {
      k.body.add(shapes.box(0.03, 0.08, 0.03), '#3d4150', { x, y: TH - 0.09, z: tz1 }, { ao: false });
      k.body.add(shapes.cyl(0.05, 0.065, 0.13, 10), '#3d4150', { x, y: TH - 0.16, z: tz1 - 0.03, rx: 0.7 }, { ao: false });
      k.bulbs.add(shapes.cyl(0.055, 0.055, 0.02, 10), x < 0 ? '#ffe3a0' : '#ffc0e0', { x, y: TH - 0.2, z: tz1 - 0.08, rx: 0.7 });
    }
    // speaker stacks at the front corners of the stage
    for (const sx of [-1, 1]) {
      const x = sx * (k.W / 2 - 0.36);
      const z = tz1 - 0.12;
      k.body.add(shapes.box(0.34, 0.42, 0.28, 0.03, 2), '#3d4150', { x, y: deck + 0.21, z });
      k.body.add(shapes.box(0.3, 0.26, 0.26, 0.03, 2), '#3d4150', { x, y: deck + 0.55, z });
      k.body.add(shapes.cyl(0.11, 0.11, 0.02, 14), C.metal, { x, y: deck + 0.2, z: z + 0.14, rx: Math.PI / 2 }, { ao: false });
      k.body.add(shapes.cyl(0.05, 0.05, 0.02, 12), C.metal, { x, y: deck + 0.56, z: z + 0.13, rx: Math.PI / 2 }, { ao: false });
    }
    // the microphone on its stand, front and middle
    const mz = tz1 - 0.06;
    k.body.add(shapes.cyl(0.07, 0.08, 0.02, 12), '#3d4150', { y: deck + 0.01, z: mz }, { ao: false });
    k.body.add(shapes.cyl(0.01, 0.01, 0.6, 5), C.metal, { y: deck + 0.3, z: mz }, { ao: false });
    k.body.add(shapes.cyl(0.008, 0.008, 0.14, 4), C.metal, { y: deck + 0.62, z: mz + 0.05, rx: 0.9 }, { ao: false });
    k.body.add(shapes.sphere(0.035, 8, 6), '#9aa3b0', { y: deck + 0.66, z: mz + 0.11, s: [1, 1.2, 1] }, { ao: false });
    // the mixing desk on the ground in front, on the side away from the steps
    const dx = fx > 0 ? Math.max(-k.W / 2 + 0.36, fx - 1.2) : Math.min(k.W / 2 - 0.36, fx + 1.2);
    const dz = k.D / 2 - 0.2;
    k.body.add(shapes.box(0.56, 0.06, 0.28, 0.02, 1), '#3d4150', { x: dx, y: 0.5, z: dz, rx: 0.2 }, { ao: false });
    for (const sx of [-1, 1]) k.body.add(shapes.box(0.04, 0.48, 0.24), C.metal, { x: dx + sx * 0.24, y: 0.24, z: dz });
    for (let i = 0; i < 6; i++) {
      k.body.add(shapes.box(0.02, 0.012, 0.08), C.white, { x: dx - 0.2 + i * 0.08, y: 0.535, z: dz + 0.04, rx: 0.2 }, { ao: false });
      k.bulbs.add(shapes.sphere(0.012, 4, 3), [C.red, '#7dff9a', C.glow][i % 3], { x: dx - 0.2 + i * 0.08, y: 0.55, z: dz - 0.07 });
    }
    return TH + 0.42;
  },

  // Fay's big wheel: a pastel Ferris wheel on two white A-frames, eight cabins of eight colours, bulbs round its rim,
  // a little ticket hut at the front
  fay: (k) => {
    const R = Math.min(1.95, k.D / 2 + 0.12);
    const c = R + 0.55;
    const rimX = 0.17;
    // the base
    k.body.add(shapes.box(1.1, 0.1, Math.min(k.D - 0.1, 2.7), 0.03, 1), C.stone, { y: 0.05 });
    // the A-frames: two legs a side meeting at the hub, a cross bar
    const foot = Math.min(1.15, k.D / 2 - 0.15);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const dx = 0.42 - 0.3;
        const L = Math.hypot(foot, c, dx);
        k.body.add(shapes.cyl(0.035, 0.05, L, 8), C.white, { x: sx * 0.36, y: c / 2, z: sz * foot / 2, rx: -sz * Math.atan2(foot, c), rz: sx * Math.atan2(dx, c) }, { ao: false });
      }
      k.body.add(shapes.box(0.05, 0.05, foot * 1.05), C.white, { x: sx * 0.37, y: c * 0.42, z: 0 }, { ao: false });
      k.body.add(shapes.box(0.16, 0.06, 0.2, 0.02, 1), C.stoneDark, { x: sx * 0.42, y: 0.12, z: -foot }, { ao: false });
      k.body.add(shapes.box(0.16, 0.06, 0.2, 0.02, 1), C.stoneDark, { x: sx * 0.42, y: 0.12, z: foot }, { ao: false });
    }
    // the axle and the hub
    k.body.add(shapes.cyl(0.05, 0.05, 0.86, 10), C.metal, { y: c, rz: Math.PI / 2 }, { ao: false });
    k.body.add(shapes.cyl(0.17, 0.17, 0.4, 14), C.mustard, { y: c, rz: Math.PI / 2 }, { ao: false });
    // two rims, an inner ring, spokes
    for (const sx of [-1, 1]) {
      k.body.add(shapes.torus(R, 0.045, 48), C.white, { x: sx * rimX, y: c, ry: Math.PI / 2 }, { ao: false });
      k.body.add(shapes.torus(R * 0.5, 0.025, 28), C.pink, { x: sx * rimX, y: c, ry: Math.PI / 2 }, { ao: false });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        k.body.add(shapes.box(0.03, R, 0.03), C.trim, { x: sx * rimX, y: c + (Math.sin(a) * R) / 2, z: (Math.cos(a) * R) / 2, rx: Math.PI / 2 - a }, { ao: false });
      }
    }
    // bulbs round the rim
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      k.bulbs.add(shapes.sphere(0.03, 6, 4), i % 2 ? C.glow : '#ffc0e0', { x: rimX + 0.05, y: c + Math.sin(a) * R, z: Math.cos(a) * R });
    }
    // the cabins, hanging level
    const cabins = [C.coral, C.mustard, C.mint, C.sky, C.lilac, C.pink, C.orange, C.teal];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const py = c + Math.sin(a) * R;
      const pz = Math.cos(a) * R;
      const col = cabins[i];
      k.body.add(shapes.cyl(0.015, 0.015, rimX * 2 + 0.04, 5), C.metal, { y: py, z: pz, rz: Math.PI / 2 }, { ao: false });
      k.body.add(shapes.box(0.02, 0.12, 0.02), C.metal, { y: py - 0.06, z: pz }, { ao: false });
      k.body.add(shapes.dome(0.18, 12, 5), col, { y: py - 0.13, z: pz, s: [1, 0.5, 1] }, { ao: false });
      k.body.add(shapes.box(0.29, 0.05, 0.29, 0.02, 1), C.white, { y: py - 0.14, z: pz }, { ao: false });
      k.glass.add(shapes.box(0.27, 0.1, 0.27, 0.02, 1), C.glass, { y: py - 0.215, z: pz });
      k.body.add(shapes.box(0.3, 0.14, 0.3, 0.05, 2), col, { y: py - 0.33, z: pz });
    }
    // the ticket hut at the front, beside the frame
    const hx = Math.min(k.W / 2 - 0.27, 0.86);
    const hz = k.D / 2 - 0.3;
    k.body.add(shapes.box(0.44, 0.62, 0.4, 0.05, 2), C.pink, { x: hx, y: 0.31, z: hz });
    k.body.add(shapes.box(0.3, 0.2, 0.02, 0.01, 1), C.white, { x: hx, y: 0.46, z: hz + 0.2 }, { ao: false });
    k.glass.add(shapes.box(0.26, 0.16, 0.02, 0.01, 1), C.glass, { x: hx, y: 0.46, z: hz + 0.21 });
    k.body.add(shapes.box(0.36, 0.03, 0.08, 0.01, 1), C.woodLight, { x: hx, y: 0.35, z: hz + 0.23 }, { ao: false });
    for (let i = 0; i < 5; i++) k.body.add(shapes.box(0.1, 0.04, 0.46, 0.015, 1), i % 2 ? C.white : C.rose, { x: hx - 0.2 + i * 0.1, y: 0.68, z: hz + 0.02, rx: 0.2 }, { ao: false });
    k.body.add(shapes.cyl(0.008, 0.008, 0.3, 4), C.metal, { x: hx + 0.17, y: 0.85, z: hz - 0.12 }, { ao: false });
    k.body.add(shapes.box(0.14, 0.08, 0.01), C.mustard, { x: hx + 0.24, y: 0.96, z: hz - 0.12 }, { ao: false });
    k.bulbs.add(shapes.sphere(0.025, 6, 4), C.glow, { x: hx, y: 0.6, z: hz + 0.24 });
    return c + R + 0.08;
  },

  // the ferry terminal: a low white building with a blue roof, round windows, a lifebuoy on the wall, a ticket window
  // with its awning and timetable, a ship on the roof's ridge; a gangway with rails along its right side, a flag mast
  // and bollards with a rope in front
  odile: (k, u) =>
    Math.max(
      setIn(
        k,
        0.32,
        0.72,
        (s, du) => {
          walls(s, 1.02, C.white, { plinth: C.navy });
          k.body.add(shapes.box(s.W + 0.06, 0.08, s.D + 0.06, 0.02, 1), C.blue, { y: 0.92 }, { ao: false });
          door(s, du, { color: C.blue, glass: true, lamp: true });
          const b = besideDoor(s, du);
          // the ticket window, its ledge and awning, the timetable beside it
          const tw = Math.min(0.56, b.room - 0.5);
          const tx = b.at - (b.at > du ? 0.2 : -0.2);
          if (tw > 0.3) {
            const f = onFace(s, 'front', tx, 0.58, 0);
            k.body.add(shapes.box(tw + 0.08, 0.38, 0.05, 0.02, 1), C.navy, rel(f, 0, 0, 0.02), { ao: false });
            k.glass.add(shapes.box(tw, 0.3, 0.03, 0.01, 1), C.glass, rel(f, 0, 0, 0.04));
            k.body.add(shapes.box(tw + 0.1, 0.03, 0.12, 0.01, 1), C.woodLight, rel(f, 0, -0.2, 0.07), { ao: false });
            awning(s, tx, 0.88, tw + 0.14, C.blue, C.white, 0.24);
            const tt = onFace(s, 'front', tx + (b.at > du ? 1 : -1) * (tw / 2 + 0.24), 0.56, 0);
            if (Math.abs(tx + (b.at > du ? 1 : -1) * (tw / 2 + 0.24)) < s.W / 2 - 0.16) {
              k.body.add(shapes.box(0.26, 0.36, 0.03, 0.02, 1), C.navy, rel(tt, 0, 0, 0.02), { ao: false });
              for (let i = 0; i < 5; i++) k.body.add(shapes.box(0.18 - (i % 2) * 0.04, 0.025, 0.01), i === 0 ? C.mustard : C.white, rel(tt, -(i % 2) * 0.02, 0.12 - i * 0.06, 0.04), { ao: false });
            }
          }
          // the lifebuoy on the other side of the door
          const lx = du + (b.at > du ? -0.6 : 0.6);
          if (Math.abs(lx) < s.W / 2 - 0.2) {
            const lf = onFace(s, 'front', lx, 0.58, 0);
            k.body.add(shapes.torus(0.13, 0.045, 16), C.white, rel(lf, 0, 0, 0.06), { ao: false });
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
              k.body.add(shapes.box(0.07, 0.1, 0.1, 0.03, 1), C.red, rel(lf, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.06, { rz: a }), { ao: false });
            }
            k.body.add(shapes.box(0.04, 0.04, 0.06), C.metal, rel(lf, 0, 0.17, 0.03), { ao: false });
          }
          // round windows on the sides
          for (const face of ['left', 'right'] as const) for (const at of [-0.8, 0, 0.8]) windowOn(s, face, at, 0.58, { w: 0.28, round: true, frame: C.blue });
          const top = hipRoof(s, 1.02, 0.46, C.blue);
          // a little ship on the ridge: hull, cabin, funnel
          const sy = top - 0.02;
          k.body.add(shapes.box(0.44, 0.1, 0.14, 0.04, 2), C.red, { y: sy + 0.05 }, { ao: false });
          k.body.add(shapes.box(0.46, 0.03, 0.15, 0.01, 1), C.white, { y: sy + 0.1 }, { ao: false });
          k.body.add(shapes.box(0.2, 0.1, 0.1, 0.02, 1), C.white, { x: -0.04, y: sy + 0.16 }, { ao: false });
          k.body.add(shapes.cyl(0.035, 0.04, 0.12, 8), C.mustard, { x: 0.1, y: sy + 0.2 }, { ao: false });
          return sy + 0.28;
        },
        u,
      ),
      (() => {
        // the gangway along the right side, rising to the back, with rails
        const gx = k.W / 2 - 0.34;
        const gl = k.D - 0.1;
        const rise = 0.3;
        const ga = Math.atan2(rise, gl);
        k.body.add(shapes.box(0.5, 0.05, Math.hypot(gl, rise), 0.015, 1), C.woodLight, { x: gx, y: 0.08 + rise / 2, z: 0, rx: ga });
        for (let i = 0; i < 6; i++) k.body.add(shapes.box(0.5, 0.012, 0.02), C.woodDark, { x: gx, y: 0.11 + (rise * (5 - i)) / 5 - 0.0, z: -gl / 2 + 0.1 + (i * (gl - 0.2)) / 5 }, { ao: false });
        for (const sx of [-1, 1]) {
          const rx = gx + sx * 0.25;
          for (let i = 0; i < 5; i++) {
            const z = -gl / 2 + 0.08 + (i * (gl - 0.16)) / 4;
            const base = 0.1 + rise * (0.5 - z / gl);
            k.body.add(shapes.cyl(0.015, 0.015, 0.45, 5), C.white, { x: rx, y: base + 0.22, z }, { ao: false });
          }
          k.body.add(shapes.cyl(0.018, 0.018, Math.hypot(gl - 0.1, rise), 6), C.white, { x: rx, y: 0.1 + rise / 2 + 0.44, z: 0, rx: Math.PI / 2 + ga }, { ao: false });
          k.body.add(shapes.cyl(0.008, 0.008, Math.hypot(gl - 0.1, rise), 4), C.blue, { x: rx, y: 0.1 + rise / 2 + 0.24, z: 0, rx: Math.PI / 2 + ga }, { ao: false });
        }
        for (const z of [-gl / 2 + 0.2, gl / 2 - 0.3]) k.body.add(shapes.box(0.4, 0.1 + rise * (0.5 - z / gl), 0.08), C.stoneDark, { x: gx, y: (0.1 + rise * (0.5 - z / gl)) / 2, z });
        // the flag mast at the front corner away from the gangway
        const mx = -k.W / 2 + 0.16;
        const mz = k.D / 2 - 0.16;
        k.body.add(shapes.cyl(0.08, 0.1, 0.08, 10), C.stoneDark, { x: mx, y: 0.04, z: mz });
        k.body.add(shapes.cyl(0.018, 0.024, 1.9, 6), C.white, { x: mx, y: 1.0, z: mz }, { ao: false });
        k.body.add(shapes.sphere(0.035, 8, 6), C.mustard, { x: mx, y: 1.97, z: mz }, { ao: false });
        k.body.add(shapes.box(0.34, 0.1, 0.012), C.blue, { x: mx + 0.18, y: 1.82, z: mz }, { ao: false });
        k.body.add(shapes.box(0.34, 0.1, 0.012), C.white, { x: mx + 0.18, y: 1.72, z: mz }, { ao: false });
        k.body.add(shapes.box(0.08, 0.2, 0.014), C.red, { x: mx + 0.07, y: 1.77, z: mz }, { ao: false });
        // two bollards and a rope between them
        const x0 = mx + 0.42;
        const x1 = Math.min(u - 0.5, x0 + 0.7);
        if (x1 - x0 > 0.3) {
          for (const x of [x0, x1]) {
            k.body.add(shapes.cyl(0.07, 0.08, 0.24, 10), C.navy, { x, y: 0.12, z: mz });
            k.body.add(shapes.cyl(0.09, 0.09, 0.04, 10), C.navy, { x, y: 0.25, z: mz }, { ao: false });
          }
          k.body.add(shapes.torus((x1 - x0) / 2, 0.018, 14), C.woodLight, { x: (x0 + x1) / 2, y: 0.22, z: mz, rz: Math.PI, s: [1, 0.35, 1] }, { ao: false });
        }
        return 2.0;
      })(),
    ),

  // Gus's sentry box: white with red stripes, a window with his radio on the sill, a red pyramid roof with a lamp on
  // top, a barrier arm raised beside it
  gus: (k) => {
    const bw = 0.4;
    const bd = 0.42;
    const bx = -k.W / 2 + bw / 2 + 0.04;
    const bz = -0.08;
    const h = 0.96;
    k.body.add(shapes.box(bw + 0.04, 0.06, bd + 0.04, 0.02, 1), C.stoneDark, { x: bx, y: 0.03, z: bz });
    k.body.add(shapes.box(bw, h, bd, 0.04, 2), C.white, { x: bx, y: h / 2 + 0.04, z: bz });
    // red stripes: full height on the sides, under the window on the front
    for (const sx of [-1, 1]) for (const a of [-0.13, 0, 0.13]) k.body.add(shapes.box(0.02, h - 0.08, 0.06), C.red, { x: bx + sx * (bw / 2 + 0.005), y: h / 2 + 0.04, z: bz + a }, { ao: false });
    for (const a of [-0.13, 0, 0.13]) k.body.add(shapes.box(0.06, 0.4, 0.02), C.red, { x: bx + a, y: 0.3, z: bz + bd / 2 + 0.005 }, { ao: false });
    // the window, its sill, the radio
    const fz = bz + bd / 2;
    k.body.add(shapes.box(0.32, 0.3, 0.03, 0.01, 1), C.navy, { x: bx, y: 0.72, z: fz + 0.005 }, { ao: false });
    k.glass.add(shapes.box(0.28, 0.26, 0.02, 0.01, 1), C.glass, { x: bx, y: 0.72, z: fz + 0.015 });
    k.body.add(shapes.box(0.34, 0.03, 0.08, 0.01, 1), C.woodLight, { x: bx, y: 0.56, z: fz + 0.035 }, { ao: false });
    k.body.add(shapes.box(0.1, 0.06, 0.05, 0.015, 1), C.teal, { x: bx + 0.08, y: 0.6, z: fz + 0.035 }, { ao: false });
    k.body.add(shapes.cyl(0.004, 0.004, 0.1, 3), C.metal, { x: bx + 0.11, y: 0.67, z: fz + 0.035, rz: -0.3 }, { ao: false });
    // the roof and its lamp
    k.body.add(shapes.box(bw + 0.12, 0.05, bd + 0.12, 0.02, 1), C.red, { x: bx, y: h + 0.06, z: bz }, { ao: false });
    k.body.add(pyramid(), C.red, { x: bx, y: h + 0.2, z: bz, s: [bw + 0.1, 0.24, bd + 0.1] }, { ao: false });
    k.body.add(shapes.cyl(0.012, 0.012, 0.08, 4), C.metal, { x: bx, y: h + 0.36, z: bz }, { ao: false });
    k.bulbs.add(shapes.sphere(0.045, 8, 6), C.glow, { x: bx, y: h + 0.42, z: bz });
    k.body.add(shapes.cone(0.05, 0.05, 8), '#3d4150', { x: bx, y: h + 0.48, z: bz }, { ao: false });
    // the barrier: a post, the arm raised, a counterweight
    const px = k.W / 2 - 0.08;
    const pz = 0.2;
    const py = 0.52;
    k.body.add(shapes.box(0.08, py, 0.08, 0.02, 1), C.white, { x: px, y: py / 2, z: pz });
    k.body.add(shapes.box(0.1, 0.06, 0.1, 0.02, 1), C.red, { x: px, y: py, z: pz }, { ao: false });
    const ang = 1.15;
    const L = 0.8;
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      k.body.add(shapes.box(L / 5 + 0.002, 0.04, 0.035), i % 2 ? C.white : C.red, { x: px - Math.cos(ang) * L * t, y: py + Math.sin(ang) * L * t, z: pz + 0.04, rz: -ang }, { ao: false });
    }
    k.body.add(shapes.box(0.08, 0.06, 0.05, 0.02, 1), '#3d4150', { x: px + Math.cos(ang) * 0.06, y: py - Math.sin(ang) * 0.06, z: pz + 0.04, rz: -ang }, { ao: false });
    return h + 0.52;
  },

  // Mei's dumpling stall: a red canopy, bamboo steamers stacked and steaming, a wok on its burner, a plate of
  // dumplings, red paper lanterns with gold tassels
  mei: (k) => {
    stall(k, 1.32, 1.16, ['#e0524f', '#c43d3d']);
    const cz = 0.0;
    k.body.add(shapes.box(k.W - 0.12, 0.46, 0.4, 0.03, 2), '#a8463f', { y: 0.23, z: cz });
    k.body.add(shapes.box(k.W - 0.08, 0.03, 0.44, 0.01, 1), C.woodLight, { y: 0.475, z: cz }, { ao: false });
    k.body.add(shapes.box(k.W - 0.2, 0.06, 0.02), C.mustard, { y: 0.4, z: cz + 0.205 }, { ao: false });
    // the steamers: three stacks, lids, puffs of steam
    const sx0 = -k.W / 2 + 0.22;
    for (let s = 0; s < 3; s++) {
      const x = sx0 + s * 0.22;
      const n = [3, 4, 2][s];
      for (let i = 0; i < n; i++) {
        const y = 0.52 + i * 0.065;
        k.body.add(shapes.cyl(0.095, 0.095, 0.06, 14), C.woodLight, { x, y, z: cz - 0.02 }, { ao: false });
        k.body.add(shapes.torus(0.095, 0.008, 14), '#b58858', { x, y: y + 0.02, z: cz - 0.02, rx: Math.PI / 2 }, { ao: false });
      }
      const ty = 0.52 + n * 0.065 - 0.02;
      k.body.add(shapes.dome(0.095, 14, 4), '#d9b486', { x, y: ty, z: cz - 0.02, s: [1, 0.35, 1] }, { ao: false });
      k.body.add(shapes.sphere(0.06, 8, 6), C.white, { x: x + 0.02, y: ty + 0.1, z: cz - 0.02 }, { ao: false });
      k.body.add(shapes.sphere(0.04, 8, 6), C.white, { x: x - 0.03, y: ty + 0.18, z: cz - 0.03 }, { ao: false });
    }
    // the wok on its burner
    const wx = k.W / 2 - 0.25;
    k.body.add(shapes.cyl(0.09, 0.1, 0.06, 12), C.metal, { x: wx, y: 0.52, z: cz }, { ao: false });
    k.body.add(shapes.dome(0.14, 14, 5), '#3d4150', { x: wx, y: 0.64, z: cz, rx: Math.PI, s: [1, 0.5, 1] }, { ao: false });
    k.body.add(shapes.cyl(0.015, 0.015, 0.16, 5), C.woodDark, { x: wx + 0.2, y: 0.63, z: cz, rz: Math.PI / 2 }, { ao: false });
    // a plate of dumplings at the front
    k.body.add(shapes.cyl(0.08, 0.07, 0.015, 14), C.white, { x: wx - 0.2, y: 0.5, z: cz + 0.13 }, { ao: false });
    for (let i = 0; i < 4; i++) k.body.add(shapes.sphere(0.03, 8, 5), C.cream, { x: wx - 0.2 + (i % 2 ? 0.03 : -0.03), y: 0.52, z: cz + 0.13 + (i < 2 ? 0.03 : -0.03), s: [1.2, 0.8, 1] }, { ao: false });
    // red lanterns along the canopy's front
    const lz = k.D / 2 + 0.08;
    for (let i = 0; i < 3; i++) lantern(k, -k.W / 2 + 0.25 + (i * (k.W - 0.5)) / 2, 0.98, lz, '#ff5a4e', 0.06, 0.06, C.mustard);
    return 1.4;
  },

  // Sol's lantern stall: a plain cream canopy hung all along with paper lanterns of every colour lit inside, open
  // boxes of folded lanterns on the counter
  sol: (k) => {
    stall(k, 1.32, 1.16, ['#f3e6cc', '#e8d8b8'], C.wood);
    const cz = -0.02;
    k.body.add(shapes.box(k.W - 0.12, 0.44, 0.36, 0.03, 2), C.wood, { y: 0.22, z: cz });
    k.body.add(shapes.box(k.W - 0.08, 0.03, 0.4, 0.01, 1), C.woodLight, { y: 0.455, z: cz }, { ao: false });
    // boxes of folded lanterns
    const cols = [C.red, C.mustard, C.rose, C.teal, C.orange, C.lilac, C.mint, C.sky];
    for (let b = 0; b < 3; b++) {
      const x = -k.W / 2 + 0.3 + b * ((k.W - 0.6) / 2);
      k.body.add(shapes.box(0.26, 0.08, 0.2, 0.015, 1), C.woodLight, { x, y: 0.51, z: cz });
      for (let i = 0; i < 4; i++) k.body.add(shapes.cyl(0.045, 0.045, 0.03, 10), cols[(b * 3 + i) % cols.length], { x: x - 0.08 + (i % 2) * 0.16 - (i > 1 ? 0.0 : 0), y: 0.56 + (i > 1 ? 0.02 : 0), z: cz + (i > 1 ? 0.05 : -0.05), rx: 0.3 }, { ao: false });
    }
    // lanterns all along the canopy's front and down its sides, lit inside
    const lz = k.D / 2 + 0.08;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x = -k.W / 2 + 0.1 + (i * (k.W - 0.2)) / (n - 1);
      lantern(k, x, 1.0 - (i % 2) * 0.05, lz, cols[i % cols.length], 0.055, 0.05 + (i % 2) * 0.05);
    }
    for (const sx of [-1, 1])
      for (const z of [-0.12, 0.14]) lantern(k, sx * (k.W / 2 + 0.02), 1.0 + (z < 0 ? 0.04 : 0), z, cols[(z < 0 ? 5 : 2) + (sx > 0 ? 1 : 0)], 0.05, 0.08);
    // a big round one hung over the middle of the counter
    lantern(k, 0, 1.0, 0.0, '#ffb070', 0.08, 0.04);
    return 1.4;
  },
};

/** Which way from the door a cart's handle points (away from the door). */
function sx0(at: number, u: number): number {
  return at > u ? 1 : -1;
}

registerRecipes(CITY_RECIPES);
