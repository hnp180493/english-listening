import { Check, RotateCcw, X } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import { PhDot } from '../../components/PhTag';
import PlayButton from '../../components/PlayButton';
import { navigate } from '../../core/nav';
import { PHENOMENON_INFO } from '../../core/phenomena';
import type { Chunk } from '../../core/types';
import type { FocusSession } from './focus';

/** Top banner of a focus session: which phenomenon, progress, and a way out. */
export function FocusBanner({ session }: { session: FocusSession }) {
  const info = PHENOMENON_INFO[session.phenomenon];
  const planned = session.done + session.queue.length;
  const pct = planned > 0 ? Math.round((session.done / planned) * 100) : 100;
  return (
    <section className="card drill-focus-banner" aria-label="Phiên luyện theo hiện tượng">
      <div className="drill-focus-top">
        <div className="drill-focus-text">
          <span className="eyebrow">Luyện theo hiện tượng</span>
          <span className="drill-focus-title" title={info.en}>
            <PhDot p={session.phenomenon} />
            <strong className="drill-focus-name">{info.label}</strong>
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm drill-focus-exit" onClick={() => navigate('drill')}>
          <Icon icon={X} size={15} />
          Thoát
        </button>
      </div>
      <p className="drill-focus-summary">{info.summary}</p>
      {planned > 0 && (
        <div className="drill-focus-progress">
          <div
            className="progress drill-focus-bar"
            role="progressbar"
            aria-label="Tiến độ phiên luyện"
            aria-valuemin={0}
            aria-valuemax={planned}
            aria-valuenow={session.done}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="drill-focus-count">
            {Math.min(session.done + (session.queue.length > 0 ? 1 : 0), planned)}/{planned}
          </span>
        </div>
      )}
    </section>
  );
}

export interface FocusDoneProps {
  session: FocusSession;
  chunkMap: ReadonlyMap<string, Chunk>;
  onRestart: () => void;
}

/** End of a focus session (or a phenomenon without any chunk). */
export function FocusDone({ session, chunkMap, onRestart }: FocusDoneProps) {
  const info = PHENOMENON_INFO[session.phenomenon];
  if (session.total === 0) {
    return (
      <div className="card empty-state">
        <h2>Chưa có cụm nào cho “{info.label}”</h2>
        <p>Bộ cụm từ chưa có ví dụ cho hiện tượng này. Hãy chọn hiện tượng khác bên dưới.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => navigate('drill')}>
            Về ôn tập hôm nay
          </button>
        </div>
      </div>
    );
  }
  const missed = session.missed.map((id) => chunkMap.get(id)).filter((c): c is Chunk => !!c);
  const pct = session.done > 0 ? Math.round((session.correct / session.done) * 100) : 0;
  return (
    <div className="card drill-done">
      <IconTile icon={Check} tint="var(--ok)" size="lg" className="drill-done-icon" />
      <h2>Xong phiên “{info.label}”!</h2>
      <p className="muted">
        Bạn đã chấm {session.done} lượt, nhớ tốt <strong className="drill-num">{session.correct}</strong> lượt ({pct}%).
      </p>
      {missed.length > 0 && (
        <div className="panel drill-missed">
          <h3 className="drill-missed-title">Cụm cần nghe thêm</h3>
          <ul className="drill-missed-list">
            {missed.map((c) => (
              <li key={c.id} className="drill-missed-row">
                <span lang="en" className="drill-pair">
                  {c.written}
                  <span className="respell-sep" aria-hidden="true">
                    →
                  </span>
                  <span className="respell">{c.spoken}</span>
                </span>
                <PlayButton text={c.ttsText} rate={1} mode="connected" size="sm" variant="ghost" />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="drill-done-actions">
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          <Icon icon={RotateCcw} size={16} />
          Luyện lại “{info.label}”
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('drill')}>
          Về ôn tập hôm nay
        </button>
      </div>
    </div>
  );
}
