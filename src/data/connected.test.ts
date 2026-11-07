// "Nghe" must SOUND like the annotations on screen. Every built-in sentence (dictation, checkup sentence and
// passage line, connected-course example) that shows an annotation changing the sound gets a connected text
// (speakableFor(text, say): the authored `say`, else the decoder's generated speakText) that differs from the
// written text. Exceptions are explicit: annotations an engine already says right, or that no measured spelling
// can say (by rule, below), and whole sentences in AS_WRITTEN, each with its reason. Contract: docs/courses.md
// ("Connected playback: say"). Phonemes: Windows SAPI (Microsoft David), System.Speech PhonemeReached, 2026-11-07.
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../core/decoder';
import { PLACE_SPEAK, WEAK_SPEAK } from '../core/decoder/tables';
import type { Annotation, Token } from '../core/types';
import { BENCHMARK_FORMS } from './benchmark';
import { CONNECTED_LESSONS } from './lessons';
import { SENTENCES } from './sentences';

/** Annotation types that change how the words sound (linking and written contractions do not need respelling). */
const SOUND_TYPES = new Set<Annotation['type']>(['reduction', 'h-dropping', 'flap-t', 'weak-form', 'elision', 'assimilation']);

/** Weak forms the engine already says weak: the written word IS the connected form (SAPI phonemes). */
const ENGINE_SAYS_WEAK: Record<string, string> = {
  a: 'SAPI: ax',
  an: 'SAPI: ax n',
  the: 'SAPI: dh ax',
  to: 'SAPI: t uh ("ta" is read /tɑ/)',
  was: 'SAPI: w ax z',
  were: 'SAPI: w er',
  been: 'SAPI: b ih n',
  them: 'SAPI: dh ax m; glued where safe (tellem), a lone "\'em" is read /ɛm/',
};

/** Weak forms with no spelling measured to read the weak vowel: kept written ("when unsure keep the written word"). */
const NO_WEAK_SPELLING: Record<string, string> = {
  of: 'only fused forms read right (cuppa, kinda, a lotta); a lone "a" would change the words',
  at: 'SAPI says ae t; no spelling of /ət/ reads right',
  as: 'SAPI says ae z; no spelling of /əz/ reads right',
  than: '"then" is another word',
  that: 'SAPI says dh ae t; no spelling of /ðət/ reads right',
  or: '"er" is read as the letters E-R',
  us: 'no spelling of /əs/ reads right',
  our: '"ar" is read as the letter R',
  will: 'no spelling of /wəl/ reads right',
  some: '"sum" is the same /ʌ/ SAPI already says (s ah m)',
  but: 'SAPI says b ah t (close); "budda" is read Buddha',
  just: 'SAPI says jh ah s t (close); "jest" changes the vowel',
  does: '"duz" is the same /ʌ/ SAPI already says (d ah z)',
  are: 'no measured spelling; kept written',
  have: 'no measured spelling (shoulda / hafta forms come from other tables)',
  has: 'no measured spelling; kept written',
  had: 'no measured spelling; kept written',
  do: 'no measured spelling (whaddaya comes from the reductions); kept written',
  would: 'no measured spelling (woulda / would juh come from other tables); kept written',
};

/**
 * Whole sentences that stay as written although an annotation changes the sound: no spelling read right by both the
 * browser voice and the AI voice was found (each was probed with SAPI). The AI voice's casual style
 * (CONNECTED_STYLE) usually reduces these on its own. Remove an entry once it gets a reviewed `say`.
 */
const AS_WRITTEN: Record<string, string> = {
  "I'll do it first thing tomorrow.": 'first: firs / firss / firsst / furs / firsthing are all read /fɜrz/',
  "Let's eat out tonight.": 'eat out: "eed" is read as letters, "eadout" is not a safe spelling for neural voices',
  'Is it spicy? I can\'t eat anything too hot.': 'eat anything: same as eat out',
  'Wake him up at seven.': 'silent-e verb + him: "Wakim" reads right in SAPI but is also a name (/wəˈkim/)',
  'So who\'s your favorite actor right now?': 'who\'s your /zh/ has no established spelling; favorite actor is too long to glue',
  "I forgot to charge it, so it's almost dead.": 'almost: almose / almosst / almohs change the vowel (ao, aa)',
  "Hang on, I'm almost done here.": 'almost: same as above',
  "I can't believe he said that to me in front of everyone.": 'h-less "he": a lone \'e is the letter E; "believee" is no spelling',
  'I asked him to call me when he gets in.': 'asked him: "asktim" / "askdim" change the vowel; "whennee" is no established spelling',
  "Hi, it's about the apartment you asked about.": 'apartment you: a long word, "apartmencha" would be mispronounced',
  'Hey, just a quick update. The restaurant was fully booked at seven.': 'restaurant was: "restauran" is read with the wrong stress',
};

interface Item {
  where: string;
  text: string;
  say?: string;
}

function items(): Item[] {
  const out: Item[] = [];
  for (const s of SENTENCES) out.push({ where: s.id, text: s.text, say: s.say });
  for (const f of BENCHMARK_FORMS) {
    for (const s of f.sentences) out.push({ where: s.id, text: s.text, say: s.say });
    for (const q of f.questions) q.lines.forEach((line, i) => out.push({ where: `${q.id} line ${i + 1}`, text: line, say: q.say?.[i] }));
  }
  for (const l of CONNECTED_LESSONS)
    for (const sec of l.sections)
      for (const b of sec.blocks) if (b.type === 'examples') for (const ex of b.items) out.push({ where: l.id, text: ex.text, say: ex.say });
  return out;
}

/** Why this annotation needs no respelling, or null when the connected text must change for it. */
function exempt(a: Annotation, tokens: Token[]): string | null {
  if (!SOUND_TYPES.has(a.type)) return 'linking / written contraction';
  const left = tokens[a.from]?.word ?? '';
  if (a.type === 'flap-t' && a.from === a.to) return 'a flap inside one word (inWordFlap respells it only where safe)';
  if (a.type === 'flap-t' && /d$/.test(left)) return 'the written d already sounds like the flap (good as, could I)';
  if (a.type === 'weak-form') {
    const w = a.original.toLowerCase();
    return ENGINE_SAYS_WEAK[w] ?? NO_WEAK_SPELLING[w] ?? null;
  }
  // n → m: only the m-forms SAPI reads right are generated (tem, wum, fifteem); "om" / "im" are read O-M / "I'm"
  if (a.type === 'assimilation' && a.ipa === '/n/ → /m/' && !PLACE_SPEAK[left]) return 'no measured m-form';
  return null;
}

/** The annotations of `text` that the connected text must make audible. */
function mustSound(text: string): Annotation[] {
  const r = decode(text);
  return r.annotations.filter((a) => exempt(a, r.tokens) === null);
}

describe('connected playback of the built-in content', () => {
  it('the weak-form exceptions cover exactly the weak words the generator keeps written', () => {
    const kept = Object.entries(WEAK_SPEAK)
      .filter(([w, f]) => f === null || w === 'them')
      .map(([w]) => w)
      .sort();
    expect([...Object.keys(ENGINE_SAYS_WEAK), ...Object.keys(NO_WEAK_SPELLING)].sort()).toEqual(kept);
  });

  it('every annotated sentence sounds connected on "Nghe" (or is listed in AS_WRITTEN with its reason)', () => {
    const flat = items()
      .filter((it) => !(it.text in AS_WRITTEN) && mustSound(it.text).length > 0 && speakableFor(it.text, it.say) === it.text)
      .map((it) => `${it.where}: ${it.text} [${mustSound(it.text).map((a) => `${a.type} ${a.original}`).join(', ')}]`);
    expect(flat).toEqual([]);
  });

  it('AS_WRITTEN lists only built-in sentences that still need it', () => {
    const all = new Map(items().map((it) => [it.text, it]));
    for (const [text, why] of Object.entries(AS_WRITTEN)) {
      const it = all.get(text);
      expect(it, `not built-in: ${text}`).toBeDefined();
      expect(why.trim(), text).not.toBe('');
      expect(mustSound(text).length, `no sound-changing annotation left: ${text}`).toBeGreaterThan(0);
      expect(speakableFor(text, it?.say), `now speaks connected, remove it: ${text}`).toBe(text);
    }
  });

  it('the reviewed lesson spellings are what the generator makes for the same phrase', () => {
    // a dictation sentence and a lesson example with the same phrase must not sound different
    const same: [string, string][] = [
      ['Turn it off.', 'Turnid off.'],
      ['Check it out.', 'Checkid out.'],
      ['Pick it up.', 'Pickid up.'],
      ['Give him a call.', 'Givim a call.'],
      ['I love her.', 'I luvver.'],
      ['Bless you!', 'Bleshu!'],
      ['Last year was hard.', 'Lass cheer was hard.'],
      ['We met ten people.', 'We met tem people.'],
      ['One more, please.', 'Wum more, please.'],
      ["That's what I said.", "That's whaddai said."],
      ['Wait a minute.', 'Waida minute.'],
      ["Don't worry.", 'Dohn worry.'],
      ['He kept quiet.', 'He kep quiet.'],
      ['I can swim.', 'I kin swim.'],
      ["I'm from Vietnam.", "I'm frum Vietnam."],
    ];
    for (const [text, want] of same) expect(speakableFor(text), text).toBe(want);
    // the dictation sentences the earlier gate flagged
    expect(speakableFor('Turn it off, please.')).toBe('Turnid off, please.');
    expect(speakableFor('Get some rest tonight.')).toBe('Get some ress tonight.');
    expect(speakableFor('I like it a lot.')).toBe('I like idda lot.');
    expect(speakableFor('I miss you so much.')).toBe('I mishu so much.');
  });
});
