import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronRight, Lightbulb, Play, Search, SearchX, TriangleAlert } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { looksVietnamese, sanitizeCustom } from '../../core/dictation/custom';
import { navigate } from '../../core/nav';
import { KEYS, loadJSON } from '../../core/storage';
import type { Level } from '../../core/types';
import { CHUNKS } from '../../data/chunks';
import { SENTENCES } from '../../data/sentences';
import { CUSTOM_EXAMPLES, MAX_CUSTOM_LENGTH, cleanCustomText, filterChunks, filterSentences, type ShadowSource } from './sources';
import { customItemId, recentCustom, toPercent, type ShadowState } from './store';

/** Sentences the learner added in "Chép chính tả" (newest first), minus ones listed elsewhere. */
function loadDictationCustom(exclude: ReadonlySet<string>, limit: number): { id: string; text: string; vi: string }[] {
  try {
    return sanitizeCustom(loadJSON<unknown>(KEYS.customSentences, []))
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((c) => !exclude.has(customItemId(cleanCustomText(c.text))))
      .slice(0, limit)
      .map((c) => ({ id: c.id, text: c.text, vi: c.vi }));
  } catch {
    return [];
  }
}

type Tab = 'sentences' | 'chunks' | 'custom';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sentences', label: 'Câu luyện' },
  { id: 'chunks', label: 'Cụm từ' },
  { id: 'custom', label: 'Tự nhập' },
];

const LEVELS: { id: Level | 0; label: string }[] = [
  { id: 0, label: 'Mọi độ khó' },
  { id: 1, label: 'Dễ' },
  { id: 2, label: 'Vừa' },
  { id: 3, label: 'Khó' },
];

/** Rows rendered at first, and added by each "Xem thêm". */
const PAGE = 20;


function tabFor(source: ShadowSource | null): Tab {
  if (!source) return 'sentences';
  return source.kind === 'chunk' ? 'chunks' : source.kind === 'custom' ? 'custom' : 'sentences';
}

/** Best score as plain muted text right after the title ("82%"); nothing before the first take. */
function Best({ history, id }: { history: ShadowState; id: string }) {
  const item = history[id];
  if (!item) return null;
  const p = toPercent(item.best);
  return (
    <span className="meta shadow-best" title={`Cao nhất ${p}% · ${item.total} lần`}>
      {p}%
    </span>
  );
}

/** How many rows to render: a page, grown by "Xem thêm", and always enough to include the open item. */
function shownCount(limit: number, ids: readonly string[], selectedId: string | null): number {
  const at = selectedId ? ids.indexOf(selectedId) : -1;
  return Math.max(limit, at + 1);
}

interface SourcePickerProps {
  source: ShadowSource | null;
  history: ShadowState;
  /** Visible right now (the list is kept mounted while folded away). Unused since the list has no scroll box. */
  open: boolean;
  /** Called on every pick, so the page can fold the list even when the source does not change. */
  onPick?: () => void;
}

export default function SourcePicker({ source, history, onPick }: SourcePickerProps) {
  // Picking the item that is already open changes no hash (no hashchange), so the page
  // could not tell; tell it directly.
  const pick = (params: { id: string } | { text: string }) => {
    onPick?.();
    navigate('shadowing', params);
  };
  const uid = useId();
  const [tab, setTab] = useState<Tab>(() => tabFor(source));
  const [level, setLevel] = useState<Level | 0>(() => source?.level ?? 0);
  const [query, setQuery] = useState('');
  const [chunkQuery, setChunkQuery] = useState('');
  const [custom, setCustom] = useState(() => (source?.kind === 'custom' ? source.text : ''));
  const [limit, setLimit] = useState(PAGE);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedId = source && source.kind !== 'custom' ? source.itemId : null;

  // Follow route changes (e.g. "Câu tiếp" or a link from another page).
  const [prevSource, setPrevSource] = useState(source);
  if (prevSource !== source) {
    setPrevSource(source);
    if (source && source.kind !== prevSource?.kind) setTab(tabFor(source));
    if (source?.kind === 'custom') setCustom(source.text);
    if (source?.kind === 'sentence' && source.level && level !== 0 && level !== source.level) setLevel(source.level);
  }

  const sentences = useMemo(() => filterSentences(SENTENCES, { level, query }), [level, query]);
  const chunks = useMemo(() => filterChunks(CHUNKS, chunkQuery), [chunkQuery]);

  // A new tab, filter or search starts the list from the top again.
  const listKey = `${tab}|${level}|${query}|${chunkQuery}`;
  const [lastListKey, setLastListKey] = useState(listKey);
  if (lastListKey !== listKey) {
    setLastListKey(listKey);
    setLimit(PAGE);
  }
  const sentenceCount = shownCount(limit, sentences.map((x) => x.id), selectedId);
  const chunkCount = shownCount(limit, chunks.map((x) => x.id), selectedId);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  const cleanedCustom = cleanCustomText(custom);
  const customOk = /[a-zA-Z]/.test(cleanedCustom);
  const customVi = customOk && looksVietnamese(cleanedCustom);
  const recent = useMemo(() => recentCustom(history, 6), [history]);
  const mine = useMemo(() => loadDictationCustom(new Set(recent.map((r) => r.id)), 6), [recent]);
  const submitCustom = () => {
    if (customOk && !customVi) pick({ text: cleanedCustom });
  };

  return (
    <section className="card shadow-picker" aria-label="Chọn câu để luyện">
      <h2 className="shadow-h2 shadow-picker-title">Chọn câu</h2>
      <div className="seg shadow-tabs" role="tablist" aria-label="Nguồn câu">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.id}`}
            aria-controls={`${uid}-panel-${t.id}`}
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            className="seg-btn shadow-tab"
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sentences' && (
        <div role="tabpanel" id={`${uid}-panel-sentences`} aria-labelledby={`${uid}-tab-sentences`} className="shadow-tabpanel">
          <div className="toolbar shadow-filters">
            <div className="toolbar-grow shadow-search-wrap">
              <Icon icon={Search} size={16} className="shadow-search-icon" />
              <label className="sr-only" htmlFor={`${uid}-q`}>
                Tìm câu
              </label>
              <input
                id={`${uid}-q`}
                type="search"
                className="input shadow-search"
                placeholder="Tìm câu, nghĩa, chủ đề…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <select
              className="select shadow-level"
              aria-label="Lọc theo độ khó"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value) as Level | 0)}
            >
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          {sentences.length === 0 ? (
            <div className="shadow-empty">
              <Icon icon={SearchX} size={22} className="shadow-empty-icon" />
              <p>Không có câu nào khớp “{query}”.</p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setQuery('');
                  setLevel(0);
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <ul className="shadow-list">
              {sentences.slice(0, sentenceCount).map((s) => {
                const on = s.id === selectedId;
                return (
                  <li key={s.id} data-id={s.id}>
                    <button
                      type="button"
                      className={'shadow-item' + (on ? ' is-on' : '')}
                      aria-current={on ? 'true' : undefined}
                      onClick={() => pick({ id: s.id })}
                    >
                      <span className="shadow-item-body">
                        <span className="shadow-item-line">
                          <span className="shadow-item-text" lang="en">
                            {s.text}
                          </span>
                          <Best history={history} id={s.id} />
                        </span>
                        <span className="shadow-item-vi">{s.vi}</span>
                      </span>
                      <Icon icon={ChevronRight} size={18} className="shadow-item-end" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {sentences.length > sentenceCount && (
            <button type="button" className="btn btn-ghost list-more" onClick={() => setLimit((n) => n + PAGE)}>
              Xem thêm
            </button>
          )}
        </div>
      )}

      {tab === 'chunks' && (
        <div role="tabpanel" id={`${uid}-panel-chunks`} aria-labelledby={`${uid}-tab-chunks`} className="shadow-tabpanel">
          <div className="shadow-search-wrap">
            <Icon icon={Search} size={16} className="shadow-search-icon" />
            <label className="sr-only" htmlFor={`${uid}-cq`}>
              Tìm cụm từ
            </label>
            <input
              id={`${uid}-cq`}
              type="search"
              className="input shadow-search"
              placeholder="Tìm: gonna, want to, muốn…"
              value={chunkQuery}
              onChange={(e) => setChunkQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {chunks.length === 0 ? (
            <div className="shadow-empty">
              <Icon icon={SearchX} size={22} className="shadow-empty-icon" />
              <p>{CHUNKS.length === 0 ? 'Chưa có cụm từ nào.' : `Không có cụm nào khớp “${chunkQuery}”.`}</p>
              {chunkQuery && (
                <button type="button" className="btn btn-sm" onClick={() => setChunkQuery('')}>
                  Xóa tìm kiếm
                </button>
              )}
            </div>
          ) : (
            <ul className="shadow-list">
              {chunks.slice(0, chunkCount).map((c) => {
                const on = c.id === selectedId;
                return (
                  <li key={c.id} data-id={c.id}>
                    <button
                      type="button"
                      className={'shadow-item' + (on ? ' is-on' : '')}
                      aria-current={on ? 'true' : undefined}
                      onClick={() => pick({ id: c.id })}
                    >
                      <span className="shadow-item-body">
                        <span className="shadow-item-line">
                          <span className="shadow-item-text" lang="en">
                            {c.written}
                            <span className="respell-sep" aria-hidden="true">
                              →
                            </span>
                            <span className="respell">{c.spoken}</span>
                          </span>
                          <Best history={history} id={c.id} />
                        </span>
                        <span className="shadow-item-vi" lang="en">
                          {c.example}
                        </span>
                      </span>
                      <Icon icon={ChevronRight} size={18} className="shadow-item-end" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {chunks.length > chunkCount && (
            <button type="button" className="btn btn-ghost list-more" onClick={() => setLimit((n) => n + PAGE)}>
              Xem thêm
            </button>
          )}
        </div>
      )}

      {tab === 'custom' && (
        <div role="tabpanel" id={`${uid}-panel-custom`} aria-labelledby={`${uid}-tab-custom`} className="shadow-tabpanel">
          <label htmlFor={`${uid}-custom`} className="field-label">
            Câu tiếng Anh bạn muốn luyện nói
          </label>
          <textarea
            id={`${uid}-custom`}
            className="textarea shadow-custom"
            rows={3}
            maxLength={MAX_CUSTOM_LENGTH}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submitCustom();
              }
            }}
            placeholder="Ví dụ: I'm going to grab a cup of coffee."
            spellCheck={false}
            autoCapitalize="off"
            lang="en"
          />
          <div className="row shadow-custom-actions">
            <button
              type="button"
              className="btn btn-soft"
              onClick={submitCustom}
              disabled={!customOk || customVi}
              aria-keyshortcuts="Control+Enter"
              title="Luyện câu này (Ctrl + Enter)"
            >
              <Icon icon={Play} size={15} fill="currentColor" strokeWidth={1.5} />
              Luyện câu này
            </button>
            <span className="meta">
              {custom.length}/{MAX_CUSTOM_LENGTH}
            </span>
          </div>
          {custom.trim() && !customOk && (
            <p className="callout callout-warn">
              <Icon icon={TriangleAlert} size={16} />
              <span>Hãy nhập một câu tiếng Anh (có chữ cái).</span>
            </p>
          )}
          {customVi && (
            <p className="callout callout-warn">
              <Icon icon={TriangleAlert} size={16} />
              <span>Câu này có vẻ là tiếng Việt. Máy đọc mẫu và chấm điểm bằng tiếng Anh, nên hãy nhập câu tiếng Anh.</span>
            </p>
          )}
          {recent.length > 0 && (
            <div className="shadow-mine">
              <h3 className="shadow-h4">Câu bạn tự nhập gần đây</h3>
              <ul className="shadow-mine-list">
                {recent.map((r) => {
                  const on = source?.itemId === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className={'shadow-item' + (on ? ' is-on' : '')}
                        aria-current={on ? 'true' : undefined}
                        onClick={() => pick({ text: r.text })}
                      >
                        <span className="shadow-item-line">
                          <span className="shadow-item-text shadow-item-text--sm" lang="en">
                            {r.text}
                          </span>
                          <Best history={history} id={r.id} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {mine.length > 0 && (
            <div className="shadow-mine">
              <h3 className="shadow-h4">Câu của tôi (từ Chép chính tả)</h3>
              <ul className="shadow-mine-list">
                {mine.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="shadow-item" onClick={() => pick({ text: c.text })}>
                      <span className="shadow-item-text shadow-item-text--sm" lang="en">
                        {c.text}
                      </span>
                      {c.vi && <span className="shadow-item-vi">{c.vi}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="shadow-mine">
            <h3 className="shadow-h4">Gợi ý: bấm để điền</h3>
            <div className="shadow-examples">
              {CUSTOM_EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="shadow-example" lang="en" onClick={() => setCustom(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <p className="callout shadow-tip">
            <Icon icon={Lightbulb} size={16} />
            <span>Chép một câu từ phim, podcast hay bài hát bạn thích. Câu 5–12 từ luyện hiệu quả nhất.</span>
          </p>
        </div>
      )}
    </section>
  );
}
