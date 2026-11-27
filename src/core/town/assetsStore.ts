// IO of the learner's assets (./assets.ts), of fame and of the big jobs' deposits (./fame.ts). Nothing new is stored or
// synced: an asset and a deposit are store items of the town (ids in town-progress `bought`, bought through ./store
// buyTownItem, their cost counted by ./economy spentTotal; the merge keeps every id ever bought); a report heard is
// `as-<asset>-<game day>` in the day's set `heard`, its xu in `earned`; a deposit given back is xu earned once, the
// first time its job is done. Fame is counted from town-jobs, town-ear and town-progress, never kept.

import { ASSET_IDS, ASSETS, asset, assetPay, assetReport, ownedAssets, reportDue, reportId, SPONSOR_LINE, type AssetId, type AssetReport } from './assets';
import { depositBack, depositId, fameOf, JOB_DEPOSITS, needsMissing, type Fame, type JobNeeds, type NeedsMissing } from './fame';
import { loadGameEar } from './gameEarStore';
import type { JobGrade } from './job';
import { jobDone } from './jobProgress';
import { loadTownJobs } from './jobsStore';
import { gameDayOf, OFFICE_UPGRADES } from './office';
import { addEarned, townDay, updateDaily } from './progress';
import { buyTownItem, commitTown, loadTownProgress, townDevice, type TownBuyResult } from './store';
import { scenesHeard } from './worldStore';

const UPGRADE_IDS = OFFICE_UPGRADES.map((u) => u.id);

export interface AssetNow {
  id: AssetId;
  owned: boolean;
  /** This game day's report, when it waits (owned, not heard, the day's allowance not used up). */
  report: AssetReport | null;
}

/** Each asset: owned or not, and its report when one waits. */
export function assetsNow(now: number = Date.now()): AssetNow[] {
  const progress = loadTownProgress();
  const owned = ownedAssets(progress.bought);
  const heard = scenesHeard(progress, townDay(now));
  const gameDay = gameDayOf(now);
  return ASSETS.map((a) => {
    const has = owned.includes(a.id);
    return { id: a.id, owned: has, report: has && reportDue(a, heard, now) ? assetReport(a.id, gameDay) : null };
  });
}

/** Buy an asset with xu (refused when short, owned or unknown: nothing written). */
export function buyAsset(id: AssetId): TownBuyResult {
  return buyTownItem(id);
}

/** A report heard and answered (`wrong`: 0, 1 or 2 things misheard): the takings paid. 0 when not due. Never throws. */
export function payReport(id: AssetId, gameDay: number, wrong: number, now: number = Date.now()): number {
  try {
    const a = asset(id);
    if (!a) return 0;
    const progress = loadTownProgress();
    const day = townDay(now);
    if (!progress.bought.includes(a.id) || !reportDue(a, scenesHeard(progress, day), now) || gameDay !== gameDayOf(now)) return 0;
    const xu = assetPay(a.takings, wrong);
    const device = townDevice();
    let next = updateDaily(progress, day, device, (d) => ({ ...d, heard: [...(d.heard ?? []), reportId(a, gameDay)] }), true);
    if (xu > 0) next = addEarned(next, device, xu);
    commitTown(next, now);
    return xu;
  } catch {
    return 0;
  }
}

/**
 * The line Marcus reads on Bay FM once the sponsorship is bought ("this hour … comes to you with the help of Rico's
 * cars"); null before. The radio's bulletin calls it (the radio's own files are another session's). Never throws.
 */
export function sponsorLine(): { text: string; vi: string } | null {
  try {
    return loadTownProgress().bought.includes('asset-sponsor') ? { ...SPONSOR_LINE } : null;
  } catch {
    return null;
  }
}

// ───────────────────────── fame and deposits ─────────────────────────

/** The learner's fame now (./fame.ts), counted from what is kept. Never throws (0 when nothing can be read). */
export function fameNow(): Fame {
  try {
    return fameOf({ jobs: loadTownJobs(), met: Object.keys(loadGameEar().met), bought: loadTownProgress().bought, assetIds: ASSET_IDS, upgradeIds: UPGRADE_IDS });
  } catch {
    return { total: 0, jobs: 0, calls: 0, assets: 0 };
  }
}

/** What a job still needs (fame, a deposit): null when it is open (or done before, or in the admin sandbox). */
export function jobNeedsNow(jobId: string, needs: JobNeeds | undefined, admin = false): NeedsMissing | null {
  if (!needs) return null;
  try {
    return needsMissing(jobId, needs, { fame: fameNow().total, bought: loadTownProgress().bought, done: jobDone(loadTownJobs(), jobId), admin });
  } catch {
    return null;
  }
}

/** Pay a job's deposit (refused when short, paid already or not a job with one). */
export function payDeposit(jobId: string): TownBuyResult {
  return buyTownItem(depositId(jobId));
}

/**
 * The deposit back, the first time its job is done (call it BEFORE the run is written as done: `firstTime` is read
 * by the caller then). All of it, or part when the job ended broken. Returns the xu given back (0: none). Never throws.
 */
export function returnDeposit(jobId: string, grade: JobGrade, firstTime: boolean, now: number = Date.now()): number {
  try {
    const deposit = JOB_DEPOSITS[jobId];
    if (!firstTime || !deposit) return 0;
    const progress = loadTownProgress();
    if (!progress.bought.includes(depositId(jobId))) return 0;
    const xu = depositBack(deposit, grade);
    if (xu > 0) commitTown(addEarned(progress, townDevice(), xu), now);
    return xu;
  } catch {
    return 0;
  }
}
