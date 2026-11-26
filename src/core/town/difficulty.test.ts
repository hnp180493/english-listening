import { describe, expect, it } from 'vitest';
import { brokenPieces, emptySpeech, mergeSpeech, parseSpeech, pinSpeech, SPEECH_LEVELS, SPEECH_RULES, speechAfter, speechLevelOf, type SpeechLevel, type SpeechState } from './difficulty';

/** A deterministic learner right `p` of the time, spread evenly (no luck in the test). */
function learner(p: number): () => boolean {
  let owed = 0;
  return () => {
    owed += p;
    if (owed >= 1 - 1e-9) {
      owed -= 1;
      return true;
    }
    return false;
  };
}

/** Runs of five lines from a start, the levels after each run. */
function play(p: number, runs: number, start: SpeechState = emptySpeech()): SpeechLevel[] {
  const next = learner(p);
  let s = start;
  const out: SpeechLevel[] = [];
  for (let i = 0; i < runs; i++) {
    s = speechAfter(s, Array.from({ length: 5 }, next), 1000 + i);
    out.push(speechLevelOf(s));
  }
  return out;
}

describe('the ladder', () => {
  it('every step is harder than the one before, on every knob; noise is not one of them', () => {
    for (let i = 1; i < SPEECH_LEVELS.length; i++) {
      const a = SPEECH_RULES[SPEECH_LEVELS[i - 1]];
      const b = SPEECH_RULES[SPEECH_LEVELS[i]];
      expect(b.rate).toBeGreaterThan(a.rate);
      expect(b.freeRepeats).toBeLessThanOrEqual(a.freeRepeats);
      expect(b.patience).toBeLessThan(a.patience);
      expect(b.lookAlikes).toBeGreaterThanOrEqual(a.lookAlikes);
      expect(b.hearFar).toBeLessThan(a.hearFar);
      expect(b.leadMs).toBeLessThanOrEqual(a.leadMs);
      expect(b.pay).toBeGreaterThan(a.pay);
      expect(Object.keys(b)).not.toContain('noise');
    }
    // the middle is the jobs as written
    expect(SPEECH_RULES[3]).toMatchObject({ rate: 1, patience: 1, hearFar: 1, breaks: 'written', pay: 1 });
    // speed stays within what a voice says naturally around the learner's own rate
    for (const l of SPEECH_LEVELS) expect(SPEECH_RULES[l].rate).toBeGreaterThanOrEqual(0.8);
    for (const l of SPEECH_LEVELS) expect(SPEECH_RULES[l].rate).toBeLessThanOrEqual(1.15);
  });

  it('breaks a line over a bad radio more or less', () => {
    const t = 'Anything over... forty thousand... and it is yours, Mr Kemp.';
    expect(brokenPieces(t, 'none')).toEqual(['Anything over forty thousand and it is yours, Mr Kemp.']);
    expect(brokenPieces(t, 'fewer')).toEqual(['Anything over forty thousand', 'and it is yours, Mr Kemp.']);
    expect(brokenPieces(t, 'written')).toEqual(['Anything over', 'forty thousand', 'and it is yours, Mr Kemp.']);
    expect(brokenPieces(t, 'more')).toEqual(['Anything over', 'forty thousand', 'and it is yours', 'Mr Kemp.']);
  });
});

describe('following the learner', () => {
  it('a learner right about 85% of the time stays where they are', () => {
    for (const start of SPEECH_LEVELS) {
      const s = { ...emptySpeech(), auto: { ...emptySpeech().auto, level: start } };
      expect(new Set(play(0.85, 200, s))).toEqual(new Set([start]));
    }
  });

  it('climbs for a learner who gets nearly all right, falls for one who misses a lot, never two levels at once', () => {
    const up = play(0.98, 200);
    const down = play(0.55, 200);
    expect(up.at(-1)).toBe(5);
    expect(down.at(-1)).toBe(1);
    for (const path of [up, down]) {
      let prev: number = 3;
      for (const l of path) {
        expect(Math.abs(l - prev)).toBeLessThanOrEqual(1);
        prev = l;
      }
    }
  });

  it('slowly: at least a few runs between two changes', () => {
    const up = play(1, 60);
    const changes = up.map((l, i) => (i > 0 && l !== up[i - 1] ? i : -1)).filter((i) => i >= 0);
    for (let k = 1; k < changes.length; k++) expect(changes[k] - changes[k - 1]).toBeGreaterThanOrEqual(3);
    expect(up[0]).toBe(3);
    expect(up[1]).toBe(3);
  });

  it('settles: a learner who really is at a level ends up oscillating at most rarely', () => {
    // a learner whose share right depends on the level: 95% at 2, 85% at 3, 70% at 4 → settles at 3
    let s = emptySpeech();
    const at: Record<SpeechLevel, () => boolean> = { 1: learner(0.98), 2: learner(0.95), 3: learner(0.85), 4: learner(0.7), 5: learner(0.5) };
    const path: SpeechLevel[] = [];
    for (let i = 0; i < 300; i++) {
      const l = speechLevelOf(s);
      s = speechAfter(s, Array.from({ length: 5 }, at[l]), i + 1);
      path.push(speechLevelOf(s));
    }
    const tail = path.slice(150);
    expect(tail.filter((l) => l === 3).length / tail.length).toBeGreaterThan(0.9);
  });

  it('a pinned level is played; lifting the pin goes back to the automatic one', () => {
    let s = pinSpeech(emptySpeech(), 5, 10);
    expect(speechLevelOf(s)).toBe(5);
    s = speechAfter(s, [false, false, false, false, false, false, false, false, false, false, false, false, false], 20);
    expect(speechLevelOf(s)).toBe(5);
    expect(s.auto.level).toBe(2);
    s = pinSpeech(s, null, 30);
    expect(speechLevelOf(s)).toBe(2);
  });
});

describe('what is kept', () => {
  it('reads junk as the start, and keeps what it wrote', () => {
    expect(parseSpeech(null)).toEqual(emptySpeech());
    expect(parseSpeech({ auto: { level: 9 }, pin: { level: 'x' } })).toEqual(emptySpeech());
    const s = pinSpeech(speechAfter(emptySpeech(), [true, false, true], 50), 4, 60);
    expect(parseSpeech(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('merges each part by its own time, the same in either order', () => {
    const a = speechAfter(emptySpeech(), [true, true], 100);
    const b = pinSpeech(speechAfter(emptySpeech(), [false], 200), 2, 50);
    const m = mergeSpeech(a, b);
    expect(m.auto).toEqual(b.auto);
    expect(m.pin).toEqual(b.pin);
    expect(mergeSpeech(b, a)).toEqual(m);
    expect(mergeSpeech(a, a)).toEqual(a);
    const c = pinSpeech(a, 5, 300);
    expect(mergeSpeech(c, b).pin.level).toBe(5);
  });
});
