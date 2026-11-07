import type { CSSProperties } from 'react';
import { PHENOMENON_INFO } from '../core/phenomena';
import type { Phenomenon } from '../core/types';

/** 7px phenomenon dot (decorative). Use before a label in --text, e.g. a list title or a focus banner. */
export function PhDot({ p, className }: { p: Phenomenon; className?: string }) {
  const style = { '--ph': PHENOMENON_INFO[p].color } as CSSProperties;
  return <span className={'ph-dot' + (className ? ' ' + className : '')} style={style} aria-hidden="true" />;
}

export interface PhTagProps {
  p: Phenomenon;
  /** How many more phenomena the item has: renders "+N" (still one tag per item). */
  more?: number;
  className?: string;
}

/**
 * Neutral pill with a coloured dot naming ONE item's phenomenon (drill card, decoder details, results, why-wrong).
 * Browse lists and grids use the plain label in muted text instead. The English name is only in `title`.
 */
export default function PhTag({ p, more = 0, className }: PhTagProps) {
  const info = PHENOMENON_INFO[p];
  const style = { '--ph': info.color } as CSSProperties;
  return (
    <span className={'ph-tag' + (className ? ' ' + className : '')} style={style} title={info.en}>
      <span className="ph-dot" aria-hidden="true" />
      {info.label}
      {more > 0 && <span className="ph-tag-more">+{more}</span>}
    </span>
  );
}
