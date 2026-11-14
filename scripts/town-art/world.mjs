// The WORLD part of `npm run art:town`: plans what to render from the town's layout (src/data/townWorld.ts), asks
// the page (page/world.js with its recipes) for each picture, packs them into WebP atlases and writes the typed
// manifest src/features/town/art/world.data.ts. Contact sheets (and a whole-town preview with the people) go next
// to the characters' sheets.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TOWN_WORLD, WORLD_PLACES, worldFountain, worldTrees } from '../../src/data/townWorld.ts';
import { treeSpriteKey, treeVariant, TREE_VARIANTS } from '../../src/features/town/art/worldPick.ts';
import { packShelves } from './pack.mjs';

const SHEET_BG = '#9ad27a';

/** The world's look on top of the characters' LOOK (render.mjs): shadows and glows. */
export const WORLD_LOOK = {
  // the sun = the key light's direction (render.js setLights: along(-0.7, 1, 1.3))
  sunDir: [-0.7, 1, 1.3],
  shadowColor: '#2c3a52',
  shadowAlpha: 0.3,
  contactAlpha: 0.22,
  shadowBlur: 1.2,
  glowBlur: 3,
  glowHalo: 0.8,
};

/** Shadows are soft: half the resolution of the sprites costs nothing visible. */
const SHADOW_RES = 1;
/** The ground picture's resolution (atlas px per world px) and the texture density of its painted top. */
const GROUND_RES = Number(process.env.TOWN_GROUND_RES ?? 2);
const GROUND_TEX_PX = 128;
const GROUND_QUALITY = 0.82;
/** Island around the 21 × 21 grid (tiles), like engine/draw/ground.ts. */
const ISLAND = { margin: 0.9, radius: 3.6, cliff: 0.9 };
/** World sprites are sharper than the people (RES 2): they are big on a phone and there is room in the budget. */
const WORLD_RES = Number(process.env.TOWN_WORLD_RES ?? 3);

const CAT_DIRS = ['S', 'SE', 'E', 'NE', 'N'];
const CAT_YAW = { SW: 0, S: 45, SE: 90, E: 135, NE: 180, N: 225, NW: 270, W: 315 };
const CAT_ANIMS = { walk: { frames: 6, duration: 0.5, loop: true }, sit: { frames: 4, duration: 2.4, loop: true } };

/** A place's recipe arguments: the door face is built along X (front) and turned for face 'x'. */
export function placeArgs(p) {
  return { id: p.id, front: p.face === 'y' ? p.w : p.d, deep: p.face === 'y' ? p.d : p.w, face: p.face };
}

const lotSizes = () => [...new Set(WORLD_PLACES.map((p) => `${p.w}x${p.d}`))].map((s) => s.split('x').map(Number));

/** Everything to render, by atlas. */
function plan() {
  const places = WORLD_PLACES.map((p) => ({ key: `place/${p.id}`, recipe: 'place', args: placeArgs(p) }));
  const lots = lotSizes().flatMap(([w, d]) => [
    { key: `lot/site/${w}x${d}`, recipe: 'lotSite', args: { w, d } },
    { key: `lot/grass/${w}x${d}`, recipe: 'lotGrass', args: { w, d }, layers: ['body'] },
  ]);
  const nature = [
    ...Array.from({ length: TREE_VARIANTS.round }, (_, v) => ({ key: `tree/round/${v}`, recipe: 'treeRound', args: { v } })),
    ...Array.from({ length: TREE_VARIANTS.pine }, (_, v) => ({ key: `tree/pine/${v}`, recipe: 'treePine', args: { v } })),
    { key: 'tree/poplar/0', recipe: 'treePoplar', args: { v: 0 } },
    { key: 'tree/poplar/1', recipe: 'treePoplar', args: { v: 1 } },
    { key: 'bush/0', recipe: 'bush', args: { v: 0 } },
    { key: 'bush/1', recipe: 'bush', args: { v: 1 } },
    { key: 'rock/0', recipe: 'rock', args: { v: 0 } },
    { key: 'rock/1', recipe: 'rock', args: { v: 1 } },
  ];
  const decor = [
    { key: 'decor/lamp/0', recipe: 'lamp', args: { v: 0 } },
    { key: 'decor/lamp/1', recipe: 'lamp', args: { v: 1 } },
    { key: 'decor/flowers', recipe: 'flowers' },
    ...['s', 'e', 'w'].map((dir) => ({ key: `decor/bench/${dir}`, recipe: 'bench', args: { dir } })),
    { key: 'decor/blossom', recipe: 'blossom' },
    { key: 'decor/lightPole', recipe: 'lightPole' },
    { key: 'decor/lily/0', recipe: 'lily', args: { v: 0 }, layers: ['body'] },
    { key: 'decor/lily/1', recipe: 'lily', args: { v: 1 }, layers: ['body'] },
    { key: 'decor/stall', recipe: 'stall' },
    { key: 'decor/fountain/0', recipe: 'fountain', args: { v: 0 } },
    { key: 'decor/fountain/1', recipe: 'fountain', args: { v: 1 } },
    { key: 'decor/balloons', recipe: 'balloons' },
    ...[0, 1, 2].map((v) => ({ key: `decor/flag/${v}`, recipe: 'flag', args: { v } })),
    { key: 'prop/terrace', recipe: 'terrace' },
    { key: 'prop/bus', recipe: 'bus' },
  ];
  const yaw = Object.fromEntries(Object.entries(CAT_YAW).map(([k, v]) => [k, (v * Math.PI) / 180]));
  const cat = [{ key: 'cat', recipe: 'cat', args: { dirs: CAT_DIRS, walkFrames: CAT_ANIMS.walk.frames, sitFrames: CAT_ANIMS.sit.frames, yaw }, layers: ['body'] }];
  return { places, lots, nature, decor, cat };
}

/**
 * The string lights: the pavilion's roof (when the square is built) to each pole, and pole to pole. Each string is
 * a sprite whose origin is the ground point under its middle.
 */
function stringPlan(squareTop, poleTop) {
  const sq = WORLD_PLACES.find((p) => p.id === 'square');
  const poles = TOWN_WORLD.decorations.lights;
  const ends = {
    square: [sq.x + sq.w / 2 + squareTop[0], squareTop[1], sq.y + sq.d / 2 + squareTop[2]],
    ...Object.fromEntries(poles.map((s, i) => [`pole${i}`, [s.x + 0.5, poleTop[1], s.y + 0.5]])),
  };
  const pairs = [...poles.map((_, i) => ['square', `pole${i}`]), ...poles.slice(1).map((_, i) => [`pole${i}`, `pole${i + 1}`])];
  return pairs.map(([from, to], i) => {
    const a = ends[from];
    const b = ends[to];
    const mid = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2];
    return {
      from,
      to,
      at: mid,
      item: { key: `decor/lights/${i}`, recipe: 'lights', args: { a: [a[0] - mid[0], a[1], a[2] - mid[1]], b: [b[0] - mid[0], b[1], b[2] - mid[1]], seed: i }, layers: ['body', 'lit'] },
    };
  });
}

/** Pack rects into as few atlases (≤ 2048²) as needed: split in halves until each fits. */
function packMany(rects) {
  try {
    return [{ rects, ...packShelves(rects) }];
  } catch {
    if (rects.length < 2) throw new Error(`frame too big: ${rects[0]?.key}`);
    const half = Math.ceil(rects.length / 2);
    return [...packMany(rects.slice(0, half)), ...packMany(rects.slice(half))];
  }
}

const round1 = (n) => Math.round(n * 10) / 10;

async function renderItems(browser, ctx, items, res) {
  const look = { ...ctx.LOOK, ...WORLD_LOOK };
  const out = [];
  // one page call per item keeps every call short
  for (const it of items) {
    out.push(...(await browser.evaluate(`TA.world.renderItems(${ctx.js({ res, ss: ctx.SS, shadowRes: SHADOW_RES, look, items: [it] })})`)));
  }
  return out;
}

/** Frame-store key of a rendered layer. */
const frameKey = (f) => (f.layer === 'body' ? f.key : `${f.key}:${f.layer}`);

export async function renderWorld(browser, ctx) {
  const t0 = Date.now();
  const res = WORLD_RES;
  const outDir = join(ctx.OUT_DIR, 'world');
  await mkdir(outDir, { recursive: true });
  const p = plan();
  const frames = [];
  for (const group of ['places', 'lots', 'nature', 'decor', 'cat']) {
    const got = await renderItems(browser, ctx, p[group], res);
    for (const f of got) frames.push({ ...f, group });
    console.log(`world: ${group} ${got.length} frames`);
  }
  const squareTop = frames.find((f) => f.key === 'place/square' && f.layer === 'body').info.top.p;
  const poleTop = frames.find((f) => f.key === 'decor/lightPole' && f.layer === 'body').info.top.p;
  const strings = stringPlan(squareTop, poleTop);
  for (const f of await renderItems(browser, ctx, strings.map((s) => s.item), res)) frames.push({ ...f, group: 'decor' });

  // the ground
  const fountain = worldFountain(TOWN_WORLD);
  const layout = {
    size: TOWN_WORLD.size,
    rows: TOWN_WORLD.rows,
    places: WORLD_PLACES.map((q) => ({ x: q.x, y: q.y, w: q.w, d: q.d, face: q.face, door: q.door })),
    plaza: TOWN_WORLD.plaza,
    fountain,
    trees: worldTrees(TOWN_WORLD).map((t) => ({ ...t, v: treeVariant(t.kind, t.x, t.y) })),
    texPx: GROUND_TEX_PX,
    ...ISLAND,
  };
  const ground = await browser.evaluate(`TA.world.renderGround(${ctx.js({ res: GROUND_RES, ss: 2, look: { ...ctx.LOOK, ...WORLD_LOOK }, layout })})`, 600000);
  const gb64 = await browser.evaluateString(`TA.compose(${ctx.js({ width: ground.w, height: ground.h, type: 'image/webp', quality: GROUND_QUALITY, items: [{ key: 'ground', x: 0, y: 0 }] })})`);
  const groundBytes = await ctx.writeBase64(join(outDir, 'ground.webp'), gb64);
  console.log(`world: ground ${ground.w}×${ground.h} ${(groundBytes / 1024).toFixed(0)} KB`);

  // atlases: bodies of places; bodies of everything else; the cat; lit layers; shadows (their own resolution)
  const bins = [
    { name: 'places', pick: (f) => f.layer === 'body' && f.group === 'places', quality: ctx.WEBP_QUALITY },
    { name: 'props', pick: (f) => f.layer === 'body' && f.group !== 'places' && f.group !== 'cat', quality: ctx.WEBP_QUALITY },
    { name: 'cat', pick: (f) => f.layer === 'body' && f.group === 'cat', quality: ctx.WEBP_QUALITY },
    { name: 'lit', pick: (f) => f.layer === 'lit', quality: ctx.WEBP_QUALITY },
    { name: 'shadows', pick: (f) => f.layer === 'shadow', quality: 0.7 },
  ];
  const atlases = [];
  const where = new Map();
  let total = groundBytes;
  for (const bin of bins) {
    const list = frames.filter(bin.pick);
    const packs = packMany(list.map((f) => ({ key: frameKey(f), w: f.w, h: f.h })));
    for (const [k, pack] of packs.entries()) {
      const name = packs.length > 1 ? `${bin.name}${k + 1}` : bin.name;
      const items = pack.rects.map((r) => ({ key: r.key, ...pack.at.get(r.key) }));
      const b64 = await browser.evaluateString(`TA.compose(${ctx.js({ width: pack.width, height: pack.height, type: 'image/webp', quality: bin.quality, items })})`);
      const bytes = await ctx.writeBase64(join(outDir, `${name}.webp`), b64);
      total += bytes;
      const index = atlases.length;
      const fres = list[0]?.res ?? res;
      atlases.push({ name, w: pack.width, h: pack.height, res: fres, bytes });
      for (const r of pack.rects) where.set(r.key, { atlas: index, ...pack.at.get(r.key) });
      console.log(`world: atlas ${name} ${pack.width}×${pack.height} ${(bytes / 1024).toFixed(0)} KB (${pack.rects.length} frames)`);
    }
  }
  console.log(`world total ${(total / 1024 / 1024).toFixed(2)} MB in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await writeManifest(ctx, { frames, where, atlases, ground, strings });
  await sheets(browser, ctx, { frames, ground, strings });
  return total;
}

// ---- the manifest ---------------------------------------------------------------------------------------------------

async function writeManifest(ctx, { frames, where, atlases, ground, strings }) {
  const rect = (f) => {
    const w = where.get(frameKey(f));
    return [w.atlas, w.x, w.y, f.w, f.h, round1(f.ax), round1(f.ay)];
  };
  const layer = (name) => Object.fromEntries(frames.filter((f) => f.layer === name).map((f) => [f.key, rect(f)]));
  const bodies = layer('body');
  const lit = layer('lit');
  const shadows = layer('shadow');
  const keys = Object.keys(bodies).sort();
  const sq = frames.find((f) => f.key === 'place/square' && f.layer === 'body').info.top;
  const pole = frames.find((f) => f.key === 'decor/lightPole' && f.layer === 'body').info.top;
  const lines = [
    '// GENERATED by scripts/town-art/render.mjs (`npm run art:town`). Do not edit by hand.',
    '// The world of "Thị trấn" (Kenney city kits, CC0, LICENSE-kenney.txt, plus shapes in the same style) as',
    '// sprites; the loader is world.ts. A rect is [atlas, x, y, w, h, anchorX, anchorY] in atlas px; the anchor is the',
    '// ground point the sprite stands on (world.ts says which point that is for each kind of thing).',
    '',
    ...atlases.map((a, i) => `import atlas${i}Url from './world/${a.name}.webp';`),
    "import groundUrl from './world/ground.webp';",
    '',
    `export type WorldSpriteKey =\n${keys.map((k) => `  | ${JSON.stringify(k)}`).join('\n')};`,
    '',
    'export const WORLD_ART: WorldArtData = {',
    `  /** Atlas px per world px of the sprites (each atlas also says its own: the shadows are lower). */`,
    `  res: ${WORLD_RES},`,
    `  atlases: [\n${atlases.map((a, i) => `    { url: atlas${i}Url, w: ${a.w}, h: ${a.h}, res: ${a.res} },`).join('\n')}\n  ],`,
    `  /** The things themselves. */`,
    `  sprites: {\n${keys.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(bodies[k])},`).join('\n')}\n  },`,
    `  /** What gives off light (windows, lamps, bulbs) with a soft halo: drawn over the sprite at night. */`,
    `  lit: {\n${Object.keys(lit).sort().map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(lit[k])},`).join('\n')}\n  },`,
    `  /** Shadows on the ground, drawn on the ground before anything that stands. */`,
    `  shadows: {\n${Object.keys(shadows).sort().map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(shadows[k])},`).join('\n')}\n  },`,
    `  /** The ground: one picture; its anchor is tile (0, 0) (the far corner) on the ground. */`,
    `  ground: { url: groundUrl, w: ${ground.w}, h: ${ground.h}, ax: ${round1(ground.ax)}, ay: ${round1(ground.ay)}, res: ${GROUND_RES} },`,
    `  /** World px from the anchor: the top of the square's roof and of a light pole (where string lights are tied). */`,
    `  ties: { square: [${round1(sq.x)}, ${round1(sq.y)}], pole: [${round1(pole.x)}, ${round1(pole.y)}] },`,
    `  /** String lights: from / to (square = the pavilion, poleN = spot N of the decoration "lights"), drawn at tile point \`at\`. */`,
    `  strings: [\n${strings.map((s, i) => `    { from: ${JSON.stringify(s.from)}, to: ${JSON.stringify(s.to)}, at: [${s.at.map(round1).join(', ')}], sprite: "decor/lights/${i}" },`).join('\n')}\n  ],`,
    `  /** The cat: sprites "cat/<anim>/<dir>/<frame>"; the other three directions are mirrored (like the people). */`,
    `  cat: { anims: ${JSON.stringify(Object.fromEntries(Object.entries(CAT_ANIMS).map(([k, v]) => [k, { ...v, dirs: CAT_DIRS }])))} },`,
    '};',
    '',
    '/** [atlas index, x, y, w, h, anchor x, anchor y], atlas pixels. */',
    'export type WorldRect = readonly [number, number, number, number, number, number, number];',
    '',
    'export interface WorldArtData {',
    '  res: number;',
    '  atlases: readonly { url: string; w: number; h: number; res: number }[];',
    '  sprites: Readonly<Record<WorldSpriteKey, WorldRect>>;',
    '  lit: Readonly<Partial<Record<WorldSpriteKey, WorldRect>>>;',
    '  shadows: Readonly<Partial<Record<WorldSpriteKey, WorldRect>>>;',
    '  ground: { url: string; w: number; h: number; ax: number; ay: number; res: number };',
    '  ties: { square: readonly [number, number]; pole: readonly [number, number] };',
    '  strings: readonly { from: string; to: string; at: readonly [number, number]; sprite: WorldSpriteKey }[];',
    '  cat: { anims: Readonly<Record<string, { frames: number; duration: number; loop: boolean; dirs: readonly string[] }>> };',
    '}',
    '',
  ];
  await writeFile(join(ctx.OUT_DIR, 'world.data.ts'), lines.join('\n'));
}

// ---- contact sheets and the town preview ------------------------------------------------------------------------------

/** Lay rendered frames out in a labelled grid. cells: [{ key, label }]; sizes: key → { w, h, ax, ay, res }. */
export async function gridSheet(browser, ctx, cells, file, { cols = 6, cellW = 260, cellH = 260, scale = 1, bg = SHEET_BG, sizes, shadows, lit, night = false }) {
  const items = [];
  const labels = [];
  cells.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const s = sizes.get(c.key);
    if (!s) return;
    const cx = col * cellW + cellW / 2;
    const by = row * cellH + cellH * 0.74;
    const sh = shadows?.get(c.key);
    if (sh) {
      const k = (scale * s.res) / sh.res;
      items.push({ key: `${c.key}:shadow`, x: cx - sh.ax * k, y: by - sh.ay * k, w: sh.w * k, h: sh.h * k });
    }
    items.push({ key: c.key, x: cx - s.ax * scale, y: by - s.ay * scale, w: s.w * scale, h: s.h * scale });
    labels.push({ text: c.label ?? c.key, x: col * cellW + 6, y: row * cellH + 16 });
  });
  if (night) {
    items.push({ rect: { x: 0, y: 0, w: cols * cellW, h: Math.ceil(cells.length / cols) * cellH, color: '#4a5598', op: 'multiply' } });
    cells.forEach((c, i) => {
      const l = lit?.get(c.key);
      if (!l) return;
      const cx = (i % cols) * cellW + cellW / 2;
      const by = Math.floor(i / cols) * cellH + cellH * 0.74;
      items.push({ key: `${c.key}:lit`, x: cx - l.ax * scale, y: by - l.ay * scale, w: l.w * scale, h: l.h * scale, op: 'screen' });
    });
  }
  const rows = Math.ceil(cells.length / cols);
  const b64 = await browser.evaluateString(`TA.compose(${ctx.js({ width: cols * cellW, height: rows * cellH, bg, items, labels })})`);
  await ctx.writeBase64(file, b64);
  console.log(`sheet: ${file}`);
}

/** The characters' frames (from characters.data.ts, read as text): [x, y, w, h, ax, ay] of idle facing SE. */
async function characterFrames(ctx) {
  const src = await readFile(join(ctx.OUT_DIR, 'characters.data.ts'), 'utf8');
  const out = {};
  for (const m of src.matchAll(/"(\w+)": \{ url: \w+, w: \d+, h: \d+, frames: \[([\d.,]+)\] \}/g)) {
    const f = m[2].split(',').map(Number);
    // idle: dirs S, SE, E, NE, N × 6 frames; SE frame 0 = frame 6
    out[m[1]] = f.slice(6 * 6, 6 * 6 + 6);
  }
  return out;
}

const toWorld = (tx, ty) => ({ x: (tx - ty) * 32, y: (tx + ty) * 16 });

/**
 * The whole town as the game will draw it: ground, shadows, things sorted by depth, the people at their spots, at
 * `scale` px per world px. built: the places built (the rest are lots, `sites` of them construction sites);
 * decor: every decoration bought; night: dusk tint plus the lit layers.
 */
async function townPreview(browser, ctx, { frames, ground, strings }, file, { scale = 1, built, sites = [], decor = true, night = false, crop = null, people = true }) {
  const size = new Map(frames.map((f) => [frameKey(f), f]));
  const g0 = { x: -ground.ax / ground.res, y: -ground.ay / ground.res };
  const view = crop ?? { x: g0.x, y: g0.y, w: ground.w / ground.res, h: ground.h / ground.res };
  const px = (wx) => (wx - view.x) * scale;
  const py = (wy) => (wy - view.y) * scale;
  const items = [{ key: 'ground', x: px(g0.x), y: py(g0.y), w: (ground.w / ground.res) * scale, h: (ground.h / ground.res) * scale }];
  const things = [];
  const shadowsList = [];
  const put = (key, at, depth, { lit = false } = {}) => {
    const f = size.get(key);
    if (!f) throw new Error(`no sprite ${key}`);
    const k = scale / f.res;
    things.push({ depth, item: { key, x: px(at.x) - f.ax * k, y: py(at.y) - f.ay * k, w: f.w * k, h: f.h * k } });
    const s = size.get(`${key}:shadow`);
    if (s) {
      const ks = scale / s.res;
      shadowsList.push({ key: `${key}:shadow`, x: px(at.x) - s.ax * ks, y: py(at.y) - s.ay * ks, w: s.w * ks, h: s.h * ks });
    }
    const l = size.get(`${key}:lit`);
    if (l && night && lit) {
      const kl = scale / l.res;
      things.push({ depth: depth + 0.0001, lit: true, item: { key: `${key}:lit`, x: px(at.x) - l.ax * kl, y: py(at.y) - l.ay * kl, w: l.w * kl, h: l.h * kl, op: 'screen' } });
    }
  };
  for (const pl of WORLD_PLACES) {
    const at = toWorld(pl.x + pl.w / 2, pl.y + pl.d / 2);
    const depth = pl.x + pl.w / 2 + pl.y + pl.d / 2;
    if (built.includes(pl.id)) put(`place/${pl.id}`, at, depth, { lit: true });
    else put(`lot/${sites.includes(pl.id) ? 'site' : 'grass'}/${pl.w}x${pl.d}`, at, depth, { lit: true });
  }
  for (const t of worldTrees(TOWN_WORLD)) put(treeSpriteKey(t.kind, t.x, t.y), toWorld(t.x + 0.5, t.y + 0.5), t.x + t.y + 1);
  const f = worldFountain(TOWN_WORLD);
  put(`decor/fountain/${decor ? 1 : 0}`, toWorld(f.x + 0.5, f.y + 0.5), f.x + f.y + 1);
  if (built.includes('cafe')) put('prop/terrace', toWorld(6.5, 9.5), 6.5 + 9.5);
  put('prop/bus', toWorld(10.5, 20), 10.5 + 20);
  if (decor) {
    const D = TOWN_WORLD.decorations;
    const spot = (s) => (s.solid ? toWorld(s.x + 0.5, s.y + 0.5) : toWorld(s.x, s.y));
    const dep = (s) => (s.solid ? s.x + s.y + 1 : s.x + s.y);
    D.lamps1.forEach((s) => put('decor/lamp/0', spot(s), dep(s), { lit: true }));
    D.lamps2.forEach((s) => put('decor/lamp/1', spot(s), dep(s), { lit: true }));
    D.flowers.forEach((s) => put('decor/flowers', spot(s), dep(s)));
    D.benches.forEach((s) => put(`decor/bench/${s.dir}`, spot(s), dep(s)));
    D.blossom.forEach((s) => put('decor/blossom', spot(s), dep(s)));
    D.lights.forEach((s) => put('decor/lightPole', spot(s), dep(s)));
    D.lilies.forEach((s, i) => put(`decor/lily/${i % 2}`, spot(s), dep(s) - 0.5));
    D.stall.forEach((s) => put('decor/stall', spot(s), dep(s), { lit: true }));
    D.balloons.forEach((s) => put('decor/balloons', spot(s), dep(s)));
    D.flags.forEach((s, i) => put(`decor/flag/${i % 3}`, spot(s), dep(s)));
    put('cat/sit/SE/0', toWorld(11.5, 12.5), 24);
    strings.forEach((s, i) => {
      if (s.from === 'square' && !built.includes('square')) return;
      put(`decor/lights/${i}`, toWorld(s.at[0], s.at[1]), 1000, { lit: true });
    });
  }
  if (people) {
    const cf = await characterFrames(ctx);
    const res = ctx.RES;
    const person = (id, tx, ty) => {
      const fr = cf[id];
      if (!fr) return;
      const at = toWorld(tx, ty);
      const k = scale / res;
      things.push({ depth: tx + ty, item: { key: `char/${id}`, x: px(at.x) - fr[4] * k, y: py(at.y) - fr[5] * k, w: fr[2] * k, h: fr[3] * k } });
      const sh = { w: 28, h: 14 };
      shadowsList.push({ key: 'char/shadow', x: px(at.x) - (sh.w / 2) * scale, y: py(at.y) - (sh.h / 2) * scale, w: sh.w * scale, h: sh.h * scale });
    };
    for (const id of Object.keys(cf)) {
      await browser.evaluate(`TA.loadFrame(${ctx.js({ key: `char/${id}`, url: `/art/characters/${id}.webp`, sx: cf[id][0], sy: cf[id][1], sw: cf[id][2], sh: cf[id][3] })})`);
    }
    await browser.evaluate(`TA.loadFrame(${ctx.js({ key: 'char/shadow', url: '/art/characters/shadow.webp' })})`);
    for (const pl of WORLD_PLACES) if (built.includes(pl.id)) person(pl.id, pl.spot.x + 0.5, pl.spot.y + 0.5);
    person('player', TOWN_WORLD.start.x + 0.5, TOWN_WORLD.start.y + 0.5);
  }
  things.sort((a, b) => a.depth - b.depth);
  items.push(...shadowsList, ...things.filter((t) => !t.lit).map((t) => t.item));
  if (night) {
    items.push({ rect: { x: 0, y: 0, w: view.w * scale, h: view.h * scale, color: '#5560a0', op: 'multiply' } });
    items.push(...things.filter((t) => t.lit).map((t) => t.item));
  }
  const b64 = await browser.evaluateString(`TA.compose(${ctx.js({ width: Math.round(view.w * scale), height: Math.round(view.h * scale), bg: night ? '#1d2346' : '#cfeaf7', items })})`);
  await ctx.writeBase64(file, b64);
  console.log(`town: ${file}`);
}

async function sheets(browser, ctx, data) {
  const { frames } = data;
  const dir = ctx.sheetDir;
  const bodies = new Map(frames.filter((f) => f.layer === 'body').map((f) => [f.key, f]));
  const shadows = new Map(frames.filter((f) => f.layer === 'shadow').map((f) => [f.key, f]));
  const lit = new Map(frames.filter((f) => f.layer === 'lit').map((f) => [f.key, f]));
  const cells = (pred) => frames.filter((f) => f.layer === 'body' && pred(f)).map((f) => ({ key: f.key, label: f.key }));
  const r = WORLD_RES;
  await gridSheet(browser, ctx, cells((f) => f.group === 'places'), join(dir, 'world-places.png'), { cols: 5, cellW: 190 * r, cellH: 180 * r, sizes: bodies, shadows });
  await gridSheet(browser, ctx, cells((f) => f.group === 'places'), join(dir, 'world-places-night.png'), { cols: 5, cellW: 190 * r, cellH: 180 * r, sizes: bodies, shadows, lit, night: true, bg: '#7fa36a' });
  await gridSheet(browser, ctx, cells((f) => f.group === 'lots' || f.group === 'nature'), join(dir, 'world-lots-nature.png'), { cols: 7, cellW: 140 * r, cellH: 140 * r, sizes: bodies, shadows });
  await gridSheet(browser, ctx, cells((f) => f.group === 'decor'), join(dir, 'world-decor.png'), { cols: 8, cellW: 110 * r, cellH: 130 * r, sizes: bodies, shadows });
  await gridSheet(browser, ctx, cells((f) => f.group === 'cat'), join(dir, 'world-cat.png'), { cols: 10, cellW: 40 * r, cellH: 40 * r, sizes: bodies });
  const all = WORLD_PLACES.map((q) => q.id);
  await townPreview(browser, ctx, data, join(dir, 'town-day.png'), { scale: 1, built: all });
  await townPreview(browser, ctx, data, join(dir, 'town-night.png'), { scale: 1, built: all, night: true });
  await townPreview(browser, ctx, data, join(dir, 'town-start.png'), { scale: 1, built: ['square', 'cafe'], sites: ['home', 'friend', 'shop'], decor: false });
  // the plaza at the zoom of a phone (≈ 2.8 px per world px), and at desktop (1.45)
  const c = toWorld(10.5, 10.5);
  await townPreview(browser, ctx, data, join(dir, 'town-phone.png'), { scale: 2.8, built: all, crop: { x: c.x - 70, y: c.y - 200, w: 140, h: 290 } });
  await townPreview(browser, ctx, data, join(dir, 'town-desk.png'), { scale: 1.45, built: all, crop: { x: c.x - 380, y: c.y - 240, w: 760, h: 430 } });
}

// ---- exploring -------------------------------------------------------------------------------------------------------

/** `--explore houses|kit|places|<key prefix,…>`: quick sheets to choose from; nothing is written to the app. */
export async function exploreWorld(browser, ctx, what) {
  const res = Number(process.env.EXPLORE_RES ?? 1);
  const look = { ...ctx.LOOK, ...WORLD_LOOK };
  let items = [];
  if (what === 'houses') {
    for (let i = 1; i <= 21; i++) {
      const n = `house_type${String(i).padStart(2, '0')}`;
      items.push({ key: n, recipe: 'kit', args: { name: `sub/${n}`, s: 1.5 }, layers: ['body'] });
    }
  } else if (what === 'kit') {
    const names = [
      'sub/tree_large', 'sub/tree_small', 'sub/fence_small', 'sub/fence_large', 'sub/fence_open', 'sub/path_tilesLong', 'sub/driveway_long',
      'road/light_curved', 'road/light_square', 'road/light_curvedDouble', 'road/light_squareDouble', 'road/construction_barrier',
      'road/construction_light', 'road/construction_pylon', 'road/tile_low', 'road/road_straight',
    ];
    items = names.map((n) => ({ key: n, recipe: 'kit', args: { name: n, s: n.startsWith('road/') ? 3 : 1.5 }, layers: ['body'] }));
  } else if (what === 'places') {
    items = WORLD_PLACES.map((q) => ({ key: q.id, recipe: 'place', args: placeArgs(q), layers: ['body', 'lit', 'shadow'] }));
  } else {
    const p = plan();
    const all = [...p.places, ...p.lots, ...p.nature, ...p.decor];
    items = what.split(',').flatMap((k) => all.filter((i) => i.key.startsWith(k)));
  }
  const out = await browser.evaluate(`TA.world.renderItems(${ctx.js({ res, ss: 2, shadowRes: res, look, items })})`);
  const sizes = new Map(out.filter((o) => o.layer === 'body').map((o) => [o.key, o]));
  const shadows = new Map(out.filter((o) => o.layer === 'shadow').map((o) => [o.key, o]));
  await gridSheet(browser, ctx, items.map((i) => ({ key: i.key })), join(ctx.sheetDir, `explore-${what.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.png`), {
    cols: 6,
    cellW: 220 * res,
    cellH: 220 * res,
    sizes,
    shadows,
  });
}
