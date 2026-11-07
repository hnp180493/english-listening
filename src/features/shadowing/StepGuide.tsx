import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CircleCheck, Play, RotateCcw, Square } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { connectedText } from '../../core/playback';
import { speak, stopSpeaking, ttsSupported } from '../../core/tts';
import type { DecodeResult } from '../../core/types';
import { buildSteps, repeatPauseMs } from './steps';

const STEP_RATE = 0.85;

/** True when the respelling is worth showing (not just the written words again). */
function differs(spoken: string, written: string): boolean {
  const f = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return !!spoken.trim() && f(spoken) !== f(written);
}

type RunState =
  | { index: number; phase: 'listen' } // index -1 = the whole sentence at the end
  | { index: number; phase: 'repeat'; ms: number };

interface StepGuideProps {
  result: DecodeResult;
  interruptKey: number; // bump to stop the guide (e.g. when recording starts)
  disabled?: boolean;
  onFinished?: () => void;
}

/** "Từng cụm": the model says one short phrase, then waits while the learner repeats it. */
export default function StepGuide({ result, interruptKey, disabled, onFinished }: StepGuideProps) {
  const steps = useMemo(() => buildSteps(result), [result]);
  const [run, setRun] = useState<RunState | null>(null);
  const [finished, setFinished] = useState(false);
  const token = useRef(0); // bumped to cancel the running loop
  const owner = useRef(0); // token of the loop that currently owns the UI state
  const active = useRef(false);
  const timer = useRef<number | null>(null);
  const wake = useRef<(() => void) | null>(null);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      wake.current = resolve;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        wake.current = null;
        resolve();
      }, ms);
    });

  /**
   * Cancel the running loop; the loop itself clears its UI state when it notices.
   * `silence` also cuts the current TTS (not wanted when something else just started speaking).
   */
  const halt = useCallback((silence: boolean) => {
    token.current++;
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const w = wake.current;
    wake.current = null;
    w?.();
    if (active.current) {
      active.current = false;
      if (silence) stopSpeaking();
    }
  }, []);

  const stop = () => {
    halt(true);
    owner.current = 0;
    setRun(null);
  };

  useEffect(() => {
    if (interruptKey > 0) halt(false);
  }, [interruptKey, halt]);

  // Unmount: end the loop (resolving any pending wait so it does not hang) and its speech.
  useEffect(
    () => () => {
      owner.current = 0;
      halt(true);
    },
    [halt],
  );

  const runFrom = async (start: number) => {
    const t = ++token.current;
    owner.current = t;
    active.current = true;
    setFinished(false);
    const cancelled = () => {
      if (t === token.current) return false;
      if (owner.current === t) {
        owner.current = 0;
        setRun(null);
      }
      return true;
    };
    for (let i = start; i < steps.length; i++) {
      setRun({ index: i, phase: 'listen' });
      await speak(steps[i].speak, { rate: STEP_RATE, mode: 'connected' });
      if (cancelled()) return;
      setRun({ index: i, phase: 'repeat', ms: repeatPauseMs(steps[i].words, STEP_RATE) });
      await wait(repeatPauseMs(steps[i].words, STEP_RATE));
      if (cancelled()) return;
    }
    if (steps.length > 1) {
      const words = steps.reduce((n, s) => n + s.words, 0);
      setRun({ index: -1, phase: 'listen' });
      await speak(connectedText(result.input, result), { rate: STEP_RATE, mode: 'connected' });
      if (cancelled()) return;
      setRun({ index: -1, phase: 'repeat', ms: repeatPauseMs(words, STEP_RATE) });
      await wait(repeatPauseMs(words, STEP_RATE));
      if (cancelled()) return;
    }
    active.current = false;
    owner.current = 0;
    setRun(null);
    setFinished(true);
    onFinishedRef.current?.();
  };

  const playOne = (i: number) => {
    stop();
    void speak(steps[i].speak, { rate: STEP_RATE, mode: 'connected' });
  };

  if (steps.length === 0) return null;
  const running = run !== null;
  const current = run && run.index >= 0 ? steps[run.index] : null;
  const progress = run ? (run.index < 0 ? steps.length : run.index) : finished ? steps.length : 0;

  return (
    <section className="card shadow-steps" aria-labelledby="shadow-steps-title">
      <div className="shadow-card-head">
        <div className="shadow-head-row">
          <h2 id="shadow-steps-title" className="shadow-h2">
            <span className="shadow-stepno" aria-hidden="true">
              2
            </span>
            Luyện từng cụm
          </h2>
          <span className="meta shadow-steps-count">
            {progress > 0 ? `${progress}/${steps.length} cụm` : `${steps.length} cụm`}
          </span>
        </div>
        <p className="muted shadow-sub">Máy đọc từng cụm ({STEP_RATE}×) rồi dừng để bạn nhắc lại. Cuối cùng là cả câu.</p>
      </div>

      <ol className="shadow-steplist" aria-label="Các cụm trong câu">
        {steps.map((s, i) => {
          const isCur = run?.index === i;
          const isDone = run ? (run.index < 0 ? true : i < run.index) : finished;
          return (
            <li key={`${s.from}-${s.to}`}>
              <button
                type="button"
                className={'shadow-stepchip' + (isCur ? ' is-current' : '') + (isDone ? ' is-done' : '')}
                onClick={() => playOne(i)}
                aria-current={isCur ? 'step' : undefined}
                title="Nghe riêng cụm này"
                disabled={disabled || !ttsSupported()}
              >
                <span className="shadow-stepchip-text">{s.text}</span>
                {differs(s.spoken, s.text) && <span className="respell shadow-stepchip-spoken">{s.spoken}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="shadow-steps-status" role="status" aria-live="polite">
        {run?.phase === 'listen' && (
          <p className="shadow-steps-msg">
            <span className="shadow-dot is-listen" aria-hidden="true" />
            Nghe: <b>{current ? current.text : 'cả câu'}</b>
          </p>
        )}
        {run?.phase === 'repeat' && (
          <div className="shadow-steps-msg is-repeat">
            <p>
              <span className="shadow-dot is-you" aria-hidden="true" />
              Đến lượt bạn — nhắc lại: <b>{current ? current.text : 'cả câu'}</b>
              {current && current.spoken && (
                <span className="muted">
                  {' '}
                  (<span className="respell">{current.spoken}</span>)
                </span>
              )}
            </p>
            <div className="shadow-countdown" aria-hidden="true">
              <span
                key={`${run.index}`}
                className="shadow-countdown-bar"
                style={{ '--shadow-dur': `${run.ms}ms` } as CSSProperties}
              />
            </div>
          </div>
        )}
        {!running && finished && (
          <p className="shadow-steps-msg is-done">
            <Icon icon={CircleCheck} size={17} />
            Xong! Giờ hãy thu âm cả câu ở bước 3.
          </p>
        )}
      </div>

      <div className="row shadow-steps-actions">
        {running ? (
          <button type="button" className="btn" onClick={stop}>
            <Icon icon={Square} size={14} fill="currentColor" strokeWidth={1.5} />
            Dừng
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => void runFrom(0)}
            disabled={disabled || !ttsSupported()}
          >
            {finished ? <Icon icon={RotateCcw} size={15} /> : <Icon icon={Play} size={15} fill="currentColor" strokeWidth={1.5} />}
            {finished ? 'Luyện lại từng cụm' : 'Bắt đầu từng cụm'}
          </button>
        )}
      </div>
    </section>
  );
}
