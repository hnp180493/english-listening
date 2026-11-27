import { describe, expect, it } from 'vitest';
import { depositBack, depositId, depositJob, FAME_CALLS, fameOf, JOB_DEPOSITS, needsMissing } from './fame';
import { emptyTownJobs, recordJob } from './jobProgress';
import { townItem, owns } from './economy';
import { emptyTownProgress } from './progress';

const base = { met: [] as string[], bought: [] as string[], assetIds: ['asset-stall'], upgradeIds: ['office-map'] };

describe('fame: counted from what is kept, never down', () => {
  it('jobs by their best grade, dispatch calls by eights, assets and upgrades', () => {
    let jobs = emptyTownJobs();
    expect(fameOf({ ...base, jobs }).total).toBe(0);
    jobs = recordJob(jobs, 'job-m2', 'broken', [], 1);
    expect(fameOf({ ...base, jobs }).jobs).toBe(1);
    // a better replay raises it, a worse one never lowers it
    jobs = recordJob(jobs, 'job-m2', 'clean', [], 2);
    jobs = recordJob(jobs, 'job-m2', 'broken', [], 3);
    expect(fameOf({ ...base, jobs }).jobs).toBe(3);
    const met = Array.from({ length: FAME_CALLS * 2 + 3 }, (_, i) => `dc-${i}`).concat(['job-m2', 'dc-x']);
    expect(fameOf({ ...base, jobs, met }).calls).toBe(2);
    const f = fameOf({ ...base, jobs, met, bought: ['asset-stall', 'office-map', 'hideout'] });
    expect(f.assets).toBe(3);
    expect(f.total).toBe(3 + 2 + 3);
  });
});

describe('deposits and needs', () => {
  it('a deposit is a store item of the town with its job’s amount', () => {
    for (const [job, amount] of Object.entries(JOB_DEPOSITS)) {
      expect(depositJob(depositId(job))).toBe(job);
      expect(townItem(depositId(job))).toMatchObject({ kind: 'deposit', cost: amount });
      const p = { ...emptyTownProgress(), bought: [depositId(job)] };
      expect(owns(p, depositId(job))).toBe(true);
    }
    expect(depositJob('deposit-job-nothing')).toBeNull();
    expect(townItem('deposit-job-nothing')).toBeUndefined();
  });

  it('what is missing: fame short, deposit unpaid; nothing once done before, nothing in the sandbox', () => {
    const needs = { fame: 24, deposit: 300 };
    expect(needsMissing('job-warehouse', needs, { fame: 10, bought: [], done: false })).toEqual({ fame: 14, deposit: 300 });
    expect(needsMissing('job-warehouse', needs, { fame: 30, bought: [], done: false })).toEqual({ fame: 0, deposit: 300 });
    expect(needsMissing('job-warehouse', needs, { fame: 30, bought: [depositId('job-warehouse')], done: false })).toBeNull();
    expect(needsMissing('job-warehouse', needs, { fame: 0, bought: [], done: true })).toBeNull();
    expect(needsMissing('job-warehouse', needs, { fame: 0, bought: [], done: false, admin: true })).toBeNull();
    expect(needsMissing('job-warehouse', undefined, { fame: 0, bought: [], done: false })).toBeNull();
  });

  it('the deposit back: all of it, part when broken', () => {
    expect(depositBack(300, 'clean')).toBe(300);
    expect(depositBack(300, 'broken')).toBe(200);
  });
});
