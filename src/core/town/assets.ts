// The learner's assets in Westbay after Rico's office (docs/gta-plan.md §4.4: "Sau đó: xưởng xe, một sạp ở Market
// Street, bảo trợ một chương trình trên Bay FM. Tài sản không phải máy in tiền: quản lý gọi báo việc bằng lời, nghe sót
// thì lỗ."; docs/town.md §34). Pure rules; the IO is ./assetsStore.ts, the panel features/town/assets/.
//
// Three assets, each bought with xu through the town's store (an id in town-progress `bought`, its cost counted by
// ./economy spentTotal, as the office's upgrades: no new stored or synced key). Each has a manager of Westbay (the
// browser's voice, docs/city.md) who gives a spoken report once a GAME day (as Tess's word, ./office.ts), with two
// things to hear in it, a different kind of listening for each asset:
//   - the stall on Market Street (Amira): how many jars sold (a "-teen" / "-ty" pair) and the price of one (pence);
//   - the workshop (Theo): the car's number plate (letters that sound alike: B / D / P / T …) and the bill (pounds);
//   - the Bay FM sponsorship (Kit): the programme's name (names one sound apart) and the time it goes out ("quarter
//     to" / "quarter past").
// Both heard right: the day's takings kept; each one wrong loses ASSET_LOSS of them. A report heard is the id
// `as-<asset>-<game day>` in the day's set `heard` of town-progress, its xu in `earned`.
//
// Every number (costs, takings, the loss) is a GUESS until somebody really plays (economyModel.ts holds them up to the
// rest of the economy).

import { gameDayOf, numberWords, wordNumbers } from './office';
import { tl, tr } from '../../i18n';
import { ASSET_CARS, ASSET_GOODS, ASSET_REPAIRS, ASSET_REPORT_VI, ASSET_SHOWS, SPONSOR_READ } from '../../data/city/assetReports';

export type AssetId = 'asset-stall' | 'asset-workshop' | 'asset-sponsor';

export interface Asset {
  id: AssetId;
  /** The id's short form in a report's id (`as-<short>-<game day>`). */
  short: 'stall' | 'workshop' | 'sponsor';
  /** Vietnamese (the panel's line). */
  name: string;
  /** One Vietnamese line: what it is, who runs it. */
  blurb: string;
  /** Who runs it and gives the report: a Westbay person (core/town/cityPeople.ts), the browser's voice. */
  manager: string;
  cost: number;
  /** Xu a game day when the report is heard right. */
  takings: number;
}

/** The three assets, the cheapest first. */
export const ASSETS: readonly Asset[] = [
  {
    id: 'asset-stall',
    short: 'stall',
    name: 'Sạp gia vị ở Market Street',
    blurb: 'Một sạp nhỏ cạnh sạp của Amira. Amira trông giúp, cuối ngày gọi báo bán được bao nhiêu.',
    manager: 'amira',
    cost: 900,
    takings: 6,
  },
  {
    id: 'asset-workshop',
    short: 'workshop',
    name: 'Xưởng sửa xe',
    blurb: 'Theo sửa xe cho khách của hãng những hôm phà không cần anh. Anh báo việc bằng vài chữ.',
    manager: 'theo',
    cost: 1500,
    takings: 8,
  },
  {
    id: 'asset-sponsor',
    short: 'sponsor',
    name: 'Bảo trợ một chương trình Bay FM',
    blurb: 'Marcus đọc tên hãng xe của Rico trên sóng. Kit báo chương trình nào, mấy giờ phát.',
    manager: 'kit',
    cost: 2000,
    takings: 7,
  },
];

export const ASSET_IDS: readonly string[] = ASSETS.map((a) => a.id);

export function asset(id: string): Asset | undefined {
  return ASSETS.find((a) => a.id === id);
}

/** The assets owned, from the town's `bought` list. */
export function ownedAssets(bought: readonly string[]): AssetId[] {
  return ASSETS.filter((a) => bought.includes(a.id)).map((a) => a.id);
}

// ───────────────────────── the report ─────────────────────────

/** Reports paid an asset a real day at most (game days are 48 minutes: as Tess's word, ./office.ts). */
export const ASSET_REPORTS_A_DAY = 2;
/** The share of the takings lost for each of the two things misheard. */
export const ASSET_LOSS = 0.3;

/** What a report pays: the takings, less ASSET_LOSS of them for each thing heard wrong (0, 1 or 2). */
export function assetPay(takings: number, wrong: number): number {
  const w = Math.max(0, Math.min(2, Math.round(wrong)));
  return Math.round(takings * (1 - ASSET_LOSS * w));
}

export const reportId = (a: Asset, gameDay: number): string => `as-${a.short}-${gameDay}`;

/** Whether an asset's report waits: owned, this game day's not heard, and the real day's allowance not used up. */
export function reportDue(a: Asset, heardToday: readonly string[], now: number): boolean {
  if (heardToday.includes(reportId(a, gameDayOf(now)))) return false;
  return heardToday.filter((id) => id.startsWith(`as-${a.short}-`)).length < ASSET_REPORTS_A_DAY;
}

export interface ReportOption {
  value: string;
  /** As the option shows it (already in the interface's language). */
  label: string;
}

export interface ReportQuestion {
  key: 'a' | 'b';
  /** The question (in the interface's language). */
  q: string;
  options: readonly ReportOption[];
  answer: string;
}

export interface AssetReport {
  asset: AssetId;
  gameDay: number;
  /** Who says it (a Westbay person's id). */
  who: string;
  /** What is said (English, the connected form is made by the voice). */
  text: string;
  /** Its meaning (Vietnamese, shown after the answers). */
  vi: string;
  questions: readonly [ReportQuestion, ReportQuestion];
}

/** A small generator, stable per asset and game day. */
function rng(seed: number): () => number {
  let x = (seed * 2654435761) >>> 0;
  return () => (x = (x * 1103515245 + 12345) >>> 0) / 4294967296;
}
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];

/** The three options in an order stable for the day (the right one not always first). */
function order(r: () => number, list: ReportOption[]): ReportOption[] {
  const k = Math.floor(r() * list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}

/** A meaning with its `{…}` filled. */
const fill = (t: string, v: Readonly<Record<string, string>>): string => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

const DIGITS = ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
/** Letters said alike in English ("bee", "dee", "pee", "tee", "vee"; "em" / "en"; "eff" / "ess"). */
const ALIKE_LETTERS: readonly (readonly string[])[] = [
  ['B', 'D', 'P', 'T', 'V'],
  ['M', 'N'],
  ['F', 'S'],
];

/** Theo's report: the plate (letters that sound alike) and the bill. */
function workshopReport(gameDay: number): AssetReport {
  const r = rng(gameDay * 31 + 7);
  const group = ALIKE_LETTERS[0];
  const letters = [pick(r, ['K', 'H', 'R', 'L']), pick(r, group), pick(r, [...ALIKE_LETTERS[1], ...ALIKE_LETTERS[2]])];
  const d1 = 1 + Math.floor(r() * 8);
  let d2 = Math.floor(r() * 10);
  if (d2 === d1) d2 = (d2 + 3) % 10;
  const plate = (ls: readonly string[], a: number, b: number) => `WB${a}${b} ${ls.join('')}`;
  // the look-alike: the middle letter for another of its sound, or the last one for its pair
  const swapMid = group.filter((x) => x !== letters[1]);
  const lastGroup = ALIKE_LETTERS.find((g) => g.includes(letters[2]))!;
  const alikeLetters = r() < 0.5 ? [letters[0], pick(r, swapMid), letters[2]] : [letters[0], letters[1], lastGroup.find((x) => x !== letters[2])!];
  const right = plate(letters, d1, d2);
  const alike = plate(alikeLetters, d1, d2);
  const other = plate(letters, d2, d1);
  const bill = wordNumbers(gameDay * 7 + 3);
  const car = pick(r, ASSET_CARS);
  const job = pick(r, ASSET_REPAIRS);
  const spoken = `W B ${DIGITS[d1]} ${DIGITS[d2]}, ${letters.join(' ')}`;
  return {
    asset: 'asset-workshop',
    gameDay,
    who: 'theo',
    text: `It's Theo. One car today. ${car.en[0].toUpperCase() + car.en.slice(1)}, plate ${spoken}. ${job.en} ${numberWords(bill.said)} pounds.`,
    vi: fill(tr(ASSET_REPORT_VI.workshop.vi), { car: tr(car.vi), plate: right, repair: tr(job.vi), bill: String(bill.said) }),
    questions: [
      { key: 'a', q: tr('Biển số xe nào?'), options: order(r, [right, alike, other].map((p) => ({ value: p, label: p }))), answer: right },
      { key: 'b', q: tr('Khách trả bao nhiêu?'), options: order(r, [bill.said, bill.alike, bill.other].map((n) => ({ value: String(n), label: tl`${n} bảng` }))), answer: String(bill.said) },
    ],
  };
}

// pence said alike ("fifty" / "fifteen")
const PENCE_PAIRS: readonly (readonly [number, number])[] = [
  [50, 15],
  [60, 16],
  [40, 14],
  [70, 17],
  [30, 13],
];
const money = (pounds: number, pence: number): string => `£${pounds}.${String(pence).padStart(2, '0')}`;

/** Amira's report: how many jars ("forty" / "fourteen") and the price of one ("fifty" / "fifteen"). */
function stallReport(gameDay: number): AssetReport {
  const r = rng(gameDay * 37 + 11);
  const d = 3 + Math.floor(r() * 7);
  const tens = r() < 0.5;
  const qty = tens ? d * 10 : 10 + d;
  const qtyAlike = tens ? 10 + d : d * 10;
  const qtyOther = tens ? d * 10 + 5 : 20 + d;
  const pair = pick(r, PENCE_PAIRS);
  const flip = r() < 0.5;
  const pence = flip ? pair[1] : pair[0];
  const penceAlike = flip ? pair[0] : pair[1];
  const pounds = 2 + Math.floor(r() * 4);
  const goods = pick(r, ASSET_GOODS);
  return {
    asset: 'asset-stall',
    gameDay,
    who: 'amira',
    text: `Amira here, love. Good day at your stall! We sold ${numberWords(qty)} jars of ${goods.en}, at ${numberWords(pounds)} pounds ${numberWords(pence)} a jar.`,
    vi: fill(tr(ASSET_REPORT_VI.stall.vi), { qty: String(qty), goods: tr(goods.vi), price: money(pounds, pence) }),
    questions: [
      { key: 'a', q: tr('Bán được bao nhiêu hũ?'), options: order(r, [qty, qtyAlike, qtyOther].map((n) => ({ value: String(n), label: tl`${n} hũ` }))), answer: String(qty) },
      {
        key: 'b',
        q: tr('Giá một hũ?'),
        options: order(r, [money(pounds, pence), money(pounds, penceAlike), money(pounds + 1, pence)].map((m) => ({ value: m, label: m }))),
        answer: money(pounds, pence),
      },
    ],
  };
}

const HOURS = ['seven', 'eight', 'nine', 'ten', 'eleven'];
const hhmm = (h: number, m: number): string => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Kit's report: the programme's name and the time ("quarter to" / "quarter past"). */
function sponsorReport(gameDay: number): AssetReport {
  const r = rng(gameDay * 41 + 13);
  const show = pick(r, ASSET_SHOWS);
  const k = Math.floor(r() * HOURS.length) % HOURS.length;
  const hour = 19 + k;
  const to = r() < 0.5;
  // "quarter to ten" is 21:45; its look-alike "quarter past ten" 22:15; the third "half past nine" 21:30
  const said = to ? hhmm(hour - 1, 45) : hhmm(hour, 15);
  const alike = to ? hhmm(hour, 15) : hhmm(hour - 1, 45);
  const other = hhmm(hour - 1, 30);
  const when = `quarter ${to ? 'to' : 'past'} ${HOURS[k]}`;
  return {
    asset: 'asset-sponsor',
    gameDay,
    who: 'kit',
    text: `Kit at the studio. Your name goes out tonight on ${show[0]}, at ${when}. Marcus reads it himself.`,
    vi: fill(tr(ASSET_REPORT_VI.sponsor.vi), { show: show[0], time: said }),
    questions: [
      { key: 'a', q: tr('Chương trình nào?'), options: order(r, show.map((s) => ({ value: s, label: s }))), answer: show[0] },
      { key: 'b', q: tr('Mấy giờ phát?'), options: order(r, [said, alike, other].map((t) => ({ value: t, label: t }))), answer: said },
    ],
  };
}

/** The report of an asset for a game day (stable: the same words on every machine). */
export function assetReport(id: AssetId, gameDay: number): AssetReport {
  return id === 'asset-stall' ? stallReport(gameDay) : id === 'asset-workshop' ? workshopReport(gameDay) : sponsorReport(gameDay);
}

/** How many of the two answers are wrong. */
export function reportWrong(report: AssetReport, picks: Readonly<Partial<Record<'a' | 'b', string>>>): number {
  return report.questions.filter((q) => picks[q.key] !== q.answer).length;
}

// ───────────────────────── on the air ─────────────────────────

/**
 * What Marcus reads on Bay FM once the sponsorship is bought (the radio's bulletin reads it through
 * ./assetsStore.ts sponsorLine). Canon: Rico's cars are at the old gatehouse on Pier Road, phone two is the learner's.
 */
export const SPONSOR_LINE: Readonly<{ text: string; vi: string }> = SPONSOR_READ;
