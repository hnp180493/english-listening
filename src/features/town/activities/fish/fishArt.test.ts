import { describe, expect, it } from 'vitest';
import { RARITIES } from '../../../../data/townGame';
import { ART_SPECIES, fishShape, POND_ART, TIER_ART } from './fishArt';

describe('pond art', () => {
  it('every colour is a light-dark() pair (day and night)', () => {
    const all = [...Object.values(POND_ART), ...RARITIES.flatMap((r) => [TIER_ART[r].body, TIER_ART[r].belly, TIER_ART[r].fin, TIER_ART[r].shadow])];
    for (const c of all) expect(c).toMatch(/^light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
  });

  it('a rarer fish is bigger (its shadow hints the tier before it bites)', () => {
    const scales = RARITIES.map((r) => TIER_ART[r].scale);
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeGreaterThan(scales[i - 1]);
  });

  it('every species has a stable look, and they do not all look alike', () => {
    const looks = new Set<string>();
    for (const s of ART_SPECIES) {
      const a = fishShape(s);
      expect(fishShape(s)).toEqual(a);
      expect(a.stretch).toBeGreaterThan(1.5);
      looks.add(JSON.stringify(a) + s.tier);
    }
    expect(looks.size).toBeGreaterThan(12);
  });
});
