// What Westbay's jobs remember (docs/gta-plan.md §14): per job, when it was first done, the best grade, how many times,
// when last, and the flags of its runs that later jobs read (`flags`: a choice made, a consequence hit as `hit:<id>`).
// Stored under KEYS.townJobs (synced, merged by core/syncMerge mergeJobs: per job the earlier first time, the better
// grade, the higher count, the later last time, the union of flags). The chain of the story: a job with `after` opens
// once that job is done (any grade). Also the learner's clues (gta-plan §4.2, §17): `clue:<id>` lines earned by hearing
// them (on a bench, on Bay FM, in a job), with when first earned; merged by the earlier time. Pure: the IO is
// ./jobsStore.ts.

import type { JobGrade } from './job';
import { mergeSpeech, parseSpeech, type SpeechState } from './difficulty';

export const JOBS_VERSION = 1;
/** Flags kept per job at most (a run adds a handful). */
const MAX_FLAGS = 60;

export interface JobRecord {
  /** When it was first done (ms), > 0. */
  first: number;
  best: JobGrade;
  times: number;
  last: number;
  /** Flags of its runs (union, sorted). */
  flags: string[];
}

export interface TownJobs {
  version: number;
  done: Record<string, JobRecord>;
  /** Clues earned (id → when first, ms). Missing in records written before clues: none. */
  clues?: Record<string, number>;
  /** The level jobs and the dispatch office speak at (./difficulty.ts): automatic and pinned, each with its time. */
  speech?: SpeechState;
}

export const emptyTownJobs = (): TownJobs => ({ version: JOBS_VERSION, done: {} });
const okClue = (id: string) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);

const GRADE_RANK: Readonly<Record<JobGrade, number>> = { broken: 0, messy: 1, clean: 2 };
const isGrade = (g: unknown): g is JobGrade => g === 'clean' || g === 'messy' || g === 'broken';
const okId = (id: string) => /^job-[a-z0-9-]{1,40}$/.test(id);
const time = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
const flagList = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((f): f is string => typeof f === 'string' && f.length > 0 && f.length <= 60))].sort().slice(0, MAX_FLAGS) : [];

function parseRecord(raw: unknown): JobRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const first = time(r.first);
  if (!first || !isGrade(r.best)) return null;
  const times = typeof r.times === 'number' && Number.isFinite(r.times) && r.times >= 1 ? Math.floor(r.times) : 1;
  return { first, best: r.best, times, last: Math.max(first, time(r.last)), flags: flagList(r.flags) };
}

/** Anything stored (or synced) into a clean record; junk is dropped. */
export function parseTownJobs(raw: unknown): TownJobs {
  const out = emptyTownJobs();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const done = (raw as Record<string, unknown>).done;
  const records = done && typeof done === 'object' && !Array.isArray(done) ? Object.entries(done) : [];
  for (const [id, r] of records) {
    if (!okId(id)) continue;
    const rec = parseRecord(r);
    if (rec) out.done[id] = rec;
  }
  const clues = (raw as Record<string, unknown>).clues;
  if (clues && typeof clues === 'object' && !Array.isArray(clues)) {
    const kept: Record<string, number> = {};
    for (const [id, at] of Object.entries(clues)) if (okClue(id) && time(at) > 0) kept[id] = time(at);
    if (Object.keys(kept).length > 0) out.clues = kept;
  }
  const speech = (raw as Record<string, unknown>).speech;
  if (speech !== undefined && speech !== null) out.speech = parseSpeech(speech);
  return out;
}

function mergeRecord(a: JobRecord, b: JobRecord): JobRecord {
  return {
    first: Math.min(a.first, b.first),
    best: GRADE_RANK[a.best] >= GRADE_RANK[b.best] ? a.best : b.best,
    times: Math.max(a.times, b.times),
    last: Math.max(a.last, b.last),
    flags: [...new Set([...a.flags, ...b.flags])].sort().slice(0, MAX_FLAGS),
  };
}

/** Two copies into one (commutative, idempotent, associative). */
export function mergeTownJobs(a: TownJobs, b: TownJobs): TownJobs {
  const out = emptyTownJobs();
  for (const id of [...new Set([...Object.keys(a.done), ...Object.keys(b.done)])].sort()) {
    const x = a.done[id];
    const y = b.done[id];
    out.done[id] = x && y ? mergeRecord(x, y) : (x ?? y)!;
  }
  const clues: Record<string, number> = {};
  for (const id of [...new Set([...Object.keys(a.clues ?? {}), ...Object.keys(b.clues ?? {})])].sort()) {
    const x = a.clues?.[id];
    const y = b.clues?.[id];
    clues[id] = x !== undefined && y !== undefined ? Math.min(x, y) : (x ?? y)!;
  }
  if (Object.keys(clues).length > 0) out.clues = clues;
  if (a.speech || b.speech) out.speech = a.speech && b.speech ? mergeSpeech(a.speech, b.speech) : (a.speech ?? b.speech);
  return out;
}

/** A clue earned (kept with the first time it was). */
export function grantClueTo(state: TownJobs, id: string, now: number): TownJobs {
  if (!okClue(id) || state.clues?.[id] !== undefined) return state;
  return { ...state, clues: { ...state.clues, [id]: Math.round(now) } };
}

/** Holds this clue? */
export const hasClue = (state: TownJobs, id: string): boolean => state.clues?.[id] !== undefined;

/** A run is over: written down (the better grade kept, flags added). */
export function recordJob(state: TownJobs, jobId: string, grade: JobGrade, flags: readonly string[], now: number): TownJobs {
  if (!okId(jobId)) return state;
  const old = state.done[jobId];
  const rec: JobRecord = { first: now, best: grade, times: 1, last: now, flags: flagList([...flags]) };
  const next = old ? { ...mergeRecord(old, rec), times: old.times + 1 } : rec;
  return { ...state, done: { ...state.done, [jobId]: next } };
}

/** Done (any grade)? */
export const jobDone = (state: TownJobs, jobId: string): boolean => Object.hasOwn(state.done, jobId);

/** A flag an earlier job left (`<job id>:<flag>`, e.g. `job-m2:hit:late`), or a bare job id: done. */
export function pastFlag(state: TownJobs, ref: string): boolean {
  const i = ref.indexOf(':');
  // a bare job id: that job is done (any grade)
  if (i < 0) return okId(ref) && jobDone(state, ref);
  const rec = state.done[ref.slice(0, i)];
  return !!rec && rec.flags.includes(ref.slice(i + 1));
}

/** What the story offers: a job is open when the one before it in the chain (`after`) is done; the sandbox opens all. */
export function jobUnlocked(job: { after?: string; afterAll?: readonly string[] }, state: TownJobs, all = false): boolean {
  return all || ((!job.after || jobDone(state, job.after)) && (job.afterAll ?? []).every((id) => jobDone(state, id)));
}
