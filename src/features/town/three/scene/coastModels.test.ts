// The coast's models (lighthouse, hut, umbrella, boulder, boat, jetty) and the palm build without a browser, finite
// and inside the sizes their colliders / tiles promise.

import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { TOWN_WORLD, type SceneryKind, type TownWorld, type WorldScenery } from '../../../../data/townWorld';
import { SCENERY_SIZE } from '../../../../core/town/colliders';
import { buildScenery, type Piece } from './props3d';
import { treeGeometry } from './nature';
import { WATER_LEVEL } from './terrain';

const block = (x: number, y: number) => [
  { x, y },
  { x: x + 1, y },
  { x, y: y + 1 },
  { x: x + 1, y: y + 1 },
];

const scenery: WorldScenery[] = [
  { kind: 'lighthouse', tiles: block(10, 10) },
  { kind: 'hut', tiles: block(14, 10) },
  { kind: 'umbrella', tiles: [{ x: 18, y: 10 }] },
  { kind: 'boulder', tiles: block(20, 10) },
  { kind: 'boat', tiles: [], at: { x: 24.5, y: 10.5 }, dir: 'y' },
  { kind: 'jetty', tiles: [], at: { x: 26, y: 10.5 }, dir: 'x', len: 7 },
  { kind: 'jetty', tiles: [], at: { x: 26, y: 14.5 }, dir: 'y', len: 6 },
];

const tris = (g: BufferGeometry | null | undefined) => (g ? g.getAttribute('position').count / 3 : 0);

function check(g: BufferGeometry | null | undefined): void {
  if (!g) return;
  const a = g.getAttribute('position').array;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error('not finite at ' + i);
}

const total = (p: Piece) => tris(p.body) + tris(p.glass) + tris(p.bulbs) + tris(p.sway);

describe('coast models', () => {
  const world = { ...TOWN_WORLD, scenery } as TownWorld;
  const pieces = buildScenery(world);
  const of = (k: SceneryKind) => pieces[scenery.findIndex((s) => s.kind === k)];

  it('every kind gives a piece', () => {
    expect(pieces).toHaveLength(scenery.length);
    for (const p of pieces) {
      check(p.body);
      check(p.glass);
      check(p.bulbs);
      expect(p.body).not.toBeNull();
      expect(total(p)).toBeLessThan(6000);
      expect(p.hx).toBeGreaterThan(0);
      expect(p.hz).toBeGreaterThan(0);
    }
  });

  it('stands in the right place and size', () => {
    const lh = of('lighthouse');
    lh.body!.computeBoundingBox();
    expect(lh.x).toBeCloseTo(11, 5);
    expect(lh.body!.boundingBox!.max.y).toBeGreaterThan(4.2);
    expect(lh.body!.boundingBox!.max.y).toBeLessThan(4.7);
    expect(lh.body!.boundingBox!.max.x).toBeLessThan(0.95);
    // the lamp glows at night
    expect(lh.bulbs).not.toBeNull();
    expect(lh.glass).not.toBeNull();

    const hut = of('hut');
    hut.body!.computeBoundingBox();
    const hb = hut.body!.boundingBox!;
    expect(hb.max.x).toBeLessThanOrEqual(0.9);
    expect(hb.min.x).toBeGreaterThanOrEqual(-0.9);
    expect(hb.max.z).toBeLessThanOrEqual(0.9);
    expect(hut.glass).not.toBeNull();

    const um = of('umbrella');
    um.body!.computeBoundingBox();
    expect(um.body!.boundingBox!.max.y).toBeGreaterThan(1);
    expect(um.hx).toBe(SCENERY_SIZE.umbrella);

    const bo = of('boulder');
    bo.body!.computeBoundingBox();
    expect(bo.body!.boundingBox!.max.y).toBeGreaterThan(1);
    expect(bo.body!.boundingBox!.max.y).toBeLessThan(1.5);
  });

  it('a boat bobs on the water, a jetty runs from its shore end', () => {
    const boat = of('boat');
    expect(boat.bob).toBe(true);
    boat.body!.computeBoundingBox();
    const bb = boat.body!.boundingBox!;
    expect(bb.min.y).toBeLessThan(WATER_LEVEL);
    expect(bb.max.y).toBeGreaterThan(WATER_LEVEL);
    // lying along y: its length (1.3 and a little) is along z
    expect(bb.max.z - bb.min.z).toBeGreaterThan(1.3);

    const jx = pieces[5];
    expect(jx.x).toBeCloseTo(26 + 3.5, 5);
    expect(jx.hx).toBeCloseTo(3.5, 5);
    jx.body!.computeBoundingBox();
    expect(jx.body!.boundingBox!.max.x - jx.body!.boundingBox!.min.x).toBeGreaterThan(6.9);
    expect(jx.body!.boundingBox!.min.y).toBeLessThan(WATER_LEVEL - 0.3);
    const jy = pieces[6];
    expect(jy.z).toBeCloseTo(14.5 + 3, 5);
    jy.body!.computeBoundingBox();
    expect(jy.body!.boundingBox!.max.z - jy.body!.boundingBox!.min.z).toBeGreaterThan(5.9);
  });

  it('builds a palm', () => {
    const g = treeGeometry('palm');
    check(g);
    expect(g.getAttribute('position').count).toBeGreaterThan(0);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeGreaterThan(1.5);
    expect(g.boundingBox!.max.y).toBeLessThan(2.4);
  });
});
