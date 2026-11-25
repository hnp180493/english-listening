import { describe, expect, it } from 'vitest';
import { CITY_AGAIN_XU, CITY_RELISTEN_DAYS, CITY_VISITS, CITY_XU, cityDay, cityEventsOn, emptyTownCity, hearScene, mergeTownCity, nextToMeet, outingToday, parseTownCity, relistenAt, sceneNow, sceneOpen, sceneOwner, scenesWith, seasonNow, chaptersToday, visitorsNow, type TownCity } from './city';
import type { CityEvent, CityScene, CitySeason } from './cityTypes';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 25, 5);
const TOWN = new Set(['square', 'station', 'shop']);

const q = { q: 'Hỏi gì?', options: ['a', 'b', 'c'] as [string, string, string], answer: 0 };
const scene = (id: string, at: string, n: number, kind: CityScene['kind'], who: string[], needs?: string[]): CityScene => ({
  id,
  kind,
  at,
  n,
  title: id,
  scene: id,
  level: 1,
  lines: who.map((w, i) => ({ who: w, text: `Line ${i} here.`, vi: `Câu ${i}` })),
  questions: kind === 'episode' ? [q, q, q] : [q],
  ...(needs ? { needs } : {}),
});

const SCENES: CityScene[] = [
  scene('ct-rico-1', 'rico', 1, 'episode', ['rico', 'okafor']),
  scene('ct-rico-2', 'rico', 2, 'episode', ['rico', 'station'], ['ct-rico-1']),
  scene('ct-nora-1', 'nora', 1, 'episode', ['nora', 'theo'], ['ct-rico-1']),
  scene('ct-nora-2', 'nora', 2, 'episode', ['nora', 'square'], ['ct-nora-1']),
  scene('ct-tess-1', 'tess', 1, 'chat', ['tess'], ['ct-rico-1']),
  scene('cv-shop-1', 'shop', 1, 'visit', ['shop', 'tess'], ['ct-nora-1']),
];
const byId = (id: string) => SCENES.find((s) => s.id === id)!;
const heard = (city: TownCity, id: string, right: number, at: number) => hearScene(city, byId(id), { right, asked: byId(id).questions.length }, TOWN, at);

describe('city: what is stored', () => {
  it('parses what it wrote and drops what it does not know', () => {
    const city = heard(emptyTownCity(), 'ct-rico-1', 2, T0).city;
    expect(parseTownCity(JSON.parse(JSON.stringify({ ...city, first: T0 })))).toEqual({ ...city, first: T0 });
    expect(parseTownCity(null)).toEqual(emptyTownCity());
    expect(parseTownCity({ heard: { 'Bad Id': { at: 1 }, 'ct-rico-1': { at: 0 }, 'ct-nora-1': 'x', 'cv-shop-1': { at: T0, best: 99, times: 0, last: 1 } } }).heard).toEqual({
      'cv-shop-1': { at: T0, best: 9, times: 1, last: T0 },
    });
  });

  it('merges two browsers: the earlier first hearing, the higher best and count, the later last', () => {
    const a = heard(emptyTownCity(), 'ct-rico-1', 1, T0).city;
    const b = heard(heard(emptyTownCity(), 'ct-rico-1', 3, T0 + 5).city, 'ct-nora-1', 2, T0 + 9).city;
    const m = mergeTownCity({ ...a, first: T0 + 3 }, { ...b, first: T0 + 1 });
    expect(m.first).toBe(T0 + 1);
    expect(m.heard['ct-rico-1']).toEqual({ at: T0, best: 3, times: 1, last: T0 + 5 });
    expect(m.heard['ct-nora-1']).toBeDefined();
    expect(mergeTownCity(m, m)).toEqual(m);
    expect(mergeTownCity(b, a)).toEqual(mergeTownCity(a, b));
    expect(mergeTownCity(emptyTownCity(), { ...emptyTownCity(), first: T0 }).first).toBe(T0);
  });
});

describe('city: who has what to say', () => {
  it('off the bus only Rico has something; each scene heard opens the next people', () => {
    let city = emptyTownCity();
    expect(sceneNow(SCENES, 'rico', city, T0)).toMatchObject({ kind: 'new', scene: { id: 'ct-rico-1' } });
    expect(sceneNow(SCENES, 'nora', city, T0)).toMatchObject({ kind: 'locked', needs: 'ct-rico-1' });
    expect(sceneOwner('ct-rico-1')).toBe('rico');
    expect(sceneNow(SCENES, 'nobody', city, T0)).toBeNull();
    expect(sceneOpen(byId('ct-nora-1'), city)).toBe(false);
    city = heard(city, 'ct-rico-1', 3, T0).city;
    expect(sceneNow(SCENES, 'nora', city, T0)).toMatchObject({ kind: 'new', scene: { id: 'ct-nora-1' } });
    expect(sceneNow(SCENES, 'rico', city, T0)).toMatchObject({ kind: 'new', scene: { id: 'ct-rico-2' } });
    expect(sceneNow(SCENES, 'tess', city, T0)).toMatchObject({ kind: 'new' });
    expect(sceneNow(SCENES, 'shop', city, T0)).toMatchObject({ kind: 'locked', needs: 'ct-nora-1' });
  });

  it('the one to go and see: an episode before a talk, nobody who is not here, nothing when all is heard', () => {
    let city = emptyTownCity();
    const all = () => true;
    expect(nextToMeet(SCENES, city, all)?.id).toBe('ct-rico-1');
    city = heard(city, 'ct-rico-1', 3, T0).city;
    expect(nextToMeet(SCENES, city, all)?.kind).toBe('episode');
    expect(nextToMeet(SCENES, city, (at) => at === 'tess')?.id).toBe('ct-tess-1');
    for (const s of SCENES) city = heard(city, s.id, 1, T0).city;
    expect(nextToMeet(SCENES, city, all)).toBeNull();
  });

  it('a scene heard comes back after 2, 7 and 21 days, then rests', () => {
    let city = heard(emptyTownCity(), 'ct-tess-1', 1, T0).city;
    expect(relistenAt(city.heard['ct-tess-1'])).toBe(T0 + CITY_RELISTEN_DAYS[0] * DAY);
    expect(sceneNow(SCENES, 'tess', city, T0 + DAY)).toMatchObject({ kind: 'idle' });
    expect(sceneNow(SCENES, 'tess', city, T0 + 2 * DAY)).toMatchObject({ kind: 'again', scene: { id: 'ct-tess-1' } });
    let at = T0;
    for (const gap of CITY_RELISTEN_DAYS) {
      at += gap * DAY;
      city = heard(city, 'ct-tess-1', 1, at).city;
    }
    expect(city.heard['ct-tess-1'].times).toBe(1 + CITY_RELISTEN_DAYS.length);
    expect(relistenAt(city.heard['ct-tess-1'])).toBeNull();
    expect(sceneNow(SCENES, 'tess', city, at + 400 * DAY)).toMatchObject({ kind: 'idle' });
  });
});

describe('city: what a scene pays', () => {
  it('the first time: xu for each question right, and the friendship of the town residents who spoke', () => {
    const r = hearScene(emptyTownCity(), byId('ct-rico-2'), { right: 2, asked: 3 }, TOWN, T0);
    expect(r.pay).toEqual({ xu: 2 * CITY_XU, bond: ['station'], first: true });
    expect(r.city.heard['ct-rico-2']).toEqual({ at: T0, best: 2, times: 1, last: T0 });
    expect(hearScene(emptyTownCity(), byId('ct-rico-1'), { right: 9, asked: 3 }, TOWN, T0).pay.xu).toBe(3 * CITY_XU);
    expect(hearScene(emptyTownCity(), byId('ct-rico-1'), { right: 0, asked: 3 }, TOWN, T0).pay).toEqual({ xu: 0, bond: [], first: true });
  });

  it('again before it is due: nothing, and the next re-listen does not move; when due: less, and it moves', () => {
    const first = heard(emptyTownCity(), 'ct-rico-2', 1, T0).city;
    const early = hearScene(first, byId('ct-rico-2'), { right: 3, asked: 3 }, TOWN, T0 + DAY);
    expect(early.pay).toEqual({ xu: 0, bond: [], first: false });
    expect(early.city.heard['ct-rico-2']).toEqual({ at: T0, best: 3, times: 1, last: T0 });
    const due = hearScene(first, byId('ct-rico-2'), { right: 3, asked: 3 }, TOWN, T0 + 3 * DAY);
    expect(due.pay).toEqual({ xu: 3 * CITY_AGAIN_XU, bond: [], first: false });
    expect(due.city.heard['ct-rico-2']).toEqual({ at: T0, best: 3, times: 2, last: T0 + 3 * DAY });
  });
});

describe('city: who of the town is up there', () => {
  it("every weekday has its visitors; Sam's line runs every day", () => {
    for (let d = 0; d < 7; d++) {
      expect(CITY_VISITS[d].length, `day ${d}`).toBeGreaterThanOrEqual(2);
      expect(CITY_VISITS[d]).toContain('station');
    }
    expect(visitorsNow(SCENES, emptyTownCity(), 6, TOWN)).toEqual(['square', 'station']);
    expect(visitorsNow(SCENES, emptyTownCity(), -1, TOWN)).toEqual(['square', 'station']);
  });

  it('a story that needs somebody of the town brings them up on any day; a visit of their own does not', () => {
    // a Monday: Leo is not due, and nothing open needs him
    let city = heard(emptyTownCity(), 'ct-rico-1', 3, T0).city;
    expect(visitorsNow(SCENES, city, 1, TOWN)).toEqual(['station']);
    // Nora's first part heard: her second needs Leo; Ben's own visit is open too, and does not bring him
    city = heard(city, 'ct-nora-1', 3, T0).city;
    expect(visitorsNow(SCENES, city, 1, TOWN)).toEqual(['square', 'station']);
    city = heard(city, 'ct-nora-2', 3, T0).city;
    expect(visitorsNow(SCENES, city, 1, TOWN)).toEqual(['station']);
  });
});

describe('city: outings, coming up together, the long stories, the week', () => {
  const outing = (id: string, at: string, n: number, kind: 'date' | 'family'): CityScene => ({ ...scene(id, at, n, 'chat', [at, 'partner']), kind });
  const OUTINGS = [outing('cx-gianna-1', 'gianna', 1, 'date'), outing('cx-gianna-2', 'gianna', 2, 'date'), outing('cx-poppy-1', 'poppy', 1, 'family')];

  it("a host's outings take turns by the day; a family outing only with a child along", () => {
    expect(outingToday(OUTINGS, 'gianna', false, 10)?.id).toBe('cx-gianna-1');
    expect(outingToday(OUTINGS, 'gianna', false, 11)?.id).toBe('cx-gianna-2');
    // Gianna has no family outing: with a child along it is still a date there
    expect(outingToday(OUTINGS, 'gianna', true, 11)?.id).toBe('cx-gianna-2');
    expect(outingToday(OUTINGS, 'poppy', true, 3)?.id).toBe('cx-poppy-1');
    expect(outingToday(OUTINGS, 'poppy', false, 3)).toBeNull();
    expect(outingToday(OUTINGS, 'rico', true, 3)).toBeNull();
  });

  it("a resident's second visit is theirs only when they came up with the learner", () => {
    const list = [...SCENES, scene('cv-shop-2', 'shop', 2, 'visit', ['shop', 'frank'], ['cv-shop-1'])];
    expect(scenesWith(list, new Set()).some((s) => s.id === 'cv-shop-2')).toBe(false);
    expect(scenesWith(list, new Set(['shop'])).some((s) => s.id === 'cv-shop-2')).toBe(true);
    expect(scenesWith(list, new Set()).length).toBe(SCENES.length);
  });

  const chapter = (id: string, at: string, n: number, town = false): CityScene => ({ ...scene(id, at, n, 'episode', [at, 'square']), kind: 'chapter', ...(town ? { where: 'town' as const } : {}) });
  const SEASON: CitySeason = { id: 'home', title: 'Về hay ở', blurb: 'Chuyện của Leo và Nora.', needs: ['ct-nora-2'], chapters: [chapter('cs-home-1', 'square', 1, true), chapter('cs-home-2', 'nora', 2), chapter('cs-home-3', 'square', 3, true)] };

  it('a long story waits for what it grows out of, then gives one chapter a real day', () => {
    let city = emptyTownCity();
    expect(seasonNow(SEASON, city, T0)).toMatchObject({ kind: 'locked', needs: 'ct-nora-2' });
    for (const id of ['ct-rico-1', 'ct-nora-1', 'ct-nora-2']) city = heard(city, id, 3, T0).city;
    expect(seasonNow(SEASON, city, T0)).toMatchObject({ kind: 'open', chapter: { id: 'cs-home-1' } });
    expect(chaptersToday([SEASON], city, T0).map((c) => c.chapter.id)).toEqual(['cs-home-1']);
    city = hearScene(city, SEASON.chapters[0], { right: 2, asked: 3 }, TOWN, T0).city;
    // heard today: the next one is for tomorrow
    expect(seasonNow(SEASON, city, T0 + 3_600_000)).toMatchObject({ kind: 'tomorrow', chapter: { id: 'cs-home-2' } });
    expect(chaptersToday([SEASON], city, T0 + 3_600_000)).toEqual([]);
    expect(seasonNow(SEASON, city, T0 + DAY)).toMatchObject({ kind: 'open', chapter: { id: 'cs-home-2' } });
    city = hearScene(city, SEASON.chapters[1], { right: 3, asked: 3 }, TOWN, T0 + DAY).city;
    city = hearScene(city, SEASON.chapters[2], { right: 3, asked: 3 }, TOWN, T0 + 2 * DAY).city;
    expect(seasonNow(SEASON, city, T0 + 9 * DAY)).toMatchObject({ kind: 'done' });
    // a chapter is stored like any scene, and pays like one
    expect(parseTownCity(JSON.parse(JSON.stringify(city))).heard['cs-home-3']).toBeDefined();
    expect(sceneOwner('cs-home-2')).toBe('home');
  });

  it("what is on today: the weekday's get-together, and a festival of the month first", () => {
    const EVENTS: CityEvent[] = [
      { id: 'karaoke', weekday: 4, name: 'Karaoke', blurb: '', host: 'bo' },
      { id: 'ferry', weekday: 0, name: 'Phà', blurb: '', host: 'odile' },
      { id: 'fair', months: [9, 10, 11], name: 'Hội', blurb: '', host: 'fay' },
    ];
    expect(cityEventsOn(EVENTS, 4, 6).map((e) => e.id)).toEqual(['karaoke']);
    expect(cityEventsOn(EVENTS, 4, 11).map((e) => e.id)).toEqual(['fair', 'karaoke']);
    expect(cityEventsOn(EVENTS, 2, 3)).toEqual([]);
    expect(cityDay(new Date(2026, 10, 25, 23, 59).getTime())).toBe('2026-11-25');
  });
});
