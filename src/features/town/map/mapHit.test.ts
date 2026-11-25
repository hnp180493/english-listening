import { describe, expect, it } from 'vitest';
import { TOWN_WORLD, WORLD_ACTIVITIES, worldPlace } from '../../../data/townWorld';
import { footprint, PLACE_ART } from './mapGeo';
import { convexHull, hitMap, hitShapes, outlineInBox, pointInPolygon, segmentDistance } from './mapHit';
import { MAP_TILT, MAP_YAW0, toBox, type MapView } from './mapView';

const BOX = { w: 1200, h: 800 };
const V: MapView = { cx: 22, cy: 22, scale: 16, yaw: MAP_YAW0, tilt: MAP_TILT };
const SHAPES = hitShapes(TOWN_WORLD);

describe('geometry', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  it('finds points inside a polygon, on its edge, and not outside', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 10, y: 4 }, square)).toBe(true);
    expect(pointInPolygon({ x: 11, y: 4 }, square)).toBe(false);
    expect(pointInPolygon({ x: -0.1, y: -0.1 }, square)).toBe(false);
  });
  it('wraps points in their convex hull, inner points left out', () => {
    const hull = convexHull([...square, { x: 5, y: 5 }, { x: 2, y: 8 }]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 5, y: 5 });
  });
  it('measures the distance to a segment', () => {
    expect(segmentDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    expect(segmentDistance({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
});

describe('what a click on the map lands on', () => {
  it('a house: its roof and its walls pick the place', () => {
    const cafe = worldPlace('cafe')!;
    const mid = { x: cafe.x + cafe.w / 2, y: cafe.y + cafe.d / 2 };
    const roof = toBox(V, BOX, mid.x, mid.y, PLACE_ART.cafe.h);
    expect(hitMap(V, BOX, roof.x, roof.y, SHAPES)).toEqual({ kind: 'place', id: 'cafe' });
    const foot = toBox(V, BOX, mid.x, mid.y, 0.2);
    expect(hitMap(V, BOX, foot.x, foot.y, SHAPES)).toEqual({ kind: 'place', id: 'cafe' });
  });

  it('an activity: the egg kiosk is the egg shop, the farm field the farm', () => {
    const kiosk = WORLD_ACTIVITIES.eggs.look;
    const k = toBox(V, BOX, kiosk.x, kiosk.y, 0.3);
    expect(hitMap(V, BOX, k.x, k.y, SHAPES)).toEqual({ kind: 'activity', id: 'eggs' });
    const field = toBox(V, BOX, 56.5, 15.6);
    expect(hitMap(V, BOX, field.x, field.y, SHAPES)).toEqual({ kind: 'activity', id: 'farm' });
  });

  it('open ground: the point of the ground under the pointer', () => {
    // the meadow, nothing standing there
    const p = toBox(V, BOX, 40.5, 48.5);
    const hit = hitMap(V, BOX, p.x, p.y, SHAPES);
    expect(hit?.kind).toBe('tile');
    if (hit?.kind === 'tile') {
      expect(hit.x).toBeCloseTo(40.5, 6);
      expect(hit.y).toBeCloseTo(48.5, 6);
    }
  });

  it('nothing on the lake or off the island', () => {
    const lake = toBox(V, BOX, 23.5, 27.5);
    expect(hitMap(V, BOX, lake.x, lake.y, SHAPES)).toBeNull();
    const off = toBox(V, BOX, -6, 22);
    expect(hitMap(V, BOX, off.x, off.y, SHAPES)).toBeNull();
  });

  it('the nearer of two outlines wins where they overlap on the screen', () => {
    // the office's tall walls rise over the ground behind it: a point on its roof is the office
    const office = worldPlace('office')!;
    const roof = toBox(V, BOX, office.x + office.w / 2, office.y + 0.3, PLACE_ART.office.h);
    expect(hitMap(V, BOX, roof.x, roof.y, SHAPES)).toEqual({ kind: 'place', id: 'office' });
  });

  it('every place and every activity can be hit', () => {
    const targets = new Set(SHAPES.map((s) => JSON.stringify(s.target)));
    for (const p of TOWN_WORLD.places) expect(targets.has(JSON.stringify({ kind: 'place', id: p.id }))).toBe(true);
    // the activities' own spots; the things to use (every bench, the radio) are not on the map
    for (const id of Object.keys(WORLD_ACTIVITIES)) expect(targets.has(JSON.stringify({ kind: 'activity', id })), id).toBe(!id.startsWith('thing:'));
  });

  it('a shape outline covers its footprint and its top', () => {
    const p = worldPlace('school')!;
    const outline = outlineInBox(V, BOX, footprint(p), 1);
    const top = toBox(V, BOX, p.x + 1, p.y + 1.5, 1);
    const ground = toBox(V, BOX, p.x + 1, p.y + 1.5);
    expect(pointInPolygon(top, outline)).toBe(true);
    expect(pointInPolygon(ground, outline)).toBe(true);
  });
});
