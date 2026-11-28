// A smoke test of the BUILT app (2026-11-28: the town broke on the deployed site and not in the dev server: two chunks
// imported each other and the avatars' code ran before chars/anim.ts; "Cannot read properties of undefined (reading
// 'hips')"). Run it after `npm run build`, before handing work back:
//
//   npm run smoke                      (builds nothing: checks dist/ as it is)
//   node scripts/smoke-build.mjs --port 4179 --dist dist
//
// 1. The chunks of dist/assets must not import each other in a circle (static imports only): a circle lets a chunk
//    run before one it needs, which only a production build shows.
// 2. `vite preview` serves dist/; headless Edge (as scripts/town-shot.mjs) opens, with the admin sandbox on, the home
//    page, Ôn tập, the town and Westbay on the software renderer, and the admin sheets that dress people in a VRoid
//    avatar and a Quaternius body (`?clips`, `?quat`). It fails on an uncaught error, a console TypeError /
//    ReferenceError / SyntaxError, a failed script fetch, or the page's error card (PageBoundary, "Trang này đang gặp
//    sự cố"). A town page must show its 3D stage, or its list without 3D on a machine without a graphics card (a
//    production build ignores `?r=soft`). Over the run at least one .vrm file and one Quaternius body
//    (models/people-quat-*.glb) must have been loaded, which is when the `vrm` chunk runs.
// Exit code 0 = green, 1 = red (what failed is printed).

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf('--' + n);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = opt('dist', 'dist');
const PORT = +opt('port', 4179);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];

// ── 1. chunk circles ──
function chunkCircles(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const graph = new Map();
  for (const f of files) {
    const code = readFileSync(join(dir, f), 'utf8');
    const deps = new Set();
    for (const m of code.matchAll(/(?:^|[;\n}])\s*import\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)) deps.add(m[1]);
    graph.set(f, [...deps]);
  }
  const name = (f) => f.replace(/-[A-Za-z0-9_-]{8}\.js$/, '');
  const state = new Map();
  const stack = [];
  const found = new Set();
  const visit = (u) => {
    state.set(u, 1);
    stack.push(u);
    for (const v of graph.get(u) ?? []) {
      if (state.get(v) === 1) found.add([...stack.slice(stack.indexOf(v)), v].map(name).join(' -> '));
      else if (!state.has(v)) visit(v);
    }
    stack.pop();
    state.set(u, 2);
  };
  for (const f of files) if (!state.has(f)) visit(f);
  return [...found];
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`no ${DIST}/index.html: run npm run build first`);
  process.exit(1);
}
const circles = chunkCircles(join(DIST, 'assets'));
for (const c of circles) problems.push('chunks import each other: ' + c);
console.log(circles.length ? `chunk circles: ${circles.length}` : 'chunk circles: none');

// ── 2. the pages in a browser ──
const ADMIN_HASH = '#/duyet-k7q2m9x4';
const PAGES = [
  { hash: '#/', wait: 6000 },
  { hash: '#/review', wait: 6000 },
  { hash: '#/town?r=soft', wait: 45000, canvas: true },
  { hash: '#/town?at=city&r=soft', wait: 45000, canvas: true },
  { hash: ADMIN_HASH + '?clips', wait: 30000 },
  { hash: ADMIN_HASH + '?quat', wait: 30000 },
];

const preview = spawn(process.execPath, [join('node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort', '--outDir', DIST], { stdio: 'ignore' });
const base = `http://localhost:${PORT}/`;
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try {
    up = (await fetch(base)).ok;
  } catch {
    // not yet
  }
  if (!up) await sleep(500);
}
if (!up) {
  preview.kill();
  console.error('vite preview did not start on port ' + PORT);
  process.exit(1);
}

const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
if (!exe) {
  preview.kill();
  console.error('no Edge / Chrome');
  process.exit(1);
}
const profile = mkdtempSync(join(tmpdir(), 'nna-smoke-'));
const cdp = 9300 + Math.floor(Math.random() * 400);
const browser = spawn(exe, ['--headless=new', `--remote-debugging-port=${cdp}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', '--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--window-size=1400,900', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });

let ws;
const loaded = { vrm: 0, quat: 0 };
try {
  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try {
      wsUrl = (await (await fetch(`http://127.0.0.1:${cdp}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
    } catch {
      // not up yet
    }
    if (!wsUrl) await sleep(150);
  }
  if (!wsUrl) throw new Error('browser did not start');
  ws = new WebSocket(wsUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let n = 0;
  const waiting = new Map();
  let errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push('uncaught: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (/TypeError|ReferenceError|SyntaxError|fetching the script|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(text)) errors.push('console: ' + text.slice(0, 300));
    }
    if (m.method === 'Network.responseReceived') {
      const url = m.params.response.url;
      if (/\/vrm\/[^/]+\.vrm/.test(url) && m.params.response.status === 200) loaded.vrm++;
      if (/models\/people-quat-[mf]\.glb/.test(url) && m.params.response.status === 200) loaded.quat++;
    }
    if (m.method === 'Network.loadingFailed' && m.params.type === 'Script' && !m.params.canceled) errors.push('script failed: ' + m.params.errorText);
    const w = waiting.get(m.id);
    if (!w) return;
    waiting.delete(m.id);
    if (m.error) w.reject(new Error(m.error.message));
    else w.resolve(m.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++n;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const run = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Page.navigate', { url: base });
  await sleep(2500);
  // the admin sandbox: everything open (core/admin.ts reads the flag when the app starts)
  await run(`localStorage.setItem('nghe-noi-am-device:admin', '1'); true`);
  for (const page of PAGES) {
    errors = [];
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(300);
    await send('Page.navigate', { url: base + page.hash });
    const until = Date.now() + page.wait;
    let state = { card: false, canvas: false, flat: false };
    while (Date.now() < until) {
      await sleep(1500);
      state = await run(`({ card: !!document.querySelector('.shell-error-title'), canvas: !!document.querySelector('canvas'), flat: !!document.querySelector('.town-flat') })`).catch(() => state);
      if (state.card) break;
    }
    const where = page.hash;
    if (state.card) problems.push(`${where}: the error card shows`);
    // (a production build draws no world on a software renderer: `?r=soft` is a dev switch; the town then lists its
    // people instead, PageBoundary's card would show if it had broken)
    if (page.canvas && !state.card && !state.canvas && !state.flat) problems.push(`${where}: neither the 3D stage nor the list without 3D`);
    for (const e of errors) problems.push(`${where}: ${e}`);
    console.log(`${where}: ${state.card ? 'ERROR CARD' : 'ok'}${page.canvas ? (state.canvas ? ' (3D)' : state.flat ? ' (no 3D on this machine: the list)' : '') : ''}${errors.length ? `, ${errors.length} error(s)` : ''}`);
  }
  if (loaded.vrm === 0) problems.push('no .vrm avatar was loaded in the run');
  if (loaded.quat === 0) problems.push('no Quaternius body (models/people-quat-*.glb) was loaded in the run');
  console.log(`loaded: ${loaded.vrm} .vrm, ${loaded.quat} Quaternius bodies`);
} catch (e) {
  problems.push('the run itself failed: ' + e.message);
} finally {
  try {
    ws?.close();
  } catch {
    // closed
  }
  browser.kill();
  preview.kill();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 });
  } catch {
    // Windows still holds it
  }
}

if (problems.length) {
  console.log('\nRED:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('\nGREEN');
