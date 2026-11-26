// Act I, job 3: "Chip là ga" ("Chip is the station", docs/gta-story.md §4 job 3). Bayline listens to Rico's radio, so
// Max (up for his monthly visit to Jun) and Jun change the firm's sets and give the places code names out of the town
// below, which nobody up here knows: "Chip" (Sam's dog waits at the bus stop) is the station, "Grace's" (she helps at
// the hospital on Wednesdays) is the hospital. Then Rico calls a fare in code, the learner picks up Bridget, Grace's
// old student, and Nell, and at the gate a Bayline car's radio asks what on earth Chip is.
//
// Changed from the outline (listed in docs/gta-plan.md §14 too):
//   - Max explains the code over the NEW radio, testing it from Jun's stall (notebook via 'radio'), not in person at
//     the gatehouse: the town's residents are not in Westbay's world for a job;
//   - Rico calls one fare in code, not three (the "two / to" trap is in it); a wrong channel is his phone call and a
//     fare lost to Bayline;
//   - "Chip" heard as a computer chip: Jun's stall; "Grace's": the third look-alike is Gianna's (a G-name with an 's);
//   - the second passenger is Nell, the pharmacist (docs/city.md §7), going back to the hospital's pharmacy with
//     Bridget; left behind, she phones the learner herself;
//   - the Bayline car is a driver standing by Gus's hut with his radio on loud (the dispatcher is heard, not seen); too
//     near and he turns it off.
// Max is of the town ('phone'): his lines are clips (connected only), the browser voice until the owner makes them.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-chip-${key}`;
const COUNT_WRONG = { note: 'count', is: 'wrong' as const };

const LINES = [
  // ── beat 1: the new radio ──
  { id: id('a01'), who: 'jun', text: 'Testing the new set. Rico, can you hear us?', vi: 'Thử bộ đàm mới. Rico, nghe thấy không?' },
  { id: id('a02'), who: 'phone', text: "It's Max, mate. Jun and I swapped every radio in the firm.", vi: 'Max đây. Tôi với Jun thay hết bộ đàm của hãng rồi.' },
  { id: id('a03'), who: 'phone', text: 'From tonight, the firm talks on channel thirteen, mate.', vi: 'Từ tối nay, hãng nói chuyện trên kênh mười ba nhé.' },
  { id: id('a04'), who: 'phone', text: "And no place names on air. Bayline's listening. We use code.", vi: 'Và không nói tên chỗ nào trên sóng. Bayline đang nghe. Mình dùng mật mã.' },
  { id: id('a05'), who: 'phone', text: "Chip is the station. Sam's dog waits there for the bus.", vi: '"Chip" là ga. Con chó của Sam ngồi đó chờ xe buýt.' },
  { id: id('a06'), who: 'phone', text: "Grace's is the hospital. She helps out there on Wednesdays.", vi: '"Grace\'s" là bệnh viện. Thứ Tư nào bà cũng tới đó giúp.' },
  { id: id('a07'), who: 'phone', text: "Nobody up here knows our town. That's the whole trick.", vi: 'Trên này chẳng ai biết thị trấn của tụi tôi. Mẹo là ở đó.' },
  { id: id('a08'), who: 'jun', text: "He took his gran's radio apart when he was nine. Trust him.", vi: 'Năm chín tuổi cậu ấy tháo tung cái đài của bà. Tin cậu ấy đi.' },
  { id: id('a03r'), who: 'phone', text: 'Thirteen. One, three. Not thirty.', vi: 'Mười ba. Một, ba. Không phải ba mươi.' },
  { id: id('a05r'), who: 'phone', text: "Chip. The station. Where Sam's dog sits, mate.", vi: '"Chip". Là ga. Chỗ con chó của Sam ngồi ấy.' },
  { id: id('a06r'), who: 'phone', text: "Grace's. The hospital. Grace, with an s on the end.", vi: '"Grace\'s". Bệnh viện. Grace, thêm chữ s ở cuối.' },
  { id: id('a09'), who: 'phone', text: "Mate, I've got a screwdriver in my mouth. Last time.", vi: 'Này, tôi đang ngậm cái tua vít đấy. Lần cuối nhé.' },
  // ── beat 2: Rico's fare, in code ──
  { id: id('l01'), who: 'rico', text: "Where are you? You're not on thirteen. I've lost a fare to Bayline.", vi: 'Bạn đâu rồi? Bạn không ở kênh mười ba. Tôi mất một cuốc vào tay Bayline rồi.' },
  { id: id('l02'), who: 'rico', text: 'Switch over now. Next one is yours.', vi: 'Chuyển kênh ngay. Cuốc tới là của bạn.' },
  { id: id('b01'), who: 'rico', text: 'Rico on thirteen. Got one for you.', vi: 'Rico, kênh mười ba. Có một cuốc cho bạn.' },
  { id: id('b02'), who: 'rico', text: "Pick up at Chip, two to Grace's. Over.", vi: 'Đón ở "Chip", hai người tới "Grace\'s". Hết.' },
  { id: id('b03'), who: 'rico', text: "They're nurses. Be nice, they've had a long day.", vi: 'Họ là y tá. Lịch sự nhé, họ làm cả ngày mệt rồi.' },
  { id: id('b02r'), who: 'rico', text: "Two. Two of them. At Chip, going to Grace's.", vi: 'Hai. Hai người. Ở "Chip", đi "Grace\'s".' },
  { id: id('b03r'), who: 'rico', text: 'Nurses. Two of them, off a long shift.', vi: 'Y tá. Hai người, vừa xong ca dài.' },
  { id: id('b04'), who: 'rico', text: "I'm driving, mate. Listen this time, yeah?", vi: 'Tôi đang lái xe đấy. Lần này nghe kỹ nhé?' },
  // ── the pickup ──
  { id: id('w-ferry'), who: 'odile', text: "Chip? I've got nobody called Chip on my ship.", vi: 'Chip á? Trên tàu tôi chẳng có ai tên Chip.' },
  { id: id('w-jun'), who: 'jun', text: "Chip means the station, not my stall. I only fix the chips.", vi: '"Chip" là ga, không phải sạp của tôi. Tôi chỉ sửa chip thôi.' },
  { id: id('p01'), who: 'okafor', text: 'Two nurses from the hospital have been waiting here a while.', vi: 'Có hai cô y tá bệnh viện đứng chờ ở đây một lúc rồi.' },
  { id: id('q-two'), who: 'player', text: 'Car for two, going to the hospital?', vi: 'Xe cho hai người, đi bệnh viện phải không ạ?' },
  { id: id('q-one'), who: 'player', text: 'Car for one, going to the hospital?', vi: 'Xe cho một người, đi bệnh viện phải không ạ?' },
  { id: id('q-two-oclock'), who: 'player', text: "Car for two o'clock, going to the hospital?", vi: 'Xe đặt lúc hai giờ, đi bệnh viện phải không ạ?' },
  { id: id('x-okafor'), who: 'okafor', text: 'Not me, I sell the tickets. The nurses are by the door.', vi: 'Không phải tôi, tôi bán vé. Mấy cô y tá đứng cạnh cửa kia.' },
  { id: id('x-pete'), who: 'pete', text: 'I keep lost property, not lost nurses. Try her.', vi: 'Tôi giữ đồ thất lạc, không giữ y tá thất lạc. Hỏi cô kia đi.' },
  { id: id('x-nell'), who: 'nell', text: "I'm with Bridget. She's the one who booked it.", vi: 'Tôi đi cùng Bridget. Cô ấy là người đặt xe.' },
  { id: id('x-tess'), who: 'tess', text: 'Coffee? No? The nurses are over there, with their coats on.', vi: 'Cà phê không? Không à? Mấy cô y tá đứng đằng kia, mặc áo khoác.' },
  { id: id('p02'), who: 'bridget', text: 'Are you our car? Over here, love!', vi: 'Xe của tụi tôi phải không? Đây này!' },
  { id: id('g01'), who: 'bridget', text: "That's us. Nell, come on, the car's here.", vi: 'Tụi tôi đây. Nell, đi thôi, xe tới rồi.' },
  { id: id('g02'), who: 'bridget', text: "Just one? Then I'll go first. Nell can wait for the next.", vi: 'Có một chỗ thôi à? Vậy tôi đi trước. Nell chờ chuyến sau.' },
  { id: id('g03'), who: 'bridget', text: "Two o'clock? It's nearly dark, love. Never mind, let's go.", vi: 'Hai giờ á? Trời sắp tối rồi. Thôi kệ, đi nào.' },
  // ── the ride ──
  { id: id('t01'), who: 'bridget', text: "Grace's? That's what you call the hospital? Oh, she'd love that.", vi: '"Grace\'s"? Mấy người gọi bệnh viện như thế à? Ôi, bà ấy sẽ thích lắm.' },
  { id: id('t02'), who: 'bridget', text: 'She taught me in London. She still checks my bandages.', vi: 'Bà dạy tôi hồi ở London. Tới giờ bà vẫn kiểm tra băng tôi quấn.' },
  { id: id('t03'), who: 'nell', text: "Don't tell Grace. She'll want it on a badge.", vi: 'Đừng kể với Grace. Bà sẽ đòi in nó lên huy hiệu mất.' },
  { id: id('r-right'), who: 'bridget', text: "Lovely. Thank you, and say hello to Grace's for me.", vi: 'Tốt quá. Cảm ơn nhé, và cho tôi gửi lời chào "Grace\'s".' },
  { id: id('r-gus'), who: 'gus', text: "This is a gate, mate, not a hospital. Up the hill.", vi: 'Đây là cổng cảng, không phải bệnh viện. Lên đồi kìa.' },
  { id: id('r-gianna'), who: 'gianna', text: 'We do pasta, darling, not plasters. The hospital is up the hill.', vi: 'Ở đây có mì Ý thôi, không có băng cá nhân. Bệnh viện ở trên đồi.' },
  { id: id('r-walk'), who: 'bridget', text: "We'll walk from here. It's not far, and my feet need it.", vi: 'Tụi tôi đi bộ từ đây. Không xa đâu, chân tôi cũng cần vận động.' },
  { id: id('n01'), who: 'nell', text: "It's Nell. You left me at the station. Bridget went without me.", vi: 'Nell đây. Bạn bỏ tôi lại ở ga. Bridget đi mất rồi.' },
  { id: id('n02'), who: 'nell', text: "Two means two, love. I've rung Rico. He's turning round.", vi: 'Hai là hai người đấy. Tôi gọi Rico rồi. Anh ấy đang quay xe.' },
  // ── the Bayline car at the gate ──
  { id: id('o01'), who: 'baydesk', text: "Bayline desk. Anyone know what Chip is? Rico's lot keep saying Chip.", vi: 'Tổng đài Bayline. Có ai biết "Chip" là gì không? Bọn của Rico cứ nói "Chip".' },
  { id: id('o02'), who: 'driver', text: 'Chip. Like a chip. A potato chip? No idea, love.', vi: 'Chip. Như miếng khoai à? Chịu, chẳng biết.' },
  { id: id('o03'), who: 'baydesk', text: "And Grace's. Who's Grace? Is there a Grace's on the map?", vi: 'Còn "Grace\'s". Grace là ai? Trên bản đồ có chỗ nào tên "Grace\'s" không?' },
  { id: id('o04'), who: 'driver', text: 'Not on mine. Boss says leave it, then?', vi: 'Bản đồ của tôi thì không. Sếp bảo thôi kệ à?' },
  { id: id('o05'), who: 'baydesk', text: 'Boss says leave it. Park up by the gate tonight.', vi: 'Sếp bảo kệ. Tối nay đỗ xe cạnh cổng cảng.' },
  { id: id('o06'), who: 'driver', text: "Is it a pub? A dog? I checked the map. Nothing.", vi: 'Là quán rượu à? Con chó à? Tôi xem bản đồ rồi. Chẳng có gì.' },
  { id: id('o-seen'), who: 'driver', text: "Can I help you? No? Then I'll have my window up.", vi: 'Cần gì không? Không à? Vậy tôi kéo kính lên đây.' },
  // ── beat 4 ──
  { id: id('e1'), who: 'phone', text: "Told you. Nobody up here's ever heard of Chip.", vi: 'Đã bảo mà. Trên này chưa ai nghe tới Chip bao giờ.' },
  { id: id('e2'), who: 'rico', text: 'Two days of fares, and Bayline had none of them.', vi: 'Hai ngày khách, Bayline chẳng giành được cuốc nào.' },
  { id: id('e3'), who: 'phone', text: 'Code holds, mate. Mostly. Write the numbers bigger next time.', vi: 'Mật mã vẫn giữ được. Gần như thế. Lần sau ghi số to hơn nhé.' },
  { id: id('e4'), who: 'rico', text: 'We kept the code. We lost a fare or two.', vi: 'Giữ được mật mã. Mất một hai cuốc.' },
  { id: id('e5'), who: 'phone', text: "The code's fine, mate. It's the listening that needs work.", vi: 'Mật mã thì ổn. Cái cần luyện là nghe.' },
  { id: id('e6'), who: 'rico', text: "Bayline didn't crack it. We just drove everybody wrong.", vi: 'Bayline không giải được mã. Chỉ là mình chở ai cũng sai.' },
  { id: id('e7'), who: 'jun', text: 'Channel thirteen, and nobody else on it. Lovely and quiet.', vi: 'Kênh mười ba, chẳng có ai khác. Yên tĩnh dễ chịu.' },
  { id: id('n1'), who: 'kit', text: 'Morning traffic, brought to you by Bayline. Quiet roads all round.', vi: 'Giao thông buổi sáng, do Bayline tài trợ. Đường nào cũng vắng.' },
  { id: id('n2'), who: 'kit', text: 'Expect delays around the harbour gate tonight.', vi: 'Tối nay có thể tắc đường quanh cổng cảng.' },
  { id: id('n3'), who: 'kit', text: 'Bayline says some fares went to the wrong address last night.', vi: 'Bayline nói tối qua có vài cuốc chở nhầm địa chỉ.' },
];

const CODE: NoteEntry[] = [
  {
    key: 'channel',
    label: 'Kênh mới',
    line: id('a03'),
    answer: '13',
    options: [
      { value: '13', label: 'Kênh 13' },
      { value: '30', label: 'Kênh 30' },
      { value: '3', label: 'Kênh 3' },
    ],
  },
  {
    key: 'chip',
    label: '"Chip" là',
    line: id('a05'),
    answer: 'station',
    options: [
      { value: 'station', label: 'Ga trung tâm' },
      { value: 'ferry', label: 'Bến phà ("ship")' },
      { value: 'jun', label: 'Sạp đồ điện tử của Jun' },
    ],
  },
  {
    key: 'graces',
    label: '"Grace\'s" là',
    line: id('a06'),
    answer: 'hospital',
    options: [
      { value: 'hospital', label: 'Bệnh viện' },
      { value: 'gus', label: 'Chòi gác của Gus ("Gus\'s")' },
      { value: 'gianna', label: 'Quán Ý của Gianna' },
    ],
  },
];

const FARE: NoteEntry[] = [
  {
    key: 'count',
    label: 'Mấy khách',
    line: id('b02'),
    answer: 'two',
    options: [
      { value: 'two', label: 'Hai người' },
      { value: 'one', label: 'Một người ("to")' },
      { value: 'oclock', label: 'Một cuốc lúc hai giờ' },
    ],
  },
  {
    key: 'who',
    label: 'Khách là ai',
    line: id('b03'),
    answer: 'nurses',
    options: [
      { value: 'nurses', label: 'Y tá' },
      { value: 'nurse', label: 'Một y tá' },
      { value: 'purses', label: 'Người bán ví' },
    ],
  },
];

export const JOB_CHIP: JobDoc = {
  id: 'job-chip',
  title: 'Chip là ga',
  blurb: 'Bayline nghe lén bộ đàm. Max và Jun đổi bộ đàm, đặt mật mã bằng chuyện dưới thị trấn mà trên này không ai biết.',
  level: 2,
  order: 4,
  opens: ['ct-rico-1'],
  after: 'job-half5',
  from: 'rico',
  lines: LINES,
  facts: [
    { id: 'channel', label: 'Kênh mới', line: id('a03'), consequence: 'lostFare' },
    { id: 'chip', label: '"Chip" là', line: id('a05'), consequence: 'wrongPlace', byAction: true },
    { id: 'graces', label: '"Grace\'s" là', line: id('a06'), consequence: 'wrongStop', byAction: true },
    { id: 'count', label: 'Mấy khách', line: id('b02'), consequence: 'leftBehind' },
    { id: 'who', label: 'Khách là ai', line: id('b03'), consequence: 'wrongPerson', byAction: true },
  ],
  consequences: {
    lostFare: { name: 'Ghi nhầm kênh: không nghe thấy Rico, một cuốc sang tay Bayline', rejoin: 'Rico gọi điện thoại, bạn chuyển kênh và nhận cuốc sau.' },
    wrongPlace: { name: 'Tới nhầm chỗ "Chip"', rejoin: 'Người ở đó chỉ ga; hai cô y tá chờ lâu hơn.' },
    wrongPerson: { name: 'Hỏi nhầm người ở ga', rejoin: 'Người bị hỏi chỉ hai cô y tá.' },
    leftBehind: { name: 'Ghi "to" thay vì "two": bỏ lại người khách thứ hai', rejoin: 'Nell gọi Rico, Rico tự quay xe đón cô.' },
    wrongStop: { name: 'Chở khách tới nhầm "Grace\'s"', rejoin: 'Bridget đi bộ lên bệnh viện; muộn hơn một chút.' },
    noticed: { name: 'Tài xế Bayline thấy bạn nghe lén', rejoin: 'Hắn kéo kính lên; bạn đã nghe đủ để biết mật mã giữ được.' },
  },
  steps: [
    // beat 1: Max on the new set
    { kind: 'notebook', via: 'radio', call: ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08'].map(id), entries: CODE, repeat: { channel: [id('a03r')], chip: [id('a05r')], graces: [id('a06r')] }, patience: { after: 3, line: id('a09') } },
    // the wrong channel: Rico could not get through, a fare lost
    { kind: 'phone', lines: [id('l01'), id('l02')], if: { note: 'channel', is: 'wrong' } },
    // beat 2: the fare in code
    { kind: 'notebook', via: 'radio', call: ['b01', 'b02', 'b03'].map(id), entries: FARE, repeat: { count: [id('b02r')], who: [id('b03r')] }, patience: { after: 2, line: id('b04') } },
    {
      kind: 'pickup',
      entry: 'chip',
      places: { station: 'okafor', ferry: 'odile', jun: 'jun' },
      place: 'okafor',
      wrongPlace: { lines: [{ line: id('w-ferry'), if: { note: 'chip', value: 'ferry' } }, { line: id('w-jun'), if: { note: 'chip', value: 'jun' } }], consequence: 'wrongPlace' },
      arrive: [id('p01')],
      crowd: ['okafor', 'pete', 'nell', 'tess'],
      passenger: 'bridget',
      ask: [{ line: id('q-two'), if: { note: 'count', value: 'two' } }, { line: id('q-one'), if: { note: 'count', value: 'one' } }, { line: id('q-two-oclock'), if: { note: 'count', value: 'oclock' } }],
      notMe: { okafor: [id('x-okafor')], pete: [id('x-pete')], nell: [id('x-nell')], tess: [id('x-tess')] },
      callOut: { after: 2, line: id('p02') },
      wrongPerson: 'wrongPerson',
      greet: [{ line: id('g01'), if: { not: COUNT_WRONG } }, { line: id('g02'), if: { note: 'count', value: 'one' } }, { line: id('g03'), if: { note: 'count', value: 'oclock' } }],
    },
    {
      kind: 'ride',
      entry: 'graces',
      places: { hospital: 'osei', gus: 'gus', gianna: 'gianna' },
      place: 'osei',
      talk: [id('t01'), id('t02'), { line: id('t03'), if: { note: 'count', value: 'two' } }],
      arrive: { hospital: [id('r-right')], gus: [id('r-gus'), id('r-walk')], gianna: [id('r-gianna'), id('r-walk')] },
      wrongStop: 'wrongStop',
    },
    { kind: 'phone', lines: [id('n01'), id('n02')], if: COUNT_WRONG },
    // beat 3: a Bayline car by Gus's hut, its radio on loud
    { kind: 'overhear', at: 'gus', who: ['driver'], lines: ['o01', 'o02', 'o03', 'o06', 'o04', 'o05'].map(id), passes: 2, noticed: { line: id('o-seen'), consequence: 'noticed' }, word: id('o05') },
  ],
  ending: {
    clean: [id('e1'), id('e2'), id('e7')],
    messy: [id('e3'), id('e4')],
    broken: [id('e5'), id('e6')],
  },
  news: { clean: [id('n1'), id('n2')], messy: [id('n2')], broken: [id('n3'), id('n2')] },
};
