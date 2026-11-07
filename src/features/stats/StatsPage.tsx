import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Activity, Check, ChevronRight, Info, RotateCcw, TrendingUp, X } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import { PhDot } from '../../components/PhTag';
import Segmented from '../../components/Segmented';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { currentStreak, loadStats, subscribeStats, type StatsState } from '../../core/stats';
import { hrefFor, navigate, useRoute, type RouteId } from '../../core/nav';
import { REPORT_PERIODS, type ReportPeriod } from '../../core/progressReport';
import { useCheckups } from '../../core/benchmark';
import { useListeningEntries } from '../../core/listening';
import { forecast, isNewWord, unsuspendAll, useReview, WORD_NEW_PER_DAY, type ReviewEntry, type ReviewSnapshot } from '../../core/review';
import { useSettings } from '../../core/settings';
import { attemptSource, attemptText } from './attemptText';
import {
  accuracyLast7Days,
  forecastBars,
  moduleLabel,
  recentAttempts,
  relativeTimeVi,
  validAttempts,
  weaknessReport,
  withTodayCount,
  type MissRate,
} from './statsModel';
import {
  activityHeatmap,
  attemptsTodayCount,
  heatCellText,
  historyInfo,
  longestStreak,
  mergeActiveDays,
  moduleBreakdown,
  moveHeatFocus,
  sanitizeGoal,
  trendDelta,
  trendPoints,
  trendX,
  trendY,
  weakestPhenomenon,
  weeklyAccuracy,
  WEEKDAY_SHORT,
  type Heatmap,
  type HistoryInfo,
  type ModuleRow,
  type Tally,
  type TrendBox,
  type WeekBucket,
} from './progressModel';
import ReportView from './ReportView';
import './stats.css';

type Params = Record<string, string | number | undefined>;
type Go = (id: RouteId, params?: Params) => void;

export interface StatsPageProps {
  /** Optional, kept for compatibility. Navigation uses navigate() from core/nav otherwise. */
  onNavigate?: (id: RouteId) => void;
}

const SUBTITLE = 'Bạn đã luyện bao nhiêu và còn yếu ở đâu.';
/** Weak-spot bars shown before "Xem cả N". */
const BARS_VISIBLE = 5;

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

// Stats snapshot shared by every mounted StatsPage. Invalidated when the last
// subscriber leaves, so a remount always reads fresh storage.
let statsCache: StatsState | null = null;
let statsSubscribers = 0;

function getStatsSnapshot(): StatsState {
  if (!statsCache) statsCache = loadStats();
  return statsCache;
}

function subscribeStatsStore(onChange: () => void): () => void {
  statsSubscribers += 1;
  const unsubscribe = subscribeStats((s) => {
    statsCache = s;
    onChange();
  });
  // Another tab recorded progress or reset it: reload from storage.
  const onStorage = () => {
    statsCache = null;
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener('storage', onStorage);
    statsSubscribers -= 1;
    if (statsSubscribers === 0) statsCache = null;
  };
}

function useStats(): StatsState {
  return useSyncExternalStore(subscribeStatsStore, getStatsSnapshot, getStatsSnapshot);
}

/** Re-render every minute so "5 phút trước" and "today" stay fresh. */
function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    // Timers are throttled in background tabs: refresh as soon as the page is visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type StatsView = 'overview' | 'report';

const VIEW_OPTIONS = [
  { value: 'overview' as const, label: 'Tổng quan' },
  { value: 'report' as const, label: 'Báo cáo' },
];
const PERIOD_OPTIONS = REPORT_PERIODS.map((p) => ({ value: p.id, label: p.label }));

/** Period of the report, kept while the page stays open in this tab (not a URL param, not stored). */
let lastPeriod: ReportPeriod = '4w';

export default function StatsPage({ onNavigate }: StatsPageProps = {}) {
  const route = useRoute();
  const view: StatsView = route.params.view === 'report' ? 'report' : 'overview';
  const [period, setPeriodState] = useState<ReportPeriod>(lastPeriod);
  const setPeriod = (p: ReportPeriod) => {
    lastPeriod = p;
    setPeriodState(p);
  };
  const stats = useStats();
  const now = useNow();
  const review = useReview();

  const go: Go = (id, params) => {
    if (onNavigate && (!params || Object.keys(params).length === 0)) onNavigate(id);
    else navigate(id, params);
  };

  return (
    <div className="stack-lg page-browse stats-page">
      <PageHeader title="Tiến độ" subtitle={SUBTITLE} />
      <div className="toolbar stats-toolbar">
        <Segmented
          ariaLabel="Chế độ xem"
          value={view}
          options={VIEW_OPTIONS}
          onChange={(v) => navigate('stats', v === 'report' ? { view: 'report' } : undefined)}
        />
        {view === 'report' && (
          <div className="toolbar-end">
            <Segmented ariaLabel="Khoảng thời gian" value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />
          </div>
        )}
      </div>
      {view === 'report' ? (
        <ReportView period={period} stats={stats} reviewStore={review.store} now={now} />
      ) : (
        <Overview stats={stats} now={now} review={review} go={go} />
      )}
    </div>
  );
}

/** The default "Tổng quan" view (unchanged content). */
function Overview({ stats, now, review, go }: { stats: StatsState; now: number; review: ReviewSnapshot; go: Go }) {
  const settings = useSettings();
  const attempts = useMemo(() => validAttempts(stats.attempts), [stats.attempts]);
  // Listening hours and checkups live in "Báo cáo": point there instead of looking like nothing was recorded.
  const listenLog = useListeningEntries();
  const checkups = useCheckups();
  const hasReportData = listenLog.length > 0 || checkups.length > 0;

  if (attempts.length === 0) {
    return (
      <>
        <section className="card" aria-labelledby="stats-empty-h">
          <div className="empty-state stats-empty">
            <IconTile icon={TrendingUp} tint="var(--text-muted)" size="lg" />
            <h2 id="stats-empty-h">Chưa có lượt luyện nào</h2>
            <p>Luyện vài câu, chuỗi ngày, độ chính xác và điểm yếu của bạn sẽ hiện ở đây.</p>
            {hasReportData && (
              <p className="meta">
                Giờ nghe và bài kiểm tra định kỳ đã có trong{' '}
                <a href={hrefFor('stats', { view: 'report' })}>
                  Báo cáo
                </a>
                .
              </p>
            )}
            <div className="row">
              <NavLink to="dictation" params={{ level: 1 }} go={go} className="btn btn-primary">
                Luyện câu đầu tiên
              </NavLink>
            </div>
          </div>
        </section>
        {review.summary.dueToday > 0 && <ReviewRow snapshot={review} go={go} />}
      </>
    );
  }

  // Stored active days may be junk or lag behind attempts: merge both sources.
  const activeDays = mergeActiveDays(stats.activeDays, attempts);
  const history = historyInfo(attempts, activeDays);
  const streak = currentStreak(activeDays, now);
  const best = Math.max(streak, longestStreak(activeDays));
  const acc = accuracyLast7Days(attempts, now);
  const today = attemptsTodayCount(attempts, now);
  const goal = sanitizeGoal(settings.dailyGoal);
  const weak = weaknessReport(stats.byPhenomenon);
  const weakest = weakestPhenomenon(weak);
  const modules = moduleBreakdown(attempts, now);
  const weeks = weeklyAccuracy(attempts, now, 8, history.trimmed ? history.oldestAt : null);
  const heat = activityHeatmap(attempts, now, 12, activeDays);
  const recent = recentAttempts(attempts, 10);

  return (
    <>
      <section className="stats-kpis" aria-label="Tổng quan">
        <Kpi
          label="Chuỗi ngày"
          value={String(streak)}
          unit="ngày"
          hint={streak === 0 ? 'Luyện hôm nay để bắt đầu' : best > streak ? `Kỷ lục ${best} ngày` : 'Kỷ lục của bạn'}
        />
        <Kpi label="Hôm nay" value={String(today)} unit={`/${goal} lượt`}>
          <ProgressBar value={today} max={goal} label={`Mục tiêu hôm nay: ${today}/${goal} lượt`} done={today >= goal} />
        </Kpi>
        <Kpi
          label="Chính xác 7 ngày"
          value={acc.pct == null ? '—' : `${acc.pct}%`}
          hint={acc.total > 0 ? `trên ${acc.total} lượt` : 'Chưa luyện 7 ngày qua'}
        />
      </section>

      {review.summary.tracked > 0 && <ReviewRow snapshot={review} go={go} />}

      <div className="stats-pair">
        <WeaknessCard ranked={weak.ranked} weakest={weakest} go={go} />
        <HeatmapCard heat={heat} />
      </div>

      <details className="how stats-history">
        <summary>
          <Icon icon={Activity} size={18} />
          Lịch sử chi tiết
        </summary>
        <div className="stats-history-body">
          <TrendBlock weeks={weeks} />
          <ModulesBlock rows={modules} now={now} go={go} history={history} />
          {review.summary.tracked > 0 && <ForecastBlock snapshot={review} />}
          <RecentBlock recent={recent} now={now} />
          <TrimmedNote history={history} />
        </div>
      </details>
    </>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Shown when storage only keeps the most recent attempts. */
function TrimmedNote({ history }: { history: HistoryInfo }) {
  if (!history.trimmed || history.oldestAt == null) return null;
  return (
    <p className="stats-note stats-trimmed">
      <Icon icon={Info} size={16} />
      <span>Chỉ lưu chi tiết các lượt từ {formatDate(history.oldestAt)}; số liệu trước đó không còn.</span>
    </p>
  );
}

/** Real link (works with middle-click / open in new tab) that navigates in-app on a plain click. */
function NavLink({
  to,
  params,
  go,
  className,
  children,
  ariaLabel,
}: {
  to: RouteId;
  params?: Params;
  go: Go;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(to, params);
  };
  return (
    <a href={hrefFor(to, params)} className={className} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </a>
  );
}

function Kpi({
  value,
  unit,
  label,
  hint,
  children,
}: {
  value: string;
  unit?: string;
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card stats-kpi">
      <span className="stats-kpi-label">{label}</span>
      <span className="stats-kpi-value">
        {value}
        {unit && <span className="stats-kpi-unit"> {unit}</span>}
      </span>
      {children}
      {hint && <span className="stats-kpi-hint">{hint}</span>}
    </div>
  );
}

function ProgressBar({ value, max, label, done }: { value: number; max: number; label: string; done: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={'progress stats-progress' + (done ? ' is-done' : '')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-label={label}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Ôn tập in one row. The count is summary.dueToday: the same field as the nav badge, the Ôn tập session and the
 * Home plan item (one source in core/review).
 */
function ReviewRow({ snapshot, go }: { snapshot: ReviewSnapshot; go: Go }) {
  const { dueToday, minutesToday, reviewedToday } = snapshot.summary;
  const line =
    dueToday > 0
      ? `${dueToday} mục đến hạn · ~${minutesToday} phút`
      : reviewedToday > 0
        ? `Đã ôn ${reviewedToday} mục hôm nay, hết mục đến hạn`
        : 'Hôm nay không có mục đến hạn';
  return (
    <section className="card stats-review" aria-labelledby="stats-review-h">
      <div className="stats-review-text">
        <h2 id="stats-review-h" className="stats-h2">
          Ôn tập
        </h2>
        <p className="meta stats-review-line">{line}</p>
      </div>
      <NavLink to="review" go={go} className={'btn btn-sm ' + (dueToday > 0 ? 'btn-soft' : 'btn-ghost')}>
        {dueToday > 0 ? 'Ôn ngay' : 'Mở Ôn tập'}
        <Icon icon={ChevronRight} size={16} />
      </NavLink>
    </section>
  );
}

function WeaknessCard({ ranked, weakest, go }: { ranked: MissRate[]; weakest: MissRate | null; go: Go }) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const info = weakest ? PHENOMENON_INFO[weakest.phenomenon] : null;
  const shown = showAll ? ranked : ranked.slice(0, BARS_VISIBLE);
  return (
    <section className="card stats-section" aria-labelledby="stats-weak-h">
      <div className="stats-section-head">
        <h2 id="stats-weak-h" className="stats-h2">
          Bạn yếu ở đâu
        </h2>
        {ranked.length > 0 && <span className="meta">Tỉ lệ nghe sót</span>}
      </div>

      {weakest && info && (
        <div className="panel stats-reco">
          <div className="stats-reco-top">
            <h3 className="stats-reco-title">
              <PhDot p={weakest.phenomenon} />
              {info.label}
            </h3>
            {/* no % here: the first bar right below states it */}
          </div>
          <p className="stats-reco-example">
            <span lang="en">{info.example.written}</span>
            <span className="respell-sep" aria-hidden="true">
              →
            </span>
            <span className="sr-only"> nghe như </span>
            <span className="respell" lang="en">
              {info.example.spoken}
            </span>
          </p>
          <div>
            <NavLink
              to="pairs"
              params={{ focus: weakest.phenomenon }}
              go={go}
              className="btn btn-soft btn-sm"
              ariaLabel={`Luyện ngay: ${info.label}`}
            >
              Luyện ngay
            </NavLink>
          </div>
        </div>
      )}

      {ranked.length === 0 ? (
        <p className="stats-note">Chưa đủ dữ liệu để xếp hạng. Chép chính tả hoặc phân biệt âm thêm vài lượt nhé.</p>
      ) : (
        <>
          <ul className="stats-bars" id={listId}>
            {shown.map((r) => {
              const pi = PHENOMENON_INFO[r.phenomenon];
              const pct = Math.round(r.rate * 100);
              return (
                <li key={r.phenomenon} className="stats-bar-row">
                  <div className="stats-bar-head">
                    <span className="stats-bar-label">
                      <PhDot p={r.phenomenon} />
                      {pi.label}
                    </span>
                    <span className="stats-bar-num">
                      <strong>{pct}%</strong> <span className="stats-bar-sub">· {r.missed}/{r.seen}</span>
                    </span>
                  </div>
                  <div
                    className="stats-bar-track"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-valuetext={`${pct}%`}
                    aria-label={`${pi.label}: nghe sót ${r.missed} trên ${r.seen} lần, ${pct}%`}
                  >
                    <div className="stats-bar-fill" style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {ranked.length > BARS_VISIBLE && (
            <button
              type="button"
              className="btn btn-ghost btn-sm stats-bars-more"
              aria-expanded={showAll}
              aria-controls={listId}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Thu gọn' : `Xem cả ${ranked.length}`}
            </button>
          )}
          {!weakest && (
            <p className="stats-note stats-good">
              <Icon icon={Check} size={16} />
              Bạn chưa nghe sót hiện tượng nào trong số đã đủ dữ liệu.
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ───────── Lịch sử chi tiết ─────────

function ModulesBlock({ rows, now, go, history }: { rows: ModuleRow[]; now: number; go: Go; history: HistoryInfo }) {
  const practised = rows.filter((r) => r.all.total > 0);
  if (practised.length === 0) return null;
  return (
    <section className="stats-block" aria-labelledby="stats-mod-h">
      <h3 id="stats-mod-h" className="stats-h3">
        Theo từng phần luyện
      </h3>
      <table className="stats-mod-table">
        <caption className="sr-only">Số lượt và độ chính xác theo từng phần luyện, 7 ngày qua và từ trước tới nay</caption>
        <thead>
          <tr>
            <th scope="col">Phần luyện</th>
            <th scope="col">7 ngày</th>
            <th scope="col">{history.trimmed ? 'Đã lưu' : 'Tất cả'}</th>
          </tr>
        </thead>
        <tbody>
          {practised.map((r) => (
            <tr key={r.module}>
              <th scope="row">
                <span className="stats-mod-text">
                  <NavLink to={r.route} go={go} className="stats-mod-link" ariaLabel={`Mở ${r.label}`}>
                    {r.label}
                  </NavLink>
                  {r.lastAt != null && <span className="stats-mod-last">{relativeTimeVi(r.lastAt, now)}</span>}
                </span>
              </th>
              <td>
                <TallyCell t={r.week} />
              </td>
              <td>
                <TallyCell t={r.all} bar />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TallyCell({ t, bar }: { t: Tally; bar?: boolean }) {
  if (t.total === 0) return <span className="stats-dash">—</span>;
  return (
    <div className="stats-tally">
      <span className="stats-tally-line">
        <span>
          <strong>{t.total}</strong> lượt
        </span>
        <span className="stats-tally-pct">{t.pct}% đúng</span>
      </span>
      {bar && (
        <span className="stats-tally-bar" aria-hidden="true">
          <span className="stats-tally-fill" style={{ width: `${t.pct ?? 0}%` }} />
        </span>
      )}
    </div>
  );
}

/** Wide box so the SVG renders close to 1:1 and its 13px labels stay 13px on screen. */
const TREND_BOX: TrendBox = { width: 560, height: 220, left: 48, right: 24, top: 28, bottom: 32 };

function TrendBlock({ weeks }: { weeks: WeekBucket[] }) {
  const points = trendPoints(weeks, TREND_BOX);
  const delta = trendDelta(weeks);
  const box = TREND_BOX;
  const gradId = useId().replace(/:/g, '') + '-area';
  const base = trendY(0, box);
  const area =
    points.length > 1
      ? `M${points[0].x},${base} ` + points.map((p) => `L${p.x},${p.y}`).join(' ') + ` L${points[points.length - 1].x},${base} Z`
      : null;
  return (
    <section className="stats-block" aria-labelledby="stats-trend-h">
      <div className="stats-section-head">
        <h3 id="stats-trend-h" className="stats-h3">
          Độ chính xác theo tuần
        </h3>
        {delta != null && (
          <span className="meta">
            {delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '±0'} điểm so với tuần trước
          </span>
        )}
      </div>
      {points.length === 0 ? (
        <p className="stats-note">Chưa có lượt luyện nào trong 8 tuần qua.</p>
      ) : (
        <svg className="stats-trend" viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-labelledby={`${gradId}-t`}>
          <title id={`${gradId}-t`}>
            {`Độ chính xác 8 tuần gần nhất: ${points.map((p) => `tuần ${weeks[p.index].label} ${p.pct}%`).join(', ')}`}
          </title>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="stats-trend-stop1" />
              <stop offset="100%" className="stats-trend-stop2" />
            </linearGradient>
          </defs>
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line className="stats-trend-grid" x1={box.left} x2={box.width - box.right} y1={trendY(v, box)} y2={trendY(v, box)} />
              <text className="stats-trend-axis" x={box.left - 8} y={trendY(v, box) + 4.5} textAnchor="end">
                {v}%
              </text>
            </g>
          ))}
          {weeks.map((w, i) => (
            <text
              key={w.key}
              className={
                'stats-trend-axis' + (w.isCurrent ? ' is-current' : '') + ((weeks.length - 1 - i) % 2 === 1 ? ' is-alt' : '')
              }
              x={trendX(i, weeks.length, box)}
              y={box.height - 8}
              textAnchor="middle"
            >
              {w.isCurrent ? 'Nay' : w.label}
            </text>
          ))}
          {area && <path d={area} fill={`url(#${gradId})`} />}
          {points.slice(1).map((p, i) => {
            const prev = points[i];
            return (
              <line
                key={p.index}
                className={'stats-trend-line' + (p.index - prev.index > 1 ? ' is-gap' : '')}
                x1={prev.x}
                y1={prev.y}
                x2={p.x}
                y2={p.y}
              />
            );
          })}
          {points.map((p) => (
            <g key={p.index}>
              <circle className={'stats-trend-dot' + (weeks[p.index].isCurrent ? ' is-current' : '')} cx={p.x} cy={p.y} r={4.5} />
              <text className="stats-trend-value" x={p.x} y={p.y - 11} textAnchor="middle">
                {p.pct}
              </text>
            </g>
          ))}
        </svg>
      )}
    </section>
  );
}

/** Word cards in Ôn tập: all of them, and those never answered yet (they start a few a day). */
function wordCounts(entries: readonly ReviewEntry[]): { total: number; waiting: number } {
  let total = 0;
  let waiting = 0;
  for (const e of entries) {
    if (e.kind !== 'word') continue;
    total++;
    if (isNewWord(e)) waiting++;
  }
  return { total, waiting };
}

/** Ôn tập: the next 7 days (today = the nav badge's number), plus restoring items the learner turned off. */
function ForecastBlock({ snapshot }: { snapshot: ReviewSnapshot }) {
  const { summary, entries, now } = snapshot;
  const { dueToday, dueTodaySec } = summary;
  const bars = useMemo(
    () => forecastBars(withTodayCount(forecast(entries, now, 7, snapshot.store), { count: dueToday, seconds: dueTodaySec })),
    [entries, now, snapshot.store, dueToday, dueTodaySec],
  );
  const words = useMemo(() => wordCounts(entries), [entries]);
  const [restored, setRestored] = useState<number | null>(null);
  const { heldBack, suspended } = summary;
  return (
    <section className="stats-block" aria-labelledby="stats-fc-h">
      <h3 id="stats-fc-h" className="stats-h3">
        Ôn tập 7 ngày tới
      </h3>
      <ol className="stats-fc" aria-labelledby="stats-fc-h">
        {bars.map((b) => (
          <li key={b.key} className={'stats-fc-day' + (b.isToday ? ' is-today' : '') + (b.count === 0 ? ' is-zero' : '')}>
            <span className="stats-fc-count" aria-hidden="true">
              {b.count}
            </span>
            <span className="stats-fc-track" aria-hidden="true">
              <span className="stats-fc-bar" style={{ height: `${b.pct}%` }} />
            </span>
            <span className="stats-fc-label" aria-hidden="true">
              {b.label}
            </span>
            <span className="sr-only">
              {b.longLabel}: {b.count} mục{b.minutes > 0 ? `, khoảng ${b.minutes} phút` : ''}
            </span>
          </li>
        ))}
      </ol>
      {words.total > 0 && (
        <p className="stats-note">
          {words.waiting > 0
            ? `Từ đã học: ${words.total - words.waiting} từ đang ôn · ${words.waiting} từ mới chờ vào lịch, tối đa ${WORD_NEW_PER_DAY} từ mỗi ngày.`
            : `Từ đã học: ${words.total} từ đang ôn.`}
        </p>
      )}
      {heldBack > 0 && (
        <p className="stats-note">
          {summary.backlogClears
            ? `Còn ${heldBack} mục đến hạn sẽ được chia sang các ngày tới cho nhẹ.`
            : `Bạn đang có ${heldBack} mục tồn. Ôn thêm một chút mỗi ngày sẽ đỡ hơn.`}
        </p>
      )}
      <span className="stats-review-suspended" role="status">
        {suspended > 0 ? (
          <>
            <span>Đã tắt ôn {suspended} mục</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRestored(unsuspendAll())}>
              <Icon icon={RotateCcw} size={15} />
              Bật lại
            </button>
          </>
        ) : restored ? (
          <span>Đã bật lại {restored} mục.</span>
        ) : null}
      </span>
    </section>
  );
}

function RecentBlock({ recent, now }: { recent: ReturnType<typeof recentAttempts>; now: number }) {
  return (
    <section className="stats-block" aria-labelledby="stats-recent-h">
      <h3 id="stats-recent-h" className="stats-h3">
        Lượt luyện gần đây
      </h3>
      <ul className="stats-recent">
        {recent.map((a, i) => {
          const t = attemptText(a);
          return (
            <li key={`${a.at}-${i}`} className="stats-recent-item">
              <span
                className={'stats-mark ' + (a.correct ? 'is-ok' : 'is-bad')}
                role="img"
                aria-label={a.correct ? 'Đúng' : 'Sai'}
                title={a.correct ? 'Đúng' : 'Sai'}
              >
                <Icon icon={a.correct ? Check : X} size={14} strokeWidth={2.75} />
              </span>
              <span className="stats-recent-main">
                {t ? (
                  <span className="stats-recent-text" lang={t.en ? 'en' : undefined}>
                    {t.text}
                    {t.spoken && (
                      <>
                        <span className="respell-sep" aria-hidden="true">
                          →
                        </span>
                        <span className="respell">{t.spoken}</span>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="stats-recent-text">{attemptSource(a, moduleLabel(a.module))}</span>
                )}
                <span className="meta stats-recent-meta">
                  {t ? `${attemptSource(a, moduleLabel(a.module))} · ` : ''}
                  {relativeTimeVi(a.at, now)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HeatmapCard({ heat }: { heat: Heatmap }) {
  const cells = heat.columns.flatMap((c) => c.cells);
  const todayIndex = Math.max(
    0,
    cells.findIndex((c) => c.isToday),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // A stale pick (e.g. after midnight moved the window) falls back to today.
  const pickedIndex = picked ? cells.findIndex((c) => c.day === picked && !c.future) : -1;
  const selected = pickedIndex >= 0 ? pickedIndex : todayIndex;
  const sel = cells[selected];

  const focusCell = (i: number) => {
    setPicked(cells[i]?.day ?? null);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-heat-index="${i}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = moveHeatFocus(selected, e.key, cells.length, todayIndex);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (next !== selected) focusCell(next);
    }
  };

  return (
    <section className="card stats-section" aria-labelledby="stats-heat-h">
      <div className="stats-section-head">
        <h2 id="stats-heat-h" className="stats-h2">
          12 tuần gần đây
        </h2>
        <span className="meta">
          {heat.total} lượt · {heat.activeDays} ngày
        </span>
      </div>
      <div className="stats-heat-scroll">
        <div
          ref={gridRef}
          className="stats-heat"
          role="group"
          aria-label="Lịch hoạt động 12 tuần. Dùng phím mũi tên để xem từng ngày."
          onKeyDown={onKeyDown}
        >
          {heat.columns.map((col, ci) =>
            col.monthLabel ? (
              <span
                key={`m-${col.key}`}
                className="stats-heat-month"
                style={{ gridColumn: `${ci + 2} / span ${Math.max(1, Math.min(3, heat.columns.length - ci))}`, gridRow: 1 }}
                aria-hidden="true"
              >
                {col.monthLabel}
              </span>
            ) : null,
          )}
          {WEEKDAY_SHORT.map((d, wd) => (
            <span key={d} className="stats-heat-wd" style={{ gridColumn: 1, gridRow: wd + 2 }} aria-hidden="true">
              {wd % 2 === 0 ? d : ''}
            </span>
          ))}
          {heat.columns.map((col, ci) =>
            col.cells.map((c, wd) => {
              const index = ci * 7 + wd;
              const style = { gridColumn: ci + 2, gridRow: wd + 2 };
              if (c.future) return <span key={c.day} className="stats-heat-cell is-future" style={style} aria-hidden="true" />;
              const text = heatCellText(c);
              return (
                <button
                  key={c.day}
                  type="button"
                  data-heat-index={index}
                  className={
                    `stats-heat-cell is-l${c.level}` +
                    (c.archived ? ' is-archived' : '') +
                    (c.isToday ? ' is-today' : '') +
                    (index === selected ? ' is-selected' : '')
                  }
                  style={style}
                  tabIndex={index === selected ? 0 : -1}
                  aria-label={text}
                  aria-pressed={index === selected}
                  aria-current={c.isToday ? 'date' : undefined}
                  title={text}
                  onClick={() => focusCell(index)}
                />
              );
            }),
          )}
        </div>
      </div>
      <div className="stats-heat-foot">
        <p className="stats-heat-detail" aria-live="polite">
          {sel ? heatCellText(sel) : ''}
        </p>
        <div className="stats-heat-legend" aria-hidden="true">
          <span>Ít</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`stats-heat-cell is-legend is-l${l}`} />
          ))}
          <span>Nhiều</span>
        </div>
      </div>
    </section>
  );
}
