// Act II, job 5a: "Gọi vào đài" (docs/gta-story-2.md §4 job 5a; Marcus's chain). One daytime hour on Bay FM: Marcus
// asks the city to put money towards buying the station for its listeners. The learner sits beside Kit and notes who
// pledges what (the plan's call-in ladder, §4.5: callers of every pace). One caller is Bayline's ("Mr Pryce", who only
// wants the price); one is the sister of the night watchman at warehouse fifteen.
//
// As written, against the bible (docs/gta-story-2.md §11 "As written"):
//   - the pledges' look-alikes: thirty / thirteen (Frank), a hundred and eighty / eighteen (Gianna), "twelve, no,
//     twenty" (Hal corrects himself), sixty / sixteen (Nora); four callers in two notebooks, not Gianna's dinner;
//   - "Mr Pryce" and the watchman's sister speak in the call-in show's caller voices (core/town/sceneTypes.ts
//     'caller-hurried-m', 'caller-clear-f'): nobody new;
//   - the watchman's hours are told here and kept as a flag (`watchman`) for job 4a "Ca đêm" (`past:
//     'job-callin:watchman'`), the order rule of the bible's §3;
//   - the crew: Kit (he says each caller's name and line before they speak: easier to follow) or Claire (she keeps
//     the book: what was noted wrong, she catches at the end); alone, Marcus catches it.
// Nobody of the town speaks: no clips.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-callin-${key}`;
const wrong = (note: string) => ({ note, is: 'wrong' as const });

const LINES = [
  // ── beat 1: the studio ──
  { id: id('a01'), who: 'marcus', text: 'One hour, no sponsor, and the whole city listening. Hopefully.', vi: 'Một tiếng, không nhà tài trợ, và cả thành phố đang nghe. Hy vọng thế.' },
  { id: id('a02'), who: 'kit', text: 'You take the phones. Write down every name and every amount.', vi: 'Bạn nghe máy. Ghi lại từng cái tên và từng con số.' },
  { id: id('a03'), who: 'marcus', text: 'If the listeners can match his price, the station stays ours.', vi: 'Nếu người nghe góp đủ bằng giá của hắn, đài vẫn là của mình.' },
  { id: id('a04k'), who: 'kit', text: "I'll say each name before they're on. You just catch the numbers.", vi: 'Tôi sẽ đọc tên từng người trước khi họ lên sóng. Bạn chỉ cần bắt mấy con số.' },
  { id: id('a04c'), who: 'claire', text: "I'll keep the book. Harbour Press can hold the money, all legal.", vi: 'Tôi giữ sổ. Harbour Press có thể đứng giữ tiền, đúng luật hết.' },
  // ── beat 3: the calls, first two ──
  { id: id('b00'), who: 'marcus', text: "Good afternoon, Westbay. Bay FM is for sale, and I'd like you to buy it.", vi: 'Chào buổi chiều Westbay. Bay FM đang được rao bán, và tôi muốn các bạn mua nó.' },
  { id: id('b01k'), who: 'kit', text: 'Line one, Frank from the comic stall.', vi: 'Đường dây một, Frank ở sạp truyện tranh.' },
  { id: id('b01'), who: 'frank', text: 'Frank, Market Street. Put me down for thirty. And play something from the seventies.', vi: 'Frank, phố Chợ đây. Ghi cho tôi ba mươi. Và mở bài gì đó của thập niên bảy mươi.' },
  { id: id('b02k'), who: 'kit', text: "Line two, Gianna. She's shouting already.", vi: 'Đường dây hai, Gianna. Bà ấy đang quát rồi kìa.' },
  { id: id('b02'), who: 'gianna', text: 'Marcus! A hundred and eighty, from the restaurant. Now eat something, you sound thin.', vi: 'Marcus! Một trăm tám mươi, từ nhà hàng. Giờ đi ăn cái gì đi, nghe giọng gầy quá.' },
  { id: id('b01r'), who: 'frank', text: 'Thirty. Three, oh.', vi: 'Ba mươi. Ba, không.' },
  { id: id('b02r'), who: 'gianna', text: 'One hundred and eighty! Eight, oh! Are you deaf in there?', vi: 'Một trăm tám mươi! Tám, không! Trong đó điếc hết rồi à?' },
  { id: id('b03'), who: 'kit', text: "No time for repeats on live radio, I'm afraid. Next line.", vi: 'Trên sóng trực tiếp không có thời gian nhắc lại đâu. Đường dây tiếp theo.' },
  // the next two
  { id: id('c01k'), who: 'kit', text: 'Line three, Hal from the fish stall.', vi: 'Đường dây ba, Hal ở hàng cá.' },
  { id: id('c01'), who: 'hal', text: "Hal here. Twelve. No, twenty. Twenty, I'm not a mean man.", vi: 'Hal đây. Mười hai. À không, hai mươi. Hai mươi, tôi đâu phải người keo kiệt.' },
  { id: id('c02k'), who: 'kit', text: 'Line four, Nora at Sunflower Corner.', vi: 'Đường dây bốn, Nora ở Sunflower Corner.' },
  { id: id('c02'), who: 'nora', text: 'Nora and Theo, Sunflower Corner. Sixty from us. Maya says sixty too.', vi: 'Nora và Theo, Sunflower Corner. Sáu mươi từ nhà tôi. Bé Maya cũng bảo sáu mươi.' },
  { id: id('c01r'), who: 'hal', text: 'Twenty. Two, oh. Final offer.', vi: 'Hai mươi. Hai, không. Giá chốt.' },
  { id: id('c02r'), who: 'nora', text: 'Sixty. Six, oh.', vi: 'Sáu mươi. Sáu, không.' },
  // Mr Pryce
  { id: id('p01'), who: 'caller-hurried-m', text: "Hello, Marcus, Mr Pryce here. Just curious. What's the asking price, exactly?", vi: 'Chào Marcus, Pryce đây. Chỉ tò mò thôi. Giá chào bán chính xác là bao nhiêu?' },
  { id: id('p02a'), who: 'player', text: "Sorry, we're not taking that call. Next caller, please.", vi: 'Xin lỗi, chúng tôi không nhận cuộc này. Mời người gọi tiếp theo.' },
  { id: id('p02b'), who: 'player', text: "About forty thousand, I think. Why do you ask?", vi: 'Khoảng bốn mươi nghìn, tôi nghĩ vậy. Sao ông hỏi?' },
  { id: id('p02c'), who: 'player', text: 'Marcus, this one wants to talk money. Over to you.', vi: 'Marcus, người này muốn nói chuyện tiền. Anh trả lời nhé.' },
  { id: id('p03a'), who: 'kit', text: 'Good. That was Bayline, I bet my desk on it.', vi: 'Tốt. Đó là người của Bayline, tôi cược cả cái bàn của tôi.' },
  { id: id('p03b'), who: 'caller-hurried-m', text: 'Forty. Thank you. That is all I needed.', vi: 'Bốn mươi. Cảm ơn. Tôi chỉ cần có thế.' },
  { id: id('p04b'), who: 'kit', text: 'Pryce. Price. That was Bayline. And now Kemp knows we know.', vi: 'Pryce. Price. Đó là Bayline. Và giờ Kemp biết là mình biết rồi.' },
  { id: id('p03c'), who: 'marcus', text: "We don't do prices on air, Mr Pryce. Next caller, please.", vi: 'Chúng tôi không nói giá trên sóng, ông Pryce. Mời người gọi tiếp theo.' },
  // the watchman's sister
  { id: id('w01'), who: 'caller-clear-f', text: "My brother watches warehouse fifteen at night. Ten till two. He hates it.", vi: 'Em trai tôi gác kho mười lăm ban đêm. Từ mười giờ tới hai giờ. Nó ghét việc đó lắm.' },
  { id: id('w02'), who: 'caller-clear-f', text: "He says they're moving boxes out soon. Twenty from me, for Marcus.", vi: 'Nó bảo sắp có người chở thùng ra. Hai mươi từ tôi, tặng Marcus.' },
  { id: id('w03'), who: 'kit', text: 'Write that down? The watchman, ten till two?', vi: 'Ghi cái đó lại chứ? Người gác, mười giờ tới hai giờ?' },
  { id: id('w04a'), who: 'player', text: "Written down. The watchman's on from ten till two.", vi: 'Ghi rồi. Người gác trực từ mười giờ tới hai giờ.' },
  { id: id('w04b'), who: 'player', text: "No, it's only gossip. Let's keep going.", vi: 'Thôi, chỉ là chuyện phiếm. Làm tiếp đi.' },
  { id: id('w05a'), who: 'kit', text: "Gus will want that. He's watching the same door.", vi: 'Gus sẽ cần cái đó. Ông ấy đang canh đúng cái cửa ấy.' },
  { id: id('w05b'), who: 'kit', text: 'Fair enough. Gossip is half of radio anyway.', vi: 'Cũng được. Đằng nào đài phát thanh cũng một nửa là chuyện phiếm.' },
  // what the book got wrong
  { id: id('x01c'), who: 'claire', text: "Thirty from Frank, not thirteen. I'll ring him and say sorry.", vi: 'Frank góp ba mươi, không phải mười ba. Tôi sẽ gọi xin lỗi ông ấy.' },
  { id: id('x02c'), who: 'claire', text: 'Gianna said a hundred and eighty. Eight, oh. My ears are still ringing.', vi: 'Gianna nói một trăm tám mươi. Tám, không. Tai tôi vẫn còn ù.' },
  { id: id('x03c'), who: 'claire', text: 'Hal changed his mind. Twenty in the end, not twelve.', vi: 'Hal đổi ý mà. Cuối cùng là hai mươi, không phải mười hai.' },
  { id: id('x04c'), who: 'claire', text: 'Sixty from Nora. She said it twice, and so did Maya.', vi: 'Nora góp sáu mươi. Cô ấy nói hai lần, bé Maya cũng vậy.' },
  { id: id('x01'), who: 'marcus', text: "Frank said thirty, you know. He'll tell everyone we lost his money.", vi: 'Frank nói ba mươi đấy. Ông ấy sẽ kể với mọi người là mình làm mất tiền của ông ấy.' },
  { id: id('x02'), who: 'marcus', text: "Gianna's was a hundred and eighty. She'll check, believe me.", vi: 'Của Gianna là một trăm tám mươi. Bà ấy sẽ kiểm tra lại đấy, tin tôi đi.' },
  { id: id('x03'), who: 'marcus', text: 'Hal settled on twenty. He always starts low.', vi: 'Hal chốt hai mươi. Ông ấy lúc nào cũng mở giá thấp.' },
  { id: id('x04'), who: 'marcus', text: "Nora's sixty, not sixteen. Maya will never forgive us.", vi: 'Nora góp sáu mươi, không phải mười sáu. Bé Maya sẽ không bao giờ tha cho mình.' },
  // ── beat 4 ──
  { id: id('z01'), who: 'marcus', text: "That's the hour. Thank you, Westbay. You've no idea what that meant.", vi: 'Hết giờ rồi. Cảm ơn Westbay. Các bạn không biết điều đó có ý nghĩa thế nào đâu.' },
  { id: id('z02'), who: 'kit', text: "Not forty thousand yet. But it's a start, and it's ours.", vi: 'Chưa được bốn mươi nghìn. Nhưng là khởi đầu, và là của mình.' },
  // the last word, by grade
  { id: id('e1'), who: 'marcus', text: 'Every name, every number. You should be doing my job.', vi: 'Từng cái tên, từng con số. Bạn nên làm việc của tôi mới phải.' },
  { id: id('e2'), who: 'marcus', text: "A couple of mix-ups. Live radio. It happens to me every night.", vi: 'Vài chỗ nhầm. Phát trực tiếp mà. Tối nào tôi cũng gặp.' },
  { id: id('e3'), who: 'marcus', text: "We'll ring them all back tomorrow. Slowly. With a pencil.", vi: 'Mai mình gọi lại cho tất cả. Từ từ. Có cây bút chì.' },
  // the news, by how it ended
  { id: id('f1'), who: 'kit', text: 'Bay FM thanks everyone who rang in today. The station is not sold yet.', vi: 'Bay FM cảm ơn mọi người đã gọi tới hôm nay. Đài chưa bị bán đâu.' },
  { id: id('f2'), who: 'kit', text: 'Some pledges today were written down wrong. Please ring again if that was you.', vi: 'Hôm nay vài khoản góp bị ghi sai. Nếu là bạn, làm ơn gọi lại.' },
];

const FIRST: NoteEntry[] = [
  {
    key: 'frank',
    label: 'Frank góp bao nhiêu',
    line: id('b01'),
    answer: '30',
    options: [
      { value: '30', label: '30' },
      { value: '13', label: '13' },
      { value: '3', label: '3' },
    ],
  },
  {
    key: 'gianna',
    label: 'Gianna góp bao nhiêu',
    line: id('b02'),
    answer: '180',
    options: [
      { value: '180', label: '180' },
      { value: '118', label: '118' },
      { value: '108', label: '108' },
    ],
  },
];

const SECOND: NoteEntry[] = [
  {
    key: 'hal',
    label: 'Hal góp bao nhiêu',
    line: id('c01'),
    answer: '20',
    options: [
      { value: '20', label: '20' },
      { value: '12', label: '12' },
      { value: '22', label: '22' },
    ],
  },
  {
    key: 'nora',
    label: 'Nora góp bao nhiêu',
    line: id('c02'),
    answer: '60',
    options: [
      { value: '60', label: '60' },
      { value: '16', label: '16' },
      { value: '6', label: '6' },
    ],
  },
];

export const JOB_CALLIN: JobDoc = {
  id: 'job-callin',
  title: 'Gọi vào đài',
  blurb: 'Một giờ trên sóng ban ngày: Marcus xin cả thành phố góp tiền mua lại Bay FM. Bạn nghe máy và ghi sổ.',
  level: 3,
  order: 17,
  opens: ['ct-rico-1'],
  after: 'job-sale',
  from: 'marcus',
  crew: {
    roles: [
      { who: 'kit', role: 'Bàn âm thanh', listen: 'Kit đọc tên từng người trước khi họ lên sóng: bạn chỉ cần bắt con số.', opens: { heard: ['ct-kit-2'] }, cut: CREW_CUT.friend, with: { at: 'kit' } },
      { who: 'claire', role: 'Giữ sổ', listen: 'Claire giữ sổ góp tiền: chỗ nào bạn ghi sai, cô bắt được ở cuối.', opens: { heard: ['ct-claire-3'] }, cut: CREW_CUT.friend, with: { at: 'kit' } },
    ],
  },
  lines: LINES,
  facts: [
    { id: 'frank', label: 'Frank góp bao nhiêu', line: id('b01'), consequence: 'frank' },
    { id: 'gianna', label: 'Gianna góp bao nhiêu', line: id('b02'), consequence: 'gianna' },
    { id: 'hal', label: 'Hal góp bao nhiêu', line: id('c01'), consequence: 'hal' },
    { id: 'nora', label: 'Nora góp bao nhiêu', line: id('c02'), consequence: 'nora' },
    { id: 'pryce', label: 'Ông Pryce muốn gì', line: id('p01'), consequence: 'leak', byAction: true },
  ],
  consequences: {
    frank: { name: 'Ghi sai khoản của Frank', rejoin: 'Có người sửa lại; Frank được gọi xin lỗi.' },
    gianna: { name: 'Ghi sai khoản của Gianna', rejoin: 'Có người sửa lại.' },
    hal: { name: 'Ghi sai khoản của Hal (ông ấy tự sửa giữa câu)', rejoin: 'Có người sửa lại: hai mươi.' },
    nora: { name: 'Ghi sai khoản của Nora', rejoin: 'Có người sửa lại.' },
    leak: { name: 'Nói giá cho "ông Pryce": người của Bayline', rejoin: 'Kemp biết người nghe đã biết giá; quỹ vẫn tiếp tục.' },
  },
  steps: [
    { kind: 'goto', place: 'kit', label: 'Tới phòng thu Bay FM' },
    { kind: 'scene', at: 'kit', who: ['kit', 'marcus'], lines: [id('a01'), id('a02'), id('a03')] },
    { kind: 'scene', at: 'kit', who: ['kit'], lines: [id('a04k')], if: { crew: 'kit' } },
    { kind: 'scene', at: 'kit', who: ['claire'], lines: [id('a04c')], if: { crew: 'claire' } },
    // beat 3: on air, the first two calls
    {
      kind: 'notebook',
      via: 'radio',
      call: [id('b00'), { line: id('b01k'), if: { crew: 'kit' } }, id('b01'), { line: id('b02k'), if: { crew: 'kit' } }, id('b02')],
      entries: FIRST,
      repeat: { frank: [id('b01r')], gianna: [id('b02r')] },
      patience: { after: 1, line: id('b03') },
    },
    {
      kind: 'notebook',
      via: 'radio',
      call: [{ line: id('c01k'), if: { crew: 'kit' } }, id('c01'), { line: id('c02k'), if: { crew: 'kit' } }, id('c02')],
      entries: SECOND,
      repeat: { hal: [id('c01r')], nora: [id('c02r')] },
      patience: { after: 1, line: id('b03') },
    },
    // Mr Pryce: only after the price
    { kind: 'radio', lines: [id('p01')] },
    {
      kind: 'intent',
      who: 'caller-hurried-m',
      ask: [],
      options: [
        { label: 'Không nhận cuộc này', say: id('p02a'), reply: [id('p03a')] },
        { label: 'Nói giá cho ông ta', say: id('p02b'), reply: [id('p03b'), id('p04b')], flag: 'told-pryce' },
        { label: 'Chuyển cho Marcus', say: id('p02c'), reply: [id('p03c')] },
      ],
      check: { right: [0, 2], consequence: 'leak', fact: 'pryce' },
    },
    // the watchman's sister: kept for job 4a "Ca đêm"
    { kind: 'radio', lines: [id('w01'), id('w02'), id('w03')] },
    {
      kind: 'intent',
      who: 'kit',
      ask: [],
      options: [
        { label: 'Ghi lại ca của người gác', say: id('w04a'), reply: [id('w05a')], flag: 'watchman' },
        { label: 'Bỏ qua, chuyện phiếm', say: id('w04b'), reply: [id('w05b')] },
      ],
    },
    // the book checked: by Claire if she came, else by Marcus
    {
      kind: 'scene',
      at: 'kit',
      who: ['claire'],
      lines: [
        { line: id('x01c'), if: wrong('frank') },
        { line: id('x02c'), if: wrong('gianna') },
        { line: id('x03c'), if: wrong('hal') },
        { line: id('x04c'), if: wrong('nora') },
      ],
      if: { crew: 'claire' },
    },
    {
      kind: 'scene',
      at: 'kit',
      who: ['marcus'],
      lines: [
        { line: id('x01'), if: wrong('frank') },
        { line: id('x02'), if: wrong('gianna') },
        { line: id('x03'), if: wrong('hal') },
        { line: id('x04'), if: wrong('nora') },
      ],
      if: { not: { crew: 'claire' } },
    },
    // beat 4
    { kind: 'scene', at: 'kit', who: ['marcus', 'kit'], lines: [id('z01'), id('z02')] },
  ],
  ending: { clean: [id('e1')], messy: [id('e2')], broken: [id('e3')] },
  news: { clean: [id('f1')], messy: [id('f2')], broken: [id('f2')] },
};

