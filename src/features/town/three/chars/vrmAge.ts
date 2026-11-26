// Older faces and beards on a VRoid avatar (owner, 2026-11-27, on Dr Osei's avatar beside his portrait: an old doctor
// with white hair and a white beard, a young anime man on the stage: "không làm model già đi được hả? không khớp
// avatar"). Every sample has a young face and the face MESH cannot change, but its texture and what is put on it can
// (who is how old: data/townVrm.ts VrmFace, read off the drawn portraits).
//
//  - `ageFace`: lines drawn on a canvas copy of the face's skin texture: forehead lines, the lines from the nose to the
//    mouth, then for 'old' crow's feet, bags under the eyes, hollow cheeks and lines down from the mouth's corners; and
//    stubble as a dotted shadow. Drawn as DARKER SKIN (multiplied), so they survive the skin's tint (vrmBody.ts paint
//    multiplies the material's colour) and still show on dark skin. One canvas texture per person, freed with the avatar.
//  - `beardMesh`: a beard or a moustache grown from the face itself: the face's own triangles under the nose (picked by
//    their place on the texture), pushed out along their normals, thinning to nothing at the edge, a full beard also
//    hanging below the chin. ONE mesh on the head bone, so it turns with the head; it does not follow the mouth's
//    shapes (a VRoid mouth opens by morph targets, the beard stays put round it).
//
// Where things are on the face texture: VRoid faces share one layout. Measured on the seven tintable bases and two
// residents' faces (base-m-jacket / -hoodie / -shirt, base-f-bob / -long / -tail / -buns, home, shop; 512 px, a 10 %
// grid laid over them, 2026-11-27): the eyes' middles at u 0.33 and 0.67, v 0.535 (± 0.02 from one sample to the
// next), the brows at v 0.47, the nose's tip at v 0.645, the mouth at v 0.755 from u 0.41 to 0.59, the chin's edge at
// v about 0.87, the jaw's sides at u 0.06 and 0.94. v is from the TOP of the image (a glTF texture is not flipped).

import { Box3, BufferAttribute, BufferGeometry, CanvasTexture, Matrix4, Mesh, MeshStandardMaterial, MeshToonMaterial, SphereGeometry, Vector3, type Material, type Object3D, type SkinnedMesh, type Texture } from 'three';
import type { VrmBeard, VrmFace } from '../../../../data/townVrm';

/** Feature places on a VRoid face texture, as fractions of its size (u from the left, v from the top). */
export const FACE_UV = {
  eyeL: { u: 0.33, v: 0.535 },
  eyeR: { u: 0.67, v: 0.535 },
  /** Half an eye's width. */
  eyeHalf: 0.07,
  brow: 0.47,
  nose: { u: 0.5, v: 0.645 },
  mouth: { u: 0.5, v: 0.757, half: 0.095, halfH: 0.022 },
  chin: 0.87,
} as const;

type Mtoon = Material & { map?: Texture | null; shadeMultiplyTexture?: Texture | null; name: string };

/** The face's skin material(s) of an avatar (VRoid names it `…Face_00_SKIN`). */
function faceSkins(scene: Object3D): { mesh: SkinnedMesh; material: Mtoon }[] {
  const out: { mesh: SkinnedMesh; material: Mtoon }[] = [];
  scene.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as Mtoon[]) if (/Face/.test(mat.name ?? '') && /_SKIN$/.test(mat.name ?? '')) out.push({ mesh: m, material: mat });
  });
  return out;
}

/** A stable random number in [0, 1) for a seed. */
function rand(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

/** Whether a point of the face texture is in the beard of a kind (`edge` 0 at its border … 1 well inside). */
export function beardAt(kind: VrmBeard, u: number, v: number): number {
  const m = FACE_UV.mouth;
  // round the lips: never (the mouth must show)
  const hole = Math.max(Math.abs(u - m.u) / m.half, Math.abs(v - m.v) / m.halfH);
  if (hole < 1) return 0;
  const lips = Math.min(1, (hole - 1) / 0.6);
  // under the nose only
  const top = (v - 0.685) / 0.035;
  if (top <= 0) return 0;
  // the jaw: an oval round the lower face
  const jaw = 1 - (((u - 0.5) / 0.4) ** 2 + ((v - 0.7) / 0.21) ** 2);
  if (jaw <= 0) return 0;
  let w = Math.min(1, top) * Math.min(1, jaw / 0.22) * lips;
  if (kind === 'moustache') {
    // over the lip, its ends a little down past the corners
    const side = Math.abs(u - 0.5);
    const lo = 0.735 + Math.max(0, side - 0.07) * 0.6;
    if (v > lo || side > 0.13) return 0;
    w *= Math.min(1, (0.13 - side) / 0.03) * Math.min(1, (lo - v) / 0.012);
  } else if (kind === 'goatee') {
    // the lip and the chin, not the cheeks
    const side = Math.abs(u - 0.5);
    if (side > 0.16) return 0;
    w *= Math.min(1, (0.16 - side) / 0.035);
  }
  return Math.max(0, Math.min(1, w));
}

/**
 * Draw age (and stubble) on a copy of the face's skin texture. Returns the textures made (they are on the materials:
 * VRMUtils.deepDispose frees them with the avatar), or [] when nothing was drawn (no face skin, no image, no canvas).
 */
export function ageFace(scene: Object3D, face: VrmFace, seed: number, bald = false): Texture[] {
  if (typeof document === 'undefined') return [];
  const made: Texture[] = [];
  const done = new Map<Texture, Texture>();
  for (const { material } of faceSkins(scene)) {
    const src = material.map;
    const img = src?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
    if (!src || !img || !img.width) continue;
    let tex = done.get(src);
    if (!tex) {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(img, 0, 0);
      if (bald) bareScalp(ctx, c.width);
      drawAge(ctx, c.width, face, seed);
      const t = new CanvasTexture(c);
      t.colorSpace = src.colorSpace;
      t.flipY = src.flipY;
      t.wrapS = src.wrapS;
      t.wrapT = src.wrapT;
      t.magFilter = src.magFilter;
      t.minFilter = src.minFilter;
      t.anisotropy = src.anisotropy;
      t.channel = src.channel;
      t.needsUpdate = true;
      done.set(src, t);
      made.push(t);
      tex = t;
    }
    // (MToon shades with its own texture of the same image, often a texture object of its own: both get the aged
    // copy, or the shaded side keeps the young face and a bald head its painted hair)
    const shade = material.shadeMultiplyTexture;
    if (shade && (shade === src || shade.image === src.image || shade.source === src.source)) {
      if (shade !== src) shade.dispose();
      material.shadeMultiplyTexture = tex;
    }
    material.map = tex;
    material.needsUpdate = true;
  }
  for (const src of done.keys()) src.dispose();
  return made;
}

/**
 * A bald head: the dark band of hair the face texture paints round the forehead (VRoid draws the hairline on the skin)
 * becomes bare skin, the forehead's own colour (Frank and Professor Adeyemi had a black skullcap).
 */
function bareScalp(ctx: CanvasRenderingContext2D, size: number): void {
  // (down to the temples at the sides: the band's ends reach a little past the eyes' height)
  const h = Math.floor(size * 0.57);
  const mid = Math.floor(size * 0.5);
  const img = ctx.getImageData(0, 0, size, h);
  const d = img.data;
  const at = (4 * (Math.floor(size * 0.44) * size + Math.floor(size * 0.5)));
  const [r0, g0, b0] = [d[at], d[at + 1], d[at + 2]];
  const lum0 = 0.3 * r0 + 0.59 * g0 + 0.11 * b0;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % size;
    if (i / 4 >= mid * size && px > size * 0.12 && px < size * 0.88) continue;
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (lum > lum0 * 0.72) continue;
    // (the band's soft edge: blended by how dark it is)
    const k = Math.min(1, (lum0 * 0.72 - lum) / (lum0 * 0.25));
    d[i] += (r0 - d[i]) * k;
    d[i + 1] += (g0 - d[i + 1]) * k;
    d[i + 2] += (b0 - d[i + 2]) * k;
  }
  ctx.putImageData(img, 0, 0);
}

/** The lines of an older face, on a texture `size` px square (a VRoid face's layout: FACE_UV). */
function drawAge(ctx: CanvasRenderingContext2D, size: number, face: VrmFace, seed: number): void {
  const S = size;
  const P = (u: number, v: number): [number, number] => [u * S, v * S];
  const old = face.age === 'old';
  const lined = face.age === 'older' || old;
  ctx.save();
  // darker skin, whatever the skin: multiplied, as the tint is
  ctx.globalCompositeOperation = 'multiply';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // soft creases, not cuts (sharp lines read as scars on a dark skin)
  ctx.filter = `blur(${(S * 0.0035).toFixed(1)}px)`;
  const ink = (a: number): string => `rgba(150, 96, 82, ${a})`;
  const curve = (pts: readonly [number, number][], width: number, a: number): void => {
    ctx.beginPath();
    ctx.moveTo(...P(...pts[0]));
    if (pts.length === 3) ctx.quadraticCurveTo(...P(...pts[1]), ...P(...pts[2]));
    else for (const p of pts.slice(1)) ctx.lineTo(...P(...p));
    ctx.lineWidth = width * S;
    ctx.strokeStyle = ink(a);
    ctx.stroke();
  };
  const both = (pts: readonly [number, number][], width: number, a: number): void => {
    curve(pts, width, a);
    curve(
      pts.map(([u, v]) => [1 - u, v] as [number, number]),
      width,
      a,
    );
  };
  const shade = (u: number, v: number, r: number, a: number): void => {
    const [x, y] = P(u, v);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * S);
    g.addColorStop(0, ink(a));
    g.addColorStop(1, ink(0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r * S, y - r * S, 2 * r * S, 2 * r * S);
  };
  const a = old ? 0.6 : 0.45;
  const w = old ? 0.011 : 0.009;
  if (lined) {
    // the forehead: two lines (three when old), a little arched
    const rows = old ? [0.355, 0.39, 0.425] : [0.375, 0.41];
    for (const v of rows) curve([[0.38, v + 0.006], [0.5, v - 0.012], [0.62, v + 0.006]], w * 0.9, a * 0.8);
    // from the nose's wings down past the mouth's corners
    both([[0.435, 0.66], [0.395, 0.705], [0.385, 0.785]], w * 1.15, a);
  }
  if (old) {
    // crow's feet at the eyes' outer corners
    for (const t of [-0.45, 0, 0.45]) {
      const u0 = FACE_UV.eyeL.u - FACE_UV.eyeHalf - 0.012;
      const v0 = FACE_UV.eyeL.v + 0.005;
      both([[u0, v0], [u0 - 0.04 * Math.cos(t), v0 + 0.04 * Math.sin(t)]], w * 0.75, a * 0.75);
    }
    // bags under the eyes
    for (const e of [FACE_UV.eyeL]) both([[e.u - 0.055, e.v + 0.04], [e.u, e.v + 0.072], [e.u + 0.055, e.v + 0.04]], w * 0.85, a * 0.8);
    // hollow cheeks under the cheekbones, lines down from the mouth's corners
    shade(0.25, 0.69, 0.085, 0.32);
    shade(0.75, 0.69, 0.085, 0.32);
    both([[0.405, 0.77], [0.41, 0.81]], w * 0.9, a * 0.75);
  }
  ctx.filter = 'none';
  if (face.beard === 'stubble' || face.stubble) {
    // a shadow of a beard: a soft fill, then dots
    const r = rand(seed * 7919 + 13);
    ctx.fillStyle = 'rgba(120, 112, 112, 0.22)';
    for (let i = 0; i < 2600; i++) {
      const u = 0.1 + r() * 0.8;
      const v = 0.66 + r() * 0.24;
      const k = beardAt('short', u, v);
      if (k <= 0 || r() > k) continue;
      const [x, y] = P(u, v);
      ctx.globalAlpha = 0.35 + 0.5 * k;
      ctx.fillRect(x, y, S * 0.004, S * 0.004);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/**
 * A bald head's scalp: a VRoid face mesh is open where the hair covers it (the crown and the back), so with the hair
 * hidden the inside of the head showed as a dark skullcap (Frank, Professor Adeyemi). A dome of the skin's colour
 * over the crown, sized by the face mesh itself in `frame` (the head's frame, +z the way the face looks): as wide as
 * the face, up to its top, from behind the forehead to as far back as the face is deep. One mesh.
 */
export function scalpMesh(scene: Object3D, frame: Object3D, color: string, eyeY: number): Mesh | null {
  const skin = faceSkins(scene)[0];
  const pos = skin?.mesh.geometry.getAttribute('position');
  if (!skin || !pos) return null;
  skin.mesh.updateMatrixWorld(true);
  frame.updateMatrixWorld(true);
  _m.copy(frame.matrixWorld).invert().multiply(skin.mesh.matrixWorld);
  const box = new Box3();
  for (let i = 0; i < pos.count; i++) box.expandByPoint(_p.fromBufferAttribute(pos, i).applyMatrix4(_m));
  if (box.isEmpty()) return null;
  // (measured on the bases: the face mesh is about 0.2 wide, from the chin to the top of the forehead, its front the
  // nose; a head is about as deep behind the head bone as in front of it)
  const half = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
  const front = box.max.z;
  const yc = eyeY + 0.35 * (box.max.y - eyeY);
  // (a little over the face mesh's open edge, or its rim shows as a dark line)
  const ry = box.max.y - yc + front * 0.09;
  const geo = new SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const mesh = new Mesh(geo, new MeshToonMaterial({ color }));
  mesh.name = 'scalp';
  mesh.scale.set(half * 1.04, ry, front * 0.95);
  mesh.position.set(0, yc, -front * 0.12);
  mesh.castShadow = true;
  frame.add(mesh);
  return mesh;
}

const _m = new Matrix4();
const _n = new Matrix4();
const _p = new Vector3();
const _d = new Vector3();

/**
 * A beard (or a moustache) grown out of the face's own skin, in `head`'s frame (the head bone it is added to): the
 * triangles of the face whose place on the texture is in the beard (`beardAt`), pushed out along their normals by up
 * to `depth` (in the avatar's units), a full beard also drawn down below the chin. Null when the face has no skin
 * mesh with what it needs.
 */
export function beardMesh(scene: Object3D, head: Object3D, kind: VrmBeard, color: string, gap: number): Mesh | null {
  if (kind === 'stubble') return null;
  const skin = faceSkins(scene)[0];
  if (!skin) return null;
  const g = skin.mesh.geometry;
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  if (!pos || !nor || !uv) return null;
  // (the triangles of this material only: a face mesh may hold several)
  const index = g.index;
  const count = index ? index.count : pos.count;
  const group = g.groups.find((x) => x.materialIndex === (Array.isArray(skin.mesh.material) ? (skin.mesh.material as Material[]).indexOf(skin.material) : 0));
  const from = Array.isArray(skin.mesh.material) && group ? group.start : 0;
  const to = Array.isArray(skin.mesh.material) && group ? group.start + group.count : count;
  const at = (i: number): number => (index ? index.getX(i) : i);

  const depth = kind === 'full' ? gap * 0.42 : kind === 'short' ? gap * 0.16 : gap * 0.13;
  const hang = kind === 'full' ? gap * 0.9 : kind === 'short' ? gap * 0.08 : kind === 'goatee' ? gap * 0.18 : 0;
  // the face's rest pose into the head bone's frame
  skin.mesh.updateMatrixWorld(true);
  head.updateMatrixWorld(true);
  _m.copy(head.matrixWorld).invert().multiply(skin.mesh.matrixWorld);
  _n.extractRotation(_m);

  const map = new Map<number, number>();
  const out: number[] = [];
  const normals: number[] = [];
  const tris: number[] = [];
  const vertex = (i: number): number => {
    const had = map.get(i);
    if (had !== undefined) return had;
    const u = uv.getX(i);
    const v = uv.getY(i);
    const w = beardAt(kind, u, v);
    _p.fromBufferAttribute(pos, i).applyMatrix4(_m);
    _d.fromBufferAttribute(nor, i).applyMatrix4(_n).normalize();
    // thin at the edge, thick inside; a full beard thickest at the chin, and hanging below it
    const chin = Math.max(0, Math.min(1, (v - 0.78) / 0.09));
    const thick = depth * (0.18 + 0.82 * w) * (kind === 'full' ? 0.6 + 0.6 * chin : 1);
    _p.addScaledVector(_d, thick);
    _p.y -= hang * w * chin * chin;
    const k = out.length / 3;
    out.push(_p.x, _p.y, _p.z);
    normals.push(_d.x, _d.y, _d.z);
    map.set(i, k);
    return k;
  };
  for (let t = from; t + 2 < to; t += 3) {
    const a = at(t);
    const b = at(t + 1);
    const c = at(t + 2);
    // the triangle is in when its middle is (its corners thin out to the face at the edge)
    const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
    const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
    if (beardAt(kind, u, v) <= 0) continue;
    tris.push(vertex(a), vertex(b), vertex(c));
  }
  if (tris.length === 0) return null;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(out), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geo.setIndex(tris);
  const mat = new MeshStandardMaterial({ color, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'beard';
  mesh.castShadow = true;
  // (from the face's own place: at rest the head bone carries it)
  head.add(mesh);
  return mesh;
}
