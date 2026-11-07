import { describe, expect, it } from 'vitest';
import { MATURE_DAYS } from '../../core/srs';
import { applyReview } from '../../core/review/schedule';
import { nextLocalMidnight, startOfLocalDay } from '../../core/review/time';
import type { ReviewCard } from '../../core/review/types';
import { lessonReviewCall, lessonReviewNote, type LessonReviewCall } from './reviewHook';

const NOW = new Date(2026, 10, 6, 10, 0).getTime();

function apply(prev: ReviewCard | undefined, call: LessonReviewCall, now = NOW) {
  return applyReview(prev, call.id, call.grade, { ctx: 'practice', enrol: call.enrol, firstGrade: call.firstGrade, enrolLeft: 0, now });
}

function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'lesson:linking',
    due: startOfLocalDay(NOW),
    interval: 3,
    ease: 2.5,
    reps: 2,
    lapses: 0,
    last: NOW - 3 * 86_400_000,
    lastGrade: 'good',
    ...over,
  };
}

describe('lessonReviewCall', () => {
  it('a pass (0.7) enrols with firstGrade good; the grade for an existing card is gradeLessonScore', () => {
    expect(lessonReviewCall('linking', 0.7, 8)).toEqual({ id: 'lesson:linking', grade: 'hard', enrol: true, firstGrade: 'good' });
    expect(lessonReviewCall('linking', 1, 8)).toMatchObject({ grade: 'good', enrol: true, firstGrade: 'good' });
    expect(lessonReviewCall('linking', 0.9, 4)).toMatchObject({ grade: 'good' });
  });

  it('a fail (0.6) does not enrol a lesson never completed', () => {
    expect(lessonReviewCall('linking', 0.6, 8)).toEqual({ id: 'lesson:linking', grade: 'again', enrol: false, firstGrade: 'again' });
  });

  it('a failed retake of a completed lesson enrols it as a miss', () => {
    expect(lessonReviewCall('linking', 0.5, 8, true)).toMatchObject({ grade: 'again', enrol: true, firstGrade: 'again' });
  });

  it('no call for an empty quiz or id; junk scores count as 0', () => {
    expect(lessonReviewCall('linking', 1, 0)).toBeNull();
    expect(lessonReviewCall('', 1, 8)).toBeNull();
    expect(lessonReviewCall('linking', Number.NaN, 8)).toMatchObject({ grade: 'again', enrol: false });
  });

  it('first pass: enrolled at 1 day (lessons are exempt from the new-card budget)', () => {
    const r = apply(undefined, lessonReviewCall('linking', 0.75, 8) as LessonReviewCall);
    expect(r.reason).toBe('enrolled');
    expect(r.budgeted).toBe(false);
    expect(r.card).toMatchObject({ interval: 1, reps: 1, due: startOfLocalDay(NOW, 1) });
  });

  it('failed retake of a completed lesson without a card: back tomorrow, never the same day', () => {
    const r = apply(undefined, lessonReviewCall('linking', 0.5, 8, true) as LessonReviewCall);
    expect(r.reason).toBe('enrolled');
    expect(r.card?.interval).toBe(0);
    expect(r.card?.due).toBe(nextLocalMidnight(NOW));
  });

  it('retakes: an existing due card is graded with the quiz score, a not-due one only pulls in on a fail', () => {
    const due = apply(card(), lessonReviewCall('linking', 0.75, 8) as LessonReviewCall);
    expect(due.reason).toBe('graded');
    expect(due.card?.interval).toBeGreaterThan(3);

    const notDue = card({ due: startOfLocalDay(NOW, 4) });
    expect(apply(notDue, lessonReviewCall('linking', 1, 8) as LessonReviewCall)).toMatchObject({
      card: null,
      reason: 'skipped-not-due',
    });
    const fail = apply(notDue, lessonReviewCall('linking', 0.25, 8) as LessonReviewCall);
    expect(fail.reason).toBe('pulled-in');
    expect(fail.card?.due).toBe(nextLocalMidnight(NOW));
    expect(fail.card?.interval).toBe(3);
  });
});

describe('lessonReviewNote', () => {
  it('says when the lesson comes back', () => {
    const r = apply(undefined, lessonReviewCall('linking', 0.75, 8) as LessonReviewCall);
    expect(lessonReviewNote(r, NOW)).toBe('Bài này sẽ quay lại trong Ôn tập ngày mai.');
    expect(lessonReviewNote({ reason: 'skipped-not-due', current: card({ due: startOfLocalDay(NOW, 4) }) }, NOW)).toBe(
      'Bài này sẽ quay lại trong Ôn tập sau 4 ngày.',
    );
  });

  it('a retired lesson says it will not be asked again', () => {
    const retired = card({ interval: MATURE_DAYS + 5, due: startOfLocalDay(NOW, MATURE_DAYS + 5) });
    expect(lessonReviewNote({ reason: 'graded', current: retired }, NOW)).toBe(
      'Bạn đã nhớ chắc bài này, Ôn tập sẽ không hỏi lại nữa.',
    );
  });

  it('is hidden without a live card', () => {
    expect(lessonReviewNote(null, NOW)).toBeUndefined();
    expect(lessonReviewNote({ reason: 'not-enrolled', current: null }, NOW)).toBeUndefined();
    expect(lessonReviewNote({ reason: 'suspended', current: card({ suspended: true }) }, NOW)).toBeUndefined();
  });
});
