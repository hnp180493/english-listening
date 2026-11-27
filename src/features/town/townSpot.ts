// Where the player last stood in the street, on THIS browser (KEYS.townSpot, device-local: never synced, never in a
// backup; "Xóa dữ liệu" clears it; the admin sandbox has its own under its prefix). Owner, 2026-11-27: "không lưu lại
// trạng thái nhân vật hả? sao cứ refresh trang nó lại về trung tâm" (docs/town.md §7 "Moving about").
//
// Which map (the town or Westbay), the point, the way they faced, and the camera's turn and zoom. Written sparingly:
// when the player has moved half a tile or the camera has turned or zoomed, at most every 2 s; at once on `pagehide` /
// a hidden page and when the page closes. A spot in a room, a staged talk, a seat or on the water is never written
// (the stage's streetSpot is null then), so the last street spot before it stays. Put back only when it is still good
// in the world as it is then (engine/sim.ts spotFits): nothing stored is trusted.

import { useEffect, useRef, type RefObject } from 'react';
import { KEYS, loadJSON, saveJSON } from '../../core/storage';
import type { TownStageHandle } from './engine/stage';

export type SpotMap = 'town' | 'city';

export interface TownSpot {
  map: SpotMap;
  x: number;
  y: number;
  /** The way the player faced (radians on the grid). */
  heading: number;
  /** The camera's turn round the player (radians) and the learner's zoom (cameraRig ZOOM_MIN … ZOOM_MAX). */
  yaw: number;
  zoom: number;
  /** When it was written (epoch ms). */
  at: number;
}

/** Far enough from the last write to write again (tiles). */
export const SPOT_MOVE = 0.5;
/** At most one write in this long while walking (ms). */
export const SPOT_EVERY_MS = 2000;

const finite = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Anything stored → a spot, or null when any part is missing or of the wrong kind (then the usual start). */
export function parseTownSpot(raw: unknown): TownSpot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.map !== 'town' && r.map !== 'city') return null;
  if (!finite(r.x, 0, 500) || !finite(r.y, 0, 500) || !finite(r.heading, -100, 100) || !finite(r.yaw, -1e4, 1e4) || !finite(r.zoom, 0.05, 20) || !finite(r.at, 0, 1e14)) return null;
  return { map: r.map, x: r.x, y: r.y, heading: r.heading, yaw: r.yaw, zoom: r.zoom, at: r.at };
}

export function readTownSpot(): TownSpot | null {
  return parseTownSpot(loadJSON<unknown>(KEYS.townSpot, null));
}

export function writeTownSpot(spot: TownSpot): void {
  saveJSON(KEYS.townSpot, spot);
}

/**
 * Address parameters that say nothing about where on the map to stand: the dev renderer switch, and ?at=city (which
 * map: a reload in Westbay comes back to its spot there; a bus ride up arrives at the terminal all the same, because
 * the last spot written was then the town's).
 */
const NEUTRAL = new Set(['r', 'at']);

/**
 * The address says where to be or what to open (?talk, ?build, ?activity, ?listen, ?from, ?with …): then it wins and no
 * remembered spot is put back. A bare #/town or #/town?at=city (the menu, a reload) puts it back.
 */
export function addressDecides(params: Readonly<Record<string, string>>): boolean {
  return Object.keys(params).some((k) => !NEUTRAL.has(k));
}

/** The spot to put back on this map, when the address leaves it open. */
export function spotToRestore(params: Readonly<Record<string, string>>, map: SpotMap): TownSpot | null {
  if (addressDecides(params)) return null;
  const s = readTownSpot();
  return s && s.map === map ? s : null;
}

/** A bare #/town whose last spot was in Westbay opens Westbay again (no bus ride). */
export function opensCity(params: Readonly<Record<string, string>>): boolean {
  return !addressDecides(params) && readTownSpot()?.map === 'city';
}

/** Whether `now` is worth a write after `last` (moved, turned or zoomed). */
export function spotChanged(last: TownSpot | null, now: Omit<TownSpot, 'at'>): boolean {
  if (!last || last.map !== now.map) return true;
  return Math.hypot(now.x - last.x, now.y - last.y) >= SPOT_MOVE || Math.abs(now.yaw - last.yaw) > 0.05 || Math.abs(now.zoom - last.zoom) > 0.02;
}

/**
 * Keeps the player's street spot on this map written while the page is open (see the head of this file). `on` false (no
 * world: the flat list) writes nothing.
 */
export function useSpotSaver(stage: RefObject<TownStageHandle | null>, map: SpotMap, on: boolean): void {
  const last = useRef<TownSpot | null>(null);
  const wroteAt = useRef(0);
  useEffect(() => {
    if (!on) return;
    last.current = readTownSpot();
    const take = (force: boolean) => {
      const s = stage.current?.streetSpot?.();
      if (!s) return;
      const next = { map, ...s };
      const now = Date.now();
      // the first spot on this map is written at once (back from Westbay without a step: the town is the last map)
      const newMap = last.current?.map !== map;
      if (!spotChanged(last.current, next)) return;
      if (!force && !newMap && now - wroteAt.current < SPOT_EVERY_MS) return;
      const spot: TownSpot = { ...next, at: now };
      writeTownSpot(spot);
      last.current = spot;
      wroteAt.current = now;
    };
    const tick = window.setInterval(() => take(false), 500);
    const hide = () => take(true);
    const vis = () => {
      if (document.visibilityState === 'hidden') take(true);
    };
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', vis);
    return () => {
      take(true);
      window.clearInterval(tick);
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [stage, map, on]);
}
