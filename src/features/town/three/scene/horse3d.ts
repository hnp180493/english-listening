// The farm's horse, jointed (owner, 2026-11-28, of the old one, a stiff block on four posts that slid along: "con ngựa
// gì gớm vầy, thậm chí nó còn ko có animation chạy"). Built in code in the town's rounded low-poly style (merge.ts
// shapes, vertex colours): a body with a chest and a rump, a neck reaching up and forward, a long head with a muzzle,
// ears and a mane, four legs each in two parts with a hoof, a tail; a blanket, a saddle and reins. The parts are meshes
// under one root (12 draw calls a horse, their geometry made once a coat and shared), and `poseHorse` moves them each
// frame by the ground speed: standing (breathing, the tail swishing, now and then a hoof stamped), a walk (four
// beats), a trot (two beats, the diagonals together), a canter (three beats, the back rocking); the body rises and falls
// with the steps, the head nods, the tail and mane swing. With reduced motion it stands still, square, at rest.
//
// The model faces +x with its origin on the ground under its middle, as the other vehicles (vehicles3d.ts); the root is
// a Mesh (an empty geometry of its own) so the engine places and disposes it as it does any vehicle.

import { BufferGeometry, Group, Mesh, type Material, type Object3D } from 'three';
import { Merge, shapes } from './merge';

/** The coats (by the vehicle's `v`, as vehicles3d.ts BODY.horse) and the colour of the mane, tail and hooves with each. */
const COATS: readonly [string, string][] = [
  ['#8a5a3c', '#2e211b'],
  ['#5b3a29', '#1c1512'],
  ['#c8a070', '#efe6d2'],
  ['#efebe4', '#9a958e'],
];
const SADDLE = '#6b4430';
const BLANKET = '#c8473d';
const HOOF = '#2a2420';
const LEATHER = '#3b2a22';

/** Where the legs hang from (x along the body, z to the side) and how long their two parts are. */
const LEGS = [
  { name: 'lf', x: 0.2, z: 0.075, front: true },
  { name: 'rf', x: 0.2, z: -0.075, front: true },
  { name: 'lh', x: -0.21, z: 0.075, front: false },
  { name: 'rh', x: -0.21, z: -0.075, front: false },
] as const;
const HIP_Y = 0.43;
const UPPER = 0.22;
const LOWER = 0.17;

interface Parts {
  body: BufferGeometry;
  neck: BufferGeometry;
  tail: BufferGeometry;
  upperF: BufferGeometry;
  upperH: BufferGeometry;
  lower: BufferGeometry;
}

const made = new Map<number, Parts>();

function partsOf(v: number): Parts {
  const k = ((v % COATS.length) + COATS.length) % COATS.length;
  const hit = made.get(k);
  if (hit) return hit;
  const [coat, hair] = COATS[k];
  const build = (fn: (m: Merge) => void): BufferGeometry => {
    const m = new Merge();
    fn(m);
    return m.build() ?? new BufferGeometry();
  };
  const parts: Parts = {
    // the barrel, the chest a little lower and rounder in front, the rump higher behind; the blanket and the saddle
    body: build((m) => {
      m.add(shapes.sphere(0.2, 18, 12), coat, { x: 0, y: 0.525, z: 0, s: [1.6, 0.86, 0.76] });
      m.add(shapes.sphere(0.15, 14, 10), coat, { x: 0.17, y: 0.52, z: 0, s: [1.1, 1.08, 0.98] });
      m.add(shapes.sphere(0.155, 14, 10), coat, { x: -0.18, y: 0.545, z: 0, s: [1.15, 1.02, 1] });
      m.add(shapes.box(0.24, 0.025, 0.31, 0.01, 1), BLANKET, { x: 0.01, y: 0.685, z: 0 });
      m.add(shapes.box(0.2, 0.05, 0.2, 0.025, 2), SADDLE, { x: 0.01, y: 0.71, z: 0 });
      m.add(shapes.box(0.04, 0.06, 0.18, 0.02, 1), SADDLE, { x: 0.1, y: 0.74, z: 0 });
      for (const z of [-0.12, 0.12]) m.add(shapes.box(0.02, 0.14, 0.015, 0.006, 1), LEATHER, { x: 0.01, y: 0.62, z });
    }),
    // from the withers (its pivot): the neck reaching up and forward, the mane along its top, the long head pointing
    // down at the end, a darker muzzle, ears, eyes; the reins from the bit back to the withers
    neck: build((m) => {
      m.add(shapes.cyl(0.055, 0.085, 0.34, 12), coat, { x: 0.1, y: 0.12, z: 0, rz: -0.72 });
      m.add(shapes.box(0.3, 0.05, 0.035, 0.015, 1), hair, { x: 0.075, y: 0.185, z: 0, rz: 0.82 });
      m.add(shapes.box(0.27, 0.1, 0.105, 0.045, 2), coat, { x: 0.27, y: 0.22, z: 0, rz: -0.95 });
      m.add(shapes.sphere(0.058, 10, 8), coat, { x: 0.35, y: 0.11, z: 0, s: [1, 0.85, 0.9] });
      m.add(shapes.sphere(0.03, 8, 6), '#3a2c26', { x: 0.385, y: 0.08, z: 0, s: [0.8, 0.8, 1.4] }, { ao: false });
      for (const z of [-0.032, 0.032]) {
        m.add(shapes.cone(0.022, 0.07, 6), coat, { x: 0.2, y: 0.36, z, rz: 0.25 });
        m.add(shapes.sphere(0.012, 6, 5), '#17110e', { x: 0.25, y: 0.255, z: z * 1.55 }, { ao: false });
      }
      m.add(shapes.box(0.05, 0.08, 0.03, 0.012, 1), hair, { x: 0.19, y: 0.33, z: 0, rz: 0.4 });
      for (const z of [-0.055, 0.055]) m.add(shapes.box(0.34, 0.008, 0.008, 0.003, 1), LEATHER, { x: 0.18, y: 0.1, z, rz: -0.25 }, { ao: false });
    }),
    // from the top of the rump: the tail hanging down and back
    tail: build((m) => {
      // (a cylinder stands along y: a negative turn about z takes its lower end back, away from the head)
      m.add(shapes.sphere(0.04, 8, 6), hair, { x: 0, y: 0, z: 0 });
      m.add(shapes.cyl(0.04, 0.05, 0.12, 8), hair, { x: -0.035, y: -0.045, z: 0, rz: -0.75 });
      m.add(shapes.cyl(0.05, 0.022, 0.3, 8), hair, { x: -0.1, y: -0.22, z: 0, rz: -0.18 });
    }),
    // a leg's upper part from its pivot down to the knee (the forearm, the thigh: thicker behind)
    upperF: build((m) => m.add(shapes.cyl(0.032, 0.048, UPPER, 10), coat, { x: 0, y: -UPPER / 2, z: 0 })),
    upperH: build((m) => {
      m.add(shapes.cyl(0.034, 0.062, UPPER, 10), coat, { x: 0, y: -UPPER / 2, z: 0 });
      m.add(shapes.sphere(0.06, 10, 8), coat, { x: 0, y: -0.02, z: 0, s: [1.1, 1.2, 0.9] });
    }),
    // the cannon, the fetlock and the hoof
    lower: build((m) => {
      m.add(shapes.cyl(0.024, 0.028, LOWER, 8), coat, { x: 0, y: -LOWER / 2, z: 0 });
      m.add(shapes.sphere(0.03, 8, 6), coat, { x: 0.005, y: -LOWER, z: 0 });
      m.add(shapes.cyl(0.03, 0.036, 0.045, 10), HOOF, { x: 0.01, y: -LOWER - 0.03, z: 0 }, { ao: false });
      m.add(shapes.cyl(0.031, 0.031, 0.02, 10), hair, { x: 0.005, y: -LOWER + 0.005, z: 0 }, { ao: false });
    }),
  };
  made.set(k, parts);
  return parts;
}

interface HorseState {
  trunk: Object3D;
  neck: Object3D;
  tail: Object3D;
  legs: { upper: Object3D; lower: Object3D; front: boolean; key: string }[];
  phase: number;
  last: number;
  /** How far the back is up from its rest now (the rider rises with it). */
  lift: number;
  /** The gait blended in (0 stand … 1 moving), eased so a start or a stop is not a jump. */
  move: number;
}

/** A horse of coat `v` (its parts share `mat`, the town's vertex-coloured material). */
export function makeHorse(v: number, mat: Material): Mesh {
  const p = partsOf(v);
  const root = new Mesh(new BufferGeometry(), mat);
  root.name = 'horse';
  const shadow = (m: Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const trunk = new Group();
  trunk.add(shadow(new Mesh(p.body, mat)));
  const neck = new Group();
  neck.position.set(0.25, 0.6, 0);
  neck.add(shadow(new Mesh(p.neck, mat)));
  trunk.add(neck);
  const tail = new Group();
  tail.position.set(-0.32, 0.6, 0);
  tail.add(shadow(new Mesh(p.tail, mat)));
  trunk.add(tail);
  const legs: HorseState['legs'] = [];
  for (const l of LEGS) {
    const upper = new Group();
    upper.position.set(l.x, HIP_Y, l.z);
    upper.add(shadow(new Mesh(l.front ? p.upperF : p.upperH, mat)));
    const lower = new Group();
    lower.position.set(0, -UPPER, 0);
    lower.add(shadow(new Mesh(p.lower, mat)));
    upper.add(lower);
    trunk.add(upper);
    legs.push({ upper, lower, front: l.front, key: l.name });
  }
  root.add(trunk);
  const st: HorseState = { trunk, neck, tail, legs, phase: 0, last: -1, lift: 0, move: 0 };
  root.userData.horse = st;
  poseHorse(root, 0, 0, true);
  return root;
}

/** The gaits: from this ground speed (tiles a second) on, the stride (tiles a cycle), each leg's start in the cycle, the share of it on the ground. */
const GAITS = [
  { from: 0.15, stride: 0.55, at: { lh: 0, lf: 0.25, rh: 0.5, rf: 0.75 }, stance: 0.62, swing: 0.32, knee: 0.9, bob: 0.012, beats: 2, nod: 0.07 },
  { from: 1.4, stride: 0.95, at: { lf: 0, rh: 0, rf: 0.5, lh: 0.5 }, stance: 0.45, swing: 0.42, knee: 1.2, bob: 0.028, beats: 2, nod: 0.05 },
  { from: 3.2, stride: 1.5, at: { lh: 0, rh: 0.28, lf: 0.28, rf: 0.55 }, stance: 0.38, swing: 0.55, knee: 1.3, bob: 0.04, beats: 1, nod: 0.16 },
] as const;

const smooth = (x: number): number => x * x * (3 - 2 * x);

/**
 * Each frame: `t` the time (s), `speed` the ground speed (tiles a second; 0 standing), `still` reduced motion (a quiet
 * standing pose, nothing moves).
 */
export function poseHorse(root: Object3D, t: number, speed: number, still: boolean): void {
  const st = root.userData.horse as HorseState | undefined;
  if (!st) return;
  const dt = st.last < 0 ? 0 : Math.min(0.1, Math.max(0, t - st.last));
  st.last = t;
  const moving = !still && speed > GAITS[0].from;
  st.move += ((moving ? 1 : 0) - st.move) * (still ? 1 : Math.min(1, dt * 6));
  const g = [...GAITS].reverse().find((x) => speed >= x.from) ?? GAITS[0];
  if (moving) st.phase = (st.phase + (dt * speed) / g.stride) % 1;
  const w = st.move;
  const tau = Math.PI * 2;
  // the legs: on the ground they go from forward to back at an even pace; off it they come forward, the lower part
  // folding (the front knee back, the hind hock forward) and unfolding
  for (const l of st.legs) {
    const p = (((st.phase + g.at[l.key as keyof typeof g.at]) % 1) + 1) % 1;
    let swing: number;
    let fold: number;
    if (p < g.stance) {
      swing = g.swing * (1 - 2 * (p / g.stance));
      fold = 0.08;
    } else {
      const s = (p - g.stance) / (1 - g.stance);
      swing = g.swing * (-1 + 2 * smooth(s));
      fold = g.knee * Math.sin(Math.PI * s);
    }
    // standing: now and then a front hoof is lifted and set down (every 7 s or so, the near one first)
    let stamp = 0;
    if (!still && l.front) {
      const c = (t + (l.key === 'rf' ? 3.5 : 0)) % 7;
      stamp = c < 0.6 ? Math.sin((c / 0.6) * Math.PI) : 0;
    }
    const s0 = (1 - w) * stamp * 0.15;
    const f0 = (1 - w) * stamp * 1.1;
    l.upper.rotation.z = w * swing + s0 * (l.front ? 1 : 0);
    l.lower.rotation.z = (l.front ? -1 : 1) * (w * fold + f0) * (l.front ? 1 : 0.75);
  }
  // the body: up and down with the steps (a canter also rocks), the head nodding, the tail and mane swinging
  const ph = st.phase * tau;
  const bob = w * g.bob * (g.beats === 2 ? Math.abs(Math.sin(ph * 2)) * 2 - 1 : Math.sin(ph));
  const breathe = still ? 0 : (1 - w) * 0.006 * Math.sin(t * 1.4);
  st.lift = bob;
  st.trunk.position.y = bob;
  st.trunk.rotation.z = w * (g.beats === 1 ? 0.07 * Math.sin(ph + Math.PI / 2) : 0);
  st.trunk.scale.set(1, 1 + breathe, 1 + breathe * 1.4);
  st.neck.rotation.z = w * g.nod * Math.sin(ph * (g.beats === 2 ? 2 : 1) + 1) + (still ? 0 : (1 - w) * 0.04 * Math.sin(t * 0.37));
  st.tail.rotation.x = still ? 0 : 0.25 * Math.sin(t * (1.6 + 2 * w)) * (1 - 0.4 * w);
  st.tail.rotation.z = -w * 0.35 + (still ? 0 : 0.05 * Math.sin(t * 2.1));
}

/** How far the horse's back is up from its rest now (0 for any other vehicle). */
export function horseLift(root: Object3D): number {
  return (root.userData.horse as HorseState | undefined)?.lift ?? 0;
}
