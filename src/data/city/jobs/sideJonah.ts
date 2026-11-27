// Side chain "Bài hát ngoài chợ" (docs/gta-plan.md §5 "nghe lỏm giữa đám đông rồi làm theo", docs/gta-story.md §9):
// three small jobs with Jonah, who busks at the market and was in a band with Mia long ago (docs/city.md §6). Its kind of
// listening: ONE TALK OUT OF A CROWD, then ACT ON IT. Jonah cannot leave his pitch, so the learner walks over and
// overhears a talk among the market's noise (heard by distance: close enough to catch it, not so close that they stop),
// then tells Jonah what it was by intent: the answer is what the learner does, not a box ticked. Each job starts with
// a short note of Jonah's own (two entries, as every job has).
//
// Westbay people only: the browser's voice, no clips. Mia is talked about, never heard (a town resident would need
// clips). The learner's own lines are the 'player' voice (core/town/jobVoice.ts).

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

// ───────────────────────── 1. Cái nhẫn trong mũ ─────────────────────────

const a = (key: string) => `job-jonah1-${key}`;

const LINES_1 = [
  { id: a('01'), who: 'jonah', text: 'Look in my hat. Coins, a button, and a ring. A real one.', vi: 'Nhìn vào mũ tôi xem. Tiền xu, một cái cúc, và một chiếc nhẫn. Nhẫn thật.' },
  { id: a('c01'), who: 'jonah', text: 'It came in during my third song. The slow one, about the rain.', vi: 'Nó rơi vào lúc tôi hát bài thứ ba. Bài chậm, về cơn mưa.' },
  { id: a('c02'), who: 'jonah', text: 'A woman in a yellow scarf. She went towards the spice stall.', vi: 'Một người phụ nữ quàng khăn vàng. Cô ấy đi về phía sạp gia vị.' },
  { id: a('c01r'), who: 'jonah', text: 'The third song. The rain one.', vi: 'Bài thứ ba. Bài về mưa.' },
  { id: a('c02r'), who: 'jonah', text: 'Yellow scarf. Spice stall.', vi: 'Khăn vàng. Sạp gia vị.' },
  { id: a('c03'), who: 'jonah', text: "I can't stop playing, they'll take my pitch. Go on.", vi: 'Tôi không ngừng chơi được, người ta chiếm chỗ mất. Đi đi.' },
  // overheard at the spice stall
  { id: a('o01'), who: 'amira', text: "Hal, have you seen my mum's ring? I had it this morning.", vi: 'Hal, anh có thấy chiếc nhẫn của mẹ em không? Sáng nay em còn đeo.' },
  { id: a('o02'), who: 'hal', text: 'The big silver one? You never take that off.', vi: 'Cái nhẫn bạc to à? Có bao giờ em tháo nó ra đâu.' },
  { id: a('o03'), who: 'amira', text: 'No, the gold one. Small, with a green stone. It was loose.', vi: 'Không, cái vàng cơ. Nhỏ, có viên đá xanh lá. Nó bị lỏng.' },
  { id: a('o04'), who: 'hal', text: 'Were you near the singer? You always give him something.', vi: 'Lúc đó em có đứng gần anh hát rong không? Em lúc nào cũng cho anh ta ít tiền.' },
  { id: a('o05'), who: 'amira', text: 'I gave him coins in the rain song. Oh, no. Oh, it slipped.', vi: 'Em bỏ tiền lúc anh ấy hát bài mưa. Ôi, không. Chắc nó tuột mất rồi.' },
  { id: a('o06'), who: 'hal', text: "Then it's in his hat. Jonah's honest. Go and ask.", vi: 'Vậy là nó nằm trong mũ anh ta. Jonah thật thà lắm. Đi hỏi đi.' },
  { id: a('n01'), who: 'amira', text: 'Hal, someone is listening. Never mind. I will look myself.', vi: 'Hal, có người đang nghe đấy. Thôi. Em tự đi tìm.' },
  { id: a('h01'), who: 'hal', text: 'Not me, I wear an apron. Yellow scarf is Amira, at the spices.', vi: 'Không phải tôi, tôi đeo tạp dề. Khăn vàng là Amira, bên sạp gia vị.' },
  // back at the pitch
  { id: a('q01'), who: 'jonah', text: 'Well? Two people have already said it is theirs. Which ring is it?', vi: 'Sao rồi? Đã có hai người bảo là của họ. Nhẫn ra sao?' },
  { id: a('q02a'), who: 'player', text: 'Gold, small, with a green stone. It belongs to Amira, from the spice stall.', vi: 'Vàng, nhỏ, có viên đá xanh lá. Của Amira ở sạp gia vị.' },
  { id: a('q02b'), who: 'player', text: 'A big silver ring. Amira from the spice stall.', vi: 'Một chiếc nhẫn bạc to. Của Amira ở sạp gia vị.' },
  { id: a('q02c'), who: 'player', text: 'Gold with a red stone. The fish man, Hal.', vi: 'Vàng, viên đá đỏ. Của ông bán cá, Hal.' },
  { id: a('q03a'), who: 'jonah', text: 'Green stone. That is the one. And nobody else said green.', vi: 'Đá xanh lá. Đúng cái này. Và chẳng ai khác nói màu xanh lá.' },
  { id: a('q03b'), who: 'jonah', text: "This one's gold, though. I'll ask her myself, after this song.", vi: 'Nhưng cái này bằng vàng mà. Hát xong bài này tôi tự hỏi cô ấy.' },
  { id: a('k01'), who: 'amira', text: "My mum's ring. Thank you. I'll have it made smaller tomorrow.", vi: 'Nhẫn của mẹ em. Cảm ơn nhiều. Mai em đi thu nhỏ nó lại.' },
  { id: a('k02'), who: 'amira', text: 'Jonah found me in the end. My mum would have been so cross.', vi: 'Cuối cùng Jonah cũng tìm ra em. Mẹ em mà biết chắc giận lắm.' },
  { id: a('z1'), who: 'jonah', text: "Right ring, right person, and I didn't miss a chord. Thanks.", vi: 'Đúng nhẫn, đúng người, mà tôi chẳng lỡ một hợp âm nào. Cảm ơn nhé.' },
  { id: a('z2'), who: 'jonah', text: 'It got home. That is all a ring wants.', vi: 'Nó đã về với chủ. Nhẫn chỉ muốn thế thôi.' },
  { id: a('z3'), who: 'jonah', text: 'Markets are loud. Next time get closer, but not too close.', vi: 'Chợ ồn lắm. Lần sau lại gần hơn, nhưng đừng gần quá.' },
  { id: a('w1'), who: 'kit', text: 'Good news from the market. A lost ring is back where it belongs.', vi: 'Tin vui từ khu chợ. Một chiếc nhẫn thất lạc đã về đúng chỗ.' },
];

const NB_1: NoteEntry[] = [
  {
    key: 'song',
    label: 'Rơi vào lúc hát bài nào',
    line: a('c01'),
    answer: '3',
    options: [
      { value: '3', label: 'Bài thứ ba, bài về mưa' },
      { value: '1', label: 'Bài đầu tiên' },
      { value: 'train', label: 'Bài về chuyến tàu' },
    ],
  },
  {
    key: 'scarf',
    label: 'Người đó trông thế nào',
    line: a('c02'),
    answer: 'yellow',
    options: [
      { value: 'yellow', label: 'Khăn quàng vàng' },
      { value: 'yellow-hat', label: 'Mũ vàng' },
      { value: 'blue', label: 'Áo khoác xanh' },
    ],
  },
];

export const JOB_JONAH_1: JobDoc = {
  id: 'job-jonah1',
  title: 'Cái nhẫn trong mũ',
  blurb: 'Có người làm rơi một chiếc nhẫn thật vào mũ của Jonah. Anh không bỏ chỗ hát được, nên bạn đi hỏi giùm.',
  level: 1,
  order: 81,
  opens: ['ct-jonah-1'],
  after: 'job-half5',
  from: 'jonah',
  lines: LINES_1,
  facts: [
    { id: 'song', label: 'Bài nào', line: a('c01'), consequence: 'song' },
    { id: 'scarf', label: 'Người đó', line: a('c02'), consequence: 'scarf' },
    { id: 'ring', label: 'Chiếc nhẫn', line: a('o03'), consequence: 'ring', byAction: true },
  ],
  consequences: {
    song: { name: 'Ghi sai bài: Jonah không nhớ ra ai', rejoin: 'Amira tự nhắc tới bài mưa.' },
    scarf: { name: 'Ghi sai người: hỏi nhầm sạp', rejoin: 'Hal chỉ sang Amira.' },
    ring: { name: 'Tả sai chiếc nhẫn', rejoin: 'Jonah tự đi hỏi Amira sau bài hát.' },
    noticed: { name: 'Đứng gần quá: Amira thôi nói', rejoin: 'Jonah hỏi thẳng cô sau bài hát.' },
  },
  steps: [
    { kind: 'goto', place: 'jonah', label: 'Tới chỗ Jonah hát rong ở chợ' },
    { kind: 'scene', at: 'jonah', who: ['jonah'], lines: [a('01')] },
    {
      kind: 'notebook',
      via: 'scene',
      call: [a('c01'), a('c02')],
      entries: NB_1,
      repeat: { song: [a('c01r')], scarf: [a('c02r')] },
      patience: { after: 2, line: a('c03') },
    },
    { kind: 'goto', place: 'hal', label: 'Tới sạp cá của Hal', if: { note: 'scarf', is: 'wrong' } },
    { kind: 'scene', at: 'hal', who: ['hal'], lines: [a('h01')], if: { note: 'scarf', is: 'wrong' } },
    {
      kind: 'overhear',
      at: 'amira',
      who: ['amira', 'hal'],
      lines: ['o01', 'o02', 'o03', 'o04', 'o05', 'o06'].map(a),
      passes: 1,
      noticed: { line: a('n01'), consequence: 'noticed' },
      word: a('o03'),
    },
    { kind: 'goto', place: 'jonah', label: 'Quay lại chỗ Jonah' },
    {
      kind: 'intent',
      who: 'jonah',
      ask: [a('q01')],
      options: [
        { label: 'Nhẫn vàng nhỏ, đá xanh lá, của Amira', say: a('q02a'), reply: [a('q03a')] },
        { label: 'Nhẫn bạc to, của Amira', say: a('q02b'), reply: [a('q03b')] },
        { label: 'Nhẫn vàng đá đỏ, của Hal', say: a('q02c'), reply: [a('q03b')] },
      ],
      check: { right: 0, consequence: 'ring', fact: 'ring' },
    },
    {
      kind: 'scene',
      at: 'jonah',
      who: ['jonah', 'amira'],
      lines: [
        { line: a('k01'), if: { not: { any: [{ hit: 'ring' }, { hit: 'noticed' }, { note: 'song', is: 'wrong' }] } } },
        { line: a('k02'), if: { any: [{ hit: 'ring' }, { hit: 'noticed' }, { note: 'song', is: 'wrong' }] } },
      ],
    },
  ],
  ending: { clean: [a('z1')], messy: [a('z2')], broken: [a('z3')] },
  news: { clean: [a('w1')], messy: [a('w1')], broken: [a('w1')] },
};

// ───────────────────────── 2. Tối thứ Năm ─────────────────────────

const b = (key: string) => `job-jonah2-${key}`;

const LINES_2 = [
  { id: b('01'), who: 'jonah', text: "Mia's lot sing at Bo's on Thursdays. I'd like to go. I'm too shy to ask.", vi: 'Tối thứ Năm nhóm của Mia hát ở quán Bo. Tôi muốn đi. Mà ngại hỏi quá.' },
  { id: b('c01'), who: 'jonah', text: "Bo's is on Arts Street, the door with the purple light.", vi: 'Quán Bo ở phố Arts, cái cửa có đèn tím.' },
  { id: b('c02'), who: 'jonah', text: 'Bo and Dana do the booking about now. Just listen. Do not ask.', vi: 'Tầm giờ này Bo với Dana đang lo đặt phòng. Cứ nghe thôi. Đừng hỏi.' },
  { id: b('c01r'), who: 'jonah', text: 'The purple light. Arts Street.', vi: 'Đèn tím. Phố Arts.' },
  { id: b('c02r'), who: 'jonah', text: 'Listen. Do not ask. I would die.', vi: 'Nghe thôi. Đừng hỏi. Tôi chết mất.' },
  { id: b('c03'), who: 'jonah', text: "Please go before I change my mind.", vi: 'Đi giùm trước khi tôi đổi ý.' },
  // overheard at Bo's
  { id: b('o01'), who: 'dana', text: 'Bo, Thursday. Same as always, nine of us. Mia, me and the office.', vi: 'Bo, thứ Năm nhé. Như mọi khi, chín người. Mia, tôi và cả văn phòng.' },
  { id: b('o02'), who: 'bo', text: 'The small room is booked. You can have the big room at seven.', vi: 'Phòng nhỏ có người đặt rồi. Chị lấy phòng lớn lúc bảy giờ nhé.' },
  { id: b('o03'), who: 'dana', text: 'Seven is fine. Mia says one thing, though.', vi: 'Bảy giờ được. Nhưng Mia có dặn một chuyện.' },
  { id: b('o04'), who: 'dana', text: 'She will only sing if somebody does the duet with her. The old one, Paper Boats.', vi: 'Cô ấy chỉ hát nếu có người song ca với cô ấy. Bài cũ, Paper Boats.' },
  { id: b('o05'), who: 'bo', text: "Nobody knows Paper Boats. That's a song from her old band.", vi: 'Có ai biết bài Paper Boats đâu. Đó là bài của ban nhạc cũ của cô ấy.' },
  { id: b('o06'), who: 'dana', text: 'Then she will sit and clap all night. Again.', vi: 'Vậy thì cô ấy lại ngồi vỗ tay cả tối. Như mọi lần.' },
  { id: b('n01'), who: 'bo', text: 'Can I help you? We open at six. Come back then.', vi: 'Tôi giúp gì được không? Sáu giờ quán mới mở. Lúc đó quay lại nhé.' },
  // back at the pitch
  { id: b('q01'), who: 'jonah', text: 'Well? Is there room for one more? When do they start?', vi: 'Sao rồi? Còn chỗ cho thêm một người không? Mấy giờ họ bắt đầu?' },
  { id: b('q02a'), who: 'player', text: 'The big room at seven. And Mia wants someone to sing Paper Boats with her.', vi: 'Phòng lớn lúc bảy giờ. Và Mia muốn có người hát bài Paper Boats cùng cô ấy.' },
  { id: b('q02b'), who: 'player', text: 'The small room at seven. Mia wants to sing alone.', vi: 'Phòng nhỏ lúc bảy giờ. Mia muốn hát một mình.' },
  { id: b('q02c'), who: 'player', text: 'The big room at eleven. Bring your guitar.', vi: 'Phòng lớn lúc mười một giờ. Mang theo đàn.' },
  { id: b('q03a'), who: 'jonah', text: 'Paper Boats. I wrote the second verse of that. I know every word.', vi: 'Paper Boats. Đoạn hai bài đó là tôi viết. Tôi thuộc từng chữ.' },
  { id: b('q03b'), who: 'jonah', text: "Hm. I'll go along and see. I'll take my guitar, just in case.", vi: 'Hừm. Tôi cứ tới xem sao. Mang theo đàn, phòng khi cần.' },
  { id: b('k01'), who: 'bo', text: 'He walked in at seven and Mia stood up before he got his coat off.', vi: 'Anh ấy bước vào lúc bảy giờ và Mia đứng bật dậy trước khi anh kịp cởi áo khoác.' },
  { id: b('k02'), who: 'bo', text: "He came at eleven. We'd closed the big room. Mia had gone.", vi: 'Anh ấy tới lúc mười một giờ. Phòng lớn đóng rồi. Mia về mất rồi.' },
  { id: b('k03'), who: 'bo', text: 'He got the room right but not the song. Mia asked him anyway, in the end.', vi: 'Anh ấy tới đúng phòng nhưng không biết chuyện bài hát. Cuối cùng Mia vẫn rủ anh ấy.' },
  { id: b('z1'), who: 'jonah', text: 'Paper Boats, with Mia, after nine years. Thank you. Really.', vi: 'Paper Boats, cùng Mia, sau chín năm. Cảm ơn. Thật lòng.' },
  { id: b('z2'), who: 'jonah', text: 'We sang it in the end. A bit late. Still counts.', vi: 'Cuối cùng cũng hát. Hơi muộn. Vẫn tính.' },
  { id: b('z3'), who: 'jonah', text: "Next Thursday, then. I'll ask her myself. Maybe.", vi: 'Vậy thì thứ Năm tới. Tôi sẽ tự hỏi cô ấy. Có thể.' },
  { id: b('w1'), who: 'kit', text: 'Word from Arts Street. Someone sang Paper Boats at Bo\'s last night. Lovely.', vi: 'Tin từ phố Arts. Tối qua ở quán Bo có người hát bài Paper Boats. Hay lắm.' },
];

const NB_2: NoteEntry[] = [
  {
    key: 'door',
    label: 'Quán Bo ở đâu',
    line: b('c01'),
    answer: 'purple',
    options: [
      { value: 'purple', label: 'Phố Arts, cửa đèn tím' },
      { value: 'red', label: 'Phố Arts, cửa đèn đỏ' },
      { value: 'market', label: 'Trong chợ, cửa đèn tím' },
    ],
  },
  {
    key: 'ask',
    label: 'Jonah dặn gì',
    line: b('c02'),
    answer: 'listen',
    options: [
      { value: 'listen', label: 'Chỉ nghe, đừng hỏi' },
      { value: 'ask', label: 'Hỏi Bo giùm' },
      { value: 'book', label: 'Đặt chỗ giùm' },
    ],
  },
];

export const JOB_JONAH_2: JobDoc = {
  id: 'job-jonah2',
  title: 'Tối thứ Năm',
  blurb: 'Jonah muốn tới hát cùng nhóm của Mia ở quán Bo, mà ngại hỏi. Bạn ghé nghe lỏm giùm.',
  level: 1,
  order: 82,
  opens: ['ct-jonah-1'],
  after: 'job-jonah1',
  from: 'jonah',
  lines: LINES_2,
  facts: [
    { id: 'door', label: 'Quán ở đâu', line: b('c01'), consequence: 'door' },
    { id: 'ask', label: 'Lời dặn', line: b('c02'), consequence: 'ask' },
    { id: 'plan', label: 'Phòng, giờ, bài hát', line: b('o04'), consequence: 'plan', byAction: true },
  ],
  consequences: {
    door: { name: 'Ghi sai cửa: tìm một lúc mới ra quán', rejoin: 'Đèn tím dễ thấy từ đầu phố.' },
    ask: { name: 'Ghi sai lời dặn: tới quá gần, Bo hỏi bạn cần gì', rejoin: 'Bạn vẫn nghe được phần còn lại.' },
    plan: { name: 'Báo sai cho Jonah', rejoin: 'Mia vẫn rủ anh song ca, chỉ muộn hơn.' },
    noticed: { name: 'Đứng gần quá: Bo hỏi bạn cần gì', rejoin: 'Họ nói tiếp ở trong.' },
  },
  steps: [
    { kind: 'goto', place: 'jonah', label: 'Tới chỗ Jonah hát rong ở chợ' },
    { kind: 'scene', at: 'jonah', who: ['jonah'], lines: [b('01')] },
    {
      kind: 'notebook',
      via: 'scene',
      call: [b('c01'), b('c02')],
      entries: NB_2,
      repeat: { door: [b('c01r')], ask: [b('c02r')] },
      patience: { after: 2, line: b('c03') },
    },
    { kind: 'goto', place: 'bo', label: 'Tới quán karaoke của Bo' },
    { kind: 'scene', at: 'bo', who: ['bo'], lines: [b('n01')], if: { any: [{ note: 'ask', is: 'wrong' }, { note: 'door', is: 'wrong' }] } },
    {
      kind: 'overhear',
      at: 'bo',
      who: ['bo', 'dana'],
      lines: ['o01', 'o02', 'o03', 'o04', 'o05', 'o06'].map(b),
      passes: 1,
      noticed: { line: b('n01'), consequence: 'noticed' },
      word: b('o04'),
    },
    { kind: 'goto', place: 'jonah', label: 'Quay lại chỗ Jonah' },
    {
      kind: 'intent',
      who: 'jonah',
      ask: [b('q01')],
      options: [
        { label: 'Phòng lớn, bảy giờ, Mia muốn song ca Paper Boats', say: b('q02a'), reply: [b('q03a')] },
        { label: 'Phòng nhỏ, bảy giờ, Mia hát một mình', say: b('q02b'), reply: [b('q03b')], flag: 'solo' },
        { label: 'Phòng lớn, mười một giờ', say: b('q02c'), reply: [b('q03b')], flag: 'eleven' },
      ],
      check: { right: 0, consequence: 'plan', fact: 'plan' },
    },
    {
      kind: 'scene',
      at: 'bo',
      who: ['bo'],
      lines: [
        { line: b('k01'), if: { not: { hit: 'plan' } } },
        { line: b('k02'), if: { flag: 'eleven' } },
        { line: b('k03'), if: { flag: 'solo' } },
      ],
    },
  ],
  ending: { clean: [b('z1')], messy: [b('z2')], broken: [b('z3')] },
  news: { clean: [b('w1')], messy: [b('w1')], broken: [b('w1')] },
};

// ───────────────────────── 3. Cửa sau lúc tám giờ ─────────────────────────

const c = (key: string) => `job-jonah3-${key}`;

const LINES_3 = [
  { id: c('01'), who: 'jonah', text: "Bo rang. He wants to see me about something. He wouldn't say what.", vi: 'Bo gọi. Anh ấy muốn gặp tôi vì chuyện gì đó. Không chịu nói là chuyện gì.' },
  { id: c('c01'), who: 'jonah', text: 'He said Friday, at the karaoke. Friday is my birthday, funnily enough.', vi: 'Anh ấy bảo thứ Sáu, ở quán karaoke. Mà thứ Sáu lại đúng sinh nhật tôi, lạ ghê.' },
  { id: c('c02'), who: 'jonah', text: "Can you find out the time? I'll be playing till late at the night market.", vi: 'Bạn hỏi giùm mấy giờ được không? Tôi chơi ở chợ đêm tới khuya.' },
  { id: c('c01r'), who: 'jonah', text: 'Friday. My birthday. Coincidence, surely.', vi: 'Thứ Sáu. Sinh nhật tôi. Chắc là trùng hợp thôi.' },
  { id: c('c02r'), who: 'jonah', text: 'The time. Just the time.', vi: 'Giờ thôi. Chỉ cần giờ.' },
  { id: c('c03'), who: 'jonah', text: "I've got a crowd. Go, go.", vi: 'Khách đang đông. Đi đi.' },
  // overheard at Bo's
  { id: c('o01'), who: 'bo', text: "Right. Jonah's party. He mustn't know. Tell him we're shut on Friday.", vi: 'Rồi. Tiệc của Jonah. Không được để anh ấy biết. Bảo anh ấy thứ Sáu quán đóng cửa.' },
  { id: c('o02'), who: 'dana', text: 'Then how does he get in?', vi: 'Thế thì anh ấy vào kiểu gì?' },
  { id: c('o03'), who: 'bo', text: 'Bring him to the back door at eight. Not the front. Eight sharp.', vi: 'Dẫn anh ấy tới cửa sau lúc tám giờ. Không phải cửa trước. Tám giờ đúng.' },
  { id: c('o04'), who: 'dana', text: "Mia's bringing a cake shaped like a guitar. Badly, she says.", vi: 'Mia mang bánh hình cây đàn. Cô ấy bảo làm xấu lắm.' },
  { id: c('o05'), who: 'bo', text: "Then everyone shouts, he cries, and I don't charge for the room.", vi: 'Rồi mọi người hô lên, anh ấy khóc, và tôi không tính tiền phòng.' },
  { id: c('n01'), who: 'dana', text: 'Shh. That is one of Jonah\'s friends. Talk later.', vi: 'Suỵt. Đó là bạn của Jonah. Nói sau.' },
  { id: c('f01'), who: 'frank', text: 'Jonah? He packed up an hour ago. Night market, by the dumplings.', vi: 'Jonah á? Cậu ấy dọn đồ một tiếng trước rồi. Ra chợ đêm, cạnh sạp há cảo.' },
  // back at the night market
  { id: c('q01'), who: 'jonah', text: 'Well? When does Bo want me?', vi: 'Sao rồi? Mấy giờ Bo muốn gặp tôi?' },
  { id: c('q02a'), who: 'player', text: "Friday, eight o'clock. The back door, not the front. Don't ask why.", vi: 'Thứ Sáu, tám giờ. Cửa sau, không phải cửa trước. Đừng hỏi tại sao.' },
  { id: c('q02b'), who: 'player', text: "Friday, eight o'clock, the front door.", vi: 'Thứ Sáu, tám giờ, cửa trước.' },
  { id: c('q02c'), who: 'player', text: "Friday at nine. The back door.", vi: 'Thứ Sáu lúc chín giờ. Cửa sau.' },
  { id: c('q03a'), who: 'jonah', text: "The back door. Why would anyone use the back door? Fine. I won't ask.", vi: 'Cửa sau. Ai lại đi cửa sau chứ? Thôi được. Tôi không hỏi.' },
  { id: c('q03b'), who: 'jonah', text: 'Right. I will be there. With my guitar, as always.', vi: 'Được. Tôi sẽ tới. Mang đàn theo, như mọi khi.' },
  { id: c('k01'), who: 'dana', text: 'He came round the back at eight on the dot. You should have seen his face.', vi: 'Tám giờ đúng anh ấy vòng ra cửa sau. Phải chi bạn thấy mặt anh ấy lúc đó.' },
  { id: c('k02'), who: 'dana', text: 'He knocked on the front, and the front was dark. Bo ran round and got him.', vi: 'Anh ấy gõ cửa trước, mà cửa trước tối om. Bo phải chạy vòng ra kéo vào.' },
  { id: c('k03'), who: 'dana', text: 'He came at nine. The candles had burned down. We lit them again.', vi: 'Anh ấy tới lúc chín giờ. Nến cháy hết rồi. Bọn tôi thắp lại.' },
  { id: c('z1'), who: 'jonah', text: 'You knew, and you kept it. A guitar cake. I cried. Tell nobody.', vi: 'Bạn biết mà vẫn giữ kín. Bánh hình cây đàn. Tôi khóc đấy. Đừng kể với ai.' },
  { id: c('z2'), who: 'jonah', text: 'A surprise, nearly. The best birthday I have had in Westbay.', vi: 'Gần như bất ngờ. Sinh nhật vui nhất của tôi ở Westbay.' },
  { id: c('z3'), who: 'jonah', text: 'I may have guessed. It was still lovely. Thank you.', vi: 'Chắc tôi đoán ra rồi. Nhưng vẫn vui lắm. Cảm ơn.' },
  { id: c('w1'), who: 'kit', text: 'Happy birthday to Jonah, who busks at the market. Give him a coin today.', vi: 'Chúc mừng sinh nhật Jonah, anh hát rong ở chợ. Hôm nay cho anh ấy một đồng nhé.' },
];

const NB_3: NoteEntry[] = [
  {
    key: 'day',
    label: 'Bo hẹn ngày nào',
    line: c('c01'),
    answer: 'friday',
    options: [
      { value: 'friday', label: 'Thứ Sáu, sinh nhật Jonah' },
      { value: 'thursday', label: 'Thứ Năm, tối karaoke' },
      { value: 'saturday', label: 'Thứ Bảy, chợ đêm' },
    ],
  },
  {
    key: 'where',
    label: 'Jonah sẽ ở đâu',
    line: c('c02'),
    answer: 'night',
    options: [
      { value: 'night', label: 'Chợ đêm, tới khuya' },
      { value: 'pitch', label: 'Chỗ hát ở chợ' },
      { value: 'home', label: 'Ở nhà' },
    ],
  },
];

export const JOB_JONAH_3: JobDoc = {
  id: 'job-jonah3',
  title: 'Cửa sau lúc tám giờ',
  blurb: 'Bo muốn gặp Jonah tối thứ Sáu mà không nói vì sao. Thứ Sáu lại đúng sinh nhật Jonah.',
  level: 2,
  order: 83,
  opens: ['ct-jonah-1'],
  after: 'job-jonah2',
  from: 'jonah',
  lines: LINES_3,
  facts: [
    { id: 'day', label: 'Ngày hẹn', line: c('c01'), consequence: 'day' },
    { id: 'where', label: 'Jonah ở đâu', line: c('c02'), consequence: 'where' },
    { id: 'door', label: 'Cửa nào, mấy giờ', line: c('o03'), consequence: 'door', byAction: true },
  ],
  consequences: {
    day: { name: 'Ghi sai ngày: hỏi nhầm chuyện', rejoin: 'Bo nhắc ngay tới tiệc thứ Sáu.' },
    where: { name: 'Ghi sai chỗ Jonah: tìm anh một lúc', rejoin: 'Tiếng đàn dẫn bạn tới chợ đêm.' },
    door: { name: 'Báo sai cửa hoặc giờ', rejoin: 'Bo chạy ra đón, nến thắp lại.' },
    noticed: { name: 'Đứng gần quá: Dana suỵt cả nhóm', rejoin: 'Bạn đã nghe đủ.' },
  },
  steps: [
    { kind: 'goto', place: 'jonah', label: 'Tới chỗ Jonah hát rong ở chợ' },
    { kind: 'scene', at: 'jonah', who: ['jonah'], lines: [c('01')] },
    {
      kind: 'notebook',
      via: 'scene',
      call: [c('c01'), c('c02')],
      entries: NB_3,
      repeat: { day: [c('c01r')], where: [c('c02r')] },
      patience: { after: 2, line: c('c03') },
    },
    { kind: 'goto', place: 'bo', label: 'Tới quán karaoke của Bo' },
    {
      kind: 'overhear',
      at: 'bo',
      who: ['bo', 'dana'],
      lines: ['o01', 'o02', 'o03', 'o04', 'o05'].map(c),
      passes: 1,
      noticed: { line: c('n01'), consequence: 'noticed' },
      word: c('o03'),
      from: { if: { note: 'day', is: 'wrong' }, index: 1 },
    },
    { kind: 'goto', place: 'jonah', label: 'Tìm Jonah ở chỗ hát quen', if: { note: 'where', is: 'wrong' } },
    { kind: 'scene', at: 'jonah', who: ['frank'], lines: [c('f01')], if: { note: 'where', is: 'wrong' } },
    { kind: 'goto', place: 'mei', label: 'Tìm Jonah ở chợ đêm, cạnh sạp há cảo' },
    {
      kind: 'intent',
      who: 'jonah',
      ask: [c('q01')],
      options: [
        { label: 'Thứ Sáu, tám giờ, cửa sau, đừng hỏi', say: c('q02a'), reply: [c('q03a')] },
        { label: 'Thứ Sáu, tám giờ, cửa trước', say: c('q02b'), reply: [c('q03b')], flag: 'front' },
        { label: 'Thứ Sáu, chín giờ, cửa sau', say: c('q02c'), reply: [c('q03b')], flag: 'nine' },
      ],
      check: { right: 0, consequence: 'door', fact: 'door' },
    },
    {
      kind: 'scene',
      at: 'bo',
      who: ['dana', 'bo'],
      lines: [
        { line: c('k01'), if: { not: { hit: 'door' } } },
        { line: c('k02'), if: { flag: 'front' } },
        { line: c('k03'), if: { flag: 'nine' } },
      ],
    },
  ],
  ending: { clean: [c('z1')], messy: [c('z2')], broken: [c('z3')] },
  news: { clean: [c('w1')], messy: [c('w1')], broken: [c('w1')] },
};

export const SIDE_JONAH: readonly JobDoc[] = [JOB_JONAH_1, JOB_JONAH_2, JOB_JONAH_3];
