// Bay FM's call-in show and its adverts (docs/town.md §25, docs/gta-plan.md §4.5: "chương trình khán giả gọi lên:
// người gọi đủ giọng và tốc độ, là cái thang độ khó"; "quảng cáo của các cửa tiệm, vài cái là manh mối").
//
// A call is a short exchange: Marcus takes the call, the listener says what they rang about, Marcus answers; then ONE
// question. The callers are listeners nobody has met, so they speak in the browser's voice (docs/city.md §5), with a
// manner of the dispatch office's four (core/town/dispatch.ts Manner: clear, hurried, mumbling, a bad line whose words
// repeat themselves) through their speaker key in SCENE_VOICES (core/town/sceneTypes.ts). The ladder: level 1 clear
// and slow, level 2 hurried everyday talk, level 3 mumbling or a bad line; the radio offers the lowest level that still
// has a call not heard lately (core/town/radio.ts callNow).
//
// The adverts are read by Marcus inside a generated bulletin, one an edition. They are made from the real places of
// Westbay and the town (docs/city.md §1–3) and say true things about them. Three of them say something a job could
// use (RADIO_CLUE_ADS, stable ids): exported for the job engine's `clue:<id>`, NOT wired from here.
//
// Content rules as every scene's (data/scenes/scenes.test.ts, radioCalls.test.ts): 3–16 words a line, plain ASCII,
// SAPI-safe, numbers and times as words, a Vietnamese meaning each.

import type { ListenScene } from '../../core/town/sceneTypes';

/** A call on the show: a ListenScene of kind 'radio' (id `fm-call-<n>`), with its rung on the ladder. */
export interface RadioCall extends ListenScene {
  /** 1 clear … 3 mumbling or a bad line: the ladder's rung (the scene's `level`). */
  level: 1 | 2 | 3;
}

export const RADIO_CALLS: readonly RadioCall[] = [
  // ───────────── level 1: clear and unhurried ─────────────
  {
    id: 'fm-call-1',
    kind: 'radio',
    title: 'Gọi tới: chiếc ô bỏ quên',
    scene: 'Bay FM đang mở chương trình thính giả gọi tới. Một người vừa vào máy.',
    level: 1,
    lines: [
      { who: 'marcus', text: "You're on Bay FM, go ahead, caller.", vi: 'Bạn đang ở trên sóng Bay FM, mời bạn nói.' },
      { who: 'caller-clear-f', text: 'Hello, Marcus. I left my umbrella on the number nine yesterday.', vi: 'Chào Marcus. Hôm qua tôi để quên cái ô trên xe số chín.' },
      { who: 'caller-clear-f', text: "It's a green one, with a wooden handle.", vi: 'Ô màu xanh lá, cán bằng gỗ.' },
      { who: 'marcus', text: 'Then call Pete at the lost property office at the station.', vi: 'Vậy gọi cho Pete ở phòng đồ thất lạc ở nhà ga nhé.' },
      { who: 'marcus', text: 'He gets about one umbrella a week, so you are in luck.', vi: 'Tuần nào anh ấy cũng nhận chừng một cái ô, nên bạn gặp may rồi.' },
    ],
    gist: { q: 'Người gọi bị mất gì?', options: ['Một cái ô màu xanh lá', 'Một chiếc khăn màu xanh', 'Một cái ví bằng da'], answer: 0 },
  },
  {
    id: 'fm-call-2',
    kind: 'radio',
    title: 'Gọi tới: bài hát cho ba mươi năm',
    scene: 'Radio đang phát Bay FM, Marcus vừa nhận một cuộc gọi.',
    level: 1,
    lines: [
      { who: 'marcus', text: "Good evening, you're on Bay FM.", vi: 'Chào buổi tối, bạn đang ở trên sóng Bay FM.' },
      { who: 'caller-clear-m', text: 'Hi, Marcus. Can you play a song for my wife, please?', vi: 'Chào Marcus. Anh phát giúp tôi một bài cho vợ tôi được không?' },
      { who: 'caller-clear-m', text: 'We got married thirty years ago today.', vi: 'Hôm nay là tròn ba mươi năm chúng tôi cưới nhau.' },
      { who: 'marcus', text: 'Thirty years! Of course I can. What was your first dance?', vi: 'Ba mươi năm! Tất nhiên rồi. Điệu nhảy đầu tiên của hai người là bài gì?' },
      { who: 'caller-clear-m', text: 'Anything slow. She says I still step on her feet.', vi: 'Bài nào chậm cũng được. Bà ấy bảo tôi vẫn còn giẫm chân bà ấy.' },
    ],
    gist: { q: 'Vì sao người gọi xin bài hát?', options: ['Hôm nay sinh nhật vợ ông', 'Ba mươi năm ngày cưới', 'Vợ ông sắp đi xa lâu'], answer: 1 },
  },
  {
    id: 'fm-call-3',
    kind: 'radio',
    title: 'Gọi tới: chuyến xe cuối',
    scene: 'Bay FM vẫn đang mở, có người gọi vào hỏi chuyện.',
    level: 1,
    lines: [
      { who: 'marcus', text: "Hello, caller, you're on the air.", vi: 'Chào bạn, bạn đang lên sóng đấy.' },
      { who: 'caller-clear-f', text: "I'm going to the karaoke at Bo's tonight.", vi: 'Tối nay tôi đi hát karaoke ở quán Bo.' },
      { who: 'caller-clear-f', text: 'When is the last bus back to the town?', vi: 'Chuyến xe cuối về thị trấn lúc mấy giờ vậy?' },
      { who: 'marcus', text: 'The last number nine leaves at ten fifteen.', vi: 'Chuyến số chín cuối cùng chạy lúc mười giờ mười lăm.' },
      { who: 'marcus', text: "So don't sing that last song, or you'll be walking home.", vi: 'Nên đừng hát bài cuối, không thì đi bộ về đấy.' },
    ],
    gist: { q: 'Chuyến xe cuối về thị trấn chạy lúc mấy giờ?', options: ['Mười giờ năm mươi', 'Chín giờ mười lăm', 'Mười giờ mười lăm'], answer: 2 },
  },
  // ───────────── level 2: hurried, everyday ─────────────
  {
    id: 'fm-call-4',
    kind: 'radio',
    title: 'Gọi tới: xe đậu chắn bến taxi',
    scene: 'Marcus đang nhận cuộc gọi, người gọi có vẻ vội.',
    level: 2,
    lines: [
      { who: 'marcus', text: "Next caller, you're on Bay FM.", vi: 'Người gọi tiếp theo, bạn đang ở trên sóng Bay FM.' },
      { who: 'caller-hurried-m', text: "Yeah, hi, I've gotta be quick, I'm on my break.", vi: 'Ừ, chào, tôi phải nói nhanh, đang giờ nghỉ.' },
      { who: 'caller-hurried-m', text: "There's cars parked all along Station Avenue again, right by the rank.", vi: 'Lại có xe đậu dọc đại lộ Station Avenue, ngay sát bến taxi.' },
      { who: 'caller-hurried-m', text: "The taxis can't get in, and the queue's out the door.", vi: 'Taxi không vào được, mà hàng người chờ dài ra tận cửa.' },
      { who: 'marcus', text: "I'll pass that on. Mrs Okafor will not be pleased.", vi: 'Tôi sẽ chuyển lời. Bà Okafor chắc không vui đâu.' },
    ],
    gist: { q: 'Người gọi phàn nàn chuyện gì?', options: ['Xe đậu chắn bến taxi', 'Xe buýt số chín bị trễ', 'Nhà ga đóng cửa sớm'], answer: 0 },
  },
  {
    id: 'fm-call-5',
    kind: 'radio',
    title: 'Gọi tới: quầy bánh bao ở chợ đêm',
    scene: 'Radio đang phát Bay FM, một người gọi vào nói rất nhanh.',
    level: 2,
    lines: [
      { who: 'marcus', text: "You're on the air. What've you got for us?", vi: 'Bạn đang lên sóng. Có gì cho chúng tôi nào?' },
      { who: 'caller-hurried-f', text: "Okay, so, everyone's gotta try the dumplings at the night market.", vi: 'Rồi, mọi người phải thử bánh bao ở chợ đêm nhé.' },
      { who: 'caller-hurried-f', text: "Mei's stall, the one at the end, by the lanterns.", vi: 'Quầy của bà Mei, cái ở cuối, cạnh mấy cái lồng đèn.' },
      { who: 'caller-hurried-f', text: 'Get there early, though, she sells out by eight.', vi: 'Nhưng tới sớm nhé, tám giờ là bà ấy bán hết.' },
      { who: 'marcus', text: "Noted. I'll be there at seven, and I'm not sharing.", vi: 'Ghi nhận. Bảy giờ tôi có mặt, và tôi không chia đâu.' },
    ],
    gist: { q: 'Người gọi khuyên mọi người làm gì?', options: ['Tới quầy lồng đèn mua quà', 'Ăn bánh bao ở quầy bà Mei', 'Tránh chợ đêm vì đông'], answer: 1 },
  },
  {
    id: 'fm-call-6',
    kind: 'radio',
    title: 'Gọi tới: câu đố về vòng đu quay',
    scene: 'Đang tới phần câu đố của Bay FM, có người gọi vào trả lời.',
    level: 2,
    lines: [
      { who: 'marcus', text: "Tonight's question is, what's the tallest thing on the harbour?", vi: 'Câu đố tối nay: thứ gì cao nhất ở bến cảng?' },
      { who: 'caller-hurried-m', text: "Oh, I know this one, it's the big wheel, isn't it?", vi: 'Ồ, câu này tôi biết, là vòng đu quay đúng không?' },
      { who: 'marcus', text: "Close, but no. It's the crane by the ferry.", vi: 'Gần đúng, nhưng không phải. Là cái cần cẩu cạnh bến phà.' },
      { who: 'caller-hurried-m', text: "Aw, come on, I was sure about that one.", vi: 'Ôi trời, tôi đã chắc mẩm câu đó rồi.' },
      { who: 'marcus', text: 'Better luck next week. Thanks for calling.', vi: 'Chúc tuần sau may mắn hơn. Cảm ơn đã gọi.' },
    ],
    gist: { q: 'Đáp án đúng của câu đố là gì?', options: ['Vòng đu quay ở cảng', 'Ngọn hải đăng ngoài mũi', 'Cần cẩu cạnh bến phà'], answer: 2 },
  },
  // ───────────── level 3: mumbling, a bad line ─────────────
  {
    id: 'fm-call-7',
    kind: 'radio',
    title: 'Gọi tới: sương mù ngoài vịnh',
    scene: 'Một người gọi vào Bay FM, giọng nhỏ và lí nhí.',
    level: 3,
    lines: [
      { who: 'marcus', text: "We've got an early caller. Go ahead.", vi: 'Có người gọi sớm. Mời bạn nói.' },
      { who: 'caller-mumbling-m', text: "Mornin'. I'm out on the bay, been fishing since four.", vi: 'Chào buổi sáng. Tôi đang ngoài vịnh, câu cá từ bốn giờ.' },
      { who: 'caller-mumbling-m', text: "Fog's come in thick, can't see the lighthouse from here.", vi: 'Sương mù kéo tới dày lắm, từ đây không thấy ngọn hải đăng.' },
      { who: 'caller-mumbling-m', text: "Reckon the first ferry'll be late. Thought you'd want to know.", vi: 'Tôi đoán chuyến phà đầu sẽ trễ. Nghĩ là anh muốn biết.' },
      { who: 'marcus', text: 'Thank you. Stay safe out there, and come in slowly.', vi: 'Cảm ơn. Ngoài đó cẩn thận nhé, vào bờ từ từ thôi.' },
    ],
    gist: { q: 'Người gọi báo tin gì?', options: ['Sương mù dày, phà đầu chắc trễ', 'Cá hôm nay rất nhiều', 'Ngọn hải đăng bị tắt đèn'], answer: 0 },
  },
  {
    id: 'fm-call-8',
    kind: 'radio',
    title: 'Gọi tới: lời nhắn cho Dana',
    scene: 'Bay FM nhận một cuộc gọi, đường dây rè và chập chờn.',
    level: 3,
    lines: [
      { who: 'marcus', text: "Caller, you're breaking up a bit. Try again?", vi: 'Bạn ơi, tiếng bị ngắt quãng. Nói lại được không?' },
      { who: 'caller-badline-f', text: "I'm on the, on the ferry, the signal's awful.", vi: 'Tôi đang ở trên, trên phà, sóng tệ lắm.' },
      { who: 'caller-badline-f', text: "Can you tell Dana, Dana at the office, I'll be late?", vi: 'Anh nhắn giúp Dana, Dana ở văn phòng, là tôi tới muộn được không?' },
      { who: 'caller-badline-f', text: "Late for the karaoke, the karaoke at Bo's. Half an hour.", vi: 'Muộn buổi karaoke, karaoke ở quán Bo. Nửa tiếng.' },
      { who: 'marcus', text: "Dana, if you're listening, half an hour. Save her a song.", vi: 'Dana, nếu bạn đang nghe: nửa tiếng nữa. Chừa cho cô ấy một bài.' },
    ],
    gist: { q: 'Người gọi nhờ Marcus làm gì?', options: ['Đặt phòng karaoke ở quán Bo', 'Báo với Dana là cô ấy tới muộn', 'Hỏi giờ chuyến phà cuối'], answer: 1 },
  },
  {
    id: 'fm-call-9',
    kind: 'radio',
    title: 'Gọi tới: ca đêm ở bệnh viện',
    scene: 'Đêm khuya, Bay FM nhận một cuộc gọi, giọng người gọi rất khẽ.',
    level: 3,
    lines: [
      { who: 'marcus', text: 'Still up? So am I. Who have we got?', vi: 'Vẫn còn thức à? Tôi cũng vậy. Ai đang gọi đây?' },
      { who: 'caller-mumbling-f', text: "Hi, it's a nurse up at the hospital, on nights.", vi: 'Chào, tôi là y tá trên bệnh viện, trực ca đêm.' },
      { who: 'caller-mumbling-f', text: "Ward's finally quiet. Could you play something soft? Not too loud.", vi: 'Khoa cuối cùng cũng yên. Anh phát bài gì nhẹ được không? Đừng to quá.' },
      { who: 'marcus', text: 'Something soft for the night shift, coming right up.', vi: 'Một bài nhẹ cho ca đêm, có ngay đây.' },
      { who: 'caller-mumbling-f', text: "Thanks. I'll keep it on low at the desk.", vi: 'Cảm ơn. Tôi sẽ mở nhỏ ở bàn trực.' },
    ],
    gist: { q: 'Người gọi muốn gì?', options: ['Xin một bài hát nhẹ nhàng', 'Hỏi đường tới bệnh viện', 'Báo bệnh viện quá ồn'], answer: 0 },
  },
];

/** An advert Marcus reads inside a bulletin: true of its place. `clue` = something a job could rely on. */
export interface RadioAd {
  /** `ad-<place>`: stable (the job engine's `clue:<id>` names it). */
  id: string;
  /** The place it is for (a Westbay person's id, or a town place id). */
  place: string;
  lines: readonly { text: string; vi: string }[];
  clue?: true;
}

export const RADIO_ADS: readonly RadioAd[] = [
  {
    id: 'ad-lumen',
    place: 'wren',
    lines: [
      { text: "Tonight at the Lumen, it's two films for the price of one.", vi: 'Tối nay ở rạp Lumen, mua một vé xem hai phim.' },
      { text: 'Ask Wren at the desk, before eight o\'clock.', vi: 'Hỏi Wren ở quầy vé, trước tám giờ.' },
    ],
  },
  {
    id: 'ad-press',
    place: 'claire',
    lines: [
      { text: 'Harbour Press on Arts Street stays open till nine on Fridays.', vi: 'Hiệu sách Harbour Press trên phố Arts mở tới chín giờ các tối thứ Sáu.' },
      { text: 'Buy a book, and the coffee is on the house.', vi: 'Mua một cuốn sách là được mời cà phê.' },
    ],
  },
  {
    // a clue: who is in Bo's big room, and when, every Thursday
    id: 'ad-bo',
    place: 'bo',
    clue: true,
    lines: [
      { text: "At Bo's karaoke, the big room is booked from nine every Thursday.", vi: 'Quán karaoke của Bo: phòng lớn có người đặt từ chín giờ mỗi tối thứ Năm.' },
      { text: 'The small room is free, and so are the crisps.', vi: 'Phòng nhỏ còn trống, và bim bim miễn phí.' },
    ],
  },
  {
    // a clue: a door that opens before the shop does
    id: 'ad-twin-ovens',
    place: 'poppy',
    clue: true,
    lines: [
      { text: 'Twin Ovens on Market Street opens its doors at six.', vi: 'Tiệm bánh Twin Ovens trên phố Market mở cửa lúc sáu giờ.' },
      { text: 'Night workers, knock at the back door from five.', vi: 'Ai làm ca đêm thì gõ cửa sau từ năm giờ.' },
    ],
  },
  {
    // a clue: the big wheel's last ride, so when the harbour goes quiet
    id: 'ad-wheel',
    place: 'fay',
    clue: true,
    lines: [
      { text: 'The big wheel on the harbour turns until ten tonight.', vi: 'Vòng đu quay ở bến cảng chạy tới mười giờ tối nay.' },
      { text: 'The last ride goes at quarter to, so ask Fay for a ticket.', vi: 'Chuyến cuối lúc mười giờ kém mười lăm, nên hỏi Fay mua vé nhé.' },
    ],
  },
  {
    id: 'ad-tess',
    place: 'tess',
    lines: [
      { text: "Tess's coffee cart on the terminal plaza, from six every morning.", vi: 'Xe cà phê của Tess trên quảng trường bến xe, từ sáu giờ mỗi sáng.' },
      { text: 'She learnt it all from Emma, and it shows.', vi: 'Cô ấy học hết từ Emma, uống là biết.' },
    ],
  },
  {
    id: 'ad-gianna',
    place: 'gianna',
    lines: [
      { text: "Gianna's on Market Street has a table by the window on Fridays.", vi: 'Quán Gianna trên phố Market có bàn cạnh cửa sổ các tối thứ Sáu.' },
      { text: 'Book it early, and bring somebody nice.', vi: 'Đặt sớm nhé, và đi cùng ai đó dễ thương.' },
    ],
  },
  {
    id: 'ad-emma',
    place: 'cafe',
    lines: [
      { text: "Down in the town, Emma's cafe has lemon cake on Sundays.", vi: 'Dưới thị trấn, quán của Emma có bánh chanh vào Chủ nhật.' },
      { text: "It's gone by noon, so don't say I didn't warn you.", vi: 'Trưa là hết, nên đừng bảo tôi không nhắc trước.' },
    ],
  },
  {
    id: 'ad-ben',
    place: 'shop',
    lines: [
      { text: "Ben's shop in the town is open till eight every night.", vi: 'Cửa hàng của Ben dưới thị trấn mở tới tám giờ mỗi tối.' },
      { text: 'If he has not got it, you do not need it.', vi: 'Thứ gì anh ấy không có thì bạn cũng không cần đâu.' },
    ],
  },
];

/**
 * The adverts that say something a job could use, for the job engine's `clue:<id>` (another module wires them; this one
 * never does): Bo's big room booked from nine on Thursdays, Twin Ovens' back door from five, the big wheel's last ride
 * at quarter to ten. Their ids are stable; their facts must stay as written.
 */
export const RADIO_CLUE_ADS: readonly string[] = RADIO_ADS.filter((a) => a.clue).map((a) => a.id);

/** An advert's lead-in, before its own lines. */
export const AD_LEADS: readonly { text: string; vi: string }[] = [
  { text: "And now, a word from the people who keep us on the air.", vi: 'Và giờ là đôi lời từ những người giúp đài chúng tôi phát sóng.' },
  { text: 'Before we go on, a quick message.', vi: 'Trước khi tiếp tục, một thông báo ngắn.' },
];
