// The pond in the fishing panel: water, reeds, lily pads, the rod, the line and the float, and the shadow of the fish
// circling under it (its size and colour hint the tier). Game art (fish/fishArt.ts) in one small SVG; the motion is
// CSS (fish.css), off under reduced motion. Decorative: the panel says everything in words too.

import type { ReactNode } from 'react';
import type { Rarity } from '../../../../data/townGame';
import { POND_ART, TIER_ART } from './fishArt';

export type PondPhase = 'idle' | 'waiting' | 'bite' | 'listening' | 'caught' | 'escaped';

export interface PondSceneProps {
  phase: PondPhase;
  /** The tier of the fish on the line (its shadow); null = no fish yet. */
  tier: Rarity | null;
  /** The fish is speaking now. */
  speaking: boolean;
  /** Drawn over the water (the bite badge, the fish that jumped out). */
  children?: ReactNode;
}

const FLOAT_X = 180;
const FLOAT_Y = 84;
const TIP_X = 324;
const TIP_Y = 16;

export default function PondScene({ phase, tier, speaking, children }: PondSceneProps) {
  const taut = phase === 'bite' || phase === 'listening';
  const line = taut ? `M${TIP_X} ${TIP_Y} Q${(TIP_X + FLOAT_X) / 2 + 10} ${(TIP_Y + FLOAT_Y) / 2 - 6} ${FLOAT_X} ${FLOAT_Y - 12}` : `M${TIP_X} ${TIP_Y} Q${(TIP_X + FLOAT_X) / 2} ${FLOAT_Y + 6} ${FLOAT_X} ${FLOAT_Y - 12}`;
  const shadow = tier ? TIER_ART[tier] : null;
  const fill = (c: string) => ({ fill: c });
  return (
    <div className={`town-fish-pond is-${phase}` + (speaking ? ' is-speaking' : '')}>
      <svg className="town-fish-pond-svg" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="town-fish-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: POND_ART.waterTop }} />
            <stop offset="1" style={{ stopColor: POND_ART.waterDeep }} />
          </linearGradient>
        </defs>
        <rect width="360" height="150" fill="url(#town-fish-water)" />

        {/* light on the water */}
        <g className="town-fish-shimmer" style={{ stroke: POND_ART.ripple }} strokeWidth="2" strokeLinecap="round" opacity="0.35">
          <path d="M40 62 h26 M250 56 h18 M96 132 h30 M282 136 h20 M120 48 h14" />
        </g>

        {/* the far bank and its reeds */}
        <path d="M0 0 H360 V18 Q312 30 262 22 T150 25 T52 21 T0 24 Z" style={fill(POND_ART.bank)} />
        <path d="M0 24 Q52 18 96 22 T150 25 T262 22 Q312 30 360 18" fill="none" style={{ stroke: POND_ART.bankDark }} strokeWidth="3" />
        <g className="town-fish-reeds" style={fill(POND_ART.reed)}>
          <rect x="18" y="2" width="3" height="40" rx="1.5" />
          <rect x="26" y="8" width="3" height="36" rx="1.5" />
          <rect x="34" y="0" width="3" height="42" rx="1.5" />
          <ellipse cx="19.5" cy="6" rx="3.4" ry="7" style={fill(POND_ART.cattail)} />
          <ellipse cx="35.5" cy="4" rx="3.4" ry="7" style={fill(POND_ART.cattail)} />
          <path d="M42 40 q8 -18 2 -34 q2 18 -6 34 Z" />
          <rect x="346" y="6" width="3" height="34" rx="1.5" />
          <rect x="338" y="12" width="3" height="28" rx="1.5" />
          <ellipse cx="347.5" cy="10" rx="3.4" ry="7" style={fill(POND_ART.cattail)} />
        </g>

        {/* lily pads */}
        <g className="town-fish-pads">
          <path d="M70 120 m-24 0 a24 9 0 1 0 48 0 a24 9 0 1 0 -48 0 Z M70 120 l20 -6 l-4 6 Z" style={fill(POND_ART.pad)} />
          <path d="M70 120 l22 -5 l-2 5 Z" style={fill(POND_ART.waterDeep)} />
          <ellipse cx="104" cy="134" rx="13" ry="5" style={fill(POND_ART.padDark)} />
          <ellipse cx="300" cy="104" rx="17" ry="6.5" style={fill(POND_ART.pad)} />
          <path d="M300 104 l-16 -4 l3 4 Z" style={fill(POND_ART.waterTop)} />
          <circle cx="296" cy="101" r="4" style={fill(POND_ART.flower)} />
          <circle cx="296" cy="101" r="1.6" style={fill(POND_ART.glow)} />
        </g>

        {/* the fish under the water: its shadow (bigger and stronger for a rarer one) */}
        {shadow && (
          <g className="town-fish-shadow-pos" transform={`translate(${FLOAT_X} ${FLOAT_Y + 14})`}>
            <g className="town-fish-shadow">
              <g transform={`scale(${shadow.scale})`} style={fill(shadow.shadow)} opacity="0.4">
                <ellipse cx="0" cy="0" rx="22" ry="7.5" />
                <path d="M-18 0 L-32 -8 L-28 0 L-32 8 Z" />
              </g>
            </g>
          </g>
        )}

        {/* ripples around the float */}
        <g transform={`translate(${FLOAT_X} ${FLOAT_Y + 2})`} fill="none" style={{ stroke: POND_ART.ripple }} strokeWidth="1.6">
          <ellipse className="town-fish-ripple" rx="22" ry="6" />
          <ellipse className="town-fish-ripple is-late" rx="22" ry="6" />
        </g>

        {/* the rod and the line */}
        <path d={line} fill="none" style={{ stroke: POND_ART.line }} strokeWidth="1.2" />
        <path d={`M372 164 L${TIP_X} ${TIP_Y}`} style={{ stroke: POND_ART.rod }} strokeWidth="4" strokeLinecap="round" />
        <circle cx="356" cy="128" r="7" style={fill(POND_ART.line)} />

        {/* the float */}
        <g transform={`translate(${FLOAT_X} ${FLOAT_Y})`}>
          <g className="town-fish-float">
            <rect x="-1.5" y="-22" width="3" height="12" rx="1.5" style={fill(POND_ART.floatTop)} />
            <path d="M-9 -4 a9 9 0 0 1 18 0 Z" style={fill(POND_ART.floatTop)} />
            <path d="M-9 -4 a9 9 0 0 0 18 0 Z" style={fill(POND_ART.floatBottom)} />
            <rect x="-9.5" y="-5.2" width="19" height="2.4" rx="1.2" style={fill(POND_ART.floatRing)} />
          </g>
          {/* the water line in front of the float's lower half */}
          <ellipse cx="0" cy="3" rx="14" ry="3.6" style={fill(POND_ART.waterTop)} opacity="0.85" />
        </g>

        {/* a splash when it bites or jumps */}
        <g className="town-fish-splash" transform={`translate(${FLOAT_X} ${FLOAT_Y - 2})`} style={fill(POND_ART.splash)}>
          <circle className="town-fish-drop is-a" r="2.6" />
          <circle className="town-fish-drop is-b" r="2" />
          <circle className="town-fish-drop is-c" r="2.4" />
          <circle className="town-fish-drop is-d" r="1.8" />
          <circle className="town-fish-drop is-e" r="2.2" />
        </g>
      </svg>
      {children}
    </div>
  );
}
