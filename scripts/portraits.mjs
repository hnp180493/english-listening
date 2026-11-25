#!/usr/bin/env node
/**
 * The residents' drawn portraits (docs/portrait-prompts.md): ONE picture per resident, nine faces in a 3 × 3 grid.
 *
 * Takes what the owner made in a free AI chat from portraits-src/ (any of png / jpg / jpeg / webp):
 *   - <name>.png       a grid of nine faces (found by the white gutters between the panels), or one plain picture
 *                      (no gutters found: it becomes the neutral face);
 *   - <name>-luoi.png  a grid for sure: cut where the gutters are, else in three equal parts each way;
 *   - <name>-cuoi.png, -buon, -ngai, -ngac, -camdong, -doi, -suynghi, -lolang: one face, put in its cell over the
 *                      resident's picture as it is (to mend one face without drawing all nine again).
 * and makes public/portraits/<placeId>.webp: the nine cells side by side with no gutters, CELL px each, in the order
 * of SHEET_LAYOUT (src/features/town/portraitSheet.ts reads the same order; a test checks they match). An empty cell
 * (one flat colour) is left out of the list. It writes src/features/town/portraitFiles.ts (each picture's hash and the
 * moods drawn in it) and removes the one-file-per-face pictures of earlier versions (<placeId>-happy.webp …).
 *
 * The pictures are drawn on a canvas in headless Microsoft Edge (or Chrome) over its debugging protocol: no image
 * library to install. A throwaway browser profile in the system's temp folder is deleted afterwards.
 *
 *   npm run portraits                      (from portraits-src/)
 *   npm run portraits -- --from "D:\x"     (from another folder)
 *   npm run portraits -- --list-only       (only write the list again from public/portraits, colours measured anew)
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'portraits');
const LIST_FILE = join(ROOT, 'src', 'features', 'town', 'portraitFiles.ts');
/** One face in the picture (px): about what a chat draws in a cell of a 1024 px grid. */
const CELL = 384;
const QUALITY = 0.86;

/** The grid's cells, left to right, top to bottom (the same order as portraitSheet.ts SHEET_LAYOUT). */
export const SHEET_LAYOUT = ['neutral', 'happy', 'sad', 'love', 'surprised', 'moved', 'pout', 'thinking', 'worried'];

/** Resident name (as in the file name) → place id (data/town.ts TOWN_PLACES). */
export const RESIDENTS = {
  leo: 'square',
  emma: 'cafe',
  mia: 'friend',
  grace: 'home',
  ben: 'shop',
  sarah: 'office',
  daniel: 'school',
  sam: 'station',
  kim: 'clinic',
  zoe: 'cinema',
  max: 'phone',
  lily: 'park',
  tom: 'board',
};
const PLACE_IDS = new Set(Object.values(RESIDENTS));

/** A word in the file name → the mood of one face (portraitSheet.ts PortraitMood). */
const MOODS = {
  cuoi: 'happy',
  happy: 'happy',
  smile: 'happy',
  buon: 'sad',
  sad: 'sad',
  ngai: 'love',
  thich: 'love',
  love: 'love',
  ngac: 'surprised',
  surprised: 'surprised',
  camdong: 'moved',
  moved: 'moved',
  doi: 'pout',
  pout: 'pout',
  suynghi: 'thinking',
  thinking: 'thinking',
  lolang: 'worried',
  worried: 'worried',
};
const GRID_WORDS = new Set(['luoi', 'grid', 'sheet']);
const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/**
 * "Zoe.PNG" → { id: 'cinema', kind: 'auto' }, "zoe-luoi.png" → { kind: 'grid' }, "Emma-Cười.PNG" → { id: 'cafe',
 * kind: 'cell', mood: 'happy' }; a place id works as the name too ("cafe-happy.webp", the earlier one-face files).
 * null for a name that is not one of the residents.
 */
export function parseName(file) {
  if (!EXT.has(extname(file).toLowerCase())) return null;
  const base = file
    .slice(0, -extname(file).length)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
  const [name, ...rest] = base.split(/[-_ ]+/);
  const id = Object.hasOwn(RESIDENTS, name) ? RESIDENTS[name] : PLACE_IDS.has(name) ? name : null;
  if (!id) return null;
  if (rest.some((w) => GRID_WORDS.has(w))) return { id, kind: 'grid' };
  const mood = rest.map((w) => (Object.hasOwn(MOODS, w) ? MOODS[w] : null)).find(Boolean);
  return mood ? { id, kind: 'cell', mood } : { id, kind: 'auto' };
}

/**
 * Where the panels are along one side of a grid: `gap[i]` = line i (a row or a column) is all gutter. Three runs of
 * panel lines, each about a third of the side (25–40%: three panels with thin gutters, not three people standing in a
 * wide background), give the three [start, end) spans; anything else is null.
 */
export function panelSpans(gap) {
  const n = gap.length;
  const runs = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const inPanel = i < n && !gap[i];
    if (inPanel && start < 0) start = i;
    if (!inPanel && start >= 0) {
      if (i - start >= n * 0.12) runs.push([start, i]);
      start = -1;
    }
  }
  return runs.length === 3 && runs.every(([a, b]) => b - a >= n * 0.25 && b - a <= n * 0.4) ? runs : null;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function browserPath() {
  const env = process.env;
  const list = [
    join(env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    join(env.ProgramFiles ?? 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
    join(env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  return list.find((p) => p && existsSync(p)) ?? null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A headless browser page to draw on: { run(expression) → value, close() }. */
export async function openBrowser() {
  const exe = browserPath();
  if (!exe) throw new Error('Không tìm thấy Microsoft Edge hay Google Chrome để đổi ảnh.');
  const profile = mkdtempSync(join(tmpdir(), 'nna-portraits-'));
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  let url = null;
  for (let i = 0; i < 100 && !url; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      url = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
    } catch {
      // not up yet
    }
    if (!url) await sleep(150);
  }
  if (!url) throw new Error('Trình duyệt không mở được.');
  const ws = new WebSocket(url);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let n = 0;
  const waiting = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    const w = waiting.get(m.id);
    if (!w) return;
    waiting.delete(m.id);
    if (m.error) w.reject(new Error(m.error.message));
    else w.resolve(m.result);
  };
  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++n;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return {
    async run(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async close() {
      try {
        await send('Browser.close', {});
      } catch {
        // already gone
      }
      ws.close();
      proc.kill();
      await sleep(400);
      // the browser can hold its files a moment longer on Windows: a profile left in the temp folder is no failure
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
      } catch {
        console.log(`  (chưa xóa được thư mục tạm ${profile}; Windows sẽ dọn sau)`);
      }
    },
  };
}

/**
 * The page-side drawing of one resident's picture. `ops` in order: { kind: 'base', src } (the picture as it is),
 * { kind: 'auto' | 'grid', src } (a grid of nine, or for 'auto' one plain picture when no grid is found),
 * { kind: 'cell', src, cell } (one face). Returns { url (WebP data URL), filled (cells drawn and not one flat
 * colour), found ('grid' | 'split' | 'single' per op) }.
 */
const DRAW = `async (ops, cellPx, quality, panelSpansSrc) => {
  const panelSpans = eval('(' + panelSpansSrc + ')');
  const load = async (src) => { const img = new Image(); img.src = src; await img.decode(); return img; };
  const sheet = document.createElement('canvas');
  sheet.width = sheet.height = cellPx * 3;
  const g = sheet.getContext('2d');
  g.imageSmoothingQuality = 'high';
  const drawn = new Set();
  const found = [];
  // one face cut from (x, y, w, h) of img into cell i: a square, the top kept (never the top of the head lost)
  const put = (img, x, y, w, h, i) => {
    const side = Math.min(w, h);
    const sx = x + (w - side) / 2;
    const sy = h > w ? y + (h - side) * 0.12 : y;
    const cx = (i % 3) * cellPx, cy = Math.floor(i / 3) * cellPx;
    g.clearRect(cx, cy, cellPx, cellPx);
    g.drawImage(img, sx, sy, side, side, cx, cy, cellPx, cellPx);
    drawn.add(i);
  };
  // the gutters: lines (rows or columns) of the outer margin's colour from end to end
  const grid = (img) => {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cg = c.getContext('2d', { willReadFrequently: true });
    cg.drawImage(img, 0, 0);
    const d = cg.getImageData(0, 0, w, h).data;
    let br = 0, bg = 0, bb = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const k = (y * w + x) * 4; br += d[k]; bg += d[k + 1]; bb += d[k + 2]; }
    br /= 16; bg /= 16; bb /= 16;
    const spans = (gutter) => {
      const rows = new Array(h), cols = new Array(w);
      for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) if (gutter((y * w + x) * 4)) n++; rows[y] = n >= w * 0.97; }
      for (let x = 0; x < w; x++) { let n = 0; for (let y = 0; y < h; y++) if (gutter((y * w + x) * 4)) n++; cols[x] = n >= h * 0.97; }
      const r = panelSpans(rows), q = panelSpans(cols);
      return r && q ? { rows: r, cols: q } : null;
    };
    // the gutters are white or nearly: light and without colour, unlike the soft backgrounds. Failing that, the
    // colour of the outer margin, but only when the corner IS a margin (light and pale): with no margin the corner is
    // a panel's background, and lines of only background would pass for gutters round the people
    const pale = (r, g, b) => Math.min(r, g, b) >= 215 && Math.max(r, g, b) - Math.min(r, g, b) <= 30;
    return (
      spans((k) => Math.min(d[k], d[k + 1], d[k + 2]) >= 228 && Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]) <= 20) ??
      (pale(br, bg, bb) ? spans((k) => Math.max(Math.abs(d[k] - br), Math.abs(d[k + 1] - bg), Math.abs(d[k + 2] - bb)) <= 24) : null)
    );
  };
  for (const op of ops) {
    const img = await load(op.src);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (op.kind === 'base') {
      g.drawImage(img, 0, 0, sheet.width, sheet.height);
      found.push('base');
    } else if (op.kind === 'cell') {
      put(img, 0, 0, w, h, op.cell);
      found.push('single');
    } else {
      let spans = grid(img);
      if (!spans && op.kind === 'grid') {
        const t = (n) => [[0, n / 3], [n / 3, (2 * n) / 3], [(2 * n) / 3, n]];
        spans = { rows: t(h), cols: t(w), split: true };
      }
      if (!spans) {
        put(img, 0, 0, w, h, 0);
        found.push('single');
        continue;
      }
      g.clearRect(0, 0, sheet.width, sheet.height);
      for (let i = 0; i < 9; i++) {
        const [y0, y1] = spans.rows[Math.floor(i / 3)], [x0, x1] = spans.cols[i % 3];
        // a little inside the panel: no gutter edge or panel border in the face
        const ix = Math.max(2, (x1 - x0) * 0.006), iy = Math.max(2, (y1 - y0) * 0.006);
        put(img, x0 + ix, y0 + iy, x1 - x0 - 2 * ix, y1 - y0 - 2 * iy, i);
      }
      found.push(spans.split ? 'split' : 'grid');
    }
  }
  // a cell of one flat colour (the chat left it empty) is not a face
  const filled = [];
  const px = g.getImageData(0, 0, sheet.width, sheet.height).data;
  for (let i = 0; i < 9; i++) {
    const cx = (i % 3) * cellPx, cy = Math.floor(i / 3) * cellPx;
    let n = 0, s = 0, s2 = 0, alpha = 0;
    for (let y = cy + 8; y < cy + cellPx - 8; y += 4) for (let x = cx + 8; x < cx + cellPx - 8; x += 4) {
      const k = (y * sheet.width + x) * 4;
      const l = 0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2];
      s += l; s2 += l * l; n++; alpha += px[k + 3];
    }
    const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
    if (alpha / n > 200 && sd > 6) filled.push(i);
  }
  // each face's background colour (the middle of three corners' colours, so a lock of hair in one does not count):
  // a round frame shows the face a little smaller and fills round it with this
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  const bg = Array.from({ length: 9 }, (_, i) => {
    if (!filled.includes(i)) return '';
    const cx = (i % 3) * cellPx, cy = Math.floor(i / 3) * cellPx;
    const spots = [[6, 6], [cellPx - 12, 6], [6, cellPx / 2]].map(([x0, y0]) => {
      const c = [0, 0, 0];
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { const k = ((cy + y0 + y) * sheet.width + cx + x0 + x) * 4; c[0] += px[k]; c[1] += px[k + 1]; c[2] += px[k + 2]; }
      return c.map((v) => v / 36);
    });
    return '#' + [0, 1, 2].map((j) => hex(spots.map((s) => s[j]).sort((a, b) => a - b)[1])).join('');
  });
  // how far a round frame moves the picture down (part of the frame) so the whole head of the first face drawn is
  // inside the circle (radius 0.47, a hair inside the frame's ring): every drawn pixel of the upper half that a
  // circle can hold at all (not hair running off the side) must be in it. Measured on one face: the head is the same
  // in all nine, and the face must not jump between moods.
  let lift = 0;
  const first = filled[0];
  if (first !== undefined) {
    const cx = (first % 3) * cellPx, cy = Math.floor(first / 3) * cellPx;
    const [br, bgg, bb] = [1, 3, 5].map((j) => parseInt(bg[first].slice(j, j + 2), 16));
    const R2 = 0.47 * 0.47;
    // drawn = far from the background (hair, skin, line art); a background that darkens toward the panel's edge, or
    // the panel's own thin border, is not. The outer 6% each side is left out: only a border or hair running off the
    // side is there, which no circle holds.
    for (let y = 0; y < cellPx * 0.55; y += 2) for (let x = Math.round(cellPx * 0.06); x < cellPx * 0.94; x += 2) {
      const k = ((cy + y) * sheet.width + cx + x) * 4;
      if (Math.max(Math.abs(px[k] - br), Math.abs(px[k + 1] - bgg), Math.abs(px[k + 2] - bb)) < 40) continue;
      const dx = x / cellPx - 0.5;
      if (dx * dx >= R2) continue;
      lift = Math.max(lift, 0.5 - Math.sqrt(R2 - dx * dx) - y / cellPx);
    }
    lift = Math.round(Math.min(0.15, lift) * 1000) / 1000;
  }
  return { url: (ops.length === 1 && ops[0].kind === 'base') ? '' : sheet.toDataURL('image/webp', quality), filled, found, bg, lift };
}`;

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const dataUrl = (file) => `data:${MIME[extname(file).toLowerCase()]};base64,${readFileSync(file).toString('base64')}`;

/** The list as it is now (portraitFiles.ts): { placeId: { v, has } }; {} when it is missing or of an older kind. */
function readList() {
  try {
    const m = /PORTRAIT_SHEETS[^=]*=\s*(\{[\s\S]*\});/.exec(readFileSync(LIST_FILE, 'utf8'));
    return m ? JSON.parse(m[1]) : {};
  } catch {
    return {};
  }
}

/**
 * The pictures in public/portraits → the list file the app imports (`has` and `bg` from this run, else from the list
 * as it was).
 */
function writeList(moods = {}, colours = {}, lifts = {}) {
  const before = readList();
  const list = {};
  for (const id of [...PLACE_IDS].sort()) {
    const file = join(OUT_DIR, `${id}.webp`);
    const has = moods[id] ?? before[id]?.has;
    if (!existsSync(file) || !has?.length) continue;
    const bg = colours[id] ?? before[id]?.bg;
    const lift = lifts[id] ?? before[id]?.lift;
    list[id] = { v: createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 10), has, ...(bg ? { bg } : {}), ...(lift !== undefined ? { lift } : {}) };
  }
  const body = Object.entries(list)
    .map(([id, e]) => `  ${JSON.stringify(id)}: ${JSON.stringify(e).replace(/,/g, ', ').replace(/:/g, ': ')}`)
    .join(',\n');
  writeFileSync(
    LIST_FILE,
    `// Written by scripts/portraits.mjs (npm run portraits): each resident's drawn portraits, one 3 × 3 grid of faces in
// public/portraits/<placeId>.webp (docs/portrait-prompts.md), with a hash of the file (a new picture is fetched again)
// and the moods drawn in it (portraitSheet.ts SHEET_LAYOUT gives each one's cell), with each face's background colour
// and how far a round frame moves the picture down so the whole head is inside the circle (a part of the frame; the
// gap above is filled with that colour). Not edited by hand.

import type { SheetEntry } from './portraitSheet';

export const PORTRAIT_SHEETS: Readonly<Record<string, SheetEntry>> = {${body ? `\n${body}\n` : ''}};
`,
  );
  return list;
}

/** The one-file-per-face pictures of earlier versions (<placeId>-happy.webp …) of this resident. */
function removeOldFaces(id) {
  for (const f of readdirSync(OUT_DIR)) {
    if (new RegExp(`^${id}-[a-z]+\\.webp$`).test(f)) unlinkSync(join(OUT_DIR, f));
  }
}

/** The list again from the pictures already in public/portraits (their faces' background colours measured anew). */
async function listOnly() {
  const before = readList();
  const colours = {};
  const lifts = {};
  const page = await openBrowser();
  try {
    await page.run(`window.__draw = ${DRAW}; true`);
    for (const id of Object.keys(before)) {
      const file = join(OUT_DIR, `${id}.webp`);
      if (!existsSync(file)) continue;
      const out = await page.run(`window.__draw(${JSON.stringify([{ kind: 'base', src: dataUrl(file) }])}, ${CELL}, ${QUALITY}, ${JSON.stringify(panelSpans.toString())})`);
      colours[id] = out.bg.map((c, i) => (before[id].has.includes(SHEET_LAYOUT[i]) ? c : ''));
      lifts[id] = out.lift;
    }
  } finally {
    await page.close();
  }
  console.log(writeList({}, colours, lifts));
}

async function main() {
  if (process.argv.includes('--list-only')) {
    await listOnly();
    return;
  }
  const from = arg('from', join(ROOT, 'portraits-src'));
  if (!existsSync(from)) {
    console.error(`Chưa có thư mục ${from}. Bỏ ảnh vào đó (docs/portrait-prompts.md) rồi chạy lại.`);
    process.exit(1);
  }
  /** placeId → its files: the grids / plain pictures first, then the single faces. */
  const people = new Map();
  const skipped = [];
  for (const f of readdirSync(from).sort()) {
    const p = parseName(f);
    if (!p) {
      if (EXT.has(extname(f).toLowerCase())) skipped.push(f);
      continue;
    }
    const jobs = people.get(p.id) ?? [];
    jobs.push({ file: join(from, f), name: f, ...p });
    people.set(p.id, jobs);
  }
  if (!people.size) {
    console.error(`Không thấy ảnh nào đặt tên đúng trong ${from} (ví dụ zoe.png: một ảnh lưới 9 vẻ mặt).`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const before = readList();
  const moods = {};
  const colours = {};
  const lifts = {};
  const page = await openBrowser();
  try {
    await page.run(`window.__draw = ${DRAW}; true`);
    for (const [id, jobs] of people) {
      jobs.sort((a, b) => (a.kind === 'cell' ? 1 : 0) - (b.kind === 'cell' ? 1 : 0));
      const whole = jobs.some((j) => j.kind !== 'cell');
      const ops = [];
      const sheetFile = join(OUT_DIR, `${id}.webp`);
      // only single faces: they go over the picture as it is
      const base = !whole && before[id] && existsSync(sheetFile);
      if (base) ops.push({ kind: 'base', src: dataUrl(sheetFile) });
      for (const j of jobs) ops.push({ kind: j.kind, src: dataUrl(j.file), cell: j.kind === 'cell' ? SHEET_LAYOUT.indexOf(j.mood) : 0 });
      const out = await page.run(`window.__draw(${JSON.stringify(ops)}, ${CELL}, ${QUALITY}, ${JSON.stringify(panelSpans.toString())})`);
      if (typeof out?.url !== 'string' || !out.url.startsWith('data:image/webp')) throw new Error(`Không đổi được ảnh của ${id}`);
      const filled = new Set(out.filled);
      // a single face's cell counts even when flat; the base keeps the moods it had
      const has = SHEET_LAYOUT.filter((m, i) => filled.has(i) || (base && before[id].has.includes(m) && !jobs.some((j) => j.kind === 'cell' && j.mood === m)));
      if (!has.length) {
        console.log(`  ${id}: không thấy mặt nào trong ảnh, bỏ qua`);
        continue;
      }
      removeOldFaces(id);
      const bytes = Buffer.from(out.url.split(',')[1], 'base64');
      writeFileSync(sheetFile, bytes);
      moods[id] = has;
      colours[id] = out.bg.map((c, i) => (has.includes(SHEET_LAYOUT[i]) ? c : ''));
      lifts[id] = out.lift;
      const how = out.found.slice(base ? 1 : 0).map((f, i) => `${jobs[i].name}: ${f === 'grid' ? 'lưới 3×3' : f === 'split' ? 'lưới (chia đều 3 phần, không thấy đường kẻ)' : 'một mặt'}`);
      const empty = SHEET_LAYOUT.filter((m) => !has.includes(m));
      console.log(`  ${id}.webp  ${(bytes.length / 1024).toFixed(0)} kB  ${has.length}/9 vẻ mặt${empty.length ? ` (thiếu: ${empty.join(', ')})` : ''}`);
      for (const line of how) console.log(`      ${line}`);
    }
  } finally {
    await page.close();
  }
  const list = writeList(moods, colours, lifts);
  console.log(`Xong. Có ảnh vẽ: ${Object.keys(list).length}/13 người.`);
  if (skipped.length) console.log(`Bỏ qua (tên không khớp người nào): ${skipped.join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
