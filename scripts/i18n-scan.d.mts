// Types of scripts/i18n-scan.mjs for src/i18n/coverage.test.ts.
export interface FoundString {
  /** The dictionary key: the trimmed text, or the template with {} for each value. */
  key: string;
  text: string;
  /** 'text' = a plain string or JSX text, 'tl' = a tl template, 'untagged' = a template literal without the tag. */
  kind: 'text' | 'tl' | 'untagged';
  file: string;
  line: number;
  /** "<bundle>/<name>": the dictionary file that holds it. */
  area: string;
  class: 'ui' | 'explain' | 'meaning';
  /** Evaluated when the module loads (outside every function). */
  top: boolean;
  prop?: string;
}

export function isVietnamese(s: string): boolean;
export function jsxText(raw: string): string;
export function allTranslatable(): FoundString[];
export function readAllDictionaries(): Map<string, Map<string, string>>;
export function missingByArea(all?: FoundString[], dicts?: Map<string, Map<string, string>>): Map<string, FoundString[]>;
export function visibleBundles(bundle: string): string[];
export function visibleEntries(dicts: Map<string, Map<string, string>>, bundle: string): Map<string, string>;
export function answerGroups(): { at: string; group: string[] }[];
export function slotsUsed(english: string): number[];
export const UNACCENTED: Set<string>;
