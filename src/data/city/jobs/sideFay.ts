// Side chain "Cuộc đua vịt" (docs/gta-plan.md §5 "trường đua với lời bình luận nhanh", docs/gta-story.md §9): three
// small jobs with Fay, who sells the big wheel's tickets and hosts the harbour fair (docs/city.md §9). Its kind of
// listening: FAST commentary. The fair's rubber duck race for the hospital runs from the seafront jetty to the ferry
// steps, and Marcus calls it on the stage's speakers (he calls the fair's race: docs/city.md §9) the way he talks on
// air: numbers one after another, a correction in the middle, a joke on top. The learner keeps the results at the
// finish. No betting: the tickets are a charity's (every penny to the hospital's children's ward).
//
// Westbay people only: the browser's voice, no clips. The finish is staged at the ferry ('odile').

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

// ───────────────────────── 1. Vịt số mấy ─────────────────────────

const a = (key: string) => `job-fay1-${key}`;

const LINES_1 = [
  { id: a('01'), who: 'fay', text: 'Two hundred rubber ducks, a number on each back. All for the hospital.', vi: 'Hai trăm con vịt cao su, mỗi con một số trên lưng. Tất cả góp cho bệnh viện.' },
  { id: a('02'), who: 'fay', text: "Marcus calls it, and he calls it fast. Write down the first three.", vi: 'Marcus bình luận, mà bình luận nhanh lắm. Ghi lại ba con về đầu.' },
  { id: a('03'), who: 'fay', text: "I'll be at my booth. Ducks are fine. It's the wheel I can't look at.", vi: 'Tôi ngồi ở quầy. Vịt thì không sao. Tôi chỉ không nhìn nổi cái vòng quay thôi.' },
  { id: a('c01'), who: 'marcus', text: "And they're off from the jetty! Two hundred ducks and the wind behind them!", vi: 'Xuất phát từ cầu tàu rồi! Hai trăm con vịt và gió thổi sau lưng!' },
  { id: a('c02'), who: 'marcus', text: "Forty-one's in front! Forty-one, by a beak!", vi: 'Số bốn mốt dẫn đầu! Bốn mốt, hơn đúng một cái mỏ!' },
  { id: a('c03'), who: 'marcus', text: "Fourteen's coming through. No, that's thirteen. Thirteen in second!", vi: 'Số mười bốn đang vượt lên. À không, mười ba. Mười ba về nhì!' },
  { id: a('c04'), who: 'marcus', text: 'And ninety in third, with a bit of seaweed on its head!', vi: 'Và chín mươi về ba, trên đầu dính tí rong biển!' },
  { id: a('c05'), who: 'marcus', text: 'Over the line at the ferry steps! Ticket holders, see Fay, please!', vi: 'Về đích ở bậc bến phà! Ai giữ vé, mời gặp Fay!' },
  { id: a('c02r'), who: 'marcus', text: 'Forty-one. Four, one.', vi: 'Bốn mốt. Bốn, một.' },
  { id: a('c03r'), who: 'marcus', text: 'Thirteen. Not fourteen. Thirteen.', vi: 'Mười ba. Không phải mười bốn. Mười ba.' },
  { id: a('c04r'), who: 'marcus', text: 'Ninety. Nine, oh. The seaweed one.', vi: 'Chín mươi. Chín, không. Con dính rong.' },
  { id: a('c06'), who: 'fay', text: "He won't say it again. He's already on to the next joke.", vi: 'Anh ấy không nói lại đâu. Đang sang câu đùa khác rồi.' },
  // at the finish: who comes for a prize, by what was written
  { id: a('w01'), who: 'hal', text: 'Forty? That is mine! Oh. Forty-one, you say. Never mind.', vi: 'Bốn mươi á? Vé của tôi! Ồ. Bốn mốt à. Thôi kệ.' },
  { id: a('w02'), who: 'poppy', text: "Fourteen? That's Dot's ticket. She'll come out of the bakery for this.", vi: 'Mười bốn á? Vé của Dot đấy. Vì vụ này chắc chị ấy chịu ra khỏi lò bánh.' },
  { id: a('w03'), who: 'fay', text: 'Fourteen came in fifth, I saw it. Thirteen was second. Sorry, Poppy.', vi: 'Mười bốn về thứ năm, tôi thấy mà. Mười ba mới về nhì. Xin lỗi nhé Poppy.' },
  { id: a('w04'), who: 'sol', text: 'Nineteen! I knew it. Wait, ninety? Then my duck is still out there somewhere.', vi: 'Mười chín! Biết ngay mà. Khoan, chín mươi á? Thế vịt của tôi vẫn còn trôi đâu đó.' },
  { id: a('k01'), who: 'fay', text: 'Forty-one, thirteen, ninety. Three happy people and one very wet duck.', vi: 'Bốn mốt, mười ba, chín mươi. Ba người vui và một con vịt ướt sũng.' },
  { id: a('z1'), who: 'fay', text: 'Every duck right. You should call it next year. I mean that.', vi: 'Đúng hết. Năm sau bạn bình luận đi. Tôi nói thật đấy.' },
  { id: a('z2'), who: 'fay', text: 'A couple of mix-ups. Marcus does talk like a waterfall.', vi: 'Có vài chỗ nhầm. Marcus nói như thác đổ mà.' },
  { id: a('z3'), who: 'fay', text: "We'll check the photos. The ducks won't mind waiting.", vi: 'Mình xem lại ảnh. Mấy con vịt không phiền chờ đâu.' },
  { id: a('n1'), who: 'kit', text: 'The harbour duck race raised money for the hospital today. Thank you, Westbay.', vi: 'Hôm nay cuộc đua vịt ở cảng gây quỹ cho bệnh viện. Cảm ơn Westbay.' },
];

const NB_1: NoteEntry[] = [
  {
    key: 'first',
    label: 'Về nhất: vịt số mấy',
    line: a('c02'),
    answer: '41',
    options: [
      { value: '41', label: 'Số 41' },
      { value: '40', label: 'Số 40' },
      { value: '14', label: 'Số 14' },
    ],
  },
  {
    key: 'second',
    label: 'Về nhì: vịt số mấy',
    line: a('c03'),
    answer: '13',
    options: [
      { value: '13', label: 'Số 13' },
      { value: '14', label: 'Số 14' },
      { value: '30', label: 'Số 30' },
    ],
  },
  {
    key: 'third',
    label: 'Về ba: vịt số mấy',
    line: a('c04'),
    answer: '90',
    options: [
      { value: '90', label: 'Số 90' },
      { value: '19', label: 'Số 19' },
      { value: '9', label: 'Số 9' },
    ],
  },
];

const F1 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_FAY_1: JobDoc = {
  id: 'job-fay1',
  title: 'Vịt số mấy',
  blurb: 'Cuộc đua vịt cao su gây quỹ cho bệnh viện. Marcus bình luận, nhanh như thác đổ. Bạn ghi kết quả ở đích.',
  level: 1,
  order: 51,
  opens: ['ct-fay-1'],
  after: 'job-half5',
  from: 'fay',
  lines: LINES_1,
  facts: [
    { id: 'first', label: 'Về nhất', line: a('c02'), consequence: 'first' },
    { id: 'second', label: 'Về nhì', line: a('c03'), consequence: 'second' },
    { id: 'third', label: 'Về ba', line: a('c04'), consequence: 'third' },
  ],
  consequences: {
    first: { name: 'Ghi sai con về nhất: người khác tới nhận giải', rejoin: 'Hal nhận ra là nhầm, giải vẫn về đúng vé.' },
    second: { name: 'Ghi sai con về nhì', rejoin: 'Fay thấy tận mắt và sửa lại.' },
    third: { name: 'Ghi sai con về ba', rejoin: 'Sol nhận ra vịt của mình vẫn đang trôi.' },
  },
  steps: [
    { kind: 'goto', place: 'fay', label: 'Tới quầy vé vòng đu quay của Fay' },
    { kind: 'scene', at: 'fay', who: ['fay'], lines: ['01', '02', '03'].map(a) },
    { kind: 'goto', place: 'odile', label: 'Ra đích ở bậc bến phà' },
    {
      kind: 'notebook',
      via: 'radio',
      call: ['c01', 'c02', 'c03', 'c04', 'c05'].map(a),
      entries: NB_1,
      repeat: { first: [a('c02r')], second: [a('c03r')], third: [a('c04r')] },
      patience: { after: 1, line: a('c06') },
    },
    {
      kind: 'scene',
      at: 'odile',
      who: ['fay', 'hal', 'poppy', 'sol'],
      lines: [
        { line: a('w01'), if: { note: 'first', is: 'wrong' } },
        { line: a('w02'), if: F1('second', '14') },
        { line: a('w03'), if: { note: 'second', is: 'wrong' } },
        { line: a('w04'), if: { note: 'third', is: 'wrong' } },
        a('k01'),
      ],
    },
  ],
  ending: { clean: [a('z1')], messy: [a('z2')], broken: [a('z3')] },
  news: { clean: [a('n1')], messy: [a('n1')], broken: [a('n1')] },
};

// ───────────────────────── 2. Giải thưởng ─────────────────────────

const b = (key: string) => `job-fay2-${key}`;

const LINES_2 = [
  { id: b('01'), who: 'fay', text: "Prizes now. I read fast when I'm nervous, and I'm always nervous.", vi: 'Giờ tới giải thưởng. Lúc hồi hộp tôi đọc nhanh lắm, mà lúc nào tôi cũng hồi hộp.' },
  { id: b('c01'), who: 'fay', text: "First prize, dinner for two at Gianna's. She says bring an appetite.", vi: 'Giải nhất, bữa tối cho hai người ở quán Gianna. Bà ấy dặn mang theo cái bụng đói.' },
  { id: b('c02'), who: 'fay', text: "Second prize, a lantern. Sol's, not Hal's. Hal gave a fish, and it's gone.", vi: 'Giải nhì, một chiếc lồng đèn. Của Sol, không phải của Hal. Hal góp một con cá, mà nó hết rồi.' },
  { id: b('c03'), who: 'fay', text: 'Third prize, a free turn on the big wheel. Twelve minutes. Better you than me.', vi: 'Giải ba, một vòng đu quay miễn phí. Mười hai phút. Thà bạn lên còn hơn tôi.' },
  { id: b('c04'), who: 'fay', text: 'Hand them out at the ferry steps. The winners are waiting there.', vi: 'Phát giải ở bậc bến phà nhé. Người thắng đang chờ ở đó.' },
  { id: b('c01r'), who: 'fay', text: "Dinner at Gianna's. For two.", vi: 'Bữa tối ở quán Gianna. Cho hai người.' },
  { id: b('c02r'), who: 'fay', text: "A lantern. Sol's lantern.", vi: 'Một chiếc lồng đèn. Lồng đèn của Sol.' },
  { id: b('c03r'), who: 'fay', text: 'The big wheel. One turn, free.', vi: 'Vòng đu quay. Một vòng, miễn phí.' },
  { id: b('c05'), who: 'fay', text: 'Please. People are waiting. I can hear Gianna from here.', vi: 'Làm ơn. Người ta đang chờ. Tôi nghe tiếng Gianna từ đây rồi.' },
  // the prizes handed out, by what was written
  { id: b('h01'), who: 'amira', text: "Dinner at Gianna's? Lovely. She buys my saffron, so she owes me one.", vi: 'Bữa tối ở quán Gianna á? Tuyệt. Bà ấy mua nghệ tây của tôi, nên cũng nợ tôi một bữa.' },
  { id: b('h02'), who: 'amira', text: "A pizza voucher? Gianna doesn't do vouchers. It was dinner, surely.", vi: 'Phiếu mua pizza á? Gianna làm gì có phiếu. Chắc là bữa tối chứ.' },
  { id: b('h03'), who: 'amira', text: 'Dinner at Bo\'s? Bo only does karaoke and crisps. You mean Gianna\'s.', vi: 'Ăn tối ở quán Bo á? Quán Bo chỉ có karaoke với khoai tây chiên. Ý bạn là quán Gianna.' },
  { id: b('h04'), who: 'poppy', text: "A lantern from Sol! Dot will hang it over the ovens. If it doesn't burn.", vi: 'Lồng đèn của Sol! Dot sẽ treo nó trên lò. Nếu nó không cháy.' },
  { id: b('h05'), who: 'poppy', text: "A fish from Hal? Fay said it was gone. Hal sold it at lunch.", vi: 'Cá của Hal á? Fay bảo hết rồi mà. Hal bán nó từ trưa.' },
  { id: b('h06'), who: 'jonah', text: 'A turn on the wheel? Twelve minutes up there. I might write a song.', vi: 'Một vòng đu quay à? Mười hai phút trên đó. Có khi tôi viết được một bài.' },
  { id: b('h07'), who: 'jonah', text: "A ticket for the ferry? Fay said the wheel. I'm sure she said the wheel.", vi: 'Vé đi phà á? Fay nói vòng đu quay mà. Tôi chắc chắn cô ấy nói vòng đu quay.' },
  { id: b('k01'), who: 'fay', text: 'Three prizes, three smiles. I can breathe again.', vi: 'Ba giải, ba nụ cười. Tôi thở lại được rồi.' },
  { id: b('z1'), who: 'fay', text: "Everyone got the right thing. That's never happened before. Ever.", vi: 'Ai cũng nhận đúng giải. Chuyện này chưa từng xảy ra. Chưa bao giờ.' },
  { id: b('z2'), who: 'fay', text: 'Nearly. I did read it fast. My grandad read slowly. I should learn.', vi: 'Gần đúng. Tôi đọc nhanh thật. Ông nội tôi đọc chậm. Tôi phải học mới được.' },
  { id: b('z3'), who: 'fay', text: "It all got sorted at the steps. People here are kind about mistakes.", vi: 'Ở bậc bến phà rồi cũng xong cả. Người ở đây dễ tính với chuyện nhầm lẫn.' },
  { id: b('n1'), who: 'kit', text: "The duck race prizes went to Amira, Poppy and Jonah. Well done, all.", vi: 'Giải đua vịt đã về tay Amira, Poppy và Jonah. Chúc mừng cả ba.' },
];

const NB_2: NoteEntry[] = [
  {
    key: 'first',
    label: 'Giải nhất là gì',
    line: b('c01'),
    answer: 'gianna',
    options: [
      { value: 'gianna', label: 'Bữa tối ở quán Gianna' },
      { value: 'pizza', label: 'Phiếu mua pizza' },
      { value: 'bo', label: 'Bữa tối ở quán Bo' },
    ],
  },
  {
    key: 'second',
    label: 'Giải nhì là gì',
    line: b('c02'),
    answer: 'lantern',
    options: [
      { value: 'lantern', label: 'Lồng đèn của Sol' },
      { value: 'fish', label: 'Cá của Hal' },
      { value: 'both', label: 'Lồng đèn và cá' },
    ],
  },
  {
    key: 'third',
    label: 'Giải ba là gì',
    line: b('c03'),
    answer: 'wheel',
    options: [
      { value: 'wheel', label: 'Một vòng đu quay' },
      { value: 'ferry', label: 'Một vé đi phà' },
      { value: 'meal', label: 'Một suất ăn' },
    ],
  },
];

const F2 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_FAY_2: JobDoc = {
  id: 'job-fay2',
  title: 'Giải thưởng',
  blurb: 'Fay đọc danh sách giải thưởng. Lúc hồi hộp cô đọc nhanh, mà lúc nào cô cũng hồi hộp.',
  level: 1,
  order: 52,
  opens: ['ct-fay-1'],
  after: 'job-fay1',
  from: 'fay',
  lines: LINES_2,
  facts: [
    { id: 'first', label: 'Giải nhất', line: b('c01'), consequence: 'first' },
    { id: 'second', label: 'Giải nhì', line: b('c02'), consequence: 'second' },
    { id: 'third', label: 'Giải ba', line: b('c03'), consequence: 'third' },
  ],
  consequences: {
    first: { name: 'Phát nhầm giải nhất', rejoin: 'Amira nói ra đúng giải: bữa tối ở quán Gianna.' },
    second: { name: 'Phát nhầm giải nhì', rejoin: 'Poppy nhắc: cá của Hal đã bán hết.' },
    third: { name: 'Phát nhầm giải ba', rejoin: 'Jonah nhắc: là một vòng đu quay.' },
  },
  steps: [
    { kind: 'goto', place: 'fay', label: 'Tới quầy vé vòng đu quay của Fay' },
    { kind: 'scene', at: 'fay', who: ['fay'], lines: [b('01')] },
    {
      kind: 'notebook',
      via: 'scene',
      call: ['c01', 'c02', 'c03', 'c04'].map(b),
      entries: NB_2,
      repeat: { first: [b('c01r')], second: [b('c02r')], third: [b('c03r')] },
      patience: { after: 2, line: b('c05') },
    },
    { kind: 'goto', place: 'odile', label: 'Mang giải tới bậc bến phà' },
    {
      kind: 'scene',
      at: 'odile',
      who: ['amira', 'poppy', 'jonah'],
      lines: [
        { line: b('h01'), if: F2('first', 'gianna') },
        { line: b('h02'), if: F2('first', 'pizza') },
        { line: b('h03'), if: F2('first', 'bo') },
        { line: b('h04'), if: F2('second', 'lantern') },
        { line: b('h05'), if: { note: 'second', is: 'wrong' } },
        { line: b('h06'), if: F2('third', 'wheel') },
        { line: b('h07'), if: { note: 'third', is: 'wrong' } },
        b('k01'),
      ],
    },
  ],
  ending: { clean: [b('z1')], messy: [b('z2')], broken: [b('z3')] },
  news: { clean: [b('n1')], messy: [b('n1')], broken: [b('n1')] },
};

// ───────────────────────── 3. Chung kết ─────────────────────────

const c = (key: string) => `job-fay3-${key}`;

const LINES_3 = [
  { id: c('01'), who: 'fay', text: 'The final. The winners of every heat, one more race. Marcus is warming up his voice.', vi: 'Trận chung kết. Những con thắng các lượt, đua thêm một lần. Marcus đang khởi động giọng.' },
  { id: c('02'), who: 'fay', text: "And this time the money goes somewhere special. He'll say where.", vi: 'Và lần này tiền gây quỹ tới một chỗ đặc biệt. Anh ấy sẽ nói là đâu.' },
  { id: c('c01'), who: 'marcus', text: 'Every penny today goes to the children on ward seven. Thank you, Westbay!', vi: 'Từng đồng hôm nay góp cho bọn trẻ ở khoa bảy. Cảm ơn Westbay!' },
  { id: c('c02'), who: 'marcus', text: "They're off! Seventeen in the green hat takes the lead!", vi: 'Xuất phát! Số mười bảy đội mũ xanh lá vọt lên dẫn đầu!' },
  { id: c('c03'), who: 'marcus', text: "Seventy's catching up. No hat, no shame. It's neck and neck!", vi: 'Số bảy mươi đang đuổi kịp. Không mũ, không ngại. Ngang ngửa nhau!' },
  { id: c('c04'), who: 'marcus', text: "Photo finish! And it's the green hat! Seventeen wins the final!", vi: 'Về đích sát nút! Là con mũ xanh lá! Số mười bảy vô địch!' },
  { id: c('c01r'), who: 'marcus', text: 'Ward seven. The children. Seven.', vi: 'Khoa bảy. Bọn trẻ. Bảy.' },
  { id: c('c02r'), who: 'marcus', text: 'The green hat. Green.', vi: 'Mũ xanh lá. Xanh lá.' },
  { id: c('c04r'), who: 'marcus', text: 'Seventeen. One, seven.', vi: 'Mười bảy. Một, bảy.' },
  { id: c('c05'), who: 'fay', text: "He's already singing. You won't get another word out of him now.", vi: 'Anh ấy hát luôn rồi. Giờ chẳng moi thêm được chữ nào đâu.' },
  // the results taken to the hospital, by what was written
  { id: c('b01'), who: 'bridget', text: 'For ward seven? The children will go wild. Thank you, love.', vi: 'Cho khoa bảy à? Bọn trẻ sẽ phát cuồng mất. Cảm ơn cưng.' },
  { id: c('b02'), who: 'bridget', text: "Ward eleven? That's the offices. Ward seven is the children. I'll take it there.", vi: 'Khoa mười một á? Đó là văn phòng. Khoa bảy mới là khoa nhi. Tôi mang qua đó.' },
  { id: c('b03'), who: 'bridget', text: "Ward six? That's mums and new babies. The children are seven. I'll pass it on.", vi: 'Khoa sáu á? Đó là khoa sản, các mẹ và em bé mới sinh. Trẻ con ở khoa bảy. Tôi chuyển giùm.' },
  { id: c('b04'), who: 'bridget', text: 'Seventeen won? A little girl on the ward picked seventeen. She will cry.', vi: 'Số mười bảy thắng à? Một bé gái trong khoa chọn số mười bảy. Con bé sẽ khóc mất.' },
  { id: c('b05'), who: 'bridget', text: "Seventy? Nobody here picked seventy. Are you sure? Let me ring Fay.", vi: 'Bảy mươi á? Ở đây chẳng ai chọn bảy mươi. Bạn chắc không? Để tôi gọi Fay.' },
  { id: c('b06'), who: 'bridget', text: 'No hat, you said? The one she drew had a green hat. Funny.', vi: 'Không mũ á? Con bé vẽ con vịt đội mũ xanh lá cơ. Lạ nhỉ.' },
  { id: c('z1'), who: 'fay', text: 'The right duck, the right ward, the right hat. My grandad would be proud.', vi: 'Đúng vịt, đúng khoa, đúng mũ. Ông nội tôi chắc sẽ tự hào.' },
  { id: c('z2'), who: 'fay', text: 'Bridget sorted the rest. She always does.', vi: 'Bridget lo nốt phần còn lại. Lúc nào chị ấy cũng thế.' },
  { id: c('z3'), who: 'fay', text: "The money got there. That's what the race was for, in the end.", vi: 'Tiền đã tới nơi. Rốt cuộc cuộc đua là để cho việc đó.' },
  { id: c('n1'), who: 'kit', text: 'The duck race final raised money for the children on ward seven. Seventeen won.', vi: 'Trận chung kết đua vịt gây quỹ cho bọn trẻ khoa bảy. Số mười bảy vô địch.' },
];

const NB_3: NoteEntry[] = [
  {
    key: 'ward',
    label: 'Tiền góp cho khoa nào',
    line: c('c01'),
    answer: '7',
    options: [
      { value: '7', label: 'Khoa 7 (trẻ em)' },
      { value: '11', label: 'Khoa 11' },
      { value: '6', label: 'Khoa 6' },
    ],
  },
  {
    key: 'hat',
    label: 'Con thắng đội mũ gì',
    line: c('c02'),
    answer: 'green',
    options: [
      { value: 'green', label: 'Mũ xanh lá' },
      { value: 'grey', label: 'Mũ xám' },
      { value: 'none', label: 'Không đội mũ' },
    ],
  },
  {
    key: 'winner',
    label: 'Con vô địch số mấy',
    line: c('c04'),
    answer: '17',
    options: [
      { value: '17', label: 'Số 17' },
      { value: '70', label: 'Số 70' },
      { value: '7', label: 'Số 7' },
    ],
  },
];

const F3 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_FAY_3: JobDoc = {
  id: 'job-fay3',
  title: 'Chung kết',
  blurb: 'Trận chung kết của cuộc đua vịt. Lần này tiền gây quỹ tới một chỗ đặc biệt.',
  level: 2,
  order: 53,
  opens: ['ct-fay-1'],
  after: 'job-fay2',
  from: 'fay',
  lines: LINES_3,
  facts: [
    { id: 'ward', label: 'Khoa nào', line: c('c01'), consequence: 'ward' },
    { id: 'hat', label: 'Mũ gì', line: c('c02'), consequence: 'hat' },
    { id: 'winner', label: 'Số mấy', line: c('c04'), consequence: 'winner' },
  ],
  consequences: {
    ward: { name: 'Mang tiền nhầm khoa', rejoin: 'Bridget chuyển sang khoa bảy.' },
    hat: { name: 'Ghi sai mũ của con thắng', rejoin: 'Bé gái ở khoa vẽ đúng con mũ xanh.' },
    winner: { name: 'Ghi sai số của con vô địch', rejoin: 'Bridget gọi hỏi Fay.' },
  },
  steps: [
    { kind: 'goto', place: 'fay', label: 'Tới quầy vé vòng đu quay của Fay' },
    { kind: 'scene', at: 'fay', who: ['fay'], lines: [c('01'), c('02')] },
    { kind: 'goto', place: 'odile', label: 'Ra đích ở bậc bến phà' },
    {
      kind: 'notebook',
      via: 'radio',
      call: ['c01', 'c02', 'c03', 'c04'].map(c),
      entries: NB_3,
      repeat: { ward: [c('c01r')], hat: [c('c02r')], winner: [c('c04r')] },
      patience: { after: 1, line: c('c05') },
    },
    { kind: 'goto', place: 'bridget', label: 'Mang tiền và kết quả tới bệnh viện' },
    {
      kind: 'scene',
      at: 'bridget',
      who: ['bridget'],
      lines: [
        { line: c('b01'), if: F3('ward', '7') },
        { line: c('b02'), if: F3('ward', '11') },
        { line: c('b03'), if: F3('ward', '6') },
        { line: c('b04'), if: F3('winner', '17') },
        { line: c('b05'), if: { note: 'winner', is: 'wrong' } },
        { line: c('b06'), if: { note: 'hat', is: 'wrong' } },
      ],
    },
  ],
  ending: { clean: [c('z1')], messy: [c('z2')], broken: [c('z3')] },
  news: { clean: [c('n1')], messy: [c('n1')], broken: [c('n1')] },
};

export const SIDE_FAY: readonly JobDoc[] = [JOB_FAY_1, JOB_FAY_2, JOB_FAY_3];
