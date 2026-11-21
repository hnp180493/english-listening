// Pets (data/townGame.ts loot) and the town cat, built in code in the same soft style: one skinned mesh each
// (1 draw call), bead eyes that blink, a gait driven by the distance walked (trot, waddle, hop, crawl) and a little
// idle life (tail wag, ears, looking about, sitting down after a while).

import { Bone, Color, Group, Matrix4, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import type { Pet3D } from '../contracts';
import { angleDelta, approach, clamp, lerp, smoothstep, Spring } from './anim';
import { along, type Detail, FULL, GeoBuilder, lathe, mat, smoothProfile, sphere, taperBetween, type Vec3 } from './build';
import { hashString, rng } from './looks';
import { materials } from './materials';

/** Pet bones. Birds use the back legs as wings. */
export const P = { body: 0, head: 1, tail: 2, tail2: 3, fl: 4, fr: 5, bl: 6, br: 7, earL: 8, earR: 9, eyes: 10 } as const;
const PET_BONES = 11;
const PARENT = [-1, P.body, P.body, P.tail, P.body, P.body, P.body, P.body, P.head, P.head, P.head];

export type Gait = 'trot' | 'waddle' | 'hop' | 'crawl';

export interface PetSpec {
  gait: Gait;
  /** Tiles one gait cycle carries the pet. */
  stride: number;
  /** Whether it sits down after standing a while. */
  sits: boolean;
}

export const PET_SPECS: Readonly<Record<string, PetSpec>> = {
  'cho-con': { gait: 'trot', stride: 0.3, sits: true },
  'meo-muop': { gait: 'trot', stride: 0.28, sits: true },
  cat: { gait: 'trot', stride: 0.28, sits: true },
  cao: { gait: 'trot', stride: 0.32, sits: true },
  'gau-truc': { gait: 'trot', stride: 0.24, sits: true },
  vit: { gait: 'waddle', stride: 0.16, sits: false },
  'ga-con': { gait: 'waddle', stride: 0.12, sits: false },
  tho: { gait: 'hop', stride: 0.32, sits: false },
  rua: { gait: 'crawl', stride: 0.12, sits: false },
};

/** Gait phase after moving `distance` tiles. */
export function petPhaseAdvance(phase: number, distance: number, petId: string): number {
  const s = PET_SPECS[petId] ?? PET_SPECS.cat;
  return phase + (Math.PI * 2 * distance) / s.stride;
}

interface Built {
  b: GeoBuilder;
  bones: Vec3[];
}

const C = (hex: string) => new Color(hex);

/** Bead eyes with a highlight, on the eyes bone (it scales flat to blink). */
function eyes(b: GeoBuilder, at: Vec3, spread: number, r: number, d: Detail, yaw = 0.35): void {
  for (const side of [1, -1]) {
    const x = at[0] + side * spread;
    b.add(sphere(r, d, 12, 10), mat([x, at[1], at[2]], [0, 0, 0], [1, 1.15, 0.7]), C('#231c22'), { bone: P.eyes });
    b.add(sphere(r * 0.38, d, 8, 6), mat([x - r * 0.3 + side * 0.002, at[1] + r * 0.38, at[2] + r * 0.55 * Math.cos(yaw)]), C('#ffffff'), { bone: P.eyes });
  }
}

function blush(b: GeoBuilder, at: Vec3, spread: number, r: number, d: Detail): void {
  for (const side of [1, -1]) b.add(sphere(r, d, 10, 6), mat([at[0] + side * spread, at[1], at[2]], [0, side * 0.5, 0], [1, 0.55, 0.3]), C('#f4a3a8'), { bone: P.head });
}

function base(): Built {
  const bones: Vec3[] = [];
  for (let i = 0; i < PET_BONES; i++) bones.push([0, 0, 0]);
  return { b: new GeoBuilder(), bones };
}

/** Quadruped: dog, cats, fox, panda. */
function quad(kind: string, d: Detail): Built {
  const out = base();
  const { b, bones } = out;
  const pal: Record<string, { body: string; belly: string; ear: string; legs: string; tail: string; tip?: string; nose: string; stripes?: string }> = {
    'cho-con': { body: '#eac393', belly: '#fbf1e2', ear: '#a8714a', legs: '#eac393', tail: '#eac393', nose: '#2b2224' },
    cat: { body: '#f2a65e', belly: '#fff4e6', ear: '#f2a65e', legs: '#f2a65e', tail: '#f2a65e', tip: '#fff4e6', nose: '#e98a96', stripes: '#d9853f' },
    'meo-muop': { body: '#b4ada6', belly: '#f4f1ec', ear: '#b4ada6', legs: '#b4ada6', tail: '#b4ada6', nose: '#e98a96', stripes: '#7d746d' },
    cao: { body: '#f0873a', belly: '#fff5ea', ear: '#f0873a', legs: '#4a3532', tail: '#f0873a', tip: '#fff5ea', nose: '#2b2224' },
    'gau-truc': { body: '#f7f5f0', belly: '#f7f5f0', ear: '#2d2a2e', legs: '#2d2a2e', tail: '#f7f5f0', nose: '#2d2a2e' },
  };
  const p = pal[kind];
  const panda = kind === 'gau-truc';
  const catty = kind === 'cat' || kind === 'meo-muop';
  const fox = kind === 'cao';
  const dog = kind === 'cho-con';
  const bodyC = C(p.body);
  const fat = panda ? 1.22 : 1;
  const legLen = panda ? 0.075 : 0.09;
  const bodyY = legLen + 0.06 * fat;
  bones[P.body] = [0, bodyY, 0];
  // body: a soft bean, belly lighter
  const bellyC = C(p.belly);
  const stripes = p.stripes ? C(p.stripes) : null;
  const paint = (pp: Vector3, n: Vector3) => {
    if (n.y < -0.35 || (n.z > 0.55 && pp.y < bodyY + 0.02)) return bellyC;
    if (stripes && Math.sin(pp.z * 95) > 0.55 && n.y > -0.1) return stripes;
    return null;
  };
  b.add(sphere(1, d, 22, 14), mat([0, bodyY, 0], [0, 0, 0], [0.07 * fat, 0.066 * fat, 0.115 * fat]), bodyC, { bone: P.body, paint });
  // legs (shoulder / hip joints at the body's bottom)
  const legC = C(p.legs);
  const legs: Array<[number, number, number]> = [
    [P.fl, 0.042, 0.06],
    [P.fr, -0.042, 0.06],
    [P.bl, 0.042, -0.06],
    [P.br, -0.042, -0.06],
  ];
  for (const [bone, x, z] of legs) {
    const top: Vec3 = [x * fat, bodyY - 0.02, z * fat];
    bones[bone] = top;
    taperBetween(b, top, [x * fat, 0.022, z * fat], 0.026 * fat, 0.022 * fat, legC, { bone }, d);
    b.add(sphere(0.026 * fat, d, 10, 8), mat([x * fat, 0.018, z * fat + 0.008], [0, 0, 0], [1, 0.75, 1.2]), dog || catty ? bellyC : legC, { bone });
  }
  // head on the neck
  const neck: Vec3 = [0, bodyY + 0.04, 0.075 * fat];
  bones[P.head] = neck;
  const hc: Vec3 = [0, bodyY + 0.095, 0.115 * fat];
  const hr = panda ? 0.085 : catty ? 0.078 : 0.08;
  b.add(sphere(hr, d, 22, 16), mat(hc, [0, 0, 0], [1.08, 0.96, 0.95]), bodyC, { bone: P.head, paint: (pp) => (dog && pp.y < hc[1] - 0.04 && pp.z > hc[2] ? bellyC : null) });
  // muzzle and nose
  const mz: Vec3 = [0, hc[1] - 0.025, hc[2] + hr * 0.82];
  b.add(sphere(fox ? 0.036 : 0.034, d, 14, 10), mat(mz, [0, 0, 0], fox ? [0.95, 0.75, 1.5] : [1.2, 0.8, 0.9]), bellyC, { bone: P.head });
  b.add(sphere(0.011, d, 10, 8), mat([0, mz[1] + 0.012, mz[2] + (fox ? 0.05 : 0.03)], [0, 0, 0], [1.3, 0.9, 1]), C(p.nose), { bone: P.head });
  // eyes (panda: on black patches)
  const eyeAt: Vec3 = [0, hc[1] + 0.012, hc[2] + hr * 0.84];
  bones[P.eyes] = [0, eyeAt[1], eyeAt[2]];
  if (panda) {
    for (const side of [1, -1]) b.add(sphere(0.026, d, 12, 8), mat([side * 0.036, eyeAt[1] - 0.004, eyeAt[2] - 0.008], [0, side * 0.4, side * -0.5], [1, 1.35, 0.6]), C('#2d2a2e'), { bone: P.head });
  }
  eyes(b, eyeAt, panda ? 0.036 : 0.034, panda ? 0.013 : 0.014, d);
  if (!panda) blush(b, [0, hc[1] - 0.02, hc[2] + hr * 0.72], 0.05, 0.016, d);
  // ears
  for (const side of [1, -1]) {
    const bone = side === 1 ? P.earL : P.earR;
    if (dog) {
      const root: Vec3 = [side * 0.06, hc[1] + 0.045, hc[2] - 0.01];
      bones[bone] = root;
      b.add(sphere(1, d, 12, 10), mat([side * 0.078, hc[1] + 0.0, hc[2] - 0.005], [0, 0, side * 0.25], [0.02, 0.047, 0.03]), C(p.ear), { bone });
    } else if (panda) {
      const root: Vec3 = [side * 0.058, hc[1] + 0.065, hc[2] - 0.02];
      bones[bone] = root;
      b.add(sphere(0.026, d, 12, 8), mat(root, [0, 0, 0], [1, 1, 0.6]), C(p.ear), { bone });
    } else {
      const root: Vec3 = [side * 0.045, hc[1] + 0.06, hc[2] - 0.01];
      bones[bone] = root;
      const tip: Vec3 = [side * (fox ? 0.068 : 0.062), hc[1] + (fox ? 0.125 : 0.11), hc[2] - 0.005];
      const { m, length } = along(root, tip);
      b.add(lathe(smoothProfile([[0.028, -0.5], [0.022, 0], [0, 0.5]], 3).map(([r, y]) => [r, y * length] as [number, number]), 10), m.multiply(mat([0, 0, 0], [0, 0, 0], [1, 1, 0.55])), C(p.ear), { bone });
      b.add(lathe(smoothProfile([[0.017, -0.5], [0.012, 0], [0, 0.45]], 3).map(([r, y]) => [r, y * length * 0.85] as [number, number]), 8), m.clone().multiply(mat([0, -0.004, 0.009], [0, 0, 0], [1, 1, 0.4])), C(fox ? '#2f2627' : '#f6b2bd'), { bone });
    }
  }
  // tail
  const tailRoot: Vec3 = [0, bodyY + 0.03, -0.1 * fat];
  bones[P.tail] = tailRoot;
  if (catty) {
    const mid: Vec3 = [0, bodyY + 0.1, -0.15];
    const tip: Vec3 = [0, bodyY + 0.18, -0.13];
    bones[P.tail2] = mid;
    taperBetween(b, tailRoot, mid, 0.017, 0.016, C(p.tail), { bone: P.tail }, d);
    taperBetween(b, mid, tip, 0.016, 0.015, p.tip ? C(p.tip) : C(p.tail), { bone: P.tail2 }, d);
  } else if (fox) {
    const tip: Vec3 = [0, bodyY + 0.07, -0.26];
    bones[P.tail2] = tailRoot;
    const { m, length } = along(tailRoot, tip);
    b.add(
      lathe(smoothProfile([[0, -0.5], [0.035, -0.35], [0.05, 0.0], [0.04, 0.3], [0, 0.5]], 4).map(([r, y]) => [r, y * length] as [number, number]), 14),
      m,
      C(p.tail),
      { bone: P.tail, paint: (pp) => (pp.z < -0.215 ? C('#fff5ea') : null) },
    );
  } else {
    bones[P.tail2] = tailRoot;
    const tip: Vec3 = [0, bodyY + (panda ? 0.02 : 0.08), -0.1 * fat - (panda ? 0.03 : 0.05)];
    if (panda) b.add(sphere(0.022, d, 10, 8), mat(tip), C(p.tail), { bone: P.tail });
    else taperBetween(b, tailRoot, tip, 0.016, 0.01, C(p.tail), { bone: P.tail }, d);
  }
  return out;
}

/** Duck and chick: two legs, wings on the back-leg bones. */
function bird(kind: string, d: Detail): Built {
  const out = base();
  const { b, bones } = out;
  const duck = kind === 'vit';
  const bodyC = C(duck ? '#fbfaf4' : '#ffd95a');
  const orange = C('#f39a3a');
  const legH = duck ? 0.045 : 0.035;
  const bodyY = legH + (duck ? 0.06 : 0.055);
  bones[P.body] = [0, bodyY, 0];
  if (duck) b.add(sphere(1, d, 20, 14), mat([0, bodyY, -0.01], [-0.15, 0, 0], [0.07, 0.06, 0.095]), bodyC, { bone: P.body });
  else b.add(sphere(0.066, d, 20, 14), mat([0, bodyY + 0.01, 0]), bodyC, { bone: P.body });
  // tail point
  b.add(lathe(smoothProfile([[0.025, -0.5], [0.015, 0], [0, 0.5]], 3).map(([r, y]) => [r, y * 0.05] as [number, number]), 10), mat([0, bodyY + 0.03, duck ? -0.1 : -0.06], [-1.0, 0, 0], [1.2, 1, 0.6]), bodyC, { bone: P.body });
  // wings
  for (const side of [1, -1]) {
    const bone = side === 1 ? P.bl : P.br;
    const root: Vec3 = [side * (duck ? 0.06 : 0.055), bodyY + 0.02, 0.0];
    bones[bone] = root;
    b.add(sphere(1, d, 14, 10), mat([root[0] + side * 0.008, root[1] - 0.012, root[2] - 0.015], [0.3, 0, side * 0.2], [0.018, 0.035, 0.055]), bodyC.clone().multiplyScalar(0.95), { bone });
  }
  // legs and webbed feet
  for (const side of [1, -1]) {
    const bone = side === 1 ? P.fl : P.fr;
    const top: Vec3 = [side * 0.025, bodyY - 0.035, 0.0];
    bones[bone] = top;
    taperBetween(b, top, [side * 0.025, 0.008, 0.0], 0.007, 0.007, orange, { bone }, d);
    b.add(sphere(1, d, 10, 6), mat([side * 0.025, 0.006, 0.016], [0, 0, 0], [0.024, 0.007, 0.028]), orange, { bone });
  }
  // head
  const hc: Vec3 = duck ? [0, bodyY + 0.085, 0.065] : [0, bodyY + 0.075, 0.015];
  bones[P.head] = [0, bodyY + 0.04, duck ? 0.05 : 0.01];
  b.add(sphere(duck ? 0.055 : 0.05, d, 18, 14), mat(hc), bodyC, { bone: P.head });
  if (!duck) b.add(sphere(0.012, d, 8, 6), mat([0.004, hc[1] + 0.052, hc[2] - 0.004], [0, 0, 0.5], [0.6, 1.5, 0.6]), bodyC, { bone: P.head });
  b.add(sphere(1, d, 14, 8), mat([0, hc[1] - 0.01, hc[2] + (duck ? 0.058 : 0.05)], [0.1, 0, 0], duck ? [0.03, 0.012, 0.03] : [0.014, 0.01, 0.016]), orange, { bone: P.head });
  const eyeAt: Vec3 = [0, hc[1] + 0.012, hc[2] + (duck ? 0.045 : 0.041)];
  bones[P.eyes] = [0, eyeAt[1], eyeAt[2]];
  eyes(b, eyeAt, duck ? 0.026 : 0.024, 0.011, d);
  blush(b, [0, hc[1] - 0.008, hc[2] + 0.035], 0.034, 0.012, d);
  bones[P.tail] = [0, bodyY, -0.05];
  bones[P.tail2] = bones[P.tail];
  bones[P.earL] = bones[P.head];
  bones[P.earR] = bones[P.head];
  return out;
}

function rabbit(d: Detail): Built {
  const out = base();
  const { b, bones } = out;
  const w = C('#f8f5f1');
  const pink = C('#f6b2bd');
  const bodyY = 0.075;
  bones[P.body] = [0, bodyY, 0];
  b.add(sphere(1, d, 20, 14), mat([0, bodyY, -0.01], [0, 0, 0], [0.065, 0.065, 0.085]), w, { bone: P.body });
  b.add(sphere(0.022, d, 10, 8), mat([0, bodyY + 0.01, -0.095]), C('#ffffff'), { bone: P.tail });
  bones[P.tail] = [0, bodyY, -0.08];
  bones[P.tail2] = bones[P.tail];
  // feet: big back feet, small front paws
  for (const side of [1, -1]) {
    const back = side === 1 ? P.bl : P.br;
    const front = side === 1 ? P.fl : P.fr;
    bones[back] = [side * 0.04, 0.04, -0.03];
    bones[front] = [side * 0.03, 0.045, 0.05];
    b.add(sphere(1, d, 12, 8), mat([side * 0.042, 0.015, -0.01], [0, 0, 0], [0.022, 0.016, 0.045]), w, { bone: back });
    b.add(sphere(1, d, 10, 8), mat([side * 0.03, 0.016, 0.055], [0, 0, 0], [0.017, 0.016, 0.022]), w, { bone: front });
  }
  const hc: Vec3 = [0, bodyY + 0.075, 0.06];
  bones[P.head] = [0, bodyY + 0.04, 0.04];
  b.add(sphere(0.06, d, 20, 16), mat(hc, [0, 0, 0], [1.08, 0.95, 0.95]), w, { bone: P.head });
  b.add(sphere(0.009, d, 8, 6), mat([0, hc[1] - 0.008, hc[2] + 0.058], [0, 0, 0], [1.3, 0.9, 1]), pink, { bone: P.head });
  const eyeAt: Vec3 = [0, hc[1] + 0.01, hc[2] + 0.05];
  bones[P.eyes] = [0, eyeAt[1], eyeAt[2]];
  eyes(b, eyeAt, 0.03, 0.011, d);
  blush(b, [0, hc[1] - 0.012, hc[2] + 0.044], 0.038, 0.012, d);
  for (const side of [1, -1]) {
    const bone = side === 1 ? P.earL : P.earR;
    const root: Vec3 = [side * 0.025, hc[1] + 0.045, hc[2] - 0.01];
    bones[bone] = root;
    const tip: Vec3 = [side * 0.04, hc[1] + 0.16, hc[2] - 0.03];
    const { m, length } = along(root, tip);
    b.add(sphere(1, d, 12, 10), m.clone().multiply(mat([0, 0, 0], [0, 0, 0], [0.022, length * 0.55, 0.013])), w, { bone });
    b.add(sphere(1, d, 10, 8), m.clone().multiply(mat([0, 0.004, 0.008], [0, 0, 0], [0.013, length * 0.45, 0.006])), pink, { bone });
  }
  return out;
}

function turtle(d: Detail): Built {
  const out = base();
  const { b, bones } = out;
  const shellC = C('#6fae69');
  const dark = C('#4f8a50');
  const skin = C('#b6d98f');
  const bodyY = 0.05;
  bones[P.body] = [0, bodyY, 0];
  const dome = smoothProfile([[0.0, 0.0], [0.1, 0.0], [0.105, 0.02], [0.09, 0.06], [0.05, 0.085], [0.0, 0.092]], 4);
  b.add(lathe(dome, 28), mat([0, bodyY - 0.012, 0], [0, 0, 0], [1, 1, 1.15]), shellC, {
    bone: P.body,
    paint: (pp) => {
      const a = Math.atan2(pp.x, pp.z);
      const r = Math.hypot(pp.x, pp.z);
      return Math.abs(Math.sin(a * 3)) > 0.93 || Math.abs(r - 0.055) < 0.004 ? dark : pp.y < bodyY + 0.01 ? C('#e9d79a') : null;
    },
  });
  for (const [bone, x, z] of [
    [P.fl, 0.065, 0.06],
    [P.fr, -0.065, 0.06],
    [P.bl, 0.065, -0.06],
    [P.br, -0.065, -0.06],
  ] as const) {
    bones[bone] = [x, bodyY, z];
    b.add(sphere(1, d, 10, 8), mat([x * 1.15, 0.022, z * 1.1], [0, 0, 0], [0.024, 0.018, 0.03]), skin, { bone });
  }
  bones[P.head] = [0, bodyY + 0.01, 0.1];
  const hc: Vec3 = [0, bodyY + 0.04, 0.15];
  taperBetween(b, [0, bodyY + 0.005, 0.09], [0, hc[1] - 0.01, hc[2] - 0.02], 0.022, 0.022, skin, { bone: P.head }, d);
  b.add(sphere(0.038, d, 16, 12), mat(hc, [0, 0, 0], [1, 0.9, 1.1]), skin, { bone: P.head });
  const eyeAt: Vec3 = [0, hc[1] + 0.008, hc[2] + 0.03];
  bones[P.eyes] = [0, eyeAt[1], eyeAt[2]];
  eyes(b, eyeAt, 0.02, 0.009, d);
  blush(b, [0, hc[1] - 0.01, hc[2] + 0.028], 0.025, 0.009, d);
  bones[P.tail] = [0, bodyY, -0.11];
  bones[P.tail2] = bones[P.tail];
  b.add(lathe(smoothProfile([[0.012, -0.5], [0.008, 0], [0, 0.5]], 2).map(([r, y]) => [r, y * 0.03] as [number, number]), 8), mat([0, bodyY, -0.125], [-1.4, 0, 0]), skin, { bone: P.tail });
  bones[P.earL] = bones[P.head];
  bones[P.earR] = bones[P.head];
  return out;
}

function buildPet(petId: string, d: Detail): Built {
  switch (petId) {
    case 'vit':
    case 'ga-con':
      return bird(petId, d);
    case 'tho':
      return rabbit(d);
    case 'rua':
      return turtle(d);
    case 'cho-con':
    case 'meo-muop':
    case 'cao':
    case 'gau-truc':
    case 'cat':
      return quad(petId, d);
    default:
      return quad('cat', d);
  }
}

/** Pose output of the pet brain: rotations per bone [x, y, z] and the body's lift. */
export interface PetPose {
  rot: Float32Array;
  lift: number;
  blink: number;
}

/** The pet brain: pure numbers (tested). */
export class PetBrain {
  readonly pose: PetPose = { rot: new Float32Array(PET_BONES * 3), lift: 0, blink: 1 };
  heading = 0;
  private readonly turn = new Spring();
  private target = 0;
  phase = 0;
  move = 0;
  sit = 0;
  private still = 0;
  private sitAfter: number;
  private t = 0;
  private lookYaw = 0;
  private lookGoal = 0;
  private lookUntil = 1;
  private blinkAt = 1;
  private earV = 0;
  private ear = 0;
  private readonly r: () => number;
  readonly spec: PetSpec;

  readonly petId: string;

  constructor(petId: string, seed = 1) {
    this.petId = petId;
    this.spec = PET_SPECS[petId] ?? PET_SPECS.cat;
    this.r = rng(seed);
    this.sitAfter = 4 + this.r() * 5;
    this.t = this.r() * 10;
  }

  setHeading(rad: number, instant = false): void {
    this.target = rad;
    if (instant) {
      this.heading = rad;
      this.turn.v = 0;
    }
  }

  update(dt: number, speed: number): void {
    dt = clamp(dt, 0, 0.1);
    this.t += dt;
    const v = Math.abs(speed);
    this.move = lerp(this.move, smoothstep(0.02, 0.25, v), approach(10, dt));
    if (v > 0) this.phase = petPhaseAdvance(this.phase, v * dt, this.petId);
    this.phase %= Math.PI * 64;
    const goal = this.heading + angleDelta(this.heading, this.target);
    // eases round and swings a touch past, like the people
    this.turn.x = this.heading;
    this.turn.step(goal, 12, 0.7, dt);
    this.heading = angleDelta(0, this.turn.x);
    // sitting down after standing a while; up at once to walk
    this.still = v > 0.05 ? 0 : this.still + dt;
    const sitGoal = this.spec.sits && this.still > this.sitAfter ? 1 : 0;
    this.sit = lerp(this.sit, sitGoal, approach(sitGoal ? 3 : 12, dt));
    if (this.t > this.lookUntil) {
      this.lookGoal = this.r() < 0.6 ? (this.r() * 2 - 1) * 0.7 : 0;
      this.lookUntil = this.t + 1.2 + this.r() * 2.8;
    }
    this.lookYaw = lerp(this.lookYaw, this.lookGoal * (1 - this.move), approach(5, dt));
    // ears flop with the steps
    const bob = Math.sin(this.phase * 2) * this.move;
    const ea = -60 * (this.ear - bob * 0.35) - 6 * this.earV;
    this.earV += ea * dt;
    this.ear += this.earV * dt;
    // blink
    if (this.t > this.blinkAt) {
      const k = (this.t - this.blinkAt) / 0.14;
      this.pose.blink = k < 1 ? 0.12 + 0.88 * Math.abs(1 - 2 * k) : 1;
      if (k >= 1) this.blinkAt = this.t + 1.5 + this.r() * 3.5;
    } else this.pose.blink = 1;
    this.evaluate();
  }

  private evaluate(): void {
    const rot = this.pose.rot;
    rot.fill(0);
    const set = (bone: number, x: number, y: number, z: number) => {
      rot[bone * 3] = x;
      rot[bone * 3 + 1] = y;
      rot[bone * 3 + 2] = z;
    };
    const ph = this.phase;
    const m = this.move;
    const t = this.t;
    const breathe = Math.sin(t * 2.4) * 0.02;
    const wag = Math.sin(t * (m > 0.3 ? 16 : 7)) * (m > 0.3 ? 0.35 : 0.25 + 0.15 * Math.max(0, Math.sin(t * 0.5)));
    let lift = 0;
    switch (this.spec.gait) {
      case 'trot': {
        const a = 0.55 * m;
        const s = Math.sin(ph);
        set(P.fl, -a * s, 0, 0);
        set(P.br, -a * s, 0, 0);
        set(P.fr, a * s, 0, 0);
        set(P.bl, a * s, 0, 0);
        // a bouncy trot: up off each pair of feet, the body rocking, the head nodding a beat after it
        lift = Math.pow(Math.abs(Math.cos(ph)), 1.5) * 0.026 * m;
        set(P.body, breathe + Math.sin(ph * 2) * 0.06 * m, 0, Math.sin(ph) * 0.05 * m);
        set(P.head, -0.1 * m + Math.sin(ph * 2 - 0.9) * 0.09 * m, this.lookYaw, this.lookYaw * -0.15 - Math.sin(ph - 0.6) * 0.06 * m);
        set(P.tail, 0.4 + 0.2 * m, wag, 0);
        set(P.tail2, -0.3, wag * 0.5, 0);
        // sitting: the back legs fold, the body tips up at the front
        if (this.sit > 0.001) {
          const k = this.sit;
          rot[P.body * 3] += -0.55 * k;
          rot[P.bl * 3] += 1.1 * k;
          rot[P.br * 3] += 1.1 * k;
          rot[P.fl * 3] += 0.55 * k;
          rot[P.fr * 3] += 0.55 * k;
          rot[P.head * 3] += 0.45 * k;
          rot[P.tail * 3] += -0.6 * k;
          lift -= 0.03 * k;
        }
        set(P.earL, this.ear * 0.6, 0, 0.08 * Math.sin(t * 0.9));
        set(P.earR, this.ear * 0.6, 0, -0.08 * Math.sin(t * 1.1 + 1));
        break;
      }
      case 'waddle': {
        const s = Math.sin(ph);
        set(P.fl, -0.6 * s * m, 0, 0);
        set(P.fr, 0.6 * s * m, 0, 0);
        set(P.body, breathe + Math.sin(ph * 2) * 0.04 * m, 0, 0.22 * s * m);
        lift = Math.pow(Math.abs(Math.cos(ph)), 1.5) * 0.016 * m;
        set(P.head, Math.sin(ph * 2 - 0.8) * 0.14 * m + Math.sin(t * 1.3) * 0.04, this.lookYaw, -0.16 * Math.sin(ph - 0.5) * m);
        const flap = m > 0.5 ? Math.sin(t * 22) * 0.25 : Math.max(0, Math.sin(t * 0.7)) * Math.sin(t * 14) * 0.1;
        set(P.bl, 0, 0, 0.1 + flap);
        set(P.br, 0, 0, -0.1 - flap);
        break;
      }
      case 'hop': {
        const k = (ph / (Math.PI * 2)) % 1;
        const h = Math.sin(k * Math.PI);
        lift = h * 0.05 * m;
        set(P.body, (-0.25 * Math.cos(k * Math.PI * 2) + 0.05) * m + breathe, 0, 0);
        set(P.bl, 0.8 * h * m, 0, 0);
        set(P.br, 0.8 * h * m, 0, 0);
        set(P.fl, -0.6 * h * m, 0, 0);
        set(P.fr, -0.6 * h * m, 0, 0);
        set(P.head, Math.sin(t * 9) * 0.03 * (1 - m), this.lookYaw, 0);
        set(P.earL, 0.4 * h * m + this.ear * 0.4 - 0.08, 0, 0.12 + 0.05 * Math.sin(t * 1.7));
        set(P.earR, 0.4 * h * m + this.ear * 0.4 - 0.08, 0, -0.12 - 0.05 * Math.sin(t * 1.3 + 2));
        set(P.tail, 0, Math.sin(t * 9) * 0.2, 0);
        break;
      }
      case 'crawl': {
        const s = Math.sin(ph);
        set(P.fl, 0, -0.5 * s * m, 0);
        set(P.br, 0, -0.5 * s * m, 0);
        set(P.fr, 0, -0.5 * s * m, 0);
        set(P.bl, 0, 0.5 * s * m, 0);
        set(P.body, breathe * 0.5, 0.05 * s * m, 0);
        set(P.head, Math.sin(t * 1.1) * 0.08, this.lookYaw * 0.6, 0);
        set(P.tail, 0, wag * 0.3, 0);
        break;
      }
    }
    this.pose.lift = lift;
  }
}

/** A pet (or the town cat). About 0.3 tile tall. */
export function createPet(petId: string, opts: { detail?: number } = {}): Pet3D & { readonly brain: PetBrain } {
  const d: Detail = { seg: opts.detail ?? 1 };
  const built = buildPet(petId, d.seg ? d : FULL);
  const geometry = built.b.build(true);
  const bones: Bone[] = [];
  for (let i = 0; i < PET_BONES; i++) {
    const bone = new Bone();
    const p = built.bones[i];
    const parent = PARENT[i];
    if (parent < 0) bone.position.set(p[0], p[1], p[2]);
    else {
      const q = built.bones[parent];
      bone.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      bones[parent].add(bone);
    }
    bones.push(bone);
  }
  const restY = bones[P.body].position.y;
  const mesh = new SkinnedMesh(geometry, materials().body);
  mesh.name = `pet-${petId}`;
  mesh.castShadow = true;
  mesh.add(bones[0]);
  // bind with the bones' world matrices of the rest pose (inverses come from them)
  mesh.updateMatrixWorld(true);
  mesh.bind(new Skeleton(bones), new Matrix4());
  mesh.boundingSphere = new Sphere(new Vector3(0, 0.12, 0), 0.32);
  const pivot = new Group();
  pivot.add(mesh);
  const root = new Group();
  root.name = `pet-${petId}`;
  root.add(pivot);
  const brain = new PetBrain(petId, hashString(petId));
  const apply = () => {
    const r = brain.pose.rot;
    for (let i = 0; i < PET_BONES; i++) bones[i].rotation.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]);
    bones[P.body].position.y = restY + brain.pose.lift;
    bones[P.eyes].scale.set(1, brain.pose.blink, 1);
    pivot.rotation.y = Math.PI / 2 - brain.heading;
  };
  brain.update(0, 0);
  apply();
  return {
    id: petId,
    root,
    brain,
    setHeading(rad, instant) {
      brain.setHeading(rad, instant);
      if (instant) pivot.rotation.y = Math.PI / 2 - brain.heading;
    },
    update(dt, speed) {
      brain.update(dt, speed);
      apply();
    },
    dispose() {
      root.removeFromParent();
      geometry.dispose();
      mesh.skeleton.dispose();
    },
  };
}
