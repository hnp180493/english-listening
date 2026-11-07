/**
 * End-to-end test of scripts/generate-audio.mjs against a LOCAL mock Gemini server (node:http on 127.0.0.1,
 * synthetic PCM). Never calls the real API; the key is a fake. Run: npm run audio:test (node --test).
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import { createLimiter, encodeMp3, importApp, parseWav, redact, resolveBaseUrl, scanMp3, tmpNameFor, trimSilence, writeJsonAtomic } from './audio-lib.mjs'
import { batchState, inlinedResponses, run } from './generate-audio.mjs'

const FAKE_KEY = 'AIzaFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAK' // fake, shaped like a key so redaction is exercised
const SR = 24000
const TONE_PER_WORD = 0.25
const EDGE = 0.15

const words = (t) => t.split(/\s+/).filter(Boolean).length

/** Synthetic Gemini PCM for `text`: silence, a tone of 0.25 s per word, silence ("SHORTCLIP" → 50 ms only). */
function synthPcm(text) {
  const tone = text.includes('SHORTCLIP') ? 0.05 : TONE_PER_WORD * words(text)
  const edge = text.includes('SHORTCLIP') ? 0 : EDGE
  const n = Math.round((tone + 2 * edge) * SR)
  const buf = Buffer.alloc(n * 2)
  const a = Math.round(edge * SR)
  const b = a + Math.round(tone * SR)
  for (let i = a; i < b; i++) buf.writeInt16LE(Math.round(9000 * Math.sin((2 * Math.PI * 220 * i) / SR)), i * 2)
  return buf
}

function ttsResponse(text) {
  return {
    candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: synthPcm(text).toString('base64') } }] }, finishReason: 'STOP' }],
  }
}

/** Mock of generateContent + batchGenerateContent + batches/{id}. */
function startMock() {
  const m = { calls: [], dailyNext: false, rateLimitNext: 0, batchErrorIndex: -1, createFailAfter: false, unreadablePolls: 0, jobs: new Map(), keysSeen: new Set() }
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const send = (status, json) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(json))
      }
      m.keysSeen.add(req.headers['x-goog-api-key'])
      if (req.headers['x-goog-api-key'] !== FAKE_KEY) return send(403, { error: { code: 403, message: 'bad key' } })
      const url = new URL(req.url, 'http://127.0.0.1')
      const parsed = body ? JSON.parse(body) : null
      m.calls.push({ method: req.method, path: url.pathname, body: parsed })
      if (req.method === 'POST' && url.pathname.endsWith(':generateContent')) {
        if (m.dailyNext) {
          return send(429, {
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'You exceeded your current quota',
              details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel' }] }],
            },
          })
        }
        if (m.rateLimitNext > 0) {
          m.rateLimitNext--
          return send(429, {
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'You exceeded your current quota',
              details: [
                { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel' }] },
                { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '0.3s' },
              ],
            },
          })
        }
        return send(200, ttsResponse(parsed.contents[0].parts[0].text))
      }
      if (req.method === 'POST' && url.pathname.endsWith(':batchGenerateContent')) {
        const name = `batches/job${m.jobs.size + 1}`
        m.jobs.set(name, { polls: 0, requests: parsed.batch.input_config.requests.requests, displayName: parsed.batch.display_name })
        // the job is created, but the answer is lost (5xx / proxy timeout)
        if (m.createFailAfter) return send(503, { error: { code: 503, message: 'upstream timeout' } })
        return send(200, { name, metadata: { '@type': 'type.googleapis.com/google.ai.generativelanguage.v1beta.GenerateContentBatch', state: 'BATCH_STATE_PENDING' } })
      }
      const job = req.method === 'GET' && m.jobs.get(url.pathname.replace(/^\/v1beta\//, ''))
      if (job) {
        job.polls++
        if (job.polls < 2) return send(200, { name: url.pathname, metadata: { state: 'BATCH_STATE_RUNNING' } })
        if (m.unreadablePolls > 0) {
          // finished, but the results sit where the parser does not look
          m.unreadablePolls--
          return send(200, { name: url.pathname, metadata: { state: 'BATCH_STATE_SUCCEEDED' }, done: true, response: { somewhereElse: { items: [] } } })
        }
        const inlined = job.requests.map((r, i) =>
          i === m.batchErrorIndex
            ? { error: { code: 500, message: 'internal' }, metadata: r.metadata }
            : { response: ttsResponse(r.request.contents[0].parts[0].text), metadata: r.metadata },
        )
        return send(200, { name: url.pathname, metadata: { state: 'BATCH_STATE_SUCCEEDED' }, done: true, response: { inlinedResponses: { inlinedResponses: inlined } } })
      }
      if (req.method === 'GET' && url.pathname === '/v1beta/batches') {
        return send(200, { operations: [...m.jobs.entries()].map(([name, j]) => ({ name, metadata: { displayName: j.displayName, state: 'BATCH_STATE_RUNNING' } })) })
      }
      send(404, { error: { code: 404, message: `no route ${req.method} ${url.pathname}` } })
    })
  })
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ m, server, base: `http://127.0.0.1:${server.address().port}/v1beta` })))
}

let mock
let dir
let audioKey
let styles
let voice
const genCalls = () => mock.m.calls.filter((c) => c.path.endsWith(':generateContent')).length

/** A fixture inventory of `n` clips with real audioKey keys. */
async function fixture(name, texts) {
  const clips = texts.map((text, i) => {
    const mode = i % 3 === 2 ? 'careful' : 'connected'
    return { key: audioKey(mode, text), text, mode, source: i % 2 ? 'lesson' : 'dictation', ref: `t${i}`, part: mode === 'careful' ? 'careful' : 'main', sources: [i % 2 ? 'lesson' : 'dictation'], refs: [], browserOnly: false }
  })
  const path = join(dir, `${name}.json`)
  await writeFile(path, JSON.stringify({ voice, styleVersion: 1, clips }))
  return { path, clips }
}

const NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const textsFor = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix} ${NUMBERS.slice(0, (i % 6) + 1).join(' ')} ${i}`)

function args(inv, out, work, extra = []) {
  return ['--inventory', inv, '--out', out, '--work', work, '--rpm', '6000', '--concurrency', '3', '--poll', '0.05', ...extra]
}
const env = () => ({ GEMINI_API_KEY: FAKE_KEY, GEMINI_BASE_URL: mock.base })

async function readManifest(out) {
  return JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'))
}

/** Every clip: a valid MP3, duration ≈ the synthetic tone + kept edges, listed in the manifest. */
async function checkClips(out, clips) {
  const man = await readManifest(out)
  assert.equal(man.voice, voice)
  assert.equal(man.version, 1)
  assert.ok(man.model && man.voiceName === 'Kore')
  for (const c of clips) {
    const entry = man.clips[c.key]
    assert.ok(entry, `manifest has ${c.key}`)
    assert.equal(entry.f, `${c.key}.mp3`)
    assert.equal(entry.src, c.source)
    const bytes = new Uint8Array(await readFile(join(out, entry.f)))
    assert.equal(bytes[0], 0xff, 'starts with a frame sync')
    const scan = scanMp3(bytes)
    assert.ok(scan.ok, scan.error)
    assert.equal(scan.sampleRate, 24000)
    assert.equal(scan.kbps, 40)
    const expected = (TONE_PER_WORD * words(c.text) + 2 * 0.12) * 1000 // trimSilence keeps 120 ms each side
    assert.ok(Math.abs(entry.d - expected) < 40, `d ${entry.d} ≈ ${expected}`)
    assert.ok(Math.abs(scan.durationMs - entry.d) < 250, `mp3 ${scan.durationMs} ≈ ${entry.d}`)
  }
  return man
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nna-audio-test-'))
  mock = await startMock()
  ;({ audioKey, AUDIO_VOICE: voice } = await importApp('/src/core/audioKey.ts'))
  styles = await importApp('/src/core/playback.ts')
})

after(async () => {
  mock?.server.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

describe('generate-audio (mock Gemini on 127.0.0.1)', () => {
  test('refuses to run without GEMINI_API_KEY, and refuses a non-local base URL override', async () => {
    const { path } = await fixture('nokey', ['Hello there my friend'])
    await assert.rejects(run(args(path, join(dir, 'nokey-out'), join(dir, 'nokey-work')), {}), /GEMINI_API_KEY/)
    await assert.rejects(
      run(args(path, join(dir, 'nokey-out'), join(dir, 'nokey-work')), { GEMINI_API_KEY: FAKE_KEY, GEMINI_BASE_URL: 'https://example.com/v1beta' }),
      /GEMINI_BASE_URL/,
    )
    assert.equal(mock.m.calls.length, 0)
  })

  test('dry run: counts only, no request, nothing written to --out', async () => {
    const { path } = await fixture('dry', textsFor('Dry', 5))
    const out = join(dir, 'dry-out')
    assert.equal(await run([...args(path, out, join(dir, 'dry-work')), '--dry-run'], {}), 0)
    await assert.rejects(readdir(out))
    assert.equal(mock.m.calls.length, 0)
  })

  test('sequential: 20 clips with two 429s (RetryInfo), valid MP3s + manifest, then resume', async () => {
    const { path, clips } = await fixture('seq', textsFor('Sequential clip', 20))
    const out = join(dir, 'seq-out')
    const work = join(dir, 'seq-work')
    mock.m.rateLimitNext = 2
    const t0 = Date.now()
    assert.equal(await run(args(path, out, work, ['--mode', 'sequential']), env()), 0)
    assert.ok(Date.now() - t0 >= 300, 'waited for RetryInfo.retryDelay')
    assert.equal(genCalls(), 22, '20 clips + 2 rate-limited retries')
    await checkClips(out, clips)
    // the app's request body: style per mode in parts[].speechMetadata, voice Kore
    const bodies = mock.m.calls.filter((c) => c.path.endsWith(':generateContent')).map((c) => c.body)
    for (const b of bodies) {
      const part = b.contents[0].parts[0]
      const clip = clips.find((c) => c.text === part.text)
      assert.equal(part.speechMetadata.style, clip.mode === 'careful' ? styles.CAREFUL_STYLE : styles.CONNECTED_STYLE)
      assert.equal(b.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore')
    }
    const logText = await readFile(join(work, 'generate.log'), 'utf8')
    assert.match(logText, /429/)
    assert.ok(!logText.includes(FAKE_KEY), 'the key never reaches the log')
    assert.deepEqual(JSON.parse(await readFile(join(work, 'failed.json'), 'utf8')), {})

    // resume: nothing to do
    const before1 = genCalls()
    assert.equal(await run(args(path, out, work, ['--mode', 'sequential']), env()), 0)
    assert.equal(genCalls(), before1)
    // one file deleted and one corrupted: re-encoded from the kept WAVs, no request (and no key needed)
    await rm(join(out, `${clips[0].key}.mp3`))
    await writeFile(join(out, `${clips[1].key}.mp3`), Buffer.from('not an mp3 at all'))
    assert.equal(await run(args(path, out, work, ['--mode', 'sequential']), {}), 0)
    assert.equal(genCalls(), before1)
    await checkClips(out, clips)
    // MP3 and WAV both gone: that clip is asked for again, only that one
    await rm(join(out, `${clips[2].key}.mp3`))
    await rm(join(work, 'wav', `${clips[2].key}.wav`))
    assert.equal(await run(args(path, out, work, ['--mode', 'sequential']), env()), 0)
    assert.equal(genCalls(), before1 + 1)
    await checkClips(out, clips)
  })

  test('--limit and a clip that is too short: retried once, then recorded as failed (exit 3)', async () => {
    const texts = ['SHORTCLIP this one is broken', ...textsFor('Limited', 6)]
    const { path, clips } = await fixture('limit', texts)
    const out = join(dir, 'limit-out')
    const work = join(dir, 'limit-work')
    const before1 = genCalls()
    assert.equal(await run(args(path, out, work, ['--mode', 'sequential', '--limit', '4']), env()), 3)
    assert.equal(genCalls() - before1, 5, 'broken clip asked twice + 3 good ones')
    const failed = JSON.parse(await readFile(join(work, 'failed.json'), 'utf8'))
    assert.deepEqual(Object.keys(failed), [clips[0].key])
    assert.match(failed[clips[0].key].error, /ngắn/)
    const man = await readManifest(out)
    assert.equal(Object.keys(man.clips).length, 3)
    assert.ok(!man.clips[clips[0].key])
  })

  test('batch: one job, polled until it succeeds; a per-request error falls back to a direct request', async () => {
    const { path, clips } = await fixture('batch', textsFor('Batch clip', 10))
    const out = join(dir, 'batch-out')
    const work = join(dir, 'batch-work')
    mock.m.batchErrorIndex = 3
    const gen0 = genCalls()
    assert.equal(await run(args(path, out, work, ['--batch-size', '50']), env()), 0)
    assert.equal(mock.m.jobs.size, 1)
    const [job] = [...mock.m.jobs.values()]
    assert.equal(job.requests.length, 10)
    assert.ok(job.polls >= 2)
    assert.ok(job.requests.every((r) => r.metadata.key && r.request.generationConfig.responseModalities[0] === 'AUDIO'))
    assert.equal(genCalls() - gen0, 1, 'only the failed request is sent again')
    await checkClips(out, clips)
    const state = JSON.parse(await readFile(join(work, 'batches.json'), 'utf8'))
    assert.equal(state.jobs.length, 1)
    assert.ok(state.jobs[0].collected)
    // resume: the collected job is not polled again, nothing new is sent
    const calls = mock.m.calls.length
    assert.equal(await run(args(path, out, work), env()), 0)
    assert.equal(mock.m.calls.length, calls)
    mock.m.batchErrorIndex = -1
  })

  test('batch resume: a job submitted by a run that was cut short is collected, not submitted again', async () => {
    const { path, clips } = await fixture('resume', textsFor('Resumed batch', 4))
    const out = join(dir, 'resume-out')
    const work = join(dir, 'resume-work')
    // simulate the interrupted run: the job exists on the server and in batches.json, no clip on disk yet
    const requests = clips.map((c) => ({ request: { contents: [{ role: 'user', parts: [{ text: c.text }] }] }, metadata: { key: c.key } }))
    const name = `batches/job${mock.m.jobs.size + 1}`
    mock.m.jobs.set(name, { polls: 0, requests })
    await writeJsonAtomic(join(work, 'batches.json'), {
      jobs: [{ name, createdAt: new Date().toISOString(), state: 'BATCH_STATE_PENDING', collected: false, clips: clips.map((c) => ({ key: c.key, text: c.text, mode: c.mode })) }],
    })
    const jobs0 = mock.m.jobs.size
    assert.equal(await run(args(path, out, work), env()), 0)
    assert.equal(mock.m.jobs.size, jobs0, 'no new job')
    await checkClips(out, clips)
  })

  test('batch: a finished job whose results cannot be read is kept, never regenerated at full price (exit 4); the next run collects it', async () => {
    const { path, clips } = await fixture('unreadable', textsFor('Unreadable batch', 5))
    const out = join(dir, 'unreadable-out')
    const work = join(dir, 'unreadable-work')
    const gen0 = genCalls()
    const jobs0 = mock.m.jobs.size
    mock.m.unreadablePolls = 1
    try {
      assert.equal(await run(args(path, out, work), env()), 4)
    } finally {
      mock.m.unreadablePolls = 0
    }
    assert.equal(genCalls(), gen0, 'no direct (full-price) request for the clips of the unreadable job')
    assert.equal(mock.m.jobs.size, jobs0 + 1)
    let state = JSON.parse(await readFile(join(work, 'batches.json'), 'utf8'))
    assert.equal(state.jobs.length, 1)
    assert.equal(state.jobs[0].collected, false, 'still to collect')
    assert.match(await readFile(join(work, 'generate.log'), 'utf8'), /không đọc được kết quả \(khóa: .*response\{somewhereElse\}/)
    // next run (parser fixed / shape readable): the same job is collected, no new job, no direct request
    assert.equal(await run(args(path, out, work), env()), 0)
    assert.equal(mock.m.jobs.size, jobs0 + 1, 'no new job')
    assert.equal(genCalls(), gen0)
    await checkClips(out, clips)
    state = JSON.parse(await readFile(join(work, 'batches.json'), 'utf8'))
    assert.ok(state.jobs[0].collected)
  })

  test('batch: a create call with a lost answer (5xx) is not resubmitted; the job is found by its display name', async () => {
    const { path, clips } = await fixture('ambiguous', textsFor('Ambiguous create', 4))
    const out = join(dir, 'ambiguous-out')
    const work = join(dir, 'ambiguous-work')
    const creates = () => mock.m.calls.filter((c) => c.path.endsWith(':batchGenerateContent')).length
    const c0 = creates()
    const gen0 = genCalls()
    mock.m.createFailAfter = true
    try {
      assert.equal(await run(args(path, out, work), env()), 0)
    } finally {
      mock.m.createFailAfter = false
    }
    assert.equal(creates() - c0, 1, 'one create call: no retry of a call the server may have acted on')
    assert.equal(genCalls(), gen0)
    await checkClips(out, clips)
    const state = JSON.parse(await readFile(join(work, 'batches.json'), 'utf8'))
    assert.equal(state.jobs.length, 1)
    assert.ok(state.jobs[0].name && state.jobs[0].collected && !state.jobs[0].submitting)
  })

  test('batch: a create cut short by an earlier run (recorded, never created) is dropped and submitted again', async () => {
    const { path, clips } = await fixture('cutshort', textsFor('Cut short', 3))
    const out = join(dir, 'cutshort-out')
    const work = join(dir, 'cutshort-work')
    await writeJsonAtomic(join(work, 'batches.json'), {
      jobs: [{ name: null, displayName: 'nna-audio-never-created', submitting: true, collected: false, state: 'SUBMITTING', clips: clips.map((c) => ({ key: c.key, text: c.text, mode: c.mode })) }],
    })
    const jobs0 = mock.m.jobs.size
    assert.equal(await run(args(path, out, work), env()), 0)
    assert.equal(mock.m.jobs.size, jobs0 + 1, 'submitted once, after the listing showed no such job')
    await checkClips(out, clips)
    const state = JSON.parse(await readFile(join(work, 'batches.json'), 'utf8'))
    assert.equal(state.jobs.length, 1)
    assert.notEqual(state.jobs[0].displayName, 'nna-audio-never-created')
  })

  test('temp files left by a run cut short mid-write are removed; parallel writes of one file never collide', async () => {
    const { path, clips } = await fixture('tmp', textsFor('Temp files', 3))
    const out = join(dir, 'tmp-out')
    const work = join(dir, 'tmp-work')
    await mkdir(out, { recursive: true })
    await writeFile(join(out, 'manifest.json.1234.tmp'), '{')
    await writeFile(join(out, `${clips[0].key}.mp3.1234.tmp`), 'half')
    assert.equal(await run(args(path, out, work, ['--mode', 'sequential']), env()), 0)
    const files = await readdir(out)
    assert.ok(!files.some((f) => f.endsWith('.tmp')), files.join(', '))
    await checkClips(out, clips)
    // two writes of one file never share a temp name (the generator also serializes its manifest writes)
    const names = new Set(Array.from({ length: 50 }, () => tmpNameFor(join(out, 'manifest.json'))))
    assert.equal(names.size, 50)
  })

  test('daily quota: stops at once with exit 2, keeps what exists', async () => {
    const { path } = await fixture('daily', textsFor('Daily quota', 5))
    const work = join(dir, 'daily-work')
    mock.m.dailyNext = true
    const gen0 = genCalls()
    try {
      assert.equal(await run(args(path, join(dir, 'daily-out'), work, ['--mode', 'sequential', '--concurrency', '1']), env()), 2)
    } finally {
      mock.m.dailyNext = false
    }
    assert.equal(genCalls() - gen0, 1, 'no retry after a per-day quota error')
    assert.match(await readFile(join(work, 'generate.log'), 'utf8'), /ngày mai/)
  })

  test('only the fake key was ever sent', () => {
    assert.deepEqual([...mock.m.keysSeen], [FAKE_KEY])
  })
})

describe('audio-lib', () => {
  test('MP3 encode → frame scan; truncated or foreign data is rejected', () => {
    const s = new Int16Array(SR) // 1 s
    for (let i = 0; i < s.length; i++) s[i] = Math.round(5000 * Math.sin((2 * Math.PI * 300 * i) / SR))
    const mp3 = encodeMp3(s, SR, 40)
    const scan = scanMp3(mp3)
    assert.ok(scan.ok)
    assert.ok(Math.abs(scan.durationMs - 1000) < 120, String(scan.durationMs))
    assert.ok(mp3.length > 4000 && mp3.length < 6500, `~5 kB/s at 40 kbps, got ${mp3.length}`)
    assert.equal(scanMp3(mp3.subarray(0, mp3.length - 10)).ok, false)
    assert.equal(scanMp3(new Uint8Array([1, 2, 3, 4, 5])).ok, false)
  })

  test('trimSilence keeps a pad around the sound; all-silence is left alone', () => {
    const s = new Int16Array(SR)
    for (let i = 12000; i < 14400; i++) s[i] = 5000
    const t = trimSilence(s, SR, { padMs: 100 })
    assert.equal(t.length, 2400 + 2 * 2400)
    assert.equal(trimSilence(new Int16Array(100), SR).length, 100)
  })

  test('parseWav reads the data chunk', async () => {
    const wav = (await importApp('/src/core/ai/wav.ts')).pcmToWav(new Uint8Array([1, 0, 2, 0]))
    const w = parseWav(wav)
    assert.equal(w.sampleRate, 24000)
    assert.equal(w.data.length, 4)
  })

  test('redact and base URL guard', () => {
    assert.equal(redact(`x ${FAKE_KEY} y`, FAKE_KEY), 'x [key] y')
    assert.equal(redact('k AIzaSyA1234567890123456789012345678901234 k', ''), 'k [key] k')
    const official = 'https://generativelanguage.googleapis.com/v1beta'
    assert.equal(resolveBaseUrl('', official), official)
    assert.equal(resolveBaseUrl('http://127.0.0.1:9/v1beta/', official), 'http://127.0.0.1:9/v1beta')
    assert.throws(() => resolveBaseUrl('http://generativelanguage.googleapis.com/v1beta', official))
    assert.throws(() => resolveBaseUrl('https://evil.test/v1beta', official))
  })

  test('limiter spaces starts and honours pauseUntil', async () => {
    const l = createLimiter({ rpm: 600, concurrency: 1 }) // 100 ms apart
    const t0 = Date.now()
    const starts = []
    for (let i = 0; i < 3; i++) {
      const release = await l.acquire()
      starts.push(Date.now() - t0)
      release()
    }
    assert.ok(starts[2] >= 190, String(starts))
    l.pauseUntil(Date.now() + 200)
    const t1 = Date.now()
    ;(await l.acquire())()
    assert.ok(Date.now() - t1 >= 190)
  })

  test('batch response shapes', () => {
    assert.equal(batchState({ metadata: { state: 'BATCH_STATE_SUCCEEDED' } }), 'BATCH_STATE_SUCCEEDED')
    assert.equal(batchState({ state: 'JOB_STATE_RUNNING' }), 'JOB_STATE_RUNNING')
    assert.deepEqual(inlinedResponses({ response: { inlinedResponses: { inlinedResponses: [1] } } }), [1])
    assert.deepEqual(inlinedResponses({ dest: { inlinedResponses: [2] } }), [2])
    assert.equal(inlinedResponses({ response: {} }), null)
  })
})
