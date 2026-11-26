// IO of Westbay's jobs (./job.ts): the pay of a run and the review cards of the lines it missed. A run itself lives
// in memory only (features/town/jobs: a reload drops a job under way, nothing was paid yet), so the jobs add NO
// stored or synced key: the first run of a day is the job's id in the daily set `heard` of town-progress, xu go into
// its `earned` (as Rico's taxi fares do: ./taxiStore.ts), a missed line becomes its own review card `talk:<ref>`.

import { ensureReconciled, readReviewStore, recordReview } from '../review/api';
import { makeCardId } from '../review/ids';
import { jobPay, JOBS_PAID_A_DAY, type JobGrade } from './job';
import { CITY_JOBS } from '../../data/city/jobs';
import { addEarned, townDay, updateDaily } from './progress';
import { commitTown, loadTownProgress, townDevice } from './store';
import { scenesHeard } from './worldStore';
import { splitPay } from './crew';

/**
 * The job paid today already (on any browser), or the day's allowance of paid jobs is used up (JOBS_PAID_A_DAY,
 * docs/town.md §31): replays and jobs past the allowance pay nothing.
 */
export function jobPaidToday(jobId: string, now: number = Date.now()): boolean {
  const today = scenesHeard(loadTownProgress(), townDay(now));
  return today.includes(jobId) || today.filter((id) => id.startsWith('job-')).length >= JOBS_PAID_A_DAY;
}

/** A job's level (1 … 3; a harder job pays more: ./job.ts JOB_LEVEL_FACTOR); 2 when it is not known. */
export function jobLevel(jobId: string): 1 | 2 | 3 {
  return CITY_JOBS.find((j) => j.id === jobId)?.level ?? 2;
}

/** A run is over: its pay (0 when the job already paid today), written down. Never throws. */
export function payJob(jobId: string, grade: JobGrade, now: number = Date.now(), cut = 0): { xu: number; take: number } {
  try {
    const paid = jobPaidToday(jobId, now);
    // a crew member takes their cut first (core/town/crew.ts splitPay); the learner is paid the rest
    const { take, keep: xu } = splitPay(jobPay(grade, paid, jobLevel(jobId)), cut);
    if (paid) return { xu: 0, take: 0 };
    const device = townDevice();
    let next = updateDaily(loadTownProgress(), townDay(now), device, (d) => ({ ...d, heard: [...(d.heard ?? []), jobId] }), true);
    if (xu > 0) next = addEarned(next, device, xu);
    commitTown(next, now);
    return { xu, take };
  } catch {
    return { xu: 0, take: 0 };
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
