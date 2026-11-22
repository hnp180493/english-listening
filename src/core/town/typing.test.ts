import { describe, expect, it } from 'vitest';
import { NO_LISTENS } from '../dictation/listens';
import { placeLines, TOWN_PLACES } from '../../data/town';
import { applyAnswer, LINE_REWARD, TYPED_BONUS, typedBonus } from './economy';
import { addTyped, emptyTownProgress, mergeTownProgress, parseTownProgress, typedTotals } from './progress';
import { allStoryLines } from './storyLines';
import { judgeTyped, TYPING_MAX_WORDS, typedIndex, typedOutcome, typingTask } from './typing';

const NOW = new Date(2026, 10, 22, 12).getTime();
const DEV = 'd-test0001';
const PHONE = 'd-phone001';
const once = { ...NO_LISTENS, normal: 1 };
const twice = { ...NO_LISTENS, normal: 2 };
const slowed = { ...NO_LISTENS, normal: 1, slow: 1 };

describe('typingTask: the gap of a typed check', () => {
  it('one connected-speech event of the line, the one that changes the sound most, with the sentence around it', () => {
    expect(typingTask("It's kind of cold.")).toMatchObject({ target: 'kind of', before: "It's", after: 'cold.', phenomena: ['reduction'] });
    const t = typingTask('Did you get my message last night?')!;
    expect(t.target).toBe('Did you');
    expect(t.before).toBe('');
    expect(t.after).toBe('get my message last night?');
  });

  it('punctuation stays outside the gap', () => {
    const t = typingTask('Sorry, I can\'t hear you. Can you say that again?');
    expect(t).not.toBeNull();
    expect(t!.target).not.toMatch(/^[^\p{L}\p{N}]|[^\p{L}\p{N}]$/u);
    // the gap and what is around it are the sentence again
    expect([t!.before, t!.lead + t!.target + t!.trail, t!.after].filter(Boolean).join(' ')).toBe("Sorry, I can't hear you. Can you say that again?");
  });

  it('on every line of the town: 1 to 4 words, never the whole sentence, words of the line', () => {
    let none = 0;
    const lines = [...TOWN_PLACES.flatMap((p) => placeLines(p.id)), ...allStoryLines()];
    for (const l of lines) {
      const t = typingTask(l.text);
      if (!t) {
        none += 1;
        continue;
      }
      const n = t.target.split(/\s+/).length;
      expect(n, l.id).toBeGreaterThanOrEqual(1);
      expect(n, l.id).toBeLessThanOrEqual(TYPING_MAX_WORDS);
      expect(t.before + t.after, `${l.id}: some context is left`).not.toBe('');
      expect(l.text).toContain(t.target);
      expect(t.phenomena.length).toBeGreaterThan(0);
    }
    // nearly every line has one (a line without falls back to its meaning)
    expect(none / lines.length).toBeLessThan(0.05);
  });

  it('a line the decoder finds nothing in has no gap; junk is safe', () => {
    expect(typingTask('Yes.')).toBeNull();
    expect(typingTask('')).toBeNull();
  });
});

describe('typedIndex: which line of a conversation is typed', () => {
  const lines = ["It's kind of cold.", 'Did you get my message last night?', 'Yes.', 'Give me a minute.', 'Let me think about it.'].map((text) => ({ line: { text } }));

  it('a line never answered before comes first; a line without a gap or not eligible is never typed', () => {
    for (let seed = 0; seed < 20; seed++) {
      const i = typedIndex('cafe', lines.map((l, k) => ({ ...l, met: k !== 3 })), seed);
      expect(i).toBe(3);
    }
    const all = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const i = typedIndex('cafe', lines.map((l) => ({ ...l, met: false })), seed);
      expect(i).not.toBe(2); // "Yes." has no gap
      all.add(i);
    }
    expect(all.size).toBe(4); // the seed moves it around
    expect(typedIndex('cafe', lines.map((l, k) => ({ ...l, met: false, eligible: k === 1 })), 7)).toBe(1);
    expect(typedIndex('cafe', [{ line: { text: 'Yes.' }, met: false }], 0)).toBe(-1);
    expect(typedIndex('cafe', [], 0)).toBe(-1);
  });

  it('deterministic for (key, lines, seed); odd seeds are safe', () => {
    const l = lines.map((x) => ({ ...x, met: false }));
    expect(typedIndex('shop', l, 5)).toBe(typedIndex('shop', l, 5));
    for (const seed of [-3, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(typedIndex('shop', l, seed)).toBeGreaterThanOrEqual(0);
  });
});

describe('judgeTyped: the typed words against the gap (the dictation rules)', () => {
  it('right: the same words, a written-out or reduced form, a small slip in a long word', () => {
    expect(judgeTyped('want to', 'want to')).toMatchObject({ verdict: 'ok', correct: true });
    expect(judgeTyped('want to', 'wanna')).toMatchObject({ verdict: 'ok', correct: true });
    expect(judgeTyped('Did you', 'did you')).toMatchObject({ verdict: 'ok', correct: true });
    expect(judgeTyped("I'd", 'I would')).toMatchObject({ verdict: 'ok', correct: true });
    expect(judgeTyped('kind of', 'kinda')).toMatchObject({ verdict: 'ok', correct: true });
    expect(judgeTyped('message', 'mesage')).toMatchObject({ verdict: 'typo', correct: true });
  });

  it('a close miss: half the words, or a dropped ending (what elision hides): worth a hint', () => {
    expect(judgeTyped('picked it up', 'pick it up')).toMatchObject({ verdict: 'close', correct: false, ending: true });
    expect(judgeTyped('turn it off', 'turn off')).toMatchObject({ verdict: 'close', correct: false });
    expect(judgeTyped('meet you', 'meet')).toMatchObject({ verdict: 'close', matched: 1, total: 2 });
    expect(judgeTyped('Tell him', 'tell them')).toMatchObject({ verdict: 'close' });
  });

  it('wrong and empty', () => {
    expect(judgeTyped('want to', 'going')).toMatchObject({ verdict: 'wrong', correct: false });
    expect(judgeTyped('kind of', '')).toMatchObject({ verdict: 'empty', correct: false });
    expect(judgeTyped('kind of', '   ')).toMatchObject({ verdict: 'empty' });
  });

  it('the hint shows only first letters', () => {
    expect(judgeTyped('want to', 'x').hint).toBe('w___ t_');
    expect(judgeTyped("can't", 'x').hint).toBe("c__'_");
  });
});

describe('typedOutcome: a typed check as the line\'s answer', () => {
  it("right at the first check after one normal play is 'first'; with replays or the hint 'replayed'; a miss 'wrong'", () => {
    expect(typedOutcome('ok', once)).toBe('first');
    expect(typedOutcome('ok', twice)).toBe('replayed');
    expect(typedOutcome('ok', slowed)).toBe('replayed');
    expect(typedOutcome('helped', once)).toBe('replayed');
    expect(typedOutcome('miss', once)).toBe('wrong');
  });

  it('nothing played: nothing to record', () => {
    expect(typedOutcome('ok', NO_LISTENS)).toBeNull();
    expect(typedOutcome('miss', null)).toBeNull();
  });
});

describe('typed checks in the stored progress (version 6)', () => {
  it('addTyped counts per browser; typedTotals sums the browsers', () => {
    let p = emptyTownProgress();
    p = addTyped(p, DEV, true);
    p = addTyped(p, DEV, false);
    p = addTyped(p, PHONE, true);
    expect(p.typed).toEqual({ [DEV]: { n: 2, ok: 1 }, [PHONE]: { n: 1, ok: 1 } });
    expect(typedTotals(p)).toEqual({ n: 3, ok: 2 });
    expect(addTyped(p, 'NOT A DEVICE', true)).toBe(p);
    expect(typedTotals(emptyTownProgress())).toEqual({ n: 0, ok: 0 });
  });

  it('parse: junk dropped, ok never above n; a version 5 value reads with no typed checks', () => {
    const p = parseTownProgress({ version: 6, typed: { [DEV]: { n: 4.7, ok: 9 }, [PHONE]: { n: 0, ok: 2 }, 'NOT A DEVICE': { n: 3, ok: 1 }, 'd-other001': 'x' } });
    expect(p.typed).toEqual({ [DEV]: { n: 4, ok: 4 } });
    expect(parseTownProgress({ version: 5, lines: {} }).typed).toEqual({});
    expect(parseTownProgress({ version: 5, lines: {} }).version).toBe(6);
  });

  it('merge: max per browser and field (each browser adds only to its own), so the total never doubles', () => {
    const laptop = { ...emptyTownProgress(), typed: { [DEV]: { n: 5, ok: 3 }, [PHONE]: { n: 1, ok: 0 } } };
    const phone = { ...emptyTownProgress(), typed: { [DEV]: { n: 2, ok: 2 }, [PHONE]: { n: 4, ok: 3 } } };
    const m = mergeTownProgress(laptop, phone);
    expect(m.typed).toEqual({ [DEV]: { n: 5, ok: 3 }, [PHONE]: { n: 4, ok: 3 } });
    expect(mergeTownProgress(phone, laptop)).toEqual(m);
    expect(mergeTownProgress(m, m)).toEqual(m);
    expect(typedTotals(m)).toEqual({ n: 9, ok: 6 });
  });
});

describe('what a typed check pays (applyAnswer)', () => {
  const [L] = placeLines('cafe');

  it('typed right: the line\'s own xu plus TYPED_BONUS, with or without the hint; a miss pays nothing', () => {
    expect(TYPED_BONUS).toBe(2);
    expect(typedBonus('ok')).toBe(2);
    expect(typedBonus('helped')).toBe(2);
    expect(typedBonus('miss')).toBe(0);
    expect(typedBonus(null)).toBe(0);
    const p = emptyTownProgress();
    const first = applyAnswer(p, L.id, 'first', NOW, DEV, 'ok');
    expect(first.reward).toBe(LINE_REWARD.first + TYPED_BONUS);
    expect(first.typedXu).toBe(TYPED_BONUS);
    expect(first.progress.typed).toEqual({ [DEV]: { n: 1, ok: 1 } });
    expect(first.progress.earned[DEV]).toBe(LINE_REWARD.first + TYPED_BONUS);
    const helped = applyAnswer(p, L.id, 'replayed', NOW, DEV, 'helped');
    expect(helped.reward).toBe(LINE_REWARD.replayed + TYPED_BONUS);
    expect(helped.progress.typed).toEqual({ [DEV]: { n: 1, ok: 0 } });
    const miss = applyAnswer(p, L.id, 'wrong', NOW, DEV, 'miss');
    expect(miss.reward).toBe(0);
    expect(miss.progress.typed).toEqual({ [DEV]: { n: 1, ok: 0 } });
    expect(miss.progress.lines[L.id]).toMatchObject({ best: 0, tries: 1 });
  });

  it('a pick is not a typed check: nothing counted, nothing extra', () => {
    const r = applyAnswer(emptyTownProgress(), L.id, 'first', NOW, DEV);
    expect(r.reward).toBe(LINE_REWARD.first);
    expect(r.typedXu).toBe(0);
    expect(r.progress.typed).toEqual({});
  });
});
