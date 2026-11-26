// Act I, job 7: "Tiền của Tess" (docs/gta-story.md §4, job 7). The Harbour Trust's hearing needs a deposit and three
// written references by Thursday at noon. Rico, panicking at the gatehouse at night, says it all in one ramble with a
// correction in the middle (Dr Osei, no, he's on nights: Bridget). The learner collects the three letters across the
// city, one step behind Kemp's assistant Shona: Mrs Okafor (who has never ridden in Rico's taxi and recommends it to
// everybody else), Bridget at the nurses' station (found among the people there: she folds sheets the way Grace taught
// her), Gianna (who dictates while shouting at her kitchen: which words were the letter?). Then Tess puts her café
// money in the envelope, and Mrs Delaney takes it, and sets the trap for the hearing.
//
// As written, against the outline (docs/gta-story.md §8 "As written"):
//   - Emma is not at Tess's cart (a town resident in a job would need clips; jobs play the browser's voice only): Rico
//     is, and promises to bring the coffee from now on (his own words to Tess in ct-rico-3, turned round);
//   - the deadline's look-alikes are "at noon" / "afternoon" and Thursday / Tuesday; the letters go to Mrs Delaney at
//     the Trust's office over the electronics market, which is not on the map: staged at Jun's stall ('jun');
//   - the old gatehouse is not on the map: beat 1 is at Gus's hut ('gus'), as in job 1.
// Canon: Mrs Okafor will not ride in Rico's taxi (docs/city.md §6), Bridget trained under Grace, "corners like
// envelopes" (§10), Gianna feeds everybody and never sits (§2), Tess saves for a café with a lemon cake (§6), Rico
// drives with Tess and Theo (§15).

import type { JobLine, NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-tess-${key}`;

const LINES: readonly JobLine[] = [
  // ── beat 1: the gatehouse, late ──
  { id: id('a01'), who: 'rico', text: "Partner, sit down. No, stand up. I can't think sitting down.", vi: 'Cộng sự, ngồi đi. Không, đứng dậy. Ngồi thì tôi không nghĩ được.' },
  { id: id('a02'), who: 'gus', text: "He's been pacing since nine. He's worn a path in my floor.", vi: 'Cậu ta đi tới đi lui từ chín giờ. Mòn cả một vệt trên sàn nhà tôi rồi.' },
  { id: id('b01'), who: 'rico', text: 'The Trust wants a deposit and three references. In writing, signed.', vi: 'Ban quản lý cảng cần tiền đặt cọc và ba thư giới thiệu. Viết tay, có chữ ký.' },
  { id: id('b02'), who: 'rico', text: "I've counted it twice, and we're eight hundred short.", vi: 'Tôi đếm hai lần rồi, mình thiếu tám trăm.' },
  { id: id('b03'), who: 'rico', text: "References. Mrs Okafor, then Dr Osei. No, wait, he's on nights. Bridget, then.", vi: 'Thư giới thiệu. Bà Okafor, rồi Dr Osei. À không, khoan, ông ấy trực đêm. Thế thì Bridget.' },
  { id: id('b04'), who: 'rico', text: "And Gianna. She'll write anything, as long as you eat something first.", vi: 'Và bà Gianna. Bà ấy viết gì cũng được, miễn là bạn ăn gì đó trước đã.' },
  { id: id('b05'), who: 'rico', text: 'It all goes to Mrs Delaney by Thursday at noon. Not a minute after.', vi: 'Tất cả phải tới tay bà Delaney trước trưa thứ Năm. Trễ một phút cũng không được.' },
  { id: id('b06'), who: 'rico', text: "Don't look at me like that. I'll find the money. Somehow.", vi: 'Đừng nhìn tôi kiểu đó. Tôi sẽ kiếm ra tiền. Bằng cách nào đó.' },
  { id: id('b02r'), who: 'rico', text: 'Eight hundred short. Not eighteen. Just eight.', vi: 'Thiếu tám trăm. Không phải mười tám. Chỉ tám thôi.' },
  { id: id('b03r'), who: 'rico', text: "Bridget, not Dr Osei. He's asleep all day after nights.", vi: 'Bridget, không phải Dr Osei. Ông ấy ngủ cả ngày sau ca đêm.' },
  { id: id('b05r'), who: 'rico', text: "Thursday. At noon. Twelve o'clock, on the dot.", vi: 'Thứ Năm. Buổi trưa. Đúng mười hai giờ.' },
  { id: id('b07'), who: 'gus', text: 'Let him finish, love. He never says anything just once.', vi: 'Để cậu ta nói hết đã. Cậu ta chẳng bao giờ nói gì đúng một lần.' },
  // ── beat 2: Mrs Okafor's window ──
  { id: id('k01'), who: 'okafor', text: "References, is it? Rico's been on at me all week.", vi: 'Thư giới thiệu hả? Rico nằn nì tôi cả tuần nay.' },
  { id: id('k02'), who: 'okafor', text: 'A Bayline woman came by at nine, asking for the very same thing.', vi: 'Có một cô bên Bayline ghé lúc chín giờ, xin đúng cái đó.' },
  { id: id('k03'), who: 'okafor', text: 'I told her the rank is for taxis, not for vultures.', vi: 'Tôi bảo cô ta bến xe là cho taxi, không phải cho kền kền.' },
  { id: id('k04'), who: 'okafor', text: "Here. I have never once ridden in Rico's taxi.", vi: 'Đây. Tôi chưa từng ngồi taxi của Rico lấy một lần.' },
  { id: id('k05'), who: 'okafor', text: 'And I recommend it to everybody else. Signed. Now move along.', vi: 'Và tôi giới thiệu nó cho tất cả những người khác. Ký rồi. Giờ đi đi.' },
  // ── the hospital: Bridget, among the people at the nurses' station ──
  { id: id('q06'), who: 'bridget', text: "Hello? Bridget here. Dr Osei's asleep, poor man, he's been on nights.", vi: 'Alô? Bridget đây. Dr Osei đang ngủ, tội ông ấy, ông trực đêm mà.' },
  { id: id('q06b'), who: 'bridget', text: "Hello? Bridget here. Nell says you're at the pharmacy, looking for me.", vi: 'Alô? Bridget đây. Nell bảo bạn đang ở nhà thuốc tìm tôi.' },
  { id: id('q07'), who: 'bridget', text: "Come to the nurses' station. I'll write it myself.", vi: 'Ra trạm điều dưỡng đi. Tôi tự viết cho.' },
  { id: id('q01'), who: 'player', text: 'Excuse me, are you Bridget? Rico sent me.', vi: 'Xin lỗi, chị có phải Bridget không? Rico nhờ tôi tới.' },
  { id: id('q02'), who: 'nell', text: "Bridget? She's the one folding the sheets. She's always folding something.", vi: 'Bridget á? Là người đang gấp ga giường kia. Lúc nào cô ấy cũng gấp cái gì đó.' },
  { id: id('q03'), who: 'yuki', text: "Sorry, I'm just waiting for a friend. I'm not a nurse.", vi: 'Xin lỗi, tôi chỉ đang đợi bạn. Tôi không phải y tá.' },
  { id: id('q04'), who: 'bridget', text: 'Rico sent you? Of course. Grace taught me to fold like this, you know.', vi: 'Rico nhờ bạn à? Tất nhiên rồi. Bạn biết không, chính bà Grace dạy tôi gấp thế này.' },
  { id: id('q05'), who: 'bridget', text: 'There. Quick, kind, and never once late for a night shift.', vi: 'Đây. Nhanh nhẹn, tử tế, và chưa lần nào trễ ca đêm.' },
  // ── Gianna's: the letter and the kitchen at once ──
  { id: id('g01'), who: 'gianna', text: "Sit. Eat first, then I write. That's the rule in here.", vi: 'Ngồi. Ăn trước, rồi tôi viết. Ở đây luật là thế.' },
  { id: id('g02'), who: 'gianna', text: 'To the Harbour Trust. Rico is the best driver in Westbay.', vi: 'Gửi Ban quản lý cảng. Rico là tài xế giỏi nhất Westbay.' },
  { id: id('g03'), who: 'gianna', text: 'The sauce! Somebody stir the sauce before it catches!', vi: 'Nồi xốt! Ai khuấy nồi xốt đi kẻo nó cháy!' },
  { id: id('g04'), who: 'gianna', text: "In all these years, he's never once been late for me.", vi: 'Bao nhiêu năm nay, cậu ấy chưa từng tới trễ với tôi lần nào.' },
  { id: id('g05'), who: 'gianna', text: 'No, the oven! Turn it down, not off!', vi: 'Không, cái lò! Vặn nhỏ lại, đừng tắt!' },
  { id: id('g06'), who: 'gianna', text: 'Signed, Gianna. Now read it back to me. What did I say about him?', vi: 'Ký tên, Gianna. Giờ đọc lại cho tôi nghe. Tôi viết gì về cậu ấy?' },
  { id: id('g07a'), who: 'player', text: "That he's never once been late for you.", vi: 'Rằng anh ấy chưa từng tới trễ với bà lần nào.' },
  { id: id('g07b'), who: 'player', text: "That he's never once paid for his food.", vi: 'Rằng anh ấy chưa từng trả tiền ăn lần nào.' },
  { id: id('g07c'), who: 'player', text: "That he's never once said no to you.", vi: 'Rằng anh ấy chưa từng từ chối bà lần nào.' },
  { id: id('g08a'), who: 'gianna', text: 'Exactly. Good ears. Now finish your pasta.', vi: 'Chính xác. Tai thính đấy. Giờ ăn hết mì đi.' },
  { id: id('g08b'), who: 'gianna', text: 'Paid? He pays! Mostly. Late, I said. Never late.', vi: 'Trả tiền? Cậu ấy có trả! Hầu hết. Tôi bảo trễ cơ. Chưa bao giờ trễ.' },
  { id: id('g08c'), who: 'gianna', text: 'Said no? He says no all day long. Late, I said. Never late.', vi: 'Từ chối? Cậu ấy từ chối suốt ngày. Tôi bảo trễ cơ. Chưa bao giờ trễ.' },
  // ── Tess's cart: the money ──
  { id: id('s01'), who: 'tess', text: "Rico told me. Don't make that face, he tells me everything.", vi: 'Rico kể rồi. Đừng làm mặt đó, cái gì anh ấy cũng kể với tôi.' },
  { id: id('s00a'), who: 'player', text: "We're eight hundred short, Tess.", vi: 'Mình thiếu tám trăm, Tess ạ.' },
  { id: id('s00b'), who: 'player', text: "We're eighteen hundred short, Tess.", vi: 'Mình thiếu một nghìn tám trăm, Tess ạ.' },
  { id: id('s00c'), who: 'player', text: "We're eighty short, Tess.", vi: 'Mình thiếu tám mươi, Tess ạ.' },
  { id: id('s02a'), who: 'tess', text: "Eight hundred. Here. It's all in the envelope.", vi: 'Tám trăm. Đây. Tất cả trong phong bì.' },
  { id: id('s02b'), who: 'tess', text: "Eighteen hundred? That's everything. Next month's rent as well. Fine.", vi: 'Một nghìn tám trăm? Thế là hết sạch. Cả tiền nhà tháng sau. Được.' },
  { id: id('s03'), who: 'rico', text: "Eighteen? No, Tess, eight. Eight hundred. I'll bring the rest back tonight.", vi: 'Mười tám á? Không, Tess, tám. Tám trăm thôi. Tối nay anh trả lại phần dư.' },
  { id: id('s04'), who: 'rico', text: "Eighty? I've got eighty in my sock. It's eight hundred.", vi: 'Tám mươi? Tám mươi thì anh có sẵn trong chiếc tất. Là tám trăm cơ.' },
  { id: id('s02c'), who: 'tess', text: "Eight hundred, then. Here. It's all in the envelope.", vi: 'Vậy thì tám trăm. Đây. Tất cả trong phong bì.' },
  { id: id('s05'), who: 'tess', text: "It's the cafe money. The real cafe. Four walls and a lemon cake.", vi: 'Tiền mở quán đấy. Cái quán thật. Bốn bức tường và một cái bánh chanh.' },
  { id: id('s06'), who: 'tess', text: 'So. Are you going to take it, or do I have to post it?', vi: 'Sao. Có định cầm không, hay để tôi gửi bưu điện?' },
  { id: id('s07a'), who: 'player', text: "We can't take your cafe, Tess.", vi: 'Bọn tôi không thể lấy cái quán của chị được, Tess.' },
  { id: id('s07b'), who: 'player', text: "We'll pay back every penny. I promise.", vi: 'Bọn tôi sẽ trả lại từng xu. Tôi hứa.' },
  { id: id('s07c'), who: 'player', text: "I honestly don't know what to say.", vi: 'Thật lòng tôi không biết nói gì.' },
  { id: id('s08a'), who: 'tess', text: "You're not taking it. You're borrowing it. With interest. In coffee.", vi: 'Có phải lấy đâu. Là mượn. Có lãi hẳn hoi. Trả bằng cà phê.' },
  { id: id('s08b'), who: 'tess', text: "I know you will. I've seen Rico's notebook. It's mostly my name.", vi: 'Tôi biết mà. Tôi thấy sổ của Rico rồi. Toàn tên tôi.' },
  { id: id('s08c'), who: 'tess', text: 'Then say nothing. Rico talks enough for all three of us.', vi: 'Thế thì đừng nói gì. Rico nói đủ phần cả ba chúng ta rồi.' },
  { id: id('s09'), who: 'rico', text: "Tess. I'll bring the coffee from now on. Every single morning.", vi: 'Tess. Từ giờ anh sẽ mang cà phê. Sáng nào cũng vậy.' },
  { id: id('s10'), who: 'tess', text: "You'll burn the milk every morning. I'm going to enjoy that.", vi: 'Sáng nào anh cũng làm cháy sữa cho xem. Tôi sẽ khoái lắm đây.' },
  // ── beat 4: Mrs Delaney ──
  { id: id('y01'), who: 'delaney', text: 'Thursday, five to twelve. Three references and the deposit. All in order.', vi: 'Thứ Năm, mười hai giờ kém năm. Ba thư giới thiệu và tiền đặt cọc. Đủ cả.' },
  { id: id('y02'), who: 'delaney', text: "It's gone twelve. I did say noon. I'll take it, this once.", vi: 'Quá mười hai giờ rồi. Tôi đã bảo buổi trưa. Lần này thì tôi nhận.' },
  { id: id('y03'), who: 'delaney', text: "It's only Tuesday. I'll lock it in my drawer till Thursday.", vi: 'Mới thứ Ba thôi mà. Tôi khóa nó trong ngăn kéo tới thứ Năm.' },
  { id: id('y04'), who: 'delaney', text: 'Now, the hearing. Mr Kemp reads his letter first, then Rico.', vi: 'Giờ tới phiên xét. Ông Kemp đọc thư trước, rồi tới Rico.' },
  { id: id('y05'), who: 'delaney', text: 'Tonight Gus says one thing on our radio. Something only a listener would know.', vi: 'Tối nay Gus sẽ nói một điều trên bộ đàm của chúng tôi. Điều chỉ kẻ nghe lén mới biết.' },
  { id: id('y06'), who: 'delaney', text: "If it turns up in Mr Kemp's letter, we've got him.", vi: 'Nếu nó xuất hiện trong thư của ông Kemp, là bắt được hắn.' },
  // the last word, by grade
  { id: id('e1'), who: 'rico', text: "Three letters, one envelope, and not a minute late. Partner, we've got a bid.", vi: 'Ba lá thư, một phong bì, không trễ phút nào. Cộng sự ơi, mình có hồ sơ rồi.' },
  { id: id('e2'), who: 'rico', text: 'And a debt. A coffee debt. The very worst kind.', vi: 'Và một món nợ. Nợ cà phê. Loại nợ tệ nhất.' },
  { id: id('e3'), who: 'rico', text: "It's all in. A bit crumpled, but it's all in.", vi: 'Nộp đủ rồi. Hơi nhàu một chút, nhưng đủ cả.' },
  { id: id('e4'), who: 'rico', text: "Tess's money's in there too. We don't lose this one. We can't.", vi: 'Tiền của Tess cũng nằm trong đó. Vụ này mình không được thua. Không thể.' },
  { id: id('e5'), who: 'rico', text: "Delaney's got it, and that's what matters. Just about.", vi: 'Bà Delaney nhận rồi, thế là được. Vừa sát nút.' },
  { id: id('e6'), who: 'rico', text: "I'm buying Tess a lemon cake. Not making one. Buying one.", vi: 'Anh sẽ mua cho Tess một cái bánh chanh. Không tự làm đâu. Mua.' },
  // Bay FM, by how it ended
  { id: id('f1'), who: 'kit', text: "Word on the harbour tonight. Rico's firm has put in its bid for the gatehouse.", vi: 'Tin ở cảng tối nay. Hãng của Rico đã nộp hồ sơ xin trạm gác.' },
  { id: id('f2'), who: 'kit', text: 'A taxi was seen racing round the old market today. Somebody had a deadline.', vi: 'Hôm nay có người thấy một chiếc taxi phóng vòng quanh chợ cũ. Chắc ai đó bị dí hạn.' },
  { id: id('f3'), who: 'kit', text: 'Bay FM traffic, brought to you by Bayline. The harbour hearing is next week.', vi: 'Giao thông Bay FM, do Bayline tài trợ. Phiên xét hồ sơ ở cảng là tuần sau.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'amount',
    label: 'Còn thiếu bao nhiêu tiền cọc',
    line: id('b02'),
    answer: '800',
    options: [
      { value: '800', label: 'Thiếu 800' },
      { value: '1800', label: 'Thiếu 1.800' },
      { value: '80', label: 'Thiếu 80' },
    ],
  },
  {
    key: 'ref',
    label: 'Thư giới thiệu thứ hai xin ai',
    line: id('b03'),
    answer: 'bridget',
    options: [
      { value: 'bridget', label: 'Bridget, điều dưỡng trưởng' },
      { value: 'osei', label: 'Dr Osei' },
      { value: 'nell', label: 'Nell ở nhà thuốc' },
    ],
  },
  {
    key: 'deadline',
    label: 'Hạn nộp cho bà Delaney',
    line: id('b05'),
    answer: 'thu-noon',
    options: [
      { value: 'thu-noon', label: 'Trưa thứ Năm (12 giờ)' },
      { value: 'thu-after', label: 'Chiều thứ Năm' },
      { value: 'tue-noon', label: 'Trưa thứ Ba' },
    ],
  },
];

const AMOUNT = (v: string) => ({ note: 'amount', value: v });
const DEADLINE = (v: string) => ({ note: 'deadline', value: v });
const REF = (v: string) => ({ note: 'ref', value: v });

export const JOB_TESS: JobDoc = {
  id: 'job-tess',
  title: 'Tiền của Tess',
  blurb: 'Phiên xét hồ sơ cần tiền đặt cọc và ba thư giới thiệu. Rico thì đang hoảng, và người của Kemp đi trước một bước.',
  level: 2,
  order: 8,
  opens: ['ct-rico-1'],
  after: 'job-channels',
  from: 'rico',
  lines: LINES,
  facts: [
    { id: 'amount', label: 'Còn thiếu bao nhiêu', line: id('b02'), consequence: 'amount' },
    { id: 'ref', label: 'Thư thứ hai xin ai', line: id('b03'), consequence: 'wrongRef', byAction: true },
    { id: 'deadline', label: 'Hạn nộp', line: id('b05'), consequence: 'deadline' },
    { id: 'gianna', label: 'Bà Gianna viết gì về Rico', line: id('g04'), consequence: 'gianna', byAction: true },
  ],
  consequences: {
    amount: { name: 'Báo Tess sai số tiền thiếu', rejoin: 'Rico nói lại đúng tám trăm; Tess vẫn đưa tiền.' },
    wrongRef: { name: 'Đi xin thư nhầm người: Bridget phải gọi chỉ đường', rejoin: 'Bridget tự viết thư ở trạm điều dưỡng.' },
    deadline: { name: 'Ghi sai hạn nộp: nộp muộn hoặc chạy cuống lên hai ngày sớm', rejoin: 'Bà Delaney vẫn nhận hồ sơ.' },
    gianna: { name: 'Đọc lại sai lời bà Gianna viết', rejoin: 'Bà Gianna sửa lại, thư vẫn ký.' },
    askedWrong: { name: 'Hỏi nhầm người ở trạm điều dưỡng', rejoin: 'Người bị hỏi chỉ đúng Bridget.' },
  },
  steps: [
    // beat 1: the gatehouse (staged at Gus's hut)
    { kind: 'goto', place: 'gus', label: 'Tới trạm gác cũ của Rico, cạnh chòi gác của Gus' },
    { kind: 'scene', at: 'gus', who: ['rico', 'gus'], lines: [id('a01'), id('a02')] },
    {
      kind: 'notebook',
      call: ['b01', 'b02', 'b03', 'b04', 'b05', 'b06'].map(id),
      via: 'scene',
      entries: NOTEBOOK,
      repeat: { amount: [id('b02r')], ref: [id('b03r')], deadline: [id('b05r')] },
      patience: { after: 2, line: id('b07') },
    },
    // beat 2: Mrs Okafor's window
    { kind: 'goto', place: 'okafor', label: 'Tới ô bán vé của bà Okafor, Ga trung tâm' },
    { kind: 'scene', at: 'okafor', who: ['okafor'], lines: ['k01', 'k02', 'k03', 'k04', 'k05'].map(id) },
    // beat 3: the second reference, at the place noted; Bridget found among the people at her station
    {
      kind: 'pickup',
      entry: 'ref',
      places: { bridget: 'bridget', osei: 'osei', nell: 'nell' },
      place: 'bridget',
      wrongPlace: { lines: [{ line: id('q06'), if: REF('osei') }, { line: id('q06b'), if: REF('nell') }, id('q07')], consequence: 'wrongRef' },
      crowd: ['bridget', 'nell', 'yuki'],
      passenger: 'bridget',
      ask: [id('q01')],
      notMe: { nell: [id('q02')], yuki: [id('q03')] },
      wrongPerson: 'askedWrong',
      greet: [id('q04')],
      board: false,
    },
    { kind: 'scene', at: 'bridget', who: ['bridget'], lines: [id('q05')] },
    // Gianna's: which words were the letter?
    { kind: 'goto', place: 'gianna', label: 'Tới quán Ý của bà Gianna' },
    { kind: 'scene', at: 'gianna', who: ['gianna'], lines: ['g01', 'g02', 'g03', 'g04', 'g05'].map(id) },
    {
      kind: 'intent',
      who: 'gianna',
      ask: [id('g06')],
      options: [
        { label: 'Chưa bao giờ tới trễ với bà', say: id('g07a'), reply: [id('g08a')] },
        { label: 'Chưa bao giờ trả tiền ăn', say: id('g07b'), reply: [id('g08b')] },
        { label: 'Chưa bao giờ từ chối bà', say: id('g07c'), reply: [id('g08c')] },
      ],
      check: { right: 0, consequence: 'gianna', fact: 'gianna' },
    },
    // Tess's cart: the learner tells her the figure noted
    { kind: 'goto', place: 'tess', label: 'Tới xe cà phê của Tess' },
    {
      kind: 'scene',
      at: 'tess',
      who: ['tess', 'rico'],
      lines: [
        id('s01'),
        { line: id('s00a'), if: AMOUNT('800') },
        { line: id('s00b'), if: AMOUNT('1800') },
        { line: id('s00c'), if: AMOUNT('80') },
        { line: id('s02a'), if: AMOUNT('800') },
        { line: id('s02b'), if: AMOUNT('1800') },
        { line: id('s03'), if: AMOUNT('1800') },
        { line: id('s04'), if: AMOUNT('80') },
        { line: id('s02c'), if: AMOUNT('80') },
        id('s05'),
      ],
    },
    {
      kind: 'intent',
      who: 'tess',
      ask: [id('s06')],
      options: [
        { label: 'Không nhận tiền mở quán', say: id('s07a'), reply: [id('s08a')] },
        { label: 'Nhận và hứa trả', say: id('s07b'), reply: [id('s08b')], flag: 'promised-tess' },
        { label: 'Không biết nói gì', say: id('s07c'), reply: [id('s08c')] },
      ],
    },
    { kind: 'scene', at: 'tess', who: ['tess', 'rico'], lines: [id('s09'), id('s10')] },
    // beat 4: the Trust's office (staged at Jun's stall: the office upstairs is not on the map)
    { kind: 'goto', place: 'jun', label: 'Tới văn phòng Ban quản lý cảng, tầng trên chợ đồ điện tử' },
    {
      kind: 'scene',
      at: 'jun',
      who: ['delaney'],
      lines: [
        { line: id('y01'), if: DEADLINE('thu-noon') },
        { line: id('y02'), if: DEADLINE('thu-after') },
        { line: id('y03'), if: DEADLINE('tue-noon') },
        id('y04'),
        id('y05'),
        id('y06'),
      ],
    },
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
