// The ground's paving never covers a foot (owner, 2026-11-27: "cái nền gạch nó ăn mất chân rồi kìa"): people, pets
// and vehicles stand at the ground's own height, so what is laid on it stays under an avatar's shoe.
import { describe, expect, it } from 'vitest';
import { cobbleRise, CURB_H, PAVING_TOP } from './terrain';

/** About the height of an avatar's shoe at the size they are drawn (chars/vrmBody.ts TALLER 0.8: 0.62 tiles tall). */
const SHOE = 0.025;

describe('paving under the feet', () => {
  it('slabs and path stones stand lower than a shoe', () => {
    expect(PAVING_TOP).toBeLessThan(SHOE * 0.6);
    for (let i = 0; i < 6; i++) expect((0.055 * cobbleRise(i)) / 2).toBeLessThanOrEqual(PAVING_TOP + 1e-9);
  });
  it("the plaza's curb too", () => {
    expect(CURB_H - 0.004).toBeLessThan(SHOE);
  });
});
