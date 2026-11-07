// Pure helpers for the drill: fuzzy answer checking and highlighting the chunk in its example.

const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bshan't\b/g, 'shall not'],
  [/\bain't\b/g, 'is not'],
  [/\blet's\b/g, 'let us'],
  [/\by'all\b/g, 'you all'],
  [/'em\b/g, 'them'],
  [/n't\b/g, ' not'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/'m\b/g, ' am'],
];

/** Contractions typed without the apostrophe (only unambiguous ones). */
const NO_APOSTROPHE: Record<string, string> = {
  im: 'i am',
  dont: 'do not',
  doesnt: 'does not',
  didnt: 'did not',
  cant: 'can not',
  wont: 'will not',
  isnt: 'is not',
  arent: 'are not',
  wasnt: 'was not',
  werent: 'were not',
  havent: 'have not',
  hasnt: 'has not',
  hadnt: 'had not',
  couldnt: 'could not',
  shouldnt: 'should not',
  wouldnt: 'would not',
  mustnt: 'must not',
  youre: 'you are',
  theyre: 'they are',
  ive: 'i have',
  youve: 'you have',
  weve: 'we have',
  theyve: 'they have',
  youll: 'you will',
  theyll: 'they will',
  thats: 'that is',
  whats: 'what is',
  hes: 'he is',
  shes: 'she is',
  its: 'it is',
  theres: 'there is',
};

/** Common reductions → their full written form. */
const REDUCTIONS: Record<string, string> = {
  gonna: 'going to',
  wanna: 'want to',
  gotta: 'got to',
  hafta: 'have to',
  hasta: 'has to',
  kinda: 'kind of',
  sorta: 'sort of',
  lotta: 'lot of',
  lotsa: 'lots of',
  outta: 'out of',
  lemme: 'let me',
  gimme: 'give me',
  dunno: 'do not know',
  ya: 'you',
  yah: 'you',
  coulda: 'could have',
  shoulda: 'should have',
  woulda: 'would have',
  musta: 'must have',
  oughta: 'ought to',
  tryna: 'trying to',
  whatcha: 'what are you',
  gotcha: 'got you',
  betcha: 'bet you',
  didja: 'did you',
  cuz: 'because',
  cause: 'because',
};

/** Lowercase, unify apostrophes, drop punctuation (keep apostrophes), collapse spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[əʌ]/g, 'a')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Letters and digits only — "wan-chu" and "wan chu" both → "wanchu". */
export function compact(s: string): string {
  return normalize(s).replace(/[^a-z0-9]/g, '');
}

function expand(s: string, sForm: string, dForm: string): string {
  let out = s;
  for (const [re, rep] of CONTRACTIONS) out = out.replace(re, rep);
  out = out.replace(/'s\b/g, ` ${sForm}`).replace(/'d\b/g, ` ${dForm}`);
  out = out
    .split(' ')
    .map((w) => {
      const bare = w.replace(/'/g, '');
      return REDUCTIONS[bare] ?? NO_APOSTROPHE[bare] ?? bare;
    })
    .join(' ');
  return out.replace(/\s+/g, ' ').trim();
}

/** All accepted canonical spellings of a phrase (contractions and reductions expanded). */
export function variants(s: string): Set<string> {
  const n = normalize(s);
  const out = new Set<string>();
  if (!n) return out;
  out.add(n.replace(/'/g, ''));
  out.add(expand(n, 'is', 'would'));
  out.add(expand(n, 'has', 'had'));
  out.add(expand(n, 'us', 'did'));
  return out;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** One typo inside a real word: same first letter, both words 4+ letters, not a negation flip (can/cant). */
function isWordTypo(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || a[0] !== b[0]) return false;
  if (a.endsWith('nt') !== b.endsWith('nt')) return false;
  return levenshtein(a, b) <= 1;
}

/** Same words in the same order, at most one of them with a small typo. */
function wordsMatchWithTypo(a: string, b: string): boolean {
  const wa = a.split(' ');
  const wb = b.split(' ');
  if (wa.length !== wb.length) return false;
  let typos = 0;
  for (let i = 0; i < wa.length; i++) {
    if (wa[i] === wb[i]) continue;
    if (!isWordTypo(wa[i], wb[i])) return false;
    typos += 1;
  }
  return typos <= 1;
}

const lettersOnly = (v: string) => v.replace(/[^a-z0-9]/g, '');

/**
 * Did the learner type the chunk? Accepts the written form, the spoken respelling,
 * contraction/reduction equivalents, and one small typo for longer phrases.
 * A typo may never turn one real word into another (could ↔ would, can ↔ can't)
 * nor add or drop a whole word (I would have ↔ would have).
 */
export function isGuessCorrect(guess: string, target: { written: string; spoken: string }): boolean {
  const g = variants(guess);
  if (g.size === 0) return false;
  const targets = new Set<string>([...variants(target.written), ...variants(target.spoken)]);

  for (const v of g) if (targets.has(v)) return true;

  // Spacing and hyphens do not matter: "wan chu" / "wanchu" for "wan-chu".
  const gc = new Set([...g].map(lettersOnly).filter(Boolean));
  const tc = new Set([...targets].map(lettersOnly).filter(Boolean));
  for (const a of gc) if (tc.has(a)) return true;

  // One typo in a real word of the written / expanded form.
  for (const a of g) for (const b of targets) if (wordsMatchWithTypo(a, b)) return true;

  // One typo against the respelling (not real words, so compare letters only).
  const spokenC = new Set([...variants(target.spoken)].map(lettersOnly).filter(Boolean));
  for (const a of gc) {
    for (const b of spokenC) {
      if (Math.min(a.length, b.length) >= 7 && a[0] === b[0] && levenshtein(a, b) <= 1) return true;
    }
  }
  return false;
}

export interface HighlightParts {
  before: string;
  match: string;
  after: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the first candidate inside `text` (case-insensitive, apostrophe-insensitive),
 * preferring whole-word matches. Returns null when none is found.
 */
/** Lowercase + unify apostrophes, keeping the exact length of `s` so indices map 1:1. */
function foldSameLength(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const lo = ch.toLowerCase();
    out += lo.length === 1 ? lo : ch; // e.g. "İ" lowercases to 2 code units: keep it as is
  }
  return out.replace(/[‘’ʼ]/g, "'");
}

/**
 * Find the first candidate inside `text` (case-insensitive, apostrophe-insensitive,
 * any run of spaces between words), preferring whole-word matches. A second pass accepts
 * a match that starts at a word but runs into a longer word ("help" in "helpful"),
 * never one that starts mid-word ("have to" inside "behave to"). Returns null when none is found.
 */
export function splitHighlight(text: string, candidates: readonly string[]): HighlightParts | null {
  if (typeof text !== 'string' || !text) return null;
  const hay = foldSameLength(text);
  const needles = candidates
    .filter((c): c is string => typeof c === 'string')
    .map((c) => foldSameLength(c).trim())
    .filter((c) => c.length > 0);

  const at = (start: number, len: number): HighlightParts => ({
    before: text.slice(0, start),
    match: text.slice(start, start + len),
    after: text.slice(start + len),
  });
  const pattern = (n: string) => n.split(/\s+/).map(escapeRe).join('\\s+');

  for (const n of needles) {
    const m = new RegExp(`(^|[^a-z0-9'])(${pattern(n)})(?![a-z0-9])`).exec(hay);
    if (m) return at(m.index + m[1].length, m[2].length);
  }
  for (const n of needles) {
    if (n.length < 3) continue;
    const m = new RegExp(`(^|[^a-z0-9'])(${pattern(n)})`).exec(hay);
    if (m) return at(m.index + m[1].length, m[2].length);
  }
  return null;
}

/** "want to" → "want, to": each word in citation form for slow, clear TTS. */
export function citationText(written: string): string {
  return written
    .split(/\s+/)
    .filter(Boolean)
    .join(', ');
}
