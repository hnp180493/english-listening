// Bay FM's bulletins made from the game's state (core/town/radio.ts, docs/town.md §25, docs/gta-plan.md §4.5): the
// pieces Marcus says them with. Each piece is English with its Vietnamese meaning; `{T}` is a time, `{B}` the time of
// a change in the sky, `{D}` the weekday. Marcus as in ./radio.ts: a radio host, warm, a little wry, never a teacher.
// Times are words, as in every scene. Westbay's people speak in the browser's voice, so nothing here is a clip.
//
// The Vietnamese is in `vi` fields (meanings: docs/i18n.md §4, shown in Vietnamese in English mode like every
// meaning); only the scene's title and intro are interface text.

import type { Sky } from '../../core/town/sky';

/** An English piece and its Vietnamese meaning. */
export interface Piece {
  en: string;
  vi: string;
}

/** The scene's title and intro (interface text): the same every time, so they have English entries. */
export const LIVE_TITLE = 'Bản tin Bay FM lúc này';
export const LIVE_INTRO = { cafe: 'Radio đang mở Bay FM, Marcus vừa lên sóng.', car: 'Bạn bật radio trên xe, Bay FM đang phát.' } as const;

// ───────────────────────── numbers and parts of the day ─────────────────────────

/** 1 … 12 (the hour of a twelve-hour clock). */
export const HOUR_WORDS: readonly Piece[] = [
  { en: 'twelve', vi: 'mười hai' },
  { en: 'one', vi: 'một' },
  { en: 'two', vi: 'hai' },
  { en: 'three', vi: 'ba' },
  { en: 'four', vi: 'bốn' },
  { en: 'five', vi: 'năm' },
  { en: 'six', vi: 'sáu' },
  { en: 'seven', vi: 'bảy' },
  { en: 'eight', vi: 'tám' },
  { en: 'nine', vi: 'chín' },
  { en: 'ten', vi: 'mười' },
  { en: 'eleven', vi: 'mười một' },
];

/** Minutes past or to the hour, in fives (5, 10, 20, 25; 15 is "quarter"). */
export const MINUTE_WORDS: Readonly<Record<number, Piece>> = {
  5: { en: 'five', vi: 'năm' },
  10: { en: 'ten', vi: 'mười' },
  15: { en: 'quarter', vi: 'mười lăm' },
  20: { en: 'twenty', vi: 'hai mươi' },
  25: { en: 'twenty-five', vi: 'hai mươi lăm' },
};

/** The part of the day an hour (0–23) is in, as Vietnamese says it after a time ("bảy giờ tối"). */
export function partOfDayVi(hour: number): Piece {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h <= 10) return { en: 'morning', vi: 'sáng' };
  if (h >= 11 && h <= 12) return { en: 'midday', vi: 'trưa' };
  if (h >= 13 && h <= 17) return { en: 'afternoon', vi: 'chiều' };
  if (h >= 18 && h <= 22) return { en: 'evening', vi: 'tối' };
  return { en: 'night', vi: 'đêm' };
}

export const WEEKDAYS: readonly Piece[] = [
  { en: 'Sunday', vi: 'Chủ nhật' },
  { en: 'Monday', vi: 'thứ Hai' },
  { en: 'Tuesday', vi: 'thứ Ba' },
  { en: 'Wednesday', vi: 'thứ Tư' },
  { en: 'Thursday', vi: 'thứ Năm' },
  { en: 'Friday', vi: 'thứ Sáu' },
  { en: 'Saturday', vi: 'thứ Bảy' },
];

// ───────────────────────── the station ─────────────────────────

/** "Good evening": by the game's hour. */
export function greeting(hour: number): Piece {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 12) return { en: 'Good morning', vi: 'Chào buổi sáng' };
  if (h >= 12 && h < 18) return { en: 'Good afternoon', vi: 'Chào buổi chiều' };
  if (h >= 18 && h < 23) return { en: 'Good evening', vi: 'Chào buổi tối' };
  return { en: 'Hello, night owls', vi: 'Chào những ai còn thức' };
}

/** After the greeting and a comma. */
export const IDENTS: readonly Piece[] = [
  { en: 'this is Marcus on Bay FM.', vi: 'đây là Marcus trên Bay FM.' },
  { en: "you're listening to Bay FM with Marcus.", vi: 'bạn đang nghe Bay FM cùng Marcus.' },
  { en: 'Marcus here, and this is Bay FM.', vi: 'Marcus đây, và đây là Bay FM.' },
];

/** The time check: `{T}` the time said, `{D}` the weekday. One of each lead by how near the time is. */
export const TIME_LEADS: Readonly<Record<'before' | 'on' | 'after', readonly Piece[]>> = {
  before: [
    { en: "It's coming up to {T}.", vi: 'Sắp {T} rồi.' },
    { en: "It's nearly {T} on this {D}.", vi: 'Gần {T} rồi, hôm nay {D}.' },
  ],
  on: [
    { en: "It's {T} exactly.", vi: 'Bây giờ là đúng {T}.' },
    { en: "It's {T} on this {D}.", vi: 'Bây giờ là {T}, hôm nay {D}.' },
  ],
  after: [
    { en: "It's just gone {T}.", vi: 'Vừa qua {T} một chút.' },
    { en: "It's just after {T} on this {D}.", vi: 'Vừa qua {T}, hôm nay {D}.' },
  ],
};

export const SIGN_OFFS: readonly Piece[] = [
  { en: "That's all from me for now, so stay tuned.", vi: 'Tạm thời tôi chỉ có vậy, đừng chuyển kênh nhé.' },
  { en: "Here's some music, and I'll be back in a bit.", vi: 'Giờ thì nghe nhạc nhé, lát nữa tôi quay lại.' },
  { en: 'Drive safely, and keep it on Bay FM.', vi: 'Lái xe cẩn thận, và nhớ giữ kênh Bay FM.' },
];

/** Before the player's own news (core/town/radioNews.ts). */
export const NEWS_LEADS: readonly Piece[] = [
  { en: 'First, a bit of news.', vi: 'Trước hết, có chút tin tức.' },
  { en: "Now, here's a story we've just had in.", vi: 'Nào, đây là một tin vừa tới tay chúng tôi.' },
];

// ───────────────────────── the sky ─────────────────────────

/** The sky now, by day and by night. */
export const SKY_NOW: Readonly<Record<Sky, { day: readonly Piece[]; night: readonly Piece[] }>> = {
  clear: {
    day: [
      { en: "Outside, it's clear and bright, with hardly a cloud about.", vi: 'Ngoài trời đang quang và sáng, gần như không có mây.' },
      { en: "The sky's clear right now, so enjoy the sunshine.", vi: 'Lúc này trời quang, nên tận hưởng nắng đi nhé.' },
    ],
    night: [
      { en: "It's a clear night out there, with plenty of stars.", vi: 'Ngoài kia là một đêm quang, rất nhiều sao.' },
      { en: 'The sky is clear tonight, and the harbour is calm.', vi: 'Đêm nay trời quang, bến cảng lặng sóng.' },
    ],
  },
  cloudy: {
    day: [
      { en: "It's grey out there right now, plenty of cloud but dry.", vi: 'Lúc này ngoài kia trời xám, nhiều mây nhưng khô ráo.' },
      { en: "We've got a lot of cloud about, but no rain yet.", vi: 'Trời đang nhiều mây, nhưng chưa mưa.' },
    ],
    night: [
      { en: "It's a cloudy night, so no stars, but it's dry.", vi: 'Đêm nay nhiều mây nên không có sao, nhưng khô ráo.' },
      { en: "There's thick cloud over the bay tonight, but no rain.", vi: 'Đêm nay mây dày trên vịnh, nhưng không mưa.' },
    ],
  },
  rain: {
    day: [
      { en: "It's raining right now, so you'll want an umbrella.", vi: 'Lúc này trời đang mưa, nên bạn sẽ cần ô.' },
      { en: "Yes, that's rain on the windows, and it's steady.", vi: 'Đúng rồi, mưa đang rơi trên cửa kính, và mưa đều.' },
    ],
    night: [
      { en: "It's a wet night, with rain coming down steadily.", vi: 'Đêm nay ướt át, mưa rơi đều.' },
      { en: "It's raining out there tonight, so mind the puddles.", vi: 'Đêm nay ngoài kia đang mưa, nên coi chừng vũng nước.' },
    ],
  },
  storm: {
    day: [
      { en: "There's a proper storm overhead, thunder and all.", vi: 'Đang có giông to ngay trên đầu, sấm sét đủ cả.' },
      { en: "It's stormy out there, so stay inside if you can.", vi: 'Ngoài kia đang giông, nên ở trong nhà nếu được.' },
    ],
    night: [
      { en: "There's a storm over the bay tonight, thunder and all.", vi: 'Đêm nay có giông trên vịnh, sấm sét đủ cả.' },
      { en: "It's a stormy night, so stay in if you can.", vi: 'Đêm nay giông bão, nên ở trong nhà nếu được.' },
    ],
  },
};

/** What the sky does next: from a dry or a wet sky to another one. `{B}` the time it is so by. */
export function skyChange(from: Sky, to: Sky): Piece {
  const wet = (s: Sky) => s === 'rain' || s === 'storm';
  if (to === 'clear') return wet(from) ? { en: 'the rain to clear away by {B}', vi: 'đến {B} là tạnh mưa, trời quang' } : { en: 'clear skies by {B}', vi: 'đến {B} là trời quang' };
  if (to === 'cloudy') return wet(from) ? { en: 'the rain to stop by {B}, though it stays grey', vi: 'đến {B} là tạnh mưa, nhưng trời vẫn xám' } : { en: 'the cloud to roll in by {B}', vi: 'đến {B} là mây kéo tới' };
  if (to === 'rain') return from === 'storm' ? { en: 'the storm to ease to plain rain by {B}', vi: 'đến {B} là giông dịu đi, chỉ còn mưa' } : { en: 'rain by {B}, so keep an umbrella handy', vi: 'đến {B} là có mưa, nên để sẵn ô' };
  return { en: 'a storm by {B}, with thunder', vi: 'đến {B} là có giông, kèm sấm sét' };
}

/** Before the first change ("Expect …"), and before a second one ("After that, expect …"). */
export const CHANGE_LEADS: readonly Piece[] = [
  { en: 'Expect', vi: 'Dự báo' },
  { en: "We're expecting", vi: 'Chúng tôi dự báo' },
];
export const THEN_LEAD: Piece = { en: 'After that, expect', vi: 'Sau đó' };

/** No change before `{B}`. */
export const STAYS: readonly Piece[] = [
  { en: 'And it should stay that way until at least {B}.', vi: 'Và trời sẽ giữ như vậy ít nhất tới {B}.' },
  { en: "No change on the way, not before {B} anyway.", vi: 'Chưa có gì thay đổi, ít nhất là trước {B}.' },
];

/** The question about the sky, and its answers' parts: the sky now, and what it does later. */
export const SKY_GIST = { q: 'Marcus nói gì về thời tiết?' } as const;
/** The sky now in a word, as the answers put it ("Trời {A}, …"); `en` for the English interface's answers. */
export const SKY_SHORT: Readonly<Record<Sky, Piece>> = { clear: { en: 'clear', vi: 'quang' }, cloudy: { en: 'cloudy', vi: 'nhiều mây' }, rain: { en: 'raining', vi: 'mưa' }, storm: { en: 'stormy', vi: 'có giông' } };
const LATER = {
  clear: { vi: 'trời quang' },
  clearAfterRain: { vi: 'tạnh, trời quang' },
  cloudy: { vi: 'mây kéo tới' },
  cloudyAfterRain: { vi: 'tạnh, còn xám' },
  rain: { vi: 'có mưa' },
  rainAfterStorm: { vi: 'giông dịu thành mưa' },
  storm: { vi: 'có giông' },
} as const;
/** "mấy giờ thì …?": the same changes, as the question about their time asks. */
const WHEN_WHAT = {
  clear: { vi: 'trời quang' },
  clearAfterRain: { vi: 'tạnh mưa' },
  cloudy: { vi: 'mây kéo tới' },
  cloudyAfterRain: { vi: 'tạnh mưa' },
  rain: { vi: 'có mưa' },
  rainAfterStorm: { vi: 'hết giông' },
  storm: { vi: 'có giông' },
} as const;
type Later = keyof typeof LATER;
function laterKey(from: Sky, to: Sky): Later {
  const wet = from === 'rain' || from === 'storm';
  if (to === 'clear') return wet ? 'clearAfterRain' : 'clear';
  if (to === 'cloudy') return wet ? 'cloudyAfterRain' : 'cloudy';
  if (to === 'rain') return from === 'storm' ? 'rainAfterStorm' : 'rain';
  return 'storm';
}
/** "lát nữa …": what the sky does, by where it goes (and, for some, from where). */
export function laterVi(from: Sky, to: Sky): string {
  return LATER[laterKey(from, to)].vi;
}
/** The change as "Theo Marcus, mấy giờ thì …?" asks about it. */
export function whenWhatVi(from: Sky, to: Sky): string {
  return WHEN_WHAT[laterKey(from, to)].vi;
}
export const SUMMARY = { change: { vi: 'Trời {A}, lát nữa {L}' }, stays: { vi: 'Trời {A}, và còn như vậy' } } as const;
/** "Mấy giờ thì …?": the question about when the sky changes. */
export const WHEN_Q = { q: 'Theo Marcus, mấy giờ thì {L}?' } as const;

// ───────────────────────── what is on today ─────────────────────────

export const EVENTS_LEAD: readonly Piece[] = [
  { en: "Here's what's on today.", vi: 'Sau đây là những gì diễn ra hôm nay.' },
  { en: 'Now, a quick look at what is on.', vi: 'Giờ điểm qua nhanh những gì đang diễn ra.' },
];

/** A line about each get-together of the town's week (core/town/world.ts TOWN_EVENTS; facts from data/scenes/radio). */
export const TOWN_EVENT_LINES: Readonly<Record<string, Piece>> = {
  roast: { en: "Down in town, it's Sunday lunch at Grace's, from one o'clock.", vi: 'Dưới thị trấn, trưa Chủ nhật có bữa ở nhà bà Grace, từ một giờ.' },
  games: { en: "In town, it's board games with Leo on the plaza tonight.", vi: 'Dưới thị trấn, tối nay có chơi cờ bàn với Leo ở quảng trường.' },
  club: { en: "Down in town, Daniel's conversation club meets at the school tonight.", vi: 'Dưới thị trấn, tối nay câu lạc bộ hội thoại của thầy Daniel họp ở trường.' },
  dinner: { en: "Emma's doing the Friday dinner at her cafe, one long table.", vi: 'Emma làm bữa tối thứ Sáu ở quán, kê một bàn dài.' },
  market: { en: "Tom's Saturday market is on the plaza in town.", vi: 'Chợ phiên thứ Bảy của Tom họp ở quảng trường dưới thị trấn.' },
};

/**
 * Westbay's days and festivals as the radio knows them: data/city/events.ts CITY_EVENTS (docs/city.md §9), copied here
 * so the town's chunk does not load the city's scenes (radio.test.ts checks the two agree), and a line about each.
 */
export interface CityRadioEvent extends Piece {
  id: string;
  /** Its Vietnamese name, as CITY_EVENTS has it. */
  name: string;
  weekday?: number;
  months?: readonly number[];
}

export const CITY_EVENT_LINES: readonly CityRadioEvent[] = [
  { id: 'ferry', weekday: 0, name: 'Phà ngắm vịnh', en: 'Up in Westbay, Captain Odile takes the ferry round the bay today.', vi: 'Trên Westbay, hôm nay thuyền trưởng Odile cho phà chạy một vòng quanh vịnh.' },
  { id: 'monday', weekday: 1, name: 'Sáng thứ Hai ở trụ sở', en: 'In Westbay, the Monday meeting at Meridian is out on the pavement again.', vi: 'Trên Westbay, cuộc họp thứ Hai của Meridian lại tràn ra vỉa hè.' },
  { id: 'lecture', weekday: 2, name: 'Buổi nói chuyện của giáo sư', en: 'Professor Adeyemi is talking on the library steps today, and anyone can listen.', vi: 'Hôm nay giáo sư Adeyemi nói chuyện ở bậc thềm thư viện, ai nghe cũng được.' },
  { id: 'scamclass', weekday: 3, name: 'Lớp chống lừa đảo của Jun', en: "Jun's class on phone scams is on tonight, so bring your grandparents.", vi: 'Tối nay Jun mở lớp chống lừa đảo qua điện thoại, rủ ông bà đi cùng nhé.' },
  { id: 'karaoke', weekday: 4, name: 'Đêm karaoke', en: "It's karaoke night at Bo's, and the big room is already booked.", vi: 'Tối nay là đêm karaoke ở quán Bo, phòng lớn đã có người đặt rồi.' },
  { id: 'shorts', weekday: 5, name: 'Tối phim ngắn ở rạp Lumen', en: "It's short film night at the Lumen, with tickets from Wren at the desk.", vi: 'Tối nay rạp Lumen chiếu phim ngắn, vé mua ở quầy của Wren.' },
  { id: 'nightmarket', weekday: 6, name: 'Chợ đêm bến cảng', en: "And the night market's on at the harbour, with yours truly on the stage.", vi: 'Và chợ đêm họp ở bến cảng, có chính tôi dẫn trên sân khấu.' },
  { id: 'blossom', months: [3, 4, 5], name: 'Hội hoa mùa xuân', en: "The flower festival's still on, and Nora's shop is the busiest in town.", vi: 'Hội hoa vẫn đang diễn ra, tiệm của Nora đông nhất phố.' },
  { id: 'filmweek', months: [6, 7, 8], name: 'Tuần phim ngắn mùa hè', en: "It's short film week at the Lumen, and Iris picked every film.", vi: 'Đang là tuần phim ngắn ở rạp Lumen, phim nào cũng do Iris chọn.' },
  { id: 'fair', months: [9, 10, 11], name: 'Lễ hội mùa thu ở bến cảng', en: "The autumn fair's still on round the big wheel at the harbour.", vi: 'Lễ hội mùa thu vẫn đang diễn ra quanh vòng đu quay ở bến cảng.' },
  { id: 'lanterns', months: [12, 1, 2], name: 'Lễ hội lồng đèn', en: "Sol's lanterns are up all over the harbour for the festival.", vi: 'Lồng đèn của Sol treo khắp bến cảng mùa lễ hội.' },
];

// ───────────────────────── times said aloud ─────────────────────────

/** A clock time: `{h}` the hour's word, `{m}` the minutes' word. */
export const CLOCK = {
  oclock: { en: "{h} o'clock", vi: '{h} giờ' },
  past: { en: '{m} past {h}', vi: '{h} giờ {m}' },
  half: { en: 'half past {h}', vi: '{h} giờ rưỡi' },
  to: { en: '{m} to {h}', vi: '{h} giờ kém {m}' },
  midnight: { en: 'midnight', vi: 'nửa đêm' },
  midday: { en: 'midday', vi: 'mười hai giờ trưa' },
} as const satisfies Record<string, Piece>;

/** A full hour ahead, as a forecast names it (`{h}` the hour's word). */
export const WHEN = {
  early: { en: '{h} in the morning', vi: '{h} giờ sáng' },
  morning: { en: '{h} this morning', vi: '{h} giờ sáng nay' },
  afternoon: { en: '{h} this afternoon', vi: '{h} giờ chiều nay' },
  evening: { en: '{h} this evening', vi: '{h} giờ tối nay' },
  tonight: { en: '{h} tonight', vi: '{h} giờ tối nay' },
  tomorrowMorning: { en: '{h} tomorrow morning', vi: '{h} giờ sáng mai' },
  tomorrowAfternoon: { en: '{h} tomorrow afternoon', vi: '{h} giờ chiều mai' },
  tomorrowEvening: { en: '{h} tomorrow evening', vi: '{h} giờ tối mai' },
  midnight: { en: 'midnight', vi: 'nửa đêm' },
  midday: { en: 'midday', vi: 'mười hai giờ trưa' },
  middayTomorrow: { en: 'midday tomorrow', vi: 'mười hai giờ trưa mai' },
} as const satisfies Record<string, Piece>;

/** The question about today's events: in the town, or in Westbay. */
export const EVENT_Q = { town: { q: 'Theo Marcus, hôm nay dưới thị trấn có gì?' }, city: { q: 'Theo Marcus, hôm nay trên Westbay có gì?' } } as const;
