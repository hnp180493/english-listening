// Side chain "Ai đang gọi" (docs/gta-plan.md §5 "nhận ra người qua cách nói", docs/gta-story.md §9): three small jobs at
// Meridian's head office with Hana, who knows every caller by voice (docs/city.md §6). Hana has lost her voice to a
// cold, so the learner minds the information desk while she whispers advice down the phone. Its kind of listening:
// WHO IS SPEAKING, BY HOW THEY TALK. Messages come in with no name. Westbay is all one browser voice, so the speaker is
// told by the WORDS, as Act III's forgeries are (docs/gta-story-3.md §2): Colin calls everybody "mate"; Mr Finch says
// sorry twice before anything; Mr Whitlock never gets Sarah's town right and names it after a stop of the no. 9 (Old
// Bridge, Hill Farm: chats2 `ct-whitlock-1`). Each job: Hana's note (two entries), then a `pick` of three messages with
// no text, then what came of it.
//
// Westbay people only: the browser's voice, no clips. Sarah is named, never heard.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

// ───────────────────────── 1. Giọng không tên ─────────────────────────

const a = (key: string) => `job-hana1-${key}`;

const LINES_1 = [
  { id: a('01'), who: 'priya', text: "Hana's lost her voice. You're on the desk today. She'll ring you.", vi: 'Hana mất giọng rồi. Hôm nay bạn trực quầy. Cô ấy sẽ gọi cho bạn.' },
  { id: a('c01'), who: 'hana', text: 'It is Hana. I can only whisper. People never say their names.', vi: 'Hana đây. Tôi chỉ thì thào được thôi. Người ta chẳng bao giờ xưng tên.' },
  { id: a('c02'), who: 'hana', text: 'Colin calls everybody mate. Even me. Even Mr Whitlock.', vi: 'Colin gọi ai cũng là mate. Cả tôi. Cả ông Whitlock.' },
  { id: a('c03'), who: 'hana', text: "And Priya's meeting is in room four today. Not fourteen.", vi: 'Còn cuộc họp của Priya hôm nay ở phòng bốn. Không phải mười bốn.' },
  { id: a('c02r'), who: 'hana', text: 'Mate. Colin says mate.', vi: 'Mate. Colin nói mate.' },
  { id: a('c03r'), who: 'hana', text: 'Room four. Four.', vi: 'Phòng bốn. Bốn.' },
  { id: a('c04'), who: 'hana', text: 'I must stop. My throat. Good luck.', vi: 'Tôi phải ngừng thôi. Cổ họng tôi. Chúc may mắn.' },
  // three messages, no names
  { id: a('m1'), who: 'whitlock', text: 'Ah, hello. Tell Priya I have signed the papers. Thank you.', vi: 'À, chào. Nhắn Priya là tôi đã ký giấy rồi. Cảm ơn.' },
  { id: a('m2'), who: 'colin', text: 'Alright, mate. Can Priya ring me back? Before lunch, mate, if she can.', vi: 'Chào mate. Priya gọi lại cho tôi được không? Trước bữa trưa nhé mate, nếu được.' },
  { id: a('m3'), who: 'dev', text: 'Hi. The printer on floor two is fixed. Tell Priya, please.', vi: 'Chào. Máy in tầng hai sửa xong rồi. Nhắn Priya giùm.' },
  { id: a('p01'), who: 'priya', text: 'Three messages, no names. Which one is Colin? I have to ring him first.', vi: 'Ba tin nhắn, không ai xưng tên. Cái nào là Colin? Tôi phải gọi lại cho anh ta trước.' },
  { id: a('p02'), who: 'priya', text: "That's Mr Whitlock. Nobody else says thank you to a machine.", vi: 'Đó là ông Whitlock. Chẳng ai khác lại đi cảm ơn cái máy.' },
  { id: a('p03'), who: 'priya', text: "That's Dev. He only rings about printers.", vi: 'Đó là Dev. Cậu ấy chỉ gọi vì máy in thôi.' },
  // what came of it
  { id: a('h01'), who: 'priya', text: 'I rang Colin first. He was so pleased he forgot why he called.', vi: 'Tôi gọi Colin trước. Anh ta vui quá quên mất mình gọi vì việc gì.' },
  { id: a('h02'), who: 'priya', text: 'I rang the wrong man. Colin rang again. Twice. Mate, mate.', vi: 'Tôi gọi nhầm người. Colin gọi lại. Hai lần. Mate, mate.' },
  { id: a('h03'), who: 'priya', text: 'I sat in room fourteen for ten minutes. It is a cupboard.', vi: 'Tôi ngồi ở phòng mười bốn mười phút. Đó là cái kho.' },
  { id: a('h04'), who: 'hana', text: 'Not pal. Mate. Colin would never say pal. He thinks it is rude.', vi: 'Không phải pal. Mate. Colin không bao giờ nói pal. Anh ta nghĩ thế là thô.' },
  { id: a('z1'), who: 'hana', text: 'You heard him by one word. That is all I do, really.', vi: 'Bạn nhận ra anh ta qua một từ. Tôi cũng chỉ làm có thế thôi.' },
  { id: a('z2'), who: 'hana', text: 'Not bad for a first day. It took me a month.', vi: 'Ngày đầu thế là được. Tôi mất cả tháng đấy.' },
  { id: a('z3'), who: 'hana', text: 'Voices take time. Listen for the little words.', vi: 'Nhận giọng cần thời gian. Nghe mấy từ nhỏ ấy.' },
  { id: a('w1'), who: 'kit', text: 'Get well soon to Hana at Meridian. The desk is not the same without her.', vi: 'Chúc Hana ở Meridian mau khỏe. Thiếu cô ấy quầy lễ tân chẳng còn như cũ.' },
];

const NB_1: NoteEntry[] = [
  {
    key: 'colin',
    label: 'Colin hay nói từ gì',
    line: a('c02'),
    answer: 'mate',
    options: [
      { value: 'mate', label: 'mate' },
      { value: 'pal', label: 'pal' },
      { value: 'love', label: 'love' },
    ],
  },
  {
    key: 'room',
    label: 'Priya họp ở phòng nào',
    line: a('c03'),
    answer: '4',
    options: [
      { value: '4', label: 'Phòng 4' },
      { value: '14', label: 'Phòng 14' },
      { value: '40', label: 'Phòng 40' },
    ],
  },
];

export const JOB_HANA_1: JobDoc = {
  id: 'job-hana1',
  title: 'Giọng không tên',
  blurb: 'Hana mất giọng, bạn trực quầy lễ tân thay cô. Người gọi tới chẳng ai xưng tên.',
  level: 1,
  order: 91,
  opens: ['ct-hana-1'],
  after: 'job-half5',
  from: 'hana',
  lines: LINES_1,
  facts: [
    { id: 'colin', label: 'Từ của Colin', line: a('c02'), consequence: 'colin' },
    { id: 'room', label: 'Phòng họp', line: a('c03'), consequence: 'room' },
    { id: 'who', label: 'Tin nhắn của Colin', line: a('m2'), consequence: 'who', byAction: true },
  ],
  consequences: {
    colin: { name: 'Ghi sai từ quen miệng của Colin', rejoin: 'Hana thì thào sửa lại.' },
    room: { name: 'Ghi sai phòng họp: Priya ngồi nhầm phòng', rejoin: 'Mười phút sau Priya sang phòng bốn.' },
    who: { name: 'Chọn nhầm tin nhắn: Priya gọi nhầm người', rejoin: 'Colin tự gọi lại.' },
  },
  steps: [
    { kind: 'goto', place: 'hana', label: 'Tới quầy lễ tân trụ sở Meridian' },
    { kind: 'scene', at: 'hana', who: ['priya'], lines: [a('01')] },
    {
      kind: 'notebook',
      via: 'phone',
      call: [a('c01'), a('c02'), a('c03')],
      entries: NB_1,
      repeat: { colin: [a('c02r')], room: [a('c03r')] },
      patience: { after: 2, line: a('c04') },
    },
    { kind: 'phone', lines: [a('h04')], if: { note: 'colin', is: 'wrong' } },
    { kind: 'pick', ask: [a('p01')], clips: ['m1', 'm2', 'm3'].map(a), right: 1, consequence: 'who', fact: 'who', why: { [a('m1')]: a('p02'), [a('m3')]: a('p03') } },
    {
      kind: 'scene',
      at: 'hana',
      who: ['priya'],
      lines: [
        { line: a('h03'), if: { note: 'room', is: 'wrong' } },
        { line: a('h01'), if: { not: { hit: 'who' } } },
        { line: a('h02'), if: { hit: 'who' } },
      ],
    },
  ],
  ending: { clean: [a('z1')], messy: [a('z2')], broken: [a('z3')] },
  news: { clean: [a('w1')], messy: [a('w1')], broken: [a('w1')] },
};

// ───────────────────────── 2. Xin lỗi, xin lỗi ─────────────────────────

const b = (key: string) => `job-hana2-${key}`;

const LINES_2 = [
  { id: b('c01'), who: 'hana', text: "Still whispering. Today it's the library. Mr Finch rings about a book.", vi: 'Vẫn thì thào. Hôm nay là thư viện. Ông Finch gọi về một cuốn sách.' },
  { id: b('c02'), who: 'hana', text: 'He says sorry twice before anything. Sorry, sorry. Every time.', vi: 'Ông ấy nói xin lỗi hai lần trước mọi chuyện. Sorry, sorry. Lần nào cũng thế.' },
  { id: b('c03'), who: 'hana', text: 'The book is eleven weeks late. Priya has it in her drawer.', vi: 'Cuốn sách trễ hạn mười một tuần rồi. Priya để nó trong ngăn kéo.' },
  { id: b('c02r'), who: 'hana', text: 'Sorry, sorry. Twice. That is Mr Finch.', vi: 'Sorry, sorry. Hai lần. Đó là ông Finch.' },
  { id: b('c03r'), who: 'hana', text: 'Eleven weeks. Eleven.', vi: 'Mười một tuần. Mười một.' },
  { id: b('c04'), who: 'hana', text: 'My throat again. Off you go.', vi: 'Lại cổ họng tôi. Đi đi.' },
  // three messages about a book
  { id: b('m1'), who: 'colin', text: 'Morning, mate. Is there a book about shops in your library? For a friend.', vi: 'Chào mate. Thư viện có sách nào về cửa hàng không? Cho một người bạn.' },
  { id: b('m2'), who: 'yuki', text: 'Hello. I think I have a book of yours. About listening. Sorry it is late.', vi: 'Xin chào. Hình như tôi đang giữ một cuốn sách của các bạn. Về việc nghe. Xin lỗi vì trễ.' },
  { id: b('m3'), who: 'finch', text: 'Sorry, sorry. A book for Priya is rather late. Quietly, no rush.', vi: 'Xin lỗi, xin lỗi. Cuốn sách của Priya hơi trễ hạn. Nhẹ nhàng thôi, không vội.' },
  { id: b('p01'), who: 'priya', text: 'Someone from the library rang? Which message? I am in trouble, aren\'t I.', vi: 'Thư viện gọi à? Tin nhắn nào? Tôi gặp rắc rối rồi phải không.' },
  { id: b('p02'), who: 'priya', text: 'That one says mate. That is Colin, being Colin.', vi: 'Cái đó nói mate. Là Colin, đúng kiểu Colin.' },
  { id: b('p03'), who: 'priya', text: "That's Yuki, the student. She says sorry once. Mr Finch says it twice.", vi: 'Đó là Yuki, cô sinh viên. Cô ấy chỉ xin lỗi một lần. Ông Finch nói hai lần.' },
  // at the library
  { id: b('f01'), who: 'finch', text: 'Sorry, sorry. You brought it back. Eleven weeks. I shall say nothing.', vi: 'Xin lỗi, xin lỗi. Bạn mang trả rồi. Mười một tuần. Tôi sẽ không nói gì đâu.' },
  { id: b('f02'), who: 'finch', text: 'Sorry, sorry. You rang Yuki? She came in with her own book, very confused.', vi: 'Xin lỗi, xin lỗi. Bạn gọi cho Yuki à? Cô bé mang sách của chính mình tới, ngơ ngác lắm.' },
  { id: b('f03'), who: 'finch', text: 'Seven weeks, you say? Eleven, I am afraid. I count very carefully.', vi: 'Bảy tuần à? Mười một tuần cơ. Tôi đếm cẩn thận lắm.' },
  { id: b('f04'), who: 'finch', text: 'I do not say sorry four times. Twice is plenty. Four would be rude.', vi: 'Tôi đâu có xin lỗi bốn lần. Hai lần là đủ. Bốn lần thì bất lịch sự.' },
  { id: b('z1'), who: 'hana', text: 'Two sorries, and you knew. I am nearly not needed.', vi: 'Hai tiếng xin lỗi, thế là bạn biết. Gần như không cần tôi nữa.' },
  { id: b('z2'), who: 'hana', text: 'The book went home. Priya is reformed. For now.', vi: 'Cuốn sách đã về thư viện. Priya đã sửa mình. Tạm thời.' },
  { id: b('z3'), who: 'hana', text: 'Listen for what people repeat. Everybody repeats something.', vi: 'Nghe xem người ta hay lặp lại gì. Ai cũng lặp lại một thứ gì đó.' },
  { id: b('w1'), who: 'kit', text: 'The library on campus asks, kindly, for its books back. Mr Finch says sorry.', vi: 'Thư viện trường nhờ, rất lịch sự, mọi người trả sách. Ông Finch xin lỗi.' },
];

const NB_2: NoteEntry[] = [
  {
    key: 'finch',
    label: 'Ông Finch hay nói gì',
    line: b('c02'),
    answer: 'sorry2',
    options: [
      { value: 'sorry2', label: 'Xin lỗi hai lần' },
      { value: 'sorry1', label: 'Xin lỗi một lần' },
      { value: 'sorry4', label: 'Xin lỗi bốn lần' },
    ],
  },
  {
    key: 'weeks',
    label: 'Sách trễ bao lâu',
    line: b('c03'),
    answer: '11',
    options: [
      { value: '11', label: '11 tuần' },
      { value: '7', label: '7 tuần' },
      { value: '17', label: '17 tuần' },
    ],
  },
];

export const JOB_HANA_2: JobDoc = {
  id: 'job-hana2',
  title: 'Xin lỗi, xin lỗi',
  blurb: 'Hana vẫn chưa có giọng. Hôm nay thư viện gọi tới về một cuốn sách Priya mượn quá hạn.',
  level: 1,
  order: 92,
  opens: ['ct-hana-1'],
  after: 'job-hana1',
  from: 'hana',
  lines: LINES_2,
  facts: [
    { id: 'finch', label: 'Thói quen của ông Finch', line: b('c02'), consequence: 'finch' },
    { id: 'weeks', label: 'Trễ bao lâu', line: b('c03'), consequence: 'weeks' },
    { id: 'who', label: 'Tin nhắn của ông Finch', line: b('m3'), consequence: 'who', byAction: true },
  ],
  consequences: {
    finch: { name: 'Ghi sai thói quen của ông Finch', rejoin: 'Ông ấy tự nói ra.' },
    weeks: { name: 'Ghi sai số tuần trễ hạn', rejoin: 'Ông Finch đếm lại.' },
    who: { name: 'Chọn nhầm tin nhắn: gọi nhầm cho Yuki', rejoin: 'Ông Finch kể Yuki tới thư viện.' },
  },
  steps: [
    { kind: 'goto', place: 'hana', label: 'Tới quầy lễ tân trụ sở Meridian' },
    {
      kind: 'notebook',
      via: 'phone',
      call: [b('c01'), b('c02'), b('c03')],
      entries: NB_2,
      repeat: { finch: [b('c02r')], weeks: [b('c03r')] },
      patience: { after: 2, line: b('c04') },
    },
    { kind: 'pick', ask: [b('p01')], clips: ['m1', 'm2', 'm3'].map(b), right: 2, consequence: 'who', fact: 'who', why: { [b('m1')]: b('p02'), [b('m2')]: b('p03') } },
    { kind: 'goto', place: 'finch', label: 'Mang sách trả thư viện' },
    {
      kind: 'scene',
      at: 'finch',
      who: ['finch'],
      lines: [
        { line: b('f01'), if: { not: { hit: 'who' } } },
        { line: b('f02'), if: { hit: 'who' } },
        { line: b('f03'), if: { note: 'weeks', is: 'wrong' } },
        { line: b('f04'), if: { note: 'finch', is: 'wrong' } },
      ],
    },
  ],
  ending: { clean: [b('z1')], messy: [b('z2')], broken: [b('z3')] },
  news: { clean: [b('w1')], messy: [b('w1')], broken: [b('w1')] },
};

// ───────────────────────── 3. Sarah ở Cầu Cũ ─────────────────────────

const c = (key: string) => `job-hana3-${key}`;

const LINES_3 = [
  { id: c('01'), who: 'hana', text: 'My voice is back. Today I test you. Monday, three messages for Priya.', vi: 'Tôi có giọng lại rồi. Hôm nay tôi kiểm tra bạn. Thứ Hai, ba tin nhắn cho Priya.' },
  { id: c('c01'), who: 'hana', text: "Mr Whitlock never gets Sarah's town right. He names it after a bus stop.", vi: 'Ông Whitlock chẳng bao giờ gọi đúng tên thị trấn của Sarah. Ông ấy gọi theo tên một trạm xe buýt.' },
  { id: c('c02'), who: 'hana', text: "The Monday meeting is at half nine, on the pavement, as usual.", vi: 'Cuộc họp thứ Hai lúc chín rưỡi, trên vỉa hè, như mọi khi.' },
  { id: c('c01r'), who: 'hana', text: 'A bus stop. Old Bridge, Hill Farm. Never the town.', vi: 'Một trạm xe buýt. Cầu Cũ, Trại Đồi. Không bao giờ là tên thị trấn.' },
  { id: c('c02r'), who: 'hana', text: 'Half nine. Nine thirty.', vi: 'Chín rưỡi. Chín giờ ba mươi.' },
  { id: c('c03'), who: 'hana', text: "Now I've got my voice back I'm saving it.", vi: 'Có giọng lại rồi thì tôi phải giữ.' },
  // three messages about Sarah
  { id: c('m1'), who: 'colin', text: "Mate, is Sarah from the town office in today? Tell her I said hello, mate.", vi: 'Mate, hôm nay Sarah ở văn phòng thị trấn có lên không? Nhắn là tôi gửi lời chào, mate.' },
  { id: c('m2'), who: 'dev', text: 'Sarah from the town office wants a new laptop. I will bring one up.', vi: 'Sarah ở văn phòng thị trấn cần máy tính mới. Tôi sẽ mang lên.' },
  { id: c('m3'), who: 'whitlock', text: 'Ah. Sarah from Old Bridge is coming up today. Lovely. Make sure Priya knows.', vi: 'À. Sarah ở Cầu Cũ hôm nay lên. Tốt quá. Nhớ báo Priya nhé.' },
  { id: c('p01'), who: 'hana', text: 'One of these is Mr Whitlock. Which one? No guessing.', vi: 'Một trong số này là ông Whitlock. Cái nào? Không đoán bừa.' },
  { id: c('p02'), who: 'hana', text: 'Mate. Twice. That is Colin, and he got the town right.', vi: 'Mate. Hai lần. Đó là Colin, và anh ta gọi đúng tên.' },
  { id: c('p03'), who: 'hana', text: 'That is Dev. He says the town office, like everybody does.', vi: 'Đó là Dev. Cậu ấy nói văn phòng thị trấn, như mọi người.' },
  // the Monday meeting on the pavement
  { id: c('h01'), who: 'priya', text: "Mr Whitlock's message, and Sarah is coming up. I'll put two desks together.", vi: 'Tin nhắn của ông Whitlock, và Sarah sẽ lên. Tôi sẽ kê hai cái bàn sát nhau.' },
  { id: c('h02'), who: 'priya', text: 'You gave me the wrong message. I nearly missed that Sarah was coming.', vi: 'Bạn đưa nhầm tin nhắn. Suýt nữa tôi không biết Sarah sẽ lên.' },
  { id: c('h03'), who: 'priya', text: 'Half ten? We started at half nine. We always start at half nine.', vi: 'Mười rưỡi á? Bọn tôi bắt đầu lúc chín rưỡi. Lúc nào cũng chín rưỡi.' },
  { id: c('h04'), who: 'whitlock', text: 'Old Bridge. Is that wrong? It is wrong, isn\'t it. Eight years.', vi: 'Cầu Cũ. Sai à? Sai rồi phải không. Tám năm rồi.' },
  { id: c('z1'), who: 'hana', text: 'Three callers, no names, and you knew them all. I can take a holiday.', vi: 'Ba người gọi, không ai xưng tên, mà bạn biết hết. Tôi đi nghỉ được rồi.' },
  { id: c('z2'), who: 'hana', text: 'Nearly. Mr Whitlock is the hardest. He is polite to everyone.', vi: 'Gần được. Ông Whitlock là khó nhất. Ông ấy lịch sự với tất cả mọi người.' },
  { id: c('z3'), who: 'hana', text: 'Voices are a long game. Come and sit with me on Mondays.', vi: 'Nhận giọng là chuyện lâu dài. Thứ Hai tới ngồi với tôi.' },
  { id: c('w1'), who: 'kit', text: "Hana at Meridian has her voice back. Ring her. She'll know it's you.", vi: 'Hana ở Meridian có giọng lại rồi. Gọi cho cô ấy đi. Cô ấy sẽ biết là bạn.' },
];

const NB_3: NoteEntry[] = [
  {
    key: 'whitlock',
    label: 'Ông Whitlock gọi thị trấn của Sarah là gì',
    line: c('c01'),
    answer: 'stop',
    options: [
      { value: 'stop', label: 'Tên một trạm xe buýt' },
      { value: 'right', label: 'Đúng tên thị trấn' },
      { value: 'office', label: 'Văn phòng thị trấn' },
    ],
  },
  {
    key: 'meet',
    label: 'Họp thứ Hai lúc mấy giờ',
    line: c('c02'),
    answer: '930',
    options: [
      { value: '930', label: '9:30' },
      { value: '1030', label: '10:30' },
      { value: '530', label: '5:30' },
    ],
  },
];

export const JOB_HANA_3: JobDoc = {
  id: 'job-hana3',
  title: 'Sarah ở Cầu Cũ',
  blurb: 'Hana có giọng lại và muốn kiểm tra bạn: ba tin nhắn không tên, một trong đó là ông Whitlock.',
  level: 2,
  order: 93,
  opens: ['ct-hana-1'],
  after: 'job-hana2',
  from: 'hana',
  lines: LINES_3,
  facts: [
    { id: 'whitlock', label: 'Cách ông Whitlock gọi tên thị trấn', line: c('c01'), consequence: 'whitlock' },
    { id: 'meet', label: 'Giờ họp', line: c('c02'), consequence: 'meet' },
    { id: 'who', label: 'Tin nhắn của ông Whitlock', line: c('m3'), consequence: 'who', byAction: true },
  ],
  consequences: {
    whitlock: { name: 'Ghi sai cách ông Whitlock nói', rejoin: 'Ông ấy tự hỏi mình có nói sai không.' },
    meet: { name: 'Ghi sai giờ họp: tới muộn', rejoin: 'Cuộc họp trên vỉa hè vẫn chưa xong.' },
    who: { name: 'Chọn nhầm tin nhắn: suýt lỡ tin Sarah lên', rejoin: 'Priya đọc lại cả ba.' },
  },
  steps: [
    { kind: 'goto', place: 'hana', label: 'Tới quầy lễ tân trụ sở Meridian' },
    { kind: 'scene', at: 'hana', who: ['hana'], lines: [c('01')] },
    {
      kind: 'notebook',
      via: 'scene',
      call: [c('c01'), c('c02')],
      entries: NB_3,
      repeat: { whitlock: [c('c01r')], meet: [c('c02r')] },
      patience: { after: 2, line: c('c03') },
    },
    { kind: 'pick', ask: [c('p01')], clips: ['m1', 'm2', 'm3'].map(c), right: 2, consequence: 'who', fact: 'who', why: { [c('m1')]: c('p02'), [c('m2')]: c('p03') } },
    { kind: 'goto', place: 'whitlock', label: 'Ra cuộc họp thứ Hai trên vỉa hè' },
    {
      kind: 'scene',
      at: 'whitlock',
      who: ['priya', 'whitlock'],
      lines: [
        { line: c('h03'), if: { note: 'meet', is: 'wrong' } },
        { line: c('h01'), if: { not: { hit: 'who' } } },
        { line: c('h02'), if: { hit: 'who' } },
        { line: c('h04'), if: { note: 'whitlock', is: 'wrong' } },
      ],
    },
  ],
  ending: { clean: [c('z1')], messy: [c('z2')], broken: [c('z3')] },
  news: { clean: [c('w1')], messy: [c('w1')], broken: [c('w1')] },
};

export const SIDE_HANA: readonly JobDoc[] = [JOB_HANA_1, JOB_HANA_2, JOB_HANA_3];
