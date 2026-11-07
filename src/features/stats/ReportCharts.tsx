// Small inline-SVG charts of the "Báo cáo" view. Each one is drawn at the real pixel width of its box (so the
// 13px labels stay 13px at 375px), has role="img" with the report's text summary as its name, and uses tokens
// only (light/dark through CSS). Geometry: ./chartGeometry.ts.

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  bandCenter,
  barHeight,
  barWidth,
  labelStride,
  linePoints,
  lineSegments,
  minuteTickLabel,
  minuteTicks,
  scaleY,
  showLabel,
  type ChartBox,
} from './chartGeometry';

/** Width of the element, updated on resize (falls back to `fallback` before the first measure). */
function useWidth<T extends HTMLElement>(fallback = 560): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setW((cur) => (cur === next ? cur : next));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Frame({ label, height, children }: { label: string; height: number; children: (width: number) => ReactNode }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  return (
    <div ref={ref} className="rep-chart">
      <svg className="rep-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {children(width)}
      </svg>
    </div>
  );
}

/** Approximate width (px) of a 13px axis label. */
const labelWidth = (text: string) => text.length * 7.4;

/**
 * x position and anchor of an axis label centred at `cx`, kept inside the drawing (the last label, "Nay", used
 * to be clipped at the right edge on a phone).
 */
function labelAnchor(text: string, cx: number, width: number, left: number): { x: number; anchor: 'start' | 'middle' | 'end' } {
  const half = labelWidth(text) / 2;
  if (cx + half > width - 2) return { x: width - 2, anchor: 'end' };
  if (cx - half < left - 4) return { x: Math.max(2, left - 4), anchor: 'start' };
  return { x: cx, anchor: 'middle' };
}

export interface BarDatum {
  key: string;
  label: string; // x label ("dd/mm" / "Nay")
  value: number; // minutes
  title: string; // hover text
  current?: boolean;
}

/** Weekly listening minutes as bars, with an optional dashed goal line (its legend sits under the chart). */
export function MinutesBarChart({
  data,
  max,
  goal,
  goalCurrent = 0,
  label,
}: {
  data: readonly BarDatum[];
  max: number;
  goal: number;
  /** The goal pro-rated to the days elapsed in the current bucket: a short marker over the current bar only. */
  goalCurrent?: number;
  label: string;
}) {
  const height = 200;
  return (
    <Frame label={label} height={height}>
      {(width) => {
        const box: ChartBox = { width, height, left: 56, right: 8, top: 18, bottom: 28 };
        const ticks = minuteTicks(Math.max(max, goal));
        const top = ticks[ticks.length - 1];
        const bw = barWidth(data.length, box);
        const stride = labelStride(data.length, box);
        const base = scaleY(0, 0, top, box);
        const showValues = data.length <= 8 && width >= 320;
        return (
          <>
            {ticks.map((t) => (
              <g key={t}>
                <line className="rep-gridline" x1={box.left} x2={width - box.right} y1={scaleY(t, 0, top, box)} y2={scaleY(t, 0, top, box)} />
                <text className="rep-axis" x={box.left - 8} y={scaleY(t, 0, top, box) + 4.5} textAnchor="end">
                  {minuteTickLabel(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const h = barHeight(d.value, top, box);
              const cx = bandCenter(i, data.length, box);
              return (
                <g key={d.key}>
                  {h > 0 && (
                    <rect className={'rep-bar' + (d.current ? ' is-current' : '')} x={cx - bw / 2} y={base - h} width={bw} height={h} rx={Math.min(4, bw / 2)}>
                      <title>{d.title}</title>
                    </rect>
                  )}
                  {showValues && d.value > 0 && (
                    <text className="rep-value" x={cx} y={base - h - 6} textAnchor="middle">
                      {minuteTickLabel(d.value)}
                    </text>
                  )}
                  {showLabel(i, data.length, stride) &&
                    (() => {
                      const a = labelAnchor(d.label, cx, width, box.left);
                      return (
                        <text className={'rep-axis' + (d.current ? ' is-current' : '')} x={a.x} y={height - 8} textAnchor={a.anchor}>
                          {d.label}
                        </text>
                      );
                    })()}
                  {d.current && goalCurrent > 0 && goalCurrent < goal && (
                    <line
                      className="rep-goal is-partial"
                      x1={cx - bw / 2 - 4}
                      x2={cx + bw / 2 + 4}
                      y1={scaleY(goalCurrent, 0, top, box)}
                      y2={scaleY(goalCurrent, 0, top, box)}
                    >
                      <title>Mục tiêu tính đến hôm nay</title>
                    </line>
                  )}
                </g>
              );
            })}
            {goal > 0 && (
              <line className="rep-goal" x1={box.left} x2={width - box.right} y1={scaleY(goal, 0, top, box)} y2={scaleY(goal, 0, top, box)} />
            )}
          </>
        );
      }}
    </Frame>
  );
}

export interface LineTick {
  value: number;
  label: string;
}

/** A line of dots over evenly spaced bands (weeks or tests); null values leave a gap (dashed bridge). */
export function DotLineChart({
  values,
  xLabels,
  currentIndex,
  min,
  max,
  ticks,
  format,
  label,
  left = 48,
  height = 190,
  weak,
  titles,
  pointLabels: showValueLabels = true,
  labelEnds = false,
}: {
  values: readonly (number | null)[];
  xLabels: readonly string[];
  currentIndex?: number;
  min: number;
  max: number;
  ticks: readonly LineTick[];
  format: (v: number) => string;
  label: string;
  left?: number;
  height?: number;
  /** Points with too little data behind them: drawn small, grey and dashed ("ít dữ liệu"). */
  weak?: readonly boolean[];
  /** Hover text per point (defaults to "label: value"). */
  titles?: readonly string[];
  /** Print the value above each point (when there is room). */
  pointLabels?: boolean;
  /** Always label the first and the last point (dated series such as checkups). */
  labelEnds?: boolean;
}) {
  return (
    <Frame label={label} height={height}>
      {(width) => {
        const box: ChartBox = { width, height, left, right: 12, top: 26, bottom: 28 };
        const pts = linePoints(values, min, max, box);
        const segs = lineSegments(pts);
        const n = values.length;
        const stride = labelStride(n, box);
        const showValues = showValueLabels && pts.length <= 14 && width / Math.max(1, n) >= 26;
        const shown = (i: number) => (labelEnds ? i === 0 || i === n - 1 || ((n - 1 - i) % stride === 0 && i >= stride) : showLabel(i, n, stride));
        return (
          <>
            {ticks.map((t) => (
              <g key={t.value}>
                <line className="rep-gridline" x1={box.left} x2={width - box.right} y1={scaleY(t.value, min, max, box)} y2={scaleY(t.value, min, max, box)} />
                <text className="rep-axis" x={box.left - 8} y={scaleY(t.value, min, max, box) + 4.5} textAnchor="end">
                  {t.label}
                </text>
              </g>
            ))}
            {xLabels.map((l, i) => {
              if (!shown(i)) return null;
              const a = labelAnchor(l, bandCenter(i, n, box), width, box.left);
              return (
                <text key={i} className={'rep-axis' + (i === currentIndex ? ' is-current' : '')} x={a.x} y={height - 8} textAnchor={a.anchor}>
                  {l}
                </text>
              );
            })}
            {segs.map((s, k) => (
              <line key={k} className={'rep-line' + (s.gap ? ' is-gap' : '')} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
            ))}
            {pts.map((p) => (
              <g key={p.index}>
                <circle
                  className={'rep-dot' + (p.index === currentIndex ? ' is-current' : '') + (weak?.[p.index] ? ' is-weak' : '')}
                  cx={p.x}
                  cy={p.y}
                  r={weak?.[p.index] ? 3.5 : 4.5}
                >
                  <title>{titles?.[p.index] ?? `${xLabels[p.index]}: ${format(p.value)}${weak?.[p.index] ? ' (ít dữ liệu)' : ''}`}</title>
                </circle>
                {showValues && !weak?.[p.index] && (
                  <text className="rep-value" x={p.x} y={p.y - 11} textAnchor="middle">
                    {format(p.value)}
                  </text>
                )}
              </g>
            ))}
          </>
        );
      }}
    </Frame>
  );
}

/** A tiny decorative weekly line (per-module accuracy); the row next to it carries the numbers. */
export function Sparkline({ values }: { values: readonly (number | null)[] }) {
  const box: ChartBox = { width: 96, height: 28, left: 2, right: 2, top: 4, bottom: 4 };
  const pts = linePoints(values, 0, 100, box);
  if (pts.length === 0) return null;
  const segs = lineSegments(pts);
  return (
    <svg className="rep-spark" width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`} aria-hidden="true" focusable="false">
      {segs.map((s, k) => (
        <line key={k} className={'rep-line' + (s.gap ? ' is-gap' : '')} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
      ))}
      {pts.length === 1 && <circle className="rep-dot is-current" cx={pts[0].x} cy={pts[0].y} r={2.5} />}
    </svg>
  );
}
