// Lesson + course contracts and the progress store. Lesson content lives in src/data/lessons.ts (course
// "connected") and src/data/courses/*.ts (the other courses); course titles in src/data/courses/index.ts.
// Authoring guide: docs/courses.md.
import { KEYS, loadJSON, saveJSON } from './storage';
import type { Phenomenon } from './types';

/** Course ids in display order. A lesson id is unique across ALL courses (progress and review cards key on it). */
export const COURSE_IDS = ['connected', 'spelling', 'irregular', 'loanwords'] as const;
export type CourseId = (typeof COURSE_IDS)[number];

export function isCourseId(v: unknown): v is CourseId {
  return typeof v === 'string' && (COURSE_IDS as readonly string[]).includes(v);
}

/** Course card info (src/data/courses/index.ts). */
export interface CourseMeta {
  id: CourseId;
  title: string; // Vietnamese, short ("Nghe nối âm")
  summary: string; // Vietnamese, one line (≤ 70 chars)
  order: number; // 1-based position in the course list
}

/** Minimal lesson info every module may rely on. The full Lesson type (in src/data/lessonTypes.ts) extends this. */
export interface LessonMeta {
  id: string; // stable slug, unique across all courses, e.g. "intro", "linking"
  course: CourseId;
  order: number; // 1-based display order WITHIN its course ("Bài 3")
  title: string; // Vietnamese
  summary: string; // Vietnamese, one sentence
  phenomenon: Phenomenon | null; // connected-speech lessons only; null for intro/review and every other course
  minutes: number; // estimated duration
}

export interface LessonRecord {
  completedAt: number; // epoch ms of first pass
  bestScore: number; // 0..1 quiz score
  attempts: number;
}

export type LessonProgress = Record<string, LessonRecord>;

export function loadLessonProgress(): LessonProgress {
  const raw = loadJSON<unknown>(KEYS.lessons, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: LessonProgress = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = v as Partial<LessonRecord> | null;
    if (r && typeof r.completedAt === 'number' && typeof r.bestScore === 'number' && typeof r.attempts === 'number') {
      out[id] = { completedAt: r.completedAt, bestScore: r.bestScore, attempts: r.attempts };
    }
  }
  return out;
}

/** Record a quiz result. A lesson counts as completed once score >= PASS_SCORE. */
export const PASS_SCORE = 0.7;

export function recordLessonResult(id: string, score: number, now: number = Date.now()): LessonProgress {
  const p = loadLessonProgress();
  const prev = p[id];
  if (prev) {
    p[id] = { ...prev, bestScore: Math.max(prev.bestScore, score), attempts: prev.attempts + 1 };
  } else if (score >= PASS_SCORE) {
    p[id] = { completedAt: now, bestScore: score, attempts: 1 };
  } else {
    // not passed yet: keep attempts without completion by storing completedAt 0
    p[id] = { completedAt: 0, bestScore: score, attempts: 1 };
  }
  if (p[id].completedAt === 0 && score >= PASS_SCORE) p[id].completedAt = now;
  saveJSON(KEYS.lessons, p);
  return p;
}

export function isLessonCompleted(p: LessonProgress, id: string): boolean {
  return (p[id]?.completedAt ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Courses: ordering and "where is the learner" (pure; callers pass data in)
// ---------------------------------------------------------------------------

type Ordered = Pick<LessonMeta, 'id' | 'course' | 'order'>;

const courseRank = (c: string, courseOrder: readonly string[]) => {
  const i = courseOrder.indexOf(c);
  return i < 0 ? courseOrder.length : i;
};

/** Lessons sorted by course (COURSE_IDS order, or `courseOrder`), then by order within the course. */
export function sortLessons<T extends Ordered>(lessons: readonly T[], courseOrder: readonly string[] = COURSE_IDS): T[] {
  return [...lessons]
    .filter((l) => l && typeof l.id === 'string')
    .sort((a, b) => courseRank(a.course, courseOrder) - courseRank(b.course, courseOrder) || (a.order ?? 0) - (b.order ?? 0));
}

/** The lessons of one course, by order. */
export function lessonsInCourse<T extends Ordered>(lessons: readonly T[], course: string): T[] {
  return [...lessons].filter((l) => l && l.course === course).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Lesson id of the most recent lesson quiz attempt in the stats log (itemId "<lessonId>:<index>"), or null. Word
 * reviews of Ôn tập (itemId "word:<ref>", also module 'lesson') are no lesson activity and are skipped.
 * Accepts unknown input (stats come from storage).
 */
export function lastLessonAttemptId(attempts: unknown): string | null {
  if (!Array.isArray(attempts)) return null;
  let best: { at: number; id: string } | null = null;
  for (const a of attempts as { module?: unknown; itemId?: unknown; at?: unknown }[]) {
    if (!a || a.module !== 'lesson' || typeof a.itemId !== 'string' || typeof a.at !== 'number') continue;
    if (a.itemId.startsWith('word:')) continue;
    const id = a.itemId.split(':')[0];
    if (id && (!best || a.at >= best.at)) best = { at: a.at, id };
  }
  return best?.id ?? null;
}

/**
 * The course the learner is in: the course of the most recent lesson activity (`recentLessonId`, else the lesson
 * passed last) while it still has unfinished lessons; otherwise the first course (in order) with an unfinished
 * lesson. Null when every lesson of every course is done (or there are no lessons).
 */
export function activeCourse<T extends Ordered>(
  lessons: readonly T[],
  progress: LessonProgress,
  opts: { recentLessonId?: string | null; courseOrder?: readonly string[] } = {},
): CourseId | null {
  const order = opts.courseOrder ?? COURSE_IDS;
  const p = progress && typeof progress === 'object' ? progress : {};
  const done = (id: string) => (p[id]?.completedAt ?? 0) > 0;
  const unfinished = (course: string) => lessons.some((l) => l.course === course && !done(l.id));
  let recent = opts.recentLessonId ? lessons.find((l) => l.id === opts.recentLessonId) : undefined;
  if (!recent) {
    let at = 0;
    for (const l of lessons) {
      const c = p[l.id]?.completedAt ?? 0;
      if (c > at) {
        at = c;
        recent = l;
      }
    }
  }
  if (recent && isCourseId(recent.course) && unfinished(recent.course)) return recent.course;
  for (const c of sortLessons(lessons, order)) {
    if (!done(c.id) && isCourseId(c.course)) return c.course;
  }
  return null;
}

/** First unfinished lesson (by order) of a course, or null when the course is done. */
export function nextInCourse<T extends Ordered>(lessons: readonly T[], progress: LessonProgress, course: string): T | null {
  const p = progress && typeof progress === 'object' ? progress : {};
  return lessonsInCourse(lessons, course).find((l) => !((p[l.id]?.completedAt ?? 0) > 0)) ?? null;
}
