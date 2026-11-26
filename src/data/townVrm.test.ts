import { describe, expect, it } from 'vitest';
import { TOWN_PLACES } from './town';
import { VRM_FILES, VRM_IDS, VRM_VERSION, vrmFor, vrmOf } from './townVrm';

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
});
