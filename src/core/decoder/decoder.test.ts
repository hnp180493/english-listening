import { describe, expect, it } from 'vitest';
import type { DecodeResult, Phenomenon } from '../types';
import { decode } from './index';
import { finalSound, flapWord, startsWithVowelSound } from './lexicon';
import { tokenize } from './tokenize';
import { SENTENCES } from '../../data/sentences';

const has = (r: DecodeResult, type: Phenomenon, from?: number, to?: number) =>
  r.annotations.some((a) => a.type === type && (from === undefined || a.from === from) && (to === undefined || a.to === to));
const ann = (r: DecodeResult, type: Phenomenon, from: number) => r.annotations.find((a) => a.type === type && a.from === from);
const weakOn = (r: DecodeResult, i: number) => r.annotations.find((a) => a.type === 'weak-form' && a.from === i);

function checkInvariants(r: DecodeResult) {
  // tokens are indexed in order
  r.tokens.forEach((t, i) => expect(t.index).toBe(i));
  // segments: in-order partition covering every token exactly once
  let next = 0;
  for (const s of r.segments) {
    expect(s.from).toBe(next);
    expect(s.to).toBeGreaterThanOrEqual(s.from);
    expect(s.spoken.length).toBeGreaterThan(0);
    next = s.to + 1;
  }
  expect(next).toBe(r.tokens.length);
  // annotations: unique ids, valid spans, Vietnamese rule present
  const ids = new Set<string>();
  for (const a of r.annotations) {
    expect(ids.has(a.id)).toBe(false);
    ids.add(a.id);
    expect(a.from).toBeGreaterThanOrEqual(0);
    expect(a.to).toBeGreaterThanOrEqual(a.from);
    expect(a.to).toBeLessThan(r.tokens.length);
    expect(a.rule.length).toBeGreaterThan(10);
    expect(a.spoken.length).toBeGreaterThan(0);
  }
  // segment annotationIds reference real annotations that intersect the segment
  for (const s of r.segments) {
    for (const id of s.annotationIds) {
      const a = r.annotations.find((x) => x.id === id);
      expect(a).toBeDefined();
      expect(a!.from <= s.to && a!.to >= s.from).toBe(true);
    }
  }
  expect(r.spokenText).toBe(r.segments.map((s) => s.spoken).join(' '));
}

describe('tokenize', () => {
  it('keeps raw punctuation, offsets and apostrophes', () => {
    const { tokens, brk } = tokenize("Well, I don’t know.");
    expect(tokens.map((t) => t.word)).toEqual(['well', 'i', "don't", 'know']);
    expect(tokens[0].raw).toBe('Well,');
    expect(tokens[0].start).toBe(0);
    expect(tokens[3].raw).toBe('know.');
    expect(brk).toEqual([true, false, false, true]);
  });
  it('hyphenated words are not a phrase boundary, spaced dashes are', () => {
    expect(tokenize('well-known actor').brk).toEqual([false, false, true]);
    expect(tokenize('wait - stop').brk).toEqual([true, true]);
  });
});

describe('lexicon', () => {
  it('knows vowel-sound starts', () => {
    expect(startsWithVowelSound('hour')).toBe(true);
    expect(startsWithVowelSound('honest')).toBe(true);
    expect(startsWithVowelSound('apple')).toBe(true);
    expect(startsWithVowelSound('university')).toBe(false);
    expect(startsWithVowelSound('use')).toBe(false);
    expect(startsWithVowelSound('one')).toBe(false);
    expect(startsWithVowelSound('european')).toBe(false);
    expect(startsWithVowelSound('umbrella')).toBe(true);
    expect(startsWithVowelSound('house')).toBe(false);
  });
  it('knows final sounds', () => {
    expect(finalSound('make')).toEqual({ kind: 'cons', c: 'k', afterVowel: true });
    expect(finalSound('have')).toMatchObject({ kind: 'cons', c: 'v' });
    expect(finalSound('see')).toEqual({ kind: 'vowel', glide: 'y' });
    expect(finalSound('play')).toEqual({ kind: 'vowel', glide: 'y' });
    expect(finalSound('go')).toEqual({ kind: 'vowel', glide: 'w' });
    expect(finalSound('how')).toEqual({ kind: 'vowel', glide: 'w' });
    expect(finalSound('night')).toEqual({ kind: 'cons', c: 't', afterVowel: true });
    expect(finalSound('through')).toEqual({ kind: 'vowel', glide: 'w' });
    expect(finalSound('far')).toMatchObject({ kind: 'cons', c: 'r' });
    expect(finalSound('asked')).toEqual({ kind: 'cons', c: 't', afterVowel: false });
    expect(finalSound('wanted')).toEqual({ kind: 'cons', c: 'd', afterVowel: true });
    expect(finalSound('is')).toMatchObject({ c: 'z' });
    expect(finalSound('this')).toMatchObject({ c: 's' });
    expect(finalSound('next')).toEqual({ kind: 'cons', c: 't', afterVowel: false });
  });
  it('flaps T inside common words but not after consonants', () => {
    expect(flapWord('water')).toBe('wadder');
    expect(flapWord('better')).toBe('bedder');
    expect(flapWord('city')).toBe('ciddy');
    expect(flapWord('getting')).toBe('gedding');
    expect(flapWord('party')).toBe('pardy');
    expect(flapWord('computer')).toBe('compuder');
    expect(flapWord('after')).toBeNull();
    expect(flapWord('hotel')).toBeNull();
    expect(flapWord('twenty')).toBeNull();
    expect(flapWord('mister')).toBeNull();
  });
});

describe('reductions', () => {
  it('want to go → wanna + go', () => {
    const r = decode('I want to go.');
    expect(has(r, 'reduction', 1, 2)).toBe(true);
    expect(r.segments.map((s) => s.spoken)).toEqual(['I', 'wanna', 'go']);
  });
  it('going to + verb → gonna', () => {
    const r = decode("I'm going to eat.");
    expect(ann(r, 'reduction', 1)?.spoken).toBe('gonna');
  });
  it('NO gonna in "going to school" / "going to the store" / "going to Paris"', () => {
    for (const s of ['I am going to school.', "I'm going to the store.", "We're going to Paris."]) {
      const r = decode(s);
      expect(r.annotations.some((a) => a.spoken.includes('gonna'))).toBe(false);
    }
  });
  it('I am going to → I\'m gonna', () => {
    const r = decode('I am going to call you.');
    expect(ann(r, 'reduction', 0)?.spoken).toBe("I'm gonna");
    expect(ann(r, 'reduction', 0)?.to).toBe(3);
  });
  it('table entries', () => {
    const cases: [string, string][] = [
      ['I have to go.', 'hafta'],
      ['He has to work.', 'hasta'],
      ['I kind of like it.', 'kinda'],
      ['Get out of here.', 'outta'],
      ['Let me see.', 'lemme'],
      ['Give me that.', 'gimme'],
      ["I don't know.", 'dunno'],
      ['Did you see it?', 'didja'],
      ['Could you help me?', 'cudja'],
      ['What are you doing?', 'whatcha'],
      ['What do you want?', 'whaddaya'],
      ['What did you say?', 'whaddidja'],
      ["Don't you like it?", 'doncha'],
      ['I bet you can.', 'betcha'],
      ['We ought to go.', 'oughta'],
      ['You were supposed to call.', 'spohsta'],
      ['I used to live here.', 'yoosta'],
      ['She wants to leave.', 'wantsta'],
      ['I need a lot of help.', 'ə lotta'],
      ['I left because I was tired.', 'cuz'],
    ];
    for (const [s, sp] of cases) {
      const r = decode(s);
      expect(r.annotations.some((a) => a.type === 'reduction' && a.spoken === sp), s).toBe(true);
    }
  });
  it('got to + place is not gotta', () => {
    expect(decode('I got to the station.').annotations.some((a) => a.spoken === 'gotta')).toBe(false);
    expect(decode("I've got to go.").annotations.some((a) => a.spoken === 'gotta')).toBe(true);
  });
  it('reduction does not cross a comma', () => {
    const r = decode('I want, to be honest, nothing.');
    expect(has(r, 'reduction')).toBe(false);
  });
});

describe('linking', () => {
  it('pick it up → one segment pi-ki-dup', () => {
    const r = decode('Pick it up.');
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].spoken).toBe('pi-ki-dup');
    expect(has(r, 'linking', 0, 1)).toBe(true);
    expect(has(r, 'flap-t', 1, 2)).toBe(true);
  });
  it('turn it off glues into one segment', () => {
    const r = decode('Turn it off, please.');
    expect(r.segments[0].from).toBe(0);
    expect(r.segments[0].to).toBe(2);
    expect(r.segments[0].spoken).toBe('tur-ni-doff');
    expect(r.segments[1].spoken).toBe('please');
  });
  it('an hour links n-auər (silent h)', () => {
    const r = decode('an hour');
    expect(ann(r, 'linking', 0)?.spoken).toBe('ə-nauər');
  });
  it('a university: no linking (starts with /j/)', () => {
    const r = decode('a university');
    expect(has(r, 'linking')).toBe(false);
    expect(r.segments).toHaveLength(2);
  });
  it('vowel-vowel glides /j/ and /w/', () => {
    expect(ann(decode('I am here.'), 'linking', 0)?.spoken).toBe('I-yam');
    expect(ann(decode('Go on.'), 'linking', 0)?.spoken).toBe('go-won');
    expect(ann(decode('See it?'), 'linking', 0)?.spoken).toBe('see-yit');
    expect(ann(decode('Do it now.'), 'linking', 0)?.spoken).toBe('do-wit');
  });
  it('American linking R', () => {
    expect(ann(decode('far away'), 'linking', 0)?.spoken).toBe('fa-rə-wei'); // the receiving word is respelled: /eɪ/ is 'ei'
    expect(ann(decode('for a while'), 'linking', 0)?.spoken).toBe('fə-rə');
  });
  it('silent e words move the right consonant', () => {
    expect(ann(decode('I like it.'), 'linking', 1)?.spoken).toBe('lai-kit');
    expect(ann(decode('Have a look.'), 'linking', 0)?.spoken).toBe('ha-və');
  });
  it('no linking across a comma or period', () => {
    const r = decode('Well, I think so. And Anna, open it.');
    expect(r.annotations.some((a) => a.from === 0 && a.to === 1)).toBe(false);
    expect(r.annotations.some((a) => a.from === 3 && a.to === 4)).toBe(false); // so. And
    expect(r.annotations.some((a) => a.from === 5 && a.to === 6)).toBe(false); // Anna, open
    expect(has(r, 'linking', 6, 7)).toBe(true); // open it (same phrase) still links
  });
  it('just ask keeps the t (linking, not elision)', () => {
    const r = decode('Just ask him later.');
    expect(has(r, 'elision', 0)).toBe(false);
    expect(ann(r, 'linking', 0)?.spoken).toBe('jəs-task');
  });
});

describe('flap T', () => {
  it('cross-word: get it, what is, put it on, not at all', () => {
    expect(ann(decode('Get it.'), 'flap-t', 0)?.spoken).toBe('ge-dit');
    expect(ann(decode('What is it?'), 'flap-t', 0)?.spoken).toBe('wha-dis');
    expect(decode('Put it on.').segments[0].spoken).toBe('pu-di-don');
    expect(decode('Not at all.').segments[0].spoken).toBe('na-də-dall');
  });
  it('intra-word flap is a single-token annotation', () => {
    const r = decode('I need some water.');
    const a = r.annotations.find((x) => x.type === 'flap-t');
    expect(a?.from).toBe(a?.to);
    expect(a?.spoken).toBe('wadder');
    expect(r.spokenText).toContain('wadder');
  });
});

describe('assimilation', () => {
  it('yod coalescence t/d/s/z + you', () => {
    expect(ann(decode('I want you.'), 'assimilation', 1)?.spoken).toBe('wan-chu');
    expect(ann(decode('Nice to meet you.'), 'assimilation', 2)?.spoken).toBe('mee-chu');
    expect(ann(decode('I need you.'), 'assimilation', 1)?.spoken).toBe('need-ju');
    expect(ann(decode('I miss you.'), 'assimilation', 1)?.spoken).toBe('mi-shu');
    expect(ann(decode('See you this year.'), 'assimilation', 2)?.spoken).toBe('thi-sheer');
    expect(ann(decode('As you know.'), 'assimilation', 0)?.spoken).toBe('ə-zhu');
  });
  it('n → m before b/p/m', () => {
    expect(ann(decode('ten boys'), 'assimilation', 0)?.spoken).toBe('tem boys');
    expect(ann(decode('She lives in Paris.'), 'assimilation', 2)?.spoken).toBe('im paris');
    expect(ann(decode('One more time.'), 'assimilation', 0)?.spoken).toBe('wum more');
  });
  it('assimilated tokens share one segment', () => {
    const r = decode('I want you.');
    expect(r.segments.map((s) => s.spoken)).toEqual(['I', 'wan-chu']);
  });
});

describe('h-dropping', () => {
  it('tell him, ask her, did he, must have', () => {
    expect(ann(decode('Tell him.'), 'h-dropping', 0)?.spoken).toBe('tel-lim');
    expect(ann(decode('Ask her.'), 'h-dropping', 0)?.spoken).toBe('as-kər');
    expect(ann(decode('Where did he go?'), 'h-dropping', 1)?.spoken).toBe('di-dee');
    expect(ann(decode('You must have seen it.'), 'h-dropping', 1)?.spoken).toBe('mus-təv');
  });
  it('no h-dropping at sentence start, after a pause, or for main-verb have', () => {
    expect(has(decode('He is here.'), 'h-dropping')).toBe(false);
    expect(has(decode('I told them, he left.'), 'h-dropping')).toBe(false);
    expect(has(decode('Most have a car.'), 'h-dropping')).toBe(false);
  });
});

describe('elision', () => {
  it('t/d between consonants', () => {
    expect(ann(decode('next day'), 'elision', 0)?.spoken).toBe('nex day');
    expect(ann(decode('last night'), 'elision', 0)?.spoken).toBe('las night');
    expect(ann(decode('You must be tired.'), 'elision', 1)?.spoken).toBe('mus be');
    expect(ann(decode('just like that'), 'elision', 0)?.spoken).toBe('jus like');
    expect(ann(decode('an old man'), 'elision', 1)?.spoken).toBe('ohl man');
    expect(ann(decode('and you?'), 'elision', 0)?.spoken).toBe('ən you');
  });
  it('elision does not glue segments', () => {
    const r = decode('next day');
    expect(r.segments.map((s) => s.spoken)).toEqual(['nex', 'day']);
    expect(r.segments[0].annotationIds).toEqual(r.segments[1].annotationIds);
  });
  it('no elision before a vowel', () => {
    expect(has(decode('Just ask.'), 'elision')).toBe(false);
    expect(has(decode('next item'), 'elision')).toBe(false);
  });
});

describe('weak forms', () => {
  it('cup of tea → cup-ə tea style', () => {
    const r = decode('a cup of tea');
    expect(weakOn(r, 2)?.spoken).toBe('ə');
    expect(r.spokenText).toBe('ə cu-pə tea');
  });
  it('common weak forms', () => {
    const r = decode('I can swim for an hour at the pool from time to time.');
    expect(weakOn(r, 1)?.spoken).toBe('kən');
    expect(weakOn(r, 3)?.spoken).toBe('fər');
    expect(weakOn(r, 6)?.spoken).toBe('ət');
    expect(weakOn(r, 7)?.spoken).toBe('thə');
    expect(weakOn(r, 9)?.spoken).toBe('frəm');
    expect(weakOn(r, 11)?.spoken).toBe('tə');
  });
  it('"the" before a vowel is "thee"', () => {
    expect(weakOn(decode('the end'), 0)?.spoken).toBe('thee');
  });
  it('phrase-final function words are strong', () => {
    const r = decode('Where are you from?');
    expect(weakOn(r, 3)).toBeUndefined();
    const r2 = decode('Yes, I can.');
    expect(r2.annotations.some((a) => a.type === 'weak-form')).toBe(false);
    expect(weakOn(decode('Who are you looking at?'), 4)).toBeUndefined();
  });
  it("can't is never weak", () => {
    const r = decode("I can't swim.");
    expect(r.annotations.some((a) => a.type === 'weak-form' && a.from === 1)).toBe(false);
    expect(ann(r, 'contraction', 1)?.spoken).toBe('kæn(t)');
  });
  it('can as a noun is not weak', () => {
    expect(weakOn(decode('Open the can now.'), 2)).toBeUndefined();
  });
});

describe('contractions', () => {
  it('teaches useful contractions', () => {
    expect(ann(decode("I'll call you."), 'contraction', 0)?.spoken).toBe('al');
    expect(ann(decode("They're here."), 'contraction', 0)?.spoken).toBe('thər');
    expect(ann(decode("He'd like it."), 'contraction', 0)?.rule).toMatch(/would/);
    expect(ann(decode("I won't go."), 'contraction', 1)?.rule).toMatch(/want/);
  });
  it('handles curly apostrophes', () => {
    const r = decode('They’re late.');
    expect(r.tokens[0].word).toBe("they're");
    expect(has(r, 'contraction', 0)).toBe(true);
  });
});

describe('robustness', () => {
  const inputs = [
    '',
    '   ',
    '!!! ... ???',
    'I have 2 cats and 3 dogs.',
    'I WANT TO GO HOME NOW',
    'Hello 😀 world 🎉!',
    "'cause I said so",
    'Mr. Smith-Jones isn’t here – sorry!',
    'a',
    'the the the the',
    'ünïcödé café naïve',
    "rock'n'roll",
    'a lot of',
    'out of',
    'give me',
    'Because I said so.',
    'I I I I',
    'of of of them them',
    'and and and',
    ' - ',
    "it's-it's",
    'line one\nline two\ttab',
    'x'.repeat(500),
    "''''",
    'I am going to',
    'going to going to going to eat',
  ];
  for (const s of inputs) {
    it(`never throws: ${JSON.stringify(s)}`, () => {
      const r = decode(s);
      expect(r.input).toBe(s);
      checkInvariants(r);
    });
  }
  it('empty input → empty result', () => {
    const r = decode('');
    expect(r.tokens).toEqual([]);
    expect(r.segments).toEqual([]);
    expect(r.spokenText).toBe('');
  });
  it('only punctuation → no tokens', () => {
    expect(decode('?!.,').tokens).toHaveLength(0);
  });
  it('numbers stay as written', () => {
    const r = decode('I have 2 cats.');
    expect(r.tokens[2].word).toBe('');
    expect(r.spokenText).toContain('2');
  });
  it('ALL CAPS behaves like lowercase', () => {
    const r = decode('I WANT TO GO');
    expect(ann(r, 'reduction', 1)?.spoken).toBe('wanna');
  });
  it('non-string input does not throw', () => {
    const r = decode(undefined as unknown as string);
    expect(r.tokens).toEqual([]);
  });
  it('very long input is fast and valid', () => {
    const s = Array.from({ length: 300 }, () => 'Turn it off and pick it up, because I want to get it.').join(' ');
    const t0 = Date.now();
    const r = decode(s);
    const dt = Date.now() - t0;
    checkInvariants(r);
    expect(r.tokens.length).toBe(300 * 13);
    expect(dt).toBeLessThan(2000);
  });
  it('typical sentence decodes in well under 5ms on average', () => {
    const s = 'What are you going to do with all of that water after the party?';
    decode(s);
    const t0 = Date.now();
    for (let i = 0; i < 200; i++) decode(s);
    expect((Date.now() - t0) / 200).toBeLessThan(5);
  });
});

describe('review regressions', () => {
  it('links INTO a reduction: has a lot of → ha-zə lotta (one segment)', () => {
    const r = decode('She has a lot of friends.');
    const a = ann(r, 'linking', 1);
    expect(a?.spoken).toBe('ha-zə lotta');
    expect(a?.to).toBe(4);
    expect(a?.original).toBe('has a lot of');
    expect(r.segments.map((s) => s.spoken)).toEqual(['she', 'ha-zə lotta', 'friends']);
    checkInvariants(r);
  });
  it('flaps into a reduction: get out of here → ge-doutta here', () => {
    const r = decode('Get out of here!');
    expect(ann(r, 'flap-t', 0)?.spoken).toBe('ge-doutta');
    expect(has(r, 'reduction', 1, 2)).toBe(true);
    expect(r.segments.map((s) => s.spoken)).toEqual(['ge-doutta', 'here']);
    expect(decode("We're out of milk.").spokenText).toContain('wi-routta');
    expect(decode('I got a lot of work to do.').spokenText).toContain('ga-də lotta');
  });
  it('links OUT of a reduction: gimme a → gimme-yə, because I → cu-zai', () => {
    expect(decode('Give me a minute.').segments[0].spoken).toBe('gimme-yə');
    expect(decode('I left because I was tired.').spokenText).toContain('cu-zai');
  });
  it('elision before a reduction: just let me → jus lemme, didn\'t want to → didn wanna', () => {
    expect(decode('Just let me know.').spokenText).toBe('jus lemme know');
    expect(decode("He didn't want to go.").spokenText).toBe('he didn wanna go');
  });
  it('"of"-reductions are blocked before a vowel: out of it → au-də-vit', () => {
    const r = decode("I'm a little out of it today.");
    expect(r.annotations.some((a) => a.spoken.includes('outta'))).toBe(false);
    expect(r.spokenText).toContain('au-də-vit');
    expect(decode('A lot of us agree.').annotations.some((a) => a.spoken.includes('lotta'))).toBe(false);
    expect(ann(decode('Kind of.'), 'reduction', 0)?.spoken).toBe('kinda');
  });
  it('"them" keeps /ð/ after a vowel-final weak form: most of them → mos-tə thəm', () => {
    expect(weakOn(decode('Most of them are old.'), 2)?.spoken).toBe('thəm');
    expect(weakOn(decode('I told them about it.'), 2)?.spoken).toBe('əm');
  });
  it('"of" before an h-dropped word keeps /v/: all of his → ə-viz', () => {
    const r = decode('He finished all of his homework.');
    expect(weakOn(r, 3)?.spoken).toBe('əv');
    expect(ann(r, 'h-dropping', 3)?.spoken).toBe('ə-viz');
  });
  it('yod coalescence keeps the weak form on the left word', () => {
    const r = decode('Look at you now.');
    expect(weakOn(r, 1)?.spoken).toBe('ət');
    expect(ann(r, 'assimilation', 1)?.spoken).toBe('ə-chu');
  });
  it('weak "and" links with /n/, and the rule says so', () => {
    const a = ann(decode('You and I are friends.'), 'linking', 1);
    expect(a?.spoken).toBe('ə-nai');
    expect(a?.rule).toContain('/n/');
    expect(a?.rule).not.toContain('/d/');
  });
  it('better respellings: about, bread, head, -ore words', () => {
    expect(decode('Tell him about it.').spokenText).toBe('tel-li-mə-bau-dit'); // was 'tel-li-məbau-dit'
    expect(decode('Bread and butter.').spokenText).toBe('bre-dən budder');
    expect(decode('My throat is sore all week.').spokenText).toContain('so-rall');
  });
  it('elliptical auxiliaries and written-out "will not" stay strong', () => {
    expect(weakOn(decode('Can you?'), 0)).toBeUndefined();
    expect(weakOn(decode('Are they?'), 0)).toBeUndefined();
    expect(weakOn(decode('Can you help?'), 0)?.spoken).toBe('kən');
    expect(weakOn(decode('I can, but I will not.'), 4)).toBeUndefined();
  });
  it('care is respelled with k', () => {
    expect(decode('Take care of yourself.').spokenText).toContain('ke-rə');
  });
  it('no flap after silent e before -ty', () => {
    expect(flapWord('safety')).toBeNull();
    expect(flapWord('ninety')).toBeNull();
    expect(flapWord('pretty')).toBe('priddy');
  });
  it('rule texts are clean Vietnamese (no doubled quotes, -ed hint on elision)', () => {
    const w = weakOn(decode('It will rain.'), 1);
    expect(w?.rule).not.toContain("''");
    expect(weakOn(decode('Just a moment.'), 0)?.rule).not.toContain('từ chức năng');
    expect(ann(decode('I walked to school.'), 'elision', 1)?.rule).toContain('-ed');
  });
});

describe('segment partition invariants on real sentences', () => {
  const sentences = [
    'Turn it off, please.',
    'Pick it up for me.',
    "Check it out, it's great.",
    'Did you eat yet?',
    'Tell him I said hi.',
    'Ask her about it.',
    "I can't do it today.",
    'The computer is getting better at eating letters at the party.',
    'My friend and I went out last night.',
    'What are you going to do about it?',
    "I don't know what you want to do.",
    'He has to get up at eight every day.',
  ];
  for (const s of sentences) {
    it(s, () => {
      const r = decode(s);
      checkInvariants(r);
      expect(r.tokens.length).toBeGreaterThan(0);
      // every glued segment is backed by an annotation
      for (const seg of r.segments) if (seg.to > seg.from) expect(seg.annotationIds.length).toBeGreaterThan(0);
    });
  }
});

describe('whole dataset + review sentences decode cleanly', () => {
  const review = [
    'What do you want to do tonight?', "I'm going to the store.", "I'm going to call her later.",
    'Did you tell him about it?', 'Can you pick it up for me?', "I can't hear you.", 'Where are you from?',
    'Turn it off and put it on the table.', "Not at all, it's a lot of fun.", 'Let me give you a hand.',
    "I don't know what you mean.", 'We had a little bit of water.', 'Next day we went to the city.',
    'Ask her if she wants to come.', 'Would you like a cup of tea?', 'I should have asked him.',
    'Get out of here!', 'Is it an hour or a year?', 'This year I miss you more.', 'Hold on, wait a minute.',
  ];
  it('review sentences: invariants hold and every glued segment is explained', () => {
    for (const s of [...review, ...SENTENCES.map((x) => x.text)]) {
      const r = decode(s);
      checkInvariants(r);
      for (const seg of r.segments) if (seg.to > seg.from) expect(seg.annotationIds.length, s).toBeGreaterThan(0);
      // no annotation ever spans a phrase break (comma, period…)
      const { brk } = tokenize(s);
      for (const a of r.annotations) for (let k = a.from; k < a.to; k++) expect(brk[k], `${s} :: ${a.original}`).toBe(false);
    }
  });
  it('key review outputs', () => {
    expect(decode("I'm going to the store.").annotations.some((a) => a.type === 'reduction')).toBe(false);
    expect(ann(decode("I'm going to call her later."), 'reduction', 1)?.spoken).toBe('gonna');
    expect(weakOn(decode('Where are you from?'), 3)).toBeUndefined();
    expect(decode('Turn it off and put it on the table.').spokenText).toBe('tur-ni-dof-fən pu-di-don thə table');
    expect(decode('I should have asked him.').spokenText).toBe('I shu-də-vask-tim');
    expect(decode('This year I miss you more.').spokenText).toBe('thi-shee-rai mi-shu more');
    expect(decode('Hold on, wait a minute.').spokenText).toBe('hohl-don wei-də minute');
  });
});
