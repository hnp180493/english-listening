// Act I, job 6: "Ba kênh" (docs/gta-story.md §4, job 6). Mei's method (ct-mei-2: one question only family can
// answer) turned on Bayline: three radio channels each carry a pickup that does not exist, a different spot on each;
// wherever a Bayline car turns up, that is the channel Duncan Kemp listens to. Rico says his on the firm's channel,
// Gus his on the harbour gate's (the one the Harbour Trust uses), Captain Odile hers on the ferry office's. The
// learner writes down who said where, watches Gus's spot (Tess and Theo watch the other two, where the learner TELLS
// them to), and the car comes to the Bay FM stage by the big wheel: Kemp hears the Trust's own channel. Jun needs the
// driver's words, typed; Mrs Delaney hears it and wants to catch him properly before the hearing.
//
// As written, against the outline (docs/gta-story.md §8 "As written"):
//   - the three spots are places on Westbay's map with canon look-alikes (data/city/taxiFares.ts): the Lumen / the
//     Loom, the stage / the station, the pharmacy / the ferry; the outline's "Bay Street by the jetty" and "Fountain
//     Lane" are not places;
//   - Sam is not a spotter: Theo is (a town resident in a job would need clips, and jobs play the browser's voice
//     only: core/town/jobVoice.ts); nobody of the town speaks, no clips;
//   - the driver's words are typed at Jun's stall (the password step needs somebody standing in the world).
// New speakers (core/town/sceneTypes.ts SCENE_VOICES): `delaney` (Harbour Trust, on the phone), `driver` (a Bayline
// driver, heard at the stage). Places: data/cityWorld.ts.

import type { JobLine, NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-channels-${key}`;

const LINES: readonly JobLine[] = [
  // ── beat 1: Mei's stall, the trap ──
  { id: id('c01'), who: 'jun', text: 'Right. Three radios, three channels, and one question only Kemp can answer.', vi: 'Rồi. Ba cái bộ đàm, ba kênh, và một câu hỏi chỉ Kemp trả lời được.' },
  { id: id('c02'), who: 'mei', text: 'Like my false grandson. You ask what only family would know.', vi: 'Giống thằng cháu giả của bà. Hỏi điều chỉ người nhà mới biết.' },
  { id: id('c03'), who: 'jun', text: "Each channel gets a pickup that doesn't exist. A different spot on each.", vi: 'Mỗi kênh nhận một cuốc đón không có thật. Mỗi kênh một chỗ khác nhau.' },
  { id: id('c04'), who: 'jun', text: "Wherever Bayline turns up, that's the channel Kemp's been listening to.", vi: 'Bayline mò tới chỗ nào, thì đó là kênh Kemp vẫn đang nghe.' },
  { id: id('c05'), who: 'tess', text: 'And if they turn up nowhere at all?', vi: 'Thế nếu chẳng chỗ nào có chúng thì sao?' },
  { id: id('c06'), who: 'mei', text: "Then I've wasted a lot of dumplings on you lot.", vi: 'Thì bà phí cả đống há cảo cho lũ các cháu.' },
  { id: id('c07'), who: 'jun', text: 'Write down who says what. Exactly. Every word counts tonight.', vi: 'Ghi lại ai nói gì. Thật chính xác. Tối nay chữ nào cũng quan trọng.' },
  // the three channels, each said once
  { id: id('n00'), who: 'jun', text: "Here they come. Rico's channel first, then the gate, then the ferry office.", vi: 'Tới rồi. Kênh của Rico trước, rồi kênh cổng cảng, rồi kênh văn phòng bến phà.' },
  { id: id('n01'), who: 'rico', text: 'One to all. Pick-up outside the Lumen at half nine. Over.', vi: 'Một gọi tất cả. Đón khách trước rạp Lumen lúc chín rưỡi. Hết.' },
  { id: id('n02'), who: 'gus', text: 'Gate to all. Fare waiting at the Bay FM stage, by the big wheel.', vi: 'Cổng gọi tất cả. Có khách chờ ở sân khấu Bay FM, cạnh vòng đu quay.' },
  { id: id('n03'), who: 'odile', text: "Ferry office here. Somebody's after a taxi at the pharmacy. Half nine.", vi: 'Văn phòng bến phà đây. Có người cần taxi ở nhà thuốc. Chín rưỡi.' },
  { id: id('n01r'), who: 'rico', text: 'The Lumen. The cinema on Arts Street. Half nine.', vi: 'Rạp Lumen. Rạp chiếu phim trên Arts Street. Chín rưỡi.' },
  { id: id('n02r'), who: 'gus', text: 'The stage. The open-air one, right next to the wheel.', vi: 'Sân khấu. Cái sân khấu ngoài trời, ngay cạnh vòng đu quay.' },
  { id: id('n03r'), who: 'odile', text: "The pharmacy. Nell's place, up by the hospital.", vi: 'Nhà thuốc. Chỗ cô Nell, trên gần bệnh viện.' },
  { id: id('n04'), who: 'jun', text: "On a real night nobody says it twice, you know.", vi: 'Tối thật thì chẳng ai nói hai lần đâu.' },
  // who watches where
  { id: id('j01'), who: 'jun', text: "Tess takes Rico's spot. Theo's got the ferry office's. Tell them where.", vi: 'Tess canh chỗ của kênh Rico. Theo canh chỗ của kênh bến phà. Bạn bảo họ đứng đâu.' },
  { id: id('j02'), who: 'jun', text: "And you take Gus's. That's the one I'd put my money on.", vi: 'Còn bạn canh chỗ của kênh Gus. Tôi mà cá thì cá vào kênh đó.' },
  { id: id('j03'), who: 'tess', text: 'Half nine. Phones on, mouths shut. Good luck, everyone.', vi: 'Chín rưỡi. Bật điện thoại, ngậm miệng. Chúc mọi người may mắn.' },
  { id: id('j06'), who: 'mei', text: 'Take a dumpling each. Nobody listens well on an empty stomach.', vi: 'Mỗi đứa cầm một cái há cảo. Bụng đói thì chẳng ai nghe cho ra hồn.' },
  { id: id('r02'), who: 'kit', text: 'And the big wheel shuts at eleven tonight, Fay tells us.', vi: 'Và tối nay vòng đu quay đóng cửa lúc mười một giờ, Fay cho biết.' },
  { id: id('r01'), who: 'kit', text: 'Bay FM traffic. Quiet roads round the harbour tonight. Enjoy it while it lasts.', vi: 'Giao thông Bay FM. Tối nay đường quanh cảng vắng. Tranh thủ tận hưởng đi.' },
  // beat 3: the right spot, the car comes
  { id: id('d01'), who: 'driver', text: 'Evening. Taxi for the gate? Somebody rang for a cab from the gate.', vi: 'Chào. Taxi cho cổng cảng phải không? Có người gọi xe từ cổng cảng.' },
  { id: id('d02'), who: 'driver', text: "Funny. Nobody here. The boss said there'd definitely be a fare.", vi: 'Lạ thật. Chẳng có ai. Sếp bảo chắc chắn có khách mà.' },
  { id: id('d03'), who: 'driver', text: 'Never mind. Forget you saw me, alright?', vi: 'Thôi kệ. Coi như chưa thấy tôi nhé?' },
  // … or the wrong one: Gus sees it
  { id: id('w00'), who: 'okafor', text: "A taxi? Nobody's waiting for one here, dear. Only for trains.", vi: 'Taxi á? Ở đây chẳng ai chờ taxi đâu cháu. Chỉ chờ tàu thôi.' },
  { id: id('w00b'), who: 'kit', text: "A fare? Not here. Nobody's left this studio for hours.", vi: 'Khách đi taxi á? Không có ở đây đâu. Mấy tiếng rồi chẳng ai rời phòng thu.' },
  { id: id('w01'), who: 'gus', text: "Gate here. There's a Bayline car sitting at the stage, by the wheel.", vi: 'Cổng đây. Có một xe Bayline đang đậu ở sân khấu, cạnh vòng đu quay.' },
  { id: id('w02'), who: 'gus', text: 'The driver keeps asking round. Taxi for the gate, he says. Taxi for the gate.', vi: 'Tay tài xế cứ hỏi quanh. Taxi cho cổng cảng, hắn bảo. Taxi cho cổng cảng.' },
  { id: id('w03'), who: 'gus', text: "He's driving off now. You missed him by a minute.", vi: 'Hắn chạy đi rồi. Bạn lỡ hắn đúng một phút.' },
  // the spotters ring
  { id: id('t01'), who: 'tess', text: "Lumen's dead quiet. Wren's selling tickets, and that's it.", vi: 'Rạp Lumen im ru. Wren đang bán vé, thế thôi.' },
  { id: id('t02'), who: 'tess', text: "I'm outside the Loom. Was it the Loom? I can't swear to it now.", vi: 'Tôi đang đứng trước xưởng Loom. Có phải Loom không nhỉ? Giờ tôi không dám chắc.' },
  { id: id('t03'), who: 'tess', text: "I'm at Bo's, and someone inside is singing very badly. Was it Bo's?", vi: 'Tôi đang ở quán Bo, có người trong đó hát dở tệ. Có phải quán Bo không?' },
  { id: id('j04'), who: 'jun', text: "Then we can't clear Rico's channel. He'll have to change it again.", vi: 'Thế thì chưa rửa được kênh của Rico. Anh ấy sẽ phải đổi kênh lần nữa.' },
  { id: id('th01'), who: 'theo', text: "Nothing at the pharmacy. Nell's locking up. She asked if I'm ill.", vi: 'Ở nhà thuốc chẳng có gì. Nell đang khóa cửa. Cô ấy hỏi tôi có ốm không.' },
  { id: id('th02'), who: 'theo', text: "I'm at the ferry office, and Odile's giving me a very long look.", vi: 'Tôi đang ở văn phòng bến phà, và bà Odile đang nhìn tôi rất lâu.' },
  { id: id('o01'), who: 'odile', text: 'If you think my office leaks, you can say it to my face.', vi: 'Nếu các cậu nghĩ văn phòng tôi để lọt tin, thì cứ nói thẳng vào mặt tôi.' },
  { id: id('th03'), who: 'theo', text: "I'm outside the hospital. Somebody's just asked me if I'm lost.", vi: 'Tôi đang đứng trước bệnh viện. Có người vừa hỏi tôi có bị lạc không.' },
  { id: id('j05'), who: 'jun', text: "Then the ferry office isn't cleared. Odile won't like that one bit.", vi: 'Thế thì văn phòng bến phà chưa được rửa. Bà Odile sẽ chẳng ưa chút nào.' },
  // the words, typed at Jun's stall
  { id: id('p00'), who: 'jun', text: "Over here, by the soldering iron. Tell me what you heard.", vi: 'Đằng này, cạnh cái mỏ hàn. Kể tôi nghe bạn nghe được gì.' },
  { id: id('p01'), who: 'jun', text: 'What did the driver say, exactly? Word for word, please.', vi: 'Tay tài xế nói gì, chính xác ấy? Từng chữ một nhé.' },
  { id: id('p02'), who: 'jun', text: 'Taxi for the gate. Only Gus ever says gate on the radio.', vi: 'Taxi cho cổng cảng. Chỉ có Gus mới nói chữ cổng trên bộ đàm.' },
  { id: id('p03'), who: 'jun', text: 'Nearly. Think about it. What did he ask for?', vi: 'Gần đúng rồi. Nghĩ lại xem. Hắn hỏi xe cho ai?' },
  { id: id('p04'), who: 'jun', text: "Never mind. Gus heard him too. We'll use Gus's word for it.", vi: 'Thôi kệ. Gus cũng nghe thấy. Mình dùng lời của Gus vậy.' },
  // beat 4: Mrs Delaney rings
  { id: id('x01'), who: 'delaney', text: "Mrs Delaney here. Jun's told me everything. That's our channel. The Trust's own.", vi: 'Delaney đây. Jun kể tôi nghe hết rồi. Đó là kênh của chúng tôi. Của chính Ban quản lý cảng.' },
  { id: id('x02'), who: 'delaney', text: 'We talk about the bids on it. Every single day.', vi: 'Ngày nào chúng tôi cũng bàn chuyện hồ sơ thầu trên kênh đó.' },
  { id: id('x03'), who: 'delaney', text: 'Could you swear to it, if I needed you to?', vi: 'Nếu tôi cần, bạn có dám đứng ra làm chứng không?' },
  { id: id('x04a'), who: 'player', text: 'Yes. I saw the car with my own eyes.', vi: 'Có. Tôi thấy chiếc xe tận mắt.' },
  { id: id('x04b'), who: 'player', text: 'Gus saw it. I only heard about it.', vi: 'Gus thấy. Tôi chỉ nghe kể lại.' },
  { id: id('x04c'), who: 'player', text: 'Swear to it where, exactly?', vi: 'Làm chứng ở đâu cơ ạ?' },
  { id: id('x05a'), who: 'delaney', text: "Good. Then I'll want you there on the day.", vi: 'Tốt. Vậy hôm đó tôi muốn bạn có mặt.' },
  { id: id('x05b'), who: 'delaney', text: "Honest. That's worth more than you'd think, in my job.", vi: 'Thật thà. Trong nghề của tôi, cái đó quý hơn bạn tưởng.' },
  { id: id('x05c'), who: 'delaney', text: 'At the hearing. In front of Mr Kemp, I mean.', vi: 'Ở phiên xét hồ sơ. Ý tôi là ngay trước mặt ông Kemp.' },
  { id: id('x06'), who: 'delaney', text: "Listening isn't proof. I want to catch him using what he heard.", vi: 'Nghe lén chưa phải bằng chứng. Tôi muốn bắt quả tang hắn dùng điều hắn nghe được.' },
  // the last word, by grade
  { id: id('e1'), who: 'rico', text: 'Three channels, three spots, one car. And you saw it with your own eyes.', vi: 'Ba kênh, ba chỗ, một chiếc xe. Mà bạn còn thấy tận mắt.' },
  { id: id('e2'), who: 'rico', text: 'Kemp listens to the Trust. And now the Trust knows it.', vi: 'Kemp nghe lén Ban quản lý cảng. Và giờ Ban biết chuyện đó.' },
  { id: id('e3'), who: 'rico', text: "We got there. Not every channel's cleared, but we got there.", vi: 'Cũng xong. Chưa rửa được hết các kênh, nhưng cũng xong.' },
  { id: id('e4'), who: 'mei', text: "Next time, write it down slower, dear. Dumplings don't run away.", vi: 'Lần sau ghi chậm thôi cháu. Há cảo có chạy đi đâu.' },
  { id: id('e5'), who: 'rico', text: "Well, we know one thing. Bayline came. We just didn't see much of it.", vi: 'Thôi, mình biết được một điều. Bayline có tới. Chỉ là mình chẳng thấy được mấy.' },
  { id: id('e6'), who: 'rico', text: "Delaney believes Jun, and that's enough for tonight.", vi: 'Bà Delaney tin Jun, thế là đủ cho tối nay.' },
  // Bay FM, by how it ended
  { id: id('f1'), who: 'kit', text: 'A quiet night on the harbour, except for one taxi with no fare.', vi: 'Một đêm yên ả ở cảng, trừ một chiếc taxi không có khách.' },
  { id: id('f2'), who: 'kit', text: 'It waited at the stage for ten minutes, then it drove off.', vi: 'Nó đợi ở sân khấu mười phút, rồi chạy mất.' },
  { id: id('f3'), who: 'kit', text: 'Odd reports tonight of people standing outside shops, watching nothing at all.', vi: 'Tối nay có tin lạ về mấy người đứng trước cửa hàng, nhìn vào khoảng không.' },
  { id: id('f4'), who: 'kit', text: 'Bay FM traffic, brought to you by Bayline. All quiet. Goodnight, Westbay.', vi: 'Giao thông Bay FM, do Bayline tài trợ. Mọi thứ yên ổn. Chúc Westbay ngủ ngon.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'rico',
    label: 'Kênh của Rico: đón ở đâu',
    line: id('n01'),
    answer: 'lumen',
    options: [
      { value: 'lumen', label: 'Trước rạp Lumen' },
      { value: 'loom', label: 'Trước xưởng Loom' },
      { value: 'bos', label: "Trước quán karaoke Bo's" },
    ],
  },
  {
    key: 'gate',
    label: 'Kênh cổng cảng (Gus): đón ở đâu',
    line: id('n02'),
    answer: 'stage',
    options: [
      { value: 'stage', label: 'Sân khấu Bay FM, cạnh vòng đu quay' },
      { value: 'station', label: 'Ga trung tâm' },
      { value: 'studio', label: 'Phòng thu Bay FM trên Arts Street' },
    ],
  },
  {
    key: 'ferry',
    label: 'Kênh bến phà (Odile): đón ở đâu',
    line: id('n03'),
    answer: 'pharmacy',
    options: [
      { value: 'pharmacy', label: 'Nhà thuốc' },
      { value: 'ferry', label: 'Bến phà' },
      { value: 'hospital', label: 'Bệnh viện Westbay' },
    ],
  },
];

const GATE = (v: string) => ({ note: 'gate', value: v });
const RICO = (v: string) => ({ note: 'rico', value: v });
const FERRY = (v: string) => ({ note: 'ferry', value: v });
const SAW = { note: 'gate', is: 'right' as const };
const MISSED = { note: 'gate', is: 'wrong' as const };

export const JOB_CHANNELS: JobDoc = {
  id: 'job-channels',
  title: 'Ba kênh',
  blurb: 'Bà Mei bày một cái bẫy: ba kênh bộ đàm, ba cuốc đón không có thật. Bayline mò tới chỗ nào thì biết Kemp nghe kênh nào.',
  level: 3,
  order: 7,
  opens: ['ct-rico-1'],
  after: 'job-delaney',
  from: 'jun',
  lines: LINES,
  facts: [
    { id: 'rico', label: 'Kênh của Rico nói đón ở đâu', line: id('n01'), consequence: 'ricoUnclear' },
    { id: 'gate', label: 'Kênh cổng cảng nói đón ở đâu', line: id('n02'), consequence: 'missed' },
    { id: 'ferry', label: 'Kênh bến phà nói đón ở đâu', line: id('n03'), consequence: 'odileHurt' },
  ],
  consequences: {
    ricoUnclear: { name: 'Bảo Tess canh nhầm chỗ: chưa rửa được kênh của Rico', rejoin: 'Rico đổi kênh lần nữa; kết quả ở kênh cổng cảng vẫn đứng.' },
    missed: { name: 'Canh nhầm chỗ: không thấy tận mắt xe Bayline, chỉ nghe Gus kể', rejoin: 'Gus thấy xe và nghe được lời tay tài xế; bẫy vẫn thành.' },
    odileHurt: { name: 'Bảo Theo canh nhầm chỗ: chưa rửa được kênh bến phà, bà Odile phật ý', rejoin: 'Kết quả ở kênh cổng cảng vẫn đứng; Odile sẽ nguôi.' },
    noWords: { name: 'Không gõ lại được lời tay tài xế', rejoin: 'Jun dùng lời Gus thuật lại.' },
  },
  steps: [
    // beat 1: Mei's stall
    { kind: 'goto', place: 'mei', label: 'Tới sạp há cảo của bà Mei ở chợ đêm' },
    { kind: 'scene', at: 'mei', who: ['jun', 'mei', 'tess'], lines: ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07'].map(id) },
    {
      kind: 'notebook',
      call: ['n00', 'n01', 'n02', 'n03'].map(id),
      via: 'radio',
      entries: NOTEBOOK,
      repeat: { rico: [id('n01r')], gate: [id('n02r')], ferry: [id('n03r')] },
      patience: { after: 2, line: id('n04') },
    },
    { kind: 'scene', at: 'mei', who: ['jun', 'tess'], lines: ['j01', 'j02', 'j06', 'j03'].map(id) },
    // beat 2: to the spot noted for Gus's channel
    { kind: 'radio', lines: [id('r01'), id('r02')] },
    { kind: 'goto', place: 'marcus', label: 'Tới chỗ bạn đã ghi cho kênh cổng cảng', if: GATE('stage') },
    { kind: 'goto', place: 'okafor', label: 'Tới chỗ bạn đã ghi cho kênh cổng cảng', if: GATE('station') },
    { kind: 'goto', place: 'kit', label: 'Tới chỗ bạn đã ghi cho kênh cổng cảng', if: GATE('studio') },
    // beat 3: the car comes to the stage; at the wrong spot, Gus sees it and says so
    { kind: 'scene', at: 'marcus', who: ['driver', 'fay'], lines: ['d01', 'd02', 'd03'].map(id), if: SAW },
    { kind: 'scene', at: 'okafor', who: ['okafor'], lines: [id('w00')], if: GATE('station') },
    { kind: 'scene', at: 'kit', who: ['kit'], lines: [id('w00b')], if: GATE('studio') },
    { kind: 'radio', lines: ['w01', 'w02', 'w03'].map(id), if: MISSED },
    // the spotters ring from where the learner told them to stand
    {
      kind: 'phone',
      lines: [
        { line: id('t01'), if: RICO('lumen') },
        { line: id('t02'), if: RICO('loom') },
        { line: id('t03'), if: RICO('bos') },
        { line: id('j04'), if: { note: 'rico', is: 'wrong' } },
        { line: id('th01'), if: FERRY('pharmacy') },
        { line: id('th02'), if: FERRY('ferry') },
        { line: id('o01'), if: FERRY('ferry') },
        { line: id('th03'), if: FERRY('hospital') },
        { line: id('j05'), if: { note: 'ferry', is: 'wrong' } },
      ],
    },
    // the driver's words, typed to Jun
    { kind: 'goto', place: 'jun', label: 'Tới sạp của Jun kể lại' },
    { kind: 'scene', at: 'jun', who: ['jun'], lines: [id('p00')] },
    { kind: 'password', who: 'jun', line: id('d01'), chunk: 'taxi for the gate', ask: id('p01'), right: id('p02'), close: id('p03'), wrong: id('p04'), consequence: 'noWords' },
    // beat 4: Mrs Delaney
    { kind: 'phone', lines: ['x01', 'x02'].map(id) },
    {
      kind: 'intent',
      who: 'delaney',
      ask: [id('x03')],
      options: [
        { label: 'Có, tôi thấy tận mắt', say: id('x04a'), reply: [id('x05a')], flag: 'witness' },
        { label: 'Nói thật: Gus thấy, tôi chỉ nghe kể', say: id('x04b'), reply: [id('x05b')] },
        { label: 'Hỏi làm chứng ở đâu', say: id('x04c'), reply: [id('x05c')] },
      ],
    },
    { kind: 'phone', lines: [id('x06')] },
  ],
  ending: {
    clean: [id('e1'), id('e2')],
    messy: [id('e3'), id('e4')],
    broken: [id('e5'), id('e6')],
  },
  news: {
    clean: [id('f1'), id('f2')],
    messy: [id('f3')],
    broken: [id('f4')],
  },
};
