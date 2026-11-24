// Pure helpers of "Sưu tầm" (AlbumPanel) and of the celebrations the page shows (Celebrations.tsx): what a town
// project adds to the town in words, how an achievement's progress reads, the order the album lists things in.

import { ACHIEVEMENTS, TOWN_PROJECTS, type TownMetric } from '../../../../data/townGame';
import type { AchievementView, ProjectView } from '../../../../core/town/unlocks';
import type { TownCelebration } from '../../../../core/town/store';
import { getLang, tl, tr } from '../../../../i18n';

/** What each project's decoration is, in Vietnamese (engine/extraDecor.ts draws it). */
export const DECORATION_NAME: Readonly<Record<string, string>> = {
  'proj-lake-lights': 'đèn hoa sen trôi quanh hồ',
  'proj-festival': 'sân khấu lễ hội mùa thu',
  'proj-pier': 'bến cá dài thêm, có thuyền và đèn',
  'proj-garden': 'vườn cộng đồng cạnh nông trại',
  'proj-clock-tower': 'tháp đồng hồ cạnh quán cà phê',
};

/** Where to look for it in town (said once it is built). */
export const DECORATION_WHERE: Readonly<Record<string, string>> = {
  'proj-lake-lights': 'trên mặt hồ',
  'proj-festival': 'bãi cỏ phía tây nam, sau dãy chợ',
  'proj-pier': 'cuối bến câu cá',
  'proj-garden': 'phía đông nhà trọ, trên nông trại',
  'proj-clock-tower': 'đầu phố phía tây, cạnh quán cà phê',
};

export function decorationOfProject(projectId: string): string | undefined {
  return TOWN_PROJECTS.find((p) => p.id === projectId)?.decoration;
}

/** The unit of a metric, for a progress line ("37 / 100 câu"). */
const UNIT: Readonly<Record<TownMetric, string>> = {
  lines: 'câu',
  first: 'câu nghe một lần',
  gistFirst: 'tập',
  episodes: 'tập',
  relistens: 'lần',
  fish: 'con cá',
  species: 'loài',
  legendary: 'con',
  phenomenon: 'loài',
  farmDays: 'ngày',
  streakBest: 'ngày liền',
  perfect: 'ngày',
  mature: 'thẻ',
};

/** "37 / 100 câu" (the value never shown above the target). */
export function progressText(v: Pick<AchievementView | ProjectView, 'value' | 'target'>, metric: TownMetric): string {
  const value = Math.min(v.value, v.target);
  return `${value} / ${v.target} ${tr(UNIT[metric], v.target)}`;
}

export function metricOf(id: string): TownMetric | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)?.metric ?? TOWN_PROJECTS.find((p) => p.id === id)?.metric;
}

/**
 * Achievements in the album's order: the ones unlocked first (newest on top), then the locked ones closest to done.
 * Stable for equal keys (catalog order).
 */
export function albumOrder<T extends Pick<AchievementView, 'unlockedAt' | 'progress'>>(list: readonly T[]): T[] {
  return list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const ux = x.a.unlockedAt ?? null;
      const uy = y.a.unlockedAt ?? null;
      if (ux !== null && uy !== null) return uy - ux || x.i - y.i;
      if (ux !== null) return -1;
      if (uy !== null) return 1;
      return y.a.progress - x.a.progress || x.i - y.i;
    })
    .map((x) => x.a);
}

/**
 * One row of the album's achievements: the achievements of one metric together (10 → 50 → 150 → 300 câu; the eight
 * "Bậc thầy" side by side), so the list is a dozen rows, not 34. `current` is the step to work on: the locked one
 * closest to done (in a chain of growing targets, the next one); null once every step is reached.
 */
export interface AlbumChain<T> {
  key: string;
  steps: T[];
  done: number;
  current: T | null;
  /** The last reached step (shown when the whole chain is done). */
  last: T;
}

type ChainItem = Pick<AchievementView, 'unlockedAt' | 'progress'> & { achievement: Pick<AchievementView['achievement'], 'metric'> };

/** The achievements as chains, in the album's order: the ones with a step closest to done first, finished chains last. */
export function albumChains<T extends ChainItem>(list: readonly T[]): AlbumChain<T>[] {
  const groups = new Map<string, T[]>();
  for (const a of list) {
    const key = a.achievement.metric;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const chains = [...groups.entries()].map(([key, steps], i) => {
    const locked = steps.map((s, j) => ({ s, j })).filter((x) => x.s.unlockedAt === null);
    locked.sort((x, y) => y.s.progress - x.s.progress || x.j - y.j);
    const reached = steps.filter((s) => s.unlockedAt !== null);
    const last = reached.reduce<T | null>((best, s) => (best === null || s.unlockedAt! > best.unlockedAt! ? s : best), null) ?? steps[steps.length - 1];
    return { chain: { key, steps, done: reached.length, current: locked[0]?.s ?? null, last }, i };
  });
  chains.sort((x, y) => {
    const cx = x.chain.current;
    const cy = y.chain.current;
    if (cx && cy) return cy.progress - cx.progress || x.i - y.i;
    if (cx) return -1;
    if (cy) return 1;
    return x.i - y.i;
  });
  return chains.map((x) => x.chain);
}

/** A date as the album shows it ("14/11/2026"), local time. */
export function shortDate(at: number): string {
  const d = new Date(at);
  if (getLang() === 'en') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export interface CelebrationView {
  kind: TownCelebration['kind'];
  title: string;
  lines: string[];
}

/** What the banner says for one celebration: the store's label and detail, and for a project what it adds to town. */
export function celebrationView(c: TownCelebration): CelebrationView {
  const lines = [c.detail];
  if (c.kind === 'project') {
    const deco = decorationOfProject(c.id);
    const name = deco ? DECORATION_NAME[deco] : undefined;
    if (name) lines.push(tl`Thị trấn có thêm ${name}, ${DECORATION_WHERE[deco!]}.`);
  }
  if (c.kind === 'achievement' || c.kind === 'project') lines.push('Đội danh hiệu trong Tủ đồ.');
  if (c.kind === 'egg') lines.push('Mở ở Tiệm trứng.');
  return { kind: c.kind, title: c.label, lines };
}

/** How long one celebration stays on screen (ms): longer when it says more. */
export function celebrationMs(v: CelebrationView): number {
  const chars = v.title.length + v.lines.join(' ').length;
  return Math.min(7000, Math.max(3600, 1800 + chars * 40));
}
