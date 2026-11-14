import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, Play, RotateCcw, Sparkles, Square, Turtle, VolumeX, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PENDING_ARIA, PENDING_LABEL } from '../../components/pendingLabel';
import SpokenSentence from '../../components/SpokenSentence';
import type { ListenTally } from '../../core/dictation/listens';
import { CAREFUL_ARIA, CAREFUL_LABEL, CAREFUL_TITLE, CONNECTED_SLOW_TITLE, CONNECTED_TITLE } from '../../core/playback';
import { recordTownAnswer, type TownAnswerResult, type TownTurn } from '../../core/town/store';
import type { TownPlace } from '../../core/town/types';
import { canAnswer, lineOutcome, notePlay } from '../../core/town/visit';
import type { PlaceId } from '../../data/townWorld';
import { NEXT_GUARD_MS } from '../dictation/constants';
import { dictationAudio, safeDecode } from '../dictation/decodeCache';
import { reviewNoteVi } from '../dictation/pageModel';
import type { PortraitMood } from './art/characters';
import { Coin, Hearts, Portrait, SoundBars } from './art';
import { talkSummary, verdictOf, type Verdict } from './shellModel';
import { stopSfx } from './sfx';
import { useLinePlayer, type LinePlay } from './useLinePlayer';

/** The resident's portrait in the panel: big enough to read the face, a little smaller on a phone. */
function portraitSize(): number {
  try {
    return window.matchMedia('(max-width: 720px)').matches ? 56 : 88;
  } catch {
    return 88;
  }
}

/** The camera needs a moment to reach the resident before they speak. */
const SPEAK_DELAY_MS = 700;

function ignoredKeyTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!t.closest('[data-popover], [role="dialog"]');
}

export interface ConversationProps {
  place: TownPlace;
  turns: readonly TownTurn[];
  /** Per turn: the learner had answered that line before this conversation (its words were shown then). */
  met: readonly boolean[];
  /** Friendship with the resident right now (0..5). */
  hearts: number;
  /** The line is sounding (true) or not: the resident gets a bubble in the world. */
  onSpeaking: (on: boolean) => void;
  /** One line was answered and recorded: the world reacts (emote, coins, sound). */
  onAnswered: (result: TownAnswerResult, verdict: Verdict) => void;
  /** The result card came up (confetti for a perfect one is the page's call). */
  onFinished: (results: readonly TownAnswerResult[]) => void;
  onLeave: () => void;
  onAgain: () => void;
  /** The panel itself, once it is on the page (the page measures it); null when it leaves. */
  onBox?: (el: HTMLElement | null) => void;
}

/**
 * A conversation with a resident, in a panel over the bottom of the stage: five lines, each heard (never read)
 * and answered by picking what it meant; then what the conversation came to.
 */
export default function Conversation({ place, turns, met, hearts, onSpeaking, onAnswered, onFinished, onLeave, onAgain, onBox }: ConversationProps) {
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
    <section ref={setBox} className={'town-talk' + (done ? ' is-result' : '')} role="group" aria-label={`Trò chuyện với ${place.resident}`} tabIndex={-1}>
      <header className="town-talk-head">
        <Portrait placeId={placeId} size={faceSize} mood={mood} />
        <div className="town-talk-who">
          <span className="town-talk-name">
            {place.resident}
            <span className="town-talk-place"> · {place.name}</span>
          </span>
          {/* no row of empty hearts before the first one is earned */}
          {hearts > 0 && <Hearts value={hearts} fresh={done ? Math.max(0, hearts - (results[0]?.heartsBefore ?? hearts)) : 0} name={place.resident} />}
          {/* the five steps on their own line: on the name's line they squeezed the place name onto two */}
          {!done && (
            <ol className="town-steps" aria-label={`Câu ${index + 1} trên ${turns.length}`}>
              {turns.map((t, i) => {
                const r = results[i];
                const cls = r ? (r.outcome === 'wrong' ? ' is-bad' : ' is-ok') : i === index ? ' is-now' : '';
                return <li key={t.line.id} className={'town-step' + cls} aria-hidden="true" />;
              })}
            </ol>
          )}
        </div>
        <button type="button" className="btn btn-ghost btn-sm btn-icon town-talk-close" onClick={onLeave} aria-label="Rời cuộc trò chuyện" title="Rời cuộc trò chuyện (Esc)" aria-keyshortcuts="Escape">
          <Icon icon={X} size={18} />
        </button>
      </header>
      <p className="sr-only" role="status">
        {announce}
      </p>

      {done || !turn ? (
        <TalkResult place={place} results={results} met={met} onLeave={onLeave} onAgain={onAgain} />
      ) : (
        <Turn key={turn.line.id} turn={turn} resident={place.resident} met={met[index] ?? false} last={index + 1 >= turns.length} onSpeaking={onSpeaking} onAnswered={answered} onNext={next} />
      )}
    </section>
  );
}

interface TurnProps {
  turn: TownTurn;
  resident: string;
  met: boolean;
  last: boolean;
  onSpeaking: (on: boolean) => void;
  onAnswered: (result: TownAnswerResult, verdict: Verdict) => void;
  onNext: () => void;
}

function Turn({ turn, resident, met, last, onSpeaking, onAnswered, onNext }: TurnProps) {
  const { line, choices } = turn;
  const audio = useMemo(() => dictationAudio(line), [line]);
  const decoded = useMemo(() => safeDecode(line.text), [line.text]);
  const [tally, setTally] = useState<ListenTally | null>(null);
  const tallyRef = useRef<ListenTally | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<TownAnswerResult | null>(null);
  // the usual muted "sẽ quay lại trong Ôn tập" line, for a miss that put the sentence there
  const [note, setNote] = useState<string | null>(null);
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
  const verdict = result ? verdictOf(result.outcome, met) : null;

  const pick = useCallback(
    (i: number) => {
      if (answeredAt.current || i < 0 || i >= choices.options.length) return;
      const outcome = lineOutcome(i === choices.answer, tallyRef.current);
      if (!outcome) return;
      answeredAt.current = Date.now();
      stop();
      const r = recordTownAnswer(line, outcome);
      setPicked(i);
      setResult(r);
      setNote(reviewNoteVi(r.review, answeredAt.current));
      onAnswered(r, verdictOf(r.outcome, met));
    },
    [choices, line, met, onAnswered, stop],
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

      <div className={'town-replies' + (result ? ' is-locked' : '')} role="group" aria-label={`${resident} vừa nói gì?`}>
        <p className="town-ask">{resident} vừa nói gì?</p>
        <div className="town-reply-list" ref={listRef}>
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

      {result && (
        <div className="town-talk-foot">
          <button ref={nextRef} type="button" className="btn btn-primary" onClick={goNext} aria-keyshortcuts="Enter">
            {last ? 'Xem kết quả' : 'Câu tiếp'}
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
}

function TalkResult({ place, results, met, onLeave, onAgain }: TalkResultProps) {
  const s = talkSummary(results, met, place.resident);
  const homeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    homeRef.current?.focus({ preventScroll: true });
  }, []);
  const gained = Math.max(0, s.heartsAfter - s.heartsBefore);
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
      {(s.firstNew > 0 || gained > 0 || s.levelTitle) && (
        <ul className="town-result-extra">
          {s.firstNew > 0 && <li>Nghe một lần đã hiểu: {s.firstNew} câu</li>}
          {gained > 0 && (
            <li>
              Thân với {place.resident} hơn: {s.heartsBefore > 0 ? `${s.heartsBefore} lên ${s.heartsAfter} tim` : s.heartsAfter === 1 ? 'tim đầu tiên' : `${s.heartsAfter} tim`}
            </li>
          )}
          {s.levelTitle && <li>Danh hiệu mới: {s.levelTitle}</li>}
        </ul>
      )}
      <div className="town-talk-foot">
        <button type="button" className="btn" onClick={onAgain}>
          Nói chuyện tiếp
        </button>
        <button ref={homeRef} type="button" className="btn btn-primary" onClick={onLeave}>
          Về thị trấn
        </button>
      </div>
    </div>
  );
}
