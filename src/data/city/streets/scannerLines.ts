// What the police scanner and the officer say in Westbay (core/town/scanner.ts; docs/town.md §28): templates filled
// from the real state of a search, so every bulletin is true of what the police know. `{unit}` the patrol's number,
// `{look}` how the learner looks ("on a red scooter"), `{who}` "Rider" / "Driver" / "Suspect", `{top}` the colour of
// their top, `{road}` a street's name, `{heading}` north / south / east / west, `{near}` a place's spoken name, `{thing}`
// what was knocked over. Two new voices, only heard: Dispatch (a woman) and the unit (a man): the browser's voice,
// never a clip (docs/city.md §5, §17). The Vietnamese meaning fills the same holes with Vietnamese words.

export interface ScanTemplate {
  text: string;
  vi: string;
}

/** Words, in English and Vietnamese. */
export const VEHICLE_WORD: Readonly<Record<string, { en: string; vi: string; inside: boolean }>> = {
  bike: { en: 'bike', vi: 'xe đạp', inside: false },
  scooter: { en: 'scooter', vi: 'xe tay ga', inside: false },
  car: { en: 'car', vi: 'ô tô', inside: true },
  horse: { en: 'horse', vi: 'ngựa', inside: false },
  motorbike: { en: 'motorbike', vi: 'mô tô', inside: false },
  sportscar: { en: 'sports car', vi: 'xe thể thao', inside: true },
};
export const COLOUR_VI: Readonly<Record<string, { vi: string }>> = {
  red: { vi: 'đỏ' },
  orange: { vi: 'cam' },
  blue: { vi: 'xanh dương' },
  yellow: { vi: 'vàng' },
  green: { vi: 'xanh lá' },
  white: { vi: 'trắng' },
  black: { vi: 'đen' },
  brown: { vi: 'nâu' },
  grey: { vi: 'xám' },
  pink: { vi: 'hồng' },
  purple: { vi: 'tím' },
  silver: { vi: 'bạc' },
  gold: { vi: 'vàng kim' },
};
export const HEADING_VI: Readonly<Record<string, { vi: string }>> = { north: { vi: 'bắc' }, south: { vi: 'nam' }, east: { vi: 'đông' }, west: { vi: 'tây' } };
/** Who is described (for "{who} in a … top"), and the ways of going. */
export const WHO_WORD: Readonly<Record<'foot' | 'inside' | 'on', { en: string; vi: string }>> = {
  foot: { en: 'Suspect', vi: 'Người đó' },
  inside: { en: 'Driver', vi: 'Người lái' },
  on: { en: 'Rider', vi: 'Người cầm lái' },
};
export const GOING_WORD: Readonly<Record<'foot' | 'inside' | 'on', { vi: string }>> = { foot: { vi: 'đi bộ' }, inside: { vi: 'lái' }, on: { vi: 'đi' } };
export const SOMETHING: { en: string; vi: string } = { en: 'thing', vi: 'thứ gì đó' };
export const NUMBER_WORD: Readonly<Record<number, string>> = { 7: 'seven', 12: 'twelve', 15: 'fifteen', 20: 'twenty' };
export const THING_WORD: Readonly<Record<string, { en: string; vi: string }>> = {
  bins: { en: 'bin', vi: 'thùng rác' },
  'bike-rack': { en: 'bike rack', vi: 'giá để xe đạp' },
  postbox: { en: 'postbox', vi: 'hộp thư' },
  crates: { en: 'stack of crates', vi: 'chồng thùng gỗ' },
  pots: { en: 'flower pot', vi: 'chậu hoa' },
  hydrant: { en: 'fire hydrant', vi: 'trụ cứu hỏa' },
  'news-box': { en: 'newspaper box', vi: 'hộp báo' },
  'bench-picnic': { en: 'picnic table', vi: 'bàn dã ngoại' },
};

/** Dispatch, as a search starts: what happened, where. */
export const START_WHAT: Readonly<Record<'red' | 'car' | 'thing', ScanTemplate>> = {
  red: { text: 'All units, a red light was run on {road}.', vi: 'Tất cả các xe, có người vượt đèn đỏ trên {road}.' },
  car: { text: 'All units, a collision with a car on {road}.', vi: 'Tất cả các xe, có va chạm với một ô tô trên {road}.' },
  thing: { text: 'All units, a {thing} was knocked over on {road}.', vi: 'Tất cả các xe, có người tông đổ một {thing} trên {road}.' },
};
/** …and when it happened off the streets: near a place. */
export const START_WHAT_NEAR: Readonly<Record<'red' | 'car' | 'thing', ScanTemplate>> = {
  red: { text: 'All units, a red light was run near {near}.', vi: 'Tất cả các xe, có người vượt đèn đỏ gần {near}.' },
  car: { text: 'All units, a collision with a car near {near}.', vi: 'Tất cả các xe, có va chạm với một ô tô gần {near}.' },
  thing: { text: 'All units, a {thing} was knocked over near {near}.', vi: 'Tất cả các xe, có người tông đổ một {thing} gần {near}.' },
};

/** The description (a vehicle and a heading, a vehicle, on foot), then the top when there is one. */
export const DESCRIBE: ScanTemplate = { text: 'Suspect {look}, heading {heading}.', vi: 'Nghi phạm {look}, đang đi về hướng {heading}.' };
export const DESCRIBE_STILL: ScanTemplate = { text: 'Suspect {look}.', vi: 'Nghi phạm {look}.' };
export const TOP: ScanTemplate = { text: '{who} in a {top} top.', vi: '{who} mặc áo {top}.' };

export const UNIT_COPY: readonly ScanTemplate[] = [
  { text: 'Unit {unit}, copy. On my way.', vi: 'Xe {unit} nghe rõ. Đang tới.' },
  { text: 'Unit {unit}, copy that. Heading over.', vi: 'Xe {unit} rõ. Đang qua đó.' },
];

/** Dispatch, while searching: the last the police knew. */
export const UPDATE_ROAD: readonly ScanTemplate[] = [
  { text: 'Unit {unit}, last seen on {road}, heading {heading}.', vi: 'Xe {unit}, nhìn thấy lần cuối trên {road}, đi về hướng {heading}.' },
  { text: 'Unit {unit}, suspect {look}, on {road}, going {heading}.', vi: 'Xe {unit}, nghi phạm {look}, trên {road}, đi về hướng {heading}.' },
];
export const UPDATE_NEAR: readonly ScanTemplate[] = [
  { text: 'Unit {unit}, last seen near {near}.', vi: 'Xe {unit}, nhìn thấy lần cuối gần {near}.' },
  { text: 'Unit {unit}, suspect {look}, somewhere near {near}.', vi: 'Xe {unit}, nghi phạm {look}, đâu đó gần {near}.' },
];

/** The unit, on seeing them again. */
export const SPOTTED: ScanTemplate = { text: 'Unit {unit}. I have them, {road}, heading {heading}.', vi: 'Xe {unit}. Thấy rồi, trên {road}, đi về hướng {heading}.' };
export const SPOTTED_NEAR: ScanTemplate = { text: 'Unit {unit}. I have them, near {near}.', vi: 'Xe {unit}. Thấy rồi, gần {near}.' };

/** The search given up. */
export const LOST: readonly ScanTemplate[] = [
  { text: 'Unit {unit}. I have lost them near {near}.', vi: 'Xe {unit}. Mất dấu gần {near} rồi.' },
  { text: 'All units, stand down. Suspect not found.', vi: 'Tất cả các xe, dừng tìm kiếm. Không thấy nghi phạm.' },
];
/** The search given up when they no longer looked as described. */
export const LOST_LOOK: ScanTemplate = { text: 'Unit {unit}. Nobody {look} round here now.', vi: 'Xe {unit}. Quanh đây giờ không còn ai {look} cả.' };

/** The officer, at the stop. */
export const OFFICER_OPEN: Readonly<Record<'red' | 'car' | 'thing', ScanTemplate>> = {
  red: { text: 'Evening. You went through a red light back there.', vi: 'Chào. Lúc nãy bạn vượt đèn đỏ.' },
  car: { text: 'Evening. You ran into a car back there.', vi: 'Chào. Lúc nãy bạn tông vào một chiếc ô tô.' },
  thing: { text: 'Evening. You knocked over a {thing} back there.', vi: 'Chào. Lúc nãy bạn tông đổ một {thing}.' },
};

/** The officer's question, and which answer (by intent) answers it. */
export const OFFICER_QUESTIONS: readonly (ScanTemplate & { answer: number })[] = [
  { text: 'Do you know why I stopped you?', vi: 'Bạn có biết vì sao tôi dừng bạn lại không?', answer: 0 },
  { text: 'Whose is this, then? Is it yours?', vi: 'Vậy cái này của ai? Của bạn à?', answer: 1 },
  { text: 'And where are you off to in such a hurry?', vi: 'Thế bạn vội đi đâu vậy?', answer: 2 },
];
/** What the learner may mean (Vietnamese), and the English line they say. */
export const OFFICER_INTENTS: readonly ScanTemplate[] = [
  { text: 'Yes. Sorry, that was me.', vi: 'Nhận là mình sai' },
  { text: 'It is a borrowed one. Rico lets me use it.', vi: 'Nói xe này của ai' },
  { text: 'To the harbour. I work for Rico.', vi: 'Nói mình đang đi đâu' },
];
export const OFFICER_RIGHT: ScanTemplate = { text: 'Thank you for a straight answer. A smaller fine, then.', vi: 'Cảm ơn bạn trả lời thẳng. Vậy phạt nhẹ thôi.' };
export const OFFICER_WRONG: ScanTemplate = { text: "That's not what I asked. The full fine, I'm afraid.", vi: 'Tôi đâu có hỏi chuyện đó. Phạt đủ mức thôi.' };
export const OFFICER_BYE: ScanTemplate = { text: 'Mind how you go.', vi: 'Đi đứng cẩn thận nhé.' };
