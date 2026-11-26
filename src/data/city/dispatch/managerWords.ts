// The manager's daily word at Rico's dispatch office (core/town/office.ts; docs/town.md §30): Tess leaves one spoken
// line a game day with a number in it, said in words (`{n}`: core/town/office.ts numberWords, a sum of pounds of 130 …
// 390 whose tens have a "-teen" look-alike: "forty" / "fourteen"). The learner picks the number they heard; right keeps
// the day's takings, wrong loses part. Tess is dry (docs/city.md §14). The browser's voice: no clips.

export interface ManagerWord {
  text: string;
  vi: string;
  /** The question, in Vietnamese. */
  q: string;
}

export const MANAGER_WORDS: readonly ManagerWord[] = [
  { text: "It's Tess. Last night's takings came to {n} pounds.", vi: 'Tess đây. Tiền thu tối qua được {n} bảng.', q: 'Tess nói tiền thu tối qua là bao nhiêu?' },
  { text: 'Tess here. Car two needs new tyres, that is {n} pounds.', vi: 'Tess đây. Xe số hai phải thay lốp, hết {n} bảng.', q: 'Thay lốp xe số hai hết bao nhiêu?' },
  { text: 'Morning, Tess here. We took {n} pounds yesterday. Not bad.', vi: 'Chào buổi sáng, Tess đây. Hôm qua thu được {n} bảng. Không tệ.', q: 'Hôm qua hãng thu được bao nhiêu?' },
  { text: "It's Tess. Fuel for the week came to {n} pounds, so go easy.", vi: 'Tess đây. Tiền xăng tuần này hết {n} bảng, nên tiết kiệm nhé.', q: 'Tiền xăng tuần này là bao nhiêu?' },
];
