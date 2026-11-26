// The colours of the 3D town: GAME ART, not UI chrome (like engine/palette.ts). One soft pastel set for the whole
// town, lit by the scene's lights (day and night are lighting, not a second set of colours), plus the light rig's
// numbers for day and night, blended by `night` 0..1.

export const C = {
  grass: '#9ad46b',
  grassDeep: '#7cc25a',
  grassLight: '#bfe57c',
  earth: '#c99b6d',
  earthDeep: '#9c7354',
  rock: '#a9a3b5',
  sand: '#f3deac',
  sandDeep: '#e2c690',
  path: '#ead9b8',
  cobble: ['#dcc6a2', '#e9d8b8', '#d2b996', '#e4cfae'] as const,
  plazaA: '#f6e8cf',
  plazaB: '#eccdb2',
  plazaC: '#d9b0a0',
  plazaRim: '#cdb7a0',
  waterDeep: '#4fb8c4',
  waterShallow: '#bff0e8',
  pondBed: '#d9c48f',
  wood: '#c99163',
  woodDark: '#8d6245',
  woodLight: '#e2b98a',
  trim: '#fffaf0',
  stone: '#d8d2cc',
  stoneDark: '#b3aaa5',
  metal: '#5d6475',
  glass: '#a9d3ee',
  glow: '#ffcf73',
  door: '#a8735a',
  white: '#ffffff',
  red: '#ef6f6c',
  coral: '#f2907f',
  pink: '#f6b7c6',
  rose: '#ee8aa6',
  peach: '#ffd5bb',
  butter: '#fbe7a6',
  mustard: '#f2c45a',
  orange: '#f6a35b',
  mint: '#9ad8b6',
  teal: '#5fb5b0',
  sky: '#b9dcf3',
  blue: '#6f9fd8',
  navy: '#4b5d8c',
  lilac: '#cdb9ef',
  plum: '#9b7cc6',
  cream: '#fff2dc',
  leaf: '#7cc36b',
  leafDeep: '#5aa65a',
  pine: '#4f9c6b',
  pineDeep: '#3e8660',
  blossom: '#f8bfd3',
  trunk: '#9b6b4c',
  soil: '#a8764f',
  soilDark: '#8a5d3d',
  crop: '#86cf5c',
  palmTrunk: '#c4986b',
  palmRing: '#a87b52',
  palmLeaf: '#6cc063',
  palmLeafDeep: '#4aa35a',
  coconut: '#7a5238',
} as const;

/** Flower colours scattered on the grass. */
export const FLOWERS = ['#ffffff', '#ffd8e4', '#ffe38a', '#f6a6c1', '#c9b6ff', '#ffb38a'] as const;

/** The light rig at one end of the day; `lightRig(night)` blends them. */
export interface Rig {
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sunColor: string;
  sun: number;
  exposure: number;
  fog: string;
  /** Windows / bulbs glow, 0..1 of their full strength. */
  glow: number;
  /** The lamps' point lights, 0..1. */
  lamps: number;
}

export const DAY_RIG: Rig = {
  // a warm, clear afternoon: less flat light from all round (it washed the colours out), more of a golden sun
  hemiSky: '#d2e6ff',
  hemiGround: '#9fc27c',
  hemi: 1.2,
  sunColor: '#ffe9c6',
  sun: 2.7,
  exposure: 0.9,
  fog: '#e9f5ea',
  glow: 0.12,
  lamps: 0,
};

export const NIGHT_RIG: Rig = {
  // a soft, warm-leaning moonlit night: lavender from above, a mauve bounce from the ground (trees stay readable,
  // grass is not a dark saturated green), the lamps' amber pools on top
  hemiSky: '#7c82c4',
  hemiGround: '#5c4658',
  hemi: 1.2,
  sunColor: '#b7c2ff',
  sun: 0.8,
  exposure: 1.08,
  fog: '#2c2752',
  glow: 1,
  lamps: 1,
};

/** Blend two hex colours (sRGB, fine for a light's colour). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => {
    const x = (pa >> s) & 255;
    const y = (pb >> s) & 255;
    return Math.round(x + (y - x) * t);
  };
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** The light rig `night` of the way from day (0) to night (1). */
export function lightRig(night: number): Rig {
  const t = Math.max(0, Math.min(1, night));
  const n = (a: number, b: number) => a + (b - a) * t;
  return {
    hemiSky: mixHex(DAY_RIG.hemiSky, NIGHT_RIG.hemiSky, t),
    hemiGround: mixHex(DAY_RIG.hemiGround, NIGHT_RIG.hemiGround, t),
    hemi: n(DAY_RIG.hemi, NIGHT_RIG.hemi),
    sunColor: mixHex(DAY_RIG.sunColor, NIGHT_RIG.sunColor, t),
    sun: n(DAY_RIG.sun, NIGHT_RIG.sun),
    exposure: n(DAY_RIG.exposure, NIGHT_RIG.exposure),
    fog: mixHex(DAY_RIG.fog, NIGHT_RIG.fog, t),
    glow: n(DAY_RIG.glow, NIGHT_RIG.glow),
    // the lamps come on in the second half of dusk
    lamps: Math.max(0, Math.min(1, (t - 0.35) / 0.5)),
  };
}

/** How brightly a place's windows glow at night for its share of lines understood (a faint glow from the first day). */
export function windowGlow(lit: number): number {
  const k = Math.max(0, Math.min(1, lit));
  return 0.35 + 0.65 * k;
}
