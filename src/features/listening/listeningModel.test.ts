import { describe, expect, it } from 'vitest';
import type { ListeningEntry } from '../../core/listening';
import {
  chipSelected,
  dayLabel,
  defaultSource,
  emptyForm,
  entryMeta,
  entryTitle,
  formFromEntry,
  listenSummary,
  minutesError,
  pillLabel,
  readForm,
  recentEntries,
  todayHead,
  weekLine,
} from './listeningModel';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 11, 6, 20); // Friday 6/11/2026

function entry(day: string, minutes: number, extra: Partial<ListeningEntry> = {}): ListeningEntry {
  return { id: `e-${day}-${minutes}`, startedAt: new Date(day + 'T10:00').getTime(), day, minutes, source: 'phim', updatedAt: 1, ...extra };
}

describe('dayLabel', () => {
  it('names today, yesterday and older days in Vietnamese', () => {
    expect(dayLabel('2026-11-06', '2026-11-06')).toBe('Hôm nay');
    expect(dayLabel('2026-11-05', '2026-11-06')).toBe('Hôm qua');
    expect(dayLabel('2026-11-03', '2026-11-06')).toBe('Thứ Ba, 03/11');
    expect(dayLabel('2026-11-01', '2026-11-06')).toBe('Chủ Nhật, 01/11');
  });
  it('crosses month and year boundaries', () => {
    expect(dayLabel('2026-12-31', '2027-01-01')).toBe('Hôm qua');
  });
});

describe('defaultSource', () => {
  it('uses the latest hand-logged source, skipping auto-logged app videos', () => {
    expect(defaultSource([])).toBe('phim');
    expect(defaultSource([entry('2026-11-06', 5, { source: 'app' }), entry('2026-11-05', 30, { source: 'podcast' })])).toBe('podcast');
    expect(defaultSource([entry('2026-11-06', 5, { source: 'app' })])).toBe('phim');
  });
});

describe('form', () => {
  it('validates the minutes field', () => {
    expect(minutesError('')).toMatch(/Nhập số phút/);
    expect(minutesError('abc')).toMatch(/con số/);
    expect(minutesError('0')).toMatch(/Ít nhất 1 phút/);
    expect(minutesError('0.2')).toMatch(/Ít nhất 1 phút/);
    expect(minutesError('601')).toMatch(/Tối đa 600 phút/);
    expect(minutesError('45')).toBeNull();
    expect(minutesError('12,6')).toBeNull();
  });

  it('turns the form into a ListeningInput', () => {
    const f = { ...emptyForm([], NOW, '45'), title: '  Friends s01e02 ', understood: 4 as const, subtitles: 'en' as const };
    const { input, errors } = readForm(f);
    expect(errors).toEqual({});
    expect(input).toMatchObject({ minutes: 45, source: 'phim', understood: 4, subtitles: 'en', day: '2026-11-06' });
  });

  it('rounds decimal minutes (comma or dot) and blocks invalid ones', () => {
    expect(readForm(emptyForm([], NOW, '12,6')).input?.minutes).toBe(13);
    expect(readForm(emptyForm([], NOW, '')).input).toBeNull();
    expect(readForm(emptyForm([], NOW, '')).errors.minutes).toBeTruthy();
  });

  it('round-trips an entry', () => {
    const e = entry('2026-11-04', 50, { title: 'TED', understood: 3, subtitles: 'none', source: 'youtube' });
    const f = formFromEntry(e);
    expect(f).toEqual({ minutes: '50', source: 'youtube', title: 'TED', understood: 3, subtitles: 'none', day: '2026-11-04' });
    expect(readForm(f).input).toMatchObject({ minutes: 50, source: 'youtube', title: 'TED', understood: 3, subtitles: 'none', day: '2026-11-04' });
  });

  it('marks a chip as selected only when the typed minutes equal it', () => {
    expect(chipSelected('30', 30)).toBe(true);
    expect(chipSelected(' 30 ', 30)).toBe(true);
    expect(chipSelected('', 30)).toBe(false);
    expect(chipSelected('35', 30)).toBe(false);
  });
});

describe('rows', () => {
  it('formats the title and the meta line', () => {
    const e = entry('2026-11-05', 80, { title: 'Friends', understood: 4, subtitles: 'en' });
    expect(entryTitle(e)).toBe('1 giờ 20 phút · Friends');
    expect(entryTitle(entry('2026-11-05', 45))).toBe('45 phút');
    expect(entryMeta(e, '2026-11-06')).toBe('Hôm qua · Phim/series · Hiểu 70–90% · Phụ đề Anh');
    expect(entryMeta(entry('2026-11-06', 10, { source: 'app' }), '2026-11-06')).toBe('Hôm nay · Video trong app');
  });

  it('keeps the last 30 days only', () => {
    const list = [entry('2026-11-06', 10), entry('2026-10-08', 10), entry('2026-10-07', 10)];
    expect(recentEntries(list, NOW).map((e) => e.day)).toEqual(['2026-11-06', '2026-10-08']);
  });
});

describe('listenSummary', () => {
  const list = [
    entry('2026-11-06', 20),
    entry('2026-11-04', 40),
    entry('2026-11-02', 30), // Monday of this week
    entry('2026-11-01', 60), // Sunday: last week
    entry('2026-10-20', 500),
  ];

  it('sums today, this week, last week and the total', () => {
    const s = listenSummary(list, NOW, 30);
    expect(s.today).toBe(20);
    expect(s.todayPct).toBe(67);
    expect(s.week).toBe(90);
    expect(s.weekDays).toBe(3);
    expect(s.lastWeek).toBe(60);
    expect(s.total).toBe(650);
    expect(s.milestone.nextHours).toBe(25);
  });

  it('has no goal percentage when the goal is off', () => {
    const s = listenSummary(list, NOW, 0);
    expect(s.goal).toBe(0);
    expect(s.todayPct).toBe(0);
  });

  it('builds the head and week lines without zeros for a new learner', () => {
    expect(todayHead({ today: 0, goal: 30 })).toBe('Mục tiêu 30 phút');
    expect(todayHead({ today: 20, goal: 30 })).toBe('20/30 phút');
    expect(todayHead({ today: 0, goal: 0 })).toBeNull();
    expect(todayHead({ today: 75, goal: 0 })).toBe('1 giờ 15 phút');
    expect(weekLine({ week: 0, weekDays: 0 })).toBeNull();
    expect(weekLine({ week: 130, weekDays: 4 })).toBe('Tuần này: 2 giờ 10 phút trong 4 ngày');
  });
});

describe('pillLabel', () => {
  it('names the timer state', () => {
    expect(pillLabel('running', '12:34')).toBe('Đang nghe 12:34');
    expect(pillLabel('paused', '1:02:03')).toBe('Đang tạm dừng 1:02:03');
    expect(pillLabel('stopped', '45:00')).toBe('Chưa lưu 45:00');
  });
});
