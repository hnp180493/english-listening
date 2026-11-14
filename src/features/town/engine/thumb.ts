// A small picture of one thing of the town (a place, a decoration), drawn by the same code that draws it in the
// world: the build panel shows what the learner is about to get. Always in daylight, nothing moves.

import { TOWN_WORLD, type DecorationId, type PlaceId, type TownWorld } from '../../../data/townWorld';
import { drawPlace } from './draw/buildings';
import { drawBalloons, drawBench, drawCat, drawFlagPole, drawFlowerBed, drawFountain, drawLamp, drawLightPole, drawLily, drawStall, drawTree } from './draw/props';
import type { G } from './draw/util';
import { toWorld, type Pt } from './iso';
import { paletteFor } from './palette';
import { placeHeight } from './places';
import type { Cat } from './sim';

interface Frame {
  /** The middle of the picture, in world pixels. */
  centre: Pt;
  /** How much of the world it shows. */
  w: number;
  h: number;
  draw: (g: G) => void;
}

/** How big each decoration stands (world pixels): width, height, and how far its middle is above the ground. */
const DECOR_BOX: Readonly<Record<DecorationId, readonly [number, number, number]>> = {
  lamps1: [44, 76, 30],
  lamps2: [44, 76, 30],
  flowers: [48, 36, 8],
  benches: [58, 44, 8],
  blossom: [84, 104, 42],
  lights: [44, 86, 36],
  lilies: [30, 20, 1],
  stall: [80, 78, 26],
  fountain: [112, 96, 26],
  balloons: [46, 78, 32],
  flags: [56, 82, 34],
  cat: [34, 30, 9],
};

function frameOf(id: string, world: TownWorld): Frame | null {
  const place = world.places.find((p) => p.id === id);
  if (place) {
    const tall = placeHeight(place.id as PlaceId);
    const ground = toWorld(place.x + place.w / 2, place.y + place.d / 2);
    const span = place.w + place.d;
    return {
      centre: { x: ground.x, y: ground.y - tall / 2 },
      w: span * 32 + 16,
      h: span * 16 + tall + 26,
      draw: (g) => drawPlace(g, place, 0.6, false),
    };
  }
  const spots = world.decorations[id as DecorationId];
  const s = spots?.[0];
  if (!s) return null;
  const dId = id as DecorationId;
  const base = s.solid ? toWorld(s.x + 0.5, s.y + 0.5) : toWorld(s.x, s.y);
  const [w, h, up] = DECOR_BOX[dId];
  const draw = (g: G): void => {
    switch (dId) {
      case 'lamps1':
      case 'lamps2':
        return drawLamp(g, s.x, s.y);
      case 'flowers':
        return drawFlowerBed(g, s.x, s.y);
      case 'benches':
        return drawBench(g, s.x, s.y, s.dir ?? 's');
      case 'blossom':
        return drawTree(g, s.x, s.y, 'blossom');
      case 'lights':
        return void drawLightPole(g, s.x, s.y);
      case 'lilies':
        return drawLily(g, s.x, s.y, 0);
      case 'stall':
        return drawStall(g, s.x, s.y);
      case 'fountain':
        return drawFountain(g, s.x, s.y, true);
      case 'balloons':
        return drawBalloons(g, s.x, s.y);
      case 'flags':
        return drawFlagPole(g, s.x, s.y, 0);
      case 'cat': {
        const cat: Cat = { id: 'cat', kind: 'cat', x: s.x, y: s.y, tile: { x: Math.floor(s.x), y: Math.floor(s.y) }, path: [], speed: 0, facing: 1, moving: false, phase: 0, sitFor: 1 };
        return drawCat(g, cat);
      }
    }
  };
  return { centre: { x: base.x, y: base.y - up }, w, h, draw };
}

/**
 * Paint the picture of a place or a decoration into a canvas of `cssW` × `cssH` CSS pixels. False when the id is
 * unknown or the canvas cannot be drawn on.
 */
export function paintThumb(canvas: HTMLCanvasElement, id: string, cssW: number, cssH: number, world: TownWorld = TOWN_WORLD): boolean {
  const frame = frameOf(id, world);
  const ctx = canvas.getContext('2d');
  if (!frame || !ctx) return false;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const k = Math.min(cssW / frame.w, cssH / frame.h);
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (cssW / 2 - frame.centre.x * k), dpr * (cssH / 2 - frame.centre.y * k));
  frame.draw({ ctx, pal: paletteFor('day'), t: 0, still: true });
  return true;
}
