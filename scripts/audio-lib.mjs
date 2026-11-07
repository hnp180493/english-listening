/**
 * Helpers for the shipped-audio tooling (scripts/audio-inventory.mjs, scripts/generate-audio.mjs; docs/audio.md):
 * loading the app's TypeScript modules through Vite's module runner, WAV/PCM parsing, MP3 encoding (pure JS,
 * @breezystack/lamejs: no ffmpeg needed) and MP3 frame scanning for validation, the manifest, a request limiter,
 * and key redaction. Node 24, ESM. Nothing here ever prints or stores an API key.
 */
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Mp3Encoder } from '@breezystack/lamejs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** Where clips and manifest.json go (served as /audio/ by Vite, copied next to the portable HTML). */
export const DEFAULT_OUT_DIR = join(ROOT, 'public', 'audio')
/** Generator state (inventory.json, generate.log, failed.json, batches.json). Not shipped. */
export const DEFAULT_WORK_DIR = join(ROOT, '.audio-gen')
export const MANIFEST_VERSION = 1
/** MP3 bitrate (MPEG-2 Layer III at 24 kHz mono): 40 kbps is clean for one voice, ~5 kB per second of speech. */
export const DEFAULT_KBPS = 40
/** Allowed MPEG-2 Layer III bitrates at 24 kHz. */
export const MPEG2_KBPS = [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]

/** True when the module with this import.meta.url is the script node was started with. */
export function isMain(metaUrl) {
  return !!process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === metaUrl
}

// ───────────────────────────────────────────── app modules (TypeScript) through Vite

let runnerImportFn = null

/** Imports one of the app's TS modules (e.g. '/src/core/audioInventory.ts') with Vite's module runner. No server, no port. */
export async function importApp(id) {
  if (!runnerImportFn) ({ runnerImport: runnerImportFn } = await import('vite'))
  const { module } = await runnerImportFn(id, { configFile: false, root: ROOT, logLevel: 'error', server: { hmr: false, ws: false } })
  return module
}

let appModules = null

/** The app modules the generator needs, loaded once per process. */
export function loadAppModules() {
  appModules ??= loadAppModulesNow()
  return appModules
}

async function loadAppModulesNow() {
  const [inventory, key, wav, defaults, gemini, client] = await Promise.all([
    importApp('/src/core/audioInventory.ts'),
    importApp('/src/core/audioKey.ts'),
    importApp('/src/core/ai/wav.ts'),
    importApp('/src/core/ai/defaults.ts'),
    importApp('/src/core/ai/providers/gemini.ts'),
    importApp('/src/core/ai/client.ts'),
  ])
  return { inventory, key, wav, defaults, gemini, client }
}

// ───────────────────────────────────────────── secrets

/** Replaces every occurrence of `secret` (and anything that looks like a Google key) in a string. */
export function redact(text, secret) {
  let s = String(text ?? '')
  if (secret && secret.length >= 6) s = s.split(secret).join('[key]')
  return s.replace(/AIza[0-9A-Za-z_-]{35,}/g, '[key]').replace(/AQ\.[0-9A-Za-z_-]{20,}/g, '[key]')
}

/**
 * The Gemini base URL to use: the official one, or an override that points at this machine only (a local mock
 * server). Any other override is refused, so the key can never be sent to an unexpected host.
 */
export function resolveBaseUrl(override, official) {
  const raw = (override ?? '').trim()
  if (!raw) return official.replace(/\/+$/, '')
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new Error(`GEMINI_BASE_URL không hợp lệ: ${raw}`)
  }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)
  const officialHost = new URL(official).hostname
  if (!(local && (u.protocol === 'http:' || u.protocol === 'https:')) && !(u.protocol === 'https:' && u.hostname === officialHost)) {
    throw new Error(`GEMINI_BASE_URL chỉ được trỏ tới ${officialHost} hoặc máy này (127.0.0.1 / localhost), không phải ${u.hostname}`)
  }
  return raw.replace(/\/+$/, '')
}

// ───────────────────────────────────────────── PCM / WAV

/** PCM 16-bit little-endian bytes → Int16Array (copy, so the alignment is right). */
export function pcm16(bytes) {
  const n = Math.floor(bytes.length / 2)
  const out = new Int16Array(n)
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i < n; i++) out[i] = v.getInt16(i * 2, true)
  return out
}

/** Reads a PCM WAV: { sampleRate, channels, bitsPerSample, data (Uint8Array of the data chunk) } or null. */
export function parseWav(bytes) {
  if (bytes.length < 12) return null
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let fmt = null
  let off = 12
  while (off + 8 <= bytes.length) {
    const id = tag(off)
    const size = v.getUint32(off + 4, true)
    const body = off + 8
    if (id === 'fmt ' && body + 16 <= bytes.length) {
      fmt = { format: v.getUint16(body, true), channels: v.getUint16(body + 2, true), sampleRate: v.getUint32(body + 4, true), bitsPerSample: v.getUint16(body + 14, true) }
    } else if (id === 'data' && fmt) {
      const len = size === 0 || size === 0xffffffff || body + size > bytes.length ? bytes.length - body : size
      return { ...fmt, data: bytes.subarray(body, body + len) }
    }
    off = body + size + (size % 2)
  }
  return null
}

/** Mono 16-bit samples from interleaved PCM (channels averaged). */
export function toMono(samples, channels) {
  if (channels <= 1) return samples
  const n = Math.floor(samples.length / channels)
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let c = 0; c < channels; c++) s += samples[i * channels + c]
    out[i] = Math.round(s / channels)
  }
  return out
}

/**
 * Cuts leading/trailing near-silence (|sample| < threshold), keeping `padMs` of it on each side so a soft first
 * or last consonant is never clipped. Returns the samples unchanged when the clip is all silence.
 */
export function trimSilence(samples, sampleRate, { threshold = 300, padMs = 120 } = {}) {
  let a = 0
  let b = samples.length - 1
  while (a <= b && Math.abs(samples[a]) < threshold) a++
  while (b >= a && Math.abs(samples[b]) < threshold) b--
  if (a > b) return samples
  const pad = Math.round((padMs / 1000) * sampleRate)
  return samples.subarray(Math.max(0, a - pad), Math.min(samples.length, b + 1 + pad))
}

// ───────────────────────────────────────────── MP3

/** Encodes mono 16-bit samples to a CBR MP3 (MPEG-2 Layer III at 24 kHz). */
export function encodeMp3(samples, sampleRate, kbps = DEFAULT_KBPS) {
  const enc = new Mp3Encoder(1, sampleRate, kbps)
  const parts = []
  const BLOCK = 1152
  for (let i = 0; i < samples.length; i += BLOCK) {
    const b = enc.encodeBuffer(samples.subarray(i, i + BLOCK))
    if (b.length) parts.push(Uint8Array.from(b))
  }
  const tail = enc.flush()
  if (tail.length) parts.push(Uint8Array.from(tail))
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG-1 Layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG-2 / 2.5 Layer III
}
const SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }

/** Parses the MPEG audio frame header at `off` (Layer III only), or null. */
export function mp3FrameAt(bytes, off) {
  if (off + 4 > bytes.length) return null
  const b1 = bytes[off + 1]
  const b2 = bytes[off + 2]
  if (bytes[off] !== 0xff || (b1 & 0xe0) !== 0xe0) return null
  const ver = (b1 >> 3) & 3 // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5, 1 reserved
  const layer = (b1 >> 1) & 3 // 1 = Layer III
  if (ver === 1 || layer !== 1) return null
  const brIdx = b2 >> 4
  const srIdx = (b2 >> 2) & 3
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null
  const kbps = BITRATES[ver === 3 ? 1 : 2][brIdx]
  const sampleRate = SAMPLE_RATES[ver][srIdx]
  const padding = (b2 >> 1) & 1
  const samples = ver === 3 ? 1152 : 576
  const length = Math.floor(((samples / 8) * kbps * 1000) / sampleRate) + padding
  return { kbps, sampleRate, samples, length, mpeg: ver === 3 ? 1 : ver === 2 ? 2 : 2.5 }
}

/**
 * Walks an MP3 frame by frame. Valid = starts with a frame sync (after an optional ID3v2 tag), every frame
 * header chains to the next, and the walk ends at the end of the file (an ID3v1 tag allowed).
 * Returns { ok, frames, durationMs, sampleRate, kbps, error? }.
 */
export function scanMp3(bytes) {
  let off = 0
  if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    off = 10 + ((bytes[6] & 0x7f) << 21) + ((bytes[7] & 0x7f) << 14) + ((bytes[8] & 0x7f) << 7) + (bytes[9] & 0x7f)
  }
  let frames = 0
  let samples = 0
  let first = null
  while (off < bytes.length) {
    const f = mp3FrameAt(bytes, off)
    if (!f) {
      const rest = bytes.length - off
      if (rest === 128 && bytes[off] === 0x54 && bytes[off + 1] === 0x41 && bytes[off + 2] === 0x47) break // ID3v1 "TAG"
      return { ok: false, frames, durationMs: 0, error: `không có frame MP3 ở byte ${off}` }
    }
    if (!first) first = f
    else if (f.sampleRate !== first.sampleRate) return { ok: false, frames, durationMs: 0, error: 'sample rate đổi giữa chừng' }
    if (off + f.length > bytes.length) return { ok: false, frames, durationMs: 0, error: 'frame cuối bị cụt' }
    frames++
    samples += f.samples
    off += f.length
  }
  if (!first || frames === 0) return { ok: false, frames: 0, durationMs: 0, error: 'không có frame MP3' }
  return { ok: true, frames, durationMs: Math.round((samples / first.sampleRate) * 1000), sampleRate: first.sampleRate, kbps: first.kbps }
}

// ───────────────────────────────────────────── estimates

const words = (s) => s.split(/\s+/).filter(Boolean).length

/** Rough clip length without audio: ~0.4 s per word plus ~0.3 s of edges (calibrated later from real clips). */
export function estimateSeconds(text, mode) {
  return words(text) * (mode === 'careful' ? 0.5 : 0.38) + 0.3
}

/** Bytes of an MP3 of `seconds` at `kbps` (CBR). */
export function mp3Bytes(seconds, kbps) {
  return Math.round((seconds * kbps * 1000) / 8)
}

/**
 * Plausible duration for a clip of `text` (on top of the app's clipProblem lower bound): a run-away generation
 * (long silence, repeated words) lasts far longer than the words need.
 */
export function tooLong(seconds, text) {
  return seconds > 4 + 1.2 * words(text)
}

export function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} kB`
  return `${n} B`
}

export function formatDuration(sec) {
  if (sec < 90) return `${Math.round(sec)} giây`
  if (sec < 5400) return `${Math.round(sec / 60)} phút`
  return `${(sec / 3600).toFixed(1)} giờ`
}

// ───────────────────────────────────────────── files

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

/** A temp name next to `path`, unique per call: two writes of one file in one process never share it. */
let tmpSeq = 0
export function tmpNameFor(path) {
  return `${path}.${process.pid}.${++tmpSeq}.${Math.random().toString(36).slice(2, 8)}.tmp`
}

/** Writes JSON atomically (temp file + rename), so a crash never leaves half a manifest. */
export async function writeJsonAtomic(path, value, pretty = true) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = tmpNameFor(path)
  try {
    await writeFile(tmp, JSON.stringify(value, null, pretty ? 2 : 0) + '\n')
    await rename(tmp, path)
  } catch (e) {
    await unlink(tmp).catch(() => undefined)
    throw e
  }
}

export async function writeFileAtomic(path, bytes) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = tmpNameFor(path)
  try {
    await writeFile(tmp, bytes)
    await rename(tmp, path)
  } catch (e) {
    await unlink(tmp).catch(() => undefined)
    throw e
  }
}

// ───────────────────────────────────────────── rate limit

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export { sleep }

/**
 * Spaces request starts at least 60/rpm seconds apart, with at most `concurrency` in flight; pauseUntil() holds
 * every later start (a 429 with RetryInfo). acquire() resolves with a release function.
 */
export function createLimiter({ rpm, concurrency = 2, now = () => Date.now() }) {
  const gap = 60_000 / Math.max(0.1, rpm)
  let nextStart = 0
  let inFlight = 0
  let pausedUntil = 0
  const waiters = []
  const pump = async () => {
    // one waiter at a time decides its start time
    while (waiters.length && inFlight < concurrency) {
      const w = waiters.shift()
      inFlight++
      const t = Math.max(nextStart, pausedUntil, now())
      nextStart = t + gap
      const wait = t - now()
      if (wait > 0) await sleep(wait)
      // a pause set while sleeping moves this start too
      while (pausedUntil > now()) await sleep(pausedUntil - now())
      w(() => {
        inFlight--
        void pump()
      })
    }
  }
  return {
    acquire() {
      return new Promise((resolveAcquire) => {
        waiters.push(resolveAcquire)
        void pump()
      })
    },
    pauseUntil(t) {
      pausedUntil = Math.max(pausedUntil, t)
      nextStart = Math.max(nextStart, t)
    },
    get gapMs() {
      return gap
    },
  }
}

// ───────────────────────────────────────────── Gemini error details

/** RetryInfo.retryDelay ("37s", "1.5s") of a google.rpc error body, in ms. */
export function retryDelayMs(body) {
  const details = body?.error?.details
  if (!Array.isArray(details)) return undefined
  for (const d of details) {
    const m = typeof d?.retryDelay === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(d.retryDelay.trim()) : null
    if (m) return Math.round(Number(m[1]) * 1000)
  }
  return undefined
}

/** QuotaFailure quotaIds of a google.rpc error body. */
export function quotaIds(body) {
  const out = []
  for (const d of body?.error?.details ?? []) for (const v of d?.violations ?? []) if (typeof v?.quotaId === 'string') out.push(v.quotaId)
  return out
}

/** Retry-After header (seconds or HTTP date) in ms. */
export function retryAfterMs(headers) {
  const v = headers?.get?.('retry-after')
  if (!v) return undefined
  const s = Number(v)
  if (Number.isFinite(s)) return Math.max(0, s * 1000)
  const t = Date.parse(v)
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : undefined
}
