// Dictation playback: the exercise audio is the CONNECTED version; "Chậm" stays connected; "Rõ từng từ" (careful,
// standard text) only exists as its own mode, offered after checking.

import { describe, expect, it } from 'vitest';
import { CAREFUL_RATE, CONNECTED_SLOW_RATE } from '../../core/playback';
import { chunksOf, dictationAudio, mergeShortChunks, safeDecode, targetTokens } from './decodeCache';
import { playbackFor } from './usePlayer';

const AUDIO = { connected: 'Whaddaya wanna do?', careful: 'What do you want to do?', level: 2 };

describe('playbackFor: text / rate / style per button', () => {
  it('"Nghe" = connected at the learner rate', () => {
    expect(playbackFor('normal', AUDIO, 1.1)).toEqual({ text: 'Whaddaya wanna do?', rate: 1.1, mode: 'connected' });
  });
  it('level 1 plays the connected version a little slower', () => {
    expect(playbackFor('normal', { ...AUDIO, level: 1 }, 1)).toEqual({ text: 'Whaddaya wanna do?', rate: 0.9, mode: 'connected' });
  });
  it('"Chậm" = still the connected version, only slower', () => {
    expect(playbackFor('slow', AUDIO, 1)).toEqual({ text: 'Whaddaya wanna do?', rate: CONNECTED_SLOW_RATE, mode: 'connected', slow: true });
  });
  it('"Rõ từng từ" = the standard written text, slower, careful style', () => {
    expect(playbackFor('careful', AUDIO, 1)).toEqual({ text: 'What do you want to do?', rate: CAREFUL_RATE, mode: 'careful' });
  });
});

describe('dictationAudio / chunksOf', () => {
  it('connected = say ?? speakText ?? text; careful = the text', () => {
    const s = { text: 'Did you eat yet?', level: 1 as const };
    const a = dictationAudio(s);
    expect(a.careful).toBe('Did you eat yet?');
    expect(a.level).toBe(1);
    const gen = (safeDecode(s.text) as { speakText?: string }).speakText?.trim();
    expect(a.connected).toBe(gen || s.text);
    expect(dictationAudio({ ...s, say: 'Didja eat yet?' } as typeof s).connected).toBe('Didja eat yet?');
  });

  it('chunks are the segments in order, as their speakable forms when the decoder gives them', () => {
    const d = safeDecode("I'm going to get a cup of coffee.");
    const chunks = chunksOf(d, targetTokens(d, d.input));
    expect(chunks.length).toBeGreaterThan(0);
    const expected = d.segments
      .filter((s) => /[\p{L}\p{N}]/u.test(s.written))
      .map((s) => ((s as { speak?: string }).speak?.trim() ? (s as { speak?: string }).speak!.trim() : s.written));
    expect(chunks.join(' ')).toBe(expected.join(' ')); // same words, same order (short chunks joined)
    expect(chunks.every((c) => c.split(' ').length > 1 || c.replace(/[^a-z]/gi, '').length > 4)).toBe(true);
  });

  it('joins one-short-word chunks to a neighbour, so an engine never reads a lone "A" as a letter', () => {
    expect(mergeShortChunks(['A', 'cuppa', 'tea, please.'])).toEqual(['A cuppa', 'tea, please.']);
    expect(mergeShortChunks(["I'm", 'just', 'looking,', 'thanks.'])).toEqual(["I'm just", 'looking,', 'thanks.']);
    expect(mergeShortChunks(['Turnid off', 'it.'])).toEqual(['Turnid off it.']);
    expect(mergeShortChunks(['Hello.'])).toEqual(['Hello.']);
    expect(mergeShortChunks(['Go'])).toEqual(['Go']);
    expect(mergeShortChunks([])).toEqual([]);
  });
});
