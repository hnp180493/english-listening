// Act II, job 4a: "Ca đêm" ("Night shift", docs/gta-story-2.md §4 job 4a; Gus's chain). The warehouse row has rules at
// night. Gus, in his hut with the police scanner on low, tells the learner when the patrol passes, when the watchman's
// shift is, and which lamp means somebody is in. The learner walks Quay Street to warehouse fifteen, and for the first
// time keeps out of a patrol's sight by ear.
//
// As built, against the bible:
//   - the patrol is a real car (step `patrol`) driving Quay Street while the scanner talks, sent when the learner is on
//     the street (a game's night cannot be waited for in a job: the clock of the time noted is said, not waited for);
//     a time noted wrong is Gus shouting it is here already; being seen is a consequence of its own (the heat as the
//     streets' rules have it; nobody stops the learner);
//   - the shift noted wrong: the watchman (the Bayline driver) is arriving at the door as the learner gets there;
//   - the lamp noted wrong: the learner reports the wrong door's lamp and Gus corrects it on the radio;
//   - "Marcus 5a before Gus 4a" (`past: 'job-callin:watchman'`): Gus knows the learner heard the watchman's hours on the
//     call-in show, one line more;
//   - who may come along: Tess (from her coffee cart on the way back: she names the watchman's car) or Rico (he waits on
//     East Road, engine off, and says so).
// Nobody of the town speaks: no clips.

import { CREW_CUT } from '../../../core/town/crew';
import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-night-${key}`;

const LINES = [
  // ── beat 1: Gus's hut ──
  { id: id('a01'), who: 'gus', text: 'Nights on the warehouse row have rules. Learn them, and nobody looks twice.', vi: 'Đêm ở dãy kho có luật. Thuộc luật thì chẳng ai nhìn bạn lần hai.' },
  { id: id('a02'), who: 'gus', text: 'The patrol comes down Quay Street at {time}. Every night, like a clock.', vi: 'Xe tuần tra chạy xuống Quay Street lúc {time}. Đêm nào cũng thế, như cái đồng hồ.' },
  { id: id('a03'), who: 'gus', text: "Fifteen's watchman is on from ten till two. Then the place is empty.", vi: 'Người gác kho mười lăm trực từ mười giờ tới hai giờ. Sau đó kho trống.' },
  { id: id('a04'), who: 'gus', text: "If the lamp over the side door's lit, somebody's in. Keep walking.", vi: 'Nếu đèn trên cửa hông sáng là có người trong. Cứ đi tiếp.' },
  { id: id('a07'), who: 'gus', text: 'Scanner stays on low. If it says Quay Street, you listen.', vi: 'Máy quét cứ để nhỏ. Nó nói Quay Street là bạn nghe.' },
  { id: id('a05'), who: 'gus', text: "You heard his sister on Marcus's show. Same hours, I'd bet.", vi: 'Bạn nghe chị của anh ta trên chương trình của Marcus rồi. Chắc cùng giờ đó.' },
  { id: id('a02r'), who: 'gus', text: 'At {time}. You could set your watch by them.', vi: 'Lúc {time}. Đúng tới mức chỉnh đồng hồ theo được.' },
  { id: id('a03r'), who: 'gus', text: 'From ten. Till two. Four hours of him.', vi: 'Từ mười giờ. Tới hai giờ. Bốn tiếng có anh ta.' },
  { id: id('a04r'), who: 'gus', text: 'The side door. Side, like the side of your face.', vi: 'Cửa hông. Hông, như bên má ấy.' },
  { id: id('a06'), who: 'gus', text: "I've told you three times, mate. Write it on your hand.", vi: 'Tôi nói ba lần rồi. Viết lên tay đi.' },
  // ── with Rico / Tess ──
  { id: id('r01'), who: 'rico', text: "I'll wait on East Road, engine off. Shout, and I'm there.", vi: 'Tôi chờ trên East Road, tắt máy. Gọi là tôi tới.' },
  { id: id('t01'), who: 'tess', text: "Blue Bayline car pulling in by fifteen. That'll be your watchman.", vi: 'Xe Bayline màu xanh đang vào cạnh kho mười lăm. Chắc là người gác của bạn.' },
  { id: id('r02'), who: 'rico', text: "Patrol's turning into Quay Street. I can see the lights.", vi: 'Xe tuần tra đang rẽ vào Quay Street. Tôi thấy đèn rồi.' },
  { id: id('t02'), who: 'tess', text: 'He parks badly. Bayline drivers always do.', vi: 'Anh ta đỗ xe ẩu lắm. Tài xế Bayline ai cũng thế.' },
  // ── beat 2: Quay Street at night ──
  { id: id('b01'), who: 'gus', text: "On Quay Street? Good. Walk like you live here.", vi: 'Tới Quay Street chưa? Tốt. Đi như người sống ở đây.' },
  { id: id('b02'), who: 'gus', text: "That's the patrol, now! Early for you, on time for them. Doorway!", vi: 'Xe tuần tra kìa, ngay bây giờ! Sớm với bạn, đúng giờ với họ. Nép vào cửa!' },
  { id: id('b03'), who: 'gus', text: 'Patrol any second. Find a doorway before you hear the tyres.', vi: 'Xe tuần tra sắp tới. Tìm chỗ nép trước khi nghe tiếng bánh xe.' },
  { id: id('s01'), who: 'scanner-desk', text: 'Unit twelve, your pass down Quay Street, please, heading west.', vi: 'Xe mười hai, chạy qua Quay Street, hướng tây.' },
  { id: id('s02'), who: 'scanner-unit', text: 'Unit twelve. Quay Street. Quiet tonight.', vi: 'Xe mười hai. Quay Street. Tối nay yên tĩnh.' },
  { id: id('s03'), who: 'scanner-unit', text: 'Unit twelve. One person on foot, near fifteen. Noted.', vi: 'Xe mười hai. Một người đi bộ, gần kho mười lăm. Đã ghi.' },
  { id: id('b05'), who: 'gus', text: "Gone past. They never saw you. That's the whole trick.", vi: 'Đi qua rồi. Họ chẳng thấy bạn. Mẹo chỉ có thế.' },
  { id: id('b06'), who: 'gus', text: 'Rain helps, too. Nobody listens hard in the rain.', vi: 'Mưa cũng giúp. Trời mưa chẳng ai nghe kỹ.' },
  { id: id('b04'), who: 'gus', text: "They saw you. They wrote you down. Don't stop, don't run.", vi: 'Họ thấy bạn rồi. Họ ghi lại rồi. Đừng dừng, đừng chạy.' },
  // ── at the door ──
  { id: id('w01'), who: 'driver', text: "Evening. I'm on now. You lost, or looking for something?", vi: 'Chào. Tôi vào ca rồi. Bạn lạc à, hay tìm gì?' },
  { id: id('w02'), who: 'player', text: 'Just lost. Wrong street. Goodnight.', vi: 'Lạc thôi. Nhầm phố. Chào nhé.' },
  { id: id('w03'), who: 'gus', text: "That was him starting, not finishing. Ten till two, not ten to two.", vi: 'Đó là lúc anh ta vào ca, không phải hết ca. Mười giờ tới hai giờ, không phải hai giờ kém mười.' },
  { id: id('w04'), who: 'gus', text: "Ten till two. So from two the door's quiet. Not tonight, though.", vi: 'Mười giờ tới hai giờ. Vậy từ hai giờ cửa im ắng. Nhưng không phải tối nay.' },
  { id: id('l01'), who: 'player', text: "The lamp over the sliding door is lit. Somebody's in?", vi: 'Đèn trên cửa trượt đang sáng. Có người trong à?' },
  { id: id('l02'), who: 'player', text: 'The lamp by the stairs is lit. Is that him?', vi: 'Đèn cạnh cầu thang đang sáng. Có phải anh ta không?' },
  { id: id('l03'), who: 'gus', text: "Side door, not slide. Look again. The side door's lamp is dark.", vi: 'Cửa hông, không phải cửa trượt. Nhìn lại đi. Đèn cửa hông đang tối.' },
  { id: id('l04'), who: 'player', text: "The side door lamp is dark. Nobody's in yet.", vi: 'Đèn cửa hông đang tối. Chưa có ai trong.' },
  { id: id('l05'), who: 'gus', text: "Dark, so he's not in yet. That's your answer.", vi: 'Tối, vậy là anh ta chưa vào. Đó là câu trả lời.' },
  // ── the end ──
  { id: id('e1'), who: 'gus', text: 'Patrol, shift, lamp. You know the row at night now.', vi: 'Xe tuần tra, ca gác, ngọn đèn. Giờ bạn biết dãy kho ban đêm rồi.' },
  { id: id('e2'), who: 'gus', text: "Bit of a wobble. You'll walk it better next time.", vi: 'Hơi chệch choạc. Lần sau đi trơn hơn.' },
  { id: id('e3'), who: 'gus', text: 'The row noticed you tonight. It notices everybody once.', vi: 'Tối nay dãy kho để ý bạn rồi. Ai nó cũng để ý một lần.' },
  { id: id('e5'), who: 'gus', text: "Next time I'll send you inside. Not tonight.", vi: 'Lần sau tôi cho bạn vào trong. Không phải tối nay.' },
  { id: id('e4'), who: 'rico', text: 'Engine on. Get in. Tell me everything on the way.', vi: 'Nổ máy rồi. Lên xe. Kể hết trên đường.' },
  { id: id('n1'), who: 'kit', text: 'Police report a quiet night on the harbour, apart from one late walker.', vi: 'Cảnh sát báo đêm qua ở cảng yên tĩnh, trừ một người đi bộ khuya.' },
  { id: id('n3'), who: 'kit', text: "The harbour patrol's report mentions one wrong turn on Quay Street.", vi: 'Báo cáo của xe tuần tra cảng có nhắc một người rẽ nhầm trên Quay Street.' },
  { id: id('n2'), who: 'kit', text: 'A patrol noted somebody on foot by the warehouses last night.', vi: 'Tối qua một xe tuần tra ghi nhận có người đi bộ cạnh dãy kho.' },
];

const NOTEBOOK: NoteEntry[] = [
  { key: 'time', label: 'Xe tuần tra qua lúc', line: id('a02'), answer: '', options: [] },
  {
    key: 'shift',
    label: 'Người gác trực',
    line: id('a03'),
    answer: '10-2',
    options: [
      { value: '10-2', label: 'Từ 10 giờ tới 2 giờ' },
      { value: '1-50', label: 'Lúc 1 giờ 50 ("ten to two")' },
      { value: '10-12', label: 'Từ 10 giờ tới 12 giờ' },
    ],
  },
  {
    key: 'lamp',
    label: 'Đèn nào sáng là có người',
    line: id('a04'),
    answer: 'side',
    options: [
      { value: 'side', label: 'Đèn trên cửa hông' },
      { value: 'slide', label: 'Đèn trên cửa trượt' },
      { value: 'stairs', label: 'Đèn cạnh cầu thang' },
    ],
  },
];

export const JOB_NIGHT: JobDoc = {
  id: 'job-night',
  title: 'Ca đêm',
  blurb: 'Gus dạy luật đêm của dãy kho: giờ tuần tra, ca gác, ngọn đèn. Lần đầu bạn tự né xe tuần tra bằng tai.',
  level: 2,
  order: 15,
  opens: ['ct-rico-1'],
  after: 'job-sale',
  from: 'gus',
  clock: 'quarter',
  lines: LINES,
  facts: [
    { id: 'time', label: 'Xe tuần tra qua lúc', line: id('a02'), consequence: 'patrol' },
    { id: 'shift', label: 'Người gác trực', line: id('a03'), consequence: 'shift' },
    { id: 'lamp', label: 'Đèn nào sáng là có người', line: id('a04'), consequence: 'lamp' },
  ],
  consequences: {
    patrol: { name: 'Ghi sai giờ tuần tra: xe tới khi bạn còn giữa đường', rejoin: 'Gus quát kịp; bạn nép vào một cửa.' },
    seen: { name: 'Xe tuần tra thấy và ghi lại bạn', rejoin: 'Họ đi tiếp; độ nóng theo luật đường phố.' },
    shift: { name: 'Ghi sai ca gác: tới cửa đúng lúc người gác vào ca', rejoin: 'Bạn giả vờ lạc đường rồi quay lui.' },
    lamp: { name: 'Nhìn nhầm đèn: báo sai cửa', rejoin: 'Gus sửa qua bộ đàm.' },
  },
  crew: {
    roles: [
      { who: 'tess', role: 'Người canh', listen: 'Tess canh từ xe cà phê: cô báo xe của người gác trước khi anh ta tới cửa.', opens: { heard: ['ct-tess-2'] }, cut: CREW_CUT.friend },
      { who: 'rico', role: 'Lái xe', listen: 'Rico chờ trên East Road, tắt máy: có xe đón, và một giọng quen trên bộ đàm.', opens: { heard: ['ct-rico-1'] }, cut: CREW_CUT.friend },
    ],
  },
  steps: [
    { kind: 'goto', place: 'gus', label: 'Tới chòi của Gus' },
    { kind: 'notebook', via: 'scene', call: [id('a01'), id('a07'), id('a02'), id('a03'), id('a04'), { line: id('a05'), if: { past: 'job-callin:watchman' } }], entries: NOTEBOOK, repeat: { time: [id('a02r')], shift: [id('a03r')], lamp: [id('a04r')] }, patience: { after: 3, line: id('a06') } },
    { kind: 'radio', lines: [id('r01')], if: { crew: 'rico' } },
    // beat 2: Quay Street at night; the patrol comes
    { kind: 'goto', place: 'w15-front', label: 'Đi dọc Quay Street tới kho mười lăm' },
    { kind: 'radio', lines: [id('b01'), id('b06'), { line: id('r02'), if: { crew: 'rico' } }, { line: id('b02'), if: { note: 'time', is: 'wrong' } }, { line: id('b03'), if: { note: 'time', is: 'right' } }] },
    { kind: 'patrol', street: 'Quay Street', seconds: 15, lines: [{ line: id('s01') }, { line: id('s02'), at: 6 }], seen: { consequence: 'seen', lines: [id('s03'), id('b04')] } },
    { kind: 'radio', lines: [id('b05')], if: { not: { hit: 'seen' } } },
    // beat 3: at the door
    { kind: 'phone', lines: [id('t01'), id('t02')], if: { crew: 'tess' } },
    { kind: 'radio', lines: [id('w04')], if: { note: 'shift', is: 'right' } },
    { kind: 'scene', lines: [id('w01'), id('w02'), id('w03')], if: { note: 'shift', is: 'wrong' } },
    { kind: 'radio', lines: [{ line: id('l01'), if: { note: 'lamp', value: 'slide' } }, { line: id('l02'), if: { note: 'lamp', value: 'stairs' } }, { line: id('l03'), if: { note: 'lamp', is: 'wrong' } }, id('l04'), id('l05')] },
  ],
  ending: { clean: [id('e1'), id('e5'), { line: id('e4'), if: { crew: 'rico' } }], messy: [id('e2'), { line: id('e4'), if: { crew: 'rico' } }], broken: [id('e3'), { line: id('e4'), if: { crew: 'rico' } }] },
  news: { clean: [id('n1')], messy: [id('n3')], broken: [id('n2')] },
};
