// Bay FM's generated bulletins (./radio): every claim about the sky agrees with skyAt at the times it names, every
// bulletin reads as a whole, the questions are answered by the same state, today's events are the data's.
import { afterEach, describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../decoder/sapiMisread';
import { CITY_EVENTS } from '../../data/city/events';
import { CITY_EVENT_LINES, TOWN_EVENT_LINES } from '../../data/scenes/radioLive';
import { bulletinAt, forecastAt, GAME_MINUTE_MS, HORIZON_MIN, isLiveId, liveId, spokenTime, whenSaid, type BulletinInput } from './radio';
import { clearRadioNews, markRadioNewsAired, pendingRadioNews, queueRadioNews } from './radioNews';
import { radioHeard, radioScene, resetRadioTurns } from './radioStore';
import { sceneKindOf, scenePay, TOWN_EVENTS } from './world';
import type { Weather } from './sceneTypes';
import { GAME_DAY_MS, gameMinutes, skyAt } from './sky';

const WEATHERS: readonly Weather[] = ['clear', 'cloudy', 'rain'];
/** A day's weather that changes every 7 real hours (not on a stretch of the sky): the local midnight's jump. */
const shifting = (t: number): Weather => WEATHERS[Math.floor(t / (7 * 3600 * 1000)) % 3];
const weatherFns: [string, (t: number) => Weather][] = [...WEATHERS.map((w): [string, (t: number) => Weather] => [w, () => w]), ['shifting', shifting]];

/** Times spread over a few real weeks, not on any grid. */
function times(n: number): number[] {
  const out: number[] = [];
  let t = Date.UTC(2026, 10, 2, 3, 17, 41);
  for (let i = 0; i < n; i++) {
    t += 3_700_000 + ((i * 7919) % 1_300_000) + 777;
    out.push(t);
  }
  return out;
}

const input = (now: number, weatherAt: (t: number) => Weather, extra: Partial<BulletinInput> = {}): BulletinInput => ({
  now,
  weatherAt,
  weekday: new Date(now).getDay(),
  month: new Date(now).getMonth() + 1,
  townEvents: TOWN_EVENTS,
  ...extra,
});

afterEach(() => {
  clearRadioNews();
  resetRadioTurns();
});

describe('Bay FM: the forecast agrees with the sky', () => {
  it('says the sky now, every named change is so at the time it names, and nothing changes before it is seen', () => {
    let named = 0;
    let stayed = 0;
    for (const [name, wAt] of weatherFns) {
      const skyOf = (t: number) => skyAt(t, wAt(t)).sky;
      for (const now of times(100)) {
        const fc = forecastAt(now, wAt);
        const where = `${name} @${now}`;
        expect(fc.now, where).toBe(skyOf(now));
        let from = now;
        let sky = fc.now;
        for (const c of fc.changes) {
          expect(c.was, where).toBe(sky);
          expect(c.sky, where).not.toBe(c.was);
          expect(c.at, where).toBeGreaterThan(from);
          expect(c.at, where).toBeGreaterThanOrEqual(c.seen);
          expect(c.at - c.seen, where).toBeLessThan(60 * GAME_MINUTE_MS);
          // so at the time said, and from when it was seen up to it
          expect(skyOf(c.at), `${where}: at the time said`).toBe(c.sky);
          for (let t = c.seen; t <= c.at; t += GAME_MINUTE_MS) expect(skyOf(t), `${where}: on the way to the time said`).toBe(c.sky);
          // and as it was before, every game minute until five minutes of the clock before it was seen
          for (let t = from + GAME_MINUTE_MS; t <= c.seen - 5 * GAME_MINUTE_MS; t += GAME_MINUTE_MS) expect(skyOf(t), `${where}: unchanged before`).toBe(sky);
          from = c.at;
          sky = c.sky;
          named++;
        }
        if (fc.stays !== null) {
          stayed++;
          expect(fc.changes).toEqual([]);
          expect(fc.stays - now, where).toBeGreaterThan((HORIZON_MIN - 60) * GAME_MINUTE_MS);
          for (let t = now; t <= fc.stays; t += GAME_MINUTE_MS) expect(skyOf(t), `${where}: stays`).toBe(fc.now);
        } else expect(fc.changes.length, where).toBeGreaterThan(0);
      }
    }
    // both kinds of forecast happen
    expect(named).toBeGreaterThan(60);
    expect(stayed).toBeGreaterThan(10);
  }, 120_000);

  it('the line read out names the same time as the forecast, and the "when" question is answered by it', () => {
    let asked = 0;
    for (const [, wAt] of weatherFns) {
      for (const now of times(120)) {
        const b = bulletinAt(input(now, wAt));
        const text = b.scene.lines.map((l) => l.text).join(' ');
        for (const c of b.forecast.changes) expect(text).toContain(`by ${whenSaid(c.at, now).en}`);
        if (b.forecast.stays !== null) expect(text).toContain(whenSaid(b.forecast.stays, now).en);
        const d = b.scene.detail;
        if (d?.q.startsWith('Theo Marcus, mấy giờ')) {
          asked++;
          expect(d.options[d.answer]).toBe(whenSaid(b.forecast.changes[0].at, now).vi);
        }
      }
    }
    expect(asked).toBeGreaterThan(40);
  }, 120_000);
});

describe('Bay FM: times said aloud', () => {
  it('every five minutes of the clock has its spoken form', () => {
    expect(spokenTime(7 * 60 + 45)).toEqual({ en: 'quarter to eight', vi: 'tám giờ kém mười lăm sáng' });
    expect(spokenTime(19 * 60 + 45)).toEqual({ en: 'quarter to eight', vi: 'tám giờ kém mười lăm tối' });
    expect(spokenTime(7 * 60 + 15)).toEqual({ en: 'quarter past seven', vi: 'bảy giờ mười lăm sáng' });
    expect(spokenTime(18 * 60 + 30)).toEqual({ en: 'half past six', vi: 'sáu giờ rưỡi tối' });
    expect(spokenTime(13 * 60 + 40)).toEqual({ en: 'twenty to two', vi: 'hai giờ kém hai mươi chiều' });
    expect(spokenTime(9 * 60)).toEqual({ en: "nine o'clock", vi: 'chín giờ sáng' });
    expect(spokenTime(0).en).toBe('midnight');
    expect(spokenTime(12 * 60).en).toBe('midday');
    expect(spokenTime(23 * 60 + 55).en).toBe('five to twelve');
    const seen = new Set<string>();
    for (let m = 0; m < 1440; m += 5) {
      const p = spokenTime(m);
      expect(p.en).not.toMatch(/undefined|\{|\}/);
      expect(p.vi).not.toMatch(/undefined|\{|\}/);
      seen.add(p.en + '|' + p.vi);
    }
    expect(seen.size).toBe(288);
  });

  it('a time ahead: the part of the day, and "tomorrow" past the game\'s midnight', () => {
    const day0 = Math.floor(Date.UTC(2026, 10, 26) / GAME_DAY_MS) * GAME_DAY_MS;
    const at = (h: number) => day0 + h * 60 * GAME_MINUTE_MS;
    const now = at(14.2);
    expect(whenSaid(at(18), now).en).toBe('six this evening');
    expect(whenSaid(at(21), now).en).toBe('nine tonight');
    expect(whenSaid(at(24), now).en).toBe('midnight');
    expect(whenSaid(at(26), now).en).toBe('two in the morning');
    expect(whenSaid(at(30), now)).toEqual({ en: 'six tomorrow morning', vi: 'sáu giờ sáng mai' });
    expect(whenSaid(at(36), now).en).toBe('midday tomorrow');
    expect(whenSaid(at(16.25), now).en).toBe('quarter past four');
  });

  it('the time check is by the game clock: before, on or just after the five minutes it names', () => {
    for (const now of times(200)) {
      const b = bulletinAt(input(now, () => 'clear'));
      const line = b.scene.lines[1].text;
      const m = gameMinutes(now);
      const mark = Math.round(m / 5) * 5;
      expect(line).toContain(spokenTime(mark).en);
      if (m < mark - 0.5) expect(line).toMatch(/coming up to|nearly/);
      else if (m > mark + 0.5) expect(line).toMatch(/just gone|just after/);
      else expect(line).not.toMatch(/coming up to|nearly|just gone|just after/);
    }
  });
});

describe('Bay FM: every bulletin reads as a whole', () => {
  it('no empty slot, plain English that decodes and is safe to speak, Vietnamese meanings, three different answers', () => {
    const positions = [0, 0, 0];
    for (const [, wAt] of weatherFns) {
      for (const now of times(40)) {
        const s = bulletinAt(input(now, wAt)).scene;
        expect(isLiveId(s.id)).toBe(true);
        expect(s.id).toBe(liveId(now));
        expect(s.id).toMatch(/^[a-z][a-z0-9-]{0,39}$/);
        expect(sceneKindOf(s.id)).toBe('radio');
        expect(s.lines.length).toBeGreaterThanOrEqual(6);
        for (const l of s.lines) {
          const where = `${s.id}: ${l.text}`;
          expect(l.who).toBe('marcus');
          for (const x of [l.text, l.vi]) {
            expect(x, where).toBe(x.trim());
            expect(x, where).not.toMatch(/undefined|null|NaN|\{|\}|\s{2,}/);
          }
          expect(l.text, where).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
          expect(l.text, where).toMatch(/^[A-Z].*[.?!]$/);
          const words = l.text.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
          expect(words, where).toBeGreaterThanOrEqual(3);
          expect(words, where).toBeLessThanOrEqual(16);
          expect(decode(l.text).tokens.length, where).toBeGreaterThan(0);
          const sent = speakableFor(l.text, l.say);
          expect(sent, where).not.toMatch(SAPI_MISREAD);
          expect(sent, where).not.toMatch(LONE_APOSTROPHE);
          expect(l.vi, where).toMatch(/^[A-ZÀ-Ỹ\p{Lu}]/u);
        }
        for (const q of [s.gist, ...(s.detail ? [s.detail] : [])]) {
          expect(q.q).not.toMatch(/undefined|\{|\}/);
          expect(new Set(q.options).size, `${s.id}: ${q.options.join(' / ')}`).toBe(3);
          for (const o of q.options) expect(o).not.toMatch(/undefined|\{|\}|^$/);
          expect([0, 1, 2]).toContain(q.answer);
          positions[q.answer]++;
        }
      }
    }
    // the right answer is not always in the same place
    const all = positions.reduce((a, b) => a + b, 0);
    for (const p of positions) expect(p).toBeGreaterThan(all / 6);
  }, 120_000);

  it('the gist is the sky said, now and next', () => {
    for (const now of times(120)) {
      const b = bulletinAt(input(now, () => 'cloudy'));
      const right = b.scene.gist.options[b.scene.gist.answer];
      const short = { clear: 'quang', cloudy: 'nhiều mây', rain: 'mưa', storm: 'có giông' }[b.forecast.now];
      expect(right.startsWith(`Trời ${short},`)).toBe(true);
      expect(right.includes('lát nữa')).toBe(b.forecast.changes.length > 0);
    }
  });
});

describe('Bay FM: what is on today', () => {
  it('names the town\'s get-together of the weekday and the city\'s day or festival, and asks about one of them', () => {
    const base = Date.UTC(2026, 0, 4, 9);
    for (let month = 1; month <= 12; month++) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const now = base + (month - 1) * 30 * 86400000 + weekday * 86400000;
        const b = bulletinAt(input(now, () => 'clear', { weekday, month }));
        const text = b.scene.lines.map((l) => l.text).join(' ');
        const town = TOWN_EVENTS.find((e) => e.weekday === weekday);
        if (town) expect(text, `${town.id}`).toContain(TOWN_EVENT_LINES[town.id].en);
        const cityDay = CITY_EVENT_LINES.find((e) => e.weekday === weekday)!;
        const fest = CITY_EVENT_LINES.find((e) => e.months?.includes(month))!;
        expect(text.includes(cityDay.en) || (!town && text.includes(fest.en))).toBe(true);
        // nothing that is not on today
        for (const e of TOWN_EVENTS) if (e !== town) expect(text).not.toContain(TOWN_EVENT_LINES[e.id].en);
        for (const e of CITY_EVENT_LINES) if (e !== cityDay && e !== fest) expect(text).not.toContain(e.en);
        const d = b.scene.detail;
        if (d && d.q.includes('có gì')) {
          const right = d.options[d.answer];
          const ok = (town && right === town.name) || right === cityDay.name || right === fest.name;
          expect(ok, `${weekday}/${month}: ${right}`).toBe(true);
          // the wrong answers are not on today
          for (const [i, o] of d.options.entries()) if (i !== d.answer) expect([town?.name, cityDay.name, fest.name]).not.toContain(o);
        }
      }
    }
  });

  it('every town get-together has a line, and the city\'s days agree with data/city/events.ts', () => {
    for (const e of TOWN_EVENTS) expect(TOWN_EVENT_LINES[e.id], e.id).toBeDefined();
    expect(CITY_EVENT_LINES.map((e) => e.id).sort()).toEqual(CITY_EVENTS.map((e) => e.id).sort());
    for (const e of CITY_EVENTS) {
      const mine = CITY_EVENT_LINES.find((x) => x.id === e.id)!;
      expect(mine.name, e.id).toBe(e.name);
      expect(mine.weekday, e.id).toBe(e.weekday);
      expect(mine.months, e.id).toEqual(e.months);
    }
  });
});

describe('Bay FM: news about the player, and the turns', () => {
  const item = { id: 'job-test', lines: [{ text: 'A tape reached this studio tonight.', vi: 'Tối nay có một cuộn băng tới phòng thu.' }] };

  it('a queued item is read after the time check, once, and is forgotten when it has aired or expired', () => {
    const now = times(1)[0];
    expect(queueRadioNews(item, now)).toBe(true);
    expect(queueRadioNews({ id: '', lines: item.lines }, now)).toBe(false);
    expect(queueRadioNews({ id: 'empty', lines: [] }, now)).toBe(false);
    const b = bulletinAt(input(now, () => 'clear', { news: pendingRadioNews(now) }));
    expect(b.newsIds).toEqual(['job-test']);
    expect(b.scene.lines.map((l) => l.text)).toContain('A tape reached this studio tonight.');
    markRadioNewsAired(b.newsIds);
    expect(pendingRadioNews(now)).toEqual([]);
    queueRadioNews({ ...item, until: now + 1000 }, now);
    expect(pendingRadioNews(now + 2000)).toEqual([]);
  });

  it('the radio takes turns with the call-in show and the written segments, always the bulletin while news waits, and a heard bulletin airs its news', () => {
    const now = times(1)[0];
    const written = { id: 'fm-1' } as never;
    const order = [0, 1, 2, 3, 4, 5].map(() => radioScene(now, 'cafe', () => written)!.id);
    // a bulletin, a call of the call-in show, a written segment, and round again
    expect(order.map((id) => (isLiveId(id) ? 'live' : id.startsWith('fm-call-') ? 'call' : 'written'))).toEqual(['live', 'call', 'written', 'live', 'call', 'written']);
    queueRadioNews(item, now);
    const s = radioScene(now, 'car', () => written)!;
    expect(isLiveId(s.id)).toBe(true);
    expect(s.scene).toBe('Bạn bật radio trên xe, Bay FM đang phát.');
    radioHeard(s.id);
    expect(pendingRadioNews(now)).toEqual([]);
  });

  it('pays as a radio segment: within the day\'s allowance shared with the written ones, one edition once', () => {
    const now = times(1)[0];
    const id = liveId(now);
    const r = { right: 2, asked: 2, plays: 1 };
    expect(scenePay({ id, kind: 'radio' }, r, []).xu).toBe(4);
    expect(scenePay({ id, kind: 'radio' }, r, [id]).xu).toBe(0);
    expect(scenePay({ id, kind: 'radio' }, r, ['fm-1', 'fm-2', 'fm-live-1']).capped).toBe(true);
  });
});
