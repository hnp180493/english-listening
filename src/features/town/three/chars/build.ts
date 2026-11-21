// Geometry kit for code-built people, pets, hats and props: soft primitives merged into ONE indexed geometry with
// vertex colours (one shared material for everybody) and, for skinned bodies, a rigid bone per part.
// Works in node (no DOM), so the builders are unit-tested.

import {
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  Matrix3,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';

export type Vec3 = readonly [number, number, number];

export interface PartOptions {
  /** Bone index (skinned bodies; ignored for plain meshes). */
  bone?: number;
  /** A named slot (e.g. 'top') so its colours can be changed later. */
  slot?: string;
  /** Shade the part a little darker toward its bottom (soft fake occlusion): 0 = flat. */
  shade?: number;
  /** Per-vertex colour override (position in final space, normal) → colour; return null to keep the part colour. */
  paint?: (p: Vector3, n: Vector3) => Color | null;
}

const tmpColor = new Color();
const tmpP = new Vector3();
const tmpN = new Vector3();

/** Linear-space colour of a CSS hex (three's ColorManagement converts sRGB hex to linear). */
export function color(hex: string): Color {
  return new Color(hex);
}

export class GeoBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private bones: number[] = [];
  private idx: number[] = [];
  private uvs: number[] = [];
  readonly slots = new Map<string, Array<[number, number]>>();
  /** Raise every part bound to a bone by this much (design units): a body built at one height, its legs longer. */
  lift: ((bone: number) => number) | null = null;

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /** Add a geometry transformed by `m`, coloured `c`. The source geometry is not changed (and is disposed). */
  add(geo: BufferGeometry, m: Matrix4, c: Color | string, opts: PartOptions = {}): this {
    const g = geo;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const nm = new Matrix3().getNormalMatrix(m);
    const base = this.vertexCount;
    const col = typeof c === 'string' ? color(c) : c;
    let minY = Infinity;
    let maxY = -Infinity;
    const start = this.pos.length;
    const up = this.lift ? this.lift(opts.bone ?? 0) : 0;
    for (let i = 0; i < p.count; i++) {
      tmpP.fromBufferAttribute(p, i).applyMatrix4(m);
      tmpP.y += up;
      this.pos.push(tmpP.x, tmpP.y, tmpP.z);
      if (tmpP.y < minY) minY = tmpP.y;
      if (tmpP.y > maxY) maxY = tmpP.y;
      if (n) tmpN.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      else tmpN.set(0, 1, 0);
      this.nor.push(tmpN.x, tmpN.y, tmpN.z);
      this.uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    const shade = opts.shade ?? 0;
    for (let i = 0; i < p.count; i++) {
      const y = this.pos[start + i * 3 + 1];
      let cc: Color = col;
      if (opts.paint) {
        tmpP.set(this.pos[start + i * 3], y, this.pos[start + i * 3 + 2]);
        tmpN.set(this.nor[start + i * 3], this.nor[start + i * 3 + 1], this.nor[start + i * 3 + 2]);
        cc = opts.paint(tmpP, tmpN) ?? col;
      }
      const k = shade > 0 && maxY > minY ? 1 - shade * (1 - (y - minY) / (maxY - minY)) : 1;
      tmpColor.copy(cc).multiplyScalar(k);
      this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
      this.bones.push(opts.bone ?? 0);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    if (opts.slot) {
      const list = this.slots.get(opts.slot) ?? [];
      list.push([base, p.count]);
      this.slots.set(opts.slot, list);
    }
    geo.dispose();
    return this;
  }

  /** The merged geometry: position, normal, color, uv, and (skinned) skinIndex / skinWeight. */
  build(skinned = false): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    if (skinned) {
      const n = this.vertexCount;
      const si = new Uint16Array(n * 4);
      const sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        si[i * 4] = this.bones[i];
        sw[i * 4] = 1;
      }
      g.setAttribute('skinIndex', new BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new BufferAttribute(sw, 4));
    }
    const n = this.vertexCount;
    g.setIndex(n > 65535 ? new BufferAttribute(new Uint32Array(this.idx), 1) : new BufferAttribute(new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// ───────────────────────── transforms ─────────────────────────

const q = new Quaternion();
const e = new Euler();
const s = new Vector3();
const t = new Vector3();

/** Matrix from translation, Euler rotation (radians, XYZ) and scale. */
export function mat(pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scale: Vec3 | number = 1): Matrix4 {
  e.set(rot[0], rot[1], rot[2]);
  q.setFromEuler(e);
  if (typeof scale === 'number') s.set(scale, scale, scale);
  else s.set(scale[0], scale[1], scale[2]);
  t.set(pos[0], pos[1], pos[2]);
  return new Matrix4().compose(t, q, s);
}

/** Matrix that takes the +Y axis to the direction from a to b, placed at a (for limbs). */
export function along(a: Vec3, b: Vec3): { m: Matrix4; length: number } {
  const dir = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const length = dir.length();
  dir.normalize();
  const qq = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  const mid = new Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return { m: new Matrix4().compose(mid, qq, new Vector3(1, 1, 1)), length };
}

// ───────────────────────── soft primitives ─────────────────────────

/** Detail: 1 = full (portraits, the cast), lower for passers-by and far things. */
export interface Detail {
  seg: number;
}
export const FULL: Detail = { seg: 1 };

export function sphere(r: number, d: Detail = FULL, w = 18, h = 12): BufferGeometry {
  return new SphereGeometry(r, Math.max(8, Math.round(w * d.seg)), Math.max(6, Math.round(h * d.seg)));
}

/** A capsule between two points (rounded limb). */
export function capsuleBetween(b: GeoBuilder, a: Vec3, z: Vec3, r: number, c: Color | string, opts: PartOptions = {}, d: Detail = FULL): void {
  const { m, length } = along(a, z);
  b.add(new CapsuleGeometry(r, Math.max(0.0001, length), Math.max(3, Math.round(4 * d.seg)), Math.max(8, Math.round(12 * d.seg))), m, c, opts);
}

/** Tapered rounded limb: a lathe from radius r1 (at a) to r2 (at z) with round ends. */
export function taperBetween(b: GeoBuilder, a: Vec3, z: Vec3, r1: number, r2: number, c: Color | string, opts: PartOptions = {}, d: Detail = FULL): void {
  const { m, length } = along(a, z);
  const pts: Vector2[] = [];
  const half = length / 2;
  const steps = 5;
  // bottom cap (at z = -half)
  for (let i = 0; i <= steps; i++) {
    const a1 = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push(new Vector2(Math.cos(a1) * r1, -half + Math.sin(a1) * r1));
  }
  for (let i = 0; i <= steps; i++) {
    const a1 = (i / steps) * (Math.PI / 2);
    pts.push(new Vector2(Math.cos(a1) * r2, half + Math.sin(a1) * r2));
  }
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  b.add(new LatheGeometry(pts, Math.max(8, Math.round(12 * d.seg))), m, c, opts);
}

/** A lathe (profile of [radius, y] pairs) around Y, then scaled/placed by m. */
export function lathe(profile: ReadonlyArray<readonly [number, number]>, segments: number, phiStart = 0, phiLength = Math.PI * 2): BufferGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(0, r), y)),
    segments,
    phiStart,
    phiLength,
  );
}

/** A smooth profile through control points (Catmull-Rom-ish), for bodies, hats, cups. */
export function smoothProfile(points: ReadonlyArray<readonly [number, number]>, per = 4): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const u = k / per;
      const u2 = u * u;
      const u3 = u2 * u;
      const f = (a: number, b2: number, c2: number, d2: number) => 0.5 * (2 * b2 + (-a + c2) * u + (2 * a - 5 * b2 + 4 * c2 - d2) * u2 + (-a + 3 * b2 - 3 * c2 + d2) * u3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push([points[points.length - 1][0], points[points.length - 1][1]]);
  return out;
}

export function torus(r: number, tube: number, d: Detail = FULL, arc = Math.PI * 2): BufferGeometry {
  return new TorusGeometry(r, tube, Math.max(5, Math.round(8 * d.seg)), Math.max(12, Math.round(28 * d.seg)), arc);
}

export function cylinder(rTop: number, rBottom: number, h: number, d: Detail = FULL, open = false): BufferGeometry {
  return new CylinderGeometry(rTop, rBottom, h, Math.max(8, Math.round(16 * d.seg)), 1, open);
}

/** A rounded box: a sphere squashed into a box shape (superellipse) — soft cushions, books, bags. */
export function roundBox(w: number, h: number, dpt: number, round = 0.35, d: Detail = FULL): BufferGeometry {
  const g = new SphereGeometry(1, Math.max(12, Math.round(16 * d.seg)), Math.max(8, Math.round(12 * d.seg)));
  const p = g.getAttribute('position');
  const v = new Vector3();
  const ex = Math.max(0.08, round);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // push towards the box: sign(x)·|x|^ex
    const f = (x: number) => Math.sign(x) * Math.pow(Math.abs(x), ex);
    p.setXYZ(i, (f(v.x) * w) / 2, (f(v.y) * h) / 2, (f(v.z) * dpt) / 2);
  }
  g.computeVertexNormals();
  return g;
}

// ───────────────────────── shells (hair, caps, beards) ─────────────────────────

export interface ShellSpec {
  /** Columns around (phi), rows from top to edge. */
  cols: number;
  rows: number;
  /** Polar angle (from +Y) where the shell starts at this phi (0 = the crown). */
  thetaMin?: (phi: number) => number;
  /** Polar angle where the shell ends at this phi (the hairline / edge). */
  thetaMax: (phi: number) => number;
  /** Radius at a point (theta, phi, t = 0 at thetaMin … 1 at the edge). */
  radius: (theta: number, phi: number, t: number) => number;
  /** Phi range (default the whole way round); phi = 0 is the front (+Z), + toward +X. */
  phiMin?: number;
  phiMax?: number;
}

/** Direction for (theta from +Y, phi from +Z toward +X). */
export function dir(theta: number, phi: number, out = new Vector3()): Vector3 {
  return out.set(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
}

/**
 * A shell around a centre whose edge follows any curve: each column runs from thetaMin(phi) to thetaMax(phi), so a
 * fringe, side-swept bangs or a nape are just functions. Normals point outward (from the radius gradient).
 */
export function shell(spec: ShellSpec): BufferGeometry {
  const { cols, rows } = spec;
  const pMin = spec.phiMin ?? -Math.PI;
  const pMax = spec.phiMax ?? Math.PI;
  const full = spec.phiMin === undefined && spec.phiMax === undefined;
  const nCols = full ? cols : cols + 1;
  const pos: number[] = [];
  const idx: number[] = [];
  const uv: number[] = [];
  const v = new Vector3();
  for (let c = 0; c < nCols; c++) {
    const phi = pMin + ((pMax - pMin) * c) / cols;
    const t0 = spec.thetaMin ? spec.thetaMin(phi) : 0;
    const t1 = spec.thetaMax(phi);
    for (let r = 0; r <= rows; r++) {
      const k = r / rows;
      const th = t0 + (t1 - t0) * k;
      const rad = spec.radius(th, phi, k);
      dir(th, phi, v).multiplyScalar(rad);
      pos.push(v.x, v.y, v.z);
      uv.push(c / cols, 1 - k);
    }
  }
  const stride = rows + 1;
  for (let c = 0; c < cols; c++) {
    const c2 = full ? (c + 1) % nCols : c + 1;
    for (let r = 0; r < rows; r++) {
      const a = c * stride + r;
      const b = c2 * stride + r;
      // winding: outward facing
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // outward check: flip the winding if the normals point inward
  const n = g.getAttribute('normal');
  const p = g.getAttribute('position');
  let dot = 0;
  for (let i = 0; i < p.count; i += 7) dot += p.getX(i) * n.getX(i) + p.getY(i) * n.getY(i) + p.getZ(i) * n.getZ(i);
  if (dot < 0) {
    const ix = g.index as BufferAttribute;
    for (let i = 0; i < ix.count; i += 3) {
      const a = ix.getX(i + 1);
      ix.setX(i + 1, ix.getX(i + 2));
      ix.setX(i + 2, a);
    }
    g.computeVertexNormals();
  }
  if (full && !spec.thetaMin) smoothSeam(g, cols, rows);
  return g;
}

/** The last column joins the first: their normals are averaged so no seam shows. */
function smoothSeam(g: BufferGeometry, _cols: number, rows: number): void {
  // with a full shell the columns wrap through indices, so computeVertexNormals already averages across the seam;
  // only the crown (row 0, where every column meets) needs one shared normal
  const n = g.getAttribute('normal') as BufferAttribute;
  const stride = rows + 1;
  const count = n.count / stride;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let c = 0; c < count; c++) {
    x += n.getX(c * stride);
    y += n.getY(c * stride);
    z += n.getZ(c * stride);
  }
  const l = Math.hypot(x, y, z) || 1;
  for (let c = 0; c < count; c++) n.setXYZ(c * stride, x / l, y / l, z / l);
}

/** Smooth bump function: 1 at 0, 0 at |x| ≥ w. */
export function bump(x: number, w: number): number {
  const k = Math.min(1, Math.abs(x) / w);
  return 1 - k * k * (3 - 2 * k);
}
