// IO of Westbay's jobs (./job.ts): the pay of a run and the review cards of the lines it missed. A run itself lives
// in memory only (features/town/jobs: a reload drops a job under way, nothing was paid yet), so the jobs add NO
// stored or synced key: the first run of a day is the job's id in the daily set `heard` of town-progress, xu go into
// its `earned` (as Rico's taxi fares do: ./taxiStore.ts), a missed line becomes its own review card `talk:<ref>`.

import { ensureReconciled, readReviewStore, recordReview } from '../review/api';
import { makeCardId } from '../review/ids';
import { jobPay, type JobGrade } from './job';
import { addEarned, townDay, updateDaily } from './progress';
import { commitTown, loadTownProgress, townDevice } from './store';
import { scenesHeard } from './worldStore';

/** The job paid today already (on any browser): replays pay nothing. */
export function jobPaidToday(jobId: string, now: number = Date.now()): boolean {
  return scenesHeard(loadTownProgress(), townDay(now)).includes(jobId);
}

/** A run is over: its pay (0 when the job already paid today), written down. Never throws. */
export function payJob(jobId: string, grade: JobGrade, now: number = Date.now()): number {
  try {
    const paid = jobPaidToday(jobId, now);
    const xu = jobPay(grade, paid);
    if (paid) return 0;
    const device = townDevice();
    let next = updateDaily(loadTownProgress(), townDay(now), device, (d) => ({ ...d, heard: [...(d.heard ?? []), jobId] }), true);
    if (xu > 0) next = addEarned(next, device, xu);
    commitTown(next, now);
    return xu;
  } catch {
    return 0;
  }
}

/**
 * The lines missed (review refs) become review cards `talk:<ref>`, as a missed line of a town episode does. A card
 * that exists is never touched (a job is a game: it must not move a schedule the learner earned in a real exercise).
 * Returns how many were enrolled. Never throws.
 */
export function enrolJobMisses(refs: readonly string[], now: number = Date.now()): number {
  let n = 0;
  try {
    ensureReconciled(now);
    const cards = readReviewStore(now).cards;
    for (const ref of refs) {
      const id = makeCardId('talk', ref);
      if (Object.prototype.hasOwnProperty.call(cards, id)) continue;
      const r = recordReview(id, 'again', { ctx: 'practice', enrol: true, now });
      if (r.reason === 'enrolled') n++;
    }
  } catch {
    // review cards are best effort; the job is already over
  }
  return n;
}
