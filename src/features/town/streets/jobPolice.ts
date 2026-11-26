// The police, called by a job (docs/town.md §28 "A job's patrol"; Act II, docs/gta-story-2.md §7): the job engine
// (features/town/jobs/useCityJob.tsx) awaits these two and decides what follows. Nothing here stops, fines or raises
// the heat of anybody.
//
//   const { seen } = await jobPatrol({ street: 'Market Street', from: 'Bay Road', to: 'College Road', seconds: 18,
//     lines: [{ who: 'dispatch', text: 'Unit twelve, a slow pass down Market Street, please.', vi: '…' }] });
//   await sayOnScanner([{ who: 'unit', text: 'Unit twelve. All quiet on Quay Street.', vi: '…' }]);
//
// The patrol is driven by the streets layer (./streetsWorld.ts) while Westbay's 3D stage stands; without it (no 3D,
// another page) the promise still settles after `seconds`, with `seen: false`. Its lines are said on the scanner pill
// (Dispatch and the unit in the browser's voice), replayable and slower with the shared keys like any bulletin.

import type { JobPatrolSpec } from '../../../core/town/jobPatrol';
import type { ScanLine } from '../../../core/town/scanner';
import { streets } from './streetsStore';

/** A line a job writes for the scanner: who says it, the English, its meaning, and (on a patrol) when, in seconds. */
export interface JobScanLine {
  who: 'dispatch' | 'unit';
  text: string;
  vi?: string;
  /** Seconds into the patrol's drive (left out: as it sets off). Ignored by sayOnScanner. */
  at?: number;
}

export interface JobPatrolRequest extends JobPatrolSpec {
  lines?: readonly JobScanLine[];
}

interface Pending {
  spec: JobPatrolRequest;
  resolve: (r: { seen: boolean }) => void;
}

let pending: Pending | null = null;
let running: Pending | null = null;

/** The streets layer takes the next request (one at a time). */
export function takeJobPatrol(): Pending | null {
  if (running || !pending) return null;
  running = pending;
  pending = null;
  return running;
}

/** The streets layer is done with the patrol it took. */
export function settleJobPatrol(seen: boolean): void {
  const r = running;
  running = null;
  r?.resolve({ seen });
}

/** A job's patrol is under way (the heat and the ordinary search wait). */
export const jobPatrolRunning = (): boolean => !!running;

const asScan = (l: JobScanLine): ScanLine => ({ who: l.who, text: l.text, vi: l.vi ?? '' });

/**
 * A patrol car drives one named street once, in about `seconds`, while the scanner says `lines`. Resolves with whether
 * the learner was seen (in sight longer than a moment, never indoors). One at a time: a second call waits for the first.
 */
export function jobPatrol(spec: JobPatrolRequest): Promise<{ seen: boolean }> {
  return new Promise((resolve) => {
    const go = () => {
      if (!streets.hasWorld()) {
        // no world to drive in: the time passes all the same, and nobody saw anybody
        window.setTimeout(() => resolve({ seen: false }), Math.max(0, spec.seconds) * 1000);
        return;
      }
      pending = { spec, resolve };
    };
    if (pending || running) {
      const wait = window.setInterval(() => {
        if (pending || running) return;
        window.clearInterval(wait);
        go();
      }, 250);
    } else go();
  });
}

/** Lines of the job said on the scanner (the pill opens), with no patrol. Resolves once said (or after a while when no sound comes). */
export function sayOnScanner(lines: readonly JobScanLine[]): Promise<void> {
  if (lines.length === 0) return Promise.resolve();
  return streets.say(lines.map(asScan), { force: true, open: true });
}

/** The lines of a patrol due at `t` seconds that were not said yet (and the index to start from next time). */
export function linesDue(lines: readonly JobScanLine[], from: number, t: number): { due: ScanLine[]; next: number } {
  const sorted = [...lines].map((l, i) => ({ l, i })).sort((a, b) => (a.l.at ?? 0) - (b.l.at ?? 0) || a.i - b.i);
  const due: ScanLine[] = [];
  let next = from;
  while (next < sorted.length && (sorted[next].l.at ?? 0) <= t) due.push(asScan(sorted[next++].l));
  return { due, next };
}

// a dev hook: a script can call the police like a job (window.__jobPolice.jobPatrol({ … }))
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __jobPolice?: unknown }).__jobPolice = { jobPatrol, sayOnScanner };
