import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ArrowRight, Check, LoaderCircle, Play, TriangleAlert, VolumeX } from 'lucide-react';
import { PENDING_LABEL } from '../../components/pendingLabel';
import { Icon } from '../../components/Icon';
import { MAX_PLAYS } from '../../core/benchmark';
import { prefetchSpeech } from '../../core/tts';
import type { BenchmarkForm } from '../../data/benchmarkTypes';
import {
  advance,
  blocker,
  choose,
  chosenOf,
  currentItem,
  nextLabel,
  optionOrder,
  playLabel,
  playsLeft,
  playsUsed,
  progressPct,
  recordPlay,
  setTyped,
  stepLabel,
  typedOf,
  type TestState,
} from './checkupModel';
import { useCheckupAudio } from './useCheckupAudio';

/** Ignore a second "next" within this window (held or double Enter). */
const NEXT_GUARD_MS = 350;

function isCoarse(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export default function CheckupTest({
  form,
  state,
  voiceName,
  resumed,
  onChange,
  onFinish,
  onAbandon,
}: {
  form: BenchmarkForm;
  state: TestState;
  voiceName: string | null;
  resumed: boolean;
  onChange: (next: TestState) => void;
  onFinish: (final: TestState) => void;
  onAbandon: () => void;
}) {
  const item = currentItem(state, form);
  const audio = useCheckupAudio();
  const { stop } = audio;
  const [nudgeFor, setNudgeFor] = useState<string | null>(null); // the item the empty-answer nudge is for
  const [confirmQuit, setConfirmQuit] = useState(false);
  const lastNext = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const headRef = useRef<HTMLHeadingElement>(null);
  const id = item ? (item.kind === 'sentence' ? item.sentence.id : item.question.id) : '';
  const [resumedAt] = useState(id); // the "resumed" note shows on the first item only
  const nudge = nudgeFor === id && !!id;
  const setNudge = (on: boolean) => setNudgeFor(on ? id : null);

  // A new item: stop the audio, put focus where the work is.
  useEffect(() => {
    stop();
    if (isCoarse()) return;
    if (inputRef.current) inputRef.current.focus({ preventScroll: true });
    else headRef.current?.focus({ preventScroll: true });
  }, [id, stop]);

  // AI voice: generate this item's audio and the next one's in the background (no-op with the browser voice).
  const linesOf = (it: ReturnType<typeof currentItem>) => (!it ? [] : it.kind === 'sentence' ? [it.sentence.text] : it.question.lines);
  const after = advance(state, form);
  const upcoming = [...linesOf(item), ...(after.done ? [] : linesOf(currentItem(after.state, form)))].join('\n');
  useEffect(() => {
    if (upcoming) prefetchSpeech(upcoming.split('\n'));
  }, [upcoming]);

  const used = playsUsed(state, form);
  const left = playsLeft(state, form);
  const isPlaying = audio.playing === id && !!id;
  const block = blocker(state, form);

  const listen = () => {
    if (!item || isPlaying || !audio.canSpeak) return;
    const next = recordPlay(state, form, voiceName);
    if (!next) return;
    onChange(next); // saved before speaking: a reload never gives a free play
    setNudge(false);
    void audio.play(id, item.kind === 'sentence' ? [item.sentence.text] : item.question.lines);
  };

  const goNext = (force = false) => {
    const now = Date.now();
    if (now - lastNext.current < NEXT_GUARD_MS) return;
    if (block === 'not-played') {
      listen();
      return;
    }
    if (block === 'empty' && !nudge && !force) {
      setNudge(true);
      return;
    }
    lastNext.current = now;
    stop();
    const { state: next, done } = advance(state, form);
    if (done) onFinish(state);
    else onChange(next);
  };

  // Keys outside the text field: Enter = listen / next, Esc = listen again, 1–4 = pick an option.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest('[role="dialog"], [data-popover]')) return;
      if (t && (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable)) return;
      if (t instanceof HTMLInputElement) return; // the answer field handles its own keys
      if (e.key === 'Escape') {
        e.preventDefault();
        listen();
        return;
      }
      if (e.key === 'Enter') {
        // a focused link / other button keeps its own Enter; the listen button and options use "next"
        if (t && t.closest('a, button') && !t.closest('.ck-opt, .ck-play')) return;
        e.preventDefault();
        if (!e.repeat) goNext();
        return;
      }
      if (item?.kind === 'question' && /^[1-9]$/.test(e.key)) {
        const k = Number(e.key) - 1;
        const order = optionOrder(state, item.question);
        if (k < order.length) {
          e.preventDefault();
          onChange(choose(state, form, order[k]));
          setNudge(false);
        }
      }
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) goNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      listen();
    }
  };

  if (!item) return null;
  const partLabel = item.kind === 'sentence' ? 'Phần 1 · Chép chính tả' : 'Phần 2 · Nghe hiểu';
  const pct = progressPct(state, form);
  const chosen = chosenOf(state, form);
  // Options in this attempt's shuffled order; `order[k]` is the original index (what is stored).
  const order = item.kind === 'question' ? optionOrder(state, item.question) : [];
  const focusIdx = Math.max(0, chosen === null ? 0 : order.indexOf(chosen));
  const pickAt = (k: number, focus: boolean) => {
    const n = order.length;
    const kk = ((k % n) + n) % n;
    onChange(choose(state, form, order[kk]));
    setNudge(false);
    if (focus) optionRefs.current[kk]?.focus();
  };
  // Radio group keys: arrows move the selection (and focus) like native radios.
  const onOptionKey = (e: ReactKeyboardEvent<HTMLButtonElement>, k: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      pickAt(k + 1, true);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      pickAt(k - 1, true);
    }
  };

  return (
    <section className="card ck-test" aria-labelledby="ck-test-title">
      <div className="ck-top">
        <h2 id="ck-test-title" className="ck-part" ref={headRef} tabIndex={-1}>
          {partLabel}
        </h2>
        <span className="ck-step tabular" aria-live="polite">
          {stepLabel(state, form)}
        </span>
      </div>
      <div
        className="progress ck-progress"
        role="progressbar"
        aria-label="Tiến độ bài kiểm tra"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      {resumed && id === resumedAt && <p className="meta ck-resumed">Đã mở lại bài đang làm dở.</p>}

      {item.kind === 'question' && (
        <p className="ck-question" id="ck-question">
          {item.question.question}
        </p>
      )}

      <div className="panel ck-listen">
        <button
          type="button"
          className={'btn btn-lg ck-play ' + (used === 0 ? 'btn-primary' : 'btn-soft')}
          onClick={listen}
          disabled={!audio.canSpeak || left <= 0 || isPlaying}
          aria-busy={(isPlaying && audio.pending) || undefined}
          aria-keyshortcuts="Escape"
        >
          {isPlaying && audio.pending ? (
            <Icon icon={LoaderCircle} size={17} className="icon-spin" />
          ) : (
            <Icon icon={Play} size={17} fill="currentColor" strokeWidth={1.5} />
          )}
          {isPlaying && audio.pending ? PENDING_LABEL : playLabel(used, isPlaying)}
        </button>
        <span className="ck-listen-note">
          Tối đa {MAX_PLAYS} lần · tốc độ tự nhiên
        </span>
      </div>

      {!audio.canSpeak && (
        <div className="callout callout-warn" role="alert">
          <Icon icon={VolumeX} size={16} />
          <div>Trình duyệt này không có giọng đọc tiếng Anh. Hãy dùng Chrome, Edge hoặc Safari bản mới.</div>
        </div>
      )}

      {item.kind === 'sentence' ? (
        <div className="ck-answer">
          <label htmlFor="ck-input" className="field-label">
            Gõ lại những gì bạn nghe được
          </label>
          <input
            id="ck-input"
            ref={inputRef}
            className="input ck-input"
            value={typedOf(state, form)}
            onChange={(e) => {
              onChange(setTyped(state, form, e.target.value));
              if (nudge) setNudge(false);
            }}
            onKeyDown={onInputKey}
            maxLength={500}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="next"
            lang="en"
            aria-describedby={nudge ? 'ck-nudge' : undefined}
          />
        </div>
      ) : (
        <div className="ck-options" role="radiogroup" aria-labelledby="ck-question">
          {order.map((orig, k) => {
            const on = chosen === orig;
            const o = item.question.options[orig];
            return (
              <button
                key={orig}
                ref={(el) => {
                  optionRefs.current[k] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={o}
                tabIndex={k === focusIdx ? 0 : -1}
                className={'ck-opt' + (on ? ' is-on' : '')}
                onClick={() => pickAt(k, false)}
                onKeyDown={(e) => onOptionKey(e, k)}
                aria-keyshortcuts={String(k + 1)}
              >
                <span className="ck-opt-key" aria-hidden="true">
                  {on ? <Icon icon={Check} size={15} strokeWidth={2.5} /> : k + 1}
                </span>
                <span className="ck-opt-label" aria-hidden="true">
                  {o}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {nudge && (
        <div className="callout callout-warn ck-nudge" id="ck-nudge" role="status">
          <Icon icon={TriangleAlert} size={16} />
          <div>
            {item.kind === 'sentence' ? 'Bạn chưa gõ gì. Gõ vài từ nghe được, hoặc ' : 'Bạn chưa chọn đáp án. Chọn một đáp án, hoặc '}
            <button type="button" className="ck-link" onClick={() => goNext(true)}>
              bỏ qua {item.kind === 'sentence' ? 'câu' : 'đoạn'} này
            </button>
            .
          </div>
        </div>
      )}

      <div className="ck-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmQuit(true)} disabled={confirmQuit}>
          Bỏ bài
        </button>
        <button
          type="button"
          className={'btn btn-lg ck-next' + (used > 0 ? ' btn-primary' : '')}
          onClick={() => goNext()}
          disabled={used === 0}
          aria-keyshortcuts="Enter"
        >
          {nextLabel(state, form)}
          <Icon icon={ArrowRight} size={17} />
        </button>
      </div>

      {confirmQuit && (
        <div className="callout callout-warn ck-quit" role="alert">
          <Icon icon={TriangleAlert} size={16} />
          <div className="stack-sm">
            <span>Bỏ bài đang làm? Các câu trả lời sẽ không được lưu.</span>
            <span className="row">
              <button type="button" className="btn btn-sm btn-danger" onClick={onAbandon}>
                Bỏ bài
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirmQuit(false)}>
                Làm tiếp
              </button>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
