import { describe, expect, it } from 'vitest';
import { TOWN_STORIES } from '../../data/townStories';
import {
  bestStreak,
  DAILY_TASKS_XU,
  dailyTaskIds,
  dailyTasks,
  dayTaskIds,
  eligibleTasks,
  fixDayTasks,
  fixedDayTasks,
  noteConversation,
  noteEpisode,
  noteGame,
  noteLine,
  playedToday,
  streakMilestones,
  TASKS_PER_DAY,
  TOWN_TASKS,
  townStreak,
  type TownTaskId,
} from './daily';
import { addFarmDay, dailyCount, daysBefore, earnedTotal, emptyDailyCount, emptyTownProgress, mergeTownProgress, parseTownProgress, updateDaily, updateEpisode, type TownProgress } from './progress';
import type { LineOutcome } from './types';

const DEV = 'd-aaaa0001';
const OTHER = 'd-bbbb0002';
const at = (day: number, hour = 12, minute = 0): number => new Date(2026, 10, day, hour, minute).getTime();
// 2026-11-17 draws the three conversation tasks (talk, lines, first): the rules of each one are tested on it
const NOW = at(17);
const TODAY = '2026-11-17';

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

describe('the pool and the draw of a day', () => {
  it('the pool: goal, xu and a Vietnamese label; a day pays at most DAILY_TASKS_XU', () => {
    expect(TOWN_TASKS.map((t) => [t.id, t.goal, t.reward])).toEqual([
      ['talk', 2, 5],
      ['lines', 8, 8],
      ['first', 4, 10],
      ['fish', 5, 6],
      ['fish-first', 3, 8],
      ['harvest', 5, 6],
      ['episode', 1, 8],
    ]);
    expect(DAILY_TASKS_XU).toBe(26);
    for (const t of TOWN_TASKS) expect(t.label).toMatch(/^[A-ZĐ]/);
  });

  it('three tasks a day, one of them always "lines" or "first", the same for every call on that day', () => {
    const all = new Set<TownTaskId>(TOWN_TASKS.map((t) => t.id));
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const day = daysBefore('2026-11-01', -i);
      const ids = dailyTaskIds(day, all);
      expect(ids).toHaveLength(TASKS_PER_DAY);
      expect(new Set(ids).size).toBe(TASKS_PER_DAY);
      expect(ids.some((id) => id === 'lines' || id === 'first')).toBe(true);
      expect(dailyTaskIds(day, all)).toEqual(ids);
      for (const id of ids) seen.add(id);
      // the xu of a day stay sane
      const xu = TOWN_TASKS.filter((t) => ids.includes(t.id)).reduce((s, t) => s + t.reward, 0);
      expect(xu).toBeGreaterThanOrEqual(17);
      expect(xu).toBeLessThanOrEqual(DAILY_TASKS_XU);
    }
    // every task of the pool comes up over four months
    expect([...seen].sort()).toEqual([...all].sort());
    expect(dailyTaskIds(TODAY, all)).not.toEqual(dailyTaskIds('2026-11-14', all));
  });

  it('a task enters the draw only when it can be done: the farm after a harvest on an earlier day, an episode while one is left', () => {
    const fresh = eligibleTasks(emptyTownProgress(), TODAY);
    expect([...fresh].sort()).toEqual(['episode', 'first', 'fish', 'fish-first', 'lines', 'talk']);
    // a harvest today does not change today's draw; one yesterday does
    expect(eligibleTasks(addFarmDay(emptyTownProgress(), TODAY), TODAY).has('harvest')).toBe(false);
    expect(eligibleTasks(addFarmDay(emptyTownProgress(), '2026-11-16'), TODAY).has('harvest')).toBe(true);
    const harvested = noteGame(emptyTownProgress(), { harvest: 2 }, at(15), DEV).progress;
    expect(eligibleTasks(harvested, TODAY).has('harvest')).toBe(true);
    // every episode heard through: nothing left to hear
    let all = emptyTownProgress();
    for (const e of TOWN_STORIES) all = updateEpisode(all, e.id, (x) => ({ ...x, stage: 1, at: at(12), okAt: at(12) }));
    expect(eligibleTasks(all, TODAY).has('episode')).toBe(false);
    for (let i = 0; i < 60; i++) expect(dailyTaskIds(daysBefore(TODAY, -i), eligibleTasks(all, TODAY))).not.toContain('episode');
    // left: a lodger's episode 1 (heard from the first day) counts; only an episode told at an unbuilt home does not
    const left = (keep: (e: (typeof TOWN_STORIES)[number]) => boolean) => {
      let p = emptyTownProgress();
      for (const e of TOWN_STORIES) if (!keep(e)) p = updateEpisode(p, e.id, (x) => ({ ...x, stage: 1, at: at(12), okAt: at(12) }));
      return p;
    };
    expect(eligibleTasks(left((e) => e.id === 'home-1'), TODAY).has('episode')).toBe(true);
    expect(eligibleTasks(left((e) => e.id === 'home-2'), TODAY).has('episode')).toBe(false);
    expect(eligibleTasks({ ...left((e) => e.id === 'home-2'), bought: ['home'] }, TODAY).has('episode')).toBe(true);
  });

  it('start at nothing, with nothing paid', () => {
    expect(dailyTasks(emptyTownProgress(), TODAY, DEV)).toEqual(
      TOWN_TASKS.filter((t) => ['talk', 'lines', 'first'].includes(t.id)).map((t) => ({ ...t, done: 0, reached: false, paid: false })),
    );
  });

  it('the game loops count for their tasks, without keeping the town streak', () => {
    // 2026-11-14 draws first, fish, fish-first
    const day = '2026-11-14';
    expect(dailyTasks(emptyTownProgress(), day, DEV).map((t) => t.id)).toEqual(['first', 'fish', 'fish-first']);
    let p = emptyTownProgress();
    const paid: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = noteGame(p, { fish: 1, fishFirst: i < 3 ? 1 : 0, fishXu: 1 }, at(14), DEV);
      p = r.progress;
      paid.push(...r.tasksPaid.map((t) => t.id));
    }
    expect(paid).toEqual(['fish-first', 'fish']);
    expect(earnedTotal(p)).toBe(8 + 6);
    expect(dailyCount(p, day, DEV)).toMatchObject({ fish: 5, fishFirst: 3, fishXu: 5 });
    expect(p.days).toEqual([]);
    // an episode heard through counts as a conversation and for the episode task (2026-11-13 draws it)
    const ep = noteEpisode(emptyTownProgress(), 'cafe', at(13), DEV);
    expect(dailyCount(ep.progress, '2026-11-13', DEV)).toMatchObject({ talks: 1, met: ['cafe'], eps: 1 });
    expect(ep.tasksPaid.map((t) => t.id)).toEqual(['episode']);
    // a perfect quick chat is counted (the egg of the day, core/town/eggs)
    expect(dailyCount(noteConversation(emptyTownProgress(), 'cafe', NOW, DEV, true).progress, TODAY, DEV).perfect).toBe(1);
  });

  it('a task paid today stays in the list even when the draw would no longer pick it', () => {
    // the last episode heard through today: 'episode' leaves the draw, but it was paid today and stays
    let p = emptyTownProgress();
    const last = TOWN_STORIES.filter((e) => e.placeId === 'cafe').at(-1)!;
    for (const e of TOWN_STORIES) if (e !== last) p = updateEpisode(p, e.id, (x) => ({ ...x, stage: 1, at: at(12), okAt: at(12) }));
    expect(dailyTasks(p, '2026-11-13', DEV).map((t) => t.id)).toContain('episode');
    const r = noteEpisode(updateEpisode(p, last.id, (x) => ({ ...x, stage: 1, at: at(13), okAt: at(13) })), last.placeId, at(13), DEV);
    // the last one, heard through today, still counts today and is paid
    expect(r.tasksPaid.map((t) => t.id)).toEqual(['episode']);
    expect(dailyTasks(r.progress, '2026-11-13', DEV).find((t) => t.id === 'episode')).toMatchObject({ paid: true, reached: true });
    // the next day nothing is left: the draw drops it
    expect(eligibleTasks(r.progress, '2026-11-14').has('episode')).toBe(false);
    // a paid task stays in the list whatever the draw says (a place built later the same day can change the draw)
    const odd = { ...r.progress, daily: { '2026-11-14': { [DEV]: { talks: 0, lines: 0, first: 0, met: [], paid: ['episode'], eps: 1 } } } };
    expect(dailyTasks(odd, '2026-11-14', DEV).find((t) => t.id === 'episode')).toMatchObject({ paid: true });
  });
});

describe('the tasks of a day that draws the conversation tasks', () => {
  it('a wrong line counts for no task but makes the day active', () => {
    const r = noteLine(emptyTownProgress(), 'wrong', NOW, DEV);
    expect(r.tasksPaid).toEqual([]);
    // nothing counted: the row holds only the day's three tasks, fixed by this first write of the day
    expect(r.progress.daily).toEqual({ [TODAY]: { [DEV]: { ...emptyDailyCount(), tasks: ['first', 'lines', 'talk'] } } });
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
    const day1 = answer(emptyTownProgress(), ['first', 'first', 'first', 'first'], at(17, 23, 59));
    expect(day1.paid).toEqual(['first']);
    // 2026-11-18 draws "first" too
    const day2 = answer(day1.progress, ['first', 'first', 'first'], at(18, 0, 1));
    expect(day2.paid).toEqual([]);
    expect(tasks(day2.progress, DEV, '2026-11-18').first).toMatchObject({ done: 3, paid: false });
    expect(tasks(day2.progress, DEV, '2026-11-17').first).toMatchObject({ done: 4, paid: true });
    const paidAgain = noteLine(day2.progress, 'first', at(18, 0, 2), DEV);
    expect(paidAgain.tasksPaid.map((t) => t.id)).toEqual(['first']);
    expect(earnedTotal(paidAgain.progress)).toBe(20);
  });

  it('a task not drawn today counts but pays nothing', () => {
    // 2026-11-13 draws talk, lines, episode: four first-listen lines pay nothing
    const r = answer(emptyTownProgress(), ['first', 'first', 'first', 'first'], at(13));
    expect(r.paid).toEqual([]);
    expect(dailyCount(r.progress, '2026-11-13', DEV).first).toBe(4);
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
  const STREAK_NOW = at(13);
  const days = (...list: number[]) => ({ days: list.map((d) => `2026-11-${String(d).padStart(2, '0')}`) });

  it('counts consecutive local days ending today', () => {
    expect(townStreak(days(), STREAK_NOW)).toBe(0);
    expect(townStreak(days(13), STREAK_NOW)).toBe(1);
    expect(townStreak(days(11, 12, 13), STREAK_NOW)).toBe(3);
    expect(townStreak(days(9, 11, 12, 13), STREAK_NOW)).toBe(3);
  });

  it('nothing answered yet today: the streak still stands on yesterday, and falls a day later', () => {
    expect(townStreak(days(11, 12), STREAK_NOW)).toBe(2);
    expect(playedToday(days(11, 12), STREAK_NOW)).toBe(false);
    expect(playedToday(days(11, 13), STREAK_NOW)).toBe(true);
    expect(townStreak(days(10, 11), STREAK_NOW)).toBe(0);
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
    expect(townStreak(p, STREAK_NOW)).toBe(4);
    // a day played on another machine joins the streak after a merge
    const phone = noteLine(emptyTownProgress(), 'first', at(9), OTHER).progress;
    expect(townStreak(mergeTownProgress(p, phone), STREAK_NOW)).toBe(5);
  });

  it('bestStreak: the longest run kept; streakMilestones: the days a run reached 7, 14 …', () => {
    expect(bestStreak(days())).toBe(0);
    expect(bestStreak(days(1, 2, 3, 5, 6))).toBe(3);
    const run = Array.from({ length: 15 }, (_, i) => i + 1);
    expect(bestStreak(days(...run))).toBe(15);
    expect(streakMilestones(days(...run).days, 7)).toEqual(['2026-11-07', '2026-11-14']);
    // a break starts the count again
    expect(streakMilestones(days(1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14).days, 7)).toEqual(['2026-11-14']);
  });
});

describe("the day's three tasks are fixed by its first write", () => {
  const noon = (day: string): number => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d, 12).getTime();
  };
  const base = emptyTownProgress();
  const withHarvest = new Set([...eligibleTasks(base, '2026-12-01'), 'harvest' as TownTaskId]);
  // a day whose draw changes once the farm becomes eligible (a farm day synced from another machine)
  const DAY = Array.from({ length: 120 }, (_, i) => daysBefore('2026-12-01', -i)).find(
    (d) => dailyTaskIds(d, eligibleTasks(base, d)).join() !== dailyTaskIds(d, withHarvest).join(),
  )!;
  const T = noon(DAY);

  it('a sync that makes another task eligible later that day redraws nothing: still three, the same three', () => {
    expect(DAY).toBeDefined();
    const first = noteLine(base, 'first', T, DEV).progress;
    const fixed = fixedDayTasks(first, DAY, DEV);
    expect(fixed).toEqual(dailyTaskIds(DAY, eligibleTasks(base, DAY)));
    expect(fixed).toHaveLength(TASKS_PER_DAY);
    // the phone harvested yesterday: the farm task is eligible now, and would be drawn
    const phone = addFarmDay(emptyTownProgress(), daysBefore(DAY, 1));
    const synced = mergeTownProgress(first, phone);
    expect(eligibleTasks(synced, DAY).has('harvest')).toBe(true);
    expect(dailyTasks(synced, DAY, DEV).map((t) => t.id)).toEqual(fixed);
    // reaching the task that was not drawn pays nothing
    const harvested = noteGame(synced, { harvest: 5 }, T + 1000, DEV);
    expect(harvested.tasksPaid.filter((t) => !fixed.includes(t.id))).toEqual([]);
    expect(dailyTasks(harvested.progress, DAY, DEV)).toHaveLength(TASKS_PER_DAY);
  });

  it('before the first write the list shown is the draw that would be fixed; the store fixes it from before a build', () => {
    expect(dayTaskIds(base, DAY, DEV)).toEqual(dailyTaskIds(DAY, eligibleTasks(base, DAY)));
    // a write that itself changed what can be done (here: a farm day) fixes the tasks from the progress before it
    const after = addFarmDay(base, daysBefore(DAY, 1));
    const fixed = fixDayTasks(after, DAY, DEV, base);
    expect(fixedDayTasks(fixed, DAY, DEV)).toEqual(dailyTaskIds(DAY, eligibleTasks(base, DAY)));
    // fixed once: a second call changes nothing (the same object)
    expect(fixDayTasks(fixed, DAY, DEV)).toBe(fixed);
    // not an active day of the streak, and nothing for a bad device
    expect(fixed.days).toEqual([]);
    expect(fixDayTasks(base, DAY, 'Not A Device')).toBe(base);
  });

  it('never pays more than three tasks a day, even with a row from an older build that paid three already', () => {
    // an older build paid talk, lines and first today, with no fixed list
    let p = updateDaily(base, DAY, DEV, (c) => ({ ...c, talks: 2, lines: 8, first: 4, met: ['cafe', 'square'], paid: ['first', 'lines', 'talk'] }));
    for (let i = 0; i < 5; i++) {
      const r = noteGame(p, { fish: 1, fishFirst: 1 }, T + i, DEV);
      expect(r.tasksPaid).toEqual([]);
      p = r.progress;
    }
    // the paid ones are the fixed ones
    expect(fixedDayTasks(p, DAY, DEV)).toEqual(['talk', 'lines', 'first']);
    expect(dailyTasks(p, DAY, DEV)).toHaveLength(TASKS_PER_DAY);
  });

  it('two copies of one browser with different fixed lists merge to the same one, whatever the order', () => {
    const a = updateDaily(base, DAY, DEV, (c) => ({ ...c, lines: 1, tasks: ['fish', 'lines', 'talk'] }));
    const b = updateDaily(base, DAY, DEV, (c) => ({ ...c, first: 1, tasks: ['episode', 'first', 'talk'] }));
    const ab = mergeTownProgress(a, b);
    expect(dailyCount(ab, DAY, DEV).tasks).toEqual(['episode', 'first', 'talk']);
    expect(mergeTownProgress(b, a)).toEqual(ab);
    // a copy without a list takes the other's
    expect(dailyCount(mergeTownProgress(a, updateDaily(base, DAY, DEV, (c) => ({ ...c, lines: 3 }))), DAY, DEV).tasks).toEqual(['fish', 'lines', 'talk']);
    // a stored list is read back as it was (sorted, at most three known ids)
    expect(dailyCount(parseTownProgress(JSON.parse(JSON.stringify(ab))), DAY, DEV).tasks).toEqual(['episode', 'first', 'talk']);
  });
});
