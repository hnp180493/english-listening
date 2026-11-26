import { describe, expect, it } from 'vitest';
import { tapeLine, tapeLines } from './tape';
import { allJobRefs } from '../../../data/city/jobs';
import { allDispatchRefs } from '../../../data/city/dispatch';

const T0 = 1_800_000_000_000;

describe('"Nghe lại băng": a card of the tape as a line to play', () => {
  it('every job line and every dispatch call resolves, in a voice of its own, never the paid voice', () => {
    for (const ref of [...allJobRefs(), ...allDispatchRefs()]) {
      const line = tapeLine({ ref, added: T0, due: T0 });
      expect(line, ref).not.toBeNull();
      expect(line!.text.trim().length, ref).toBeGreaterThan(0);
      expect(line!.vi.trim().length, ref).toBeGreaterThan(0);
      expect(line!.voice, ref).not.toBeNull();
      expect(line!.browserOnly).toBe(true);
    }
  });

  it('drops what it does not know, keeps the order it is given', () => {
    const [a, b] = allDispatchRefs();
    const lines = tapeLines([
      { ref: b, added: T0 + 2, due: T0 },
      { ref: 'job-gone-99', added: T0 + 1, due: T0 },
      { ref: a, added: T0, due: T0 },
    ]);
    expect(lines.map((l) => l.ref)).toEqual([b, a]);
  });
});
