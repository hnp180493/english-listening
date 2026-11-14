import { describe, expect, it } from 'vitest';
import { TOWN_WORLD, WORLD_PLACES, type TownWorld, type WorldPlace } from '../../data/townWorld';
import {
  canStep,
  findPath,
  inBounds,
  nearestWalkable,
  placeAtTile,
  residentTile,
  sameTile,
  screenDistance,
  STEP_HORIZONTAL,
  STEP_STRAIGHT,
  STEP_VERTICAL,
  stepCost,
  tileOfPlaceDoor,
  walkable,
} from './map';

const P = (x: number, y: number) => ({ x, y });

const house: WorldPlace = { id: 'home', name: 'Nhà', resident: 'Grace', x: 2, y: 1, w: 2, d: 2, face: 'y', door: P(2, 3), spot: P(3, 3) };

/** A 6 × 6 test world: a house at (2..3, 1..2), a tree at (0,0), water at (5,0) and (5,1), a lamp spot at (0,5). */
const SMALL: TownWorld = {
  size: 6,
  rows: ['T....~', '.....~', '......', '.====.', '......', '......'],
  places: [house],
  props: [],
  decorations: {
    lamps1: [{ x: 0, y: 5, solid: true }],
    flowers: [],
    benches: [],
    blossom: [],
    lamps2: [],
    lights: [],
    lilies: [],
    stall: [],
    fountain: [],
    balloons: [{ x: 4.5, y: 4.5, solid: false }],
    flags: [],
    cat: [],
  },
  plaza: { x: 3, y: 3, r: 1 },
  start: P(1, 3),
};

function pathLength(from: { x: number; y: number }, path: { x: number; y: number }[]): number {
  let at = from;
  let sum = 0;
  for (const t of path) {
    sum += stepCost({ x: t.x - at.x, y: t.y - at.y });
    at = t;
  }
  return sum;
}

describe('walkable', () => {
  it('grass, path and plaza are; water, trees, footprints and solid spots are not', () => {
    expect(walkable(P(1, 1), SMALL)).toBe(true);
    expect(walkable(P(2, 3), SMALL)).toBe(true);
    expect(walkable(P(0, 0), SMALL)).toBe(false); // tree
    expect(walkable(P(5, 1), SMALL)).toBe(false); // water
    expect(walkable(P(3, 2), SMALL)).toBe(false); // the house
    expect(walkable(P(0, 5), SMALL)).toBe(false); // a lamp will stand here
    expect(walkable(P(4, 4), SMALL)).toBe(true); // balloons do not take the tile
  });

  it('nothing outside the map or between tiles', () => {
    for (const out of [P(-1, 0), P(0, -1), P(6, 0), P(0, 6), P(0.5, 1), P(Number.NaN, 1)]) {
      expect(inBounds(out, SMALL)).toBe(false);
      expect(walkable(out, SMALL)).toBe(false);
    }
  });

  it('the town: plaza and streets are open, the fountain, the pond and every footprint are closed', () => {
    expect(walkable(TOWN_WORLD.start)).toBe(true);
    expect(walkable(P(10, 10))).toBe(false); // fountain
    expect(walkable(P(13, 13))).toBe(false); // pond
    expect(walkable(P(9, 10))).toBe(true);
    for (const p of WORLD_PLACES) {
      expect(walkable(P(p.x, p.y)), p.id).toBe(false);
      expect(walkable(P(p.x + p.w - 1, p.y + p.d - 1)), p.id).toBe(false);
    }
  });
});

describe('steps', () => {
  it('a diagonal step never cuts a corner', () => {
    // from (1,2) towards (2,3): both (2,2) and (1,3) must be free, and (2,2) is the house
    expect(canStep(P(1, 2), P(1, 1), SMALL)).toBe(false);
    expect(canStep(P(1, 3), P(1, 1), SMALL)).toBe(true);
    expect(canStep(P(1, 3), P(1, 0), SMALL)).toBe(true);
    expect(canStep(P(1, 2), P(1, 0), SMALL)).toBe(false);
    expect(canStep(P(1, 3), P(0, 0), SMALL)).toBe(false);
  });

  it('a step costs what it looks like on the screen', () => {
    expect(stepCost(P(1, 0))).toBe(STEP_STRAIGHT);
    expect(stepCost(P(0, -1))).toBe(STEP_STRAIGHT);
    expect(stepCost(P(1, 1))).toBe(STEP_VERTICAL);
    expect(stepCost(P(-1, 1))).toBe(STEP_HORIZONTAL);
    expect(screenDistance(P(0, 0), P(1, 1))).toBeCloseTo(STEP_VERTICAL);
    expect(screenDistance(P(0, 0), P(1, -1))).toBeCloseTo(STEP_HORIZONTAL);
  });
});

describe('findPath', () => {
  it('walks around the house, tile by tile, without cutting its corners', () => {
    const from = P(2, 0);
    const to = P(2, 3);
    const path = findPath(from, to, SMALL);
    expect(path.at(-1)).toEqual(to);
    expect(path).not.toContainEqual(from);
    let at = from;
    for (const t of path) {
      const d = { x: t.x - at.x, y: t.y - at.y };
      expect(Math.max(Math.abs(d.x), Math.abs(d.y))).toBe(1);
      expect(canStep(at, d, SMALL)).toBe(true);
      at = t;
    }
    // down the west side: (1,0)/(1,1), (1,2), then the corner by two straight steps
    expect(path).toContainEqual(P(1, 2));
  });

  it('is the shortest walk and always the same one', () => {
    const path = findPath(P(0, 3), P(4, 3), SMALL);
    expect(path).toEqual([P(1, 3), P(2, 3), P(3, 3), P(4, 3)]);
    expect(pathLength(P(0, 3), path)).toBeCloseTo(4 * STEP_STRAIGHT);
    expect(findPath(P(0, 3), P(4, 3), SMALL)).toEqual(path);
    // a diagonal is used when it is shorter
    expect(findPath(P(0, 4), P(2, 5), SMALL).length).toBeLessThan(3);
  });

  it('gives nothing for the same tile, a blocked end or an unreachable tile', () => {
    expect(findPath(P(1, 1), P(1, 1), SMALL)).toEqual([]);
    expect(findPath(P(1, 1), P(2, 2), SMALL)).toEqual([]);
    expect(findPath(P(2, 2), P(1, 1), SMALL)).toEqual([]);
    const walled: TownWorld = { ...SMALL, rows: ['.~....', '~~....', '......', '......', '......', '......'], places: [] };
    expect(findPath(P(0, 0), P(4, 4), walled)).toEqual([]);
  });

  it('crosses the whole town', () => {
    const path = findPath(tileOfPlaceDoor('phone'), tileOfPlaceDoor('cinema'));
    expect(path.length).toBeGreaterThan(10);
    for (const t of path) expect(walkable(t)).toBe(true);
  });
});

describe('nearestWalkable', () => {
  it('is the tile itself when free, else the closest free one', () => {
    expect(nearestWalkable(P(1, 1), SMALL)).toEqual(P(1, 1));
    expect(nearestWalkable(P(1.7, 1.2), SMALL)).toEqual(P(1, 1));
    const n = nearestWalkable(P(0, 0), SMALL)!;
    expect(walkable(n, SMALL)).toBe(true);
    expect(screenDistance(n, P(0, 0))).toBeLessThanOrEqual(STEP_STRAIGHT);
    // outside the map: a tile on the edge next to it
    const edge = nearestWalkable(P(-3, 3), SMALL)!;
    expect(edge.x).toBe(0);
    expect(walkable(edge, SMALL)).toBe(true);
  });

  it('stops on the side the walker comes from', () => {
    // from the house tile (2,2) two free tiles are equally near on the screen: straight up it and straight down it
    const above = nearestWalkable(P(2, 2), SMALL, P(0, 2))!;
    const below = nearestWalkable(P(2, 2), SMALL, P(2, 5))!;
    expect(above).toEqual(P(1, 1));
    expect(below).toEqual(P(3, 3));
  });

  it('null when nothing is walkable', () => {
    const sea: TownWorld = { ...SMALL, size: 2, rows: ['~~', '~~'], places: [], decorations: { ...SMALL.decorations, lamps1: [], balloons: [] } };
    expect(nearestWalkable(P(0, 0), sea)).toBeNull();
  });
});

describe('places', () => {
  it('door and resident tiles come from the layout', () => {
    expect(tileOfPlaceDoor('home', SMALL)).toEqual(P(2, 3));
    expect(residentTile('home', SMALL)).toEqual(P(3, 3));
    expect(() => tileOfPlaceDoor('cafe', SMALL)).toThrow();
    for (const p of WORLD_PLACES) {
      expect(sameTile(tileOfPlaceDoor(p.id), p.door)).toBe(true);
      expect(sameTile(residentTile(p.id), p.spot)).toBe(true);
    }
  });

  it('a tile of a footprint knows its place', () => {
    expect(placeAtTile(P(3, 2), SMALL)?.id).toBe('home');
    expect(placeAtTile(P(3.4, 1.9), SMALL)?.id).toBe('home');
    expect(placeAtTile(P(4, 2), SMALL)).toBeUndefined();
    expect(placeAtTile(P(4, 8))?.id).toBe('cafe');
  });
});
