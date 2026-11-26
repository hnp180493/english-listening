// Side chain B of Act I: "Băng giọng của giáo sư" (docs/gta-story.md §5), three small jobs. Professor Adeyemi has
// spent his life on how English is really SAID; honest, never promises anything; could not follow a film for two years
// when he came; his method is the same five minutes of radio a day, three times (docs/city.md §7, §10). The browser's
// voice has no habits of its own (docs/gta-plan.md §11.6), so the difference between speakers is in the WORDS: each
// line's `say` is how that person really runs it together, and the learner writes down which way they heard.
//
// As written, against the outline (docs/gta-story.md §8 "As written"): job 1 records three people, not five (Rico,
// Mrs Okafor, Hal); job 2's reader is Claire (Daniel's sister), not Daniel (a town resident would need clips; jobs play
// the browser's voice only), reading a page Daniel let her read; job 3 is Kit's tape boxes and Yuki's five minutes.

import type { JobLine, NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

// ───────────────────────── 1. Một câu, ba cách nói ─────────────────────────

const a = (key: string) => `job-prof1-${key}`;

const SENT = 'What are you going to do with it?';

const LINES_1: readonly JobLine[] = [
  { id: a('01'), who: 'adeyemi', text: "A small job. Show three people this ticket and say you've won it.", vi: 'Một việc nhỏ. Cho ba người xem tấm vé này và bảo là bạn trúng thưởng.' },
  { id: a('02'), who: 'adeyemi', text: "They'll all ask you the same question. I want to hear how.", vi: 'Ai cũng sẽ hỏi bạn cùng một câu. Tôi muốn nghe họ hỏi thế nào.' },
  { id: a('03'), who: 'yuki', text: "It's only a ferry ticket. He's got a drawer full of them.", vi: 'Chỉ là vé phà thôi. Thầy có cả ngăn kéo đầy.' },
  { id: a('v1'), who: 'rico', text: 'A ferry trip? You lucky thing. Bring me back a seagull.', vi: 'Một chuyến phà à? Hên thế. Mang về cho tôi một con hải âu.' },
  { id: a('v2'), who: 'okafor', text: "A ferry ticket? The ten forty's the only one that's ever on time.", vi: 'Vé phà à? Chỉ có chuyến mười giờ bốn mươi là đúng giờ thôi.' },
  { id: a('v3'), who: 'hal', text: 'Won a ticket, have you? I get seasick just looking at it.', vi: 'Trúng vé à? Tôi nhìn thôi đã say sóng.' },
  // the tapes, back at the lab
  { id: a('n0'), who: 'adeyemi', text: 'Now, the tapes. Rico first, then Mrs Okafor, then Hal.', vi: 'Giờ tới băng. Rico trước, rồi bà Okafor, rồi Hal.' },
  { id: a('n1'), who: 'rico', text: SENT, vi: 'Rồi bạn định làm gì với nó?', say: 'Whatcha gonna do with it?' },
  { id: a('n2'), who: 'okafor', text: SENT, vi: 'Rồi cháu định làm gì với nó?', say: SENT },
  { id: a('n3'), who: 'hal', text: SENT, vi: 'Thế định làm gì với nó?', say: "What're you gonna do with it?" },
  { id: a('n4'), who: 'adeyemi', text: 'Play them as often as you like. Nobody is timing you.', vi: 'Cứ mở lại bao nhiêu lần tùy ý. Không ai bấm giờ đâu.' },
  { id: a('c1'), who: 'adeyemi', text: 'Rico ran it all together. Whatcha gonna. He always does.', vi: 'Rico nói dính hết vào nhau. Whatcha gonna. Lúc nào cũng thế.' },
  { id: a('c2'), who: 'adeyemi', text: 'Mrs Okafor said every word. Words are her timetable.', vi: 'Bà Okafor nói đủ từng chữ. Chữ là lịch chạy tàu của bà ấy.' },
  { id: a('c3'), who: 'adeyemi', text: 'Hal kept the you, but going to became gonna.', vi: 'Hal giữ chữ you, nhưng going to thành gonna.' },
  { id: a('e1'), who: 'adeyemi', text: "Three people, three rhythms, and you heard all three. None of them is lazy.", vi: 'Ba người, ba nhịp, và bạn nghe ra cả ba. Không ai trong số họ lười cả.' },
  { id: a('e2'), who: 'adeyemi', text: "Two out of three. That's two more than I heard at your age.", vi: 'Hai trên ba. Hơn tôi hồi bằng tuổi bạn hai cái.' },
  { id: a('e3'), who: 'adeyemi', text: "Good. Now you know what to listen for. That's the whole job.", vi: 'Tốt. Giờ bạn biết phải nghe cái gì. Việc chỉ có vậy.' },
  { id: a('f1'), who: 'kit', text: "A ferry ticket's been doing the rounds of Westbay today. Nobody's used it.", vi: 'Hôm nay có một tấm vé phà đi một vòng Westbay. Chẳng ai dùng nó.' },
];

const FORMS = [
  { value: 'full', label: 'Đủ từng chữ: what are you going to do' },
  { value: 'mid', label: 'WHAT-ər yoo GUN-nə do' },
  { value: 'short', label: 'WHAT-chə GUN-nə do' },
];

const NOTEBOOK_1: NoteEntry[] = [
  { key: 'rico', label: 'Rico nói thế nào', line: a('n1'), answer: 'short', options: FORMS },
  { key: 'okafor', label: 'Bà Okafor nói thế nào', line: a('n2'), answer: 'full', options: FORMS },
  { key: 'hal', label: 'Hal nói thế nào', line: a('n3'), answer: 'mid', options: FORMS },
];

export const JOB_PROF_1: JobDoc = {
  id: 'job-prof1',
  title: 'Một câu, ba cách nói',
  blurb: 'Giáo sư Adeyemi cần ba người hỏi cùng một câu. Ông muốn nghe xem mỗi người nói nó thế nào.',
  level: 1,
  order: 31,
  opens: ['ct-adeyemi-1'],
  after: 'job-half5',
  from: 'adeyemi',
  lines: LINES_1,
  facts: [
    { id: 'rico', label: 'Rico nói thế nào', line: a('n1'), consequence: 'rico' },
    { id: 'okafor', label: 'Bà Okafor nói thế nào', line: a('n2'), consequence: 'okafor' },
    { id: 'hal', label: 'Hal nói thế nào', line: a('n3'), consequence: 'hal' },
  ],
  consequences: {
    rico: { name: 'Ghi sai cách Rico nói', rejoin: 'Giáo sư mở lại và chỉ chỗ nối âm.' },
    okafor: { name: 'Ghi sai cách bà Okafor nói', rejoin: 'Giáo sư mở lại và chỉ chỗ nối âm.' },
    hal: { name: 'Ghi sai cách Hal nói', rejoin: 'Giáo sư mở lại và chỉ chỗ nối âm.' },
  },
  steps: [
    { kind: 'goto', place: 'adeyemi', label: 'Tới phòng thí nghiệm ngữ âm' },
    { kind: 'scene', at: 'adeyemi', who: ['adeyemi', 'yuki'], lines: ['01', '02', '03'].map(a) },
    { kind: 'goto', place: 'rico', label: 'Cho Rico xem vé, ở bến taxi' },
    { kind: 'scene', at: 'rico', who: ['rico'], lines: [a('v1')] },
    { kind: 'goto', place: 'okafor', label: 'Cho bà Okafor xem vé, ở ô bán vé' },
    { kind: 'scene', at: 'okafor', who: ['okafor'], lines: [a('v2')] },
    { kind: 'goto', place: 'hal', label: 'Cho Hal xem vé, ở hàng cá' },
    { kind: 'scene', at: 'hal', who: ['hal'], lines: [a('v3')] },
    { kind: 'goto', place: 'adeyemi', label: 'Mang băng về phòng thí nghiệm' },
    { kind: 'notebook', call: ['n0', 'n1', 'n2', 'n3'].map(a), via: 'radio', entries: NOTEBOOK_1, patience: { after: 3, line: a('n4') } },
    {
      kind: 'scene',
      at: 'adeyemi',
      who: ['adeyemi'],
      lines: [
        { line: a('c1'), if: { note: 'rico', is: 'wrong' } },
        { line: a('c2'), if: { note: 'okafor', is: 'wrong' } },
        { line: a('c3'), if: { note: 'hal', is: 'wrong' } },
      ],
    },
  ],
  ending: { clean: [a('e1')], messy: [a('e2')], broken: [a('e3')] },
  news: { clean: [a('f1')], messy: [a('f1')], broken: [a('f1')] },
};

// ───────────────────────── 2. Trang chín mươi ─────────────────────────

const b = (key: string) => `job-prof2-${key}`;

const LINES_2: readonly JobLine[] = [
  { id: b('01'), who: 'claire', text: 'Daniel said yes, as long as nobody laughs. Page ninety. The umbrella page.', vi: 'Daniel đồng ý rồi, miễn là không ai cười. Trang chín mươi. Trang cái ô.' },
  { id: b('02'), who: 'claire', text: 'She left her umbrella on the ten forty ferry.', vi: 'Cô ấy để quên chiếc ô trên chuyến phà mười giờ bốn mươi.' },
  { id: b('03'), who: 'claire', text: 'It rained all the way home, and she sang.', vi: 'Trời mưa suốt đường về, và cô ấy hát.' },
  { id: b('04'), who: 'claire', text: "She didn't go back for it. Not ever.", vi: 'Cô ấy không quay lại lấy nó. Không bao giờ.' },
  { id: b('05'), who: 'claire', text: "That's all he'd let me read. He's very particular about commas.", vi: 'Cậu ấy chỉ cho đọc chừng ấy. Cậu ấy kỹ tính lắm với dấu phẩy.' },
  { id: b('02r'), who: 'claire', text: 'The ten forty. Twenty to eleven.', vi: 'Chuyến mười giờ bốn mươi. Mười một giờ kém hai mươi.' },
  { id: b('03r'), who: 'claire', text: 'She sang. Singing in the rain, more or less.', vi: 'Cô ấy hát. Hát trong mưa, kiểu vậy.' },
  { id: b('04r'), who: 'claire', text: 'She did not go back. Never.', vi: 'Cô ấy không quay lại. Không bao giờ.' },
  { id: b('06'), who: 'claire', text: "I'll read it once more, and then it goes back in the drawer.", vi: 'Tôi đọc thêm một lần, rồi nó vào lại ngăn kéo.' },
  { id: b('c1'), who: 'claire', text: "The ten fourteen? There's no such ferry. It's the ten forty.", vi: 'Mười giờ mười bốn á? Làm gì có chuyến phà nào như thế. Là mười giờ bốn mươi.' },
  { id: b('c2'), who: 'claire', text: 'Sank? She sang! Daniel would faint if he saw that.', vi: 'Chìm á? Cô ấy hát mà! Daniel mà thấy chắc ngất.' },
  { id: b('c3'), who: 'claire', text: "She went back? No. She didn't. That's the whole point of the page.", vi: 'Cô ấy quay lại á? Không. Cô ấy không quay lại. Cả trang chỉ nói điều đó.' },
  { id: b('e1'), who: 'adeyemi', text: "Every word right. Didn't go back is hard. The t hardly sounds at all.", vi: 'Đúng hết từng chữ. Didn\'t go back khó lắm. Chữ t gần như không phát ra.' },
  { id: b('e2'), who: 'adeyemi', text: "Not bad. The little words are always the ones that slip away.", vi: 'Không tệ. Mấy chữ nhỏ bao giờ cũng là chữ dễ trượt mất.' },
  { id: b('e3'), who: 'adeyemi', text: "Don't worry. It took me two years to follow a film.", vi: 'Đừng lo. Tôi mất hai năm mới theo kịp một bộ phim.' },
  { id: b('f1'), who: 'kit', text: 'Harbour Press tells us a page of a local novel was read aloud today.', vi: 'Harbour Press cho biết hôm nay có một trang tiểu thuyết của người địa phương được đọc to.' },
];

const NOTEBOOK_2: NoteEntry[] = [
  {
    key: 'ferry',
    label: 'Cô ấy để quên ô trên chuyến phà nào',
    line: b('02'),
    answer: '1040',
    options: [
      { value: '1040', label: 'Chuyến 10:40' },
      { value: '1014', label: 'Chuyến 10:14' },
      { value: '410', label: 'Chuyến 4:10' },
    ],
  },
  {
    key: 'sang',
    label: 'Trên đường về dưới mưa, cô ấy làm gì',
    line: b('03'),
    answer: 'sang',
    options: [
      { value: 'sang', label: 'Hát' },
      { value: 'sank', label: 'Chìm, gục xuống' },
      { value: 'sat', label: 'Ngồi xuống' },
    ],
  },
  {
    key: 'back',
    label: 'Cô ấy có quay lại lấy ô không',
    line: b('04'),
    answer: 'no',
    options: [
      { value: 'no', label: 'Không, không bao giờ' },
      { value: 'yes', label: 'Có, cô ấy quay lại' },
      { value: 'later', label: 'Hôm sau mới quay lại' },
    ],
  },
];

export const JOB_PROF_2: JobDoc = {
  id: 'job-prof2',
  title: 'Trang chín mươi',
  blurb: 'Claire đọc to một trang trong bản thảo của Daniel để giáo sư ghi âm. Bạn chép lại cho ông.',
  level: 2,
  order: 32,
  opens: ['ct-adeyemi-1'],
  after: 'job-prof1',
  from: 'adeyemi',
  lines: LINES_2,
  facts: [
    { id: 'ferry', label: 'Chuyến phà nào', line: b('02'), consequence: 'ferry' },
    { id: 'sang', label: 'Cô ấy làm gì dưới mưa', line: b('03'), consequence: 'sang' },
    { id: 'back', label: 'Có quay lại không', line: b('04'), consequence: 'back' },
  ],
  consequences: {
    ferry: { name: 'Chép sai giờ chuyến phà', rejoin: 'Claire sửa lại cho đúng.' },
    sang: { name: 'Chép "chìm" thay cho "hát"', rejoin: 'Claire sửa lại cho đúng.' },
    back: { name: 'Chép rằng cô ấy quay lại', rejoin: 'Claire sửa lại cho đúng.' },
  },
  steps: [
    { kind: 'goto', place: 'claire', label: 'Tới nhà sách Harbour Press' },
    {
      kind: 'notebook',
      call: ['01', '02', '03', '04', '05'].map(b),
      via: 'scene',
      entries: NOTEBOOK_2,
      repeat: { ferry: [b('02r')], sang: [b('03r')], back: [b('04r')] },
      patience: { after: 2, line: b('06') },
    },
    {
      kind: 'scene',
      at: 'claire',
      who: ['claire'],
      lines: [
        { line: b('c1'), if: { note: 'ferry', is: 'wrong' } },
        { line: b('c2'), if: { note: 'sang', is: 'wrong' } },
        { line: b('c3'), if: { note: 'back', is: 'wrong' } },
      ],
    },
    { kind: 'goto', place: 'adeyemi', label: 'Mang bản chép về cho giáo sư' },
  ],
  ending: { clean: [b('e1')], messy: [b('e2')], broken: [b('e3')] },
  news: { clean: [b('f1')], messy: [b('f1')], broken: [b('f1')] },
};

// ───────────────────────── 3. Năm phút radio ─────────────────────────

const c = (key: string) => `job-prof3-${key}`;

const LINES_3: readonly JobLine[] = [
  { id: c('01'), who: 'kit', text: "The professor's after an old show? The archive's in boxes, by letter.", vi: 'Giáo sư cần một chương trình cũ à? Kho lưu trữ xếp trong hộp, theo chữ cái.' },
  { id: c('02'), who: 'kit', text: 'Market nights are in box M. M for market.', vi: 'Các đêm chợ ở hộp M. M là market.' },
  { id: c('03'), who: 'kit', text: "Top shelf, third from the left. The one with a coffee ring on it.", vi: 'Kệ trên cùng, cái thứ ba từ trái sang. Cái có vết ly cà phê.' },
  { id: c('04'), who: 'kit', text: "The tape you want says Thursday. Marcus's Heritage Fund night.", vi: 'Cuộn băng bạn cần ghi thứ Năm. Cái đêm Marcus nói về Quỹ Bảo tồn.' },
  { id: c('02r'), who: 'kit', text: 'M. Like in market. Not N.', vi: 'M. Như trong chữ market. Không phải N.' },
  { id: c('03r'), who: 'kit', text: 'Third from the left. One, two, three.', vi: 'Thứ ba từ trái sang. Một, hai, ba.' },
  { id: c('04r'), who: 'kit', text: 'Thursday. The night before the market.', vi: 'Thứ Năm. Cái đêm trước buổi chợ.' },
  { id: c('05'), who: 'kit', text: 'Marcus will be back in a minute, and he hates people in his boxes.', vi: 'Marcus sắp quay lại rồi, mà anh ấy ghét người ta lục hộp của mình.' },
  { id: c('k1'), who: 'kit', text: "That's box N. News. Two hours of a council meeting. Try M.", vi: 'Đó là hộp N. Tin tức. Hai tiếng họp hội đồng. Thử hộp M đi.' },
  { id: c('k2'), who: 'kit', text: "That's the first box, not the third. Count again from the left.", vi: 'Đó là hộp thứ nhất, không phải thứ ba. Đếm lại từ bên trái.' },
  { id: c('k3'), who: 'kit', text: "Tuesday's a quiz night. You want the Thursday one.", vi: 'Thứ Ba là đêm đố vui. Bạn cần cuộn thứ Năm.' },
  { id: c('y1'), who: 'adeyemi', text: 'Yuki. Five minutes of this, every day, three times over.', vi: 'Yuki. Năm phút của cuộn này, mỗi ngày, nghe ba lần.' },
  { id: c('y2'), who: 'yuki', text: 'Every day? Even on Sundays?', vi: 'Mỗi ngày ạ? Cả Chủ nhật?' },
  { id: c('y3'), who: 'adeyemi', text: 'Especially on Sundays. No promises, mind. Only the method.', vi: 'Nhất là Chủ nhật. Nhưng không hứa hẹn gì đâu. Chỉ có phương pháp thôi.' },
  { id: c('e1'), who: 'adeyemi', text: 'The right tape, first time. Thank you. Yuki starts tomorrow.', vi: 'Đúng cuộn băng, ngay lần đầu. Cảm ơn bạn. Mai Yuki bắt đầu.' },
  { id: c('e2'), who: 'adeyemi', text: 'We got there. Kit is still muttering about his boxes.', vi: 'Cũng xong. Kit vẫn còn lầm bầm về mấy cái hộp.' },
  { id: c('e3'), who: 'adeyemi', text: 'A tour of the whole archive. Educational, in its way.', vi: 'Một vòng tham quan cả kho lưu trữ. Theo cách nào đó cũng bổ ích.' },
  { id: c('f1'), who: 'kit', text: 'Somebody has been in the archive boxes. Marcus, I promise it wasn\'t me.', vi: 'Có người lục hộp lưu trữ. Marcus, tôi thề không phải tôi.' },
];

const NOTEBOOK_3: NoteEntry[] = [
  {
    key: 'box',
    label: 'Hộp chữ gì',
    line: c('02'),
    answer: 'm',
    options: [
      { value: 'm', label: 'Hộp M' },
      { value: 'n', label: 'Hộp N' },
      { value: 'e', label: 'Hộp E' },
    ],
  },
  {
    key: 'shelf',
    label: 'Cái thứ mấy trên kệ',
    line: c('03'),
    answer: 'third',
    options: [
      { value: 'third', label: 'Thứ ba từ trái sang' },
      { value: 'first', label: 'Thứ nhất từ trái sang' },
      { value: 'thirteenth', label: 'Thứ mười ba' },
    ],
  },
  {
    key: 'day',
    label: 'Cuộn băng ghi thứ mấy',
    line: c('04'),
    answer: 'thu',
    options: [
      { value: 'thu', label: 'Thứ Năm' },
      { value: 'tue', label: 'Thứ Ba' },
      { value: 'sat', label: 'Thứ Bảy' },
    ],
  },
];

export const JOB_PROF_3: JobDoc = {
  id: 'job-prof3',
  title: 'Năm phút radio',
  blurb: 'Giáo sư cần một cuộn băng cũ của Bay FM cho Yuki. Kho băng của Kit xếp theo chữ cái, và Kit nói nhanh.',
  level: 2,
  order: 33,
  opens: ['ct-adeyemi-1'],
  after: 'job-prof2',
  from: 'adeyemi',
  lines: LINES_3,
  facts: [
    { id: 'box', label: 'Hộp chữ gì', line: c('02'), consequence: 'box' },
    { id: 'shelf', label: 'Cái thứ mấy', line: c('03'), consequence: 'shelf' },
    { id: 'day', label: 'Ghi thứ mấy', line: c('04'), consequence: 'day' },
  ],
  consequences: {
    box: { name: 'Mở nhầm hộp', rejoin: 'Kit chỉ sang hộp M.' },
    shelf: { name: 'Lấy nhầm hộp trên kệ', rejoin: 'Kit bảo đếm lại.' },
    day: { name: 'Lấy nhầm cuộn băng', rejoin: 'Kit đưa đúng cuộn thứ Năm.' },
  },
  steps: [
    { kind: 'goto', place: 'kit', label: 'Tới phòng thu Bay FM' },
    {
      kind: 'notebook',
      call: ['01', '02', '03', '04'].map(c),
      via: 'scene',
      entries: NOTEBOOK_3,
      repeat: { box: [c('02r')], shelf: [c('03r')], day: [c('04r')] },
      patience: { after: 2, line: c('05') },
    },
    {
      kind: 'scene',
      at: 'kit',
      who: ['kit'],
      lines: [
        { line: c('k1'), if: { note: 'box', is: 'wrong' } },
        { line: c('k2'), if: { note: 'shelf', is: 'wrong' } },
        { line: c('k3'), if: { note: 'day', is: 'wrong' } },
      ],
    },
    { kind: 'goto', place: 'adeyemi', label: 'Mang cuộn băng về cho giáo sư' },
    { kind: 'scene', at: 'adeyemi', who: ['adeyemi', 'yuki'], lines: ['y1', 'y2', 'y3'].map(c) },
  ],
  ending: { clean: [c('e1')], messy: [c('e2')], broken: [c('e3')] },
  news: { clean: [c('f1')], messy: [c('f1')], broken: [c('f1')] },
};

export const SIDE_PROFESSOR: readonly JobDoc[] = [JOB_PROF_1, JOB_PROF_2, JOB_PROF_3];
