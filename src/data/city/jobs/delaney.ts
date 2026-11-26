// Act I, job 5: "Ghế của bà Delaney" ("Mrs Delaney's chair", docs/gta-story.md §4 job 5). Mrs Delaney of the Harbour
// Trust sits on the only chair in Rico's office to see whether it is a real business. Rico is out driving; the learner
// answers phone two: Grace from the hospital, Nell from the pharmacy, then Duncan Kemp, booking a real car and asking,
// with the inspector listening, about his offer. Rico reads a fare back wrong on the radio. Mrs Delaney writes it all
// down.
//
// Changed from the outline (listed in docs/gta-plan.md §14 too):
//   - the old gatehouse is not on the map: the office is staged at Gus's hut next door ('gus'), as in job 1;
//   - no wall map to send cars from: each call is a notebook of two entries (who / when / where), and a wrong note is
//     that call's ONE consequence (the car at the wrong door or the wrong time), which Mrs Delaney reads out at the end;
//   - Grace's call: "me and Bridget" (two) and "the five forty" (five fourteen, four fifty); where from is not asked;
//   - Nell's: "half six. No, sorry, half seven" and "to the ferry" (the fair, Fay's: the big wheel's ticket booth);
//   - Kemp's booking: "to the hearing" (the harbour; "herring": Hal's fish stall) and "Thursday at nine" (Tuesday at
//     nine; Thursday at five);
//   - Rico's read-back gets Grace's train wrong whatever was noted: correcting him is the answer by intent;
//   - the complaint about job 1 is asked only when job 1 was late (`past: 'job-m2:hit:late'`), and Kemp's question
//     changes when job 1 ended with "Để nghĩ đã" (`past: 'job-m2:kemp-asks-again'`);
//   - Nell's call is a VOICE MESSAGE on the learner's phone (notebook `via: 'voicemail'`, the engine's sample for
//     gta-plan §17): heard from the phone, then noted. She says everything twice anyway.
// Grace is of the town ('home'): her four lines are clips (connected only), the browser voice until the owner makes them.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-delaney-${key}`;
const wrong = (...keys: string[]) => ({ any: keys.map((note) => ({ note, is: 'wrong' as const })) });
const ASKS_AGAIN = { past: 'job-m2:kemp-asks-again' };

const LINES = [
  // ── beat 1: the chair ──
  { id: id('d01'), who: 'rico', text: 'This is Mrs Delaney, from the Trust. She wants to see a real business.', vi: 'Đây là bà Delaney, bên Ban quản lý cảng. Bà muốn xem một hãng làm ăn thật.' },
  { id: id('d02'), who: 'delaney', text: "I'll just watch, if that's alright. Pretend I'm not here.", vi: 'Tôi chỉ ngồi xem thôi, nếu không phiền. Cứ coi như tôi không có ở đây.' },
  { id: id('d03'), who: 'rico', text: "I'm out driving. Phone two is yours. Code names only, yeah?", vi: 'Tôi ra chạy xe. Máy số hai là của bạn. Chỉ dùng mật mã thôi nhé?' },
  { id: id('d04'), who: 'tess', text: 'Coffee for the inspector. Milk, no sugar. I asked Gus.', vi: 'Cà phê cho thanh tra. Sữa, không đường. Em hỏi Gus rồi.' },
  // ── call one: Grace ──
  { id: id('g01'), who: 'home', text: "Hello, love, it's Grace. I'm at the hospital, it's my Wednesday.", vi: 'Chào cháu, Grace đây. Bà đang ở bệnh viện, thứ Tư của bà mà.' },
  { id: id('g02'), who: 'home', text: 'I need a car for me and Bridget, please.', vi: 'Bà cần một xe cho bà và Bridget.' },
  { id: id('g03'), who: 'home', text: "We've a train to catch at the station. The five forty.", vi: 'Tụi bà phải bắt tàu ở ga. Chuyến năm giờ bốn mươi.' },
  { id: id('g04'), who: 'home', text: 'Thank you, love. And tell Rico to drive gently.', vi: 'Cảm ơn cháu. Và dặn Rico lái nhẹ nhàng thôi nhé.' },
  { id: id('g02r'), who: 'home', text: 'Me and Bridget. Two of us, love.', vi: 'Bà và Bridget. Hai người, cháu ạ.' },
  { id: id('g03r'), who: 'home', text: 'The five forty. Twenty to six, love.', vi: 'Chuyến năm giờ bốn mươi. Sáu giờ kém hai mươi, cháu ạ.' },
  { id: id('g05'), who: 'home', text: "Don't worry, love. I'll say it slower.", vi: 'Đừng lo, cháu. Bà nói chậm lại nhé.' },
  // ── call two: Nell ──
  { id: id('l01'), who: 'nell', text: "Hello, it's Nell at the pharmacy. I'll say it twice, I always do.", vi: 'Chào, Nell ở nhà thuốc đây. Tôi sẽ nói hai lần, lúc nào tôi cũng thế.' },
  { id: id('l02'), who: 'nell', text: 'A car to the ferry, please. To the ferry.', vi: 'Một xe tới bến phà. Tới bến phà nhé.' },
  { id: id('l03'), who: 'nell', text: 'Half six. No, sorry, half seven. Half seven.', vi: 'Sáu rưỡi. À không, xin lỗi, bảy rưỡi. Bảy rưỡi.' },
  { id: id('l04'), who: 'nell', text: 'Lovely. Thank you, dear. Thank you.', vi: 'Tốt quá. Cảm ơn cháu. Cảm ơn nhé.' },
  { id: id('l02r'), who: 'nell', text: 'The ferry. Where the boats go. The ferry.', vi: 'Bến phà. Chỗ tàu thuyền đi. Bến phà.' },
  { id: id('l03r'), who: 'nell', text: 'Half seven. Seven thirty. Half seven.', vi: 'Bảy rưỡi. Bảy giờ ba mươi. Bảy rưỡi.' },
  { id: id('l05'), who: 'nell', text: 'I did say it twice, dear. I always say it twice.', vi: 'Tôi nói hai lần rồi mà cháu. Lúc nào tôi cũng nói hai lần.' },
  // ── call three: Kemp ──
  { id: id('k01'), who: 'kemp', text: "Evening. Duncan Kemp. I'd like to book one of your cars.", vi: 'Chào buổi tối. Duncan Kemp đây. Tôi muốn đặt một xe của hãng.' },
  { id: id('k02'), who: 'kemp', text: "From my office to the Trust's hearing, please.", vi: 'Từ văn phòng tôi tới phiên điều trần của Ban quản lý cảng.' },
  { id: id('k03'), who: 'kemp', text: 'Thursday at nine, if you would. In the morning.', vi: 'Thứ Năm lúc chín giờ, nếu được. Buổi sáng.' },
  { id: id('k04'), who: 'kemp', text: "Lovely. Is that Mrs Delaney I can hear? Evening, Mrs Delaney.", vi: 'Tốt. Có phải tôi nghe thấy bà Delaney không? Chào bà Delaney.' },
  { id: id('k02r'), who: 'kemp', text: 'The hearing. At the Trust. Upstairs, on Quay Street.', vi: 'Phiên điều trần. Ở Ban quản lý cảng. Tầng trên, phố Quay.' },
  { id: id('k03r'), who: 'kemp', text: 'Thursday. The day after Wednesday. Nine.', vi: 'Thứ Năm. Ngày sau thứ Tư. Chín giờ.' },
  { id: id('k12'), who: 'kemp', text: 'Take your time. Mrs Delaney has all evening.', vi: 'Cứ từ từ. Bà Delaney có cả buổi tối mà.' },
  // ── beat 2: Rico reads it back ──
  { id: id('r01'), who: 'rico', text: "Rico on thirteen. Two from Grace's for the five fourteen. Copy?", vi: 'Rico, kênh mười ba. Hai người từ "Grace\'s" cho chuyến năm giờ mười bốn. Rõ chưa?' },
  { id: id('r01a'), who: 'player', text: 'No, Rico. The five forty. Four, zero.', vi: 'Không, Rico. Chuyến năm giờ bốn mươi. Bốn, không.' },
  { id: id('r01b'), who: 'player', text: 'Copy, Rico. Off you go.', vi: 'Rõ, Rico. Đi đi.' },
  { id: id('r02'), who: 'rico', text: 'Five forty. Copy. Good catch.', vi: 'Năm giờ bốn mươi. Rõ. Bắt lỗi giỏi đấy.' },
  { id: id('r03'), who: 'rico', text: 'Copy. On my way.', vi: 'Rõ. Đang đi.' },
  { id: id('r04'), who: 'delaney', text: 'The driver got the time wrong. Nobody corrected him. Noted.', vi: 'Tài xế nhầm giờ. Không ai sửa. Ghi lại.' },
  // ── beat 3: Kemp, in front of Mrs Delaney ──
  { id: id('k05'), who: 'kemp', text: 'While I have you. Did you think about my offer?', vi: 'Nhân tiện. Bạn đã nghĩ về lời đề nghị của tôi chưa?' },
  { id: id('k06'), who: 'kemp', text: "While I have you. You said you'd think about my offer.", vi: 'Nhân tiện. Bạn nói sẽ nghĩ về lời đề nghị của tôi mà.' },
  { id: id('k05a'), who: 'player', text: "Thanks, Mr Kemp. We're busy. Was there anything else?", vi: 'Cảm ơn ông Kemp. Chúng tôi đang bận. Ông còn việc gì khác không?' },
  { id: id('k05b'), who: 'player', text: 'Stop listening to our radio, Mr Kemp.', vi: 'Thôi nghe lén bộ đàm của chúng tôi đi, ông Kemp.' },
  { id: id('k05c'), who: 'player', text: "I'll put you through to Rico.", vi: 'Để tôi chuyển máy cho Rico.' },
  { id: id('k07'), who: 'kemp', text: 'Nothing else. For now. Good evening.', vi: 'Không còn gì. Lúc này thôi. Chào buổi tối.' },
  { id: id('k08'), who: 'delaney', text: 'Polite. Firm. I like a firm no.', vi: 'Lịch sự. Dứt khoát. Tôi thích một lời từ chối dứt khoát.' },
  { id: id('k09'), who: 'kemp', text: "I've no idea what you mean. Good evening.", vi: 'Tôi chẳng hiểu bạn nói gì. Chào buổi tối.' },
  { id: id('k10'), who: 'delaney', text: 'Accusation. No evidence. That goes in the file.', vi: 'Buộc tội. Không bằng chứng. Ghi vào hồ sơ.' },
  { id: id('k11'), who: 'kemp', text: "He's driving. You're the one I wanted. Goodnight.", vi: 'Anh ta đang lái xe. Người tôi cần là bạn cơ. Chúc ngủ ngon.' },
  { id: id('k13'), who: 'delaney', text: 'He asked for you, not the driver. Noted.', vi: 'Ông ta hỏi bạn, không phải tài xế. Ghi lại.' },
  // ── the complaint about job 1 (only when it was late) ──
  { id: id('c01'), who: 'delaney', text: "We've had a complaint. A car half an hour late, outside Meridian.", vi: 'Chúng tôi nhận một đơn khiếu nại. Một xe trễ nửa tiếng, trước trụ sở Meridian.' },
  { id: id('c02'), who: 'delaney', text: 'On your first night. Would you like to explain?', vi: 'Vào đêm đầu tiên của các bạn. Bạn có muốn giải thích không?' },
  { id: id('c02a'), who: 'player', text: "Yes, that was me. I'm sorry. It won't happen again.", vi: 'Vâng, là tôi. Xin lỗi. Sẽ không có lần sau.' },
  { id: id('c02b'), who: 'player', text: 'The traffic was terrible that night.', vi: 'Tối đó kẹt xe kinh khủng.' },
  { id: id('c03'), who: 'delaney', text: "Acknowledged. That's what I'll write. Acknowledged.", vi: 'Đã nhận lỗi. Tôi sẽ ghi như thế. Đã nhận lỗi.' },
  { id: id('c04'), who: 'delaney', text: 'The traffic. Of course. I checked. There was none.', vi: 'Kẹt xe. Tất nhiên rồi. Tôi đã kiểm tra. Hôm đó không kẹt.' },
  // ── what she read back ──
  { id: id('f01'), who: 'delaney', text: "Grace's car. Wrong train, or the wrong number of people.", vi: 'Xe của Grace. Sai chuyến tàu, hoặc sai số người.' },
  { id: id('f02'), who: 'delaney', text: "Nell's car. The wrong place, or the wrong hour.", vi: 'Xe của Nell. Sai chỗ, hoặc sai giờ.' },
  { id: id('f03'), who: 'delaney', text: "Mr Kemp's car. Booked wrong. He'll enjoy telling people.", vi: 'Xe của ông Kemp. Đặt sai. Ông ấy sẽ thích kể chuyện này lắm.' },
  // ── beat 4 ──
  { id: id('e1'), who: 'delaney', text: "It's a real business. Small. Loud. Real.", vi: 'Đây là một hãng làm ăn thật. Nhỏ. Ồn. Thật.' },
  { id: id('e2'), who: 'rico', text: 'Did she say real? She said real. Twice.', vi: 'Bà ấy nói "thật" à? Bà ấy nói "thật". Hai lần.' },
  { id: id('e3'), who: 'delaney', text: "It's a real business. It just needs to write things down.", vi: 'Đây là một hãng làm ăn thật. Chỉ cần ghi chép cẩn thận hơn.' },
  { id: id('e4'), who: 'delaney', text: 'A business, yes. A careful one, not yet.', vi: 'Một hãng, đúng. Một hãng cẩn thận, thì chưa.' },
  { id: id('e5'), who: 'rico', text: "Not yet. That's not a no, is it? Tess, is it?", vi: '"Chưa". Đâu phải là "không", nhỉ? Tess, phải không?' },
  { id: id('e6'), who: 'tess', text: 'Strange fares, strange inspectors. Same night, every night.', vi: 'Khách lạ, thanh tra lạ. Đêm nào cũng thế.' },
  { id: id('n1'), who: 'kit', text: 'The Harbour Trust has licensed a small new car firm by the gate.', vi: 'Ban quản lý cảng vừa cấp phép cho một hãng xe nhỏ mới cạnh cổng cảng.' },
  { id: id('n3'), who: 'kit', text: 'The Trust has licensed a new car firm by the gate. With notes, I hear.', vi: 'Ban quản lý cảng đã cấp phép cho một hãng xe mới cạnh cổng. Kèm vài ghi chú, nghe nói vậy.' },
  { id: id('n2'), who: 'kit', text: 'The Trust says the new car firm by the gate will be checked again.', vi: 'Ban quản lý cảng cho biết hãng xe mới cạnh cổng sẽ được kiểm tra lại.' },
];

const GRACE: NoteEntry[] = [
  {
    key: 'gcount',
    label: 'Grace: mấy người',
    line: id('g02'),
    answer: 'two',
    options: [
      { value: 'two', label: 'Hai người: bà và Bridget' },
      { value: 'one', label: 'Một người: Bridget' },
      { value: 'three', label: 'Ba người' },
    ],
  },
  {
    key: 'gtrain',
    label: 'Grace: chuyến tàu',
    line: id('g03'),
    answer: '540',
    options: [
      { value: '540', label: '5 giờ 40' },
      { value: '514', label: '5 giờ 14' },
      { value: '450', label: '4 giờ 50' },
    ],
  },
];

const NELL: NoteEntry[] = [
  {
    key: 'nto',
    label: 'Nell: đi đâu',
    line: id('l02'),
    answer: 'ferry',
    options: [
      { value: 'ferry', label: 'Bến phà' },
      { value: 'fair', label: 'Khu hội chợ (vòng đu quay)' },
      { value: 'fay', label: 'Quầy vé của Fay' },
    ],
  },
  {
    key: 'ntime',
    label: 'Nell: mấy giờ',
    line: id('l03'),
    answer: '730',
    options: [
      { value: '730', label: '7 giờ 30' },
      { value: '630', label: '6 giờ 30' },
      { value: '530', label: '5 giờ 30' },
    ],
  },
];

const KEMP: NoteEntry[] = [
  {
    key: 'kto',
    label: 'Kemp: đi đâu',
    line: id('k02'),
    answer: 'hearing',
    options: [
      { value: 'hearing', label: 'Phiên điều trần của Ban quản lý cảng' },
      { value: 'harbour', label: 'Bến cảng' },
      { value: 'herring', label: 'Sạp cá trích của Hal' },
    ],
  },
  {
    key: 'kday',
    label: 'Kemp: hôm nào',
    line: id('k03'),
    answer: 'thu9',
    options: [
      { value: 'thu9', label: 'Thứ Năm, 9 giờ sáng' },
      { value: 'tue9', label: 'Thứ Ba, 9 giờ sáng' },
      { value: 'thu5', label: 'Thứ Năm, 5 giờ' },
    ],
  },
];

export const JOB_DELANEY: JobDoc = {
  id: 'job-delaney',
  title: 'Ghế của bà Delaney',
  blurb: 'Bà Delaney của Ban quản lý cảng ngồi xem văn phòng của Rico có phải hãng làm ăn thật không. Máy số hai là của bạn.',
  level: 2,
  order: 6,
  opens: ['ct-rico-1'],
  after: 'job-three',
  from: 'rico',
  lines: LINES,
  facts: [
    { id: 'gcount', label: 'Grace: mấy người', line: id('g02'), consequence: 'grace' },
    { id: 'gtrain', label: 'Grace: chuyến tàu', line: id('g03'), consequence: 'grace' },
    { id: 'nto', label: 'Nell: đi đâu', line: id('l02'), consequence: 'nell' },
    { id: 'ntime', label: 'Nell: mấy giờ', line: id('l03'), consequence: 'nell' },
    { id: 'kto', label: 'Kemp: đi đâu', line: id('k02'), consequence: 'kemp' },
    { id: 'kday', label: 'Kemp: hôm nào', line: id('k03'), consequence: 'kemp' },
    { id: 'readback', label: 'Rico đọc lại sai giờ', line: id('r01'), consequence: 'readback', byAction: true },
    { id: 'answer', label: 'Trả lời Kemp trước mặt bà Delaney', line: id('k05'), consequence: 'accused', byAction: true },
    { id: 'complaint', label: 'Đơn khiếu nại vụ trễ hôm đầu', line: id('c01'), consequence: 'excuse', byAction: true },
  ],
  consequences: {
    grace: { name: 'Ghi sai cuộc của Grace: xe tới sai giờ hoặc thiếu chỗ', rejoin: 'Rico tự sửa trên đường; bà Delaney ghi lại.' },
    nell: { name: 'Ghi sai cuộc của Nell: xe tới sai chỗ hoặc sai giờ', rejoin: 'Nell gọi lại, Tess chạy đi đón; bà Delaney ghi lại.' },
    kemp: { name: 'Ghi sai cuộc đặt xe của Kemp', rejoin: 'Kemp vẫn tới phiên điều trần, bằng xe Bayline; bà Delaney ghi lại.' },
    readback: { name: 'Để Rico đọc sai giờ mà không sửa', rejoin: 'Rico tới ga sớm, Grace chờ trong xe; bà Delaney ghi lại.' },
    accused: { name: 'Buộc tội Kemp nghe lén, không có bằng chứng', rejoin: 'Kemp gác máy lịch sự; dòng đó nằm trong hồ sơ.' },
    excuse: { name: 'Đổ cho kẹt xe vụ trễ hôm đầu', rejoin: 'Bà Delaney đã kiểm tra; dòng đó nằm trong hồ sơ.' },
  },
  steps: [
    { kind: 'goto', place: 'gus', label: 'Về văn phòng của Rico, cạnh chòi Gus' },
    { kind: 'scene', at: 'gus', who: ['delaney', 'rico', 'tess'], lines: [id('d01'), id('d02'), id('d03'), id('d04')] },
    // beat 1: phone two, three calls
    { kind: 'notebook', call: ['g01', 'g02', 'g03', 'g04'].map(id), entries: GRACE, repeat: { gcount: [id('g02r')], gtrain: [id('g03r')] }, patience: { after: 2, line: id('g05') } },
    { kind: 'notebook', via: 'voicemail', call: ['l01', 'l02', 'l03', 'l04'].map(id), entries: NELL, repeat: { nto: [id('l02r')], ntime: [id('l03r')] }, patience: { after: 2, line: id('l05') } },
    { kind: 'notebook', call: ['k01', 'k02', 'k03', 'k04'].map(id), entries: KEMP, repeat: { kto: [id('k02r')], kday: [id('k03r')] }, patience: { after: 2, line: id('k12') } },
    // beat 2: the read-back
    {
      kind: 'intent',
      who: 'rico',
      ask: [id('r01')],
      options: [
        { label: 'Sửa lại: năm giờ bốn mươi', say: id('r01a'), reply: [id('r02')] },
        { label: 'Rõ, để Rico đi', say: id('r01b'), reply: [id('r03'), id('r04')] },
      ],
      check: { right: 0, consequence: 'readback', fact: 'readback' },
    },
    // beat 3: Kemp rings back, with the inspector in the room
    {
      kind: 'intent',
      who: 'kemp',
      ask: [{ line: id('k05'), if: { not: ASKS_AGAIN } }, { line: id('k06'), if: ASKS_AGAIN }],
      options: [
        { label: 'Từ chối lịch sự', say: id('k05a'), reply: [id('k07'), id('k08')] },
        { label: 'Đốp lại: thôi nghe lén đi', say: id('k05b'), reply: [id('k09'), id('k10')] },
        { label: 'Chuyển máy cho Rico', say: id('k05c'), reply: [id('k11'), id('k13')] },
      ],
      check: { right: [0, 2], consequence: 'accused', fact: 'answer' },
    },
    {
      kind: 'intent',
      who: 'delaney',
      ask: [id('c01'), id('c02')],
      options: [
        { label: 'Nhận lỗi', say: id('c02a'), reply: [id('c03')] },
        { label: 'Đổ cho kẹt xe', say: id('c02b'), reply: [id('c04')] },
      ],
      check: { right: 0, consequence: 'excuse', fact: 'complaint' },
      if: { past: 'job-m2:hit:late' },
    },
    { kind: 'scene', at: 'gus', who: ['delaney'], lines: [{ line: id('f01'), if: wrong('gcount', 'gtrain') }, { line: id('f02'), if: wrong('nto', 'ntime') }, { line: id('f03'), if: wrong('kto', 'kday') }] },
  ],
  ending: {
    clean: [id('e1'), id('e2'), id('e6')],
    messy: [id('e3')],
    broken: [id('e4'), id('e5')],
  },
  news: { clean: [id('n1')], messy: [id('n3')], broken: [id('n2')] },
};
