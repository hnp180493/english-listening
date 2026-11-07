import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  CircleAlert,
  Frown,
  Info,
  Meh,
  Mic,
  Play,
  RotateCcw,
  ScanText,
  ShieldCheck,
  Smile,
  Square,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { Icon } from '../../components/Icon';
import PhTag from '../../components/PhTag';
import PlayButton from '../../components/PlayButton';
import SpokenSentence from '../../components/SpokenSentence';
import { decode } from '../../core/decoder';
import { hrefFor, navigate } from '../../core/nav';
import { useSettings } from '../../core/settings';
import { secureContextOk } from '../../core/speech';
import { recordAttempt } from '../../core/stats';
import { CAREFUL_ARIA, CAREFUL_LABEL, CAREFUL_RATE, CAREFUL_TITLE, CONNECTED_SLOW_TITLE, connectedText, sayOf } from '../../core/playback';
import { speak, stopSpeaking, ttsSupported } from '../../core/tts';
import type { Phenomenon } from '../../core/types';
import { transcriptCoversTarget } from './autostop';
import { evaluateShadow, seenPhenomena } from './feedback';
import FeedbackView from './FeedbackView';
import type { ShadowSource } from './sources';
import StepGuide from './StepGuide';
import {
  SELF_LABEL,
  SELF_SCORE,
  saveShadowAttempt,
  toPercent,
  type SelfRating,
  type ShadowItem,
  type ShadowState,
} from './store';
import { useClipPlayer } from './useClipPlayer';
import { useShadowRecorder, type RecOutcome } from './useRecorder';

const RATINGS: SelfRating[] = ['good', 'ok', 'bad'];
const RATING_ICON: Record<SelfRating, LucideIcon> = { good: Smile, ok: Meh, bad: Frown };

type VarStyle = CSSProperties & Record<`--${string}`, string>;

function delay(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}


function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

function History({ item }: { item: ShadowItem | undefined }) {
  // Nothing to show before the first take.
  if (!item) return null;
  return (
    <section className="card shadow-history" aria-labelledby="shadow-history-title">
      <div className="shadow-card-head shadow-card-head--row">
        <h2 id="shadow-history-title" className="shadow-h2">
          Lịch sử câu này
        </h2>
        <span className="meta shadow-history-sum">
          Cao nhất {toPercent(item.best)}% · {item.total} lần
        </span>
      </div>
      <ol className="shadow-bars" aria-label="Điểm các lần gần nhất, cũ nhất trước">
          {item.attempts.map((a, i) => {
            const p = toPercent(a.score);
            const style: VarStyle = { '--shadow-p': String(Math.max(4, p)) };
            return (
              <li
                key={`${a.at}-${i}`}
                className="shadow-bar"
                style={style}
                title={new Date(a.at).toLocaleString('vi-VN')}
              >
                <span className="shadow-bar-fill" aria-hidden="true" />
                <span className="shadow-bar-label">{a.self ? SELF_LABEL[a.self] : `${p}%`}</span>
                <span className="shadow-sr">{a.self ? `Tự chấm: ${SELF_LABEL[a.self]}` : `${p} phần trăm`}</span>
              </li>
            );
          })}
      </ol>
    </section>
  );
}

interface PracticePanelProps {
  source: ShadowSource;
  item: ShadowItem | undefined;
  nextId: string | null;
  onSaved: (state: ShadowState) => void;
}

export default function PracticePanel({ source, item, nextId, onSaved }: PracticePanelProps) {
  const { showIpa } = useSettings();
  const result = useMemo(() => decode(source.text), [source.text]);
  // The model the learner imitates must SOUND like the annotated sentence (tur-ni-doff), not a newsreader: the
  // connected version (say ?? speakText). "Rõ từng từ" is the only careful playback.
  const model = useMemo(() => connectedText(source.text, result, sayOf(source)), [source, result]);
  const [activeAnn, setActiveAnn] = useState<string | null>(null);
  const [interruptKey, setInterruptKey] = useState(0);
  const micBtn = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLElement>(null);

  const onLevel = useCallback((lv: number) => {
    micBtn.current?.style.setProperty('--shadow-level', lv.toFixed(3));
  }, []);
  const words = result.tokens.length;
  const targetRaw = useMemo(() => result.tokens.map((t) => t.raw), [result]);
  const isComplete = useCallback((t: string) => transcriptCoversTarget(targetRaw, t), [targetRaw]);
  const rec = useShadowRecorder({
    maxMs: Math.min(40000, Math.max(10000, words * 1000 + 6000)),
    onLevel,
    isComplete,
  });
  const customText = source.kind === 'custom' ? source.text : undefined;
  const outcome = rec.outcome;
  const clip = useClipPlayer(outcome?.audioUrl ?? null);

  const fb = useMemo(
    () => (outcome && outcome.transcript ? evaluateShadow(result, outcome.transcript) : null),
    [outcome, result],
  );
  const seen = useMemo(() => seenPhenomena(result, source.focus), [result, source.focus]);

  // Auto-scored take: save once per outcome.
  const recordedFor = useRef<RecOutcome | null>(null);
  useEffect(() => {
    if (!fb || !outcome || recordedFor.current === outcome) return;
    recordedFor.current = outcome;
    onSaved(saveShadowAttempt(source.itemId, { at: Date.now(), score: fb.score }, customText));
    recordAttempt({
      module: 'shadowing',
      itemId: source.itemId,
      correct: fb.score >= 0.9,
      seen,
      missed: fb.classified.missedPhenomena,
    });
  }, [fb, outcome, onSaved, seen, source.itemId, customText]);

  // Move focus to the result when a take finishes (keyboard / screen-reader users).
  useEffect(() => {
    if (rec.phase === 'done') resultRef.current?.focus({ preventScroll: false });
  }, [rec.phase]);

  // Self rating (no recognition, or nothing recognised).
  const [rating, setRating] = useState<{ for: RecOutcome | null; value: SelfRating } | null>(null);
  const rated = rating && rating.for === outcome ? rating.value : null;
  const rateSelf = (r: SelfRating) => {
    if (rated) return;
    setRating({ for: outcome, value: r });
    onSaved(saveShadowAttempt(source.itemId, { at: Date.now(), score: SELF_SCORE[r], self: r }, customText));
    recordAttempt({
      module: 'shadowing',
      itemId: source.itemId,
      correct: r === 'good',
      seen,
      missed: r === 'bad' ? seen : [],
    });
  };

  // Model then learner ("So sánh A-B").
  const abToken = useRef(0);
  const [abPlaying, setAbPlaying] = useState(false);
  const stopAB = useCallback(() => {
    abToken.current++;
    setAbPlaying(false);
  }, []);
  const playAB = async () => {
    const t = ++abToken.current;
    setAbPlaying(true);
    clip.stop();
    await speak(model, { rate: 1, mode: 'connected' });
    if (t !== abToken.current) return;
    await delay(350);
    if (t !== abToken.current) return;
    await clip.play();
    if (t === abToken.current) setAbPlaying(false);
  };
  const onAB = () => {
    if (abPlaying) {
      stopAB();
      stopSpeaking();
      clip.stop();
    } else void playAB();
  };
  const onUserClip = () => {
    stopAB();
    stopSpeaking();
    if (clip.playing) clip.stop();
    else void clip.play();
  };
  useEffect(
    () => () => {
      abToken.current++;
      stopSpeaking();
    },
    [],
  );

  const busy = rec.phase === 'recording' || rec.phase === 'starting' || rec.phase === 'stopping';
  const onMic = () => {
    if (!busy) {
      setInterruptKey((k) => k + 1);
      stopAB();
      clip.stop();
      setRating(null);
    }
    rec.toggle();
  };
  const retry = () => {
    setInterruptKey((k) => k + 1);
    stopAB();
    clip.stop();
    setRating(null);
    rec.start();
    micBtn.current?.focus();
  };
  const goNext = () => {
    if (nextId) navigate('shadowing', { id: nextId });
  };

  // Keyboard shortcuts: M record/stop, R/L listen 1.0× (R = "nghe lại" as in the other modules), S slow 0.8×, N next, Esc stop.
  // Keys pressed inside the nav (incl. the modal drawer) or any dialog, or already handled, are not ours.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    if (e.target instanceof Element && e.target.closest('nav, [data-popover], [role="dialog"], [role="alertdialog"]')) return;
    const k = e.key.toLowerCase();
    if (k === 'm') {
      e.preventDefault();
      onMic();
    } else if (k === 'r' || k === 'l' || k === 's') {
      if (busy) return;
      e.preventDefault();
      setInterruptKey((x) => x + 1);
      stopAB();
      clip.stop();
      void speak(model, { rate: k === 's' ? 0.8 : 1, mode: 'connected', slow: k === 's' });
    } else if (k === 'n' && nextId && !busy) {
      e.preventDefault();
      goNext();
    } else if (k === 'escape') {
      if (rec.phase === 'recording' || rec.phase === 'starting') rec.stop();
      setInterruptKey((x) => x + 1);
      stopAB();
      stopSpeaking();
      clip.stop();
    }
  };
  useEffect(() => {
    keyHandler.current = onKey;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const activeAnnotation = result.annotations.find((a) => a.id === activeAnn) ?? null;
  const phTypes: Phenomenon[] = [...new Set(result.annotations.map((a) => a.type))];

  const noInput = !rec.canRecord && !rec.canRecognize;
  const micLabel =
    rec.phase === 'starting'
      ? 'Đang mở micro… (cho phép micro nếu trình duyệt hỏi)'
      : rec.phase === 'recording'
        ? 'Đang ghi — nói xong bấm để dừng'
        : rec.phase === 'stopping'
          ? 'Đang xử lý…'
          : outcome
            ? 'Bấm để nói lại'
            : 'Bấm để bắt đầu nói';

  const showResult = !!outcome || noInput;

  return (
    <div className="shadow-panel">
      {/* 1 — model */}
      <section className="card shadow-target" aria-labelledby="shadow-target-title">
        <div className="shadow-card-head shadow-card-head--row">
          <h2 id="shadow-target-title" className="shadow-h2">
            <span className="shadow-stepno" aria-hidden="true">
              1
            </span>
            Nghe mẫu và quan sát
          </h2>
          {nextId && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={goNext}
              disabled={busy}
              aria-keyshortcuts="N"
              title="Câu tiếp (N)"
            >
              Câu tiếp
              <Icon icon={ArrowRight} size={15} />
            </button>
          )}
        </div>

        {phTypes.length > 0 && (
          <div className="shadow-meta">
            <PhTag p={phTypes[0]} more={phTypes.length - 1} />
          </div>
        )}

        {source.chunk && (
          <p className="shadow-chunk">
            <span lang="en">{source.chunk.written}</span>
            <span className="respell-sep" aria-hidden="true">
              →
            </span>
            <span className="respell" lang="en">
              {source.chunk.spoken}
            </span>
            <span className="muted"> · {source.chunk.meaning}</span>
          </p>
        )}

        <p className="shadow-text" lang="en">
          {source.text}
        </p>
        {source.vi && <p className="muted shadow-vi">{source.vi}</p>}

        {result.tokens.length > 0 && (
          <div className="panel shadow-spoken">
            <SpokenSentence
              result={result}
              activeAnnotationId={activeAnn}
              onAnnotationClick={(id) => setActiveAnn((cur) => (cur === id ? null : id))}
            />
          </div>
        )}

        {activeAnnotation ? (
          <div className="panel shadow-annbox" aria-live="polite">
            <p className="shadow-annbox-head">
              <PhTag p={activeAnnotation.type} />
              <span lang="en">{activeAnnotation.original}</span>
              <Icon icon={ArrowRight} size={14} className="shadow-arrow" />
              <span className="respell" lang="en">
                {activeAnnotation.spoken}
              </span>
              {showIpa && activeAnnotation.ipa && <span className="ipa">{activeAnnotation.ipa}</span>}
            </p>
            <p className="shadow-annbox-rule">{activeAnnotation.rule}</p>
          </div>
        ) : (
          result.annotations.length > 0 && (
            <p className="shadow-hint">
              <Icon icon={Info} size={14} />
              Đọc liền các từ trong cùng một cụm. Bấm cụm có màu để xem quy tắc.
            </p>
          )
        )}

        {/* Disabled while recording: the model voice must not leak into the microphone. */}
        <fieldset className="row shadow-model shadow-fieldset" disabled={busy} aria-label="Nghe câu mẫu">
          <PlayButton
            text={model}
            rate={1}
            mode="connected"
            label="Nghe 1.0×"
            variant="soft"
            title="Nghe mẫu, nói nhanh như ngoài đời (R)"
            onPlay={() => setInterruptKey((k) => k + 1)}
          />
          <PlayButton
            text={model}
            rate={0.8}
            slow
            mode="connected"
            label="Nghe chậm 0.8×"
            title={`${CONNECTED_SLOW_TITLE} (S)`}
            onPlay={() => setInterruptKey((k) => k + 1)}
          />
          <PlayButton
            text={source.text}
            rate={CAREFUL_RATE}
            mode="careful"
            label={CAREFUL_LABEL}
            size="sm"
            variant="ghost"
            title={CAREFUL_TITLE}
            ariaLabel={CAREFUL_ARIA}
            onPlay={() => setInterruptKey((k) => k + 1)}
          />
          <a className="btn btn-ghost btn-sm shadow-link" href={hrefFor('decoder', { text: source.text })}>
            <Icon icon={ScanText} size={15} />
            Giải mã chi tiết
          </a>
        </fieldset>
      </section>

      {/* 2 — phrase by phrase */}
      <StepGuide result={result} interruptKey={interruptKey} disabled={busy} />

      {/* 3 — record */}
      <section className="card shadow-rec" aria-labelledby="shadow-rec-title">
        <div className="shadow-card-head">
          <h2 id="shadow-rec-title" className="shadow-h2">
            <span className="shadow-stepno" aria-hidden="true">
              3
            </span>
            Đến lượt bạn nói
          </h2>
          <p className="muted shadow-sub">
            Nói cả câu đúng nhịp và nối âm như mẫu, rồi bấm lần nữa để dừng
            {rec.canRecognize ? ' (hoặc ngừng nói, máy tự dừng)' : ''}.
          </p>
        </div>

        {!secureContextOk() && (
          <p className="callout callout-warn shadow-alert">
            <Icon icon={TriangleAlert} size={16} />
            <span>
              Trang đang mở qua kết nối không bảo mật (http), nên trình duyệt sẽ chặn micro. Hãy mở ứng dụng bằng https:// hoặc
              http://localhost.
            </span>
          </p>
        )}
        {!rec.canRecognize && rec.canRecord && (
          <p className="callout shadow-alert">
            <Icon icon={Info} size={16} />
            <span>
              Trình duyệt này không có nhận dạng giọng nói (ví dụ Firefox), nên máy không chấm tự động. Bạn vẫn ghi âm, so sánh
              A-B và tự chấm. Dùng Chrome hoặc Edge để được chấm tự động.
            </span>
          </p>
        )}
        {noInput && (
          <p className="callout callout-warn shadow-alert">
            <Icon icon={TriangleAlert} size={16} />
            <span>Trình duyệt này không cho dùng micro. Bạn vẫn luyện được: nghe mẫu, nói to theo, rồi tự chấm ở phần kết quả.</span>
          </p>
        )}

        {!noInput && (
          <div className="shadow-mic-wrap">
            <button
              ref={micBtn}
              type="button"
              className={`shadow-mic is-${rec.phase}`}
              onClick={onMic}
              disabled={rec.phase === 'stopping'}
              aria-label={rec.phase === 'recording' ? 'Dừng ghi âm' : rec.phase === 'starting' ? 'Hủy mở micro' : 'Bắt đầu ghi âm'}
              aria-describedby="shadow-mic-label"
              aria-keyshortcuts="M"
              title="Ghi âm (M)"
            >
              <span className="shadow-mic-ring" aria-hidden="true" />
              {rec.phase === 'recording' ? (
                <Icon icon={Square} size={28} fill="currentColor" strokeWidth={1.5} />
              ) : (
                <Icon icon={Mic} size={34} strokeWidth={2.2} />
              )}
            </button>
            <p id="shadow-mic-label" className="shadow-mic-label">
              {micLabel}
            </p>
          </div>
        )}

        {(rec.phase === 'recording' || rec.phase === 'stopping') && (
          <div className="shadow-live" aria-live="polite">
            <span className="shadow-live-tag">{rec.canRecognize && !rec.notice ? 'Máy đang nghe' : 'Đang ghi âm'}</span>
            <p className={'shadow-live-text' + (rec.interim ? '' : ' is-empty')} lang={rec.interim ? 'en' : undefined}>
              {rec.interim ||
                (rec.canRecognize && !rec.notice ? 'Hãy bắt đầu nói…' : 'Nói cả câu, xong bấm nút để dừng.')}
            </p>
            {rec.notice && <p className="shadow-live-note">{rec.notice}</p>}
          </div>
        )}

        {rec.error && (
          <div className="callout callout-bad shadow-alert" role="alert">
            <Icon icon={CircleAlert} size={16} />
            <div>
              <p>
                {rec.error.kind === 'permission' ? (
                  <>
                    <b>Micro đang bị chặn.</b> Hãy cho phép trang dùng micro:
                  </>
                ) : (
                  rec.error.message
                )}
              </p>
              {rec.error.kind === 'permission' && (
                <ol className="shadow-alert-steps">
                  <li>Bấm biểu tượng ổ khóa / micro ở bên trái thanh địa chỉ.</li>
                  <li>Ở mục “Micro”, chọn “Cho phép”.</li>
                  <li>Tải lại trang rồi bấm micro lần nữa.</li>
                </ol>
              )}
            </div>
          </div>
        )}

        <div className="shadow-foot">
          <p className="shadow-privacy">
            <Icon icon={ShieldCheck} size={15} />
            <span>
              Bản ghi chỉ nằm tạm trong trang, không lưu, không tải lên.
              {rec.canRecognize && ' Riêng phần chuyển giọng thành chữ, Chrome/Edge gửi âm thanh tới máy chủ Google/Microsoft.'}
            </span>
          </p>
        </div>
      </section>

      {/* 4 — result */}
      {showResult && (
        <section
          className="card shadow-result"
          aria-labelledby="shadow-result-title"
          ref={resultRef}
          tabIndex={-1}
        >
          <div className="shadow-card-head">
            <h2 id="shadow-result-title" className="shadow-h2">
              <span className="shadow-stepno" aria-hidden="true">
                4
              </span>
              Kết quả
            </h2>
          </div>

          {fb ? (
            <FeedbackView fb={fb} />
          ) : outcome ? (
            <div className={'callout shadow-alert' + (outcome.usedRecognition ? ' callout-warn' : '')}>
              <Icon icon={outcome.usedRecognition ? TriangleAlert : Info} size={16} />
              <span>
                {outcome.usedRecognition
                  ? (outcome.recognitionError?.message ??
                      'Máy chưa nhận ra câu nào. Hãy nói to, rõ và gần micro hơn rồi thử lại.') +
                    (outcome.audioUrl ? ' Trong lúc đó, bạn có thể nghe lại bản ghi và tự chấm.' : '')
                  : 'Hãy nghe lại giọng mình, so sánh A-B với mẫu, rồi tự chấm thật lòng.'}
              </span>
            </div>
          ) : null}

          {(outcome || ttsSupported()) && (
            <div className="row shadow-playback" role="group" aria-label="Nghe lại">
              <PlayButton
                text={model}
                rate={1}
                mode="connected"
                label="Nghe mẫu"
                variant="soft"
                onPlay={() => {
                  stopAB();
                  clip.stop();
                }}
              />
              {outcome && (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={onUserClip}
                    disabled={!outcome.audioUrl}
                    aria-pressed={clip.playing && !abPlaying}
                    title={outcome.audioUrl ? 'Nghe lại bản ghi của bạn' : 'Không có bản ghi âm'}
                  >
                    {clip.playing && !abPlaying ? (
                      <Icon icon={Square} size={14} fill="currentColor" strokeWidth={1.5} />
                    ) : (
                      <Icon icon={Play} size={15} fill="currentColor" strokeWidth={1.5} />
                    )}
                    {clip.playing && !abPlaying ? 'Dừng' : 'Nghe giọng bạn'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={onAB}
                    disabled={!outcome.audioUrl || !ttsSupported()}
                    aria-pressed={abPlaying}
                    title="Phát câu mẫu, rồi ngay sau đó phát giọng bạn"
                  >
                    {abPlaying ? (
                      <Icon icon={Square} size={14} fill="currentColor" strokeWidth={1.5} />
                    ) : (
                      <Icon icon={ArrowLeftRight} size={16} />
                    )}
                    {abPlaying ? 'Dừng' : 'So sánh A-B'}
                  </button>
                </>
              )}
            </div>
          )}

          {!fb && (
            <div className="panel shadow-self" role="group" aria-labelledby="shadow-self-title">
              <p id="shadow-self-title" className="shadow-self-title">
                <b>Tự chấm:</b> bạn nói giống mẫu đến đâu?
              </p>
              <ul className="muted shadow-self-tips">
                <li>Các từ trong cùng một cụm màu có được nối liền?</li>
                <li>Âm yếu (to, and, of…) có lướt nhẹ như mẫu?</li>
                <li>Nhịp, trọng âm và ngữ điệu có giống?</li>
              </ul>
              <div className="row shadow-rates">
                {RATINGS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`btn shadow-rate is-${r}` + (rated === r ? ' is-picked' : '')}
                    onClick={() => rateSelf(r)}
                    disabled={!!rated}
                    aria-pressed={rated === r}
                  >
                    <Icon icon={RATING_ICON[r]} size={16} />
                    {SELF_LABEL[r]}
                  </button>
                ))}
              </div>
              {rated && (
                <p className="muted shadow-self-done" role="status">
                  Đã ghi nhận: {SELF_LABEL[rated]}.{' '}
                  {rated === 'good' ? 'Thử câu tiếp theo nhé!' : 'Luyện từng cụm rồi nói lại một lần nữa.'}
                </p>
              )}
            </div>
          )}

          <div className="row shadow-next">
            {!noInput && (
              <button type="button" className="btn" onClick={retry} disabled={busy}>
                <Icon icon={RotateCcw} size={15} />
                Nói lại
              </button>
            )}
            {noInput && rated && (
              <button type="button" className="btn" onClick={() => setRating(null)}>
                <Icon icon={RotateCcw} size={15} />
                Chấm lần nữa
              </button>
            )}
            {nextId && (
              <button type="button" className="btn btn-primary" onClick={goNext} disabled={busy}>
                Câu tiếp theo
                <Icon icon={ArrowRight} size={16} />
              </button>
            )}
          </div>
        </section>
      )}

      <History item={item} />
    </div>
  );
}
