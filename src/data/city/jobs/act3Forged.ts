// Act III, job 1: "Tin nhắn không phải của Rico" (docs/gta-story-3.md §4.1). Kemp lost Bay FM but kept twenty years of
// the city's voices; now he fights with forged tapes. Tess has a voice message "from Rico": take the firm's books and the
// gatehouse key to a man from the Harbour Trust at the ticket office. It is not Rico. The words give it away (the
// fingerprint table, gta-story-3 §2): Rico says the half hour as "half nine" (half5.ts, channels.ts), never "nine
// thirty"; he calls the learner "partner"; and he never leaves a short message. The learner notes where and whom,
// presses "Đó!" on the line where it stops sounding like him, and tells Tess; then goes to see who turns up.
//
// Uses only steps the engine has: notebook via voicemail, spot via phone, intent, goto, phone, scene. The man in the
// grey coat is Lyle Penn, the impersonator (new, browser voice, SCENE_VOICES.lyle); the forged lines are said by 'rico'
// (same browser voice as Rico: the difference is in the words, as the act's rule says).

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-forged-${key}`;
const PLACE = (v: string) => ({ note: 'place', value: v });

const LINES = [
  // ── beat 1: Tess's cart ──
  { id: id('a01'), who: 'tess', text: 'Rico left me a message at six. Listen to it. Then tell me.', vi: 'Rico để lại tin nhắn cho tôi lúc sáu giờ. Nghe đi. Rồi nói tôi biết.' },
  { id: id('a02'), who: 'tess', text: "After warehouse fifteen, I don't trust a voice on a phone.", vi: 'Sau vụ kho mười lăm, tôi không tin giọng nào qua điện thoại nữa.' },
  { id: id('a02b'), who: 'tess', text: 'A fake Gus nearly sent Mrs Delaney to warehouse fifty. Remember?', vi: 'Một ông Gus giả suýt đưa bà Delaney tới kho năm mươi. Nhớ không?' },
  // ── the message (the forgery) ──
  { id: id('v01'), who: 'rico', as: 'lyle', text: "Tess, it's me. No time, I'm driving. Listen.", vi: 'Tess, tôi đây. Không có thời gian, tôi đang lái. Nghe này.' },
  { id: id('v02'), who: 'rico', as: 'lyle', text: 'A man from the Harbour Trust needs our books. And the gatehouse key.', vi: 'Một người của Ban quản lý cảng cần sổ sách của mình. Và chìa khóa trạm gác.' },
  { id: id('v03'), who: 'rico', as: 'lyle', text: 'Meet him by the ticket office at Central Station.', vi: 'Gặp ông ấy cạnh quầy bán vé ở nhà ga Trung tâm.' },
  { id: id('v04'), who: 'rico', as: 'lyle', text: 'His name is Mr Clarke. Ask for Mr Clarke.', vi: 'Tên ông ấy là Clarke. Hỏi ông Clarke.' },
  { id: id('v05'), who: 'rico', as: 'lyle', text: 'Be there at nine thirty. Do not be late.', vi: 'Có mặt lúc chín giờ ba mươi. Đừng tới muộn.' },
  { id: id('v06'), who: 'rico', as: 'lyle', text: 'Thanks, Tess. Bye.', vi: 'Cảm ơn, Tess. Chào.' },
  { id: id('v03r'), who: 'rico', as: 'lyle', text: 'By the ticket office. Central Station.', vi: 'Cạnh quầy bán vé. Nhà ga Trung tâm.' },
  { id: id('v04r'), who: 'rico', as: 'lyle', text: 'Mr Clarke. With an E.', vi: 'Ông Clarke. Có chữ E.' },
  { id: id('v07'), who: 'tess', text: "That's the whole message. Play it again as often as you like.", vi: 'Tin nhắn chỉ có vậy. Bạn nghe lại bao nhiêu lần tùy.' },
  // ── where does it stop sounding like him ──
  { id: id('s01'), who: 'tess', text: 'Once more. Stop me where it stops sounding like Rico.', vi: 'Thêm lần nữa. Dừng tôi ở chỗ nó hết giống Rico.' },
  // ── is it him ──
  { id: id('q01'), who: 'tess', text: "So? Is that Rico, or isn't it? I've got the books right here.", vi: 'Sao? Đó là Rico hay không? Sổ sách tôi để ngay đây.' },
  { id: id('q01a'), who: 'player', text: "It's not him. Rico says half nine, never nine thirty.", vi: 'Không phải anh ấy. Rico nói "half nine", không bao giờ "nine thirty".' },
  { id: id('q01b'), who: 'player', text: "It's him. Take the books and go.", vi: 'Anh ấy đấy. Mang sổ đi đi.' },
  { id: id('q01c'), who: 'player', text: "Let's ring Rico first. That message was far too short for him.", vi: 'Gọi Rico đã. Tin nhắn đó ngắn quá, không giống anh ấy.' },
  { id: id('q02'), who: 'tess', text: 'Half nine. Of course. He has never said nine thirty in his life.', vi: 'Half nine. Đúng rồi. Cả đời anh ấy chưa nói "nine thirty" lần nào.' },
  { id: id('q03'), who: 'tess', text: "Fine. Books under my arm. If it's him, he owes me a coffee.", vi: 'Được. Sổ kẹp nách. Nếu đúng là anh ấy thì anh nợ tôi một ly cà phê.' },
  { id: id('r01'), who: 'rico', text: "Partner! I didn't ring Tess. I've been on the ferry run since five.", vi: 'Cộng sự! Tôi có gọi Tess đâu. Tôi chạy tuyến bến phà từ năm giờ.' },
  { id: id('r02'), who: 'rico', text: 'Nobody gets our books. Go and see who turns up. I want a face.', vi: 'Không ai được lấy sổ của mình. Đi xem ai tới. Tôi muốn biết mặt.' },
  { id: id('r03'), who: 'rico', text: "Tess? Turn round. Whoever that was, it wasn't me. Half nine, I'd say.", vi: 'Tess? Quay lại đi. Ai đó thì đó cũng không phải tôi. Tôi sẽ nói "half nine".' },
  // ── the ticket office ──
  { id: id('w01'), who: 'tess', text: 'That was the lost property office. Wrong window. The ticket office is next door.', vi: 'Đó là phòng đồ thất lạc. Sai cửa. Quầy bán vé ở ngay bên cạnh.' },
  { id: id('w02'), who: 'tess', text: "That's the taxi rank. He said the ticket office. Inside, on the left.", vi: 'Đó là bến taxi. Anh ta nói quầy bán vé. Ở trong, bên trái.' },
  { id: id('o01'), who: 'okafor', text: 'A Mr Clarke from the Trust? Grey coat, by the timetable. Been waiting.', vi: 'Ông Clarke của Ban quản lý cảng à? Áo xám, cạnh bảng giờ tàu. Chờ nãy giờ.' },
  { id: id('o02'), who: 'okafor', text: "Mr Clark? Without the E? No, love. There's a Mr Clarke, grey coat.", vi: 'Ông Clark không có chữ E à? Không, cháu. Có ông Clarke, áo xám.' },
  { id: id('o03'), who: 'okafor', text: "Mr Black? Nobody of that name. You mean the grey coat, I expect.", vi: 'Ông Black à? Không có ai tên đó. Chắc ý cháu là ông áo xám.' },
  { id: id('l01'), who: 'lyle', text: "Clarke, Harbour Trust. Mrs Delaney's office. You've brought the books?", vi: 'Clarke, Ban quản lý cảng. Văn phòng bà Delaney. Mang sổ tới chưa?' },
  { id: id('l02'), who: 'okafor', text: "Mrs Delaney's suspended, love. The whole station knows that.", vi: 'Bà Delaney bị đình chỉ rồi, anh. Cả nhà ga ai cũng biết.' },
  { id: id('l03'), who: 'lyle', text: 'Then there has been a mistake. Good evening.', vi: 'Vậy là có nhầm lẫn rồi. Chào buổi tối.' },
  { id: id('l04'), who: 'mei', text: 'Walked off very fast for a man who made a mistake, dear.', vi: 'Đi nhanh quá cho một người vừa nhầm lẫn, cháu ạ.' },
  { id: id('l05'), who: 'tess', text: "He's gone. But I'd know that walk again. Grey coat, no Trust badge.", vi: 'Đi rồi. Nhưng dáng đi đó tôi nhận ra được. Áo xám, không đeo thẻ Ban quản lý cảng.' },
  { id: id('l06'), who: 'tess', text: 'And he has my books under his arm. Rico is going to kill me.', vi: 'Và sổ của tôi đang kẹp dưới nách hắn. Rico sẽ giết tôi mất.' },
  { id: id('l07'), who: 'rico', text: "Last week's fares, Tess. That's all it had. Let him read about my tips.", vi: 'Tiền cuốc tuần trước thôi, Tess. Chỉ có thế. Cho hắn đọc tiền boa của tôi.' },
  // ── the end ──
  { id: id('e01'), who: 'tess', text: 'You caught it. One word in the wrong place, and you caught it.', vi: 'Bạn bắt được rồi. Một chữ sai chỗ, và bạn bắt được.' },
  { id: id('e02'), who: 'rico', text: "Somebody's cutting our voices up, partner. This is only the first one.", vi: 'Có người đang cắt ghép giọng của mình, cộng sự. Đây mới là cái đầu tiên.' },
  { id: id('e03'), who: 'tess', text: 'We got there. Late, and a bit lost, but we got there.', vi: 'Mình tới nơi. Muộn, hơi lạc, nhưng tới nơi.' },
  { id: id('e04'), who: 'tess', text: "Next time, I'm asking you before I pick up a single book.", vi: 'Lần sau, tôi hỏi bạn trước khi cầm tới một cuốn sổ.' },
  { id: id('n1'), who: 'marcus', text: 'A word to Westbay. If a message is in a hurry, ring the person back.', vi: 'Một lời với Westbay. Tin nhắn nào hối thúc thì gọi lại cho chính người đó.' },
  { id: id('n2'), who: 'marcus', text: 'A man in a grey coat says he works for the Harbour Trust. He does not.', vi: 'Một người mặc áo xám nói mình làm cho Ban quản lý cảng. Không phải đâu.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'place',
    label: 'Gặp ở đâu',
    line: id('v03'),
    answer: 'okafor',
    options: [
      { value: 'okafor', label: 'Quầy bán vé, nhà ga Trung tâm' },
      { value: 'pete', label: 'Phòng đồ thất lạc ở nhà ga' },
      { value: 'rico', label: 'Bến taxi' },
    ],
  },
  {
    key: 'name',
    label: 'Hỏi ai',
    line: id('v04'),
    answer: 'clarke',
    options: [
      { value: 'clarke', label: 'Ông Clarke (có chữ E)' },
      { value: 'clark', label: 'Ông Clark' },
      { value: 'black', label: 'Ông Black' },
    ],
  },
];

export const JOB_FORGED: JobDoc = {
  id: 'job-forged',
  title: 'Tin nhắn không phải của Rico',
  blurb: 'Tess nhận tin nhắn thoại "của Rico" bảo đem sổ sách và chìa khóa trạm gác cho người lạ. Nghe ra chỗ nó không giống Rico.',
  level: 2,
  order: 20,
  opens: ['ct-rico-1'],
  after: 'job-warehouse',
  from: 'tess',
  lines: LINES,
  facts: [
    { id: 'place', label: 'Gặp ở đâu', line: id('v03'), consequence: 'place' },
    { id: 'name', label: 'Hỏi ai', line: id('v04'), consequence: 'name' },
    { id: 'tell', label: 'Chỗ không giống Rico', line: id('v05'), consequence: 'tell', byAction: true },
    { id: 'trust', label: 'Có phải Rico không', line: id('q01'), consequence: 'fooled', byAction: true },
  ],
  consequences: {
    place: { name: 'Ghi sai chỗ hẹn: tới nhầm cửa ở nhà ga', rejoin: 'Tess chỉ đúng quầy bán vé, ngay bên cạnh.' },
    name: { name: 'Ghi sai tên: hỏi nhầm người ở quầy', rejoin: 'Bà Okafor chỉ người áo xám.' },
    tell: { name: 'Bấm "Đó!" sai chỗ: chưa chỉ ra được chữ lộ', rejoin: 'Tess nghe lại một mình và tự thấy "nine thirty".' },
    fooled: { name: 'Bảo Tess đi: cô mang theo sổ sách, người áo xám cầm được sổ', rejoin: 'Rico gọi kịp; sổ chỉ có tiền cuốc tuần trước.' },
  },
  crew: {
    roles: [{ who: 'mei', role: 'Đứng xem ở nhà ga', listen: 'Mei đứng ở quầy bán vé: bà nói ra cái bà thấy ở người áo xám khi hắn bỏ đi.', opens: { heard: ['ct-mei-2'] }, cut: CREW_CUT.friend, with: { at: 'okafor' } }],
  },
  steps: [
    { kind: 'goto', place: 'tess', label: 'Tới xe cà phê của Tess' },
    { kind: 'scene', at: 'tess', lines: [id('a01'), id('a02'), { line: id('a02b'), if: { past: 'job-warehouse:hit:trap' } }] },
    {
      kind: 'notebook',
      via: 'voicemail',
      call: [id('v01'), id('v02'), id('v03'), id('v04'), id('v05'), id('v06')],
      entries: NOTEBOOK,
      repeat: { place: [id('v03r')], name: [id('v04r')] },
      patience: { after: 3, line: id('v07') },
    },
    // where does it stop sounding like him: "Đó!" on "nine thirty"
    { kind: 'scene', at: 'tess', lines: [id('s01')] },
    { kind: 'spot', lines: ['v01', 'v02', 'v05', 'v06'].map(id), at: id('v05'), early: 'tell', late: 'tell', never: 'tell', fact: 'tell', via: 'phone' },
    {
      kind: 'intent',
      who: 'tess',
      ask: [id('q01')],
      options: [
        { label: 'Không phải Rico: anh ấy nói "half nine"', say: id('q01a'), reply: [id('q02')], flag: 'kept-tess' },
        { label: 'Là Rico, cứ mang sổ đi', say: id('q01b'), reply: [id('q03')] },
        { label: 'Gọi cho Rico hỏi đã', say: id('q01c'), reply: [id('q02')], flag: 'kept-tess' },
      ],
      check: { right: [0, 2], consequence: 'fooled', fact: 'trust' },
    },
    { kind: 'phone', lines: [id('r01'), id('r02')], if: { not: { hit: 'fooled' } } },
    { kind: 'phone', lines: [id('r03')], if: { hit: 'fooled' } },
    // to the ticket office (or the window noted)
    { kind: 'goto', place: 'pete', label: 'Tới chỗ hẹn đã ghi', if: PLACE('pete') },
    { kind: 'scene', at: 'pete', lines: [id('w01')], if: PLACE('pete') },
    { kind: 'goto', place: 'rico', label: 'Tới chỗ hẹn đã ghi', if: PLACE('rico') },
    { kind: 'scene', at: 'rico', lines: [id('w02')], if: PLACE('rico') },
    { kind: 'goto', place: 'okafor', label: 'Tới quầy bán vé, nhà ga Trung tâm' },
    { kind: 'scene', at: 'okafor', lines: [{ line: id('o01'), if: { note: 'name', is: 'right' } }, { line: id('o02'), if: { note: 'name', value: 'clark' } }, { line: id('o03'), if: { note: 'name', value: 'black' } }] },
    { kind: 'scene', at: 'okafor', who: ['lyle'], lines: [id('l01'), id('l02'), id('l03'), { line: id('l04'), if: { crew: 'mei' } }, id('l05'), { line: id('l06'), if: { hit: 'fooled' } }, { line: id('l07'), if: { hit: 'fooled' } }] },
  ],
  ending: {
    clean: [id('e01'), id('e02')],
    messy: [id('e03'), id('e02')],
    broken: [id('e04'), id('e02')],
  },
  news: { clean: [id('n1'), id('n2')], messy: [id('n1'), id('n2')], broken: [id('n1')] },
};
