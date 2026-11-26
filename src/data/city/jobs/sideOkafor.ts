// Side chain A of Act I: "Bà Okafor nghỉ phép" (docs/gta-story.md §5), three small jobs. Mrs Okafor, twenty-two years
// at the ticket window, knows every timetable by heart, rings Sam every morning ("he says three words, I say three
// numbers": ct-okafor-1), has never taken the no. 9, would like to sit on Sam's bench and meet Chip, and will not ride
// in Rico's taxi (docs/city.md §3, §6). The chain: a tin of biscuits for Chip on the first bus; the morning call to Sam
// done by the learner (she has lost her voice); her first ride on the no. 9.
//
// As written, against the outline (docs/gta-story.md §8 "As written"): Sam never speaks (a town resident in a job would
// need clips; jobs play the browser's voice only): he TEXTS, as he does (ct-rico-1), and Rico reads his three words
// out; job 3 ends as she boards (a job plays in Westbay; the town end of the ride is not staged). The bus bay is not a
// place: Tess's coffee cart stands at it ('tess'), the lost property office is Pete's ('pete'), the window is
// Mrs Okafor's ('okafor').

import type { JobLine, NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

// ───────────────────────── 1. Hộp bánh cho Chip ─────────────────────────

const a = (key: string) => `job-okafor1-${key}`;

const LINES_1: readonly JobLine[] = [
  { id: a('01'), who: 'okafor', text: "You. Rico's partner. I need a favour, and I don't ask twice.", vi: 'Cháu. Cộng sự của Rico. Tôi cần nhờ một việc, và tôi không nhờ hai lần đâu.' },
  { id: a('02'), who: 'okafor', text: "This tin goes on the seven oh five, not the seven twenty-five. That one's always late.", vi: 'Hộp này đi chuyến bảy giờ năm, không phải chuyến bảy giờ hai lăm. Chuyến đó lúc nào cũng trễ.' },
  { id: a('03'), who: 'okafor', text: 'From stand four, out by the coffee cart.', vi: 'Ở bến số bốn, ngoài kia cạnh xe cà phê.' },
  { id: a('04'), who: 'okafor', text: 'And hand it to the driver. Not in the hold. Biscuits break.', vi: 'Và đưa tận tay tài xế. Đừng bỏ vào khoang hành lý. Bánh quy dễ vỡ.' },
  { id: a('05'), who: 'okafor', text: "They're for Chip. Sam's dog. I've never met him, but he'll know.", vi: 'Cho Chip đấy. Con chó của Sam. Tôi chưa gặp nó bao giờ, nhưng nó sẽ biết.' },
  { id: a('02r'), who: 'okafor', text: 'The seven oh five. Five past seven.', vi: 'Chuyến bảy giờ năm. Bảy giờ năm phút.' },
  { id: a('03r'), who: 'okafor', text: 'Stand four. Outside, where Tess is.', vi: 'Bến số bốn. Ngoài kia, chỗ Tess đứng.' },
  { id: a('04r'), who: 'okafor', text: "Into the driver's own hands, please.", vi: 'Đưa tận tay tài xế giùm tôi.' },
  { id: a('06'), who: 'okafor', text: "I don't ask twice, and I don't say things four times either.", vi: 'Tôi không nhờ hai lần, và cũng không nói một điều tới bốn lần.' },
  { id: a('p1'), who: 'pete', text: "Platform four's for trains, I'm afraid. The buses go from outside, by Tess.", vi: 'Sân ga số bốn là cho tàu hỏa. Xe buýt chạy từ ngoài kia, chỗ Tess.' },
  { id: a('t1'), who: 'tess', text: "Stand fourteen? There isn't one, love. Four's right behind me.", vi: 'Bến số mười bốn á? Làm gì có. Bến số bốn ngay sau lưng tôi đây.' },
  { id: a('t2'), who: 'tannoy', text: 'The seven oh five to the town has now left stand four.', vi: 'Chuyến bảy giờ năm về thị trấn đã rời bến số bốn.' },
  { id: a('t3'), who: 'tess', text: "Missed it? Leave it with me. It'll go on the next one.", vi: 'Lỡ rồi à? Để đấy cho tôi. Nó sẽ đi chuyến sau.' },
  { id: a('t4'), who: 'tess', text: "The seven oh five's just pulling in. Go on, quick.", vi: 'Chuyến bảy giờ năm vừa vào bến. Đi đi, nhanh lên.' },
  { id: a('o1'), who: 'okafor', text: 'The driver rang. Chip had the lot by nine. Not one crumb lost.', vi: 'Tài xế gọi rồi. Chín giờ Chip đã xơi sạch. Không mất một vụn nào.' },
  { id: a('o2'), who: 'okafor', text: 'The driver rang. It went in the hold. Chip got crumbs.', vi: 'Tài xế gọi rồi. Nó bị bỏ vào khoang hành lý. Chip chỉ được vụn bánh.' },
  { id: a('p2'), who: 'pete', text: "One tin, biscuits, for the use of a dog. Logged. It'll go tomorrow.", vi: 'Một hộp, bánh quy, cho một con chó dùng. Đã ghi sổ. Mai nó sẽ đi.' },
  { id: a('e1'), who: 'okafor', text: "Thank you. Twenty-two years, and that's the first thing I've ever sent down there.", vi: 'Cảm ơn cháu. Hai mươi hai năm, đó là thứ đầu tiên tôi gửi xuống dưới đó.' },
  { id: a('e2'), who: 'okafor', text: "Well. It got there. That's what timetables are for, in the end.", vi: 'Thôi. Nó tới nơi rồi. Rốt cuộc thì giờ tàu xe sinh ra là để thế.' },
  { id: a('e3'), who: 'okafor', text: "Next time, write it down. I'll sell you a notebook.", vi: 'Lần sau ghi lại đi. Tôi bán cho cháu một cuốn sổ.' },
  { id: a('f1'), who: 'kit', text: 'And a tin of biscuits went down to the town on the first bus today.', vi: 'Và hôm nay có một hộp bánh quy xuống thị trấn trên chuyến xe đầu tiên.' },
  { id: a('f2'), who: 'kit', text: 'Reports of a lost biscuit tin at the bus bay. It has been found.', vi: 'Có tin về một hộp bánh quy thất lạc ở bãi xe buýt. Đã tìm thấy rồi.' },
];

const NOTEBOOK_1: NoteEntry[] = [
  {
    key: 'bus',
    label: 'Gửi theo chuyến mấy giờ',
    line: a('02'),
    answer: '705',
    options: [
      { value: '705', label: 'Chuyến 7:05' },
      { value: '725', label: 'Chuyến 7:25' },
      { value: '750', label: 'Chuyến 7:50' },
    ],
  },
  {
    key: 'stand',
    label: 'Ở bến nào',
    line: a('03'),
    answer: 's4',
    options: [
      { value: 's4', label: 'Bến xe buýt số 4, cạnh xe cà phê' },
      { value: 's14', label: 'Bến số 14' },
      { value: 'p4', label: 'Sân ga số 4 trong nhà ga' },
    ],
  },
  {
    key: 'hand',
    label: 'Gửi thế nào',
    line: a('04'),
    answer: 'driver',
    options: [
      { value: 'driver', label: 'Đưa tận tay tài xế' },
      { value: 'hold', label: 'Bỏ vào khoang hành lý' },
      { value: 'pete', label: 'Gửi ở phòng đồ thất lạc' },
    ],
  },
];

export const JOB_OKAFOR_1: JobDoc = {
  id: 'job-okafor1',
  title: 'Hộp bánh cho Chip',
  blurb: 'Bà Okafor gửi một hộp bánh quy xuống thị trấn cho con chó của Sam. Bà không nhờ hai lần.',
  level: 1,
  order: 21,
  opens: ['ct-okafor-1'],
  after: 'job-half5',
  from: 'okafor',
  lines: LINES_1,
  facts: [
    { id: 'bus', label: 'Chuyến mấy giờ', line: a('02'), consequence: 'bus' },
    { id: 'stand', label: 'Bến nào', line: a('03'), consequence: 'stand' },
    { id: 'hand', label: 'Gửi thế nào', line: a('04'), consequence: 'hand' },
  ],
  consequences: {
    bus: { name: 'Ghi nhầm chuyến: hộp bánh lỡ chuyến bảy giờ năm', rejoin: 'Tess gửi nó theo chuyến sau.' },
    stand: { name: 'Ghi nhầm bến: phải hỏi đường ra bến số bốn', rejoin: 'Người ở đó chỉ ra bến số bốn.' },
    hand: { name: 'Không đưa tận tay tài xế', rejoin: 'Hộp bánh vẫn tới, muộn hoặc vỡ.' },
  },
  steps: [
    { kind: 'goto', place: 'okafor', label: 'Tới ô bán vé của bà Okafor' },
    {
      kind: 'notebook',
      call: ['01', '02', '03', '04', '05'].map(a),
      via: 'scene',
      entries: NOTEBOOK_1,
      repeat: { bus: [a('02r')], stand: [a('03r')], hand: [a('04r')] },
      patience: { after: 2, line: a('06') },
    },
    { kind: 'scene', at: 'pete', who: ['pete'], lines: [a('p1')], if: { note: 'stand', value: 'p4' } },
    { kind: 'goto', place: 'tess', label: 'Tới bến xe buýt số 4, cạnh xe cà phê của Tess' },
    {
      kind: 'scene',
      at: 'tess',
      who: ['tess'],
      lines: [
        { line: a('t1'), if: { note: 'stand', value: 's14' } },
        { line: a('t2'), if: { note: 'bus', is: 'wrong' } },
        { line: a('t3'), if: { note: 'bus', is: 'wrong' } },
        { line: a('t4'), if: { note: 'bus', is: 'right' } },
      ],
    },
    {
      kind: 'phone',
      lines: [
        { line: a('o1'), if: { note: 'hand', value: 'driver' } },
        { line: a('o2'), if: { note: 'hand', value: 'hold' } },
        { line: a('p2'), if: { note: 'hand', value: 'pete' } },
      ],
    },
  ],
  ending: { clean: [a('e1')], messy: [a('e2')], broken: [a('e3')] },
  news: { clean: [a('f1')], messy: [a('f2')], broken: [a('f2')] },
};

// ───────────────────────── 2. Ba con số ─────────────────────────

const b = (key: string) => `job-okafor2-${key}`;

const LINES_2: readonly JobLine[] = [
  { id: b('01'), who: 'okafor', text: 'The doctor says rest my voice. So you ring Sam this morning, not me.', vi: 'Bác sĩ bảo tôi phải nghỉ giọng. Nên sáng nay cháu gọi cho Sam, không phải tôi.' },
  { id: b('02'), who: 'okafor', text: 'From Monday, the first bus is six forty. Not seven any more.', vi: 'Từ thứ Hai, chuyến đầu là sáu giờ bốn mươi. Không còn là bảy giờ nữa.' },
  { id: b('03'), who: 'okafor', text: 'On Sundays, the last one back leaves at half nine.', vi: 'Chủ nhật, chuyến cuối về chạy lúc chín rưỡi.' },
  { id: b('04'), who: 'okafor', text: "And it leaves from stand three now. They're painting four.", vi: 'Và giờ nó chạy từ bến số ba. Người ta đang sơn bến bốn.' },
  { id: b('05'), who: 'okafor', text: "Three numbers. He says three words back. That's our arrangement.", vi: 'Ba con số. Cậu ấy đáp lại ba chữ. Bọn tôi thỏa thuận thế.' },
  { id: b('02r'), who: 'okafor', text: 'Six forty. Twenty to seven.', vi: 'Sáu giờ bốn mươi. Bảy giờ kém hai mươi.' },
  { id: b('03r'), who: 'okafor', text: 'Half nine. Half past nine, on Sundays.', vi: 'Chín rưỡi. Chín giờ rưỡi, ngày Chủ nhật.' },
  { id: b('04r'), who: 'okafor', text: 'Stand three. Three, not four.', vi: 'Bến số ba. Ba, không phải bốn.' },
  { id: b('06'), who: 'okafor', text: "My voice, dear. I've only got so many words left today.", vi: 'Giọng tôi đấy cháu. Hôm nay tôi chỉ còn chừng ấy chữ thôi.' },
  // the learner rings Sam with what they wrote
  { id: b('c1a'), who: 'player', text: 'Morning, Sam. From Monday, the first bus is six forty.', vi: 'Chào Sam. Từ thứ Hai, chuyến đầu là sáu giờ bốn mươi.' },
  { id: b('c1b'), who: 'player', text: 'Morning, Sam. From Monday, the first bus is six fourteen.', vi: 'Chào Sam. Từ thứ Hai, chuyến đầu là sáu giờ mười bốn.' },
  { id: b('c1c'), who: 'player', text: 'Morning, Sam. From Monday, the first bus is seven forty.', vi: 'Chào Sam. Từ thứ Hai, chuyến đầu là bảy giờ bốn mươi.' },
  { id: b('c2a'), who: 'player', text: 'On Sundays, the last bus back is half nine.', vi: 'Chủ nhật, chuyến cuối về là chín rưỡi.' },
  { id: b('c2b'), who: 'player', text: 'On Sundays, the last bus back is half eight.', vi: 'Chủ nhật, chuyến cuối về là tám rưỡi.' },
  { id: b('c2c'), who: 'player', text: "On Sundays, the last bus back is nine o'clock.", vi: 'Chủ nhật, chuyến cuối về là chín giờ.' },
  { id: b('c3a'), who: 'player', text: 'And it leaves from stand three now.', vi: 'Và giờ nó chạy từ bến số ba.' },
  { id: b('c3b'), who: 'player', text: 'And it leaves from stand thirteen now.', vi: 'Và giờ nó chạy từ bến số mười ba.' },
  { id: b('c3c'), who: 'player', text: 'And it still leaves from stand four.', vi: 'Và nó vẫn chạy từ bến số bốn.' },
  // Sam texts back; Rico reads his three words out
  { id: b('r1'), who: 'rico', text: 'He texted back. Three words. Okay. Thanks. Chip.', vi: 'Nó nhắn lại rồi. Ba chữ. Được. Cảm ơn. Chip.' },
  { id: b('r2'), who: 'rico', text: 'Sam texts. First bus, really? Check.', vi: 'Sam nhắn. Chuyến đầu, thật à? Xem lại.' },
  { id: b('k2'), who: 'okafor', text: 'Six forty. Twenty to seven. Tell him again.', vi: 'Sáu giờ bốn mươi. Bảy giờ kém hai mươi. Nói lại với cậu ấy.' },
  { id: b('r3'), who: 'rico', text: 'Sam texts. Sunday, really? Check.', vi: 'Sam nhắn. Chủ nhật, thật à? Xem lại.' },
  { id: b('k3'), who: 'okafor', text: 'Half nine. Half past nine. Honestly.', vi: 'Chín rưỡi. Chín giờ rưỡi. Thật tình.' },
  { id: b('r4'), who: 'rico', text: 'Sam texts. Which stand, really? Check.', vi: 'Sam nhắn. Bến nào, thật à? Xem lại.' },
  { id: b('k4'), who: 'okafor', text: "Three. Stand three. Four's being painted.", vi: 'Ba. Bến số ba. Bến bốn đang sơn.' },
  { id: b('c4'), who: 'player', text: 'Sorry, Sam. Here it is again, properly this time.', vi: 'Xin lỗi Sam. Nói lại nhé, lần này cho đúng.' },
  { id: b('r5'), who: 'rico', text: 'Three words back. Got it. Thanks.', vi: 'Ba chữ trả lời. Rõ rồi. Cảm ơn.' },
  { id: b('e1'), who: 'okafor', text: 'Three numbers, three words. You did that better than I do.', vi: 'Ba con số, ba chữ. Cháu làm còn hay hơn tôi.' },
  { id: b('e2'), who: 'okafor', text: 'Well, he got them in the end. So do my trains.', vi: 'Thôi, cuối cùng cậu ấy cũng nhận đủ. Tàu của tôi cũng vậy.' },
  { id: b('e3'), who: 'okafor', text: "Tomorrow I'm ringing him myself, voice or no voice.", vi: 'Mai tôi tự gọi cho cậu ấy, có giọng hay không cũng vậy.' },
  { id: b('f1'), who: 'kit', text: 'New times for the number nine from Monday. Ask at the ticket window.', vi: 'Xe số chín có giờ mới từ thứ Hai. Hỏi ở ô bán vé nhé.' },
  { id: b('f2'), who: 'kit', text: 'Some confusion this morning about the number nine. It has been sorted out.', vi: 'Sáng nay có chút nhầm lẫn về xe số chín. Đã giải quyết xong.' },
];

const NOTEBOOK_2: NoteEntry[] = [
  {
    key: 'first',
    label: 'Chuyến đầu từ thứ Hai',
    line: b('02'),
    answer: '640',
    options: [
      { value: '640', label: '6:40' },
      { value: '614', label: '6:14' },
      { value: '740', label: '7:40' },
    ],
  },
  {
    key: 'sunday',
    label: 'Chuyến cuối về ngày Chủ nhật',
    line: b('03'),
    answer: '930',
    options: [
      { value: '930', label: '9:30' },
      { value: '830', label: '8:30' },
      { value: '900', label: '9:00' },
    ],
  },
  {
    key: 'stand',
    label: 'Chạy từ bến nào',
    line: b('04'),
    answer: 's3',
    options: [
      { value: 's3', label: 'Bến số 3' },
      { value: 's13', label: 'Bến số 13' },
      { value: 's4', label: 'Vẫn bến số 4' },
    ],
  },
];

const ALL_RIGHT_2 = { all: [{ note: 'first', is: 'right' as const }, { note: 'sunday', is: 'right' as const }, { note: 'stand', is: 'right' as const }] };

export const JOB_OKAFOR_2: JobDoc = {
  id: 'job-okafor2',
  title: 'Ba con số',
  blurb: 'Bà Okafor mất giọng, mà sáng nào bà cũng gọi cho Sam. Hôm nay bạn gọi thay.',
  level: 1,
  order: 22,
  opens: ['ct-okafor-1'],
  after: 'job-okafor1',
  from: 'okafor',
  lines: LINES_2,
  facts: [
    { id: 'first', label: 'Chuyến đầu', line: b('02'), consequence: 'first' },
    { id: 'sunday', label: 'Chuyến cuối Chủ nhật', line: b('03'), consequence: 'sunday' },
    { id: 'stand', label: 'Bến nào', line: b('04'), consequence: 'stand' },
  ],
  consequences: {
    first: { name: 'Báo Sam sai giờ chuyến đầu', rejoin: 'Sam nhắn hỏi lại, bà Okafor nói lại, bạn gọi lại.' },
    sunday: { name: 'Báo Sam sai chuyến cuối ngày Chủ nhật', rejoin: 'Sam nhắn hỏi lại, bà Okafor nói lại, bạn gọi lại.' },
    stand: { name: 'Báo Sam sai bến', rejoin: 'Sam nhắn hỏi lại, bà Okafor nói lại, bạn gọi lại.' },
  },
  steps: [
    { kind: 'goto', place: 'okafor', label: 'Tới ô bán vé của bà Okafor' },
    {
      kind: 'notebook',
      call: ['01', '02', '03', '04', '05'].map(b),
      via: 'scene',
      entries: NOTEBOOK_2,
      repeat: { first: [b('02r')], sunday: [b('03r')], stand: [b('04r')] },
      patience: { after: 2, line: b('06') },
    },
    {
      kind: 'phone',
      lines: [
        { line: b('c1a'), if: { note: 'first', value: '640' } },
        { line: b('c1b'), if: { note: 'first', value: '614' } },
        { line: b('c1c'), if: { note: 'first', value: '740' } },
        { line: b('c2a'), if: { note: 'sunday', value: '930' } },
        { line: b('c2b'), if: { note: 'sunday', value: '830' } },
        { line: b('c2c'), if: { note: 'sunday', value: '900' } },
        { line: b('c3a'), if: { note: 'stand', value: 's3' } },
        { line: b('c3b'), if: { note: 'stand', value: 's13' } },
        { line: b('c3c'), if: { note: 'stand', value: 's4' } },
      ],
    },
    {
      kind: 'scene',
      at: 'okafor',
      who: ['okafor', 'rico'],
      lines: [
        { line: b('r1'), if: ALL_RIGHT_2 },
        { line: b('r2'), if: { note: 'first', is: 'wrong' } },
        { line: b('k2'), if: { note: 'first', is: 'wrong' } },
        { line: b('r3'), if: { note: 'sunday', is: 'wrong' } },
        { line: b('k3'), if: { note: 'sunday', is: 'wrong' } },
        { line: b('r4'), if: { note: 'stand', is: 'wrong' } },
        { line: b('k4'), if: { note: 'stand', is: 'wrong' } },
      ],
    },
    { kind: 'phone', lines: [b('c4'), b('r5')], if: { not: ALL_RIGHT_2 } },
  ],
  ending: { clean: [b('e1')], messy: [b('e2')], broken: [b('e3')] },
  news: { clean: [b('f1')], messy: [b('f2')], broken: [b('f2')] },
};

// ───────────────────────── 3. Chuyến xe đầu tiên ─────────────────────────

const c = (key: string) => `job-okafor3-${key}`;

const LINES_3: readonly JobLine[] = [
  { id: c('01'), who: 'pete', text: "She's left me in charge of the window. Me. I can't even read a timetable.", vi: 'Bà ấy giao ô cửa cho tôi. Tôi đấy. Tôi còn chẳng đọc nổi giờ tàu xe.' },
  { id: c('02'), who: 'okafor', text: "You'll manage, Pete. Say ten past for everything. You'll be right half the time.", vi: 'Cậu xoay xở được mà, Pete. Cái gì cũng nói mười phút qua giờ. Đúng được một nửa.' },
  { id: c('03'), who: 'okafor', text: 'My bus is the ten past nine, from stand three.', vi: 'Chuyến của tôi là chín giờ mười, ở bến số ba.' },
  { id: c('04'), who: 'okafor', text: "I'm getting off at the very last stop. Not Old Bridge, not Hill Farm.", vi: 'Tôi xuống ở trạm cuối cùng. Không phải Old Bridge, không phải Hill Farm.' },
  { id: c('05'), who: 'okafor', text: "And my biscuits are with Pete, in lost property. Don't ask why.", vi: 'Còn hộp bánh của tôi ở chỗ Pete, phòng đồ thất lạc. Đừng hỏi vì sao.' },
  { id: c('03r'), who: 'okafor', text: 'Ten past nine. Nine ten. Stand three.', vi: 'Chín giờ mười. Chín giờ mười phút. Bến số ba.' },
  { id: c('04r'), who: 'okafor', text: 'The last stop. The town itself. Where Sam is.', vi: 'Trạm cuối. Chính thị trấn. Chỗ Sam ở.' },
  { id: c('05r'), who: 'okafor', text: 'With Pete. Lost property. Top shelf.', vi: 'Ở chỗ Pete. Phòng đồ thất lạc. Kệ trên cùng.' },
  { id: c('06'), who: 'okafor', text: "I'm nervous, that's all. I repeat things when I'm nervous.", vi: 'Tôi hồi hộp thôi. Hồi hộp là tôi hay nói đi nói lại.' },
  // the biscuits, where the learner wrote they were
  { id: c('t1'), who: 'tess', text: 'Biscuits? Not here, love. Pete had a tin on his top shelf.', vi: 'Bánh quy á? Không có ở đây đâu. Pete có một hộp trên kệ trên cùng đấy.' },
  { id: c('p0'), who: 'pete', text: 'Under your counter? No, Mrs Okafor. You gave them to me. Top shelf.', vi: 'Dưới quầy của bà á? Không đâu bà Okafor. Bà đưa cho tôi mà. Kệ trên cùng.' },
  { id: c('p1'), who: 'pete', text: 'One tin, biscuits, owner Mrs Okafor. Signed out. Off you go.', vi: 'Một hộp, bánh quy, chủ là bà Okafor. Đã ký nhận. Đi đi.' },
  // the time, at the bus bay
  { id: c('b1'), who: 'tannoy', text: 'The ten past nine to the town will leave from stand three.', vi: 'Chuyến chín giờ mười về thị trấn sẽ khởi hành từ bến số ba.' },
  { id: c('b2'), who: 'okafor', text: "Ten to? I said ten past. We've stood here twenty minutes.", vi: 'Kém mười á? Tôi bảo mười phút qua giờ. Mình đứng đây hai mươi phút rồi đấy.' },
  { id: c('b3'), who: 'okafor', text: "Nine forty? It's leaving now! Run. No, I don't run. Walk fast.", vi: 'Chín giờ bốn mươi? Nó chạy bây giờ đấy! Chạy đi. Không, tôi không chạy. Đi nhanh.' },
  // the stop, told to the driver
  { id: c('s1'), who: 'player', text: 'The last stop, please. The town.', vi: 'Cho xuống trạm cuối. Thị trấn ạ.' },
  { id: c('s2'), who: 'player', text: 'Old Bridge, please. She gets off at Old Bridge.', vi: 'Cho xuống Old Bridge. Bà ấy xuống ở Old Bridge.' },
  { id: c('s3'), who: 'player', text: 'Hill Farm, please. She gets off at Hill Farm.', vi: 'Cho xuống Hill Farm. Bà ấy xuống ở Hill Farm.' },
  { id: c('s4'), who: 'okafor', text: "Old Bridge? Hill Farm? I'll tell him myself, thank you. The last stop.", vi: 'Old Bridge? Hill Farm? Để tôi tự nói, cảm ơn. Trạm cuối.' },
  { id: c('s5'), who: 'okafor', text: 'Forty minutes. Twenty-two years. Well. Here I go.', vi: 'Bốn mươi phút. Hai mươi hai năm. Thôi. Đi đây.' },
  { id: c('s6'), who: 'tess', text: "She's waving! Mrs Okafor's actually waving!", vi: 'Bà ấy vẫy tay kìa! Bà Okafor vẫy tay thật kìa!' },
  { id: c('e1'), who: 'pete', text: 'She rang from the town. Chip sat on her feet. She sounded twelve.', vi: 'Bà ấy gọi từ thị trấn. Chip nằm lên chân bà. Nghe giọng như mười hai tuổi.' },
  { id: c('e2'), who: 'pete', text: 'She got there. She says the bus was a minute late. Of course she does.', vi: 'Bà ấy tới nơi rồi. Bà bảo xe trễ một phút. Tất nhiên rồi.' },
  { id: c('e3'), who: 'pete', text: "She got there in the end. I've sold three tickets to the wrong places.", vi: 'Cuối cùng bà ấy cũng tới. Còn tôi bán nhầm ba vé rồi.' },
  { id: c('f1'), who: 'kit', text: 'Sam at the town bus stop reports a visitor today. A very punctual one.', vi: 'Sam ở trạm xe thị trấn báo hôm nay có khách. Một vị khách cực kỳ đúng giờ.' },
  { id: c('f2'), who: 'kit', text: 'The ticket window at Central Station is staffed by Pete today. Good luck.', vi: 'Hôm nay ô bán vé ở Ga trung tâm do Pete trực. Chúc may mắn.' },
];

const NOTEBOOK_3: NoteEntry[] = [
  {
    key: 'when',
    label: 'Chuyến của bà mấy giờ',
    line: c('03'),
    answer: '910',
    options: [
      { value: '910', label: '9:10' },
      { value: '850', label: '8:50' },
      { value: '940', label: '9:40' },
    ],
  },
  {
    key: 'stop',
    label: 'Bà xuống trạm nào',
    line: c('04'),
    answer: 'last',
    options: [
      { value: 'last', label: 'Trạm cuối (thị trấn)' },
      { value: 'bridge', label: 'Old Bridge' },
      { value: 'farm', label: 'Hill Farm' },
    ],
  },
  {
    key: 'tin',
    label: 'Hộp bánh để ở đâu',
    line: c('05'),
    answer: 'pete',
    options: [
      { value: 'pete', label: 'Phòng đồ thất lạc (Pete)' },
      { value: 'tess', label: 'Xe cà phê của Tess' },
      { value: 'okafor', label: 'Dưới quầy bán vé' },
    ],
  },
];

export const JOB_OKAFOR_3: JobDoc = {
  id: 'job-okafor3',
  title: 'Chuyến xe đầu tiên',
  blurb: 'Hai mươi hai năm bán vé, hôm nay bà Okafor lần đầu tự đi xe số 9. Pete ngồi ô cửa thay bà.',
  level: 2,
  order: 23,
  opens: ['ct-okafor-1'],
  after: 'job-okafor2',
  from: 'okafor',
  lines: LINES_3,
  facts: [
    { id: 'when', label: 'Chuyến mấy giờ', line: c('03'), consequence: 'when' },
    { id: 'stop', label: 'Xuống trạm nào', line: c('04'), consequence: 'stop' },
    { id: 'tin', label: 'Hộp bánh ở đâu', line: c('05'), consequence: 'tin' },
  ],
  consequences: {
    when: { name: 'Ghi sai giờ xe: đứng chờ hai mươi phút, hoặc suýt lỡ chuyến', rejoin: 'Bà Okafor vẫn lên xe.' },
    stop: { name: 'Nói nhầm trạm với tài xế', rejoin: 'Bà Okafor tự nói lại với tài xế.' },
    tin: { name: 'Đi tìm hộp bánh nhầm chỗ', rejoin: 'Tess chỉ sang chỗ Pete.' },
  },
  steps: [
    { kind: 'goto', place: 'okafor', label: 'Tới ô bán vé của bà Okafor' },
    {
      kind: 'notebook',
      call: ['01', '02', '03', '04', '05'].map(c),
      via: 'scene',
      entries: NOTEBOOK_3,
      repeat: { when: [c('03r')], stop: [c('04r')], tin: [c('05r')] },
      patience: { after: 2, line: c('06') },
    },
    // the biscuits: where the learner wrote; a wrong place sends them on to Pete
    { kind: 'goto', place: 'tess', label: 'Tới chỗ bạn đã ghi để lấy hộp bánh', if: { note: 'tin', value: 'tess' } },
    { kind: 'scene', at: 'tess', who: ['tess'], lines: [c('t1')], if: { note: 'tin', value: 'tess' } },
    { kind: 'scene', at: 'okafor', who: ['pete', 'okafor'], lines: [c('p0')], if: { note: 'tin', value: 'okafor' } },
    { kind: 'goto', place: 'pete', label: 'Tới phòng đồ thất lạc của Pete' },
    { kind: 'scene', at: 'pete', who: ['pete', 'okafor'], lines: [c('p1')] },
    // the bus bay, at the time noted
    { kind: 'goto', place: 'tess', label: 'Đưa bà Okafor ra bến số ba' },
    {
      kind: 'scene',
      at: 'tess',
      who: ['okafor', 'tess'],
      lines: [{ line: c('b2'), if: { note: 'when', value: '850' } }, { line: c('b3'), if: { note: 'when', value: '940' } }, c('b1')],
    },
    {
      kind: 'scene',
      at: 'tess',
      who: ['okafor', 'tess'],
      lines: [
        { line: c('s1'), if: { note: 'stop', value: 'last' } },
        { line: c('s2'), if: { note: 'stop', value: 'bridge' } },
        { line: c('s3'), if: { note: 'stop', value: 'farm' } },
        { line: c('s4'), if: { note: 'stop', is: 'wrong' } },
        c('s5'),
        c('s6'),
      ],
    },
  ],
  ending: { clean: [c('e1')], messy: [c('e2')], broken: [c('e3')] },
  news: { clean: [c('f1')], messy: [c('f2')], broken: [c('f2')] },
};

export const SIDE_OKAFOR: readonly JobDoc[] = [JOB_OKAFOR_1, JOB_OKAFOR_2, JOB_OKAFOR_3];
