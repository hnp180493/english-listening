// The three steps every "cảnh nghe" goes through, in the town (ListenPanel: a bench, the radio, a get-together, the
// bus) and in the city (city/CityScenePanel: an episode, a short talk): the whole scene as SOUND ONLY, then its
// questions with one try each, then the words, line by line. One job per step: listen, answer, read.
// Whoever uses it picks the scene, says how a line sounds and who speaks, and is told the result once.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, MessageCircle, Play, Radio, RotateCcw, Turtle, Volume2, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL } from '../../../core/playback';
import { YOU, type SceneLine, type SceneQuestion } from '../../../core/town/sceneTypes';
import { stopSpeaking } from '../../../core/tts';
import { Coin, SoundBars } from '../art';
import type { PortraitMood } from '../portraitSheet';
import { safeDecode } from '../../dictation/decodeCache';
import { playSfx } from '../sfx';
import { tl } from '../../../i18n';
import './scenes.css';

export interface FlowScene {
  /** Shown only once the questions are answered. */
  title: string;
  lines: readonly SceneLine[];
  questions: readonly SceneQuestion[];
}

/** How the learner did: questions right at the first try, of how many, and how often the whole scene was played. */
export interface FlowResult {
  right: number;
  asked: number;
  plays: number;
}

/** What the scene gave, shown with the words: xu and a few short lines (a cap reached, friendship gained). */
export interface FlowEnd {
  xu: number;
  notes: readonly string[];
}

export interface SceneFlowProps {
  scene: FlowScene;
  /** One Vietnamese line before listening: where the learner is and who is talking, never what about. */
  intro: string;
  nameOf: (who: string) => string;
  /**
   * A speaker's picture at `size` px (`card`: the big rounded-square one of whoever speaks, Stardew style, with its
   * `mood`; else a small round one); null without one (a voice only heard: a radio is shown).
   */
  face?: (who: string, look: FaceLook) => ReactNode;
  say: (line: SceneLine, careful: boolean) => Promise<void>;
  /** The last question is answered: write the result down, say what it gave. Called once. */
  onDone: (result: FlowResult) => FlowEnd;
  /** Who is speaking now (null = nobody): the stage shows it over their head. */
  onSpeaking?: (who: string | null) => void;
  onClose: () => void;
  /** The stage's sound-effects setting. */
  sound: boolean;
  /** The one the learner came to (their place, the event's host): the big face until somebody else speaks. */
  host?: string | null;
  /** A button before "Xong" on the last step (go on somewhere). */
  doneExtra?: ReactNode;
  /** A second button beside "Nghe" before the first listen (skip the scene). */
  readyExtra?: ReactNode;
  /** The last step's main button (default "Xong"). */
  closeLabel?: string;
}

/** How a speaker's picture is asked for (SceneFlowProps.face). */
export interface FaceLook {
  size: number;
  card: boolean;
  mood: PortraitMood;
}

/** The big picture of whoever speaks (owner, 2026-11-26: "stardew valley lúc nào cũng nhìn rõ được avatar"). */
function bigFace(): number {
  try {
    return window.matchMedia('(max-width: 720px)').matches ? 96 : 148;
  } catch {
    return 148;
  }
}
const SMALL_FACE = 48;

/**
 * Who is talking, Stardew style: the one speaking now (else the last one who spoke) big, in a card with their name
 * under it, the others small beside. Inside the panel, so it never covers the people talking on the stage (the
 * camera frames them in what the panel leaves: engine/stage useStageInsets).
 */
function Speakers({ who, main, live, mood, nameOf, picture, big }: { who: readonly string[]; main: string; live: string | null; mood: PortraitMood; nameOf: (w: string) => string; picture?: (who: string, look: FaceLook) => ReactNode; big: number }) {
  const pic = picture?.(main, { size: big, card: true, mood });
  const rest = who.filter((w) => w !== main);
  return (
    <div className="town-ls-stage" aria-label="Người đang nói">
      <figure className={'town-ls-card' + (live === main ? ' is-live' : '')} style={{ width: big }}>
        {pic ?? (
          <span className="town-ls-radio is-big" style={{ width: big, height: big }} aria-hidden="true">
            <Icon icon={Radio} size={Math.round(big * 0.4)} />
          </span>
        )}
        <figcaption className="town-ls-plate">{nameOf(main)}</figcaption>
      </figure>
      {rest.length > 0 && (
        <div className="town-ls-faces">
          {rest.map((w) => (
            <Face key={w} who={w} name={nameOf(w)} live={live === w} picture={picture} />
          ))}
        </div>
      )}
    </div>
  );
}

function Face({ who, name, live, picture }: { who: string; name: string; live: boolean; picture?: (who: string, look: FaceLook) => ReactNode }) {
  const pic = picture?.(who, { size: SMALL_FACE, card: false, mood: 'neutral' });
  return (
    <span className={'town-ls-face' + (live ? ' is-live' : '')}>
      {pic ?? (
        <span className="town-ls-radio" aria-hidden="true">
          <Icon icon={Radio} size={22} />
        </span>
      )}
      <span className="town-ls-who">{name}</span>
    </span>
  );
}

/** One line of the words, after the questions: decoded, its meaning, "Nghe" (connected) and the careful version. */
function SaidLine({ line, name, say }: { line: SceneLine; name: string; say: (line: SceneLine, careful: boolean) => Promise<void> }) {
  const decoded = useMemo(() => safeDecode(line.text), [line.text]);
  return (
    <li className="town-ls-line">
      <span className="town-ls-line-who">{name}</span>
      {decoded.tokens.length > 0 ? (
        <SpokenSentence result={decoded} compact />
      ) : (
        <p className="town-ls-en" lang="en">
          {line.text}
        </p>
      )}
      <p className="town-ls-vi" data-vi>
        {line.vi}
      </p>
      <div className="town-ls-line-btns">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void say(line, false)}>
          <Icon icon={Volume2} size={15} />
          Nghe
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void say(line, true)}>
          <Icon icon={Turtle} size={15} />
          {CAREFUL_LABEL}
        </button>
      </div>
    </li>
  );
}

export default function SceneFlow({ scene, intro, nameOf, face, say, onDone, onSpeaking, onClose, sound, host, doneExtra, readyExtra, closeLabel }: SceneFlowProps) {
  const [step, setStep] = useState<'ready' | 'playing' | 'asking' | 'done'>('ready');
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [lastWho, setLastWho] = useState<string | null>(null);
  /**
   * The learner's own line waiting to be said (sceneTypes YOU; the first time through only): the talk stops on it,
   * it is shown with its meaning, and "Nói" (or Enter) says it and lets the other answer.
   */
  const [yourTurn, setYourTurn] = useState<number | null>(null);
  const said = useRef<(() => void) | null>(null);
  const heardOnce = useRef(false);
  const [big] = useState(bigFace);
  const [plays, setPlays] = useState(0);
  const questions = scene.questions;
  /** The option picked for each question so far (one try each), and the question on the screen. */
  const [picked, setPicked] = useState<number[]>([]);
  const [asking, setAsking] = useState(0);
  const [end, setEnd] = useState<(FlowEnd & { right: number }) | null>(null);
  const token = useRef(0);
  const result = useRef<FlowResult | null>(null);

  useEffect(
    () => () => {
      token.current += 1;
      stopSpeaking();
    },
    [],
  );
  // whoever speaks is shown speaking in the world too
  useEffect(() => {
    onSpeaking?.(speaking !== null ? (scene.lines[speaking]?.who ?? null) : null);
  }, [speaking, scene, onSpeaking]);
  useEffect(() => () => onSpeaking?.(null), [onSpeaking]);

  /** The whole scene, line after line; pressing again while it plays starts it over. */
  const play = useCallback(async () => {
    const mine = ++token.current;
    stopSpeaking();
    said.current?.();
    setYourTurn(null);
    setPlays((n) => n + 1);
    setStep((s) => (s === 'ready' ? 'playing' : s));
    // the first time through, the learner says their own lines (a talk they began); after that it plays straight on
    const turns = !heardOnce.current;
    for (let i = 0; i < scene.lines.length; i++) {
      if (token.current !== mine) return;
      const line = scene.lines[i];
      if (turns && line.who === YOU) {
        setSpeaking(null);
        setYourTurn(i);
        await new Promise<void>((done) => {
          said.current = done;
        });
        said.current = null;
        if (token.current !== mine) return;
        setYourTurn(null);
      }
      setSpeaking(i);
      if (line.who !== YOU) setLastWho(line.who);
      await say(line, false);
    }
    if (token.current !== mine) return;
    heardOnce.current = true;
    setSpeaking(null);
    setStep((s) => (s === 'playing' ? 'asking' : s));
  }, [scene, say]);
  const stop = useCallback(() => {
    token.current += 1;
    stopSpeaking();
    said.current?.();
    setYourTurn(null);
    heardOnce.current = true;
    setSpeaking(null);
    setStep((s) => (s === 'playing' ? 'asking' : s));
  }, []);

  const answered = picked.length > asking;
  const pick = useCallback(
    (i: number) => {
      if (step !== 'asking' || picked.length !== asking) return;
      playSfx(i === questions[asking].answer ? 'right' : 'wrong', sound);
      setPicked((p) => [...p, i]);
    },
    [step, picked.length, asking, questions, sound],
  );
  /** After the last answer: the words. */
  const finish = useCallback(() => {
    if (!answered || picked.length < questions.length) return;
    token.current += 1;
    stopSpeaking();
    setSpeaking(null);
    const r: FlowResult = result.current ?? { right: picked.filter((p, k) => p === questions[k].answer).length, asked: questions.length, plays };
    result.current = r;
    setEnd({ ...onDone(r), right: r.right });
    setStep('done');
  }, [answered, picked, questions, plays, onDone]);

  // 1–3 answer, Enter goes on, R plays again (the town's own keys: engine/panelKeys)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (yourTurn !== null && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        said.current?.();
        return;
      }
      if (step === 'asking' && !answered && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        pick(Number(e.key) - 1);
      } else if (e.key === 'Enter' && step === 'asking' && answered && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        if (asking === questions.length - 1) finish();
        else setAsking(asking + 1);
      } else if ((e.key === 'r' || e.key === 'R') && step === 'asking') {
        e.preventDefault();
        void play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, answered, asking, questions.length, pick, play, finish, yourTurn]);

  // the people the learner talks with (not the learner: their lines are shown, not a face)
  const who = [...new Set(scene.lines.map((l) => l.who))].filter((w) => w !== YOU);
  const spoken = speaking !== null ? (scene.lines[speaking]?.who ?? null) : null;
  const live = spoken === YOU ? null : spoken;
  // the big one: whoever speaks now, else whoever spoke last, else the one the learner came to, else the first
  // (owner, 2026-11-26: talked to Jun, Gus was the big face)
  const main = live ?? lastWho ?? (host && who.includes(host) ? host : (who[0] ?? ''));
  // their face follows the answer: right, a smile; wrong, a little sad
  const mood: PortraitMood = step === 'asking' && answered ? (picked[asking] === questions[asking].answer ? 'happy' : 'sad') : 'neutral';
  const faces = <Speakers who={who} main={main} live={live} mood={mood} nameOf={nameOf} picture={face} big={big} />;

  // ── the words ──
  if (step === 'done' && end) {
    const right = end.right;
    return (
      <div className="town-ls">
        <p className="town-ls-kicker">{scene.title}</p>
        <p className="town-ls-verdict">
          <Icon icon={right > 0 ? Check : X} size={16} />
          {questions.length === 1 ? (right === 1 ? 'Bạn nghe ra ý chính.' : 'Lần này chưa bắt được ý.') : tl`Đúng ${right}/${questions.length} câu hỏi.`}
          {end.xu > 0 && (
            <span className="town-gain">
              <Coin size={16} />+{end.xu}
            </span>
          )}
        </p>
        {end.notes.map((n) => (
          <p key={n} className="town-build-hint">
            {n}
          </p>
        ))}
        <h4 className="town-ls-sub">Họ đã nói gì</h4>
        <ol className="town-ls-lines">
          {scene.lines.map((l, i) => (
            <SaidLine key={i} line={l} name={nameOf(l.who)} say={say} />
          ))}
        </ol>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-ghost" onClick={() => void play()}>
            <Icon icon={RotateCcw} size={16} />
            Nghe lại cả đoạn
          </button>
          {doneExtra}
          <button type="button" className={doneExtra ? 'btn btn-ghost' : 'btn btn-primary'} onClick={onClose} autoFocus={!doneExtra}>
            {closeLabel ?? 'Xong'}
          </button>
        </div>
      </div>
    );
  }

  // ── a question ──
  if (step === 'asking') {
    const q = questions[asking];
    const mine = answered ? picked[asking] : -1;
    const last = asking === questions.length - 1;
    return (
      <div className="town-ls">
        {faces}
        <div className="town-ls-ask" role="group" aria-label={q.q}>
          <p className="town-ls-q" data-vi>
            {questions.length > 1 && <span className="town-ls-count">{tl`Câu ${asking + 1}/${questions.length}`}</span>}
            {q.q}
          </p>
          <div className="town-reply-list town-ls-options">
            {q.options.map((o, i) => (
              <button
                key={i}
                type="button"
                className={'town-reply' + (answered && i === q.answer ? ' is-right' : '') + (answered && i === mine && i !== q.answer ? ' is-wrong' : '')}
                onClick={() => pick(i)}
                disabled={answered}
              >
                <span className="town-reply-key" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="town-reply-text" data-vi>
                  {o}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-ghost" onClick={() => void play()} aria-keyshortcuts="R" title="Nghe lại (R)">
            <Icon icon={speaking !== null ? Volume2 : RotateCcw} size={16} />
            Nghe lại
          </button>
          {answered && (
            <button type="button" className="btn btn-primary" onClick={last ? finish : () => setAsking(asking + 1)} autoFocus>
              {last ? 'Xem họ đã nói gì' : 'Câu tiếp'}
              <Icon icon={ArrowRight} size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── before and while listening: no words ──
  return (
    <div className="town-ls">
      <p className="town-ep-scene">{intro}</p>
      {faces}
      {yourTurn !== null ? (
        <div className="town-ls-you" role="group" aria-label="Lượt bạn nói">
          <span className="town-ls-you-who">{nameOf(YOU)}</span>
          <p className="town-ls-you-en" lang="en">
            {scene.lines[yourTurn].text}
          </p>
          <p className="town-ls-vi" data-vi>
            {scene.lines[yourTurn].vi}
          </p>
        </div>
      ) : (
        <p className="town-ls-hearing">
          <SoundBars on={step === 'playing'} />
          {step === 'playing' ? (spoken === YOU ? 'Bạn đang nói…' : 'Đang nói… chỉ nghe thôi, chưa có chữ.') : 'Nghe hết một lượt rồi trả lời. Chưa có chữ để nhìn.'}
        </p>
      )}
      <div className="town-talk-foot">
        {yourTurn !== null ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={stop}>
              Trả lời luôn
            </button>
            <button type="button" className="btn btn-primary" onClick={() => said.current?.()} autoFocus aria-keyshortcuts="Enter">
              <Icon icon={MessageCircle} size={16} />
              Nói câu này
            </button>
          </>
        ) : step === 'playing' ? (
          <button type="button" className="btn btn-ghost" onClick={stop}>
            Trả lời luôn
          </button>
        ) : (
          <>
            {readyExtra}
            <button type="button" className="btn btn-primary" onClick={() => void play()} autoFocus>
              <Icon icon={Play} size={16} />
              Nghe
            </button>
          </>
        )}
      </div>
    </div>
  );
}
