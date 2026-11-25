// "Cảnh nghe" (docs/town.md §19, core/town/sceneTypes.ts): something heard in the world. The learner sat down on a
// bench (two residents talk nearby), stands by the café's radio (Bay FM), or came to today's get-together. The whole
// scene plays as SOUND ONLY, then one or two questions with one try each, then the words, line by line.
// One job per step: listen, answer, read. The panel's frame (title, ✕, Esc) is ActivityHost's.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Play, Radio, RotateCcw, Turtle, Volume2, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL } from '../../../core/playback';
import { sceneLinePlayback } from '../../../core/town/sceneAudio';
import { SCENE_VOICES, type ListenScene, type SceneLine, type SceneQuestion } from '../../../core/town/sceneTypes';
import { loadTownProgress } from '../../../core/town/store';
import { eventScene, overheardAt, radioNow, SCENE_PAID_A_DAY, TOWN_EVENTS, type SceneResult } from '../../../core/town/world';
import { finishScene, scenesHeard, townToday, type SceneEnd } from '../../../core/town/worldStore';
import { speak, stopSpeaking } from '../../../core/tts';
import { EVENT_SCENES, OVERHEARD_SCENES, RADIO_SCENES } from '../../../data/scenes';
import { townPlace } from '../../../data/town';
import { benchNumber, thingKind, type PlaceId } from '../../../data/townWorld';
import type { ActivityPanelProps } from '../activities/types';
import { Coin, Portrait, SoundBars } from '../art';
import { safeDecode } from '../../dictation/decodeCache';
import { playSfx } from '../sfx';
import { tl } from '../../../i18n';
import './scenes.css';

/** The scene this panel plays, and whose get-together it is (a place id), if any. */
function pickScene(at: string | null | undefined, now: number): { scene: ListenScene | null; host: string | null } {
  const today = townToday(now);
  const progress = loadTownProgress();
  const recent = new Set(scenesHeard(progress));
  if (at?.startsWith('event:')) {
    const ev = TOWN_EVENTS.find((e) => e.id === at.slice(6));
    return { scene: ev ? eventScene(EVENT_SCENES, ev.id, today.day) : null, host: ev?.host ?? null };
  }
  const kind = at ? thingKind(at) : null;
  if (kind === 'radio') {
    const turn = scenesHeard(progress, today.day).filter((id) => id.startsWith('fm-')).length;
    return { scene: radioNow(RADIO_SCENES, today.day, today.weekday, today.weather, turn, recent), host: null };
  }
  if (kind === 'bench' && at) return { scene: overheardAt(OVERHEARD_SCENES, Math.max(0, benchNumber(at)), today.day, recent), host: null };
  return { scene: null, host: null };
}

const nameOf = (who: string): string => townPlace(who)?.resident ?? SCENE_VOICES[who]?.name ?? '';

function say(line: SceneLine, level: number, careful = false): Promise<void> {
  const p = sceneLinePlayback(line, level, careful);
  return speak(p.text, p.options);
}

/** A speaker's face: a resident's portrait, or the radio for a voice that is only heard. */
function Face({ who, live }: { who: string; live: boolean }) {
  return (
    <span className={'town-ls-face' + (live ? ' is-live' : '')}>
      {townPlace(who) ? (
        <Portrait placeId={who as PlaceId} size={44} />
      ) : (
        <span className="town-ls-radio" aria-hidden="true">
          <Icon icon={Radio} size={22} />
        </span>
      )}
      <span className="town-ls-who">{nameOf(who)}</span>
    </span>
  );
}

/** One line of the words, after the questions: decoded, its meaning, "Nghe" (connected) and the careful version. */
function SaidLine({ line, level }: { line: SceneLine; level: number }) {
  const decoded = useMemo(() => safeDecode(line.text), [line.text]);
  return (
    <li className="town-ls-line">
      <span className="town-ls-line-who">{nameOf(line.who)}</span>
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
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void say(line, level)}>
          <Icon icon={Volume2} size={15} />
          Nghe
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void say(line, level, true)}>
          <Icon icon={Turtle} size={15} />
          {CAREFUL_LABEL}
        </button>
      </div>
    </li>
  );
}

export default function ListenPanel({ onClose, onReward, sound, focus, onScene, onSceneEnd }: ActivityPanelProps) {
  // the scene is chosen once, when the panel opens (what was paid meanwhile must not change it under the learner)
  const [{ scene, host }] = useState(() => pickScene(focus, Date.now()));
  const [step, setStep] = useState<'ready' | 'playing' | 'asking' | 'done'>('ready');
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  const questions = useMemo<SceneQuestion[]>(() => (scene ? (scene.detail ? [scene.gist, scene.detail] : [scene.gist]) : []), [scene]);
  /** The option picked for each question so far (one try each), and the question on the screen. */
  const [picked, setPicked] = useState<number[]>([]);
  const [asking, setAsking] = useState(0);
  const [end, setEnd] = useState<SceneEnd | null>(null);
  const token = useRef(0);
  const result = useRef<SceneResult | null>(null);

  // a get-together happens at its host's place: the stage takes the player there (as a shift at the café does)
  const staged = useRef(false);
  useEffect(() => {
    if (!host || !scene || staged.current) return;
    staged.current = true;
    onScene?.({ placeId: host, spot: { kind: 'place', id: host }, wedding: false });
    return () => {
      onSceneEnd?.({ placeId: host, celebrate: false });
    };
    // once, for the scene this panel opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      token.current += 1;
      stopSpeaking();
    },
    [],
  );

  /** The whole scene, line after line; pressing again while it plays stops it. */
  const play = useCallback(async () => {
    if (!scene) return;
    const mine = ++token.current;
    stopSpeaking();
    setPlays((n) => n + 1);
    setStep((s) => (s === 'ready' ? 'playing' : s));
    for (let i = 0; i < scene.lines.length; i++) {
      if (token.current !== mine) return;
      setSpeaking(i);
      await say(scene.lines[i], scene.level);
    }
    if (token.current !== mine) return;
    setSpeaking(null);
    setStep((s) => (s === 'playing' ? 'asking' : s));
  }, [scene]);
  const stop = useCallback(() => {
    token.current += 1;
    stopSpeaking();
    setSpeaking(null);
    setStep((s) => (s === 'playing' ? 'asking' : s));
  }, []);

  const answered = picked.length > asking;
  const pick = useCallback(
    (i: number) => {
      if (step !== 'asking' || !scene || picked.length !== asking) return;
      playSfx(i === questions[asking].answer ? 'right' : 'wrong', sound);
      setPicked((p) => [...p, i]);
    },
    [step, scene, picked.length, asking, questions, sound],
  );
  /** After an answer: the next question, or the words. */
  const next = useCallback(() => {
    if (!scene || !answered) return;
    if (picked.length < questions.length) return;
    token.current += 1;
    stopSpeaking();
    setSpeaking(null);
    const r: SceneResult = result.current ?? { right: picked.filter((p, k) => p === questions[k].answer).length, asked: questions.length, plays };
    result.current = r;
    const e = finishScene(scene, host, r);
    setEnd(e);
    setStep('done');
    if (e.xu > 0) onReward({ label: scene.kind === 'event' ? 'Dự buổi gặp mặt' : scene.kind === 'radio' ? 'Nghe radio hiểu ý' : 'Nghe lỏm hiểu ý', xu: e.xu });
  }, [scene, host, answered, picked, questions, plays, onReward]);

  // 1–3 answer, Enter goes on, R plays again (the town's own keys: engine/panelKeys)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (step === 'asking' && !answered && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        pick(Number(e.key) - 1);
      } else if (e.key === 'Enter' && step === 'asking' && answered && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        if (asking === questions.length - 1) next();
        else setAsking(asking + 1);
      } else if ((e.key === 'r' || e.key === 'R') && step === 'asking') {
        e.preventDefault();
        void play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, answered, asking, questions.length, pick, play, next]);

  if (!scene) {
    return (
      <div className="town-ls">
        <p className="town-build-hint">Lúc này chưa có gì để nghe ở đây. Ghé lại sau nhé.</p>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const who = [...new Set(scene.lines.map((l) => l.who))];
  const faces = (
    <div className="town-ls-faces" aria-label="Người đang nói">
      {who.map((w) => (
        <Face key={w} who={w} live={speaking !== null && scene.lines[speaking]?.who === w} />
      ))}
    </div>
  );

  // ── the words ──
  if (step === 'done' && end) {
    const right = result.current?.right ?? 0;
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
        {end.capped && <p className="town-build-hint">{tl`Hôm nay đã tính đủ ${SCENE_PAID_A_DAY[scene.kind]} lượt có xu ở đây; nghe thêm vẫn tốt cho tai.`}</p>}
        {end.bond > 0 && host && <p className="town-build-hint">{tl`${nameOf(host)} quý bạn hơn: thân thiết +${end.bond}`}</p>}
        <h4 className="town-ls-sub">Họ đã nói gì</h4>
        <ol className="town-ls-lines">
          {scene.lines.map((l, i) => (
            <SaidLine key={i} line={l} level={scene.level} />
          ))}
        </ol>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-ghost" onClick={() => void play()}>
            <Icon icon={RotateCcw} size={16} />
            Nghe lại cả đoạn
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
            Xong
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
            <button type="button" className="btn btn-primary" onClick={last ? next : () => setAsking(asking + 1)} autoFocus>
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
      {/* overheard from whichever bench the learner sat down on: who is talking, not where the scene was written for */}
      <p className="town-ep-scene">{scene.kind === 'overheard' && who.length === 2 ? tl`${nameOf(who[0])} và ${nameOf(who[1])} đang nói chuyện ngay gần đó.` : scene.scene}</p>
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
          <button type="button" className="btn btn-primary" onClick={() => void play()} autoFocus>
            <Icon icon={Play} size={16} />
            Nghe
          </button>
        )}
      </div>
    </div>
  );
}
