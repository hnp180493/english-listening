// The town on one <canvas>: owns the simulation, the camera and the render loop, and turns pointer and key input
// into walking. No React here; TownStage.tsx is the thin component around it.

import { prefersReducedMotion } from '../../../core/motion';
import { sameTile } from '../../../core/town/map';
import { TOWN_WORLD, type PlaceId, type Tile, type TownWorld } from '../../../data/townWorld';
import { baseZoom, Camera } from './camera';
import { drawPlaceShadow, pavilionTop } from './draw/buildings';
import { CHARACTER_HEIGHT, drawCharacter, PLAYER_LOOK, RESIDENT_LOOK } from './draw/characters';
import { drawPondShimmer, paintDusk, paintGround } from './draw/ground';
import { drawEmote, drawFloat, drawParticles, drawSky, drawTag, drawTalkBubble, drawVignette, EMOTE_SECONDS, FLOAT_SECONDS, type EmoteKind } from './draw/overlay';
import { drawButterfly, drawCat, drawDuck, drawFirefly, drawGoal, drawHoverTile, drawLily, drawStringLights } from './draw/props';
import type { G } from './draw/util';
import { depthOfPoint, toWorld, worldBounds, type Pt } from './iso';
import { paletteFor, type TownPalette } from './palette';
import { Particles } from './particles';
import { pickAt, type Hit } from './pick';
import { placeHeight, LOT_HEIGHT } from './places';
import { buildScene, fireflySpots, POP_SECONDS, POP_STAGGER, popped, sceneKey, sortByDepth, type Drawable, type FrameInfo } from './scene';
import { gridDistance, keysToDelta, TownSim, type Actor, type StageState } from './sim';

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

const FOCUS_ZOOM = 1.5;
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
  private ground: HTMLCanvasElement | null = null;
  private groundFor = '';
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
  private near: Near = null;
  private readonly keys = { up: false, down: false, left: false, right: false };
  private font = 'system-ui, sans-serif';
  private first = true;
  private frames = 0;
  private overview = false;
  private lotLabels: Readonly<Record<string, string>> = {};
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
    try {
      this.font = getComputedStyle(canvas).fontFamily || this.font;
    } catch {
      // keep the fallback
    }
  }

  setCallbacks(cb: EngineCallbacks): void {
    this.cb = cb;
  }

  setState(state: StageState): void {
    this.state = state;
    this.pal = paletteFor(state.theme);
    this.sim.setState(state);
    const key = sceneKey(state);
    if (key !== this.sceneFor) {
      this.scene = buildScene(this.world, state);
      this.sceneFor = key;
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
    this.zoom0 = baseZoom(w, h);
    this.camera.targetZoom = this.zoom0 * (this.focus ? FOCUS_ZOOM : 1);
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
    this.ground = null;
  }

  // ───────────────────────── what the shell can ask for ─────────────────────────

  /** Zoom in on a resident (and the player beside them); null zooms back out to follow the player. */
  focusOn(placeId: PlaceId | null): void {
    this.focus = placeId && this.sim.residents.has(placeId) ? placeId : null;
    this.sim.engage(this.focus);
    this.camera.targetZoom = this.zoom0 * (this.focus ? FOCUS_ZOOM : 1);
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
    // never push the picture further than a third of the stage: on a small stage the panel may cover a little
    const dx = Math.min(this.inset.right / 2, this.viewW / 3);
    const dy = Math.min(this.inset.bottom / 2, this.viewH / 3);
    this.camera.shiftTo(-dx, -dy);
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

  /** A short text to keep over an empty lot (e.g. its price), by place id. */
  setLotLabels(labels: Readonly<Record<string, string>>): void {
    this.lotLabels = labels;
  }

  /** Show the whole town at once (true), or go back to following the player. */
  setOverview(on: boolean): void {
    this.overview = on;
    if (!on) this.camera.targetZoom = this.zoom0 * (this.focus ? FOCUS_ZOOM : 1);
    this.aim();
    if (!this.running) {
      this.camera.snap();
      this.render();
    }
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
    const from = this.screenPointOf(at);
    if (!from) return;
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
    return this.camera.worldToScreen({ x: feet.x, y: feet.y - CHARACTER_HEIGHT });
  }

  // ───────────────────────── input ─────────────────────────

  pointerMove(x: number, y: number): void {
    if (this.paused) return;
    this.setHover(pickAt(this.camera.screenToWorld({ x, y }), this.sim));
  }

  pointerLeave(): void {
    this.setHover(null);
  }

  /** A click or a tap on the stage, in CSS pixels from its top-left corner. */
  click(x: number, y: number): void {
    if (this.paused) return;
    const hit = pickAt(this.camera.screenToWorld({ x, y }), this.sim);
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
      this.camera.targetZoom = this.zoom0 * (this.focus ? FOCUS_ZOOM : 1);
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
    const p = this.sim.player;
    let at = toWorld(p.x, p.y);
    const r = this.focus ? this.sim.residents.get(this.focus) : null;
    if (r) {
      const o = toWorld(r.x, r.y);
      at = { x: (at.x + o.x) / 2, y: (at.y + o.y) / 2 };
    }
    this.camera.lookAt({ x: at.x, y: at.y - 26 });
  }

  private updateNear(): void {
    const p = this.sim.player;
    let near: Near = null;
    if (!p.moving) {
      // a neighbour straight across the screen is 64 world pixels away
      let best = 70;
      for (const r of this.sim.residents.values()) {
        const d = gridDistance(p.x, p.y, r.x, r.y);
        if (d < best) {
          best = d;
          near = { kind: 'resident', placeId: r.place.id };
        }
      }
      if (!near) {
        const lot = this.world.places.find((q) => !this.sim.isBuilt(q.id) && sameTile(q.door, p.tile));
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

  private ensureGround(): HTMLCanvasElement {
    const scale = Math.min(2.4, Math.max(1, this.dpr * this.zoom0 * 1.25));
    const key = `${this.pal.theme}|${scale.toFixed(2)}`;
    if (this.ground && this.groundFor === key) return this.ground;
    const b = this.bounds;
    const c = this.ground ?? document.createElement('canvas');
    c.width = Math.ceil((b.x1 - b.x0) * scale);
    c.height = Math.ceil((b.y1 - b.y0) * scale);
    const g = c.getContext('2d')!;
    g.setTransform(scale, 0, 0, scale, -b.x0 * scale, -b.y0 * scale);
    g.clearRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    paintGround(g, this.world, this.pal);
    if (this.pal.night) paintDusk(g, this.world);
    this.ground = c;
    this.groundFor = key;
    return c;
  }

  private render(): void {
    const { ctx, dpr, pal, camera: cam } = this;
    const w = this.viewW;
    const h = this.viewH;
    const state = this.state;
    const has = (id: string) => state.decorations.includes(id);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSky(ctx, w, h, pal, this.t, this.still);

    // ── the world, through the camera ──
    const z = cam.zoom;
    const toWorldSpace = () => ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 + cam.shiftX - cam.x * z), dpr * (h / 2 + cam.shiftY - cam.y * z));
    toWorldSpace();
    const g: G = { ctx, pal, t: this.t, still: this.still };
    const b = this.bounds;
    ctx.drawImage(this.ensureGround(), b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    drawPondShimmer(g, this.world);
    if (has('lilies')) this.world.decorations.lilies.forEach((s, i) => popped(g, this.popOf('lilies', i), toWorld(s.x, s.y), () => drawLily(g, s.x, s.y, i)));
    if (this.pond) for (let i = 0; i < 2; i++) drawDuck(g, this.pond.x, this.pond.y, i);
    for (const p of this.world.places) drawPlaceShadow(g, p, this.sim.isBuilt(p.id));
    const hover = this.hover;
    if (hover?.kind === 'tile' && hover.walkable) drawHoverTile(g, hover.tile.x, hover.tile.y);
    if (this.sim.goal) drawGoal(g, this.sim.goal.x, this.sim.goal.y);

    // ── everything standing, far to near ──
    const info: FrameInfo = { lit: state.lit, hoverPlace: hover?.kind === 'place' ? hover.placeId : null, pop: this.popOf };
    const people: Drawable[] = [];
    const person = (a: Actor, draw: (gg: G) => void) => people.push({ depth: depthOfPoint(a.x, a.y), draw });
    let n = 0;
    const seeds = new Map<PlaceId, number>();
    for (const r of this.sim.residents.values()) {
      const seed = ++n;
      seeds.set(r.place.id, seed);
      // somebody whose house is still on its way is not in town yet
      if (this.popOf(r.place.id) < 0) continue;
      person(r, (gg) => drawCharacter(gg, r, RESIDENT_LOOK[r.place.id], seed));
    }
    const cat = this.sim.cat;
    if (cat) person(cat, (gg) => drawCat(gg, cat));
    person(this.sim.player, (gg) => drawCharacter(gg, this.sim.player, PLAYER_LOOK, 0, true));
    const all = people.length > 0 ? sortByDepth([...this.scene, ...people]) : this.scene;
    for (const d of all) d.draw(g, info);

    // ── things hanging high, and the night's little lights ──
    if (has('lights') && this.popOf('lights', 2) >= 1) {
      const poles = this.world.decorations.lights.map((s) => toWorld(s.x + 0.5, s.y + 0.5, 66));
      const square = this.world.places.find((p) => p.id === 'square');
      const top = square && this.sim.isBuilt('square') ? pavilionTop(square) : null;
      if (top) poles.forEach((p, i) => drawStringLights(g, top, p, i));
      for (let i = 1; i < poles.length; i++) drawStringLights(g, poles[i - 1], poles[i], i + 2);
    }
    if (pal.night) this.fireflies.forEach((f, i) => drawFirefly(g, f.x, f.y, i));
    else this.fireflies.forEach((f, i) => i % 3 === 0 && drawButterfly(g, f.x, f.y, i));

    // ── a conversation: the town steps back, the two who talk stay bright ──
    const talking = this.focus ? (this.sim.residents.get(this.focus) ?? null) : null;
    if (this.dim > 0.01) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = pal.night ? `rgba(8,10,30,${0.5 * this.dim})` : `rgba(26,30,66,${0.4 * this.dim})`;
      ctx.fillRect(0, 0, w, h);
      if (talking) {
        toWorldSpace();
        const pair: Drawable[] = [
          { depth: depthOfPoint(talking.x, talking.y), draw: (gg) => drawCharacter(gg, talking, RESIDENT_LOOK[talking.place.id], seeds.get(talking.place.id) ?? 1) },
          { depth: depthOfPoint(this.sim.player.x, this.sim.player.y), draw: (gg) => drawCharacter(gg, this.sim.player, PLAYER_LOOK, 0, true) },
        ];
        for (const d of sortByDepth(pair)) d.draw(g, info);
      }
    }

    // ── over the world, in screen pixels ──
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawVignette(ctx, w, h, pal);
    const tagAt = (a: Actor): Pt => {
      const feet = toWorld(a.x, a.y);
      const s = cam.worldToScreen(feet);
      return { x: s.x, y: s.y - CHARACTER_HEIGHT * z - 7 };
    };
    const tagOpts = { t: this.t, still: this.still, font: this.font };
    for (const r of this.sim.residents.values()) {
      if (this.popOf(r.place.id) < 0) continue;
      // in a conversation only the one talking keeps a tag
      if (this.focus && r !== talking) continue;
      const at = tagAt(r);
      const hot = (hover?.kind === 'resident' && hover.placeId === r.place.id) || (this.near?.kind === 'resident' && this.near.placeId === r.place.id);
      drawTag(ctx, pal, at.x, at.y, r.place.resident, { ...tagOpts, marker: this.focus ? undefined : state.marker[r.place.id], hover: hot && !this.focus });
      if (r === talking && this.speaking === r.place.id) drawTalkBubble(ctx, pal, at.x, at.y - 24, this.t, this.still);
    }
    if (!this.focus) {
      const at = tagAt(this.sim.player);
      drawTag(ctx, pal, at.x, at.y, this.playerName, { ...tagOpts, self: true });
    }
    const hoverPlace = hover?.kind === 'place' ? hover.placeId : null;
    for (const p of this.focus ? [] : this.world.places) {
      const built = this.sim.isBuilt(p.id) && this.popOf(p.id) >= 0;
      const label = built ? undefined : this.lotLabels[p.id];
      const hot = hoverPlace === p.id;
      if (!hot && !label) continue;
      const top = toWorld(p.x + p.w / 2, p.y + p.d / 2, built ? placeHeight(p.id) + 18 : LOT_HEIGHT + 8);
      const s = cam.worldToScreen(top);
      drawTag(ctx, pal, s.x, s.y, hot ? (label ? `${p.name} · ${label}` : p.name) : (label ?? p.name), { ...tagOpts, hover: hot, self: !hot });
    }
    const now = this.t;
    this.emotes = this.emotes.filter((e) => now - e.born < EMOTE_SECONDS && this.sim.actor(e.target));
    for (const e of this.emotes) {
      const at = this.screenPointOf(e.target);
      if (at) drawEmote(ctx, e.kind, at, now - e.born, this.still);
    }
    this.floats = this.floats.filter((f) => now - f.born < FLOAT_SECONDS && this.sim.actor(f.target));
    this.floats.forEach((f, i) => {
      const at = this.screenPointOf(f.target);
      if (at) drawFloat(ctx, f.text, { x: at.x, y: at.y - i * 4 }, now - f.born, this.still, this.font);
    });
    drawParticles(ctx, this.particles.list);
  }
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
