// Side chain "Hai người một lúc" (docs/gta-plan.md §5 "hai người nói cùng lúc", docs/gta-story.md §9): three small jobs
// at Westbay Hospital with Nell, the pharmacist who makes up the clinic's prescriptions from the town (docs/city.md §6),
// and Bridget, the head nurse, Grace's old student (§6), who has never once waited for anybody to finish. Its kind of
// listening: TWO PEOPLE AT ONCE. Each job is a short briefing to note, then a `threads` step: two people talk at the
// same time, the learner hears one and switches; the line that matters on each comes at a different moment (at least
// 3 s apart, as jobs.test.ts asks). A line that goes by unheard has its one consequence, then the job goes on.
//
// Westbay people only: the browser's voice, no clips. The pharmacy is Nell's place ('nell'), the ward desk Bridget's
// ('bridget').

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

// ───────────────────────── 1. Hai quầy một lúc ─────────────────────────

const a = (key: string) => `job-nell1-${key}`;

const LINES_1 = [
  { id: a('01'), who: 'nell', text: "You're the volunteer? Good. Bridget and I both need you, and we both talk.", vi: 'Bạn là tình nguyện viên à? Tốt. Bridget với tôi đều cần bạn, mà cả hai đều nói nhiều.' },
  { id: a('02'), who: 'nell', text: 'At the same time, usually. Bridget has never waited for anyone to finish.', vi: 'Thường là nói cùng lúc. Bridget chưa bao giờ chờ ai nói hết câu.' },
  { id: a('c01'), who: 'nell', text: 'This bag is for Mr Doyle, on the ward upstairs.', vi: 'Túi này cho ông Doyle, ở khoa trên lầu.' },
  { id: a('c02'), who: 'nell', text: 'Two tablets at breakfast. None at night, or he will not sleep.', vi: 'Hai viên vào bữa sáng. Buổi tối không uống, kẻo ông ấy mất ngủ.' },
  { id: a('c01r'), who: 'nell', text: 'Doyle. D for door. Mr Doyle.', vi: 'Doyle. D như door. Ông Doyle.' },
  { id: a('c02r'), who: 'nell', text: 'At breakfast. Only at breakfast.', vi: 'Vào bữa sáng. Chỉ bữa sáng thôi.' },
  { id: a('c03'), who: 'nell', text: "There's a queue to the door. Off you go.", vi: 'Người xếp hàng dài tới cửa rồi. Đi đi.' },
  // two at once: Bridget at the desk, Nell on the phone behind her
  { id: a('b01'), who: 'bridget', text: 'Is that for Mr Doyle? Lovely. Mind the trolley, love.', vi: 'Cho ông Doyle hả? Tốt quá. Coi chừng xe đẩy nhé, cưng.' },
  { id: a('b02'), who: 'bridget', text: "He's moved to bed eleven, by the window. He asked for the view.", vi: 'Ông ấy chuyển sang giường mười một, cạnh cửa sổ. Ông xin chỗ có cảnh.' },
  { id: a('b03'), who: 'bridget', text: 'Twelve beds, eleven patients, one of me. Every single day.', vi: 'Mười hai giường, mười một bệnh nhân, mỗi mình tôi. Ngày nào cũng thế.' },
  { id: a('b04'), who: 'bridget', text: 'Grace taught me that. Count the beds, then count the people.', vi: 'Grace dạy tôi đấy. Đếm giường trước, rồi đếm người.' },
  { id: a('n01'), who: 'nell', text: "Hello? It's Nell. Is the volunteer still there? Put me on speaker.", vi: 'Alô? Nell đây. Tình nguyện viên còn đó không? Bật loa ngoài giùm.' },
  { id: a('n02'), who: 'nell', text: 'One more thing about those tablets, and it matters.', vi: 'Thêm một chuyện về mấy viên thuốc đó, mà quan trọng đấy.' },
  { id: a('n03'), who: 'nell', text: 'No milk with them. Water only, or they do nothing.', vi: 'Không uống với sữa. Chỉ nước lọc thôi, không thì thuốc chẳng có tác dụng gì.' },
  { id: a('n04'), who: 'nell', text: "That's all. Tell Bridget she owes me a biscuit.", vi: 'Vậy thôi. Bảo Bridget là chị ấy nợ tôi một cái bánh quy.' },
  // what came of it
  { id: a('h01'), who: 'bridget', text: 'You went to bed seven? He moved. Eleven, by the window. Over here.', vi: 'Bạn tới giường bảy à? Ông ấy chuyển rồi. Giường mười một, cạnh cửa sổ. Đằng này.' },
  { id: a('h02'), who: 'bridget', text: 'He took them with a milky tea. Nell says try again at lunch, with water.', vi: 'Ông ấy uống thuốc với trà sữa. Nell bảo trưa uống lại, bằng nước lọc.' },
  { id: a('h03'), who: 'bridget', text: "Mr Boyle? We've a Doyle. Same bag, I'm sure. I'll check the label.", vi: 'Ông Boyle á? Ở đây có ông Doyle. Chắc cùng túi đấy. Để tôi xem nhãn.' },
  { id: a('h04'), who: 'bridget', text: 'At night? Nell would have my head. Breakfast, it says here.', vi: 'Buổi tối á? Nell mà biết thì chết tôi. Trên này ghi là bữa sáng.' },
  { id: a('h05'), who: 'bridget', text: 'Bed eleven, two tablets at breakfast, water. Perfect.', vi: 'Giường mười một, hai viên vào bữa sáng, nước lọc. Hoàn hảo.' },
  { id: a('z1'), who: 'nell', text: 'Two of us at once, and you missed nothing. Bridget is impressed. She hides it.', vi: 'Hai người nói cùng lúc mà bạn không sót gì. Bridget nể lắm. Chị ấy giấu thôi.' },
  { id: a('z2'), who: 'nell', text: 'You caught most of it. Nobody catches both of us. Not even Grace did.', vi: 'Bạn nghe được gần hết. Chẳng ai nghe kịp cả hai bọn tôi. Grace cũng không.' },
  { id: a('z3'), who: 'nell', text: "Mr Doyle is fine. We'll talk one at a time next week. We won't.", vi: 'Ông Doyle không sao. Tuần sau bọn tôi sẽ nói từng người một. Chắc là không đâu.' },
  { id: a('w1'), who: 'kit', text: 'A thank you tonight to the hospital volunteers. You keep the place going.', vi: 'Tối nay xin cảm ơn các tình nguyện viên ở bệnh viện. Nhờ các bạn mà mọi thứ chạy đều.' },
];

const NB_1: NoteEntry[] = [
  {
    key: 'name',
    label: 'Thuốc của ai',
    line: a('c01'),
    answer: 'doyle',
    options: [
      { value: 'doyle', label: 'Ông Doyle' },
      { value: 'boyle', label: 'Ông Boyle' },
      { value: 'dale', label: 'Ông Dale' },
    ],
  },
  {
    key: 'when',
    label: 'Uống khi nào',
    line: a('c02'),
    answer: 'breakfast',
    options: [
      { value: 'breakfast', label: 'Bữa sáng, tối không uống' },
      { value: 'night', label: 'Buổi tối' },
      { value: 'both', label: 'Sáng và tối' },
    ],
  },
];

export const JOB_NELL_1: JobDoc = {
  id: 'job-nell1',
  title: 'Hai quầy một lúc',
  blurb: 'Nell ở quầy thuốc, Bridget ở bàn trực khoa. Cả hai đều cần bạn, và cả hai nói cùng lúc.',
  level: 1,
  order: 71,
  opens: ['ct-nell-1'],
  after: 'job-half5',
  from: 'nell',
  lines: LINES_1,
  facts: [
    { id: 'name', label: 'Thuốc của ai', line: a('c01'), consequence: 'name' },
    { id: 'when', label: 'Uống khi nào', line: a('c02'), consequence: 'when' },
  ],
  consequences: {
    name: { name: 'Ghi sai tên bệnh nhân', rejoin: 'Bridget xem nhãn trên túi.' },
    when: { name: 'Ghi sai giờ uống', rejoin: 'Bridget đọc giờ trên đơn.' },
    bed: { name: 'Không nghe Bridget nói ông đã chuyển giường', rejoin: 'Bridget chỉ đường tới giường mười một.' },
    milk: { name: 'Không nghe Nell dặn đừng uống với sữa', rejoin: 'Trưa uống lại, bằng nước lọc.' },
  },
  steps: [
    { kind: 'goto', place: 'nell', label: 'Tới quầy thuốc của Nell' },
    { kind: 'scene', at: 'nell', who: ['nell'], lines: [a('01'), a('02')] },
    {
      kind: 'notebook',
      via: 'scene',
      call: [a('c01'), a('c02')],
      entries: NB_1,
      repeat: { name: [a('c01r')], when: [a('c02r')] },
      patience: { after: 2, line: a('c03') },
    },
    { kind: 'goto', place: 'bridget', label: 'Mang túi thuốc lên bàn trực của Bridget' },
    {
      kind: 'threads',
      tracks: [
        { id: 'bridget', label: 'Bridget ở bàn trực', lines: ['b01', 'b02', 'b03', 'b04'].map(a), key: [a('b02')], consequence: 'bed' },
        { id: 'nell', label: 'Nell qua loa điện thoại', lines: ['n01', 'n02', 'n03', 'n04'].map(a), key: [a('n03')], consequence: 'milk' },
      ],
    },
    {
      kind: 'scene',
      at: 'bridget',
      who: ['bridget'],
      lines: [
        { line: a('h01'), if: { hit: 'bed' } },
        { line: a('h02'), if: { hit: 'milk' } },
        { line: a('h03'), if: { note: 'name', is: 'wrong' } },
        { line: a('h04'), if: { note: 'when', is: 'wrong' } },
        { line: a('h05'), if: { not: { any: [{ hit: 'bed' }, { hit: 'milk' }] } } },
      ],
    },
  ],
  ending: { clean: [a('z1')], messy: [a('z2')], broken: [a('z3')] },
  news: { clean: [a('w1')], messy: [a('w1')], broken: [a('w1')] },
};

// ───────────────────────── 2. Giao ca ─────────────────────────

const b = (key: string) => `job-nell2-${key}`;

const LINES_2 = [
  { id: b('01'), who: 'bridget', text: "Handover. Doctor Osei does his round, Nell's at the hatch, and I've got a minute.", vi: 'Giao ca. Bác sĩ Osei đi buồng, Nell ở ô cửa phát thuốc, còn tôi có đúng một phút.' },
  { id: b('c01'), who: 'bridget', text: 'The fridge key lives in the green tin on my desk. Not the blue one.', vi: 'Chìa khóa tủ lạnh nằm trong hộp thiếc xanh lá trên bàn tôi. Không phải hộp xanh dương.' },
  { id: b('c02'), who: 'bridget', text: 'His round starts at ten past nine. Have the notes ready by then.', vi: 'Ông ấy đi buồng lúc chín giờ mười. Chuẩn bị sẵn hồ sơ trước giờ đó.' },
  { id: b('c01r'), who: 'bridget', text: 'The green tin. Green, like the curtains.', vi: 'Hộp thiếc xanh lá. Xanh lá, như rèm cửa.' },
  { id: b('c02r'), who: 'bridget', text: 'Ten past nine. Nine ten.', vi: 'Chín giờ mười. Chín giờ mười phút.' },
  { id: b('c03'), who: 'bridget', text: "My minute's gone. You'll be fine, love.", vi: 'Hết một phút của tôi rồi. Bạn sẽ ổn thôi, cưng.' },
  // two at once: the doctor at the bed, Nell at the hatch
  { id: b('g01'), who: 'osei', text: 'Morning, Bridget. Off you go, I have the volunteer.', vi: 'Chào Bridget. Chị đi đi, tôi có tình nguyện viên rồi.' },
  { id: b('o01'), who: 'osei', text: 'Good morning. Mrs Price, in bed four. Let us see.', vi: 'Chào buổi sáng. Bà Price, giường số bốn. Để xem nào.' },
  { id: b('o02'), who: 'osei', text: 'She can go home tomorrow. Not today. Tell her family tomorrow.', vi: 'Bà ấy về nhà được vào ngày mai. Không phải hôm nay. Báo gia đình là ngày mai.' },
  { id: b('o03'), who: 'osei', text: 'Forty years of wards, and every patient wants to leave on day one.', vi: 'Bốn mươi năm ở các khoa, bệnh nhân nào cũng muốn về ngay ngày đầu.' },
  { id: b('o04'), who: 'osei', text: 'Bed five next. Mr Gill, who is asleep, and who I will not wake.', vi: 'Tiếp theo giường năm. Ông Gill, đang ngủ, và tôi sẽ không đánh thức.' },
  { id: b('n01'), who: 'nell', text: 'Volunteer! Over here, at the hatch. Quick one.', vi: 'Tình nguyện viên! Đằng này, ở ô cửa. Nhanh thôi.' },
  { id: b('n02'), who: 'nell', text: 'These are eye drops for Mrs Price. Little box, blue lid.', vi: 'Đây là thuốc nhỏ mắt cho bà Price. Hộp nhỏ, nắp xanh dương.' },
  { id: b('n03'), who: 'nell', text: 'Keep them in the fridge. Not on the shelf, they spoil in the warm.', vi: 'Cất trong tủ lạnh. Đừng để trên kệ, trời ấm là hỏng.' },
  { id: b('n04'), who: 'nell', text: "And don't let Bridget use them as a paperweight again.", vi: 'Và đừng để Bridget lấy chúng chặn giấy nữa đấy.' },
  // what came of it
  { id: b('h01'), who: 'bridget', text: "Her son's here with the car. You said today? Doctor said tomorrow. I'll tell him.", vi: 'Con trai bà ấy tới đón bằng xe rồi. Bạn bảo hôm nay à? Bác sĩ nói ngày mai. Để tôi báo.' },
  { id: b('h02'), who: 'bridget', text: 'Eye drops on the shelf, warm as toast. Nell is sending new ones up.', vi: 'Thuốc nhỏ mắt để trên kệ, ấm sực. Nell đang gửi lọ mới lên.' },
  { id: b('h03'), who: 'bridget', text: 'The blue tin has my biscuits, not the key. Green tin, love.', vi: 'Hộp xanh dương đựng bánh quy của tôi, không phải chìa khóa. Hộp xanh lá, cưng.' },
  { id: b('h04'), who: 'osei', text: 'The notes were not ready. I waited. It is no matter, I read slowly.', vi: 'Hồ sơ chưa sẵn. Tôi đã chờ. Không sao, tôi đọc chậm mà.' },
  { id: b('h05'), who: 'osei', text: 'Notes ready, drops in the fridge, family told. A good handover.', vi: 'Hồ sơ sẵn, thuốc trong tủ lạnh, gia đình đã được báo. Giao ca tốt.' },
  { id: b('z1'), who: 'bridget', text: 'You heard the doctor and Nell at once. I need you on Mondays.', vi: 'Bạn nghe được bác sĩ và Nell cùng lúc. Thứ Hai nào tôi cũng cần bạn.' },
  { id: b('z2'), who: 'bridget', text: "Bits went astray. That's handover. It happens to me too.", vi: 'Có vài chỗ lạc mất. Giao ca là thế. Tôi cũng bị hoài.' },
  { id: b('z3'), who: 'bridget', text: 'Everyone is still in one piece. Ward work is mostly that.', vi: 'Ai cũng vẫn lành lặn. Việc ở khoa phần lớn là thế.' },
  { id: b('w1'), who: 'kit', text: 'Westbay Hospital says the new volunteers are a great help. Keep coming.', vi: 'Bệnh viện Westbay nói các tình nguyện viên mới giúp được rất nhiều. Cứ tới nhé.' },
];

const NB_2: NoteEntry[] = [
  {
    key: 'tin',
    label: 'Chìa khóa tủ lạnh ở đâu',
    line: b('c01'),
    answer: 'green',
    options: [
      { value: 'green', label: 'Hộp thiếc xanh lá' },
      { value: 'blue', label: 'Hộp thiếc xanh dương' },
      { value: 'drawer', label: 'Ngăn kéo bàn' },
    ],
  },
  {
    key: 'round',
    label: 'Bác sĩ đi buồng lúc mấy giờ',
    line: b('c02'),
    answer: '910',
    options: [
      { value: '910', label: '9:10' },
      { value: '950', label: '9:50' },
      { value: '1009', label: '10:09' },
    ],
  },
];

export const JOB_NELL_2: JobDoc = {
  id: 'job-nell2',
  title: 'Giao ca',
  blurb: 'Bridget giao ca trong đúng một phút. Rồi bác sĩ Osei và Nell cùng nói với bạn một lúc.',
  level: 1,
  order: 72,
  opens: ['ct-nell-1'],
  after: 'job-nell1',
  from: 'bridget',
  lines: LINES_2,
  facts: [
    { id: 'tin', label: 'Hộp chìa khóa', line: b('c01'), consequence: 'tin' },
    { id: 'round', label: 'Giờ đi buồng', line: b('c02'), consequence: 'round' },
  ],
  consequences: {
    tin: { name: 'Tìm chìa khóa nhầm hộp', rejoin: 'Bridget chỉ hộp xanh lá.' },
    round: { name: 'Hồ sơ chưa sẵn khi bác sĩ tới', rejoin: 'Bác sĩ Osei chờ và đọc chậm.' },
    home: { name: 'Không nghe bác sĩ nói bà Price về ngày mai', rejoin: 'Bridget báo lại cho con trai bà.' },
    fridge: { name: 'Không nghe Nell dặn cất thuốc vào tủ lạnh', rejoin: 'Nell gửi lọ mới lên.' },
  },
  steps: [
    { kind: 'goto', place: 'bridget', label: 'Tới bàn trực của Bridget' },
    { kind: 'scene', at: 'bridget', who: ['bridget'], lines: [b('01')] },
    {
      kind: 'notebook',
      via: 'scene',
      call: [b('c01'), b('c02')],
      entries: NB_2,
      repeat: { tin: [b('c01r')], round: [b('c02r')] },
      patience: { after: 1, line: b('c03') },
    },
    { kind: 'scene', at: 'bridget', who: ['osei', 'nell'], lines: [b('g01')] },
    {
      kind: 'threads',
      tracks: [
        { id: 'osei', label: 'Bác sĩ Osei ở giường', lines: ['o01', 'o02', 'o03', 'o04'].map(b), key: [b('o02')], consequence: 'home' },
        { id: 'nell', label: 'Nell ở ô cửa', lines: ['n01', 'n02', 'n03', 'n04'].map(b), key: [b('n03')], consequence: 'fridge' },
      ],
    },
    {
      kind: 'scene',
      at: 'bridget',
      who: ['bridget', 'osei'],
      lines: [
        { line: b('h03'), if: { note: 'tin', is: 'wrong' } },
        { line: b('h04'), if: { note: 'round', is: 'wrong' } },
        { line: b('h01'), if: { hit: 'home' } },
        { line: b('h02'), if: { hit: 'fridge' } },
        { line: b('h05'), if: { not: { any: [{ hit: 'home' }, { hit: 'fridge' }] } } },
      ],
    },
  ],
  ending: { clean: [b('z1')], messy: [b('z2')], broken: [b('z3')] },
  news: { clean: [b('w1')], messy: [b('w1')], broken: [b('w1')] },
};

// ───────────────────────── 3. Bánh sinh nhật ─────────────────────────

const c = (key: string) => `job-nell3-${key}`;

const LINES_3 = [
  { id: c('01'), who: 'nell', text: "It's Bridget's fiftieth on Friday. She thinks nobody knows. Everybody knows.", vi: 'Thứ Sáu là sinh nhật năm mươi của Bridget. Chị ấy tưởng không ai biết. Ai cũng biết.' },
  { id: c('c01'), who: 'nell', text: "Poppy is making the cake. Lemon, not chocolate. Bridget can't stand chocolate.", vi: 'Poppy làm bánh. Vị chanh, không phải sô cô la. Bridget ghét sô cô la.' },
  { id: c('c02'), who: 'nell', text: 'And fifty candles, if Poppy has fifty. Not fifteen. She will notice.', vi: 'Và năm mươi cây nến, nếu Poppy có đủ. Không phải mười lăm. Chị ấy sẽ để ý đấy.' },
  { id: c('c01r'), who: 'nell', text: 'Lemon. The yellow one.', vi: 'Vị chanh. Cái màu vàng.' },
  { id: c('c02r'), who: 'nell', text: 'Fifty. Five, oh.', vi: 'Năm mươi. Năm, không.' },
  { id: c('c03'), who: 'nell', text: "Here she comes. Act normal. Whatever that is.", vi: 'Chị ấy tới kìa. Làm như bình thường đi. Bình thường là sao cũng được.' },
  // two at once: Bridget chatting to the learner, Poppy on Nell's phone
  { id: c('g01'), who: 'nell', text: 'Bridget! We were just talking about tablets. Oh, my phone.', vi: 'Bridget! Bọn tôi đang nói chuyện thuốc men thôi. Ơ, điện thoại tôi.' },
  { id: c('b01'), who: 'bridget', text: "What are you two whispering about? Never mind. I've had a day.", vi: 'Hai người thì thầm gì thế? Thôi kệ. Tôi mệt cả ngày rồi.' },
  { id: c('b02'), who: 'bridget', text: "I'm off early on Friday, for once. Half three, out the side door.", vi: 'Thứ Sáu tôi về sớm, hiếm lắm đấy. Ba rưỡi, ra bằng cửa hông.' },
  { id: c('b03'), who: 'bridget', text: "I'm going home to sit down. That's my plan. Sitting.", vi: 'Tôi sẽ về nhà ngồi. Kế hoạch của tôi đấy. Ngồi.' },
  { id: c('b04'), who: 'bridget', text: "Grace rang this morning. She never rings. Funny, that.", vi: 'Sáng nay Grace gọi. Bà ấy có bao giờ gọi đâu. Lạ thật.' },
  { id: c('p01'), who: 'poppy', text: "Nell? It's Poppy. Quick, Dot's got her hands in the dough.", vi: 'Nell à? Poppy đây. Nhanh nhé, Dot đang nhồi bột.' },
  { id: c('p02'), who: 'poppy', text: 'The cake will be ready at three, but who carries it in?', vi: 'Bánh sẽ xong lúc ba giờ, nhưng ai mang vào đây?' },
  { id: c('p03'), who: 'poppy', text: "I'll leave it at the front desk downstairs. Front desk, not the side door.", vi: 'Tôi sẽ để ở quầy lễ tân dưới lầu. Quầy trước, không phải cửa hông.' },
  { id: c('p04'), who: 'poppy', text: 'Lemon, fifty candles, no chocolate. Dot says happy birthday.', vi: 'Vị chanh, năm mươi nến, không sô cô la. Dot gửi lời chúc mừng sinh nhật.' },
  // Friday
  { id: c('h01'), who: 'nell', text: 'We waited till four. She had gone at half three, out the side door.', vi: 'Bọn tôi chờ tới bốn giờ. Chị ấy đã về lúc ba rưỡi, bằng cửa hông.' },
  { id: c('h02'), who: 'nell', text: 'I chased her down the road with a cake. She laughed so hard she cried.', vi: 'Tôi ôm bánh đuổi theo chị ấy ngoài đường. Chị ấy cười chảy cả nước mắt.' },
  { id: c('h03'), who: 'nell', text: 'We looked at the side door for ten minutes. The cake was at the front desk.', vi: 'Bọn tôi tìm ở cửa hông mười phút. Bánh nằm ở quầy lễ tân.' },
  { id: c('h04'), who: 'nell', text: 'Chocolate? Poppy rang to check. Lemon, thank goodness.', vi: 'Sô cô la á? Poppy gọi hỏi lại rồi. Vị chanh, ơn trời.' },
  { id: c('h05'), who: 'nell', text: 'Fifteen candles. Bridget said that was the nicest thing anyone had said to her.', vi: 'Mười lăm cây nến. Bridget bảo đó là lời dễ thương nhất ai từng nói với chị ấy.' },
  { id: c('h06'), who: 'bridget', text: "Oh, you lot. Lemon. Fifty. Who told you? Don't answer that.", vi: 'Trời, mấy người này. Vị chanh. Năm mươi. Ai mách thế? Đừng trả lời.' },
  { id: c('z1'), who: 'bridget', text: "You knew where I'd be and when. I'm not even cross. I'm touched.", vi: 'Bạn biết tôi ở đâu, lúc nào. Tôi chẳng giận nổi. Tôi cảm động lắm.' },
  { id: c('z2'), who: 'bridget', text: 'Nearly a surprise. The cake was perfect. That was the main thing.', vi: 'Suýt nữa thì bất ngờ trọn vẹn. Bánh thì hoàn hảo. Thế là chính.' },
  { id: c('z3'), who: 'bridget', text: 'Not much of a surprise. Best birthday in years, all the same.', vi: 'Chẳng bất ngờ lắm. Dù vậy vẫn là sinh nhật vui nhất mấy năm nay.' },
  { id: c('w1'), who: 'kit', text: 'Happy birthday tonight to Bridget at the hospital. From all of Westbay.', vi: 'Tối nay chúc mừng sinh nhật Bridget ở bệnh viện. Từ cả Westbay.' },
];

const NB_3: NoteEntry[] = [
  {
    key: 'cake',
    label: 'Bánh vị gì',
    line: c('c01'),
    answer: 'lemon',
    options: [
      { value: 'lemon', label: 'Vị chanh' },
      { value: 'chocolate', label: 'Sô cô la' },
      { value: 'melon', label: 'Vị dưa' },
    ],
  },
  {
    key: 'candles',
    label: 'Bao nhiêu nến',
    line: c('c02'),
    answer: '50',
    options: [
      { value: '50', label: '50 cây' },
      { value: '15', label: '15 cây' },
      { value: '5', label: '5 cây' },
    ],
  },
];

const T3 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_NELL_3: JobDoc = {
  id: 'job-nell3',
  title: 'Bánh sinh nhật',
  blurb: 'Sinh nhật năm mươi của Bridget. Nell lo bất ngờ, Poppy làm bánh, còn Bridget tưởng không ai biết.',
  level: 2,
  order: 73,
  opens: ['ct-nell-1'],
  after: 'job-nell2',
  from: 'nell',
  lines: LINES_3,
  facts: [
    { id: 'cake', label: 'Vị bánh', line: c('c01'), consequence: 'cake' },
    { id: 'candles', label: 'Số nến', line: c('c02'), consequence: 'candles' },
  ],
  consequences: {
    cake: { name: 'Ghi sai vị bánh', rejoin: 'Poppy gọi hỏi lại.' },
    candles: { name: 'Ghi sai số nến', rejoin: 'Bridget lại thấy vui vì điều đó.' },
    early: { name: 'Không nghe Bridget nói thứ Sáu về sớm', rejoin: 'Nell ôm bánh đuổi theo ra đường.' },
    desk: { name: 'Không nghe Poppy nói để bánh ở quầy lễ tân', rejoin: 'Mười phút sau thì tìm ra.' },
  },
  steps: [
    { kind: 'goto', place: 'nell', label: 'Tới quầy thuốc của Nell' },
    { kind: 'scene', at: 'nell', who: ['nell'], lines: [c('01')] },
    {
      kind: 'notebook',
      via: 'scene',
      call: [c('c01'), c('c02')],
      entries: NB_3,
      repeat: { cake: [c('c01r')], candles: [c('c02r')] },
      patience: { after: 2, line: c('c03') },
    },
    { kind: 'scene', at: 'nell', who: ['nell', 'bridget'], lines: [c('g01')] },
    {
      kind: 'threads',
      tracks: [
        { id: 'bridget', label: 'Bridget nói chuyện với bạn', lines: ['b01', 'b02', 'b03', 'b04'].map(c), key: [c('b02')], consequence: 'early' },
        { id: 'poppy', label: 'Poppy qua điện thoại của Nell', lines: ['p01', 'p02', 'p03', 'p04'].map(c), key: [c('p03')], consequence: 'desk' },
      ],
    },
    {
      kind: 'scene',
      at: 'nell',
      who: ['nell', 'bridget'],
      lines: [
        { line: c('h01'), if: { hit: 'early' } },
        { line: c('h02'), if: { hit: 'early' } },
        { line: c('h03'), if: { hit: 'desk' } },
        { line: c('h04'), if: { note: 'cake', is: 'wrong' } },
        { line: c('h05'), if: { note: 'candles', is: 'wrong' } },
        { line: c('h06'), if: T3('candles', '50') },
      ],
    },
  ],
  ending: { clean: [c('z1')], messy: [c('z2')], broken: [c('z3')] },
  news: { clean: [c('w1')], messy: [c('w1')], broken: [c('w1')] },
};

export const SIDE_NELL: readonly JobDoc[] = [JOB_NELL_1, JOB_NELL_2, JOB_NELL_3];
