import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { BookmarkPlus, ChevronDown, ClipboardPaste, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import PlayButton from '../../components/PlayButton';
import {
  addCustom,
  CUSTOM_ERROR_TEXT,
  estimateLevel,
  MAX_CUSTOM,
  MAX_TEXT_CHARS,
  MAX_VI_CHARS,
  parseBulk,
  removeCustom,
  updateCustom,
  validateCustomText,
  wordCount,
  type CustomSentence,
} from '../../core/dictation/custom';
import type { ProgressMap } from '../../core/dictation/progress';
import { LEVEL_LABEL } from './constants';
import { annotationCount, detectedPhenomena } from './decodeCache';
import { scrollBehavior } from '../../core/motion';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { PhenomenonChips } from './WhyWrong';
import AiGenerator from '../ai/AiGenerator';
import type { GeneratedItem } from '../../core/aiTasks';
import { useAiStatus } from '../../core/ai';

type Form = { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'bulk' } | { kind: 'ai' } | null;

const SEARCH_FROM = 6; // show the search box once the list is this long
const PAGE = 20; // rows shown at first, then "Xem thêm" adds as many

/** Live preview of how a typed sentence will be practised. */
function Preview({ text }: { text: string }) {
  const clean = text.trim();
  const phen = useMemo(() => (clean ? detectedPhenomena(clean) : []), [clean]);
  if (!clean || !/[a-z]/i.test(clean)) return null;
  const level = estimateLevel(wordCount(clean), annotationCount(clean));
  return (
    <div className="dict-mgr-preview" aria-live="polite">
      <span className="badge">{LEVEL_LABEL[level]}</span>
      {phen.length > 0 ? (
        <PhenomenonChips list={phen} />
      ) : (
        <span className="muted">Chưa thấy chỗ nối âm nào, câu vẫn dùng để chép được.</span>
      )}
    </div>
  );
}

export default function CustomManager({
  list,
  progress,
  onChange,
  onPractice,
  defaultOpen,
}: {
  list: CustomSentence[];
  progress: ProgressMap;
  onChange: (next: CustomSentence[], removedId?: string) => void;
  onPractice: (id: string) => void;
  defaultOpen: boolean;
}) {
  const uid = useId();
  // "Tạo bằng AI" only with a configured AI provider: without one the manager looks exactly as before
  const aiReady = useAiStatus().configured;
  const [open, setOpen] = useState(defaultOpen);
  // the form opens only on request (an empty list shows one "Thêm câu" action instead)
  const [form, setForm] = useState<Form>(null);
  const [limit, setLimit] = useState(PAGE);
  const [text, setText] = useState('');
  const [vi, setVi] = useState('');
  const [bulk, setBulk] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);
  const initialFormRef = useRef(form);
  const emptyAddRef = useRef<HTMLButtonElement>(null);
  const refocusRef = useRef(false);

  // focus the form when the learner opens it (not on first render: no keyboard pop-up on page load); closing it
  // on an empty list returns focus to the empty state's "Thêm câu"
  useEffect(() => {
    if (!form && refocusRef.current) {
      refocusRef.current = false;
      emptyAddRef.current?.focus({ preventScroll: true });
      return;
    }
    if (form === initialFormRef.current) return;
    const el = firstFieldRef.current;
    if (!form || !el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
  }, [form]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  const openForm = (f: Form) => {
    setError(null);
    setConfirmId(null);
    if (f?.kind === 'edit') {
      const c = list.find((x) => x.id === f.id);
      setText(c?.text ?? '');
      setVi(c?.vi ?? '');
      setOpen(true);
    } else if (f?.kind === 'add') {
      setText('');
      setVi('');
    } else if (f?.kind === 'bulk') {
      setBulk('');
    }
    setForm(f);
  };

  const closeForm = () => {
    refocusRef.current = true;
    setForm(null);
    setError(null);
  };

  const submitOne = (e: FormEvent) => {
    e.preventDefault();
    if (!form || form.kind === 'bulk' || form.kind === 'ai') return;
    if (form.kind === 'add') {
      const r = addCustom(list, [{ text, vi }], Date.now(), annotationCount);
      if (r.rejected.length) {
        setError(CUSTOM_ERROR_TEXT[r.rejected[0].error]);
        return;
      }
      onChange(r.list);
      setFlash(`Đã thêm: “${r.added[0]?.text ?? ''}”`);
      setText('');
      setVi('');
      setError(null);
      firstFieldRef.current?.focus();
    } else {
      const r = updateCustom(list, form.id, { text, vi }, annotationCount);
      if (r.error) {
        setError(CUSTOM_ERROR_TEXT[r.error]);
        return;
      }
      onChange(r.list);
      setFlash('Đã lưu thay đổi.');
      closeForm();
    }
  };

  const bulkItems = useMemo(() => parseBulk(bulk), [bulk]);
  const bulkLines = useMemo(() => bulk.split(/\r?\n/).filter((l) => /[\p{L}\p{N}]/u.test(l)).length, [bulk]);
  const bulkValid = useMemo(() => {
    let acc = list;
    let ok = 0;
    for (const item of bulkItems) {
      if (validateCustomText(item.text, acc)) continue;
      ok++;
      acc = [...acc, { id: `tmp${ok}`, text: item.text, vi: '', level: 1, createdAt: 0 }];
    }
    return ok;
  }, [bulkItems, list]);

  const submitBulk = (e: FormEvent) => {
    e.preventDefault();
    const r = addCustom(list, bulkItems, Date.now(), annotationCount);
    if (r.added.length === 0) {
      setError(bulkLines ? 'Không có câu mới hợp lệ (trùng hoặc không phải tiếng Anh).' : 'Hãy dán ít nhất một câu.');
      return;
    }
    onChange(r.list);
    const skipped = Math.max(0, bulkLines - r.added.length);
    setFlash(`Đã thêm ${r.added.length} câu${skipped ? `, bỏ qua ${skipped} dòng trùng hoặc không hợp lệ` : ''}.`);
    setOpen(true);
    closeForm();
  };

  const addGenerated = (items: GeneratedItem[]) => {
    const r = addCustom(list, items, Date.now(), annotationCount);
    if (r.added.length === 0) {
      setError(r.rejected[0] ? CUSTOM_ERROR_TEXT[r.rejected[0].error] : 'Không có câu mới để thêm.');
      return;
    }
    onChange(r.list);
    setFlash(`Đã thêm ${r.added.length} câu do AI tạo${r.rejected.length ? `, bỏ qua ${r.rejected.length} câu` : ''}.`);
    setOpen(true);
    closeForm();
  };

  const onFormKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeForm();
    }
  };

  const remove = (id: string) => {
    onChange(removeCustom(list, id), id);
    setConfirmId(null);
    setFlash('Đã xóa câu.');
  };

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
    return q ? sorted.filter((c) => c.text.toLowerCase().includes(q) || c.vi.toLowerCase().includes(q)) : sorted;
  }, [list, q]);

  const listId = `${uid}-list`;
  // with sentences the exercise above holds the page's one gradient button; the form's submit is a soft one
  const submitClass = 'btn btn-sm ' + (list.length === 0 ? 'btn-primary' : 'btn-soft');
  const editing = form?.kind === 'edit' ? form.id : null;

  return (
    <section className={'card dict-mgr' + (list.length === 0 && !form ? ' empty-state' : '')} aria-labelledby={`${uid}-title`}>
      {list.length === 0 && !form ? (
        <>
          <IconTile icon={BookmarkPlus} tint="var(--text-muted)" size="lg" />
          <h2 id={`${uid}-title`}>Chưa có câu nào của bạn</h2>
          <p>Thêm câu bạn gặp trong phim, podcast hay công việc để luyện nghe.</p>
          <div className="row">
            <button ref={emptyAddRef} type="button" className="btn btn-primary" onClick={() => openForm({ kind: 'add' })}>
              <Icon icon={Plus} size={16} />
              Thêm câu
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => openForm({ kind: 'bulk' })}>
              <Icon icon={ClipboardPaste} size={16} />
              Dán nhiều câu
            </button>
            {aiReady && (
              <button type="button" className="btn btn-ghost" onClick={() => openForm({ kind: 'ai' })}>
                <Icon icon={Sparkles} size={16} />
                Tạo bằng AI
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="dict-mgr-head">
          <h2 id={`${uid}-title`} className="dict-mgr-title">
            Câu của tôi {list.length > 0 && <span className="meta">· {list.length} câu</span>}
          </h2>
          <div className={'dict-mgr-btns' + (aiReady ? ' has-ai' : '')}>
            <button
              type="button"
              className="btn btn-sm btn-soft"
              onClick={() => openForm({ kind: 'add' })}
              disabled={list.length >= MAX_CUSTOM}
            >
              <Icon icon={Plus} size={15} />
              Thêm câu
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => openForm({ kind: 'bulk' })}
              disabled={list.length >= MAX_CUSTOM}
              aria-pressed={form?.kind === 'bulk'}
              title="Dán nhiều câu"
            >
              <Icon icon={ClipboardPaste} size={15} />
              <span className="dict-mgr-btn-label">Dán nhiều câu</span>
            </button>
            {aiReady && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => openForm({ kind: 'ai' })}
                disabled={list.length >= MAX_CUSTOM}
                aria-pressed={form?.kind === 'ai'}
                title="Tạo bằng AI"
              >
                <Icon icon={Sparkles} size={15} />
                <span className="dict-mgr-btn-label">Tạo bằng AI</span>
              </button>
            )}
            {list.length > 0 && (
              <button
                type="button"
                className={'btn btn-sm btn-ghost dict-mgr-toggle' + (open ? ' is-open' : '')}
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen((v) => !v)}
              >
                <Icon icon={ChevronDown} size={15} />
                <span className="dict-mgr-toggle-text">{open ? 'Ẩn danh sách' : 'Xem danh sách'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="dict-mgr-flash" role="status" aria-live="polite">
        {flash}
      </div>

      {(form?.kind === 'add' || form?.kind === 'edit') && (
        <form className="panel dict-mgr-form" onSubmit={submitOne} onKeyDown={onFormKey}>
          <label className="field-label" htmlFor={`${uid}-en`}>
            {form.kind === 'add' ? 'Câu tiếng Anh' : 'Sửa câu tiếng Anh'} <span className="dict-req">*</span>
          </label>
          <textarea
            id={`${uid}-en`}
            ref={firstFieldRef}
            className="textarea dict-mgr-en"
            lang="en"
            rows={2}
            value={text}
            maxLength={MAX_TEXT_CHARS + 50}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ví dụ: I was going to call you, but I forgot."
            aria-invalid={!!error}
            aria-describedby={error ? `${uid}-err` : undefined}
            autoComplete="off"
            spellCheck
          />
          <label className="field-label dict-mgr-label2" htmlFor={`${uid}-vi`}>
            Nghĩa tiếng Việt <span className="dict-opt">(không bắt buộc)</span>
          </label>
          <input
            id={`${uid}-vi`}
            className="input"
            value={vi}
            maxLength={MAX_VI_CHARS}
            onChange={(e) => setVi(e.target.value)}
            placeholder="Ví dụ: Mình định gọi cho bạn mà quên mất."
            autoComplete="off"
          />
          <Preview text={text} />
          {error && (
            <p id={`${uid}-err`} className="dict-mgr-err" role="alert">
              {error}
            </p>
          )}
          <div className="dict-mgr-form-btns">
            <button type="submit" className={submitClass}>
              {form.kind === 'add' ? 'Thêm' : 'Lưu'}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={closeForm}>
              {form.kind === 'add' ? 'Đóng' : 'Hủy'}
            </button>
          </div>
        </form>
      )}

      {form?.kind === 'bulk' && (
        <form className="panel dict-mgr-form" onSubmit={submitBulk} onKeyDown={onFormKey}>
          <label className="field-label" htmlFor={`${uid}-bulk`}>
            Dán nhiều câu, mỗi dòng một câu
          </label>
          <textarea
            id={`${uid}-bulk`}
            ref={firstFieldRef}
            className="textarea dict-mgr-bulk"
            lang="en"
            rows={6}
            value={bulk}
            onChange={(e) => {
              setBulk(e.target.value);
              if (error) setError(null);
            }}
            placeholder={'Turn it off, please.\nWhat do you want to do? | Bạn muốn làm gì?\n- I could have told you.'}
            aria-describedby={`${uid}-bulk-help`}
          />
          <p id={`${uid}-bulk-help`} className="dict-mgr-tip">
            Ghi nghĩa sau dấu <code>|</code> hoặc phím Tab. Gạch đầu dòng, số thứ tự và câu trùng được bỏ qua.
          </p>
          {bulkItems.length > 0 && (
            <p className="dict-mgr-count" aria-live="polite">
              Sẽ thêm <b>{bulkValid}</b> câu
              {bulkLines - bulkValid > 0 ? ` · bỏ qua ${bulkLines - bulkValid} dòng trùng/không hợp lệ` : ''}
            </p>
          )}
          {error && (
            <p className="dict-mgr-err" role="alert">
              {error}
            </p>
          )}
          <div className="dict-mgr-form-btns">
            <button type="submit" className={submitClass} disabled={bulkValid === 0}>
              Thêm {bulkValid > 0 ? bulkValid : ''} câu
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={closeForm}>
              Hủy
            </button>
          </div>
        </form>
      )}

      {form?.kind === 'ai' && (
        <>
          <AiGenerator existing={list.map((c) => c.text)} onAdd={addGenerated} onClose={closeForm} />
          {error && (
            <p className="dict-mgr-err" role="alert">
              {error}
            </p>
          )}
        </>
      )}

      {list.length > 0 && open && (
        <div id={listId} className="dict-mgr-listwrap">
          {list.length >= SEARCH_FROM && (
            <div className="dict-mgr-searchwrap">
              <Icon icon={Search} size={16} className="dict-mgr-search-icon" />
              <input
                type="search"
                className="input dict-mgr-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm câu…"
                aria-label="Tìm trong câu của tôi"
              />
            </div>
          )}
          {shown.length === 0 ? (
            <p className="muted">Không có câu nào khớp “{query}”.</p>
          ) : (
            <ul className="dict-mgr-list">
              {shown.slice(0, limit).map((c) => {
                const p = progress[c.id];
                const phen = detectedPhenomena(c.text);
                const meta = [
                  LEVEL_LABEL[c.level],
                  phen
                    .slice(0, 2)
                    .map((ph) => PHENOMENON_INFO[ph]?.label ?? ph)
                    .join(', '),
                  p?.attempts ? `tốt nhất ${Math.round(p.best * 100)}%` : '',
                ].filter(Boolean);
                return (
                  <li key={c.id} className={'dict-mgr-item' + (editing === c.id ? ' is-editing' : '')}>
                    <div className="dict-mgr-item-main">
                      <p className="dict-mgr-text" lang="en">
                        {c.text}
                      </p>
                      {c.vi && <p className="dict-mgr-vi muted">{c.vi}</p>}
                      <p className="meta dict-mgr-meta">{meta.join(' · ')}</p>
                    </div>
                    {confirmId === c.id ? (
                      <div className="dict-mgr-actions dict-mgr-confirm" role="group" aria-label="Xác nhận xóa">
                        <span>Xóa câu này?</span>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(c.id)}>
                          <Icon icon={Trash2} size={15} />
                          Xóa
                        </button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmId(null)} autoFocus>
                          Không
                        </button>
                      </div>
                    ) : (
                      <div className="dict-mgr-actions">
                        <PlayButton text={c.text} size="sm" label="Nghe" variant="ghost" />
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onPractice(c.id)}>
                          Luyện
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-icon"
                          onClick={() => openForm({ kind: 'edit', id: c.id })}
                          aria-label={`Sửa câu: ${c.text}`}
                          title="Sửa"
                        >
                          <Icon icon={Pencil} size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-icon dict-mgr-del"
                          onClick={() => setConfirmId(c.id)}
                          aria-label={`Xóa câu: ${c.text}`}
                          title="Xóa"
                        >
                          <Icon icon={Trash2} size={15} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {shown.length > limit && (
            <button type="button" className="btn btn-ghost list-more" onClick={() => setLimit((n) => n + PAGE)}>
              Xem thêm
            </button>
          )}
        </div>
      )}
    </section>
  );
}
