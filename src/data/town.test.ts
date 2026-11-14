import { describe, expect, it } from 'vitest';
import { dictationAudio } from '../features/dictation/decodeCache';
import { SENTENCES } from './sentences';
import { placeLines, placeOfLineId, TOWN_DECORATIONS, TOWN_PLACES, townDecoration, townPlace } from './town';

describe('town places', () => {
  it('one place per sentence topic and one topic per place', () => {
    const topics = [...new Set(SENTENCES.map((s) => s.topic))].sort();
    expect(TOWN_PLACES.map((p) => p.topic).sort()).toEqual(topics);
    expect(TOWN_PLACES).toHaveLength(13);
  });

  it('ids, names and residents are unique; ids are stable', () => {
    for (const f of ['id', 'name', 'resident'] as const) {
      expect(new Set(TOWN_PLACES.map((p) => p[f])).size, f).toBe(TOWN_PLACES.length);
    }
    for (const p of TOWN_PLACES) {
      expect(p.id).toMatch(/^[a-z]+$/);
      expect(townPlace(p.id)).toBe(p);
    }
    expect(townPlace('nope')).toBeUndefined();
    // stored in purchases and used by the world layout: never rename
    expect(TOWN_PLACES.map((p) => p.id)).toEqual(['square', 'cafe', 'friend', 'home', 'shop', 'office', 'school', 'station', 'clinic', 'cinema', 'phone', 'park', 'board']);
  });

  it('three places stand from the start; the other ten are lots with the listed prices', () => {
    const cost = Object.fromEntries(TOWN_PLACES.map((p) => [p.id, p.cost]));
    expect(cost).toEqual({ square: 0, cafe: 0, friend: 0, home: 20, shop: 30, office: 40, school: 50, station: 60, clinic: 70, cinema: 80, phone: 90, park: 100, board: 110 });
    expect(TOWN_PLACES.filter((p) => p.cost === 0).map((p) => p.name)).toEqual(['Quảng trường', 'Quán cà phê', 'Nhà bạn']);
  });
});

describe('town decorations', () => {
  it('the catalogue: ids, Vietnamese names and prices as listed', () => {
    expect(TOWN_DECORATIONS.map((d) => [d.id, d.name, d.cost])).toEqual([
      ['lamps1', 'Đèn đường', 10],
      ['flowers', 'Bồn hoa', 8],
      ['benches', 'Ghế đá', 12],
      ['blossom', 'Cây hoa anh đào', 15],
      ['lamps2', 'Thêm đèn đường', 15],
      ['lights', 'Dây đèn', 25],
      ['lilies', 'Hoa súng trên hồ', 20],
      ['stall', 'Quầy hàng rong', 30],
      ['fountain', 'Đài phun nước lớn', 40],
      ['balloons', 'Bóng bay', 12],
      ['flags', 'Cờ hội', 18],
      ['cat', 'Chú mèo', 35],
    ]);
  });

  it('ids are unique, storable, and never the id of a place', () => {
    const ids = TOWN_DECORATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(TOWN_DECORATIONS.map((d) => d.name)).size).toBe(ids.length);
    for (const d of TOWN_DECORATIONS) {
      expect(d.id).toMatch(/^[a-z][a-z0-9]*$/);
      expect(Number.isInteger(d.cost) && d.cost > 0).toBe(true);
      expect(townPlace(d.id)).toBeUndefined();
      expect(townDecoration(d.id)).toBe(d);
    }
    for (const p of TOWN_PLACES) expect(townDecoration(p.id)).toBeUndefined();
    expect(townDecoration('nope')).toBeUndefined();
  });
});

describe('town lines', () => {
  it('every built-in sentence is a line of exactly one place, with what its audio needs', () => {
    const all = TOWN_PLACES.flatMap((p) => placeLines(p.id));
    expect(all).toHaveLength(SENTENCES.length);
    expect(new Set(all.map((l) => l.id)).size).toBe(SENTENCES.length);
    const byId = new Map(SENTENCES.map((s) => [s.id, s]));
    for (const p of TOWN_PLACES) {
      const lines = placeLines(p.id);
      expect(lines.length, p.name).toBeGreaterThanOrEqual(15);
      expect(placeLines(p.id)).toBe(lines); // stable identity
      for (const l of lines) {
        const s = byId.get(l.id)!;
        expect(s.topic).toBe(p.topic);
        expect(l).toMatchObject({ text: s.text, vi: s.vi, level: s.level, sentenceId: s.id });
        expect(placeOfLineId(l.id)).toBe(p.id);
        // the line plays exactly what Chép chính tả plays for the sentence: its shipped clip exists
        expect(dictationAudio(l)).toEqual(dictationAudio(s));
      }
    }
    expect(placeLines('nope')).toEqual([]);
    expect(placeOfLineId('nope')).toBeUndefined();
  });

  it('the three free places hold enough lines to earn the first lot several times over', () => {
    const free = TOWN_PLACES.filter((p) => p.cost === 0).reduce((n, p) => n + placeLines(p.id).length, 0);
    expect(free).toBe(70);
  });
});
