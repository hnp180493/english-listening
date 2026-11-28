// What "Thị trấn" remembers about THIS browser only (KEYS.townUi, device-local: never synced, never in a backup):
// whether its sound effects are on (default on), whether the welcome bubble was closed, whether residents greet the
// learner walking up ("Lời chào của cư dân", default on, docs/town.md §12) and which greeting each said last and when
// (so one is never said twice in a row, and a resident greets at most once in GREET_EVERY_MS).

import { useSyncExternalStore } from 'react';
import { KEYS, loadJSON, onAppWrite, saveJSON } from '../../core/storage';

export interface TownUi {
  sound: boolean;
  welcomed: boolean;
  /** Residents say a short greeting when the learner walks up to them. */
  greet: boolean;
  /** Per resident (place id): the greeting said last and when (epoch ms). */
  hi: Record<string, { id: string; at: number }>;
  /** Memory greetings said on this browser, by greeting id (core/town/friendship MEMORY_GREETING_PLAYS). */
  said: Record<string, number>;
  /**
   * How the residents who have a VRoid avatar are shown (data/townVrm.ts): as it ('anime', the default) or as the
   * body built in code like everybody else ('classic'). Per browser: an avatar is heavy for a weak phone.
   */
  people: 'anime' | 'classic';
  /**
   * How the avatars move. Always 'code': the ready-made clips hunched every back (their idle stands bent past the
   * skeleton's bind, and that bend was copied onto the avatars; the jog twisted the chest). The walk made in code
   * is the one that stands straight. The field stays so a stored 'clips' still parses.
   */
  motion: 'clips' | 'code';
  /** The vehicle of the garage (data/townGarage.ts) the "Gọi …" button brings; '' = the dearest one owned. */
  ride: string;
}

export const DEFAULT_TOWN_UI: TownUi = { sound: true, welcomed: false, greet: true, hi: {}, said: {}, people: 'anime', motion: 'code', ride: '' };

const HI_ID = /^[a-z][a-z0-9-]{0,59}$/;

function parseHi(raw: unknown): TownUi['hi'] {
  const out: TownUi['hi'] = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 40)) {
    if (!HI_ID.test(k) || !v || typeof v !== 'object') continue;
    const { id, at } = v as Record<string, unknown>;
    if (typeof id === 'string' && HI_ID.test(id) && typeof at === 'number' && Number.isFinite(at) && at > 0) out[k] = { id, at };
  }
  return out;
}

function parseSaid(raw: unknown): TownUi['said'] {
  const out: TownUi['said'] = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 300)) {
    if (HI_ID.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = Math.min(99, Math.floor(v));
  }
  return out;
}

/** Anything stored → a well-formed value (unknown fields dropped, wrong types back to the default). */
export function parseTownUi(raw: unknown): TownUi {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_TOWN_UI, hi: {}, said: {} };
  const r = raw as Record<string, unknown>;
  return { sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_TOWN_UI.sound, welcomed: r.welcomed === true, greet: typeof r.greet === 'boolean' ? r.greet : DEFAULT_TOWN_UI.greet, hi: parseHi(r.hi), said: parseSaid(r.said), people: r.people === 'classic' ? 'classic' : 'anime', motion: 'code', ride: typeof r.ride === 'string' && HI_ID.test(r.ride) ? r.ride : '' };
}

let cache: TownUi | null = null;
const listeners = new Set<() => void>();

function read(): TownUi {
  if (!cache) cache = parseTownUi(loadJSON<unknown>(KEYS.townUi, null));
  return cache;
}

export function getTownUi(): TownUi {
  return read();
}

export function setTownUi(patch: Partial<TownUi>): void {
  cache = { ...read(), ...patch };
  // a blocked storage keeps the choice for this session (the cache)
  saveJSON(KEYS.townUi, cache);
  for (const fn of [...listeners]) fn();
}

let hooked = false;
function subscribe(fn: () => void): () => void {
  if (!hooked) {
    hooked = true;
    // "Xóa dữ liệu" removes the key outside setTownUi
    onAppWrite((key) => {
      if (key !== '*') return;
      cache = null;
      for (const l of [...listeners]) l();
    });
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useTownUi(): TownUi {
  return useSyncExternalStore(subscribe, read, read);
}

/** For tests. */
export function _resetTownUi(): void {
  cache = null;
}
