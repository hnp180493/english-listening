// Geometry builders in node: every cast member, hat and pet builds, skins to valid bones and stays in budget.
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { castLook, HAT_IDS, passerLook, PET_IDS, RESIDENT_IDS } from './looks';
import { createPerson } from './person';
import { createPet, PetBrain, petPhaseAdvance, PET_SPECS } from './pets';
import { hatGeometry } from './hats';
import { BONE_COUNT } from './body';
import { eyeRect, EYE_STATES, faceGeometry, MOUTH_STATES, mouthRect } from './face';
import { hairline } from './hair';

const CAST = ['player', ...RESIDENT_IDS];

describe('people', () => {
  it('every cast member builds one skinned mesh within budget, skinned to real bones', () => {
    for (const id of CAST) {
      const c = createPerson(id);
      let skinned = 0;
      c.root.traverse((o) => {
        const m = o as unknown as { isSkinnedMesh?: boolean; geometry?: { getAttribute(n: string): { count: number; array: ArrayLike<number> } } };
        if (!m.isSkinnedMesh || !m.geometry) return;
        skinned++;
        const pos = m.geometry.getAttribute('position');
        expect(pos.count, id).toBeLessThan(16000);
        const si = m.geometry.getAttribute('skinIndex').array;
        for (let i = 0; i < si.length; i++) expect(si[i]).toBeLessThan(BONE_COUNT);
      });
      expect(skinned, id).toBe(1);
      c.update(1 / 60, 0);
      const top = c.headTop(new Vector3());
      // about 0.75 tile tall (× scale)
      const s = castLook(id).scale ?? 1;
      expect(top.y / s, id).toBeGreaterThan(0.7);
      expect(top.y / s, id).toBeLessThan(0.8);
      c.dispose();
    }
  });

  it('every hat fits, raises the head top, and comes off again', () => {
    const c = createPerson('player');
    c.update(1 / 60, 0);
    const bare = c.headTop(new Vector3()).y;
    for (const h of HAT_IDS) {
      expect(hatGeometry(h), h).not.toBeNull();
      c.setHat(h);
      c.update(1 / 60, 0);
      expect(c.headTop(new Vector3()).y, h).toBeGreaterThanOrEqual(bare - 0.003);
    }
    c.setHat(null);
    c.update(1 / 60, 0);
    expect(c.headTop(new Vector3()).y).toBeCloseTo(bare, 2);
    expect(hatGeometry('no-such-hat')).toBeNull();
    c.dispose();
  });

  it('an outfit recolours the top and can be taken off', () => {
    const c = createPerson('player');
    let colors: Float32Array | null = null;
    c.root.traverse((o) => {
      const m = o as unknown as { isSkinnedMesh?: boolean; geometry?: { getAttribute(n: string): { array: Float32Array } } };
      if (m.isSkinnedMesh && m.geometry) colors = m.geometry.getAttribute('color').array;
    });
    const before = Float32Array.from(colors as unknown as Float32Array);
    c.setOutfit('#c8473d');
    expect(Array.from(colors as unknown as Float32Array)).not.toEqual(Array.from(before));
    c.setOutfit(null);
    const after = colors as unknown as Float32Array;
    for (let i = 0; i < before.length; i++) expect(after[i]).toBeCloseTo(before[i], 5);
    c.dispose();
  });

  it('every action runs on a passer-by and a child without NaN', () => {
    for (const child of [false, true]) {
      const c = createPerson('folk', passerLook(5, child));
      for (const a of ['idle', 'walk', 'run', 'sit', 'wave', 'yes', 'no', 'talk', 'drink', 'water', 'fish', 'read', 'cheer'] as const) {
        c.setAction(a);
        for (let i = 0; i < 40; i++) c.update(1 / 30, a === 'walk' ? 1 : a === 'run' ? 2.5 : 0);
        const p = c.headTop(new Vector3());
        expect(Number.isFinite(p.x + p.y + p.z), a).toBe(true);
      }
      c.dispose();
    }
  });
});

describe('faces', () => {
  it('every eye and mouth state has its own cell inside the atlas', () => {
    const seen = new Set<string>();
    for (let style = 0; style < 4; style++) {
      for (const e of EYE_STATES) {
        const r = eyeRect(style, e);
        for (const v of [r.u0, r.u1, r.v0, r.v1]) expect(v).toBeGreaterThanOrEqual(0);
        for (const v of [r.u0, r.u1, r.v0, r.v1]) expect(v).toBeLessThanOrEqual(1);
        seen.add(JSON.stringify(r));
      }
    }
    for (const m of MOUTH_STATES) seen.add(JSON.stringify(mouthRect(m)));
    expect(seen.size).toBe(4 * EYE_STATES.length + MOUTH_STATES.length);
  });

  it('changing the expression rewrites the UVs', () => {
    const f = faceGeometry(0.2, [1, 1, 1], 0);
    const uv = f.geometry.getAttribute('uv');
    const a = Array.from(uv.array as Float32Array);
    f.set('closed', 'talkO');
    expect(Array.from(uv.array as Float32Array)).not.toEqual(a);
    f.set('open', 'smile');
    expect(Array.from(uv.array as Float32Array)).toEqual(a);
  });

  it('fringes sit above the eyes and napes below the ears', () => {
    for (const style of ['short', 'bob', 'long', 'ponytail', 'bun', 'pigtails', 'curly', 'spiky'] as const) {
      for (let phi = -0.5; phi <= 0.5; phi += 0.1) expect(hairline(style, phi), style).toBeLessThan(1.5);
      expect(hairline(style, Math.PI), style).toBeGreaterThan(1.9);
    }
  });
});

describe('pets', () => {
  it('every pet builds, walks and idles', () => {
    for (const id of PET_IDS) {
      const p = createPet(id);
      p.setHeading(1, true);
      for (let i = 0; i < 120; i++) p.update(1 / 60, i < 60 ? 0.8 : 0);
      p.dispose();
      expect(PET_SPECS[id], id).toBeDefined();
    }
  });

  it('pet gaits are driven by distance', () => {
    expect(petPhaseAdvance(0, PET_SPECS.tho.stride, 'tho')).toBeCloseTo(Math.PI * 2);
    const b = new PetBrain('cho-con', 1);
    for (let i = 0; i < 60; i++) b.update(1 / 60, 0.6);
    expect(b.phase).toBeCloseTo((Math.PI * 2 * 0.6) / PET_SPECS['cho-con'].stride, 3);
  });

  it('a dog sits down after standing a while and gets up to walk', () => {
    const b = new PetBrain('cho-con', 2);
    for (let i = 0; i < 60 * 12; i++) b.update(1 / 60, 0);
    expect(b.sit).toBeGreaterThan(0.9);
    for (let i = 0; i < 30; i++) b.update(1 / 60, 1);
    expect(b.sit).toBeLessThan(0.1);
  });
});
