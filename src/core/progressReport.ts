// "Báo cáo tiến bộ" (Tiến độ → Báo cáo, #/stats?view=report): a pure, UI-ready model of the report.
// buildReport() reads nothing itself: the page passes the listening log, checkups, the daily archive
// (core/history), stats, review/lesson progress and settings. See docs/progress-report.md.
//
// Honesty rules for "Nhận xét" (insights) and the cards (docs/progress-report.md "Quy tắc trung thực"):
// - deterministic sentences from the numbers on the page only, about the period the learner picked;
// - never a claim about native-like listening;
// - nothing concluded from small samples: a listening comparison needs a base (MIN_LISTEN_BASE…), a big change
//   is said as "gấp N lần", not "+1900%"; a checkup change within SCORE_NOISE (one comprehension answer is worth
//   10 points) is "gần như không đổi"; a checkup trend is hedged until MIN_TREND_CHECKUPS tests, compares the
//   mean of the first and last tests (not one test against another) and says "dao động" when the series goes up
//   and down; quick retakes (RETAKE_WINDOW_DAYS) are left out of trends; a per-phenomenon change needs
//   MIN_PHENOMENON_SENTENCES sentences on each side and is said with "có vẻ", never "rõ"; a practice trend is
//   per module with MIN_PRACTICE_SAMPLE attempts on each side and worded as "trên các bài bạn chọn luyện";
// - the self-rating is always called "tự đánh giá" and depends on the content chosen;
// - a TTS voice change, different/repeated forms and an old last checkup are mentioned.

import {
  CHECKUP_CADENCE_DAYS,
  checkupDue,
  compareAll,
  isRepeatForm,
  trendCheckups,
  type CheckupComparison,
  type CheckupDue,
  type CheckupResult,
  type PhenomenonChange,
} from './benchmark';
import { weakestRate } from './goals';
import {
  historyDays,
  HISTORY_MODULES,
  lessonsPassedByWeek,
  practiceDays,
  practiceTotals,
  reviewRetention,
  weeklyModuleAccuracy,
  wordsLearnedCumulative,
  wordsLearnedBetween,
  countLearnedWords,
  type HistoryStore,
  type Retention,
  type WeekCount,
  type WeekCumulative,
  type WeekModuleAccuracy,
  type WeekRef,
} from './history';
import type { LessonProgress } from './lessons';
import {
  addDays,
  daysBetween,
  ddmm,
  formatDurationVi,
  listeningDays,
  minutesBetween,
  minutesOnDay,
  nextMilestone,
  sourceSplit,
  totalMinutes,
  understoodLevel,
  weekStartDay,
  type ListeningEntry,
  type ListeningSource,
  type Milestone,
  type SourceShare,
  type Understood,
} from './listening';
import { PHENOMENON_INFO } from './phenomena';
import { localDay, MODULE_LABEL, type ModuleId } from './stats';
import { PHENOMENA, type Phenomenon } from './types';

export type ReportPeriod = '4w' | '3m' | 'all';

export const REPORT_PERIODS: readonly { id: ReportPeriod; label: string }[] = [
  { id: '4w', label: '4 tuần' },
  { id: '3m', label: '3 tháng' },
  { id: 'all', label: 'Tất cả' },
];

export function parseReportPeriod(v: unknown): ReportPeriod {
  return v === '3m' || v === 'all' ? v : '4w';
}

/** "Tất cả" spanning more weeks than this is charted by month (every point of the period stays visible). */
export const MAX_CHART_WEEKS = 26;
/** Smallest previous-window base (minutes) for a listening comparison, per period. */
export const MIN_LISTEN_BASE: Readonly<Record<'4w' | '3m', number>> = { '4w': 120, '3m': 300 };
/** Attempts of one module needed on each side before a practice accuracy trend is stated. */
export const MIN_PRACTICE_SAMPLE = 20;
/** Grades on graduated cards needed before retention is stated. */
export const MIN_RETENTION_SAMPLE = 20;
/**
 * Checkup score change (points) treated as noise. One of the 4 comprehension answers is worth 10 points, and two
 * tests of a learner of constant ability differ by about 15 points (SD, measured with buildCheckupResult on the
 * real forms): a smaller change says nothing.
 */
export const SCORE_NOISE = 10;
/** Checkups (after dropping quick retakes) before a score trend is stated without "mới có … lần". */
export const MIN_TREND_CHECKUPS = 4;
/** Dictation sentences with a phenomenon needed on each side before its change is mentioned. */
export const MIN_PHENOMENON_SENTENCES = 5;
/** Change (percentage points of sentences missed) before a phenomenon "có vẻ tiến bộ". */
export const MIN_PHENOMENON_CHANGE = 30;
/** Fewer attempts than this in a chart point: drawn hollow ("ít dữ liệu"). */
export const MIN_WEEK_ATTEMPTS = 10;
/** Fewer rated entries than this in a chart point: drawn hollow. */
export const MIN_WEEK_RATINGS = 2;

export interface ReportInput {
  log: readonly ListeningEntry[];
  checkups: readonly CheckupResult[];
  history: HistoryStore;
  stats?: { attempts?: unknown; activeDays?: unknown; byPhenomenon?: unknown } | null;
  /** The stored review value (KEYS.review), for today's learned-words count. */
  review?: unknown;
  lessons?: LessonProgress | null;
  settings: { listenGoal: number };
  /** Learner finished onboarding (decides the "baseline" checkup suggestion). */
  onboardingDone?: boolean;
  now: number;
  period: ReportPeriod;
}

/** One chart bucket: a Monday-based week, or a calendar month for a long "Tất cả". */
export interface ReportWeek extends WeekRef {
  rangeLabel: string; // 'dd/mm – dd/mm' | 'tháng 11/2025'
  isCurrent: boolean; // contains today (still running)
}

export type ChartUnit = 'week' | 'month';

export interface OverviewSection {
  empty: string | null;
  periodLabel: string; // "Từ 19/10" | "Từ 10/08" | "Từ đầu đến nay"
  fromDay: string;
  toDay: string;
  listenMinutes: number;
  listenLabel: string; // formatDurationVi: "3 giờ 20 phút" | "46,1 giờ"
  prevListenMinutes: number | null; // same-length window just before; null for "Tất cả"
  changePct: number | null; // null when prev < MIN_LISTEN_BASE
  changeLabel: string | null; // "nhiều hơn kỳ trước 40%" | "gấp khoảng 3 lần kỳ trước" | "gần bằng kỳ trước"
  totalMinutes: number;
  totalLabel: string; // formatDurationVi
  milestone: Milestone;
  avgPerWeekLabel: string | null; // "Tất cả" only: "2 giờ 10 phút" a week on average
  activeDays: number; // days with listening or practice in the period
  listeningDays: number;
  checkupsTaken: number; // in the period
}

export interface ListenBar extends ReportWeek {
  start: number; // local midnight of `key`
  minutes: number;
  bySource: Record<ListeningSource, number>;
  days: number; // distinct days with listening
  goalDays: number;
  avgPerDay: number; // minutes per elapsed day of the bucket
  minutesLabel: string;
  elapsedDays: number; // days of the bucket up to today
}

export interface ListeningSection {
  empty: string | null;
  unit: ChartUnit;
  weeks: ListenBar[]; // chart buckets, oldest first (weeks or months: see `unit`)
  goalPerDay: number; // 0 = no goal line
  goalPerWeek: number; // goalPerDay × 7
  goalPerBar: number; // reference line: goal × 7 (weeks) or × 30 (months)
  goalCurrent: number; // the goal pro-rated to the elapsed days of the current bucket (its own marker)
  maxMinutes: number; // y-scale top: max of the bars and the goal line
  sources: SourceShare[];
  summary: string; // text alternative of the chart
}

export interface CheckupPoint {
  id: string;
  at: number;
  dateLabel: string; // 'dd/mm/yyyy'
  form: string;
  score: number;
  dictationPct: number;
  comprehensionCorrect: number;
  comprehensionTotal: number;
  comprehensionPct: number;
  voiceName: string | null;
  voiceChanged: boolean; // differs from the previous test's voice
  repeatForm: boolean; // a form taken before: the learner saw its sentences and answers
  inTrend: boolean; // false for a quick retake (< RETAKE_WINDOW_DAYS after the previous counted test)
}

export interface ReportPhenomenonChange extends PhenomenonChange {
  /** Fewer than MIN_PHENOMENON_SENTENCES sentences on either side: shown greyed, "ít câu". */
  lowSample: boolean;
}

export interface CheckupSection {
  empty: string | null;
  count: number; // all checkups
  trendCount: number; // checkups the trend uses (quick retakes dropped)
  retakes: number; // quick retakes left out of the trend
  points: CheckupPoint[]; // in the period, oldest first
  earlier: number; // checkups before the period (not drawn)
  baselineOnly: boolean;
  comparison: CheckupComparison | null; // first vs previous vs latest of the trend tests
  firstScore: number | null;
  latestScore: number | null;
  deltaFirstLabel: string | null; // "+12 điểm so với lần đầu"
  deltaPrevLabel: string | null; // "+6 điểm so với lần trước"
  deltaHedge: string | null; // "chênh dưới 10 điểm: có thể do đề" | "mới có 2 lần đo"
  baselineNote: string | null; // "Đây là mốc đầu tiên …"
  voiceNote: string | null;
  formNote: string | null; // forms differ / a repeated form
  staleNote: string | null; // the latest test is old
  phenomena: ReportPhenomenonChange[]; // rows worth showing (not 0 → 0), biggest improvement first
  due: CheckupDue;
  nextLabel: string;
  summary: string;
}

export interface UnderstoodBar {
  key: string;
  label: string;
  rangeLabel: string;
  avg: number | null; // minutes-weighted mean of `understood` (1..5, one decimal)
  count: number; // rated entries
  minutes: number;
}

export interface UnderstoodSection {
  empty: string | null;
  note: string;
  weeks: UnderstoodBar[];
  avg: number | null; // minutes-weighted, 1..5
  avgLabel: string | null; // "3,2/5 · khoảng 50–70%"
  rated: number; // rated entries in the period
  summary: string;
}

export interface ModuleRow {
  module: ModuleId;
  label: string;
  n: number;
  ok: number;
  pct: number;
}

export interface PracticeSection {
  empty: string | null;
  weeks: WeekModuleAccuracy[];
  total: { n: number; ok: number; pct: number | null };
  modules: ModuleRow[]; // modules practised in the period, most attempts first
  retention: Retention & { label: string | null }; // "Nhớ được ở 85% lượt ôn thẻ đã thuộc (120 lượt)"
  lessonsPassed: number; // in the period
  lessonsPassedTotal: number;
  lessonsByWeek: WeekCount[];
  words: { total: number; added: number; weeks: WeekCumulative[] };
  /** Days before the archive existed show only the backfilled attempts (no review data). */
  archiveSince: string | null;
  summary: string;
}

export interface ProgressReport {
  period: ReportPeriod;
  generatedAt: number;
  unit: ChartUnit;
  weeks: ReportWeek[];
  overview: OverviewSection;
  listening: ListeningSection;
  checkups: CheckupSection;
  understood: UnderstoodSection;
  practice: PracticeSection;
  insights: string[]; // 2–4 items of 1–3 short Vietnamese sentences ("Nhận xét")
}

// ───────────────────────── helpers ─────────────────────────

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function dmy(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** 3.25 → "3,3" (Vietnamese decimal comma, one decimal, integers without ",0"). */
export function decimalVi(n: number): string {
  const r = Math.round(n * 10) / 10;
  return String(r).replace('.', ',');
}

/** The self-rating levels as prose (never "<30%" inside a sentence). */
const UNDERSTOOD_PROSE: Record<Understood, string> = {
  1: 'dưới 30%',
  2: 'khoảng 30–50%',
  3: 'khoảng 50–70%',
  4: 'khoảng 70–90%',
  5: 'trên 90%',
};

export function understoodProse(avg: number): string {
  return UNDERSTOOD_PROSE[understoodLevel(avg)];
}

function earliestDay(input: ReportInput, days: Map<string, unknown>): string | null {
  const cands: string[] = [];
  for (const e of input.log) cands.push(e.day);
  for (const c of input.checkups) cands.push(localDay(c.at));
  for (const d of days.keys()) cands.push(d);
  const ad = input.stats?.activeDays;
  if (Array.isArray(ad)) for (const d of ad) if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) cands.push(d);
  return cands.length ? cands.reduce((a, b) => (b < a ? b : a)) : null;
}

function makeWeeks(currentMonday: string, n: number, today: string): ReportWeek[] {
  const out: ReportWeek[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = addDays(currentMonday, -7 * i);
    const end = addDays(key, 6);
    out.push({ key, end, label: ddmm(key), rangeLabel: `${ddmm(key)} – ${ddmm(end)}`, isCurrent: key <= today && today <= end });
  }
  return out;
}

const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}-01`;

/** Calendar months from the month of `fromDay` to the month of `today`, oldest first. */
function makeMonths(fromDay: string, today: string): ReportWeek[] {
  const [fy, fm] = fromDay.split('-').map(Number);
  const [ty, tm] = today.split('-').map(Number);
  const out: ReportWeek[] = [];
  for (let y = fy, m = fm - 1; y < ty || (y === ty && m <= tm - 1); m === 11 ? ((m = 0), (y += 1)) : (m += 1)) {
    const key = monthKey(y, m);
    const last = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    out.push({ key, end, label: `T${m + 1}/${String(y).slice(2)}`, rangeLabel: `tháng ${m + 1}/${y}`, isCurrent: key <= today && today <= end });
  }
  return out;
}

/** "nhiều hơn kỳ trước 40%" / "gấp khoảng 3 lần kỳ trước" / "gần bằng kỳ trước" / "ít hơn kỳ trước 10%". */
export function listenChange(cur: number, prev: number, what = 'kỳ trước'): { pct: number; label: string } {
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (Math.abs(pct) < 10) return { pct, label: `gần bằng ${what}` };
  if (pct >= 100) {
    const x = cur / prev;
    return { pct, label: `gấp khoảng ${x < 3 ? decimalVi(x) : Math.round(x)} lần ${what}` };
  }
  return { pct, label: pct > 0 ? `nhiều hơn ${what} ${pct}%` : `ít hơn ${what} ${Math.abs(pct)}%` };
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0';
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

function listenBars(log: readonly ListeningEntry[], refs: readonly ReportWeek[], today: string, goal: number): ListenBar[] {
  return refs.map((w) => {
    const bySource = { phim: 0, youtube: 0, podcast: 0, app: 0, khac: 0 } as Record<ListeningSource, number>;
    const perDay = new Map<string, number>();
    let minutes = 0;
    for (const e of log) {
      if (e.day < w.key || e.day > w.end) continue;
      minutes += e.minutes;
      bySource[e.source] += e.minutes;
      perDay.set(e.day, (perDay.get(e.day) ?? 0) + e.minutes);
    }
    let goalDays = 0;
    if (goal > 0) for (const m of perDay.values()) if (m >= goal) goalDays += 1;
    const elapsedDays = w.isCurrent ? daysBetween(w.key, today) + 1 : daysBetween(w.key, w.end) + 1;
    const [y, mo, d] = w.key.split('-').map(Number);
    return {
      ...w,
      start: new Date(y, mo - 1, d).getTime(),
      minutes,
      bySource,
      days: perDay.size,
      goalDays,
      avgPerDay: Math.round(minutes / Math.max(1, elapsedDays)),
      minutesLabel: formatDurationVi(minutes),
      elapsedDays,
    };
  });
}

function understoodBars(log: readonly ListeningEntry[], refs: readonly ReportWeek[]): UnderstoodBar[] {
  return refs.map((w) => {
    let sum = 0;
    let minutes = 0;
    let count = 0;
    for (const e of log) {
      if (!e.understood || e.day < w.key || e.day > w.end) continue;
      sum += e.understood * e.minutes;
      minutes += e.minutes;
      count += 1;
    }
    return { key: w.key, label: w.label, rangeLabel: w.rangeLabel, avg: minutes > 0 ? Math.round((sum / minutes) * 10) / 10 : null, count, minutes };
  });
}

// ───────────────────────── build ─────────────────────────

export function buildReport(input: ReportInput): ProgressReport {
  const now = input.now;
  const today = localDay(now);
  const currentMonday = weekStartDay(today);
  const goal = finite(input.settings?.listenGoal) && input.settings.listenGoal > 0 ? Math.round(input.settings.listenGoal) : 0;
  const log = Array.isArray(input.log) ? input.log : [];
  const checkups = [...(Array.isArray(input.checkups) ? input.checkups : [])].sort((a, b) => a.at - b.at);
  const days = historyDays(input.history);

  // ── period and chart buckets ──
  let nWeeks = input.period === '3m' ? 13 : 4;
  let fromDay = addDays(currentMonday, -7 * (nWeeks - 1));
  if (input.period === 'all') {
    const first = earliestDay({ ...input, log, checkups }, days);
    const firstMonday = first && first < today ? weekStartDay(first) : currentMonday;
    fromDay = firstMonday;
    nWeeks = Math.max(4, Math.floor(daysBetween(firstMonday, currentMonday) / 7) + 1);
  }
  const unit: ChartUnit = input.period === 'all' && nWeeks > MAX_CHART_WEEKS ? 'month' : 'week';
  const weeks = unit === 'month' ? makeMonths(fromDay, today) : makeWeeks(currentMonday, nWeeks, today);
  const periodLen = daysBetween(fromDay, today) + 1;
  const prevTo = addDays(fromDay, -1);
  const prevFrom = addDays(fromDay, -periodLen);
  const periodLabel = input.period === 'all' ? 'Từ đầu đến nay' : `Từ ${ddmm(fromDay)}`;

  // ── overview ──
  const listenMinutes = minutesBetween(log, fromDay, today);
  const prevListen = input.period === 'all' ? null : minutesBetween(log, prevFrom, prevTo);
  const change = prevListen !== null && input.period !== 'all' && prevListen >= MIN_LISTEN_BASE[input.period] ? listenChange(listenMinutes, prevListen) : null;
  const total = totalMinutes(log);
  const lDays = listeningDays(log, fromDay, today);
  const pDays = new Set(practiceDays(days, fromDay, today));
  const ad = input.stats?.activeDays;
  if (Array.isArray(ad)) for (const d of ad) if (typeof d === 'string' && d >= fromDay && d <= today) pDays.add(d);
  const active = new Set([...lDays, ...pDays]);
  const checkupsInPeriod = checkups.filter((c) => localDay(c.at) >= fromDay);
  const overview: OverviewSection = {
    empty: total === 0 && pDays.size === 0 && checkups.length === 0 ? 'Chưa có dữ liệu. Hãy ghi giờ nghe hoặc luyện một bài để báo cáo bắt đầu có số liệu.' : null,
    periodLabel,
    fromDay,
    toDay: today,
    listenMinutes,
    listenLabel: formatDurationVi(listenMinutes),
    prevListenMinutes: prevListen,
    changePct: change?.pct ?? null,
    changeLabel: change?.label ?? null,
    totalMinutes: total,
    totalLabel: formatDurationVi(total),
    milestone: nextMilestone(total),
    avgPerWeekLabel: input.period === 'all' && total > 0 ? formatDurationVi(listenMinutes / Math.max(1, periodLen / 7)) : null,
    activeDays: active.size,
    listeningDays: lDays.length,
    checkupsTaken: checkupsInPeriod.length,
  };

  // ── listening by week / month ──
  const lw = listenBars(log, weeks, today, goal);
  const goalPerWeek = goal * 7;
  const goalPerBar = unit === 'month' ? goal * 30 : goalPerWeek;
  const cur = lw.find((w) => w.isCurrent);
  const goalCurrent = cur && goal > 0 && cur.elapsedDays < (unit === 'month' ? 28 : 7) ? goal * cur.elapsedDays : 0;
  const listenInChart = lw.reduce((n, w) => n + w.minutes, 0);
  const unitWord = unit === 'month' ? 'tháng' : 'tuần';
  const listening: ListeningSection = {
    empty: listenInChart === 0 ? 'Chưa có giờ nghe trong kỳ này. Ghi giờ nghe ở trang Nhật ký nghe để thấy biểu đồ.' : null,
    unit,
    weeks: lw,
    goalPerDay: goal,
    goalPerWeek,
    goalPerBar,
    goalCurrent,
    maxMinutes: Math.max(goalPerBar, ...lw.map((w) => w.minutes), 1),
    sources: sourceSplit(log, fromDay, today),
    summary:
      `Giờ nghe theo ${unitWord}, ${periodLabel.toLowerCase()}: ` +
      lw.map((w) => `${unitWord} ${w.label}${w.isCurrent ? ' (chưa hết)' : ''}: ${w.minutesLabel}`).join('; ') +
      (goal ? `. Mục tiêu ${goal} phút mỗi ngày.` : '.'),
  };

  // ── checkups ──
  const trend = trendCheckups(checkups);
  const trendIds = new Set(trend.map((c) => c.id));
  const comparison = compareAll(trend);
  const points: CheckupPoint[] = checkups.map((c, i) => ({
    id: c.id,
    at: c.at,
    dateLabel: dmy(c.at),
    form: c.form,
    score: c.score,
    dictationPct: c.dictation.pct,
    comprehensionCorrect: c.comprehension.correct,
    comprehensionTotal: c.comprehension.total,
    comprehensionPct: c.comprehension.pct,
    voiceName: c.voiceName,
    voiceChanged: i > 0 && checkups[i - 1].voiceName !== c.voiceName,
    repeatForm: isRepeatForm(checkups, c),
    inTrend: trendIds.has(c.id),
  }));
  const shown = points.filter((p) => localDay(p.at) >= fromDay);
  const due = checkupDue(checkups, now, input.onboardingDone ?? true);
  const first = trend[0] ?? null;
  const latest = trend[trend.length - 1] ?? null;
  const tn = trend.length;
  const dFirst = comparison?.vsFirst?.score ?? null;
  const latestPoint = latest ? points.find((p) => p.id === latest.id) : undefined;
  const checkupSection: CheckupSection = {
    empty: checkups.length === 0 ? 'Chưa có bài kiểm tra định kỳ. Làm bài đầu tiên (khoảng 10 phút) để có mốc so sánh.' : null,
    count: checkups.length,
    trendCount: tn,
    retakes: checkups.length - tn,
    points: shown,
    earlier: points.length - shown.length,
    baselineOnly: tn === 1,
    comparison,
    firstScore: first?.score ?? null,
    latestScore: latest?.score ?? null,
    deltaFirstLabel: dFirst !== null ? `${signed(dFirst)} điểm so với lần đầu` : null,
    deltaPrevLabel: comparison?.vsPrev && tn > 2 ? `${signed(comparison.vsPrev.score)} điểm so với lần trước` : null,
    deltaHedge:
      dFirst === null
        ? null
        : Math.abs(dFirst) <= SCORE_NOISE
          ? `Chênh từ ${SCORE_NOISE} điểm trở xuống có thể chỉ do đề hoặc may rủi.`
          : tn < MIN_TREND_CHECKUPS
            ? `Mới có ${tn} lần đo, cần khoảng ${MIN_TREND_CHECKUPS} lần mới chắc được xu hướng.`
            : null,
    baselineNote: tn === 1 && first ? `Đây là mốc đầu tiên (${first.score} điểm). ${baselineNext(due)}` : null,
    voiceNote: comparison?.voiceChanged ? 'Giọng đọc đã đổi giữa các lần kiểm tra, nên điểm có thể lệch vì giọng chứ không chỉ vì bạn.' : null,
    formNote: latestPoint?.repeatForm
      ? `Lần gần nhất là đề ${latestPoint.form}, bạn đã làm đề này trước đây: điểm có thể cao hơn thực tế.`
      : tn >= 2
        ? 'Mỗi lần là một đề khác nhau (A–F), độ khó tương đương nhưng không giống hệt.'
        : null,
    staleNote:
      due.daysSince !== null && due.daysSince > 2 * CHECKUP_CADENCE_DAYS
        ? `Lần gần nhất cách đây ${due.daysSince} ngày; làm bài mới để biết hiện tại.`
        : null,
    phenomena: (comparison?.phenomena ?? [])
      .filter((p) => !(p.firstMissed === 0 && p.latestMissed === 0) && p.change !== null)
      .map((p) => ({ ...p, lowSample: p.firstSeen < MIN_PHENOMENON_SENTENCES || p.latestSeen < MIN_PHENOMENON_SENTENCES }))
      .sort((a, b) => Number(a.lowSample) - Number(b.lowSample) || (a.change ?? 0) - (b.change ?? 0)),
    due,
    nextLabel:
      due.kind === 'due'
        ? 'Đến lúc kiểm tra định kỳ'
        : due.kind === 'baseline' || !due.nextDueAt
          ? 'Làm bài đầu tiên để có mốc so sánh'
          : `Lần kiểm tra tiếp theo: từ ${ddmm(localDay(due.nextDueAt))}`,
    summary: checkups.length
      ? 'Điểm kiểm tra định kỳ: ' +
        points.map((p) => `${p.dateLabel}, đề ${p.form}: ${p.score} điểm (chép ${p.dictationPct}%, hiểu ${p.comprehensionCorrect}/${p.comprehensionTotal})`).join('; ') +
        '.'
      : 'Chưa có bài kiểm tra định kỳ.',
  };

  // ── self-rated understanding ──
  const uw = understoodBars(log, weeks);
  let uSum = 0;
  let uMin = 0;
  let rated = 0;
  for (const e of log) {
    if (!e.understood || e.day < fromDay || e.day > today) continue;
    uSum += e.understood * e.minutes;
    uMin += e.minutes;
    rated += 1;
  }
  const uAvg = uMin > 0 ? Math.round((uSum / uMin) * 10) / 10 : null;
  const understood: UnderstoodSection = {
    empty: rated === 0 ? 'Chưa có đánh giá mức hiểu. Khi ghi giờ nghe, chọn mức hiểu để theo dõi phần này.' : null,
    note: 'Tự đánh giá của bạn khi ghi giờ nghe, không phải điểm đo. Mức hiểu còn tùy độ khó nội dung bạn chọn.',
    weeks: uw,
    avg: uAvg,
    avgLabel: uAvg !== null ? `${decimalVi(uAvg)}/5 · ${understoodProse(uAvg)}` : null,
    rated,
    summary:
      `Tự đánh giá mức hiểu theo ${unitWord} (1 là dưới 30%, 5 là trên 90%): ` +
      uw.map((w) => `${unitWord} ${w.label}: ${w.avg === null ? 'chưa có' : `${decimalVi(w.avg)} (${w.count} lần ghi)`}`).join('; ') +
      '.',
  };

  // ── practice in the app ──
  const pw = weeklyModuleAccuracy(days, weeks);
  const pt = practiceTotals(days, fromDay, today);
  const modules: ModuleRow[] = HISTORY_MODULES.filter((m) => pt.byModule[m])
    .map((m) => ({ module: m, label: MODULE_LABEL[m], ...pt.byModule[m]! }))
    .sort((a, b) => b.n - a.n);
  const ret = reviewRetention(days, fromDay, today);
  const lessonsByWeek = lessonsPassedByWeek(input.lessons ?? {}, weeks);
  const passDays = Object.values(input.lessons ?? {})
    .map((r) => r?.completedAt)
    .filter((t): t is number => finite(t) && t > 0)
    .map((t) => localDay(t));
  const wordsWeeks = wordsLearnedCumulative(input.history, weeks, days);
  const wordsTotal = Math.max(
    (input.history.base?.wordsLearned ?? 0) + wordsLearnedBetween(days),
    input.review !== undefined ? countLearnedWords(input.review) : 0,
  );
  const practice: PracticeSection = {
    empty:
      pt.n === 0 && ret.n === 0 && !passDays.some((d) => d >= fromDay)
        ? 'Chưa có lượt luyện trong kỳ này. Luyện vài bài ở trang Hôm nay để thấy độ chính xác.'
        : null,
    weeks: pw,
    total: { n: pt.n, ok: pt.ok, pct: pt.pct },
    modules,
    retention: { ...ret, label: ret.pct !== null ? `Nhớ được ở ${ret.pct}% lượt ôn thẻ đã thuộc (${ret.n} lượt)` : null },
    lessonsPassed: passDays.filter((d) => d >= fromDay && d <= today).length,
    lessonsPassedTotal: passDays.length,
    lessonsByWeek,
    words: { total: wordsTotal, added: wordsLearnedBetween(days, fromDay, today), weeks: wordsWeeks },
    archiveSince: input.history.base ? localDay(input.history.base.until) : null,
    summary:
      `Độ chính xác khi luyện theo ${unitWord}: ` +
      pw.map((w) => `${unitWord} ${w.label}: ${w.total.pct === null ? 'chưa luyện' : `${w.total.pct}% (${w.total.n} lượt)`}`).join('; ') +
      '.',
  };

  return {
    period: input.period,
    generatedAt: now,
    unit,
    weeks,
    overview,
    listening,
    checkups: checkupSection,
    understood,
    practice,
    insights: buildInsights({
      log,
      checkups,
      goal,
      today,
      period: input.period,
      fromDay,
      listenMinutes,
      change,
      stats: input.stats,
      pw,
      ret,
      rated,
      uAvg,
      daysSinceCheckup: due.daysSince,
    }),
  };
}

function baselineNext(due: CheckupDue): string {
  if (due.daysSince !== null && due.daysSince >= CHECKUP_CADENCE_DAYS) return 'Đã đủ 2 tuần, làm bài lần 2 để thấy thay đổi.';
  if (due.nextDueAt) return `Làm lại từ ngày ${ddmm(localDay(due.nextDueAt))} để thấy thay đổi.`;
  return `Làm lại sau ${CHECKUP_CADENCE_DAYS} ngày để thấy thay đổi.`;
}

// ───────────────────────── "Nhận xét" ─────────────────────────

export interface InsightInput {
  log: readonly ListeningEntry[];
  checkups: readonly CheckupResult[];
  goal: number;
  today: string;
  period: ReportPeriod;
  fromDay: string;
  listenMinutes: number; // in the period
  change: { pct: number; label: string } | null; // vs the previous window (same rule as the tile)
  stats: ReportInput['stats'];
  pw: WeekModuleAccuracy[];
  ret: Retention;
  rated: number;
  uAvg: number | null;
  daysSinceCheckup: number | null;
}

/** 2–4 rule-based items, in this order: listening, checkups, phenomena, practice / retention / self-rating. */
export function buildInsights(i: InsightInput): string[] {
  const out: string[] = [listeningInsight(i), checkupInsight(i)];
  const ph = phenomenonInsight(i);
  if (ph) out.push(ph);
  const fourth = practiceInsight(i) ?? retentionInsight(i) ?? understoodInsight(i);
  if (fourth && out.length < 4) out.push(fourth);
  return out.slice(0, 4);
}

function listeningInsight(i: InsightInput): string {
  const total = totalMinutes(i.log);
  if (total === 0) return 'Chưa có giờ nghe nào được ghi. Nghe tiếng Anh thật 15–30 phút mỗi ngày là phần quan trọng nhất để quen tai.';
  const phrase = i.period === 'all' ? 'Từ đầu đến nay' : `Từ ${ddmm(i.fromDay)} đến nay`;
  if (i.listenMinutes === 0) return `${phrase} bạn chưa ghi giờ nghe nào; tổng cộng bạn đã nghe ${formatDurationVi(total)}.`;
  let s = `${phrase} bạn nghe ${formatDurationVi(i.listenMinutes)}${i.change ? `, ${i.change.label}` : ''}.`;
  const g = goalDays(i);
  if (g) s += ` 7 ngày qua đạt mục tiêu ${i.goal} phút ${g.met}/${g.of} ngày.`;
  return s;
}

/**
 * Goal days in the last 7: days before the first log entry are not counted (a learner who started on Monday is
 * not "failing" the week before), and today counts only once its goal is met (the day is not over).
 */
function goalDays(i: InsightInput): { met: number; of: number } | null {
  if (i.goal <= 0 || !i.log.length) return null;
  const firstDay = i.log.reduce((a, e) => (e.day < a ? e.day : a), i.log[0].day);
  let met = 0;
  let of = 0;
  for (let k = 0; k < 7; k++) {
    const d = addDays(i.today, -k);
    if (d < firstDay) break;
    const ok = minutesOnDay(i.log, d) >= i.goal;
    if (k === 0 && !ok) continue;
    of += 1;
    if (ok) met += 1;
  }
  return of > 0 ? { met, of } : null;
}

function checkupInsight(i: InsightInput): string {
  const trend = trendCheckups(i.checkups);
  const n = trend.length;
  if (n === 0) return 'Chưa có bài kiểm tra định kỳ: làm bài đầu tiên (khoảng 10 phút) để có mốc so sánh.';
  const stale =
    i.daysSinceCheckup !== null && i.daysSinceCheckup > 2 * CHECKUP_CADENCE_DAYS
      ? ` Lần gần nhất cách đây ${i.daysSinceCheckup} ngày; làm bài mới để biết hiện tại.`
      : '';
  if (n === 1) {
    const next =
      i.daysSinceCheckup !== null && i.daysSinceCheckup >= CHECKUP_CADENCE_DAYS
        ? 'đã đủ 2 tuần, làm bài lần 2 để thấy thay đổi.'
        : `làm lại sau ${CHECKUP_CADENCE_DAYS} ngày để thấy thay đổi.`;
    return `Bài kiểm tra đầu tiên được ${trend[0].score} điểm, đây là mốc để so sánh; ${next}`;
  }
  // Compare the mean of the first k tests with the mean of the last k (k = 2 from 4 tests): one lucky or unlucky
  // test cannot make the trend on its own.
  const k = n >= MIN_TREND_CHECKUPS ? 2 : 1;
  const early = trend.slice(0, k);
  const late = trend.slice(n - k);
  const a = Math.round(mean(early.map((c) => c.score)));
  const b = Math.round(mean(late.map((c) => c.score)));
  const d = b - a;
  const scores = trend.map((c) => c.score);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const lastStep = scores[n - 1] - scores[n - 2];
  const da = Math.round(mean(early.map((c) => c.dictation.pct)));
  const db = Math.round(mean(late.map((c) => c.dictation.pct)));
  const what = k === 2 ? `trung bình 2 lần đầu ${a}, 2 lần gần nhất ${b}` : `${a} → ${b}`;
  let s: string;
  if (n >= 3 && (hi - lo > Math.abs(d) + SCORE_NOISE || (Math.abs(lastStep) > SCORE_NOISE && Math.sign(lastStep) === -Math.sign(d)))) {
    s = `Điểm kiểm tra dao động từ ${lo} đến ${hi}, chưa thấy xu hướng rõ.`;
  } else if (Math.abs(d) <= SCORE_NOISE) {
    s = `Điểm kiểm tra chưa thay đổi rõ (${what}): chênh từ ${SCORE_NOISE} điểm trở xuống có thể chỉ do đề hoặc may rủi.`;
  } else if (d > 0) {
    s = `Điểm kiểm tra tăng (${what}); phần chép chính tả từ ${da}% lên ${db}%.`;
  } else {
    s = `Điểm kiểm tra giảm (${what}); một lần thấp có thể do đề hay do mệt.`;
  }
  if (n < MIN_TREND_CHECKUPS && Math.abs(d) > SCORE_NOISE) s += ` Mới có ${n} lần đo nên chưa chắc.`;
  const cmp = compareAll(trend);
  if (cmp?.voiceChanged) s += ' Giọng đọc đã đổi giữa các lần, nên so sánh có thể lệch.';
  if (isRepeatForm(i.checkups, trend[n - 1])) s += ' Lần gần nhất là đề đã làm trước đây, điểm có thể cao hơn thực tế.';
  return s + stale;
}

interface PooledPh {
  p: Phenomenon;
  label: string;
  early: { seen: number; missed: number };
  late: { seen: number; missed: number };
}

/** Per phenomenon, the dictation sentences of the first half vs the second half of the trend tests (pooled). */
export function pooledPhenomena(checkups: readonly CheckupResult[]): PooledPh[] {
  const trend = trendCheckups(checkups);
  const n = trend.length;
  if (n < 2) return [];
  const k = Math.floor(n / 2);
  const sum = (cs: readonly CheckupResult[], p: Phenomenon) =>
    cs.reduce((acc, c) => ({ seen: acc.seen + (c.byPhenomenon[p]?.seen ?? 0), missed: acc.missed + (c.byPhenomenon[p]?.missed ?? 0) }), { seen: 0, missed: 0 });
  return PHENOMENA.map((p) => ({ p, label: PHENOMENON_INFO[p].label, early: sum(trend.slice(0, k), p), late: sum(trend.slice(n - k), p) }));
}

const pctOf = (v: { seen: number; missed: number }) => Math.round((v.missed / Math.max(1, v.seen)) * 100);

function phenomenonInsight(i: InsightInput): string | null {
  const rows = pooledPhenomena(i.checkups).filter((r) => r.early.seen >= MIN_PHENOMENON_SENTENCES && r.late.seen >= MIN_PHENOMENON_SENTENCES);
  const better = rows
    .filter((r) => pctOf(r.early) - pctOf(r.late) >= MIN_PHENOMENON_CHANGE)
    .sort((a, b) => pctOf(b.early) - pctOf(b.late) - (pctOf(a.early) - pctOf(a.late)))[0];
  const weak = rows.filter((r) => pctOf(r.late) >= 50 && r !== better).sort((a, b) => pctOf(b.late) - pctOf(a.late))[0];
  const count = (v: { seen: number; missed: number }) => `${v.missed}/${v.seen} câu`;
  if (better) {
    let s = `Trong bài kiểm tra, ${lower(better.label)} có vẻ tiến bộ: sót ${count(better.early)} ở các lần đầu, ${count(better.late)} gần đây.`;
    if (weak) s += ` ${capitalize(lower(weak.label))} vẫn hay bị nghe sót (${count(weak.late)}).`;
    return s;
  }
  if (weak) return `Trong bài kiểm tra, ${lower(weak.label)} vẫn hay bị nghe sót (${count(weak.late)} gần đây).`;
  const w = weakestRate(i.stats, 10);
  if (w && w.rate >= 0.3) {
    return `Khi luyện, ${lower(PH_LABEL(w.phenomenon))} là phần bạn hay nghe sót nhất (sót ${Math.round(w.rate * 100)}% lần gặp).`;
  }
  return null;
}

const PH_LABEL = (p: Phenomenon) => PHENOMENON_INFO[p].label;

/** Lower-case the first letter unless it starts a one-letter word ("T bật", "Âm yếu" → "âm yếu"). */
function lower(label: string): string {
  if (/^\p{Lu}(\s|$)/u.test(label)) return label;
  return label.charAt(0).toLocaleLowerCase('vi') + label.slice(1);
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('vi') + s.slice(1);
}

/**
 * Practice accuracy trend of ONE module (a shift from hard to easy modules must not look like progress), first
 * half vs second half of the weeks that module was practised, MIN_PRACTICE_SAMPLE attempts on each side.
 * Review re-attempts and word cards are not in the archive (core/history noteAttempt), so a re-tested sentence
 * the learner memorised does not count; still worded as "trên các bài bạn chọn luyện", not as a skill gain.
 */
function practiceInsight(i: InsightInput): string | null {
  let best: { m: ModuleId; a: number; b: number; n: number } | null = null;
  for (const m of HISTORY_MODULES) {
    const withData = i.pw.filter((w) => (w.byModule[m]?.n ?? 0) > 0);
    if (withData.length < 2) continue;
    const half = Math.floor(withData.length / 2);
    const sum = (ws: WeekModuleAccuracy[]) => ws.reduce((acc, w) => ({ n: acc.n + (w.byModule[m]?.n ?? 0), ok: acc.ok + (w.byModule[m]?.ok ?? 0) }), { n: 0, ok: 0 });
    const early = sum(withData.slice(0, half));
    const late = sum(withData.slice(half));
    if (early.n < MIN_PRACTICE_SAMPLE || late.n < MIN_PRACTICE_SAMPLE) continue;
    const n = early.n + late.n;
    if (!best || n > best.n) best = { m, a: Math.round((early.ok / early.n) * 100), b: Math.round((late.ok / late.n) * 100), n };
  }
  if (!best) return null;
  const label = MODULE_LABEL[best.m];
  const unit = 'trên các bài bạn chọn luyện';
  if (best.b - best.a >= 5) return `${label}: độ đúng ${unit} tăng từ ${best.a}% (nửa đầu kỳ) lên ${best.b}% (nửa sau).`;
  if (best.a - best.b >= 5) return `${label}: độ đúng ${unit} giảm từ ${best.a}% (nửa đầu kỳ) xuống ${best.b}% (nửa sau); có thể bài đang khó hơn.`;
  return `${label}: độ đúng ${unit} ổn định quanh ${best.b}%.`;
}

function retentionInsight(i: InsightInput): string | null {
  if (i.ret.n < MIN_RETENTION_SAMPLE || i.ret.pct === null) return null;
  return `Khi ôn tập, bạn nhớ được ở ${i.ret.pct}% lượt ôn thẻ đã thuộc (${i.ret.n} lượt).`;
}

function understoodInsight(i: InsightInput): string | null {
  if (i.rated < 4 || i.uAvg === null) return null;
  return `Theo tự đánh giá, bạn hiểu ${understoodProse(i.uAvg)} nội dung khi nghe (trung bình ${decimalVi(i.uAvg)}/5); mức hiểu còn tùy độ khó nội dung bạn chọn.`;
}
