// A small diamond in a fish tier's colour (game art): beside the tier's name, never instead of it.

import type { Rarity } from '../../../../data/townGame';
import { TIER_ART } from './fishArt';

export function TierGem({ tier, size = 12 }: { tier: Rarity; size?: number }) {
  return (
    <svg className="town-fish-gem" width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M6 0.8 L11.2 6 L6 11.2 L0.8 6 Z" style={{ fill: TIER_ART[tier].body, stroke: TIER_ART[tier].fin }} strokeWidth="1.2" />
    </svg>
  );
}
