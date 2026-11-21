import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowRight, Check, Gift, LoaderCircle, Minus, Play, RotateCcw, Sparkles, Square, VolumeX, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PENDING_LABEL } from '../../components/pendingLabel';
import SpokenSentence from '../../components/SpokenSentence';
import { CONNECTED_TITLE } from '../../core/playback';
import {
  finishTownEpisode,
  recordEpisodeChoice,
  recordEpisodeGist,
  recordEpisodeLine,
  type TownAnswerResult,
  type TownEpisodeGistResult,
  type TownEpisodeResult,
  type TownEpisodeStart,
  type TownEpisodeTurn,
  type TownGiftGive,
} from '../../core/town/store';
import { heartsOf, type FriendView } from '../../core/town/friendship';
import type { TownPlace } from '../../core/town/types';
import { episodeVisitor } from '../../data/townStories';
import type { PlaceId } from '../../data/townWorld';
import { NEXT_GUARD_MS } from '../dictation/constants';
import { safeDecode } from '../dictation/decodeCache';
import { Coin, Portrait, SoundBars, type PortraitMood } from './art';
import ChoiceTurn from './friends/ChoiceTurn';
import FriendHearts from './friends/FriendHearts';
import GiftGive from './friends/GiftGive';
import { useCanGift } from './friends/useCanGift';
import { heartsText, pointsText, type GiftReactionView } from './friends/friendModel';
import { Turn } from './Conversation';
import { ignoredKeyTarget, SPEAK_DELAY_MS } from './talkKeys';
import { episodeHeading, episodeSummary, firstLineOf, gistFollowUp, gistVerdict, nextListenText, storyItems, visitorPresent } from './episodeModel';
import type { Verdict } from './shellModel';
import { stopSfx } from './sfx';
import { useStoryPass } from './useStoryPass';

type Started = Extract<TownEpisodeStart, { ok: true }>;
type Step = 'listen' | 'lines' | 'again' | 'result';

function portraitSize(): number {
  try {
    return window.matchMedia('(max-width: 720px)').matches ? 56 : 88;
  } catch {
    return 88;
  }
}

export interface EpisodeProps {
  place: TownPlace;
  start: Started;
  /** Friendship with the resident right now (core/town/friendship). */
  friend: FriendView;
  /** Open the Sổ tay at this resident (their hearts in the header). */
  onJournal?: () => void;
  /** A gift was given from the result card: the world reacts. */
  onGiven?: (r: Extract<TownGiftGive, { ok: true }>, view: GiftReactionView) => void;
  /** "Tới Tiệm quà" from the gift picker. */
  onShop?: () => void;
  /** Who is speaking now, for the bubble in the town: a place id, 'player', or null. */
  onSpeaking: (stage: string | null) => void;
  /** The neighbour who drops in (if any) is in the room now: from their first line of each pass (visitorPresent). */
  onVisitor?: (present: boolean) => void;
  /** One line was answered and recorded: the world reacts (emote, coins, sound). */
  onAnswered: (result: TownAnswerResult, verdict: Verdict) => void;
  /** The gist was answered and recorded. */
  onGist: (result: TownEpisodeGistResult, verdict: Verdict) => void;
  /** The result card came up. */
  onFinished: (result: TownEpisodeResult) => void;
  onLeave: () => void;
  /** "Trò chuyện nhanh": the five-line chat with the same resident. */
  onQuick: () => void;
  onBox?: (el: HTMLElement | null) => void;
}

/**
 * "Chuyện ở thị trấn": one episode in the conversation panel. A new episode: the whole exchange heard in one go with
 * no text and the gist question (NGHE CẢ ĐOẠN), then every line on its own (TỪNG CÂU), then the whole exchange once
 * more without stopping and the transcript (NGHE LẠI LIỀN MẠCH). A re-listen: the whole exchange and the gist only.
 */
export default function Episode({ place, start, friend, onJournal, onGiven, onShop, onSpeaking, onVisitor, onAnswered, onGist, onFinished, onLeave, onQuick, onBox }: EpisodeProps) {
  const { episode, mode, gist } = start;
  const relisten = mode === 'relisten';
  // the lines as said now: a choice made in this run (and the facts it taught) can change what later lines say
  const [turns, setTurns] = useState<TownEpisodeTurn[]>(start.turns);
  const items = useMemo(() => storyItems(episode, turns), [episode, turns]);
  const pass = useStoryPass(items);
  const { canSpeak, playAll, stop } = pass;
  const [step, setStep] = useState<Step>('listen');
  // whole listens that sounded (heard through, or stopped by the learner after something was heard)
  const [passes, setPasses] = useState(0);
  const passesRef = useRef(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [gistResult, setGistResult] = useState<TownEpisodeGistResult | null>(null);
  const gistAt = useRef(0);
  const [lineIndex, setLineIndex] = useState(0);
  // per turn: how it went ('pick' for a choice)
  const [marks, setMarks] = useState<Record<number, 'ok' | 'bad' | 'pick'>>({});
  const [result, setResult] = useState<TownEpisodeResult | null>(null);
  const [announce, setAnnounce] = useState('');
  const [mood, setMood] = useState<PortraitMood>('neutral');
  const [faceSize] = useState(portraitSize);
  const placeId = place.id as PlaceId;

  // ───── the bubble in the town follows whoever speaks ─────
  const [lineStage, setLineStage] = useState<string | null>(null);
  const passStage = pass.sounding && pass.index >= 0 ? (items[pass.index]?.stage ?? null) : null;
  const stage = passStage ?? lineStage;
  useEffect(() => {
    onSpeaking(stage);
  }, [stage, onSpeaking]);
  useEffect(() => () => onSpeaking(null), [onSpeaking]);

  // ───── the neighbour who drops in comes in at their first line of each pass, never before ─────
  const visitorFirst = useMemo(() => firstLineOf(items, episodeVisitor(episode)), [items, episode]);
  /** The furthest line of the whole listen that has sounded, per step (a new step starts the exchange again). */
  const [reach, setReach] = useState<{ step: Step; i: number }>({ step: 'listen', i: -1 });
  const sounding = pass.sounding ? pass.index : -1;
  if (sounding >= 0 && (step === 'listen' || step === 'again') && (reach.step !== step || reach.i < sounding)) setReach({ step, i: sounding });
  const reached = step === 'lines' ? lineIndex : reach.step === step ? reach.i : -1;
  const visitorIn = visitorPresent(visitorFirst, step, reached);
  useEffect(() => {
    onVisitor?.(visitorIn);
  }, [visitorIn, onVisitor]);
  useEffect(() => () => onVisitor?.(false), [onVisitor]);

  // ───── one whole listen ─────
  const listenAll = useCallback(
    async (auto: boolean) => {
      // English is about to sound: no effect may ring over it
      stopSfx();
      const end = await playAll({ auto });
      if (end.heard) {
        passesRef.current += 1;
        setPasses(passesRef.current);
      }
      return end;
    },
    [playAll],
  );


  // ───── the gist ─────
  const heard = passes > 0;
  const pickGist = useCallback(
    (i: number) => {
      if (gistAt.current || !heard || i < 0 || i >= gist.options.length) return;
      gistAt.current = Date.now();
      stop();
      const r = recordEpisodeGist(i === gist.answer, passesRef.current);
      if (!r) return;
      const v = gistVerdict(mode, r.right, r.firstWin);
      setPicked(i);
      setGistResult(r);
      setMood(r.right ? 'happy' : 'neutral');
      setAnnounce(`${v.title}${r.reward > 0 ? ` Được ${r.reward} xu.` : ''}`);
      onGist(r, v);
    },
    [heard, gist, mode, stop, onGist],
  );

  const toLines = useCallback(() => {
    if (!gistAt.current || Date.now() - gistAt.current < NEXT_GUARD_MS) return;
    stop();
    setMood('neutral');
    if (relisten) {
      const r = gistResult?.result ?? finishTownEpisode();
      if (r) {
        setResult(r);
        setStep('result');
        onFinished(r);
      }
      return;
    }
    setStep('lines');
  }, [relisten, gistResult, stop, onFinished]);

  // ───── line by line ─────
  const lineAnswered = useCallback(
    (r: TownAnswerResult, v: Verdict) => {
      setMarks((m) => ({ ...m, [lineIndex]: r.outcome === 'wrong' ? 'bad' : 'ok' }));
      setMood(r.outcome === 'wrong' ? 'neutral' : 'happy');
      setAnnounce(`${v.title}${r.reward > 0 ? ` Được ${r.reward} xu.` : ''}`);
      onAnswered(r, v);
    },
    [onAnswered, lineIndex],
  );
  const onPick = useCallback(
    (lineId: string, optionId: string) => {
      const r = recordEpisodeChoice(lineId, optionId);
      if (r) {
        setTurns(r.turns);
        setMarks((m) => ({ ...m, [lineIndex]: 'pick' }));
        if (r.first && r.points !== 0) setAnnounce(pointsText(r.points));
      }
      return r;
    },
    [lineIndex],
  );
  const nextLine = useCallback(() => {
    setMood('neutral');
    setLineStage(null);
    if (lineIndex + 1 < turns.length) setLineIndex(lineIndex + 1);
    else setStep('again');
  }, [lineIndex, turns.length]);
  const lineSpeaking = useCallback((on: boolean) => setLineStage(on ? (items[lineIndex]?.stage ?? null) : null), [items, lineIndex]);

  // ───── once more without stopping, then the result ─────
  const finish = useCallback(() => {
    const r = finishTownEpisode();
    if (!r) return;
    setResult(r);
    setStep('result');
    setAnnounce(`Xong Tập ${episode.order}. ${r.earned > 0 ? `Được ${r.earned} xu.` : ''}`);
    onFinished(r);
  }, [episode.order, onFinished]);
  // refs: a new callback from the page must not start the last listen again
  const listenRef = useRef(listenAll);
  const finishRef = useRef(finish);
  useEffect(() => {
    listenRef.current = listenAll;
    finishRef.current = finish;
  }, [listenAll, finish]);
  // the exchange starts by itself once the camera is there (never a paid request: `auto`); once: a choice that
  // changes the lines later (new items, a new listenAll) must not start it again
  useEffect(() => {
    const id = window.setTimeout(() => void listenRef.current(true), SPEAK_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (step !== 'again') return;
    const run = { live: true };
    void (async () => {
      const end = await listenRef.current(false);
      // left the panel in the middle: the episode is not finished
      if (!run.live || (!end.finished && !end.heard)) return;
      finishRef.current();
    })();
    return () => {
      run.live = false;
    };
  }, [step]);

  // ───── keys: Esc leaves; 1–3 the gist; R the whole exchange again; Enter the next step ─────
  const footRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || ignoredKeyTarget(e.target)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onLeave();
        return;
      }
      if (step !== 'listen' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (/^[1-9]$/.test(e.key) && !gistAt.current) {
        e.preventDefault();
        pickGist(Number(e.key) - 1);
      } else if ((e.key === 'r' || e.key === 'R') && !gistAt.current) {
        e.preventDefault();
        if (!pass.playing) void listenAll(false);
      } else if (e.key === 'Enter' && gistAt.current) {
        if (e.target instanceof HTMLElement && e.target.closest('button, a, summary')) return;
        e.preventDefault();
        toLines();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onLeave, pickGist, listenAll, pass.playing, toLines]);

  // the keyboard starts in the panel, and sits on the one thing left to do after the gist and on the result
  const boxRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (gistResult || step === 'result') footRef.current?.focus({ preventScroll: true });
  }, [gistResult, step]);
  const setBox = useCallback(
    (el: HTMLElement | null) => {
      boxRef.current = el;
      onBox?.(el);
    },
    [onBox],
  );

  const stepIndex = step === 'listen' ? 0 : step === 'lines' ? 1 : 2;
  const done = step === 'result';

  return (
    <section ref={setBox} className={'town-talk town-ep' + (done ? ' is-result' : '') + (step === 'listen' && !heard && !gistResult ? ' is-hearing' : '')} role="group" aria-label={`${episodeHeading(episode, relisten)}, với ${place.resident}`} tabIndex={-1}>
      <header className="town-talk-head">
        <Portrait placeId={placeId} size={faceSize} mood={mood} />
        <div className="town-talk-who">
          <span className="town-talk-name">
            {place.resident}
            <span className="town-talk-place"> · {place.name}</span>
          </span>
          <FriendHearts friend={friend} name={place.resident} onJournal={onJournal} fresh={!!result && heartsOf(result.friendAfter) > heartsOf(result.friendBefore)} />
          <div className="town-talk-meta">
            {!relisten && !done && (
              <ol className="town-steps" aria-label={`Bước ${stepIndex + 1} trên 3`}>
                {[0, 1, 2].map((i) => (
                  <li key={i} className={'town-step' + (i < stepIndex ? ' is-ok' : i === stepIndex ? ' is-now' : '')} aria-hidden="true" />
                ))}
              </ol>
            )}
            <span className="town-talk-kind">{episodeHeading(episode, relisten)}</span>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm btn-icon town-talk-close" onClick={onLeave} aria-label="Rời cuộc trò chuyện" title="Rời cuộc trò chuyện (Esc)" aria-keyshortcuts="Escape">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <p className="sr-only" role="status">
        {announce}
      </p>

      {!canSpeak && (
        <div className="callout callout-warn" role="alert">
          <Icon icon={VolumeX} size={16} />
          <div>Trình duyệt này không có giọng đọc tiếng Anh. Hãy dùng Chrome, Edge hoặc Safari bản mới.</div>
        </div>
      )}

      {step === 'listen' && (
        <div className="town-turn">
          {!gistResult && <p className="town-ep-scene">{episode.scene}</p>}
          <PassBubble pass={pass} items={items} heard={heard} label="Nghe cả đoạn" again={heard} onPlay={() => void listenAll(false)} locked={!!gistResult} />
          <div className={'town-replies' + (gistResult ? ' is-locked' : '')} role="group" aria-label={episode.gist.q}>
            <p className="town-ask">{episode.gist.q}</p>
            <div className="town-reply-list">
              {gist.options.map((vi, i) => {
                const right = !!gistResult && i === gist.answer;
                const wrong = !!gistResult && i === picked && i !== gist.answer;
                const cls = right ? ' is-right' : wrong ? ' is-wrong' : gistResult ? ' is-idle' : '';
                return (
                  <button key={i} type="button" className={'town-reply' + cls} onClick={() => pickGist(i)} disabled={!heard || !!gistResult || pass.playing} aria-keyshortcuts={String(i + 1)}>
                    <span className="town-reply-key" aria-hidden="true">
                      {right ? <Icon icon={Check} size={14} strokeWidth={3} /> : wrong ? <Icon icon={X} size={14} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="town-reply-text">{vi}</span>
                    {right && <span className="sr-only"> (đáp án đúng)</span>}
                    {wrong && <span className="sr-only"> (bạn chọn, chưa đúng)</span>}
                  </button>
                );
              })}
            </div>
          </div>
          {gistResult && <GistVerdict result={gistResult} mode={mode} />}
          {gistResult && (
            <div className="town-talk-foot">
              <button ref={footRef} type="button" className="btn btn-primary" onClick={toLines} aria-keyshortcuts="Enter">
                {relisten ? 'Xem kết quả' : 'Nghe từng câu'}
                <Icon icon={ArrowRight} size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'lines' && turns[lineIndex] && (
        <>
          <p className="town-ep-step">
            Từng câu · {lineIndex + 1}/{turns.length}
            <span className="town-ep-dots" aria-hidden="true">
              {turns.map((t, i) => {
                const m = marks[i];
                return <i key={t.base} className={m === 'bad' ? 'is-bad' : m ? 'is-ok' : i === lineIndex ? 'is-now' : ''} />;
              })}
            </span>
          </p>
          {turns[lineIndex].pick ? (
            <ChoiceTurn
              key={turns[lineIndex].base}
              turn={turns[lineIndex]}
              episode={episode}
              last={lineIndex + 1 >= turns.length}
              lastLabel="Nghe lại liền mạch"
              onPick={onPick}
              onSpeaking={lineSpeaking}
              onNext={nextLine}
            />
          ) : (
          <Turn
            key={turns[lineIndex].line.id}
            turn={turns[lineIndex]}
            speaker={turns[lineIndex].speaker}
            // every line was just heard in the whole exchange (step 1): never praised as "nghe một lần đã hiểu"
            met
            last={lineIndex + 1 >= turns.length}
            onSpeaking={lineSpeaking}
            onAnswered={lineAnswered}
            onNext={nextLine}
            audio={items[lineIndex].audio}
            voice={items[lineIndex].voice}
            record={recordEpisodeLine}
            lastLabel="Nghe lại liền mạch"
          />
          )}
        </>
      )}

      {step === 'again' && (
        <div className="town-turn">
          <p className="town-ep-step">Nghe lại liền mạch, không dừng</p>
          <PassBubble pass={pass} items={items} heard={false} label="Nghe cả đoạn" again={false} onPlay={() => undefined} quiet />
        </div>
      )}

      {step === 'result' && result && (
        <EpisodeResult result={result} start={start} turns={turns} place={place} pass={pass} items={items} footRef={footRef} onLeave={onLeave} onQuick={onQuick} onGiven={onGiven} onShop={onShop} />
      )}
    </section>
  );
}

// ───────────────────────── the bubble while the exchange plays ─────────────────────────

interface PassBubbleProps {
  pass: ReturnType<typeof useStoryPass>;
  items: ReturnType<typeof storyItems>;
  heard: boolean;
  /** The button's words before anything was heard. */
  label: string;
  /** Heard once already: the button says "Nghe lại cả đoạn" and is not the primary one. */
  again: boolean;
  /** No button to start it (the last listen starts by itself); only "Dừng" while it plays. */
  quiet?: boolean;
  /** The gist is answered: the status says so. */
  locked?: boolean;
  onPlay: () => void;
}

function PassBubble({ pass, items, heard, label, again, quiet = false, locked = false, onPlay }: PassBubbleProps) {
  const { playing, pending, sounding, index, canSpeak } = pass;
  const who = index >= 0 ? items[index]?.speaker : undefined;
  const status = playing
    ? pending
      ? 'Đang tạo giọng…'
      : who
        ? `${who} đang nói… · ${index + 1}/${items.length}`
        : 'Sắp nói…'
    : locked
      ? 'Đã nghe cả đoạn.'
      : heard
      ? 'Hết đoạn. Hai người vừa nói chuyện gì?'
      : quiet
        ? 'Nghe một mạch, không dừng.'
        : 'Chưa có chữ: chỉ nghe, rồi chọn ý chính.';
  return (
    <div className={'town-bubble' + (sounding ? ' is-live' : '')}>
      <SoundBars on={sounding} />
      <span className="town-bubble-text" aria-live="polite">
        {status}
      </span>
      <div className="town-bubble-actions" role="group" aria-label="Nghe cả đoạn">
        {playing ? (
          <button type="button" className="btn btn-sm btn-ghost" onClick={pass.stop} aria-busy={pending || undefined}>
            {pending ? <Icon icon={LoaderCircle} size={15} className="icon-spin" /> : <Icon icon={Square} size={13} fill="currentColor" strokeWidth={1.5} />}
            <span className="town-btn-label">{pending ? PENDING_LABEL : 'Dừng'}</span>
          </button>
        ) : (
          !quiet && (
            <button type="button" className={'btn btn-sm ' + (again ? 'btn-soft' : 'btn-primary')} onClick={onPlay} disabled={!canSpeak} title={CONNECTED_TITLE} aria-keyshortcuts="R">
              <Icon icon={again ? RotateCcw : Play} size={15} fill={again ? 'none' : 'currentColor'} strokeWidth={again ? 2 : 1.5} />
              <span className="town-btn-label">{again ? 'Nghe lại cả đoạn' : label}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ───────────────────────── after the gist ─────────────────────────

function GistVerdict({ result, mode }: { result: TownEpisodeGistResult; mode: 'new' | 'relisten' }) {
  const v = gistVerdict(mode, result.right, result.firstWin);
  const follow = gistFollowUp(mode, result.right);
  return (
    <div className="town-ep-verdict">
      <p className={'town-verdict is-' + v.tone}>
        <span className="town-verdict-icon" aria-hidden="true">
          <Icon icon={v.tone === 'ok' ? Check : X} size={15} strokeWidth={3} />
        </span>
        <span className="town-verdict-title">{v.title}</span>
        {result.reward > 0 && (
          <span className="town-gain">
            <Coin size={16} />+{result.reward}
            <span className="sr-only"> xu</span>
          </span>
        )}
      </p>
      {follow && <p className="town-note">{follow}</p>}
    </div>
  );
}

// ───────────────────────── the result and the transcript ─────────────────────────

interface EpisodeResultProps {
  result: TownEpisodeResult;
  start: Started;
  turns: readonly TownEpisodeTurn[];
  place: TownPlace;
  pass: ReturnType<typeof useStoryPass>;
  items: ReturnType<typeof storyItems>;
  footRef: RefObject<HTMLButtonElement | null>;
  onLeave: () => void;
  onQuick: () => void;
  onGiven?: EpisodeProps['onGiven'];
  onShop?: () => void;
}

function EpisodeResult({ result, start, turns, place, pass, items, footRef, onLeave, onQuick, onGiven, onShop }: EpisodeResultProps) {
  const s = episodeSummary(result, start.episode, start.firstListen);
  const decoded = useMemo(() => turns.map((t) => safeDecode(t.line.text)), [turns]);
  const [gifting, setGifting] = useState(false);
  const canGift = useCanGift(start.episode.placeId);
  const gained = result.friendAfter - result.friendBefore;
  return (
    <div className="town-result">
      <h2 className="town-result-title">{s.title}</h2>
      {s.checks.length > 0 && (
        <ul className="town-ep-checks">
          {s.checks.map((c) => (
            <li key={c.label} className={'is-' + c.tone}>
              <span className="town-verdict-icon" aria-hidden="true">
                <Icon icon={c.tone === 'ok' ? Check : c.tone === 'bad' ? X : Minus} size={14} strokeWidth={3} />
              </span>
              {c.label}
              {c.tone !== 'part' && <span className="sr-only">{c.tone === 'ok' ? ': đạt' : ': chưa đạt'}</span>}
            </li>
          ))}
        </ul>
      )}
      {s.total > 0 ? (
        <div className="town-result-xu">
          <span className="town-result-sum">
            <Coin size={26} />+{s.total}
            <span className="town-result-unit"> xu</span>
          </span>
          {s.rows.length > 0 && (
            <ul className="town-result-lines">
              {s.rows.map((r) => (
                <li key={r.label}>
                  <span>{r.label}</span>
                  <span className="tabular">+{r.xu}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="town-result-none">Lần này chưa có xu. Đọc lại cả đoạn bên dưới rồi nghe thêm lần nữa nhé.</p>
      )}
      {result.levelTitle && <p className="town-bonus">Danh hiệu mới: {result.levelTitle}</p>}
      {(gained !== 0 || result.learned.length > 0) && (
        <ul className="town-result-extra">
          {gained !== 0 && (
            <li>
              Thân với {place.resident}: {pointsText(gained)} · {heartsText(heartsOf(result.friendAfter))}
            </li>
          )}
          {result.learned.map((f) => (
            <li key={f.id} className="town-learned">
              <Icon icon={Sparkles} size={14} />
              Ghi vào Sổ tay: {f.vi}
            </li>
          ))}
        </ul>
      )}
      <p className="town-note">{nextListenText(place.resident, result.daysToNext)}</p>
      {gifting && <GiftGive placeId={start.episode.placeId} onGiven={onGiven} onShop={onShop} />}

      <section className="town-ep-transcript" aria-label="Cả đoạn hội thoại">
        <div className="town-ep-transcript-head">
          <h3 className="town-ep-transcript-title">Cả đoạn</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => (pass.playing ? pass.stop() : void pass.playAll())} disabled={!pass.canSpeak}>
            {pass.playing ? <Icon icon={Square} size={13} fill="currentColor" strokeWidth={1.5} /> : <Icon icon={RotateCcw} size={15} />}
            {pass.playing ? 'Dừng' : 'Nghe lại cả đoạn'}
          </button>
        </div>
        <ol className="town-ep-lines">
          {turns.map(({ line, base }, i) => {
            const on = pass.index === i && (pass.playing || pass.single !== null);
            return (
              <li key={base} className={'town-ep-line' + (on ? ' is-on' : '')}>
                <div className="town-ep-line-top">
                  <span className="town-ep-who">{items[i]?.speaker}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => (pass.single?.index === i ? pass.stop() : void pass.playOne(i, 'normal'))}
                    disabled={!pass.canSpeak}
                    aria-label={`Nghe câu ${i + 1}`}
                    title={CONNECTED_TITLE}
                  >
                    <Icon icon={pass.single?.index === i ? Square : Play} size={14} fill="currentColor" strokeWidth={1.5} />
                  </button>
                </div>
                {decoded[i].tokens.length > 0 ? (
                  <div className="town-said">
                    <SpokenSentence result={decoded[i]} compact />
                  </div>
                ) : (
                  <p className="town-said-plain" lang="en">
                    {line.text}
                  </p>
                )}
                <p className="town-ep-vi">{line.vi}</p>
              </li>
            );
          })}
        </ol>
        <p className="town-ep-honest">Đây là giọng đọc của app: rõ hơn người thật nói ngoài đời. Nghe được ở đây là bước đầu, chưa phải nghe được mọi người.</p>
      </section>

      <div className="town-talk-foot">
        {!gifting && canGift && (
          <button type="button" className="btn btn-ghost" onClick={() => setGifting(true)}>
            <Icon icon={Gift} size={16} />
            Tặng quà
          </button>
        )}
        <button type="button" className="btn" onClick={onQuick}>
          Trò chuyện nhanh
        </button>
        <button ref={footRef} type="button" className="btn btn-primary" onClick={onLeave}>
          Về thị trấn
        </button>
      </div>
    </div>
  );
}
