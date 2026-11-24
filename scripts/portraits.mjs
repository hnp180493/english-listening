#!/usr/bin/env node
/**
 * The residents' drawn portraits (docs/portrait-prompts.md): takes the pictures the owner made in a free AI chat
 * (portraits-src/<name>.png, <name>-cuoi.png, -buon, -ngai, -ngac, -camdong, -doi; any of png / jpg / jpeg / webp),
 * crops each to a square (the middle, the top kept for a tall picture), makes it 512 px WebP in
 * public/portraits/<placeId>.webp / -happy / -sad / -love / -surprised / -moved / -pout and
 * writes src/features/town/portraitFiles.ts (which pictures exist, with a content hash for caching).
 *
 * The pictures are drawn on a canvas in headless Microsoft Edge (or Chrome) over its debugging protocol: no image
 * library to install. A throwaway browser profile in the system's temp folder is deleted afterwards.
 *
 *   npm run portraits                      (from portraits-src/)
 *   npm run portraits -- --from "D:\x"     (from another folder)
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'portraits');
const LIST_FILE = join(ROOT, 'src', 'features', 'town', 'portraitFiles.ts');
const SIZE = 512;
const QUALITY = 0.86;

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

/** A word in the file name → the mood (art.tsx PortraitMood); none = 'neutral'. */
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
};
const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/** "Emma-Cười.PNG" → { id: 'cafe', mood: 'happy' }; null for a name that is not one of the residents. */
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
  const id = RESIDENTS[name];
  if (!id) return null;
  const mood = rest.map((w) => MOODS[w]).find(Boolean) ?? 'neutral';
  return { id, mood };
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
async function openBrowser() {
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
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    },
  };
}

/** The page-side drawing: a data URL in, a square WebP data URL out. */
const DRAW = `async (src, size, quality) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h);
  const x = (w - side) / 2, y = h > w ? (h - side) * 0.12 : 0;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, x, y, side, side, 0, 0, size, size);
  return c.toDataURL('image/webp', quality);
}`;

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

/** Every picture in public/portraits → the list file the app imports. */
function writeList() {
  const files = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((f) => f.endsWith('.webp')) : [];
  const list = {};
  for (const f of files.sort()) {
    const m = /^([a-z]+)(?:-(happy|sad|love|surprised|moved|pout))?\.webp$/.exec(f);
    if (!m || !Object.values(RESIDENTS).includes(m[1])) continue;
    const hash = createHash('sha1').update(readFileSync(join(OUT_DIR, f))).digest('hex').slice(0, 10);
    (list[m[1]] ??= {})[m[2] ?? 'neutral'] = hash;
  }
  const body = Object.entries(list)
    .map(([id, v]) => `  ${id}: { ${Object.entries(v).map(([k, h]) => `${k}: '${h}'`).join(', ')} },`)
    .join('\n');
  writeFileSync(
    LIST_FILE,
    `// Written by scripts/portraits.mjs (npm run portraits): the residents' drawn portraits in public/portraits
// (docs/portrait-prompts.md), by place id, each with a hash of its file (a new picture is fetched again).
// Not edited by hand.

export const PORTRAIT_FILES: Readonly<Record<string, Partial<Record<string, string>>>> = {${body ? `\n${body}\n` : ''}};
`,
  );
  return list;
}

async function main() {
  const from = arg('from', join(ROOT, 'portraits-src'));
  if (process.argv.includes('--list-only')) {
    console.log(writeList());
    return;
  }
  if (!existsSync(from)) {
    console.error(`Chưa có thư mục ${from}. Bỏ ảnh vào đó (docs/portrait-prompts.md) rồi chạy lại.`);
    process.exit(1);
  }
  const jobs = [];
  const skipped = [];
  for (const f of readdirSync(from)) {
    const p = parseName(f);
    if (p) jobs.push({ file: join(from, f), ...p });
    else if (EXT.has(extname(f).toLowerCase())) skipped.push(f);
  }
  if (!jobs.length) {
    console.error(`Không thấy ảnh nào đặt tên đúng trong ${from} (ví dụ emma.png, emma-cuoi.png).`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const page = await openBrowser();
  try {
    await page.run(`window.__draw = ${DRAW}; true`);
    for (const j of jobs) {
      const src = `data:${MIME[extname(j.file).toLowerCase()]};base64,${readFileSync(j.file).toString('base64')}`;
      const out = await page.run(`window.__draw(${JSON.stringify(src)}, ${SIZE}, ${QUALITY})`);
      if (typeof out !== 'string' || !out.startsWith('data:image/webp')) throw new Error(`Không đổi được ${j.file}`);
      const name = `${j.id}${j.mood === 'neutral' ? '' : `-${j.mood}`}.webp`;
      const bytes = Buffer.from(out.split(',')[1], 'base64');
      writeFileSync(join(OUT_DIR, name), bytes);
      console.log(`  ${name}  ${(bytes.length / 1024).toFixed(0)} kB`);
    }
  } finally {
    await page.close();
  }
  const list = writeList();
  const done = Object.keys(list).length;
  console.log(`Xong: ${jobs.length} ảnh. Có ảnh vẽ: ${done}/13 người.`);
  if (skipped.length) console.log(`Bỏ qua (tên không khớp người nào): ${skipped.join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
