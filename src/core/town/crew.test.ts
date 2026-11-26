import { describe, expect, it } from 'vitest';
import { CREW_CUT, crewOpen, splitPay } from './crew';
import type { CrewRole } from './jobDoc';

const W = { hearts: (id: string) => (id === 'phone' ? 2 : 5), heard: (id: string) => id === 'ct-jun-1' };
const role = (r: Partial<CrewRole>): CrewRole => ({ who: 'jun', role: 'R', listen: 'L', opens: { heard: ['ct-jun-1'] }, cut: CREW_CUT.share, ...r });

describe('the crew', () => {
  it('opens a Westbay person by the scenes heard with them, a town resident by hearts', () => {
    expect(crewOpen(role({}), W)).toEqual({ open: true });
    expect(crewOpen(role({ opens: { heard: ['ct-jun-1', 'ct-jun-2', 'ct-jun-3'] } }), W)).toEqual({ open: false, talks: 2 });
    expect(crewOpen(role({ who: 'phone', opens: { hearts: 3 } }), W)).toEqual({ open: false, hearts: 3 });
    expect(crewOpen(role({ who: 'station', opens: { hearts: 3 } }), W)).toEqual({ open: true });
  });

  it('takes its cut in whole xu; the learner keeps the rounding; the cuts are named', () => {
    expect(splitPay(77, CREW_CUT.share)).toEqual({ take: 15, keep: 62 });
    expect(splitPay(0, CREW_CUT.big)).toEqual({ take: 0, keep: 0 });
    expect(splitPay(10, 0)).toEqual({ take: 0, keep: 10 });
    for (const c of Object.values(CREW_CUT)) expect(c > 0 && c <= 0.5).toBe(true);
  });
});
