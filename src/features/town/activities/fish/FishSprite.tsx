// A fish drawn in SVG (game art: fish/fishArt.ts): the species' shape in its tier's colours, or a grey silhouette
// for one not caught yet. Decorative: the name beside it carries the meaning.

import { useId } from 'react';
import type { FishSpecies } from '../../../../data/townGame';
import { fishShape, POND_ART, TIER_ART } from './fishArt';

export interface FishSpriteProps {
  species: Pick<FishSpecies, 'name' | 'tier' | 'phenomenon'>;
  /** Drawn width in px (the height follows, 0.6 of it). */
  size?: number;
  /** A grey shape without details (a species not caught yet). */
  silhouette?: boolean;
  className?: string;
}

const W = 120;
const H = 72;

export default function FishSprite({ species, size = 96, silhouette = false, className }: FishSpriteProps) {
  const clip = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const shape = fishShape(species);
  const art = TIER_ART[species.tier];
  const body = silhouette ? POND_ART.silhouette : art.body;
  const fin = silhouette ? POND_ART.silhouetteInk : art.fin;
  const cx = 66;
  const cy = 38;
  const rx = 40;
  const ry = Math.max(12, Math.min(24, (40 / shape.stretch) * 1.1));
  const nose = cx + rx;
  const root = cx - rx + 5;
  const tailH = ry * 0.95;
  const tail = shape.forked
    ? `M${root} ${cy} L6 ${cy - tailH} Q14 ${cy} 6 ${cy + tailH} Z`
    : `M${root} ${cy} C${root - 18} ${cy - tailH * 1.2} 4 ${cy - tailH * 0.6} 6 ${cy} C4 ${cy + tailH * 0.6} ${root - 18} ${cy + tailH * 1.2} ${root} ${cy} Z`;
  const finTop = cy - ry + 2;
  const dorsal = shape.tallFin
    ? `M${cx - 18} ${finTop + 1} Q${cx - 8} ${finTop - 20} ${cx + 14} ${finTop + 2} Z`
    : `M${cx - 14} ${finTop + 1} Q${cx - 4} ${finTop - 9} ${cx + 12} ${finTop + 2} Z`;
  const eyeX = nose - 11;
  const eyeY = cy - ry * 0.28;
  const s = (fill: string) => ({ fill });

  return (
    <svg className={'town-fish-sprite' + (className ? ' ' + className : '')} width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        </clipPath>
      </defs>
      {!silhouette && species.tier === 'huyen-thoai' && <ellipse className="town-fish-glow" cx={cx - 6} cy={cy} rx={rx + 14} ry={ry + 12} style={{ fill: POND_ART.glow }} opacity="0.45" />}
      <path d={tail} style={s(fin)} />
      <path d={dorsal} style={s(fin)} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} style={s(body)} />
      {!silhouette && (
        <g clipPath={`url(#${clip})`}>
          <ellipse cx={cx + 4} cy={cy + ry * 0.62} rx={rx * 0.9} ry={ry * 0.55} style={s(art.belly)} />
          {shape.pattern === 'stripes' && [-16, -4, 8].map((dx) => <rect key={dx} x={cx + dx} y={cy - ry} width="5" height={ry * 1.4} rx="2.5" style={s(fin)} opacity="0.55" />)}
          {shape.pattern === 'spots' &&
            [
              [-18, -0.35],
              [-6, -0.5],
              [6, -0.25],
              [-12, 0.05],
              [16, -0.55],
            ].map(([dx, dy]) => <circle key={dx} cx={cx + dx} cy={cy + ry * dy} r="2.6" style={s(fin)} opacity="0.6" />)}
          {shape.pattern === 'band' && <rect x={cx - rx} y={cy - ry * 0.18} width={rx * 2} height={ry * 0.32} style={s(fin)} opacity="0.45" />}
          {shape.pattern === 'scales' &&
            [-20, -10, 0, 10].flatMap((dx) =>
              [-0.45, 0].map((dy) => <path key={`${dx}:${dy}`} d={`M${cx + dx} ${cy + ry * dy} q5 6 10 0`} fill="none" style={{ stroke: fin }} strokeWidth="1.6" opacity="0.6" />),
            )}
        </g>
      )}
      {/* pectoral fin, gill, eye, mouth */}
      <ellipse cx={cx + 6} cy={cy + ry * 0.3} rx="7" ry="3.4" transform={`rotate(24 ${cx + 6} ${cy + ry * 0.3})`} style={s(fin)} opacity={silhouette ? 1 : 0.85} />
      {!silhouette && (
        <>
          <path d={`M${nose - 20} ${cy - ry * 0.55} q-5 ${ry * 0.55} 0 ${ry * 1.05}`} fill="none" style={{ stroke: fin }} strokeWidth="1.6" opacity="0.6" />
          <circle cx={eyeX} cy={eyeY} r="4" style={s(POND_ART.floatBottom)} />
          <circle cx={eyeX + 0.8} cy={eyeY} r="2.2" style={s(POND_ART.floatRing)} />
          <path d={`M${nose - 1} ${cy + 2} q-4 2 -7 0`} fill="none" style={{ stroke: POND_ART.floatRing }} strokeWidth="1.4" strokeLinecap="round" />
          {shape.whiskers && <path d={`M${nose - 3} ${cy + 3} q6 8 12 9 M${nose - 4} ${cy + 3} q2 9 6 13`} fill="none" style={{ stroke: fin }} strokeWidth="1.3" strokeLinecap="round" />}
        </>
      )}
    </svg>
  );
}
