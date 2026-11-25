// The interface-language tool (docs/i18n.md). Vietnamese strings in src/ are the keys of the English dictionaries
// in src/i18n/en/<bundle>/<area>.ts; this script finds the strings, says which have no English yet and writes
// translations into the dictionary files. src/i18n/coverage.test.ts uses the same functions.
//
//   node scripts/i18n-scan.mjs                         counts per area (all strings / without English)
//   node scripts/i18n-scan.mjs --todo <area> <out.json> [ui|explain|meaning]   the strings of one area without English
//   node scripts/i18n-scan.mjs --apply <area> <todo.json> <answers.json>   add { "<id>": "English" } answers
//   node scripts/i18n-scan.mjs --areas                 the dictionary areas and their source files
//   node scripts/i18n-scan.mjs --tag                   tag every untagged Vietnamese template literal with tl
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSync } from 'rolldown/experimental'

export const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
export const SRC = join(ROOT, 'src')
export const EN_DIR = join(SRC, 'i18n', 'en')

/** Accented letters Vietnamese uses. */
const VI_LETTER = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i
/** English words that keep an accent (the loanwords course teaches them): not Vietnamese text. */
const ACCENTED_ENGLISH = /(?<!\p{L})(?:caf[ée]s?|fianc[ée]e?s?|r[ée]sum[ée]s?|d[ée]j[àa] vu|clich[ée]s?|na[ïi]ve|touch[ée]|saut[ée]e?d?|entr[ée]es?|pur[ée]e|cr[èe]me(?: br[ûu]l[ée]e)?|voil[àa]|[àa] la carte|[àa] la|pi[ñn]ata|jalape[ñn]os?|expos[ée]|prot[ée]g[ée]e?|pass[ée]|blas[ée]|risqu[ée]|decor|d[ée]cor|appliqu[ée]|communiqu[ée]|soir[ée]e|matin[ée]e|n[ée]e|ol[ée]|pok[ée]mon|latt[ée]s?|macram[ée]|canap[ée]s?|souffl[ée]s?|consomm[ée]|flamb[ée]|frapp[ée]|gel[ée]e|[ée]clairs?|[ée]lite|[ée]migr[ée]s?|d[ée]but|d[ée]tente|fa[çc]ade|papier-m[âa]ch[ée]|p[âa]t[ée]|ros[ée]|sak[ée]|[àa] propos|vis-[àa]-vis|beyonc[ée])(?!\p{L})/giu

/** True for Vietnamese text (an accented letter left once English loanwords are set aside). */
/**
 * Vietnamese text that has no accented letter at all: course notes "Anh – Anh: SHED-yool.", titles that set two
 * English words side by side with the Vietnamese "hay" (or): "can hay can’t", "'d = would hay had?".
 */
const UNACCENTED_VI = /^Anh – Anh\b/
/** "x hay y" as a short title (never an English sentence such as "Sounds like hay fever."). */
const HAY_TITLE = /\S hay \S/

export function isVietnamese(s) {
  if (UNACCENTED_VI.test(s)) return true
  if (HAY_TITLE.test(s) && s.trim().split(/\s+/).length <= 6) return true
  if (!VI_LETTER.test(s)) return false
  // lesson markup inside an English word (caf[é], résum[é]) is not part of the word
  return VI_LETTER.test(s.replace(/[[\]()]/g, '').replace(ACCENTED_ENGLISH, ''))
}

export function sourceFiles(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (p !== join(SRC, 'i18n')) sourceFiles(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p)
  }
  return out
}

/** What JSX does to the text between tags: lines trimmed, empty lines dropped, the rest joined by one space. */
export function jsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/)
  const kept = []
  lines.forEach((line, i) => {
    let s = line.replace(/\t/g, ' ')
    if (i !== 0) s = s.replace(/^ +/, '')
    if (i !== lines.length - 1) s = s.replace(/ +$/, '')
    if (s) kept.push(s)
  })
  return kept.join(' ')
}

/**
 * Every static string of one file: { kind: 'str' | 'jsx' | 'tpl' | 'tagged', text, line, start, … }.
 * 'tpl' = a template literal with ${…} (text = its parts joined by {}), 'tagged' = a tagged one (`tag` = its tag).
 * `call` = the function the string is a direct argument of (tr, console.warn …), `attr` = its JSX attribute,
 * `prop` = the nearest object key above it, `top` = evaluated when the module loads (outside every function),
 * `concat` = an operand of +.
 */
export function stringsOf(file, code = readFileSync(file, 'utf8')) {
  const { program, errors } = parseSync(file, code, {})
  if (errors.length) throw new Error(`${file}: ${errors[0].message}`)
  const lineStarts = [0]
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1)
  const lineOf = (pos) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
  const out = []
  const calleeName = (c) => {
    if (!c) return undefined
    if (c.type === 'Identifier') return c.name
    if (c.type === 'MemberExpression' && c.property?.type === 'Identifier') {
      const o = calleeName(c.object)
      return o ? `${o}.${c.property.name}` : c.property.name
    }
    return undefined
  }
  const at = (node, ctx) => ({ line: lineOf(node.start), start: node.start, end: node.end, attr: ctx.attr, call: ctx.call, prop: ctx.prop, top: !ctx.fn, concat: ctx.concat })
  const visit = (node, ctx) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const n of node) visit(n, ctx)
      return
    }
    if (typeof node.type !== 'string') return
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
      case 'TSLiteralType':
      case 'TSTypeAnnotation':
      case 'TSTypeAliasDeclaration':
      case 'TSInterfaceDeclaration':
        return
      case 'Literal':
        if (typeof node.value === 'string') out.push({ kind: 'str', text: node.value, ...at(node, ctx) })
        return
      case 'JSXText': {
        const text = jsxText(node.value)
        if (text) out.push({ kind: 'jsx', text, ...at(node, ctx) })
        return
      }
      case 'JSXAttribute':
        visit(node.value, { ...ctx, attr: node.name?.name, call: undefined })
        return
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        for (const key of ['params', 'body']) visit(node[key], { fn: true })
        return
      case 'BinaryExpression':
        if (node.operator === '+') {
          visit(node.left, { ...ctx, concat: true, call: undefined })
          visit(node.right, { ...ctx, concat: true, call: undefined })
          return
        }
        break
      case 'Property':
        if (node.computed) visit(node.key, ctx)
        visit(node.value, { ...ctx, prop: node.key?.name ?? node.key?.value ?? ctx.prop, call: undefined, concat: false })
        return
      case 'CallExpression':
      case 'NewExpression': {
        visit(node.callee, ctx)
        const name = calleeName(node.callee)
        for (const a of node.arguments) visit(a, { ...ctx, call: name })
        return
      }
      case 'TaggedTemplateExpression': {
        const tag = calleeName(node.tag)
        const text = node.quasi.quasis.map((q) => q.value.cooked ?? q.value.raw).join('{}')
        out.push({ kind: 'tagged', tag, text, ...at(node, ctx) })
        visit(node.quasi.expressions, { ...ctx, call: undefined })
        return
      }
      case 'TemplateLiteral': {
        const parts = node.quasis.map((q) => q.value.cooked ?? q.value.raw)
        if (node.expressions.length === 0) out.push({ kind: 'str', text: parts[0], ...at(node, ctx) })
        else out.push({ kind: 'tpl', text: parts.join('{}'), ...at(node, ctx) })
        visit(node.expressions, { ...ctx, call: undefined })
        return
      }
      default:
    }
    const inner = node.type === 'ArrayExpression' || node.type === 'ObjectExpression' || node.type === 'ConditionalExpression' || node.type === 'LogicalExpression' || node.type === 'JSXExpressionContainer' || node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression' || node.type === 'ParenthesizedExpression' ? ctx : { ...ctx, call: undefined }
    for (const key in node) {
      if (key === 'type' || key === 'start' || key === 'end') continue
      const v = node[key]
      if (v && typeof v === 'object') visit(v, inner)
    }
  }
  visit(program, {})
  return out
}

export function rel(file) {
  return relative(ROOT, file).split(sep).join('/')
}

/**
 * The dictionary area ("<bundle>/<name>", the file src/i18n/en/<bundle>/<name>.ts) that holds a source file's
 * strings. Bundles: ui (loaded with English mode), content (too), town (with the town page).
 */
export function areaOf(relPath) {
  const p = relPath.replace(/^src\//, '')
  const seg = p.split('/')
  const base = seg[seg.length - 1].replace(/\.tsx?$/, '')
  if (seg[0] === 'features') {
    if (seg[1] !== 'town') return `ui/${seg[1]}`
    if (seg[2] === 'activities') return 'town/activities'
    if (seg[2] === 'friends' || seg[2] === 'romance') return 'town/people'
    if (seg[2] === 'city') return 'town/city'
    return 'town/page'
  }
  if (seg[0] === 'core') {
    if (seg[1] === 'town') return /^city/.test(base) ? 'town/city' : 'town/rules'
    if (seg[1] === 'ai' || base === 'aiTasks') return 'ui/ai'
    if (seg[1] === 'cloud') return 'ui/cloud'
    if (seg[1] === 'decoder' || seg[1] === 'dictation' || seg[1] === 'review') return `ui/${seg[1]}`
    if (base === 'nav') return 'ui/shell'
    return 'ui/core'
  }
  if (seg[0] === 'data') {
    if (seg[1] === 'courses') return `content/course-${base}`
    if (seg[1] === 'stories') return `town/arc-${base}`
    if (seg[1] === 'romance') return `town/romance-${base}`
    if (seg[1] === 'streetTalks') return 'town/street-talks'
    if (seg[1] === 'cases') return 'town/cases'
    if (seg[1] === 'scenes') return 'town/scenes'
    if (seg[1] === 'city' || base === 'cityWorld') return 'town/city'
    if (/^town/.test(base)) return `town/data-${base.replace(/^town/, '').toLowerCase() || 'town'}`
    return `content/${base}`
  }
  return 'ui/shell'
}

/**
 * Vietnamese interface strings without a single accent (exact text, trimmed), which isVietnamese cannot see. Add a
 * new one here when it appears; in the files of UNACCENTED_NOT it is English being taught, not interface text.
 */
export const UNACCENTED = new Set(['Nghe', 'Nghe:', 'Nghe: {}', 'Nghe, {}', 'Nghe "{}"', 'Nghe "{}" ({})', 'Nghe {}', 'Nghe “{}”', 'nghe: {}', 'Nghe 1.0×', 'Nghe & xem', 'Sai', 'sai', 'Xong', '(xong)', 'Mua', 'Mua {}, {}{}', 'Giao', 'trong', '· trong', 'xu', '{} xu', 'con', 'Nam', 'Hai', 'Ba', 'Nay', 'Mai', 'Con trai', 'Ghi nhanh', 'Tin vui', 'Ngon!', '1,5× nhanh', 'sau {}', '{} tim', '· {} tim', '{}/{} tim', '{}/8 tim', 'Anh', 'Video: {}', 'Link video YouTube', 'Nam Phi', 'Phim/series', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])
const UNACCENTED_NOT = new RegExp('^src/(core/(decoder|dictation)/|core/aiTasks|core/backup|data/(?!town|city|romance|stories|streetTalks|cases))')

/** Strings the app never shows as interface text (messages for the console, prompts for the model, tables of sounds). */
const SKIP_FILES = new Set(['src/core/aiTasks.ts'])
const SKIP_CALLS = /^(?:console\.\w+|RegExp)$/

/** Kinds of Vietnamese string that need an English entry: plain strings / JSX text ('text') and tl templates ('tl'). */
export function translatable(relPath, entries) {
  if (SKIP_FILES.has(relPath)) return []
  const out = []
  for (const s of entries) {
    if (!isVietnamese(s.text) && !(UNACCENTED.has(s.text.trim()) && !UNACCENTED_NOT.test(relPath))) continue
    if (s.call && SKIP_CALLS.test(s.call)) continue
    if (s.kind === 'tagged' && s.tag !== 'tl') continue
    const kind = s.kind === 'tagged' ? 'tl' : s.kind === 'tpl' ? 'untagged' : 'text'
    out.push({ ...s, kind, key: kind === 'text' ? s.text.trim() : s.text })
  }
  return out
}

/** Every string that needs English, with its file and area. */
export function allTranslatable() {
  const out = []
  for (const file of sourceFiles()) {
    const r = rel(file)
    const area = areaOf(r)
    for (const s of translatable(r, stringsOf(file))) out.push({ ...s, file: r, area, class: classOf(r, area, s.prop) })
  }
  return out
}

/** Content fields that hold the meaning of an English line, or an answer to "what did they say / mean". */
const MEANING_PROPS = new Set(['vi', 'options', 'intent', 'q', 'question'])

/**
 * What a string is, for the phases of the translation (docs/i18n.md §4):
 * 'ui' = interface text in the code; 'explain' = content that explains or narrates (lesson blocks, notes, scenes,
 * names of things); 'meaning' = the Vietnamese meaning of an English line and the answers of the comprehension checks.
 */
export function classOf(relPath, area, prop) {
  if (!relPath.startsWith('src/data/')) return 'ui'
  if (area === 'content/chunks' || area === 'town/data-soundalikes' || area === 'town/data-cafe') return 'meaning'
  if (area === 'content/benchmark') return prop === 'why' ? 'explain' : 'meaning'
  if (area === 'content/sentences') return prop === 'vi' ? 'meaning' : 'explain'
  if (area.startsWith('content/')) return 'explain'
  return MEANING_PROPS.has(prop) ? 'meaning' : 'explain'
}

// ───────────────────────── dictionaries ─────────────────────────

/** Reads one dictionary file (an object literal of 'source': 'English'). */
export function readDictionary(file) {
  const out = new Map()
  if (!existsSync(file)) return out
  const code = readFileSync(file, 'utf8')
  const { program } = parseSync(file, code, {})
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.type === 'Property' && node.value?.type === 'Literal' && typeof node.value.value === 'string') {
      const key = node.key.type === 'Literal' ? node.key.value : node.key.name
      out.set(String(key), node.value.value)
      return
    }
    if (node.type === 'Property' && node.value?.type === 'TemplateLiteral' && node.value.expressions.length === 0) {
      const key = node.key.type === 'Literal' ? node.key.value : node.key.name
      out.set(String(key), node.value.quasis[0].value.cooked)
      return
    }
    for (const k in node) if (k !== 'type' && node[k] && typeof node[k] === 'object') walk(node[k])
  }
  walk(program)
  return out
}

/** area ("ui/shell") → Map(source → English), for every dictionary file on disk. */
export function readAllDictionaries() {
  const out = new Map()
  if (!existsSync(EN_DIR)) return out
  for (const bundle of readdirSync(EN_DIR)) {
    const dir = join(EN_DIR, bundle)
    if (!statSync(dir).isDirectory()) continue
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.ts')) out.set(`${bundle}/${name.replace(/\.ts$/, '')}`, readDictionary(join(dir, name)))
    }
  }
  return out
}

/** The bundles a string of this bundle can count on at run time: 'ui' and 'content' load together, 'town' on top. */
export function visibleBundles(bundle) {
  return bundle === 'town' ? ['ui', 'content', 'town'] : ['ui', 'content']
}

/** source → English over the bundles visible from `bundle`. */
export function visibleEntries(dicts, bundle) {
  const out = new Map()
  const seen = visibleBundles(bundle)
  for (const [area, d] of dicts) if (seen.includes(area.split('/')[0])) for (const [k, v] of d) if (!out.has(k)) out.set(k, v)
  return out
}

/** The strings without an English entry, per area. */
export function missingByArea(all = allTranslatable(), dicts = readAllDictionaries()) {
  const out = new Map()
  const visible = new Map()
  for (const s of all) {
    const bundle = s.area.split('/')[0]
    if (!visible.has(bundle)) visible.set(bundle, visibleEntries(dicts, bundle))
    if (s.kind !== 'untagged' && visible.get(bundle).has(s.key)) continue
    const list = out.get(s.area) ?? []
    list.push(s)
    out.set(s.area, list)
  }
  return out
}

const quote = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"

/** Slot numbers an English template uses ({0}, {1|a|b} …). */
export function slotsUsed(english) {
  return [...english.matchAll(/\{(\d+)(?:\|[^|}]*\|[^}]*)?\}/g)].map((m) => Number(m[1]))
}

export function writeDictionary(area, entries) {
  const file = join(EN_DIR, `${area}.ts`)
  mkdirSync(dirname(file), { recursive: true })
  const name = area.split('/')[1].replace(/-(\w)/g, (_m, c) => c.toUpperCase())
  const lines = [`// English for the '${area}' area (docs/i18n.md). Keys are the Vietnamese strings exactly as written in the code;`, `// a key with {} is a tl template: its English uses {0}, {1}… and {0|one|many} for a plural.`, `const ${name}: Record<string, string> = {`]
  for (const [k, v] of entries) lines.push(`  ${quote(k)}: ${quote(v)},`)
  lines.push('};', '', `export default ${name};`, '')
  writeFileSync(file, lines.join('\n'))
  writeBundles()
}

/** Regenerates src/i18n/en/<bundle>.ts from the area files on disk. */
export function writeBundles() {
  const about = {
    ui: 'the shell, every page but the town, and the texts core logic writes',
    content: 'lessons, courses, sentences, chunks, pairs, checkup forms',
    town: 'the town page, its rules (core/town) and its content',
  }
  for (const bundle of Object.keys(about)) {
    const dir = join(EN_DIR, bundle)
    const names = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.ts')).map((n) => n.replace(/\.ts$/, '')).sort() : []
    const id = (n) => n.replace(/-(\w)/g, (_m, c) => c.toUpperCase())
    const lines = [`// English dictionary bundle '${bundle}' (docs/i18n.md): ${about[bundle]}.`, `// Generated by scripts/i18n-scan.mjs from the files in ./${bundle}/: do not edit by hand.`, `import { mergeDictionaries } from '../merge';`]
    for (const n of names) lines.push(`import ${id(n)} from './${bundle}/${n}';`)
    lines.push('', `export default mergeDictionaries({ ${names.map(id).join(', ')} });`, '')
    writeFileSync(join(EN_DIR, `${bundle}.ts`), lines.join('\n'))
  }
}

// ───────────────────────── command line ─────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, ...args] = process.argv.slice(2)
  const all = allTranslatable()
  const dicts = readAllDictionaries()
  if (cmd === '--todo') {
    const [area, outFile, only] = args
    const seen = new Set()
    const todo = []
    for (const s of missingByArea(all, dicts).get(area) ?? []) {
      if (only && s.class !== only) continue
      if (seen.has(s.key)) continue
      seen.add(s.key)
      todo.push({ id: todo.length + 1, vi: s.key, kind: s.kind, at: `${s.file}:${s.line}`, ...(s.prop ? { field: s.prop } : {}) })
    }
    writeFileSync(outFile, JSON.stringify(todo, null, 1))
    console.log(`${area}: ${todo.length} strings without English → ${outFile}`)
  } else if (cmd === '--apply') {
    const [area, todoFile, answersFile] = args
    const todo = JSON.parse(readFileSync(todoFile, 'utf8'))
    const answers = JSON.parse(readFileSync(answersFile, 'utf8'))
    const entries = dicts.get(area) ?? new Map()
    const visible = visibleEntries(dicts, area.split('/')[0])
    let added = 0
    const problems = []
    for (const item of todo) {
      const en = answers[String(item.id)]
      if (typeof en !== 'string') {
        problems.push(`#${item.id} no answer: ${item.vi.slice(0, 60)}`)
        continue
      }
      if (isVietnamese(en)) problems.push(`#${item.id} still Vietnamese: ${en.slice(0, 60)}`)
      if (item.kind === 'tl') {
        const slots = item.vi.split('{}').length - 1
        const used = slotsUsed(en)
        if (used.some((i) => i >= slots)) problems.push(`#${item.id} uses a slot the template does not have: ${en.slice(0, 60)}`)
        if (/\{\}/.test(en)) problems.push(`#${item.id} has {} (write {0}, {1}…): ${en.slice(0, 60)}`)
      }
      if (visible.has(item.vi) && !entries.has(item.vi)) continue
      entries.set(item.vi, en)
      added++
    }
    writeDictionary(area, entries)
    console.log(`${area}: ${added} entries written (${entries.size} in the file)`)
    if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'))
  } else if (cmd === '--areas') {
    const files = new Map()
    for (const s of all) files.set(s.area, (files.get(s.area) ?? new Set()).add(s.file))
    for (const [area, set] of [...files].sort()) console.log(area + '\n  ' + [...set].join('\n  '))
  } else if (cmd === '--tag') {
    const byFile = new Map()
    for (const s of all) if (s.kind === 'untagged' && !s.top) byFile.set(s.file, [...(byFile.get(s.file) ?? []), s])
    for (const [r, found] of byFile) {
      const file = join(ROOT, r)
      const code = readFileSync(file, 'utf8')
      let out = code
      for (const s of [...found].sort((a, b) => b.start - a.start)) {
        if (code[s.start] !== '`') throw new Error(`${r}:${s.line} is not a template literal`)
        out = out.slice(0, s.start) + 'tl' + out.slice(s.start)
      }
      let spec = relative(dirname(file), join(SRC, 'i18n')).split(sep).join('/')
      if (!spec.startsWith('.')) spec = './' + spec
      const imports = parseSync(file, code, {}).program.body.filter((n) => n.type === 'ImportDeclaration')
      const mine = imports.find((n) => n.source.value === spec && n.importKind !== 'type')
      if (!mine) {
        const eol = code.includes(String.fromCharCode(13, 10)) ? String.fromCharCode(13, 10) : String.fromCharCode(10)
        const line = `import { tl } from '${spec}';`
        const end = imports.length ? imports[imports.length - 1].end : 0
        out = imports.length ? out.slice(0, end) + eol + line + out.slice(end) : line + eol + out
      } else if (!mine.specifiers.some((sp) => sp.local?.name === 'tl')) {
        console.log(`${r}: add tl to its import from '${spec}' by hand`)
      }
      writeFileSync(file, out)
      console.log(`${r}: ${found.length} tagged`)
    }
  } else if (cmd === '--bundles') {
    writeBundles()
  } else {
    const missing = missingByArea(all, dicts)
    const stats = new Map()
    for (const s of all) {
      const a = stats.get(s.area) ?? { files: new Set(), keys: new Set(), chars: 0 }
      a.files.add(s.file)
      if (!a.keys.has(s.key)) a.chars += s.key.length
      a.keys.add(s.key)
      stats.set(s.area, a)
    }
    let tk = 0
    let tm = 0
    let tc = 0
    const byClass = new Map()
    for (const [area, list] of missing) {
      for (const s of list) {
        const c = byClass.get(s.class) ?? { keys: new Set(), chars: 0 }
        const id = area.split('/')[0] + '|' + s.key
        if (!c.keys.has(id)) c.chars += s.key.length
        c.keys.add(id)
        byClass.set(s.class, c)
      }
    }
    console.log('area'.padEnd(30), 'files', 'strings', 'chars', 'no English')
    for (const [area, a] of [...stats].sort()) {
      const m = new Set((missing.get(area) ?? []).map((s) => s.key)).size
      console.log(area.padEnd(30), String(a.files.size).padStart(5), String(a.keys.size).padStart(7), String(a.chars).padStart(6), String(m).padStart(9))
      tk += a.keys.size
      tm += m
      tc += a.chars
    }
    console.log('TOTAL'.padEnd(30), ''.padStart(5), String(tk).padStart(7), String(tc).padStart(6), String(tm).padStart(9))
    for (const [name, c] of [...byClass].sort()) console.log(`without English, ${name}:`.padEnd(30), String(c.keys.size).padStart(13), String(c.chars).padStart(6), 'chars')
  }
}
