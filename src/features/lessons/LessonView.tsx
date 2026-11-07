import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, RotateCcw } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import { isLessonCompleted, loadLessonProgress, recordLessonResult } from '../../core/lessons';
import { hrefFor } from '../../core/nav';
import { recordReview } from '../../core/review';
import { recordAttempt } from '../../core/stats';
import { stopSpeaking } from '../../core/tts';
import { courseTitle } from '../../data/courses';
import { lessonsOf, nextCourseAfter, type Lesson } from '../../data/lessons';
import { SectionBody } from './Blocks';
import Quiz from './Quiz';
import QuizResult from './QuizResult';
import { itemPhenomena, lessonStatus, nextLessonAfter, scoreOf, type QuizOutcome } from './logic';
import { lessonReviewCall, lessonReviewNote } from './reviewHook';
import { useKeyboard } from './useKeyboard';
import { NoBreakRespell } from './LessonBits';

const TITLE_ID = 'lessons-view-title';

const SHORTCUTS = [
  { keys: ['←', '→'], text: 'Phần trước / phần sau' },
  { keys: ['Enter'], text: 'Phần tiếp, câu tiếp' },
  { keys: ['1–4'], text: 'Chọn đáp án trong quiz' },
  { keys: ['R'], text: 'Nghe lại câu hỏi' },
];

type Phase =
  | { kind: 'learn'; step: number }
  | { kind: 'quiz'; run: number }
  | {
      kind: 'result';
      run: number;
      outcomes: QuizOutcome[];
      score: number;
      best: number | null;
      firstPass: boolean;
      reviewNote?: string;
    };

/** A single lesson: step-through sections, then quiz, then results. */
export default function LessonView({ lesson }: { lesson: Lesson }) {
  const sections = lesson.sections;
  const [phase, setPhase] = useState<Phase>({ kind: 'learn', step: 0 });
  const [status, setStatus] = useState(() => lessonStatus(loadLessonProgress(), lesson.id));
  const runRef = useRef(0);
  const recordedRun = useRef(0);
  // "Bài tiếp theo" stays inside the course; at its end the result screen offers the next course.
  const next = nextLessonAfter(lessonsOf(lesson.course), lesson.id);
  const nextCourse = next ? null : nextCourseAfter(lesson.course);

  const sectionTitleRef = useRef<HTMLHeadingElement>(null);
  const learnStep = phase.kind === 'learn' ? phase.step : -1;
  const prevStep = useRef(learnStep);

  // On open: start at the top and put focus on the lesson title (screen readers announce it).
  // Leaving the lesson (route change, next lesson) stops any audio still playing.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const title = document.getElementById(TITLE_ID);
    if (title) {
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
    }
    return () => stopSpeaking();
  }, []);

  // After switching sections, move focus to the new section heading.
  useEffect(() => {
    if (prevStep.current === learnStep) return; // first render (and StrictMode re-run): keep focus on the title
    prevStep.current = learnStep;
    if (learnStep >= 0) sectionTitleRef.current?.focus({ preventScroll: true });
  }, [learnStep]);

  const goStep = (step: number) => {
    stopSpeaking();
    setPhase({
      kind: 'learn',
      step: Math.max(0, Math.min(sections.length - 1, step)),
    });
    window.scrollTo({ top: 0 });
  };

  const startQuiz = () => {
    stopSpeaking();
    runRef.current += 1;
    setPhase({ kind: 'quiz', run: runRef.current });
    window.scrollTo({ top: 0 });
  };

  const finish = (outcomes: QuizOutcome[]) => {
    if (phase.kind !== 'quiz' || recordedRun.current === phase.run) return;
    recordedRun.current = phase.run;
    const score = scoreOf(outcomes.map((o) => o.correct));
    const wasDone = status.state === 'done';
    const progress = recordLessonResult(lesson.id, score);
    lesson.quiz.forEach((item, i) => {
      const o = outcomes[i];
      if (!o) return;
      const seen = itemPhenomena(item, lesson.phenomenon);
      recordAttempt({
        module: 'lesson',
        itemId: `${lesson.id}:${i}`,
        correct: o.correct,
        seen,
        missed: o.correct ? [] : seen,
      });
    });
    // Ôn tập: a pass enrols the lesson (first interval 1 day); a retake grades the card in practice context
    // (not due: a pass changes nothing, a fail pulls it in to tomorrow). Once per run (recordedRun guard above).
    let reviewNote: string | undefined;
    try {
      const now = Date.now();
      const call = lessonReviewCall(lesson.id, score, outcomes.length, isLessonCompleted(progress, lesson.id));
      if (call) {
        const { id, grade, enrol, firstGrade } = call;
        reviewNote = lessonReviewNote(recordReview(id, grade, { ctx: 'practice', enrol, firstGrade, now }), now);
      }
    } catch {
      // review scheduling is best effort
    }
    const st = lessonStatus(progress, lesson.id);
    setStatus(st);
    setPhase({
      kind: 'result',
      run: phase.run,
      outcomes,
      score,
      best: st.best,
      firstPass: !wasDone && st.state === 'done',
      reviewNote,
    });
    window.scrollTo({ top: 0 });
  };

  useKeyboard((e) => {
    if (phase.kind !== 'learn') return false;
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (phase.step + 1 < sections.length) goStep(phase.step + 1);
      else startQuiz();
      return true;
    }
    if (e.key === 'ArrowLeft') {
      if (phase.step > 0) goStep(phase.step - 1);
      return phase.step > 0;
    }
    return false;
  });

  const activeDot = phase.kind === 'learn' ? phase.step : sections.length;
  const done = status.state === 'done';

  return (
    <article className="stack-lg page-focus lessons-view">
      <PageHeader
        back={{ href: hrefFor('lessons', { course: lesson.course }), label: courseTitle(lesson.course) }}
        title={<NoBreakRespell text={lesson.title} />}
        titleId={TITLE_ID}
        subtitle={`Bài ${lesson.order} · ${lesson.minutes} phút`}
        help={<ShortcutsHelp items={SHORTCUTS} note="Phím chữ và số không dùng được khi đang gõ." />}
      />

      <div className="lessons-dots" role="group" aria-label="Các phần của bài học">
        <ol>
          {sections.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className={'lessons-dot-btn' + (i === activeDot ? ' is-active' : i < activeDot ? ' is-past' : '')}
                onClick={() => goStep(i)}
                aria-label={`Phần ${i + 1}: ${s.title}`}
                aria-current={i === activeDot ? 'step' : undefined}
                title={s.title}
              >
                <span className="lessons-dot-bar" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={'lessons-dot-btn' + (activeDot === sections.length ? ' is-active' : '')}
              onClick={() => (phase.kind === 'learn' ? startQuiz() : undefined)}
              aria-label="Quiz cuối bài"
              aria-current={activeDot === sections.length ? 'step' : undefined}
              title="Quiz"
            >
              <span className="lessons-dot-bar" />
            </button>
          </li>
        </ol>
        <span className="meta lessons-dots-label">
          {/* The quiz is the bar's last segment, so it counts in the total too. During the quiz the card counts
              the questions ("Câu 1/8"), so the bar only names the step: no second, different "x/y". */}
          {phase.kind === 'learn' ? `Phần ${phase.step + 1}/${sections.length + 1}` : phase.kind === 'quiz' ? 'Quiz' : 'Kết quả'}
        </span>
      </div>

      {phase.kind === 'learn' && sections[phase.step] && (
        <section className="card lessons-section" aria-labelledby="lessons-section-title">
          <h2 id="lessons-section-title" ref={sectionTitleRef} tabIndex={-1} className="lessons-section-title">
            <NoBreakRespell text={sections[phase.step].title} />
          </h2>
          <SectionBody key={phase.step} section={sections[phase.step]} connected={lesson.course === 'connected'} />
          <div className="lessons-stepper">
            {phase.step > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => goStep(phase.step - 1)}>
                <Icon icon={ArrowLeft} size={16} />
                <span className="lessons-stepper-text">Quay lại</span>
              </button>
            )}
            {done && phase.step + 1 < sections.length && (
              <button type="button" className="btn btn-ghost lessons-retake" onClick={startQuiz}>
                <Icon icon={RotateCcw} size={16} />
                <span className="lessons-stepper-text">Làm lại quiz</span>
              </button>
            )}
            {phase.step + 1 < sections.length ? (
              <button
                type="button"
                className="btn btn-primary lessons-stepper-next"
                onClick={() => goStep(phase.step + 1)}
                aria-keyshortcuts="ArrowRight"
              >
                Tiếp
                <Icon icon={ArrowRight} size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary lessons-stepper-next"
                onClick={startQuiz}
                aria-keyshortcuts="ArrowRight"
              >
                Làm quiz ({lesson.quiz.length} câu)
                <Icon icon={ArrowRight} size={16} />
              </button>
            )}
          </div>
        </section>
      )}

      {phase.kind === 'learn' && lesson.course === 'connected' && (
        <details className="how lessons-how">
          <summary>
            <Icon icon={CircleHelp} size={18} />
            Hai nút nghe khác nhau thế nào?
          </summary>
          <p>
            <b>Nghe</b> đọc kiểu nói nhanh ngoài đời (nối âm, nuốt âm); <b>Rõ từng từ</b> đọc chuẩn, chậm, để so sánh.
          </p>
          <p>Giọng máy chỉ gần giống người thật: bấm “Nghe người thật nói” để nghe người bản xứ nói cụm đó trong video thật.</p>
        </details>
      )}

      {phase.kind === 'quiz' && <Quiz key={phase.run} lesson={lesson} onFinish={finish} onExit={() => goStep(0)} />}

      {phase.kind === 'result' && (
        <QuizResult
          lesson={lesson}
          outcomes={phase.outcomes}
          score={phase.score}
          best={phase.best}
          firstPass={phase.firstPass}
          next={next}
          nextCourse={nextCourse}
          onRetry={startQuiz}
          onReview={() => goStep(0)}
          reviewNote={phase.reviewNote}
        />
      )}
    </article>
  );
}
