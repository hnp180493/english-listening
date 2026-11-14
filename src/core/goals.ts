// Daily goal + "Hôm nay" plan. Pure functions: no DOM, no storage — callers pass data in.

import type { CheckupDue } from './benchmark';
import { formatClock, type TimerStatus } from './listening';
import { PHENOMENON_INFO } from './phenomena';
import { localDay, type Attempt, type ModuleId, type PhenomenonStat } from './stats';
import {
  activeCourse,
  lastLessonAttemptId,
  lessonsInCourse,
  nextInCourse,
  sortLessons,
  type CourseMeta,
  type LessonMeta,
  type LessonProgress,
} from './lessons';
import type { RouteId } from './nav';
import { PHENOMENA, type Phenomenon } from './types';

export const MODULE_IDS: readonly ModuleId[] = ['dictation', 'drill', 'decoder', 'lesson', 'pairs', 'shadowing', 'media', 'town'];

export const GOAL_MIN = 10;
export const GOAL_MAX = 100;
export const GOAL_STEP = 5;
export const GOAL_DEFAULT = 30;

/** Distinct dictation sentences suggested per day. */
export const DICTATION_TARGET = 10;
/** Focused attempts (containing the weakest phenomenon) suggested per day. */
export const FOCUS_TARGET = 5;
/** Shadowing attempts suggested per day. */
export const SHADOWING_TARGET = 3;

/** Clamp a stored goal to the slider range and snap it to the step grid. */
export function clampGoal(g: unknown): number {
  if (typeof g !== 'number' || !Number.isFinite(g)) return GOAL_DEFAULT;
  const snapped = Math.round(g / GOAL_STEP) * GOAL_STEP;
  return Math.min(GOAL_MAX, Math.max(GOAL_MIN, snapped));
}

function isModule(m: unknown): m is ModuleId {
  return typeof m === 'string' && (MODULE_IDS as readonly string[]).includes(m);
}

function isPhenomenon(p: unknown): p is Phenomenon {
  return typeof p === 'string' && (PHENOMENA as readonly string[]).includes(p);
}

/** Attempts that are well-formed enough to count. Storage may hold anything. */
export function cleanAttempts(attempts: unknown): Attempt[] {
  if (!Array.isArray(attempts)) return [];
  const out: Attempt[] = [];
  for (const raw of attempts) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    if (typeof a.at !== 'number' || !Number.isFinite(a.at)) continue;
    if (!isModule(a.module)) continue;
    out.push({
      at: a.at,
      module: a.module,
      itemId: typeof a.itemId === 'string' || typeof a.itemId === 'number' ? String(a.itemId) : '',
      correct: a.correct === true,
      seen: Array.isArray(a.seen) ? a.seen.filter(isPhenomenon) : [],
      missed: Array.isArray(a.missed) ? a.missed.filter(isPhenomenon) : [],
    });
  }
  return out;
}

/** Attempts made on the same local calendar day as `now`. */
export function attemptsToday(attempts: unknown, now: number): Attempt[] {
  const today = localDay(now);
  return cleanAttempts(attempts).filter((a) => localDay(a.at) === today);
}

export interface StatsLike {
  attempts?: unknown;
  byPhenomenon?: Partial<Record<Phenomenon, PhenomenonStat>> | unknown;
}

export interface TodayProgress {
  attempts: number;
  goal: number;
  pct: number; // 0..100, capped
  byModule: Record<ModuleId, number>;
  done: boolean;
}

export function todayProgress(stats: StatsLike | null | undefined, now: number, dailyGoal: unknown): TodayProgress {
  const goal = clampGoal(dailyGoal);
  const byModule = {} as Record<ModuleId, number>;
  for (const m of MODULE_IDS) byModule[m] = 0;
  const today = attemptsToday(stats?.attempts, now);
  for (const a of today) byModule[a.module] += 1;
  const attempts = today.length;
  return {
    attempts,
    goal,
    pct: Math.min(100, Math.round((attempts / goal) * 100)),
    byModule,
    done: attempts >= goal,
  };
}

export interface PhenomenonRate {
  phenomenon: Phenomenon;
  seen: number;
  missed: number;
  rate: number; // 0..1
}

/** Miss rate per phenomenon, sanitized (missed never exceeds seen). */
export function phenomenonRates(stats: StatsLike | null | undefined): PhenomenonRate[] {
  const by = (stats?.byPhenomenon && typeof stats.byPhenomenon === 'object' ? stats.byPhenomenon : {}) as Record<
    string,
    unknown
  >;
  return PHENOMENA.map((p) => {
    const v = by[p] as Partial<PhenomenonStat> | undefined;
    const seen = v && typeof v.seen === 'number' && Number.isFinite(v.seen) ? Math.max(0, Math.floor(v.seen)) : 0;
    const missedRaw = v && typeof v.missed === 'number' && Number.isFinite(v.missed) ? Math.max(0, Math.floor(v.missed)) : 0;
    const missed = Math.min(missedRaw, seen);
    return { phenomenon: p, seen, missed, rate: seen > 0 ? missed / seen : 0 };
  });
}

/**
 * The phenomenon the learner misses most often, among those seen at least `minSeen` times.
 * Ties: more misses first, then the canonical PHENOMENA order. null when there is not enough
 * data or nothing has been missed yet.
 */
export function weakestPhenomenon(stats: StatsLike | null | undefined, minSeen = 3): Phenomenon | null {
  const w = weakestRate(stats, minSeen);
  return w ? w.phenomenon : null;
}

export function weakestRate(stats: StatsLike | null | undefined, minSeen = 3): PhenomenonRate | null {
  let best: PhenomenonRate | null = null;
  for (const r of phenomenonRates(stats)) {
    if (r.seen < Math.max(1, minSeen) || r.missed === 0) continue;
    if (!best || r.rate > best.rate || (r.rate === best.rate && r.missed > best.missed)) best = r;
  }
  return best;
}

// ───────────────────────── Daily plan ─────────────────────────

export interface DrillSummaryLike {
  due: number;
  newAvailable: number;
  learned: number;
  /** New cards introduced today (drill store daily counter). */
  newIntroduced?: number;
}

/** Ôn tập counters for the plan (core/review summary). */
export interface ReviewPlanInput {
  dueToday: number;
  reviewedToday: number;
  minutesToday: number;
  heldBack: number;
  /** Due items moved to later days without back-pressure (lessons over the daily cap, catch-up). */
  deferred?: number;
}

export interface PlanInput {
  now: number;
  stats: StatsLike | null | undefined;
  drill: DrillSummaryLike;
  lessons: readonly LessonMeta[];
  lessonProgress: LessonProgress;
  /** Course titles and order (src/data/courses). Without it: COURSE_IDS order, no course name in labels. */
  courses?: readonly Pick<CourseMeta, 'id' | 'title' | 'order'>[];
  /** Sentence suggested for shadowing (e.g. the sentence of the day). */
  shadowSentenceId?: string;
  minSeen?: number;
  /** Ôn tập summary. When present, due drill cards are served by Ôn tập instead of the drill item. */
  review?: ReviewPlanInput;
}

export type PlanKind = 'review' | 'lesson' | 'drill' | 'dictation' | 'focus' | 'shadowing' | 'later';

export interface PlanItem {
  id: PlanKind;
  title: string; // Vietnamese
  detail: string; // Vietnamese
  route: RouteId;
  params?: Record<string, string>;
  done: boolean;
  /** Optional 0..1 progress for items measured in counts. */
  progress?: number;
  /** Informational only (back-pressure): never "next", never done, not counted in the plan total. */
  muted?: boolean;
}

function nonNegInt(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * "Học bài …": a lesson finished today (done), else the next lesson of the course the learner is in (core/lessons
 * activeCourse: the course of the latest lesson activity, else the first unfinished course). Counts are per course.
 * Lessons outside course "connected" name their course: "Học bài 2 (Từ bất quy tắc): …".
 */
function lessonPlan(input: PlanInput): PlanItem | null {
  const courses = [...(Array.isArray(input.courses) ? input.courses : [])].sort((a, b) => a.order - b.order);
  const courseOrder = courses.length ? courses.map((c) => c.id) : undefined;
  const lessons = sortLessons(Array.isArray(input.lessons) ? input.lessons : [], courseOrder);
  if (lessons.length === 0) return null;
  const progress = input.lessonProgress && typeof input.lessonProgress === 'object' ? input.lessonProgress : {};
  const today = localDay(input.now);
  const completed = (id: string) => (progress[id]?.completedAt ?? 0) > 0;
  const label = (l: LessonMeta) => {
    const course = l.course !== 'connected' ? courses.find((c) => c.id === l.course)?.title : undefined;
    return course ? `Học bài ${l.order} (${course}): ${l.title}` : `Học bài ${l.order}: ${l.title}`;
  };
  const count = (l: LessonMeta) => {
    const inCourse = lessonsInCourse(lessons, l.course);
    return `${inCourse.filter((x) => completed(x.id)).length}/${inCourse.length} bài`;
  };

  const doneToday = lessons.filter((l) => {
    const at = progress[l.id]?.completedAt ?? 0;
    return at > 0 && localDay(at) === today;
  });
  if (doneToday.length > 0) {
    const last = doneToday.reduce((a, b) => ((progress[b.id]?.completedAt ?? 0) >= (progress[a.id]?.completedAt ?? 0) ? b : a));
    return {
      id: 'lesson',
      title: label(last),
      detail:
        doneToday.length > 1
          ? `Hôm nay bạn đã xong ${doneToday.length} bài · ${count(last)}`
          : `Đã hoàn thành hôm nay · ${count(last)}`,
      route: 'lessons',
      params: { id: last.id },
      done: true,
      progress: 1,
    };
  }

  const course = activeCourse(lessons, progress, {
    recentLessonId: lastLessonAttemptId((input.stats as { attempts?: unknown } | null | undefined)?.attempts),
    courseOrder,
  });
  const next = course ? nextInCourse(lessons, progress, course) : null;
  if (!next) return null;
  const minutes = nonNegInt(next.minutes);
  return {
    id: 'lesson',
    title: label(next),
    detail: [minutes > 0 ? `Khoảng ${minutes} phút` : null, `${count(next)} đã xong`].filter(Boolean).join(' · '),
    route: 'lessons',
    params: { id: next.id },
    done: false,
    progress: 0,
  };
}

function reviewPlan(review: ReviewPlanInput): PlanItem | null {
  const due = nonNegInt(review.dueToday);
  const done = nonNegInt(review.reviewedToday);
  const minutes = Math.max(1, nonNegInt(review.minutesToday));
  if (due > 0) {
    return {
      id: 'review',
      title: `Ôn tập · khoảng ${minutes} phút`,
      detail: done > 0 ? `Đã ôn ${done} mục, còn ${due} mục` : `${due} mục đến hạn`,
      route: 'review',
      done: false,
      progress: done / (done + due),
    };
  }
  if (done > 0) {
    // Due items the budget moved to later days are not "hết": say they were moved
    const moved = nonNegInt(review.heldBack) + nonNegInt(review.deferred ?? 0) > 0;
    return {
      id: 'review',
      title: 'Ôn tập',
      detail: moved ? `Đã ôn ${done} mục, phần còn lại dời sang ngày sau` : `Đã ôn ${done} mục, hết mục đến hạn`,
      route: 'review',
      done: true,
      progress: 1,
    };
  }
  return null;
}

/** With Ôn tập on: due cards are reviewed there, so the drill item is only about new chunks. */
function drillNewPlan(input: PlanInput): PlanItem | null {
  const introduced = nonNegInt(input.drill?.newIntroduced);
  const fresh = nonNegInt(input.drill?.newAvailable);
  if (introduced > 0) {
    return {
      id: 'drill',
      title: 'Học cụm từ mới',
      detail: `Đã học ${introduced} cụm mới hôm nay`,
      route: 'drill',
      done: true,
      progress: 1,
    };
  }
  if (fresh > 0) {
    return {
      id: 'drill',
      title: `Học ${fresh} cụm từ mới`,
      detail: 'Các cụm hay bị nói nhanh: gonna, wanna, kinda…',
      route: 'drill',
      done: false,
      progress: 0,
    };
  }
  return null;
}

function drillPlan(input: PlanInput, today: Attempt[]): PlanItem | null {
  if (input.review) return drillNewPlan(input);
  const due = nonNegInt(input.drill?.due);
  const fresh = nonNegInt(input.drill?.newAvailable);
  const practised = today.filter((a) => a.module === 'drill').length;
  if (due > 0) {
    return {
      id: 'drill',
      title: `Ôn ${due} thẻ cụm từ đến hạn`,
      detail: practised > 0 ? `Đã ôn ${practised} lượt hôm nay, còn ${due} thẻ` : 'Ôn đúng lúc để nhớ lâu',
      route: 'drill',
      done: false,
      progress: practised > 0 ? practised / (practised + due) : 0,
    };
  }
  if (practised > 0) {
    return {
      id: 'drill',
      title: 'Ôn thẻ cụm từ',
      detail: `Đã ôn ${practised} lượt, không còn thẻ đến hạn`,
      route: 'drill',
      done: true,
      progress: 1,
    };
  }
  if (fresh > 0) {
    return {
      id: 'drill',
      title: `Học ${fresh} cụm từ mới`,
      detail: 'Các cụm hay bị nói nhanh: gonna, wanna, kinda…',
      route: 'drill',
      done: false,
      progress: 0,
    };
  }
  return null;
}

function dictationPlan(today: Attempt[]): PlanItem {
  const ids = new Set(today.filter((a) => a.module === 'dictation').map((a) => a.itemId));
  const n = ids.size;
  return {
    id: 'dictation',
    title: `Chép chính tả ${DICTATION_TARGET} câu`,
    detail:
      n >= DICTATION_TARGET
        ? `Đã chép ${n} câu hôm nay`
        : n > 0
          ? `Đã chép ${n}/${DICTATION_TARGET} câu, còn ${DICTATION_TARGET - n} câu`
          : 'Nghe câu nói tự nhiên rồi gõ lại',
    route: 'dictation',
    done: n >= DICTATION_TARGET,
    progress: Math.min(1, n / DICTATION_TARGET),
  };
}

function dayNumber(now: number): number {
  const [y, m, d] = localDay(now).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function focusPlan(input: PlanInput, today: Attempt[]): PlanItem | null {
  const weak = weakestRate(input.stats, input.minSeen ?? 3);
  if (!weak) return null;
  const info = PHENOMENON_INFO[weak.phenomenon];
  // Alternate between minimal pairs and focused dictation day by day.
  const route: RouteId = dayNumber(input.now) % 2 === 0 ? 'pairs' : 'dictation';
  const n = today.filter((a) => (a.module === 'pairs' || a.module === 'dictation') && a.seen.includes(weak.phenomenon)).length;
  const pct = Math.round(weak.rate * 100);
  return {
    id: 'focus',
    title: `Luyện điểm yếu: ${info.label}`,
    detail:
      n >= FOCUS_TARGET
        ? `Đã luyện ${n} lượt về ${info.label} hôm nay`
        : `Bạn nghe sót ${pct}% · ${route === 'pairs' ? 'Phân biệt âm' : 'Chép chính tả'} ${FOCUS_TARGET} lượt (${Math.min(n, FOCUS_TARGET)}/${FOCUS_TARGET})`,
    route,
    params: { focus: weak.phenomenon },
    done: n >= FOCUS_TARGET,
    progress: Math.min(1, n / FOCUS_TARGET),
  };
}

function shadowingPlan(input: PlanInput, today: Attempt[]): PlanItem {
  const n = today.filter((a) => a.module === 'shadowing').length;
  const params = input.shadowSentenceId ? { id: input.shadowSentenceId } : undefined;
  return {
    id: 'shadowing',
    title: `Nói nhại ${SHADOWING_TARGET} câu`,
    detail:
      n >= SHADOWING_TARGET
        ? `Đã nói theo ${n} lượt hôm nay`
        : n > 0
          ? `Đã nói theo ${n}/${SHADOWING_TARGET} câu`
          : input.shadowSentenceId
            ? 'Bắt đầu với câu của ngày: nghe, nói theo, so sánh'
            : 'Nghe, nói theo, so sánh với giọng mẫu',
    route: 'shadowing',
    params,
    done: n >= SHADOWING_TARGET,
    progress: Math.min(1, n / SHADOWING_TARGET),
  };
}

/**
 * Back-pressure: while Ôn tập holds items back, new learning (not-done dictation, not-done "Học N cụm từ
 * mới") waits. Those items are replaced by one muted "Ôn trước, học mới sau" line at the first one's place.
 */
function applyBackPressure(items: PlanItem[], heldBack: number): PlanItem[] {
  if (heldBack <= 0) return items;
  const paused = (it: PlanItem) => !it.done && (it.id === 'dictation' || it.id === 'drill');
  const at = items.findIndex(paused);
  if (at < 0) return items;
  const later: PlanItem = {
    id: 'later',
    title: 'Ôn trước, học mới sau',
    detail: `Còn ${heldBack} mục tồn, học mới tạm nghỉ để ôn kịp`,
    route: 'review',
    done: false,
    progress: 0,
    muted: true,
  };
  const out: PlanItem[] = [];
  items.forEach((it, i) => {
    if (i === at) out.push(later);
    if (!paused(it)) out.push(it);
  });
  return out;
}

/** Today's suggested checklist, in the order the learner should do it. */
export function dailyPlan(input: PlanInput): PlanItem[] {
  const today = attemptsToday(input.stats?.attempts, input.now);
  const review = input.review;
  const items: (PlanItem | null)[] = [
    review ? reviewPlan(review) : null,
    lessonPlan(input),
    drillPlan(input, today),
    dictationPlan(today),
    focusPlan(input, today),
    shadowingPlan(input, today),
  ];
  const list = items.filter((x): x is PlanItem => x !== null);
  return review ? applyBackPressure(list, nonNegInt(review.heldBack)) : list;
}

export function planDoneCount(items: readonly PlanItem[]): number {
  return items.filter((i) => i.done && !i.muted).length;
}

/** Items that count in the plan's "x/y" (muted lines are informational). */
export function planTotal(items: readonly PlanItem[]): number {
  return items.filter((i) => !i.muted).length;
}

// ───────────────────────── Real listening + periodic checkup (Hôm nay) ─────────────────────────

export interface ListeningLineInput {
  /** Minutes logged today (core/listening listeningToday / minutesOnDay). */
  minutes: number;
  /** Settings.listenGoal; 0 = off. */
  goal: number;
  /** This browser's stopwatch, when there is one. */
  timer?: { status: TimerStatus; elapsedMs: number } | null;
}

/**
 * The one compact "Nghe tiếng Anh thật" row of Hôm nay. Its action is secondary ("Ghi giờ nghe", soft/ghost
 * button or link to #/listening): it never competes with the plan's primary button.
 */
export interface ListeningLine {
  show: boolean; // false when the goal is off and there is nothing today (no row at all)
  minutes: number;
  goal: number; // 0 = off
  pct: number; // 0..100 capped (0 without a goal)
  done: boolean; // goal reached today
  title: string; // "Nghe tiếng Anh: 20/30 phút" | "Nghe tiếng Anh: 20 phút hôm nay" (fits one line at 375px)
  detail: string | null; // "Còn 10 phút" | "Đã đạt mục tiêu hôm nay" | null
  timerLabel: string | null; // "Đang nghe 12:34" | "Đang tạm dừng 12:34" | "Chưa lưu 12:34"
  actionLabel: string; // "Ghi giờ nghe"
  route: RouteId; // 'listening'
}

export function listeningLine(input: ListeningLineInput): ListeningLine {
  const minutes = nonNegInt(input.minutes);
  const goal = nonNegInt(input.goal);
  const t = input.timer ?? null;
  const timerLabel = t
    ? `${t.status === 'running' ? 'Đang nghe' : t.status === 'paused' ? 'Đang tạm dừng' : 'Chưa lưu'} ${formatClock(t.elapsedMs)}`
    : null;
  const done = goal > 0 && minutes >= goal;
  return {
    show: goal > 0 || minutes > 0 || t !== null,
    minutes,
    goal,
    pct: goal > 0 ? Math.min(100, Math.round((minutes / goal) * 100)) : 0,
    done,
    title: goal > 0 ? `Nghe tiếng Anh: ${minutes}/${goal} phút` : `Nghe tiếng Anh: ${minutes} phút hôm nay`,
    detail: goal === 0 ? null : done ? 'Đã đạt mục tiêu hôm nay' : minutes > 0 ? `Còn ${goal - minutes} phút` : null,
    timerLabel,
    actionLabel: 'Ghi giờ nghe',
    route: 'listening',
  };
}

/**
 * Optional plan row for "Kiểm tra định kỳ". Kept out of dailyPlan and PlanKind on purpose: it is never the
 * page's primary action and does not count in the plan's x/y. Hôm nay shows it after the plan rows (or as a
 * muted line), with a soft button at most.
 */
export interface CheckupPlanItem extends Omit<PlanItem, 'id'> {
  id: 'checkup';
  optional: true;
}

/** From core/benchmark checkupDue(results, now, onboardingDone). null when no checkup is suggested today. */
export function checkupPlan(due: CheckupDue | null | undefined): CheckupPlanItem | null {
  if (!due || !due.kind) return null;
  if (due.kind === 'baseline') {
    return {
      id: 'checkup',
      optional: true,
      title: 'Làm bài kiểm tra đầu vào để có mốc so sánh',
      detail: 'Khoảng 10 phút · nghe ở tốc độ tự nhiên',
      route: 'checkup',
      done: false,
      progress: 0,
    };
  }
  const days = nonNegInt(due.daysSince);
  return {
    id: 'checkup',
    optional: true,
    title: 'Đến lúc kiểm tra định kỳ',
    detail: `${days} ngày từ lần trước · khoảng 10 phút`,
    route: 'checkup',
    done: false,
    progress: 0,
  };
}
