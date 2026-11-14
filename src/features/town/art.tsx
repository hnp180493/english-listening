// Small game pictures drawn as DOM over the stage: the xu coin, the friendship hearts, a resident's portrait and
// the "somebody is speaking" bars. Their colours are game art (engine/palette HUD_ART), passed inline.

import { useEffect, useRef } from 'react';
import type { PlaceId } from '../../data/townWorld';
import { drawCharacter, RESIDENT_LOOK } from './engine/draw/characters';
import { HUD_ART, paletteFor } from './engine/palette';
import { PLACE_LOOK } from './engine/places';
import type { Actor } from './engine/sim';

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
 * Friendship with a resident: five hearts, `value` of them full. `fresh` = how many of the full ones were just
 * won (they pop in). Read out as one sentence.
 */
export function Hearts({ value, fresh = 0, name, size = 16 }: { value: number; fresh?: number; name: string; size?: number }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="town-hearts" role="img" aria-label={`Độ thân với ${name}: ${full} trên 5 tim`}>
      {Array.from({ length: 5 }, (_, i) => {
        const on = i < full;
        const isNew = on && i >= full - fresh;
        return (
          <svg key={i} className={'town-heart' + (on ? ' is-on' : '') + (isNew ? ' is-new' : '')} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
            <path d={HEART} fill={on ? HUD_ART.heart : 'none'} stroke={on ? HUD_ART.heart : 'currentColor'} strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        );
      })}
    </span>
  );
}

const STILL: Pick<Actor, 'path' | 'speed' | 'moving' | 'phase'> = { path: [], speed: 0, moving: false, phase: 0 };

/** A resident's face in a round frame, drawn by the same code that draws them in town (always in daylight). */
export function Portrait({ placeId, size = 52 }: { placeId: PlaceId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const pal = paletteFor('day');
    // a soft disc in the colour of their roof
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = HUD_ART.portraitSky;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pal.ink(PLACE_LOOK[placeId].roof, 0.35);
    ctx.fillRect(0, size * 0.62, size, size);
    ctx.globalAlpha = 1;
    // head and shoulders: the feet are far below the frame
    const k = size / 36;
    ctx.translate(size / 2, size + 14.5 * k);
    ctx.scale(k, k);
    const actor: Actor = { id: placeId, kind: 'resident', x: 0, y: 0, tile: { x: 0, y: 0 }, facing: 1, ...STILL };
    drawCharacter({ ctx, pal, t: 0, still: true }, actor, RESIDENT_LOOK[placeId], 1);
    ctx.restore();
  }, [placeId, size]);
  return <canvas ref={ref} className="town-portrait" style={{ width: size, height: size }} aria-hidden="true" />;
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
