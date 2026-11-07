// Daily-aggregate archive for the progress report ("Báo cáo tiến bộ"). The stats key keeps only the last 1000
// attempts, so long-term trends need their own record: per local day, per module {n, ok}; Ôn tập grades; grades
// given to graduated cards (retention); word cards graduated for the first time ("từ đã thuộc").
//
// Stored under KEYS.history ('progress-history', synced):
//   { version: 1,
//     devices: { [deviceId]: { [day]: DayAgg } },   // live counts, one bucket per browser
//     base: { until, days: { [day]: DayAgg }, wordsLearned } | null }   // one-off backfill
//
// No double counting across folder sync (docs/progress-report.md):
// - Each browser only ever increments its OWN bucket (devices[KEYS.deviceId]); a device's counters for a day only
//   grow, so the merge takes the max per device, day and field (core/syncMerge mergeProgressHistory). The total is
//   the sum over buckets: every event is counted once, by the browser where it happened. Merging is idempotent,
//   commutative and associative (max per field).
// - The backfill (attempts still in the stats key, from before this archive existed) goes to `base`, built once,
//   only when no `base` exists after the boot sync, from attempts with at < `until` (the moment it was built; live
//   counting starts at the same moment). Two browsers that backfilled before seeing each other's archive are merged
//   by max per day and field: the attempts they share (synced stats) are counted once; attempts only one of them
//   had on the same day are under-counted (never double counted).
// Limits: review grades and word graduations have no history before the archive existed (not backfilled; the
// current number of learned words becomes `base.wordsLearned`, the starting point of the cumulative line). A word
// graduated on two machines before they synced counts twice. Restoring an old backup lowers this browser's bucket
// until the folder copy (max) brings it back. Lessons passed need no archive: lessons-progress keeps completedAt.

import type { Grade } from './srs';
import type { ModuleId } from './stats';
import { KEYS, loadJSON, saveJSON } from './storage';

export interface ModuleCount {
  n: number; // attempts
  ok: number; // correct attempts
}

export interface GradeCount {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface DayAgg {
  mod?: Partial<Record<ModuleId, ModuleCount>>;
  grades?: GradeCount; // grades given in Ôn tập (context 'review', chunks included)
  ret?: { n: number; again: number }; // any grade on a graduated card (interval ≥ 1 day) that changed its schedule
  words?: number; // word cards graduated for the first time
}

export interface HistoryBase {
  until: number; // epoch ms: attempts before this were backfilled; live counting starts here
  days: Record<string, DayAgg>;
  wordsLearned: number; // word cards already learned when the archive started
}

export interface HistoryStore {
  version: 1;
  devices: Record<string, Record<string, DayAgg>>;
  base: HistoryBase | null;
}

export const HISTORY_MODULES: readonly ModuleId[] = ['dictation', 'drill', 'decoder', 'lesson', 'pairs', 'shadowing', 'media'];
const GRADES: readonly Grade[] = ['again', 'hard', 'good', 'easy'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const count = (v: unknown): number => (finite(v) && v > 0 ? Math.floor(v) : 0);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Local 'YYYY-MM-DD' (same as core/stats localDay; kept here so stats → history has no import cycle). */
export function dayOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function emptyHistory(): HistoryStore {
  return { version: 1, devices: {}, base: null };
}

// ───────────────────────── sanitize + merge (shared with core/syncMerge) ─────────────────────────

export function sanitizeDayAgg(raw: unknown): DayAgg {
  const out: DayAgg = {};
  if (!isObj(raw)) return out;
  if (isObj(raw.mod)) {
    const mod: Partial<Record<ModuleId, ModuleCount>> = {};
    for (const m of HISTORY_MODULES) {
      const v = raw.mod[m];
      if (!isObj(v)) continue;
      const n = count(v.n);
      if (n > 0) mod[m] = { n, ok: Math.min(n, count(v.ok)) };
    }
    if (Object.keys(mod).length) out.mod = mod;
  }
  if (isObj(raw.grades)) {
    const g = { again: count(raw.grades.again), hard: count(raw.grades.hard), good: count(raw.grades.good), easy: count(raw.grades.easy) };
    if (g.again + g.hard + g.good + g.easy > 0) out.grades = g;
  }
  if (isObj(raw.ret)) {
    const n = count(raw.ret.n);
    if (n > 0) out.ret = { n, again: Math.min(n, count(raw.ret.again)) };
  }
  const w = count(raw.words);
  if (w > 0) out.words = w;
  return out;
}

function sanitizeDays(raw: unknown): Record<string, DayAgg> {
  const out: Record<string, DayAgg> = {};
  if (!isObj(raw)) return out;
  for (const [day, v] of Object.entries(raw)) {
    if (!DAY_RE.test(day)) continue;
    const agg = sanitizeDayAgg(v);
    if (Object.keys(agg).length) out[day] = agg;
  }
  return out;
}

export function parseHistory(raw: unknown): HistoryStore {
  const out = emptyHistory();
  if (!isObj(raw)) return out;
  if (isObj(raw.devices)) {
    for (const [dev, days] of Object.entries(raw.devices)) {
      if (!dev || dev.length > 80 || UNSAFE.has(dev)) continue;
      out.devices[dev] = sanitizeDays(days);
    }
  }
  if (isObj(raw.base) && finite(raw.base.until)) {
    out.base = { until: raw.base.until, days: sanitizeDays(raw.base.days), wordsLearned: count(raw.base.wordsLearned) };
  }
  return out;
}

/** Field-wise max of two day aggregates (one device's counters only grow, so max = the later copy). */
export function maxDayAgg(a: DayAgg, b: DayAgg): DayAgg {
  const out: DayAgg = {};
  const mod: Partial<Record<ModuleId, ModuleCount>> = {};
  for (const m of HISTORY_MODULES) {
    const x = a.mod?.[m];
    const y = b.mod?.[m];
    if (!x && !y) continue;
    mod[m] = { n: Math.max(x?.n ?? 0, y?.n ?? 0), ok: Math.max(x?.ok ?? 0, y?.ok ?? 0) };
  }
  if (Object.keys(mod).length) out.mod = mod;
  if (a.grades || b.grades) {
    const g = {} as GradeCount;
    for (const k of GRADES) g[k] = Math.max(a.grades?.[k] ?? 0, b.grades?.[k] ?? 0);
    out.grades = g;
  }
  if (a.ret || b.ret) out.ret = { n: Math.max(a.ret?.n ?? 0, b.ret?.n ?? 0), again: Math.max(a.ret?.again ?? 0, b.ret?.again ?? 0) };
  const w = Math.max(a.words ?? 0, b.words ?? 0);
  if (w > 0) out.words = w;
  return out;
}

function maxDays(a: Record<string, DayAgg>, b: Record<string, DayAgg>): Record<string, DayAgg> {
  const out: Record<string, DayAgg> = {};
  for (const day of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    out[day] = a[day] && b[day] ? maxDayAgg(a[day], b[day]) : (a[day] ?? b[day]);
  }
  return out;
}

/** Sync merge of two archives (see the header): union of device buckets, max per device/day/field; base by max. */
export function mergeHistoryStores(x: HistoryStore, y: HistoryStore): HistoryStore {
  const devices: Record<string, Record<string, DayAgg>> = {};
  for (const dev of [...new Set([...Object.keys(x.devices), ...Object.keys(y.devices)])].sort()) {
    devices[dev] = maxDays(x.devices[dev] ?? {}, y.devices[dev] ?? {});
  }
  let base: HistoryBase | null = x.base ?? y.base;
  if (x.base && y.base) {
    base = {
      until: Math.max(x.base.until, y.base.until),
      days: maxDays(x.base.days, y.base.days),
      wordsLearned: Math.max(x.base.wordsLearned, y.base.wordsLearned),
    };
  }
  return { version: 1, devices, base };
}

// ───────────────────────── totals (pure) ─────────────────────────

function addAgg(into: DayAgg, a: DayAgg): void {
  if (a.mod) {
    into.mod ??= {};
    for (const m of HISTORY_MODULES) {
      const v = a.mod[m];
      if (!v) continue;
      const cur = (into.mod[m] ??= { n: 0, ok: 0 });
      cur.n += v.n;
      cur.ok += v.ok;
    }
  }
  if (a.grades) {
    into.grades ??= { again: 0, hard: 0, good: 0, easy: 0 };
    for (const k of GRADES) into.grades[k] += a.grades[k];
  }
  if (a.ret) {
    into.ret ??= { n: 0, again: 0 };
    into.ret.n += a.ret.n;
    into.ret.again += a.ret.again;
  }
  if (a.words) into.words = (into.words ?? 0) + a.words;
}

/** Per-day totals over the backfill and every device bucket. */
export function historyDays(store: HistoryStore): Map<string, DayAgg> {
  const out = new Map<string, DayAgg>();
  const add = (days: Record<string, DayAgg>) => {
    for (const [day, a] of Object.entries(days)) {
      let cur = out.get(day);
      if (!cur) out.set(day, (cur = {}));
      addAgg(cur, a);
    }
  };
  if (store.base) add(store.base.days);
  for (const days of Object.values(store.devices)) add(days);
  return out;
}

function inRange(day: string, fromDay?: string, toDay?: string): boolean {
  return (!fromDay || day >= fromDay) && (!toDay || day <= toDay);
}

export interface PracticeTotals {
  n: number;
  ok: number;
  pct: number | null; // 0..100
  byModule: Partial<Record<ModuleId, ModuleCount & { pct: number }>>;
  activeDays: number; // days with at least one attempt
}

/** Practice attempts in [fromDay, toDay] (inclusive; either bound optional). */
export function practiceTotals(days: Map<string, DayAgg>, fromDay?: string, toDay?: string): PracticeTotals {
  let n = 0;
  let ok = 0;
  let active = 0;
  const by: Partial<Record<ModuleId, ModuleCount>> = {};
  for (const [day, a] of days) {
    if (!inRange(day, fromDay, toDay) || !a.mod) continue;
    let any = false;
    for (const m of HISTORY_MODULES) {
      const v = a.mod[m];
      if (!v || v.n === 0) continue;
      any = true;
      n += v.n;
      ok += v.ok;
      const cur = (by[m] ??= { n: 0, ok: 0 });
      cur.n += v.n;
      cur.ok += v.ok;
    }
    if (any) active += 1;
  }
  const byModule: PracticeTotals['byModule'] = {};
  for (const m of HISTORY_MODULES) {
    const v = by[m];
    if (v) byModule[m] = { ...v, pct: Math.round((v.ok / v.n) * 100) };
  }
  return { n, ok, pct: n > 0 ? Math.round((ok / n) * 100) : null, byModule, activeDays: active };
}

/** Days with at least one practice attempt in [fromDay, toDay]. */
export function practiceDays(days: Map<string, DayAgg>, fromDay?: string, toDay?: string): string[] {
  const out: string[] = [];
  for (const [day, a] of days) {
    if (!inRange(day, fromDay, toDay) || !a.mod) continue;
    if (HISTORY_MODULES.some((m) => (a.mod?.[m]?.n ?? 0) > 0)) out.push(day);
  }
  return out.sort();
}

export interface Retention {
  n: number; // grades on graduated cards
  again: number;
  pct: number | null; // % not "again", 0..100
}

/** Review retention: share of grades on graduated cards that were not "again", in [fromDay, toDay]. */
export function reviewRetention(days: Map<string, DayAgg>, fromDay?: string, toDay?: string): Retention {
  let n = 0;
  let again = 0;
  for (const [day, a] of days) {
    if (!inRange(day, fromDay, toDay) || !a.ret) continue;
    n += a.ret.n;
    again += a.ret.again;
  }
  return { n, again, pct: n > 0 ? Math.round(((n - again) / n) * 100) : null };
}

export function gradeTotals(days: Map<string, DayAgg>, fromDay?: string, toDay?: string): GradeCount & { total: number } {
  const g = { again: 0, hard: 0, good: 0, easy: 0, total: 0 };
  for (const [day, a] of days) {
    if (!inRange(day, fromDay, toDay) || !a.grades) continue;
    for (const k of GRADES) {
      g[k] += a.grades[k];
      g.total += a.grades[k];
    }
  }
  return g;
}

/** Word cards graduated for the first time in [fromDay, toDay] (backfill count excluded). */
export function wordsLearnedBetween(days: Map<string, DayAgg>, fromDay?: string, toDay?: string): number {
  let w = 0;
  for (const [day, a] of days) if (inRange(day, fromDay, toDay)) w += a.words ?? 0;
  return w;
}

// ── week selectors (weeks are given by their Monday 'YYYY-MM-DD', oldest first; see core/listening weekBuckets) ──

export interface WeekRef {
  key: string; // Monday 'YYYY-MM-DD'
  label: string; // 'dd/mm'
  end: string; // Sunday 'YYYY-MM-DD'
}

export interface WeekModuleAccuracy extends WeekRef {
  total: ModuleCount & { pct: number | null };
  byModule: Partial<Record<ModuleId, ModuleCount & { pct: number }>>;
}

export function weeklyModuleAccuracy(days: Map<string, DayAgg>, weeks: readonly WeekRef[]): WeekModuleAccuracy[] {
  return weeks.map((w) => {
    const t = practiceTotals(days, w.key, w.end);
    return { ...w, total: { n: t.n, ok: t.ok, pct: t.pct }, byModule: t.byModule };
  });
}

export interface WeekRetention extends WeekRef, Retention {}

export function retentionByWeek(days: Map<string, DayAgg>, weeks: readonly WeekRef[]): WeekRetention[] {
  return weeks.map((w) => ({ ...w, ...reviewRetention(days, w.key, w.end) }));
}

export interface WeekCount extends WeekRef {
  count: number;
}

/** Lessons passed (first pass, lessons-progress completedAt) per week. */
export function lessonsPassedByWeek(
  progress: Readonly<Record<string, { completedAt?: number } | undefined>> | null | undefined,
  weeks: readonly WeekRef[],
): WeekCount[] {
  const passDays: string[] = [];
  for (const r of Object.values(progress ?? {})) {
    const t = r?.completedAt;
    if (finite(t) && t > 0) passDays.push(dayOf(t));
  }
  return weeks.map((w) => ({ ...w, count: passDays.filter((d) => d >= w.key && d <= w.end).length }));
}

export interface WeekCumulative extends WeekRef {
  total: number; // learned words at the end of the week
  added: number; // graduated during the week
}

/** Cumulative words learned at the end of each week, starting from the backfilled count. */
export function wordsLearnedCumulative(store: HistoryStore, weeks: readonly WeekRef[], days: Map<string, DayAgg> = historyDays(store)): WeekCumulative[] {
  const start = store.base?.wordsLearned ?? 0;
  return weeks.map((w) => ({
    ...w,
    total: start + wordsLearnedBetween(days, undefined, w.end),
    added: wordsLearnedBetween(days, w.key, w.end),
  }));
}

/** Words learned in all: backfilled count + every first graduation since. */
export function wordsLearnedTotal(store: HistoryStore, days: Map<string, DayAgg> = historyDays(store)): number {
  return (store.base?.wordsLearned ?? 0) + wordsLearnedBetween(days);
}

// ───────────────────────── backfill (pure) ─────────────────────────

interface AttemptLike {
  at?: unknown;
  module?: unknown;
  correct?: unknown;
}

const isModule = (m: unknown): m is ModuleId => typeof m === 'string' && (HISTORY_MODULES as readonly string[]).includes(m);

/** Graduated now (interval ≥ 1 day after a success) or graduated once and later forgotten. */
export function isLearnedCard(c: unknown): boolean {
  if (!isObj(c)) return false;
  return (count(c.reps) > 0 && finite(c.interval) && c.interval >= 1) || count(c.lapses) > 0;
}

/** Word cards of a stored review value that count as learned. */
export function countLearnedWords(reviewRaw: unknown): number {
  const cards = isObj(reviewRaw) && isObj(reviewRaw.cards) ? reviewRaw.cards : {};
  let n = 0;
  for (const [id, c] of Object.entries(cards)) if (id.startsWith('word:') && isLearnedCard(c)) n += 1;
  return n;
}

/** The one-off backfill: attempts before `until` per day and module, plus the learned words of now. */
export function buildBase(attempts: unknown, reviewRaw: unknown, until: number): HistoryBase {
  const days: Record<string, DayAgg> = {};
  if (Array.isArray(attempts)) {
    const seen = new Set<string>();
    for (const raw of attempts as AttemptLike[]) {
      if (!raw || !finite(raw.at) || raw.at >= until || !isModule(raw.module)) continue;
      const key = `${raw.at}|${raw.module}|${String((raw as { itemId?: unknown }).itemId)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const agg = (days[dayOf(raw.at)] ??= {});
      agg.mod ??= {};
      const cur = (agg.mod[raw.module] ??= { n: 0, ok: 0 });
      cur.n += 1;
      if (raw.correct === true) cur.ok += 1;
    }
  }
  return { until, days, wordsLearned: countLearnedWords(reviewRaw) };
}

// ───────────────────────── store (IO) ─────────────────────────

let memDeviceId: string | null = null;

/** This browser's random id (device-local key, never synced). */
export function deviceId(rand: () => number = Math.random): string {
  const stored = loadJSON<unknown>(KEYS.deviceId, null);
  if (typeof stored === 'string' && /^[a-z0-9-]{4,40}$/.test(stored)) return stored;
  if (memDeviceId) return memDeviceId;
  const id = 'd-' + Math.floor(rand() * 36 ** 8).toString(36).padStart(8, '0');
  memDeviceId = id;
  saveJSON(KEYS.deviceId, id);
  return id;
}

/** Set only while the last write failed: this session's archive lives here. */
let session: HistoryStore | null = null;

function readStore(): HistoryStore {
  const stored = parseHistory(loadJSON<unknown>(KEYS.history, null));
  return session ? mergeHistoryStores(session, stored) : stored;
}

function writeStore(s: HistoryStore): boolean {
  const ok = saveJSON(KEYS.history, s);
  session = ok ? null : s;
  return ok;
}

/** Build the backfill if this archive has none yet (after the boot sync, so a synced base is reused). */
function withBase(s: HistoryStore, now: number): HistoryStore {
  if (s.base) return s;
  const stats = loadJSON<{ attempts?: unknown } | null>(KEYS.stats, null);
  return { ...s, base: buildBase(stats?.attempts, loadJSON<unknown>(KEYS.review, null), now) };
}

/** The archive, backfilled on first use (writes once). Never throws. */
export function loadHistory(now: number = Date.now()): HistoryStore {
  try {
    const s = readStore();
    if (s.base) return s;
    const next = withBase(s, now);
    writeStore(next);
    return next;
  } catch {
    return session ?? emptyHistory();
  }
}

function bump(at: number, apply: (agg: DayAgg) => void): void {
  try {
    const s = withBase(readStore(), at);
    const dev = deviceId();
    const days = { ...(s.devices[dev] ?? {}) };
    const day = dayOf(at);
    const agg = structuredClone(days[day] ?? {});
    apply(agg);
    days[day] = agg;
    writeStore({ ...s, devices: { ...s.devices, [dev]: days } });
  } catch {
    // the archive is best effort: practice itself is saved elsewhere
  }
}

/** One practice attempt (called by core/stats recordAttempt). */
export function noteAttempt(module: ModuleId, correct: boolean, at: number = Date.now()): void {
  if (!isModule(module)) return;
  bump(at, (agg) => {
    agg.mod ??= {};
    const cur = (agg.mod[module] ??= { n: 0, ok: 0 });
    cur.n += 1;
    if (correct) cur.ok += 1;
  });
}

export interface ReviewGradeNote {
  grade: Grade;
  /** The card had graduated (reps > 0 and interval ≥ 1 day) before this grade: counts for retention. */
  graduated: boolean;
  /** Given in Ôn tập (context 'review' or a chunk graded there): counts in the grade split. */
  inReview: boolean;
  /** A word card graduated for the first time with this grade. */
  wordLearned?: boolean;
}

/** One grade that changed a card's schedule (called by core/review/api). */
export function noteReviewGrade(note: ReviewGradeNote, at: number = Date.now()): void {
  if (!GRADES.includes(note.grade)) return;
  if (!note.inReview && !note.graduated && !note.wordLearned) return;
  bump(at, (agg) => {
    if (note.inReview) {
      agg.grades ??= { again: 0, hard: 0, good: 0, easy: 0 };
      agg.grades[note.grade] += 1;
    }
    if (note.graduated) {
      agg.ret ??= { n: 0, again: 0 };
      agg.ret.n += 1;
      if (note.grade === 'again') agg.ret.again += 1;
    }
    if (note.wordLearned) agg.words = (agg.words ?? 0) + 1;
  });
}

/** Forget the archive (it is rebuilt from the attempts still stored on next use). */
export function resetHistory(): void {
  session = null;
  saveJSON(KEYS.history, emptyHistory());
}
