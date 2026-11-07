import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, Info, List, Plus, SlidersHorizontal } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import Segmented from '../../components/Segmented';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import { hrefFor, navigate, useRoute } from '../../core/nav';
import { useReview } from '../../core/review';
import { useSettings } from '../../core/settings';
import {
  buildQueue,
  formatInterval,
  grade as gradeCard,
  newCard,
  nextDue,
  type Grade,
} from '../../core/srs';
import { recordAttempt } from '../../core/stats';
import type { Chunk, Phenomenon } from '../../core/types';
import { CHUNKS } from '../../data/chunks';
import { buildChoices, cardKind, choiceSeed } from './choice';
import { sanitizeChunks } from './chunkData';
import ChunkList from './ChunkList';
import DrillCard from './DrillCard';
import {
  NEW_PER_DAY_OPTIONS,
  applyGrade,
  emptyDrillStore,
  gradeBase,
  isDrillStorageKey,
  loadDrillStore,
  rollDaily,
  saveDrillStore,
  type DrillStore,
  type NewPerDay,
} from './drillStore';
import {
  advanceFocus,
  gradeOutcome,
  isExtraPractice,
  parseFocus,
  phenomenonCounts,
  startFocusSession,
  type FocusSession,
} from './focus';
import { FocusBanner, FocusDone } from './FocusPanels';
import FocusPicker from './FocusPicker';
import { DRILL_SHORTCUTS } from './labels';
import { computeDrillSummary, EXTRA_NEW, extraAfterLearnMore, newCardQuota } from './summary';
import './drill.css';

/** Cards in a learning step (again/hard) come back within the same session. */
const LEARN_AHEAD_MS = 20 * 60_000;
const TICK_MS = 30_000;

const ALL_CHUNKS: Chunk[] = sanitizeChunks(CHUNKS);
const CHUNK_MAP: ReadonlyMap<string, Chunk> = new Map(ALL_CHUNKS.map((c) => [c.id, c]));

type View = 'study' | 'list';

/** `heldBack`: Ôn tập has a backlog, so only the explicit "Học thêm" new cards are served (review-system D9). */
function queueFor(chunks: readonly Chunk[], store: DrillStore, now: number, heldBack: boolean): Chunk[] {
  return buildQueue(chunks, store.cards, now, {
    newPerDay: newCardQuota(store, heldBack),
    newIntroducedToday: store.daily.newIntroduced,
    learnAheadMs: LEARN_AHEAD_MS,
  });
}

function formatWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Route wrapper: a new `focus` param starts a fresh session (the inner component remounts). */
export default function DrillPage() {
  const route = useRoute();
  const focus = parseFocus(route.params.focus);
  return <DrillSession key={focus ?? 'all'} focus={focus} />;
}

function DrillSession({ focus }: { focus: Phenomenon | null }) {
  const chunks = ALL_CHUNKS;
  const chunkMap = CHUNK_MAP;
  const settings = useSettings();
  const review = useReview();
  const heldBack = review.summary.heldBack;

  const [view, setView] = useState<View>('study');
  const [store, setStore] = useState<DrillStore>(() => loadDrillStore());
  const [now, setNow] = useState(() => Date.now());
  /** Card locked on screen (normal mode) so a background tick never swaps it mid-answer. */
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [gradedCount, setGradedCount] = useState(0);
  const [session, setSession] = useState<FocusSession | null>(() =>
    focus ? startFocusSession(chunks, store.cards, focus, now) : null,
  );
  /**
   * When the current focus card was put on screen. "Extra practice" is decided at that moment,
   * so a background tick never flips a card between practice and a real review mid-answer.
   */
  const [shownAt, setShownAt] = useState(now);
  /** Id of the card currently on screen, read by the timer to lock it. */
  const shownRef = useRef<string | null>(null);

  // Keep "now" fresh (cards in learning steps become due, day rollover).
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      const shown = shownRef.current;
      setCurrentId((cur) => cur ?? shown);
      setNow(t);
      setStore((s) => rollDaily(s, t));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  /** False after a failed write: storage is then behind memory and must not be read back over it. */
  const lastSaveOkRef = useRef(true);
  /**
   * Store object known to match storage (just loaded or just saved). It is not written back:
   * echoing a store read from another tab's write would re-fire `storage` events there and could
   * clobber a newer write that tab made in the meantime (e.g. clear + import).
   */
  const persistedRef = useRef<DrillStore>(store);

  useEffect(() => {
    if (store === persistedRef.current) return;
    const ok = saveDrillStore(store);
    lastSaveOkRef.current = ok;
    if (ok) persistedRef.current = store;
  }, [store]);

  // Another tab graded, reset or cleared storage: pick up its store instead of overwriting it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!isDrillStorageKey(e.key)) return;
      const fresh = loadDrillStore();
      // Memory now equals storage again.
      persistedRef.current = fresh;
      lastSaveOkRef.current = true;
      setStore(fresh);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const queue = useMemo(() => queueFor(chunks, store, now, heldBack > 0), [chunks, store, now, heldBack]);

  const current: Chunk | null = focus
    ? ((session?.queue[0] ? chunkMap.get(session.queue[0]) : undefined) ?? null)
    : ((currentId ? chunkMap.get(currentId) : queue[0]) ?? null);

  useEffect(() => {
    shownRef.current = current?.id ?? null;
  });

  const currentState = current ? store.cards[current.id] : undefined;
  const currentExtra = !!focus && isExtraPractice(currentState, shownAt);
  const kind = current ? cardKind(current, currentState) : 'type';
  const options = useMemo(
    () => (current && kind === 'choose' ? buildChoices(current, chunks, choiceSeed(current, currentState)) : null),
    [current, kind, currentState, chunks],
  );

  // Same function as Home / Stats (drillSummary), so the numbers always agree.
  const today = useMemo(() => computeDrillSummary(chunks, store, now, heldBack > 0), [chunks, store, now, heldBack]);
  const unseenTotal = useMemo(() => chunks.filter((c) => !store.cards[c.id]).length, [chunks, store.cards]);
  const counts = useMemo(() => phenomenonCounts(chunks, store.cards, now), [chunks, store.cards, now]);
  const studied = store.daily.studiedIds.length;

  const onGrade = useCallback(
    (g: Grade) => {
      if (!current) return;
      const t = Date.now();
      // Grade on top of a fresh read so a grade made in another tab is not lost.
      const base = gradeBase(store, lastSaveOkRef.current, () => loadDrillStore(t), t);
      let next = base;
      // Extra practice (focus mode, card not due) never touches the schedule.
      if (!currentExtra) {
        const prev = base.cards[current.id];
        const updated = gradeCard(prev ?? newCard(current.id, t), g, t);
        next = applyGrade(base, current.id, updated, !prev, t);
        // Persist the schedule first: a stats failure must never lose the grade.
        setStore(next);
      }
      // 'hard' is a pass in SRS: only 'again' counts the phenomena as missed.
      const { correct, missed } = gradeOutcome(g, current.phenomena);
      try {
        recordAttempt({
          module: 'drill',
          itemId: current.id,
          correct,
          seen: current.phenomena,
          missed,
        });
      } catch {
        // stats are best-effort
      }
      setNow(t);
      setShownAt(t);
      if (focus) {
        setSession((s) => (s ? advanceFocus(s, current.id, g) : s));
      } else {
        const q = queueFor(chunks, next, t, heldBack > 0);
        const following = q.find((c) => c.id !== current.id) ?? q[0] ?? null;
        setCurrentId(following ? following.id : null);
      }
      setGradedCount((n) => n + 1);
    },
    [current, currentExtra, store, chunks, focus, heldBack],
  );

  const setNewPerDay = (n: NewPerDay) => setStore((s) => ({ ...s, newPerDay: n }));

  const learnMore = () => {
    setStore((s) => {
      const base = rollDaily(s, Date.now());
      // Make sure 5 more actually fit, even if the daily limit was lowered (or held back) after studying.
      return { ...base, daily: { ...base.daily, extraNew: extraAfterLearnMore(base, heldBack > 0) } };
    });
    setNow(Date.now());
    setCurrentId(null);
  };

  const resetProgress = () => {
    const t = Date.now();
    const fresh = { ...emptyDrillStore(t), newPerDay: store.newPerDay };
    setStore(fresh);
    setCurrentId(null);
    setGradedCount(0);
    setNow(t);
    setShownAt(t);
    if (focus) setSession(startFocusSession(chunks, fresh.cards, focus, t));
  };

  const restartFocus = () => {
    if (!focus) return;
    const t = Date.now();
    setNow(t);
    setShownAt(t);
    setSession(startFocusSession(chunks, store.cards, focus, t));
    setGradedCount((n) => n + 1);
  };

  /** "Luyện nhóm này" from the list: same phenomenon → back to the session, else start a new one. */
  const practice = (p: Phenomenon) => {
    if (p === focus) setView('study');
    else navigate('drill', { focus: p });
  };

  const nextDueTs = nextDue(chunks, store.cards, now);
  const remaining = focus
    ? Math.max(0, (session?.queue.length ?? 0) - 1)
    : current
      ? queue.filter((c) => c.id !== current.id).length
      : 0;

  const card = current ? (
    <DrillCard
      key={`${current.id}-${gradedCount}`}
      chunk={current}
      state={currentState}
      kind={kind === 'choose' && options ? 'choose' : 'type'}
      options={options}
      extra={currentExtra}
      showIpa={settings.showIpa}
      autoPlay={gradedCount > 0}
      onGrade={onGrade}
      // A focus session shows its own bar in the banner.
      progress={focus ? undefined : { done: gradedCount, total: gradedCount + remaining + 1 }}
    />
  ) : null;

  const optionsBox = (
    <details className="how drill-options-box">
      <summary>
        <Icon icon={SlidersHorizontal} size={18} />
        Tùy chọn
      </summary>
      <div className="drill-limit">
        <span className="drill-limit-label" id="drill-limit-label">
          Thẻ mới mỗi ngày
        </span>
        <Segmented
          ariaLabel="Thẻ mới mỗi ngày"
          value={store.newPerDay}
          onChange={setNewPerDay}
          options={NEW_PER_DAY_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
        />
      </div>
    </details>
  );

  let study: ReactNode;
  if (chunks.length === 0) {
    study = (
      <div className="card empty-state">
        <h2>Chưa có cụm từ nào</h2>
        <p>
          Bộ cụm từ đang được biên soạn. Trong lúc chờ, hãy thử <strong>Giải mã câu</strong> hoặc <strong>Chép chính tả</strong>.
        </p>
      </div>
    );
  } else if (focus && session) {
    study = (
      <>
        <FocusBanner session={session} />
        {card ?? <FocusDone session={session} chunkMap={chunkMap} onRestart={restartFocus} />}
        <FocusPicker counts={counts} current={focus} title="Đổi hiện tượng" />
        {optionsBox}
      </>
    );
  } else {
    study = (
      <>
        {heldBack > 0 && (
          <div className="callout drill-review-callout">
            <Icon icon={Info} />
            <div>
              Bạn đang có {heldBack} mục tồn trong Ôn tập. Ôn xong rồi học cụm mới nhé.{' '}
              <a className="drill-review-link" href={hrefFor('review')}>
                Mở Ôn tập
                <Icon icon={ArrowRight} size={14} />
              </a>
            </div>
          </div>
        )}
        {card ?? (
          <div className="card drill-done">
            <IconTile icon={Check} tint="var(--ok)" size="lg" className="drill-done-icon" />
            <h2>Xong bài hôm nay!</h2>
            <p className="muted">
              {studied > 0 ? `Bạn đã học ${studied} cụm từ hôm nay. ` : ''}
              {nextDueTs !== null
                ? `Thẻ tiếp theo đến hạn sau ${formatInterval(nextDueTs - now)} (${formatWhen(nextDueTs)}).`
                : 'Chưa có thẻ nào cần ôn.'}
            </p>
            {unseenTotal > 0 ? (
              <button type="button" className="btn btn-primary" onClick={learnMore}>
                <Icon icon={Plus} size={16} />
                Học thêm {Math.min(EXTRA_NEW, unseenTotal)} thẻ mới
              </button>
            ) : (
              <p className="drill-done-all">Bạn đã bắt đầu học tất cả {chunks.length} cụm từ.</p>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('list')}>
              <Icon icon={List} size={15} />
              Xem danh sách cụm từ
            </button>
          </div>
        )}
        <FocusPicker counts={counts} />
        {optionsBox}
      </>
    );
  }

  const cardsToday = today.due + today.newAvailable;
  return (
    // One 760 column for both views: the header and the view switch never move when switching (the list is one column).
    <div className="drill stack-lg page-focus">
      <PageHeader
        title="Cụm từ"
        subtitle="Nghe cụm từ, gõ lại, nhớ lâu."
        actions={
          // The session size means nothing next to the browse list.
          view === 'study' &&
          cardsToday > 0 && (
            <span className="badge drill-today" title={`${today.due} cần ôn · ${today.newAvailable} thẻ mới`}>
              {cardsToday} thẻ
            </span>
          )
        }
        help={<ShortcutsHelp items={DRILL_SHORTCUTS} note="R, C và số chỉ dùng được khi con trỏ không nằm trong ô gõ." />}
      />

      <div className="toolbar">
        <Segmented
          ariaLabel="Chế độ"
          value={view}
          onChange={setView}
          options={[
            { value: 'study', label: focus ? 'Luyện tập' : 'Ôn tập' },
            { value: 'list', label: 'Danh sách' },
          ]}
        />
      </div>

      {view === 'list' ? (
        <ChunkList chunks={chunks} cards={store.cards} now={now} onReset={resetProgress} initialFocus={focus} onPractice={practice} />
      ) : (
        study
      )}
    </div>
  );
}
