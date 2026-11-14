import { describe, expect, it } from 'vitest';
import { DAILY_TASKS_XU, dailyTasks, noteConversation, noteLine, playedToday, TOWN_TASKS, townStreak } from './daily';
import { dailyCount, earnedTotal, emptyTownProgress, mergeTownProgress, parseTownProgress, type TownProgress } from './progress';
import type { LineOutcome } from './types';

const DEV = 'd-aaaa0001';
const OTHER = 'd-bbbb0002';
const at = (day: number, hour = 12, minute = 0): number => new Date(2026, 10, day, hour, minute).getTime();
const NOW = at(13);
const TODAY = '2026-11-13';

/** Answer `outcomes` one after the other; returns the progress and every task paid on the way. */
function answer(p: TownProgress, outcomes: LineOutcome[], now = NOW, device = DEV) {
  const paid: string[] = [];
  for (const o of outcomes) {
    const r = noteLine(p, o, now, device);
    p = r.progress;
    paid.push(...r.tasksPaid.map((t) => t.id));
  }
  return { progress: p, paid };
}
const tasks = (p: TownProgress, device = DEV, day = TODAY) => Object.fromEntries(dailyTasks(p, day, device).map((t) => [t.id, t]));

describe('the three daily tasks', () => {
  it('are the listed ones: goal, xu and a Vietnamese label', () => {
    expect(TOWN_TASKS.map((t) => [t.id, t.goal, t.reward])).toEqual([
      ['talk', 2, 5],
      ['lines', 8, 8],
      ['first', 4, 10],
    ]);
    expect(DAILY_TASKS_XU).toBe(23);
    for (const t of TOWN_TASKS) expect(t.label).toMatch(/^[A-ZĐ]/);
    expect(TOWN_TASKS.map((t) => t.label)).toEqual(['Trò chuyện với 2 người dân', 'Hiểu 8 câu', 'Hiểu 4 câu ngay lần nghe đầu']);
  });

  it('start at nothing, with nothing paid', () => {
    expect(dailyTasks(emptyTownProgress(), TODAY, DEV)).toEqual(TOWN_TASKS.map((t) => ({ ...t, done: 0, reached: false, paid: false })));
  });

  it('a wrong line counts for no task but makes the day active', () => {
    const r = noteLine(emptyTownProgress(), 'wrong', NOW, DEV);
    expect(r.tasksPaid).toEqual([]);
    expect(r.progress.daily).toEqual({});
    expect(r.progress.days).toEqual([TODAY]);
    expect(tasks(r.progress).lines.done).toBe(0);
  });

  it('"Hiểu 4 câu ngay lần nghe đầu" pays 10 xu at the fourth first-listen line, once', () => {
    const three = answer(emptyTownProgress(), ['first', 'replayed', 'first', 'wrong', 'first']);
    expect(three.paid).toEqual([]);
    expect(tasks(three.progress).first).toMatchObject({ done: 3, reached: false, paid: false });
    expect(tasks(three.progress).lines).toMatchObject({ done: 4, reached: false });

    const fourth = noteLine(three.progress, 'first', NOW, DEV);
    expect(fourth.tasksPaid).toEqual([{ id: 'first', label: 'Hiểu 4 câu ngay lần nghe đầu', reward: 10 }]);
    expect(earnedTotal(fourth.progress)).toBe(10);
    expect(fourth.progress.earned).toEqual({ [DEV]: 10 });
    expect(tasks(fourth.progress).first).toMatchObject({ done: 4, reached: true, paid: true });

    // more first-listen lines today: counted, never paid again; `done` stays at the goal
    const more = answer(fourth.progress, ['first', 'first']);
    expect(more.paid).toEqual([]);
    expect(earnedTotal(more.progress)).toBe(10);
    expect(tasks(more.progress).first.done).toBe(4);
    expect(dailyCount(more.progress, TODAY, DEV).first).toBe(6);
  });

  it('"Hiểu 8 câu" counts every right answer, replayed ones too, and pays 8 xu at the eighth', () => {
    const seven = answer(emptyTownProgress(), ['replayed', 'replayed', 'replayed', 'replayed', 'replayed', 'replayed', 'replayed']);
    expect(seven.paid).toEqual([]);
    const eighth = answer(seven.progress, ['wrong', 'replayed']);
    expect(eighth.paid).toEqual(['lines']);
    expect(earnedTotal(eighth.progress)).toBe(8);
    expect(tasks(eighth.progress).first).toMatchObject({ done: 0, paid: false });
  });

  it('one line can reach two tasks at once: both are paid, in the listed order', () => {
    // 4 replayed + 3 first, then the 8th right line is also the 4th first-listen one
    const before = answer(emptyTownProgress(), ['replayed', 'replayed', 'replayed', 'replayed', 'first', 'first', 'first']);
    const r = noteLine(before.progress, 'first', NOW, DEV);
    expect(r.tasksPaid.map((t) => t.id)).toEqual(['lines', 'first']);
    expect(earnedTotal(r.progress)).toBe(18);
  });

  it('"Trò chuyện với 2 người dân" needs two DIFFERENT residents and pays 5 xu once', () => {
    const one = noteConversation(emptyTownProgress(), 'cafe', NOW, DEV);
    expect(one.tasksPaid).toEqual([]);
    expect(tasks(one.progress).talk).toMatchObject({ done: 1, reached: false });
    const same = noteConversation(one.progress, 'cafe', NOW + 1, DEV);
    expect(same.tasksPaid).toEqual([]);
    expect(dailyCount(same.progress, TODAY, DEV)).toMatchObject({ talks: 2, met: ['cafe'] });
    expect(tasks(same.progress).talk).toMatchObject({ done: 1, reached: false, paid: false });
    const two = noteConversation(same.progress, 'square', NOW + 2, DEV);
    expect(two.tasksPaid).toEqual([{ id: 'talk', label: 'Trò chuyện với 2 người dân', reward: 5 }]);
    expect(earnedTotal(two.progress)).toBe(5);
    const three = noteConversation(two.progress, 'friend', NOW + 3, DEV);
    expect(three.tasksPaid).toEqual([]);
    expect(earnedTotal(three.progress)).toBe(5);
    expect(tasks(three.progress).talk).toMatchObject({ done: 2, reached: true, paid: true });
  });

  it('a new local day starts the tasks again; yesterday stays paid', () => {
    const day1 = answer(emptyTownProgress(), ['first', 'first', 'first', 'first'], at(13, 23, 59));
    expect(day1.paid).toEqual(['first']);
    const day2 = answer(day1.progress, ['first', 'first', 'first'], at(14, 0, 1));
    expect(day2.paid).toEqual([]);
    expect(tasks(day2.progress, DEV, '2026-11-14').first).toMatchObject({ done: 3, paid: false });
    expect(tasks(day2.progress, DEV, '2026-11-13').first).toMatchObject({ done: 4, paid: true });
    const paidAgain = noteLine(day2.progress, 'first', at(14, 0, 2), DEV);
    expect(paidAgain.tasksPaid.map((t) => t.id)).toEqual(['first']);
    expect(earnedTotal(paidAgain.progress)).toBe(20);
  });

  it('tasks are per browser: another machine has its own counters and its own xu bucket', () => {
    const a = answer(emptyTownProgress(), ['first', 'first', 'first', 'first']);
    expect(tasks(a.progress, OTHER).first).toMatchObject({ done: 0, paid: false });
    const b = answer(a.progress, ['first', 'first', 'first', 'first'], NOW, OTHER);
    expect(b.paid).toEqual(['first']);
    expect(b.progress.earned).toEqual({ [DEV]: 10, [OTHER]: 10 });
  });

  it('survives a save and a reload, and a sync merge never pays a task twice', () => {
    const reached = answer(emptyTownProgress(), ['first', 'first', 'first', 'first']);
    const reloaded = parseTownProgress(JSON.parse(JSON.stringify(reached.progress)));
    expect(reloaded).toEqual(reached.progress);
    // an older copy of this browser's day comes back from the folder: merged, the task is still paid
    const older = answer(emptyTownProgress(), ['first', 'first']).progress;
    const merged = mergeTownProgress(older, reloaded);
    expect(tasks(merged).first).toMatchObject({ done: 4, paid: true });
    expect(noteLine(merged, 'first', NOW, DEV).tasksPaid).toEqual([]);
    expect(earnedTotal(merged)).toBe(10);
  });

  it('a bad device pays nothing', () => {
    const r = answer(emptyTownProgress(), ['first', 'first', 'first', 'first', 'first'], NOW, 'constructor');
    expect(r.paid).toEqual([]);
    expect(r.progress).toEqual(emptyTownProgress());
  });
});

describe('townStreak', () => {
  const days = (...list: number[]) => ({ days: list.map((d) => `2026-11-${String(d).padStart(2, '0')}`) });

  it('counts consecutive local days ending today', () => {
    expect(townStreak(days(), NOW)).toBe(0);
    expect(townStreak(days(13), NOW)).toBe(1);
    expect(townStreak(days(11, 12, 13), NOW)).toBe(3);
    expect(townStreak(days(9, 11, 12, 13), NOW)).toBe(3);
  });

  it('nothing answered yet today: the streak still stands on yesterday, and falls a day later', () => {
    expect(townStreak(days(11, 12), NOW)).toBe(2);
    expect(playedToday(days(11, 12), NOW)).toBe(false);
    expect(playedToday(days(11, 13), NOW)).toBe(true);
    expect(townStreak(days(10, 11), NOW)).toBe(0);
  });

  it('crosses a month and a daylight-saving change', () => {
    const p = { days: ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'] };
    expect(townStreak(p, new Date(2026, 10, 2, 9).getTime())).toBe(4);
    expect(townStreak(p, new Date(2026, 10, 3, 0, 30).getTime())).toBe(4);
    expect(townStreak(p, new Date(2026, 10, 4, 0, 30).getTime())).toBe(0);
  });

  it('grows with the lines answered, one day at a time, whatever the outcome', () => {
    let p = emptyTownProgress();
    for (const d of [10, 11, 12, 13]) p = noteLine(p, d === 12 ? 'wrong' : 'first', at(d), DEV).progress;
    expect(p.days).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    expect(townStreak(p, NOW)).toBe(4);
    // a day played on another machine joins the streak after a merge
    const phone = noteLine(emptyTownProgress(), 'first', at(9), OTHER).progress;
    expect(townStreak(mergeTownProgress(p, phone), NOW)).toBe(5);
  });
});
