// "Chép chính tả" for one real-speech unit: type what you hear, see a coloured diff
// and which connected-speech events caused the misses.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Check, Eye, Lightbulb, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PhTag from '../../components/PhTag';
import { align, type AlignResult } from '../../core/dictation/align';
import { classify, type ClassifyResult } from '../../core/dictation/classify';
import { buildDiff, type DiffUnit } from '../../core/dictation/diff';
import { makeHint } from '../../core/dictation/hint';
import { normalizeText, splitWords } from '../../core/dictation/normalize';
import type { DecodeResult } from '../../core/types';
import SpokenSentence from '../../components/SpokenSentence';
import { DONE_SCORE } from './library';

export interface CheckOutcome {
  score: number;
  seen: ClassifyResult['seenPhenomena'];
  missed: ClassifyResult['missedPhenomena'];
  /** This check follows "Thử lại câu này" on the same sentence: not a new attempt for the stats. */
  retry: boolean;
  /** The first-letter hint was shown during this attempt. */
  hinted: boolean;
  total: number; // AlignResult.total (target words)
  matched: number; // AlignResult.matched (typo matches count as matched)
  extra: number; // AlignResult.extra (extra words typed)
  revealed: boolean; // "Chịu, xem đáp án"
}

interface Props {
  text: string;
  decoded: DecodeResult;
  bestScore?: number;
  isLast: boolean;
  onChecked: (o: CheckOutcome) => void;
  onReplay: () => void;
  onNext: () => void;
  /** Another action is the view's primary (e.g. "Chọn tệp…" while the audio file is missing): no gradient here. */
  quiet?: boolean;
}

interface Result {
  al: AlignResult;
  cls: ClassifyResult;
  units: DiffUnit[];
  revealed: boolean;
}

function verdict(score: number, revealed: boolean): string {
  if (revealed) return 'Đáp án đây: nghe lại vài lần cho quen tai nhé';
  if (score >= 1) return 'Chính xác!';
  if (score >= DONE_SCORE) return 'Gần đúng rồi, tính là đã xong';
  if (score >= 0.5) return 'Nghe được hơn một nửa';
  return 'Câu này khó, nghe lại từng đoạn nhé';
}

export default function DictationPanel({ text, decoded, bestScore, isLast, onChecked, onReplay, onNext, quiet }: Props) {
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [hint, setHint] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [activeAnn, setActiveAnn] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const targetRaw = useMemo(() => splitWords(text), [text]);
  const checkingRef = useRef(false);
  // same semantics as the main dictation: a retry is not a new attempt, a hinted answer is not "correct"
  const retriedRef = useRef(false);
  const hintedRef = useRef(false);

  useEffect(() => {
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (!coarse) inputRef.current?.focus({ preventScroll: true });
  }, []);

  const check = (reveal: boolean) => {
    if (result || checkingRef.current) return;
    if (!reveal && !normalizeText(answer)) {
      setNudge(true);
      inputRef.current?.focus();
      return;
    }
    checkingRef.current = true;
    const answerRaw = splitWords(answer);
    const al = align(targetRaw, answerRaw);
    const cls = classify(decoded, al.ops, answerRaw, targetRaw);
    const units = buildDiff(targetRaw, answerRaw, al.ops);
    setResult({ al, cls, units, revealed: reveal });
    setNudge(false);
    setActiveAnn(cls.missedAnnotationIds[0] ?? null);
    onChecked({
      score: al.score,
      seen: cls.seenPhenomena,
      missed: cls.missedPhenomena,
      retry: retriedRef.current,
      hinted: hintedRef.current || hint,
      total: al.total,
      matched: al.matched,
      extra: al.extra,
      revealed: reveal,
    });
  };

  const toggleHint = () => {
    if (!hint) hintedRef.current = true;
    setHint(!hint);
  };

  const retry = () => {
    checkingRef.current = false;
    retriedRef.current = true;
    hintedRef.current = hint;
    setResult(null);
    setActiveAnn(null);
    requestAnimationFrame(() => inputRef.current?.focus());
    onReplay();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onReplay();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (e.repeat) return;
      if (result) onNext();
      else check(false);
    }
  };

  const pct = result ? Math.round(result.al.score * 100) : 0;
  const tone = !result ? '' : result.al.score >= 1 ? 'ok' : result.al.score >= DONE_SCORE ? 'ok' : result.al.score >= 0.5 ? 'warn' : 'bad';
  const active = decoded.annotations.find((a) => a.id === activeAnn) ?? null;
  const errorsOther = result ? result.cls.errors.filter((e) => e.category === 'other').length : 0;

  return (
    <div className="media-dict">
      <div className="media-dict-head">
        <label className="field-label media-dict-label" htmlFor="media-dict-input">
          Gõ lại câu bạn vừa nghe
        </label>
        {bestScore !== undefined && <span className="badge media-best">Cao nhất {Math.round(bestScore * 100)}%</span>}
      </div>
      {hint && !result && (
        <p className="media-hint" lang="en" aria-label="Gợi ý chữ cái đầu">
          {makeHint(targetRaw)}
        </p>
      )}
      <textarea
        id="media-dict-input"
        ref={inputRef}
        className="textarea media-dict-input"
        rows={2}
        lang="en"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        placeholder="Gõ những gì bạn nghe được…"
        value={answer}
        readOnly={!!result}
        onChange={(e) => {
          setAnswer(e.target.value);
          if (nudge) setNudge(false);
        }}
        onKeyDown={onKeyDown}
      />
      {nudge && (
        <p className="media-nudge" role="alert">
          <Icon icon={TriangleAlert} size={15} />
          Hãy gõ ít nhất một từ bạn nghe được, sai cũng không sao.
        </p>
      )}

      {!result ? (
        <div className="row media-dict-actions">
          <button
            type="button"
            className={'btn ' + (quiet ? 'btn-soft' : 'btn-primary')}
            onClick={() => check(false)}
            aria-keyshortcuts="Enter"
          >
            Kiểm tra
          </button>
          <button type="button" className="btn" onClick={onReplay} aria-keyshortcuts="Escape">
            <Icon icon={RotateCcw} size={15} />
            Nghe lại
          </button>
          <button type="button" className={'btn ' + (hint ? 'btn-soft' : 'btn-ghost')} aria-pressed={hint} onClick={toggleHint}>
            <Icon icon={Lightbulb} size={15} />
            {hint ? 'Ẩn gợi ý' : 'Gợi ý chữ đầu'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => check(true)}>
            <Icon icon={Eye} size={15} />
            Chịu, xem đáp án
          </button>
        </div>
      ) : (
        <div className="media-result" aria-live="polite">
          <div className={`media-score media-score-${tone}`}>
            <span className="media-score-icon" aria-hidden="true">
              <Icon icon={tone === 'ok' ? Check : tone === 'warn' ? Lightbulb : X} size={18} strokeWidth={2.5} />
            </span>
            <strong className="media-score-num">{pct}%</strong>
            <span>{verdict(result.al.score, result.revealed)}</span>
          </div>

          <p className="media-diff" lang="en" aria-label="So sánh câu của bạn với câu gốc">
            {result.units.map((u, k) => {
              switch (u.kind) {
                case 'ok':
                  return (
                    <span key={k} className="media-w media-w-ok">
                      {u.target}
                    </span>
                  );
                case 'typo':
                  return (
                    <span key={k} className="media-w media-w-typo" title={`Bạn gõ “${u.answer}” — lỗi chính tả nhỏ, vẫn tính đúng`}>
                      {u.target}
                    </span>
                  );
                case 'wrong':
                  return (
                    <span key={k} className="media-w media-w-bad">
                      <s className="media-w-typed" aria-label={`bạn gõ ${u.answer}`}>
                        {u.answer}
                      </s>{' '}
                      <span>{u.target}</span>
                    </span>
                  );
                case 'missing':
                  return (
                    <span key={k} className="media-w media-w-miss" title="Bạn bỏ sót từ này">
                      {u.target}
                    </span>
                  );
                case 'extra':
                  return (
                    <s key={k} className="media-w media-w-extra" title="Từ thừa — câu gốc không có">
                      {u.answer}
                    </s>
                  );
                case 'skip':
                  return (
                    <span key={k} className="media-w">
                      {u.target}
                    </span>
                  );
              }
            })}
          </p>
          <div className="media-legend muted" aria-hidden="true">
            <span>
              <i className="media-lg media-lg-ok" /> đúng
            </span>
            <span>
              <i className="media-lg media-lg-bad" /> sai
            </span>
            <span>
              <i className="media-lg media-lg-miss" /> thiếu
            </span>
            <span>
              <s>thừa</s>
            </span>
          </div>

          {result.cls.missedPhenomena.length > 0 && (
            <div className="panel media-why">
              <p className="media-why-title">Bạn hụt ở chỗ có hiện tượng:</p>
              <div className="row">
                <PhTag p={result.cls.missedPhenomena[0]} more={result.cls.missedPhenomena.length - 1} />
              </div>
              <SpokenSentence
                result={decoded}
                compact
                activeAnnotationId={activeAnn}
                onAnnotationClick={(id) => setActiveAnn((cur) => (cur === id ? null : id))}
              />
              {active && (
                <div className="media-rule">
                  <p className="media-rule-head">
                    <PhTag p={active.type} />
                    <span lang="en">{active.original}</span>
                    <Icon icon={ArrowRight} size={14} className="media-arrow" />
                    <span className="respell media-rule-spoken" lang="en">
                      {active.spoken}
                    </span>
                  </p>
                  <p>{active.rule}</p>
                </div>
              )}
            </div>
          )}
          {result.cls.missedPhenomena.length === 0 && errorsOther > 0 && (
            <p className="media-why-note muted">
              Lỗi ở câu này không nằm ở chỗ nối âm: có thể là từ vựng mới hoặc tốc độ nói. Thử giảm tốc độ xuống 0.75×.
            </p>
          )}

          <div className="row media-dict-actions">
            <button type="button" className={'btn ' + (quiet ? 'btn-soft' : 'btn-primary')} onClick={onNext}>
              {isLast ? 'Tiếp tục' : 'Câu sau'}
              <Icon icon={ArrowRight} size={16} />
            </button>
            <button type="button" className="btn" onClick={retry}>
              <Icon icon={RotateCcw} size={15} />
              Thử lại câu này
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
