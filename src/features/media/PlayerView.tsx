// Practise one library item sentence by sentence with the real audio.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Film,
  Headphones,
  History,
  Mic,
  Pause,
  PartyPopper,
  PencilLine,
  Play,
  RotateCcw,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import Segmented from '../../components/Segmented';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import { decode } from '../../core/decoder';
import { formatClock } from '../../core/media/transcript';
import { hrefFor, navigate } from '../../core/nav';
import { makeCardId, mediaRef, recordReview } from '../../core/review';
import { recordAttempt } from '../../core/stats';
import { reviewNoteVi } from '../dictation/pageModel';
import DictationPanel, { type CheckOutcome } from './DictationPanel';
import TranscriptList from './TranscriptList';
import WatchPanel from './WatchPanel';
import { FileSurface, YouTubeSurface, type MediaHandle } from './surfaces';
import {
  SPEEDS,
  clampIndex,
  nextUndone,
  playWindow,
  recordScore,
  resetProgress,
  setDone,
  setUnitIndex,
  unitAtTime,
  type MediaItem,
  type MediaPrefs,
  type PracticeMode,
} from './library';
import { mediaReviewPlan } from './reviewPlan';
import { useListenAutoLog } from './listenAutoLog';
import { dismissSaveWarning, isSessionOnly, rememberFile, rememberedFile, setPrefs, updateItem, useSaveFailed } from './store';

interface Bound {
  index: number;
  start: number;
  end: number;
  startedAt: number;
  armed: boolean; // the player has reported a time inside the window since the seek
}

const SHORTCUTS = [
  { keys: ['Space'], text: 'Phát / dừng câu' },
  { keys: ['R'], text: 'Lặp lại câu' },
  { keys: ['←'], text: 'Câu trước' },
  { keys: ['→'], text: 'Câu sau' },
  { keys: ['Enter'], text: 'Chép chính tả: kiểm tra, rồi sang câu sau' },
  { keys: ['Esc'], text: 'Chép chính tả: nghe lại câu' },
];

const LOOP_PAUSE_MS = 700;
/** How long to wait for the player to report a time inside the window after a seek. */
const ARM_TIMEOUT_MS = 4000;
/** Keyframe seeks can land a little before the requested time. */
const SEEK_SLACK = 2;

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

/**
 * `startUnit`: a transcript line asked for by the URL (#/media?id=…&unit=n, e.g. "Mở video" in Ôn tập). The
 * player opens on it instead of the saved position and seeks there once the player is ready.
 */
export default function PlayerView({ item, prefs, startUnit }: { item: MediaItem; prefs: MediaPrefs; startUnit?: number }) {
  const units = item.units;
  // MediaPage remounts the player when the requested line changes, so this is fixed for the component's life
  const requested = startUnit !== undefined && startUnit >= 0 && startUnit < units.length ? startUnit : -1;
  const [index, setIndexState] = useState(() => (requested >= 0 ? requested : clampIndex(item.progress.unitIndex, units.length)));
  // the line the URL asked for, until the player has been seeked to it
  const pendingSeek = useRef(requested);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the sentence whose answer the dictation check has just shown (unmasked in the sidebar)
  const [revealed, setRevealed] = useState(-1);
  // when the checked line comes back in Ôn tập (shown under the dictation panel of that line)
  const [reviewNote, setReviewNote] = useState<{ index: number; text: string } | null>(null);
  const saveFailed = useSaveFailed();
  // Real playing time goes to "Nhật ký nghe" (source 'app'); see listenAutoLog.ts. Only free listening counts:
  // dictation mode and the sentence loop replay one line, which is practice, not real listening.
  useListenAutoLog(item.id, item.title, playing && prefs.mode === 'watch' && !prefs.autoLoop);
  const [file, setFile] = useState<File | null>(() => (item.kind === 'file' ? (rememberedFile(item.id) ?? null) : null));

  const handleRef = useRef<MediaHandle | null>(null);
  const boundRef = useRef<Bound | null>(null);
  const loopTimer = useRef<number | undefined>(undefined);
  const endTimer = useRef<number | undefined>(undefined); // precise stop scheduled just before the end
  const prefsRef = useRef(prefs);
  const indexRef = useRef(index);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // mark as opened (once per item); a line asked for by the URL also becomes the saved position
  useEffect(() => {
    updateItem(item.id, (it) => {
      const opened = { ...it, openedAt: Date.now() };
      return requested >= 0 ? setUnitIndex(opened, requested) : opened;
    });
  }, [item.id, requested]);

  const unit = units[index];
  const decoded = useMemo(() => decode(unit?.text ?? ''), [unit?.text]);
  const doneSet = useMemo(() => new Set(item.progress.done), [item.progress.done]);
  const allDone = units.length > 0 && item.progress.done.length >= units.length;

  // ---------------------------------------------------------------- playback

  const clearLoop = () => {
    if (loopTimer.current !== undefined) window.clearTimeout(loopTimer.current);
    loopTimer.current = undefined;
    if (endTimer.current !== undefined) window.clearTimeout(endTimer.current);
    endTimer.current = undefined;
  };

  const playUnit = useCallback(
    (i: number) => {
      const h = handleRef.current;
      clearLoop();
      if (!h) return;
      const w = playWindow(units, i);
      h.setRate(prefsRef.current.speed);
      h.seek(w.start);
      h.play();
      boundRef.current = { index: i, start: w.start, end: w.end, startedAt: performance.now(), armed: false };
    },
    [units],
  );

  const stop = useCallback(() => {
    clearLoop();
    boundRef.current = null;
    handleRef.current?.pause();
  }, []);

  const setIndex = useCallback(
    (i: number) => {
      const n = clampIndex(i, units.length);
      // a new line gets a fresh dictation panel: the previous line's review note does not apply to it
      if (n !== indexRef.current) setReviewNote(null);
      setIndexState(n);
      updateItem(item.id, (it) => setUnitIndex(it, n));
    },
    [item.id, units.length],
  );

  const goTo = useCallback(
    (i: number, autoplay = true) => {
      const n = clampIndex(i, units.length);
      setIndex(n);
      if (autoplay) playUnit(n);
      else stop();
    },
    [playUnit, setIndex, stop, units.length],
  );

  const replay = useCallback(() => playUnit(indexRef.current), [playUnit]);
  const togglePlay = useCallback(() => {
    if (handleRef.current?.playing()) stop();
    else playUnit(indexRef.current);
  }, [playUnit, stop]);

  // 100 ms polling: stop at the unit end (or loop), follow free playback in watch mode
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const h = handleRef.current;
      if (!h || !h.playing()) return;
      const t = h.time();
      const b = boundRef.current;
      if (b) {
        if (!b.armed) {
          // After a seek (and while buffering) YouTube may keep reporting the OLD time: never
          // treat that as "the learner scrubbed away", just wait until it lands in the window.
          if (t >= b.start - SEEK_SLACK && t < b.end + 1) b.armed = true;
          else {
            if (performance.now() - b.startedAt > ARM_TIMEOUT_MS) boundRef.current = null;
            return;
          }
        }
        if (t < b.start - SEEK_SLACK - 0.5 || t > b.end + 1.5) {
          boundRef.current = null; // the learner scrubbed elsewhere: free playback
          return;
        }
        const finish = () => {
          if (boundRef.current !== b) return;
          h.pause();
          boundRef.current = null;
          clearLoop();
          if (prefsRef.current.autoLoop) {
            loopTimer.current = window.setTimeout(() => playUnit(b.index), LOOP_PAUSE_MS);
          }
        };
        const left = (b.end - t) / (prefsRef.current.speed || 1); // wall-clock seconds to the end
        if (left <= 0.01) finish();
        else if (left < 0.15 && endTimer.current === undefined) {
          // a 100 ms poll alone can overshoot into the next sentence: stop on time instead
          endTimer.current = window.setTimeout(() => {
            endTimer.current = undefined;
            finish();
          }, left * 1000);
        }
        return;
      }
      if (prefsRef.current.mode === 'watch') {
        const i = unitAtTime(units, t + 0.05);
        if (i >= 0 && i !== indexRef.current) setIndex(i);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [ready, units, playUnit, setIndex]);

  // cleanup on unmount
  useEffect(
    () => () => {
      clearLoop();
      boundRef.current = null;
    },
    [],
  );

  const onReady = useCallback((h: MediaHandle | null) => {
    handleRef.current = h;
    setReady(!!h);
    if (h) {
      setError(null);
      h.setRate(prefsRef.current.speed);
      // opened on a line from the URL: put the player at its start (no autoplay: there was no gesture yet)
      const at = pendingSeek.current;
      if (at >= 0 && at === indexRef.current) {
        pendingSeek.current = -1;
        try {
          h.seek(playWindow(units, at).start);
        } catch {
          // the learner can still press "Phát câu", which seeks itself
        }
      }
    } else setPlaying(false);
  }, [units]);
  const onError = useCallback((msg: string) => setError(msg), []);
  const onPlayingChange = useCallback((p: boolean) => setPlaying(p), []);

  // ---------------------------------------------------------------- prefs

  const setSpeed = (s: MediaPrefs['speed']) => {
    setPrefs({ speed: s });
    handleRef.current?.setRate(s);
  };
  const setMode = (m: PracticeMode) => {
    setPrefs({ mode: m });
    setReviewNote(null); // the dictation panel starts over when it comes back
    if (m === 'dictation') stop();
  };

  // ---------------------------------------------------------------- progress

  const onChecked = (o: CheckOutcome) => {
    const i = indexRef.current;
    setRevealed(i);
    updateItem(item.id, (it) => recordScore(it, i, o.score));
    // like the main dictation: retrying the same sentence is not a new attempt, and a
    // perfect answer typed with the first-letter hint does not count as "correct"
    if (!o.retry) {
      try {
        recordAttempt({
          module: 'media',
          itemId: `${item.id}:${i}`,
          correct: o.score === 1 && !o.hinted,
          seen: o.seen,
          missed: o.missed,
        });
      } catch {
        // stats are best-effort (as in the main dictation)
      }
    }
    // spaced review: imperfect lines enter Ôn tập (read aloud by TTS there); a retry is practice only
    try {
      const plan = mediaReviewPlan(o, isSessionOnly(item.id));
      if (plan) {
        const now = Date.now(); // one clock for the grade and the line
        const r = recordReview(makeCardId('media', mediaRef(item.id, i)), plan.grade, { ctx: 'practice', enrol: plan.enrol, now });
        const text = reviewNoteVi(r, now);
        setReviewNote(text ? { index: i, text } : null);
      }
    } catch {
      // review is best-effort: the practice itself is saved above
    }
  };

  const toggleDone = () => {
    const i = indexRef.current;
    updateItem(item.id, (it) => setDone(it, i, !it.progress.done.includes(i)));
  };

  const next = useCallback(() => {
    const i = indexRef.current;
    if (i < units.length - 1) goTo(i + 1);
    else {
      const u = nextUndone(item, 0);
      if (u >= 0 && u !== i) goTo(u);
      else stop();
    }
  }, [goTo, item, stop, units.length]);
  const prev = useCallback(() => goTo(indexRef.current - 1), [goTo]);
  const jump = useCallback((i: number) => goTo(i), [goTo]);

  // ---------------------------------------------------------------- keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest('[role="dialog"], [data-popover], .app-settings')) return;
      const k = e.key;
      if (e.repeat && (k === ' ' || k === 'r' || k === 'R')) {
        e.preventDefault(); // holding the key must not restart the sentence 30×/s
        return;
      }
      if (k === 'r' || k === 'R') {
        e.preventDefault();
        replay();
      } else if (k === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (k === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (k === ' ' && !(t && t.closest('button, a, [role="button"], video, audio'))) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, replay, togglePlay]);

  // ---------------------------------------------------------------- render

  const undoneTarget = nextUndone(item, index + 1);
  const mode = prefs.mode;
  const maskList = mode === 'dictation' || !prefs.showSubs;
  const fileMismatch = item.kind === 'file' && file && item.fileName && file.name !== item.fileName;

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    rememberFile(item.id, f);
    setError(null);
    setFile(f);
  };

  return (
    <div className="media-player stack-lg page-focus">
      <PageHeader
        back={{ href: hrefFor('media'), label: 'Thư viện' }}
        title={item.title}
        subtitle={`${item.kind === 'youtube' ? 'YouTube' : item.fileType === 'audio' ? 'Audio' : 'Video'} · ${units.length} câu`}
        help={<ShortcutsHelp items={SHORTCUTS} note="Phím chữ và mũi tên không dùng được khi đang gõ." />}
      />

      {isSessionOnly(item.id) && (
        <p className="callout callout-warn" role="status">
          <Icon icon={TriangleAlert} size={16} />
          <span>
            Mục này chưa lưu được vào trình duyệt (bộ nhớ đầy hoặc chế độ ẩn danh): tiến độ sẽ mất khi tải lại trang. Hãy xoá bớt
            video cũ trong thư viện rồi thêm lại.
          </span>
        </p>
      )}

      {saveFailed && !isSessionOnly(item.id) && (
        <div className="callout callout-warn media-save-warn" role="status">
          <Icon icon={TriangleAlert} size={16} />
          <span>
            Chưa lưu được tiến độ mới vào trình duyệt (bộ nhớ có thể đã đầy). Bạn vẫn luyện tiếp được, nhưng tải lại trang có thể
            mất phần vừa làm.
          </span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={dismissSaveWarning}>
            Đã hiểu
          </button>
        </div>
      )}

      {allDone && (
        <div className="card media-complete" role="status">
          <IconTile icon={PartyPopper} tint="var(--text-muted)" size="lg" />
          <div>
            <strong>Bạn đã xong cả {units.length} câu!</strong>
            <p className="muted">Giờ hãy xem lại cả video ở tốc độ 1×, không bật phụ đề: bạn sẽ nghe được nhiều hơn hẳn.</p>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                updateItem(item.id, resetProgress);
                goTo(0, false);
              }}
            >
              Luyện lại từ đầu
            </button>
            <a className="btn btn-sm btn-ghost" href={hrefFor('media')}>
              Chọn video khác
            </a>
          </div>
        </div>
      )}

      <div className="media-layout">
        <div className="media-main stack">
          <section className="card media-stage" aria-label="Trình phát">
            {item.kind === 'youtube' && item.youtubeId ? (
              <YouTubeSurface videoId={item.youtubeId} onReady={onReady} onError={onError} onPlayingChange={onPlayingChange} />
            ) : file ? (
              <FileSurface
                file={file}
                fileType={item.fileType ?? 'video'}
                onReady={onReady}
                onError={onError}
                onPlayingChange={onPlayingChange}
              />
            ) : (
              <div className="media-repick">
                <IconTile icon={item.fileType === 'audio' ? Headphones : Film} tint="var(--text-muted)" size="lg" />
                <p className="media-repick-title">Chọn lại tệp để nghe</p>
                <p className="muted">
                  Trình duyệt chỉ lưu phụ đề và tiến độ, không lưu tệp. Hãy chọn lại tệp
                  {item.fileName ? (
                    <>
                      {' '}
                      <strong className="media-filename">{item.fileName}</strong>
                    </>
                  ) : null}{' '}
                  trên máy bạn.
                </p>
                <label className="btn btn-primary media-file-btn">
                  <Icon icon={Upload} size={16} />
                  Chọn tệp…
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    className="media-file-input"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </label>
              </div>
            )}
            {fileMismatch && (
              <p className="callout callout-warn" role="status">
                <Icon icon={TriangleAlert} size={16} />
                <span>
                  Tệp bạn chọn (<strong>{file?.name}</strong>) khác tên với tệp đã lưu (<strong>{item.fileName}</strong>). Nếu câu
                  không khớp tiếng, hãy chọn đúng tệp.{' '}
                  <label className="media-link-btn">
                    Chọn tệp khác
                    <input
                      type="file"
                      accept="audio/*,video/*"
                      className="media-file-input"
                      onChange={(e) => pickFile(e.target.files?.[0])}
                    />
                  </label>
                </span>
              </p>
            )}
            {error && (
              <p className="callout callout-bad" role="alert">
                <Icon icon={CircleAlert} size={16} />
                <span>{error}</span>
              </p>
            )}

            <div className="media-controls" role="group" aria-label="Điều khiển câu">
              <button
                type="button"
                className="btn"
                onClick={prev}
                disabled={index <= 0}
                aria-label="Câu trước"
                aria-keyshortcuts="ArrowLeft"
                title="Câu trước (←)"
              >
                <Icon icon={ChevronLeft} size={18} />
                <span className="media-hide-sm">Câu trước</span>
              </button>
              <button
                type="button"
                className={'btn media-play ' + (mode === 'dictation' ? 'btn-soft' : 'btn-primary')}
                onClick={togglePlay}
                disabled={!ready}
                aria-label={playing ? 'Dừng' : 'Phát câu này'}
                aria-keyshortcuts="Space"
                title="Phát / dừng (Space)"
              >
                {playing ? (
                  <Icon icon={Pause} size={17} fill="currentColor" strokeWidth={1.5} />
                ) : (
                  <Icon icon={Play} size={17} fill="currentColor" strokeWidth={1.5} />
                )}
                {playing ? 'Dừng' : 'Phát câu'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={replay}
                disabled={!ready}
                aria-label="Lặp lại"
                aria-keyshortcuts="R"
                title="Lặp lại (R)"
              >
                <Icon icon={RotateCcw} size={16} />
                <span className="media-hide-sm">Lặp lại</span>
              </button>
              <button
                type="button"
                className="btn"
                onClick={next}
                disabled={units.length === 0}
                aria-label="Câu sau"
                aria-keyshortcuts="ArrowRight"
                title="Câu sau (→)"
              >
                <span className="media-hide-sm">Câu sau</span>
                <Icon icon={ChevronRight} size={18} />
              </button>
            </div>

            <div className="media-options">
              <Segmented
                ariaLabel="Tốc độ phát"
                value={prefs.speed}
                onChange={setSpeed}
                options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))}
                className="media-speed"
              />
              <label className="media-toggle">
                <input
                  type="checkbox"
                  className="switch"
                  checked={prefs.autoLoop}
                  onChange={(e) => setPrefs({ autoLoop: e.target.checked })}
                />
                Tự lặp lại
              </label>
              <label className="media-toggle">
                <input
                  type="checkbox"
                  className="switch"
                  checked={prefs.showSubs}
                  onChange={(e) => setPrefs({ showSubs: e.target.checked })}
                />
                Hiện phụ đề
              </label>
            </div>
            {unit && (
              <p className="meta media-unit-meta">
                Câu {index + 1}/{units.length} · {formatClock(unit.start)}–{formatClock(unit.end)}
                {doneSet.has(index) ? ' · đã xong' : ''}
              </p>
            )}
            {!ready && !error && item.kind === 'youtube' && (
              <p className="media-small media-center subtle">Trên điện thoại, nếu “Phát câu” chưa chạy, hãy chạm vào video một lần.</p>
            )}
          </section>

          {unit ? (
            <section className="card media-practice" aria-label="Luyện câu hiện tại">
              <div className="media-modes">
                <Segmented
                  ariaLabel="Cách luyện"
                  value={mode}
                  onChange={setMode}
                  options={[
                    {
                      value: 'watch' as PracticeMode,
                      label: (
                        <>
                          <Icon icon={Eye} size={15} />
                          Nghe &amp; xem
                        </>
                      ),
                    },
                    {
                      value: 'dictation' as PracticeMode,
                      label: (
                        <>
                          <Icon icon={PencilLine} size={15} />
                          Chép chính tả
                        </>
                      ),
                    },
                  ]}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm media-mode-link"
                  onClick={() => {
                    stop();
                    navigate('shadowing', { text: unit.text });
                  }}
                >
                  <Icon icon={Mic} size={15} />
                  Nói nhại câu này
                </button>
              </div>

              <div>
                {mode === 'watch' ? (
                  <WatchPanel
                    key={index}
                    text={unit.text}
                    decoded={decoded}
                    showSubs={prefs.showSubs}
                    done={doneSet.has(index)}
                    onToggleDone={toggleDone}
                  />
                ) : (
                  <>
                    <DictationPanel
                      key={index}
                      text={unit.text}
                      decoded={decoded}
                      bestScore={item.progress.scores[index]}
                      isLast={index >= units.length - 1}
                      onChecked={onChecked}
                      onReplay={replay}
                      onNext={next}
                      quiet={item.kind === 'file' && !file}
                    />
                    {reviewNote && reviewNote.index === index && (
                      <p className="media-review-note muted" role="status">
                        <Icon icon={History} size={15} />
                        <span>{reviewNote.text}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>
          ) : (
            <section className="card">
              <p className="muted">Mục này không có câu nào để luyện. Hãy xoá và thêm lại với bản chép lời khác.</p>
            </section>
          )}
        </div>

        <aside className="card media-side" aria-label="Bản chép lời">
          <div className="media-side-head">
            <h2>
              Bản chép lời{' '}
              {item.progress.done.length > 0 && (
                <span className="meta">
                  · {item.progress.done.length}/{units.length} câu xong
                </span>
              )}
            </h2>
            {undoneTarget >= 0 && undoneTarget !== index && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => goTo(undoneTarget)}
                title="Nhảy tới câu chưa xong gần nhất"
              >
                Câu chưa xong
                <Icon icon={ArrowRight} size={14} />
              </button>
            )}
          </div>
          {maskList && (
            <p className="media-small subtle">
              {mode === 'dictation' ? 'Câu chưa xong được ẩn để bạn không nhìn trộm.' : 'Phụ đề đang tắt: câu chưa xong được ẩn.'}
            </p>
          )}
          <TranscriptList
            units={units}
            current={index}
            done={item.progress.done}
            scores={item.progress.scores}
            mask={maskList}
            revealed={revealed === index ? index : -1}
            onJump={jump}
          />
        </aside>
      </div>
    </div>
  );
}
