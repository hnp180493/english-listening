// Where a conversation is staged in the town (docs/town.md §7 "Staging"): the owner saw a café talk played on the
// grass ("quán cà phê gì ở ngoài đường?"), so every talk has a setting (core/town/story.ts StorySetting, resolved by
// data/townStories.ts episodeSetting / quickChatSetting) and the stage takes both people there first:
// - 'inside' room R: the player walks to R's door in the town (the boarding house's door for 'inn', the pavilion's for
//   'square'), the stage fades into R's room (three/interiors) and back out to that door afterwards;
// - 'outside' at P: both walk to P's front (the resident at their own spot by the door, the player beside them on the
//   screen; at the plaza a lodger and the player stand south of the fountain) and the talk is framed there;
// - 'here': a resident met out in the town (clicked, or E beside them, away from where their talk would happen) is
//   talked to where they stand (docs/town.md §14 "Gặp trên đường": the owner, 2026-11-22, clicked Daniel on a path
//   and was taken into the boarding house). The player walks up to them; nobody goes anywhere.
// Pure numbers on the sim's tile grid (the centre of tile (3, 4) is (3.5, 4.5)), tested in staging.test.ts.

import type { StorySetting } from '../../../core/town/story';
import { walkable } from '../../../core/town/map';
import type { Tile, TownWorld, WorldPlace } from '../../../data/townWorld';

export type { StorySetting } from '../../../core/town/story';

/** Where a talk is staged: a story setting, or right where the two met in the street. */
export type TalkSetting = StorySetting | { kind: 'here' };

/**
 * A resident met this far (tiles, as the crow flies) from where their talk would happen (the room's door, their spot
 * outside) is out in the town: the talk happens where they stand, not there.
 */
export const STREET_FAR = 5;

export interface Pt {
  x: number;
  y: number;
}

/** Where the two stand for a talk outside: the resident, the player, and what is behind them (the camera keeps it in). */
export interface OutsideSpots {
  resident: Pt;
  player: Pt;
  /** A point of the building or thing they stand at (grid x, y and its height), kept in the conversation shot. */
  backdrop: { x: number; y: number; h: number };
}

/** Where the player enters a room from the town: the tile in front of its door, and the way out (heading, radians). */
export interface Doorway {
  door: Tile;
  /** The heading of the street side (atan2(dy, dx) on the grid): the player stands facing it when they come out. */
  out: number;
  /** A spot beside the door where the resident waits for the player (they go in together). */
  beside: Pt;
}

const centre = (t: Tile): Pt => ({ x: t.x + 0.5, y: t.y + 0.5 });
const placeOf = (world: TownWorld, id: string): WorldPlace | undefined => world.places.find((p) => p.id === id);

/** The heading out of a place's door (its face: 'x' = the +x face, 'y' = the +y face). */
export function outward(face: 'x' | 'y'): number {
  return face === 'x' ? 0 : Math.PI / 2;
}

/**
 * The plaza for a talk with somebody who is not Leo (a lodger whose stall, bench or ticket table stands there): south
 * of the fountain, side by side on the screen (along (1, −1): the default view looks from +x+y), the fountain behind.
 */
const PLAZA_PAIR = { resident: { x: 0, y: 2.1 }, player: { x: 0.8, y: 1.35 } } as const;

/**
 * Where a talk outside at `at` happens with the resident of `residentId`: at a place's front the resident stands at
 * their own spot by the door (Mia close to her wall, at her window) and the player at the door; at the plaza with
 * anybody but Leo, south of the fountain. Null for an unknown place.
 */
export function outsideSpots(world: TownWorld, at: string, residentId: string): OutsideSpots | null {
  if (at === 'square' && residentId !== 'square') {
    const { plaza } = world;
    // (PLAZA_PAIR is measured from the plaza's centre: the town moved when the countryside grew round it)
    const from = (d: Pt): Pt => ({ x: plaza.x + d.x, y: plaza.y + d.y });
    return { resident: from(PLAZA_PAIR.resident), player: from(PLAZA_PAIR.player), backdrop: { x: plaza.x, y: plaza.y, h: 1.2 } };
  }
  const p = placeOf(world, at);
  if (!p) return null;
  const resident = centre(p.spot);
  // the wall the door is in, and a point of it half way up (the building behind the two)
  const wall = p.face === 'x' ? { x: p.x + p.w, y: p.y + p.d / 2 } : { x: p.x + p.w / 2, y: p.y + p.d };
  if (at === 'friend' && residentId === 'friend') {
    // Mia at her window: close to the wall
    if (p.face === 'x') resident.x = wall.x + 0.3;
    else resident.y = wall.y + 0.3;
  }
  // the player beside them on the screen (along (1, −1): the default view looks from +x+y), never in front of or
  // behind them: on open ground, out of every house, on the side of the door
  const door = centre(p.door);
  const sides = [1, -1]
    .map((k) => ({ x: resident.x + k * SIDE_STEP, y: resident.y - k * SIDE_STEP }))
    .filter((c) => walkable({ x: Math.floor(c.x), y: Math.floor(c.y) }, world) && !world.places.some((q) => c.x >= q.x - 0.1 && c.x < q.x + q.w + 0.1 && c.y >= q.y - 0.1 && c.y < q.y + q.d + 0.1))
    .sort((a, b) => Math.hypot(a.x - door.x, a.y - door.y) - Math.hypot(b.x - door.x, b.y - door.y));
  const player = sides[0] ?? door;
  return { resident, player, backdrop: { x: wall.x, y: wall.y, h: 1.4 } };
}

/** How far the player stands from the resident along each axis outside (1.06 tiles apart: TALK_GAP of engine/sim). */
const SIDE_STEP = 0.75;

/**
 * The doorway of a room in the town: its place's door (Leo's pavilion for 'square'), or the boarding house's for
 * 'inn'. Null for a room with no door in this world (a small test world).
 */
export function doorwayOf(world: TownWorld, room: string): Doorway | null {
  if (room === 'inn') {
    const inn = world.life?.inn;
    if (!inn) return null;
    const door = inn.door;
    // the boarding house's door is on its +y face (data/townWorld.ts WORLD_PROPS)
    const beside = [{ x: door.x + 1, y: door.y }, { x: door.x - 1, y: door.y }].find((t) => walkable(t, world));
    return { door: { ...door }, out: Math.PI / 2, beside: beside ? centre(beside) : { x: door.x + 0.5, y: door.y + 1.5 } };
  }
  const p = placeOf(world, room);
  if (!p) return null;
  return { door: { ...p.door }, out: outward(p.face), beside: centre(p.spot) };
}

/** Where the player stands when the talk begins: in front of the room's door, or their spot outside. Null = unknown. */
export function playerStand(world: TownWorld, setting: TalkSetting, residentId: string): Pt | null {
  if (setting.kind === 'here') return null;
  if (setting.kind === 'inside') {
    const d = doorwayOf(world, setting.room);
    return d ? centre(d.door) : null;
  }
  return outsideSpots(world, setting.at, residentId)?.player ?? null;
}

/** Two settings are the same staging. */
export function sameSetting(a: TalkSetting | null, b: TalkSetting | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'here' || b.kind === 'here') return a.kind === b.kind;
  if (a.kind === 'inside' && b.kind === 'inside') return a.room === b.room;
  if (a.kind === 'outside' && b.kind === 'outside') return a.at === b.at;
  return false;
}

/**
 * The resident of `residentId`, standing at `at`, is out in the town: more than STREET_FAR tiles from where a talk at
 * `setting` would put the player. False when that place is unknown in this world (the talk happens where it happens).
 */
export function metInStreet(world: TownWorld, setting: StorySetting, residentId: string, at: Pt): boolean {
  const stand = playerStand(world, setting, residentId);
  return !!stand && Math.hypot(at.x - stand.x, at.y - stand.y) > STREET_FAR;
}

/**
 * The most of a resident's walk (seconds) the player stands watching at a talk's spot outside before it begins (owner,
 * 2026-11-28: "tao bấm vào nhà rồi phải đợi một đống thời gian cho bà già đi về nhà?"). The resident sets off when the
 * talk is asked for; at the player's arrival, a walk shorter than this is waited for (it looks natural), a longer one
 * (or a wait gone past TALK_WAIT_MOST) ends in a short dip with the resident there.
 */
export const TALK_WALK_WATCH = 2;
/** The longest the player stands at the spot in any case (seconds; somebody stopped short behind a crowd). */
export const TALK_WAIT_MOST = 2.5;

/** At a talk's spot outside, the player there: wait for the resident a moment more, or bring them in through a dip. Pure. */
export function outsideTalkStep(walkSecondsLeft: number, waited: number): 'wait' | 'dip' {
  return walkSecondsLeft > TALK_WALK_WATCH || waited > TALK_WAIT_MOST ? 'dip' : 'wait';
}
