import { describe, expect, it } from 'vitest';
import { KID_LINES, SUITORS, suitorsFor } from '../../data/romance';
import { TOWN_PLACES } from '../../data/town';
import { emptyTownLife, withKid, withProfile, withStep, withTalked, type TownLife } from './life';
import { CONFESS_HEARTS, PROPOSE_HEARTS, fillLine, romanceStatus, romanceSteps } from './romance';
import { townDay } from './progress';
import type { RomanceScene } from './romanceTypes';

const T = new Date(2026, 10, 22, 10).getTime();
const DAY = 86400000;
const man = (life = emptyTownLife()) => withProfile(life, { gender: 'male', name: 'Phước', skin: '#f6d3b8', hair: 'short', hairColor: '#3b2a22' }, T);
const woman = () => withProfile(emptyTownLife(), { gender: 'female', name: 'Lan', skin: '#f6d3b8', hair: 'long', hairColor: '#3b2a22' }, T);
const facts = (hearts: number, bouquets = 0, rings = 0) => ({ hearts, bouquets, rings });

describe('who courts whom (owner, 2026-11-22: by the character chosen)', () => {
  it('a man courts the six women (Zoe too, owner 2026-11-24), a woman the five men; Max and Grace are nobody\'s', () => {
    expect(suitorsFor('male').map((s) => s.placeId).sort()).toEqual(['cafe', 'cinema', 'clinic', 'friend', 'office', 'park']);
    expect(suitorsFor('female').map((s) => s.placeId).sort()).toEqual(['board', 'school', 'shop', 'square', 'station']);
    expect(romanceSteps(man(), 'cinema', facts(10, 1), T)[0]).toMatchObject({ kind: 'confess' });
    expect(romanceSteps(man(), 'phone', facts(10, 1), T)).toEqual([]);
    expect(romanceSteps(man(), 'home', facts(10, 1), T)).toEqual([]);
    expect(romanceSteps(woman(), 'cafe', facts(10, 1), T)).toEqual([]);
    // no character yet: nothing
    expect(romanceSteps(emptyTownLife(), 'cafe', facts(10, 1), T)).toEqual([]);
  });
});

describe('the way to a wedding', () => {
  it('confess at 8 hearts with a bouquet', () => {
    expect(romanceSteps(man(), 'cafe', facts(CONFESS_HEARTS - 1, 1), T)[0]).toMatchObject({ kind: 'confess', ready: false, need: 'Cần 8 tim (đang 7)' });
    expect(romanceSteps(man(), 'cafe', facts(CONFESS_HEARTS, 0), T)[0]).toMatchObject({ ready: false, need: 'Cần một bó hoa (Tiệm quà)' });
    expect(romanceSteps(man(), 'cafe', facts(CONFESS_HEARTS, 1), T)[0]).toMatchObject({ kind: 'confess', ready: true, records: 'dating' });
  });

  it('three dates, one a day; then the ring at 10 hearts; the wedding the day after', () => {
    let life: TownLife = withStep(man(), 'cafe', 'dating', T);
    // the same day: wait
    expect(romanceSteps(life, 'cafe', facts(9), T + 1000)[0]).toMatchObject({ kind: 'date', ready: false });
    expect(romanceSteps(life, 'cafe', facts(9), T + DAY)[0]).toMatchObject({ kind: 'date', label: 'Hẹn hò lần 1', ready: true, records: 'date1' });
    // somebody else: nothing while courting
    expect(romanceSteps(life, 'park', facts(10, 1), T + DAY)).toEqual([]);
    life = withStep(withStep(withStep(life, 'cafe', 'date1', T + DAY), 'cafe', 'date2', T + 2 * DAY), 'cafe', 'date3', T + 3 * DAY);
    expect(romanceStatus(life, 'cafe')).toBe('Đang hẹn hò · 3/3 buổi hẹn');
    expect(romanceSteps(life, 'cafe', facts(PROPOSE_HEARTS - 1, 0, 1), T + 4 * DAY)[0]).toMatchObject({ kind: 'proposal', ready: false });
    expect(romanceSteps(life, 'cafe', facts(PROPOSE_HEARTS, 0, 0), T + 4 * DAY)[0]).toMatchObject({ need: 'Cần một chiếc nhẫn (Tiệm quà)' });
    expect(romanceSteps(life, 'cafe', facts(PROPOSE_HEARTS, 0, 1), T + 4 * DAY)[0]).toMatchObject({ kind: 'proposal', ready: true });
    life = withStep(life, 'cafe', 'engaged', T + 4 * DAY);
    expect(romanceSteps(life, 'cafe', facts(10), T + 4 * DAY + 1000)[0]).toMatchObject({ kind: 'wedding', ready: false, need: 'Đám cưới vào ngày mai' });
    expect(romanceSteps(life, 'cafe', facts(10), T + 5 * DAY)[0]).toMatchObject({ kind: 'wedding', ready: true, records: 'married' });
    life = withStep(life, 'cafe', 'married', T + 5 * DAY);
    expect(romanceStatus(life, 'cafe')).toBe('Vợ của bạn');
  });

  it('married: a talk a day, a baby after three days, each child a play a day', () => {
    let life = withStep(withStep(man(), 'cafe', 'dating', T), 'cafe', 'married', T + 5 * DAY);
    const day6 = T + 6 * DAY;
    expect(romanceSteps(life, 'cafe', facts(10), day6).map((s) => s.kind)).toEqual(['daily']);
    life = withTalked(life, townDay(day6), 'spouse');
    expect(romanceSteps(life, 'cafe', facts(10), day6)[0]).toMatchObject({ ready: false });
    const day8 = T + 8 * DAY;
    expect(romanceSteps(life, 'cafe', facts(10), day8).map((s) => s.kind)).toEqual(['daily', 'baby']);
    life = withKid(life, 'Bin', 'boy', day8)!.life;
    const steps = romanceSteps(life, 'cafe', facts(10), day8 + DAY);
    expect(steps.map((s) => s.kind)).toEqual(['daily', 'kid']);
    expect(steps[1]).toMatchObject({ label: 'Chơi với Bin', ready: true });
    expect(KID_LINES.baby).toContain(steps[1].scene);
    // another baby only once the youngest is two weeks old
    expect(romanceSteps(life, 'cafe', facts(10), day8 + 14 * DAY).map((s) => s.kind)).toContain('baby');
    expect(romanceSteps(life, 'cafe', facts(10), day8 + 14 * DAY).find((s) => s.kind === 'kid')?.scene).toBeTruthy();
  });

  it('{name} and {kid} are filled in', () => {
    expect(fillLine('Hi {name}, where is {kid}?', 'Lan', 'Bin')).toBe('Hi Lan, where is Bin?');
  });
});

describe('the scenes (data/romance)', () => {
  const scenesOf = () => [
    ...SUITORS.flatMap((s) => [s.confess, ...s.dates, s.proposal, s.vows, ...s.daily].map((scene) => ({ scene, owner: s.placeId, daily: s.daily.includes(scene) }))),
    ...[...KID_LINES.baby, ...KID_LINES.toddler, ...KID_LINES.child].map((scene) => ({ scene, owner: 'kid', daily: false })),
  ];
  const check = (scene: RomanceScene, min: number, max: number) => {
    expect(scene.lines.length, scene.id).toBeGreaterThanOrEqual(min);
    expect(scene.lines.length, scene.id).toBeLessThanOrEqual(max);
    expect(scene.title.trim(), scene.id).not.toBe('');
    expect(scene.scene.trim(), scene.id).not.toBe('');
    for (const l of scene.lines) {
      expect(l.vi.trim(), scene.id).not.toBe('');
      if (l.who === 'narr') expect(l.en, scene.id).toBeUndefined();
      else expect(l.en?.trim(), scene.id).toBeTruthy();
    }
    if (scene.choice) {
      expect(scene.choice.after, scene.id).toBeLessThan(scene.lines.length);
      expect(scene.choice.options.length, scene.id).toBeGreaterThanOrEqual(2);
      for (const o of scene.choice.options) {
        expect(o.id.startsWith(scene.id + '-'), o.id).toBe(true);
        expect(o.reply.length, o.id).toBeGreaterThanOrEqual(1);
        expect(Math.abs(o.points), o.id).toBeLessThanOrEqual(30);
      }
    }
  };

  it('every courtable resident has the whole way and lives in this town', () => {
    const ids = new Set(TOWN_PLACES.map((p) => p.id));
    expect(SUITORS).toHaveLength(11);
    for (const s of SUITORS) {
      expect(ids.has(s.placeId), s.placeId).toBe(true);
      expect(s.dates).toHaveLength(3);
      expect(s.daily.length, s.placeId).toBeGreaterThanOrEqual(8);
      expect(s.confess.id).toBe(`${s.placeId}-confess`);
      expect(s.proposal.id).toBe(`${s.placeId}-proposal`);
      expect(s.dates.map((d) => d.id)).toEqual([1, 2, 3].map((n) => `${s.placeId}-date-${n}`));
      expect(s.dates.some((d) => !!d.choice), `${s.placeId}: a date with a choice`).toBe(true);
    }
  });

  it('every scene has the right length, a meaning for each line, a unique id; no child named before there is one', () => {
    const seen = new Set<string>();
    for (const { scene, owner, daily } of scenesOf()) {
      expect(seen.has(scene.id), scene.id).toBe(false);
      seen.add(scene.id);
      if (daily) check(scene, 3, 5);
      else check(scene, 5, 9);
      if (owner !== 'kid') expect(JSON.stringify(scene), scene.id).not.toContain('{kid}');
    }
    expect(KID_LINES.baby.length).toBeGreaterThanOrEqual(6);
    expect(KID_LINES.toddler.length).toBeGreaterThanOrEqual(8);
    expect(KID_LINES.child.length).toBeGreaterThanOrEqual(10);
  });
});

describe('where each scene happens (data/romance/places)', () => {
  it('every confession, date and proposal has a spot in this town; vows are on the plaza', async () => {
    const { SCENE_SPOTS, sceneSpot } = await import('../../data/romance/places');
    const { TOWN_WORLD } = await import('../../data/townWorld');
    const districts = new Set<string>((TOWN_WORLD.districts ?? []).map((d) => d.id));
    const places = new Set(TOWN_PLACES.map((p) => p.id));
    for (const s of SUITORS) {
      for (const scene of [s.confess, ...s.dates, s.proposal]) {
        const spot = SCENE_SPOTS[scene.id];
        expect(spot, scene.id).toBeDefined();
        if (spot.kind === 'place') expect(places.has(spot.id), scene.id).toBe(true);
        if (spot.kind === 'district') expect(districts.has(spot.id), scene.id).toBe(true);
      }
      expect(sceneSpot(s.vows.id)).toEqual({ kind: 'district', id: 'plaza' });
      expect(sceneSpot(s.daily[0].id)).toBeNull();
    }
  });

  it('a date at a place still an empty lot waits for it to be built', () => {
    const life = withStep(man(), 'cafe', 'dating', T);
    // Emma's second date is at the cinema
    const two = withStep(life, 'cafe', 'date1', T + DAY);
    const notYet = romanceSteps(two, 'cafe', { ...facts(9), built: (id) => id !== 'cinema' }, T + 2 * DAY)[0];
    expect(notYet).toMatchObject({ kind: 'date', ready: false, need: 'Cần xây Rạp phim trước', spot: { kind: 'place', id: 'cinema' } });
    expect(romanceSteps(two, 'cafe', { ...facts(9), built: () => true }, T + 2 * DAY)[0]).toMatchObject({ ready: true });
  });
});
