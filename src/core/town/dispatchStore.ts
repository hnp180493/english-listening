// IO of Rico's dispatch office (./dispatch.ts): whether it is open, what a shift pays, the review cards of the calls
// heard wrong, and Bay FM's news about the night. A shift itself lives in memory (features/town/dispatch: a reload
// drops it, nothing was paid yet), so the office adds NO stored or synced key: a paid shift is `dp-shift-<n>` in the
// daily set `heard` of town-progress (two a day), its xu go into `earned` (as Rico's taxi fares do: ./taxiStore.ts),
// a call heard wrong becomes its own review card `talk:disp-<call id>` (./jobStore.ts enrolJobMisses).

import { ADMIN } from '../admin';
import { NEWS_LINES } from '../../data/city/dispatch/lines';
import { shiftNews, shiftPay, type ShiftSummary } from './dispatch';
import { enrolJobMisses } from './jobStore';
import { addEarned, townDay, updateDaily } from './progress';
import { queueRadioNews } from './radioNews';
import { commitTown, loadTownProgress, townDevice } from './store';
import type { TownCity } from './city';
import { scenesHeard } from './worldStore';

/** The chapter after which Gus offers Rico the old gatehouse (data/city/seasonsMain2.ts). */
export const OFFICE_OPENS_AFTER = 'cs-bigdeal-6';

/** The office is open once the main story's second part was heard through (at once in the admin sandbox). */
export function dispatchOpen(city: TownCity): boolean {
  return ADMIN || Object.hasOwn(city.heard, OFFICE_OPENS_AFTER);
}

/** The ids of today's paid shifts and the calls heard today (`heard`, every browser). */
export function dispatchToday(now: number = Date.now()): string[] {
  return scenesHeard(loadTownProgress(), townDay(now)).filter((id) => id.startsWith('dp-'));
}

/** Shifts paid today. */
export function shiftsPaidToday(now: number = Date.now()): number {
  return dispatchToday(now).filter((id) => id.startsWith('dp-shift-')).length;
}

export interface ShiftEnd {
  xu: number;
  capped: boolean;
  enrolled: number;
  news: 'good' | 'bad' | null;
}

/** A shift is over: pay it (within the day's allowance), enrol the calls heard wrong, queue Bay FM's line. Never throws. */
export function endShift(sum: ShiftSummary, missed: readonly string[], now: number = Date.now()): ShiftEnd {
  let xu = 0;
  let capped = false;
  try {
    const pay = shiftPay(sum.xu, dispatchToday(now));
    capped = pay.capped;
    // (a shift that earned nothing does not use up one of the day's two)
    if (pay.id && pay.xu > 0) {
      const device = townDevice();
      let next = updateDaily(loadTownProgress(), townDay(now), device, (d) => ({ ...d, heard: [...(d.heard ?? []), pay.id!] }), true);
      if (pay.xu > 0) next = addEarned(next, device, pay.xu);
      commitTown(next, now);
      xu = pay.xu;
    }
  } catch {
    // pay is best effort; the shift is over all the same
  }
  const enrolled = enrolJobMisses(missed, now);
  const news = shiftNews(sum, sum.results.length);
  if (news) queueRadioNews({ id: `dispatch-${news}`, lines: NEWS_LINES[news].map((l) => ({ text: l.text, vi: l.vi })) }, now);
  return { xu, capped, enrolled, news };
}
