// What opens a big job besides the story's chain (core/town/fame.ts, docs/gta-plan.md §5 "Mở khóa"): fame counted from
// what the learner has done, and a deposit paid down. A hook for the job engine (./useCityJob.tsx): the jobs of the chain
// that are next but still wait for fame or a deposit (they do not ring; their quest card says what is missing and opens
// the phone, where the deposit is paid), the learner's fame for the phone panel, and the xu in hand.

import { useMemo } from 'react';
import { ASSET_IDS } from '../../../core/town/assets';
import { balance } from '../../../core/town/economy';
import { fameOf, needsMissing, type Fame, type NeedsMissing } from '../../../core/town/fame';
import { useGameEar } from '../../../core/town/gameEarStore';
import { jobDone } from '../../../core/town/jobProgress';
import { useTownJobs } from '../../../core/town/jobsStore';
import { OFFICE_UPGRADES } from '../../../core/town/office';
import { useTownProgress } from '../../../core/town/store';
import type { JobDoc } from '../../../core/town/jobDoc';
import { tl } from '../../../i18n';

const UPGRADE_IDS = OFFICE_UPGRADES.map((u) => u.id);

export interface WaitingJob {
  id: string;
  title: string;
  from: string;
  missing: NeedsMissing;
  /** What the job asks in all (for the panel: "cần tiếng tăm 24"). */
  fame: number;
  deposit: number;
}

export interface JobNeedsNow {
  fame: Fame;
  xu: number;
  /** The next jobs held back by their needs (by id). */
  missing: ReadonlyMap<string, NeedsMissing>;
  waiting: readonly WaitingJob[];
}

export function useJobNeeds(open: readonly JobDoc[], admin: boolean): JobNeedsNow {
  const jobs = useTownJobs();
  const progress = useTownProgress();
  const ear = useGameEar();
  return useMemo(() => {
    const fame = fameOf({ jobs, met: Object.keys(ear.met), bought: progress.bought, assetIds: ASSET_IDS, upgradeIds: UPGRADE_IDS });
    const missing = new Map<string, NeedsMissing>();
    const waiting: WaitingJob[] = [];
    for (const d of open) {
      const m = needsMissing(d.id, d.needs, { fame: fame.total, bought: progress.bought, done: jobDone(jobs, d.id), admin });
      if (!m) continue;
      missing.set(d.id, m);
      waiting.push({ id: d.id, title: d.title, from: d.from, missing: m, fame: d.needs?.fame ?? 0, deposit: d.needs?.deposit ?? 0 });
    }
    return { fame, xu: balance(progress), missing, waiting };
  }, [jobs, progress, ear, open, admin]);
}

/** What a quest card says of a job still waiting ("Cần tiếng tăm 24 · Cần đặt cọc 300 xu"; how much the learner has: the phone). */
export function needsStep(w: WaitingJob): string {
  const parts: string[] = [];
  if (w.missing.fame > 0) parts.push(tl`Cần tiếng tăm ${w.fame}`);
  if (w.missing.deposit > 0) parts.push(tl`Cần đặt cọc ${w.missing.deposit} xu`);
  return parts.join(' · ');
}
