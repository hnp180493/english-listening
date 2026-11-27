// Act III, job 6: "Phát sóng trực tiếp" (docs/gta-story-3.md §4.6, §6). Friday: Coastline's review of the sale, live on
// Bay FM, Mr Ashby listening from head office. Three threads at once (on air, the booth's line thirteen, the pirate on
// ninety-one point five in the street); "Lyle as Rico" rings in when Marcus says "lines are open" and slips on the same
// word as the first forgery ("nine thirty": act3Forged.ts; Rico says "half nine"); three Ricos with no text; then the
// microphone is the learner's for one line.
//
// The three endings (gta-story-3 §6) are lines with conditions, not new code: how many of the five people / things the
// learner kept through Act III (Cond `count` over the flags those jobs leave, read with `past`). Four or five: Kemp's
// bid is withdrawn and Mrs Delaney is asked back. Two or three: the listeners' bid stands, for now. One or none:
// Coastline cannot tell who is lying, the sale is paused again. Heat of six or more (Cond `heat`) puts the police outside
// the studio and drops the ending a step (never below "for now" when four or five were kept); the ending is kept as a flag
// (`end-best` / `end-middle` / `end-worst`, step `flag`); Kit trusts the learner's ears after a clean warehouse (Cond `grade`).
// The two key lines of the threads (line thirteen ringing, the pirate coming on) start four seconds apart, so a sharp ear
// alone can catch both; Tess keeps the booth and Max the street (thread `cover`, gta-story-3 §4.6 step 3).
// Uses only steps the engine has: goto, scene, notebook via scene, threads, spot via radio, pick, intent, phone.

import type { NoteEntry } from '../../../core/town/job';
import type { Cond, JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-live-${key}`;

/** What the learner kept through Act III (gta-story-3 §6): one condition per person or thing. */
export const ACT3_KEPT: readonly Cond[] = [
  { past: 'job-forged:kept-tess' },
  { past: 'job-twomarcus:kept-marcus' },
  // flags of town-jobs are the union of every run (a replay adds, never takes away), so each is a flag, never "no hit"
  { any: [{ past: 'job-samcall:code-safe' }, { past: 'job-samcall:asked-dog' }] },
  { past: 'job-splice:knows-plan' },
  { past: 'job-tomcall:kept-tom' },
];
// heat (gta-story-3 §6, §7 item 1): six or more when the show starts, a patrol is outside the studio and the ending drops
// one step, never below "for now" when four or five were kept
const HOT: Cond = { heat: { min: 6 } };
const KEPT4: Cond = { count: ACT3_KEPT, min: 4 };
const BEST: Cond = { all: [KEPT4, { not: HOT }] };
const MIDDLE: Cond = { any: [{ count: ACT3_KEPT, min: 2, max: 3 }, { all: [KEPT4, HOT] }] };
// the crew's trust (§7 item 4): Kit says so when Act II's warehouse was clean
const TRUSTED: Cond = { grade: 'job-warehouse', min: 'clean' };
const WORST: Cond = { count: ACT3_KEPT, max: 1 };
const PLAN: Cond = { past: 'job-splice:knows-plan' };

const LINES = [
  // ── beat 1: the studio, an hour before ──
  { id: id('a01'), who: 'marcus', text: "Friday. Coastline's review, live. Mr Ashby is listening from head office.", vi: 'Thứ Sáu. Buổi xét lại của Coastline, trực tiếp. Ông Ashby nghe từ trụ sở.' },
  { id: id('a02'), who: 'kit', text: 'Line thirteen has a red light on it. If it rings, it is him.', vi: 'Đường dây mười ba có đèn đỏ. Nếu nó reo, là hắn.' },
  { id: id('a03'), who: 'kit', text: 'Every line is open tonight. We will have to listen to all of them.', vi: 'Tối nay đường nào cũng mở. Mình sẽ phải nghe hết.' },
  { id: id('b01'), who: 'marcus', text: 'Running order. Claire reads the books at the top of the hour.', vi: 'Thứ tự chương trình. Claire đọc sổ sách vào đầu giờ.' },
  { id: id('b02'), who: 'marcus', text: 'Tom rings at quarter past. Then I say lines are open.', vi: 'Tom gọi lúc mười lăm phút qua giờ. Rồi tôi nói "lines are open".' },
  { id: id('b03'), who: 'marcus', text: 'Rico sits in the studio with me. The real one, in a loud shirt.', vi: 'Rico ngồi trong phòng thu với tôi. Rico thật, mặc cái áo sặc sỡ.' },
  { id: id('b02r'), who: 'marcus', text: 'Quarter past. Fifteen minutes after the hour.', vi: 'Mười lăm phút qua giờ. Mười lăm phút sau giờ chẵn.' },
  { id: id('b03r'), who: 'marcus', text: 'In the studio. Beside me. You cannot miss the shirt.', vi: 'Trong phòng thu. Cạnh tôi. Cái áo đó khó mà không thấy.' },
  { id: id('b04'), who: 'marcus', text: 'We are on air in ten minutes. Last time, then.', vi: 'Mười phút nữa lên sóng. Lần cuối nhé.' },
  // ── wrong notes ──
  { id: id('w01'), who: 'kit', text: 'Tom already rang. Quarter past, not quarter to. I kept it for you.', vi: 'Tom gọi rồi. Mười lăm phút qua, không phải kém mười lăm. Tôi giữ lại cho bạn đây.' },
  { id: id('w02'), who: 'rico', text: "Partner, I'm in here. In the studio. Shirt like a sunset, partner.", vi: 'Cộng sự, tôi ở trong này. Trong phòng thu. Áo như hoàng hôn, cộng sự.' },
  // ── beat 2: three threads ──
  { id: id('h01'), who: 'claire', text: 'Harbour Press holds every pledge. Not one dollar has moved.', vi: 'Harbour Press giữ từng khoản góp. Không một đô nào bị xê dịch.' },
  { id: id('h02'), who: 'board', text: 'Um. Hi. Tom again. I said it last week and I meant it.', vi: 'Ừm. Chào. Lại Tom đây. Tuần trước tôi nói rồi và tôi nói thật.' },
  { id: id('h03'), who: 'marcus', text: 'Thank you, Tom. Westbay, lines are open.', vi: 'Cảm ơn Tom. Westbay, các đường dây đã mở.' },
  { id: id('h04'), who: 'kit', text: 'Line four is a lady about her cat. Line nine is Hal.', vi: 'Đường bốn là một bà hỏi về con mèo. Đường chín là Hal.' },
  { id: id('h05'), who: 'kit', text: 'Red light. Line thirteen is ringing. Line thirteen.', vi: 'Đèn đỏ. Đường mười ba đang reo. Đường mười ba.' },
  { id: id('h06'), who: 'tess', text: 'Red light on thirteen. Coffee says it is him.', vi: 'Đèn đỏ ở đường mười ba. Cà phê bảo là hắn.' },
  { id: id('h07'), who: 'jun', text: "Jun in the van. Ninety-one point five is quiet. So far.", vi: 'Jun trong xe. Chín mốt phẩy năm đang im. Tới giờ.' },
  { id: id('h08'), who: 'jun', text: 'Ninety-one point five just came on. Same tape, new bits.', vi: 'Chín mốt phẩy năm vừa lên sóng. Cuộn cũ, có đoạn mới.' },
  { id: id('h09'), who: 'phone', text: "Got it rolling, mate. Every word they play, we keep.", vi: 'Máy đang chạy rồi. Chúng phát chữ nào, mình giữ chữ đó.' },
  { id: id('h10'), who: 'jun', text: 'Still nothing. Just the gulls and the ferry horn.', vi: 'Vẫn chưa có gì. Chỉ có tiếng mòng biển và còi phà.' },
  { id: id('k01'), who: 'kit', text: 'Thirteen rang and I missed it. He is already through to Marcus.', vi: 'Đường mười ba reo mà tôi lỡ. Hắn đã nối vào Marcus rồi.' },
  { id: id('k02'), who: 'jun', text: "The pirate's been on two minutes. Half the harbour heard it first.", vi: 'Đài lậu lên sóng hai phút rồi. Nửa bến cảng nghe nó trước.' },
  // ── "Rico" on line thirteen ──
  { id: id('s01'), who: 'rico', as: 'lyle', text: "Marcus, partner, it's Rico. Rico here. Listen, listen.", vi: 'Marcus, cộng sự, Rico đây. Rico đây. Nghe này, nghe này.' },
  { id: id('s02'), who: 'rico', as: 'lyle', text: "The listeners' money bought my new taxi. I'm sorry, partner.", vi: 'Tiền thính giả góp đã mua chiếc taxi mới của tôi. Xin lỗi, cộng sự.' },
  { id: id('s03'), who: 'rico', as: 'lyle', text: "I'll hand the keys in at nine thirty. Nine thirty, partner.", vi: 'Tôi sẽ nộp chìa khóa lúc chín giờ ba mươi. Chín giờ ba mươi, cộng sự.' },
  { id: id('s04'), who: 'rico', as: 'lyle', text: "That's all. Got to go.", vi: 'Vậy thôi. Phải đi đây.' },
  { id: id('s05'), who: 'marcus', text: 'Nine thirty. Westbay, remember that. We will come back to it.', vi: 'Chín giờ ba mươi. Westbay, nhớ chữ đó nhé. Chút nữa mình quay lại.' },
  // ── three Ricos ──
  { id: id('p01'), who: 'marcus', text: 'Westbay, three Ricos. Only one is sitting next to me. Which?', vi: 'Westbay, ba Rico. Chỉ một người đang ngồi cạnh tôi. Ai?' },
  { id: id('c1'), who: 'rico', as: 'lyle', text: 'Nine thirty, partner. Always nine thirty with me.', vi: 'Chín giờ ba mươi, cộng sự. Với tôi lúc nào cũng chín giờ ba mươi.' },
  { id: id('c2'), who: 'rico', text: "Half nine, partner. It's always half nine. Ask anyone. Ask Tess.", vi: '"Half nine", cộng sự. Lúc nào cũng "half nine". Hỏi ai cũng được. Hỏi Tess.' },
  { id: id('c3'), who: 'rico', as: 'splice', text: 'Rico on thirteen. Half nine at the station. Over.', vi: 'Rico ở kênh mười ba. Chín rưỡi ở nhà ga. Hết.' },
  { id: id('p03'), who: 'rico', text: "Not that one, partner. I never say nine thirty. That's somebody doing me.", vi: 'Không phải cái đó, cộng sự. Tôi chưa bao giờ nói "nine thirty". Có người nhại tôi đấy.' },
  { id: id('p02'), who: 'rico', text: "Not that one, partner. We moved off thirteen. That's an old tape.", vi: 'Không phải cái đó, cộng sự. Mình bỏ kênh mười ba rồi. Băng cũ đấy.' },
  // ── the microphone ──
  { id: id('i01'), who: 'marcus', text: 'You heard every one of them. Say one thing to Westbay.', vi: 'Bạn đã nghe từng người. Nói một câu với Westbay đi.' },
  { id: id('i01a'), who: 'player', text: "Don't listen to the voice. Listen to the words.", vi: 'Đừng nghe giọng. Nghe chữ.' },
  { id: id('i01b'), who: 'player', text: 'Duncan Kemp made these tapes. Somebody arrest him.', vi: 'Duncan Kemp làm ra mấy cuộn băng này. Ai đó bắt hắn đi.' },
  { id: id('i01c'), who: 'player', text: 'Play them side by side. Westbay can hear it for itself.', vi: 'Phát chúng cạnh nhau. Westbay tự nghe ra được.' },
  { id: id('i02'), who: 'marcus', text: 'Words, not voices. Westbay, you heard it here.', vi: 'Chữ, không phải giọng. Westbay, các bạn nghe rồi đấy.' },
  { id: id('i03'), who: 'ashby', text: 'Can you prove that, on air? Then please do not say it.', vi: 'Bạn chứng minh được điều đó, trên sóng không? Không thì đừng nói.' },
  { id: id('i04'), who: 'marcus', text: "Then we'll do it the slow way. Kit, both tapes, side by side.", vi: 'Vậy mình làm cách chậm. Kit, cả hai cuộn, đặt cạnh nhau.' },
  // ── the verdict: three endings by what was kept ──
  { id: id('v01'), who: 'ashby', text: "Coastline has heard enough. The listeners' bid stands. Mr Kemp's is withdrawn.", vi: 'Coastline đã nghe đủ. Giá của thính giả giữ nguyên. Giá của ông Kemp bị rút.' },
  { id: id('v02'), who: 'delaney', text: 'Mrs Delaney. The Trust has asked me back. Noted, with thanks.', vi: 'Delaney đây. Ban quản lý cảng đã mời tôi trở lại. Ghi nhận, cảm ơn.' },
  { id: id('v03'), who: 'kemp', text: 'Lovely show, Marcus. Truly. Goodnight.', vi: 'Chương trình tuyệt lắm, Marcus. Thật đấy. Chúc ngủ ngon.' },
  { id: id('v04'), who: 'ashby', text: "The listeners' bid stands, for now. We will listen again next year.", vi: 'Giá của thính giả giữ nguyên, tạm thời. Năm sau chúng tôi nghe lại.' },
  { id: id('v06'), who: 'ashby', text: 'And I am told the police are outside your studio, Marcus.', vi: 'Và tôi được báo là cảnh sát đang ở ngoài phòng thu của anh, Marcus.' },
  { id: id('e05'), who: 'kit', text: 'You found the reel in fifteen. I trusted your ears again tonight.', vi: 'Bạn tìm ra cuộn băng ở kho mười lăm. Tối nay tôi lại tin tai bạn.' },
  { id: id('v05'), who: 'ashby', text: 'Coastline cannot tell who is lying tonight. The sale is paused another month.', vi: 'Tối nay Coastline không biết ai nói dối. Việc bán tạm dừng thêm một tháng.' },
  // ── the end ──
  { id: id('e01'), who: 'rico', text: 'A firm of two, a radio, and a city that listens. Not bad, partner.', vi: 'Một hãng hai người, một cái đài, và một thành phố biết nghe. Không tệ, cộng sự.' },
  { id: id('e02'), who: 'marcus', text: "Goodnight, Westbay. Listen to the words. That's all we ask.", vi: 'Chúc ngủ ngon, Westbay. Nghe chữ. Chúng tôi chỉ xin vậy.' },
  { id: id('e03'), who: 'rico', text: 'Not pretty, but we got there. Westbay heard it.', vi: 'Không đẹp, nhưng xong. Westbay nghe ra rồi.' },
  { id: id('e04'), who: 'rico', text: 'Half the city heard nine thirty and believed it. Next time, partner.', vi: 'Nửa thành phố nghe "nine thirty" mà vẫn tin. Lần sau, cộng sự.' },
  { id: id('n1'), who: 'marcus', text: "A word to Westbay. A voice can be borrowed. A habit can't.", vi: 'Một lời với Westbay. Giọng thì mượn được. Thói quen thì không.' },
  { id: id('n2'), who: 'marcus', text: 'Rico says half nine. He always has. Goodnight.', vi: 'Rico nói "half nine". Xưa nay vẫn vậy. Chúc ngủ ngon.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'tom',
    label: 'Tom gọi lúc',
    line: id('b02'),
    answer: 'past',
    options: [
      { value: 'past', label: 'Mười lăm phút qua giờ (quarter past)' },
      { value: 'to', label: 'Kém mười lăm (quarter to)' },
      { value: 'half', label: 'Rưỡi (half past)' },
    ],
  },
  {
    key: 'rico',
    label: 'Rico thật ngồi ở',
    line: id('b03'),
    answer: 'studio',
    options: [
      { value: 'studio', label: 'Trong phòng thu, cạnh Marcus' },
      { value: 'stage', label: 'Trên sân khấu ngoài bến' },
      { value: 'street', label: 'Trong xe ngoài đường' },
    ],
  },
];

export const JOB_LIVE: JobDoc = {
  id: 'job-live',
  title: 'Phát sóng trực tiếp',
  blurb: 'Buổi xét lại của Coastline, trực tiếp trên Bay FM. Ba mạch cùng lúc, một Rico giả gọi vào, và một câu của bạn trên sóng. Kết cục tùy những gì bạn giữ được.',
  level: 3,
  order: 28,
  opens: ['ct-rico-1'],
  after: 'job-forged',
  afterAll: ['job-twomarcus', 'job-samcall', 'job-splice', 'job-tomcall'],
  from: 'marcus',
  lines: LINES,
  facts: [
    { id: 'tom', label: 'Tom gọi lúc', line: id('b02'), consequence: 'tom' },
    { id: 'rico', label: 'Rico thật ngồi ở', line: id('b03'), consequence: 'rico' },
    { id: 'tell', label: 'Chỗ không giống Rico', line: id('s03'), consequence: 'tell', byAction: true },
    { id: 'real', label: 'Rico thật', line: id('p01'), consequence: 'clip', byAction: true },
    { id: 'mic', label: 'Một câu trên sóng', line: id('i01'), consequence: 'accuse', byAction: true },
  ],
  consequences: {
    tom: { name: 'Ghi sai giờ Tom gọi: lỡ mấy chữ đầu của Tom', rejoin: 'Kit giữ lại cuộc gọi cho bạn nghe.' },
    rico: { name: 'Ghi sai chỗ Rico thật: tìm anh ở ngoài', rejoin: 'Rico gọi: anh ở trong phòng thu.' },
    line: { name: 'Không nghe đường dây mười ba reo: Rico giả lên sóng trước khi Kit kịp ghi', rejoin: 'Marcus vẫn giữ được hắn trên sóng.' },
    pirate: { name: 'Không nghe đài lậu lên sóng: nửa bến cảng nghe nó trước', rejoin: 'Max và Jun vẫn thu được đoạn mới.' },
    tell: { name: 'Bấm "Đó!" sai chỗ: chưa chỉ ra "nine thirty"', rejoin: 'Marcus tự nhắc lại "nine thirty" cho thành phố.' },
    clip: { name: 'Chọn nhầm Rico', rejoin: 'Rico thật nói: kênh mười ba là băng cũ.' },
    accuse: { name: 'Buộc tội trên sóng mà không có bằng chứng', rejoin: 'Marcus làm cách chậm: phát hai cuộn cạnh nhau.' },
  },
  crew: {
    roles: [
      { who: 'tess', role: 'Đứng ở cửa phòng thu', listen: 'Tess canh bảng đèn: khi đường mười ba reo, cô nói to lên.', opens: { heard: ['ct-tess-2'] }, cut: CREW_CUT.friend, with: { at: 'kit' } },
      { who: 'phone', role: 'Máy ghi âm', listen: 'Max ngồi trong xe với Jun, ghi lại mọi thứ đài lậu phát.', opens: { hearts: 4 }, cut: CREW_CUT.friend, with: 'ride' },
    ],
  },
  steps: [
    { kind: 'goto', place: 'kit', label: 'Tới phòng thu Bay FM' },
    { kind: 'scene', at: 'kit', lines: [id('a01'), { line: id('a02'), if: PLAN }, { line: id('a03'), if: { not: PLAN } }] },
    {
      kind: 'notebook',
      via: 'scene',
      call: [id('b01'), id('b02'), id('b03')],
      entries: NOTEBOOK,
      repeat: { tom: [id('b02r')], rico: [id('b03r')] },
      patience: { after: 3, line: id('b04') },
    },
    { kind: 'phone', lines: [id('w02')], if: { note: 'rico', is: 'wrong' } },
    // on air: three threads at once
    {
      kind: 'threads',
      tracks: [
        { id: 'air', label: 'Trên sóng', lines: [id('h01'), id('h02'), id('h03')] },
        { id: 'booth', label: 'Bàn đường dây', lines: [id('h04'), { line: id('h06'), if: { crew: 'tess' } }, id('h05')], key: [id('h05')], consequence: 'line', cover: { crew: 'tess' } },
        { id: 'street', label: 'Ngoài đường', lines: [id('h07'), { line: id('h09'), if: { crew: 'phone' } }, id('h10'), id('h08')], key: [id('h08')], consequence: 'pirate', cover: { crew: 'phone' } },
      ],
    },
    { kind: 'scene', at: 'kit', lines: [id('w01')], if: { note: 'tom', is: 'wrong' } },
    { kind: 'scene', at: 'kit', lines: [id('k01')], if: { hit: 'line' } },
    { kind: 'phone', lines: [id('k02')], if: { hit: 'pirate' } },
    // "Đó!" on the word Rico never says
    { kind: 'spot', lines: ['s01', 's02', 's03', 's04'].map(id), at: id('s03'), early: 'tell', late: 'tell', never: 'tell', fact: 'tell', via: 'radio' },
    { kind: 'radio', lines: [id('s05')], if: { hit: 'tell' } },
    // a wrong clip says why: the imitation (it says nine thirty) is not the old tape (it says thirteen)
    { kind: 'pick', ask: [id('p01')], clips: ['c1', 'c2', 'c3'].map(id), right: 1, consequence: 'clip', fact: 'real', why: { [id('c1')]: id('p03'), [id('c3')]: id('p02') } },
    {
      kind: 'intent',
      who: 'marcus',
      ask: [id('i01')],
      options: [
        { label: 'Đừng nghe giọng, nghe chữ', say: id('i01a'), reply: [id('i02')], flag: 'words' },
        { label: 'Kemp làm hết, bắt hắn đi', say: id('i01b'), reply: [id('i03'), id('i04')] },
        { label: 'Phát cạnh nhau, để thành phố tự nghe', say: id('i01c'), reply: [id('i04')], flag: 'words' },
      ],
      check: { right: [0, 2], consequence: 'accuse', fact: 'mic' },
    },
    // the verdict: which of three endings is read off what Act III kept (gta-story-3 §6)
    {
      kind: 'phone',
      lines: [
        { line: id('v06'), if: HOT },
        { line: id('v01'), if: BEST },
        { line: id('v02'), if: BEST },
        { line: id('v03'), if: BEST },
        { line: id('v04'), if: MIDDLE },
        { line: id('v05'), if: WORST },
      ],
    },
    // the ending kept for later acts (gta-story-3 §7 item 5): one flag, said by nobody
    { kind: 'flag', set: 'end-best', if: BEST },
    { kind: 'flag', set: 'end-middle', if: MIDDLE },
    { kind: 'flag', set: 'end-worst', if: WORST },
  ],
  ending: {
    clean: [{ line: id('e01'), if: { not: WORST } }, { line: id('e04'), if: WORST }, { line: id('e05'), if: TRUSTED }, id('e02')],
    messy: [{ line: id('e03'), if: { not: WORST } }, { line: id('e04'), if: WORST }, { line: id('e05'), if: TRUSTED }, id('e02')],
    broken: [id('e04'), id('e02')],
  },
  news: { clean: [id('n1'), id('n2')], messy: [id('n1'), id('n2')], broken: [id('n2')] },
};
