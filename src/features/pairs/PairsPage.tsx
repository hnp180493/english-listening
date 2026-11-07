import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate, useRoute } from '../../core/nav';
import { recordReview } from '../../core/review';
import { recordAttempt } from '../../core/stats';
import { stopSpeaking } from '../../core/tts';
import { PHENOMENA, type Phenomenon } from '../../core/types';
import { PAIR_SET_ITEMS } from '../../data/pairIndex';
import { PAIR_SETS, type PairItem, type PairSet } from '../../data/pairs';
import {
  advance,
  answerFor,
  applyAnswer,
  applySetResult,
  buildRound,
  currentQuestion,
  isFinished,
  roundForRoute,
  routeSyncAction,
  setsForFocus,
  startRound,
  submitAnswer,
  summarizeRound,
  type PairsProgress,
  type RoundState,
} from './game';
import RoundResults from './RoundResults';
import { pairSetReviewCalls, pairsReviewNote } from './reviewHook';
import RoundView from './RoundView';
import SetPicker from './SetPicker';
import { commitPairsProgress, isPairsStorageKey, loadPairsProgress } from './store';
import './pairs.css';

export type PlayMode =
  | { kind: 'set'; setId: string }
  | { kind: 'mix'; focus: Phenomenon | null }
  | { kind: 'review'; itemIds: string[] };

interface Session {
  id: number; // unique per started round (guards against double answers)
  mode: PlayMode;
  round: RoundState;
  reviewNote?: string; // set once the finished round was scheduled in Ôn tập
}

let sessionSeq = 0;

export interface ItemRef {
  set: PairSet;
  item: PairItem;
}

const SET_BY_ID = new Map(PAIR_SETS.map((s) => [s.id, s]));
const ITEM_BY_ID = new Map<string, ItemRef>(PAIR_SETS.flatMap((set) => set.items.map((item) => [item.id, { set, item }] as const)));

function hasSet(id: string): boolean {
  return SET_BY_ID.has(id);
}

function parseFocus(v: string | undefined): Phenomenon | null {
  return v && (PHENOMENA as readonly string[]).includes(v) ? (v as Phenomenon) : null;
}

function setsForMode(mode: PlayMode): PairSet[] {
  if (mode.kind === 'set') {
    const s = SET_BY_ID.get(mode.setId);
    return s ? [s] : [];
  }
  if (mode.kind === 'mix') return setsForFocus(PAIR_SETS, mode.focus);
  return PAIR_SETS;
}

function newSession(mode: PlayMode, progress: PairsProgress): Session {
  const queue = buildRound(setsForMode(mode), progress, {
    seed: Math.floor(Math.random() * 2 ** 31),
    now: Date.now(),
    onlyItemIds: mode.kind === 'review' ? mode.itemIds : undefined,
  });
  sessionSeq += 1;
  return { id: sessionSeq, mode, round: startRound(queue) };
}

export default function PairsPage() {
  const route = useRoute();
  const focus = parseFocus(route.params.focus);
  const setParam = route.params.set ?? '';
  const modeParam = route.params.mode ?? '';
  const routeKey = `${setParam}|${modeParam}|${route.params.focus ?? ''}`;
  const [progress, setProgress] = useState<PairsProgress>(() => loadPairsProgress());
  const [session, setSession] = useState<Session | null>(null);
  const [seenRouteKey, setSeenRouteKey] = useState<string | null>(null);
  // Question already answered in this tick: a fast double key press must not
  // record the same item twice before React re-renders.
  const answeredRef = useRef('');
  const advancedRef = useRef('');

  // Never leave speech running when leaving the page.
  useEffect(() => () => stopSpeaking(), []);

  // Another tab (or a backup import there) changed pairs progress: show the fresh data.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (isPairsStorageKey(e.key)) setProgress(loadPairsProgress());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Adjust state while rendering when the URL changes (React-recommended pattern).
  // Every round kind the URL can name (?set=, ?mode=mix) starts from here, and any
  // URL change that names no round (AppNav, a filter chip, Back) returns to the picker.
  // seenRouteKey starts null so a deep link starts its round on the first render.
  if (routeKey !== seenRouteKey) {
    setSeenRouteKey(routeKey);
    // Parsed here (not the outer `focus`) so the React Compiler keeps memoizing this page.
    const want = roundForRoute({ set: setParam, mode: modeParam }, parseFocus(route.params.focus), hasSet);
    const action = routeSyncAction(session?.mode ?? null, want);
    if (action === 'start' && want) setSession(newSession(want, progress));
    else if (action === 'clear') setSession(null);
  }

  const missingSet = setParam !== '' && !SET_BY_ID.has(setParam);

  const start = useCallback(
    (mode: PlayMode) => {
      if (mode.kind === 'set') {
        if (setParam === mode.setId) setSession(newSession(mode, progress));
        else navigate('pairs', { set: mode.setId, focus: focus ?? undefined });
        return;
      }
      if (mode.kind === 'mix' && !(modeParam === 'mix' && !setParam && focus === mode.focus)) {
        // Give mix rounds a history entry, like sets: Back / AppNav return to the picker.
        navigate('pairs', { mode: 'mix', focus: mode.focus ?? undefined });
        return;
      }
      setSession(newSession(mode, progress));
      window.scrollTo({ top: 0 });
    },
    [focus, modeParam, progress, setParam],
  );

  const exit = useCallback(() => {
    stopSpeaking();
    setSession(null);
    if (setParam || modeParam) navigate('pairs', { focus: focus ?? undefined });
  }, [focus, modeParam, setParam]);

  const choose = useCallback(
    (choice: number) => {
      if (!session) return;
      const q = currentQuestion(session.round);
      if (!q || answerFor(session.round, q.key)) return;
      const guard = `${session.id}:${q.key}`;
      if (answeredRef.current === guard) return;
      answeredRef.current = guard;
      const ref = ITEM_BY_ID.get(q.itemId);
      const optionCount = ref?.item.options.length ?? 2;
      const replay = Math.floor(Math.random() * optionCount);
      const round = submitAnswer(session.round, choice, replay);
      setSession({ ...session, round });
      if (!q.requeue && ref) {
        const correct = choice === q.answer;
        // Read-modify-write from storage, not the snapshot in state: another tab or a
        // backup import may have written pairs progress since this page mounted.
        const now = Date.now();
        const update = (p: PairsProgress) => applyAnswer(p, q.itemId, correct, now);
        const saved = commitPairsProgress(update);
        // Storage blocked or full: keep counting in memory for this session.
        setProgress(saved ?? update);
        recordAttempt({
          module: 'pairs',
          itemId: q.itemId,
          correct,
          seen: [ref.set.phenomenon],
          missed: correct ? [] : [ref.set.phenomenon],
        });
      }
    },
    [session],
  );

  const next = useCallback(() => {
    if (!session) return;
    const round = advance(session.round);
    if (round === session.round) return;
    const guard = `${session.id}:${session.round.index}`;
    if (advancedRef.current === guard) return;
    advancedRef.current = guard;
    stopSpeaking();
    if (!isFinished(round)) {
      setSession({ ...session, round });
      return;
    }
    const sum = summarizeRound(round);
    const now = Date.now();
    let after = progress;
    if (session.mode.kind === 'set' && sum.total > 0) {
      const setId = session.mode.setId;
      const update = (p: PairsProgress) => applySetResult(p, setId, sum.score, now);
      const saved = commitPairsProgress(update);
      after = saved ?? update(progress);
      setProgress(saved ?? update);
    }
    // Ôn tập: one card per contrast set played (any round kind), graded on this round's first answers.
    // Runs once per round: the advancedRef guard above stops a second call for the same position.
    let reviewNote: string | undefined;
    try {
      const results = pairSetReviewCalls(sum, after, PAIR_SET_ITEMS).map((c) =>
        recordReview(c.id, c.grade, { ctx: 'practice', enrol: c.enrol, success: c.success, now }),
      );
      reviewNote = pairsReviewNote(results, session.mode.kind === 'set', now);
    } catch {
      // review scheduling is best effort
    }
    setSession({ ...session, round, reviewNote });
  }, [progress, session]);

  const modeTitle = useMemo(() => {
    if (!session) return '';
    const m = session.mode;
    if (m.kind === 'set') return SET_BY_ID.get(m.setId)?.title ?? '';
    if (m.kind === 'review') return 'Luyện câu hay sai';
    return 'Trộn tất cả';
  }, [session]);

  if (session) {
    const { round, mode } = session;
    if (round.queue.length === 0) {
      return (
        <div className="pairs page-focus">
          <div className="card empty-state">
            <h1 className="pairs-empty-title">Không có câu nào để luyện</h1>
            <p>Bộ này hiện chưa có câu hỏi. Hãy chọn một bộ khác.</p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={exit}>
                Chọn bộ khác
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (isFinished(round)) {
      return (
        <div className="pairs page-focus">
          <RoundResults
            title={modeTitle}
            round={round}
            items={ITEM_BY_ID}
            sets={SET_BY_ID}
            bestScore={mode.kind === 'set' ? (progress.sets[mode.setId]?.best ?? null) : null}
            reviewNote={session.reviewNote}
            onReplay={() => start(mode)}
            onReviewMissed={(ids) => start({ kind: 'review', itemIds: ids })}
            onExit={exit}
          />
        </div>
      );
    }
    const q = currentQuestion(round);
    const ref = q ? ITEM_BY_ID.get(q.itemId) : undefined;
    if (q && ref) {
      return (
        <div className="pairs page-focus">
          <RoundView
            key={q.key}
            title={modeTitle}
            showSet={mode.kind !== 'set'}
            round={round}
            question={q}
            set={ref.set}
            item={ref.item}
            answer={answerFor(round, q.key)}
            onChoose={choose}
            onNext={next}
            onQuit={exit}
          />
        </div>
      );
    }
  }

  return (
    <div className="pairs">
      <SetPicker
        sets={PAIR_SETS}
        focus={focus}
        progress={progress}
        missingSet={missingSet ? setParam : null}
        onStart={start}
      />
    </div>
  );
}
