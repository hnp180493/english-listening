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
import { CREW_CUT } from '../../../core/town/crew';
import { findStreet } from '../../../core/town/jobPatrol';
import { westbayNet } from '../../../core/town/streets';
import { isJobSpot } from './spots';
import { allJobRefs, CITY_JOBS, jobLine, jobLineByRef } from './index';

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const speaker = (who: string) => who === 'player' || !!cityPerson(who) || Object.hasOwn(SCENE_VOICES, who) || Object.hasOwn(CAST_VOICES, who);
const WORLD = {
  speaker,
  place: (id: string) => (CITY_PLACE_IDS as readonly string[]).includes(id) || isJobSpot(id),
  street: (name: string) => !!findStreet(westbayNet(), name),
  road: (x: number, y: number) => CITY_ROWS[y]?.[x] === '=',
};
type Notebook = Extract<Step, { kind: 'notebook' }>;
const notebooksOf = (doc: JobDoc) => doc.steps.filter((s): s is Notebook => s.kind === 'notebook');
const entriesOf = (doc: JobDoc) => notebooksOf(doc).flatMap((n) => n.entries);

describe('the jobs', () => {
  it('Act I in its order, with unique orders; the chain points at jobs that exist, never in a loop', () => {
    const ids = CITY_JOBS.map((j) => j.id);
    const act = ['job-m2', 'job-half5', 'job-chip', 'job-three', 'job-delaney'];
    for (const id of [...act, 'job-ferry']) expect(ids).toContain(id);
    expect(act.map((a) => ids.indexOf(a))).toEqual(act.map((a) => ids.indexOf(a)).sort((x, y) => x - y));
    expect(new Set(CITY_JOBS.map((j) => j.order)).size).toBe(CITY_JOBS.length);
    const byId = new Map(CITY_JOBS.map((j) => [j.id, j]));
    for (const j of CITY_JOBS) {
      if (j.after) expect(byId.has(j.after), `${j.id} after ${j.after}`).toBe(true);
      const seen = new Set<string>();
      for (let k: JobDoc | undefined = j; k?.after; k = byId.get(k.after)) {
        expect(seen.has(k.id), `${j.id}: the chain loops`).toBe(false);
        seen.add(k.id);
      }
    }
    expect(['job-half5', 'job-chip', 'job-three', 'job-delaney'].map((j) => byId.get(j)?.after)).toEqual(['job-m2', 'job-half5', 'job-chip', 'job-three']);
    expect(byId.get('job-ferry')?.side).toBe(true);
    // the engine's samples for Act II (gta-plan §17): a crew, a voice message, two clues
    expect(byId.get('job-chip')?.crew?.roles.map((r) => r.who)).toEqual(['jun', 'phone']);
    expect(byId.get('job-delaney')?.steps.some((s) => s.kind === 'notebook' && s.via === 'voicemail')).toBe(true);
  });
});

describe.each(CITY_JOBS.map((j) => [j.id, j] as const))('job %s', (_, job) => {
  it('is well formed: lines said, speakers allowed, places on the map, junctions on roads, every fact with its consequence and rejoin, played out', () => {
    expect(wellFormed(job, WORLD)).toEqual([]);
  });

  it('has its lines under its own prefix; a town resident speaks only lines that can be clipped (no {time})', () => {
    for (const l of job.lines) {
      expect(l.id.startsWith(`${job.id}-`), l.id).toBe(true);
      if (l.who !== 'player' && Object.hasOwn(CAST_VOICES, l.who)) expect(l.text.includes('{time}'), `${l.id}: a resident's line is a clip`).toBe(false);
    }
  });

  it('plain spoken English, 3–16 words, decodable, SAPI-safe, with the appointment filled in at its longest', () => {
    for (const raw of job.lines) {
      const l = fillLine(raw, 23 * 60 + 45, job.clock);
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

  it('each notebook: two to four entries (two or more in all), three different ways each, the answer among them, each said in its briefing', () => {
    const nbs = notebooksOf(job);
    expect(entriesOf(job).length).toBeGreaterThanOrEqual(2);
    for (const nb of nbs) {
    expect(nb.entries.length).toBeGreaterThanOrEqual(2);
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
    }
  });

  it('a pickup or a ride led by an entry leads every one of its values somewhere on the map, the answer to the right place', () => {
    const entries = entriesOf(job);
    for (const s of job.steps) {
      if ((s.kind === 'pickup' || s.kind === 'ride') && s.entry) {
        const e = entries.find((x) => x.key === s.entry)!;
        for (const o of e.options) expect(WORLD.place(s.places![o.value]), `${s.kind} ${o.value}`).toBe(true);
        expect(s.places![e.answer]).toBe(s.place);
      }
    }
  });

  it('the crew: a Westbay person opened by talks that exist, a town resident by hearts and riding along, a named cut', () => {
    for (const r of job.crew?.roles ?? []) {
      expect((Object.values(CREW_CUT) as number[]).includes(r.cut), `${r.who}: a cut of CREW_CUT`).toBe(true);
      if (Object.hasOwn(CAST_VOICES, r.who)) {
        // a town resident has no body up here unless visiting: they ride along (or are not seen)
        expect('hearts' in r.opens, r.who).toBe(true);
        expect(r.with === undefined || r.with === 'ride', r.who).toBe(true);
      } else {
        expect(cityPerson(r.who), r.who).toBeDefined();
        expect('heard' in r.opens, r.who).toBe(true);
        if ('heard' in r.opens) for (const sid of r.opens.heard) expect(CITY_SCENES.some((x) => x.id === sid), sid).toBe(true);
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
