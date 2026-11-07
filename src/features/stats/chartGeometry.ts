// Geometry for the "Báo cáo" charts (pure: no DOM, no React). The charts draw their SVG at the real pixel
// width of their box (viewBox width = measured width), so 1 unit = 1px and 13px labels stay 13px on a phone.

export interface ChartBox {
  width: number;
  height: number;
  left: number; // room for the y-axis labels
  right: number;
  top: number;
  bottom: number; // room for the x-axis labels
}

export const innerWidth = (b: ChartBox) => Math.max(1, b.width - b.left - b.right);
export const innerHeight = (b: ChartBox) => Math.max(1, b.height - b.top - b.bottom);

const r1 = (v: number) => Math.round(v * 10) / 10;

/** y of `v` on a [min, max] scale (min at the bottom). Out-of-range values are clamped. */
export function scaleY(v: number, min: number, max: number, box: ChartBox): number {
  const span = max - min || 1;
  const p = Math.min(1, Math.max(0, (v - min) / span));
  return r1(box.top + (1 - p) * innerHeight(box));
}

/** Centre x of point i of n, evenly spread with half a step of padding on each side (bars and points align). */
export function bandCenter(i: number, n: number, box: ChartBox): number {
  const step = innerWidth(box) / Math.max(1, n);
  return r1(box.left + step * (i + 0.5));
}

/** Bar width for n bands: 62% of the band, at most `maxWidth`, at least 2px. */
export function barWidth(n: number, box: ChartBox, maxWidth = 36): number {
  const step = innerWidth(box) / Math.max(1, n);
  return r1(Math.max(2, Math.min(maxWidth, step * 0.62)));
}

/**
 * Show every `stride`-th x label, counted back from the last one (the current week is always labelled), so no
 * two labels of `labelPx` width overlap.
 */
export function labelStride(n: number, box: ChartBox, labelPx = 44): number {
  if (n <= 1) return 1;
  const step = innerWidth(box) / n;
  return Math.max(1, Math.ceil(labelPx / Math.max(1, step)));
}

export function showLabel(i: number, n: number, stride: number): boolean {
  return (n - 1 - i) % stride === 0;
}

/** Nice minute steps for the listening axis: 15 min … 50 h. */
const MINUTE_STEPS = [15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3000];

/** Axis ticks (minutes) from 0 to a nice top ≥ max, with at most `maxTicks` steps above 0. */
export function minuteTicks(max: number, maxTicks = 3): number[] {
  const m = Number.isFinite(max) && max > 0 ? max : 1;
  const step = MINUTE_STEPS.find((s) => Math.ceil(m / s) <= maxTicks) ?? Math.ceil(m / maxTicks / 60) * 60;
  const top = Math.max(step, Math.ceil(m / step) * step);
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return out;
}

/** Short Vietnamese axis label for minutes: "30 phút", "1 giờ", "1,5 giờ". */
export function minuteTickLabel(min: number): string {
  if (min === 0) return '0';
  if (min < 60) return `${min} phút`;
  const h = Math.round((min / 60) * 10) / 10;
  return `${String(h).replace('.', ',')} giờ`;
}

export interface LinePoint {
  index: number;
  x: number;
  y: number;
  value: number;
}

/** Points for the non-null values, at their band centres. */
export function linePoints(values: readonly (number | null)[], min: number, max: number, box: ChartBox): LinePoint[] {
  const out: LinePoint[] = [];
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) return;
    out.push({ index: i, x: bandCenter(i, values.length, box), y: scaleY(v, min, max, box), value: v });
  });
  return out;
}

export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Bridges one or more empty bands: drawn dashed. */
  gap: boolean;
}

export function lineSegments(points: readonly LinePoint[]): LineSegment[] {
  const out: LineSegment[] = [];
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, gap: b.index - a.index > 1 });
  }
  return out;
}

/** Height (px) of a bar of `v` on a 0..max scale; a non-zero value is at least 2px so it stays visible. */
export function barHeight(v: number, max: number, box: ChartBox): number {
  if (!(v > 0)) return 0;
  const h = (Math.min(v, max) / (max || 1)) * innerHeight(box);
  return r1(Math.max(2, h));
}
