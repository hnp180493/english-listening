// "Tạo câu luyện bằng AI" inside Câu của tôi: phenomenon (default = the learner's weakest), optional topic,
// level, count → preview (listen to each, checkboxes) → "Thêm N câu". Every sentence is checked by the decoder
// (it must really contain the chosen phenomenon) and for spelling, length, digits and duplicates before it is
// offered; when too few pass, the model gets one repair round with the reasons.
// Once a preview exists the settings fold into one summary line, so "Thêm N câu" stays near the list.

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PlayButton from '../../components/PlayButton';
import Segmented from '../../components/Segmented';
import { aiJson, useAiStatus } from '../../core/ai';
import {
  aiCacheKey,
  buildGeneratePrompt,
  cleanTopic,
  dropSummaryVi,
  generateAvoidList,
  generateRepairProblem,
  MAX_TOPIC_CHARS,
  PHENOMENON_VI,
  TOPIC_CHIPS,
  validateGenerated,
  type GeneratedItem,
  type GenCount,
  type GenerateRequest,
} from '../../core/aiTasks';
import { weakestPhenomenon } from '../../core/goals';
import { loadStats } from '../../core/stats';
import { PHENOMENA, type Level, type Phenomenon } from '../../core/types';
import { SENTENCES } from '../../data/sentences';
import { safeDecode } from '../dictation/decodeCache';
import { AiBusy, AiErrorLine, AiSetupLink } from './AiAction';
import { useAiTask } from './useAiTask';
import './ai.css';

const LEVELS = [
  { value: 1 as Level, label: 'Dễ' },
  { value: 2 as Level, label: 'Vừa' },
  { value: 3 as Level, label: 'Khó' },
];
const COUNTS = [
  { value: 5 as GenCount, label: '5 câu' },
  { value: 10 as GenCount, label: '10 câu' },
];

/** Raw items as the model returned them (validated against the CURRENT list on every render). */
interface GenRaw {
  items: { text: string; vi: string }[];
}

const annotate = (text: string) => safeDecode(text).annotations;
const BUILT_IN_TEXTS = SENTENCES.map((s) => s.text);

function defaultPhenomenon(): Phenomenon {
  try {
    return weakestPhenomenon(loadStats()) ?? 'linking';
  } catch {
    return 'linking';
  }
}

const toRaw = (v: unknown): GenRaw => {
  const items = v && typeof v === 'object' && Array.isArray((v as { items?: unknown }).items) ? (v as { items: unknown[] }).items : [];
  return {
    items: items.map((x) => {
      const r = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
      return { text: String(r.text ?? ''), vi: String(r.vi ?? '') };
    }),
  };
};

export default function AiGenerator({
  existing,
  onAdd,
  onClose,
}: {
  /** Texts of the learner's own sentences (built-in sentences are added here). */
  existing: readonly string[];
  onAdd: (items: GeneratedItem[]) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const status = useAiStatus();
  const [phenomenon, setPhenomenon] = useState<Phenomenon>(defaultPhenomenon);
  const weakest = useMemo(() => {
    try {
      return weakestPhenomenon(loadStats());
    } catch {
      return null;
    }
  }, []);
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<Level>(2);
  const [count, setCount] = useState<GenCount>(5);
  // the request the running / last answer belongs to (set when "Tạo câu" is pressed)
  const [asked, setAsked] = useState<GenerateRequest | null>(null);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  // the last good preview: stays on screen while "Tạo lại" runs or fails
  const [shown, setShown] = useState<{ req: GenerateRequest; raw: GenRaw } | null>(null);
  // settings folded into one line once a preview exists; "Đổi" opens them again
  const [editing, setEditing] = useState(true);

  const provider = status.text ? `${status.text.id}/${status.text.model}` : '';
  const key = asked && status.configured ? aiCacheKey('generate', { provider, ...asked }) : null;
  const allExisting = useMemo(() => [...existing, ...BUILT_IN_TEXTS], [existing]);

  const { state, start, cancel } = useAiTask<GenRaw>(key, async (signal) => {
    if (!asked) throw new Error('no request');
    const previous = shown && JSON.stringify(shown.req) === JSON.stringify(asked) ? shown.raw.items.map((x) => x.text) : [];
    const p = buildGeneratePrompt(asked, generateAvoidList(asked, existing, SENTENCES, previous));
    const check = (v: unknown) => validateGenerated(v, { phenomenon: asked.phenomenon, existing: allExisting, annotate, max: asked.count, level: asked.level });
    // one repair round with the reasons when too few sentences pass; the first answer's good sentences are kept
    const box: { first: GenRaw | null; rounds: number } = { first: null, rounds: 0 };
    const raw = await aiJson<unknown>(
      {
        system: p.system,
        messages: [{ role: 'user', content: p.user }],
        maxTokens: p.maxTokens,
        reasoning: 'off',
        json: { schema: p.schema, name: p.name },
        signal,
      },
      {
        validate: (v) => {
          box.rounds++;
          if (box.first) return null; // the repaired answer is taken as it is (validated again below)
          box.first = toRaw(v);
          return generateRepairProblem(check(v), asked.count, asked);
        },
      },
    );
    const last = toRaw(raw);
    // after a repair round, the first answer's good sentences count too (duplicates are dropped by validation)
    return { items: box.rounds > 1 && box.first ? [...box.first.items, ...last.items] : last.items };
  });

  // "Tạo câu" sets a new request; ask once its key is in place (a cached answer for it shows without a call)
  const wantRef = useRef(false);
  useEffect(() => {
    if (wantRef.current && key) {
      wantRef.current = false;
      start();
    }
  }, [key, start]);

  // a new answer becomes the preview; the settings fold away
  // (adjusted during render, React's "storing information from previous renders" pattern)
  const doneValue = state.status === 'done' ? state.value : null;
  if (doneValue && asked && shown?.raw !== doneValue) {
    setShown({ req: asked, raw: doneValue });
    setEditing(false);
  }

  const result = useMemo(() => {
    if (!shown) return null;
    return validateGenerated(shown.raw, {
      phenomenon: shown.req.phenomenon,
      existing: allExisting,
      annotate,
      max: shown.req.count,
      level: shown.req.level,
    });
  }, [shown, allExisting]);

  if (!status.configured) {
    return (
      <div className="panel dict-mgr-form">
        <p className="field-label">Tạo câu luyện bằng AI</p>
        <AiSetupLink what="Cần một nhà cung cấp AI" />
        <div className="dict-mgr-form-btns">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const busy = state.status === 'loading';
  const request: GenerateRequest = { phenomenon, topic: cleanTopic(topic), level, count };
  const sameAsShown = !!shown && JSON.stringify(shown.req) === JSON.stringify(request);
  const sameAsAsked = !!asked && JSON.stringify(asked) === JSON.stringify(request);
  const showFields = editing || !result;

  const generate = () => {
    if (busy) return;
    setUnchecked(new Set());
    if (sameAsAsked) {
      start({ force: sameAsShown }); // "Tạo lại": new sentences for the same settings (or retry after an error)
      return;
    }
    wantRef.current = true;
    setAsked(request);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    generate();
  };

  const chosen = result ? result.ok.filter((x) => !unchecked.has(x.text)) : [];
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      onClose();
    }
  };
  const close = () => {
    cancel();
    onClose();
  };
  const summary = shown
    ? [PHENOMENON_VI[shown.req.phenomenon], LEVELS.find((l) => l.value === shown.req.level)?.label, shown.req.topic].filter(Boolean).join(' · ')
    : '';

  return (
    <form className="panel dict-mgr-form ai-gen" onSubmit={submit} onKeyDown={onKey} aria-labelledby={`${uid}-h`}>
      <p id={`${uid}-h`} className="field-label">
        Tạo câu luyện bằng AI
      </p>
      {showFields ? (
        <div className="ai-gen-fields">
          <div className="ai-gen-row">
            <label className="ai-gen-field">
              <span className="meta">Hiện tượng</span>
              <select className="select" value={phenomenon} onChange={(e) => setPhenomenon(e.target.value as Phenomenon)}>
                {PHENOMENA.map((p) => (
                  <option key={p} value={p}>
                    {PHENOMENON_VI[p]}
                    {p === weakest ? ' (bạn hay sai nhất)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="ai-gen-field">
              <span className="meta" id={`${uid}-lv`}>
                Độ khó
              </span>
              <Segmented options={LEVELS} value={level} onChange={setLevel} ariaLabel="Độ khó" />
            </div>
            <div className="ai-gen-field">
              <span className="meta">Số câu</span>
              <Segmented options={COUNTS} value={count} onChange={setCount} ariaLabel="Số câu" />
            </div>
          </div>
          <div className="ai-gen-field">
            <label className="meta" htmlFor={`${uid}-topic`}>
              Chủ đề <span className="dict-opt">(không bắt buộc)</span>
            </label>
            <input
              id={`${uid}-topic`}
              className="input"
              value={topic}
              maxLength={MAX_TOPIC_CHARS}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ví dụ: phỏng vấn xin việc"
              autoComplete="off"
            />
            <div className="ai-gen-chips" role="group" aria-label="Chủ đề gợi ý">
              {TOPIC_CHIPS.map((t) => (
                <button key={t} type="button" className="chip" aria-pressed={topic === t} onClick={() => setTopic((cur) => (cur === t ? '' : t))}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="ai-gen-summary">
          <span>{summary}</span>
          <button type="button" className="ai-gen-change" onClick={() => setEditing(true)} disabled={busy}>
            Đổi
          </button>
        </p>
      )}

      {busy && (
        <div className="ai-action">
          <AiBusy text="AI đang viết câu…" onCancel={cancel} />
        </div>
      )}
      {state.status === 'error' && (
        <div className="ai-action">
          <AiErrorLine message={state.message} code={state.code} onRetry={() => start({ force: true })} />
        </div>
      )}

      {result && (
        <div className="ai-gen-result" aria-live="polite" aria-busy={busy || undefined}>
          {result.ok.length > 0 ? (
            <ul className="ai-gen-list">
              {result.ok.map((it) => (
                <li key={it.text} className="ai-gen-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={!unchecked.has(it.text)}
                      onChange={(e) =>
                        setUnchecked((cur) => {
                          const next = new Set(cur);
                          if (e.target.checked) next.delete(it.text);
                          else next.add(it.text);
                          return next;
                        })
                      }
                    />
                    <span className="ai-gen-text" lang="en">
                      {it.text}
                    </span>
                    {it.vi && <span className="ai-gen-vi">{it.vi}</span>}
                  </label>
                  <PlayButton text={it.text} size="sm" variant="ghost" title={`Nghe "${it.text}"`} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="ai-gen-drop">Không có câu nào đạt yêu cầu. Bấm “Tạo lại” để thử lần nữa.</p>
          )}
          {result.ok.length > 0 && shown && <p className="ai-gen-drop">{dropSummaryVi(result.ok.length, shown.req.count)}</p>}
        </div>
      )}

      <div className="ai-gen-btns">
        {result && result.ok.length > 0 && (
          <button type="button" className="btn btn-primary" disabled={chosen.length === 0 || busy} onClick={() => onAdd(chosen)}>
            Thêm {chosen.length} câu
          </button>
        )}
        {!busy && state.status !== 'error' && (
          <button type="submit" className={'btn ' + (result && !showFields ? 'btn-ghost' : 'btn-sm')}>
            <Icon icon={Sparkles} size={15} />
            {sameAsShown && result ? 'Tạo lại' : 'Tạo câu'}
          </button>
        )}
        {state.status === 'error' && !sameAsAsked && (
          <button type="submit" className="btn btn-sm">
            <Icon icon={Sparkles} size={15} />
            Tạo câu
          </button>
        )}
        <button type="button" className={'btn btn-ghost' + (result && !showFields ? '' : ' btn-sm')} onClick={close}>
          Đóng
        </button>
      </div>
      {!result && !busy && state.status !== 'error' && (
        <p className="dict-mgr-tip">App kiểm tra lại từng câu và chỉ giữ câu có đúng hiện tượng bạn chọn.</p>
      )}
    </form>
  );
}
