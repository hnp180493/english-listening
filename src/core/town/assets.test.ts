import { describe, expect, it } from 'vitest';
import { ASSET_IDS, ASSET_REPORTS_A_DAY, ASSETS, assetPay, assetReport, ownedAssets, reportDue, reportId, reportWrong, SPONSOR_LINE } from './assets';
import { GAME_DAY_MS } from './sky';
import { numberWords } from './office';
import { townItem } from './economy';

const DIGITS = ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const HOURS: Record<number, string> = { 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven' };

describe('assets: what they are', () => {
  it('three assets, store items of the town, the cheapest first, each run by a Westbay person', () => {
    expect(ASSETS.map((a) => a.id)).toEqual(['asset-stall', 'asset-workshop', 'asset-sponsor']);
    for (let i = 1; i < ASSETS.length; i++) expect(ASSETS[i].cost).toBeGreaterThan(ASSETS[i - 1].cost);
    for (const a of ASSETS) {
      expect(townItem(a.id)).toMatchObject({ id: a.id, kind: 'asset', cost: a.cost });
      expect(a.takings).toBeGreaterThan(0);
    }
    expect(ownedAssets(['hideout', 'asset-sponsor', 'office-map'])).toEqual(['asset-sponsor']);
  });

  it('a misheard thing loses part of the takings, never all', () => {
    expect(assetPay(10, 0)).toBe(10);
    expect(assetPay(10, 1)).toBe(7);
    expect(assetPay(10, 2)).toBe(4);
    expect(assetPay(10, 5)).toBe(4);
  });

  it('a report waits once a game day, at most ASSET_REPORTS_A_DAY a real day', () => {
    const a = ASSETS[0];
    const now = 1000 * GAME_DAY_MS + 5;
    expect(reportDue(a, [], now)).toBe(true);
    expect(reportDue(a, [reportId(a, 1000)], now)).toBe(false);
    expect(reportDue(a, [reportId(a, 998), reportId(a, 999)].slice(0, ASSET_REPORTS_A_DAY), now)).toBe(false);
    expect(reportDue(a, [reportId(ASSETS[1], 1000)], now)).toBe(true);
  });

  it('Marcus reads the sponsor line in English with its meaning', () => {
    expect(SPONSOR_LINE.text).toMatch(/Rico's cars/);
    expect(SPONSOR_LINE.vi.length).toBeGreaterThan(10);
  });
});

describe('assets: every report says what its right answers are', () => {
  const days = Array.from({ length: 300 }, (_, i) => 20000 + i * 7);

  it('stable for a day; three different options a question, the answer among them once', () => {
    for (const id of ASSET_IDS as readonly ('asset-stall' | 'asset-workshop' | 'asset-sponsor')[])
      for (const d of days) {
        const r = assetReport(id, d);
        expect(assetReport(id, d)).toEqual(r);
        for (const q of r.questions) {
          expect(new Set(q.options.map((o) => o.value)).size, `${id} ${d} ${q.key}`).toBe(3);
          expect(q.options.filter((o) => o.value === q.answer)).toHaveLength(1);
        }
        const right = Object.fromEntries(r.questions.map((q) => [q.key, q.answer]));
        expect(reportWrong(r, right)).toBe(0);
        expect(reportWrong(r, {})).toBe(2);
      }
  });

  it('the stall: the jars and the price are said as the answers', () => {
    for (const d of days) {
      const r = assetReport('asset-stall', d);
      const [qty, price] = r.questions.map((q) => q.answer);
      expect(r.text).toContain(` ${numberWords(Number(qty))} jars`);
      const [pounds, pence] = price.slice(1).split('.').map(Number);
      expect(r.text).toContain(`${numberWords(pounds)} pounds ${numberWords(pence)} a jar`);
      // the look-alike of the jars is the "-teen" / "-ty" of the same digit
      const alike = r.questions[0].options.map((o) => Number(o.value)).filter((n) => n !== Number(qty));
      expect(alike.some((n) => n % 10 === Number(qty) % 10 || Math.floor(n / 10) === Number(qty) % 10 || n % 10 === Math.floor(Number(qty) / 10))).toBe(true);
    }
  });

  it('the workshop: the plate letter by letter and the bill are said as the answers', () => {
    for (const d of days) {
      const r = assetReport('asset-workshop', d);
      const [plate, bill] = r.questions.map((q) => q.answer);
      const m = /^WB(\d)(\d) ([A-Z]{3})$/.exec(plate)!;
      expect(m).not.toBeNull();
      expect(r.text).toContain(`plate W B ${DIGITS[Number(m[1])]} ${DIGITS[Number(m[2])]}, ${m[3].split('').join(' ')}.`);
      expect(r.text).toContain(`${numberWords(Number(bill))} pounds`);
    }
  });

  it('the sponsorship: the programme and the time ("quarter to" / "quarter past") are said as the answers', () => {
    for (const d of days) {
      const r = assetReport('asset-sponsor', d);
      const [show, time] = r.questions.map((q) => q.answer);
      expect(r.text).toContain(`on ${show},`);
      const [h, min] = time.split(':').map(Number);
      const words = min === 45 ? `quarter to ${HOURS[h + 1 - 12]}` : `quarter past ${HOURS[h - 12]}`;
      expect(r.text).toContain(`at ${words}.`);
    }
  });
});
