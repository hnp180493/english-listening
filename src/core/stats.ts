import { KEYS, loadJSON, saveJSON } from './storage';
import { PHENOMENA, type Phenomenon } from './types';

export type ModuleId = 'dictation' | 'drill' | 'decoder';

export interface Attempt {
  at: number; // epoch ms
  module: ModuleId;
  itemId: string; // sentence or chunk id
  correct: boolean;
  seen: Phenomenon[]; // phenomena present in the item
  missed: Phenomenon[]; // phenomena the learner got wrong (subset of seen, may repeat)
}

export interface PhenomenonStat {
  seen: number;
  missed: number;
}

export interface StatsState {
  attempts: Attempt[]; // most recent last, capped
  byPhenomenon: Record<Phenomenon, PhenomenonStat>;
  activeDays: string[]; // "YYYY-MM-DD" local dates with at least one attempt, sorted, unique
}

const MAX_ATTEMPTS = 1000;

function emptyByPhenomenon(): Record<Phenomenon, PhenomenonStat> {
  const out = {} as Record<Phenomenon, PhenomenonStat>;
  for (const p of PHENOMENA) out[p] = { seen: 0, missed: 0 };
  return out;
}

export function localDay(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function loadStats(): StatsState {
  const s = loadJSON<Partial<StatsState>>(KEYS.stats, {});
  const by = emptyByPhenomenon();
  if (s.byPhenomenon) {
    for (const p of PHENOMENA) {
      const v = s.byPhenomenon[p];
      if (v && typeof v.seen === 'number' && typeof v.missed === 'number') by[p] = v;
    }
  }
  return {
    attempts: Array.isArray(s.attempts) ? s.attempts : [],
    byPhenomenon: by,
    activeDays: Array.isArray(s.activeDays) ? s.activeDays : [],
  };
}

type Listener = (s: StatsState) => void;
const listeners = new Set<Listener>();

export function subscribeStats(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Record one practice attempt and update per-phenomenon counters. */
export function recordAttempt(a: Omit<Attempt, 'at'> & { at?: number }): StatsState {
  const at = a.at ?? Date.now();
  const s = loadStats();
  const attempt: Attempt = { ...a, at };
  s.attempts = [...s.attempts, attempt].slice(-MAX_ATTEMPTS);
  for (const p of new Set(a.seen)) s.byPhenomenon[p].seen += 1;
  for (const p of new Set(a.missed)) s.byPhenomenon[p].missed += 1;
  const day = localDay(at);
  if (!s.activeDays.includes(day)) s.activeDays = [...s.activeDays, day].sort();
  saveJSON(KEYS.stats, s);
  listeners.forEach((fn) => fn(s));
  return s;
}

export function resetStats(): void {
  const s: StatsState = { attempts: [], byPhenomenon: emptyByPhenomenon(), activeDays: [] };
  saveJSON(KEYS.stats, s);
  listeners.forEach((fn) => fn(s));
}

/** Consecutive days with activity ending today (or yesterday if nothing yet today). */
export function currentStreak(activeDays: string[], now: number = Date.now()): number {
  const set = new Set(activeDays);
  let streak = 0;
  const cursor = new Date(now);
  if (!set.has(localDay(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(localDay(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
