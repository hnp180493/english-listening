import { describe, expect, it } from 'vitest';
import { canonicalize, editDistance, expandWord, isTypo, normalizeText, normalizeToken, numberToWords, wordsEqual } from './normalize';

const canon = (s: string) => canonicalize(s.split(/\s+/).filter(Boolean)).words;

describe('normalizeToken / normalizeText', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeText('Hello, World!')).toBe('hello world');
  });
  it('keeps apostrophes inside words but strips quotes around them', () => {
    expect(normalizeText("'Don't,' she said.")).toBe("don't she said");
  });
  it('normalises curly apostrophes', () => {
    expect(normalizeToken('I’m')).toEqual(["i'm"]);
  });
  it('collapses whitespace', () => {
    expect(normalizeText('  a   lot\tof   time ')).toBe('a lot of time');
  });
  it('splits hyphenated words and dashes', () => {
    expect(normalizeText('well-known — really')).toBe('well known really');
  });
  it('handles times, thousands and decimals', () => {
    expect(normalizeToken('7:30')).toEqual(['7', '30']);
    expect(normalizeToken('1,000')).toEqual(['1000']);
    expect(normalizeToken('2.5')).toEqual(['2', 'point', '5']);
  });
  it("keeps meaningful leading apostrophes and g-dropping", () => {
    expect(normalizeToken("'cause")).toEqual(['because']);
    expect(normalizeToken("goin'")).toEqual(['going']);
  });
  it('returns nothing for punctuation-only tokens', () => {
    expect(normalizeToken('—')).toEqual([]);
    expect(normalizeToken('...')).toEqual([]);
  });
});

describe('numbers', () => {
  it('spells 0–20', () => {
    expect(numberToWords('0')).toEqual(['zero']);
    expect(numberToWords('7')).toEqual(['seven']);
    expect(numberToWords('13')).toEqual(['thirteen']);
    expect(numberToWords('20')).toEqual(['twenty']);
  });
  it('spells compound numbers', () => {
    expect(numberToWords('25')).toEqual(['twenty', 'five']);
    expect(numberToWords('100')).toEqual(['one', 'hundred']);
    expect(numberToWords('2024')).toEqual(['two', 'thousand', 'twenty', 'four']);
  });
  it('digits equal number words', () => {
    expect(canon('I have 2 kids')).toEqual(canon('I have two kids'));
    expect(canon('twenty-five dollars')).toEqual(canon('25 dollars'));
  });
  it('ordinals', () => {
    expect(expandWord('1st')).toEqual(['first']);
    expect(expandWord('22nd')).toEqual(['twenty', 'second']);
    expect(expandWord('30th')).toEqual(['thirtieth']);
  });
});

describe('contractions and reductions', () => {
  it("I'm = I am", () => expect(canon("I'm late")).toEqual(canon('I am late')));
  it("don't = do not", () => expect(canon("don't")).toEqual(['do', 'not']));
  it("can't = cannot = can not", () => {
    expect(canon("can't")).toEqual(['can', 'not']);
    expect(canon('cannot')).toEqual(['can', 'not']);
    expect(canon('can not')).toEqual(['can', 'not']);
  });
  it("won't = will not", () => expect(canon("won't")).toEqual(['will', 'not']));
  it("I'll / you're / they're / we've", () => {
    expect(canon("I'll")).toEqual(['i', 'will']);
    expect(canon("you're")).toEqual(['you', 'are']);
    expect(canon("they're")).toEqual(['they', 'are']);
    expect(canon("we've")).toEqual(['we', 'have']);
  });
  it("I'd matches both I would and I had", () => {
    const [, d] = canon("I'd");
    expect(wordsEqual(d, 'would')).toBe(true);
    expect(wordsEqual(d, 'had')).toBe(true);
    expect(wordsEqual(d, 'will')).toBe(false);
  });
  it("it's = it is / it has, but possessive 's is kept", () => {
    expect(canon("it's")[1]).toBe('is|has');
    expect(canon("John's car")).toEqual(["john's", 'car']);
  });
  it("let's = let us", () => expect(canon("let's go")).toEqual(['let', 'us', 'go']));
  it('gonna / wanna / gotta / kinda / dunno', () => {
    expect(canon('gonna')).toEqual(['going', 'to']);
    expect(canon('wanna')).toEqual(['want', 'to']);
    expect(canon('gotta')).toEqual(['got', 'to']);
    expect(canon('kinda')).toEqual(['kind', 'of']);
    expect(canon('dunno')).toEqual(['do', 'not', 'know']);
    expect(canon("I don't know")).toEqual(canon('I dunno'));
  });
  it('ok = okay, alright = all right', () => {
    expect(canon('OK')).toEqual(canon('okay'));
    expect(canon('alright')).toEqual(canon('all right'));
  });
  it('accepts contractions typed without apostrophe', () => {
    expect(canon('dont')).toEqual(canon("don't"));
    expect(canon('im')).toEqual(canon("I'm"));
  });
  it('keeps origin indices for expanded tokens', () => {
    const c = canonicalize(["I'm", 'gonna', 'go.']);
    expect(c.words).toEqual(['i', 'am', 'going', 'to', 'go']);
    expect(c.origin).toEqual([0, 0, 1, 1, 2]);
  });
});

describe('typos', () => {
  it('edit distance counts transpositions as 1', () => {
    expect(editDistance('recieve', 'receive')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });
  it('accepts near misses on long words', () => {
    expect(isTypo('receive', 'recieve')).toBe(true);
    expect(isTypo('tomorrow', 'tomorow')).toBe(true);
  });
  it('rejects short words and inflection differences', () => {
    expect(isTypo('cat', 'cap')).toBe(false);
    expect(isTypo('liked', 'like')).toBe(false);
    expect(isTypo('works', 'work')).toBe(false);
  });
});
