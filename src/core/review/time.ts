// Local-calendar helpers for the review layer. Day arithmetic goes through the Date constructor
// (DST-safe), never `+ k * DAY`. Imports only core/stats (no cycle with core/srs).

import { localDay } from '../stats';

export { localDay };

const MINUTE = 60_000;

/** Local midnight of `ts`'s day, shifted by `offsetDays` calendar days. */
export function startOfLocalDay(ts: number, offsetDays = 0): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays).getTime();
}

/** Local midnight that starts the day after `now`. */
export function nextLocalMidnight(now: number): number {
  return startOfLocalDay(now, 1);
}

/** Calendar days from the local day of `from` to the local day of `to` (negative when `to` is earlier). */
export function localDayDiff(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** "3 ngày", "2 tuần", "4 tháng" (at least 1 in each unit). */
export function formatDaysVi(days: number): string {
  const d = Math.max(1, Math.round(days));
  if (d <= 6) return `${d} ngày`;
  if (d <= 59) return `${Math.max(1, Math.round(d / 7))} tuần`;
  return `${Math.max(1, Math.round(d / 30))} tháng`;
}

/**
 * When something available at `at` comes back, said from `now`:
 * "bây giờ", "sau 5 phút", "lúc 21:30", "ngày mai", "sau 3 ngày".
 */
export function formatDueVi(at: number, now: number): string {
  if (at <= now) return 'bây giờ';
  if (at - now < 60 * MINUTE) return `sau ${Math.max(1, Math.round((at - now) / MINUTE))} phút`;
  if (localDay(at) === localDay(now)) {
    const d = new Date(at);
    return `lúc ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const days = localDayDiff(now, at);
  return days === 1 ? 'ngày mai' : `sau ${formatDaysVi(days)}`;
}
