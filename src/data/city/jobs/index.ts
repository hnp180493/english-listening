// The jobs ("phi vụ", core/town/jobDoc.ts) of Westbay as data documents, and their lines by id and by review ref (a
// missed line becomes a review card `talk:<ref>`: features/review/resolve.ts). Act I's jobs in their order (1
// ./machine2.ts, 2 ./half5.ts, 3 ./chip.ts, 4 ./three.ts, 5 ./delaney.ts, then 6–8), chained by `after`; the M0 sample
// "Cuộn băng của Gus" (./ferry.ts) as a side job; the two side chains.

import { fillLine, parseLineRef, templatedRefs, type JobLine } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { JOB_CALLIN } from './act2Callin';
import { JOB_FORGED } from './act3Forged';
import { JOB_TWOMARCUS } from './act3TwoMarcus';
import { JOB_SAMCALL } from './act3SamCall';
import { JOB_SPLICE } from './act3Splice';
import { JOB_TOMCALL } from './act3TomCall';
import { JOB_LIVE } from './act3Live';
import { JOB_CROSSED } from './act2Crossed';
import { JOB_DUMPLINGS } from './act2Dumplings';
import { JOB_LINK } from './act2Link';
import { JOB_NIGHT } from './act2Night';
import { JOB_FAREWELL } from './act2Farewell';
import { JOB_SALE } from './act2Sale';
import { JOB_SECOND } from './act2Second';
import { JOB_WAREHOUSE } from './act2Warehouse';
import { JOB_WATER } from './act2Water';
import { JOB_CHANNELS } from './channels';
import { JOB_CHIP } from './chip';
import { JOB_DELANEY } from './delaney';
import { JOB_FERRY } from './ferry';
import { JOB_HALF5 } from './half5';
import { JOB_HEARING } from './hearing';
import { JOB_MACHINE2 } from './machine2';
import { SIDE_KIT } from './sideKit';
import { SIDE_FAY } from './sideFay';
import { SIDE_ODILE } from './sideOdile';
import { SIDE_NELL } from './sideNell';
import { SIDE_JONAH } from './sideJonah';
import { SIDE_HANA } from './sideHana';
import { SIDE_OKAFOR } from './sideOkafor';
import { SIDE_PROFESSOR } from './sideProfessor';
import { JOB_TESS } from './tess';
import { JOB_THREE } from './three';

export const CITY_JOBS: readonly JobDoc[] = [JOB_MACHINE2, JOB_FERRY, JOB_HALF5, JOB_CHIP, JOB_THREE, JOB_DELANEY, JOB_CHANNELS, JOB_TESS, JOB_HEARING, ...SIDE_OKAFOR, ...SIDE_KIT, ...SIDE_FAY, ...SIDE_ODILE, ...SIDE_NELL, ...SIDE_JONAH, ...SIDE_HANA, ...SIDE_PROFESSOR, JOB_SALE, JOB_SECOND, JOB_DUMPLINGS, JOB_CALLIN, JOB_FAREWELL, JOB_LINK, JOB_CROSSED, JOB_NIGHT, JOB_WATER, JOB_WAREHOUSE, JOB_FORGED, JOB_TWOMARCUS, JOB_SAMCALL, JOB_SPLICE, JOB_TOMCALL, JOB_LIVE].sort((a, b) => a.order - b.order);

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
  return { line: { ...fillLine(found.line, minute, found.job.clock), id: ref }, job: found.job };
}

/** Every review ref a job's lines can have (the review layer keeps a card only while its ref is known). */
export function allJobRefs(): string[] {
  return CITY_JOBS.flatMap((j) => j.lines.flatMap((l) => templatedRefs(l, j.clock)));
}
