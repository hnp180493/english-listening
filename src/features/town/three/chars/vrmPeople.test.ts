// A car's driver is drawn at every moment (./vrmPeople.ts standInWhileBare; QA 2026-11-28, BUG-01 / 03 / 04): while
// their avatar loads, when it does not load, when it is taken off for somebody nearer, and when it is taken off. Anybody
// else is not drawn while their avatar is on its way (owner, 2026-11-26: no code body first, then the avatar).
import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import { passerLook } from './looks';
import { bodyDrawn, dressWhenNear, standInWhileBare, undressNow } from './vrmPeople';
import type { Character3D } from '../contracts';

let n = 0;
/** A character as the people's code sees one: a root with the code body ('pivot'), a look and an animator. */
function fake(): Character3D & { pivot: Group } {
  const root = new Group();
  const pivot = new Group();
  pivot.name = 'pivot';
  root.add(pivot);
  const id = `qa-${n++}`;
  return { id, root, pivot, animator: {}, look: passerLook(n), dispose() {} } as unknown as Character3D & { pivot: Group };
}

const settle = () => new Promise((r) => setTimeout(r, 400));

describe('a driver is never an empty seat', () => {
  it('while the avatar is on its way the driver sits in the code body; a walker is not drawn yet', () => {
    const driver = fake();
    standInWhileBare(driver);
    const walker = fake();
    dressWhenNear(driver, 1, 1);
    dressWhenNear(walker, 1, 1);
    expect(driver.pivot.visible).toBe(true);
    expect(bodyDrawn(driver)).toBe(true);
    expect(walker.pivot.visible).toBe(false);
    expect(bodyDrawn(walker)).toBe(false);
  });

  it('when the file does not load (here: there is no file at all), the driver is still at the wheel', async () => {
    const driver = fake();
    standInWhileBare(driver);
    dressWhenNear(driver, 0, 0);
    await settle();
    expect(driver.pivot.visible).toBe(true);
    expect(bodyDrawn(driver)).toBe(true);
  });

  it('taken off (the car parked, the classic look chosen), the code body is back', () => {
    const driver = fake();
    standInWhileBare(driver);
    driver.pivot.visible = false;
    undressNow(driver);
    expect(driver.pivot.visible).toBe(true);
  });

  it('with every avatar given out, the driver who gives theirs up for somebody nearer keeps a body', () => {
    const drivers = Array.from({ length: 30 }, () => {
      const d = fake();
      standInWhileBare(d);
      return d;
    });
    // far ones first, then near ones take their places
    drivers.forEach((d, i) => dressWhenNear(d, 17 - i * 0.5, 0));
    for (const d of drivers) expect(d.pivot.visible).toBe(true);
  });
});
