import { describe, expect, it } from 'vitest';
import { rel, sourceFiles } from '../../scripts/i18n-scan.mjs';

// `data-vi` on an element keeps its text exactly as written (docs/i18n.md §1). It once sat on the meanings of the
// English lines while their English was still pending, and kept them Vietnamese in English mode after it was done.
// Only the language switch (it names the other language in that language) and the admin sheets (owner's reading
// tool, the original wording on purpose) may use it.
const ALLOWED = new Set(['src/components/AppNav.tsx', 'src/features/admin/AdminPage.tsx']);

const nodeModule = (name: string): Promise<any> => import(/* @vite-ignore */ name);

describe('data-vi', () => {
  it('is used only where Vietnamese is meant to stay Vietnamese', async () => {
    const { readFileSync } = await nodeModule('node:fs');
    const used = sourceFiles()
      .filter((f) => !ALLOWED.has(rel(f)) && /\sdata-vi[\s=>]/.test(readFileSync(f, 'utf8')))
      .map((f) => rel(f));
    expect(used).toEqual([]);
  });
});
