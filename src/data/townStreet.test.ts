import { describe, expect, it } from 'vitest';
import { TOWN_PLACES } from './town';
import { RESIDENT_ARCS } from './stories';
import { STREET_CLOSE, STREET_FRIENDLY, STREET_MEETS, streetInvite, streetScene } from './townStreet';

const facts = new Map(RESIDENT_ARCS.flatMap((a) => a.facts.map((f) => [f.id, a.placeId] as const)));
const nobody = () => false;

describe('meeting a resident in the street (docs/town.md §14)', () => {
  it('every resident has scenes for each closeness and some built on what you learned about them', () => {
    for (const p of TOWN_PLACES) {
      const m = STREET_MEETS[p.id];
      expect(m, p.id).toBeDefined();
      expect(m.stranger.length, p.id).toBeGreaterThanOrEqual(2);
      expect(m.friendly.length, p.id).toBeGreaterThanOrEqual(2);
      expect(m.close.length, p.id).toBeGreaterThanOrEqual(2);
      expect(m.known.length, p.id).toBeGreaterThanOrEqual(2);
      // a fact this very resident's arc teaches
      for (const k of m.known) expect(facts.get(k.fact), k.fact).toBe(p.id);
    }
    expect(Object.keys(STREET_MEETS).sort()).toEqual(TOWN_PLACES.map((p) => p.id).sort());
  });

  it('the scenes are one Vietnamese sentence each, true anywhere in the town', () => {
    const all = Object.values(STREET_MEETS).flatMap((m) => [...m.stranger, ...m.friendly, ...m.close, ...m.known.map((k) => k.scene)]);
    for (const s of all) {
      expect(s, s).toMatch(/\.$/);
      expect(s.length, s).toBeLessThan(90);
      // never inside a room or a building (a street scene)
      expect(s, s).not.toMatch(/đứng trong|ngồi trong|sau quầy|trong lớp/);
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it('a stranger, a friend and a close friend are met differently', () => {
    const m = STREET_MEETS.school;
    for (let seed = 1; seed < 8; seed += 2) {
      expect(m.stranger).toContain(streetScene('school', 0, nobody, seed));
      expect(m.friendly).toContain(streetScene('school', STREET_FRIENDLY, nobody, seed));
      expect(m.close).toContain(streetScene('school', STREET_CLOSE, nobody, seed));
    }
  });

  it('something you learned about them shows up (half the meetings), never something you did not', () => {
    const knowsHoney = (f: string) => f === 'school:loves-honey';
    const scenes = new Set(Array.from({ length: 12 }, (_, i) => streetScene('school', 0, knowsHoney, i)));
    expect(scenes.has('Thầy Daniel cầm hũ mật ong vừa mua: trà tối nay có rồi.')).toBe(true);
    for (const s of scenes) expect(s).not.toMatch(/tiểu thuyết|câu lạc bộ/);
    expect(streetScene('moon', 0, nobody, 0)).toBeNull();
  });

  it('they ask you round to where the story goes on', () => {
    expect(streetInvite('Daniel', 'nhà trọ', false)).toBe('Daniel dặn lúc nào rảnh thì ghé nhà trọ: có chuyện muốn kể với bạn.');
    expect(streetInvite('Emma', 'quán cà phê', true)).toContain('kể lại chuyện hôm trước');
  });
});
