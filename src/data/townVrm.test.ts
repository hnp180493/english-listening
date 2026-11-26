import { describe, expect, it } from 'vitest';
import { TOWN_PLACES } from './town';
import { COAT_WHITE, faceOf, FACES, VRM_FILES, VRM_IDS, VRM_VERSION, vrmFor, vrmOf } from './townVrm';

/** The avatar files there are (their paths only: nothing is read). */
const FILES = Object.keys(import.meta.glob('/public/vrm/*.vrm'));

const look = (style: string, extras: string[] = [], scale?: number) => ({ skin: '#8e5c3e', hair: { style, color: '#2a2224' }, top: '#f3a6a0', bottom: '#4f5d82', extras, scale });

describe('who has which VRoid avatar', () => {
  it('a file of their own: only residents of the town, never the player', () => {
    const places = TOWN_PLACES.map((p) => p.id);
    for (const id of VRM_IDS) expect(places).toContain(id);
    expect(vrmOf('player', '/app/')).toBeNull();
    expect(vrmOf('constructor', '/app/')).toBeNull();
  });

  it('the address is under the app’s base path and carries the version', () => {
    expect(vrmOf('cafe', '/english-listening/')?.url).toBe(`/english-listening/vrm/cafe.vrm?v=${VRM_VERSION}`);
    expect(vrmFor('cafe', look('short'), '/x/').url).toBe(`/x/vrm/cafe.vrm?v=${VRM_VERSION}`);
  });

  it('anybody else: a tintable base picked by the look, in the look’s colours', () => {
    expect(vrmFor('player', look('long'), '/').url).toContain('base-f-long');
    expect(vrmFor('p1', look('ponytail'), '/').url).toContain('base-f-tail');
    expect(vrmFor('p2', look('short', ['lashes']), '/').url).toMatch(/base-f-/);
    expect(vrmFor('p3', look('spiky'), '/').url).toContain('base-m-hoodie');
    expect(vrmFor('p4', look('short', ['collar', 'tie:#7b3f4f']), '/').url).toContain('base-m-shirt');
    // a beard is a man's whatever the hair or the clothes (Jonah's long hair, Theo's dungarees)
    expect(vrmFor('p8', look('long', ['beard']), '/').url).toMatch(/base-m-/);
    expect(vrmFor('p9', look('short', ['dungarees', 'beard']), '/').url).toMatch(/base-m-/);
    expect(vrmFor('jonah', look('long'), '/').url).toMatch(/base-m-/);
    const bald = vrmFor('p5', look('bald', ['beard']), '/');
    expect(bald.url).toContain('base-m-jacket');
    expect(bald.bald).toBe(true);
    expect(vrmFor('p6', look('short'), '/').tint).toEqual({ skin: '#8e5c3e', hair: '#2a2224', top: '#f3a6a0', bottom: '#4f5d82' });
    // the same person always gets the same base
    expect(vrmFor('p7', look('short'), '/').url).toBe(vrmFor('p7', look('short'), '/').url);
  });

  it('a child stands lower; glasses and a cap carry over', () => {
    const kid = vrmFor('k', look('pigtails', [], 0.75), '/');
    expect(kid.tall).toBeLessThan(0.75);
    expect(vrmFor('g', look('short', ['glasses', 'cap']), '/').extras).toEqual(['glasses', 'cap:#f3a6a0']);
  });

  it('every file that is named exists, and no file is left without a use', () => {
    expect(FILES.map((f) => f.replace(/^.*\/([^/]+)\.vrm$/, '$1')).sort()).toEqual([...VRM_FILES].sort());
  });

  it('older faces and beards: as the portraits have them, explicit for residents and the people listed', () => {
    expect(vrmOf('home', '/')?.face).toEqual({ age: 'old' });
    expect(vrmOf('shop', '/')?.face?.beard).toBe('short');
    // the young residents have a young face
    for (const id of VRM_IDS.filter((x) => x !== 'home' && x !== 'shop')) expect(vrmOf(id, '/')?.face, id).toBeUndefined();
    const osei = vrmFor('osei', look('short', ['coat', 'stethoscope', 'beard']), '/');
    expect(osei.face).toEqual({ age: 'old', beard: 'goatee', beardColor: '#dedcd6' });
    // his white coat: the top turns white
    expect(osei.tint?.top).toBe(COAT_WHITE);
    // white hair on a young face stays young
    expect(vrmFor('iris', { ...look('bob'), hair: { style: 'bob', color: '#e6e6ea' } }, '/').face).toBeUndefined();
    // every listed face says something, or is empty on purpose (a young face)
    for (const [id, f] of Object.entries(FACES)) if (f.beard && f.beard !== 'stubble') expect(f.beardColor, id).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('anybody else: a beard of the look is a short one in the hair colour, grey hair an older face, a child never', () => {
    expect(faceOf('p1', look('bald', ['beard']))).toEqual({ beard: 'short', beardColor: '#2a2224' });
    expect(faceOf('p2', { ...look('short'), hair: { style: 'short', color: '#c9c4bd' } })).toEqual({ age: 'older' });
    expect(faceOf('p3', look('short'))).toBeNull();
    expect(faceOf('k', { ...look('short', ['beard'], 0.75), hair: { style: 'short', color: '#c9c4bd' } })).toBeNull();
    // a bald head's grey is no older face (passers-by: the bald ones' hair colour is a fringe)
    expect(faceOf('p4', { ...look('bald'), hair: { style: 'bald', color: '#c9c4bd' } })).toBeNull();
    expect(vrmFor('p5', look('short'), '/').face).toBeUndefined();
  });
});
