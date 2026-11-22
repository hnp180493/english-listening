import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Gift, LoaderCircle, Play, RotateCcw, Sparkles, Square, Turtle, VolumeX, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PENDING_ARIA, PENDING_LABEL } from '../../components/pendingLabel';
import SpokenSentence from '../../components/SpokenSentence';
import type { ListenTally } from '../../core/dictation/listens';
import { CAREFUL_ARIA, CAREFUL_LABEL, CAREFUL_TITLE, CONNECTED_SLOW_TITLE, CONNECTED_TITLE } from '../../core/playback';
import { recordTownAnswer, type TownAnswerResult, type TownGiftGive, type TownTurn } from '../../core/town/store';
import type { SpeakVoice } from '../../core/tts';
import type { TownPlace, TypedMark } from '../../core/town/types';
import { canAnswer, lineOutcome, notePlay } from '../../core/town/visit';
import { SOUND_ALIKE_LABEL } from '../../core/town/soundAlike';
import { judgeTyped, typedOutcome, type TypedJudge } from '../../core/town/typing';
import type { PlaceId } from '../../data/townWorld';
import { NEXT_GUARD_MS } from '../dictation/constants';
import { dictationAudio, safeDecode, type DictationAudio } from '../dictation/decodeCache';
import { reviewNoteVi } from '../dictation/pageModel';
import { Coin, Portrait, SoundBars, type PortraitMood } from './art';
import { heartsOf, type FriendView } from '../../core/town/friendship';
import FriendHearts from './friends/FriendHearts';
import GiftGive from './friends/GiftGive';
import { heartsText, pointsText, type GiftReactionView } from './friends/friendModel';
import { useCanGift } from './friends/useCanGift';
import { soundAlikeNote, talkSummary, typedVerdictOf, verdictOf, type Verdict } from './shellModel';
import { stopSfx } from './sfx';
import { ignoredKeyTarget, SPEAK_DELAY_MS } from './talkKeys';
import type { StreetTalkView } from './streetModel';
import { useLinePlayer, type LinePlay } from './useLinePlayer';

/** The resident's portrait in the panel: big enough to read the face, a little smaller on a phone. */
function portraitSize(): number {
  try {
    return window.matchMedia('(max-width: 720px)').matches ? 56 : 88;
  } catch {
    return 88;
  }
}


export interface ConversationProps {
  place: TownPlace;
  turns: readonly TownTurn[];
  /** Per turn: the learner had answered that line before this conversation (its words were shown then). */
  met: readonly boolean[];
  /** Friendship with the resident right now (core/town/friendship). */
  friend: FriendView;
  /** Open the Sổ tay at this resident (their hearts in the header). */
  onJournal?: () => void;
  /** A gift was given from the result card: the world reacts. */
  onGiven?: (r: Extract<TownGiftGive, { ok: true }>, view: GiftReactionView) => void;
  /** "Tới Tiệm quà" from the gift picker. */
  onShop?: () => void;
  /** The line is sounding (true) or not: the resident gets a bubble in the world. */
  onSpeaking: (on: boolean) => void;
  /** One line was answered and recorded: the world reacts (emote, coins, sound). */
  onAnswered: (result: TownAnswerResult, verdict: Verdict) => void;
  /** The result card came up (confetti for a perfect one is the page's call). */
  onFinished: (results: readonly TownAnswerResult[]) => void;
  onLeave: () => void;
  onAgain: () => void;
  /** Met out in the town (docs/town.md §14): the scene at the start, their parting words at the end. */
  street?: StreetTalkView | null;
  /** "Đi cùng … tới …": go with them to where their next episode waits. */
  onInvite?: () => void;
  /** The panel itself, once it is on the page (the page measures it); null when it leaves. */
  onBox?: (el: HTMLElement | null) => void;
}

/**
 * A conversation with a resident, in a panel over the bottom of the stage: five lines, each heard (never read)
 * and answered by picking what it meant; then what the conversation came to.
 */
export default function Conversation({ place, turns, met, friend, onJournal, onGiven, onShop, onSpeaking, onAnswered, onFinished, onLeave, onAgain, street, onInvite, onBox }: ConversationProps) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<TownAnswerResult[]>([]);
  const [done, setDone] = useState(false);
  // said to a screen reader (the region is always there, so a change is read out)
  const [announce, setAnnounce] = useState('');
  // the face smiles after a right answer, until the next line
  const [mood, setMood] = useState<PortraitMood>('neutral');
  const [faceSize] = useState(portraitSize);
  const turn = turns[index];
  const placeId = place.id as PlaceId;

  const answered = useCallback(
    (r: TownAnswerResult, v: Verdict) => {
      setResults((list) => [...list, r]);
      setMood(r.outcome === 'wrong' ? 'neutral' : 'happy');
      setAnnounce(`${v.title}${r.reward > 0 ? ` Được ${r.reward} xu.` : ''}`);
      onAnswered(r, v);
    },
    [onAnswered],
  );

  const next = useCallback(() => {
    if (index + 1 < turns.length) {
      setMood('neutral');
      setIndex(index + 1);
      return;
    }
    setDone(true);
    setAnnounce(talkSummary(results, met, place.resident).title);
    onFinished(results);
  }, [index, turns.length, onFinished, results, met, place.resident]);

  // Esc leaves, wherever the keyboard is (answered lines are already saved)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || ignoredKeyTarget(e.target)) return;
      e.preventDefault();
      onLeave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLeave]);

  // the keyboard starts in the panel
  const boxRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
  }, []);
  const setBox = useCallback(
    (el: HTMLElement | null) => {
      boxRef.current = el;
      onBox?.(el);
    },
    [onBox],
  );

  return (
    <section ref={setBox} className={'town-talk' + (done ? ' is-result' : '')} role="group" aria-label={`Trò chuyện nhanh với ${place.resident}`} tabIndex={-1}>
      <header className="town-talk-head">
        <Portrait placeId={placeId} size={faceSize} mood={mood} />
        <div className="town-talk-who">
          <span className="town-talk-name">
            {place.resident}
            <span className="town-talk-place"> · {place.name}</span>
          </span>
          {/* nothing before the first point is won */}
          <FriendHearts friend={friend} name={place.resident} onJournal={onJournal} fresh={done && heartsOf(friend.points) > (results[0]?.heartsBefore ?? 0)} />
          {/* the five steps on their own line: on the name's line they squeezed the place name onto two */}
          {!done && (
            <div className="town-talk-meta">
              <ol className="town-steps" aria-label={`Câu ${index + 1} trên ${turns.length}`}>
                {turns.map((t, i) => {
                  const r = results[i];
                  const cls = r ? (r.outcome === 'wrong' ? ' is-bad' : ' is-ok') : i === index ? ' is-now' : '';
                  return <li key={t.line.id} className={'town-step' + cls} aria-hidden="true" />;
                })}
              </ol>
              <span className="town-talk-kind">Trò chuyện nhanh</span>
            </div>
          )}
        </div>
        <button type="button" className="btn btn-ghost btn-sm btn-icon town-talk-close" onClick={onLeave} aria-label="Rời cuộc trò chuyện" title="Rời cuộc trò chuyện (Esc)" aria-keyshortcuts="Escape">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <p className="sr-only" role="status">
        {announce}
      </p>

      {!done && index === 0 && street?.scene && <p className="town-ep-scene">{street.scene}</p>}
      {done || !turn ? (
        <TalkResult place={place} results={results} met={met} onLeave={onLeave} onAgain={onAgain} onGiven={onGiven} onShop={onShop} street={street} onInvite={onInvite} />
      ) : (
        <Turn key={turn.line.id} turn={turn} speaker={place.resident} met={met[index] ?? false} last={index + 1 >= turns.length} onSpeaking={onSpeaking} onAnswered={answered} onNext={next} />
      )}
    </section>
  );
}

export interface TurnProps {
  turn: TownTurn;
  /** Who says the line ("Emma vừa nói gì?"; 'Bạn' for the learner's own character in an episode). */
  speaker: string;
  met: boolean;
  last: boolean;
  onSpeaking: (on: boolean) => void;
  onAnswered: (result: TownAnswerResult, verdict: Verdict) => void;
  onNext: () => void;
  /** What to speak (an episode line: core/town/storyAudio's text); omitted = what Chép chính tả sends for the line. */
  audio?: DictationAudio;
  /** The speaker's voice (an episode line); omitted = the app's voice. */
  voice?: SpeakVoice | null;
  /**
   * Records the answer (an episode line: recordEpisodeLine); omitted = recordTownAnswer. `typed`: the line was a typed
   * check (core/town/typing), and how it went.
   */
  record?: (line: TownTurn['line'], outcome: NonNullable<ReturnType<typeof lineOutcome>>, now?: number, typed?: TypedMark | null) => TownAnswerResult;
  /** The last line's button (default "Xem kết quả"). */
  lastLabel?: string;
}

/** One line: heard (never read) and answered by picking what it meant, then shown the way it was said. */
export function Turn({ turn, speaker, met, last, onSpeaking, onAnswered, onNext, audio: given, voice, record = recordTownAnswer, lastLabel = 'Xem kết quả' }: TurnProps) {
  const resident = speaker;
  const { line, choices } = turn;
  // this line is typed instead of picked (core/town/typing, docs/town.md §13)
  const typing = turn.typing ?? null;
  const audio = useMemo(() => given ?? dictationAudio(line), [given, line]);
  const decoded = useMemo(() => safeDecode(line.text), [line.text]);
  const [tally, setTally] = useState<ListenTally | null>(null);
  const tallyRef = useRef<ListenTally | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<TownAnswerResult | null>(null);
  // the usual muted "sẽ quay lại trong Ôn tập" line, for a miss that put the sentence there
  const [note, setNote] = useState<string | null>(null);
  // a wrong pick that sounds like the line: where the two differ by ear (kept on a phone too)
  const [alikeNote, setAlikeNote] = useState<string | null>(null);
  const answeredAt = useRef(0);

  const player = useLinePlayer(
    audio,
    useCallback((mode: LinePlay, rate: number) => {
      // English is about to sound: no effect may ring over it
      stopSfx();
      // only what was heard before the answer says how the line was understood
      if (answeredAt.current || mode === 'careful') return;
      tallyRef.current = notePlay(tallyRef.current, mode, rate);
      setTally(tallyRef.current);
    }, []),
    voice,
  );
  const { canSpeak, playing, pending, play, stop } = player;

  // the resident speaks by themselves once the camera is there
  useEffect(() => {
    const id = window.setTimeout(() => void play('normal', { toggle: false, auto: true }), SPEAK_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [play]);

  const sounding = playing !== null && !pending;
  useEffect(() => {
    onSpeaking(sounding);
    return () => onSpeaking(false);
  }, [sounding, onSpeaking]);

  const heard = canAnswer(tally);
  const verdict = result ? (typing ? typedVerdictOf(result.outcome, met) : verdictOf(result.outcome, met)) : null;

  // ───── a typed check: the words of the gap, one more try with a hint after a close miss ─────
  const [typed, setTyped] = useState('');
  const [judge, setJudge] = useState<TypedJudge | null>(null);
  const [retried, setRetried] = useState(false);
  const [nudge, setNudge] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const check = useCallback(
    (giveUp = false) => {
      if (answeredAt.current || !typing || !canAnswer(tallyRef.current)) return;
      const j = judgeTyped(typing.target, giveUp ? '' : typed);
      if (!giveUp && j.verdict === 'empty') {
        setNudge(true);
        inputRef.current?.focus();
        return;
      }
      setNudge(false);
      if (!giveUp && !j.correct && j.verdict === 'close' && !retried) {
        // close: one more try, with the first letters
        setRetried(true);
        setJudge(j);
        inputRef.current?.focus();
        return;
      }
      const mark: TypedMark = j.correct ? (retried ? 'helped' : 'ok') : 'miss';
      const outcome = typedOutcome(mark, tallyRef.current);
      if (!outcome) return;
      answeredAt.current = Date.now();
      stop();
      const r = record(line, outcome, answeredAt.current, mark);
      setJudge(j);
      setResult(r);
      setNote(reviewNoteVi(r.review, answeredAt.current));
      onAnswered(r, typedVerdictOf(r.outcome, met));
    },
    [typing, typed, retried, line, met, onAnswered, stop, record],
  );
  // the field takes the keyboard once the line has sounded (not on a touch screen: the keyboard would cover the stage)
  useEffect(() => {
    if (!typing || !heard || answeredAt.current) return;
    try {
      if (!window.matchMedia('(pointer: fine)').matches) return;
    } catch {
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
  }, [typing, heard]);

  const pick = useCallback(
    (i: number) => {
      if (answeredAt.current || typing || i < 0 || i >= choices.options.length) return;
      const outcome = lineOutcome(i === choices.answer, tallyRef.current);
      if (!outcome) return;
      answeredAt.current = Date.now();
      stop();
      const r = record(line, outcome, answeredAt.current);
      setPicked(i);
      setResult(r);
      // a wrong meaning that sounds like the line: say where the two differ by ear
      const kind = i !== choices.answer ? choices.alike?.[i] : null;
      setAlikeNote(kind ? soundAlikeNote(SOUND_ALIKE_LABEL[kind]) : null);
      setNote(reviewNoteVi(r.review, answeredAt.current));
      onAnswered(r, verdictOf(r.outcome, met));
    },
    [choices, line, met, onAnswered, stop, record, typing],
  );

  const goNext = useCallback(() => {
    if (!answeredAt.current || Date.now() - answeredAt.current < NEXT_GUARD_MS) return;
    onNext();
  }, [onNext]);

  // after the answer the keyboard sits on the one thing left to do, and the right meaning is in view: on a phone
  // the panel scrolls, and "Câu tiếp" stays fixed at its foot
  const nextRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!result) return;
    nextRef.current?.focus({ preventScroll: true });
    const row = listRef.current?.querySelector<HTMLElement>('.town-reply.is-right');
    const panel = row?.closest<HTMLElement>('.town-talk');
    if (!row || !panel || panel.scrollHeight <= panel.clientHeight) return;
    const foot = nextRef.current?.closest<HTMLElement>('.town-talk-foot')?.getBoundingClientRect().height ?? 0;
    const over = row.getBoundingClientRect().bottom - (panel.getBoundingClientRect().bottom - foot - 8);
    if (over > 0) panel.scrollTop += over;
  }, [result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || ignoredKeyTarget(e.target)) return;
      if (/^[1-9]$/.test(e.key)) {
        if (answeredAt.current) return;
        e.preventDefault();
        pick(Number(e.key) - 1);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        void play('normal', { toggle: false });
      } else if (e.key === 'Enter' && answeredAt.current) {
        // on a button, Enter is that button's own
        if (e.target instanceof HTMLElement && e.target.closest('button, a, summary')) return;
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, play, goNext]);

  const stopIcon = pending ? <Icon icon={LoaderCircle} size={15} className="icon-spin" /> : <Icon icon={Square} size={13} fill="currentColor" strokeWidth={1.5} />;
  const listenBtn = (mode: 'normal' | 'slow', label: string, icon: typeof Play, cls: string, title: string) => {
    const on = playing === mode;
    return (
      <button
        type="button"
        className={'btn btn-sm ' + cls}
        onClick={() => void play(mode)}
        disabled={!canSpeak}
        aria-pressed={on}
        aria-busy={(pending && on) || undefined}
        aria-label={pending && on ? PENDING_ARIA : undefined}
        aria-keyshortcuts={mode === 'normal' ? 'R' : undefined}
        title={title}
      >
        {on ? stopIcon : <Icon icon={icon} size={15} fill={icon === Play ? 'currentColor' : 'none'} strokeWidth={icon === Play ? 1.5 : 2} />}
        <span className="town-btn-label">{on ? (pending ? PENDING_LABEL : 'Dừng') : label}</span>
      </button>
    );
  };

  const status = result ? '' : sounding ? `${resident} đang nói…` : pending ? 'Đang tạo giọng…' : heard ? `${resident} vừa nói xong.` : `Bấm Nghe để nghe ${resident} nói.`;

  return (
    <div className="town-turn">
      {!result ? (
        <div className={'town-bubble' + (sounding ? ' is-live' : '')}>
          <SoundBars on={sounding} />
          <span className="town-bubble-text" aria-live="polite">
            {status}
          </span>
          <div className="town-bubble-actions" role="group" aria-label="Nghe câu">
            {listenBtn('normal', heard ? 'Nghe lại' : 'Nghe', heard ? RotateCcw : Play, heard ? 'btn-soft' : 'btn-primary', CONNECTED_TITLE)}
            {listenBtn('slow', 'Chậm', Turtle, 'btn-ghost', CONNECTED_SLOW_TITLE)}
          </div>
        </div>
      ) : (
        <div className="town-bubble is-said">
          <div className="town-said-top">
            <p className={'town-verdict is-' + verdict!.tone}>
              <span className="town-verdict-icon" aria-hidden="true">
                <Icon icon={verdict!.tone === 'ok' ? Check : X} size={15} strokeWidth={3} />
              </span>
              <span className="town-verdict-title">{verdict!.title}</span>
              {result.reward > 0 && (
                <span className="town-gain">
                  <Coin size={16} />+{result.reward}
                  <span className="sr-only"> xu</span>
                </span>
              )}
            </p>
            <div className="town-bubble-actions town-said-actions" role="group" aria-label="Nghe lại câu vừa rồi">
            {listenBtn('normal', 'Nghe lại', RotateCcw, 'btn-ghost', CONNECTED_TITLE)}
            {canSpeak && (
              <button
                type="button"
                className={'btn btn-ghost btn-sm' + (playing === 'careful' ? ' is-playing' : '')}
                onClick={() => void play('careful')}
                aria-pressed={playing === 'careful'}
                aria-busy={(pending && playing === 'careful') || undefined}
                aria-label={playing === 'careful' ? undefined : CAREFUL_ARIA}
                title={`${CAREFUL_TITLE}, chậm: so với cách nói nhanh ở trên`}
              >
                {playing === 'careful' ? stopIcon : <Icon icon={Turtle} size={15} />}
                  {playing === 'careful' ? (pending ? PENDING_LABEL : 'Dừng') : CAREFUL_LABEL}
                </button>
              )}
            </div>
          </div>
          {decoded.tokens.length > 0 ? (
            <div className="town-said">
              <SpokenSentence result={decoded} compact />
            </div>
          ) : (
            <p className="town-said-plain" lang="en">
              {line.text}
            </p>
          )}
          {alikeNote && <p className="town-note town-alike-note">{alikeNote}</p>}
          {note && <p className="town-note">{note}</p>}
          {result.tasksPaid.map((t) => (
            <p key={t.id} className="town-bonus">
              <Icon icon={Sparkles} size={15} />
              Xong việc hôm nay: {t.label}
              <span className="town-gain">
                <Coin size={16} />+{t.reward}
              </span>
            </p>
          ))}
          {result.leveledUp && (
            <p className="town-bonus">
              <Icon icon={Sparkles} size={15} />
              Danh hiệu mới: {result.levelAfter.title}
            </p>
          )}
        </div>
      )}

      {!canSpeak && (
        <div className="callout callout-warn" role="alert">
          <Icon icon={VolumeX} size={16} />
          <div>Trình duyệt này không có giọng đọc tiếng Anh. Hãy dùng Chrome, Edge hoặc Safari bản mới.</div>
        </div>
      )}

      {typing ? (
        <div className={'town-type' + (result ? ' is-locked' : '')} role="group" aria-label={`Gõ lại cụm ${resident} vừa nói`}>
          <p className="town-ask">
            Gõ lại cụm {resident} vừa nói
            {!result && <span className="town-type-why"> · gõ đúng được thêm xu</span>}
          </p>
          <p className="town-type-line" lang="en">
            {typing.before && <span>{typing.before} </span>}
            {typing.lead}
            <input
              ref={inputRef}
              className={'input town-type-input' + (result ? (result.outcome === 'wrong' ? ' is-bad' : ' is-ok') : '')}
              style={{ width: `${Math.min(22, Math.max(7, typing.target.length + 3))}ch` }}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                if (nudge) setNudge(false);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.repeat) return;
                e.preventDefault();
                if (!answeredAt.current) check();
              }}
              readOnly={!!result}
              maxLength={80}
              placeholder={judge && !result ? judge.hint : ''}
              aria-label={`Cụm ${resident} vừa nói (${typing.target.split(/\s+/).length} từ)`}
              aria-invalid={result ? result.outcome === 'wrong' : undefined}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
            />
            {typing.trail}
            {typing.after && <span> {typing.after}</span>}
          </p>
          {!result && judge?.verdict === 'close' && (
            <p className="town-type-hint" role="status">
              Gần đúng rồi{judge.ending ? ', để ý đuôi từ' : ''}. Gợi ý: <span className="respell">{judge.hint}</span>. Nghe lại rồi sửa nhé.
            </p>
          )}
          {!result && nudge && (
            <p className="town-type-hint" role="status">
              Gõ những gì bạn nghe được, dù chỉ một từ.
            </p>
          )}
          {result && result.outcome === 'wrong' && (
            <p className="town-type-fix">
              Cụm đúng là <strong lang="en">{typing.target}</strong>
              {typed.trim() ? (
                <>
                  , bạn gõ <s lang="en">{typed.trim()}</s>
                </>
              ) : null}
            </p>
          )}
          {result && <p className="town-type-vi">Nghĩa: {line.vi}</p>}
          {!result && (
            <div className="town-type-actions">
              <button type="button" className={'btn btn-sm' + (heard ? ' btn-primary' : '')} onClick={() => check()} disabled={!heard} aria-keyshortcuts="Enter">
                Kiểm tra
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => check(true)} disabled={!heard}>
                Chịu, xem đáp án
              </button>
            </div>
          )}
        </div>
      ) : (
      <div className={'town-replies' + (result ? ' is-locked' : '')} role="group" aria-label={`${resident} vừa nói gì?`}>
        <p className="town-ask">{resident} vừa nói gì?</p>
        <div className={'town-reply-list' + (choices.options.length === 4 ? ' is-four' : '')} ref={listRef}>
          {choices.options.map((vi, i) => {
            const right = !!result && i === choices.answer;
            const wrong = !!result && i === picked && i !== choices.answer;
            const cls = right ? ' is-right' : wrong ? ' is-wrong' : result ? ' is-idle' : '';
            return (
              <button key={i} type="button" className={'town-reply' + cls} onClick={() => pick(i)} disabled={!heard || !!result} aria-keyshortcuts={String(i + 1)}>
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
      )}

      {result && (
        <div className="town-talk-foot">
          <button ref={nextRef} type="button" className="btn btn-primary" onClick={goNext} aria-keyshortcuts="Enter">
            {last ? lastLabel : 'Câu tiếp'}
            <Icon icon={ArrowRight} size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

interface TalkResultProps {
  place: TownPlace;
  results: readonly TownAnswerResult[];
  met: readonly boolean[];
  onLeave: () => void;
  onAgain: () => void;
  onGiven?: ConversationProps['onGiven'];
  onShop?: () => void;
  street?: StreetTalkView | null;
  onInvite?: () => void;
}

function TalkResult({ place, results, met, onLeave, onAgain, onGiven, onShop, street, onInvite }: TalkResultProps) {
  const s = talkSummary(results, met, place.resident);
  const homeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    homeRef.current?.focus({ preventScroll: true });
  }, []);
  const conv = results[results.length - 1]?.conversation ?? null;
  const gained = conv ? conv.friendAfter - conv.friendBefore : 0;
  const [gifting, setGifting] = useState(false);
  const canGift = useCanGift(place.id);
  return (
    <div className="town-result">
      <h2 className="town-result-title">{s.title}</h2>
      {s.total > 0 ? (
        <div className="town-result-xu">
          <span className="town-result-sum">
            <Coin size={26} />+{s.total}
            <span className="town-result-unit"> xu</span>
          </span>
          {/* where the xu came from, only when more than one thing paid: "+9" twice says nothing */}
          {(s.bonus > 0 || s.tasks.length > 0) && (
            <ul className="town-result-lines">
              <li>
                <span>Các câu hiểu được</span>
                <span className="tabular">+{s.lineXu}</span>
              </li>
              {s.bonus > 0 && (
                <li>
                  <span>Hiểu hết cả {s.lines} câu</span>
                  <span className="tabular">+{s.bonus}</span>
                </li>
              )}
              {s.tasks.map((t) => (
                <li key={t.id}>
                  <span>Việc hôm nay: {t.label}</span>
                  <span className="tabular">+{t.reward}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="town-result-none">Lần này chưa có xu. Nghe lại từng câu rồi thử lần nữa nhé.</p>
      )}
      {(s.firstNew > 0 || gained !== 0 || s.levelTitle || s.typedRight !== null) && (
        <ul className="town-result-extra">
          {s.firstNew > 0 && <li>Nghe một lần đã hiểu: {s.firstNew} câu</li>}
          {s.typedRight !== null && <li>Gõ lại cụm vừa nghe: {s.typedRight ? 'đúng' : 'chưa đúng'}</li>}
          {gained !== 0 && conv && (
            <li>
              Thân với {place.resident}: {pointsText(gained)} · {heartsText(heartsOf(conv.friendAfter))}
            </li>
          )}
          {s.levelTitle && <li>Danh hiệu mới: {s.levelTitle}</li>}
        </ul>
      )}
      {/* met in the street: they ask you round to where their story goes on, or say how close you must get first */}
      {street?.invite && onInvite ? <p className="town-talk-parting">{street.invite.text}</p> : street?.hint ? <p className="town-talk-parting">{street.hint}</p> : null}
      {gifting && <GiftGive placeId={place.id} onGiven={onGiven} onShop={onShop} />}
      <div className="town-talk-foot">
        {!gifting && canGift && (
          <button type="button" className="btn btn-ghost" onClick={() => setGifting(true)}>
            <Icon icon={Gift} size={16} />
            Tặng quà
          </button>
        )}
        {street?.invite && onInvite ? (
          <button type="button" className="btn" onClick={onInvite}>
            {street.invite.go}
          </button>
        ) : (
          <button type="button" className="btn" onClick={onAgain}>
            Nói chuyện tiếp
          </button>
        )}
        <button ref={homeRef} type="button" className="btn btn-primary" onClick={onLeave}>
          Về thị trấn
        </button>
      </div>
    </div>
  );
}
