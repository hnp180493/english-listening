// Pure helpers for the "Tiến độ" page. No DOM, no storage: easy to unit test.

import { PHENOMENA, type Phenomenon } from '../../core/types';
import { localDay, MODULE_LABEL, type Attempt, type ModuleId, type PhenomenonStat } from '../../core/stats';

const DAY_MS = 24 * 60 * 60 * 1000;

export const MIN_SEEN = 3;

const MODULE_IDS = Object.keys(MODULE_LABEL) as ModuleId[];

function isKnownModule(m: unknown): m is ModuleId {
  return typeof m === 'string' && (MODULE_IDS as readonly string[]).includes(m);
}

export function moduleLabel(m: string): string {
  return isKnownModule(m) ? MODULE_LABEL[m] : m;
}

/**
 * Drop or repair malformed attempts that may come from old or hand-edited storage,
 * so rendering never meets an object where it expects a string.
 */
export function validAttempts(attempts: unknown): Attempt[] {
  if (!Array.isArray(attempts)) return [];
  const out: Attempt[] = [];
  for (const raw of attempts) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    if (typeof a.at !== 'number' || !Number.isFinite(a.at)) continue;
    // Unknown modules (old or hand-edited data) are dropped, like the nav badge does.
    if (!isKnownModule(a.module)) continue;
    const itemId = typeof a.itemId === 'string' || typeof a.itemId === 'number' ? String(a.itemId) : '';
    const phen = (v: unknown): Phenomenon[] =>
      Array.isArray(v) ? (v.filter((x) => (PHENOMENA as readonly unknown[]).includes(x)) as Phenomenon[]) : [];
    out.push({
      at: a.at,
      module: a.module,
      itemId,
      correct: a.correct === true,
      seen: phen(a.seen),
      missed: phen(a.missed),
    });
  }
  return out;
}

export interface MissRate {
  phenomenon: Phenomenon;
  seen: number;
  missed: number;
  rate: number; // 0..1
}

export interface WeaknessReport {
  ranked: MissRate[]; // seen >= MIN_SEEN, worst first
  insufficient: MissRate[]; // seen < MIN_SEEN
}

export function weaknessReport(by: Partial<Record<Phenomenon, PhenomenonStat>>): WeaknessReport {
  const ranked: MissRate[] = [];
  const insufficient: MissRate[] = [];
  for (const p of PHENOMENA) {
    const s = by[p];
    const seen = s && Number.isFinite(s.seen) ? Math.max(0, s.seen) : 0;
    const missed = s && Number.isFinite(s.missed) ? Math.max(0, Math.min(s.missed, seen)) : 0;
    const row: MissRate = { phenomenon: p, seen, missed, rate: seen > 0 ? missed / seen : 0 };
    (seen >= MIN_SEEN ? ranked : insufficient).push(row);
  }
  ranked.sort((a, b) => b.rate - a.rate || b.missed - a.missed || b.seen - a.seen);
  insufficient.sort((a, b) => b.seen - a.seen);
  return { ranked, insufficient };
}

/** Local midnight `daysBack` calendar days before `now` (DST-safe). */
export function startOfLocalDay(now: number, daysBack = 0): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d.getTime();
}

/**
 * Share of correct attempts over the last 7 local calendar days (today + 6 days before),
 * the same days the activity chart uses. null if there were none.
 */
export function accuracyLast7Days(attempts: Attempt[], now: number): { pct: number | null; total: number } {
  const since = startOfLocalDay(now, 6);
  const until = startOfLocalDay(now, -1); // next local midnight
  const recent = attempts.filter((a) => a.at >= since && a.at < until);
  if (recent.length === 0) return { pct: null, total: 0 };
  const ok = recent.filter((a) => a.correct).length;
  return { pct: Math.round((ok / recent.length) * 100), total: recent.length };
}

/** "vừa xong", "5 phút trước", "3 giờ trước", "hôm qua", "4 ngày trước", or dd/mm/yyyy. */
export function relativeTimeVi(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hours = Math.floor(min / 60);
  if (hours < 24 && localDay(ts) === localDay(now)) return `${hours} giờ trước`;
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(ts)) / DAY_MS);
  if (days <= 1) return 'hôm qua';
  if (days < 7) return `${days} ngày trước`;
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Most recent first. */
export function recentAttempts(attempts: Attempt[], n = 10): Attempt[] {
  return [...attempts].sort((a, b) => b.at - a.at).slice(0, n);
}

// ───────────────────────── Ôn tập forecast ─────────────────────────

/** One day of the review forecast (shape of core/review ForecastDay; kept structural so this file stays pure). */
export interface ForecastDayLike {
  day: string; // local 'YYYY-MM-DD'
  offset: number; // 0 = today
  count: number;
  seconds: number;
}

export interface ForecastBar {
  key: string;
  label: string; // "Hôm nay", "Mai", "T2"…"CN"
  longLabel: string; // for screen readers: "Hôm nay", "Ngày mai", "Thứ Hai"…
  count: number;
  minutes: number; // ceil(seconds / 60), 0 when nothing
  pct: number; // bar height 0..100 relative to the busiest day (min 6 when count > 0)
  isToday: boolean;
}

const WD_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WD_LONG = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function weekdayOf(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d.getDay();
}

/** Label of a forecast day: offset 0 "Hôm nay", 1 "Mai", then the weekday ("T2"…"CN"). */
export function forecastLabel(day: string, offset: number): { short: string; long: string } {
  if (offset === 0) return { short: 'Hôm nay', long: 'Hôm nay' };
  if (offset === 1) return { short: 'Mai', long: 'Ngày mai' };
  const wd = weekdayOf(day);
  return wd === null ? { short: day, long: day } : { short: WD_SHORT[wd], long: WD_LONG[wd] };
}

/**
 * The forecast with today's bar set to what today's sessions serve (summary.dueToday / dueTodaySec): the nav
 * badge's number. The raw forecast also counts cards due later today and the backlog held back for later days,
 * so "Hôm nay" read higher than the badge right after a session.
 */
export function withTodayCount<T extends ForecastDayLike>(days: readonly T[], today: { count: number; seconds: number }): T[] {
  return days.map((d) => (d.offset === 0 ? { ...d, count: today.count, seconds: today.seconds } : d));
}

/** Bars for the 7-day review forecast (today = what today's sessions serve, see withTodayCount). */
export function forecastBars(days: readonly ForecastDayLike[]): ForecastBar[] {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  const max = days.reduce((m, d) => Math.max(m, n(d.count)), 0);
  return days.map((d) => {
    const count = n(d.count);
    const { short, long } = forecastLabel(d.day, d.offset);
    return {
      key: d.day,
      label: short,
      longLabel: long,
      count,
      minutes: count > 0 ? Math.max(1, Math.ceil(n(d.seconds) / 60)) : 0,
      pct: max > 0 && count > 0 ? Math.max(6, Math.round((count / max) * 100)) : 0,
      isToday: d.offset === 0,
    };
  });
}
