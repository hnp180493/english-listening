#!/usr/bin/env node
/**
 * Renders the "Thị trấn" sprites from Kenney's CC0 3D packs (see README.md in this folder).
 *
 *   npm run art:town                       -> characters + portraits into src/features/town/art/
 *   npm run art:town -- --preview          -> only a cast preview sheet (every human model, idle, 5 directions)
 *   npm run art:town -- --sheet <file.png> -> also write the contact sheet there (default art-src/out/characters-sheet.png)
 *   npm run art:town -- --only player,cafe -> a trial: only these characters, atlases into art-src/out/trial/, no manifest
 *
 * Node serves a small page (page/) with three.js, the GLB models (art-src/kenney/) and drives a headless Edge /
 * Chrome over the DevTools protocol (cdp.mjs). The page renders and trims every frame and keeps it in memory; Node
 * plans the frames, packs them into atlases (pack.mjs), asks the page to encode each atlas as WebP, writes the files
 * and a typed manifest (characters.data.ts). Nothing here ships in the app: the app only gets the WebP files and
 * the manifest.
 */
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAST, CHARACTER_IDS } from '../../src/features/town/art/cast.ts';
import { launch } from './cdp.mjs';
import { packShelves } from './pack.mjs';
import { exploreWorld, renderWorld } from './world.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const KENNEY = join(ROOT, 'art-src', 'kenney');
const OUT_DIR = join(ROOT, 'src', 'features', 'town', 'art');
const CHAR_DIR = join(OUT_DIR, 'characters');

// ---- the look --------------------------------------------------------------------------------------------------

/**
 * Output pixels per world pixel (world pixel = a CSS pixel at camera zoom 1, engine/iso.ts). The game's normal zoom
 * on a phone is about 1.25 on a 2× screen (2.5 device px per world px), so 2.5 draws them 1:1 there instead of
 * enlarging a 2× atlas by a quarter (soft faces); the conversation zoom on a phone stays close to it (camera.ts).
 * With WebP quality 0.74 all fourteen people stay near 4 MB.
 */
const RES = Number(process.env.TOWN_ART_RES ?? 2.5);
/** Rendered this many times bigger, then scaled down (clean edges). */
const SS = 2;
/** Characters are this many times bigger than the Kenney kit scale (1 unit = 1 tile): about 46 world px tall. */
const CHAR_SCALE = 1.5;
/** One frame before trimming, in world px; the feet at (w / 2, foot). */
const CELL = { w: 64, h: 84, foot: 74 };
const WEBP_QUALITY = Number(process.env.TOWN_ART_QUALITY ?? 0.74);
/** Portraits and the shadow are small: a higher quality costs little. */
const PORTRAIT_QUALITY = 0.9;

const LOOK = {
  sky: 0xfff4e6,
  ground: 0x9aa6c8,
  hemi: 1.7,
  keyColor: 0xfff6ec,
  key: 2.1,
  fillColor: 0xdce6ff,
  fill: 1.0,
  rimColor: 0xffffff,
  rim: 1.2,
  roughness: 0.9,
  outline: 0.45, // world px
  outlineColor: '#2e2440',
  outlineAlpha: 0.55,
  shadowR: 0.3, // model units (× scale)
  shadowRgb: '40, 36, 70',
  shadowAlpha: 0.32,
};

/** Rendered directions; the other three are these mirrored (see characters.ts). */
const DIRS5 = ['S', 'SE', 'E', 'NE', 'N'];
/** Animations: name in the game, Kenney clip, frames per cycle, loop, directions. */
const ANIMS = [
  { name: 'idle', clip: 'idle', frames: 6, loop: true, dirs: DIRS5 },
  { name: 'walk', clip: 'walk', frames: 8, loop: true, dirs: DIRS5 },
  { name: 'yes', clip: 'emote-yes', frames: 6, loop: false, dirs: ['SE', 'NE'] },
  { name: 'no', clip: 'emote-no', frames: 6, loop: false, dirs: ['SE', 'NE'] },
  { name: 'wave', clip: 'interact-right', frames: 6, loop: false, dirs: ['SE', 'NE'] },
];

/** Portraits: square, `PORTRAIT` px (2× for a 96 px use; also fine at 56 px). */
const PORTRAIT = 192;
const PORTRAIT_FRAME = { yaw: 70, elevation: 10, centerY: 0.52, halfH: 0.35 };
const PORTRAIT_MOODS = [
  { name: 'neutral', clip: 'idle', t: 0 },
  { name: 'happy', clip: 'emote-yes', at: 0.35 },
];

/**
 * Fixes of the source models: female-a's body mesh includes a pair of crutches (they would swing in the walk);
 * male-e (the player) wears black gloves that read as two black boxes at the end of his sleeves: bare hands.
 */
const MODEL_FIXES = {
  'female-a': { strip: { mesh: 'body-mesh', minAbsX: 0.2, cell: [1, 1] } },
  'male-e': { paint: { mesh: 'body-mesh', minAbsX: 0.2, from: [7, 3], to: [5, 2] } },
};

const PROPS = {
  glasses: { file: 'aid-glasses.glb', bone: 'head', offset: [0, 0.135, 0.12] },
  sunglasses: { file: 'aid-sunglasses.glb', bone: 'head', offset: [0, 0.135, 0.12] },
};

// ---- a small static server --------------------------------------------------------------------------------------

const MIME = { '.webp': 'image/webp', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json' };
const MOUNTS = { '/page/': join(HERE, 'page'), '/three/': join(ROOT, 'node_modules', 'three'), '/kenney/': KENNEY, '/art/': OUT_DIR };

function serve() {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const mount = Object.keys(MOUNTS).find((m) => url.startsWith(m));
    if (!mount) return void res.writeHead(404).end();
    const base = MOUNTS[mount];
    const file = normalize(join(base, url.slice(mount.length)));
    if (relative(base, file).startsWith('..') || !file.startsWith(base + sep)) return void res.writeHead(403).end();
    try {
      await stat(file);
    } catch {
      return void res.writeHead(404).end();
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

// ---- helpers -----------------------------------------------------------------------------------------------------

const modelUrl = (file) => `/kenney/mini-characters/Models/GLB format/${file}`;
const js = (v) => JSON.stringify(v);

function parseArgs(argv) {
  const o = { preview: false, sheet: join(ROOT, 'art-src', 'out', 'characters-sheet.png'), only: null, noSheet: false, part: 'all', explore: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--preview') o.preview = true;
    else if (argv[i] === '--no-sheet') o.noSheet = true;
    else if (argv[i] === '--only') o.only = argv[++i].split(',');
    else if (argv[i] === '--sheet') o.sheet = resolve(argv[++i]);
    else if (argv[i] === '--part') o.part = argv[++i];
    else if (argv[i] === '--explore') o.explore = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return o;
}

async function writeBase64(file, b64) {
  await mkdir(dirname(file), { recursive: true });
  const buf = Buffer.from(b64, 'base64');
  await writeFile(file, buf);
  return buf.length;
}

function frameItems() {
  const items = [];
  for (const a of ANIMS) {
    for (const dir of a.dirs) {
      for (let i = 0; i < a.frames; i++) items.push({ key: `${a.name}/${dir}/${i}`, clip: a.clip, dir, t: (i / a.frames) * a.duration });
    }
  }
  return items;
}

// ---- main --------------------------------------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const server = await serve();
  const port = server.address().port;
  const browser = await launch();
  try {
    await browser.navigate(`http://127.0.0.1:${port}/page/index.html`);
    for (let i = 0; i < 100 && !(await browser.evaluate('!!window.TA_READY && !!window.TA_WORLD_READY')); i++) await new Promise((r) => setTimeout(r, 100));
    if (!(await browser.evaluate('!!window.TA_READY && !!window.TA_WORLD_READY'))) throw new Error('render page did not start');
    const ctx = { ROOT, KENNEY, OUT_DIR, LOOK, SS, RES, WEBP_QUALITY, writeBase64, js, sheetDir: dirname(opts.sheet) };
    if (opts.preview) await preview(browser, opts);
    else if (opts.explore) await exploreWorld(browser, ctx, opts.explore);
    else {
      if (opts.part === 'all' || opts.part === 'characters') await renderAll(browser, opts);
      if (opts.part === 'all' || opts.part === 'world') await renderWorld(browser, ctx, opts);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

/** Every human model, idle frame 0, five directions: to choose the cast. */
async function preview(browser, opts) {
  const models = ['female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f', 'male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f', 'male-g', 'worker'];
  const cellW = CELL.w * RES + 8;
  const cellH = CELL.h * RES + 8;
  const items = [];
  const labels = [];
  const dirs = [...DIRS5, 'SW'];
  let row = 0;
  for (const m of models) {
    await browser.evaluate(`TA.loadCharacter(${js({ glb: modelUrl(`character-${m}.glb`), look: LOOK, ...MODEL_FIXES[m] })})`);
    const frames = await browser.evaluate(
      `TA.renderFrames(${js({ prefix: m, scale: CHAR_SCALE, res: RES, ss: SS, cell: CELL, look: LOOK, items: dirs.map((d) => ({ key: d, clip: 'idle', dir: d, t: 0 })) })})`,
    );
    frames.forEach((f, col) => {
      items.push({ key: `${m}:${f.key}`, x: 120 + col * cellW + cellW / 2 - f.ax, y: row * cellH + CELL.foot * RES + 4 - f.ay });
    });
    labels.push({ text: m, x: 8, y: row * cellH + cellH / 2 });
    row++;
  }
  const W = 120 + dirs.length * cellW;
  const H = row * cellH;
  const b64 = await browser.evaluateString(`TA.compose(${js({ width: W, height: H, bg: '#9ad27a', items, labels })})`);
  const file = opts.sheet.replace(/\.png$/, '-preview.png');
  await writeBase64(file, b64);
  console.log(`preview: ${file}`);
}

async function renderAll(browser, opts) {
  const ids = opts.only ?? CHARACTER_IDS;
  const outDir = opts.only ? join(ROOT, 'art-src', 'out', 'trial') : CHAR_DIR;
  await mkdir(outDir, { recursive: true });
  const durations = new Map();
  const chars = {};
  const sheetRows = [];
  let total = 0;

  for (const id of ids) {
    const c = CAST[id];
    const props = (c.props ?? []).map((p) => ({ glb: modelUrl(PROPS[p].file), bone: PROPS[p].bone, offset: PROPS[p].offset }));
    const clips = await browser.evaluate(
      `TA.loadCharacter(${js({ glb: modelUrl(`character-${c.model}.glb`), props, look: LOOK, swaps: c.swaps ?? [], ...MODEL_FIXES[c.model] })})`,
    );
    for (const cl of clips) durations.set(cl.name, cl.duration);
    for (const a of ANIMS) a.duration = durations.get(a.clip);
    const items = frameItems();
    const frames = await browser.evaluate(
      `TA.renderFrames(${js({ prefix: id, scale: CHAR_SCALE, res: RES, ss: SS, cell: CELL, look: LOOK, items })})`,
    );
    const pack = packShelves(frames.map((f) => ({ key: f.key, w: f.w, h: f.h })));
    const b64 = await browser.evaluateString(
      `TA.compose(${js({ width: pack.width, height: pack.height, type: 'image/webp', quality: WEBP_QUALITY, items: frames.map((f) => ({ key: `${id}:${f.key}`, ...pack.at.get(f.key) })) })})`,
    );
    const bytes = await writeBase64(join(outDir, `${id}.webp`), b64);
    total += bytes;
    // frames in manifest order: anim, direction, index (the same order as frameItems)
    const flat = [];
    for (const f of frames) {
      const at = pack.at.get(f.key);
      flat.push(at.x, at.y, f.w, f.h, round1(f.ax), round1(f.ay));
    }
    chars[id] = { w: pack.width, h: pack.height, frames: flat };
    // for the mirror check only: the three mirrored directions rendered for real
    const native = opts.noSheet
      ? []
      : await browser.evaluate(
          `TA.renderFrames(${js({ prefix: id, scale: CHAR_SCALE, res: RES, ss: SS, cell: CELL, look: LOOK, items: Object.keys(MIRROR).map((d) => ({ key: `native/${d}/0`, clip: 'idle', dir: d, t: 0 })) })})`,
        );
    sheetRows.push({ id, frames: [...frames, ...native] });
    console.log(`${id.padEnd(8)} ${c.model.padEnd(9)} ${frames.length} frames  ${pack.width}×${pack.height}  ${(bytes / 1024).toFixed(0)} KB`);

    // portraits
    const pitems = PORTRAIT_MOODS.map((m) => ({ key: `portrait/${m.name}`, clip: m.clip, t: m.t ?? m.at * durations.get(m.clip) }));
    await browser.evaluate(`TA.renderPortraits(${js({ prefix: id, scale: 1, size: PORTRAIT, ss: SS, look: LOOK, frame: PORTRAIT_FRAME, items: pitems })})`);
  }

  // portrait atlas: one column per character, one row per mood
  const pitems = [];
  ids.forEach((id, col) => {
    PORTRAIT_MOODS.forEach((m, row) => pitems.push({ key: `${id}:portrait/${m.name}`, x: col * PORTRAIT, y: row * PORTRAIT }));
  });
  const pb64 = await browser.evaluateString(
    `TA.compose(${js({ width: ids.length * PORTRAIT, height: PORTRAIT_MOODS.length * PORTRAIT, type: 'image/webp', quality: PORTRAIT_QUALITY, items: pitems })})`,
  );
  const pbytes = await writeBase64(join(outDir, 'portraits.webp'), pb64);
  total += pbytes;

  // the shared contact shadow
  shadow = await browser.evaluate(`TA.renderShadow(${js({ key: 'shadow', rx: LOOK.shadowR * CHAR_SCALE, res: RES, look: LOOK })})`);
  const sb64 = await browser.evaluateString(`TA.compose(${js({ width: shadow.w, height: shadow.h, type: 'image/webp', quality: PORTRAIT_QUALITY, items: [{ key: 'shadow', x: 0, y: 0 }] })})`);
  total += await writeBase64(join(outDir, 'shadow.webp'), sb64);
  console.log(`portraits ${(pbytes / 1024).toFixed(0)} KB; characters total ${(total / 1024 / 1024).toFixed(2)} MB`);

  if (!opts.only) await writeManifest(chars);
  if (opts.noSheet) return;
  await contactSheet(browser, sheetRows, opts.sheet);
  await portraitSheet(browser, ids, opts.sheet.replace(/.png$/, '-portraits.png'));
}

const round1 = (n) => Math.round(n * 10) / 10;
/** The shadow sprite's size and centre, once rendered. */
let shadow = null;

async function writeManifest(chars) {
  const anims = Object.fromEntries(
    ANIMS.map((a) => [a.name, { frames: a.frames, duration: round1(a.duration * 1000) / 1000, loop: a.loop, dirs: a.dirs }]),
  );
  const lines = [
    '// GENERATED by scripts/town-art/render.mjs (`npm run art:town`). Do not edit by hand.',
    '// Kenney Mini Characters (CC0, LICENSE-kenney.txt) rendered as sprites; the cast is in cast.ts.',
    '',
    "import type { CharacterId } from './cast';",
    ...CHARACTER_IDS.map((id) => `import ${varName(id)} from './characters/${id}.webp';`),
    "import portraitsUrl from './characters/portraits.webp';",
    "import shadowUrl from './characters/shadow.webp';",
    '',
    'export const CHARACTER_ART: CharacterArtData = {',
    `  /** Atlas pixels per world pixel. */`,
    `  res: ${RES},`,
    `  /** About how tall a person stands, in world pixels (feet to the top of the head). */`,
    `  height: ${Math.round(0.78 * CHAR_SCALE * Math.cos(Math.PI / 6) * (64 / Math.SQRT2))},`,
    `  anims: ${js(anims)},`,
    '  /** Per character: its atlas (url, size) and every frame as [x, y, w, h, anchorX, anchorY] (anchor = the feet), in the order anim → direction → frame. */',
    '  chars: {',
    ...CHARACTER_IDS.map((id) => `    ${js(id)}: { url: ${varName(id)}, w: ${chars[id].w}, h: ${chars[id].h}, frames: ${js(chars[id].frames)} },`),
    '  },',
    `  /** The contact shadow, drawn under every person before the frame: centre (ax, ay) at the feet. */`,
    `  shadow: { url: shadowUrl, w: ${shadow.w}, h: ${shadow.h}, ax: ${shadow.ax}, ay: ${shadow.ay} },`,
    `  portraits: { url: portraitsUrl, size: ${PORTRAIT}, moods: ${js(PORTRAIT_MOODS.map((m) => m.name))}, order: ${js(CHARACTER_IDS)} },`,
    '};',
    '',
    'export interface CharacterArtData {',
    '  res: number;',
    '  height: number;',
    '  /** Per animation: frames per cycle, seconds per cycle, whether it loops, the directions rendered (the others are mirrored). */',
    '  anims: Readonly<Record<string, { frames: number; duration: number; loop: boolean; dirs: readonly string[] }>>;',
    '  chars: Readonly<Record<CharacterId, { url: string; w: number; h: number; frames: readonly number[] }>>;',
    '  shadow: { url: string; w: number; h: number; ax: number; ay: number };',
    '  portraits: { url: string; size: number; moods: readonly string[]; order: readonly CharacterId[] };',
    '}',
    '',
  ];
  await writeFile(join(OUT_DIR, 'characters.data.ts'), lines.join('\n'));
}

const varName = (id) => `${id}Url`;

const SHEET_BG = '#9ad27a';
const MIRROR = { SW: 'SE', W: 'E', NW: 'NE' };

/**
 * One grid of frames: a row per character, columns = directions × shown frames (mirrored directions are drawn
 * flipped, as the game will). `scale` < 1 shows them smaller (e.g. at the size the game draws them).
 */
async function sheet(browser, rows, file, { dirs, shown, scale = 1, labelW = 110 }) {
  const cellW = Math.round(46 * RES * scale);
  const cellH = Math.round((CELL.h - 4) * RES * scale);
  const items = [];
  const labels = [];
  const rects = [];
  rows.forEach((r, ri) => {
    const byKey = new Map(r.frames.map((f) => [f.key, f]));
    labels.push({ text: `${r.id} · ${CAST[r.id].name}`, x: 8, y: ri * cellH + cellH / 2 });
    dirs.forEach((d, di) => {
      shown.forEach(([anim, i], si) => {
        const src = anim === 'native' ? d : (MIRROR[d] ?? d);
        const f = byKey.get(`${anim}/${src}/${i}`);
        if (!f) return;
        const col = di * shown.length + si;
        const cx = labelW + col * cellW + cellW / 2;
        const fy = ri * cellH + (CELL.foot - 2) * RES * scale;
        const flip = src !== d;
        if (shadow) items.push({ key: 'shadow', x: cx - shadow.ax * scale, y: fy - shadow.ay * scale, w: shadow.w * scale, h: shadow.h * scale });
        const w = f.w * scale;
        const h = f.h * scale;
        items.push({ key: `${r.id}:${f.key}`, x: flip ? cx - (w - f.ax * scale) : cx - f.ax * scale, y: fy - f.ay * scale, w, h, flip });
      });
    });
  });
  dirs.forEach((d, di) => {
    rects.push({ x: labelW + di * shown.length * cellW, y: 0, w: 2, h: rows.length * cellH, color: 'rgba(0,0,0,0.12)' });
    labels.push({ text: d, x: labelW + di * shown.length * cellW + 6, y: 16 });
  });
  const W = labelW + dirs.length * shown.length * cellW;
  const H = rows.length * cellH;
  const b64 = await browser.evaluateString(`TA.compose(${js({ width: W, height: H, bg: SHEET_BG, items, labels, rects })})`);
  await writeBase64(file, b64);
  console.log(`sheet: ${file}`);
}

/** The contact sheet (every character, all eight directions, idle + walk) plus smaller pages to look at closely. */
async function contactSheet(browser, rows, file) {
  const dirs8 = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
  const walk = ANIMS.find((a) => a.name === 'walk').frames;
  await sheet(browser, rows, file, { dirs: dirs8, shown: [['idle', 0], ['walk', 0], ['walk', walk / 4]] });
  const base = file.replace(/.png$/, '');
  for (let p = 0; p * 4 < rows.length; p++) {
    await sheet(browser, rows.slice(p * 4, p * 4 + 4), `${base}-p${p + 1}.png`, { dirs: dirs8, shown: [['idle', 0], ['walk', walk / 4]] });
  }
  const emotes = ANIMS.filter((a) => !a.loop);
  for (let p = 0; p * 7 < rows.length; p++) {
    await sheet(browser, rows.slice(p * 7, p * 7 + 7), `${base}-emotes${p + 1}.png`, {
      dirs: ['SE', 'SW', 'NE'],
      shown: emotes.flatMap((a) => [[a.name, Math.floor(a.frames * 0.25)], [a.name, Math.floor(a.frames * 0.5)]]),
    });
  }
  // the size the game draws them: normal zoom on a 2× phone (≈ 2.8 px per world px) and on a 1× desktop (1.45)
  await sheet(browser, rows, `${base}-game.png`, { dirs: ['S', 'SE', 'E', 'NE', 'SW'], shown: [['idle', 0], ['walk', walk / 4]], scale: 2.8 / RES });
  // mirrored (as the game draws SW, W, NW) next to the same direction rendered for real
  await sheet(browser, rows, `${base}-mirror.png`, {
    dirs: ['SW', 'W', 'NW'],
    shown: [['idle', 0], ['native', 0]],
    scale: 1.4 / RES * 1.5,
    nativeKeys: true,
  });
  // the conversation zoom on a 2× phone (≈ 4.2 px per world px): the sprites are scaled up there
  await sheet(browser, rows.slice(0, 4), `${base}-focus.png`, { dirs: ['S', 'SE', 'NE', 'SW'], shown: [['idle', 0]], scale: 4.2 / RES });
  await sheet(browser, rows, `${base}-game1x.png`, { dirs: ['S', 'SE', 'E', 'NE', 'SW'], shown: [['idle', 0], ['walk', walk / 4]], scale: 1.45 / RES, labelW: 90 });
}

/** Every portrait, each mood, on light and dark. */
async function portraitSheet(browser, ids, file) {
  const items = [];
  const rects = [
    { x: 0, y: 0, w: ids.length * PORTRAIT, h: PORTRAIT_MOODS.length * PORTRAIT, color: '#f3efe6' },
    { x: 0, y: PORTRAIT_MOODS.length * PORTRAIT, w: ids.length * PORTRAIT, h: PORTRAIT, color: '#24203a' },
  ];
  ids.forEach((id, col) => {
    PORTRAIT_MOODS.forEach((m, row) => items.push({ key: `${id}:portrait/${m.name}`, x: col * PORTRAIT, y: row * PORTRAIT }));
    items.push({ key: `${id}:portrait/neutral`, x: col * PORTRAIT + 20, y: PORTRAIT_MOODS.length * PORTRAIT + 20, w: 112, h: 112 });
    items.push({ key: `${id}:portrait/neutral`, x: col * PORTRAIT + 136, y: PORTRAIT_MOODS.length * PORTRAIT + 100, w: 56, h: 56 });
  });
  const b64 = await browser.evaluateString(`TA.compose(${js({ width: ids.length * PORTRAIT, height: (PORTRAIT_MOODS.length + 1) * PORTRAIT, items, rects })})`);
  await writeBase64(file, b64);
  console.log(`sheet: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
