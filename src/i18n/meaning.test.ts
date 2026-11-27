import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { answerGroups, readAllDictionaries, visibleEntries } from '../../scripts/i18n-scan.mjs';
import ui from './en/ui';
import content from './en/content';
import town from './en/town';
import city from './en/city';
import { addDictionary, resetDictionary, setActiveLang, tr } from './lang';
import { TOWN_PLACES, placeLines } from '../data/town';
import { TOWN_STORIES } from '../data/townStories';
import { choicesFor } from '../core/town/visit';
import { storyChoices } from '../core/town/episodes';
import { episodeTownLines } from '../core/town/storyLines';
import { soundAlikesOf } from '../core/town/soundAlike';
import type { TownLine } from '../core/town/types';
import { isVietnamese } from '../../scripts/i18n-scan.mjs';
import { CITY_JOBS } from '../data/city/jobs';
import { fillLine } from '../core/town/job';
import { officerScene, scanLines, type ScanFacts, type ScanLine } from '../core/town/scanner';
import { assetReport } from '../core/town/assets';
import { bulletinAt } from '../core/town/radio';
import { westbayNet } from '../core/town/streets';
import { seedTraffic } from '../core/town/traffic';
import { TOWN_EVENTS } from '../core/town/world';
import { RADIO_CALLS } from '../data/scenes/radioCalls';
import { PIRATE_SEGMENTS } from '../data/scenes/pirate';
import type { ListenScene } from '../core/town/sceneTypes';

// The meanings of the English lines in English mode (docs/i18n.md §4): the answers of one question must stay different
// once they are English, and a "careless ear" wrong answer made by rule (him ↔ them, -teen ↔ -ty) must still be made.

const english = visibleEntries(readAllDictionaries(), 'city');
const norm = (s: string) => s.trim().toLowerCase().replace(/[.!?…]+$/, '');

describe('the meanings in English', () => {
  it('every answer of a question has English, and different answers stay different', () => {
    const groups = answerGroups();
    expect(groups.length).toBeGreaterThan(300);
    const bad: string[] = [];
    for (const { at, group } of groups) {
      const ens = group.map((g) => english.get(g));
      if (ens.some((e) => !e)) {
        bad.push(`${at}: no English for ${group.filter((_, i) => !ens[i]).join(' | ')}`);
        continue;
      }
      if (new Set(group.map(norm)).size === group.length && new Set(ens.map((e) => norm(e!))).size !== ens.length) bad.push(`${at}: ${ens.join(' | ')}`);
    }
    expect(bad.slice(0, 20).join('\n')).toBe('');
  });

  describe('the town checks, English mode', () => {
    beforeAll(() => {
      for (const d of [ui, content, town, city]) addDictionary(d);
    });
    afterAll(() => {
      setActiveLang('vi');
      resetDictionary();
    });

    const pools: { pool: readonly TownLine[]; story: boolean }[] = [
      ...TOWN_PLACES.map((p) => ({ pool: placeLines(p.id), story: false })),
      ...TOWN_STORIES.map((e) => ({ pool: episodeTownLines(e), story: true })),
    ];

    it('quick chats and episodes: the options of every line are different English texts', () => {
      setActiveLang('en');
      const bad: string[] = [];
      for (const p of TOWN_PLACES)
        for (const line of placeLines(p.id))
          for (const seed of [0, 1, 2]) {
            const opts = choicesFor(line, placeLines(p.id), seed).options.map((o) => norm(tr(o)));
            if (new Set(opts).size !== opts.length) bad.push(`${line.id}: ${opts.join(' | ')}`);
          }
      for (const ep of TOWN_STORIES)
        for (const line of episodeTownLines(ep))
          for (const seed of [0, 1]) {
            const opts = storyChoices(line.id, ep, seed).options.map((o) => norm(tr(o)));
            if (new Set(opts).size !== opts.length) bad.push(`${line.id}: ${opts.join(' | ')}`);
          }
      expect(bad.slice(0, 20).join('\n')).toBe('');
    });

    it('meanings filled in as they are shown (a job line with {time}, the scanner, an asset report) come out in English', () => {
      setActiveLang('en');
      const bad: string[] = [];
      for (const job of CITY_JOBS) for (const l of job.lines) if (l.vi.includes('{time}') && isVietnamese(fillLine(l, 17 * 60 + 30).vi)) bad.push(`${l.id}: ${fillLine(l, 17 * 60 + 30).vi}`);
      const kinds = ['start', 'update', 'spotted', 'lost', 'lostLook'] as const;
      for (const on of ['foot', 'car', 'scooter'] as const)
        for (const kind of kinds)
          for (const pick of [0, 1, 2]) {
            const f = { unit: 12, look: { on, colour: on === 'foot' ? null : 'red', outfit: 'blue' }, road: 'Quay Street', heading: 'north', near: "Emma's", nearVi: null, offence: 'red', thing: null } as unknown as ScanFacts;
            for (const l of [...scanLines(kind, f, pick), ...Object.values(officerScene(f, pick)).filter((x): x is ScanLine => !!x && typeof x === 'object' && !Array.isArray(x) && 'vi' in x)]) if (isVietnamese(l.vi)) bad.push(`scanner ${kind}: ${l.vi}`);
          }
      for (const id of ['asset-stall', 'asset-workshop', 'asset-sponsor'] as const) for (const day of [1, 2, 3]) if (isVietnamese(assetReport(id, day).vi)) bad.push(`${id}: ${assetReport(id, day).vi}`);
      expect(bad.slice(0, 20).join('\n')).toBe('');
    });

    it("Bay FM as it is shown: the bulletins made from the game (Westbay's traffic too), the call-in show and 91.5 have no Vietnamese meaning, question or answer", () => {
      setActiveLang('en');
      const bad: string[] = [];
      // what the panel shows: every line's meaning, each question and its answers (static scenes through tr, as the
      // panel's elements put their text through the language; a made bulletin's are already in English)
      const look = (where: string, sc: ListenScene) => {
        for (const l of sc.lines) if (isVietnamese(tr(l.vi))) bad.push(`${where} ${sc.id}: ${tr(l.vi)}`);
        for (const q of [sc.gist, ...(sc.detail ? [sc.detail] : [])]) for (const t of [q.q, ...q.options]) if (isVietnamese(tr(t))) bad.push(`${where} ${sc.id} question: ${tr(t)}`);
      };
      const net = westbayNet();
      const streets = net.streets.filter((x) => x.cars).map((x) => ({ id: x.id, name: x.name }));
      const weathers = ['clear', 'cloudy', 'rain'] as const;
      for (let h = 0; h < 96; h++) {
        const now = Date.UTC(2026, 10, 27) + h * 37 * 60_000;
        const cars = seedTraffic(net, h % 7 === 0 ? 3 : 10, h + 1).map((c, i) => ({ street: c.street, dir: c.dir, speed: i % 4 === 0 ? 0 : c.speed }));
        const traffic = h % 2 === 0 ? { streets, cars, wet: h % 3 === 0 ? 0.8 : 0, ...(h % 5 === 0 ? { patrol: 'Quay Street' } : h % 5 === 1 ? { patrol: null } : {}) } : null;
        const news = h % 9 === 0 ? [{ id: 'n', lines: [{ text: 'Westbay, a word about the harbour tonight.', vi: CITY_JOBS[0].lines[0].vi }] }] : [];
        const b = bulletinAt({ now, weatherAt: () => weathers[h % 3], weekday: h % 7, month: (h % 12) + 1, townEvents: TOWN_EVENTS, news, place: h % 2 === 0 ? 'car' : 'cafe', traffic, sponsor: h % 4 === 0 ? { text: 'This hour comes to you with help from Rico.', vi: CITY_JOBS[0].lines[1].vi } : null });
        look('bulletin', b.scene);
      }
      for (const c of RADIO_CALLS) look('call', c);
      for (const seg of PIRATE_SEGMENTS) {
        look('91.5', seg);
        if (isVietnamese(tr(seg.why))) bad.push(`91.5 ${seg.id} why: ${tr(seg.why)}`);
      }
      expect(bad.slice(0, 20).join('\n')).toBe('');
    });

    it('a sound-alike made by rule in Vietnamese (him ↔ them, -teen ↔ -ty) is made in English too', () => {
      const lost: string[] = [];
      let made = 0;
      for (const { pool } of pools)
        for (const line of pool) {
          setActiveLang('vi');
          const vi = soundAlikesOf(line).filter((s) => s.derived);
          if (vi.length === 0) continue;
          setActiveLang('en');
          const en = soundAlikesOf(line).filter((s) => s.derived);
          made += vi.length;
          if (en.length !== vi.length) lost.push(`${line.id}: ${line.text} → ${tr(line.vi)}`);
        }
      expect(made).toBeGreaterThan(10);
      expect(lost.slice(0, 20).join('\n')).toBe('');
    });
  });
});
