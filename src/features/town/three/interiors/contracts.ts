// Contract of the town's interiors: every conversation happens somewhere that fits it (owner, 2026-11-21: "quán cà
// phê gì ở ngoài đường?"). An episode or quick chat names its SETTING (core/town/story.ts StorySetting); for an
// 'inside' setting the stage fades from the town into that place's room, plays the conversation there, and fades back.
//
// Rooms are built in code in the town's style (rounded, pastel, soft light) by three/interiors/rooms.ts. Units: 1 unit =
// 1 tile of the town (a person is about 0.79 units tall). The room's floor is the XZ plane at y = 0, origin at the
// room's centre; the open side (no wall) faces +X+Z so a camera at 45° yaw looks in like a doll's house.

import type { Group, Vector3 } from 'three';

/** A place's room: the 13 place ids of data/town.ts plus the boarding house. */
export type InteriorId =
  | 'square' // Leo's pavilion office / community room
  | 'cafe'
  | 'friend'
  | 'home'
  | 'shop'
  | 'office'
  | 'school'
  | 'station'
  | 'clinic'
  | 'cinema'
  | 'phone'
  | 'park'
  | 'board'
  | 'inn'
  // the learner's own room in Westbay (data/city/hideout.ts): nobody lives there but them (no host in the room)
  | 'hideout'
  // warehouse fifteen on Westbay's harbour (data/city/warehouses.ts): a job's room, its people the job's own
  | 'warehouse15';

/** Where someone stands, sits or works in a room. `heading` = radians on the ground plane, atan2(dz, dx). */
export interface RoomAnchor {
  x: number;
  z: number;
  heading: number;
  /** 'stand' | 'sit' (seat top height in units) | 'behind-counter'. */
  pose: 'stand' | 'sit' | 'counter';
  seatY?: number;
}

export interface RoomShot {
  /** Camera position and look-at point, in room coordinates; fov in degrees. */
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface InteriorSet {
  readonly id: InteriorId;
  /** Add this to its own scene (the stage swaps scenes during the fade). */
  readonly root: Group;
  /** Where the resident of the conversation is (e.g. Emma behind the counter). */
  readonly host: RoomAnchor;
  /** Where the learner's character stands for the conversation (facing the host). */
  readonly guest: RoomAnchor;
  /** Where a third speaker stands when a neighbour drops in (StoryLine.who = another place id). */
  readonly visitor: RoomAnchor;
  /** Seats/spots for 0–4 background people (other customers, patients, pupils), drawn from passer-by looks. */
  readonly extras: readonly RoomAnchor[];
  /** The conversation shot framing host and guest (wide stage), and a closer one for a phone (tall stage). */
  readonly shot: RoomShot;
  readonly shotTall: RoomShot;
  /** Day 0 … night 1: window light, lamps, warm interior glow. */
  setNight(amount: number): void;
  /** Small life: steam from cups, a ceiling fan, a flickering screen, a clock. */
  update(dt: number): void;
  dispose(): void;
}

/** three/interiors/rooms.ts exports this. Rooms are cheap to build (< 30 ms) and cached by the stage. */
export interface InteriorsModule {
  buildInterior(id: InteriorId): InteriorSet;
}

export type { Vector3 };
