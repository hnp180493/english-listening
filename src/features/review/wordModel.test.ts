import { describe, expect, it } from 'vitest';
import { gradeAuto } from '../../core/review/schedule';
import {
  buildWordIndex,
  looseSound,
  normWord,
  wordAmbiguity,
  wordIndex,
  wordReadings,
  type WordSource,
} from '../../core/review/words';
import type { CardId } from '../../core/review/types';
import type { Lesson, WordItem } from '../../data/lessonTypes';
import { createResolver } from './resolve';
import {
  chooseWordMode,
  containsWord,
  listenDistractors,
  listenSafe,
  markWordIn,
  wordAudio,
  wordPlan,
  WORD_OPTIONS,
} from './wordModel';

const graded = (reps: number, over: Partial<{ interval: number; lastGrade: 'again' | 'hard' | 'good' | 'easy' }> = {}) => ({
  reps,
  interval: 3,
  lapses: 0,
  lastGrade: 'good' as const,
  ...over,
});

describe('chooseWordMode', () => {
  it('new, missed and learning cards read first; graduated cards alternate', () => {
    expect(chooseWordMode(undefined, true)).toBe('read');
    expect(chooseWordMode({ reps: 0, interval: 0, lastGrade: undefined }, true)).toBe('read');
    expect(chooseWordMode(graded(1, { lastGrade: 'again', interval: 1 }), true)).toBe('read');
    expect(chooseWordMode(graded(0, { lastGrade: 'hard', interval: 0 }), true)).toBe('read');
    expect(chooseWordMode(graded(1), true)).toBe('listen');
    expect(chooseWordMode(graded(2), true)).toBe('read');
    expect(chooseWordMode(graded(3), true)).toBe('listen');
    expect(chooseWordMode(graded(8), true)).toBe('read');
  });

  it('a word missed by ear is read once (recovery), then listened to again', () => {
    const NOW = new Date(2026, 4, 10, 12, 0).getTime();
    const DAY = 86_400_000;
    let st = { id: 'word:knee~nee', due: NOW, interval: 3, ease: 2.5, reps: 1, lapses: 0, lastGrade: 'good' as const };
    expect(chooseWordMode(st, true)).toBe('listen');
    const missed = gradeAuto(st, 'again', NOW); // listen: wrong
    expect(chooseWordMode(missed, true)).toBe('read');
    const recovered = gradeAuto(missed, 'good', NOW + DAY); // read: good
    expect(chooseWordMode(recovered, true)).toBe('listen');
    // and it keeps alternating from there
    st = { ...gradeAuto(recovered, 'good', NOW + 5 * DAY), lastGrade: 'good' as const };
    expect(chooseWordMode(st, true)).toBe('read');
    expect(chooseWordMode(gradeAuto(st, 'good', NOW + 20 * DAY), true)).toBe('listen');
  });

  it('a word without a safe listening variant always reads', () => {
    for (const reps of [1, 2, 3, 5]) expect(chooseWordMode(graded(reps), false)).toBe('read');
  });
});

describe('wordAudio / containsWord / listenSafe', () => {
  it('context sentence, single-word say, or the word', () => {
    expect(wordAudio({ word: 'read', say: 'I read it yesterday.' })).toEqual({ text: 'I read it yesterday.', context: true });
    expect(wordAudio({ word: 'résumé', say: 'resume' })).toEqual({ text: 'resume', context: false });
    expect(wordAudio({ word: 'colonel' })).toEqual({ text: 'colonel', context: false });
  });

  it('containsWord matches whole words only', () => {
    expect(containsWord('I read it yesterday.', 'read')).toBe(true);
    expect(containsWord('I read it yesterday.', 'it')).toBe(true);
    expect(containsWord('I read it yesterday.', 'day')).toBe(false);
    expect(containsWord("Don't tear it.", "don't")).toBe(true);
  });

  it('containsWord ignores diacritics (résumé / resume)', () => {
    expect(containsWord('Please send me your resume.', 'résumé')).toBe(true);
    expect(containsWord('Please send me your résumé.', 'resume')).toBe(true);
    expect(containsWord('Please send me your resumes.', 'résumé')).toBe(false);
  });

  it('markWordIn bolds the word as written, whole words only', () => {
    expect(markWordIn('Read it. I read it yesterday, already.', 'read')).toEqual([
      { text: 'Read', hit: true },
      { text: ' it. I ', hit: false },
      { text: 'read', hit: true },
      { text: ' it yesterday, already.', hit: false },
    ]);
    expect(markWordIn('Close the door.', 'door').map((p) => p.hit)).toEqual([false, true, false]);
  });

  it('heteronyms are listened to only in a context sentence; homophones are safe bare', () => {
    const word = { text: 'nait', context: false };
    const sentence = { text: 'The wind is strong.', context: true };
    // no option ever sounds like the answer, so the bare sound of knight names one option only
    expect(listenSafe({ homophone: true, heteronym: false }, word)).toBe(true);
    expect(listenSafe({ homophone: false, heteronym: true }, word)).toBe(false);
    expect(listenSafe({ homophone: false, heteronym: true }, sentence)).toBe(true);
    expect(listenSafe({ homophone: false, heteronym: false }, word)).toBe(true);
  });
});

function lesson(id: string, course: Lesson['course'], items: WordItem[]): Lesson {
  return {
    id,
    course,
    order: 1,
    title: id,
    summary: '',
    phenomenon: null,
    minutes: 5,
    goal: '',
    sections: [{ title: 's', blocks: [{ type: 'words', items }] }],
    quiz: [],
  };
}

describe('listenDistractors: never an option that sounds like the answer', () => {
  const ix = buildWordIndex([
    lesson('a', 'irregular', [
      { word: 'knight', sound: 'nait' },
      { word: 'night', sound: 'NAIT' },
      { word: 'read', sound: 'red', say: 'I read it yesterday.' },
      { word: 'red', sound: 'red' },
      { word: 'read', sound: 'reed', say: 'I read every day.' },
      { word: 'lead', sound: 'led', say: 'The pipes are made of lead.' },
      { word: 'lead', sound: 'leed', say: 'Can you lead the team?' },
      { word: 'led', sound: 'led' },
      { word: 'it', sound: 'it' },
      { word: 'colonel', sound: 'KER-nəl' },
      { word: 'kernel', sound: 'ker-nəl' },
    ]),
    lesson('b', 'irregular', [
      { word: 'yacht', sound: 'yaht' },
      { word: 'debt', sound: 'det' },
    ]),
    lesson('c', 'loanwords', [
      { word: 'chef', sound: 'shef' },
      { word: 'ballet', sound: 'ba-LAY' },
    ]),
  ]);
  const src = (ref: string) => ix.all.find((s) => s.ref === ref)!;

  it('read (red): no "red", no "led"-like duplicates, no other "read", nothing from the sentence', () => {
    for (let seed = 0; seed < 50; seed++) {
      const d = listenDistractors(src('read~red'), ix.all, seed);
      const words = d.map((x) => normWord(x.item.word));
      expect(words).not.toContain('red');
      expect(words).not.toContain('read');
      expect(words).not.toContain('it'); // in "I read it yesterday."
      expect(new Set(d.map((x) => looseSound(x.item.sound))).size).toBe(d.length);
      expect(d).toHaveLength(WORD_OPTIONS - 1);
    }
  });

  it('a spelling with another reading of the answer sound is never offered (led: not "lead", even as leed)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const d = listenDistractors(src('led~led'), ix.all, seed, WORD_OPTIONS - 1, ix.rows).map((x) => x.item.word);
      expect(d).not.toContain('lead');
      expect(d).not.toContain('led');
      // two options never share a reading either: "read" (reed / red) and "red" never together
      expect(d.includes('read') && d.includes('red')).toBe(false);
    }
  });

  it('a heteronym without a context sentence always reads; with one it asks for the reading', () => {
    const bare = buildWordIndex([
      lesson('h', 'irregular', [
        { word: 'wind', sound: 'wind' },
        { word: 'wind', sound: 'waind', say: 'Wind the clock, please.' },
        { word: 'yacht', sound: 'yaht' },
        { word: 'debt', sound: 'det' },
        { word: 'chef', sound: 'shef' },
      ]),
    ]);
    const w1 = bare.all.find((s) => s.ref === 'wind~wind')!;
    const w2 = bare.all.find((s) => s.ref === 'wind~waind')!;
    for (const reps of [1, 3]) expect(wordPlan(w1, graded(reps), bare, 0).mode).toBe('read');
    expect(wordPlan(w2, graded(1), bare, 0)).toMatchObject({ mode: 'listen', task: 'reading' });
  });

  it('same lesson first, then the course, then any; stress-only variants count as the same sound', () => {
    for (let seed = 0; seed < 50; seed++) {
      const d = listenDistractors(src('colonel~KER-nəl'), ix.all, seed);
      expect(d.map((x) => x.item.word)).not.toContain('kernel');
      expect(d.every((x) => x.lessons.includes('a'))).toBe(true);
    }
    const yacht = listenDistractors(src('yacht~yaht'), ix.all, 1);
    expect(yacht[0].lessons).toEqual(['b']); // debt: same lesson
    expect(yacht.slice(1).every((x) => x.course === 'irregular')).toBe(true);
  });
});

describe('wordPlan on the app content', () => {
  const ix = wordIndex();

  it('every listening plan is safe: distinct words and sounds, answer present, nothing said in the sentence', () => {
    let listening = 0;
    for (const s of ix.all) {
      for (const seed of [0, 7, 99]) {
        const p = wordPlan(s, graded(1), ix, seed);
        if (p.mode !== 'listen') continue;
        listening++;
        expect(listenSafe(p.ambiguity, p.audio)).toBe(true);
        if (p.task === 'reading') {
          // a heteronym in its sentence: the options are the readings of that spelling, the card's own is the answer
          expect(p.audio.context).toBe(true);
          expect(p.options.length).toBeGreaterThanOrEqual(2);
          expect(p.options[p.answer]).toBe(s.item.sound);
          expect(new Set(p.options).size).toBe(p.options.length);
          expect([...p.options].sort()).toEqual(wordReadings(s, ix.rows).slice(0, WORD_OPTIONS).sort());
          continue;
        }
        expect(p.options.length).toBeGreaterThanOrEqual(3);
        expect(p.options.length).toBeLessThanOrEqual(WORD_OPTIONS);
        expect(p.options[p.answer]).toBe(s.item.word);
        expect(new Set(p.options.map(normWord)).size).toBe(p.options.length);
        expect(new Set(p.sounds.map(looseSound)).size).toBe(p.sounds.length);
        // no option is a homophone of the answer anywhere in the content (review on or off)
        const same = ix.rows
          .filter((r) => r.loose === looseSound(s.item.sound) && r.word !== normWord(s.item.word))
          .map((r) => r.word);
        for (const o of p.options) expect(same).not.toContain(normWord(o));
        if (p.audio.context) {
          p.options.forEach((o, i) => {
            if (i !== p.answer) expect(containsWord(p.audio.text, o)).toBe(false);
          });
        }
      }
    }
    expect(listening).toBeGreaterThan(100);
  });

  it('every word card of the content can be reviewed by ear', () => {
    const never = ix.all.filter((s) => wordPlan(s, graded(1), ix, 0).mode !== 'listen').map((s) => s.ref);
    expect(never).toEqual([]);
  });

  it('heteronyms: which reading was said, in the sentence (read~red and read~reed differ)', () => {
    const red = ix.byId.get('word:read~red')!;
    const reed = ix.byId.get('word:read~reed')!;
    const p = wordPlan(red, graded(1), ix, 3);
    expect(p.ambiguity.heteronym).toBe(true);
    expect(p).toMatchObject({ mode: 'listen', task: 'reading', audio: { text: red.item.say, context: true } });
    expect([...p.options].sort()).toEqual(['red', 'reed']);
    expect(p.options[p.answer]).toBe('red');
    const q = wordPlan(reed, graded(1), ix, 3);
    expect(q.options[q.answer]).toBe('reed');
    // stress-only heteronyms keep both readings apart
    const inc = ix.all.find((s) => s.ref.startsWith('increase~'));
    if (inc) expect(wordReadings(inc, ix.rows)).toHaveLength(2);
  });

  it('homophones listen to the bare word, never offered next to the word that sounds the same', () => {
    const homophones = ix.all.filter((s: WordSource) => {
      const a = wordAmbiguity(s, ix.rows);
      return a.homophone && !a.heteronym && !wordAudio(s.item).context;
    });
    expect(homophones.length).toBeGreaterThan(0);
    for (const s of homophones) {
      const p = wordPlan(s, graded(1), ix, 0);
      expect(p).toMatchObject({ mode: 'listen', task: 'word' });
      const same = ix.rows.filter((r) => r.loose === looseSound(s.item.sound)).map((r) => r.word);
      p.options.forEach((o, i) => {
        if (i !== p.answer) expect(same).not.toContain(normWord(o));
      });
    }
  });

  it('a fast variant of the same word is no heteronym (family: FA-mə-li / FAM-li)', () => {
    const fam = ix.all.find((s) => s.ref.startsWith('family~'));
    expect(fam).toBeDefined();
    expect(wordAmbiguity(fam!, ix.rows).heteronym).toBe(false);
    expect(wordReadings(fam!, ix.rows)).toEqual([fam!.item.sound]);
  });

  it('the answer moves between option slots across sessions', () => {
    const s = ix.byId.get('word:debt~det')!;
    const slots = new Set<number>();
    for (let seed = 0; seed < 40; seed++) slots.add(wordPlan(s, graded(1), ix, seed * 7919).answer);
    expect(slots.size).toBe(WORD_OPTIONS);
  });

  it('deterministic for a card state and seed; new cards read', () => {
    const s = ix.all[0];
    expect(wordPlan(s, graded(1), ix, 5)).toEqual(wordPlan(s, graded(1), ix, 5));
    expect(wordPlan(s, undefined, ix, 5)).toMatchObject({ mode: 'read', options: [], answer: -1 });
  });
});

describe('resolve: word cards', () => {
  const resolver = createResolver({ customs: [], media: [] });

  it('resolves a word of the content; an unknown word is an orphan', () => {
    const r = resolver.resolve('word:read~red' as CardId);
    expect(r?.kind === 'word' && r.source.item.say).toBe('I read it yesterday.');
    expect(resolver.resolve('word:gone~gon' as CardId)).toBeNull();
    expect(resolver.phenomenonOf('word:read~red' as CardId)).toBe(`lesson:${r?.kind === 'word' ? r.source.lessonId : ''}`);
  });
});
