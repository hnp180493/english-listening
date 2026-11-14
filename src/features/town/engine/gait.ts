// How far one walk cycle carries somebody, so the engine can drive the cycle by the distance walked (sim.ts `phase`)
// and the feet do not slide: the player walks briskly, the residents stroll (two gaits of Kenney's walk, rendered by
// scripts/town-art; the manifest says what the feet cover on the rig), the cat has its own little legs.

import type { CharacterId } from '../art/cast';
import { CHARACTER_ART, type CharacterArtData } from '../art/characters.data';

/**
 * How much further than the feet cover the game moves a person per cycle. The player's brisk walk takes some slide
 * so it is not slow: 2.2 tiles/s on legs that cover 0.64 tile a cycle would be 3.4 cycles a second, a scamper; at
 * 1.4 the cadence is about 2.4 cycles a second and the slide does not read as skating. A resident strolls on their
 * own stride.
 */
export const GAIT_SLIP: Readonly<Record<string, number>> = { brisk: 1.4, stroll: 1.05 };

/**
 * The cat's walk (scripts/town-art/page/props.js: legs 0.165 long swinging ±0.55 rad, four of them in two pairs):
 * about 0.36 tile per cycle.
 */
export const CAT_STRIDE = 0.36;

/** Ground tiles one walk cycle of this person moves them. */
export function personStride(id: CharacterId, data: CharacterArtData = CHARACTER_ART): number {
  const gait = data.chars[id]?.gait ?? 'stroll';
  const g = data.gaits[gait];
  return (g?.noSlip ?? 0.5) * (GAIT_SLIP[gait] ?? 1);
}

/**
 * The walk is rendered riding a little over the idle's ground line, at one height through the cycle (the manifest's
 * gait `lift`, world px: a box shoe rocking on its corner would dig in otherwise). Walking at full pace it is drawn as
 * rendered; slowing to a stand it comes down by that much, so legs together on the spot stands on the idle's line
 * (no drop when the idle takes over, no hop when a walk starts). World px to draw the walk lower by, at pace `v` of
 * full pace `speed`.
 */
export function walkDrop(id: CharacterId, v: number, speed: number, data: CharacterArtData = CHARACTER_ART): number {
  const gait = data.chars[id]?.gait ?? 'stroll';
  const lift = data.gaits[gait]?.lift ?? 0;
  const k = speed > 0 ? Math.min(1, Math.max(0, v / speed)) : 0;
  return lift * (1 - k * k * (3 - 2 * k));
}
