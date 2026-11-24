// The interface language (docs/i18n.md). Vietnamese is the source: every string in the code is written in
// Vietnamese and is its own key; English comes from dictionaries (src/i18n/en/*) loaded only in English mode.
// Pure (no React, no storage): core logic and tests can import it.

export type Lang = 'vi' | 'en';
export const LANGS: readonly Lang[] = ['vi', 'en'];

/** A stored language value, or the default 'vi' when it is not a known one. */
export function sanitizeLang(v: unknown): Lang {
  return v === 'en' ? 'en' : 'vi';
}

let lang: Lang = 'vi';
const dict = new Map<string, string>();
const listeners = new Set<() => void>();
/** Vietnamese text that reached the screen in English mode without a translation (a to-do list, never an error). */
const misses = new Set<string>();

/** An accented letter Vietnamese uses: marks a string as (probably) Vietnamese text for the list of misses. */
export const VI_LETTER = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

export function getLang(): Lang {
  return lang;
}

/** Switches what tr / tl return. The app goes through i18n/load.ts (applyLang), which loads the dictionaries first. */
export function setActiveLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  listeners.forEach((fn) => fn());
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Adds English entries (Vietnamese source → English). A later entry for the same source wins. */
export function addDictionary(entries: Readonly<Record<string, string>>): void {
  for (const k in entries) dict.set(k, entries[k]);
}

/** Test helper: forget every dictionary entry and recorded miss. */
export function resetDictionary(): void {
  dict.clear();
  misses.clear();
}

/** True when the dictionary has an English entry for exactly this source. */
export function hasTranslation(source: string): boolean {
  return dict.has(source);
}

/** Vietnamese strings shown untranslated in English mode since the page loaded. */
export function i18nMisses(): string[] {
  return [...misses];
}

/** English already made by tl (it may still hold a Vietnamese name, "Nghe Nối Âm"): not a miss when it reaches tr. */
const made = new Set<string>();

function miss(text: string): void {
  if (VI_LETTER.test(text) && !made.has(text)) misses.add(text);
}

function madeEnglish(text: string): string {
  if (made.size > 2000) made.clear();
  made.add(text);
  return text;
}

const COUNT_FORM = /\{#\|([^|}]*)\|([^}]*)\}/g;

/** Resolves {#|sentence|sentences}: the first word for a count of 1, the second otherwise (and with no count). */
function counted(english: string, count: unknown): string {
  if (!english.includes('{#|')) return english;
  const one = count !== undefined && count !== null && count !== '' && Number(count) === 1;
  return english.replace(COUNT_FORM, (_m, single: string, many: string) => (one ? single : many));
}

/**
 * The text in the current language. Vietnamese mode returns it untouched; English mode looks the whole string up
 * (then again without the spaces around it) and falls back to the Vietnamese text when there is no entry.
 * `count` is the number the text follows on screen (`{n} câu`): an entry written "{#|sentence|sentences}" agrees
 * with it.
 */
export function tr(text: string, count?: unknown): string {
  if (lang === 'vi' || !text) return text;
  const hit = dict.get(text);
  if (hit !== undefined) return counted(hit, count);
  const core = text.trim();
  if (core !== text && core) {
    const inner = dict.get(core);
    if (inner !== undefined) {
      const at = text.indexOf(core);
      return text.slice(0, at) + counted(inner, count) + text.slice(at + core.length);
    }
  }
  miss(text);
  return text;
}

/** The dictionary key of a template: its fixed parts joined by {} (`Còn ${n} thẻ` → "Còn {} thẻ"). */
export function templateKey(strings: readonly string[]): string {
  return strings.join('{}');
}

const SLOT = /\{(\d+)(?:\|([^|}]*)\|([^}]*))?\}/g;

/**
 * Fills an English template: {0} = the first value, {1} the second…; {0|card|cards} picks the first word when
 * value 0 is 1 and the second otherwise. A slot without a value stays empty.
 */
export function fillTemplate(template: string, values: readonly unknown[]): string {
  return template.replace(SLOT, (_m, index: string, one: string | undefined, many: string | undefined) => {
    const v = values[Number(index)];
    if (one !== undefined && many !== undefined) return Number(v) === 1 ? one : many;
    return v === undefined || v === null ? '' : String(v);
  });
}

/** A value tl must show exactly as it is (see asIs). */
class AsIs {
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
  toString(): string {
    return this.text;
  }
}

/**
 * Marks a tl value that is never translated: a name or text the learner typed (a child called "Mai" stays Mai, not
 * the dictionary's "Mai" = tomorrow). Vietnamese mode shows it exactly as a plain string would.
 */
export function asIs(text: string): AsIs {
  return new AsIs(text);
}

/**
 * Tag for a Vietnamese sentence with values in it: tl`Còn ${n} thẻ`. Vietnamese mode gives exactly what the plain
 * template literal would; English mode fills the entry stored under templateKey (values that are themselves
 * Vietnamese labels are translated first).
 */
export function tl(strings: TemplateStringsArray, ...values: unknown[]): string {
  if (lang === 'en') {
    const template = dict.get(templateKey(strings));
    if (template !== undefined) {
      return madeEnglish(
        fillTemplate(
          template,
          values.map((v) => (v instanceof AsIs ? v.text : typeof v === 'string' ? tr(v) : v)),
        ),
      );
    }
  }
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += String(values[i]) + strings[i + 1];
  if (lang === 'en') miss(out);
  return out;
}
