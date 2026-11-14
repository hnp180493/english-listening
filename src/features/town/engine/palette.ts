// The two looks of the town: DAY (the app's light theme) and NIGHT (the dark theme, a dusk-blue town with lit
// windows, lamp halos and fireflies).
//
// THIS IS GAME ART, NOT UI CHROME. The colours below paint a picture on a <canvas>, the way an illustration or a
// photo has its own colours: they are not the app's tokens and must not be used for buttons, cards or text around
// the canvas (those keep using the CSS tokens of src/index.css). The town itself is rendered art (art/, Kenney
// CC0), tinted for the night by engine/sprites.ts; what is still drawn by code (sky, ducks, fireflies, tags,
// emotes) takes its colours from here, authored once for daylight and sunk into dusk by `ink`.

export type TownTheme = 'day' | 'night';

type RGB = readonly [number, number, number];

export function parseHex(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const css = (c: RGB) => `rgb(${clamp255(c[0])},${clamp255(c[1])},${clamp255(c[2])})`;

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** `rgba()` of a hex colour. */
export function alpha(hex: string, a: number): string {
  const c = parseHex(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

const WHITE: RGB = [255, 250, 240];
/** Shade towards a deep plum, not black: shadows stay colourful. */
const SHADE: RGB = [52, 38, 84];

/** k > 0 lightens (towards warm white), k < 0 darkens (towards plum). */
function shadeRgb(c: RGB, k: number): RGB {
  return k >= 0 ? mixRgb(c, WHITE, Math.min(1, k)) : mixRgb(c, SHADE, Math.min(1, -k));
}

/** Dusk: everything loses warmth and sinks into blue. */
function dusk(c: RGB): RGB {
  return [c[0] * 0.64 + 6, c[1] * 0.59 + 12, c[2] * 0.7 + 32];
}

export interface TownPalette {
  theme: TownTheme;
  night: boolean;
  /** An art colour (authored for daylight) as this theme shows it; `k` shades it first (-1 dark … +1 light). */
  ink: (hex: string, k?: number) => string;
  skyTop: string;
  skyBottom: string;
  /** Soft shapes in the sky: clouds by day, a far haze by night. */
  cloud: string;
  star: string;
  shadow: string;
  /** Emissive: never tinted. */
  windowLit: string;
  windowCore: string;
  glow: string;
  lampOn: string;
  firefly: string;
  /** Name tags (drawn on the canvas, over the picture). */
  tagBg: string;
  tagText: string;
  tagMuted: string;
  hover: string;
}

/** The art colours of the ground (daylight values; pass them through `ink`). */
export const ART = {
  waterShine: '#e9fbff',
} as const;

function makeInk(night: boolean): TownPalette['ink'] {
  const cache = new Map<string, string>();
  return (hex, k = 0) => {
    const key = k === 0 ? hex : hex + k;
    const hit = cache.get(key);
    if (hit) return hit;
    let c = parseHex(hex);
    if (k !== 0) c = shadeRgb(c, k);
    const out = css(night ? dusk(c) : c);
    cache.set(key, out);
    return out;
  };
}

const DAY: TownPalette = {
  theme: 'day',
  night: false,
  ink: makeInk(false),
  skyTop: '#bfe6f7',
  skyBottom: '#eef8ea',
  cloud: 'rgba(255,255,255,0.75)',
  star: 'rgba(255,255,255,0)',
  shadow: 'rgba(54,72,60,0.2)',
  windowLit: '#ffd76b',
  windowCore: '#fff3c4',
  glow: 'rgba(255,214,120,0)',
  lampOn: '#fff6d6',
  firefly: 'rgba(0,0,0,0)',
  tagBg: 'rgba(255,255,255,0.92)',
  tagText: '#2b2f45',
  tagMuted: '#5b6178',
  hover: 'rgba(255,255,255,0.45)',
};

const NIGHT: TownPalette = {
  theme: 'night',
  night: true,
  ink: makeInk(true),
  skyTop: '#141a3a',
  skyBottom: '#3a2f63',
  cloud: 'rgba(120,130,200,0.14)',
  star: 'rgba(235,240,255,0.9)',
  shadow: 'rgba(8,10,34,0.3)',
  windowLit: '#ffcf6a',
  windowCore: '#fff0b8',
  glow: 'rgba(255,196,96,1)',
  lampOn: '#ffe9a8',
  firefly: 'rgba(214,255,150,1)',
  tagBg: 'rgba(24,28,54,0.88)',
  tagText: '#f3f4ff',
  tagMuted: '#b8bedf',
  hover: 'rgba(255,236,170,0.2)',
};

export function paletteFor(theme: TownTheme): TownPalette {
  return theme === 'night' ? NIGHT : DAY;
}

/**
 * Colours of the small game pictures the page draws OVER the stage as DOM (the coin beside the xu count, the
 * friendship hearts, a resident's portrait): game art like everything above, handed to the elements as inline
 * values, never written in town.css.
 */
export const HUD_ART = {
  coin: '#ffd24a',
  coinRim: '#e8a11a',
  coinShine: '#fff6d6',
  heart: '#ff6f91',
  portraitSky: '#cfeaf7',
} as const;
