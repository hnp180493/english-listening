// The crew of a Westbay job (docs/gta-plan.md §4.3, §17): before a job that allows it the learner picks who comes along
// from the people they are close enough to. Each one changes the KIND of listening in the job (the steps and lines
// that are theirs: Cond `crew` in core/town/jobDoc.ts) and takes a cut of the pay. What opens someone: a town resident
// by hearts of friendship (core/town/friendship.ts); a Westbay person by the city scenes heard with them (town-city:
// there are no hearts up there). Pure: the hearts and the scenes heard come in as functions.

import type { CrewRole } from './jobDoc';

/**
 * The cuts a crew member can take, by name, so the economy can tune them in one place (a job's crew uses these, never a
 * bare number): a friend helping out, a fair share, a big part.
 */
export const CREW_CUT = { friend: 0.1, share: 0.2, big: 0.3 } as const;

export interface CrewWorld {
  /** Hearts of friendship with a town resident (0–10). */
  hearts: (placeId: string) => number;
  /** Whether a city scene has been heard. */
  heard: (sceneId: string) => boolean;
}

/** Whether a role is open now, and, when not, what is still needed (the hearts missing, or how many talks). */
export function crewOpen(role: CrewRole, w: CrewWorld): { open: boolean; hearts?: number; talks?: number } {
  if ('hearts' in role.opens) {
    const have = w.hearts(role.who);
    return have >= role.opens.hearts ? { open: true } : { open: false, hearts: role.opens.hearts };
  }
  const missing = role.opens.heard.filter((s) => !w.heard(s)).length;
  return missing === 0 ? { open: true } : { open: false, talks: missing };
}

/** What a crew member takes of the pay, and what is left for the learner (whole xu; the learner keeps the rounding). */
export function splitPay(pay: number, cut: number): { take: number; keep: number } {
  const take = Math.max(0, Math.min(pay, Math.floor(pay * cut)));
  return { take, keep: pay - take };
}
