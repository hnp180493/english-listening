import { describe, expect, it } from 'vitest';
import { audioBlobFromBase64, base64ToBytes, isWav, parsePcmMime, pcmToWav } from './wav';

function ascii(b: Uint8Array, off: number, len: number): string {
  return String.fromCharCode(...b.subarray(off, off + len));
}

describe('pcmToWav', () => {
  it('writes a byte-exact 44-byte canonical header for 24 kHz mono 16-bit', () => {
    const pcm = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const wav = pcmToWav(pcm, { sampleRate: 24000, channels: 1, bitsPerSample: 16 });
    const v = new DataView(wav.buffer);
    expect(wav.length).toBe(50);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(v.getUint32(4, true)).toBe(36 + 6);
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 12, 4)).toBe('fmt ');
    expect(v.getUint32(16, true)).toBe(16);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(24000);
    expect(v.getUint32(28, true)).toBe(48000); // byte rate
    expect(v.getUint16(32, true)).toBe(2); // block align
    expect(v.getUint16(34, true)).toBe(16);
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(v.getUint32(40, true)).toBe(6);
    expect([...wav.subarray(44)]).toEqual([1, 2, 3, 4, 5, 6]);
    // exact header bytes
    expect([...wav.subarray(0, 44)]).toEqual([
      0x52, 0x49, 0x46, 0x46, 0x2a, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20, 16, 0, 0, 0, 1, 0, 1, 0,
      0xc0, 0x5d, 0, 0, 0x80, 0xbb, 0, 0, 2, 0, 16, 0, 0x64, 0x61, 0x74, 0x61, 6, 0, 0, 0,
    ]);
  });

  it('handles stereo and drops a trailing partial frame', () => {
    const wav = pcmToWav(new Uint8Array(7), { sampleRate: 16000, channels: 2, bitsPerSample: 16 });
    const v = new DataView(wav.buffer);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(28, true)).toBe(64000);
    expect(v.getUint16(32, true)).toBe(4);
    expect(v.getUint32(40, true)).toBe(4);
    expect(wav.length).toBe(48);
  });
});

describe('mime + sniffing', () => {
  it('parses Gemini PCM mime types', () => {
    expect(parsePcmMime('audio/L16;codec=pcm;rate=24000')).toEqual({ sampleRate: 24000, channels: 1, bitsPerSample: 16 });
    expect(parsePcmMime('audio/l16; rate=16000; channels=2')).toEqual({ sampleRate: 16000, channels: 2, bitsPerSample: 16 });
    expect(parsePcmMime(undefined).sampleRate).toBe(24000);
  });

  it('detects WAV', () => {
    expect(isWav(pcmToWav(new Uint8Array(2)))).toBe(true);
    expect(isWav(new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('wraps base64 PCM into audio/wav and passes WAV through untouched', async () => {
    const pcmB64 = btoa(String.fromCharCode(10, 20, 30, 40));
    const a = audioBlobFromBase64(pcmB64, 'audio/L16;codec=pcm;rate=24000');
    expect(a.mime).toBe('audio/wav');
    const bytes = new Uint8Array(await a.audio.arrayBuffer());
    expect(bytes.length).toBe(48);
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(24000);

    const wav = pcmToWav(new Uint8Array([1, 2]), { sampleRate: 22050, channels: 1, bitsPerSample: 16 });
    const b = audioBlobFromBase64(btoa(String.fromCharCode(...wav)), 'audio/wav');
    expect(b.mime).toBe('audio/wav');
    expect([...new Uint8Array(await b.audio.arrayBuffer())]).toEqual([...wav]);
  });

  it('decodes base64 with whitespace', () => {
    expect([...base64ToBytes('AQID\nBA==')]).toEqual([1, 2, 3, 4]);
  });
});
