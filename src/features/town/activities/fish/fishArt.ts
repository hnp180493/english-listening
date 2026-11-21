// The pond's own little pictures (game art, docs/design-system.md "Thị trấn: game art"): the colours of the fish
// tiers and the shape of each species. Like engine/palette HUD_ART they are passed inline to SVG, never used for
// text, buttons or cards; each is a CSS light-dark() pair so day (light theme) and night (dark theme) both read.

import type { Phenomenon } from '../../../../core/types';
import { FISH_SPECIES, RARITIES, type FishSpecies, type Rarity } from '../../../../data/townGame';

/** A colour for day and night: `light-dark(day, night)` (needs the page's color-scheme, set in index.css). */
const ld = (day: string, night: string): string => `light-dark(${day}, ${night})`;

export interface TierArt {
  /** The fish's body. */
  body: string;
  /** Belly, fins' light edge. */
  belly: string;
  /** Fins, tail, pattern. */
  fin: string;
  /** The shadow under the water while it circles the float (a hint of the tier before it bites). */
  shadow: string;
  /** Size of the fish against a thường one (the shadow and the sprite). */
  scale: number;
}

export const TIER_ART: Readonly<Record<Rarity, TierArt>> = {
  thuong: { body: ld('#7f97ad', '#8fa6bd'), belly: ld('#dfe8ef', '#c9d6e2'), fin: ld('#5d7489', '#6f879d'), shadow: ld('#24425e', '#04101c'), scale: 0.82 },
  hiem: { body: ld('#2f8fd8', '#4ba6ec'), belly: ld('#d5ecfb', '#bfe0f7'), fin: ld('#1f6aa6', '#2f86c9'), shadow: ld('#123d66', '#020c18'), scale: 1 },
  quy: { body: ld('#9a5ae0', '#ad78ee'), belly: ld('#efe2fd', '#e0cdf8'), fin: ld('#7238b6', '#8a55cf'), shadow: ld('#3a1d5e', '#0a0418'), scale: 1.16 },
  'huyen-thoai': { body: ld('#f0a90c', '#ffbf2e'), belly: ld('#fff3cf', '#ffeab0'), fin: ld('#c9780a', '#e0900f'), shadow: ld('#5b3a05', '#1a0e00'), scale: 1.34 },
};

/** The pond scene (water, reeds, lily pads, the float, the line). */
export const POND_ART = {
  waterTop: ld('#bfe2f5', '#24507a'),
  waterDeep: ld('#8cc6e8', '#16304d'),
  ripple: ld('#ffffff', '#7fb2d9'),
  bank: ld('#a8d59a', '#2e5a3c'),
  bankDark: ld('#7fbf72', '#234a30'),
  reed: ld('#4f9a5e', '#3d7a4c'),
  cattail: ld('#8a5a33', '#6b4a30'),
  pad: ld('#5fae6b', '#3c8350'),
  padDark: ld('#438f52', '#2d6a40'),
  flower: ld('#ff9fbd', '#e98aa8'),
  line: ld('#5b6470', '#a9b3c2'),
  rod: ld('#4a3a2c', '#b08a62'),
  floatTop: ld('#ef4b4b', '#ff6b6b'),
  floatBottom: ld('#ffffff', '#e8ecf2'),
  floatRing: ld('#3b414b', '#2a2f38'),
  splash: ld('#ffffff', '#cfe6ff'),
  glow: ld('#fff2b0', '#ffd75e'),
  silhouette: ld('#b9c3cf', '#3a4459'),
  silhouetteInk: ld('#8792a2', '#5d6880'),
} as const;

/** The pattern on a species' side. */
export type FishPattern = 'plain' | 'stripes' | 'spots' | 'band' | 'scales';

export interface FishShape {
  /** Body length / height ratio: a long eel-like fish or a round one. */
  stretch: number;
  pattern: FishPattern;
  /** A tall dorsal fin (else a low one). */
  tallFin: boolean;
  /** Whiskers (catfish, carp). */
  whiskers: boolean;
  /** A forked tail (else a round fan). */
  forked: boolean;
}

const PATTERN_OF: Readonly<Record<Phenomenon, FishPattern>> = {
  linking: 'band',
  'weak-form': 'plain',
  'flap-t': 'spots',
  reduction: 'stripes',
  elision: 'scales',
  assimilation: 'band',
  'h-dropping': 'spots',
  contraction: 'stripes',
};

/** Words in a species name that say what the fish looks like (Vietnamese fish everyone knows). */
const LONG = ['Chình', 'Lóc', 'Kiếm', 'Rồng', 'Ngừ'];
const ROUND = ['Rô', 'Mú', 'Bống', 'Đuối', 'Koi', 'Chép'];
const WHISKERS = ['Trê', 'Chép', 'Koi', 'Rồng'];

/** The look of one species (stable: from its name, tier and phenomenon only). */
export function fishShape(species: Pick<FishSpecies, 'name' | 'tier' | 'phenomenon'>): FishShape {
  const has = (words: readonly string[]) => words.some((w) => species.name.split(/\s+/).includes(w));
  const stretch = has(LONG) ? 3.1 : has(ROUND) ? 1.9 : 2.4;
  return {
    stretch,
    pattern: species.tier === 'huyen-thoai' ? 'scales' : PATTERN_OF[species.phenomenon] ?? 'plain',
    tallFin: species.tier === 'quy' || species.tier === 'huyen-thoai' || has(['Kiếm', 'Rô']),
    whiskers: has(WHISKERS),
    forked: !has(ROUND) || species.tier === 'huyen-thoai',
  };
}

/** Every species has a look, and the tiers have their art (checked by the tests). */
export const ART_SPECIES = FISH_SPECIES;
export const ART_TIERS = RARITIES;
