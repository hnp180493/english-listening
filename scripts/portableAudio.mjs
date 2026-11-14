/**
 * Shipped Gemini clips in the portable build (used by scripts/build-portable.mjs, unit-tested by
 * src/core/portableAudio.test.ts).
 *
 * file:// cannot fetch, so the clip manifest (public/audio/manifest.json) goes INTO the HTML as an inline
 * JSON block, read by src/core/audioManifest.ts. The clips themselves are copied next to the HTML into
 * "<out>/audio/", where an <audio> element loads them by the relative URL "audio/<file>".
 */
import { copyFile, mkdir, readFile, rename, stat, unlink, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Same id as AUDIO_MANIFEST_ELEMENT_ID in src/core/audioManifest.ts (a test checks they match). */
export const AUDIO_MANIFEST_ELEMENT_ID = 'nna-audio-manifest'

const FILE_RE = /^[A-Za-z0-9_-]{1,64}\.(?:mp3|m4a|aac|ogg|opus|wav)$/
const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/
/**
 * Ledger of the clip files this tool put in "<out>/audio". Only names listed in it are ever removed, so the
 * learner's own files in a folder of the same name (song.mp3, lecture-1.wav …) are never touched.
 */
export const AUDIO_LEDGER_FILE = '.nna-clips.json'

/** The town's pictures next to the portable HTML ("<out>/art/"): hashed WebP names from the Vite build. */
export const ART_LEDGER_FILE = '.nna-art.json'
const ART_FILE_RE = /^[A-Za-z0-9_.-]{1,96}\.webp$/

const AUDIO_KIND = { ledger: AUDIO_LEDGER_FILE, fileRe: FILE_RE, note: 'Danh sách clip do bản portable chép vào; đừng sửa tay.' }
// a hashed name changes with the content: the same name and size is the same picture (each build writes fresh mtimes)
const ART_KIND = { ledger: ART_LEDGER_FILE, fileRe: ART_FILE_RE, hashedNames: true, note: 'Danh sách hình thị trấn do bản portable chép vào; đừng sửa tay.' }

async function readLedger(outDir, kind) {
  try {
    const j = JSON.parse(await readFile(join(outDir, kind.ledger), 'utf8'))
    return Array.isArray(j?.files) ? j.files.filter((f) => typeof f === 'string' && kind.fileRe.test(f)) : null
  } catch {
    return null
  }
}

async function writeLedger(outDir, files, kind) {
  const path = join(outDir, kind.ledger)
  const tmp = `${path}.${process.pid}.${Date.now().toString(36)}.tmp`
  await writeFile(tmp, JSON.stringify({ app: 'nghe-noi-am', note: kind.note, files: [...files].sort() }) + '\n')
  await rename(tmp, path)
}

function fileOf(entry) {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object') {
    for (const f of ['f', 'file', 'path']) if (typeof entry[f] === 'string') return entry[f]
  }
  return null
}

/**
 * The manifest as a plain { key: file } map, accepting the same shapes as parseAudioManifest() in
 * src/core/audioManifest.ts: { clips: { key: "f.mp3" | { f } } }, { clips: [{ key, f }] } or a bare map.
 */
export function normalizeAudioManifest(json) {
  const out = {}
  const put = (key, entry) => {
    const file = fileOf(entry)
    if (typeof key !== 'string' || !KEY_RE.test(key) || !file) return
    const name = file.startsWith('audio/') ? file.slice('audio/'.length) : file
    if (FILE_RE.test(name)) out[key] = name
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return out
  const clips = json.clips ?? json.files ?? json.items
  if (Array.isArray(clips)) {
    for (const c of clips) if (c && typeof c === 'object') put(c.key ?? c.k, c)
  } else if (clips && typeof clips === 'object') {
    for (const [k, v] of Object.entries(clips)) put(k, v)
  } else {
    for (const [k, v] of Object.entries(json)) put(k, v)
  }
  return out
}

/**
 * Puts the { key: file } map into the page as <script type="application/json" id="nna-audio-manifest">
 * right before </head> (before the app's module script runs). "<" is escaped as < so no text can end
 * the element. Replaces a block already there. Throws when the HTML has no single </head>.
 */
export function inlineAudioManifest(html, clips) {
  const json = JSON.stringify({ clips }).replace(/</g, '\\u003c')
  const tag = `<script type="application/json" id="${AUDIO_MANIFEST_ELEMENT_ID}">${json}</script>`
  const existing = new RegExp(`<script type="application/json" id="${AUDIO_MANIFEST_ELEMENT_ID}">[\\s\\S]*?</script>`)
  if (existing.test(html)) return html.replace(existing, () => tag)
  const heads = html.match(/<\/head>/gi)
  if (!heads || heads.length !== 1) throw new Error(`Cần đúng 1 thẻ </head> để nhúng danh sách giọng (thấy ${heads?.length ?? 0})`)
  return html.replace(/<\/head>/i, () => `  ${tag}\n  </head>`)
}

/**
 * Makes "<outAudioDir>" hold the clip files named in `files` (taken from `srcDir`): copies new or changed files
 * (size or modification time differs) and keeps unchanged ones. Removes only clip files that an earlier run of
 * this function copied (listed in its ledger, AUDIO_LEDGER_FILE) and that are no longer listed; anything else in
 * the folder is left alone, also on the first run (no ledger yet). Files missing in srcDir are reported, not copied.
 */
export function syncAudioFolder(srcDir, outAudioDir, files) {
  return syncFolder(srcDir, outAudioDir, files, AUDIO_KIND)
}

/**
 * The same for the town's pictures: "<outArtDir>" holds the WebP atlases of this build (hashed names). Pictures of
 * an earlier build that this function copied are removed; nothing else is touched (its own ledger, ART_LEDGER_FILE).
 */
export function syncArtFolder(srcDir, outArtDir, files) {
  return syncFolder(srcDir, outArtDir, files, ART_KIND)
}

async function syncFolder(srcDir, outAudioDir, files, kind) {
  const wanted = new Set(files)
  const r = { copied: 0, kept: 0, removed: 0, missing: [], files: 0, bytes: 0 }
  const present = []
  await mkdir(outAudioDir, { recursive: true })
  for (const f of wanted) {
    const src = join(srcDir, f)
    const dst = join(outAudioDir, f)
    let s
    try {
      s = await stat(src)
    } catch {
      r.missing.push(f)
      continue
    }
    let d = null
    try {
      d = await stat(dst)
    } catch {
      d = null
    }
    if (d && d.size === s.size && (kind.hashedNames || Math.abs(d.mtimeMs - s.mtimeMs) < 2000)) r.kept++
    else {
      await copyFile(src, dst)
      await utimes(dst, s.atime, s.mtime)
      r.copied++
    }
    present.push(f)
    r.files++
    r.bytes += s.size
  }
  const previous = (await readLedger(outAudioDir, kind)) ?? []
  for (const f of previous) {
    if (wanted.has(f)) continue
    try {
      await unlink(join(outAudioDir, f))
      r.removed++
    } catch {
      // already gone
    }
  }
  // still ours: copied now, or copied earlier and still wanted (its source may be missing this time)
  await writeLedger(outAudioDir, new Set([...present, ...previous.filter((f) => wanted.has(f))]), kind)
  return r
}
