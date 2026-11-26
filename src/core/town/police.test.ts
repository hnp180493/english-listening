// Westbay's police (./police.ts) and scanner (./scanner.ts): a search sees, closes in, loses or catches; a changed look
// loses the patrol; the fine's range; every bulletin true of the facts it was made from; fines in town-progress never
// given back by a merge.
import { describe, expect, it } from 'vitest';
import { balance, spentTotal } from './economy';
import { CATCH_TIME, fineFor, heatAfterLost, heatAfterOffence, LOSE_AFTER, PATROL_AT, patrolStart, policeStep, sameLook, sees, SIGHT, startSearch, type Look, type Seen } from './police';
import { addEarned, addFine, emptyTownProgress, finesTotal, mergeTownProgress, parseTownProgress } from './progress';
import { lookPhrase, officerScene, outfitColour, scanLines, vehicleColour, type ScanFacts } from './scanner';
import { COMPASS } from './streets';

const scooter: Look = { on: 'scooter', colour: 'pink', outfit: 'green' };
const me = (x: number, y: number, look: Look = scooter): Seen => ({ x, y, look, road: 'Market Street', heading: 'east', near: 'the Lumen' });
const straight = (_a: { x: number; y: number }, b: { x: number; y: number }) => [b];

describe('police: a search', () => {
  it('the same look: on the same thing of the same colour, in the same top', () => {
    expect(sameLook(scooter, { ...scooter })).toBe(true);
    expect(sameLook(scooter, { ...scooter, on: 'foot', colour: null })).toBe(false);
    expect(sameLook(scooter, { ...scooter, colour: 'blue' })).toBe(false);
    expect(sameLook(scooter, { ...scooter, outfit: 'red' })).toBe(false);
    expect(sameLook({ on: 'foot', colour: null, outfit: null }, { on: 'foot', colour: 'x', outfit: null })).toBe(true);
  });

  it('the patrol drives up, pulls up beside the learner (never onto them) and stops them after a moment', () => {
    let s = startSearch(me(0, 0), 'red', null, { x: 12, y: 0 }, 12);
    let caught = false;
    for (let i = 0; i < 200 && !caught; i++) {
      const r = policeStep(s, 0.1, me(0, 0), straight);
      if (r.events.includes('caught')) caught = true;
      else s = r.search!;
      if (!caught) expect(Math.hypot(s.patrol.x, s.patrol.y)).toBeGreaterThan(1.0);
    }
    expect(caught).toBe(true);
  });

  it('out of sight long enough: lost; a changed look counts as out of sight even near', () => {
    let s = startSearch(me(0, 0), 'car', null, { x: 60, y: 0 }, 7);
    const far = me(0, SIGHT + 20);
    let lost = false;
    for (let i = 0; i < (LOSE_AFTER + 2) * 10 && !lost; i++) {
      const r = policeStep(s, 0.1, far, () => []);
      if (r.events.includes('lost')) lost = true;
      else s = r.search!;
    }
    expect(lost).toBe(true);
    const near = startSearch(me(0, 0), 'car', null, { x: 2, y: 0 }, 7);
    expect(sees(near, me(0, 0))).toBe(true);
    expect(sees(near, me(0, 0, { on: 'foot', colour: null, outfit: 'green' }))).toBe(false);
  });

  it('seen again after a while: "spotted"; dispatch speaks on a clock', () => {
    let s = startSearch(me(0, 0), 'red', null, { x: 5, y: 0 }, 12);
    let evs: string[] = [];
    for (let i = 0; i < 60; i++) {
      const r = policeStep(s, 0.1, me(0, 40), () => []);
      s = r.search!;
    }
    const r = policeStep(s, 0.1, me(5, 2), straight);
    evs = r.events;
    expect(evs).toContain('spotted');
    let bulletins = 0;
    s = r.search!;
    for (let i = 0; i < 400; i++) {
      const q = policeStep(s, 0.1, me(0, 60), () => []);
      if (!q.search) break;
      s = q.search;
      bulletins += q.events.filter((e) => e === 'bulletin').length;
    }
    expect(bulletins).toBeGreaterThanOrEqual(1);
    expect(CATCH_TIME).toBeGreaterThan(0.5);
  });

  it('heat: offences add, a patrol comes at PATROL_AT, getting away leaves it under that line', () => {
    expect(heatAfterOffence(0, 'red')).toBe(3);
    expect(heatAfterOffence(2, 'thing')).toBe(3);
    expect(heatAfterOffence(9, 'car')).toBe(10);
    expect(heatAfterLost(7)).toBe(PATROL_AT - 1);
    expect(heatAfterLost(1)).toBe(1);
  });

  it('the fine: 30 to 120 by heat, less for an answer to the question, never more than the learner has', () => {
    expect(fineFor(0, false, 999)).toBe(30);
    expect(fineFor(3, false, 999)).toBe(60);
    expect(fineFor(10, false, 999)).toBe(120);
    expect(fineFor(10, true, 999)).toBe(90);
    expect(fineFor(1, true, 999)).toBe(30);
    expect(fineFor(10, false, 17)).toBe(17);
    expect(fineFor(10, false, 0)).toBe(0);
  });

  it('a patrol starts out of sight, on one of the given points', () => {
    const pts = [{ x: 3, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 }];
    const at = patrolStart({ x: 0, y: 0 }, pts, 5);
    expect(at).toEqual({ x: 20, y: 0 });
    expect(patrolStart({ x: 0, y: 0 }, [{ x: 3, y: 0 }, { x: 5, y: 0 }], 0)).toEqual({ x: 5, y: 0 });
  });
});

describe('scanner: true of what the police know', () => {
  const looks: Look[] = [
    { on: 'foot', colour: null, outfit: null },
    { on: 'foot', colour: null, outfit: 'red' },
    { on: 'scooter', colour: vehicleColour('scooter', 1), outfit: null },
    { on: 'car', colour: vehicleColour('car', 2), outfit: outfitColour('ao-tim') },
    { on: 'horse', colour: 'brown', outfit: null },
  ];
  const facts: ScanFacts[] = [];
  for (const look of looks)
    for (const heading of [...COMPASS, null])
      for (const road of ['Market Street', null])
        for (const offence of ['red', 'car', 'thing'] as const) facts.push({ unit: 15, look, road, heading, near: 'the ferry', nearVi: 'Bến phà', offence, thing: offence === 'thing' ? 'bins' : null });

  it('every bulletin names the road, the heading and the place it was made from, and nothing else', () => {
    for (const f of facts)
      for (const kind of ['start', 'update', 'spotted', 'lost', 'lostLook'] as const)
        for (const pick of [0, 1]) {
          const text = scanLines(kind, f, pick).map((l) => l.text).join(' ');
          const id = `${kind} ${JSON.stringify(f)}`;
          for (const h of COMPASS) if (text.includes(` ${h}`)) expect(h, id).toBe(f.heading);
          if (text.includes('Street') || text.includes('Road') || text.includes('Avenue')) expect(f.road && text.includes(f.road), id).toBeTruthy();
          if (text.includes(' near ')) expect(text.includes(`near ${f.near}`), id).toBe(true);
          expect(text, id).not.toMatch(/\{|\}|undefined|null|  /);
          for (const l of scanLines(kind, f, pick)) expect(l.vi.trim().length, id).toBeGreaterThan(0);
        }
  });

  it('the description is the look: the vehicle and its colour, on foot, the top; never a colour it does not have', () => {
    for (const f of facts) {
      const text = scanLines('start', f).map((l) => l.text).join(' ');
      const id = JSON.stringify(f);
      expect(text, id).toContain(lookPhrase(f.look).en);
      if (f.look.on === 'foot') expect(text, id).toContain('on foot');
      else expect(text, id).toContain(`${f.look.colour} `);
      if (f.look.outfit) expect(text, id).toContain(`in a ${f.look.outfit} top`);
      else expect(text, id).not.toContain(' top');
      if (f.heading) expect(text, id).toContain(`heading ${f.heading}`);
      if (f.offence === 'red') expect(text, id).toMatch(/red light|Suspect/);
    }
    expect(lookPhrase({ on: 'car', colour: 'yellow', outfit: null }).en).toBe('in a yellow car');
    expect(lookPhrase({ on: 'scooter', colour: 'orange', outfit: null }).en).toBe('on an orange scooter');
  });

  it('the officer: an opening, a question with the intent that answers it, three intents', () => {
    for (let pick = 0; pick < 3; pick++) {
      const s = officerScene(facts[0], pick);
      expect(s.intents.length).toBe(3);
      expect(s.answer).toBe(pick);
      expect(s.open.text.length).toBeGreaterThan(5);
    }
  });
});

describe('fines in town-progress', () => {
  const dev = 'dev-aaaa1111';
  it('a fine is spent xu; a merge never gives it back; the balance never shows below zero', () => {
    let p = addEarned(emptyTownProgress(), dev, 100);
    const before = p;
    p = addFine(p, dev, 60);
    expect(finesTotal(p)).toBe(60);
    expect(spentTotal(p)).toBe(spentTotal(before) + 60);
    expect(balance(p)).toBe(40);
    const m = mergeTownProgress(before, p);
    expect(finesTotal(m)).toBe(60);
    expect(mergeTownProgress(p, before)).toEqual(m);
    expect(mergeTownProgress(m, m)).toEqual(m);
    expect(finesTotal(parseTownProgress(JSON.parse(JSON.stringify(p))))).toBe(60);
    expect(balance(addFine(p, dev, 500))).toBe(0);
    // no fine: the value is as it always was
    expect('fines' in parseTownProgress(JSON.parse(JSON.stringify(before)))).toBe(false);
  });
});
