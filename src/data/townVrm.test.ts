import { describe, expect, it } from 'vitest';
import { TOWN_PLACES } from './town';
import { anyVrm, VRM_IDS, VRM_VERSION, vrmOf } from './townVrm';

/** The avatar files there are (their paths only: nothing is read). */
const FILES = Object.keys(import.meta.glob('/public/vrm/*.vrm'));

describe('who has a VRoid avatar', () => {
  it('only residents of the town have one, and never the player', () => {
    const places = TOWN_PLACES.map((p) => p.id);
    for (const id of VRM_IDS) expect(places).toContain(id);
    expect(vrmOf('player', '/app/')).toBeNull();
    expect(vrmOf('constructor', '/app/')).toBeNull();
    expect(anyVrm()).toBe(VRM_IDS.length > 0);
  });

  it('the address is under the app’s base path', () => {
    expect(vrmOf('cafe', '/english-listening/')?.url).toBe(`/english-listening/vrm/cafe.vrm?v=${VRM_VERSION}`);
  });

  it('every listed resident has a file, and no file is left without its resident', () => {
    expect(FILES.map((f) => f.replace(/^.*\/([^/]+)\.vrm$/, '$1')).sort()).toEqual([...VRM_IDS].sort());
  });
});
