// Content checks for Westbay's jobs ("phi vụ", core/town/jobDoc.ts; docs/gta-plan.md §3, §12–13): every job
// document is well formed (every fact has its consequence and a rejoin and plays out, every junction is on a road,
// only Westbay's people, the new ones and the learner speak), the English follows the city's rules (docs/city.md §5),
// the notebook offers its answer, and the lines resolve as review cards.
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../../core/decoder/sapiMisread';
import { cityPerson } from '../../../core/town/cityPeople';
import { fillLine, timeWords } from '../../../core/town/job';
import { wellFormed, type JobDoc, type Step } from '../../../core/town/jobDoc';
import { judgeTyped } from '../../../core/town/typing';
import { SCENE_VOICES } from '../../../core/town/sceneTypes';
import { CAST_VOICES } from '../../../core/town/voices';
import { CITY_PLACE_IDS, CITY_ROWS } from '../../cityWorld';
import { SENTENCES } from '../../sentences';
import { CITY_SCENES } from '../index';
import { allJobRefs, CITY_JOBS, jobLine, jobLineByRef } from './index';

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const speaker = (who: string) => who === 'player' || !!cityPerson(who) || Object.hasOwn(SCENE_VOICES, who);
const WORLD = {
  speaker,
  place: (id: string) => (CITY_PLACE_IDS as readonly string[]).includes(id),
  road: (x: number, y: number) => CITY_ROWS[y]?.[x] === '=',
};
const notebookOf = (doc: JobDoc) => doc.steps.find((s): s is Extract<Step, { kind: 'notebook' }> => s.kind === 'notebook')!;

describe('the jobs', () => {
  it('are the two drafts, Act I job 1 first, with unique orders', () => {
    expect(CITY_JOBS.map((j) => j.id)).toEqual(['job-m2', 'job-ferry']);
    expect(new Set(CITY_JOBS.map((j) => j.order)).size).toBe(CITY_JOBS.length);
  });
});

describe.each(CITY_JOBS.map((j) => [j.id, j] as const))('job %s', (_, job) => {
  it('is well formed: lines said, speakers allowed, places on the map, junctions on roads, every fact with its consequence and rejoin, played out', () => {
    expect(wellFormed(job, WORLD)).toEqual([]);
  });

  it('has its lines under its own prefix; nobody of the town speaks (no clips to generate)', () => {
    for (const l of job.lines) {
      expect(l.id.startsWith(`${job.id}-`), l.id).toBe(true);
      expect(l.who !== 'player' && Object.hasOwn(CAST_VOICES, l.who), `${l.id}: a town resident needs clips`).toBe(false);
    }
  });

  it('plain spoken English, 3–16 words, decodable, SAPI-safe, with the appointment filled in at its longest', () => {
    for (const raw of job.lines) {
      const l = fillLine(raw, 23 * 60 + 45);
      expect(l.text, l.id).toBe(l.text.trim());
      expect(l.text, l.id).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
      expect(l.text, l.id).toMatch(/[.?!]$/);
      const n = wordCount(l.text);
      expect(n, `${l.id}: ${l.text}`).toBeGreaterThanOrEqual(3);
      expect(n, `${l.id}: ${l.text}`).toBeLessThanOrEqual(16);
      expect(decode(l.text).tokens.length, l.id).toBeGreaterThan(0);
      const sent = speakableFor(l.text, l.say);
      expect(sent, `${l.id}: ${sent}`).not.toMatch(SAPI_MISREAD);
      expect(sent, `${l.id}: ${sent}`).not.toMatch(LONE_APOSTROPHE);
      expect(l.vi.trim().length, l.id).toBeGreaterThan(0);
      expect(l.vi.includes('{time}'), l.id).toBe(false);
    }
    expect(timeWords(23 * 60 + 45)).toBe('quarter to twelve');
  });

  it('copies no dictation sentence and no line of the city scenes', () => {
    const taken = new Set([...SENTENCES.map((s) => norm(s.text)), ...CITY_SCENES.flatMap((s) => s.lines.map((l) => norm(l.text)))]);
    for (const l of job.lines) expect(taken.has(norm(l.text)), `${l.id}: ${l.text}`).toBe(false);
  });

  it('the notebook: three or four entries, three different ways each, the answer among them, each said in the briefing', () => {
    const nb = notebookOf(job);
    expect(nb.entries.length).toBeGreaterThanOrEqual(3);
    expect(nb.entries.length).toBeLessThanOrEqual(4);
    const call = nb.call.map((x) => (typeof x === 'string' ? x : x.line));
    for (const e of nb.entries) {
      expect(call, e.key).toContain(e.line);
      if (e.key === 'time') {
        expect(jobLine(e.line)?.line.text).toContain('{time}');
        continue;
      }
      expect(e.options).toHaveLength(3);
      expect(new Set(e.options.map((o) => o.value)).size).toBe(3);
      expect(e.options.map((o) => o.value)).toContain(e.answer);
    }
  });

  it('a pickup or a ride led by an entry leads every one of its values somewhere on the map, the answer to the right place', () => {
    const nb = notebookOf(job);
    for (const s of job.steps) {
      if ((s.kind === 'pickup' || s.kind === 'ride') && s.entry) {
        const e = nb.entries.find((x) => x.key === s.entry)!;
        for (const o of e.options) expect(WORLD.place(s.places![o.value]), `${s.kind} ${o.value}`).toBe(true);
        expect(s.places![e.answer]).toBe(s.place);
      }
    }
  });

  it('a password is a chunk of the line it is said in, and typing it is judged right', () => {
    for (const s of job.steps) {
      if (s.kind !== 'password') continue;
      expect(jobLine(s.line)!.line.text.toLowerCase()).toContain(s.chunk);
      expect(judgeTyped(s.chunk, s.chunk).correct).toBe(true);
    }
  });
});

describe('job lines as review cards', () => {
  it('every ref resolves to a line, a templated line with its time filled in', () => {
    const all = allJobRefs();
    expect(new Set(all).size).toBe(all.length);
    for (const ref of all) {
      const found = jobLineByRef(ref);
      expect(found, ref).toBeDefined();
      expect(found!.line.text.includes('{time}'), ref).toBe(false);
    }
    expect(jobLineByRef('job-ferry-c04')).toBeUndefined();
    expect(jobLineByRef('job-ferry-c04-t1845')?.line.text).toBe("Be there at quarter to seven. He's got a ferry to catch.");
    expect(jobLineByRef('job-m2-12-t1915')?.line.text).toBe("Say quarter past seven, if that's alright. I'll be in a navy coat.");
    expect(jobLineByRef('cafe-1-01')).toBeUndefined();
  });
});
