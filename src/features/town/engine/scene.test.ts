import { describe, expect, it } from 'vitest';
import { DECORATION_IDS, PLACE_IDS, TOWN_WORLD, worldTrees } from '../../../data/townWorld';
import { paletteFor, parseHex } from './palette';
import { lotNature } from '../art/world';
import { WORLD_ART } from '../art/world.data';
import { buildScene, fireflySpots, lampLights, sceneKey, sortByDepth, windowGlow } from './scene';
import { thumbKey } from './thumb';

describe('scene', () => {
  it('sorts far to near and keeps the order of equals', () => {
    const list = [
      { depth: 3, n: 'a' },
      { depth: 1, n: 'b' },
      { depth: 3, n: 'c' },
      { depth: 2, n: 'd' },
    ];
    expect(sortByDepth(list).map((e) => e.n)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('the key changes only with what is built or bought, whatever the order', () => {
    const a = sceneKey({ built: ['cafe', 'square'], decorations: ['lamps1', 'cat'] });
    expect(sceneKey({ built: ['square', 'cafe'], decorations: ['cat', 'lamps1'] })).toBe(a);
    expect(sceneKey({ built: ['square', 'cafe', 'home'], decorations: ['cat', 'lamps1'] })).not.toBe(a);
    expect(sceneKey({ built: ['square', 'cafe'], decorations: ['cat'] })).not.toBe(a);
  });

  it('holds every place (house or lot), every tree and the fountain from the start; the bus comes with the bus stop', () => {
    const start = buildScene(TOWN_WORLD, { built: ['square', 'cafe', 'friend'], decorations: [] });
    // 13 places + trees + fountain + the café's parasol
    expect(start).toHaveLength(13 + worldTrees().length + 2);
    for (let i = 1; i < start.length; i++) expect(start[i].depth).toBeGreaterThanOrEqual(start[i - 1].depth);
    // no café, no parasol
    expect(buildScene(TOWN_WORLD, { built: [], decorations: [] })).toHaveLength(start.length - 1);
    // the bus pulls in with the bus stop
    expect(buildScene(TOWN_WORLD, { built: ['square', 'cafe', 'friend', 'station'], decorations: [] })).toHaveLength(start.length + 1);
  });

  it('every standing thing knows where its picture is (so it can fade over a person behind it)', () => {
    const all = buildScene(TOWN_WORLD, { built: PLACE_IDS, decorations: DECORATION_IDS });
    for (const d of all) {
      expect(d.box).toBeDefined();
      expect(d.box!.w).toBeGreaterThan(0);
      expect(d.box!.h).toBeGreaterThan(0);
    }
  });

  it('lamp light falls only where a lamp was bought, under the bulb at the end of its arm', () => {
    expect(lampLights(TOWN_WORLD, { built: PLACE_IDS, decorations: [] })).toEqual([]);
    const lamps = lampLights(TOWN_WORLD, { built: PLACE_IDS, decorations: ['lamps1'] });
    expect(lamps).toHaveLength(TOWN_WORLD.decorations.lamps1.length);
    TOWN_WORLD.decorations.lamps1.forEach((s, i) => {
      const pole = (s.x + 0.5 - (s.y + 0.5)) * 32;
      // the arm reaches right on the screen, or left when the lamp is mirrored
      expect(Math.sign(lamps[i].x - pole)).toBe(s.flip ? -1 : 1);
    });
    expect(lampLights(TOWN_WORLD, { built: PLACE_IDS, decorations: ['lamps1', 'lamps2', 'stall', 'lights'] })).toHaveLength(4 + 6 + 1 + 1);
  });

  it('every bought decoration that stands somewhere adds its spots', () => {
    const start = buildScene(TOWN_WORLD, { built: PLACE_IDS, decorations: [] }).length;
    const standing = ['lamps1', 'lamps2', 'flowers', 'benches', 'blossom', 'lights', 'stall', 'balloons', 'flags'] as const;
    for (const id of standing) {
      const n = buildScene(TOWN_WORLD, { built: PLACE_IDS, decorations: [id] }).length;
      expect(n - start, id).toBe(TOWN_WORLD.decorations[id].length);
    }
    // drawn elsewhere: on the water, as an actor, or as the fountain itself
    for (const id of ['lilies', 'cat', 'fountain'] as const) {
      expect(buildScene(TOWN_WORLD, { built: PLACE_IDS, decorations: [id] }).length, id).toBe(start);
    }
    expect(buildScene(TOWN_WORLD, { built: PLACE_IDS, decorations: DECORATION_IDS }).length).toBeGreaterThan(start + 25);
  });

  it('fireflies keep to the grass, the same spots every time', () => {
    const spots = fireflySpots(TOWN_WORLD, 20);
    expect(spots).toHaveLength(20);
    expect(fireflySpots(TOWN_WORLD, 20)).toEqual(spots);
    for (const s of spots) expect(TOWN_WORLD.rows[Math.floor(s.y)][Math.floor(s.x)]).toBe('.');
  });
});

describe('palette', () => {
  const rgb = (css: string) => css.match(/\d+/g)!.map(Number);

  it('day shows an art colour as it is; night sinks it into dusk blue', () => {
    const day = paletteFor('day');
    const night = paletteFor('night');
    expect(day.night).toBe(false);
    expect(night.night).toBe(true);
    expect(rgb(day.ink('#9ad27a'))).toEqual([...parseHex('#9ad27a')]);
    const [r, g, b] = rgb(night.ink('#ffffff'));
    expect(b).toBeGreaterThan(r);
    expect(r + g + b).toBeLessThan(255 * 3 * 0.8);
    // every art colour gets darker at night
    for (const hex of ['#fbf1dc', '#3fb7a6', '#f58fb0', '#9ad27a', '#eedcb0']) {
      const d = rgb(day.ink(hex));
      const n = rgb(night.ink(hex));
      expect(n[0] + n[1] + n[2], hex).toBeLessThan(d[0] + d[1] + d[2]);
    }
  });

  it('shading keeps the order: lighter > plain > darker', () => {
    const p = paletteFor('day');
    const sum = (css: string) => rgb(css).reduce((a, b) => a + b, 0);
    expect(sum(p.ink('#8f73d6', 0.3))).toBeGreaterThan(sum(p.ink('#8f73d6')));
    expect(sum(p.ink('#8f73d6', -0.3))).toBeLessThan(sum(p.ink('#8f73d6')));
    // the same question gives the same string (cached)
    expect(p.ink('#8f73d6', -0.3)).toBe(p.ink('#8f73d6', -0.3));
  });
});

describe('lots on offer and the rest', () => {
  it('a lot not on offer is a few things of nature, a lot on offer one construction site', () => {
    const built = ['square', 'cafe', 'friend'];
    const all = buildScene(TOWN_WORLD, { built, decorations: [] });
    const offer = buildScene(TOWN_WORLD, { built, decorations: [], sites: ['home', 'shop', 'office'] });
    const others = TOWN_WORLD.places.filter((p) => !built.includes(p.id) && !['home', 'shop', 'office'].includes(p.id));
    const nature = others.reduce((n, p) => n + lotNature(p).length, 0);
    expect(offer.length).toBe(all.length - others.length + nature);
    for (let i = 1; i < offer.length; i++) expect(offer[i].depth).toBeGreaterThanOrEqual(offer[i - 1].depth);
    // the key follows what is on offer
    expect(sceneKey({ built, decorations: [], sites: ['home'] })).not.toBe(sceneKey({ built, decorations: [], sites: ['shop'] }));
    expect(sceneKey({ built, decorations: [], sites: ['shop', 'home'] })).toBe(sceneKey({ built, decorations: [], sites: ['home', 'shop'] }));
  });

  it('windows glow a little from the first day and fully when every line is understood', () => {
    expect(windowGlow(0)).toBeGreaterThan(0);
    expect(windowGlow(0)).toBeLessThan(windowGlow(0.5));
    expect(windowGlow(1)).toBe(1);
    expect(windowGlow(7)).toBe(1);
    expect(windowGlow(-1)).toBe(windowGlow(0));
  });
});

describe('build panel pictures', () => {
  it('every place and every decoration has a sprite, and nothing else does', () => {
    for (const id of [...PLACE_IDS, ...DECORATION_IDS]) {
      const key = thumbKey(id);
      expect(key, id).not.toBeNull();
      expect(WORLD_ART.sprites[key!], id).toBeDefined();
    }
    expect(thumbKey('nope')).toBeNull();
  });
});
