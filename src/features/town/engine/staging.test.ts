// Where talks are staged (staging.ts): every setting of every episode and quick chat has a door to walk to or two
// spots at a place's front, on open ground, never in a house, the two at talking distance.

import { describe, expect, it } from 'vitest';
import { walkable } from '../../../core/town/map';
import { QUICK_CHAT_SETTINGS, TOWN_STORIES, INN_SETTING } from '../../../data/townStories';
import { TOWN_WORLD } from '../../../data/townWorld';
import { doorwayOf, metInStreet, outsideSpots, outward, playerStand, sameSetting, STREET_FAR, type StorySetting } from './staging';

const tile = (p: { x: number; y: number }) => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
const inPlace = (p: { x: number; y: number }) => TOWN_WORLD.places.some((q) => p.x >= q.x && p.x < q.x + q.w && p.y >= q.y && p.y < q.y + q.d);

/** Every setting a talk can have, with the resident it is with. */
const SETTINGS: { who: string; s: StorySetting }[] = [
  ...TOWN_STORIES.flatMap((e) => [e.setting, e.lodgerSetting].filter((s): s is StorySetting => !!s).map((s) => ({ who: e.placeId, s }))),
  ...Object.entries(QUICK_CHAT_SETTINGS).map(([who, s]) => ({ who, s })),
  ...TOWN_WORLD.places.map((p) => ({ who: p.id, s: INN_SETTING })),
];

describe('staging a talk', () => {
  it('every setting of the content can be staged in the town', () => {
    for (const { who, s } of SETTINGS) {
      const at = playerStand(TOWN_WORLD, s, who);
      expect(at, `${who} ${JSON.stringify(s)}`).not.toBeNull();
      expect(walkable(tile(at!)), `${who} ${JSON.stringify(s)}`).toBe(true);
    }
  });

  it('a room is entered from the tile in front of its door; the resident waits beside it', () => {
    for (const room of [...TOWN_WORLD.places.map((p) => p.id), 'inn']) {
      const d = doorwayOf(TOWN_WORLD, room)!;
      expect(d, room).not.toBeNull();
      expect(walkable(d.door), room).toBe(true);
      expect(walkable(tile(d.beside)), room).toBe(true);
      const gap = Math.hypot(d.beside.x - d.door.x - 0.5, d.beside.y - d.door.y - 0.5);
      expect(gap, room).toBeGreaterThan(0.7);
      expect(gap, room).toBeLessThan(1.6);
    }
    expect(doorwayOf(TOWN_WORLD, 'inn')!.door).toEqual(TOWN_WORLD.life!.inn.door);
    expect(doorwayOf(TOWN_WORLD, 'moon')).toBeNull();
  });

  it('outside, the two stand on open ground at talking distance, side by side on the screen, never in a house', () => {
    for (const { who, s } of SETTINGS) {
      if (s.kind !== 'outside') continue;
      const sp = outsideSpots(TOWN_WORLD, s.at, who)!;
      for (const p of [sp.resident, sp.player]) {
        expect(walkable(tile(p)), `${who} at ${s.at}`).toBe(true);
        expect(inPlace(p), `${who} at ${s.at}`).toBe(false);
      }
      const gap = Math.hypot(sp.resident.x - sp.player.x, sp.resident.y - sp.player.y);
      expect(gap, `${who} at ${s.at}`).toBeGreaterThan(0.7);
      expect(gap, `${who} at ${s.at}`).toBeLessThan(1.4);
      // across the screen (screen right on the ground is (1, −1) / √2), not one behind the other
      const across = Math.abs(sp.player.x - sp.resident.x - (sp.player.y - sp.resident.y)) / Math.SQRT2;
      expect(across / gap, `${who} at ${s.at}`).toBeGreaterThan(0.9);
    }
  });

  it('at a front the resident stands by their own door; Mia at her window, close to her wall; lodgers on the plaza', () => {
    const cafe = TOWN_WORLD.places.find((p) => p.id === 'cafe')!;
    const emma = outsideSpots(TOWN_WORLD, 'cafe', 'cafe')!;
    expect(emma.resident).toEqual({ x: cafe.spot.x + 0.5, y: cafe.spot.y + 0.5 });
    expect(Math.hypot(emma.player.x - cafe.door.x - 0.5, emma.player.y - cafe.door.y - 0.5)).toBeLessThan(1.2);
    const friend = TOWN_WORLD.places.find((p) => p.id === 'friend')!;
    const mia = outsideSpots(TOWN_WORLD, 'friend', 'friend')!;
    expect(friend.face).toBe('x');
    expect(mia.resident.x - (friend.x + friend.w)).toBeCloseTo(0.3);
    const ben = outsideSpots(TOWN_WORLD, 'square', 'shop')!;
    const leo = outsideSpots(TOWN_WORLD, 'square', 'square')!;
    expect(ben.resident).not.toEqual(leo.resident);
    const { plaza } = TOWN_WORLD;
    expect(Math.hypot(ben.resident.x - plaza.x, ben.resident.y - plaza.y)).toBeLessThan(plaza.r);
    expect(outsideSpots(TOWN_WORLD, 'moon', 'cafe')).toBeNull();
  });

  it('out of a door the player faces the street; settings compare by where they are', () => {
    expect(outward('x')).toBe(0);
    expect(outward('y')).toBeCloseTo(Math.PI / 2);
    expect(sameSetting({ kind: 'inside', room: 'cafe' }, { kind: 'inside', room: 'cafe' })).toBe(true);
    expect(sameSetting({ kind: 'inside', room: 'cafe' }, { kind: 'outside', at: 'cafe' })).toBe(false);
    expect(sameSetting({ kind: 'outside', at: 'park' }, { kind: 'outside', at: 'square' })).toBe(false);
    expect(sameSetting(null, null)).toBe(true);
  });
});

describe('met in the street (docs/town.md §14)', () => {
  it('a resident far from where their talk would happen is out in the town; one by their door is at home', () => {
    const inn: StorySetting = { kind: 'inside', room: 'inn' };
    const door = playerStand(TOWN_WORLD, inn, 'school')!;
    expect(metInStreet(TOWN_WORLD, inn, 'school', { x: door.x + 1, y: door.y })).toBe(false);
    expect(metInStreet(TOWN_WORLD, inn, 'school', { x: door.x + STREET_FAR + 1, y: door.y })).toBe(true);
    const front: StorySetting = { kind: 'outside', at: 'cafe' };
    const at = playerStand(TOWN_WORLD, front, 'cafe')!;
    expect(metInStreet(TOWN_WORLD, front, 'cafe', at)).toBe(false);
    expect(metInStreet(TOWN_WORLD, front, 'cafe', { x: at.x, y: at.y - STREET_FAR - 0.5 })).toBe(true);
    // a place this world does not have: never the street
    expect(metInStreet(TOWN_WORLD, { kind: 'outside', at: 'moon' }, 'cafe', { x: 0, y: 0 })).toBe(false);
  });

  it('a talk in the street stands nowhere in particular and is the same staging as another one there', () => {
    expect(playerStand(TOWN_WORLD, { kind: 'here' }, 'cafe')).toBeNull();
    expect(sameSetting({ kind: 'here' }, { kind: 'here' })).toBe(true);
    expect(sameSetting({ kind: 'here' }, { kind: 'outside', at: 'cafe' })).toBe(false);
    expect(sameSetting({ kind: 'inside', room: 'inn' }, { kind: 'here' })).toBe(false);
  });
});
