// Act II, job 2a: "Đường truyền ngoài trời" ("The open-air link", docs/gta-story-2.md §4 job 2a; Jun's chain). The
// talkback line between the Bay FM stage on the harbour and the studio is on open air, like the Harbour Trust's channel
// in Act I. Jun sends the learner to the corner where it is loudest with a scanner set to its frequency; Kit says a test
// line on the link from the stage; the learner brings it back word for word. If the learner heard it, anybody with a
// scanner can: Kemp included.
//
// As built, against the bible:
//   - Jun briefs the learner at his stall in person (notebook via 'scene'); the corner is a job spot ('quay-east');
//     the two wrong corners are Gus's hut on Pier Road and the ferry quay ("the quay"), where Jun rings and corrects;
//   - Kit's test line is a broken-up line (JobLine `broken`: pieces with silences at the "...", no noise mixed in),
//     heard on the scanner; the learner types it back at Jun's stall (the password step) instead of picking it;
//   - the test line's three ways (kettle's on / off, cattle) are what a careless ear types, judged by the typing helper;
//   - who may come along: Kit (he says the test a second time, slowly, from the stage) or Tess (she watches from her
//     cart and sees a Bayline car parked on Quay Street with its windows down; the car is drawn there, `park`);
//   - Jun himself is the one who asks, so he is not a crew choice; the "kettle" of the bible's §5 is read later as
//     `past: 'job-link'` and `{ not: { past: 'job-link:hit:test' } }`.
// Nobody of the town speaks: no clips.

import { CREW_CUT } from '../../../core/town/crew';
import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-link-${key}`;
const CORNER = (v: string) => ({ note: 'corner', value: v });

const LINES = [
  // ── beat 1: Jun's stall ──
  { id: id('a00'), who: 'rico', text: "Jun's got a theory about the talkback. He won't stop saying it.", vi: 'Jun có một giả thuyết về đường talkback. Cậu ấy nói mãi không thôi.' },
  { id: id('a01'), who: 'jun', text: "It's not a theory. It's a radio. Radios don't keep secrets.", vi: 'Đó không phải giả thuyết. Đó là cái đài. Đài thì không giữ bí mật.' },
  { id: id('a02'), who: 'jun', text: 'The talkback runs from the Bay FM stage to the studio, on open air.', vi: 'Đường talkback chạy từ sân khấu Bay FM về phòng thu, trên sóng hở.' },
  { id: id('a03'), who: 'jun', text: "Stand at the corner of Quay Street and East Road. That's where it's loudest.", vi: 'Đứng ở góc Quay Street và East Road. Chỗ đó nghe to nhất.' },
  { id: id('a04'), who: 'jun', text: 'Set the scanner to eighteen point two, and wait for Kit.', vi: 'Chỉnh máy quét về mười tám phẩy hai, rồi chờ Kit.' },
  { id: id('a05'), who: 'jun', text: 'Kit will say a test line from the stage. Remember it word for word.', vi: 'Kit sẽ nói một câu thử từ sân khấu. Nhớ nguyên văn.' },
  { id: id('a06'), who: 'jun', text: 'Then come back here and tell me exactly what he said.', vi: 'Rồi quay về đây kể lại đúng từng chữ anh ấy nói.' },
  { id: id('a03r'), who: 'jun', text: 'Quay Street and East Road. The far corner, by the crossing.', vi: 'Quay Street và East Road. Góc xa, chỗ vạch qua đường.' },
  { id: id('a04r'), who: 'jun', text: 'Eighteen. Point two. One, eight, point two.', vi: 'Mười tám. Phẩy hai. Một, tám, phẩy hai.' },
  { id: id('a07'), who: 'jun', text: "I've got a radio in pieces here. Last time, alright?", vi: 'Tôi đang có cái đài tháo tung ở đây. Lần cuối nhé?' },
  // ── with Kit ──
  { id: id('k01'), who: 'kit', text: "Kit here. I'll be on the stage mic at the top of the hour.", vi: 'Kit đây. Đúng giờ chẵn tôi lên micro ở sân khấu.' },
  { id: id('k02'), who: 'kit', text: "I'll say the test twice, slowly. I've had practice.", vi: 'Tôi sẽ nói câu thử hai lần, chậm. Tôi quen rồi.' },
  // ── with Tess ──
  { id: id('t01'), who: 'tess', text: "Bayline car parked on Quay Street, by the big wheel. Windows down.", vi: 'Có xe Bayline đỗ trên Quay Street, cạnh vòng đu quay. Kính hạ xuống.' },
  { id: id('t02'), who: 'tess', text: "He's listening to something. Same as you, I'd say.", vi: 'Hắn đang nghe cái gì đó. Giống bạn, chắc vậy.' },
  // ── beat 2: the corner ──
  { id: id('b01'), who: 'jun', text: "That's Pier Road, by Gus. Quay Street and East Road, I said.", vi: 'Đó là Pier Road, chỗ Gus. Tôi nói Quay Street và East Road mà.' },
  { id: id('b02'), who: 'jun', text: "That's the ferry quay. Not the quay. Quay Street, and East Road.", vi: 'Đó là bến phà. Không phải bến. Phố Quay, và East Road.' },
  { id: id('q01'), who: 'jun', text: 'You at the corner? Good. Scanner on, volume up.', vi: 'Bạn tới góc chưa? Tốt. Bật máy quét, vặn to lên.' },
  { id: id('q02'), who: 'player', text: "I'm here. The scanner's on. Just hiss so far.", vi: 'Tôi tới rồi. Máy quét bật rồi. Mới chỉ có tiếng rè.' },
  { id: id('q04'), who: 'jun', text: "If you hear Bayline's desk, you're on the wrong channel.", vi: 'Nếu bạn nghe tổng đài Bayline là sai kênh rồi.' },
  { id: id('q03'), who: 'jun', text: 'Hiss is good. Hiss means the set is listening.', vi: 'Rè là tốt. Rè nghĩa là máy đang nghe.' },
  // ── beat 3: on the scanner ──
  { id: id('c01'), who: 'baydesk', text: 'Car six, the harbour. Car six, the harbour gate, please.', vi: 'Xe sáu, cảng. Xe sáu, cổng cảng nhé.' },
  { id: id('c02'), who: 'jun', text: "That's Bayline's taxi channel. Eighteen point two, not that one.", vi: 'Đó là kênh taxi của Bayline. Mười tám phẩy hai, không phải kênh đó.' },
  { id: id('c03'), who: 'kit', text: "Testing... one, two... testing... the kettle's on.", vi: 'Thử... một, hai... thử... ấm nước đang đun.', broken: true },
  { id: id('c04'), who: 'kit', text: "Once more, slowly. Testing, one, two. The kettle's on.", vi: 'Thêm lần nữa, chậm. Thử, một, hai. Ấm nước đang đun.' },
  { id: id('c06'), who: 'kit', text: 'Kit to studio... can you hear me... over.', vi: 'Kit gọi phòng thu... nghe thấy không... hết.', broken: true },
  { id: id('c07'), who: 'jun', text: "That's the whole link. Out loud, to the whole street.", vi: 'Đó là cả đường truyền. Nói to, cho cả phố nghe.' },
  { id: id('c08'), who: 'jun', text: 'You heard that? So did anyone else with a scanner.', vi: 'Bạn nghe thấy chứ? Ai có máy quét cũng nghe thấy.' },
  { id: id('k03'), who: 'kit', text: 'Did that come through? I said it twice, like I promised.', vi: 'Có nghe được không? Tôi nói hai lần như đã hứa.' },
  { id: id('t03'), who: 'tess', text: "He's driving off now. Towards Bay Road. In no hurry.", vi: 'Hắn đang chạy đi. Về phía Bay Road. Chẳng vội gì.' },
  { id: id('c05'), who: 'jun', text: 'Got it? Now come back to my stall and tell me.', vi: 'Nghe được chưa? Giờ về sạp tôi mà kể.' },
  // ── beat 4: back at the stall ──
  { id: id('p01'), who: 'jun', text: 'Go on, then. What did Kit say on the link?', vi: 'Nói đi. Kit nói gì trên đường truyền?' },
  { id: id('p02'), who: 'jun', text: "The kettle's on. Word for word. So the link shouts to anyone.", vi: 'Ấm nước đang đun. Đúng từng chữ. Vậy là đường truyền gào cho ai cũng nghe.' },
  { id: id('p03'), who: 'jun', text: 'Nearly. On or off? Think about the hiss, not the words.', vi: 'Gần đúng. Đun hay tắt? Nghĩ về tiếng rè, đừng nghĩ chữ.' },
  { id: id('p04'), who: 'jun', text: "Not quite. Kit said the kettle's on. I asked him after.", vi: 'Chưa đúng. Kit nói ấm nước đang đun. Tôi hỏi lại anh ấy rồi.' },
  // ── the end ──
  { id: id('e1'), who: 'jun', text: 'Open air. Anyone with a scanner hears the talkback. Including Kemp.', vi: 'Sóng hở. Ai có máy quét cũng nghe được talkback. Kể cả Kemp.' },
  { id: id('e2'), who: 'jun', text: "I'll write it up for Mrs Delaney. Dates, frequency, the lot.", vi: 'Tôi sẽ viết lại cho bà Delaney. Ngày giờ, tần số, đủ cả.' },
  { id: id('e3'), who: 'jun', text: 'We got there. The link leaks, and now we can say so.', vi: 'Cũng xong. Đường truyền rò, và giờ mình nói được điều đó.' },
  { id: id('e4'), who: 'jun', text: 'We know it leaks. Proving it took us all evening.', vi: 'Biết là nó rò. Chứng minh thì mất cả buổi tối.' },
  { id: id('e6'), who: 'rico', text: 'So Kemp could hear our talkback all along. Course he could.', vi: 'Vậy là Kemp nghe được talkback của mình từ lâu. Đương nhiên rồi.' },
  { id: id('e5'), who: 'kit', text: 'Was that a test? Nobody told me it was a test.', vi: 'Đó là thử à? Có ai bảo tôi là thử đâu.' },
  { id: id('n1'), who: 'kit', text: "Bay FM's engineer reminds listeners the station is still on air. Just.", vi: 'Kỹ thuật viên Bay FM nhắc thính giả là đài vẫn còn phát. Vừa đủ.' },
  { id: id('n2'), who: 'kit', text: 'A strange test on our talkback tonight. Somebody was listening, apparently.', vi: 'Tối nay có một cuộc thử lạ trên đường talkback. Hình như có người nghe.' },
  { id: id('n3'), who: 'kit', text: 'Our talkback line had a busy night. Busier than our listeners.', vi: 'Đường talkback của đài có một đêm bận rộn. Bận hơn cả thính giả.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'corner',
    label: 'Đứng ở đâu để thu',
    line: id('a03'),
    answer: 'east',
    options: [
      { value: 'east', label: 'Góc Quay Street và East Road' },
      { value: 'pier', label: 'Góc Pier Road, chỗ Gus' },
      { value: 'quay', label: 'Ở bến phà ("the quay")' },
    ],
  },
  {
    key: 'freq',
    label: 'Tần số',
    line: id('a04'),
    answer: '18.2',
    options: [
      { value: '18.2', label: '18.2' },
      { value: '80.2', label: '80.2' },
      { value: '8.2', label: '8.2' },
    ],
  },
];

export const JOB_LINK: JobDoc = {
  id: 'job-link',
  title: 'Đường truyền ngoài trời',
  blurb: 'Jun tin đường talkback của Bay FM nói ra sóng hở. Đứng đúng góc phố, chỉnh đúng tần số, nghe Kit nói thử.',
  level: 2,
  order: 11,
  opens: ['ct-rico-1'],
  after: 'job-sale',
  from: 'jun',
  lines: LINES,
  facts: [
    { id: 'corner', label: 'Đứng ở đâu để thu', line: id('a03'), consequence: 'corner' },
    { id: 'freq', label: 'Tần số', line: id('a04'), consequence: 'freq' },
    { id: 'word', label: 'Câu thử của Kit', line: id('c03'), consequence: 'test', byAction: true },
  ],
  consequences: {
    corner: { name: 'Đứng nhầm góc phố: chỉ có tiếng rè, Jun phải gọi chỉ lại', rejoin: 'Bạn tới đúng góc, muộn hơn một chút.' },
    freq: { name: 'Chỉnh nhầm tần số: nghe nhầm kênh taxi của Bayline', rejoin: 'Jun chỉ lại, bạn chuyển đúng kênh.' },
    test: { name: 'Không nói lại được câu thử của Kit', rejoin: 'Jun hỏi Kit sau; đường truyền vẫn bị chứng minh là rò.' },
  },
  crew: {
    roles: [
      { who: 'kit', role: 'Người nói thử', listen: 'Kit biết đường truyền: anh nói câu thử hai lần, lần sau chậm và rõ.', opens: { heard: ['ct-kit-2'] }, cut: CREW_CUT.friend },
      { who: 'tess', role: 'Người canh', listen: 'Tess canh từ xe cà phê: cô báo có xe Bayline đỗ gần, cũng đang nghe.', opens: { heard: ['ct-tess-2'] }, cut: CREW_CUT.friend },
    ],
  },
  steps: [
    { kind: 'goto', place: 'jun', label: 'Tới sạp của Jun' },
    { kind: 'scene', at: 'jun', who: ['jun', 'rico'], lines: [id('a00'), id('a01')] },
    { kind: 'notebook', via: 'scene', call: ['a02', 'a03', 'a04', 'a05', 'a06'].map(id), entries: NOTEBOOK, repeat: { corner: [id('a03r')], freq: [id('a04r')] }, patience: { after: 2, line: id('a07') } },
    { kind: 'phone', lines: [id('k01'), id('k02')], if: { crew: 'kit' } },
    // beat 2: the corner noted (a wrong one: nothing but hiss, Jun rings)
    { kind: 'goto', place: 'gus', label: 'Tới góc phố đã ghi', if: CORNER('pier') },
    { kind: 'phone', lines: [id('b01')], if: CORNER('pier') },
    { kind: 'goto', place: 'odile', label: 'Tới chỗ đã ghi', if: CORNER('quay') },
    { kind: 'phone', lines: [id('b02')], if: CORNER('quay') },
    { kind: 'goto', place: 'quay-east', label: 'Tới góc Quay Street và East Road' },
    { kind: 'scene', at: 'fay', lines: [id('t01'), id('t02'), id('t03')], park: [{ at: 'fay', look: 2 }], if: { crew: 'tess' } },
    { kind: 'phone', lines: [id('q01'), id('q02'), id('q03'), id('q04')] },
    // beat 3: on the scanner (a wrong frequency first finds Bayline's taxi channel)
    { kind: 'radio', lines: [id('c01'), id('c02')], if: { note: 'freq', is: 'wrong' } },
    { kind: 'radio', lines: [id('c03'), { line: id('c04'), if: { crew: 'kit' } }, { line: id('k03'), if: { crew: 'kit' } }, id('c06'), id('c07'), id('c08'), id('c05')] },
    // beat 4: back at Jun's stall, the test line typed
    { kind: 'password', who: 'jun', line: id('c03'), chunk: "the kettle's on", ask: id('p01'), right: id('p02'), close: id('p03'), wrong: id('p04'), consequence: 'test' },
  ],
  ending: { clean: [id('e1'), id('e2'), id('e6')], messy: [id('e3'), id('e2')], broken: [id('e4'), id('e5')] },
  news: { clean: [id('n1'), id('n2')], messy: [id('n2')], broken: [id('n3')] },
};
