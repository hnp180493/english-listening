import { describe, expect, it } from 'vitest';
import { STREET_TALKS, streetTalksOf } from '../../data/streetTalks';
import { RESIDENT_ARCS } from '../../data/stories';
import { placeOfLineId, TOWN_PLACES } from '../../data/town';
import { openStreetTalks, pickStreetTalk, streetPlan } from './streetTalk';
import type { StreetTalk } from './streetTalkTypes';

const talk = (id: string, extra: Partial<StreetTalk> = {}): StreetTalk => ({
  id,
  placeId: 'cafe',
  level: 1,
  lines: [
    { who: 'them', text: 'Oh, hi! Out for a walk?', vi: 'Ồ, chào! Đi dạo à?' },
    { who: 'you', text: 'Yeah, it is a lovely day.', vi: 'Ừ, hôm nay đẹp trời.' },
    { who: 'them', text: "I'm off to buy some lemons.", vi: 'Mình đi mua ít chanh.' },
    { who: 'you', text: 'For the lemon cake?', vi: 'Để làm bánh chanh à?' },
    { who: 'them', text: 'You guessed it. See you later!', vi: 'Đoán đúng rồi. Gặp lại sau nhé!' },
  ],
  ...extra,
});

describe('a street talk as a conversation (docs/town.md §14)', () => {
  it("the resident's lines are the checks, each with the learner's line said before it", () => {
    const plan = streetPlan(talk('st-cafe-1'));
    expect(plan.map((p) => p.line.id)).toEqual(['st-cafe-1-1', 'st-cafe-1-3', 'st-cafe-1-5']);
    expect(plan[0].before).toBeUndefined();
    expect(plan[1].before).toEqual({ text: 'Yeah, it is a lovely day.', vi: 'Ừ, hôm nay đẹp trời.' });
    expect(plan[2].line).toMatchObject({ text: 'You guessed it. See you later!', level: 1 });
    // the town knows whose line it is
    expect(placeOfLineId('st-cafe-1-3')).toBe('cafe');
    expect(placeOfLineId('st-moon-1-3')).toBeUndefined();
  });

  it('hearts and known facts open the later talks; the least heard comes up, a closer one first', () => {
    const talks = [talk('st-cafe-1'), talk('st-cafe-2'), talk('st-cafe-3', { minHearts: 3 }), talk('st-cafe-4', { fact: 'cafe:grandma-cake' })];
    const none = () => false;
    expect(openStreetTalks(talks, 0, none).map((t) => t.id)).toEqual(['st-cafe-1', 'st-cafe-2']);
    expect(openStreetTalks(talks, 3, (f) => f === 'cafe:grandma-cake').map((t) => t.id)).toHaveLength(4);
    const never = () => 0;
    expect(pickStreetTalk(talks, 0, none, never)?.id).toBe('st-cafe-1');
    expect(pickStreetTalk(talks, 3, none, never)?.id).toBe('st-cafe-3');
    expect(pickStreetTalk(talks, 3, () => true, never)?.id).toBe('st-cafe-4');
    // heard already: the next one
    const heard = (id: string) => (id.startsWith('st-cafe-4') || id.startsWith('st-cafe-3') ? 2 : 0);
    expect(pickStreetTalk(talks, 3, () => true, heard)?.id).toBe('st-cafe-1');
    expect(pickStreetTalk([], 3, () => true, never)).toBeNull();
  });
});

describe('the street talks (data/streetTalks)', () => {
  const facts = new Map(RESIDENT_ARCS.flatMap((a) => a.facts.map((f) => [f.id, a.placeId] as const)));

  it('every resident has four: two for anybody, one from 3 hearts, one on a fact of theirs', () => {
    for (const p of TOWN_PLACES) {
      const ts = streetTalksOf(p.id);
      expect(ts.map((t) => t.id), p.id).toEqual([1, 2, 3, 4].map((n) => `st-${p.id}-${n}`));
      expect(ts.filter((t) => !t.minHearts && !t.fact), p.id).toHaveLength(2);
      expect(ts.filter((t) => (t.minHearts ?? 0) > 0), p.id).toHaveLength(1);
      const onFact = ts.filter((t) => t.fact);
      expect(onFact, p.id).toHaveLength(1);
      expect(facts.get(onFact[0].fact!), onFact[0].id).toBe(p.id);
    }
  });

  it('each is a real exchange: 5–7 lines, them first and last, turns alternating, short lines with a meaning', () => {
    const ids = new Set<string>();
    for (const t of STREET_TALKS) {
      expect(ids.has(t.id), t.id).toBe(false);
      ids.add(t.id);
      expect(t.lines.length, t.id).toBeGreaterThanOrEqual(5);
      expect(t.lines.length, t.id).toBeLessThanOrEqual(7);
      expect(t.lines[0].who, t.id).toBe('them');
      expect(t.lines[t.lines.length - 1].who, t.id).toBe('them');
      t.lines.forEach((l, i) => {
        if (i > 0) expect(l.who, `${t.id} line ${i + 1}`).not.toBe(t.lines[i - 1].who);
        const words = l.text.trim().split(/\s+/).length;
        expect(words, `${t.id}: ${l.text}`).toBeGreaterThanOrEqual(2);
        expect(words, `${t.id}: ${l.text}`).toBeLessThanOrEqual(16);
        expect(l.vi.trim(), t.id).not.toBe('');
      });
      // every line id fits the stored progress (≤ 40 characters)
      for (const p of streetPlan(t)) expect(p.line.id.length, p.line.id).toBeLessThanOrEqual(40);
    }
  });
});
