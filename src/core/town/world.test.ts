import { describe, expect, it } from 'vitest';
import { EVENT_SCENES, OVERHEARD_SCENES, RADIO_SCENES } from '../../data/scenes';
import { TOWN_PLACES } from '../../data/town';
import { benchNumber, DECORATION_IDS, thingKind, TOWN_WORLD, WORLD_THINGS } from '../../data/townWorld';
import { bodyFits, TownSim } from '../../features/town/engine/sim';
import { buildAudioInventory, defaultInventoryContent } from '../audioInventory';
import { BODY_RADIUS, walkWorld } from './colliders';
import { walkable } from './map';
import { emptyTownProgress, parseTownProgress, townDay, updateDaily } from './progress';
import { sceneLinePlayback, sceneVoice } from './sceneAudio';
import { CAST_VOICES } from './voices';
import { eventOn, eventScene, overheardAt, radioNow, SCENE_PAID_A_DAY, scenePay, TOWN_EVENTS, weatherOf, weekdayOf, weekOf } from './world';
import { scenesHeard } from './worldStore';

const days = (n: number): string[] => Array.from({ length: n }, (_, i) => townDay(new Date(2026, 0, 1 + i, 12).getTime()));

describe('the town’s week', () => {
  it('each get-together has its own weekday and a host who lives in town; two days are quiet', () => {
    expect(new Set(TOWN_EVENTS.map((e) => e.weekday)).size).toBe(TOWN_EVENTS.length);
    expect(new Set(TOWN_EVENTS.map((e) => e.id)).size).toBe(TOWN_EVENTS.length);
    for (const e of TOWN_EVENTS) expect(TOWN_PLACES.some((p) => p.id === e.host), e.id).toBe(true);
    expect([0, 1, 2, 3, 4, 5, 6].filter((d) => !eventOn(d))).toEqual([1, 3]);
    expect(eventOn(2)?.id).toBe('games');
  });

  it('the weekday is the learner’s own, and a week turns over on Monday', () => {
    // 2026-11-25 is a Wednesday
    expect(weekdayOf(new Date(2026, 10, 25, 9).getTime())).toBe(3);
    expect(weekOf('2026-11-29')).toBe(weekOf('2026-11-23')); // Sunday, the Monday before
    expect(weekOf('2026-11-30')).toBe(weekOf('2026-11-23') + 1); // the next Monday
  });

  it('a get-together’s tellings take turns week by week, the same all week', () => {
    for (const e of TOWN_EVENTS) {
      const own = EVENT_SCENES.filter((s) => s.event === e.id);
      const seen = new Set<string>();
      for (let w = 0; w < own.length; w++) seen.add(eventScene(EVENT_SCENES, e.id, townDay(new Date(2026, 0, 5 + w * 7, 12).getTime()))!.id);
      expect(seen.size, e.id).toBe(own.length);
      expect(eventScene(EVENT_SCENES, e.id, '2026-11-23')!.id).toBe(eventScene(EVENT_SCENES, e.id, '2026-11-29')!.id);
    }
    expect(eventScene(EVENT_SCENES, 'nope', '2026-11-23')).toBeNull();
  });
});

describe('the weather', () => {
  it('is the same for a day everywhere, and over a year mostly fine with some rain', () => {
    expect(weatherOf('2026-11-25')).toBe(weatherOf('2026-11-25'));
    const year = days(365).map(weatherOf);
    const share = (w: string) => year.filter((x) => x === w).length / year.length;
    expect(share('rain')).toBeGreaterThan(0.08);
    expect(share('rain')).toBeLessThan(0.28);
    expect(share('clear')).toBeGreaterThan(0.38);
    expect(share('cloudy')).toBeGreaterThan(0.2);
  });
});

describe('which scene plays', () => {
  it('a bench has one scene for the day, benches differ, and what was heard lately waits its turn', () => {
    const none = new Set<string>();
    const a = overheardAt(OVERHEARD_SCENES, 0, '2026-11-25', none)!;
    expect(overheardAt(OVERHEARD_SCENES, 0, '2026-11-25', none)!.id).toBe(a.id);
    const today = new Set(Array.from({ length: 24 }, (_, b) => overheardAt(OVERHEARD_SCENES, b, '2026-11-25', none)!.id));
    expect(today.size).toBeGreaterThan(8);
    const week = new Set(days(7).map((d) => overheardAt(OVERHEARD_SCENES, 0, d, none)!.id));
    expect(week.size).toBeGreaterThan(3);
    // everything heard but one: that one plays
    const last = OVERHEARD_SCENES[5];
    const heard = new Set(OVERHEARD_SCENES.filter((s) => s !== last).map((s) => s.id));
    for (let b = 0; b < 24; b++) expect(overheardAt(OVERHEARD_SCENES, b, '2026-11-25', heard)!.id).toBe(last.id);
    // everything heard: they come round again
    expect(overheardAt(OVERHEARD_SCENES, 3, '2026-11-25', new Set(OVERHEARD_SCENES.map((s) => s.id)))).not.toBeNull();
    expect(overheardAt([], 0, '2026-11-25', none)).toBeNull();
  });

  it('the radio reads what fits today (its weather, its weekday first), a new segment each turn', () => {
    const none = new Set<string>();
    for (const weather of ['clear', 'cloudy', 'rain'] as const) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const turns = [0, 1, 2].map((t) => radioNow(RADIO_SCENES, '2026-11-25', weekday, weather, t, none)!);
        expect(new Set(turns.map((s) => s.id)).size, `${weather} ${weekday}`).toBe(3);
        for (const s of turns) {
          expect(s.weather === undefined || s.weather === weather, s.id).toBe(true);
          expect(s.weekday === undefined || s.weekday === weekday, s.id).toBe(true);
        }
        // the day's own (the forecast, the day's notice) before the timeless ones
        expect(turns[0].weather !== undefined || turns[0].weekday !== undefined, `${weather} ${weekday}`).toBe(true);
      }
    }
    const first = radioNow(RADIO_SCENES, '2026-11-25', 3, 'rain', 0, none)!;
    expect(radioNow(RADIO_SCENES, '2026-11-25', 3, 'rain', 0, new Set([first.id]))!.id).not.toBe(first.id);
  });
});

describe('what a scene pays', () => {
  const oh = { id: 'oh-1', kind: 'overheard' } as const;
  const fm = { id: 'fm-1', kind: 'radio' } as const;
  const ev = { id: 'ev-games-1', kind: 'event' } as const;

  it('pays for what was understood, never for a click', () => {
    expect(scenePay(oh, { right: 1, asked: 1, plays: 1 }, [])).toEqual({ xu: 2, bond: 0, capped: false });
    expect(scenePay(oh, { right: 0, asked: 1, plays: 3 }, [])).toEqual({ xu: 0, bond: 0, capped: false });
    expect(scenePay(fm, { right: 2, asked: 2, plays: 1 }, [])).toEqual({ xu: 4, bond: 0, capped: false });
    expect(scenePay(fm, { right: 5, asked: 2, plays: 1 }, []).xu).toBe(4);
    // a get-together: for coming, for each answer, and the host's friendship
    expect(scenePay(ev, { right: 2, asked: 2, plays: 1 }, [])).toEqual({ xu: 10, bond: 15, capped: false });
    expect(scenePay(ev, { right: 0, asked: 2, plays: 1 }, [])).toEqual({ xu: 2, bond: 15, capped: false });
  });

  it('once per scene a day, and only so many of a kind a day; the kinds do not use up each other', () => {
    expect(scenePay(oh, { right: 1, asked: 1, plays: 1 }, ['oh-1'])).toEqual({ xu: 0, bond: 0, capped: false });
    const four = Array.from({ length: SCENE_PAID_A_DAY.overheard }, (_, i) => `oh-${i + 2}`);
    expect(scenePay(oh, { right: 1, asked: 1, plays: 1 }, four)).toEqual({ xu: 0, bond: 0, capped: true });
    expect(scenePay(fm, { right: 2, asked: 2, plays: 1 }, four).xu).toBe(4);
    expect(scenePay(ev, { right: 2, asked: 2, plays: 1 }, ['ev-games-2']).capped).toBe(true);
  });

  it('what paid today is kept in town-progress, read back, and merged across devices', () => {
    let p = emptyTownProgress();
    p = updateDaily(p, '2026-11-25', 'dev-a', (d) => ({ ...d, heard: ['oh-3', 'fm-1'] }));
    p = updateDaily(p, '2026-11-25', 'dev-b', (d) => ({ ...d, heard: ['oh-3', 'ev-games-1'] }));
    p = updateDaily(p, '2026-11-24', 'dev-a', (d) => ({ ...d, heard: ['oh-9'] }));
    expect(scenesHeard(p, '2026-11-25').sort()).toEqual(['ev-games-1', 'fm-1', 'oh-3']);
    expect(scenesHeard(p).sort()).toEqual(['ev-games-1', 'fm-1', 'oh-3', 'oh-9']);
    const back = parseTownProgress(JSON.parse(JSON.stringify(p)));
    expect(scenesHeard(back, '2026-11-25').sort()).toEqual(['ev-games-1', 'fm-1', 'oh-3']);
  });
});

describe('the things to use (data/townWorld WORLD_THINGS)', () => {
  const ids = Object.keys(WORLD_THINGS);

  it('every bench of the first day and the café’s radio', () => {
    const benches = TOWN_WORLD.props.filter((p) => p.kind === 'bench').length;
    expect(ids.filter((id) => thingKind(id) === 'bench').length).toBe(benches);
    expect(benches).toBeGreaterThan(15);
    expect(ids.filter((id) => thingKind(id) === 'radio')).toEqual(['thing:radio']);
    expect(ids.map(benchNumber).filter((n) => n >= 0).sort((a, b) => a - b)).toEqual(Array.from({ length: benches }, (_, i) => i));
    expect(thingKind('fish')).toBeNull();
    expect(thingKind('thing:bench-x')).toBeNull();
    expect(benchNumber('thing:radio')).toBe(-1);
  });

  it('the player can stand at each: a walkable tile a body fits on, right beside the thing', () => {
    // nothing built; and everything built and bought (no house, lamp or flower bed where the player would stand)
    for (const state of [{ built: [], decorations: [] }, { built: TOWN_PLACES.map((p) => p.id), decorations: [...DECORATION_IDS] }]) {
      const w = walkWorld(TOWN_WORLD, state);
      for (const [id, spot] of Object.entries(WORLD_THINGS)) {
        expect(walkable(spot.stand, w), id).toBe(true);
        expect(bodyFits(spot.stand.x + 0.5, spot.stand.y + 0.5, BODY_RADIUS, w), id).toBe(true);
        // (to the nearest point of the thing: the bus is two tiles long)
        const b = spot.box!;
        const dx = Math.max(0, Math.abs(spot.stand.x + 0.5 - b.x) - b.w / 2);
        const dy = Math.max(0, Math.abs(spot.stand.y + 0.5 - b.y) - b.d / 2);
        expect(Math.hypot(dx, dy), id).toBeLessThanOrEqual(0.75);
      }
    }
  });
});

describe('how a scene’s line is said: the browser’s voice, never a clip', () => {
  it('each speaker has a voice name of the scene’s own and their sex; nobody unknown', () => {
    expect(sceneVoice('cafe')).toEqual({ voice: 'scene-cafe', gender: 'female' });
    expect(sceneVoice('station')).toEqual({ voice: 'scene-station', gender: 'male' });
    expect(sceneVoice('marcus')).toEqual({ voice: 'scene-marcus', gender: 'male' });
    expect(sceneVoice('nobody')).toBeNull();
    expect(sceneVoice('toString')).toBeNull();
    // no Gemini voice has such a name: no clip is ever looked up or made under it
    const gemini = new Set(Object.values(CAST_VOICES).map((v) => v.voice));
    for (const who of [...Object.keys(CAST_VOICES), 'marcus']) expect(gemini.has(sceneVoice(who)!.voice)).toBe(false);
  });

  it('connected by default, the written text slowly for the careful version, never a paid request', () => {
    const line = OVERHEARD_SCENES[0].lines[0];
    expect(sceneLinePlayback(line, 2).options).toMatchObject({ mode: 'connected', browserOnly: true });
    const careful = sceneLinePlayback(line, 1, true);
    expect(careful.text).toBe(line.text);
    expect(careful.options).toMatchObject({ mode: 'careful', browserOnly: true });
    expect(sceneLinePlayback(RADIO_SCENES[0].lines[0], 2).options.voice).toEqual({ voice: 'scene-marcus', gender: 'male' });
  });

  it('no scene line is in the clip inventory (the owner: heard for fun, no tokens spent on voices)', () => {
    const said = new Set([...OVERHEARD_SCENES, ...RADIO_SCENES, ...EVENT_SCENES].flatMap((s) => s.lines.map((l) => sceneLinePlayback(l, s.level).text)));
    const clips = buildAudioInventory(defaultInventoryContent()).clips;
    expect(clips.length).toBeGreaterThan(5000);
    expect(clips.filter((c) => (c.voice ?? '').startsWith('scene-'))).toEqual([]);
    // (a scene line may share its words with a clip of another exercise; none is there BECAUSE of a scene)
    expect(clips.filter((c) => c.refs.some((r) => /(^|:)(oh|fm|ev)-/.test(r))).length).toBe(0);
    expect(said.size).toBeGreaterThan(400);
  });
});

describe('a scene heard from a seat: the player sits, two residents talk aside (engine/sim.ts)', () => {
  const seats = TOWN_WORLD.life!.seats;
  const plaza = seats.filter((s) => Math.floor(s.x) === 33 && Math.floor(s.y) === 34);
  const make = () => {
    const sim = new TownSim(TOWN_WORLD, () => 0.5, TOWN_WORLD.start, { life: true });
    sim.setState({ built: TOWN_PLACES.map((p) => p.id), decorations: [] });
    return sim;
  };

  it('the player sits on the seat and gets up at the first key, back in front of it', () => {
    const sim = make();
    expect(plaza.length).toBe(2);
    expect(sim.sitPlayer(plaza[0])).toBe(true);
    expect(sim.playerSeat).toBe(plaza[0]);
    expect([sim.player.x, sim.player.y]).toEqual([plaza[0].x, plaza[0].y]);
    for (let i = 0; i < 30; i++) sim.update(1 / 30);
    expect(sim.playerSeat).toBe(plaza[0]);
    sim.steer({ x: 1, y: 0 });
    sim.update(1 / 30);
    expect(sim.playerSeat).toBeNull();
    expect(Math.floor(sim.player.x)).toBe(plaza[0].from.x);
    expect(bodyFits(sim.player.x, sim.player.y, BODY_RADIUS, sim.world)).toBe(true);
    sim.steer(null);
  });

  it('the bench is the player’s while they sit: nobody takes the seat beside them', () => {
    const sim = make();
    sim.sitPlayer(plaza[0]);
    // a long while of the town's life
    for (let i = 0; i < 60 * 90; i++) sim.update(1 / 30);
    for (const r of sim.residents.values()) expect(r.seat && Math.floor(r.seat.x) === 33 && Math.floor(r.seat.y) === 34, r.place.id).toBeFalsy();
    sim.standPlayer();
    expect(sim.playerSeat).toBeNull();
  });

  it('the two who are overheard come to their spots, stay turned to each other, and go back to their day after', () => {
    const sim = make();
    sim.sitPlayer(plaza[0]);
    const spots = [
      { x: 35.6, y: 33.83 },
      { x: 35.6, y: 34.83 },
    ];
    sim.talkAside(['station', 'park'], spots, [
      { x: 40.6, y: 33.83 },
      { x: 40.6, y: 34.83 },
    ]);
    expect(sim.inAside('station')).toBe(true);
    expect(sim.inAside('cafe')).toBe(false);
    for (let i = 0; i < 30 * 12; i++) sim.update(1 / 30);
    const sam = sim.residents.get('station')!;
    const lily = sim.residents.get('park')!;
    expect(Math.hypot(sam.x - spots[0].x, sam.y - spots[0].y)).toBeLessThan(0.3);
    expect(Math.hypot(lily.x - spots[1].x, lily.y - spots[1].y)).toBeLessThan(0.3);
    // they stay there however long the scene lasts
    for (let i = 0; i < 30 * 40; i++) sim.update(1 / 30);
    expect(Math.hypot(sam.x - spots[0].x, sam.y - spots[0].y)).toBeLessThan(0.3);
    expect(sam.engaged && lily.engaged).toBe(true);
    sim.endAside();
    expect(sim.inAside('station')).toBe(false);
    expect(sam.engaged || lily.engaged).toBe(false);
  });
});
