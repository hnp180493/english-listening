// The admin sandbox's first state (core/admin.ts): the town as if long played. Every place built, every decoration
// bought, coins to spare, every resident at full hearts; the city met (its rules lift their own waits in admin mode).
// Written only into the sandbox's keys, and only when the sandbox is empty: the learner's own data is never touched.

import { ADMIN } from '../../core/admin';
import { KEYS, loadJSON, saveJSON } from '../../core/storage';
import { emptyTownCity } from '../../core/town/city';
import { addFriendPoints, FRIEND_MAX_POINTS } from '../../core/town/friendship';
import { addEarned, emptyTownProgress } from '../../core/town/progress';
import { townDevice } from '../../core/town/store';
import { TOWN_DECORATIONS, TOWN_PLACES } from '../../data/town';

/** Coins the sandbox starts with. */
export const ADMIN_XU = 99_999;

/** Seed the sandbox if it is empty (no town yet). Nothing at all outside admin mode. */
export function seedAdmin(now: number = Date.now()): boolean {
  if (!ADMIN) return false;
  if (loadJSON<unknown>(KEYS.town, null) !== null) return false;
  const device = townDevice();
  let p = { ...emptyTownProgress(), bought: [...TOWN_PLACES.map((x) => x.id), ...TOWN_DECORATIONS.map((x) => x.id)] };
  p = addEarned(p, device, ADMIN_XU);
  for (const place of TOWN_PLACES) p = addFriendPoints(p, place.id, FRIEND_MAX_POINTS, device).progress;
  saveJSON(KEYS.town, p);
  saveJSON(KEYS.townCity, { ...emptyTownCity(), first: now });
  return true;
}
