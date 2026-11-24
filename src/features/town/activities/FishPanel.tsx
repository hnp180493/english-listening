// "Câu cá" (docs/town.md §10): cast, wait for the float to dip, the fish SAYS something short (a shipped clip, the
// same playback as everywhere else in the app), pick what it said before the line snaps. Pure listening: the options
// appear only after the fish has spoken once, replays cost time and half the xu, a miss shows what it said and how.
// The cast itself is a pure state machine (fish/castMachine.ts); the rules and the pay are core/town/fishing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Flame, Play, RotateCcw, Sparkles, Turtle, VolumeX, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import Segmented from '../../../components/Segmented';
import SpokenSentence from '../../../components/SpokenSentence';
import { PENDING_LABEL } from '../../../components/pendingLabel';
import { CAREFUL_ARIA, CAREFUL_LABEL, CAREFUL_TITLE, CONNECTED_TITLE } from '../../../core/playback';
import type { FishCast } from '../../../core/town/fishing';
import { finishCast, fishingStreak, startCast, useTownGame, type FishCastResult } from '../../../core/town/gameStore';
import { clearTownCelebrations } from '../../../core/town/store';
import { CHUNKS } from '../../../data/chunks';
import { RARITY } from '../../../data/townGame';
import { NEXT_GUARD_MS } from '../../dictation/constants';
import { safeDecode } from '../../dictation/decodeCache';
import { Coin, SoundBars } from '../art';
import { playSfx } from '../sfx';
import { useFishStage } from './stageLink';
import {
  abandonAnswer,
  answerOf,
  BITE_SPEAK_MS,
  canReplay,
  castReducer,
  catchXuNow,
  type CastEvent,
  type CastState,
  clockVi,
  IDLE,
  keyAction,
  optionsShown,
  playsLeft,
  secondsVi,
  timeFraction,
  timeLeftMs,
  waitMsFor,
  xuAfterReplay,
} from './fish/castMachine';
import FishAlbumView from './fish/FishAlbumView';
import FishSprite from './fish/FishSprite';
import PondScene, { type PondPhase } from './fish/PondScene';
import { TierGem } from './fish/TierGem';
import { useFishVoice } from './fish/useFishVoice';
import type { ActivityPanelProps } from './types';
import './fish/fish.css';
import { tl, tr } from '../../../i18n';

type Tab = 'fish' | 'album';

/** A key typed in a field or in another dialog / popover is not the pond's. */
function foreignKeyTarget(t: EventTarget | null, root: HTMLElement | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.closest('[data-popover]')) return true;
  const dialog = t.closest('[role="dialog"]');
  return !!dialog && !!root && !dialog.contains(root);
}

/** The sheet's scrolling body around the panel (ActivityHost), if any. */
function scrollBox(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    if (p.getAttribute('role') === 'dialog') return null;
  }
  return null;
}

const chunkById = new Map(CHUNKS.map((c) => [c.id, c]));

/** What the fish said, shown after the answer: the words, how they sound, what they mean. */
function Reveal({ cast, picked }: { cast: FishCast; picked: number | null }) {
  const { item } = cast;
  const decoded = useMemo(() => (item.kind === 'sentence' ? safeDecode(item.reveal.text) : null), [item]);
  const chunk = item.kind === 'chunk' ? chunkById.get(item.ref) : undefined;
  const wrongPick = picked !== null && picked !== cast.answer ? cast.options[picked] : null;
  return (
    <div className="town-fish-reveal">
      {item.kind === 'sentence' ? (
        <>
          {decoded && decoded.tokens.length > 0 ? (
            <div className="town-fish-said">
              <SpokenSentence result={decoded} compact />
            </div>
          ) : (
            <p className="town-fish-said-text" lang="en">
              {item.reveal.text}
            </p>
          )}
          {item.reveal.vi && <p className="town-fish-vi">{item.reveal.vi}</p>}
        </>
      ) : item.kind === 'chunk' ? (
        <>
          <p className="town-fish-chunk">
            <span className="town-fish-said-text" lang="en">
              {item.reveal.text}
            </span>
            <Icon icon={ArrowRight} size={16} className="town-fish-arrow" />
            <span className="town-fish-spoken" lang="en">
              {item.reveal.spoken}
            </span>
          </p>
          {chunk?.meaning && <p className="town-fish-vi">{chunk.meaning}</p>}
        </>
      ) : (
        <p className="town-fish-said-text" lang="en">
          {item.reveal.text}
        </p>
      )}
      {wrongPick && (
        <p className="town-fish-picked">
          <Icon icon={X} size={14} strokeWidth={3} />
          <span>
            Bạn chọn: <span lang={cast.item.ask === 'said' ? 'en' : undefined}>{wrongPick}</span>
          </span>
        </p>
      )}
    </div>
  );
}

export default function FishPanel({ onReward, sound }: ActivityPanelProps) {
  const game = useTownGame();
  const [tab, setTab] = useState<Tab>('fish');
  const [cast, setCast] = useState<FishCast | null>(null);
  const [state, setState] = useState<CastState>(IDLE);
  const [result, setResult] = useState<FishCastResult | null>(null);
  const [streak, setStreak] = useState(fishingStreak);
  /** The streak an escape just ended (0 = none). */
  const [lostStreak, setLostStreak] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const voice = useFishVoice(cast?.item ?? null);
  const { play: voicePlay, stop: voiceStop } = voice;
  const rootRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // the latest values for timers and speech callbacks
  const stateRef = useRef<CastState>(IDLE);
  const castRef = useRef<FishCast | null>(null);
  const soundRef = useRef(sound);
  const rewardRef = useRef(onReward);
  useEffect(() => {
    soundRef.current = sound;
    rewardRef.current = onReward;
  }, [sound, onReward]);

  /** Answered (a pick or the line snapping): recorded once, paid, celebrated. */
  const finish = useCallback(
    (s: CastState, c: FishCast) => {
      voiceStop();
      const answer = answerOf(s, c);
      if (!answer) return;
      const before = fishingStreak();
      const r = finishCast(c, answer);
      setResult(r);
      setStreak(r.streak);
      setLostStreak(r.outcome.caught ? 0 : before);
      // what this cast unlocked is shown in its result card: the page need not show it again
      if (r.celebrations.length > 0) clearTownCelebrations(r.celebrations.map((x) => x.key));
      if (r.outcome.caught) {
        playSfx(r.newSpecies || r.outcome.firstListen ? 'first' : 'right', soundRef.current);
        if (r.earned > 0) rewardRef.current({ label: tl`Câu được ${c.species.name}` + (r.newSpecies ? tr(' (loài mới)') : ''), xu: r.earned });
      } else if (answer.plays > 0) playSfx('wrong', soundRef.current);
    },
    [voiceStop],
  );

  /** Every change of the cast goes through here (from a click, a key, a timer or the speech). */
  const send = useCallback(
    (e: CastEvent) => {
      const prev = stateRef.current;
      const next = castReducer(prev, e);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      const c = castRef.current;
      if (next.phase === 'answered' && prev.phase !== 'answered' && c) finish(next, c);
    },
    [finish],
  );

  // closing the panel with a fish on the line that has spoken: it got away (recorded, the catch streak ends), so
  // closing is never a free way out of a hard fish; nothing is shown or played (the panel is gone)
  useEffect(
    () => () => {
      const c = castRef.current;
      if (!c) return;
      const answer = abandonAnswer(stateRef.current, c, Date.now());
      if (!answer) return;
      stateRef.current = castReducer(stateRef.current, { type: 'abandon', now: Date.now() });
      finishCast(c, answer);
    },
    [],
  );

  const { phase } = state;
  const inCast = phase === 'waiting' || phase === 'bite' || phase === 'listening';

  // ── the cast ──
  const doCast = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'idle' && s.phase !== 'answered') return;
    if (s.phase === 'answered' && Date.now() - s.answeredAt < NEXT_GUARD_MS) return;
    voiceStop();
    const c = startCast();
    castRef.current = c;
    setCast(c);
    setResult(null);
    send({ type: 'cast', now: Date.now(), waitMs: waitMsFor(c.seed) });
    rootRef.current?.focus({ preventScroll: true });
  }, [voiceStop, send]);

  const playMain = useCallback(
    (auto = false): Promise<void> =>
      voicePlay('main', {
        auto,
        onStart: () => send({ type: 'playStart', now: Date.now() }),
        onEnd: () => send({ type: 'playEnd', now: Date.now() }),
      }),
    [voicePlay, send],
  );
  // the fish tried to speak by itself (for this cast): only then is a "Nghe" button offered, where it could not
  const [autoTried, setAutoTried] = useState<FishCast | null>(null);

  // the float bobs until the bite…
  useEffect(() => {
    if (phase !== 'waiting') return;
    const id = window.setTimeout(
      () => {
        send({ type: 'bite', now: Date.now() });
        playSfx('pop', soundRef.current);
      },
      Math.max(0, state.biteAt - Date.now()),
    );
    return () => window.clearTimeout(id);
  }, [phase, state.biteAt, send]);

  // …then the fish speaks by itself (or on "Nghe", where the browser does not let a page speak on its own)
  useEffect(() => {
    if (phase !== 'bite') return;
    const forCast = cast;
    const id = window.setTimeout(() => void playMain(true).then(() => setAutoTried(forCast)), BITE_SPEAK_MS);
    return () => window.clearTimeout(id);
  }, [phase, playMain, cast]);

  // the clock, from the end of the first play
  const clockOn = phase === 'listening' && state.firstEndAt !== null;
  const limit = cast?.timeLimitMs ?? 0;
  useEffect(() => {
    if (!clockOn) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      send({ type: 'tick', now: t, limitMs: limit });
    }, 100);
    return () => window.clearInterval(id);
  }, [clockOn, limit, send]);

  // the one thing left to do gets the keyboard; a catch is shown from the pond (the fish jumps out), a miss from the
  // verdict, so what the fish said is in view (a phone's sheet is short)
  useEffect(() => {
    if (!result) return;
    nextRef.current?.focus({ preventScroll: true });
    const box = scrollBox(rootRef.current);
    if (!box) return;
    if (result.outcome.caught) box.scrollTop = 0;
    else {
      const v = box.querySelector('.town-fish-verdict');
      if (v) box.scrollTop += v.getBoundingClientRect().top - box.getBoundingClientRect().top - 4;
    }
  }, [result]);

  // the options come up with the clock running: on a short sheet (a phone) they are brought into view at once
  const clockRef = useRef<HTMLDivElement>(null);
  const shownNow = optionsShown(state) && state.phase === 'listening';
  useEffect(() => {
    if (!shownNow) return;
    const el = clockRef.current;
    const box = scrollBox(el);
    if (!el || !box) return;
    const over = box.querySelector('.town-fish-under')?.getBoundingClientRect().bottom ?? 0;
    const room = box.getBoundingClientRect().bottom;
    if (over <= room) return;
    box.scrollTop += Math.min(over - room + 8, el.getBoundingClientRect().top - box.getBoundingClientRect().top - 4);
  }, [shownNow]);

  const pick = useCallback(
    (i: number) => {
      const c = castRef.current;
      if (!c) return;
      send({ type: 'pick', now: Date.now(), index: i, options: c.options.length });
    },
    [send],
  );

  const replay = useCallback(() => {
    if (!cast) return;
    if (phase === 'answered') return void playMain();
    if ((phase === 'bite' || phase === 'listening') && state.plays === 0 && !voice.playing) return void playMain();
    if (canReplay(state, cast.maxPlays)) void playMain();
  }, [cast, phase, state, voice.playing, playMain]);

  // keys: Space casts, 1–4 pick, R plays
  useEffect(() => {
    if (tab !== 'fish') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (foreignKeyTarget(e.target, rootRef.current)) return;
      const onControl = e.target instanceof HTMLElement && !!e.target.closest('button, a, summary, [role="radio"]');
      const a = keyAction(e.key, state, { options: cast?.options.length ?? 0, onControl });
      if (!a) return;
      e.preventDefault();
      if (a.type === 'cast') doCast();
      else if (a.type === 'pick') pick(a.index);
      else replay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, state, cast, doCast, pick, replay]);

  // ── drawing ──
  const caught = !!result?.outcome.caught;
  const pondPhase: PondPhase = phase === 'answered' ? (caught ? 'caught' : 'escaped') : phase;
  // the same moment in the world: the player fishing at the end of the pier
  useFishStage(pondPhase, cast && phase !== 'idle' ? cast.species.tier : null);
  const speaking = voice.playing === 'main' && !voice.pending && phase !== 'answered';
  const tierName = cast ? RARITY[cast.species.tier].name : '';
  const shown = optionsShown(state);
  const left = cast ? timeLeftMs(state, cast.timeLimitMs, now) : 0;
  const frac = cast ? timeFraction(state, cast.timeLimitMs, now) : 1;
  const xuLeft = game.fishXuLeft;
  const worth = cast ? Math.min(catchXuNow(cast.xu, Math.max(1, state.plays)), xuLeft) : 0;
  const replaysLeft = cast ? playsLeft(state, cast.maxPlays) : 0;
  const afterReplay = cast ? Math.min(xuAfterReplay(cast.xu, state.plays), xuLeft) : 0;
  const worthNote = state.plays > 1 ? 'đã nghe lại' : afterReplay < worth && replaysLeft > 0 ? tl`nghe lại chỉ còn +${afterReplay}` : '';
  const ask = cast?.item.ask === 'meaning' ? 'Câu cá vừa nói nghĩa là gì?' : 'Cá vừa nói gì?';

  let status = '';
  if (phase === 'idle') status = '';
  else if (phase === 'waiting') status = 'Chờ cá cắn câu…';
  else if (phase === 'bite' || (phase === 'listening' && !shown)) status = speaking ? 'Cá đang nói…' : voice.pending ? 'Đang tạo giọng…' : tl`Cá ${tr(tierName).toLowerCase()} cắn câu!`;
  else if (phase === 'listening') status = speaking ? 'Cá đang nói lại…' : ask;

  const lowTime = clockOn && left <= 2500;

  return (
    <div className="town-fish" ref={rootRef} tabIndex={-1}>
      {/* while a fish is on the line there is one job: the tabs come back after the answer */}
      {!inCast && (
        <Segmented<Tab>
          block
          ariaLabel="Câu cá hay xem sổ cá"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'fish', label: 'Thả câu' },
            { value: 'album', label: 'Sổ cá', count: `${game.album.caught}/${game.album.total}` },
          ]}
        />
      )}

      {tab === 'album' ? (
        <FishAlbumView album={game.album} />
      ) : (
        <>
          <PondScene phase={pondPhase} tier={cast && phase !== 'idle' ? cast.species.tier : null} speaking={speaking}>
            <div className="town-fish-chips">
              {streak > 0 && (
                <span className="town-fish-chip is-streak" title="Câu được liên tiếp: cá hiếm hay cắn hơn (tính tối đa 5 con). Sổng một con là về 0.">
                  <Icon icon={Flame} size={15} />
                  Chuỗi <span className="tabular">{streak}</span>
                </span>
              )}
              {xuLeft > 0 ? (
                <span className="town-fish-chip" title="Câu cá trả tối đa 30 xu mỗi ngày (mọi máy cộng lại)">
                  <Coin size={15} />
                  Còn <span className="tabular">{xuLeft}</span> xu hôm nay
                </span>
              ) : (
                <span className="town-fish-chip is-muted" title="Câu cá trả tối đa 30 xu mỗi ngày: câu thêm vẫn luyện tai, không có xu">
                  Hết xu câu cá hôm nay
                </span>
              )}
            </div>
            {speaking && (
              <span className="town-fish-voice" aria-hidden="true">
                <SoundBars on />
              </span>
            )}
            {phase === 'answered' && cast && caught && (
              <span className="town-fish-jump" aria-hidden="true">
                <FishSprite species={cast.species} size={132} />
              </span>
            )}
          </PondScene>

          {!voice.canSpeak && (
            <div className="callout callout-warn" role="alert">
              <Icon icon={VolumeX} size={16} />
              <div>Trình duyệt này không có giọng đọc tiếng Anh. Hãy dùng Chrome, Edge hoặc Safari bản mới.</div>
            </div>
          )}

          {phase === 'idle' && (
            <div className="town-fish-start">
              <p className="town-fish-lead">
                {streak > 0
                  ? tl`Đang câu được ${streak} con liên tiếp: cá hiếm hay cắn hơn.`
                  : 'Thả câu, chờ cá cắn, rồi nghe nó nói. Chọn đúng trước khi dây đứt là câu được.'}
              </p>
              <button type="button" className="btn btn-primary town-fish-cta" onClick={doCast} disabled={!voice.canSpeak} aria-keyshortcuts="Space">
                Thả câu
                <kbd className="town-fish-kbd" aria-hidden="true">
                  Space
                </kbd>
              </button>
            </div>
          )}

          {inCast && (
            <div className="town-fish-play">
              <p className={'town-fish-status' + (phase === 'bite' ? ' is-bite' : '')} aria-live="polite">
                {status}
              </p>
              {cast && phase !== 'waiting' && !shown && (
                <p className="town-fish-rules">
                  <TierGem tier={cast.species.tier} />
                  {tierName} · nghe tối đa {cast.maxPlays} lần · {secondsVi(cast.timeLimitMs)} để chọn
                </p>
              )}
              {cast && phase !== 'waiting' && autoTried === cast && state.plays === 0 && !voice.playing && (
                <button type="button" className="btn btn-primary town-fish-cta" onClick={() => void playMain()} aria-keyshortcuts="R">
                  <Icon icon={Play} size={16} fill="currentColor" strokeWidth={1.5} />
                  Nghe cá nói
                </button>
              )}
              {cast && shown && (
                <>
                  <div ref={clockRef} className={'town-fish-clock' + (lowTime ? ' is-low' : '')}>
                    <div className="town-fish-time" role="timer" aria-label={tl`Còn ${secondsVi(left)}`}>
                      <span style={{ transform: `scaleX(${frac})` }} />
                    </div>
                    <span className="town-fish-secs tabular" aria-hidden="true">
                      {clockVi(left)}s
                    </span>
                  </div>
                  <OptionList cast={cast} onPick={pick} />
                  <div className="town-fish-under">
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={replay}
                      disabled={!canReplay(state, cast.maxPlays)}
                      aria-keyshortcuts="R"
                      title={tl`${CONNECTED_TITLE}. Đồng hồ vẫn chạy khi nghe lại`}
                    >
                      <Icon icon={RotateCcw} size={15} />
                      {replaysLeft > 0 ? tl`Nghe lại (còn ${replaysLeft})` : 'Hết lượt nghe lại'}
                    </button>
                    {xuLeft > 0 && (
                      <span className={'town-fish-worth' + (state.plays > 1 ? ' is-halved' : '')}>
                        <Coin size={15} />+{worth}
                        {worthNote && <span className="town-fish-worth-note">{worthNote}</span>}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {phase === 'answered' && cast && result && (
            <div className="town-fish-result">
              <div className={'town-fish-verdict' + (caught ? ' is-ok' : ' is-bad')} role="status">
                <span className="town-fish-verdict-icon" aria-hidden="true">
                  <Icon icon={caught ? Check : X} size={15} strokeWidth={3} />
                </span>
                <div className="town-fish-verdict-text">
                  <p className="town-fish-verdict-title">
                    {caught ? tl`Câu được ${cast.species.name}!` : state.timedOut || result.outcome.reason === 'slow' ? 'Dây đứt: hết giờ rồi' : 'Cá sổng mất rồi'}
                    {result.newSpecies && <span className="town-fish-new">Loài mới!</span>}
                  </p>
                  <p className="town-fish-verdict-sub">
                    <TierGem tier={cast.species.tier} />
                    {caught ? (
                      <>
                        {tierName} · trong {secondsVi(result.outcome.ms)}
                        {result.outcome.firstListen && ' · nghe 1 lần'}
                        {result.streak > 1 && tl` · chuỗi ${result.streak}`}
                        {!result.newSpecies && result.record && result.record.caught > 1 && result.record.bestMs === result.outcome.ms && ' · nhanh nhất từ trước tới giờ'}
                      </>
                    ) : (
                      <>
                        {tl`Một con ${cast.species.name} (${tr(tierName).toLowerCase()}).`}
                        {lostStreak > 1 && tl` Chuỗi ${lostStreak} con dừng ở đây.`}
                      </>
                    )}
                  </p>
                </div>
                {result.xu > 0 && (
                  <span className="town-fish-gain">
                    <Coin size={18} />+{result.xu}
                    <span className="sr-only"> xu</span>
                  </span>
                )}
              </div>

              <div className="town-fish-reveal-box">
                <div className="town-fish-reveal-head">
                  <span className="town-fish-reveal-label">Cá đã nói</span>
                  <div className="town-fish-reveal-btns" role="group" aria-label="Nghe lại câu cá nói">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => (voice.playing === 'main' ? voice.stop() : void playMain())}
                      aria-pressed={voice.playing === 'main'}
                      aria-keyshortcuts="R"
                      title={CONNECTED_TITLE}
                    >
                      <Icon icon={RotateCcw} size={15} />
                      {voice.playing === 'main' ? (voice.pending ? PENDING_LABEL : 'Dừng') : 'Nghe lại'}
                    </button>
                    {voice.hasCareful && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => (voice.playing === 'careful' ? voice.stop() : void voice.play('careful'))}
                        aria-pressed={voice.playing === 'careful'}
                        aria-label={voice.playing === 'careful' ? undefined : CAREFUL_ARIA}
                        title={tl`${CAREFUL_TITLE}, chậm: so với cách nói nhanh`}
                      >
                        <Icon icon={Turtle} size={15} />
                        {voice.playing === 'careful' ? (voice.pending ? PENDING_LABEL : 'Dừng') : CAREFUL_LABEL}
                      </button>
                    )}
                  </div>
                </div>
                <Reveal cast={cast} picked={state.picked} />
              </div>

              <p className="town-fish-fact">
                <Icon icon={Sparkles} size={15} />
                <span>
                  <strong className="town-fish-fact-label">{cast.item.tip.label}:</strong> {cast.item.tip.text}
                </span>
              </p>

              {result.tasksPaid.map((t) => (
                <p key={t.id} className="town-fish-bonus">
                  Xong việc hôm nay: {t.label}
                  <span className="town-fish-bonus-xu">
                    <Coin size={15} />+{t.reward}
                  </span>
                </p>
              ))}
              {result.celebrations.map((c) => (
                <p key={c.key} className="town-fish-bonus">
                  {c.label}
                  {c.detail && <span className="town-fish-bonus-detail"> · {c.detail}</span>}
                </p>
              ))}
              {caught && result.capped && <p className="town-fish-note">Hôm nay câu cá đã đủ 30 xu: con này không có thêm xu, nhưng tai vẫn được luyện.</p>}

              <div className="town-fish-foot">
                <button ref={nextRef} type="button" className="btn btn-primary town-fish-cta" onClick={doCast} aria-keyshortcuts="Space">
                  Thả câu tiếp
                  <kbd className="town-fish-kbd" aria-hidden="true">
                    Space
                  </kbd>
                </button>
              </div>
            </div>
          )}

          <details className="how town-fish-how">
            <summary>Câu cá tính thế nào?</summary>
            <ul>
              <li>Cá nói bằng giọng của ứng dụng (giọng Gemini có sẵn), không phải người thật.</li>
              <li>Nghe xong lần đầu mới hiện lựa chọn và đồng hồ bắt đầu chạy. Nghe lại thì đồng hồ vẫn chạy và chỉ được nửa xu.</li>
              <li>Cá hiếm nói khó hơn, ít thời gian và ít lượt nghe hơn. Câu được liên tiếp thì cá hiếm hay cắn hơn.</li>
              <li>Câu cá trả tối đa 30 xu mỗi ngày; câu thêm vẫn luyện tai nhưng không có xu.</li>
              <li>Tốc độ, độ hiếm, xu chỉ là luật chơi, không phải phép đo. Muốn biết tai nghe tiến bộ thật, xem "Nghe 1 lần là đúng" trong Chép chính tả và Kiểm tra định kỳ.</li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

/** The options, picked by a click or 1–4. Shown only once the fish has spoken (the English ones would give it away). */
function OptionList({ cast, onPick }: { cast: FishCast; onPick: (i: number) => void }) {
  const said = cast.item.ask === 'said';
  return (
    <div className="town-fish-opts" role="group" aria-label={said ? 'Cá vừa nói gì?' : 'Câu cá vừa nói nghĩa là gì?'}>
      {cast.options.map((text, i) => (
        <button key={i} type="button" className="town-fish-opt" onClick={() => onPick(i)} aria-keyshortcuts={String(i + 1)}>
          <span className="town-fish-opt-key" aria-hidden="true">
            {i + 1}
          </span>
          <span className="town-fish-opt-text" lang={said ? 'en' : undefined}>
            {text}
          </span>
        </button>
      ))}
    </div>
  );
}
