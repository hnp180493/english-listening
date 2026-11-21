// A choice in an episode, line by line (docs/town.md §12): the learner has just understood what the resident said;
// now they pick what to answer by its Vietnamese intent, then HEAR the answer said (the player's voice, connected) and
// see how it is said and what it means. Only the first pick of a line ever counts (points, facts); a replay shows the
// earlier pick and plays it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, RotateCcw, Sparkles, Turtle } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import SpokenSentence from '../../../components/SpokenSentence';
import { CAREFUL_LABEL, CAREFUL_TITLE, CONNECTED_TITLE } from '../../../core/playback';
import type { TownChoiceResult, TownEpisodeTurn } from '../../../core/town/store';
import type { StoryEpisode } from '../../../core/town/story';
import { storyLinePlayback } from '../../../core/town/storyAudio';
import { NEXT_GUARD_MS } from '../../dictation/constants';
import { safeDecode } from '../../dictation/decodeCache';
import { SoundBars } from '../art';
import { ignoredKeyTarget } from '../talkKeys';
import { useLinePlayer } from '../useLinePlayer';
import { pointsText } from './friendModel';
import './friends.css';

export interface ChoiceTurnProps {
  turn: TownEpisodeTurn;
  episode: StoryEpisode;
  last: boolean;
  lastLabel: string;
  /** Records the pick (core/town/store recordEpisodeChoice); null when it could not. */
  onPick: (lineId: string, optionId: string) => TownChoiceResult | null;
  onSpeaking: (on: boolean) => void;
  onNext: () => void;
}

export default function ChoiceTurn({ turn, episode, last, lastLabel, onPick, onSpeaking, onNext }: ChoiceTurnProps) {
  const pick = turn.pick!;
  const [result, setResult] = useState<TownChoiceResult | null>(null);
  const pickedAt = useRef(0);
  // a replay: the earlier pick is already there
  const chosen = result?.chosen ?? pick.chosen;
  const option = pick.options.find((o) => o.id === chosen) ?? null;

  const choose = useCallback(
    (i: number) => {
      if (chosen || pickedAt.current || i < 0 || i >= pick.options.length) return;
      const r = onPick(turn.base, pick.options[i].id);
      if (!r) return;
      pickedAt.current = Date.now();
      setResult(r);
    },
    [chosen, pick.options, onPick, turn.base],
  );

  // a replay: the earlier pick counts as made (the run needs it to finish)
  const replayed = useRef(false);
  useEffect(() => {
    if (!pick.chosen || replayed.current) return;
    replayed.current = true;
    onPick(turn.base, pick.chosen);
    pickedAt.current = Date.now();
  }, [pick.chosen, onPick, turn.base]);

  const goNext = useCallback(() => {
    if (!option || Date.now() - pickedAt.current < NEXT_GUARD_MS) return;
    onNext();
  }, [option, onNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || ignoredKeyTarget(e.target)) return;
      if (/^[1-9]$/.test(e.key) && !chosen) {
        e.preventDefault();
        choose(Number(e.key) - 1);
      } else if (e.key === 'Enter' && option) {
        if (e.target instanceof HTMLElement && e.target.closest('button, a, summary')) return;
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, chosen, option, goNext]);

  return (
    <div className="town-turn">
      <div className={'town-replies' + (chosen ? ' is-locked' : '')} role="group" aria-label="Bạn muốn nói gì?">
        <p className="town-ask">{chosen && !result?.first && pick.chosen ? 'Lần trước bạn đã chọn:' : 'Bạn muốn nói gì?'}</p>
        <div className="town-reply-list">
          {pick.options.map((o, i) => {
            const on = o.id === chosen;
            return (
              <button key={o.id} type="button" className={'town-reply' + (on ? ' is-chosen' : chosen ? ' is-idle' : '')} onClick={() => choose(i)} disabled={!!chosen} aria-keyshortcuts={String(i + 1)} aria-pressed={on}>
                <span className="town-reply-key" aria-hidden="true">
                  {on ? <Icon icon={Check} size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className="town-reply-text">{o.intent}</span>
              </button>
            );
          })}
        </div>
      </div>
      {option && <SaidOption key={option.id} option={option} who={turn.who} episode={episode} onSpeaking={onSpeaking} />}
      {result && result.first && (result.points !== 0 || result.learned.length > 0) && (
        <div className="town-choice-after">
          {result.points !== 0 && <p className="town-bonus">{pointsText(result.points)}</p>}
          {result.learned.map((f) => (
            <p key={f.id} className="town-note">
              <Icon icon={Sparkles} size={14} /> Ghi vào Sổ tay: {f.vi}
            </p>
          ))}
        </div>
      )}
      {option && (
        <div className="town-talk-foot">
          <button type="button" className="btn btn-primary" onClick={goNext} aria-keyshortcuts="Enter">
            {last ? lastLabel : 'Câu tiếp'}
            <Icon icon={ArrowRight} size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/** The answer picked, heard in the player's voice by itself, then shown the way it is said and what it means. */
function SaidOption({ option, who, episode, onSpeaking }: { option: { id: string; text: string; vi: string; say?: string }; who: string; episode: StoryEpisode; onSpeaking: (on: boolean) => void }) {
  const audio = useMemo(() => {
    const line = { text: option.text, say: option.say, who };
    return { connected: storyLinePlayback(line, episode, 'connected').text, careful: storyLinePlayback(line, episode, 'careful').text, level: episode.level };
  }, [option, who, episode]);
  const voice = useMemo(() => storyLinePlayback({ text: option.text, who }, episode, 'connected').voice, [option.text, who, episode]);
  const player = useLinePlayer(audio, () => undefined, voice);
  const { play, playing, pending } = player;
  useEffect(() => {
    void play('normal', { toggle: false });
  }, [play]);
  const sounding = playing !== null && !pending;
  useEffect(() => {
    onSpeaking(sounding);
    return () => onSpeaking(false);
  }, [sounding, onSpeaking]);
  const decoded = useMemo(() => safeDecode(option.text), [option.text]);
  return (
    <div className="town-bubble is-said">
      <div className="town-said-top">
        <span className={'town-choice-voice' + (sounding ? ' is-live' : '')}>
          <SoundBars on={sounding} />
          <span className="town-bubble-text">Bạn nói</span>
        </span>
        <div className="town-bubble-actions town-said-actions" role="group" aria-label="Nghe lại câu bạn nói">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void play('normal')} disabled={!player.canSpeak} title={CONNECTED_TITLE}>
            <Icon icon={RotateCcw} size={15} />
            Nghe lại
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void play('careful')} disabled={!player.canSpeak} title={CAREFUL_TITLE}>
            <Icon icon={Turtle} size={15} />
            {CAREFUL_LABEL}
          </button>
        </div>
      </div>
      {decoded.tokens.length > 0 ? (
        <div className="town-said">
          <SpokenSentence result={decoded} compact />
        </div>
      ) : (
        <p className="town-said-plain" lang="en">
          {option.text}
        </p>
      )}
      <p className="town-ep-vi">{option.vi}</p>
    </div>
  );
}
