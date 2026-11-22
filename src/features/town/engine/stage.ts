// The contract between the town page (TownPage.tsx) and its stage: what the page tells the stage, what the stage
// tells back, and what the page may ask of it. The stage is the real-time 3D town (three/TownStage3D.tsx); when this
// browser cannot draw it, the same component with `flat` (no canvases) keeps the page working without a world.

import type { ReactNode, Ref } from 'react';
import type { ActivitySpotId, PlaceId, Tile } from '../../../data/townWorld';
import type { EmoteKind } from './draw/overlay';
import type { Marker, StageState } from './sim';
import type { TalkSetting } from './staging';

export type { EmoteKind } from './draw/overlay';
export type { Marker, StageState } from './sim';
export type { TownTheme } from './palette';

export type BurstKind = 'confetti' | 'coins' | 'sparkle';
/** Who or where: the player, a place's resident, or a point of the stage in CSS pixels. */
export type StageTarget = 'player' | PlaceId | { x: number; y: number };

/** What the player stands next to: a resident to talk to, the gate of an empty lot, or an activity's spot. */
export type Near = { kind: 'resident'; placeId: PlaceId } | { kind: 'lot'; placeId: PlaceId } | { kind: 'activity'; id: ActivitySpotId } | null;

/** A short animation a person plays once: a nod (yes), a head shake (no), a wave. */
export type ActKind = 'yes' | 'no' | 'wave';

/** Where somebody stands now, for the map (features/town/map): a point of the tile grid. */
export interface MapResident {
  id: PlaceId;
  x: number;
  y: number;
  /** What floats over their head (the stage's state). */
  marker: Marker | null;
  /** Indoors (out of sight): shown faintly where they went in. */
  inside: boolean;
}

/** What the map reads from the stage every frame while it is on the screen. */
export interface MapSnapshot {
  /** The player: a point of the tile grid and the way the body faces (radians on the grid, atan2(dy, dx)). */
  player: { x: number; y: number; heading: number };
  /** The residents in town (all of them from the first day; lodgers at the boarding house). */
  residents: readonly MapResident[];
  /** Where the player is walking to (the ring on the ground), if anywhere. */
  goal: Tile | null;
  /** The camera's yaw (cameraRig: it stands at this heading from what it looks at): the minimap turns with it. */
  cameraYaw: number;
  /** A room is on the stage instead of the town (a talk indoors), or a dip to dark is under way. */
  away: boolean;
}

/** Somewhere the map sends the player: a place's door, a resident, an activity's spot, a tile of the ground. */
export type TravelTarget = { kind: 'place'; id: PlaceId } | { kind: 'resident'; id: PlaceId } | { kind: 'activity'; id: ActivitySpotId } | { kind: 'tile'; x: number; y: number };

/** 'walk': the normal click walk there; 'warp': a short dip to dark and the player is there, the camera with them. */
export type TravelMode = 'walk' | 'warp';

export interface EngineCallbacks {
  /** `inPerson`: the resident themself was clicked (or E beside them), not their house. */
  onTalk?: (placeId: PlaceId, inPerson: boolean) => void;
  onLot?: (placeId: PlaceId) => void;
  onNear?: (near: Near) => void;
  /** Enter / E / Space with nobody beside the player. */
  onIdleAct?: () => void;
  /** The player got to an activity's spot after clicking it (or pressed E there). */
  onActivity?: (id: ActivitySpotId) => void;
  /** A talk being walked to (talkAt) was given up: the learner clicked elsewhere or took the keys. */
  onTalkCancel?: () => void;
}

/** Parts of the stage covered by the game's own buttons (CSS px from each edge): tags and the camera keep clear. */
export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TownStageHandle {
  /**
   * Stage a talk with a place's resident where it happens (docs/town.md §7 "Staging"): both walk there (to the room's
   * door, then a dip to dark into the room; or to the place's front), and `ready` runs once they are in place (the panel
   * opens then); 'here': where the resident stands, met in the street. `visitor`: a neighbour in the room too; `instant`: there at once (a link). False = no world (open the
   * panel at once).
   */
  talkAt: (placeId: PlaceId, setting: TalkSetting, opts: { visitor?: PlaceId | null; instant?: boolean }, ready: () => void) => boolean;
  /** The talk is over: out of the room through the dark, or the camera back on the player. */
  endTalk: () => void;
  /** A little picture popping up over somebody's head. */
  emote: (target: 'player' | PlaceId, kind: EmoteKind) => void;
  /** Somebody plays a short animation once: a nod ('yes'), a head shake ('no'), a wave. Nothing under reduced motion. */
  act: (target: 'player' | PlaceId, anim: ActKind) => void;
  /** Particles at somebody or at a point of the stage (CSS pixels); coins fly on to `to`. */
  burst: (kind: BurstKind, at: StageTarget, to?: { x: number; y: number }) => void;
  /** Walk to a place's resident (or to the gate of its empty lot), then call back. False = no way there. */
  walkTo: (placeId: PlaceId, then?: () => void) => boolean;
  /** Walk to an activity's spot (the pier, the farm field…), then call back. False = no way there. */
  walkToActivity: (id: ActivitySpotId, then?: () => void) => boolean;
  /** Where somebody's head is on the stage, in CSS pixels (to hang a bubble on); null when they are not in town. */
  pointOf: (target: 'player' | PlaceId) => { x: number; y: number } | null;
  /** A short text with a coin rising over somebody's head ("+3"). */
  float: (target: 'player' | PlaceId, text: string) => void;
  /**
   * A place was just built or a decoration bought: the camera goes there and the thing pops out of the ground.
   * Returns the seconds until it appears (0 under reduced motion).
   */
  celebrate: (id: string) => number;
  /** Put the keyboard on the stage (after a panel closed). */
  focus: () => void;
  /** The stage's own box (to put it full screen); null before it is on the page. */
  box: () => HTMLDivElement | null;
  /** Where the stage is in the window (to place things relative to it); null before it is on the page. */
  rect: () => DOMRect | null;
  /** The map's live read (features/town/map): where everybody is, which way the camera looks. Null = no world (flat, not built yet). */
  mapSnapshot: () => MapSnapshot | null;
  /**
   * The map sends the player somewhere: walk there (the click walk; whoever is walked up to waits) or warp (a short
   * dip to dark, the player at the door / beside the resident / at the spot, the camera on them; residents stay
   * where they are). `then` runs on arrival. False = no world, or no way there.
   */
  travelTo: (target: TravelTarget, mode: TravelMode, then?: () => void) => boolean;
  /**
   * The fishing panel's phase (activities/fish PondPhase; null = the panel closed) and the tier of the fish on the
   * line: the player fishes at the end of the pier in the world, the float, bite, catch or escape on the water.
   */
  fishing: (phase: FishStagePhase | null, tier: string | null) => void;
}

/** The fishing panel's phases as the stage shows them. */
export type FishStagePhase = 'idle' | 'waiting' | 'bite' | 'listening' | 'caught' | 'escaped';

export interface TownStageProps {
  state: StageState;
  /**
   * A resident (or their house) was clicked, or Enter / E pressed beside them: the page stages the talk (talkAt).
   * `inPerson`: the resident themself, not their house (met in the street, the talk may happen right there).
   */
  onTalk?: (placeId: PlaceId, inPerson: boolean) => void;
  /** The player reached the gate of an empty lot after clicking it, or pressed Enter there. */
  onLot?: (placeId: PlaceId) => void;
  /** Who the player now stands next to (null = nobody): lets the shell offer "Nói chuyện" / "Xây". */
  onNear?: (near: Near) => void;
  /** Enter / E / Space was pressed with nobody beside the player. */
  onIdleAct?: () => void;
  /** The player reached an activity's spot after clicking it, or pressed E there. */
  onActivity?: (id: ActivitySpotId) => void;
  /** A talk being walked to was given up (a click elsewhere, the keys). */
  onTalkCancel?: () => void;
  /** The town is on the screen (its first frame is drawn): the page may open a linked conversation over it. */
  onReady?: () => void;
  /** The 3D town could not be made after all (no graphics context, a lost one that did not come back). */
  onFail?: () => void;
  /** Whose line is sounding now (a resident, or 'player' for the learner's own lines of an episode): a bubble with moving bars over their head. */
  speaking?: string | null;
  /**
   * An episode's neighbour who drops in (episodeVisitor) is in the room now: false until their first line of the pass
   * being played, then they walk in (docs/town.md §7 "Staging"). Default true.
   */
  visitorIn?: boolean;
  /** CSS pixels of the stage covered by a panel, from its right and bottom edges: the camera centres in the rest. */
  inset?: { right?: number; bottom?: number };
  /** Input off (a conversation or a dialog is open). The town keeps moving. */
  paused?: boolean;
  /** CSS pixels along each edge under the game's own buttons: name tags keep out, the camera centres in the rest. */
  safe?: SafeInsets;
  /** The resident the page suggests next: always named (the camera never frames them: it follows the player). */
  hint?: PlaceId | null;
  /** The stage covers the window: on a big screen the camera shows the whole built town. */
  full?: boolean;
  /** A short text kept over an empty lot, by place id (e.g. its price: "20 xu"). Without it a lot shows its name under the pointer only. */
  lotLabels?: Readonly<Record<string, string>>;
  /** Show the whole town at once instead of following the player. */
  overview?: boolean;
  /** Where the player stands when the stage opens (default: where they were this session, else the plaza). */
  startAt?: Tile;
  /** For screen readers: what this picture is. */
  label?: string;
  className?: string;
  /** Drawn over the canvas, inside the stage's box (a counter, a speech bubble): position them absolutely. */
  children?: ReactNode;
  ref?: Ref<TownStageHandle>;
}
