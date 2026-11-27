// The avatar's legs keep a person's rhythm whatever the ground speed (./vrmGait.ts): the owner found six and seven
// steps a second unnatural, and the speeds are to stay.
import { describe, expect, it } from 'vitest';
import { HURRY_SPEED, PLAYER_RUN, PLAYER_SPEED, RESIDENT_SPEED } from '../../engine/sim';
import { BODY } from './anim';
import { TILE_SCALE } from './person';
import { avatarCadence, avatarRunShare, CADENCE_MAX, CADENCE_MIN } from './vrmGait';

/** An adult avatar's height in the world (./vrmBody.ts: 0.8 of the code body's). */
const TALL = BODY.headTop * TILE_SCALE * 0.8;

describe("the avatar's gait", () => {
  it('nobody takes more steps a second than a person does, at any speed and any height', () => {
    for (const tall of [TALL * 0.5, TALL * 0.7, TALL, TALL * 1.25])
      for (let v = 0.05; v <= 8; v += 0.05) {
        const c = avatarCadence(v, tall);
        expect(c).toBeGreaterThanOrEqual(CADENCE_MIN);
        expect(c).toBeLessThanOrEqual(CADENCE_MAX);
      }
    expect(CADENCE_MAX).toBeLessThanOrEqual(3.5);
  });

  it('standing still the legs do not go', () => {
    expect(avatarCadence(0, TALL)).toBe(0);
    expect(avatarCadence(0.01, TALL)).toBe(0);
  });

  it('a stroll is about two steps a second, the everyday pace under three, the run the quickest', () => {
    const stroll = avatarCadence(RESIDENT_SPEED, TALL);
    const everyday = avatarCadence(PLAYER_SPEED, TALL);
    const run = avatarCadence(PLAYER_RUN, TALL);
    expect(stroll).toBeGreaterThan(1.8);
    expect(stroll).toBeLessThan(2.3);
    expect(everyday).toBeGreaterThan(stroll);
    expect(everyday).toBeLessThan(3);
    expect(run).toBeGreaterThan(everyday);
    // (the first avatar gait: about 6 and 7)
    expect(run).toBeLessThanOrEqual(CADENCE_MAX);
  });

  it('the pace changes the gait, not the rhythm: residents walk, the everyday pace is a jog, the run a run', () => {
    expect(avatarRunShare(RESIDENT_SPEED, TALL)).toBe(0);
    expect(avatarRunShare(RESIDENT_SPEED * 1.25, TALL)).toBe(0);
    const hurry = avatarRunShare(HURRY_SPEED, TALL);
    const everyday = avatarRunShare(PLAYER_SPEED, TALL);
    expect(hurry).toBeGreaterThan(0);
    expect(everyday).toBeGreaterThan(hurry);
    expect(everyday).toBeGreaterThan(0.35);
    expect(everyday).toBeLessThan(0.7);
    expect(avatarRunShare(PLAYER_RUN, TALL)).toBe(1);
    // never backwards as the pace grows
    let last = 0;
    for (let v = 0; v <= 6; v += 0.05) {
      const r = avatarRunShare(v, TALL);
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });
});
