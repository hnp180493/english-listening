// "Câu của tôi": user-added dictation sentences. Pure helpers — the page loads/saves
// the list through src/core/storage.ts (KEYS.customSentences) and passes an analyzer
// (decoder annotation count) so the level can be estimated without a hard dependency here.

import type { Level, Phenomenon, Sentence } from '../types';

export const CUSTOM_TOPIC = 'Câu của tôi';
export const MAX_CUSTOM = 500;
export const MAX_TEXT_CHARS = 300;
export const MAX_VI_CHARS = 300;

export interface CustomSentence {
  id: string; // "u-<timestamp36>"
  text: string; // English
  vi: string; // Vietnamese meaning, may be ""
  level: Level;
  createdAt: number; // epoch ms
  updatedAt?: number; // epoch ms of the last edit (folder sync keeps the version edited last); absent = never edited
}

export interface CustomInput {
  text: string;
  vi?: string;
}

/** Number of decoder annotations in `text` (used for level estimation). */
export type Analyzer = (text: string) => number;

export type CustomError = 'empty' | 'no-letters' | 'not-english' | 'too-long' | 'duplicate' | 'full';

// Letters that only occur in Vietnamese (shared Latin accents like é/à are allowed).
const VIET_ONLY =
  /[ăâđêôơưạảãầấậẩẫằắặẳẵẹẻẽềếệểễịỉĩọỏõồốộổỗờớợởỡụủũừứựửữỳỵỷỹ]/i;

/**
 * Vietnamese-only letters, or many accented letters for the number of words
 * ("Xin chào" yes; "a café latte" no).
 */
/** Most letters are not Latin (Chinese, Cyrillic, Thai …): not an English sentence. */
export function mostlyNonLatin(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return false;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  return latin / letters.length < 0.7;
}

export function looksVietnamese(text: string): boolean {
  if (VIET_ONLY.test(text)) return true;
  const accented = (text.normalize('NFD').match(/\p{M}/gu) ?? []).length;
  if (accented === 0) return false;
  return accented / Math.max(1, wordCount(text)) >= 0.34;
}

/** Collapse whitespace, drop control characters and HTML tags, trim, cap length. */
export function cleanText(s: unknown, max: number = MAX_TEXT_CHARS): string {
  if (typeof s !== 'string') return '';
  let printable = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    printable += code < 32 || code === 127 ? ' ' : ch;
  }
  // pasted markup ("<b>Turn it off</b>", "<br>") is never part of a sentence to dictate
  const t = printable
    .replace(/<\/?[a-z][^<>]*>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Level from length + density of connected-speech events, calibrated on the built-in
 * sentences: score = words + annotations / 2; ≤ 9 → Dễ, ≥ 16 → Khó, else Vừa.
 */
export function estimateLevel(words: number, annotations: number): Level {
  const w = Number.isFinite(words) && words > 0 ? words : 0;
  const a = Number.isFinite(annotations) && annotations > 0 ? annotations : 0;
  const score = w + a / 2;
  if (score <= 9) return 1;
  if (score >= 16) return 3;
  return 2;
}

/** Key used to detect duplicates: lowercase, letters/digits/apostrophes only. */
export function dedupeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Validate an English sentence; `exceptId` lets an edited sentence keep its own text. */
export function validateCustomText(
  raw: string,
  list: readonly CustomSentence[],
  exceptId?: string,
): CustomError | null {
  const text = cleanText(raw, Infinity);
  if (text.length > MAX_TEXT_CHARS) return 'too-long';
  if (!text) return 'empty';
  if (!/[a-z]/i.test(text)) return 'no-letters';
  if (looksVietnamese(text) || mostlyNonLatin(text)) return 'not-english';
  const key = dedupeKey(text);
  if (list.some((c) => c.id !== exceptId && dedupeKey(c.text) === key)) return 'duplicate';
  if (!exceptId && list.length >= MAX_CUSTOM) return 'full';
  return null;
}

export const CUSTOM_ERROR_TEXT: Record<CustomError, string> = {
  empty: 'Hãy nhập câu tiếng Anh.',
  'no-letters': 'Câu cần có chữ cái tiếng Anh.',
  'not-english': 'Câu này không giống tiếng Anh (có dấu tiếng Việt hoặc chữ khác) — ô trên dành cho câu tiếng Anh, nghĩa tiếng Việt ghi ở ô dưới.',
  'too-long': `Câu quá dài (tối đa ${MAX_TEXT_CHARS} ký tự). Hãy tách thành câu ngắn hơn.`,
  duplicate: 'Câu này đã có trong danh sách.',
  full: `Danh sách đã đủ ${MAX_CUSTOM} câu. Hãy xóa bớt câu cũ.`,
};

/** "u-<timestamp36>", bumped until unique. */
export function makeCustomId(now: number, taken: ReadonlySet<string>): string {
  let t = Math.max(0, Math.floor(Number.isFinite(now) ? now : 0));
  let id = `u-${t.toString(36)}`;
  while (taken.has(id)) {
    t += 1;
    id = `u-${t.toString(36)}`;
  }
  return id;
}

function isLevel(v: unknown): v is Level {
  return v === 1 || v === 2 || v === 3;
}

/** Defensive parse of the stored list: bad entries dropped, ids deduped, levels repaired. */
export function sanitizeCustom(raw: unknown, analyze?: Analyzer): CustomSentence[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomSentence[] = [];
  const ids = new Set<string>();
  const texts = new Set<string>();
  // valid stored ids are reserved first, so a repaired entry never steals the id
  // (and therefore the progress) of a later, well-formed one
  const reserved = new Set<string>();
  for (const item of raw) {
    const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
    if (typeof id === 'string' && isCustomId(id)) reserved.add(id);
  }
  for (const item of raw) {
    if (out.length >= MAX_CUSTOM) break;
    if (!item || typeof item !== 'object') continue;
    const r = item as Partial<CustomSentence>;
    const text = cleanText(r.text);
    if (!text || !/[a-z]/i.test(text)) continue;
    const key = dedupeKey(text);
    if (texts.has(key)) continue;
    const createdAt = typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) && r.createdAt > 0 ? r.createdAt : 0;
    let id = typeof r.id === 'string' && isCustomId(r.id) ? r.id : '';
    if (!id || ids.has(id)) id = makeCustomId(createdAt || out.length + 1, new Set([...ids, ...reserved]));
    const level = isLevel(r.level) ? r.level : estimateLevel(wordCount(text), safeAnalyze(analyze, text));
    ids.add(id);
    texts.add(key);
    const c: CustomSentence = { id, text, vi: cleanText(r.vi, MAX_VI_CHARS), level, createdAt };
    if (typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) && r.updatedAt > 0) c.updatedAt = r.updatedAt;
    out.push(c);
  }
  return out;
}

function safeAnalyze(analyze: Analyzer | undefined, text: string): number {
  if (!analyze) return 0;
  try {
    const n = analyze(text);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

const BULLET = /^\s*(?:[-*•–·]|\d{1,3}[.)])\s+/;

/**
 * Bulk paste: one sentence per line. Bullets / numbering are stripped; an optional
 * Vietnamese meaning may follow a tab or "|". Empty lines and in-paste duplicates are dropped.
 * English text is NOT truncated here: an over-long line is rejected later as 'too-long'
 * instead of being silently cut.
 */
export function parseBulk(text: string): CustomInput[] {
  if (typeof text !== 'string') return [];
  const out: CustomInput[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const stripped = line.replace(BULLET, '');
    const m = /\s*(?:\t|\|)\s*/.exec(stripped);
    const en = cleanText(m ? stripped.slice(0, m.index) : stripped, Infinity);
    const vi = m ? cleanText(stripped.slice(m.index + m[0].length), MAX_VI_CHARS) : '';
    if (!en) continue;
    const key = dedupeKey(en);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(vi ? { text: en, vi } : { text: en });
  }
  return out;
}

export interface AddResult {
  list: CustomSentence[];
  added: CustomSentence[];
  rejected: { text: string; error: CustomError }[];
}

/** Append valid inputs (ids from `now`, one ms apart). Invalid / duplicate inputs are reported, not thrown. */
export function addCustom(list: readonly CustomSentence[], inputs: readonly CustomInput[], now: number, analyze?: Analyzer): AddResult {
  const next = [...list];
  const added: CustomSentence[] = [];
  const rejected: AddResult['rejected'] = [];
  const ids = new Set(next.map((c) => c.id));
  for (const input of inputs) {
    const error = validateCustomText(input.text, next);
    if (error) {
      rejected.push({ text: cleanText(input.text) || String(input.text ?? ''), error });
      continue;
    }
    const text = cleanText(input.text);
    const id = makeCustomId(now + added.length, ids);
    ids.add(id);
    const c: CustomSentence = {
      id,
      text,
      vi: cleanText(input.vi, MAX_VI_CHARS),
      level: estimateLevel(wordCount(text), safeAnalyze(analyze, text)),
      createdAt: now,
    };
    next.push(c);
    added.push(c);
  }
  return { list: next, added, rejected };
}

export interface UpdateResult {
  list: CustomSentence[];
  error: CustomError | null;
}

/**
 * Edit text / meaning of one sentence; the level is re-estimated. `updatedAt` moves past any earlier version, so
 * folder sync keeps this edit even when another machine changed other data later.
 */
export function updateCustom(
  list: readonly CustomSentence[],
  id: string,
  input: CustomInput,
  analyze?: Analyzer,
  now: number = Date.now(),
): UpdateResult {
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return { list: [...list], error: null };
  const error = validateCustomText(input.text, list, id);
  if (error) return { list: [...list], error };
  const text = cleanText(input.text);
  const next = [...list];
  const prev = list[idx];
  next[idx] = {
    ...prev,
    text,
    vi: cleanText(input.vi, MAX_VI_CHARS),
    level: estimateLevel(wordCount(text), safeAnalyze(analyze, text)),
    updatedAt: Math.max(Number.isFinite(now) ? now : 0, Math.max(prev.updatedAt ?? 0, prev.createdAt) + 1),
  };
  return { list: next, error: null };
}

export function removeCustom(list: readonly CustomSentence[], id: string): CustomSentence[] {
  return list.filter((c) => c.id !== id);
}

/** View a custom sentence as a regular practice Sentence. */
export function toSentence(c: CustomSentence, focus: readonly Phenomenon[] = []): Sentence {
  return { id: c.id, text: c.text, vi: c.vi, level: c.level, topic: CUSTOM_TOPIC, focus: [...focus] };
}

export function isCustomId(id: string): boolean {
  return /^u-[0-9a-z]+$/.test(id);
}
