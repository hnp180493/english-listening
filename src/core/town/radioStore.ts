// IO of Bay FM's generated bulletins (./radio, docs/town.md §25): builds one from the world as it is now (the local
// day's weather at any time, the weekday, the month, the town's get-togethers, the news queued about the player) and
// decides when the radio plays one: every other time it is switched on (the written segments of data/scenes/radio.ts
// take the turns between), and always when there is news. Nothing is stored: the turn is counted in memory; a bulletin
// heard and answered pays as a radio scene does (./worldStore finishScene, the day's allowance shared with the written
// ones), under its own id (`fm-live-<hour of the game>`), so one edition never pays twice.

import { bulletinAt, callNow, isLiveId, type Bulletin } from './radio';
import { RADIO_CALLS } from '../../data/scenes/radioCalls';
import { markRadioNewsAired, pendingRadioNews } from './radioNews';
import type { ListenScene } from './sceneTypes';
import { townDay } from './progress';
import { TOWN_EVENTS, weatherOf, weekdayOf } from './world';
import { radioClueNews } from '../../data/city/clues';
import { hasClue } from './jobProgress';
import { grantClue, loadTownJobs } from './jobsStore';

let turns = 0;
const built = new Map<string, Bulletin>();

/** The bulletin Marcus would read now. */
export function liveBulletin(now: number = Date.now(), place: 'cafe' | 'car' = 'cafe'): Bulletin {
  const b = bulletinAt({
    now,
    weatherAt: (t) => weatherOf(townDay(t)),
    weekday: weekdayOf(now),
    month: new Date(now).getMonth() + 1,
    townEvents: TOWN_EVENTS,
    // the player's news, then a clue Bay FM carries until the learner has heard it (data/city/clues.ts)
    news: [...pendingRadioNews(now), ...radioClueNews((id) => hasClue(loadTownJobs(), id))],
    place,
  });
  built.set(b.scene.id, b);
  if (built.size > 8) built.delete(built.keys().next().value as string);
  return b;
}

/**
 * What the radio plays when switched on: a bulletin of the moment, or the written segment `written` gives, taking
 * turns (a bulletin first). With news waiting, always the bulletin.
 */
export function radioScene(now: number, place: 'cafe' | 'car', written: () => ListenScene | null, recent: ReadonlySet<string> = new Set()): ListenScene | null {
  // in turn: a bulletin of the moment, a call of the call-in show (its ladder: core/town/radio.ts callNow), a written
  // segment; with news waiting, always the bulletin
  const turn = pendingRadioNews(now).length > 0 ? 0 : turns % 3;
  turns += 1;
  if (turn === 1) {
    const c = callNow(RADIO_CALLS, recent, now);
    if (c) return c;
  }
  if (turn === 2) {
    const w = written();
    if (w) return w;
  }
  return liveBulletin(now, place).scene;
}

/**
 * A scene was heard through: if it was a bulletin, its news is marked as aired. Returns what the bulletin said the
 * sky would do next (for a line under the result: the learner can watch it happen), or null.
 */
export function radioHeard(sceneId: string): { at: number; sky: Bulletin['forecast']['now'] } | null {
  if (!isLiveId(sceneId)) return null;
  const b = built.get(sceneId);
  if (!b) return null;
  markRadioNewsAired(b.newsIds);
  for (const c of b.clues) grantClue(c);
  const c = b.forecast.changes[0];
  return c ? { at: c.at, sky: c.sky } : null;
}

/** Tests only: the turn back to the start. */
export function resetRadioTurns(): void {
  turns = 0;
  built.clear();
}
