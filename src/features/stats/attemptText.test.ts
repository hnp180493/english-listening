import { describe, expect, it } from 'vitest';
import { CHUNKS } from '../../data/chunks';
import { lessonLabel } from '../../data/courses';
import { LESSONS } from '../../data/lessons';
import { PAIR_SETS } from '../../data/pairs';
import { SENTENCES } from '../../data/sentences';
import { wordIndex } from '../../core/review/words';
import { attemptSource, attemptText } from './attemptText';

describe('attemptText', () => {
  it('turns ids into readable content', () => {
    const s = SENTENCES[0];
    expect(attemptText({ module: 'dictation', itemId: s.id })).toEqual({ text: s.text, en: true });
    expect(attemptText({ module: 'shadowing', itemId: s.id })?.text).toBe(s.text);

    const c = CHUNKS[0];
    const chunk = attemptText({ module: 'drill', itemId: c.id });
    expect(chunk?.text).toBe(c.written);

    const set = PAIR_SETS[0];
    expect(attemptText({ module: 'pairs', itemId: set.items[0].id })).toEqual({ text: set.title, en: false });

    const l = LESSONS[0];
    expect(attemptText({ module: 'lesson', itemId: `${l.id}:2` })?.text).toBe(`Bài ${l.order}: ${l.title}`);
  });

  it('names the course of lessons outside "Nghe nối âm"', () => {
    expect(lessonLabel({ course: 'connected', order: 3, title: 'Nối âm' })).toBe('Bài 3: Nối âm');
    expect(lessonLabel({ course: 'irregular', order: 2, title: 'colonel' })).toBe('Từ bất quy tắc · Bài 2: colonel');
  });

  it('word reviews show the word and its respelling, from "Từ đã học"', () => {
    const w = wordIndex().all[0];
    const a = { module: 'lesson' as const, itemId: w.id };
    expect(attemptText(a)).toEqual({ text: w.item.word, spoken: w.item.sound, en: true });
    expect(attemptSource(a, 'Bài học')).toBe('Từ đã học');
    expect(attemptSource({ module: 'lesson', itemId: 'intro:1' }, 'Bài học')).toBe('Bài học');
    // a word removed from the content: no text, still not a lesson
    expect(attemptText({ module: 'lesson', itemId: 'word:gone~gon' })).toBeNull();
    expect(attemptSource({ module: 'lesson', itemId: 'word:gone~gon' }, 'Bài học')).toBe('Từ đã học');
  });

  it('returns null for unknown or custom items', () => {
    expect(attemptText({ module: 'dictation', itemId: 'u-abc' })).toBeNull();
    expect(attemptText({ module: 'media', itemId: 'm1:3' })).toBeNull();
    expect(attemptText({ module: 'pairs', itemId: '' })).toBeNull();
  });
});
