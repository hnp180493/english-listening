// Accuracy upgrades: respelled receiving words, -ing linking, teachable n→m only,
// light POS heuristics for weak forms, abbreviations and the expanded lexicon.
import { describe, expect, it } from 'vitest';
import type { DecodeResult, Phenomenon } from '../types';
import { decode } from './index';
import { finalSound, flapWord, isAbbreviation, ngSyllables, respellBase, rightForm, startsWithVowelSound } from './lexicon';
import { SENTENCES } from '../../data/sentences';
import { CHUNKS } from '../../data/chunks';

const ann = (r: DecodeResult, type: Phenomenon, from: number) => r.annotations.find((a) => a.type === type && a.from === from);
const weakOn = (r: DecodeResult, i: number) => r.annotations.find((a) => a.type === 'weak-form' && a.from === i);
const has = (r: DecodeResult, type: Phenomenon) => r.annotations.some((a) => a.type === type);
const nm = (r: DecodeResult) => r.annotations.some((a) => a.type === 'assimilation' && a.ipa === '/n/ → /m/');
const spoken = (s: string) => decode(s).spokenText;

describe('the word that receives a sound is respelled', () => {
  it('good idea → goo-dai-deeə', () => {
    expect(ann(decode('That is a good idea.'), 'flap-t', 3)?.spoken).toBe('goo-dai-deeə');
  });
  it('had enough → ha-di-nuff', () => {
    expect(spoken('We had enough.')).toBe('we ha-di-nuff');
  });
  it('again / about / away get their schwa syllable', () => {
    expect(spoken('Say that again.')).toBe('say tha-də-gen');
    expect(spoken('Think about it.')).toBe('thin-kə-bau-dit');
    expect(spoken('It is far away.')).toContain('fa-rə-wei');
  });
  it('anything / anywhere / early read naturally', () => {
    expect(spoken('Did he say anything?')).toBe('di-dee say-yeni-thing');
    // /ɛr/ closing the word is "eər" (tables.ts), never "er" (/ɜr/ as in her)
    expect(spoken("I can't find it anywhere.")).toContain('fain-di-deni-wheər');
    expect(spoken('Get up early.')).toBe('ge-du-per-li');
  });
  it("eight o'clock → ei-də-klak (no stray apostrophe; /ɑ/ is \"a\", not \"o\")", () => {
    const s = spoken("I'll be there at eight o'clock.");
    expect(s).toContain('ei-də-klak');
    expect(s).not.toContain("'");
  });
  it('a syllable break never leaks as "|" and only shows when glued', () => {
    for (const s of ['about', 'Tell me about it.', 'again and again', 'early', 'I agree.']) {
      expect(spoken(s)).not.toContain('|');
    }
    expect(spoken('about')).toBe('about'); // not glued: written form
  });
  it('unknown a- words get an unstressed ə-: this soup tastes amazing', () => {
    expect(spoken('This soup tastes amazing!')).toContain('teist-sə-meizing');
    expect(rightForm('amazing')).toBe('ə|meizing');
    expect(rightForm('average')).not.toMatch(/^ə/);
  });
  it('short words keep their spelling and still split with the lexicon (is → iz)', () => {
    expect(spoken('What is it?')).toBe('wha-di-zit');
    expect(spoken('How much is it?')).toBe('how mu-chi-zit');
  });
  it('silent h: an hour, to be honest', () => {
    expect(ann(decode('an hour'), 'linking', 0)?.spoken).toBe('ə-nauər');
    expect(spoken('To be honest, no.')).toContain('be-ya-nəst');
  });
  it('the receiving "I" is written "ai" even without a moved consonant', () => {
    expect(spoken('Is there anything I can do?')).toContain('thing-ai');
  });
});

describe('ng + vowel shows the -ing syllable', () => {
  it('looking at → loo-king-ət', () => {
    expect(ann(decode('I was looking at it.'), 'linking', 2)?.spoken).toBe('loo-king-ət');
  });
  it('taking a / thinking of / feeling a', () => {
    expect(spoken('Are you taking a cab?')).toContain('tei-king-ə');
    expect(spoken('I was thinking of you.')).toContain('thin-king-ə');
    expect(spoken("I've been feeling a little tired.")).toContain('fee-ling-ə');
  });
  it('ngSyllables handles doubled consonants, silent e and leaves -thing / vowel stems alone', () => {
    expect(ngSyllables('gedding')).toBe('ge-ding');
    expect(ngSyllables('making')).toBe('mei-king');
    expect(ngSyllables('coming')).toBe('cu-ming');
    expect(ngSyllables('watching')).toBe('wat-ching');
    expect(ngSyllables('something')).toBeNull();
    expect(ngSyllables('going')).toBeNull();
    expect(ngSyllables('king')).toBeNull();
  });
});

describe('n → m only in clear, teachable cases', () => {
  it('keeps function words and numbers: in Boston, ten minutes, on my way, one more', () => {
    expect(ann(decode('I live in Boston.'), 'assimilation', 2)?.spoken).toBe('im boston');
    expect(ann(decode('I need it in ten minutes.'), 'assimilation', 4)?.spoken).toBe('tem minutes');
    expect(nm(decode("I'm on my way."))).toBe(true);
    expect(ann(decode('One more time.'), 'assimilation', 0)?.spoken).toBe('wum more');
  });
  it('keeps adjective + noun: a green bag', () => {
    expect(ann(decode('a green bag'), 'assimilation', 1)?.spoken).toBe('greem bag');
  });
  it('drops content verbs and nouns: mean by, been meaning, the man bought', () => {
    expect(nm(decode("I don't know what you mean by that."))).toBe(false);
    expect(nm(decode("I've been meaning to call."))).toBe(false);
    expect(nm(decode('The man bought a car.'))).toBe(false);
    expect(nm(decode('the man by the door'))).toBe(false);
  });
  it('"can be" is not turned into "kəm be"', () => {
    const r = decode('I can be there.');
    expect(nm(r)).toBe(false);
    expect(weakOn(r, 1)?.spoken).toBe('kən');
  });
});

describe('light part-of-speech heuristics for weak forms', () => {
  it('"that" as a conjunction is weak', () => {
    expect(weakOn(decode('I think that you are right.'), 2)?.spoken).toBe('thət');
    expect(weakOn(decode('She said that the bus was late.'), 2)?.spoken).toBe('thət');
    expect(weakOn(decode('He told me that he was busy.'), 3)?.rule).toMatch(/liên từ/);
  });
  it('"that" as a demonstrative stays strong', () => {
    expect(weakOn(decode('I like that game.'), 2)).toBeUndefined();
    expect(weakOn(decode('Is that your bag?'), 1)).toBeUndefined();
    expect(weakOn(decode('Look at that!'), 2)).toBeUndefined();
    expect(weakOn(decode('Is that it?'), 1)).toBeUndefined();
    expect(weakOn(decode('That I know.'), 0)).toBeUndefined();
  });
  it('"some" is weak before a noun, strong as a pronoun', () => {
    expect(weakOn(decode('I need some water.'), 2)?.spoken).toBe('səm');
    expect(weakOn(decode('Some of them left.'), 0)).toBeUndefined();
    expect(weakOn(decode('Do you want some?'), 3)).toBeUndefined();
    expect(weakOn(decode('Some say it is true.'), 0)).toBeUndefined();
  });
  it('"can" as a noun is strong', () => {
    expect(weakOn(decode('Throw it in the trash can, please.'), 5)).toBeUndefined();
    expect(weakOn(decode('I want a can of soda.'), 3)).toBeUndefined();
    expect(weakOn(decode('I can help.'), 1)?.spoken).toBe('kən');
  });
  it('"them" is weak even at the end of a phrase: find them → fain-dəm', () => {
    const r = decode('Can you find them?');
    expect(weakOn(r, 3)?.spoken).toBe('əm');
    expect(r.spokenText).toContain('fain-dəm');
    expect(spoken('Look at them.')).toBe('loo-kə-dəm');
  });
  it('main-verb "have" after a modal is strong: I\'ll have the steak', () => {
    const r = decode("I'll have the steak.");
    expect(has(r, 'h-dropping')).toBe(false);
    expect(weakOn(r, 1)).toBeUndefined();
    expect(ann(decode('You should have known.'), 'h-dropping', 1)?.spoken).toBe('shu-dəv');
  });
});

describe('abbreviations are read letter by letter', () => {
  it('detects abbreviations but not interjections or titles', () => {
    expect(isAbbreviation('tv')).toBe(true);
    expect(isAbbreviation('dvd')).toBe(true);
    expect(isAbbreviation('fbi')).toBe(true);
    expect(isAbbreviation('hmm')).toBe(false);
    expect(isAbbreviation('mr')).toBe(false);
    expect(isAbbreviation('my')).toBe(false);
  });
  it('TV links with a /j/ glide, keeps its capitals, never "t-vis"', () => {
    const s = spoken('The TV is too loud.');
    expect(s).toContain('TV-yis');
    expect(s).not.toContain('t-vis');
  });
  it('an FBI agent: vowel-sound start, spelled when it receives a sound', () => {
    expect(startsWithVowelSound('fbi')).toBe(true);
    expect(weakOn(decode('a TV show'), 0)?.spoken).toBe('ə');
    expect(spoken('He is an FBI agent.')).toContain('ə-nef-bee-ai');
  });
  it('words with digits are shown as written', () => {
    expect(spoken('It is on 5th Street.')).toContain('5th');
  });
});

describe('expanded lexicon', () => {
  it('irregular spellings respell as they sound', () => {
    const cases: [string, string][] = [
      ['people', 'peepəl'], ['women', 'wimin'], ['business', 'biznəs'], ['said', 'sed'], ['friend', 'frend'],
      ['island', 'ailənd'], ['wednesday', 'wenzdei'], ['colonel', 'kernəl'], ['listen', 'lisən'], ['castle', 'kasəl'],
      ['answer', 'ansər'], ['sword', 'sord'], ['could', 'cud'], ['laugh', 'laf'], ['enough', 'inuf'], ['though', 'thoh'],
      ['through', 'throo'], ['thought', 'thot'], ['bought', 'bot'], ['eight', 'eit'], ['height', 'hait'], ['key', 'kee'],
    ];
    for (const [w, r] of cases) expect(respellBase(w), w).toBe(r);
  });
  it('suffix rules: -tion, -ture, -ous, -ight, -er', () => {
    expect(respellBase('station')).toBe('steishən');
    expect(respellBase('question')).toBe('kweschən');
    expect(respellBase('decision')).toBe('decizhən');
    expect(respellBase('picture')).toBe('pikchər');
    expect(respellBase('famous')).toBe('feiməs');
    expect(respellBase('delight')).toBe('delait');
    expect(respellBase('actor')).toBe('actər'); // the -or → ər heuristic
    expect(respellBase('doctor')).toBe('daktər'); // lexicon: /ɑ/ is "a", like the course card DAK-tər
    expect(respellBase('prefer')).toBe('prefer');
  });
  it('multi-syllable silent-e words: invite, complete, engine, notice, message', () => {
    expect(respellBase('invite')).toBe('invait');
    expect(respellBase('complete')).toBe('kəmpleet');
    expect(respellBase('engine')).toBe('engin');
    expect(respellBase('notice')).toBe('nohtis');
    expect(respellBase('message')).toBe('mesij');
    expect(respellBase('change')).toBe('cheinj');
    expect(respellBase('type')).toBe('taip');
  });
  it('-ed / -s stems: missed → mist, players → pleiərz, sequel\'s keeps /z/', () => {
    expect(respellBase('missed')).toBe('mist');
    expect(respellBase('players')).toBe('pleiərz');
    expect(finalSound("sequel's")).toMatchObject({ c: 'z' });
  });
  it('final sounds of tricky words', () => {
    expect(finalSound('league')).toMatchObject({ kind: 'cons', c: 'g' });
    expect(finalSound('unique')).toMatchObject({ kind: 'cons', c: 'k' });
    expect(finalSound('maybe')).toEqual({ kind: 'vowel', glide: 'y' });
    expect(finalSound('recipe')).toEqual({ kind: 'vowel', glide: 'y' });
    expect(finalSound('response')).toMatchObject({ c: 's' });
    expect(finalSound('tv')).toEqual({ kind: 'vowel', glide: 'y' });
  });
  it('vowel-sound starts: ones / unique are consonant starts, unusual is a vowel start', () => {
    expect(startsWithVowelSound('ones')).toBe(false);
    expect(startsWithVowelSound('unique')).toBe(false);
    expect(startsWithVowelSound('unusual')).toBe(true);
    expect(startsWithVowelSound('honorable')).toBe(true);
  });
  it('flap T keeps the long vowel of silent-e verbs', () => {
    expect(flapWord('voting')).toBe('vohding');
    expect(flapWord('deleted')).toBe('dileedid');
    expect(flapWord('limited')).toBe('limided'); // "limit" has no silent e
    expect(flapWord('water')).toBe('wadder');
  });
  it('miss-tar is fixed: we missed our flight → mis-tar', () => {
    expect(spoken('We missed our flight.')).toContain('mis-tar');
  });
});

describe('no absurd respellings on the whole dataset', () => {
  const texts = [...SENTENCES.map((s) => s.text), ...CHUNKS.map((c) => c.example)];
  it('no stray "|", apostrophes inside glued words, lowercase-uppercase mixes or empty pieces', () => {
    for (const t of texts) {
      const r = decode(t);
      for (const seg of r.segments) {
        expect(seg.spoken, t).not.toContain('|');
        expect(seg.spoken, t).not.toMatch(/--|^-|-$/);
        if (seg.to > seg.from) expect(seg.spoken, t).not.toMatch(/[a-z]-[a-z]*'[a-z]/);
        expect(seg.spoken, t).not.toMatch(/[a-zə][A-Z]/);
      }
      for (const a of r.annotations) expect(a.spoken, t).not.toContain('|');
    }
  });
  it('the review list of bad outputs is gone', () => {
    const all = texts.map((t) => spoken(t)).join(' \n ');
    for (const bad of ['goo-didea', 'ha-denough', 'delede-dit', 'looking-at', 'bim meaning', 'meam by', 'kəm be', 't-vis', 'miss-tar']) {
      expect(all).not.toContain(bad);
    }
  });
});

describe('review fixes: silent-e past tenses, un-/a- prefixes, eat, titles, "is that" clauses', () => {
  it('-ed verbs whose base ends in silent e keep their vowel (tired → taiər, changed → cheinj)', () => {
    expect(respellBase('tired')).toBe('taiərd');
    expect(respellBase('fired')).toBe('faiərd');
    expect(respellBase('changed')).toBe('cheinjd');
    expect(respellBase('danced')).toBe('danst');
    expect(respellBase('judged')).toBe('jujd');
    expect(respellBase('binged')).toBe('binjd');
    expect(respellBase('ignored')).toBe('ignord');
    expect(respellBase('prepared')).toBe('prepeərd'); // /ɛr/ = eər
    expect(spoken("I'm tired of it.")).toBe("I'm taiər-də-vit");
    expect(spoken('We binged the whole season.')).toContain('binj thə');
  });
  it('-ng / -or stems without a silent e are left alone (longed, colored)', () => {
    expect(respellBase('longed')).toBe('longd');
    expect(respellBase('colored')).not.toMatch(/colord$/);
  });
  it('-ied and -ies: cried → craid, tries → traiz, ladies keep the -y sound', () => {
    expect(respellBase('cried')).toBe('craid');
    expect(respellBase('satisfied')).toBe('satisfaid');
    expect(respellBase('tries')).toBe('traiz');
    expect(respellBase('ladies')).toBe('ladyz');
    expect(spoken('She cried all night.')).toContain('crai-dall');
  });
  it('eat is respelled "eet" on both sides of a link', () => {
    expect(spoken("Let's eat out tonight.")).toContain('let-see-daut');
    expect(spoken('Did you eat yet?')).toBe('didja ee-chet');
    expect(spoken("I can't eat anything.")).toContain('ee-deni-thing');
  });
  it('unstressed un- prefix when the word receives a sound', () => {
    expect(rightForm('unexpected')).toBe('ə|nikspektid');
    expect(rightForm('unbelievable')).toMatch(/^ən\|/);
    expect(rightForm('understood')).toBe('undər|stood');
    expect(spoken('It is totally unexpected.')).toContain('tohdəli-yə-nikspektid');
    expect(rightForm('unique')).toBe('yooneek'); // not a vowel start: untouched
  });
  it('unstressed a- with a doubled consonant, but stressed apple / accident stay', () => {
    expect(rightForm('arranged')).toBe('ə|reinjd');
    expect(spoken('I attended a class.')).toContain('I-yə-tendi-də');
    expect(rightForm('apple')).toBe('apəl');
    expect(rightForm('accident')).not.toMatch(/^ə/);
    expect(rightForm('assignment')).toBe('ə|sainmənt');
  });
  it('titles are read as words: Mr. Brown → mistər', () => {
    expect(spoken('Mr. Brown is here.')).toBe('mistər brau-nis here');
    expect(spoken('Ms. Smith left.')).toContain('miz');
  });
  it('"<noun> is that + subject" is a weak conjunction; "Is that you?" stays strong', () => {
    expect(weakOn(decode('The problem is that we are late.'), 3)?.spoken).toBe('thət');
    expect(weakOn(decode('The point was that it worked.'), 3)?.spoken).toBe('thət');
    expect(weakOn(decode('Is that you?'), 1)).toBeUndefined();
    expect(weakOn(decode('Who is that he is talking to?'), 2)).toBeUndefined();
  });
  it('wh-questions keep the auxiliary weak; elliptical "Can you?" stays strong', () => {
    expect(weakOn(decode('Where are you?'), 1)?.spoken).toBe('ər');
    expect(weakOn(decode('Where were you?'), 1)?.spoken).toBe('wər');
    expect(weakOn(decode('How was it?'), 1)?.spoken).toBe('wəz');
    expect(weakOn(decode('Can you?'), 0)).toBeUndefined();
    expect(weakOn(decode('Are they?'), 0)).toBeUndefined();
    expect(weakOn(decode('Yes, I do.'), 2)).toBeUndefined();
  });
  it('have/has in an inverted question is an auxiliary: where have you been → whe-rəv', () => {
    expect(ann(decode('Where have you been?'), 'h-dropping', 0)?.spoken).toBe('whe-rəv');
    expect(spoken('Where have you been?')).toContain('whe-rəv yə');
    expect(ann(decode('What have you done?'), 'h-dropping', 0)?.spoken).toBe('wha-dəv');
    expect(weakOn(decode('Has he left yet?'), 0)?.spoken).toBe('həz');
    expect(weakOn(decode('Have you seen it?'), 0)?.spoken).toBe('həv');
    // main verb stays strong
    expect(weakOn(decode('Have you any idea?'), 0)).toBeUndefined();
    expect(weakOn(decode("I'll have the steak."), 1)).toBeUndefined();
    expect(weakOn(decode('We had it fixed.'), 1)).toBeUndefined();
  });
  it('/oʊ/ is respelled "oh", /aʊ/ "au": no fake "you" after a glide', () => {
    expect(spoken('Call me okay?')).toContain('me-yoh-kei');
    expect(spoken('I opened it.')).toContain('I-yohpən-dit');
    expect(spoken('The phone on the table.')).toContain('foh-non');
    expect(spoken('Get out.')).toContain('ge-daut');
    expect(spoken('Why out?')).toContain('why-yaut');
    expect(spoken('He found his keys.')).toContain('faun-diz');
    expect(respellBase('known')).toBe('nohn');
    expect(respellBase('home')).toBe('hohm');
    expect(respellBase('remote')).toBe('remoht');
    for (const t of ['Call me okay?', 'I opened it.', 'Get out.', 'Go out now.', 'an hour ago']) {
      expect(spoken(t), t).not.toMatch(/you(?!r)|-ou|\bou/);
    }
  });
  it('idea keeps its /aɪ/: no idea → no-wai-deeə', () => {
    expect(spoken('I still have no idea.')).toContain('no-wai-deeə');
    expect(spoken("That's a great idea!")).toContain('grei-dai-deeə');
  });
  it('decodes fast: well under 5 ms per sentence', () => {
    const texts = [...SENTENCES.map((s) => s.text), ...CHUNKS.map((c) => c.example)];
    const t0 = performance.now();
    for (const t of texts) decode(t);
    const per = (performance.now() - t0) / Math.max(1, texts.length);
    expect(per).toBeLessThan(5);
  });
});
