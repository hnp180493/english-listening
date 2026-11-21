// The page's celebrations (TownPage): what a write newly unlocked (core/town/store useTownCelebrations: a new
// achievement and its title, a town project done and what it adds to town, an egg given for listening), one at a
// time as a banner at the top of the stage. The page throws the confetti and plays the sound (`onShow`); each one is
// cleared from the queue once it has been shown.

import { useEffect, useMemo, useRef } from 'react';
import { Egg, Heart, Landmark, Trophy, X } from 'lucide-react';
import { Icon } from '../../../../components/Icon';
import { clearTownCelebrations, useTownCelebrations, type TownCelebration } from '../../../../core/town/store';
import { celebrationMs, celebrationView } from './albumModel';
import './album.css';

const ICON = { achievement: Trophy, project: Landmark, egg: Egg, friend: Heart } as const;

export interface CelebrationsProps {
  /** Hold the queue (the pictures are still loading). */
  paused?: boolean;
  /** One celebration is shown: confetti, a sound. */
  onShow?: (c: TownCelebration) => void;
}

export default function Celebrations({ paused = false, onShow }: CelebrationsProps) {
  const queue = useTownCelebrations();
  // the oldest one waiting is the one shown; it leaves the queue once shown long enough (or closed)
  const shown = paused ? null : (queue[0] ?? null);
  const key = shown?.key ?? null;
  const view = useMemo(() => (shown ? celebrationView(shown) : null), [shown]);
  const showRef = useRef(onShow);
  useEffect(() => {
    showRef.current = onShow;
  }, [onShow]);
  const shownRef = useRef(shown);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  // a new one on screen: the page throws the confetti
  useEffect(() => {
    if (key && shownRef.current) showRef.current?.(shownRef.current);
  }, [key]);

  // shown long enough: cleared from the queue, and the next one comes
  const ms = view ? celebrationMs(view) : 0;
  useEffect(() => {
    if (!key) return;
    const id = window.setTimeout(() => clearTownCelebrations([key]), ms);
    return () => window.clearTimeout(id);
  }, [key, ms]);

  if (!shown || !view) return null;
  const more = queue.filter((c) => c.key !== shown.key).length;
  return (
    <div className="town-album-cheer" role="status" aria-live="polite">
      <div className={`town-album-cheer-box is-${view.kind}`} key={shown.key}>
        <span className="town-album-cheer-icon" aria-hidden="true">
          <Icon icon={ICON[view.kind]} size={22} />
        </span>
        <div className="town-album-cheer-text">
          <p className="town-album-cheer-title">{view.title}</p>
          {view.lines.map((l) => (
            <p key={l} className="town-album-cheer-line">
              {l}
            </p>
          ))}
          {more > 0 && <p className="town-album-cheer-more">Còn {more} điều nữa</p>}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon town-album-cheer-close"
          aria-label="Đóng thông báo"
          onClick={() => clearTownCelebrations([shown.key])}
        >
          <Icon icon={X} size={16} />
        </button>
      </div>
    </div>
  );
}
