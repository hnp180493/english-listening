import { describe, expect, it } from 'vitest';
import { formatDaysVi, formatDueVi, localDayDiff, nextLocalMidnight, startOfLocalDay } from './time';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const MIN = 60_000;

describe('startOfLocalDay / nextLocalMidnight / localDayDiff', () => {
  it('returns local midnight, shifted by calendar days', () => {
    expect(startOfLocalDay(at(2026, 5, 10, 15, 30))).toBe(at(2026, 5, 10, 0));
    expect(startOfLocalDay(at(2026, 5, 10, 0, 0))).toBe(at(2026, 5, 10, 0));
    expect(startOfLocalDay(at(2026, 5, 10, 23, 59), 3)).toBe(at(2026, 5, 13, 0));
    expect(startOfLocalDay(at(2026, 5, 1, 8), -1)).toBe(at(2026, 4, 30, 0));
    expect(startOfLocalDay(at(2026, 12, 31, 8), 1)).toBe(at(2027, 1, 1, 0));
  });

  it('nextLocalMidnight is the start of tomorrow', () => {
    expect(nextLocalMidnight(at(2026, 5, 10, 23, 59))).toBe(at(2026, 5, 11, 0));
    expect(nextLocalMidnight(at(2026, 5, 10, 0, 0))).toBe(at(2026, 5, 11, 0));
  });

  it('counts calendar days, not 24 h periods', () => {
    expect(localDayDiff(at(2026, 5, 10, 23), at(2026, 5, 11, 1))).toBe(1);
    expect(localDayDiff(at(2026, 5, 11, 1), at(2026, 5, 10, 23))).toBe(-1);
    expect(localDayDiff(at(2026, 5, 10, 0), at(2026, 5, 10, 23, 59))).toBe(0);
    expect(localDayDiff(at(2026, 2, 27), at(2026, 3, 2))).toBe(3);
    expect(localDayDiff(at(2026, 12, 30), at(2027, 1, 2))).toBe(3);
  });
});

describe('formatDaysVi', () => {
  it('days up to 6, weeks up to 59 days, then months (at least 1 each)', () => {
    expect(formatDaysVi(0)).toBe('1 ngày');
    expect(formatDaysVi(1)).toBe('1 ngày');
    expect(formatDaysVi(6)).toBe('6 ngày');
    expect(formatDaysVi(7)).toBe('1 tuần');
    expect(formatDaysVi(10)).toBe('1 tuần');
    expect(formatDaysVi(11)).toBe('2 tuần');
    expect(formatDaysVi(59)).toBe('8 tuần');
    expect(formatDaysVi(60)).toBe('2 tháng');
    expect(formatDaysVi(400)).toBe('13 tháng');
  });
});

describe('formatDueVi', () => {
  const now = at(2026, 5, 10, 12, 0);

  it('"bây giờ" when already available', () => {
    expect(formatDueVi(now, now)).toBe('bây giờ');
    expect(formatDueVi(now - 5 * MIN, now)).toBe('bây giờ');
  });

  it('minutes under an hour (at least 1)', () => {
    expect(formatDueVi(now + 20_000, now)).toBe('sau 1 phút');
    expect(formatDueVi(now + 10 * MIN, now)).toBe('sau 10 phút');
    expect(formatDueVi(now + 59 * MIN, now)).toBe('sau 59 phút');
    // under an hour wins even across midnight
    expect(formatDueVi(at(2026, 5, 11, 0, 10), at(2026, 5, 10, 23, 40))).toBe('sau 30 phút');
  });

  it('a clock time later the same day (24 h, zero-padded)', () => {
    expect(formatDueVi(at(2026, 5, 10, 15, 5), now)).toBe('lúc 15:05');
    expect(formatDueVi(at(2026, 5, 10, 21, 0), at(2026, 5, 10, 7, 0))).toBe('lúc 21:00');
  });

  it('"ngày mai", then days / weeks / months', () => {
    expect(formatDueVi(at(2026, 5, 11, 0, 0), now)).toBe('ngày mai');
    expect(formatDueVi(at(2026, 5, 11, 0, 30), at(2026, 5, 10, 23, 0))).toBe('ngày mai');
    expect(formatDueVi(at(2026, 5, 13, 0), now)).toBe('sau 3 ngày');
    expect(formatDueVi(at(2026, 5, 24, 0), now)).toBe('sau 2 tuần');
    expect(formatDueVi(at(2026, 7, 9, 0), now)).toBe('sau 2 tháng');
  });
});
