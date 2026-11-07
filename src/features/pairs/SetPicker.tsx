import { useMemo, useState, type CSSProperties } from 'react';
import { CircleHelp, Shuffle, Target, TriangleAlert } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import { hrefFor, navigate } from '../../core/nav';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { ttsSupported } from '../../core/tts';
import { PHENOMENA, type Phenomenon } from '../../core/types';
import type { PairSet } from '../../data/pairs';
import { ROUND_SIZE, percent, setMastery, setsForFocus, weakItemIds, type PairsProgress } from './game';
import type { PlayMode } from './PairsPage';
import { PAIRS_SHORTCUTS } from './shortcuts';

const FLAT_ACCENT = { '--progress-color': 'var(--accent)' } as CSSProperties;

export interface SetPickerProps {
  sets: readonly PairSet[];
  focus: Phenomenon | null;
  progress: PairsProgress;
  missingSet: string | null;
  onStart: (mode: PlayMode) => void;
}

export default function SetPicker({ sets, focus, progress, missingSet, onStart }: SetPickerProps) {
  const visible = useMemo(() => setsForFocus(sets, focus), [sets, focus]);
  const available = useMemo(() => PHENOMENA.filter((p) => sets.some((s) => s.phenomenon === p)), [sets]);
  const [now] = useState(() => Date.now());
  const weakIds = useMemo(() => weakItemIds(visible, progress, now), [visible, progress, now]);
  const totals = useMemo(() => {
    let items = 0;
    let mastered = 0;
    for (const s of visible) {
      const m = setMastery(s, progress);
      items += m.total;
      mastered += m.mastered;
    }
    return { items, mastered };
  }, [visible, progress]);
  const played = useMemo(() => sets.some((s) => (progress.sets[s.id]?.plays ?? 0) > 0), [sets, progress]);
  const tts = ttsSupported();
  const focusLabel = focus ? PHENOMENON_INFO[focus].label : null;

  return (
    <div className="stack-lg page-browse">
      <PageHeader
        title="Phân biệt âm"
        subtitle="Nghe một câu, chọn đúng câu bạn nghe được."
        actions={
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!tts || visible.length === 0}
              onClick={() => onStart({ kind: 'mix', focus })}
            >
              <Icon icon={Shuffle} size={16} />
              {focusLabel ? `Trộn ${focusLabel}` : 'Trộn tất cả'} · {ROUND_SIZE} câu
            </button>
            {weakIds.length > 0 && (
              <button
                type="button"
                className="btn btn-soft"
                disabled={!tts}
                onClick={() => onStart({ kind: 'review', itemIds: weakIds })}
              >
                <Icon icon={Target} size={16} />
                Luyện câu hay sai ({weakIds.length})
              </button>
            )}
          </>
        }
        help={<ShortcutsHelp items={PAIRS_SHORTCUTS} />}
      />

      {!tts && (
        <div className="callout callout-warn" role="alert">
          <Icon icon={TriangleAlert} size={18} />
          <div>
            Trình duyệt này không hỗ trợ đọc giọng nói (Speech Synthesis), nên trò chơi không phát được âm thanh. Hãy mở
            bằng Chrome, Edge hoặc Safari bản mới.
          </div>
        </div>
      )}

      {missingSet && (
        <div className="callout callout-warn" role="alert">
          <Icon icon={TriangleAlert} size={18} />
          <div>Không tìm thấy bộ “{missingSet}”. Hãy chọn một bộ bên dưới.</div>
        </div>
      )}

      <section className="stack" aria-labelledby="pairs-sets-h">
        <div className="toolbar">
          <h2 id="pairs-sets-h" className="pairs-sets-title">
            Các bộ luyện
            {totals.mastered > 0 && (
              <span className="meta pairs-sets-count">
                {' '}
                · {totals.mastered}/{totals.items} câu đã thuộc
              </span>
            )}
          </h2>
          <select
            className="select pairs-focus"
            aria-label="Lọc theo hiện tượng"
            value={focus ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              navigate('pairs', v ? { focus: v } : undefined);
            }}
          >
            <option value="">Mọi hiện tượng</option>
            {available.map((p) => (
              <option key={p} value={p}>
                {PHENOMENON_INFO[p].label}
              </option>
            ))}
          </select>
        </div>

        {visible.length === 0 ? (
          <div className="card empty-state">
            <h2>Chưa có bộ nào cho “{focusLabel}”</h2>
            <p>Hiện tượng này chưa có bài phân biệt âm.</p>
            <div className="row">
              <a className="btn" href={hrefFor('pairs')}>
                Xem tất cả các bộ
              </a>
            </div>
          </div>
        ) : (
          <ul className="card-grid pairs-grid" aria-label="Các bộ luyện">
            {visible.map((s) => {
              const m = setMastery(s, progress);
              const st = progress.sets[s.id];
              const info = PHENOMENON_INFO[s.phenomenon];
              const playedSet = !!st && st.plays > 0;
              const done = m.total > 0 && m.mastered === m.total;
              const pct = m.total ? (m.mastered / m.total) * 100 : 0;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className="item-card pairs-set"
                    disabled={!tts}
                    onClick={() => onStart({ kind: 'set', setId: s.id })}
                    aria-label={
                      `${s.title}. ${info.label}, ${s.items.length} câu` +
                      (playedSet ? `, đã thuộc ${m.mastered}/${m.total}, cao nhất ${percent(st.best)}%` : '') +
                      `. ${s.description}`
                    }
                  >
                    <span className="item-card-title" title={s.title}>
                      {s.title}
                    </span>
                    {/* Progress stays slim (count on the meta line, a thin bar under it) so unplayed
                        cards in the same row are not left with an empty band. */}
                    <span className="item-card-meta pairs-set-meta">
                      <span>
                        {info.label} · {s.items.length} câu
                      </span>
                      {playedSet && (
                        <span className="tabular" aria-hidden="true">
                          {m.mastered}/{m.total}
                        </span>
                      )}
                    </span>
                    {playedSet && (
                      <span
                        className={'progress pairs-set-bar' + (done ? ' is-done' : '')}
                        style={FLAT_ACCENT}
                        aria-hidden="true"
                      >
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className="how" open={!played}>
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Cách chơi
        </summary>
        <ul className="stack-sm pairs-howto">
          <li>Mỗi lượt tối đa {ROUND_SIZE} câu. Máy đọc một câu, bạn chọn câu mình nghe được.</li>
          <li>Trả lời xong, bấm từng câu để nghe so sánh và nhận ra chỗ khác.</li>
          <li>Câu sai được hỏi lại trong lượt và được ưu tiên ở lần sau.</li>
          <li>
            Tốc độ đọc chỉnh trong <a href={hrefFor('settings')}>Cài đặt</a>.
          </li>
        </ul>
      </details>
    </div>
  );
}
