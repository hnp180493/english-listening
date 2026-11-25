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
import { CylinderGeometry, Matrix4, TorusGeometry, type ColorRepresentation } from 'three';
import { awning, chimney, door, flatRoof, flowerBox, gableRoof, hipRoof, onFace, pot, pyramid, rel, signBoard, walls, windowOn, type Kit } from '../three/scene/kit';
import { shapes } from '../three/scene/merge';
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
};

/** Which way from the door a cart's handle points (away from the door). */
function sx0(at: number, u: number): number {
  return at > u ? 1 : -1;
}

registerRecipes(CITY_RECIPES);
