// The town map's picture (features/town/map): the island drawn from the world data in the town's pastel colours,
// grass, the lake, the paths and the plaza, the farm's fields, trees as soft round crowns, the houses as small blocks
// with roofs in each place's colours. Built houses stand in colour; the lots on offer are building sites (a plot of
// earth with a dashed rim); the other lots are only a faint dotted outline on the grass (in town they are nature
// until they come up). The full map looks down at a slant (`tilt` < 1: walls show), the minimap straight down.
//
// GAME ART like the rest of the canvas (docs/design-system.md "Thị trấn: game art"): colours from palette3d.ts,
// sunk into dusk at night by engine/palette `ink`. Nothing here is UI chrome.

import { TOWN_WORLD, worldTrees, type TownWorld } from '../../../data/townWorld';
import type { TownPalette } from '../engine/palette';
import { C, mixHex } from '../three/scene/palette3d';
import { footprint, PLACE_ART, type PlaceArt } from './mapGeo';
import { pierCorners } from './mapHit';
import { mountainHeight, RANGE_DEPTH } from '../three/scene/range';
import { liftPx, toBox, viewMatrix, type Box, type MapView, type Pt } from './mapView';

/** What stands in town now (the stage's state). */
export interface MapState {
  built: ReadonlySet<string>;
  /** Lots shown as building sites (null: all of them). */
  sites: ReadonlySet<string> | null;
  decorations: ReadonlySet<string>;
}

type Status = 'built' | 'site' | 'lot' | 'prop';

interface Block {
  id: string;
  corners: Pt[];
  h: number;
  art: PlaceArt;
  status: Status;
}

interface Tree {
  x: number;
  y: number;
  kind: 'round' | 'pine' | 'blossom' | 'palm';
}

/** The picture's parts, worked out once per world and state; the ground's paths in grid units. */
export interface MapScene {
  world: TownWorld;
  water: Path2D | null;
  waterDeep: Path2D | null;
  /** The coast's sand (2026-11-24). */
  sand: Path2D | null;
  /** The sea round the island and the mountains behind it (a world with a coast): the range as cells of colour. */
  coast: { cells: { x: number; y: number; c: string }[]; step: number; peaks: { x: number; y: number; h: number }[] } | null;
  /** The harbour's jetty and the like: plank walks out over the water. */
  jetties: Pt[][];
  plaza: Path2D | null;
  paths: Path2D | null;
  fields: Pt[][];
  trees: Tree[];
  blocks: Block[];
  /** Small round things on the ground: hay bales, the well, bushes, rocks, the fountain. */
  dots: { x: number; y: number; r: number; color: string; rim?: string }[];
  /** The hills (a soft light patch each). */
  hills: { x: number; y: number; r: number }[];
  pier: Pt[] | null;
}

const PROP_ART: Readonly<Record<string, PlaceArt>> = {
  inn: { wall: C.peach, roof: C.teal, h: 1.2, roofKind: 'gable' },
  barn: { wall: C.red, roof: C.woodDark, h: 1.0, roofKind: 'gable' },
  kiosk: { wall: C.butter, roof: C.orange, h: 0.6, roofKind: 'flat' },
  board: { wall: C.wood, roof: C.woodDark, h: 0.55, roofKind: 'open' },
  market: { wall: C.cream, roof: C.coral, h: 0.45, roofKind: 'flat' },
  bus: { wall: C.mustard, roof: C.butter, h: 0.5, roofKind: 'flat' },
  terrace: { wall: C.white, roof: C.coral, h: 0.5, roofKind: 'round' },
  hut: { wall: C.sky, roof: C.teal, h: 0.55, roofKind: 'gable' },
};

function boxOf(tiles: readonly { x: number; y: number }[]): { x: number; y: number; w: number; d: number } {
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, d: Math.max(...ys) - Math.min(...ys) + 1 };
}

const isPath = (ch: string | undefined) => ch === '=';
const isPlaza = (ch: string | undefined) => ch === 'o' || ch === 'F';

/** The picture's parts for a world in a state. */
export function mapScene(state: MapState, world: TownWorld = TOWN_WORLD): MapScene {
  const can2d = typeof Path2D !== 'undefined';
  const water = can2d ? new Path2D() : null;
  const waterDeep = can2d ? new Path2D() : null;
  const sand = can2d ? new Path2D() : null;
  const plaza = can2d ? new Path2D() : null;
  const paths = can2d ? new Path2D() : null;
  const at = (x: number, y: number) => world.rows[y]?.[x];
  for (let y = 0; y < world.size; y++) {
    for (let x = 0; x < world.size; x++) {
      const ch = at(x, y);
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (ch === '~') {
        water?.moveTo(cx + 0.72, cy);
        water?.arc(cx, cy, 0.72, 0, Math.PI * 2);
        // the deep middle: only where water goes on round it
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy) === '~') n++;
        if (n === 4) {
          waterDeep?.moveTo(cx + 0.62, cy);
          waterDeep?.arc(cx, cy, 0.62, 0, Math.PI * 2);
        }
      } else if (ch === ':' || ch === 'p') {
        sand?.moveTo(cx + 0.74, cy);
        sand?.arc(cx, cy, 0.74, 0, Math.PI * 2);
      } else if (isPlaza(ch)) {
        plaza?.moveTo(cx + 0.8, cy);
        plaza?.arc(cx, cy, 0.8, 0, Math.PI * 2);
      }
      if (isPath(ch)) {
        // a dot on every path tile, and a stroke to each path (or plaza) neighbour; a diagonal only where the corner
        // between is not path already (a staircase of tiles reads as a diagonal road)
        paths?.moveTo(cx, cy);
        paths?.lineTo(cx + 0.001, cy);
        const joins = (dx: number, dy: number) => {
          const o = at(x + dx, y + dy);
          return isPath(o) || isPlaza(o);
        };
        if (joins(1, 0)) {
          paths?.moveTo(cx, cy);
          paths?.lineTo(cx + 1, cy);
        }
        if (joins(0, 1)) {
          paths?.moveTo(cx, cy);
          paths?.lineTo(cx, cy + 1);
        }
        if (joins(-1, 0) && isPlaza(at(x - 1, y))) {
          paths?.moveTo(cx, cy);
          paths?.lineTo(cx - 1, cy);
        }
        if (joins(0, -1) && isPlaza(at(x, y - 1))) {
          paths?.moveTo(cx, cy);
          paths?.lineTo(cx, cy - 1);
        }
        for (const dx of [1, -1]) {
          if (joins(dx, 1) && !joins(dx, 0) && !joins(0, 1)) {
            paths?.moveTo(cx, cy);
            paths?.lineTo(cx + dx, cy + 1);
          }
        }
      }
    }
  }

  const trees: Tree[] = worldTrees(world).map((t) => ({ x: t.x + 0.5, y: t.y + 0.5, kind: t.kind }));
  if (state.decorations.has('blossom')) for (const s of world.decorations.blossom ?? []) trees.push({ x: s.x + 0.5, y: s.y + 0.5, kind: 'blossom' });

  const blocks: Block[] = world.places.map((p) => {
    const built = state.built.has(p.id);
    const site = !built && (state.sites === null || state.sites.has(p.id));
    return { id: p.id, corners: footprint(p), h: PLACE_ART[p.id]?.h ?? 0.8, art: PLACE_ART[p.id] ?? PROP_ART.inn, status: built ? 'built' : site ? 'site' : 'lot' };
  });
  const fields: Pt[][] = [];
  let pier: Pt[] | null = null;
  const dots: MapScene['dots'] = [];
  for (const prop of world.props) {
    if (prop.kind === 'farm' && prop.tiles.length > 0) {
      fields.push(footprint(boxOf(prop.tiles), 0.06));
      continue;
    }
    if (prop.kind === 'pier' && prop.at) {
      pier = pierCorners(prop.at);
      continue;
    }
    const art = PROP_ART[prop.kind];
    if (!art || prop.tiles.length === 0) continue;
    const inset = prop.kind === 'inn' || prop.kind === 'bus' ? 0.12 : 0.22;
    blocks.push({ id: `prop:${prop.kind}:${prop.tiles[0].x},${prop.tiles[0].y}`, corners: footprint(boxOf(prop.tiles), inset), h: art.h, art, status: 'prop' });
  }
  const hills: MapScene['hills'] = [];
  const jetties: Pt[][] = [];
  for (const s of world.scenery ?? []) {
    if (s.kind === 'hill' && s.at && s.r) hills.push({ x: s.at.x + 0.5, y: s.at.y + 0.5, r: s.r });
    else if (s.kind === 'barn' && s.tiles.length > 0) blocks.push({ id: `barn:${s.tiles[0].x},${s.tiles[0].y}`, corners: footprint(boxOf(s.tiles), 0.1), h: PROP_ART.barn.h, art: PROP_ART.barn, status: 'prop' });
    else if (s.kind === 'well') for (const t of s.tiles) dots.push({ x: t.x + 0.5, y: t.y + 0.5, r: 0.3, color: C.stone, rim: C.waterDeep });
    else if (s.kind === 'haybale') for (const t of s.tiles) dots.push({ x: t.x + 0.5, y: t.y + 0.5, r: 0.3, color: C.mustard });
    else if (s.kind === 'bush') for (const t of s.tiles) dots.push({ x: t.x + 0.5, y: t.y + 0.5, r: 0.32, color: C.leafDeep });
    else if (s.kind === 'rock') for (const t of s.tiles) dots.push({ x: t.x + 0.5, y: t.y + 0.5, r: 0.28, color: C.rock });
    // the coast (2026-11-24)
    else if (s.kind === 'hut' && s.tiles.length > 0) blocks.push({ id: `hut:${s.tiles[0].x},${s.tiles[0].y}`, corners: footprint(boxOf(s.tiles), 0.18), h: PROP_ART.hut.h, art: PROP_ART.hut, status: 'prop' });
    else if (s.kind === 'lighthouse' && s.tiles.length > 0) {
      const b = boxOf(s.tiles);
      dots.push({ x: b.x + b.w / 2, y: b.y + b.d / 2, r: 0.75, color: C.white, rim: C.coral });
    } else if (s.kind === 'boulder' && s.tiles.length > 0) {
      const b = boxOf(s.tiles);
      dots.push({ x: b.x + b.w / 2, y: b.y + b.d / 2, r: 0.72, color: C.rock });
    } else if (s.kind === 'umbrella') for (const t of s.tiles) dots.push({ x: t.x + 0.5, y: t.y + 0.5, r: 0.34, color: C.coral, rim: C.white });
    else if (s.kind === 'boat' && s.at) dots.push({ x: s.at.x, y: s.at.y, r: 0.36, color: C.woodDark });
    else if (s.kind === 'jetty' && s.at) {
      const len = s.len ?? 6;
      const a = s.at;
      jetties.push(s.dir === 'y' ? [{ x: a.x - 0.45, y: a.y }, { x: a.x + 0.45, y: a.y }, { x: a.x + 0.45, y: a.y + len }, { x: a.x - 0.45, y: a.y + len }] : [{ x: a.x, y: a.y - 0.45 }, { x: a.x + len, y: a.y - 0.45 }, { x: a.x + len, y: a.y + 0.45 }, { x: a.x, y: a.y + 0.45 }]);
    }
  }
  if (state.decorations.has('fountain')) for (const s of world.decorations.fountain ?? []) dots.push({ x: s.x + 0.5, y: s.y + 0.5, r: 0.55, color: C.waterShallow, rim: C.stone });
  return { world, water, waterDeep, sand, coast: world.coast ? rangeCells(world.size) : null, jetties, plaza, paths, fields, trees, blocks, dots, hills, pier };
}

/**
 * The mountains behind the island's far sides: their ground as cells of colour by height (green foothills, dark forest,
 * grey rock, the sea left out), and their peaks (the highest point of each patch), drawn standing as little snow-capped
 * mountains on the full map.
 */
function rangeCells(size: number): NonNullable<MapScene['coast']> {
  const step = 1;
  const cells: { x: number; y: number; c: string }[] = [];
  const heights = new Map<string, number>();
  for (let y = -RANGE_DEPTH; y < size + 8; y += step) {
    for (let x = -RANGE_DEPTH; x < size + 8; x += step) {
      if (x >= 0 && y >= 0) continue;
      const h = mountainHeight(x + step / 2, y + step / 2, size);
      heights.set(`${x},${y}`, h);
      if (h < 0) continue;
      const c = h < 0.3 ? C.sand : h < 3.5 ? mixHex(C.grassDeep, C.pine, h / 3.5) : h < 8 ? mixHex(C.pine, C.pineDeep, (h - 3.5) / 4.5) : mixHex(C.pineDeep, C.stoneDark, Math.min(1, (h - 8) / 3));
      cells.push({ x, y, c });
    }
  }
  // a peak: the highest point within 4 tiles, high enough to be a mountain
  const peaks: { x: number; y: number; h: number }[] = [];
  for (const [k, h] of heights) {
    if (h < 7.5) continue;
    const [x, y] = k.split(',').map(Number);
    let top = true;
    for (let dy = -4; dy <= 4 && top; dy++) for (let dx = -4; dx <= 4; dx++) if ((dx || dy) && (heights.get(`${x + dx},${y + dy}`) ?? -1) > h) top = false;
    if (top) peaks.push({ x: x + 0.5, y: y + 0.5, h });
  }
  return { cells, step, peaks };
}

export interface DrawOptions {
  /** The minimap: no sky, nothing far outside its rim is drawn. */
  mini?: { rim: number };
  /** Picked on the map: drawn with a ring. */
  selected?: string | null;
}

/** The island and everything on it, in the box (CSS px) of a canvas `dpr` times as big. */
export function drawMap(ctx: CanvasRenderingContext2D, scene: MapScene, v: MapView, box: Box, dpr: number, pal: TownPalette, opts: DrawOptions = {}): void {
  const world = scene.world;
  const ink = pal.ink;
  const size = world.size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, box.w, box.h);
  if (!opts.mini) {
    const g = ctx.createLinearGradient(0, 0, 0, box.h);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, box.w, box.h);
  } else {
    ctx.fillStyle = pal.skyBottom;
    ctx.fillRect(0, 0, box.w, box.h);
  }

  // a coast: the sea round the island, the mountains behind it (in grid units through the view's matrix)
  if (scene.coast) {
    const mm = viewMatrix(v, box);
    ctx.setTransform(mm[0] * dpr, mm[1] * dpr, mm[2] * dpr, mm[3] * dpr, mm[4] * dpr, mm[5] * dpr);
    const reach = RANGE_DEPTH + 14;
    ctx.fillStyle = ink(C.waterDeep);
    ctx.fillRect(-reach, -reach, size + reach * 2, size + reach * 2);
    const k = scene.coast.step + 0.05;
    for (const c of scene.coast.cells) {
      ctx.fillStyle = ink(c.c);
      ctx.fillRect(c.x - 0.03, c.y - 0.03, k, k);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the peaks standing up, far ones first (the full map only: straight down they would be flat)
    if (v.tilt < 1) {
      const peaks = scene.coast.peaks.map((p) => ({ p, at: toBox(v, box, p.x, p.y) })).sort((x, y) => x.at.y - y.at.y);
      for (const { p, at } of peaks) {
        const tall = liftPx(v, p.h * 0.3);
        const half = (1.7 + p.h * 0.16) * v.scale;
        ctx.beginPath();
        ctx.moveTo(at.x - half, at.y);
        ctx.lineTo(at.x, at.y - tall);
        ctx.lineTo(at.x + half, at.y);
        ctx.closePath();
        ctx.fillStyle = ink(C.rock);
        ctx.fill();
        // the shaded side
        ctx.beginPath();
        ctx.moveTo(at.x, at.y - tall);
        ctx.lineTo(at.x + half, at.y);
        ctx.lineTo(at.x + half * 0.15, at.y);
        ctx.closePath();
        ctx.fillStyle = ink(C.stoneDark);
        ctx.fill();
        if (p.h > 10) {
          const k = 0.38;
          ctx.beginPath();
          ctx.moveTo(at.x, at.y - tall);
          ctx.lineTo(at.x + half * k, at.y - tall * (1 - k));
          ctx.lineTo(at.x + half * k * 0.3, at.y - tall * (1 - k * 0.8));
          ctx.lineTo(at.x - half * k * 0.2, at.y - tall * (1 - k * 0.95));
          ctx.lineTo(at.x - half * k, at.y - tall * (1 - k));
          ctx.closePath();
          ctx.fillStyle = ink(C.white);
          ctx.fill();
        }
      }
    }
  }

  // the island: a cliff of earth under its near edges, the grass on top
  const corners = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
  const drop = v.tilt < 1 && !scene.coast ? 0.9 : 0;
  if (drop > 0) {
    ctx.beginPath();
    const all = [...corners.map((c) => toBox(v, box, c.x, c.y)), ...corners.map((c) => toBox(v, box, c.x, c.y, -drop))];
    // the hull of the top and the dropped square is the island with its cliff
    hullPath(ctx, all);
    ctx.fillStyle = ink(C.earth);
    ctx.fill();
  }
  ctx.beginPath();
  corners.forEach((c, i) => {
    const p = toBox(v, box, c.x, c.y);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = ink(C.grass);
  ctx.fill();

  // the ground, drawn in grid units through the view's matrix
  const m = viewMatrix(v, box);
  ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, m[5] * dpr);
  for (const h of scene.hills) {
    const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
    g.addColorStop(0, ink(C.grassLight));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (scene.sand) {
    ctx.fillStyle = ink(C.sand);
    ctx.fill(scene.sand);
  }
  if (scene.water) {
    ctx.fillStyle = ink(C.waterShallow);
    ctx.fill(scene.water);
    if (scene.waterDeep) {
      ctx.fillStyle = ink(C.waterDeep);
      ctx.fill(scene.waterDeep);
    }
  }
  if (scene.paths) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink(C.path);
    ctx.lineWidth = 0.84;
    ctx.stroke(scene.paths);
  }
  if (scene.plaza) {
    const pz = world.plaza;
    ctx.fillStyle = ink(C.plazaA);
    ctx.fill(scene.plaza);
    ctx.beginPath();
    ctx.arc(pz.x, pz.y, pz.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pz.x, pz.y, pz.r * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = ink(C.plazaB);
    ctx.lineWidth = 0.22;
    ctx.stroke();
  }
  for (const f of scene.fields) {
    polyPath(ctx, f);
    ctx.fillStyle = ink(C.soil);
    ctx.fill();
    // rows of crops along the field
    ctx.strokeStyle = ink(C.crop);
    ctx.lineWidth = 0.22;
    ctx.lineCap = 'round';
    const y0 = f[0].y;
    const y1 = f[2].y;
    ctx.beginPath();
    for (let y = y0 + 0.35; y < y1 - 0.15; y += 0.5) {
      ctx.moveTo(f[0].x + 0.25, y);
      ctx.lineTo(f[1].x - 0.25, y);
    }
    ctx.stroke();
  }
  if (scene.pier) {
    polyPath(ctx, scene.pier);
    ctx.fillStyle = ink(C.woodLight);
    ctx.fill();
  }
  for (const j of scene.jetties) {
    polyPath(ctx, j);
    ctx.fillStyle = ink(C.woodLight);
    ctx.fill();
  }
  // the lots: a site is a plot of earth with a dashed rim, any other lot a faint dotted outline
  const unit = 1 / v.scale;
  for (const b of scene.blocks) {
    if (b.status !== 'site' && b.status !== 'lot') continue;
    polyPath(ctx, b.corners);
    if (b.status === 'site') {
      ctx.fillStyle = ink(C.sand);
      ctx.fill();
    }
    ctx.setLineDash(b.status === 'site' ? [5 * unit, 4 * unit] : [2 * unit, 4 * unit]);
    ctx.lineWidth = (b.status === 'site' ? 1.6 : 1.2) * unit;
    ctx.strokeStyle = b.status === 'site' ? ink(C.woodDark) : ink(C.leafDeep);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const d of scene.dots) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = ink(d.color);
    ctx.fill();
    if (d.rim) {
      ctx.lineWidth = 0.12;
      ctx.strokeStyle = ink(d.rim);
      ctx.stroke();
    }
  }

  // what stands up, from the far side to the near one, in box pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rim = opts.mini?.rim;
  const inView = (x: number, y: number, r: number) => {
    if (rim === undefined) {
      const p = toBox(v, box, x, y);
      const k = r * v.scale + 8;
      return p.x > -k && p.y > -k - liftPx(v, 2) && p.x < box.w + k && p.y < box.h + k;
    }
    return Math.hypot(x - v.cx, y - v.cy) * v.scale < rim + r * v.scale + 4;
  };
  type Item = { depth: number; draw: () => void };
  const items: Item[] = [];
  const s = v.scale;
  for (const t of scene.trees) {
    if (!inView(t.x, t.y, 1)) continue;
    const foot = toBox(v, box, t.x, t.y);
    items.push({ depth: foot.y, draw: () => drawTree(ctx, v, t, foot, s, pal) });
  }
  for (const b of scene.blocks) {
    if (b.status === 'site' || b.status === 'lot') continue;
    const mid = middle(b.corners);
    if (!inView(mid.x, mid.y, 3)) continue;
    const depth = toBox(v, box, mid.x, mid.y).y;
    items.push({ depth, draw: () => drawBlock(ctx, v, box, b, pal, opts.selected === b.id) });
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();

  // the picked lot (it has no block to ring)
  const sel = opts.selected ? scene.blocks.find((b) => b.id === opts.selected && (b.status === 'site' || b.status === 'lot')) : undefined;
  if (sel) ring(ctx, sel.corners.map((c) => toBox(v, box, c.x, c.y)), pal);
}

function middle(ps: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of ps) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ps.length, y: y / ps.length };
}

function polyPath(ctx: CanvasRenderingContext2D, ps: readonly Pt[]): void {
  ctx.beginPath();
  ps.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

function hullPath(ctx: CanvasRenderingContext2D, ps: readonly Pt[]): void {
  const pts = [...ps].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
    upper.push(pts[i]);
  }
  polyPath(ctx, [...lower.slice(0, -1), ...upper.slice(0, -1)]);
}

/** A ring round the picked thing: white with a dark edge, so it reads on the day and the night picture. */
function ring(ctx: CanvasRenderingContext2D, ps: readonly Pt[], pal: TownPalette): void {
  hullPath(ctx, ps);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = pal.night ? 'rgba(10,12,32,0.55)' : 'rgba(40,40,80,0.35)';
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = pal.night ? '#ffe9a8' : '#ffffff';
  ctx.stroke();
}

function drawTree(ctx: CanvasRenderingContext2D, v: MapView, t: Tree, foot: Pt, s: number, pal: TownPalette): void {
  const ink = pal.ink;
  const r = (t.kind === 'pine' ? 0.36 : 0.44) * s;
  const lift = liftPx(v, t.kind === 'pine' ? 0.62 : 0.55);
  if (lift > 0) {
    // its shadow on the grass
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y, r * 0.95, r * 0.95 * v.tilt, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.shadow;
    ctx.fill();
    ctx.fillStyle = ink(C.trunk);
    ctx.fillRect(foot.x - Math.max(1, s * 0.06), foot.y - lift, Math.max(2, s * 0.12), lift);
  }
  const base = t.kind === 'pine' ? C.pine : t.kind === 'blossom' ? C.blossom : t.kind === 'palm' ? C.palmLeaf : C.leaf;
  const light = t.kind === 'pine' ? C.leafDeep : t.kind === 'blossom' ? C.pink : C.grassLight;
  ctx.beginPath();
  ctx.arc(foot.x, foot.y - lift, r, 0, Math.PI * 2);
  ctx.fillStyle = ink(base);
  ctx.fill();
  if (r >= 3) {
    ctx.beginPath();
    ctx.arc(foot.x - r * 0.28, foot.y - lift - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = ink(light);
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawBlock(ctx: CanvasRenderingContext2D, v: MapView, box: Box, b: Block, pal: TownPalette, picked: boolean): void {
  const ink = pal.ink;
  const ground = b.corners.map((c) => toBox(v, box, c.x, c.y));
  const top = b.corners.map((c) => toBox(v, box, c.x, c.y, b.h));
  const lifted = top[0].y !== ground[0].y;
  if (lifted) {
    // its shadow, then the walls that face the viewer (a lower edge on the screen than the middle)
    ctx.beginPath();
    ground.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + 3, p.y + 2) : ctx.lineTo(p.x + 3, p.y + 2)));
    ctx.closePath();
    ctx.fillStyle = pal.shadow;
    ctx.fill();
    const mid = middle(ground);
    for (let i = 0; i < ground.length; i++) {
      const j = (i + 1) % ground.length;
      const a = ground[i];
      const c = ground[j];
      // the outward side: the edge's middle lies below the footprint's middle on the screen
      if ((a.y + c.y) / 2 <= mid.y) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(top[j].x, top[j].y);
      ctx.lineTo(top[i].x, top[i].y);
      ctx.closePath();
      // the face turned to the light (left on the screen) a little brighter
      const k = (c.x - a.x) * (c.y - a.y) > 0 ? -0.12 : -0.02;
      ctx.fillStyle = ink(b.art.wall, k);
      ctx.fill();
    }
  }
  // the roof
  const lw = Math.max(1, v.scale * 0.05);
  if (b.art.roofKind === 'round') {
    const c = middle(top);
    const rx = Math.max(...top.map((p) => Math.abs(p.x - c.x)));
    const ry = Math.max(...top.map((p) => Math.abs(p.y - c.y)));
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx * 0.95, ry * 0.95, 0, 0, Math.PI * 2);
    ctx.fillStyle = ink(b.art.roof);
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = ink(b.art.roof, -0.25);
    ctx.stroke();
  } else {
    polyPath(ctx, top);
    ctx.fillStyle = b.art.roofKind === 'open' ? ink(b.art.wall) : ink(b.art.roof);
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = ink(b.art.roofKind === 'open' ? b.art.wall : b.art.roof, -0.28);
    ctx.stroke();
    if (b.art.roofKind === 'gable') {
      // the ridge along the long side
      const long = Math.hypot(top[1].x - top[0].x, top[1].y - top[0].y) >= Math.hypot(top[3].x - top[0].x, top[3].y - top[0].y);
      const [p, q] = long ? [mid2(top[0], top[3]), mid2(top[1], top[2])] : [mid2(top[0], top[1]), mid2(top[3], top[2])];
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.lineWidth = Math.max(1, v.scale * 0.08);
      ctx.strokeStyle = ink(b.art.roof, 0.35);
      ctx.stroke();
    } else if (b.art.roofKind === 'flat' && v.scale >= 10) {
      // a ledge round a flat roof
      const c = middle(top);
      polyPath(
        ctx,
        top.map((p) => ({ x: c.x + (p.x - c.x) * 0.72, y: c.y + (p.y - c.y) * 0.72 })),
      );
      ctx.fillStyle = ink(b.art.roof, 0.18);
      ctx.fill();
    }
  }
  if (picked) ring(ctx, [...ground, ...top], pal);
}

const mid2 = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

