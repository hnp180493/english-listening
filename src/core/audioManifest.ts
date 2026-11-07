// The shipped Gemini clips (public/audio, or <portable folder>/audio): which (mode, text) has a file.
//
// public/audio/manifest.json is written by the generator together with the .mp3 files. Keys come from
// audioKey() (./audioKey), so the playback router finds a clip with nothing but the exact text it is about
// to speak. Served builds fetch the manifest once, lazily (first playback). The portable single-file build
// cannot fetch on file://, so scripts/build-portable.mjs inlines the manifest into the HTML as
// <script type="application/json" id="nna-audio-manifest">; the clips themselves still load from the
// "audio" folder next to the HTML through an <audio> element, which file:// allows.
//
// Served builds start loading the manifest at app start (preloadAudioManifest in main.tsx), else on the first playback.
//
// Every failure is quiet: no manifest, a broken one, a missing folder or file → the old routes play. A manifest that
// is absent (404, broken JSON, file:// without the inline copy) is remembered as empty for the session: no text has a
// clip. One that failed to load for a passing reason (network error, timeout, 5xx) is UNKNOWN, not empty: the router
// then assumes any text may have a clip and never pays for it (browser voice); it is asked for again after
// MANIFEST_RETRY_MS. A clip file that fails to load is skipped for CLIPS_RETRY_MS, and after STATIC_DISABLE_AFTER
// failures in a row (folder missing, network down) every clip is skipped for CLIPS_RETRY_MS, then tried again.

/** Id of the inline JSON element of the portable build (scripts/portableAudio.mjs uses the same id). */
export const AUDIO_MANIFEST_ELEMENT_ID = 'nna-audio-manifest';
/** Folder of the clips, relative to the page (public/audio → /audio/ in dev and dist). */
export const AUDIO_DIR = 'audio/';
/** URL of the manifest in served builds, relative to the page. */
export const AUDIO_MANIFEST_URL = AUDIO_DIR + 'manifest.json';
/**
 * The manifest fetch itself gives up after this long (it is ~370 KB: a slow phone network needs several seconds). A
 * playback does not wait that long: it waits MANIFEST_WAIT_MS (tts.ts) and plays the browser voice meanwhile.
 */
export const MANIFEST_TIMEOUT_MS = 30_000;
/** After a passing failure (network, timeout, 5xx) the manifest is asked for again after this long. */
export const MANIFEST_RETRY_MS = 30_000;
/** Clip files that fail to load in a row before every clip is skipped for CLIPS_RETRY_MS. */
export const STATIC_DISABLE_AFTER = 2;
/** A clip file that failed, or every clip after STATIC_DISABLE_AFTER failures in a row, is tried again after this long. */
export const CLIPS_RETRY_MS = 2 * 60_000;

/** key → file name (inside AUDIO_DIR). */
export type AudioManifest = ReadonlyMap<string, string>;

const FILE_RE = /^[A-Za-z0-9_-]{1,64}\.(?:mp3|m4a|aac|ogg|opus|wav)$/;
const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;

function fileOf(entry: unknown): string | null {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const e = entry as Record<string, unknown>;
    for (const f of ['f', 'file', 'path']) if (typeof e[f] === 'string') return e[f] as string;
  }
  return null;
}

function add(out: Map<string, string>, key: unknown, entry: unknown): void {
  const file = fileOf(entry);
  if (typeof key !== 'string' || !KEY_RE.test(key) || !file) return;
  const name = file.startsWith(AUDIO_DIR) ? file.slice(AUDIO_DIR.length) : file;
  if (FILE_RE.test(name)) out.set(key, name); // plain file names only: nothing outside the audio folder
}

/**
 * Reads a manifest in any of the shapes the generator may write: `{ clips: { key: "f.mp3" | { f } } }`,
 * `{ clips: [{ key, f }] }`, or a bare `{ key: "f.mp3" | { f } }` map. Unusable entries are skipped;
 * anything that is not a manifest gives an empty one. Never throws.
 */
export function parseAudioManifest(json: unknown): AudioManifest {
  const out = new Map<string, string>();
  try {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return out;
    const root = json as Record<string, unknown>;
    const clips = root.clips ?? root.files ?? root.items;
    if (Array.isArray(clips)) {
      for (const c of clips) if (c && typeof c === 'object') add(out, (c as Record<string, unknown>).key ?? (c as Record<string, unknown>).k, c);
    } else if (clips && typeof clips === 'object') {
      for (const [k, v] of Object.entries(clips)) add(out, k, v);
    } else {
      for (const [k, v] of Object.entries(root)) add(out, k, v);
    }
  } catch {
    out.clear();
  }
  return out;
}

/** URL of a clip file, relative to the page ("audio/<f>"). */
export function clipUrl(file: string): string {
  return AUDIO_DIR + file;
}

// ───────────────────────────────────────────── loading (once per session)

type Loader = () => Promise<unknown>;

let manifest: AudioManifest | null = null;
let loading: Promise<AudioManifest | null> | null = null;
/** After a passing failure: until this time the manifest is unknown (not asked for), then it is asked for again. */
let retryAt = 0;
let loaderOverride: Loader | null = null;
/** file → time until which it is skipped. */
const failedFiles = new Map<string, number>();
let failuresInRow = 0;
/** Every clip is skipped until this time (0 = clips on). */
let disabledUntil = 0;

/** The manifest inlined into the page (portable build), or undefined when there is none. */
function inlineManifest(): unknown {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return undefined;
  const el = document.getElementById(AUDIO_MANIFEST_ELEMENT_ID);
  if (!el?.textContent) return undefined;
  try {
    return JSON.parse(el.textContent) as unknown;
  } catch {
    return null; // broken inline copy: absent for good
  }
}

/**
 * Inline element, else fetch. Resolves with null when there is no manifest to be had (remembered); throws on a
 * passing failure (network, timeout, server error), which is retried later.
 */
async function defaultLoader(): Promise<unknown> {
  const inline = inlineManifest();
  if (inline !== undefined) return inline;
  if (typeof location !== 'undefined' && location.protocol === 'file:') return null; // file:// cannot fetch
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const res = await fetch(AUDIO_MANIFEST_URL, { signal: ctrl?.signal, cache: 'no-cache' });
    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    try {
      return (await res.json()) as unknown;
    } catch (e) {
      // cut off while the body was arriving (timeout, network): a passing failure, asked for again later
      if (ctrl?.signal.aborted || (e instanceof Error && (e.name === 'AbortError' || e.name === 'TypeError'))) throw e;
      return null; // not JSON: a broken manifest stays broken
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The manifest when it is known (loaded, or known to be absent: empty), else null: not loaded yet, or UNKNOWN after a
 * passing failure (see manifestUnavailable). Outside a page (tests, no `document`) and without a test loader it is
 * empty at once.
 */
export function peekAudioManifest(): AudioManifest | null {
  if (manifest) return manifest;
  if (!loaderOverride && typeof document === 'undefined') {
    manifest = new Map();
    return manifest;
  }
  return null;
}

/**
 * True while the manifest is unknown after a passing failure (network, timeout, 5xx) and not asked for again yet
 * (MANIFEST_RETRY_MS). Any text may have a clip then: playback must not pay for it, and need not wait either.
 */
export function manifestUnavailable(): boolean {
  return !manifest && retryAt > 0 && Date.now() < retryAt;
}

/**
 * Loads the manifest (inline element, else fetch), once per session when it loads or is absent (absent = empty).
 * Resolves with null when it is UNKNOWN: a passing failure (the loader throws) is not remembered, so a playback after
 * MANIFEST_RETRY_MS asks again; within that time it resolves null at once without asking.
 */
export function loadAudioManifest(): Promise<AudioManifest | null> {
  const known = peekAudioManifest();
  if (known) return Promise.resolve(known);
  if (manifestUnavailable()) return Promise.resolve(null);
  loading ??= (async () => {
    await undefined; // a loader that throws at once still lands in the catch below after `loading` is set
    try {
      const parsed = parseAudioManifest(await (loaderOverride ?? defaultLoader)());
      manifest = parsed;
      retryAt = 0;
      return parsed;
    } catch {
      retryAt = Date.now() + MANIFEST_RETRY_MS;
      return null;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Starts loading the manifest early (app start), so the first playback rarely waits for it. Never throws. */
export function preloadAudioManifest(): void {
  try {
    void loadAudioManifest();
  } catch {
    // optional
  }
}

/** True when the manifest lists a clip for this key (whether or not that file is playable right now). */
export function hasShippedClip(m: AudioManifest, key: string): boolean {
  return m.has(key);
}

/** File of the shipped clip for this key, unless clips are off for now or this file failed recently. */
export function clipFileFor(m: AudioManifest, key: string): string | null {
  if (clipsDisabled()) return null;
  const f = m.get(key);
  if (!f) return null;
  const until = failedFiles.get(f);
  if (until !== undefined) {
    if (Date.now() < until) return null;
    failedFiles.delete(f);
  }
  return f;
}

/**
 * A clip file did not load or play: skip it for CLIPS_RETRY_MS; STATIC_DISABLE_AFTER in a row → skip every clip for
 * CLIPS_RETRY_MS. Returns true when this failure turned the clips off.
 */
export function reportClipFailure(file: string): boolean {
  const now = Date.now();
  failedFiles.set(file, now + CLIPS_RETRY_MS);
  failuresInRow++;
  // after a pause the run is kept: one more failure turns the clips off again at once (the folder is still missing)
  if (failuresInRow >= STATIC_DISABLE_AFTER && !clipsDisabled()) {
    disabledUntil = now + CLIPS_RETRY_MS;
    return true;
  }
  return false;
}

/** A clip played: the folder is there, a later single failure is just that file. */
export function reportClipSuccess(): void {
  failuresInRow = 0;
}

/** True while every shipped clip is skipped after failures in a row (for CLIPS_RETRY_MS, then they are tried again). */
export function clipsDisabled(): boolean {
  return disabledUntil > 0 && Date.now() < disabledUntil;
}

/** Test hook: forget everything; `loader` replaces the inline/fetch loader (null = default). */
export function _resetAudioManifestForTests(loader: Loader | null = null): void {
  manifest = null;
  loading = null;
  retryAt = 0;
  loaderOverride = loader;
  failedFiles.clear();
  failuresInRow = 0;
  disabledUntil = 0;
}
