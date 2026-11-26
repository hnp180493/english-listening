// Act II, job 3a: "Câu hỏi thứ hai" (docs/gta-story-2.md §4 job 3a; Mei's chain). Shona, Kemp's assistant, comes to
// Mei's stall about buying her pitch for Bayline. Mei uses her method (ct-mei-2: one question only the truth can
// answer): what does Kemp have with his dumplings? Shona says prawn; Kemp has six PORK from Mei every night
// (machine2.ts, docs/city.md §19). The learner notes what Shona says and picks out the lie. Shona lets slip that Kemp
// "keeps every word": there is an archive somewhere.
//
// As written, against the bible (docs/gta-story-2.md §11 "As written"):
//   - the crew: Sol (the stall next door: Shona tried him first) or Mrs Okafor (she rings: Shona came in on the
//     eight forty with a man in a Coastline jacket; asked to keep an eye out, she does: flag `okafor-watch`, read by
//     job 5b "Tuần cuối");
//   - the lie is caught by an answer by intent after the talk (there is no "Đó!" button yet);  // ENGINE: 8 ("Đó!")
//   - "every word": the third look-alike is "every record" (Mei's records? no: a careless ear's guess at a thing kept).
// Nobody of the town speaks: no clips.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-second-${key}`;

const LINES = [
  // ── beat 1: Mei ──
  { id: id('a01'), who: 'mei', text: "Shona's coming at nine about my pitch. Again. She'll talk, and I'll listen.", vi: 'Chín giờ Shona tới hỏi chuyện chỗ bán của bà. Lại nữa. Cô ta nói, bà nghe.' },
  { id: id('a02'), who: 'mei', text: "Then I ask her one question only the truth can answer. Listen for the lie.", vi: 'Rồi bà hỏi cô ta một câu chỉ sự thật mới trả lời được. Nghe xem câu nào dối.' },
  { id: id('a03'), who: 'mei', text: "And don't stare at her. Stand by the steamer and look hungry.", vi: 'Và đừng nhìn chằm chằm. Đứng cạnh nồi hấp mà làm mặt đói.' },
  // with Sol
  { id: id('s01'), who: 'sol', text: "She was round my stall this afternoon. Asked what I'd take for it.", vi: 'Chiều nay cô ta ghé sạp tôi. Hỏi tôi muốn bán bao nhiêu.' },
  { id: id('s02'), who: 'sol', text: "I said twelve dollars a lantern, and the stall's not for sale.", vi: 'Tôi bảo mười hai đô một chiếc lồng đèn, còn sạp thì không bán.' },
  // with Mrs Okafor
  { id: id('o01'), who: 'okafor', text: 'Your Shona came in on the eight forty from the city. First class.', vi: 'Cô Shona của cháu tới bằng chuyến tám giờ bốn mươi từ thành phố. Vé hạng nhất.' },
  { id: id('o02'), who: 'okafor', text: 'With a man in a green Coastline jacket. Shall I keep an eye out for him?', vi: 'Đi cùng một ông mặc áo khoác Coastline màu xanh lá. Có cần bà để mắt tới ông ta không?' },
  { id: id('o03a'), who: 'player', text: 'Yes, please, Mrs Okafor. If he comes back, tell us.', vi: 'Có ạ, bà Okafor. Nếu ông ta quay lại, bà báo bọn cháu.' },
  { id: id('o03b'), who: 'player', text: "No need, thank you. We'll manage.", vi: 'Không cần đâu ạ, cảm ơn bà. Bọn cháu tự lo được.' },
  { id: id('o04a'), who: 'okafor', text: 'Every train, every face. I never miss one. Leave it with me.', vi: 'Mọi chuyến tàu, mọi gương mặt. Bà không bỏ sót ai. Cứ để bà.' },
  { id: id('o04b'), who: 'okafor', text: 'As you like. I shall notice him anyway. I notice everybody.', vi: 'Tùy cháu. Đằng nào bà cũng sẽ để ý ông ta. Bà để ý mọi người.' },
  // ── beat 3: Shona at the stall ──
  { id: id('n00'), who: 'shona', text: 'Evening, Mrs Mei. Is this a good time?', vi: 'Chào bà Mei. Giờ này có tiện không ạ?' },
  { id: id('n01'), who: 'mei', text: "It's a dumpling stall, dear. It's always a good time.", vi: 'Sạp há cảo mà cháu. Lúc nào chẳng tiện.' },
  { id: id('n02'), who: 'shona', text: "I've worked for Mr Kemp eight years now. He's a very fair man.", vi: 'Tôi làm cho ông Kemp tám năm rồi. Ông ấy rất công bằng.' },
  { id: id('n03'), who: 'mei', text: 'Eight years. And what does a fair man want with my little stall?', vi: 'Tám năm. Thế người công bằng muốn gì ở cái sạp nhỏ của bà?' },
  { id: id('n04'), who: 'shona', text: 'He likes to keep things. Every word, really. He never throws anything away.', vi: 'Ông ấy thích giữ lại mọi thứ. Từng lời, thật đấy. Không bao giờ vứt gì đi.' },
  { id: id('n05'), who: 'mei', text: 'Every word. How tidy of him.', vi: 'Từng lời. Ngăn nắp ghê.' },
  { id: id('n06'), who: 'shona', text: "Think about his offer. I'll come back on Saturday, at half eight.", vi: 'Bà nghĩ về lời đề nghị của ông ấy nhé. Thứ Bảy tôi quay lại, lúc tám rưỡi.' },
  { id: id('n07'), who: 'mei', text: 'Tell me, dear. What does he have with his dumplings?', vi: 'Nói bà nghe nào cháu. Ông ấy ăn há cảo nhân gì?' },
  { id: id('n08'), who: 'shona', text: "Oh, prawn. Always prawn. He can't stand pork.", vi: 'Ồ, nhân tôm. Lúc nào cũng tôm. Ông ấy không chịu được thịt heo.' },
  { id: id('n09'), who: 'mei', text: 'Prawn. Of course. Saturday, then. Mind the step, dear.', vi: 'Tôm. Tất nhiên rồi. Vậy thứ Bảy nhé. Coi chừng bậc thềm, cháu.' },
  { id: id('n02r'), who: 'shona', text: 'Eight years. Since his very first car.', vi: 'Tám năm. Từ chiếc xe đầu tiên của ông ấy.' },
  { id: id('n04r'), who: 'shona', text: 'Every word. Whatever anybody says, he keeps it.', vi: 'Từng lời. Ai nói gì, ông ấy cũng giữ lại.' },
  { id: id('n06r'), who: 'shona', text: 'Saturday. Half past eight. In the evening.', vi: 'Thứ Bảy. Tám giờ rưỡi. Buổi tối.' },
  { id: id('n10'), who: 'shona', text: "You're very interested in me tonight, aren't you? Is it urgent?", vi: 'Tối nay bà quan tâm tôi quá nhỉ? Có gấp không?' },
  // what was noted wrong
  { id: id('c01'), who: 'mei', text: "Eight years, dear, not eighteen. She'd have started at twelve.", vi: 'Tám năm, cháu ạ, không phải mười tám. Thế thì cô ta đi làm từ năm mười hai tuổi à.' },
  { id: id('c02'), who: 'mei', text: 'Every word, she said. Words. He keeps what people say. Somewhere.', vi: 'Cô ta nói từng lời. Lời nói. Hắn giữ lại những gì người ta nói. Ở đâu đó.' },
  { id: id('c03'), who: 'mei', text: "Half eight, dear. Half past eight. You'd have missed her by an hour.", vi: 'Tám rưỡi, cháu. Tám giờ rưỡi. Cháu sẽ lỡ cô ta cả tiếng đồng hồ.' },
  // the lie
  { id: id('q01'), who: 'mei', text: 'Well, dear? Which of those was the lie?', vi: 'Sao, cháu? Trong mấy câu đó câu nào là dối?' },
  { id: id('q02a'), who: 'player', text: 'Eight years with Kemp. That was the lie.', vi: 'Tám năm làm cho Kemp. Câu đó dối.' },
  { id: id('q02b'), who: 'player', text: 'That he keeps every word. That was the lie.', vi: 'Rằng hắn giữ từng lời. Câu đó dối.' },
  { id: id('q02c'), who: 'player', text: 'Prawn. He always has pork from you.', vi: 'Nhân tôm. Hắn toàn mua nhân thịt của bà.' },
  { id: id('q03a'), who: 'mei', text: 'That was true, dear. Pork. Six pork, every night, from me.', vi: 'Câu đó thật đấy cháu. Thịt. Sáu cái nhân thịt, tối nào cũng mua của bà.' },
  { id: id('q03c'), who: 'mei', text: "Prawn. She's never even seen him eat. She'll say anything to sell.", vi: 'Tôm. Cô ta còn chưa thấy hắn ăn bao giờ. Nói gì cũng được miễn bán được.' },
  // ── beat 4 ──
  { id: id('z01'), who: 'mei', text: "And he keeps every word. Then there's a room full of them somewhere.", vi: 'Mà hắn giữ từng lời. Vậy thì ở đâu đó có cả một phòng đầy lời nói.' },
  { id: id('z02'), who: 'mei', text: 'Tell Jun. And tomorrow, Mr Kemp gets his six pork from me in person.', vi: 'Kể với Jun. Và mai, ông Kemp sẽ nhận sáu cái nhân thịt tận tay bà.' },
  // the last word, by grade
  { id: id('e1'), who: 'mei', text: "You heard every word. I'll make you an honorary member of Jun's class.", vi: 'Cháu nghe trọn từng lời. Bà sẽ cho cháu làm học trò danh dự lớp của Jun.' },
  { id: id('e2'), who: 'mei', text: 'Not bad. Next time, keep your eyes on the steamer and your ears on her.', vi: 'Không tệ. Lần sau mắt nhìn nồi hấp, tai thì để vào cô ta.' },
  { id: id('e3'), who: 'mei', text: "She talked, and you nodded. That's exactly what she wanted, dear.", vi: 'Cô ta nói, cháu gật. Đúng điều cô ta muốn đấy cháu.' },
  // Bay FM, by how it ended
  { id: id('f1'), who: 'kit', text: 'A quiet night at the night market. The dumpling stall stays where it is.', vi: 'Một đêm yên ả ở chợ đêm. Sạp há cảo vẫn ở chỗ cũ.' },
  { id: id('f2'), who: 'kit', text: 'Someone from Bayline was asking about stalls at the night market tonight.', vi: 'Tối nay có người của Bayline đi hỏi chuyện các sạp ở chợ đêm.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'years',
    label: 'Shona làm cho Kemp bao lâu',
    line: id('n02'),
    answer: '8',
    options: [
      { value: '8', label: '8 năm' },
      { value: '18', label: '18 năm' },
      { value: 'few', label: 'Vài năm' },
    ],
  },
  {
    key: 'keeps',
    label: 'Kemp giữ lại cái gì',
    line: id('n04'),
    answer: 'word',
    options: [
      { value: 'word', label: 'Từng lời người ta nói' },
      { value: 'one', label: 'Từng người làm cho hắn' },
      { value: 'record', label: 'Từng đĩa nhạc' },
    ],
  },
  {
    key: 'back',
    label: 'Shona quay lại khi nào',
    line: id('n06'),
    answer: 'sat830',
    options: [
      { value: 'sat830', label: 'Thứ Bảy, 8:30' },
      { value: 'sat730', label: 'Thứ Bảy, 7:30' },
      { value: 'sat8', label: 'Thứ Bảy, 8:00' },
    ],
  },
];

export const JOB_SECOND: JobDoc = {
  id: 'job-second',
  title: 'Câu hỏi thứ hai',
  blurb: 'Shona tới sạp bà Mei hỏi mua chỗ bán. Bà Mei sẽ hỏi lại một câu chỉ sự thật mới trả lời được.',
  level: 2,
  order: 13,
  opens: ['ct-rico-1'],
  after: 'job-sale',
  from: 'mei',
  crew: {
    roles: [
      { who: 'sol', role: 'Sạp bên cạnh', listen: 'Sol kể Shona đã hỏi mua sạp của anh chiều nay: bạn biết cô ta đang đi một vòng các sạp.', opens: { heard: ['ct-sol-2'] }, cut: CREW_CUT.friend, with: { at: 'sol' } },
      { who: 'okafor', role: 'Bà bán vé', listen: 'Bà Okafor gọi báo Shona tới bằng chuyến tàu nào, đi với ai: nghe số giờ tàu và một lời tả người.', opens: { heard: ['ct-okafor-2'] }, cut: CREW_CUT.friend, with: { at: 'okafor' } },
    ],
  },
  lines: LINES,
  facts: [
    { id: 'years', label: 'Shona làm cho Kemp bao lâu', line: id('n02'), consequence: 'years' },
    { id: 'keeps', label: 'Kemp giữ lại cái gì', line: id('n04'), consequence: 'keeps' },
    { id: 'back', label: 'Shona quay lại khi nào', line: id('n06'), consequence: 'back' },
    { id: 'lie', label: 'Câu nào là dối', line: id('n08'), consequence: 'lie', byAction: true },
  ],
  consequences: {
    years: { name: 'Ghi sai Shona làm cho Kemp bao lâu', rejoin: 'Bà Mei sửa lại.' },
    keeps: { name: 'Ghi sai Kemp giữ cái gì: không biết có một kho lời nói', rejoin: 'Bà Mei nói thẳng ra.' },
    back: { name: 'Ghi sai giờ Shona quay lại', rejoin: 'Bà Mei sửa lại giờ.' },
    lie: { name: 'Chọn sai câu dối', rejoin: 'Bà Mei chỉ ra câu dối thật: nhân tôm.' },
  },
  steps: [
    { kind: 'goto', place: 'mei', label: 'Tới sạp há cảo của bà Mei' },
    { kind: 'scene', at: 'mei', who: ['mei'], lines: ['a01', 'a02', 'a03'].map(id) },
    // with Sol: he was asked first
    { kind: 'scene', at: 'mei', who: ['mei', 'sol'], lines: [id('s01'), id('s02')], if: { crew: 'sol' } },
    // with Mrs Okafor: who came in on which train
    { kind: 'phone', lines: [id('o01'), id('o02')], if: { crew: 'okafor' } },
    {
      kind: 'intent',
      who: 'okafor',
      ask: [],
      options: [
        { label: 'Nhờ bà để mắt tới ông ta', say: id('o03a'), reply: [id('o04a')], flag: 'okafor-watch' },
        { label: 'Không cần', say: id('o03b'), reply: [id('o04b')] },
      ],
      if: { crew: 'okafor' },
    },
    // beat 3: Shona at the stall, said once
    { kind: 'scene', at: 'mei', who: ['shona', 'mei'], lines: [id('n00')] },
    {
      kind: 'notebook',
      via: 'scene',
      call: ['n01', 'n02', 'n03', 'n04', 'n05', 'n06', 'n07', 'n08', 'n09'].map(id),
      entries: NOTEBOOK,
      repeat: { years: [id('n02r')], keeps: [id('n04r')], back: [id('n06r')] },
      patience: { after: 2, line: id('n10') },
    },
    {
      kind: 'scene',
      at: 'mei',
      who: ['mei'],
      lines: [
        { line: id('c01'), if: { note: 'years', is: 'wrong' } },
        { line: id('c02'), if: { note: 'keeps', is: 'wrong' } },
        { line: id('c03'), if: { note: 'back', is: 'wrong' } },
      ],
    },
    // the lie: by intent for now  // ENGINE: 8 ("Đó!" while Shona says it)
    {
      kind: 'intent',
      who: 'mei',
      ask: [id('q01')],
      options: [
        { label: 'Tám năm làm cho Kemp', say: id('q02a'), reply: [id('q03a')] },
        { label: 'Kemp giữ từng lời', say: id('q02b'), reply: [id('q03a')] },
        { label: 'Kemp chỉ ăn nhân tôm', say: id('q02c'), reply: [id('q03c')] },
      ],
      check: { right: 2, consequence: 'lie', fact: 'lie' },
    },
    // beat 4
    { kind: 'scene', at: 'mei', who: ['mei'], lines: [id('z01'), id('z02')] },
  ],
  ending: { clean: [id('e1')], messy: [id('e2')], broken: [id('e3')] },
  news: { clean: [id('f1')], messy: [id('f2')], broken: [id('f2')] },
};
