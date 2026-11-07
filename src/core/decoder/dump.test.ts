// Review tool: decode every built-in sentence, chunk example and lesson example and print
// how it sounds, so a teacher can read the whole output at once.
//   DECODER_DUMP=1 npx vitest run src/core/decoder/dump.test.ts --reporter=verbose
// Without the variable it only checks that every text decodes.
import { describe, expect, it } from 'vitest';
import { decode } from './index';
import { SENTENCES } from '../../data/sentences';
import { CHUNKS } from '../../data/chunks';
import { LESSONS } from '../../data/lessons';

/** Every English string a lesson shows (examples, compare blocks, quiz sentences). */
function lessonTexts(o: unknown, out: string[]): string[] {
  if (Array.isArray(o)) for (const x of o) lessonTexts(x, out);
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if ((k === 'text' || k === 'clear' || k === 'written') && typeof v === 'string') out.push(v.replace(/[[\]]/g, ''));
      else if (k === 'options' && Array.isArray(v) && v.every((x) => typeof x === 'string')) out.push(...(v as string[]));
      else lessonTexts(v, out);
    }
  }
  return out;
}

const VIET = /[ăâđêôơưạảãầấậẩẫằắặẳẵẹẻẽềếệểễịỉĩọỏõồốộổỗờớợởỡụủũừứựửữ]/i;

function allTexts(): string[] {
  const all = [...SENTENCES.map((s) => s.text), ...CHUNKS.map((c) => c.example), ...lessonTexts(LESSONS, [])];
  return [...new Set(all)].filter((s) => /[a-z]/i.test(s) && !VIET.test(s));
}

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

describe('decoder review dump', () => {
  it('every built-in English text decodes to something', () => {
    for (const t of allTexts()) expect(decode(t).spokenText.length, t).toBeGreaterThan(0);
  });
  it.skipIf(!env.DECODER_DUMP)('prints written → spoken for review', () => {
    const lines = allTexts().map((t) => {
      const r = decode(t);
      const anns = r.annotations.map((a) => `${a.type}[${a.original} → ${a.spoken}]`).join('  ');
      return `${t}\n   => ${r.spokenText}\n   :: ${anns}`;
    });
    console.log(lines.join('\n'));
  });
});
