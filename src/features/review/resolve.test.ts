import { describe, expect, it } from 'vitest';
import { PAIR_REVIEW_SIZE } from '../../core/review/constants';
import type { CardId } from '../../core/review/types';
import { PAIR_SETS } from '../../data/pairs';
import type { MediaItem } from '../media/library';
import { emptyProgress, type PairsProgress } from '../pairs/game';
import { speakerName } from '../../core/town/episodes';
import { TOWN_STORIES } from '../../data/townStories';
import { ALL_CHUNKS, createResolver, hashSeed, mediaSentence, pairReviewQuestions, talkSentence } from './resolve';

const NOW = new Date(2026, 10, 6, 12).getTime();

const mediaItem: MediaItem = {
  id: 'm1abc',
  kind: 'youtube',
  title: 'Phim ngắn',
  youtubeId: 'abc',
  createdAt: NOW,
  units: [
    { start: 0, end: 2, text: 'I want to go out tonight.' },
    { start: 2, end: 4, text: '   ' },
  ],
  progress: { unitIndex: 0, done: [], scores: {} },
};

const resolver = createResolver({
  customs: [{ id: 'u-lx3k9', text: 'Get it out of here.', vi: 'Mang nó ra khỏi đây.', level: 1, createdAt: NOW }],
  media: [mediaItem],
});

describe('createResolver', () => {
  it('resolves every kind', () => {
    const d = resolver.resolve('dict:s001' as CardId);
    expect(d?.kind === 'dict' && d.sentence.text).toBe('Turn it off, please.');
    const u = resolver.resolve('dict:u-lx3k9' as CardId);
    expect(u?.kind === 'dict' && u.custom).toBe(true);
    const p = resolver.resolve('pair:can-cant' as CardId);
    expect(p?.kind === 'pair' && p.set.id).toBe('can-cant');
    const l = resolver.resolve('lesson:linking' as CardId);
    expect(l?.kind === 'lesson' && l.lesson.quiz.length).toBeGreaterThan(0);
    const c = resolver.resolve(`chunk:${ALL_CHUNKS[0].id}` as CardId);
    expect(c?.kind === 'chunk' && c.chunk.id).toBe(ALL_CHUNKS[0].id);
    const m = resolver.resolve('media:m1abc:0' as CardId);
    expect(m?.kind === 'media' && m.itemId).toBe('m1abc');
    expect(m?.kind === 'media' && m.unit).toBe(0);
  });

  it('talk: a line of a town episode as a dictation, with who says it', () => {
    const ep = TOWN_STORIES[0];
    const line = ep.lines[0];
    const t = resolver.resolve(`talk:${line.id}` as CardId);
    if (t?.kind !== 'talk') throw new Error('not resolved');
    expect(t.sentence).toMatchObject({ id: `talk:${line.id}`, text: line.text, vi: line.vi, level: ep.level, topic: ep.title });
    expect(t.sentence.say).toBe(line.say);
    expect([t.who, t.placeId, t.episodeOrder, t.episodeTitle]).toEqual([line.who, ep.placeId, ep.order, ep.title]);
    expect(t.speaker).toBe(line.who === 'you' ? 'Bạn' : speakerName(line.who, ep.placeId));
    expect(resolver.resolve('talk:nope-1-01' as CardId)).toBeNull();
    const s = talkSentence('talk:x' as CardId, { text: 'Gotta go.', vi: 'Phải đi rồi.', say: 'Godda go.' }, { level: 2, title: 'T' });
    expect(s).toMatchObject({ id: 'talk:x', text: 'Gotta go.', say: 'Godda go.', level: 2, topic: 'T' });
    expect('say' in talkSentence('talk:x' as CardId, { text: 'Hi.', vi: 'Chào.' }, { level: 1, title: 'T' })).toBe(false);
  });

  it('returns null for orphans and junk', () => {
    for (const id of [
      'dict:s999',
      'dict:u-gone',
      'pair:nope',
      'lesson:nope',
      'chunk:nope',
      'media:m1abc:5',
      'media:m1abc:1', // blank line
      'media:other:0',
      'shadow:s001',
      'garbage',
    ]) {
      expect(resolver.resolve(id as CardId)).toBeNull();
    }
  });

  it('builds the media sentence shape', () => {
    const s = mediaSentence('media:m1abc:0' as CardId, mediaItem, 'I want to go out tonight.');
    expect(s.id).toBe('media:m1abc:0');
    expect(s.text).toBe('I want to go out tonight.');
    expect(s.vi).toBe('');
    expect(s.topic).toBe('Phim ngắn');
    expect([1, 2, 3]).toContain(s.level);
    expect(Array.isArray(s.focus)).toBe(true);
  });

  it('gives a phenomenon for the queue spread', () => {
    expect(resolver.phenomenonOf('pair:can-cant' as CardId)).toBe('weak-form');
    expect(resolver.phenomenonOf('dict:s001' as CardId)).toBe('linking');
    expect(resolver.phenomenonOf('dict:s999' as CardId)).toBeUndefined();
  });
});

describe('pairReviewQuestions', () => {
  const set = PAIR_SETS.find((s) => s.items.length > PAIR_REVIEW_SIZE)!;

  it('is deterministic and picks distinct items', () => {
    const a = pairReviewQuestions(set, emptyProgress(), NOW, 42);
    const b = pairReviewQuestions(set, emptyProgress(), NOW, 42);
    expect(a).toEqual(b);
    expect(a).toHaveLength(PAIR_REVIEW_SIZE);
    expect(new Set(a.map((q) => q.itemId)).size).toBe(PAIR_REVIEW_SIZE);
    for (const q of a) {
      expect(q.key).toBe(`${q.itemId}#0`);
      expect(q.setId).toBe(set.id);
      expect(q.requeue).toBe(false);
      const item = set.items.find((i) => i.id === q.itemId)!;
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(item.options.length);
    }
  });

  it('puts weak items first', () => {
    const items = set.items.map((i) => i.id);
    const progress: PairsProgress = emptyProgress();
    // everything mastered and recent, except the last two items which were just missed
    for (const id of items) progress.items[id] = { seen: 4, correct: 4, streak: 4, lastAt: NOW };
    const weak = items.slice(-2);
    for (const id of weak) progress.items[id] = { seen: 3, correct: 1, streak: 0, lastAt: NOW };
    for (const seed of [1, 2, 3, 99, hashSeed('pair:x:0')]) {
      const q = pairReviewQuestions(set, progress, NOW, seed);
      expect(new Set(q.slice(0, 2).map((x) => x.itemId))).toEqual(new Set(weak));
    }
  });

  it('works for a set smaller than the review size', () => {
    const small = { ...set, items: set.items.slice(0, 2) };
    expect(pairReviewQuestions(small, emptyProgress(), NOW, 7)).toHaveLength(2);
  });
});
