// Content checks for Westbay's jobs ("phi vụ", core/town/job.ts; docs/gta-plan.md §3): every part of a script points
// at a line that exists, the speakers are Westbay's people (browser voice, no clips), the English follows the city's
// rules (docs/city.md §5), the notebook offers its answer, and the places and zones are on Westbay's map.
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../../core/decoder/sapiMisread';
import { cityPerson } from '../../../core/town/cityPeople';
import { fillLine, timeWords, waysOf, type JobScript } from '../../../core/town/job';
import { judgeTyped } from '../../../core/town/typing';
import { SCENE_VOICES } from '../../../core/town/sceneTypes';
import { CAST_VOICES } from '../../../core/town/voices';
import { CITY_PLACE_IDS, CITY_PLACES, CITY_ROWS } from '../../cityWorld';
import { SENTENCES } from '../../sentences';
import { CITY_SCENES } from '../index';
import { allJobRefs, CITY_JOBS, jobLine, jobLineByRef } from './index';

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Every line id a script refers to. */
function refs(j: JobScript): string[] {
  return [
    ...j.call,
    ...j.notebook.map((e) => e.line),
    ...Object.values(j.notMe),
    j.callOut,
    ...Object.values(j.greet),
    ...j.wrongPlace,
    ...j.junctions.flatMap((x) => [x.line, ...Object.values(x.ways).flatMap((w) => (w?.line ? [w.line] : []))]),
    j.again,
    j.dropoff.near,
    j.dropoff.arrive,
    ...j.brief,
    ...j.overhear.lines,
    j.overhear.noticed,
    j.password.line,
    j.password.ask,
    j.password.right,
    j.password.close,
    j.password.wrong,
    ...Object.values(j.ending).flat(),
    ...Object.values(j.news).flat(),
  ];
}

const street = (p: { x: number; y: number }) => CITY_ROWS[p.y]?.[p.x] === '=';

describe.each(CITY_JOBS.map((j) => [j.id, j] as const))('job %s', (_, job) => {
  const ids = new Set(job.lines.map((l) => l.id));

  it('has unique line ids under its own prefix, and every part points at one of them; no line goes unused', () => {
    expect(ids.size).toBe(job.lines.length);
    for (const l of job.lines) expect(l.id.startsWith(`${job.id}-`), l.id).toBe(true);
    const used = refs(job);
    for (const r of used) expect(ids.has(r), r).toBe(true);
    for (const l of job.lines) expect(used.includes(l.id), `${l.id} is never said`).toBe(true);
  });

  it("is said by Westbay's people and voices only heard: the browser's voice, no clips to generate", () => {
    for (const l of job.lines) {
      expect(!!cityPerson(l.who) || Object.hasOwn(SCENE_VOICES, l.who), `${l.id}: ${l.who}`).toBe(true);
      expect(Object.hasOwn(CAST_VOICES, l.who), `${l.id}: a town resident needs clips`).toBe(false);
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

  it('the notebook: four entries, three different ways each, the answer among them, each said in the call', () => {
    expect(job.notebook.map((e) => e.key).sort()).toEqual(['avoid', 'look', 'pickup', 'time']);
    for (const e of job.notebook) {
      expect(job.call.includes(e.line), e.key).toBe(true);
      if (e.key === 'time') {
        expect(jobLine(e.line)?.line.text).toContain('{time}');
        continue;
      }
      expect(e.options).toHaveLength(3);
      expect(new Set(e.options.map((o) => o.value)).size).toBe(3);
      expect(new Set(e.options.map((o) => o.label)).size).toBe(3);
      expect(e.options.map((o) => o.value)).toContain(e.answer);
    }
    const pickup = job.notebook.find((e) => e.key === 'pickup')!;
    for (const o of pickup.options) expect(CITY_PLACE_IDS as readonly string[], o.value).toContain(job.places[o.value]);
    expect(job.places[pickup.answer]).toBe(job.pickup.place);
  });

  it('the people and places are on the map: the crowd, the passenger, the two overheard, the drop-off', () => {
    const places = CITY_PLACE_IDS as readonly string[];
    for (const id of [job.pickup.place, job.pickup.host, job.pickup.passenger, ...job.pickup.crowd, job.dropoff.place, job.overhear.host, ...job.overhear.who, job.password.who]) expect(places, id).toContain(id);
    expect(job.pickup.crowd.length + 2).toBeGreaterThanOrEqual(5);
    expect(job.pickup.crowd).not.toContain(job.pickup.passenger);
    for (const id of [...job.pickup.crowd, job.pickup.host]) expect(Object.hasOwn(job.notMe, id), id).toBe(true);
    expect(job.overhear.who).toContain(job.password.who);
  });

  it('the junctions: on the streets of the map, the right way among the ways out, a line for every wrong way and none for the right one', () => {
    expect(job.junctions.length).toBeGreaterThanOrEqual(3);
    expect(job.junctions.length).toBeLessThanOrEqual(5);
    expect(new Set(job.junctions.map((x) => x.id)).size).toBe(job.junctions.length);
    for (const x of job.junctions) {
      expect(street(x.at), x.id).toBe(true);
      expect(waysOf(x).length, x.id).toBeGreaterThanOrEqual(2);
      expect(waysOf(x), x.id).toContain(x.right);
      for (const t of waysOf(x)) {
        const w = x.ways[t]!;
        expect(street(w.to), `${x.id} ${t}`).toBe(true);
        expect(Math.hypot(w.to.x - x.at.x, w.to.y - x.at.y), `${x.id} ${t}`).toBeGreaterThan(4);
        expect(!!w.line, `${x.id} ${t}`).toBe(t !== x.right);
      }
    }
    // the passenger corrects himself at least once (the owner's sample: "second left… no, sorry, the next one")
    expect(job.junctions.some((x) => /no, sorry/i.test(jobLine(x.line)!.line.text))).toBe(true);
    // the wrong time's consequence says the time again
    expect(jobLine(job.greet.late)!.line.text).toContain('{time}');
    // the drop-off is a place of the map
    expect(CITY_PLACES.some((p) => (p.id as string) === job.dropoff.place)).toBe(true);
  });

  it('the password is a chunk of the line it is said in, and typing it is judged right', () => {
    const line = jobLine(job.password.line)!.line;
    expect(line.text.toLowerCase()).toContain(job.password.chunk);
    expect(job.overhear.lines).toContain(job.password.line);
    expect(judgeTyped(job.password.chunk, job.password.chunk).correct).toBe(true);
    expect(judgeTyped(job.password.chunk, 'outta order').correct).toBe(true);
    expect(judgeTyped(job.password.chunk, 'out of date').correct).toBe(false);
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
      expect(found!.line.id).toBe(ref);
    }
    expect(jobLineByRef('job-ferry-c04')).toBeUndefined();
    expect(jobLineByRef('job-ferry-c04-t1845')?.line.text).toBe("Be there at quarter to seven. He's got a ferry to catch.");
    expect(jobLineByRef('cafe-1-01')).toBeUndefined();
  });
});
