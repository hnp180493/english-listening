import { describe, expect, it } from 'vitest';
import { TOWN_WORLD, WORLD_PLACES } from '../../../data/townWorld';
import { toWorld } from './iso';
import { ACTOR_ABOVE, onActor, pickAt, pointInPolygon, silhouette } from './pick';
import { placeHeight } from './places';
import { TownSim } from './sim';

const sim = () => {
  const s = new TownSim(TOWN_WORLD, () => 0.5);
  s.setState({ built: ['square', 'cafe', 'friend'], decorations: [] });
  return s;
};
const place = (id: string) => WORLD_PLACES.find((p) => p.id === id)!;

describe('shapes', () => {
  it('point in polygon', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 11, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 5, y: -1 }, square)).toBe(false);
  });

  it('the outline of a house holds its footprint and its roof, not the ground beside it', () => {
    const p = place('cafe');
    const h = placeHeight('cafe');
    const out = silhouette(p, h);
    expect(out).toHaveLength(6);
    expect(pointInPolygon(toWorld(p.x + p.w / 2, p.y + p.d / 2), out)).toBe(true);
    expect(pointInPolygon(toWorld(p.x + p.w / 2, p.y + p.d / 2, h - 2), out)).toBe(true);
    expect(pointInPolygon(toWorld(p.x + p.w / 2, p.y + p.d + 1), out)).toBe(false);
    expect(pointInPolygon(toWorld(p.x - 2, p.y + p.d / 2), out)).toBe(false);
  });

  it('a character is hit on its body and its name tag, not beside it', () => {
    const feet = toWorld(5.5, 5.5);
    expect(onActor({ x: feet.x, y: feet.y - 20 }, 5.5, 5.5)).toBe(true);
    expect(onActor({ x: feet.x, y: feet.y - ACTOR_ABOVE + 1 }, 5.5, 5.5)).toBe(true);
    expect(onActor({ x: feet.x + 30, y: feet.y - 20 }, 5.5, 5.5)).toBe(false);
    expect(onActor({ x: feet.x, y: feet.y + 20 }, 5.5, 5.5)).toBe(false);
  });
});

describe('pickAt', () => {
  it('a resident, where they stand now', () => {
    const s = sim();
    const emma = s.residents.get('cafe')!;
    const feet = toWorld(emma.x, emma.y);
    expect(pickAt({ x: feet.x, y: feet.y - 18 }, s)).toEqual({ kind: 'resident', placeId: 'cafe' });
  });

  it('a built place by its walls or roof; an empty lot by its plot', () => {
    const s = sim();
    const cafe = place('cafe');
    expect(pickAt(toWorld(cafe.x + 0.5, cafe.y + 0.5, 40), s)).toEqual({ kind: 'place', placeId: 'cafe', built: true });
    const home = place('home');
    expect(pickAt(toWorld(home.x + 1, home.y + 1), s)).toEqual({ kind: 'place', placeId: 'home', built: false });
    // high above an empty lot there is no roof to hit: the pointer is on the ground behind it
    expect(pickAt(toWorld(home.x + 1, home.y + 1, 70), s)?.kind).toBe('tile');
  });

  it('the ground: which tile, and whether one can walk there', () => {
    const s = sim();
    expect(pickAt(toWorld(9.5, 12.5), s)).toEqual({ kind: 'tile', tile: { x: 9, y: 12 }, walkable: true });
    expect(pickAt(toWorld(13.5, 13.5), s)).toEqual({ kind: 'tile', tile: { x: 13, y: 13 }, walkable: false });
  });

  it('nothing outside the map', () => {
    const s = sim();
    expect(pickAt(toWorld(-3, 5), s)).toBeNull();
    expect(pickAt(toWorld(30, 30), s)).toBeNull();
  });

  it('the one nearer the viewer wins when two residents overlap', () => {
    const s = sim();
    const leo = s.residents.get('square')!;
    const emma = s.residents.get('cafe')!;
    emma.x = leo.x + 0.2;
    emma.y = leo.y + 0.2;
    const feet = toWorld(leo.x, leo.y);
    expect(pickAt({ x: feet.x, y: feet.y - 16 }, s)).toEqual({ kind: 'resident', placeId: 'cafe' });
  });
});
