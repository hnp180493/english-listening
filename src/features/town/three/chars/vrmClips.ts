// Ready-made motion for the VRoid avatars, as a TRIAL (the owner, 2026-11-27, of the code-made walk: "tao vẫn không
// thấy tự nhiên chút nào? nó còn thua game này", his own game Giang Hồ, whose people move with Quaternius' Universal
// Animation Library, CC0). The clips are packed by scripts/anim-pack.mjs into public/anim/people.glb (a mannequin
// skeleton: pelvis, spine_01..03, neck_01, Head, clavicle, upperarm, lowerarm, hand, thigh, calf, foot, ball) and are
// carried over here to an avatar worn by ./vrmBody.ts, onto its RAW humanoid bones (VRoid's J_Bip_*, which rest with
// no rotation), after the code's pose each frame. Nothing in the game uses this yet: features/admin/ClipPreview.tsx
// shows it beside the code's motion.
//
// The retarget, per bone i, in the avatar's own model frame:
//   D_i  = W_i · R_i⁻¹        the source bone's turn away from its rest, in the source's world (W now, R at rest)
//   T_i  = F · D_i · F⁻¹ · A_i  the target bone's world turn (F: the source's axes to the avatar's, from up and left;
//                              A_i: from the avatar's T-pose direction of the bone to the source's rest direction, so
//                              the mannequin's A-pose rest is the avatar's rest too)
//   t_i  = T_parent⁻¹ · T_i    its local rotation (the raw bones rest with none)
// The pelvis' movement is carried over scaled by the two hips' heights, without its drift (the clips run in place).

import { AnimationClip, AnimationMixer, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, type AnimationAction, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** The clips, as the town names them (scripts/anim-pack.mjs). */
export type ClipName = 'idle' | 'walk' | 'jog' | 'sprint' | 'sit' | 'fold' | 'crouch' | 'consume';

/** Source bone → the avatar's raw bone (VRoid's names). */
const MAP: readonly [string, string][] = [
  ['pelvis', 'J_Bip_C_Hips'],
  ['spine_01', 'J_Bip_C_Spine'],
  ['spine_02', 'J_Bip_C_Chest'],
  ['spine_03', 'J_Bip_C_UpperChest'],
  ['neck_01', 'J_Bip_C_Neck'],
  ['Head', 'J_Bip_C_Head'],
  ...(['l', 'r'] as const).flatMap((s): [string, string][] => {
    const S = s.toUpperCase();
    return [
      [`clavicle_${s}`, `J_Bip_${S}_Shoulder`],
      [`upperarm_${s}`, `J_Bip_${S}_UpperArm`],
      [`lowerarm_${s}`, `J_Bip_${S}_LowerArm`],
      [`hand_${s}`, `J_Bip_${S}_Hand`],
      [`thigh_${s}`, `J_Bip_${S}_UpperLeg`],
      [`calf_${s}`, `J_Bip_${S}_LowerLeg`],
      [`foot_${s}`, `J_Bip_${S}_Foot`],
      [`ball_${s}`, `J_Bip_${S}_ToeBase`],
    ];
  }),
];
/** The bones whose rest direction is matched (to the next joint), source and target. */
const AIM: Readonly<Record<string, string>> = {
  clavicle_l: 'upperarm_l',
  upperarm_l: 'lowerarm_l',
  lowerarm_l: 'hand_l',
  thigh_l: 'calf_l',
  calf_l: 'foot_l',
  foot_l: 'ball_l',
  clavicle_r: 'upperarm_r',
  upperarm_r: 'lowerarm_r',
  lowerarm_r: 'hand_r',
  thigh_r: 'calf_r',
  calf_r: 'foot_r',
  foot_r: 'ball_r',
};
const TARGET_OF = new Map(MAP);
const PARENT: Readonly<Record<string, string>> = {
  spine_01: 'pelvis',
  spine_02: 'spine_01',
  spine_03: 'spine_02',
  neck_01: 'spine_03',
  Head: 'neck_01',
  clavicle_l: 'spine_03',
  clavicle_r: 'spine_03',
  upperarm_l: 'clavicle_l',
  upperarm_r: 'clavicle_r',
  lowerarm_l: 'upperarm_l',
  lowerarm_r: 'upperarm_r',
  hand_l: 'lowerarm_l',
  hand_r: 'lowerarm_r',
  thigh_l: 'pelvis',
  thigh_r: 'pelvis',
  calf_l: 'thigh_l',
  calf_r: 'thigh_r',
  foot_l: 'calf_l',
  foot_r: 'calf_r',
  ball_l: 'foot_l',
  ball_r: 'foot_r',
};

let clips: Promise<GLTF> | null = null;

/** The packed clips (fetched once). */
export function loadClips(url: string): Promise<GLTF> {
  if (!clips) clips = new GLTFLoader().loadAsync(url);
  return clips;
}

/** The axes of a body: x its left, y up, z its front (as a rotation from these axes into the frame they were read in). */
function bodyAxes(left: Vector3, up: Vector3): Quaternion {
  const u = up.clone().normalize();
  const l = left.clone().addScaledVector(u, -left.dot(u)).normalize();
  const f = new Vector3().crossVectors(l, u).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(l, u, f));
}

export interface ClipRig {
  mixer: AnimationMixer;
  actions: Record<ClipName, AnimationAction>;
  /**
   * The ground speed each clip's legs are made for (tiles a second at the avatar's scale `tilesPerUnit`), from how far
   * a foot travels against the hips in a cycle: a playback rate is the game's pace over this.
   */
  native: Record<ClipName, number>;
}

/**
 * The clips carried over to an avatar: `scene` is the VRM's scene (the `vrm` holder's child: chars/vrmBody.ts),
 * `tilesPerUnit` how many tiles one of its units is drawn as (for `native`). The mixer writes the raw bones: call its
 * update after the character's own update each frame.
 */
export function retarget(src: GLTF, scene: Object3D, tilesPerUnit: number): ClipRig {
  const root = src.scene;
  root.updateMatrixWorld(true);
  const sNode = (n: string): Object3D => {
    const o = root.getObjectByName(n);
    if (!o) throw new Error('clip skeleton has no ' + n);
    return o;
  };
  const tNode = (n: string): Object3D => {
    const o = scene.getObjectByName(n);
    if (!o) throw new Error('avatar has no ' + n);
    return o;
  };
  // ── rest: the source's world rest, the target's rest positions in the model frame (raw bones rest unrotated) ──
  const restQ = new Map<string, Quaternion>();
  const restP = new Map<string, Vector3>();
  for (const [s] of MAP) {
    const o = sNode(s);
    restQ.set(s, o.getWorldQuaternion(new Quaternion()));
    restP.set(s, o.getWorldPosition(new Vector3()));
  }
  const tPos = (name: string): Vector3 => {
    const p = new Vector3();
    for (let o: Object3D | null = tNode(name); o && o !== scene; o = o.parent) p.add(o.position);
    return p;
  };
  const tP = new Map<string, Vector3>();
  for (const [s, t] of MAP) tP.set(s, tPos(t));
  // F: the source's axes into the avatar's
  const sAxes = bodyAxes(restP.get('upperarm_l')!.clone().sub(restP.get('upperarm_r')!), restP.get('Head')!.clone().sub(restP.get('pelvis')!));
  const tAxes = bodyAxes(tP.get('upperarm_l')!.clone().sub(tP.get('upperarm_r')!), tP.get('Head')!.clone().sub(tP.get('pelvis')!));
  const F = tAxes.clone().multiply(sAxes.clone().invert());
  const Fi = F.clone().invert();
  // A: the avatar's T-pose direction of each aimed bone to the source's rest direction (in the avatar's frame)
  const A = new Map<string, Quaternion>();
  for (const [s] of MAP) {
    const next = AIM[s];
    if (!next) {
      A.set(s, new Quaternion());
      continue;
    }
    const want = restP.get(next)!.clone().sub(restP.get(s)!).applyQuaternion(F).normalize();
    const have = tP.get(next)!.clone().sub(tP.get(s)!).normalize();
    A.set(s, new Quaternion().setFromUnitVectors(have, want));
  }
  // the hips' heights (to the ball of the foot), for the pelvis' movement and the clips' ground speed
  const sHip = restP.get('pelvis')!.clone().sub(restP.get('ball_l')!).applyQuaternion(F).y;
  const tHip = tP.get('pelvis')!.y - tP.get('ball_l')!.y;
  const k = tHip / Math.max(1e-6, sHip);
  const hipsRest = tNode('J_Bip_C_Hips').position.clone();

  // ── bake each clip at 30 frames a second ──
  const mixer0 = new AnimationMixer(root);
  const out: AnimationClip[] = [];
  const native = {} as Record<ClipName, number>;
  const T = new Map<string, Quaternion>();
  const q = new Quaternion();
  const v = new Vector3();
  for (const clip of src.animations) {
    const name = clip.name as ClipName;
    const n = Math.max(2, Math.round(clip.duration * 30) + 1);
    const times = new Float32Array(n);
    const quats = new Map<string, Float32Array>(MAP.map(([s]) => [s, new Float32Array(n * 4)]));
    const hipPos = new Float32Array(n * 3);
    const action = mixer0.clipAction(clip);
    action.play();
    let footMin = Infinity;
    let footMax = -Infinity;
    for (let f = 0; f < n; f++) {
      const t = (f / (n - 1)) * clip.duration;
      times[f] = t;
      mixer0.setTime(t);
      root.updateMatrixWorld(true);
      for (const [s] of MAP) {
        const D = sNode(s).getWorldQuaternion(q.clone()).multiply(restQ.get(s)!.clone().invert());
        T.set(s, F.clone().multiply(D).multiply(Fi).multiply(A.get(s)!));
      }
      for (const [s] of MAP) {
        const p = PARENT[s];
        const local = p ? T.get(p)!.clone().invert().multiply(T.get(s)!) : T.get(s)!.clone();
        local.normalize().toArray(quats.get(s)!, f * 4);
      }
      // the pelvis moved from its rest, in the avatar's frame and size
      const pelvis = sNode('pelvis').getWorldPosition(v.clone());
      const d = pelvis.clone().sub(restP.get('pelvis')!).applyQuaternion(F).multiplyScalar(k);
      hipPos.set([d.x, d.y, d.z], f * 3);
      // how far a foot goes along the body's front against the pelvis (for the clip's own ground speed)
      const along = sNode('ball_l').getWorldPosition(v.clone()).sub(pelvis).applyQuaternion(F).applyQuaternion(tAxes.clone().invert()).z;
      footMin = Math.min(footMin, along);
      footMax = Math.max(footMax, along);
    }
    action.stop();
    // no drift: the mean of the horizontal movement taken away (the clips run in place)
    let mx = 0;
    let mz = 0;
    for (let f = 0; f < n; f++) {
      mx += hipPos[f * 3];
      mz += hipPos[f * 3 + 2];
    }
    mx /= n;
    mz /= n;
    for (let f = 0; f < n; f++) {
      hipPos[f * 3] = hipsRest.x + hipPos[f * 3] - mx;
      hipPos[f * 3 + 1] = hipsRest.y + hipPos[f * 3 + 1];
      hipPos[f * 3 + 2] = hipsRest.z + hipPos[f * 3 + 2] - mz;
    }
    const tracks = [...quats].map(([s, values]) => new QuaternionKeyframeTrack(`${TARGET_OF.get(s)}.quaternion`, times, values));
    tracks.push(new VectorKeyframeTrack('J_Bip_C_Hips.position', times, hipPos));
    out.push(new AnimationClip(name, clip.duration, tracks));
    // a foot goes back the whole stride while it is down, half the cycle: the ground speed is 2 strides a cycle
    const stride = (footMax - footMin) * k * tilesPerUnit;
    native[name] = /walk|jog|sprint/.test(name) ? (2 * stride) / clip.duration : 0;
  }
  mixer0.stopAllAction();
  mixer0.uncacheRoot(root);
  const mixer = new AnimationMixer(scene);
  const actions = {} as Record<ClipName, AnimationAction>;
  for (const c of out) actions[c.name as ClipName] = mixer.clipAction(c);
  return { mixer, actions, native };
}
