// The pirate station 91.5 as a channel of the listen panel (docs/town.md §25, docs/gta-story-3.md §7 item 6). It lives in
// Westbay's chunk: the city page hands it to the vehicle's radio (scenes/CarRadio `pirateOn`) and to the listen panel
// (scenes/ListenPanel `channel`), so its 15 tapes and their rules (data/scenes/pirate.ts, core/town/pirate.ts) never
// load with the town.

import { ADMIN } from '../../../core/admin';
import { loadTownJobs } from '../../../core/town/jobsStore';
import { pirateEnding, pirateNow, pirateSegments, pirateState } from '../../../core/town/pirate';
import { PIRATE_SEGMENTS, PIRATE_SILENT, type PirateSegment } from '../../../data/scenes/pirate';
import type { ListenChannel } from '../scenes/ListenPanel';
import { PIRATE_RADIO } from '../scenes/things';

/** Whether the vehicle's radio offers 91.5 now (on while Act III is, silent after it; never before). */
export function pirateOn(): boolean {
  try {
    return pirateState(loadTownJobs(), ADMIN) !== 'off';
  } catch {
    return false;
  }
}

export const PIRATE_CHANNEL: ListenChannel = {
  focus: PIRATE_RADIO,
  pick: (now, recent) => {
    const jobs = loadTownJobs();
    if (pirateState(jobs, ADMIN) !== 'on') return null;
    return pirateNow(pirateSegments(PIRATE_SEGMENTS, jobs, ADMIN), recent, now);
  },
  // why the tape was real, or what gave it away
  after: (scene) => ('why' in scene ? (scene as PirateSegment).why : null),
  empty: () => {
    const jobs = loadTownJobs();
    return pirateState(jobs, ADMIN) === 'ended' ? PIRATE_SILENT[pirateEnding(jobs)] : 'Chín mốt phẩy năm chỉ có tiếng rè.';
  },
};
