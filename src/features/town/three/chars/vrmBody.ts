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
import { HEAD } from './body';
import { hatGeometry } from './hats';
import { materials, nightTint } from './materials';
import { PROP_PLACES } from './person';
import { makeProp, type PropId, type PropRig } from './props';
import { RIDES } from '../scene/vehicles3d';
import type { Character3DPlus } from './person';
import { BASE_SKIN, type VrmWear } from '../../../../data/townVrm';
import type { VrmExtra } from '../../../../data/townVrm';
import { ageFace, beardMesh, scalpMesh } from './vrmAge';

/** The share of the code body's leg swing a VRM takes (its legs are about three times as long for the same pace). */
const STRIDE = 0.62;

/** How much taller than the code-built body a VRM stands (its head is small: at the same height it looks tiny). */
const TALLER = 1.45;

const Z = new Vector3(0, 0, 1);
/** T pose → arms down (a little out from the body, so the hands clear the hips). */
const REST_L = new Quaternion().setFromAxisAngle(Z, -(Math.PI / 2 - 0.02));
const REST_R = new Quaternion().setFromAxisAngle(Z, Math.PI / 2 - 0.02);
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
const NIGHT = new Color('#bcc2e4');

const _q = new Quaternion();
const _euler = new Euler();
const _c = new Color();
const _sit = new Quaternion();
const _gq = new Quaternion();
const PROPS: readonly PropId[] = ['cup', 'can', 'rod', 'book'];
const _v = new Vector3();

interface Tinted {
  m: Material & { color?: Color; shadeColorFactor?: Color };
  color: Color | null;
  shade: Color | null;
}

/** What `wearVrm` hands back: take the avatar off again (the code-built body shows as before). */
export interface Worn {
  undress(): void;
}

/**
 * Show `ch` as the VRM at `url` from now on. Resolves once it stands there; rejects when the file cannot be read
 * (the code-built body simply stays).
 */
export async function wearVrm(ch: Character3DPlus, url: string, opts: Partial<VrmWear> = {}, gone: () => boolean = () => false): Promise<Worn | null> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error('not a VRM: ' + url);
  // (the person left the stage while the file was coming)
  if (gone()) {
    VRMUtils.deepDispose(gltf.scene);
    return null;
  }
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  const old = vrm.meta.metaVersion === '0';
  slim(vrm.scene);
  const face = opts.face;
  const elder = face?.age === 'old';
  const tops = opts.tint ? paint(vrm.scene, opts.tint, elder) : [];
  // an older face, stubble: drawn on a copy of the face's texture (./vrmAge.ts; data/townVrm.ts VrmFace)
  if (face && (face.age || face.beard === 'stubble' || face.stubble)) ageFace(vrm.scene, face, seedOf(url), !!opts.bald);
  if (opts.bald)
    vrm.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && /_HAIR/.test((m.material as Material).name ?? '')) m.visible = false;
    });
  // a child: the head larger for the body (the samples are grown-ups)
  if (opts.head) vrm.humanoid.getRawBoneNode('head')?.scale.setScalar(opts.head);
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
  // the arms, for hands that reach a vehicle's bars: the shoulder joint, the lengths to the elbow and to the palm
  const shoulderAt = bone('leftUpperArm')?.getWorldPosition(new Vector3()) ?? new Vector3(0.1, hipsY + tall * 0.3, 0);
  const elbowAt = bone('leftLowerArm')?.getWorldPosition(new Vector3()) ?? shoulderAt;
  const wristAt = bone('leftHand')?.getWorldPosition(new Vector3()) ?? elbowAt;
  const upperArm = Math.max(0.01, shoulderAt.distanceTo(elbowAt));
  // (to the wrist: the hand then lies over the grip)
  const foreArm = Math.max(0.01, elbowAt.distanceTo(wristAt));
  const spineY = yOf('spine');
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

  // The head's own frame (+z the way the face looks: a VRM 0.x looks down -z in its own space), for what is worn on
  // it: glasses, a cap built in code (the samples have none), and a hat from the wardrobe.
  const worn: Mesh[] = [];
  const headFrame = head && headAt ? new Group() : null;
  // between the eyes, and eye to eye (a sample without eye bones: where the samples have them)
  const mid = eyeL && eyeR && headAt ? eyeL.clone().add(eyeR).multiplyScalar(0.5).sub(headAt) : new Vector3(0, 0.063, 0.03);
  const gap = eyeL && eyeR ? Math.max(0.02, Math.abs(eyeL.x - eyeR.x)) : 0.041;
  if (head && headFrame && headAt) {
    headFrame.rotation.y = old ? Math.PI : 0;
    head.add(headFrame);
    for (const e of opts.extras ?? []) worn.push(...wear(headFrame, e, mid, gap, box.max.y - headAt.y, faceFront(vrm.scene, headAt)));
    // a bald head: the crown closed in skin (the face mesh is open where the hair was)
    if (opts.bald) {
      const sc = scalpMesh(vrm.scene, headFrame, opts.tint?.skin ?? '#e8b892', mid.y);
      if (sc) worn.push(sc);
    }
    // a beard or a moustache grown from the face itself, in the beard's colour (one mesh)
    if (face?.beard) {
      const b = beardMesh(vrm.scene, head, face.beard, face.beardColor ?? opts.tint?.hair ?? '#3a2c26', gap);
      if (b) worn.push(b);
    }
  }
  /** An old body: a little stoop (the head held up against it) and a shorter step. */
  const stoop = elder ? 0.17 : 0;
  const stride = elder ? 0.78 : 1;

  // A hat of the wardrobe (chars/hats.ts: modelled round the code body's big head, so brought down to this one's).
  let hat: Mesh | null = null;
  const putHat = (id: string | null): void => {
    if (hat) {
      hat.removeFromParent();
      hat = null;
    }
    const h = id ? hatGeometry(id) : null;
    if (!h || !headFrame) return;
    hat = new Mesh(h.geometry, materials().body);
    hat.castShadow = true;
    // the skull with its hair is about 2.9 eye-gaps across; the hat sits on the head's middle as on the code body
    const k = (gap * 2.95) / HEAD.R;
    hat.scale.set(k * HEAD.stretch[0], k * HEAD.stretch[1], k * HEAD.stretch[2]);
    hat.position.set(0, mid.y + gap * 0.75, -gap * 0.25);
    hat.rotation.x = -0.05;
    headFrame.add(hat);
  };
  putHat(ch.hatId);

  // Things held (a cup, a watering can, a rod, a book): the avatar's own, in its right hand (the book in front of
  // the chest), shown by the same weights of the pose as the code body's, kept upright in the body's frame.
  const held = new Map<PropId, PropRig>();
  const hand = bone('rightHand');
  const knuckle = bone('rightMiddleProximal');
  const chest = bone('upperChest') ?? bone('chest') ?? bone('spine');
  // where the hand grips: between the wrist and the knuckles, in the hand's own frame
  const grip = new Vector3();
  if (hand) {
    const a = hand.getWorldPosition(new Vector3());
    const b = knuckle ? knuckle.getWorldPosition(new Vector3()) : a;
    grip.copy(hand.worldToLocal(a.clone().lerp(b, 0.7)));
  }
  const chestFrame = chest ? new Group() : null;
  if (chest && chestFrame) {
    chestFrame.rotation.y = old ? Math.PI : 0;
    chest.add(chestFrame);
  }
  let castPoint: Vector3 | null = null;

  const weights: Record<string, number> = { blink: 0, happy: 0, surprised: 0, aa: 0, oh: 0, relaxed: 0 };
  const setJoint = (node: Object3D, q: Quaternion): void => {
    if (old) node.quaternion.set(-q.x, q.y, -q.z, q.w);
    else node.quaternion.copy(q);
  };

  /** The avatar's own step (radians: a step every pi), run on by the ground it covers. */
  let gait = 0;
  /** The bike's cranks (radians). */
  let pedal = 0;
  const before = { update: ch.update, headTop: ch.headTop, setNight: ch.setNight, setOutfit: ch.setOutfit, dispose: ch.dispose, setHat: ch.setHat, castLine: ch.castLine };
  const update = ch.update.bind(ch);
  ch.update = (dt: number, speed: number) => {
    update(dt, speed);
    if (pivot) holder.rotation.y = pivot.rotation.y;
    const p = anim.pose;
    const seat = anim.seatBlend;
    const ride = seat > 0.001 ? ((ch as { ride?: string | null }).ride ?? null) : null;

    // seated on this VRM's own legs: the hip joints a little over the seat, the shins straight down to the ground
    const seatY = (anim.seat * anim.tiles) / s + ground;
    const sitHips = seatY + tall * 0.055;
    const sitLegTop = sitHips - (hipsY - legTop);
    const a = Math.acos(MathUtils.clamp((sitLegTop - ankleY - shin) / thigh, -0.85, 1));

    // The walk and the run are the avatar's OWN (owner, 2026-11-26, on the code body's gait copied over: "đi chẳng
    // tự nhiên gì cả, mày đánh tay để làm gì vậy?"; then on the first cycle written here, two straight legs swinging
    // like a pair of compasses: "chạy bộ nhìn vẫn gớm vậy"). `legCycle` is a leg through one stride: it folds at the
    // knee from toe-off through the swing, straightens to land and gives a little under the weight; running, the
    // body is in the air when the legs are furthest apart, not at its lowest.
    const walk = anim.move * (1 - seat);
    const run = anim.runShare;
    const swing = MathUtils.lerp(0.46, 0.74, run) * stride;
    const stepLen = Math.max(0.08, 2 * (thigh + shin) * s * Math.sin(swing));
    gait += (Math.abs(speed) / stepLen) * Math.PI * dt;
    const sn = Math.sin(gait);
    const legL = legCycle(gait, run, stride);
    const legR = legCycle(gait + Math.PI, run, stride);
    const armSwing = MathUtils.lerp(0.36, 0.72, run) * (elder ? 0.7 : 1);
    const elbow = MathUtils.lerp(0.22, 1.45, run);
    const lean = MathUtils.lerp(0.04, 0.2, run);
    const twist = MathUtils.lerp(0.07, 0.14, run);

    // On a vehicle (engine3d tells which through `ride`): a bike is pedalled, the feet going round with the ground
    // covered (owner: "đạp xe đạp thì nhìn như dị tật chân còn không có animation đạp xe?", on legs hung either side
    // of it); a scooter and a motorbike are ridden knees forward, a horse astride, a car with the legs out in front.
    // Hands on the bars (owner, 2026-11-26, on arms held out in the air: "lái xe kiểu gì đây, tay còn không cầm tay
    // lái?"): where the vehicle's bars are (scene/vehicles3d.ts, in its own units, scaled as the engine scales it),
    // reached by the two bones of the arm from where the shoulder is once seated and leaning.
    let reach: Leg | null = null;
    let reachOut = 0;
    const bars = ride ? BARS[ride] : undefined;
    const spec = ride && Object.hasOwn(RIDES, ride) ? RIDES[ride as keyof typeof RIDES] : undefined;
    if (bars && spec) {
      // (the engine gives the seat's height already scaled: that tells how large the vehicle is drawn)
      const u = ((anim.seat * anim.tiles) / spec.seat) / s;
      const torso = shoulderAt.y - spineY;
      // the rider leans as far as it takes for the hands to get there with the elbows still a little bent (these toy
      // vehicles' bars are a long way from the seat), from the vehicle's own lean up to a racing crouch
      let lean = bars.lean;
      let dy = 0;
      let dz = 0;
      for (; ; lean += 0.04) {
        dy = ground + bars.y * u - (sitHips + (spineY - hipsY) + torso * Math.cos(lean));
        dz = (bars.x - spec.seatAt) * u - torso * Math.sin(lean);
        if (Math.hypot(dy, dz) <= (upperArm + foreArm) * 0.94 || lean >= 0.7) break;
      }
      reach = armTo(dy, dz, upperArm, foreArm);
      // (in the leaning chest's own frame; the lean itself rides along for the spine and the head)
      reach.thigh -= lean;
      reach.ankle = lean;
      reachOut = Math.atan2(bars.z * u - Math.abs(shoulderAt.x), Math.hypot(dy, dz));
    }
    let pedalL: Leg | null = null;
    let pedalR: Leg | null = null;
    if (ride === 'bike') {
      // (the angle runs down: over the top a foot goes FORWARD. Counting up, the rider pedalled backwards: owner,
      // 2026-11-26, "đạp xe mà sao chân lại đạp ngược?")
      pedal -= (Math.abs(speed) / PEDAL_TILES) * Math.PI * 2 * dt;
      const reach = thigh + shin;
      const r = reach * 0.17;
      // the cranks' axle: as far under the hips as the legs like, but never so low that a pedal goes into the ground
      const axleY = Math.max(sitLegTop - reach * 0.84, ground + (ankleY - ground) + r + tall * 0.03);
      const axleZ = reach * 0.16;
      pedalL = legTo(axleY + r * Math.sin(pedal) - sitLegTop, axleZ + r * Math.cos(pedal), thigh, shin);
      pedalR = legTo(axleY + r * Math.sin(pedal + Math.PI) - sitLegTop, axleZ + r * Math.cos(pedal + Math.PI), thigh, shin);
    }

    for (const b of bones) {
      if (!b.node) continue;
      const i = b.j * 3;
      // (the pose is Euler XYZ, as the code body applies it; the code body's own leg swing is for its stubby legs)
      const own = b.j >= J.thL && b.j <= J.knR && b.j !== J.anL ? STRIDE : 1;
      _q.setFromEuler(_euler.set(p[i] * own, p[i + 1], p[i + 2], 'XYZ'));
      const left = b.j === J.thL || b.j === J.knL || b.j === J.anL || b.j === J.shL || b.j === J.elL;
      const side = left ? 1 : -1;
      if (walk > 0.001) {
        // (in the code body's frame: arms and legs hang down, +x turns a limb back, -x forward)
        const leg = left ? legL : legR;
        let gx: number | null = null;
        let gy = 0;
        let gz = 0;
        switch (b.j) {
          case J.thL:
          case J.thR:
            gx = leg.thigh;
            break;
          case J.knL:
          case J.knR:
            gx = leg.knee;
            break;
          case J.anL:
          case J.anR:
            gx = leg.ankle;
            break;
          case J.shL:
          case J.shR:
            // an arm goes back as its own leg comes forward; running it is carried a little ahead
            gx = armSwing * sn * side - 0.12 * run;
            gz = side * MathUtils.lerp(0.06, 0.15, run);
            break;
          case J.elL:
          case J.elR:
            gx = -(elbow + 0.2 * Math.max(0, -sn * side));
            break;
          case J.spine:
            gx = lean;
            gy = twist * sn;
            break;
          case J.hips:
            gx = 0;
            gy = -0.5 * twist * sn;
            break;
          default:
            break;
        }
        if (gx !== null) _q.slerp(_gq.setFromEuler(_euler.set(gx, gy, gz, 'XYZ')), walk);
      }
      if (seat > 0.001) {
        // (still in the code body's frame)
        const j = b.j;
        const pose = ridePose(ride, j, side, left ? pedalL : pedalR, a, reach, reachOut);
        if (pose) _q.slerp(_sit.setFromEuler(_euler.set(pose[0], pose[1], pose[2], 'XYZ')), seat);
      }
      // an old body's stoop, standing and walking (seated and riding: the seat's pose as it is)
      if (stoop > 0 && (b.j === J.spine || b.j === J.head)) _q.multiply(_gq.setFromEuler(_euler.set((b.j === J.spine ? stoop : -0.6 * stoop) * (1 - seat), 0, 0, 'XYZ')));
      if (b.how === 'armL') _q.multiply(REST_L);
      else if (b.how === 'armR') _q.multiply(REST_R);
      else if (b.how === 'foreL') _q.premultiply(REST_L_INV).multiply(REST_L);
      else if (b.how === 'foreR') _q.premultiply(REST_R_INV).multiply(REST_R);
      setJoint(b.node, _q);
    }
    if (hips) {
      const dx = p[C.hipX] * perDesign;
      const dz = p[C.hipZ] * perDesign;
      // (how far bent legs lower the hips goes with their length and with the square of the swing)
      const stand = hipsRest.y + p[C.hipY] * legRatio * STRIDE * STRIDE;
      // walking, the hips dip as the legs spread; running, the body is up in the air then and down on the foot between
      const dip = MathUtils.lerp((thigh + shin) * (1 - Math.cos(swing)) * sn * sn * 0.7, tall * (0.03 - 0.045 * sn * sn), run);
      const up = MathUtils.lerp(stand, hipsRest.y - dip, walk);
      const y = MathUtils.lerp(up, hipsRest.y + (sitHips - hipsY), seat);
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
    // what is in the hand
    for (const pid of PROPS) {
      const place = PROP_PLACES[pid];
      const w = p[place.channel];
      let r = held.get(pid);
      if (w < 0.02) {
        if (r) r.root.visible = false;
        continue;
      }
      const parent = pid === 'book' ? chestFrame : hand;
      if (!parent) continue;
      if (!r) {
        r = makeProp(pid, materials().body);
        parent.add(r.root);
        held.set(pid, r);
      }
      r.root.visible = true;
      const k = MathUtils.clamp(w, 0, 1);
      // (pops in with a small overshoot, as on the code body; a little larger: this hand is)
      const size = ((anim.tiles * 1.5) / s) * Math.max(0.001, 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));
      r.root.scale.setScalar(size);
      if (pid === 'book') {
        r.root.position.set(0, tall * 0.02, tall * 0.16);
        // (held up a little more than on the code body: this reader looks down at it from higher)
        r.root.rotation.set(-1.0, place.rot[1], place.rot[2]);
      } else {
        r.root.position.copy(grip);
        // upright in the body's frame whatever the arm does: undo the hand's turn, then the thing's own angle
        const tilt = pid === 'cup' ? -1.0 * p[C.sip] : pid === 'can' ? p[C.canTilt] : -0.35 * p[C.tug];
        parent.getWorldQuaternion(_q);
        holder.getWorldQuaternion(_gq);
        r.root.quaternion.copy(_q.invert()).multiply(_gq).multiply(_sit.setFromEuler(_euler.set(place.rot[0] + tilt, place.rot[1], place.rot[2], 'XYZ')));
      }
      if (pid === 'can') r.tick(dt, p[C.canTilt] * k);
      else if (pid === 'rod') {
        r.aim?.(castPoint);
        r.tick(dt, p[C.tug]);
      }
    }
    vrm.update(dt);
  };

  const headTop = ch.headTop.bind(ch);
  ch.headTop = (target: Vector3) => {
    if (!head) return headTop(target);
    head.getWorldPosition(target);
    target.y += tall * 0.14 * s * (opts.head ?? 1);
    return target;
  };

  let night = 0;
  const setNight = ch.setNight.bind(ch);
  ch.setNight = (amount: number) => {
    setNight(amount);
    const k = MathUtils.clamp(amount, 0, 1);
    night = k;
    for (const t of tinted) {
      if (t.color && t.m.color) t.m.color.copy(t.color).lerp(_c.copy(t.color).multiply(NIGHT), k);
      if (t.shade && t.m.shadeColorFactor) t.m.shadeColorFactor.copy(t.shade).lerp(_c.copy(t.shade).multiply(NIGHT), k);
    }
  };

  // an outfit colour picked in the wardrobe: the top takes it (a tintable avatar only)
  const setOutfit = ch.setOutfit.bind(ch);
  ch.setOutfit = (color: string | null) => {
    setOutfit(color);
    if (!opts.tint || tops.length === 0) return;
    _c.set(color ?? opts.tint.top);
    for (const top of tops) {
      const entry = tinted.find((x) => x.m === top.m);
      if (!entry) continue;
      if (entry.color) entry.color.copy(top.color).multiply(_c);
      if (entry.shade && top.shade) entry.shade.copy(top.shade).multiply(_c);
    }
    ch.setNight(night);
  };

  // the wardrobe's hat goes on this head too; the fishing line needs its float
  const setHat = ch.setHat.bind(ch);
  ch.setHat = (id: string | null) => {
    setHat(id);
    putHat(id);
  };
  const castLine = ch.castLine.bind(ch);
  ch.castLine = (point: Vector3 | null) => {
    castLine(point);
    castPoint = point;
  };

  let off = false;
  const strip = (): void => {
    if (off) return;
    off = true;
    ch.root.remove(holder);
    // (out of the tree first: the hat's geometry and the toon material are shared, deepDispose must not free them)
    hat?.removeFromParent();
    for (const r of held.values()) r.root.removeFromParent();
    for (const m of worn) {
      m.geometry.dispose();
      (m.material as Material).dispose();
    }
    VRMUtils.deepDispose(vrm.scene);
  };
  const dispose = ch.dispose.bind(ch);
  ch.dispose = () => {
    strip();
    dispose();
  };
  // (the scene's night as it is now)
  ch.setNight(nightTint());
  return {
    undress() {
      if (off) return;
      strip();
      ch.update = before.update;
      ch.headTop = before.headTop;
      ch.setNight = before.setNight;
      ch.setOutfit = before.setOutfit;
      ch.dispose = before.dispose;
      ch.setHat = before.setHat;
      ch.castLine = before.castLine;
      if (pivot) pivot.visible = true;
    },
  };
}

interface TopPaint {
  m: Tinted['m'];
  color: Color;
  shade: Color | null;
}

/**
 * A tintable avatar (scripts/vrm-bake.py bakes its hair and clothes white and its skin to BASE_SKIN) in somebody's
 * own colours: each material's colour is multiplied by the look's. Returns the top's materials as they were before
 * their colour (the wardrobe repaints them).
 */
function paint(scene: Object3D, tint: NonNullable<VrmWear['tint']>, oldBrows = false): TopPaint[] {
  const seen = new Set<Material>();
  const tops: TopPaint[] = [];
  const skin = new Color(tint.skin);
  const ref = new Color(BASE_SKIN);
  skin.setRGB(Math.min(1.15, skin.r / ref.r), Math.min(1.15, skin.g / ref.g), Math.min(1.15, skin.b / ref.b));
  const hair = new Color(tint.hair);
  // (an old face: the brows as pale as the hair, a little paler)
  const brow = oldBrows ? hair.clone().lerp(new Color('#ffffff'), 0.25) : hair.clone().multiplyScalar(0.75);
  const top = new Color(tint.top);
  const bottom = new Color(tint.bottom);
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Tinted['m'][]) {
      if (seen.has(m)) continue;
      seen.add(m);
      const n = m.name ?? '';
      const isTop = /Tops|Onepiece/i.test(n);
      const c = n.endsWith('_SKIN') ? skin : /_HAIR/.test(n) ? hair : /FaceBrow/.test(n) ? brow : isTop ? top : /Bottoms|AccessoryNeck/i.test(n) ? bottom : null;
      if (!c) continue;
      if (isTop && m.color?.isColor) tops.push({ m, color: m.color.clone(), shade: m.shadeColorFactor?.isColor ? m.shadeColorFactor.clone() : null });
      m.color?.multiply(c);
      m.shadeColorFactor?.multiply(c);
    }
  });
  return tops;
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

/** A stable number for an avatar's file (the stubble's dots fall the same way every time). */
function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const FRAME = '#4a3328';
const DARK = '#1d1b22';

/** One thing on the head, in the head's frame (+z = the way the face looks). `mid` = between the eyes, `gap` = eye to eye. */
/**
 * How far in front of the head bone the face reaches (its nose), in the VRM's units: from the face mesh's own box.
 * Null when there is no mesh called a face.
 */
function faceFront(scene: Object3D, headAt: Vector3): number | null {
  let far = 0;
  scene.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh || !/face/i.test(m.name)) return;
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox;
    // (the mesh's own space looks down -z or +z; the face is the far side from the head bone either way)
    if (b) far = Math.max(far, Math.abs(b.min.z), Math.abs(b.max.z));
  });
  return far > 0 ? far - Math.abs(headAt.z) : null;
}

function wear(frame: Group, extra: VrmExtra, mid: Vector3, gap: number, crown: number, nose: number | null): Mesh[] {
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
  // glasses rest on the nose: a little behind its tip
  const front = nose !== null ? nose - gap * 0.2 : Math.abs(mid.z) + gap * 1.9;
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
  } else if (extra === 'shades-up') {
    // sunglasses pushed up into the hair
    const r = gap * 0.6;
    const yy = crown * 0.93;
    const zz = front * 0.5;
    for (const k of [-1, 1]) {
      add(new CylinderGeometry(r, r, r * 0.1, 20), '#16151b', k * gap * 0.8, yy, zz, { rx: Math.PI / 2 - 0.75, glass: true });
      add(new TorusGeometry(r, r * 0.12, 6, 20), DARK, k * gap * 0.8, yy, zz, { rx: -0.75 });
    }
    add(new BoxGeometry(gap * 0.4, r * 0.12, r * 0.12), DARK, 0, yy + r * 0.1, zz);
  } else if (extra === 'flowers') {
    // a crown of little flowers round the hair
    const ring = gap * 2.9;
    const yy = crown * 0.62;
    const cols = ['#f7a8c0', '#fbd3df', '#f48fb1', '#fff1f5'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      // (the front half only: the back is under the hair)
      if (Math.cos(a) < -0.35) continue;
      add(new SphereGeometry(gap * 0.5, 8, 6), cols[i % cols.length], Math.sin(a) * ring, yy + Math.cos(a) * gap * 0.25, Math.cos(a) * ring * 0.92 - gap * 0.35);
    }
  } else if (extra.startsWith('bun:')) {
    // hair done up in a bun, behind the crown
    const color = extra.slice(4);
    add(new SphereGeometry(gap * 1.6, 14, 10), color, 0, crown * 1.04, -gap * 1.1, { sy: 0.88 });
    add(new TorusGeometry(gap * 1.0, gap * 0.24, 6, 14), color, 0, crown * 0.86, -gap * 1.05, { rx: Math.PI / 2 - 0.35 });
  } else if (extra.startsWith('peaked:')) {
    // a uniform's peaked cap: a band round the head, a crown wider than the band, a visor, a badge
    const color = extra.slice(7);
    const r = gap * 2.85;
    const base = crown * 0.52;
    add(new CylinderGeometry(r, r, r * 0.36, 24), color, 0, base + r * 0.18, -gap * 0.3);
    add(new CylinderGeometry(r * 1.22, r * 1.02, r * 0.42, 24), color, 0, base + r * 0.56, -gap * 0.3);
    add(new CylinderGeometry(r * 1.02, r * 1.02, r * 0.07, 24), '#d6a740', 0, base + r * 0.34, -gap * 0.3);
    add(new CylinderGeometry(r * 0.86, r * 0.86, r * 0.05, 24, 1, false, -Math.PI / 2, Math.PI), '#15171f', 0, base + r * 0.04, r * 0.55, { sz: 1.25 });
    add(new SphereGeometry(r * 0.16, 10, 8), '#e2b743', 0, base + r * 0.56, r * 0.98, { sz: 0.5 });
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

/** A leg's turn at the hip, the knee and the ankle (radians about x in the code body's frame: - forward, + back). */
interface Leg {
  thigh: number;
  knee: number;
  ankle: number;
}

/**
 * A leg at `phi` of a stride (the left leg at the gait's own phase, the right half a turn on), walking (run 0) to
 * running (run 1). From -pi/2 to pi/2 the leg swings forward: it leaves the ground bent, folds further as it comes
 * through and opens out to land; from pi/2 to 3pi/2 it is on the ground going back, giving a little under the weight.
 */
function legCycle(phi: number, run: number, stride = 1): Leg {
  const TWO = Math.PI * 2;
  const u = ((((phi + Math.PI / 2) % TWO) + TWO) % TWO) / Math.PI;
  const mix = (a: number, b: number): number => a + (b - a) * run;
  const amp = mix(0.46, 0.74) * stride;
  // (the knee is lifted further forward than the leg is left behind)
  const thigh = -amp * Math.sin(phi) - mix(0.04, 0.16);
  const off = mix(0.42, 0.95);
  const land = mix(0.04, 0.26);
  let knee: number;
  let ankle: number;
  if (u < 1) {
    knee = off + (land - off) * u + mix(0.7, 1.05) * Math.pow(Math.sin(Math.PI * u), 1.2);
    // the toes point down as the foot leaves, the foot comes level (walking: heel first) to land
    ankle = (0.45 + (-0.16 - 0.45) * Math.min(1, u * 1.5)) * mix(0.7, 1);
  } else {
    const v = u - 1;
    knee = land + (off - land) * v * v + mix(0.1, 0.3) * Math.sin(Math.PI * v);
    ankle = (-0.16 + (0.45 + 0.16) * v * v * v) * mix(0.7, 1);
  }
  return { thigh, knee, ankle };
}

/**
 * The leg that puts its ankle `dy` below and `dz` in front of its hip joint (thigh and shin lengths `t`, `s`): the
 * knee forward, the foot kept level. For a pedal.
 */
function legTo(dy: number, dz: number, t: number, s: number): Leg {
  const d = MathUtils.clamp(Math.hypot(dy, dz), Math.abs(t - s) + 0.01, t + s - 0.004);
  const knee = Math.PI - Math.acos(MathUtils.clamp((t * t + s * s - d * d) / (2 * t * s), -1, 1));
  const lift = Math.atan2(dz, -dy) + Math.acos(MathUtils.clamp((t * t + d * d - s * s) / (2 * t * d), -1, 1));
  return { thigh: -lift, knee, ankle: lift - knee };
}

/**
 * The arm that puts its palm `dy` below and `dz` in front of its shoulder (upper arm and forearm lengths `u`, `f`):
 * the elbow down and back, the forearm bent forward. Angles as a Leg's: `thigh` the upper arm, `knee` the forearm.
 */
function armTo(dy: number, dz: number, u: number, f: number): Leg {
  const d = MathUtils.clamp(Math.hypot(dy, dz), Math.abs(u - f) + 0.01, u + f - 0.004);
  const bend = Math.PI - Math.acos(MathUtils.clamp((u * u + f * f - d * d) / (2 * u * f), -1, 1));
  const raise = Math.atan2(dz, -dy) - Math.acos(MathUtils.clamp((u * u + d * d - f * f) / (2 * u * d), -1, 1));
  return { thigh: -raise, knee: -bend, ankle: 0 };
}

/**
 * Where the grips of a vehicle's bars are in its own model (scene/vehicles3d.ts: x forward, y up, z half the bars'
 * width; read off its code on 2026-11-26), and how far the rider leans to them.
 */
const BARS: Readonly<Record<string, { x: number; y: number; z: number; lean: number }>> = {
  bike: { x: 0.21, y: 0.47, z: 0.14, lean: 0.3 },
  scooter: { x: 0.23, y: 0.49, z: 0.13, lean: 0.12 },
  motorbike: { x: 0.24, y: 0.56, z: 0.17, lean: 0.28 },
};

/** One turn of a bike's cranks for this many tiles of ground. */
const PEDAL_TILES = 2.3;

/**
 * Somebody seated: the turn of joint `j` (Euler XYZ in the code body's frame), or null to leave what the code body's
 * own sit pose gives. `side` is 1 on the left, -1 on the right; `a` the angle that puts the feet flat on the ground
 * from an ordinary seat.
 */
function ridePose(ride: string | null, j: number, side: number, pedal: Leg | null, a: number, reach: Leg | null, out: number): [number, number, number] | null {
  const thigh = j === J.thL || j === J.thR;
  const knee = j === J.knL || j === J.knR;
  const ankle = j === J.anL || j === J.anR;
  const upper = j === J.shL || j === J.shR;
  const fore = j === J.elL || j === J.elR;
  switch (ride) {
    case 'bike':
      if (thigh && pedal) return [pedal.thigh, 0, side * 0.05];
      if (knee && pedal) return [pedal.knee, 0, 0];
      if (ankle && pedal) return [pedal.ankle, 0, 0];
      // leaning onto the handlebars
      if (upper) return reach ? [reach.thigh, 0, side * out] : [-1.0, 0, side * 0.1];
      if (fore) return reach ? [reach.knee, 0, 0] : [-0.3, 0, 0];
      if (j === J.spine) return [reach ? reach.ankle : BARS.bike.lean, 0, 0];
      if (j === J.head) return [reach ? -0.75 * reach.ankle : -0.22, 0, 0];
      return null;
    case 'scooter':
    case 'motorbike':
      // knees forward, the feet on the boards
      if (thigh) return [-1.2, 0, side * 0.16];
      if (knee) return [1.25, 0, 0];
      if (ankle) return [-0.05, 0, 0];
      if (upper) return reach ? [reach.thigh, 0, side * out] : [-0.95, 0, side * 0.14];
      if (fore) return reach ? [reach.knee, 0, 0] : [-0.35, 0, 0];
      if (j === J.spine) return [reach ? reach.ankle : BARS[ride].lean, 0, 0];
      if (j === J.head) return [reach ? -0.75 * reach.ankle : -0.1, 0, 0];
      return null;
    case 'horse':
      // astride, the legs round its sides, the hands low on the reins
      if (thigh) return [-0.62, 0, side * 0.52];
      if (knee) return [0.8, 0, 0];
      if (ankle) return [-0.15, 0, 0];
      if (upper) return [-0.5, 0, side * 0.06];
      if (fore) return [-0.75, 0, 0];
      return null;
    case 'car':
    case 'sportscar':
      // down in the seat, the legs out in front, the hands on the wheel
      if (thigh) return [-1.42, 0, side * 0.06];
      if (knee) return [0.75, 0, 0];
      if (ankle) return [-0.2, 0, 0];
      if (upper) return [-0.85, 0, side * 0.05];
      if (fore) return [-0.5, 0, 0];
      return null;
    default:
      // a bench, a chair, a stool
      if (thigh) return [-a, 0, 0];
      if (knee) return [a, 0, 0];
      if (ankle) return [0, 0, 0];
      return null;
  }
}
