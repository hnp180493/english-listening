// The whole 3D town as a three.js scene: the ground, nature and the fixed things built once; the places, lots,
// decorations and projects rebuilt when what is built or bought changes (layoutKey); the light rig for day and
// night (a soft sun with shadows that follow the camera, a sky-and-ground fill, a few real lamp lights at night near
// the camera, glowing halos and fireflies). Characters are added by the engine.

import { BufferGeometry, CanvasTexture, DirectionalLight, Float32BufferAttribute, Group, HemisphereLight, Mesh, Object3D, PointLight, Points, PointsMaterial, AdditiveBlending, Scene, type Material, Color } from 'three';
import { BUS_THING, groundHeight, type ActivitySpotId, type PlaceId, type TownWorld } from '../../../../data/townWorld';
import { EXTRA_DECOR } from '../../engine/extraDecor';
import type { StageState } from '../../engine/sim';
import { hash2, middleOf } from './coords';
import { cropsKey, fireflySpots, lamps, layoutKey, lotState, mapTrees, natureOf, nearestLamps, tufts, type Lamp, type TreeSpot } from './layout';
import { makeMaterials, type Materials } from './materials';
import { Merge, shapes } from './merge';
import { buildTrees, buildTufts, type Nature } from './nature';
import { lightRig, windowGlow, C } from './palette3d';
import type { Aabb } from './pick3d';
import { buildInn, buildPlace, buildSite, type Thing } from './places3d';
import { buildCrops, buildDecorations, buildProject, buildProps, buildScenery, type Piece } from './props3d';
import { buildStreetFurniture } from './streetFurniture';
import { buildTerrain, type Terrain } from './terrain';
import { buildBackdrop, type Backdrop } from './backdrop';
import { NOON_SUN, stepSun, type Vec3 } from '../../../../core/town/sunPath';
import { srgb01 } from './skyLook';

/** Real point lights kept at the lamps nearest the camera's target (a fixed number: no shader rebuilds). */
export const LAMP_LIGHTS = 6;
/**
 * The sun at noon (towards the viewer's left and behind the town: faces with doors are lit), the default direction
 * of the offscreen studios too. In the town the light moves over the day (core/town/sunPath.ts sunAt, setSun).
 */
const SUN_DIR = NOON_SUN;
/** The sun at dawn and dusk, and the light under cloud (setWeather). */
const SKY_GOLD = new Color('#ffb070');
const SKY_GREY = new Color('#aab4c4');

/** A light's own right and up axes on the ground's plane (three's lookAt from the light to its target, up = +y). */
export interface LightBasis {
  dir: Vec3;
  right: Vec3;
  up: Vec3;
}

/** The basis of the sun's shadow camera for a direction towards the light (not straight up: MIN_ELEVATION < 90°). */
export function lightBasis(towards: Vec3): LightBasis {
  const l = Math.hypot(towards.x, towards.y, towards.z);
  const z = { x: towards.x / l, y: towards.y / l, z: towards.z / l };
  const h = Math.hypot(z.z, z.x);
  const x = { x: z.z / h, y: 0, z: -z.x / h };
  return { dir: z, right: x, up: { x: z.y * x.z - z.z * x.y, y: z.z * x.x - z.x * x.z, z: z.x * x.y - z.y * x.x } };
}
const NOON_BASIS = lightBasis(SUN_DIR);

/**
 * Where the shadow box centres for a view centred on `at` (ground): moved in whole texels along the light's own right
 * and up axes, so shadows stay put on the ground while the box follows the camera. `basis` is the light's as it is now
 * (it moves only in small steps: stepSun); `texelUp` the texel along its up axis (the box is shorter that way).
 */
export function shadowCenter(at: { x: number; z: number }, texel: number, basis: LightBasis = NOON_BASIS, texelUp = texel): { x: number; y: number; z: number } {
  const R = basis.right;
  const U = basis.up;
  const a = at.x * R.x + at.z * R.z;
  const b = at.x * U.x + at.z * U.z;
  const da = Math.round(a / texel) * texel - a;
  const db = Math.round(b / texelUp) * texelUp - b;
  return { x: at.x + da * R.x + db * U.x, y: da * R.y + db * U.y, z: at.z + da * R.z + db * U.z };
}
export { SUN_DIR };

/** The shadow box's half size goes in steps of this many tiles (a zoom easing does not resize it every frame). */
const SHADOW_REACH_STEP = 2;

/** Something built in the dynamic layer, for the build animation, picking and fading. */
export interface Built {
  obj: Object3D;
  /** Decoration / project / place id ('' for fixed things) and its index: popOf(pop, index). */
  pop: string;
  index: number;
  /** The opaque merged body (swapped to the see-through material when it hides the player). */
  body: Mesh | null;
  box: Aabb;
  height: number;
  /** The strings of lights over the plaza. */
  strings?: boolean;
}

export interface PlaceView {
  id: PlaceId;
  built: boolean;
  site: boolean;
  /** Top above the ground (name tags), and its box (picking). */
  height: number;
  box: Aabb;
  centre: { x: number; z: number };
}

const UP = (o: Object3D, cast: boolean) => {
  o.traverse((c) => {
    if (c instanceof Mesh) {
      c.castShadow = cast;
      c.receiveShadow = true;
    }
  });
};

function glowTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  if (!x) return null;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/** Every geometry of a model of the dynamic layer. */
function geosOf(t: Thing | Piece): BufferGeometry[] {
  const pc = t as Piece;
  return [t.body, t.glass, t.bulbs, pc.water, pc.sway].filter((g): g is BufferGeometry => !!g);
}

export class TownScene {
  readonly scene = new Scene();
  readonly mats: Materials;
  readonly world: TownWorld;
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  private readonly lights: PointLight[] = [];
  /** At night a wide, soft warm light over what the camera looks at: the town round the player reads warm, not murky. */
  private readonly warm: PointLight;
  private readonly staticGroup = new Group();
  private readonly dynamicGroup = new Group();
  private terrain: Terrain;
  /** The sea round the island and the mountains behind it (a world with a coast only). */
  private backdrop: Backdrop | null = null;
  private trees: Nature;
  private tuftLayer: Nature;
  private lotTrees: Nature | null = null;
  private layoutFor = '';
  /** Geometry made for this layout only (the stones of empty lots). */
  private dynGeos: BufferGeometry[] = [];
  /**
   * The models of the dynamic layer kept from one layout to the next by what they are (a built place, a lot, the
   * fixed props, the decorations bought): buying one thing makes only that thing. `used` = the layout that used it
   * last (Infinity: made ahead of time, kept until used).
   */
  private kept = new Map<string, { pieces: (Thing | Piece)[]; used: number }>();
  private gen = 0;
  built: Built[] = [];
  readonly places = new Map<PlaceId, PlaceView>();
  readonly activities = new Map<ActivitySpotId, { box: Aabb; top: number; at: { x: number; z: number } }>();
  private lampList: Lamp[] = [];
  private lightsAt = -1;
  private halos: Points;
  private haloGeo = new BufferGeometry();
  private fireflies: Points;
  private glowTex: CanvasTexture | null;
  private night = 0;
  private castShadows = true;
  /** The light's direction as the shadows are drawn now (moved in small steps: setSun) and its strength (sunAt). */
  private basis = NOON_BASIS;
  private sunStrength = 1;
  /** The sun's intensity from the night and the weather, before its strength over the day. */
  private sunBase = 1;
  /** The wind (cloud shadows drift with it) and the time they last drifted. */
  private wind = 0;
  private driftT = -1;

  /** How high the ground is at a point (the hill; 0 elsewhere): what stands on it stands that much higher. */
  readonly lift = (x: number, z: number): number => groundHeight(x, z, this.world);

  constructor(world: TownWorld) {
    this.world = world;
    this.mats = makeMaterials();
    this.scene.name = 'town';
    this.scene.add(this.staticGroup, this.dynamicGroup);
    this.terrain = buildTerrain(world, this.mats);
    this.staticGroup.add(this.terrain.group);
    this.trees = buildTrees(mapTrees(world), this.mats, true, this.lift);
    this.staticGroup.add(this.trees.group);
    this.tuftLayer = buildTufts(tufts(world), this.mats, this.lift);
    this.staticGroup.add(this.tuftLayer.group);

    // the light rig
    this.hemi = new HemisphereLight('#ffffff', '#ffffff', 1);
    this.scene.add(this.hemi);
    this.sun = new DirectionalLight('#ffffff', 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 3;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 80;
    this.scene.add(this.sun, this.sun.target);
    for (let i = 0; i < LAMP_LIGHTS; i++) {
      const l = new PointLight('#ffbf6e', 0, 5.2, 1.25);
      l.castShadow = false;
      this.lights.push(l);
      this.scene.add(l);
    }
    this.warm = new PointLight('#ffc993', 0, 13, 1);
    this.warm.castShadow = false;
    this.scene.add(this.warm);
    // halos round the lamps and the fireflies: soft additive points
    this.glowTex = glowTexture();
    this.halos = new Points(this.haloGeo, new PointsMaterial({ color: '#ffc879', size: 1.5, map: this.glowTex, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true }));
    this.halos.frustumCulled = false;
    this.scene.add(this.halos);
    this.fireflies = this.makeFireflies();
    this.scene.add(this.fireflies);
    this.setNight(0);
  }

  private makeFireflies(): Points {
    const spots = fireflySpots(this.world);
    const pos: number[] = [];
    const seed: number[] = [];
    spots.forEach((s, i) => {
      for (let k = 0; k < 2; k++) {
        pos.push(s.x + (hash2(i, k, 7) - 0.5) * 0.8, this.lift(s.x, s.z) + 0.35 + hash2(i, k, 8) * 0.7, s.z + (hash2(i, k, 9) - 0.5) * 0.8);
        seed.push(hash2(i, k, 10) * 100);
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    const mat = new PointsMaterial({ color: '#d9ff96', size: 0.16, map: this.glowTex, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true });
    const time = this.mats.shared.time;
    const sway = this.mats.shared.sway;
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTime = time;
      s.uniforms.uSway = sway;
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aSeed;\nuniform float uTime;\nuniform float uSway;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float ft = uTime * uSway * 0.6 + aSeed;
          transformed += vec3(sin(ft * 0.9) * 0.35, sin(ft * 1.3) * 0.18, cos(ft * 0.7) * 0.35);`,
        );
    };
    mat.customProgramCacheKey = () => 'town-fireflies';
    const p = new Points(g, mat);
    p.frustumCulled = false;
    return p;
  }

  /**
   * The sea round the island and the mountains behind it (a world with a coast), made in an idle moment after the
   * town's first frame (about 50 ms of work: not in the long task that brings the town up) and put in the town by
   * showBackdrop once its shaders are compiled. Null when there is nothing to make.
   */
  makeBackdrop(): Group | null {
    if (this.backdrop || !this.world.coast) return null;
    this.backdrop = buildBackdrop(this.world, this.mats);
    return this.backdrop.group;
  }

  showBackdrop(): void {
    if (this.backdrop && !this.backdrop.group.parent) this.staticGroup.add(this.backdrop.group);
  }

  /** Rebuild the places, lots, decorations and projects when what is built or bought changed. */
  setLayout(state: StageState): boolean {
    const key = layoutKey(state);
    if (key === this.layoutFor) {
      this.updateGlass(state);
      return false;
    }
    this.layoutFor = key;
    this.clearDynamic();
    this.gen++;
    const world = this.world;
    const add = (t: Thing | Piece, pop: string, index: number, cast = true): Built | null => {
      const obj = new Group();
      // on the hill a thing stands where the ground is under its middle (the seats of a bench too: engine3d place)
      const y = this.lift(t.x, t.z);
      obj.position.set(t.x, y, t.z);
      obj.rotation.y = t.ry;
      let body: Mesh | null = null;
      if (t.body) {
        body = new Mesh(t.body, this.mats.std);
        obj.add(body);
      }
      const glow = 'glass' in t ? t.glass : null;
      if (glow) {
        const lit = pop && world.places.some((q) => q.id === pop) ? windowGlow(state.lit[pop] ?? 0) : 0.8;
        const gm = new Mesh(glow, this.mats.glass(lit));
        gm.userData.glass = true;
        obj.add(gm);
      }
      if (t.bulbs) {
        obj.add(new Mesh(t.bulbs, this.mats.bulb));
      }
      const pc = t as Piece;
      if (pc.water) {
        const w = new Mesh(pc.water, this.mats.water);
        w.renderOrder = 2;
        obj.add(w);
      }
      if (pc.sway) {
        obj.add(new Mesh(pc.sway, this.mats.sway));
      }
      if (obj.children.length === 0) return null;
      UP(obj, cast && this.castShadows);
      this.dynamicGroup.add(obj);
      const b: Built = {
        obj,
        pop,
        index,
        body,
        height: t.height,
        box: { min: { x: t.x - t.hx, y, z: t.z - t.hz }, max: { x: t.x + t.hx, y: y + t.height, z: t.z + t.hz } },
      };
      if (pc.bob) obj.userData.bob = true;
      if (pc.strings) b.strings = true;
      this.built.push(b);
      return b;
    };
    this.places.clear();
    const lotTrees: TreeSpot[] = [];
    const stones = new Merge();
    for (const p of world.places) {
      const s = lotState(p.id, state);
      const centre = { x: p.x + p.w / 2, z: p.y + p.d / 2 };
      if (s === 'built') {
        const t = this.reuse('place:' + p.id, () => [buildPlace(p)])[0] as Thing;
        add(t, p.id, 0);
        this.places.set(p.id, { id: p.id, built: true, site: false, height: t.height, centre, box: { min: { x: p.x + 0.1, y: 0, z: p.y + 0.1 }, max: { x: p.x + p.w - 0.1, y: t.height, z: p.y + p.d - 0.1 } } });
      } else if (s === 'site') {
        const t = this.reuse('site:' + p.id, () => [buildSite(p)])[0] as Thing;
        add(t, '', 0);
        this.places.set(p.id, { id: p.id, built: false, site: true, height: t.height, centre, box: { min: { x: p.x, y: 0, z: p.y }, max: { x: p.x + p.w, y: t.height, z: p.y + p.d } } });
      } else {
        const n = natureOf(p);
        lotTrees.push(...n.trees);
        for (const st of n.stones) stones.add(shapes.blob(0.16, 1), C.rock, { x: st.x, y: 0.05 + this.lift(st.x, st.z), z: st.z, s: [st.s * 1.3, st.s * 0.8, st.s], ry: st.x * 3 });
        this.places.set(p.id, { id: p.id, built: false, site: false, height: 0, centre, box: { min: { x: p.x, y: 0, z: p.y }, max: { x: p.x + p.w, y: 0, z: p.y + p.d } } });
      }
    }
    if (lotTrees.length > 0) {
      this.lotTrees = buildTrees(lotTrees, this.mats, this.castShadows, this.lift);
      this.dynamicGroup.add(this.lotTrees.group);
    }
    const sg = stones.build();
    if (sg) {
      const m = new Mesh(sg, this.mats.std);
      m.castShadow = this.castShadows;
      m.receiveShadow = true;
      this.dynGeos.push(sg);
      this.dynamicGroup.add(m);
    }
    // the boarding house and the fixed things (the bus only with the bus stop)
    const innProp = world.props.find((q) => q.kind === 'inn');
    const pieces: { piece: Thing | Piece; prop: number }[] = [];
    if (innProp) {
      const inn = this.reuse('inn', () => { const t = buildInn(innProp.tiles, world.life?.inn.door); return t ? [t] : []; })[0] as Thing | undefined;
      if (inn) pieces.push({ piece: inn, prop: world.props.indexOf(innProp) });
    }
    const station = state.built.includes('station');
    const props = this.reuse('props:' + station, () => buildProps(world, station)) as Piece[];
    for (const pc of props) pieces.push({ piece: pc, prop: pc.index });
    const propBuilt = new Map<number, Built>();
    for (const { piece, prop } of pieces) {
      const b = add(piece, '', 0, world.props[prop]?.kind !== 'pier');
      if (b) propBuilt.set(prop, b);
    }
    // the bus pops up with the bus stop
    for (const [i, b] of propBuilt) if (world.props[i]?.kind === 'bus') b.pop = 'station';
    // the farm field's crops: the learner's review cards as they stand
    const crops = this.reuse('crops:' + cropsKey(state.farm), () => {
      const c = buildCrops(world, state.farm);
      return c ? [c] : [];
    }) as Piece[];
    for (const pc of crops) add(pc, '', 0, false);
    // the scenery: the barn, the well, hay bales, fences, hedges, stones, bushes, ducks
    for (const pc of this.reuse('scenery', () => buildScenery(world)) as Piece[]) add(pc, '', 0);
    // the street furniture: bins, bike racks, post boxes, crates… merged by chunks (streetFurniture.ts)
    for (const pc of this.reuse('furniture', () => buildStreetFurniture(world)) as Piece[]) add(pc, '', 0);
    this.activities.clear();
    for (const [id, spot] of Object.entries(world.activities ?? {}) as [ActivitySpotId, NonNullable<TownWorld['activities']>[ActivitySpotId]][]) {
      // the bus is a thing only while it stands there (with the bus station)
      if (id === BUS_THING && !station) continue;
      // a thing to use (a bench, the radio: townWorld WORLD_THINGS) gives its own box, raised with the ground
      if (spot.box) {
        const q = spot.box;
        const g = groundHeight(q.x, q.y, world);
        this.activities.set(id, { box: { min: { x: q.x - q.w / 2, y: g, z: q.y - q.d / 2 }, max: { x: q.x + q.w / 2, y: g + q.h, z: q.y + q.d / 2 } }, top: g + q.h, at: { x: q.x, z: q.y } });
        continue;
      }
      const i = world.props.findIndex((q) => q.kind === spot.prop);
      const b = propBuilt.get(i);
      const prop = world.props[i];
      if (!b || !prop) continue;
      const at = prop.at ?? middleOf(prop.tiles);
      if (!at) continue;
      // the pier lies flat on the water: a box over its planks
      const box = prop.kind === 'pier' ? { min: { x: at.x - 1.15, y: -0.2, z: at.y - 0.32 }, max: { x: at.x + 0.15, y: 0.25, z: at.y + 0.32 } } : b.box;
      this.activities.set(id, { box, top: b.height, at: { x: at.x, z: at.y } });
    }
    // what the learner bought, and the projects
    const square = state.built.includes('square');
    const decor = this.reuse('decor:' + square + ':' + state.decorations.join(','), () => buildDecorations(world, state.decorations, square)) as Piece[];
    for (const pc of decor) add(pc, pc.pop, pc.index, pc.pop !== 'lilies');
    for (const id of state.extraDecor ?? []) {
      const spots = EXTRA_DECOR[id];
      if (!spots) continue;
      for (const pc of this.reuse('proj:' + id, () => buildProject(id, spots.map((s) => s.at))) as Piece[]) add(pc, id, pc.index, id !== 'proj-lake-lights');
    }
    // lamps, halos
    this.lampList = lamps(world, state);
    const hp: number[] = [];
    for (const l of this.lampList) hp.push(l.x, l.y, l.z);
    for (const b of this.built) {
      if (b.strings) {
        // the string lights: a soft wide glow over the plaza
        hp.push(b.obj.position.x, 1.5, b.obj.position.z);
      }
    }
    this.haloGeo.dispose();
    this.haloGeo = new BufferGeometry();
    this.haloGeo.setAttribute('position', new Float32BufferAttribute(hp, 3));
    this.halos.geometry = this.haloGeo;
    this.lightsAt = -1;
    this.prune();
    return true;
  }

  /** The models for `key`: kept ones, or made now (and kept). */
  private reuse(key: string, make: () => (Thing | Piece)[]): (Thing | Piece)[] {
    let e = this.kept.get(key);
    if (!e) {
      e = { pieces: make(), used: this.gen };
      this.kept.set(key, e);
    }
    e.used = this.gen;
    return e.pieces;
  }

  /** Free the models the last layout did not use (a house cannot be un-built, but decorations change as a set). */
  private prune(): void {
    for (const [key, e] of this.kept) {
      if (e.used >= this.gen) continue;
      for (const pc of e.pieces) for (const g of geosOf(pc)) g.dispose();
      this.kept.delete(key);
    }
  }

  /**
   * Make a place's model ahead of time (idle time after the town shows), so buying it builds nothing new on the
   * click. False when it was made already.
   */
  prebuild(id: PlaceId): boolean {
    const p = this.world.places.find((q) => q.id === id);
    if (!p || this.kept.has('place:' + id)) return false;
    this.kept.set('place:' + id, { pieces: [buildPlace(p)], used: Number.POSITIVE_INFINITY });
    return true;
  }

  /** Windows glow by each place's share of lines understood: the glass material follows `lit`. */
  private updateGlass(state: StageState): void {
    for (const b of this.built) {
      if (!b.pop || !this.places.get(b.pop as PlaceId)?.built) continue;
      const g = windowGlow(state.lit[b.pop] ?? 0);
      for (const c of b.obj.children) if (c instanceof Mesh && c.userData.glass) c.material = this.mats.glass(g);
    }
  }

  private clearDynamic(): void {
    for (const g of this.dynGeos) g.dispose();
    this.dynGeos = [];
    this.lotTrees?.dispose();
    this.lotTrees = null;
    this.dynamicGroup.clear();
    this.built = [];
  }

  /** Shadows off on a weak device (the sun still lights). */
  setShadows(on: boolean, size = 2048): void {
    this.castShadows = on;
    this.sun.castShadow = on;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  /** Day (0) to night (1): the light rig, the windows, the lamps, halos and fireflies. */
  setNight(k: number): void {
    this.night = k;
    const rig = lightRig(k);
    this.hemi.color.set(rig.hemiSky);
    this.hemi.groundColor.set(rig.hemiGround);
    this.hemi.intensity = rig.hemi;
    this.sun.color.set(rig.sunColor);
    this.sunBase = rig.sun;
    this.sun.intensity = rig.sun * this.sunStrength;
    this.mats.setNight(k);
    // the lamps' lights, the halos and the fireflies stay in the scene day and night, only their strength changes:
    // switching a light or an object on or off would rebuild every shader (a freeze of a second or more)
    (this.halos.material as PointsMaterial).opacity = 0.75 * rig.lamps;
    (this.fireflies.material as PointsMaterial).opacity = Math.max(0, (k - 0.5) * 2);
    this.warm.intensity = 1.1 * rig.lamps;
    if (rig.lamps <= 0) for (const l of this.lights) l.intensity = 0;
    else this.lightsAt = -1;
  }

  get nightAmount(): number {
    return this.night;
  }

  /**
   * The weather and the hour on top of the night's own light (core/town/sky.ts; call after setNight, which starts
   * from the rig again): under cloud the sun is dimmer and greyer and the light from all round cooler; at dawn and
   * dusk the sun is gold.
   */
  setWeather(cloud: number, glow: number): void {
    const rig = lightRig(this.night);
    const day = 1 - this.night;
    this.sun.color.set(rig.sunColor).lerp(SKY_GOLD, Math.min(1, glow) * 0.8).lerp(SKY_GREY, cloud * 0.6);
    this.sunBase = rig.sun * (1 - 0.62 * cloud * (0.4 + 0.6 * day)) * (1 - 0.18 * glow);
    this.sun.intensity = this.sunBase * this.sunStrength;
    // under a grey sky shadows go soft and faint
    this.sun.shadow.intensity = 1 - 0.55 * cloud;
    this.hemi.color.set(rig.hemiSky).lerp(SKY_GOLD, glow * 0.25).lerp(SKY_GREY, cloud * 0.5);
    this.hemi.intensity = rig.hemi * (1 - 0.12 * cloud);
  }

  /**
   * Where the light comes from (towards it, unit) and how strong it is (core/town/sunPath.ts sunAt): the sun's arc by
   * day, the moon's at night. The shadows are re-aimed only once it has turned by a fraction of a degree (stepSun), and
   * their snapping (shadowCenter) uses the basis of that held direction, so they never shimmer from frame to frame.
   */
  setSun(towards: Vec3, strength: number): void {
    const next = stepSun(this.basis.dir, towards);
    if (next !== this.basis.dir) this.basis = lightBasis(next);
    if (strength !== this.sunStrength) {
      this.sunStrength = strength;
      this.sun.intensity = this.sunBase * strength;
    }
  }

  /** The light's direction as the shadows are drawn now (unit, towards it). */
  get sunDirection(): Vec3 {
    return this.basis.dir;
  }

  /**
   * The air and the ground (weather3d.ts): how wet (0 … 1), how misty (0 … 1), the mist's colour (the horizon's),
   * the sky's colour that wet ground reflects, how dark cloud shadows are (0 = none) and the wind they drift with.
   */
  setAir(a: { wet: number; haze: number; mist: string; sky: string; shade: number; wind: number }): void {
    const w = this.mats.shared.weather;
    w.wet.value = a.wet;
    w.haze.value = a.haze;
    const [r, g, b] = srgb01(a.mist);
    w.fogColour.value.set(r, g, b);
    w.skyRefl.value.set(a.sky).multiplyScalar(0.55);
    w.cloud.value.z = a.shade;
    this.wind = a.wind;
  }

  /**
   * Each frame: the sun's shadow box follows what the camera looks at (snapped to its texels, so shadows do not
   * crawl), the real lamp lights move to the lamps nearest it, balloons bob.
   */
  update(t: number, at: { x: number; z: number }, reach: number, still: boolean): void {
    const r = Math.max(6, reach);
    const cam = this.sun.shadow.camera;
    // snapped in the light's own view (its right and up axes), not along the ground's x and z: the sun is slanted, so
    // a whole world texel along x is a fraction of a shadow texel, and every shadow edge crawled and shimmered while
    // the camera followed a walker (2026-11-22, "nhân vật di chuyển cứ rung rung"). The size of the box is held in
    // steps too, so a zoom easing in does not resample every shadow each frame.
    const rq = Math.ceil(r / SHADOW_REACH_STEP) * SHADOW_REACH_STEP;
    const B = this.basis;
    // along the light's up axis the box covers what is in view on the ground (its height there is the ground's depth
    // times the sun's height) and a margin for walls and roofs: a low sun would otherwise stretch the box over the
    // ground far beyond the view and draw every caster there (dawn cost a third more draw calls)
    const rv = Math.min(rq, Math.ceil((rq * Math.max(0.2, B.dir.y) + 3) / SHADOW_REACH_STEP) * SHADOW_REACH_STEP);
    if (cam.right !== rq || cam.top !== rv) {
      cam.left = -rq;
      cam.right = rq;
      cam.top = rv;
      cam.bottom = -rv;
    }
    const texel = (2 * rq) / this.sun.shadow.mapSize.x;
    const texelUp = (2 * rv) / this.sun.shadow.mapSize.y;
    const { x: sx, y: sy, z: sz } = shadowCenter(at, texel, B, texelUp);
    const d = Math.max(30, rq + 6);
    cam.far = d * 2 + 10;
    cam.updateProjectionMatrix();
    this.sun.position.set(sx + B.dir.x * d, sy + B.dir.y * d, sz + B.dir.z * d);
    this.sun.target.position.set(sx, sy, sz);
    this.sun.target.updateMatrixWorld();
    this.warm.position.set(at.x, 3.6, at.z);
    // the mist is measured from what the camera looks at; cloud shadows drift with the wind (not with reduced motion)
    const w = this.mats.shared.weather;
    w.focus.value.set(at.x, this.lift(at.x, at.z), at.z);
    w.fogRange.value.set(1.5 + r * 0.06, 3 + r * 0.8);
    if (!still && this.driftT >= 0 && w.cloud.value.z > 0) {
      const dt = Math.min(0.25, Math.max(0, t - this.driftT));
      const speed = 0.5 + 1.6 * this.wind;
      w.cloud.value.x -= dt * speed * 0.85;
      w.cloud.value.y -= dt * speed * 0.35;
    }
    this.driftT = t;
    if (this.night > 0.05 && (this.lightsAt < 0 || t - this.lightsAt > 0.3)) {
      this.lightsAt = t;
      const near = nearestLamps(this.lampList, at.x, at.z, LAMP_LIGHTS);
      const rig = lightRig(this.night);
      this.lights.forEach((l, i) => {
        const lamp = near[i];
        if (!lamp) {
          l.intensity = 0;
          return;
        }
        l.position.set(lamp.x, lamp.y - 0.05, lamp.z);
        l.intensity = 3.6 * lamp.k * rig.lamps;
      });
    }
    if (!still) {
      for (const b of this.built) {
        if (!b.obj.userData.bob) continue;
        b.obj.rotation.z = Math.sin(t * 1.1 + b.index) * 0.04;
        b.obj.rotation.x = Math.cos(t * 0.9 + b.index * 2) * 0.03;
      }
    }
  }

  private hot: string | null = null;

  /** The place (or lot on offer) under the pointer is drawn a little brighter. */
  highlight(id: string | null): void {
    if (id === this.hot) return;
    this.hot = id;
    for (const b of this.built) {
      if (!b.body || b.body.material === this.mats.faded) continue;
      const v = id ? this.places.get(id as PlaceId) : undefined;
      const on = !!v && (b.pop === id || (!v.built && b.pop === '' && b.obj.position.x === v.centre.x && b.obj.position.z === v.centre.z));
      b.body.material = on ? this.mats.hot : this.mats.std;
    }
  }

  /** The materials whose see-through copy hides a house in front of the player. */
  fade(b: Built, on: boolean): void {
    if (!b.body) return;
    const want: Material = on ? this.mats.faded : this.mats.std;
    if (b.body.material !== want) {
      b.body.material = want;
      b.body.castShadow = !on && this.castShadows;
    }
  }

  dispose(): void {
    this.clearDynamic();
    for (const e of this.kept.values()) for (const pc of e.pieces) for (const g of geosOf(pc)) g.dispose();
    this.kept.clear();
    this.terrain.dispose();
    this.backdrop?.dispose();
    this.trees.dispose();
    this.tuftLayer.dispose();
    this.haloGeo.dispose();
    (this.halos.material as Material).dispose();
    this.fireflies.geometry.dispose();
    (this.fireflies.material as Material).dispose();
    this.glowTex?.dispose();
    this.sun.shadow.map?.dispose();
    this.mats.dispose();
    this.scene.clear();
  }
}
