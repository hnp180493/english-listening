import { useState } from 'react';
import { AudioLines, ChevronRight, Languages, Shapes, SpellCheck, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import { activeCourse, lastLessonAttemptId, loadLessonProgress, type CourseId } from '../../core/lessons';
import { hrefFor } from '../../core/nav';
import { loadStats } from '../../core/stats';
import { availableCourses, LESSONS, lessonsOf } from '../../data/lessons';
import { courseProgress, recommendNext } from './logic';

/** Neutral lead icon of each course row (no colour: docs/design-system.md, list row anatomy). */
const COURSE_ICON: Record<CourseId, LucideIcon> = {
  connected: AudioLines,
  spelling: SpellCheck,
  irregular: Shapes,
  loanwords: Languages,
};

export type Missing = { kind: 'lesson' | 'course'; id: string };

/** Short, safe echo of an unknown id in the "not found" notice. */
const echo = (id: string) => (id.length > 40 ? id.slice(0, 40) + '…' : id);

export function MissingNotice({ missing }: { missing: Missing }) {
  return (
    <div className="callout callout-warn lessons-notice" role="alert">
      <Icon icon={TriangleAlert} size={16} />
      <div>
        {missing.kind === 'lesson' ? 'Không tìm thấy bài học' : 'Không tìm thấy khóa học'} “{echo(missing.id)}”. Hãy chọn
        trong danh sách dưới đây.
      </div>
    </div>
  );
}

function recentLessonId(): string | null {
  try {
    return lastLessonAttemptId(loadStats().attempts);
  } catch {
    return null;
  }
}

/**
 * "Bài học" home: one row per course (courses without lessons are hidden). The course the learner is in (latest
 * lesson activity, else the first unfinished course) carries the page's one primary action, "Học tiếp", which opens
 * its next lesson; the row itself opens the course page.
 */
export default function CourseList({ missing }: { missing?: Missing }) {
  const [progress] = useState(() => loadLessonProgress());
  const [recent] = useState(recentLessonId);
  const courses = availableCourses();
  const active = activeCourse(LESSONS, progress, { recentLessonId: recent, courseOrder: courses.map((c) => c.id) });
  const startedAny = LESSONS.some((l) => progress[l.id]);

  return (
    <div className="stack-lg page-focus lessons-page">
      <PageHeader title="Bài học" subtitle="Các khóa ngắn: hiểu một điều, nghe ví dụ, làm quiz." />

      {missing && <MissingNotice missing={missing} />}

      <section className="lessons-all" aria-labelledby="lessons-courses-h">
        <h2 id="lessons-courses-h" className="section-title">
          Các khóa học
        </h2>
        <ul className="list-rows lessons-courses">
          {courses.map((c) => {
            const lessons = lessonsOf(c.id);
            const { completed, total, ratio } = courseProgress(lessons, progress);
            const started = lessons.some((l) => progress[l.id]);
            const isActive = c.id === active;
            const next = isActive ? recommendNext(lessons, progress) : null;
            const minutes = lessons.reduce((n, l) => n + (l.minutes > 0 ? l.minutes : 0), 0);
            const meta = started
              ? `${completed}/${total} bài`
              : [`${total} bài`, minutes > 0 ? `khoảng ${minutes} phút` : null].filter(Boolean).join(' · ');
            return (
              <li key={c.id}>
                <div className={'list-row lessons-course' + (isActive ? ' is-next' : '')}>
                  <span className={'list-row-lead' + (isActive ? ' lessons-num is-next' : '')} aria-hidden="true">
                    <Icon icon={COURSE_ICON[c.id]} size={18} />
                  </span>
                  <span className="list-row-body">
                    <span className="list-row-title">
                      <a
                        className="list-row-text lessons-course-link"
                        href={hrefFor('lessons', { course: c.id })}
                        aria-describedby={`lessons-course-meta-${c.id}`}
                      >
                        {c.title}
                      </a>
                    </span>
                    <span className="lessons-row-summary">{c.summary}</span>
                    <span className="list-row-meta lessons-course-meta" id={`lessons-course-meta-${c.id}`}>
                      {meta}
                    </span>
                    {started && (
                      <span
                        className={'progress lessons-course-bar' + (completed === total ? ' is-done' : '')}
                        aria-hidden="true"
                      >
                        <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="list-row-end">
                    {next ? (
                      <a
                        className="btn btn-primary btn-sm lessons-course-cta"
                        href={hrefFor('lessons', { id: next.id })}
                        aria-label={`${startedAny ? 'Học tiếp' : 'Bắt đầu'}: Bài ${next.order}, ${next.title}`}
                      >
                        {startedAny ? 'Học tiếp' : 'Bắt đầu'}
                      </a>
                    ) : (
                      <Icon icon={ChevronRight} size={18} />
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
