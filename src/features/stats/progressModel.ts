// Whole-app progress helpers for "Tiến độ": modules, weeks, heatmap, lessons.
// Pure functions: no DOM, no storage. Callers pass data and `now` in.

import type { Phenomenon } from '../../core/types';
import { localDay, MODULE_LABEL, type Attempt, type ModuleId } from '../../core/stats';
import { sortLessons, type LessonMeta, type LessonProgress } from '../../core/lessons';
import type { RouteId } from '../../core/nav';
import { startOfLocalDay, type MissRate, type WeaknessReport } from './statsModel';

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

/** Every module in canonical order (the order of MODULE_LABEL). */
export const MODULES = Object.keys(MODULE_LABEL) as ModuleId[];

/** Page each module lives on. */
export const MODULE_ROUTE: Record<ModuleId, RouteId> = {
  dictation: 'dictation',
  drill: 'drill',
  decoder: 'decoder',
  lesson: 'lessons',
  pairs: 'pairs',
  shadowing: 'shadowing',
  media: 'media',
};

/**
 * Modules that do not record attempts by design (the decoder is a reading tool).
 * They only appear in the breakdown when they do have data.
 */
const UNSCORED_MODULES: readonly ModuleId[] = ['decoder'];

export function isModuleId(m: unknown): m is ModuleId {
  return typeof m === 'string' && (MODULES as readonly string[]).includes(m);
}

export interface Tally {
  total: number;
  correct: number;
  pct: number | null; // rounded 0..100, null when total is 0
}

export function tally(list: readonly Attempt[]): Tally {
  const total = list.length;
  let correct = 0;
  for (const a of list) if (a.correct) correct += 1;
  return { total, correct, pct: total > 0 ? Math.round((correct / total) * 100) : null };
}

export interface ModuleRow {
  module: ModuleId;
  label: string;
  route: RouteId;
  week: Tally; // last 7 local calendar days (today + 6 before)
  all: Tally;
  lastAt: number | null;
}

/**
 * Attempts and accuracy per module. Practised modules come first (most attempts first),
 * then untouched ones in canonical order. Unknown module ids are ignored.
 */
export function moduleBreakdown(attempts: readonly Attempt[], now: number): ModuleRow[] {
  const since = startOfLocalDay(now, 6);
  const until = startOfLocalDay(now, -1);
  const groups = new Map<ModuleId, Attempt[]>();
  for (const a of attempts) {
    if (!isModuleId(a.module)) continue;
    const g = groups.get(a.module);
    if (g) g.push(a);
    else groups.set(a.module, [a]);
  }
  const rows: ModuleRow[] = [];
  for (const m of MODULES) {
    const list = groups.get(m) ?? [];
    if (list.length === 0 && UNSCORED_MODULES.includes(m)) continue;
    let lastAt: number | null = null;
    for (const a of list) if (lastAt == null || a.at > lastAt) lastAt = a.at;
    rows.push({
      module: m,
      label: MODULE_LABEL[m],
      route: MODULE_ROUTE[m],
      week: tally(list.filter((a) => a.at >= since && a.at < until)),
      all: tally(list),
      lastAt,
    });
  }
  const order = (m: ModuleId) => MODULES.indexOf(m);
  rows.sort((a, b) => b.all.total - a.all.total || order(a.module) - order(b.module));
  return rows;
}

// ---------------------------------------------------------------------------
// Weeks + trend
// ---------------------------------------------------------------------------

function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Local Monday 00:00 of the week containing `ts` (weeks start on Monday; DST-safe). */
export function startOfLocalWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** "YYYY-MM-DD" of the Monday starting the week that contains `ts`. */
export function weekKey(ts: number): string {
  return localDay(startOfLocalWeek(ts));
}

export interface WeekBucket {
  key: string; // YYYY-MM-DD of the Monday
  start: number; // epoch ms, local Monday 00:00
  label: string; // dd/mm of the Monday
  rangeLabel: string; // "dd/mm – dd/mm"
  total: number;
  correct: number;
  pct: number | null;
  isCurrent: boolean;
  /**
   * How much of the week is still in storage: 'none' when the week ended before the oldest
   * kept attempt (older details were trimmed), 'partial' when the trim point falls inside it.
   */
  coverage: 'full' | 'partial' | 'none';
}

/**
 * Accuracy per calendar week (Monday–Sunday), oldest first, ending with the current week.
 * `keptFrom` is the timestamp of the oldest attempt still stored when older ones were trimmed.
 */
export function weeklyAccuracy(
  attempts: readonly Attempt[],
  now: number,
  n = 8,
  keptFrom: number | null = null,
): WeekBucket[] {
  const current = startOfLocalWeek(now);
  const buckets: WeekBucket[] = [];
  const index = new Map<string, WeekBucket>();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * i);
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    const b: WeekBucket = {
      key: localDay(d.getTime()),
      start: d.getTime(),
      label: ddmm(d),
      rangeLabel: `${ddmm(d)} – ${ddmm(end)}`,
      total: 0,
      correct: 0,
      pct: null,
      isCurrent: i === 0,
      coverage: 'full',
    };
    if (keptFrom != null) {
      const next = new Date(d);
      next.setDate(next.getDate() + 7);
      if (next.getTime() <= keptFrom) b.coverage = 'none';
      else if (d.getTime() < keptFrom) b.coverage = 'partial';
    }
    buckets.push(b);
    index.set(b.key, b);
  }
  for (const a of attempts) {
    const b = index.get(weekKey(a.at));
    if (!b) continue;
    b.total += 1;
    if (a.correct) b.correct += 1;
  }
  for (const b of buckets) b.pct = b.total > 0 ? Math.round((b.correct / b.total) * 100) : null;
  return buckets;
}

/** Valid "YYYY-MM-DD" strings from storage plus every day that has a kept attempt; sorted, unique. */
export function mergeActiveDays(stored: unknown, attempts: readonly Attempt[]): string[] {
  const set = new Set<string>();
  if (Array.isArray(stored)) for (const d of stored) if (isDayKey(d)) set.add(d);
  for (const a of attempts) set.add(localDay(a.at));
  return [...set].sort();
}

function isDayKey(d: unknown): d is string {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  return m >= 1 && m <= 12 && day >= 1 && day <= 31 && y > 1970;
}

export interface HistoryInfo {
  /** True when storage only keeps the most recent attempts and older ones were dropped. */
  trimmed: boolean;
  /** Timestamp of the oldest kept attempt (null when there are none). */
  oldestAt: number | null;
}

/** Detects trimmed history: active days recorded before the oldest kept attempt. */
export function historyInfo(attempts: readonly Attempt[], activeDays: readonly string[]): HistoryInfo {
  let oldestAt: number | null = null;
  for (const a of attempts) if (oldestAt == null || a.at < oldestAt) oldestAt = a.at;
  if (oldestAt == null) return { trimmed: false, oldestAt };
  const oldestDay = localDay(oldestAt);
  return { trimmed: activeDays.some((d) => d < oldestDay), oldestAt };
}

export interface TrendBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TrendPoint {
  index: number; // slot in the weeks array
  x: number;
  y: number;
  pct: number;
}

/** x of slot `i` among `n` evenly spaced slots inside the box. */
export function trendX(i: number, n: number, box: TrendBox): number {
  const innerW = box.width - box.left - box.right;
  const x = n > 1 ? box.left + (i * innerW) / (n - 1) : box.left + innerW / 2;
  return Math.round(x * 10) / 10;
}

/** y of an accuracy value (0 at the bottom, 100 at the top). */
export function trendY(pct: number, box: TrendBox): number {
  const innerH = box.height - box.top - box.bottom;
  const p = Math.min(100, Math.max(0, pct));
  return Math.round((box.top + (1 - p / 100) * innerH) * 10) / 10;
}

/** SVG coordinates for the weeks that have data. Weeks without data are skipped. */
export function trendPoints(weeks: readonly WeekBucket[], box: TrendBox): TrendPoint[] {
  const out: TrendPoint[] = [];
  weeks.forEach((w, i) => {
    if (w.pct == null) return;
    out.push({ index: i, x: trendX(i, weeks.length, box), y: trendY(w.pct, box), pct: w.pct });
  });
  return out;
}

/** Change in accuracy between the two most recent weeks that have data, or null. */
export function trendDelta(weeks: readonly WeekBucket[]): number | null {
  const withData = weeks.filter((w) => w.pct != null);
  if (withData.length < 2) return null;
  return (withData[withData.length - 1].pct as number) - (withData[withData.length - 2].pct as number);
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

export const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;
export const WEEKDAY_LONG = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'] as const;

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  day: string; // YYYY-MM-DD local
  label: string; // dd/mm/yyyy
  weekday: number; // 0 = Monday … 6 = Sunday
  count: number;
  correct: number;
  level: HeatLevel;
  future: boolean;
  isToday: boolean;
  /** Practised that day, but the attempt details are no longer stored (trimmed history). */
  archived: boolean;
}

export interface HeatColumn {
  key: string; // YYYY-MM-DD of the Monday
  monthLabel: string | null; // "Th11" when a month starts in this column
  cells: HeatCell[]; // always 7, Monday first
}

export interface Heatmap {
  columns: HeatColumn[];
  total: number;
  activeDays: number;
  max: number;
  firstDay: string;
  lastDay: string; // today
}

/** 0 for no activity, otherwise 1..4 relative to the busiest day. */
export function heatLevel(count: number, max: number): HeatLevel {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as HeatLevel;
}

/**
 * GitHub-style activity grid: `weeks` columns (oldest first), each Monday → Sunday,
 * the last column being the current week. Days after today are marked `future`.
 */
export function activityHeatmap(
  attempts: readonly Attempt[],
  now: number,
  weeks = 12,
  knownDays: readonly string[] = [],
): Heatmap {
  const counts = new Map<string, { count: number; correct: number }>();
  for (const a of attempts) {
    const k = localDay(a.at);
    const c = counts.get(k) ?? { count: 0, correct: 0 };
    c.count += 1;
    if (a.correct) c.correct += 1;
    counts.set(k, c);
  }
  const today = localDay(now);
  let oldestKept: string | null = null;
  for (const k of counts.keys()) if (oldestKept == null || k < oldestKept) oldestKept = k;
  // Days recorded as active before the oldest kept attempt: practised, details trimmed.
  const archivedDays = new Set(knownDays.filter((d) => oldestKept == null || d < oldestKept));
  const cursor = new Date(startOfLocalWeek(now));
  cursor.setDate(cursor.getDate() - 7 * (weeks - 1));
  cursor.setHours(12, 0, 0, 0); // midday: stepping by days never lands in a DST gap

  const columns: HeatColumn[] = [];
  let total = 0;
  let activeDays = 0;
  let max = 0;
  for (let w = 0; w < weeks; w++) {
    const cells: HeatCell[] = [];
    let monthStart: Date | null = null;
    const monday = new Date(cursor);
    for (let wd = 0; wd < 7; wd++) {
      const d = new Date(cursor);
      const day = localDay(d.getTime());
      if (d.getDate() === 1) monthStart = d;
      const future = day > today;
      const c = future ? undefined : counts.get(day);
      const count = c?.count ?? 0;
      const archived = !future && count === 0 && archivedDays.has(day);
      if (count > 0) {
        total += count;
        max = Math.max(max, count);
      }
      if (count > 0 || archived) activeDays += 1;
      cells.push({
        day,
        label: `${ddmm(d)}/${d.getFullYear()}`,
        weekday: wd,
        count,
        correct: c?.correct ?? 0,
        level: 0,
        future,
        isToday: day === today,
        archived,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    let monthLabel: string | null = null;
    if (monthStart) monthLabel = `Th${monthStart.getMonth() + 1}`;
    // First column names its month unless a new month begins right after (labels would collide).
    else if (w === 0 && monday.getDate() <= 14) monthLabel = `Th${monday.getMonth() + 1}`;
    columns.push({ key: cells[0].day, monthLabel, cells });
  }
  for (const col of columns) for (const c of col.cells) c.level = c.archived ? 1 : heatLevel(c.count, max);
  return {
    columns,
    total,
    activeDays,
    max,
    firstDay: columns[0]?.key ?? today,
    lastDay: today,
  };
}

/** Tooltip / screen-reader text for one heatmap day. */
export function heatCellText(c: HeatCell): string {
  const head = `${WEEKDAY_LONG[c.weekday] ?? ''}, ${c.label}`;
  if (c.future) return `${head}: chưa tới`;
  if (c.archived) return `${head}: có luyện (không còn số liệu chi tiết)`;
  if (c.count === 0) return `${head}: không luyện`;
  const pct = Math.round((c.correct / c.count) * 100);
  return `${head}: ${c.count} lượt, ${pct}% đúng`;
}

/**
 * Keyboard movement inside the heatmap (column-major, 7 rows): Up/Down = ±1 day,
 * Left/Right = ±1 week, Home/End = first day / today. Never lands on a future day.
 */
export function moveHeatFocus(index: number, key: string, cellCount: number, lastIndex: number): number {
  let next = index;
  if (key === 'ArrowUp') next = index - 1;
  else if (key === 'ArrowDown') next = index + 1;
  else if (key === 'ArrowLeft') next = index - 7;
  else if (key === 'ArrowRight') next = index + 7;
  else if (key === 'Home') next = 0;
  else if (key === 'End') next = lastIndex;
  if (next < 0 || next >= cellCount) return index;
  return Math.min(next, lastIndex);
}

// ---------------------------------------------------------------------------
// Streaks, goal, lessons, weakness
// ---------------------------------------------------------------------------

/** Longest run of consecutive local days in a list of "YYYY-MM-DD" strings (junk ignored). */
export function longestStreak(days: unknown): number {
  if (!Array.isArray(days)) return 0;
  const valid = [...new Set(days.filter(isDayKey))].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of valid) {
    if (prev) {
      const [y, m, d] = prev.split('-').map(Number);
      const next = localDay(new Date(y, m - 1, d + 1, 12).getTime());
      run = next === day ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

/** Number of attempts (any module) on the local calendar day of `now`. */
export function attemptsTodayCount(attempts: readonly Attempt[], now: number): number {
  const today = localDay(now);
  let n = 0;
  for (const a of attempts) if (localDay(a.at) === today) n += 1;
  return n;
}

/**
 * Daily goal from settings: clamped to 10–100 and snapped to steps of 5 (default 30),
 * the same rule the nav badge and settings slider use, so every page shows the same goal.
 */
export function sanitizeGoal(g: unknown): number {
  if (typeof g !== 'number' || !Number.isFinite(g)) return 30;
  return Math.min(100, Math.max(10, Math.round(g / 5) * 5));
}

export interface LessonSummary {
  total: number;
  completed: number;
  pct: number; // 0..100
  next: LessonMeta | null; // first lesson (by course, then order) not yet completed
  avgBest: number | null; // average best quiz score (0..100) over lessons attempted
}

export function lessonSummary(lessons: readonly LessonMeta[], progress: LessonProgress): LessonSummary {
  const sorted = sortLessons(lessons);
  let completed = 0;
  let next: LessonMeta | null = null;
  let scoreSum = 0;
  let scored = 0;
  for (const l of sorted) {
    const r = progress[l.id];
    const done = !!r && r.completedAt > 0;
    if (done) completed += 1;
    else if (!next) next = l;
    if (r && Number.isFinite(r.bestScore)) {
      scoreSum += Math.min(1, Math.max(0, r.bestScore));
      scored += 1;
    }
  }
  const total = sorted.length;
  return {
    total,
    completed,
    pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    next,
    avgBest: scored > 0 ? Math.round((scoreSum / scored) * 100) : null,
  };
}

/** Lesson of course "connected" that teaches `p`; falls back to the phenomenon id (lesson ids mirror phenomenon ids). */
export function lessonIdFor(p: Phenomenon, lessons: readonly LessonMeta[]): string {
  return lessons.find((l) => l.course === 'connected' && l.phenomenon === p)?.id ?? p;
}

/** The phenomenon to recommend: the worst ranked one that has actually been missed. */
export function weakestPhenomenon(report: WeaknessReport): MissRate | null {
  return report.ranked.find((r) => r.missed > 0) ?? null;
}
