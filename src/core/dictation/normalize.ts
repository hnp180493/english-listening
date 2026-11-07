// Text normalisation for dictation checking.
//
// Both the target sentence and the learner's answer are turned into a list of
// CANONICAL tokens before alignment, so equivalent spellings compare equal:
//   "I'm" = "I am", "gonna" = "going to", "2" = "two", "can't" = "cannot" = "can not" …
// A canonical token may hold alternatives separated by "|" ("would|had" for "'d"),
// which matches any of its alternatives.
//
// Every canonical token remembers the index of the ORIGINAL token it came from,
// so errors can be mapped back to decoder tokens / annotations.

/** Canonical token list plus a map back to original token indices. */
export interface Canon {
  words: string[]; // canonical tokens, may contain "a|b" alternatives
  origin: number[]; // origin[k] = index of the original token words[k] came from
}

const APOSTROPHES = /[‘’‛ʼ′`´]/g;
const DOUBLE_QUOTES = /[“”„«»″]/g;

/** Split a sentence into raw (as typed) whitespace-separated tokens. */
export function splitWords(text: string): string[] {
  return (text ?? '').split(/\s+/).filter((w) => w.length > 0);
}

/** Own-property lookup: plain-object maps must not answer "constructor" / "__proto__". */
function lookup<V>(map: Record<string, V>, key: string): V | undefined {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

/** Lowercase + unify quote characters. */
function basicClean(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(APOSTROPHES, "'").replace(DOUBLE_QUOTES, '"');
}

// Words written with a leading apostrophe that should keep a meaning.
const LEADING_APOS: Record<string, string> = {
  "'cause": 'because',
  "'cos": 'because',
  "'em": 'them',
  "'til": 'until',
  "'till": 'until',
  "'bout": 'about',
  "'round": 'around',
  // contraction suffixes split off as their own token ("I 'm", "do n't")
  "'m": 'am',
  "'re": 'are',
  "'ve": 'have',
  "'ll": 'will',
  "'d": 'would|had',
};

/**
 * Normalise one raw token into zero or more plain lowercase pieces:
 * punctuation stripped (apostrophes inside words kept), hyphens/dashes split,
 * "7:30" → ["7","30"], "1,000" → ["1000"], "2.5" → ["2","point","5"], "50%" → ["50","percent"].
 */
export function normalizeToken(raw: string): string[] {
  let s = basicClean(raw ?? '');
  s = s.replace(/(\d),(?=\d{3}\b)/g, '$1'); // 1,000 → 1000
  s = s.replace(/(\d)\.(\d)/g, '$1 point $2'); // 2.5 → 2 point 5
  s = s.replace(/(\d):(\d)/g, '$1 $2'); // 7:30 → 7 30
  s = s.replace(/%/g, ' percent ');
  s = s.replace(/&/g, ' and ');
  // Anything that is not a letter, digit or apostrophe becomes a separator.
  s = s.replace(/[^\p{L}\p{N}']+/gu, ' ');
  const out: string[] = [];
  for (let piece of s.split(' ')) {
    if (!piece) continue;
    const lead = lookup(LEADING_APOS, piece);
    if (lead) {
      out.push(lead);
      continue;
    }
    // g-dropping: goin' → going, nothin' → nothing
    if (/^[a-z]{2,}in'$/.test(piece)) piece = piece.slice(0, -1) + 'g';
    piece = piece.replace(/^'+|'+$/g, '');
    if (piece) out.push(piece);
  }
  return out;
}

/** Normalised text of a whole sentence (pieces joined by single spaces). */
export function normalizeText(text: string): string {
  return splitWords(text).flatMap(normalizeToken).join(' ');
}

// ---------------------------------------------------------------- numbers

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function below1000(n: number): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h > 0) out.push(ONES[h], 'hundred');
  if (r > 0 || h === 0) {
    if (r < 20) {
      if (!(h > 0 && r === 0)) out.push(ONES[r]);
    } else {
      out.push(TENS[Math.floor(r / 10)]);
      if (r % 10) out.push(ONES[r % 10]);
    }
  }
  return out;
}

/** 0 … 999 999 as English words (no "and"); null for anything else. */
export function numberToWords(digits: string): string[] | null {
  if (!/^\d{1,6}$/.test(digits)) return null;
  const n = Number(digits);
  if (n === 0) return ['zero'];
  const out: string[] = [];
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  if (th > 0) out.push(...below1000(th), 'thousand');
  if (rest > 0) out.push(...below1000(rest));
  return out;
}

const ORDINAL_IRREGULAR: Record<string, string> = {
  one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth',
};

function toOrdinal(word: string): string {
  const irr = lookup(ORDINAL_IRREGULAR, word);
  if (irr) return irr;
  if (word.endsWith('y')) return word.slice(0, -1) + 'ieth';
  return word + 'th';
}

// ------------------------------------------------------------- equivalences

/** Whole-word equivalences (reductions, informal spellings, apostrophe-less contractions). */
const WORD_MAP: Record<string, string[]> = {
  // reductions
  gonna: ['going', 'to'],
  wanna: ['want', 'to'],
  gotta: ['got', 'to'],
  hafta: ['have', 'to'],
  hasta: ['has', 'to'],
  kinda: ['kind', 'of'],
  sorta: ['sort', 'of'],
  outta: ['out', 'of'],
  lotta: ['lot', 'of'],
  lotsa: ['lots', 'of'],
  dunno: ['do', 'not', 'know'],
  lemme: ['let', 'me'],
  gimme: ['give', 'me'],
  gotcha: ['got', 'you'],
  betcha: ['bet', 'you'],
  cannot: ['can', 'not'],
  whatcha: ['what', 'are|do|have', 'you'],
  watcha: ['what', 'are|do|have', 'you'],
  whaddya: ['what', 'do', 'you'],
  didja: ['did', 'you'],
  ya: ['you'],
  cmon: ['come', 'on'],
  // informal spellings
  ok: ['okay'],
  okey: ['okay'],
  alright: ['all', 'right'],
  cuz: ['because'],
  coz: ['because'],
  cos: ['because'],
  til: ['until'],
  till: ['until'],
  thru: ['through'],
  tho: ['though'],
  // contractions typed without the apostrophe (unambiguous ones only)
  dont: ['do', 'not'],
  doesnt: ['does', 'not'],
  didnt: ['did', 'not'],
  isnt: ['is', 'not'],
  arent: ['are', 'not'],
  wasnt: ['was', 'not'],
  werent: ['were', 'not'],
  havent: ['have', 'not'],
  hasnt: ['has', 'not'],
  hadnt: ['had', 'not'],
  wouldnt: ['would', 'not'],
  shouldnt: ['should', 'not'],
  couldnt: ['could', 'not'],
  mustnt: ['must', 'not'],
  cant: ['can', 'not'],
  wont: ['will', 'not'],
  im: ['i', 'am'],
  ive: ['i', 'have'],
  youre: ['you', 'are'],
  youve: ['you', 'have'],
  youll: ['you', 'will'],
  youd: ['you', 'would|had'],
  theyre: ['they', 'are'],
  theyve: ['they', 'have'],
  theyll: ['they', 'will'],
  theyd: ['they', 'would|had'],
  weve: ['we', 'have'],
  shes: ['she', 'is|has'],
  thats: ['that', 'is|has'],
  whats: ['what', 'is|has'],
  theres: ['there', 'is|has'],
  hes: ['he', 'is|has'],
  whos: ['who', 'is|has'],
  itll: ['it', 'will'],
  wouldve: ['would', 'have'],
  couldve: ['could', 'have'],
  shouldve: ['should', 'have'],
  oclock: ["o'clock"],
  // compounds also written as two words / with a hyphen ("e-mail" is split into "e", "mail")
  voicemail: ['voice', 'mail'],
  downtown: ['down', 'town'],
  email: ['e', 'mail'],
  alot: ['a', 'lot'],
  // apostrophe-less forms that are also real words: match either reading
  its: ['it', 'is|has|its'],
  lets: ['let', 'us|lets'],
};

/** Irregular contractions. */
const IRREGULAR: Record<string, string[]> = {
  "won't": ['will', 'not'],
  "can't": ['can', 'not'],
  "shan't": ['shall', 'not'],
  "let's": ['let', 'us'],
  "c'mon": ['come', 'on'],
  "n't": ['not'],
  "y'know": ['you', 'know'],
  "ma'am": ["ma'am"],
  "o'clock": ["o'clock"],
  "ain't": ["ain't"],
  "y'all": ["y'all"],
};

/** Words whose "'s" is a contraction of is/has (otherwise "'s" is possessive and kept). */
const S_BASES = new Set([
  'he', 'she', 'it', 'that', 'there', 'here', 'what', 'who', 'where', 'when', 'why', 'how',
  'this', 'everyone', 'everybody', 'someone', 'somebody', 'nobody', 'nothing', 'something', 'everything',
]);

/** Expand one normalised piece into canonical tokens. */
export function expandWord(w: string): string[] {
  if (!w) return [];
  if (/^\d+$/.test(w)) return numberToWords(w) ?? [w];
  const ord = /^(\d{1,6})(st|nd|rd|th)$/.exec(w);
  if (ord) {
    const words = numberToWords(ord[1]);
    if (words) return [...words.slice(0, -1), toOrdinal(words[words.length - 1])];
  }
  const mapped = lookup(WORD_MAP, w) ?? lookup(IRREGULAR, w);
  if (mapped) return mapped;
  if (w.includes("'")) {
    if (w.endsWith("n't") && w.length > 3) return [w.slice(0, -3), 'not'];
    const m = /^(.+)'(m|re|ve|ll|d|s)$/.exec(w);
    if (m) {
      const [, base, suf] = m;
      switch (suf) {
        case 'm':
          return [base, 'am'];
        case 're':
          return [base, 'are'];
        case 've':
          return [base, 'have'];
        case 'll':
          return [base, 'will'];
        case 'd':
          return [base, 'would|had'];
        case 's':
          return S_BASES.has(base) ? [base, 'is|has'] : [w];
      }
    }
  }
  return [w];
}

/** Turn raw tokens (as written / typed) into canonical tokens with an origin map. */
export function canonicalize(rawTokens: readonly string[]): Canon {
  const words: string[] = [];
  const origin: number[] = [];
  rawTokens.forEach((raw, i) => {
    for (const piece of normalizeToken(raw)) {
      for (const c of expandWord(piece)) {
        words.push(c);
        origin.push(i);
      }
    }
  });
  return { words, origin };
}

/** Human-readable form of a canonical token ("would|had" → "would"). */
export function displayCanon(w: string): string {
  return w.split('|')[0];
}

/** True when two canonical tokens are the same (any alternative in common). */
export function wordsEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a.includes('|') && !b.includes('|')) return false;
  const as = a.split('|');
  return b.split('|').some((x) => as.includes(x));
}

/** Optimal string alignment distance (Levenshtein + adjacent transposition). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
    }
  }
  return d[m][n];
}

/** "like" vs "liked", "work" vs "works": a dropped/added ending is a listening error, not a typo. */
function isInflectionPair(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (!long.startsWith(short)) return false;
  const tail = long.slice(short.length);
  return tail === 's' || tail === 'd' || tail === 'es' || tail === 'ed';
}

/**
 * Near-miss spelling: edit distance 1 on a target word of >= 4 letters
 * ("recieve" for "receive", "tomorow" for "tomorrow"). Grammatical endings
 * (-s, -d, -ed) are NOT typos: missing them is exactly what elision causes.
 */
export function isTypo(target: string, answer: string): boolean {
  if (!target || !answer || wordsEqual(target, answer)) return false;
  const ts = target.split('|');
  const as = answer.split('|');
  for (const t of ts) {
    if (t.length < 4 || /\d/.test(t)) continue;
    for (const a of as) {
      if (/\d/.test(a)) continue;
      if (isInflectionPair(t, a)) continue;
      if (editDistance(t, a) === 1) return true;
    }
  }
  return false;
}
