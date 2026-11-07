// Pure helpers for the "Hôm nay" page.

import type { ListeningLine, PlanItem } from '../../core/goals';
import { localDay } from '../../core/stats';

export function greeting(hour: number): string {
  if (!Number.isFinite(hour)) return 'Xin chào';
  if (hour >= 4 && hour < 11) return 'Chào buổi sáng';
  if (hour >= 11 && hour < 13) return 'Chào buổi trưa';
  if (hour >= 13 && hour < 18) return 'Chào buổi chiều';
  if (hour >= 18 && hour < 22) return 'Chào buổi tối';
  return 'Khuya rồi';
}

/** "Thứ Sáu, 6 tháng 11" */
export function formatDateVi(now: number): string {
  const d = new Date(now);
  const weekday = d.getDay() === 0 ? 'Chủ Nhật' : `Thứ ${['', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy'][d.getDay()]}`;
  return `${weekday}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
}

/** FNV-1a 32-bit hash: stable across sessions and browsers. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic pick for the local calendar day of `now`; the same all day long. */
export function pickOfTheDay<T>(items: readonly T[], now: number): T | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[hashString('sentence-of-day:' + localDay(now)) % items.length] ?? null;
}

export interface OnboardingState {
  done: boolean;
}

export function parseOnboarding(raw: unknown): OnboardingState {
  if (raw === true) return { done: true };
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).done === true) return { done: true };
  return { done: false };
}

/** "1 ngày" / "5 ngày" style counts without English plural quirks. */
export function streakLabel(streak: number): string {
  const n = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  return n === 0 ? 'Chưa có chuỗi' : `${n} ngày liên tiếp`;
}

/**
 * The "Hôm nay" card: unfinished items stay as rows in plan order (the back-pressure line included); finished
 * items collapse into one "N việc đã xong" line.
 */
export function splitPlan(items: readonly PlanItem[]): { open: PlanItem[]; done: PlanItem[] } {
  const list = Array.isArray(items) ? items : [];
  return { open: list.filter((it) => !it.done), done: list.filter((it) => it.done && !it.muted) };
}

/**
 * Text of Hôm nay's listening row. Before anything is logged today it states the goal instead of "0/30 phút"
 * (no zeros for a learner who has not started).
 */
export function listenRowText(line: Pick<ListeningLine, 'minutes' | 'goal' | 'title' | 'detail' | 'timerLabel' | 'actionLabel'>): {
  title: string;
  detail: string | null;
  action: string;
} {
  const fresh = line.minutes <= 0;
  const title = fresh ? (line.goal > 0 ? `Nghe tiếng Anh ${line.goal} phút` : 'Nghe tiếng Anh') : line.title;
  const detail = line.timerLabel ?? (fresh ? 'Phim, YouTube, podcast… rồi ghi lại giờ nghe' : line.detail);
  return { title, detail, action: line.timerLabel ? 'Mở đồng hồ' : line.actionLabel };
}
