// "Báo cáo" view of Tiến độ (#/stats?view=report). It only renders what core/progressReport buildReport()
// returns: no metric is computed here (labels and chart geometry only). Sections with data are cards; sections
// without data collapse into one "Chưa có số liệu" card, one muted line each with a link to what produces it.

import { useId, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronRight, ClipboardCheck, Info } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { useCheckups, type CheckupResult } from '../../core/benchmark';
import { loadHistory } from '../../core/history';
import { loadLessonProgress } from '../../core/lessons';
import { formatDurationVi, useListeningEntries } from '../../core/listening';
import { hrefFor, navigate, type RouteId } from '../../core/nav';
import {
  buildReport,
  decimalVi,
  MIN_RETENTION_SAMPLE,
  MIN_WEEK_ATTEMPTS,
  MIN_WEEK_RATINGS,
  understoodProse,
  type ProgressReport,
  type ReportPeriod,
} from '../../core/progressReport';
import { useSettings } from '../../core/settings';
import type { StatsState } from '../../core/stats';
import { KEYS, loadJSON } from '../../core/storage';
import AiCoach from '../ai/AiCoach';
import { parseOnboarding } from '../home/homeModel';
import { DotLineChart, MinutesBarChart, Sparkline } from './ReportCharts';
import './report.css';

export interface ReportViewProps {
  period: ReportPeriod;
  stats: StatsState;
  /** The review store (KEYS.review value) from useReview(), for today's learned-word count. */
  reviewStore: unknown;
  now: number;
}

/** Rows of the checkup table shown before "Xem tất cả". */
const CHECKUP_ROWS = 4;
/** Phenomenon rows shown before "Xem cả N". */
const PHENOMENON_ROWS = 4;

export default function ReportView({ period, stats, reviewStore, now }: ReportViewProps) {
  const log = useListeningEntries();
  const checkups = useCheckups();
  const settings = useSettings();
  // The archive and lesson progress change only with practice (stats) or review grades: re-read with them.
  const history = useMemo(() => readAfter([stats, reviewStore], () => loadHistory(now)), [now, stats, reviewStore]);
  const lessons = useMemo(() => readAfter([stats], loadLessonProgress), [stats]);
  const onboardingDone = useMemo(() => parseOnboarding(loadJSON<unknown>(KEYS.onboarding, null)).done, []);

  const report = useMemo(
    () =>
      buildReport({
        log: [...log],
        checkups: [...checkups],
        history,
        stats,
        review: reviewStore,
        lessons,
        settings: { listenGoal: settings.listenGoal },
        onboardingDone,
        now,
        period,
      }),
    [log, checkups, history, stats, reviewStore, lessons, settings.listenGoal, onboardingDone, now, period],
  );

  const due = report.checkups.due.kind;
  // The "Làm bài kiểm tra" row on top already covers a missing baseline.
  const missing = missingRows(report).filter((m) => !(due && m.key === 'checkup'));
  const cards: { key: string; node: ReactNode }[] = [];
  if (report.listening.empty === null) cards.push({ key: 'listening', node: <ListeningCard report={report} /> });
  if (report.checkups.empty === null) cards.push({ key: 'checkups', node: <CheckupCard report={report} /> });
  if (report.understood.empty === null) cards.push({ key: 'understood', node: <UnderstoodCard report={report} /> });
  if (report.practice.empty === null) cards.push({ key: 'practice', node: <PracticeCard report={report} /> });

  return (
    <div className="stack-lg rep-view">
      {report.overview.empty === null && <OverviewTiles report={report} />}

      {due && (
        <section className="card rep-due" aria-label="Kiểm tra định kỳ">
          <Icon icon={ClipboardCheck} size={20} className="rep-due-icon" />
          <p className="rep-due-text">
            {due === 'due' ? (
              <>
                <strong>Đến lúc kiểm tra định kỳ.</strong> Bài nghe khoảng 10 phút để so với lần trước.
              </>
            ) : (
              <>
                <strong>Chưa có mốc so sánh.</strong> Làm bài kiểm tra khoảng 10 phút để đo tiến bộ về sau.
              </>
            )}
          </p>
          <Link to="checkup" className="btn btn-soft btn-sm rep-due-btn">
            Làm bài kiểm tra định kỳ
          </Link>
        </section>
      )}

      {report.overview.empty === null && report.insights.length > 0 && (
        <Insights items={report.insights} footer={<AiCoach report={report} latest={latestCheckup(checkups)} checkups={checkups} />} />
      )}

      {cards.length > 0 && (
        // Two independent columns from 1040px (cards alternate, so a tall card never leaves a hole beside the next
        // row); below that the columns dissolve (display: contents) and `order` keeps the section order.
        <div className="rep-grid">
          {[0, 1].map((col) => (
            <div className="rep-col" key={col}>
              {cards.map(({ key, node }, i) =>
                i % 2 === col ? (
                  <div className="rep-cell" key={key} style={{ order: i }}>
                    {node}
                  </div>
                ) : null,
              )}
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && <MissingCard intro={report.overview.empty} rows={missing} />}
    </div>
  );
}

// ───────────────────────── bits ─────────────────────────

/** Reads a store that has no subscription of its own; `triggers` are the snapshots whose change means a new write. */
function readAfter<T>(triggers: readonly unknown[], read: () => T): T {
  void triggers;
  return read();
}

/** Real link that navigates in-app on a plain click. */
function Link({ to, className, children }: { to: RouteId; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={hrefFor(to)} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

function CardHead({ id, title, meta }: { id: string; title: string; meta?: ReactNode }) {
  return (
    <div className="rep-head">
      <h2 id={id} className="rep-h2">
        {title}
      </h2>
      {meta && <span className="meta rep-head-meta">{meta}</span>}
    </div>
  );
}

const weekAxisLabel = (w: { label: string; isCurrent: boolean }) => (w.isCurrent ? 'Nay' : w.label);

function markTitle(p: { repeatForm: boolean; inTrend: boolean }): string {
  return !p.inTrend ? 'Làm lại sớm (dưới 7 ngày): không tính vào xu hướng' : 'Đề đã làm trước đây: điểm có thể cao hơn thực tế';
}

// ───────────────────────── 1. overview ─────────────────────────

function OverviewTiles({ report }: { report: ProgressReport }) {
  const o = report.overview;
  const neverListened = o.totalMinutes === 0;
  // "800 ngày có nghe" under "800 ngày" says nothing new: only shown when it differs.
  const daysHint = [
    o.listeningDays > 0 && o.listeningDays !== o.activeDays ? `${o.listeningDays} ngày có nghe` : '',
    o.checkupsTaken > 0 ? `${o.checkupsTaken} bài kiểm tra` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  // "Tất cả": the period total equals the lifetime total, so the first tile shows the weekly average instead.
  const all = report.period === 'all';
  return (
    <section className="rep-tiles" aria-label={`Tổng quan, ${o.periodLabel.toLowerCase()}`}>
      <div className="card rep-tile">
        <span className="rep-tile-label">{all ? 'Trung bình mỗi tuần' : `Giờ nghe · ${o.periodLabel.toLowerCase()}`}</span>
        {neverListened ? (
          <>
            <span className="rep-tile-value is-text">Chưa ghi</span>
            <Link to="listening" className="rep-link">
              Ghi giờ nghe
              <Icon icon={ChevronRight} size={15} />
            </Link>
          </>
        ) : (
          <>
            <span className="rep-tile-value">{all ? (o.avgPerWeekLabel ?? o.listenLabel) : o.listenLabel}</span>
            {!all && listenHint(o) && <span className="rep-tile-hint">{listenHint(o)}</span>}
            {all && <span className="rep-tile-hint">{`${o.listeningDays} ngày có nghe`}</span>}
          </>
        )}
      </div>
      <div className="card rep-tile">
        <span className="rep-tile-label">Tổng giờ nghe</span>
        {neverListened ? (
          <>
            <span className="rep-tile-value is-text">Chưa có</span>
            <span className="rep-tile-hint">Mốc đầu tiên: 10 giờ</span>
          </>
        ) : (
          <>
            <span className="rep-tile-value">{o.totalLabel}</span>
            {o.milestone.nextHours !== null && (
              <div
                className="progress rep-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(o.milestone.progress * 100)}
                aria-label={o.milestone.label}
              >
                <span style={{ width: `${Math.round(o.milestone.progress * 100)}%` }} />
              </div>
            )}
            <span className="rep-tile-hint">{o.milestone.label}</span>
          </>
        )}
      </div>
      <div className="card rep-tile">
        <span className="rep-tile-label">Ngày hoạt động</span>
        <span className="rep-tile-value">
          {o.activeDays}
          <span className="rep-tile-unit"> ngày</span>
        </span>
        {daysHint && <span className="rep-tile-hint">{daysHint}</span>}
      </div>
    </section>
  );
}

function listenHint(o: ProgressReport['overview']): string {
  if (o.changeLabel) return capitalize(o.changeLabel);
  if (o.listenMinutes === 0) return 'Chưa ghi giờ nghe trong kỳ này';
  if (o.prevListenMinutes === null) return '';
  return o.prevListenMinutes === 0 ? 'Kỳ trước chưa ghi giờ nghe' : 'Kỳ trước nghe ít, chưa so sánh được';
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('vi') + s.slice(1);
}

// ───────────────────────── 6. Nhận xét ─────────────────────────

/** The most recent checkup (its per-phenomenon misses go to the AI coach as numbers). */
function latestCheckup(list: readonly CheckupResult[]): CheckupResult | null {
  let best: CheckupResult | null = null;
  for (const c of list) if (!best || c.at > best.at) best = c;
  return best;
}

function Insights({ items, footer }: { items: readonly string[]; footer?: ReactNode }) {
  const id = useId();
  return (
    <section className="card rep-card rep-insights" aria-labelledby={id}>
      <CardHead id={id} title="Nhận xét" />
      <ul className="rep-insight-list">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {footer}
    </section>
  );
}

// ───────────────────────── 2. giờ nghe theo tuần ─────────────────────────

function ListeningCard({ report }: { report: ProgressReport }) {
  const id = useId();
  const l = report.listening;
  const month = l.unit === 'month';
  const day = l.unit === 'day';
  const unitWord = month ? 'tháng' : day ? 'ngày' : 'tuần';
  const data = l.weeks.map((w) => ({
    key: w.key,
    label: weekAxisLabel(w),
    value: w.minutes,
    current: w.isCurrent,
    title:
      `${month || day ? capitalize(w.rangeLabel) : `Tuần ${w.rangeLabel}`}${w.isCurrent ? ' (chưa hết)' : ''}: ${w.minutesLabel}` +
      (w.minutes > 0 ? `, trung bình ${w.avgPerDay} phút/ngày` : ''),
  }));
  return (
    <section className="card rep-card" aria-labelledby={id}>
      <CardHead id={id} title={`Giờ nghe theo ${unitWord}`} meta={report.overview.listenLabel + ' · ' + report.overview.periodLabel.toLowerCase()} />
      <MinutesBarChart data={data} max={l.maxMinutes} goal={l.goalPerBar} goalCurrent={l.goalCurrent} label={l.summary} />
      {l.goalPerDay > 0 && (
        <p className="rep-legend">
          <span className="rep-legend-goal" aria-hidden="true" />
          Mục tiêu {l.goalPerDay} phút mỗi ngày{day ? '' : `, tức ${formatDurationVi(l.goalPerBar)} mỗi ${unitWord}`}
          {l.goalCurrent > 0 ? `; vạch đậm trên cột ${unitWord} này: mục tiêu tính đến hôm nay` : ''}
        </p>
      )}
      {l.sources.length > 0 && (
        <div className="rep-sub">
          <h3 className="rep-h3">Nguồn nghe</h3>
          <ul className="rep-shares">
            {l.sources.map((s) => {
              const pct = Math.round(s.share * 100);
              return (
                <li key={s.source} className="rep-share">
                  <span className="rep-share-label">{s.label}</span>
                  <span className="rep-share-track" aria-hidden="true">
                    <span className="rep-share-fill" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </span>
                  <span className="rep-share-num">
                    {formatDurationVi(s.minutes)} · {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// ───────────────────────── 3. điểm kiểm tra định kỳ ─────────────────────────

function CheckupCard({ report }: { report: ProgressReport }) {
  const id = useId();
  const tableId = useId();
  const phId = useId();
  const c = report.checkups;
  const [allRows, setAllRows] = useState(false);
  const [allPh, setAllPh] = useState(false);
  const rows = [...c.points].reverse();
  const shownRows = allRows ? rows : rows.slice(0, CHECKUP_ROWS);
  const ph = c.baselineOnly ? [] : c.phenomena;
  const shownPh = allPh ? ph : ph.slice(0, PHENOMENON_ROWS);
  const latest = c.latestScore;
  return (
    <section className="card rep-card" aria-labelledby={id}>
      <CardHead id={id} title="Điểm kiểm tra định kỳ" meta={c.due.kind ? null : c.nextLabel} />

      {latest !== null && (
        <div className="rep-score">
          <span className="rep-score-num">
            {latest}
            <span className="rep-score-unit"> điểm</span>
          </span>
          <span className="rep-score-delta">
            {c.baselineOnly ? 'Lần đầu, dùng làm mốc' : c.deltaFirstLabel}
            {c.deltaPrevLabel && <span className="meta"> · {c.deltaPrevLabel}</span>}
          </span>
        </div>
      )}
      {c.deltaHedge && !c.baselineOnly && <p className="rep-note">{c.deltaHedge}</p>}
      {c.baselineNote && <p className="rep-note">{c.baselineNote}</p>}
      {c.staleNote && <p className="rep-note">{c.staleNote}</p>}

      {c.points.length >= 2 && (
        <DotLineChart
          values={c.points.map((p) => p.score)}
          xLabels={c.points.map((p) => p.dateLabel.slice(0, 5))}
          currentIndex={c.points.length - 1}
          min={0}
          max={100}
          ticks={[0, 50, 100].map((v) => ({ value: v, label: String(v) }))}
          format={(v) => String(v)}
          label={c.summary}
          left={40}
          weak={c.points.map((p) => !p.inTrend)}
          titles={c.points.map((p) => `${p.dateLabel}, đề ${p.form}: ${p.score} điểm${p.inTrend ? '' : ' (làm lại sớm, không tính vào xu hướng)'}`)}
          labelEnds
        />
      )}
      {c.earlier > 0 && (
        <p className="rep-note">
          {c.points.length === 0 ? `${c.earlier} bài kiểm tra trước kỳ này.` : `Cộng thêm ${c.earlier} bài trước kỳ này (xem ở "Tất cả").`}
        </p>
      )}

      {shownRows.length > 0 && (
        <>
          <table className="rep-table" id={tableId}>
            <caption className="sr-only">Các lần kiểm tra định kỳ, mới nhất trước</caption>
            <thead>
              <tr>
                <th scope="col">Ngày</th>
                <th scope="col">Đề</th>
                <th scope="col">Điểm</th>
                <th scope="col">Chép</th>
                <th scope="col">Hiểu</th>
              </tr>
            </thead>
            <tbody>
              {shownRows.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.dateLabel}</th>
                  <td>
                    {p.form}
                    {(p.repeatForm || !p.inTrend) && (
                      <span className="rep-mark" title={markTitle(p)} aria-label={markTitle(p)}>
                        *
                      </span>
                    )}
                  </td>
                  <td className="rep-strong">{p.score}</td>
                  <td>{p.dictationPct}%</td>
                  <td>
                    {p.comprehensionCorrect}/{p.comprehensionTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > CHECKUP_ROWS && (
            <button type="button" className="btn btn-ghost btn-sm rep-more" aria-expanded={allRows} aria-controls={tableId} onClick={() => setAllRows((v) => !v)}>
              {allRows ? 'Thu gọn' : `Xem cả ${rows.length} lần`}
            </button>
          )}
        </>
      )}

      {(c.formNote || shownRows.some((p) => p.repeatForm || !p.inTrend)) && (
        <p className="rep-note">
          {c.formNote}
          {shownRows.some((p) => p.repeatForm || !p.inTrend) ? ' Dấu * là đề đã làm trước đây hoặc bài làm lại sớm (dưới 7 ngày), không tính vào xu hướng.' : ''}
        </p>
      )}

      {c.voiceNote && (
        <p className="rep-note rep-note-icon">
          <Icon icon={Info} size={16} />
          <span>{c.voiceNote}</span>
        </p>
      )}

      {ph.length > 0 && (
        <div className="rep-sub">
          <div className="rep-head">
            <h3 className="rep-h3">Theo hiện tượng</h3>
            <span className="meta">Câu nghe sót: lần đầu → gần nhất</span>
          </div>
          <ul className="rep-ph" id={phId}>
            {shownPh.map((p) => (
              <li key={p.phenomenon} className={'rep-ph-row' + (p.lowSample ? ' is-low' : '')}>
                <span className="rep-ph-label">{p.label}</span>
                <span className="rep-ph-num">
                  {p.firstMissed}/{p.firstSeen} câu → <strong>{p.latestMissed}/{p.latestSeen} câu</strong>
                </span>
              </li>
            ))}
          </ul>
          {shownPh.some((p) => p.lowSample) && <p className="rep-note">Dòng mờ: ít câu, chưa đủ để kết luận.</p>}
          {ph.length > PHENOMENON_ROWS && (
            <button type="button" className="btn btn-ghost btn-sm rep-more" aria-expanded={allPh} aria-controls={phId} onClick={() => setAllPh((v) => !v)}>
              {allPh ? 'Thu gọn' : `Xem cả ${ph.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ───────────────────────── 4. tự đánh giá ─────────────────────────

function UnderstoodCard({ report }: { report: ProgressReport }) {
  const id = useId();
  const u = report.understood;
  const current = u.weeks.length - 1;
  return (
    <section className="card rep-card" aria-labelledby={id}>
      <CardHead id={id} title="Tự đánh giá mức hiểu" meta={u.avgLabel} />
      <p className="rep-note">
        {u.note}
        {u.rated < 4 ? ' Mới có vài lần đánh giá nên chưa nói lên nhiều.' : ''}
        {u.weeks.some((w) => w.avg !== null && w.count < MIN_WEEK_RATINGS) ? ' Chấm xám: chỉ một lần ghi.' : ''}
      </p>
      {u.weeks.some((w) => w.avg !== null) && (
        <DotLineChart
          values={u.weeks.map((w) => w.avg)}
          xLabels={u.weeks.map((w, i) => (i === current ? 'Nay' : w.label))}
          currentIndex={current}
          min={1}
          max={5}
          ticks={[
            { value: 1, label: '<30%' },
            { value: 3, label: '50–70%' },
            { value: 5, label: '>90%' },
          ]}
          format={(v) => decimalVi(v)}
          label={u.summary}
          left={64}
          height={170}
          pointLabels={false}
          weak={u.weeks.map((w) => w.count < MIN_WEEK_RATINGS)}
          titles={u.weeks.map((w) => (w.avg === null ? '' : `${w.rangeLabel}: ${understoodProse(w.avg)} (${w.count} lần ghi)`))}
        />
      )}
    </section>
  );
}

// ───────────────────────── 5. luyện trong app ─────────────────────────

function PracticeCard({ report }: { report: ProgressReport }) {
  const id = useId();
  const p = report.practice;
  const weeks = p.weeks;
  const current = weeks.length - 1;
  const hasWeekly = weeks.some((w) => w.total.pct !== null);
  const facts: string[] = [];
  if (p.retention.label) facts.push(p.retention.label + (p.retention.n < MIN_RETENTION_SAMPLE ? ', còn ít lượt nên chưa chắc' : ''));
  if (p.lessonsPassed > 0)
    facts.push(
      p.lessonsPassed === p.lessonsPassedTotal
        ? `Qua ${p.lessonsPassed} bài học`
        : `Qua ${p.lessonsPassed} bài học trong kỳ, tổng cộng ${p.lessonsPassedTotal} bài`,
    );
  else if (p.lessonsPassedTotal > 0) facts.push(`Đã qua ${p.lessonsPassedTotal} bài học, chưa có bài mới trong kỳ`);
  if (p.words.total > 0) facts.push(`Từ đã thuộc: ${p.words.total} từ${p.words.added > 0 ? `, thêm ${p.words.added} từ trong kỳ` : ''}`);
  const archiveNote = p.archiveSince && p.archiveSince > report.overview.fromDay ? `Số liệu ôn tập được ghi từ ${ddmmyyyy(p.archiveSince)}.` : null;
  return (
    <section className="card rep-card" aria-labelledby={id}>
      <CardHead id={id} title="Luyện trong app" meta={p.total.n > 0 ? `${p.total.n} lượt · ${p.total.pct}% đúng` : null} />
      {hasWeekly && (
        <DotLineChart
          values={weeks.map((w) => w.total.pct)}
          xLabels={weeks.map((w, i) => (i === current ? 'Nay' : w.label))}
          currentIndex={current}
          min={0}
          max={100}
          ticks={[0, 50, 100].map((v) => ({ value: v, label: `${v}%` }))}
          format={(v) => String(v)}
          label={p.summary}
          weak={weeks.map((w) => w.total.n < MIN_WEEK_ATTEMPTS)}
          titles={weeks.map((w, i) => `${w.label}${i === current ? ' (chưa hết)' : ''}: ${w.total.pct ?? 0}% (${w.total.n} lượt)`)}
        />
      )}
      {hasWeekly && weeks.some((w) => w.total.n > 0 && w.total.n < MIN_WEEK_ATTEMPTS) && (
        <p className="rep-note">Chấm xám: dưới {MIN_WEEK_ATTEMPTS} lượt, chưa đáng tin.</p>
      )}
      <p className="rep-note">Tính các bài luyện mới; lượt ôn lại trong Ôn tập được đo bằng tỉ lệ nhớ bên dưới.</p>
      {p.modules.length > 0 && (
        <table className="rep-table rep-mod-table">
          <caption className="sr-only">Độ chính xác theo phần luyện trong kỳ</caption>
          <thead>
            <tr>
              <th scope="col">Phần luyện</th>
              <th scope="col">Lượt</th>
              <th scope="col">Đúng</th>
              <th scope="col" className="rep-spark-col">
                <span className="sr-only">{report.weeks.length && report.unit === 'day' ? 'Theo ngày' : report.unit === 'month' ? 'Theo tháng' : 'Theo tuần'}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {p.modules.map((m) => (
              <tr key={m.module}>
                <th scope="row">{m.label}</th>
                <td>{m.n}</td>
                <td className="rep-strong">{m.pct}%</td>
                <td className="rep-spark-col">
                  <Sparkline values={weeks.map((w) => ((w.byModule[m.module]?.n ?? 0) >= MIN_WEEK_ATTEMPTS ? (w.byModule[m.module]?.pct ?? null) : null))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {facts.length > 0 && (
        <ul className="rep-facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      {archiveNote && <p className="rep-note">{archiveNote}</p>}
    </section>
  );
}

function ddmmyyyy(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

// ───────────────────────── sections without data ─────────────────────────

interface MissingRow {
  key: string;
  title: string;
  text: string;
  to: RouteId;
  action: string;
}

function missingRows(r: ProgressReport): MissingRow[] {
  const out: MissingRow[] = [];
  // Listening and self-rating come from the same place: one row for both.
  if (r.listening.empty)
    out.push({
      key: 'listen',
      title: r.understood.empty ? 'Giờ nghe và mức hiểu' : 'Giờ nghe',
      text: r.understood.empty ? 'Ghi giờ nghe (kèm mức hiểu) ở Nhật ký nghe.' : r.listening.empty,
      to: 'listening',
      action: 'Mở Nhật ký nghe',
    });
  else if (r.understood.empty)
    out.push({ key: 'understood', title: 'Tự đánh giá mức hiểu', text: r.understood.empty, to: 'listening', action: 'Mở Nhật ký nghe' });
  if (r.checkups.empty)
    out.push({ key: 'checkup', title: 'Điểm kiểm tra định kỳ', text: r.checkups.empty, to: 'checkup', action: 'Làm bài kiểm tra' });
  if (r.practice.empty) out.push({ key: 'practice', title: 'Luyện trong app', text: r.practice.empty, to: 'home', action: 'Mở Hôm nay' });
  return out;
}

function MissingCard({ intro, rows }: { intro: string | null; rows: MissingRow[] }) {
  const id = useId();
  return (
    <section className="card rep-card rep-missing" aria-labelledby={id}>
      <CardHead id={id} title={intro ? 'Để báo cáo có số liệu' : 'Phần chưa có số liệu'} />
      <ul className="rep-missing-list">
        {rows.map((m) => (
          <li key={m.key} className="rep-missing-row">
            <span className="rep-missing-text">
              <span className="rep-missing-title">{m.title}</span>
              <span className="rep-note">{m.text}</span>
            </span>
            <Link to={m.to} className="rep-link">
              {m.action}
              <Icon icon={ChevronRight} size={15} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
