// Small game pictures drawn as DOM over the stage: the xu coin, the friendship hearts, a resident's portrait and
// the "somebody is speaking" bars. Their colours are game art (engine/palette HUD_ART), passed inline.

import { useLayoutEffect, useRef, useState } from 'react';
import { townPlace } from '../../data/town';
import type { CharacterId } from './engine/sim';
import { HUD_ART } from './engine/palette';
import { renderPortrait } from './three/chars/portrait';
import { sheetCell, type PortraitMood } from './portraitSheet';
import { canDraw3d } from './three/offscreen';
import { tl } from '../../i18n';

export type { PortraitMood };

/** The 3D faces only smile or not. */
const FACE_3D: Readonly<Record<PortraitMood, 'neutral' | 'happy'>> = {
  neutral: 'neutral',
  happy: 'happy',
  sad: 'neutral',
  love: 'happy',
  surprised: 'neutral',
  moved: 'happy',
  pout: 'neutral',
  thinking: 'neutral',
  worried: 'neutral',
};

/** A drawn portrait shows the face (small pictures) or head and shoulders (big ones). */
export type PortraitFrame = 'face' | 'bust';

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
    <span className="town-hearts" role="img" aria-label={tl`Thân với ${name}: ${full} trên ${max} tim`}>
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
 * A person's portrait, `happy` after a right answer, `sad` after a wrong one: the resident's drawn picture when there is one
 * (docs/portrait-prompts.md: one 3 × 3 grid of faces, portraitSheet.ts picks the cell; small ones show the face, from
 * 100 px or `frame="bust"` head and shoulders), else the 3D character rendered head and shoulders (three/chars/portrait.ts, cached). `shape="card"` =
 * a rounded square, and `fluid` fills its box's width (`size` is then only the picture's resolution). `id` is a place
 * id (its resident) or 'player'. With no picture where this browser cannot draw in 3D, the frame shows the first
 * letter of their name instead.
 */
export function Portrait({
  placeId,
  size = 52,
  mood = 'neutral',
  look = '',
  frame,
  shape = 'round',
  fluid = false,
  name: given,
}: {
  placeId: CharacterId;
  size?: number;
  mood?: PortraitMood;
  /** The player's look key (three/chars/looks playerLookKey): a new one draws again. */ look?: string;
  frame?: PortraitFrame;
  shape?: 'round' | 'card';
  fluid?: boolean;
  /** Their name, when the id is not a town resident's (somebody of the city). */
  name?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const framing: PortraitFrame = frame ?? (size >= 100 ? 'bust' : 'face');
  // a drawn picture (docs/portrait-prompts.md) wins; one that does not load falls back to the 3D portrait
  const drawn = placeId === 'player' ? null : sheetCell(placeId, mood);
  const [broken, setBroken] = useState<string | null>(null);
  const useDrawn = !!drawn && broken !== drawn.src;
  // (asked only when the 3D portrait is needed: it makes the shared offscreen renderer)
  const plain = !useDrawn && !canDraw3d();
  useLayoutEffect(() => {
    if (useDrawn) return;
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const px = Math.round(size * Math.min(3, window.devicePixelRatio || 1));
    if (c.width !== px) c.width = c.height = px;
    ctx.clearRect(0, 0, px, px);
    // the 3D faces have no sad expression: they stay as they are
    ctx.drawImage(renderPortrait(placeId, px, FACE_3D[mood]), 0, 0);
  }, [placeId, size, mood, look, useDrawn]);
  const name = given ?? (placeId === 'player' ? 'Bạn' : (townPlace(placeId)?.resident ?? ''));
  // in a circle a square picture loses its corners (a ponytail, a bun on one side): the picture moves down just as far
  // as that resident's head needs (measured by the script, most need nothing), the gap above in its own background colour
  const round = useDrawn && !!drawn?.bg && shape === 'round';
  const col = drawn ? drawn.cell % 3 : 0;
  const row = drawn ? Math.floor(drawn.cell / 3) : 0;
  return (
    <span
      className={'town-portrait' + (shape === 'card' ? ' is-card' : '') + (FACE_3D[mood] === 'happy' ? ' is-happy' : '')}
      style={{
        width: fluid ? '100%' : size,
        height: fluid ? 'auto' : size,
        aspectRatio: '1',
        backgroundColor: round && drawn ? drawn.bg : HUD_ART.portraitSky,
      }}
      aria-hidden="true"
    >
      {useDrawn && drawn ? (
        // the whole grid, moved so this mood's cell fills the frame (a new mood only moves it)
        <span
          className={'town-portrait-sheet' + (round ? ' is-round' : framing === 'face' ? ' is-face' : '')}
          style={round && drawn.lift > 0 ? { transform: `translateY(${drawn.lift * 100}%)` } : undefined}
        >
          <img
            className="town-portrait-img"
            src={drawn.src}
            alt=""
            draggable={false}
            decoding="async"
            onError={() => setBroken(drawn.src)}
            style={{ left: `${-col * 100}%`, top: `${-row * 100}%`, transformOrigin: `${((col * 2 + 1) / 6) * 100}% ${((row * 2 + 1) / 6) * 100}%` }}
          />
        </span>
      ) : plain ? (
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
