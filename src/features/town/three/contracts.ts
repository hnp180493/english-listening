// Contract of the real-time 3D town (three.js): the scene/renderer and the characters are built by different hands.
// World units: 1 unit = 1 tile edge of data/townWorld.ts; ground plane is XZ (three X = tile x, three Z = tile y),
// Y is up. Character feet stand at y = 0 on their tile position. Headings are radians on the ground plane measured
// from +X towards +Z (Math.atan2(dz, dx)).
//
// Everything is drawn in code (no model files): soft, rounded, pastel low-poly in one style, animated every frame.

import type { Group, Object3D, Vector3 } from 'three';

/** Who a character is: the player, a resident (by place id), or a nameless passer-by / child. */
export type CharacterId = 'player' | string;

/** What a character is doing; the controller blends between actions (no pops). */
export type CharAction = 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'yes' | 'no' | 'talk' | 'drink' | 'water' | 'fish' | 'read' | 'cheer';

export interface HairSpec {
  style: 'short' | 'bob' | 'long' | 'bun' | 'ponytail' | 'curly' | 'bald' | 'spiky' | 'pigtails';
  color: string;
}

/** The look of one person (colours are CSS hex strings). */
export interface CharacterLook {
  skin: string;
  hair: HairSpec;
  top: string;
  bottom: string;
  shoes: string;
  /** e.g. 'glasses', 'sunglasses', 'apron', 'cap', 'coat', 'tie', 'scarf', 'beard' */
  extras?: readonly string[];
  /** 1 = adult; children about 0.75. */
  scale?: number;
  /** Which face (chars/face.ts FACE_PRESETS). Left out: one of the old four, from 'lashes' / 'freckles'. */
  face?: number;
  /** The head's shape (default round). */
  head?: 'round' | 'oval' | 'wide' | 'long';
}

export interface Character3D {
  readonly id: CharacterId;
  /** Add this to the scene. Its origin is the feet. */
  readonly root: Group;
  /** Turn to face this heading; the controller eases the turn. `instant` skips easing (spawn). */
  setHeading(rad: number, instant?: boolean): void;
  /** Start an action. One-shot actions (wave, yes, no, cheer) return to the previous loop when done. */
  setAction(action: CharAction): void;
  /** Duration (s) of a one-shot action, for callers that wait on it. */
  actionDuration(action: CharAction): number;
  /** Advance the animation. `speed` = ground speed in tiles/s (drives the walk cycle: no foot sliding). */
  update(dt: number, speed: number): void;
  /** World position of the top of the head (for name tags, bubbles, emotes, hats). */
  headTop(target: Vector3): Vector3;
  /** Equip or remove a hat (loot ids of data/townGame.ts) and an outfit colour (hex) for the top. */
  setHat(hatId: string | null): void;
  setOutfit(color: string | null): void;
  /** Blink, look-at and small idle life are automatic; this points the head toward a world point (null = forward). */
  lookAt(point: Vector3 | null): void;
  /** Soft night tint 0 (day) … 1 (night) for materials that need it. */
  setNight(amount: number): void;
  dispose(): void;
}

export interface Pet3D {
  readonly id: string;
  readonly root: Object3D;
  setHeading(rad: number, instant?: boolean): void;
  update(dt: number, speed: number): void;
  dispose(): void;
}

/** The characters module (three/characters.ts) exports these. */
export interface CharactersModule {
  createCharacter(id: CharacterId, look?: CharacterLook): Character3D;
  /** Pets of data/townGame.ts (dog, duck, rabbit, …) and the town cat ('cat'). */
  createPet(petId: string): Pet3D;
  /** The cast: the player and the 13 residents (by place id), each recognisable at a glance. */
  castLook(id: CharacterId): CharacterLook;
  /** A random-but-seeded look for passers-by and children. */
  passerLook(seed: number, child?: boolean): CharacterLook;
  /** Render a portrait (head and shoulders, 3/4 front) to a canvas, for the conversation panel and the wardrobe. */
  renderPortrait(id: CharacterId, size: number, mood?: 'neutral' | 'happy', opts?: { hat?: string | null; outfit?: string | null }): HTMLCanvasElement;
}
