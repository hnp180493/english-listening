// IO of "Thế giới sống" (docs/town.md §19, ./world): what today is in the town, which scenes were heard lately, and
// the one call that ends a scene. Nothing of its own is stored: the scenes that paid are the daily set `heard` of
// town-progress (./progress), xu and friendship go there too (./store commitTown).

import { addFriendPoints } from './friendship';
import { addEarned, townDay, updateDaily, type TownProgress } from './progress';
import type { ListenScene, Weather } from './sceneTypes';
import { commitTown, loadTownProgress, townDevice } from './store';
import { eventOn, scenePay, weatherOf, weekdayOf, type ScenePay, type SceneResult, type TownEvent } from './world';
import { heardScene } from './clueStore';

/** The town today: the local day, its weekday, its weather, and the get-together that is on (or null). */
export interface TownToday {
  day: string;
  weekday: number;
  weather: Weather;
  event: TownEvent | null;
}

export function townToday(now: number = Date.now()): TownToday {
  const day = townDay(now);
  const weekday = weekdayOf(now);
  return { day, weekday, weather: weatherOf(day), event: eventOn(weekday) };
}

/** The scene ids in the daily sets `heard` of every device, for `day` only or for every day kept. */
export function scenesHeard(progress: TownProgress, day?: string): string[] {
  const out = new Set<string>();
  for (const [d, bucket] of Object.entries(progress.daily)) {
    if (day !== undefined && d !== day) continue;
    for (const c of Object.values(bucket)) for (const id of c.heard ?? []) out.add(id);
  }
  return [...out];
}

export interface SceneEnd extends ScenePay {
  /** The xu and friendship were written (false: the browser's storage refused; the result still shows). */
  saved: boolean;
}

const done = new WeakMap<SceneResult, SceneEnd>();

/**
 * A scene was heard and its questions answered: paid once (a second call with the same result returns the first
 * answer), within the day's allowance for its kind. The host of a get-together gets a little closer.
 */
export function finishScene(scene: ListenScene, host: string | null, result: SceneResult, now: number = Date.now()): SceneEnd {
  const again = done.get(result);
  if (again) return again;
  heardScene(scene.id, now); // a clue it gives (data/city/clues.ts)
  const device = townDevice();
  const day = townDay(now);
  let progress = loadTownProgress();
  const pay = scenePay(scene, result, scenesHeard(progress, day));
  let bond = 0;
  if (!pay.capped && (pay.xu > 0 || pay.bond > 0 || result.asked > 0)) {
    // heard and answered: it counts for today even when nothing was understood (it does not pay again)
    progress = updateDaily(progress, day, device, (d) => ({ ...d, heard: [...(d.heard ?? []), scene.id] }), true);
    if (pay.xu > 0) progress = addEarned(progress, device, pay.xu);
    if (pay.bond > 0 && host) {
      const w = addFriendPoints(progress, host, pay.bond, device);
      progress = w.progress;
      bond = w.points;
    }
  }
  const saved = progress !== loadTownProgress() ? commitTown(progress, now).saved : true;
  const end: SceneEnd = { xu: pay.xu, bond, capped: pay.capped, saved };
  done.set(result, end);
  return end;
}
