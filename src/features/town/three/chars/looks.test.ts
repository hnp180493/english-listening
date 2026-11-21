import { describe, expect, it } from 'vitest';
import { TOWN_PLACES } from '../../../../data/town';
import { LOOT } from '../../../../data/townGame';
import { castLook, extraColor, HAT_IDS, hasExtra, isCastId, KNOWN_EXTRAS, passerLook, PET_IDS, RESIDENT_IDS } from './looks';
import { HAT_FIT } from './hair';

const HEX = /^#[0-9a-f]{6}$/i;
const CAST = ['player', ...RESIDENT_IDS];

describe('cast looks', () => {
  it('has the player and every resident of data/town', () => {
    expect([...RESIDENT_IDS].sort()).toEqual(TOWN_PLACES.map((p) => p.id).sort());
    for (const id of CAST) expect(isCastId(id), id).toBe(true);
  });

  it('uses valid colours and known extras only', () => {
    for (const id of CAST) {
      const l = castLook(id);
      for (const c of [l.skin, l.hair.color, l.top, l.bottom, l.shoes]) expect(c, id).toMatch(HEX);
      for (const e of l.extras ?? []) {
        const [name, color] = e.split(':');
        expect(KNOWN_EXTRAS as readonly string[], `${id}: ${e}`).toContain(name);
        if (color !== undefined) expect(color, `${id}: ${e}`).toMatch(HEX);
      }
      expect(HAT_FIT[l.hair.style], id).toBeDefined();
    }
  });

  it('makes everybody recognisable at a glance (hair + top differ)', () => {
    const keys = CAST.map((id) => {
      const l = castLook(id);
      return `${l.hair.style}|${l.hair.color}|${l.top}`;
    });
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives the brief its signature details', () => {
    expect(castLook('home').hair.color).toMatch(HEX);
    expect(hasExtra(castLook('home'), 'glasses')).toBe(true);
    expect(castLook('shop').hair.style).toBe('bald');
    expect(hasExtra(castLook('shop'), 'beard')).toBe(true);
    expect(hasExtra(castLook('shop'), 'apron')).toBe(true);
    expect(hasExtra(castLook('school'), 'glasses')).toBe(true);
    expect(hasExtra(castLook('station'), 'cap')).toBe(true);
    expect(hasExtra(castLook('clinic'), 'coat')).toBe(true);
    expect(hasExtra(castLook('board'), 'sunglasses')).toBe(true);
    expect(hasExtra(castLook('phone'), 'logo')).toBe(true);
    expect(extraColor(castLook('cafe'), 'apron', '#000000')).toBe('#86bda5');
    expect(extraColor(castLook('square'), 'apron', '#000000')).toBe('#000000');
  });
});

describe('passers-by', () => {
  it('are seeded: the same seed gives the same look', () => {
    expect(passerLook(7)).toEqual(passerLook(7));
    expect(passerLook(7, true)).toEqual(passerLook(7, true));
    const looks = Array.from({ length: 40 }, (_, i) => JSON.stringify(passerLook(i)));
    expect(new Set(looks).size).toBeGreaterThan(30);
  });

  it('children are 0.75 the size; adults about 1', () => {
    for (let i = 0; i < 30; i++) {
      expect(passerLook(i, true).scale).toBe(0.75);
      const s = passerLook(i).scale ?? 1;
      expect(s).toBeGreaterThan(0.9);
      expect(s).toBeLessThan(1.1);
      for (const e of passerLook(i).extras ?? []) expect(KNOWN_EXTRAS as readonly string[]).toContain(e.split(':')[0]);
    }
  });

  it('an unknown id gets a passer-by look', () => {
    expect(castLook('folk3')).toEqual(castLook('folk3'));
    expect(isCastId('folk3')).toBe(false);
  });
});

describe('loot coverage', () => {
  it('every loot hat and pet of data/townGame has a builder', () => {
    const hats = LOOT.filter((l) => l.kind === 'hat').map((l) => l.id);
    const pets = LOOT.filter((l) => l.kind === 'pet').map((l) => l.id);
    expect([...HAT_IDS].sort()).toEqual([...hats].sort());
    expect(PET_IDS.filter((p) => p !== 'cat').sort()).toEqual([...pets].sort());
  });
});
