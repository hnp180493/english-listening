// The frame every room of the town is built on (contracts.ts): a doll's-house room open towards +X+Z, two walls at
// −Z (back) and −X (left), a floor slab, the merges that become a handful of meshes (shell, furniture, window glass,
// bulbs, screens), its own soft light rig (sky fill, a key light with shadows from the open side, two warm lamps),
// small life (steam, a fan, a clock, flickering screens, glow round the lamps at night) and the anchors and shots of
// the conversation. Recipes (recipes/*.ts) only place furniture and say where people are.

import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Points,
  PointsMaterial,
  RGBAFormat,
  SphereGeometry,
  type ColorRepresentation,
  type Material,
} from 'three';
import { Merge, shapes, type Paint, type Place } from '../scene/merge';
import { C } from '../scene/palette3d';
import type { InteriorId, InteriorSet, RoomAnchor, RoomShot } from './contracts';

/** A room's fill light: near neutral (the town's people keep their colours indoors). */
const ROOM_SKY = '#f6f2ea';
const ROOM_GROUND = '#b9ae9f';
/** A room's lamps at night (was 4.5 of amber). */
const LAMP_NIGHT = 1.8;

/** The seat top of chairs, benches, sofas (tiles): what the sit pose expects (chars/person.ts SEAT_HEIGHT). */
export const SEAT = 0.18;
/** A table top, a hand above the seat (like the café terrace in the town). */
export const TABLE = 0.31;
/** A counter or desk a grown-up stands behind (about their belt). */
export const COUNTER = 0.4;
/** Seated, the hips sit this far forward of the seat's middle (scene/engine3d.ts SEAT_FORWARD). */
export const SEAT_FORWARD = 0.08;
/** A person's half width, for "not inside furniture". */
export const PERSON_R = 0.14;

/** A placer: offsets (along its local X, up, along its local Z = its front) in a frame turned by `ry` round Y. */
export type Put = (lx: number, ly: number, lz: number, extra?: Place) => Place;

export function frame(x: number, z: number, ry = 0, y = 0): Put {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return (lx, ly, lz, extra = {}) => ({ ...extra, x: x + lx * c + lz * s, y: y + ly, z: z - lx * s + lz * c, ry: ry + (extra.ry ?? 0) });
}

/** A frame's turn for a front that faces `heading` (radians from +X towards +Z). */
export const ryFor = (heading: number) => Math.PI / 2 - heading;
/** Headings: towards +X, +Z (the open side), −X, −Z (the back wall). */
export const H_PX = 0;
export const H_PZ = Math.PI / 2;
export const H_NX = Math.PI;
export const H_NZ = -Math.PI / 2;

/** A footprint (axis-aligned) where nobody can stand. */
export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  what: string;
}

export interface RoomSpec {
  id: InteriorId;
  /** Inner size: width along X, depth along Z, wall height. */
  W: number;
  D: number;
  H: number;
  /** No walls (the park). */
  outdoor?: boolean;
}

export interface RoomStats {
  triangles: number;
  meshes: number;
  buildMs: number;
}

/** What buildInterior gives: the contract plus what the stage, the harness and the tests may read. */
export interface RoomSet extends InteriorSet {
  readonly size: { W: number; D: number; H: number };
  /** Footprints of furniture (anchors stay out of them). */
  readonly blocks: readonly Rect[];
  /** Every seat of the room as a sit anchor (extras use some). */
  readonly seats: readonly RoomAnchor[];
  /** The backdrop colour now (day/night): a scene may use it as its background or fog. */
  readonly background: Color;
  readonly stats: RoomStats;
}

interface LifeFn {
  (t: number, dt: number): void;
}

/** One room being built. */
export class Room {
  readonly id: InteriorId;
  readonly W: number;
  readonly D: number;
  readonly H: number;
  readonly outdoor: boolean;
  /** Floor, walls, things fixed on them: receive shadows, cast none. */
  readonly shell = new Merge();
  /** Furniture and things: cast and receive shadows. */
  readonly furn = new Merge();
  /** Window panes: bright sky by day, deep blue at night. */
  readonly glass = new Merge();
  /** Lamp bulbs and shades' insides: glow at night. */
  readonly bulbs = new Merge();
  /** Screens (TV, monitors, phones, boards that light up): a soft light of their own, flickering a little. */
  readonly screens = new Merge();
  /** Soft cloth and leaves that sway a little (bunting, curtains near a fan, tree crowns): their own mesh. */
  readonly sway = new Merge();
  readonly blocks: Rect[] = [];
  readonly seats: RoomAnchor[] = [];
  /** Where the two warm lamp lights go (the first two given). */
  readonly lamps: [number, number, number][] = [];
  /** Glow points round bulbs at night: x, y, z and a size (under 0.6 = a small glow, else a lamp's). */
  readonly halos: [number, number, number, number][] = [];
  /** Where steam rises (cups, a teapot, a kettle, the coffee machine). */
  readonly steam: [number, number, number][] = [];
  readonly root = new Group();
  readonly life: LifeFn[] = [];
  readonly materials: Material[] = [];
  readonly geometries: BufferGeometry[] = [];
  /** Things the night changes, beyond the rig (the cinema's marquee, a screen's colour…). */
  readonly nightHooks: ((k: number) => void)[] = [];
  /** Extra things to free with the room (shared textures). */
  readonly disposers: (() => void)[] = [];
  /** The lamp light (0 or 1) that flickers like a fire, and how strong it is by day (a fire burns day and night). */
  flicker: { lamp: number; day: number } | null = null;
  /** The backdrop round the room and the ground under it, by day and at night (an outdoor room wants a sky). */
  backdrop = { day: '#f6efe4', night: '#232445', groundDay: '#e9dccb', groundNight: '#2d2740' };
  readonly std: MeshStandardMaterial;

  constructor(spec: RoomSpec) {
    this.id = spec.id;
    this.W = spec.W;
    this.D = spec.D;
    this.H = spec.H;
    this.outdoor = !!spec.outdoor;
    this.root.name = `interior-${spec.id}`;
    this.std = this.mat(new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }));
  }

  mat<T extends Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  geo<T extends BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  /** Mark a footprint (centre, half sizes; turned by ry: its bounding box is kept). */
  block(cx: number, cz: number, hw: number, hd: number, what: string, ry = 0): void {
    const c = Math.abs(Math.cos(ry));
    const s = Math.abs(Math.sin(ry));
    const ex = hw * c + hd * s;
    const ez = hw * s + hd * c;
    this.blocks.push({ x0: cx - ex, z0: cz - ez, x1: cx + ex, z1: cz + ez, what });
  }

  /** A seat whose middle is at (x, z), the sitter facing `heading`: the sit anchor (the body's root, hips forward). */
  seat(x: number, z: number, heading: number, seatY = SEAT): RoomAnchor {
    const a: RoomAnchor = { x: x + Math.cos(heading) * SEAT_FORWARD, z: z + Math.sin(heading) * SEAT_FORWARD, heading, pose: 'sit', seatY };
    this.seats.push(a);
    return a;
  }

  /** A placer on the back wall's inner face at x, height y (its front faces +Z). */
  back(x: number, y: number, out = 0): Put {
    return frame(x, -this.D / 2 + out, 0, y);
  }

  /** A placer on the left wall's inner face at z, height y (its front faces +X; its local +X runs towards −Z). */
  left(z: number, y: number, out = 0): Put {
    return frame(-this.W / 2 + out, z, Math.PI / 2, y);
  }

  lamp(x: number, y: number, z: number): void {
    this.lamps.push([x, y, z]);
  }

  halo(x: number, y: number, z: number, size = 0.9): void {
    this.halos.push([x, y, z, size]);
  }

  /** A part that moves (a fan, a clock's hand): its own mesh with the room's material, added under `parent`. */
  moving(build: (m: Merge) => void, parent: Object3D = this.root, castShadow = false): Mesh {
    const m = new Merge();
    build(m);
    const g = m.build() ?? new BufferGeometry();
    this.geo(g);
    const mesh = new Mesh(g, this.std);
    mesh.castShadow = castShadow;
    parent.add(mesh);
    return mesh;
  }
}

// ───────────────────────── the shell ─────────────────────────

export interface ShellStyle {
  /** Wall colour (back, left); a lower band (wainscot) and the rail over it. */
  wall: ColorRepresentation;
  wallLeft?: ColorRepresentation;
  wainscot?: ColorRepresentation;
  wainscotH?: number;
  rail?: ColorRepresentation;
  /** Thin vertical stripes on the upper wall (wallpaper). */
  stripes?: ColorRepresentation;
  floor: 'planks' | 'tiles' | 'carpet' | 'boards' | 'stone' | 'grass';
  floorA: ColorRepresentation;
  floorB?: ColorRepresentation;
  /** Tile size for 'tiles' / 'stone'. */
  tile?: number;
  /** The colour of the cut edges (wall tops, the floor slab's sides). */
  cut?: ColorRepresentation;
  skirting?: ColorRepresentation;
}

const col = new Color();
const colB = new Color();

/** Floor, slab and the two walls. */
export function shell(r: Room, s: ShellStyle): void {
  const { W, D, H } = r;
  const m = r.shell;
  const cut = s.cut ?? C.trim;
  const T = 0.14;
  // the slab under the floor (its edge shows on the open sides)
  m.add(shapes.box(W + T * 2 + 0.06, 0.2, D + T * 2 + 0.06, 0.05, 1), s.floor === 'grass' ? C.earth : C.woodDark, { x: -T / 2, y: -0.1, z: -T / 2 }, { ao: false, shade: -0.05 });
  floor(r, s);
  if (r.outdoor) return;
  const wl = s.wallLeft ?? s.wall;
  // walls: boxes outside the inner faces, the cut top in a light trim
  m.add(shapes.box(W + T, H, T, 0.02, 1), s.wall, { x: -T / 2, y: H / 2, z: -D / 2 - T / 2 });
  m.add(shapes.box(T, H, D, 0.02, 1), wl, { x: -W / 2 - T / 2, y: H / 2, z: 0 });
  m.add(shapes.box(W + T + 0.03, 0.04, T + 0.03, 0.015, 1), cut, { x: -T / 2, y: H + 0.02, z: -D / 2 - T / 2 }, { ao: false });
  m.add(shapes.box(T + 0.03, 0.04, D + 0.03, 0.015, 1), cut, { x: -W / 2 - T / 2, y: H + 0.02, z: 0 }, { ao: false });
  // skirting
  const sk = s.skirting ?? C.woodDark;
  m.add(shapes.box(W, 0.06, 0.03, 0.008, 1), sk, { x: 0, y: 0.03, z: -D / 2 + 0.015 });
  m.add(shapes.box(0.03, 0.06, D, 0.008, 1), sk, { x: -W / 2 + 0.015, y: 0.03, z: 0 });
  if (s.wainscot !== undefined) {
    const h = s.wainscotH ?? 0.5;
    m.add(shapes.box(W, h, 0.02, 0.008, 1), s.wainscot, { x: 0, y: h / 2, z: -D / 2 + 0.01 });
    m.add(shapes.box(0.02, h, D, 0.008, 1), s.wainscot, { x: -W / 2 + 0.01, y: h / 2, z: 0 });
    const rail = s.rail ?? C.trim;
    m.add(shapes.box(W, 0.035, 0.04, 0.008, 1), rail, { x: 0, y: h, z: -D / 2 + 0.02 }, { ao: false });
    m.add(shapes.box(0.04, 0.035, D, 0.008, 1), rail, { x: -W / 2 + 0.02, y: h, z: 0 }, { ao: false });
    // panel lines on the wainscot
    for (let x = -W / 2 + 0.4; x < W / 2 - 0.1; x += 0.4) m.add(shapes.box(0.015, h - 0.12, 0.012, 0.008, 1), rail, { x, y: h / 2 + 0.02, z: -D / 2 + 0.025 }, { ao: false, shade: -0.05 });
    for (let z = -D / 2 + 0.4; z < D / 2 - 0.1; z += 0.4) m.add(shapes.box(0.012, h - 0.12, 0.015, 0.008, 1), rail, { x: -W / 2 + 0.025, y: h / 2 + 0.02, z }, { ao: false, shade: -0.05 });
  }
  if (s.stripes !== undefined) {
    const y0 = s.wainscot !== undefined ? (s.wainscotH ?? 0.5) + 0.02 : 0.08;
    col.set(s.stripes);
    for (let x = -W / 2 + 0.12; x < W / 2; x += 0.24) {
      const z = -D / 2 + 0.004;
      m.tris([x, y0, z, x + 0.08, y0, z, x + 0.08, H - 0.02, z, x, y0, z, x + 0.08, H - 0.02, z, x, H - 0.02, z], col, [0, 0, 1]);
    }
    for (let z = -D / 2 + 0.12; z < D / 2; z += 0.24) {
      const x = -W / 2 + 0.004;
      m.tris([x, y0, z, x, y0, z + 0.08, x, H - 0.02, z + 0.08, x, y0, z, x, H - 0.02, z + 0.08, x, H - 0.02, z], col, [1, 0, 0]);
    }
  }
}

function floor(r: Room, s: ShellStyle): void {
  const { W, D } = r;
  const m = r.shell;
  const a = col.set(s.floorA).clone();
  const b = colB.set(s.floorB ?? s.floorA).clone();
  const x0 = -W / 2;
  const z0 = -D / 2;
  const y = 0.001;
  if (s.floor === 'planks' || s.floor === 'boards') {
    // planks run along X, staggered seams; each plank a touch lighter or darker
    const pw = s.floor === 'planks' ? 0.24 : 0.36;
    let row = 0;
    for (let z = z0; z < D / 2 - 1e-6; z += pw, row++) {
      const z1 = Math.min(D / 2, z + pw);
      const len = 1.3;
      const off = (row * 0.53) % len;
      let i = 0;
      for (let x = x0 - off; x < W / 2 - 1e-6; x += len, i++) {
        const xa = Math.max(x0, x);
        const xb = Math.min(W / 2, x + len);
        const k = ((row * 7 + i * 3) % 5) / 5;
        const c = a.clone().lerp(b, k);
        m.quadUp(xa, z + 0.008, xb - 0.008, z1 - 0.008, y, c);
      }
    }
    // the gaps between planks, a shade darker
    m.quadUp(x0, z0, W / 2, D / 2, 0, b.clone().multiplyScalar(0.72));
  } else if (s.floor === 'tiles' || s.floor === 'stone') {
    const t = s.tile ?? 0.4;
    let i = 0;
    for (let x = x0; x < W / 2 - 1e-6; x += t, i++) {
      let j = 0;
      for (let z = z0; z < D / 2 - 1e-6; z += t, j++) {
        const c = (i + j) % 2 === 0 ? a : b;
        const g = s.floor === 'stone' ? 0.012 : 0.006;
        m.quadUp(x + g, z + g, Math.min(W / 2, x + t) - g, Math.min(D / 2, z + t) - g, y, c);
      }
    }
    m.quadUp(x0, z0, W / 2, D / 2, 0, a.clone().lerp(b, 0.5).multiplyScalar(0.8));
  } else if (s.floor === 'grass') {
    m.quadUp(x0, z0, W / 2, D / 2, y, a, b, a, b);
  } else {
    m.quadUp(x0, z0, W / 2, D / 2, y, a, a, b, a);
  }
}

// ───────────────────────── wall pieces ─────────────────────────

/** A window on a wall (placer from Room.back / Room.left): frame, panes (glass), sill, curtains. */
export function windowAt(r: Room, p: Put, w: number, h: number, o: { frame?: ColorRepresentation; curtain?: ColorRepresentation; sill?: boolean; panes?: number; arch?: boolean } = {}): void {
  const fr = o.frame ?? C.trim;
  const m = r.shell;
  m.add(shapes.box(w + 0.1, h + 0.1, 0.05, 0.02, 1), fr, p(0, 0, 0.02), { ao: false });
  r.glass.add(shapes.box(w, h, 0.02, 0.005, 1), C.glass, p(0, 0, 0.04));
  const n = o.panes ?? 2;
  for (let i = 1; i < n; i++) m.add(shapes.box(0.025, h, 0.03, 0.008, 1), fr, p(-w / 2 + (w / n) * i, 0, 0.055), { ao: false });
  m.add(shapes.box(w, 0.025, 0.03, 0.008, 1), fr, p(0, h * 0.12, 0.055), { ao: false });
  if (o.arch) m.add(shapes.cyl(w / 2 + 0.05, w / 2 + 0.05, 0.05, 16), fr, p(0, h / 2, 0.02, { rx: Math.PI / 2, s: [1, 1, 0.5] }), { ao: false });
  if (o.sill !== false) m.add(shapes.box(w + 0.18, 0.04, 0.12, 0.015, 1), fr, p(0, -h / 2 - 0.05, 0.06), { ao: false });
  if (o.curtain !== undefined) {
    for (const s of [-1, 1]) {
      // gathered curtains: three soft folds each side, a tie
      for (let k = 0; k < 3; k++) m.add(shapes.box(0.07, h + 0.12, 0.05, 0.025, 1), o.curtain, p(s * (w / 2 + 0.02 + k * 0.055), -0.03, 0.1 + (k % 2) * 0.015), { shade: k % 2 ? -0.06 : 0, ao: false });
    }
    m.add(shapes.cyl(0.015, 0.015, w + 0.5, 6), C.woodDark, p(0, h / 2 + 0.1, 0.1, { rz: Math.PI / 2 }), { ao: false });
  }
}

/** A framed picture on a wall: frame, mat, a simple picture (sky, hills, a sun) or a plain colour. */
export function picture(r: Room, p: Put, w: number, h: number, frameCol: ColorRepresentation, art: 'landscape' | 'portrait' | 'plain' | 'flower' = 'landscape', a: ColorRepresentation = C.sky): void {
  const m = r.shell;
  m.add(shapes.box(w, h, 0.03, 0.008, 1), frameCol, p(0, 0, 0.015), { ao: false });
  m.add(shapes.box(w - 0.05, h - 0.05, 0.03, 0.008, 1), art === 'plain' ? a : C.cream, p(0, 0, 0.022), { ao: false });
  if (art === 'landscape') {
    m.add(shapes.box(w - 0.09, (h - 0.09) * 0.6, 0.02, 0.008, 1), a, p(0, (h - 0.09) * 0.2, 0.03), { ao: false });
    m.add(shapes.box(w - 0.09, (h - 0.09) * 0.4, 0.02, 0.008, 1), C.leaf, p(0, -(h - 0.09) * 0.3, 0.032), { ao: false });
    m.add(shapes.sphere(Math.min(w, h) * 0.12, 8, 6), C.mustard, p(w * 0.18, h * 0.18, 0.035, { s: [1, 1, 0.3] }), { ao: false });
  } else if (art === 'portrait') {
    m.add(shapes.box(w - 0.09, h - 0.09, 0.02, 0.008, 1), a, p(0, 0, 0.03), { ao: false });
    m.add(shapes.sphere(w * 0.16, 8, 6), C.peach, p(0, h * 0.1, 0.035, { s: [1, 1.1, 0.3] }), { ao: false });
    m.add(shapes.sphere(w * 0.26, 8, 6), C.navy, p(0, -h * 0.32, 0.035, { s: [1, 0.7, 0.3] }), { ao: false });
  } else if (art === 'flower') {
    m.add(shapes.box(w - 0.09, h - 0.09, 0.02, 0.008, 1), a, p(0, 0, 0.03), { ao: false });
    m.add(shapes.box(0.012, h * 0.4, 0.01, 0.008, 1), C.leafDeep, p(0, -h * 0.12, 0.04), { ao: false });
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      m.add(shapes.sphere(w * 0.07, 6, 4), C.rose, p(Math.cos(ang) * w * 0.08, h * 0.12 + Math.sin(ang) * w * 0.08, 0.04, { s: [1, 1, 0.3] }), { ao: false });
    }
    m.add(shapes.sphere(w * 0.05, 6, 4), C.mustard, p(0, h * 0.12, 0.045, { s: [1, 1, 0.3] }), { ao: false });
  }
}

/** A poster (bright print with a title band and a big shape). */
export function poster(r: Room, p: Put, w: number, h: number, bg: ColorRepresentation, fg: ColorRepresentation, shape: 'circle' | 'star' | 'mountain' | 'phone' | 'stripes' = 'circle'): void {
  const m = r.shell;
  m.add(shapes.box(w, h, 0.015, 0.008, 1), bg, p(0, 0, 0.008), { ao: false });
  m.add(shapes.box(w * 0.8, h * 0.1, 0.01, 0.008, 1), C.white, p(0, h * 0.34, 0.016), { ao: false });
  m.add(shapes.box(w * 0.5, h * 0.05, 0.01, 0.008, 1), fg, p(0, -h * 0.38, 0.016), { ao: false });
  if (shape === 'circle') m.add(shapes.cyl(w * 0.26, w * 0.26, 0.01, 16), fg, p(0, -h * 0.02, 0.016, { rx: Math.PI / 2 }), { ao: false });
  else if (shape === 'mountain') {
    m.add(shapes.cone(w * 0.3, h * 0.36, 4), fg, p(-w * 0.1, -h * 0.08, 0.012, { s: [1, 1, 0.08] }), { ao: false });
    m.add(shapes.cone(w * 0.22, h * 0.26, 4), C.white, p(w * 0.16, -h * 0.13, 0.016, { s: [1, 1, 0.08] }), { ao: false });
  } else if (shape === 'star') {
    for (let i = 0; i < 5; i++) m.add(shapes.cone(w * 0.08, w * 0.3, 3), fg, p(0, 0, 0.016, { rz: (i / 5) * Math.PI * 2, s: [1, 1, 0.1] }), { ao: false });
  } else if (shape === 'phone') {
    m.add(shapes.box(w * 0.34, h * 0.48, 0.012, 0.02, 1), C.navy, p(0, -h * 0.03, 0.016), { ao: false });
    m.add(shapes.box(w * 0.28, h * 0.4, 0.012, 0.008, 1), fg, p(0, -h * 0.03, 0.022), { ao: false });
  } else {
    for (let i = 0; i < 3; i++) m.add(shapes.box(w * 0.7, h * 0.06, 0.01, 0.008, 1), fg, p(0, h * 0.12 - i * h * 0.14, 0.016), { ao: false });
  }
}

/** A wall clock with hands that turn (`speed`: how many times faster than real time). */
export function wallClock(r: Room, p: Put, radius: number, rim: ColorRepresentation = C.woodDark, speed = 60): void {
  const m = r.shell;
  m.add(shapes.cyl(radius, radius, 0.05, 20), rim, p(0, 0, 0.025, { rx: Math.PI / 2 }), { ao: false });
  m.add(shapes.cyl(radius * 0.86, radius * 0.86, 0.054, 20), C.white, p(0, 0, 0.03, { rx: Math.PI / 2 }), { ao: false });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    m.add(shapes.box(i % 3 ? 0.012 : 0.02, i % 3 ? 0.03 : 0.05, 0.01, 0.008, 1), C.navy, p(Math.sin(a) * radius * 0.7, Math.cos(a) * radius * 0.7, 0.06, { rz: -a }), { ao: false });
  }
  const at = p(0, 0, 0.065);
  const g = new Group();
  g.position.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
  g.rotation.y = at.ry ?? 0;
  r.root.add(g);
  const hour = r.moving((mm) => mm.add(shapes.box(0.022, radius * 0.5, 0.012, 0.008, 1), C.navy, { y: radius * 0.22 }, { ao: false }), g);
  const minute = r.moving((mm) => {
    mm.add(shapes.box(0.014, radius * 0.72, 0.012, 0.008, 1), C.navy, { y: radius * 0.32, z: 0.008 }, { ao: false });
    mm.add(shapes.sphere(0.02, 6, 4), C.red, { z: 0.014 }, { ao: false });
  }, g);
  const t0 = 10.2 * 3600;
  r.life.push((t) => {
    const s = t0 + t * speed;
    minute.rotation.z = -((s / 3600) % 1) * Math.PI * 2;
    hour.rotation.z = -((s / 43200) % 1) * Math.PI * 2;
  });
}

/** A ceiling fan on a rod from the top of the wall at (x, z): blades turn. */
export function ceilingFan(r: Room, x: number, z: number, y: number): void {
  const g = new Group();
  g.position.set(x, y, z);
  r.root.add(g);
  r.shell.add(shapes.cyl(0.012, 0.012, r.H + 0.3 - y, 6), C.metal, { x, y: y + (r.H + 0.3 - y) / 2, z }, { ao: false });
  r.furn.add(shapes.cyl(0.06, 0.07, 0.07, 10), C.woodDark, { x, y, z }, { ao: false });
  r.bulbs.add(shapes.sphere(0.05, 8, 6), C.glow, { x, y: y - 0.06, z });
  const blades = r.moving((m) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      m.add(shapes.box(0.36, 0.012, 0.08, 0.006, 1), C.wood, { x: Math.cos(a) * 0.22, z: -Math.sin(a) * 0.22, ry: a, rx: 0.12 }, { ao: false });
    }
  }, g, true);
  r.life.push((_t, dt) => {
    blades.rotation.y += dt * 2.2;
  });
}

// ───────────────────────── finishing ─────────────────────────

/** A soft round glow texture (made in code: no canvas, works in node). */
function glowTexture(): DataTexture {
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const dx = (i + 0.5) / n - 0.5;
      const dy = (j + 0.5) / n - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const a = Math.pow(1 - d, 2.2);
      const o = (j * n + i) * 4;
      data[o] = 255;
      data[o + 1] = 214;
      data[o + 2] = 150;
      data[o + 3] = Math.round(a * 255);
    }
  const t = new DataTexture(data, n, n, RGBAFormat);
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

const GLASS_DAY = new Color('#cfe9fb');
const GLASS_NIGHT = new Color('#24305f');

/** What a recipe hands back: who is where and how the camera sees them. */
export interface Cast {
  host: RoomAnchor;
  guest: RoomAnchor;
  visitor: RoomAnchor;
  extras: RoomAnchor[];
  /** The conversation shots (see twoShot). */
  shot: RoomShot;
  shotTall: RoomShot;
  /** Where the key light comes from (default: from the open side, high, a little from the right). */
  key?: [number, number, number];
  /** Day / night light amounts of the room (1 = default). */
  fill?: number;
}

const rigColor = new Color();

export function finish(r: Room, cast: Cast, t0: number): RoomSet {
  const root = r.root;
  const add = (g: BufferGeometry | null, m: Material, cast_: boolean, receive: boolean, name: string) => {
    if (!g) return null;
    r.geo(g);
    const mesh = new Mesh(g, m);
    mesh.name = name;
    mesh.castShadow = cast_;
    mesh.receiveShadow = receive;
    root.add(mesh);
    return mesh;
  };
  const glassMat = r.mat(new MeshStandardMaterial({ color: GLASS_DAY, roughness: 0.2, metalness: 0, emissive: '#e8f6ff', emissiveIntensity: 0.55 }));
  const bulbMat = r.mat(new MeshStandardMaterial({ color: '#fff4d6', emissive: C.glow, emissiveIntensity: 0.3, roughness: 0.4 }));
  const screenMat = r.mat(new MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.3 }));
  const swayMat = r.mat(new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
  add(r.shell.build(), r.std, false, true, 'shell');
  add(r.furn.build(), r.std, true, true, 'furniture');
  add(r.glass.build(), glassMat, false, false, 'glass');
  add(r.bulbs.build(), bulbMat, false, false, 'bulbs');
  const screens = add(r.screens.build(), screenMat, false, false, 'screens');
  const swayMesh = add(r.sway.build(), swayMat, true, true, 'sway');
  if (swayMesh) {
    r.life.push((t) => {
      swayMesh.rotation.z = Math.sin(t * 0.9) * 0.004;
      swayMesh.position.y = Math.sin(t * 1.3) * 0.004;
    });
  }

  // the backdrop: a soft dome round the room (warm by day, deep blue at night)
  const domeGeo = r.geo(new SphereGeometry(40, 24, 12));
  const dcol: number[] = [];
  const P = domeGeo.getAttribute('position');
  for (let i = 0; i < P.count; i++) {
    const k = Math.max(0, Math.min(1, P.getY(i) / 40 + 0.5));
    dcol.push(0.82 + 0.18 * k, 0.82 + 0.18 * k, 0.82 + 0.18 * k);
  }
  domeGeo.setAttribute('color', new Float32BufferAttribute(dcol, 3));
  const domeMat = r.mat(new MeshBasicMaterial({ color: r.backdrop.day, vertexColors: true, side: BackSide, depthWrite: false, fog: false }));
  const dome = new Mesh(domeGeo, domeMat);
  dome.name = 'backdrop';
  dome.renderOrder = -10;
  root.add(dome);
  // the ground the room stands on (a soft disc under the slab)
  const discGeo = r.geo(new SphereGeometry(1, 32, 6, 0, Math.PI * 2, 0, Math.PI / 2));
  const discMat = r.mat(new MeshBasicMaterial({ color: r.backdrop.groundDay, fog: false }));
  const disc = new Mesh(discGeo, discMat);
  disc.scale.set(18, 0.01, 18);
  disc.position.y = -0.21;
  root.add(disc);

  // steam: small puffs rising and fading (scaled down) over each source
  const PUFFS = 3;
  let steamMesh: InstancedMesh | null = null;
  if (r.steam.length) {
    const sg = r.geo(new SphereGeometry(1, 8, 6));
    const sm = r.mat(new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }));
    steamMesh = new InstancedMesh(sg, sm, r.steam.length * PUFFS);
    steamMesh.name = 'steam';
    root.add(steamMesh);
    const dummy = new Object3D();
    const sm_ = steamMesh;
    const tick = (t: number) => {
      r.steam.forEach(([x, y, z], i) => {
        for (let k = 0; k < PUFFS; k++) {
          const ph = (t * 0.45 + k / PUFFS + i * 0.37) % 1;
          const s = Math.sin(ph * Math.PI) * 0.022 * (0.6 + ph);
          dummy.position.set(x + Math.sin(ph * 6 + i) * 0.015, y + ph * 0.22, z + Math.cos(ph * 5 + k) * 0.01);
          dummy.scale.setScalar(Math.max(0.0001, s));
          dummy.updateMatrix();
          sm_.setMatrixAt(i * PUFFS + k, dummy.matrix);
        }
      });
      sm_.instanceMatrix.needsUpdate = true;
    };
    tick(0);
    r.life.push(tick);
  }

  // glow round the bulbs at night: small ones (string lights, candles) and big ones (lamps), one draw each
  const haloMats: PointsMaterial[] = [];
  if (r.halos.length) {
    const tex = glowTexture();
    for (const [small, size] of [
      [true, 0.4],
      [false, 0.95],
    ] as const) {
      const list = r.halos.filter((h) => h[3] < 0.6 === small);
      if (!list.length) continue;
      const hg = r.geo(new BufferGeometry());
      hg.setAttribute('position', new Float32BufferAttribute(list.flatMap(([x, y, z]) => [x, y, z]), 3));
      const mat = r.mat(new PointsMaterial({ map: tex, size, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, color: '#ffffff' }));
      haloMats.push(mat);
      const halos = new Points(hg, mat);
      halos.name = 'halos';
      halos.renderOrder = 5;
      root.add(halos);
    }
    // the texture is shared by both: dispose it once
    r.disposers.push(() => tex.dispose());
  }

  // the light rig
  const fill = cast.fill ?? 1;
  // the same people look the same in a room as in the town (owner, 2026-11-25: "sao mỗi chỗ model mỗi kiểu vậy?"):
  // a near-neutral fill and a key no stronger than the town's sun, so black hair stays black and brown stays brown
  // (a warm cream fill at 1.3 with exposure 1 washed them out to grey and orange under ACES)
  const hemi = new HemisphereLight(ROOM_SKY, ROOM_GROUND, 1.5);
  root.add(hemi);
  const key = new DirectionalLight('#fff1d8', 2.2);
  const [kx, ky, kz] = cast.key ?? [r.W * 0.35, 4.2, r.D * 0.9 + 1.5];
  key.position.set(kx, ky, kz);
  key.target.position.set(-0.4, 0, -0.4);
  root.add(key, key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const ext = Math.max(r.W, r.D) * 0.75 + 0.5;
  const sc = key.shadow.camera;
  sc.left = -ext;
  sc.right = ext;
  sc.top = ext;
  sc.bottom = -ext;
  sc.near = 0.5;
  sc.far = 16;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  const lamps: PointLight[] = [];
  for (let i = 0; i < 2; i++) {
    const at = r.lamps[i] ?? [i ? r.W * 0.2 : -r.W * 0.25, r.H * 0.8, -r.D * 0.15];
    // a soft warm white, not amber: an amber bulb next to the people dyed brown hair orange and blue jeans grey
    const l = new PointLight('#ffe4c4', 0, 4.8, 1.2);
    l.position.set(at[0], at[1], at[2]);
    root.add(l);
    lamps.push(l);
  }

  const base = [0, 0];
  const SKY_DAY = new Color(r.backdrop.day);
  const SKY_NIGHT = new Color(r.backdrop.night);
  const GROUND_DAY = new Color(r.backdrop.groundDay);
  const GROUND_NIGHT = new Color(r.backdrop.groundNight);
  const background = SKY_DAY.clone();
  let night = 0;
  const setNight = (k0: number) => {
    const k = Math.max(0, Math.min(1, k0));
    night = k;
    // night: dark windows and a dimmer, warmer room lit by its own lamps (the key turns into their spill, never black)
    hemi.color.set(ROOM_SKY).lerp(rigColor.set('#9d94cf'), k);
    hemi.groundColor.set(ROOM_GROUND).lerp(rigColor.set('#7a5a52'), k);
    hemi.intensity = (1.05 - 0.5 * k) * fill;
    key.color.set('#fff4e4').lerp(rigColor.set('#ffe0bd'), k);
    key.intensity = (2.3 - 1.4 * k) * fill;
    const lampK = Math.max(0, Math.min(1, (k - 0.2) / 0.6));
    lamps.forEach((l, i) => {
      base[i] = r.flicker?.lamp === i ? r.flicker.day + (LAMP_NIGHT - r.flicker.day) * lampK : 0.15 + LAMP_NIGHT * lampK;
      l.intensity = base[i];
    });
    glassMat.color.copy(GLASS_DAY).lerp(GLASS_NIGHT, k);
    glassMat.emissive.set('#e8f6ff').lerp(rigColor.set('#2a3a78'), k);
    glassMat.emissiveIntensity = 0.55 - 0.35 * k;
    bulbMat.emissiveIntensity = 0.3 + 2.6 * lampK;
    for (const m of haloMats) m.opacity = 0.7 * lampK;
    domeMat.color.copy(SKY_DAY).lerp(SKY_NIGHT, k);
    discMat.color.copy(GROUND_DAY).lerp(GROUND_NIGHT, k);
    background.copy(SKY_DAY).lerp(SKY_NIGHT, k);
    for (const h of r.nightHooks) h(k);
  };
  setNight(0);

  let t = 0;
  const update = (dt: number) => {
    const d = Math.max(0, Math.min(0.1, dt));
    t += d;
    if (screens) screenMat.emissiveIntensity = 0.35 + 0.25 * night + 0.05 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
    for (const f of r.life) f(t, d);
    if (r.flicker) {
      const i = r.flicker.lamp;
      lamps[i].intensity = base[i] * (0.82 + 0.12 * Math.sin(t * 11.3) * Math.sin(t * 3.7 + 1) + 0.06 * Math.sin(t * 23.1));
    }
  };
  update(0);

  let triangles = 0;
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || mesh === dome || mesh === disc) return;
    const g = mesh.geometry;
    const n = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
    triangles += n * ((mesh as InstancedMesh).isInstancedMesh ? (mesh as InstancedMesh).count : 1);
  });
  let meshCount = 0;
  root.traverse((o) => {
    if ((o as Mesh).isMesh || (o as Points).isPoints) meshCount++;
  });

  return {
    id: r.id,
    root,
    host: cast.host,
    guest: cast.guest,
    visitor: cast.visitor,
    extras: cast.extras,
    shot: cast.shot,
    shotTall: cast.shotTall,
    size: { W: r.W, D: r.D, H: r.H },
    blocks: r.blocks,
    seats: r.seats,
    background,
    stats: { triangles, meshes: meshCount, buildMs: performance.now() - t0 },
    setNight,
    update,
    dispose: () => {
      root.removeFromParent();
      for (const g of r.geometries) g.dispose();
      for (const m of r.materials) m.dispose();
      for (const d of r.disposers) d();
      key.shadow.map?.dispose();
      key.dispose();
      hemi.dispose();
      for (const l of lamps) l.dispose();
    },
  };
}

// ───────────────────────── people and shots ─────────────────────────

/** An anchor at (x, z) facing (tx, tz), turned `cheat` radians towards the camera at (cx, cz) (actors "open up"). */
export function facing(x: number, z: number, tx: number, tz: number, cam: [number, number] | null, cheat: number, pose: RoomAnchor['pose'] = 'stand'): RoomAnchor {
  let h = Math.atan2(tz - z, tx - x);
  if (cam && cheat) {
    const toCam = Math.atan2(cam[1] - z, cam[0] - x);
    let d = toCam - h;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    h += Math.sign(d) * Math.min(Math.abs(d), cheat);
  }
  return { x, z, heading: h, pose };
}

/** A shot of a point from `yaw` (radians from +X towards +Z, where the camera stands), `pitch` down, `dist` away. */
export function shotOf(target: [number, number, number], yaw: number, pitch: number, dist: number, fov: number): RoomShot {
  const cp = Math.cos(pitch);
  return {
    position: [target[0] + Math.cos(yaw) * cp * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.sin(yaw) * cp * dist],
    target,
    fov,
  };
}

/** Eye-ish height of the two-shot's target: between the chest and the face of a grown-up. */
export const SHOT_Y = 0.5;

export interface TwoShotOpts {
  yaw?: number;
  pitch?: number;
  dist?: number;
  fov?: number;
  tallYaw?: number;
  tallPitch?: number;
  tallDist?: number;
  tallFov?: number;
  y?: number;
}

/** The wide and tall shots of a host and a guest: both look at their midpoint. */
export function twoShot(host: { x: number; z: number }, guest: { x: number; z: number }, o: TwoShotOpts = {}): { shot: RoomShot; shotTall: RoomShot } {
  const mid: [number, number, number] = [(host.x + guest.x) / 2, o.y ?? SHOT_Y, (host.z + guest.z) / 2];
  const dx = guest.x - host.x;
  const dz = guest.z - host.z;
  const yaw = o.yaw ?? 1.25;
  const tallYaw = o.tallYaw ?? 0.8;
  const fov = o.fov ?? 32;
  const tallFov = o.tallFov ?? 40;
  // far enough that both people (and some room round them) fit the frame's width
  const wide = Math.max(o.dist ?? 3.5, fitDistance(dx, dz, yaw, fov, WIDE_ASPECT, 1.1));
  const tall = o.tallDist ?? Math.max(2.4, fitDistance(dx, dz, tallYaw, tallFov, TALL_ASPECT, 0.26));
  return {
    shot: shotOf(mid, yaw, o.pitch ?? 0.2, wide, fov),
    shotTall: shotOf([mid[0], mid[1] + 0.02, mid[2]], tallYaw, o.tallPitch ?? 0.18, tall, tallFov),
  };
}

/** The aspects the shots are made for: a wide stage (16:9) and a phone's tall one (as narrow as 0.56). */
export const WIDE_ASPECT = 16 / 9;
export const TALL_ASPECT = 0.56;

/** How far a camera at `yaw` must stand for two people (dx, dz apart) plus `margin` each side to fit the width. */
export function fitDistance(dx: number, dz: number, yaw: number, fovDeg: number, aspect: number, margin: number): number {
  const sep = Math.abs(dx * Math.sin(yaw) - dz * Math.cos(yaw));
  const half = Math.atan(Math.tan((fovDeg * Math.PI) / 360) * aspect);
  return (sep / 2 + margin) / Math.tan(half);
}

/** Where a shot's camera stands on the ground (for cheating actors towards it). */
export function camXZ(s: RoomShot): [number, number] {
  return [s.position[0], s.position[2]];
}

export type { Paint, Place };

/** Who stands where, with the shots worked out: host and guest face each other, opened a little to the camera. */
export function people(
  host: { x: number; z: number },
  guest: { x: number; z: number },
  visitor: { x: number; z: number },
  extras: RoomAnchor[],
  o: TwoShotOpts & { hostPose?: RoomAnchor['pose']; cheat?: number; key?: [number, number, number]; fill?: number; upstage?: number } = {},
): Cast {
  // the guest stands a little upstage (further from the camera), so they look at the host with their face half towards it
  guest = { x: guest.x, z: guest.z - (o.upstage ?? 0.35) };
  const { shot, shotTall } = twoShot(host, guest, o);
  const cam = camXZ(shot);
  const cheat = o.cheat ?? 0.6;
  const mid = { x: (host.x + guest.x) / 2, z: (host.z + guest.z) / 2 };
  return {
    host: facing(host.x, host.z, guest.x, guest.z, cam, cheat, o.hostPose ?? 'stand'),
    guest: facing(guest.x, guest.z, host.x, host.z, cam, cheat + 0.2),
    visitor: facing(visitor.x, visitor.z, mid.x, mid.z, cam, 0.35),
    extras,
    shot,
    shotTall,
    key: o.key,
    fill: o.fill,
  };
}
