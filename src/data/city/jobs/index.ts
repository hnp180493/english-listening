// The jobs ("phi vụ", core/town/jobDoc.ts) of Westbay as data documents, and their lines by id and by review ref (a
// missed line becomes a review card `talk:<ref>`: features/review/resolve.ts). Act I's job 1 "Máy số hai"
// (./machine2.ts, docs/gta-story.md §6) and the M0 sample "Cuộn băng của Gus" (./ferry.ts), in their order.

import { fillLine, parseLineRef, templatedRefs, type JobLine } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { JOB_FERRY } from './ferry';
import { JOB_MACHINE2 } from './machine2';

export const CITY_JOBS: readonly JobDoc[] = [JOB_MACHINE2, JOB_FERRY].sort((a, b) => a.order - b.order);

let byId: Map<string, { line: JobLine; job: JobDoc }> | null = null;

/** A line of a job by its id (its text as written: `{time}` unfilled). */
export function jobLine(id: string): { line: JobLine; job: JobDoc } | undefined {
  if (!byId) {
    byId = new Map();
    for (const job of CITY_JOBS) for (const line of job.lines) byId.set(line.id, { line, job });
  }
  return byId.get(id);
}

/** A line of a job by review ref: as it was said (a templated line with the time it was said with). */
export function jobLineByRef(ref: string): { line: JobLine; job: JobDoc } | undefined {
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
