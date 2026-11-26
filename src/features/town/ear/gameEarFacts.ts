// What a job's run and a dispatch shift give "Trong game: nghe 1 lần là đúng" (core/town/gameEar.ts): the facts the
// learner had to hear, as the debriefs count them (features/town/jobs/JobDebrief.tsx, dispatch/DispatchDebrief.tsx),
// and one call each to record them. A fact said by a town resident is in the "clip" row (their Gemini clip, the browser's
// voice until the owner generates it); anybody else's in the "browser" row.

import type { ShiftSummary } from '../../../core/town/dispatch';
import { cityCastVoice } from '../../../core/town/cityAudio';
import { recordGameEar, type EarItem } from '../../../core/town/gameEarStore';
import type { EarFact, EarVoice } from '../../../core/town/gameEar';
import { noteAnswer, type NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { loadTownJobs } from '../../../core/town/jobsStore';
import { jobLine } from '../../../data/city/jobs';

/** What of a job's run the count needs (features/town/jobs/useCityJob.tsx JobRunState). */
export interface JobRunHeard {
  minute: number;
  picks: Readonly<Record<string, string>>;
  /** Times each fact was heard: a notebook entry's key, a junction's id, 'word' for the password. */
  heard: Readonly<Record<string, number>>;
  wrongAt: readonly string[];
  password: 'first' | 'helped' | 'none' | null;
}

const voiceOf = (lineId: string): EarVoice => {
  const who = jobLine(lineId)?.line.who;
  return who && cityCastVoice(who) ? 'clip' : 'browser';
};

/** The facts of a job's run: every notebook entry heard, every junction reached, the password asked. */
export function jobEarFacts(doc: JobDoc, run: JobRunHeard): EarFact[] {
  const out: EarFact[] = [];
  const entries: NoteEntry[] = doc.steps.flatMap((s) => (s.kind === 'notebook' ? [...s.entries] : []));
  for (const e of entries) {
    const plays = run.heard[e.key] ?? 0;
    if (plays === 0 && run.picks[e.key] === undefined) continue;
    out.push({ voice: voiceOf(e.line), right: run.picks[e.key] === noteAnswer(e, run.minute), plays });
  }
  for (const s of doc.steps) {
    if (s.kind === 'ride')
      for (const j of s.junctions ?? []) {
        const plays = run.heard[j.id] ?? 0;
        if (plays > 0) out.push({ voice: voiceOf(j.line), right: !run.wrongAt.includes(j.id), plays });
      }
    if (s.kind === 'password' && run.password !== null) out.push({ voice: voiceOf(s.line), right: run.password === 'first', plays: run.heard.word ?? 0 });
  }
  return out;
}

/** A job is over: its facts, if the job was never finished before (call before the run is written as done). */
export function recordJobEar(doc: JobDoc, run: JobRunHeard, level?: number): number {
  let seenBefore = false;
  try {
    seenBefore = Object.prototype.hasOwnProperty.call(loadTownJobs().done, doc.id);
  } catch {
    seenBefore = false;
  }
  return recordGameEar([{ id: doc.id, facts: jobEarFacts(doc, run), seenBefore }], level !== undefined ? { level } : {});
}

/** The calls of a dispatch shift that were answered and sent (pickup and destination are one fact; callers: the browser's voice). */
export function dispatchEarItems(summary: Pick<ShiftSummary, 'results'>): EarItem[] {
  return summary.results.filter((r) => r.answered && !r.stolen).map((r) => ({ id: r.id, facts: [{ voice: 'browser' as const, right: !r.fromWrong && !r.toWrong, plays: 1 + r.asks }] }));
}

/** A dispatch shift is over. */
export function recordDispatchEar(summary: Pick<ShiftSummary, 'results'>, level?: number): number {
  return recordGameEar(dispatchEarItems(summary), level !== undefined ? { level } : {});
}
