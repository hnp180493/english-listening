// The pirate station on ninety-one point five (docs/gta-story-3.md §7 item 6, docs/city.md §21, docs/town.md §25): what
// Kemp's people play between the jobs of Act III, heard on a vehicle's radio in Westbay. Two kinds of forgery, as the
// bible has them: CUT from twenty years of real tapes (every word real, but a fact has gone old: §2.3) and IMITATED by
// Lyle Penn reading Shona's scripts (one speech habit of the person wrong: the fingerprint table, §2.1–2.6). Real old
// tapes are played in between, so a listener cannot just say "fake" every time. Each segment is one listen: the sound,
// then "real or fake, and which kind", then for a fake the words that give it away (for a real one, something it said).
//
// Every forged segment breaks EXACTLY ONE rule of the table, in its words, and every real one breaks none:
// core/town/pirate.test.ts checks it against FINGERPRINT (core/town/pirate.ts). Real lines of the canon are reused word
// for word where they exist (Jun's radio that went for a swim, Bayline's slogan).
//
// Voices: the browser's only (Westbay's people, `sam-fake` / `tom-fake`): nothing here is a clip, no town resident speaks.
// A forged line is said by the voice of the person it pretends to be, as in the jobs: the difference is in the words.

import type { ListenScene, SceneQuestion } from '../../core/town/sceneTypes';

/** How a segment was made. */
export type PirateKind = 'real' | 'splice' | 'imitation';

export interface PirateSegment extends ListenScene {
  type: PirateKind;
  /** Whose segment it sounds like (a row of the fingerprint table: rico, marcus, sam, tom, tess, gus, mei, jun, delaney, kemp). */
  as: string;
  /** A fake: the words that give it away (in its lines, the right answer of its second question). */
  tell?: string;
  /** Why it is real or fake, in Vietnamese, shown after the answer. */
  why: string;
  /** Read only once this job is done (a fact that goes old only after it changed). */
  needs?: string;
}

/** The scene's title and intro (interface text). */
export const PIRATE_TITLE = 'Đài lậu 91.5';
export const PIRATE_INTRO = 'Bạn dò sang chín mốt phẩy năm. Một giọng quen đang nói, sau tiếng rè.';

/** The first question of every segment: which of the three it is (answer: 0 real, 1 cut, 2 imitated). */
const KIND_Q = { q: 'Đoạn băng này thật hay giả?', options: ['Thật: đúng giọng, đúng chuyện', 'Giả: ghép từ băng cũ', 'Giả: có người nhại'] as const };
const kindQ = (k: PirateKind): SceneQuestion => ({ q: KIND_Q.q, options: KIND_Q.options, answer: k === 'real' ? 0 : k === 'splice' ? 1 : 2 });

/** The second question of a fake: which words give it away (three things it said; `at` = where the tell is). */
const tellQ = (options: readonly [string, string, string], at: number): SceneQuestion => ({ q: 'Chữ nào làm nó lộ?', options, answer: at });

const fake = (s: Omit<PirateSegment, 'kind' | 'title' | 'scene' | 'level' | 'gist' | 'detail'> & { level?: 1 | 2 | 3; options: readonly [string, string, string]; at: number }): PirateSegment => {
  const { options, at, level, ...rest } = s;
  return { ...rest, kind: 'radio', title: PIRATE_TITLE, scene: PIRATE_INTRO, level: level ?? 2, gist: kindQ(s.type), detail: tellQ(options, at) };
};
const real = (s: Omit<PirateSegment, 'kind' | 'title' | 'scene' | 'level' | 'gist' | 'type'> & { level?: 1 | 2 | 3 }): PirateSegment => {
  const { level, ...rest } = s;
  return { ...rest, type: 'real', kind: 'radio', title: PIRATE_TITLE, scene: PIRATE_INTRO, level: level ?? 2, gist: kindQ('real') };
};

export const PIRATE_SEGMENTS: readonly PirateSegment[] = [
  // ── Rico ──
  fake({
    id: 'fm-pirate-1',
    type: 'imitation',
    as: 'rico',
    tell: 'nine thirty',
    lines: [
      { who: 'rico', text: "Partner, it's Rico. Listen, listen, I'll say it twice.", vi: 'Cộng sự, Rico đây. Nghe này, nghe này, tôi nói hai lần.' },
      { who: 'rico', text: 'The pickup at the Lumen is at nine thirty tonight.', vi: 'Cuốc đón ở rạp Lumen lúc chín giờ ba mươi tối nay.' },
      { who: 'rico', text: "Nine thirty at the Lumen, partner. Don't be late.", vi: 'Chín giờ ba mươi ở rạp Lumen, cộng sự. Đừng muộn.' },
    ],
    options: ['"nine thirty"', '"partner"', '"the Lumen"'],
    at: 0,
    why: 'Giả, nhại: Rico nói giờ rưỡi là "half nine", chưa bao giờ "nine thirty". Lyle học được "partner" và nói hai lần, nhưng không biết chữ này.',
  }),
  fake({
    id: 'fm-pirate-2',
    type: 'splice',
    as: 'rico',
    tell: 'Chip',
    needs: 'job-samcall',
    lines: [
      { who: 'rico', text: 'One to all. Pick up at Chip, two going to Grace\'s. Over.', vi: 'Một gọi tất cả. Đón ở "Chip", hai người đi "Grace\'s". Hết.' },
      { who: 'rico', text: 'Two for Grace\'s, from Chip. Over.', vi: 'Hai người đi "Grace\'s", từ "Chip". Hết.' },
    ],
    options: ['"Grace\'s"', '"Chip"', '"Over"'],
    at: 1,
    why: 'Giả, ghép từ băng cũ: từ sau vụ "Sam" gọi máy số hai, hãng gọi nhà ga là "Biscuit", không còn "Chip". "Grace\'s" thì vẫn là bệnh viện.',
  }),
  real({
    id: 'fm-pirate-3',
    as: 'rico',
    lines: [
      { who: 'rico', text: 'Partner! Half nine at the Lumen, and I mean half nine.', vi: 'Cộng sự! Chín rưỡi ở rạp Lumen, đúng chín rưỡi nhé.' },
      { who: 'rico', text: "I'll say it again, because I always do. Half nine.", vi: 'Tôi nói lại, vì tôi lúc nào cũng nói lại. Chín rưỡi.' },
      { who: 'rico', text: "And bring Tess a coffee, she's been up since six.", vi: 'Và mang cho Tess một ly cà phê, cô ấy dậy từ sáu giờ.' },
    ],
    detail: { q: 'Rico hẹn mấy giờ?', options: ['Chín rưỡi', 'Chín giờ', 'Mười giờ rưỡi'], answer: 0 },
    why: 'Thật: "half nine", "partner", nói đi nói lại, đúng như Rico. Đài lậu xen băng thật cho người nghe tin.',
  }),
  // ── Marcus ──
  fake({
    id: 'fm-pirate-4',
    type: 'splice',
    as: 'marcus',
    tell: 'leaves at ten',
    lines: [
      { who: 'marcus', text: 'Good evening, Westbay, this is Marcus on Bay FM.', vi: 'Chào buổi tối, Westbay, Marcus đây, trên Bay FM.' },
      { who: 'marcus', text: 'A reminder, the last number nine home leaves at ten.', vi: 'Nhắc các bạn, chuyến số 9 cuối về nhà chạy lúc mười giờ.' },
      { who: 'marcus', text: "Don't miss it, or it's a long walk.", vi: 'Đừng lỡ, kẻo đi bộ xa đấy.' },
    ],
    options: ['"Westbay"', '"number nine"', '"leaves at ten"'],
    at: 2,
    why: 'Giả, ghép từ băng cũ: chuyến số 9 cuối giờ chạy lúc mười giờ mười lăm; "lúc mười giờ" là lịch cũ từ nhiều năm trước.',
  }),
  fake({
    id: 'fm-pirate-5',
    type: 'imitation',
    as: 'marcus',
    tell: 'mate',
    lines: [
      { who: 'marcus', text: "Good evening, Westbay. Marcus here, and it's a clear night.", vi: 'Chào buổi tối, Westbay. Marcus đây, đêm nay trời quang.' },
      { who: 'marcus', text: 'Stay with us, mate, the next hour is all requests.', vi: 'Ở lại với chúng tôi nhé, bạn ơi, giờ tới toàn bài theo yêu cầu.' },
    ],
    options: ['"mate"', '"Westbay"', '"requests"'],
    at: 0,
    why: 'Giả, nhại: Marcus không bao giờ gọi ai là "mate"; anh gọi người nghe là "Westbay".',
  }),
  fake({
    id: 'fm-pirate-6',
    type: 'splice',
    as: 'marcus',
    tell: 'Coastline Radio',
    lines: [
      { who: 'marcus', text: 'This is Bay FM, part of the Coastline Radio family.', vi: 'Đây là Bay FM, một đài trong gia đình Coastline Radio.' },
      { who: 'marcus', text: "Good morning, Westbay. It's seven o'clock.", vi: 'Chào buổi sáng, Westbay. Bảy giờ rồi.' },
    ],
    options: ['"Bay FM"', '"Coastline Radio"', '"seven o\'clock"'],
    at: 1,
    why: 'Giả, ghép từ băng cũ: Bay FM giờ là đài của thính giả, không còn thuộc Coastline Radio.',
  }),
  real({
    id: 'fm-pirate-7',
    as: 'marcus',
    lines: [
      { who: 'marcus', text: 'Good evening, Westbay. This is Bay FM, your station.', vi: 'Chào buổi tối, Westbay. Đây là Bay FM, đài của các bạn.' },
      { who: 'marcus', text: 'Claire has the books, and every pledge is still there.', vi: 'Claire giữ sổ, và từng khoản góp vẫn còn nguyên.' },
      { who: 'marcus', text: 'The last number nine goes at ten fifteen, as always.', vi: 'Chuyến số 9 cuối chạy lúc mười giờ mười lăm, như mọi khi.' },
    ],
    detail: { q: 'Theo Marcus, chuyến số 9 cuối chạy lúc mấy giờ?', options: ['Mười giờ', 'Mười giờ mười lăm', 'Chín giờ rưỡi'], answer: 1 },
    why: 'Thật: "Westbay", "your station", và chuyến cuối lúc mười giờ mười lăm, đúng lịch bây giờ.',
  }),
  // ── Sam (the voice is `sam-fake`: the real Sam is a town resident, his voice a clip, never on this station) ──
  fake({
    id: 'fm-pirate-8',
    type: 'imitation',
    as: 'sam',
    tell: 'love a good chat on the phone',
    lines: [
      { who: 'sam-fake', text: "Hey, it's Sam from the number nine. How are you all doing?", vi: 'Này, Sam của xe số 9 đây. Mọi người khỏe không?' },
      { who: 'sam-fake', text: 'Honestly, I love a good chat on the phone. Call me any time.', vi: 'Thật lòng, tôi mê tán điện thoại lắm. Gọi tôi lúc nào cũng được.' },
      { who: 'sam-fake', text: 'My mom says hi to everybody up in Westbay.', vi: 'Mẹ tôi gửi lời chào mọi người trên Westbay.' },
    ],
    options: ['"the number nine"', '"My mom says hi"', '"love a good chat on the phone"'],
    at: 2,
    why: 'Giả, nhại: Sam ghét điện thoại, nói qua điện thoại ba chữ một lần. "Mom" thì đúng chữ của Sam: kịch bản học đúng chữ, sai người.',
  }),
  // ── Tom (`tom-fake`, as Sam's) ──
  fake({
    id: 'fm-pirate-9',
    type: 'imitation',
    as: 'tom',
    tell: 'talk on air all night',
    lines: [
      { who: 'tom-fake', text: "Hi, Bay FM. It's Tom, from down in the town.", vi: 'Chào Bay FM. Tom đây, ở dưới thị trấn.' },
      { who: 'tom-fake', text: 'Um, sorry, I just wanted to say something.', vi: 'Ừm, xin lỗi, tôi chỉ muốn nói một chút.' },
      { who: 'tom-fake', text: 'Honestly? I could talk on air all night. I love it.', vi: 'Thật lòng hả? Tôi nói trên sóng cả đêm cũng được. Tôi mê lắm.' },
    ],
    options: ['"Um, sorry"', '"talk on air all night"', '"down in the town"'],
    at: 1,
    why: 'Giả, nhại: Tom ghét nói trước đám đông, cầm điện thoại còn run. Lyle học được "um" và "sorry", nhưng Tom thật không bao giờ "nói cả đêm cũng được".',
  }),
  // ── Tess ──
  fake({
    id: 'fm-pirate-10',
    type: 'imitation',
    as: 'tess',
    tell: 'darling',
    lines: [
      { who: 'tess', text: 'Morning, Westbay. Tess here, from the cart on the plaza.', vi: 'Chào buổi sáng, Westbay. Tess đây, xe cà phê trên quảng trường.' },
      { who: 'tess', text: "Coffee's on, darling, and the first one is free today.", vi: 'Cà phê có rồi, cưng ơi, hôm nay ly đầu miễn phí.' },
    ],
    options: ['"the cart on the plaza"', '"Coffee\'s on"', '"darling"'],
    at: 2,
    why: 'Giả, nhại: Tess gọi người ta là "love", chưa bao giờ "darling".',
  }),
  // ── Gus ──
  fake({
    id: 'fm-pirate-11',
    type: 'imitation',
    as: 'gus',
    tell: 'ten to two',
    lines: [
      { who: 'gus', text: 'Gus here, at the harbour gate.', vi: 'Gus đây, ở cổng cảng.' },
      { who: 'gus', text: "I'm on the gate from ten to two tonight, mate.", vi: 'Tối nay tôi trực cổng từ mười giờ tới hai giờ kém mười, bạn ạ.' },
    ],
    options: ['"Gus here"', '"ten to two"', '"mate"'],
    at: 1,
    why: 'Giả, nhại: Gus luôn nói "ten till two", và còn sửa người khác: "not ten to two". "Ten to two" là hai giờ kém mười.',
  }),
  // ── Mei ──
  fake({
    id: 'fm-pirate-12',
    type: 'imitation',
    as: 'mei',
    tell: "It's urgent",
    lines: [
      { who: 'mei', text: 'Mei here, from the night market, dear.', vi: 'Mei đây, ở chợ đêm, cháu ạ.' },
      { who: 'mei', text: "It's urgent, so send the money tonight, before nine.", vi: 'Gấp lắm, nên gửi tiền ngay tối nay, trước chín giờ.' },
    ],
    options: ['"dear"', '"the night market"', '"It\'s urgent"'],
    at: 2,
    why: 'Giả, nhại: luật của Mei là "If it\'s urgent, it\'s lying". Bà không bao giờ tự giục ai gửi tiền.',
  }),
  // ── Jun (real: his own words, as heard at his stall) ──
  real({
    id: 'fm-pirate-13',
    as: 'jun',
    lines: [
      { who: 'jun', text: "Your radio's not dead, Gus. She just went for a swim.", vi: 'Cái đài của anh chưa chết đâu, Gus. Nó vừa đi bơi một chuyến.' },
      { who: 'jun', text: 'Twenty minutes. Dry her out, new switch. Nothing goes in the bin here.', vi: 'Hai mươi phút. Làm khô, thay công tắc. Ở đây không có gì bị vứt đi.' },
    ],
    detail: { q: 'Jun bảo cái đài của Gus làm sao?', options: ['Bị rơi xuống nước, chưa hỏng hẳn', 'Hỏng hẳn, phải vứt', 'Hết pin'], answer: 0 },
    why: 'Thật: Jun gọi cái đài là "she", như anh vẫn gọi mọi cái máy.',
  }),
  // ── Mrs Delaney ──
  fake({
    id: 'fm-pirate-14',
    type: 'imitation',
    as: 'delaney',
    tell: 'no need to write anything down',
    lines: [
      { who: 'delaney', text: 'Mrs Delaney speaking. The boxes may go out tonight.', vi: 'Delaney đây. Mấy cái thùng có thể chở đi tối nay.' },
      { who: 'delaney', text: 'There is no need to write anything down.', vi: 'Không cần ghi lại gì cả.' },
    ],
    options: ['"no need to write anything down"', '"Mrs Delaney speaking"', '"The boxes"'],
    at: 0,
    why: 'Giả, nhại: bà Delaney ghi lại mọi thứ ("Noted."); bà không đời nào bảo khỏi ghi.',
  }),
  // ── Kemp (real: an old advert of Bayline, his own voice) ──
  real({
    id: 'fm-pirate-15',
    as: 'kemp',
    lines: [
      { who: 'kemp', text: "Bayline. Wherever you're going, we're already there.", vi: 'Bayline. Bạn đi đâu, chúng tôi đã ở đó rồi.' },
      { who: 'kemp', text: 'Ring us, day or night. Goodnight, Westbay.', vi: 'Gọi chúng tôi, ngày hay đêm. Chúc ngủ ngon, Westbay.' },
    ],
    detail: { q: 'Đây là quảng cáo của hãng nào?', options: ['Hãng xe của Rico', 'Bay FM', 'Bayline'], answer: 2 },
    why: 'Thật: một quảng cáo cũ của Bayline, chính giọng Kemp ("Goodnight"). Đài lậu xen băng thật cho người nghe tin.',
  }),
];

/** What the learner is told when the channel is silent after the live broadcast (by its ending, docs/gta-story-3.md §6). */
export const PIRATE_SILENT: Readonly<Record<'best' | 'middle' | 'worst' | 'none', string>> = {
  best: 'Chín mốt phẩy năm chỉ còn tiếng rè. Coastline đã rút giá của Kemp, và căn phòng trên Twin Ovens bỏ trống.',
  middle: 'Chín mốt phẩy năm im từ sau buổi phát sóng. Giá của thính giả vẫn giữ, tạm thời; không ai biết đài lậu có quay lại không.',
  worst: 'Chín mốt phẩy năm im rồi: Kemp không cần nó nữa. Việc bán đài vẫn treo, thêm một tháng.',
  none: 'Chín mốt phẩy năm im từ sau buổi phát sóng.',
};
