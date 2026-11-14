import { describe, expect, it } from 'vitest';
import {
  AUDIO_STYLE_VERSION,
  AUDIO_VOICE,
  audioFileName,
  audioKey,
  clipVoiceId,
  DEFAULT_CLIP_VOICE,
  fnv1a64,
  isDefaultClipVoice,
  styleWithAccent,
  type AudioClipMode,
  type ClipVoice,
} from './audioKey';

describe('audioKey', () => {
  it('is stable: same mode and text → same key, across calls', () => {
    const t = "Whaddaya wanna do tonight?";
    expect(audioKey('connected', t)).toBe(audioKey('connected', t));
    expect(audioKey('connected', t)).toMatch(/^[0-9a-z]{1,13}$/);
  });

  it('pins known values (a change here means every shipped clip must be regenerated)', () => {
    expect(AUDIO_VOICE).toBe('gemini-kore');
    expect(AUDIO_STYLE_VERSION).toBe(3);
    // FNV-1a 64 reference vectors
    expect(fnv1a64('')).toBe(BigInt('0xcbf29ce484222325').toString(36));
    expect(fnv1a64('a')).toBe(BigInt('0xaf63dc4c8601ec8c').toString(36));
    expect(audioKey('connected', 'Hi.')).toBe(fnv1a64('gemini-kore|3|connected|Hi.'));
  });

  it('different mode → different key', () => {
    expect(audioKey('connected', 'Turn it off.')).not.toBe(audioKey('careful', 'Turn it off.'));
  });

  it('only trims: case, punctuation and respelling make a different clip', () => {
    expect(audioKey('careful', '  Turn it off. \n')).toBe(audioKey('careful', 'Turn it off.'));
    expect(audioKey('careful', 'turn it off.')).not.toBe(audioKey('careful', 'Turn it off.'));
    expect(audioKey('careful', 'Turn it off')).not.toBe(audioKey('careful', 'Turn it off.'));
    expect(audioKey('connected', 'Turnid off.')).not.toBe(audioKey('connected', 'Turn it off.'));
  });

  it('hashes UTF-8 (non-ASCII text gets its own stable key)', () => {
    expect(audioKey('connected', 'café')).not.toBe(audioKey('connected', 'cafe'));
    expect(audioKey('connected', 'café')).toBe(audioKey('connected', 'café'));
  });

  it('real shipped keys (public/audio/manifest.json) stay the same with no voice and with the default voice', () => {
    const shipped: [AudioClipMode, string, string][] = [
      ['connected', 'Turnid off, please.', '3hqf6onbbfint'],
      ['careful', 'Turn it off, please.', '1vihkjvhe5x4i'],
      ['plain', 'hat', 'zlbpmowzfw2u'],
    ];
    for (const [mode, text, key] of shipped) {
      expect(audioKey(mode, text)).toBe(key);
      expect(audioKey(mode, text, null)).toBe(key);
      expect(audioKey(mode, text, { voice: 'Kore' })).toBe(key);
      expect(audioKey(mode, text, { voice: 'kore', accent: '  ' })).toBe(key);
      expect(audioKey(mode, text, { voice: DEFAULT_CLIP_VOICE, gender: 'female' } as ClipVoice)).toBe(key);
    }
    expect(`gemini-${DEFAULT_CLIP_VOICE.toLowerCase()}`).toBe(AUDIO_VOICE);
  });

  it('a voice of its own (name, accent) changes the key; the hashed string carries both', () => {
    const t = 'Hi there! What can I get you?';
    const kore = audioKey('connected', t);
    const puck = audioKey('connected', t, { voice: 'Puck' });
    const grace = audioKey('connected', t, { voice: 'Gacrux', accent: 'light British accent' });
    const graceUs = audioKey('connected', t, { voice: 'Gacrux' });
    const koreGb = audioKey('connected', t, { voice: 'Kore', accent: 'light British accent' });
    expect(new Set([kore, puck, grace, graceUs, koreGb]).size).toBe(5);
    expect(puck).toBe(fnv1a64(`gemini-puck|3|connected|${t}`));
    expect(grace).toBe(fnv1a64(`gemini-gacrux~light British accent|3|connected|${t}`));
    expect(clipVoiceId({ voice: 'Orus', accent: ' light  Australian | accent ' })).toBe('gemini-orus~light Australian / accent');
    // the voice name's case does not matter (Gemini names are capitalised), the accent's spacing neither
    expect(audioKey('careful', t, { voice: 'puck' })).toBe(audioKey('careful', t, { voice: 'Puck' }));
    expect(audioKey('careful', t, { voice: 'Gacrux', accent: 'light  British accent ' })).toBe(audioKey('careful', t, { voice: 'Gacrux', accent: 'light British accent' }));
    expect(isDefaultClipVoice(undefined)).toBe(true);
    expect(isDefaultClipVoice({ voice: 'Puck' })).toBe(false);
  });

  it('styleWithAccent: the accent replaces "American" and is appended; no accent = the style unchanged', () => {
    expect(styleWithAccent('relaxed, casual American English', undefined, 'DEF')).toBe('relaxed, casual American English');
    expect(styleWithAccent(undefined, '', 'DEF')).toBeUndefined();
    expect(styleWithAccent('relaxed, casual American English', 'light British accent', 'DEF')).toBe('relaxed, casual English, spoken with a light British accent');
    expect(styleWithAccent(undefined, 'light Australian accent', 'natural American English')).toBe('natural English, spoken with a light Australian accent');
  });

  it('file name', () => {
    expect(audioFileName('abc123')).toBe('abc123.mp3');
  });
});
