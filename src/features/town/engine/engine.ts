// The town on one <canvas>: owns the simulation, the camera and the render loop, and turns pointer and key input
// into walking. No React here; TownStage.tsx is the thin component around it.

import { prefersReducedMotion } from '../../../core/motion';
import { sameTile } from '../../../core/town/map';
import { TOWN_WORLD, type PlaceId, type Tile, type TownWorld } from '../../../data/townWorld';
import { baseZoom, Camera } from './camera';
import { animDuration, dirFromTileVector, walkTime, type CharacterAnim, type CharacterId, type Dir8 } from '../art/characters';
import { CHARACTER_ART } from '../art/characters.data';
import { townArtReady } from '../art/load';
import { catFrame, decorSpriteKey, stringLights } from '../art/world';
import { WORLD_ART } from '../art/world.data';

import { drawPondShimmer } from './draw/ground';
import { drawEmote, drawFloat, drawParticles, drawSky, drawTag, drawTalkBubble, drawVignette, EMOTE_SECONDS, FLOAT_SECONDS, placeTags, tagSize, type EmoteKind, type TagBox } from './draw/overlay';
import { drawDuck, drawFirefly, drawGoal, drawHoverTile } from './draw/props';
import type { G } from './draw/util';
import { depthOfPoint, toWorld, worldBounds, type Pt } from './iso';
import { paletteFor, type TownPalette } from './palette';
import { Particles } from './particles';
import { clipInside, clipOutside, coverShare, grow } from './cover';
import { pickAt, type Hit } from './pick';
import { lotHeight, placeHeight } from './places';
import { buildScene, fireflySpots, lampLights, POP_SECONDS, POP_STAGGER, popped, sceneKey, sortByDepth, type Box, type Drawable, type FrameInfo, type LampLight } from './scene';
import { gridDistance, keysToDelta, TownSim, type Actor, type StageState } from './sim';
import { clearNightCache, drawContactShadow, drawGroundArt, drawPerson, drawSprite, nightArtReady, prepareNight } from './sprites';

export type BurstKind = 'confetti' | 'coins' | 'sparkle';
/** Who or where: the player, a place's resident, or a point of the stage in CSS pixels. */
export type StageTarget = 'player' | PlaceId | { x: number; y: number };

/** What the player stands next to: a resident to talk to, or the gate of an empty lot. */
export type Near = { kind: 'resident'; placeId: PlaceId } | { kind: 'lot'; placeId: PlaceId } | null;

export interface EngineCallbacks {
  onTalk?: (placeId: PlaceId) => void;
  onLot?: (placeId: PlaceId) => void;
  onNear?: (near: Near) => void;
  /** Enter / E / Space with nobody beside the player. */
  onIdleAct?: () => void;
}

interface Emote {
  target: 'player' | PlaceId;
  kind: EmoteKind;
  born: number;
}

const FOCUS_ZOOM = 1.3;
/**
 * People are rendered at 2.5 atlas px per world px: a conversation does not zoom in further than about 2.75
 * device px per world px, so a face is never enlarged into a blur on a 2× phone.
 */
const SHARP_DEVICE_PX = 2.75;
/** Within this (world px on the screen) of the player a resident shows their name. */
const NAME_NEAR = 118;
/** A thing standing in front of a person is drawn this see-through where it covers them. */
const COVER_ALPHA = 0.3;
/** Feet to the top of the head, world pixels: bubbles, tags and "+N" hang above it. */
const HEAD = CHARACTER_ART.height;
/** A nod, a head shake or a wave stays on its last frame this long before the person goes back to idle. */
const ACT_HOLD = 0.35;

/** A short animation a person plays once: a nod (yes), a head shake (no), a wave. */
export type ActKind = Extract<CharacterAnim, 'yes' | 'no' | 'wave'>;
/** How fast the town dims around a conversation (per second, exponential). */
const DIM_RATE = 5;
/** A new thing: the camera sets off, the dust rises, and it appears this many seconds later; then the camera stays a while. */
const BUILD_APPEAR = 0.85;
const BUILD_HOLD = 2.7;

interface Float {
  target: 'player' | PlaceId;
  text: string;
  born: number;
}

interface Showcase {
  at: Pt;
  zoom: number;
  until: number;
}
/** Parts of the stage covered by the game's own buttons (CSS px from each edge): tags and the camera keep clear. */
export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Kept for the session only: coming back to the page puts the player where they were. */
let lastPlayerTile: Tile | null = null;

const EMPTY_STATE: StageState = { built: [], decorations: [], lit: {}, marker: {}, theme: 'day' };

export class TownEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly world: TownWorld;
  readonly sim: TownSim;
  readonly camera = new Camera();
  private readonly particles = new Particles();
  private cb: EngineCallbacks;
  private state: StageState = EMPTY_STATE;
  private pal: TownPalette = paletteFor('day');
  private scene: Drawable[] = [];
  private sceneFor = '';
  private readonly fireflies: Tile[];
  /** The middle of the pond, where the ducks paddle; null for a town without water. */
  private readonly pond: Tile | null;
  private readonly bounds: { x0: number; y0: number; x1: number; y1: number };
  private viewW = 1;
  private viewH = 1;
  private dpr = 1;
  private zoom0 = 1;
  private raf = 0;
  private last = 0;
  private t = 0;
  private running = false;
  private visible = true;
  private still = prefersReducedMotion();
  private paused = false;
  private hover: Hit | null = null;
  private focus: PlaceId | null = null;
  private emotes: Emote[] = [];
  private floats: Float[] = [];
  /** The resident whose line is sounding now: a bubble with moving bars over their head. */
  private speaking: PlaceId | null = null;
  /** 0..1: how far the town has dimmed around the conversation. */
  private dim = 0;
  /** When (engine seconds) a thing just bought appears, by place / decoration id. */
  private pops = new Map<string, number>();
  private showcase: Showcase | null = null;
  private later: { at: number; run: () => void }[] = [];
  private inset = { right: 0, bottom: 0 };
  private safe: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  /** The resident the page suggests next: always named, and framed with the player when they are near. */
  private hint: PlaceId | null = null;
  /** A lot the build panel is about: the camera shows it. */
  private peek: PlaceId | null = null;
  private full = false;
  private lamps: LampLight[] = [];
  private nightReady = false;
  private near: Near = null;
  private readonly keys = { up: false, down: false, left: false, right: false };
  private font = 'system-ui, sans-serif';
  private first = true;
  private frames = 0;
  private overview = false;
  private lotLabels: Readonly<Record<string, string>> = {};
  /** A nod, a head shake or a wave being played, by actor id (player / place id). */
  private acts = new Map<string, { anim: ActKind; born: number }>();
  /** The name on the player's tag. */
  playerName = 'Bạn';

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks = {}, world: TownWorld = TOWN_WORLD, startAt?: Tile) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D không dùng được');
    this.ctx = ctx;
    this.cb = cb;
    this.world = world;
    this.sim = new TownSim(world, Math.random, startAt ?? lastPlayerTile ?? undefined);
    this.fireflies = fireflySpots(world);
    this.pond = pondCentre(world);
    this.bounds = worldBounds(world.size);
    this.camera.bounds = this.bounds;
    const half = world.size * 32;
    this.camera.island = { cx: 0, cy: world.size * 16, hw: half, hh: half / 2 };
    try {
      this.font = getComputedStyle(canvas).fontFamily || this.font;
    } catch {
      // keep the fallback
    }
    warmBlends();
  }

  setCallbacks(cb: EngineCallbacks): void {
    this.cb = cb;
  }

  setState(state: StageState): void {
    this.state = state;
    // back to day: the tinted night copies of the sprites are not needed any more
    if (this.pal.night && state.theme !== 'night') {
      clearNightCache();
      this.nightReady = false;
    }
    this.pal = paletteFor(state.theme);
    this.sim.setState(state);
    const key = sceneKey(state);
    if (key !== this.sceneFor) {
      this.scene = buildScene(this.world, state);
      this.lamps = lampLights(this.world, state);
      this.sceneFor = key;
      this.updateZoom();
    }
    if (this.focus && !this.sim.residents.has(this.focus)) this.focus = null;
  }

  /** Input off (a conversation or a dialog is open). The town keeps living. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.releaseKeys();
      this.setHover(null);
    }
  }

  /** The stage scrolled out of sight: stop drawing. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible && this.running && !this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  resize(cssW: number, cssH: number): void {
    const w = Math.max(1, Math.round(cssW));
    const h = Math.max(1, Math.round(cssH));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.camera.setView(w, h);
    this.updateZoom();
    this.applyInset();
    this.aim();
    this.camera.snap();
    // setting the canvas size cleared it: paint at once, whatever the loop is doing
    this.render();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.stop();
    lastPlayerTile = { ...this.sim.player.tile };
    clearNightCache();
  }

  /** The zoom to rest at, and the conversation's (never past what the people's atlases hold sharply). */
  private updateZoom(): void {
    const w = this.viewW;
    const h = this.viewH;
    let z = baseZoom(w, h);
    if (this.full && w >= 900) {
      // full screen on a big screen: the whole built town in view, people still big enough to read
      const fit = this.builtFit();
      if (fit) z = Math.max(z * 0.62, Math.min(z, fit));
    }
    this.zoom0 = z;
    if (!this.showcase && !(this.overview && !this.focus)) this.camera.targetZoom = this.restZoom();
  }

  private restZoom(): number {
    if (!this.focus) return this.zoom0;
    const sharp = SHARP_DEVICE_PX / (this.dpr * this.zoom0);
    return this.zoom0 * Math.max(1, Math.min(FOCUS_ZOOM, sharp));
  }

  /** The zoom that fits every built place (and the plaza) in the view, or null for a town with nothing built. */
  private builtFit(): number | null {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const add = (tx: number, ty: number, up = 0) => {
      const p = toWorld(tx, ty, up);
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    };
    const { plaza } = this.world;
    add(plaza.x - plaza.r, plaza.y - plaza.r, 60);
    add(plaza.x + plaza.r, plaza.y + plaza.r);
    add(plaza.x + plaza.r, plaza.y - plaza.r);
    add(plaza.x - plaza.r, plaza.y + plaza.r);
    for (const p of this.world.places) {
      if (!this.sim.isBuilt(p.id)) continue;
      add(p.x, p.y, placeHeight(p.id) + 30);
      add(p.x + p.w, p.y);
      add(p.x, p.y + p.d);
      add(p.x + p.w + 1, p.y + p.d + 1);
    }
    if (!Number.isFinite(x0)) return null;
    const freeW = this.viewW - this.safe.left - this.safe.right;
    const freeH = this.viewH - this.safe.top - this.safe.bottom;
    return Math.min(freeW / (x1 - x0 + 60), freeH / (y1 - y0 + 40));
  }

  // ───────────────────────── what the shell can ask for ─────────────────────────

  /** Zoom in on a resident (and the player beside them); null zooms back out to follow the player. */
  focusOn(placeId: PlaceId | null): void {
    this.focus = placeId && this.sim.residents.has(placeId) ? placeId : null;
    this.sim.engage(this.focus);
    this.camera.targetZoom = this.restZoom();
  }

  /** The stage covers the window (or not): on a big screen the camera then shows the whole built town. */
  setFull(on: boolean): void {
    if (this.full === on) return;
    this.full = on;
    this.updateZoom();
  }

  /** Parts of the stage under the game's own buttons: tags stay out of them and the camera centres in the rest. */
  setSafe(safe: SafeInsets): void {
    this.safe = { top: Math.max(0, safe.top), right: Math.max(0, safe.right), bottom: Math.max(0, safe.bottom), left: Math.max(0, safe.left) };
    this.applyInset();
  }

  /** The resident the page suggests next (its main button): named on the stage, framed with the player. */
  setHint(placeId: PlaceId | null): void {
    this.hint = placeId;
  }

  /** A lot the build panel is about (null = none): the camera shows it while the panel is open. */
  setPeek(placeId: PlaceId | null): void {
    this.peek = placeId;
  }

  /** The resident whose line is being played (null = nobody): they get a bubble with moving sound bars. */
  setSpeaking(placeId: PlaceId | null): void {
    this.speaking = placeId;
  }

  /**
   * Part of the stage is covered by a panel (CSS pixels from the right / bottom edge): whatever the camera looks at
   * is centred in what is left.
   */
  setInset(right: number, bottom: number): void {
    this.inset = { right: Math.max(0, right), bottom: Math.max(0, bottom) };
    this.applyInset();
  }

  private applyInset(): void {
    // what the camera looks at goes to the middle of what the panels and the buttons leave free
    const right = Math.max(this.inset.right, this.safe.right);
    const bottom = Math.max(this.inset.bottom, this.safe.bottom);
    const dx = (this.safe.left - right) / 2;
    const dy = (this.safe.top - bottom) / 2;
    const cap = (v: number, size: number) => Math.max(-(size / 2 - 60), Math.min(size / 2 - 60, v));
    this.camera.shiftTo(cap(dx, this.viewW), cap(dy, this.viewH));
  }

  /** A short text rising over somebody's head ("+3"). */
  float(target: 'player' | PlaceId, text: string): void {
    if (!this.sim.actor(target)) return;
    this.floats.push({ target, text, born: this.t });
    if (this.floats.length > 6) this.floats.shift();
  }

  /**
   * A place was just built or a decoration bought: the camera goes there, dust rises, the thing pops out of the
   * ground with sparkles, and the camera comes back. Call it right before (or after) the new state arrives.
   * Returns the seconds until the thing appears (0 under reduced motion: it is simply there).
   */
  celebrate(id: string): number {
    if (this.still) return 0;
    const place = this.world.places.find((p) => p.id === id);
    const spots: Pt[] = place
      ? [toWorld(place.x + place.w / 2, place.y + place.d / 2, 20)]
      : (this.world.decorations[id as keyof TownWorld['decorations']] ?? []).map((s) => toWorld(s.x + (s.solid ? 0.5 : 0), s.y + (s.solid ? 0.5 : 0), 14));
    if (spots.length === 0) return 0;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of spots) {
      x0 = Math.min(x0, s.x);
      y0 = Math.min(y0, s.y);
      x1 = Math.max(x1, s.x);
      y1 = Math.max(y1, s.y);
    }
    const freeW = Math.max(120, this.viewW - this.inset.right);
    const freeH = Math.max(120, this.viewH - this.inset.bottom);
    const fit = Math.min((freeW * 0.72) / Math.max(1, x1 - x0), (freeH * 0.62) / Math.max(1, y1 - y0));
    const zoom = Math.max(this.zoom0 * 0.6, Math.min(this.zoom0 * (place ? 1.25 : 1.15), fit));
    const now = this.t;
    this.pops.set(id, now + BUILD_APPEAR);
    this.showcase = { at: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, zoom, until: now + BUILD_HOLD + spots.length * POP_STAGGER };
    spots.forEach((s, i) => {
      const when = now + BUILD_APPEAR + i * POP_STAGGER;
      this.later.push({ at: when - 0.28, run: () => this.particles.dust(this.camera.worldToScreen({ x: s.x, y: s.y + 16 }), place ? 16 : 7, place ? 46 : 16) });
      this.later.push({ at: when + 0.12, run: () => this.particles.sparks(this.camera.worldToScreen({ x: s.x, y: s.y - (place ? 34 : 12) }), place ? 18 : 8) });
    });
    if (place) this.later.push({ at: now + BUILD_APPEAR + 0.2, run: () => this.particles.confetti(this.camera.worldToScreen({ x: spots[0].x, y: spots[0].y - 50 }), 34) });
    return BUILD_APPEAR;
  }

  /** 1 = standing as usual; 0..1 = popping out of the ground; below 0 = not there yet. */
  private popOf = (id: string, index = 0): number => {
    const at = this.pops.get(id);
    if (at === undefined) return 1;
    const k = (this.t - at - index * POP_STAGGER) / POP_SECONDS;
    return k < 0 ? -1 : Math.min(1, k);
  };

  /** A built place (and its resident) is in town: not while its house is still on its way out of the ground. */
  private inTown = (id: PlaceId): boolean => this.popOf(id) >= 0;

  /** A short text to keep over an empty lot (e.g. its price), by place id. */
  setLotLabels(labels: Readonly<Record<string, string>>): void {
    this.lotLabels = labels;
  }

  /** Show the whole town at once (true), or go back to following the player. */
  setOverview(on: boolean): void {
    this.overview = on;
    if (!on) this.camera.targetZoom = this.restZoom();
    this.aim();
    if (!this.running) {
      this.camera.snap();
      this.render();
    }
  }

  /**
   * Somebody plays a short animation once: a nod ('yes'), a head shake ('no'), a wave. Nothing under reduced
   * motion (they keep standing still); a step of walking cuts it short.
   */
  act(target: 'player' | PlaceId, anim: ActKind): void {
    if (this.still || !this.sim.actor(target)) return;
    this.acts.set(target, { anim, born: this.t });
  }

  /** How a person stands this frame: which animation, which way, which moment of it. */
  private pose(a: Actor, seed: number): { anim: CharacterAnim; dir: Dir8; t: number } {
    let dir = dirFromTileVector(a.heading.x, a.heading.y) ?? 'S';
    // a resident standing still always shows a face: never the back or a flat side view of the head
    if (a.kind === 'resident' && (!a.moving || this.still) && dir !== 'S' && dir !== 'SE' && dir !== 'SW') dir = a.facing > 0 ? 'SE' : 'SW';
    if (this.still) return { anim: 'idle', dir, t: 0 };
    const act = this.acts.get(a.id);
    if (act) {
      const age = this.t - act.born;
      if (!a.moving && age < animDuration(act.anim) + ACT_HOLD) return { anim: act.anim, dir, t: age };
      this.acts.delete(a.id);
    }
    if (a.moving) return { anim: 'walk', dir, t: walkTime(a.phase) };
    // everybody breathes at their own moment
    return { anim: 'idle', dir, t: this.t + seed * 0.37 };
  }

  private drawActor(g: G, a: Actor, seed: number): void {
    const feet = toWorld(a.x, a.y);
    if (a.kind === 'cat') {
      const dir = dirFromTileVector(a.heading.x, a.heading.y) ?? 'SE';
      const walking = a.moving && !this.still;
      const spec = WORLD_ART.cat.anims.walk;
      const f = catFrame(walking ? 'walk' : 'sit', dir, walking ? (a.phase / (Math.PI * 2)) * spec.duration : this.still ? 0 : this.t);
      drawContactShadow(g, feet.x, feet.y, 0.6);
      drawSprite(g, f.key, feet.x, feet.y, { flip: f.flip });
      return;
    }
    const p = this.pose(a, seed);
    drawPerson(g, (a.kind === 'player' ? 'player' : a.id) as CharacterId, p.anim, p.dir, p.t, feet.x, feet.y);
  }

  emote(target: 'player' | PlaceId, kind: EmoteKind): void {
    if (!this.sim.actor(target)) return;
    this.emotes = this.emotes.filter((e) => e.target !== target);
    this.emotes.push({ target, kind, born: this.t });
    if (!this.running) this.render();
  }

  /**
   * A burst of particles at somebody or at a point of the stage. Coins fly on to `to` (a point of the stage in CSS
   * pixels, e.g. the xu counter). Nothing under reduced motion.
   */
  burst(kind: BurstKind, at: StageTarget, to?: { x: number; y: number }): void {
    if (this.still) return;
    const head = this.screenPointOf(at);
    if (!head) return;
    // from the chest, not the head-top (where a tag or the "+N" sits), and never above the stage's free top
    const from = typeof at === 'object' ? head : { x: head.x, y: Math.max(this.safe.top + 24, head.y + HEAD * this.camera.zoom * 0.45) };
    if (kind === 'confetti') this.particles.confetti(from);
    else if (kind === 'sparkle') this.particles.sparks(from);
    else this.particles.coins(from, to ?? { x: this.viewW - 40, y: 28 });
  }

  /**
   * Walk the player to a place: up to its resident when it is built, to the gate of its lot otherwise. `then` runs
   * on arrival (once). False when there is no way.
   */
  walkTo(placeId: PlaceId, then?: () => void): boolean {
    if (this.sim.isBuilt(placeId) && this.sim.residents.has(placeId)) return this.sim.walkToResident(placeId, then);
    return this.sim.walkToDoor(placeId, then);
  }

  /** Where somebody's head is on the stage, in CSS pixels (to hang a speech bubble on). */
  screenPointOf(target: StageTarget): Pt | null {
    if (typeof target === 'object') return { x: target.x, y: target.y };
    const a = this.sim.actor(target);
    if (!a) return null;
    const feet = toWorld(a.x, a.y);
    return this.camera.worldToScreen({ x: feet.x, y: feet.y - HEAD });
  }

  // ───────────────────────── input ─────────────────────────

  pointerMove(x: number, y: number): void {
    if (this.paused) return;
    this.setHover(pickAt(this.camera.screenToWorld({ x, y }), this.sim, this.inTown));
  }

  pointerLeave(): void {
    this.setHover(null);
  }

  /** A click or a tap on the stage, in CSS pixels from its top-left corner. */
  click(x: number, y: number): void {
    if (this.paused) return;
    const hit = pickAt(this.camera.screenToWorld({ x, y }), this.sim, this.inTown);
    if (!hit) return;
    if (hit.kind === 'resident' || (hit.kind === 'place' && hit.built)) {
      const id = hit.placeId;
      if (!this.sim.walkToResident(id, () => this.cb.onTalk?.(id))) this.sim.walkToDoor(id);
    } else if (hit.kind === 'place') {
      const id = hit.placeId;
      this.sim.walkToDoor(id, () => this.cb.onLot?.(id));
    } else {
      this.sim.walkToTile(hit.tile);
    }
  }

  /**
   * A key went down or up. Returns true when the stage used it (the caller then prevents the page from scrolling).
   * Arrows / W A S D walk; Enter or Space talks to the resident beside the player, or opens the lot at its gate.
   */
  key(code: string, down: boolean): boolean {
    if (this.paused) return false;
    const dir = KEY_DIRS[code];
    if (dir) {
      if (this.keys[dir] === down) return true;
      this.keys[dir] = down;
      this.sim.hold(keysToDelta(this.keys));
      return true;
    }
    if (code === 'Enter' || code === 'Space' || code === 'KeyE') {
      if (down) {
        const n = this.near;
        if (!n) this.cb.onIdleAct?.();
        else if (n.kind === 'resident') this.sim.walkToResident(n.placeId, () => this.cb.onTalk?.(n.placeId));
        else this.cb.onLot?.(n.placeId);
      }
      return true;
    }
    return false;
  }

  /** The window lost focus, or input was paused: no key stays "held". */
  releaseKeys(): void {
    this.keys.up = this.keys.down = this.keys.left = this.keys.right = false;
    this.sim.hold({ x: 0, y: 0 });
  }

  private setHover(hit: Hit | null): void {
    this.hover = hit;
    const clickable = !!hit && (hit.kind !== 'tile' || hit.walkable);
    this.canvas.style.cursor = clickable ? 'pointer' : 'default';
  }

  // ───────────────────────── the loop ─────────────────────────

  private frame = (now: number): void => {
    this.raf = 0;
    if (!this.running) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    this.t += dt;
    // the OS setting can change while the page is open: look again about once a second
    if (++this.frames % 60 === 0) this.still = prefersReducedMotion();
    this.sim.update(dt);
    if (this.later.length > 0) {
      const due = this.later.filter((l) => l.at <= this.t);
      if (due.length > 0) {
        this.later = this.later.filter((l) => l.at > this.t);
        for (const l of due) l.run();
      }
    }
    if (this.showcase && this.t >= this.showcase.until) {
      this.showcase = null;
      this.camera.targetZoom = this.restZoom();
    }
    for (const [id, at] of this.pops) if (this.t - at > POP_SECONDS + 12 * POP_STAGGER) this.pops.delete(id);
    const dimTo = this.focus ? 1 : 0;
    this.dim = this.still ? dimTo : this.dim + (dimTo - this.dim) * (1 - Math.exp(-dt * DIM_RATE));
    if (Math.abs(dimTo - this.dim) < 0.004) this.dim = dimTo;
    this.particles.update(dt);
    this.updateNear();
    this.aim();
    this.camera.update(dt, this.still || this.first);
    this.first = false;
    this.spawnPetals(dt);
    this.render();
    if (this.visible) this.raf = requestAnimationFrame(this.frame);
  };

  /** Point the camera: at the player, or between the player and the resident in focus. */
  private aim(): void {
    // only a conversation frames its two people past the island's rim; every other view keeps to it
    this.camera.loose = false;
    if (this.overview && !this.focus) {
      const b = this.bounds;
      const fit = Math.min(this.viewW / (b.x1 - b.x0 - 60), this.viewH / (b.y1 - b.y0 - 70));
      this.camera.lookAt({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 + 10 }, fit);
      return;
    }
    if (this.showcase && !this.focus) {
      this.camera.lookAt(this.showcase.at, this.showcase.zoom);
      return;
    }
    const peek = !this.focus && this.peek ? this.world.places.find((q) => q.id === this.peek) : undefined;
    if (peek) {
      this.camera.lookAt(toWorld(peek.x + peek.w / 2, peek.y + peek.d / 2, 24));
      return;
    }
    const p = this.sim.player;
    let at = toWorld(p.x, p.y);
    const r = this.focus ? this.sim.residents.get(this.focus) : null;
    if (r) {
      this.camera.loose = true;
      this.frameTalk(r);
      return;
    }
    if (this.hint) {
      // the resident the main button sends the player to: in the picture with them while close enough
      const hr = this.sim.residents.get(this.hint);
      if (hr && this.popOf(hr.place.id) >= 0) {
        const o = toWorld(hr.x, hr.y);
        const z = this.camera.targetZoom;
        const freeW = Math.max(120, this.viewW - Math.max(this.inset.right, this.safe.right) - this.safe.left) / z;
        const freeH = Math.max(120, this.viewH - Math.max(this.inset.bottom, this.safe.bottom) - this.safe.top) / z;
        const over = Math.max(Math.abs(o.x - at.x) / (freeW * 0.72), Math.abs(o.y - at.y) / (freeH * 0.62));
        // up to 1 (both fit with room to spare): halfway between them; further apart: back to the player alone
        const w = 0.5 * Math.max(0, Math.min(1, (1.6 - over) / 0.6));
        at = { x: at.x + (o.x - at.x) * w, y: at.y + (o.y - at.y) * w };
      }
    }
    this.camera.lookAt({ x: at.x, y: at.y - 26 }, this.camera.targetZoom);
  }

  /**
   * A conversation: both people whole (head to feet, with room for the speech bubble over them) in the part of the
   * stage the panel and the counters leave free, as big as that allows: about half its height, never past what the
   * people's atlases hold sharply, never so big that one of them is cut off.
   */
  private frameTalk(r: Actor): void {
    const a = toWorld(this.sim.player.x, this.sim.player.y);
    const b = toWorld(r.x, r.y);
    const x0 = Math.min(a.x, b.x) - 20;
    const x1 = Math.max(a.x, b.x) + 20;
    const y0 = Math.min(a.y, b.y) - HEAD - 4;
    const y1 = Math.max(a.y, b.y) + 8;
    const right = Math.max(this.inset.right, this.safe.right);
    const bottom = Math.max(this.inset.bottom, this.safe.bottom);
    const freeW = Math.max(80, this.viewW - this.safe.left - right);
    // the bubble over the speaker's head is screen-sized: keep room for it at the top (less in a thin strip over a
    // phone's panel, where the people come first and the bubble may overlap the top of a head while it shows)
    const open = this.viewH - this.safe.top - bottom;
    const BUBBLE = Math.min(40, Math.max(14, open * 0.2));
    const freeH = Math.max(60, open - BUBBLE);
    const fit = Math.min((freeW * 0.9) / (x1 - x0), (freeH * 0.94) / (y1 - y0));
    const fill = (freeH * 0.5) / HEAD;
    const sharp = SHARP_DEVICE_PX / this.dpr;
    const z = Math.max(0.3, Math.min(fit, Math.max(this.zoom0, Math.min(fill, sharp))));
    // the camera puts its target in the middle of the free part; the pair goes in the middle of what is under the bubble
    this.camera.lookAt({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 - BUBBLE / 2 / z }, z);
  }

  private updateNear(): void {
    const p = this.sim.player;
    let near: Near = null;
    if (!p.moving) {
      // a neighbour straight across the screen is 64 world pixels away
      let best = 70;
      for (const r of this.sim.residents.values()) {
        // somebody whose house is still on its way is not in town yet: nobody to talk to there
        if (!this.inTown(r.place.id)) continue;
        const d = gridDistance(p.x, p.y, r.x, r.y);
        if (d < best) {
          best = d;
          near = { kind: 'resident', placeId: r.place.id };
        }
      }
      if (!near) {
        const lot = this.world.places.find((q) => this.sim.isSite(q.id) && sameTile(q.door, p.tile));
        if (lot) near = { kind: 'lot', placeId: lot.id };
      }
    }
    if (near?.kind !== this.near?.kind || near?.placeId !== this.near?.placeId) {
      this.near = near;
      this.cb.onNear?.(near);
    }
  }

  private spawnPetals(dt: number): void {
    if (this.still || !this.state.decorations.includes('blossom')) return;
    for (const s of this.world.decorations.blossom) {
      if (Math.random() > dt * 0.3) continue;
      const c = toWorld(s.x + 0.5, s.y + 0.5, 30);
      const at = this.camera.worldToScreen({ x: c.x + (Math.random() - 0.5) * 26, y: c.y });
      if (at.x > -20 && at.y > -20 && at.x < this.viewW + 20 && at.y < this.viewH + 20) this.particles.petal(at);
    }
  }

  /**
   * Night: warm light round every lamp. First a pool on the ground (under everything that stands), then a faint
   * glow over what stands near it, so a person under a lamp is lit too. World space.
   */
  private drawLampLight(ctx: CanvasRenderingContext2D, over: boolean): void {
    ctx.save();
    // colour-dodge by an amber undoes the dusk blue where the light falls: the ground under a lamp gets its own
    // colours back, warmed, instead of a pale haze laid over the blue
    ctx.globalCompositeOperation = 'color-dodge';
    for (const l of this.lamps) {
      const r = over ? l.r * 0.85 : l.r;
      ctx.save();
      ctx.translate(l.x, l.y - (over ? 24 : 0));
      ctx.scale(1, over ? 0.75 : 0.5);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(150,106,0,${(over ? 0.38 : 0.92) * l.k})`);
      grad.addColorStop(0.5, `rgba(150,106,0,${(over ? 0.18 : 0.5) * l.k})`);
      grad.addColorStop(1, 'rgba(150,106,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.restore();
  }

  private render(): void {
    const { ctx, dpr, pal, camera: cam } = this;
    const w = this.viewW;
    const h = this.viewH;
    const state = this.state;
    const has = (id: string) => state.decorations.includes(id);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const behind = () => {
      // the sky goes BEHIND what is drawn (the island keeps its own outline at night)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'destination-over';
      drawSky(ctx, w, h, pal, this.t, this.still);
      ctx.globalCompositeOperation = 'source-over';
    };
    // the pictures are still on their way: the sky alone (the stage shows its loading note over it)
    if (!townArtReady()) {
      behind();
      return;
    }
    if (pal.night && !this.nightReady) {
      // tint the world's atlases while the browser is idle, not all in the first night frames
      prepareNight();
      this.nightReady = true;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // ── the world, through the camera ──
    const z = cam.zoom;
    const toWorldSpace = () => ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 + cam.shiftX - cam.x * z), dpr * (h / 2 + cam.shiftY - cam.y * z));
    toWorldSpace();
    const g: G = { ctx, pal, t: this.t, still: this.still };
    drawGroundArt(g);
    drawPondShimmer(g, this.world);
    if (has('lilies')) {
      this.world.decorations.lilies.forEach((s, i) => {
        const key = decorSpriteKey('lilies', i, s);
        const at = toWorld(s.x, s.y);
        if (key) popped(g, this.popOf('lilies', i), at, () => void drawSprite(g, key, at.x, at.y));
      });
    }
    if (this.pond) for (let i = 0; i < 2; i++) drawDuck(g, this.pond.x, this.pond.y, i);
    const info: FrameInfo = { lit: state.lit, hoverPlace: this.hover?.kind === 'place' ? this.hover.placeId : null, pop: this.popOf };
    for (const d of this.scene) d.shadow?.(g, info);
    if (pal.night) this.drawLampLight(ctx, false);
    const hover = this.hover;
    if (hover?.kind === 'tile' && hover.walkable) drawHoverTile(g, hover.tile.x, hover.tile.y);
    if (this.sim.goal) drawGoal(g, this.sim.goal.x, this.sim.goal.y);

    // ── everything standing, far to near ──
    const people: Drawable[] = [];
    let n = 0;
    const seeds = new Map<string, number>();
    /** Where each person stands (world px), so what stands in front of them fades there. */
    const covers: { depth: number; box: Box }[] = [];
    const personBox = (a: Actor): Box => {
      const feet = toWorld(a.x, a.y);
      return { x: feet.x - 13, y: feet.y - HEAD - 4, w: 26, h: HEAD + 6 };
    };
    // a conversation: the two who talk stand clear; anybody or anything right on or under them steps back
    const talking = this.focus ? (this.sim.residents.get(this.focus) ?? null) : null;
    const pairBoxes = talking ? [talking, this.sim.player].map((a) => grow(personBox(a), 8, 18)) : [];
    const pairDepth = talking ? Math.min(depthOfPoint(talking.x, talking.y), depthOfPoint(this.sim.player.x, this.sim.player.y)) : Infinity;
    const person = (a: Actor, seed: number) => {
      seeds.set(a.id, seed);
      const depth = depthOfPoint(a.x, a.y);
      const box = a.kind === 'cat' ? undefined : personBox(a);
      const inTheWay = !!talking && a !== talking && a !== this.sim.player && pairBoxes.some((b) => coverShare(b, box ?? personBox(a)) > 0);
      people.push({ depth, draw: (gg) => (inTheWay ? faded(gg, () => this.drawActor(gg, a, seed)) : this.drawActor(gg, a, seed)) });
      if (box) covers.push({ depth, box });
    };
    for (const r of this.sim.residents.values()) {
      const seed = ++n;
      // somebody whose house is still on its way is not in town yet
      if (this.popOf(r.place.id) < 0) continue;
      person(r, seed);
    }
    if (this.sim.cat) person(this.sim.cat, 0);
    person(this.sim.player, 0);
    for (const d of sortByDepth([...this.scene, ...people])) {
      if (talking && d.box && d.depth > pairDepth && pairBoxes.some((b) => coverShare(b, d.box!) > 0)) {
        // a small thing in front of the pair or poking up at their feet (a lamp's head) goes see-through for the
        // conversation; a big one (a house, the bus) is simply drawn: the pair is drawn again over everything below
        if (d.box.w * d.box.h < 6000) faded(g, () => d.draw(g, info));
        else d.draw(g, info);
        continue;
      }
      const hidden = d.box ? covers.filter((c) => c.depth < d.depth && coverShare(c.box, d.box!) > 0.18) : [];
      if (hidden.length > 0) drawFaded(g, d, info, hidden.map((c) => c.box));
      else d.draw(g, info);
    }
    if (pal.night) this.drawLampLight(ctx, true);

    // ── things hanging high, and the little lights ──
    if (has('lights') && this.popOf('lights', 1) >= 1) {
      for (const s of stringLights(this.sim.isBuilt('square') && this.popOf('square') >= 1)) {
        const at = toWorld(s.at[0], s.at[1]);
        drawSprite(g, s.sprite, at.x, at.y, { lit: 1 });
      }
    }
    // fireflies at night; by day the little side-on butterflies read as stray pixels, so there are none
    if (pal.night) this.fireflies.forEach((f, i) => drawFirefly(g, f.x, f.y, i));
    if (pal.night && !nightArtReady()) {
      // the night copies of the pictures are still being made (a moment after night starts): a plain dusk over what
      // is drawn, so the town never flashes back to day
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(28,38,92,0.5)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }
    behind();

    // ── a conversation: the town steps back, the two who talk stay bright and in front of everything ──
    if (talking) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.dim > 0.01) {
        // at night the town is dark already: a lighter veil, or it turns to mud
        ctx.fillStyle = pal.night ? `rgba(8,10,30,${0.26 * this.dim})` : `rgba(26,30,66,${0.3 * this.dim})`;
        ctx.fillRect(0, 0, w, h);
      }
      toWorldSpace();
      const pair: Drawable[] = [
        { depth: depthOfPoint(talking.x, talking.y), draw: (gg) => this.drawActor(gg, talking, seeds.get(talking.id) ?? 1) },
        { depth: depthOfPoint(this.sim.player.x, this.sim.player.y), draw: (gg) => this.drawActor(gg, this.sim.player, 0) },
      ];
      for (const d of sortByDepth(pair)) d.draw(g, info);
    }

    // ── over the world, in screen pixels ──
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawVignette(ctx, w, h, pal);
    const headAt = (a: Actor): Pt => {
      const s = cam.worldToScreen(toWorld(a.x, a.y));
      return { x: s.x, y: s.y - HEAD * z - 6 };
    };
    const tagOpts = { t: this.t, still: this.still, font: this.font };
    if (talking && this.speaking === talking.place.id) {
      // in a conversation the panel says who it is: no tag, only the bubble while they speak
      const at = headAt(talking);
      drawTalkBubble(ctx, pal, at.x, Math.max(this.safe.top + 44, at.y + 2), this.t, this.still);
    }
    if (!this.focus) {
      // Names only where they help: the resident the main button suggests, whoever is under the pointer or close
      // to the player, the player, and the lots on offer. The most important tags are placed first.
      const tags: { box: TagBox; draw: (b: TagBox) => void }[] = [];
      const add = (x: number, y: number, text: string, o: Omit<Parameters<typeof drawTag>[5], 't' | 'still' | 'font'>, alt?: number) => {
        // somebody off the stage gets no tag pulled in from the edge
        if (x < -30 || x > w + 30 || y < -10 || y > h + 60) return;
        const size = tagSize(ctx, text, this.font);
        tags.push({ box: { x, y, ...size, above: o.marker ? 28 : 0, alt }, draw: (b) => drawTag(ctx, pal, b.x, b.y, text, { ...tagOpts, ...o, marker: b.below ? undefined : o.marker }) });
      };
      const p = this.sim.player;
      const named = [...this.sim.residents.values()]
        .filter((r) => this.popOf(r.place.id) >= 0)
        .map((r) => {
          const id = r.place.id;
          const hot = (hover?.kind === 'resident' && hover.placeId === id) || (this.near?.kind === 'resident' && this.near.placeId === id);
          const rank = id === this.hint ? 0 : hot ? 1 : gridDistance(p.x, p.y, r.x, r.y) < NAME_NEAR ? 2 : 9;
          return { r, hot, rank };
        })
        .filter((e) => e.rank < 9)
        .sort((a, b) => a.rank - b.rank);
      const feetAt = (a: Actor) => cam.worldToScreen(toWorld(a.x, a.y)).y + 26;
      for (const { r, hot } of named) {
        const at = headAt(r);
        add(at.x, at.y, r.place.resident, { marker: state.marker[r.place.id], hover: hot }, feetAt(r));
      }
      const me = headAt(p);
      add(me.x, me.y, this.playerName, { self: true }, feetAt(p));
      const hoverPlace = hover?.kind === 'place' ? hover.placeId : null;
      for (const q of this.world.places) {
        const built = this.sim.isBuilt(q.id) && this.popOf(q.id) >= 0;
        const label = built || !this.sim.isSite(q.id) ? undefined : this.lotLabels[q.id];
        const hot = hoverPlace === q.id;
        if (!hot && !label) continue;
        const top = toWorld(q.x + q.w / 2, q.y + q.d / 2, built ? placeHeight(q.id) + 14 : lotHeight(q) + 8);
        const at = cam.worldToScreen(top);
        add(at.x, at.y, hot ? (label ? `${q.name} · ${label}` : q.name) : (label ?? q.name), { hover: hot, self: !hot });
      }
      const area = { x0: this.safe.left + 6, y0: this.safe.top + 4, x1: w - Math.max(this.safe.right, this.inset.right) - 6, y1: h - Math.max(this.safe.bottom, this.inset.bottom) - 4 };
      placeTags(
        tags.map((t) => t.box),
        area,
      );
      for (const t of tags) t.draw(t.box);
    }
    const now = this.t;
    this.emotes = this.emotes.filter((e) => now - e.born < EMOTE_SECONDS && this.sim.actor(e.target));
    // what rises over a head stays inside the stage, under its top buttons
    const keepIn = (at: Pt, room: number): Pt => ({ x: Math.min(w - 30, Math.max(30, at.x)), y: Math.max(this.safe.top + room, at.y) });
    for (const e of this.emotes) {
      const at = this.screenPointOf(e.target);
      if (at) drawEmote(ctx, e.kind, keepIn(at, 62), now - e.born, this.still);
    }
    this.floats = this.floats.filter((f) => now - f.born < FLOAT_SECONDS && this.sim.actor(f.target));
    this.floats.forEach((f, i) => {
      const at = this.screenPointOf(f.target);
      if (at) drawFloat(ctx, f.text, keepIn({ x: at.x, y: at.y - i * 4 }, 90), now - f.born, this.still, this.font);
    });
    drawParticles(ctx, this.particles.list);
  }
}

let blendsWarm = false;
/**
 * The night uses two blend modes the browser prepares the first time they are drawn ('color' for the night copies,
 * 'color-dodge' for lamp light): that first use cost a visible hitch of a few hundred ms when night began. Draw both
 * once, small, while the page opens (the pictures are still loading then).
 */
function warmBlends(): void {
  if (blendsWarm || typeof document === 'undefined') return;
  blendsWarm = true;
  try {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 320;
    const x = c.getContext('2d');
    if (!x) return;
    x.fillStyle = '#808080';
    x.fillRect(0, 0, 320, 320);
    for (const op of ['multiply', 'color', 'color-dodge', 'destination-in'] as const) {
      x.globalCompositeOperation = op;
      x.drawImage(c, 0, 0);
      x.fillRect(0, 0, 8, 8);
    }
  } catch {
    // nothing to warm: the first night frame pays for it
  }
}

/** Draw something see-through (COVER_ALPHA). */
function faded(g: G, draw: () => void): void {
  g.ctx.save();
  g.ctx.globalAlpha *= COVER_ALPHA;
  draw();
  g.ctx.restore();
}

/** Draw a thing that stands in front of people: as itself, but see-through over each of them. */
function drawFaded(g: G, d: Drawable, info: FrameInfo, people: Box[]): void {
  const { ctx } = g;
  const b = d.box!;
  ctx.save();
  clipOutside(ctx, { x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 }, people);
  d.draw(g, info);
  ctx.restore();
  ctx.save();
  clipInside(ctx, people);
  ctx.globalAlpha *= COVER_ALPHA;
  d.draw(g, info);
  ctx.restore();
}

function pondCentre(world: TownWorld): Tile | null {
  let x = 0;
  let y = 0;
  let n = 0;
  world.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] !== '~') continue;
      x += rx + 0.5;
      y += ry + 0.5;
      n++;
    }
  });
  return n > 0 ? { x: x / n, y: y / n } : null;
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
