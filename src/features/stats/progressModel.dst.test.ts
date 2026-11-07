// DST behaviour, checked in a time zone that has it. Node re-reads process.env.TZ at runtime.
import { afterAll, describe, expect, it } from 'vitest';
import type { Attempt } from '../../core/stats';
import { activityHeatmap, startOfLocalWeek, weekKey, weeklyAccuracy } from './progressModel';

// The app tsconfig has no Node types: reach process.env through globalThis.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const prevTZ = env.TZ;
env.TZ = 'America/New_York';
afterAll(() => {
  if (prevTZ === undefined) delete env.TZ;
  else env.TZ = prevTZ;
});

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const hasDst = () => new Date(2026, 0, 15).getTimezoneOffset() !== new Date(2026, 6, 15).getTimezoneOffset();

function att(ts: number, correct = true): Attempt {
  return { at: ts, module: 'dictation', itemId: 's1', correct, seen: [], missed: [] };
}

describe('DST (America/New_York)', () => {
  it.skipIf(!hasDst())('keeps week starts at local midnight across spring-forward', () => {
    // DST starts Sun 8 Mar 2026 at 02:00.
    const before = startOfLocalWeek(at(2026, 3, 8, 3, 30));
    const after = startOfLocalWeek(at(2026, 3, 9, 1));
    expect(new Date(before).getHours()).toBe(0);
    expect(new Date(after).getHours()).toBe(0);
    expect(weekKey(at(2026, 3, 8, 1, 30))).toBe('2026-03-02');
    expect(weekKey(at(2026, 3, 8, 3, 30))).toBe('2026-03-02');
    expect(after - before).toBe(7 * 24 * 3600_000 - 3600_000); // a 167-hour week
  });

  it.skipIf(!hasDst())('buckets weekly accuracy correctly around fall-back', () => {
    // DST ends Sun 1 Nov 2026 at 02:00 (01:00–02:00 happens twice).
    const weeks = weeklyAccuracy([att(at(2026, 11, 1, 1, 30)), att(at(2026, 11, 1, 23, 30), false), att(at(2026, 11, 2, 0, 0))], at(2026, 11, 5));
    const last = weeks[weeks.length - 1];
    const prev = weeks[weeks.length - 2];
    expect(last).toMatchObject({ key: '2026-11-02', total: 1 });
    expect(prev).toMatchObject({ key: '2026-10-26', total: 2, pct: 50 });
    expect(new Set(weeks.map((w) => w.key)).size).toBe(8);
  });

  it.skipIf(!hasDst())('heatmap spanning a DST change has 84 distinct Monday-aligned days', () => {
    const h = activityHeatmap([att(at(2026, 11, 1, 1, 30)), att(at(2026, 3, 8, 3))], at(2026, 11, 5));
    const days = h.columns.flatMap((c) => c.cells.map((x) => x.day));
    expect(new Set(days).size).toBe(84);
    for (const c of h.columns) {
      const [y, m, d] = c.key.split('-').map(Number);
      expect(new Date(y, m - 1, d).getDay()).toBe(1);
    }
    const sun = h.columns.flatMap((c) => c.cells).find((x) => x.day === '2026-11-01');
    expect(sun).toMatchObject({ weekday: 6, count: 1 });
  });
});
