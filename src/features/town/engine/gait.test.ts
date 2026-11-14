import { describe, expect, it } from 'vitest';
import { CHARACTER_ART } from '../art/characters.data';
import { walkDrop } from './gait';

describe('walkDrop', () => {
  const lift = CHARACTER_ART.gaits[CHARACTER_ART.chars.player.gait].lift;

  it('draws the walk on the idle ground line at a stand and as rendered at full pace', () => {
    expect(lift).toBeGreaterThan(0);
    expect(walkDrop('player', 0, 2.2)).toBeCloseTo(lift, 9);
    expect(walkDrop('player', 2.2, 2.2)).toBe(0);
    // faster than full pace (never) or a bad speed: no more than the lift, never negative
    expect(walkDrop('player', 5, 2.2)).toBe(0);
    expect(walkDrop('player', 1, 0)).toBeCloseTo(lift, 9);
  });

  it('comes down smoothly as a walk slows (no step of more than a few hundredths of a pixel per 1% of pace)', () => {
    let last = walkDrop('player', 0, 1);
    for (let k = 1; k <= 100; k++) {
      const d = walkDrop('player', k / 100, 1);
      expect(d).toBeLessThanOrEqual(last + 1e-12);
      expect(last - d).toBeLessThan(lift * 0.02);
      last = d;
    }
  });
});
