// The scene builders run without a browser (three.js geometry only): every place, lot, prop, decoration and project
// gives finite geometry that stands where it should.

import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { DECORATION_IDS, TOWN_WORLD } from '../../../../data/townWorld';
import { EXTRA_DECOR } from '../../engine/extraDecor';
import { kitFor, buildInn, buildPlace, buildSite } from './places3d';
import { buildDecorations, buildProject, buildProps, SEAT_TOP } from './props3d';
import { SEAT_HEIGHT, TILE_SCALE } from '../characters';
import { SEAT_DESIGN } from '../chars/anim';
import { buildTerrain } from './terrain';
import { makeMaterials } from './materials';
import { Merge, shapes } from './merge';

function finite(g: BufferGeometry | null | undefined): void {
  if (!g) return;
  const a = g.getAttribute('position').array;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error('not finite at ' + i);
  const c = g.getAttribute('color').array;
  for (let i = 0; i < c.length; i++) if (!(c[i] >= 0 && c[i] <= 1.5)) throw new Error('bad colour at ' + i);
}

describe('3D town builders', () => {
  it('benches and the café stool are as high as the sit pose expects', () => {
    expect(SEAT_TOP).toBe(SEAT_HEIGHT);
    expect(SEAT_DESIGN * TILE_SCALE).toBeCloseTo(SEAT_TOP, 9);
  });

  it('merges painted pieces into one geometry', () => {
    const m = new Merge();
    expect(m.build()).toBeNull();
    m.add(shapes.box(1, 1, 1), '#ff0000', { x: 2, y: 0.5 });
    m.add(shapes.sphere(0.5), '#00ff00', { z: 3 }, { ao: false });
    const g = m.build()!;
    finite(g);
    expect(g.boundingBox!.max.x).toBeCloseTo(2.5, 1);
    expect(g.boundingBox!.max.z).toBeCloseTo(3.5, 1);
  });

  it('turns a kit to the face of its door', () => {
    const p = TOWN_WORLD.places.find((q) => q.face === 'x')!;
    const f = kitFor(p);
    expect(f.ry).toBeCloseTo(Math.PI / 2);
    expect(f.k.W).toBeCloseTo(p.d - 0.36);
    const q = TOWN_WORLD.places.find((r) => r.face === 'y')!;
    expect(kitFor(q).ry).toBe(0);
    // the door's offset stays on the wall
    for (const r of TOWN_WORLD.places) {
      const g = kitFor(r);
      expect(Math.abs(g.u)).toBeLessThanOrEqual(g.k.W / 2 + 0.5);
    }
  });

  it('builds every place, inside its lot and of a sensible height', () => {
    for (const p of TOWN_WORLD.places) {
      const t = buildPlace(p);
      expect(t.body).not.toBeNull();
      finite(t.body);
      finite(t.glass);
      finite(t.bulbs);
      expect(t.height).toBeGreaterThan(1);
      expect(t.height).toBeLessThan(4);
      const b = t.body!.boundingBox!;
      // local, turned: the larger half-size of the lot bounds it (eaves and signs may reach a little past)
      const half = Math.max(p.w, p.d) / 2 + 0.8;
      expect(Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z)).toBeLessThan(half);
      expect(b.min.y).toBeGreaterThan(-0.05);
      const s = buildSite(p);
      finite(s.body);
      expect(s.height).toBeGreaterThan(0.5);
    }
  });

  it('builds the boarding house, the fixed things, every decoration and project', () => {
    const inn = TOWN_WORLD.props.find((q) => q.kind === 'inn');
    if (inn) finite(buildInn(inn.tiles, TOWN_WORLD.life?.inn.door)?.body);
    const props = buildProps(TOWN_WORLD, true);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) {
      finite(p.body);
      finite(p.bulbs);
      finite(p.glass);
    }
    // the bus waits only with its bus stop
    const busCount = (stop: boolean) => buildProps(TOWN_WORLD, stop).length;
    if (TOWN_WORLD.props.some((q) => q.kind === 'bus')) expect(busCount(true)).toBe(busCount(false) + TOWN_WORLD.props.filter((q) => q.kind === 'bus').length);
    const decor = buildDecorations(TOWN_WORLD, [...DECORATION_IDS], true);
    for (const id of DECORATION_IDS) {
      if (id === 'cat' || (TOWN_WORLD.decorations[id] ?? []).length === 0) continue;
      expect(decor.some((d) => d.pop === id)).toBe(true);
    }
    for (const d of decor) {
      finite(d.body);
      finite(d.sway);
      finite(d.water);
    }
    for (const [id, spots] of Object.entries(EXTRA_DECOR)) {
      const pieces = buildProject(id, spots.map((s) => s.at));
      expect(pieces).toHaveLength(spots.length);
      for (const pc of pieces) {
        expect(pc.body).not.toBeNull();
        finite(pc.body);
      }
    }
    expect(buildProject('proj-unknown', [{ x: 1, y: 1 }])[0].body).toBeNull();
  });

  it('builds the ground of the whole map', () => {
    const mats = makeMaterials();
    const t = buildTerrain(TOWN_WORLD, mats);
    expect(t.group.children.length).toBeGreaterThan(3);
    t.dispose();
    mats.dispose();
  });
});
