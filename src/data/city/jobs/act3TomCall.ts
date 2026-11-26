// Act III, job 5: "Tom gọi lên đài" (docs/gta-story-3.md §4.5). A caller who says he is Tom rings Marcus's afternoon
// show: Marcus wrote all those letters himself, for the ratings. Tom hates speaking in public, says "um" and "sorry",
// and is no good on the phone (act2Farewell.ts t01; docs/city.md: Tom "hates speaking in public"; gta-story-3 §2.5); this
// Tom says he loves talking on the radio. Marcus reads the latest real letter (he reads one before every show, docs/city.md
// §17): Tom is coming up on the no. 9. The learner meets him and asks him to answer it himself.
//
// The real Tom is a TOWN resident: his lines are his own Gemini clips [TT] (inventory cityJobs, connected only); the
// impostor is 'tom-fake' (SCENE_VOICES, a browser voice). Until the owner generates the clips both are browser voices,
// and the words carry it. Uses only steps the engine has: goto, scene, spot via radio, pick, notebook via scene,
// intent, radio.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-tomcall-${key}`;
const MEET = (v: string) => ({ note: 'meet', value: v });

const LINES = [
  // ── beat 1: the studio, before three ──
  { id: id('a01'), who: 'marcus', text: 'Good afternoon. A caller rings every show now, saying he is Tom.', vi: 'Chào buổi chiều. Giờ chương trình nào cũng có người gọi vào, bảo mình là Tom.' },
  { id: id('a02'), who: 'kit', text: "He'll ring again at three. Listen with us. Stop me where he slips.", vi: 'Ba giờ hắn sẽ gọi nữa. Nghe cùng chúng tôi. Dừng tôi ở chỗ hắn lộ.' },
  { id: id('a03'), who: 'kit', text: 'You heard the real Tom ring us once. Same ears now.', vi: 'Bạn đã nghe Tom thật gọi lên một lần. Giờ dùng đúng đôi tai đó.' },
  // ── the impostor, on air ──
  { id: id('f01'), who: 'tom-fake', text: 'Hi Marcus, Tom here. Great to be on the show again.', vi: 'Chào Marcus, Tom đây. Vui được lên chương trình lần nữa.' },
  { id: id('f02'), who: 'tom-fake', text: 'Honestly, I love talking on the radio. I could do this all day.', vi: 'Thật lòng, tôi mê nói trên radio. Tôi nói cả ngày cũng được.' },
  { id: id('f03'), who: 'tom-fake', text: 'Those letters? Marcus wrote every one of them himself.', vi: 'Mấy lá thư à? Marcus tự viết hết đấy.' },
  { id: id('f04'), who: 'tom-fake', text: 'He made me up for the ratings. Sorry, everyone.', vi: 'Anh ấy bịa ra tôi để lấy lượt nghe. Xin lỗi mọi người.' },
  { id: id('k00'), who: 'kit', text: 'Tom, loving the radio? Tom shakes holding a phone.', vi: 'Tom mà mê radio? Tom cầm điện thoại còn run.' },
  // ── three Toms ──
  { id: id('k01'), who: 'kit', text: "Three calls that say they're Tom. Which one is really him?", vi: 'Ba cuộc gọi tự nhận là Tom. Cuộc nào thật là anh ấy?' },
  { id: id('k02'), who: 'kit', text: "Listen for the ums. Tom can't get through a sentence without one.", vi: 'Nghe tiếng "um". Tom không nói hết câu nào mà thiếu nó.' },
  { id: id('c1'), who: 'tom-fake', text: 'Hi, Tom here. Happy to help any time, Marcus.', vi: 'Chào, Tom đây. Lúc nào cũng sẵn lòng giúp, Marcus.' },
  { id: id('c2'), who: 'board', text: "Um. Hi. It's Tom. Sorry, I'm no good at this.", vi: 'Ừm. Chào. Tom đây. Xin lỗi, tôi dở mấy cái này lắm.' },
  { id: id('c3'), who: 'tom-fake', text: 'Evening, Westbay. Tom speaking. Lovely to be here.', vi: 'Chào buổi tối, Westbay. Tom đang nói. Rất vui được ở đây.' },
  { id: id('k03'), who: 'kit', text: 'Not him. Tom has never said lovely to be here in his life.', vi: 'Không phải anh ấy. Cả đời Tom chưa từng nói "lovely to be here".' },
  // ── the letter ──
  { id: id('l01'), who: 'marcus', text: "His letter came this morning. I'll read it as he wrote it.", vi: 'Thư anh ấy tới sáng nay. Tôi đọc đúng như anh ấy viết.' },
  { id: id('l02'), who: 'marcus', text: "Dear Marcus. I'm coming up on Sunday, on the twelve forty bus.", vi: 'Marcus thân mến. Chủ nhật tôi lên, đi chuyến xe mười hai giờ bốn mươi.' },
  { id: id('l03'), who: 'marcus', text: 'Meet me by the flower shop. Not the fish, I get sick.', vi: 'Gặp tôi ở cạnh tiệm hoa. Đừng chỗ bán cá, tôi bị say.' },
  { id: id('l04'), who: 'marcus', text: "That's Tom. A whole page to say twelve forty and flowers.", vi: 'Tom đấy. Cả một trang chỉ để nói mười hai giờ bốn mươi và hoa.' },
  { id: id('l02r'), who: 'marcus', text: 'Twelve forty. Four, oh. The bus after lunch.', vi: 'Mười hai giờ bốn mươi. Bốn, không. Chuyến sau bữa trưa.' },
  { id: id('l03r'), who: 'marcus', text: 'The flower shop. Nora has the sunflowers.', vi: 'Tiệm hoa. Chỗ Nora có hoa hướng dương.' },
  { id: id('l05'), who: 'marcus', text: 'I know this letter by heart now. One more time.', vi: 'Giờ tôi thuộc lòng lá thư này rồi. Thêm lần nữa thôi.' },
  // ── wrong notes ──
  { id: id('w01'), who: 'okafor', text: "The twelve fourteen? No such bus, love. The twelve forty, he'll be on that.", vi: 'Chuyến mười hai giờ mười bốn á? Không có chuyến đó đâu cháu. Chuyến mười hai giờ bốn mươi, cậu ấy đi chuyến đó.' },
  { id: id('w02'), who: 'okafor', text: "Two forty? He'd miss his own friend. The twelve forty, love.", vi: 'Hai giờ bốn mươi á? Thế thì lỡ cả bạn mình. Chuyến mười hai giờ bốn mươi, cháu.' },
  { id: id('w03'), who: 'poppy', text: "Flour? This is a bakery. You'll want Nora's, for flowers.", vi: 'Bột mì á? Đây là tiệm bánh. Bạn cần tiệm Nora, chỗ có hoa.' },
  { id: id('w04'), who: 'hal', text: 'Fish? He wrote not the fish, I expect. Flowers are over there.', vi: 'Cá à? Chắc anh ấy viết là đừng chỗ cá. Hoa ở đằng kia.' },
  // ── Tom ──
  { id: id('t01'), who: 'board', text: "Um, hi. Sorry. Marcus said you'd find me. Flowers, yes.", vi: 'Ừm, chào. Xin lỗi. Marcus bảo bạn sẽ tìm ra tôi. Hoa, đúng.' },
  { id: id('t02'), who: 'board', text: 'Someone is me on the radio? I rang a show once. It took me a week.', vi: 'Có người làm tôi trên radio à? Tôi gọi lên đài có một lần. Mất cả tuần mới dám.' },
  { id: id('t03'), who: 'board', text: "What do I do? I'm, um, not good at talking. You know that.", vi: 'Tôi làm gì đây? Tôi, ừm, không giỏi nói. Bạn biết mà.' },
  { id: id('t03a'), who: 'player', text: 'Ring the show. Talk like you always do. Ums and all.', vi: 'Gọi lên chương trình. Nói như anh vẫn nói. Có cả "um".' },
  { id: id('t03b'), who: 'player', text: 'Write Marcus a letter instead. He can read it out.', vi: 'Viết thư cho Marcus đi. Anh ấy đọc lên.' },
  { id: id('t03c'), who: 'player', text: 'Come to the studio. Say it into the microphone yourself.', vi: 'Tới phòng thu. Tự nói vào micro.' },
  { id: id('t04'), who: 'board', text: 'Ums and all. Okay. Honestly? Okay.', vi: 'Có cả "um". Được. Thật lòng hả? Được.' },
  { id: id('t05'), who: 'board', text: "A letter? He'd only say Marcus wrote it. That's the whole trick.", vi: 'Thư á? Hắn sẽ lại bảo Marcus viết. Cả trò là ở đó mà.' },
  { id: id('t06'), who: 'board', text: 'My hands are shaking already. But yes. For Marcus.', vi: 'Tay tôi run rồi đây. Nhưng được. Vì Marcus.' },
  { id: id('t07'), who: 'board', text: "No. No letter. I'll ring. Sorry. I'll ring.", vi: 'Không. Không thư. Tôi sẽ gọi. Xin lỗi. Tôi sẽ gọi.' },
  // ── on air ──
  { id: id('r01'), who: 'marcus', text: 'Good evening, Westbay. And here is a caller I have known since I was nine.', vi: 'Chào buổi tối, Westbay. Và đây là một người gọi tôi quen từ năm chín tuổi.' },
  { id: id('r02'), who: 'board', text: "Um. Hi, Marcus. It's Tom. The real one. Sorry.", vi: 'Ừm. Chào Marcus. Tom đây. Tom thật. Xin lỗi.' },
  { id: id('r03'), who: 'board', text: 'I wrote every letter. Badly. Ask him for the one with the bus.', vi: 'Tôi viết từng lá thư. Dở tệ. Hỏi anh ấy lá có cái xe buýt ấy.' },
  { id: id('r04'), who: 'marcus', text: 'Four lines and a drawing of a bus. I still have it.', vi: 'Bốn dòng và một hình vẽ xe buýt. Tôi vẫn giữ.' },
  // ── the end ──
  { id: id('e01'), who: 'marcus', text: 'Westbay heard him say um. Nobody could fake that. Thank you.', vi: 'Westbay nghe anh ấy nói "um". Không ai giả được cái đó. Cảm ơn bạn.' },
  { id: id('e02'), who: 'kit', text: 'Two Toms on one show. Only one of them was shaking.', vi: 'Hai Tom trong một chương trình. Chỉ có một người run.' },
  { id: id('e03'), who: 'marcus', text: 'We got there. A little late, but Tom said it himself.', vi: 'Xong rồi. Hơi muộn, nhưng Tom tự nói ra.' },
  { id: id('e04'), who: 'marcus', text: 'Some still believe the smooth one. Smooth is easy to believe.', vi: 'Vẫn có người tin gã nói trơn tru. Trơn tru thì dễ tin.' },
  { id: id('e05'), who: 'board', text: 'Never. Again. Um. Thank you.', vi: 'Không bao giờ. Nữa. Ừm. Cảm ơn.' },
  { id: id('n1'), who: 'marcus', text: "A word to Westbay. The real Tom says um. I'm proud of every one.", vi: 'Một lời với Westbay. Tom thật có nói "um". Tôi tự hào về từng tiếng một.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'bus',
    label: 'Tom đi chuyến',
    line: id('l02'),
    answer: '1240',
    options: [
      { value: '1240', label: 'Mười hai giờ bốn mươi' },
      { value: '1214', label: 'Mười hai giờ mười bốn' },
      { value: '240', label: 'Hai giờ bốn mươi' },
    ],
  },
  {
    key: 'meet',
    label: 'Gặp ở đâu',
    line: id('l03'),
    answer: 'nora',
    options: [
      { value: 'nora', label: 'Tiệm hoa của Nora' },
      { value: 'poppy', label: 'Tiệm bánh (bột mì) Twin Ovens' },
      { value: 'hal', label: 'Sạp cá của Hal' },
    ],
  },
];

export const JOB_TOMCALL: JobDoc = {
  id: 'job-tomcall',
  title: 'Tom gọi lên đài',
  blurb: 'Một "Tom" gọi vào chương trình của Marcus, nói những lá thư là Marcus tự viết. Tom thật ghét nói trước đám đông. Nghe ra, rồi đón Tom thật.',
  level: 2,
  order: 27,
  opens: ['ct-rico-1'],
  after: 'job-forged',
  from: 'marcus',
  lines: LINES,
  facts: [
    { id: 'tell', label: 'Chỗ không giống Tom', line: id('f02'), consequence: 'tell', byAction: true },
    { id: 'tom', label: 'Cuộc gọi thật của Tom', line: id('k01'), consequence: 'clip', byAction: true },
    { id: 'bus', label: 'Tom đi chuyến', line: id('l02'), consequence: 'bus' },
    { id: 'meet', label: 'Gặp ở đâu', line: id('l03'), consequence: 'meet' },
    { id: 'ask', label: 'Nhờ Tom làm gì', line: id('t03'), consequence: 'letter', byAction: true },
  ],
  consequences: {
    tell: { name: 'Bấm "Đó!" sai chỗ: chưa chỉ ra được câu không giống Tom', rejoin: 'Kit chỉ ra: Tom mà mê radio.' },
    clip: { name: 'Chọn nhầm cuộc gọi: chưa nhận ra Tom thật', rejoin: 'Kit chỉ ra cuộc có tiếng "um".' },
    bus: { name: 'Ghi sai chuyến xe: tới ga sai giờ', rejoin: 'Bà Okafor chỉ chuyến mười hai giờ bốn mươi.' },
    meet: { name: 'Ghi sai chỗ hẹn: đứng nhầm sạp', rejoin: 'Người ở sạp chỉ sang tiệm hoa của Nora.' },
    letter: { name: 'Khuyên Tom viết thư: kẻ giả sẽ lại bảo Marcus viết', rejoin: 'Tom tự đổi ý và gọi lên.' },
  },
  crew: {
    roles: [{ who: 'kit', role: 'Bàn âm thanh', listen: 'Kit ngồi cạnh khi bạn chọn cuộc gọi: anh nhắc bạn nghe tiếng "um".', opens: { heard: ['ct-kit-2'] }, cut: CREW_CUT.friend, with: { at: 'kit' } }],
  },
  steps: [
    { kind: 'goto', place: 'kit', label: 'Tới phòng thu Bay FM' },
    { kind: 'scene', at: 'kit', lines: [id('a01'), id('a02'), { line: id('a03'), if: { past: 'job-farewell' } }] },
    // "Đó!" where this Tom stops sounding like Tom
    { kind: 'spot', lines: ['f01', 'f02', 'f03', 'f04'].map(id), at: id('f02'), early: 'tell', late: 'tell', never: 'tell', fact: 'tell', via: 'radio' },
    { kind: 'scene', at: 'kit', lines: [id('k00')] },
    { kind: 'pick', ask: [id('k01'), { line: id('k02'), if: { crew: 'kit' } }], clips: ['c1', 'c2', 'c3'].map(id), right: 1, consequence: 'clip', fact: 'tom' },
    { kind: 'scene', at: 'kit', lines: [id('k03')], if: { hit: 'clip' } },
    // the letter
    {
      kind: 'notebook',
      via: 'scene',
      call: [id('l01'), id('l02'), id('l03'), id('l04')],
      entries: NOTEBOOK,
      repeat: { bus: [id('l02r')], meet: [id('l03r')] },
      patience: { after: 3, line: id('l05') },
    },
    { kind: 'goto', place: 'okafor', label: 'Tới nhà ga đón Tom', if: { note: 'bus', is: 'wrong' } },
    { kind: 'scene', at: 'okafor', lines: [{ line: id('w01'), if: { note: 'bus', value: '1214' } }, { line: id('w02'), if: { note: 'bus', value: '240' } }], if: { note: 'bus', is: 'wrong' } },
    { kind: 'goto', place: 'poppy', label: 'Tới chỗ hẹn đã ghi', if: MEET('poppy') },
    { kind: 'scene', at: 'poppy', lines: [id('w03')], if: MEET('poppy') },
    { kind: 'goto', place: 'hal', label: 'Tới chỗ hẹn đã ghi', if: MEET('hal') },
    { kind: 'scene', at: 'hal', lines: [id('w04')], if: MEET('hal') },
    { kind: 'goto', place: 'nora', label: 'Tới tiệm hoa của Nora' },
    { kind: 'scene', at: 'nora', lines: [id('t01'), id('t02')] },
    {
      kind: 'intent',
      who: 'board',
      ask: [id('t03')],
      options: [
        { label: 'Gọi lên, nói như anh vẫn nói', say: id('t03a'), reply: [id('t04')], flag: 'kept-tom' },
        { label: 'Viết thư cho Marcus đọc', say: id('t03b'), reply: [id('t05')] },
        { label: 'Tới phòng thu tự nói vào micro', say: id('t03c'), reply: [id('t06')], flag: 'kept-tom' },
      ],
      check: { right: [0, 2], consequence: 'letter', fact: 'ask' },
    },
    { kind: 'scene', at: 'nora', lines: [id('t07')], if: { hit: 'letter' } },
    { kind: 'radio', lines: [id('r01'), id('r02'), id('r03'), id('r04')] },
  ],
  ending: {
    clean: [id('e01'), id('e02'), id('e05')],
    messy: [id('e03'), id('e02')],
    broken: [id('e04'), id('e02')],
  },
  news: { clean: [id('n1')], messy: [id('n1')], broken: [id('n1')] },
};
