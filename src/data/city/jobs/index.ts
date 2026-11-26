// The jobs ("phi vụ", core/town/job.ts) of Westbay: their scripts, and their lines by id and by review ref (a missed
// line becomes a review card `talk:<ref>`: features/review/resolve.ts). M0 has one: ./ferry.ts.

import { fillLine, parseLineRef, templatedRefs, type JobLine, type JobScript } from '../../../core/town/job';
import { JOB_FERRY } from './ferry';

export const CITY_JOBS: readonly JobScript[] = [JOB_FERRY];

let byId: Map<string, { line: JobLine; job: JobScript }> | null = null;

/** A line of a job by its id (its text as written: `{time}` unfilled). */
export function jobLine(id: string): { line: JobLine; job: JobScript } | undefined {
  if (!byId) {
    byId = new Map();
    for (const job of CITY_JOBS) for (const line of job.lines) byId.set(line.id, { line, job });
  }
  return byId.get(id);
}

/** A line of a job by review ref: as it was said (a templated line with the time it was said with). */
export function jobLineByRef(ref: string): { line: JobLine; job: JobScript } | undefined {
  if (!ref.startsWith('job-')) return undefined;
  const { id, minute } = parseLineRef(ref);
  const found = jobLine(id);
  if (!found) return undefined;
  if (found.line.text.includes('{time}') && minute === null) return undefined;
  return { line: { ...fillLine(found.line, minute), id: ref }, job: found.job };
}

/** Every review ref a job's lines can have (the review layer keeps a card only while its ref is known). */
export function allJobRefs(): string[] {
  return CITY_JOBS.flatMap((j) => j.lines.flatMap((l) => templatedRefs(l)));
}
