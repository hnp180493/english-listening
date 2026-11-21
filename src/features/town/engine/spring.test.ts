import { describe, expect, it } from 'vitest';
import { cameraDt, springStep } from './spring';

describe('springStep', () => {
  it('reaches its goal without overshoot, from rest, whatever the step', () => {
    for (const dt of [1 / 144, 1 / 60, 1 / 30]) {
      let x = 0;
      let v = 0;
      let most = 0;
      for (let t = 0; t < 2; t += dt) {
        [x, v] = springStep(x, v, 10, 8, dt);
        most = Math.max(most, x);
      }
      expect(x).toBeCloseTo(10, 3);
      expect(most).toBeLessThanOrEqual(10 + 1e-9);
    }
  });

  it('starts slowly: a new goal is eased in, not jumped at', () => {
    const [x] = springStep(0, 0, 10, 8, 1 / 60);
    expect(x).toBeLessThan(0.2);
  });
});

describe('cameraDt', () => {
  it('gives the camera real time at a steady 30, 60 or 144 Hz, and only a short step for a late frame', () => {
    for (const hz of [24, 30, 60, 120, 144]) expect(cameraDt(1 / hz, 1 / hz)).toBeCloseTo(1 / hz, 9);
    // a frame three times late at 60 Hz: the camera moves as if 1.5 frames went by, not 3
    expect(cameraDt(0.05, 1 / 60)).toBeCloseTo(1 / 40, 9);
    expect(cameraDt(0.05, 1 / 144)).toBeCloseTo(1 / 50, 9);
  });
});
