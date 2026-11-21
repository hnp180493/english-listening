// The greeting's bubble over a resident's head (./useGreeting): sound bars while they speak, no words (listening
// first). A tap opens what was said and what it means, and "Nghe lại".

import { useEffect, useRef, useState, type RefObject } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { townPlace } from '../../../data/town';
import type { TownStageHandle } from '../engine/stage';
import { SoundBars } from '../art';
import type { GreetingState } from './useGreeting';
import './friends.css';

export default function GreetBubble({ stage, greet }: { stage: RefObject<TownStageHandle | null>; greet: GreetingState }) {
  const g = greet.greeting;
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { hold } = greet;
  // a new greeting starts closed
  const key = g ? `${g.placeId}:${g.line.id}` : '';
  const [shownKey, setShownKey] = useState(key);
  if (shownKey !== key) {
    setShownKey(key);
    setOpen(false);
  }
  useEffect(() => hold(open), [open, hold]);

  // follow the resident's head every frame while it is up
  useEffect(() => {
    if (!g) return;
    let raf = 0;
    const tick = () => {
      const at = stage.current?.pointOf(g.placeId);
      const el = boxRef.current;
      if (el) {
        if (at) {
          // kept inside the stage: below the head when it is near the top, never past a side edge
          const w = el.parentElement?.clientWidth ?? 0;
          const half = Math.min(150, w / 2);
          const x = w > 0 ? Math.min(w - half, Math.max(half, at.x)) : at.x;
          el.style.transform = `translate(${Math.round(x)}px, ${Math.round(at.y)}px)`;
          el.classList.toggle('is-below', at.y < 190);
          el.style.visibility = 'visible';
        } else el.style.visibility = 'hidden';
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [g, stage]);

  if (!g) return null;
  const name = townPlace(g.placeId)?.resident ?? '';
  return (
    <div ref={boxRef} className="town-greet" style={{ visibility: 'hidden' }}>
      <div className="town-greet-in">
        {open ? (
          <div className="town-greet-pop" role="dialog" aria-label={`${name} chào bạn`}>
            <p className="town-said-plain" lang="en">
              {g.line.text}
            </p>
            <p className="town-ep-vi">{g.line.vi}</p>
            <div className="town-greet-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={greet.replay}>
                <Icon icon={RotateCcw} size={14} />
                Nghe lại
              </button>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={greet.dismiss} aria-label="Đóng">
                <Icon icon={X} size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={'town-greet-bubble' + (greet.sounding ? ' is-live' : '')} onClick={() => setOpen(true)} aria-label={`${name} vừa chào bạn. Bấm để xem câu chào`}>
            <SoundBars on={greet.sounding} />
          </button>
        )}
      </div>
    </div>
  );
}
