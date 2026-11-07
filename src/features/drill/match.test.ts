import { describe, expect, it } from 'vitest';
import { citationText, isGuessCorrect, splitHighlight } from './match';

describe('isGuessCorrect', () => {
  const wantTo = { written: 'want to', spoken: 'wanna' };

  it('accepts the written form, ignoring case and punctuation', () => {
    expect(isGuessCorrect('Want to!', wantTo)).toBe(true);
    expect(isGuessCorrect('  want   to ', wantTo)).toBe(true);
  });

  it('accepts the spoken form', () => {
    expect(isGuessCorrect('wanna', wantTo)).toBe(true);
    expect(isGuessCorrect('wan chu', { written: 'want you', spoken: 'wan-chu' })).toBe(true);
    expect(isGuessCorrect('wanchu', { written: 'want you', spoken: 'wan-chu' })).toBe(true);
  });

  it('accepts contraction equivalents', () => {
    expect(isGuessCorrect("I'm going to", { written: 'I am going to', spoken: 'I-m gonna' })).toBe(true);
    expect(isGuessCorrect('dont know', { written: "don't know", spoken: 'dunno' })).toBe(true);
    expect(isGuessCorrect('do not know', { written: "don't know", spoken: 'dunno' })).toBe(true);
    expect(isGuessCorrect('what’s up', { written: 'what is up', spoken: 'wha-sup' })).toBe(true);
    expect(isGuessCorrect('gonna', { written: 'going to', spoken: 'gə-nə' })).toBe(true);
  });

  it('tolerates one typo in longer phrases only', () => {
    expect(isGuessCorrect('turn it of', { written: 'turn it off', spoken: 'tur-ni-toff' })).toBe(true);
    expect(isGuessCorrect('want a', wantTo)).toBe(false);
  });

  it('rejects empty and wrong answers', () => {
    expect(isGuessCorrect('', wantTo)).toBe(false);
    expect(isGuessCorrect('   ', wantTo)).toBe(false);
    expect(isGuessCorrect('wonder', wantTo)).toBe(false);
  });
});

describe('splitHighlight', () => {
  it('finds the chunk case-insensitively', () => {
    expect(splitHighlight('I Want To go home.', ['want to'])).toEqual({
      before: 'I ',
      match: 'Want To',
      after: ' go home.',
    });
  });

  it('prefers whole-word matches and falls back to later candidates', () => {
    const p = splitHighlight('Get it? I got it.', ['got it']);
    expect(p?.match).toBe('got it');
    expect(splitHighlight('I wanna go.', ['want to', 'wanna'])?.match).toBe('wanna');
    expect(splitHighlight('Nothing here', ['want to'])).toBeNull();
  });
});

describe('citationText', () => {
  it('separates words with commas', () => {
    expect(citationText('want to')).toBe('want, to');
  });
});

describe('isGuessCorrect: typo tolerance never changes the meaning', () => {
  it('rejects a different real word that is one letter away', () => {
    expect(isGuessCorrect('would you', { written: 'could you', spoken: 'kud-jə' })).toBe(false);
    expect(isGuessCorrect('could have', { written: 'would have', spoken: 'wu-də' })).toBe(false);
    expect(isGuessCorrect('I could have', { written: 'I would have', spoken: 'ai-wu-də' })).toBe(false);
  });

  it('rejects adding or dropping a whole word', () => {
    expect(isGuessCorrect('I would have', { written: 'would have', spoken: 'wu-də' })).toBe(false);
    expect(isGuessCorrect('would have', { written: 'I would have', spoken: 'ai-wu-də' })).toBe(false);
  });

  it('rejects a negation flip', () => {
    expect(isGuessCorrect('can you', { written: "can't you", spoken: 'kan-chu' })).toBe(false);
    expect(isGuessCorrect('I can go', { written: "I can't go", spoken: 'ai-kan-go' })).toBe(false);
  });

  it('still accepts a small typo inside a longer word', () => {
    expect(isGuessCorrect('a lot of peple', { written: 'a lot of people', spoken: 'ə-lo-də people' })).toBe(true);
    expect(isGuessCorrect('turnitof', { written: 'turn it off', spoken: 'tur-ni-toff' })).toBe(true);
  });
});

describe('splitHighlight: robustness', () => {
  it('matches across different spacing and keeps the original text', () => {
    expect(splitHighlight('I  WANT   to go.', ['want to'])?.match).toBe('WANT   to');
  });

  it('matches curly apostrophes in the example', () => {
    expect(splitHighlight('I don’t know.', ["don't know"])?.match).toBe('don’t know');
  });

  it('never highlights a match that starts in the middle of a word', () => {
    expect(splitHighlight('They behave to impress.', ['have to'])).toBeNull();
    expect(splitHighlight('Is that it?', ['at'])).toBeNull();
  });

  it('handles empty input', () => {
    expect(splitHighlight('', ['want to'])).toBeNull();
    expect(splitHighlight('I want to go.', ['', '  '])).toBeNull();
  });
});
