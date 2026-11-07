// Pure helpers for the decoder page: recent-input history, share links and
// "send this sentence to dictation". No DOM, no storage access here.

import { hrefFor } from '../../core/nav';
import {
  addCustom,
  cleanText,
  CUSTOM_ERROR_TEXT,
  dedupeKey,
  sanitizeCustom,
  type Analyzer,
  type CustomSentence,
} from '../../core/dictation/custom';

/** Storage key (through src/core/storage.ts) of the last decoded inputs. */
export const HISTORY_KEY = 'decoder-history';
export const HISTORY_MAX = 10;
/** Same limit as the textarea. */
export const TEXT_MAX = 600;

/** Collapse whitespace, drop control characters, trim and cap the length. */
export function cleanInput(raw: unknown, max: number = TEXT_MAX): string {
  if (typeof raw !== 'string') return '';
  let out = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    out += code < 32 || code === 127 ? ' ' : ch;
  }
  const t = out.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

const key = (s: string) => s.toLowerCase();

/** Defensive parse of the stored history: strings only, cleaned, deduped, newest first, at most 10. */
export function sanitizeHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const t = cleanInput(item);
    if (!t || !/[\p{L}\p{N}]/u.test(t) || seen.has(key(t))) continue;
    seen.add(key(t));
    out.push(t);
    if (out.length >= HISTORY_MAX) break;
  }
  return out;
}

/**
 * Put `text` first (moving it up if it is already there). Returns the SAME array when
 * nothing changes, so callers can skip a re-render / a storage write.
 */
export function addToHistory(list: readonly string[], text: string): string[] {
  const t = cleanInput(text);
  if (!t || !/[\p{L}\p{N}]/u.test(t)) return list as string[];
  if (list[0] === t) return list as string[];
  const rest = list.filter((x) => key(x) !== key(t));
  return [t, ...rest].slice(0, HISTORY_MAX);
}

export function removeFromHistory(list: readonly string[], text: string): string[] {
  return list.filter((x) => x !== text);
}

/** Short label for a history chip. */
export function chipLabel(text: string, max = 42): string {
  const t = cleanInput(text);
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

/** Absolute link that opens the decoder with `text` preloaded. */
export function shareUrl(loc: { origin: string; pathname: string }, text: string): string {
  const t = cleanInput(text);
  return `${loc.origin}${loc.pathname}${hrefFor('decoder', t ? { text: t } : undefined)}`;
}

export type DictationAdd =
  | { status: 'added'; list: CustomSentence[]; id: string }
  | { status: 'exists'; list: CustomSentence[]; id: string }
  | { status: 'error'; list: CustomSentence[]; message: string };

/**
 * Id of the built-in sentence whose text matches `text` (same comparison the custom list uses for
 * duplicates), so the decoder can open that sentence in dictation instead of saving a copy of it
 * into "Câu của tôi".
 */
export function findBuiltin(text: string, sentences: readonly { id: string; text: string }[]): string | undefined {
  const k = dedupeKey(cleanText(text, Number.MAX_SAFE_INTEGER));
  return k ? sentences.find((s) => dedupeKey(s.text) === k)?.id : undefined;
}

/**
 * Add `text` to the dictation module's "Câu của tôi" list (stored raw value in, new list out).
 * An already-saved sentence is not an error: the learner is simply sent to practise it.
 * `id` is the custom sentence to open first (the new one, or the one already saved).
 */
export function addSentenceForDictation(stored: unknown, text: string, now: number, analyze?: Analyzer): DictationAdd {
  const list = sanitizeCustom(stored, analyze);
  const k = dedupeKey(cleanText(text, Number.MAX_SAFE_INTEGER));
  const existing = k ? list.find((c) => dedupeKey(c.text) === k) : undefined;
  if (existing) return { status: 'exists', list, id: existing.id };
  const res = addCustom(list, [{ text }], now, analyze);
  if (res.added.length > 0) return { status: 'added', list: res.list, id: res.added[0].id };
  const error = res.rejected[0]?.error ?? 'empty';
  if (error === 'duplicate') {
    const dupKey = dedupeKey(cleanText(text));
    const dup = list.find((c) => dedupeKey(c.text) === dupKey);
    if (dup) return { status: 'exists', list, id: dup.id };
  }
  return { status: 'error', list, message: CUSTOM_ERROR_TEXT[error] };
}
