// Act III, job 4: "Phòng ghép băng" (docs/gta-story-3.md §4.4). Jun followed ninety-one point five to a back room above
// Poppy's bakery, Twin Ovens. Through the open window: Shona coaching Lyle Penn, the impersonator, to be Rico and Tom
// (the habits she drills are the fingerprint table's, gta-story-3 §2: Rico says everything twice and says "partner";
// Tom says "um" and "sorry"). The learner keeps the cue that sends Lyle to the phone ("lines are open", typed back to
// Jun), then Jun picks up Shona's cordless (Kemp's own habit, act2Dumplings): which line he rings on, and the day. Kit
// decides what to do about that line.
//
// Shona stands at the window (she has a body: features/town/jobs/jobCast.ts); Lyle is heard from inside the room and
// has no body (gta-story-3 §7 NEEDS ENGINE 2: a look for him). Max may come along (a town resident: his lines are his
// own Gemini clips [TT]). Uses only steps the engine has: goto, scene, overhear, password, notebook via radio, intent.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-splice-${key}`;
const LINE = (v: string) => ({ note: 'line', value: v });
const DAY = (v: string) => ({ note: 'day', value: v });

const LINES = [
  // ── beat 1: Jun's stall ──
  { id: id('a01'), who: 'jun', text: 'Ninety-one point five comes from somewhere. I followed her across town.', vi: 'Chín mốt phẩy năm phải phát từ đâu đó. Tôi đã theo nó khắp thành phố.' },
  { id: id('a02'), who: 'jun', text: 'A back room above Twin Ovens. The lights are on all night.', vi: 'Một phòng phía sau, trên tiệm Twin Ovens. Đèn sáng cả đêm.' },
  { id: id('x01'), who: 'phone', text: "Recorder's under the sill, mate. Whatever she says, we keep.", vi: 'Máy ghi âm dưới bậu cửa sổ rồi. Cô ta nói gì, mình giữ hết.' },
  { id: id('p01'), who: 'poppy', text: 'The room upstairs? Let to a lady in a navy blazer. Paid in cash.', vi: 'Phòng trên lầu à? Cho một bà mặc áo vest xanh than thuê. Trả tiền mặt.' },
  { id: id('p02'), who: 'poppy', text: "Go round the back. The window's open, and the ovens are loud.", vi: 'Đi vòng ra sau. Cửa sổ mở, mà lò bánh ồn lắm.' },
  // ── beat 2: under the window ──
  { id: id('o01'), who: 'shona', text: 'Again. You are Rico. Rico talks far too much, remember.', vi: 'Lại. Anh là Rico. Rico nói nhiều quá trời, nhớ chưa.' },
  { id: id('o02'), who: 'lyle', text: "Tess, it's me. Meet him by the ticket office.", vi: 'Tess, tôi đây. Gặp ông ấy cạnh quầy bán vé.' },
  { id: id('o03'), who: 'shona', text: 'Twice. Rico says everything twice. And say partner, every time.', vi: 'Hai lần. Rico cái gì cũng nói hai lần. Và nói "partner", lần nào cũng thế.' },
  { id: id('o04'), who: 'lyle', text: 'Partner, partner. Who on earth talks like that?', vi: '"Partner, partner". Ai đời lại nói kiểu đó?' },
  { id: id('o05'), who: 'shona', text: 'Rico does. Now Tom. Tom says um. Tom says sorry.', vi: 'Rico đấy. Giờ tới Tom. Tom nói "um". Tom nói "sorry".' },
  { id: id('o06'), who: 'lyle', text: "Um. Sorry. Um. This is the worst job I've ever had.", vi: 'Ừm. Xin lỗi. Ừm. Đây là việc tệ nhất tôi từng nhận.' },
  { id: id('o07'), who: 'shona', text: 'When Marcus says lines are open, you ring in. Not before.', vi: 'Khi Marcus nói "lines are open", anh gọi vào. Không sớm hơn.' },
  { id: id('o08'), who: 'lyle', text: 'Lines are open. Got it. And who am I on the night?', vi: '"Lines are open". Hiểu. Còn đêm đó tôi là ai?' },
  { id: id('o09'), who: 'shona', text: 'Rico first. Then we will see who is left.', vi: 'Rico trước. Rồi xem còn ai.' },
  { id: id('o10'), who: 'shona', text: 'Is that window open? Shut it, please. Now.', vi: 'Cửa sổ đó mở à? Đóng lại đi. Ngay.' },
  // ── the cue, typed back ──
  { id: id('q01'), who: 'jun', text: 'So? What is the signal? When does he ring in?', vi: 'Sao? Hiệu lệnh là gì? Khi nào hắn gọi vào?' },
  { id: id('q02'), who: 'jun', text: 'Lines are open. So when Marcus says it, we listen for Rico.', vi: '"Lines are open". Vậy khi Marcus nói câu đó, mình nghe xem Rico.' },
  { id: id('q03'), who: 'jun', text: 'Nearly. Think radio. What does a phone-in show say?', vi: 'Gần đúng. Nghĩ tới radio. Chương trình gọi vào hay nói gì?' },
  { id: id('q04'), who: 'jun', text: 'Not quite. She said lines are open. Poppy heard it too.', vi: 'Chưa đúng. Cô ta nói "lines are open". Poppy cũng nghe thấy.' },
  // ── beat 3: Shona's cordless, on Jun's scanner ──
  { id: id('k00'), who: 'jun', text: "She's ringing Kemp on a cordless. On open air. Listen.", vi: 'Cô ta gọi cho Kemp bằng máy không dây. Phát ra ngoài trời luôn. Nghe đi.' },
  { id: id('k01'), who: 'shona', text: "It's me. He can do Rico now. Tom, nearly.", vi: 'Tôi đây. Hắn nhại được Rico rồi. Tom thì gần được.' },
  { id: id('k02'), who: 'shona', text: 'He rings in on line thirteen. Kit never looks at that one.', vi: 'Hắn gọi vào đường dây mười ba. Kit chẳng bao giờ để ý đường đó.' },
  { id: id('k03'), who: 'shona', text: 'And the tape goes out on ninety-one point five at the same time.', vi: 'Và cuộn băng phát trên chín mốt phẩy năm cùng lúc.' },
  { id: id('k04'), who: 'kemp', text: 'Lovely. The review is on Friday, live. Goodnight, Shona.', vi: 'Tuyệt. Buổi xét lại vào thứ Sáu, trực tiếp. Chúc ngủ ngon, Shona.' },
  { id: id('k02r'), who: 'shona', text: 'Thirteen, Duncan. Line thirteen.', vi: 'Mười ba, Duncan. Đường dây mười ba.' },
  { id: id('k04r'), who: 'kemp', text: 'Friday, Shona. The review is Friday.', vi: 'Thứ Sáu, Shona. Buổi xét lại là thứ Sáu.' },
  { id: id('k05'), who: 'jun', text: "She won't say it again for us, you know. Last time.", vi: 'Cô ta đâu có nói lại cho mình nghe, biết không. Lần cuối nhé.' },
  // ── beat 4: Kit ──
  { id: id('t01'), who: 'kit', text: "Line thirteen? That's the spare. Nobody has rung it in years.", vi: 'Đường dây mười ba à? Đó là đường dự phòng. Mấy năm nay chẳng ai gọi vào.' },
  { id: id('t02'), who: 'kit', text: 'Line thirty? We only have fourteen. You mean thirteen, the spare.', vi: 'Đường dây ba mươi à? Mình chỉ có mười bốn đường. Ý bạn là mười ba, đường dự phòng.' },
  { id: id('t03'), who: 'kit', text: "Line three is Marcus's own. He'd know. You mean thirteen, the spare.", vi: 'Đường ba là của riêng Marcus. Anh ấy biết ngay. Ý bạn là mười ba, đường dự phòng.' },
  { id: id('t04'), who: 'kit', text: 'Friday. Coastline listens live from head office. Of course it is.', vi: 'Thứ Sáu. Coastline nghe trực tiếp từ trụ sở. Dĩ nhiên rồi.' },
  { id: id('t05'), who: 'kit', text: "Sunday? Coastline doesn't work Sundays. It's Friday, it's on the board.", vi: 'Chủ nhật á? Coastline đâu làm Chủ nhật. Thứ Sáu, ghi trên bảng rồi.' },
  { id: id('t06'), who: 'kit', text: 'Monday is too late. They decide on Friday, live. It is on the board.', vi: 'Thứ Hai thì muộn rồi. Họ quyết vào thứ Sáu, trực tiếp. Ghi trên bảng rồi.' },
  { id: id('t07'), who: 'kit', text: "And the signal? Jun says it's lines are open. I'll watch for it.", vi: 'Còn hiệu lệnh? Jun bảo là "lines are open". Tôi sẽ canh.' },
  { id: id('i01'), who: 'kit', text: 'So do I cut line thirteen? Or do we let him ring?', vi: 'Vậy tôi cắt đường dây mười ba? Hay để hắn gọi?' },
  { id: id('i01a'), who: 'player', text: 'Leave it open. Let him ring, and let Westbay hear him.', vi: 'Cứ để mở. Để hắn gọi, và để Westbay nghe hắn.' },
  { id: id('i01b'), who: 'player', text: 'Cut it. No line, no fake Rico.', vi: 'Cắt đi. Không có đường dây thì không có Rico giả.' },
  { id: id('i01c'), who: 'player', text: 'Leave it open, and record every call that comes in on it.', vi: 'Cứ để mở, và ghi âm mọi cuộc gọi vào đường đó.' },
  { id: id('i02'), who: 'kit', text: "Let him walk in. I like it. I'll put a red light on thirteen.", vi: 'Để hắn tự bước vào. Hay đấy. Tôi gắn đèn đỏ cho đường mười ba.' },
  { id: id('i03'), who: 'kit', text: "Cut. Done. Of course, now he'll ring on any line he likes.", vi: 'Cắt. Xong. Tất nhiên, giờ hắn gọi đường nào tùy thích.' },
  { id: id('i04'), who: 'jun', text: "A cut line? Then we won't know which call is him. Put it back.", vi: 'Cắt dây á? Vậy mình đâu biết cuộc nào là hắn. Nối lại đi.' },
  { id: id('i05'), who: 'kit', text: 'Fine. Back in. Red light on thirteen.', vi: 'Được. Nối lại. Đèn đỏ cho mười ba.' },
  // ── the end ──
  { id: id('e01'), who: 'jun', text: 'Shona writes him his lines. You found the lines. Good ears.', vi: 'Shona viết lời cho hắn. Bạn tìm ra lời. Tai tốt đấy.' },
  { id: id('e02'), who: 'kit', text: "Friday, then. Line thirteen. I'll have the old tapes ready.", vi: 'Vậy là thứ Sáu. Đường mười ba. Tôi sẽ chuẩn bị sẵn băng cũ.' },
  { id: id('e03'), who: 'jun', text: 'Messy, but we know the night and the line.', vi: 'Hơi lộn xộn, nhưng mình biết đêm nào và đường dây nào.' },
  { id: id('e04'), who: 'jun', text: 'We have half of it. Half is still more than they think.', vi: 'Mình có một nửa. Một nửa vẫn hơn chúng tưởng.' },
  { id: id('e05'), who: 'phone', text: 'Got the lot on tape, mate. Every um.', vi: 'Thu hết vào băng rồi. Từng tiếng "um".' },
  { id: id('n1'), who: 'marcus', text: 'Friday night, Westbay, the review is live on Bay FM. Stay with us.', vi: 'Tối thứ Sáu, Westbay, buổi xét lại phát trực tiếp trên Bay FM. Ở lại với chúng tôi nhé.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'line',
    label: 'Gọi vào đường dây số',
    line: id('k02'),
    answer: '13',
    options: [
      { value: '13', label: 'Mười ba (13)' },
      { value: '30', label: 'Ba mươi (30)' },
      { value: '3', label: 'Ba (3)' },
    ],
  },
  {
    key: 'day',
    label: 'Buổi xét lại vào',
    line: id('k04'),
    answer: 'friday',
    options: [
      { value: 'friday', label: 'Thứ Sáu' },
      { value: 'sunday', label: 'Chủ nhật' },
      { value: 'monday', label: 'Thứ Hai' },
    ],
  },
];

export const JOB_SPLICE: JobDoc = {
  id: 'job-splice',
  title: 'Phòng ghép băng',
  blurb: 'Jun lần theo đài lậu tới một phòng trên tiệm Twin Ovens. Dưới cửa sổ, Shona đang dạy một người nhại giọng Rico và Tom.',
  level: 3,
  order: 26,
  opens: ['ct-rico-1'],
  after: 'job-forged',
  from: 'jun',
  lines: LINES,
  facts: [
    { id: 'cue', label: 'Hiệu lệnh gọi vào', line: id('o07'), consequence: 'cue', byAction: true },
    { id: 'line', label: 'Gọi vào đường dây số', line: id('k02'), consequence: 'line' },
    { id: 'day', label: 'Buổi xét lại vào', line: id('k04'), consequence: 'day' },
    { id: 'trap', label: 'Làm gì với đường dây mười ba', line: id('i01'), consequence: 'cut', byAction: true },
  ],
  consequences: {
    cue: { name: 'Không nói lại được hiệu lệnh', rejoin: 'Jun nói lại cho Kit: "lines are open".' },
    line: { name: 'Ghi sai số đường dây', rejoin: 'Kit chỉ ra đường dự phòng, số mười ba.' },
    day: { name: 'Ghi sai ngày xét lại', rejoin: 'Kit chỉ bảng: thứ Sáu.' },
    cut: { name: 'Bảo Kit cắt đường dây: sẽ không biết cuộc nào là hắn', rejoin: 'Jun bảo nối lại; Kit gắn đèn đỏ cho đường mười ba.' },
  },
  crew: {
    roles: [{ who: 'phone', role: 'Máy ghi âm', listen: 'Max gài máy ghi âm dưới bậu cửa sổ: nghe xong, bạn còn băng để so giọng sau này.', opens: { hearts: 4 }, cut: CREW_CUT.friend, with: 'ride' }],
  },
  steps: [
    { kind: 'goto', place: 'jun', label: 'Tới sạp của Jun' },
    { kind: 'scene', at: 'jun', who: ['jun'], lines: [id('a01'), id('a02')] },
    { kind: 'goto', place: 'poppy', label: 'Tới tiệm Twin Ovens' },
    { kind: 'scene', at: 'poppy', lines: [id('p01'), id('p02'), { line: id('x01'), if: { crew: 'phone' } }] },
    {
      kind: 'overhear',
      at: 'poppy',
      who: ['shona', 'lyle'],
      lines: ['o01', 'o02', 'o03', 'o04', 'o05', 'o06', 'o07', 'o08', 'o09'].map(id),
      passes: 2,
      word: id('o07'),
    },
    { kind: 'password', who: 'jun', line: id('o07'), chunk: 'lines are open', ask: id('q01'), right: id('q02'), close: id('q03'), wrong: id('q04'), consequence: 'cue' },
    { kind: 'scene', at: 'poppy', lines: [id('o10')] },
    {
      kind: 'notebook',
      via: 'radio',
      call: [id('k00'), id('k01'), id('k02'), id('k03'), id('k04')],
      entries: NOTEBOOK,
      repeat: { line: [id('k02r')], day: [id('k04r')] },
      patience: { after: 3, line: id('k05') },
    },
    { kind: 'goto', place: 'kit', label: 'Tới bàn âm thanh của Kit' },
    { kind: 'scene', at: 'kit', lines: [{ line: id('t01'), if: { note: 'line', is: 'right' } }, { line: id('t02'), if: LINE('30') }, { line: id('t03'), if: LINE('3') }] },
    { kind: 'scene', at: 'kit', lines: [{ line: id('t04'), if: { note: 'day', is: 'right' } }, { line: id('t05'), if: DAY('sunday') }, { line: id('t06'), if: DAY('monday') }, { line: id('t07'), if: { hit: 'cue' } }] },
    {
      kind: 'intent',
      who: 'kit',
      ask: [id('i01')],
      options: [
        { label: 'Để mở, cho Westbay nghe hắn', say: id('i01a'), reply: [id('i02')], flag: 'knows-plan' },
        { label: 'Cắt đường dây mười ba', say: id('i01b'), reply: [id('i03')] },
        { label: 'Để mở, và ghi âm mọi cuộc gọi vào đó', say: id('i01c'), reply: [id('i02')], flag: 'knows-plan' },
      ],
      check: { right: [0, 2], consequence: 'cut', fact: 'trap' },
    },
    { kind: 'scene', at: 'kit', lines: [id('i04'), id('i05')], if: { hit: 'cut' } },
  ],
  ending: {
    clean: [id('e01'), id('e02'), { line: id('e05'), if: { crew: 'phone' } }],
    messy: [id('e03'), id('e02'), { line: id('e05'), if: { crew: 'phone' } }],
    broken: [id('e04'), id('e02')],
  },
  news: { clean: [id('n1')], messy: [id('n1')], broken: [id('n1')] },
};
