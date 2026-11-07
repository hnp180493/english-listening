// Hand-written respellings (chunk.spoken, lesson notes, pair cues) must spell each sound the
// way the decoder prints it, so a learner never sees two spellings of the same sound side by
// side. The convention is the table at the top of src/core/decoder/tables.ts:
//   /eɪ/ ei (never "ay")   /oʊ/ oh (never "ou", "o" in a respelled syllable)   /aʊ/ au
//   /iː/ ee (never "ea")   /æ/ a ("kæn(t)" only for can't)   /ɔɪ/ oi
//   /ɑ/ a (never "o": knock → nak)   /ɛr/ eər (hair → heər; "e" + r before a vowel: KE-rək-tər)
// Word cards (course `words` rows) write a respelling of 2+ syllables with hyphens and the stressed
// syllable in CAPS (PRAB-ləm); decoder output and the lexicon are lowercase (see "Stress" in tables.ts).
// A word shown AS WRITTEN (way, know, mean, hear) is ordinary English spelling and is exempt;
// the rules apply to respelled pieces only. Well-known reductions (outta, doncha…) keep their
// usual spelling, and no respelled piece may be a real English word with another vowel
// ("aid" for I'd, "said" for side).
import { describe, expect, it } from 'vitest';
import { decode } from '../core/decoder';
import { RESPELL } from '../core/decoder/lexicon';
import { REDUCTIONS } from '../core/decoder/tables';
import { CHUNKS } from './chunks';
import { LESSONS } from './lessons';
import { PAIR_SETS } from './pairs';

/** Pieces that contain "ou" but are not /aʊ/ or /oʊ/, or are reductions the decoder prints too. */
const OU_OTHER = new Set([
  'you', 'your', 'yourself', 'dyou', 'should', 'shouldve', 'could', 'would', 'couple',
  'course', 'four', // /ɔr/
  'outta', 'doutta', // reduction of "out of", printed the same by the decoder
  'shoulda', 'coulda', 'woulda', 'oughta', // reductions of should/could/would have, ought to
]);
/** The decoder's own reduction spellings (whaddaya, outta…): rule 4, shown the same everywhere. */
const REDUCTION_WORDS = new Set(REDUCTIONS.flatMap((r) => r.spoken.toLowerCase().split(/[\s-]+/)));
/** Real English words that would be read with another vowel than the one they respell. */
const FALSE_WORDS = new Set(['said', 'main', 'aid', 'raid', 'lain', 'wail', 'mail', 'pain', 'laid', 'ail', 'aim', 'maim', 'wader', 'raider', 'raiding']);
/** Letter groups that the convention never uses inside a respelled piece. */
const OLD_SPELLINGS = /ay|ea|oa|oy|ow|ou|æ/;

/** Words of an English text, contractions also without their ending ("how's" → how's, how).
 *  n't words are not split: "don" is a respelling of don't, not a word shown as written. */
const words = (s: string) =>
  (s.toLowerCase().replace(/[’]/g, "'").match(/[a-z']+/g) ?? []).flatMap((w) =>
    /n't$/.test(w) ? [w] : [w, w.split("'")[0]],
  );

/** Pieces of every hyphenated respelling ("che-ki-daut" → che, ki, daut) in a string. */
function respellParts(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/[a-zəɪæ()]+(?:-[a-zəɪæ()]*)+|-[a-zəɪæ()]+/gi)) {
    for (const p of m[0].toLowerCase().split('-')) if (p) out.push(p);
  }
  return out;
}

/** Respelled pieces of `s` that break the convention. `written` = words shown as written. */
function violations(pieces: string[], written: Set<string>): string[] {
  return pieces.filter((raw) => {
    const p = raw.replace(/[()]/g, '');
    if (!p || written.has(p)) return false;
    if (FALSE_WORDS.has(p)) return true;
    if (p === 'kæn' || p === 'kænt') return false; // can't keeps its taught spelling
    if (OU_OTHER.has(p) || REDUCTION_WORDS.has(p)) return false;
    return OLD_SPELLINGS.test(p);
  });
}

function allStrings(o: unknown, out: string[]): string[] {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) for (const x of o) allStrings(x, out);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) allStrings(v, out);
  return out;
}

/** Every English text a lesson shows (examples, compare blocks, quiz sentences, word tables, choose items). */
function englishTexts(o: unknown, out: string[]): string[] {
  if (Array.isArray(o)) for (const x of o) englishTexts(x, out);
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (['text', 'clear', 'natural', 'written', 'say', 'word', 'show', 'play'].includes(k) && typeof v === 'string') out.push(v);
      else if (k === 'options' && Array.isArray(v) && v.every((x) => typeof x === 'string')) out.push(...(v as string[]));
      else englishTexts(v, out);
    }
  }
  return out;
}

/** Lesson examples and compare blocks: [English text, hand-written note]. */
function notedTexts(o: unknown, out: [string, string][]): [string, string][] {
  if (Array.isArray(o)) for (const x of o) notedTexts(x, out);
  else if (o && typeof o === 'object') {
    const r = o as Record<string, unknown>;
    // A compare block's note describes its natural version, so decode that one.
    const text =
      typeof r.text === 'string' ? r.text
      : typeof r.natural === 'string' ? r.natural
      : typeof r.clear === 'string' ? r.clear
      : typeof r.word === 'string' ? r.word // words-table row: its note may respell the word
      : undefined;
    if (text && typeof r.note === 'string') out.push([text, r.note]);
    for (const v of Object.values(r)) notedTexts(v, out);
  }
  return out;
}

/** Every English word a lesson, chunk or pair shows as written. */
const WRITTEN = new Set([
  ...englishTexts(LESSONS, []).flatMap(words),
  ...CHUNKS.flatMap((c) => [...words(c.written), ...words(c.example)]),
  ...PAIR_SETS.flatMap((s) => [...s.contrast.flatMap((c) => words(c.written)), ...s.items.flatMap((i) => i.options.flatMap(words))]),
]);

describe('respellings follow the decoder convention', () => {
  it('chunk respellings use the table spellings (ei, oh, au, ee, a)', () => {
    for (const c of CHUNKS) {
      const shown = new Set([...words(c.written), ...words(c.example)]);
      const bad = violations(c.spoken.split(/[-\s]+/), shown);
      expect(bad, `${c.written} → ${c.spoken}`).toEqual([]);
    }
  });

  it('lesson notes use the table spellings for the words they respell', () => {
    for (const [text, note] of notedTexts(LESSONS, [])) {
      const bad = violations(respellParts(note), new Set(words(text)));
      expect(bad, `${text} → note "${note}"`).toEqual([]);
    }
  });

  // Word tables (every course): `sound` is a respelling of `word`, so the whole of it follows the table
  // (ei, oh, au, ee…), not only its hyphenated pieces.
  it('word-table sounds use the table spellings', () => {
    for (const l of LESSONS) {
      for (const sec of l.sections) {
        for (const b of sec.blocks) {
          if (b.type !== 'words') continue;
          for (const it of b.items) {
            const bad = violations(it.sound.split(/[-\s]+/), new Set(words(it.word)));
            expect(bad, `${l.id}: ${it.word} → ${it.sound}`).toEqual([]);
          }
        }
      }
    }
  });

  it('no respelling anywhere in lessons uses an old spelling', () => {
    const bad = new Set(allStrings(LESSONS, []).flatMap((s) => violations(respellParts(s), WRITTEN)));
    expect([...bad]).toEqual([]);
  });

  it('pair contrasts, descriptions and cues use the table spellings', () => {
    for (const s of PAIR_SETS) {
      const shown = new Set([...s.contrast.flatMap((c) => words(c.written)), ...s.items.flatMap((i) => i.options.flatMap(words))]);
      for (const c of s.contrast) {
        const plain = c.spoken.replace(/\/[^/]*\//g, '');
        expect(violations(plain.split(/[-\s]+/), shown), `${s.id}: ${c.written} → ${c.spoken}`).toEqual([]);
      }
      expect(violations(respellParts(s.description), shown), s.id).toEqual([]);
      for (const i of s.items) expect(violations(respellParts(i.cue), shown), i.id).toEqual([]);
    }
  });

  it('/oʊ/ in don\'t, won\'t, hold, most, told is spelled "oh"', () => {
    const strings = [...allStrings(CHUNKS, []), ...allStrings(LESSONS, []), ...allStrings(PAIR_SETS, [])];
    const old = /\b(doun|doum|wount|houl|hol-|tol-|mous|mos|pous|don like|don worry|don lai)\b/;
    expect(strings.filter((s) => old.test(s))).toEqual([]);
  });
});

describe('respellings agree with the decoder', () => {
  it('chunks spelled exactly like the decoder still match it', () => {
    for (const written of [
      'check it out', 'what about', 'how about', 'in an hour', 'get out', 'hold on', 'right away',
      'this year', 'last year', 'make it', "won't", "I'd", "can't", "I'll", "don't you",
    ]) {
      const chunk = CHUNKS.find((c) => c.written === written);
      expect(chunk, written).toBeDefined();
      expect(decode(written).spokenText, written).toBe(chunk?.spoken);
    }
  });

  it('chunks whose decoder output respells /eɪ/ /oʊ/ /iː/ use the same vowel letters', () => {
    const pairs: [string, string][] = [
      ['see you later', 'lei'], ['talk to you later', 'lei'], ['wait a minute', 'wei-də'],
      ['wait a second', 'wei-də'], ['take it easy', 'tei-ki'], ["don't have to", 'dohn'],
      ["I don't think so", 'dohn'], ['most of the', 'mohs-tə'],
    ];
    for (const [written, piece] of pairs) {
      const chunk = CHUNKS.find((c) => c.written === written);
      expect(chunk?.spoken, written).toContain(piece);
      expect(decode(written).spokenText, written).toContain(piece);
    }
  });

  it('a chunk whose example the decoder reduces spells the reduction the same way (hafta, didja, ə lotta)', () => {
    // the shadowing screen shows chunk.spoken next to the decoded example
    const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '-');
    for (const c of CHUNKS) {
      for (const a of decode(c.example).annotations) {
        if (a.type !== 'reduction' || !norm(c.written).includes(norm(a.original))) continue;
        expect(norm(c.spoken), `${c.written} → ${c.spoken} (example: ${a.original} → ${a.spoken})`).toContain(norm(a.spoken));
      }
    }
  });

  it('pair respellings of he / she / the use "ee" like the decoder ("hiz" is his, not he\'s)', () => {
    const strings = PAIR_SETS.flatMap((s) => allStrings(s, []));
    expect(strings.filter((s) => /"(hiz|hi|shi|shiz|hid|shid)[- ]|thi-y/i.test(s) || /'(hiz|hi-wəz)'/.test(s))).toEqual([]);
  });

  it('notes written to match the decoder still match it', () => {
    const notes = new Map<string, string>();
    for (const [text, note] of notedTexts(LESSONS, [])) if (!notes.has(text)) notes.set(text, note);
    for (const text of [
      'Where are you?', 'Check it out.', 'Get it out.', 'Is he OK?', 'Hold on a second.',
      "It's far away.", 'The car is outside.', 'Take his advice.', 'Wait a minute.', 'I agree.',
      'You should have told her.', 'What about it?',
    ]) {
      const note = notes.get(text);
      expect(note, text).toBeDefined();
      expect(decode(text).spokenText, text).toContain(note);
    }
  });
});

/** Every word-table row of every course. */
const wordRows = () =>
  LESSONS.flatMap((l) =>
    l.sections.flatMap((sec) => sec.blocks.flatMap((b) => (b.type === 'words' ? b.items.map((it) => ({ lesson: l.id, ...it })) : []))),
  );
/** IPA vowels: /ɛr/ before one of these is "e" + r (KE-rək-tər), otherwise "eər". */
const IPA_VOWEL = 'aeiouəɪʊɑɔæʌɝɚ';

describe('course word cards follow the convention of tables.ts', () => {
  it('/ɛr/ closing a syllable is "eər" (hair → heər, there → theər), never "er" (that is /ɜr/)', () => {
    for (const r of wordRows()) {
      if (!r.ipa || !new RegExp(`ɛr(?![${IPA_VOWEL}])`).test(r.ipa)) continue;
      expect(r.sound, `${r.lesson}: ${r.word} ${r.ipa}`).toMatch(/eər/i);
    }
  });
  it('/ɑ/ is "a", never "o" (knock → nak, doctor → DAK-tər)', () => {
    for (const r of wordRows()) {
      // only words without /ɔ/ /oʊ/ /ɔɪ/, so every "o" left in the respelling would be the /ɑ/
      if (!r.ipa || !/ɑ(?!r)/.test(r.ipa) || /[ɔo]/.test(r.ipa)) continue;
      expect(r.sound.replace(/oh|oo|oi|or|ou/gi, ''), `${r.lesson}: ${r.word} ${r.ipa} → ${r.sound}`).not.toMatch(/o/i);
    }
  });
  it('stress: 2+ syllables are hyphenated with exactly one CAPS syllable; no caps without hyphens', () => {
    for (const r of wordRows()) {
      for (const tok of r.sound.replace(/\bI('[a-z]+)?\b/g, 'ai').split(/\s+/)) {
        const caps = tok.split('-').filter((p) => /[A-Z]/.test(p));
        if (tok.includes('-')) expect(caps.length, `${r.lesson}: ${r.word} → ${r.sound}`).toBe(1);
        else expect(tok, `${r.lesson}: ${r.word} → ${r.sound}`).not.toMatch(/[A-Z]/);
        // only Latin letters are capitalised: ə stays lowercase (KEəR-fəl)
        expect(tok, `${r.lesson}: ${r.word} → ${r.sound}`).not.toMatch(/Ə/);
      }
    }
  });
});

describe('course word cards agree with the decoder lexicon', () => {
  /** Cards that deliberately differ from the lexicon entry, and why. */
  const DIFFERENT = new Map<string, string>([
    ['actually', 'card teaches the fast form AKSH-li'],
    ['probably', 'card teaches the fast form PRAB-li'],
    ['definitely', 'card teaches the fast form DEF-nət-li'],
    ['family', 'card shows the careful three syllables'],
    ['library', 'card teaches the r-dropping LAI-be-ri'],
    ['restaurant', 'card teaches the two-syllable RES-trant'],
    ['subtle', 'card shows the flap T (SU-dəl)'],
    ['later', 'card shows the flap T (LEI-dər)'],
    ['aisle', "homophone I'll (rule 3)"],
  ]);
  // /k/ may be c before a / o / u in the lexicon (cud, cof); the where-family keeps "wh" in the decoder only
  const norm = (s: string) => s.toLowerCase().replace(/-/g, '').replace(/c(?=[aou])/g, 'k').replace(/^wh/, 'w');
  it('same letters as RESPELL, apart from syllable hyphens and stress capitals', () => {
    for (const r of wordRows()) {
      const w = r.word.toLowerCase();
      const d = RESPELL[w];
      if (!d || r.say || DIFFERENT.has(w)) continue; // heteronym rows (say) pick one of the readings
      expect(norm(r.sound), `${r.lesson}: ${r.word} → ${r.sound} (lexicon: ${d})`).toBe(norm(d));
    }
  });
});
