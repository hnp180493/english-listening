// Act II, job 1: "Bán đài" (docs/gta-story-2.md §4 job 1; §3 for the act). Coastline Radio, Bay FM's owners ("head
// office", ct-kit-2), is selling the station, and the bid is Duncan Kemp's, through Bayline: buy Bay FM cheap after
// starving it, and with it twenty years of the city's voices on tape. Marcus leaves the learner a voice message; the
// crew meets at Mei's stall and each takes a chain of Act II (Jun the talkback link, Mei Shona, Gus the warehouse row,
// Marcus the listeners' money). Kemp walks by and asks again.
//
// As written, against the bible (docs/gta-story-2.md §11 "As written"):
//   - the call-back deadline of the bible is the phone's own (a missed call with a deadline: features/town/phone); the
//     notebook is Marcus's voice message (via 'voicemail'), and the appointment is the meeting at Mei's (clock
//     'quarter'), with a deadline on the walk there;
//   - "who is buying" has Coastline (the seller) as its look-alike, not "Bay FM's own lot": two "-line" firms;
//   - the meeting ends with Rico asking who does what (an answer by intent: the job of Jun), the listening by speaker.
// Kemp's offer changes with what job 1 of Act I left (`past: 'job-m2:kemp-asks-again'`, `'job-m2:kemp-knows-unpaid'`).
// Nobody of the town speaks: no clips.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-sale-${key}`;

const LINES = [
  // ── beat 1: Marcus's voice message ──
  { id: id('v01'), who: 'marcus', text: "Hi, it's Marcus. Sorry, I sound odd without a microphone. Everyone says so.", vi: 'Chào, Marcus đây. Xin lỗi, không có mic nghe tôi lạ lắm. Ai cũng bảo thế.' },
  { id: id('v02'), who: 'marcus', text: "Coastline, our head office, is selling Bay FM. They told Kit this morning.", vi: 'Coastline, công ty chủ của đài, đang bán Bay FM. Sáng nay họ báo Kit.' },
  { id: id('v03'), who: 'marcus', text: 'And the only bid so far came from Bayline. Kemp wants my station.', vi: 'Và giá mua duy nhất tới giờ là của Bayline. Kemp muốn cái đài của tôi.' },
  { id: id('v04'), who: 'marcus', text: "We're meeting at the stage. No, wait, Kit's locked it. Mei's stall, then.", vi: 'Mình họp ở sân khấu. À khoan, Kit khóa rồi. Thế thì ở sạp bà Mei.' },
  { id: id('v05'), who: 'marcus', text: 'Say {time}. Bring Rico. Bring anybody who still listens to us.', vi: 'Tầm {time}. Rủ Rico. Rủ bất cứ ai còn nghe đài mình.' },
  { id: id('v06'), who: 'marcus', text: "Twenty years of tapes, and he'd own every single one.", vi: 'Hai mươi năm băng ghi âm, và hắn sẽ sở hữu từng cuộn một.' },
  { id: id('v03r'), who: 'marcus', text: "Bayline. Kemp's firm. Not Coastline, they're the ones selling.", vi: 'Bayline. Hãng của Kemp. Không phải Coastline, họ là bên bán.' },
  { id: id('v04r'), who: 'marcus', text: "Mei's stall, at the night market. Not the stage.", vi: 'Sạp bà Mei, ở chợ đêm. Không phải sân khấu.' },
  { id: id('v05r'), who: 'marcus', text: 'At {time}, please.', vi: 'Lúc {time} nhé.' },
  { id: id('v07'), who: 'marcus', text: "Kit says I talk too much on these messages. He's right.", vi: 'Kit bảo tôi nói nhiều quá trong tin nhắn. Cậu ấy nói đúng.' },
  // ── beat 2: Bay FM by day, no sponsor ──
  { id: id('r01'), who: 'kit', text: 'Bay FM, no sponsor today, just me and the records.', vi: 'Bay FM, hôm nay không có nhà tài trợ, chỉ có tôi với mấy cái đĩa.' },
  { id: id('r02'), who: 'kit', text: "A bit of news, I'm afraid. Our owners have put the station up for sale.", vi: 'Có chút tin, e là không vui. Chủ của đài đã rao bán đài.' },
  // the wrong places
  { id: id('w01'), who: 'kit', text: "Locked, sorry. They're at Mei's. Marcus changed it halfway through his message.", vi: 'Khóa rồi, xin lỗi. Họ ở sạp bà Mei. Marcus đổi ý giữa chừng tin nhắn mà.' },
  { id: id('w02'), who: 'kit', text: "Not here. Mei's stall. Did he say the stage first? He always does.", vi: 'Không phải ở đây. Sạp bà Mei. Anh ấy nói sân khấu trước à? Lúc nào cũng thế.' },
  // the time
  { id: id('t01'), who: 'mei', text: "You're early. Good. Fold these boxes while we wait.", vi: 'Cháu tới sớm. Tốt. Gấp mấy cái hộp này trong lúc chờ.' },
  { id: id('t02'), who: 'marcus', text: "There you are. We started without you, I'm afraid. Sit down.", vi: 'Bạn đây rồi. E là bọn tôi bắt đầu mà không chờ bạn. Ngồi đi.' },
  // ── beat 3: the meeting at Mei's ──
  { id: id('m00'), who: 'rico', text: "It's Bayline buying, partner. Not Coastline, they're selling. Kemp.", vi: 'Bayline mua, cộng sự ạ. Không phải Coastline, họ là bên bán. Kemp ấy.' },
  { id: id('m01'), who: 'marcus', text: 'Right. Head office wants a buyer by the end of the month.', vi: 'Rồi. Công ty muốn có người mua trước cuối tháng.' },
  { id: id('m02'), who: 'rico', text: 'And Kemp is the only one with the money. Of course he is.', vi: 'Và Kemp là người duy nhất có tiền. Tất nhiên rồi.' },
  { id: id('m03'), who: 'jun', text: 'He knew their lowest price. He must have heard it somewhere.', vi: 'Hắn biết giá thấp nhất của họ. Chắc hắn nghe được ở đâu đó.' },
  { id: id('m04'), who: 'marcus', text: 'Kit and head office talk on the talkback link during the Saturday show.', vi: 'Kit với công ty nói chuyện qua đường talkback trong chương trình thứ Bảy.' },
  { id: id('m05'), who: 'jun', text: "Then that's mine. I'll find out who else can hear that link.", vi: 'Thế thì việc đó của tôi. Tôi sẽ tìm xem còn ai nghe được đường truyền đó.' },
  { id: id('m06'), who: 'mei', text: "Shona keeps coming to my stall about my pitch. I'll ask her a few things back.", vi: 'Shona cứ tới sạp bà, hỏi chuyện chỗ bán. Bà sẽ hỏi lại cô ta vài câu.' },
  { id: id('m07'), who: 'gus', text: "And I'll watch warehouse fifteen at night. I watch everything else anyway.", vi: 'Còn tôi canh kho mười lăm ban đêm. Đằng nào tôi cũng canh mọi thứ khác.' },
  { id: id('m08'), who: 'marcus', text: "And I'll find some money. A station can belong to the people who listen to it.", vi: 'Còn tôi đi kiếm tiền. Một cái đài có thể thuộc về chính những người nghe nó.' },
  // Kemp walks by
  { id: id('k01'), who: 'kemp', text: 'Evening, everyone. A meeting at a dumpling stall? How very Westbay.', vi: 'Chào mọi người. Họp ở sạp há cảo à? Đúng chất Westbay.' },
  { id: id('k02'), who: 'kemp', text: "Third time, partner. I did say I'd ask again. Bayline still pays on Fridays.", vi: 'Lần thứ ba nhé, cộng sự. Tôi có nói sẽ hỏi lại. Bayline vẫn trả lương thứ Sáu.' },
  { id: id('k03'), who: 'kemp', text: 'My offer stands, by the way. Bayline still pays on Fridays.', vi: 'Mà lời mời của tôi vẫn còn đó. Bayline vẫn trả lương thứ Sáu.' },
  { id: id('k04'), who: 'kemp', text: "Has Rico paid you yet? I'd have paid you twice by now.", vi: 'Rico trả công bạn chưa? Tôi thì đã trả bạn hai lần rồi.' },
  { id: id('k05a'), who: 'player', text: 'No, thank you, Mr Kemp. Enjoy your evening.', vi: 'Không, cảm ơn ông Kemp. Chúc ông buổi tối vui vẻ.' },
  { id: id('k05b'), who: 'player', text: 'Stay away from Bay FM, Mr Kemp.', vi: 'Tránh xa Bay FM ra, ông Kemp.' },
  { id: id('k05c'), who: 'player', text: 'Only if you buy six pork dumplings first.', vi: 'Chỉ khi ông mua sáu cái nhân thịt trước đã.' },
  { id: id('k06a'), who: 'kemp', text: 'Polite to the end. I do like you. Goodnight.', vi: 'Lịch sự tới cùng. Tôi quý bạn thật đấy. Chúc ngủ ngon.' },
  { id: id('k06b'), who: 'kemp', text: "Away from it? I'm about to own it. Goodnight, all.", vi: 'Tránh xa nó á? Tôi sắp làm chủ nó rồi. Chúc mọi người ngủ ngon.' },
  { id: id('k06c'), who: 'mei', text: 'Six pork for Mr Kemp. That will be five dollars, please.', vi: 'Sáu cái nhân thịt cho ông Kemp. Năm đô nhé.' },
  // Rico checks who does what
  { id: id('q01'), who: 'rico', text: "Partner, I lost track. Who's doing the talkback link?", vi: 'Cộng sự, tôi rối rồi. Ai lo cái đường talkback?' },
  { id: id('q02a'), who: 'player', text: 'Jun. He wants to know who else can hear it.', vi: 'Jun. Anh ấy muốn biết còn ai nghe được nó.' },
  { id: id('q02b'), who: 'player', text: "Gus. He said he'd watch it at night.", vi: 'Gus. Ông ấy bảo sẽ canh nó ban đêm.' },
  { id: id('q02c'), who: 'player', text: "Marcus. It's his show, after all.", vi: 'Marcus. Dù sao cũng là chương trình của anh ấy.' },
  { id: id('q03a'), who: 'rico', text: 'Jun. Right. And Gus the warehouse, Mei the woman, Marcus the money.', vi: 'Jun. Phải. Còn Gus lo cái kho, bà Mei lo cô kia, Marcus lo tiền.' },
  { id: id('q03b'), who: 'jun', text: "That's me, Rico. Gus has got the warehouse. Keep up.", vi: 'Là tôi mà Rico. Gus lo cái kho. Theo kịp đi chứ.' },
  { id: id('q03c'), who: 'marcus', text: "Not me, I'm finding the money. The link is Jun's.", vi: 'Không phải tôi, tôi lo kiếm tiền. Đường truyền là việc của Jun.' },
  // ── beat 4 ──
  { id: id('z01'), who: 'marcus', text: "Four of you, four jobs. I'll go and beg head office for one more week.", vi: 'Bốn người, bốn việc. Tôi sẽ đi năn nỉ công ty cho thêm một tuần.' },
  { id: id('z02'), who: 'gus', text: "One more week of nights with Marcus on. I'd take that.", vi: 'Thêm một tuần những đêm có Marcus trên sóng. Tôi chịu ngay.' },
  // the last word, by grade
  { id: id('e1'), who: 'rico', text: 'Everybody in the right place, on time, and everybody knows their job.', vi: 'Ai cũng đúng chỗ, đúng giờ, và ai cũng biết việc của mình.' },
  { id: id('e2'), who: 'rico', text: "We nearly lost the gatehouse to him. We're not losing the radio.", vi: 'Mình suýt mất trạm gác vào tay hắn. Cái đài thì đừng hòng.' },
  { id: id('e3'), who: 'rico', text: 'A bit of a mess tonight. But the crew is a crew again.', vi: 'Tối nay hơi lộn xộn. Nhưng băng lại là một băng rồi.' },
  { id: id('e4'), who: 'rico', text: "Tomorrow we listen properly. All of us. Starting with me.", vi: 'Mai mình nghe cho đàng hoàng. Tất cả. Bắt đầu từ tôi.' },
  // Bay FM, by how it ended
  { id: id('f1'), who: 'kit', text: "Bay FM is for sale. We're still here tonight, and so are you.", vi: 'Bay FM đang được rao bán. Tối nay chúng tôi vẫn ở đây, và các bạn cũng vậy.' },
  { id: id('f2'), who: 'kit', text: 'Rumours of a meeting at the night market tonight. About us, we hear.', vi: 'Có tin đồn về một cuộc họp ở chợ đêm tối nay. Nghe nói là về chúng tôi.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'buyer',
    label: 'Ai muốn mua Bay FM',
    line: id('v03'),
    answer: 'bayline',
    options: [
      { value: 'bayline', label: 'Bayline, hãng của Kemp' },
      { value: 'coastline', label: 'Coastline' },
      { value: 'staff', label: 'Chính người của Bay FM' },
    ],
  },
  {
    key: 'place',
    label: 'Họp ở đâu',
    line: id('v04'),
    answer: 'mei',
    options: [
      { value: 'mei', label: 'Sạp há cảo của bà Mei' },
      { value: 'stage', label: 'Sân khấu Bay FM' },
      { value: 'studio', label: 'Phòng thu Bay FM trên Arts Street' },
    ],
  },
  { key: 'time', label: 'Mấy giờ', line: id('v05'), answer: '', options: [] },
];

const PLACE = (v: string) => ({ note: 'place', value: v });

export const JOB_SALE: JobDoc = {
  id: 'job-sale',
  title: 'Bán đài',
  blurb: 'Bay FM bị đem bán, và người hỏi mua là Kemp. Marcus để lại một tin nhắn thoại.',
  level: 2,
  order: 10,
  opens: ['ct-rico-1'],
  after: 'job-hearing',
  from: 'marcus',
  clock: 'quarter',
  lines: LINES,
  facts: [
    { id: 'buyer', label: 'Ai muốn mua đài', line: id('v03'), consequence: 'buyer' },
    { id: 'place', label: 'Họp ở đâu', line: id('v04'), consequence: 'wrongPlace' },
    { id: 'time', label: 'Mấy giờ', line: id('v05'), consequence: 'late', early: 'early' },
    { id: 'tasks', label: 'Ai lo đường talkback', line: id('m05'), consequence: 'tasks', byAction: true },
  ],
  consequences: {
    buyer: { name: 'Ghi nhầm người mua: Rico phải sửa giữa buổi họp', rejoin: 'Marcus nói lại tên Kemp; buổi họp vẫn diễn ra.' },
    wrongPlace: { name: 'Tới nhầm chỗ họp', rejoin: 'Kit chỉ sang sạp bà Mei.' },
    early: { name: 'Ghi giờ sớm: tới sớm, ngồi gấp hộp với bà Mei', rejoin: 'Buổi họp bắt đầu đúng giờ.' },
    late: { name: 'Tới muộn: buổi họp đã bắt đầu', rejoin: 'Marcus kể lại phần đầu.' },
    tasks: { name: 'Trả lời sai ai lo đường talkback', rejoin: 'Người đó sửa lại cho Rico.' },
  },
  steps: [
    // beat 1: Marcus's voice message
    {
      kind: 'notebook',
      via: 'voicemail',
      call: ['v01', 'v02', 'v03', 'v04', 'v05', 'v06'].map(id),
      entries: NOTEBOOK,
      repeat: { buyer: [id('v03r')], place: [id('v04r')], time: [id('v05r')] },
      patience: { after: 3, line: id('v07') },
    },
    // beat 2: the radio on the way; to the place noted
    { kind: 'radio', lines: [id('r01'), id('r02')] },
    { kind: 'goto', place: 'marcus', label: 'Tới chỗ họp bạn đã ghi', if: PLACE('stage') },
    { kind: 'scene', at: 'marcus', who: ['kit'], lines: [id('w01')], if: PLACE('stage') },
    { kind: 'goto', place: 'kit', label: 'Tới chỗ họp bạn đã ghi', if: PLACE('studio') },
    { kind: 'scene', at: 'kit', who: ['kit'], lines: [id('w02')], if: PLACE('studio') },
    {
      kind: 'goto',
      place: 'mei',
      label: 'Tới sạp há cảo của bà Mei',
      deadline: { consequence: 'late', lines: [id('t02')] },
    },
    { kind: 'scene', at: 'mei', who: ['mei'], lines: [id('t01')], if: { note: 'time', is: 'early' } },
    // beat 3: the meeting
    {
      kind: 'scene',
      at: 'mei',
      who: ['marcus', 'rico', 'jun', 'mei', 'gus'],
      lines: [{ line: id('m00'), if: { note: 'buyer', is: 'wrong' } }, ...['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08'].map(id)],
    },
    // Kemp walks by: his offer by what job 1 of Act I left
    {
      kind: 'scene',
      at: 'mei',
      who: ['kemp', 'mei', 'rico'],
      lines: [
        id('k01'),
        { line: id('k02'), if: { past: 'job-m2:kemp-asks-again' } },
        { line: id('k03'), if: { not: { past: 'job-m2:kemp-asks-again' } } },
        { line: id('k04'), if: { past: 'job-m2:kemp-knows-unpaid' } },
      ],
    },
    {
      kind: 'intent',
      who: 'kemp',
      ask: [],
      options: [
        { label: 'Từ chối lịch sự', say: id('k05a'), reply: [id('k06a')] },
        { label: 'Bảo hắn tránh xa Bay FM', say: id('k05b'), reply: [id('k06b')], flag: 'told-kemp' },
        { label: 'Đùa: mua há cảo đã', say: id('k05c'), reply: [id('k06c')] },
      ],
    },
    // who does what: the meeting heard by who said it
    {
      kind: 'intent',
      who: 'rico',
      ask: [id('q01')],
      options: [
        { label: 'Jun', say: id('q02a'), reply: [id('q03a')] },
        { label: 'Gus', say: id('q02b'), reply: [id('q03b')] },
        { label: 'Marcus', say: id('q02c'), reply: [id('q03c')] },
      ],
      check: { right: 0, consequence: 'tasks', fact: 'tasks' },
    },
    { kind: 'scene', at: 'mei', who: ['marcus', 'gus'], lines: [id('z01'), id('z02')] },
  ],
  ending: {
    clean: [id('e1'), id('e2')],
    messy: [id('e3'), id('e4')],
    broken: [id('e3'), id('e4')],
  },
  news: {
    clean: [id('f1')],
    messy: [id('f2')],
    broken: [id('f2')],
  },
};
