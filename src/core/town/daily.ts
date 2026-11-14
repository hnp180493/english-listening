// The three daily tasks of "Thị trấn" and its streak. Pure.
//
// A task is reached by listening today on this browser and pays its xu once per local day and browser, by itself,
// at the moment it is reached (no "claim" step). The counters and the paid flags live in the stored progress
// (./progress daily[day][device]), so a reload or another tab never pays a task twice.

import { addEarned, dailyCount, daysBefore, townDay, updateDaily, type DailyCount, type TownProgress } from './progress';
import type { LineOutcome } from './types';

export type TownTaskId = 'talk' | 'lines' | 'first';

export interface TownTaskDef {
  id: TownTaskId;
  /** Vietnamese, shown as it is. */
  label: string;
  goal: number;
  /** Xu paid once when the goal is reached. */
  reward: number;
}

export const TOWN_TASKS: readonly TownTaskDef[] = [
  { id: 'talk', label: 'Trò chuyện với 2 người dân', goal: 2, reward: 5 },
  { id: 'lines', label: 'Hiểu 8 câu', goal: 8, reward: 8 },
  { id: 'first', label: 'Hiểu 4 câu ngay lần nghe đầu', goal: 4, reward: 10 },
];

/** Xu a day can add through the tasks. */
export const DAILY_TASKS_XU = TOWN_TASKS.reduce((sum, t) => sum + t.reward, 0);

export interface TownTaskView extends TownTaskDef {
  /** Progress towards the goal, never above it. */
  done: number;
  reached: boolean;
  /** Its xu were already added to the balance. */
  paid: boolean;
}

/** What a task counts: 'talk' = different residents a conversation was finished with, the others = lines. */
function taskCount(task: TownTaskId, c: DailyCount): number {
  if (task === 'talk') return c.met.length;
  return task === 'lines' ? c.lines : c.first;
}

/** The three tasks of `day` on `device`, in their listed order. */
export function dailyTasks(progress: TownProgress, day: string, device: string): TownTaskView[] {
  const c = dailyCount(progress, day, device);
  return TOWN_TASKS.map((t) => {
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

/** Pay every task of (`day`, `device`) that is reached and not paid yet: flag it and add its xu to the device. */
function payReached(progress: TownProgress, day: string, device: string): DailyEffect {
  const due = dailyTasks(progress, day, device).filter((t) => t.reached && !t.paid);
  if (due.length === 0) return { progress, tasksPaid: [] };
  const flagged = updateDaily(progress, day, device, (c) => ({ ...c, paid: [...c.paid, ...due.map((t) => t.id)] }));
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
  const counted = updateDaily(progress, day, device, (c) =>
    outcome === 'wrong' ? c : { ...c, lines: c.lines + 1, first: c.first + (outcome === 'first' ? 1 : 0) },
  );
  return payReached(counted, day, device);
}

/** One conversation finished at `placeId`: counts for 'talk' (once per resident and day) and pays what it reaches. */
export function noteConversation(progress: TownProgress, placeId: string, now: number, device: string): DailyEffect {
  const day = townDay(now);
  const counted = updateDaily(progress, day, device, (c) => ({ ...c, talks: c.talks + 1, met: [...c.met, placeId] }));
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

/** Whether a line was answered in town today (the streak is safe for today). */
export function playedToday(progress: Pick<TownProgress, 'days'>, now: number): boolean {
  return progress.days.includes(townDay(now));
}
