// Act I, job 8: "Một chữ sai" (docs/gta-story.md §4, job 8; §3 for the act's ending). The Harbour Trust's hearing for
// the old gatehouse. The night before, Gus told the Trust's gate radio a number nobody else knows (the roof needs
// fourteen tiles); Kemp reads his bid aloud first, and one sentence of it carries that number. The learner has to hear
// it and say it, word for word, to Rico. Kemp's bid is struck out under the Trust's own rule; the gatehouse goes to
// "Rico and partner". On the stairs Kemp says he bought warehouse fifteen that morning (Act II's hook; Rico hears
// "fifty" again, as in cs-bigdeal-4). Bayline pulls its money from Bay FM: Marcus's night show ends, and Gus sits in his
// hut with a quiet radio.
//
// As written, against the outline (docs/gta-story.md §8 "As written"):
//   - the trap's detail is a number (fourteen / forty / four tiles), not "the north corner": the "-teen / -ty" pair is
//     the look-alike a careless ear really mixes up; there is no "Đó!" button yet, so the learner goes up to Rico
//     during the reading (or after it) and types the words that gave Kemp away (the password step);
//   - Kemp reads his own letter (the Trust asks each bidder to): the overheard lines need a speaker standing there;
//   - the hearing room upstairs is not on the map: staged at Jun's stall under it ('jun'); the old gatehouse at Gus's;
//   - Sam is not at the door with "Talk. Less. Rico." (a town resident would need clips): Tess and Gus say it;
//   - the file of the firm is read from what earlier jobs left (Cond `past`): job 1's lateness or lost fare, job 7's
//     late references, job 6's witness.
// Canon: Rico misheard "fifteen" as "fifty" (cs-bigdeal-4); warehouse fifteen was never visited (cs-bigdeal-2, -4);
// Gus's twelve-hour nights with Bay FM (ct-gus-1); Rico's drivers Tess and Theo (docs/city.md §15).

import type { JobLine, NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-hearing-${key}`;

const LINES: readonly JobLine[] = [
  // ── beat 1: the gatehouse, the morning of the hearing ──
  { id: id('h01'), who: 'rico', text: 'Good morning, members of the panel. My name is Rico, and ever since I was small...', vi: 'Kính chào quý vị trong hội đồng. Tôi tên Rico, và từ hồi tôi còn bé...' },
  { id: id('h02'), who: 'tess', text: "Stop. Two minutes in, and you're still at primary school.", vi: 'Dừng. Nói hai phút rồi mà anh vẫn còn đang học tiểu học.' },
  { id: id('h03'), who: 'rico', text: "It's called context, Tess. Panels love a bit of context.", vi: 'Cái đó gọi là bối cảnh, Tess. Hội đồng thích bối cảnh lắm.' },
  { id: id('h04'), who: 'gus', text: 'Panels love short. Nobody remembers a long speech. Ask anybody at a wedding.', vi: 'Hội đồng thích ngắn. Chẳng ai nhớ bài nói dài. Cứ hỏi khách ở đám cưới xem.' },
  { id: id('b01'), who: 'tess', text: "Right, listen, because Rico won't. Three things.", vi: 'Rồi, nghe này, vì Rico sẽ chẳng nghe đâu. Ba điều.' },
  { id: id('b02'), who: 'tess', text: "The hearing's at the Trust office, upstairs, over the electronics market on Quay Street.", vi: 'Phiên xét ở văn phòng Ban quản lý cảng, tầng trên chợ đồ điện tử, phố Quay.' },
  { id: id('b03'), who: 'tess', text: 'Kemp reads his letter first. We go second. So we listen first.', vi: 'Kemp đọc thư trước. Mình đọc sau. Nên mình nghe trước.' },
  { id: id('b04'), who: 'gus', text: "And last night I told the Trust's radio the roof needs fourteen tiles.", vi: 'Còn tối qua tôi nói trên bộ đàm của Ban là mái nhà cần mười bốn viên ngói.' },
  { id: id('b05'), who: 'gus', text: 'Nobody else knows that number. Not even a roofer. I made it up.', vi: 'Không ai khác biết con số đó. Thợ lợp mái cũng không. Tôi bịa ra mà.' },
  { id: id('b02r'), who: 'tess', text: 'Quay Street. You say it like key. Over the electronics market.', vi: 'Phố Quay. Đọc như chữ key. Tầng trên chợ đồ điện tử.' },
  { id: id('b03r'), who: 'tess', text: 'Him first, then us. Listen to every word he reads.', vi: 'Hắn trước, mình sau. Nghe từng chữ hắn đọc.' },
  { id: id('b04r'), who: 'gus', text: 'Fourteen. One, four. Fourteen tiles.', vi: 'Mười bốn. Một, bốn. Mười bốn viên ngói.' },
  { id: id('b06'), who: 'tess', text: "I'll say it once more, and after that I'm charging.", vi: 'Tôi nói thêm một lần nữa thôi, sau đó là tính tiền đấy.' },
  // the way, if the room was noted wrong
  { id: id('l01'), who: 'odile', text: "The hearing? It's over the electronics market. Quay Street. Key, like a door key.", vi: 'Phiên xét á? Ở tầng trên chợ đồ điện tử. Phố Quay. Key, như chìa khóa cửa.' },
  { id: id('l02'), who: 'marcus', text: 'Not down here, friend. Upstairs, over the electronics market. Go on, run.', vi: 'Không phải ở đây đâu bạn. Tầng trên chợ đồ điện tử kia. Đi đi, chạy nhanh.' },
  // ── beat 3: the hearing ──
  { id: id('i01'), who: 'delaney', text: 'Two bids for the old gatehouse. Thank you all for coming.', vi: 'Có hai hồ sơ xin trạm gác cũ. Cảm ơn mọi người đã tới.' },
  { id: id('i02'), who: 'kemp', text: 'Morning, Rico. Morning, partner. Lovely day for it.', vi: 'Chào Rico. Chào cộng sự. Hôm nay đẹp trời ghê.' },
  { id: id('i03'), who: 'delaney', text: 'First, a question for each firm about its file.', vi: 'Trước tiên, mỗi hãng một câu hỏi về hồ sơ của mình.' },
  { id: id('i04'), who: 'delaney', text: 'Mr Kemp tells us a car was half an hour late on your first night.', vi: 'Ông Kemp cho biết có một xe trễ nửa tiếng trong tối đầu tiên của các anh.' },
  { id: id('i05'), who: 'delaney', text: 'And that your very first fare went home in a Bayline car.', vi: 'Và khách đầu tiên của các anh đã về bằng xe Bayline.' },
  { id: id('i05b'), who: 'delaney', text: 'And a stall was signed on my bottom step, after half five.', vi: 'Và có một sạp ký trên bậc thang cuối của tôi, sau năm rưỡi.' },
  { id: id('i06'), who: 'delaney', text: 'And your references reached me after twelve. I did let that go.', vi: 'Và thư giới thiệu tới tay tôi sau mười hai giờ. Tôi đã bỏ qua chuyện đó.' },
  { id: id('i07'), who: 'delaney', text: 'And one of you will swear to what was seen at the stage.', vi: 'Và một người trong các anh sẽ làm chứng điều đã thấy ở sân khấu.' },
  { id: id('i08'), who: 'delaney', text: 'So, Rico. How many calls did your firm take last week?', vi: 'Vậy, Rico. Tuần trước hãng của anh nhận bao nhiêu cuộc gọi?' },
  { id: id('i09'), who: 'rico', text: "Cars? Well, there's mine, and Tess has her cart, but that's coffee...", vi: 'Xe à? À, có xe của tôi, Tess thì có xe đẩy, nhưng đó là cà phê...' },
  { id: id('i10'), who: 'rico', text: 'What did she ask? Quick, write it down for me.', vi: 'Bà ấy hỏi gì thế? Nhanh, viết ra cho tôi.' },
  { id: id('i11a'), who: 'player', text: 'Calls, Rico. How many calls last week.', vi: 'Cuộc gọi, Rico. Tuần trước bao nhiêu cuộc gọi.' },
  { id: id('i11b'), who: 'player', text: "She asked how many cars you've got.", vi: 'Bà ấy hỏi anh có bao nhiêu xe.' },
  { id: id('i11c'), who: 'player', text: 'Drivers. She wants to know how many drivers.', vi: 'Tài xế. Bà ấy muốn biết có bao nhiêu tài xế.' },
  { id: id('i12a'), who: 'rico', text: 'Calls! Two hundred and twelve, Mrs Delaney. I write every one down.', vi: 'Cuộc gọi! Hai trăm mười hai, thưa bà Delaney. Cuộc nào tôi cũng ghi lại.' },
  { id: id('i12b'), who: 'rico', text: 'Three cars, Mrs Delaney. Well, one, and two borrowed.', vi: 'Ba xe, thưa bà Delaney. À, một xe, với hai xe đi mượn.' },
  { id: id('i12c'), who: 'rico', text: "Drivers? Me, Tess on Sundays, and Theo when the ferry's quiet.", vi: 'Tài xế à? Tôi, Tess vào Chủ nhật, và Theo khi bến phà vắng.' },
  { id: id('i13'), who: 'delaney', text: 'I asked about calls, Rico. Calls on the phone.', vi: 'Tôi hỏi về cuộc gọi, Rico. Cuộc gọi điện thoại ấy.' },
  { id: id('i14'), who: 'rico', text: 'Calls. Right. Two hundred and twelve. Sorry. I talk.', vi: 'Cuộc gọi. Phải rồi. Hai trăm mười hai. Xin lỗi. Tôi hay nói.' },
  { id: id('i15'), who: 'delaney', text: 'Thank you. Now the letters. Mr Kemp, read yours aloud, please.', vi: 'Cảm ơn. Giờ tới thư. Ông Kemp, mời ông đọc to thư của mình.' },
  // Kemp's letter, read aloud
  { id: id('k01'), who: 'kemp', text: 'To the Harbour Trust. Bayline wishes to lease the old gatehouse.', vi: 'Kính gửi Ban quản lý cảng. Bayline mong được thuê trạm gác cũ.' },
  { id: id('k02'), who: 'kemp', text: 'We would use it as a small office for our harbour drivers.', vi: 'Chúng tôi sẽ dùng nó làm một văn phòng nhỏ cho tài xế ở cảng.' },
  { id: id('k03'), who: 'kemp', text: 'Bayline has served Westbay for ten years, with very few complaints.', vi: 'Bayline đã phục vụ Westbay mười năm, rất ít bị phàn nàn.' },
  { id: id('k04'), who: 'kemp', text: 'We have visited the building, and we like it very much indeed.', vi: 'Chúng tôi đã tới xem tòa nhà, và rất ưng ý.' },
  { id: id('k05'), who: 'kemp', text: 'We have, of course, allowed for the fourteen tiles the roof needs.', vi: 'Tất nhiên, chúng tôi đã tính cả mười bốn viên ngói mà mái nhà cần thay.' },
  { id: id('k06'), who: 'kemp', text: 'We will pay the rent a year ahead, if the Trust prefers.', vi: 'Chúng tôi sẽ trả trước tiền thuê một năm, nếu Ban muốn.' },
  { id: id('k07'), who: 'kemp', text: 'Thank you for your time. Yours sincerely, Duncan Kemp.', vi: 'Cảm ơn quý vị đã dành thời gian. Trân trọng, Duncan Kemp.' },
  { id: id('u01'), who: 'rico', text: "He said fourteen. Was ours fourteen, or forty? I can't remember either.", vi: 'Hắn nói mười bốn. Của mình là mười bốn hay bốn mươi? Tôi cũng chẳng nhớ.' },
  // the words, to Rico
  { id: id('p01'), who: 'rico', text: 'Partner. Which bit was it? Tell me the words, quick.', vi: 'Cộng sự. Câu nào vậy? Nói tôi mấy chữ đó, nhanh.' },
  { id: id('p02'), who: 'rico', text: 'Mrs Delaney. The fourteen tiles. Where did Mr Kemp get that number?', vi: 'Bà Delaney. Mười bốn viên ngói. Ông Kemp lấy con số đó ở đâu ra?' },
  { id: id('p03'), who: 'rico', text: 'Nearly. Which tiles, though? How many did he say?', vi: 'Gần đúng. Nhưng ngói nào? Hắn nói bao nhiêu viên?' },
  { id: id('p04'), who: 'rico', text: "Never mind. Mrs Delaney's frowning at the letter already.", vi: 'Thôi kệ. Bà Delaney đang cau mày nhìn lá thư rồi.' },
  // the room turns
  { id: id('v01'), who: 'delaney', text: 'Our surveyor never counted any tiles. Gus said fourteen once, on our radio.', vi: 'Người khảo sát của chúng tôi chưa hề đếm viên ngói nào. Gus nói mười bốn một lần, trên bộ đàm của chúng tôi.' },
  { id: id('v01b'), who: 'delaney', text: 'One moment. Fourteen tiles? Our surveyor never counted any tiles.', vi: 'Khoan đã. Mười bốn viên ngói? Người khảo sát của chúng tôi chưa hề đếm viên ngói nào.' },
  { id: id('v02'), who: 'delaney', text: 'Gus said that number once, on our gate radio. As a test.', vi: 'Gus nói con số đó đúng một lần, trên bộ đàm cổng cảng. Để thử.' },
  { id: id('v03'), who: 'kemp', text: 'Common knowledge, surely. Harbours are full of talk.', vi: 'Chuyện ai chẳng biết. Ở cảng thì người ta nói đủ thứ.' },
  { id: id('v04'), who: 'delaney', text: 'Nobody else ever heard it. Mr Kemp, your bid is withdrawn.', vi: 'Không ai khác từng nghe nó. Ông Kemp, hồ sơ của ông bị rút.' },
  { id: id('v05'), who: 'kemp', text: 'Then I withdraw it gracefully. I always do.', vi: 'Vậy tôi xin rút một cách đàng hoàng. Tôi lúc nào cũng thế.' },
  { id: id('v06'), who: 'delaney', text: 'The gatehouse goes to Rico, and partner. Your name is on it too.', vi: 'Trạm gác thuộc về Rico, và cộng sự. Tên bạn cũng có trên đó.' },
  { id: id('v07'), who: 'rico', text: 'And partner. Could you say that bit again, please?', vi: 'Và cộng sự. Bà nói lại đoạn đó được không ạ?' },
  // on the stairs
  { id: id('w01'), who: 'kemp', text: 'Enjoy the gatehouse. I bought warehouse fifteen this morning.', vi: 'Tận hưởng cái trạm gác nhé. Sáng nay tôi đã mua kho số mười lăm.' },
  { id: id('w02'), who: 'kemp', text: 'Quiet tender. Nobody else came. Good day, everyone.', vi: 'Đấu thầu lặng lẽ. Chẳng ai khác tới. Chào mọi người.' },
  { id: id('w03'), who: 'rico', text: 'Fifty? Did he just say fifty?', vi: 'Năm mươi? Hắn vừa nói năm mươi à?' },
  { id: id('w04'), who: 'tess', text: 'Fifteen, Rico. One, five. Not again, please.', vi: 'Mười lăm, Rico. Một, năm. Làm ơn đừng nữa.' },
  // the night show ends
  { id: id('m01'), who: 'marcus', text: "This is Marcus, and I'm afraid this is the last night show, for now.", vi: 'Marcus đây, và e là đây là chương trình đêm cuối cùng, ít ra là lúc này.' },
  { id: id('m02'), who: 'marcus', text: "Our sponsor has left us. I won't say who. You can guess.", vi: 'Nhà tài trợ đã rời bỏ chúng tôi. Tôi sẽ không nói là ai. Các bạn đoán được mà.' },
  { id: id('m03'), who: 'marcus', text: "Gus, at the harbour gate. This last one's for you.", vi: 'Gus ở cổng cảng. Bài cuối này dành cho anh.' },
  { id: id('z01'), who: 'gus', text: "Twelve hours a night, and no Marcus. It'll be very quiet.", vi: 'Mười hai tiếng mỗi đêm, mà không có Marcus. Sẽ im ắng lắm.' },
  { id: id('z02'), who: 'rico', text: "Second time in my life I've got nothing to say, Gus.", vi: 'Lần thứ hai trong đời tôi chẳng có gì để nói, Gus ạ.' },
  { id: id('z03'), who: 'gus', text: "Then just sit with me. Quiet's alright, with company.", vi: 'Thế thì ngồi với tôi. Im lặng cũng được, miễn là có bạn.' },
  // the last word, by grade
  { id: id('e1'), who: 'rico', text: 'You heard it. One number in a whole letter, and you heard it.', vi: 'Bạn nghe ra rồi. Một con số trong cả lá thư, và bạn nghe ra.' },
  { id: id('e2'), who: 'rico', text: "Rico and partner. I'm having that painted on the door.", vi: 'Rico và cộng sự. Tôi sẽ cho sơn câu đó lên cửa.' },
  { id: id('e3'), who: 'rico', text: "We won. Not pretty, but we won, and it's ours.", vi: 'Mình thắng. Không đẹp, nhưng thắng, và nó là của mình.' },
  { id: id('e4'), who: 'tess', text: 'And you two owe me eight hundred and a lot of coffee.', vi: 'Còn hai người nợ tôi tám trăm và cả đống cà phê.' },
  { id: id('e5'), who: 'rico', text: 'Delaney caught it, not us. But the gatehouse is ours all the same.', vi: 'Bà Delaney bắt được, không phải mình. Nhưng trạm gác vẫn là của mình.' },
  { id: id('e6'), who: 'rico', text: "Next time we catch him ourselves. There'll be a next time.", vi: 'Lần sau mình tự bắt hắn. Sẽ có lần sau.' },
  // the news, by how it ended
  { id: id('f1'), who: 'kit', text: 'News from the harbour. The old gatehouse has new tenants. Officially, this time.', vi: 'Tin từ cảng. Trạm gác cũ đã có người thuê mới. Lần này là chính thức.' },
  { id: id('f2'), who: 'kit', text: "The Harbour Trust has chosen a firm for the old gatehouse. It wasn't Bayline.", vi: 'Ban quản lý cảng đã chọn được hãng thuê trạm gác cũ. Không phải Bayline.' },
  { id: id('f3'), who: 'kit', text: 'The old gatehouse goes to a small local firm. Bayline did not comment.', vi: 'Trạm gác cũ về tay một hãng nhỏ ở địa phương. Bayline không bình luận.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'room',
    label: 'Phiên xét ở đâu',
    line: id('b02'),
    answer: 'trust',
    options: [
      { value: 'trust', label: 'Văn phòng Ban quản lý cảng, trên chợ đồ điện tử (phố Quay)' },
      { value: 'ferry', label: 'Bến phà (Pier Road)' },
      { value: 'stage', label: 'Sân khấu Bay FM' },
    ],
  },
  {
    key: 'order',
    label: 'Ai đọc thư trước',
    line: id('b03'),
    answer: 'kemp',
    options: [
      { value: 'kemp', label: 'Kemp đọc trước, mình sau' },
      { value: 'us', label: 'Mình đọc trước, Kemp sau' },
      { value: 'delaney', label: 'Bà Delaney đọc cả hai lá' },
    ],
  },
  {
    key: 'tiles',
    label: 'Gus nói mái nhà cần bao nhiêu viên ngói',
    line: id('b04'),
    answer: '14',
    options: [
      { value: '14', label: '14 viên' },
      { value: '40', label: '40 viên' },
      { value: '4', label: '4 viên' },
    ],
  },
];

const ROOM = (v: string) => ({ note: 'room', value: v });

export const JOB_HEARING: JobDoc = {
  id: 'job-hearing',
  title: 'Một chữ sai',
  blurb: 'Phiên xét hồ sơ trạm gác. Kemp đọc thư của hắn trước, và cái bẫy của Gus nằm đâu đó trong những gì hắn đọc.',
  level: 3,
  order: 9,
  opens: ['ct-rico-1'],
  after: 'job-tess',
  from: 'tess',
  lines: LINES,
  facts: [
    { id: 'room', label: 'Phiên xét ở đâu', line: id('b02'), consequence: 'lostWay' },
    { id: 'order', label: 'Ai đọc thư trước', line: id('b03'), consequence: 'lateEar' },
    { id: 'tiles', label: 'Gus nói bao nhiêu viên ngói', line: id('b04'), consequence: 'unsure' },
    { id: 'calls', label: 'Bà Delaney hỏi Rico điều gì', line: id('i08'), consequence: 'rambled', byAction: true },
  ],
  consequences: {
    lostWay: { name: 'Tới nhầm chỗ, phải chạy sang văn phòng Ban quản lý cảng', rejoin: 'Người ở đó chỉ đường; phiên xét chưa bắt đầu.' },
    lateEar: { name: 'Lo cho Rico nên lỡ ba câu đầu thư của Kemp', rejoin: 'Câu có con số vẫn còn ở phía sau.' },
    unsure: { name: 'Ghi sai con số Gus nói: Rico không dám chắc', rejoin: 'Con số trong thư của Kemp vẫn là con số Gus đã nói.' },
    rambled: { name: 'Chuyển nhầm câu hỏi cho Rico: anh trả lời lạc đề', rejoin: 'Bà Delaney hỏi lại; Rico trả lời đúng.' },
    missedIt: { name: 'Không nói được câu lộ ra trong thư', rejoin: 'Bà Delaney tự dừng lại ở con số đó.' },
  },
  steps: [
    // beat 1: the gatehouse (staged at Gus's hut)
    { kind: 'goto', place: 'gus', label: 'Tới trạm gác cũ của Rico, cạnh chòi gác của Gus' },
    { kind: 'scene', at: 'gus', who: ['rico', 'tess', 'gus'], lines: ['h01', 'h02', 'h03', 'h04'].map(id) },
    {
      kind: 'notebook',
      call: ['b01', 'b02', 'b03', 'b04', 'b05'].map(id),
      via: 'scene',
      entries: NOTEBOOK,
      repeat: { room: [id('b02r')], order: [id('b03r')], tiles: [id('b04r')] },
      patience: { after: 2, line: id('b06') },
    },
    // beat 2: to the room noted
    { kind: 'goto', place: 'odile', label: 'Tới chỗ bạn đã ghi cho phiên xét', if: ROOM('ferry') },
    { kind: 'scene', at: 'odile', who: ['odile'], lines: [id('l01')], if: ROOM('ferry') },
    { kind: 'goto', place: 'marcus', label: 'Tới chỗ bạn đã ghi cho phiên xét', if: ROOM('stage') },
    { kind: 'scene', at: 'marcus', who: ['marcus'], lines: [id('l02')], if: ROOM('stage') },
    { kind: 'goto', place: 'jun', label: 'Tới văn phòng Ban quản lý cảng, tầng trên chợ đồ điện tử' },
    // beat 3: the hearing (staged at Jun's stall, under the Trust's office)
    {
      kind: 'scene',
      at: 'jun',
      who: ['delaney', 'rico', 'tess', 'kemp'],
      lines: [
        id('i01'),
        id('i02'),
        id('i03'),
        { line: id('i04'), if: { past: 'job-m2:hit:late' } },
        { line: id('i05'), if: { past: 'job-m2:hit:gone' } },
        { line: id('i05b'), if: { past: 'job-half5:hit:late' } },
        { line: id('i06'), if: { past: 'job-tess:hit:deadline' } },
        { line: id('i07'), if: { past: 'job-channels:witness' } },
        id('i08'),
        id('i09'),
      ],
    },
    {
      kind: 'intent',
      who: 'rico',
      ask: [id('i10')],
      options: [
        { label: 'Bà hỏi tuần trước nhận bao nhiêu cuộc gọi', say: id('i11a'), reply: [id('i12a')] },
        { label: 'Bà hỏi hãng có bao nhiêu xe', say: id('i11b'), reply: [id('i12b'), id('i13'), id('i14')] },
        { label: 'Bà hỏi có bao nhiêu tài xế', say: id('i11c'), reply: [id('i12c'), id('i13'), id('i14')] },
      ],
      check: { right: 0, consequence: 'rambled', fact: 'calls' },
    },
    { kind: 'scene', at: 'jun', who: ['delaney', 'rico', 'tess', 'kemp'], lines: [id('i15')] },
    // Kemp reads; whoever noted that Rico reads first is busy with his notes and misses the start
    {
      kind: 'overhear',
      at: 'jun',
      who: ['kemp', 'rico'],
      lines: ['k01', 'k02', 'k03', 'k04', 'k05', 'k06', 'k07'].map(id),
      passes: 1,
      word: id('k05'),
      from: { if: { note: 'order', is: 'wrong' }, index: 3 },
    },
    { kind: 'scene', at: 'jun', who: ['rico'], lines: [id('u01')], if: { note: 'tiles', is: 'wrong' } },
    { kind: 'password', who: 'rico', line: id('k05'), chunk: 'fourteen tiles', ask: id('p01'), right: id('p02'), close: id('p03'), wrong: id('p04'), consequence: 'missedIt' },
    {
      kind: 'scene',
      at: 'jun',
      who: ['delaney', 'rico', 'tess', 'kemp'],
      lines: [{ line: id('v01'), if: { not: { hit: 'missedIt' } } }, { line: id('v01b'), if: { hit: 'missedIt' } }, { line: id('v02'), if: { hit: 'missedIt' } }, 'v03', 'v04', 'v05', 'v06', 'v07'].map((x) => (typeof x === 'string' ? id(x) : x)),
    },
    { kind: 'scene', at: 'jun', who: ['delaney', 'rico', 'tess', 'kemp'], lines: ['w01', 'w02', 'w03', 'w04'].map(id) },
    // beat 4: the night show's last song; Gus's hut
    { kind: 'radio', lines: ['m01', 'm02', 'm03'].map(id) },
    { kind: 'goto', place: 'gus', label: 'Tới chòi gác của Gus' },
    { kind: 'scene', at: 'gus', who: ['gus', 'rico'], lines: ['z01', 'z02', 'z03'].map(id) },
  ],
  ending: {
    clean: [id('e1'), id('e2')],
    messy: [id('e3'), id('e4')],
    broken: [id('e5'), id('e6')],
  },
  news: {
    clean: [id('f1')],
    messy: [id('f2')],
    broken: [id('f3')],
  },
};
