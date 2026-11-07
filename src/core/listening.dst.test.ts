// DST behaviour of the listening log's day/week maths, checked in a time zone that has DST.
import { afterAll, describe, expect, it } from 'vitest';
import { addDays, weekBuckets, weekStartDay, type ListeningEntry } from './listening';
import { localDay } from './stats';

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
const entry = (day: string, minutes: number): ListeningEntry => ({ id: day, startedAt: 0, day, minutes, source: 'phim', updatedAt: 1 });

describe('DST (America/New_York)', () => {
  it.skipIf(!hasDst())('steps calendar days across spring-forward and fall-back', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2026-11-02', -1)).toBe('2026-11-01');
    expect(weekStartDay('2026-03-08')).toBe('2026-03-02');
    expect(weekStartDay('2026-11-01')).toBe('2026-10-26');
    expect(localDay(at(2026, 11, 1, 1, 30))).toBe('2026-11-01');
  });

  it.skipIf(!hasDst())('keeps distinct Monday-aligned weeks over a year with both changes', () => {
    const weeks = weekBuckets([entry('2026-11-01', 30), entry('2026-03-08', 10), entry('2026-03-09', 5)], at(2026, 11, 5), 40);
    expect(new Set(weeks.map((w) => w.key)).size).toBe(40);
    for (const w of weeks) {
      expect(new Date(w.start).getDay()).toBe(1);
      expect(new Date(w.start).getHours()).toBe(0);
    }
    expect(weeks.find((w) => w.key === '2026-10-26')?.minutes).toBe(30);
    expect(weeks.find((w) => w.key === '2026-03-02')?.minutes).toBe(10);
    expect(weeks.find((w) => w.key === '2026-03-09')?.minutes).toBe(5);
  });
});
