import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarCheck, History, Inbox, Repeat, SearchX, UserRound, X, type LucideIcon } from 'lucide-react';
import FilterButton from '../../components/FilterButton';
import { Icon, IconTile } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import { PhDot } from '../../components/PhTag';
import Segmented, { type SegmentedOption } from '../../components/Segmented';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import {
  dedupeKey,
  isCustomId,
  sanitizeCustom,
  toSentence,
  type CustomSentence,
} from '../../core/dictation/custom';
import { roundChecks, roundProgress, SESSION_GOAL, summarizeChecks, type SessionCheck } from '../../core/dictation/goal';
import {
  countDue,
  dueQueue,
  filterByFocus,
  isSentenceDue,
  parseFocus,
  type DictMode,
  type DictStates,
} from '../../core/dictation/modes';
import {
  filterSentences,
  orderSentences,
  removeProgress,
  topicsOf,
  updateProgress,
  type LevelFilter,
  type ProgressMap,
} from '../../core/dictation/progress';
import { scrollBehavior } from '../../core/motion';
import { hrefFor, navigate, useRoute } from '../../core/nav';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { formatDueVi, makeCardId, nextAvailable, recordReview, resetCard, statesOfKind, useReview } from '../../core/review';
import { recordAttempt } from '../../core/stats';
import { KEYS, loadJSON, saveJSON } from '../../core/storage';
import { prefetchSpeech } from '../../core/tts';
import { PHENOMENA, type Phenomenon, type Sentence } from '../../core/types';
import { SENTENCES } from '../../data/sentences';
import ClozeExercise from './ClozeExercise';
import { MINE_TOPIC } from './constants';
import CustomManager from './CustomManager';
import { annotationCount, detectedPhenomena, hasCloze } from './decodeCache';
import Exercise, { type CheckedInfo } from './Exercise';
import {
  linkedId,
  loadProgress,
  loadProgressOr,
  paramsOf,
  resolveView,
  reviewGradeFor,
  reviewNoteVi,
  routeSignature,
  statsOutcome,
  storageEventTouches,
  usesTopic as modeUsesTopic,
  viewForSentence,
  viewKey,
  withFirst,
  type DictView,
  type LinkedSentence,
} from './pageModel';
import { recordSessionCheck, session, startSessionRound, type DictFilters } from './session';
import SessionSummaryCard from './SessionSummary';
import './dictation.css';

const MODE_INFO: Record<DictMode, { label: string; hint: string }> = {
  normal: { label: 'Chép cả câu', hint: 'Nghe câu nói tự nhiên, gõ lại từng chữ rồi xem vì sao mình nghe sai.' },
  cloze: { label: 'Điền từ', hint: 'Câu hiện sẵn, chỉ ẩn những chỗ bị nối, nuốt hay biến âm.' },
  review: {
    label: 'Ôn đến hạn',
    hint: 'Câu đã học tới lúc cần nghe lại, câu quên lâu nhất lên trước. Không tính giới hạn ôn mỗi ngày.',
  },
  custom: { label: 'Câu của tôi', hint: 'Luyện nghe với chính những câu bạn tự thêm vào.' },
};

const LEVEL_OPTS: readonly SegmentedOption<LevelFilter>[] = [
  { value: 0, label: 'Tất cả' },
  { value: 1, label: 'Dễ' },
  { value: 2, label: 'Vừa' },
  { value: 3, label: 'Khó' },
];

const SHORTCUTS = [
  { keys: ['Enter'], text: 'Kiểm tra, rồi sang câu tiếp' },
  { keys: ['Esc'], text: 'Nghe lại câu' },
  { keys: ['Ctrl', 'Enter'], text: 'Điền từ: kiểm tra ngay' },
];

interface NavState {
  fkey: string; // filters the queue was built for
  ckey: number; // custom-sentence version the queue was built for (0 when the pool has no custom sentences)
  queue: string[];
  pos: number;
  nonce: number; // bumps to remount the exercise
  autoPlay: boolean;
  focus: boolean;
  newRound: boolean;
  retry?: boolean; // the exercise on screen is a retry of the same sentence (not a new attempt for the stats)
}

function loadCustoms(): CustomSentence[] {
  return sanitizeCustom(loadJSON<unknown>(KEYS.customSentences, []), annotationCount);
}

const filtersKey = (f: DictFilters) => `${f.mode}|${f.level}|${f.focus ?? ''}`;

/** Reflect the filters in the URL (shareable) without a history entry or a scroll jump. */
function syncUrl(v: DictView) {
  try {
    const next = hrefFor('dictation', paramsOf(v));
    if (window.location.hash !== next) window.history.replaceState(window.history.state, '', next);
  } catch {
    // history API unavailable: the filters still work, only the URL is stale
  }
}

const detectedOf = (s: Sentence): readonly Phenomenon[] => (isCustomId(s.id) ? s.focus : detectedPhenomena(s.text));

/** The queue of a round. "Ôn đến hạn" serves the due dict cards (most overdue first), the other modes everything. */
function buildQueue(
  mode: DictMode,
  pool: readonly Sentence[],
  progress: ProgressMap,
  due: { states: DictStates; now: number },
  avoidFirst?: string,
  keep?: string,
): string[] {
  const list = mode === 'review' ? dueQueue(pool, due.states, due.now) : orderSentences(pool, progress, session.seed);
  const ids = list.map((s) => s.id);
  if (keep && ids.includes(keep)) return [keep, ...ids.filter((id) => id !== keep)];
  // don't start a new round with the sentence the learner just finished
  if (avoidFirst && ids.length > 1 && ids[0] === avoidFirst) ids.push(ids.shift() as string);
  return ids;
}

export default function DictationPage() {
  const route = useRoute();
  const builtins: Sentence[] = useMemo(
    () => (Array.isArray(SENTENCES) ? SENTENCES.filter((s) => s && typeof s.id === 'string' && typeof s.text === 'string') : []),
    [],
  );
  const topics = useMemo(() => topicsOf(builtins), [builtins]);

  const [customs, setCustoms] = useState<CustomSentence[]>(loadCustoms);
  const [customsVersion, setCustomsVersion] = useState(1);
  const customSentences = useMemo(() => customs.map((c) => toSentence(c, detectedPhenomena(c.text))), [customs]);
  const all = useMemo(() => [...builtins, ...customSentences], [builtins, customSentences]);
  const byId = useMemo(() => new Map(all.map((s) => [s.id, s])), [all]);

  const [progress, setProgress] = useState<ProgressMap>(loadProgress);

  // spaced review: the dict cards ("Ôn đến hạn" serves the due ones). `review.now` is the snapshot's clock (it
  // moves every minute and on every write); handlers that build a new queue read the clock themselves.
  const review = useReview();
  const dictStates = statesOfKind(review, 'dict');
  const dueAt = (now: number) => ({ states: dictStates, now });

  // Another tab saved progress or custom sentences, restored a backup or wiped the data: pick it up so this tab
  // neither shows nor writes back its stale copy.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (storageEventTouches(e.key, KEYS.dictation)) setProgress(loadProgress());
      if (storageEventTouches(e.key, KEYS.customSentences)) {
        setCustoms(loadCustoms());
        setCustomsVersion((v) => v + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ------------------------------------------------------------ linked sentence
  // #/dictation?id=<sentence id> (decoder, home…) opens that sentence first. Only ids the page knows count.
  const linkId = linkedId(route.params.id, (id) => byId.has(id));
  const linkFacts = (id: string): LinkedSentence => {
    const s = byId.get(id);
    return {
      custom: isCustomId(id),
      topic: s?.topic ?? '',
      cloze: !!s && hasCloze(s.text),
      review: isSentenceDue(dictStates, id, review.now),
    };
  };

  // ------------------------------------------------------------ session goal
  // snapshot of the mutable session.checks, refreshed after every check
  const [checks, setChecks] = useState<readonly SessionCheck[]>(() => [...session.checks]);
  const [goalStart, setGoalStart] = useState(() => {
    // opened on a linked sentence: the end-of-round summary must not hide it
    if (linkId && session.summaryOpen) startSessionRound();
    return session.goalStart;
  });
  const [summaryOpen, setSummaryOpen] = useState(session.summaryOpen);

  function startNewRound() {
    startSessionRound();
    setGoalStart(session.goalStart);
    setSummaryOpen(false);
  }

  // ------------------------------------------------------------ filters
  // The URL (#/dictation?mode=&level=&focus=&topic=) drives the filters. A URL with any of them is a complete
  // request, so a link from another page starts from "all topics" unless it names one. A bare #/dictation keeps
  // what is current: the last session's filters on mount, the filters on screen while the page is open.
  // A linked sentence may switch the mode / topic to one that contains it.
  const viewFor = (current: DictView): DictView => {
    const v = resolveView(route.params, current, topics);
    return linkId ? viewForSentence(v, linkFacts(linkId)) : v;
  };
  const routeView = viewFor({ filters: session.filters, topic: session.topic });
  const routeKey = routeSignature(routeView, linkId);
  const [filters, setFilters] = useState<DictFilters>(routeView.filters);
  const [topic, setTopic] = useState<string>(routeView.topic);
  const [seenRouteKey, setSeenRouteKey] = useState(routeKey);
  // a sentence the next queue must start with ('' = none); set when a link arrives while the page is open
  const [pendingId, setPendingId] = useState('');
  if (routeKey !== seenRouteKey) {
    // the URL changed from outside (a link from another page, or the nav item): follow it. When the URL sync
    // below drops the id, the view is unchanged and nothing is rebuilt, so this settles after one pass.
    setSeenRouteKey(routeKey);
    const next = viewFor({ filters, topic });
    setFilters(next.filters);
    setTopic(next.topic);
    if (linkId) {
      setPendingId(linkId);
      if (summaryOpen) startNewRound();
    }
  }
  const { mode, level, focus } = filters;
  const usesTopic = modeUsesTopic(mode);
  const effTopic = usesTopic ? topic : '';

  useEffect(() => {
    session.filters = filters;
    session.topic = topic;
    // keep the URL shareable (only while this page is the one in the address bar). The route is a dependency so
    // a bare #/dictation that kept the current filters is rewritten to them as well.
    if (/^#\/?dictation(\?|$)/.test(window.location.hash || '#/dictation')) syncUrl({ filters, topic });
  }, [filters, topic, route]);

  const applyView = (next: DictView) => {
    if (summaryOpen) startNewRound();
    setFilters(next.filters);
    setTopic(next.topic);
    setSeenRouteKey(viewKey(next));
    // update the URL before the next render reads it, so the route does not "win" back the old filters
    syncUrl(next);
  };
  const applyFilters = (next: DictFilters) => applyView({ filters: next, topic });
  const applyTopic = (next: string) => {
    setTopic(next);
    setSeenRouteKey(viewKey({ filters, topic: next }));
    syncUrl({ filters, topic: next });
  };

  // ------------------------------------------------------------ pool + queue
  const pool = useMemo(() => {
    let base: Sentence[];
    if (mode === 'custom') base = customSentences;
    else if (mode === 'review') base = all;
    else base = effTopic === MINE_TOPIC ? customSentences : filterSentences(builtins, 0, effTopic);
    base = filterByFocus(filterSentences(base, level, ''), focus, detectedOf);
    if (mode === 'cloze') base = base.filter((s) => hasCloze(s.text));
    return base;
  }, [mode, level, focus, effTopic, builtins, customSentences, all]);

  const fkey = `${filtersKey(filters)}|${effTopic}`;
  const usesCustoms = mode === 'custom' || mode === 'review' || effTopic === MINE_TOPIC;
  const ckey = usesCustoms ? customsVersion : 0;

  const [nav, setNav] = useState<NavState>(() => {
    // opened on a linked sentence: start a queue with it instead of resuming the previous session
    if (linkId) {
      const queue = withFirst(buildQueue(mode, pool, progress, dueAt(review.now), undefined, linkId), linkId);
      return { fkey, ckey, queue, pos: 0, nonce: 0, autoPlay: false, focus: false, newRound: false };
    }
    // review mode: sentences reviewed (no longer due) since the queue was built are dropped
    const keep = (id: string) => byId.has(id) && (mode !== 'review' || isSentenceDue(dictStates, id, review.now));
    const kept = session.queue.filter(keep);
    if (session.queueKey === fkey && kept.length > 0) {
      // resume at the same sentence (or the next one still kept), not at the same index
      const before = session.queue.slice(0, Math.max(0, session.pos)).filter(keep).length;
      const pos = Math.min(before, kept.length - 1);
      return { fkey, ckey, queue: kept, pos, nonce: 0, autoPlay: false, focus: false, newRound: false };
    }
    return {
      fkey,
      ckey,
      queue: buildQueue(mode, pool, progress, dueAt(review.now)),
      pos: 0,
      nonce: 0,
      autoPlay: false,
      focus: false,
      newRound: false,
    };
  });

  const currentId = nav.queue[nav.pos] ?? '';
  if (nav.fkey !== fkey || pendingId) {
    // filters changed, or a sentence link arrived: start a fresh queue (with the linked sentence first)
    const first = pendingId && byId.has(pendingId) ? pendingId : '';
    if (pendingId) setPendingId('');
    setNav({
      fkey,
      ckey,
      queue: first
        ? withFirst(buildQueue(mode, pool, progress, dueAt(review.now), undefined, first), first)
        : buildQueue(mode, pool, progress, dueAt(review.now)),
      pos: 0,
      nonce: nav.nonce + 1,
      autoPlay: false,
      focus: false,
      newRound: false,
      retry: false,
    });
  } else if (nav.ckey !== ckey) {
    // custom sentences were added / edited / deleted: rebuild but keep the sentence in progress — even one the
    // filters leave out (a linked sentence, or a review sentence just fixed), so the exercise on screen stays
    const keep = byId.has(currentId) ? currentId : '';
    const built = buildQueue(mode, pool, progress, dueAt(review.now), undefined, keep || undefined);
    const queue = keep ? withFirst(built, keep) : built;
    const same = queue[0] === currentId;
    setNav({ ...nav, ckey, queue, pos: 0, nonce: same ? nav.nonce : nav.nonce + 1, newRound: false, retry: same && !!nav.retry });
  }

  // "Ôn đến hạn" showed nothing, then cards became due (the first reconcile after an update, another tab, a
  // sync, the clock): start a round with them. Never while a sentence is on screen.
  const poolDue = useMemo(
    () => (mode === 'review' ? countDue(pool, dictStates, review.now) : 0),
    [mode, pool, dictStates, review.now],
  );
  const settled = nav.fkey === fkey && nav.ckey === ckey && !pendingId;
  if (mode === 'review' && settled && !byId.has(nav.queue[nav.pos] ?? '') && poolDue > 0) {
    setNav({
      ...nav,
      queue: buildQueue(mode, pool, progress, dueAt(review.now)),
      pos: 0,
      nonce: nav.nonce + 1,
      autoPlay: false,
      focus: false,
      newRound: false,
      retry: false,
    });
  }

  useEffect(() => {
    session.queueKey = nav.fkey;
    session.queue = nav.queue;
    session.pos = nav.pos;
  }, [nav]);

  const current = byId.get(currentId) ?? null;

  // AI voice: generate this sentence's audio and the next one's in the background (no-op with the browser voice)
  const upcomingText = [current?.text, byId.get(nav.queue[nav.pos + 1] ?? '')?.text].filter(Boolean).join('\n');
  useEffect(() => {
    if (upcomingText) prefetchSpeech(upcomingText.split('\n'));
  }, [upcomingText]);

  // ------------------------------------------------------------ session goal
  // the goal counts distinct sentences: retrying the same sentence does not fill it
  const goal = roundProgress(checks, goalStart);
  const summary = summaryOpen ? summarizeChecks(roundChecks(checks, goalStart)) : null;

  const dueTotal = useMemo(() => countDue(all, dictStates, review.now), [all, dictStates, review.now]);

  // ------------------------------------------------------------ actions
  const advance = () => {
    const autoPlay = session.gestured;
    let nextPos = nav.pos + 1;
    const now = Date.now();
    if (mode === 'review') {
      // skip sentences no longer due (reviewed here, in Ôn tập or in another tab since the round started)
      while (nextPos < nav.queue.length && !isSentenceDue(dictStates, nav.queue[nextPos], now)) nextPos++;
    }
    if (nextPos < nav.queue.length) {
      setNav({ ...nav, pos: nextPos, nonce: nav.nonce + 1, autoPlay, focus: true, newRound: false, retry: false });
      return;
    }
    const queue = buildQueue(mode, pool, progress, dueAt(now), current?.id);
    setNav({ ...nav, queue, pos: 0, nonce: nav.nonce + 1, autoPlay, focus: true, newRound: queue.length > 0, retry: false });
  };

  const goNext = () => {
    if (goal.reached && !summaryOpen) {
      session.summaryOpen = true;
      setSummaryOpen(true);
      return;
    }
    advance();
  };

  // The same sentence again after its answer was shown. Progress (best score, hints) and the round goal handle
  // repeats themselves; the shared stats must not count it as a new attempt.
  const retry = () =>
    setNav({ ...nav, nonce: nav.nonce + 1, autoPlay: session.gestured, focus: true, newRound: false, retry: true });

  // the spaced-review line under the exercise it belongs to (`key` = the exercise's React key)
  const [reviewNote, setReviewNote] = useState<{ key: string; text: string } | null>(null);
  const exerciseKey = current ? `${current.id}:${nav.nonce}` : '';

  const onChecked = (info: CheckedInfo) => {
    if (!current) return;
    // build on what is stored, not on the copy loaded at mount (another tab may have changed it)
    const stored = loadProgressOr(progress);
    // captured before the save below: a first-ever perfect answer grades `easy`
    const prevAttempts = stored[current.id]?.attempts ?? 0;
    // "Điền từ" is an easier on-ramp: it does not count as having dictated the sentence
    if (mode !== 'cloze') {
      const next = updateProgress(stored, current.id, info.score, Date.now(), info.hinted);
      saveJSON(KEYS.dictation, next);
      setProgress(next);
    }
    const outcome = statsOutcome(info, !!nav.retry);
    if (outcome.record) {
      try {
        recordAttempt({
          module: 'dictation',
          itemId: current.id,
          correct: outcome.correct,
          seen: info.seen,
          missed: info.missed,
        });
      } catch {
        // stats are best-effort
      }
    }
    // spaced review, once per answer: Exercise reports each check once, a retry is practice only, cloze never grades
    try {
      const plan = reviewGradeFor(info, { mode, retry: !!nav.retry, prevAttempts });
      if (plan) {
        const now = Date.now(); // one clock for the grade and the line ("lúc 21:30", not "sau 60 phút")
        const r = recordReview(makeCardId('dict', current.id), plan.grade, { ctx: plan.ctx, enrol: true, now });
        const text = reviewNoteVi(r, now);
        setReviewNote(text ? { key: exerciseKey, text } : null);
      }
    } catch {
      // review is best-effort: the practice itself is saved above
    }
    recordSessionCheck({ id: current.id, score: info.score, seen: info.seen, missed: info.missed });
    setChecks([...session.checks]);
    setGoalStart(session.goalStart);
  };

  const exerciseRef = useRef<HTMLDivElement>(null);
  const practiseCustom = (id: string) => {
    setNav({
      ...nav,
      queue: [id, ...nav.queue.filter((x) => x !== id)],
      pos: 0,
      nonce: nav.nonce + 1,
      autoPlay: session.gestured,
      focus: true,
      newRound: false,
      retry: false,
    });
    if (summaryOpen) startNewRound();
    requestAnimationFrame(() => exerciseRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }));
  };

  const onCustomsChange = (next: CustomSentence[], removedId?: string) => {
    // the sentence on screen was edited: restart its exercise with the new text
    const before = customs.find((c) => c.id === currentId);
    const after = next.find((c) => c.id === currentId);
    if (before && after && before.text !== after.text) setNav((n) => ({ ...n, nonce: n.nonce + 1, autoPlay: false, focus: false, retry: false }));
    setCustoms(next);
    setCustomsVersion((v) => v + 1);
    saveJSON(KEYS.customSentences, next);
    // a deleted sentence, or one whose words were edited, starts over (its old score is for other words)
    const stale = customs
      .filter((c) => c.id === removedId || next.some((n) => n.id === c.id && dedupeKey(n.text) !== dedupeKey(c.text)))
      .map((c) => c.id);
    if (stale.length) {
      const base = loadProgressOr(progress);
      const p = stale.reduce(removeProgress, base);
      if (p !== base) saveJSON(KEYS.dictation, p);
      setProgress(p);
    }
    // its review card starts over too (only an edited one: a deleted sentence's card is an orphan, never served)
    for (const id of stale) {
      if (id === removedId || !next.some((n) => n.id === id)) continue;
      try {
        resetCard(makeCardId('dict', id));
      } catch {
        // best-effort
      }
    }
  };

  const resetFilters = () => applyView({ filters: { mode, level: 0, focus: null }, topic: '' });

  // ------------------------------------------------------------ render pieces
  const uid = useId();
  const modeOpts: SegmentedOption<DictMode>[] = (['normal', 'cloze', 'review', 'custom'] as const).map((m) => ({
    value: m,
    label: MODE_INFO[m].label,
    count: m === 'review' ? dueTotal || undefined : m === 'custom' ? customs.length || undefined : undefined,
    title: MODE_INFO[m].hint,
  }));
  const focusInfo = focus ? PHENOMENON_INFO[focus] : null;
  const filtered = level !== 0 || !!focus || !!effTopic;
  const activeFilters = (level !== 0 ? 1 : 0) + (focus ? 1 : 0) + (effTopic ? 1 : 0);
  // nothing to filter: "Ôn đến hạn" with no due sentence at all, "Câu của tôi" with no sentence yet
  const showFilters = !((mode === 'review' && dueTotal === 0) || (mode === 'custom' && customs.length === 0));

  const emptyCard = (icon: LucideIcon, title: string, text: string, actions: ReactNode) => (
    <div className="card empty-state dict-empty">
      <IconTile icon={icon} tint="var(--text-muted)" size="lg" />
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="row">{actions}</div>
    </div>
  );

  const renderEmpty = () => {
    if (mode === 'custom' && customs.length === 0) return null; // the manager shows its own empty state
    if (mode === 'review') {
      if (Object.keys(dictStates).length === 0) {
        return emptyCard(
          Inbox,
          'Chưa có câu nào để ôn',
          'Câu bạn đã chép sẽ quay lại đây đúng lúc cần ôn.',
          <button type="button" className="btn btn-primary" onClick={() => applyFilters({ ...filters, mode: 'normal' })}>
            Bắt đầu chép chính tả
          </button>,
        );
      }
      if (filtered && dueTotal > 0) {
        return emptyCard(
          SearchX,
          'Không có câu đến hạn nào khớp bộ lọc',
          `Bạn còn ${dueTotal} câu đến hạn ở các mức độ / hiện tượng khác.`,
          <button type="button" className="btn btn-primary" onClick={resetFilters}>
            Bỏ lọc
          </button>,
        );
      }
      const nextAt = nextAvailable(review.entries, review.now, 'dict');
      return emptyCard(
        CalendarCheck,
        'Chưa đến lúc ôn câu nào',
        nextAt === null ? 'Bạn đã ôn hết các câu đến hạn.' : `Câu tiếp theo đến hạn ${formatDueVi(nextAt, review.now)}.`,
        <>
          <button type="button" className="btn btn-primary" onClick={() => applyFilters({ ...filters, mode: 'normal' })}>
            Chép câu mới
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('review')}>
            Mở Ôn tập
          </button>
        </>,
      );
    }
    if (effTopic === MINE_TOPIC && customs.length === 0) {
      return emptyCard(
        UserRound,
        'Bạn chưa thêm câu nào',
        'Thêm câu bạn nghe được trong phim, podcast hay công việc.',
        <button type="button" className="btn btn-primary" onClick={() => applyFilters({ ...filters, mode: 'custom' })}>
          Thêm câu của tôi
        </button>,
      );
    }
    if (all.length === 0) {
      return emptyCard(
        Inbox,
        'Chưa có câu luyện nào',
        'Kho câu đang được cập nhật. Bạn có thể tự thêm câu để luyện ngay.',
        <button type="button" className="btn btn-primary" onClick={() => applyFilters({ ...filters, mode: 'custom' })}>
          Thêm câu của tôi
        </button>,
      );
    }
    return emptyCard(
      SearchX,
      'Không có câu nào khớp bộ lọc này',
      (mode === 'cloze' ? 'Chế độ Điền từ chỉ dùng câu có chỗ nối âm. ' : '') + 'Thử bỏ bớt điều kiện lọc.',
      <button type="button" className="btn btn-primary" onClick={resetFilters}>
        Xem tất cả câu
      </button>,
    );
  };

  const roundMsg =
    mode === 'review'
      ? 'Hết các câu đến hạn. Câu nào vừa sai sẽ sớm quay lại để bạn ôn tiếp.'
      : 'Bạn đã đi hết một vòng. Vòng mới ưu tiên những câu bạn làm chưa tốt.';

  // the card's top row: the session goal ("3/10") as a thin bar, nothing else
  const goalBar = (
    <div className="dict-goal">
      <div
        className={'progress dict-goal-bar' + (goal.reached ? ' is-done' : '')}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal.goal}
        aria-valuenow={goal.done}
        aria-label={`Mục tiêu phiên: ${goal.done}/${goal.goal} câu`}
      >
        <span style={{ width: `${goal.pct}%` }} />
      </div>
      {/* No "0/10" before the first answer: the target alone. Named "Phiên này" so it is not read as Home's
          daily "Đã chép x/10" (a different count). */}
      <span className="dict-goal-v" aria-hidden="true">
        Phiên này: {goal.done > 0 ? `${goal.done}/${goal.goal}` : `${goal.goal} câu`}
      </span>
    </div>
  );

  const manager = (
    <CustomManager
      list={customs}
      progress={progress}
      onChange={onCustomsChange}
      onPractice={practiseCustom}
      defaultOpen={customs.length > 0 && customs.length <= 3}
    />
  );

  return (
    <div className="stack-lg page-focus dict-page">
      <PageHeader title="Chép chính tả" subtitle="Nghe câu nói tự nhiên rồi gõ lại." help={<ShortcutsHelp items={SHORTCUTS} />} />

      <div className="toolbar dict-toolbar">
        <Segmented
          className="dict-modes"
          ariaLabel="Chế độ luyện"
          options={modeOpts}
          value={mode}
          onChange={(m) => applyFilters({ ...filters, mode: m })}
        />
        {showFilters && (
          <div className="toolbar-end">
            <FilterButton active={activeFilters} onReset={resetFilters}>
              <div className="dict-filter-field">
                <span className="field-label">Độ khó</span>
                <Segmented
                  ariaLabel="Độ khó"
                  block
                  options={LEVEL_OPTS}
                  value={level}
                  onChange={(lv) => applyFilters({ ...filters, level: lv })}
                />
              </div>
              {usesTopic && (
                <div className="dict-filter-field">
                  <label className="field-label" htmlFor={`${uid}-topic`}>
                    Chủ đề
                  </label>
                  <select id={`${uid}-topic`} className="select" value={topic} onChange={(e) => applyTopic(e.target.value)}>
                    <option value="">Mọi chủ đề</option>
                    <option value={MINE_TOPIC}>Câu của tôi ({customs.length})</option>
                    {topics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="dict-filter-field">
                <label className="field-label" htmlFor={`${uid}-focus`}>
                  Hiện tượng
                </label>
                <select
                  id={`${uid}-focus`}
                  className="select"
                  value={focus ?? ''}
                  onChange={(e) => applyFilters({ ...filters, focus: parseFocus(e.target.value) })}
                >
                  <option value="">Mọi hiện tượng</option>
                  {PHENOMENA.map((p) => (
                    <option key={p} value={p}>
                      {PHENOMENON_INFO[p]?.label ?? p}
                    </option>
                  ))}
                </select>
              </div>
            </FilterButton>
          </div>
        )}
      </div>

      {focus && focusInfo && (
        <div className="dict-focus" role="status">
          <PhDot p={focus} />
          <span className="dict-focus-text">
            Đang luyện: <b>{focusInfo.label}</b>
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon dict-focus-x"
            onClick={() => applyFilters({ ...filters, focus: null })}
            aria-label={`Bỏ lọc ${focusInfo.label}`}
            title="Bỏ lọc"
          >
            <Icon icon={X} size={16} />
          </button>
        </div>
      )}


      {nav.newRound && !summaryOpen && current && (
        <div className="callout dict-round">
          <Icon icon={Repeat} size={16} />
          <div>{roundMsg}</div>
        </div>
      )}

      <div ref={exerciseRef} className="dict-stage">
        {summary ? (
          <SessionSummaryCard
            summary={summary}
            goal={SESSION_GOAL}
            reviewCount={dueTotal}
            onContinue={() => {
              startNewRound();
              advance();
            }}
            onReview={() => applyFilters({ mode: 'review', level: 0, focus: null })}
            onFocus={(p) => applyFilters({ ...filters, mode: mode === 'review' ? 'normal' : mode, focus: p })}
          />
        ) : current ? (
          mode === 'cloze' ? (
            <ClozeExercise
              key={exerciseKey}
              sentence={current}
              focus={focus}
              autoPlay={nav.autoPlay}
              focusOnMount={nav.focus}
              top={goalBar}
              onChecked={onChecked}
              onNext={goNext}
              onRetry={retry}
              onSkip={goNext}
            />
          ) : (
            <>
              <Exercise
                key={exerciseKey}
                sentence={current}
                autoPlay={nav.autoPlay}
                focusOnMount={nav.focus}
                top={goalBar}
                onChecked={onChecked}
                onNext={goNext}
                onRetry={retry}
                onSkip={goNext}
              />
              {reviewNote && reviewNote.key === exerciseKey && (
                <p className="dict-review-note muted" role="status">
                  <Icon icon={History} size={15} />
                  <span>{reviewNote.text}</span>
                </p>
              )}
            </>
          )
        ) : (
          renderEmpty()
        )}
      </div>

      {/* the exercise is the job, the list is managed below it (with no sentence yet the stage is empty, so the
          manager's "Thêm câu" comes first). One slot, so adding the first sentence does not remount the manager. */}
      {mode === 'custom' && manager}
    </div>
  );
}
