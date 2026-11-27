import { describe, expect, it } from 'vitest';
import { addressDecides, parseTownSpot, spotChanged, type TownSpot } from './townSpot';

const good: TownSpot = { map: 'town', x: 40.5, y: 30.25, heading: 1.2, yaw: 0.4, zoom: 0.55, at: 1_790_000_000_000 };

describe('the remembered street spot (townSpot.ts)', () => {
  it('reads a well-formed spot back as it was', () => {
    expect(parseTownSpot(JSON.parse(JSON.stringify(good)))).toEqual(good);
    expect(parseTownSpot({ ...good, map: 'city' })?.map).toBe('city');
  });

  it('anything else is no spot: a missing or wrong-typed part, an unknown map, junk', () => {
    for (const bad of [null, undefined, 3, 'town', [], {}, { ...good, map: 'moon' }, { ...good, x: '40' }, { ...good, y: Number.NaN }, { ...good, zoom: 0 }, { ...good, heading: null }, { ...good, x: -1 }, { ...good, at: undefined }]) {
      expect(parseTownSpot(bad)).toBeNull();
    }
  });

  it('the address wins: any parameter but the renderer switch and ?at says where to be or what to open', () => {
    expect(addressDecides({})).toBe(false);
    expect(addressDecides({ r: 'soft' })).toBe(false);
    expect(addressDecides({ at: 'city' })).toBe(false);
    for (const k of ['talk', 'build', 'activity', 'listen', 'from', 'with']) expect(addressDecides({ [k]: 'x' })).toBe(true);
  });

  it('written again only when the player moved half a tile, the camera turned or zoomed, or the map changed', () => {
    const { at: _at, ...now } = good;
    expect(spotChanged(null, now)).toBe(true);
    expect(spotChanged(good, now)).toBe(false);
    expect(spotChanged(good, { ...now, x: now.x + 0.3 })).toBe(false);
    expect(spotChanged(good, { ...now, x: now.x + 0.6 })).toBe(true);
    expect(spotChanged(good, { ...now, yaw: now.yaw + 0.3 })).toBe(true);
    expect(spotChanged(good, { ...now, zoom: now.zoom + 0.1 })).toBe(true);
    expect(spotChanged(good, { ...now, map: 'city' })).toBe(true);
  });
});
