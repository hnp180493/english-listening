#!/usr/bin/env node
/**
 * Generates the shipped Gemini clips ONCE: every clip in the audio inventory (src/core/audioInventory.ts) that is
 * not in public/audio yet is spoken by Gemini TTS (model + voice Kore from src/core/ai/defaults.ts, the request
 * body from the app's own buildGeminiTtsBody, style per mode from src/core/playback.ts), checked, trimmed of
 * edge silence, encoded to MP3 (pure JS, no ffmpeg) and listed in public/audio/manifest.json. docs/audio.md.
 *
 *   GEMINI_API_KEY=… npm run audio:generate                      batch API (default; half price, no per-minute limit)
 *   GEMINI_API_KEY=… npm run audio:generate -- --mode sequential  one request at a time, ≤ --rpm per minute
 *   npm run audio:generate -- --dry-run                           counts, estimated time and size; no key needed
 *
 * Options: --limit N · --only dictation,lesson,… (clip sources) · --part main,careful,plain,… · --rpm 10 ·
 *   --concurrency 2 · --batch-size 50 · --poll 30 (seconds) · --kbps 40 · --no-trim · --no-fallback ·
 *   --no-keep-wav · --skip-browser-only · --prune · --model <id> · --out <dir> · --work <dir> · --inventory <file.json>
 *
 * Resumable: clips already in --out that are valid MP3s are kept; batch jobs already submitted are remembered in
 * <work>/batches.json (written BEFORE each create call) and collected instead of paid for twice. A create call with
 * no clear answer (timeout, 5xx) is never retried blindly: the job is looked up by its display name. A finished job
 * whose results cannot be read stays in batches.json for the next run. Only clips a readable job returned with an
 * error (or bad audio) are retried one by one at full price (--no-fallback: never). Progress goes to
 * <work>/generate.log, clips that failed twice to <work>/failed.json.
 * The key is read from GEMINI_API_KEY only, sent only in the x-goog-api-key header, and never printed or written.
 * GEMINI_BASE_URL may point at a local mock server (127.0.0.1 / localhost) for tests; any other host is refused.
 *
 * Exit codes: 0 done · 1 error · 2 daily quota reached (run again tomorrow) · 3 some clips failed ·
 *   4 batch jobs still pending or unreadable (run again later; nothing is paid twice).
 */
import { appendFile, mkdir, readdir, readFile, unlink } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import {
  DEFAULT_KBPS,
  DEFAULT_OUT_DIR,
  DEFAULT_WORK_DIR,
  MANIFEST_VERSION,
  MPEG2_KBPS,
  createLimiter,
  encodeMp3,
  estimateSeconds,
  formatBytes,
  formatDuration,
  isMain,
  loadAppModules,
  mp3Bytes,
  parseWav,
  pcm16,
  quotaIds,
  readJson,
  redact,
  resolveBaseUrl,
  retryAfterMs,
  retryDelayMs,
  scanMp3,
  sleep,
  toMono,
  tooLong,
  trimSilence,
  writeFileAtomic,
  writeJsonAtomic,
} from './audio-lib.mjs'

/** Most useful clips first, so --limit (or a run cut short) covers the main buttons before segments. */
const PART_ORDER = ['main', 'careful', 'plain', 'annotation', 'step', 'segment', 'chunk']
const REQUEST_TIMEOUT_MS = 90_000
/** Polling a finished inline batch returns all of its audio as base64 in one body (tens of MB): give it time. */
const POLL_TIMEOUT_MS = 10 * 60_000
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000
/** Pages of GET /batches read when looking for a job whose create call got no clear answer. */
const LIST_MAX_PAGES = 20
const MAX_RATE_RETRIES = 12
const MAX_SERVER_RETRIES = 4
const MANIFEST_FLUSH_EVERY = 10

class DailyQuotaError extends Error {}
class FatalError extends Error {}

// ───────────────────────────────────────────── args

export function parseArgs(argv) {
  const o = {
    mode: 'batch',
    limit: Infinity,
    only: null,
    part: null,
    dryRun: false,
    rpm: 10,
    concurrency: 2,
    batchSize: 50,
    pollSec: 30,
    kbps: DEFAULT_KBPS,
    trim: true,
    keepWav: true,
    fallback: true,
    includeBrowserOnly: true,
    prune: false,
    model: null,
    out: DEFAULT_OUT_DIR,
    work: DEFAULT_WORK_DIR,
    inventory: null,
    maxWaitHours: 48,
  }
  const val = (i, a) => {
    const v = argv[i]
    if (v === undefined || v.startsWith('--')) throw new Error(`Thiếu giá trị sau ${a}`)
    return v
  }
  const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--mode': o.mode = val(++i, a); break
      case '--sequential': o.mode = 'sequential'; break
      case '--limit': o.limit = Number(val(++i, a)); break
      case '--only': o.only = list(val(++i, a)); break
      case '--part': o.part = list(val(++i, a)); break
      case '--dry-run': o.dryRun = true; break
      case '--rpm': o.rpm = Number(val(++i, a)); break
      case '--concurrency': o.concurrency = Number(val(++i, a)); break
      case '--batch-size': o.batchSize = Number(val(++i, a)); break
      case '--poll': o.pollSec = Number(val(++i, a)); break
      case '--kbps': o.kbps = Number(val(++i, a)); break
      case '--no-trim': o.trim = false; break
      case '--no-keep-wav': o.keepWav = false; break
      case '--no-fallback': o.fallback = false; break
      case '--include-browser-only': o.includeBrowserOnly = true; break
      case '--skip-browser-only': o.includeBrowserOnly = false; break
      case '--prune': o.prune = true; break
      case '--model': o.model = val(++i, a); break
      case '--out': o.out = val(++i, a); break
      case '--work': o.work = val(++i, a); break
      case '--inventory': o.inventory = val(++i, a); break
      case '--max-wait-hours': o.maxWaitHours = Number(val(++i, a)); break
      default: throw new Error(`Tham số không hợp lệ: ${a} (xem đầu file scripts/generate-audio.mjs)`)
    }
  }
  if (o.mode !== 'batch' && o.mode !== 'sequential') throw new Error('--mode phải là batch hoặc sequential')
  if (!(o.limit > 0)) throw new Error('--limit phải > 0')
  if (!(o.rpm > 0) || !(o.concurrency >= 1) || !(o.batchSize >= 1) || !(o.pollSec > 0)) throw new Error('--rpm/--concurrency/--batch-size/--poll phải > 0')
  if (!MPEG2_KBPS.includes(o.kbps)) throw new Error(`--kbps phải là một trong ${MPEG2_KBPS.join(', ')}`)
  const abs = (p) => (isAbsolute(p) ? p : resolve(process.cwd(), p))
  o.out = abs(o.out)
  o.work = abs(o.work)
  if (o.inventory) o.inventory = abs(o.inventory)
  return o
}

// ───────────────────────────────────────────── generator

export async function run(argv, env = process.env) {
  const opts = parseArgs(argv)
  const app = await loadAppModules()
  const apiKey = (env.GEMINI_API_KEY ?? '').trim()
  await mkdir(opts.work, { recursive: true })
  const logFile = join(opts.work, 'generate.log')
  const log = async (msg) => {
    const line = redact(msg, apiKey)
    console.log(line)
    await appendFile(logFile, `${new Date().toISOString()} ${line}\n`).catch(() => undefined)
  }

  const g = app.defaults.PROVIDER_DEFAULTS.gemini
  const model = app.gemini.geminiModelId(opts.model || g.ttsModel)
  const voiceName = g.ttsVoice
  if (opts.model && opts.model !== g.ttsModel) await log(`Chú ý: --model ${model} khác mặc định ${g.ttsModel}.`)

  // inventory: the current one (built from the TS sources) or a JSON file; every key re-checked with audioKey
  const inv = opts.inventory ? await readJson(opts.inventory, null) : app.inventory.buildAudioInventory()
  if (!inv || !Array.isArray(inv.clips)) throw new Error(`Không đọc được inventory ${opts.inventory ?? ''}`)
  if (inv.voice && inv.voice !== app.key.AUDIO_VOICE) throw new Error(`Inventory cho giọng ${inv.voice}, app dùng ${app.key.AUDIO_VOICE}`)
  const all = new Map()
  for (const c of inv.clips) {
    if (app.key.audioKey(c.mode, c.text) !== c.key) throw new Error(`Inventory cũ: key ${c.key} không khớp "${c.text}" (chạy lại npm run audio:inventory)`)
    all.set(c.key, { ...c, style: app.inventory.styleForMode(c.mode) })
  }
  const wanted = [...all.values()].filter((c) => opts.includeBrowserOnly || !c.browserOnly)

  // what is already there (valid MP3 named <key>.mp3); the manifest is rebuilt from the files
  if (!opts.dryRun) {
    await mkdir(opts.out, { recursive: true })
    // temp files of an earlier run that was cut short mid-write (never shipped: Vite would copy them into dist)
    const removed = (await removeTempFiles(opts.out)) + (await removeTempFiles(opts.work)) + (await removeTempFiles(join(opts.work, 'wav')))
    if (removed) await log(`Xóa ${removed} file tạm còn sót từ lần chạy trước.`)
  }
  const manifestPath = join(opts.out, 'manifest.json')
  const old = await readJson(manifestPath, null)
  const oldClips = old && typeof old.clips === 'object' && old.clips ? old.clips : {}
  const files = new Set((await readdir(opts.out).catch(() => [])).filter((f) => f.endsWith('.mp3')))
  const clips = {}
  let presentBytes = 0
  let presentEst = 0
  const stale = []
  for (const f of files) {
    const key = f.slice(0, -4)
    const c = all.get(key)
    if (!c) {
      stale.push(f)
      continue
    }
    const bytes = new Uint8Array(await readFile(join(opts.out, f)))
    const scan = scanMp3(bytes)
    if (!scan.ok) {
      await log(`Bỏ file hỏng ${f}: ${scan.error}`)
      continue
    }
    const d = Number.isFinite(oldClips[key]?.d) ? oldClips[key].d : scan.durationMs
    clips[key] = { f, d, src: c.source }
    presentBytes += bytes.length
    presentEst += estimateSeconds(c.text, c.mode)
  }
  if (stale.length) {
    if (opts.prune && !opts.dryRun) {
      for (const f of stale) await unlink(join(opts.out, f)).catch(() => undefined)
      await log(`Đã xóa ${stale.length} clip không còn trong inventory (--prune).`)
    } else {
      await log(`${stale.length} file .mp3 không còn trong inventory (không đưa vào manifest; --prune để xóa).`)
    }
  }

  let missing = wanted.filter((c) => !clips[c.key])
  if (opts.only) missing = missing.filter((c) => (c.sources ?? [c.source]).some((s) => opts.only.includes(s)))
  if (opts.part) missing = missing.filter((c) => opts.part.includes(c.part))
  missing.sort((a, b) => PART_ORDER.indexOf(a.part) - PART_ORDER.indexOf(b.part))
  if (Number.isFinite(opts.limit)) missing = missing.slice(0, opts.limit)

  // one manifest write at a time (workers, the final flush and Ctrl+C may ask together)
  let manifestChain = Promise.resolve()
  const writeManifest = () => {
    manifestChain = manifestChain.catch(() => undefined).then(writeManifestNow)
    return manifestChain
  }
  const writeManifestNow = async () => {
    const sorted = Object.fromEntries(Object.keys(clips).sort().map((k) => [k, clips[k]]))
    await writeJsonAtomic(
      manifestPath,
      {
        version: MANIFEST_VERSION,
        voice: app.key.AUDIO_VOICE,
        styleVersion: app.key.AUDIO_STYLE_VERSION,
        model,
        voiceName,
        format: { codec: 'mp3', kbps: opts.kbps, sampleRate: 24000, channels: 1 },
        generatedAt: new Date().toISOString(),
        clips: sorted,
      },
      false,
    )
  }

  const wavDir = join(opts.work, 'wav')
  const failedPath = join(opts.work, 'failed.json')
  const failed = await readJson(failedPath, {})
  for (const k of Object.keys(failed)) if (clips[k] || !all.has(k)) delete failed[k]
  let sinceFlush = 0
  let made = 0
  const stats = { requests: 0, rateLimited: 0, serverErrors: 0, invalid: 0 }

  /** Decodes, checks, trims and encodes one clip; saves it on success. Returns null or the problem. */
  const accept = async (clip, inline) => {
    const problem = await saveAudio(app, opts, clip, inline, async (mp3, d, wavBytes) => {
      await writeFileAtomic(join(opts.out, `${clip.key}.mp3`), mp3)
      // the raw clip is kept (not shipped): a later re-encode (bitrate, trim) costs no request
      if (opts.keepWav && !inline.bytes) await writeFileAtomic(join(wavDir, `${clip.key}.wav`), wavBytes)
      clips[clip.key] = { f: `${clip.key}.mp3`, d, src: clip.source }
      delete failed[clip.key]
      made++
      if (++sinceFlush >= MANIFEST_FLUSH_EVERY) {
        sinceFlush = 0
        await writeManifest()
      }
    })
    if (problem) stats.invalid++
    return problem
  }

  // clips whose raw WAV was kept by an earlier run: re-encoded without any request
  const keptWav = new Set((await readdir(wavDir).catch(() => [])).filter((f) => f.endsWith('.wav')).map((f) => f.slice(0, -4)))
  const reusable = missing.filter((c) => keptWav.has(c.key))

  // ── summary / dry run
  const estSec = missing.reduce((s, c) => s + estimateSeconds(c.text, c.mode), 0)
  const perEstSec = Object.keys(clips).length >= 10 && presentEst > 0 ? presentBytes / presentEst : null
  const estBytes = perEstSec ? Math.round(estSec * perEstSec) : mp3Bytes(estSec, opts.kbps)
  const chars = missing.reduce((n, c) => n + c.text.length, 0)
  await log(
    `Inventory ${all.size} clip (${wanted.length} cần đóng gói${opts.includeBrowserOnly ? '' : `, bỏ ${all.size - wanted.length} browserOnly`}); ` +
      `đã có ${Object.keys(clips).length} (${formatBytes(presentBytes)}); còn tạo ${missing.length} clip, ${chars} ký tự` +
      (reusable.length ? ` (${reusable.length} mã hóa lại từ WAV đã giữ, không gọi API).` : '.'),
  )
  await log(
    `Ước lượng: ~${formatDuration(estSec)} âm thanh, ~${formatBytes(estBytes)} MP3 ${opts.kbps} kbps` +
      (perEstSec ? ' (theo các clip đã có)' : ' (chưa có clip thật để so)') +
      `; tuần tự ở ${opts.rpm} yêu cầu/phút: ~${formatDuration((missing.length * 60) / opts.rpm)}; ` +
      `batch: ${Math.ceil(missing.length / opts.batchSize)} job × ${opts.batchSize}, Google hẹn ≤ 24 giờ (thường nhanh hơn), nửa giá.`,
  )
  if (opts.dryRun) {
    const by = {}
    for (const c of missing) by[c.source] = (by[c.source] ?? 0) + 1
    await log(`Còn tạo theo nguồn: ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ') || 'không có'}`)
    return 0
  }
  if (reusable.length) {
    let n = 0
    for (const c of reusable) {
      const problem = await accept(c, { bytes: new Uint8Array(await readFile(join(wavDir, `${c.key}.wav`))) })
      if (problem) await log(`  WAV giữ lại của ${c.key} không dùng được: ${problem}`)
      else n++
    }
    missing = missing.filter((c) => !clips[c.key])
    await log(`Mã hóa lại ${n} clip từ WAV đã giữ (không gọi API).`)
  }
  if (missing.length === 0) {
    await writeManifest()
    await log('Không còn clip nào cần tạo.')
    return 0
  }
  if (!apiKey) throw new FatalError('Thiếu GEMINI_API_KEY trong biến môi trường (không bao giờ ghi key vào file).')
  const baseUrl = resolveBaseUrl(env.GEMINI_BASE_URL, g.baseUrl)
  await writeManifest()
  const limiter = createLimiter({ rpm: opts.rpm, concurrency: opts.concurrency })
  /**
   * One HTTP call through the limiter, with RetryInfo-aware waits on 429 and backoff on 5xx / network errors.
   * `retry: false` (a call that is not idempotent: creating a batch job) returns a network error, timeout or 5xx at
   * once as { __error, status, ambiguous: true }: the server may have acted on it. A 429 is always safe to retry.
   */
  const call = async (method, url, body, { retry = true, timeoutMs = REQUEST_TIMEOUT_MS } = {}) => {
    let rate = 0
    let server = 0
    for (;;) {
      const release = await limiter.acquire()
      let res
      let json
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        stats.requests++
        res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: ctrl.signal,
        })
        const text = await res.text()
        try {
          json = text ? JSON.parse(text) : {}
        } catch {
          json = { raw: text.slice(0, 300) }
        }
      } catch (e) {
        res = null
        json = { error: { message: e?.name === 'AbortError' ? 'hết thời gian chờ' : String(e?.message ?? e) } }
      } finally {
        clearTimeout(timer)
        release()
      }
      if (res && res.ok) return json
      const status = res?.status ?? 0
      const msg = redact(json?.error?.message ?? json?.raw ?? '', apiKey)
      if (status === 429 || json?.error?.status === 'RESOURCE_EXHAUSTED') {
        stats.rateLimited++
        if (app.gemini.geminiQuotaIsDaily(quotaIds(json), msg)) throw new DailyQuotaError(`Hết hạn mức trong ngày: ${msg}`)
        if (++rate > MAX_RATE_RETRIES) return { __error: `429 quá nhiều lần: ${msg}`, status }
        const wait = retryAfterMs(res?.headers) ?? retryDelayMs(json) ?? Math.min(60_000, 5_000 * 2 ** (rate - 1))
        await log(`429 (giới hạn mỗi phút), đợi ${(wait / 1000).toFixed(1)} giây rồi thử lại.`)
        limiter.pauseUntil(Date.now() + wait + 250)
        continue
      }
      if (status === 0 || status >= 500) {
        stats.serverErrors++
        if (!retry) return { __error: `lỗi máy chủ/mạng ${status}: ${msg}`, status, ambiguous: true }
        if (++server > MAX_SERVER_RETRIES) return { __error: `lỗi máy chủ/mạng ${status}: ${msg}`, status }
        await sleep(Math.min(30_000, 2_000 * 2 ** (server - 1)))
        continue
      }
      const reasons = (json?.error?.details ?? []).map((d) => d?.reason).filter(Boolean)
      if (status === 401 || status === 403 || reasons.includes('API_KEY_INVALID')) throw new FatalError(`Key bị từ chối (${status}): ${msg}`)
      return { __error: `${status}: ${msg}`, status }
    }
  }

  const ttsUrl = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`
  const requestFor = (clip) => app.gemini.buildGeminiTtsBody(model, voiceName, { text: clip.text, style: clip.style })

  /** Sequential: each clip at most twice (a bad clip is asked for again once), then recorded as failed. */
  const sequential = async (list) => {
    await log(`Tạo tuần tự ${list.length} clip (${opts.rpm} yêu cầu/phút, ${opts.concurrency} song song).`)
    const queue = [...list]
    let done = 0
    let halt = false // a fatal error / daily quota in one worker stops the others before their next clip
    const worker = async () => {
      try {
        await work()
      } catch (e) {
        halt = true
        throw e
      }
    }
    const work = async () => {
      for (let clip = queue.shift(); clip && !halt; clip = queue.shift()) {
        let problem = null
        for (let attempt = 1; attempt <= 2; attempt++) {
          const json = await call('POST', ttsUrl, requestFor(clip))
          if (json.__error) {
            problem = json.__error
            if (json.status === 404) throw new FatalError(`Model ${model} không có (404): ${problem}`)
            if (json.status === 400) break // the same request would fail again
            continue
          }
          problem = await accept(clip, firstInline(json))
          if (!problem) break
          await log(`  clip ${clip.key} lần ${attempt}: ${problem}`)
        }
        done++
        if (problem) {
          failed[clip.key] = { text: clip.text, mode: clip.mode, source: clip.source, error: problem, at: new Date().toISOString() }
          await log(`[${done}/${list.length}] LỖI ${clip.key} "${clip.text}": ${problem}`)
        } else {
          await log(`[${done}/${list.length}] ok ${clip.key} ${(clips[clip.key].d / 1000).toFixed(1)}s "${clip.text}"`)
        }
      }
    }
    // every worker finishes the clip it is on (paid for) before a fatal error / daily quota is reported
    const settled = await Promise.allSettled(Array.from({ length: Math.min(opts.concurrency, list.length) }, worker))
    const failure = settled.find((s) => s.status === 'rejected')
    if (failure) throw failure.reason
  }

  /**
   * Batch API: submit jobs of --batch-size, remember them, poll, collect. Returns { retry, waiting }: `retry` = clips
   * worth one direct (full-price) request now (a readable job returned them with an error or bad audio, or no job
   * could be created for them); `waiting` = clips in jobs still pending, unreadable or of unknown fate, which the next
   * run collects (never paid for again).
   */
  const batch = async (list) => {
    const statePath = join(opts.work, 'batches.json')
    const state = await readJson(statePath, { jobs: [] })
    if (!Array.isArray(state.jobs)) state.jobs = []
    const saveState = () => writeJsonAtomic(statePath, state)
    const retryKeys = new Set()
    /** Jobs that finished but whose results this run could not read: left for the next run. */
    const stuck = new Set()

    /** GET /batches, every page (bounded): null when the list cannot be read. */
    const listJobs = async () => {
      const out = []
      let token = ''
      for (let page = 0; page < LIST_MAX_PAGES; page++) {
        const res = await call('GET', `${baseUrl}/batches?pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`)
        if (res.__error) return null
        const items = res.operations ?? res.batches ?? []
        if (Array.isArray(items)) out.push(...items)
        token = typeof res.nextPageToken === 'string' ? res.nextPageToken : ''
        if (!token) break
      }
      return out
    }
    /** Fills in the name of a job whose create call got no clear answer, by its display name. */
    const adopt = async (job) => {
      const all = await listJobs()
      if (!all) return 'unknown'
      const hit = all.find((op) => batchDisplayName(op) === job.displayName)
      if (!hit || typeof hit.name !== 'string') return 'absent'
      job.name = hit.name
      delete job.submitting
      job.state = batchState(hit) || job.state
      await saveState()
      await log(`Tìm thấy batch job ${hit.name} (${job.displayName}) đã được tạo: lấy kết quả, không gửi lại.`)
      return 'found'
    }

    // jobs whose create call was cut short (Ctrl+C, timeout, 5xx) in an earlier run
    for (const job of state.jobs.filter((j) => j.submitting && !j.collected)) {
      const r = await adopt(job)
      if (r === 'absent') {
        state.jobs = state.jobs.filter((j) => j !== job)
        await saveState()
        await log(`Batch ${job.displayName} chưa từng được tạo: gửi lại các clip của nó.`)
      } else if (r === 'unknown') {
        await log(`Chưa kiểm tra được batch ${job.displayName} (không đọc được danh sách batch): để lần chạy sau, không gửi lại.`)
      }
    }

    const pending = new Set(state.jobs.filter((j) => !j.collected).flatMap((j) => j.clips.map((c) => c.key)))
    const toSubmit = list.filter((c) => !pending.has(c.key))
    if (pending.size) await log(`Còn ${state.jobs.filter((j) => !j.collected).length} batch job đã gửi trước đó: lấy kết quả, không gửi lại.`)
    const createUrl = `${baseUrl}/models/${encodeURIComponent(model)}:batchGenerateContent`
    for (let i = 0; i < toSubmit.length; i += opts.batchSize) {
      const part = toSubmit.slice(i, i + opts.batchSize)
      const displayName = `nna-audio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${i / opts.batchSize}`
      // recorded BEFORE the call: a run cut short during it finds the job again by this name
      const job = { name: null, displayName, submitting: true, createdAt: new Date().toISOString(), state: 'SUBMITTING', collected: false, clips: part.map((c) => ({ key: c.key, text: c.text, mode: c.mode })) }
      state.jobs.push(job)
      await saveState()
      const body = {
        batch: {
          display_name: displayName,
          input_config: { requests: { requests: part.map((c) => ({ request: requestFor(c), metadata: { key: c.key } })) } },
        },
      }
      const res = await call('POST', createUrl, body, { retry: false })
      if (!res.__error && typeof res.name === 'string') {
        job.name = res.name
        delete job.submitting
        job.state = batchState(res) || 'PENDING'
        await saveState()
        await log(`Đã gửi batch job ${res.name} (${part.length} clip).`)
        continue
      }
      if (res.ambiguous) {
        // the job may exist (and be billed): never resubmit blindly
        const r = await adopt(job)
        if (r === 'found') continue
        if (r === 'absent') {
          state.jobs = state.jobs.filter((j) => j !== job)
          await saveState()
          await log(`Tạo batch job không rõ kết quả (${res.__error}) và không thấy job nào tên ${displayName}: dừng gửi, chạy lại sau.`)
        } else {
          await log(
            `Tạo batch job không rõ kết quả (${res.__error}). Đã ghi ${displayName} vào batches.json; lần chạy sau sẽ tìm lại, không gửi lại. ` +
              'Có thể kiểm tra danh sách batch trong AI Studio.',
          )
        }
        break
      }
      // a clear refusal (4xx, or no job name): nothing was created
      state.jobs = state.jobs.filter((j) => j !== job)
      await saveState()
      await log(`Không tạo được batch job (${res.__error ?? 'không có name'}): các clip còn lại tạo từng cái${opts.fallback ? '' : ' (--no-fallback: bỏ qua)'}.`)
      for (const c of toSubmit.slice(i)) retryKeys.add(c.key)
      break
    }

    const deadline = Date.now() + opts.maxWaitHours * 3600_000
    for (;;) {
      const open = state.jobs.filter((j) => !j.collected && j.name && !stuck.has(j.name))
      if (open.length === 0) break
      for (const job of open) {
        const op = await call('GET', `${baseUrl}/${job.name}`, undefined, { timeoutMs: POLL_TIMEOUT_MS })
        if (op.__error) {
          await log(`Không đọc được ${job.name}: ${op.__error}`)
          if (op.status === 404) {
            job.collected = true
            job.state = 'NOT_FOUND'
            await saveState()
          }
          continue
        }
        const st = batchState(op)
        if (st !== job.state) await log(`${job.name}: ${st || '?'}`)
        job.state = st
        if (/SUCCEEDED$/.test(st)) {
          let entries = inlinedResponses(op)
          if (!entries) {
            const file = responsesFile(op)
            entries = file ? await downloadResults(baseUrl, file, apiKey) : null
          }
          const jobKeys = new Set(job.clips.map((c) => c.key))
          const keyOf = (e, i) => e?.metadata?.key ?? e?.key ?? job.clips[i]?.key
          if (!entries || !entries.some((e, i) => jobKeys.has(keyOf(e, i)))) {
            // finished and paid for, but nothing readable: keep it for the next run (fix the parser, run again)
            stuck.add(job.name)
            await saveState()
            await log(
              `${job.name} xong nhưng không đọc được kết quả (khóa: ${describeShape(op)}). Job vẫn ở batches.json; ` +
                'lần chạy sau lấy lại, không tạo lại các clip này.',
            )
            continue
          }
          let ok = 0
          for (let i = 0; i < entries.length; i++) {
            const e = entries[i]
            const key = keyOf(e, i)
            const clip = all.get(key)
            if (!clip || clips[key]) continue
            if (e?.error || !e?.response) {
              retryKeys.add(key)
              await log(`  ${job.name} ${key}: ${redact(e?.error?.message ?? 'không có response', apiKey)}`)
              continue
            }
            const problem = await accept(clip, firstInline(e.response))
            if (problem) {
              retryKeys.add(key)
              await log(`  ${job.name} ${key}: ${problem}`)
            } else ok++
          }
          // a clip of the job missing from its results counts like a per-request error
          for (const k of jobKeys) if (!clips[k] && all.has(k)) retryKeys.add(k)
          job.collected = true
          job.collectedAt = new Date().toISOString()
          await saveState()
          await writeManifest()
          await log(`${job.name}: lấy được ${ok}/${job.clips.length} clip.`)
        } else if (/(FAILED|CANCELLED|EXPIRED)$/.test(st) || op.error) {
          job.collected = true
          await saveState()
          await log(`${job.name} kết thúc không thành công (${st || redact(op.error?.message ?? '', apiKey)}): lần chạy sau gửi lại các clip này theo batch.`)
        }
      }
      if (state.jobs.every((j) => j.collected || !j.name || stuck.has(j.name))) break
      if (Date.now() > deadline) {
        await log(`Đã chờ quá ${opts.maxWaitHours} giờ; chạy lại lệnh này sau để lấy kết quả (các job vẫn được nhớ, không gửi lại).`)
        break
      }
      await sleep(opts.pollSec * 1000)
    }
    const waitingKeys = new Set(state.jobs.filter((j) => !j.collected).flatMap((j) => j.clips.map((c) => c.key)))
    return {
      retry: list.filter((c) => !clips[c.key] && retryKeys.has(c.key) && !waitingKeys.has(c.key)),
      waiting: list.filter((c) => !clips[c.key] && waitingKeys.has(c.key)).length,
    }
  }

  let stopping = false
  const onSigint = () => {
    if (stopping) process.exit(130)
    stopping = true
    void (async () => {
      await writeManifest().catch(() => undefined)
      await writeJsonAtomic(failedPath, failed).catch(() => undefined)
      await log('Dừng (Ctrl+C). Manifest đã lưu; chạy lại để tiếp tục.')
      process.exit(130)
    })()
  }
  process.on('SIGINT', onSigint)

  let code = 0
  let waiting = 0
  try {
    if (opts.mode === 'batch') {
      const { retry, waiting: w } = await batch(missing)
      waiting = w
      if (waiting) await log(`${waiting} clip đang chờ batch job (chưa xong hoặc chưa đọc được kết quả): chạy lại lệnh này sau để lấy, không trả tiền lại.`)
      if (retry.length && opts.fallback) {
        await log(`${retry.length} clip batch trả về lỗi: thử lại từng cái (giá thường, mỗi clip tối đa 2 lần).`)
        await sequential(retry)
      } else if (retry.length) {
        for (const c of retry) failed[c.key] ??= { text: c.text, mode: c.mode, source: c.source, error: 'batch không trả về clip hợp lệ', at: new Date().toISOString() }
      }
    } else {
      await sequential(missing)
    }
  } catch (e) {
    if (e instanceof DailyQuotaError) {
      await log(`${e.message}. Chạy lại vào ngày mai: các clip đã tạo được giữ lại.`)
      code = 2
    } else if (e instanceof FatalError) {
      await log(`Dừng: ${e.message}`)
      code = 1
    } else {
      throw e
    }
  } finally {
    process.off('SIGINT', onSigint)
    await writeManifest()
    await writeJsonAtomic(failedPath, failed)
  }
  const nFailed = missing.filter((c) => !clips[c.key]).length
  const total = Object.values(clips).length
  await log(
    `Xong: tạo ${made} clip; manifest có ${total}/${wanted.length}; lỗi ${nFailed}. ` +
      `Yêu cầu ${stats.requests}, 429 ${stats.rateLimited}, lỗi máy chủ ${stats.serverErrors}, clip không đạt ${stats.invalid}.`,
  )
  if (code === 0 && nFailed > waiting) code = 3
  else if (code === 0 && waiting > 0) code = 4
  return code
}

// ───────────────────────────────────────────── responses

/** { data, mimeType } of the first audio part of a GenerateContentResponse, or a reason it has none. */
export function firstInline(res) {
  const cand = res?.candidates?.[0]
  const part = cand?.content?.parts?.find((p) => p?.inlineData?.data)
  if (part) return { data: part.inlineData.data, mimeType: part.inlineData.mimeType }
  const why = res?.promptFeedback?.blockReason ? `bị chặn (${res.promptFeedback.blockReason})` : `không có âm thanh (finishReason=${cand?.finishReason ?? '?'})`
  return { error: why }
}

/** Batch state wherever the API puts it (Operation.metadata.state, or the batch itself). */
export function batchState(op) {
  return String(op?.metadata?.state ?? op?.state ?? op?.batch?.state ?? op?.response?.state ?? '')
}

/** The inline responses of a finished batch, wherever the API puts them; null when there are none. */
export function inlinedResponses(op) {
  const candidates = [
    op?.response?.inlinedResponses?.inlinedResponses,
    op?.response?.inlinedResponses,
    op?.response?.output?.inlinedResponses?.inlinedResponses,
    op?.metadata?.output?.inlinedResponses?.inlinedResponses,
    op?.output?.inlinedResponses?.inlinedResponses,
    op?.dest?.inlinedResponses?.inlinedResponses,
    op?.dest?.inlinedResponses,
  ]
  return candidates.find((c) => Array.isArray(c)) ?? null
}

/** Name of the results file of a file-output batch ("files/…"), or null. */
export function responsesFile(op) {
  const f = op?.response?.responsesFile ?? op?.dest?.fileName ?? op?.metadata?.output?.responsesFile ?? op?.output?.responsesFile
  return typeof f === 'string' && f ? f : null
}

/** Display name of a batch in a GET /batches listing or a batch resource, wherever the API puts it. */
export function batchDisplayName(op) {
  const v = op?.metadata?.displayName ?? op?.metadata?.display_name ?? op?.displayName ?? op?.display_name ?? op?.batch?.displayName ?? op?.batch?.display_name
  return typeof v === 'string' ? v : null
}

/** The field names of a response (two levels, no values), for a log line when results cannot be found in it. */
export function describeShape(op) {
  if (!op || typeof op !== 'object') return typeof op
  return Object.keys(op)
    .map((k) => (op[k] && typeof op[k] === 'object' && !Array.isArray(op[k]) ? `${k}{${Object.keys(op[k]).join(',')}}` : k))
    .join(', ')
}

/** Removes "*.tmp" files (left by a write cut short) directly in `dir`; returns how many. */
export async function removeTempFiles(dir) {
  let n = 0
  for (const f of await readdir(dir).catch(() => [])) {
    if (!f.endsWith('.tmp')) continue
    await unlink(join(dir, f)).then(
      () => n++,
      () => undefined,
    )
  }
  return n
}

/**
 * Downloads a JSONL results file: one { key, response } or { key, error } per line. null when it cannot be read
 * now (error status, network, timeout): the job is kept and read again on a later run, never regenerated.
 */
async function downloadResults(baseUrl, file, apiKey) {
  const u = new URL(baseUrl)
  const url = `${u.origin}/download${u.pathname}/${file}:download?alt=media`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { 'x-goog-api-key': apiKey }, signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.text())
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Turns one TTS answer into a shipped MP3: PCM (or WAV) → the app's clipProblem check (empty / too short) and a
 * too-long check → mono → edge silence trimmed → MP3 → frame scan. Calls save(mp3, durationMs) when it is good;
 * returns null, or the reason it is not. `inline` is { data (base64), mimeType } from Gemini, or { bytes } of a kept WAV.
 */
export async function saveAudio(app, opts, clip, inline, save) {
  if (!inline || inline.error) return inline?.error ?? 'không có âm thanh'
  let bytes = inline.bytes
  if (!bytes) {
    try {
      bytes = app.wav.base64ToBytes(inline.data)
    } catch {
      return 'base64 hỏng'
    }
  }
  let fmt
  let data
  if (app.wav.isWav(bytes)) {
    const w = parseWav(bytes)
    if (!w || w.format !== 1) return 'WAV không đọc được'
    fmt = { sampleRate: w.sampleRate, channels: w.channels, bitsPerSample: w.bitsPerSample }
    data = w.data
  } else {
    fmt = app.wav.parsePcmMime(inline.mimeType)
    data = bytes
  }
  if (fmt.bitsPerSample !== 16) return `PCM ${fmt.bitsPerSample}-bit chưa hỗ trợ`
  if (fmt.sampleRate > 24000 || fmt.sampleRate < 8000) return `sample rate ${fmt.sampleRate} ngoài 8–24 kHz`
  const wavBytes = app.wav.pcmToWav(data, fmt)
  const bad = await app.client.clipProblem({ audio: new Blob([wavBytes]), mime: 'audio/wav' }, clip.text)
  if (bad) return bad
  const sec = app.wav.wavDurationSec(wavBytes) ?? 0
  if (tooLong(sec, clip.text)) return `đoạn âm thanh dài bất thường (${sec.toFixed(1)} giây)`
  const mono = toMono(pcm16(data), fmt.channels)
  const samples = opts.trim ? trimSilence(mono, fmt.sampleRate) : mono
  const mp3 = encodeMp3(samples, fmt.sampleRate, opts.kbps)
  const scan = scanMp3(mp3)
  if (!scan.ok) return `MP3 hỏng: ${scan.error}`
  const durationMs = Math.round((samples.length / fmt.sampleRate) * 1000)
  if (Math.abs(scan.durationMs - durationMs) > 250) return `MP3 dài ${scan.durationMs} ms, PCM ${durationMs} ms`
  await save(mp3, durationMs, wavBytes)
  return null
}

if (isMain(import.meta.url)) {
  run(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`[audio:generate] Lỗi: ${redact(e?.message ?? e, process.env.GEMINI_API_KEY)}`)
      process.exit(1)
    })
}
