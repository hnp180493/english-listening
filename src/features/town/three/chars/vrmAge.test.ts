// Where a beard grows on a VRoid face's texture (./vrmAge.ts beardAt): never over the lips or above the nose, a
// moustache only over the lip, a goatee not on the cheeks, a short beard along the jaw.
import { describe, expect, it } from 'vitest';
import { beardAt, FACE_UV } from './vrmAge';

describe('a beard on the face texture', () => {
  const kinds = ['moustache', 'goatee', 'short', 'full'] as const;
  it('never on the lips, the eyes, the nose or the forehead', () => {
    for (const k of kinds) {
      expect(beardAt(k, FACE_UV.mouth.u, FACE_UV.mouth.v), k).toBe(0);
      expect(beardAt(k, FACE_UV.mouth.u + 0.06, FACE_UV.mouth.v), k).toBe(0);
      expect(beardAt(k, FACE_UV.eyeL.u, FACE_UV.eyeL.v), k).toBe(0);
      expect(beardAt(k, FACE_UV.nose.u, FACE_UV.nose.v), k).toBe(0);
      expect(beardAt(k, 0.5, 0.38), k).toBe(0);
    }
  });
  it('each kind where it grows', () => {
    // over the lip
    for (const k of kinds) expect(beardAt(k, 0.5, 0.72), k).toBeGreaterThan(0);
    // the chin
    expect(beardAt('moustache', 0.5, 0.82)).toBe(0);
    for (const k of ['goatee', 'short', 'full'] as const) expect(beardAt(k, 0.5, 0.82), k).toBeGreaterThan(0.5);
    // the jaw's side
    expect(beardAt('goatee', 0.24, 0.78)).toBe(0);
    for (const k of ['short', 'full'] as const) expect(beardAt(k, 0.24, 0.78), k).toBeGreaterThan(0);
    // thin at the edge
    expect(beardAt('short', 0.5, 0.69)).toBeLessThan(beardAt('short', 0.5, 0.71));
  });
});
