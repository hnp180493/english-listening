import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CircleCheck, CircleX, Play, RotateCcw, Square, TriangleAlert, Turtle, Volume2, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import { useSettings } from '../../core/settings';
import { speak, stopSpeaking, ttsSupported } from '../../core/tts';
import type { PairItem, PairSet } from '../../data/pairs';
import { roundKeyAction, type AnswerRecord, type Question, type RoundState } from './game';
import CueText from './CueText';
import { PAIRS_SHORTCUTS } from './shortcuts';

export interface RoundViewProps {
  title: string;
  /** @deprecated The round no longer shows the set name (kept so callers don't break). */
  showSet: boolean;
  round: RoundState;
  question: Question;
  /** The item's set (not shown: the question view names no set or phenomenon). */
  set: PairSet;
  item: PairItem;
  answer: AnswerRecord | null;
  onChoose: (choice: number) => void;
  onNext: () => void;
  onQuit: () => void;
  /** Rendered inside another page (Ôn tập): hides the round title, counter, progress bar and "Thoát". */
  embedded?: boolean;
}

type PlayKey = 'main' | 'slow' | `opt-${number}`;

const SLOW_FACTOR = 0.7;

function hasUserActivation(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/** Focus is inside the nav drawer, a popover or a dialog: the round is not what the user is looking at. */
function inOverlay(t: EventTarget | null): boolean {
  return t instanceof Element && !!t.closest('nav, [role="dialog"], [data-popover]');
}

function isActivatable(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SUMMARY');
}

export default function RoundView({
  title,
  round,
  question,
  item,
  answer,
  onChoose,
  onNext,
  onQuit,
  embedded = false,
}: RoundViewProps) {
  const { rate } = useSettings();
  const QHeading = embedded ? 'h2' : 'h1';
  const slowRate = Math.max(0.5, rate * SLOW_FACTOR);
  const [playing, setPlaying] = useState<PlayKey | null>(null);
  const [heard, setHeard] = useState(false);
  const token = useRef(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tts = ttsSupported();
  const played = item.options[question.answer] ?? item.options[0];

  const play = useCallback(
    async (text: string, r: number, key: PlayKey) => {
      const my = ++token.current;
      setPlaying(key);
      if (key === 'main' || key === 'slow') setHeard(true);
      await speak(text, { rate: r });
      if (token.current === my) setPlaying(null);
    },
    [],
  );

  const toggle = useCallback(
    (text: string, r: number, key: PlayKey) => {
      if (playing === key) {
        token.current++;
        stopSpeaking();
        setPlaying(null);
        return;
      }
      void play(text, r, key);
    },
    [play, playing],
  );

  // The component is keyed by question, so this runs once per question.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // Auto-play each new question once the page has had a user gesture.
  useEffect(() => {
    if (!tts || !hasUserActivation()) return;
    const id = window.setTimeout(() => void play(played, rate, 'main'), 250);
    return () => window.clearTimeout(id);
  }, [play, played, rate, tts]);

  // Stop audio when leaving the question.
  useEffect(
    () => () => {
      token.current++;
      stopSpeaking();
    },
    [],
  );

  // Move focus to "next" after answering so Enter/Space continue.
  useEffect(() => {
    if (answer) nextRef.current?.focus({ preventScroll: true });
  }, [answer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const action = roundKeyAction(e.key, {
        answered: !!answer,
        optionCount: item.options.length,
        onControl: isActivatable(e.target),
        ignore: e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || inOverlay(e.target),
        repeat: e.repeat,
      });
      if (!action) return;
      e.preventDefault();
      switch (action.type) {
        case 'choose':
          onChoose(action.index);
          break;
        case 'compare':
          toggle(item.options[action.index], rate, `opt-${action.index}`);
          break;
        case 'replay':
          if (tts) toggle(played, rate, 'main');
          break;
        case 'slow':
          if (tts) toggle(played, slowRate, 'slow');
          break;
        case 'next':
          onNext();
          break;
        case 'block':
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, item.options, onChoose, onNext, played, rate, slowRate, toggle, tts]);

  const answeredCount = round.answers.length;
  const total = round.queue.length;
  const isLast = round.index >= total - 1;
  const answerStatus = (i: number): 'right' | 'wrong' | 'idle' => {
    if (!answer) return 'idle';
    if (i === answer.answer) return 'right';
    if (i === answer.choice) return 'wrong';
    return 'idle';
  };
  const tip = <CueText text={item.cue} />;

  return (
    <section className="pairs-round" aria-labelledby="pairs-q-heading">
      {!embedded && (
        <header className="pairs-round-top">
          <div className="pairs-round-meta">
            <p className="pairs-round-title">
              <strong>{title}</strong>
              <span className="meta">
                {Math.min(round.index + 1, total)}/{total}
              </span>
            </p>
            <div className="pairs-round-tools">
              <ShortcutsHelp items={PAIRS_SHORTCUTS} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={onQuit}>
                <Icon icon={X} size={15} />
                Thoát
              </button>
            </div>
          </div>
          <div
            className="progress pairs-progress"
            role="progressbar"
            aria-label="Tiến độ lượt chơi"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answeredCount}
          >
            <span style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }} />
          </div>
        </header>
      )}

      <div className="card pairs-question">
        <div className="pairs-ask">
          {tts ? (
            <button
              type="button"
              className={`pairs-listen-main${playing === 'main' ? ' is-playing' : ''}${!heard ? ' is-fresh' : ''}${answer ? ' is-answered' : ''}`}
              onClick={() => toggle(played, rate, 'main')}
              aria-pressed={playing === 'main'}
              aria-label={heard ? 'Nghe lại' : 'Nghe câu'}
              aria-keyshortcuts="R"
              title={heard ? 'Nghe lại (R)' : 'Nghe câu (R)'}
            >
              {playing === 'main' ? (
                <Icon icon={Square} size={26} fill="currentColor" strokeWidth={1.5} />
              ) : (
                <Icon icon={Play} size={30} fill="currentColor" strokeWidth={1.5} className="pairs-listen-play" />
              )}
            </button>
          ) : null}
          <div className="pairs-ask-text">
            {question.requeue && (
              <span className="badge pairs-requeue">
                <Icon icon={RotateCcw} size={13} strokeWidth={2.5} />
                Nghe lại câu đã sai
              </span>
            )}
            {/* Embedded in another page (which owns the page's only h1): an h2 with the same look. */}
            <QHeading id="pairs-q-heading" ref={headingRef} tabIndex={-1} className="pairs-q-heading">
              Bạn nghe thấy câu nào?
            </QHeading>
            {tts && (
              <div className="pairs-listen-side">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggle(played, slowRate, 'slow')}
                  aria-pressed={playing === 'slow'}
                  aria-keyshortcuts="S"
                  title="Nghe chậm (S)"
                >
                  {playing === 'slow' ? (
                    <Icon icon={Square} size={12} fill="currentColor" strokeWidth={1.5} />
                  ) : (
                    <Icon icon={Turtle} size={16} />
                  )}
                  Nghe chậm
                </button>
              </div>
            )}
          </div>
        </div>

        {!tts && (
          <div className="callout callout-warn" role="alert">
            <Icon icon={TriangleAlert} size={18} />
            <div>Trình duyệt này không hỗ trợ đọc giọng nói, nên không thể phát câu. Hãy dùng Chrome, Edge hoặc Safari bản mới.</div>
          </div>
        )}

        {!answer ? (
          <div className="pairs-options" role="group" aria-label="Các lựa chọn">
            {item.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                className="pairs-option"
                onClick={() => onChoose(i)}
                aria-keyshortcuts={String(i + 1)}
              >
                <span className="pairs-option-text" lang="en">
                  {opt}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div
              className={`callout pairs-feedback ${answer.correct ? 'callout-ok is-right' : 'callout-bad is-wrong'}`}
              role="status"
              aria-live="polite"
            >
              <Icon icon={answer.correct ? CircleCheck : CircleX} size={20} />
              <div className="pairs-feedback-body">
                <p className="pairs-feedback-title">
                  {answer.correct ? (
                    question.requeue ? (
                      'Lần này bạn đã nghe ra!'
                    ) : (
                      'Chính xác!'
                    )
                  ) : (
                    <>
                      Chưa đúng<span aria-hidden="true"> · </span>
                      <span className="pairs-feedback-said">
                        Câu được đọc: <strong lang="en">{played}</strong>
                      </span>
                    </>
                  )}
                </p>
                <p className="pairs-tip">{tip}</p>
                <details className="pairs-tip-more">
                  <summary>Mẹo nghe</summary>
                  <p>{tip}</p>
                </details>
              </div>
            </div>

            <ul className="pairs-compare" aria-label="Nghe so sánh">
              {item.options.map((opt, i) => {
                const st = answerStatus(i);
                const picked = i === answer.choice;
                const key: PlayKey = `opt-${i}`;
                const on = playing === key;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={`pairs-compare-row is-${st}`}
                      onClick={() => toggle(opt, rate, key)}
                      aria-pressed={on}
                      aria-keyshortcuts={String(i + 1)}
                      aria-label={`Nghe: ${opt}` + (st === 'right' ? ', câu được đọc' : '') + (picked ? ', bạn chọn' : '')}
                      disabled={!tts}
                    >
                      <span className="pairs-compare-mark" aria-hidden="true">
                        {st === 'right' && <Icon icon={Check} size={16} strokeWidth={2.6} />}
                        {st === 'wrong' && <Icon icon={X} size={16} strokeWidth={2.6} />}
                      </span>
                      <span className="pairs-compare-text">
                        <span lang="en">{opt}</span>
                        {picked && <span className="pairs-compare-you">bạn chọn</span>}
                      </span>
                      {on ? (
                        <Icon icon={Square} size={14} fill="currentColor" strokeWidth={1.5} className="pairs-compare-play" />
                      ) : (
                        <Icon icon={Volume2} size={16} className="pairs-compare-play" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="pairs-next">
              <button
                ref={nextRef}
                type="button"
                className="btn btn-primary btn-lg pairs-next-btn"
                onClick={onNext}
                aria-keyshortcuts="Enter"
              >
                {isLast ? 'Xem kết quả' : 'Câu tiếp'}
                <Icon icon={ArrowRight} size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
