// Act I, job 2: "Nửa sáu" ("Half five", docs/gta-story.md §4 job 2). After Vane, the Harbour Trust wants every stall
// on the harbour signed again, in person, before closing time; two have not signed: Sol's lantern stall and Fay's big
// wheel. Jun rings (soldering, quick). The learner gets Mei to mind Sol's stall, finds Mrs Delaney of the Trust at the
// foot of the stairs (Fay will not climb them), overhears Kemp on the corridor bench telling Shona which file is the
// thick one, and decides whose form goes in first. Kemp wins nothing tonight, legally.
//
// Changed from the outline (listed in docs/gta-plan.md §14 too):
//   - the Trust's office (new, not on the map) is staged at the electronics market on Quay Street, at Jun's stall
//     ('jun'): the stairs are off-screen; Mrs Delaney stands with the people at its foot;
//   - the deadline is the game's clock said "half {hour}" (JobDoc clock 'half'), not always 5:30; the look-alikes stay
//     half H / H−1:30 / H:00 ("half five" heard as half to five, or only "five" kept);
//   - "the green copy" / "the clean copy": a third way to write it, "the cream copy";
//   - the third place a careless ear goes for "Quay" is Meridian ("an office"), there being no place on Bay Road;
//   - "rushing through Gus's barrier" (a time written too early) is Gus shouting over the radio; the heat goes up by
//     the job's consequences as for every job (core/town/heat.ts);
//   - a job with "Sol only" written down goes to the office without Fay, and Mrs Delaney sends the learner back.
// Nobody of the town speaks: no clips.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-half5-${key}`;
const WHO = (v: string) => ({ note: 'who', value: v });

const LINES = [
  // ── beat 1: Jun rings ──
  { id: id('c01'), who: 'jun', text: "Hi, it's Jun. Sorry, I'm soldering, so I'll be quick.", vi: 'Chào, Jun đây. Xin lỗi, tôi đang hàn dở, nên nói nhanh nhé.' },
  { id: id('c02'), who: 'jun', text: 'The Harbour Trust put a notice up. Every stall has to sign again, in person.', vi: 'Ban quản lý cảng dán thông báo. Sạp nào cũng phải ký lại, tận nơi.' },
  { id: id('c03'), who: 'jun', text: "Two still haven't signed. Sol and Fay.", vi: 'Còn hai người chưa ký. Sol và Fay.' },
  { id: id('c04'), who: 'jun', text: "They've got till {time} today. After that it goes to tender.", vi: 'Họ có tới {time} hôm nay. Quá giờ là đem ra đấu thầu.' },
  { id: id('c05'), who: 'jun', text: "The Trust's office is upstairs, over the electronics market on Quay Street.", vi: 'Văn phòng Ban quản lý cảng ở tầng trên, phía trên chợ đồ điện tử ở phố Quay.' },
  { id: id('c06'), who: 'jun', text: 'And tell them to bring the green copy of the old lease.', vi: 'Và dặn họ mang theo bản màu xanh lá của hợp đồng cũ.' },
  { id: id('c03r'), who: 'jun', text: 'Sol and Fay. The lanterns and the big wheel.', vi: 'Sol và Fay. Sạp lồng đèn và vòng đu quay.' },
  { id: id('c04r'), who: 'jun', text: 'Till {time}. Not a minute after.', vi: 'Tới {time}. Không quá một phút.' },
  { id: id('c05r'), who: 'jun', text: 'Quay Street. Upstairs, over the electronics market. Over me.', vi: 'Phố Quay. Tầng trên, trên chợ đồ điện tử. Ngay trên đầu tôi.' },
  { id: id('c06r'), who: 'jun', text: 'The green copy. Green, like grass.', vi: 'Bản màu xanh lá. Xanh như cỏ ấy.' },
  { id: id('c08'), who: 'jun', text: "Sorry, the iron's getting cold. Last time, okay?", vi: 'Xin lỗi, mỏ hàn sắp nguội rồi. Lần cuối nhé?' },
  { id: id('c07'), who: 'jun', text: "Ow. That's the iron. Got to go. Thanks!", vi: 'Úi. Cái mỏ hàn. Tôi phải đi đây. Cảm ơn nhé!' },
  // ── beat 2: on the way ──
  { id: id('r01'), who: 'rico', text: 'Heard about the signing? Go on, then. And keep off the quay.', vi: 'Nghe vụ ký lại chưa? Đi đi. Mà đừng lái lên bờ cảng.' },
  { id: id('r02'), who: 'rico', text: 'Gus will kill us both if you drive on it.', vi: 'Lái lên đó là Gus giết cả hai đứa mình.' },
  { id: id('k01'), who: 'kit', text: 'This is Bay FM traffic, brought to you by Bayline.', vi: 'Đây là bản tin giao thông Bay FM, do Bayline tài trợ.' },
  { id: id('k02'), who: 'kit', text: "Bayline's driving stallholders to the Harbour Trust for free today.", vi: 'Hôm nay Bayline chở miễn phí các chủ sạp tới Ban quản lý cảng.' },
  { id: id('g01'), who: 'gus', text: "Oi! That was my barrier! There's no rush, slow down!", vi: 'Này! Thanh chắn của tôi đấy! Có gì đâu mà vội, chạy chậm lại!' },
  // ── the lantern stall ──
  { id: id('s01'), who: 'sol', text: "Sign today? It's Friday night. Friday's my busiest night.", vi: 'Ký hôm nay á? Tối thứ Sáu đấy. Tối thứ Sáu là tối đông khách nhất của tôi.' },
  { id: id('s02'), who: 'sol', text: 'If I leave the stall, I lose the whole evening.', vi: 'Tôi bỏ sạp đi là mất toi cả buổi tối.' },
  { id: id('s03'), who: 'mei', text: "I signed at nine this morning. In ink. Twice.", vi: 'Bà ký từ chín giờ sáng rồi. Bằng mực. Hai lần.' },
  { id: id('s04'), who: 'mei', text: "It's Fay you want, dear. The girl at the wheel.", vi: 'Cháu cần tìm Fay cơ. Cô bé ở vòng đu quay ấy.' },
  { id: id('m01'), who: 'mei', text: "So who's going to mind his lanterns, then?", vi: 'Thế ai trông lồng đèn cho cậu ấy đây?' },
  { id: id('m01a'), who: 'player', text: "Please, Mrs Mei. It's really urgent.", vi: 'Bà Mei ơi, giúp cháu. Gấp lắm ạ.' },
  { id: id('m01b'), who: 'player', text: 'No rush. Could you mind it for half an hour?', vi: 'Không gấp đâu ạ. Bà trông giúp nửa tiếng được không?' },
  { id: id('m01c'), who: 'player', text: 'Never mind. Sol can close for an hour.', vi: 'Thôi ạ. Sol đóng sạp một tiếng cũng được.' },
  { id: id('m02'), who: 'mei', text: "If it's urgent, it's lying, dear. Everybody knows that.", vi: 'Cái gì gấp thì cái đó là nói dối, cháu ạ. Ai chẳng biết.' },
  { id: id('m03'), who: 'mei', text: "I'll finish this batch first. Then we'll see.", vi: 'Bà gói xong mẻ này đã. Rồi tính sau.' },
  { id: id('m04'), who: 'mei', text: 'Half an hour? Go on, then. Off you go, both of you.', vi: 'Nửa tiếng à? Thôi được. Đi đi, cả hai đứa.' },
  { id: id('m05'), who: 'sol', text: 'Close? On a Friday? Not a chance.', vi: 'Đóng sạp? Tối thứ Sáu? Không đời nào.' },
  // ── the big wheel ──
  { id: id('f01'), who: 'fay', text: "Upstairs? The office is upstairs? I can't do stairs. Not high ones.", vi: 'Tầng trên á? Văn phòng ở tầng trên á? Tôi không leo cầu thang được. Cầu thang cao thì không.' },
  { id: id('f02'), who: 'fay', text: "I sell tickets for a wheel and I've never been up it. Laugh.", vi: 'Tôi bán vé vòng đu quay mà chưa lên nó bao giờ. Cười đi.' },
  { id: id('f03'), who: 'fay', text: "If someone brings the form down, I'll sign it on the pavement.", vi: 'Ai mang giấy xuống thì tôi ký ngay trên vỉa hè.' },
  // ── the office ──
  { id: id('w-ferry'), who: 'odile', text: 'The Trust? Quay Street, love. Key, like a door key.', vi: 'Ban quản lý cảng á? Phố Quay, cháu ạ. Đọc là "key", như chìa khóa ấy.' },
  { id: id('w-meridian'), who: 'hana', text: 'The Harbour Trust? Not here. Down on Quay Street, over the electronics.', vi: 'Ban quản lý cảng á? Không phải ở đây. Dưới phố Quay, phía trên chợ đồ điện tử.' },
  { id: id('a01'), who: 'jun', text: 'Looking for the Trust? Mrs Delaney. Red glasses, a clipboard. She never sits.', vi: 'Tìm Ban quản lý cảng à? Bà Delaney. Kính đỏ, kẹp hồ sơ. Bà ấy chẳng bao giờ ngồi.' },
  { id: id('q01'), who: 'player', text: 'Excuse me, are you from the Harbour Trust?', vi: 'Xin lỗi, bà có phải người của Ban quản lý cảng không ạ?' },
  { id: id('x-jun'), who: 'jun', text: "Me? I mend radios. She's the one with the clipboard.", vi: 'Tôi á? Tôi sửa bộ đàm. Người cầm kẹp hồ sơ kia kìa.' },
  { id: id('x-gus'), who: 'gus', text: 'I just guard the gate, mate. Try the red glasses.', vi: 'Tôi chỉ gác cổng thôi. Thử hỏi người đeo kính đỏ xem.' },
  { id: id('x-dev'), who: 'dev', text: "Not me. I'm waiting for Jun to fix my laptop.", vi: 'Không phải tôi. Tôi đang chờ Jun sửa cái máy tính.' },
  { id: id('d01'), who: 'delaney', text: "Delaney, Harbour Trust. You've come about the two leases?", vi: 'Delaney, Ban quản lý cảng. Bạn tới vì hai hợp đồng thuê à?' },
  { id: id('d02'), who: 'delaney', text: 'That is a clean copy. I need the green one, the old lease.', vi: 'Đó là bản in mới. Tôi cần bản màu xanh lá, hợp đồng cũ.' },
  { id: id('d03'), who: 'delaney', text: 'No green copy, no signature. Rules are rules.', vi: 'Không có bản màu xanh thì không ký. Luật là luật.' },
  { id: id('d04'), who: 'delaney', text: 'The green copies. Good. Somebody listened.', vi: 'Bản màu xanh. Tốt. Có người chịu nghe.' },
  { id: id('d05'), who: 'delaney', text: "That's one. The wheel hasn't signed either. Two were on my list.", vi: 'Mới một. Vòng đu quay cũng chưa ký. Danh sách của tôi có hai.' },
  { id: id('d06'), who: 'delaney', text: "It's gone {time}. I'll take them, but it goes in the file.", vi: 'Quá {time} rồi. Tôi vẫn nhận, nhưng sẽ ghi vào hồ sơ.' },
  { id: id('o01'), who: 'kemp', text: 'Shona? Two left. The wheel and the lantern stall.', vi: 'Shona à? Còn hai. Vòng đu quay và sạp lồng đèn.' },
  { id: id('o02'), who: 'kemp', text: "If they're not in by {time}, they go to tender on Monday.", vi: 'Nếu tới {time} chưa nộp, thứ Hai đem ra đấu thầu.' },
  { id: id('o03'), who: 'kemp', text: 'The wheel first. My bid for the wheel is the thick one.', vi: 'Vòng đu quay trước. Hồ sơ thầu vòng đu quay của tôi là bộ dày.' },
  { id: id('o04'), who: 'kemp', text: "Yes, I'm on the bench. I'm always on the bench.", vi: 'Ừ, tôi đang ngồi ghế. Lúc nào tôi cũng ngồi ghế.' },
  { id: id('d07'), who: 'delaney', text: 'Right. Two forms, one pen. Whose do I take first?', vi: 'Rồi. Hai tờ đơn, một cây bút. Tôi nhận của ai trước?' },
  { id: id('d07a'), who: 'player', text: "The big wheel first, please. Fay's.", vi: 'Vòng đu quay trước ạ. Của Fay.' },
  { id: id('d07b'), who: 'player', text: "Sol's lantern stall first, please.", vi: 'Sạp lồng đèn của Sol trước ạ.' },
  { id: id('d08'), who: 'delaney', text: 'The wheel. Fine. Signed, stamped, done.', vi: 'Vòng đu quay. Được. Ký, đóng dấu, xong.' },
  { id: id('d09'), who: 'delaney', text: "The lanterns, then. The wheel will have to wait. So will the clock.", vi: 'Vậy sạp lồng đèn. Vòng đu quay phải đợi. Đồng hồ thì không đợi đâu.' },
  // ── beat 4 ──
  { id: id('e1'), who: 'kemp', text: 'Both signed. Well done. Next time, then.', vi: 'Cả hai ký rồi. Giỏi lắm. Vậy để lần sau.' },
  { id: id('e2'), who: 'rico', text: "Two signatures, before the clock. That's the harbour's first win.", vi: 'Hai chữ ký, trước giờ. Đó là trận thắng đầu tiên của cảng.' },
  { id: id('e3'), who: 'delaney', text: 'Signed. And noted. I note everything.', vi: 'Ký rồi. Và đã ghi. Tôi ghi lại mọi thứ.' },
  { id: id('e4'), who: 'rico', text: 'We got there. The Trust writes everything down, mind.', vi: 'Cũng xong. Mà Ban quản lý cảng ghi lại hết đấy.' },
  { id: id('e5'), who: 'delaney', text: "Signed on the bottom step. I didn't hear the clock.", vi: 'Ký ở bậc thang cuối. Tôi không nghe thấy đồng hồ.' },
  { id: id('e6'), who: 'kemp', text: "I'll be putting in a complaint, Mrs Delaney. Politely.", vi: 'Tôi sẽ gửi đơn khiếu nại, bà Delaney. Một cách lịch sự.' },
  { id: id('n1'), who: 'kit', text: 'The lantern stall and the big wheel have both signed their new leases.', vi: 'Sạp lồng đèn và vòng đu quay đều đã ký hợp đồng thuê mới.' },
  { id: id('n2'), who: 'kit', text: "With minutes to spare. Bayline's free cars weren't needed.", vi: 'Còn dư mấy phút. Xe miễn phí của Bayline không cần tới.' },
  { id: id('n3'), who: 'kit', text: 'A last-minute dash at the Harbour Trust today. Everybody signed. Just.', vi: 'Hôm nay có một cuộc chạy nước rút ở Ban quản lý cảng. Ai cũng ký kịp. Vừa sát.' },
  { id: id('n4'), who: 'kit', text: 'Bayline says it has asked the Trust to look again at two late leases.', vi: 'Bayline cho biết họ đã đề nghị Ban quản lý cảng xem lại hai hợp đồng ký muộn.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'who',
    label: 'Ai chưa ký',
    line: id('c03'),
    answer: 'fay',
    options: [
      { value: 'fay', label: 'Sol và Fay' },
      { value: 'mei', label: 'Sol và bà Mei' },
      { value: 'sol', label: 'Chỉ có Sol' },
    ],
  },
  { key: 'time', label: 'Hạn chót', line: id('c04'), answer: '', options: [] },
  {
    key: 'where',
    label: 'Ký ở đâu',
    line: id('c05'),
    answer: 'quay',
    options: [
      { value: 'quay', label: 'Văn phòng trên chợ đồ điện tử, phố Quay' },
      { value: 'ferry', label: 'Ở bến phà' },
      { value: 'meridian', label: 'Trụ sở Meridian' },
    ],
  },
  {
    key: 'copy',
    label: 'Mang theo gì',
    line: id('c06'),
    answer: 'green',
    options: [
      { value: 'green', label: 'Bản màu xanh lá của hợp đồng cũ' },
      { value: 'clean', label: 'Bản in mới' },
      { value: 'cream', label: 'Bản màu kem' },
    ],
  },
];

const NO_FAY = WHO('sol');
const COPY_WRONG = { note: 'copy', is: 'wrong' as const };

export const JOB_HALF5: JobDoc = {
  id: 'job-half5',
  title: 'Nửa sáu',
  blurb: 'Ban quản lý cảng bắt mọi chủ sạp ký lại tận nơi trước giờ đóng cửa. Còn hai người chưa ký, và Kemp đang ngồi chờ.',
  level: 2,
  order: 3,
  opens: ['ct-rico-1'],
  after: 'job-m2',
  from: 'jun',
  clock: 'half',
  lines: LINES,
  facts: [
    { id: 'who', label: 'Ai chưa ký', line: id('c03'), consequence: 'who' },
    { id: 'time', label: 'Hạn chót', line: id('c04'), consequence: 'late', early: 'barrier' },
    { id: 'where', label: 'Ký ở đâu', line: id('c05'), consequence: 'wrongPlace', byAction: true },
    { id: 'copy', label: 'Mang theo gì', line: id('c06'), consequence: 'copy' },
    { id: 'rule', label: 'Quy tắc của bà Mei', line: id('m01'), consequence: 'waited', byAction: true },
    { id: 'first', label: 'Hồ sơ nào Kemp nhắm', line: id('o03'), consequence: 'order', byAction: true },
  ],
  consequences: {
    who: { name: 'Ghi sai người chưa ký: phải quay lại tìm người còn lại', rejoin: 'Bà Mei hoặc bà Delaney chỉ đúng người; cả hai vẫn ký.' },
    late: { name: 'Ghi giờ muộn (hoặc tới muộn): ký sau hạn, bà Delaney ghi vào hồ sơ', rejoin: 'Bà Delaney vẫn nhận đơn, kèm một dòng trong hồ sơ.' },
    barrier: { name: 'Ghi giờ sớm: phóng xe qua thanh chắn của Gus', rejoin: 'Gus quát qua bộ đàm; bạn vẫn tới kịp.' },
    wrongPlace: { name: 'Tới nhầm chỗ ký', rejoin: 'Có người chỉ phố Quay; bạn tới muộn hơn một chút.' },
    copy: { name: 'Mang nhầm bản hợp đồng', rejoin: 'Chạy lại vòng đu quay lấy bản màu xanh rồi quay lại.' },
    waited: { name: 'Nói "gấp lắm" với bà Mei: bà bắt đợi gói xong mẻ há cảo', rejoin: 'Bà Mei vẫn trông sạp giúp Sol.' },
    order: { name: 'Đưa hồ sơ sạp lồng đèn lên trước', rejoin: 'Vòng đu quay vẫn ký, sát giờ hơn.' },
    wrongPerson: { name: 'Hỏi nhầm người ở chân cầu thang', rejoin: 'Người bị hỏi chỉ bà Delaney.' },
  },
  steps: [
    // beat 1: Jun on the phone
    {
      kind: 'notebook',
      call: ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07'].map(id),
      entries: NOTEBOOK,
      repeat: { who: [id('c03r')], time: [id('c04r')], where: [id('c05r')], copy: [id('c06r')] },
      patience: { after: 3, line: id('c08') },
    },
    // beat 2: the radio on the way (Rico's channel is still the old one, so Kemp hears it too)
    { kind: 'radio', lines: [id('r01'), id('r02'), { line: id('g01'), if: { note: 'time', is: 'early' } }, id('k01'), id('k02')] },
    { kind: 'goto', place: 'sol', label: 'Tới sạp lồng đèn của Sol ở chợ đêm' },
    { kind: 'scene', at: 'sol', who: ['sol', 'mei'], lines: [id('s01'), id('s02'), { line: id('s03'), if: WHO('mei') }, { line: id('s04'), if: WHO('mei') }] },
    {
      kind: 'intent',
      who: 'mei',
      ask: [id('m01')],
      options: [
        { label: 'Nhờ bà, gấp lắm', say: id('m01a'), reply: [id('m02'), id('m03')] },
        { label: 'Nhờ bà, không gấp', say: id('m01b'), reply: [id('m04')] },
        { label: 'Để Sol tự đóng sạp', say: id('m01c'), reply: [id('m05'), id('m04')] },
      ],
      check: { right: [1, 2], consequence: 'waited', fact: 'rule' },
    },
    { kind: 'goto', place: 'fay', label: 'Tới vòng đu quay của Fay', if: { not: NO_FAY } },
    { kind: 'scene', at: 'fay', who: ['fay'], lines: [id('f01'), id('f02'), id('f03')], if: { not: NO_FAY } },
    // beat 3: the office (at the electronics market), Mrs Delaney at the foot of the stairs
    {
      kind: 'pickup',
      entry: 'where',
      places: { quay: 'jun', ferry: 'odile', meridian: 'priya' },
      place: 'jun',
      wrongPlace: { lines: [{ line: id('w-ferry'), if: { note: 'where', value: 'ferry' } }, { line: id('w-meridian'), if: { note: 'where', value: 'meridian' } }], consequence: 'wrongPlace' },
      arrive: [id('a01')],
      crowd: ['jun', 'gus', 'dev'],
      passenger: 'delaney',
      board: false,
      ask: [id('q01')],
      notMe: { jun: [id('x-jun')], gus: [id('x-gus')], dev: [id('x-dev')] },
      wrongPerson: 'wrongPerson',
      greet: [id('d01'), { line: id('d02'), if: COPY_WRONG }, { line: id('d03'), if: COPY_WRONG }, { line: id('d04'), if: { not: COPY_WRONG } }, { line: id('d05'), if: NO_FAY }, { line: id('d06'), if: { any: [{ flag: 'late' }, { note: 'time', is: 'late' }] } }],
    },
    // a wrong copy or a forgotten Fay: back to the wheel, and back again
    { kind: 'goto', place: 'fay', label: 'Quay lại vòng đu quay', if: { any: [COPY_WRONG, NO_FAY] } },
    { kind: 'scene', at: 'fay', who: ['fay'], lines: [id('f03')], if: { any: [COPY_WRONG, NO_FAY] } },
    { kind: 'goto', place: 'jun', label: 'Quay lại chỗ bà Delaney', if: { any: [COPY_WRONG, NO_FAY] } },
    { kind: 'overhear', at: 'jun', who: ['kemp'], lines: ['o01', 'o02', 'o03', 'o04'].map(id), passes: 2 },
    {
      kind: 'intent',
      who: 'delaney',
      ask: [id('d07')],
      options: [
        { label: 'Vòng đu quay của Fay trước', say: id('d07a'), reply: [id('d08')] },
        { label: 'Sạp lồng đèn của Sol trước', say: id('d07b'), reply: [id('d09')] },
      ],
      check: { right: 0, consequence: 'order', fact: 'first' },
    },
  ],
  ending: {
    clean: [id('e1'), id('e2')],
    messy: [id('e3'), id('e4')],
    broken: [id('e5'), id('e6')],
  },
  news: { clean: [id('n1'), id('n2')], messy: [id('n3')], broken: [id('n4')] },
};
