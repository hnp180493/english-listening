// Loads the English dictionaries (separate chunks, never downloaded in Vietnamese mode) and switches the language.
import { addDictionary, getLang, setActiveLang, subscribeLang, type Lang } from './lang';
import { useEffect, useState, useSyncExternalStore } from 'react';

type Dictionary = Readonly<Record<string, string>>;

/**
 * The dictionary bundles. 'ui' (shell, pages, core texts) and 'content' (lessons, courses, sentences) load with
 * English mode itself; 'town' loads with the town page (withDictionary in App.tsx), and with a switch to English
 * once that page has been opened; 'city' (the meanings of Westbay's lines) with Westbay (features/town/TownRoute.tsx).
 */
const LOADERS = {
  ui: () => import('./en/ui'),
  content: () => import('./en/content'),
  town: () => import('./en/town'),
  city: () => import('./en/city'),
} satisfies Record<string, () => Promise<{ default: Dictionary }>>;

export type DictionaryName = keyof typeof LOADERS;

const wanted = new Set<DictionaryName>(['ui', 'content']);
const loaded = new Set<DictionaryName>();
/** The language being switched to while its dictionaries load. */
let target: Lang = getLang();

async function loadWanted(): Promise<void> {
  await Promise.all(
    [...wanted]
      .filter((name) => !loaded.has(name))
      .map(async (name) => {
        const mod = await LOADERS[name]();
        addDictionary(mod.default);
        loaded.add(name);
      }),
  );
}

/**
 * Makes `lang` the interface language. English first loads its dictionaries; when one cannot be loaded (offline)
 * the switch still happens and the texts without an entry stay Vietnamese.
 */
export async function applyLang(lang: Lang): Promise<void> {
  target = lang;
  if (lang === 'en') {
    try {
      await loadWanted();
    } catch {
      // shown in Vietnamese until a later load works
    }
    if (target !== 'en') return;
  }
  setActiveLang(lang);
}

/** A page needs this dictionary: resolves once it is loaded (at once in Vietnamese mode, where it is only noted). */
export async function needDictionary(name: DictionaryName): Promise<void> {
  wanted.add(name);
  if (target !== 'en') return;
  try {
    await loadWanted();
  } catch {
    // see applyLang
  }
}

/** Wraps a lazy page's import so its dictionary arrives with it. */
export function withDictionary<T>(name: DictionaryName, load: () => Promise<T>): () => Promise<T> {
  return async () => {
    const [mod] = await Promise.all([load(), needDictionary(name)]);
    return mod;
  };
}

/** Whether a dictionary has been loaded (English mode). */
export function hasDictionary(name: DictionaryName): boolean {
  return loaded.has(name);
}

/**
 * A page needs these dictionaries for what it is about to show (Ôn tập: the town's and Westbay's lines): in English mode
 * they are loaded, and the hook says false until they are, so the page can wait instead of flashing Vietnamese first.
 * Vietnamese mode, or nothing missing: true at once, nothing loaded. A dictionary that cannot be loaded (offline)
 * stops the wait all the same (the texts then stay Vietnamese).
 */
export function useDictionaries(names: readonly DictionaryName[]): boolean {
  const lang = useLang();
  const key = [...names].sort().join(',');
  const [tried, setTried] = useState('');
  const missing = lang === 'en' && names.some((n) => !loaded.has(n)) && tried !== `${lang}:${key}`;
  useEffect(() => {
    if (!missing) return;
    const live = { on: true };
    void Promise.all(key.split(',').map((n) => needDictionary(n as DictionaryName))).then(() => {
      if (live.on) setTried(`en:${key}`);
    });
    return () => {
      live.on = false;
    };
  }, [missing, key]);
  return !missing;
}

/** The active language; re-renders when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}
