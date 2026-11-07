#!/usr/bin/env node
/**
 * Builds the portable single-file version: ONE self-contained HTML file (JS, CSS and icon inlined)
 * that runs when double-clicked from disk (file:// in Edge/Chrome), e.g. from a OneDrive folder on
 * any computer, without Node or a web server.
 *
 *   npm run portable                     -> portable/Nghe-Noi-Am.html
 *   npm run portable -- --out "<dir>"    -> <dir>/Nghe-Noi-Am.html (dir is created if missing)
 *
 * Steps: type-check (`tsc -b`, like `npm run build`), `vite build --mode portable` (see vite.config.ts: code splitting off, so every React.lazy
 * page is in the one entry chunk; no public/ copy; no service worker; every asset, including the Be Vietnam Pro
 * woff2 files from src/fonts.css, inlined as data: URIs), then inline the JS as an
 * inline <script type="module">, the CSS as <style>, the icon as a data: URI, and drop the manifest
 * and apple-touch-icon links (they need http(s)). Fails loudly if anything external is left.
 *
 * Shipped Gemini clips (public/audio, see src/core/audioManifest.ts): the manifest is inlined into the HTML
 * (file:// cannot fetch it) and the clip files it names are copied to "<out>/audio/" next to the HTML (only new
 * or changed files; clips no longer in the manifest are removed). Keep that folder next to the HTML: without it
 * the app plays the AI or browser voice, as before.
 */
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { inlineAudioManifest, normalizeAudioManifest, syncAudioFolder } from './portableAudio.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD_DIR = join(ROOT, 'node_modules', '.portable-build') // keep in sync with vite.config.ts
const FILE_NAME = 'Nghe-Noi-Am.html'
const AUDIO_SRC_DIR = join(ROOT, 'public', 'audio')

/** public/audio/manifest.json as { key: file }, keeping only clips whose file exists; null when there is none. */
async function readAudioClips() {
  let raw
  try {
    raw = await readFile(join(AUDIO_SRC_DIR, 'manifest.json'), 'utf8')
  } catch {
    return null
  }
  let json
  try {
    json = JSON.parse(raw)
  } catch {
    fail('public/audio/manifest.json không phải JSON hợp lệ')
  }
  const all = normalizeAudioManifest(json)
  const clips = {}
  let missing = 0
  for (const [key, file] of Object.entries(all)) {
    try {
      await stat(join(AUDIO_SRC_DIR, file))
      clips[key] = file
    } catch {
      missing++
    }
  }
  return { clips, missing }
}

function parseArgs(argv) {
  let outDir = join(ROOT, 'portable')
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out' || a === '-o') {
      const v = argv[++i]
      if (!v) fail('Thiếu thư mục sau --out')
      outDir = v
    } else if (a.startsWith('--out=')) {
      outDir = a.slice('--out='.length)
    } else {
      fail(`Tham số không hợp lệ: ${a}\nCách dùng: npm run portable -- --out "<thư mục>"`)
    }
  }
  return { outDir: isAbsolute(outDir) ? outDir : resolve(process.cwd(), outDir) }
}

function fail(msg) {
  console.error(`\n[portable] Lỗi: ${msg}`)
  process.exit(1)
}

/**
 * Makes JS safe inside an inline <script>: the HTML parser ends the element at the first "</script"
 * (any case) and "<!--" can switch it into the escaped state. "\x3C" is "<" in string, template and
 * regex literals alike (also with the u flag), and harmless in comments.
 */
function escapeInlineScript(js) {
  return js.replace(/<(\/script|!--)/gi, (_m, rest) => `\\x3C${rest}`)
}

/** CSS can only end a <style> element via "</style". */
function escapeInlineStyle(css) {
  return css.replace(/<\/style/gi, '\\3C/style')
}

/** Replaces exactly one match of `re` (fails otherwise); a function replacement so "$" in code stays literal. */
function replaceOnce(html, re, replacement, what) {
  const matches = html.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))
  if (!matches || matches.length !== 1) fail(`Không tìm thấy đúng 1 ${what} trong index.html (thấy ${matches?.length ?? 0})`)
  return html.replace(re, () => replacement)
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`
}

/**
 * Runs `tsc -b` here rather than as `tsc -b && node …` in package.json: on Windows npm double-escapes
 * the arguments appended after `--` when the script starts with a .cmd shim, which turns
 * --out "C:\…\OneDrive - x\y" into "^C:\…^ -^ x\y^".
 */
function typeCheck() {
  const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
  const r = spawnSync(process.execPath, [tsc, '-b'], { cwd: ROOT, stdio: 'inherit' })
  if (r.status !== 0) fail('tsc -b báo lỗi kiểu (xem ở trên)')
}

async function main() {
  const { outDir } = parseArgs(process.argv.slice(2))

  typeCheck()

  await build({ root: ROOT, mode: 'portable', logLevel: 'warn' })

  const assetsDir = join(BUILD_DIR, 'assets')
  const files = await readdir(assetsDir)
  const jsFiles = files.filter((f) => f.endsWith('.js'))
  const cssFiles = files.filter((f) => f.endsWith('.css'))
  const others = files.filter((f) => !f.endsWith('.js') && !f.endsWith('.css') && !f.endsWith('.map'))
  if (jsFiles.length !== 1) fail(`Cần đúng 1 file JS, nhưng có ${jsFiles.length}: ${jsFiles.join(', ')}`)
  if (cssFiles.length > 1) fail(`Cần tối đa 1 file CSS, nhưng có ${cssFiles.length}: ${cssFiles.join(', ')}`)
  if (others.length) fail(`Còn file asset chưa được nhúng: ${others.join(', ')}`)

  let html = await readFile(join(BUILD_DIR, 'index.html'), 'utf8')
  const js = await readFile(join(assetsDir, jsFiles[0]), 'utf8')
  if (/\bimport\s*\(\s*["'`]\.{1,2}\//.test(js)) fail('Bundle JS vẫn còn import() tới file khác')

  // Entry script -> inline module script (inline modules have no CORS check on file://).
  html = replaceOnce(
    html,
    /<script type="module"[^>]*\ssrc="[^"]*assets\/[^"]+\.js"[^>]*><\/script>/,
    `<script type="module">\n${escapeInlineScript(js)}\n</script>`,
    'thẻ <script> của bundle',
  )

  if (cssFiles.length) {
    const css = await readFile(join(assetsDir, cssFiles[0]), 'utf8')
    // Fonts (src/fonts.css) and any other url() must already be data: URIs (vite.config.ts sets
    // assetsInlineLimit to the max in portable mode); a file:// page cannot load sibling files offline.
    const external = [...css.matchAll(/url\(\s*(['"]?)(?!data:|#)([^'")]+)\1\s*\)/g)].map((m) => m[2])
    if (external.length) fail(`CSS vẫn còn url() tới file ngoài: ${external.join(', ')}`)
    if (/@import\b/.test(css)) fail('CSS vẫn còn @import (font CDN?)')
    html = replaceOnce(
      html,
      /<link rel="stylesheet"[^>]*\shref="[^"]*assets\/[^"]+\.css"[^>]*>/,
      `<style>\n${escapeInlineStyle(css)}\n</style>`,
      'thẻ <link rel="stylesheet">',
    )
  }

  // Icon -> data: URI. Manifest and apple-touch-icon only work over http(s): drop them.
  const icon = await readFile(join(ROOT, 'public', 'icon.svg'))
  html = replaceOnce(
    html,
    /<link rel="icon"[^>]*>/,
    `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${icon.toString('base64')}" />`,
    'thẻ <link rel="icon">',
  )
  html = html.replace(/[ \t]*<link rel="(?:manifest|apple-touch-icon)"[^>]*>\r?\n?/g, '')

  // Shipped Gemini clips: the manifest goes into the page; the files are copied next to it below.
  const audio = await readAudioClips()
  if (audio) html = inlineAudioManifest(html, audio.clips)

  // Nothing may still point at a sibling file.
  const leftovers = [...html.matchAll(/\s(?:src|href)="(?!data:|https?:|#)([^"]+)"/g)].map((m) => m[1])
  if (leftovers.length) fail(`HTML vẫn còn tham chiếu tới file ngoài: ${leftovers.join(', ')}`)

  await mkdir(outDir, { recursive: true })
  const outFile = join(outDir, FILE_NAME)
  await writeFile(outFile, html)
  const { size } = await stat(outFile)
  console.log(`\n[portable] Đã tạo bản 1 file: ${outFile}`)
  console.log(`[portable] Kích thước: ${formatSize(size)} (${size} bytes)`)
  if (audio) {
    const files = [...new Set(Object.values(audio.clips))]
    const r = await syncAudioFolder(AUDIO_SRC_DIR, join(outDir, 'audio'), files)
    console.log(
      `[portable] Giọng Gemini có sẵn: ${r.files} file (${formatSize(r.bytes)}) trong ${join(outDir, 'audio')}` +
        ` — chép mới ${r.copied}, giữ nguyên ${r.kept}, xóa ${r.removed}.`,
    )
    if (audio.missing) console.warn(`[portable] Bỏ qua ${audio.missing} mục trong manifest không có file trong public/audio.`)
    console.log('[portable] Giữ thư mục "audio" cạnh file HTML khi chép đi máy khác.')
  } else {
    console.log('[portable] Chưa có public/audio/manifest.json: bản này dùng giọng AI/trình duyệt như trước.')
  }
  console.log('[portable] Mở bằng cách nhấp đúp file (Edge/Chrome) — không cần Node hay máy chủ.')
}

main().catch((err) => fail(err?.stack ?? String(err)))
