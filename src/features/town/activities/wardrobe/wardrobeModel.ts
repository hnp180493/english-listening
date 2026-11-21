// Pure words of "Tủ đồ" (WardrobePanel): the tabs, what "nothing" is called in each, where a title comes from, how
// many titles are still to be earned outside the egg shop. Tested in wardrobeModel.test.ts.

import { ACHIEVEMENTS, TOWN_PROJECTS } from '../../../../data/townGame';
import { TOWN_LEVELS } from '../../../../core/town/economy';
import type { LookSlot } from '../../../../core/town/progress';
import type { TitleSource, TownTitle } from '../../../../core/town/wardrobe';

export type WardrobeTab = LookSlot;

export const WARDROBE_TABS: readonly { id: WardrobeTab; label: string }[] = [
  { id: 'hat', label: 'Mũ' },
  { id: 'outfit', label: 'Áo' },
  { id: 'pet', label: 'Thú cưng' },
  { id: 'title', label: 'Danh hiệu' },
];

/** The first tile of each tab: wearing nothing there. */
export const NONE_LABEL: Readonly<Record<WardrobeTab, string>> = {
  hat: 'Không đội mũ',
  outfit: 'Áo xanh gốc',
  pet: 'Đi một mình',
  title: 'Không đeo danh hiệu',
};

export const TITLE_FROM: Readonly<Record<TitleSource, string>> = {
  egg: 'Từ trứng',
  achievement: 'Thành tích',
  project: 'Dự án thị trấn',
  level: 'Cấp thị trấn',
};

/** Titles from achievements, projects and town levels not earned yet (egg titles are listed one by one). */
export function lockedTitleCount(available: readonly Pick<TownTitle, 'from'>[]): number {
  const have = available.filter((t) => t.from !== 'egg').length;
  return Math.max(0, ACHIEVEMENTS.length + TOWN_PROJECTS.length + TOWN_LEVELS.length - have);
}
