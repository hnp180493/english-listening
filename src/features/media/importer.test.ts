import { describe, expect, it } from 'vitest';
import { decodeTextBytes, previewTranscript } from './importer';
import { MAX_TRANSCRIPT_BYTES } from './library';

describe('previewTranscript', () => {
  it('is empty (no error) for blank input', () => {
    const p = previewTranscript('   ');
    expect(p.ok).toBe(false);
    expect(p.error).toBeUndefined();
  });

  it('parses a YouTube copy into units', () => {
    const p = previewTranscript('0:00\nHi there.\n0:02\nHow are you doing today?\n0:05\nI am fine.');
    expect(p.ok).toBe(true);
    expect(p.format).toBe('youtube');
    expect(p.cueCount).toBe(3);
    expect(p.units).toHaveLength(3);
    expect(p.duration).toBe(10);
    expect(p.warning).toBeUndefined();
  });

  it('refuses transcripts over the size limit', () => {
    const p = previewTranscript('0:00 ' + 'a'.repeat(MAX_TRANSCRIPT_BYTES));
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/quá lớn/);
  });

  it('explains when no time stamps are found', () => {
    const p = previewTranscript('Just a paragraph of text.');
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/mốc thời gian/);
  });

  it('explains music-only transcripts', () => {
    const p = previewTranscript('0:00\n[Music]\n0:05\n[Applause]');
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/không có lời nói/);
  });

  it('warns about unpunctuated (auto-generated) captions', () => {
    const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const lines = Array.from({ length: 30 }, (_, i) => `${clock(i * 4)}\nso this is part ${i} of it`).join('\n');
    const p = previewTranscript(lines);
    expect(p.ok).toBe(true);
    expect(p.warning).toMatch(/dấu câu/);
  });
});

describe('decodeTextBytes', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it('reads UTF-8 with or without BOM', () => {
    expect(decodeTextBytes(enc('café'))).toBe('café');
    expect(decodeTextBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...enc('hi')]))).toBe('hi');
  });
  it('falls back to Windows-1252 for old SRT files', () => {
    expect(decodeTextBytes(new Uint8Array([0x63, 0x61, 0x66, 0xe9]))).toBe('café');
  });
  it('reads UTF-16 LE with BOM', () => {
    expect(decodeTextBytes(new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]))).toBe('hi');
  });
  it('returns "" for empty input', () => {
    expect(decodeTextBytes(new Uint8Array())).toBe('');
  });
});
