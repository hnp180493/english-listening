// A person in the 3D town: one skinned mesh (body, clothes, hair, extras), one face mesh (shared atlas), and a hat
// and props when needed: 2 draw calls standing about, 3–4 with a hat and a cup. The Animator drives every bone.

import { Bone, Euler, Group, Matrix4, Mesh, Quaternion, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import type { CharAction, Character3D, CharacterId, CharacterLook } from '../contracts';
import { ACTION_SECONDS, Animator, C, J, JOINT_COUNT, LEG_GROW, angleDelta, clamp } from './anim';
import { B, BONE_COUNT, BONE_REST, buildBody, HEAD, HEAD_TOP } from './body';
import type { Detail } from './build';
import { faceGeometry } from './face';
import { HAT_FIT } from './hair';
import { hatGeometry } from './hats';
import { castLook, hashString, hasExtra, isCastId } from './looks';
import { materials, setNightTint } from './materials';
import { makeProp, type PropId, type PropRig } from './props';

/** Tiles per design unit: an adult is about 0.79 tile tall (0.75 before the legs grew; the head kept its size). */
export const TILE_SCALE = 0.75;
/** Seat height (tiles) the sit pose expects for an adult: the top of a bench and of the café's stool (props3d.ts SEAT_TOP). */
export const SEAT_HEIGHT = 0.18;

export interface CharacterOptions {
  /** Geometry detail (1 = full, portraits; the cast defaults to 0.85, passers-by to 0.7). */
  detail?: number;
  mood?: 'neutral' | 'happy';
  /** Seat height in tiles (default SEAT_HEIGHT × scale). */
  seat?: number;
}

/** Extra methods beyond the contract (the scene may use them). */
export interface Character3DPlus extends Character3D {
  readonly look: CharacterLook;
  readonly animator: Animator;
  /** Seat height in tiles for the sit pose (bench, stool…). */
  setSeatHeight(tiles: number): void;
  /** While fishing: the line runs from the rod's tip to this world point (the float), or hangs from it (null). */
  castLine(point: Vector3 | null): void;
  /** Current eased heading (radians). */
  readonly heading: number;
}

const _v = new Vector3();

/**
 * Where props are held. Hand props sit at the right hand but keep their own orientation in the upper body's frame
 * (a cup stays upright whatever the arm does; it tilts to the mouth on a sip): `rot` is in the spine's frame, `pos` an
 * offset from the hand in that frame. The book rests on the chest.
 */
const PROP_PLACES: Record<PropId, { bone: number; pos: [number, number, number]; rot: [number, number, number]; channel: number }> = {
  cup: { bone: J.elR, pos: [0.005, 0.02, 0.04], rot: [0, 0, 0], channel: C.cup },
  can: { bone: J.elR, pos: [0, -0.01, 0.03], rot: [0, 0.2, 0], channel: C.can },
  rod: { bone: J.elR, pos: [0, -0.02, 0.02], rot: [0.95, -0.25, 0], channel: C.rod },
  book: { bone: J.spine, pos: [0, 0.15, 0.2], rot: [-1.35, 0, 0], channel: C.book },
};

const _q = new Quaternion();
const _q2 = new Quaternion();
const _e = new Euler();

export function createPerson(id: CharacterId, look: CharacterLook = castLook(id), opts: CharacterOptions = {}): Character3DPlus {
  const scale = look.scale ?? 1;
  const detail: Detail = { seg: opts.detail ?? (isCastId(id) ? 0.85 : 0.7) };
  const mats = materials();
  const built = buildBody(look, detail);
  const geometry = built.builder.build(true);

  // skeleton (bind = rest positions; the hair moved its tail bones)
  const bones: Bone[] = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const bone = new Bone();
    bone.name = BONE_REST[i].name;
    const p = built.bones[i];
    const parent = BONE_REST[i].parent;
    if (parent < 0) bone.position.set(p[0], p[1], p[2]);
    else {
      const q = built.bones[parent];
      bone.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      bones[parent].add(bone);
    }
    bones.push(bone);
  }
  const rest = bones.map((b) => b.position.clone());

  const mesh = new SkinnedMesh(geometry, mats.body);
  mesh.name = `char-${id}`;
  mesh.castShadow = true;
  mesh.add(bones[0]);
  // bind with the bones' world matrices of the rest pose (inverses come from them)
  mesh.updateMatrixWorld(true);
  mesh.bind(new Skeleton(bones), new Matrix4());
  // a sphere that holds every pose (jumps, raised arms), so culling never clips a person
  mesh.boundingSphere = new Sphere(new Vector3(0, 0.55 + LEG_GROW / 2, 0), 0.85 + LEG_GROW / 2);

  // face on the head bone
  const faceStyle = look.face ?? (hasExtra(look, 'lashes') ? 1 : 0) + (hasExtra(look, 'freckles') ? 2 : 0);
  const face = faceGeometry(HEAD.R, HEAD.stretch, faceStyle);
  const faceMesh = new Mesh(face.geometry, mats.face);
  faceMesh.name = 'face';
  faceMesh.position.set(HEAD.center[0], HEAD.center[1] + LEG_GROW - BONE_REST[J.head].pos[1], HEAD.center[2]);
  faceMesh.renderOrder = 1;
  bones[J.head].add(faceMesh);
  // the head's shape: the head bone scaled from the neck (the face, the hair and a hat on it follow)
  const HEAD_SHAPES = { round: [1, 1, 1], oval: [0.95, 1.07, 0.97], wide: [1.08, 0.94, 1.03], long: [0.93, 1.1, 0.96] } as const;
  const hs = HEAD_SHAPES[look.head ?? 'round'];
  bones[J.head].scale.set(hs[0], hs[1], hs[2]);

  // body pivot: heading, scale to tiles, squash
  const pivot = new Group();
  pivot.name = 'pivot';
  pivot.add(mesh);
  const tiles = TILE_SCALE * scale;
  pivot.scale.setScalar(tiles);
  const root = new Group();
  root.name = `character-${id}`;
  root.add(pivot);

  const anim = new Animator({ seed: hashString(id), scale, tiles: TILE_SCALE * scale, mood: opts.mood });
  if (opts.seat !== undefined) anim.seat = opts.seat / tiles;

  // hat
  let hatMesh: Mesh | null = null;
  let hatHeight = 0;
  const fit = HAT_FIT[look.hair.style];
  const setHat = (hatId: string | null) => {
    if (hatMesh) {
      hatMesh.removeFromParent();
      hatMesh = null;
      hatHeight = 0;
    }
    const h = hatId ? hatGeometry(hatId) : null;
    // a worn hat hides the bun / spikes / tuft and the cap
    const hide = h !== null;
    bones[B.crown].scale.setScalar(hide ? 0.001 : 1);
    bones[B.cap].scale.setScalar(hide ? 0.001 : 1);
    if (!h) return;
    hatMesh = new Mesh(h.geometry, mats.body);
    hatMesh.name = `hat-${hatId}`;
    hatMesh.castShadow = true;
    hatMesh.position.set(0, HEAD.center[1] + LEG_GROW - BONE_REST[J.head].pos[1] + fit.lift * HEAD.R, 0);
    hatMesh.scale.set(fit.scale * HEAD.stretch[0], fit.scale * HEAD.stretch[1], fit.scale * HEAD.stretch[2]);
    // a hair parting tilts a hat a touch
    hatMesh.rotation.set(-0.05, 0, look.hair.style === 'short' ? -0.04 : 0);
    hatHeight = h.height * fit.scale + fit.lift * HEAD.R;
    bones[J.head].add(hatMesh);
  };

  // outfit (top colour) recolouring keeps each vertex's shading
  const colorAttr = geometry.getAttribute('color');
  const topRanges = built.builder.slots.get('top') ?? [];
  const baseTop = built.slotColor.get('top');
  const original = new Float32Array(colorAttr.array as Float32Array);
  const setOutfit = (hex: string | null) => {
    if (!baseTop) return;
    const target = hex ? baseTop.clone().set(hex) : baseTop;
    const sum = baseTop.r + baseTop.g + baseTop.b || 1;
    const arr = colorAttr.array as Float32Array;
    for (const [start, count] of topRanges) {
      for (let i = start; i < start + count; i++) {
        const k = (original[i * 3] + original[i * 3 + 1] + original[i * 3 + 2]) / sum;
        arr[i * 3] = target.r * k;
        arr[i * 3 + 1] = target.g * k;
        arr[i * 3 + 2] = target.b * k;
      }
    }
    colorAttr.needsUpdate = true;
  };

  // props, made on first use
  const props = new Map<PropId, PropRig>();
  let castPoint: Vector3 | null = null;
  const propFor = (pid: PropId): PropRig => {
    let r = props.get(pid);
    if (!r) {
      r = makeProp(pid, mats.body);
      const place = PROP_PLACES[pid];
      const bone = bones[place.bone];
      if (place.bone === J.elR) {
        // grip in forearm space at the hand; the prop itself sits on an inner group offset in the body's frame
        const hand = built.handR;
        const el = built.bones[J.elR];
        r.root.position.set(hand[0] - el[0], hand[1] - el[1], hand[2] - el[2]);
        for (const child of r.root.children) child.position.add(new Vector3(...place.pos));
      } else {
        r.root.position.set(place.pos[0], place.pos[1], place.pos[2]);
        r.root.rotation.set(place.rot[0], place.rot[1], place.rot[2]);
      }
      r.root.visible = false;
      bone.add(r.root);
      props.set(pid, r);
    }
    return r;
  };

  let lookPoint: Vector3 | null = null;

  const apply = (dt: number) => {
    const p = anim.pose;
    for (let j = 0; j < JOINT_COUNT; j++) bones[j].rotation.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
    bones[J.hips].position.set(rest[J.hips].x + p[C.hipX], rest[J.hips].y + p[C.hipY], rest[J.hips].z + p[C.hipZ]);
    // hair springs
    bones[B.tailA].rotation.set(anim.hair[0], 0, anim.hair[1]);
    bones[B.tailB].rotation.set(anim.hair[2], 0, anim.hair[3]);
    // a skirt folds onto the lap when seated (it is rigid otherwise)
    const seated = anim.seatBlend;
    bones[B.skirt].scale.set(1 + 0.08 * seated, 1 - 0.5 * seated, 1 + 0.5 * seated);
    // squash and stretch around the feet
    const sq = p[C.squash];
    pivot.scale.set(tiles * (1 - sq * 0.5), tiles * (1 + sq), tiles * (1 - sq * 0.5));
    pivot.rotation.y = Math.PI / 2 - anim.heading;
    face.set(anim.face.eyes, anim.face.mouth);
    // props pop in and out with their weight
    for (const pid of ['cup', 'can', 'rod', 'book'] as const) {
      const w = p[PROP_PLACES[pid].channel];
      if (w < 0.02 && !props.has(pid)) continue;
      const r = propFor(pid);
      r.root.visible = w > 0.02;
      if (!r.root.visible) continue;
      const k = clamp(w, 0, 1);
      // ease out with a small overshoot
      const s = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
      r.root.scale.setScalar(Math.max(0.001, s));
      if (PROP_PLACES[pid].bone === J.elR) {
        // orientation in the spine's frame: undo the arm's rotation, then the prop's own angle
        _q.copy(bones[J.shR].quaternion).multiply(bones[J.elR].quaternion).invert();
        const rot = PROP_PLACES[pid].rot;
        const tilt = pid === 'cup' ? -1.0 * p[C.sip] : pid === 'can' ? p[C.canTilt] : -0.35 * p[C.tug];
        _q2.setFromEuler(_e.set(rot[0] + tilt, rot[1], rot[2]));
        r.root.quaternion.copy(_q).multiply(_q2);
      }
      if (pid === 'can') r.tick(dt, p[C.canTilt] * k);
      else if (pid === 'rod') {
        r.aim?.(castPoint);
        r.tick(dt, p[C.tug]);
      }
    }
  };

  const character: Character3DPlus = {
    id,
    root,
    castLine(point) {
      castPoint = point;
    },
    look,
    animator: anim,
    get heading() {
      return anim.heading;
    },
    setHeading(rad, instant) {
      anim.setHeading(rad, instant);
      if (instant) pivot.rotation.y = Math.PI / 2 - anim.heading;
    },
    setAction(action: CharAction) {
      anim.setAction(action);
    },
    actionDuration(action: CharAction) {
      return ACTION_SECONDS[action] ?? 0;
    },
    update(dt, speed) {
      if (lookPoint) {
        root.updateWorldMatrix(true, false);
        bones[J.head].getWorldPosition(_v);
        const dx = lookPoint.x - _v.x;
        const dz = lookPoint.z - _v.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1e-3) anim.setLook(null);
        else {
          const world = Math.atan2(dz, dx);
          const yaw = -angleDelta(anim.heading, world);
          const headY = _v.y + 0.17 * tiles;
          const pitch = Math.atan2(headY - lookPoint.y, dist);
          // beyond the neck's reach the head just goes as far as it can
          anim.setLook(clamp(yaw, -1.15, 1.15), clamp(pitch, -0.35, 0.4));
        }
      }
      // the feet are planted in the world: the animator follows where the body is
      anim.placeAt(root.position.x, root.position.z);
      anim.update(dt, speed);
      apply(dt);
    },
    headTop(target) {
      const pivotY = BONE_REST[J.head].pos[1];
      const local = Math.max(HEAD_TOP - pivotY, HEAD.center[1] + LEG_GROW - pivotY + hatHeight);
      root.updateWorldMatrix(true, true);
      return bones[J.head].localToWorld(target.set(0, local, 0));
    },
    setHat,
    setOutfit,
    lookAt(point) {
      lookPoint = point ? (lookPoint ?? new Vector3()).copy(point) : null;
      if (!point) anim.setLook(null);
    },
    setNight(amount) {
      setNightTint(amount);
    },
    setSeatHeight(t) {
      anim.seat = t / tiles;
    },
    dispose() {
      root.removeFromParent();
      geometry.dispose();
      face.geometry.dispose();
      mesh.skeleton.dispose();
      for (const r of props.values()) r.root.removeFromParent();
      props.clear();
      if (hatMesh) hatMesh.removeFromParent();
    },
  };
  anim.update(0, 0);
  apply(0);
  return character;
}
