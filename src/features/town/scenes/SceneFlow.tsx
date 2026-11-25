// The three steps every "cảnh nghe" goes through, in the town (ListenPanel: a bench, the radio, a get-together, the
// bus) and in the city (city/CityScenePanel: an episode, a short talk): the whole scene as SOUND ONLY, then its
// questions with one try each, then the words, line by line. One job per step: listen, answer, read.
// Whoever uses it picks the scene, says how a line sounds and who speaks, and is told the result once.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, Play, Radio, RotateCcw, Turtle, Volume2, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL } from '../../../core/playback';
import type { SceneLine, SceneQuestion } from '../../../core/town/sceneTypes';
import { stopSpeaking } from '../../../core/tts';
import { Coin, SoundBars } from '../art';
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
  /** A speaker's picture (44 px); without one, a little radio. */
  face?: (who: string) => ReactNode;
  say: (line: SceneLine, careful: boolean) => Promise<void>;
  /** The last question is answered: write the result down, say what it gave. Called once. */
  onDone: (result: FlowResult) => FlowEnd;
  /** Who is speaking now (null = nobody): the stage shows it over their head. */
  onSpeaking?: (who: string | null) => void;
  onClose: () => void;
  /** The stage's sound-effects setting. */
  sound: boolean;
  /** A button before "Xong" on the last step (go on somewhere). */
  doneExtra?: ReactNode;
  /** A second button beside "Nghe" before the first listen (skip the scene). */
  readyExtra?: ReactNode;
  /** The last step's main button (default "Xong"). */
  closeLabel?: string;
}

function Face({ who, name, live, picture }: { who: string; name: string; live: boolean; picture?: (who: string) => ReactNode }) {
  const pic = picture?.(who);
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

export default function SceneFlow({ scene, intro, nameOf, face, say, onDone, onSpeaking, onClose, sound, doneExtra, readyExtra, closeLabel }: SceneFlowProps) {
  const [step, setStep] = useState<'ready' | 'playing' | 'asking' | 'done'>('ready');
  const [speaking, setSpeaking] = useState<number | null>(null);
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
    setPlays((n) => n + 1);
    setStep((s) => (s === 'ready' ? 'playing' : s));
    for (let i = 0; i < scene.lines.length; i++) {
      if (token.current !== mine) return;
      setSpeaking(i);
      await say(scene.lines[i], false);
    }
    if (token.current !== mine) return;
    setSpeaking(null);
    setStep((s) => (s === 'playing' ? 'asking' : s));
  }, [scene, say]);
  const stop = useCallback(() => {
    token.current += 1;
    stopSpeaking();
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
  }, [step, answered, asking, questions.length, pick, play, finish]);

  const who = [...new Set(scene.lines.map((l) => l.who))];
  const faces = (
    <div className="town-ls-faces" aria-label="Người đang nói">
      {who.map((w) => (
        <Face key={w} who={w} name={nameOf(w)} live={speaking !== null && scene.lines[speaking]?.who === w} picture={face} />
      ))}
    </div>
  );

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
      <p className="town-ls-hearing">
        <SoundBars on={step === 'playing'} />
        {step === 'playing' ? 'Đang nói… chỉ nghe thôi, chưa có chữ.' : 'Nghe hết một lượt rồi trả lời. Chưa có chữ để nhìn.'}
      </p>
      <div className="town-talk-foot">
        {step === 'playing' ? (
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
