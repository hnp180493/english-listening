import { describe, expect, it } from 'vitest';
import {
  bandCenter,
  barHeight,
  barWidth,
  innerHeight,
  innerWidth,
  labelStride,
  linePoints,
  lineSegments,
  minuteTickLabel,
  minuteTicks,
  scaleY,
  showLabel,
  type ChartBox,
} from './chartGeometry';

const BOX: ChartBox = { width: 400, height: 200, left: 50, right: 10, top: 20, bottom: 30 };

describe('box and scales', () => {
  it('inner size', () => {
    expect(innerWidth(BOX)).toBe(340);
    expect(innerHeight(BOX)).toBe(150);
    expect(innerWidth({ ...BOX, width: 10 })).toBe(1);
  });

  it('scaleY maps min to the bottom and max to the top, clamped', () => {
    expect(scaleY(0, 0, 100, BOX)).toBe(170);
    expect(scaleY(100, 0, 100, BOX)).toBe(20);
    expect(scaleY(50, 0, 100, BOX)).toBe(95);
    expect(scaleY(150, 0, 100, BOX)).toBe(20);
    expect(scaleY(-5, 0, 100, BOX)).toBe(170);
    expect(scaleY(3, 1, 5, BOX)).toBe(95);
    // degenerate scale does not divide by zero
    expect(Number.isFinite(scaleY(1, 1, 1, BOX))).toBe(true);
  });

  it('bands are centred with half a step of padding', () => {
    expect(bandCenter(0, 4, BOX)).toBe(92.5);
    expect(bandCenter(3, 4, BOX)).toBe(347.5);
    expect(bandCenter(0, 1, BOX)).toBe(220);
  });

  it('bar width is capped and never below 2px', () => {
    expect(barWidth(4, BOX)).toBe(36);
    expect(barWidth(52, BOX)).toBeCloseTo((340 / 52) * 0.62, 1);
    expect(barWidth(1000, BOX)).toBe(2);
  });

  it('bar height: 0 for no value, at least 2px otherwise, clamped to the top', () => {
    expect(barHeight(0, 100, BOX)).toBe(0);
    expect(barHeight(-3, 100, BOX)).toBe(0);
    expect(barHeight(0.01, 100, BOX)).toBe(2);
    expect(barHeight(50, 100, BOX)).toBe(75);
    expect(barHeight(500, 100, BOX)).toBe(150);
  });
});

describe('x labels', () => {
  it('stride keeps labels apart and always labels the last band', () => {
    expect(labelStride(4, BOX)).toBe(1);
    const s = labelStride(52, BOX);
    expect(s).toBeGreaterThan(1);
    expect((innerWidth(BOX) / 52) * s).toBeGreaterThanOrEqual(44);
    expect(showLabel(51, 52, s)).toBe(true);
    expect(showLabel(50, 52, s)).toBe(false);
    expect(labelStride(1, BOX)).toBe(1);
  });

  it('at phone width 13 weeks get every other label', () => {
    const phone: ChartBox = { width: 300, height: 180, left: 52, right: 8, top: 16, bottom: 28 };
    expect(labelStride(13, phone)).toBe(3);
  });
});

describe('minute ticks', () => {
  it('picks a nice step with at most 3 steps', () => {
    expect(minuteTicks(420)).toEqual([0, 180, 360, 540]);
    expect(minuteTicks(210)).toEqual([0, 120, 240]);
    expect(minuteTicks(40)).toEqual([0, 15, 30, 45]);
    expect(minuteTicks(0)).toEqual([0, 15]);
    expect(minuteTicks(Number.NaN)).toEqual([0, 15]);
  });

  it('very large values still give ≤ 4 ticks in whole hours', () => {
    const t = minuteTicks(100_000);
    expect(t.length).toBeLessThanOrEqual(4);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(100_000);
    expect(t[1] % 60).toBe(0);
  });

  it('labels in Vietnamese', () => {
    expect(minuteTickLabel(0)).toBe('0');
    expect(minuteTickLabel(30)).toBe('30 phút');
    expect(minuteTickLabel(60)).toBe('1 giờ');
    expect(minuteTickLabel(90)).toBe('1,5 giờ');
    expect(minuteTickLabel(540)).toBe('9 giờ');
  });
});

describe('lines', () => {
  it('skips empty values and marks segments that bridge a gap', () => {
    const pts = linePoints([50, null, 70, 80], 0, 100, BOX);
    expect(pts.map((p) => p.index)).toEqual([0, 2, 3]);
    expect(pts[0].y).toBe(95);
    const segs = lineSegments(pts);
    expect(segs).toHaveLength(2);
    expect(segs[0].gap).toBe(true);
    expect(segs[1].gap).toBe(false);
  });

  it('one point gives no segment', () => {
    expect(lineSegments(linePoints([null, 3], 1, 5, BOX))).toEqual([]);
  });
});
