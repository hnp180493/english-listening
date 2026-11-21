// How far one walk cycle carries somebody in the simulation (sim.ts `phase`: 2π per stride), so a walk can be
// timed by the distance walked: the player walks briskly, the residents stroll, the cat has its own little legs.
// The 3D characters plant their feet where the body really goes and step as the legs allow (three/chars/anim.ts);
// these numbers only shape the sim's own stepping (when a stride lands, when legs close at a stop).

import type { CharacterId } from './sim';

/** Ground tiles one walk cycle covers: the player's brisk walk, everybody else's stroll. */
export const STRIDE = { brisk: 0.9, stroll: 0.51 } as const;

/** The cat's walk: about 0.36 tile per cycle. */
export const CAT_STRIDE = 0.36;

/** Ground tiles one walk cycle of this person moves them. */
export function personStride(id: CharacterId): number {
  return id === 'player' ? STRIDE.brisk : STRIDE.stroll;
}
