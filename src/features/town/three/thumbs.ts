// A small picture of one thing of the town (a place, a decoration) for the build panel: the same 3D model the town
// builds (scene/places3d.ts, scene/props3d.ts, the cat of chars/pets.ts), alone, in the noon light of the town,
// drawn with the shared offscreen renderer (offscreen.ts). Cached per (id, size).

import { Group, Mesh, type BufferGeometry, type Object3D } from 'three';
import { DECORATION_IDS, PLACE_IDS, TOWN_WORLD, worldPlace, type DecorationId, type TownWorld } from '../../../data/townWorld';
import { createPet } from './chars/pets';
import { canvasOf, charStudio, frame, paint, townStudio, type Studio } from './offscreen';
import { makeMaterials, type Materials } from './scene/materials';
import { buildPlace } from './scene/places3d';
import { buildDecorations, type Piece } from './scene/props3d';
import { C } from './scene/palette3d';
import { Merge, shapes } from './scene/merge';
import { WATER_LEVEL } from './scene/terrain';

let mats: Materials | null = null;
const cache = new Map<string, HTMLCanvasElement>();

/** Where a decoration's pieces stand for its picture: a few of them close together, not all over the town. */
const DECOR_SPOTS: Readonly<Partial<Record<DecorationId, TownWorld['decorations'][DecorationId]>>> = {
  lamps1: [{ x: 0, y: 0, solid: false }],
  lamps2: [{ x: 0, y: 0, solid: false, flip: true }],
  flowers: [{ x: 0, y: 0, solid: true }],
  benches: [{ x: 0, y: 0, solid: true, dir: 's' }],
  blossom: [{ x: 0, y: 0, solid: true }],
  // two poles with a string of bulbs between them
  lights: [
    { x: 0, y: 0, solid: false },
    { x: 1.7, y: -0.6, solid: false },
  ],
  lilies: [
    { x: 0, y: 0, solid: false },
    { x: 0.34, y: 0.22, solid: false },
    { x: -0.2, y: 0.3, solid: false },
  ],
  stall: [{ x: 0, y: 0, solid: true }],
  fountain: [{ x: 0, y: 0, solid: true }],
  balloons: [{ x: 0, y: 0, solid: false }],
  flags: [
    { x: 0, y: 0, solid: false },
    { x: 0.55, y: -0.3, solid: false },
  ],
};

function meshesOf(t: { body: BufferGeometry | null; glass?: BufferGeometry | null; bulbs?: BufferGeometry | null; water?: BufferGeometry | null; sway?: BufferGeometry | null }, m: Materials): Mesh[] {
  const out: Mesh[] = [];
  if (t.body) out.push(new Mesh(t.body, m.std));
  if (t.glass) out.push(new Mesh(t.glass, m.glass(0.6)));
  if (t.bulbs) out.push(new Mesh(t.bulbs, m.bulb));
  if (t.water) out.push(new Mesh(t.water, m.water));
  if (t.sway) out.push(new Mesh(t.sway, m.sway));
  return out;
}

/** The model of a place or a decoration, standing at the origin; null for an unknown id. */
function modelOf(id: string, m: Materials): { obj: Object3D; studio: Studio; dispose: () => void } | null {
  if (id === 'cat') {
    const pet = createPet('cat');
    pet.setHeading(Math.PI / 2 - 0.5, true);
    pet.update(0.016, 0);
    return { obj: pet.root, studio: charStudio(), dispose: () => pet.dispose() };
  }
  const geos: BufferGeometry[] = [];
  const g = new Group();
  const place = (PLACE_IDS as readonly string[]).includes(id) ? worldPlace(id) : undefined;
  if (place) {
    const t = buildPlace(place);
    const o = new Group();
    o.rotation.y = t.ry;
    for (const mesh of meshesOf(t, m)) {
      o.add(mesh);
      geos.push(mesh.geometry);
    }
    g.add(o);
  } else if ((DECORATION_IDS as readonly string[]).includes(id)) {
    const did = id as DecorationId;
    const spots = DECOR_SPOTS[did] ?? [{ x: 0, y: 0, solid: false }];
    const world: TownWorld = { ...TOWN_WORLD, places: [], decorations: { ...TOWN_WORLD.decorations, [did]: spots } };
    const pieces: Piece[] = buildDecorations(world, [did], false);
    if (pieces.length === 0) return null;
    for (const pc of pieces) {
      const o = new Group();
      o.position.set(pc.x, 0, pc.z);
      o.rotation.y = pc.ry;
      for (const mesh of meshesOf(pc, m)) {
        o.add(mesh);
        geos.push(mesh.geometry);
      }
      g.add(o);
    }
    if (did === 'lilies') {
      // the pads float: a little water under them
      const pool = new Merge().add(shapes.cyl(0.62, 0.62, 0.02, 28), C.waterShallow, { x: 0.05, y: WATER_LEVEL - 0.01, z: 0.17 }, { ao: false }).build();
      if (pool) {
        g.add(new Mesh(pool, m.water));
        geos.push(pool);
      }
    }
  } else return null;
  return { obj: g, studio: townStudio(), dispose: () => geos.forEach((x) => x.dispose()) };
}

/**
 * A picture of a place or a decoration, `w` × `h` device pixels (the cached canvas: draw it, do not draw on it).
 * Null for an unknown id or when this browser cannot draw in 3D.
 */
export function renderThumb(id: string, w: number, h: number): HTMLCanvasElement | null {
  const key = `${id}|${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  mats ??= makeMaterials();
  const model = modelOf(id, mats);
  if (!model) return null;
  const { obj, studio, dispose } = model;
  studio.scene.add(obj);
  frame(studio, obj, { aspect: w / h, fill: 0.9, pitch: 0.52 });
  const out = canvasOf(w, h);
  const drawn = paint(studio, out);
  studio.scene.remove(obj);
  dispose();
  if (!drawn) return null;
  cache.set(key, out);
  return out;
}

/** Forget the pictures and their materials (leaving the town). */
export function disposeThumbs(): void {
  cache.clear();
  mats?.dispose();
  mats = null;
}
