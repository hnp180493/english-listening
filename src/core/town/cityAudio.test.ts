// The voice rule of Westbay (owner, 2026-11-25: "nhân vật cũ vẫn xài giọng gemini, nhân vật mới có thể xài giọng
// trình duyệt"; asked again the same day "vẫn đảm bảo rule … đúng không?"): checked for every line the city plays.
import { describe, expect, it } from 'vitest';
import { CITY_CHAPTERS, CITY_EVENT_SCENES, CITY_OUTINGS, CITY_OVERHEARD, CITY_SCENES } from '../../data/city';
import { SUITORS } from '../../data/romance';
import { RIDE_SCENES } from '../../data/scenes/rides';
import { CITY_SHIFTS } from '../../data/city/shifts';
import { buildAudioInventory, defaultInventoryContent } from '../audioInventory';
import { cityLineText, cityLinePlayback } from './cityAudio';
import { cityPerson } from './cityPeople';
import { CAST_VOICES, KID_VOICES } from './voices';

const isTown = (w: string) => w !== 'player' && Object.hasOwn(CAST_VOICES, w);

describe('the city: old residents in their Gemini voice, new people in the browser’s', () => {
  it('somebody of the city: the browser’s voice, both buttons', () => {
    const line = { who: 'rico', text: "Hey, you're Sam's friend, right?", vi: 'x' };
    expect(cityLinePlayback(line, 1).options).toMatchObject({ mode: 'connected', browserOnly: true });
    expect(cityLinePlayback(line, 1, true).options).toMatchObject({ mode: 'careful', browserOnly: true });
  });

  it('a town resident: their own Gemini voice for "Nghe"; the careful version in the browser’s', () => {
    const line = { who: 'station', text: 'I never know what to say to her.', vi: 'x' };
    const p = cityLinePlayback(line, 2);
    expect(p.options.voice).toEqual(CAST_VOICES.station);
    expect(p.options.browserOnly).toBeFalsy();
    expect(cityLinePlayback(line, 2, true).options).toMatchObject({ mode: 'careful', browserOnly: true });
  });

  it("an outing: the partner in that resident's own voice, the child in a child's voice", () => {
    const partner = { who: 'partner', text: 'This is the best table in the place.', vi: 'x' };
    const kid = { who: 'kid', text: 'Can I have the bear with the raisin nose?', vi: 'x' };
    for (const s of SUITORS) {
      const p = cityLinePlayback(partner, 1, false, { partner: s.placeId });
      expect(p.options.voice, s.placeId).toEqual(CAST_VOICES[s.placeId]);
      expect(p.options.browserOnly, s.placeId).toBeFalsy();
    }
    expect(cityLinePlayback(kid, 1, false, { kid: 'boy' }).options.voice).toEqual(KID_VOICES.boy);
    expect(cityLinePlayback(kid, 1, false, { kid: 'girl' }).options.voice).toEqual(KID_VOICES.girl);
    expect(cityLinePlayback(partner, 1, true, { partner: 'cafe' }).options).toMatchObject({ mode: 'careful', browserOnly: true });
  });

  it('the clip list has every old resident’s line of the city in their voice, and nothing of the new people', () => {
    const inv = buildAudioInventory(defaultInventoryContent());
    const has = new Set(inv.clips.map((c) => `${c.voice ?? ''}|${c.text}`));
    const missing: string[] = [];
    // episodes, talks, visits, the long stories' chapters
    for (const s of [...CITY_SCENES, ...CITY_CHAPTERS]) {
      for (const l of s.lines) if (isTown(l.who) && !has.has(`${CAST_VOICES[l.who].voice}|${cityLineText(l, s.level)}`)) missing.push(`${s.id} ${l.who}`);
    }
    // outings: every partner line in every courtable resident's voice, every child's line in both
    for (const s of CITY_OUTINGS) {
      for (const l of s.lines) {
        const voices = l.who === 'partner' ? SUITORS.map((x) => CAST_VOICES[x.placeId].voice) : l.who === 'kid' ? [KID_VOICES.boy.voice, KID_VOICES.girl.voice] : [];
        for (const v of voices) if (!has.has(`${v}|${cityLineText(l, s.level)}`)) missing.push(`${s.id} ${l.who} ${v}`);
      }
    }
    expect(missing).toEqual([]);
    // nothing said by somebody of the city, a passenger, a loudspeaker or a shift's caller has a clip
    const newTexts = new Set<string>();
    for (const s of [...CITY_SCENES, ...CITY_CHAPTERS, ...CITY_OUTINGS]) for (const l of s.lines) if (cityPerson(l.who) || !isTown(l.who) && l.who !== 'partner' && l.who !== 'kid') newTexts.add(cityLineText(l, s.level));
    for (const s of [...CITY_OVERHEARD, ...RIDE_SCENES, ...CITY_EVENT_SCENES]) for (const l of s.lines) newTexts.add(cityLineText(l, s.level));
    for (const sh of CITY_SHIFTS) for (const o of sh.orders) newTexts.add(o.text);
    const clipped = inv.clips.filter((c) => c.source === 'town' && newTexts.has(c.text) && !c.refs.some((r) => !r.startsWith('town:c')));
    expect(clipped.map((c) => c.ref)).toEqual([]);
  });

  it('the get-togethers and festivals are "cảnh nghe": the browser’s voice for everybody, old residents too', () => {
    // (owner, on the town's own get-togethers: "nghe cho vui … bỏ ra đi khỏi tốn token")
    const inv = buildAudioInventory(defaultInventoryContent());
    expect(inv.clips.filter((c) => c.refs.some((r) => r.includes(':ce-'))).length).toBe(0);
    expect(CITY_EVENT_SCENES.some((s) => s.lines.some((l) => isTown(l.who)))).toBe(true);
  });
});
