#!/usr/bin/env node
/**
 * A look at the app from a machine that cannot show it: screenshots from headless Microsoft Edge (or Chrome) over its
 * debugging protocol. Nothing is installed; a throwaway browser profile in the system's temp folder is deleted after.
 *
 * Made for the 3D town (docs/town.md §19 "Seeing the town"): an agent's own browser pane, and a remote session, have
 * no graphics card, so the town does not draw there. With `?r=soft` (dev builds only, three/webgl.ts wantsSoft) it
 * draws on the software renderer, a frame or two a second: enough for a picture, useless for judging motion.
 *
 *   npm run dev                      (in another terminal)
 *   node scripts/town-shot.mjs "http://localhost:5173/#/town?r=soft" out.png --wait 22000
 *   … --w 390 --h 844                a phone
 *   … --scheme dark                  the night town
 *   … --js2 "<expression>" --wait2 5000
 *        runs in the page after the first wait (awaited), then waits again before the picture. The dev build puts
 *        the engine on window.__town3d: e.g. window.__town3d.sim.placePlayer({ x: 34.5, y: 34.5 }, Math.PI)
 *   … "http://localhost:5173/#/town?r=soft&listen=thing:radio"   opens a listening scene's panel
 *
 * Prints the page's title, whether the 3D engine is up, what --js / --js2 returned, and console errors.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf('--' + n);
  return i >= 0 ? args[i + 1] : d;
};
const [url, out] = args;
const W = +opt('w', 1400);
const H = +opt('h', 900);
const WAIT = +opt('wait', 2500);
const JS = opt('js', '');
const JS2 = opt('js2', '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
if (!exe) throw new Error('no Edge / Chrome');
const profile = mkdtempSync(join(tmpdir(), 'nna-shot-'));
const port = 9800 + Math.floor(Math.random() * 150);
const proc = spawn(
  exe,
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', '--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', `--window-size=${W},${H}`, '--hide-scrollbars', '--mute-audio', 'about:blank'],
  { stdio: 'ignore' },
);
let ws;
try {
  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
    } catch {
      // not up yet
    }
    if (!wsUrl) await sleep(150);
  }
  if (!wsUrl) throw new Error('browser did not start');
  ws = new WebSocket(wsUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let n = 0;
  const waiting = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 400));
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
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: opt('scheme', 'light') }] });
  await send('Page.navigate', { url });
  await sleep(1500);
  if (JS) console.log('js:', JSON.stringify(await run(JS)));
  await sleep(WAIT);
  if (JS2) {
    console.log('js2:', JSON.stringify(await run(JS2)));
    await sleep(+opt('wait2', 1200));
  }
  const info = await run(`(() => { const e = window.__town3d; const c = document.querySelector('canvas'); const gl = c && (c.getContext('webgl2')); return { engine: !!e, canvas: !!c, title: document.title, text: document.body.innerText.slice(0, 160) }; })()`);
  console.log('page:', JSON.stringify(info));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved', out);
  if (logs.length) console.log('console:\n' + logs.slice(0, 12).join('\n'));
  try {
    await send('Browser.close');
  } catch {
    // gone
  }
} finally {
  try {
    ws?.close();
  } catch {
    // closed
  }
  proc.kill();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 });
  } catch {
    // Windows still holds it
  }
}
