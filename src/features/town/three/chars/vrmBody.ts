// A resident shown as a VRoid avatar (VRM, read with @pixiv/three-vrm: toon shading, outline, spring bones for hair
// and skirts, face expressions) in place of the body built in code (owner, 2026-11-26: "làm tiếp VRoid nhưng có
// setting cho chọn model trở lại như cũ"; the choice is townUi.people, the list of who has a model is
// data/townVrm.ts, the gate is ./vrmPeople.ts). This file is the heavy half: it is imported lazily, so three-vrm
// and the models cost nothing until somebody with a model is on the stage with the setting on.
//
// A VRM has no animations. Nothing is retargeted from files: the code-built body's own Animator (./anim.ts) keeps
// running on the hidden body and its pose is copied onto the VRM's humanoid bones every frame, so every action the
// game already has (walk, run, sit, talk, wave, yes / no, cheer, the head following who speaks) carries over, and so
// do the engine's place, turn and name tag. What does NOT carry over yet: things held in the hand (cup, watering
// can, rod, book), hats and outfit colours.
//
// The two rigs differ in three ways the copy has to bridge:
//  - the arms: the code body rests with its arms down, a VRM in a T. An upper arm takes the pose after a quarter turn
//    down (REST_L / REST_R); a forearm's own turn is re-expressed in the turned frame;
//  - the legs: a VRM's are far longer for its height, so the hips' rise and fall is scaled by the legs' ratio, and
//    sitting is posed for the VRM's own legs (hips on the seat, shins down to the ground) instead of copied;
//  - VRM 0.x looks down −z in its own space (three-vrm turns the scene half round): a rotation's x and z flip.

import { Box3, BoxGeometry, Color, CylinderGeometry, Euler, Group, MathUtils, Mesh, MeshStandardMaterial, Quaternion, SkinnedMesh, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import { BODY, C, J, LEG_REACH, type EyeState, type MouthState } from './anim';
import type { Character3DPlus } from './person';
import type { VrmExtra } from '../../../../data/townVrm';

/** The share of the code body's leg swing a VRM takes (its legs are about three times as long for the same pace). */
const STRIDE = 0.62;

/** How much taller than the code-built body a VRM stands (its head is small: at the same height it looks tiny). */
const TALLER = 1.4;

const Z = new Vector3(0, 0, 1);
/** T pose → arms down (a little out from the body, so the hands clear the hips). */
const REST_L = new Quaternion().setFromAxisAngle(Z, -(Math.PI / 2 - 0.14));
const REST_R = new Quaternion().setFromAxisAngle(Z, Math.PI / 2 - 0.14);
const REST_L_INV = REST_L.clone().invert();
const REST_R_INV = REST_R.clone().invert();

/** Which bone takes which joint of the pose, and how. */
const JOINTS: readonly (readonly [number, VRMHumanBoneName, 'copy' | 'armL' | 'armR' | 'foreL' | 'foreR'])[] = [
  [J.hips, 'hips', 'copy'],
  [J.spine, 'spine', 'copy'],
  [J.head, 'head', 'copy'],
  [J.shL, 'leftUpperArm', 'armL'],
  [J.elL, 'leftLowerArm', 'foreL'],
  [J.shR, 'rightUpperArm', 'armR'],
  [J.elR, 'rightLowerArm', 'foreR'],
  [J.thL, 'leftUpperLeg', 'copy'],
  [J.knL, 'leftLowerLeg', 'copy'],
  [J.anL, 'leftFoot', 'copy'],
  [J.thR, 'rightUpperLeg', 'copy'],
  [J.knR, 'rightLowerLeg', 'copy'],
  [J.anR, 'rightFoot', 'copy'],
];

/** The face of the pose as expression weights. */
const EYES: Readonly<Record<EyeState, { blink: number; happy: number; surprised: number }>> = {
  open: { blink: 0, happy: 0, surprised: 0 },
  half: { blink: 0.45, happy: 0, surprised: 0 },
  closed: { blink: 1, happy: 0, surprised: 0 },
  happy: { blink: 0, happy: 0.9, surprised: 0 },
  wide: { blink: 0, happy: 0, surprised: 0.6 },
};
const MOUTH: Readonly<Record<MouthState, { aa: number; oh: number; relaxed: number; happy: number }>> = {
  smile: { aa: 0, oh: 0, relaxed: 0.5, happy: 0 },
  neutral: { aa: 0, oh: 0, relaxed: 0, happy: 0 },
  talkA: { aa: 0.7, oh: 0, relaxed: 0, happy: 0 },
  talkO: { aa: 0, oh: 0.7, relaxed: 0, happy: 0 },
  grin: { aa: 0.15, oh: 0, relaxed: 0, happy: 0.7 },
  o: { aa: 0, oh: 0.85, relaxed: 0, happy: 0 },
};

/** The night's colour on a VRM (its toon materials take little from the scene's dimmed lights). */
const NIGHT = new Color('#7d86b8');

const _q = new Quaternion();
const _euler = new Euler();
const _c = new Color();
const _sit = new Quaternion();
const _e = { x: 0, y: 0, z: 0 };
const X = new Vector3(1, 0, 0);
const _v = new Vector3();

interface Tinted {
  m: Material & { color?: Color; shadeColorFactor?: Color };
  color: Color | null;
  shade: Color | null;
}

/**
 * Show `ch` as the VRM at `url` from now on. Resolves once it stands there; rejects when the file cannot be read
 * (the code-built body simply stays).
 */
export async function wearVrm(ch: Character3DPlus, url: string, opts: { tall?: number; extras?: readonly VrmExtra[] } = {}, gone: () => boolean = () => false): Promise<void> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error('not a VRM: ' + url);
  // (the person left the stage while the file was coming)
  if (gone()) {
    VRMUtils.deepDispose(gltf.scene);
    return;
  }
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  const old = vrm.meta.metaVersion === '0';
  slim(vrm.scene);
  const tinted: Tinted[] = [];
  vrm.scene.traverse((o) => {
    o.frustumCulled = false;
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Tinted['m'][]) {
      if (tinted.some((t) => t.m === m)) continue;
      tinted.push({ m, color: m.color?.isColor ? m.color.clone() : null, shade: m.shadeColorFactor?.isColor ? m.shadeColorFactor.clone() : null });
    }
  });

  const bone = (name: VRMHumanBoneName): Object3D | null => vrm.humanoid.getNormalizedBoneNode(name);
  const bones = JOINTS.map(([j, name, how]) => ({ j, how, node: bone(name) }));
  const hips = bone('hips');
  const head = bone('head');

  // sizes, in the VRM's own units (before the holder's scale)
  vrm.scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(vrm.scene);
  const tall = Math.max(0.01, box.max.y - box.min.y);
  const yOf = (name: VRMHumanBoneName): number => bone(name)?.getWorldPosition(_v).y ?? 0;
  const hipsRest = hips ? hips.position.clone() : new Vector3();
  const hipsY = yOf('hips');
  const legTop = yOf('leftUpperLeg');
  const kneeY = yOf('leftLowerLeg');
  const ankleY = yOf('leftFoot');
  const thigh = Math.max(0.01, legTop - kneeY);
  const shin = Math.max(0.01, kneeY - ankleY);
  const ground = box.min.y;
  // where the eyes and the head are, for what is worn on the head (read now: the holder below scales the world)
  const eyeL = bone('leftEye')?.getWorldPosition(new Vector3());
  const eyeR = bone('rightEye')?.getWorldPosition(new Vector3());
  const headAt = head?.getWorldPosition(new Vector3());
  /** Design units of the code body → this VRM's units, for lengths and for what the legs do. */
  const perDesign = tall / BODY.headTop;
  const legRatio = (thigh + shin) / LEG_REACH;

  // as tall as the body it replaces, and a bit more (a holder takes the size and the turn: rotateVRM0 turned the
  // scene itself)
  const anim = ch.animator;
  const world = BODY.headTop * anim.tiles * TALLER * (opts.tall ?? 1);
  const s = world / tall;
  const holder = new Group();
  holder.name = 'vrm';
  holder.scale.setScalar(s);
  holder.add(vrm.scene);
  const pivot = ch.root.getObjectByName('pivot');
  if (pivot) pivot.visible = false;
  ch.root.add(holder);

  // glasses, a cap: built in code on the head (the samples have none)
  const worn: Mesh[] = [];
  if (head && opts.extras?.length) {
    if (eyeL && eyeR && headAt) {
      // the head's own frame: a VRM 0.x looks down -z in it
      const frame = new Group();
      frame.rotation.y = old ? Math.PI : 0;
      head.add(frame);
      // (the positions were read with the scene turned to +z, as the frame sees them)
      const mid = eyeL.clone().add(eyeR).multiplyScalar(0.5).sub(headAt);
      const gap = Math.max(0.02, Math.abs(eyeL.x - eyeR.x));
      for (const e of opts.extras) worn.push(...wear(frame, e, mid, gap, box.max.y - headAt.y));
    }
  }

  const weights: Record<string, number> = { blink: 0, happy: 0, surprised: 0, aa: 0, oh: 0, relaxed: 0 };
  const setJoint = (node: Object3D, q: Quaternion): void => {
    if (old) node.quaternion.set(-q.x, q.y, -q.z, q.w);
    else node.quaternion.copy(q);
  };

  const update = ch.update.bind(ch);
  ch.update = (dt: number, speed: number) => {
    update(dt, speed);
    if (pivot) holder.rotation.y = pivot.rotation.y;
    const p = anim.pose;
    const seat = anim.seatBlend;

    // seated on this VRM's own legs: the hip joints a little over the seat, the shins straight down to the ground
    const seatY = (anim.seat * anim.tiles) / s + ground;
    const sitHips = seatY + tall * 0.055;
    const sitLegTop = sitHips - (hipsY - legTop);
    const a = Math.acos(MathUtils.clamp((sitLegTop - ankleY - shin) / thigh, -0.85, 1));

    for (const b of bones) {
      if (!b.node) continue;
      const i = b.j * 3;
      _e.x = p[i];
      _e.y = p[i + 1];
      _e.z = p[i + 2];
      // (the pose is Euler XYZ, as the code body applies it)
      // legs: a shorter swing (STRIDE): at the code body's angles these long legs would step far further than the
      // ground covered
      const leg = b.j >= J.thL && b.j <= J.anR && b.j !== J.anL && b.j !== J.anR ? STRIDE : 1;
      _q.setFromEuler(_euler.set(_e.x * leg, _e.y, _e.z, 'XYZ'));
      if (b.how === 'armL') _q.multiply(REST_L);
      else if (b.how === 'armR') _q.multiply(REST_R);
      else if (b.how === 'foreL') _q.premultiply(REST_L_INV).multiply(REST_L);
      else if (b.how === 'foreR') _q.premultiply(REST_R_INV).multiply(REST_R);
      if (seat > 0.001) {
        const j = b.j;
        if (j === J.thL || j === J.thR) _q.slerp(_sit.setFromAxisAngle(X, -a), seat);
        else if (j === J.knL || j === J.knR) _q.slerp(_sit.setFromAxisAngle(X, a), seat);
        else if (j === J.anL || j === J.anR) _q.slerp(_sit.identity(), seat);
      }
      setJoint(b.node, _q);
    }
    if (hips) {
      const dx = p[C.hipX] * perDesign;
      const dz = p[C.hipZ] * perDesign;
      // (how far bent legs lower the hips goes with their length and with the square of the swing)
      const stand = hipsRest.y + p[C.hipY] * legRatio * STRIDE * STRIDE;
      const y = MathUtils.lerp(stand, hipsRest.y + (sitHips - hipsY), seat);
      hips.position.set(hipsRest.x + (old ? -dx : dx), y, hipsRest.z + (old ? -dz : dz));
    }

    // the face
    const ex = vrm.expressionManager;
    if (ex) {
      const eyes = EYES[anim.face.eyes];
      const mouth = MOUTH[anim.face.mouth];
      const goal: Record<string, number> = { blink: eyes.blink, happy: Math.max(eyes.happy, mouth.happy), surprised: eyes.surprised, aa: mouth.aa, oh: mouth.oh, relaxed: mouth.relaxed };
      const k = 1 - Math.exp(-22 * dt);
      for (const name of Object.keys(goal)) {
        weights[name] += (goal[name] - weights[name]) * k;
        ex.setValue(name, weights[name]);
      }
    }
    vrm.update(dt);
  };

  const headTop = ch.headTop.bind(ch);
  ch.headTop = (target: Vector3) => {
    if (!head) return headTop(target);
    head.getWorldPosition(target);
    target.y += tall * 0.14 * s;
    return target;
  };

  const setNight = ch.setNight.bind(ch);
  ch.setNight = (amount: number) => {
    setNight(amount);
    const k = MathUtils.clamp(amount, 0, 1);
    for (const t of tinted) {
      if (t.color && t.m.color) t.m.color.copy(t.color).lerp(_c.copy(t.color).multiply(NIGHT), k);
      if (t.shade && t.m.shadeColorFactor) t.m.shadeColorFactor.copy(t.shade).lerp(_c.copy(t.shade).multiply(NIGHT), k);
    }
  };

  const dispose = ch.dispose.bind(ch);
  ch.dispose = () => {
    ch.root.remove(holder);
    for (const m of worn) {
      m.geometry.dispose();
      (m.material as Material).dispose();
    }
    VRMUtils.deepDispose(vrm.scene);
    dispose();
  };
}

/**
 * Fewer draw calls: a VRoid export draws every lock of hair and every piece of clothing on its own (some 90 calls a
 * person). The outline pass is dropped (too thin to see from the town's camera, and it doubles every call), then
 * skinned meshes that share a material and have no morph targets are merged into one.
 */
function slim(scene: Object3D): void {
  const groups = new Map<string, SkinnedMesh[]>();
  scene.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    if (Array.isArray(m.material)) {
      // [surface, outline]: the surface alone
      const [surface, ...rest] = m.material as Material[];
      for (const r of rest) r.dispose();
      m.material = surface;
      m.geometry.clearGroups();
    }
    const g = m.geometry;
    if (Object.keys(g.morphAttributes).length > 0 || !g.index) return;
    const key = `${(m.material as Material).uuid}|${m.skeleton.uuid}|${Object.keys(g.attributes).sort().join(',')}`;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    let merged: BufferGeometry | null = null;
    try {
      merged = mergeGeometries(
        list.map((m) => m.geometry),
        false,
      );
    } catch {
      merged = null;
    }
    if (!merged) continue;
    const first = list[0];
    const one = new SkinnedMesh(merged, first.material);
    one.name = first.name;
    one.bind(first.skeleton, first.bindMatrix);
    one.renderOrder = first.renderOrder;
    first.parent?.add(one);
    for (const m of list) {
      m.removeFromParent();
      m.geometry.dispose();
    }
  }
}

const FRAME = '#4a3328';
const DARK = '#1d1b22';

/** One thing on the head, in the head's frame (+z = the way the face looks). `mid` = between the eyes, `gap` = eye to eye. */
function wear(frame: Group, extra: VrmExtra, mid: Vector3, gap: number, crown: number): Mesh[] {
  const out: Mesh[] = [];
  const add = (geo: BufferGeometry, color: string, x: number, y: number, z: number, o: { rx?: number; sy?: number; sz?: number; glass?: boolean } = {}): void => {
    const mat = new MeshStandardMaterial({ color, roughness: o.glass ? 0.25 : 0.9, metalness: 0, transparent: !!o.glass, opacity: o.glass ? 0.82 : 1 });
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = o.rx ?? 0;
    m.scale.set(1, o.sy ?? 1, o.sz ?? 1);
    m.castShadow = true;
    frame.add(m);
    out.push(m);
  };
  // measured on the samples (their eye bones sit 0.04 apart, deep in the head): the face's surface is about 2.3 gaps
  // in front of the head bone, the eyes as drawn about 0.8 of a gap either side, the skull about 2.4 gaps across
  const front = Math.abs(mid.z) + gap * 1.7;
  const y = mid.y + gap * 0.05;
  if (extra === 'glasses' || extra === 'sunglasses') {
    const r = gap * 0.66;
    const col = extra === 'sunglasses' ? DARK : FRAME;
    for (const k of [-1, 1]) {
      add(new TorusGeometry(r, r * 0.1, 6, 22), col, k * gap * 0.82, y, front);
      if (extra === 'sunglasses') add(new CylinderGeometry(r, r, r * 0.08, 22), '#16151b', k * gap * 0.82, y, front, { rx: Math.PI / 2, glass: true });
      // the arms, back to the ears
      add(new BoxGeometry(r * 0.1, r * 0.1, gap * 2.2), col, k * gap * 1.62, y, front - gap * 1.1);
    }
    add(new BoxGeometry(gap * 0.36, r * 0.1, r * 0.1), col, 0, y + r * 0.15, front);
  } else if (extra.startsWith('cap:')) {
    const color = extra.slice(4);
    const r = gap * 2.55;
    const base = crown * 0.56;
    add(new SphereGeometry(r, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), color, 0, base, -gap * 0.3, { sy: 0.8 });
    // the peak, out over the brow
    add(new CylinderGeometry(r * 0.72, r * 0.72, r * 0.06, 22, 1, false, -Math.PI / 2, Math.PI), color, 0, base + r * 0.05, r * 0.6, { sz: 1.2 });
    add(new SphereGeometry(r * 0.1, 8, 6), '#e2b743', 0, base + r * 0.32, r * 0.9);
  }
  return out;
}
