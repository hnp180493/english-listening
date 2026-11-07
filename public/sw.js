/* Nghe Nối Âm — service worker (offline support).
 * - Navigations: network-first, falling back to the cached app shell (index.html).
 * - Same-origin build assets under /assets/ (hashed file names): cache-first.
 * - Shipped Gemini clips /audio/*.mp3 (file names are content keys, src/core/audioKey.ts): cache-first in their
 *   own cache, on first play only (never precached: there are hundreds), at most AUDIO_MAX_ENTRIES (oldest
 *   dropped). That cache survives deploys: a key names one text, voice and style for good. A Range request
 *   (Safari asks for media in ranges and refuses a plain 200 from a service worker) gets a 206 cut from the
 *   whole stored file.
 *   /audio/manifest.json: network-first, kept in that same audio cache (not the per-deploy cache), so an
 *   offline session after an update still finds the clips it already stored.
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
const VERSION = 'v1.3.0';
const CACHE_PREFIX = 'nghe-noi-am-';
const CACHE = CACHE_PREFIX + VERSION + (BUILD.id ? '-' + BUILD.id : '');
const AUDIO_CACHE = CACHE_PREFIX + 'audio-v1';
const AUDIO_MAX_ENTRIES = 400;
const AUDIO_FILE_RE = /\.(?:mp3|m4a|aac|ogg|opus|wav)$/i;
const AUDIO_MANIFEST_NAME = 'manifest.json';

const SCOPE_URL = new URL(self.registration.scope);
const SHELL_URL = new URL('./', SCOPE_URL).href; // index.html served at the scope root
const ASSETS_PATH = new URL('./assets/', SCOPE_URL).pathname;
const AUDIO_PATH = new URL('./audio/', SCOPE_URL).pathname;
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
      await Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE && k !== AUDIO_CACHE).map((k) => caches.delete(k)),
      );
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

/** Drops the oldest clips beyond AUDIO_MAX_ENTRIES (cache.keys() lists them in insertion order; the manifest never counts). */
async function trimAudio(cache) {
  const reqs = (await cache.keys()).filter((r) => AUDIO_FILE_RE.test(new URL(r.url).pathname));
  const extra = reqs.length - AUDIO_MAX_ENTRIES;
  if (extra > 0) await Promise.all(reqs.slice(0, extra).map((r) => cache.delete(r)));
}

/**
 * The byte range a "Range: bytes=…" header asks for in a body of `size` bytes: { start, end } (end inclusive),
 * null when it is not one usable range (answer with the whole file), or 'unsatisfiable' (answer 416).
 */
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    const suffix = Number(m[2]); // "bytes=-500": the last 500 bytes
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || end < start) return 'unsatisfiable';
  return { start, end };
}

/**
 * Answers a media request from a whole clip: a 206 with the asked-for bytes when the request carries a Range
 * header (Safari plays media from a service worker only that way), else the whole 200 as it is.
 */
async function rangeAware(request, full) {
  const header = request.headers.get('range');
  if (!header) return full;
  const blob = await full.blob();
  const type = full.headers.get('Content-Type') || 'audio/mpeg';
  const r = parseRange(header, blob.size);
  if (r === null) {
    return new Response(blob, { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(blob.size), 'Accept-Ranges': 'bytes' } });
  }
  if (r === 'unsatisfiable') return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + blob.size } });
  return new Response(blob.slice(r.start, r.end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': type,
      'Content-Length': String(r.end - r.start + 1),
      'Content-Range': 'bytes ' + r.start + '-' + r.end + '/' + blob.size,
      'Accept-Ranges': 'bytes',
    },
  });
}

/**
 * A shipped clip: from the audio cache, else fetched whole (no Range header: a 206 cannot be cached) and stored
 * for next time. Either way a Range request gets a 206 cut from the whole file (rangeAware).
 */
async function audioCacheFirst(event) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(event.request.url);
  if (cached) return rangeAware(event.request, cached);
  const res = await fetch(event.request.url, { credentials: 'same-origin' });
  if (res.ok && res.status === 200 && res.type === 'basic') {
    const copy = res.clone();
    event.waitUntil(
      cache
        .put(event.request.url, copy)
        .then(() => trimAudio(cache))
        .catch(() => undefined),
    );
    return rangeAware(event.request, res);
  }
  return res;
}

/** The clip manifest: network-first, kept in the audio cache so it outlives the per-deploy cache. */
async function audioManifestNetworkFirst(request) {
  const cache = await caches.open(AUDIO_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') await cache.put(request.url, res.clone()).catch(() => undefined);
    return res;
  } catch (err) {
    const cached = await cache.match(request.url);
    if (cached) return cached;
    throw err;
  }
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
  } else if (url.pathname.startsWith(AUDIO_PATH) && AUDIO_FILE_RE.test(url.pathname)) {
    event.respondWith(audioCacheFirst(event));
  } else if (url.pathname === AUDIO_PATH + AUDIO_MANIFEST_NAME) {
    event.respondWith(audioManifestNetworkFirst(request));
  } else if (url.pathname === new URL('./sw.js', SCOPE_URL).pathname) {
    // let the browser handle its own update checks
  } else {
    event.respondWith(networkFirst(request));
  }
});
