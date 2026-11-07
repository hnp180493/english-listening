import { describe, expect, it } from 'vitest';
import { CONNECTED_LESSONS, REAL_SECTION_TITLE } from '../../data/lessons';
import type { Lesson } from '../../data/lessons';
import { REAL_CLIPS } from '../../data/realClips';
import { embedUrl, splitFocus, watchUrl } from './realClipUrls';
import { lessonProblems } from './validate';

const PHENOMENON_LESSONS = ['weak-form', 'linking', 'flap-t', 'elision', 'assimilation', 'h-dropping', 'contraction', 'reduction'];

describe('real clips ("Nghe người thật nói")', () => {
  it('every phenomenon lesson ends with a real-clips section of 2 clips, before the quiz', () => {
    for (const id of PHENOMENON_LESSONS) {
      const lesson = CONNECTED_LESSONS.find((l) => l.id === id)!;
      const last = lesson.sections[lesson.sections.length - 1];
      expect(last.title, id).toBe(REAL_SECTION_TITLE);
      expect(last.blocks).toHaveLength(1);
      const block = last.blocks[0];
      expect(block.type).toBe('real');
      if (block.type === 'real') expect(block.clips).toHaveLength(2);
    }
    // intro and review have none
    for (const id of ['intro', 'review']) expect(CONNECTED_LESSONS.find((l) => l.id === id)!.sections.some((s) => s.title === REAL_SECTION_TITLE)).toBe(false);
  });

  it('every clip is well formed (validator)', () => {
    for (const l of CONNECTED_LESSONS) expect(lessonProblems(l).filter((p) => p.includes('clip')), l.id).toEqual([]);
    expect(Object.keys(REAL_CLIPS).sort()).toEqual([...PHENOMENON_LESSONS].sort());
  });

  it('the validator catches broken clips', () => {
    const base = CONNECTED_LESSONS.find((l) => l.id === 'reduction')!;
    const bad: Lesson = {
      ...base,
      sections: [
        ...base.sections.slice(0, -1),
        {
          title: REAL_SECTION_TITLE,
          blocks: [{ type: 'real', clips: [{ videoId: 'short', start: 10, end: 40, text: 'hello there', focus: 'gonna', note: 'x', source: 'y' }] }],
        },
      ],
    };
    const problems = lessonProblems(bad).join('\n');
    expect(problems).toMatch(/videoId/);
    expect(problems).toMatch(/start\/end/);
    expect(problems).toMatch(/focus "gonna" is not in the text/);
  });

  it('highlights the focus phrase case-insensitively', () => {
    expect(splitFocus('Last night the man', 'last night')).toEqual({ before: '', match: 'Last night', after: ' the man' });
    expect(splitFocus('we are all gonna move', 'gonna')).toEqual({ before: 'we are all ', match: 'gonna', after: ' move' });
    expect(splitFocus('no match here', 'gonna')).toEqual({ before: 'no match here', match: '', after: '' });
  });

  it('builds privacy-friendly embed and watch URLs for the clip window only', () => {
    const c = { videoId: 'p0v62FYKLNA', start: 478, end: 486 };
    const u = new URL(embedUrl(c));
    expect(u.origin).toBe('https://www.youtube-nocookie.com');
    expect(u.pathname).toBe('/embed/p0v62FYKLNA');
    expect(u.searchParams.get('start')).toBe('478');
    expect(u.searchParams.get('end')).toBe('486');
    expect(u.searchParams.get('autoplay')).toBe('1');
    const w = new URL(watchUrl(c));
    expect(w.origin).toBe('https://www.youtube.com');
    expect(w.searchParams.get('v')).toBe('p0v62FYKLNA');
    expect(w.searchParams.get('t')).toBe('478s');
  });
});
