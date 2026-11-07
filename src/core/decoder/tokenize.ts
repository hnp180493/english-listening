import type { Token } from '../types';

export interface Tokenized {
  tokens: Token[];
  /** The word-core text of each token as written (no surrounding punctuation): "It's", "Paris". */
  cores: string[];
  /** brk[i] === true when a phrase boundary (punctuation / end of input) follows token i. */
  brk: boolean[];
}

const CORE_RE = /[\p{L}\p{N}'’]+/gu;
const HAS_ALNUM = /[\p{L}\p{N}]/u;

/** Split text into word tokens with char offsets and phrase boundaries. Never throws. */
export function tokenize(input: string): Tokenized {
  const text = typeof input === 'string' ? input : '';
  const cores: { start: number; end: number; text: string }[] = [];
  for (const m of text.matchAll(CORE_RE)) {
    const s = m[0];
    if (!HAS_ALNUM.test(s)) continue;
    // trim leading/trailing apostrophes used as quotes: 'hello' → hello (but keep 'cause)
    let start = m.index ?? 0;
    let core = s;
    while (core.length > 1 && /['’]$/.test(core) && !/s['’]$/i.test(core)) core = core.slice(0, -1);
    if (/^['’]/.test(core) && !/^['’](cause|em|til|bout)$/i.test(core)) {
      while (core.length > 1 && /^['’]/.test(core)) {
        core = core.slice(1);
        start += 1;
      }
    }
    cores.push({ start, end: start + core.length, text: core });
  }

  const tokens: Token[] = [];
  const brk: boolean[] = [];
  let prevEnd = 0;
  for (let i = 0; i < cores.length; i++) {
    const c = cores[i];
    const nextStart = i + 1 < cores.length ? cores[i + 1].start : text.length;
    let rs = c.start;
    while (rs > prevEnd && !/\s/.test(text[rs - 1])) rs--;
    let re = c.end;
    while (re < nextStart && !/\s/.test(text[re])) re++;
    prevEnd = re;
    const word = c.text
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/[^\p{L}']/gu, '')
      .replace(/^'+(?!(cause|em|til|bout)$)/, '')
      .replace(/'+$/, '');
    tokens.push({ index: i, raw: text.slice(rs, re), word, start: rs, end: re });
    if (i + 1 < cores.length) {
      const gap = text.slice(c.end, nextStart);
      const boundary = /[^\s'’-]/.test(gap) || (/-/.test(gap) && /\s/.test(gap));
      brk.push(boundary);
    } else {
      brk.push(true);
    }
  }
  return { tokens, cores: cores.map((c) => c.text), brk };
}
