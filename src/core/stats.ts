import { noteAttempt } from './history';
import { KEYS, loadJSON, saveJSON } from './storage';
import { recordKeyReset } from './syncMarkers';
import { PHENOMENA, type Phenomenon } from './types';

export type ModuleId = 'dictation' | 'drill' | 'decoder' | 'lesson' | 'pairs' | 'shadowing' | 'media';

export const MODULE_LABEL: Record<ModuleId, string> = {
  dictation: 'Chép chính tả',
  drill: 'Cụm từ',
  decoder: 'Giải mã câu',
  lesson: 'Bài học',
  pairs: 'Phân biệt âm',
  shadowing: 'Nói nhại',
  media: 'Video thật',
};

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

/**
 * Set only when the last write failed (blocked/full storage): this session's stats live here
 * so counters keep growing. While storage works it stays null and every read goes to storage
 * (keeps cross-tab merging intact).
 */
let sessionStats: StatsState | null = null;

export function loadStats(): StatsState {
  return sessionStats ?? readStored();
}

function readStored(): StatsState {
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
/**
 * Record one practice attempt. `opts.inReview`: the attempt is a re-test in Ôn tập (or a word card). It still
 * counts for stats and phenomena, but not in the long-term archive the progress report trends on (core/history):
 * re-testing a sentence the learner already got right would make "practice accuracy" rise from memory, and Ôn tập
 * is measured by its own retention (grades on graduated cards).
 */
export function recordAttempt(a: Omit<Attempt, 'at'> & { at?: number }, opts: { inReview?: boolean } = {}): StatsState {
  const at = a.at ?? Date.now();
  // Clone so the in-memory session copy is never mutated in place.
  const s = structuredClone(loadStats());
  const attempt: Attempt = { ...a, at };
  s.attempts = [...s.attempts, attempt].slice(-MAX_ATTEMPTS);
  for (const p of new Set(a.seen)) s.byPhenomenon[p].seen += 1;
  for (const p of new Set(a.missed)) s.byPhenomenon[p].missed += 1;
  const day = localDay(at);
  if (!s.activeDays.includes(day)) s.activeDays = [...s.activeDays, day].sort();
  sessionStats = saveJSON(KEYS.stats, s) ? null : s;
  // long-term daily archive for the progress report (core/history; survives the MAX_ATTEMPTS cap)
  if (!opts.inReview) noteAttempt(a.module, a.correct, at);
  listeners.forEach((fn) => fn(s));
  return s;
}

/** "Xóa lịch sử luyện tập". The reset marker makes folder sync drop the other machines' older history too. */
export function resetStats(): void {
  const s: StatsState = { attempts: [], byPhenomenon: emptyByPhenomenon(), activeDays: [] };
  recordKeyReset([KEYS.stats]);
  sessionStats = saveJSON(KEYS.stats, s) ? null : s;
  listeners.forEach((fn) => fn(s));
}

/**
 * Drop the in-memory copy and notify subscribers with what storage now holds. Used after folder
 * sync replaced the stored data (storage changed without recordAttempt).
 */
export function reloadStats(): void {
  sessionStats = null;
  const s = readStored();
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
