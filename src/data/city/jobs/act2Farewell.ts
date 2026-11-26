// Act II, job 5b: "Tuần cuối" (docs/gta-story-2.md §4 job 5b; Marcus's chain). Head office gives Marcus one last
// week of nights. On the first, Tom rings the show (he hates the phone; he rings anyway) and mentions a man in a
// Coastline jacket on the no. 9. Kit knows who: Mr Ashby, coming to see Kemp. The learner meets his train at the
// station, follows Shona and him to Gianna's, and hears Kemp tell Shona that the boxes go out by the water door on
// Thursday night, the night of Marcus's last show, "nobody watches a harbour while they listen".
//
// As written, against the bible (docs/gta-story-2.md §11 "As written"):
//   - Mr Ashby has no body in the world yet, so he is described, met by Shona and talked about; the pair overheard at
//     Gianna's is Kemp and Shona while Ashby is away from the table;
//   - where they sit: "table nine" (five / nineteen) rather than "by the window": a number a careless ear mixes up;
//   - the jacket: green / grey / navy; written grey, the learner follows Mr Whitlock (grey suit) for a moment;
//   - the crew: Mrs Okafor at the station (she points him out, and, if she was asked to keep an eye out in job 3a,
//     `past: 'job-second:okafor-watch'`, she already knows his train) or Tess at her cart (she sees which way they go).
// Tom is of the town ('board'): his three lines are clips (connected only), the browser voice until the owner makes
// them.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-farewell-${key}`;

const LINES = [
  // ── beat 1: the first of the last nights ──
  { id: id('m01'), who: 'marcus', text: 'This is Marcus, and this is the first of my last seven nights.', vi: 'Marcus đây, và đây là đêm đầu tiên trong bảy đêm cuối của tôi.' },
  { id: id('t01'), who: 'board', text: "Marcus, it's Tom. I'm no good on the phone. You know that.", vi: 'Marcus, Tom đây. Tôi dở nghe điện thoại lắm. Cậu biết mà.' },
  { id: id('t02'), who: 'board', text: "So I'll just say it. Thank you for every letter. All of them.", vi: 'Nên tôi nói luôn. Cảm ơn cậu vì từng lá thư. Tất cả.' },
  { id: id('t03'), who: 'board', text: 'And a man in a Coastline jacket was on the number nine today.', vi: 'Mà hôm nay có một ông mặc áo khoác Coastline trên xe số chín.' },
  { id: id('m02'), who: 'marcus', text: 'Tom. You rang. On air. Westbay, I may need a minute.', vi: 'Tom. Cậu gọi. Trên sóng. Westbay ơi, chắc tôi cần một phút.' },
  // Kit's briefing in the studio
  { id: id('b01'), who: 'kit', text: "That'll be Ashby. He's on the {time} from the city. Shona's meeting him.", vi: 'Chắc là Ashby. Ông ta đi chuyến {time} từ thành phố. Shona ra đón.' },
  { id: id('b02'), who: 'kit', text: "Then dinner at Gianna's. She's put them at table nine.", vi: 'Rồi ăn tối ở quán Gianna. Bà ấy xếp họ ngồi bàn số chín.' },
  { id: id('b03'), who: 'kit', text: "Grey hair, green Coastline jacket. You can't miss him.", vi: 'Tóc bạc, áo khoác Coastline màu xanh lá. Không lẫn được đâu.' },
  { id: id('b01r'), who: 'kit', text: 'On the {time}. From the city.', vi: 'Chuyến {time}. Từ thành phố.' },
  { id: id('b02r'), who: 'kit', text: 'Table nine. Nine.', vi: 'Bàn số chín. Chín.' },
  { id: id('b03r'), who: 'kit', text: 'Green. The jacket is green.', vi: 'Xanh lá. Cái áo khoác màu xanh lá.' },
  { id: id('b04'), who: 'kit', text: "Marcus is back on in a minute. Quick, I've got a show to run.", vi: 'Một phút nữa Marcus lên sóng lại. Nhanh lên, tôi còn phải chạy chương trình.' },
  // ── beat 2: the station ──
  { id: id('s01'), who: 'tannoy', text: 'The {time} from the city has arrived at platform two.', vi: 'Chuyến {time} từ thành phố đã vào sân ga số hai.' },
  { id: id('s02'), who: 'shona', text: "Mr Ashby. This way, please. Mr Kemp's booked a table.", vi: 'Ông Ashby. Mời ông lối này. Ông Kemp đã đặt bàn.' },
  { id: id('o01'), who: 'okafor', text: 'Green jacket, platform two, carrying a briefcase. He tipped the porter badly.', vi: 'Áo khoác xanh lá, sân ga số hai, xách cặp. Ông ta boa người khuân vác bủn xỉn lắm.' },
  { id: id('o02'), who: 'okafor', text: "I said I'd keep an eye out. Same train as last time.", vi: 'Bà bảo bà sẽ để mắt mà. Ông ta tới đúng chuyến lần trước.' },
  { id: id('e01'), who: 'tess', text: "They've gone up Station Road with Shona. Gianna's, I'd bet my cart on it.", vi: 'Họ đi theo Station Road cùng Shona. Quán Gianna, tôi cược cả xe cà phê.' },
  { id: id('l00'), who: 'okafor', text: "You're early, dear. That train isn't due for ages. Sit on the bench.", vi: 'Cháu tới sớm quá. Chuyến đó còn lâu mới tới. Ngồi ghế đi.' },
  { id: id('l01'), who: 'okafor', text: "You've missed it, dear. They went off with the Bayline woman. Gianna's, I expect.", vi: 'Cháu lỡ rồi. Họ đi với cô bên Bayline. Chắc tới quán Gianna.' },
  // the wrong jacket
  { id: id('g01'), who: 'player', text: 'Excuse me, are you from Coastline?', vi: 'Xin lỗi, ông là người của Coastline phải không?' },
  { id: id('g02'), who: 'whitlock', text: "Coastline? Good heavens, no. Meridian. I'm going home, and it's raining.", vi: 'Coastline á? Ôi trời, không. Meridian. Tôi đang về nhà, mà trời thì mưa.' },
  { id: id('g03'), who: 'okafor', text: "That's Mr Whitlock, dear. Grey suit. The green jacket went with the Bayline woman.", vi: 'Đó là ông Whitlock, cháu ạ. Com lê xám. Cái áo xanh lá đi với cô bên Bayline rồi.' },
  // ── beat 3: Gianna's ──
  { id: id('i01'), who: 'gianna', text: 'Table eight for you, right beside table nine. Eat your pasta and say nothing.', vi: 'Cháu ngồi bàn tám, ngay cạnh bàn chín. Ăn mì đi và đừng nói gì.' },
  { id: id('i02'), who: 'gianna', text: "Table five? That's across the room. Sit, eat, and move closer when I bring bread.", vi: 'Bàn năm á? Bên kia phòng cơ. Ngồi ăn đi, lúc tôi mang bánh mì ra thì xích lại gần.' },
  { id: id('i03'), who: 'gianna', text: 'Nineteen? I only have twelve tables. Sit by nine, and eat.', vi: 'Mười chín á? Quán tôi chỉ có mười hai bàn. Ngồi cạnh bàn chín mà ăn.' },
  { id: id('h01'), who: 'kemp', text: "He's gone to wash his hands. Again. Quick. The papers for the thirteenth?", vi: 'Ông ta đi rửa tay. Lại nữa. Nhanh. Giấy tờ cho ngày mười ba sao rồi?' },
  { id: id('h02'), who: 'shona', text: 'Signed and ready. He only has to bring a pen.', vi: 'Ký sẵn rồi. Ông ta chỉ cần mang bút.' },
  { id: id('h03'), who: 'kemp', text: 'And the boxes go out on Thursday night, by the water door.', vi: 'Còn mấy cái thùng thì chở ra đêm thứ Năm, qua cửa nước.' },
  { id: id('h04'), who: 'shona', text: "Thursday's Marcus's last show. Everyone in Westbay will be listening to him.", vi: 'Thứ Năm là buổi cuối của Marcus. Cả Westbay sẽ ngồi nghe anh ta.' },
  { id: id('h05'), who: 'kemp', text: 'Good. Let them listen. Nobody watches a harbour while they listen.', vi: 'Tốt. Cứ để họ nghe. Chẳng ai canh cảng trong lúc đang nghe đài.' },
  { id: id('h06'), who: 'shona', text: "He's coming back. Smile, Duncan.", vi: 'Ông ta quay lại kìa. Cười lên, Duncan.' },
  // ── beat 4: back at the studio ──
  { id: id('q01'), who: 'marcus', text: "You're back. Well? When are they moving the boxes?", vi: 'Bạn về rồi. Sao? Khi nào họ chuyển mấy cái thùng?' },
  { id: id('q02a'), who: 'player', text: 'Thursday night, by the water door. During your last show.', vi: 'Đêm thứ Năm, qua cửa nước. Đúng lúc buổi cuối của anh.' },
  { id: id('q02b'), who: 'player', text: 'Tuesday night, by the water door.', vi: 'Đêm thứ Ba, qua cửa nước.' },
  { id: id('q02c'), who: 'player', text: 'Thursday morning, early, by the back door.', vi: 'Sáng thứ Năm, sớm, qua cửa sau.' },
  { id: id('q03a'), who: 'marcus', text: "During my last show. Then my last show is going to be very loud.", vi: 'Đúng lúc buổi cuối của tôi. Vậy thì buổi cuối của tôi sẽ rất ồn ào.' },
  { id: id('q03b'), who: 'kit', text: "Thursday, I heard it on your face. Thursday night, Marcus's last show.", vi: 'Thứ Năm, nhìn mặt bạn là tôi biết. Đêm thứ Năm, buổi cuối của Marcus.' },
  { id: id('z01'), who: 'marcus', text: "Westbay, Thursday is my last night. Stay up with me. I mean that.", vi: 'Westbay ơi, thứ Năm là đêm cuối của tôi. Thức cùng tôi nhé. Tôi nói thật đấy.' },
  // the last word, by grade
  { id: id('e1'), who: 'marcus', text: 'The train, the table, the night. Kemp has no idea what he just told us.', vi: 'Chuyến tàu, cái bàn, cái đêm. Kemp chẳng biết hắn vừa nói cho mình những gì.' },
  { id: id('e2'), who: 'marcus', text: "Not perfect, but we know the night. That's the one that matters.", vi: 'Chưa hoàn hảo, nhưng mình biết cái đêm đó. Đó mới là điều quan trọng.' },
  { id: id('e3'), who: 'marcus', text: "We nearly lost them twice. Thursday, we can't lose anybody.", vi: 'Hai lần suýt mất dấu họ. Thứ Năm thì không được để mất ai.' },
  // the news, by how it ended
  { id: id('f1'), who: 'kit', text: 'Marcus is back for one more week of nights. Thursday is the last one.', vi: 'Marcus trở lại thêm một tuần nữa vào ban đêm. Thứ Năm là đêm cuối.' },
  { id: id('f2'), who: 'kit', text: 'A visitor from head office in Westbay tonight. Nobody from Bay FM was invited.', vi: 'Tối nay có người của công ty tới Westbay. Không ai ở Bay FM được mời.' },
];

const NOTEBOOK: NoteEntry[] = [
  { key: 'time', label: 'Ashby tới chuyến mấy giờ', line: id('b01'), answer: '', options: [] },
  {
    key: 'table',
    label: 'Họ ngồi bàn số mấy',
    line: id('b02'),
    answer: '9',
    options: [
      { value: '9', label: 'Bàn số 9' },
      { value: '5', label: 'Bàn số 5' },
      { value: '19', label: 'Bàn số 19' },
    ],
  },
  {
    key: 'jacket',
    label: 'Ashby mặc áo gì',
    line: id('b03'),
    answer: 'green',
    options: [
      { value: 'green', label: 'Áo khoác Coastline màu xanh lá' },
      { value: 'grey', label: 'Áo khoác màu xám' },
      { value: 'navy', label: 'Áo khoác xanh than' },
    ],
  },
];

const TABLE = (v: string) => ({ note: 'table', value: v });

export const JOB_FAREWELL: JobDoc = {
  id: 'job-farewell',
  title: 'Tuần cuối',
  blurb: 'Marcus được thêm một tuần chương trình đêm để chia tay. Đêm đầu, người của công ty chủ đài tới thành phố gặp Kemp.',
  level: 2,
  order: 18,
  opens: ['ct-rico-1'],
  after: 'job-callin',
  from: 'marcus',
  clock: 'ten',
  crew: {
    roles: [
      { who: 'okafor', role: 'Bà bán vé', listen: 'Bà Okafor chỉ cho bạn ông Ashby ở sân ga: nghe giờ tàu và lời tả người của bà.', opens: { heard: ['ct-okafor-2'] }, cut: CREW_CUT.friend, with: { at: 'okafor' } },
      { who: 'tess', role: 'Người canh', listen: 'Tess đứng ở xe cà phê, thấy họ đi đường nào: một lời chỉ ngắn, bạn đi theo.', opens: { heard: ['ct-tess-2'] }, cut: CREW_CUT.friend, with: { at: 'tess' } },
    ],
  },
  lines: LINES,
  facts: [
    { id: 'time', label: 'Chuyến tàu mấy giờ', line: id('b01'), consequence: 'late', early: 'early' },
    { id: 'table', label: 'Bàn số mấy', line: id('b02'), consequence: 'table' },
    { id: 'jacket', label: 'Áo khoác màu gì', line: id('b03'), consequence: 'jacket' },
    { id: 'night', label: 'Khi nào chuyển thùng', line: id('h03'), consequence: 'night', byAction: true },
  ],
  consequences: {
    early: { name: 'Ghi giờ sớm: đứng chờ ở ga cả buổi', rejoin: 'Chuyến tàu vẫn tới đúng giờ.' },
    late: { name: 'Tới ga muộn: lỡ ông Ashby', rejoin: 'Đi thẳng tới quán Gianna.' },
    table: { name: 'Ghi sai bàn: ngồi xa, lỡ mấy câu đầu', rejoin: 'Gianna cho xích lại gần khi mang bánh mì ra.' },
    jacket: { name: 'Ghi sai màu áo: hỏi nhầm ông Whitlock', rejoin: 'Bà Okafor chỉ đúng người.' },
    night: { name: 'Nói sai đêm chuyển thùng với Marcus', rejoin: 'Kit sửa lại: đêm thứ Năm.' },
  },
  steps: [
    { kind: 'goto', place: 'kit', label: 'Tới phòng thu Bay FM' },
    // beat 1: the show, Tom rings in
    { kind: 'radio', lines: ['m01', 't01', 't02', 't03', 'm02'].map(id) },
    {
      kind: 'notebook',
      via: 'scene',
      call: ['b01', 'b02', 'b03'].map(id),
      entries: NOTEBOOK,
      repeat: { time: [id('b01r')], table: [id('b02r')], jacket: [id('b03r')] },
      patience: { after: 2, line: id('b04') },
    },
    // beat 2: the station, by the train noted
    { kind: 'goto', place: 'okafor', label: 'Ra Ga trung tâm đón chuyến tàu', deadline: { consequence: 'late', lines: [id('l01')] } },
    { kind: 'scene', at: 'okafor', who: ['okafor'], lines: [id('l00')], if: { note: 'time', is: 'early' } },
    { kind: 'scene', at: 'okafor', who: ['shona'], lines: [id('s01'), id('s02')], if: { not: { hit: 'late' } } },
    { kind: 'scene', at: 'okafor', who: ['okafor'], lines: [{ line: id('o02'), if: { past: 'job-second:okafor-watch' } }, id('o01')], if: { crew: 'okafor' } },
    { kind: 'scene', at: 'okafor', who: ['whitlock', 'okafor'], lines: [id('g01'), id('g02'), id('g03')], if: { note: 'jacket', is: 'wrong' } },
    { kind: 'phone', lines: [id('e01')], if: { crew: 'tess' } },
    // beat 3: Gianna's, a seat by the table noted
    { kind: 'goto', place: 'gianna', label: 'Tới quán Ý của bà Gianna' },
    {
      kind: 'scene',
      at: 'gianna',
      who: ['gianna'],
      lines: [{ line: id('i01'), if: TABLE('9') }, { line: id('i02'), if: TABLE('5') }, { line: id('i03'), if: TABLE('19') }],
    },
    {
      kind: 'overhear',
      at: 'gianna',
      who: ['kemp', 'shona'],
      lines: ['h01', 'h02', 'h03', 'h04', 'h05', 'h06'].map(id),
      passes: 1,
      from: { if: { note: 'table', is: 'wrong' }, index: 1 },
    },
    // beat 4: back at the studio
    { kind: 'goto', place: 'kit', label: 'Quay về phòng thu Bay FM' },
    {
      kind: 'intent',
      who: 'marcus',
      ask: [id('q01')],
      options: [
        { label: 'Đêm thứ Năm, cửa nước', say: id('q02a'), reply: [id('q03a')] },
        { label: 'Đêm thứ Ba, cửa nước', say: id('q02b'), reply: [id('q03b')] },
        { label: 'Sáng thứ Năm, cửa sau', say: id('q02c'), reply: [id('q03b')] },
      ],
      check: { right: 0, consequence: 'night', fact: 'night' },
    },
    { kind: 'radio', lines: [id('z01')] },
  ],
  ending: { clean: [id('e1')], messy: [id('e2')], broken: [id('e3')] },
  news: { clean: [id('f1')], messy: [id('f2')], broken: [id('f2')] },
};
