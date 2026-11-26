// Westbay's quest cards and the opening hours (data/city/hours.ts; docs/town.md §33): a card that sends the learner to
// somebody whose place is shut now says when it opens, so nothing waits without a reason. A job's own cards are left
// alone (a job stages its people itself).

import { useEffect, useState } from 'react';
import { skyNow } from '../../../core/town/skyNow';
import { hourLabel, opensAt } from '../../../data/city/hours';
import { tl } from '../../../i18n';
import type { Quest } from '../quests';

/** The game's hour, whole, read every fifteen real seconds (an hour of the game is two real minutes). */
export function useGameHour(): number {
  const [h, setH] = useState(() => Math.floor(skyNow().hour));
  useEffect(() => {
    const id = window.setInterval(() => setH(Math.floor(skyNow().hour)), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return h;
}

export function withHours(quests: readonly Quest[], hour: number, admin: boolean): Quest[] {
  if (admin) return [...quests];
  return quests.map((q) => {
    const at = q.target?.kind === 'resident' ? (q.target.id as string) : null;
    const opens = at ? opensAt(at, hour) : null;
    return opens === null ? q : { ...q, step: tl`Đang đóng cửa · mở lúc ${hourLabel(opens)}` };
  });
}
