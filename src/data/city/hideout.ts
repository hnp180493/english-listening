// The learner's hideout in Westbay ("Chỗ ẩn", docs/gta-plan.md §4.4 and §6, milestone M3; docs/town.md §29): the
// "home of your own" that was never built. A one-room lock-up behind Gus's hut on Pier Road, between the ferry and
// College Road: the old harbour's side of the city, where Rico's office is (the old gatehouse beside Gus's hut,
// data/city/dispatch/places.ts OFFICE_AT). The learner lives in the town and comes up on the no. 9 (docs/gta-story.md
// §1); the last bus home is at 10:15 at night, so a room of one's own up here is where a late job ends.
//
// Bought once with xu (core/town/economy.ts townItem: an item of the town's `bought` list, like a garage vehicle),
// kept on every machine; its own state (when bought, the last rest, upgrades later) is the synced key `town-hideout`
// (core/town/hideout.ts). Coordinates are Westbay's stretched map's (data/cityWorld.ts CITY_WORLD), as the sim and the
// stage use them; the thing to click is in cityWorld.ts RAW_THINGS (the map before the stretch; a test checks the two
// agree).

import type { ThingId, Tile } from '../townWorld';

/** The item id in the town's `bought` list. Never change it. */
export const HIDEOUT_ID = 'hideout';

/** Its price in xu (docs/gta-plan.md §6: "about 800", the first thing in the game worth saving for). */
export const HIDEOUT_COST = 800;

/** The lot it stands on (tiles): three wide, two deep, its door on the +y face towards Pier Road. */
export const HIDEOUT_LOT = { x: 69, y: 86, w: 3, d: 2 } as const;

/** The tile in front of its door (where the player stands to go in, and comes out). */
export const HIDEOUT_DOOR: Tile = { x: 70, y: 88 };

/** The thing clicked on the map (its box is the building) and E beside its door. */
export const HIDEOUT_THING: ThingId = 'thing:hideout';

/** The stage draws it as one of two "projects" (engine/extraDecor.ts): shut and to let, or lived in. */
export const HIDEOUT_LET = 'hideout-let';
export const HIDEOUT_HOME = 'hideout-home';

/** Where its model stands: the middle of the lot (a project's ground point). */
export const HIDEOUT_AT: Tile = { x: HIDEOUT_LOT.x + HIDEOUT_LOT.w / 2, y: HIDEOUT_LOT.y + HIDEOUT_LOT.d / 2 };

/** Half its walls' size round HIDEOUT_AT (tiles): what blocks a walk (engine/sim.ts projectColliders). */
export const HIDEOUT_HALF = { x: HIDEOUT_LOT.w / 2 - 0.16, y0: -(HIDEOUT_LOT.d / 2 - 0.16), y1: HIDEOUT_LOT.d / 2 - 0.16 } as const;

/** Upgrades to come (docs/gta-plan.md §4.4): none yet. Their ids will be kept in town-hideout `upgrades`. */
export const HIDEOUT_UPGRADES: readonly { id: string; name: string; cost: number }[] = [];

/** The id the review cards of a job's lines and of the dispatch office's calls start with (`talk:<ref>`). */
export const RELISTEN_PREFIXES = ['job-', 'disp-'] as const;
