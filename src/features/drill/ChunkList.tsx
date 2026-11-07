import { useMemo, useState } from 'react';
import { RotateCcw, Search, Target } from 'lucide-react';
import { Icon } from '../../components/Icon';
import Segmented from '../../components/Segmented';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { cardStatus, type CardState, type CardStatus } from '../../core/srs';
import { PHENOMENA, type Chunk, type Phenomenon } from '../../core/types';
import { STATUS_LABEL } from './labels';
import ListenIcon from './ListenIcon';
import { dueInfo, sortChunks } from './listStats';

/** Rows rendered at first, and added by each "Xem thêm". */
const PAGE = 30;

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[‘’]/g, "'");
}

type StatusFilter = CardStatus | 'all';

export interface ChunkListProps {
  chunks: readonly Chunk[];
  cards: Readonly<Record<string, CardState | undefined>>;
  now: number;
  onReset: () => void;
  /** Pre-select this phenomenon filter (e.g. during a focus session). */
  initialFocus?: Phenomenon | null;
  /** Start a focus session for one phenomenon ("Luyện nhóm này"). */
  onPractice: (p: Phenomenon) => void;
}

/** The short gloss of a meaning: its first sentence ("Sẽ, định (làm gì)."), so a row never ends in a clipped "…". */
function gloss(meaning: string): string {
  return meaning.split(/(?<=[.!?])\s|\s—\s/)[0] ?? meaning;
}

export default function ChunkList({ chunks, cards, now, onReset, initialFocus = null, onPractice }: ChunkListProps) {
  const [query, setQuery] = useState('');
  const [phenomenon, setPhenomenon] = useState<Phenomenon | ''>(initialFocus ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [limit, setLimit] = useState(PAGE);

  const sorted = useMemo(() => sortChunks(chunks, cards, 'rank'), [chunks, cards]);

  const present = useMemo(() => {
    const set = new Set<Phenomenon>();
    for (const c of chunks) for (const p of c.phenomena) set.add(p);
    return PHENOMENA.filter((p) => set.has(p));
  }, [chunks]);

  const counts = useMemo(() => {
    const out: Record<CardStatus, number> = { new: 0, learning: 0, mature: 0 };
    for (const c of chunks) out[cardStatus(cards[c.id])] += 1;
    return out;
  }, [chunks, cards]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return sorted.filter((c) => {
      if (phenomenon && !c.phenomena.includes(phenomenon)) return false;
      if (statusFilter !== 'all' && cardStatus(cards[c.id]) !== statusFilter) return false;
      if (!q) return true;
      return [c.written, c.spoken, c.meaning, c.example].some((f) => fold(f ?? '').includes(q));
    });
  }, [sorted, query, phenomenon, statusFilter, cards]);

  // A new filter starts the list from the top again.
  const filterKey = `${query}|${phenomenon}|${statusFilter}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) {
    setLastKey(filterKey);
    setLimit(PAGE);
  }

  if (chunks.length === 0) {
    return (
      <div className="card empty-state">
        <h2>Chưa có cụm từ nào</h2>
        <p>Danh sách cụm từ đang được cập nhật. Bạn quay lại sau nhé.</p>
      </div>
    );
  }

  const hasStarted = counts.learning + counts.mature > 0;
  const anyFilter = query.trim() !== '' || phenomenon !== '' || statusFilter !== 'all';
  const shown = filtered.slice(0, limit);

  return (
    <div className="stack drill-list">
      <div className="toolbar drill-list-tools">
        <label className="toolbar-grow drill-search">
          <Icon icon={Search} size={17} className="drill-search-icon" />
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm cụm từ, nghĩa…"
            aria-label="Tìm cụm từ"
          />
        </label>
        <Segmented
          ariaLabel="Lọc theo trạng thái"
          value={statusFilter}
          onChange={setStatusFilter}
          className="drill-status-tabs"
          options={(['all', 'new', 'learning', 'mature'] as const).map((s) => ({
            value: s,
            label: s === 'all' ? 'Tất cả' : STATUS_LABEL[s],
            // Progress counts only: "Mới 192" or "Tất cả 192" is no information.
            count: s === 'learning' || s === 'mature' ? counts[s] : undefined,
          }))}
        />
        {present.length > 0 && (
          <div className="toolbar-end drill-list-end">
            <select
              className="select drill-ph-select"
              aria-label="Lọc theo hiện tượng"
              value={phenomenon}
              onChange={(e) => setPhenomenon(e.target.value as Phenomenon | '')}
            >
              <option value="">Mọi hiện tượng</option>
              {present.map((p) => (
                <option key={p} value={p}>
                  {PHENOMENON_INFO[p].label}
                </option>
              ))}
            </select>
            {phenomenon && (
              <button type="button" className="btn btn-soft drill-practice" onClick={() => onPractice(phenomenon)}>
                <Icon icon={Target} size={15} />
                Luyện nhóm này
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">
          <p>Không tìm thấy cụm nào phù hợp với bộ lọc.</p>
          {anyFilter && (
            <div className="row">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setQuery('');
                  setPhenomenon('');
                  setStatusFilter('all');
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      ) : (
        <ul className="list-rows drill-rows" aria-label="Danh sách cụm từ">
          {shown.map((c) => {
            const st = cards[c.id];
            const due = st ? dueInfo(st, now) : null;
            const isDue = due?.tone === 'due' || due?.tone === 'overdue';
            return (
              <li key={c.id}>
                <div className="list-row drill-row">
                  <div className="list-row-body">
                    <div className="list-row-title">
                      <span className="list-row-text" lang="en">
                        {c.written}
                        {c.spoken !== c.written && (
                          <>
                            <span className="respell-sep" aria-hidden="true">
                              →
                            </span>
                            <span className="sr-only">, đọc là </span>
                            <span className="respell">{c.spoken}</span>
                          </>
                        )}
                      </span>
                      {isDue && <span className="badge">Đến hạn</span>}
                    </div>
                    {c.meaning && (
                      <div className="list-row-meta drill-row-gloss" title={c.meaning}>
                        {gloss(c.meaning)}
                      </div>
                    )}
                  </div>
                  <div className="list-row-end">
                    <ListenIcon text={c.ttsText} label={`Nghe: ${c.written}`} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > shown.length && (
        <button type="button" className="btn btn-ghost list-more" onClick={() => setLimit((n) => n + PAGE)}>
          Xem thêm
        </button>
      )}

      {hasStarted && (
        <div className="drill-reset-wrap">
          <button
            type="button"
            className="btn btn-danger btn-sm drill-reset"
            onClick={() => {
              if (window.confirm('Xóa toàn bộ tiến độ học cụm từ? Thao tác này không hoàn tác được.')) onReset();
            }}
          >
            <Icon icon={RotateCcw} size={14} />
            Đặt lại tiến độ cụm từ
          </button>
        </div>
      )}
    </div>
  );
}
