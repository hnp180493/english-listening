// Small game pictures drawn as DOM over the stage: the xu coin, the friendship hearts, a resident's portrait and
// the "somebody is speaking" bars. Their colours are game art (engine/palette HUD_ART), passed inline.

import { portraitStyle, type CharacterId, type PortraitMood } from './art/characters';
import { HUD_ART } from './engine/palette';

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

/**
 * A person's face in a round frame: the rendered bust (art/characters.ts, Kenney Mini Characters), `happy` after a
 * right answer. `id` is a place id (its resident) or 'player'.
 */
export function Portrait({ placeId, size = 52, mood = 'neutral' }: { placeId: CharacterId; size?: number; mood?: PortraitMood }) {
  return (
    <span
      className={'town-portrait' + (mood === 'happy' ? ' is-happy' : '')}
      style={{ width: size, height: size, backgroundColor: HUD_ART.portraitSky, ...portraitStyle(placeId, mood, size) }}
      aria-hidden="true"
    />
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
