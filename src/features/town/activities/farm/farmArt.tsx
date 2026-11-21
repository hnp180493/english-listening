// The farm's small pictures (game art, docs/design-system.md "Thị trấn: game art"): soil beds, crops at their
// growth stages, the basket, the golden crop. Colours are art, authored for daylight and handed to the SVG inline
// through the town's night tint (engine/palette `ink`), never written in farm.css. Everything here is decorative:
// the text beside each picture carries the meaning.

import { useId, type ReactNode } from 'react';
import type { ReviewKind } from '../../../../core/review/types';
import type { PlotState } from '../../../../core/town/farm';
import { HUD_ART, mixRgb, parseHex, type TownPalette } from '../../engine/palette';
import { FARM_ART } from './farmColors';

type Ink = TownPalette['ink'];

type Shape = 'root' | 'round' | 'head' | 'tall' | 'flower' | 'big';

const CROP: Readonly<Record<ReviewKind, { shape: Shape; fruit: string }>> = {
  dict: { shape: 'root', fruit: FARM_ART.carrot },
  pair: { shape: 'tall', fruit: FARM_ART.corn },
  chunk: { shape: 'round', fruit: FARM_ART.tomato },
  lesson: { shape: 'flower', fruit: FARM_ART.sunflower },
  media: { shape: 'round', fruit: FARM_ART.strawberry },
  word: { shape: 'head', fruit: FARM_ART.cabbage },
  talk: { shape: 'big', fruit: FARM_ART.pumpkin },
};

function hex(c: readonly [number, number, number]): string {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** A wilted colour: the fresh one sunk towards dry straw. */
function dry(c: string, t = 0.55): string {
  return hex(mixRgb(parseHex(c), parseHex(FARM_ART.wilt), t));
}

const LEAF_PATH = 'M0 0C-4.2-4-4.2-10 0-14C4.2-10 4.2-4 0 0Z';
const STAR_PATH = 'M0-4.5L1.1-1.1L4.5 0L1.1 1.1L0 4.5L-1.1 1.1L-4.5 0L-1.1-1.1Z';

function Leaf({ x = 0, y = 0, a, s = 1, fill }: { x?: number; y?: number; a: number; s?: number; fill: string }) {
  return <path d={LEAF_PATH} fill={fill} transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`} />;
}

/** Wilting leaves droop outwards. */
function droop(a: number, wilt: boolean): number {
  if (!wilt) return a;
  if (a === 0) return 38;
  return a < 0 ? a - 48 : a + 48;
}

interface CropProps {
  kind: ReviewKind;
  state: PlotState;
  growth: number;
  ink: Ink;
}

/** One crop with its foot at (0, 0). */
export function Crop({ kind, state, growth, ink }: CropProps): ReactNode {
  const wilt = state === 'wilting';
  const leaf = ink(wilt ? FARM_ART.wilt : FARM_ART.leaf);
  const leafDark = ink(wilt ? FARM_ART.wiltDark : FARM_ART.leafDark);
  const stem = ink(wilt ? FARM_ART.wiltDark : FARM_ART.stem);
  if (state === 'seedling') {
    return (
      <g>
        <path d="M0 0V-6" stroke={stem} strokeWidth="1.6" strokeLinecap="round" />
        <Leaf y={-5.5} a={-58} s={0.5} fill={ink(FARM_ART.leafLight)} />
        <Leaf y={-5.5} a={58} s={0.5} fill={ink(FARM_ART.leafLight)} />
      </g>
    );
  }
  if (state === 'growing') {
    const g = Math.max(0, Math.min(1, Number.isFinite(growth) ? growth : 0));
    const s = 0.55 + 0.45 * g;
    return (
      <g transform={`scale(${s})`}>
        <path d="M0 0V-15" stroke={stem} strokeWidth="2" strokeLinecap="round" />
        <Leaf y={-5} a={-52} s={0.85} fill={leaf} />
        <Leaf y={-5} a={52} s={0.85} fill={leafDark} />
        <Leaf y={-12} a={-28} s={0.7} fill={ink(FARM_ART.leafLight)} />
        <Leaf y={-12} a={28} s={0.7} fill={leaf} />
        {g > 0.6 && <circle cx="0" cy="-16" r="2.6" fill={ink(FARM_ART.leafLight)} />}
      </g>
    );
  }
  const { shape, fruit: fresh } = CROP[kind];
  const fruit = ink(wilt ? dry(fresh) : fresh);
  const shine = ink(FARM_ART.shine);
  const shineOp = wilt ? 0 : 0.7;
  const tilt = wilt ? 'rotate(10)' : undefined;
  switch (shape) {
    case 'root':
      return (
        <g transform={tilt}>
          <Leaf y={-3} a={droop(-26, wilt)} fill={leaf} />
          <Leaf y={-3} a={droop(0, wilt)} s={1.1} fill={leafDark} />
          <Leaf y={-3} a={droop(26, wilt)} fill={leaf} />
          <path d="M-5.5-2Q0-5.5 5.5-2L2.2 6.5Q0 8.5-2.2 6.5Z" fill={fruit} />
          <path d="M-3 1.2H1.5M-2 3.8H1" stroke={ink(FARM_ART.soilDark)} strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
        </g>
      );
    case 'round':
      return (
        <g transform={tilt}>
          <Leaf a={droop(-55, wilt)} s={0.95} fill={leafDark} />
          <Leaf a={droop(-20, wilt)} s={1.05} fill={leaf} />
          <Leaf a={droop(20, wilt)} s={1.05} fill={leafDark} />
          <Leaf a={droop(55, wilt)} s={0.95} fill={leaf} />
          <circle cx="-5" cy={wilt ? -4 : -8} r="4" fill={fruit} />
          <circle cx="4.5" cy={wilt ? -3 : -11} r="4" fill={fruit} />
          <circle cx="1" cy={wilt ? -2 : -4} r="3.5" fill={fruit} />
          <circle cx="-6.2" cy={wilt ? -5.2 : -9.4} r="1.1" fill={shine} opacity={shineOp} />
          <circle cx="3.3" cy="-12.4" r="1.1" fill={shine} opacity={shineOp} />
        </g>
      );
    case 'head':
      return (
        <g transform={wilt ? 'scale(1 0.82)' : undefined}>
          <Leaf a={droop(-62, wilt)} s={0.9} fill={leafDark} />
          <Leaf a={droop(62, wilt)} s={0.9} fill={leafDark} />
          <circle cx="0" cy="-8" r="9" fill={fruit} />
          <path d="M-5-10Q0-16 5-10M-6.5-5Q0-11 6.5-5M0-17V-9" stroke={leafDark} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.65" />
          <circle cx="-3.5" cy="-12" r="1.4" fill={shine} opacity={shineOp * 0.8} />
        </g>
      );
    case 'tall':
      return (
        <g transform={wilt ? 'rotate(14)' : undefined}>
          <path d="M0 0V-26" stroke={stem} strokeWidth="2.3" strokeLinecap="round" />
          <Leaf y={-7} a={droop(-62, wilt)} s={1.05} fill={leaf} />
          <Leaf y={-12} a={droop(58, wilt)} s={1.05} fill={leafDark} />
          <Leaf y={-19} a={droop(-40, wilt)} s={0.85} fill={leaf} />
          <ellipse cx="3.4" cy="-21" rx="3.4" ry="7" fill={fruit} transform="rotate(14 3.4 -21)" />
          <path d="M1-15Q3.5-24 7-27" stroke={leafDark} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <circle cx="2.4" cy="-24" r="1" fill={shine} opacity={shineOp} />
        </g>
      );
    case 'flower':
      return (
        <g transform={wilt ? 'rotate(12)' : undefined}>
          <path d={wilt ? 'M0 0Q1-18 6-22' : 'M0 0V-24'} stroke={stem} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Leaf y={-8} a={droop(-58, wilt)} fill={leaf} />
          <Leaf y={-13} a={droop(58, wilt)} fill={leafDark} />
          <g transform={wilt ? 'translate(6 -21) rotate(60)' : 'translate(0 -27)'}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <ellipse key={a} cx="0" cy="-5.2" rx="2.2" ry="3.6" fill={fruit} transform={`rotate(${a})`} />
            ))}
            <circle r="3.6" fill={ink(FARM_ART.seed)} />
          </g>
        </g>
      );
    case 'big':
    default:
      return (
        <g transform={wilt ? 'scale(1 0.85)' : undefined}>
          <Leaf x={-6} y={-1} a={droop(-70, wilt)} fill={leafDark} />
          <Leaf x={6} y={-1} a={droop(70, wilt)} fill={leaf} />
          <ellipse cx="0" cy="-7" rx="10" ry="7.5" fill={fruit} />
          <path d="M-4-13Q-6.5-7-4-1M4-13Q6.5-7 4-1M0-14.5V0" stroke={ink(wilt ? FARM_ART.wiltDark : FARM_ART.basketDark)} strokeWidth="0.9" fill="none" opacity="0.45" />
          <path d="M0-14Q0.5-17 3-18" stroke={stem} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <ellipse cx="-5" cy="-10" rx="2" ry="1.2" fill={shine} opacity={shineOp * 0.8} />
        </g>
      );
  }
}

/** Little twinkles over a ripe crop, gold so they read on the day and the night picture (still under reduced motion). */
function Sparkles({ seed }: { seed: number }) {
  const spots = [
    [10, -24, 0.7],
    [-11, -17, 0.5],
  ] as const;
  return (
    <g>
      {spots.map(([x, y, s], i) => (
        <path
          key={i}
          className="town-farm-sparkle"
          style={{ animationDelay: `${((seed * 0.37 + i * 0.6) % 1.8).toFixed(2)}s` }}
          d={STAR_PATH}
          fill={HUD_ART.coin}
          stroke={HUD_ART.coinRim}
          strokeWidth="0.6"
          transform={`translate(${x} ${y}) scale(${s})`}
        />
      ))}
    </g>
  );
}

/** A plot's raised soil bed with its crops (one per card, at most `shown`). viewBox 0 0 160 84. */
export function PlotBed({ kind, state, growth, shown, ink, label }: { kind: ReviewKind; state: PlotState; growth: number; shown: number; ink: Ink; label: string }) {
  const n = Math.max(0, shown);
  const xs = Array.from({ length: n }, (_, i) => Math.round(((i + 1) * 160) / (n + 1)));
  const big = state === 'ripe' || state === 'wilting';
  const scale = big ? (n >= 4 ? 1.65 : 1.9) : state === 'seedling' ? 2.5 : 1.9;
  return (
    <svg className="town-farm-bed" viewBox="0 0 160 84" role="img" aria-label={label} focusable="false">
      <rect x="1" y="44" width="158" height="39" rx="16" fill={ink(FARM_ART.grass)} />
      <rect x="1" y="70" width="158" height="13" rx="6.5" fill={ink(FARM_ART.grassDark)} opacity="0.55" />
      <rect x="9" y="56" width="142" height="21" rx="9" fill={ink(FARM_ART.soilDark)} />
      <rect x="9" y="49" width="142" height="21" rx="9" fill={ink(state === 'wilting' ? FARM_ART.soilLight : FARM_ART.soil)} />
      <path d="M19 56H141M19 63H141" stroke={ink(FARM_ART.soilDark)} strokeWidth="1.6" strokeLinecap="round" opacity="0.4" />
      {xs.map((x, i) => (
        <g key={i} transform={`translate(${x} ${60 + (i % 2) * 2}) scale(${scale})`}>
          <ellipse cx="0" cy="0.6" rx="6" ry="1.6" fill={ink(FARM_ART.soilDark)} opacity="0.6" />
          <Crop kind={kind} state={state} growth={growth} ink={ink} />
          {state === 'ripe' && <Sparkles seed={i + kind.length} />}
        </g>
      ))}
    </svg>
  );
}

/** A small ring for how far a plot has grown (chrome: accent on its track, drawn by farm.css). */
export function GrowthRing({ pct }: { pct: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <svg className="town-farm-ring" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle className="town-farm-ring-track" cx="9" cy="9" r={r} />
      <circle className="town-farm-ring-fill" cx="9" cy="9" r={r} strokeDasharray={`${(c * p).toFixed(2)} ${c.toFixed(2)}`} transform="rotate(-90 9 9)" />
    </svg>
  );
}

/** The golden crop: today's review done. Emissive like a lit window: never tinted for the night. */
export function GoldenCrop({ size = 96, ink }: { size?: number; ink: Ink }) {
  const gold = HUD_ART.coin;
  const rim = HUD_ART.coinRim;
  const shine = HUD_ART.coinShine;
  const glow = 'town-farm-glow-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg className="town-farm-golden" width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={glow}>
          <stop offset="0" stopColor={gold} stopOpacity="0.85" />
          <stop offset="1" stopColor={gold} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="town-farm-glow" cx="48" cy="40" r="40" fill={`url(#${glow})`} />
      <ellipse cx="48" cy="84" rx="30" ry="8" fill={ink(FARM_ART.soil)} />
      <ellipse cx="48" cy="82" rx="22" ry="4" fill={ink(FARM_ART.soilDark)} opacity="0.5" />
      <path d="M48 82V40" stroke={rim} strokeWidth="4" strokeLinecap="round" />
      <g transform="translate(48 70)">
        <Leaf a={-60} s={1.9} fill={gold} />
        <Leaf a={60} s={1.9} fill={rim} />
      </g>
      <g transform="translate(48 56)">
        <Leaf a={-40} s={1.6} fill={rim} />
        <Leaf a={40} s={1.6} fill={gold} />
      </g>
      <g transform="translate(48 30)">
        {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((a) => (
          <ellipse key={a} cx="0" cy="-11" rx="4.6" ry="7.6" fill={gold} stroke={rim} strokeWidth="1" transform={`rotate(${a})`} />
        ))}
        <circle r="8.5" fill={rim} />
        <circle r="5.5" fill={gold} />
        <circle cx="-2" cy="-2.2" r="2" fill={shine} />
      </g>
      {[
        [20, 22, 1.4],
        [77, 18, 1.1],
        [80, 52, 0.9],
        [16, 56, 0.8],
      ].map(([x, y, s], i) => (
        <path key={i} className="town-farm-sparkle" style={{ animationDelay: `${i * 0.45}s` }} d={STAR_PATH} fill={shine} transform={`translate(${x} ${y}) scale(${s})`} />
      ))}
    </svg>
  );
}

/** A basket of crops (something is ripe / just harvested). */
export function Basket({ size = 72, ink }: { size?: number; ink: Ink }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <g transform="translate(23 40) scale(1.3)">
        <Crop kind="word" state="ripe" growth={1} ink={ink} />
      </g>
      <g transform="translate(47 40) scale(1.25) rotate(-12)">
        <Crop kind="dict" state="ripe" growth={1} ink={ink} />
      </g>
      <g transform="translate(36 42) scale(1.2)">
        <Crop kind="chunk" state="ripe" growth={1} ink={ink} />
      </g>
      <path d="M12 26Q36 2 60 26" stroke={ink(FARM_ART.basketDark)} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M8 38H64L58 64Q57 67 53 67H19Q15 67 14 64Z" fill={ink(FARM_ART.basket)} />
      <path d="M11 47H61M13 56H59M24 38L25 67M36 38V67M48 38L47 67" stroke={ink(FARM_ART.basketDark)} strokeWidth="1.6" opacity="0.6" />
      <rect x="6" y="35" width="60" height="6" rx="3" fill={ink(FARM_ART.basketDark)} />
    </svg>
  );
}

/** A sprout in a mound (waiting) or a bare raked mound (an empty field). */
export function Mound({ size = 72, ink, sprout }: { size?: number; ink: Ink; sprout: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <ellipse cx="36" cy="58" rx="30" ry="10" fill={ink(FARM_ART.grass)} />
      <path d="M10 58Q36 34 62 58Z" fill={ink(FARM_ART.soil)} />
      <path d="M20 54Q36 44 52 54" stroke={ink(FARM_ART.soilDark)} strokeWidth="1.6" fill="none" opacity="0.5" />
      {sprout && (
        <g transform="translate(36 47) scale(1.9)">
          <Crop kind="dict" state="growing" growth={0.5} ink={ink} />
        </g>
      )}
    </svg>
  );
}
