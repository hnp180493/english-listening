import { useEffect, useRef, type CSSProperties } from 'react';
import { ArrowRight, Check, ChevronRight, History, RotateCcw, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { ROUTE_ICON } from '../../components/routeIcons';
import { PASS_SCORE } from '../../core/lessons';
import { hrefFor, type RouteId } from '../../core/nav';
import { lessonWordIds } from '../../core/review/words';
import { PHENOMENON_INFO } from '../../core/phenomena';
import type { CourseMeta } from '../../data/courses';
import type { Lesson, QuizItem } from '../../data/lessonTypes';
import { isPass, itemSummary, letterGroups, optionLabels, percent, summaryIsEnglish, type QuizOutcome } from './logic';

export interface QuizResultProps {
  lesson: Lesson;
  outcomes: QuizOutcome[];
  score: number;
  best: number | null;
  firstPass: boolean; // this attempt completed the lesson for the first time
  /** Next lesson in the SAME course; null at the course end. */
  next: Lesson | null;
  /** At the course end: the next course (with lessons) to offer; null after the last course. */
  nextCourse?: CourseMeta | null;
  onRetry: () => void;
  onReview: () => void;
  /** "Bài này sẽ quay lại trong Ôn tập …" (docs/review-system.md §5); hidden when absent. */
  reviewNote?: string;
}

interface NextStep {
  route: RouteId;
  params?: Record<string, string>;
  title: string;
  hint: string;
}

function nextSteps(lesson: Lesson): NextStep[] {
  const p = lesson.phenomenon;
  if (p) {
    const label = PHENOMENON_INFO[p].label.toLowerCase();
    return [
      {
        route: 'dictation',
        params: { focus: p },
        title: 'Chép chính tả',
        hint: `Nghe và gõ lại các câu có ${label}.`,
      },
      {
        route: 'pairs',
        params: { focus: p },
        title: 'Phân biệt âm',
        hint: 'Nghe và chọn giữa các câu gần giống nhau.',
      },
      {
        route: 'drill',
        params: { focus: p },
        title: 'Ôn cụm từ',
        hint: `Thẻ ôn các cụm có ${label}.`,
      },
    ];
  }
  if (lesson.course !== 'connected') {
    return [
      {
        route: 'dictation',
        params: { level: '1' },
        title: 'Chép chính tả',
        hint: 'Nghe câu dễ và gõ lại: nhận ra từ vừa học khi nghe.',
      },
      {
        route: 'shadowing',
        title: 'Nói nhại',
        hint: 'Nói theo để nhớ cách đọc bằng miệng, không chỉ bằng mắt.',
      },
    ];
  }
  if (lesson.id === 'intro') {
    return [
      {
        route: 'decoder',
        title: 'Giải mã câu',
        hint: 'Dán một câu bất kỳ để xem nó được nói ra thế nào.',
      },
      {
        route: 'dictation',
        params: { level: '1' },
        title: 'Chép chính tả',
        hint: 'Thử nghe và gõ lại vài câu dễ.',
      },
    ];
  }
  return [
    {
      route: 'dictation',
      params: { level: '3' },
      title: 'Chép chính tả (khó)',
      hint: 'Câu dài, nói nhanh, nhiều hiện tượng.',
    },
    {
      route: 'shadowing',
      title: 'Nói nhại',
      hint: 'Nói theo để tai quen nhịp câu.',
    },
    {
      route: 'stats',
      title: 'Xem tiến độ',
      hint: 'Tìm hiện tượng bạn còn hay nghe sai.',
    },
  ];
}

/** "Bạn chọn: … · Đáp án: …" for a wrong answer. */
function answerLine(item: QuizItem, o: QuizOutcome) {
  const yours =
    item.type === 'listen-type'
      ? o.typed.trim()
      : item.type === 'silent-letter'
        ? letterGroups(item.word, o.picked ?? [])
        : o.chosen >= 0
          ? (optionLabels(item)[o.chosen] ?? '')
          : '';
  // 'choose' options may be Vietnamese, so they carry no lang.
  const english = item.type !== 'which-rule' && item.type !== 'choose';
  return (
    <div>
      {yours && (
        <>
          {item.type === 'listen-type' ? 'Bạn gõ' : 'Bạn chọn'}: <s lang={english ? 'en' : undefined}>{yours}</s>
          {' · '}
        </>
      )}
      Đáp án: <strong lang={english ? 'en' : undefined}>{o.expected}</strong>
    </div>
  );
}

/** Score screen shown after the last quiz item. */
export default function QuizResult({
  lesson,
  outcomes,
  score,
  best,
  firstPass,
  next,
  nextCourse,
  onRetry,
  onReview,
  reviewNote,
}: QuizResultProps) {
  const passed = isPass(score);
  const correct = outcomes.filter((o) => o.correct).length;
  // One review line: the lesson card's note, then (after a pass) its word cards (docs/review-system.md §13.2).
  const words = passed ? lessonWordIds(lesson).length : 0;
  const review = [
    reviewNote,
    words > 0 &&
      (reviewNote
        ? `${words} từ trong bài được ôn riêng, vài từ mỗi ngày.`
        : `${words} từ trong bài sẽ vào lịch Ôn tập, vài từ mỗi ngày.`),
  ]
    .filter(Boolean)
    .join(' ');
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headRef.current?.focus();
  }, []);

  return (
    <div className="lessons-result">
      <div className={'card lessons-result-hero ' + (passed ? 'is-pass' : 'is-fail')}>
        <div
          className="lessons-result-score"
          aria-hidden="true"
          style={{ '--lessons-pct': `${Math.round(score * 100)}%` } as CSSProperties}
        >
          <span className="lessons-result-num tabular">{correct}</span>
          <span className="lessons-result-den">/{outcomes.length}</span>
        </div>
        <div className="lessons-result-text">
          <h2 ref={headRef} tabIndex={-1}>
            {passed ? (firstPass ? 'Hoàn thành bài học!' : 'Đạt yêu cầu!') : 'Chưa đạt, thử lại nhé'}
          </h2>
          <p className="lessons-result-sub">
            Đúng {correct}/{outcomes.length} câu ({percent(score)}).{' '}
            {passed
              ? 'Bài học đã được đánh dấu là đã học.'
              : `Cần đạt ${percent(PASS_SCORE)}. Xem lại các câu sai rồi làm lại.`}
          </p>
          {review && (
            <p className="lessons-result-review" role="status">
              <Icon icon={History} size={15} className="lessons-result-review-icon" />
              <span>{review}</span>
            </p>
          )}
          {best !== null && best > score && <span className="meta">Điểm cao nhất: {percent(best)}</span>}
          <div className="row lessons-result-actions">
            {passed && next && (
              <a className="btn btn-primary" href={hrefFor('lessons', { id: next.id })}>
                Bài tiếp theo: {next.title}
                <Icon icon={ArrowRight} size={16} />
              </a>
            )}
            {passed && !next && nextCourse && (
              <a className="btn btn-primary" href={hrefFor('lessons', { course: nextCourse.id })}>
                Khóa tiếp theo: {nextCourse.title}
                <Icon icon={ArrowRight} size={16} />
              </a>
            )}
            {passed && !next && !nextCourse && (
              <a className="btn btn-primary" href={hrefFor('lessons', { course: lesson.course })}>
                Về danh sách bài học
              </a>
            )}
            <button type="button" className={'btn' + (passed ? ' btn-ghost' : ' btn-primary')} onClick={onRetry}>
              <Icon icon={RotateCcw} size={16} />
              Làm lại quiz
            </button>
            <button type="button" className="btn btn-ghost" onClick={onReview}>
              Xem lại bài học
            </button>
            {!passed && next && (
              <a className="btn btn-ghost" href={hrefFor('lessons', { id: next.id })}>
                Bài tiếp theo
                <Icon icon={ArrowRight} size={16} />
              </a>
            )}
          </div>
        </div>
      </div>

      <section className="lessons-result-steps" aria-labelledby="lessons-steps-title">
        <h3 id="lessons-steps-title" className="section-title">
          Luyện tiếp để nhớ lâu
        </h3>
        <ul className="list-rows">
          {nextSteps(lesson).map((s) => (
            <li key={s.route + s.title}>
              <a className="list-row" href={hrefFor(s.route, s.params)}>
                <span className="list-row-lead" aria-hidden="true">
                  <Icon icon={ROUTE_ICON[s.route]} size={18} />
                </span>
                <span className="list-row-body">
                  <span className="list-row-title">
                    <span className="list-row-text">{s.title}</span>
                  </span>
                  <span className="list-row-meta lessons-step-hint">{s.hint}</span>
                </span>
                <span className="list-row-end">
                  <Icon icon={ChevronRight} size={18} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="card lessons-review" aria-labelledby="lessons-review-title">
        <div className="lessons-review-head">
          <h3 id="lessons-review-title">Xem lại từng câu</h3>
          <span className="meta">
            {correct}/{outcomes.length} đúng
          </span>
        </div>
        <ol className="lessons-review-list">
          {lesson.quiz.map((item, i) => {
            const o = outcomes[i];
            const ok = !!o?.correct;
            return (
              <li key={i} className={ok ? 'is-correct' : 'is-wrong'}>
                <span className="lessons-review-mark">
                  <Icon icon={ok ? Check : X} size={14} strokeWidth={2.75} label={ok ? 'Đúng' : 'Sai'} />
                </span>
                <div>
                  <div className="lessons-review-q" lang={summaryIsEnglish(item) ? 'en' : undefined}>
                    {itemSummary(item)}
                  </div>
                  {!ok && (
                    <div className="lessons-review-explain">
                      {o && answerLine(item, o)}
                      <div>{item.explain}</div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
