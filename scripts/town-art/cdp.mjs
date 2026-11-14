// A tiny Chrome DevTools Protocol client for the town-art renderer: launch a headless Edge / Chrome with a
// throwaway profile, open one page, evaluate code in it. Node 22+ (global WebSocket); no dependency.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.TOWN_ART_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

export function findBrowser() {
  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error('No Edge / Chrome found. Set TOWN_ART_BROWSER to the browser executable.');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Launch the browser headless; resolves to { send, evaluate, navigate, close }. */
export async function launch({ width = 1200, height = 900 } = {}) {
  const profile = await mkdtemp(join(tmpdir(), 'town-art-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(
    findBrowser(),
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--ignore-gpu-blocklist',
      '--disable-accelerated-2d-canvas',
      '--enable-unsafe-swiftshader',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let target = null;
  for (let i = 0; i < 100 && !target; i++) {
    await sleep(150);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page') ?? null;
    } catch {
      /* not up yet */
    }
  }
  if (!target) {
    proc.kill();
    throw new Error('The browser did not open its DevTools port.');
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable');
  await send('Page.enable');
  listeners.add((m) => {
    if (m.method === 'Runtime.consoleAPICalled') {
      const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      console.log(`  [page] ${text}`);
    } else if (m.method === 'Runtime.exceptionThrown') {
      console.error('  [page error]', m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    }
  });

  let crashed = null;
  await send('Inspector.enable');
  listeners.add((m) => {
    if (m.method === 'Inspector.targetCrashed') crashed = 'the render page crashed';
    if (crashed) for (const { reject } of pending.values()) reject(new Error(crashed));
  });

  /** Evaluate an expression (a promise is awaited); returns its JSON value. Fails after `timeoutMs`. */
  async function evaluate(expression, timeoutMs = 180000) {
    if (crashed) throw new Error(crashed);
    let timer;
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error(`no answer from the render page after ${timeoutMs / 1000} s: ${expression.slice(0, 60)}…`)), timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    return r.result.value;
  }

  /**
   * Evaluate an expression whose value is a long string (an encoded image) and fetch it in pieces: one DevTools
   * message of several MB never arrives.
   */
  async function evaluateString(expression, piece = 1 << 20) {
    const n = await evaluate(`(async () => { window.__big = String(await (${expression})); return window.__big.length; })()`);
    let out = '';
    for (let i = 0; i < n; i += piece) out += await evaluate(`window.__big.slice(${i}, ${i + piece})`);
    await evaluate('window.__big = null');
    return out;
  }

  async function navigate(url) {
    const loaded = new Promise((res) => {
      const l = (m) => {
        if (m.method === 'Page.loadEventFired') {
          listeners.delete(l);
          res();
        }
      };
      listeners.add(l);
    });
    await send('Page.navigate', { url });
    await loaded;
  }

  async function close() {
    // the browser may exit before it answers
    await Promise.race([send('Browser.close').catch(() => undefined), sleep(1500)]);
    ws.close();
    proc.kill();
    await sleep(300);
    await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  }

  return { send, evaluate, evaluateString, navigate, close };
}
