// The pirate station on 91.5 (./pirate.ts, data/scenes/pirate.ts; docs/gta-story-3.md §7 item 6): every forged segment
// breaks exactly one rule of the fingerprint table, in its words, and that is the tell its question asks about; every
// real one breaks none; the questions ask only what the segment says; the voices are the browser's; the channel is on
// only while Act III is; a segment pays as a radio scene of the day.
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../decoder/sapiMisread';
import { PIRATE_SEGMENTS, PIRATE_SILENT } from '../../data/scenes/pirate';
import { CITY_SCENES } from '../../data/city';
import { CITY_JOBS } from '../../data/city/jobs';
import { emptyTownJobs, recordJob } from './jobProgress';
import { FINGERPRINT, pirateEnding, pirateNow, pirateSegments, pirateState, rulesBroken } from './pirate';
import { SCENE_VOICES } from './sceneTypes';
import { CAST_VOICES } from './voices';
import { cityPerson } from './cityPeople';
import { scenePay, sceneKindOf } from './world';

const strip = (s: string) => s.replace(/^"|"$/g, '');
const allText = (seg: (typeof PIRATE_SEGMENTS)[number]) => seg.lines.map((l) => l.text).join(' ');

describe('the pirate station: its segments', () => {
  it('at least twelve, unique ids that pay as radio scenes, every row of the fingerprint table covered', () => {
    expect(PIRATE_SEGMENTS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(PIRATE_SEGMENTS.map((s) => s.id)).size).toBe(PIRATE_SEGMENTS.length);
    for (const s of PIRATE_SEGMENTS) {
      expect(s.id).toMatch(/^fm-pirate-\d+$/);
      expect(sceneKindOf(s.id)).toBe('radio');
      expect(s.kind).toBe('radio');
    }
    for (const who of ['rico', 'marcus', 'sam', 'tom', 'tess', 'gus', 'mei', 'jun', 'delaney', 'kemp']) expect(PIRATE_SEGMENTS.some((s) => s.as === who), who).toBe(true);
    // both kinds of forgery, and real tapes between them
    for (const k of ['real', 'splice', 'imitation'] as const) expect(PIRATE_SEGMENTS.filter((s) => s.type === k).length, k).toBeGreaterThanOrEqual(3);
  });

  it('a forgery breaks exactly one rule, its tell; a cut tape a fact gone old, an imitation a habit; a real tape none', () => {
    for (const s of PIRATE_SEGMENTS) {
      const broken = rulesBroken(s);
      if (s.type === 'real') {
        expect(broken, `${s.id}: a real tape breaks ${broken.map((b) => b.rule.id).join(', ')}`).toEqual([]);
        expect(s.tell).toBeUndefined();
        continue;
      }
      expect(broken.length, `${s.id}: ${broken.map((b) => b.rule.id).join(', ')}`).toBe(1);
      const [b] = broken;
      expect(!!b.rule.old, s.id).toBe(s.type === 'splice');
      // the tell is in the words, and it is where the rule is broken
      expect(allText(s), s.id).toContain(s.tell!);
      const t = s.tell!.toLowerCase();
      const f = b.found.toLowerCase();
      expect(t.includes(f) || f.includes(t), `${s.id}: tell "${s.tell}" vs "${b.found}"`).toBe(true);
    }
  });

  it('the questions ask only what was said: real or fake, and the tell among three things the segment said', () => {
    for (const s of PIRATE_SEGMENTS) {
      expect(s.gist.answer).toBe(s.type === 'real' ? 0 : s.type === 'splice' ? 1 : 2);
      expect(s.detail, s.id).toBeDefined();
      const d = s.detail!;
      expect(new Set(d.options).size).toBe(3);
      if (s.type !== 'real') {
        // all three options are words of the segment; only the right one is the tell
        for (const o of d.options) expect(allText(s), `${s.id}: ${o}`).toContain(strip(o));
        expect(strip(d.options[d.answer])).toBe(s.tell);
        for (const [i, o] of d.options.entries()) if (i !== d.answer) expect(rulesBroken({ as: s.as, lines: [{ who: s.as, text: strip(o), vi: '' }] }), `${s.id}: ${o}`).toEqual([]);
      }
      expect(s.why.trim().length).toBeGreaterThan(0);
    }
    // the right answers are not always in the same place
    expect(new Set(PIRATE_SEGMENTS.filter((s) => s.type !== 'real').map((s) => s.detail!.answer)).size).toBe(3);
  });

  it('a cut tape that relies on a change of the story waits for the job that made it', () => {
    const ids = new Set(CITY_JOBS.map((j) => j.id));
    for (const s of PIRATE_SEGMENTS) if (s.needs) expect(ids.has(s.needs), s.id).toBe(true);
    // "Chip" goes old only when "Sam không gọi điện" changed the code
    expect(PIRATE_SEGMENTS.find((s) => s.tell === 'Chip')?.needs).toBe('job-samcall');
  });

  it("the browser's voice only: Westbay's people and the fakes; no town resident speaks", () => {
    for (const s of PIRATE_SEGMENTS)
      for (const l of s.lines) {
        expect(Object.hasOwn(CAST_VOICES, l.who), `${s.id}: ${l.who} is a town resident`).toBe(false);
        expect(!!cityPerson(l.who) || Object.hasOwn(SCENE_VOICES, l.who), `${s.id}: ${l.who}`).toBe(true);
      }
  });

  it('plain spoken English of 3–16 words that decodes and is SAPI-safe, each line with its meaning', () => {
    for (const s of PIRATE_SEGMENTS)
      for (const l of s.lines) {
        const n = l.text.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
        expect(n, l.text).toBeGreaterThanOrEqual(3);
        expect(n, l.text).toBeLessThanOrEqual(16);
        expect(l.text).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
        expect(decode(l.text).tokens.length).toBeGreaterThan(0);
        expect(speakableFor(l.text)).not.toMatch(SAPI_MISREAD);
        expect(speakableFor(l.text)).not.toMatch(LONE_APOSTROPHE);
        expect(l.vi.trim().length).toBeGreaterThan(0);
      }
  });

  it("a real tape that reuses the canon reuses it word for word (Jun's radio)", () => {
    const canon = new Set(CITY_SCENES.flatMap((s) => s.lines.map((l) => `${l.who}|${l.text}`)));
    const jun = PIRATE_SEGMENTS.find((s) => s.as === 'jun')!;
    for (const l of jun.lines) expect(canon.has(`${l.who}|${l.text}`), l.text).toBe(true);
  });

  it('the fingerprint rules hold for what the canon already says (no habit of the table is broken by a real line)', () => {
    const asOf: Record<string, string> = { rico: 'rico', marcus: 'marcus', tess: 'tess', gus: 'gus', mei: 'mei', delaney: 'delaney', kemp: 'kemp' };
    for (const sc of CITY_SCENES)
      for (const l of sc.lines) {
        const as = asOf[l.who];
        if (!as) continue;
        const broken = rulesBroken({ as, lines: [l] }).filter((b) => !b.rule.old);
        expect(broken.map((b) => b.rule.id), `${sc.id}: ${l.text}`).toEqual([]);
      }
    expect(FINGERPRINT.length).toBeGreaterThan(10);
  });
});

describe('the pirate station: when it plays', () => {
  const t0 = Date.UTC(2026, 10, 27, 10);
  const done = (...ids: string[]) => ids.reduce((s, id, i) => recordJob(s, id, 'clean', id === 'job-live' ? ['end-middle'] : [], t0 + i), emptyTownJobs());

  it('off before Act III, on from "Tin nhắn không phải của Rico" to "Phát sóng trực tiếp", then silent with its ending; on in the sandbox', () => {
    expect(pirateState(emptyTownJobs())).toBe('off');
    expect(pirateState(done('job-warehouse'))).toBe('off');
    expect(pirateState(done('job-forged'))).toBe('on');
    expect(pirateState(done('job-forged', 'job-live'))).toBe('ended');
    expect(pirateEnding(done('job-forged', 'job-live'))).toBe('middle');
    expect(pirateEnding(done('job-forged'))).toBe('none');
    expect(pirateState(emptyTownJobs(), true)).toBe('on');
    for (const k of ['best', 'middle', 'worst', 'none'] as const) expect(PIRATE_SILENT[k].length).toBeGreaterThan(0);
  });

  it('a cut tape waits for its job; the channel plays one not heard lately, and stays on it for the hour', () => {
    const before = pirateSegments(PIRATE_SEGMENTS, done('job-forged'));
    expect(before.some((s) => s.needs === 'job-samcall')).toBe(false);
    const after = pirateSegments(PIRATE_SEGMENTS, done('job-forged', 'job-samcall'));
    expect(after.length).toBe(PIRATE_SEGMENTS.length);
    expect(pirateSegments(PIRATE_SEGMENTS, emptyTownJobs(), true).length).toBe(PIRATE_SEGMENTS.length);
    const a = pirateNow(after, new Set(), t0)!;
    expect(pirateNow(after, new Set(), t0 + 60_000)!.id).toBe(a.id);
    const heard = new Set(after.slice(0, -1).map((s) => s.id));
    expect(pirateNow(after, heard, t0)!.id).toBe(after[after.length - 1].id);
    expect(pirateNow([], new Set(), t0)).toBeNull();
  });

  it("pays as a radio scene: 2 xu a question right at the first try, inside the radio's three a day", () => {
    const s = PIRATE_SEGMENTS[0];
    expect(scenePay(s, { asked: 2, right: 2, plays: 1 }, []).xu).toBe(4);
    expect(scenePay(s, { asked: 2, right: 2, plays: 1 }, ['fm-1', 'fm-live-5', 'fm-call-1']).capped).toBe(true);
    expect(scenePay(s, { asked: 2, right: 2, plays: 1 }, [s.id]).xu).toBe(0);
  });
});
