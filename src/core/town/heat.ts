// "Độ nóng" (docs/gta-plan.md §4.1), the lightest version (M1): a number the jobs' consequences raise and a clean job
// lowers, so Bayline's attention has a size. No police, no patrols yet (a later milestone). Pure; the number lives in
// memory only (features/town/jobs/heatStore.ts): it is a game score of this visit, never stored or synced.

import type { JobGrade } from './job';

export const HEAT_MAX = 10;

/**
 * The heat after a job: each consequence hit adds one (a fatal one two), a clean job takes two off. Never below
 * zero, never above HEAT_MAX.
 */
export function heatAfter(heat: number, grade: JobGrade, hits: number, fatal: boolean): number {
  const next = grade === 'clean' ? heat - 2 : heat + hits + (fatal ? 1 : 0);
  return Math.max(0, Math.min(HEAT_MAX, Math.round(next)));
}

/** How the pill reads it (nothing at zero: no zeros before there is data). */
export function heatLevel(heat: number): 'none' | 'low' | 'mid' | 'high' {
  return heat <= 0 ? 'none' : heat <= 3 ? 'low' : heat <= 6 ? 'mid' : 'high';
}
