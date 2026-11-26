// Act I, job 4: "Ba chữ một lần" ("Three words at a time", docs/gta-story.md §4 job 4). Last night Bay FM's traffic
// news said "delays at the harbour gate" and nothing was there; tonight there will be. Rico wants to know who writes
// the news. Sam sits in the driver's seat of the no. 9 in the bus yard by the station, sees the whole taxi rank, and
// for once has to use the phone: he directs the learner after a Bayline car, three words at a time. At Bay FM's back
// door Shona hands Kit the news, typed; heard, it sends the learner to Gus before Bayline's cars block his gate.
//
// Changed from the outline (listed in docs/gta-plan.md §14 too):
//   - Rico briefs the learner at the taxi rank in person (notebook via 'scene'); the car is watched from the station,
//     where Sam's bus stands, and leaves at the game's clock said "ten past / ten to" (JobDoc clock 'ten'): the
//     look-alikes are ten past H / ten to H / ten past H+1;
//   - "car nine, not the bus": the third look-alike is the no. 9 bus itself;
//   - "a bus length behind": the third way is "a block behind";
//   - the tail is four junctions where the car stops and the learner picks the way by Sam's words (as in "Cuộn băng
//     của Gus"): left at the taxi rank's corner, right into Market Street, right AFTER the bakery (not at it: there is
//     no road at the bakery), right into Arts Street; a wrong way is Sam's "No. Other right." and the car turns back;
//   - Shona's "at eight" is "in half an hour" (the game's clock runs on), and getting to Gus is a walk with a minute
//     on it; a wrong answer to Rico about what was heard means nobody warns Gus;
//   - Sam's "Wrong. Car. Sorry." follows a wrong car at once; the overheard talk then starts a line late.
// Sam is of the town ('station'): his lines are clips (connected only), the browser voice until the owner makes them.

import type { Junction, NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-three-${key}`;
const T = (x: number, y: number) => ({ x, y });
const CAR_WRONG = { note: 'car', is: 'wrong' as const };

const LINES = [
  // ── beat 1: the taxi rank ──
  { id: id('a01'), who: 'rico', text: "Last night the news said the harbour gate was jammed. It wasn't.", vi: 'Tối qua bản tin bảo cổng cảng tắc. Có tắc đâu.' },
  { id: id('a02'), who: 'rico', text: "Tonight it will be. I want to know who's writing the news.", vi: 'Tối nay thì sẽ tắc. Tôi muốn biết ai viết bản tin.' },
  { id: id('a03'), who: 'rico', text: 'Sam can see the whole rank from his bus. Today, Sam, you press the button.', vi: 'Từ xe buýt Sam nhìn được cả bến taxi. Hôm nay, Sam, cậu bấm nút gọi đi.' },
  { id: id('a04'), who: 'rico', text: 'Follow the Bayline car. Car nine, not the bus.', vi: 'Bám theo xe Bayline. Xe số chín, không phải xe buýt.' },
  { id: id('a05'), who: 'rico', text: 'It leaves the rank at {time}. Wait by the station.', vi: 'Nó rời bến lúc {time}. Đợi ở chỗ ga.' },
  { id: id('a06'), who: 'rico', text: 'And stay a bus length behind. Not closer, not further.', vi: 'Và giữ cách nó một thân xe buýt. Không gần hơn, không xa hơn.' },
  { id: id('a07'), who: 'station', text: 'I hate the phone. Fine. Three words.', vi: 'Ghét điện thoại lắm. Thôi được. Ba chữ.' },
  { id: id('a04r'), who: 'rico', text: 'Car nine. Nine. The Bayline one, not Sam.', vi: 'Xe số chín. Chín. Xe Bayline, không phải xe của Sam.' },
  { id: id('a06r'), who: 'rico', text: 'One bus length. Like parking behind a bus.', vi: 'Một thân xe buýt. Như đỗ sau đuôi xe buýt ấy.' },
  { id: id('a05r'), who: 'rico', text: "At {time}. On the dot. Bayline's never late.", vi: 'Lúc {time}. Đúng giờ. Bayline không bao giờ trễ.' },
  { id: id('a08'), who: 'rico', text: "Sam's waving at you from the bus. Last time, then.", vi: 'Sam đang vẫy bạn từ trên xe buýt kìa. Lần cuối nhé.' },
  { id: id('w02'), who: 'station', text: 'Car nine. Moving. Go.', vi: 'Xe chín. Chạy rồi. Đi.' },
  { id: id('w01'), who: 'station', text: 'Here. Go round. Wait.', vi: 'Đây. Đi vòng. Chờ.' },
  { id: id('w-late'), who: 'station', text: 'Gone. Already. Follow. Me.', vi: 'Đi rồi. Từ nãy. Nghe tôi.' },
  { id: id('w-early'), who: 'station', text: 'He saw you. Hang back.', vi: 'Hắn thấy bạn. Lùi lại.' },
  // ── a wrong car ──
  { id: id('c-five'), who: 'station', text: 'Wrong. Car. Sorry.', vi: 'Nhầm. Xe. Xin lỗi.' },
  { id: id('c-five2'), who: 'station', text: "That's a lady. To Gianna's.", vi: 'Xe đó chở một bà. Tới quán Gianna.' },
  { id: id('c-bus'), who: 'station', text: 'Not. The bus. Car.', vi: 'Không phải. Xe buýt. Ô tô.' },
  { id: id('c-back'), who: 'station', text: 'Nine. Turning. Now.', vi: 'Số chín. Đang rẽ. Đi.' },
  // ── beat 2: three words at a time ──
  { id: id('j1'), who: 'station', text: 'Left. Here. Now.', vi: 'Trái. Chỗ này. Ngay.' },
  { id: id('j2'), who: 'station', text: 'Right. Market Street. Now.', vi: 'Phải. Phố Market. Ngay.' },
  { id: id('j3'), who: 'station', text: 'Right after the bakery.', vi: 'Rẽ phải sau tiệm bánh.' },
  { id: id('j4'), who: 'station', text: 'Right. Arts Street. Slow.', vi: 'Phải. Phố Arts. Chậm.' },
  { id: id('x-other'), who: 'station', text: 'No. Other right.', vi: 'Không. Phải kia.' },
  { id: id('x-left'), who: 'station', text: 'No. Other left.', vi: 'Không. Trái kia.' },
  { id: id('x-way'), who: 'station', text: 'Wrong way. Turn round.', vi: 'Sai đường. Quay lại.' },
  { id: id('x-again'), who: 'station', text: 'Said. It. Already.', vi: 'Nói. Rồi. Mà.' },
  { id: id('k-close'), who: 'station', text: 'Too. Close. Mate.', vi: 'Gần. Quá. Đấy.' },
  { id: id('k-far'), who: 'station', text: 'Lost him. Wait. There.', vi: 'Mất dấu. Chờ đã. Kia.' },
  { id: id('k-near'), who: 'station', text: "He's stopping. Bay FM.", vi: 'Hắn dừng. Đài Bay FM.' },
  { id: id('k-arr'), who: 'rico', text: "The back door. Keep your head down and listen.", vi: 'Cửa sau. Cúi đầu xuống mà nghe.' },
  // ── beat 3: Bay FM's back door ──
  { id: id('o01'), who: 'shona', text: "Tonight's traffic, Kit. Typed, so you don't have to think.", vi: 'Bản tin giao thông tối nay, Kit. Đánh máy sẵn, khỏi phải nghĩ.' },
  { id: id('o02'), who: 'kit', text: "Avoid the harbour gate, heavy delays? There's nothing there.", vi: 'Tránh cổng cảng, tắc nặng? Ở đó có gì đâu.' },
  { id: id('o03'), who: 'shona', text: "There will be. Six cars parking on Pier Road in half an hour.", vi: 'Sẽ có. Sáu xe sẽ đỗ trên đường Pier trong nửa tiếng nữa.' },
  { id: id('o04'), who: 'kit', text: "That's not traffic news. That's an advert.", vi: 'Đó đâu phải tin giao thông. Đó là quảng cáo.' },
  { id: id('o05'), who: 'shona', text: 'Read the contract, Kit. Bayline pays for the whole night show.', vi: 'Đọc hợp đồng đi, Kit. Bayline trả tiền cho cả chương trình đêm.' },
  { id: id('o06'), who: 'kit', text: 'Fine. Fine. Give it here.', vi: 'Thôi được. Được rồi. Đưa đây.' },
  { id: id('o07'), who: 'kit', text: 'And who writes this stuff, Shona?', vi: 'Mà ai viết mấy thứ này vậy, Shona?' },
  { id: id('o08'), who: 'shona', text: 'Head office. Same as always. Smile when you read it.', vi: 'Văn phòng chính. Như mọi khi. Đọc thì nhớ cười lên.' },
  { id: id('o09'), who: 'kit', text: "It's radio, Shona. Nobody can see me smile.", vi: 'Đây là radio mà, Shona. Ai thấy tôi cười đâu.' },
  { id: id('o-seen'), who: 'shona', text: 'Kit, shut the door. Somebody is listening.', vi: 'Kit, đóng cửa lại. Có người đang nghe.' },
  // ── what was heard ──
  { id: id('i01'), who: 'rico', text: 'Well? What did they say?', vi: 'Sao? Họ nói gì?' },
  { id: id('i01a'), who: 'player', text: 'Six Bayline cars on Pier Road in half an hour.', vi: 'Sáu xe Bayline trên đường Pier trong nửa tiếng nữa.' },
  { id: id('i01b'), who: 'player', text: 'Six cars at the station, about half past.', vi: 'Sáu xe ở chỗ ga, tầm rưỡi.' },
  { id: id('i01c'), who: 'player', text: 'Nothing much. Just the traffic news.', vi: 'Chẳng có gì. Chỉ là bản tin giao thông.' },
  { id: id('i02'), who: 'rico', text: "Then tell Gus. He'll open the side gate for us. Run.", vi: 'Vậy báo Gus. Ông ấy sẽ mở cổng phụ cho mình. Chạy đi.' },
  { id: id('i03'), who: 'rico', text: 'Right. Never mind, then. Come back to the rank.', vi: 'Thế à. Thôi vậy. Quay về bến đi.' },
  { id: id('g01'), who: 'gus', text: "Six of them? I'll open the side gate. Rico's lot only.", vi: 'Sáu chiếc á? Tôi mở cổng phụ. Chỉ cho xe của Rico.' },
  { id: id('g02'), who: 'gus', text: "Too late, they're here. Six of them, parked across my gate.", vi: 'Muộn rồi, tụi nó tới rồi. Sáu chiếc, đỗ chắn ngang cổng tôi.' },
  { id: id('g03'), who: 'gus', text: "My gate's jammed solid. Six Bayline cars. Where were you?", vi: 'Cổng tôi tắc cứng. Sáu xe Bayline. Bạn đi đâu thế?' },
  { id: id('g04'), who: 'gus', text: 'Off you go, then. And thanks, mind.', vi: 'Đi đi. Mà cảm ơn nhé.' },
  // ── beat 4 ──
  { id: id('e1'), who: 'station', text: 'That was. Actually fun.', vi: 'Vụ này. Vui thật.' },
  { id: id('e2'), who: 'station', text: "Don't. Tell. Mom.", vi: 'Đừng. Kể. Mẹ.' },
  { id: id('e3'), who: 'rico', text: "Three of my fares went Bayline at the gate. Still. Now we know.", vi: 'Ba khách của tôi sang Bayline ở cổng. Nhưng giờ mình biết rồi.' },
  { id: id('e4'), who: 'rico', text: "Kemp's Shona writes the news. Now we know.", vi: 'Shona của Kemp viết bản tin. Giờ thì biết rồi.' },
  { id: id('e5'), who: 'rico', text: 'Bit of a mess. But we know who writes it.', vi: 'Hơi lộn xộn. Nhưng biết ai viết bản tin rồi.' },
  { id: id('n1'), who: 'kit', text: 'Tonight, avoid the harbour gate. Heavy delays. I am told.', vi: 'Tối nay, tránh cổng cảng. Tắc nặng. Người ta bảo tôi thế.' },
  { id: id('n2'), who: 'kit', text: "That's the traffic, brought to you by Bayline. As always.", vi: 'Bản tin giao thông, do Bayline tài trợ. Như mọi khi.' },
  { id: id('n4'), who: 'kit', text: "Some of tonight's cars, I'm told, went the long way round.", vi: 'Nghe nói tối nay vài chiếc xe phải đi đường vòng.' },
  { id: id('n3'), who: 'kit', text: 'The harbour gate is jammed with cars tonight. Who could have known.', vi: 'Tối nay cổng cảng kẹt xe. Ai mà biết trước được chứ.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'car',
    label: 'Bám xe nào',
    line: id('a04'),
    answer: 'nine',
    options: [
      { value: 'nine', label: 'Xe Bayline số 9' },
      { value: 'five', label: 'Xe Bayline số 5' },
      { value: 'bus', label: 'Xe buýt số 9' },
    ],
  },
  { key: 'time', label: 'Nó rời bến lúc', line: id('a05'), answer: '', options: [] },
  {
    key: 'gap',
    label: 'Giữ khoảng cách',
    line: id('a06'),
    answer: 'length',
    options: [
      { value: 'length', label: 'Cách một thân xe buýt' },
      { value: 'stop', label: 'Cách một trạm xe buýt' },
      { value: 'block', label: 'Cách một dãy nhà' },
    ],
  },
];

// Sam's way after the car: from the station east along Station Avenue, north up Station Road, east along Market Street
// past the bakery, south down Bay Road, west into Arts Street to Bay FM's back door (street names: core/town/streets.ts).
const JUNCTIONS: Junction[] = [
  {
    id: 'rank-corner',
    name: 'Station Avenue × Station Road',
    at: T(18, 30),
    line: id('j1'),
    right: 'left',
    ways: { left: { to: T(18, 24) }, straight: { to: T(24, 30), line: id('x-way') }, right: { to: T(18, 36), line: id('x-left') } },
  },
  {
    id: 'road-market',
    name: 'Station Road × Market Street',
    at: T(18, 15),
    line: id('j2'),
    right: 'right',
    ways: { right: { to: T(24, 15) }, straight: { to: T(18, 9), line: id('x-way') } },
  },
  {
    id: 'after-bakery',
    name: 'Market Street × Bay Road',
    at: T(57, 15),
    line: id('j3'),
    right: 'right',
    ways: { right: { to: T(57, 22) }, straight: { to: T(63, 15), line: id('x-way') }, left: { to: T(57, 9), line: id('x-other') } },
  },
  {
    id: 'bay-arts',
    name: 'Bay Road × Arts Street',
    at: T(57, 49),
    line: id('j4'),
    right: 'right',
    ways: { right: { to: T(51, 49) }, straight: { to: T(57, 55), line: id('x-way') }, left: { to: T(63, 49), line: id('x-other') } },
  },
];

export const JOB_THREE: JobDoc = {
  id: 'job-three',
  title: 'Ba chữ một lần',
  blurb: 'Ai viết bản tin giao thông của Bay FM? Sam ngồi trên xe buýt chỉ đường qua điện thoại, ba chữ một lần.',
  level: 2,
  order: 5,
  opens: ['ct-rico-1'],
  after: 'job-chip',
  from: 'rico',
  clock: 'ten',
  lines: LINES,
  facts: [
    { id: 'car', label: 'Bám xe nào', line: id('a04'), consequence: 'wrongCar' },
    { id: 'time', label: 'Nó rời bến lúc', line: id('a05'), consequence: 'late', early: 'spotted' },
    { id: 'gap', label: 'Giữ khoảng cách', line: id('a06'), consequence: 'tooFar' },
    { id: 'gate', label: 'Bao giờ Bayline chắn cổng', line: id('o03'), consequence: 'jam', byAction: true },
  ],
  consequences: {
    wrongCar: { name: 'Bám nhầm xe', rejoin: 'Sam chỉ sang xe đúng đang rẽ; bạn tới đài muộn, mất câu đầu.' },
    late: { name: 'Ghi giờ muộn (hoặc tới muộn): xe đã rời bến', rejoin: 'Sam bảo cứ nghe theo cậu; vẫn bám được.' },
    spotted: { name: 'Ghi giờ sớm: đứng chờ ngay trong tầm mắt tài xế Bayline', rejoin: 'Tài xế đi vòng; bạn bám từ xa hơn.' },
    tooFar: { name: 'Ghi "cách một trạm": bám xa quá, mất dấu một lần', rejoin: 'Sam tìm lại chiếc xe cho bạn.' },
    lost: { name: 'Rẽ sai theo lời Sam', rejoin: 'Sam nói lại, xe quay về ngã rẽ.' },
    nagged: { name: 'Bắt Sam nhắc lại nhiều quá', rejoin: 'Sam vẫn chỉ đường, cụt hơn nữa.' },
    noticed: { name: 'Shona thấy bạn ở cửa sau', rejoin: 'Kit đóng cửa; câu cần nghe có thể đã lọt tai.' },
    jam: { name: 'Không báo kịp Gus: sáu xe Bayline chắn cổng cảng', rejoin: 'Ba khách của Rico đi Bayline; mọi người vẫn về được.' },
  },
  steps: [
    { kind: 'goto', place: 'rico', label: 'Tới bến taxi gặp Rico' },
    // beat 1: Rico at the rank, Sam on the phone from his bus
    { kind: 'notebook', via: 'scene', call: ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07'].map(id), entries: NOTEBOOK, repeat: { car: [id('a04r')], time: [id('a05r')], gap: [id('a06r')] }, patience: { after: 3, line: id('a08') } },
    {
      kind: 'goto',
      place: 'okafor',
      label: 'Tới chỗ ga, chờ xe Bayline rời bến',
      deadline: { consequence: 'late', lines: [id('w-late')] },
    },
    { kind: 'phone', lines: [id('w01'), { line: id('w-early'), if: { note: 'time', is: 'early' } }, id('w02')] },
    // the wrong car: Sam sees it at once
    { kind: 'phone', lines: [{ line: id('c-five'), if: { note: 'car', value: 'five' } }, { line: id('c-five2'), if: { note: 'car', value: 'five' } }, { line: id('c-bus'), if: { note: 'car', value: 'bus' } }, id('c-back')], if: CAR_WRONG },
    // beat 2: the tail
    {
      kind: 'ride',
      place: 'kit',
      junctions: JUNCTIONS,
      lost: 'lost',
      again: { line: id('x-again'), patience: 2, consequence: 'nagged' },
      near: [{ line: id('k-close'), if: { note: 'time', is: 'early' } }, { line: id('k-far'), if: { note: 'gap', is: 'wrong' } }, id('k-near')],
      arrive: { right: [id('k-arr')] },
    },
    // beat 3: the back door (late after a wrong car: the start is missed)
    {
      kind: 'overhear',
      at: 'kit',
      who: ['kit', 'shona'],
      lines: ['o01', 'o02', 'o03', 'o04', 'o05', 'o07', 'o08', 'o09', 'o06'].map(id),
      passes: 2,
      word: id('o03'),
      noticed: { line: id('o-seen'), consequence: 'noticed' },
      from: { if: CAR_WRONG, index: 1 },
    },
    {
      kind: 'intent',
      who: 'rico',
      ask: [id('i01')],
      options: [
        { label: 'Sáu xe trên đường Pier, nửa tiếng nữa', say: id('i01a'), reply: [id('i02')], flag: 'warned' },
        { label: 'Sáu xe ở ga, tầm rưỡi', say: id('i01b'), reply: [id('i03')] },
        { label: 'Chẳng có gì, chỉ là bản tin', say: id('i01c'), reply: [id('i03')] },
      ],
      check: { right: 0, consequence: 'jam', fact: 'gate' },
    },
    { kind: 'goto', place: 'gus', label: 'Chạy tới báo Gus', deadline: { seconds: 75, consequence: 'jam', lines: [id('g02')] }, if: { flag: 'warned' } },
    { kind: 'scene', at: 'gus', who: ['gus'], lines: [id('g01'), id('g04')], if: { all: [{ flag: 'warned' }, { not: { hit: 'jam' } }] } },
    // nobody warned him
    { kind: 'phone', lines: [id('g03')], if: { not: { flag: 'warned' } } },
  ],
  ending: {
    clean: [id('e4'), id('e1'), id('e2')],
    messy: [id('e5'), id('e1'), id('e2')],
    broken: [id('e3'), id('e1'), id('e2')],
  },
  news: { clean: [id('n1'), id('n2')], messy: [id('n1'), id('n4'), id('n2')], broken: [id('n3'), id('n2')] },
};
