import { describe, expect, it } from 'vitest';
import { groundHeight } from '../../../../data/townWorld';
import { HOVER_STICK, pick3, rayAabb, rayCylinder, rayGround, rayPlaneY, stickyTile, type PickBox, type Ray } from './pick3d';

const norm = (x: number, y: number, z: number) => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};
/** A ray from a camera point towards a target point. */
const toward = (from: [number, number, number], to: [number, number, number]): Ray => ({ o: { x: from[0], y: from[1], z: from[2] }, d: norm(to[0] - from[0], to[1] - from[1], to[2] - from[2]) });

describe('3D town picking', () => {
  it('meets the ground plane', () => {
    const r = toward([10, 10, 10], [3, 0, 4]);
    const t = rayPlaneY(r)!;
    expect(r.o.x + r.d.x * t).toBeCloseTo(3);
    expect(r.o.z + r.d.z * t).toBeCloseTo(4);
    // looking up, or level: never
    expect(rayPlaneY(toward([0, 1, 0], [5, 2, 0]))).toBeNull();
    expect(rayPlaneY({ o: { x: 0, y: 1, z: 0 }, d: { x: 1, y: 0, z: 0 } })).toBeNull();
  });

  it('meets the raised ground of the hill, not the flat under it', () => {
    const lift = (x: number, z: number) => groundHeight(x, z);
    // looking at the hill's top from the camera's side (south-east, 33° down): the point under the pointer is on it
    const top: [number, number, number] = [8.5, groundHeight(8.5, 6.5), 6.5];
    const r = toward([top[0] + 12, top[1] + 11, top[2] + 12], top);
    const t = rayGround(r, lift)!;
    expect(r.o.x + r.d.x * t).toBeCloseTo(8.5, 2);
    expect(r.o.z + r.d.z * t).toBeCloseTo(6.5, 2);
    // the plane y = 0 alone would put it a tile and more further on
    const flat = rayPlaneY(r)!;
    expect(Math.hypot(r.d.x, r.d.z) * (flat - t)).toBeGreaterThan(1);
    // on the slope, and the hovered tile is the one the pointer is over
    const slope: [number, number, number] = [11.2, groundHeight(11.2, 8.1), 8.1];
    const r2 = toward([slope[0] + 12, slope[1] + 11, slope[2] + 12], slope);
    const hit = pick3(r2, [], [], 44, () => true, lift);
    expect(hit).toMatchObject({ kind: 'tile', tile: { x: 11, y: 8 } });
    // without a field it is the plane
    expect(rayGround(r)).toBeCloseTo(flat);
  });

  it('enters boxes, from outside and from inside', () => {
    const box = { min: { x: 1, y: 0, z: 1 }, max: { x: 3, y: 2, z: 3 } };
    const hit = rayAabb(toward([10, 10, 10], [2, 1, 2]), box);
    expect(hit).not.toBeNull();
    expect(rayAabb(toward([10, 10, 10], [8, 0, 2]), box)).toBeNull();
    expect(rayAabb(toward([2, 1, 2], [5, 5, 5]), box)).toBe(0);
    // parallel to a face, outside it
    expect(rayAabb({ o: { x: 0, y: 5, z: 2 }, d: { x: 1, y: 0, z: 0 } }, box)).toBeNull();
  });

  it('hits an upright person on the side and on the top of the head', () => {
    const side = rayCylinder({ o: { x: -5, y: 0.5, z: 0 }, d: { x: 1, y: 0, z: 0 } }, 0, 0, 0.3, 0, 1);
    expect(side).toBeCloseTo(4.7);
    const top = rayCylinder({ o: { x: 0.1, y: 5, z: 0 }, d: { x: 0, y: -1, z: 0 } }, 0, 0, 0.3, 0, 1);
    expect(top).toBeCloseTo(4);
    expect(rayCylinder({ o: { x: -5, y: 1.5, z: 0 }, d: { x: 1, y: 0, z: 0 } }, 0, 0, 0.3, 0, 1)).toBeNull();
    expect(rayCylinder({ o: { x: -5, y: 0.5, z: 1 }, d: { x: 1, y: 0, z: 0 } }, 0, 0, 0.3, 0, 1)).toBeNull();
  });

  const cam: [number, number, number] = [20, 14, 20];
  const house: PickBox = { hit: { kind: 'place', placeId: 'cafe', built: true }, box: { min: { x: 4, y: 0, z: 4 }, max: { x: 6, y: 2, z: 6 } } };
  const walk = () => true;

  it('prefers a resident to the house behind them', () => {
    const r = toward(cam, [6.6, 0.5, 6.6]);
    expect(pick3(r, [{ placeId: 'cafe', x: 6.6, z: 6.6, height: 0.9 }], [house], 21, walk)).toEqual({ kind: 'resident', placeId: 'cafe' });
  });

  it('gives the house when it stands clearly in front of a person behind it', () => {
    const r = toward(cam, [3, 0.5, 3]);
    expect(pick3(r, [{ placeId: 'home', x: 3, z: 3, height: 0.9 }], [house], 21, walk)).toEqual(house.hit);
  });

  it('falls to the ground tile, walkable or not, and to nothing off the map', () => {
    expect(pick3(toward(cam, [10.5, 0, 12.5]), [], [house], 21, (t) => t.x !== 10)).toMatchObject({ kind: 'tile', tile: { x: 10, y: 12 }, walkable: false });
    const g = pick3(toward(cam, [10.5, 0, 12.5]), [], [], 21, walk);
    expect(g).toMatchObject({ kind: 'tile', tile: { x: 10, y: 12 }, walkable: true });
    // with the point on the ground itself
    expect(g?.kind === 'tile' && g.at?.x).toBeCloseTo(10.5, 6);
    expect(g?.kind === 'tile' && g.at?.z).toBeCloseTo(12.5, 6);
    expect(pick3(toward(cam, [-3, 0, 2]), [], [], 21, walk)).toBeNull();
  });

  it('the hovered square keeps its tile until the point is clearly over the next one (no flicker on an edge)', () => {
    let t = stickyTile(null, { x: 4.99, z: 7.5 });
    expect(t).toEqual({ x: 4, y: 7 });
    // a hair over the edge, back and forth: it stays
    for (const x of [5.01, 4.99, 5.05, 4.98, 5.1]) {
      t = stickyTile(t, { x, z: 7.5 });
      expect(t).toEqual({ x: 4, y: 7 });
    }
    // clearly over: it moves, and then stays there the same way
    t = stickyTile(t, { x: 5 + HOVER_STICK + 0.01, z: 7.5 });
    expect(t).toEqual({ x: 5, y: 7 });
    expect(stickyTile(t, { x: 4.95, z: 7.5 })).toEqual({ x: 5, y: 7 });
    expect(stickyTile(t, { x: 4.8, z: 7.5 })).toEqual({ x: 4, y: 7 });
  });
});
