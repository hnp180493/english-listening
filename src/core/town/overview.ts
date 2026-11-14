// "Thị trấn" seen as a whole: ONE selector with everything the game shell shows (xu, level, streak, daily tasks,
// every place and decoration with its state). Pure: the stored progress, the time and this browser's id go in.

import { placeLines, TOWN_DECORATIONS, TOWN_PLACES } from '../../data/town';
import { dailyTasks, playedToday, townStreak, type TownTaskView } from './daily';
import { isBuilt, levelFor, placeHearts, placeLit, placeMarker, rawBalance, xpOf, type PlaceMarker, type TownLevel } from './economy';
import { earnedTotal, hasBought, linesStats, townDay, type TownProgress, type TownStats } from './progress';
import type { TownDecoration, TownPlace } from './types';

export { townTotals } from './economy';

export function placeStats(progress: TownProgress, place: Pick<TownPlace, 'id'>): TownStats {
  return linesStats(progress, placeLines(place.id));
}

export interface PlaceView {
  place: TownPlace;
  /** It stands (free or bought): its resident can be talked to. false = an empty lot. */
  built: boolean;
  /** Xu to build it (0 for the three free places). */
  cost: number;
  /** An empty lot the balance can pay for now. */
  affordable: boolean;
  /** Xu still to earn before an empty lot can be built (0 when built or affordable). */
  missing: number;
  stats: TownStats;
  /** Friendship with the resident, 0..5. */
  hearts: number;
  /** 0..1: how much of the place is lit (the share of its lines understood). */
  lit: number;
  /** What waits there (economy placeMarker); null for an empty lot. */
  marker: PlaceMarker | null;
}

export interface DecorationView {
  decoration: TownDecoration;
  bought: boolean;
  cost: number;
  /** Not bought yet and the balance covers it. */
  affordable: boolean;
  /** Xu still to earn before it can be bought (0 when bought or affordable). */
  missing: number;
}

export interface TownOverview {
  /** Xu to spend now (never below 0). */
  balance: number;
  /** Xu earned so far, on all machines. */
  earned: number;
  level: TownLevel;
  /** Consecutive days with a line answered in town (daily townStreak). */
  streak: number;
  /** A line was answered today: the streak is kept for today. */
  playedToday: boolean;
  /** The three daily tasks of today on this browser. */
  tasks: TownTaskView[];
  /** Lines of the whole town. */
  totals: TownStats;
  places: PlaceView[];
  decorations: DecorationView[];
  /** Places that stand / decorations bought, of how many (for a "town built" line). */
  built: number;
  decorated: number;
  /** Something can be bought right now (a lot or a decoration). */
  canBuySomething: boolean;
}

/** Everything the game shell shows, from one stored value. `device` = this browser (core/history deviceId). */
export function townOverview(progress: TownProgress, now: number, device: string): TownOverview {
  const raw = rawBalance(progress);
  const totals: TownStats = { total: 0, understood: 0, first: 0 };
  const places = TOWN_PLACES.map((place): PlaceView => {
    const stats = placeStats(progress, place);
    totals.total += stats.total;
    totals.understood += stats.understood;
    totals.first += stats.first;
    const built = isBuilt(progress, place.id);
    return {
      place,
      built,
      cost: place.cost,
      affordable: !built && place.cost <= raw,
      missing: built ? 0 : Math.max(0, place.cost - raw),
      stats,
      hearts: placeHearts(stats),
      lit: placeLit(stats),
      marker: built ? placeMarker(stats) : null,
    };
  });
  const decorations = TOWN_DECORATIONS.map((decoration): DecorationView => {
    const bought = hasBought(progress, decoration.id);
    return { decoration, bought, cost: decoration.cost, affordable: !bought && decoration.cost <= raw, missing: bought ? 0 : Math.max(0, decoration.cost - raw) };
  });
  return {
    balance: Math.max(0, raw),
    earned: earnedTotal(progress),
    level: levelFor(xpOf(totals)),
    streak: townStreak(progress, now),
    playedToday: playedToday(progress, now),
    tasks: dailyTasks(progress, townDay(now), device),
    totals,
    places,
    decorations,
    built: places.filter((p) => p.built).length,
    decorated: decorations.filter((d) => d.bought).length,
    canBuySomething: places.some((p) => p.affordable) || decorations.some((d) => d.affordable),
  };
}
