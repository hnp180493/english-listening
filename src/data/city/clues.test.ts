// The clues (./clues.ts, docs/gta-plan.md §17): each is a line really heard where it comes from, every clue a job reads
// exists, and what Bay FM reads is plain spoken English the browser voice says right.
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../core/decoder/sapiMisread';
import type { Cond } from '../../core/town/jobDoc';
import { LISTEN_SCENES } from '../scenes';
import { CITY_EVENT_SCENES, CITY_OVERHEARD, CITY_SCENES } from './index';
import { CITY_JOBS } from './jobs';
import { CLUES, cluesOfScene, radioClueNews } from './clues';
import { PHONE_LINES } from './phoneLines';

const scenes = [...LISTEN_SCENES, ...CITY_EVENT_SCENES, ...CITY_OVERHEARD, ...CITY_SCENES] as readonly { id: string; lines: readonly { who: string; text: string }[] }[];
const spokenOk = (text: string) => {
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
  expect(words, text).toBeGreaterThanOrEqual(3);
  expect(words, text).toBeLessThanOrEqual(16);
  expect(text, text).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
  expect(decode(text).tokens.length).toBeGreaterThan(0);
  const said = speakableFor(text);
  expect(said, said).not.toMatch(SAPI_MISREAD);
  expect(said, said).not.toMatch(LONE_APOSTROPHE);
};

describe('the clues', () => {
  it('have unique ids; a scene clue is a line said in that scene by that person', () => {
    expect(new Set(CLUES.map((c) => c.id)).size).toBe(CLUES.length);
    for (const c of CLUES) {
      expect(c.id).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
      expect(c.note.trim().length).toBeGreaterThan(0);
      if ('scene' in c.from) {
        const sc = scenes.find((s) => s.id === (c.from as { scene: string }).scene);
        expect(sc, c.id).toBeDefined();
        expect(sc!.lines.some((l) => l.text === c.text && l.who === c.who), c.id).toBe(true);
        expect(cluesOfScene(sc!.id)).toContain(c.id);
      }
    }
  });

  it("Bay FM reads its clues until the learner has them, in plain spoken English", () => {
    const news = radioClueNews(() => false);
    expect(news.length).toBeGreaterThan(0);
    for (const n of news) for (const l of n.lines) spokenOk(l.text);
    expect(radioClueNews(() => true)).toEqual([]);
  });

  it('every clue a job reads or gives exists, and each sample is used by a job', () => {
    const ids = new Set(CLUES.map((c) => c.id));
    const used = new Set<string>();
    const walk = (c: Cond | undefined): void => {
      if (!c) return;
      if ('clue' in c) used.add(c.clue);
      if ('not' in c) walk(c.not);
      if ('all' in c) c.all.forEach(walk);
      if ('any' in c) c.any.forEach(walk);
    };
    for (const j of CITY_JOBS)
      for (const s of j.steps) {
        if ('if' in s) walk(s.if);
        if ('clue' in s && s.clue) expect(ids.has(s.clue), s.clue).toBe(true);
        for (const k of ['lines', 'greet', 'arrive', 'near'] as const) {
          const list = (s as Record<string, unknown>)[k];
          if (Array.isArray(list)) for (const x of list) if (typeof x === 'object' && x) walk((x as { if: Cond }).if);
        }
      }
    for (const u of used) expect(ids.has(u), u).toBe(true);
    for (const c of CLUES) expect(used.has(c.id), `${c.id} shortens no step`).toBe(true);
  });

  it("the phone's lines are plain spoken English with the deadline said", () => {
    for (const l of Object.values(PHONE_LINES)) spokenOk(l.text.replace('{time}', "quarter to twelve"));
  });
});
