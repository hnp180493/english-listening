// One person's body as ONE skinned geometry: rounded chibi proportions (head about 42% of the height, legs about a
// quarter), clothes, hair and extras merged with a rigid bone per part. Bind space = "design" units: feet at y = 0, an
// adult about 1.05 tall, facing +Z, the person's left at +X. Everything above the legs is modelled at the height of
// the first build (legs LEG_GROW shorter) and raised by LEG_GROW as it is added (GeoBuilder.lift).

import { Color, Vector3 } from 'three';
import type { CharacterLook } from '../contracts';
import { J, LEG, LEG_GROW } from './anim';
import { dir, type Detail, FULL, GeoBuilder, lathe, mat, roundBox, shell, smoothProfile, sphere, taperBetween, torus, type Vec3, along, cylinder, bump } from './build';
import { EYE_PHI, EYE_THETA } from './face';
import { addHair, type HairRig } from './hair';
import { extraColor, hasExtra } from './looks';
import { smoothstep } from './anim';

/** Extra bones after the 13 joints. */
export const B = { tailA: 13, tailB: 14, crown: 15, cap: 16, skirt: 17 } as const;
export const BONE_COUNT = 18;

/**
 * Head: radius, centre, stretch, in the space the upper body is modelled in (hats are built in it too); on the body
 * the head is LEG_GROW higher.
 */
export const HEAD = { R: 0.215, center: [0, 0.755, 0] as Vec3, stretch: [1.04, 0.96, 0.98] as Vec3 };
/** Top of the hair (design units, on the body) before a hat, for name tags. */
export const HEAD_TOP = 0.99 + LEG_GROW;

const G = LEG_GROW;
/** Knee height (design units). */
const KNEE_Y = LEG.ankle + LEG.shin;
/** Thigh pivot height (design units). */
const THIGH_Y = LEG.hipY - LEG.thighDrop;

/** Rest positions of the joints (bind space) and their parents. */
export const BONE_REST: ReadonlyArray<{ name: string; parent: number; pos: Vec3 }> = [
  { name: 'hips', parent: -1, pos: [0, LEG.hipY, 0] },
  { name: 'spine', parent: J.hips, pos: [0, 0.27 + G, 0] },
  { name: 'head', parent: J.spine, pos: [0, 0.53 + G, 0] },
  { name: 'shL', parent: J.spine, pos: [0.132, 0.468 + G, 0] },
  { name: 'elL', parent: J.shL, pos: [0.134, 0.372 + G, 0] },
  { name: 'shR', parent: J.spine, pos: [-0.132, 0.468 + G, 0] },
  { name: 'elR', parent: J.shR, pos: [-0.134, 0.372 + G, 0] },
  { name: 'thL', parent: J.hips, pos: [LEG.width, THIGH_Y, 0] },
  { name: 'knL', parent: J.thL, pos: [LEG.width, KNEE_Y, 0] },
  { name: 'anL', parent: J.knL, pos: [LEG.width, LEG.ankle, 0] },
  { name: 'thR', parent: J.hips, pos: [-LEG.width, THIGH_Y, 0] },
  { name: 'knR', parent: J.thR, pos: [-LEG.width, KNEE_Y, 0] },
  { name: 'anR', parent: J.knR, pos: [-LEG.width, LEG.ankle, 0] },
  { name: 'tailA', parent: J.head, pos: [0, 0.755 + G, -0.2] },
  { name: 'tailB', parent: J.head, pos: [0, 0.755 + G, -0.2] },
  { name: 'crown', parent: J.head, pos: [0, 0.96 + G, 0] },
  { name: 'cap', parent: J.head, pos: [0, 0.755 + G, 0] },
  { name: 'skirt', parent: J.hips, pos: [0, 0.255 + G, 0] },
];
/** The leg bones: modelled at their own height (everything else is raised by LEG_GROW). */
const LEG_BONES = new Set<number>([J.thL, J.knL, J.anL, J.thR, J.knR, J.anR]);

export interface BodyBuild {
  builder: GeoBuilder;
  /** Bind positions of every bone (the hair moves the tail bones). */
  bones: Vec3[];
  /** Colour of each slot as built (for outfit recolouring). */
  slotColor: Map<string, Color>;
  /** Hand position (bind) of the right hand, for props. */
  handR: Vec3;
}

const shade = (c: Color, k: number) => c.clone().multiplyScalar(k);

/** Build the merged body of a look. */
export function buildBody(look: CharacterLook, d: Detail = FULL): BodyBuild {
  const b = new GeoBuilder();
  b.lift = (bone) => (LEG_BONES.has(bone) ? 0 : G);
  const skin = new Color(look.skin);
  const top = new Color(look.top);
  const bottom = new Color(look.bottom);
  const shoes = new Color(look.shoes);
  const slotColor = new Map<string, Color>([
    ['top', top.clone()],
    ['skin', skin.clone()],
    ['bottom', bottom.clone()],
  ]);
  const stocky = hasExtra(look, 'stocky') ? 1.12 : 1;
  const skirt = hasExtra(look, 'skirt');
  const shorts = hasExtra(look, 'shorts');
  const coat = hasExtra(look, 'coat');
  const longSleeves = coat || hasExtra(look, 'collar') || hasExtra(look, 'scarf') || look.hair.style === 'bald';
  const seg = (n: number) => Math.max(8, Math.round(n * d.seg));
  const bones = BONE_REST.map((r) => [...r.pos] as unknown as Vec3);

  // ── pelvis / trousers (hips bone)
  const pelvis = smoothProfile(
    [
      [0.0, 0.165],
      [0.08, 0.168],
      [0.118, 0.186],
      [0.13, 0.215],
      [0.128, 0.25],
      [0.122, 0.285],
      [0.0, 0.292],
    ],
    3,
  ).map(([r, y]) => [r * stocky, y] as [number, number]);
  b.add(lathe(pelvis, seg(22)), mat([0, 0, 0], [0, 0, 0], [1, 1, 0.86]), bottom, { bone: J.hips, slot: 'bottom', shade: 0.12 });
  if (skirt) {
    // a soft A-line skirt, two-sided so its inside shows when the legs swing
    const sk = smoothProfile(
      [
        [0.19, 0.118],
        [0.178, 0.16],
        [0.158, 0.21],
        [0.146, 0.236],
        [0.126, 0.258],
      ],
      4,
    ).map(([r, y]) => [r * stocky, y] as [number, number]);
    const hem: Array<[number, number]> = [[0.183 * stocky, 0.112], [0.19 * stocky, 0.118]];
    b.add(lathe([...hem, ...sk], seg(26)), mat([0, 0, 0], [0, 0, 0], [1, 1, 0.9]), bottom, { bone: B.skirt, slot: 'bottom', shade: 0.1 });
    b.add(lathe([...sk].reverse().map(([r, y]) => [r * 0.96, y] as [number, number]), seg(26)), mat([0, 0, 0], [0, 0, 0], [1, 1, 0.9]), shade(bottom, 0.75), { bone: B.skirt });
  }

  // ── torso / top (spine bone): a soft bean, the hem a little wider than the trousers
  const torso = smoothProfile(
    [
      [0.0, 0.236],
      [0.142, 0.232],
      [0.147, 0.25],
      [0.142, 0.3],
      [0.136, 0.36],
      [0.123, 0.42],
      [0.104, 0.468],
      [0.072, 0.505],
      [0.035, 0.526],
      [0.0, 0.532],
    ],
    4,
  ).map(([r, y]) => [r * stocky, y] as [number, number]);
  b.add(lathe(torso, seg(24)), mat([0, 0, 0], [0, 0, 0], [1, 1, 0.84]), top, { bone: J.spine, slot: 'top', shade: 0.1 });

  // ── neck and head (head bone)
  b.add(cylinder(0.042, 0.046, 0.09, d), mat([0, 0.54, 0]), shade(skin, 0.92), { bone: J.head, slot: 'skin' });
  const { R, center, stretch } = HEAD;
  b.add(sphere(R, d, 30, 22), mat(center, [0, 0, 0], stretch), skin, { bone: J.head, slot: 'skin' });
  // ears and a tiny nose
  for (const side of [1, -1]) {
    b.add(sphere(0.042, d, 12, 8), mat([side * 0.222, 0.73, -0.008], [0, side * 0.3, 0], [0.55, 1, 0.85]), shade(skin, 0.97), { bone: J.head, slot: 'skin' });
  }
  const nose = dir(1.88, 0).multiplyScalar(R * 0.99);
  b.add(sphere(0.017, d, 10, 8), mat([center[0] + nose.x * stretch[0], center[1] + nose.y * stretch[1], center[2] + nose.z * stretch[2]], [0, 0, 0], [1.25, 0.85, 0.8]), shade(skin, 0.96), {
    bone: J.head,
    slot: 'skin',
  });

  // ── hair
  const rig: HairRig = addHair(b, look.hair, R, center, stretch, { head: J.head, tailA: B.tailA, tailB: B.tailB, crown: B.crown }, d);
  const raised = (p: Vec3): Vec3 => [p[0], p[1] + G, p[2]];
  if (rig.tailA) bones[B.tailA] = raised(rig.tailA);
  if (rig.tailB) bones[B.tailB] = raised(rig.tailB);
  if (rig.crown) bones[B.crown] = raised(rig.crown);

  // ── arms (shoulder + elbow bones); sleeves short or long
  for (const side of [1, -1]) {
    const sh = side === 1 ? J.shL : J.shR;
    const el = side === 1 ? J.elL : J.elR;
    const x = 0.132 * side;
    const sleeve = coat ? new Color(extraColor(look, 'coat', '#f7f6f2')) : top;
    const sleeveSlot = coat ? undefined : 'top';
    // shoulder ball + upper arm
    b.add(sphere(0.046, d, 14, 10), mat([x, 0.462, 0]), sleeve, { bone: sh, slot: sleeveSlot });
    if (longSleeves) {
      taperBetween(b, [x, 0.462, 0], [x * 1.015, 0.372, 0], 0.041, 0.037, sleeve, { bone: sh, slot: sleeveSlot }, d);
      taperBetween(b, [x * 1.015, 0.372, 0], [x * 1.015, 0.298, 0], 0.037, 0.035, sleeve, { bone: el, slot: sleeveSlot }, d);
      // cuff
      b.add(torus(0.033, 0.009, d), mat([x * 1.015, 0.3, 0], [Math.PI / 2, 0, 0]), shade(sleeve, 0.9), { bone: el, slot: sleeveSlot });
    } else {
      taperBetween(b, [x, 0.462, 0], [x * 1.01, 0.405, 0], 0.045, 0.043, top, { bone: sh, slot: 'top' }, d);
      taperBetween(b, [x, 0.44, 0], [x * 1.015, 0.372, 0], 0.035, 0.033, skin, { bone: sh, slot: 'skin' }, d);
      taperBetween(b, [x * 1.015, 0.372, 0], [x * 1.015, 0.3, 0], 0.033, 0.031, skin, { bone: el, slot: 'skin' }, d);
    }
    // a mitten hand with a thumb bump
    b.add(sphere(0.043, d, 14, 10), mat([x * 1.02, 0.272, 0.004], [0, 0, 0], [0.88, 1, 0.82]), skin, { bone: el, slot: 'skin' });
    b.add(sphere(0.018, d, 8, 6), mat([x * 1.02 - side * 0.026, 0.286, 0.022], [0, 0, 0], [1, 1.2, 1]), skin, { bone: el, slot: 'skin' });
  }

  // ── legs (thigh, knee, ankle bones)
  for (const side of [1, -1]) {
    const th = side === 1 ? J.thL : J.thR;
    const kn = side === 1 ? J.knL : J.knR;
    const an = side === 1 ? J.anL : J.anR;
    const x = 0.062 * side;
    const legTop = skirt ? skin : bottom;
    const legLow = skirt || shorts ? skin : bottom;
    // soft round legs, a little fuller at the top: thigh pivot → knee → ankle (LEG)
    taperBetween(b, [x, THIGH_Y, 0], [x, KNEE_Y, 0], 0.055, 0.046, legTop, { bone: th, slot: skirt ? 'skin' : 'bottom' }, d);
    if (shorts) b.add(torus(0.05, 0.008, d), mat([x, KNEE_Y + 0.045, 0], [Math.PI / 2, 0, 0]), shade(bottom, 0.9), { bone: th, slot: 'bottom' });
    taperBetween(b, [x, KNEE_Y, 0], [x, 0.055, 0], skirt || shorts ? 0.039 : 0.045, skirt || shorts ? 0.034 : 0.042, legLow, { bone: kn, slot: skirt || shorts ? 'skin' : 'bottom' }, d);
    // shoe: a soft rounded bean with a darker sole
    b.add(sphere(1, d, 16, 10), mat([x, 0.04, 0.02], [0.08, 0, 0], [0.054, 0.042, 0.078]), shoes, { bone: an, shade: 0.08 });
    b.add(sphere(1, d, 14, 6), mat([x, 0.014, 0.02], [0, 0, 0], [0.056, 0.014, 0.08]), shade(shoes, 0.7), { bone: an });
  }

  addExtras(b, look, d, stocky);
  return { builder: b, bones, slotColor, handR: [-0.134, 0.272 + G, 0.004] };
}

// ───────────────────────── extras ─────────────────────────

function addExtras(b: GeoBuilder, look: CharacterLook, d: Detail, stocky: number): void {
  const { R, center, stretch } = HEAD;
  const onHead = (theta: number, phi: number, k: number): Vec3 => {
    const v = dir(theta, phi).multiplyScalar(R * k);
    return [center[0] + v.x * stretch[0], center[1] + v.y * stretch[1], center[2] + v.z * stretch[2]];
  };
  const seg = (n: number) => Math.max(8, Math.round(n * d.seg));
  /** A piece of the torso surface (front etc.), pushed out by `out` (spine bone). */
  const torsoPanel = (y0: number, y1: number, phiHalf: number, out: number, c: Color, center0 = 0) => {
    const prof = smoothProfile(
      [
        [0.141, 0.258],
        [0.142, 0.3],
        [0.136, 0.36],
        [0.123, 0.42],
        [0.104, 0.468],
        [0.072, 0.505],
      ],
      6,
    ).filter(([, y]) => y >= y0 - 1e-6 && y <= y1 + 1e-6);
    const lower = y0 < 0.258 ? ([[0.133 + (0.141 - 0.133) * smoothstep(0.2, 0.258, y0), y0]] as Array<[number, number]>) : [];
    const pts = [...lower, ...prof].map(([r, y]) => [r * stocky * out, y] as [number, number]);
    b.add(lathe(pts, seg(16), center0 - phiHalf, phiHalf * 2), mat([0, 0, 0], [0, 0, 0], [1, 1, 0.84]), c, { bone: J.spine, shade: 0.06 });
  };

  if (hasExtra(look, 'coat')) {
    const cc = new Color(extraColor(look, 'coat', '#f7f6f2'));
    const prof = smoothProfile(
      [
        [0.0, 0.15],
        [0.15, 0.152],
        [0.155, 0.2],
        [0.152, 0.27],
        [0.148, 0.33],
        [0.138, 0.4],
        [0.118, 0.46],
        [0.08, 0.505],
        [0.05, 0.53],
      ],
      4,
    )
      .slice(1)
      .map(([r, y]) => [r * stocky, y] as [number, number]);
    const open = 0.32;
    b.add(lathe(prof, seg(26), open, Math.PI * 2 - open * 2), mat([0, 0, 0], [0, 0, 0], [1, 1, 0.86]), cc, { bone: J.spine, shade: 0.08 });
    b.add(lathe([...prof].reverse().map(([r, y]) => [r * 0.97, y] as [number, number]), seg(26), open, Math.PI * 2 - open * 2), mat([0, 0, 0], [0, 0, 0], [1, 1, 0.86]), shade(cc, 0.82), { bone: J.spine });
    // lapels
    for (const side of [1, -1]) {
      b.add(roundBox(0.05, 0.09, 0.016, 0.4, d), mat([side * 0.05, 0.45, 0.112], [-0.35, side * 0.35, side * -0.35]), shade(cc, 0.96), { bone: J.spine });
    }
    // a pocket and a pen
    b.add(roundBox(0.05, 0.035, 0.01, 0.4, d), mat([-0.07, 0.38, 0.125], [0, -0.45, 0]), shade(cc, 0.93), { bone: J.spine });
    b.add(cylinder(0.006, 0.006, 0.04, d), mat([-0.075, 0.405, 0.127], [0, 0, 0.1]), new Color('#4f7fd0'), { bone: J.spine });
  }
  if (hasExtra(look, 'apron')) {
    const ac = new Color(extraColor(look, 'apron', '#86bda5'));
    torsoPanel(0.19, 0.43, 0.9, 1.06, ac);
    // neck strap and a pocket
    b.add(torus(0.07, 0.008, d, Math.PI), mat([0, 0.47, 0.03], [0.5, 0, 0]), shade(ac, 0.9), { bone: J.spine });
    b.add(roundBox(0.09, 0.045, 0.012, 0.35, d), mat([0, 0.285, 0.143 * stocky], [0.05, 0, 0]), shade(ac, 0.9), { bone: J.spine });
  }
  if (hasExtra(look, 'dungarees')) {
    const dc = new Color(look.bottom);
    torsoPanel(0.262, 0.395, 0.55, 1.05, dc);
    for (const side of [1, -1]) {
      const a: Vec3 = [side * 0.055, 0.39, 0.118];
      const m1: Vec3 = [side * 0.075, 0.49, 0.06];
      const m2: Vec3 = [side * 0.07, 0.47, -0.095];
      const z: Vec3 = [side * 0.05, 0.33, -0.135];
      for (const [p, q] of [
        [a, m1],
        [m1, m2],
        [m2, z],
      ] as Array<[Vec3, Vec3]>) {
        taperBetween(b, p, q, 0.011, 0.011, dc, { bone: J.spine }, d);
      }
      b.add(sphere(0.011, d, 8, 6), mat([side * 0.052, 0.38, 0.124]), new Color('#f2cf6a'), { bone: J.spine });
    }
  }
  if (hasExtra(look, 'collar')) {
    for (const side of [1, -1]) {
      b.add(roundBox(0.062, 0.04, 0.014, 0.35, d), mat([side * 0.03, 0.505, 0.06], [0.5, side * 0.3, side * 0.6]), new Color('#f6f4ef'), { bone: J.spine });
    }
  }
  if (hasExtra(look, 'tie')) {
    const tc = new Color(extraColor(look, 'tie', '#8a3d4f'));
    b.add(sphere(0.016, d, 8, 6), mat([0, 0.49, 0.086], [0, 0, 0], [1.2, 1, 0.8]), tc, { bone: J.spine });
    b.add(roundBox(0.036, 0.12, 0.012, 0.45, d), mat([0, 0.425, 0.112], [-0.28, 0, 0]), tc, { bone: J.spine });
  }
  if (hasExtra(look, 'scarf')) {
    const sc = new Color(extraColor(look, 'scarf', '#e66f6f'));
    b.add(torus(0.068, 0.03, d), mat([0, 0.518, 0], [Math.PI / 2 - 0.12, 0, 0], [1, 0.9, 1]), sc, { bone: J.spine });
    b.add(roundBox(0.045, 0.1, 0.022, 0.4, d), mat([0.045, 0.45, 0.1], [-0.2, 0, 0.15]), shade(sc, 0.92), { bone: J.spine });
  }
  if (hasExtra(look, 'stethoscope')) {
    const g = new Color('#5c6470');
    b.add(torus(0.085, 0.007, d, Math.PI * 1.15), mat([0, 0.47, 0.035], [0.75, 0, Math.PI + 0.24]), g, { bone: J.spine });
    taperBetween(b, [0.05, 0.43, 0.105], [0.04, 0.37, 0.125], 0.006, 0.006, g, { bone: J.spine }, d);
    b.add(cylinder(0.018, 0.018, 0.01, d), mat([0.04, 0.36, 0.128], [Math.PI / 2 - 0.3, 0, 0]), new Color('#c9d0d8'), { bone: J.spine });
  }
  if (hasExtra(look, 'logo')) {
    b.add(cylinder(0.032, 0.032, 0.008, d), mat([0.035, 0.405, 0.117], [Math.PI / 2 - 0.25, 0, 0]), new Color('#7fe0e6'), { bone: J.spine });
    b.add(cylinder(0.016, 0.016, 0.01, d), mat([0.035, 0.405, 0.119], [Math.PI / 2 - 0.25, 0, 0]), new Color(look.top), { bone: J.spine });
  }
  if (hasExtra(look, 'backpack')) {
    const bc = new Color(extraColor(look, 'backpack', '#f2a65a'));
    b.add(roundBox(0.2, 0.2, 0.09, 0.3, d), mat([0, 0.36, -0.15]), bc, { bone: J.spine, shade: 0.1 });
    b.add(roundBox(0.14, 0.07, 0.03, 0.35, d), mat([0, 0.31, -0.2]), shade(bc, 0.88), { bone: J.spine });
    for (const side of [1, -1]) taperBetween(b, [side * 0.075, 0.47, -0.07], [side * 0.085, 0.3, 0.05], 0.012, 0.012, shade(bc, 0.8), { bone: J.spine }, d);
  }
  if (hasExtra(look, 'headband')) {
    const hc = new Color(extraColor(look, 'headband', '#f29bb0'));
    // over the crown from ear to ear, a little forward, hugging the hair
    b.add(torus(R * 1.105, 0.014, d, Math.PI), mat(center, [-0.42, 0, 0], [stretch[0], stretch[1], stretch[2]]), hc, { bone: J.head });
    const f = onHead(0.62, 0.9, 1.12);
    addFlower(b, f, hc, new Color('#fff3b0'), J.head, d, 0.022);
  }
  if (hasExtra(look, 'beard')) {
    const hc = new Color(look.hair.color);
    const beard = shell({
      cols: seg(30),
      rows: seg(8),
      phiMin: -1.7,
      phiMax: 1.7,
      thetaMin: (phi) => 2.22 - 0.55 * smoothstep(0.45, 1.5, Math.abs(phi)),
      thetaMax: (phi) => 2.78 - 0.45 * smoothstep(0.9, 1.7, Math.abs(phi)),
      radius: (theta, phi, t) => R * (1.03 + 0.07 * bump(t - 0.5, 0.5) + 0.02 * Math.abs(Math.sin(phi * 9 + theta * 5))),
    });
    b.add(beard, mat(center, [0, 0, 0], stretch), hc, { bone: J.head });
  }
  if (hasExtra(look, 'glasses') || hasExtra(look, 'sunglasses')) {
    const sun = hasExtra(look, 'sunglasses');
    const frame = new Color(sun ? '#24232b' : look.hair.color === '#d9d4ce' ? '#9a6a4a' : '#4a3a3a');
    const pts: Vec3[] = [];
    for (const side of [1, -1]) {
      const p = onHead(EYE_THETA, side * EYE_PHI, 1.075);
      pts.push(p);
      const facing = dir(EYE_THETA, side * EYE_PHI);
      const yaw = Math.atan2(facing.x, facing.z);
      b.add(torus(sun ? 0.056 : 0.052, 0.0085, d), mat(p, [0, yaw, 0]), frame, { bone: J.head });
      if (sun) b.add(sphere(1, d, 14, 10), mat(p, [0, yaw, 0], [0.055, 0.052, 0.01]), new Color('#2c2f3a'), { bone: J.head });
      // arm to the ear
      const ear: Vec3 = [side * 0.225, 0.75, -0.02];
      const outer = onHead(EYE_THETA, side * (EYE_PHI + 0.27), 1.06);
      taperBetween(b, outer, ear, 0.006, 0.006, frame, { bone: J.head }, d);
    }
    const mid = onHead(EYE_THETA - 0.02, 0, 1.06);
    const { m, length } = along(pts[0], pts[1]);
    void m;
    b.add(cylinder(0.006, 0.006, length * 0.35, d), mat(mid, [0, 0, Math.PI / 2]), frame, { bone: J.head });
  }
  if (hasExtra(look, 'cap')) {
    // transit cap: navy dome, gold band, a visor and a badge (its own bone: a loot hat hides it)
    const navy = new Color('#2f4a7a');
    const capShell = shell({ cols: seg(40), rows: seg(10), thetaMax: () => 1.08, radius: (theta) => R * (1.17 + 0.05 * smoothstep(1.08, 0.2, theta)) });
    b.add(capShell, mat(center, [0, 0, 0], [stretch[0], stretch[1] * 1.05, stretch[2]]), navy, { bone: B.cap });
    const band = onHead(1.08, 0, 1.0);
    b.add(torus(R * 1.17 * Math.sin(1.08), 0.016, d), mat([center[0], band[1] + 0.01, center[2]], [Math.PI / 2, 0, 0], [stretch[0], stretch[2], 1]), new Color('#d9b24a'), { bone: B.cap });
    const visor = onHead(1.2, 0, 1.18);
    b.add(roundBox(0.2, 0.016, 0.11, 0.3, d), mat([visor[0], visor[1] + 0.02, visor[2] + 0.02], [0.28, 0, 0]), shade(navy, 0.7), { bone: B.cap });
    const badge = onHead(0.82, 0, 1.24);
    b.add(sphere(0.022, d, 10, 8), mat(badge, [0, 0, 0], [1, 1, 0.5]), new Color('#f2cf6a'), { bone: B.cap });
  }
}

/** A five-petal flower facing outward from the head (hats, headbands). */
export function addFlower(b: GeoBuilder, at: Vec3, petal: Color, middle: Color, bone: number, d: Detail, r = 0.02): void {
  const out = new Vector3(at[0], at[1] - HEAD.center[1], at[2]).normalize();
  const up = new Vector3(0, 1, 0);
  const side = new Vector3().crossVectors(up, out).normalize();
  const up2 = new Vector3().crossVectors(out, side).normalize();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new Vector3(at[0], at[1], at[2]).addScaledVector(side, Math.cos(a) * r).addScaledVector(up2, Math.sin(a) * r);
    b.add(sphere(r * 0.72, d, 8, 6), mat([p.x, p.y, p.z], [0, 0, 0], [1, 1, 0.6]), petal, { bone });
  }
  b.add(sphere(r * 0.55, d, 8, 6), mat([at[0] + out.x * 0.006, at[1] + out.y * 0.006, at[2] + out.z * 0.006]), middle, { bone });
}
