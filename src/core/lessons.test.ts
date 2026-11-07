import { describe, expect, it } from 'vitest';
import {
  activeCourse,
  isCourseId,
  lastLessonAttemptId,
  lessonsInCourse,
  nextInCourse,
  sortLessons,
  type CourseId,
  type LessonProgress,
} from './lessons';

const L = (id: string, course: CourseId, order: number) => ({ id, course, order });
const LESSONS = [
  L('irr-2', 'irregular', 2),
  L('intro', 'connected', 1),
  L('sp-1', 'spelling', 1),
  L('linking', 'connected', 2),
  L('irr-1', 'irregular', 1),
];
const done = (at = 1000) => ({ completedAt: at, bestScore: 1, attempts: 1 });

describe('course helpers', () => {
  it('isCourseId', () => {
    expect(isCourseId('spelling')).toBe(true);
    expect(isCourseId('nope')).toBe(false);
    expect(isCourseId(undefined)).toBe(false);
  });

  it('sortLessons orders by course, then order; lessonsInCourse keeps one course', () => {
    expect(sortLessons(LESSONS).map((l) => l.id)).toEqual(['intro', 'linking', 'sp-1', 'irr-1', 'irr-2']);
    expect(sortLessons(LESSONS, ['irregular', 'connected', 'spelling']).map((l) => l.id)[0]).toBe('irr-1');
    expect(lessonsInCourse(LESSONS, 'irregular').map((l) => l.id)).toEqual(['irr-1', 'irr-2']);
  });

  it('lastLessonAttemptId reads the latest lesson attempt only', () => {
    expect(lastLessonAttemptId(undefined)).toBeNull();
    expect(
      lastLessonAttemptId([
        { module: 'lesson', itemId: 'intro:3', at: 5 },
        { module: 'dictation', itemId: 's001', at: 9 },
        { module: 'lesson', itemId: 'irr-1:0', at: 7 },
      ]),
    ).toBe('irr-1');
  });

  it('lastLessonAttemptId skips word reviews of Ôn tập (module lesson, itemId word:…)', () => {
    expect(
      lastLessonAttemptId([
        { module: 'lesson', itemId: 'ir-silent:2', at: 5 },
        { module: 'lesson', itemId: 'word:knee~nee', at: 9 },
        { module: 'lesson', itemId: 'word:read~red', at: 10 },
      ]),
    ).toBe('ir-silent');
    expect(lastLessonAttemptId([{ module: 'lesson', itemId: 'word:knee~nee', at: 9 }])).toBeNull();
  });

  it('activeCourse: a new learner starts with the first course', () => {
    expect(activeCourse(LESSONS, {})).toBe('connected');
  });

  it('activeCourse follows the latest lesson activity while that course has lessons left', () => {
    const p: LessonProgress = { intro: done(2000) };
    expect(activeCourse(LESSONS, p, { recentLessonId: 'irr-1' })).toBe('irregular');
    // no attempt log: the lesson passed last decides
    expect(activeCourse(LESSONS, { intro: done(1000), 'irr-1': done(3000) })).toBe('irregular');
  });

  it('activeCourse moves on to the first unfinished course once the current one is done', () => {
    const p: LessonProgress = { 'irr-1': done(), 'irr-2': done(5000) };
    expect(activeCourse(LESSONS, p, { recentLessonId: 'irr-2' })).toBe('connected');
    const all: LessonProgress = Object.fromEntries(LESSONS.map((l) => [l.id, done()]));
    expect(activeCourse(LESSONS, all)).toBeNull();
  });

  it('nextInCourse is the first unfinished lesson of the course', () => {
    expect(nextInCourse(LESSONS, { 'irr-1': done() }, 'irregular')?.id).toBe('irr-2');
    expect(nextInCourse(LESSONS, { 'irr-1': done(), 'irr-2': done() }, 'irregular')).toBeNull();
  });
});
