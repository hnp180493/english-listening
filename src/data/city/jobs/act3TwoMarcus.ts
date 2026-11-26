// Act III, job 2: "Hai Marcus" (docs/gta-story-3.md §4.2). A voice on a frequency nobody owns plays "Marcus" every night
// at eleven, saying some of the listeners' money went into his own account. Every word is his: Kemp's people cut it
// from twenty years of tapes. What gives a cut tape away is a fact that has gone OLD (gta-story-3 §2.3): the "Marcus" on
// the pirate tape says the last number nine leaves at ten; it has left at ten fifteen for years (radio.ts, chats.ts,
// radioCalls.ts, events.ts all say ten fifteen; the old timetable is new canon, docs/city.md §21).
//
// Jun finds the frequency and where it is loudest (a notebook by radio); the learner parks there and presses "Đó!" on
// the line that has gone old; at Kit's, three short bits of Marcus with no text: the one recorded tonight, an old one
// (it says ten o'clock), and an imitation (it says "mate", and "everybody" where Marcus says "Westbay": §2.2). Then
// what Marcus should do. Uses only steps the engine has: notebook via radio, goto, phone, scene, spot via radio, pick,
// intent, radio.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-twomarcus-${key}`;
const WHERE = (v: string) => ({ note: 'where', value: v });

const LINES = [
  // ── beat 1: Marcus and Kit, the afternoon after ──
  { id: id('a01'), who: 'marcus', text: 'Good afternoon. There is a Marcus on the radio at night, and it is not me.', vi: 'Chào buổi chiều. Có một Marcus trên radio ban đêm, và đó không phải tôi.' },
  { id: id('a02'), who: 'kit', text: 'He says some of the pledges went into his own account. Listeners keep ringing.', vi: 'Hắn nói một phần tiền góp đã vào tài khoản riêng của anh ấy. Thính giả gọi tới liên tục.' },
  { id: id('a03'), who: 'kit', text: "Remember my kettle test? Somebody's been through our old tapes with scissors.", vi: 'Nhớ câu thử "ấm nước" của tôi không? Có người đã lục băng cũ của mình bằng kéo.' },
  { id: id('a04'), who: 'marcus', text: 'Jun is looking for where it comes from. He will ring you.', vi: 'Jun đang tìm xem nó phát từ đâu. Anh ấy sẽ gọi cho bạn.' },
  // ── Jun's briefing, on the car's radio ──
  { id: id('j01'), who: 'jun', text: "Jun here. Found your other Marcus. He's on ninety-one point five.", vi: 'Jun đây. Tìm ra ông Marcus kia rồi. Hắn ở chín mốt phẩy năm.' },
  { id: id('j02'), who: 'jun', text: "Loudest by Hal's fish stall. Park there and turn her up.", vi: 'Rõ nhất ở cạnh sạp cá của Hal. Đỗ ở đó rồi vặn to lên.' },
  { id: id('j03'), who: 'jun', text: 'Same tape, every night at eleven. Like a clock.', vi: 'Cùng một cuộn băng, đêm nào cũng mười một giờ. Đều như đồng hồ.' },
  { id: id('j01r'), who: 'jun', text: 'Ninety-one point five. Nine one, then five.', vi: 'Chín mốt phẩy năm. Chín một, rồi năm.' },
  { id: id('j02r'), who: 'jun', text: "Hal's. The fish. Follow your nose.", vi: 'Sạp Hal. Bán cá. Cứ theo mũi mà tới.' },
  { id: id('j04'), who: 'jun', text: "I'm a radio man, not a parrot. Last time.", vi: 'Tôi là thợ radio, không phải con vẹt. Lần cuối nhé.' },
  // ── wrong notes ──
  { id: id('w01'), who: 'jun', text: "That's the hospital radio. Ninety-one point five, not that one.", vi: 'Đó là đài của bệnh viện. Chín mốt phẩy năm, không phải kênh đó.' },
  { id: id('w02'), who: 'jun', text: "Sol's? It's all hiss up there. Hal's, by the fish.", vi: 'Sạp Sol à? Trên đó toàn tiếng rè. Sạp Hal, chỗ bán cá.' },
  { id: id('w03'), who: 'jun', text: "Bo's? You'll hear karaoke, not Marcus. Hal's, by the water.", vi: 'Quán Bo à? Bạn sẽ nghe karaoke, không phải Marcus. Sạp Hal, cạnh nước.' },
  // ── beat 2: by Hal's stall, eleven o'clock ──
  { id: id('h01'), who: 'hal', text: 'Every word of it is his. But something in it is old.', vi: 'Chữ nào cũng là của anh ấy. Nhưng có cái gì đó trong đó cũ rồi.' },
  { id: id('f01'), who: 'marcus', text: 'Good evening, Westbay. This is Marcus, and I owe you the truth.', vi: 'Chào buổi tối, Westbay. Marcus đây, và tôi nợ các bạn sự thật.' },
  { id: id('f02'), who: 'marcus', text: 'Some of your pledges went into my own account. I am sorry.', vi: 'Một phần tiền các bạn góp đã vào tài khoản riêng của tôi. Tôi xin lỗi.' },
  { id: id('f03'), who: 'marcus', text: "And the last number nine tonight leaves at ten. Don't miss it.", vi: 'Và chuyến số chín cuối tối nay chạy lúc mười giờ. Đừng lỡ nhé.' },
  { id: id('f04'), who: 'marcus', text: 'Goodnight, Westbay. Sleep well.', vi: 'Chúc ngủ ngon, Westbay. Ngủ ngon nhé.' },
  { id: id('k01'), who: 'kit', text: "The last nine at ten? That's the old timetable. That tape is years old.", vi: 'Chuyến chín cuối lúc mười giờ á? Đó là lịch cũ. Cuộn băng đó cũ mấy năm rồi.' },
  // ── beat 3: Kit's three bits of Marcus ──
  { id: id('k02'), who: 'kit', text: 'Three bits of Marcus. Only one was recorded tonight. Which?', vi: 'Ba đoạn Marcus. Chỉ một đoạn được thu tối nay. Đoạn nào?' },
  { id: id('k03'), who: 'kit', text: 'Listen to how he says hello. Marcus never says it any other way.', vi: 'Nghe cách anh ấy chào. Marcus chưa bao giờ chào kiểu khác.' },
  { id: id('c1'), who: 'marcus', text: "Evening, Westbay. The last nine home goes at ten o'clock.", vi: 'Chào buổi tối, Westbay. Chuyến chín cuối về chạy lúc mười giờ.' },
  { id: id('c2'), who: 'marcus', text: 'Evening, Westbay. The last nine home goes at ten fifteen.', vi: 'Chào buổi tối, Westbay. Chuyến chín cuối về chạy lúc mười giờ mười lăm.' },
  { id: id('c3'), who: 'lyle', text: 'Evening, everybody. The last nine home goes at ten fifteen, mate.', vi: 'Chào buổi tối mọi người. Chuyến chín cuối về chạy lúc mười giờ mười lăm, bạn ơi.' },
  { id: id('k04'), who: 'kit', text: 'Not that one. Ten o\'clock is old, and Marcus never says mate. The middle one.', vi: 'Không phải đoạn đó. Mười giờ là lịch cũ, và Marcus không bao giờ nói "mate". Đoạn giữa.' },
  // ── what Marcus does ──
  { id: id('i01'), who: 'marcus', text: 'Half of Westbay heard me say I kept their money. What do I do?', vi: 'Nửa Westbay nghe tôi nói tôi giữ tiền của họ. Tôi làm gì bây giờ?' },
  { id: id('i01a'), who: 'player', text: 'Play both on air tonight. Let Westbay hear the old timetable.', vi: 'Tối nay phát cả hai trên sóng. Để Westbay nghe ra cái lịch cũ.' },
  { id: id('i01b'), who: 'player', text: 'Say nothing. People forget in a few days.', vi: 'Đừng nói gì. Vài hôm người ta quên.' },
  { id: id('i01c'), who: 'player', text: 'Let Kit find the old tape it was cut from. Then play them both.', vi: 'Để Kit tìm cuộn băng cũ người ta cắt ra. Rồi phát cả hai.' },
  { id: id('i02'), who: 'marcus', text: "Side by side. They'll hear it for themselves. I like that.", vi: 'Đặt cạnh nhau. Họ sẽ tự nghe ra. Tôi thích thế.' },
  { id: id('i03'), who: 'marcus', text: 'Three pledges were taken back this morning. Nobody is forgetting.', vi: 'Sáng nay đã có ba người rút tiền góp. Chẳng ai quên đâu.' },
  { id: id('s01'), who: 'claire', text: 'Marcus, Harbour Press. Hal took his twenty back this morning.', vi: 'Marcus, Harbour Press đây. Sáng nay Hal rút hai mươi đô của ông ấy rồi.' },
  { id: id('s02'), who: 'marcus', text: 'Then tonight we play both. Before anybody else takes theirs back.', vi: 'Vậy tối nay mình phát cả hai. Trước khi có ai rút nữa.' },
  // ── the show that night ──
  { id: id('o01'), who: 'marcus', text: 'Good evening, Westbay. Two tapes tonight. Listen to both, then decide.', vi: 'Chào buổi tối, Westbay. Tối nay hai cuộn băng. Nghe cả hai, rồi tự quyết.' },
  { id: id('o02'), who: 'marcus', text: 'One of them says the last bus goes at ten. It has not for years.', vi: 'Một cuộn nói chuyến xe cuối chạy lúc mười giờ. Mấy năm nay đâu còn thế.' },
  { id: id('o03'), who: 'marcus', text: 'I never kept a dollar of yours. Claire has the books, ask her.', vi: 'Tôi chưa từng giữ một đô nào của các bạn. Claire giữ sổ, cứ hỏi cô ấy.' },
  // ── the end ──
  { id: id('e01'), who: 'marcus', text: 'You heard an old timetable in my own voice. Thank you.', vi: 'Bạn nghe ra một cái lịch cũ trong chính giọng tôi. Cảm ơn bạn.' },
  { id: id('e02'), who: 'kit', text: 'Somebody has twenty years of our tapes. And a good pair of scissors.', vi: 'Có người giữ hai mươi năm băng của mình. Và một cái kéo tốt.' },
  { id: id('e03'), who: 'marcus', text: 'We got there in the end. The phones are a little calmer.', vi: 'Cuối cùng cũng xong. Điện thoại đã đỡ réo hơn.' },
  { id: id('e04'), who: 'marcus', text: 'Some people still think I kept their money. That will take time.', vi: 'Vẫn có người nghĩ tôi giữ tiền của họ. Chuyện đó cần thời gian.' },
  { id: id('n1'), who: 'marcus', text: 'A word to Westbay. A voice can be real and the tape still lie.', vi: 'Một lời với Westbay. Giọng có thể thật mà cuộn băng vẫn nói dối.' },
  { id: id('n2'), who: 'marcus', text: 'The last number nine leaves at ten fifteen. It has done for years.', vi: 'Chuyến số chín cuối chạy lúc mười giờ mười lăm. Mấy năm nay vẫn vậy.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'freq',
    label: 'Tần số',
    line: id('j01'),
    answer: '91.5',
    options: [
      { value: '91.5', label: 'Chín mốt phẩy năm (91.5)' },
      { value: '91.9', label: 'Chín mốt phẩy chín (91.9)' },
      { value: '99.5', label: 'Chín chín phẩy năm (99.5)' },
    ],
  },
  {
    key: 'where',
    label: 'Nghe rõ nhất ở',
    line: id('j02'),
    answer: 'hal',
    options: [
      { value: 'hal', label: 'Sạp cá của Hal' },
      { value: 'sol', label: 'Sạp lồng đèn của Sol' },
      { value: 'bo', label: 'Quán karaoke của Bo' },
    ],
  },
];

export const JOB_TWOMARCUS: JobDoc = {
  id: 'job-twomarcus',
  title: 'Hai Marcus',
  blurb: 'Đêm nào cũng có một "Marcus" trên một tần số không ai nhận, nói anh giữ tiền góp. Chữ nào cũng là của anh. Nghe ra chỗ nó đã cũ.',
  level: 2,
  order: 24,
  opens: ['ct-rico-1'],
  after: 'job-forged',
  from: 'marcus',
  lines: LINES,
  facts: [
    { id: 'freq', label: 'Tần số', line: id('j01'), consequence: 'static' },
    { id: 'where', label: 'Nghe rõ nhất ở', line: id('j02'), consequence: 'stall' },
    { id: 'tell', label: 'Chỗ đã cũ', line: id('f03'), consequence: 'tell', byAction: true },
    { id: 'live', label: 'Đoạn thu tối nay', line: id('k02'), consequence: 'clip', byAction: true },
    { id: 'plan', label: 'Marcus nên làm gì', line: id('i01'), consequence: 'silent', byAction: true },
  ],
  consequences: {
    static: { name: 'Ghi sai tần số: dò trúng đài bệnh viện', rejoin: 'Jun gọi chỉ lại; bạn bắt đúng kênh.' },
    stall: { name: 'Ghi sai chỗ đỗ: chỉ nghe tiếng rè', rejoin: 'Jun chỉ đường tới sạp cá của Hal.' },
    tell: { name: 'Bấm "Đó!" sai chỗ: chưa chỉ ra được câu đã cũ', rejoin: 'Kit nghe lại và chỉ ra "ten".' },
    clip: { name: 'Chọn nhầm đoạn: không phải Marcus của tối nay', rejoin: 'Kit chỉ ra đoạn giữa.' },
    silent: { name: 'Khuyên Marcus im lặng: ba người rút tiền góp', rejoin: 'Claire gọi; Marcus phát cả hai ngay tối đó.' },
  },
  crew: {
    roles: [{ who: 'kit', role: 'Bàn âm thanh', listen: 'Kit ngồi cạnh khi bạn chọn đoạn: anh nhắc bạn nghe cách Marcus chào.', opens: { heard: ['ct-kit-2'] }, cut: CREW_CUT.friend, with: { at: 'kit' } }],
  },
  steps: [
    { kind: 'goto', place: 'marcus', label: 'Tới gặp Marcus' },
    { kind: 'scene', at: 'marcus', who: ['marcus', 'kit'], lines: [id('a01'), id('a02'), { line: id('a03'), if: { past: 'job-link' } }, id('a04')] },
    {
      kind: 'notebook',
      via: 'radio',
      call: [id('j01'), id('j02'), id('j03')],
      entries: NOTEBOOK,
      repeat: { freq: [id('j01r')], where: [id('j02r')] },
      patience: { after: 3, line: id('j04') },
    },
    { kind: 'phone', lines: [id('w01')], if: { note: 'freq', is: 'wrong' } },
    { kind: 'goto', place: 'sol', label: 'Tới chỗ đã ghi', if: WHERE('sol') },
    { kind: 'phone', lines: [id('w02')], if: WHERE('sol') },
    { kind: 'goto', place: 'bo', label: 'Tới chỗ đã ghi', if: WHERE('bo') },
    { kind: 'phone', lines: [id('w03')], if: WHERE('bo') },
    { kind: 'goto', place: 'hal', label: 'Tới sạp cá của Hal' },
    { kind: 'scene', at: 'hal', lines: [id('h01')] },
    // "Đó!" on the fact that has gone old
    { kind: 'spot', lines: ['f01', 'f02', 'f03', 'f04'].map(id), at: id('f03'), early: 'tell', late: 'tell', never: 'tell', fact: 'tell', via: 'radio' },
    { kind: 'phone', lines: [id('k01')] },
    { kind: 'goto', place: 'kit', label: 'Tới bàn âm thanh của Kit' },
    { kind: 'pick', ask: [id('k02'), { line: id('k03'), if: { crew: 'kit' } }], clips: ['c1', 'c2', 'c3'].map(id), right: 1, consequence: 'clip', fact: 'live' },
    { kind: 'scene', at: 'kit', lines: [id('k04')], if: { hit: 'clip' } },
    {
      kind: 'intent',
      who: 'marcus',
      ask: [id('i01')],
      options: [
        { label: 'Phát cả hai cạnh nhau trên sóng', say: id('i01a'), reply: [id('i02')], flag: 'kept-marcus' },
        { label: 'Im lặng, vài hôm người ta quên', say: id('i01b'), reply: [id('i03')] },
        { label: 'Tìm cuộn băng gốc rồi phát cả hai', say: id('i01c'), reply: [id('i02')], flag: 'kept-marcus' },
      ],
      check: { right: [0, 2], consequence: 'silent', fact: 'plan' },
    },
    { kind: 'phone', lines: [id('s01'), id('s02')], if: { hit: 'silent' } },
    { kind: 'radio', lines: [id('o01'), id('o02'), id('o03')] },
  ],
  ending: {
    clean: [id('e01'), id('e02')],
    messy: [id('e03'), id('e02')],
    broken: [id('e04'), id('e02')],
  },
  news: { clean: [id('n1'), id('n2')], messy: [id('n1'), id('n2')], broken: [id('n2')] },
};
