// The street talk of a resident met out in the town (docs/town.md §14), pure: which of their talks comes up, and how it
// becomes the turns of a conversation (their lines are the checks; the learner's line before each sits with it).

import type { StreetTalk } from './streetTalkTypes';
import type { TownLine } from './types';

/** The learner's own line said just before one of the resident's (shown, said in the player's voice). */
export interface StreetBefore {
  text: string;
  vi: string;
}

export interface StreetPlanTurn {
  line: TownLine;
  before?: StreetBefore;
}

/** A street talk line's id: `<talk id>-<k>` (k from 1 over every line). */
export const streetLineId = (talk: Pick<StreetTalk, 'id'>, k: number): string => `${talk.id}-${k}`;

/** The resident's lines as checks, each with the learner's line said just before it. */
export function streetPlan(talk: StreetTalk): StreetPlanTurn[] {
  const out: StreetPlanTurn[] = [];
  let before: StreetBefore | undefined;
  talk.lines.forEach((l, i) => {
    if (l.who === 'you') {
      before = { text: l.text, vi: l.vi };
      return;
    }
    out.push({ line: { id: streetLineId(talk, i + 1), text: l.text, vi: l.vi, level: talk.level }, ...(before ? { before } : {}) });
    before = undefined;
  });
  return out;
}

/** Talks this learner can have with them now: hearts and known facts open the later ones. */
export function openStreetTalks(talks: readonly StreetTalk[], hearts: number, knows: (fact: string) => boolean): StreetTalk[] {
  return talks.filter((t) => (t.minHearts ?? 0) <= hearts && (!t.fact || knows(t.fact)));
}

/**
 * The talk that comes up: one built on something you know about them, or a friendlier one, before the plain ones
 * while it has not been heard; else the one heard least (`tries`: how often a line was answered). Null: none.
 */
export function pickStreetTalk(talks: readonly StreetTalk[], hearts: number, knows: (fact: string) => boolean, tries: (lineId: string) => number): StreetTalk | null {
  const open = openStreetTalks(talks, hearts, knows);
  if (open.length === 0) return null;
  const heard = (t: StreetTalk) => streetPlan(t).reduce((n, p) => n + tries(p.line.id), 0);
  const rank = (t: StreetTalk) => (t.fact ? 0 : t.minHearts ? 1 : 2);
  return [...open].sort((a, b) => heard(a) - heard(b) || rank(a) - rank(b) || (a.id < b.id ? -1 : 1))[0];
}
