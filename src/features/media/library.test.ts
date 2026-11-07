import { describe, expect, it } from 'vitest';
import {
  DONE_SCORE,
  MAX_TRANSCRIPT_BYTES,
  averageScore,
  byteLength,
  clampIndex,
  createItem,
  donePercent,
  findYouTubeDuplicate,
  guessFileType,
  isMediaFile,
  nextUndone,
  playWindow,
  recordScore,
  relativeDay,
  resetProgress,
  sanitizeLibrary,
  setDone,
  setUnitIndex,
  sortItems,
  stripExtension,
  transcriptTooLarge,
  unitAtTime,
  wordCount,
  type MediaItem,
} from './library';

const UNITS = [
  { start: 0, end: 3, text: 'Hello there.' },
  { start: 3, end: 6, text: 'How are you?' },
  { start: 8, end: 10, text: 'Turn it off.' },
];

function yt(): MediaItem {
  return createItem({ kind: 'youtube', title: '  Demo  ', youtubeId: 'dQw4w9WgXcQ', units: UNITS }, 1000, 'id1');
}

describe('sanitizeLibrary', () => {
  it('returns an empty library for garbage', () => {
    for (const v of [null, undefined, 42, 'x', {}, { items: 'no' }]) {
      const lib = sanitizeLibrary(v);
      expect(lib.items).toEqual([]);
      expect(lib.prefs).toEqual({ speed: 1, autoLoop: false, showSubs: true, mode: 'watch' });
    }
  });

  it('keeps valid items and repairs progress', () => {
    const lib = sanitizeLibrary({
      items: [
        {
          id: 'a',
          kind: 'youtube',
          title: 'T',
          youtubeId: 'dQw4w9WgXcQ',
          createdAt: 5,
          units: [...UNITS, { start: 'x', end: 1, text: 'bad' }, { start: 1, end: 2, text: '   ' }],
          progress: { unitIndex: 99, done: [2, 2, 0, 7, -1, 'x'], scores: { 0: 0.5, 1: 4, 9: 1, foo: 1 } },
        },
        { id: 'a', kind: 'youtube', youtubeId: 'dQw4w9WgXcQ', units: [] }, // duplicate id
        { id: 'b', kind: 'youtube', youtubeId: 'bad', units: [] }, // invalid video id
        { id: 'c', kind: 'other', units: [] },
        { id: 'd', kind: 'file', fileName: 'talk.mp3', fileType: 'audio', units: UNITS, progress: null },
      ],
      prefs: { speed: 0.75, autoLoop: true, showSubs: 'yes', mode: 'dictation' },
    });
    expect(lib.items.map((i) => i.id)).toEqual(['a', 'd']);
    const a = lib.items[0];
    expect(a.units).toHaveLength(3);
    expect(a.progress).toEqual({ unitIndex: 0, done: [0, 2], scores: { 0: 0.5, 1: 1 } });
    expect(lib.items[1].fileType).toBe('audio');
    expect(lib.items[1].title).toBe('Không tên');
    expect(lib.prefs).toEqual({ speed: 0.75, autoLoop: true, showSubs: true, mode: 'dictation' });
  });

  it('accepts a legacy bare array', () => {
    expect(sanitizeLibrary([yt()]).items).toHaveLength(1);
  });

  it('round-trips through JSON', () => {
    const item = recordScore(yt(), 1, 0.9);
    const lib = sanitizeLibrary(JSON.parse(JSON.stringify({ items: [item], prefs: { speed: 0.5 } })));
    expect(lib.items[0]).toEqual(item);
  });

  it('keeps the prefs change time (folder sync keeps the prefs changed last)', () => {
    expect(sanitizeLibrary({ items: [], prefs: { speed: 0.5, changedAt: 77 } }).prefs.changedAt).toBe(77);
    expect(sanitizeLibrary({ items: [], prefs: { changedAt: -1 } }).prefs.changedAt).toBeUndefined();
  });
});

describe('createItem', () => {
  it('trims title and falls back to a default', () => {
    expect(yt().title).toBe('Demo');
    const f = createItem({ kind: 'file', title: '', fileName: 'my_podcast.mp3', fileType: 'audio', units: UNITS }, 1);
    expect(f.title).toBe('my podcast');
    expect(f.fileType).toBe('audio');
    expect(f.youtubeId).toBeUndefined();
    const y = createItem({ kind: 'youtube', title: ' ', youtubeId: 'dQw4w9WgXcQ', units: UNITS }, 1);
    expect(y.title).toBe('Video YouTube dQw4w9WgXcQ');
  });
  it('stripExtension', () => {
    expect(stripExtension('Lecture 01.webm')).toBe('Lecture 01');
    expect(stripExtension('noext')).toBe('noext');
  });
});

describe('progress updates', () => {
  it('recordScore keeps the best score and marks done at the threshold', () => {
    let it = yt();
    it = recordScore(it, 0, 0.5);
    expect(it.progress.scores[0]).toBe(0.5);
    expect(it.progress.done).toEqual([]);
    it = recordScore(it, 0, 0.3);
    expect(it.progress.scores[0]).toBe(0.5);
    it = recordScore(it, 0, DONE_SCORE);
    expect(it.progress.done).toEqual([0]);
    it = recordScore(it, 5, 1); // out of range: ignored
    expect(it.progress.scores[5]).toBeUndefined();
  });

  it('setDone / donePercent / nextUndone', () => {
    let it = yt();
    expect(donePercent(it)).toBe(0);
    it = setDone(it, 2, true);
    it = setDone(it, 0, true);
    expect(it.progress.done).toEqual([0, 2]);
    expect(donePercent(it)).toBe(67);
    expect(nextUndone(it, 0)).toBe(1);
    expect(nextUndone(it, 2)).toBe(1);
    it = setDone(it, 1, true);
    expect(nextUndone(it, 0)).toBe(-1);
    it = setDone(it, 1, false);
    expect(it.progress.done).toEqual([0, 2]);
  });

  it('setUnitIndex clamps and returns the same object when unchanged', () => {
    const it = yt();
    expect(setUnitIndex(it, 0)).toBe(it);
    expect(setUnitIndex(it, 99).progress.unitIndex).toBe(2);
    expect(setUnitIndex(it, -4).progress.unitIndex).toBe(0);
    expect(clampIndex(1.7, 3)).toBe(1);
    expect(clampIndex(5, 0)).toBe(0);
  });

  it('resetProgress and averageScore', () => {
    let it = recordScore(recordScore(yt(), 0, 1), 1, 0.5);
    expect(averageScore(it)).toBe(0.75);
    it = resetProgress(it);
    expect(averageScore(it)).toBeNull();
    expect(it.progress).toEqual({ unitIndex: 0, done: [], scores: {} });
  });
});

describe('playback helpers', () => {
  it('unitAtTime finds the unit that started last', () => {
    expect(unitAtTime(UNITS, -1)).toBe(-1);
    expect(unitAtTime(UNITS, 0)).toBe(0);
    expect(unitAtTime(UNITS, 4.2)).toBe(1);
    expect(unitAtTime(UNITS, 7)).toBe(1);
    expect(unitAtTime(UNITS, 100)).toBe(2);
    expect(unitAtTime([], 3)).toBe(-1);
  });

  it('playWindow adds lead-in and tail without bleeding into neighbours', () => {
    expect(playWindow(UNITS, 0)).toEqual({ start: 0, end: 3.1 });
    const w1 = playWindow(UNITS, 1);
    expect(w1.start).toBeCloseTo(2.95);
    expect(w1.end).toBeCloseTo(6.35);
    const w2 = playWindow(UNITS, 2);
    expect(w2.start).toBeCloseTo(7.85);
    expect(w2.end).toBeCloseTo(10.35);
    expect(playWindow(UNITS, 9)).toEqual({ start: 0, end: 0 });
  });
});

describe('misc', () => {
  it('byteLength / transcriptTooLarge', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('ệ')).toBe(3);
    expect(byteLength('😀')).toBe(4);
    expect(transcriptTooLarge('a'.repeat(MAX_TRANSCRIPT_BYTES))).toBe(false);
    expect(transcriptTooLarge('a'.repeat(MAX_TRANSCRIPT_BYTES + 1))).toBe(true);
  });

  it('wordCount ignores punctuation-only tokens', () => {
    expect(wordCount("Turn it off — now, okay?")).toBe(5);
  });

  it('relativeDay', () => {
    const now = new Date(2026, 10, 6, 12).getTime();
    expect(relativeDay(undefined, now)).toBe('Chưa mở');
    expect(relativeDay(new Date(2026, 10, 6, 1).getTime(), now)).toBe('Hôm nay');
    expect(relativeDay(new Date(2026, 10, 5, 23).getTime(), now)).toBe('Hôm qua');
    expect(relativeDay(new Date(2026, 10, 2).getTime(), now)).toBe('4 ngày trước');
    expect(relativeDay(new Date(2026, 8, 1).getTime(), now)).toBe('1/9/2026');
  });

  it('sortItems puts the most recently opened first', () => {
    const a = { ...yt(), id: 'a', createdAt: 1, openedAt: 50 };
    const b = { ...yt(), id: 'b', createdAt: 10, openedAt: undefined };
    const c = { ...yt(), id: 'c', createdAt: 5, openedAt: 100 };
    expect(sortItems([a, b, c]).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('file helpers', () => {
  it('guesses audio vs video from MIME, then extension', () => {
    expect(guessFileType('a.mp4', 'audio/mp4')).toBe('audio');
    expect(guessFileType('a.mp3', '')).toBe('audio');
    expect(guessFileType('Podcast.M4A', '')).toBe('audio');
    expect(guessFileType('clip.mkv', '')).toBe('video');
    expect(guessFileType('clip', 'video/webm')).toBe('video');
  });
  it('accepts media files without a MIME type by extension', () => {
    expect(isMediaFile('talk.mkv', '')).toBe(true);
    expect(isMediaFile('notes.pdf', '')).toBe(false);
    expect(isMediaFile('x.bin', 'application/pdf')).toBe(false);
    expect(isMediaFile('x', 'audio/mpeg')).toBe(true);
  });
  it('finds a YouTube duplicate', () => {
    const items = [yt()];
    expect(findYouTubeDuplicate(items, 'dQw4w9WgXcQ')?.id).toBe('id1');
    expect(findYouTubeDuplicate(items, 'aaaaaaaaaaa')).toBeNull();
    expect(findYouTubeDuplicate(items, null)).toBeNull();
  });
});
