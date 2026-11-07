// Module-level session state: survives tab switches (the page unmounts) but not reloads.

import type { SessionCheck } from '../../core/dictation/goal';
import type { DictMode } from '../../core/dictation/modes';
import type { LevelFilter } from '../../core/dictation/progress';
import type { Phenomenon } from '../../core/types';

export interface DictFilters {
  mode: DictMode;
  level: LevelFilter;
  focus: Phenomenon | null;
}

export interface SessionState {
  seed: number; // shuffle seed, fixed for the whole session
  gestured: boolean; // the user has clicked a play button at least once
  filters: DictFilters; // last filters used (restored when the page is opened without params)
  topic: string; // '' = all, MINE = custom sentences, else a topic label
  queueKey: string; // filter key the queue was built for
  queue: string[]; // sentence ids in practice order
  pos: number; // index into queue
  firstScores: Map<string, number>; // sentence id → score of its first check in this session
  checks: SessionCheck[]; // every check made in this session, in order
  goalStart: number; // index into checks where the current goal round began
  summaryOpen: boolean; // the end-of-round summary card is showing
}

export const session: SessionState = {
  seed: Math.floor(Math.random() * 2 ** 31),
  gestured: false,
  filters: { mode: 'normal', level: 0, focus: null },
  topic: '',
  queueKey: '',
  queue: [],
  pos: 0,
  firstScores: new Map(),
  checks: [],
  goalStart: 0,
  summaryOpen: false,
};

const MAX_CHECKS = 500;

/** Start a new goal round: the next checks count towards a fresh goal and the summary card closes. */
export function startSessionRound(): void {
  session.goalStart = session.checks.length;
  session.summaryOpen = false;
}

export function recordSessionScore(id: string, score: number): void {
  if (!session.firstScores.has(id)) session.firstScores.set(id, score);
}

export function recordSessionCheck(check: SessionCheck): void {
  session.checks.push(check);
  if (session.checks.length > MAX_CHECKS) {
    const drop = session.checks.length - MAX_CHECKS;
    session.checks.splice(0, drop);
    session.goalStart = Math.max(0, session.goalStart - drop);
  }
  recordSessionScore(check.id, check.score);
}

export function sessionSummary(): { count: number; avg: number } {
  const scores = [...session.firstScores.values()];
  const count = scores.length;
  return { count, avg: count ? scores.reduce((a, b) => a + b, 0) / count : 0 };
}
