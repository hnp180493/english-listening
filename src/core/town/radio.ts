// Bay FM, true of the game (docs/town.md §25, docs/gta-plan.md §4.5): a bulletin Marcus reads that is MADE from the
// game's state at the moment it is heard, so what the radio says can be acted on. Pure: the real time, the day's own
// weather at any time (core/town/world.ts weatherOf, by the local day), the weekday and month, today's events and any
// news queued about the player (./radioNews) go in; a ListenScene comes out, in the same shape as a written radio
// segment (data/scenes/radio.ts), so ListenPanel / SceneFlow play it the same way: sound, the questions, the words.
//
// What it says, in order: who is on air; the time by the game's clock ("just gone quarter to eight"); the player's
// news, if any; the sky now; a forecast read off the same clock (core/town/sky.ts skyAt at future times: "expect rain
// by six this evening"), or how long it stays as it is; what is on today in the town and in Westbay; a sign-off.
// Every claim about the sky is checked against skyAt by radio.test.ts, for many times and every day's weather.
//
// The pieces Marcus says it with are data/scenes/radioLive.ts. Westbay's people speak in the browser's voice: nothing
// here is ever a shipped clip.

import { CHANGE_LEADS, CITY_EVENT_LINES, CLOCK, EVENT_Q, EVENTS_LEAD, greeting, HOUR_WORDS, IDENTS, laterVi, LIVE_INTRO, LIVE_TITLE, MINUTE_WORDS, NEWS_LEADS, partOfDayVi, SIGN_OFFS, SKY_GIST, SKY_NOW, SKY_SHORT, skyChange, STAYS, SUMMARY, THEN_LEAD, TIME_LEADS, TOWN_EVENT_LINES, WEEKDAYS, WHEN, WHEN_Q, whenWhatVi, type CityRadioEvent, type Piece } from '../../data/scenes/radioLive';
import type { ListenScene, SceneLine, SceneQuestion, Weather } from './sceneTypes';
import { GAME_DAY_MS, gameMinutes, SKIES, skyAt, type Sky } from './sky';
import { currentShift, offsetAt, type Shift } from './gameClock';
import type { TownEvent } from './world';
import { AD_LEADS, RADIO_ADS, type RadioAd, type RadioCall } from '../../data/scenes/radioCalls';
import { trafficReport, type TrafficFacts, type TrafficSnapshot } from './radioTraffic';
import { getLang, tr } from '../../i18n';

// The meanings of a bulletin are put together as it is made, so they are no dictionary keys as a whole: each piece goes
// through the interface language BEFORE it is joined or filled in (docs/i18n.md §4, as core/town/job.ts and scanner.ts
// do). In Vietnamese tr returns its text as is: not a byte changes. What is SAID never changes.
/** A meaning, or a meaning's template, as it is shown. */
const V = (vi: string): string => tr(vi);
/** A value filled into a meaning (a time, a weekday): in English its own English words. */
const W = (p: Piece): string => (getLang() === 'en' ? p.en : p.vi);
/** A whole piece with its meaning as shown. */
const M = (p: Piece): Piece => ({ en: p.en, vi: V(p.vi) });

/** Real milliseconds in a minute of the game (two seconds). */
export const GAME_MINUTE_MS = GAME_DAY_MS / (24 * 60);
/** The forecast looks this far ahead, in minutes of the game (24 real minutes). */
export const HORIZON_MIN = 12 * 60;
/** The sky is read every five minutes of the game's clock. */
const STEP_MIN = 5;

/** A bulletin's id: `fm-live-<the game's hour, counted from 1970>`, one edition an hour of the game (two real minutes). */
export const LIVE_PREFIX = 'fm-live-';
export function liveId(now: number): string {
  return LIVE_PREFIX + Math.floor(now / (GAME_MINUTE_MS * 60));
}
export function isLiveId(id: string): boolean {
  return id.startsWith(LIVE_PREFIX);
}

// ───────────────────────── small helpers ─────────────────────────

function hash(n: number): number {
  let x = (n ^ 0x2545f491) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
function pick<T>(list: readonly T[], seed: number, salt: number): T {
  return list[Math.floor(hash(seed * 31 + salt) * list.length) % list.length];
}
const fill = (s: string, vals: Record<string, string>): string => s.replace(/\{([A-Z]|[a-z])\}/g, (m, k: string) => vals[k] ?? m);
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const hourWord = (h24: number): Piece => HOUR_WORDS[((h24 % 12) + 12) % 12];

/** The game's midnight before a real time. */
function dayStart(t: number): number {
  return t - (((t % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS);
}

// ───────────────────────── times said aloud ─────────────────────────

/**
 * A time of the clock said aloud, `minutes` since the game's midnight in fives (0 … 1435): "quarter to eight" /
 * "tám giờ kém mười lăm tối" (the Vietnamese with the part of the day; midnight and midday on their own).
 */
export function spokenTime(minutes: number): Piece {
  const m = ((Math.round(minutes / 5) * 5) % 1440 + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (mm === 0 && h === 0) return CLOCK.midnight;
  if (mm === 0 && h === 12) return CLOCK.midday;
  const said = mm <= 30 ? h : (h + 1) % 24;
  const hw = hourWord(said);
  let p: Piece;
  if (mm === 0) p = { en: fill(CLOCK.oclock.en, { h: hw.en }), vi: fill(CLOCK.oclock.vi, { h: hw.vi }) };
  else if (mm === 30) p = { en: fill(CLOCK.half.en, { h: hw.en }), vi: fill(CLOCK.half.vi, { h: hw.vi }) };
  else {
    const mw = MINUTE_WORDS[mm <= 30 ? mm : 60 - mm];
    const form = mm < 30 ? CLOCK.past : CLOCK.to;
    p = { en: fill(form.en, { h: hw.en, m: mw.en }), vi: fill(form.vi, { h: hw.vi, m: mw.vi }) };
  }
  return { en: p.en, vi: `${p.vi} ${partOfDayVi(said).vi}` };
}

/**
 * A time ahead as a forecast names it, from the moment of the bulletin: a full hour of the game ("six this evening",
 * "midnight", "seven tomorrow morning"), else the clock ("quarter past six"). `at` and `now` are real times.
 */
export function whenSaid(at: number, now: number): Piece {
  // (on this machine's clock: moved on by a sleep in the hideout, ./gameClock.ts; a forecast never looks past the
  // moment it comes back, so `at` and `now` share the offset)
  const off = offsetAt(now, currentShift());
  const minutes = (at + off - dayStart(now + off)) / GAME_MINUTE_MS;
  const tomorrow = minutes >= 24 * 60;
  const m = Math.round(minutes) % (24 * 60);
  if (m % 60 !== 0) return spokenTime(m);
  const h = m / 60;
  const w = hourWord(h);
  const form =
    h === 0
      ? WHEN.midnight
      : h === 12
        ? tomorrow
          ? WHEN.middayTomorrow
          : WHEN.midday
        : h < 5
          ? WHEN.early
          : h < 12
            ? tomorrow
              ? WHEN.tomorrowMorning
              : WHEN.morning
            : h < 18
              ? tomorrow
                ? WHEN.tomorrowAfternoon
                : WHEN.afternoon
              : tomorrow
                ? WHEN.tomorrowEvening
                : h < 20
                  ? WHEN.evening
                  : WHEN.tonight;
  return { en: fill(form.en, { h: w.en }), vi: fill(form.vi, { h: w.vi }) };
}

// ───────────────────────── the forecast ─────────────────────────

/** A change of the sky the bulletin names: it reads `sky` from `seen` on, and is so by `at` (the time it says). */
export interface SkyChange {
  /** The sky before. */
  was: Sky;
  sky: Sky;
  /** The first five minutes of the clock it was seen (real ms). */
  seen: number;
  /** The time said: the full hour after `seen` when the sky is already so all the way to it, else `seen` (real ms). */
  at: number;
}

export interface Forecast {
  /** The sky now. */
  now: Sky;
  /** Up to two changes within HORIZON_MIN, in order. */
  changes: SkyChange[];
  /** No change: the sky stays as it is at least until this real time (a full hour of the game). */
  stays: number | null;
}

/**
 * The forecast at a real time, by the day's weather at any time (as the world reads it: skyAt(t, weatherAt(t))). The
 * times are named on this machine's clock (a sleep in the hideout moves it on: ./gameClock.ts), the weather is the
 * real time's; while the clock is moved on the forecast looks no further than the moment it comes back (a time named
 * across the jump back would not be the time the learner then sees). All times returned are real ms.
 */
export function forecastAt(now: number, weatherAt: (t: number) => Weather, shift: Shift | null = currentShift()): Forecast {
  const off = offsetAt(now, shift);
  const skyOf = (t: number): Sky => skyAt(t, weatherAt(t)).sky;
  const nowSky = skyOf(now);
  // the clock's marks, on the clock as shown (u = real + off); `at` gives the real time of a mark
  const start = dayStart(now + off);
  const nowMin = (now + off - start) / GAME_MINUTE_MS;
  // the marks of the clock after now: every five minutes of the game
  const first = Math.floor(nowMin / STEP_MIN) * STEP_MIN + STEP_MIN;
  const last = off > 0 && shift ? Math.min(nowMin + HORIZON_MIN, (shift.until - 1 + off - start) / GAME_MINUTE_MS) : nowMin + HORIZON_MIN;
  const at = (min: number): number => start + min * GAME_MINUTE_MS - off;
  const changes: SkyChange[] = [];
  let cur = nowSky;
  let min = first;
  while (min <= last && changes.length < 2) {
    const s = skyOf(at(min));
    if (s === cur) {
      min += STEP_MIN;
      continue;
    }
    // named by the full hour after it, when the sky is already so at every mark up to it
    const hour = Math.ceil(min / 60) * 60;
    let ok = true;
    for (let k = min + STEP_MIN; k <= hour && ok; k += STEP_MIN) ok = skyOf(at(k)) === s;
    const named = ok ? hour : min;
    changes.push({ was: cur, sky: s, seen: at(min), at: at(named) });
    cur = s;
    min = named + STEP_MIN;
  }
  const stays = changes.length === 0 ? at(Math.floor(last / 60) * 60) : null;
  return { now: nowSky, changes, stays };
}

// ───────────────────────── the bulletin ─────────────────────────

/** News about the player for the bulletin (./radioNews): Marcus's own words, each with its Vietnamese meaning. */
export interface RadioNewsItem {
  id: string;
  lines: readonly { text: string; vi: string; say?: string }[];
  /** A clue the item gives once the bulletin is heard through (data/city/clues.ts). */
  clue?: string;
}

export interface BulletinInput {
  now: number;
  /** The day's own weather at a real time (core/town/world.ts weatherOf of that local day). */
  weatherAt: (t: number) => Weather;
  /** 0 Sunday … 6 Saturday, by the learner's clock. */
  weekday: number;
  /** 1 … 12. */
  month: number;
  /** The town's get-togethers (core/town/world.ts TOWN_EVENTS). */
  townEvents: readonly TownEvent[];
  news?: readonly RadioNewsItem[];
  /** Where it is heard: the café's radio (the default) or a vehicle's. */
  place?: 'cafe' | 'car';
  /** Westbay's streets now (./radioTraffic: only while Westbay's page is open; the town has none). */
  traffic?: TrafficSnapshot | null;
  /** The sponsor's words, once the learner has bought the sponsorship (./assetsStore.ts sponsorLine), else null. */
  sponsor?: { text: string; vi: string } | null;
}

export interface Bulletin {
  scene: ListenScene;
  forecast: Forecast;
  /** The news items read in it (to be marked as aired once heard). */
  newsIds: string[];
  /** The clues it gives once heard through: its news items', and its advert's when that is a clue (data/city/clues.ts: same id). */
  clues: string[];
  /** The advert read in it (data/scenes/radioCalls.ts RADIO_ADS). */
  adId: string;
  /** What it said about Westbay's roads (./radioTraffic), or null (no traffic segment). */
  traffic: TrafficFacts | null;
}

/** Three answers in an order of the edition's own, the right one first in `options` before shuffling. */
function question(q: string, right: string, wrong: readonly [string, string], seed: number): SceneQuestion {
  const at = Math.floor(hash(seed) * 3) % 3;
  const others = [...wrong];
  const options = [0, 1, 2].map((i) => (i === at ? right : others.shift()!)) as unknown as readonly [string, string, string];
  return { q, options, answer: at };
}

/** The Vietnamese gist of the sky: now, and what it does next (or that it stays). */
function skySummary(now: Sky, next: Sky | null): string {
  const a = W(SKY_SHORT[now]);
  return next ? fill(V(SUMMARY.change.vi), { A: a, L: V(laterVi(now, next)) }) : fill(V(SUMMARY.stays.vi), { A: a });
}

/** Today's events in the city (CITY_EVENT_LINES): the weekday's, and a festival of the month. */
function cityToday(weekday: number, month: number): { day: CityRadioEvent | null; festival: CityRadioEvent | null } {
  return {
    day: CITY_EVENT_LINES.find((e) => !e.months && e.weekday === weekday) ?? null,
    festival: CITY_EVENT_LINES.find((e) => e.months?.includes(month)) ?? null,
  };
}

/**
 * The lines of a bulletin that carry nothing a question asks or a learner acts on (the greeting and ident, the leads
 * into the news and the events, the lead into the advert, the sign-off): the only ones a storm may break up
 * (core/town/skyRules.ts staticCut). The time check, the sky, the forecast, the news, the events and the advert itself
 * are never cut.
 */
const FILLER = new WeakSet<SceneLine>();
export const isRadioFiller = (line: SceneLine): boolean => FILLER.has(line);

/** The bulletin Marcus reads at a real time. */
export function bulletinAt(input: BulletinInput): Bulletin {
  const { now, weekday, month, townEvents } = input;
  const ed = Math.floor(now / (GAME_MINUTE_MS * 60));
  const hour = gameMinutes(now) / 60;
  const lines: SceneLine[] = [];
  const say = (p: Piece) => lines.push({ who: 'marcus', text: p.en, vi: p.vi });
  const filler = (p: Piece) => {
    say(p);
    FILLER.add(lines[lines.length - 1]);
  };

  // who is on air
  const g = greeting(hour);
  const id = pick(IDENTS, ed, 1);
  filler({ en: `${g.en}, ${id.en}`, vi: `${V(g.vi)}, ${V(id.vi)}` });

  // the time by the game's clock, as near as five minutes: before, on or just after the mark
  const nowMin = gameMinutes(now);
  const mark = Math.round(nowMin / 5) * 5;
  const lead = nowMin < mark - 0.5 ? TIME_LEADS.before : nowMin > mark + 0.5 ? TIME_LEADS.after : TIME_LEADS.on;
  const t = spokenTime(mark);
  const day = WEEKDAYS[((weekday % 7) + 7) % 7];
  const form = pick(lead, ed, 2);
  say({ en: fill(form.en, { T: t.en, D: day.en }), vi: cap(fill(V(form.vi), { T: W(t), D: W(day) })) });

  // the player's news
  const news = (input.news ?? []).filter((n) => n.lines.length > 0);
  if (news.length > 0) {
    filler(M(pick(NEWS_LEADS, ed, 3)));
    for (const n of news) for (const l of n.lines) lines.push({ who: 'marcus', text: l.text, vi: V(l.vi), ...(l.say ? { say: l.say } : {}) });
  }

  // the sky now and later
  const fc = forecastAt(now, input.weatherAt);
  const night = hour < 6 || hour >= 19;
  const nowLines = SKY_NOW[fc.now][night ? 'night' : 'day'];
  say(M(pick(nowLines, ed, 4)));
  fc.changes.forEach((c, i) => {
    const when = whenSaid(c.at, now);
    const ch = skyChange(c.was, c.sky);
    const en = fill(ch.en, { B: when.en });
    const vi = fill(V(ch.vi), { B: W(when) });
    if (i === 0) {
      const l = pick(CHANGE_LEADS, ed, 5);
      say({ en: `${l.en} ${en}.`, vi: cap(`${V(l.vi)} ${vi}.`) });
    } else say({ en: `${THEN_LEAD.en} ${en}.`, vi: `${V(THEN_LEAD.vi).replace(/,$/, '')}, ${vi}.` });
  });
  if (fc.stays !== null) {
    const s = pick(STAYS, ed, 6);
    const w = whenSaid(fc.stays, now);
    say({ en: fill(s.en, { B: w.en }), vi: fill(V(s.vi), { B: W(w) }) });
  }

  // Westbay's roads as they are now (./radioTraffic: only with a source, i.e. on Westbay's page)
  const traffic = trafficReport(input.traffic ?? null, ed);
  if (traffic) {
    filler(traffic.lead);
    for (const p of traffic.lines) say(p);
  }

  // what is on today: the town's get-together, the city's day (or its festival when the town has nothing)
  const town = townEvents.find((e) => e.weekday === weekday) ?? null;
  const townLine = town ? TOWN_EVENT_LINES[town.id] : undefined;
  const city = cityToday(weekday, month);
  const cityEvent = townLine ? city.day : (city.day ?? city.festival);
  const extra = !townLine && city.day && city.festival ? city.festival : null;
  const onToday = [townLine, cityEvent, extra].filter((p): p is Piece => !!p);
  if (onToday.length > 0) {
    filler(M(pick(EVENTS_LEAD, ed, 7)));
    for (const p of onToday) say(M(p));
  }

  // an advert of a real place (data/scenes/radioCalls.ts: true of it; some are clues a job may use)
  const ad = pick(RADIO_ADS, ed, 21);
  const adLead = pick(AD_LEADS, ed, 22);
  filler({ en: adLead.text, vi: V(adLead.vi) });
  // the learner's own sponsorship first, when bought (one line a sentence, when the two languages split alike)
  if (input.sponsor) {
    const en = input.sponsor.text.split(/(?<=[.?!])\s+/);
    const vi = V(input.sponsor.vi).split(/(?<=[.?!])\s+/);
    if (en.length === vi.length) en.forEach((t, i) => say({ en: t, vi: vi[i] }));
    else say({ en: input.sponsor.text, vi: V(input.sponsor.vi) });
  }
  for (const l of ad.lines) say({ en: l.text, vi: V(l.vi) });

  filler(M(pick(SIGN_OFFS, ed, 8)));

  // the questions: the sky (what was said about it), then when it changes or what is on
  const next = fc.changes[0]?.sky ?? null;
  const right = skySummary(fc.now, next);
  const candidates: { now: Sky; text: string }[] = [];
  for (const a of SKIES) for (const b of [null, ...SKIES.filter((s) => s !== a)]) candidates.push({ now: a, text: skySummary(a, b) });
  const others = candidates.filter((c) => c.text !== right);
  // two wrong answers: one with the sky now right and the rest wrong, one with the sky now wrong (both by the edition)
  const sameNow = others.filter((c) => c.now === fc.now).map((c) => c.text);
  const otherNow = others.filter((c) => c.now !== fc.now).map((c) => c.text);
  const w1 = pick(sameNow.length > 0 ? sameNow : otherNow, ed, 9);
  const w2 = pick(otherNow.filter((c) => c !== w1), ed, 10);
  const gist = question(V(SKY_GIST.q), right, [w1, w2], ed * 7 + 11);

  let detail: SceneQuestion | undefined;
  const change = fc.changes[0];
  // the roads: always in a vehicle, half the editions on a radio that stands still
  const askRoads = !!traffic && ((input.place ?? 'cafe') === 'car' || hash(ed * 19 + 23) < 0.5);
  const askWhen = change && (hash(ed * 13 + 12) < 0.6 || onToday.length === 0);
  if (askRoads && traffic) detail = traffic.question;
  else if (change && askWhen) {
    const r = W(whenSaid(change.at, now));
    const six = 6 * 60 * GAME_MINUTE_MS;
    const d1 = W(whenSaid(change.at + six, now));
    const back = change.at - six;
    const d2 = W(back > now ? whenSaid(back, now) : whenSaid(change.at + 2 * six, now));
    detail = question(fill(V(WHEN_Q.q), { L: V(whenWhatVi(change.was, change.sky)) }), r, [d1, d2], ed * 7 + 13);
  } else if (onToday.length > 0) {
    // ask about the town's get-together or the city's day, whichever was said (both: by the edition)
    const askTown = !!town && !!townLine && (!cityEvent || hash(ed * 17 + 14) < 0.5);
    if (askTown && town) {
      const wrong = townEvents.filter((e) => e.id !== town.id);
      const a = pick(wrong, ed, 15);
      const b = pick(wrong.filter((e) => e !== a), ed, 16);
      detail = question(V(EVENT_Q.town.q), V(town.name), [V(a.name), V(b.name)], ed * 7 + 17);
    } else {
      const said = cityEvent!;
      const wrong = CITY_EVENT_LINES.filter((e) => e.id !== said.id && e.id !== extra?.id && e.id !== city.festival?.id && e.id !== city.day?.id && !e.months === !said.months);
      const a = pick(wrong, ed, 18);
      const b = pick(wrong.filter((e) => e !== a), ed, 19);
      detail = question(V(EVENT_Q.city.q), V(said.name), [V(a.name), V(b.name)], ed * 7 + 19);
    }
  }

  const scene: ListenScene = {
    id: liveId(now),
    kind: 'radio',
    title: LIVE_TITLE,
    scene: LIVE_INTRO[input.place ?? 'cafe'],
    level: 2,
    lines,
    gist,
    ...(detail ? { detail } : {}),
  };
  return { scene, forecast: fc, newsIds: news.map((n) => n.id), clues: [...news.flatMap((n) => (n.clue ? [n.clue] : [])), ...(ad.clue ? [ad.id] : [])], adId: ad.id, traffic: traffic?.facts ?? null };
}

// ───────────────────────── the call-in show ─────────────────────────

/**
 * Which call of Bay FM's call-in show plays (data/scenes/radioCalls.ts): the ladder. The lowest rung that still has a
 * call not heard lately (`recent`: the scene ids heard on any of the last days), the calls of a rung in order; once all
 * were heard, round the whole show again by the edition (the game's hour). Null with no calls.
 */
export function callNow(calls: readonly RadioCall[], recent: ReadonlySet<string>, now: number): RadioCall | null {
  if (calls.length === 0) return null;
  const order = [...calls].sort((a, b) => a.level - b.level || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const fresh = order.find((c) => !recent.has(c.id));
  if (fresh) return fresh;
  const ed = Math.floor(now / (GAME_MINUTE_MS * 60));
  return order[((ed % order.length) + order.length) % order.length];
}

/** The adverts a bulletin can read (re-exported for the job engine's clues: data/scenes/radioCalls.ts RADIO_CLUE_ADS). */
export type { RadioAd };
