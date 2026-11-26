// The 3D town's engine: the town's simulation (engine/sim.ts: walking, schedules, conversations, who
// stands near whom) drawn with three.js. It owns the renderer, the camera, the characters (three/characters.ts),
// the overlay canvas (name tags, bubbles, emotes, particles in screen pixels, engine/draw/overlay.ts) and the sky
// canvas behind, and offers what the page asks of its stage (engine/stage.ts TownStageHandle) through TownStage3D.

import { ACESFilmicToneMapping, BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PCFShadowMap, PerspectiveCamera, Raycaster, RingGeometry, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, type Object3D } from 'three';
import { prefersReducedMotion } from '../../../../core/motion';
import { collidersIn, findPath, nearestWalkable, walkable } from '../../../../core/town/map';
import { lootItem } from '../../../../data/townGame';
import { TOWN_WORLD, type ActivitySpotId, type PlaceId, type Tile, type TownWorld } from '../../../../data/townWorld';
import { ACTIVITIES } from '../../activities/types';
import { thingName } from '../../scenes/things';
import { cameraDt, springStep } from '../../engine/spring';
import { drawChatDots, drawEmote, drawFloat, drawParticles, drawSky, drawTag, drawTalkBubble, drawVignette, EMOTE_SECONDS, FLOAT_SECONDS, placeTags, tagSize, type EmoteKind, type TagBox } from '../../engine/draw/overlay';
import type { ActKind, BurstKind, EngineCallbacks, Near, SafeInsets, StageTarget, TravelTarget } from '../../engine/stage';
import { drawEdgeArrow, drawTargetArrow, drawWay, edgeArrow, metres, wayDots } from '../../engine/draw/guide';
import type { VehicleKind } from '../../../../data/townWorld';
import { RIDES, vehicleGeometry } from './vehicles3d';
import { Birds } from './birds';
import { paletteFor, type TownPalette } from '../../engine/palette';
import { Particles } from '../../engine/particles';
import { bodyFits, gridDistance, PLAYER_RADIUS, TownSim, type Actor, type Folk, type Resident, type StageState } from '../../engine/sim';
import { createCharacter, createPet, passerLook, type Character3DPlus } from '../characters';
import { dressInVrm, dressWhenNear } from '../chars/vrmPeople';
import type { CharAction, Character3D, Pet3D } from '../contracts';
import { cameraPosition, fitDistance, followLead, followStiffness, FOLLOW_W, followPoint, FOV, groundHalfExtent, HOLD_RUN, holdDirection, insetShift, keyDirection, PITCH, restDistance, YAW0, yawAfter, zoomAfter } from './cameraRig';
import { angleDiff, headingOf, octantHeading, towardViewer, type P3 } from './coords';
import { WARP_FAR } from '../../map/mapCard';
import { pick3, stickyTile, type Hit3, type PickBox, type PickPerson, type Ray } from './pick3d';
import { lightRig } from './palette3d';
import { SEAT_TOP } from './props3d';
import { TownScene, type Built } from './world3d';
import { doorwayOf, outsideSpots, sameSetting, type Doorway, type OutsideSpots, type TalkSetting } from '../../engine/staging';
import { buildInterior, isInteriorId, type InteriorId, type RoomSet } from '../interiors/rooms';
import { RoomStage } from './roomStage';
import { FishShow, pierWalk, type FishPhase } from './fishShow';
import { tl, tr } from '../../../../i18n';

export type { ActKind, BurstKind, Near, SafeInsets, StageTarget } from '../../engine/stage';

const DAY_PAL = paletteFor('day');
const NIGHT_PAL = paletteFor('night');
const EMPTY_STATE: StageState = { built: [], decorations: [], lit: {}, marker: {}, theme: 'day' };
/** Kept for the session: coming back puts the player where they were. */
/** (by the map's rows: the city with other guests is another world object, the same map) */
const lastPlayerTile = new WeakMap<readonly string[], Tile>();

const ZOOM_W = 6;
/**
 * A special shot the learner asked for (a conversation, a new building, the overview) and the way back from it: a
 * glide with a spring of GLIDE_W, softer still further than FAR_TILES (down to FAR_W), so a long way is a glide of
 * about a second, never a whoosh or a cut; back on the player the spring firms up to FOLLOW_W over FIRM_SECONDS.
 */
const GLIDE_W = 7;
const FAR_TILES = 3;
const FAR_W = 3.5;
const FIRM_SECONDS = 0.6;
/** The player's pace as the camera reads it is smoothed this quickly (1/s): the lead ahead of a walker never twitches. */
const PACE_SMOOTH = 40;
/** Residents within this (tiles) of the player are near enough to talk to (E, the main button). */
const TALK_REACH = 1.6;
/** An activity's spot or a lot's gate within this (tiles) of the player counts as where they stand. */
const SPOT_REACH = 0.8;
/** The hovered square and the goal ring float this high over the ground (over the plaza's slabs and the cobbles). */
const MARK_Y = 0.055;
/** While the pointer rests, what is under it is looked at again this often (s): somebody may walk under it. */
const REPICK_SECONDS = 0.25;
/**
 * The player's body turns on the screen this quickly (a spring a touch under critical, 1/s: chars/anim.ts turnZeta):
 * close behind the sim's own turn, easing in and swinging a few degrees past.
 */
const PLAYER_TURN_W = 26;
/** A runner (the gait's run share above this) kicks up a little puff of dust at each footfall. */
const PUFF_RUN = 0.55;
const TALK_HOLD_FRAMES = 3;
const TALK_HOLD_SECONDS = 0.12;
const SAY_SECONDS = 1.7;
const PET_BEHIND = 0.85;
const BUILD_APPEAR = 0.85;
const BUILD_HOLD = 2.7;
const POP_SECONDS = 0.55;
const POP_STAGGER = 0.11;
const DIM_RATE = 5;
const SKY_EVERY = 1 / 15;
/** Within this (2D screen distance on the grid, world px) a resident shows their name. */
const NAME_NEAR = 118;
/** A conversation is seen from lower down (radians): faces show under a hat's brim, the two stand against the town. */
const TALK_PITCH = (26 * Math.PI) / 180;
/** In a conversation the two look at a point this share of the way from the other's head to the camera. */
const TALK_LOOK_CAMERA = 0.35;
/**
 * A conversation frames both people whole in what the panel leaves free: on a phone that strip is short, so the
 * camera may stand back this much (of the resting distance) rather than cut a head or a foot off.
 */
const TALK_MAX = 1.6;
/** While a panel is over the town and nothing glides, a frame is drawn at most this often (ms): about 30 a second. */
const PAUSED_FRAME_MS = 30;
/** The first seconds (shaders, people made, pictures decoded) do not count towards the device's pace. */
const WARM_SECONDS = 3;
/** After a panel opens or something is bought, frames do not count for this long (s). */
const QUIET_SECONDS = 1.5;
/** A single frame longer than this is the main thread busy with something else, not the device's pace (s). */
const STALL_SECONDS = 0.1;
/** The day turns to night (and back) over about this many seconds. */
const NIGHT_RATE = 1.6;
/** Into a room and out of it (docs/town.md §7 "Staging"): a dip to dark this long (s) each way, and a moment held dark. */
const FADE_OUT = 0.35;
const FADE_IN = 0.35;
const FADE_HOLD = 0.14;
/** The colour of the dip (deep blue, darker than any night of the town). */
const FADE_RGB = '13,15,32';
/** The player waits at a talk's spot outside at most this long (s) for the resident to walk up before they are put there out of sight. */
const WAIT_UNSEEN = 2.5;
/** …and this long whether seen or not (the last resort: somebody stuck behind a crowd). */
const WAIT_MOST = 9;
/** A resident walking to a talk who stood still this long (s) without getting there sets off again. */
const RETRY_SECONDS = 1.2;
/** After a talk in a room the resident stays in there this long (s) before everyday life brings them out. */
const STAY_INSIDE = [3, 8] as const;
/** Work done in one go while the town is prepared, before the next frame is let through (ms). */
const BOOT_SLICE_MS = 30;
/** Rooms kept made after a visit (the café's, made while the town loads, is one of them until three others were used). */
export const ROOMS_KEPT = 3;

/**
 * A talk whose setting is further than this from the player (tiles, as the crow flies: the map's WARP_FAR) is reached
 * through the dark (a dip, both put in place), never by a walk of ten seconds and more.
 */
/** A small stable number from a text (a child's seeded look). */
function hashOf(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function talkIsFar(player: { x: number; y: number }, stand: { x: number; y: number }): boolean {
  return Math.hypot(stand.x - player.x, stand.y - player.y) > WARP_FAR;
}

/** A talk being staged (docs/town.md §7 "Staging"): where, and how far along. */
interface Staged {
  placeId: PlaceId;
  setting: TalkSetting;
  /** A neighbour who is in the room too (an episode's visitor), by place id. */
  visitor: PlaceId | null;
  /**
   * 'go': both walk there; 'enter': the dip to dark before the room; 'room': talking in the room; 'outside': talking in
   * the town; 'cut': a dip to dark into another setting (a quick chat after an episode, a link); 'leave': the dip out.
   */
  phase: 'go' | 'enter' | 'room' | 'outside' | 'cut' | 'leave';
  ready: (() => void) | null;
  doorway: Doorway | null;
  spots: OutsideSpots | null;
  /** The player got to their spot (engine seconds; -1 = not yet). */
  arrivedAt: number;
  retryAt: number;
  /** The resident was sent inside out of sight when the walk began (a cancel lets them out again soon). */
  hid: boolean;
  /** Given up (Esc, a click elsewhere) while the dip to dark was under way. */
  cancelled: boolean;
}

interface Emote {
  target: 'player' | PlaceId;
  kind: EmoteKind;
  born: number;
}
interface FloatText {
  target: 'player' | PlaceId;
  text: string;
  born: number;
}
interface Showcase {
  at: P3;
  dist: number;
  until: number;
}
interface Person {
  ch: Character3D;
  action: CharAction;
  /** A one-shot action running until (engine seconds). */
  oneShot: number;
  last: { x: number; y: number };
  /** The pace the legs are given (the sim's own, tiles/s). */
  speed: number;
  heading: number;
  /** Where the body is drawn: the sim's spot, eased over a small hop (onto a seat backwards, up off it). */
  rx: number;
  rz: number;
  /** A slide in progress (0…1, 1 = none): from (fx, fz) to (sx, sz). */
  fx: number;
  fz: number;
  sx: number;
  sz: number;
  slide: number;
  /** The slide is onto a seat (1), up off one (-1), or neither (0); seated now, and last frame. */
  seatHop: number;
  seated: boolean;
  wasSeated: boolean;
  /** Walking as far as the animation is concerned (hysteresis: no walk ↔ idle flicker), and how long it has been slow. */
  walking: boolean;
  slowFor: number;
  /** A one-shot waiting for the body to turn the right way first (a wave at somebody), at most until pendingUntil. */
  pending: CharAction | null;
  pendingUntil: number;
  /** Footfalls of the gait seen so far (a runner puffs dust at each new one). */
  falls?: number;
}

/** Walking starts above this pace and ends below WALK_OFF held for WALK_OFF_TIME (tiles/s, s). */
const WALK_ON = 0.15;
const WALK_OFF = 0.05;
const WALK_OFF_TIME = 0.2;
/** A one-shot waits at most this long (s) for the body to turn toward where it is aimed. */
const SHOT_TURN_WAIT = 0.7;
/** "Đến ngay" is offered on a click walk with more than HURRY_FROM tiles to go, and kept until HURRY_UNTIL are left. */
const HURRY_FROM = 6;
const HURRY_UNTIL = 1.5;
/** In a conversation the two face each other fully this long (s) (the greeting), then turn a little to the viewer. */
const TALK_GREET = 2.2;
const TALK_TOWARD_VIEWER = 0.85;

/** Seated, the hips this far forward of the seat point (tiles): the knees over the front edge, the back off the rest. */
const SEAT_FORWARD = 0.08;
/** Straight up (the markers' resting normal). */
const UP_Y = new Vector3(0, 1, 0);
/** Backing onto a seat, stepping off it (a hop of the drawn body while the sim has them stand): this long (s). */
const SLIDE_TIME = 0.45;

/** Stats for checking the town in a dev build (headless runs read window.__town3d). */
export interface Stats3D {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  pixelRatio: number;
  /** The engine's own work per frame (sim, people, camera, overlay; not the GPU), ms, smoothed. */
  cpuMs: number;
  shadows: boolean;
  ready: boolean;
}

/** A room's exposure by night amount (its own lamps light it: a touch brighter at night, as the rooms were made for). */
// a room's exposure: the town's by day (DAY_RIG 0.9), so a face or a shirt is the same colour inside and out
const roomExposure = (night: number) => 0.92 + 0.12 * night;

const smoothstepK = (a: number, b: number, t: number): number => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

const easeOutBack = (k: number) => {
  const c = 1.6;
  const x = k - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

export class TownEngine3D {
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly octx: CanvasRenderingContext2D;
  private readonly skyCanvas: HTMLCanvasElement | null;
  private readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  readonly town: TownScene;
  readonly sim: TownSim;
  private readonly world: TownWorld;
  private cb: EngineCallbacks;
  /** A click walk long enough for "Đến ngay" is under way (told to the page: onFarWalk). */
  private farWalk = false;
  private state: StageState = EMPTY_STATE;
  private pal: TownPalette = paletteFor('day');
  private readonly particles = new Particles();
  private people = new Map<string, Person>();
  private pet: { kind: string; p: Pet3D; x: number; y: number; walking: boolean; heading: number } | null = null;
  /** The learner's children walking behind the player (StageState.kids, docs/town.md §15). */
  private kids: { key: string; ch: Character3D; x: number; y: number; walking: boolean; heading: number; action: CharAction }[] = [];
  private trail: { x: number; y: number }[] = [];
  private viewW = 1;
  private viewH = 1;
  private dpr = 1;
  private prCap = 2;
  private raf = 0;
  private last = 0;
  private t = 0;
  private frames = 0;
  private frameDt = 1 / 60;
  private running = false;
  private visible = true;
  private still = prefersReducedMotion();
  private paused = false;
  private first = true;
  private ready = false;
  private onReady: (() => void) | null = null;
  // camera
  private target: P3 = { x: 0, y: 0, z: 0 };
  private targetV = { x: 0, z: 0 };
  private yV = 0;
  private dist = 16;
  private distV = 0;
  private yaw = YAW0;
  private yawGoal = YAW0;
  private yawV = 0;
  /** How far down the camera looks: lower in a conversation, so faces show under a hat brim. */
  private pitch = PITCH;
  private pitchV = 0;
  private zoomUser = 1;
  private shift = { x: 0, y: 0 };
  private shiftGoal = { x: 0, y: 0 };
  /** What the camera shows ('follow', 'talk', 'show', 'overview') and the spring it moves with now. */
  private camMode = 'follow';
  private camW = FOLLOW_W;
  /** The player's pace on the ground as the camera reads it (smoothed, tiles/s) and where they were last frame. */
  private pv = { x: 0, z: 0 };
  private lastP = { x: 0, y: 0 };
  private camHold = 0;
  private camHoldUntil = 0;
  // shell's asks
  private focus: PlaceId | null = null;
  private hint: PlaceId | null = null;
  /** What can be ridden (TownWorld.vehicles): where each is parked (or, the one ridden, drawn now), its model. */
  private rides: { kind: VehicleKind; x: number; y: number; heading: number; mesh: Mesh }[] = [];
  private ridesMade = false;
  /** Two flocks over the view by day (birds.ts). */
  private birds: Birds | null = null;
  /** The one the player rides (an index of `rides`), -1 = on foot. */
  private riding = -1;
  /** The quest followed (setGuide), its way (tile-grid points, found twice a second) and how long that is (tiles). */
  private guide: TravelTarget | null = null;
  private guideWay: { x: number; y: number }[] = [];
  private guideLen: number | null = null;
  private guideNext = 0;
  private full = false;
  private overview = false;
  private speaking: string | null = null;
  /** An episode's neighbour is in the room (setVisitorIn). */
  private visitorIn = true;
  private inset = { right: 0, bottom: 0 };
  private safe: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  private lotLabels: Readonly<Record<string, string>> = {};
  private emotes: Emote[] = [];
  private floats: FloatText[] = [];
  private says = new Map<string, number>();
  private pops = new Map<string, number>();
  private showcase: Showcase | null = null;
  private later: { at: number; run: () => void }[] = [];
  private dim = 0;
  private night = 0;
  private near: Near = null;
  private hover: Hit3 | null = null;
  /**
   * The pointer over the canvas (CSS px), null outside it; `pointerLive`: it has moved since the keys were last used
   * (the hovered square stays away until the mouse is used again). The camera the last pick was made with.
   */
  private pointer: { x: number; y: number } | null = null;
  private pointerLive = false;
  private pickedWith = { x: NaN, z: NaN, dist: NaN, yaw: NaN, pitch: NaN, sx: NaN, sy: NaN, at: -Infinity };
  private readonly keys = { up: false, down: false, left: false, right: false };
  private font = 'system-ui, sans-serif';
  private skyAt = -1;
  /** The night amount the sky was drawn for (-1: not yet). */
  private skyFor = -1;
  /** Night's sky while it is laid over day's (the theme changing), else null. */
  private skyBlend: HTMLCanvasElement | null = null;
  private readonly raycaster = new Raycaster();
  /** A finger held on the stage (CSS px), null = none (holdAt / holdEnd). */
  private hold: { x: number; y: number } | null = null;
  private readonly v = new Vector3();
  private readonly puffAt = { x: 0, y: 0 };
  private readonly puffWorld = { x: 0, y: 0, z: 0 };
  private readonly hoverMesh: Mesh;
  private readonly goalMesh: Mesh;
  private faded = new Set<Built>();
  /** The resident of the conversation the actors are staged for, and since when (engine seconds). */
  private talkWith: PlaceId | null = null;
  private talkSince = 0;
  private fadedNext = new Set<Built>();
  /** Measured name tags by their text (measureText once, not every frame). */
  private readonly tagSizes = new Map<string, { w: number; h: number }>();
  /** The activity spots, listed once. */
  private readonly activitySpots: readonly [ActivitySpotId, { stand: Tile }][];
  private slowFor = 0;
  private fastFor = 0;
  /** How many steps lighter than full the drawing is (setQuality). */
  private quality = 0;
  /** Frame times are not counted before this (engine seconds): see quiet(). */
  private quietUntil = WARM_SECONDS;
  private stats: Stats3D = { fps: 0, frameMs: 0, calls: 0, triangles: 0, pixelRatio: 1, cpuMs: 0, shadows: true, ready: false };
  private fpsAcc = { n: 0, sum: 0, at: 0 };
  /** The talk being staged, the room shown instead of the town (null: the town), the rooms made so far. */
  private staged: Staged | null = null;
  private room: RoomStage | null = null;
  private readonly rooms = new Map<string, RoomSet>();
  /** The fishing panel is open: the player out on the pier with the rod (fishShow.ts). */
  private fish: FishShow | null = null;
  private readonly fishLine = new Vector3();
  /** The dip to dark: how dark now (0…1), where it is going, held dark for a moment, what runs at the dark. */
  private fade = { k: 0, to: 0, hold: 0, dark: null as (() => void) | null };
  /** The follow's spring now (stiffer on a narrow stage: cameraRig followStiffness). */
  private followW = FOLLOW_W;
  /** The town's exposure now (day / night light rig); a room has its own (roomExposure). */
  private townExposure = 1;
  /** The name on the player's tag. */
  playerName = 'Bạn';

  constructor(canvas: HTMLCanvasElement, overlay: HTMLCanvasElement, sky: HTMLCanvasElement | null, cb: EngineCallbacks = {}, world: TownWorld = TOWN_WORLD, startAt?: Tile) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.skyCanvas = sky;
    const octx = overlay.getContext('2d');
    if (!octx) throw new Error('Canvas 2D không dùng được');
    this.octx = octx;
    this.cb = cb;
    this.world = world;
    this.activitySpots = Object.entries(world.activities ?? {}) as [ActivitySpotId, { stand: Tile }][];
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    // anything failing from here on would leave this context behind (a browser keeps only a few): free it, then fail
    try {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFShadowMap;
      this.prCap = Math.min(2, window.devicePixelRatio || 1);
      this.camera = new PerspectiveCamera(FOV, 1, 0.5, 300);
      // no fog: the island ends in the sky canvas behind it (a fog switched on or off later would rebuild every shader)
      this.town = new TownScene(world);
      this.sim = new TownSim(world, Math.random, startAt ?? lastPlayerTile.get(world.rows), { life: true });
      const ring = new RingGeometry(0.34, 0.44, 32);
      ring.rotateX(-Math.PI / 2);
      this.goalMesh = new Mesh(ring, new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      this.goalMesh.visible = false;
      this.goalMesh.renderOrder = 3;
      const sq = new RingGeometry(0.4, 0.5, 4, 1);
      sq.rotateZ(Math.PI / 4);
      sq.rotateX(-Math.PI / 2);
      this.hoverMesh = new Mesh(sq, new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      this.hoverMesh.visible = false;
      this.hoverMesh.renderOrder = 3;
      this.town.scene.add(this.goalMesh, this.hoverMesh);
    } catch (err) {
      this.renderer.dispose();
      try {
        if (!this.renderer.getContext().isContextLost()) this.renderer.forceContextLoss();
      } catch {
        // gone already
      }
      throw err;
    }
    try {
      this.font = getComputedStyle(canvas).fontFamily || this.font;
    } catch {
      // keep the fallback
    }
    const p = this.sim.player;
    this.target = { x: p.x, y: 0, z: p.y };
    if (import.meta.env.DEV) (window as unknown as { __town3d?: TownEngine3D }).__town3d = this;
  }

  setCallbacks(cb: EngineCallbacks): void {
    this.cb = cb;
  }

  /** Called once the first frame is on the screen (the stage then takes its loading card away). */
  whenReady(run: () => void): void {
    if (this.ready) run();
    else this.onReady = run;
  }

  get statistics(): Stats3D {
    return this.stats;
  }

  private colliderDebug: LineSegments | null = null;

  /**
   * Dev only (window.__town3d.debugColliders(true) in a headless check): the colliders of the town as it stands
   * (core/town/colliders.ts) drawn as red outlines on the ground, the tiles closed to the path finder as yellow
   * squares. Nothing in a production build.
   */
  debugColliders(on: boolean): void {
    if (!import.meta.env.DEV) return;
    if (this.colliderDebug) {
      this.town.scene.remove(this.colliderDebug);
      this.colliderDebug.geometry.dispose();
      (this.colliderDebug.material as LineBasicMaterial).dispose();
      this.colliderDebug = null;
    }
    if (!on) return;
    const pos: number[] = [];
    const col: number[] = [];
    const seg = (ax: number, ay: number, bx: number, by: number, h: number, c: [number, number, number]) => {
      pos.push(ax, h, ay, bx, h, by);
      col.push(...c, ...c);
    };
    const world = this.sim.world;
    for (let y = 0; y < world.size; y++) {
      for (let x = 0; x < world.size; x++) {
        if (walkable({ x, y }, world)) continue;
        const k = 0.08;
        const c: [number, number, number] = [1, 0.85, 0.1];
        seg(x + k, y + k, x + 1 - k, y + k, 0.04, c);
        seg(x + 1 - k, y + k, x + 1 - k, y + 1 - k, 0.04, c);
        seg(x + 1 - k, y + 1 - k, x + k, y + 1 - k, 0.04, c);
        seg(x + k, y + 1 - k, x + k, y + k, 0.04, c);
      }
    }
    for (const cl of collidersIn(world)) {
      const red: [number, number, number] = [1, 0.1, 0.15];
      for (const h of [0.06, 0.5]) {
        if (cl.kind === 'circle') {
          const n = 24;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const b = ((i + 1) / n) * Math.PI * 2;
            seg(cl.x + Math.cos(a) * cl.r, cl.y + Math.sin(a) * cl.r, cl.x + Math.cos(b) * cl.r, cl.y + Math.sin(b) * cl.r, h, red);
          }
        } else {
          seg(cl.x0, cl.y0, cl.x1, cl.y0, h, red);
          seg(cl.x1, cl.y0, cl.x1, cl.y1, h, red);
          seg(cl.x1, cl.y1, cl.x0, cl.y1, h, red);
          seg(cl.x0, cl.y1, cl.x0, cl.y0, h, red);
        }
      }
    }
    // the player's body
    const p = this.sim.player;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const b = ((i + 1) / 24) * Math.PI * 2;
      seg(p.x + Math.cos(a) * PLAYER_RADIUS, p.y + Math.sin(a) * PLAYER_RADIUS, p.x + Math.cos(b) * PLAYER_RADIUS, p.y + Math.sin(b) * PLAYER_RADIUS, 0.06, [0.1, 0.6, 1]);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    const m = new LineSegments(g, new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    m.renderOrder = 999;
    m.frustumCulled = false;
    this.colliderDebug = m;
    this.town.scene.add(m);
  }

  // ───────────────────────── state from the shell ─────────────────────────

  setState(state: StageState): void {
    this.state = state;
    this.pal = paletteFor(state.theme);
    this.sim.setState(state);
    // something was built or bought: the next lots on offer get their house made ahead too
    if (this.town.setLayout(state) && this.ready && !this.idleHandle) this.idle(() => this.prebuildLots());
    if (this.focus && !this.sim.residents.has(this.focus)) this.focus = null;
    if (this.first) this.night = state.theme === 'night' ? 1 : 0;
    const p = this.people.get('player');
    if (p && (state.body ?? '') !== this.playerBody) {
      // the learner changed their character (docs/town.md §15): the next frame makes the new one where they stand
      this.playerBody = state.body ?? '';
      p.ch.root.removeFromParent();
      p.ch.dispose();
      this.people.delete('player');
    } else if (p) this.dressPlayer(p.ch);
    this.playerBody = state.body ?? '';
    this.playerName = state.playerName || 'Bạn';
  }

  /** How far (tiles) from the camera's target people are drawn and animated (set each frame from the view). */
  private reach = Infinity;

  /** The player's look the model was made with (StageState.body). */
  private playerBody = '';

  setPaused(paused: boolean): void {
    if (paused !== this.paused) this.quiet();
    this.paused = paused;
    if (paused) {
      this.releaseKeys();
      this.setHover(null);
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible && this.running && this.booted && !this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  resize(cssW: number, cssH: number): void {
    const w = Math.max(1, Math.round(cssW));
    const h = Math.max(1, Math.round(cssH));
    const changed = w !== this.viewW || h !== this.viewH;
    this.viewW = w;
    this.viewH = h;
    this.dpr = Math.min(this.prCap, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.overlay.width = Math.round(w * this.dpr);
    this.overlay.height = Math.round(h * this.dpr);
    if (this.skyCanvas) {
      // the sky is soft: half resolution is plenty
      this.skyCanvas.width = Math.round(w * Math.min(1, this.dpr));
      this.skyCanvas.height = Math.round(h * Math.min(1, this.dpr));
      this.skyAt = -1;
    }
    this.camera.aspect = w / h;
    this.followW = followStiffness(w);
    this.applyInset(changed);
    if (changed) this.aim(0, true);
    if (this.running && this.booted) this.render();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    // shaders compiled before the first frame, with the lights as they will be (day or night only change numbers,
    // never which lights or effects exist): no hitch when the town shows or the theme changes
    this.applyNight();
    if (this.booted) this.raf = requestAnimationFrame(this.frame);
    else if (!this.booting) void this.boot();
  }

  /** The town's first frame is being prepared (people made, shaders compiled), behind the loading card. */
  private booting = false;
  private booted = false;
  private warmHandle = 0;

  /**
   * Before the first frame, in slices between frames (the loading card stays up and keeps moving; no long task): the
   * people of the town are made a few at a time, then every shader is compiled in the background (compileAsync: the
   * driver's parallel compile, nothing waits on it), and only then the first frame is drawn. The rooms' shaders follow
   * in idle time once the town shows (warmRooms).
   */
  private async boot(): Promise<void> {
    this.booting = true;
    const nextFrame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
    try {
      const actors: Actor[] = [this.sim.player, ...[...this.sim.residents.values()].filter((r) => !r.hidden), ...this.sim.folk.filter((f) => !f.hidden)];
      let since = performance.now();
      for (const a of actors) {
        if (!this.running) return;
        this.personFor(a);
        if (performance.now() - since > BOOT_SLICE_MS) {
          await nextFrame();
          since = performance.now();
        }
      }
      await nextFrame();
      if (!this.running) return;
      await this.precompile();
      if (!this.running) return;
      await this.firstDraws(this.town.scene, this.camera, nextFrame);
    } finally {
      this.booting = false;
    }
    if (!this.running) return;
    this.booted = true;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  /**
   * Each program's first draw costs the graphics driver something even once it is compiled (ANGLE finishes its work
   * on first use, and the shadow pass has programs of its own): before the first frame the town is drawn into one
   * pixel a few materials at a time, so that cost is spread over several short tasks instead of one long one.
   */
  private async firstDraws(scene: Scene, camera: PerspectiveCamera, nextFrame: () => Promise<void>, stop: () => boolean = () => !this.running): Promise<void> {
    const groups = new Map<string, Object3D[]>();
    const all: Object3D[] = [];
    scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh && !(o as Object3D & { isPoints?: boolean }).isPoints) return;
      all.push(o);
      const mat = m.material;
      const key = (Array.isArray(mat) ? mat.map((x) => x.uuid).join() : (mat?.uuid ?? '')) + ((o as Object3D & { isSkinnedMesh?: boolean }).isSkinnedMesh ? 's' : '') + (m.castShadow ? 'c' : '');
      const list = groups.get(key);
      if (list) list.push(o);
      else groups.set(key, [o]);
    });
    const shown = all.map((o) => o.visible);
    const r = this.renderer;
    let since = performance.now();
    try {
      for (const list of groups.values()) {
        for (const o of all) o.visible = false;
        for (const o of list) o.visible = true;
        r.setScissorTest(true);
        r.setScissor(0, 0, 1, 1);
        r.setViewport(0, 0, 1, 1);
        try {
          r.render(scene, camera);
        } catch {
          // drawn on the first frame then
        } finally {
          r.setScissorTest(false);
          r.setViewport(0, 0, this.viewW, this.viewH);
        }
        if (performance.now() - since > BOOT_SLICE_MS) {
          all.forEach((o, i) => (o.visible = shown[i]));
          await nextFrame();
          if (stop()) return;
          since = performance.now();
        }
      }
    } finally {
      all.forEach((o, i) => (o.visible = shown[i]));
    }
  }

  /** In idle time after the town shows: the rooms' shaders (once). */
  private warmLater(): void {
    const w = window as Window & { requestIdleCallback?: (run: () => void, o?: { timeout: number }) => number };
    const go = () => {
      this.warmHandle = 0;
      if (this.running && !this.room) void this.warmRooms();
    };
    this.warmHandle = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 4000 }) : window.setTimeout(go, 1200);
  }

  /**
   * Compile every shader the town will need, also those of things shown only later (the goal ring, the hovered
   * square, a house under the pointer or faded in front of the player, the windows of a place built later), so the
   * first click, hover or purchase never waits for the graphics driver.
   */
  private async precompile(): Promise<void> {
    const warm = new Group();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0], 3));
    geo.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    geo.setAttribute('color', new Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
    const m = this.town.mats;
    for (const mat of [m.std, m.hot, m.faded, m.glass(0), m.glass(1), m.bulb, m.water, m.sway, m.halo]) {
      const mesh = new Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      warm.add(mesh);
    }
    const shown = [this.goalMesh.visible, this.hoverMesh.visible];
    this.goalMesh.visible = this.hoverMesh.visible = true;
    this.town.scene.add(warm);
    try {
      // (in the background where the driver compiles in parallel: the page never waits on a program's link)
      await this.renderer.compileAsync(this.town.scene, this.camera);
    } catch {
      // compiled on first use then
    }
    this.town.scene.remove(warm);
    [this.goalMesh.visible, this.hoverMesh.visible] = shown;
    geo.dispose();
  }

  /**
   * Every room has the same light rig (three/interiors/build.ts finish): the café's room (made for it and kept) is
   * drawn once with a person and a pet while the loading card shows, so their shaders under those lights, the shadow
   * pass's and the room's buffers are ready and the dip into the first room is not held dark while the driver works.
   */
  private async warmRooms(): Promise<void> {
    if (this.rooms.has('cafe')) return;
    const set = this.roomSet('cafe');
    // (a talk opened by a link may already be in the café: its room goes back where it was afterwards)
    const home = set.root.parent;
    const scene = new Scene();
    scene.add(set.root);
    const who = createCharacter('player');
    shade(who.root);
    who.root.position.set(set.guest.x, 0, set.guest.z);
    const pet = createPet('dog');
    shade(pet.root);
    pet.root.position.set(set.guest.x + 0.3, 0, set.guest.z + 0.3);
    scene.add(who.root, pet.root);
    const cam = new PerspectiveCamera(set.shot.fov, 16 / 9, 0.05, 120);
    cam.position.set(...set.shot.position);
    cam.lookAt(...set.shot.target);
    try {
      await this.renderer.compileAsync(scene, cam);
    } catch {
      // compiled on the draw below then
    }
    // gone meanwhile (the page left), or a room came up: nothing to draw any more
    if (!this.running || this.room) {
      who.dispose();
      pet.dispose();
      set.root.removeFromParent();
      if (home) home.add(set.root);
      return;
    }
    // drawn into one pixel of the canvas (the town's next frame draws over it), a few materials at a time: the same
    // shaders as on the screen (a render target would get others), the shadow pass's too, and the room's buffers
    try {
      await this.firstDraws(scene, cam, () => new Promise<void>((done) => requestAnimationFrame(() => done())), () => !this.running || !!this.room || set.root.parent !== scene);
    } finally {
      who.dispose();
      pet.dispose();
      // (a talk that took the café's room meanwhile keeps it)
      if (set.root.parent === scene) {
        set.root.removeFromParent();
        if (home) home.add(set.root);
      }
    }
  }

  stop(): void {
    this.running = false;
    if (this.warmHandle) {
      const w = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (w.cancelIdleCallback) w.cancelIdleCallback(this.warmHandle);
      else window.clearTimeout(this.warmHandle);
      this.warmHandle = 0;
    }
    if (this.idleHandle) {
      const w = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (w.cancelIdleCallback) w.cancelIdleCallback(this.idleHandle);
      else window.clearTimeout(this.idleHandle);
      this.idleHandle = 0;
    }
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.stop();
    for (const r of this.rides) {
      r.mesh.removeFromParent();
      r.mesh.geometry.dispose();
    }
    this.rides = [];
    this.birds?.dispose();
    this.birds = null;
    lastPlayerTile.set(this.world.rows, { ...this.sim.player.tile });
    for (const p of this.people.values()) p.ch.dispose();
    this.people.clear();
    this.pet?.p.dispose();
    for (const k of this.kids) k.ch.dispose();
    this.kids = [];
    this.pet = null;
    this.room?.dispose();
    this.room = null;
    this.staged = null;
    this.fish?.dispose();
    this.fish = null;
    for (const r of this.rooms.values()) r.dispose();
    this.rooms.clear();
    this.goalMesh.geometry.dispose();
    (this.goalMesh.material as MeshBasicMaterial).dispose();
    this.hoverMesh.geometry.dispose();
    (this.hoverMesh.material as MeshBasicMaterial).dispose();
    this.town.dispose();
    this.renderer.dispose();
    // free the context at once (a browser keeps only a few): the next visit makes a new one (a lost one is gone already)
    if (!this.renderer.getContext().isContextLost()) this.renderer.forceContextLoss();
    if (import.meta.env.DEV) {
      const w = window as unknown as { __town3d?: TownEngine3D };
      if (w.__town3d === this) delete w.__town3d;
    }
  }

  /** The camera frames this resident and the player (a talk in the town), or follows the player again (null). */
  private setFocus(placeId: PlaceId | null): void {
    const was = this.focus;
    this.focus = placeId && this.sim.residents.has(placeId) ? placeId : null;
    if (this.focus !== was) this.quiet();
    if (this.focus !== was && !this.still && !this.room) {
      this.camHold = TALK_HOLD_FRAMES;
      this.camHoldUntil = this.t + TALK_HOLD_SECONDS;
    }
  }

  // ───────────────────────── staging a talk (docs/town.md §7 "Staging") ─────────────────────────

  /**
   * A talk with the resident of `placeId` happens at `setting` (data/townStories.ts episodeSetting / quickChatSetting).
   * 'inside': the player walks to the room's door in the town (the resident walks there too when they are in sight,
   * else they are inside already), a dip to dark, the room. 'outside': both walk to the place's front and the camera
   * frames them there. 'here': a resident met out in the town; the player walks up to them and they talk right there
   * (docs/town.md §14). `ready` runs once the two are in place (the page opens the panel then): at the dark of the dip
   * for a room. `instant`: no walk (a link, a stage made again): they are there at once. Another talk staged already
   * with the same resident and setting just stays (ready at once); a different one is reached by a dip to dark.
   * False when the resident is not in town.
   */
  talkAt(placeId: PlaceId, setting: TalkSetting, opts: { visitor?: PlaceId | null; instant?: boolean }, ready: () => void): boolean {
    if (!this.sim.residents.has(placeId)) return false;
    // a talk is on foot: the bike (the car, the horse) is left where it is
    this.dismount();
    const visitor = opts.visitor && opts.visitor !== placeId ? opts.visitor : null;
    const s = this.staged;
    if (s && s.placeId === placeId && sameSetting(s.setting, setting) && (s.phase === 'room' || s.phase === 'outside')) {
      s.ready = null;
      ready();
      return true;
    }
    if (setting.kind === 'here') {
      this.talkHere({ placeId, setting, visitor: null, phase: 'go', ready, doorway: null, spots: null, arrivedAt: -1, retryAt: 0, hid: false, cancelled: false }, !!opts.instant || !this.ready);
      return true;
    }
    const inside = setting.kind === 'inside' && isInteriorId(setting.room);
    const doorway = inside && setting.kind === 'inside' ? doorwayOf(this.sim.world, setting.room) : null;
    const spots = setting.kind === 'outside' ? outsideSpots(this.sim.world, setting.at, placeId) : null;
    const next: Staged = { placeId, setting, visitor, phase: 'go', ready, doorway, spots, arrivedAt: -1, retryAt: 0, hid: false, cancelled: false };
    if (!doorway && !spots) {
      // nowhere known in this world (a small test world): the talk happens where the player stands
      this.dropStaging();
      next.phase = 'outside';
      this.staged = next;
      this.sim.engage(placeId);
      this.sim.bringOver(placeId);
      this.setFocus(placeId);
      next.ready = null;
      ready();
      return true;
    }
    if (opts.instant || !this.ready) {
      // there at once (before the first frame, or a stage made again)
      this.dropStaging();
      this.staged = next;
      this.placeNow(next);
      return true;
    }
    if (s && s.phase !== 'go') {
      // from one staged talk to another: through the dark
      this.cut(next);
      return true;
    }
    // far from where it happens (more than the map's WARP_FAR): through the dark, as the map's "Đến ngay", not a walk
    // of ten seconds and more
    const stand = doorway ? { x: doorway.door.x + 0.5, y: doorway.door.y + 0.5 } : spots!.player;
    if (talkIsFar(this.sim.player, stand)) {
      this.dropStaging();
      this.cut(next);
      return true;
    }
    this.dropStaging();
    this.staged = next;
    if (!this.setOff(next)) {
      // no way to walk there: through the dark
      this.staged = null;
      this.cut(next);
    }
    return true;
  }

  /**
   * A talk where the two met in the street: the player walks up to the resident (who waits where they are) and they
   * talk there; no walk when it cannot be made (or `now`: a stage made again), the resident steps over instead.
   */
  private talkHere(s: Staged, now: boolean): void {
    this.dropStaging();
    this.staged = s;
    const there = () => {
      if (this.staged !== s || s.phase !== 'go') return;
      this.sim.engage(s.placeId);
      this.sim.bringOver(s.placeId);
      this.talkOutside(s);
    };
    if (now || !this.sim.walkToResident(s.placeId, there)) there();
  }

  /**
   * A text scene of a courtship happens here (docs/town.md §15): the resident is put beside the player (on open ground
   * on the side away from the camera) and the camera frames the two, as a talk outside. endTalk lets them go.
   */
  meet(placeId: PlaceId, ready: () => void): boolean {
    if (!this.sim.residents.has(placeId)) return false;
    this.dismount();
    const p = this.sim.player;
    const sides = [
      { x: 0.75, y: -0.75 },
      { x: -0.75, y: 0.75 },
      { x: 1.06, y: 0 },
      { x: 0, y: -1.06 },
      { x: -1.06, y: 0 },
      { x: 0, y: 1.06 },
    ];
    const at = sides.map((d) => ({ x: p.x + d.x, y: p.y + d.y })).find((c) => walkable({ x: Math.floor(c.x), y: Math.floor(c.y) }, this.sim.world)) ?? { x: p.x + 0.75, y: p.y - 0.75 };
    this.dropStaging();
    const s: Staged = { placeId, setting: { kind: 'here' }, visitor: null, phase: 'go', ready, doorway: null, spots: null, arrivedAt: -1, retryAt: 0, hid: false, cancelled: false };
    this.staged = s;
    this.sim.jumpResident(placeId, at);
    this.sim.engage(placeId);
    this.talkOutside(s);
    return true;
  }

  /**
   * The town comes round (a wedding on the plaza, docs/town.md §15): every resident but the two walks in from a little
   * way off to a ring round the player, then everyday life takes them back.
   */
  /**
   * A "cảnh nghe" from a thing with a seat (docs/town.md §19): the player sits down on it (a bench, the café's
   * stool) and `who` come and talk to each other a few steps in front, in view. False = no free seat (the scene
   * still plays; the player stands).
   */
  listenFrom(spot: ActivitySpotId, who: readonly PlaceId[]): boolean {
    const a = this.world.activities?.[spot];
    const seats = this.world.life?.seats ?? [];
    if (!a?.box) return false;
    // this thing's seats: on its own tile, there from the first day
    const own = seats.filter((s) => !s.needs && Math.floor(s.x) === Math.floor(a.box!.x) && Math.floor(s.y) === Math.floor(a.box!.y));
    // (the stool by the radio stands beside the table's middle, on the same tile)
    const taken = new Set([...this.sim.residents.values()].map((r) => r.seat));
    const seat = own.find((s) => !taken.has(s)) ?? null;
    const sat = seat ? this.sim.sitPlayer(seat) : false;
    if (who.length > 0) {
      const p = this.sim.player;
      const h = octantHeading(seat?.oct ?? p.oct);
      const fx = Math.cos(h);
      const fy = Math.sin(h);
      const fits = (c: { x: number; y: number }) => walkable({ x: Math.floor(c.x), y: Math.floor(c.y) }, this.sim.world) && bodyFits(c.x, c.y, PLAYER_RADIUS, this.sim.world);
      // a few steps in front of the seat, the two side by side across the view; nearer or further where that is shut
      let spots: { x: number; y: number }[] | null = null;
      for (const d of [2.1, 2.7, 1.6, 3.3]) {
        const c = { x: p.x + fx * d, y: p.y + fy * d };
        const s = who.map((_, i) => ({ x: c.x - fy * (i - (who.length - 1) / 2) * 1.0, y: c.y + fx * (i - (who.length - 1) / 2) * 1.0 }));
        if (s.every(fits)) {
          spots = s;
          break;
        }
      }
      if (spots) {
        // they walk in from further off the same way (out of the picture where there is room), else they are there
        const from = spots.map((s) => {
          for (const d of [5, 3.5]) {
            const c = { x: s.x + fx * d, y: s.y + fy * d };
            if (fits(c)) return c;
          }
          return null;
        });
        this.sim.talkAside(who, spots, from);
      }
    }
    return sat;
  }

  /**
   * More people in a talk that is staged (talkAt: the city's scenes, docs/town.md §20): `who` come and stand by
   * `host`, on the side away from the player, turned to the two. They stay until endListen. Whoever is not in the
   * world is left out.
   */
  joinTalk(host: PlaceId, who: readonly PlaceId[]): void {
    const h = this.sim.residents.get(host);
    const here = who.filter((id) => id !== host && this.sim.residents.has(id));
    if (!h || here.length === 0) return;
    const p = this.sim.player;
    const d = Math.hypot(h.x - p.x, h.y - p.y) || 1;
    // away from the player along the line of the two, then to either side of it
    const ax = (h.x - p.x) / d;
    const ay = (h.y - p.y) / d;
    const fits = (c: { x: number; y: number }) => walkable({ x: Math.floor(c.x), y: Math.floor(c.y) }, this.sim.world) && bodyFits(c.x, c.y, PLAYER_RADIUS, this.sim.world) && Math.hypot(c.x - p.x, c.y - p.y) > 0.9;
    const tries: [number, number][] = [[1.05, 0], [0.55, 0.95], [0.55, -0.95], [-0.2, 1.15], [-0.2, -1.15], [1.9, 0], [1.3, 1.2], [1.3, -1.2]];
    const spots: { x: number; y: number }[] = [];
    for (const [along, side] of tries) {
      if (spots.length >= here.length) break;
      const c = { x: h.x + ax * along - ay * side, y: h.y + ay * along + ax * side };
      if (fits(c) && spots.every((s) => Math.hypot(s.x - c.x, s.y - c.y) > 0.85)) spots.push(c);
    }
    const ids = here.slice(0, spots.length);
    // they walk in from a few steps further off, where there is room
    const from = spots.map((s) => {
      for (const k of [4, 2.5]) {
        const c = { x: s.x + ax * k, y: s.y + ay * k };
        if (fits(c)) return c;
      }
      return null;
    });
    this.sim.talkAside(ids, spots, from);
  }

  /** The scene is over: the player gets up, the ones who talked go back to their day. */
  endListen(): void {
    this.sim.standPlayer();
    this.sim.endAside();
  }

  crowd(except: readonly PlaceId[]): void {
    const p = this.sim.player;
    const ids = [...this.sim.residents.keys()].filter((id) => !except.includes(id));
    ids.forEach((id, i) => {
      const a = (i / Math.max(1, ids.length)) * Math.PI * 2 + 0.4;
      const near = { x: p.x + Math.cos(a) * 2.6, y: p.y + Math.sin(a) * 2.6 };
      const far = { x: p.x + Math.cos(a) * 7, y: p.y + Math.sin(a) * 7 };
      const ok = (c: { x: number; y: number }) => walkable({ x: Math.floor(c.x), y: Math.floor(c.y) }, this.sim.world);
      if (!ok(near)) return;
      this.sim.jumpResident(id, ok(far) ? far : near);
      this.sim.hurryOn(id, near);
    });
  }

  /** The talk is over (the panel closed): out of the room through the dark, or the camera back on the player. */
  endTalk(): void {
    const s = this.staged;
    if (!s) return;
    if (s.phase === 'go') {
      this.dropStaging();
      this.sim.halt();
      return;
    }
    if (s.phase === 'enter' || s.phase === 'cut') {
      // the dip is under way: at its dark, back to the town instead
      s.cancelled = true;
      s.ready = null;
      return;
    }
    if (s.phase === 'outside') {
      this.dropStaging();
      return;
    }
    if (s.phase === 'room') {
      s.phase = 'leave';
      this.dip(() => this.leaveRoom(s));
    }
  }

  /** A talk being walked to was given up by the learner (a click elsewhere, the keys): the page drops it. */
  private cancelWalk(): void {
    if (this.staged?.phase !== 'go') return;
    this.dropStaging();
    this.cb.onTalkCancel?.();
  }

  /** Whatever was staged goes (no dip): nobody held, the resident free, the camera on the player, no room. */
  private dropStaging(): void {
    const s = this.staged;
    this.staged = null;
    if (!s) return;
    // sent inside out of sight for the walk: out again in a moment
    if (s.hid && s.doorway) this.sim.goInside(s.placeId, s.doorway.door, 1 + Math.random() * 2);
    this.sim.endGather();
    if (this.room) {
      this.room.dispose();
      this.room = null;
    }
    this.setFocus(null);
  }

  /** Is this point of the town on the stage now (with a margin, CSS px)? */
  private seen(x: number, y: number, h: number, margin = 30): boolean {
    this.v.set(x, h, y).project(this.camera);
    if (this.v.z > 1) return false;
    const sx = ((this.v.x + 1) / 2) * this.viewW;
    const sy = ((1 - this.v.y) / 2) * this.viewH;
    return sx > -margin && sx < this.viewW + margin && sy > -margin && sy < this.viewH + margin;
  }

  /** Both set off for the talk's spots. False when the player cannot get there. */
  private setOff(s: Staged): boolean {
    const r = this.sim.residents.get(s.placeId);
    if (!r) return false;
    const arrived = () => {
      if (this.staged !== s || s.arrivedAt >= 0) return;
      s.arrivedAt = this.t;
    };
    const inSight = !r.hidden && this.seen(r.x, r.y, 0.4);
    if (s.doorway) {
      const d = s.doorway;
      // in sight they walk to the door too and wait beside it; out of sight they are inside already
      if (!this.sim.gather(s.placeId, inSight ? d.beside : null, { x: d.door.x + 0.5, y: d.door.y + 0.5 }, arrived)) return false;
      if (!inSight && !r.hidden) {
        this.sim.goInside(s.placeId, d.door, 600);
        s.hid = true;
      }
      return true;
    }
    const sp = s.spots!;
    if (!this.sim.gather(s.placeId, sp.resident, sp.player, arrived)) return false;
    if (!inSight) {
      // out of sight: they come into view on their way, never appear from nowhere on the screen
      if (!this.seen(sp.resident.x, sp.resident.y, 0.4)) this.sim.jumpResident(s.placeId, sp.resident);
      else {
        const path = this.sim.pathOf(s.placeId);
        for (let i = path.length - 2; i >= 0; i--) {
          const c = { x: path[i].x + 0.5, y: path[i].y + 0.5 };
          if (this.seen(c.x, c.y, 0.4, 60)) continue;
          this.sim.jumpResident(s.placeId, c, path.slice(i + 1));
          break;
        }
      }
    }
    return true;
  }

  private makeRoom(s: Staged): RoomStage {
    const id = s.setting.kind === 'inside' ? s.setting.room : 'inn';
    const set = this.roomSet(isInteriorId(id) ? id : 'inn');
    const room = new RoomStage(set, { host: s.placeId, visitor: s.visitor, pet: this.state.look?.pet ?? null, dress: (ch) => this.dressPlayer(ch), visitorIn: this.visitorIn }, this.frames);
    room.setNight(this.night);
    return room;
  }

  /**
   * The room of `id`, made once and kept for the next visit, but only the last ROOMS_KEPT rooms used: a room that
   * falls out of that is let go (its geometry, materials, textures and lights), unless it is on the stage now.
   */
  private roomSet(id: InteriorId): RoomSet {
    let set = this.rooms.get(id);
    if (set) this.rooms.delete(id);
    else set = buildInterior(id);
    // the most recently used last
    this.rooms.set(id, set);
    for (const [old, r] of this.rooms) {
      if (this.rooms.size <= ROOMS_KEPT) break;
      if (r === set || r.root.parent) continue;
      this.rooms.delete(old);
      r.dispose();
    }
    return set;
  }

  /** A dip to dark: `atDark` runs when the stage is dark, then it comes back. Under reduced motion a plain cut. */
  private dip(atDark: () => void): void {
    if (this.still) {
      atDark();
      return;
    }
    this.fade.to = 1;
    this.fade.dark = atDark;
    this.quiet();
  }

  /** Into another setting through the dark (the talk before it, if any, ends at the dark). */
  private cut(next: Staged): void {
    const was = this.staged;
    if (was) was.ready = null;
    next.phase = 'cut';
    this.staged = next;
    this.dip(() => {
      if (this.staged !== next) return;
      // whatever was on the stage goes (the old room, the old focus), keeping `next`
      this.staged = null;
      // the one talked to in a room before stays in there a little, then comes out (not ten minutes)
      if (was && was !== next && was.doorway && was.placeId !== next.placeId) this.sim.goInside(was.placeId, was.doorway.door, STAY_INSIDE[0] + Math.random() * (STAY_INSIDE[1] - STAY_INSIDE[0]));
      if (this.room) {
        this.room.dispose();
        this.room = null;
      }
      this.setFocus(null);
      this.sim.endGather();
      if (next.cancelled) {
        this.snapToPlayer();
        return;
      }
      this.staged = next;
      this.placeNow(next);
    });
  }

  /** Both are put where the talk happens at once: in the room, or at their spots outside with the camera on them. */
  private placeNow(s: Staged): void {
    if (s.doorway) {
      const d = s.doorway;
      this.sim.placePlayer({ x: d.door.x + 0.5, y: d.door.y + 0.5 }, d.out + Math.PI);
      this.enterRoom(s);
      return;
    }
    const sp = s.spots!;
    this.sim.placePlayer(sp.player, Math.atan2(sp.resident.y - sp.player.y, sp.resident.x - sp.player.x));
    this.sim.jumpResident(s.placeId, sp.resident);
    this.talkOutside(s);
    this.aim(0, true);
  }

  /** At the dark: the room takes the town's place, the resident goes in, the page may open its panel. */
  private enterRoom(s: Staged): void {
    const room = this.makeRoom(s);
    if (this.room && this.room !== room) this.room.dispose();
    this.room = room;
    s.phase = 'room';
    if (s.doorway) this.sim.goInside(s.placeId, s.doorway.door, 600);
    s.hid = false;
    this.setFocus(s.placeId);
    room.setNight(this.night);
    room.aim(this.viewW, this.viewH, this.inset, this.safe, 0, true);
    this.setHover(null);
    const run = s.ready;
    s.ready = null;
    run?.();
  }

  /** Out of the room at the dark: the player outside its door facing the street, the camera on them again. */
  private leaveRoom(s: Staged): void {
    if (this.room) {
      this.room.dispose();
      this.room = null;
    }
    this.staged = null;
    this.setFocus(null);
    this.sim.endGather();
    const d = s.doorway;
    if (d) {
      this.sim.placePlayer({ x: d.door.x + 0.5, y: d.door.y + 0.5 }, d.out);
      // the resident stays in a little longer (out of a door the player stands at only once they move away)
      const r = this.sim.residents.get(s.placeId);
      if (r && !r.hidden && Math.hypot(r.x - d.door.x - 0.5, r.y - d.door.y - 0.5) < 1.5) this.sim.jumpResident(s.placeId, d.beside);
      else this.sim.goInside(s.placeId, d.door, STAY_INSIDE[0] + Math.random() * (STAY_INSIDE[1] - STAY_INSIDE[0]));
    }
    this.snapToPlayer();
  }

  /** A flat marker (the goal ring, the hovered square) lying on the ground at (x, z), `up` over it: on the hill along the slope. */
  private onGround(m: Mesh, x: number, z: number, up: number): void {
    const lift = this.town.lift;
    const e = 0.25;
    const hx = (lift(x + e, z) - lift(x - e, z)) / (2 * e);
    const hz = (lift(x, z + e) - lift(x, z - e)) / (2 * e);
    m.position.set(x, lift(x, z) + up * Math.hypot(1, hx, hz), z);
    if (hx === 0 && hz === 0) m.quaternion.identity();
    else m.quaternion.setFromUnitVectors(UP_Y, this.v.set(-hx, 1, -hz).normalize());
  }

  /** The camera on the player at once (behind a dip to dark). */
  private snapToPlayer(): void {
    this.trail.length = 0;
    if (this.pet) {
      const p = this.sim.player;
      this.pet.x = p.x - 0.5;
      this.pet.y = p.y + 0.35;
    }
    this.pv.x = this.pv.z = 0;
    this.lastP.x = this.sim.player.x;
    this.lastP.y = this.sim.player.y;
    this.camMode = 'follow';
    this.aim(0, true);
  }

  /** Both at their spots outside: they turn to each other and the camera frames them with the place behind. */
  private talkOutside(s: Staged): void {
    s.phase = 'outside';
    this.sim.engage(s.placeId);
    this.setFocus(s.placeId);
    const run = s.ready;
    s.ready = null;
    run?.();
  }

  /** Each frame while a talk is walked to: in the room once the player is at its door; outside once both are there. */
  private updateStaging(): void {
    const s = this.staged;
    if (!s || s.phase !== 'go') return;
    if (s.spots && s.arrivedAt < 0 && this.t >= s.retryAt) {
      // the resident stopped short on the way (a walk given up behind somebody): on again
      const r = this.sim.residents.get(s.placeId);
      if (r && !r.hidden && r.path.length === 0 && Math.hypot(r.x - s.spots.resident.x, r.y - s.spots.resident.y) > 0.2) {
        s.retryAt = this.t + RETRY_SECONDS;
        this.sim.hurryOn(s.placeId, s.spots.resident);
      }
    }
    if (s.arrivedAt < 0) return;
    if (s.doorway) {
      s.phase = 'enter';
      this.dip(() => {
        if (this.staged !== s) return;
        if (s.cancelled) {
          this.dropStaging();
          this.snapToPlayer();
          return;
        }
        this.enterRoom(s);
      });
      return;
    }
    const sp = s.spots!;
    const r = this.sim.residents.get(s.placeId);
    if (!r) {
      this.dropStaging();
      return;
    }
    const there = !r.hidden && r.path.length === 0 && Math.hypot(r.x - sp.resident.x, r.y - sp.resident.y) < 0.2;
    if (there) {
      this.talkOutside(s);
      return;
    }
    const waited = this.t - s.arrivedAt;
    if ((waited > WAIT_UNSEEN && !this.seen(r.x, r.y, 0.4)) || waited > WAIT_MOST) {
      this.sim.jumpResident(s.placeId, sp.resident);
      this.talkOutside(s);
      return;
    }
    // stopped short (a way given up behind somebody): on again
    if (r.path.length === 0 && this.t >= s.retryAt) {
      s.retryAt = this.t + RETRY_SECONDS;
      this.sim.hurryOn(s.placeId, sp.resident);
    }
  }

  setFull(on: boolean): void {
    this.full = on;
    this.canvas.style.touchAction = on ? 'none' : 'pan-y';
  }

  setSafe(safe: SafeInsets): void {
    this.safe = { top: Math.max(0, safe.top), right: Math.max(0, safe.right), bottom: Math.max(0, safe.bottom), left: Math.max(0, safe.left) };
    this.applyInset(false);
  }

  setHint(placeId: PlaceId | null): void {
    this.hint = placeId;
    this.sim.setHint(placeId);
  }

  // ───────────────────────── riding ─────────────────────────

  /** The parked vehicle within reach of the player (the nearest), -1 = none (or riding already). */
  private nearRide(): number {
    if (this.riding >= 0 || this.busy()) return -1;
    const p = this.sim.player;
    let best = -1;
    let bestD = 1.3;
    this.rides.forEach((r, i) => {
      const d = Math.hypot(r.x - p.x, r.y - p.y);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  /** What the "Lên xe / Xuống xe" button shows: the vehicle beside the player, the one ridden. */
  rideState(): { near: VehicleKind | null; riding: VehicleKind | null } {
    const n = this.nearRide();
    return { near: n >= 0 ? this.rides[n].kind : null, riding: this.riding >= 0 ? this.rides[this.riding].kind : null };
  }

  /** On the vehicle beside the player, or off the one ridden. False = neither (none in reach, a talk, a dip). */
  toggleRide(): boolean {
    if (this.riding >= 0) {
      this.dismount();
      return true;
    }
    const n = this.nearRide();
    if (n < 0 || this.paused) return false;
    this.mount(n);
    return true;
  }

  private mount(i: number): void {
    const r = this.rides[i];
    const spec = RIDES[r.kind];
    this.cancelWalk();
    // onto its seat, facing the way it faces
    this.sim.placePlayer({ x: r.x + Math.cos(r.heading) * spec.seatAt, y: r.y + Math.sin(r.heading) * spec.seatAt }, r.heading);
    this.riding = i;
    this.sim.setRideSpeed(spec.speed);
  }

  /** Off the vehicle ridden: it stays where it is, the player steps off to its side. */
  private dismount(): void {
    if (this.riding < 0) return;
    const r = this.rides[this.riding];
    this.riding = -1;
    this.sim.setRideSpeed(null);
    const p = this.sim.player;
    for (const side of [1, -1]) {
      const at = { x: r.x - Math.sin(r.heading) * 0.55 * side, y: r.y + Math.cos(r.heading) * 0.55 * side };
      if (walkable({ x: Math.floor(at.x), y: Math.floor(at.y) }, this.sim.world)) {
        this.sim.placePlayer(at, p.yaw ?? r.heading);
        return;
      }
    }
  }

  /** The vehicles: made once the town stands; parked ones where they are, the one ridden under the player. */
  private updateRides(): void {
    if (!this.ridesMade && this.ready) {
      this.ridesMade = true;
      (this.world.vehicles ?? []).forEach((v, i) => {
        const geo = vehicleGeometry(v.kind, i);
        if (!geo) return;
        const mesh = new Mesh(geo, this.town.mats.std);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.town.scene.add(mesh);
        this.rides.push({ kind: v.kind, x: v.at.x + 0.5, y: v.at.y + 0.5, heading: v.heading, mesh });
      });
    }
    const me = this.people.get('player');
    this.rides.forEach((r, i) => {
      if (i === this.riding && me) {
        // the seat under the player, the vehicle the way the body faces; a horse's back rises and falls at a trot
        const spec = RIDES[r.kind];
        r.heading = me.heading;
        r.x = me.rx - Math.cos(r.heading) * spec.seatAt;
        r.y = me.rz - Math.sin(r.heading) * spec.seatAt;
        const trot = r.kind === 'horse' && this.sim.player.moving && !this.still ? Math.abs(Math.sin(this.t * 9)) * 0.035 : 0;
        r.mesh.position.set(r.x, this.town.lift(r.x, r.y) + trot, r.y);
      } else r.mesh.position.set(r.x, this.town.lift(r.x, r.y), r.y);
      r.mesh.rotation.y = -r.heading;
      r.mesh.visible = !this.room;
    });
  }

  /** The quest being followed (StageProps.guide): its way on the ground and its arrows. */
  setGuide(target: TravelTarget | null): void {
    this.guide = target;
    this.guideWay = [];
    this.guideLen = null;
    this.guideNext = 0;
  }

  /** How far the quest followed is along the way there (tiles); null = none, or no way to it. */
  guideDistance(): number | null {
    return this.guide ? this.guideLen : null;
  }

  /** The way to the quest followed, from where the player stands now (the maps draw it); null = none, or right there. */
  guideWayNow(): { x: number; y: number }[] | null {
    if (!this.guide || this.guideWay.length < 2 || (this.guideLen ?? 0) < 1.6) return null;
    const p = this.sim.player;
    return [{ x: p.x, y: p.y }, ...this.guideWay.slice(1)];
  }

  /** Where the quest followed is now: a resident where they stand, a place at its door, a spot, a tile. */
  private guidePoint(): { x: number; y: number } | null {
    const g = this.guide;
    if (!g) return null;
    if (g.kind === 'tile') return { x: g.x, y: g.y };
    if (g.kind === 'activity') {
      const a = this.world.activities?.[g.id];
      return a ? { x: a.stand.x + 0.5, y: a.stand.y + 0.5 } : null;
    }
    if (g.kind === 'resident') {
      const r = this.sim.residents.get(g.id);
      if (r && !r.hidden) return { x: r.x, y: r.y };
    }
    const p = this.world.places.find((q) => q.id === g.id) ?? this.world.guests?.find((q) => q.id === g.id);
    return p ? { x: p.door.x + 0.5, y: p.door.y + 0.5 } : null;
  }

  /** The way to the quest followed, found again twice a second (people walk, so do the player and the target). */
  private updateGuide(): void {
    if (!this.guide || this.t < this.guideNext) return;
    this.guideNext = this.t + 0.5;
    const to = this.guidePoint();
    const p = this.sim.player;
    if (!to) {
      this.guideWay = [];
      this.guideLen = null;
      return;
    }
    const goal = nearestWalkable({ x: Math.floor(to.x), y: Math.floor(to.y) }, this.sim.world, p.tile);
    const tiles = goal ? findPath(p.tile, goal, this.sim.world) : [];
    const way = [{ x: p.x, y: p.y }, ...tiles.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 })), to];
    // no way found (or none needed): straight there
    if (tiles.length === 0) way.splice(1, way.length - 2);
    let len = 0;
    for (let i = 1; i < way.length; i++) len += Math.hypot(way[i].x - way[i - 1].x, way[i].y - way[i - 1].y);
    this.guideWay = way;
    this.guideLen = len;
  }

  /** The way on the ground, the arrow over the target or at the stage's edge (drawOverlay, not in a talk). */
  private drawGuide(ctx: CanvasRenderingContext2D, area: { x0: number; y0: number; x1: number; y1: number }): void {
    this.updateGuide();
    const to = this.guidePoint();
    if (!this.guide || !to || this.busy()) return;
    const p = this.sim.player;
    const len = this.guideLen ?? Math.hypot(to.x - p.x, to.y - p.y);
    // close enough: the target is right there (its own tag and the "Nói chuyện" button take over)
    if (len < 1.6) return;
    // the way from where the player stands now (the first point follows them between two finds)
    const way = this.guideWay.length > 1 ? [{ x: p.x, y: p.y }, ...this.guideWay.slice(1)] : [{ x: p.x, y: p.y }, to];
    const step = 0.5;
    const dots = wayDots(way, step, this.still ? step / 2 : (this.t * 1.1) % step, 48).map((d, i, all) => {
      const s = this.project(d.x, this.town.lift(d.x, d.y) + 0.04, d.y);
      // fade in past the player's feet, out towards the far end of what is drawn
      const fade = Math.min(1, (i + 1) / 3, (all.length - i) / 6);
      return { x: s.x, y: s.y, fade };
    });
    drawWay(ctx, dots);
    const g = this.guide;
    const r = g.kind === 'resident' ? this.sim.residents.get(g.id) : undefined;
    const top = r && !r.hidden ? this.headAt(r.id, r) : this.project(to.x, this.town.lift(to.x, to.y) + 1.4, to.y);
    const me = this.project(p.x, this.town.lift(p.x, p.y) + 0.6, p.y);
    const edge = edgeArrow(me, top, area);
    if (edge) drawEdgeArrow(ctx, edge, metres(len), this.font, this.pal.tagBg, this.pal.tagText);
    // over the head (a resident's name tag sits there too: just above it), never under the stage's top buttons
    else drawTargetArrow(ctx, { x: top.x, y: Math.max(area.y0 + 30, top.y - (r ? 8 : 0)) }, this.t, this.still);
  }

  setSpeaking(who: string | null): void {
    this.speaking = who;
  }

  /**
   * The neighbour of an episode (a visitor in the room) is in the room: from their first line of each pass (the page
   * says when, Episode.tsx); they walk in from outside the room's open side (under reduced motion: there at once), and
   * out again when a pass starts over.
   */
  setVisitorIn(present: boolean): void {
    this.visitorIn = present;
    // (out again at once: a pass starting over is a cut, nobody walks out during its first lines)
    this.room?.setVisitorIn(present, this.still || !present);
  }

  setInset(right: number, bottom: number): void {
    this.inset = { right: Math.max(0, right), bottom: Math.max(0, bottom) };
    this.applyInset(false);
  }

  private applyInset(now: boolean): void {
    this.shiftGoal = insetShift(this.viewW, this.viewH, this.inset, this.safe);
    if (now || this.still) this.shift = { ...this.shiftGoal };
  }

  setLotLabels(labels: Readonly<Record<string, string>>): void {
    this.lotLabels = labels;
  }

  setOverview(on: boolean): void {
    this.overview = on;
  }

  // ───────────────────────── shows ─────────────────────────

  /** Somebody to hang a picture on: in the room, or in the town. */
  private present(target: string): boolean {
    return this.room ? this.room.has(target) : !!this.sim.actor(target);
  }

  float(target: 'player' | PlaceId, text: string): void {
    if (!this.present(target)) return;
    this.floats.push({ target, text, born: this.t });
    if (this.floats.length > 6) this.floats.shift();
  }

  emote(target: 'player' | PlaceId, kind: EmoteKind): void {
    if (!this.present(target)) return;
    this.emotes = this.emotes.filter((e) => e.target !== target);
    this.emotes.push({ target, kind, born: this.t });
  }

  act(target: 'player' | PlaceId, anim: ActKind): void {
    if (this.still) return;
    if (this.room) {
      this.room.act(target, anim, this.t);
      return;
    }
    if (!this.sim.actor(target)) return;
    this.sim.turnForEmote(target);
    this.playOnce(target, anim);
  }

  private playOnce(id: string, anim: CharAction): void {
    const p = this.people.get(id);
    if (!p) return;
    // the body turns first (a wave goes AT somebody); place() starts it once turned, or after SHOT_TURN_WAIT
    p.pending = anim;
    p.pendingUntil = this.t + SHOT_TURN_WAIT;
  }

  /** Start a one-shot now. */
  private startShot(p: Person, anim: CharAction): void {
    p.pending = null;
    p.ch.setAction(anim);
    p.action = anim;
    p.oneShot = this.t + p.ch.actionDuration(anim);
  }

  burst(kind: BurstKind, at: StageTarget, to?: { x: number; y: number }): void {
    if (this.still) return;
    const head = this.screenPointOf(at);
    if (!head) return;
    const from = typeof at === 'object' ? head : { x: head.x, y: Math.max(this.safe.top + 24, head.y + 24) };
    if (kind === 'confetti') this.particles.confetti(from);
    else if (kind === 'sparkle') this.particles.sparks(from);
    else this.particles.coins(from, to ?? { x: this.viewW - 40, y: 28 });
  }

  walkTo(placeId: PlaceId, then?: () => void): boolean {
    if (this.sim.residents.has(placeId)) return this.sim.walkToResident(placeId, then);
    return this.sim.walkToDoor(placeId, then);
  }

  walkToActivity(id: ActivitySpotId, then?: () => void): boolean {
    return this.sim.walkToActivity(id, then);
  }

  /** Where somebody's head is on the stage (CSS px), or a stage point as given. */
  screenPointOf(target: StageTarget): { x: number; y: number } | null {
    if (typeof target === 'object') return { x: target.x, y: target.y };
    if (this.room) {
      if (!this.room.head(target, this.v)) return null;
      return this.project(this.v.x, this.v.y + 0.08, this.v.z);
    }
    const a = this.sim.actor(target);
    if (!a) return null;
    const head = this.headOf(target, a);
    return this.project(head.x, head.y + 0.08, head.z);
  }

  private headOf(id: string, a: Actor): P3 {
    if (this.room && this.room.head(id, this.v)) return { x: this.v.x, y: this.v.y, z: this.v.z };
    const p = this.people.get(id);
    if (p) {
      p.ch.headTop(this.v);
      return { x: this.v.x, y: this.v.y, z: this.v.z };
    }
    return { x: a.x, y: 0.95 + this.town.lift(a.x, a.y), z: a.y };
  }

  /** A place was built or a decoration bought: the camera goes there, it pops out of the ground, the camera comes back. */
  celebrate(id: string): number {
    if (this.still) return 0;
    const place = this.world.places.find((p) => p.id === id);
    const spots: P3[] = place
      ? [{ x: place.x + place.w / 2, y: 0.6, z: place.y + place.d / 2 }]
      : (this.world.decorations[id as keyof TownWorld['decorations']] ?? []).map((s) => ({ x: s.x + (s.solid ? 0.5 : 0), y: 0.4, z: s.y + (s.solid ? 0.5 : 0) }));
    if (spots.length === 0) return 0;
    const rest = this.restDist();
    // a place: its whole lot and its roof; a decoration: every piece (they may be spread over the town) and a little
    // over each
    const shape = place
      ? [0, 1].flatMap((i) => [0, 1].flatMap((j) => [{ x: place.x + i * place.w, y: 0, z: place.y + j * place.d }, { x: place.x + i * place.w, y: 2.4, z: place.y + j * place.d }]))
      : spots.flatMap((s) => [{ ...s, y: 0 }, { ...s, y: s.y + 1.4 }]);
    // looked at from the middle of what is new (not the average of its pieces: four by the plaza and one far off
    // would pull the view off the far one), in the part of the stage the HUD and a panel leave free (the camera's
    // shift puts its middle there; the fit uses that part's share of the height)
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const s of shape) {
      x0 = Math.min(x0, s.x);
      x1 = Math.max(x1, s.x);
      z0 = Math.min(z0, s.z);
      z1 = Math.max(z1, s.z);
    }
    const c = { x: (x0 + x1) / 2, y: 0.4, z: (z0 + z1) / 2 };
    const fit = fitDistance(shape, c, this.yaw, PITCH, this.freeAspect(), 0.78 * this.freeShareH());
    // the whole new thing with a little ground round it: never closer than half the resting view; a place never much
    // further out than the resting view, a decoration spread over the town as far out as it takes to show every piece
    const dist = Math.max(rest * 0.6, Math.min(rest * (place ? 1.25 : 4), fit));
    const now = this.t;
    // a long glide (or a far zoom out) first: the thing pops once the camera is about there
    const appear = BUILD_APPEAR + Math.min(0.6, Math.hypot(c.x - this.target.x, c.z - this.target.z) / 40 + Math.max(0, dist - this.dist) / 60);
    this.quiet(BUILD_HOLD + appear - BUILD_APPEAR);
    this.pops.set(id, now + appear);
    this.showcase = { at: c, dist, until: now + BUILD_HOLD + (appear - BUILD_APPEAR) + spots.length * POP_STAGGER };
    spots.forEach((s, i) => {
      const when = now + appear + i * POP_STAGGER;
      this.later.push({ at: when - 0.28, run: () => this.particles.dust(this.project(s.x, 0, s.z), place ? 16 : 7, place ? 46 : 16) });
      this.later.push({ at: when + 0.12, run: () => this.particles.sparks(this.project(s.x, s.y + (place ? 1.1 : 0.5), s.z), place ? 18 : 8) });
    });
    if (place) {
      this.later.push({ at: now + appear + 0.2, run: () => this.particles.confetti(this.project(spots[0].x, 2, spots[0].z), 34) });
      this.later.push({
        at: now + appear + POP_SECONDS,
        run: () => {
          this.sim.moveIn(place.id);
          this.emote(place.id, 'heart');
          this.playOnce('player', 'cheer');
        },
      });
    }
    return appear;
  }

  /** 1 = standing; 0..1 = popping out of the ground; below 0 = not there yet. */
  private popOf = (id: string, index = 0): number => {
    const at = this.pops.get(id);
    if (at === undefined) return 1;
    const k = (this.t - at - index * POP_STAGGER) / POP_SECONDS;
    return k < 0 ? -1 : Math.min(1, k);
  };

  private inTown = (id: PlaceId): boolean => this.popOf(id) >= 0;

  // ───────────────────────── input ─────────────────────────

  private rayAt(x: number, y: number): Ray {
    this.raycaster.setFromCamera(new Vector2((x / this.viewW) * 2 - 1, -(y / this.viewH) * 2 + 1), this.camera);
    const r = this.raycaster.ray;
    return { o: { x: r.origin.x, y: r.origin.y, z: r.origin.z }, d: { x: r.direction.x, y: r.direction.y, z: r.direction.z } };
  }

  /** What is under a point of the stage (CSS px). */
  pickAt(x: number, y: number): Hit3 | null {
    const people: PickPerson[] = [];
    for (const r of this.sim.residents.values()) {
      if (r.hidden || !this.inTown(r.place.id)) continue;
      const head = this.headOf(r.place.id, r);
      people.push({ placeId: r.place.id, x: r.x, z: r.y, height: head.y });
    }
    const boxes: PickBox[] = [];
    for (const v of this.town.places.values()) {
      if (v.built && this.inTown(v.id)) boxes.push({ hit: { kind: 'place', placeId: v.id, built: true }, box: v.box });
      else if (!v.built && v.site && this.sim.isSite(v.id)) boxes.push({ hit: { kind: 'place', placeId: v.id, built: false }, box: v.box });
    }
    for (const [id, a] of this.town.activities) boxes.push({ hit: { kind: 'activity', id }, box: a.box });
    return pick3(this.rayAt(x, y), people, boxes, this.world.size, (t) => walkable(t, this.sim.world), this.town.lift);
  }

  /** The mouse moved over the canvas (CSS px): what is under it now. */
  pointerMove(x: number, y: number): void {
    this.pointer = { x, y };
    this.pointerLive = true;
    if (this.paused || !this.ready) return;
    this.repick();
  }

  /** The pointer left the canvas (or went onto the HUD over it): nothing is hovered. */
  pointerLeave(): void {
    this.pointer = null;
    this.setHover(null);
  }

  /** What is under the resting pointer, picked again (the camera moved, or somebody may have walked under it). */
  private repick(): void {
    const at = this.pointer;
    if (!at) return;
    const w = this.pickedWith;
    w.x = this.target.x;
    w.z = this.target.z;
    w.dist = this.dist;
    w.yaw = this.yaw;
    w.pitch = this.pitch;
    w.sx = this.shift.x;
    w.sy = this.shift.y;
    w.at = this.t;
    this.setHover(this.pickAt(at.x, at.y));
  }

  /**
   * Each frame: the pointer resting while the camera moves the ground under it (or now and then, for somebody walking
   * under it) is picked again. A still pointer over a still camera picks nothing new: the square cannot flicker.
   */
  private refreshHover(): void {
    if (!this.pointer || this.paused || !this.ready) return;
    const w = this.pickedWith;
    const moved = Math.abs(w.x - this.target.x) + Math.abs(w.z - this.target.z) + Math.abs(w.dist - this.dist) + Math.abs(w.yaw - this.yaw) + Math.abs(w.pitch - this.pitch) > 1e-5 || Math.abs(w.sx - this.shift.x) + Math.abs(w.sy - this.shift.y) > 0.01;
    if (moved || this.t - w.at >= REPICK_SECONDS) this.repick();
  }

  /** A dip to dark is under way, or a room is shown: the town takes no clicks or keys. */
  private busy(): boolean {
    return this.fade.k > 0 || this.fade.to > 0 || !!this.room;
  }

  click(x: number, y: number): void {
    if (this.paused || !this.ready || this.busy()) return;
    const hit = this.pickAt(x, y);
    if (!hit) return;
    // a talk being walked to is given up by a click elsewhere (another resident: the page stages that talk instead)
    if (hit.kind !== 'resident' && !(hit.kind === 'place' && hit.built)) this.cancelWalk();
    if (hit.kind === 'activity') {
      const id = hit.id;
      this.sim.walkToActivity(id, () => this.cb.onActivity?.(id));
    } else if (hit.kind === 'resident' || (hit.kind === 'place' && hit.built)) {
      // the page decides what the talk is and where it happens (talkAt), then both walk there
      const id = hit.placeId;
      if (this.cb.onTalk) this.cb.onTalk(id, hit.kind === 'resident');
      else if (!this.sim.walkToResident(id)) this.sim.walkToDoor(id);
    } else if (hit.kind === 'place') {
      const id = hit.placeId;
      this.sim.walkToDoor(id, () => this.cb.onLot?.(id));
    } else {
      this.sim.walkToTile(hit.tile);
    }
  }

  /** The wheel or a pinch: the learner's own zoom (clamped). */
  zoomBy(change: { wheel?: number; pinch?: number }): void {
    this.zoomUser = zoomAfter(this.zoomUser, change);
  }

  /** A drag with the right button (or two fingers): turn the camera a little round the town. */
  turnBy(dx: number): void {
    this.yawGoal = yawAfter(this.yawGoal, dx);
    if (this.still) this.yaw = this.yawGoal;
  }

  key(code: string, down: boolean): boolean {
    if (this.paused || !this.ready || (down && this.busy())) return false;
    // Shift held: the player runs (a calm walk otherwise); never claims the key
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.sim.setRun(down);
      return false;
    }
    const dir = KEY_DIRS[code];
    if (dir) {
      if (this.keys[dir] === down) return true;
      this.keys[dir] = down;
      // the keys walk: the hovered square goes away until the mouse moves again; a talk being walked to is given up
      if (down) {
        this.pointerLive = false;
        this.cancelWalk();
      }
      this.steerKeys();
      return true;
    }
    if (code === 'Enter' || code === 'Space' || code === 'KeyE') {
      if (down) {
        // riding: off it; beside a vehicle with nobody and nothing else in reach: on it
        if (this.riding >= 0) {
          this.dismount();
          return true;
        }
        // whoever is within reach of where the player stands now (walking or not)
        const n = this.nearNow(false);
        if (!n && this.nearRide() >= 0) {
          this.mount(this.nearRide());
          return true;
        }
        if (n && n.kind !== 'resident') this.cancelWalk();
        if (!n) this.cb.onIdleAct?.();
        else if (n.kind === 'activity') this.cb.onActivity?.(n.id);
        else if (n.kind === 'resident') {
          if (this.cb.onTalk) this.cb.onTalk(n.placeId, true);
          else this.sim.walkToResident(n.placeId);
        } else this.cb.onLot?.(n.placeId);
      }
      return true;
    }
    return false;
  }

  /**
   * A finger held on the stage (or dragged over it): the player walks towards the ground under it, on and on, and runs
   * when it is far (docs/town.md §7 "Moving about"); `holdAt` again as the finger moves. False = the town takes no
   * walking now (a panel, a dip, a room). A quick tap still walks by `click`.
   */
  holdAt(x: number, y: number): boolean {
    if (this.paused || !this.ready || this.busy()) return false;
    if (!this.hold) {
      this.pointerLive = false;
      this.setHover(null);
      this.cancelWalk();
    }
    this.hold = { x, y };
    this.steerHold();
    return true;
  }

  /** The finger is lifted: the player stops where they are. */
  holdEnd(): void {
    if (!this.hold) return;
    this.hold = null;
    this.sim.setRun(false);
    if (this.keysHeld()) this.steerKeys();
    else this.sim.steer(null);
  }

  /** Steer towards the ground under the held finger, as the camera stands this frame. */
  private steerHold(): void {
    const h = this.hold;
    if (!h) return;
    if (this.paused || this.busy()) {
      this.sim.steer(null);
      return;
    }
    const p = this.sim.player;
    const way = holdDirection(this.rayAt(h.x, h.y), { x: p.x, y: this.town.lift(p.x, p.y), z: p.y });
    this.sim.setRun(!!way && way.dist > HOLD_RUN);
    this.sim.steer(way);
  }

  releaseKeys(): void {
    this.hold = null;
    this.sim.setRun(false);
    this.keys.up = this.keys.down = this.keys.left = this.keys.right = false;
    this.steerKeys();
  }

  /** A direction key is held. */
  private keysHeld(): boolean {
    return this.keys.up || this.keys.down || this.keys.left || this.keys.right;
  }

  /**
   * Tell the sim which way the held keys go: relative to the camera as it stands now (a turn of the view turns the
   * way with it), any direction (docs/town.md §7 "Moving about").
   */
  private steerKeys(): void {
    this.sim.steer(keyDirection(this.keys, this.yaw));
  }

  /**
   * What is under the pointer: a tile keeps its square until the point is clearly over the next one (`stickyTile`),
   * people, houses and activities keep their own highlight.
   */
  private setHover(hit: Hit3 | null): void {
    const was = this.hover;
    if (hit?.kind === 'tile' && hit.at) {
      const prev = was?.kind === 'tile' ? was.tile : null;
      const tile = stickyTile(prev, hit.at);
      hit = prev && tile === prev ? was : { kind: 'tile', tile, walkable: walkable(tile, this.sim.world), at: hit.at };
    }
    this.hover = hit;
    const clickable = !!hit && (hit.kind !== 'tile' || hit.walkable);
    const cursor = clickable ? 'pointer' : 'default';
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
  }

  // ───────────────────────── the loop ─────────────────────────

  private frame = (now: number): void => {
    this.raf = 0;
    if (!this.running) return;
    // a panel over the town (a conversation, an activity): about 30 frames a second are plenty while nothing glides
    if (this.paused && this.ready && this.last && now - this.last < PAUSED_FRAME_MS && this.t >= this.quietUntil && this.settled()) {
      if (this.visible) this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const began = performance.now();
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    const realDt = this.last ? (now - this.last) / 1000 : 0;
    this.last = now;
    this.t += dt;
    if (++this.frames % 60 === 0) this.still = prefersReducedMotion();
    // held keys go relative to the camera as it stands this frame (it may be turning)
    if (this.hold) this.steerHold();
    else if (this.keysHeld()) this.steerKeys();
    this.sim.update(dt);
    // the player's pace on the ground, for the camera's lead (smoothed: a slide or a bump never twitches the view)
    const pl = this.sim.player;
    if (dt > 0) {
      const k = 1 - Math.exp(-dt * PACE_SMOOTH);
      this.pv.x += ((pl.x - this.lastP.x) / dt - this.pv.x) * k;
      this.pv.z += ((pl.y - this.lastP.y) / dt - this.pv.z) * k;
      if (Math.hypot(this.pv.x, this.pv.z) < 1e-3 && pl.x === this.lastP.x && pl.y === this.lastP.y) this.pv.x = this.pv.z = 0;
    }
    this.lastP.x = pl.x;
    this.lastP.y = pl.y;
    this.updateStaging();
    this.updateFarWalk();
    this.updateFade(dt);
    for (const e of this.sim.events.splice(0)) {
      if (e.kind === 'say') this.says.set(e.id, this.t + SAY_SECONDS);
      else if (e.id !== this.focus && !this.room) this.act(e.id as PlaceId, e.kind === 'wave' ? 'wave' : 'yes');
    }
    if (this.later.length > 0) {
      const due = this.later.filter((l) => l.at <= this.t);
      if (due.length > 0) {
        this.later = this.later.filter((l) => l.at > this.t);
        for (const l of due) l.run();
      }
    }
    if (this.showcase && this.t >= this.showcase.until) this.showcase = null;
    for (const [id, at] of this.pops) if (this.t - at > POP_SECONDS + 12 * POP_STAGGER) this.pops.delete(id);
    const dimTo = this.focus ? 1 : 0;
    this.dim = this.still ? dimTo : this.dim + (dimTo - this.dim) * (1 - Math.exp(-dt * DIM_RATE));
    const nightTo = this.state.theme === 'night' ? 1 : 0;
    const nightWas = this.night;
    this.night = this.still || this.first ? nightTo : this.night + (nightTo - this.night) * (1 - Math.exp(-dt * NIGHT_RATE));
    if (Math.abs(this.night - nightTo) < 0.003) this.night = nightTo;
    if (this.night !== nightWas || this.first) this.applyNight();
    this.particles.update(dt);
    // puffs kicked up on the ground stay there when the camera moves
    for (const q of this.particles.list) {
      const a = q.anchor;
      if (!a || this.room) continue;
      this.v.set(a.x, a.y, a.z).project(this.camera);
      const sx = ((this.v.x + 1) / 2) * this.viewW;
      const sy = ((1 - this.v.y) / 2) * this.viewH;
      q.x += sx - a.sx;
      q.y += sy - a.sy;
      a.sx = sx;
      a.sy = sy;
    }
    // in a room the town is not drawn: its people wait (placed again from the sim when it shows)
    if (this.fish) {
      this.fish.update(this.still ? 1 : dt);
      if (this.fish.done()) {
        this.fish.dispose();
        this.fish = null;
        (this.people.get('player')?.ch as Character3DPlus | undefined)?.castLine?.(null);
      }
    }
    if (!this.room) {
      this.updateNear();
      this.syncPeople(dt);
      this.updateRides();
      if (!this.birds && this.ready) {
        this.birds = new Birds(this.town.mats.std);
        this.town.scene.add(this.birds.mesh);
      }
      this.birds?.update(this.t, this.target, this.night, this.still, dt);
      this.updatePet(dt);
      this.updateKids(dt);
    }
    // following the player, the camera keeps the sim's own time (a late frame moves the two together: the player stays
    // in the middle); a glide to a shot is never more than 1.5 usual frames ahead in a late frame (cameraDt)
    const camDt = this.camMode === 'follow' && this.camW >= this.followW ? dt : cameraDt(dt, this.frameDt);
    if (this.room) {
      // the room's shot, eased when a panel opens or the stage changes size; held at the dark of a dip
      this.room.update(dt, this.t, this.speaking, this.still);
      this.room.aim(this.viewW, this.viewH, this.inset, this.safe, camDt, this.still || this.first || this.fade.hold > 0 || this.fade.k >= 1);
    } else if ((this.camHold > 0 || this.t < this.camHoldUntil) && !this.first) this.camHold = Math.max(0, this.camHold - 1);
    else this.aim(camDt, this.still || this.first);
    this.refreshHover();
    if (dt > 0) this.frameDt += (dt - this.frameDt) * 0.1;
    this.spawnPetals(dt);
    this.render();
    this.first = false;
    if (!this.ready) {
      this.ready = true;
      this.stats.ready = true;
      const run = this.onReady;
      this.onReady = null;
      run?.();
      // the sea and the mountains round the island first, then the lots on offer, each in an idle moment
      this.idle(() => {
        const g = this.town.makeBackdrop();
        if (!g) return this.prebuildLots();
        // compiled in the background (the falls' own shader), then put in: the town never waits on the driver for it
        const show = () => {
          if (!this.running) return;
          this.town.showBackdrop();
          this.idle(() => this.prebuildLots());
        };
        this.renderer.compileAsync(g, this.camera, this.town.scene).then(show, show);
      });
      this.warmLater();
    }
    this.measure(realDt);
    this.stats.cpuMs += (performance.now() - began - this.stats.cpuMs) * 0.05;
    if (this.visible) this.raf = requestAnimationFrame(this.frame);
  };

  /** Nothing of the camera is moving and nothing flies over the town. */
  private settled(): boolean {
    const v = Math.abs(this.targetV.x) + Math.abs(this.targetV.z) + Math.abs(this.distV) + Math.abs(this.pitchV) + Math.abs(this.yawV);
    return v < 0.02 && this.particles.list.length === 0 && this.emotes.length === 0 && this.floats.length === 0 && !this.showcase && !this.fish && this.fade.k === 0 && this.fade.to === 0;
  }

  /** The dip to dark: down, the moment at the dark (its work done, held a little), back up. */
  private updateFade(dt: number): void {
    const f = this.fade;
    // (a long frame, the work at the dark, never skips the way back up)
    const step = Math.min(dt, 1 / 30);
    if (f.to === 1) {
      f.k = Math.min(1, f.k + step / FADE_OUT);
      if (f.k >= 1) {
        const run = f.dark;
        f.dark = null;
        f.to = 0;
        f.hold = FADE_HOLD;
        run?.();
      }
    } else if (f.k > 0) {
      if (f.hold > 0) f.hold = Math.max(0, f.hold - step);
      else f.k = Math.max(0, f.k - step / FADE_IN);
    }
  }

  private idleHandle = 0;

  /** Run when the page is idle (or soon, where the browser has no idle callback). */
  private idle(run: () => void): void {
    const w = window as Window & { requestIdleCallback?: (run: () => void, o?: { timeout: number }) => number };
    const go = () => {
      this.idleHandle = 0;
      if (this.running) run();
    };
    this.idleHandle = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 2000 }) : window.setTimeout(go, 300);
  }

  /** The lots on offer get their house made ahead (one per idle moment): buying one then builds nothing new. */
  private prebuildLots(): void {
    for (const q of this.world.places) {
      if (!this.sim.isSite(q.id) || this.state.built.includes(q.id)) continue;
      if (this.town.prebuild(q.id)) {
        this.idle(() => this.prebuildLots());
        return;
      }
    }
  }

  /** Some main-thread work just happened (a panel opening, a purchase): its long frames say nothing of the device. */
  private quiet(seconds = QUIET_SECONDS): void {
    this.quietUntil = Math.max(this.quietUntil, this.t + seconds);
    this.fpsAcc.n = 0;
    this.fpsAcc.sum = 0;
  }

  /**
   * Frame times, a second at a time: two slow seconds in a row make the drawing one step lighter (lighten), eight
   * easy ones one step richer again. Frames that are the page's own work, not the device's pace, do not count: the
   * first seconds, a moment after a panel opens or something is bought, any single frame over STALL_SECONDS, and
   * none while a panel is over the town (drawn at about 30 a second then).
   */
  private measure(dt: number): void {
    // a frame longer than 2 s is a pause (a hidden tab, a debugger), not the device's pace
    if (dt <= 0 || dt > 2) return;
    const info = this.renderer.info.render;
    this.stats.calls = info.calls;
    this.stats.triangles = info.triangles;
    this.stats.pixelRatio = this.dpr;
    // a panel over the town draws at about 30 frames a second on purpose (PAUSED_FRAME_MS): not the device's pace
    if (this.paused) {
      this.fpsAcc.n = 0;
      this.fpsAcc.sum = 0;
      return;
    }
    if (this.t < this.quietUntil || dt > STALL_SECONDS) return;
    const a = this.fpsAcc;
    a.n++;
    a.sum += dt;
    if (a.sum < 1) return;
    this.stats.fps = a.n / a.sum;
    this.stats.frameMs = (a.sum / a.n) * 1000;
    a.n = 0;
    a.sum = 0;
    this.slowFor = this.stats.frameMs > 24 ? this.slowFor + 1 : 0;
    this.fastFor = this.stats.frameMs < 18 ? this.fastFor + 1 : 0;
    if (this.slowFor >= 2) {
      this.slowFor = 0;
      this.fastFor = 0;
      this.setQuality(this.quality + 1);
    } else if (this.fastFor >= 8 && this.quality > 0 && this.canRaise()) {
      this.fastFor = 0;
      this.setQuality(this.quality - 1);
    }
  }

  /** The lighter steps this device has, in order (a screen of one pixel ratio has no first step). */
  private steps(): readonly ('sharp' | 'shadow-small' | 'shadow-off' | 'coarse')[] {
    const full = Math.min(2, window.devicePixelRatio || 1);
    return full > 1.01 ? ['sharp', 'shadow-small', 'shadow-off', 'coarse'] : ['shadow-small', 'shadow-off', 'coarse'];
  }

  /**
   * Going back up never turns shadows on again (that rebuilds every shader: a freeze, the very thing this avoids);
   * the pixel ratio and the size of the shadows do come back.
   */
  private canRaise(): boolean {
    return this.steps()[this.quality - 1] !== 'shadow-off';
  }

  /**
   * Draw `q` steps lighter than full: a sharp screen first drawn at a lower pixel ratio, then smaller shadows, then
   * none, then fewer pixels than the screen has.
   */
  private setQuality(q: number): void {
    const steps = this.steps();
    const k = Math.max(0, Math.min(steps.length, q));
    if (k === this.quality) return;
    this.quality = k;
    const on = (step: (typeof steps)[number]) => steps.indexOf(step) >= 0 && steps.indexOf(step) < k;
    const full = Math.min(2, window.devicePixelRatio || 1);
    this.prCap = on('coarse') ? 0.75 : on('sharp') ? Math.max(1, full - 0.5) : full;
    if (on('shadow-off')) {
      if (this.stats.shadows) {
        // without shadows every shader is a different one: they are compiled in the background (the town goes on
        // drawing with its small shadows meanwhile) and the shadows go once they are ready, never in a frozen frame
        this.stats.shadows = false;
        const r = this.renderer;
        const off = (on: boolean) => {
          this.town.setShadows(!on, 1024);
          r.shadowMap.enabled = !on;
        };
        off(true);
        let compiled: Promise<unknown>;
        try {
          compiled = r.compileAsync(this.town.scene, this.camera);
        } catch {
          compiled = Promise.resolve();
        }
        off(false);
        const done = () => {
          if (this.running && !this.stats.shadows) off(true);
        };
        compiled.then(done, done);
      }
    } else if (this.stats.shadows) this.town.setShadows(true, on('shadow-small') ? 1024 : 2048);
    this.resize(this.viewW, this.viewH);
    this.quiet(1);
  }

  private applyNight(): void {
    this.town.setNight(this.night);
    const rig = lightRig(this.night);
    this.townExposure = rig.exposure;
    this.renderer.toneMappingExposure = this.room ? roomExposure(this.night) : rig.exposure;
    for (const p of this.people.values()) p.ch.setNight(this.night);
    this.room?.setNight(this.night);
    this.pal = paletteFor(this.night > 0.5 ? 'night' : 'day');
  }

  private restDist(): number {
    return restDistance(this.viewW - this.safe.left - Math.max(this.safe.right, this.inset.right) * 0.5, this.viewH) * this.zoomUser;
  }

  /** The aspect of what the panels and the HUD leave free. */
  private freeAspect(): number {
    const w = Math.max(120, this.viewW - this.safe.left - Math.max(this.inset.right, this.safe.right));
    const h = Math.max(120, this.viewH - this.safe.top - Math.max(this.inset.bottom, this.safe.bottom));
    return w / h;
  }

  /** How much of the full view's height the free part is (a fit uses that share). */
  private freeShareH(): number {
    return Math.max(0.25, (this.viewH - this.safe.top - Math.max(this.inset.bottom, this.safe.bottom)) / this.viewH);
  }

  /**
   * Where the camera wants to look and from how far, then it eases there (docs/town.md §7 "The camera"). In free play
   * it follows the player, keeping them in the middle of what the panels and the HUD leave free, with a short critically
   * damped lag (FOLLOW_W, no overshoot) and nothing else: no framing of anybody, no pull toward anything. Zoom and turn
   * are the learner's. Only what the learner asks for moves it elsewhere: a conversation, a new building, the overview;
   * the way there and back is a glide (GLIDE_W, softer over a long way).
   */
  private aim(dt: number, snap: boolean): void {
    const goal = this.goal();
    const far = Math.hypot(goal.at.x - this.target.x, goal.at.z - this.target.z);
    if (goal.mode !== this.camMode) {
      // a change of what it shows: a glide there (or back to the player), however far
      this.camMode = goal.mode;
      this.camW = far > FAR_TILES ? Math.max(FAR_W, (GLIDE_W * FAR_TILES) / far) : GLIDE_W;
    } else if (goal.mode === 'follow' && this.camW < this.followW) {
      // back on the player: the glide firms up into the follow
      this.camW = Math.min(this.followW, this.camW + (this.followW * Math.max(0, dt)) / FIRM_SECONDS);
    } else if (goal.mode === 'follow') this.camW = this.followW;
    if (snap || dt <= 0) {
      this.target = { ...goal.at };
      this.targetV = { x: 0, z: 0 };
      this.yV = 0;
      this.dist = goal.dist;
      this.distV = 0;
      this.yaw = this.yawGoal;
      this.yawV = 0;
      this.pitch = goal.pitch;
      this.pitchV = 0;
      this.shift = { ...this.shiftGoal };
      if (goal.mode === 'follow') this.camW = this.followW;
    } else {
      const w = this.camW;
      [this.target.x, this.targetV.x] = springStep(this.target.x, this.targetV.x, goal.at.x, w, dt);
      [this.target.z, this.targetV.z] = springStep(this.target.z, this.targetV.z, goal.at.z, w, dt);
      [this.target.y, this.yV] = springStep(this.target.y, this.yV, goal.at.y, w, dt);
      [this.dist, this.distV] = springStep(this.dist, this.distV, goal.dist, ZOOM_W, dt);
      [this.yaw, this.yawV] = springStep(this.yaw, this.yawV, this.yawGoal, 9, dt);
      [this.pitch, this.pitchV] = springStep(this.pitch, this.pitchV, goal.pitch, ZOOM_W, dt);
      const k = 1 - Math.exp(-dt * 8);
      this.shift.x += (this.shiftGoal.x - this.shift.x) * k;
      this.shift.y += (this.shiftGoal.y - this.shift.y) * k;
      // at rest means exactly at rest (a still player under a still camera: no creeping by thousandths)
      // (a thousandth of a tile is a fifth of a pixel: the settling tail of a stop ends there, not seconds later)
      if (Math.abs(this.target.x - goal.at.x) + Math.abs(this.target.z - goal.at.z) < 1e-3 && Math.abs(this.targetV.x) + Math.abs(this.targetV.z) < 0.02) {
        this.target.x = goal.at.x;
        this.target.z = goal.at.z;
        this.targetV.x = this.targetV.z = 0;
      }
      if (Math.abs(this.target.y - goal.at.y) < 1e-4 && Math.abs(this.yV) < 1e-3) {
        this.target.y = goal.at.y;
        this.yV = 0;
      }
      if (Math.abs(this.dist - goal.dist) < 1e-4 && Math.abs(this.distV) < 1e-3) {
        this.dist = goal.dist;
        this.distV = 0;
      }
      if (Math.abs(this.yaw - this.yawGoal) < 1e-5 && Math.abs(this.yawV) < 1e-4) {
        this.yaw = this.yawGoal;
        this.yawV = 0;
      }
      if (Math.abs(this.pitch - goal.pitch) < 1e-5 && Math.abs(this.pitchV) < 1e-4) {
        this.pitch = goal.pitch;
        this.pitchV = 0;
      }
      if (Math.abs(this.shift.x - this.shiftGoal.x) + Math.abs(this.shift.y - this.shiftGoal.y) < 0.01) this.shift = { ...this.shiftGoal };
    }
    const pos = cameraPosition(this.target, this.yaw, this.pitch, this.dist);
    this.camera.position.set(pos.x, pos.y, pos.z);
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
    this.camera.near = Math.max(0.3, this.dist * 0.3);
    this.camera.far = this.dist * 3 + this.world.size * 2;
    this.camera.setViewOffset(this.viewW, this.viewH, -this.shift.x, -this.shift.y, this.viewW, this.viewH);
    this.camera.updateProjectionMatrix();
  }

  private goal(): { mode: string; at: P3; dist: number; pitch: number } {
    const aspect = this.freeAspect();
    const rest = this.restDist();
    const S = this.world.size;
    if (this.overview && !this.focus) {
      const c = { x: S / 2, y: 0, z: S / 2 };
      const pts = [
        { x: 0, y: 0, z: 0 },
        { x: S, y: 0, z: 0 },
        { x: 0, y: 0, z: S },
        { x: S, y: 0, z: S },
        { x: 0, y: 1.5, z: 0 },
      ];
      return { mode: 'overview', at: c, dist: fitDistance(pts, c, this.yaw, PITCH, aspect, 0.95 * this.freeShareH()), pitch: PITCH };
    }
    if (this.showcase && !this.focus) return { mode: 'show', at: this.showcase.at, dist: this.showcase.dist, pitch: PITCH };
    // fishing: the player on the pier and the float on the water, a little closer than the usual view
    if (this.fish && !this.focus && !this.fish.done()) {
      const m = this.fish.middle();
      return { mode: 'fish', at: { x: m.x, y: 0.3, z: m.y }, dist: rest * 0.85, pitch: PITCH };
    }
    const p = this.sim.player;
    const r = this.focus ? this.sim.residents.get(this.focus) : null;
    if (r) {
      // a conversation: both whole, head to feet, in what the panel leaves free; as big as that allows
      const a = this.headOf('player', p);
      const b = this.headOf(r.place.id, r);
      const lift = this.town.lift;
      const pts = [
        { x: p.x, y: lift(p.x, p.y), z: p.y },
        { x: r.x, y: lift(r.x, r.y), z: r.y },
        // room over the heads for the talk bubble
        { ...a, y: a.y + 0.45 },
        { ...b, y: b.y + 0.45 },
      ];
      // staged at a place's front: a little of the building behind them too (where they are reads at a glance)
      const bd = this.staged?.phase === 'outside' ? this.staged.spots?.backdrop : null;
      if (bd) pts.push({ x: bd.x, y: bd.h, z: bd.y });
      const c = { x: (p.x + r.x) / 2, y: 0.5 + (pts[0].y + pts[1].y) / 2, z: (p.y + r.y) / 2 };
      const fit = fitDistance(pts, c, this.yaw, TALK_PITCH, aspect, 0.8 * this.freeShareH());
      return { mode: 'talk', at: c, dist: Math.max(rest * 0.5, Math.min(rest * TALK_MAX, fit)), pitch: TALK_PITCH };
    }
    let dist = rest;
    if (this.full && this.viewW >= 900) {
      const fit = this.builtFit(aspect);
      if (fit) dist = Math.max(dist, Math.min(rest / 0.62, Math.max(rest, fit)));
    }
    // the player, in the middle (a hair ahead of a walker); held back over the island only at its very edge
    // (on the hill the point followed rises with the ground under the player)
    const at = followPoint({ x: p.x, z: p.y }, this.pv, S, dist, PITCH, aspect, 0.3 + this.town.lift(p.x, p.y), followLead(this.followW));
    return { mode: 'follow', at, dist, pitch: PITCH };
  }

  /** The distance that shows every built place (and the plaza) on a full screen. */
  private builtFit(aspect: number): number | null {
    const pts: P3[] = [];
    const { plaza } = this.world;
    pts.push({ x: plaza.x - plaza.r, y: 0, z: plaza.y - plaza.r }, { x: plaza.x + plaza.r, y: 0, z: plaza.y + plaza.r });
    for (const v of this.town.places.values()) {
      if (!v.built) continue;
      pts.push(v.box.min, { ...v.box.max, y: v.height });
    }
    if (pts.length <= 2) return null;
    const c = pts.reduce((a, s) => ({ x: a.x + s.x / pts.length, y: 0, z: a.z + s.z / pts.length }), { x: 0, y: 0, z: 0 });
    return fitDistance(pts, c, this.yaw, PITCH, aspect, 0.9);
  }

  /**
   * What the player can act on from where they stand (E / Enter / Space, the main button): an activity's spot or a
   * lot's gate within SPOT_REACH, else the nearest resident within TALK_REACH (the free position, not a tile). For the
   * main button only once the player has stopped (`still`), so it does not flicker past people on the way.
   */
  private nearNow(still: boolean): Near {
    const p = this.sim.player;
    if (still && (p.moving || p.v > 0.05)) return null;
    // (a thing that is not there now, the bus before its station, is no spot: town.activities has what stands)
    const act = this.activitySpots.find(([id, a]) => this.town.activities.has(id) && Math.hypot(a.stand.x + 0.5 - p.x, a.stand.y + 0.5 - p.y) < SPOT_REACH);
    if (act) return { kind: 'activity', id: act[0] };
    let near: Near = null;
    let best = TALK_REACH;
    for (const r of this.sim.residents.values()) {
      if (r.hidden || !this.inTown(r.place.id) || (r.lodger && !r.engaged)) continue;
      const d = Math.hypot(p.x - r.x, p.y - r.y);
      if (d < best) {
        best = d;
        near = { kind: 'resident', placeId: r.place.id };
      }
    }
    if (near) return near;
    const lot = this.world.places.find((q) => this.sim.isSite(q.id) && Math.hypot(q.door.x + 0.5 - p.x, q.door.y + 0.5 - p.y) < SPOT_REACH);
    return lot ? { kind: 'lot', placeId: lot.id } : null;
  }

  private updateNear(): void {
    const near = this.nearNow(true);
    const same = near?.kind === this.near?.kind && (near?.kind === 'activity' ? near.id === (this.near as { id?: string }).id : (near as { placeId?: string } | null)?.placeId === (this.near as { placeId?: string } | null)?.placeId);
    if (!same) {
      this.near = near;
      this.cb.onNear?.(near);
    }
  }

  // ───────────────────────── people ─────────────────────────

  private dressPlayer(ch: Character3D): void {
    const look = this.state.look;
    ch.setHat(look?.hat ?? null);
    const color = look?.outfit ? (look.outfit.startsWith('#') ? look.outfit : (lootItem(look.outfit)?.color ?? null)) : null;
    ch.setOutfit(color);
  }

  private personFor(a: Actor): Person | null {
    let p = this.people.get(a.id);
    if (p) return p;
    let ch: Character3D;
    if (a.kind === 'cat') return null;
    if (a.kind === 'folk') {
      const f = a as Folk;
      ch = createCharacter(a.id, passerLook(f.look * 7 + 3, f.kid));
    } else ch = createCharacter(a.id);
    shade(ch.root);
    ch.setNight(this.night);
    if (a.kind === 'player') {
      this.dressPlayer(ch);
      // the player's body follows the keys closely (the sim's own turn is already eased)
      const an = (ch as Character3DPlus).animator;
      if (an) {
        an.turnWalk = PLAYER_TURN_W;
        an.turnStand = PLAYER_TURN_W;
      }
    }
    this.town.scene.add(ch.root);
    const heading = octantHeading(a.oct);
    ch.setHeading(heading, true);
    p = { ch, action: 'idle', oneShot: 0, last: { x: a.x, y: a.y }, speed: 0, heading, rx: a.x, rz: a.y, fx: a.x, fz: a.y, sx: a.x, sz: a.y, slide: 1, seatHop: 0, seated: false, wasSeated: false, walking: false, slowFor: 0, pending: null, pendingUntil: 0 };
    this.people.set(a.id, p);
    return p;
  }

  /** What somebody is doing this frame, as an action of the characters module. */
  private actionOf(a: Actor, walking: boolean): CharAction {
    if (a.kind === 'player' && this.riding >= 0) return 'sit';
    const r = a.kind === 'resident' ? (a as Resident) : null;
    if (r?.seat || (a.kind === 'player' && this.sim.playerSeat)) return 'sit';
    if (walking) return r?.doing?.kind === 'jog' ? 'run' : 'walk';
    if (this.speaking && (this.speaking === a.id || (a.kind === 'player' && this.speaking === 'player'))) return 'talk';
    const d = r?.doing;
    if (r && d?.arrived && !a.moving) {
      if (d.kind === 'fish') return 'fish';
      if (d.kind === 'tend') return 'water';
      if (d.kind === 'read') return 'read';
      if (d.kind === 'chat' && (this.says.get(r.id) ?? 0) > this.t) return 'talk';
    }
    return 'idle';
  }

  /** The way somebody faces this frame (radians on the ground). */
  private headingFor(a: Actor): number {
    const r = a.kind === 'resident' ? (a as Resident) : null;
    if (r?.seat) return octantHeading(r.seat.oct);
    if (a.kind === 'player' && this.sim.playerSeat) return octantHeading(this.sim.playerSeat.oct);
    // the sim's own body direction: walking, it steers round corners (no walking sideways); standing, it eases round
    let h = a.yaw ?? octantHeading(a.oct);
    if (a.moving) return h;
    if (this.focus && (a.kind === 'player' || a.id === this.focus)) {
      // a conversation: the two turn to each other (full, for the greeting), then three-quarters to the viewer
      const o = a.kind === 'player' ? this.sim.residents.get(this.focus) : this.sim.player;
      if (o) {
        h = headingOf(o.x - a.x, o.y - a.y);
        const k = Math.min(1, Math.max(0, (this.t - this.talkSince - TALK_GREET) / 0.8));
        if (k > 0) h = towardViewer(h, this.yaw, TALK_TOWARD_VIEWER * k * k * (3 - 2 * k));
      }
      return h;
    }
    const d = r?.doing;
    if (r && d?.arrived) {
      if (d.kind === 'chat' && d.mate) {
        // a chat: the two face each other, a touch toward the viewer
        const m = this.sim.residents.get(d.mate);
        if (m && !m.hidden) return towardViewer(headingOf(m.x - r.x, m.y - r.y), this.yaw, 0.3);
      }
      if (d.kind === 'fish') {
        // side-on to the viewer (the rod reads against the water), on the side of the water
        const s0 = this.yaw + Math.PI / 2;
        const s1 = this.yaw - Math.PI / 2;
        const best = Math.abs(angleDiff(s0, h)) < Math.abs(angleDiff(s1, h)) ? s0 : s1;
        // (still facing the water: turned at most half a radian toward side-on)
        return h + Math.max(-0.5, Math.min(0.5, angleDiff(h, best)));
      }
    }
    return h;
  }

  private place(id: string, a: Actor, dt: number, show: boolean): void {
    const p = this.personFor(a);
    if (!p) return;
    // well off the screen: not drawn, not animated (the sim walks them on; in the city's crowd, posing everybody
    // every frame was a good part of a frame's work)
    const off = Math.hypot(a.x - this.target.x, a.y - this.target.z) > this.reach;
    p.ch.root.visible = show && !off;
    if (show && off) {
      p.rx = p.sx = a.x;
      p.rz = p.sz = a.y;
      p.slide = 1;
      p.last.x = a.x;
      p.last.y = a.y;
      p.ch.root.position.set(a.x, this.town.lift(a.x, a.y), a.y);
      return;
    }
    p.last.x = a.x;
    p.last.y = a.y;
    if (!show) {
      p.rx = p.sx = a.x;
      p.rz = p.sz = a.y;
      p.slide = 1;
      return;
    }
    // drawn where the sim has them; a small hop while standing (backing onto a seat, up off it) is eased. Seated,
    // the hips sit a little forward of the seat's middle (the knees clear its front edge), as high as its top
    const seat = a.kind === 'resident' ? (a as Resident).seat : a.kind === 'player' ? this.sim.playerSeat : null;
    p.wasSeated = p.seated;
    p.seated = !!seat;
    let tx = a.x;
    let tz = a.y;
    if (seat) {
      const h = octantHeading(seat.oct);
      tx += Math.cos(h) * SEAT_FORWARD;
      tz += Math.sin(h) * SEAT_FORWARD;
      (p.ch as Character3DPlus).setSeatHeight?.(SEAT_TOP);
    }
    if (a.kind === 'player' && this.riding >= 0) (p.ch as Character3DPlus).setSeatHeight?.(RIDES[this.rides[this.riding].kind].seat);
    const gap = Math.hypot(tx - p.rx, tz - p.rz);
    // (the last hundredths of a walk onto its end point are not a hop)
    if (a.moving || this.still || gap > 1.1 || (gap < 0.06 && p.slide >= 1)) {
      p.rx = p.sx = tx;
      p.rz = p.sz = tz;
      p.slide = 1;
    } else {
      // a new spot to stand on: eased in and out over SLIDE_TIME from where the body is drawn now
      if (Math.abs(tx - p.sx) > 1e-4 || Math.abs(tz - p.sz) > 1e-4) {
        p.fx = p.rx;
        p.fz = p.rz;
        p.sx = tx;
        p.sz = tz;
        p.slide = 0;
        // onto a seat, or up off it: the hop follows the sitting down / getting up (never through the bench)
        p.seatHop = seat ? 1 : p.wasSeated ? -1 : 0;
      }
      if (p.slide < 1) {
        p.slide = Math.min(1, p.slide + dt / SLIDE_TIME);
        let k = p.slide * p.slide * (3 - 2 * p.slide);
        const sb = (p.ch as Character3DPlus).animator?.seatBlend;
        // backing on once the hips are up past half way; stepping off while they are still high
        if (sb !== undefined && p.seatHop > 0) k = Math.min(k, smoothstepK(0.4, 0.95, sb));
        else if (sb !== undefined && p.seatHop < 0) k = Math.max(k, 1 - smoothstepK(0.1, 0.75, sb));
        if (p.seatHop !== 0 && p.slide >= 1 && k < 1) p.slide = 0.999;
        p.rx = p.fx + (p.sx - p.fx) * k;
        p.rz = p.fz + (p.sz - p.fz) * k;
      }
    }
    // fishing: out on the pier (over the water, where the sim never walks), facing the water with the rod
    if (a.kind === 'player' && this.fish) {
      const f = this.fish.pose();
      p.rx = p.sx = f.x;
      p.rz = p.sz = f.y;
      p.slide = 1;
      p.ch.root.position.set(f.x, 0, f.y);
      p.walking = f.speed > 0;
      p.speed = f.speed;
      if (Math.abs(angleDiff(p.heading, f.heading)) > 1e-3) {
        p.heading = f.heading;
        p.ch.setHeading(f.heading, this.still);
      }
      (p.ch as Character3DPlus).castLine?.(f.line ? this.fishLine.set(f.line.x, f.line.y, f.line.z) : null);
      if (p.oneShot <= this.t && p.action !== f.action) {
        p.action = f.action;
        p.ch.setAction(f.action);
      }
      p.ch.update(this.still ? 0 : dt, this.still ? 0 : f.speed);
      return;
    }
    p.ch.root.position.set(p.rx, this.town.lift(p.rx, p.rz), p.rz);
    // everybody wears a VRoid avatar once they are near the middle of the view, the nearest few at a time
    // (chars/vrmPeople.ts: the learner's own choice; one file at a time); the learner's own is put on at once
    if (a.kind === 'player') dressInVrm(p.ch);
    else dressWhenNear(p.ch, p.rx - this.target.x, p.rz - this.target.z);
    // the legs walk at the sim's own pace (the feet are planted where the body goes: chars/anim.ts)
    const pace = a.moving ? a.v : 0;
    p.speed = pace;
    if (p.walking) {
      p.slowFor = pace < WALK_OFF ? p.slowFor + dt : 0;
      if (p.slowFor >= WALK_OFF_TIME || !a.moving) p.walking = false;
    } else if (a.moving && pace > WALK_ON) {
      p.walking = true;
      p.slowFor = 0;
    }
    const h = this.headingFor(a);
    if (Math.abs(angleDiff(p.heading, h)) > 1e-3) {
      p.heading = h;
      p.ch.setHeading(h, this.still);
    }
    const want = this.actionOf(a, p.walking);
    // a one-shot action (wave, nod, shake, cheer) waits for the turn, then runs to its end unless they walk off
    if (p.pending) {
      const shown = (p.ch as { heading?: number }).heading ?? h;
      if (want === 'walk' || want === 'run') p.pending = null;
      else if (this.t >= p.pendingUntil || Math.abs(angleDiff(shown, h)) < 0.35) this.startShot(p, p.pending);
    }
    if (p.oneShot > this.t) {
      if (want === 'walk' || want === 'run') p.oneShot = 0;
    }
    if (p.oneShot <= this.t && want !== p.action) {
      p.action = want;
      p.ch.setAction(want);
    }
    p.ch.update(this.still ? 0 : dt, this.still ? 0 : pace);
    this.footPuff(p);
    void id;
  }

  /** A little puff of dust under a runner's foot as it lands (not under reduced motion). */
  private footPuff(p: Person): void {
    const an = (p.ch as Character3DPlus).animator;
    if (!an) return;
    const was = p.falls ?? an.footfalls;
    p.falls = an.footfalls;
    if (an.footfalls === was || this.still || an.runShare < PUFF_RUN) return;
    // kicked up a little behind the foot; not for somebody running at the camera (the overlay would draw the puff
    // over their legs, where the body really hides it)
    const fx = Math.cos(an.heading);
    const fz = Math.sin(an.heading);
    const root = p.ch.root.position;
    const cx = this.camera.position.x - root.x;
    const cz = this.camera.position.z - root.z;
    if ((fx * cx + fz * cz) / (Math.hypot(cx, cz) || 1) > 0.35) return;
    const [ax, az] = an.foot(an.lastFoot);
    const x = ax - fx * 0.06;
    const z = az - fz * 0.06;
    const y = this.town.lift(x, z);
    this.v.set(x, y, z).project(this.camera);
    if (this.v.z > 1) return;
    const sx = ((this.v.x + 1) / 2) * this.viewW;
    const sy = ((1 - this.v.y) / 2) * this.viewH;
    if (sx < -20 || sy < -20 || sx > this.viewW + 20 || sy > this.viewH + 20) return;
    this.puffAt.x = sx;
    this.puffAt.y = sy;
    this.puffWorld.x = x;
    this.puffWorld.y = y;
    this.puffWorld.z = z;
    this.particles.puff(this.puffAt, this.puffWorld, Math.min(1.6, Math.max(0.6, this.viewH / 900)));
  }

  private syncPeople(dt: number): void {
    if (this.focus !== this.talkWith) {
      this.talkWith = this.focus;
      this.talkSince = this.t;
    }
    const seen = new Set<string>();
    for (const r of this.sim.residents.values()) {
      seen.add(r.id);
      this.place(r.id, r, dt, !r.hidden && this.inTown(r.place.id));
    }
    for (const f of this.sim.folk) {
      if (f.hidden && !this.people.has(f.id)) continue;
      seen.add(f.id);
      this.place(f.id, f, dt, !f.hidden);
    }
    seen.add('player');
    this.place('player', this.sim.player, dt, true);
    // the cat
    const cat = this.sim.cat;
    if (cat) {
      seen.add('cat');
      let c = this.people.get('cat');
      if (!c) {
        const pet = createPet('cat');
        shade(pet.root);
        this.town.scene.add(pet.root);
        c = { ch: petAsCharacter(pet), action: 'idle', oneShot: 0, last: { x: cat.x, y: cat.y }, speed: 0, heading: octantHeading(cat.oct), rx: cat.x, rz: cat.y, fx: cat.x, fz: cat.y, sx: cat.x, sz: cat.y, slide: 1, seatHop: 0, seated: false, wasSeated: false, walking: false, slowFor: 0, pending: null, pendingUntil: 0 };
        pet.setHeading(c.heading, true);
        this.people.set('cat', c);
      }
      const dx = cat.x - c.last.x;
      const dy = cat.y - c.last.y;
      const moved = Math.hypot(dx, dy);
      c.last = { x: cat.x, y: cat.y };
      c.speed = dt > 0 ? c.speed + (moved / dt - c.speed) * Math.min(1, dt * 12) : 0;
      c.ch.root.position.set(cat.x, this.town.lift(cat.x, cat.y), cat.y);
      const h = cat.moving && moved > 1e-4 ? headingOf(dx, dy) : octantHeading(cat.oct);
      if (Math.abs(angleDiff(c.heading, h)) > 1e-3) {
        c.heading = h;
        c.ch.setHeading(h, this.still);
      }
      c.ch.update(this.still ? 0 : dt, this.still || cat.sit > 0 ? 0 : c.speed);
    }
    for (const [id, p] of this.people) {
      if (seen.has(id)) continue;
      this.town.scene.remove(p.ch.root);
      p.ch.dispose();
      this.people.delete(id);
    }
    // the two in a conversation look at each other; residents close by look at the player
    const pl = this.people.get('player');
    const talking = this.focus ? this.people.get(this.focus) : null;
    if (pl && talking) {
      // each looks at the other, their faces kept a little towards the camera (a full turn to the partner reads as
      // the back of a head from up here)
      const cam = this.camera.position;
      pl.ch.lookAt(talking.ch.headTop(new Vector3()).lerp(cam, TALK_LOOK_CAMERA));
      talking.ch.lookAt(pl.ch.headTop(new Vector3()).lerp(cam, TALK_LOOK_CAMERA));
    } else if (pl) {
      pl.ch.lookAt(null);
      const head = pl.ch.headTop(new Vector3());
      for (const r of this.sim.residents.values()) {
        const p = this.people.get(r.id);
        if (!p) continue;
        const close = !r.hidden && !r.seat && !r.moving && Math.hypot(r.x - this.sim.player.x, r.y - this.sim.player.y) < 2.2;
        p.ch.lookAt(close ? head : null);
      }
    }
  }

  /** The pet walks along the player's way, PET_BEHIND tiles back, at its own pace. */
  private updatePet(dt: number): void {
    const pl = this.sim.player;
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(pl.x - last.x, pl.y - last.y) > 0.05) this.trail.push({ x: pl.x, y: pl.y });
    if (this.trail.length > 60) this.trail.splice(0, this.trail.length - 60);
    const kind = this.state.look?.pet;
    if (!kind || this.pet?.kind !== kind) {
      if (this.pet) {
        this.town.scene.remove(this.pet.p.root);
        this.pet.p.dispose();
        this.pet = null;
      }
      if (!kind) return;
    }
    let left = PET_BEHIND;
    let at = { x: pl.x, y: pl.y };
    for (let i = this.trail.length - 1; i > 0 && left > 0; i--) {
      const a = this.trail[i];
      const b = this.trail[i - 1];
      const l = Math.hypot(a.x - b.x, a.y - b.y);
      if (l >= left) {
        at = { x: a.x + ((b.x - a.x) * left) / l, y: a.y + ((b.y - a.y) * left) / l };
        left = 0;
      } else {
        at = b;
        left -= l;
      }
    }
    if (left > 0) at = { x: pl.x - 0.5, y: pl.y + 0.35 };
    if (!this.pet) {
      const p = createPet(kind);
      shade(p.root);
      this.town.scene.add(p.root);
      this.pet = { kind, p, x: at.x, y: at.y, walking: false, heading: octantHeading(pl.oct) };
      p.setHeading(this.pet.heading, true);
    }
    const pet = this.pet;
    const dx = at.x - pet.x;
    const dy = at.y - pet.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, (pl.speed * 1.15 + dist * 2) * dt);
    pet.walking = dist > 0.04;
    if (dist > 1e-6) {
      pet.x += (dx / dist) * step;
      pet.y += (dy / dist) * step;
      if (pet.walking) pet.heading = headingOf(dx, dy);
    }
    if (!pet.walking && !pl.moving) pet.heading = octantHeading(pl.oct);
    pet.p.root.position.set(pet.x, this.town.lift(pet.x, pet.y), pet.y);
    pet.p.setHeading(pet.heading, this.still);
    pet.p.update(this.still ? 0 : dt, pet.walking && dt > 0 ? step / dt : 0);
  }

  /** The learner's children walk behind the player, after the pet (the youngest last), in step with them. */
  private updateKids(dt: number): void {
    const want = this.state.kids ?? [];
    const key = (k: (typeof want)[number]) => `${k.id}|${k.skin}|${k.hair}|${k.toddler ? 't' : 'c'}`;
    if (this.kids.length !== want.length || this.kids.some((k, i) => k.key !== key(want[i]))) {
      for (const k of this.kids) {
        this.town.scene.remove(k.ch.root);
        k.ch.dispose();
      }
      const pl = this.sim.player;
      this.kids = want.map((k, i) => {
        const base = passerLook(hashOf(k.id), true);
        const look = { ...base, skin: k.skin, hair: { ...base.hair, color: k.hair }, scale: (base.scale ?? 0.8) * (k.toddler ? 0.78 : 1) };
        const ch = createCharacter(`kid:${k.id}`, look);
        shade(ch.root);
        ch.setNight(this.night);
        this.town.scene.add(ch.root);
        const heading = octantHeading(pl.oct);
        ch.setHeading(heading, true);
        return { key: key(k), ch, x: pl.x - 0.6 * (i + 1), y: pl.y + 0.6 * (i + 1), walking: false, heading, action: 'idle' as CharAction };
      });
    }
    if (this.kids.length === 0) return;
    const pl = this.sim.player;
    this.kids.forEach((kid, i) => {
      // a point of the player's trail further back than the pet
      let left = PET_BEHIND + 0.75 * (i + 1) + (this.pet ? 0.4 : 0);
      let at = { x: pl.x, y: pl.y };
      for (let j = this.trail.length - 1; j > 0 && left > 0; j--) {
        const a = this.trail[j];
        const b = this.trail[j - 1];
        const l = Math.hypot(a.x - b.x, a.y - b.y);
        if (l >= left) {
          at = { x: a.x + ((b.x - a.x) * left) / l, y: a.y + ((b.y - a.y) * left) / l };
          left = 0;
        } else {
          at = b;
          left -= l;
        }
      }
      if (left > 0) at = { x: pl.x + 0.55 * (i + 1), y: pl.y + 0.5 * (i + 1) };
      const dx = at.x - kid.x;
      const dy = at.y - kid.y;
      const dist = Math.hypot(dx, dy);
      // far behind (a dip, a warp): there at once
      if (dist > 6) {
        kid.x = at.x;
        kid.y = at.y;
      }
      const step = Math.min(dist, (pl.speed * 1.1 + dist * 2) * dt);
      kid.walking = dist > 0.05;
      if (dist > 1e-6 && dist <= 6) {
        kid.x += (dx / dist) * step;
        kid.y += (dy / dist) * step;
        if (kid.walking) kid.heading = headingOf(dx, dy);
      }
      if (!kid.walking && !pl.moving) kid.heading = octantHeading(pl.oct);
      const action: CharAction = kid.walking ? (pl.speed > 2.2 ? 'run' : 'walk') : 'idle';
      if (action !== kid.action) {
        kid.action = action;
        kid.ch.setAction(action);
      }
      kid.ch.root.position.set(kid.x, this.town.lift(kid.x, kid.y), kid.y);
      dressWhenNear(kid.ch, kid.x - this.target.x, kid.y - this.target.z);
      kid.ch.setHeading(kid.heading, this.still);
      kid.ch.update(this.still ? 0 : dt, kid.walking && dt > 0 ? step / dt : 0);
    });
  }

  private spawnPetals(dt: number): void {
    if (this.still || !this.state.decorations.includes('blossom')) return;
    for (const s of this.world.decorations.blossom ?? []) {
      if (Math.random() > dt * 0.3) continue;
      const at = this.project(s.x + 0.5 + (Math.random() - 0.5) * 0.6, 1.2, s.y + 0.5 + (Math.random() - 0.5) * 0.6);
      if (at.x > -20 && at.y > -20 && at.x < this.viewW + 20 && at.y < this.viewH + 20) this.particles.petal(at);
    }
  }

  // ───────────────────────── drawing ─────────────────────────

  /** A scene point on the stage, CSS px. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    this.v.set(x, y, z).project(this.room ? this.room.camera : this.camera);
    return { x: ((this.v.x + 1) / 2) * this.viewW, y: ((1 - this.v.y) / 2) * this.viewH };
  }

  private render(): void {
    if (this.room) {
      // a talk in a room: its own scene, lights, exposure and shot
      this.renderer.toneMappingExposure = roomExposure(this.night);
      this.renderer.render(this.room.scene, this.room.camera);
      this.drawOverlay();
      return;
    }
    if (this.renderer.toneMappingExposure !== this.townExposure) this.renderer.toneMappingExposure = this.townExposure;
    // pops: things being built grow out of the ground
    for (const b of this.town.built) {
      if (!b.pop) continue;
      const k = this.popOf(b.pop, b.index);
      setPop(b.obj, k);
    }
    // the goal ring and the hovered tile
    const goal = this.sim.goal;
    this.goalMesh.visible = !!goal;
    if (goal) {
      const k = this.still ? 0.5 : (this.t * 1.2) % 1;
      this.onGround(this.goalMesh, goal.x + 0.5, goal.y + 0.5, MARK_Y + 0.005);
      this.goalMesh.scale.setScalar(0.7 + k * 0.5);
      (this.goalMesh.material as MeshBasicMaterial).opacity = 0.9 - k * 0.6;
    }
    // the hovered square: only a walkable tile under the mouse, never while the keys walk, a panel or a conversation is
    // open, or the pointer is off the canvas, nor under the player (people and houses have their own highlight); snapped
    // to its tile
    const hv = this.hover;
    const me = this.sim.player;
    this.hoverMesh.visible =
      hv?.kind === 'tile' && hv.walkable && !this.paused && !this.focus && this.pointerLive && !!this.pointer && !this.keysHeld() && this.ready && !(hv.tile.x === Math.floor(me.x) && hv.tile.y === Math.floor(me.y));
    if (hv?.kind === 'tile') this.onGround(this.hoverMesh, hv.tile.x + 0.5, hv.tile.y + 0.5, MARK_Y);
    this.fadeInFront();
    const e = groundHalfExtent(this.dist, this.pitch, this.camera.aspect);
    this.town.mats.shared.time.value = this.t;
    this.town.mats.shared.sway.value = this.still ? 0 : 1;
    this.town.update(this.t, this.target, Math.max(e.across, e.deep) * 1.25, this.still);
    // how far from the camera's target somebody is still drawn and animated (next frame's place): what shows, a margin
    this.reach = Math.max(e.across, e.deep) * 1.4 + 3;
    this.drawSky();
    this.renderer.render(this.town.scene, this.camera);
    this.drawOverlay();
  }

  private fadeInFront(): void {
    // whatever stands nearer the camera round the player (and the resident in a conversation) is dithered through
    const r = this.focus ? this.sim.residents.get(this.focus) : null;
    const W = this.renderer.domElement.width;
    const H = this.renderer.domElement.height;
    const kx = W / Math.max(1, this.viewW);
    const ky = H / Math.max(1, this.viewH);
    const floors = this.town.mats.shared.holeFloor.value;
    this.town.mats.shared.holes.value.forEach((h, i) => {
      const a: Actor | null | undefined = i === 0 ? this.sim.player : r;
      if (!a) {
        h.set(0, 0, 0, 0);
        floors[i] = 0;
        return;
      }
      const id = i === 0 ? 'player' : a.id;
      const head = this.headOf(id, a);
      // the ground they stand on (on the hill 1.6 up; a room's floor is 0): nothing at or below it hides them
      const floor = this.room ? 0 : this.town.lift(a.x, a.y);
      floors[i] = floor;
      const top = this.project(head.x, head.y, head.z);
      const feet = this.project(a.x, floor, a.y);
      const mid = { x: a.x, y: floor + (head.y - floor) * 0.55, z: a.y };
      const c = this.project(mid.x, mid.y, mid.z);
      this.v.set(mid.x, mid.y, mid.z).applyMatrix4(this.camera.matrixWorldInverse);
      const tall = Math.max(20, Math.abs(feet.y - top.y));
      h.set(c.x * kx, H - c.y * ky, tall * 0.72 * ky, this.v.z);
    });
    // in a conversation the strings of lights over the plaza step back, and so does any small thing bought for the
    // town (balloons, a stall, a lamp) that stands between the camera and the two
    const now = this.fadedNext;
    now.clear();
    if (r) {
      const pair = this.pairBox(r);
      for (const b of this.town.built) {
        if (b.strings) now.add(b);
        else if (pair && b.pop && b.body && !this.town.places.has(b.pop as PlaceId) && this.inPair(b, pair)) now.add(b);
      }
    }
    for (const b of this.faded) if (!now.has(b)) this.town.fade(b, false);
    for (const b of now) this.town.fade(b, true);
    this.fadedNext = this.faded;
    this.faded = now;
    // the place under the pointer glows a little
    const hot = this.hover?.kind === 'place' ? this.hover.placeId : null;
    this.town.highlight(hot);
  }

  /** Where the two in a conversation are on the stage (CSS px, a little margin) and the far one's view depth. */
  private pairBox(r: Actor): { x0: number; y0: number; x1: number; y1: number; depth: number } | null {
    const p = this.sim.player;
    let box: { x0: number; y0: number; x1: number; y1: number; depth: number } | null = null;
    for (const [id, a] of [['player', p] as const, [r.id, r] as const]) {
      const head = this.headOf(id, a);
      const top = this.project(head.x, head.y, head.z);
      const feet = this.project(a.x, 0, a.y);
      this.v.set(a.x, head.y * 0.5, a.y).applyMatrix4(this.camera.matrixWorldInverse);
      const depth = -this.v.z;
      const half = Math.max(16, Math.abs(feet.y - top.y) * 0.35);
      const b = { x0: Math.min(top.x, feet.x) - half, y0: top.y - 8, x1: Math.max(top.x, feet.x) + half, y1: feet.y + 6, depth };
      box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1), depth: Math.max(box.depth, b.depth) } : b;
    }
    return box;
  }

  /** A bought thing stands in front of the pair in a conversation (its middle inside their box, nearer the camera). */
  private inPair(b: Built, pair: { x0: number; y0: number; x1: number; y1: number; depth: number }): boolean {
    const o = b.obj.position;
    const mid = this.project(o.x, b.height * 0.5, o.z);
    if (mid.x < pair.x0 || mid.x > pair.x1 || mid.y < pair.y0 || mid.y > pair.y1) return false;
    this.v.set(o.x, b.height * 0.5, o.z).applyMatrix4(this.camera.matrixWorldInverse);
    return -this.v.z < pair.depth;
  }

  /** The sky behind the town: day's, night's, or (while the theme changes) night's laid over day's by `night`. */
  private drawSky(): void {
    const c = this.skyCanvas;
    if (!c) return;
    const n = this.night;
    if (this.skyFor === n && this.t - this.skyAt < SKY_EVERY && this.t >= this.skyAt) return;
    const x = c.getContext('2d');
    if (!x) return;
    const k = c.width / Math.max(1, this.viewW);
    const paint = (g: CanvasRenderingContext2D, pal: TownPalette) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.setTransform(k, 0, 0, k, 0, 0);
      g.globalCompositeOperation = 'destination-over';
      drawSky(g, this.viewW, this.viewH, pal, this.t, this.still);
      g.globalCompositeOperation = 'source-over';
    };
    paint(x, n >= 1 ? NIGHT_PAL : DAY_PAL);
    if (n > 0 && n < 1) {
      let h = this.skyBlend;
      if (!h) h = this.skyBlend = document.createElement('canvas');
      if (h.width !== c.width || h.height !== c.height) {
        h.width = c.width;
        h.height = c.height;
      }
      const hx = h.getContext('2d');
      if (hx) {
        paint(hx, NIGHT_PAL);
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.globalAlpha = n;
        x.drawImage(h, 0, 0);
        x.globalAlpha = 1;
      }
    } else if (this.skyBlend) {
      // the change is over: the helper canvas is not needed until the next one
      this.skyBlend.width = this.skyBlend.height = 0;
      this.skyBlend = null;
    }
    this.skyFor = n;
    this.skyAt = this.t;
  }

  private headAt(id: string, a: Actor): { x: number; y: number } {
    const h = this.headOf(id, a);
    const s = this.project(h.x, h.y, h.z);
    return { x: s.x, y: s.y - 6 };
  }

  private drawOverlay(): void {
    const ctx = this.octx;
    const w = this.viewW;
    const h = this.viewH;
    const pal = this.pal;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.room) {
      this.drawRoomOverlay(ctx);
      return;
    }
    const talking = this.focus ? (this.sim.residents.get(this.focus) ?? null) : null;
    if (talking && this.dim > 0.01) {
      // the town steps back round the two who talk: a soft dusk with a clear pool of light on them
      const a = this.project(this.sim.player.x, 0.45, this.sim.player.y);
      const b = this.project(talking.x, 0.45, talking.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const r = Math.max(120, Math.hypot(a.x - b.x, a.y - b.y) * 0.8 + 90);
      const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.9);
      const veil = pal.night ? `rgba(8,10,30,${0.3 * this.dim})` : `rgba(26,30,66,${0.32 * this.dim})`;
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, veil);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // darker corners at night, faded in and out with the night (never a snap halfway)
    if (this.night > 0) {
      ctx.globalAlpha = this.night;
      drawVignette(ctx, w, h, NIGHT_PAL);
      ctx.globalAlpha = 1;
    }
    const tagOpts = { t: this.t, still: this.still, font: this.font };
    if (talking && (this.speaking === talking.place.id || this.speaking === 'player')) {
      const who = this.speaking === 'player' ? this.sim.player : talking;
      const at = this.headAt(this.speaking === 'player' ? 'player' : talking.id, who);
      drawTalkBubble(ctx, pal, at.x, Math.max(this.safe.top + 44, at.y + 2), this.t, this.still);
    }
    // a scene overheard (docs/town.md §19): the bubble over whichever of the two is speaking
    const aside = this.speaking && this.sim.inAside(this.speaking) ? this.sim.residents.get(this.speaking as PlaceId) : undefined;
    if (aside && !aside.hidden) {
      const at = this.headAt(aside.id, aside);
      drawTalkBubble(ctx, pal, at.x, Math.max(this.safe.top + 44, at.y + 2), this.t, this.still);
    }
    if (!this.focus) {
      // the quest followed: under the name tags
      this.drawGuide(ctx, { x0: this.safe.left + 6, y0: this.safe.top + 4, x1: w - Math.max(this.safe.right, this.inset.right) - 6, y1: h - Math.max(this.safe.bottom, this.inset.bottom) - 4 });
      const tags: { box: TagBox; draw: (b: TagBox) => void }[] = [];
      const add = (x: number, y: number, text: string, o: Omit<Parameters<typeof drawTag>[5], 't' | 'still' | 'font'>, alt?: number) => {
        if (x < -30 || x > w + 30 || y < -10 || y > h + 60) return;
        let size = this.tagSizes.get(text);
        if (!size) {
          size = tagSize(ctx, text, this.font);
          if (this.tagSizes.size > 200) this.tagSizes.clear();
          this.tagSizes.set(text, size);
        }
        tags.push({ box: { x, y, ...size, above: o.marker ? 28 : 0, alt }, draw: (b) => drawTag(ctx, pal, b.x, b.y, text, { ...tagOpts, ...o, marker: b.below ? undefined : o.marker }) });
      };
      const p = this.sim.player;
      const hover = this.hover;
      const feetAt = (a: Actor) => this.project(a.x, 0, a.y).y + 26;
      // the suggested resident first, then the hovered or near one, then the others close by (no lists made a frame)
      for (let rank = 0; rank <= 2; rank++) {
        for (const r of this.sim.residents.values()) {
          if (r.hidden || !this.inTown(r.place.id)) continue;
          const id = r.place.id;
          const hot = (hover?.kind === 'resident' && hover.placeId === id) || (this.near?.kind === 'resident' && this.near.placeId === id);
          // (the two overheard from a bench are named, lodgers or not: the panel shows their faces by name)
          const heard = this.sim.inAside(id);
          const its = id === this.hint ? 0 : hot || heard ? 1 : !r.lodger && gridDistance(p.x, p.y, r.x, r.y) < NAME_NEAR ? 2 : 9;
          if (its !== rank) continue;
          const at = this.headAt(r.id, r);
          add(at.x, at.y, r.lodger && !heard ? tl`${r.place.resident} · ở nhà trọ` : r.place.resident, { marker: heard ? undefined : this.state.marker[r.place.id], hover: hot }, feetAt(r));
        }
      }
      const actHot = hover?.kind === 'activity' ? hover.id : this.near?.kind === 'activity' ? this.near.id : null;
      if (actHot) {
        const a = this.town.activities.get(actHot);
        // an activity's own name, or a thing's ("Ghế: ngồi nghe", "Radio Bay FM": scenes/things.ts)
        const name = ACTIVITIES.find((x) => x.id === actHot)?.name ?? thingName(actHot);
        if (a && name) {
          const at = this.project(a.at.x, a.top + 0.15, a.at.z);
          add(at.x, at.y, tr(name), { hover: true });
        }
      }
      const me = this.headAt('player', p);
      add(me.x, me.y, this.playerName === 'Bạn' ? tr('Bạn') : this.playerName, { self: true }, feetAt(p));
      const hoverPlace = hover?.kind === 'place' ? hover.placeId : null;
      for (const q of this.world.places) {
        const v = this.town.places.get(q.id);
        if (!v) continue;
        const built = v.built && this.inTown(q.id);
        const label = built || !this.sim.isSite(q.id) ? undefined : this.lotLabels[q.id];
        const hot = hoverPlace === q.id;
        if (!hot && !label) continue;
        const at = this.project(v.centre.x, (built ? v.height : v.height) + 0.25, v.centre.z);
        add(at.x, at.y, hot ? (label ? `${tr(q.name)} · ${label}` : tr(q.name)) : (label ?? tr(q.name)), { hover: hot, self: !hot });
      }
      const area = { x0: this.safe.left + 6, y0: this.safe.top + 4, x1: w - Math.max(this.safe.right, this.inset.right) - 6, y1: h - Math.max(this.safe.bottom, this.inset.bottom) - 4 };
      placeTags(
        tags.map((t) => t.box),
        area,
      );
      for (const t of tags) if (!t.box.hidden) t.draw(t.box);
      for (const [id, until] of this.says) {
        const a = this.sim.actor(id);
        if (!a || this.t >= until) {
          if (this.t >= until) this.says.delete(id);
          continue;
        }
        const at = this.headAt(id, a);
        if (at.x < -20 || at.x > w + 20 || at.y < this.safe.top || at.y > h) continue;
        drawChatDots(ctx, pal, at.x + 10, at.y + 4, SAY_SECONDS - (until - this.t), SAY_SECONDS, this.still);
      }
    }
    this.drawShows(ctx);
  }

  /** Emotes, rising texts, particles and the dip to dark: over the town and over a room alike. */
  private drawShows(ctx: CanvasRenderingContext2D): void {
    const w = this.viewW;
    const h = this.viewH;
    const now = this.t;
    this.emotes = this.emotes.filter((e) => now - e.born < EMOTE_SECONDS && this.present(e.target));
    const keepIn = (at: { x: number; y: number }, room: number) => ({ x: Math.min(w - 30, Math.max(30, at.x)), y: Math.max(this.safe.top + room, at.y) });
    for (const e of this.emotes) {
      const at = this.screenPointOf(e.target);
      if (at) drawEmote(ctx, e.kind, keepIn(at, 62), now - e.born, this.still);
    }
    this.floats = this.floats.filter((f) => now - f.born < FLOAT_SECONDS && this.present(f.target));
    this.floats.forEach((f, i) => {
      const at = this.screenPointOf(f.target);
      if (at) drawFloat(ctx, f.text, keepIn({ x: at.x, y: at.y - i * 4 }, 90), now - f.born, this.still, this.font);
    });
    drawParticles(ctx, this.particles.list);
    if (this.fade.k > 0) {
      const k = this.fade.k;
      ctx.fillStyle = `rgba(${FADE_RGB},${k * k * (3 - 2 * k)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /** Over a room: the bubble over whoever speaks (when they are there), then the shows. */
  private drawRoomOverlay(ctx: CanvasRenderingContext2D): void {
    const room = this.room!;
    const who = this.speaking;
    if (who && room.head(who, this.v)) {
      const at = this.project(this.v.x, this.v.y, this.v.z);
      drawTalkBubble(ctx, this.pal, at.x, Math.max(this.safe.top + 44, at.y - 4), this.t, this.still);
    }
    this.drawShows(ctx);
  }

  // ───────────────────────── the map (features/town/map) ─────────────────────────

  /**
   * The map's "Đến ngay": the player is put at a point of the grid facing `heading` (radians on the grid) behind a
   * short dip to dark (a cut under reduced motion), the camera on them at once; residents stay where they are; `then`
   * runs once the player is there. False while a talk is staged, a room or a dip is on the stage, or before the first frame.
   */
  /**
   * The fishing panel's phase (null = it closed): the player walks out to the end of the pier and fishes there, the
   * float, the bite, the catch or the escape shown on the water (fishShow.ts). Only when the player stands at the
   * pier (a panel opened from far away, by a link, shows nothing in the world).
   */
  fishing(phase: FishPhase | null, tier: string | null): void {
    if (phase !== null) this.dismount();
    if (phase === null) {
      this.fish?.leave();
      return;
    }
    if (!this.fish) {
      const way = pierWalk(this.world);
      const p = this.sim.player;
      if (!way || this.room || Math.hypot(p.x - way.from.x, p.y - way.from.y) > 1.6) return;
      this.fish = new FishShow(way, this.town.mats.std);
      this.town.scene.add(this.fish.group);
      this.quiet();
    }
    const was = this.fish.out() && this.fish.current !== 'caught';
    this.fish.set(phase, tier);
    if (phase === 'caught' && was) this.later.push({ at: this.t + 0.75, run: () => this.playOnce('player', 'cheer') });
  }

  /**
   * "Đến ngay" during a click walk (the page's button while onFarWalk says so): a short dip to dark and the walk is
   * over, the player where it ends and what it was for done (an activity's panel, a lot's sheet). A talk walked to:
   * the one talked to is at their spot too, or the room comes at that same dark. False with no walk under way, or
   * while a dip or a room is on the stage.
   */
  hurry(): boolean {
    if (!this.ready || this.paused || this.busy() || this.sim.walkLeft() === null) return false;
    this.setHover(null);
    this.dip(() => {
      const s = this.staged;
      if (!this.sim.finishWalk()) return;
      if (s && this.staged === s && s.phase === 'go') {
        if (s.doorway) {
          // already at the dark: into the room now (not a second dip)
          this.enterRoom(s);
          return;
        }
        if (s.spots) this.sim.jumpResident(s.placeId, s.spots.resident);
      }
      this.snapToPlayer();
    });
    return true;
  }

  /** Tells the page when a click walk long enough to hurry starts and ends (shown from HURRY_FROM tiles left, until HURRY_UNTIL). */
  private updateFarWalk(): void {
    const left = this.sim.walkLeft();
    const far = left !== null && !this.busy() && left > (this.farWalk ? HURRY_UNTIL : HURRY_FROM);
    if (far === this.farWalk) return;
    this.farWalk = far;
    this.cb.onFarWalk?.(far);
  }

  warpPlayer(at: { x: number; y: number }, heading: number, then?: () => void): boolean {
    if (!this.ready || this.staged || this.busy()) return false;
    this.setHover(null);
    this.dip(() => {
      this.sim.placePlayer(at, heading);
      this.snapToPlayer();
      then?.();
    });
    return true;
  }

  /** The camera's yaw now (cameraRig: it stands at this heading from what it looks at), and whether the town is off the stage (a room, a dip). */
  mapView(): { yaw: number; away: boolean } {
    return { yaw: this.yaw, away: !!this.room || this.busy() };
  }
}

/** Every mesh of a character casts and takes shadows. */
function shade(o: Object3D): void {
  o.traverse((c) => {
    if (c instanceof Mesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

/** A pet driven like a person (the cat): only what a pet does. */
function petAsCharacter(p: Pet3D): Character3D {
  return {
    id: p.id,
    root: p.root as Character3D['root'],
    setHeading: (r, i) => p.setHeading(r, i),
    setAction: () => {},
    actionDuration: () => 0,
    update: (dt, s) => p.update(dt, s),
    headTop: (t) => p.root.localToWorld(t.set(0, 0.4, 0)),
    setHat: () => {},
    setOutfit: () => {},
    lookAt: () => {},
    setNight: () => {},
    dispose: () => p.dispose(),
  };
}

/** Grow a thing out of the ground: hidden before, an overshooting grow, then itself. */
function setPop(o: Object3D, k: number): void {
  if (k < 0) {
    o.visible = false;
    return;
  }
  o.visible = true;
  if (k >= 1) {
    if (o.scale.x !== 1) o.scale.set(1, 1, 1);
    return;
  }
  const s = Math.max(0.001, easeOutBack(k));
  o.scale.set(0.6 + 0.4 * s, s, 0.6 + 0.4 * s);
}

const KEY_DIRS: Readonly<Record<string, 'up' | 'down' | 'left' | 'right'>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};
