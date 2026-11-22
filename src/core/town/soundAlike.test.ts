import { describe, expect, it } from 'vitest';
import { placeLines, TOWN_PLACES } from '../../data/town';
import { NO_DERIVED, TOWN_SOUND_ALIKES } from '../../data/townSoundAlikes';
import { closeVariant, MAX_HEARD_CHANGE, SOUND_ALIKE_LABEL, SOUND_ALIKE_SIGN, soundAlikesOf } from './soundAlike';
import { allStoryLines, storyLineById } from './storyLines';
import type { TownLine } from './types';
import { choicesFor, confusability } from './visit';

const quick = TOWN_PLACES.flatMap((p) => placeLines(p.id));
const story = allStoryLines();
const byId = new Map<string, TownLine>([...quick, ...story].map((l) => [l.id, l]));
const line = (id: string, text: string, vi: string): TownLine => ({ id, text, vi, level: 1 });

describe('the authored sound-alikes (data/townSoundAlikes)', () => {
  it('every key is a line of the town that is answered by its meaning, and every entry applies to it', () => {
    for (const [id, list] of Object.entries(TOWN_SOUND_ALIKES)) {
      const l = byId.get(id);
      expect(l, `${id} is a line of the town`).toBeDefined();
      // a choice option is picked by its intent, never by its meaning: a sound-alike there would never be offered
      expect(storyLineById(id)?.base.choices?.length ?? 0, `${id} is not a choice line`).toBe(0);
      expect(list.length).toBeGreaterThan(0);
      for (const s of list) {
        expect(closeVariant(l!.text, s.heard), `${id}: "${s.heard}" is a near copy of "${l!.text}"`).toBe(true);
        // the kind shows in the English: in the line or in what is heard instead
        expect(SOUND_ALIKE_SIGN[s.kind].test(l!.text) || SOUND_ALIKE_SIGN[s.kind].test(s.heard), `${id}: kind ${s.kind}`).toBe(true);
        expect(s.vi.trim()).not.toBe('');
        expect(s.vi).not.toBe(l!.vi);
        // a Vietnamese sentence, ending like one
        expect(s.vi).toMatch(/[.!?…]$/);
      }
      // what the module gives for the line: every authored entry, first and in order
      const got = soundAlikesOf(l!);
      expect(got.slice(0, list.length).map((s) => s.vi)).toEqual(list.map((s) => s.vi));
      expect(got.slice(0, list.length).every((s) => !s.derived)).toBe(true);
    }
  });

  it('every authored meaning is offered next to its line (fair: not nearly the same as the right one)', () => {
    for (const [id, list] of Object.entries(TOWN_SOUND_ALIKES)) {
      const l = byId.get(id)!;
      const pool = l.id.startsWith('s') ? quick : story;
      const c = choicesFor(l, pool, 0);
      for (const s of list) expect(c.options, `${id}: "${s.vi}"`).toContain(s.vi);
      expect(c.options[c.answer]).toBe(l.vi);
    }
  });

  it('NO_DERIVED names lines of the town, each of which would otherwise get a derived meaning', () => {
    for (const id of NO_DERIVED) {
      const l = byId.get(id);
      expect(l, id).toBeDefined();
      expect(soundAlikesOf({ ...l!, id: `${id}-copy` }).some((s) => s.derived), `${id} has a derived one to suppress`).toBe(true);
      expect(soundAlikesOf(l!).some((s) => s.derived)).toBe(false);
    }
  });

  it('every kind has a Vietnamese label that names no English sentence', () => {
    for (const label of Object.values(SOUND_ALIKE_LABEL)) {
      expect(label.length).toBeGreaterThan(5);
      expect(label).not.toMatch(/[.?!]$/);
    }
  });
});

describe('closeVariant', () => {
  it('a near copy: 1 to MAX_HEARD_CHANGE words differ, case and punctuation aside', () => {
    expect(closeVariant("I can't do it.", 'I can do it.')).toBe(true);
    expect(closeVariant('Tell him I said hi.', 'tell them i said hi')).toBe(true);
    expect(closeVariant('Tell him I said hi.', 'Tell him I said hi!')).toBe(false); // nothing differs
    expect(closeVariant('I want to go home.', 'Where is the station, please?')).toBe(false);
    expect(MAX_HEARD_CHANGE).toBe(3);
  });
});

describe('derived sound-alikes', () => {
  it('him ↔ them: the one "anh ấy" (ông ấy, thằng bé …) becomes "họ", and back', () => {
    expect(soundAlikesOf(line('x1', 'Give him a call.', 'Gọi cho anh ấy đi.'))).toEqual([
      { kind: 'pronoun', heard: 'Give them a call.', vi: 'Gọi cho họ đi.', derived: true },
    ]);
    expect(soundAlikesOf(line('x2', 'Wake him up at seven.', 'Bảy giờ gọi thằng bé dậy nhé.'))[0].vi).toBe('Bảy giờ gọi họ dậy nhé.');
    expect(soundAlikesOf(line('x3', 'Do you want me to call them?', 'Có cần mình gọi cho họ không?'))[0]).toMatchObject({ heard: 'Do you want me to call him?', vi: 'Có cần mình gọi cho anh ấy không?' });
    // a capital stays a capital
    expect(soundAlikesOf(line('x4', 'Ask him.', 'Anh ấy thì cứ hỏi.'))[0].vi).toBe('Họ thì cứ hỏi.');
  });

  it('him ↔ them only when the swap is clean: one pronoun on each side, no other he / they to disagree with', () => {
    expect(soundAlikesOf(line('y1', 'Tell him to call me when he gets in.', 'Bảo anh ấy về thì gọi tôi.'))).toEqual([]); // "he" stays
    expect(soundAlikesOf(line('y2', 'Ask him.', 'Hỏi anh ấy xem anh ấy nói gì.'))).toEqual([]); // two in Vietnamese
    expect(soundAlikesOf(line('y3', 'I met him.', 'Mình gặp ông ấy với họ.'))).toEqual([]); // "họ" already there
    expect(soundAlikesOf(line('y4', 'I met him.', 'Mình gặp rồi.'))).toEqual([]); // no pronoun to swap
  });

  it('-teen ↔ -ty: the number said once in English and once in Vietnamese (words or digits)', () => {
    expect(soundAlikesOf(line('n1', "That's three fifty.", 'Của bạn ba đô năm mươi.'))).toEqual([
      { kind: 'number', heard: "That's three fifteen.", vi: 'Của bạn ba đô mười lăm.', derived: true },
    ]);
    expect(soundAlikesOf(line('n2', 'The bus leaves at ten fifteen.', 'Xe chạy lúc 10 giờ 15.'))[0].vi).toBe('Xe chạy lúc 10 giờ 50.');
    expect(soundAlikesOf(line('n3', 'I waited forty minutes.', 'Mình đợi bốn mươi phút.'))[0].vi).toBe('Mình đợi mười bốn phút.');
    // not a number of its own, or not in the Vietnamese once
    expect(soundAlikesOf(line('n4', 'He turned sixty-eight.', 'Ông ấy tròn sáu mươi tám.'))).toEqual([]);
    expect(soundAlikesOf(line('n5', 'Fifty five people came.', 'Năm mươi lăm người đến.'))).toEqual([]);
    expect(soundAlikesOf(line('n6', 'Thirty or thirty?', 'Ba mươi hay ba mươi?'))).toEqual([]);
  });

  it('cached and deterministic; a line with nothing gets nothing', () => {
    const l = line('z', 'Nice to meet you.', 'Rất vui được gặp bạn.');
    expect(soundAlikesOf(l)).toEqual([]);
    expect(soundAlikesOf(l)).toBe(soundAlikesOf(l));
  });
});

describe('sound-alikes in the meanings offered (choicesFor)', () => {
  const can = line('s008', 'I can do it.', 'Mình làm được mà.');
  const topic = [
    line('t1', 'See you later.', 'Hẹn gặp lại sau nhé.'),
    line('t2', 'It is raining.', 'Trời đang mưa.'),
    line('t3', 'I am hungry.', 'Mình đói rồi.'),
  ];
  // a line of the pool with its own pair (derived: him ↔ them)
  const other = line('p1', 'Give him a call.', 'Gọi cho anh ấy đi.');

  it('a sound-alike first: one of its own and a look-alike pair of another line, four options in two pairs', () => {
    const withAlike = can; // authored: "I can't do it."
    const own = soundAlikesOf(withAlike);
    expect(own.length).toBeGreaterThan(0);
    const pool = [withAlike, ...topic, other];
    for (let seed = 0; seed < 8; seed++) {
      const c = choicesFor(withAlike, pool, seed);
      expect(c.options).toHaveLength(4);
      expect(c.options[c.answer]).toBe(withAlike.vi);
      expect(c.options).toContain(own[0].vi);
      expect(c.options).toContain('Gọi cho anh ấy đi.');
      expect(c.options).toContain('Gọi cho họ đi.');
      expect(c.alike?.[c.options.indexOf(own[0].vi)]).toBe(own[0].kind);
      expect(c.alike?.filter(Boolean)).toHaveLength(1);
    }
    // consecutive seeds move the right one; every position comes up
    const at = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((s) => choicesFor(withAlike, pool, s).answer));
    expect(at.size).toBe(4);
    for (let s = 0; s < 8; s++) expect(choicesFor(withAlike, pool, s).answer).not.toBe(choicesFor(withAlike, pool, s + 1).answer);
  });

  it('one sound-alike and no pair to be had: the sound-alike and one wrong meaning the old way (three)', () => {
    const withAlike = can;
    const c = choicesFor(withAlike, [withAlike, ...topic], 3);
    expect(c.options).toHaveLength(3);
    expect(c.options).toContain(soundAlikesOf(withAlike)[0].vi);
    expect(c.options.filter((o) => topic.some((t) => t.vi === o))).toHaveLength(1);
  });

  it('no sound-alike: exactly the old three meanings, with no `alike`', () => {
    const plain = line('q1', 'Nice to meet you.', 'Rất vui được gặp bạn.');
    const c = choicesFor(plain, [plain, ...topic, other], 2);
    expect(c.options).toHaveLength(3);
    expect(c.alike).toBeUndefined();
    // a pool line's pair is never used without a sound-alike of the line itself (the odd one out would be the answer)
    expect(c.options.includes('Gọi cho anh ấy đi.') && c.options.includes('Gọi cho họ đi.')).toBe(false);
  });

  it('on the real lines: a sound-alike is close in words to the right meaning, never the same sentence', () => {
    let offered = 0;
    for (const l of [...quick, ...story]) {
      for (const s of soundAlikesOf(l)) {
        const k = confusability(l.vi, s.vi);
        expect(k, `${l.id}: "${s.vi}"`).toBeGreaterThan(0.4);
        offered += 1;
      }
    }
    // how much of the town has one (docs/town.md §13): authored + derived
    expect(offered).toBeGreaterThanOrEqual(45);
  });
});
