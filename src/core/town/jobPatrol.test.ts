// A job's patrol (./jobPatrol.ts): its way along a named street, the sight rule over time (a glimpse is not being
// seen; indoors never), and the heat's clock held while it runs.
import { describe, expect, it } from 'vitest';
import { coolStep, findStreet, jobPatrolStep, onStreet, patrolAt, patrolPath, SEEN_GRACE, startJobPatrol } from './jobPatrol';
import { SIGHT } from './police';
import { laneOf, westbayNet } from './streets';

const net = westbayNet();

describe("a job's patrol: the way", () => {
  it('a street by id or by name, cars only', () => {
    expect(findStreet(net, 'market-street')?.name).toBe('Market Street');
    expect(findStreet(net, 'Bay Road')?.id).toBe('bay-road');
    expect(findStreet(net, 'Fountain Lane')).toBeNull();
    expect(findStreet(net, 'Nowhere Street')).toBeNull();
  });

  it('end to end on the lane of its direction (driving on the left), every point on the street', () => {
    const m = findStreet(net, 'Market Street')!;
    const east = patrolPath(net, { street: 'Market Street' })!;
    expect(east.dir).toBe('east');
    expect(east.from.y).toBe(laneOf(m, 'east'));
    expect(east.from.x).toBeLessThan(east.to.x);
    const west = patrolPath(net, { street: 'Market Street', from: 'east' })!;
    expect(west.dir).toBe('west');
    expect(west.from.y).toBe(laneOf(m, 'west'));
    for (const p of [east, west]) for (let t = 0; t <= 10; t++) expect(onStreet(net, patrolAt(p, t, 10)), `${p.dir} ${t}`).toBe(true);
  });

  it('from one crossing street to another, along the way between them', () => {
    const p = patrolPath(net, { street: 'Market Street', from: 'Bay Road', to: 'College Road' })!;
    const bay = net.junctions.find((j) => j.id === 'market-street*bay-road')!;
    const col = net.junctions.find((j) => j.id === 'market-street*college-road')!;
    expect(p.from.x).toBe(bay.x + 1);
    expect(p.to.x).toBe(col.x + 1);
    expect(p.dir).toBe('east');
    const back = patrolPath(net, { street: 'bay-road', from: 'Arts Street', to: 'Market Street' })!;
    expect(back.dir).toBe('north');
    expect(patrolPath(net, { street: 'Market Street', from: 'Arts Street' })).toBeNull();
  });

  it('it takes the seconds it was given, and stays at the end', () => {
    const p = patrolPath(net, { street: 'Arts Street' })!;
    expect(patrolAt(p, 0, 20)).toEqual(p.from);
    expect(patrolAt(p, 20, 20)).toEqual(p.to);
    expect(patrolAt(p, 99, 20)).toEqual(p.to);
    const mid = patrolAt(p, 10, 20);
    expect(mid.x).toBeCloseTo((p.from.x + p.to.x) / 2);
  });
});

describe("a job's patrol: seen or not", () => {
  const p = patrolPath(net, { street: 'Market Street' })!;
  const drive = (me: (t: number) => { x: number; y: number; indoors: boolean }, seconds = 20) => {
    let run = startJobPatrol(p, seconds);
    for (let i = 0; i < seconds * 20; i++) run = jobPatrolStep(run, 0.05, me(run.t)).run;
    return run.seen;
  };
  it('standing by the road it drives: seen', () => {
    const mid = patrolAt(p, 10, 20);
    expect(drive(() => ({ x: mid.x, y: mid.y - 2, indoors: false }))).toBe(true);
  });
  it('far from it all the way: not seen', () => {
    expect(drive(() => ({ x: p.from.x, y: p.from.y + SIGHT + 6, indoors: false }))).toBe(false);
  });
  it('indoors right beside it: never seen', () => {
    const mid = patrolAt(p, 10, 20);
    expect(drive(() => ({ x: mid.x, y: mid.y, indoors: true }))).toBe(false);
  });
  it('a glimpse shorter than the grace is not being seen', () => {
    // in sight only while the patrol passes a narrow window, then indoors
    let run = startJobPatrol(p, 20);
    const mid = patrolAt(p, 10, 20);
    for (let i = 0; i < 400; i++) {
      const t = run.t;
      const glimpse = t >= 10 && t < 10 + SEEN_GRACE * 0.8;
      run = jobPatrolStep(run, 0.05, { x: mid.x, y: mid.y - 1, indoors: !glimpse }).run;
    }
    expect(run.seen).toBe(false);
  });
});

describe('the heat while a job patrol runs', () => {
  it('held still while paused, cooling again after', () => {
    expect(coolStep(5, 30, 20, false, true, 40)).toEqual({ heat: 5, cool: 30 });
    expect(coolStep(5, 30, 20, false, false, 40)).toEqual({ heat: 4, cool: 0 });
    expect(coolStep(5, 30, 1, true, false, 40)).toEqual({ heat: 5, cool: 0 });
    expect(coolStep(0, 3, 1, false, false, 40)).toEqual({ heat: 0, cool: 0 });
  });
});
