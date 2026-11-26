// Bay FM's call-in show and adverts (./radioCalls.ts): the scene rules (as ./scenes.test.ts), the ladder, the callers'
// manners, the adverts' places and the clues' stable ids.
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../core/decoder/sapiMisread';
import { cityPerson } from '../../core/town/cityPeople';
import { bulletinAt, callNow } from '../../core/town/radio';
import { SCENE_VOICES } from '../../core/town/sceneTypes';
import { sceneKindOf, scenePay, TOWN_EVENTS } from '../../core/town/world';
import { TOWN_PLACES } from '../town';
import { AD_LEADS, RADIO_ADS, RADIO_CALLS, RADIO_CLUE_ADS } from './radioCalls';
import { LISTEN_SCENES } from './index';

const lineOk = (where: string, text: string, say?: string) => {
  expect(text, where).toBe(text.trim());
  expect(text, where).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
  expect(text, where).toMatch(/[.?!]$/);
  const n = text.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
  expect(n, where).toBeGreaterThanOrEqual(3);
  expect(n, where).toBeLessThanOrEqual(16);
  expect(decode(text).tokens.length, where).toBeGreaterThan(0);
  const said = speakableFor(text, say);
  expect(said, where).not.toMatch(SAPI_MISREAD);
  expect(said, where).not.toMatch(LONE_APOSTROPHE);
};

describe('Bay FM: the call-in show', () => {
  it('calls are radio scenes paid within the radio’s allowance, ids of their own', () => {
    for (const c of RADIO_CALLS) {
      expect(c.id).toMatch(/^fm-call-\d+$/);
      expect(c.kind).toBe('radio');
      expect(sceneKindOf(c.id)).toBe('radio');
    }
    expect(new Set(RADIO_CALLS.map((c) => c.id)).size).toBe(RADIO_CALLS.length);
    // no id shared with any written scene
    for (const s of LISTEN_SCENES) expect(RADIO_CALLS.some((c) => c.id === s.id)).toBe(false);
    // one of them paid with the written ones: the day's three radio scenes in all
    expect(scenePay({ id: 'fm-call-1', kind: 'radio' }, { right: 1, asked: 1, plays: 1 }, ['fm-1', 'fm-2', 'fm-live-9']).capped).toBe(true);
  });

  it('a short exchange with Marcus, a caller of one manner, one question; the lines speakable', () => {
    for (const c of RADIO_CALLS) {
      expect(c.lines.length, c.id).toBeGreaterThanOrEqual(4);
      expect(c.lines.length, c.id).toBeLessThanOrEqual(6);
      const who = [...new Set(c.lines.map((l) => l.who))];
      expect(who).toContain('marcus');
      const callers = who.filter((w) => w !== 'marcus');
      expect(callers.length, c.id).toBe(1);
      expect(Object.hasOwn(SCENE_VOICES, callers[0]), c.id).toBe(true);
      expect(callers[0], c.id).toMatch(/^caller-(clear|hurried|mumbling|badline)-[fm]$/);
      for (const [i, l] of c.lines.entries()) {
        lineOk(`${c.id}#${i}`, l.text, l.say);
        expect(l.vi, `${c.id}#${i}`).toMatch(/[ăâđêôơưàáạảãầấậẩẫằắặẳẵèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i);
      }
      expect(c.detail, c.id).toBeUndefined();
      expect(new Set(c.gist.options).size, c.id).toBe(3);
      const others = c.gist.options.filter((_, i) => i !== c.gist.answer).map((o) => o.length);
      expect(c.gist.options[c.gist.answer].length, c.id).toBeLessThanOrEqual(Math.max(...others) * 1.35);
    }
  });

  it('a ladder: clear callers on the first rung, hurried on the second, mumbling or a bad line on the third', () => {
    for (const c of RADIO_CALLS) {
      const caller = c.lines.find((l) => l.who !== 'marcus')!.who;
      const manner = caller.split('-')[1];
      expect(c.level === 1 ? manner === 'clear' : c.level === 2 ? manner === 'hurried' : manner === 'mumbling' || manner === 'badline', c.id).toBe(true);
    }
    for (const level of [1, 2, 3]) expect(RADIO_CALLS.filter((c) => c.level === level).length).toBeGreaterThanOrEqual(3);
    // the next call is the lowest rung not heard lately
    expect(callNow(RADIO_CALLS, new Set(), 0)!.level).toBe(1);
    const level1 = new Set(RADIO_CALLS.filter((c) => c.level === 1).map((c) => c.id));
    expect(callNow(RADIO_CALLS, level1, 0)!.level).toBe(2);
    const all = new Set(RADIO_CALLS.map((c) => c.id));
    expect(callNow(RADIO_CALLS, all, 0)).not.toBeNull();
    // the answers' places are spread
    for (const at of [0, 1, 2]) expect(RADIO_CALLS.filter((c) => c.gist.answer === at).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Bay FM: adverts', () => {
  it('each for a real place of Westbay or the town, speakable, with stable ids', () => {
    const towns = new Set(TOWN_PLACES.map((p) => p.id));
    for (const ad of RADIO_ADS) {
      expect(ad.id).toMatch(/^ad-[a-z0-9-]+$/);
      expect(towns.has(ad.place) || !!cityPerson(ad.place), ad.id).toBe(true);
      expect(ad.lines.length).toBeGreaterThanOrEqual(2);
      for (const [i, l] of ad.lines.entries()) lineOk(`${ad.id}#${i}`, l.text);
    }
    for (const [i, l] of AD_LEADS.entries()) lineOk(`lead#${i}`, l.text);
    expect(new Set(RADIO_ADS.map((a) => a.id)).size).toBe(RADIO_ADS.length);
  });

  it('three adverts are clues, by stable ids (the job engine names them as clue:<id>)', () => {
    expect([...RADIO_CLUE_ADS].sort()).toEqual(['ad-bo', 'ad-twin-ovens', 'ad-wheel']);
  });

  it('a bulletin reads one advert, before the sign-off', () => {
    const seen = new Set<string>();
    for (let k = 0; k < 60; k++) {
      const now = 1_800_000_000_000 + k * 2 * 60 * 1000;
      const b = bulletinAt({ now, weatherAt: () => 'clear', weekday: 3, month: 5, townEvents: TOWN_EVENTS });
      const ad = RADIO_ADS.find((a) => a.id === b.adId)!;
      const texts = b.scene.lines.map((l) => l.text);
      expect(texts).toContain(ad.lines[0].text);
      expect(texts.indexOf(ad.lines[ad.lines.length - 1].text)).toBe(texts.length - 2);
      seen.add(ad.id);
    }
    expect(seen.size).toBeGreaterThan(RADIO_ADS.length / 2);
  });
});
