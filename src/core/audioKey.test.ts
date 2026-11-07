import { describe, expect, it } from 'vitest';
import { AUDIO_STYLE_VERSION, AUDIO_VOICE, audioFileName, audioKey, fnv1a64 } from './audioKey';

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

  it('file name', () => {
    expect(audioFileName('abc123')).toBe('abc123.mp3');
  });
});
