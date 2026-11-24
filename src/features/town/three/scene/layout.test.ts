import { describe, expect, it } from 'vitest';
import { DECORATION_IDS, TOWN_WORLD } from '../../../../data/townWorld';
import { fireflySpots, lampArm, lamps, layoutKey, lotState, mapTrees, natureOf, nearestLamps, occupiedTiles, tufts } from './layout';
import { towardViewer } from './coords';
import { windowGlow, lightRig, mixHex } from './palette3d';

const W = TOWN_WORLD;

describe('3D town layout', () => {
  it('tells built lots, lots on offer and nature apart', () => {
    expect(lotState('cafe', { built: ['cafe'] })).toBe('built');
    expect(lotState('cafe', { built: [] })).toBe('site');
    expect(lotState('cafe', { built: [], sites: ['home'] })).toBe('nature');
    expect(lotState('home', { built: [], sites: ['home'] })).toBe('site');
  });

  it('keys the layout by what is built and bought, in any order', () => {
    const a = layoutKey({ built: ['cafe', 'home'], decorations: ['lamps1', 'flowers'], sites: ['shop'] });
    const b = layoutKey({ built: ['home', 'cafe'], decorations: ['flowers', 'lamps1'], sites: ['shop'] });
    expect(a).toBe(b);
    expect(layoutKey({ built: ['home'], decorations: [] })).not.toBe(layoutKey({ built: ['home'], decorations: [], sites: [] }));
    expect(layoutKey({ built: [], decorations: [], extraDecor: ['proj-garden'] })).not.toBe(layoutKey({ built: [], decorations: [] }));
  });

  it('plants a tree for every tree of the map, near its tile', () => {
    const trees = mapTrees(W);
    const count = W.rows.reduce((n, r) => n + [...r].filter((c) => c === 'T' || c === 't' || c === 'p').length, 0);
    expect(trees).toHaveLength(count);
    for (const t of trees) {
      const ch = W.rows[Math.floor(t.z)][Math.floor(t.x)];
      expect(ch === 'T' || ch === 't' || ch === 'p').toBe(true);
      expect(t.scale).toBeGreaterThan(0.6);
    }
  });

  it('leaves a lot not on offer to nature, the same every time and inside its lot', () => {
    for (const p of W.places) {
      const a = natureOf(p);
      expect(natureOf(p)).toEqual(a);
      expect(a.trees.length).toBeGreaterThan(0);
      for (const t of a.trees) {
        expect(t.x).toBeGreaterThan(p.x);
        expect(t.x).toBeLessThan(p.x + p.w);
        expect(t.z).toBeGreaterThan(p.y);
        expect(t.z).toBeLessThan(p.y + p.d);
      }
    }
  });

  it('puts tufts and flowers only on free grass', () => {
    const busy = occupiedTiles(W);
    const list = tufts(W);
    expect(list.length).toBeGreaterThan(50);
    for (const t of list) {
      const x = Math.floor(t.x);
      const y = Math.floor(t.z);
      expect(W.rows[y][x]).toBe('.');
      expect(busy.has(`${x},${y}`)).toBe(false);
    }
  });

  it('lights the lamps that are bought, and the fixed lanterns', () => {
    const none = lamps(W, { built: [], decorations: [] });
    const all = lamps(W, { built: [], decorations: [...DECORATION_IDS] });
    const street = (W.decorations.lamps1?.length ?? 0) + (W.decorations.lamps2?.length ?? 0);
    expect(all.length).toBeGreaterThanOrEqual(none.length + street);
    for (const l of all) {
      expect(l.k).toBeGreaterThan(0);
      expect(l.y).toBeGreaterThan(0);
    }
    const near = nearestLamps(all, 10, 10, 3);
    expect(near.length).toBe(Math.min(3, all.length));
  });

  it('reaches a street lamp over its path, mirrored the other way', () => {
    const a = lampArm(false);
    const b = lampArm(true);
    expect(a.x).toBeCloseTo(-b.x);
    expect(a.y).toBeCloseTo(-b.y);
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(1);
  });

  it('lets fireflies drift over grass', () => {
    for (const f of fireflySpots(W)) expect(W.rows[Math.floor(f.z)][Math.floor(f.x)]).toBe('.');
  });

  it('turns somebody towards the viewer by at most 40°', () => {
    expect(towardViewer(0, 0.3)).toBeCloseTo(0.3);
    expect(towardViewer(0, 2)).toBeCloseTo(0.7);
    expect(towardViewer(0, -2)).toBeCloseTo(-0.7);
  });

  it('blends the light rig from day to night', () => {
    expect(lightRig(0).lamps).toBe(0);
    expect(lightRig(1).lamps).toBe(1);
    expect(lightRig(0.5).sun).toBeLessThan(lightRig(0).sun);
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(windowGlow(0)).toBeGreaterThan(0);
    expect(windowGlow(1)).toBe(1);
  });
});
