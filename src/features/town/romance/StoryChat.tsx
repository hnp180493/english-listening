// A scene of "Hẹn hò, cưới, con" (docs/town.md §15): the lines one at a time, each English line with its Vietnamese
// meaning, said as it appears in the speaker's own Gemini voice (owner, 2026-11-22: "mỗi người nên một giọng vì đây là
// game mà, vẫn xài gemini đi"; core/town/romanceAudio): the shipped clip when there is one, else the browser voice of
// that sex (never a paid request). ▶ says it again. At most one choice, then "Xong".

import { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { speak, stopSpeaking } from '../../../core/tts';
import { hasShippedClip, peekAudioManifest } from '../../../core/audioManifest';
import { audioKey } from '../../../core/audioKey';
import { romancePlayback, type SceneCast } from '../../../core/town/romanceAudio';
import { fillLine } from '../../../core/town/romance';
import type { ChatLine, ChatOption, RomanceScene } from '../../../core/town/romanceTypes';
import { tr } from '../../../i18n';

export interface StoryChatProps {
  scene: RomanceScene;
  /** Who 'them' is (the resident's name), who 'you' is (the learner's character), who 'kid' is. */
  them: string;
  you: string;
  kid?: string;
  /** Who is in it, for the voices: the one courted / the spouse, and the child's sex. */
  cast: SceneCast;
  /** Say each line as it appears (the page's sound setting); ▶ always says it. */
  autoplay?: boolean;
  /** Played through: the option picked, if the scene had a choice. */
  onDone: (choice: ChatOption | null) => void;
}

interface Shown {
  line: ChatLine;
  key: string;
}

export default function StoryChat({ scene, them, you, kid = '', cast, autoplay = true, onDone }: StoryChatProps) {
  const [count, setCount] = useState(1);
  const [picked, setPicked] = useState<ChatOption | null>(null);
  const footRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const choiceAt = scene.choice ? Math.min(scene.choice.after, scene.lines.length - 1) : -1;
  // the lines shown: the scene's up to the choice, the answer and the reply, then the rest
  const all = useMemo<Shown[]>(() => {
    const out: Shown[] = [];
    scene.lines.forEach((line, i) => {
      out.push({ line, key: `l${i}` });
      if (i === choiceAt && picked) {
        out.push({ line: { who: 'you', en: picked.en, vi: picked.vi }, key: 'pick' });
        picked.reply.forEach((r, j) => out.push({ line: r, key: `r${j}` }));
      }
    });
    return out;
  }, [scene, choiceAt, picked]);
  // stop at the choice until it is made
  const gate = choiceAt >= 0 && !picked ? all.findIndex((s) => s.key === `l${choiceAt}`) + 1 : all.length;
  const shown = all.slice(0, Math.min(count, gate));
  const asking = choiceAt >= 0 && !picked && shown.length >= gate;
  const finished = !asking && shown.length >= all.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [shown.length, asking]);
  useEffect(() => {
    footRef.current?.focus({ preventScroll: true });
  }, [finished]);
  const say = (line: ChatLine) => {
    const p = line.en ? romancePlayback(line, cast, fillLine(line.en, you, kid)) : null;
    if (!p) return;
    // the shipped clip (a called-out name left out of it); without one, the browser voice reads the line as shown
    const m = peekAudioManifest();
    const clip = p.clip && m && hasShippedClip(m, audioKey(p.mode, p.clip, p.voice)) ? p.clip : null;
    void speak(clip ?? p.fallback, { mode: p.mode, voice: p.voice, browserOnly: true });
  };
  // each new line is said as it appears (narration is not)
  const lastKey = shown.length ? shown[shown.length - 1].key : '';
  useEffect(() => {
    if (!autoplay || !lastKey) return;
    const s = shown[shown.length - 1];
    if (s?.line.en) say(s.line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey, autoplay]);
  useEffect(() => () => stopSpeaking(), []);
  const name = (who: ChatLine['who']) => (who === 'them' ? them : who === 'you' ? you : who === 'kid' ? kid || 'Bé' : '');
  const fill = (t: string) => fillLine(t, you, kid);
  // a Vietnamese line is translated before the names go in (its English keeps {name} / {kid})
  const fillVi = (t: string) => fillLine(tr(t), you, kid);
  return (
    <div className="town-chat">
      <p className="town-ep-scene">{fillVi(scene.scene)}</p>
      <ol className="town-chat-lines" aria-live="polite">
        {shown.map(({ line, key }, i) => (
          <li key={key} ref={i === shown.length - 1 ? endRef : undefined} className={'town-chat-line is-' + line.who}>
            {line.who === 'narr' ? (
              <p className="town-chat-narr">{fillVi(line.vi)}</p>
            ) : (
              <>
                <span className="town-chat-who">{name(line.who)}</span>
                {line.en && (
                  <p className="town-chat-en" lang="en">
                    {fill(line.en)}
                    <button type="button" className="btn btn-ghost btn-sm btn-icon town-chat-play" onClick={() => say(line)} aria-label="Nghe câu này" title="Nghe câu này">
                      <Icon icon={Volume2} size={15} />
                    </button>
                  </p>
                )}
                <p className="town-chat-vi">{fillVi(line.vi)}</p>
              </>
            )}
          </li>
        ))}
      </ol>
      {asking && scene.choice ? (
        <div className="town-chat-choice" role="group" aria-label={scene.choice.q}>
          <p className="town-chat-q">{scene.choice.q}</p>
          <div className="town-reply-list">
            {scene.choice.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                className="town-reply"
                onClick={() => {
                  setPicked(o);
                  setCount((n) => n + 1 + o.reply.length);
                }}
              >
                <span className="town-reply-key" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="town-reply-text">
                  <span lang="en">{fill(o.en)}</span>
                  <span className="town-chat-vi">{fillVi(o.vi)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="town-talk-foot">
          <button ref={footRef} type="button" className="btn btn-primary" onClick={() => (finished ? onDone(picked) : setCount((n) => n + 1))} aria-keyshortcuts="Enter">
            {finished ? 'Xong' : 'Tiếp'}
          </button>
        </div>
      )}
    </div>
  );
}
