// Content checks for lessons of every course (used by courses.test.ts; not imported by the app).
// Each check returns human-readable problems ("irr-colonel quiz 3: …") so a failing test says what to fix.
// Rules and examples: docs/courses.md.
import { COURSE_IDS, isCourseId } from '../../core/lessons';
import { PHENOMENON_INFO } from '../../core/phenomena';
import type { Lesson, LessonBlock, QuizItem } from '../../data/lessonTypes';
import { correctIndices, keyOf, optionLabels, parseGap, parseMark, parseMd, silentItemValid, spotOptions } from './logic';

export const QUIZ_LENGTH = 8;

/**
 * Words that sound the same in General American. Two of them never appear together as options of an item the
 * learner answers by ear (listen-choose; choose with `play`): TTS cannot make them different.
 */
export const HOMOPHONE_GROUPS: readonly (readonly string[])[] = [
  ['knight', 'night'], ['knew', 'new'], ['know', 'no'], ['knows', 'nose'], ['knot', 'not'], ['knead', 'need'],
  ['write', 'right', 'rite'], ['wrap', 'rap'], ['wring', 'ring'], ['wrote', 'rote'], ['wrest', 'rest'],
  ['hour', 'our'], ['whole', 'hole'], ['wholly', 'holy'], ['red', 'read'], ['reed', 'read'], ['lead', 'led'],
  ['sea', 'see'], ['wait', 'weight'], ['way', 'weigh'], ['there', 'their', "they're"], ['to', 'too', 'two'],
  ['buy', 'by', 'bye'], ['eight', 'ate'], ['mail', 'male'], ['flower', 'flour'], ['sun', 'son'], ['one', 'won'],
  ['meet', 'meat'], ['week', 'weak'], ['plane', 'plain'], ['whether', 'weather'], ['which', 'witch'],
  ['where', 'wear', 'ware'], ['piece', 'peace'], ['tail', 'tale'], ['sail', 'sale'], ['made', 'maid'],
  ['threw', 'through'], ['scene', 'seen'], ['cent', 'sent', 'scent'], ['aloud', 'allowed'], ['colonel', 'kernel'],
  ['hair', 'hare'], ['hymn', 'him'], ['bored', 'board'], ['fair', 'fare'], ['hear', 'here'], ['pair', 'pear', 'pare'],
  ['bear', 'bare'], ['steal', 'steel'], ['course', 'coarse'], ['break', 'brake'], ['rows', 'rose'], ['die', 'dye'],
  ['berry', 'bury'], ['pause', 'paws'], ['wood', 'would'], ['isle', 'aisle', "i'll"], ['sight', 'site', 'cite'],
  ['sword', 'soared'], ['muscle', 'mussel'], ['dough', 'doe'], ['bough', 'bow'], ['caught', 'cot'],
  ['taught', 'taut'], ['knit', 'nit'], ['lamb', 'lam'], ['yolk', 'yoke'], ['wrung', 'rung'], ['wry', 'rye'],
  ['ceiling', 'sealing'], ['cereal', 'serial'], ['council', 'counsel'], ['principal', 'principle'],
  ['stationary', 'stationery'], ['complement', 'compliment'], ['bass', 'base'], ['higher', 'hire'], ['flu', 'flew'],
  ['blue', 'blew'], ['chews', 'choose'], ['heel', 'heal', "he'll"], ['missed', 'mist'], ['passed', 'past'],
  ['guessed', 'guest'], ['band', 'banned'], ['find', 'fined'], ['mind', 'mined'], ['tide', 'tied'],
  ['road', 'rode', 'rowed'], ['so', 'sew', 'sow'], ['toe', 'tow'], ['nun', 'none'], ['some', 'sum'],
  ['for', 'four', 'fore'], ['or', 'oar', 'ore'], ['oh', 'owe'], ['I', 'eye', 'aye'], ['you', 'ewe', 'yew'],
  ['be', 'bee'], ['we', 'wee'], ['in', 'inn'], ['its', "it's"], ['your', "you're"],
  ["who's", 'whose'], ['mince', 'mints'], ['prince', 'prints'], ['tense', 'tents'], ['cents', 'sense'],
];

/**
 * Words spelled the same but said differently by meaning (heteronyms). A words-table row for one needs `say`
 * (a context sentence), and a lone one is never the text a listening item plays.
 */
export const HETERONYMS: ReadonlySet<string> = new Set([
  'read', 'lead', 'live', 'wind', 'tear', 'bow', 'close', 'use', 'record', 'present', 'minute', 'wound', 'desert',
  'object', 'content', 'row', 'bass', 'dove', 'sow', 'polish', 'produce', 'project', 'refuse', 'subject', 'permit',
  'conduct', 'contract', 'convert', 'invalid', 'moped', 'number', 'resume', 'separate', 'house', 'excuse', 'does',
  'lives', 'wounded', 'sewer', 'entrance', 'console', 'compact', 'attribute', 'contest', 'incense', 'putting',
]);

/** Pairs of options that sound alike (single-word options; case-insensitive). */
export function homophoneClashes(options: readonly string[]): string[] {
  const keys = options.map(keyOf);
  const out: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (keys[i] === keys[j]) continue;
      const same = HOMOPHONE_GROUPS.some((g) => {
        const lower = g.map((w) => w.toLowerCase());
        return lower.includes(keys[i]) && lower.includes(keys[j]);
      });
      if (same) out.push(`${keys[i]} / ${keys[j]}`);
    }
  }
  return out;
}

/** Every string inside a value (deep). */
function allStrings(o: unknown, out: string[] = []): string[] {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) for (const x of o) allStrings(x, out);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) allStrings(v, out);
  return out;
}

const blank = (s: unknown) => typeof s !== 'string' || !s.trim();
/** Monospace markup: backticks, <code>, <kbd>, <pre>. Respellings are plain text (rendered with .respell). */
const MONO = /`|<\/?(code|kbd|pre|tt|samp)\b/i;
/** The app's slugs: lowercase letters, digits and hyphens. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkBlock(b: LessonBlock, where: string, out: string[]): void {
  switch (b.type) {
    case 'text':
    case 'tip':
      if (blank(b.md) || parseMd(b.md).length === 0) out.push(`${where}: empty ${b.type}`);
      return;
    case 'rule':
      if (blank(b.title) || blank(b.body)) out.push(`${where}: rule needs title and body`);
      return;
    case 'compare':
      if (blank(b.clear) || blank(b.natural) || blank(b.note)) out.push(`${where}: compare needs clear, natural, note`);
      return;
    case 'examples':
      if (!b.items.length || b.items.some((e) => blank(e.text))) out.push(`${where}: examples need non-empty items`);
      return;
    case 'story':
      if (blank(b.title)) out.push(`${where}: story needs a title`);
      if (blank(b.md) || parseMd(b.md).length === 0) out.push(`${where}: story md is empty`);
      if (b.words) {
        if (b.words.some(blank)) out.push(`${where}: story words must be non-empty`);
        if (new Set(b.words.map((w) => w.toLowerCase())).size !== b.words.length) out.push(`${where}: story words repeat`);
      }
      return;
    case 'words': {
      if (!b.items.length) out.push(`${where}: words block has no items`);
      if (b.title !== undefined && blank(b.title)) out.push(`${where}: words title is empty`);
      b.items.forEach((it, i) => {
        const w = `${where} word ${i} (${it.word})`;
        if (blank(it.word) || it.word !== it.word.trim()) out.push(`${w}: word must be non-empty and trimmed`);
        if (blank(it.sound)) out.push(`${w}: sound (respelling) is empty`);
        else if (/[/[\]]/.test(it.sound)) out.push(`${w}: sound is a plain respelling (IPA goes in ipa, no / or [ ])`);
        if (it.ipa !== undefined && !/^\/[^/]+\/$/.test(it.ipa.trim())) out.push(`${w}: ipa must look like /…/`);
        if (it.mark !== undefined && !parseMark(it.word, it.mark)) {
          out.push(`${w}: mark "${it.mark}" must be the word with [..] / (..) groups (not nested, not empty)`);
        }
        for (const k of ['note', 'why', 'say'] as const) if (it[k] !== undefined && blank(it[k])) out.push(`${w}: ${k} is empty`);
        if (HETERONYMS.has(it.word.toLowerCase()) && (blank(it.say) || keyOf(it.say ?? '') === keyOf(it.word))) {
          out.push(`${w}: "${it.word}" is a heteronym: add say with a context sentence`);
        }
      });
      return;
    }
  }
}

function checkQuizItem(q: QuizItem, lesson: Lesson, where: string, out: string[]): void {
  if (blank(q.explain)) out.push(`${where}: explain is empty`);
  for (const p of q.phenomena ?? []) if (!PHENOMENON_INFO[p]) out.push(`${where}: unknown phenomenon ${p}`);
  if (lesson.course !== 'connected') {
    if (q.phenomena?.length) out.push(`${where}: only course "connected" items carry phenomena`);
    if (q.type === 'which-rule') out.push(`${where}: which-rule (connected-speech phenomena) belongs to course "connected"`);
  }
  const uniqueLabels = () => {
    const labels = optionLabels(q);
    if (new Set(labels.map((l) => l.trim().toLowerCase())).size !== labels.length) out.push(`${where}: options repeat`);
    if (labels.some(blank)) out.push(`${where}: an option is empty`);
  };
  switch (q.type) {
    case 'listen-choose': {
      if (q.options.length < 3 || q.options.length > 4) out.push(`${where}: listen-choose needs 3–4 options`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) out.push(`${where}: answer out of range`);
      uniqueLabels();
      const clash = homophoneClashes(q.options);
      if (clash.length) out.push(`${where}: options sound the same (${clash.join(', ')})`);
      const spoken = q.say ?? q.options[q.answer] ?? '';
      if (HETERONYMS.has(keyOf(spoken))) out.push(`${where}: plays a lone heteronym "${spoken}" (use a sentence)`);
      return;
    }
    case 'listen-type':
      if (!parseGap(q.text)) out.push(`${where}: listen-type text needs exactly one [gap]`);
      return;
    case 'spot': {
      if (blank(q.prompt)) out.push(`${where}: spot prompt is empty`);
      const keys = spotOptions(q.text, q.unit).map(keyOf);
      if (keys.length < 2) out.push(`${where}: spot needs 2+ chips`);
      for (const a of q.answers) if (!keys.includes(keyOf(a))) out.push(`${where}: spot answer "${a}" is not a chip`);
      if (correctIndices(q).length >= keys.length) out.push(`${where}: every chip is correct`);
      return;
    }
    case 'which-rule':
      if (q.options.length < 3 || new Set(q.options).size !== q.options.length || !q.options.includes(q.answer)) {
        out.push(`${where}: which-rule needs 3+ unique options including the answer`);
      }
      return;
    case 'choose': {
      if (blank(q.prompt)) out.push(`${where}: choose prompt is empty`);
      if (q.options.length < 2 || q.options.length > 4) out.push(`${where}: choose needs 2–4 options`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) out.push(`${where}: answer out of range`);
      uniqueLabels();
      if (q.show !== undefined && blank(q.show)) out.push(`${where}: show is empty`);
      if (q.play !== undefined) {
        if (blank(q.play)) out.push(`${where}: play is empty`);
        if (HETERONYMS.has(keyOf(q.play))) out.push(`${where}: plays a lone heteronym "${q.play}" (use a sentence)`);
        const clash = homophoneClashes(q.options);
        if (clash.length) out.push(`${where}: listening options sound the same (${clash.join(', ')})`);
      }
      return;
    }
    case 'silent-letter':
      if (blank(q.word) || /\s/.test(q.word.trim())) out.push(`${where}: silent-letter word must be one word`);
      else if (!silentItemValid(q)) {
        out.push(`${where}: silent indices ${JSON.stringify(q.silent)} must be unique letter positions of "${q.word}" (0-based), not all of them`);
      }
      if (q.prompt !== undefined && blank(q.prompt)) out.push(`${where}: prompt is empty`);
      return;
    default:
      out.push(`${where}: unknown quiz type ${(q as { type?: string }).type}`);
  }
}

/** Problems of one lesson (any course). Empty when it is fine. */
export function lessonProblems(lesson: Lesson): string[] {
  const out: string[] = [];
  const id = lesson.id;
  if (!SLUG.test(id ?? '')) out.push(`${id}: id must be a lowercase slug`);
  if (!isCourseId(lesson.course)) out.push(`${id}: unknown course "${lesson.course}" (one of ${COURSE_IDS.join(', ')})`);
  if (!Number.isInteger(lesson.order) || lesson.order < 1) out.push(`${id}: order must be 1, 2, 3…`);
  for (const k of ['title', 'summary', 'goal'] as const) if (blank(lesson[k])) out.push(`${id}: ${k} is empty`);
  if (!(lesson.minutes > 0)) out.push(`${id}: minutes must be > 0`);
  if (lesson.course !== 'connected' && lesson.phenomenon !== null) out.push(`${id}: phenomenon must be null outside course "connected"`);
  if (!Array.isArray(lesson.sections) || lesson.sections.length < 2) out.push(`${id}: needs 2+ sections`);
  (lesson.sections ?? []).forEach((s, si) => {
    if (blank(s.title)) out.push(`${id} section ${si}: title is empty`);
    if (!s.blocks?.length) out.push(`${id} section ${si}: no blocks`);
    (s.blocks ?? []).forEach((b, bi) => checkBlock(b, `${id} section ${si} block ${bi}`, out));
  });
  if (!Array.isArray(lesson.quiz) || lesson.quiz.length !== QUIZ_LENGTH) out.push(`${id}: quiz must have ${QUIZ_LENGTH} items`);
  (lesson.quiz ?? []).forEach((q, i) => checkQuizItem(q, lesson, `${id} quiz ${i}`, out));
  for (const s of allStrings(lesson)) if (MONO.test(s)) out.push(`${id}: monospace markup (\` or <code>) in "${s.slice(0, 40)}"`);
  return out;
}

/** Problems across a catalogue: unique ids, contiguous order 1..n within each course. */
export function catalogueProblems(lessons: readonly Lesson[]): string[] {
  const out: string[] = [];
  const ids = new Map<string, number>();
  for (const l of lessons) ids.set(l.id, (ids.get(l.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) out.push(`duplicate lesson id "${id}" (${n}×)`);
  for (const c of COURSE_IDS) {
    const orders = lessons.filter((l) => l.course === c).map((l) => l.order).sort((a, b) => a - b);
    const want = orders.map((_, i) => i + 1);
    if (orders.join() !== want.join()) out.push(`course ${c}: orders must be 1..${orders.length}, got ${orders.join(', ')}`);
  }
  return out;
}
