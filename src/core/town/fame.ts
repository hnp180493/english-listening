// "Tiếng tăm" and the deposits of the big jobs (docs/gta-plan.md §5 "Mở khóa": "Không chờ theo ngày. Mở bằng tiếng
// tăm và tiền góp vốn (ví dụ phải có 300 xu đặt cọc cho Kho 15)"; docs/town.md §34). Pure.
//
// Fame is never stored: it is counted from what is already kept, and none of it ever goes down, so a job once opened
// never shuts again:
//   - each job done (town-jobs `done`), by its best grade: clean 3, messy 2, broken 1;
//   - Rico's dispatch office: 1 for every 8 calls met (town-ear `met`, the ids `dc-<n>`: a call is met once);
//   - each of the learner's assets (./assets.ts, town-progress `bought`) 2, each upgrade of the office 1.
// It is a game score, never a measure of the learner's English (gta-plan §2.5).
//
// A deposit is a store item of the town (`deposit-<job id>` in town-progress `bought`, its cost counted as spent by
// ./economy, like the hideout's): paid once, it opens the job; the first time the job is done the deposit comes back
// as xu earned (all of it, or DEPOSIT_KEPT_BROKEN of it when the job ended broken), never again on a replay. A job
// already done is never shut by its needs (it was played before the needs existed, or the learner paid then).
//
// Every number here is a GUESS until somebody really plays.

import type { JobGrade } from './job';
import type { TownJobs } from './jobProgress';

/** Fame of a job done, by its best grade. */
export const FAME_GRADE: Readonly<Record<JobGrade, number>> = { clean: 3, messy: 2, broken: 1 };
/** Dispatch calls met for 1 fame (a shift is eight). */
export const FAME_CALLS = 8;
/** Fame of an asset owned, of an office upgrade owned. */
export const FAME_ASSET = 2;
export const FAME_UPGRADE = 1;

/** The deposits of the big jobs (xu): the one source of the numbers (the job documents read them from here). */
// "Kho 15": the plan's own example; "Cửa nước": the ferry's launch is borrowed, so Captain Odile asks a deposit for it
export const JOB_DEPOSITS: Readonly<Record<string, number>> = {
  'job-water': 150,
  'job-warehouse': 300,
};
/**
 * The fame the big jobs ask: the one source of the numbers (the job documents read them from here). The rule, checked
 * against the real chain by data/city/jobs/jobs.test.ts: a weak listener is never shut out. A learner who played only
 * the story and whose every job ended broken (1 each) has 17 at Kho 15 and 23 at the finale, so they are asked for a
 * little more (3, then 7 in all: at most FAME_ASK_MAX), which a few jobs played again for a better grade, a side
 * chain, the dispatch office or an asset give; whoever ends "messy" on average passes on the story alone. (They were
 * 24 and 40 until 2026-11-27: the finale then asked that learner for 17 more.)
 */
export const JOB_FAME: Readonly<Record<string, number>> = {
  'job-warehouse': 20,
  'job-live': 30,
};
/** The most a fame gate may ask beyond the story's own jobs all ended broken. */
export const FAME_ASK_MAX = 8;
/** The share of a deposit that comes back when the job ended broken (the rest is lost). */
export const DEPOSIT_KEPT_BROKEN = 2 / 3;

export interface JobNeeds {
  /** Fame needed (counted, never paid). */
  fame?: number;
  /** Xu paid down before the job opens (JOB_DEPOSITS). */
  deposit?: number;
}

/** What fame is counted from. */
export interface FameInput {
  jobs: TownJobs;
  /** Ids met in the game (town-ear `met`): the dispatch calls among them count. */
  met: readonly string[];
  /** What the town's store sold (town-progress `bought`). */
  bought: readonly string[];
  /** The learner's asset ids (./assets.ts ASSETS) and the office's upgrade ids (./office.ts), to tell them in `bought`. */
  assetIds: readonly string[];
  upgradeIds: readonly string[];
}

export interface Fame {
  total: number;
  /** Its parts (the phone panel says where it comes from). */
  jobs: number;
  calls: number;
  assets: number;
}

export function fameOf(i: FameInput): Fame {
  let jobs = 0;
  for (const rec of Object.values(i.jobs.done)) jobs += FAME_GRADE[rec.best] ?? 0;
  const calls = Math.floor(i.met.filter((id) => /^dc-\d+$/.test(id)).length / FAME_CALLS);
  const assets = i.bought.filter((id) => i.assetIds.includes(id)).length * FAME_ASSET + i.bought.filter((id) => i.upgradeIds.includes(id)).length * FAME_UPGRADE;
  return { total: jobs + calls + assets, jobs, calls, assets };
}

/** The store item of a job's deposit. */
export const depositId = (jobId: string): string => `deposit-${jobId}`;
/** The job a deposit item is for (null: not a deposit, or a job without one). */
export function depositJob(itemId: string): string | null {
  if (!itemId.startsWith('deposit-')) return null;
  const job = itemId.slice('deposit-'.length);
  return Object.hasOwn(JOB_DEPOSITS, job) ? job : null;
}

/** What still stands between the learner and a job: fame missing, a deposit not paid. Nothing when it is open. */
export interface NeedsMissing {
  fame: number;
  deposit: number;
}

export function needsMissing(
  jobId: string,
  needs: JobNeeds | undefined,
  s: { fame: number; bought: readonly string[]; done: boolean; admin?: boolean },
): NeedsMissing | null {
  if (!needs || s.done || s.admin) return null;
  const fame = Math.max(0, (needs.fame ?? 0) - s.fame);
  const deposit = needs.deposit && !s.bought.includes(depositId(jobId)) ? needs.deposit : 0;
  return fame > 0 || deposit > 0 ? { fame, deposit } : null;
}

/** The xu a deposit gives back the first time its job is done (0: no deposit paid, or done before). */
export function depositBack(deposit: number, grade: JobGrade): number {
  return grade === 'broken' ? Math.round(deposit * DEPOSIT_KEPT_BROKEN) : deposit;
}
