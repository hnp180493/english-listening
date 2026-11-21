// Hair styles, built around the head centre in head space (radius R, before the head's stretch). Each style is a
// shell whose edge follows a curve (fringe locks, side part, nape), plus pieces that hang on their own bones so they
// can sway (ponytail, pigtails, long hair) or hide under a hat (bun, spikes, tuft).

import { Color, type BufferGeometry, type Vector3 } from 'three';
import type { HairSpec } from '../contracts';
import { along, bump, dir, type Detail, FULL, GeoBuilder, lathe, mat, shell, smoothProfile, sphere, torus, type Vec3 } from './build';
import { smoothstep } from './anim';

/** Bones the hair uses (indices in the person's skeleton). */
export interface HairBones {
  head: number;
  tailA: number;
  tailB: number;
  crown: number;
}

/** Where the tail bones hang from (head space, unstretched), per style. */
export interface HairRig {
  tailA?: Vec3;
  tailB?: Vec3;
  crown?: Vec3;
}

/** How a hat sits on this hair: lifted (× R) and scaled. */
export interface HatFit {
  lift: number;
  scale: number;
}

export const HAT_FIT: Readonly<Record<HairSpec['style'], HatFit>> = {
  short: { lift: 0.02, scale: 1.0 },
  bob: { lift: 0.03, scale: 1.04 },
  long: { lift: 0.03, scale: 1.04 },
  bun: { lift: 0.02, scale: 1.0 },
  ponytail: { lift: 0.02, scale: 1.0 },
  curly: { lift: 0.07, scale: 1.08 },
  bald: { lift: -0.04, scale: 0.97 },
  spiky: { lift: 0.04, scale: 1.04 },
  pigtails: { lift: 0.02, scale: 1.0 },
};

interface Zones {
  /** Fringe line at the front (polar angle), the lock depth and count, side-part offset. */
  front: number;
  locks: number;
  lockDepth: number;
  part: number;
  side: number;
  back: number;
  /** Shell thickness (× R) and the outward puff low at the sides (bob). */
  thick: number;
  puff: number;
  /** Lumpy surface (curls). */
  curl: number;
}

const ZONES: Readonly<Record<HairSpec['style'], Zones>> = {
  short: { front: 1.02, locks: 3.2, lockDepth: 0.2, part: 0.35, side: 1.72, back: 2.12, thick: 0.085, puff: 0, curl: 0 },
  bob: { front: 1.12, locks: 6, lockDepth: 0.08, part: 0.1, side: 2.3, back: 2.32, thick: 0.1, puff: 0.1, curl: 0 },
  long: { front: 1.05, locks: 3, lockDepth: 0.14, part: 0.5, side: 2.25, back: 2.2, thick: 0.095, puff: 0.06, curl: 0 },
  ponytail: { front: 1.0, locks: 2.6, lockDepth: 0.17, part: 0.55, side: 1.78, back: 2.08, thick: 0.08, puff: 0, curl: 0 },
  bun: { front: 0.98, locks: 2.8, lockDepth: 0.15, part: 0.45, side: 1.75, back: 2.05, thick: 0.08, puff: 0, curl: 0 },
  pigtails: { front: 1.08, locks: 5, lockDepth: 0.12, part: 0, side: 1.82, back: 2.12, thick: 0.085, puff: 0, curl: 0 },
  curly: { front: 0.98, locks: 5, lockDepth: 0.12, part: 0.2, side: 1.78, back: 2.15, thick: 0.13, puff: 0.04, curl: 0.07 },
  spiky: { front: 1.0, locks: 4, lockDepth: 0.26, part: 0.2, side: 1.62, back: 2.08, thick: 0.09, puff: 0, curl: 0 },
  bald: { front: 1.5, locks: 0, lockDepth: 0, part: 0, side: 1.95, back: 2.08, thick: 0.035, puff: 0, curl: 0 },
};

/** The hairline: polar angle where the hair ends at azimuth phi (0 = front). */
export function hairline(style: HairSpec['style'], phi: number): number {
  const z = ZONES[style];
  const a = Math.abs(phi);
  // locks at the front: rounded tips pointing down, V gaps between them
  const lock = z.locks > 0 ? Math.pow(Math.abs(Math.cos((phi - z.part) * z.locks)), 0.55) : 0;
  const sweep = (phi - z.part) * 0.12; // the side part: one side a little lower
  const front = z.front + z.lockDepth * lock + sweep;
  let v = front + (z.side - front) * smoothstep(0.6, 1.45, a);
  v += (z.back - v) * smoothstep(1.7, 2.6, a);
  return v;
}

/** Shine band colour on hair (a soft "angel ring"). */
function shine(c: Color): (p: Vector3, n: Vector3) => Color | null {
  const light = c.clone().lerp(new Color('#fff6e8'), 0.12);
  const out = new Color();
  return (_p, n) => {
    const ring = bump(n.y - 0.6 - 0.03 * Math.sin(Math.atan2(n.x, n.z) * 5), 0.13);
    if (ring <= 0.01 || n.z < -0.35) return null;
    return out.copy(c).lerp(light, ring);
  };
}

/**
 * Add a hair style to the builder. `center` and `stretch` place head space in the body's bind space; `R` is the head
 * radius. Returns where the hair's own bones hang (head space → bind space is the caller's).
 */
export function addHair(b: GeoBuilder, spec: HairSpec, R: number, center: Vec3, stretch: Vec3, bones: HairBones, d: Detail = FULL): HairRig {
  const style = spec.style;
  const z = ZONES[style];
  const c = new Color(spec.color);
  const head = mat(center, [0, 0, 0], stretch);
  const rig: HairRig = {};
  const cols = Math.round(52 * d.seg);
  const rows = Math.round(14 * d.seg);
  const radius = (theta: number, phi: number, t: number) => {
    let r = R * (1 + z.thick);
    r *= 1 + 0.035 * smoothstep(1.1, 0, theta); // a little volume on the crown
    r *= 1 + z.puff * bump(theta - 2.0, 0.55) * smoothstep(0.5, 1.4, Math.abs(phi));
    if (z.curl > 0) r *= 1 + z.curl * Math.abs(Math.sin(theta * 6.5 + 0.4) * Math.sin(phi * 6 + theta * 2));
    r *= 1 - 0.06 * smoothstep(0.8, 1, t); // the ends tuck in toward the head
    return r;
  };
  const main: BufferGeometry =
    style === 'bald'
      ? shell({
          cols,
          rows: Math.round(6 * d.seg),
          // only round the back, from ear to ear: no strip across the bald crown
          phiMin: 1.05,
          phiMax: Math.PI * 2 - 1.05,
          thetaMin: (phi) => 2.02 - 0.42 * smoothstep(1.05, 1.7, Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)))),
          thetaMax: () => 2.06,
          radius: (theta, phi) => R * (1.03 + 0.012 * Math.abs(Math.sin(phi * 14 + theta * 6))),
        })
      : shell({ cols, rows, thetaMax: (phi) => hairline(style, phi), radius });
  b.add(main, head, c, { bone: bones.head, slot: 'hair', paint: style === 'bald' ? undefined : shine(c) });

  const at = (theta: number, phi: number, k: number): Vec3 => {
    const v = dir(theta, phi).multiplyScalar(R * k);
    return [v.x, v.y, v.z];
  };
  const toBind = (p: Vec3): Vec3 => [center[0] + p[0] * stretch[0], center[1] + p[1] * stretch[1], center[2] + p[2] * stretch[2]];
  const tie = new Color('#f28fa6');

  if (style === 'ponytail') {
    const root = toBind(at(1.22, Math.PI, 1.06));
    rig.tailA = root;
    const tip: Vec3 = [root[0], root[1] - 0.3, root[2] - 0.1];
    addTail(b, root, tip, 0.062, c, bones.tailA, d);
    tieAround(b, root, tip, 0.03, tie, bones.tailA, d);
  } else if (style === 'pigtails') {
    for (const side of [1, -1]) {
      const root = toBind(at(1.72, side * 1.95, 1.06));
      if (side === 1) rig.tailA = root;
      else rig.tailB = root;
      const bone = side === 1 ? bones.tailA : bones.tailB;
      const tip: Vec3 = [root[0] + side * 0.06, root[1] - 0.2, root[2] - 0.03];
      addTail(b, root, tip, 0.05, c, bone, d);
      tieAround(b, root, tip, 0.024, tie, bone, d);
    }
  } else if (style === 'long') {
    const root = toBind(at(1.45, Math.PI, 0.6));
    rig.tailA = root;
    // a curtain down the back: a part-lathe that follows the head and then hangs
    const prof = smoothProfile(
      [
        [R * 1.07, 0.06],
        [R * 1.1, -0.04],
        [R * 1.02, -0.16],
        [R * 0.9, -0.26],
        [R * 0.62, -0.31],
      ],
      4,
    );
    const outer = lathe([...prof].reverse(), Math.round(28 * d.seg), Math.PI - 1.75, 3.5);
    const m = mat([center[0], center[1] - 0.02, center[2] - 0.01], [0, 0, 0], [stretch[0], 1, stretch[2]]);
    b.add(outer, m, c, { bone: bones.tailA, slot: 'hair' });
    const inner = lathe(prof.map(([r, y]) => [r * 0.94, y] as [number, number]), Math.round(28 * d.seg), Math.PI - 1.75, 3.5);
    b.add(inner, m, c.clone().multiplyScalar(0.8), { bone: bones.tailA });
  } else if (style === 'bun') {
    const p = toBind(at(0.55, Math.PI, 1.02));
    rig.crown = p;
    b.add(sphere(0.078, d), mat([p[0], p[1] + 0.035, p[2] - 0.02]), c, { bone: bones.crown, paint: shine(c) });
    b.add(torus(0.05, 0.013, d), mat([p[0], p[1] - 0.005, p[2]], [Math.PI / 2 + 0.55, 0, 0]), c.clone().multiplyScalar(0.82), { bone: bones.crown });
  } else if (style === 'spiky') {
    rig.crown = toBind([0, R, 0]);
    const spikes: Array<[number, number, number]> = [
      [0.25, 0.3, 1],
      [0.35, -1.2, 0.95],
      [0.45, 1.6, 0.9],
      [0.6, 2.8, 0.85],
      [0.3, -2.4, 0.9],
      [0.75, -0.6, 0.8],
      [0.8, 0.9, 0.75],
    ];
    for (const [th, ph, k] of spikes) {
      const base = toBind(at(th, ph, 1.02));
      const tip = toBind(at(th + 0.25, ph, 1.02 + 0.42 * k));
      const { m, length } = along(base, tip);
      const cone = lathe(
        smoothProfile(
          [
            [0.055, -0.5],
            [0.04, -0.1],
            [0.012, 0.42],
            [0, 0.5],
          ],
          3,
        ).map(([r, y]) => [r, y * length] as [number, number]),
        Math.round(10 * d.seg),
      );
      b.add(cone, m, c, { bone: bones.crown });
    }
  } else if (style === 'short' || style === 'curly') {
    // a little tuft on the crown
    rig.crown = toBind([0, R, 0]);
    const base = toBind(at(0.2, -2.6, 1.05));
    const tip = toBind(at(0.55, -2.6, 1.28));
    if (style === 'short') {
      const { m, length } = along(base, tip);
      const cone = lathe(
        smoothProfile(
          [
            [0.03, -0.5],
            [0.02, 0],
            [0, 0.5],
          ],
          3,
        ).map(([r, y]) => [r, y * length] as [number, number]),
        Math.round(8 * d.seg),
      );
      b.add(cone, m, c, { bone: bones.crown });
    }
  }
  return rig;
}

/** A scrunchie round a lock, just below its root. */
function tieAround(b: GeoBuilder, root: Vec3, tip: Vec3, r: number, c: Color, bone: number, d: Detail): void {
  const len = Math.hypot(tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]);
  const k = 0.1;
  const at: Vec3 = [root[0] + (tip[0] - root[0]) * k, root[1] + (tip[1] - root[1]) * k, root[2] + (tip[2] - root[2]) * k];
  const { m } = along(at, [at[0] + (tip[0] - root[0]) / len, at[1] + (tip[1] - root[1]) / len, at[2] + (tip[2] - root[2]) / len]);
  // along() centres on the midpoint of a unit segment: step back half a unit
  m.multiply(mat([0, -0.5, 0], [Math.PI / 2, 0, 0]));
  b.add(torus(r, r * 0.42, d), m, c, { bone });
}

/** A teardrop lock from root to tip (ponytail, pigtail). */
function addTail(b: GeoBuilder, root: Vec3, tip: Vec3, r: number, c: Color, bone: number, d: Detail): void {
  const { m, length } = along(tip, root);
  const prof = smoothProfile(
    [
      [0, -0.5],
      [r * 0.45, -0.42],
      [r * 1.0, -0.12],
      [r * 0.95, 0.15],
      [r * 0.6, 0.42],
      [0, 0.5],
    ],
    4,
  ).map(([rr, y]) => [rr, y * length] as [number, number]);
  b.add(lathe(prof, Math.round(14 * d.seg)), m, c, { bone, paint: undefined });
}
