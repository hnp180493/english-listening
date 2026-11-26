// The sample job of milestone M0 (docs/gta-plan.md §8, §12): "Cuộn băng của Gus". Act I's opening (§5): Rico is
// setting up a dispatch of his own and a rival firm, Bayline, has been listening in on his radio channel to steal his
// fares. So he PHONES the learner instead: pick up a passenger outside the Loom at a time of the game's clock, keep
// off the avenue where Bayline's cars wait, take him to the ferry by his own directions (four junctions); then, at the
// big wheel, overhear Gus telling Captain Odile the password for a tape he made of Bayline's own radio, and say it.
// A wrong note has one consequence and rejoins the main line (core/town/job.ts).
//
// Westbay people only (browser voice, no clips). Canon kept (docs/city.md): Mr Whitlock, director of Meridian, calls
// places by the wrong names (he corrects himself); Mr Finch whispers even outdoors; Priya never has time; Vivian and
// Priya are old friends (the Loom's do); Gus works nights and has notes on the fridge with his wife; Captain Odile
// has never cancelled a crossing and will not ride the big wheel; Gus's radio picks up channels it should not (the
// main story, part 2); Rico wants two phones and a map. New canon (added to docs/city.md §13): Bayline, a taxi firm
// that listens to other people's radios; Gus's kettle has been out of order since the spring.
//
// The map's streets (data/cityWorld.ts, stretched): Market Street y 15–16, Station Avenue y 30–31, Arts Street y 49–50,
// the seafront promenade y 57–58, Quay Street y 78–79, Pier Road y 90–91 run east–west; College Road x 74–75 and East
// Road x 90–91 north–south. The Loom's door is at (77, 15), the ferry's at (66, 90), the big wheel's at (81, 78).

import type { JobLine, Junction, NoteEntry, TilePt } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const T = (x: number, y: number): TilePt => ({ x, y });

const id = (key: string) => `job-ferry-${key}`;

const LINES: readonly JobLine[] = [
  // ── beat 1: Rico phones ──
  { id: id('c01'), who: 'rico', text: "Hey, it's Rico. Don't use the radio today, somebody's listening in.", vi: 'Này, Rico đây. Hôm nay đừng dùng bộ đàm, có đứa đang nghe lén.' },
  { id: id('c02'), who: 'rico', text: "It's Bayline. They've been nicking my fares all week.", vi: 'Bên Bayline đấy. Cả tuần nay chúng nó cuỗm khách của tôi.' },
  { id: id('c03'), who: 'rico', text: 'So I need you for a pickup. Outside the Loom, the design place.', vi: 'Nên tôi cần bạn đi đón khách. Trước cửa xưởng Loom, chỗ làm thiết kế ấy.' },
  { id: id('c04'), who: 'rico', text: "Be there at {time}. He's got a ferry to catch.", vi: 'Có mặt lúc {time}. Ông ấy còn phải kịp chuyến phà.' },
  { id: id('c05'), who: 'rico', text: "Older fella. Grey hair, glasses, a grey suit. You can't miss him.", vi: 'Một ông lớn tuổi. Tóc bạc, đeo kính, com-lê xám. Không lẫn được đâu.' },
  { id: id('c06'), who: 'rico', text: "He'll tell you the way. He likes to.", vi: 'Ông ấy sẽ tự chỉ đường cho bạn. Ông ấy thích thế.' },
  { id: id('c07'), who: 'rico', text: "And stay off Station Avenue. Bayline's cars sit there all evening.", vi: 'À, tránh xa đại lộ Station Avenue. Xe của Bayline đậu ở đó cả buổi tối.' },
  { id: id('c08'), who: 'rico', text: "Right, I've got two phones ringing. Good luck!", vi: 'Thôi nhé, tôi đang có hai cái điện thoại đổ chuông. Chúc may mắn!' },
  // ── the pickup ──
  { id: id('w01'), who: 'rico', text: "Where are you? He's at the Loom, not there!", vi: 'Bạn đang ở đâu thế? Ông ấy ở xưởng Loom chứ không phải chỗ đó!' },
  { id: id('w02'), who: 'rico', text: 'The Loom. The far end of Market Street. Go, go!', vi: 'Xưởng Loom. Cuối phố Market Street ấy. Đi, đi!' },
  { id: id('x-finch'), who: 'finch', text: "Me? No, no, I'm walking. Shh, people are talking.", vi: 'Tôi á? Không, không, tôi đi bộ. Suỵt, người ta đang nói chuyện.' },
  { id: id('x-colin'), who: 'colin', text: "Not me, mate. I'm waiting for a lift from my boss.", vi: 'Không phải tôi đâu. Tôi đang chờ sếp cho đi nhờ.' },
  { id: id('x-priya'), who: 'priya', text: "A taxi? I wish. I've got three more meetings.", vi: 'Taxi á? Ước gì được. Tôi còn ba cuộc họp nữa.' },
  { id: id('x-hana'), who: 'hana', text: "Sorry, love, I'm only out here for some air.", vi: 'Xin lỗi nhé, tôi chỉ ra đây hít thở chút thôi.' },
  { id: id('x-vivian'), who: 'vivian', text: "It's my party. I'm not going anywhere.", vi: 'Tiệc của tôi mà. Tôi chẳng đi đâu cả.' },
  { id: id('k00'), who: 'whitlock', text: "Over here! The grey suit. I've been waving for ages.", vi: 'Đằng này! Bộ com-lê xám đây. Tôi vẫy nãy giờ.' },
  { id: id('p01'), who: 'whitlock', text: "Ah, you must be Rico's. Splendid. The ferry, please.", vi: 'À, chắc là người của Rico. Tuyệt. Cho tôi ra bến phà.' },
  { id: id('p02'), who: 'whitlock', text: "You're late, you know. I've been standing here since {time}.", vi: 'Cậu tới muộn đấy. Tôi đứng đây từ {time} rồi.' },
  { id: id('p03'), who: 'whitlock', text: 'Is that a Bayline car behind you? Did you come down the avenue?', vi: 'Có phải xe Bayline đằng sau cậu không? Cậu đi đường đại lộ à?' },
  // ── beat 2: his directions ──
  // ── beat 2: his directions, junction by junction (the car stops at each; the learner picks the way) ──
  { id: id('d1'), who: 'whitlock', text: 'Left at the corner, please. Down College Road, past the hospital.', vi: 'Rẽ trái ở góc đường nhé. Đi xuống đường College Road, qua bệnh viện.' },
  { id: id('d1-straight'), who: 'whitlock', text: 'Not straight on. College Road, back there at the corner.', vi: 'Không phải đi thẳng. Đường College Road, ở góc đằng kia cơ.' },
  { id: id('d1-right'), who: 'whitlock', text: "That's up the hill. We want down, towards the water.", vi: 'Đó là lên dốc. Mình cần đi xuống, về phía bờ nước.' },
  { id: id('d2'), who: 'whitlock', text: 'Keep going, then left onto Arts Street, by the chemist.', vi: 'Cứ đi tiếp, rồi rẽ trái vào phố Arts Street, chỗ hiệu thuốc.' },
  { id: id('d2-straight'), who: 'whitlock', text: "You've missed it. Arts Street was back there.", vi: 'Cậu đi quá rồi. Phố Arts Street ở đằng sau kia.' },
  { id: id('d2-right'), who: 'whitlock', text: 'Other way! Left, I said.', vi: 'Hướng kia chứ! Tôi bảo rẽ trái mà.' },
  { id: id('d3'), who: 'whitlock', text: 'Good. All the way to the end, and right onto East Road.', vi: 'Tốt. Đi tới cuối đường, rồi rẽ phải vào East Road.' },
  { id: id('d3-left'), who: 'whitlock', text: 'No, right, I said. Down towards the water.', vi: 'Không, tôi bảo rẽ phải. Đi xuống phía bờ nước.' },
  { id: id('d4'), who: 'whitlock', text: 'Past the seafront, then right at Quay Street. No, sorry, Pier Road, the one after.', vi: 'Qua khỏi bờ biển, rồi rẽ phải ở phố Quay. À không, xin lỗi, đường Pier Road, ngã sau đó.' },
  { id: id('d4-quay'), who: 'whitlock', text: 'This is Quay Street. I said Pier Road, the next one. My fault, really.', vi: 'Đây là phố Quay. Tôi nói đường Pier Road, ngã tiếp theo cơ. Lỗi tại tôi thật.' },
  { id: id('again'), who: 'whitlock', text: 'Again? All right. Listen carefully this time.', vi: 'Lại nữa à? Thôi được. Lần này nghe cho kỹ nhé.' },
  { id: id('d5'), who: 'whitlock', text: "Right here, and the ferry's just along.", vi: 'Rẽ phải ở đây, bến phà ngay phía trước thôi.' },
  { id: id('a01'), who: 'whitlock', text: "And the boat's still here. Thank you. Tell Rico I said thanks.", vi: 'Phà vẫn còn đây. Cảm ơn cậu. Nhắn Rico là tôi cảm ơn nhé.' },
  // ── beat 3: Rico again, then the big wheel ──
  { id: id('r01'), who: 'rico', text: 'Right, now the tricky bit. Gus has a tape for me.', vi: 'Rồi, giờ tới đoạn khó. Gus đang giữ cho tôi một cuộn băng.' },
  { id: id('r02'), who: 'rico', text: "He recorded Bayline's radio. Every word they said about us.", vi: 'Anh ấy ghi âm bộ đàm của Bayline. Từng lời chúng nó nói về mình.' },
  { id: id('r03'), who: 'rico', text: 'But he wants the password, and I wrote it on my hand.', vi: 'Nhưng anh ấy đòi mật khẩu, mà tôi lại ghi nó lên tay.' },
  { id: id('r04'), who: 'rico', text: "Then I washed my hands. Don't laugh.", vi: 'Rồi tôi đi rửa tay. Đừng có cười.' },
  { id: id('r05'), who: 'rico', text: "He's by the big wheel with Odile. He tells her everything.", vi: 'Anh ấy đang ở chỗ vòng đu quay với bà Odile. Chuyện gì anh ấy cũng kể bà ấy nghe.' },
  { id: id('r06'), who: 'rico', text: "Have a listen. Just don't let him see you.", vi: 'Lại nghe thử đi. Chỉ đừng để anh ấy thấy bạn.' },
  { id: id('o01'), who: 'gus', text: "Rico's sending somebody for the tape tonight.", vi: 'Tối nay Rico cho người tới lấy cuộn băng.' },
  { id: id('o02'), who: 'odile', text: "And how will you know it's really one of his?", vi: 'Thế sao anh biết đúng là người của cậu ta?' },
  { id: id('o03'), who: 'gus', text: "They'll give me the word. We picked it this morning.", vi: 'Họ sẽ nói mật khẩu. Bọn tôi chọn từ sáng nay.' },
  { id: id('o04'), who: 'odile', text: 'Go on, then. What is it?', vi: 'Thế nói đi. Là gì?' },
  { id: id('o05'), who: 'gus', text: 'Out of order. Like my kettle.', vi: '"Out of order", tức là "hỏng rồi". Như cái ấm của tôi ấy.' },
  { id: id('o06'), who: 'odile', text: "Your kettle's been out of order since the spring, Gus.", vi: 'Cái ấm của anh hỏng từ hồi mùa xuân rồi, Gus.' },
  { id: id('o07'), who: 'odile', text: "And no, I'm still not going on that wheel.", vi: 'Và không, tôi vẫn không lên cái vòng đu quay đó đâu.' },
  { id: id('n01'), who: 'gus', text: 'Evening. Can I help you with something?', vi: 'Chào buổi tối. Tôi giúp gì được không?' },
  { id: id('k01'), who: 'gus', text: "Rico sent you? Go on, then. What's the word?", vi: 'Rico cử bạn tới à? Nói đi. Mật khẩu là gì?' },
  { id: id('k02'), who: 'gus', text: "Out of order. That's the one. Here's your tape.", vi: 'Out of order. Đúng rồi. Băng của bạn đây.' },
  { id: id('k03'), who: 'gus', text: 'Close. Have another go.', vi: 'Gần đúng rồi. Thử lại lần nữa xem.' },
  { id: id('k04'), who: 'gus', text: 'Sorry, mate. No word, no tape. Tell Rico to come himself.', vi: 'Xin lỗi nhé. Không có mật khẩu thì không có băng. Bảo Rico tự tới mà lấy.' },
  // ── beat 4: Rico's last word, by grade ──
  { id: id('e-clean1'), who: 'rico', text: "You got it? And not a scratch? Partner, you're a star.", vi: 'Lấy được rồi à? Lại chẳng sứt mẻ gì? Cộng sự ơi, bạn đỉnh thật.' },
  { id: id('e-clean2'), who: 'rico', text: "Marcus gets the tape tonight. Bayline won't know what hit them.", vi: 'Tối nay Marcus sẽ có cuộn băng. Bayline sẽ chẳng hiểu chuyện gì vừa xảy ra.' },
  { id: id('e-messy1'), who: 'rico', text: 'Well, we got there. Not pretty, but we got there.', vi: 'Thôi thì cũng xong. Không đẹp, nhưng xong.' },
  { id: id('e-messy2'), who: 'rico', text: 'Next time, maybe fewer laps of the city?', vi: 'Lần sau bớt chạy vòng quanh thành phố nhé?' },
  { id: id('e-broken1'), who: 'rico', text: 'Well. That was a mess from start to finish.', vi: 'Chà. Đúng là rối tung từ đầu tới cuối.' },
  { id: id('e-broken2'), who: 'rico', text: "We'll try again. And this time, write it down properly.", vi: 'Mình làm lại. Lần này nhớ ghi chép cho cẩn thận.' },
  // ── Bay FM's news, by how it ended ──
  { id: id('f-clean1'), who: 'marcus', text: 'Good evening, Westbay. A tape reached this studio tonight.', vi: 'Chào buổi tối Westbay. Tối nay có một cuộn băng được gửi tới phòng thu.' },
  { id: id('f-clean2'), who: 'marcus', text: "On it, a taxi firm boasts about listening to other people's radios.", vi: 'Trong băng, một hãng taxi khoe chuyện nghe lén bộ đàm của người khác.' },
  { id: id('f-clean3'), who: 'marcus', text: "Bayline, if you're listening, and you usually are, tomorrow at eight.", vi: 'Bayline, nếu các anh đang nghe, mà các anh hay nghe lắm, thì hẹn mai, tám giờ.' },
  { id: id('f-messy1'), who: 'marcus', text: 'Reports tonight of a taxi going round and round the harbour.', vi: 'Tối nay có tin một chiếc taxi chạy vòng vòng quanh bến cảng.' },
  { id: id('f-messy2'), who: 'marcus', text: 'It did bring something to this studio in the end.', vi: 'Cuối cùng thì nó cũng mang được một thứ tới phòng thu.' },
  { id: id('f-messy3'), who: 'marcus', text: "What's on it? Tune in tomorrow, and drive carefully.", vi: 'Trong đó có gì? Mai nghe đài nhé, và lái xe cẩn thận.' },
  { id: id('f-none1'), who: 'marcus', text: 'Rumours tonight of a mystery tape somewhere on the harbour.', vi: 'Tối nay có tin đồn về một cuộn băng bí ẩn đâu đó ở bến cảng.' },
  { id: id('f-none2'), who: 'marcus', text: 'Gus, the night guard, would only tell us his kettle is out of order.', vi: 'Anh Gus gác đêm chỉ chịu nói với chúng tôi là cái ấm của anh ấy hỏng rồi.' },
  { id: id('f-none3'), who: 'marcus', text: "Make of that what you will. Here's some music.", vi: 'Hiểu thế nào thì tùy các bạn. Giờ thì nghe nhạc nhé.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'pickup',
    label: 'Đón ở đâu',
    line: id('c03'),
    answer: 'loom',
    options: [
      { value: 'loom', label: 'Trước xưởng thiết kế Loom' },
      { value: 'lumen', label: 'Trước rạp Lumen' },
      { value: 'ferry', label: 'Ở bến phà' },
    ],
  },
  { key: 'time', label: 'Mấy giờ', line: id('c04'), answer: '', options: [] },
  {
    key: 'look',
    label: 'Nhận ra khách thế nào',
    line: id('c05'),
    answer: 'grey',
    options: [
      { value: 'grey', label: 'Tóc bạc, đeo kính, com-lê xám' },
      { value: 'green', label: 'Tóc bạc, đeo kính, áo len xanh lá' },
      { value: 'fair', label: 'Tóc vàng, áo khoác xanh lá, thắt cà vạt' },
    ],
  },
  {
    key: 'avoid',
    label: 'Tránh đường nào',
    line: id('c07'),
    answer: 'avenue',
    options: [
      { value: 'avenue', label: 'Station Avenue (đại lộ)' },
      { value: 'road', label: 'Station Road' },
      { value: 'bay', label: 'Bay Road' },
    ],
  },
];

// the passenger's way from the Loom to the ferry: four junctions (the car comes to the first heading west along
// Market Street, then south down College Road, east along Arts Street, south down East Road)
const JUNCTIONS: Junction[] = [
  {
    id: 'market-college',
    name: 'Market Street × College Road',
    at: T(74, 16),
    line: id('d1'),
    right: 'left',
    ways: { left: { to: T(74, 22) }, straight: { to: T(68, 16), line: id('d1-straight') }, right: { to: T(74, 9), line: id('d1-right') } },
  },
  {
    id: 'college-arts',
    name: 'College Road × Arts Street',
    at: T(74, 49),
    line: id('d2'),
    right: 'left',
    ways: { left: { to: T(81, 49) }, straight: { to: T(74, 55), line: id('d2-straight') }, right: { to: T(67, 49), line: id('d2-right') } },
  },
  {
    id: 'arts-east',
    name: 'Arts Street × East Road',
    at: T(90, 49),
    line: id('d3'),
    right: 'right',
    ways: { left: { to: T(90, 43), line: id('d3-left') }, right: { to: T(90, 55) } },
  },
  {
    id: 'east-quay',
    name: 'East Road × Quay Street',
    at: T(90, 78),
    line: id('d4'),
    right: 'straight',
    ways: { straight: { to: T(90, 84) }, right: { to: T(83, 78), line: id('d4-quay') } },
  },
];

export const JOB_FERRY: JobDoc = {
  id: 'job-ferry',
  title: 'Cuộn băng của Gus',
  blurb: 'Bayline nghe lén bộ đàm của Rico để cướp khách. Rico gọi điện cho bạn thay vì nói qua bộ đàm.',
  level: 2,
  order: 2,
  opens: ['ct-rico-1'],
  from: 'rico',
  // a side job beside Act I's chain (the M0 sample: docs/gta-plan.md §12)
  side: true,
  lines: LINES,
  facts: [
    { id: 'pickup', label: 'Đón ở đâu', line: id('c03'), consequence: 'wrongPlace', byAction: true },
    { id: 'time', label: 'Mấy giờ', line: id('c04'), consequence: 'late' },
    { id: 'look', label: 'Nhận ra khách thế nào', line: id('c05'), consequence: 'wrongPerson', byAction: true },
    { id: 'avoid', label: 'Tránh đường nào', line: id('c07'), consequence: 'spotted' },
    { id: 'word', label: 'Mật khẩu (nghe lén)', line: id('o05'), consequence: 'password', byAction: true },
  ],
  consequences: {
    wrongPlace: { name: 'Ghi nhầm chỗ đón: không ai đợi ở đó, Rico phải gọi chỉ lại', rejoin: 'Rico nói lại chỗ đón, bạn tới xưởng Loom muộn hơn một chút.' },
    late: { name: 'Ghi nhầm giờ (hoặc tới muộn): ông khách phải đứng chờ', rejoin: 'Ông khách cằn nhằn rồi vẫn lên xe.' },
    wrongPerson: { name: 'Hỏi nhầm người', rejoin: 'Người bị hỏi nhầm đuổi khéo; ông khách vẫn đứng đó.' },
    spotted: { name: 'Ghi nhầm đường cần tránh: xe Bayline bám theo', rejoin: 'Chiếc xe Bayline đỗ lại phía sau; chuyến xe vẫn đi tiếp.' },
    lost: { name: 'Chọn sai đường ở ngã rẽ', rejoin: 'Ông khách chỉ lại, xe quay về ngã rẽ.' },
    nagged: { name: 'Bắt ông khách nhắc lại nhiều quá, ông ấy bực', rejoin: 'Ông vẫn chỉ đường, giọng gắt hơn.' },
    noticed: { name: 'Gus và Odile thấy bạn nghe lén', rejoin: 'Họ thôi nói; bạn vẫn tới hỏi Gus được.' },
    password: { name: 'Không nói được mật khẩu, Gus giữ lại cuộn băng', rejoin: 'Rico sẽ tự đi lấy; bản tin đổi theo.' },
  },
  failed: 'password',
  steps: [
    // beat 1: Rico phones, the learner writes it down
    { kind: 'notebook', call: ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08'].map(id), entries: NOTEBOOK },
    // beat 2: the pickup the learner noted; then the passenger's way, junction by junction
    {
      kind: 'pickup',
      entry: 'pickup',
      places: { loom: 'vivian', lumen: 'iris', ferry: 'odile' },
      place: 'vivian',
      wrongPlace: { lines: [id('w01'), id('w02')], consequence: 'wrongPlace' },
      crowd: ['vivian', 'finch', 'colin', 'priya', 'hana'],
      passenger: 'whitlock',
      notMe: { finch: [id('x-finch')], colin: [id('x-colin')], priya: [id('x-priya')], hana: [id('x-hana')], vivian: [id('x-vivian')] },
      wrongPerson: 'wrongPerson',
      callOut: { after: 2, line: id('k00') },
      greet: [{ line: id('p02'), if: { any: [{ note: 'time', is: 'wrong' }, { flag: 'late' }] } }, id('p01'), { line: id('p03'), if: { note: 'avoid', is: 'wrong' } }],
    },
    {
      kind: 'ride',
      place: 'odile',
      junctions: JUNCTIONS,
      lost: 'lost',
      again: { line: id('again'), patience: 2, consequence: 'nagged' },
      near: [id('d5')],
      arrive: { right: [id('a01')] },
    },
    // beat 3: Rico again; the two at the big wheel; the password
    { kind: 'phone', lines: ['r01', 'r02', 'r03', 'r04', 'r05', 'r06'].map(id) },
    { kind: 'overhear', at: 'fay', who: ['gus', 'odile'], lines: ['o01', 'o02', 'o03', 'o04', 'o05', 'o06', 'o07'].map(id), passes: 4, noticed: { line: id('n01'), consequence: 'noticed' }, word: id('o05') },
    { kind: 'password', who: 'gus', line: id('o05'), chunk: 'out of order', ask: id('k01'), right: id('k02'), close: id('k03'), wrong: id('k04'), consequence: 'password' },
  ],
  ending: { clean: [id('e-clean1'), id('e-clean2')], messy: [id('e-messy1'), id('e-messy2')], broken: [id('e-broken1'), id('e-broken2')] },
  news: { clean: [id('f-clean1'), id('f-clean2'), id('f-clean3')], messy: [id('f-messy1'), id('f-messy2'), id('f-messy3')], broken: [id('f-messy1'), id('f-messy2'), id('f-messy3')], none: [id('f-none1'), id('f-none2'), id('f-none3')] },
};
