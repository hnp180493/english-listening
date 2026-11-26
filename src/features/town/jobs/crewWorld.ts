// What opens a crew member now (core/town/crew.ts): hearts of friendship with a town resident (town-progress), the
// city scenes heard with a Westbay person (town-city). And the phone's contacts: everybody some job's crew can take.

import { crewOpen, type CrewWorld } from '../../../core/town/crew';
import { useTownCity } from '../../../core/town/cityStore';
import { friendHearts } from '../../../core/town/friendship';
import type { CrewRole, JobDoc } from '../../../core/town/jobDoc';
import { useTownProgress } from '../../../core/town/store';
import { ADMIN } from '../../../core/admin';

export function useCrewWorld(): CrewWorld {
  const progress = useTownProgress();
  const city = useTownCity();
  // the admin sandbox opens everybody
  return { hearts: (id) => (ADMIN ? 10 : friendHearts(progress, id)), heard: (id) => ADMIN || Object.hasOwn(city.heard, id) };
}

export interface Contact {
  who: string;
  /** What they do on the jobs that take them (Vietnamese). */
  roles: string[];
  open: boolean;
  hearts?: number;
  talks?: number;
}

/** The phone's contacts: every crew member of the jobs, open first. */
export function contactsOf(jobs: readonly JobDoc[], w: CrewWorld): Contact[] {
  const by = new Map<string, { role: CrewRole; roles: Set<string> }>();
  for (const d of jobs)
    for (const r of d.crew?.roles ?? []) {
      const c = by.get(r.who) ?? { role: r, roles: new Set<string>() };
      c.roles.add(r.role);
      by.set(r.who, c);
    }
  return [...by.entries()]
    .map(([who, c]) => ({ who, roles: [...c.roles], ...crewOpen(c.role, w) }))
    .sort((a, b) => Number(b.open) - Number(a.open) || a.who.localeCompare(b.who));
}
