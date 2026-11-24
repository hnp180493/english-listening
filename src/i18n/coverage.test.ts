import { describe, expect, it } from 'vitest';
import { allTranslatable, isVietnamese, jsxText, missingByArea, readAllDictionaries, slotsUsed, visibleBundles, type FoundString } from '../../scripts/i18n-scan.mjs';

// Scans every source file for Vietnamese strings and checks them against the English dictionaries (docs/i18n.md).
// A new Vietnamese string in the code needs an entry (node scripts/i18n-scan.mjs --todo <area> …).

/**
 * What has no English yet and is shown in Vietnamese in English mode (docs/i18n.md §4, AGENTS.md §9): the *meanings*
 * of the English lines and the answers of the listening checks (class 'meaning': the `vi`, `options`, `intent`, `q`,
 * `question` fields of the content, the phrase meanings), waiting for the owner's go-ahead on how to word them.
 * Everything else (interface, explanations, narration, names) must have an entry.
 */
const isPending = (s: FoundString) => s.class === 'meaning';

const all = allTranslatable();
const dicts = readAllDictionaries();
const missing = missingByArea(all, dicts);

const show = (list: FoundString[]) =>
  list
    .slice(0, 25)
    .map((s) => `${s.file}:${s.line}  ${JSON.stringify(s.key)}`)
    .join('\n');

describe('the scanner', () => {
  it('tells Vietnamese from English with an accent', () => {
    expect(isVietnamese('Ôn tập')).toBe(true);
    expect(isVietnamese('Là sao?')).toBe(true);
    expect(isVietnamese('a café and a résumé')).toBe(false);
    expect(isVietnamese('quán café gần nhà')).toBe(true);
    expect(isVietnamese('gonna')).toBe(false);
  });

  it('reads JSX text the way React does', () => {
    expect(jsxText('\n        Chuyển đến\n        nội dung chính\n      ')).toBe('Chuyển đến nội dung chính');
    expect(jsxText(' thẻ ')).toBe(' thẻ ');
  });

  it('finds the strings of the app', () => {
    expect(all.length).toBeGreaterThan(5000);
    expect(all.some((s) => s.key === 'Ôn tập' && s.file === 'src/core/nav.ts')).toBe(true);
  });
});

describe('English coverage', () => {
  it('every Vietnamese string of the interface and of the explanations has an English entry', () => {
    const gaps = [...missing].flatMap(([, list]) => list.filter((s) => s.kind !== 'untagged' && !isPending(s)));
    expect(`${gaps.length} missing\n${show(gaps)}`).toBe('0 missing\n');
  });

  it('every Vietnamese template with values is tagged with tl (run: node scripts/i18n-scan.mjs --tag)', () => {
    const untagged = all.filter((s) => s.kind === 'untagged');
    expect(show(untagged)).toBe('');
  });
});

describe('the dictionaries', () => {
  const entries = [...dicts].flatMap(([area, d]) => [...d].map(([vi, en]) => ({ area, vi, en })));

  it('exist', () => {
    expect(entries.length).toBeGreaterThan(200);
  });

  it('give one English text per Vietnamese string among the bundles loaded together', () => {
    const clashes: string[] = [];
    for (const bundle of ['ui', 'town']) {
      const seen = new Map<string, { area: string; en: string }>();
      for (const e of entries) {
        if (!visibleBundles(bundle).includes(e.area.split('/')[0])) continue;
        const first = seen.get(e.vi);
        if (!first) seen.set(e.vi, e);
        else if (first.en !== e.en) clashes.push(`${JSON.stringify(e.vi)}: ${first.area} ${JSON.stringify(first.en)} / ${e.area} ${JSON.stringify(e.en)}`);
      }
    }
    expect([...new Set(clashes)].slice(0, 25).join('\n')).toBe('');
  });

  it('use only the slots their template has', () => {
    const bad = entries.filter((e) => {
      const slots = e.vi.split('{}').length - 1;
      return slotsUsed(e.en).some((i) => i >= slots) || e.en.includes('{}');
    });
    expect(bad.map((e) => `${e.area}: ${JSON.stringify(e.vi)} → ${JSON.stringify(e.en)}`).join('\n')).toBe('');
  });

  it('hold English, not Vietnamese (a quoted Vietnamese word or sound hint aside)', () => {
    const SAME: readonly string[] = ['Tiếng Việt', 'Nghe Nối Âm'];
    const mostlyVietnamese = (en: string) => {
      const words = en.split(' ').filter((w) => w.length > 0);
      return words.length > 0 && words.filter((w) => isVietnamese(w)).length / words.length > 0.3;
    };
    const bad = entries.filter((e) => (mostlyVietnamese(e.en) || (e.en === e.vi && isVietnamese(e.vi))) && !SAME.includes(e.vi));
    expect(
      bad
        .slice(0, 25)
        .map((e) => `${e.area}: ${JSON.stringify(e.vi)} → ${JSON.stringify(e.en)}`)
        .join('\n'),
    ).toBe('');
  });
});
