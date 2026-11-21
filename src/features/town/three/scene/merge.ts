// Static geometry of the 3D town is built from simple rounded shapes and merged: every piece is transformed into
// place and painted with a vertex colour, and all the pieces of one thing (a house, a chunk of ground, a lamp)
// become ONE geometry drawn with one shared material. A town of thousands of pieces costs a few dozen draw calls.

import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, Float32BufferAttribute, IcosahedronGeometry, Matrix3, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3, type ColorRepresentation } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface Place {
  x?: number;
  y?: number;
  z?: number;
  /** Rotation (radians) about X, Y, Z. */
  rx?: number;
  ry?: number;
  rz?: number;
  /** Scale (one number = the same every way). */
  s?: number | [number, number, number];
}

export interface Paint {
  /** A second colour for faces looking up (a block of grass: green on top, earth on the sides). */
  top?: ColorRepresentation;
  /** Darken the paint near the ground (soft contact shade; on by default). */
  ao?: boolean;
  /** Lighten (+) or darken (−) the colour a little, −1..1. */
  shade?: number;
}

const cache = new Map<string, BufferGeometry>();

/** A shape, made once per size and kept without an index (merged as triangles). */
function shape(key: string, make: () => BufferGeometry, flat = false): BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    const made = make();
    g = made.index ? made.toNonIndexed() : made;
    if (made !== g) made.dispose();
    g.deleteAttribute('uv');
    if (flat || !g.getAttribute('normal')) g.computeVertexNormals();
    cache.set(key, g);
  }
  return g;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export const shapes = {
  /** A box with rounded edges, centred on the origin. */
  box: (w: number, h: number, d: number, radius = 0.04, seg = 2) => {
    const rr = Math.max(0.001, Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    return shape(`b${r3(w)},${r3(h)},${r3(d)},${r3(rr)},${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, rr));
  },
  /** A cylinder standing on its middle (y from −h/2 to h/2). */
  cyl: (rTop: number, rBottom: number, h: number, seg = 12) => shape(`c${r3(rTop)},${r3(rBottom)},${r3(h)},${seg}`, () => new CylinderGeometry(rTop, rBottom, h, seg)),
  cone: (r: number, h: number, seg = 12) => shape(`k${r3(r)},${r3(h)},${seg}`, () => new ConeGeometry(r, h, seg)),
  sphere: (r: number, ws = 14, hs = 10) => shape(`s${r3(r)},${ws},${hs}`, () => new SphereGeometry(r, ws, hs)),
  /** A half sphere, its flat side down at y = 0. */
  dome: (r: number, ws = 16, hs = 8) => shape(`d${r3(r)},${ws},${hs}`, () => new SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2)),
  blob: (r: number, detail = 1) => shape(`i${r3(r)},${detail}`, () => new IcosahedronGeometry(r, detail)),
  torus: (r: number, tube: number, seg = 16) => shape(`t${r3(r)},${r3(tube)},${seg}`, () => new TorusGeometry(r, tube, 6, seg)),
  /** Any geometry under a key of its own. */
  custom: (key: string, make: () => BufferGeometry, flat = false) => shape(key, make, flat),
};

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpE = new Euler();
const tmpS = new Vector3();
const tmpP = new Vector3();

/** The matrix of a placement. */
export function placeMatrix(p: Place = {}, out = new Matrix4()): Matrix4 {
  tmpE.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0, 'YXZ');
  tmpQ.setFromEuler(tmpE);
  const s = p.s ?? 1;
  if (typeof s === 'number') tmpS.set(s, s, s);
  else tmpS.set(s[0], s[1], s[2]);
  tmpP.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  return out.compose(tmpP, tmpQ, tmpS);
}

const colA = new Color();
const colB = new Color();
const nm = new Matrix3();
const v = new Vector3();
const n = new Vector3();

/** Pieces gathered for one merged geometry. */
export class Merge {
  private pos: number[] = [];
  private norm: number[] = [];
  private col: number[] = [];
  /** Applied to every piece added (a house is built at its origin, then placed in the town). */
  base: Matrix4 | null = null;

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /** Add a shape, placed and painted. */
  add(geo: BufferGeometry, color: ColorRepresentation, p: Place = {}, paint: Paint = {}): this {
    const m = placeMatrix(p, tmpM);
    if (this.base) m.premultiply(this.base);
    nm.getNormalMatrix(m);
    colA.set(color);
    if (paint.shade) shadeColor(colA, paint.shade);
    const hasTop = paint.top !== undefined;
    if (hasTop) {
      colB.set(paint.top!);
      if (paint.shade) shadeColor(colB, paint.shade);
    }
    const ao = paint.ao !== false;
    const P = geo.getAttribute('position');
    const N = geo.getAttribute('normal');
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z);
      this.norm.push(n.x, n.y, n.z);
      const c = hasTop && n.y > 0.55 ? colB : colA;
      // a soft shade where things meet the ground
      const k = ao ? 0.78 + 0.22 * Math.min(1, Math.max(0, v.y / 0.45)) : 1;
      this.col.push(c.r * k, c.g * k, c.b * k);
    }
    return this;
  }

  /** Add a geometry that carries its own vertex colours (a tree built by another merge), placed. */
  addColored(geo: BufferGeometry, p: Place = {}): this {
    const m = placeMatrix(p, tmpM);
    if (this.base) m.premultiply(this.base);
    nm.getNormalMatrix(m);
    const P = geo.getAttribute('position');
    const N = geo.getAttribute('normal');
    const K = geo.getAttribute('color');
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z);
      this.norm.push(n.x, n.y, n.z);
      if (K) this.col.push(K.getX(i), K.getY(i), K.getZ(i));
      else this.col.push(1, 1, 1);
    }
    return this;
  }

  /** Add flat triangles given as corner points (scene units) with one colour; the normal from the winding. */
  tris(points: readonly number[], color: ColorRepresentation | Color, normal?: [number, number, number]): this {
    const c = color instanceof Color ? color : colA.set(color);
    for (let i = 0; i < points.length; i += 9) {
      let nx = 0;
      let ny = 1;
      let nz = 0;
      if (normal) [nx, ny, nz] = normal;
      else {
        const ax = points[i + 3] - points[i];
        const ay = points[i + 4] - points[i + 1];
        const az = points[i + 5] - points[i + 2];
        const bx = points[i + 6] - points[i];
        const by = points[i + 7] - points[i + 1];
        const bz = points[i + 8] - points[i + 2];
        nx = ay * bz - az * by;
        ny = az * bx - ax * bz;
        nz = ax * by - ay * bx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
      }
      for (let k = 0; k < 9; k += 3) {
        this.pos.push(points[i + k], points[i + k + 1], points[i + k + 2]);
        this.norm.push(nx, ny, nz);
        this.col.push(c.r, c.g, c.b);
      }
    }
    return this;
  }

  /**
   * One triangle with a colour per corner, turned so its face looks along `normal` (default: up), whichever order its
   * corners come in.
   */
  tri3(a: readonly [number, number, number], b: readonly [number, number, number], c: readonly [number, number, number], ca: Color, cb: Color, cc: Color, normal: readonly [number, number, number] = [0, 1, 0]): this {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const flip = (uy * vz - uz * vy) * normal[0] + (uz * vx - ux * vz) * normal[1] + (ux * vy - uy * vx) * normal[2] < 0;
    const P = flip ? [a, c, b] : [a, b, c];
    const K = flip ? [ca, cc, cb] : [ca, cb, cc];
    for (let i = 0; i < 3; i++) {
      this.pos.push(P[i][0], P[i][1], P[i][2]);
      this.norm.push(normal[0], normal[1], normal[2]);
      this.col.push(K[i].r, K[i].g, K[i].b);
    }
    return this;
  }

  /** A flat quad facing up at height y, corners (x0, z0)–(x1, z1), with a colour per corner (00, 10, 11, 01). */
  quadUp(x0: number, z0: number, x1: number, z1: number, y: number, c00: Color, c10: Color = c00, c11: Color = c00, c01: Color = c00): this {
    const P = [x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0];
    const C = [c00, c01, c11, c00, c11, c10];
    for (let i = 0; i < 6; i++) {
      this.pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      this.norm.push(0, 1, 0);
      this.col.push(C[i].r, C[i].g, C[i].b);
    }
    return this;
  }

  /**
   * A quad lying on a height field: the corners at `y + h(x, z)`, each with the field's own normal (a smooth slope,
   * no facets). Flat where the field is 0: the same as quadUp.
   */
  quadField(x0: number, z0: number, x1: number, z1: number, y: number, h: (x: number, z: number) => number, c00: Color, c10: Color = c00, c11: Color = c00, c01: Color = c00): this {
    const P = [x0, z0, x0, z1, x1, z1, x0, z0, x1, z1, x1, z0];
    const C = [c00, c01, c11, c00, c11, c10];
    const e = 0.02;
    for (let i = 0; i < 6; i++) {
      const x = P[i * 2];
      const z = P[i * 2 + 1];
      const hx = (h(x + e, z) - h(x - e, z)) / (2 * e);
      const hz = (h(x, z + e) - h(x, z - e)) / (2 * e);
      const l = Math.hypot(hx, 1, hz);
      this.pos.push(x, y + h(x, z), z);
      this.norm.push(-hx / l, 1 / l, -hz / l);
      this.col.push(C[i].r, C[i].g, C[i].b);
    }
    return this;
  }

  /** The merged geometry (null when nothing was added). */
  build(): BufferGeometry | null {
    if (this.pos.length === 0) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.norm, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Lighten (k > 0, towards a warm white) or darken (k < 0, towards a plum shade) a colour in place. */
export function shadeColor(c: Color, k: number): Color {
  if (k >= 0) return c.lerp(WARM_WHITE, Math.min(1, k));
  return c.lerp(PLUM, Math.min(1, -k));
}

const WARM_WHITE = new Color('#fffaf0');
const PLUM = new Color('#3a2a55');

/** Drop the cached shapes (the stage unmounted for good). */
export function disposeShapes(): void {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}
