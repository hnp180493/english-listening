import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowRight, Check, Lightbulb, SkipForward, TriangleAlert } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import SpokenSentence from '../../components/SpokenSentence';
import { buildCloze, clozeBlanks, gradeCloze, isBlankCorrect, type ClozeOutcome } from '../../core/dictation/cloze';
import { makeHint } from '../../core/dictation/hint';
import { normalizeText, splitWords } from '../../core/dictation/normalize';
import type { Annotation, Phenomenon, Sentence } from '../../core/types';
import { NEXT_GUARD_MS } from './constants';
import { chunksOf, dictationAudio, safeDecode, targetTokens } from './decodeCache';
import type { CheckedInfo } from './Exercise';
import FollowUps from './FollowUps';
import ListenControls, { CarefulListen } from './ListenControls';
import { Meaning, ResultActions, Verdict, type Tone } from './ResultParts';
import { isCoarsePointer, usePlayer } from './usePlayer';
import { AnnotationCard, PhenomenonChips } from './WhyWrong';

const MAX_BLANK_CHARS = 80;

export interface ClozeExerciseProps {
  sentence: Sentence;
  focus: Phenomenon | null;
  autoPlay: boolean;
  focusOnMount: boolean;
  onChecked: (info: CheckedInfo) => void;
  onNext: () => void;
  onRetry: () => void;
  onSkip: () => void;
  /** The card's top row (the session goal bar). */
  top?: ReactNode;
}

/** "Điền từ": the sentence is visible except the words where connected speech happens. */
export default function ClozeExercise({
  sentence,
  focus,
  autoPlay,
  focusOnMount,
  onChecked,
  onNext,
  onRetry,
  onSkip,
  top,
}: ClozeExerciseProps) {
  const decoded = useMemo(() => safeDecode(sentence.text), [sentence.text]);
  const targetRaw = useMemo(() => targetTokens(decoded, sentence.text), [decoded, sentence.text]);
  const chunks = useMemo(() => chunksOf(decoded, targetRaw), [decoded, targetRaw]);
  const units = useMemo(() => buildCloze(decoded, { focus }), [decoded, focus]);
  const blanks = useMemo(() => clozeBlanks(units), [units]);
  const allFallback = blanks.length > 0 && blanks.every((b) => b.fallback);

  const [answers, setAnswers] = useState<string[]>(() => blanks.map(() => ''));
  const [hintShown, setHintShown] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [outcome, setOutcome] = useState<ClozeOutcome | null>(null);
  const [activeAnn, setActiveAnn] = useState<string | null>(null);

  const rootRef = useRef<HTMLElement>(null);
  const audio = useMemo(() => dictationAudio(sentence), [sentence]);
  const player = usePlayer(audio, chunks, { autoPlay, rootRef });
  const { canSpeak, plays, play, stop } = player;

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const lastFocusRef = useRef(0);
  useEffect(() => {
    if (focusOnMount && !isCoarsePointer()) inputsRef.current[0]?.focus();
  }, [focusOnMount]);

  const checkedAtRef = useRef(0);
  const check = (reveal = false) => {
    if (outcome || checkedAtRef.current) return;
    if (!reveal && answers.every((a) => !normalizeText(a))) {
      setNudge(true);
      inputsRef.current[0]?.focus();
      return;
    }
    checkedAtRef.current = Date.now();
    const g = gradeCloze(units, answers, decoded.annotations);
    setOutcome(g);
    setNudge(false);
    setActiveAnn(g.missedAnnotationIds[0] ?? null);
    if (!isCoarsePointer()) inputsRef.current[lastFocusRef.current]?.focus({ preventScroll: true });
    onChecked({ score: g.score, seen: g.seen, missed: g.missed, hinted: hintShown });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, k: number) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (e.repeat) return;
    if (outcome) {
      if (Date.now() - checkedAtRef.current < NEXT_GUARD_MS) return;
      onNext();
      return;
    }
    // Enter moves to the next empty blank; on the last one (or Ctrl+Enter) it checks
    if (!e.ctrlKey && !e.metaKey) {
      for (let j = k + 1; j < blanks.length; j++) {
        if (!normalizeText(answers[j] ?? '')) {
          inputsRef.current[j]?.focus();
          return;
        }
      }
    }
    check();
  };

  const annById = useMemo(() => new Map(decoded.annotations.map((a) => [a.id, a])), [decoded]);
  const missedAnns = (outcome?.missedAnnotationIds ?? []).map((id) => annById.get(id)).filter((a): a is Annotation => !!a);
  const activeAnnotation = activeAnn ? (annById.get(activeAnn) ?? null) : null;
  const scorePct = outcome ? Math.round(outcome.score * 100) : 0;
  const tone: Tone = !outcome ? 'ok' : outcome.score >= 1 ? 'ok' : outcome.score >= 0.5 ? 'warn' : 'bad';
  // one primary action at a time: "Nghe" until the learner has listened or typed, then "Kiểm tra"
  const listenFirst = plays === 0 && answers.every((a) => !a.trim());
  const verdict = !outcome
    ? ''
    : outcome.score >= 1
      ? 'Chính xác hết!'
      : outcome.score >= 0.5
        ? 'Gần được rồi'
        : 'Chỗ nối âm này khó, nghe từng cụm nhé';

  if (blanks.length === 0) {
    return (
      <article className="card dict-ex" ref={rootRef}>
        <p className="muted">Không tạo được chỗ trống nào cho câu này. Sang câu khác nhé.</p>
        <div className="dict-actions">
          <button type="button" className="btn btn-primary" onClick={onSkip}>
            Câu tiếp
            <Icon icon={ArrowRight} size={16} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="card dict-ex" ref={rootRef}>
      {top}

      <ListenControls player={player} emphasis={listenFirst && !outcome} />

      <div className="dict-answer">
        <p className="field-label" id="dict-cz-label">
          {allFallback
            ? `Điền ${blanks.length} chỗ trống: những từ nhỏ bị đọc lướt`
            : `Điền ${blanks.length} chỗ trống: chỗ âm bị nối, nuốt hoặc biến đổi`}
        </p>
        <div className="panel dict-cz-panel">
          <p className="dict-cz" lang="en" role="group" aria-labelledby="dict-cz-label">
            {units.map((u) => {
              if (u.kind === 'text') {
                return (
                  <span key={`t${u.index}`} className="dict-cz-word">
                    {u.raw}
                  </span>
                );
              }
              const k = u.id;
              const verdict = outcome?.verdicts[k];
              const ok = verdict ? isBlankCorrect(verdict) : false;
              const state = !outcome ? '' : verdict === 'typo' ? ' is-typo' : ok ? ' is-ok' : ' is-bad';
              const width = Math.min(28, Math.max(4, u.target.length + 2));
              return (
                  <span key={`b${u.id}`} className="dict-cz-slot">
                    {u.lead && <span className="dict-cz-punct">{u.lead}</span>}
                    <span className="dict-cz-field">
                      <input
                        ref={(el) => {
                          inputsRef.current[k] = el;
                        }}
                        className={'dict-cz-input' + state}
                        style={{ width: `${width}ch` }}
                        value={answers[k] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAnswers((prev) => prev.map((x, j) => (j === k ? v : x)));
                          if (nudge) setNudge(false);
                        }}
                        onFocus={() => {
                          lastFocusRef.current = k;
                        }}
                        onKeyDown={(e) => onKeyDown(e, k)}
                        readOnly={!!outcome}
                        maxLength={MAX_BLANK_CHARS}
                        placeholder={hintShown ? makeHint(splitWords(u.target)) : ''}
                        aria-label={`Chỗ trống ${k + 1}/${blanks.length}`}
                        aria-invalid={outcome ? !ok : undefined}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        enterKeyHint={outcome ? 'next' : k === blanks.length - 1 ? 'done' : 'next'}
                      />
                      {outcome && verdict !== 'ok' && (
                        <span className={'dict-cz-fix' + (ok ? ' is-typo' : '')}>
                          <span className="sr-only">{ok ? 'Viết đúng là: ' : 'Đáp án: '}</span>
                          {u.target}
                        </span>
                      )}
                    </span>
                    {u.trail && <span className="dict-cz-punct">{u.trail}</span>}
                  </span>
              );
            })}
          </p>
          {outcome && sentence.vi && <Meaning vi={sentence.vi} />}
        </div>
        {nudge && (
          <div className="callout callout-warn dict-nudge">
            <Icon icon={TriangleAlert} size={16} />
            <div>
              Hãy điền ít nhất một chỗ trống.{' '}
              <button type="button" className="dict-link" onClick={() => check(true)}>
                Chịu, xem đáp án
              </button>
            </div>
          </div>
        )}
        {!outcome && (
          <div className="dict-tools">
            <button
              type="button"
              className={'btn dict-cz-check' + (listenFirst ? '' : ' btn-primary')}
              onClick={() => check()}
              aria-keyshortcuts="Control+Enter"
            >
              Kiểm tra
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHintShown(true)} disabled={hintShown}>
              <Icon icon={Lightbulb} size={15} />
              Gợi ý chữ cái đầu
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>
              <Icon icon={SkipForward} size={15} />
              Bỏ qua
            </button>
          </div>
        )}
      </div>

      {outcome && (
        <div className="dict-result" aria-live="polite">
          <Verdict
            tone={tone}
            pct={scorePct}
            title={verdict}
            sub={
              <>
                Đúng {outcome.correct}/{outcome.total} chỗ trống
                {hintShown ? ' · có dùng gợi ý' : ''}
              </>
            }
          />

          <section className="dict-why">
            {missedAnns.length > 0 ? (
              <>
                <h3 className="dict-h3">Vì sao chỗ này khó nghe?</h3>
                <div className="dict-ann-list">
                  {missedAnns.map((a) => (
                    <AnnotationCard key={a.id} a={a} onPlayStart={stop} segments={decoded.segments} />
                  ))}
                </div>
              </>
            ) : outcome.score >= 1 ? (
              <div className="dict-why-ok">
                <IconTile icon={Check} tint="var(--ok)" size="sm" />
                <div className="dict-why-ok-text">
                  <h3 className="dict-h3">Bạn nghe chuẩn rồi!</h3>
                  {outcome.seen.length > 0 && (
                    <p>
                      Câu này có <PhenomenonChips list={outcome.seen} /> và bạn đều bắt được. Thử chế độ <b>Cả câu</b>{' '}
                      để thử thách hơn.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="muted">Xem lại đáp án ở các ô màu đỏ rồi nghe lại câu nhé.</p>
            )}
          </section>

          {decoded.tokens.length > 0 && (
            <section className="dict-spoken">
              <div className="dict-spoken-head">
                <h3 className="dict-h3">Câu này được nói như thế nào</h3>
                <span className="dict-small">Bấm chỗ tô màu để xem giải thích</span>
              </div>
              <div className="panel dict-spoken-box">
                <SpokenSentence
                  result={decoded}
                  compact
                  activeAnnotationId={activeAnn}
                  onAnnotationClick={(id) => setActiveAnn((cur) => (cur === id ? null : id))}
                />
              </div>
              <CarefulListen player={player} />
              {activeAnnotation && !missedAnns.includes(activeAnnotation) && (
                <AnnotationCard a={activeAnnotation} active onPlayStart={stop} segments={decoded.segments} />
              )}
            </section>
          )}

          {outcome.score < 1 && <FollowUps sentence={sentence} />}

          <ResultActions canSpeak={canSpeak} onReplay={() => void play('normal', false)} onRetry={onRetry} onNext={onNext} />
        </div>
      )}
    </article>
  );
}
