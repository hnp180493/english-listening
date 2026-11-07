import { describe, expect, it } from 'vitest';
import { createAutoLogger } from './listenAutoLog';

const S = 1000;

function setup(opts?: { idleMs?: number; chunkMs?: number }) {
  const writes: { seconds: number; at: number }[] = [];
  const lg = createAutoLogger((seconds, at) => writes.push({ seconds, at }), opts);
  return { lg, writes, total: () => writes.reduce((a, w) => a + w.seconds, 0) };
}

describe('createAutoLogger', () => {
  it('writes nothing for short pauses between sentences', () => {
    const { lg, writes } = setup();
    lg.setPlaying(true, 0);
    lg.setPlaying(false, 5 * S);
    lg.tick(30 * S);
    lg.setPlaying(true, 31 * S);
    lg.setPlaying(false, 40 * S);
    lg.tick(70 * S);
    expect(writes).toEqual([]);
  });

  it('flushes once after a pause longer than the idle limit', () => {
    const { lg, writes } = setup();
    lg.setPlaying(true, 0);
    lg.setPlaying(false, 90 * S);
    lg.tick(100 * S);
    expect(writes).toEqual([]);
    lg.tick(150 * S);
    expect(writes).toEqual([{ seconds: 90, at: 150 * S }]);
    lg.tick(400 * S);
    expect(writes).toHaveLength(1);
  });

  it('counts only playing time, across several play/pause stretches', () => {
    const { lg, total } = setup();
    lg.setPlaying(true, 0);
    lg.setPlaying(false, 20 * S);
    lg.setPlaying(true, 50 * S);
    lg.setPlaying(false, 80 * S);
    lg.flush(500 * S);
    expect(total()).toBe(50);
  });

  it('ignores repeated identical playing events', () => {
    const { lg, total } = setup();
    lg.setPlaying(true, 0);
    lg.setPlaying(true, 30 * S); // buffering → playing must not restart the span
    lg.setPlaying(false, 60 * S);
    lg.setPlaying(false, 90 * S);
    lg.flush(100 * S);
    expect(total()).toBe(60);
  });

  it('writes in chunks during long continuous playing, never the same second twice', () => {
    const { lg, writes, total } = setup({ chunkMs: 300 * S });
    lg.setPlaying(true, 0);
    for (let t = 10; t <= 700; t += 10) lg.tick(t * S);
    expect(writes.map((w) => w.seconds)).toEqual([300, 300]);
    lg.setPlaying(false, 750 * S);
    lg.flush(760 * S);
    expect(total()).toBe(750);
  });

  it('flush while playing keeps counting from the flush time (page hidden, audio continues)', () => {
    const { lg, total, writes } = setup();
    lg.setPlaying(true, 0);
    expect(lg.flush(40 * S)).toBe(40);
    lg.setPlaying(false, 100 * S);
    lg.flush(100 * S);
    expect(writes.map((w) => w.seconds)).toEqual([40, 60]);
    expect(total()).toBe(100);
  });

  it('a flush with nothing counted writes nothing', () => {
    const { lg, writes } = setup();
    expect(lg.flush(10 * S)).toBe(0);
    lg.setPlaying(false, 20 * S);
    lg.tick(200 * S);
    expect(writes).toEqual([]);
  });

  it('a throwing sink does not break the logger', () => {
    const lg = createAutoLogger(() => {
      throw new Error('quota');
    });
    lg.setPlaying(true, 0);
    expect(lg.flush(10 * S)).toBe(10);
    lg.setPlaying(false, 20 * S);
    expect(lg.flush(30 * S)).toBe(10);
  });
});

describe('createAutoLogger: sleep and frozen pages', () => {
  it('a long silence while "playing" counts one tick, not the whole gap (laptop slept with a video open)', () => {
    const { lg, total } = setup();
    lg.setPlaying(true, 0);
    for (let t = 10; t <= 240; t += 10) lg.tick(t * S);
    lg.tick(240 * S + 3 * 3600 * S); // wakes up 3 h later, no pause event
    lg.setPlaying(false, 240 * S + 3 * 3600 * S + 20 * S);
    lg.flush(240 * S + 3 * 3600 * S + 30 * S);
    // 240 s before the sleep + one 10 s tick + 20 s after waking
    expect(total()).toBe(270);
  });

  it('background-tab throttling (one tick a minute) still counts every second', () => {
    const { lg, total } = setup({ chunkMs: 3600 * S });
    lg.setPlaying(true, 0);
    for (let t = 60; t <= 600; t += 60) lg.tick(t * S);
    lg.setPlaying(false, 600 * S);
    lg.flush(600 * S);
    expect(total()).toBe(600);
  });

  it('a gap noticed by a flush or a pause is capped the same way', () => {
    const { lg, total } = setup();
    lg.setPlaying(true, 0);
    lg.tick(10 * S);
    lg.flush(10 * S + 8 * 3600 * S);
    expect(total()).toBe(20);
  });
});
