// DST behaviour of the review layer, checked in a time zone that has it. Node re-reads process.env.TZ at
// runtime (same pattern as features/stats/progressModel.dst.test.ts).
import { afterAll, describe, expect, it } from 'vitest';
import { availableAt, newCard } from '../srs';
import { gradeAuto } from './schedule';
import { localDayDiff, startOfLocalDay } from './time';

const env = (
  globalThis as unknown as {
    process: { env: Record<string, string | undefined> };
  }
).process.env;
const prevTZ = env.TZ;
env.TZ = 'America/New_York';
afterAll(() => {
  if (prevTZ === undefined) delete env.TZ;
  else env.TZ = prevTZ;
});

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const hasDst = () => new Date(2026, 0, 15).getTimezoneOffset() !== new Date(2026, 6, 15).getTimezoneOffset();
const HOUR = 3_600_000;

describe('DST (America/New_York)', () => {
  it.skipIf(!hasDst())('startOfLocalDay stays at local midnight across spring-forward and fall-back', () => {
    // DST starts Sun 8 Mar 2026 02:00 (23 h day), ends Sun 1 Nov 2026 02:00 (25 h day).
    const a = startOfLocalDay(at(2026, 3, 7, 20), 1);
    const b = startOfLocalDay(at(2026, 3, 7, 20), 2);
    expect(new Date(a).getHours()).toBe(0);
    expect(new Date(b).getHours()).toBe(0);
    expect(b - a).toBe(23 * HOUR);
    const c = startOfLocalDay(at(2026, 10, 31, 23), 1);
    const d = startOfLocalDay(at(2026, 10, 31, 23), 2);
    expect(d - c).toBe(25 * HOUR);
    expect(new Date(d).getDate()).toBe(2);
  });

  it.skipIf(!hasDst())('localDayDiff counts calendar days across a DST change', () => {
    expect(localDayDiff(at(2026, 3, 7, 23, 30), at(2026, 3, 9, 0, 30))).toBe(2);
    expect(localDayDiff(at(2026, 10, 31, 0, 30), at(2026, 11, 2, 23, 30))).toBe(2);
  });

  it.skipIf(!hasDst())('graduated due dates are calendar days (no skipped or doubled day)', () => {
    const now = at(2026, 3, 7, 21);
    const graduated = {
      ...newCard('dict:s1', now),
      interval: 1,
      reps: 1,
      due: at(2026, 3, 7, 0),
      lastGrade: 'good' as const,
    };
    const next = gradeAuto(graduated, 'good', now);
    expect(next.interval).toBe(3);
    expect(next.due).toBe(at(2026, 3, 10, 0));
    expect(new Date(next.due).getHours()).toBe(0);
    expect(availableAt(next)).toBe(next.due);
    const fresh = gradeAuto(newCard('dict:s1', at(2026, 10, 31, 23, 30)), 'good', at(2026, 10, 31, 23, 30));
    expect(fresh.due).toBe(at(2026, 11, 1, 0));
  });
});
