// Act II, job 4b: "Cửa nước" ("The water door", docs/gta-story-2.md §4 job 4b; Gus's chain, after "Ca đêm"). Kemp does
// not mean to move the tapes out by road but by boat, through warehouse fifteen's water door. Gus counts every boat in
// the harbour; Captain Odile calls on the ferry radio: which boat, when it comes, who steers it. The learner goes out
// in the ferry's launch to the water door, then hears the Bayline driver and Shona on the pier say when the boxes go.
//
// As built, against the bible:
//   - Odile's call is the notebook (via the radio in Gus's hut); the launch is a real boat (step `boat`, the learner
//     aboard, from the seafront jetty round to fifteen's water gate: features/town/city/warehouse.ts runBoat);
//   - the boat noted wrong (berth five, "the kitty"): Odile rings to say the launch is watching the wrong berth;
//   - the time noted wrong: the talk on the pier is heard from its third line (its start missed);
//   - who steers noted wrong: Gus takes it the wrong way and one line goes to sorting it out;
//   - the two on the pier are the Bayline driver and Shona (no new person: Shona's cousin is only talked about), heard
//     by Gus's hut, where the pier is;
//   - who may come along: Captain Odile (her ferry radio says when the Kittiwake leaves its mooring) or Theo (he names
//     the engines going by on the water; the learner presses "Đó!" when he names the Kittiwake: step `spot`).
// Nobody of the town speaks: no clips.

import { CREW_CUT } from '../../../core/town/crew';
import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-water-${key}`;
const LATE = { note: 'time', is: 'wrong' as const };

const LINES = [
  // ── beat 1: Gus's hut, the ferry radio ──
  { id: id('a01'), who: 'gus', text: 'I count every boat in this harbour. One of them is new this week.', vi: 'Tôi đếm mọi con thuyền ở cảng này. Tuần này có một chiếc mới.' },
  { id: id('a07'), who: 'gus', text: 'Kittiwake. Daft name for a boat that only works at night.', vi: 'Kittiwake. Cái tên ngớ ngẩn cho một con thuyền chỉ chạy ban đêm.' },
  { id: id('a02'), who: 'odile', text: "Odile on the ferry radio. Your boat's the Kittiwake, berth nine.", vi: 'Odile trên bộ đàm bến phà. Thuyền của bạn là chiếc Kittiwake, bến số chín.' },
  { id: id('a03'), who: 'odile', text: 'She comes round to fifteen at {time}, with her lights off.', vi: 'Nó vòng tới kho mười lăm lúc {time}, tắt đèn.' },
  { id: id('a04'), who: 'odile', text: "And she's steered by Shona's cousin. Not a sailor. You can tell.", vi: 'Và người lái là anh họ của Shona. Không phải dân đi biển. Nhìn là biết.' },
  { id: id('a05'), who: 'gus', text: 'Take the launch from the jetty. Odile says you can borrow it.', vi: 'Lấy xuồng ở cầu tàu. Odile bảo bạn mượn được.' },
  { id: id('a02r'), who: 'odile', text: 'The Kittiwake. Berth nine. Nine, not five.', vi: 'Chiếc Kittiwake. Bến chín. Chín, không phải năm.' },
  { id: id('a03r'), who: 'odile', text: "At {time}. I've timed her twice this week.", vi: 'Lúc {time}. Tuần này tôi canh giờ nó hai lần rồi.' },
  { id: id('a04r'), who: 'odile', text: "Shona's cousin. Her cousin. Not Shona herself.", vi: 'Anh họ của Shona. Anh họ. Không phải chính Shona.' },
  { id: id('a06'), who: 'odile', text: "I've a ferry to run, dear. That's all you get.", vi: 'Tôi còn phải chạy phà. Chỉ có thế thôi.' },
  // ── with Odile / Theo ──
  { id: id('o01'), who: 'odile', text: "Kittiwake's off her mooring now. Slow, no lights. She's yours.", vi: 'Kittiwake rời chỗ neo rồi. Chậm, không đèn. Nó là của bạn.' },
  { id: id('h01'), who: 'theo', text: "That's the ferry's engine. Mine, near enough. Nine years in it.", vi: 'Đó là máy của phà. Gần như của tôi. Chín năm trong đó.' },
  { id: id('h02'), who: 'theo', text: "That's a fishing boat. Old diesel. Hal's lot, coming in.", vi: 'Đó là thuyền đánh cá. Máy dầu cũ. Thuyền của Hal, đang về.' },
  { id: id('h03'), who: 'theo', text: "And that thin one, coughing? That's the Kittiwake. There.", vi: 'Còn cái tiếng mỏng, ho khục khặc? Đó là chiếc Kittiwake. Kia.' },
  { id: id('h05'), who: 'theo', text: "Needs a new plug. Whoever steers it can't fix it.", vi: 'Cần thay bugi. Ai lái nó thì cũng chẳng sửa được.' },
  { id: id('h04'), who: 'theo', text: 'Gone round the point now. Towards fifteen.', vi: 'Vòng qua mũi đất rồi. Về phía kho mười lăm.' },
  // ── beat 2: the launch ──
  { id: id('b01'), who: 'odile', text: "You're watching berth five. That's a crab boat. Nine, I said.", vi: 'Bạn đang canh bến năm. Đó là thuyền bắt cua. Tôi nói chín mà.' },
  { id: id('b02'), who: 'gus', text: 'Launch is yours. Round the point to fifteen, nice and quiet.', vi: 'Xuồng là của bạn. Vòng qua mũi đất tới kho mười lăm, nhẹ nhàng thôi.' },
  { id: id('b04'), who: 'odile', text: 'Keep her nose on the lights of fifteen. Gently on the throttle.', vi: 'Giữ mũi xuồng hướng về đèn kho mười lăm. Nhẹ tay ga thôi.' },
  { id: id('b05'), who: 'gus', text: "Water door's shut. But the slipway's wet. They've used it.", vi: 'Cửa nước đóng. Nhưng đường trượt còn ướt. Họ đã dùng nó.' },
  { id: id('b03'), who: 'gus', text: "You're at the water door. Now get to my hut. The pier's talking.", vi: 'Bạn tới cửa nước rồi. Giờ về chòi tôi. Ở cầu tàu đang có người nói chuyện.' },
  // ── beat 3: the pier ──
  { id: id('c01'), who: 'shona', text: "My cousin brings the Kittiwake round. You just open the water door.", vi: 'Anh họ tôi đưa chiếc Kittiwake vòng tới. Anh chỉ cần mở cửa nước.' },
  { id: id('c02'), who: 'driver', text: 'Which boxes? There must be a hundred in there.', vi: 'Thùng nào? Trong đó phải cả trăm thùng.' },
  { id: id('c03'), who: 'shona', text: 'The M boxes. All of them. Under the stairs.', vi: 'Các thùng M. Tất cả. Dưới cầu thang.' },
  { id: id('c04'), who: 'driver', text: 'And when? I want my Thursday off.', vi: 'Còn khi nào? Tôi muốn được nghỉ tối thứ Năm.' },
  { id: id('c05'), who: 'shona', text: "Thursday night. During Marcus's last show. Nobody looks at the water then.", vi: 'Tối thứ Năm. Trong chương trình cuối của Marcus. Lúc đó chẳng ai nhìn ra mặt nước.' },
  { id: id('c06'), who: 'driver', text: "Fine. But I'm not carrying them. That's your cousin's job.", vi: 'Được. Nhưng tôi không khiêng. Đó là việc của anh họ cô.' },
  { id: id('c07'), who: 'driver', text: 'And if somebody calls the police?', vi: 'Còn nếu có ai gọi cảnh sát?' },
  { id: id('c08'), who: 'shona', text: 'On a Thursday night, by water? Nobody looks. Nobody calls.', vi: 'Tối thứ Năm, đường thủy à? Chẳng ai nhìn. Chẳng ai gọi.' },
  { id: id('c-seen'), who: 'shona', text: "Somebody's on the pier. Not another word out here.", vi: 'Có ai đó trên cầu tàu. Ngoài này đừng nói thêm chữ nào.' },
  // ── beat 4 ──
  { id: id('d01'), who: 'gus', text: "Shona's steering? She can't even park a car.", vi: 'Shona lái thuyền à? Cô ta đỗ xe còn không xong.' },
  { id: id('d02'), who: 'player', text: "Not Shona. Her cousin. Shona's cousin steers the Kittiwake.", vi: 'Không phải Shona. Anh họ cô ta. Anh họ Shona lái chiếc Kittiwake.' },
  { id: id('d03'), who: 'gus', text: 'Her cousin. Right. Then he gets lost, and we follow him.', vi: 'Anh họ cô ta. Rồi. Vậy anh ta lạc, mình theo anh ta.' },
  { id: id('e1'), who: 'gus', text: 'Thursday, by water, the M boxes. During Marcus. Clever, and cold.', vi: 'Thứ Năm, đường thủy, các thùng M. Trong lúc Marcus lên sóng. Khôn, và lạnh lùng.' },
  { id: id('e2'), who: 'gus', text: 'We know the boat and the night. That will do.', vi: 'Biết thuyền và biết đêm. Thế là được.' },
  { id: id('e3'), who: 'gus', text: "We know it goes by water. The rest, we'll guess.", vi: 'Biết là đi đường thủy. Phần còn lại thì đoán.' },
  { id: id('n1'), who: 'kit', text: 'The harbour office reports a new boat at berth nine this week.', vi: 'Văn phòng cảng báo tuần này có một thuyền mới ở bến chín.' },
  { id: id('e4'), who: 'gus', text: "I'll count her out on Thursday. Every box she carries.", vi: 'Thứ Năm tôi sẽ đếm nó ra. Từng thùng nó chở.' },
  { id: id('n3'), who: 'kit', text: 'The ferry radio was busier than usual last night. Captain Odile says no comment.', vi: 'Tối qua bộ đàm bến phà bận hơn thường lệ. Thuyền trưởng Odile miễn bình luận.' },
  { id: id('n2'), who: 'kit', text: "A launch was seen off the warehouse row last night. Nobody's saying whose.", vi: 'Tối qua có một chiếc xuồng ngoài dãy kho. Chẳng ai nói của ai.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'boat',
    label: 'Thuyền nào',
    line: id('a02'),
    answer: 'nine',
    options: [
      { value: 'nine', label: 'Chiếc Kittiwake, bến 9' },
      { value: 'five', label: 'Chiếc Kittiwake, bến 5' },
      { value: 'kitty', label: 'Chiếc "Kitty", bến 9' },
    ],
  },
  { key: 'time', label: 'Tới lúc', line: id('a03'), answer: '', options: [] },
  {
    key: 'who',
    label: 'Ai lái',
    line: id('a04'),
    answer: 'cousin',
    options: [
      { value: 'cousin', label: 'Anh họ của Shona' },
      { value: 'course', label: 'Chính Shona ("of course")' },
      { value: 'husband', label: 'Chồng của Shona' },
    ],
  },
];

export const JOB_WATER: JobDoc = {
  id: 'job-water',
  title: 'Cửa nước',
  blurb: 'Kemp định chở băng ra bằng thuyền, qua cửa nước của kho. Odile gọi qua bộ đàm bến phà: thuyền nào, khi nào, ai lái.',
  level: 3,
  order: 16,
  opens: ['ct-rico-1'],
  after: 'job-night',
  from: 'gus',
  clock: 'half',
  lines: LINES,
  facts: [
    { id: 'boat', label: 'Thuyền nào', line: id('a02'), consequence: 'boat' },
    { id: 'time', label: 'Tới lúc', line: id('a03'), consequence: 'late' },
    { id: 'who', label: 'Ai lái', line: id('a04'), consequence: 'cousin' },
    { id: 'engine', label: 'Máy thuyền Kittiwake', line: id('h03'), consequence: 'engine', byAction: true },
  ],
  consequences: {
    boat: { name: 'Ghi sai thuyền: canh nhầm bến, Odile phải gọi chỉ', rejoin: 'Bạn ra đúng mũi đất, theo kịp chiếc Kittiwake.' },
    late: { name: 'Ghi sai giờ: tới cầu tàu muộn, chỉ nghe được nửa sau', rejoin: 'Bạn vẫn nghe được thùng nào, đêm nào.' },
    cousin: { name: 'Ghi sai người lái: Gus hiểu nhầm, mất một câu giải thích', rejoin: 'Gus hiểu ra; kế hoạch vẫn đúng.' },
    engine: { name: 'Bấm "Đó!" sai lúc: không nhận ra máy thuyền Kittiwake', rejoin: 'Theo chỉ lại; thuyền vẫn trong tầm mắt.' },
    seen: { name: 'Shona thấy có người trên cầu tàu', rejoin: 'Họ thôi nói; bạn đã nghe được điều chính.' },
  },
  crew: {
    roles: [
      { who: 'odile', role: 'Bộ đàm bến phà', listen: 'Odile báo qua bộ đàm lúc chiếc Kittiwake rời chỗ neo: bạn khỏi phải canh mặt nước.', opens: { heard: ['ct-odile-2'] }, cut: CREW_CUT.friend },
      { who: 'theo', role: 'Thợ máy', listen: 'Theo gọi tên từng tiếng máy trên mặt nước: bạn bấm "Đó!" đúng lúc anh nói tới chiếc Kittiwake.', opens: { heard: ['ct-theo-2'] }, cut: CREW_CUT.friend },
    ],
  },
  steps: [
    { kind: 'goto', place: 'gus', label: 'Tới chòi của Gus' },
    { kind: 'notebook', via: 'radio', call: ['a01', 'a07', 'a02', 'a03', 'a04', 'a05'].map(id), entries: NOTEBOOK, repeat: { boat: [id('a02r')], time: [id('a03r')], who: [id('a04r')] }, patience: { after: 3, line: id('a06') } },
    // beat 2: the jetty, the launch round to fifteen's water door
    { kind: 'goto', place: 'jetty', label: 'Ra cầu tàu lấy xuồng' },
    { kind: 'phone', lines: [id('b01')], if: { note: 'boat', is: 'wrong' } },
    { kind: 'radio', lines: [id('o01')], if: { crew: 'odile' } },
    { kind: 'spot', lines: ['h01', 'h02', 'h03', 'h05', 'h04'].map(id), at: id('h03'), early: 'engine', late: 'engine', never: 'engine', fact: 'engine', via: 'radio', if: { crew: 'theo' } },
    { kind: 'radio', lines: [id('b02'), id('b04')] },
    { kind: 'boat', from: 'jetty', to: 'w15-water', aboard: true },
    { kind: 'radio', lines: [id('b05'), id('b03')] },
    // beat 3: the pier by Gus's hut (late: the start is missed)
    {
      kind: 'overhear',
      at: 'gus',
      who: ['driver', 'shona'],
      lines: ['c01', 'c02', 'c03', 'c04', 'c05', 'c07', 'c08', 'c06'].map(id),
      passes: 2,
      word: id('c05'),
      noticed: { line: id('c-seen'), consequence: 'seen' },
      from: { if: LATE, index: 2 },
      park: [{ at: 'gus', look: 2 }],
    },
    // beat 4: who steers
    { kind: 'scene', at: 'gus', who: ['gus'], lines: [id('d01'), id('d02'), id('d03')], if: { note: 'who', is: 'wrong' } },
  ],
  ending: { clean: [id('e1'), id('e4')], messy: [id('e2')], broken: [id('e3')] },
  news: { clean: [id('n1')], messy: [id('n3')], broken: [id('n2')] },
};
