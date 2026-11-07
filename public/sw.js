/* Nghe Nối Âm — service worker (offline support).
 * - Navigations: network-first, falling back to the cached app shell (index.html).
 * - Same-origin build assets under /assets/ (hashed file names): cache-first.
 * - Other same-origin GETs (icons, manifest): network-first with cache fallback.
 * - Cross-origin requests (YouTube, fonts, speech services…) are never touched or cached.
 *
 * The app is code-split: index.html only references the entry JS/CSS, every page except Home is a
 * lazy chunk. So the build (swBuildManifest plugin in vite.config.ts) stamps BUILD below with every
 * emitted /assets/ file and an id derived from their hashed names:
 * - install precaches all of them, so every page works offline after the first visit, even pages
 *   never opened online;
 * - the cache name includes the build id, so each deploy gets a fresh cache and activate drops the
 *   previous deploy's cache (no stale bundles pile up).
 * Unstamped (dev / a copy of this file outside a build), it falls back to the files index.html
 * references; lazy chunks are then cached at runtime by the /assets/ cache-first rule as pages are
 * visited, and an offline visit to a page never opened shows PageBoundary's "chưa tải được" card.
 * Bump VERSION when this file's caching logic changes.
 */
// @build-manifest-start (replaced at build time — keep these markers)
const BUILD = { id: '', assets: [] };
// @build-manifest-end
const VERSION = 'v1.1.0';
const CACHE_PREFIX = 'nghe-noi-am-';
const CACHE = CACHE_PREFIX + VERSION + (BUILD.id ? '-' + BUILD.id : '');

const SCOPE_URL = new URL(self.registration.scope);
const SHELL_URL = new URL('./', SCOPE_URL).href; // index.html served at the scope root
const ASSETS_PATH = new URL('./assets/', SCOPE_URL).pathname;
const PRECACHE = ['./', './manifest.webmanifest', './icon.svg', './icon-maskable.svg'].map((p) => new URL(p, SCOPE_URL).href);

/** Hashed build files referenced by index.html, so the app works offline after the first visit. */
async function shellAssets(html) {
  const urls = new Set();
  const re = /(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const u = new URL(m[1], SCOPE_URL);
    if (u.origin === SCOPE_URL.origin && u.pathname.startsWith(ASSETS_PATH)) urls.add(u.href);
  }
  return [...urls];
}

/** Every /assets/ file of this build: the stamped list, plus whatever the shell references. */
async function buildAssets(html) {
  const urls = new Set(await shellAssets(html));
  for (const a of BUILD.assets) urls.add(new URL(a, SCOPE_URL).href);
  return [...urls];
}

/**
 * Drop cached /assets/ files that this build does not contain (an older deploy's bundles stored in
 * this same cache). Only when the build is stamped: without the list, lazy chunks cached at runtime
 * are not referenced by index.html and would be wrongly deleted.
 */
async function pruneAssets(cache, html) {
  if (!BUILD.id) return;
  const keep = new Set(await buildAssets(html));
  const reqs = await cache.keys();
  await Promise.all(
    reqs.filter((r) => new URL(r.url).pathname.startsWith(ASSETS_PATH) && !keep.has(r.url)).map((r) => cache.delete(r)),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then(async (res) => {
              if (!res.ok) return;
              if (url === SHELL_URL) {
                const html = await res.clone().text();
                const assets = await buildAssets(html);
                await Promise.all(assets.map((a) => cache.add(a).catch(() => undefined)));
                await cache.put(url, res);
                await pruneAssets(cache, html);
                return;
              }
              await cache.put(url, res);
            })
            .catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** Only the app page itself may replace the cached shell (not e.g. /manifest.webmanifest opened in a tab). */
function isShellResponse(request, res) {
  if (!res.ok || res.type !== 'basic') return false;
  if (!(res.headers.get('Content-Type') || '').includes('text/html')) return false;
  const path = new URL(request.url).pathname;
  return path === SCOPE_URL.pathname || path === new URL('./index.html', SCOPE_URL).pathname;
}

async function networkFirstNavigation(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (isShellResponse(request, res)) {
      const copy = res.clone();
      // Keep the worker alive until the shell is stored and stale hashed assets are pruned.
      event.waitUntil(
        (async () => {
          const html = await copy.clone().text();
          await cache.put(SHELL_URL, copy);
          await pruneAssets(cache, html);
        })().catch(() => undefined),
      );
    }
    return res;
  } catch {
    const cached = (await cache.match(SHELL_URL)) || (await cache.match(request, { ignoreSearch: true }));
    if (cached) return cached;
    return new Response(
      '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ngoại tuyến · Nghe Nối Âm</title><body style="font-family:system-ui,sans-serif;padding:24px;max-width:520px;margin:auto"><h1>Bạn đang ngoại tuyến</h1><p>Hãy kết nối mạng và tải lại trang. Sau lần mở đầu tiên, Nghe Nối Âm sẽ dùng được cả khi không có mạng.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => undefined);
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => undefined);
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache cross-origin (YouTube, etc.)
  if (!url.href.startsWith(SCOPE_URL.href)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event));
  } else if (url.pathname.startsWith(ASSETS_PATH)) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname === new URL('./sw.js', SCOPE_URL).pathname) {
    // let the browser handle its own update checks
  } else {
    event.respondWith(networkFirst(request));
  }
});
