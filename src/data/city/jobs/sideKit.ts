// Side chain "Người gọi lúc nửa đêm" (docs/gta-plan.md §5, docs/gta-story.md §9): three small jobs with Kit, Bay FM's
// sound engineer, who minds the overnight music (Bay FM plays all night: docs/city.md §7, Gus listens to it). Its kind
// of listening: a caller who talks quietly and a line that crackles (the call-in show's caller voices,
// core/town/sceneTypes.ts 'caller-mumbling-m', 'caller-badline-f', 'caller-clear-f'): an old man who rings at midnight
// for a song for Rosie, who lived at number twelve, East Road, sixty years ago; his daughter on a bad line from the
// hospital; and Rosie herself.
//
// Westbay people and callers only: the browser's voice, no clips. Nobody new with a body: the callers are only heard.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

// ───────────────────────── 1. Bài cho Rosie ─────────────────────────

const a = (key: string) => `job-kit1-${key}`;
const M = 'caller-mumbling-m';

const LINES_1 = [
  { id: a('01'), who: 'kit', text: "Midnight. The music plays itself. I just stop it going wrong.", vi: 'Nửa đêm. Nhạc tự phát. Tôi chỉ canh cho nó khỏi trục trặc.' },
  { id: a('02'), who: 'kit', text: 'And every night at twelve, the same old man rings the request line.', vi: 'Và đêm nào đúng mười hai giờ, cũng một ông cụ gọi vào đường dây xin bài.' },
  { id: a('03'), who: 'kit', text: "He talks very quietly. You take it tonight. My ears are tired.", vi: 'Ông ấy nói nhỏ lắm. Tối nay bạn nghe máy đi. Tai tôi mỏi rồi.' },
  { id: a('c01'), who: M, text: "Hello? Is that the radio? Sorry, I don't like phones much.", vi: 'Alô? Đài phải không? Xin lỗi, tôi không quen điện thoại lắm.' },
  { id: a('c02'), who: M, text: 'Could you play the one about the harbour lights? The slow one.', vi: 'Cậu phát giùm bài về ánh đèn bến cảng được không? Bài chậm ấy.' },
  { id: a('c03'), who: M, text: "It's for Rosie. She used to live on East Road.", vi: 'Tặng Rosie. Ngày xưa cô ấy sống ở East Road.' },
  { id: a('c04'), who: M, text: 'Number twelve. She might still be there. I never asked.', vi: 'Số mười hai. Có khi cô ấy vẫn ở đó. Tôi chưa bao giờ hỏi.' },
  { id: a('c05'), who: M, text: "Don't say my name. Just say, from the man with the bicycle.", vi: 'Đừng đọc tên tôi. Cứ nói là từ người đàn ông đi xe đạp.' },
  { id: a('c02r'), who: M, text: 'The harbour lights. Lights. The slow one.', vi: 'Ánh đèn bến cảng. Đèn. Bài chậm.' },
  { id: a('c03r'), who: M, text: 'Rosie. Like the flower. Rosie.', vi: 'Rosie. Như hoa hồng ấy. Rosie.' },
  { id: a('c04r'), who: M, text: 'Twelve. One, two. Twelve.', vi: 'Mười hai. Một, hai. Mười hai.' },
  { id: a('c06'), who: M, text: "Sorry. I'm a nuisance. It doesn't matter, really.", vi: 'Xin lỗi. Tôi làm phiền quá. Thật ra cũng chẳng sao.' },
  // Kit on the overnight link, by what was written
  { id: a('d01'), who: 'kit', text: 'This one is for Rosie, from the man with the bicycle.', vi: 'Bài này tặng Rosie, từ người đàn ông đi xe đạp.' },
  { id: a('d02'), who: 'kit', text: 'This one is for Josie, from the man with the bicycle.', vi: 'Bài này tặng Josie, từ người đàn ông đi xe đạp.' },
  { id: a('d03'), who: 'kit', text: 'This one is for Rosa, from the man with the bicycle.', vi: 'Bài này tặng Rosa, từ người đàn ông đi xe đạp.' },
  // he rings back
  { id: a('e01'), who: M, text: "Rosie. Not Josie. Never mind, she won't have been listening.", vi: 'Rosie. Không phải Josie. Thôi, chắc cô ấy cũng không nghe đâu.' },
  { id: a('e02'), who: M, text: "Rosie. Not Rosa. Rosa was her sister. She'd laugh at that.", vi: 'Rosie chứ. Không phải Rosa. Rosa là chị cô ấy. Cô ấy sẽ cười cho xem.' },
  { id: a('e03'), who: M, text: "That's not the one. The lights, I said. Still, it was kind of you.", vi: 'Không phải bài đó. Tôi bảo bài ánh đèn mà. Dù sao cậu cũng tốt bụng.' },
  { id: a('e04'), who: 'kit', text: 'Number twenty? East Road stops at eighteen. Twelve, he said.', vi: 'Số hai mươi á? East Road chỉ tới số mười tám. Ông ấy nói mười hai.' },
  { id: a('e05'), who: 'kit', text: "Number two is the bakery's back door. Twelve, I'd bet.", vi: 'Số hai là cửa sau tiệm bánh. Tôi cá là mười hai.' },
  // the last word, by grade
  { id: a('z1'), who: 'kit', text: "He didn't ring back. That means it was right. Night, partner.", vi: 'Ông ấy không gọi lại. Nghĩa là đúng rồi. Chúc ngủ ngon, cộng sự.' },
  { id: a('z2'), who: 'kit', text: "Quiet callers are the hardest. You'll get his voice in the end.", vi: 'Người gọi nói nhỏ là khó nhất. Rồi bạn sẽ quen giọng ông ấy.' },
  { id: a('z3'), who: 'kit', text: "He'll ring again tomorrow. He always does. We'll try again.", vi: 'Mai ông ấy sẽ gọi lại. Lúc nào cũng vậy. Mình thử lại.' },
  { id: a('n1'), who: 'kit', text: 'A song for somebody on East Road tonight. You know who you are.', vi: 'Tối nay có một bài tặng ai đó ở East Road. Bạn biết là ai rồi đấy.' },
];

const NB_1: NoteEntry[] = [
  {
    key: 'song',
    label: 'Ông cụ xin bài gì',
    line: a('c02'),
    answer: 'lights',
    options: [
      { value: 'lights', label: 'Bài về ánh đèn bến cảng' },
      { value: 'nights', label: 'Bài về những đêm ở bến cảng' },
      { value: 'fast', label: 'Bài vui, nhanh' },
    ],
  },
  {
    key: 'name',
    label: 'Tặng ai',
    line: a('c03'),
    answer: 'rosie',
    options: [
      { value: 'rosie', label: 'Rosie' },
      { value: 'josie', label: 'Josie' },
      { value: 'rosa', label: 'Rosa' },
    ],
  },
  {
    key: 'number',
    label: 'Nhà số mấy trên East Road',
    line: a('c04'),
    answer: '12',
    options: [
      { value: '12', label: 'Số 12' },
      { value: '20', label: 'Số 20' },
      { value: '2', label: 'Số 2' },
    ],
  },
];

const N1 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_KIT_1: JobDoc = {
  id: 'job-kit1',
  title: 'Bài cho Rosie',
  blurb: 'Nửa đêm nào cũng có một ông cụ gọi vào đài xin bài. Ông nói rất nhỏ, và không chịu xưng tên.',
  level: 1,
  order: 41,
  opens: ['ct-kit-1'],
  after: 'job-half5',
  from: 'kit',
  lines: LINES_1,
  facts: [
    { id: 'song', label: 'Bài gì', line: a('c02'), consequence: 'song' },
    { id: 'name', label: 'Tặng ai', line: a('c03'), consequence: 'name' },
    { id: 'number', label: 'Nhà số mấy', line: a('c04'), consequence: 'number' },
  ],
  consequences: {
    song: { name: 'Ghi sai bài: đài phát nhầm bài', rejoin: 'Ông cụ vẫn cảm ơn; mai ông gọi lại.' },
    name: { name: 'Ghi sai tên người được tặng', rejoin: 'Ông cụ gọi lại sửa tên.' },
    number: { name: 'Ghi sai số nhà', rejoin: 'Kit đoán ra số mười hai.' },
  },
  steps: [
    { kind: 'goto', place: 'kit', label: 'Tới phòng thu Bay FM lúc nửa đêm' },
    { kind: 'scene', at: 'kit', who: ['kit'], lines: ['01', '02', '03'].map(a) },
    {
      kind: 'notebook',
      via: 'phone',
      call: ['c01', 'c02', 'c03', 'c04', 'c05'].map(a),
      entries: NB_1,
      repeat: { song: [a('c02r')], name: [a('c03r')], number: [a('c04r')] },
      patience: { after: 2, line: a('c06') },
    },
    {
      kind: 'radio',
      lines: [{ line: a('d01'), if: N1('name', 'rosie') }, { line: a('d02'), if: N1('name', 'josie') }, { line: a('d03'), if: N1('name', 'rosa') }],
    },
    {
      kind: 'phone',
      lines: [
        { line: a('e01'), if: N1('name', 'josie') },
        { line: a('e02'), if: N1('name', 'rosa') },
        { line: a('e03'), if: { note: 'song', is: 'wrong' } },
      ],
    },
    { kind: 'scene', at: 'kit', who: ['kit'], lines: [{ line: a('e04'), if: N1('number', '20') }, { line: a('e05'), if: N1('number', '2') }] },
  ],
  ending: { clean: [a('z1')], messy: [a('z2')], broken: [a('z3')] },
  news: { clean: [a('n1')], messy: [a('n1')], broken: [a('n1')] },
};

// ───────────────────────── 2. Đường dây rè ─────────────────────────

const b = (key: string) => `job-kit2-${key}`;
const D = 'caller-badline-f';

const LINES_2 = [
  { id: b('01'), who: 'kit', text: "Twelve o'clock, and no old man. The phone's ringing, but it's a woman.", vi: 'Mười hai giờ rồi mà không thấy ông cụ. Điện thoại reo, nhưng là một phụ nữ.' },
  { id: b('c01'), who: D, text: "Hi, sorry, bad line. My dad's the man with the bicycle. He's in hospital.", vi: 'Chào, xin lỗi, đường dây xấu. Bố tôi là ông đi xe đạp. Ông đang nằm viện.' },
  { id: b('c02'), who: D, text: "Westbay Hospital, ward eight. He can't sleep without the radio.", vi: 'Bệnh viện Westbay, khoa số tám. Không có đài là ông không ngủ được.' },
  { id: b('c03'), who: D, text: 'His radio was left on the bus. Lost property has it, I think.', vi: 'Cái đài của ông bị bỏ quên trên xe buýt. Chắc phòng đồ thất lạc đang giữ.' },
  { id: b('c04'), who: D, text: 'And could you play his song at quarter past one? He wakes up then.', vi: 'Và anh phát bài của ông lúc một giờ mười lăm được không? Lúc đó ông hay thức.' },
  { id: b('c02r'), who: D, text: 'Ward eight. Eight. The one by the lifts.', vi: 'Khoa tám. Tám. Cái gần thang máy.' },
  { id: b('c03r'), who: D, text: 'Lost property. At the station.', vi: 'Phòng đồ thất lạc. Ở nhà ga.' },
  { id: b('c04r'), who: D, text: 'Quarter past one. One fifteen.', vi: 'Một giờ mười lăm. Một giờ mười lăm phút.' },
  { id: b('c05'), who: D, text: "Sorry, you're breaking up. I'll have to go in a minute.", vi: 'Xin lỗi, tiếng anh bị rè. Một phút nữa tôi phải cúp máy.' },
  // the radio, where it was written to be
  { id: b('w01'), who: 'okafor', text: 'A radio? Not at my window, dear. Try Pete, next door.', vi: 'Cái đài á? Không có ở ô cửa của bà đâu cháu. Thử chỗ Pete, ngay bên cạnh.' },
  { id: b('w02'), who: 'rico', text: "Off the bus? Sam's bus left an hour ago. Lost property, I'd say.", vi: 'Trên xe buýt á? Xe của Sam chạy cả tiếng rồi. Chắc ở phòng đồ thất lạc.' },
  { id: b('p01'), who: 'pete', text: 'One radio, small, very old, a bicycle sticker. Logged on Tuesday. Here.', vi: 'Một cái đài, nhỏ, cũ lắm, có dán hình xe đạp. Ghi sổ hôm thứ Ba. Đây.' },
  // the ward
  { id: b('h01'), who: 'bridget', text: 'Ward eight, the man with the bicycle sticker? Leave it with me, love.', vi: 'Khoa tám, ông có miếng dán xe đạp à? Để đấy cho tôi, cưng.' },
  { id: b('h02'), who: 'bridget', text: "Ward eighteen? We haven't got one. Eight, I expect. I'll take it up.", vi: 'Khoa mười tám á? Ở đây làm gì có. Chắc là tám. Tôi mang lên cho.' },
  { id: b('h03'), who: 'bridget', text: "Ward eighty? We've barely got twenty. He's in eight. Give it here.", vi: 'Khoa tám mươi á? Ở đây có chưa tới hai mươi khoa. Ông ấy ở khoa tám. Đưa đây.' },
  // the time
  { id: b('k01'), who: 'kit', text: 'Quarter past one. His song is on. Somewhere on ward eight, a radio is on too.', vi: 'Một giờ mười lăm. Bài của ông đang phát. Đâu đó ở khoa tám, có một cái đài cũng đang bật.' },
  { id: b('k02'), who: 'kit', text: "We played it at the wrong time. She said quarter past one. He'll have missed it.", vi: 'Mình phát sai giờ. Cô ấy nói một giờ mười lăm. Chắc ông lỡ mất rồi.' },
  { id: b('z1'), who: 'kit', text: "A radio back, and a song on time. That's a good night's work.", vi: 'Trả được cái đài, phát bài đúng giờ. Một đêm làm việc ra trò.' },
  { id: b('z2'), who: 'kit', text: 'Bad lines are worse than quiet ones. You did all right.', vi: 'Đường dây rè còn tệ hơn người nói nhỏ. Bạn làm ổn đấy.' },
  { id: b('z3'), who: 'kit', text: "The radio got there in the end. That's what matters to him.", vi: 'Cuối cùng cái đài cũng tới nơi. Với ông ấy thế là đủ.' },
  { id: b('n1'), who: 'kit', text: 'Hello to ward eight tonight. We know you are listening.', vi: 'Gửi lời chào khoa tám tối nay. Chúng tôi biết các bạn đang nghe.' },
];

const NB_2: NoteEntry[] = [
  {
    key: 'ward',
    label: 'Ông nằm khoa nào',
    line: b('c02'),
    answer: '8',
    options: [
      { value: '8', label: 'Khoa 8' },
      { value: '18', label: 'Khoa 18' },
      { value: '80', label: 'Khoa 80' },
    ],
  },
  {
    key: 'radio',
    label: 'Cái đài đang ở đâu',
    line: b('c03'),
    answer: 'pete',
    options: [
      { value: 'pete', label: 'Phòng đồ thất lạc (Pete)' },
      { value: 'okafor', label: 'Ô bán vé của bà Okafor' },
      { value: 'bus', label: 'Vẫn trên xe buýt, ở bến xe' },
    ],
  },
  {
    key: 'when',
    label: 'Phát bài lúc mấy giờ',
    line: b('c04'),
    answer: '115',
    options: [
      { value: '115', label: '1:15' },
      { value: '1245', label: '12:45' },
      { value: '150', label: '1:50' },
    ],
  },
];

const N2 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_KIT_2: JobDoc = {
  id: 'job-kit2',
  title: 'Đường dây rè',
  blurb: 'Nửa đêm nay ông cụ không gọi. Con gái ông gọi thay, từ một đường dây rè.',
  level: 2,
  order: 42,
  opens: ['ct-kit-1'],
  after: 'job-kit1',
  from: 'kit',
  lines: LINES_2,
  facts: [
    { id: 'ward', label: 'Khoa nào', line: b('c02'), consequence: 'ward' },
    { id: 'radio', label: 'Cái đài ở đâu', line: b('c03'), consequence: 'radio' },
    { id: 'when', label: 'Phát lúc mấy giờ', line: b('c04'), consequence: 'when' },
  ],
  consequences: {
    ward: { name: 'Ghi sai khoa', rejoin: 'Bridget biết ông nằm khoa tám và mang đài lên.' },
    radio: { name: 'Tìm cái đài nhầm chỗ', rejoin: 'Người ở đó chỉ sang phòng đồ thất lạc.' },
    when: { name: 'Phát bài sai giờ', rejoin: 'Cái đài vẫn tới tay ông; mai phát lại.' },
  },
  steps: [
    { kind: 'goto', place: 'kit', label: 'Tới phòng thu Bay FM lúc nửa đêm' },
    { kind: 'scene', at: 'kit', who: ['kit'], lines: [b('01')] },
    {
      kind: 'notebook',
      via: 'phone',
      call: ['c01', 'c02', 'c03', 'c04'].map(b),
      entries: NB_2,
      repeat: { ward: [b('c02r')], radio: [b('c03r')], when: [b('c04r')] },
      patience: { after: 2, line: b('c05') },
    },
    // the radio, where it was written to be
    { kind: 'goto', place: 'okafor', label: 'Tới chỗ bạn đã ghi để lấy cái đài', if: N2('radio', 'okafor') },
    { kind: 'scene', at: 'okafor', who: ['okafor'], lines: [b('w01')], if: N2('radio', 'okafor') },
    { kind: 'goto', place: 'rico', label: 'Tới chỗ bạn đã ghi để lấy cái đài', if: N2('radio', 'bus') },
    { kind: 'scene', at: 'rico', who: ['rico'], lines: [b('w02')], if: N2('radio', 'bus') },
    { kind: 'goto', place: 'pete', label: 'Tới phòng đồ thất lạc' },
    { kind: 'scene', at: 'pete', who: ['pete'], lines: [b('p01')] },
    // the hospital, the ward noted
    { kind: 'goto', place: 'bridget', label: 'Mang cái đài tới bệnh viện Westbay' },
    { kind: 'scene', at: 'bridget', who: ['bridget'], lines: [{ line: b('h01'), if: N2('ward', '8') }, { line: b('h02'), if: N2('ward', '18') }, { line: b('h03'), if: N2('ward', '80') }] },
    // the song, at the time noted
    { kind: 'radio', lines: [{ line: b('k01'), if: N2('when', '115') }, { line: b('k02'), if: { note: 'when', is: 'wrong' } }] },
  ],
  ending: { clean: [b('z1')], messy: [b('z2')], broken: [b('z3')] },
  news: { clean: [b('n1')], messy: [b('n1')], broken: [b('n1')] },
};

// ───────────────────────── 3. Rosie gọi lại ─────────────────────────

const c = (key: string) => `job-kit3-${key}`;
const R = 'caller-clear-f';

const LINES_3 = [
  { id: c('01'), who: 'kit', text: "A new caller on the request line. She asked for you by name. Well, by job.", vi: 'Có người mới gọi vào đường dây xin bài. Cô ấy hỏi bạn. À, hỏi người làm việc này.' },
  { id: c('c01'), who: R, text: "My name is Rosie. I still live at number twelve. I heard the song.", vi: 'Tên tôi là Rosie. Tôi vẫn ở số mười hai. Tôi nghe bài hát rồi.' },
  { id: c('c02'), who: R, text: 'The man with the bicycle. He rang the bell outside my window every morning.', vi: 'Người đàn ông đi xe đạp. Sáng nào anh ấy cũng bấm chuông ngoài cửa sổ nhà tôi.' },
  { id: c('c03'), who: R, text: 'Tell him I kept the bell. He left it on my gate when he moved away.', vi: 'Nhắn anh ấy là tôi vẫn giữ cái chuông. Anh ấy để nó trên cổng nhà tôi khi chuyển đi.' },
  { id: c('c04'), who: R, text: "I'll come and see him on Sunday afternoon. Not before. I need my hair done.", vi: 'Chiều Chủ nhật tôi sẽ tới thăm anh ấy. Không sớm hơn đâu. Tôi phải làm tóc đã.' },
  { id: c('c05'), who: R, text: 'And play the same song again tonight. For him, from me this time.', vi: 'Và tối nay phát lại đúng bài đó. Tặng anh ấy, lần này từ tôi.' },
  { id: c('c03r'), who: R, text: 'The bell. His bicycle bell. I kept it.', vi: 'Cái chuông. Chuông xe đạp của anh ấy. Tôi giữ nó.' },
  { id: c('c04r'), who: R, text: 'Sunday. In the afternoon.', vi: 'Chủ nhật. Buổi chiều.' },
  { id: c('c05r'), who: R, text: 'The same one. The harbour lights.', vi: 'Đúng bài đó. Ánh đèn bến cảng.' },
  { id: c('c06'), who: R, text: "I'm seventy-nine, dear. I only say things once these days.", vi: 'Tôi bảy mươi chín tuổi rồi, cháu ạ. Giờ tôi chỉ nói mỗi chuyện một lần thôi.' },
  // the learner tells the ward, what was written
  { id: c('m01'), who: 'player', text: "Rosie says she kept the bell. She's coming on Sunday afternoon.", vi: 'Bà Rosie nói bà vẫn giữ cái chuông. Chiều Chủ nhật bà sẽ tới.' },
  { id: c('m02'), who: 'player', text: "Rosie says she kept the bill. She's coming on Sunday afternoon.", vi: 'Bà Rosie nói bà vẫn giữ tờ hóa đơn. Chiều Chủ nhật bà sẽ tới.' },
  { id: c('m02b'), who: 'player', text: "Rosie says she kept the belt. She's coming on Sunday afternoon.", vi: 'Bà Rosie nói bà vẫn giữ cái thắt lưng. Chiều Chủ nhật bà sẽ tới.' },
  { id: c('m03'), who: 'player', text: "A message from Rosie. She's coming on Monday afternoon.", vi: 'Có lời nhắn của bà Rosie. Chiều thứ Hai bà sẽ tới.' },
  { id: c('m04'), who: 'player', text: "A message from Rosie. She's coming on Sunday morning.", vi: 'Có lời nhắn của bà Rosie. Sáng Chủ nhật bà sẽ tới.' },
  { id: c('b01'), who: 'bridget', text: "The bell? He's sitting up. I've never seen him sit up so fast.", vi: 'Cái chuông á? Ông ấy ngồi bật dậy. Tôi chưa thấy ông ngồi dậy nhanh thế bao giờ.' },
  { id: c('b02'), who: 'bridget', text: "He looks puzzled. Are you sure? I think she kept his bell.", vi: 'Trông ông ấy ngơ ngác. Bạn chắc không? Tôi nghĩ bà ấy giữ cái chuông của ông.' },
  { id: c('b03'), who: 'bridget', text: "Monday? He's going home on Monday. I'll ring her and check.", vi: 'Thứ Hai á? Thứ Hai ông ấy xuất viện rồi. Để tôi gọi lại bà ấy hỏi cho chắc.' },
  { id: c('b04'), who: 'bridget', text: "Sunday morning is the doctors' round. Afternoon, surely. I'll ring her.", vi: 'Sáng Chủ nhật là giờ bác sĩ đi buồng. Chắc là buổi chiều. Để tôi gọi bà ấy.' },
  { id: c('k02'), who: 'kit', text: 'A different song? She asked for the same one. Here it is again.', vi: 'Bài khác á? Bà ấy xin đúng bài cũ mà. Phát lại đây.' },
  { id: c('k01'), who: 'kit', text: "For the man with the bicycle, from Rosie at number twelve. She kept the bell.", vi: 'Tặng người đàn ông đi xe đạp, từ Rosie ở số mười hai. Bà ấy vẫn giữ cái chuông.' },
  { id: c('z1'), who: 'kit', text: 'Sixty years, one song, one bell. I may have to sit down.', vi: 'Sáu mươi năm, một bài hát, một cái chuông. Chắc tôi phải ngồi xuống đã.' },
  { id: c('z2'), who: 'kit', text: 'A muddle in the middle. Bridget sorted it. It still ended well.', vi: 'Giữa chừng hơi rối. Bridget gỡ được. Cuối cùng vẫn kết đẹp.' },
  { id: c('z3'), who: 'kit', text: "Sunday will sort itself out. People who wait sixty years can wait a day.", vi: 'Chủ nhật rồi sẽ đâu vào đấy. Người chờ sáu mươi năm thì chờ thêm một ngày được.' },
  { id: c('n1'), who: 'kit', text: 'A request from number twelve, East Road, for ward eight. Goodnight, both of you.', vi: 'Một bài xin từ số mười hai East Road, tặng khoa tám. Chúc cả hai ngủ ngon.' },
];

const NB_3: NoteEntry[] = [
  {
    key: 'kept',
    label: 'Bà Rosie vẫn giữ cái gì',
    line: c('c03'),
    answer: 'bell',
    options: [
      { value: 'bell', label: 'Cái chuông xe đạp' },
      { value: 'bill', label: 'Một tờ hóa đơn' },
      { value: 'belt', label: 'Cái thắt lưng' },
    ],
  },
  {
    key: 'day',
    label: 'Bà tới thăm khi nào',
    line: c('c04'),
    answer: 'sun-pm',
    options: [
      { value: 'sun-pm', label: 'Chiều Chủ nhật' },
      { value: 'mon-pm', label: 'Chiều thứ Hai' },
      { value: 'sun-am', label: 'Sáng Chủ nhật' },
    ],
  },
  {
    key: 'song',
    label: 'Tối nay phát bài nào',
    line: c('c05'),
    answer: 'same',
    options: [
      { value: 'same', label: 'Đúng bài hôm trước, lần này từ bà' },
      { value: 'new', label: 'Một bài mới bà chọn' },
      { value: 'none', label: 'Không phát gì, bà tự tới' },
    ],
  },
];

const N3 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_KIT_3: JobDoc = {
  id: 'job-kit3',
  title: 'Rosie gọi lại',
  blurb: 'Một người lạ gọi vào đường dây xin bài: bà Rosie, ở số mười hai East Road.',
  level: 2,
  order: 43,
  opens: ['ct-kit-1'],
  after: 'job-kit2',
  from: 'kit',
  lines: LINES_3,
  facts: [
    { id: 'kept', label: 'Bà giữ cái gì', line: c('c03'), consequence: 'kept' },
    { id: 'day', label: 'Bà tới khi nào', line: c('c04'), consequence: 'day' },
    { id: 'song', label: 'Phát bài nào', line: c('c05'), consequence: 'song' },
  ],
  consequences: {
    kept: { name: 'Nhắn sai món bà Rosie còn giữ', rejoin: 'Bridget hỏi lại; ông cụ vẫn biết đó là cái chuông.' },
    day: { name: 'Nhắn sai ngày giờ bà tới', rejoin: 'Bridget gọi lại cho bà Rosie hỏi cho chắc.' },
    song: { name: 'Ghi sai bài bà muốn phát', rejoin: 'Kit vẫn phát đúng bài hôm trước.' },
  },
  steps: [
    { kind: 'goto', place: 'kit', label: 'Tới phòng thu Bay FM lúc nửa đêm' },
    { kind: 'scene', at: 'kit', who: ['kit'], lines: [c('01')] },
    {
      kind: 'notebook',
      via: 'phone',
      call: ['c01', 'c02', 'c03', 'c04', 'c05'].map(c),
      entries: NB_3,
      repeat: { kept: [c('c03r')], day: [c('c04r')], song: [c('c05r')] },
      patience: { after: 2, line: c('c06') },
    },
    // the learner tells the ward what was written
    { kind: 'goto', place: 'bridget', label: 'Tới bệnh viện nhắn khoa tám' },
    {
      kind: 'scene',
      at: 'bridget',
      who: ['bridget'],
      lines: [
        { line: c('m01'), if: { all: [N3('kept', 'bell'), N3('day', 'sun-pm')] } },
        { line: c('m02'), if: { all: [N3('kept', 'bill'), N3('day', 'sun-pm')] } },
        { line: c('m02b'), if: { all: [N3('kept', 'belt'), N3('day', 'sun-pm')] } },
        { line: c('m03'), if: N3('day', 'mon-pm') },
        { line: c('m04'), if: N3('day', 'sun-am') },
        { line: c('b01'), if: N3('kept', 'bell') },
        { line: c('b02'), if: { note: 'kept', is: 'wrong' } },
        { line: c('b03'), if: N3('day', 'mon-pm') },
        { line: c('b04'), if: N3('day', 'sun-am') },
      ],
    },
    { kind: 'radio', lines: [{ line: c('k02'), if: { note: 'song', is: 'wrong' } }, c('k01')] },
  ],
  ending: { clean: [c('z1')], messy: [c('z2')], broken: [c('z3')] },
  news: { clean: [c('n1')], messy: [c('n1')], broken: [c('n1')] },
};

export const SIDE_KIT: readonly JobDoc[] = [JOB_KIT_1, JOB_KIT_2, JOB_KIT_3];
