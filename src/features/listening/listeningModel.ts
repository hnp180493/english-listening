// Pure helpers for the "Nhật ký nghe" page: labels, form validation, the summary numbers.
// Data and rules live in src/core/listening.ts; this file only shapes them for the UI.

import {
  addDays,
  formatMinutesVi,
  isDay,
  LISTENING_SOURCES,
  MAX_MINUTES,
  minutesBetween,
  minutesOnDay,
  nextMilestone,
  SOURCE_LABEL,
  SUBTITLE_LABEL,
  TITLE_MAX,
  totalMinutes,
  UNDERSTOOD_LABEL,
  validateMinutes,
  weekStartDay,
  listeningDays,
  type ListeningEntry,
  type ListeningInput,
  type ListeningSource,
  type Milestone,
  type SubtitleMode,
  type TimerStatus,
  type Understood,
} from '../../core/listening';
import { localDay } from '../../core/stats';

/** Days of history the "Gần đây" list shows. */
export const RECENT_DAYS = 30;
/** Rows before "Xem thêm". */
export const RECENT_PAGE = 10;

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** "Hôm nay", "Hôm qua", "Thứ Ba, 03/11". */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Hôm nay';
  if (day === addDays(today, -1)) return 'Hôm qua';
  if (!isDay(day)) return day;
  const [y, m, d] = day.split('-').map(Number);
  const wd = WEEKDAY[new Date(y, m - 1, d).getDay()];
  return `${wd}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** The source the forms start with: the latest hand-logged source (the app logs its own videos), else films. */
export function defaultSource(entries: readonly ListeningEntry[]): ListeningSource {
  const hit = entries.find((e) => e.source !== 'app');
  return hit ? hit.source : 'phim';
}

/** Sources a learner can pick by hand ('app' is logged automatically by the in-app player, but stays editable). */
export const PICKABLE_SOURCES: readonly ListeningSource[] = LISTENING_SOURCES;

// ───────────────────────── form ─────────────────────────

export interface EntryForm {
  minutes: string; // raw input text
  source: ListeningSource;
  title: string;
  understood: Understood | null;
  subtitles: SubtitleMode | null;
  day: string; // 'YYYY-MM-DD'
}

export interface FormErrors {
  minutes?: string;
}

export function emptyForm(entries: readonly ListeningEntry[], now: number, minutes = ''): EntryForm {
  return { minutes, source: defaultSource(entries), title: '', understood: null, subtitles: null, day: localDay(now) };
}

export function formFromEntry(e: ListeningEntry): EntryForm {
  return {
    minutes: String(e.minutes),
    source: e.source,
    title: e.title ?? '',
    understood: e.understood ?? null,
    subtitles: e.subtitles ?? null,
    day: e.day,
  };
}

/** Error text for the minutes field, or null when it is fine. */
export function minutesError(raw: string): string | null {
  const t = raw.trim();
  if (!t) return 'Nhập số phút đã nghe.';
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n)) return 'Số phút phải là một con số.';
  if (Math.round(n) < 1) return 'Ít nhất 1 phút.';
  if (Math.round(n) > MAX_MINUTES) return `Tối đa ${MAX_MINUTES} phút (${MAX_MINUTES / 60} giờ) cho một lần ghi.`;
  return null;
}

/** The form as a ListeningInput, or the errors that block saving. */
export function readForm(f: EntryForm): { input: ListeningInput | null; errors: FormErrors } {
  const err = minutesError(f.minutes);
  if (err) return { input: null, errors: { minutes: err } };
  const minutes = validateMinutes(Number(f.minutes.trim().replace(',', '.')));
  if (minutes === null) return { input: null, errors: { minutes: 'Ít nhất 1 phút.' } };
  const input: ListeningInput = {
    minutes,
    source: f.source,
    title: f.title.slice(0, TITLE_MAX),
    understood: f.understood,
    subtitles: f.subtitles,
    day: isDay(f.day) ? f.day : undefined,
  };
  return { input, errors: {} };
}

/** Minutes typed in the field, when they match one of the quick chips (so the chip shows as selected). */
export function chipSelected(raw: string, chip: number): boolean {
  return raw.trim() !== '' && Number(raw.trim()) === chip;
}

// ───────────────────────── list rows ─────────────────────────

/** Row title: "45 phút · Friends" / "45 phút". */
export function entryTitle(e: ListeningEntry): string {
  return e.title ? `${formatMinutesVi(e.minutes)} · ${e.title}` : formatMinutesVi(e.minutes);
}

/** Short source names for the narrow row meta ("Video thật trong app" is too long for a phone row). */
const SOURCE_SHORT: Partial<Record<ListeningEntry['source'], string>> = { app: 'Video trong app' };

/**
 * Row meta segments: ["Hôm nay", "Phim/series", "Hiểu 70–90%", "Phụ đề Anh"]. The list renders each as an
 * unbreakable span, so a phone wraps only between segments ("Hiểu 70–" never ends a line).
 */
export function entryMetaParts(e: ListeningEntry, today: string): string[] {
  const parts = [dayLabel(e.day, today), SOURCE_SHORT[e.source] ?? SOURCE_LABEL[e.source]];
  if (e.understood) parts.push(`Hiểu ${UNDERSTOOD_LABEL[e.understood]}`);
  if (e.subtitles) parts.push(SUBTITLE_LABEL[e.subtitles]);
  return parts;
}

/** Row meta as one string: "Hôm nay · Phim/series · Hiểu 70–90% · Phụ đề Anh". */
export function entryMeta(e: ListeningEntry, today: string): string {
  return entryMetaParts(e, today).join(' · ');
}

/** Entries of the last `days` days (today included), newest first. */
export function recentEntries(entries: readonly ListeningEntry[], now: number, days = RECENT_DAYS): ListeningEntry[] {
  const from = addDays(localDay(now), -(days - 1));
  return entries.filter((e) => e.day >= from);
}

// ───────────────────────── summary ─────────────────────────

export interface ListenSummary {
  today: number;
  goal: number; // 0 = off
  todayPct: number; // 0..100
  week: number; // minutes since Monday
  weekDays: number; // days with listening this week
  lastWeek: number; // minutes of the whole previous week
  total: number;
  milestone: Milestone;
}

export function listenSummary(entries: readonly ListeningEntry[], now: number, goal: number): ListenSummary {
  const today = localDay(now);
  const monday = weekStartDay(today);
  const t = minutesOnDay(entries, today);
  const g = Number.isFinite(goal) && goal > 0 ? goal : 0;
  const total = totalMinutes(entries);
  return {
    today: t,
    goal: g,
    todayPct: g ? Math.min(100, Math.round((t / g) * 100)) : 0,
    week: minutesBetween(entries, monday, today),
    weekDays: listeningDays(entries, monday, today).length,
    lastWeek: minutesBetween(entries, addDays(monday, -7), addDays(monday, -1)),
    total,
    milestone: nextMilestone(total),
  };
}

/** Card head text: "20/30 phút" · "Mục tiêu 30 phút" (nothing yet) · "20 phút" (goal off) · null. */
export function todayHead(s: Pick<ListenSummary, 'today' | 'goal'>): string | null {
  if (s.goal > 0) return s.today > 0 ? `${s.today}/${s.goal} phút` : `Mục tiêu ${s.goal} phút`;
  return s.today > 0 ? formatMinutesVi(s.today) : null;
}

/** "Tuần này: 2 giờ 10 phút trong 4 ngày" (null before any listening this week). */
export function weekLine(s: Pick<ListenSummary, 'week' | 'weekDays'>): string | null {
  if (s.week <= 0) return null;
  return `Tuần này: ${formatMinutesVi(s.week)} trong ${s.weekDays} ngày`;
}

// ───────────────────────── timer ─────────────────────────

export function timerStatusLabel(status: TimerStatus): string {
  return status === 'running' ? 'Đang nghe' : status === 'paused' ? 'Đang tạm dừng' : 'Đã dừng, chưa lưu';
}

/** Short label of the shell pill, a state (never a command): "Đang nghe 12:34", "Đang tạm dừng 12:34", "Chưa lưu 12:34". */
export function pillLabel(status: TimerStatus, clock: string): string {
  return `${status === 'running' ? 'Đang nghe' : status === 'paused' ? 'Đang tạm dừng' : 'Chưa lưu'} ${clock}`;
}
