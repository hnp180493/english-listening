// Compact pronunciation knowledge (General American) without a big dictionary:
// several hundred hand-written entries (see words.ts) + orthographic heuristics.

import { A_STRESSED, ABBREV_WITH_VOWELS, FINAL_EXTRA, LETTER_NAMES, NOT_ABBREV, RESPELL_EXTRA, RIGHT_FORMS } from './words';

/** The last sound of a word. `c` is a consonant sound code (t, d, s, z, n, m, l, r, k, g, p, b, f, v, th, sh, ch, j, ng, ks). */
export type FinalSound =
  | { kind: 'cons'; c: string; afterVowel: boolean }
  | { kind: 'vowel'; glide: 'y' | 'w' | null };

const VOWELS = 'aeiou';
export const isVowelLetter = (ch: string | undefined): boolean => !!ch && VOWELS.includes(ch);

// Codes: '0' vowel without glide, 'y' vowel ending in /i/-like, 'w' vowel ending in /u/-like,
// 'V:x' consonant x right after a vowel sound, 'C:x' consonant x after another consonant.
const FINAL_BASE: Record<string, string> = {
  a: '0', the: '0', i: 'y', to: 'w', do: 'w', who: 'w', you: 'w', two: 'w', too: 'w',
  through: 'w', though: 'w', although: 'w', thru: 'w', oh: 'w', so: 'w', no: 'w', go: 'w',
  he: 'y', she: 'y', me: 'y', we: 'y', be: 'y', ye: 'y', hi: 'y',
  high: 'y', thigh: 'y', sigh: 'y', weigh: 'y', neigh: 'y',
  laugh: 'V:f', enough: 'V:f', tough: 'V:f', rough: 'V:f', cough: 'V:f',
  of: 'V:v', is: 'V:z', his: 'V:z', as: 'V:z', has: 'V:z', was: 'V:z', does: 'V:z', says: 'V:z',
  this: 'V:s', us: 'V:s', yes: 'V:s', bus: 'V:s', plus: 'V:s', thus: 'V:s', gas: 'V:s',
  house: 'V:s', mouse: 'V:s', case: 'V:s', base: 'V:s', loose: 'V:s', dose: 'V:s', goose: 'V:s',
  horse: 'C:s', course: 'C:s', purpose: 'C:s', promise: 'V:s', else: 'C:s', false: 'C:s',
  sense: 'C:s', nurse: 'C:s', verse: 'C:s', worse: 'C:s', increase: 'V:s', decrease: 'V:s',
  release: 'V:s', chase: 'V:s', crease: 'V:s', lease: 'V:s', geese: 'V:s', close: 'V:z',
  stomach: 'V:k', one: 'V:n', once: 'C:s', done: 'V:n', none: 'V:n', gone: 'V:n', someone: 'V:n', anyone: 'V:n', everyone: 'V:n',
  could: 'V:d', would: 'V:d', should: 'V:d',
  used: 'C:d', based: 'C:t', chased: 'C:t', increased: 'C:t', released: 'C:t', promised: 'C:t',
  purchased: 'C:t', focused: 'C:t', closed: 'C:d', caused: 'C:d', raised: 'C:d', pleased: 'C:d',
  climb: 'V:m', bomb: 'V:m', comb: 'V:m', lamb: 'V:m', thumb: 'V:m', tomb: 'V:m', dumb: 'V:m',
  autumn: 'V:m', column: 'V:m', damn: 'V:m', calm: 'V:m', palm: 'V:m',
  sign: 'V:n', design: 'V:n', foreign: 'V:n', reign: 'V:n',
  talk: 'V:k', walk: 'V:k', chalk: 'V:k',
  debt: 'V:t', doubt: 'V:t', receipt: 'V:t',
  idea: '0', area: '0', via: '0', saw: '0', law: '0', draw: '0', raw: '0', jaw: '0', paw: '0',
  hour: 'V:r', our: 'V:r', hello: 'w', menu: 'w', few: 'w', new: 'w', view: 'w',
  // contractions not covered by the heuristics
  "i'm": 'V:m', "i've": 'V:v', "i'd": 'V:d', "i'll": 'V:l',
  "it's": 'C:s', "that's": 'C:s', "what's": 'C:s', "let's": 'C:s',
};

const FINAL_OVR: Record<string, string> = { ...FINAL_BASE, ...FINAL_EXTRA };

// ── Abbreviations (TV, DVD, FBI) are read letter by letter ───────────────────

/** Is this lowercase word an abbreviation that is spelled out (tv, dvd, fbi)? */
export function isAbbreviation(word: string): boolean {
  const w = word.replace(/'/g, '');
  if (w.length < 2 || w.length > 6 || !/^[a-z]+$/.test(w)) return false;
  if (NOT_ABBREV.has(w)) return false;
  if (ABBREV_WITH_VOWELS.has(w)) return true;
  return !/[aeiouy]/.test(w);
}

/** Letter names run together: "tv" → "teevee". */
export function spellLetters(word: string): string {
  return [...word.replace(/[^a-z]/g, '')].map((c) => LETTER_NAMES[c] ?? c).join('');
}

const LETTER_FINAL: Record<string, string> = { f: 'V:f', h: 'V:ch', l: 'V:l', m: 'V:m', n: 'V:n', r: 'V:r', s: 'V:s', x: 'V:ks' };

function decodeCode(code: string): FinalSound {
  if (code === '0') return { kind: 'vowel', glide: null };
  if (code === 'y' || code === 'w') return { kind: 'vowel', glide: code };
  return { kind: 'cons', c: code.slice(2), afterVowel: code[0] === 'V' };
}

const VOICELESS_END = /(p|t|k|f|ck|ph|th|pe|te|ke|fe)$/;

function sOrZ(stem: string): 's' | 'z' {
  return VOICELESS_END.test(stem) ? 's' : 'z';
}

/** Final sound of a (lowercase) word. Never throws. */
export function finalSound(word: string): FinalSound {
  const w = word.replace(/^'+|'+$/g, '');
  if (!w) return { kind: 'vowel', glide: null };
  const o = FINAL_OVR[w];
  if (o) return decodeCode(o);
  if (isAbbreviation(w)) {
    const last = w[w.length - 1];
    const lf = LETTER_FINAL[last];
    if (lf) return decodeCode(lf);
    return { kind: 'vowel', glide: /[quw]/.test(last) ? 'w' : last === 'o' ? 'w' : 'y' };
  }

  // contractions
  if (/n't$/.test(w)) return { kind: 'cons', c: 't', afterVowel: false };
  if (/'s$/.test(w)) return { kind: 'cons', c: sOrZ(w.slice(0, -2)), afterVowel: false };
  if (/'re$/.test(w)) return { kind: 'cons', c: 'r', afterVowel: true };
  if (/'ll$/.test(w)) return { kind: 'cons', c: 'l', afterVowel: true };
  if (/'d$/.test(w)) return { kind: 'cons', c: 'd', afterVowel: true };
  if (/'ve$/.test(w)) return { kind: 'cons', c: 'v', afterVowel: true };
  if (/'m$/.test(w)) return { kind: 'cons', c: 'm', afterVowel: true };

  const clean = w.replace(/'/g, '');
  if (!clean) return { kind: 'vowel', glide: null };
  const n = clean.length;
  const last = clean[n - 1];
  const prev = clean[n - 2];
  const prev2 = clean[n - 3];

  if (last === 'e') {
    if (n <= 2) return { kind: 'vowel', glide: 'y' }; // he, me, we, be
    if (/(ee|ie|ye)$/.test(clean)) return { kind: 'vowel', glide: 'y' };
    if (/(oe|ue|oo)$/.test(clean)) return { kind: 'vowel', glide: 'w' };
    if (prev === 'r') return { kind: 'cons', c: 'r', afterVowel: true }; // more, there, fire
    if (prev === 'l' && prev2 && !isVowelLetter(prev2)) return { kind: 'cons', c: 'l', afterVowel: true }; // little, table
    if (prev === 'h' && prev2 === 't') return { kind: 'cons', c: 'th', afterVowel: true };
    // silent final e
    const map: Record<string, string> = { c: 's', g: 'j', v: 'v', z: 'z', k: 'k', t: 't', d: 'd', n: 'n', m: 'm', l: 'l', p: 'p', b: 'b', f: 'f' };
    let c = map[prev];
    if (prev === 's') c = 'z';
    if (!c) return { kind: 'vowel', glide: null };
    return { kind: 'cons', c, afterVowel: isVowelLetter(prev2) };
  }
  if (last === 'y') return { kind: 'vowel', glide: 'y' };
  if (last === 'w') return prev === 'a' ? { kind: 'vowel', glide: null } : { kind: 'vowel', glide: 'w' };
  if (last === 'o' || last === 'u') return { kind: 'vowel', glide: 'w' };
  if (last === 'a') return { kind: 'vowel', glide: null };
  if (last === 'i') return { kind: 'vowel', glide: 'y' };
  if (last === 'h') {
    if (/igh$/.test(clean) || /eigh$/.test(clean)) return { kind: 'vowel', glide: 'y' };
    if (/ough$/.test(clean)) return { kind: 'vowel', glide: 'w' };
    if (/augh$/.test(clean)) return { kind: 'cons', c: 'f', afterVowel: true };
    if (prev === 's') return { kind: 'cons', c: 'sh', afterVowel: isVowelLetter(prev2) };
    if (prev === 'c') return { kind: 'cons', c: 'ch', afterVowel: isVowelLetter(prev2) };
    if (prev === 't') return { kind: 'cons', c: 'th', afterVowel: isVowelLetter(prev2) };
    if (prev === 'p') return { kind: 'cons', c: 'f', afterVowel: isVowelLetter(prev2) };
    return { kind: 'vowel', glide: prev === 'o' ? 'w' : null };
  }
  if (last === 'g' && prev === 'n') return { kind: 'cons', c: 'ng', afterVowel: true };
  if (last === 'k' && (prev === 'c' || prev === 'n')) return { kind: 'cons', c: 'k', afterVowel: prev === 'c' };
  if (last === 'x') return { kind: 'cons', c: 'ks', afterVowel: true };
  if (last === 's') {
    if (prev === 's') return { kind: 'cons', c: 's', afterVowel: true };
    if (prev === 'u') return { kind: 'cons', c: 's', afterVowel: true };
    if (prev === 'i') return { kind: 'cons', c: n > 3 ? 's' : 'z', afterVowel: true };
    if (/(ch|sh|ss|x|z|s|c|g)es$/.test(clean)) return { kind: 'cons', c: 'z', afterVowel: true };
    if (/(ys|ws|ows|ays|oes|ies|ees)$/.test(clean)) return { kind: 'cons', c: 'z', afterVowel: true };
    const stem = clean.slice(0, -1);
    return { kind: 'cons', c: sOrZ(stem), afterVowel: isVowelLetter(prev) };
  }
  if (last === 'd') {
    if (/ed$/.test(clean) && n > 4 && !/eed$/.test(clean)) {
      const stem = clean.slice(0, -2);
      if (/[aeiouy]/.test(stem)) {
        const sl = stem[stem.length - 1];
        if (sl === 't' || sl === 'd') return { kind: 'cons', c: 'd', afterVowel: true }; // wanted
        if (isVowelLetter(sl) || sl === 'y' || sl === 'w') return { kind: 'cons', c: 'd', afterVowel: true }; // played
        if (sl === 'r') return { kind: 'cons', c: 'd', afterVowel: true }; // scared
        if (/(p|k|ss|x|ch|sh|f|ck|ph|c)$/.test(stem)) return { kind: 'cons', c: 't', afterVowel: false }; // asked
        return { kind: 'cons', c: 'd', afterVowel: false }; // called, lived
      }
    }
    if (prev === 'l' || prev === 'n') return { kind: 'cons', c: 'd', afterVowel: false };
    return { kind: 'cons', c: 'd', afterVowel: isVowelLetter(prev) || prev === 'r' };
  }
  if (last === 't') {
    if (/ght$/.test(clean)) return { kind: 'cons', c: 't', afterVowel: true };
    return { kind: 'cons', c: 't', afterVowel: isVowelLetter(prev) || prev === 'r' };
  }
  if (last === 'n') {
    if (prev === 'm') return { kind: 'cons', c: 'm', afterVowel: true };
    return { kind: 'cons', c: 'n', afterVowel: isVowelLetter(prev) || prev === 'g' || prev === 'r' || prev === 'w' };
  }
  if (last === 'm') return { kind: 'cons', c: 'm', afterVowel: true };
  if (last === 'b' && prev === 'm') return { kind: 'cons', c: 'm', afterVowel: true };
  if (last === 'r') return { kind: 'cons', c: 'r', afterVowel: true };
  if (last === 'c') return { kind: 'cons', c: 'k', afterVowel: isVowelLetter(prev) };
  if (last === 'q') return { kind: 'cons', c: 'k', afterVowel: true };
  if ('bfgjklpvz'.includes(last)) return { kind: 'cons', c: last, afterVowel: isVowelLetter(prev) || prev === 'r' };
  return { kind: 'vowel', glide: null };
}

const VOWEL_START = new Set(['hour', 'hours', 'hourly', 'honest', 'honestly', 'honesty', 'honor', 'honour', 'honored', 'heir', 'herb', 'herbs',
  'unimportant', 'uninterested', 'uninstall', 'unidentified', 'unimpressed', 'uninformed', 'unintended', 'uninvited',
  'honorable', 'honors', 'honours', 'honored', 'honorary', 'hourglass', 'heirloom', 'heiress', 'herbal', 'heirs',
  'uninsured', 'unintentional', 'uninhabited', 'unimaginable', 'unimpressive', 'unidentifiable', 'unusual', 'unused',
  'only', 'onion', 'online']);
const CONS_START = new Set(['one', 'ones', "one's", 'once', 'oneself', 'unique', 'uniform', 'user', 'users', 'useful',
  'useless', 'utensil', 'uranium', 'urine', 'ukulele', 'eucalyptus', 'euphoria', 'ouija', 'unicorn', 'someone', 'euro', 'europe', 'european', 'eulogy', 'ewe', 'ufo', 'unity', 'union', 'unit', 'units', 'uk', 'usa', 'us-based']);

/** Silent-h words: written h but start with a vowel sound. */
export const SILENT_H = /^(hour|honest|honou?r|heir|herb)/;

/** Does the word start with a vowel SOUND? (hour → yes, university → no) */
export function startsWithVowelSound(word: string): boolean {
  const w = word.replace(/^'+/, '');
  if (!w) return false;
  if (VOWEL_START.has(w)) return true;
  if (CONS_START.has(w)) return false;
  if (SILENT_H.test(w)) return true;
  if (isAbbreviation(w)) return /^[aeiou]/.test(LETTER_NAMES[w[0]] ?? '');
  const f = w[0];
  if (f === 'u') {
    if (/^(uni|use|usu|usa|uti|ura|uri|ure|uku|ubiq|uvu)/.test(w)) return false;
    return true;
  }
  if (f === 'e' && /^(eu|ewe)/.test(w)) return false;
  if (f === 'o' && /^(one|once)/.test(w)) return false;
  return VOWELS.includes(f);
}

/** First consonant letter group of a word (for place assimilation checks). */
export function firstLetter(word: string): string {
  return word.replace(/^'+/, '')[0] ?? '';
}

// Irregular respellings, used only when a word's final sound has to be split off
// ("have it" → "ha-vit"). Keys are lowercase words.
const RESPELL_BASE: Record<string, string> = {
  not: 'nat', got: 'gat', lot: 'lat', hot: 'hat', forgot: 'fərgat',
  have: 'hav', give: 'giv', live: 'liv', love: 'luv', above: 'əbuv', move: 'moov', lose: 'looz', whose: 'hooz',
  lived: 'livd', loved: 'luvd', moved: 'moovd', gave: 'geiv',
  one: 'wun', once: 'wuns', done: 'dun', none: 'nun', some: 'sum', come: 'cum', become: 'bicum', gone: 'gon', someone: 'sumwun', anyone: 'eniwun', everyone: 'evriwun',
  were: 'wer', are: 'ar', there: 'theər', where: 'wheər', here: 'heer', more: 'mor', sure: 'shur', before: 'bifor', store: 'stor',
  said: 'sed', says: 'sez', does: 'duz', was: 'wuz', is: 'iz', his: 'hiz', as: 'az', has: 'haz', of: 'uv',
  could: 'cud', would: 'wud', should: 'shud',
  kind: 'kaind', find: 'faind', mind: 'maind', behind: 'bihaind', mine: 'main',
  night: 'nait', light: 'lait', right: 'rait', might: 'mait', fight: 'fait', tonight: 'tənait', bright: 'brait', flight: 'flait', sight: 'sait', tight: 'tait',
  eight: 'eit', weight: 'weit', straight: 'streit',
  thought: 'thot', bought: 'bot', brought: 'brot', caught: 'cot', taught: 'tot', fought: 'fot',
  laugh: 'laf', enough: 'inuf', tough: 'tuf', rough: 'ruf', cough: 'cof',
  friend: 'frend', people: 'peepəl', house: 'haus', use: 'yooz', used: 'yoozd', these: 'theez', those: 'thohz', please: 'pleez',
  because: 'bicuz', course: 'cors', while: 'wail', whole: 'hohl', white: 'wait', write: 'rait', wrote: 'roht', quite: 'kwait',
  minute: 'minit', promise: 'pramis', purpose: 'purpəs', favorite: 'feivrit', definite: 'definit', opposite: 'apəzit',
  office: 'offis', service: 'servis', practice: 'practis', notice: 'nohtis', justice: 'justis', juice: 'joos', police: 'pəlees',
  machine: 'məsheen', inside: 'insaid', outside: 'autsaid', decide: 'disaid', arrive: 'əraiv', alive: 'əlaiv', mistake: 'misteik',
  about: 'əbaut', again: 'əgen', bread: 'bred', head: 'hed', dead: 'ded', instead: 'insted',
  online: 'onlain', excuse: 'ikskyooz', talk: 'tok', walk: 'wok', half: 'haf', climb: 'klaim', sign: 'sain', design: 'dizain',
};

export const RESPELL: Record<string, string> = { ...RESPELL_BASE, ...RESPELL_EXTRA };

// Magic-e vowels, spelled by the convention table in tables.ts: make → meik, time → taim, home → hohm.
const MAGIC: Record<string, string> = { a: 'ei', e: 'ee', i: 'ai', o: 'oh' };

/** Written vowel spellings → the convention spelling (tables.ts), applied once, left to right. */
const VOWEL_SPELLINGS: Record<string, string> = {
  air: 'eər', // /ɛr/: hair → heər, chair → cheər (before a vowel, ai → plain e: dairy → deri)
  ai: 'ei', ay: 'ei', // /eɪ/: wait → weit, stay → stei
  ea: 'ee', // /iː/: speak → speek (the /ɛ/, /eɪ/ words — head, great — are in the lexicon)
  oa: 'oh', o: 'oh', // /oʊ/: road → rohd; "o" only before -ld / -lt: hold → hohld, bolt → bohlt
  oy: 'oi', // /ɔɪ/: boys → boiz
  ou: 'au', // /aʊ/ before nd/nt/t/d/se/th/ch: loud → laud, proud → praud
  au: 'o', aw: 'o', // /ɔ/: fault → folt, lawn → lon (written "au" would read /aʊ/)
};
const VOWEL_SPELLING_RE = /air(?![aeiouy])|ai|ay|ea(?!r)|oa(?!r)|(?<![aeiou])o(?=l[dt])|oy|(?<!y)ou(?=nd|nt|t|d|se|th|ch)|au|aw(?=[^aeiouy])/g;

/**
 * Rewrite the vowel letters of a written word with the convention spellings, so a word that
 * is shown respelled never mixes written English vowel digraphs with the table: wait → weit
 * (not "wai-də", which reads /aɪ/), hold → hohld, proud → praud. Words with irregular vowels
 * (said, head, great, could, broad…) are in RESPELL and never reach this.
 */
export function conventionVowels(w: string): string {
  if (/broad/.test(w)) return w;
  return w.replace(VOWEL_SPELLING_RE, (m, at: number) =>
    // /ɛr/ before a vowel: the r starts the next syllable, the vowel is a plain e (dairy → deri, fairy → feri)
    m === 'ai' && /^r[aeiouy]/.test(w.slice(at + 2)) ? 'e' : (VOWEL_SPELLINGS[m] ?? m),
  );
}

/**
 * Respelled syllables that would be a DIFFERENT real English word, read with another vowel
 * ("side" → "said", "mind" → "main", "I'd" → "aid"). They are written with the English
 * homophone that has the right /aɪ/ sound instead. Only applied to respelled pieces, never to
 * a word shown as written.
 */
const FALSE_WORDS: Record<string, string> = {
  said: 'side', raid: 'ride', aid: "I'd", laid: 'lied', main: 'mine', lain: 'line', pain: 'pine', wail: 'while',
  mail: 'mile', tail: 'tile', fail: 'file', bait: 'bite', laud: 'loud',
  aim: "I'm", maim: 'mime', // "him I'm" → i-mime, not "maim" (/eɪ/)
  // whole flap-T words (writing → raiding, writer → raidər) use their homophones; split pieces stay rai-ding
  raiding: 'riding', raidər: 'rider', raidərz: 'riders',
};

/** Replace every hyphen-separated syllable of a respelled piece that is a false English word. */
export function avoidFalseWords(s: string): string {
  if (!s) return s;
  return s
    .split('-')
    .map((chunk) => FALSE_WORDS[chunk] ?? chunk)
    .join('-');
}

// y before a vowel is a consonant (player, yes): it does not start a syllable of its own
const vowelGroups = (w: string): number => (w.match(/[aeiou]+y?|y(?![aeiou])/g) ?? []).length;

// Suffixes with a predictable sound, whatever the rest of the word looks like.
// Each rule: [pattern, replacement, minimum number of vowel groups in the word].
const SUFFIX_RULES: [RegExp, string, number][] = [
  [/([^e])ight$/, '$1ait', 1], // night, delight
  [/ought$/, 'ot', 1],
  [/aught$/, 'ot', 1],
  [/ould$/, 'ud', 1],
  [/alk$/, 'ok', 1],
  [/alf$/, 'af', 1],
  [/alm$/, 'ahm', 1],
  [/([aeiou])mb$/, '$1m', 1], // bomb, lamb
  [/([aeiou])mn$/, '$1m', 1], // autumn
  [/([aeiou])gn$/, '$1n', 2], // campaign-like
  [/stle$/, 'səl', 2],
  [/sten$/, 'sən', 2],
  [/ften$/, 'fən', 2],
  [/bt$/, 't', 1],
  [/ation$/, 'eishən', 2],
  [/ition$/, 'ishən', 2],
  [/otion$/, 'ohshən', 2],
  [/ution$/, 'ooshən', 2],
  [/ction$/, 'kshən', 2],
  [/ption$/, 'pshən', 2],
  [/ntion$/, 'nshən', 2],
  [/stion$/, 'schən', 2],
  [/ssion$/, 'shən', 2],
  [/tion$/, 'shən', 2],
  [/nsion$/, 'nshən', 2],
  [/([aeiour])sion$/, '$1zhən', 2],
  [/cian$/, 'shən', 2],
  [/ture$/, 'chər', 2],
  [/ssure$/, 'shər', 2],
  [/([aeiou])sure$/, '$1zhər', 2],
  [/[ct]ious$/, 'shəs', 2],
  [/ous$/, 'əs', 2],
  [/ful$/, 'fəl', 2],
  [/ment$/, 'mənt', 2],
  [/ness$/, 'nəs', 2],
  [/less$/, 'ləs', 2],
  [/([^aeiou])al$/, '$1əl', 2], // normal, local
  [/([dir])ent$/, '$1ənt', 2], // student, parent, different
  [/([^l])ant$/, '$1ənt', 2], // important, distant
  [/([bcdfgklmnprstvz])en$/, '$1ən', 2], // happen, chicken, garden
];
const ANT_STRESSED = new Set(['implant', 'transplant', 'enchant', 'gallant', 'croissant', 'supplant', 'indent']);

// Multi-syllable words ending in consonant + silent e: the ending tells the vowel.
const SILENT_E_RULES: [RegExp, string][] = [
  [/(line|shine|fine|wine|mine|define|combine|decline|refine|divine|nine|pine|spine)$/, 'ain'],
  [/(azine|chine|utine|isine|arine|ccine|oline|feine|otine|ntine)$/, 'een'],
  [/ive$/, 'iv'], // active, expensive
  [/ice$/, 'is'], // notice, office
  [/age$/, 'ij'], // message, village
  [/ine$/, 'in'], // engine, imagine
  [/ate$/, 'eit'], // create, celebrate
  [/ite$/, 'ait'], // invite, polite
  [/([pbcfmk])ute$/, '$1yoot'], // compute
  [/ute$/, 'oot'], // pollute
  [/ude$/, 'ood'], // include, attitude
  [/ose$/, 'ohz'], // suppose
  [/come$/, 'cum'], // welcome
  [/some$/, 'səm'], // awesome
  [/ome$/, 'ohm'],
  [/one$/, 'ohn'], // alone, telephone
  [/place$/, 'pleis'],
  [/ace$/, 'əs'], // palace-like
  [/([ae])nce$/, 'əns'], // difference, balance
  [/ase$/, 'eis'],
  [/a([kdnlpmzvt])e$/, 'ei$1'], // mistake, became, behave
  [/ide$/, 'aid'],
  [/i[sz]e$/, 'aiz'], // realize, surprise
  [/ire$/, 'aiər'], // desire
  [/are$/, 'eər'], // prepare, compare, aware (/ɛr/)
  [/ore$/, 'or'], // ignore
  [/ere$/, 'eer'], // severe
  [/ure$/, 'ur'],
  [/ete$/, 'eet'], // complete
  [/eme$/, 'eem'],
  [/ene$/, 'een'],
  [/ese$/, 'eez'], // Chinese
  [/ode$/, 'ohd'],
  [/ote$/, 'oht'],
  [/ope$/, 'ohp'],
  [/oke$/, 'ohk'],
  [/ole$/, 'ohl'],
  [/obe$/, 'ohb'],
  [/ove$/, 'ohv'],
  [/ume$/, 'oom'],
  [/([cfmb])use$/, '$1yooz'], // confuse, amuse
  [/use$/, 'ooz'],
];

/**
 * Replace the ending matched by `re` with `rep` (already in convention spelling) and give the
 * written part before it the convention vowels: mountain-like prefixes, "debate" → debeit.
 */
function withEnding(w: string, re: RegExp, rep: string): string {
  const m = re.exec(w);
  if (!m) return w;
  return conventionVowels(w.slice(0, m.index)) + w.slice(m.index).replace(re, rep);
}

/** Respelling of a multi-syllable silent-e word from its ending, or null. */
function silentEMulti(w: string): string | null {
  for (const [re, rep] of SILENT_E_RULES) {
    if (!re.test(w)) continue;
    if (rep === 'ain' || rep === 'een') return withEnding(w, /ine$/, rep);
    return withEnding(w, re, rep);
  }
  return null;
}

/** Vowel digraphs before a silent-e ending: raise → reiz, leave → leev, loathe → lohth, mouse → maus. */
const SILENT_E_DIGRAPH: Record<string, string> = { ai: 'ei', ay: 'ei', ea: 'ee', oa: 'oh', au: 'o', oy: 'oi' };

const STRESSED_ER = new Set(['prefer', 'refer', 'defer', 'confer', 'infer', 'deter', 'transfer', 'inter']);
const STRESSED_OR = new Set(['decor', 'abhor', 'indoor', 'outdoor', 'therefor']);
const AR_WEAK = new Set(['dollar', 'sugar', 'similar', 'regular', 'popular', 'calendar', 'grammar', 'collar',
  'cellar', 'cedar', 'nectar', 'burglar', 'particular', 'familiar', 'peculiar', 'vinegar', 'solar', 'polar', 'lunar',
  'circular', 'muscular', 'spectacular', 'vulgar', 'beggar', 'liar', 'scholar', 'pillar', 'radar']);

/** Unstressed final -er / -or / -ar of a longer word is just /ər/: doctor → doctər. */
function weakEnding(w: string): string {
  if (vowelGroups(w) < 2) return w;
  if (/[^e]er$/.test(w) && !STRESSED_ER.has(w)) return w.slice(0, -2) + 'ər';
  if (/[^o]or$/.test(w) && !STRESSED_OR.has(w)) return w.slice(0, -2) + 'ər';
  if (AR_WEAK.has(w)) return w.slice(0, -2) + 'ər';
  return w;
}

/** -ored past tenses whose verb ends in a silent e (most -ored words come from unstressed -or: colored). */
const ORE_VERBS = new Set(['ignor', 'explor', 'ador', 'restor', 'implor', 'deplor', 'scor', 'stor', 'bor', 'snor', 'shor']);
const NG_E_STEM = /(chang|rang|bing|hing|plung|lung|cring|spong|lleng|veng|loung)$/;

/** Does an -ed stem stand for a verb with a silent final e (tir|ed, danc|ed, judg|ed)? */
function silentEStem(stem: string): boolean {
  if (/[^aeiou][aiu]r$/.test(stem)) return true; // fired, shared, required, cured
  if (ORE_VERBS.has(stem)) return true;
  if (/c$/.test(stem)) return true; // danced, forced, noticed
  if (/ng$/.test(stem)) return NG_E_STEM.test(stem); // changed, binged — but longed, banged
  return /g$/.test(stem); // judged, charged, engaged
}

/** -ies plurals / verb forms: babies → "babyz", tries → traiz. */
function iesForm(w: string): string {
  const stem = w.slice(0, -3);
  if (!/[aeiouy]/.test(stem) || /f$/.test(stem)) return stem + 'aiz'; // tries, fries, skies, satisfies
  return respellBase(stem + 'y') + 'z'; // ladies → ladyz, stories → storyz
}

/**
 * A pronounceable respelling of the whole word without silent letters, used when its
 * final consonant has to be moved to the next word. "make" → "meik", "asked" → "askt".
 * Vowels follow the convention table in tables.ts.
 */
export function respellBase(word: string): string {
  if (word === 'i') return 'I';
  if (/^i'/.test(word)) return 'I' + word.slice(2);
  const r = RESPELL[word];
  if (r) return r;
  if (isAbbreviation(word)) return spellLetters(word);
  const w = word.replace(/'/g, '');
  if (!w) return word;
  if (w !== word && !/'s$/.test(word)) return w; // contractions (isn't, don't): the spelling without the apostrophe

  // -ied: cried → kraid, satisfied → satisfaid (studied, worried keep /i/)
  if (/ied$/.test(w)) {
    const pre = w.slice(0, -3);
    if (pre && (!/[aeiouy]/.test(pre) || /f$/.test(pre))) return pre + 'aid';
  }
  // -ed past tense
  if (/ed$/.test(w) && w.length > 4 && !/eed$/.test(w)) {
    const stem = w.slice(0, -2);
    if (/[aeiouy]/.test(stem)) {
      const fs = finalSound(w);
      const sl = stem[stem.length - 1];
      if (sl === 't' || sl === 'd') {
        const known = RESPELL[stem] ?? RESPELL[stem + 'e'];
        if (known) return known + 'id';
        // one-syllable silent-e verbs keep their long vowel: hated → heitid, voted → vohtid
        if (/^[^aeiou]*[aeiou][td]$/.test(stem)) return respellBase(stem + 'e') + 'id';
        return conventionVowels(stem) + 'id'; // waited → weitid, loaded → lohdid
      }
      let base: string;
      const dbl = /([a-z])\1$/.test(stem) && !/(ee|oo)$/.test(stem);
      if (dbl) base = conventionVowels(stem.slice(0, -1));
      else if (/^[^aeiou]*[aeiou][^aeiouwyx]$/.test(stem) && sl !== 'v' && sl !== 'r') base = respellBase(stem + 'e');
      else if (RESPELL[stem + 'e']) base = RESPELL[stem + 'e'];
      else if (silentEStem(stem)) base = respellBase(stem + 'e'); // tired → taiərd, changed → cheinjd
      else if (!/[scgvzu]$/.test(stem)) base = respellBase(stem);
      else base = conventionVowels(stem);
      const c = fs.kind === 'cons' ? fs.c : 'd';
      return base + (c === 't' ? 't' : 'd');
    }
  }
  // -s / -es
  if (/s$/.test(w) && w.length > 3 && !/(ss|us|is)$/.test(w)) {
    const fs = finalSound(w);
    const c = fs.kind === 'cons' ? fs.c : 'z';
    if (/(ch|sh|ss|x|z)es$/.test(w)) return conventionVowels(w.slice(0, -2)) + 'iz';
    if (/ies$/.test(w) && w.length > 4) return iesForm(w);
    if (/(ce|ge|se)s$/.test(w)) return respellBase(w.slice(0, -1)) + 'iz';
    if (/[aeiou]es$/.test(w) && !/(ies)$/.test(w)) {
      const st = w.slice(0, -2);
      return conventionVowels(/[^aeiou]o$/.test(st) ? st + 'h' : st) + c; // goes → gohz
    }
    const stem = w.slice(0, -1);
    return (RESPELL[stem] ?? respellBase(stem)) + c;
  }
  // predictable suffixes: -tion, -ture, -ous, -ight…
  for (const [re, rep, min] of SUFFIX_RULES) {
    if (!re.test(w) || vowelGroups(w) < min) continue;
    if (ANT_STRESSED.has(w)) break;
    return withEnding(w, re, rep);
  }
  // silent final e
  if (/e$/.test(w) && w.length > 2 && !/(ee|ie|ye|oe|ue)$/.test(w)) {
    if (/[^aeiou]le$/.test(w)) return conventionVowels(w.slice(0, -2)) + 'əl';
    if (/ange$/.test(w)) return withEnding(w, /ange$/, 'einj'); // change, strange, arrange
    if (/aste$/.test(w)) return withEnding(w, /aste$/, 'eist'); // taste, waste
    const ty = /^(.*?)y([^aeiouy])e$/.exec(w);
    if (ty) return conventionVowels(ty[1]) + 'ai' + ty[2]; // type, style, byte
    const m = /^(.*?)([aeiou]+)([^aeiouy]+)e$/.exec(w);
    if (m) {
      let pre = m[1];
      let v = m[2];
      let cons = m[3];
      const monosyllable = !/[aeiouy]/.test(pre);
      if (!monosyllable && v.length === 1) {
        const multi = silentEMulti(w);
        if (multi) return multi;
      }
      if (monosyllable && v.length === 1 && cons === 'r') {
        // -re words: sore → sor, care → keər, fire → faiər, here → heer, pure → pyur
        v = v === 'a' ? 'eə' : v === 'e' ? 'ee' : v === 'i' ? 'aiə' : v === 'u' ? (/^[cfhmpbk]?$/.test(pre) ? 'yu' : 'u') : v;
      } else if (monosyllable && v.length === 1 && cons.length === 1) {
        // magic e: make → meik, time → taim, home → hohm, cute → kyoot, rule → rool
        if (v === 'u') v = /^[cfhmpbk]?$/.test(pre) ? 'yoo' : 'oo';
        else v = MAGIC[v] ?? v;
      } else if (v.length > 1) {
        // raise → reiz, leave → leev, mouse → maus (but source, course keep their /ɔr/)
        // …and -aire is /ɛr/: millionaire → millioneər
        v = v === 'ai' && cons === 'r' ? 'eə' : SILENT_E_DIGRAPH[v] ?? (v === 'ou' && /^(s|th|ch|nc|nd)$/.test(cons) ? 'au' : v);
      }
      pre = conventionVowels(pre);
      // a hard c that now sits before e/i/y must be written k (care → keər, cute → kyoot, not "cer", "cyoot")
      if (/c$/.test(pre) && /^[eiy]/.test(v) && m[2] !== v) pre = pre.slice(0, -1) + 'k';
      if (cons.endsWith('c')) cons = cons.slice(0, -1) + 's';
      else if (cons.endsWith('g')) cons = cons.replace(/d?g$/, 'j'); // bridge → brij, judge → juj
      else if (cons.endsWith('s')) {
        const fs = finalSound(w);
        cons = cons.slice(0, -1) + (fs.kind === 'cons' && fs.c === 's' ? 's' : 'z');
      }
      return pre + v + cons;
    }
  }
  return conventionVowels(weakEnding(w));
}

/**
 * How a word is written when it RECEIVES a sound from the previous word
 * ("good idea" → goo-dai-deeə, "had enough" → ha-di-nuff). May contain "|"
 * (a syllable break shown only when the word is glued to the previous one).
 */
export function rightForm(word: string): string {
  if (word === 'i') return 'I';
  const f = RIGHT_FORMS[word];
  if (f) return f;
  if (/^i'/.test(word)) return respellBase(word);
  if (isAbbreviation(word)) return [...word].map((c) => LETTER_NAMES[c] ?? c).join('|'); // an FBI → ə-nef-bee-ai
  if (word.includes("'") || word.length <= 3) return word; // isn't, it, is, off: the spelling is fine
  // unstressed un- prefix: unexpected → ə-nikspected, unbelievable → ən-believable, understood → undər-stood
  if (/^un/.test(word) && word.length > 5 && startsWithVowelSound(word)) {
    if (/^under/.test(word)) return 'undər|' + respellBase(word.slice(5));
    const rest = RIGHT_FORMS[word.slice(2)]?.replace(/\|/g, '') ?? respellBase(word.slice(2));
    return /^[aeiou]/.test(word[2]) ? 'ə|n' + rest : 'ən|' + rest;
  }
  const r = respellBase(word);
  // unstressed a- prefix: amazing → ə-mazing, alarm → ə-larm
  if (/^a[bdgklmnprstvwz][aeiou]/.test(word) && /^a[bdgklmnprstvwz]/.test(r) && !A_STRESSED.has(word)) return 'ə|' + r.slice(1);
  // …also with a doubled consonant: arranged → ə-reinjd, attended → ə-tendid (but apple, accident are stressed)
  const dbl = /^a(bb|dd|ff|gg|ll|mm|nn|pp|rr|ss|tt)[aeiouy]/.exec(word);
  if (dbl && r.startsWith('a' + dbl[1]) && !A_STRESSED.has(word) && !A_STRESSED.has(word.replace(/(es|s|ed|ing|ly)$/, ''))) {
    return 'ə|' + r.slice(2);
  }
  return r;
}

/**
 * Split a respelled word before its final consonant sound: "pick" → pi + k, "both" → bo + th.
 * Returns null when the word ends in a vowel sound or in "ng" (which never moves).
 */
export function splitFinal(s: string): { stem: string; onset: string } | null {
  const t = s.replace(/['’]/g, '');
  if (!t || /\)$/.test(t)) return null;
  if (/tch$/.test(t)) return { stem: t.slice(0, -2), onset: 'ch' };
  if (/ck$/.test(t)) return { stem: t.slice(0, -2), onset: 'k' };
  if (/(sh|ch|th)$/.test(t)) return { stem: t.slice(0, -2), onset: t.slice(-2) };
  if (/ph$/.test(t)) return { stem: t.slice(0, -2), onset: 'f' };
  if (/(gh|ng)$/.test(t)) return null;
  if (/[^aeiouə|]le$/.test(t)) return { stem: t.slice(0, -2) + 'ə', onset: 'l' };
  // /ɛr/ "eər" before a vowel: the r moves and the vowel is a plain e (theər in → the-rin, keər about → ke-rə-baut)
  if (/eər$/.test(t)) return { stem: t.slice(0, -3) + 'e', onset: 'r' };
  // flap-T words keep a written unstressed -er (wadder, bedder): split, it is ə + r like doctə-rif
  if (/[aeiouy][^aeiouə|]*d+er$/.test(t)) return { stem: t.slice(0, -2) + 'ə', onset: 'r' };
  if (/x$/.test(t)) return { stem: t.slice(0, -1) + 'k', onset: 's' };
  if (/([bdfgklmnprstvz])\1$/.test(t)) return { stem: t.slice(0, -1), onset: t.slice(-1) };
  const last = t.slice(-1);
  if ('bcdfgjklmnpqrstvz'.includes(last)) return { stem: t.slice(0, -1), onset: last === 'c' || last === 'q' ? 'k' : last };
  return null;
}

/**
 * "ng" never moves to the next word, but showing the -ing syllable tells how the word flows
 * on: "looking at" → loo-king-at, "taking it" → tei-king-it. Null when there is nothing to show.
 */
export function ngSyllables(s: string, respelled = false): string | null {
  const t = s.replace(/'/g, '');
  if (!/ing$/.test(t) || t.length < 5 || /thing$/.test(t)) return null;
  let stem = t.slice(0, -3);
  if (!/[aeiouyə]/.test(stem) || /[aeiouywə|]$/.test(stem)) return null;
  if (/([bdfgklmnprstvz])\1$/.test(stem)) stem = stem.slice(0, -1);
  // an already respelled word (raiding, shauding) keeps its vowels: converting them again would
  // read the table's "ai" /aɪ/ as written ai /eɪ/ (rei-ding) and "au" /aʊ/ as written au /ɔ/ (sho-ding)
  else if (respelled) return splitNg(stem);
  else if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(stem)) stem = RESPELL[stem + 'e'] ?? respellBase(stem + 'e');
  else stem = RESPELL[stem] ?? conventionVowels(stem); // raining → rei-ning, reading → ree-ding
  return splitNg(stem);
}

function splitNg(stem: string): string | null {
  const sp = splitFinal(stem);
  if (!sp || !sp.stem) return null;
  // a syllable mark right before the moved consonant (eev|ning) is replaced by this break
  return `${sp.stem.replace(/\|$/, '')}-${sp.onset}ing`;
}

// ── Flap T inside a word ─────────────────────────────────────────────────────

// Most entries keep the written word and only turn t into d (better → bedder), so the learner still
// recognises it. A long vowel or diphthong whose letters would read as another sound in the
// convention table (data, later, total, photo, writer, eating…) is respelled with the table.
const FLAP_WORDS: Record<string, string> = {
  // not "wader": that is a real English word read with /eɪ/ (rule 3 of the table)
  water: 'wadder', better: 'bedder', city: 'ciddy', little: 'liddle', matter: 'madder', getting: 'gedding',
  letter: 'ledder', butter: 'budder', party: 'pardy', computer: 'compuder', pretty: 'priddy', beautiful: 'byoodəfəl',
  bottle: 'boddle', total: 'tohdəl', totally: 'tohdəli', notice: 'nohdis', later: 'leidər', meeting: 'meeding',
  writing: 'raiding', sitting: 'sidding', putting: 'pudding', waiting: 'weiding', eating: 'eeding', data: 'deidə',
  photo: 'fohdoh', photos: 'fohdohz', potato: 'pəteidoh', tomato: 'təmeidoh', item: 'aidəm', items: 'aidəmz', italy: 'iddaly',
  auto: 'odoh', metal: 'medal', hospital: 'hospidal', capital: 'capidal', digital: 'digidal', vital: 'vaidəl',
  vitamin: 'vaidəmin', vitamins: 'vaidəminz', saturday: 'sadərdei', battery: 'baddery', quarter: 'quarder', thirty: 'thirdy',
  forty: 'fordy', dirty: 'dirdy', shorter: 'shorder', starting: 'starding', exciting: 'iksaiding', whatever: 'whadever',
  beauty: 'byoodi', duty: 'doodi', pity: 'piddy', kitty: 'kiddy', bitter: 'bidder', sweater: 'swedər', theater: 'theeədər',
  heater: 'heedər', greater: 'greidər', writer: 'raidər', hotter: 'hodder', settle: 'seddle', title: 'taidəl',
  battle: 'baddle', kettle: 'keddle', bottom: 'boddom', atom: 'adom', automatic: 'odəmadik', eighty: 'eidi',
  cities: 'ciddies', parties: 'pardies', letters: 'ledders', meter: 'meedər', peter: 'peedər', router: 'rauder',
  outer: 'auder', voter: 'vohdər', native: 'neidiv', quality: 'qualidy', ability: 'abilidy', community: 'communidy',
  security: 'securidy', reality: 'realidy', university: 'universidy', activity: 'acdividy', opportunity: 'opportunidy',
  electricity: 'electricidy', identity: 'aidendədi', society: 'səsaiədi', variety: 'vəraiədi', anxiety: 'angzaiədi',
  visited: 'visided', excited: 'iksaidid', invited: 'invaidid', united: 'yoonaidid', created: 'krieidid', related: 'rileidid',
  hated: 'heidid', dated: 'deidid', waited: 'weidid', started: 'starded', edited: 'edided', committed: 'commidded',
};

const FLAP_RE = /^(.*[aeiouyr])(tt|t)(er|ers|ered|ering|y|ies|ier|iest|ily|ing|ed|le|les|ish)$/;
const FLAP_BLOCK = new Set(['deter', 'deterred', 'naughty', 'mighty', 'attire', 'retired', 'entire', 'satire', 'tattoo', 'retire']);

/** Respelling of a word with its internal flap T (water → wadder), or null. */
export function flapWord(word: string): string | null {
  if (!word || word.includes("'")) return null;
  const hit = FLAP_WORDS[word];
  if (hit) return hit;
  if (FLAP_BLOCK.has(word) || word.length < 5) return null;
  // silent-e verbs keep their long vowel: vote → voting "vohding", delete → deleted "dileedid"
  const se = /^(.*[^aeiou][aeiou])t(ed|ing|er|ers)$/.exec(word);
  if (se) {
    const baseWord = se[1] + 'te';
    const known = RESPELL[baseWord];
    const mono = vowelGroups(se[1]) === 1;
    if (known || mono || /[auo]$/.test(se[1])) {
      const b = known ?? respellBase(baseWord);
      if (/t$/.test(b) && b !== se[1] + 't') {
        const tail = se[2] === 'ed' ? 'id' : se[2] === 'ers' ? 'ərz' : se[2] === 'er' ? 'ər' : 'ing';
        return b.slice(0, -1) + 'd' + tail;
      }
    }
  }
  const m = FLAP_RE.exec(word);
  if (!m) return null;
  const pre = m[1];
  // need a vowel sound before the t: last letter vowel/y, or r after a vowel (party, starting)
  const last = pre[pre.length - 1];
  if (last === 'r' && !isVowelLetter(pre[pre.length - 2])) return null;
  if (/gh$/.test(pre)) return null;
  // silent e before -ty is not a vowel sound: safety, ninety keep a plain /t/
  if (m[3] === 'y' && /[^aeiou]e$/.test(pre)) return null;
  // vowel digraphs follow the convention: heating → heeding, shouting → shauding, floating → flohding
  const cpre = conventionVowels(pre + 't').slice(0, -1);
  return cpre + (m[2] === 'tt' ? 'dd' : 'd') + m[3];
}
