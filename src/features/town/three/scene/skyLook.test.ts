import { describe, expect, it } from 'vitest';
import { airNow, mistColour, srgb01, tintSky, type SkyColours } from './skyLook';
import { skyAt } from '../../../../core/town/sky';

const DAY: SkyColours = { night: false, skyTop: '#7fc3ec', skyBottom: '#f4dcbc', cloud: 'rgba(255,255,255,0.75)', star: 'rgba(255,255,255,0)' };
const NIGHT: SkyColours = { night: true, skyTop: '#141a3a', skyBottom: '#3a2f63', cloud: 'rgba(120,130,200,0.14)', star: 'rgba(235,240,255,0.9)' };
const clear = { night: 0, glow: 0, cloud: 0, rain: 0 };
const lum = (hex: string) => {
  const [r, g, b] = srgb01(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const sat = (hex: string) => {
  const [r, g, b] = srgb01(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
};

describe('the sky by the hour and the weather', () => {
  it('leaves a clear midday sky as it was', () => {
    const t = tintSky(DAY, 'day', clear);
    expect(t.skyTop).toBe(DAY.skyTop);
    expect(t.skyBottom).toBe(DAY.skyBottom);
  });

  it('is pink and gold at the horizon at dawn, grey under cloud, darker in the rain', () => {
    const dawn = tintSky(DAY, 'day', { ...clear, glow: 1 });
    const [r, , b] = srgb01(dawn.skyBottom);
    expect(r).toBeGreaterThan(b + 0.2);
    const grey = tintSky(DAY, 'day', { ...clear, cloud: 1 });
    expect(sat(grey.skyTop)).toBeLessThan(sat(DAY.skyTop) * 0.5);
    const rain = tintSky(DAY, 'day', { ...clear, cloud: 1, rain: 1 });
    expect(lum(rain.skyTop)).toBeLessThan(lum(grey.skyTop));
    expect(lum(rain.skyBottom)).toBeLessThan(lum(grey.skyBottom));
  });

  it('hides the stars behind cloud and keeps them in a clear night', () => {
    expect(tintSky(NIGHT, 'night', { ...clear, night: 1 }).star).toBe('rgba(235,240,255,0.9)');
    expect(tintSky(NIGHT, 'night', { ...clear, night: 1, cloud: 1 }).star).toMatch(/,0\)$/);
  });

  it('gives the mist the horizon colour, day or night', () => {
    expect(lum(mistColour(DAY, NIGHT, 0))).toBeGreaterThan(0.5);
    expect(lum(mistColour(DAY, NIGHT, 1))).toBeLessThan(0.25);
  });

  it('hands the engine what it needs: mist at dawn, wet ground and no cloud shadows under a sky all grey', () => {
    const now = skyAt(0, 'clear');
    const dawn = airNow({ ...now, hour: 6.2, mix: { cloud: 0, rain: 0, storm: 0, wind: 0 }, glow: 1 }, 0.3, 0.3, DAY, NIGHT);
    expect(dawn.air.haze).toBeGreaterThan(0.3);
    const broken = airNow({ ...now, hour: 13, mix: { cloud: 0.5, rain: 0, storm: 0, wind: 0.2 }, glow: 0 }, 0, 0, DAY, NIGHT);
    expect(broken.air.shade).toBeGreaterThan(0.3);
    const overcast = airNow({ ...now, hour: 13, mix: { cloud: 1, rain: 1, storm: 1, wind: 1 }, glow: 0 }, 0, 1, DAY, NIGHT);
    expect(overcast.air.shade).toBe(0);
    expect(overcast.air.wet).toBe(1);
    const noon = airNow({ ...now, hour: 12.5, mix: { cloud: 0, rain: 0, storm: 0, wind: 0 }, glow: 0 }, 0, 0, DAY, NIGHT);
    expect(noon.air.haze).toBe(0);
    expect(noon.air.shade).toBe(0);
  });
});
