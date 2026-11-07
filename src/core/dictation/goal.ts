// Session goal ("Mục tiêu phiên: 10 câu") and the end-of-session summary. Pure functions.

import { PHENOMENA, type Phenomenon } from '../types';

export const SESSION_GOAL = 10;

export interface SessionCheck {
  id: string; // sentence id
  score: number; // 0..1
  seen: Phenomenon[];
  missed: Phenomenon[];
}

export interface GoalProgress {
  done: number; // checks in the current round, capped at `goal`
  goal: number;
  reached: boolean;
  pct: number; // 0..100
}

/** Progress of the current round: checks made since `start` (the index where the round began). */
export function goalProgress(totalChecks: number, start: number, goal: number = SESSION_GOAL): GoalProgress {
  const g = goal > 0 ? Math.floor(goal) : SESSION_GOAL;
  const raw = Math.max(0, Math.floor(totalChecks) - Math.max(0, Math.floor(start)));
  const done = Math.min(g, raw);
  return { done, goal: g, reached: raw >= g, pct: Math.round((done / g) * 100) };
}

export interface MissedStat {
  phenomenon: Phenomenon;
  missed: number; // checks in which it was missed
  seen: number; // checks in which it appeared
}

export interface SessionSummary {
  count: number;
  avg: number; // 0..1
  perfect: number; // checks with score 1
  topMissed: MissedStat[]; // most-missed first, at most `limit`
}

/** Summarise a round of checks. Phenomena are ranked by how many checks missed them. */
export function summarizeChecks(checks: readonly SessionCheck[], limit = 3): SessionSummary {
  const valid = checks.filter((c) => c && Number.isFinite(c.score));
  const count = valid.length;
  const avg = count ? valid.reduce((s, c) => s + Math.min(1, Math.max(0, c.score)), 0) / count : 0;
  const perfect = valid.filter((c) => c.score >= 1).length;
  const stats = new Map<Phenomenon, MissedStat>();
  const get = (p: Phenomenon) => {
    let s = stats.get(p);
    if (!s) {
      s = { phenomenon: p, missed: 0, seen: 0 };
      stats.set(p, s);
    }
    return s;
  };
  for (const c of valid) {
    for (const p of new Set(c.seen ?? [])) if (PHENOMENA.includes(p)) get(p).seen++;
    for (const p of new Set(c.missed ?? [])) if (PHENOMENA.includes(p)) get(p).missed++;
  }
  const topMissed = [...stats.values()]
    .filter((s) => s.missed > 0)
    .sort((a, b) => b.missed - a.missed || b.missed / Math.max(1, b.seen) - a.missed / Math.max(1, a.seen) || PHENOMENA.indexOf(a.phenomenon) - PHENOMENA.indexOf(b.phenomenon))
    .slice(0, Math.max(0, limit));
  return { count, avg, perfect, topMissed };
}

/**
 * Checks of the round that started at `start`, one per sentence: retrying a sentence
 * ("Làm lại câu này") does not count again toward the goal. The FIRST check of each
 * sentence is kept (its honest, first-listen score). At most `goal` sentences.
 */
export function roundChecks(checks: readonly SessionCheck[], start: number, goal: number = SESSION_GOAL): SessionCheck[] {
  const g = goal > 0 ? Math.floor(goal) : SESSION_GOAL;
  const from = Math.max(0, Math.floor(Number.isFinite(start) ? start : 0));
  const seen = new Set<string>();
  const out: SessionCheck[] = [];
  for (let i = from; i < checks.length && out.length < g; i++) {
    const c = checks[i];
    if (!c || typeof c.id !== 'string' || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/** Goal progress counted in distinct sentences (see roundChecks). */
export function roundProgress(checks: readonly SessionCheck[], start: number, goal: number = SESSION_GOAL): GoalProgress {
  return goalProgress(roundChecks(checks, start, goal).length, 0, goal);
}
