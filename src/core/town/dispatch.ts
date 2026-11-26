// "Văn phòng điều xe" (docs/town.md §27, docs/gta-plan.md §4.4): Rico's dispatch office in the old harbour gatehouse,
// where the learner answers phone two. A caller SAYS, once and in one breath, where they are and where they want to
// go; the learner taps the pickup and the destination on a map of Westbay and gives the job to one of Rico's three
// cars. The world answers: the car drives there; a wrong pickup means "nobody here" and the caller rings back,
// annoyed, and repeats the one thing that was wrong; a wrong destination is found out at the end of the ride. Both
// rejoin: never a dead end. Bayline, listening in, now and then gets to a caller first when they were left waiting.
//
// Pure: the shift is a value, advanced by `tick` with the seconds gone by; car routes come from a function the caller
// gives (features/town/dispatch uses the city's streets, core/town/dispatchRoads.ts; the tests use straight lines).
// IO (pay, review cards, Bay FM news) is ./dispatchStore.ts. Content: data/city/dispatch/.
//
// Every number here is a guess, to be tuned once the owner has played it.

import type { Level } from '../types';

/** How the caller talks: a speed and a manner of the browser's voice (features/town/dispatch/dispatchVoice.ts). */
export type Manner = 'clear' | 'hurried' | 'mumbling' | 'badline';
export const MANNERS: readonly Manner[] = ['clear', 'hurried', 'mumbling', 'badline'];

export interface DispatchCall {
  /** Stable id `dc-<n>`: a review card `talk:disp-dc-<n>` may point at it. Never change it. */
  id: string;
  level: Level;
  /** The browser voice that says it (callers are nobody we know: never a clip). */
  gender: 'male' | 'female';
  manner: Manner;
  /** What the caller says, in one breath: where they are, where to, sometimes more. */
  text: string;
  /** Natural Vietnamese meaning. */
  vi: string;
  /** Authored connected spelling, when the decoder's own would be wrong. */
  say?: string;
  /** What they say when asked to say it again: the two places, shorter (and its meaning). */
  again: { text: string; vi: string };
  /** The pickup and the destination (place ids of data/city/dispatch/places.ts). */
  from: string;
  to: string;
  /** What a careless ear takes instead (a sound-alike or the place next door: data/city/dispatch/places.ts). */
  fromNear: string;
  toNear: string;
}

export type DriverId = 'rico' | 'tess' | 'theo';
export const DRIVERS: readonly DriverId[] = ['rico', 'tess', 'theo'];

export interface Pt {
  x: number;
  y: number;
}

/** A car's route from one point to another, the last point being the target (straight lines in the tests). */
export type RouteFn = (from: Pt, to: Pt) => readonly Pt[];

// ───────────────────────── the numbers (guesses) ─────────────────────────

/** Calls in a shift. */
export const SHIFT_CALLS = 8;
/** When each call starts ringing, seconds into the shift: slow at first, two or three at once near the end. */
export const CALL_TIMES: readonly number[] = [0, 26, 52, 76, 96, 112, 124, 134];
/** A call left ringing this long may go to Bayline. */
export const RING_LIMIT = 35;
/** A call answered and heard, left without a car this long, may go to Bayline. */
export const DECIDE_LIMIT = 70;
/** The share of a limit after which the phone warns that a Bayline car is about. */
export const BAYLINE_WARN = 0.7;
/** At most this many calls go to Bayline in a shift: the story's hook, not a punishment. */
export const STOLEN_MAX = 2;
/** The caller rings back this long after the driver found nobody. */
export const CALLBACK_DELAY = 4;
/** "Xin nhắc lại" a caller takes without a sigh; the next one makes them cross. */
export const PATIENCE = 2;
/** At most this many repeats (the caller has said it four times by then). */
export const ASKS_MAX = 3;
/** Tiles a second on the map. */
export const CAR_SPEED = 6;
/** Seconds to get somebody in or out. */
export const STOP_SECONDS = 1.5;
/** A car this many seconds behind the quickest still counts as the near one. */
export const NEAR_SLACK = 8;

/** A call dispatched right the first time. */
export const DISPATCH_XU = 2;
/** …and heard once (no "Xin nhắc lại"). */
export const DISPATCH_FIRST_XU = 1;
/** A call that needed a second go (a wrong pickup or destination): the fare, no tip. */
export const DISPATCH_FIX_XU = 1;
/** Shifts that pay in a day (the rest still play, for nothing): at most 2 × 8 × 3 = 48 xu, like Rico's taxi fares. */
export const DISPATCH_SHIFTS_A_DAY = 2;

// ───────────────────────── the shift ─────────────────────────

export type CallState =
  /** Not ringing yet. */
  | 'waiting'
  | 'ringing'
  /** On the line: being heard, then the learner picks. */
  | 'line'
  /** A car is on its way to the pickup. */
  | 'sent'
  /** The driver found nobody: the caller rings again at `ringAt`. */
  | 'callback'
  /** On board. */
  | 'riding'
  | 'done'
  | 'stolen';

export interface ShiftCall {
  call: DispatchCall;
  state: CallState;
  /** When it rings (seconds into the shift); for a callback, when it rings again. */
  ringAt: number;
  /** When the caller finished saying it (the clock for Bayline then runs from here). */
  heardAt: number | null;
  /** "Xin nhắc lại" (and the shared replay keys): each one counted. */
  asks: number;
  /** The first pickup / destination sent: what the learner heard. */
  firstFrom: string | null;
  firstTo: string | null;
  /** What was sent last (a callback keeps the destination and asks for the pickup again). */
  from: string | null;
  to: string | null;
  car: DriverId | null;
  /** The car sent was the near one (null until sent). */
  near: boolean | null;
  /** The caller ran out of patience with repeats. */
  cross: boolean;
  /** Times the caller rang back after a wrong pickup. */
  callbacks: number;
  /** The destination turned out wrong at the end of the ride. */
  dropWrong: boolean;
  /** Seconds the caller waited for the car (rang → picked up), once picked up. */
  waited: number | null;
}

export type LegKind = 'pickup' | 'drop';
export interface Leg {
  call: string;
  kind: LegKind;
  /** The place the car drives to (what the learner said, or the right place once found out). */
  place: string;
}

export interface Car {
  id: DriverId;
  at: Pt;
  /** The points still to drive through on the current leg (empty: at the leg's place, or idle). */
  route: Pt[];
  legs: Leg[];
  /** Seconds still stopped (getting somebody in or out). */
  stop: number;
}

export interface Shift {
  t: number;
  calls: ShiftCall[];
  cars: Car[];
  stolen: number;
}

export type ShiftEvent =
  | { kind: 'ring'; call: string; callback: boolean }
  | { kind: 'board'; call: string; car: DriverId; place: string }
  | { kind: 'nobody'; call: string; car: DriverId; place: string; right: string }
  | { kind: 'drop'; call: string; car: DriverId; place: string }
  | { kind: 'wrongDrop'; call: string; car: DriverId; place: string; right: string }
  | { kind: 'stolen'; call: string; place: string };

/** Where each place's door is (map tiles), and where each car starts. */
export interface ShiftMap {
  doors: Readonly<Record<string, Pt>>;
  start: Readonly<Record<DriverId, Pt>>;
}

export function startShift(calls: readonly DispatchCall[], map: ShiftMap): Shift {
  return {
    t: 0,
    stolen: 0,
    calls: calls.map((call, i) => ({
      call,
      state: 'waiting',
      ringAt: CALL_TIMES[Math.min(i, CALL_TIMES.length - 1)] + Math.max(0, i - CALL_TIMES.length + 1) * 10,
      heardAt: null,
      asks: 0,
      firstFrom: null,
      firstTo: null,
      from: null,
      to: null,
      car: null,
      near: null,
      cross: false,
      callbacks: 0,
      dropWrong: false,
      waited: null,
    })),
    cars: DRIVERS.map((id) => ({ id, at: { ...map.start[id] }, route: [], legs: [], stop: 0 })),
  };
}

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The length of a route from `from` through its points (tiles). */
export function routeLength(from: Pt, route: readonly Pt[]): number {
  let n = 0;
  let p = from;
  for (const q of route) {
    n += dist(p, q);
    p = q;
  }
  return n;
}

/**
 * Seconds until `car` could be at `pickup`: what is left of its current leg, every leg it still has (each with a stop),
 * then the drive to the pickup. A busy car can be given a job: it goes once it is done.
 */
export function etaSeconds(car: Car, pickup: Pt, doors: Readonly<Record<string, Pt>>, route: RouteFn): number {
  let s = car.stop;
  let at = car.at;
  if (car.route.length > 0) {
    s += routeLength(at, car.route) / CAR_SPEED;
    at = car.route[car.route.length - 1];
  }
  car.legs.forEach((leg, i) => {
    const to = doors[leg.place];
    if (!to) return;
    if (i > 0 || car.route.length === 0) {
      s += routeLength(at, route(at, to)) / CAR_SPEED;
      at = to;
    }
    s += STOP_SECONDS;
  });
  return s + routeLength(at, route(at, pickup)) / CAR_SPEED;
}

/** The car that could be at the pickup first, and every car's time (seconds). */
export function nearestCar(cars: readonly Car[], pickup: Pt, doors: Readonly<Record<string, Pt>>, route: RouteFn): { best: DriverId; eta: Record<DriverId, number> } {
  const eta = {} as Record<DriverId, number>;
  let best: DriverId = cars[0].id;
  for (const c of cars) {
    eta[c.id] = etaSeconds(c, pickup, doors, route);
    if (eta[c.id] < eta[best]) best = c.id;
  }
  return { best, eta };
}

/** Sending `chosen`, was it the near one (within NEAR_SLACK of the quickest)? */
export function isNear(eta: Readonly<Record<DriverId, number>>, chosen: DriverId): boolean {
  const best = Math.min(...Object.values(eta));
  return eta[chosen] <= best + NEAR_SLACK;
}

/**
 * Bayline's rule (pure, fair, light): a caller left waiting goes to Bayline once the wait passes its limit, as long as
 * Bayline has not had STOLEN_MAX calls this shift already. A callback (the caller we already let down once) never goes:
 * one consequence per mistake.
 */
export function goesToBayline(waited: number, limit: number, stolenSoFar: number): boolean {
  return waited > limit && stolenSoFar < STOLEN_MAX;
}

/** How close a waiting call is to its limit, 0..1 (the phone warns from BAYLINE_WARN), or null when it cannot go. */
export function baylineShare(c: ShiftCall, t: number, stolenSoFar: number): number | null {
  if (stolenSoFar >= STOLEN_MAX || c.callbacks > 0) return null;
  if (c.state === 'ringing') return Math.max(0, Math.min(1, (t - c.ringAt) / RING_LIMIT));
  if (c.state === 'line' && c.heardAt !== null) return Math.max(0, Math.min(1, (t - c.heardAt) / DECIDE_LIMIT));
  return null;
}

/** The calls ringing now (a callback first, then the one that has rung longest). */
export function ringingNow(s: Shift): number[] {
  return s.calls
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.state === 'ringing')
    .sort((a, b) => b.c.callbacks - a.c.callbacks || a.c.ringAt - b.c.ringAt)
    .map(({ i }) => i);
}

/** The call on the line, if any. */
export function onLine(s: Shift): number | null {
  const i = s.calls.findIndex((c) => c.state === 'line');
  return i >= 0 ? i : null;
}

const upd = (s: Shift, i: number, patch: Partial<ShiftCall>): Shift => ({ ...s, calls: s.calls.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

/** Pick up a ringing call (one on the line at a time). */
export function answer(s: Shift, i: number): Shift {
  if (s.calls[i]?.state !== 'ringing' || onLine(s) !== null) return s;
  return upd(s, i, { state: 'line', heardAt: null });
}

/** The caller finished saying it (the first time; a repeat does not reset Bayline's clock). */
export function heard(s: Shift, i: number): Shift {
  const c = s.calls[i];
  if (c?.state !== 'line' || c.heardAt !== null) return s;
  return upd(s, i, { heardAt: s.t });
}

/** "Xin nhắc lại": counted; past PATIENCE the caller is cross. False when no more repeats are given. */
export function askAgain(s: Shift, i: number): { shift: Shift; ok: boolean; cross: boolean } {
  const c = s.calls[i];
  if (c?.state !== 'line' || c.asks >= ASKS_MAX) return { shift: s, ok: false, cross: false };
  const asks = c.asks + 1;
  const cross = asks > PATIENCE;
  return { shift: upd(s, i, { asks, cross: c.cross || cross }), ok: true, cross: cross && !c.cross };
}

/**
 * Send a car. `from` / `to` = the places the learner tapped (a callback keeps its destination). On the second try at
 * a pickup the caller stays on the phone and talks the driver in, so the car goes to the right place whatever was
 * tapped (never a dead end); what was tapped still counts in the debrief.
 */
export function send(s: Shift, i: number, pick: { from: string; to: string; car: DriverId }, doors: Readonly<Record<string, Pt>>, route: RouteFn): Shift {
  const c = s.calls[i];
  if (c?.state !== 'line' || !doors[pick.from] || !doors[pick.to]) return s;
  const carIdx = s.cars.findIndex((k) => k.id === pick.car);
  if (carIdx < 0) return s;
  const second = c.callbacks > 0;
  const pickupAt = second ? c.call.from : pick.from;
  const dest = second && c.to ? c.to : pick.to;
  const { eta } = nearestCar(s.cars, doors[pickupAt], doors, route);
  const legs: Leg[] = [
    { call: c.call.id, kind: 'pickup', place: pickupAt },
    { call: c.call.id, kind: 'drop', place: dest },
  ];
  const cars = s.cars.map((k, j) => (j === carIdx ? begin({ ...k, legs: [...k.legs, ...legs] }, doors, route) : k));
  return {
    ...s,
    cars,
    calls: s.calls.map((x, j) =>
      j === i
        ? {
            ...x,
            state: 'sent',
            firstFrom: x.firstFrom ?? pick.from,
            firstTo: x.firstTo ?? pick.to,
            from: pick.from,
            to: dest,
            car: pick.car,
            near: x.near === null ? isNear(eta, pick.car) : x.near,
          }
        : x,
    ),
  };
}

/** A car with no route and legs to go sets off on its first leg. */
function begin(car: Car, doors: Readonly<Record<string, Pt>>, route: RouteFn): Car {
  if (car.route.length > 0 || car.legs.length === 0 || car.stop > 0) return car;
  const to = doors[car.legs[0].place];
  if (!to) return car;
  const way = route(car.at, to);
  return { ...car, route: way.length > 0 ? [...way] : [to] };
}

/** Move a car `dt` seconds along its route; true when it reached the end of a leg's route this step. */
function drive(car: Car, dt: number): { car: Car; arrived: boolean } {
  if (car.stop > 0) return { car: { ...car, stop: Math.max(0, car.stop - dt) }, arrived: false };
  if (car.route.length === 0) return { car, arrived: false };
  let left = CAR_SPEED * dt;
  let at = car.at;
  const route = [...car.route];
  while (route.length > 0 && left > 0) {
    const d = dist(at, route[0]);
    if (d <= left) {
      left -= d;
      at = route.shift()!;
    } else {
      const k = left / d;
      at = { x: at.x + (route[0].x - at.x) * k, y: at.y + (route[0].y - at.y) * k };
      left = 0;
    }
  }
  return { car: { ...car, at, route }, arrived: route.length === 0 };
}

/** Advance the shift by `dt` seconds: calls ring, Bayline takes the ones left too long, cars drive, arrive, report. */
export function tick(s0: Shift, dt: number, doors: Readonly<Record<string, Pt>>, route: RouteFn): { shift: Shift; events: ShiftEvent[] } {
  const events: ShiftEvent[] = [];
  const t = s0.t + Math.max(0, dt);
  let stolen = s0.stolen;
  let calls = s0.calls.map((c): ShiftCall => {
    if ((c.state === 'waiting' || c.state === 'callback') && t >= c.ringAt) {
      events.push({ kind: 'ring', call: c.call.id, callback: c.state === 'callback' });
      return { ...c, state: 'ringing' };
    }
    if (c.callbacks === 0 && c.state === 'ringing' && goesToBayline(t - c.ringAt, RING_LIMIT, stolen)) {
      stolen++;
      events.push({ kind: 'stolen', call: c.call.id, place: c.call.from });
      return { ...c, state: 'stolen' };
    }
    if (c.callbacks === 0 && c.state === 'line' && c.heardAt !== null && goesToBayline(t - c.heardAt, DECIDE_LIMIT, stolen)) {
      stolen++;
      events.push({ kind: 'stolen', call: c.call.id, place: c.call.from });
      return { ...c, state: 'stolen' };
    }
    return c;
  });
  const byId = (id: string) => calls.findIndex((c) => c.call.id === id);
  const cars = s0.cars.map((car0) => {
    let { car, arrived } = drive(car0, dt);
    if (!arrived || car.legs.length === 0) return begin(car, doors, route);
    const [leg, ...rest] = car.legs;
    const ci = byId(leg.call);
    const c = calls[ci];
    car = { ...car, legs: rest };
    if (!c || c.state === 'stolen') return begin(car, doors, route);
    if (leg.kind === 'pickup') {
      if (leg.place === c.call.from) {
        events.push({ kind: 'board', call: c.call.id, car: car.id, place: leg.place });
        calls = calls.map((x, j) => (j === ci ? { ...x, state: 'riding', waited: t - x.ringAt } : x));
        car = { ...car, stop: STOP_SECONDS };
      } else {
        // nobody there: the drop leg goes too, and the caller rings back
        events.push({ kind: 'nobody', call: c.call.id, car: car.id, place: leg.place, right: c.call.from });
        car = { ...car, legs: car.legs.filter((l) => l.call !== c.call.id) };
        calls = calls.map((x, j) => (j === ci ? { ...x, state: 'callback', ringAt: t + CALLBACK_DELAY, callbacks: x.callbacks + 1, heardAt: null } : x));
      }
    } else if (leg.place === c.call.to) {
      events.push({ kind: 'drop', call: c.call.id, car: car.id, place: leg.place });
      calls = calls.map((x, j) => (j === ci ? { ...x, state: 'done' } : x));
      car = { ...car, stop: STOP_SECONDS };
    } else {
      // the wrong door: found out now, and the car takes them on (first, before anything else)
      events.push({ kind: 'wrongDrop', call: c.call.id, car: car.id, place: leg.place, right: c.call.to });
      calls = calls.map((x, j) => (j === ci ? { ...x, dropWrong: true, to: c.call.to } : x));
      car = { ...car, legs: [{ call: c.call.id, kind: 'drop', place: c.call.to }, ...car.legs], stop: STOP_SECONDS };
    }
    return car;
  });
  return { shift: { t, calls, cars: cars.map((c) => begin(c, doors, route)), stolen }, events };
}

/** Every call is done or went to Bayline. */
export function shiftOver(s: Shift): boolean {
  return s.calls.every((c) => c.state === 'done' || c.state === 'stolen');
}

// ───────────────────────── the end of a shift ─────────────────────────

export interface CallResult {
  id: string;
  /** Answered and its places heard (a stolen call before it was answered was never heard). */
  answered: boolean;
  stolen: boolean;
  /** Sent right the first time and never asked again: "nghe 1 lần là đúng", honestly. */
  once: boolean;
  asks: number;
  fromWrong: boolean;
  toWrong: boolean;
  /** The near car was sent (null: never sent). */
  near: boolean | null;
  cross: boolean;
  xu: number;
}

/** What one call pays, before the day's allowance. */
export function callXu(c: ShiftCall): number {
  if (c.state !== 'done') return 0;
  const fromWrong = c.firstFrom !== null && c.firstFrom !== c.call.from;
  const toWrong = c.firstTo !== null && c.firstTo !== c.call.to;
  if (fromWrong || toWrong) return DISPATCH_FIX_XU;
  const tip = c.asks === 0 ? DISPATCH_FIRST_XU : 0;
  // a far car or a cross caller: no tip
  return DISPATCH_XU + (c.near === false || c.cross ? 0 : tip);
}

export function callResult(c: ShiftCall): CallResult {
  const fromWrong = c.firstFrom !== null && c.firstFrom !== c.call.from;
  const toWrong = c.firstTo !== null && c.firstTo !== c.call.to;
  const answered = c.firstFrom !== null;
  return {
    id: c.call.id,
    answered,
    stolen: c.state === 'stolen',
    once: answered && !fromWrong && !toWrong && c.asks === 0,
    asks: c.asks,
    fromWrong,
    toWrong,
    near: c.near,
    cross: c.cross,
    xu: callXu(c),
  };
}

export interface ShiftSummary {
  results: CallResult[];
  /** Sent right the first time (with or without a repeat). */
  right: number;
  once: number;
  repeated: number;
  wrong: number;
  stolen: number;
  xu: number;
}

export function summarize(s: Shift): ShiftSummary {
  const results = s.calls.map(callResult);
  return {
    results,
    right: results.filter((r) => r.answered && !r.stolen && !r.fromWrong && !r.toWrong).length,
    once: results.filter((r) => r.once).length,
    repeated: results.filter((r) => r.asks > 0).length,
    wrong: results.filter((r) => r.fromWrong || r.toWrong).length,
    stolen: results.filter((r) => r.stolen).length,
    xu: results.reduce((n, r) => n + r.xu, 0),
  };
}

/** The ids of the daily set `heard` (town-progress) a paid shift leaves: `dp-shift-1`, `dp-shift-2`. */
export const shiftPaidId = (n: number): string => `dp-shift-${n}`;

/** What the shift pays given the shifts already paid today (on every browser), and the id it leaves. */
export function shiftPay(xu: number, paidToday: readonly string[]): { xu: number; capped: boolean; id: string | null } {
  const paid = paidToday.filter((id) => id.startsWith('dp-shift-')).length;
  if (paid >= DISPATCH_SHIFTS_A_DAY) return { xu: 0, capped: true, id: null };
  return { xu: Math.max(0, xu), capped: false, id: shiftPaidId(paid + 1) };
}

/** Bay FM's view of the shift: a good night, a bad one, or nothing to say. */
export function shiftNews(sum: Pick<ShiftSummary, 'right' | 'wrong' | 'stolen'>, calls: number = SHIFT_CALLS): 'good' | 'bad' | null {
  if (sum.right >= Math.ceil(calls * 0.75) && sum.stolen <= 1) return 'good';
  if (sum.wrong + sum.stolen >= Math.ceil(calls / 2)) return 'bad';
  return null;
}

/** Review refs of the calls whose places were heard wrong: they become `talk:disp-<id>` cards. */
export function missedRefs(sum: ShiftSummary): string[] {
  return sum.results.filter((r) => r.fromWrong || r.toWrong).map((r) => dispatchRef(r.id));
}
export const dispatchRef = (callId: string): string => `disp-${callId}`;

// ───────────────────────── which calls ─────────────────────────

/**
 * The calls of a shift: three plain, three natural, two hard (by level), each level's own by `seed`, calls not heard
 * in the last shifts first; easier first, and no two in a row from the same pickup.
 */
export function pickShiftCalls(all: readonly DispatchCall[], recent: ReadonlySet<string>, seed: number): DispatchCall[] {
  let r = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  const rnd = () => (r = (r * 48271) % 2147483647) / 2147483647;
  const take = (level: number, n: number): DispatchCall[] => {
    const pool = all.filter((c) => c.level === level);
    const fresh = pool.filter((c) => !recent.has(c.id));
    const order = (list: DispatchCall[]) => list.map((c) => ({ c, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.c);
    return [...order(fresh), ...order(pool.filter((c) => recent.has(c.id)))].slice(0, n);
  };
  const out = [...take(1, 3), ...take(2, 3), ...take(3, 2)];
  // no two in a row from the same pickup (swap with the next that differs)
  for (let i = 1; i < out.length; i++) {
    if (out[i].from !== out[i - 1].from) continue;
    const j = out.findIndex((c, k) => k > i && c.from !== out[i - 1].from);
    if (j > 0) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
