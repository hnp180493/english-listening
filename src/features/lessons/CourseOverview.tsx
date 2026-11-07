import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import { loadLessonProgress } from '../../core/lessons';
import { hrefFor } from '../../core/nav';
import type { CourseMeta } from '../../data/courses';
import { lessonsOf } from '../../data/lessons';
import { MissingNotice, type Missing } from './CourseList';
import { LessonNum, NoBreakRespell } from './LessonBits';
import { courseProgress, lessonStatus, percent, recommendNext } from './logic';

/** One course: its lessons in order; the recommended next one carries the page's one primary action. */
export default function CourseOverview({ course, missing }: { course: CourseMeta; missing?: Missing }) {
  const [progress] = useState(() => loadLessonProgress());
  const lessons = lessonsOf(course.id);
  const { completed, total, ratio } = courseProgress(lessons, progress);
  const next = recommendNext(lessons, progress);
  const nextStatus = next ? lessonStatus(progress, next.id) : null;
  const starting = completed === 0 && nextStatus?.state === 'new';

  return (
    <div className="stack-lg page-focus lessons-page">
      <PageHeader back={{ href: hrefFor('lessons'), label: 'Các khóa học' }} title={course.title} subtitle={course.summary} />

      {missing && <MissingNotice missing={missing} />}

      <section className="lessons-all" aria-labelledby="lessons-all-h">
        <div className="lessons-all-head">
          <h2 id="lessons-all-h" className="section-title">
            {total} bài học
          </h2>
          {completed > 0 && (
            <span className="meta">
              {completed}/{total} bài
            </span>
          )}
        </div>
        {completed > 0 && (
          <div
            className={'progress lessons-bar' + (completed === total ? ' is-done' : '')}
            role="progressbar"
            aria-label="Số bài đã học"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={completed}
            aria-valuetext={`${completed}/${total} bài`}
          >
            <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        )}

        <ol className="list-rows lessons-list">
          {lessons.map((l) => {
            const st = lessonStatus(progress, l.id);
            const isNext = next?.id === l.id;
            const done = st.state === 'done';
            const meta =
              st.state === 'done'
                ? `${l.minutes} phút · ${percent(st.best ?? 0)}`
                : st.state === 'tried'
                  ? `${l.minutes} phút · Chưa đạt quiz`
                  : `${l.minutes} phút`;
            return (
              <li key={l.id}>
                <a
                  className={'list-row lessons-row' + (isNext ? ' is-next' : '')}
                  href={hrefFor('lessons', { id: l.id })}
                  aria-current={isNext ? 'step' : undefined}
                >
                  <LessonNum lesson={l} done={done} next={isNext} />
                  <span className="list-row-body">
                    <span className="list-row-title">
                      <span className="list-row-text">
                        <span className="sr-only">Bài {l.order}: </span>
                        <NoBreakRespell text={l.title} />
                      </span>
                    </span>
                    {l.summary && <span className="lessons-row-summary">{l.summary}</span>}
                    <span className="list-row-meta">{meta}</span>
                  </span>
                  <span className="list-row-end">
                    {isNext ? (
                      <span className="btn btn-primary btn-sm lessons-row-cta">{starting ? 'Bắt đầu' : 'Học tiếp'}</span>
                    ) : (
                      <Icon icon={ChevronRight} size={18} />
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
