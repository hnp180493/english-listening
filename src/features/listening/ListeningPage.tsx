// "Nhật ký nghe": log real listening (films, YouTube, podcasts…), the stopwatch, totals and milestones.
// Data and rules: src/core/listening.ts; docs/progress-report.md.

import { useState } from 'react';
import { Check, ChevronRight, CircleHelp } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import Segmented from '../../components/Segmented';
import { checkupDue, useCheckups } from '../../core/benchmark';
import { formatDurationVi, useListeningEntries, useListeningTimer, type ListeningEntry } from '../../core/listening';
import { hrefFor } from '../../core/nav';
import { useSettings } from '../../core/settings';
import { localDay } from '../../core/stats';
import { useNow } from '../home/hooks';
import EntryList from './EntryList';
import { defaultSource, entryTitle, listenSummary, recentEntries, todayHead, weekLine, type ListenSummary } from './listeningModel';
import QuickAdd from './QuickAdd';
import TimerPanel from './TimerPanel';
import './listening.css';

type Mode = 'quick' | 'timer';

function TodayHead({ s }: { s: ListenSummary }) {
  const head = todayHead(s);
  return (
    <>
      <div className="lis-head">
        <h2 id="lis-today-h">Hôm nay</h2>
        {head && <span className="meta">{head}</span>}
      </div>
      {s.goal > 0 && s.today > 0 && (
        <div
          className={'progress lis-bar' + (s.today >= s.goal ? ' is-done' : '')}
          role="progressbar"
          aria-label="Mục tiêu nghe hôm nay"
          aria-valuemin={0}
          aria-valuemax={s.goal}
          aria-valuenow={Math.min(s.today, s.goal)}
          aria-valuetext={`${s.today} trên ${s.goal} phút`}
        >
          <span style={{ width: `${s.todayPct}%` }} />
        </div>
      )}
    </>
  );
}

function TotalsCard({ s, checkupLabel }: { s: ListenSummary; checkupLabel: string }) {
  const m = s.milestone;
  const week = weekLine(s);
  return (
    <section className="card lis-totals stack" aria-labelledby="lis-total-h">
      <h2 id="lis-total-h">Tổng thời gian nghe</h2>
      <p className="lis-big tabular">{formatDurationVi(s.total)}</p>
      <div className="stack-sm">
        <div
          className="progress lis-milestone"
          role="progressbar"
          aria-label={m.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(m.progress * 100)}
        >
          <span style={{ width: `${Math.round(m.progress * 100)}%` }} />
        </div>
        <p className="meta">{m.label}</p>
      </div>
      {(week || s.lastWeek > 0) && (
        <p className="lis-week">
          <span className="nowrap-seg">{week ?? 'Tuần này chưa nghe'}</span>
          {s.lastWeek > 0 && (
            <>
              {' '}
              <span className="meta nowrap-seg">· Tuần trước: {formatDurationVi(s.lastWeek)}</span>
            </>
          )}
        </p>
      )}
      <div className="lis-links">
        <a className="btn btn-ghost btn-sm" href={hrefFor('stats', { view: 'report' })}>
          Xem báo cáo tiến bộ
          <Icon icon={ChevronRight} size={16} />
        </a>
        <a className="btn btn-ghost btn-sm" href={hrefFor('checkup')}>
          {checkupLabel}
          <Icon icon={ChevronRight} size={16} />
        </a>
      </div>
    </section>
  );
}

export default function ListeningPage() {
  const entries = useListeningEntries();
  const timer = useListeningTimer();
  const { listenGoal } = useSettings();
  const now = useNow();
  const checkups = useCheckups();
  // The stopwatch view while a timer exists; otherwise logging after the fact is the common case.
  const [mode, setMode] = useState<Mode>(() => (timer ? 'timer' : 'quick'));
  const [lastSaved, setLastSaved] = useState<ListeningEntry | null>(null);

  const today = localDay(now);
  const s = listenSummary(entries, now, listenGoal);
  const recent = recentEntries(entries, now);
  const src = defaultSource(entries);
  const due = checkupDue(checkups, now, true);
  const checkupLabel = due.kind === 'baseline' ? 'Làm bài kiểm tra đầu vào' : due.kind === 'due' ? 'Đến lúc kiểm tra định kỳ' : 'Kiểm tra định kỳ';
  const activeMode = mode;

  return (
    <div className="stack-lg page-focus lis-page">
      <PageHeader title="Nhật ký nghe" subtitle="Ghi lại giờ nghe tiếng Anh thật mỗi ngày." />

      <section className="card lis-work stack" aria-labelledby="lis-today-h">
        <TodayHead s={s} />
        <Segmented
          ariaLabel="Cách ghi"
          value={activeMode}
          onChange={(m) => {
            setMode(m);
            setLastSaved(null);
          }}
          options={[
            { value: 'quick', label: 'Ghi nhanh' },
            {
              value: 'timer',
              // One stable name; a running/paused stopwatch only adds a small dot (its state is in the panel).
              label: timer ? (
                <>
                  Bấm giờ <span className="lis-seg-dot" aria-hidden="true" />
                </>
              ) : (
                'Bấm giờ'
              ),
              title: timer ? 'Bấm giờ (đồng hồ đang có)' : undefined,
            },
          ]}
          className="lis-modes"
        />
        {activeMode === 'timer' ? (
          <TimerPanel
            timer={timer}
            defaultSource={src}
            onSaved={setLastSaved}
          />
        ) : (
          <QuickAdd defaultSource={src} now={now} onSaved={() => setLastSaved(null)} />
        )}
        {activeMode === 'timer' && !timer && lastSaved && (
          <p className="meta lis-saved" role="status">
            <Icon icon={Check} size={16} />
            Đã ghi {entryTitle(lastSaved)}.
          </p>
        )}
      </section>

      {s.total > 0 && <TotalsCard s={s} checkupLabel={checkupLabel} />}

      {recent.length > 0 && (
        <section className="stack" aria-labelledby="lis-recent-h">
          <h2 id="lis-recent-h" className="section-title">
            30 ngày gần đây
          </h2>
          <EntryList entries={recent} today={today} />
        </section>
      )}

      <details className="how" open={entries.length === 0}>
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Vì sao cần ghi giờ nghe?
        </summary>
        <div className="stack-sm lis-how">
          <p>
            Bài học trong app giúp bạn nhận ra nối âm, nuốt âm, âm yếu. Nhưng để nghe tự nhiên như người bản xứ, bạn cần hàng trăm,
            rồi hàng nghìn giờ nghe tiếng Anh thật.
          </p>
          <ul className="stack-sm">
            <li>Chọn nội dung hơi khó: hiểu khoảng 70% là vừa sức. Hiểu dưới 30% thì nên chọn nội dung dễ hơn.</li>
            <li>Ưu tiên không phụ đề hoặc phụ đề tiếng Anh. Phụ đề tiếng Việt khiến bạn đọc nhiều hơn nghe.</li>
            <li>Nghe đều mỗi ngày tốt hơn dồn một lần. Video thật trong app được ghi tự động.</li>
            <li>Khoảng 2 tuần một lần, làm bài kiểm tra định kỳ 10 phút để xem tai nghe của bạn tiến bộ ra sao.</li>
          </ul>
        </div>
      </details>
    </div>
  );
}
