// Ôn tập item: a lesson, reviewed as 4 of its quiz questions (listening first, rotating between reviews).

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { hrefFor } from '../../../core/nav';
import { gradeLessonScore, lessonReviewItems, recordReview } from '../../../core/review';
import { recordAttempt } from '../../../core/stats';
import { courseTitle } from '../../../data/courses';
import { isListeningItem, itemPhenomena, type QuizOutcome } from '../../lessons/logic';
import Quiz from '../../lessons/Quiz';
import type { Resolved } from '../resolve';
import type { ItemBaseProps } from './types';
import Verdict from './Verdict';

export interface LessonItemProps extends ItemBaseProps {
  item: Extract<Resolved, { kind: 'lesson' }>;
}

const noop = () => {};

export default function LessonItem({ item, state, graded, onGraded, onNext }: LessonItemProps) {
  const { lesson } = item;
  // Picked once per mount: the card state changes when this item is graded, the questions must not.
  const [idx] = useState(() =>
    lessonReviewItems(
      lesson.id,
      lesson.quiz.map((q) => (isListeningItem(q) ? 'listen' : q.type)),
      state,
    ),
  );
  const sub = useMemo(() => ({ ...lesson, quiz: idx.map((i) => lesson.quiz[i]) }), [lesson, idx]);
  const [done, setDone] = useState<{ correct: number; total: number } | null>(null);
  const gradedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const onFinish = (outcomes: QuizOutcome[]) => {
    if (done) return;
    const correct = outcomes.filter((o) => o.correct).length;
    const total = outcomes.length;
    setDone({ correct, total });
    if (graded || gradedRef.current || total === 0) return;
    gradedRef.current = true;
    const grade = gradeLessonScore(correct / total);
    const res = recordReview(item.id, grade, { ctx: 'review', enrol: true });
    outcomes.forEach((o, k) => {
      const q = sub.quiz[k];
      if (!q) return;
      const seen = itemPhenomena(q, lesson.phenomenon);
      try {
        recordAttempt(
          {
            module: 'lesson',
            itemId: `${lesson.id}:${idx[k]}`,
            correct: o.correct,
            seen,
            missed: o.correct ? [] : seen,
          },
          { inReview: true },
        );
      } catch {
        // stats are best effort
      }
    });
    onGraded({ grade, correct: correct === total, current: res.current });
  };

  const ok = done ? gradeLessonScore(done.total ? done.correct / done.total : 0) !== 'again' : false;

  return (
    <div className="stack rev-lesson">
      <h2 ref={headingRef} tabIndex={-1} className="rev-lesson-title">
        Ôn bài {lesson.order}
        {lesson.course !== 'connected' && ` (${courseTitle(lesson.course)})`} · {lesson.title}
      </h2>
      {done ? (
        <Verdict
          correct={done.correct}
          total={done.total}
          ok={ok}
          detail={ok ? 'Bạn vẫn nắm được bài này.' : 'Đọc lại phần giải thích của bài sẽ giúp bạn nhớ lâu hơn.'}
          onNext={onNext}
          extra={
            <a className="btn btn-ghost" href={hrefFor('lessons', { id: lesson.id })}>
              <Icon icon={BookOpen} size={16} />
              Xem lại bài
            </a>
          }
        />
      ) : (
        <Quiz embedded lesson={sub} onFinish={onFinish} onExit={noop} />
      )}
    </div>
  );
}
