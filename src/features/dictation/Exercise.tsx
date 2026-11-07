import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Lightbulb, SkipForward, TriangleAlert } from 'lucide-react';
import { Icon } from '../../components/Icon';
import SpokenSentence from '../../components/SpokenSentence';
import { align, type AlignResult } from '../../core/dictation/align';
import { classify, type ClassifyResult } from '../../core/dictation/classify';
import { buildDiff, type DiffUnit } from '../../core/dictation/diff';
import { makeHint } from '../../core/dictation/hint';
import { normalizeText, splitWords } from '../../core/dictation/normalize';
import type { Phenomenon, Sentence } from '../../core/types';
import { NEXT_GUARD_MS } from './constants';
import { chunksOf, dictationAudio, safeDecode, targetTokens } from './decodeCache';
import DiffView from './DiffView';
import FollowUps from './FollowUps';
import ListenControls, { CarefulListen } from './ListenControls';
import { ResultActions, Verdict, type Tone } from './ResultParts';
import { isCoarsePointer, usePlayer } from './usePlayer';
import WhyWrong, { AnnotationCard, PhenomenonChips } from './WhyWrong';

const MAX_ANSWER_CHARS = 400;

export interface CheckedInfo {
  score: number;
  seen: Phenomenon[];
  missed: Phenomenon[];
  hinted: boolean;
  total?: number; // AlignResult.total (target words)
  matched?: number; // AlignResult.matched (typo matches count as matched)
  extra?: number; // AlignResult.extra (extra words typed)
  revealed?: boolean; // "Chịu, xem đáp án"
}

interface Outcome {
  al: AlignResult;
  cls: ClassifyResult;
  units: DiffUnit[];
}

export interface ExerciseProps {
  sentence: Sentence;
  autoPlay: boolean;
  focusOnMount: boolean;
  onChecked: (info: CheckedInfo) => void;
  onNext: () => void;
  onRetry: () => void;
  onSkip: () => void;
  /** The card's top row (the session goal bar). */
  top?: ReactNode;
}

export default function Exercise({ sentence, autoPlay, focusOnMount, onChecked, onNext, onRetry, onSkip, top }: ExerciseProps) {
  const decoded = useMemo(() => safeDecode(sentence.text), [sentence.text]);
  const targetRaw = useMemo(() => targetTokens(decoded, sentence.text), [decoded, sentence.text]);
  const chunks = useMemo(() => chunksOf(decoded, targetRaw), [decoded, targetRaw]);

  const [answer, setAnswer] = useState('');
  const [hintShown, setHintShown] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [activeAnn, setActiveAnn] = useState<string | null>(null);

  const rootRef = useRef<HTMLElement>(null);
  const audio = useMemo(() => dictationAudio(sentence), [sentence]);
  const player = usePlayer(audio, chunks, { autoPlay, rootRef });
  const { canSpeak, plays, play, stop } = player;

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnMount && !isCoarsePointer()) inputRef.current?.focus();
  }, [focusOnMount]);

  // ---------------------------------------------------------------- checking
  // A ref, not just state: two checks in the same tick must not record two attempts.
  const checkedAtRef = useRef(0);
  const check = (reveal = false) => {
    if (outcome || checkedAtRef.current) return;
    // punctuation-only / whitespace answers count as empty
    if (!normalizeText(answer) && !reveal) {
      setNudge(true);
      inputRef.current?.focus();
      return;
    }
    checkedAtRef.current = Date.now();
    const answerRaw = splitWords(answer);
    const al = align(targetRaw, answerRaw);
    const cls = classify(decoded, al.ops, answerRaw, targetRaw);
    const units = buildDiff(targetRaw, answerRaw, al.ops);
    setOutcome({ al, cls, units });
    setNudge(false);
    setActiveAnn(cls.missedAnnotationIds[0] ?? null);
    // the "Kiểm tra" button disappears: keep focus on the input so Enter → next sentence works
    if (!isCoarsePointer()) inputRef.current?.focus({ preventScroll: true });
    onChecked({
      score: al.score,
      seen: cls.seenPhenomena,
      missed: cls.missedPhenomena,
      hinted: hintShown,
      total: al.total,
      matched: al.matched,
      extra: al.extra,
      revealed: reveal,
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (e.repeat) return; // a held Enter must not check AND skip in one go
    if (outcome) {
      if (Date.now() - checkedAtRef.current < NEXT_GUARD_MS) return;
      onNext();
    } else check();
  };

  const hint = useMemo(() => makeHint(targetRaw), [targetRaw]);
  const activeAnnotation = decoded.annotations.find((a) => a.id === activeAnn) ?? null;
  const scorePct = outcome ? Math.round(outcome.al.score * 100) : 0;
  const tone: Tone = !outcome ? 'ok' : outcome.al.score >= 1 ? 'ok' : outcome.al.score >= 0.6 ? 'warn' : 'bad';
  // one primary action at a time: "Nghe" until the learner has listened or typed, then "Kiểm tra"
  const listenFirst = plays === 0 && !answer.trim();
  const verdict = !outcome
    ? ''
    : outcome.al.score >= 1
      ? 'Chính xác!'
      : outcome.al.score >= 0.8
        ? 'Gần đúng rồi'
        : outcome.al.score >= 0.5
          ? 'Nghe được một nửa'
          : 'Câu này khó, nghe lại từng cụm nhé';

  return (
    <article className="card dict-ex" ref={rootRef}>
      {top}

      <ListenControls player={player} emphasis={listenFirst && !outcome} />

      <div className="dict-answer">
        <label htmlFor="dict-input" className="field-label">
          Gõ lại những gì bạn nghe được
        </label>
        <div className="dict-answer-row">
          <input
            id="dict-input"
            ref={inputRef}
            className={'input dict-input' + (outcome ? ' is-checked' : '')}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (nudge) setNudge(false);
            }}
            onKeyDown={onKeyDown}
            readOnly={!!outcome}
            maxLength={MAX_ANSWER_CHARS}
            placeholder="Ví dụ: I'm gonna get it…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint={outcome ? 'next' : 'done'}
            lang="en"
          />
          {!outcome && (
            <button
              type="button"
              className={'btn btn-lg dict-check' + (listenFirst ? '' : ' btn-primary')}
              onClick={() => check()}
              aria-keyshortcuts="Enter"
            >
              Kiểm tra
            </button>
          )}
        </div>
        {hintShown && !outcome && (
          <div className="callout dict-hint" aria-live="polite">
            <Icon icon={Lightbulb} size={16} />
            <div>
              <span className="muted">Gợi ý:</span> <span className="respell dict-hint-text">{hint}</span>
            </div>
          </div>
        )}
        {nudge && (
          <div className="callout callout-warn dict-nudge">
            <Icon icon={TriangleAlert} size={16} />
            <div>
              Hãy gõ những gì bạn nghe được, dù chỉ vài từ.{' '}
              <button type="button" className="dict-link" onClick={() => check(true)}>
                Chịu, xem đáp án
              </button>
            </div>
          </div>
        )}
        {!outcome && (
          <div className="dict-tools">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHintShown(true)} disabled={hintShown}>
              <Icon icon={Lightbulb} size={15} />
              Gợi ý
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
                Đúng {outcome.al.matched}/{outcome.al.total} từ
                {outcome.al.extra > 0 ? ` · thừa ${outcome.al.extra} từ` : ''}
                {hintShown ? ' · có dùng gợi ý' : ''}
              </>
            }
          />

          <DiffView units={outcome.units} vi={sentence.vi} />

          <WhyWrong
            cls={outcome.cls}
            annotations={decoded.annotations}
            segments={decoded.segments}
            activeId={activeAnn}
            onPlayStart={stop}
            ai={{ text: sentence.text, typed: answer, units: outcome.units }}
          />

          {outcome.al.score < 1 && <FollowUps sentence={sentence} />}

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
              {/* a missed spot already has its card under "Vì sao bạn nghe sai?": don't repeat it here */}
              {activeAnnotation && !outcome.cls.missedAnnotationIds.includes(activeAnnotation.id) && (
                <AnnotationCard a={activeAnnotation} active onPlayStart={stop} segments={decoded.segments} />
              )}
              {!activeAnnotation && outcome.cls.seenPhenomena.length > 0 && (
                <PhenomenonChips list={outcome.cls.seenPhenomena} />
              )}
            </section>
          )}

          <ResultActions canSpeak={canSpeak} onReplay={() => void play('normal', false)} onRetry={onRetry} onNext={onNext} />
        </div>
      )}
    </article>
  );
}
