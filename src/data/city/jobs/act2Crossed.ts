// Act II, job 2b: "Đường dây chéo" ("Crossed line", docs/gta-story-2.md §4 job 2b; Jun's chain, after "Đường truyền
// ngoài trời"). The cordless phone in Kemp's office at warehouse fifteen is an old one, on open air. Tonight Kemp rings
// Mr Ashby of Coastline Radio. Jun leaves a voice message: where to sit, when. The learner sits in a car on Quay Street
// while a patrol goes by, and hears the call through the hiss: the floor price and the day the board meets.
//
// As built, against the bible:
//   - Jun's briefing is a VOICE MESSAGE on the phone (notebook `via: 'voicemail'`); the car on Quay Street is warehouse
//     fifteen's back door ('w15-back'); the wrong places are Pier Road (Gus's hut) and the ferry quay, where Jun rings;
//   - the patrol is a real one (step `patrol`: a car drives Quay Street while the scanner talks); being seen is a
//     consequence. With Gus along he watches for a second pass and says when to put the lights off;
//   - the call is heard through the hiss (its lines `broken`) and noted; with Max along it is his coin recorder's tape,
//     heard back at the hideout (Jun's stall when the learner has none: notebook `via: 'tape'`), as often as wanted;
//   - Mei's chain first (`past: 'job-second'`): Jun knows what to listen for (Kemp "keeps every word"), one line more;
//     the last of the four chains (`count` of the other three b-jobs done is three): Shona has been round Jun's van;
//   - the floor wrong: Claire has to ring Mr Ashby to ask (it shows their hand); the date wrong: Mrs Delaney books her
//     inspection late and moves it. Kept as `hit:floor` / `hit:date` for "Kho 15".
// Max is of the town ('phone'): his five lines are clips (connected only), the browser voice until the owner makes them.

import { CREW_CUT } from '../../../core/town/crew';
import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-crossed-${key}`;
const WHERE = (v: string) => ({ note: 'where', value: v });
const MAX = { crew: 'phone' };
const LAST_CHAIN = { count: [{ past: 'job-dumplings' }, { past: 'job-water' }, { past: 'job-farewell' }], min: 3 };

const LINES = [
  // ── beat 1: Jun's voice message ──
  { id: id('a01'), who: 'jun', text: "It's Jun. Kemp's office phone is a cordless, an old one. It leaks.", vi: 'Jun đây. Điện thoại văn phòng Kemp là loại không dây, đời cũ. Nó rò sóng.' },
  { id: id('a02'), who: 'jun', text: 'Tonight he rings Mr Ashby, the Coastline man. At {time}, give or take.', vi: 'Tối nay hắn gọi ông Ashby, người của Coastline. Tầm {time}.' },
  { id: id('a03'), who: 'jun', text: "Sit in a car on Quay Street, behind his warehouse. Quay, like a key.", vi: 'Ngồi trong xe trên Quay Street, sau kho của hắn. Quay, đọc như "key".' },
  { id: id('a04'), who: 'jun', text: "Lights off, engine off. I'll patch the scanner to your radio.", vi: 'Tắt đèn, tắt máy. Tôi nối máy quét vào bộ đàm của bạn.' },
  { id: id('a05'), who: 'jun', text: 'Mei says he keeps every word. So we keep this one.', vi: 'Bà Mei bảo hắn giữ mọi lời. Vậy mình giữ lời này.' },
  { id: id('a06'), who: 'jun', text: "Shona's been round my van twice today. Be careful tonight.", vi: 'Hôm nay Shona đi vòng quanh xe tôi hai lần. Tối nay cẩn thận.' },
  { id: id('a07'), who: 'jun', text: "Ring me after. Not before. He'd hear my phone too.", vi: 'Gọi tôi sau. Đừng gọi trước. Hắn cũng nghe được điện thoại tôi.' },
  { id: id('a02r'), who: 'jun', text: 'At {time}. He rings on the dot.', vi: 'Lúc {time}. Hắn gọi đúng giờ.' },
  { id: id('a03r'), who: 'jun', text: 'Quay Street. The back of warehouse fifteen.', vi: 'Phố Quay. Phía sau kho mười lăm.' },
  // ── the wrong places ──
  { id: id('b01'), who: 'jun', text: "Pier Road? No, Quay Street. Behind the warehouse, not by Gus.", vi: 'Pier Road à? Không, Quay Street. Sau kho, không phải chỗ Gus.' },
  { id: id('b02'), who: 'jun', text: "That's the ferry quay. Quay Street, I said. Like a key.", vi: 'Đó là bến phà. Tôi nói phố Quay mà. Đọc như "key".' },
  { id: id('b04'), who: 'jun', text: "You're early. Sit tight, and try to look bored.", vi: 'Bạn tới sớm. Ngồi yên, làm như đang chán.' },
  { id: id('b03'), who: 'jun', text: "You're late. He's been on the phone a minute already.", vi: 'Bạn tới muộn. Hắn nói điện thoại được một phút rồi.' },
  // ── beat 2: the patrol on Quay Street ──
  { id: id('s01'), who: 'scanner-desk', text: 'Unit twelve, a slow pass down Quay Street, please. Reports of a parked car.', vi: 'Xe mười hai, chạy chậm qua Quay Street. Có báo có xe đỗ.' },
  { id: id('s02'), who: 'scanner-unit', text: 'Unit twelve. On Quay Street now, heading west.', vi: 'Xe mười hai. Đang ở Quay Street, đi về hướng tây.' },
  { id: id('s03'), who: 'scanner-unit', text: 'Unit twelve. One car, lights off. Moving on.', vi: 'Xe mười hai. Một xe, tắt đèn. Đi tiếp.' },
  { id: id('s04'), who: 'jun', text: 'They saw you. Fine. Just a car. Sit very still now.', vi: 'Họ thấy bạn rồi. Không sao. Chỉ là một chiếc xe. Giờ ngồi im.' },
  { id: id('s05'), who: 'scanner-unit', text: 'Unit twelve. Clear of Quay Street, heading for Bay Road.', vi: 'Xe mười hai. Ra khỏi Quay Street, về phía Bay Road.' },
  { id: id('g01'), who: 'gus', text: "Gus here. Patrol's coming round again. Lights off, now.", vi: 'Gus đây. Xe tuần tra vòng lại. Tắt đèn, ngay.' },
  { id: id('g02'), who: 'gus', text: "Gone past. You're a shadow, mate. Well done.", vi: 'Đi qua rồi. Bạn là cái bóng. Giỏi lắm.' },
  // ── beat 3: the call through the hiss ──
  { id: id('c01'), who: 'kemp', text: 'Mr Ashby. Duncan Kemp. Thank you for... taking my call.', vi: 'Ông Ashby. Duncan Kemp đây. Cảm ơn ông đã... nghe máy.', broken: true },
  { id: id('c02'), who: 'ashby', text: 'Mr Kemp. The board... wants it done. Quietly.', vi: 'Ông Kemp. Hội đồng... muốn xong việc. Lặng lẽ.', broken: true },
  { id: id('c03'), who: 'ashby', text: 'Anything over... forty thousand... and it is yours.', vi: 'Bất cứ giá nào trên... bốn mươi nghìn... là của ông.', broken: true },
  { id: id('c04'), who: 'kemp', text: 'And the board meets... on the thirteenth?', vi: 'Và hội đồng họp... vào ngày mười ba?', broken: true },
  { id: id('c05'), who: 'ashby', text: 'The thirteenth. Bring... a pen.', vi: 'Ngày mười ba. Mang theo... một cây bút.', broken: true },
  { id: id('c06'), who: 'kemp', text: "I always do, Mr Ashby. I'll bring... two.", vi: 'Lúc nào tôi cũng mang, ông Ashby. Tôi mang... hai cây.', broken: true },
  { id: id('c07'), who: 'kemp', text: 'My bid stands... at forty-one. Goodnight... Mr Ashby.', vi: 'Giá của tôi giữ... ở bốn mươi mốt. Chúc ngủ ngon... ông Ashby.', broken: true },
  // ── with Max: the tape ──
  { id: id('m01'), who: 'phone', text: "Recorder was under his window, mate. Got the lot, hiss and all.", vi: 'Máy ghi âm nằm dưới cửa sổ hắn. Thu được hết, cả tiếng rè.' },
  { id: id('m02'), who: 'phone', text: "Here's the tape. Rewind as much as you like. It's counted, mind.", vi: 'Đây là cuộn băng. Tua bao nhiêu cũng được. Mà có đếm đấy.' },
  { id: id('m03'), who: 'phone', text: "Forty grand and the thirteenth. That's what I heard, anyway.", vi: 'Bốn mươi nghìn và ngày mười ba. Tôi nghe vậy, dù sao.' },
  { id: id('m04'), who: 'phone', text: "That's a different number to mine, mate. Play it once more.", vi: 'Số đó khác số tôi nghe. Mở lại lần nữa đi.' },
  { id: id('m05'), who: 'phone', text: "Battery's done. Forty for a battery, I told you.", vi: 'Hết pin rồi. Bốn mươi một cục pin, tôi bảo rồi mà.' },
  // ── beat 4 ──
  { id: id('d01'), who: 'claire', text: 'Fourteen thousand? I rang Mr Ashby to check. He sounded surprised.', vi: 'Mười bốn nghìn? Tôi gọi ông Ashby hỏi lại. Ông ấy nghe có vẻ ngạc nhiên.' },
  { id: id('d02'), who: 'claire', text: "Forty thousand. I've got the figure. Now we need the money.", vi: 'Bốn mươi nghìn. Tôi có con số rồi. Giờ cần tiền.' },
  { id: id('d03'), who: 'delaney', text: 'The board meets on the thirteenth? I had the thirtieth. I will move it.', vi: 'Hội đồng họp ngày mười ba à? Tôi ghi ngày ba mươi. Tôi sẽ dời lại.' },
  { id: id('d04'), who: 'delaney', text: 'The thirteenth. My inspection will be the night before. Noted.', vi: 'Ngày mười ba. Buổi kiểm tra của tôi sẽ vào đêm trước. Đã ghi.' },
  { id: id('e1'), who: 'jun', text: 'The figure and the day. Off his own phone. Only this once.', vi: 'Con số và ngày họp. Từ chính điện thoại của hắn. Chỉ lần này thôi.' },
  { id: id('e2'), who: 'jun', text: 'We heard enough. Not everything. Enough.', vi: 'Mình nghe đủ. Không phải mọi thứ. Đủ.' },
  { id: id('e3'), who: 'jun', text: "A bad night on the scanner. We'll make do with what we've got.", vi: 'Một đêm tệ với máy quét. Có gì dùng nấy.' },
  { id: id('e4'), who: 'jun', text: "Mei won't like how we got it. I don't either.", vi: 'Bà Mei sẽ không thích cách mình có được nó. Tôi cũng vậy.' },
  { id: id('n1'), who: 'kit', text: "Coastline Radio confirms Bay FM's board meets later this month.", vi: 'Coastline Radio xác nhận hội đồng của Bay FM họp cuối tháng này.' },
  { id: id('n2'), who: 'kit', text: 'A patrol on Quay Street last night found one parked car, and nobody in it.', vi: 'Một xe tuần tra trên Quay Street tối qua thấy một xe đỗ, không có ai.' },
];

const BRIEF: NoteEntry[] = [
  { key: 'time', label: 'Kemp gọi lúc', line: id('a02'), answer: '', options: [] },
  {
    key: 'where',
    label: 'Ngồi đâu',
    line: id('a03'),
    answer: 'quay',
    options: [
      { value: 'quay', label: 'Trong xe trên Quay Street' },
      { value: 'pier', label: 'Trên Pier Road' },
      { value: 'ferry', label: 'Ở bến ("the quay")' },
    ],
  },
];

const CALL = (suffix: string): NoteEntry[] => [
  {
    key: `floor${suffix}`,
    label: 'Giá sàn',
    line: id('c03'),
    answer: '40',
    options: [
      { value: '40', label: 'Bốn mươi nghìn' },
      { value: '14', label: 'Mười bốn nghìn' },
      { value: '4', label: 'Bốn nghìn' },
    ],
  },
  {
    key: `date${suffix}`,
    label: 'Ngày họp hội đồng',
    line: id('c04'),
    answer: '13',
    options: [
      { value: '13', label: 'Ngày mười ba' },
      { value: '30', label: 'Ngày ba mươi' },
      { value: '3', label: 'Ngày mùng ba' },
    ],
  },
];

const WRONG_FLOOR = { any: [{ note: 'floor', is: 'wrong' as const }, { note: 'floor-t', is: 'wrong' as const }] };
const WRONG_DATE = { any: [{ note: 'date', is: 'wrong' as const }, { note: 'date-t', is: 'wrong' as const }] };

export const JOB_CROSSED: JobDoc = {
  id: 'job-crossed',
  title: 'Đường dây chéo',
  blurb: 'Điện thoại không dây trong văn phòng Kemp rò sóng. Tối nay hắn gọi người của Coastline: nghe qua tiếng rè, bắt đúng con số.',
  level: 3,
  order: 12,
  opens: ['ct-rico-1'],
  after: 'job-link',
  from: 'jun',
  clock: 'ten',
  lines: LINES,
  facts: [
    { id: 'time', label: 'Kemp gọi lúc', line: id('a02'), consequence: 'late', early: 'early' },
    { id: 'where', label: 'Ngồi đâu', line: id('a03'), consequence: 'where' },
    { id: 'floor', label: 'Giá sàn', line: id('c03'), consequence: 'floor' },
    { id: 'date', label: 'Ngày họp hội đồng', line: id('c04'), consequence: 'date' },
  ],
  consequences: {
    late: { name: 'Ghi giờ muộn (hoặc tới muộn): lỡ đầu cuộc gọi', rejoin: 'Bạn vẫn nghe được con số.' },
    early: { name: 'Ghi giờ sớm: ngồi chờ lâu trong xe, dễ bị để ý', rejoin: 'Cuộc gọi tới đúng giờ; bạn vẫn ở đó.' },
    where: { name: 'Ngồi nhầm chỗ: Jun phải gọi chỉ lại', rejoin: 'Bạn tới sau kho, kịp cuộc gọi.' },
    seen: { name: 'Xe tuần tra để ý chiếc xe đỗ', rejoin: 'Họ đi tiếp; bạn ngồi im hơn.' },
    floor: { name: 'Ghi sai giá sàn: Claire phải gọi ông Ashby hỏi lại, lộ ý', rejoin: 'Claire có đúng con số, muộn một ngày.' },
    date: { name: 'Ghi sai ngày họp: bà Delaney xếp lịch muộn rồi phải dời', rejoin: 'Buổi kiểm tra vẫn kịp trước ngày họp.' },
  },
  crew: {
    roles: [
      { who: 'phone', role: 'Máy ghi âm', listen: 'Max gài máy dưới cửa sổ văn phòng: cuộc gọi được ghi, bạn nghe lại ở chỗ ẩn, tua bao nhiêu cũng được.', opens: { hearts: 4 }, cut: CREW_CUT.friend, with: 'ride' },
      { who: 'gus', role: 'Người gác cảng', listen: 'Gus canh xe tuần tra từ chòi: anh báo trước khi nó vòng lại.', opens: { heard: ['ct-gus-2'] }, cut: CREW_CUT.friend },
    ],
  },
  steps: [
    { kind: 'notebook', via: 'voicemail', call: [id('a01'), id('a02'), id('a03'), id('a04'), { line: id('a05'), if: { past: 'job-second' } }, { line: id('a06'), if: LAST_CHAIN }, id('a07')], entries: BRIEF, repeat: { time: [id('a02r')], where: [id('a03r')] } },
    { kind: 'goto', place: 'gus', label: 'Tới chỗ đã ghi', if: WHERE('pier') },
    { kind: 'phone', lines: [id('b01')], if: WHERE('pier') },
    { kind: 'goto', place: 'odile', label: 'Tới chỗ đã ghi', if: WHERE('ferry') },
    { kind: 'phone', lines: [id('b02')], if: WHERE('ferry') },
    { kind: 'goto', place: 'w15-back', label: 'Ngồi trong xe trên Quay Street, sau kho mười lăm', deadline: { consequence: 'late', lines: [id('b03')] } },
    { kind: 'phone', lines: [id('b04')], if: { note: 'time', is: 'early' } },
    // beat 2: a patrol drives Quay Street while the learner waits
    { kind: 'patrol', street: 'Quay Street', seconds: 16, lines: [{ line: id('s01') }, { line: id('s02'), at: 4 }, { line: id('s03'), at: 10 }, { line: id('s05'), at: 14 }], seen: { consequence: 'seen', lines: [id('s04')] } },
    { kind: 'scanner', lines: [id('g01')], if: { crew: 'gus' } },
    { kind: 'patrol', street: 'Quay Street', seconds: 12, lines: [{ line: id('s02') }], seen: { consequence: 'seen' }, if: { crew: 'gus' } },
    { kind: 'phone', lines: [id('g02')], if: { crew: 'gus' } },
    // beat 3: the call (late: its start is missed); with Max, his tape at the hideout
    { kind: 'notebook', via: 'radio', call: [{ line: id('c01'), if: { not: { hit: 'late' } } }, id('c02'), id('c03'), id('c04'), id('c05'), id('c06'), id('c07')], entries: CALL(''), if: { not: MAX } },
    { kind: 'phone', lines: [id('m01')], if: MAX },
    { kind: 'notebook', via: 'tape', call: [id('m02'), id('c01'), id('c02'), id('c03'), id('c04'), id('c05'), id('c06'), id('c07')], entries: CALL('-t'), patience: { after: 3, line: id('m05') }, if: MAX },
    { kind: 'phone', lines: [{ line: id('m03'), if: { all: [{ note: 'floor-t', is: 'right' }, { note: 'date-t', is: 'right' }] } }, { line: id('m04'), if: { any: [{ note: 'floor-t', is: 'wrong' }, { note: 'date-t', is: 'wrong' }] } }], if: MAX },
    // beat 4: what the figures do
    { kind: 'phone', lines: [{ line: id('d01'), if: WRONG_FLOOR }, { line: id('d02'), if: { not: WRONG_FLOOR } }, { line: id('d03'), if: WRONG_DATE }, { line: id('d04'), if: { not: WRONG_DATE } }] },
  ],
  ending: { clean: [id('e1'), id('e4')], messy: [id('e2'), id('e4')], broken: [id('e3')] },
  news: { clean: [id('n1')], messy: [id('n1'), id('n2')], broken: [id('n2')] },
};
