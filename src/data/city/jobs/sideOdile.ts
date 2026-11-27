// Side chain "Bộ đàm của bến phà" (docs/gta-plan.md §5 "người dùng bảng chữ cái khi đánh vần", docs/gta-story.md §9):
// three small jobs with Captain Odile, who has skippered the bay's ferry thirty years and never cancelled a crossing
// (docs/city.md §6, §10). Its kind of listening: RADIO PROCEDURE. On the ferry's radio nothing is said the easy way:
// names are spelled in the phonetic alphabet (Kilo, Echo, Alpha), numbers go one digit at a time, five is "fife" and
// nine is "niner", and the sides of a boat are port and starboard. The learner minds the harbour end: first Pete's lost
// property desk, then Gus's hut, then the quay.
//
// Westbay people only: the browser's voice, no clips.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

// ───────────────────────── 1. Thẻ hành lý ─────────────────────────

const a = (key: string) => `job-odile1-${key}`;

const LINES_1 = [
  { id: a('01'), who: 'odile', text: 'Somebody left a bag on my ferry. I will radio the name through to Pete.', vi: 'Có người để quên túi trên phà của tôi. Tôi sẽ gọi bộ đàm báo tên cho Pete.' },
  { id: a('02'), who: 'odile', text: 'I spell on the radio. Letters as words. Kilo is K, not C.', vi: 'Trên bộ đàm tôi đánh vần. Mỗi chữ cái là một từ. Kilo là K, không phải C.' },
  { id: a('03'), who: 'pete', text: "She spells everything. She spelled her own birthday once. Ready when you are.", vi: 'Bà ấy đánh vần mọi thứ. Có lần còn đánh vần cả ngày sinh của mình. Sẵn sàng thì bắt đầu.' },
  { id: a('c01'), who: 'odile', text: 'Ferry to lost property. One bag, black, found on the top deck. Over.', vi: 'Phà gọi phòng đồ thất lạc. Một túi, màu đen, tìm thấy ở boong trên. Hết.' },
  { id: a('c02'), who: 'odile', text: 'Name on the tag. Kilo, Echo, Alpha, November, Echo. Over.', vi: 'Tên trên thẻ. Kilo, Echo, Alpha, November, Echo. Hết.' },
  { id: a('c03'), who: 'odile', text: 'Put it in locker Papa fife. That is P, five. Out.', vi: 'Cất vào tủ Papa fife. Tức là P, số năm. Hết liên lạc.' },
  { id: a('c02r'), who: 'odile', text: 'I say again. Kilo, Echo, Alpha, November, Echo.', vi: 'Nhắc lại. Kilo, Echo, Alpha, November, Echo.' },
  { id: a('c03r'), who: 'odile', text: 'Papa fife. Papa fife. Out.', vi: 'Papa fife. Papa fife. Hết liên lạc.' },
  { id: a('c04'), who: 'odile', text: 'Lost property, this channel is for ferries. Clear it, please.', vi: 'Phòng đồ thất lạc, kênh này dành cho phà. Làm ơn trả kênh.' },
  // the owner comes for the bag, by what was written
  { id: a('k01'), who: 'pete', text: "A man's here for a bag. Name of Keane. Let me check your note.", vi: 'Có ông tới nhận túi. Tên là Keane. Để tôi xem cậu ghi gì.' },
  { id: a('k02'), who: 'pete', text: 'Keane with an E on the end. Same as the tag. Off you go, sir.', vi: 'Keane có chữ E ở cuối. Khớp với thẻ. Ông cầm đi nhé.' },
  { id: a('k03'), who: 'pete', text: "Your note says Keen. He says Keane. I'll ring the ferry and check.", vi: 'Cậu ghi là Keen. Ông ấy nói Keane. Để tôi gọi phà hỏi lại.' },
  { id: a('k04'), who: 'pete', text: 'Your note says Kean, no E. The tag has one. Ferry says yes, it is his.', vi: 'Cậu ghi Kean, không có E. Thẻ thì có. Phà bảo đúng là của ông ấy.' },
  { id: a('k05'), who: 'pete', text: 'Locker P five. Here it is.', vi: 'Tủ P năm. Đây rồi.' },
  { id: a('k06'), who: 'pete', text: 'Locker P nine is empty. Fife is five, on the radio. Here, P five.', vi: 'Tủ P chín trống trơn. Trên bộ đàm fife là năm. Đây, P năm.' },
  { id: a('k07'), who: 'pete', text: "Locker B five has someone's umbrella. Papa is P. Here, P five.", vi: 'Tủ B năm chỉ có cái ô của ai đó. Papa là P. Đây, P năm.' },
  { id: a('z1'), who: 'odile', text: 'Every letter right. Thirty years, and most of my crew still say C for Kilo.', vi: 'Đúng từng chữ. Ba mươi năm rồi, mà thủy thủ của tôi đa số vẫn ghi C cho Kilo.' },
  { id: a('z2'), who: 'odile', text: 'A letter astray. That is why we spell. Next time it will be right.', vi: 'Lạc mất một chữ. Vì thế mới phải đánh vần. Lần sau sẽ đúng.' },
  { id: a('z3'), who: 'odile', text: 'The bag got home. The alphabet takes a week to learn. Keep at it.', vi: 'Cái túi đã về với chủ. Bảng chữ cái này phải một tuần mới thuộc. Cứ tập đi.' },
  { id: a('n1'), who: 'kit', text: 'Lost on the ferry, found at the station. Pete has had a busy day.', vi: 'Quên trên phà, tìm thấy ở nhà ga. Hôm nay Pete bận rộn ghê.' },
];

const NB_1: NoteEntry[] = [
  {
    key: 'name',
    label: 'Tên trên thẻ',
    line: a('c02'),
    answer: 'keane',
    options: [
      { value: 'keane', label: 'KEANE' },
      { value: 'keen', label: 'KEEN' },
      { value: 'kean', label: 'KEAN' },
    ],
  },
  {
    key: 'locker',
    label: 'Cất vào tủ nào',
    line: a('c03'),
    answer: 'p5',
    options: [
      { value: 'p5', label: 'Tủ P5' },
      { value: 'p9', label: 'Tủ P9' },
      { value: 'b5', label: 'Tủ B5' },
    ],
  },
];

const F1 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_ODILE_1: JobDoc = {
  id: 'job-odile1',
  title: 'Thẻ hành lý',
  blurb: 'Thuyền trưởng Odile gọi bộ đàm báo tên trên một cái túi bỏ quên. Bà đánh vần, từng chữ một.',
  level: 1,
  order: 61,
  opens: ['ct-odile-1'],
  after: 'job-half5',
  from: 'odile',
  lines: LINES_1,
  facts: [
    { id: 'name', label: 'Tên trên thẻ', line: a('c02'), consequence: 'name' },
    { id: 'locker', label: 'Tủ nào', line: a('c03'), consequence: 'locker' },
  ],
  consequences: {
    name: { name: 'Ghi sai tên: Pete phải gọi phà hỏi lại', rejoin: 'Phà xác nhận, túi về đúng chủ.' },
    locker: { name: 'Cất nhầm tủ', rejoin: 'Pete tìm ra ở tủ P5.' },
  },
  steps: [
    { kind: 'goto', place: 'odile', label: 'Tới bến phà gặp thuyền trưởng Odile' },
    { kind: 'scene', at: 'odile', who: ['odile'], lines: [a('01'), a('02')] },
    { kind: 'goto', place: 'pete', label: 'Tới phòng đồ thất lạc của Pete' },
    { kind: 'scene', at: 'pete', who: ['pete'], lines: [a('03')] },
    {
      kind: 'notebook',
      via: 'radio',
      call: ['c01', 'c02', 'c03'].map(a),
      entries: NB_1,
      repeat: { name: [a('c02r')], locker: [a('c03r')] },
      patience: { after: 2, line: a('c04') },
    },
    {
      kind: 'scene',
      at: 'pete',
      who: ['pete'],
      lines: [
        a('k01'),
        { line: a('k02'), if: F1('name', 'keane') },
        { line: a('k03'), if: F1('name', 'keen') },
        { line: a('k04'), if: F1('name', 'kean') },
        { line: a('k05'), if: F1('locker', 'p5') },
        { line: a('k06'), if: F1('locker', 'p9') },
        { line: a('k07'), if: F1('locker', 'b5') },
      ],
    },
  ],
  ending: { clean: [a('z1')], messy: [a('z2')], broken: [a('z3')] },
  news: { clean: [a('n1')], messy: [a('n1')], broken: [a('n1')] },
};

// ───────────────────────── 2. Thuyền Petrel ─────────────────────────

const b = (key: string) => `job-odile2-${key}`;

const LINES_2 = [
  { id: b('01'), who: 'gus', text: "Odile's on channel twelve. A little boat's lost its engine in the bay.", vi: 'Odile đang ở kênh mười hai. Một chiếc thuyền nhỏ chết máy giữa vịnh.' },
  { id: b('02'), who: 'gus', text: 'Write what she says. Theo takes the launch out. He needs it right.', vi: 'Ghi lại những gì bà ấy nói. Theo sẽ chạy xuồng ra. Anh ấy cần thông tin chính xác.' },
  { id: b('c01'), who: 'odile', text: 'Ferry to harbour. Small sailing boat, engine failed. Nobody hurt. Over.', vi: 'Phà gọi cảng. Thuyền buồm nhỏ, hỏng máy. Không ai bị thương. Hết.' },
  { id: b('c02'), who: 'odile', text: 'Boat name, Papa, Echo, Tango, Romeo, Echo, Lima. Over.', vi: 'Tên thuyền, Papa, Echo, Tango, Romeo, Echo, Lima. Hết.' },
  { id: b('c03'), who: 'odile', text: 'Two people aboard. Drifting south of the lighthouse, slowly. Over.', vi: 'Có hai người trên thuyền. Đang trôi về phía nam ngọn hải đăng, chậm thôi. Hết.' },
  { id: b('c04'), who: 'odile', text: 'Sail number, one niner fife. One, nine, five. Out.', vi: 'Số buồm, một niner fife. Một, chín, năm. Hết liên lạc.' },
  { id: b('c02r'), who: 'odile', text: 'I spell again. Papa, Echo, Tango, Romeo, Echo, Lima.', vi: 'Đánh vần lại. Papa, Echo, Tango, Romeo, Echo, Lima.' },
  { id: b('c03r'), who: 'odile', text: 'South of the lighthouse. South.', vi: 'Phía nam ngọn hải đăng. Phía nam.' },
  { id: b('c04r'), who: 'odile', text: 'One niner fife. One niner fife.', vi: 'Một niner fife. Một niner fife.' },
  { id: b('c05'), who: 'odile', text: 'Harbour, I have a ferry to steer. Read back what you have.', vi: 'Cảng ơi, tôi còn phải lái phà. Đọc lại những gì đã ghi đi.' },
  // Theo at the launch, by what was written
  { id: b('t01'), who: 'theo', text: 'South of the lighthouse. I know the current there. Going.', vi: 'Phía nam ngọn hải đăng. Tôi biết dòng chảy ở đó. Đi đây.' },
  { id: b('t02'), who: 'theo', text: "North? The tide goes south this hour. I'll look south first, then.", vi: 'Phía bắc á? Giờ này thủy triều chảy về nam. Thế thì tôi tìm phía nam trước.' },
  { id: b('t03'), who: 'theo', text: "By the pier? I'd see it from here. I'll try past the lighthouse.", vi: 'Cạnh cầu tàu á? Thế thì từ đây tôi đã thấy rồi. Tôi thử ra phía sau hải đăng.' },
  { id: b('t04'), who: 'theo', text: 'Found them. Petrel, one nine five. Two cold people and a dog.', vi: 'Thấy rồi. Petrel, một chín năm. Hai người lạnh cóng và một con chó.' },
  { id: b('t05'), who: 'theo', text: 'I hailed a Betrel. No such boat. Then I saw Petrel on the bow.', vi: 'Tôi gọi một chiếc Betrel. Chẳng có thuyền nào tên thế. Rồi tôi thấy chữ Petrel ở mũi thuyền.' },
  { id: b('t06'), who: 'theo', text: 'The sail said one nine five, not what you wrote. I towed it anyway.', vi: 'Buồm ghi một chín năm, không phải số bạn ghi. Dù sao tôi cũng kéo nó về.' },
  { id: b('z1'), who: 'theo', text: 'Right boat, right place. Odile will pretend she is not impressed.', vi: 'Đúng thuyền, đúng chỗ. Odile sẽ làm bộ như không ấn tượng gì.' },
  { id: b('z2'), who: 'theo', text: 'We got there. Took a bit longer than it should.', vi: 'Rồi cũng tới nơi. Lâu hơn đáng lẽ một chút.' },
  { id: b('z3'), who: 'theo', text: 'Everyone is home and dry. That is the part that counts.', vi: 'Ai cũng về nhà, khô ráo. Đó mới là điều quan trọng.' },
  { id: b('n1'), who: 'kit', text: 'A small boat towed home safely this afternoon. Well done, the ferry crew.', vi: 'Chiều nay một chiếc thuyền nhỏ được kéo về an toàn. Giỏi lắm, đội phà.' },
];

const NB_2: NoteEntry[] = [
  {
    key: 'boat',
    label: 'Tên thuyền',
    line: b('c02'),
    answer: 'petrel',
    options: [
      { value: 'petrel', label: 'PETREL' },
      { value: 'betrel', label: 'BETREL' },
      { value: 'petral', label: 'PETRAL' },
    ],
  },
  {
    key: 'where',
    label: 'Đang trôi ở đâu',
    line: b('c03'),
    answer: 'south',
    options: [
      { value: 'south', label: 'Phía nam hải đăng' },
      { value: 'north', label: 'Phía bắc hải đăng' },
      { value: 'pier', label: 'Cạnh cầu tàu' },
    ],
  },
  {
    key: 'sail',
    label: 'Số trên buồm',
    line: b('c04'),
    answer: '195',
    options: [
      { value: '195', label: '195' },
      { value: '199', label: '199' },
      { value: '155', label: '155' },
    ],
  },
];

const F2 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_ODILE_2: JobDoc = {
  id: 'job-odile2',
  title: 'Thuyền Petrel',
  blurb: 'Một chiếc thuyền buồm nhỏ chết máy giữa vịnh. Odile gọi bộ đàm, Theo chạy xuồng ra. Bạn ghi ở chòi gác cảng.',
  level: 1,
  order: 62,
  opens: ['ct-odile-1'],
  after: 'job-odile1',
  from: 'odile',
  lines: LINES_2,
  facts: [
    { id: 'boat', label: 'Tên thuyền', line: b('c02'), consequence: 'boat' },
    { id: 'where', label: 'Ở đâu', line: b('c03'), consequence: 'where' },
    { id: 'sail', label: 'Số buồm', line: b('c04'), consequence: 'sail' },
  ],
  consequences: {
    boat: { name: 'Ghi sai tên thuyền: Theo gọi nhầm', rejoin: 'Theo đọc được tên ở mũi thuyền.' },
    where: { name: 'Ghi sai chỗ: Theo tìm vòng', rejoin: 'Theo biết dòng chảy và tìm ra phía nam.' },
    sail: { name: 'Ghi sai số buồm', rejoin: 'Theo thấy số trên buồm và vẫn kéo về.' },
  },
  steps: [
    { kind: 'goto', place: 'gus', label: 'Tới chòi gác cảng của Gus' },
    { kind: 'scene', at: 'gus', who: ['gus'], lines: [b('01'), b('02')] },
    {
      kind: 'notebook',
      via: 'radio',
      call: ['c01', 'c02', 'c03', 'c04'].map(b),
      entries: NB_2,
      repeat: { boat: [b('c02r')], where: [b('c03r')], sail: [b('c04r')] },
      patience: { after: 2, line: b('c05') },
    },
    { kind: 'goto', place: 'theo', label: 'Đưa thông tin cho Theo ở xuồng' },
    {
      kind: 'scene',
      at: 'theo',
      who: ['theo'],
      lines: [
        { line: b('t01'), if: F2('where', 'south') },
        { line: b('t02'), if: F2('where', 'north') },
        { line: b('t03'), if: F2('where', 'pier') },
        { line: b('t04'), if: F2('boat', 'petrel') },
        { line: b('t05'), if: { note: 'boat', is: 'wrong' } },
        { line: b('t06'), if: { note: 'sail', is: 'wrong' } },
      ],
    },
  ],
  ending: { clean: [b('z1')], messy: [b('z2')], broken: [b('z3')] },
  news: { clean: [b('n1')], messy: [b('n1')], broken: [b('n1')] },
};

// ───────────────────────── 3. Sương mù ─────────────────────────

const c = (key: string) => `job-odile3-${key}`;

const LINES_3 = [
  { id: c('01'), who: 'gus', text: "Fog's in. Odile's still coming. Thirty years, she's never cancelled one.", vi: 'Sương mù kéo vào rồi. Odile vẫn chạy. Ba mươi năm, bà ấy chưa hủy chuyến nào.' },
  { id: c('02'), who: 'gus', text: 'Go down to the quay. She wants someone on the ropes. Listen for the side.', vi: 'Xuống bến đi. Bà ấy cần người lo dây. Nghe kỹ bên nào.' },
  { id: c('03'), who: 'gus', text: 'Port is left. Starboard is right. Odile never says left or right.', vi: 'Port là bên trái. Starboard là bên phải. Odile không bao giờ nói trái hay phải.' },
  { id: c('c01'), who: 'odile', text: 'Ferry to quay. Crossing one one zero one three, inbound in fog. Over.', vi: 'Phà gọi bến. Chuyến một một không một ba, đang vào trong sương mù. Hết.' },
  { id: c('c02'), who: 'odile', text: 'Coming alongside starboard side to. Ropes ready, please. Over.', vi: 'Cập bến mạn phải. Chuẩn bị dây giùm. Hết.' },
  { id: c('c03'), who: 'odile', text: 'Alongside in one fife minutes. One, five. Out.', vi: 'Cập bến trong một fife phút. Một, năm. Hết liên lạc.' },
  { id: c('c01r'), who: 'odile', text: 'Crossing one one zero one three.', vi: 'Chuyến một một không một ba.' },
  { id: c('c02r'), who: 'odile', text: 'Starboard side to. Starboard.', vi: 'Mạn phải. Starboard.' },
  { id: c('c03r'), who: 'odile', text: 'One fife minutes.', vi: 'Một fife phút.' },
  { id: c('c04'), who: 'odile', text: 'Quay, I cannot see my own bow. Keep the channel clear.', vi: 'Bến ơi, tôi còn chẳng thấy mũi phà của mình. Giữ kênh trống đi.' },
  // on the quay, by what was written
  { id: c('q01'), who: 'theo', text: 'Ropes on the right. That is how she likes it. Good.', vi: 'Dây ở bên phải. Đúng ý bà ấy. Tốt.' },
  { id: c('q02'), who: 'theo', text: "Ropes on the left? She said starboard. Quick, we'll carry them over.", vi: 'Dây ở bên trái á? Bà ấy nói starboard mà. Nhanh, khiêng qua bên kia.' },
  { id: c('q03'), who: 'theo', text: 'Fifteen minutes. Time for a tea, then. I always have tea in fog.', vi: 'Mười lăm phút. Thế thì kịp làm cốc trà. Trời sương là tôi uống trà.' },
  { id: c('q04'), who: 'theo', text: "Fifty minutes? There she is already. Fife is five. One five, fifteen.", vi: 'Năm mươi phút á? Phà tới kia rồi. Fife là năm. Một năm, mười lăm.' },
  { id: c('q05'), who: 'gus', text: 'Crossing one one zero one three, logged. In ink, like always.', vi: 'Chuyến một một không một ba, đã ghi sổ. Bằng mực, như mọi khi.' },
  { id: c('q06'), who: 'gus', text: "That number's not tonight's. One one zero one three. I'll fix the log.", vi: 'Số đó không phải của tối nay. Một một không một ba. Để tôi sửa sổ.' },
  { id: c('z1'), who: 'odile', text: 'Ropes on the right side, on time, in fog. You may call me Odile.', vi: 'Dây đúng bên, đúng giờ, giữa sương mù. Từ giờ cứ gọi tôi là Odile.' },
  { id: c('z2'), who: 'odile', text: 'We came in. A little late on the ropes. The fog was thick.', vi: 'Phà đã cập. Lo dây hơi chậm một chút. Sương dày thật.' },
  { id: c('z3'), who: 'odile', text: 'Thirty years, never cancelled. Tonight was close. We will practise.', vi: 'Ba mươi năm, chưa hủy chuyến nào. Tối nay suýt nữa. Mình sẽ tập.' },
  { id: c('n1'), who: 'kit', text: 'The ferry came in through thick fog tonight. Captain Odile, as ever, on time.', vi: 'Tối nay phà cập bến xuyên qua sương mù dày. Thuyền trưởng Odile, như mọi khi, đúng giờ.' },
];

const NB_3: NoteEntry[] = [
  {
    key: 'crossing',
    label: 'Số chuyến phà',
    line: c('c01'),
    answer: '11013',
    options: [
      { value: '11013', label: '11013' },
      { value: '11030', label: '11030' },
      { value: '11003', label: '11003' },
    ],
  },
  {
    key: 'side',
    label: 'Cập mạn nào',
    line: c('c02'),
    answer: 'right',
    options: [
      { value: 'right', label: 'Mạn phải (starboard)' },
      { value: 'left', label: 'Mạn trái (port)' },
      { value: 'stern', label: 'Lùi đuôi vào bến' },
    ],
  },
  {
    key: 'when',
    label: 'Bao lâu nữa cập',
    line: c('c03'),
    answer: '15',
    options: [
      { value: '15', label: '15 phút' },
      { value: '50', label: '50 phút' },
      { value: '5', label: '5 phút' },
    ],
  },
];

const F3 = (key: string, v: string) => ({ note: key, value: v });

export const JOB_ODILE_3: JobDoc = {
  id: 'job-odile3',
  title: 'Sương mù',
  blurb: 'Sương mù kéo vào vịnh, mà Odile chưa hủy chuyến nào trong ba mươi năm. Bạn lo dây ở bến.',
  level: 2,
  order: 63,
  opens: ['ct-odile-1'],
  after: 'job-odile2',
  from: 'odile',
  lines: LINES_3,
  facts: [
    { id: 'crossing', label: 'Số chuyến', line: c('c01'), consequence: 'crossing' },
    { id: 'side', label: 'Mạn nào', line: c('c02'), consequence: 'side' },
    { id: 'when', label: 'Bao lâu', line: c('c03'), consequence: 'when' },
  ],
  consequences: {
    crossing: { name: 'Ghi sai số chuyến vào sổ', rejoin: 'Gus sửa lại sổ.' },
    side: { name: 'Chuẩn bị dây nhầm mạn', rejoin: 'Theo cùng khiêng dây sang bên phải.' },
    when: { name: 'Ghi sai giờ cập', rejoin: 'Phà tới sớm, Theo giải thích fife là năm.' },
  },
  steps: [
    { kind: 'goto', place: 'gus', label: 'Tới chòi gác cảng của Gus' },
    { kind: 'scene', at: 'gus', who: ['gus'], lines: [c('01'), c('02'), c('03')] },
    { kind: 'goto', place: 'theo', label: 'Xuống bến lo dây cùng Theo' },
    {
      kind: 'notebook',
      via: 'radio',
      call: ['c01', 'c02', 'c03'].map(c),
      entries: NB_3,
      repeat: { crossing: [c('c01r')], side: [c('c02r')], when: [c('c03r')] },
      patience: { after: 1, line: c('c04') },
    },
    {
      kind: 'scene',
      at: 'theo',
      who: ['theo', 'gus'],
      lines: [
        { line: c('q01'), if: F3('side', 'right') },
        { line: c('q02'), if: { note: 'side', is: 'wrong' } },
        { line: c('q03'), if: F3('when', '15') },
        { line: c('q04'), if: { note: 'when', is: 'wrong' } },
        { line: c('q05'), if: F3('crossing', '11013') },
        { line: c('q06'), if: { note: 'crossing', is: 'wrong' } },
      ],
    },
  ],
  ending: { clean: [c('z1')], messy: [c('z2')], broken: [c('z3')] },
  news: { clean: [c('n1')], messy: [c('n1')], broken: [c('n1')] },
};

export const SIDE_ODILE: readonly JobDoc[] = [JOB_ODILE_1, JOB_ODILE_2, JOB_ODILE_3];
