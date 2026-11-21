// Game-art colours of the egg shop and the wardrobe (docs/design-system.md "Thị trấn: game art"): the eggs, the
// light of a hatching, the gem of each tier. Like engine/palette HUD_ART they are passed inline to SVG and canvas,
// never used for buttons, cards or text (the tier's NAME is always written beside its gem, in the theme's text colour).

import type { Rarity } from '../../../../data/townGame';

export interface TierArt {
  /** The gem and the burst of light. */
  gem: string;
  rim: string;
  /** The light rays of a hatching. */
  glow: string;
}

export const LOOT_TIER_ART: Readonly<Record<Rarity, TierArt>> = {
  thuong: { gem: '#9cc98a', rim: '#5f8f52', glow: '#e9f7d9' },
  hiem: { gem: '#6fb2f0', rim: '#3a78c0', glow: '#d8ecff' },
  quy: { gem: '#b48cf2', rim: '#7550c0', glow: '#efe2ff' },
  'huyen-thoai': { gem: '#ffcf4a', rim: '#d9951a', glow: '#fff3c4' },
};

/** The egg: a cream shell with speckles in the town's colours (like the kiosk's sign in the world). */
export const EGG_ART = {
  shell: '#fff6e0',
  shade: '#ecd9b4',
  outline: '#2e2440',
  speckles: ['#ef6b5b', '#3fb7a6', '#ffc93c', '#8f73d6'],
  crack: '#6b5a48',
} as const;
