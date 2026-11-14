import { describe, expect, it } from 'vitest';
import { DECORATION_IDS, PLACE_IDS, TOWN_WORLD, worldTrees } from '../../../data/townWorld';
import { paletteFor, parseHex } from './palette';
import { buildScene, fireflySpots, sceneKey, sortByDepth } from './scene';

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

  it('holds every place (house or lot), every tree, the fountain and the bus from the start', () => {
    const start = buildScene(TOWN_WORLD, { built: ['square', 'cafe', 'friend'], decorations: [] });
    // 13 places + trees + fountain + bus + the café's parasol
    expect(start).toHaveLength(13 + worldTrees().length + 3);
    for (let i = 1; i < start.length; i++) expect(start[i].depth).toBeGreaterThanOrEqual(start[i - 1].depth);
    // no café, no parasol
    expect(buildScene(TOWN_WORLD, { built: [], decorations: [] })).toHaveLength(start.length - 1);
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
