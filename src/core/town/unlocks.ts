// Achievements, titles and town projects of "Thị trấn" (docs/town.md §10). Pure.
//
// Every goal counts listening (data/townGame TownMetric): lines understood, gists right on the first listen, episodes
// heard through, fish caught by ear, days the farm (Ôn tập) was harvested, days in a row… Nothing counts clicks, time
// spent or xu.
//
//   townMetrics(progress, review?)            the totals every goal reads
//   achievementsUnlocked(progress, review?)   ids of the achievements reached now (pure: not what is stored)
//   achievementsView / projectsView           each goal with its value, target, 0..1 and when it was unlocked
//   settleTown(progress, now, review?)        what follows from a write: the egg grants due (./eggs) and the
//                                             achievements / projects reached recorded in `unlocks` (with `now`);
//                                             returns the new ones so the shell can celebrate them
//   projectDecorations(progress)              the world decorations of the projects done (the engine draws them)
//
// `review` = facts from Ôn tập (`mature`: cards with an interval of MATURE_DAYS or more). Without it the goals that
// need it are not reached (never "un-reached": what is recorded stays recorded).

import { TOWN_STORIES } from '../../data/townStories';
import { ACHIEVEMENTS, FISH_SPECIES, fishSpecies, TOWN_PROJECTS, type Achievement, type TownGoal, type TownProject } from '../../data/townGame';
import type { ReviewEntry } from '../review/types';
import { MATURE_DAYS } from '../srs';
import { PHENOMENA, type Phenomenon } from '../types';
import { bestStreak } from './daily';
import { storyTotals, townTotals } from './economy';
import { eggGrantsEarned, grantEggs } from './eggs';
import { fishCaughtTotal } from './fishing';
import { addUnlocks, isUnlocked, type TownProgress } from './progress';

/** Facts from Ôn tập some goals read. */
export interface TownReviewFacts {
  /** Review cards with an interval of MATURE_DAYS (21) days or more. */
  mature: number;
}

/** The review facts from the entries of a review snapshot (core/review). */
export function reviewFacts(entries: readonly Pick<ReviewEntry, 'state'>[]): TownReviewFacts {
  return { mature: entries.filter((e) => e.state.interval >= MATURE_DAYS).length };
}

export interface TownMetrics {
  lines: number;
  first: number;
  gistFirst: number;
  episodes: number;
  relistens: number;
  fish: number;
  species: number;
  legendary: number;
  phenomenon: Record<Phenomenon, number>;
  farmDays: number;
  streakBest: number;
  perfect: number;
  /** null without review facts. */
  mature: number | null;
}

export function townMetrics(progress: TownProgress, review?: TownReviewFacts | null): TownMetrics {
  const town = townTotals(progress);
  const story = storyTotals(progress);
  const phenomenon = Object.fromEntries(PHENOMENA.map((p) => [p, 0])) as Record<Phenomenon, number>;
  let species = 0;
  let legendary = 0;
  for (const [id, f] of Object.entries(progress.fish)) {
    const s = fishSpecies(id);
    if (!s || f.caught <= 0) continue;
    species += 1;
    phenomenon[s.phenomenon] += 1;
    if (s.tier === 'huyen-thoai') legendary += 1;
  }
  let gistFirst = 0;
  let episodes = 0;
  let relistens = 0;
  for (const e of Object.values(progress.episodes)) {
    if (e.firstGist === 2) gistFirst += 1;
    if (e.stage >= 1) episodes += 1;
    relistens += Math.max(0, e.stage - 1);
  }
  return {
    lines: town.understood + story.understood,
    // a line of an episode is never a first listen (./economy keptOutcome): only the quick chats' lines count here
    first: town.first,
    gistFirst,
    episodes,
    relistens,
    fish: fishCaughtTotal(progress),
    species,
    legendary,
    phenomenon,
    farmDays: progress.farmDays.length,
    streakBest: bestStreak(progress),
    perfect: eggGrantsEarned(progress).filter((g) => g.startsWith('perfect:')).length,
    mature: review ? Math.max(0, Math.floor(review.mature) || 0) : null,
  };
}

/** The number a goal must reach ('all' = every episode / species / species of its phenomenon there is). */
export function goalTarget(goal: TownGoal): number {
  if (goal.goal !== 'all') return goal.goal;
  if (goal.metric === 'episodes') return TOWN_STORIES.length;
  if (goal.metric === 'species') return FISH_SPECIES.length;
  if (goal.metric === 'legendary') return FISH_SPECIES.filter((f) => f.tier === 'huyen-thoai').length;
  if (goal.metric === 'phenomenon') return FISH_SPECIES.filter((f) => f.phenomenon === goal.phenomenon).length;
  return Number.POSITIVE_INFINITY; // 'all' means nothing for the other metrics (data/townGame.test keeps it out)
}

/** The value a goal reads now (null: it needs review facts that were not given). */
export function goalValue(goal: TownGoal, m: TownMetrics): number | null {
  if (goal.metric === 'phenomenon') return goal.phenomenon ? m.phenomenon[goal.phenomenon] : 0;
  return m[goal.metric];
}

export interface GoalView {
  value: number;
  target: number;
  /** 0..1 */
  progress: number;
  reached: boolean;
  /** When it was recorded as reached (epoch ms), null when not recorded yet. */
  unlockedAt: number | null;
}

function goalView(goal: TownGoal, id: string, m: TownMetrics, progress: TownProgress): GoalView {
  const target = goalTarget(goal);
  const value = goalValue(goal, m) ?? 0;
  const recorded = isUnlocked(progress, id);
  const reached = recorded || (goalValue(goal, m) !== null && value >= target);
  return {
    value: Math.min(value, target),
    target,
    progress: target > 0 && Number.isFinite(target) ? Math.min(1, value / target) : 0,
    reached,
    unlockedAt: recorded ? progress.unlocks[id] : null,
  };
}

/** Ids of the achievements reached now by the metrics (recorded or not). */
export function achievementsUnlocked(progress: TownProgress, review?: TownReviewFacts | null): string[] {
  const m = townMetrics(progress, review);
  return ACHIEVEMENTS.filter((a) => {
    const v = goalValue(a, m);
    return v !== null && v >= goalTarget(a);
  }).map((a) => a.id);
}

/** Ids of the town projects done now by the metrics. */
export function projectsDone(progress: TownProgress, review?: TownReviewFacts | null): string[] {
  const m = townMetrics(progress, review);
  return TOWN_PROJECTS.filter((p) => {
    const v = goalValue(p, m);
    return v !== null && v >= goalTarget(p);
  }).map((p) => p.id);
}

export interface AchievementView extends GoalView {
  achievement: Achievement;
}

export interface ProjectView extends GoalView {
  project: TownProject;
}

/** Every achievement with its progress, in catalog order. */
export function achievementsView(progress: TownProgress, review?: TownReviewFacts | null): AchievementView[] {
  const m = townMetrics(progress, review);
  return ACHIEVEMENTS.map((achievement) => ({ achievement, ...goalView(achievement, achievement.id, m, progress) }));
}

/** Every town project with its progress, in catalog order. */
export function projectsView(progress: TownProgress, review?: TownReviewFacts | null): ProjectView[] {
  const m = townMetrics(progress, review);
  return TOWN_PROJECTS.map((project) => ({ project, ...goalView(project, project.id, m, progress) }));
}

/** The world decorations of the projects recorded as done (the engine draws them for good). */
export function projectDecorations(progress: TownProgress): string[] {
  return TOWN_PROJECTS.filter((p) => isUnlocked(progress, p.id)).map((p) => p.decoration);
}

export interface Settled {
  progress: TownProgress;
  /** Achievements and projects recorded now (catalog order: achievements first). */
  unlocked: string[];
  /** Egg grants added now. */
  granted: string[];
}

/**
 * What a write brings with it: the eggs the listening has earned are granted, then the achievements and projects
 * reached are recorded at `now`. Idempotent: settling a settled progress changes nothing (the same object back).
 */
export function settleTown(progress: TownProgress, now: number, review?: TownReviewFacts | null): Settled {
  const eggs = grantEggs(progress);
  const reached = [...achievementsUnlocked(eggs.progress, review), ...projectsDone(eggs.progress, review)];
  const fresh = reached.filter((id) => !isUnlocked(eggs.progress, id));
  const next = addUnlocks(eggs.progress, fresh, now);
  return { progress: next, unlocked: fresh.filter((id) => isUnlocked(next, id)), granted: eggs.granted };
}
