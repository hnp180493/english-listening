// A shift at Rico's dispatch office, played (core/town/dispatch.ts is the rules; this is the clock, the voices and
// what the learner tapped). The shift is a value advanced ten times a second; a hidden tab or a slow frame advances it
// at most half a second, so the clock stands still while nobody is looking. What happens in the world (a driver's
// report, a caller ringing back, Bayline) is said on the radio and logged for the words at the end.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  answer,
  askAgain,
  DRIVERS,
  heard,
  missedRefs,
  onLine,
  pickShiftCalls,
  send,
  shiftOver,
  startShift,
  summarize,
  tick,
  type DriverId,
  type Pt,
  type RouteFn,
  type Shift,
  type ShiftEvent,
  type ShiftSummary,
} from '../../../core/town/dispatch';
import { makeRoutes } from '../../../core/town/dispatchRoads';
import { endShift, type ShiftEnd } from '../../../core/town/dispatchStore';
import { tl, tr } from '../../../i18n';
import { CITY_PLACES, CITY_ROWS } from '../../../data/cityWorld';
import { CALLBACK_LINES, CROSS_LINES, DISPATCH_CALLS, DISPATCH_PLACES, DRIVER_LINES, OPEN_LINES, STOLEN_LINES, fillDispatchLine, type DispatchLine } from '../../../data/city/dispatch';
import { placeEn, placeVi } from '../../../data/city/dispatch/names';
import { playSfx } from '../sfx';
import { hush, sayCaller, sayDriver } from './dispatchVoice';

/** Where each place's door is (tile centres), and where the three cars start. */
export const DOORS: Readonly<Record<string, Pt>> = Object.fromEntries(
  CITY_PLACES.filter((p) => DISPATCH_PLACES.some((d) => d.id === (p.id as string))).map((p) => [p.id as string, { x: p.door.x + 0.5, y: p.door.y + 0.5 }]),
);
const doorOf = (id: string): Pt => {
  const p = CITY_PLACES.find((x) => (x.id as string) === id)!;
  return { x: p.door.x + 0.5, y: p.door.y + 0.5 };
};
/** Rico at the gatehouse (beside Gus's hut), Tess by her cart on the terminal plaza, Theo on Market Street by Nora's. */
const START: Readonly<Record<DriverId, Pt>> = { rico: doorOf('gus'), tess: doorOf('tess'), theo: doorOf('nora') };
export const DRIVER_NAME: Readonly<Record<DriverId, string>> = { rico: 'Rico', tess: 'Tess', theo: 'Theo' };

let routes: RouteFn | null = null;
export const cityRoutes = (): RouteFn => (routes ??= makeRoutes(CITY_ROWS));

/** The calls of the last shifts this session (not offered again first). */
const recent = new Set<string>();

export interface LoggedLine {
  key: number;
  who: DriverId | 'caller';
  /** The call it belongs to (a caller's words), if any. */
  call?: string;
  text: string;
  vi: string;
  /** What it was: the call itself, a repeat, a callback, a radio report. */
  kind: 'call' | 'again' | 'callback' | 'cross' | 'radio';
}

export type Slot = 'from' | 'to' | 'car';
export interface Pick {
  from: string | null;
  to: string | null;
  car: DriverId | null;
}

export interface DispatchRun {
  phase: 'intro' | 'shift' | 'debrief';
  shift: Shift | null;
  pick: Pick;
  slot: Slot;
  /** A caller is speaking now. */
  talking: boolean;
  /** The latest thing that happened, in Vietnamese (for the screen; the words are in the log). */
  feed: string | null;
  log: LoggedLine[];
  summary: ShiftSummary | null;
  end: ShiftEnd | null;
}

const EMPTY: Pick = { from: null, to: null, car: null };

export function useDispatchShift(sound: boolean) {
  const [run, setRun] = useState<DispatchRun>({ phase: 'intro', shift: null, pick: EMPTY, slot: 'from', talking: false, feed: null, log: [], summary: null, end: null });
  const ref = useRef(run);
  ref.current = run;
  const keys = useRef(0);
  const turn = useRef(0);
  const set = useCallback((patch: Partial<DispatchRun> | ((r: DispatchRun) => Partial<DispatchRun>)) => {
    setRun((r) => {
      const next = { ...r, ...(typeof patch === 'function' ? patch(r) : patch) };
      ref.current = next;
      return next;
    });
  }, []);
  const logLine = useCallback((l: Omit<LoggedLine, 'key'>) => set((r) => ({ log: [...r.log, { ...l, key: ++keys.current }] })), [set]);
  const nth = <T,>(list: readonly T[]): T => list[turn.current++ % list.length];

  const radio = useCallback(
    (who: DriverId, line: DispatchLine, en: { place?: string; right?: string }, vi: { place?: string; right?: string }) => {
      const f = fillDispatchLine(line, en, vi);
      logLine({ who, text: f.text, vi: f.vi, kind: 'radio' });
      void sayDriver(who, f.text);
    },
    [logLine],
  );

  /** What the world did this tick: said on the radio, shown in a line. */
  const onEvent = useCallback(
    (e: ShiftEvent) => {
      if (e.kind === 'ring') {
        playSfx('pop', sound);
        if (e.callback) set({ feed: 'Máy số hai: khách gọi lại.' });
        return;
      }
      if (e.kind === 'stolen') {
        playSfx('wrong', sound);
        radio('rico', nth(STOLEN_LINES), { place: placeEn(e.place) }, { place: placeVi(e.place) });
        set({ feed: tl`Bayline đón mất khách ở ${tr(placeVi(e.place))}.` });
        return;
      }
      const name = DRIVER_NAME[e.car];
      const lines = DRIVER_LINES[e.car];
      if (e.kind === 'board') {
        radio(e.car, nth(lines.board), {}, {});
        set({ feed: tl`${name} đã đón khách ở ${tr(placeVi(e.place))}.` });
      } else if (e.kind === 'nobody') {
        playSfx('wrong', sound);
        radio(e.car, nth(lines.nobody), { place: placeEn(e.place) }, { place: placeVi(e.place) });
        set({ feed: tl`${name}: không có ai ở ${tr(placeVi(e.place))}.` });
      } else if (e.kind === 'drop') {
        playSfx('right', sound);
        radio(e.car, nth(lines.drop), { place: placeEn(e.place) }, { place: placeVi(e.place) });
        set({ feed: tl`${name} đã thả khách ở ${tr(placeVi(e.place))}.` });
      } else {
        playSfx('wrong', sound);
        radio(e.car, nth(lines.wrongDrop), { place: placeEn(e.place), right: placeEn(e.right) }, { place: placeVi(e.place), right: placeVi(e.right) });
        set({ feed: tl`${name}: khách muốn tới ${tr(placeVi(e.right))} cơ.` });
      }
    },
    [radio, set, sound],
  );

  // the clock
  useEffect(() => {
    if (run.phase !== 'shift') return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      const r = ref.current;
      if (!r.shift) return;
      const before = r.shift.calls.map((c) => c.state);
      const { shift, events } = tick(r.shift, dt, DOORS, cityRoutes());
      // the call on the line went to Bayline: the line is free again
      const lost = before.some((st, i) => st === 'line' && shift.calls[i].state === 'stolen');
      if (lost) hush();
      set(lost ? { shift, pick: EMPTY, slot: 'from', talking: false } : { shift });
      events.forEach(onEvent);
    }, 100);
    return () => window.clearInterval(id);
  }, [run.phase, set, onEvent]);

  // over: the debrief (pay, review cards, Bay FM)
  useEffect(() => {
    if (run.phase !== 'shift' || !run.shift || !shiftOver(run.shift)) return;
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.phase, run.shift]);

  const start = useCallback(() => {
    hush();
    const calls = pickShiftCalls(DISPATCH_CALLS, recent, Date.now());
    if (recent.size > 24) recent.clear();
    for (const c of calls) recent.add(c.id);
    turn.current = Math.floor(Date.now() / 1000) % 7;
    const open = nth(OPEN_LINES);
    set({ phase: 'shift', shift: startShift(calls, { doors: DOORS, start: START }), pick: EMPTY, slot: 'from', talking: false, feed: null, log: [], summary: null, end: null });
    logLine({ who: 'rico', text: open.text, vi: open.vi, kind: 'radio' });
    void sayDriver('rico', open.text);
  }, [set, logLine]);

  const finish = useCallback(() => {
    const s = ref.current.shift;
    if (!s) return;
    hush();
    // a shift ended early: what was not dealt with is left out, not counted against the learner
    const played: Shift = { ...s, calls: s.calls.filter((c) => c.state === 'done' || c.state === 'stolen' || c.firstFrom !== null) };
    const summary = summarize(played);
    const end = endShift(summary, missedRefs(summary));
    if (end.xu > 0) playSfx('coin', sound);
    set({ phase: 'debrief', shift: played, summary, end, talking: false });
  }, [set, sound]);

  /** Pick up a ringing call: the caller says it (a callback: annoyed, and only what went wrong). */
  const pickUp = useCallback(
    (i: number) => {
      const r = ref.current;
      if (!r.shift || r.talking) return;
      const s = answer(r.shift, i);
      if (s === r.shift) return;
      const c = s.calls[i];
      hush();
      const done = () => {
        const now = ref.current;
        if (now.shift && now.shift.calls[i]?.state === 'line') set({ shift: heard(now.shift, i), talking: false });
        else set({ talking: false });
      };
      if (c.callbacks > 0) {
        const line = fillDispatchLine(nth(CALLBACK_LINES), { place: placeEn(c.from ?? ''), right: placeEn(c.call.from) }, { place: placeVi(c.from ?? ''), right: placeVi(c.call.from) });
        set({ shift: s, pick: { from: null, to: c.to, car: null }, slot: 'from', talking: true, feed: null });
        logLine({ who: 'caller', call: c.call.id, text: line.text, vi: line.vi, kind: 'callback' });
        void sayCaller({ call: c.call, text: line.text }).then(done);
      } else {
        set({ shift: s, pick: EMPTY, slot: 'from', talking: true, feed: null });
        logLine({ who: 'caller', call: c.call.id, text: c.call.text, vi: c.call.vi, kind: 'call' });
        void sayCaller({ call: c.call, text: c.call.text }).then(done);
      }
    },
    [set, logLine],
  );

  /** "Xin nhắc lại": counted, slower, the caller's two places again (cross after their patience). */
  const again = useCallback(() => {
    const r = ref.current;
    const i = r.shift ? onLine(r.shift) : null;
    if (!r.shift || i === null || r.talking) return false;
    const res = askAgain(r.shift, i);
    if (!res.ok) return false;
    const c = res.shift.calls[i];
    hush();
    set({ shift: res.shift, talking: true });
    if (res.cross) {
      const x = nth(CROSS_LINES);
      logLine({ who: 'caller', call: c.call.id, text: x.text, vi: x.vi, kind: 'cross' });
      void sayCaller({ call: c.call, text: x.text });
    }
    logLine({ who: 'caller', call: c.call.id, text: c.call.again.text, vi: c.call.again.vi, kind: 'again' });
    void sayCaller({ call: c.call, text: c.call.again.text, again: true }).then(() => set({ talking: false }));
    return true;
  }, [set, logLine]);

  /** A place or a car tapped for a slot; then the next slot still empty (from → to → car) is the one to fill. */
  const choose = useCallback(
    (slot: Slot, value: string) => {
      set((r) => {
        const pick = { ...r.pick, [slot]: value } as Pick;
        const order: Slot[] = ['from', 'to', 'car'];
        const empty = order.find((k) => pick[k] === null);
        return { pick, slot: empty ?? slot };
      });
    },
    [set],
  );

  const dispatch = useCallback(() => {
    const r = ref.current;
    const i = r.shift ? onLine(r.shift) : null;
    const { from, to, car } = r.pick;
    if (!r.shift || i === null || !from || !to || !car) return;
    hush();
    const s = send(r.shift, i, { from, to, car }, DOORS, cityRoutes());
    if (s === r.shift) return;
    playSfx('task', sound);
    set({ shift: s, pick: EMPTY, slot: 'from', talking: false, feed: tl`Đã gửi ${DRIVER_NAME[car]}.` });
  }, [set, sound]);

  const leave = useCallback(() => {
    hush();
    set({ phase: 'intro', shift: null, pick: EMPTY, slot: 'from', talking: false, feed: null, summary: null, end: null });
  }, [set]);

  useEffect(() => () => hush(), []);
  // dev builds only: what a script needs to play a shift (scripts/town-shot.mjs --js2)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __dispatch?: unknown }).__dispatch = { run: () => ref.current };
    return () => {
      delete (window as unknown as { __dispatch?: unknown }).__dispatch;
    };
  }, []);

  return { run, start, finish, pickUp, again, choose, setSlot: (slot: Slot) => set({ slot }), dispatch, leave, drivers: DRIVERS };
}
