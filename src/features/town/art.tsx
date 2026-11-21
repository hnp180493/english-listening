// Small game pictures drawn as DOM over the stage: the xu coin, the friendship hearts, a resident's portrait and
// the "somebody is speaking" bars. Their colours are game art (engine/palette HUD_ART), passed inline.

import { useLayoutEffect, useRef, useState } from 'react';
import { townPlace } from '../../data/town';
import type { CharacterId } from './engine/sim';
import { HUD_ART } from './engine/palette';
import { renderPortrait } from './three/chars/portrait';
import { canDraw3d } from './three/offscreen';

/** A face in a portrait: as it is, or smiling (after a right answer). */
export type PortraitMood = 'neutral' | 'happy';

/** The xu coin. Decorative: the number beside it carries the meaning. */
export function Coin({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg className={'town-coin' + (className ? ' ' + className : '')} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9" fill={HUD_ART.coinRim} />
      <circle cx="10" cy="9.3" r="7.4" fill={HUD_ART.coin} />
      <path d="M10 5.2l1.35 2.9 3.15.36-2.34 2.14.64 3.1L10 12.14 7.2 13.7l.64-3.1L5.5 8.46l3.15-.36z" fill={HUD_ART.coinRim} opacity="0.75" />
      <ellipse cx="7" cy="6.2" rx="2.1" ry="1.3" fill={HUD_ART.coinShine} opacity="0.85" />
    </svg>
  );
}

const HEART = 'M10 17.2S2.6 12.7 2.6 7.6A3.9 3.9 0 0 1 10 5.9a3.9 3.9 0 0 1 7.4 1.7c0 5.1-7.4 9.6-7.4 9.6z';

/**
 * Friendship with a resident: `max` hearts (10), `value` of them full. `fresh` = how many of the full ones were just
 * won (they pop in). Read out as one sentence. A game score (core/town/friendship), never a measurement.
 */
export function Hearts({ value, max = 10, fresh = 0, name, size = 16 }: { value: number; max?: number; fresh?: number; name: string; size?: number }) {
  const full = Math.max(0, Math.min(max, Math.round(value)));
  return (
    <span className="town-hearts" role="img" aria-label={`Thân với ${name}: ${full} trên ${max} tim`}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < full;
        const isNew = on && i >= full - fresh;
        return <HeartIcon key={i} on={on} size={size} className={isNew ? 'is-new' : undefined} />;
      })}
    </span>
  );
}

/** One heart: full (game art) or an outline in the text colour. Decorative. */
export function HeartIcon({ on, size = 16, className }: { on: boolean; size?: number; className?: string }) {
  return (
    <svg className={'town-heart' + (on ? ' is-on' : '') + (className ? ' ' + className : '')} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d={HEART} fill={on ? HUD_ART.heart : 'none'} stroke={on ? HUD_ART.heart : 'currentColor'} strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A person's face in a round frame: the 3D character rendered head and shoulders (three/chars/portrait.ts, cached),
 * `happy` after a right answer. `id` is a place id (its resident) or 'player'. Where this browser cannot draw in
 * 3D, the frame shows the first letter of their name instead.
 */
export function Portrait({ placeId, size = 52, mood = 'neutral' }: { placeId: CharacterId; size?: number; mood?: PortraitMood }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [plain] = useState(() => !canDraw3d());
  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const px = Math.round(size * Math.min(3, window.devicePixelRatio || 1));
    if (c.width !== px) c.width = c.height = px;
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(renderPortrait(placeId, px, mood), 0, 0);
  }, [placeId, size, mood]);
  const name = placeId === 'player' ? 'Bạn' : (townPlace(placeId)?.resident ?? '');
  return (
    <span className={'town-portrait' + (mood === 'happy' ? ' is-happy' : '')} style={{ width: size, height: size, backgroundColor: HUD_ART.portraitSky }} aria-hidden="true">
      {plain ? (
        <span className="town-portrait-initial" style={{ fontSize: Math.max(13, Math.round(size * 0.42)), color: HUD_ART.portraitInk }}>
          {name.slice(0, 1)}
        </span>
      ) : (
        <canvas ref={ref} className="town-portrait-canvas" />
      )}
    </span>
  );
}

/** Bars moving like a voice: shown while a line sounds (no words before the answer). */
export function SoundBars({ on }: { on: boolean }) {
  return (
    <span className={'town-bars' + (on ? ' is-on' : '')} aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}
