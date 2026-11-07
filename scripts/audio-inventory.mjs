#!/usr/bin/env node
/**
 * Lists every clip the built-in content can play (src/core/audioInventory.ts) and prints counts.
 *
 *   npm run audio:inventory                       -> counts + .audio-gen/inventory.json
 *   npm run audio:inventory -- --out <file.json>  -> write the list elsewhere
 *   npm run audio:inventory -- --kbps 48          -> size estimate at another bitrate
 *
 * The TS module is loaded with Vite's module runner (no dev server, no port). See docs/audio.md.
 */
import { isAbsolute, join, resolve } from 'node:path'
import { DEFAULT_KBPS, DEFAULT_WORK_DIR, estimateSeconds, formatBytes, formatDuration, importApp, isMain, mp3Bytes, writeJsonAtomic } from './audio-lib.mjs'

/** Inventory as plain JSON (what generate-audio.mjs --inventory reads). */
export function inventoryJson(inv, counts) {
  return {
    voice: inv.voice,
    styleVersion: inv.styleVersion,
    createdAt: new Date().toISOString(),
    counts,
    clips: inv.clips,
  }
}

const pad = (s, n) => String(s).padEnd(n)
const num = (n) => String(n).padStart(6)

/** Human summary of inventoryCounts(). */
export function formatCounts(counts, inv, kbps = DEFAULT_KBPS) {
  const sec = (filter) => inv.clips.filter(filter).reduce((s, e) => s + estimateSeconds(e.text, e.mode), 0)
  const all = sec(() => true)
  const lines = []
  lines.push(`Giọng: ${inv.voice} · style v${inv.styleVersion}`)
  lines.push(`Tổng: ${counts.clips} clip, ${counts.chars} ký tự, ${counts.words} từ`)
  lines.push('')
  lines.push('Theo nguồn (mỗi clip tính một lần, ở chỗ dùng đầu tiên):')
  for (const [k, v] of Object.entries(counts.bySource)) lines.push(`  ${pad(k, 11)}${num(v.clips)} clip ${num(v.chars)} ký tự`)
  lines.push('Theo chế độ:')
  for (const [k, v] of Object.entries(counts.byMode)) lines.push(`  ${pad(k, 11)}${num(v.clips)} clip ${num(v.chars)} ký tự`)
  lines.push('Theo phần:')
  for (const [k, v] of Object.entries(counts.byPart)) lines.push(`  ${pad(k, 11)}${num(v.clips)} clip ${num(v.chars)} ký tự`)
  lines.push(
    `Chỉ dùng ở "Từng cụm" (chép chính tả, browserOnly): ${counts.browserOnly.clips} clip, ${counts.browserOnly.chars} ký tự ` +
      '(có tạo; generate-audio --skip-browser-only để bỏ)',
  )
  lines.push('')
  lines.push(`Ước lượng (chưa có clip thật): ~${formatDuration(all)} âm thanh cần tạo, ~${formatBytes(mp3Bytes(all, kbps))} MP3 ở ${kbps} kbps`)
  return lines.join('\n')
}

async function main(argv) {
  let out = join(DEFAULT_WORK_DIR, 'inventory.json')
  let kbps = DEFAULT_KBPS
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') out = argv[++i]
    else if (a === '--kbps') kbps = Number(argv[++i])
    else throw new Error(`Tham số không hợp lệ: ${a}`)
  }
  if (!out) throw new Error('Thiếu đường dẫn sau --out')
  const m = await importApp('/src/core/audioInventory.ts')
  const inv = m.buildAudioInventory()
  const counts = m.inventoryCounts(inv)
  console.log(formatCounts(counts, inv, kbps))
  const path = isAbsolute(out) ? out : resolve(process.cwd(), out)
  await writeJsonAtomic(path, inventoryJson(inv, counts))
  console.log(`\nĐã ghi ${path}`)
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`[audio:inventory] Lỗi: ${e?.message ?? e}`)
    process.exit(1)
  })
}
