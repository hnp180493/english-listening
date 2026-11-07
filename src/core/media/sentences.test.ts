import { describe, expect, it } from 'vitest';
import { sentenceBreaks, toSentences } from './sentences';
import { parseTranscript } from './transcript';

describe('sentenceBreaks', () => {
  it('finds sentence ends but skips abbreviations, initials and ellipses', () => {
    expect(sentenceBreaks('Hi. How are you? Great!')).toEqual([3, 16, 23]);
    expect(sentenceBreaks('Mr. Smith went to the U.S. last year')).toEqual([]);
    expect(sentenceBreaks('J. K. Rowling wrote it')).toEqual([]);
    expect(sentenceBreaks('so... yeah')).toEqual([]);
    expect(sentenceBreaks('It costs 3.5 dollars.')).toEqual([21]);
    expect(sentenceBreaks('I said no. Then I left.')).toEqual([10, 23]);
  });
});

describe('toSentences', () => {
  it('merges fragments until . ? !', () => {
    const units = toSentences([
      { start: 0, end: 2, text: 'so I was gonna' },
      { start: 2, end: 4, text: 'tell you about it.' },
      { start: 4, end: 6, text: 'Did you hear?' },
    ]);
    expect(units).toEqual([
      { start: 0, end: 4, text: 'so I was gonna tell you about it.' },
      { start: 4, end: 6, text: 'Did you hear?' },
    ]);
  });

  it('splits a cue that contains a sentence end, interpolating time', () => {
    const units = toSentences([{ start: 10, end: 20, text: 'Okay. Let me check that for you' }]);
    expect(units.map((u) => u.text)).toEqual(['Okay.', 'Let me check that for you']);
    expect(units[0].start).toBe(10);
    expect(units[0].end).toBeLessThan(13);
    expect(units[1].start).toBeGreaterThan(units[0].end - 0.001);
    expect(units[1].end).toBe(20);
  });

  it('breaks on a long gap', () => {
    const units = toSentences([
      { start: 0, end: 2, text: 'and then' },
      { start: 5, end: 7, text: 'we left' },
    ]);
    expect(units.map((u) => u.text)).toEqual(['and then', 'we left']);
  });

  it('does not break on a short gap', () => {
    const units = toSentences([
      { start: 0, end: 2, text: 'and then' },
      { start: 3, end: 5, text: 'we left.' },
    ]);
    expect(units).toEqual([{ start: 0, end: 5, text: 'and then we left.' }]);
  });

  it('keeps units under the word limit for unpunctuated auto captions', () => {
    const cues = Array.from({ length: 12 }, (_, i) => ({ start: i * 2, end: i * 2 + 2, text: 'one two three four five' }));
    const units = toSentences(cues);
    expect(units.length).toBeGreaterThan(1);
    for (const u of units) expect(u.text.split(' ').length).toBeLessThanOrEqual(25);
    expect(units[0].start).toBe(0);
    expect(units[units.length - 1].end).toBe(24);
  });

  it('splits a single over-long cue', () => {
    const words = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
    const units = toSentences([{ start: 0, end: 40, text: words }], { maxWords: 25 });
    expect(units).toHaveLength(2);
    expect(units[0].start).toBe(0);
    expect(units[1].end).toBe(40);
  });

  it('drops empty and music-only units', () => {
    expect(toSentences([{ start: 0, end: 1, text: '' }, { start: 1, end: 2, text: '...' }])).toEqual([]);
    expect(toSentences([])).toEqual([]);
  });

  it('works end to end with a YouTube copy', () => {
    const units = toSentences(
      parseTranscript(
        "0:00\n[Music]\n0:02\nhey what's up guys\n0:04\nwelcome back to the channel.\n0:07\ntoday I wanna show you something.",
      ),
    );
    expect(units).toEqual([
      { start: 2, end: 7, text: "hey what's up guys welcome back to the channel." },
      { start: 7, end: 12, text: 'today I wanna show you something.' },
    ]);
  });
});

describe('sentence ends after abbreviations', () => {
  it('U.S. / p.m. end a sentence before a capitalised word, not before a lower-case one', () => {
    expect(sentenceBreaks('I moved to the U.S. Then I left.')).toEqual([19, 32]);
    expect(sentenceBreaks('We met at 5 p.m. and talked.')).toEqual([28]);
    expect(sentenceBreaks('Mr. Smith is here. Dr. Lee too.')).toEqual([18, 31]);
    expect(sentenceBreaks('Wait… what? OK.')).toEqual([11, 15]);
  });
  it('an abbreviation at a cue end does not split the sentence', () => {
    const units = toSentences([
      { start: 0, end: 2, text: 'Hello Mr.' },
      { start: 2, end: 4, text: 'Smith. How are you?' },
    ]);
    expect(units.map((u) => u.text)).toEqual(['Hello Mr. Smith.', 'How are you?']);
    expect(units[0].start).toBe(0);
    expect(units[1].end).toBe(4);
  });
});
