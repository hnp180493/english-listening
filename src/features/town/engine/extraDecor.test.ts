import { describe, expect, it } from 'vitest';
import { TOWN_PROJECTS } from '../../../data/townGame';
import { TOWN_WORLD } from '../../../data/townWorld';
import { EXTRA_DECOR } from './extraDecor';

describe('town projects in the world', () => {
  it('has a place for every project decoration, inside the world', () => {
    for (const p of TOWN_PROJECTS) {
      const spots = EXTRA_DECOR[p.decoration];
      expect(spots?.length, p.decoration).toBeGreaterThan(0);
      for (const s of spots!) {
        expect(s.at.x).toBeGreaterThan(0);
        expect(s.at.y).toBeGreaterThan(0);
        expect(s.at.x).toBeLessThan(TOWN_WORLD.size);
        expect(s.at.y).toBeLessThan(TOWN_WORLD.size);
      }
    }
  });
});
