// A small diamond in a loot tier's colour (game art): beside the tier's name, never instead of it.

import type { Rarity } from '../../../../data/townGame';
import { LOOT_TIER_ART } from './eggArt';

export function TierGem({ tier, size = 12 }: { tier: Rarity; size?: number }) {
  const a = LOOT_TIER_ART[tier];
  return (
    <svg className="town-egg-gem" width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M6 0.8 L11.2 6 L6 11.2 L0.8 6 Z" style={{ fill: a.gem, stroke: a.rim }} strokeWidth="1.2" />
    </svg>
  );
}
