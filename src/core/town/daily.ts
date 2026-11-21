// The daily tasks of "Thị trấn" and its streak. Pure.
//
// Three tasks a day, drawn from a pool (TOWN_TASKS) by the local day (dailyTaskIds): one is always a listening task
// of the conversations ('lines' or 'first'), the other two come from the rest of the pool, including the game loops
// (fishing, the farm, an episode). A task enters the draw only when it can be done (`eligibleTasks`: the farm once the
// learner has harvested on an earlier day, an episode while the built places still have one not heard through).
//
// The draw is FIXED by the first write of the day on a browser (fixDayTasks: stored in daily[day][device].tasks), so
// a place built or a sync arriving later that day never redraws them: no fourth task, no half-done task vanishing, no
// task paid just for appearing. Until that first write the list shown is the draw as it would be fixed now. A task
// already paid today always stays in the list, and a day never pays more than TASKS_PER_DAY tasks.
//
// A task is reached by listening today on this browser and pays its xu once per local day and browser, by itself,
// at the moment it is reached (no "claim" step). The counters and the paid flags live in the stored progress
// (./progress daily[day][device]), so a reload or another tab never pays a task twice.

import { TOWN_PLACES } from '../../data/town';
import { TOWN_STORIES } from '../../data/townStories';
import {
  addEarned,
  dailyCount,
  dailySum,
  DAY_TASKS_MAX,
  daysBefore,
  DAYS_KEEP,
  episodeProgress,
  hasBought,
  townDay,
  updateDaily,
  type DailyCount,
  type TownProgress,
} from './progress';
import type { LineOutcome } from './types';

export type TownTaskId = 'talk' | 'lines' | 'first' | 'fish' | 'fish-first' | 'harvest' | 'episode';

export interface TownTaskDef {
  id: TownTaskId;
  /** Vietnamese, shown as it is. */
  label: string;
  goal: number;
  /** Xu paid once when the goal is reached. */
  reward: number;
}

/** The pool the three tasks of a day are drawn from. */
export const TOWN_TASKS: readonly TownTaskDef[] = [
  { id: 'talk', label: 'Trò chuyện với 2 người dân', goal: 2, reward: 5 },
  { id: 'lines', label: 'Hiểu 8 câu', goal: 8, reward: 8 },
  { id: 'first', label: 'Hiểu 4 câu ngay lần nghe đầu', goal: 4, reward: 10 },
  { id: 'fish', label: 'Câu được 5 con cá', goal: 5, reward: 6 },
  { id: 'fish-first', label: 'Câu 3 con cá ngay lần nghe đầu', goal: 3, reward: 8 },
  { id: 'harvest', label: 'Thu hoạch 5 cây ở nông trại', goal: 5, reward: 6 },
  { id: 'episode', label: 'Nghe trọn 1 tập chuyện', goal: 1, reward: 8 },
];

/** Tasks a day shows (and pays at most). */
export const TASKS_PER_DAY = DAY_TASKS_MAX;
/** One of these is always among the day's tasks (the conversations stay the heart of the town). */
const CORE_TASKS: readonly TownTaskId[] = ['lines', 'first'];

/** The most xu a day's three tasks can add (the three best-paid tasks of the pool, one of them a core task). */
export const DAILY_TASKS_XU = (() => {
  const core = Math.max(...TOWN_TASKS.filter((t) => CORE_TASKS.includes(t.id)).map((t) => t.reward));
  const coreId = TOWN_TASKS.find((t) => CORE_TASKS.includes(t.id) && t.reward === core)!.id;
  const rest = TOWN_TASKS.filter((t) => t.id !== coreId)
    .map((t) => t.reward)
    .sort((a, b) => b - a);
  return core + rest[0] + rest[1];
})();

export interface TownTaskView extends TownTaskDef {
  /** Progress towards the goal, never above it. */
  done: number;
  reached: boolean;
  /** Its xu were already added to the balance. */
  paid: boolean;
}

/** What a task counts on (day, browser). */
function taskCount(task: TownTaskId, c: DailyCount): number {
  switch (task) {
    case 'talk':
      return c.met.length; // different residents
    case 'lines':
      return c.lines;
    case 'first':
      return c.first;
    case 'fish':
      return c.fish ?? 0;
    case 'fish-first':
      return c.fishFirst ?? 0;
    case 'harvest':
      return c.harvest ?? 0;
    case 'episode':
      return c.eps ?? 0;
  }
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The tasks that can be done on `day`: the farm only once the learner has harvested on an earlier day (with no
 * review cards it could not be done), an episode only while one that can be heard is not heard through yet (episode 1
 * of any place, a later one at a place built).
 */
export function eligibleTasks(progress: TownProgress, day: string): Set<TownTaskId> {
  const out = new Set<TownTaskId>(['talk', 'lines', 'first', 'fish', 'fish-first']);
  const farmedBefore = progress.farmDays.some((d) => d < day) || Object.keys(progress.daily).some((d) => d < day && dailySum(progress, d, 'harvest') > 0);
  if (farmedBefore) out.add('harvest');
  const built = new Set(TOWN_PLACES.filter((p) => p.cost <= 0 || hasBought(progress, p.id)).map((p) => p.id));
  // one not heard through yet, or one heard through today (the last one finished today was there this morning)
  const open = (id: string): boolean => {
    const e = episodeProgress(progress, id);
    return (e?.stage ?? 0) < 1 || (!!e && e.at > 0 && townDay(e.at) === day);
  };
  // episode 1 of every place can be heard from the first day (a lodger talks too); a later one only at home, the
  // place built (./episodes needsHome, HOME_EPISODE_FROM = 2: not imported, episodes imports this module)
  if (TOWN_STORIES.some((e) => (e.order < 2 || built.has(e.placeId)) && open(e.id))) out.add('episode');
  return out;
}

/**
 * The ids of the tasks of `day` among `eligible`, in the order shown: one core task ('lines' or 'first', by the day)
 * and two others drawn by the day. Deterministic for (day, eligible).
 */
export function dailyTaskIds(day: string, eligible: ReadonlySet<TownTaskId>): TownTaskId[] {
  const h = hash(`town-tasks:${day}`);
  const core = CORE_TASKS[h % CORE_TASKS.length];
  // a permutation of the rest of the pool by the day (a small LCG on the hash: stable, no Math.random)
  let s = h || 1;
  const keyed = TOWN_TASKS.filter((t) => t.id !== core).map((t) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return { id: t.id, key: s ^ hash(t.id) };
  });
  keyed.sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : 1));
  const others = keyed.map((k) => k.id).filter((id) => eligible.has(id)).slice(0, TASKS_PER_DAY - 1);
  const ids = new Set<TownTaskId>([core, ...others]);
  return TOWN_TASKS.filter((t) => ids.has(t.id)).map((t) => t.id);
}

const TASK_IDS = new Set<string>(TOWN_TASKS.map((t) => t.id));
const isTaskId = (id: string): id is TownTaskId => TASK_IDS.has(id);

/** The tasks fixed for (`day`, `device`), in the pool's order (none: not fixed yet). */
export function fixedDayTasks(progress: TownProgress, day: string, device: string): TownTaskId[] {
  const fixed = (dailyCount(progress, day, device).tasks ?? []).filter(isTaskId);
  return TOWN_TASKS.filter((t) => fixed.includes(t.id))
    .map((t) => t.id)
    .slice(0, TASKS_PER_DAY);
}

/**
 * The three a row would fix now: the tasks already paid today first (a row written by an older build that had no
 * fixed list), then the day's core task, then the rest of the day's draw from `eligible`. In the pool's order.
 */
function tasksToFix(day: string, eligible: ReadonlySet<TownTaskId>, paid: readonly string[]): TownTaskId[] {
  const drawn = dailyTaskIds(day, eligible);
  const core = drawn.filter((id) => CORE_TASKS.includes(id));
  const order = [...new Set<TownTaskId>([...TOWN_TASKS.map((t) => t.id).filter((id) => paid.includes(id)), ...core, ...drawn])].slice(0, TASKS_PER_DAY);
  return TOWN_TASKS.filter((t) => order.includes(t.id)).map((t) => t.id);
}

/** The day's tasks of (`day`, `device`): the fixed ones, or the draw as it would be fixed now. Pool order. */
export function dayTaskIds(progress: TownProgress, day: string, device: string): TownTaskId[] {
  const fixed = fixedDayTasks(progress, day, device);
  return fixed.length > 0 ? fixed : tasksToFix(day, eligibleTasks(progress, day), dailyCount(progress, day, device).paid);
}

/**
 * The progress with the tasks of (`day`, `device`) fixed for the rest of the day, drawn from what `basis` (default:
 * `progress`) can do: the store passes the progress from before the write, so a place built by that very write does
 * not count yet. Already fixed (or a bad day / device): the same progress. Not an active day of the streak.
 */
export function fixDayTasks(progress: TownProgress, day: string, device: string, basis: TownProgress = progress): TownProgress {
  if (fixedDayTasks(progress, day, device).length > 0) return progress;
  const tasks = tasksToFix(day, eligibleTasks(basis, day), dailyCount(progress, day, device).paid);
  return updateDaily(progress, day, device, (c) => ({ ...c, tasks }), false);
}

/** The tasks of `day` on `device`, in the pool's order: the day's three, plus any task already paid today. */
export function dailyTasks(progress: TownProgress, day: string, device: string): TownTaskView[] {
  const c = dailyCount(progress, day, device);
  const ids = new Set<TownTaskId>([...dayTaskIds(progress, day, device), ...TOWN_TASKS.filter((t) => c.paid.includes(t.id)).map((t) => t.id)]);
  return TOWN_TASKS.filter((t) => ids.has(t.id)).map((t) => {
    const n = taskCount(t.id, c);
    return { ...t, done: Math.min(t.goal, n), reached: n >= t.goal, paid: c.paid.includes(t.id) };
  });
}

/** A task that was just paid. */
export interface TaskPayout {
  id: TownTaskId;
  label: string;
  reward: number;
}

export interface DailyEffect {
  progress: TownProgress;
  /** Tasks this step reached and paid (their xu are already in `progress`). */
  tasksPaid: TaskPayout[];
}

/**
 * Pay every task of (`day`, `device`) that is reached and not paid yet: flag it and add its xu to the device. Only
 * the day's fixed tasks pay (fixed here when they are not yet), and never more than TASKS_PER_DAY in a day.
 */
export function payReached(input: TownProgress, day: string, device: string): DailyEffect {
  const progress = fixDayTasks(input, day, device);
  const c = dailyCount(progress, day, device);
  const room = TASKS_PER_DAY - c.paid.filter(isTaskId).length;
  if (room <= 0) return { progress, tasksPaid: [] };
  const ids = new Set(fixedDayTasks(progress, day, device));
  const due = dailyTasks(progress, day, device)
    .filter((t) => ids.has(t.id) && t.reached && !t.paid)
    .slice(0, room);
  if (due.length === 0) return { progress, tasksPaid: [] };
  const flagged = updateDaily(progress, day, device, (c) => ({ ...c, paid: [...c.paid, ...due.map((t) => t.id)] }), false);
  // the flag did not stick (a bad day or device): nothing is paid, so nothing can be paid twice
  if (flagged === progress) return { progress, tasksPaid: [] };
  let next = flagged;
  for (const t of due) next = addEarned(next, device, t.reward);
  return { progress: next, tasksPaid: due.map((t) => ({ id: t.id, label: t.label, reward: t.reward })) };
}

/**
 * One line answered at `now` on `device`: the day becomes an active day, a right answer counts for 'lines' (and for
 * 'first' when it was understood on the first listen), and any task this reaches is paid.
 */
export function noteLine(progress: TownProgress, outcome: LineOutcome, now: number, device: string): DailyEffect {
  const day = townDay(now);
  const counted = updateDaily(fixDayTasks(progress, day, device), day, device, (c) =>
    outcome === 'wrong' ? c : { ...c, lines: c.lines + 1, first: c.first + (outcome === 'first' ? 1 : 0) },
  );
  return payReached(counted, day, device);
}

/**
 * One conversation finished at `placeId`: counts for 'talk' (once per resident and day), a perfect one for the egg of
 * the day (./eggs), and pays what it reaches.
 */
export function noteConversation(progress: TownProgress, placeId: string, now: number, device: string, perfect = false): DailyEffect {
  const day = townDay(now);
  const counted = updateDaily(fixDayTasks(progress, day, device), day, device, (c) => ({ ...c, talks: c.talks + 1, met: [...c.met, placeId], perfect: (c.perfect ?? 0) + (perfect ? 1 : 0) }));
  return payReached(counted, day, device);
}

/** An episode heard through (a finish or a re-listen) at `placeId`: a conversation, and one for the 'episode' task. */
export function noteEpisode(progress: TownProgress, placeId: string, now: number, device: string): DailyEffect {
  const day = townDay(now);
  const counted = updateDaily(fixDayTasks(progress, day, device), day, device, (c) => ({ ...c, talks: c.talks + 1, met: [...c.met, placeId], eps: (c.eps ?? 0) + 1 }));
  return payReached(counted, day, device);
}

/**
 * The counters of the game loops added for (`now`, `device`) and the tasks they reach paid. They do not make the day
 * an active day of the town streak (only a town line does).
 */
export function noteGame(progress: TownProgress, add: Partial<Record<'fish' | 'fishFirst' | 'fishXu' | 'harvest', number>>, now: number, device: string): DailyEffect {
  const day = townDay(now);
  const counted = updateDaily(
    fixDayTasks(progress, day, device),
    day,
    device,
    (c) => {
      const next = { ...c };
      for (const k of ['fish', 'fishFirst', 'fishXu', 'harvest'] as const) {
        const n = add[k] ?? 0;
        if (Number.isFinite(n) && n > 0) next[k] = (c[k] ?? 0) + Math.floor(n);
      }
      return next;
    },
    false,
  );
  return payReached(counted, day, device);
}

/**
 * Consecutive local days with at least one line answered in town (on any machine), ending today, or yesterday when
 * nothing was answered yet today. Same rule as core/stats currentStreak.
 */
export function townStreak(progress: Pick<TownProgress, 'days'>, now: number): number {
  const set = new Set(progress.days);
  let day = townDay(now);
  if (!set.has(day)) day = daysBefore(day, 1);
  let streak = 0;
  while (set.has(day)) {
    streak += 1;
    day = daysBefore(day, 1);
  }
  return streak;
}

/** The longest run of consecutive active days ever kept (the days list keeps DAYS_KEEP days). */
export function bestStreak(progress: Pick<TownProgress, 'days'>): number {
  let best = 0;
  let run = 0;
  let prev = '';
  for (const day of [...progress.days].sort()) {
    run = prev && daysBefore(day, 1) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

/**
 * The days on which a run of consecutive active days reached a multiple of `every` (7, 14, 21 … with every = 7).
 *
 * Only DAYS_KEEP days are kept, so once the list is full the oldest run may have begun before its first kept day: its
 * length is unknown and counting it from there would move its milestones by a day every time a day is pruned (a new
 * id, so a new egg, every day). That run counts on from its last milestone already given (`anchors`, e.g. the days of
 * the 'streak:' egg grants) in steps of `every`; with none, it gives nothing. Every other run starts inside the list
 * and counts from its first day. So a milestone day never changes once given, and is given once.
 */
export function streakMilestones(days: readonly string[], every: number, anchors: readonly string[] = []): string[] {
  const step = Math.max(1, Math.floor(every));
  const sorted = [...new Set(days)].sort();
  const runs: string[][] = [];
  let prev = '';
  for (const day of sorted) {
    if (prev && daysBefore(day, 1) === prev) runs[runs.length - 1].push(day);
    else runs.push([day]);
    prev = day;
  }
  const given = new Set(anchors);
  const out: string[] = [];
  runs.forEach((run, i) => {
    if (i > 0 || sorted.length < DAYS_KEEP) {
      run.forEach((day, j) => {
        if ((j + 1) % step === 0) out.push(day);
      });
      return;
    }
    let last = -1;
    run.forEach((day, j) => {
      if (given.has(day)) last = j;
    });
    if (last >= 0) for (let j = last; j < run.length; j += step) out.push(run[j]);
  });
  return out;
}

/** Whether a line was answered in town today (the streak is safe for today). */
export function playedToday(progress: Pick<TownProgress, 'days'>, now: number): boolean {
  return progress.days.includes(townDay(now));
}
