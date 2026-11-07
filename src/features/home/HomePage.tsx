import { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCheck,
  Flame,
  Headphones,
  History,
  Hourglass,
  Layers,
  Mic,
  PencilLine,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { Icon, RouteTile } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import { PhDot } from '../../components/PhTag';
import PlayButton from '../../components/PlayButton';
import { checkupDue, useCheckups } from '../../core/benchmark';
import { checkupPlan, dailyPlan, listeningLine, todayProgress, weakestRate, type CheckupPlanItem, type PlanItem } from '../../core/goals';
import { listeningToday, timerElapsedMs, timerStatus, useListeningEntries, useListeningTimer } from '../../core/listening';
import { loadLessonProgress, sortLessons, type LessonMeta } from '../../core/lessons';
import { hrefFor, navigate, ROUTES, type RouteId } from '../../core/nav';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { useReview } from '../../core/review';
import { useSettings } from '../../core/settings';
import { currentStreak } from '../../core/stats';
import { KEYS, loadJSON, saveJSON } from '../../core/storage';
import type { Sentence } from '../../core/types';
import { COURSES } from '../../data/courses';
import { LESSONS } from '../../data/lessons';
import { SENTENCES } from '../../data/sentences';
import { drillSummary } from '../drill/summary';
import { useLiveStats, useNow } from './hooks';
import { useClock } from '../listening/useClock';
import { formatDateVi, greeting, listenRowText, parseOnboarding, pickOfTheDay, splitPlan, streakLabel } from './homeModel';
import Onboarding from './Onboarding';
import './home.css';

const PLAN_ICON: Record<PlanItem['id'], LucideIcon> = {
  review: History,
  later: Hourglass,
  lesson: BookOpen,
  drill: Layers,
  dictation: PencilLine,
  focus: Target,
  shadowing: Mic,
};

/** Rows shown before "Xem thêm". */
const PLAN_VISIBLE = 3;

/** Phones only: the routes that are not in the bottom tab bar (desktop has the sidebar). */
const MORE_ROUTES: RouteId[] = ['pairs', 'drill', 'shadowing', 'media', 'decoder'];

/** Every lesson of every course: by course, then order within the course. */
function sortedLessons(): LessonMeta[] {
  return sortLessons(Array.isArray(LESSONS) ? LESSONS : []);
}

function safeDrillSummary(now: number, heldBack: boolean) {
  try {
    return drillSummary(now, heldBack);
  } catch {
    return { due: 0, newAvailable: 0, learned: 0, newIntroduced: 0 };
  }
}

/**
 * One muted line under the title. The "Học N cụm từ mới" item needs none (its detail only lists examples), and
 * counts that are still zero ("0/10 bài đã xong", "(0/5)") are dropped: nothing to show before the learner starts.
 */
function planDetail(it: PlanItem): string | null {
  if (it.id === 'drill' && !it.done) return null;
  const text = (it.detail || '')
    .split(' · ')
    .filter((part) => !/^0\/\d+/.test(part))
    .join(' · ')
    .replace(/\s*\(0\/\d+\)/g, '');
  return text || null;
}

// ───────────────────────── Sections ─────────────────────────

function TodayCard({
  items,
  attempts,
  goal,
  softFirst,
  checkup,
  now,
}: {
  items: PlanItem[];
  attempts: number;
  goal: number;
  /** The intro card owns the page's primary action: the first row's button is soft meanwhile. */
  softFirst: boolean;
  /** Optional "Kiểm tra định kỳ" row: after the plan rows, never the primary, not counted in x/y. */
  checkup: CheckupPlanItem | null;
  now: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const { open, done } = splitPlan(items);
  const firstId = open.find((it) => !it.muted)?.id;
  const shown = showAll ? open : open.slice(0, PLAN_VISIBLE);
  // The optional checkup row never pushes a real plan item behind "Xem thêm": while plan rows are hidden it is
  // hidden with them (and counted in "Xem thêm N việc").
  const planHidden = open.length - shown.length;
  const showCheckup = !!checkup && planHidden === 0;
  const hidden = planHidden + (checkup && !showCheckup ? 1 : 0);
  const pct = goal > 0 ? Math.min(100, Math.round((attempts / goal) * 100)) : 0;
  return (
    <section className="card home-today" aria-labelledby="home-today-h">
      <div className="home-today-head">
        <h2 id="home-today-h">Hôm nay</h2>
        <span className="meta">{attempts > 0 ? `${attempts}/${goal} lượt` : `Mục tiêu ${goal} lượt`}</span>
      </div>
      {attempts > 0 && (
        <div
          className={'progress home-today-bar' + (attempts >= goal ? ' is-done' : '')}
          role="progressbar"
          aria-label="Mục tiêu hôm nay"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(attempts, goal)}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      {open.length > 0 && (
        <ol className="home-plan-list">
          {shown.map((it) => {
            const isFirst = it.id === firstId;
            const detail = planDetail(it);
            return (
              <li key={it.id}>
                <a
                  className={'home-plan-item' + (isFirst ? ' is-next' : '') + (it.muted ? ' is-muted' : '')}
                  href={hrefFor(it.route, it.params)}
                >
                  <span className="home-plan-lead" aria-hidden="true">
                    <Icon icon={PLAN_ICON[it.id]} size={18} />
                  </span>
                  <span className="home-plan-text">
                    <span className="home-plan-title">{it.title}</span>
                    {detail && <span className="home-plan-detail">{detail}</span>}
                  </span>
                  {isFirst ? (
                    <span className={'btn btn-sm home-plan-cta ' + (softFirst ? 'btn-soft' : 'btn-primary')} aria-hidden="true">
                      Bắt đầu
                    </span>
                  ) : (
                    <Icon icon={ChevronRight} size={18} className="home-plan-go" />
                  )}
                </a>
              </li>
            );
          })}
        </ol>
      )}
      {(hidden > 0 || done.length > 0) && (
        <div className="home-today-foot">
          {done.length > 0 && (
            <span className="meta home-plan-done">
              <Icon icon={Check} size={16} />
              {open.length === 0 ? 'Đã xong mọi việc hôm nay' : `${done.length} việc đã xong`}
            </span>
          )}
          {hidden > 0 && (
            <button type="button" className="btn btn-ghost btn-sm home-plan-more" onClick={() => setShowAll(true)}>
              Xem thêm {hidden} việc
            </button>
          )}
        </div>
      )}
      <div className="home-extras">
        {checkup && showCheckup && (
          <a className="home-plan-item home-checkup" href={hrefFor(checkup.route, checkup.params)}>
            <span className="home-plan-lead" aria-hidden="true">
              <Icon icon={ClipboardCheck} size={18} />
            </span>
            <span className="home-plan-text">
              <span className="home-plan-title">{checkup.title}</span>
              {checkup.detail && <span className="home-plan-detail">{checkup.detail}</span>}
            </span>
            <Icon icon={ChevronRight} size={18} className="home-plan-go" />
          </a>
        )}
        <ListenRow now={now} />
      </div>
    </section>
  );
}

/**
 * "Nghe tiếng Anh": one compact row at the bottom of the plan card (real-listening minutes vs the listenGoal
 * setting, the stopwatch when one runs). A whole-row link with a chevron like the plan rows: never a button,
 * never the page's primary. The shell pill is hidden on Hôm nay, so this is the only clock here.
 */
function ListenRow({ now }: { now: number }) {
  const entries = useListeningEntries();
  const timer = useListeningTimer();
  const { listenGoal } = useSettings();
  const status = timer ? timerStatus(timer) : null;
  const tick = useClock(status === 'running');
  const today = listeningToday(entries, now, listenGoal);
  const line = listeningLine({
    minutes: today.minutes,
    goal: listenGoal,
    timer: timer && status ? { status, elapsedMs: timerElapsedMs(timer, Math.max(tick, now)) } : null,
  });
  if (!line.show) return null;
  const text = listenRowText(line);
  return (
    <a className="home-plan-item home-listen" href={hrefFor(line.route)} aria-label={`${text.title}. ${text.detail ?? ''} ${text.action}`.replace(/\s+/g, ' ').trim()}>
      <span className="home-plan-lead" aria-hidden="true">
        <Icon icon={line.done ? Check : Headphones} size={18} />
      </span>
      <span className="home-plan-text">
        <span className="home-plan-title">{text.title}</span>
        {text.detail && <span className="home-plan-detail tabular">{text.detail}</span>}
      </span>
      <Icon icon={ChevronRight} size={18} className="home-plan-go" />
    </a>
  );
}

function WeakestCard({ stats }: { stats: ReturnType<typeof useLiveStats> }) {
  const weak = weakestRate(stats, 3);
  if (!weak) return null;
  const info = PHENOMENON_INFO[weak.phenomenon];
  return (
    <section className="card home-weak" aria-labelledby="home-weak-h">
      <h2 id="home-weak-h" className="home-weak-title">
        <PhDot p={weak.phenomenon} />
        Điểm yếu nhất: {info.label}
      </h2>
      <p className="meta home-weak-line">
        Nghe sót {weak.missed}/{weak.seen} lần gặp
      </p>
      <p className="home-weak-example">
        <span lang="en">{info.example.written}</span>
        <span className="respell-sep" aria-hidden="true">
          →
        </span>
        <span className="sr-only"> nghe như </span>
        <span className="respell" lang="en">
          {info.example.spoken}
        </span>
      </p>
      <div className="home-card-foot">
        <a className="btn btn-soft btn-sm" href={hrefFor('pairs', { focus: weak.phenomenon })}>
          Luyện ngay
        </a>
      </div>
    </section>
  );
}

function SentenceOfDay({ sentence }: { sentence: Sentence }) {
  return (
    <section className="card home-sod" aria-labelledby="home-sod-h">
      <h2 id="home-sod-h" className="home-sod-h">
        Câu của ngày
      </h2>
      <p className="home-sod-text" lang="en">
        {sentence.text}
      </p>
      {sentence.vi && <p className="home-sod-vi">{sentence.vi}</p>}
      <div className="home-card-foot">
        <PlayButton text={sentence.text} label="Nghe" variant="soft" size="sm" />
        <a className="btn btn-ghost btn-sm home-sod-link" href={hrefFor('decoder', { text: sentence.text })}>
          Luyện câu này
          <Icon icon={ChevronRight} size={16} />
        </a>
      </div>
    </section>
  );
}

/** Phones: a compact list of the routes the bottom tab bar does not carry. Hidden at ≥ 900px (sidebar). */
function MoreRoutes() {
  return (
    <section aria-labelledby="home-more-h" className="home-more">
      <h2 id="home-more-h" className="section-title">
        Luyện thêm
      </h2>
      <ul className="list-rows">
        {MORE_ROUTES.map((id) => {
          const r = ROUTES.find((x) => x.id === id);
          if (!r) return null;
          return (
            <li key={id}>
              <a className="list-row home-more-row" href={hrefFor(id)}>
                <RouteTile id={id} size="sm" />
                <span className="list-row-body">
                  <span className="list-row-title">
                    <span className="list-row-text">{r.label}</span>
                  </span>
                </span>
                <span className="list-row-end">
                  <Icon icon={ChevronRight} size={18} />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function HomePage() {
  const stats = useLiveStats();
  const now = useNow();
  const { dailyGoal } = useSettings();
  const { summary: review } = useReview();
  const checkups = useCheckups();
  const [onboarded, setOnboarded] = useState(() => parseOnboarding(loadJSON<unknown>(KEYS.onboarding, null)).done);

  const lessons = useMemo(() => sortedLessons(), []);
  const sentence = useMemo(() => pickOfTheDay(Array.isArray(SENTENCES) ? SENTENCES : [], now), [now]);
  // Cheap reads from storage; recomputed whenever stats or the clock change.
  const drill = safeDrillSummary(now, review.heldBack > 0);
  const lessonProgress = loadLessonProgress();

  const progress = todayProgress(stats, now, dailyGoal);
  const streak = currentStreak(Array.isArray(stats.activeDays) ? stats.activeDays : [], now);
  const plan = dailyPlan({
    now,
    stats,
    drill,
    lessons,
    lessonProgress,
    courses: COURSES,
    shadowSentenceId: sentence?.id,
    review: {
      dueToday: review.dueToday,
      reviewedToday: review.reviewedToday,
      minutesToday: review.minutesToday,
      heldBack: review.heldBack,
      deferred: review.deferred,
    },
  });

  const finishOnboarding = () => {
    saveJSON(KEYS.onboarding, { done: true, at: Date.now() });
    setOnboarded(true);
  };

  const hour = new Date(now).getHours();

  return (
    <div className="stack-lg page-browse home">
      <PageHeader
        title={`${greeting(hour)}!`}
        subtitle={formatDateVi(now)}
        actions={
          streak > 0 ? (
            <span className="home-streak">
              <Icon icon={Flame} size={16} />
              {streakLabel(streak)}
            </span>
          ) : undefined
        }
      />

      {!onboarded && (
        <Onboarding
          hasLessons={lessons.length > 0}
          onSkip={finishOnboarding}
          onStart={() => {
            finishOnboarding();
            navigate('lessons', { id: lessons[0]?.id });
          }}
        />
      )}

      <TodayCard
        items={plan}
        attempts={progress.attempts}
        goal={progress.goal}
        softFirst={!onboarded}
        checkup={checkupPlan(checkupDue(checkups, now, onboarded))}
        now={now}
      />

      <div className="home-mid">
        {sentence && <SentenceOfDay sentence={sentence} />}
        <WeakestCard stats={stats} />
      </div>

      <MoreRoutes />
    </div>
  );
}
