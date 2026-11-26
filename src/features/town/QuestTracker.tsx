// The quest followed, at the top of the stage under the level (owner, 2026-11-26: "hướng dẫn làm nhiệm vụ như GTA"):
// what to do, where, how far (the stage's way there: StageHandle.guideDistance); a tap opens every quest, and a quest
// picked there is followed and walked to. The stage draws the way and the arrows (StageProps.guide).

import { useEffect, useState, type RefObject } from 'react';
import { ChevronDown, Navigation } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { metres } from './engine/draw/guide';
import type { TownStageHandle } from './engine/stage';
import type { Quest } from './quests';
import { tl } from '../../i18n';

export interface QuestTrackerProps {
  quests: readonly Quest[];
  /** The one followed (quests.ts followed). */
  current: Quest | null;
  stage: RefObject<TownStageHandle | null>;
  /** Follow this one and go there. */
  onPick: (q: Quest) => void;
  /** A chapter to get to in time: when its clock runs out (ms since the epoch); the card counts down. */
  deadline?: number | null;
}

export default function QuestTracker({ quests, current, stage, onPick, deadline = null }: QuestTrackerProps) {
  const [open, setOpen] = useState(false);
  const [far, setFar] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // the countdown of a chapter to get to in time
  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);
  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  // how far, read from the stage a few times a second (the way is found there)
  const hasTarget = !!current?.target;
  useEffect(() => {
    if (!hasTarget) return;
    const read = () => setFar(stage.current?.guideDistance() ?? null);
    const first = window.setTimeout(read, 0);
    const id = window.setInterval(read, 400);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [hasTarget, current?.id, stage]);
  if (!current) return null;
  const shownFar = hasTarget ? far : null;
  return (
    <div className={'town-quest' + (open ? ' is-open' : '')}>
      <button type="button" className="town-quest-card" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={tl`Nhiệm vụ: ${current.title}. ${current.step}`}>
        <span className="town-quest-icon" aria-hidden="true">
          <Icon icon={Navigation} size={15} />
        </span>
        <span className="town-quest-text">
          <span className="town-quest-title">{current.title}</span>
          {left !== null ? (
            // against the clock: the time first, then how far (the step is in the list; a long one cut the time off)
            <span className="town-quest-step">
              <span className={'town-quest-clock tabular' + (left <= 15 ? ' is-low' : '')}>{left > 0 ? tl`Còn ${left} giây` : 'Hết giờ'}</span>
              {shownFar !== null && shownFar >= 1.6 && <span className="town-quest-far tabular"> · {metres(shownFar)}</span>}
            </span>
          ) : (
            <span className="town-quest-step">
              {current.step}
              {shownFar !== null && shownFar >= 1.6 && <span className="town-quest-far tabular"> · {metres(shownFar)}</span>}
            </span>
          )}
        </span>
        {quests.length > 1 && (
          <span className="town-quest-more" aria-hidden="true">
            <Icon icon={ChevronDown} size={16} />
          </span>
        )}
      </button>
      {open && (
        <ul className="town-quest-list" aria-label="Nhiệm vụ">
          {quests.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className={'town-quest-row' + (q.id === current.id ? ' is-on' : '')}
                aria-current={q.id === current.id ? 'true' : undefined}
                onClick={() => {
                  setOpen(false);
                  onPick(q);
                }}
              >
                <span className="town-quest-tag">{q.tag}</span>
                <span className="town-quest-text">
                  <span className="town-quest-title">{q.title}</span>
                  <span className="town-quest-step">{q.step}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
