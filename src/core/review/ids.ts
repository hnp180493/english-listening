// Card ids: '<kind>:<ref>'. Pure.

import { KIND_ORDER, KIND_SECONDS } from './constants';
import type { CardId, ReviewKind, StoredKind } from './types';

export const REVIEW_KINDS: readonly ReviewKind[] = KIND_ORDER;
export const STORED_KINDS: readonly StoredKind[] = ['dict', 'pair', 'lesson', 'media', 'word'];

const KIND_SET = new Set<string>(KIND_ORDER);
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_REF = 200;

export function makeCardId(kind: ReviewKind, ref: string): CardId {
  return `${kind}:${ref}`;
}

/** null for unknown kinds, empty ref, ref > 200 chars, or '__proto__'/'constructor'/'prototype' as the whole key. */
export function parseCardId(id: string): { kind: ReviewKind; ref: string } | null {
  if (typeof id !== 'string' || UNSAFE.has(id)) return null;
  const i = id.indexOf(':');
  if (i <= 0) return null;
  const kind = id.slice(0, i);
  const ref = id.slice(i + 1);
  if (!KIND_SET.has(kind) || !ref || ref.length > MAX_REF) return null;
  return { kind: kind as ReviewKind, ref };
}

export function isStoredKind(kind: ReviewKind): kind is StoredKind {
  return kind !== 'chunk';
}

export function mediaRef(itemId: string, unit: number): string {
  return `${itemId}:${unit}`;
}

/** Splits on the LAST ':'; the unit must be an integer >= 0. */
export function parseMediaRef(ref: string): { itemId: string; unit: number } | null {
  if (typeof ref !== 'string') return null;
  const i = ref.lastIndexOf(':');
  if (i <= 0) return null;
  const tail = ref.slice(i + 1);
  if (!/^\d+$/.test(tail)) return null;
  const unit = Number(tail);
  if (!Number.isSafeInteger(unit)) return null;
  return { itemId: ref.slice(0, i), unit };
}

/** KIND_SECONDS of the parsed kind, 0 when unparsable. */
export function kindSeconds(id: CardId | string): number {
  const p = parseCardId(id);
  return p ? KIND_SECONDS[p.kind] : 0;
}
