import { describe, expect, it } from 'vitest';
import { decode } from '../core/decoder';
import { SENTENCES } from './sentences';

describe('SENTENCES data', () => {
  it('supplementary focus tags (s121–s300) match what decode() marks', () => {
    // The header promises these tags were checked against decode(); a tag the decoder
    // never marks would put a sentence under a dictation filter with no colored span.
    for (const s of SENTENCES) {
      const n = Number(s.id.slice(1));
      if (n < 121) continue;
      const marked = new Set(decode(s.text).annotations.map((a) => a.type));
      for (const f of s.focus) expect(marked.has(f), `${s.id} ${f}`).toBe(true);
    }
  });
});
