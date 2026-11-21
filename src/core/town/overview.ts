// "Thị trấn" seen as a whole: ONE selector with everything the game shell shows (xu, level, streak, daily tasks,
// every place and decoration with its state). Pure: the stored progress, the time and this browser's id go in.

import { placeLines, TOWN_DECORATIONS, TOWN_PLACES } from '../../data/town';
import { dailyTasks, playedToday, townStreak, type TownTaskView } from './daily';
import { isBuilt, levelFor, placeHearts, placeLit, placeMarker, rawBalance, storyTotals, xpOf, type PlaceMarker, type TownLevel } from './economy';
import { episodeWaitingForFriend, episodeWaitingForHome, nextEpisode, type EpisodeMode } from './episodes';
import { friendView, type FriendView } from './friendship';
import { earnedTotal, hasBought, linesStats, townDay, type TownProgress, type TownStats } from './progress';
import type { TownDecoration, TownPlace } from './types';

export { townTotals } from './economy';

export function placeStats(progress: TownProgress, place: Pick<TownPlace, 'id'>): TownStats {
  return linesStats(progress, placeLines(place.id));
}

export interface PlaceView {
  place: TownPlace;
  /**
   * It stands (free or bought): the resident's own home, its windows light up with `lit`. false = an empty lot, and
   * its resident lodges at the boarding house: they talk all the same (quick chats, episode 1), only the episodes
   * told at home (`homeEpisode`) wait for the house.
   */
  built: boolean;
  /** Xu to build it (0 for the three free places). */
  cost: number;
  /** An empty lot the balance can pay for now. */
  affordable: boolean;
  /** Xu still to earn before an empty lot can be built (0 when built or affordable). */
  missing: number;
  stats: TownStats;
  /** How much of the place's sentences is understood, 0..5 (economy placeHearts: the old measure, kept for the stats). */
  hearts: number;
  /** Friendship with the resident (./friendship): points, 0..10 hearts. A game score. */
  friend: FriendView;
  /** 0..1: how much of the place is lit (the share of its lines understood). */
  lit: number;
  /** What waits among the resident's lines (economy placeMarker), their place built or not. */
  marker: PlaceMarker;
  /**
   * The episode a conversation with the resident would be now (./episodes nextEpisode): a re-listen that is due, or
   * the next episode to hear; null = the quick five-line chat.
   */
  episode: PlaceEpisodeView | null;
  /**
   * Not built yet: the episode that would be open now but is told only at the resident's home (./episodes
   * episodeWaitingForHome): building the place opens it. null otherwise. Its `mode` is always 'new'.
   */
  homeEpisode: PlaceEpisodeView | null;
  /**
   * The next episode waits only for friendship (its `requires`, ./episodes episodeWaitingForFriend): "Cần 4 tim".
   * `hearts` = the hearts it needs (null: enough), `facts` = how many facts it still needs. null otherwise.
   */
  friendEpisode: (PlaceEpisodeView & { hearts: number | null; facts: number }) | null;
}

export interface PlaceEpisodeView {
  id: string;
  order: number;
  title: string;
  mode: EpisodeMode;
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
    const next = nextEpisode(progress, place.id, now);
    const home = episodeWaitingForHome(progress, place.id);
    const wait = next ? null : episodeWaitingForFriend(progress, place.id);
    return {
      place,
      built,
      cost: place.cost,
      affordable: !built && place.cost <= raw,
      missing: built ? 0 : Math.max(0, place.cost - raw),
      stats,
      hearts: placeHearts(stats),
      lit: placeLit(stats),
      marker: placeMarker(stats),
      episode: next ? { id: next.episode.id, order: next.episode.order, title: next.episode.title, mode: next.mode } : null,
      homeEpisode: home ? { id: home.id, order: home.order, title: home.title, mode: 'new' } : null,
      friend: friendView(progress, place.id),
      friendEpisode: wait ? { id: wait.episode.id, order: wait.episode.order, title: wait.episode.title, mode: 'new', hearts: wait.needs.hearts, facts: wait.needs.facts.length } : null,
    };
  });
  const decorations = TOWN_DECORATIONS.map((decoration): DecorationView => {
    const bought = hasBought(progress, decoration.id);
    return { decoration, bought, cost: decoration.cost, affordable: !bought && decoration.cost <= raw, missing: bought ? 0 : Math.max(0, decoration.cost - raw) };
  });
  return {
    balance: Math.max(0, raw),
    earned: earnedTotal(progress),
    level: levelFor(xpOf(totals) + xpOf(storyTotals(progress))),
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
