// IO of "Hẹn hò, cưới, con" and the learner's own character (docs/town.md §15): KEYS.townLife (synced, ./life), its
// React hook, and the calls the town makes. Friendship points and the bouquet / ring in hand live in town-progress
// (./store commitTown), so a step writes both.

import { useSyncExternalStore } from 'react';
import { KEYS, onAppWrite, saveJSON, STORAGE_PREFIX } from '../storage';
import { addFriendPoints, friendHearts, giftInHand } from './friendship';
import { emptyTownLife, mergeTownLife, parseTownLife, withChoice, withKid, withProfile, withStep, withTalked, type Kid, type PlayerProfile, type TownLife } from './life';
import { addGiftCount, townDay } from './progress';
import { BOUQUET, RING, romanceSteps, STEP_POINTS, type RomanceStep } from './romance';
import { commitTown, loadTownProgress, townDevice, type TownCelebration } from './store';
import { isBuilt } from './economy';

let session: TownLife | null = null;
let cacheRaw: string | null | undefined;
let cacheSession: TownLife | null = null;
let cacheValue: TownLife = emptyTownLife();
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.townLife);
  } catch {
    return null;
  }
}

function notify(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // a listener must never break a write
    }
  }
}

/** The stored life (plus this session's unsaved change after a failed save). Stable while nothing changed. */
export function loadTownLife(): TownLife {
  const raw = readRaw();
  if (raw !== cacheRaw || session !== cacheSession) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const stored = parseTownLife(parsed);
    cacheValue = session ? mergeTownLife(session, stored) : stored;
    cacheRaw = raw;
    cacheSession = session;
  }
  return cacheValue;
}

function writeLife(next: TownLife): boolean {
  const saved = saveJSON(KEYS.townLife, next);
  session = saved ? null : next;
  notify();
  return saved;
}

let hooked = false;
function subscribe(fn: () => void): () => void {
  if (!hooked) {
    hooked = true;
    onAppWrite((key) => {
      if (key === KEYS.townLife || key === '*') {
        if (key === '*') {
          session = null;
          cacheRaw = undefined;
        }
        notify();
      }
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_PREFIX + KEYS.townLife) notify();
      });
    } catch {
      // no DOM (tests)
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Live town life; re-renders on every change (this tab, another tab, account sync). */
export function useTownLife(): TownLife {
  return useSyncExternalStore(subscribe, loadTownLife, loadTownLife);
}

/** Save the learner's character (the creator). */
export function saveProfile(p: Omit<PlayerProfile, 'at'>, now: number = Date.now()): boolean {
  const before = loadTownLife();
  const next = withProfile(before, p, now);
  return next === before ? false : writeLife(next);
}

/** What the learner can do next with this resident now (./romance romanceSteps, with the hearts and gifts in hand). */
export function townRomanceSteps(placeId: string, now: number = Date.now()): RomanceStep[] {
  const progress = loadTownProgress();
  return romanceSteps(loadTownLife(), placeId, { hearts: friendHearts(progress, placeId), bouquets: giftInHand(progress, BOUQUET), rings: giftInHand(progress, RING), built: (id) => isBuilt(progress, id) }, now);
}

export interface RomanceDone {
  ok: boolean;
  /** Friendship points it added. */
  points: number;
  celebrations: TownCelebration[];
  /** A baby was born: their id. */
  kidId?: string;
}

/**
 * A step was played through: record it, pay its friendship points (and the choice's, the first time), use up the
 * bouquet or the ring. `choice`: the option picked in the scene. `baby`: the name and boy / girl of a new child.
 * Refused (ok false) when the step is not ready any more (another tab did it, a new day).
 */
export function finishRomanceStep(step: RomanceStep, choice: { id: string; points: number } | null, baby?: { name: string; gender: Kid['gender'] }, now: number = Date.now()): RomanceDone {
  const fresh = townRomanceSteps(step.placeId, now).find((s) => s.kind === step.kind && s.kidId === step.kidId);
  if (!fresh?.ready) return { ok: false, points: 0, celebrations: [] };
  let life = loadTownLife();
  const device = townDevice();
  let progress = loadTownProgress();
  let points = STEP_POINTS[step.kind];
  let kidId: string | undefined;
  if (step.records) life = withStep(life, step.placeId, step.records, now);
  const day = townDay(now);
  if (step.kind === 'daily') life = withTalked(life, day, 'spouse');
  if (step.kind === 'kid' && step.kidId) life = withTalked(life, day, step.kidId);
  if (step.kind === 'baby') {
    const made = baby ? withKid(life, baby.name, baby.gender, now) : null;
    if (!made) return { ok: false, points: 0, celebrations: [] };
    life = made.life;
    kidId = made.id;
  }
  if (choice && step.scene) {
    const c = withChoice(life, step.scene.id, choice.id, now);
    life = c.life;
    if (c.first) points += choice.points;
  }
  if (step.kind === 'confess') progress = addGiftCount(progress, 'given', BOUQUET, device);
  if (step.kind === 'proposal') progress = addGiftCount(progress, 'given', RING, device);
  const w = addFriendPoints(progress, step.placeId, points, device);
  const saved = writeLife(life);
  const t = commitTown(w.progress, now);
  return { ok: saved && t.saved, points: w.points, celebrations: t.celebrations, kidId };
}
