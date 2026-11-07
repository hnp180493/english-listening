// Ôn tập (#/review): one daily mixed spaced-repetition session over every module (docs/review-system.md §6).
// State machine: start → session → summary. The queue is built once when the session starts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BellOff, CircleHelp, Ellipsis, Flag, History, Info, Plus, Undo2 } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp, { type Shortcut } from '../../components/ShortcutsHelp';
import { sanitizeCustom } from '../../core/dictation/custom';
import { hrefFor } from '../../core/nav';
import {
  admitToday,
  availableAt,
  buildReviewQueue,
  contextLineVi,
  dismissSeedNotice,
  estimateMinutes,
  forecast,
  formatDueVi,
  getReviewSnapshot,
  growthLineVi,
  isStoredKind,
  KIND_LABEL,
  KIND_ORDER,
  KIND_SHORT,
  localDayDiff,
  parseCardId,
  reviewBudgetSec,
  SEED_PER_DAY,
  WORD_NEW_PER_DAY,
  suspendCard,
  unlockExtra,
  useReview,
  type CardId,
  type ReviewEntry,
  type ReviewKind,
  type ReviewSnapshot,
} from '../../core/review';
import type { CardState } from '../../core/srs';
import { localDay } from '../../core/stats';
import { KEYS, loadJSON } from '../../core/storage';
import { stopSpeaking } from '../../core/tts';
import { annotationCount } from '../dictation/decodeCache';
import { sanitizeLibrary } from '../media/library';
import ChunkItem from './items/ChunkItem';
import DictItem from './items/DictItem';
import LessonItem from './items/LessonItem';
import PairItem from './items/PairItem';
import WordItem from './items/WordItem';
import type { GradeOutcome } from './items/types';
import { createResolver, hashSeed, type Resolver } from './resolve';
import {
  currentId,
  endSession,
  isGraded,
  nextItem,
  originalDone,
  recordResult,
  remaining,
  restoreItem,
  skipItem,
  startSession,
  summarizeSession,
  wasRequeuedAt,
  type SessionState,
} from './sessionModel';
import '../dictation/dictation.css';
import '../pairs/pairs.css';
import '../lessons/lessons.css';
import '../drill/drill.css';
import './review.css';

// ───────────────────────── module state ─────────────────────────

/** Ids skipped today ("Bỏ qua"): served last. Cleared when the local day changes. */
const later = new Set<CardId>();
let laterDay = '';

function laterSet(now: number): Set<CardId> {
  const d = localDay(now);
  if (d !== laterDay) {
    later.clear();
    laterDay = d;
  }
  return later;
}

function readResolver(): Resolver {
  let customs: ReturnType<typeof sanitizeCustom> = [];
  let media: ReturnType<typeof sanitizeLibrary>['items'] = [];
  try {
    customs = sanitizeCustom(loadJSON<unknown>(KEYS.customSentences, []), annotationCount);
  } catch {
    // unreadable: custom sentences are skipped
  }
  try {
    media = sanitizeLibrary(loadJSON<unknown>(KEYS.media, null)).items;
  } catch {
    // unreadable: video lines are skipped
  }
  return createResolver({ customs, media });
}

/** "Bỏ qua": the item goes to the end of today's later sessions. */
function skipToday(id: CardId): void {
  laterSet(Date.now()).add(id);
}

let resolverCache: { version: number; resolver: Resolver } | null = null;

/** Resolver for a snapshot version (custom sentences and the media library are snapshot inputs). */
function resolverFor(version: number): Resolver {
  if (!resolverCache || resolverCache.version !== version) resolverCache = { version, resolver: readResolver() };
  return resolverCache.resolver;
}

/** Today's next session from a snapshot, without items the page cannot render (they never count). */
function queueFrom(snap: ReviewSnapshot, resolver: Resolver): CardId[] {
  const usable = snap.entries.filter((e) => resolver.resolve(e.id) !== null);
  return buildReviewQueue(usable, snap.store, reviewBudgetSec(), snap.now, {
    later: laterSet(snap.now),
    phenomenonOf: resolver.phenomenonOf,
  });
}

function kindOf(id: CardId): ReviewKind | null {
  return parseCardId(id)?.kind ?? null;
}

/** "3 câu · 3 nhóm âm · 5 cụm từ" (kinds in KIND_ORDER, empty kinds left out). */
function kindsLine(kinds: readonly (ReviewKind | null)[]): string {
  const counts = new Map<ReviewKind, number>();
  for (const k of kinds) if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  return KIND_ORDER.filter((k) => counts.has(k))
    .map((k) => `${counts.get(k)} ${KIND_SHORT[k].toLowerCase()}`)
    .join(' · ');
}

/** Keyboard shortcuts of the item kind on screen (the embedded exercises keep their own key handlers). */
const TYPE_KEYS: readonly Shortcut[] = [
  { keys: ['Enter'], text: 'Kiểm tra, rồi sang mục tiếp' },
  { keys: ['Esc'], text: 'Nghe lại' },
];
const SHORTCUTS: Readonly<Record<ReviewKind, readonly Shortcut[]>> = {
  dict: TYPE_KEYS,
  media: TYPE_KEYS,
  pair: [
    { keys: ['1–2'], text: 'Chọn câu bạn nghe được' },
    { keys: ['R'], text: 'Nghe lại' },
    { keys: ['S'], text: 'Nghe chậm' },
    { keys: ['Enter'], text: 'Câu tiếp' },
  ],
  lesson: [
    { keys: ['1–4'], text: 'Chọn đáp án' },
    { keys: ['R'], text: 'Nghe lại' },
    { keys: ['Enter'], text: 'Câu tiếp' },
  ],
  chunk: [
    { keys: ['Enter'], text: 'Kiểm tra' },
    { keys: ['Shift', 'Enter'], text: 'Không biết, xem đáp án' },
    { keys: ['Esc'], text: 'Nghe lại (cả khi đang gõ)' },
    { keys: ['R'], text: 'Nghe lại' },
    { keys: ['C'], text: 'Nghe câu ví dụ' },
    { keys: ['1–4'], text: 'Chọn đáp án, hoặc tự chấm: Lại · Khó · Được · Dễ' },
  ],
  word: [
    { keys: ['1–4'], text: 'Chọn từ bạn nghe thấy, hoặc tự chấm: Lại · Khó · Được · Dễ' },
    { keys: ['R'], text: 'Nghe lại' },
    { keys: ['Enter'], text: 'Lật thẻ, rồi sang mục tiếp' },
  ],
};

/** "Gặp lại …" after an answer. A lapsed card keeps part of its interval but is due tomorrow: say when. */
function nextLine(prev: CardState | undefined, next: CardState, now: number): string {
  if (next.interval >= 1 && localDayDiff(now, availableAt(next)) !== next.interval) {
    return `Gặp lại ${formatDueVi(availableAt(next), now)}`;
  }
  return growthLineVi(prev, next, now);
}

// ───────────────────────── page ─────────────────────────

interface Run {
  state: SessionState;
  entries: ReadonlyMap<CardId, ReviewEntry>;
  resolver: Resolver;
  seed: number;
  /** Card state after an answer in this session (shown for requeued positions). */
  latest: Partial<Record<CardId, CardState>>;
  /** "Gặp lại …" line per graded position. */
  notes: Record<number, string>;
  /** Bumped by "Làm lại" to remount the item on screen. */
  nonce: number;
  early: boolean;
  /** Today's count (summary.dueToday) when this session is only part of it, else 0: the bar then says "Phiên này". */
  day: number;
}

export default function ReviewPage() {
  const snap = useReview();
  const { store } = snap;
  const [run, setRun] = useState<Run | null>(null);
  const [undo, setUndo] = useState<CardId | null>(null);

  // Never leave speech running when leaving the page.
  useEffect(() => () => stopSpeaking(), []);

  // The preview (start screen, "Ôn tiếp") follows the live snapshot; not needed while a session runs.
  const live = !run || run.state.ended;
  const resolver = useMemo(() => (live ? resolverFor(snap.version) : null), [live, snap.version]);
  const preview = useMemo(() => (resolver ? queueFrom(snap, resolver) : []), [snap, resolver]);

  const start = () => {
    const now = Date.now();
    const s = getReviewSnapshot(now);
    const r = readResolver();
    const queue = queueFrom(s, r);
    const day = s.summary.dueToday > queue.length ? s.summary.dueToday : 0;
    setUndo(null);
    setRun({
      state: startSession(queue),
      entries: new Map(s.entries.map((e) => [e.id, e])),
      resolver: r,
      seed: now >>> 0,
      latest: {},
      notes: {},
      nonce: 0,
      early: false,
      day,
    });
    window.scrollTo({ top: 0 });
  };

  // Today's count lives in the start card (summary.dueToday, the nav badge's number), never twice on screen.
  // While a session runs the header offers the shortcuts of the item kind on screen.
  const onScreen = run && !run.state.ended ? currentId(run.state) : null;
  const sessionKind = onScreen ? kindOf(onScreen) : null;
  const header = (
    <PageHeader
      title="Ôn tập"
      subtitle="Những gì bạn đã học quay lại đúng lúc để nhớ lâu."
      help={
        sessionKind ? (
          <ShortcutsHelp
            items={SHORTCUTS[sessionKind]}
            note={sessionKind === 'pair' || sessionKind === 'lesson' || sessionKind === 'word' ? undefined : 'Phím chữ không dùng được khi đang gõ.'}
          />
        ) : undefined
      }
    />
  );

  const notice =
    store.notice && store.notice.at > store.noticeSeenAt ? (
      <div className="callout rev-notice" role="status">
        <Icon icon={Info} size={18} />
        <div className="rev-callout-body">
          <span>{seedNoticeText(store.notice.count, store.notice.words ?? 0)}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismissSeedNotice()}>
            Đã hiểu
          </button>
        </div>
      </div>
    ) : null;

  let body;
  if (run && !run.state.ended) {
    body = <SessionView run={run} now={snap.now} setRun={setRun} undo={undo} setUndo={setUndo} />;
  } else if (run) {
    body = <SummaryView run={run} snap={snap} more={preview.length} onMore={start} />;
  } else if (preview.length > 0) {
    body = <StartView snap={snap} queue={preview} onStart={start} />;
  } else {
    body = <EmptyView snap={snap} />;
  }

  return (
    <div className="stack-lg page-focus rev-page">
      {header}
      {notice}
      {body}
    </div>
  );
}

/** "Đã xếp lịch ôn…": catch-up cards (SEED_PER_DAY a day) and word cards (WORD_NEW_PER_DAY new words a day) apart. */
function seedNoticeText(count: number, words: number): string {
  const others = Math.max(0, count - words);
  const wordPart = `${words} từ trong các bài bạn đã học, mỗi ngày tối đa ${WORD_NEW_PER_DAY} từ mới`;
  if (words > 0 && others > 0) {
    return `Đã xếp lịch ôn cho ${others} mục bạn từng học (mỗi ngày tối đa ${SEED_PER_DAY}) và ${wordPart}.`;
  }
  if (words > 0) return `Đã xếp lịch ôn cho ${wordPart}.`;
  return `Đã xếp lịch ôn cho ${count} mục bạn từng học, mỗi ngày tối đa ${SEED_PER_DAY}.`;
}

// ───────────────────────── start ─────────────────────────

function StartView({ snap, queue, onStart }: { snap: ReviewSnapshot; queue: CardId[]; onStart: () => void }) {
  const { summary } = snap;
  const postponed = summary.heldBack + summary.deferred;
  // One number everywhere: the nav badge, Home and Stats read summary.dueToday; its items are today's admission.
  const today = summary.dueToday > 0;
  const kinds = useMemo(() => {
    if (!today) return kindsLine(queue.map(kindOf));
    const adm = admitToday(snap.entries, snap.store, reviewBudgetSec(), snap.now);
    return kindsLine([...adm.touched, ...adm.admitted].map((e) => e.kind));
  }, [today, queue, snap]);
  // When today is split into ~5-minute sessions, the card names this session's size and minutes (the number the
  // session counts down from); the title keeps today's count only, so no two minute figures compete.
  const split = today && queue.length < summary.dueToday;
  const minutes = split ? estimateMinutes(queue) : today ? summary.minutesToday : estimateMinutes(queue);
  return (
    <>
      <section className="card stack rev-start" aria-labelledby="rev-start-title">
        <div className="stack-sm">
          <h2 id="rev-start-title" className="rev-h2 rev-start-title">
            {split
              ? `${summary.dueToday} mục hôm nay`
              : `${today ? `${summary.dueToday} mục hôm nay` : `${queue.length} mục sắp đến hạn`} · khoảng ${minutes} phút`}
          </h2>
          <p className="meta rev-kinds">{kinds}</p>
        </div>
        {postponed > 0 && (
          <div className="callout">
            <Icon icon={Info} size={18} />
            <div>
              {summary.backlogClears || summary.heldBack === 0
                ? `Còn ${postponed} mục đến hạn sẽ được chia sang các ngày tới cho nhẹ.`
                : 'Bạn đang có nhiều mục tồn. Hôm nay ưu tiên ôn, tạm học ít bài mới.'}
            </div>
          </div>
        )}
        <div className="rev-start-action">
          <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
            Bắt đầu ôn
            <Icon icon={ArrowRight} size={18} />
          </button>
          {split && (
            <span className="meta rev-start-session">
              Phiên này: {queue.length} mục · khoảng {minutes} phút
            </span>
          )}
        </div>
      </section>
      <details className="how">
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Ôn tập hoạt động thế nào?
        </summary>
        <p>Nhớ đúng thì mục quay lại thưa dần: 1 ngày, 3 ngày, 1 tuần…; quên thì quay lại sớm.</p>
      </details>
    </>
  );
}

// ───────────────────────── empty states ─────────────────────────

function EmptyView({ snap }: { snap: ReviewSnapshot }) {
  const { summary, now } = snap;
  const next = summary.nextAt !== null ? formatDueVi(summary.nextAt, now) : null;
  // Due items moved to later days (new words waiting for their turn are not due items: never counted here).
  const postponed = summary.heldBack + summary.deferred;
  // New words "Ôn thêm 5 phút" would let in today (only the time budget holds them, not the daily allowance).
  const wordsNow = Math.min(summary.wordsWaiting, summary.newWordsLeft);

  let title: string;
  let text: string;
  let actions;
  if (summary.tracked === 0) {
    title = 'Chưa có gì để ôn';
    text = 'Những gì bạn luyện sẽ quay lại đây đúng lúc để ôn.';
    actions = (
      <a className="btn btn-primary" href={hrefFor('lessons')}>
        Học bài đầu tiên
      </a>
    );
  } else if (summary.capLeftSec === 0 && (postponed > 0 || wordsNow > 0)) {
    title = 'Hôm nay bạn ôn đủ rồi';
    text =
      postponed === 0
        ? `Còn ${wordsNow} từ mới có thể bắt đầu hôm nay nếu bạn ôn thêm, không thì để ngày mai.`
        : summary.backlogClears || summary.heldBack === 0
          ? `Còn ${postponed} mục sẽ được chia sang các ngày tới, để mỗi ngày không quá nặng.`
          : 'Bạn đang có nhiều mục tồn. Ôn thêm một chút hôm nay sẽ đỡ hơn cho các ngày tới.';
    actions = (
      <>
        <a className="btn btn-primary" href={hrefFor('home')}>
          Về Hôm nay
        </a>
        {/* the snapshot updates → the start screen appears with the newly admitted items */}
        <button type="button" className="btn btn-soft" onClick={() => unlockExtra()}>
          <Icon icon={Plus} size={16} />
          Ôn thêm 5 phút
        </button>
      </>
    );
  } else if (summary.reviewedToday > 0) {
    title = 'Xong phần ôn hôm nay';
    text = `Bạn đã ôn ${summary.reviewedToday} mục.` + (next ? ` Mục tiếp theo đến hạn ${next}.` : '');
    actions = (
      <a className="btn btn-primary" href={hrefFor('home')}>
        Về Hôm nay
      </a>
    );
  } else {
    title = 'Không có gì cần ôn';
    text = (next ? `Mục tiếp theo đến hạn ${next}. ` : '') + 'Trong lúc chờ, học thêm điều mới nhé.';
    actions = (
      <a className="btn btn-primary" href={hrefFor('dictation')}>
        Chép câu mới
      </a>
    );
  }

  return (
    <section className="card empty-state rev-empty">
      <IconTile icon={History} tint="var(--text-muted)" size="lg" />
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="row">{actions}</div>
    </section>
  );
}

// ───────────────────────── session ─────────────────────────

interface SessionViewProps {
  run: Run;
  now: number;
  setRun: (fn: (r: Run | null) => Run | null) => void;
  undo: CardId | null;
  setUndo: (id: CardId | null) => void;
}

function SessionView({ run, now, setRun, undo, setUndo }: SessionViewProps) {
  const { state } = run;
  const pos = state.pos;
  const id = currentId(state);
  const firstPos = useRef(pos);

  // A new item: start at its top (the previous item's result may have been scrolled far down).
  useEffect(() => {
    if (pos !== firstPos.current) window.scrollTo({ top: 0 });
  }, [pos]);

  if (!id) return null;
  const kind = kindOf(id);
  const item = run.resolver.resolve(id);
  const entry = run.entries.get(id);
  const graded = isGraded(state, pos);
  const latest = run.latest[id];
  const cardState = latest ?? entry?.state;

  /** Moves on only from the position it was created for (double clicks never skip an item). */
  const advanceFrom = (p: number, how: 'next' | 'skip' = 'next') =>
    setRun((r) => (r && r.state.pos === p ? { ...r, state: how === 'skip' ? skipItem(r.state) : nextItem(r.state) } : r));

  const onNext = () => {
    setUndo(null);
    advanceFrom(pos);
  };

  const onGraded = (o: GradeOutcome) =>
    setRun((r) => {
      if (!r || !kind || isGraded(r.state, pos)) return r;
      const t = Date.now();
      const prev = r.latest[id] ?? r.entries.get(id)?.state;
      const s = recordResult(r.state, pos, { id, kind, grade: o.grade, correct: o.correct });
      if (s === r.state) return r;
      const note = wasRequeuedAt(s, pos) ? 'Gặp lại cuối phiên này' : o.current ? nextLine(prev, o.current, t) : '';
      return {
        ...r,
        state: s,
        latest: o.current ? { ...r.latest, [id]: o.current } : r.latest,
        notes: { ...r.notes, [pos]: note },
      };
    });

  const onSkip = () => {
    skipToday(id);
    setUndo(null);
    advanceFrom(pos, 'skip');
  };

  const onRetry = () => setRun((r) => (r ? { ...r, nonce: r.nonce + 1 } : r));

  const onSuspend = () => {
    if (!suspendCard(id, true)) return;
    stopSpeaking();
    setUndo(id);
    advanceFrom(pos, 'skip');
  };

  const onEnd = () => {
    stopSpeaking();
    setUndo(null);
    setRun((r) => (r ? { ...r, state: endSession(r.state), early: remaining(r.state) > 0 } : r));
  };

  // Context line: why this item is here (a requeued item shows its state after the earlier miss).
  const shown: ReviewEntry | undefined = entry && latest ? { ...entry, state: latest, last: now, seenAt: now } : entry;
  const context = shown ? contextLineVi(shown, now) : '';
  const left = remaining(state);
  // Items answered 'Lại' come back at the end: named apart, so the count matches today's (the nav badge's) number.
  const leftFirst = Math.max(0, state.original - pos);
  const leftAgain = left - leftFirst;
  const leftText =
    leftFirst > 0
      ? `${run.day > 0 ? 'Phiên này: còn' : 'Còn'} ${leftFirst} mục${leftAgain > 0 ? ` · ${leftAgain} gặp lại` : ''}`
      : `Còn ${leftAgain} mục gặp lại`;
  const done = originalDone(state);
  const pct = state.original ? Math.round((done / state.original) * 100) : 0;
  const itemKey = `${id}:${pos}:${run.nonce}`;
  const common = { graded, state: cardState, onGraded, onNext };

  let view = null;
  if (item) {
    switch (item.kind) {
      case 'dict':
      case 'media':
        view = <DictItem key={itemKey} item={item} {...common} onRetry={onRetry} onSkip={onSkip} />;
        break;
      case 'pair':
        view = <PairItem key={itemKey} item={item} seed={hashSeed(`${id}:${pos}:${run.seed}`)} {...common} />;
        break;
      case 'lesson':
        view = <LessonItem key={itemKey} item={item} {...common} />;
        break;
      case 'chunk':
        view = <ChunkItem key={itemKey} item={item} {...common} />;
        break;
      case 'word':
        view = <WordItem key={itemKey} item={item} seed={hashSeed(`${id}:${pos}:${run.seed}`)} {...common} />;
        break;
    }
  }

  return (
    <div className="stack rev-session">
      <div className="stack-sm rev-top">
        <div className="row-between rev-bar">
          <div className="rev-bar-info">
            <span className="rev-left tabular" aria-live="polite">
              {leftText}
            </span>
            {kind && (
              <span className="meta rev-kind">
                <span className="rev-kind-sep" aria-hidden="true">
                  ·{' '}
                </span>
                {KIND_LABEL[kind]}
              </span>
            )}
            {pos >= state.original && <span className="badge">Ôn lại</span>}
          </div>
          <div className="rev-bar-tools">
            {kind && isStoredKind(kind) && <ItemMenu onSuspend={onSuspend} />}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onEnd}>
              <Icon icon={Flag} size={14} />
              Kết thúc
            </button>
          </div>
        </div>
        <div
          className="progress rev-progress"
          role="progressbar"
          aria-label="Tiến độ phiên ôn"
          aria-valuemin={0}
          aria-valuemax={state.original}
          aria-valuenow={done}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      {undo && (
        <div className="callout rev-undo" role="status">
          <Icon icon={BellOff} size={18} />
          <div className="rev-callout-body">
            <span>Đã bỏ mục này khỏi Ôn tập.</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                // back in Ôn tập and back in this session, right after the item on screen
                if (suspendCard(undo, false)) setRun((r) => (r ? { ...r, state: restoreItem(r.state, undo) } : r));
                setUndo(null);
              }}
            >
              <Icon icon={Undo2} size={14} />
              Hoàn tác
            </button>
          </div>
        </div>
      )}

      <div className="rev-line">
        {!graded && context && <p className="muted rev-context">{context}</p>}
        <p className="rev-next" role="status">
          {graded && run.notes[pos] ? run.notes[pos] : ''}
        </p>
      </div>

      {view ?? (
        <section className="card empty-state">
          <h2>Không mở được mục này</h2>
          <p>Nội dung của mục đã bị xóa.</p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => advanceFrom(pos, 'skip')}>
              Mục tiếp
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Overflow menu of the item on screen ("Không ôn mục này nữa"). */
function ItemMenu({ onSuspend }: { onSuspend: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="rev-menu" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-ghost btn-sm btn-icon"
        aria-label="Tùy chọn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon icon={Ellipsis} size={16} />
      </button>
      {open && (
        <div className="rev-menu-list" role="menu">
          <button
            ref={firstRef}
            type="button"
            role="menuitem"
            className="rev-menu-item"
            onClick={() => {
              setOpen(false);
              onSuspend();
            }}
          >
            <Icon icon={BellOff} size={15} />
            Không ôn mục này nữa
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── summary ─────────────────────────

function SummaryView({ run, snap, more, onMore }: { run: Run; snap: ReviewSnapshot; more: number; onMore: () => void }) {
  const sum = summarizeSession(run.state);
  const { summary, now } = snap;
  const tomorrow = forecast(snap.entries, now, 2, snap.store)[1];
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, []);

  const kinds = KIND_ORDER.filter((k) => sum.byKind[k]);
  const result =
    sum.total === 0
      ? 'Bạn chưa ôn mục nào.'
      : sum.notYet === 0
        ? `Bạn đã ôn ${sum.total} mục và nhớ hết.`
        : sum.remembered === 0
          ? `Bạn đã ôn ${sum.total} mục. Chúng sẽ quay lại sớm để bạn nhớ chắc hơn.`
          : `Bạn đã ôn ${sum.total} mục: nhớ ${sum.remembered}, chưa nhớ ${sum.notYet}.`;
  // When to come back: only once nothing more is served today (otherwise "Ôn tiếp" is the answer).
  const comeBack = [
    summary.nextAt !== null ? `Lần ôn tiếp theo: ${formatDueVi(summary.nextAt, now)}` : '',
    tomorrow && tomorrow.count > 0
      ? `Ngày mai: ${tomorrow.count} mục · khoảng ${Math.max(1, Math.ceil(tomorrow.seconds / 60))} phút`
      : '',
  ].filter(Boolean);
  // "Ôn tiếp" names today's remaining count (the nav badge's number) when there is one.
  const moreCount = summary.dueToday > 0 ? summary.dueToday : more;
  return (
    <section className="card stack rev-summary">
      <div className="stack-sm">
        <h2 ref={headingRef} tabIndex={-1} className="rev-h2 rev-summary-title">
          {run.early ? 'Đã dừng phiên ôn' : 'Xong phiên ôn!'}
        </h2>
        <p className="rev-summary-result">{result}</p>
        {kinds.length > 1 && (
          <p className="meta">
            {kinds
              .map((k) => {
                const r = sum.byKind[k]!;
                return `${KIND_SHORT[k]} ${r.remembered}/${r.total}`;
              })
              .join(' · ')}
          </p>
        )}
        {more === 0 && comeBack.length > 0 && <p className="meta">{comeBack.join(' · ')}</p>}
      </div>

      <div className="row">
        {more > 0 ? (
          <>
            <button type="button" className="btn btn-primary" onClick={onMore}>
              Ôn tiếp ({moreCount} mục)
            </button>
            <a className="btn" href={hrefFor('home')}>
              Về Hôm nay
            </a>
          </>
        ) : (
          <a className="btn btn-primary" href={hrefFor('home')}>
            Về Hôm nay
          </a>
        )}
      </div>
    </section>
  );
}
