import { Bone, Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BONE_REST } from './body';
import type { CharAction } from '../contracts';
import {
  ACTION_SECONDS,
  angleDelta,
  Animator,
  BODY,
  BLINK_SECONDS,
  blinkEyes,
  C,
  CHANNELS,
  cheerHop,
  kneeRaiseForSeat,
  ONE_SHOTS,
  SEAT_DESIGN,
  shotEnvelope,
  springStep,
  Spring,
  J,
  LEG,
  DEFAULT_RUN_SPEED,
  DEFAULT_WALK_SPEED,
  stepsPerSecond,
} from './anim';

const ALL: CharAction[] = ['idle', 'walk', 'run', 'sit', 'wave', 'yes', 'no', 'talk', 'drink', 'water', 'fish', 'read', 'cheer'];
const DT = 1 / 60;

/**
 * The person's skeleton as person.ts builds it (bind = rest positions), posed from an animator: the world positions
 * of the two ankles, measured the way the town's critique measures them.
 */
function rig(tiles = 0.75) {
  const bones: Bone[] = [];
  for (let i = 0; i <= 12; i++) {
    const b = new Bone();
    const r = BONE_REST[i];
    if (r.parent < 0) b.position.set(r.pos[0], r.pos[1], r.pos[2]);
    else {
      const q = BONE_REST[r.parent].pos;
      b.position.set(r.pos[0] - q[0], r.pos[1] - q[1], r.pos[2] - q[2]);
      bones[r.parent].add(b);
    }
    bones.push(b);
  }
  const rest = bones[0].position.clone();
  const pivot = new Group();
  pivot.add(bones[0]);
  const root = new Group();
  root.add(pivot);
  const out = [new Vector3(), new Vector3()];
  return {
    root,
    pose(a: Animator, x: number, z: number): Vector3[] {
      const p = a.pose;
      for (let j = 0; j <= 12; j++) bones[j].rotation.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
      bones[0].position.set(rest.x + p[C.hipX], rest.y + p[C.hipY], rest.z + p[C.hipZ]);
      const sq = p[C.squash];
      pivot.scale.set(tiles * (1 - sq * 0.5), tiles * (1 + sq), tiles * (1 - sq * 0.5));
      pivot.rotation.y = Math.PI / 2 - a.heading;
      root.position.set(x, 0, z);
      root.updateMatrixWorld(true);
      bones[J.anL].getWorldPosition(out[0]);
      bones[J.anR].getWorldPosition(out[1]);
      return out;
    },
  };
}

/** Walk an animator along a path of points at `pace` (tiles/s), easing in and out, measuring the planted ankles. */
function walkPath(points: Array<[number, number]>, pace: number, opts: { run?: boolean; dt?: number } = {}) {
  const dt = opts.dt ?? 1 / 60;
  const a = new Animator({ seed: 5 });
  const r = rig();
  let [x, z] = points[0];
  a.setHeading(Math.atan2(points[1][1] - z, points[1][0] - x), true);
  a.setAction(opts.run ? 'run' : 'walk');
  let v = 0;
  let k = 1;
  const slips: number[] = [];
  const lifts: number[] = [];
  let prev: Array<{ x: number; y: number; z: number }> | null = null;
  let px = x;
  let pz = z;
  for (let f = 0; f < 4000 && k < points.length; f++) {
    const [gx, gz] = points[k];
    let left = 0;
    for (let i = k; i < points.length; i++) left += Math.hypot(points[i][0] - (i === k ? x : points[i - 1][0]), points[i][1] - (i === k ? z : points[i - 1][1]));
    const top = Math.min(pace, Math.sqrt(2 * pace * left / 0.3));
    v = Math.min(top, v + (pace / 0.15) * dt);
    let step = v * dt;
    while (step > 0 && k < points.length) {
      const d = Math.hypot(points[k][0] - x, points[k][1] - z);
      if (d <= step) {
        [x, z] = points[k];
        step -= d;
        k++;
      } else {
        x += ((gx - x) / d) * step;
        z += ((gz - z) / d) * step;
        step = 0;
      }
    }
    if (Math.hypot(x - px, z - pz) > 1e-9) a.setHeading(Math.atan2(z - pz, x - px));
    a.placeAt(x, z);
    a.update(dt, v);
    const ank = r.pose(a, x, z).map((p) => ({ x: p.x, y: p.y, z: p.z }));
    const sp = Math.hypot(x - px, z - pz) / dt;
    if (prev && sp > 0.15) {
      // the lower ankle in both frames is the standing foot: how fast it moves over the ground, for the body's speed
      const st = ank[0].y < ank[1].y ? 0 : 1;
      const pst = prev[0].y < prev[1].y ? 0 : 1;
      if (st === pst && Math.abs(ank[0].y - ank[1].y) > 0.004) slips.push(Math.hypot(ank[st].x - prev[st].x, ank[st].z - prev[st].z) / dt / sp);
      lifts.push(Math.abs(ank[0].y - ank[1].y));
    }
    prev = ank;
    px = x;
    pz = z;
  }
  // stand a moment: the legs close
  for (let f = 0; f < 60; f++) {
    a.placeAt(x, z);
    a.update(dt, 0);
  }
  const end = r.pose(a, x, z).map((p) => ({ x: p.x, y: p.y, z: p.z }));
  const pct = (l: number[], q: number) => [...l].sort((m, n) => m - n)[Math.floor(q * (l.length - 1))];
  return { a, slip50: pct(slips, 0.5), slip90: pct(slips, 0.9), lift: Math.max(...lifts), end, x, z };
}

describe('walking legs (swinging from the hips, 2026-11-22)', () => {
  /** Walk straight at a pace and measure the ankles in the world (after the walk has settled in). */
  function stride(pace: number) {
    const a = new Animator({ seed: 5 });
    const r = rig();
    a.setHeading(0, true);
    if (pace > 2) a.setAction('run');
    let x = 0;
    const low: number[] = [];
    const lift: number[] = [];
    for (let f = 0; f < 300; f++) {
      x += pace / 60;
      a.placeAt(x, 0);
      a.update(1 / 60, pace);
      if (f < 90) continue;
      const [l, rr] = r.pose(a, x, 0);
      low.push(Math.min(l.y, rr.y));
      lift.push(Math.abs(l.y - rr.y));
    }
    return { lowMin: Math.min(...low), lowMax: Math.max(...low), lift: Math.max(...lift) };
  }
  // the ankle of a foot flat on the ground (design units × tiles)
  const GROUND = LEG.ankle * 0.75;

  it('walking, the lower foot stays on the ground (within a couple of millimetres) and the other lifts clear', () => {
    for (const pace of [0.7, DEFAULT_WALK_SPEED]) {
      const w = stride(pace);
      expect(w.lowMin, `pace ${pace}`).toBeGreaterThan(GROUND - 0.002);
      expect(w.lowMax, `pace ${pace}`).toBeLessThan(GROUND + 0.002);
      expect(w.lift, `pace ${pace}`).toBeGreaterThan(0.01);
    }
    // a run never puts a foot into the ground and leaves it (a moment in the air)
    const r = stride(DEFAULT_RUN_SPEED);
    expect(r.lowMin).toBeGreaterThan(GROUND - 0.002);
    expect(r.lift).toBeGreaterThan(0.03);
  });

  it('after a stop the feet stand side by side under the hips, both on the ground', () => {
    const w = walkPath([[0, 0], [3.3, 0.4]], DEFAULT_WALK_SPEED);
    const [l, r] = w.end;
    expect(Math.abs(l.y - r.y)).toBeLessThan(0.002);
    // about a hip's width apart, under the body
    expect(Math.hypot(l.x - r.x, l.z - r.z)).toBeLessThan(0.14);
    expect(Math.hypot((l.x + r.x) / 2 - w.x, (l.z + r.z) / 2 - w.z)).toBeLessThan(0.04);
  });

  it("a calm cadence, about Cozyverse's: two and a half steps a second strolling, three and a half walking, under five running", () => {
    // residents stroll at 0.7 tiles/s ± 10%, passers-by up to 0.875, children (0.74 the size) at 0.75
    for (const pace of [0.63, 0.7, 0.77, 0.875]) {
      expect(stepsPerSecond(pace), String(pace)).toBeGreaterThanOrEqual(2.3);
      expect(stepsPerSecond(pace), String(pace)).toBeLessThanOrEqual(3);
    }
    expect(stepsPerSecond(0.75, 0.75 * 0.74)).toBeLessThanOrEqual(3.3);
    // the player's walk and run (engine/sim.ts PLAYER_SPEED, PLAYER_RUN); Cozyverse's chibis walk about 3.5 a second
    expect(stepsPerSecond(DEFAULT_WALK_SPEED)).toBeGreaterThanOrEqual(3.2);
    expect(stepsPerSecond(DEFAULT_WALK_SPEED)).toBeLessThanOrEqual(3.7);
    expect(stepsPerSecond(DEFAULT_RUN_SPEED)).toBeGreaterThanOrEqual(4.2);
    expect(stepsPerSecond(DEFAULT_RUN_SPEED)).toBeLessThanOrEqual(5);
    // quicker pace, quicker steps; a smaller body steps quicker at the same pace
    let last = 0;
    for (let pace = 0.4; pace <= 3.2; pace += 0.1) {
      const s = stepsPerSecond(pace);
      expect(s, String(pace)).toBeGreaterThan(last);
      last = s;
    }
    expect(stepsPerSecond(0.75, 0.75 * 0.74)).toBeGreaterThan(stepsPerSecond(0.75));
  });

  it('a change of direction never splays a leg: the feet turn with the body (the owner: "như bị gãy chân")', () => {
    // the player's body turns quickly (engine3d PLAYER_TURN_W 26); before 2026-11-22 a planted foot stayed where it was
    // while the body swung round it and the landing foot aimed along the lagging velocity: thighs out 23–36°
    for (const [pace, turn, limit] of [
      [DEFAULT_WALK_SPEED, Math.PI / 2, 0.14],
      [DEFAULT_WALK_SPEED, Math.PI, 0.14],
      [0, Math.PI / 2, 0.2],
      [0, Math.PI, 0.3],
    ] as const) {
      const a = new Animator({ seed: 3 });
      a.turnWalk = 26;
      a.turnStand = 26;
      a.setHeading(0, true);
      let x = 0;
      let z = 0;
      let out = 0;
      for (let f = 0; f < 150; f++) {
        a.setHeading(f < 60 ? 0 : turn);
        x += (Math.cos(a.heading) * pace) / 60;
        z += (Math.sin(a.heading) * pace) / 60;
        a.placeAt(x, z);
        a.update(1 / 60, pace);
        if (f >= 58) out = Math.max(out, Math.abs(a.pose[J.thL * 3 + 2]), Math.abs(a.pose[J.thR * 3 + 2]));
      }
      expect(out, `pace ${pace} turn ${turn.toFixed(2)}`).toBeLessThan(limit);
    }
  });

  it('turning on the spot, the feet step round with the body (pivoting only part of the way)', () => {
    const a = new Animator({ seed: 2 });
    const r = rig();
    a.setHeading(0, true);
    for (let f = 0; f < 30; f++) {
      a.placeAt(0, 0);
      a.update(1 / 60, 0);
    }
    a.setHeading(Math.PI / 2);
    let stepped = 0;
    for (let f = 0; f < 90; f++) {
      a.placeAt(0, 0);
      a.update(1 / 60, 0);
      const [l, rr] = r.pose(a, 0, 0);
      if (Math.max(l.y, rr.y) > LEG.ankle * 0.75 + 0.01) stepped++;
    }
    expect(stepped).toBeGreaterThan(5);
    const [l, rr] = r.pose(a, 0, 0);
    // the feet end across the new heading (side by side along x)
    expect(Math.abs(l.z - rr.z)).toBeLessThan(0.03);
    expect(Math.abs(l.x - rr.x)).toBeGreaterThan(0.05);
  });
});

describe('the upper body of a walk (rise and fall, sway, swing, lean)', () => {
  /** Walk at a steady pace and measure the upper body over a few seconds. */
  function measure(pace: number) {
    const a = new Animator({ seed: 3 });
    a.setHeading(0, true);
    a.setAction(pace > 2 ? 'run' : 'walk');
    let x = 0;
    const head: number[] = [];
    const roll: number[] = [];
    const arm: number[] = [];
    const lean: number[] = [];
    const sq: number[] = [];
    let lows = 0;
    let prevY = 0;
    let falling = false;
    for (let t = 0; t < 4; t += DT / 2) {
      x += pace * (DT / 2);
      a.placeAt(x, 0);
      a.update(DT / 2, pace);
      const p = a.pose;
      for (let i = 0; i < CHANNELS; i++) expect(Number.isFinite(p[i])).toBe(true);
      if (t < 1.5) continue;
      const y = (BODY.headTop + p[C.hipY]) * (1 + p[C.squash]);
      if (falling && y > prevY) lows++;
      falling = y < prevY;
      prevY = y;
      head.push(y);
      roll.push(p[J.hips * 3 + 2] + p[J.spine * 3 + 2]);
      arm.push(p[J.shL * 3]);
      lean.push(p[J.spine * 3] + p[J.hips * 3]);
      sq.push(p[C.squash]);
    }
    const p2p = (l: number[]) => Math.max(...l) - Math.min(...l);
    return { bob: p2p(head) / BODY.headTop, lowsPerSecond: lows / 2.5, roll: p2p(roll), arm: p2p(arm), lean: lean.reduce((s, v) => s + v, 0) / lean.length, squash: p2p(sq) };
  }

  it("the player's walk rises and falls softly once a step, steady sideways, leaning in, the arms swinging", () => {
    const w = measure(DEFAULT_WALK_SPEED);
    // the head goes up and down about 2% of the height, no more (8% with a waddle of 10° read as a shiver, the
    // owner, 2026-11-21: "nhân vật di chuyển cứ rung rung")
    expect(w.bob).toBeGreaterThan(0.01);
    expect(w.bob).toBeLessThan(0.03);
    // one low a step
    expect(w.lowsPerSecond).toBeGreaterThan(stepsPerSecond(DEFAULT_WALK_SPEED) * 0.8);
    expect(w.lowsPerSecond).toBeLessThan(stepsPerSecond(DEFAULT_WALK_SPEED) * 1.25);
    // a sway of a degree or two, a lean forward, arms swinging about ±25°, no squash a step
    expect(w.roll).toBeLessThan(0.05);
    expect(w.lean).toBeGreaterThan(0.05);
    expect(w.arm).toBeGreaterThan(0.6);
    expect(w.arm).toBeLessThan(1.1);
    expect(w.squash).toBeLessThan(0.005);
  });

  it('a run bounces higher, leans more, waddles less and swings the arms less than a walk', () => {
    const w = measure(DEFAULT_WALK_SPEED);
    const r = measure(DEFAULT_RUN_SPEED);
    expect(r.bob).toBeGreaterThan(w.bob);
    expect(r.lean).toBeGreaterThan(w.lean + 0.05);
    // (owner, 2026-11-28: "chạy bớt vung tay lại")
    expect(r.arm).toBeLessThan(w.arm);
    expect(r.roll).toBeLessThan(w.roll);
  });

  it('the body rises and falls smoothly: never a jolt at a landing', () => {
    // a jolt is a big change of speed in one frame: at 60 fps the head's second difference stays near a smooth
    // wave's (8‰ of the height with planted feet, 2026-11-21; before that the legs dropped the hips 2.5 cm in two frames)
    for (const [pace, limit] of [[0.7, 0.001], [DEFAULT_WALK_SPEED, 0.002], [DEFAULT_RUN_SPEED, 0.01]] as const) {
      const a = new Animator({ seed: 4 });
      a.setHeading(0, true);
      a.setAction(pace > 2 ? 'run' : 'walk');
      let x = 0;
      const ys: number[] = [];
      for (let t = 0; t < 4; t += 1 / 60) {
        x += pace / 60;
        a.placeAt(x, 0);
        a.update(1 / 60, pace);
        if (t > 1) ys.push(BODY.headTop + a.pose[C.hipY]);
      }
      let worst = 0;
      for (let i = 2; i < ys.length; i++) worst = Math.max(worst, Math.abs(ys[i] - 2 * ys[i - 1] + ys[i - 2]));
      expect(worst / BODY.headTop, `pace ${pace}`).toBeLessThan(limit);
    }
  });

  it('a stroll is calmer than a brisk walk', () => {
    const s = measure(0.7);
    const w = measure(DEFAULT_WALK_SPEED);
    expect(s.bob).toBeLessThan(w.bob);
    expect(s.arm).toBeLessThan(w.arm);
    expect(s.lean).toBeLessThan(w.lean);
  });

  it('a turn eases in and settles without swinging past (a swing past read as a wobble)', () => {
    for (const walking of [false, true]) {
      const a = new Animator({ seed: 3 });
      a.setHeading(0, true);
      let x = 0;
      const pace = walking ? DEFAULT_WALK_SPEED : 0;
      for (let t = 0; t < 1; t += DT) {
        x += pace * DT;
        a.placeAt(x, 0);
        a.update(DT, pace);
      }
      a.setHeading(Math.PI / 2);
      let over = 0;
      for (let t = 0; t < 1.5; t += DT) {
        x += pace * DT;
        a.placeAt(x, 0);
        a.update(DT, pace);
        over = Math.max(over, a.heading - Math.PI / 2);
      }
      expect(over, `walking ${walking}`).toBeLessThan(0.01);
      expect(Math.abs(a.heading - Math.PI / 2)).toBeLessThan(0.01);
    }
  });

  it('setting off and stopping squash the body a little, and it comes back to rest', () => {
    const a = new Animator({ seed: 3 });
    a.setHeading(0, true);
    let x = 0;
    let v = 0;
    let minSq = 0;
    let maxLean = 0;
    let walkLean = 0;
    for (let t = 0; t < 4; t += DT) {
      const want = t > 0.5 && t < 2 ? DEFAULT_WALK_SPEED : 0;
      v = want > v ? Math.min(want, v + (DEFAULT_WALK_SPEED / 0.14) * DT) : Math.max(want, v - (DEFAULT_WALK_SPEED / 0.28) * DT * 1.5);
      x += v * DT;
      a.placeAt(x, 0);
      a.update(DT, v);
      const lean = a.pose[J.spine * 3] + a.pose[J.hips * 3];
      if (t > 1.6 && t < 2) walkLean = Math.max(walkLean, lean);
      if (t > 2) {
        minSq = Math.min(minSq, a.pose[C.squash]);
        maxLean = Math.max(maxLean, lean);
      }
    }
    // the stop: a squash of well under a percent (felt more than seen), the body pitching on a little past its lean
    expect(minSq).toBeLessThan(-0.002);
    expect(minSq).toBeGreaterThan(-0.03);
    expect(maxLean).toBeGreaterThanOrEqual(walkLean);
    // at rest again: standing straight (only breathing)
    expect(Math.abs(a.pose[C.squash])).toBeLessThan(0.012);
    expect(Math.abs(a.pose[J.spine * 3] + a.pose[J.hips * 3])).toBeLessThan(0.05);
  });

  it('runners count their footfalls (the scene puffs dust), standing people do not', () => {
    const a = new Animator({ seed: 3 });
    for (let t = 0; t < 1; t += DT) a.update(DT, 0);
    expect(a.footfalls).toBe(0);
    for (let t = 0; t < 2; t += DT) a.update(DT, DEFAULT_RUN_SPEED);
    expect(a.footfalls / 2).toBeGreaterThan(stepsPerSecond(DEFAULT_RUN_SPEED) * 0.6);
    expect(a.runShare).toBeGreaterThan(0.9);
  });

  it('the damped spring: critical never overshoots, under-damped swings a little past, a long frame stays stable', () => {
    for (const [zeta, lo, hi] of [[1, 1 - 1e-6, 1 + 1e-6], [0.72, 1.01, 1.06], [0.4, 1.15, 1.35]] as const) {
      const s = new Spring();
      let max = 0;
      for (let i = 0; i < 240; i++) max = Math.max(max, s.step(1, 12, zeta, DT));
      expect(max, `zeta ${zeta}`).toBeGreaterThanOrEqual(zeta === 1 ? 0.99 : lo);
      expect(max, `zeta ${zeta}`).toBeLessThanOrEqual(hi);
      expect(s.x).toBeCloseTo(1, 3);
    }
    const s = new Spring();
    for (let i = 0; i < 50; i++) s.step(1, 30, 0.3, 0.1);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(s.x).toBeCloseTo(1, 2);
  });
});

describe('timing and blending maths', () => {
  it('one-shot envelopes start and end at 0 and reach 1', () => {
    for (const s of ONE_SHOTS) {
      const d = ACTION_SECONDS[s];
      expect(d).toBeGreaterThan(0.5);
      expect(shotEnvelope(0, d)).toBe(0);
      expect(shotEnvelope(d, d)).toBe(0);
      expect(shotEnvelope(d / 2, d)).toBeCloseTo(1, 5);
    }
  });

  it('angleDelta takes the short way round', () => {
    expect(angleDelta(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(3, -3)).toBeCloseTo(Math.PI * 2 - 6);
    expect(Math.abs(angleDelta(-3, 3))).toBeLessThanOrEqual(Math.PI);
  });

  it('the turn spring eases in and out and never overshoots', () => {
    let x = 0;
    let v = 0;
    let max = 0;
    for (let i = 0; i < 120; i++) {
      [x, v] = springStep(x, v, 1, 11, DT);
      max = Math.max(max, x);
    }
    expect(max).toBeLessThanOrEqual(1 + 1e-9);
    expect(x).toBeCloseTo(1, 3);
    // first frame barely moves (eases in)
    const [x1] = springStep(0, 0, 1, 11, DT);
    expect(x1).toBeLessThan(0.02);
  });

  it('blinks go half → closed → half', () => {
    expect(blinkEyes(-1)).toBeNull();
    expect(blinkEyes(0.01)).toBe('half');
    expect(blinkEyes(BLINK_SECONDS / 2)).toBe('closed');
    expect(blinkEyes(BLINK_SECONDS * 0.9)).toBe('half');
    expect(blinkEyes(BLINK_SECONDS)).toBeNull();
  });

  it('a seat never pushes the feet into the ground; on the town benches the feet hang just over it', () => {
    // the hip joint sits 0.055 over the seat, the thigh goes forward (raised for a low seat), the shin hangs down
    const sole = (seat: number) => seat + 0.055 + LEG.thigh * Math.sin(kneeRaiseForSeat(seat)) - (LEG.shin + LEG.ankle);
    for (const seat of [0.05, 0.1, SEAT_DESIGN, 0.25, 0.35]) {
      // the knees rise for a low seat; for a high one the thighs slope down, never more than about 15°
      expect(kneeRaiseForSeat(seat)).toBeGreaterThanOrEqual(-0.27);
      expect(sole(seat)).toBeGreaterThanOrEqual(-1e-6);
    }
    // a grown-up on a bench (SEAT_DESIGN): the soles hang about a tenth of the height over the ground (a third before
    // the legs grew and the benches came down: 0.33)
    expect(sole(SEAT_DESIGN)).toBeLessThan(0.12);
    // the seat is a little below the hips of somebody standing
    expect(SEAT_DESIGN).toBeLessThan(LEG.hipY);
    expect(SEAT_DESIGN).toBeGreaterThan(LEG.hipY - 0.06);
  });

  it('the cheer jumps twice and lands', () => {
    expect(cheerHop(0)).toBe(0);
    expect(cheerHop(0.37)).toBeGreaterThan(0.1);
    expect(cheerHop(0.86)).toBeGreaterThan(0.04);
    expect(cheerHop(ACTION_SECONDS.cheer)).toBe(0);
  });
});

describe('no pops', () => {
  /** Largest change of any channel between two frames, over a scripted day of switching actions. */
  function worstJump(script: Array<[number, CharAction, number]>, seconds: number, DT = 1 / 240): { worst: number; at: string } {
    const a = new Animator({ seed: 11 });
    let prev = Float32Array.from(a.pose);
    let worst = 0;
    let at = '';
    let k = 0;
    let speed = 0;
    let want = 0;
    for (let t = 0; t < seconds; t += DT) {
      while (k < script.length && script[k][0] <= t) {
        a.setAction(script[k][1]);
        want = script[k][2];
        k++;
      }
      // the pace eases up and down as the town's walkers do (sim.ts START_TIME, STOP_TIME): a body never goes from
      // a stand to a run in one frame
      speed = want > speed ? Math.min(want, speed + (DEFAULT_RUN_SPEED / 0.14) * DT) : Math.max(want, speed - (DEFAULT_RUN_SPEED / 0.28) * DT);
      a.update(DT, speed);
      for (let i = 0; i < CHANNELS; i++) {
        const d = Math.abs(a.pose[i] - prev[i]);
        if (!Number.isFinite(a.pose[i])) throw new Error(`channel ${i} not finite`);
        // prop weights and the can's tilt are allowed to move faster; joints are not
        if (i >= C.cup && i <= C.tug) continue;
        if (d > worst) {
          worst = d;
          at = `${t.toFixed(2)}s ch${i}`;
        }
      }
      prev = Float32Array.from(a.pose);
    }
    return { worst, at };
  }

  // A pop is a jump that does not shrink with the frame time: halving the frame time must about halve the worst step
  // of any joint. And at 240 fps no joint moves more than 0.5 rad a frame: the knee of a quick little step (these
  // legs are short: six to ten steps a second) bends and straightens in a few hundredths of a second.
  it('switching between any two actions never jumps a joint', () => {
    const script: Array<[number, CharAction, number]> = [];
    let t = 0;
    for (const a of ALL) {
      for (const b of ALL) {
        const speedOf = (x: CharAction) => (x === 'walk' ? DEFAULT_WALK_SPEED : x === 'run' ? DEFAULT_RUN_SPEED : 0);
        script.push([t, a, speedOf(a)]);
        script.push([t + 0.35, b, speedOf(b)]);
        t += 0.8;
      }
    }
    const { worst, at } = worstJump(script, t + 1);
    expect(worst, at).toBeLessThan(0.5);
    const half = worstJump(script, t + 1, 1 / 480);
    expect(half.worst / worst, half.at).toBeLessThan(0.65);
  });

  it('a one-shot cut short by another fades, it does not snap', () => {
    const { worst, at } = worstJump(
      [
        [0, 'wave', 0],
        [0.5, 'cheer', 0],
        [0.7, 'no', 0],
        [0.9, 'yes', 0],
        [1.0, 'walk', 1.1],
        [1.2, 'wave', 1.1],
      ],
      4,
    );
    expect(worst, at).toBeLessThan(0.5);
  });

  it('one-shots return to the loop that was playing', () => {
    const a = new Animator({ seed: 2 });
    a.setAction('talk');
    a.setAction('wave');
    expect(a.action).toBe('talk');
    for (let t = 0; t < ACTION_SECONDS.wave + 0.5; t += DT) a.update(DT, 0);
    expect(a.busy()).toBe(false);
    expect(a.weight('talk')).toBeGreaterThan(0.95);
  });

  it('walking puts down the cup; talking carries on', () => {
    const a = new Animator({ seed: 4 });
    a.setAction('drink');
    for (let t = 0; t < 1; t += DT) a.update(DT, 0);
    expect(a.pose[C.cup]).toBeGreaterThan(0.95);
    for (let t = 0; t < 1; t += DT) a.update(DT, 1.2);
    expect(a.pose[C.cup]).toBeLessThan(0.05);
    a.setAction('talk');
    for (let t = 0; t < 1; t += DT) a.update(DT, 1.2);
    expect(a.weight('talk')).toBeGreaterThan(0.9);
  });

  it('the face blinks now and then, and the mouth moves while talking', () => {
    const a = new Animator({ seed: 9 });
    a.setAction('talk');
    const eyes = new Set<string>();
    const mouths = new Set<string>();
    for (let t = 0; t < 8; t += DT) {
      a.update(DT, 0);
      eyes.add(a.face.eyes);
      mouths.add(a.face.mouth);
    }
    expect(eyes.has('closed')).toBe(true);
    expect(eyes.has('open')).toBe(true);
    expect(mouths.size).toBeGreaterThanOrEqual(3);
  });

  it('turning eases toward the new heading by the short way', () => {
    const a = new Animator();
    a.setHeading(3, true);
    a.setHeading(-3);
    a.update(DT, 0);
    const first = a.heading;
    for (let t = 0; t < 1; t += DT) a.update(DT, 0);
    expect(Math.abs(angleDelta(a.heading, -3))).toBeLessThan(0.01);
    // it went up through π, not down through 0
    expect(first).toBeGreaterThan(3 - 1e-9);
  });
});
