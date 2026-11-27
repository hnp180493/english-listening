// Clothes built in code over a VRoid avatar where its sample has none and the drawn portrait does (./vrmBody.ts):
// Kim's doctor's coat down past the hips with a stethoscope round the neck, Emma's mint apron, Ben's green one
// (public/portraits; the bake can recolour a sample's clothes but not add a coat's tails or an apron).
//
// Each piece is measured on the avatar's own body as it stands at rest (the front and back of the torso and how wide
// it is at each height, read off its meshes) and hangs from a bone, so it turns and leans with the body: an apron's
// bib from the chest, its skirt and the coat's tails from the hips. The legs swing under them; the coat is open at the
// front for them, the apron and the tails end above the knee and stand a little off the body, so a stride shows
// little of a leg through them.

import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, FrontSide, Group, Matrix4, Mesh, CatmullRomCurve3, CylinderGeometry, Quaternion, TubeGeometry, Vector3, type Object3D } from 'three';
import { MToonMaterial, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';

export type Garment = { kind: 'apron'; color: string } | { kind: 'labcoat'; color: string } | { kind: 'stethoscope' };

/** Who wears what (by place id), read off their drawn portraits. */
export const GARMENTS: Readonly<Record<string, readonly Garment[]>> = {
  clinic: [{ kind: 'labcoat', color: '#f3f4f2' }, { kind: 'stethoscope' }],
  cafe: [{ kind: 'apron', color: '#9fd6bd' }],
  shop: [{ kind: 'apron', color: '#4f8a5a' }],
};

/** The torso at a height (in the holder's frame, the body facing +z): its front, its back, half its width. */
interface Slice {
  front: number;
  back: number;
  half: number;
}

/** What a piece needs to know of the body (the holder's frame: the VRM's units, +y up, the face towards +z). */
export interface BodyMeasures {
  tall: number;
  /** Heights of the hips' joint, the top of the legs, the knees, the shoulders, the neck. */
  hipsY: number;
  legTop: number;
  kneeY: number;
  shoulderY: number;
  shoulderHalf: number;
  neckY: number;
}

const _m = new Matrix4();
const _v = new Vector3();

/** The torso sliced at heights from the knees to the neck: from the avatar's meshes at rest, arms left out. */
function profile(scene: Object3D, frame: Object3D, b: BodyMeasures): (y: number) => Slice {
  const N = 40;
  const y0 = b.kneeY - b.tall * 0.05;
  const y1 = b.neckY;
  const step = (y1 - y0) / N;
  const rows: Slice[] = Array.from({ length: N + 1 }, () => ({ front: -Infinity, back: Infinity, half: 0 }));
  const inv = _m.copy(frame.matrixWorld).invert();
  const toFrame = new Matrix4();
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !mesh.geometry?.getAttribute('position')) return;
    // (the body and its clothes: not the hair hanging over the chest or down the back, nor the face)
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => m?.name ?? '');
    if ([mesh.name, mesh.parent?.name ?? '', ...mats].some((n) => /hair|face|eye/i.test(n))) return;
    const p = mesh.geometry.getAttribute('position');
    toFrame.multiplyMatrices(inv, mesh.matrixWorld);
    for (let i = 0; i < p.count; i += 2) {
      _v.fromBufferAttribute(p, i).applyMatrix4(toFrame);
      // (the torso only: not the arms held out, nor the legs' outer sides below the hips)
      if (Math.abs(_v.x) > b.shoulderHalf * 0.8) continue;
      const k = Math.round((_v.y - y0) / step);
      if (k < 0 || k > N) continue;
      const r = rows[k];
      r.front = Math.max(r.front, _v.z);
      r.back = Math.min(r.back, _v.z);
      r.half = Math.max(r.half, Math.abs(_v.x));
    }
  });
  // (fill a slice nothing fell in from its neighbours)
  for (let k = 0; k <= N; k++) {
    if (Number.isFinite(rows[k].front)) continue;
    const near = rows.find((r, i) => Math.abs(i - k) <= 3 && Number.isFinite(r.front));
    rows[k] = near ? { ...near } : { front: b.tall * 0.06, back: -b.tall * 0.06, half: b.shoulderHalf * 0.6 };
  }
  return (y: number) => rows[Math.max(0, Math.min(N, Math.round((y - y0) / step)))];
}

/** A strip down the body: rows of (y, z, left x, right x), from top to bottom, two-sided. */
function strip(rows: readonly { y: number; z: number; l: number; r: number }[]): BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const c = rows[i + 1];
    pos.push(a.l, a.y, a.z, c.l, c.y, c.z, a.r, a.y, a.z, a.r, a.y, a.z, c.l, c.y, c.z, c.r, c.y, c.z);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  return g;
}

/** A band round the body (an ellipse at each row), open over `gap` radians at the front; rows top to bottom. */
function band(rows: readonly { y: number; front: number; back: number; half: number }[], gap: number, part: readonly [number, number] = [0, 1]): BufferGeometry {
  const SEG = 14;
  const pos: number[] = [];
  const at = (r: (typeof rows)[number], t: number): [number, number, number] => {
    // t from the front's one edge round the back to the other
    const a = gap / 2 + t * (Math.PI * 2 - gap);
    const s = Math.sin(a);
    const c = Math.cos(a);
    const mid = (r.front + r.back) / 2;
    const rz = c >= 0 ? r.front - mid : mid - r.back;
    return [r.half * s, r.y, mid + rz * c];
  };
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let k = 0; k < SEG; k++) {
      const t0 = part[0] + ((part[1] - part[0]) * k) / SEG;
      const t1 = part[0] + ((part[1] - part[0]) * (k + 1)) / SEG;
      const a0 = at(rows[i], t0);
      const a1 = at(rows[i], t1);
      const b0 = at(rows[i + 1], t0);
      const b1 = at(rows[i + 1], t1);
      pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  return g;
}

/**
 * Dress `vrm` in the pieces `id` wears: meshes hung on its bones, measured in `frame` (the holder: the body at rest,
 * the VRM's units). Their materials are handed back for the night's tint.
 */
export function dressGarments(id: string, vrm: VRM, frame: Object3D, b: BodyMeasures): { meshes: Mesh[]; materials: MToonMaterial[]; update: () => void } {
  const list = GARMENTS[id];
  const meshes: Mesh[] = [];
  const materials: MToonMaterial[] = [];
  /** Each frame: what hangs from the hips swings with the thighs (./vrmBody.ts calls it after the pose). */
  const swings: (() => void)[] = [];
  const update = (): void => {
    for (const f of swings) f();
  };
  if (!list) return { meshes, materials, update };
  frame.updateWorldMatrix(true, true);
  const at = profile(vrm.scene, frame, b);
  const bone = (n: VRMHumanBoneName): Object3D | null => vrm.humanoid.getNormalizedBoneNode(n);
  /**
   * Hang a geometry made in the frame on a bone, where it is now; with `pivot` (a point in the frame) on a joint there
   * that `swings` turns.
   */
  const hang = (geo: BufferGeometry, on: Object3D | null, color: string, two = true, pivot?: Vector3): Group | null => {
    if (!on) return null;
    const rel = new Matrix4().copy(frame.matrixWorld).invert().multiply(on.matrixWorld);
    const toBone = rel.invert();
    geo.applyMatrix4(toBone);
    const joint = pivot ? new Group() : null;
    if (joint && pivot) {
      joint.position.copy(pivot).applyMatrix4(toBone);
      geo.translate(-joint.position.x, -joint.position.y, -joint.position.z);
      on.add(joint);
    }
    // (shaded as the avatar's own clothes are: MToon, its shade a little darker than its colour)
    const c = new Color(color);
    const mat = new MToonMaterial({ color: c, shadeColorFactor: c.clone().multiplyScalar(0.8), shadingToonyFactor: 0.9, side: two ? DoubleSide : FrontSide });
    const m = new Mesh(geo, mat);
    m.userData.garment = true;
    m.castShadow = true;
    (joint ?? on).add(m);
    meshes.push(m);
    materials.push(mat);
    return joint;
  };
  // The thighs, for what swings with them: forward and down in the hips' own frame, and how far each thigh points
  // forward now (its knee's offset turned by its turn: the normalized bones rest unturned, so no matrices each frame).
  const hipsNode = bone('hips');
  const legs = (['left', 'right'] as const).map((side) => ({
    upper: bone(`${side}UpperLeg`),
    lower: bone(`${side}LowerLeg`),
    x: (() => {
      const n = bone(`${side}UpperLeg`);
      return n ? frame.worldToLocal(n.getWorldPosition(new Vector3())).x : 0;
    })(),
  }));
  const toHips = new Matrix4().copy(hipsNode?.matrixWorld ?? frame.matrixWorld).invert().multiply(frame.matrixWorld);
  const fwd = new Vector3(0, 0, 1).transformDirection(toHips);
  const up = new Vector3(0, 1, 0).transformDirection(toHips);
  const across = new Vector3().crossVectors(up.clone().negate(), fwd).normalize();
  const _d = new Vector3();
  /** How far a thigh points forward of straight down, in radians (back is negative). */
  const thigh = (k: number): number => {
    const l = legs[k];
    if (!l.upper || !l.lower) return 0;
    _d.copy(l.lower.position).applyQuaternion(l.upper.quaternion);
    return Math.atan2(_d.dot(fwd), -_d.dot(up));
  };
  /**
   * How far a cloth hung at `pivotY` with its hem at `hemY`, standing `gap` off the thigh at rest, must turn for its hem
   * to stay in front of a thigh turned `a` (just enough, not as far as the thigh: it hangs from higher up); a thigh
   * raised towards a seat lays it on the lap. Signed: a thigh back pushes the back of a coat back.
   */
  const clear = (a: number, pivotY: number, hemY: number, gap: number): number => {
    const len = Math.max(0.01, b.legTop - b.kneeY);
    const along = Math.max(0, b.legTop - hemY);
    const drop = Math.max(0.01, pivotY - hemY);
    const need = Math.asin(Math.min(1, Math.max(0, (along * Math.sin(Math.abs(a)) - gap) / drop)));
    const turn = Math.max(need > 0 ? need + 0.06 : 0, (Math.abs(a) - 0.6) * 1.5 * Math.min(1, along / len + 0.2));
    return Math.sign(a) * turn;
  };
  /** Turn `joint` forward by `angle` (clamped), as a hanging cloth would be pushed. */
  const swing = (joint: Group | null, angle: () => number): void => {
    if (!joint) return;
    const q = new Quaternion();
    swings.push(() => void joint.quaternion.copy(q.setFromAxisAngle(across, Math.max(-0.7, Math.min(1.5, angle())))));
  };
  const off = b.tall * 0.012;
  const waistY = b.hipsY + b.tall * 0.045;
  const hipsBone = bone('hips');
  const chestBone = bone('upperChest') ?? bone('chest') ?? bone('spine');
  for (const g of list) {
    if (g.kind === 'apron') {
      // the bib, from under the collarbones to the waist, following the chest's front
      const top = b.shoulderY - b.tall * 0.07;
      const bib = [];
      for (let i = 0; i <= 8; i++) {
        const y = top + ((waistY - top) * i) / 8;
        const s = at(y);
        const w = Math.min(s.half * 0.62, b.shoulderHalf * 0.42);
        bib.push({ y, z: s.front + off, l: -w, r: w });
      }
      hang(strip(bib), chestBone, g.color);
      // the strap over the neck, from the bib's top corners round the back of the neck
      const neck = at(b.neckY - b.tall * 0.01);
      const w0 = bib[0].r;
      const band2 = b.tall * 0.008;
      for (const k of [-1, 1]) {
        const ys = [bib[0].y, (bib[0].y + b.neckY) / 2, b.neckY - b.tall * 0.005];
        const xs = [k * (w0 - band2), k * ((w0 + neck.half * 1.05) / 2), k * neck.half * 1.05];
        const zs = [bib[0].z, (bib[0].z + at(ys[1]).front + off) / 2, (neck.front + neck.back) / 2];
        hang(strip(ys.map((y, i) => ({ y, z: zs[i], l: xs[i] - band2, r: xs[i] + band2 }))), chestBone, g.color);
      }
      // the skirt, from the waist to a little above the knees, standing off the thighs as it goes down
      const hem = b.kneeY + (b.legTop - b.kneeY) * 0.25;
      const skirt = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const y = waistY + (hem - waistY) * t;
        const s = at(Math.max(y, b.legTop - b.tall * 0.02));
        const w = s.half * (0.9 + 0.12 * t);
        skirt.push({ y, z: s.front + off + b.tall * 0.03 * t, l: -w, r: w });
      }
      // (it swings forward with the thigh that is furthest forward: a stride pushes it, it never cuts through a leg)
      const gap = off + b.tall * 0.03;
      swing(hang(strip(skirt), hipsBone, g.color, true, new Vector3(0, waistY, at(waistY).front)), () => clear(Math.max(0, thigh(0), thigh(1)), waistY, hem, gap));
      // the ties round the waist
      const s = at(waistY);
      hang(band([{ y: waistY + b.tall * 0.008, front: s.front + off, back: s.back - off, half: s.half + off }, { y: waistY - b.tall * 0.008, front: s.front + off, back: s.back - off, half: s.half + off }], 0.2), hipsBone, g.color);
    } else if (g.kind === 'labcoat') {
      // the coat's tails, from the waist (where the white top ends) to just above the knees, open at the front for
      // the legs, flaring a little as they go down
      const hem = b.kneeY + (b.legTop - b.kneeY) * 0.12;
      const top = waistY + b.tall * 0.02;
      const rows = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const y = top + (hem - top) * t;
        const s = at(Math.max(y, b.legTop - b.tall * 0.02));
        const flare = off + b.tall * 0.03 * t;
        rows.push({ y, front: s.front + flare, back: s.back - flare, half: s.half + flare });
      }
      // in two halves, each swinging with its own thigh, parted at the back like a coat's vent
      for (const half of [0, 1]) {
        const k = legs[0].x >= 0 === (half === 0) ? 0 : 1;
        swing(hang(band(rows, 0.9, half === 0 ? [0, 0.5] : [0.5, 1]), hipsBone, g.color, true, new Vector3(legs[k].x, top, 0)), () => clear(thigh(k), top, hem, off + b.tall * 0.03));
      }
    } else {
      // the stethoscope: one tube from the chest piece on the right up over the collarbone, round the back of the
      // neck, over the other collarbone and down the left of the chest (as in the portrait: draped, not worn)
      const neck = at(b.neckY - b.tall * 0.015);
      const mid = (neck.front + neck.back) / 2;
      const r = b.tall * 0.0055;
      const down = (k: number, y: number): Vector3 => new Vector3(k * neck.half * 0.72, y, at(y).front + off + r);
      const ends = [b.shoulderY - b.tall * 0.1, b.shoulderY - b.tall * 0.075];
      const path = new CatmullRomCurve3(
        [
          down(1, ends[0]),
          down(1, b.shoulderY - b.tall * 0.04),
          new Vector3(neck.half * 0.95, b.neckY - b.tall * 0.02, mid + (neck.front - mid) * 0.55),
          new Vector3(neck.half * 0.7, b.neckY - b.tall * 0.012, mid - (mid - neck.back) * 0.75),
          new Vector3(0, b.neckY - b.tall * 0.01, neck.back - off),
          new Vector3(-neck.half * 0.7, b.neckY - b.tall * 0.012, mid - (mid - neck.back) * 0.75),
          new Vector3(-neck.half * 0.95, b.neckY - b.tall * 0.02, mid + (neck.front - mid) * 0.55),
          down(-1, b.shoulderY - b.tall * 0.04),
          down(-1, ends[1]),
        ],
        false,
        'centripetal',
      );
      hang(new TubeGeometry(path, 40, r, 6, false), chestBone, '#2c2e35', false);
      const s = at(ends[0]);
      const disc = new CylinderGeometry(b.tall * 0.014, b.tall * 0.014, b.tall * 0.006, 14);
      disc.rotateX(Math.PI / 2);
      disc.translate(neck.half * 0.72, ends[0] - b.tall * 0.012, s.front + off + r * 2);
      hang(disc, chestBone, '#b9bec7', false);
    }
  }
  return { meshes, materials, update };
}
