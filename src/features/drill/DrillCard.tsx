import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, CircleCheck, CircleX, Eye, Headphones } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PhTag from '../../components/PhTag';
import PlayButton from '../../components/PlayButton';
import { GRADES, newCard, previewIntervals, type CardState, type Grade } from '../../core/srs';
import { speakableFor } from '../../core/decoder';
import { CAREFUL_ARIA, CAREFUL_LABEL, CAREFUL_RATE, CAREFUL_TITLE, CONNECTED_SLOW_RATE, CONNECTED_SLOW_TITLE, CONNECTED_TITLE, naturalRate } from '../../core/playback';
import { speak, stopSpeaking } from '../../core/tts';
import type { Chunk } from '../../core/types';
import type { CardKind } from './choice';
import { GRADE_LABEL } from './labels';
import { citationText, isGuessCorrect, splitHighlight } from './match';

type Verdict = 'correct' | 'wrong' | 'skipped';

export interface DrillCardProps {
  chunk: Chunk;
  state?: CardState;
  /** "type" = nghe cụm → gõ; "choose" = nghe câu → chọn cụm trong 4 lựa chọn. */
  kind: CardKind;
  /** Options for a "choose" card (answer included). Ignored for "type". */
  options?: readonly Chunk[] | null;
  /** Card is not due: grading is practice only, the schedule does not change. */
  extra?: boolean;
  showIpa: boolean;
  autoPlay: boolean;
  onGrade: (g: Grade) => void;
  /** Session progress, drawn as a thin bar at the top of the card (cards done / session size). */
  progress?: { done: number; total: number };
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/**
 * Keys pressed inside a popover (incl. its trigger, e.g. the shortcuts button), the app nav or any dialog
 * (e.g. the mobile nav drawer) are not drill shortcuts.
 */
function inPopover(t: EventTarget | null): boolean {
  if (t instanceof Element && t.closest('[data-popover], nav, [role="dialog"]')) return true;
  // A modal (e.g. the nav drawer) is open but focus has left it: the card is
  // behind the modal, so its shortcuts must not fire either.
  const modal = typeof document !== 'undefined' ? document.querySelector('[aria-modal="true"]') : null;
  return !!modal && !(t instanceof Node && modal.contains(t));
}

export default function DrillCard({
  chunk,
  state,
  kind,
  options,
  extra = false,
  showIpa,
  autoPlay,
  onGrade,
  progress,
}: DrillCardProps) {
  const choose = kind === 'choose' && !!options && options.length > 1;
  const [guess, setGuess] = useState('');
  const [picked, setPicked] = useState<Chunk | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [revealedAt, setRevealedAt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const gradeRefs = useRef<Partial<Record<Grade, HTMLButtonElement | null>>>({});
  // One grade per card: blocks double clicks / repeated keys before the parent re-renders.
  const gradedRef = useRef(false);

  const revealed = verdict !== null;
  const suggested: Grade = verdict === 'correct' ? 'good' : 'again';
  // The example sentence as it is really said (connected: "I'm gonna call her tonight."), like the chunk's own
  // ttsText. In "choose" the learner must hear WHICH chunk is in the sentence: the written text read like a
  // newsreader ("going to" in full) would give it away and train the wrong ear.
  const exampleAudio = useMemo(() => (chunk.example ? speakableFor(chunk.example) : ''), [chunk.example]);
  /** What the big play button says on the front: the chunk, or the whole sentence for "choose". */
  const frontAudio = choose ? exampleAudio : chunk.ttsText;

  // Play the prompt when a new card appears (only after the learner has interacted).
  useEffect(() => {
    if (autoPlay) void speak(frontAudio, { rate: naturalRate(), mode: 'connected' });
    return () => stopSpeaking();
  }, [autoPlay, frontAudio]);

  // Focus the answer box / first option on devices with a real keyboard.
  useEffect(() => {
    const fine = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;
    if (!fine) return;
    if (choose) firstOptionRef.current?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
  }, [choose]);

  // After revealing: focus the suggested grade so Enter accepts it.
  useEffect(() => {
    if (revealed) gradeRefs.current[suggested]?.focus({ preventScroll: true });
  }, [revealed, suggested]);

  const submitGrade = useCallback(
    (g: Grade) => {
      if (gradedRef.current) return;
      gradedRef.current = true;
      onGrade(g);
    },
    [onGrade],
  );

  const reveal = useCallback((v: Verdict) => {
    setRevealedAt(Date.now());
    setVerdict(v);
  }, []);

  const choosePick = useCallback(
    (o: Chunk) => {
      setPicked(o);
      reveal(o.id === chunk.id ? 'correct' : 'wrong');
    },
    [chunk.id, reveal],
  );

  // Keyboard: Esc nghe lại · R nghe lại · C câu ví dụ · 1–4 chọn / chấm · Shift+Enter xem đáp án.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inPopover(e.target)) return;
      // A held-down key (Enter from submitting, a digit from choosing) must not also grade.
      if (e.repeat) {
        if (e.key === 'Enter' || e.key === ' ' || /^[1-4]$/.test(e.key)) e.preventDefault();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        void speak(revealed ? chunk.ttsText : frontAudio, { rate: naturalRate(), mode: 'connected' });
        return;
      }
      if (!revealed && e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        reveal('skipped');
        return;
      }
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'r') {
        e.preventDefault();
        void speak(revealed ? chunk.ttsText : frontAudio, { rate: naturalRate(), mode: 'connected' });
        return;
      }
      if (key === 'c' && exampleAudio) {
        e.preventDefault();
        void speak(exampleAudio, { rate: naturalRate(), mode: 'connected' });
        return;
      }
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx < 0) return;
      if (revealed) {
        e.preventDefault();
        submitGrade(GRADES[idx]);
      } else if (choose && options && options[idx]) {
        e.preventDefault();
        choosePick(options[idx]);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [revealed, submitGrade, reveal, choosePick, choose, options, chunk.ttsText, exampleAudio, frontAudio]);

  const previews = useMemo(
    () => (revealed && !extra ? previewIntervals(state ?? newCard(chunk.id, revealedAt), revealedAt) : null),
    [revealed, extra, state, chunk.id, revealedAt],
  );

  const highlight = useMemo(
    () => splitHighlight(chunk.example, [chunk.written, chunk.spoken, chunk.ttsText]),
    [chunk.example, chunk.written, chunk.spoken, chunk.ttsText],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) {
      inputRef.current?.focus();
      return;
    }
    reveal(isGuessCorrect(guess, chunk) ? 'correct' : 'wrong');
  };

  const typed = guess.trim() !== '';
  const pct = progress && progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0;

  return (
    <article className="card drill-card" aria-live="polite" aria-label={choose ? 'Thẻ nghe câu và chọn' : 'Thẻ nghe và gõ'}>
      {(progress || extra) && (
        <div className="drill-card-top">
          {progress && (
            <div
              className="progress drill-card-progress"
              role="progressbar"
              aria-label="Tiến độ lượt ôn"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
            >
              <span style={{ width: `${pct}%` }} />
            </div>
          )}
          {extra && (
            <span className="badge" title="Thẻ chưa đến hạn: chấm để luyện, lịch ôn giữ nguyên.">
              Luyện thêm
            </span>
          )}
        </div>
      )}

      {!revealed ? (
        choose ? (
          <div className="drill-front">
            <p className="drill-prompt">Nghe cả câu. Cụm nào dưới đây có trong câu?</p>
            <div className="drill-listen">
              <div className="drill-bigplay">
                <PlayButton text={exampleAudio} rate={naturalRate()} mode="connected" label="Nghe câu" variant="primary" title={CONNECTED_TITLE} />
              </div>
              {/* still connected: the careful version would read the answer out */}
              <PlayButton
                text={exampleAudio}
                rate={CONNECTED_SLOW_RATE}
                slow
                mode="connected"
                label="Nghe chậm"
                size="sm"
                variant="ghost"
                title={CONNECTED_SLOW_TITLE}
                ariaLabel={CONNECTED_SLOW_TITLE}
              />
            </div>
            <div className="drill-options" role="group" aria-label="Chọn cụm từ bạn nghe thấy">
              {options!.map((o, i) => (
                <button
                  key={o.id}
                  ref={i === 0 ? firstOptionRef : undefined}
                  type="button"
                  className="drill-option"
                  onClick={() => choosePick(o)}
                  lang="en"
                  aria-keyshortcuts={String(i + 1)}
                >
                  <span className="drill-option-text">{o.written}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm drill-skip" onClick={() => reveal('skipped')}>
              <Icon icon={Eye} size={15} />
              Không biết, xem đáp án
            </button>
          </div>
        ) : (
          <div className="drill-front">
            <p className="drill-prompt">Nghe và đoán cụm từ tiếng Anh</p>
            <div className="drill-listen">
              <div className="drill-bigplay">
                {/* The one gradient action: "Nghe" until the learner has typed, then "Kiểm tra". */}
                <PlayButton text={chunk.ttsText} rate={naturalRate()} mode="connected" label="Nghe cụm" variant={typed ? 'soft' : 'primary'} />
              </div>
              <PlayButton text={exampleAudio} rate={naturalRate()} mode="connected" label="Nghe trong câu" size="sm" variant="ghost" />
            </div>

            <form className="drill-answer" onSubmit={onSubmit}>
              <label className="sr-only" htmlFor={`drill-guess-${chunk.id}`}>
                Bạn nghe được gì?
              </label>
              <div className="drill-answer-row">
                <input
                  id={`drill-guess-${chunk.id}`}
                  ref={inputRef}
                  className="input"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="Bạn nghe được gì?"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  aria-keyshortcuts="Escape"
                />
                <button
                  type="submit"
                  className={'btn' + (typed ? ' btn-primary' : '')}
                  disabled={!typed}
                  aria-keyshortcuts="Enter"
                >
                  Kiểm tra
                </button>
              </div>
            </form>
            <button type="button" className="btn btn-ghost btn-sm drill-skip" onClick={() => reveal('skipped')}>
              <Icon icon={Eye} size={15} />
              Không biết, xem đáp án
            </button>
          </div>
        )
      ) : (
        <div className="drill-back">
          {verdict === 'correct' && (
            <div className="callout callout-ok drill-verdict">
              <Icon icon={CircleCheck} size={18} />
              <span>
                <strong>Chính xác!</strong> Bạn {choose ? 'chọn' : 'gõ'}: <q lang="en">{choose ? picked?.written : guess.trim()}</q>
              </span>
            </div>
          )}
          {verdict === 'wrong' && (
            <div className="callout callout-bad drill-verdict">
              <Icon icon={CircleX} size={18} />
              <span>
                <strong>Chưa đúng.</strong> Bạn {choose ? 'chọn' : 'gõ'}: <q lang="en">{choose ? picked?.written : guess.trim()}</q>
                {choose && picked && picked.spoken !== picked.written && (
                  <>
                    {' '}
                    — cụm đó đọc là <q lang="en">{picked.spoken}</q>
                  </>
                )}
              </span>
            </div>
          )}
          {verdict === 'skipped' && (
            <div className="callout drill-verdict is-skip">
              <Icon icon={Headphones} size={18} />
              <span>Không sao — nghe lại vài lần rồi tự chấm nhé.</span>
            </div>
          )}

          <div className="drill-answer-big">
            <div className="drill-written" lang="en">
              {chunk.written}
            </div>
            <Icon icon={ArrowDown} size={18} className="drill-arrow" />
            <div className="drill-spoken" lang="en">
              {chunk.spoken}
            </div>
            {showIpa && chunk.ipa && <div className="ipa drill-ipa">{chunk.ipa}</div>}
            {chunk.phenomena.length > 0 && <PhTag p={chunk.phenomena[0]} more={chunk.phenomena.length - 1} />}
          </div>

          <div className="drill-play-row">
            <PlayButton
              text={citationText(chunk.written)}
              rate={CAREFUL_RATE}
              mode="careful"
              label={CAREFUL_LABEL}
              size="sm"
              variant="ghost"
              title={CAREFUL_TITLE}
              ariaLabel={CAREFUL_ARIA}
            />
            <PlayButton text={chunk.ttsText} rate={naturalRate()} mode="connected" label="Tự nhiên" size="sm" variant="soft" title={CONNECTED_TITLE} />
            {exampleAudio && <PlayButton text={exampleAudio} rate={naturalRate()} mode="connected" label="Câu ví dụ" size="sm" variant="ghost" />}
          </div>

          {chunk.meaning && <p className="drill-meaning">{chunk.meaning}</p>}

          {chunk.example && (
            <div className="panel drill-example">
              <p className="drill-example-en" lang="en">
                {highlight ? (
                  <>
                    {highlight.before}
                    <mark className="drill-mark">{highlight.match}</mark>
                    {highlight.after}
                  </>
                ) : (
                  chunk.example
                )}
              </p>
              {chunk.exampleVi && <p className="drill-example-vi">{chunk.exampleVi}</p>}
            </div>
          )}

          <div className="drill-grade-wrap">
            <p className="drill-grade-hint">
              {extra ? 'Thẻ chưa đến hạn: chấm để luyện, lịch ôn giữ nguyên.' : 'Bạn nhớ cụm này thế nào?'}
            </p>
            <div className="drill-grades" role="group" aria-label="Tự chấm">
              {GRADES.map((g, i) => (
                <button
                  key={g}
                  type="button"
                  ref={(el) => {
                    gradeRefs.current[g] = el;
                  }}
                  className={`drill-grade is-${g}` + (g === suggested ? ' is-suggested' : '')}
                  onClick={() => submitGrade(g)}
                  aria-label={`${GRADE_LABEL[g]}${previews ? `, ôn lại sau ${previews[g]}` : ''}`}
                  aria-keyshortcuts={String(i + 1)}
                >
                  <span className="drill-grade-label">{GRADE_LABEL[g]}</span>
                  <span className="drill-grade-when">{previews ? previews[g] : 'giữ lịch'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
