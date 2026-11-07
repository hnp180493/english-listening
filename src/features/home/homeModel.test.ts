import { describe, expect, it } from 'vitest';
import { listeningLine, type PlanItem } from '../../core/goals';
import { formatDateVi, greeting, hashString, listenRowText, parseOnboarding, pickOfTheDay, splitPlan, streakLabel } from './homeModel';

describe('greeting', () => {
  it('follows the time of day', () => {
    expect(greeting(7)).toBe('Chào buổi sáng');
    expect(greeting(12)).toBe('Chào buổi trưa');
    expect(greeting(15)).toBe('Chào buổi chiều');
    expect(greeting(20)).toBe('Chào buổi tối');
    expect(greeting(23)).toBe('Khuya rồi');
    expect(greeting(2)).toBe('Khuya rồi');
    expect(greeting(Number.NaN)).toBe('Xin chào');
  });
});

describe('formatDateVi', () => {
  it('formats weekdays in Vietnamese', () => {
    expect(formatDateVi(new Date(2026, 10, 6, 10).getTime())).toBe('Thứ Sáu, 6 tháng 11');
    expect(formatDateVi(new Date(2026, 10, 8, 10).getTime())).toBe('Chủ Nhật, 8 tháng 11');
    expect(formatDateVi(new Date(2026, 10, 9, 10).getTime())).toBe('Thứ Hai, 9 tháng 11');
  });
});

describe('pickOfTheDay', () => {
  const items = Array.from({ length: 120 }, (_, i) => i);
  it('is stable within a local day and handles empties', () => {
    const morning = new Date(2026, 10, 6, 0, 0, 1).getTime();
    const night = new Date(2026, 10, 6, 23, 59, 59).getTime();
    expect(pickOfTheDay(items, morning)).toBe(pickOfTheDay(items, night));
    expect(pickOfTheDay([], morning)).toBeNull();
  });
  it('changes across days', () => {
    const picks = new Set<number | null>();
    for (let d = 1; d <= 14; d++) picks.add(pickOfTheDay(items, new Date(2026, 10, d, 12).getTime()));
    expect(picks.size).toBeGreaterThan(7);
  });
  it('hash is deterministic', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});

describe('parseOnboarding / streakLabel', () => {
  it('sanitizes the flag', () => {
    expect(parseOnboarding(null).done).toBe(false);
    expect(parseOnboarding('yes').done).toBe(false);
    expect(parseOnboarding(true).done).toBe(true);
    expect(parseOnboarding({ done: true, at: 1 }).done).toBe(true);
  });
  it('labels streaks', () => {
    expect(streakLabel(0)).toBe('Chưa có chuỗi');
    expect(streakLabel(3)).toBe('3 ngày liên tiếp');
    expect(streakLabel(Number.NaN)).toBe('Chưa có chuỗi');
  });
});

describe('splitPlan', () => {
  const item = (id: PlanItem['id'], done: boolean, muted = false): PlanItem => ({
    id,
    title: id,
    detail: '',
    route: 'home',
    done,
    muted,
  });

  it('keeps unfinished items in order and collapses finished ones', () => {
    const { open, done } = splitPlan([
      item('review', false),
      item('lesson', true),
      item('later', false, true),
      item('focus', false),
      item('shadowing', true),
    ]);
    expect(open.map((i) => i.id)).toEqual(['review', 'later', 'focus']);
    expect(done.map((i) => i.id)).toEqual(['lesson', 'shadowing']);
  });

  it('survives junk', () => {
    expect(splitPlan(null as unknown as PlanItem[])).toEqual({ open: [], done: [] });
  });
});

describe('listenRowText', () => {
  it('states the goal instead of a zero before anything is logged', () => {
    const r = listenRowText(listeningLine({ minutes: 0, goal: 30 }));
    expect(r.title).toBe('Nghe tiếng Anh 30 phút');
    expect(r.title).not.toMatch(/0\//);
    expect(r.detail).toMatch(/ghi lại giờ nghe/);
    expect(r.action).toBe('Ghi giờ nghe');
  });
  it('shows progress once there are minutes', () => {
    const r = listenRowText(listeningLine({ minutes: 20, goal: 30 }));
    expect(r.title).toBe('Nghe tiếng Anh: 20/30 phút');
    expect(r.detail).toBe('Còn 10 phút');
    expect(listenRowText(listeningLine({ minutes: 45, goal: 30 })).detail).toBe('Đã đạt mục tiêu hôm nay');
  });
  it('puts a running stopwatch first', () => {
    const r = listenRowText(listeningLine({ minutes: 0, goal: 30, timer: { status: 'running', elapsedMs: 754_000 } }));
    expect(r.detail).toBe('Đang nghe 12:34');
    expect(r.action).toBe('Mở đồng hồ');
  });
  it('works with the goal off', () => {
    expect(listenRowText(listeningLine({ minutes: 0, goal: 0, timer: { status: 'paused', elapsedMs: 60_000 } })).title).toBe('Nghe tiếng Anh');
    expect(listenRowText(listeningLine({ minutes: 50, goal: 0 })).title).toBe('Nghe tiếng Anh: 50 phút hôm nay');
  });
});
