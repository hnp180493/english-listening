import { describe, expect, it } from 'vitest';
import { emptyTownJobs, grantClueTo, hasClue, jobDone, jobUnlocked, mergeTownJobs, parseTownJobs, pastFlag, recordJob } from './jobProgress';

const T0 = 1_800_000_000_000;

describe('what the jobs remember', () => {
  it('records a run: first time, best grade, times, last, flags', () => {
    let s = recordJob(emptyTownJobs(), 'job-m2', 'messy', ['hit:late', 'kemp-asks-again'], T0);
    expect(s.done['job-m2']).toEqual({ first: T0, best: 'messy', times: 1, last: T0, flags: ['hit:late', 'kemp-asks-again'] });
    s = recordJob(s, 'job-m2', 'clean', [], T0 + 5);
    expect(s.done['job-m2']).toEqual({ first: T0, best: 'clean', times: 2, last: T0 + 5, flags: ['hit:late', 'kemp-asks-again'] });
    s = recordJob(s, 'job-m2', 'broken', ['hit:gone'], T0 + 9);
    expect(s.done['job-m2'].best).toBe('clean');
    expect(s.done['job-m2'].flags).toContain('hit:gone');
  });

  it('opens a job once the one before it is done; the sandbox opens all', () => {
    const s = recordJob(emptyTownJobs(), 'job-m2', 'broken', [], T0);
    expect(jobUnlocked({}, emptyTownJobs())).toBe(true);
    expect(jobUnlocked({ after: 'job-m2' }, emptyTownJobs())).toBe(false);
    expect(jobUnlocked({ after: 'job-m2' }, s)).toBe(true);
    expect(jobUnlocked({ after: 'job-half5' }, s)).toBe(false);
    expect(jobUnlocked({ after: 'job-half5' }, s, true)).toBe(true);
    expect(jobDone(s, 'job-m2')).toBe(true);
  });

  it('reads a flag an earlier job left', () => {
    const s = recordJob(emptyTownJobs(), 'job-m2', 'messy', ['hit:late'], T0);
    expect(pastFlag(s, 'job-m2:hit:late')).toBe(true);
    expect(pastFlag(s, 'job-m2:hit:gone')).toBe(false);
    expect(pastFlag(s, 'job-x:hit:late')).toBe(false);
    expect(pastFlag(s, 'nonsense')).toBe(false);
  });

  it('drops junk when parsing', () => {
    expect(parseTownJobs(null)).toEqual(emptyTownJobs());
    expect(parseTownJobs({ done: { 'job-m2': { first: 0, best: 'clean' }, 'Bad Id': { first: T0, best: 'clean' }, 'job-a': { first: T0, best: 'super' } } })).toEqual(emptyTownJobs());
    expect(parseTownJobs({ done: { 'job-a': { first: T0, best: 'clean', times: 3, last: 1, flags: ['x', 'x', 7] } } }).done['job-a']).toEqual({ first: T0, best: 'clean', times: 3, last: T0, flags: ['x'] });
  });

  it('merges two copies: earlier first, better grade, more times, later last, union of flags', () => {
    const a = recordJob(emptyTownJobs(), 'job-m2', 'messy', ['a'], T0 + 2);
    const b = recordJob(recordJob(emptyTownJobs(), 'job-m2', 'clean', ['b'], T0), 'job-m2', 'broken', [], T0 + 9);
    expect(mergeTownJobs(a, b).done['job-m2']).toEqual({ first: T0, best: 'clean', times: 2, last: T0 + 9, flags: ['a', 'b'] });
    expect(mergeTownJobs(a, b)).toEqual(mergeTownJobs(b, a));
    expect(mergeTownJobs(a, a)).toEqual(a);
  });

  it('keeps the clues earned: the first time, junk dropped, merged by the earlier time', () => {
    let s = grantClueTo(emptyTownJobs(), 'fay-heights', T0);
    expect(hasClue(s, 'fay-heights')).toBe(true);
    expect(grantClueTo(s, 'fay-heights', T0 + 9)).toBe(s);
    expect(grantClueTo(s, 'Bad Clue', T0)).toBe(s);
    s = grantClueTo(s, 'gate-one-call', T0 + 5);
    expect(parseTownJobs(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseTownJobs({ clues: { 'fay-heights': T0, 'x y': T0, ok: 'no', neg: -1 } }).clues).toEqual({ 'fay-heights': T0 });
    const b = grantClueTo(emptyTownJobs(), 'fay-heights', T0 - 3);
    expect(mergeTownJobs(s, b).clues).toEqual({ 'fay-heights': T0 - 3, 'gate-one-call': T0 + 5 });
    expect(mergeTownJobs(s, b)).toEqual(mergeTownJobs(b, s));
    expect(mergeTownJobs(emptyTownJobs(), emptyTownJobs()).clues).toBeUndefined();
  });

  it('reads a bare job id as done, and opens a job after ALL of afterAll', () => {
    let s = recordJob(emptyTownJobs(), 'job-dumplings', 'messy', [], T0);
    expect(pastFlag(s, 'job-dumplings')).toBe(true);
    expect(pastFlag(s, 'job-water')).toBe(false);
    const w = { after: 'job-sale', afterAll: ['job-crossed', 'job-dumplings', 'job-water', 'job-farewell'] };
    s = recordJob(s, 'job-sale', 'clean', [], T0);
    expect(jobUnlocked(w, s)).toBe(false);
    for (const id of ['job-crossed', 'job-water', 'job-farewell']) s = recordJob(s, id, 'broken', [], T0);
    expect(jobUnlocked(w, s)).toBe(true);
    expect(jobUnlocked(w, emptyTownJobs(), true)).toBe(true);
  });
});
