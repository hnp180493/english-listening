import { describe, expect, it } from 'vitest';
import type { FarmField, FarmHarvest, FarmPlot } from '../../../../core/town/farm';
import { capText, clockText, cropsShown, farmScreen, fieldSections, goldenText, nextRipeAt, plotLabel, plotPercent, plotStatus, readyText, restingText, resultLines, rewardLabel, wiltText, type FarmToday } from './farmView';

const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 10, 20 + dayOffset, h, m).getTime();
const NOW = at(9, 0);

function plot(over: Partial<FarmPlot>): FarmPlot {
  return { id: 'dict-ripe', kind: 'dict', label: 'Câu', state: 'ripe', count: 3, growth: 1, readyAt: null, cards: [], ...over };
}

function field(plots: FarmPlot[], resting = 0): FarmField {
  const sum = (s: FarmPlot['state']) => plots.filter((p) => p.state === s).reduce((n, p) => n + p.count, 0);
  return { plots, ripe: sum('ripe'), wilting: sum('wilting'), growing: sum('growing'), seedlings: sum('seedling'), resting };
}

function harvest(over: Partial<FarmHarvest> = {}): FarmHarvest {
  return { reviewed: 0, paid: 0, payable: 0, xu: 0, cleared: false, goldenPaid: false, goldenXu: 0, cap: 20, ...over };
}

const today = (over: Partial<FarmToday> = {}): FarmToday => ({ dueToday: 0, session: { size: 0, minutes: 0, split: false }, nextAt: null, tracked: 5, ...over });

describe('time texts', () => {
  it('clockText pads minutes, not hours', () => {
    expect(clockText(at(15, 30))).toBe('15:30');
    expect(clockText(at(8, 5))).toBe('8:05');
  });

  it('readyText: ripe, minutes, today, tomorrow, later', () => {
    expect(readyText(null, NOW)).toBe('chín rồi');
    expect(readyText(NOW - 1, NOW)).toBe('chín rồi');
    expect(readyText(NOW + 12 * 60_000, NOW)).toBe('chín sau 12 phút');
    expect(readyText(NOW + 59 * 60_000, NOW)).toBe('chín sau 59 phút');
    expect(readyText(NOW + 60 * 60_000, NOW)).toBe('chín lúc 10:00');
    expect(readyText(at(15, 30), NOW)).toBe('chín lúc 15:30');
    expect(readyText(at(23, 59), NOW)).toBe('chín lúc 23:59');
    expect(readyText(at(0, 0, 1), NOW)).toBe('chín ngày mai');
    expect(readyText(at(22, 0, 1), NOW)).toBe('chín ngày mai');
    expect(readyText(at(0, 0, 4), NOW)).toBe('chín ngày 24/11');
    expect(readyText(Number.NaN, NOW)).toBe('chín rồi');
  });
});

describe('plots', () => {
  it('status per state', () => {
    expect(plotStatus({ state: 'ripe', readyAt: null, count: 5 }, NOW)).toBe('5 cây chín, ôn được rồi');
    expect(plotStatus({ state: 'wilting', readyAt: null, count: 1 }, NOW)).toBe('1 cây héo, ôn là tươi lại');
    expect(plotStatus({ state: 'growing', readyAt: at(15, 30), count: 2 }, NOW)).toBe('2 cây, chín lúc 15:30');
    expect(plotStatus({ state: 'seedling', readyAt: at(1, 0, 1), count: 3 }, NOW)).toBe('3 cây mới gieo, chín ngày mai');
  });

  it('percent only while growing, never 100', () => {
    expect(plotPercent({ state: 'ripe', growth: 1 })).toBeNull();
    expect(plotPercent({ state: 'wilting', growth: 1 })).toBeNull();
    expect(plotPercent({ state: 'growing', growth: 0.634 })).toBe(63);
    expect(plotPercent({ state: 'growing', growth: 0.999 })).toBe(99);
    expect(plotPercent({ state: 'seedling', growth: -1 })).toBe(0);
    expect(plotPercent({ state: 'seedling', growth: Number.NaN })).toBe(0);
  });

  it('crops shown: one per card up to the max', () => {
    expect(cropsShown(0)).toBe(0);
    expect(cropsShown(1)).toBe(1);
    expect(cropsShown(3)).toBe(3);
    expect(cropsShown(40)).toBe(4);
    expect(cropsShown(40, 6)).toBe(6);
    expect(cropsShown(Number.NaN)).toBe(0);
  });

  it('label reads kind, count, crop, state and growth', () => {
    expect(plotLabel(plot({ kind: 'chunk', count: 2 }), NOW)).toBe('Cụm từ (cà chua): 2 cây chín, ôn được rồi');
    expect(plotLabel(plot({ kind: 'word', state: 'growing', growth: 0.5, readyAt: at(15, 30) }), NOW)).toBe('Từ vựng (bắp cải): 3 cây, chín lúc 15:30, đã lớn 50%');
  });

  it('sections: ripe and wilting first, then growing and seedlings; empty ones left out', () => {
    const plots = [plot({ id: 'dict-wilting', state: 'wilting' }), plot({ id: 'dict-ripe' }), plot({ id: 'talk-growing', kind: 'talk', state: 'growing' }), plot({ id: 'word-seedling', kind: 'word', state: 'seedling' })];
    const s = fieldSections(field(plots));
    expect(s.map((x) => x.id)).toEqual(['ripe', 'growing']);
    expect(s[0].plots.map((p) => p.id)).toEqual(['dict-wilting', 'dict-ripe']);
    expect(s[1].plots.map((p) => p.id)).toEqual(['talk-growing', 'word-seedling']);
    expect(fieldSections(field([plot({ state: 'growing' })])).map((x) => x.title)).toEqual(['Đang lớn']);
    expect(fieldSections(field([]))).toEqual([]);
  });

  it('next ripe: the earliest growing plot, else the next due time', () => {
    const f = field([plot({ state: 'growing', readyAt: at(17) }), plot({ state: 'seedling', readyAt: at(12) }), plot({ state: 'ripe' })]);
    expect(nextRipeAt(f, at(10), NOW)).toBe(at(12));
    expect(nextRipeAt(field([]), at(10, 0, 3), NOW)).toBe(at(10, 0, 3));
    expect(nextRipeAt(field([]), NOW - 5, NOW)).toBeNull();
    expect(nextRipeAt(field([]), null, NOW)).toBeNull();
  });
});

describe('farmScreen: one primary action', () => {
  const ripeField = field([plot({ count: 5 }), plot({ id: 'word-wilting', kind: 'word', state: 'wilting', count: 2 })]);

  it('claims first when today’s reviews are not paid yet', () => {
    const s = farmScreen(ripeField, harvest({ reviewed: 4, payable: 4, xu: 4 }), today({ dueToday: 3 }), NOW);
    expect(s.kind).toBe('claim');
    expect(s.primary).toEqual({ label: 'Nhận thu hoạch (+4 xu)', to: 'claim' });
    expect(s.secondary).toEqual({ label: 'Ôn tiếp (3 cây)', to: 'review' });
    expect(s.art).toBe('basket');
  });

  it('the golden crop with the claim', () => {
    const s = farmScreen(field([]), harvest({ reviewed: 6, payable: 6, xu: 6, cleared: true, goldenXu: 10 }), today(), NOW);
    expect(s.kind).toBe('claim');
    expect(s.art).toBe('golden');
    expect(s.primary.label).toBe('Nhận thu hoạch (+16 xu)');
    expect(s.headline).toContain('cây vàng');
    expect(s.secondary).toBeNull();
  });

  it('the golden crop alone (cards over the cap already paid)', () => {
    const s = farmScreen(field([]), harvest({ reviewed: 25, paid: 20, cleared: true, goldenXu: 10 }), today(), NOW);
    expect(s.primary.label).toBe('Nhận thu hoạch (+10 xu)');
    expect(s.headline).toBe('Ôn xong phần hôm nay: cây vàng chờ bạn nhận.');
  });

  it('harvest = go to Ôn tập with today’s count when one session holds it', () => {
    const s = farmScreen(ripeField, harvest(), today({ dueToday: 7, session: { size: 7, minutes: 4, split: false } }), NOW);
    expect(s.kind).toBe('harvest');
    expect(s.primary).toEqual({ label: 'Thu hoạch (7 cây)', to: 'review' });
    expect(s.detail).toBe('Thu hoạch là ôn ở Ôn tập, khoảng 4 phút.');
    expect(farmScreen(ripeField, harvest(), today({ dueToday: 1, session: { size: 1, minutes: 0, split: false } }), NOW).headline).toBe('Có 1 cây chín chờ thu hoạch.');
  });

  it('harvest: a day split into sessions names the session Ôn tập starts (its size and minutes)', () => {
    // QA 2026-11-21: the farm said "Thu hoạch (9 cây), khoảng 6 phút", Ôn tập then "Phiên này: 8 mục · khoảng 5 phút"
    const s = farmScreen(ripeField, harvest(), today({ dueToday: 9, session: { size: 8, minutes: 5, split: true } }), NOW);
    expect(s.headline).toBe('Có 9 cây chín chờ thu hoạch.');
    expect(s.primary).toEqual({ label: 'Thu hoạch (8 cây)', to: 'review' });
    expect(s.detail).toBe('Thu hoạch là ôn ở Ôn tập. Phiên này: 8 cây, khoảng 5 phút.');
  });

  it('done for today: next crop, or the ripe ones Ôn tập keeps for later days', () => {
    const growing = field([plot({ state: 'growing', readyAt: at(15, 30), growth: 0.4 })]);
    const s = farmScreen(growing, harvest({ reviewed: 8, paid: 8, cleared: true, goldenPaid: true }), today(), NOW);
    expect(s.kind).toBe('done');
    expect(s.art).toBe('golden');
    expect(s.detail).toBe('Cây tiếp theo chín lúc 15:30.');
    expect(s.primary.to).toBe('close');
    const held = farmScreen(ripeField, harvest({ reviewed: 30, paid: 20 }), today(), NOW);
    expect(held.kind).toBe('done');
    expect(held.art).toBe('sprout');
    expect(held.detail).toMatch(/^7 cây chín nữa sẽ vào phiên ôn/);
  });

  it('waiting: nothing reviewed and nothing due today', () => {
    const s = farmScreen(field([plot({ state: 'seedling', readyAt: at(2, 0, 1) })]), harvest(), today(), NOW);
    expect(s.kind).toBe('wait');
    expect(s.detail).toBe('Cây tiếp theo chín ngày mai.');
    expect(s.primary).toEqual({ label: 'Về thị trấn', to: 'close' });
    const resting = farmScreen(field([], 4), harvest(), today({ nextAt: at(8, 0, 5) }), NOW);
    expect(resting.kind).toBe('wait');
    expect(resting.detail).toBe('Cây tiếp theo chín ngày 25/11.');
  });

  it('an empty field: nothing in Ôn tập yet', () => {
    const s = farmScreen(field([]), harvest(), today({ tracked: 0 }), NOW);
    expect(s.kind).toBe('empty');
    expect(s.art).toBe('soil');
    expect(s.primary.to).toBe('close');
  });
});

describe('lines', () => {
  it('cap: no zeros before the first review, then paid / cap', () => {
    expect(capText({ reviewed: 0, paid: 0, cap: 20 })).toBe('1 xu mỗi cây ôn, tối đa 20 cây một ngày.');
    expect(capText({ reviewed: 5, paid: 0, cap: 20 })).toContain('đã ôn 5 cây');
    expect(capText({ reviewed: 9, paid: 9, cap: 20 })).toBe('Đã nhận xu cho 9/20 cây hôm nay.');
    expect(capText({ reviewed: 30, paid: 20, cap: 20 })).toContain('đủ 20 cây');
  });

  it('golden line', () => {
    expect(goldenText({ reviewed: 3, cleared: true, goldenPaid: true }, { dueToday: 0 })).toBe('Cây vàng hôm nay: đã nhận.');
    expect(goldenText({ reviewed: 3, cleared: true, goldenPaid: false }, { dueToday: 0 })).toBeNull();
    expect(goldenText({ reviewed: 0, cleared: false, goldenPaid: false }, { dueToday: 4 })).toBe('Ôn hết phần hôm nay: thêm cây vàng (+10 xu).');
    expect(goldenText({ reviewed: 0, cleared: false, goldenPaid: false }, { dueToday: 0 })).toBeNull();
  });

  it('wilting and resting lines only when there are some', () => {
    expect(wiltText(0)).toBeNull();
    expect(wiltText(1)).toMatch(/^1 cây héo vì quá hạn hơn 3 ngày\. Không sao/);
    expect(wiltText(4)).not.toMatch(/lỗi|phạt|tiếc/);
    expect(restingText(0)).toBeNull();
    expect(restingText(12)).toBe('12 cây khác đang nghỉ, chưa cần ôn tới sau ngày mai.');
  });

  it('reward label and result lines', () => {
    const tasks = [{ id: 'harvest' as const, label: 'Thu hoạch 5 cây ở nông trại', reward: 6 }];
    expect(rewardLabel({ cards: 6, golden: true, earned: 22, tasksPaid: tasks })).toBe('Thu hoạch 6 cây và cây vàng');
    expect(rewardLabel({ cards: 0, golden: true, earned: 10, tasksPaid: [] })).toBe('Cây vàng: ôn xong phần hôm nay');
    expect(rewardLabel({ cards: 3, golden: false, earned: 3, tasksPaid: [] })).toBe('Thu hoạch 3 cây');
    expect(resultLines({ cards: 6, golden: true, earned: 22, tasksPaid: tasks })).toEqual([
      '6 cây đã ôn hôm nay: +6 xu',
      'Cây vàng vì ôn hết phần hôm nay: +10 xu',
      'Nhiệm vụ xong: Thu hoạch 5 cây ở nông trại (+6 xu)',
    ]);
  });
});
