/* Nghe Nối Âm — service worker (offline support).
 * - Navigations: network-first, falling back to the cached app shell (index.html).
 * - Same-origin build assets under /assets/ (hashed file names): cache-first. Hashed pictures (the town's WebP
 *   atlases, several MB that most visits never need) are not precached: they go to their own cache (ART_CACHE) the
 *   first time a page draws them, and that cache survives deploys (a picture's name changes only with its content),
 *   keeping only the pictures of the current build.
 * - Shipped Gemini clips /audio/*.mp3 (file names are content keys, src/core/audioKey.ts): cache-first in their
 *   own cache, on first play only (never precached: there are hundreds), at most AUDIO_MAX_ENTRIES, the least
 *   recently played dropped first (a clip served from the cache moves to the end). That cache survives deploys,
 *   but its name comes from the manifest's generatedAt (else styleVersion / version): clips regenerated under the
 *   same key (re-encoded, remade) are fetched again after the new manifest is seen, and the older clip cache is
 *   dropped. A Range request (Safari asks for media in ranges and refuses a plain 200 from a service worker) gets
 *   a 206 cut from the whole stored file.
 *   /audio/manifest.json: network-first with a short timeout (AUDIO_MANIFEST_NETWORK_TIMEOUT_MS: a stalled network
 *   answers from the cache instead of hanging; the network copy still lands in the cache), kept in its own small
 *   cache (not the per-deploy cache), so an offline session after an update still finds the clips it stored.
 * - Other same-origin GETs (icons, manifest): network-first with cache fallback.
 * - Cross-origin requests (YouTube, fonts, speech services…) are never touched or cached.
 *
 * The app is code-split: index.html only references the entry JS/CSS, every page except Home is a
 * lazy chunk. So the build (swBuildManifest plugin in vite.config.ts) stamps BUILD below with every
 * emitted /assets/ file and an id derived from their hashed names:
 * - install precaches all of them except the pictures (BUILD.art), so every page works offline after the first
 *   visit, even pages never opened online (Thị trấn needs one online visit for its pictures); a file an earlier
 *   deploy already stored is copied from that cache instead of being downloaded again;
 * - the cache name includes the build id, so each deploy gets a fresh cache and activate drops the
 *   previous deploy's cache (no stale bundles pile up).
 * Unstamped (dev / a copy of this file outside a build), it falls back to the files index.html
 * references; lazy chunks are then cached at runtime by the /assets/ cache-first rule as pages are
 * visited, and an offline visit to a page never opened shows PageBoundary's "chưa tải được" card.
 * Bump VERSION when this file's caching logic changes.
 */
// @build-manifest-start (replaced at build time — keep these markers)
const BUILD = { id: '', assets: [], art: [] };
// @build-manifest-end
const VERSION = 'v1.5.0';
const CACHE_PREFIX = 'nghe-noi-am-';
const CACHE = CACHE_PREFIX + VERSION + (BUILD.id ? '-' + BUILD.id : '');
/** The manifest (and the name of the clip cache it maps to). */
const AUDIO_META_CACHE = CACHE_PREFIX + 'audio-meta';
/** Clip caches: AUDIO_CLIPS_PREFIX + a tag from the manifest (audioCacheNameFor). */
const AUDIO_CLIPS_PREFIX = CACHE_PREFIX + 'audio-c-';
/** Hashed pictures of the build, stored on first use, across deploys (see the header). */
const ART_CACHE = CACHE_PREFIX + 'art';
const ART_FILE_RE = /\.(?:webp|png|jpe?g|avif|gif)$/i;
/** The single clip cache of earlier versions (manifest + clips), migrated on activate. */
const LEGACY_AUDIO_CACHE = CACHE_PREFIX + 'audio-v1';
const AUDIO_MAX_ENTRIES = 400;
/** The manifest is asked from the network first; past this, a cached copy answers (the fetch keeps going into the cache). */
const AUDIO_MANIFEST_NETWORK_TIMEOUT_MS = 3000;
/** A clip played again within this time is not moved again (Safari asks for one clip in several ranges). */
const AUDIO_TOUCH_MIN_MS = 60_000;
const AUDIO_FILE_RE = /\.(?:mp3|m4a|aac|ogg|opus|wav)$/i;
const AUDIO_MANIFEST_NAME = 'manifest.json';

const SCOPE_URL = new URL(self.registration.scope);
const SHELL_URL = new URL('./', SCOPE_URL).href; // index.html served at the scope root
const ASSETS_PATH = new URL('./assets/', SCOPE_URL).pathname;
const AUDIO_PATH = new URL('./audio/', SCOPE_URL).pathname;
const AUDIO_MANIFEST_URL = new URL('./audio/' + AUDIO_MANIFEST_NAME, SCOPE_URL).href;
/** Synthetic entry of AUDIO_META_CACHE: the clip cache name of the current manifest. */
const AUDIO_TAG_URL = new URL('./audio/__clip-cache-name', SCOPE_URL).href;
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

/**
 * Put one hashed build file into the new cache: copied from any older cache that has it (the same name means the
 * same content), else downloaded.
 */
async function storeAsset(cache, url) {
  const old = await caches.match(url);
  if (old) return cache.put(url, old);
  return cache.add(url);
}

/** Drop stored pictures this build no longer has (only when the build is stamped: else the list is unknown). */
async function pruneArt() {
  if (!BUILD.id) return;
  const keep = new Set((BUILD.art || []).map((a) => new URL(a, SCOPE_URL).href));
  const cache = await caches.open(ART_CACHE);
  const reqs = await cache.keys();
  await Promise.all(reqs.filter((r) => !keep.has(r.url)).map((r) => cache.delete(r)));
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
                await Promise.all(assets.map((a) => storeAsset(cache, a).catch(() => undefined)));
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
      await migrateLegacyAudio().catch(() => undefined);
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE && k !== AUDIO_META_CACHE && k !== ART_CACHE && !k.startsWith(AUDIO_CLIPS_PREFIX))
          .map((k) => caches.delete(k)),
      );
      await pruneArt().catch(() => undefined);
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

async function cacheFirst(request, cacheName = CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => undefined);
  return res;
}

/**
 * Name of the clip cache for a manifest: its generatedAt, else styleVersion / version. A regenerated manifest gets a
 * fresh clip cache, so a clip remade under the same key is not served stale forever.
 */
function audioCacheNameFor(manifest) {
  let tag = '';
  if (manifest && typeof manifest === 'object') {
    const v = manifest.generatedAt ?? manifest.styleVersion ?? manifest.version;
    if (v !== undefined && v !== null) tag = String(v);
  }
  return AUDIO_CLIPS_PREFIX + (tag.replace(/[^A-Za-z0-9]/g, '').slice(0, 40) || 'none');
}

let audioCacheName = null;

/** The clip cache of the manifest seen last (remembered in AUDIO_META_CACHE across worker restarts). */
async function currentAudioCache() {
  if (!audioCacheName) {
    const meta = await caches.open(AUDIO_META_CACHE);
    const stored = await meta.match(AUDIO_TAG_URL);
    const name = stored ? (await stored.text()).trim() : '';
    audioCacheName = name.startsWith(AUDIO_CLIPS_PREFIX) ? name : audioCacheNameFor(null);
  }
  return caches.open(audioCacheName);
}

/** A manifest came from the network: switch to its clip cache and drop the clip caches of older manifests. */
async function adoptManifest(res) {
  let json = null;
  try {
    json = await res.json();
  } catch {
    return;
  }
  const name = audioCacheNameFor(json);
  const meta = await caches.open(AUDIO_META_CACHE);
  await meta.put(AUDIO_TAG_URL, new Response(name, { headers: { 'Content-Type': 'text/plain' } }));
  audioCacheName = name;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(AUDIO_CLIPS_PREFIX) && k !== name).map((k) => caches.delete(k)));
}

/** Earlier versions kept the manifest and the clips in one cache: move them to the new caches once. */
async function migrateLegacyAudio() {
  const keys = await caches.keys();
  if (!keys.includes(LEGACY_AUDIO_CACHE)) return;
  const old = await caches.open(LEGACY_AUDIO_CACHE);
  const meta = await caches.open(AUDIO_META_CACHE);
  const manifest = await old.match(AUDIO_MANIFEST_URL);
  if (manifest && !(await meta.match(AUDIO_MANIFEST_URL))) {
    const forTag = manifest.clone();
    await meta.put(AUDIO_MANIFEST_URL, manifest);
    await adoptManifest(forTag);
  }
  const target = await currentAudioCache();
  for (const r of await old.keys()) {
    if (!AUDIO_FILE_RE.test(new URL(r.url).pathname)) continue;
    const res = await old.match(r.url);
    if (res) await target.put(r.url, res);
  }
  await caches.delete(LEGACY_AUDIO_CACHE);
}

/** url → when it was last moved to the end of the clip cache (least recently used goes first). */
const audioTouched = new Map();

/** A clip served from the cache moves to the end of its list (Cache.put of an existing key re-appends it). */
async function touchAudio(cache, url, res) {
  const now = Date.now();
  const last = audioTouched.get(url);
  if (last !== undefined && now - last < AUDIO_TOUCH_MIN_MS) return;
  audioTouched.set(url, now);
  if (audioTouched.size > AUDIO_MAX_ENTRIES * 2) audioTouched.clear();
  await cache.put(url, res);
}

/** Drops the least recently used clips beyond AUDIO_MAX_ENTRIES (cache.keys() lists them oldest first). */
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
  const cache = await currentAudioCache();
  const cached = await cache.match(event.request.url);
  if (cached) {
    event.waitUntil(touchAudio(cache, event.request.url, cached.clone()).catch(() => undefined));
    return rangeAware(event.request, cached);
  }
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

/**
 * The clip manifest: network-first, kept in AUDIO_META_CACHE so it outlives the per-deploy cache. A network that has
 * not answered within AUDIO_MANIFEST_NETWORK_TIMEOUT_MS (stalled, very slow) or fails gets the cached copy instead;
 * the fetch still finishes into the cache. Without a cached copy it waits for the network.
 */
async function audioManifestNetworkFirst(event) {
  const { request } = event;
  const meta = await caches.open(AUDIO_META_CACHE);
  let storing = Promise.resolve();
  const network = fetch(request).then((res) => {
    if (res.ok && res.status === 200 && res.type === 'basic') {
      const forCache = res.clone();
      const forTag = res.clone();
      storing = (async () => {
        await meta.put(AUDIO_MANIFEST_URL, forCache);
        await adoptManifest(forTag);
      })().catch(() => undefined);
    }
    return res;
  });
  event.waitUntil(network.then(() => storing, () => undefined));
  const cached = await meta.match(AUDIO_MANIFEST_URL);
  if (!cached) return network;
  return new Promise((resolve) => {
    let settled = false;
    const answer = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };
    const timer = setTimeout(() => answer(cached), AUDIO_MANIFEST_NETWORK_TIMEOUT_MS);
    network.then(
      // a server error gets the cached copy; a 404 / 410 (no clips any more) is passed on as it is
      (res) => answer(res.ok || res.status === 404 || res.status === 410 ? res : cached),
      () => answer(cached),
    );
  });
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
    event.respondWith(cacheFirst(request, ART_FILE_RE.test(url.pathname) ? ART_CACHE : CACHE));
  } else if (url.pathname.startsWith(AUDIO_PATH) && AUDIO_FILE_RE.test(url.pathname)) {
    event.respondWith(audioCacheFirst(event));
  } else if (url.pathname === AUDIO_PATH + AUDIO_MANIFEST_NAME) {
    event.respondWith(audioManifestNetworkFirst(event));
  } else if (url.pathname === new URL('./sw.js', SCOPE_URL).pathname) {
    // let the browser handle its own update checks
  } else {
    event.respondWith(networkFirst(request));
  }
});
