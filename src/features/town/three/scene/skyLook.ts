// The colours of the sky behind the town and of the air in front of it, by the hour and the weather (docs/town.md
// §24). The sky canvas (engine/draw/overlay.ts drawSky) keeps painting its two palettes, day and night, laid over each
// other by the night amount; this tints them (pink and gold at dawn and dusk, grey under cloud, darker in the rain,
// no stars through cloud) and gives the mist the colour of the horizon, so far things fade into the sky behind them.
// Pure: tested in skyLook.test.ts.

import { mixHex } from './palette3d';
import type { SkyNow } from '../../../../core/town/sky';
import { hazeOf } from '../../../../core/town/sunPath';

/** The sky's part of a canvas palette (engine/palette.ts TownPalette). */
export interface SkyColours {
  night: boolean;
  skyTop: string;
  skyBottom: string;
  /** Soft shapes in the sky: an rgba() colour. */
  cloud: string;
  star: string;
}

export interface Air {
  /** 0 by day … 1 at night. */
  night: number;
  /** The gold of dawn and dusk, 0 … 1. */
  glow: number;
  cloud: number;
  rain: number;
}

const DAWN_TOP = '#8f9bd8';
const DAWN_LOW = '#ffab8f';
const GREY_TOP = { day: '#9aa5b3', night: '#22263a' };
const GREY_LOW = { day: '#c5cbd2', night: '#34344a' };
const RAIN_TOP = { day: '#7d8794', night: '#1a1d2c' };
const RAIN_LOW = { day: '#a4abb5', night: '#2a2a3c' };

function rgba(s: string): [number, number, number, number] {
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (!m) return [255, 255, 255, 1];
  const p = m[1].split(',').map((x) => parseFloat(x));
  return [p[0], p[1], p[2], p[3] ?? 1];
}

/** One of the canvas's two sky palettes as the weather and the hour tint it (`which`: the palette's own end). */
export function tintSky<P extends SkyColours>(pal: P, which: 'day' | 'night', air: Air): P {
  const cloud = Math.max(0, Math.min(1, air.cloud));
  const rain = Math.max(0, Math.min(1, air.rain));
  const glow = Math.max(0, Math.min(1, air.glow)) * (1 - 0.6 * cloud);
  let top = mixHex(pal.skyTop, DAWN_TOP, glow * 0.45);
  let low = mixHex(pal.skyBottom, DAWN_LOW, glow * 0.75);
  top = mixHex(top, GREY_TOP[which], cloud * 0.85);
  low = mixHex(low, GREY_LOW[which], cloud * 0.8);
  top = mixHex(top, RAIN_TOP[which], rain * 0.7);
  low = mixHex(low, RAIN_LOW[which], rain * 0.7);
  // the shapes in the sky: thicker and greyer under cloud, pink in the glow
  const [r, g, b, a] = rgba(pal.cloud);
  const grey = which === 'day' ? [205, 210, 218] : [70, 74, 96];
  const k = cloud * 0.8;
  const pink = which === 'day' ? glow * 0.5 : 0;
  const cr = Math.round((r + (grey[0] - r) * k) * (1 - pink) + 255 * pink);
  const cg = Math.round((g + (grey[1] - g) * k) * (1 - pink) + 196 * pink);
  const cb = Math.round((b + (grey[2] - b) * k) * (1 - pink) + 186 * pink);
  const ca = Math.min(0.95, a + (0.9 - a) * k);
  // stars only through a clear sky
  const [sr, sg, sb, sa] = rgba(pal.star);
  const star = `rgba(${sr},${sg},${sb},${+(sa * (1 - Math.min(1, cloud * 1.6))).toFixed(3)})`;
  return { ...pal, skyTop: top, skyBottom: low, cloud: `rgba(${cr},${cg},${cb},${+ca.toFixed(3)})`, star };
}

/**
 * The colour of the mist: the horizon's (the bottom of the sky, day's and night's blended as the canvas blends them),
 * a little towards the sky above.
 */
export function mistColour(day: SkyColours, night: SkyColours, k: number): string {
  const low = mixHex(day.skyBottom, night.skyBottom, Math.max(0, Math.min(1, k)));
  const top = mixHex(day.skyTop, night.skyTop, Math.max(0, Math.min(1, k)));
  return mixHex(low, top, 0.25);
}

/** "#rrggbb" as 0 … 1 components (for a shader uniform used after the colour-space conversion, so not linearised). */
export function srgb01(hex: string): [number, number, number] {
  const p = parseInt(hex.slice(1), 16);
  return [((p >> 16) & 255) / 255, ((p >> 8) & 255) / 255, (p & 255) / 255];
}

/** What the engine hands world3d setAir, and the sky canvas's two palettes, for the sky now. */
export function airNow<P extends SkyColours>(
  sky: SkyNow,
  night: number,
  wet: number,
  dayPal: P,
  nightPal: P,
): { pals: { day: P; night: P }; air: { wet: number; haze: number; mist: string; sky: string; shade: number; wind: number } } {
  const a: Air = { night, glow: sky.glow, cloud: sky.mix.cloud, rain: sky.mix.rain };
  const day = tintSky(dayPal, 'day', a);
  const nightP = tintSky(nightPal, 'night', a);
  const lit = 1 - night;
  return {
    pals: { day, night: nightP },
    air: {
      wet,
      haze: hazeOf(sky.hour, sky.mix, wet),
      mist: mistColour(day, nightP, night),
      sky: mixHex(day.skyTop, nightP.skyTop, night),
      // cloud shadows on a broken-cloud day only (none in a clear sky, none under a sky all grey), by day
      shade: lit * Math.min(0.42, sky.mix.cloud * (1 - sky.mix.cloud) * 2.6),
      wind: sky.mix.wind,
    },
  };
}
