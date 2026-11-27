// Act II, job 3b: "Hộp há cảo" (docs/gta-story-2.md §6, written there line by line; Mei's chain). Every night at nine
// Kemp has six pork dumplings from Mei's stall at warehouse fifteen. Tonight Mei takes them herself and keeps him
// talking at the door; the learner, across the road, hears Shona say when the movers come and which door. Who comes
// along decides how the learner hears what goes on behind Kemp:
//   Max  his coin recorder under the lid; the next evening, the tape, heard back as often as wanted (the floor price,
//        which box the talkback tapes are in);
//   Jun  Kemp's old cordless phone, on open air, heard through the hiss in the van on Quay Street (the floor price, the
//        day the board meets);
//   Gus  Bayline's open night channel from his hut, and the patrol to keep out of sight of (the watchman's hours, what
//        he is to guard).
// Going alone: the door only.
//
// As written, against the bible (docs/gta-story-2.md §11 "As written"):
//   - warehouse fifteen's front door is the job spot 'w15-front' (data/city/jobs/spots.ts);
//   - Max's tape is a notebook `via: 'tape'` (the hideout if owned, else Jun's stall); the bible's line for a learner
//     without a hideout (m03b) is dropped: the engine picks the place;
//   - Jun's hiss: the two lines with "..." are `broken` (said in pieces, a silence at each "...");
//   - the patrol is a `patrol` step on Quay Street while the learner gets from the warehouse door to Gus's hut;
//   - the end's "what did my dumplings buy us" is said by the learner as written (by the notes), not picked.
// Max is of the town ('phone'): his lines are clips (connected only), the browser voice until the owner makes them.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-dumplings-${key}`;

const LINES = [
  // ── beat 1: Mei's stall ──
  { id: id('01'), who: 'mei', text: "Every night at nine, six pork to warehouse fifteen. He's a creature of habit.", vi: 'Tối nào chín giờ cũng sáu cái nhân thịt tới kho mười lăm. Hắn sống theo nếp lắm.' },
  { id: id('02'), who: 'rico', text: 'So tonight you take them yourself, and keep him talking at the door.', vi: 'Vậy tối nay bà tự mang tới, rồi giữ hắn nói chuyện ở cửa.' },
  { id: id('03'), who: 'mei', text: "I've kept worse men talking, dear. I sell dumplings to you.", vi: 'Bà từng giữ những gã tệ hơn nói chuyện rồi, cháu ạ. Bà bán há cảo cho cháu mà.' },
  { id: id('04'), who: 'rico', text: 'Fair. But somebody has to listen to what goes on behind him.', vi: 'Cũng phải. Nhưng phải có người nghe chuyện diễn ra sau lưng hắn.' },
  { id: id('05'), who: 'mei', text: "So. Who's coming with me tonight? Choose quickly. The steam won't wait.", vi: 'Sao. Tối nay ai đi với bà? Chọn nhanh lên. Hơi nước không chờ đâu.' },
  { id: id('06m'), who: 'phone', text: 'Easy. My coin recorder goes under the lid. Twelve hours of whatever he says.', vi: 'Dễ. Cái máy ghi âm bằng đồng xu của tôi nằm dưới nắp hộp. Mười hai tiếng, hắn nói gì cũng vào hết.' },
  { id: id('07m'), who: 'phone', text: 'Mei fetches the empty box tomorrow, and we listen back at your place.', vi: 'Mai bà Mei đi lấy cái hộp rỗng về, rồi mình nghe lại ở chỗ bạn.' },
  { id: id('06j'), who: 'jun', text: "His office phone's a cordless. An old one. It shouts to anybody with the right set.", vi: 'Điện thoại văn phòng hắn là loại không dây. Đời cũ. Ai có máy đúng là nghe được.' },
  { id: id('07j'), who: 'jun', text: "I'll sit in the van on Quay Street. Sit with me, and listen through the hiss.", vi: 'Tôi ngồi trong xe trên Quay Street. Ngồi với tôi, nghe xuyên qua tiếng rè.' },
  { id: id('08j'), who: 'mei', text: "Listening to his phone? Jun, that's exactly what he does to us.", vi: 'Nghe điện thoại của hắn? Jun, đó đúng là việc hắn làm với mình.' },
  { id: id('09j'), who: 'jun', text: "It's on open air, Mei. Like his scanners. Just this once, for the station.", vi: 'Nó phát ra không khí mà, bà Mei. Như máy quét của hắn. Chỉ lần này thôi, vì cái đài.' },
  { id: id('06g'), who: 'gus', text: "His night man talks to Shona on Bayline's open channel. Every night, like clockwork.", vi: 'Tay gác đêm của hắn nói chuyện với Shona trên kênh mở của Bayline. Đêm nào cũng vậy, đều như đồng hồ.' },
  { id: id('07g'), who: 'gus', text: 'Sit in my hut with me and listen. And mind the patrol. They pass at ten.', vi: 'Ngồi trong chòi với tôi mà nghe. Và coi chừng xe tuần tra. Mười giờ họ đi ngang.' },
  { id: id('06a'), who: 'mei', text: "Just you and me, then. You watch the door, I'll do the talking.", vi: 'Vậy chỉ bà với cháu. Cháu canh cửa, bà lo phần nói.' },
  // ── beat 2 ──
  { id: id('10'), who: 'mei', text: 'Walk behind me, dear. Old ladies with dumplings are invisible. Nobody looks twice.', vi: 'Đi sau bà, cháu. Bà già bưng há cảo thì vô hình. Chẳng ai nhìn tới lần hai.' },
  // ── beat 3a: at the warehouse door ──
  { id: id('11'), who: 'mei', text: "Six pork, Mr Kemp. Pork's better. You said so yourself, if you remember.", vi: 'Sáu cái nhân thịt, ông Kemp. Thịt ngon hơn. Chính ông nói thế, nếu ông còn nhớ.' },
  { id: id('12'), who: 'kemp', text: "I remember everything, Mrs Mei. It's a terrible habit.", vi: 'Tôi nhớ mọi thứ, bà Mei. Một thói quen kinh khủng.' },
  { id: id('13'), who: 'mei', text: 'So I hear. All those shelves in there, full of remembering.', vi: 'Bà cũng nghe nói vậy. Bao nhiêu cái kệ trong đó, đầy những thứ được nhớ.' },
  { id: id('14'), who: 'kemp', text: 'Empty shelves, Mrs Mei. A warehouse full of nothing much.', vi: 'Kệ trống thôi, bà Mei. Một cái kho chẳng có gì mấy.' },
  { id: id('15'), who: 'shona', text: 'Duncan, the movers want to know. Is it still Friday, half six in the morning?', vi: 'Duncan, bên chuyển đồ hỏi. Vẫn là thứ Sáu, sáu rưỡi sáng chứ?' },
  { id: id('16'), who: 'kemp', text: 'Shona. Not now, please.', vi: 'Shona. Không phải lúc này.' },
  { id: id('17'), who: 'mei', text: "Half seven, did she say? I'm up at five. I could bring breakfast.", vi: 'Cô ấy nói bảy rưỡi à? Bà dậy từ năm giờ. Bà mang bữa sáng tới được đấy.' },
  { id: id('18'), who: 'kemp', text: 'Half six. And no breakfast, thank you. Goodnight, Mrs Mei.', vi: 'Sáu rưỡi. Và không cần bữa sáng, cảm ơn bà. Chúc bà ngủ ngon.' },
  { id: id('19'), who: 'shona', text: "And tell them the back door, not the front. The front's the black one.", vi: 'Và bảo họ vào cửa sau, không phải cửa trước. Cửa trước là cái cửa đen.' },
  { id: id('20'), who: 'kemp', text: "It's warehouse fifteen, by the way, Mrs Mei. Not fifty. People do get that wrong.", vi: 'Mà là kho mười lăm nhé, bà Mei. Không phải năm mươi. Người ta hay nhầm lắm.' },
  { id: id('21'), who: 'mei', text: 'Rude. He took the box and forgot to pay.', vi: 'Vô duyên. Hắn cầm hộp rồi quên trả tiền.' },
  { id: id('15r'), who: 'shona', text: 'Friday. Half six. In the morning.', vi: 'Thứ Sáu. Sáu rưỡi. Buổi sáng.' },
  { id: id('19r'), who: 'shona', text: 'The back door. The back.', vi: 'Cửa sau. Cửa sau.' },
  { id: id('22'), who: 'mei', text: "They won't say it twice for us, dear. Not this lot.", vi: 'Bọn này không nói hai lần cho mình đâu, cháu.' },
  // ── beat 3b, with Max: the tape, the next evening ──
  { id: id('m01'), who: 'mei', text: "Empty box. I think he licked the lid. Your coin's still in there.", vi: 'Hộp rỗng. Chắc hắn liếm cả nắp. Đồng xu của cậu vẫn còn trong đó.' },
  { id: id('m02'), who: 'phone', text: "Twelve hours on it. Let's hear what Mr Empty Shelves had to say.", vi: 'Mười hai tiếng trong đó. Nghe xem ông Kệ Trống nói gì nào.' },
  { id: id('m03'), who: 'phone', text: "Rewind as much as you like. That's the beauty of a tape.", vi: 'Tua lại bao nhiêu tùy bạn. Băng hay ở chỗ đó.' },
  { id: id('t01'), who: 'kemp', text: 'Ashby rang. Head office will take anything over forty thousand.', vi: 'Ashby gọi. Công ty sẽ bán với bất cứ giá nào trên bốn mươi nghìn.' },
  { id: id('t02'), who: 'shona', text: 'And the talkback tapes? The ones where he actually says it?', vi: 'Còn mấy cuộn băng talkback? Mấy cuộn mà ông ta nói ra con số ấy?' },
  { id: id('t03'), who: 'kemp', text: "Box M, under the stairs. M for Marcus. He'd appreciate that.", vi: 'Thùng M, dưới cầu thang. M là Marcus. Anh ta sẽ thích lắm.' },
  { id: id('t04'), who: 'shona', text: "Shouldn't we just burn them, then?", vi: 'Thế sao không đốt luôn đi?' },
  { id: id('t05'), who: 'kemp', text: "Burn twenty years of this city talking? They're worth more than the station.", vi: 'Đốt hai mươi năm thành phố này nói chuyện? Chúng đáng giá hơn cả cái đài.' },
  { id: id('t06'), who: 'shona', text: 'And the dumpling lady? She was looking at the shelves.', vi: 'Còn bà bán há cảo? Bà ta cứ nhìn mấy cái kệ.' },
  { id: id('t07'), who: 'kemp', text: "Mrs Mei looks at everything. That's why she gets a smile and her money.", vi: 'Bà Mei nhìn mọi thứ. Thế nên bà ta được một nụ cười và tiền của mình.' },
  { id: id('m04'), who: 'phone', text: "Same twelve seconds, mate. I'll put the kettle on.", vi: 'Vẫn mười hai giây đó thôi bạn. Để tôi đun ấm nước.' },
  // ── beat 3b, with Jun: through the hiss, that night ──
  { id: id('j01'), who: 'jun', text: "Got him. It's crackly. Headphones on, and please don't touch the dial.", vi: 'Bắt được rồi. Rè lắm. Đeo tai nghe vào, và làm ơn đừng chạm vào núm.' },
  { id: id('j02'), who: 'kemp', text: "Mr Ashby. Yes, I know the time. Your floor's still... forty thousand?", broken: true, vi: 'Ông Ashby. Vâng, tôi biết mấy giờ rồi. Giá sàn của ông vẫn là... bốn mươi nghìn chứ?' },
  { id: id('j03'), who: 'ashby', text: "Forty, Duncan. And you didn't hear that from me.", vi: 'Bốn mươi, Duncan. Và anh không nghe điều đó từ tôi.' },
  { id: id('j04'), who: 'kemp', text: 'I never hear anything from anyone. Ask the Harbour Trust.', vi: 'Tôi có bao giờ nghe gì từ ai đâu. Cứ hỏi Ban quản lý cảng.' },
  { id: id('j05'), who: 'ashby', text: 'Very funny. The board meets on the... thirteenth. Bring a pen.', broken: true, vi: 'Buồn cười lắm. Hội đồng họp vào ngày... mười ba. Mang theo bút.' },
  { id: id('j06'), who: 'kemp', text: "I'll bring two. Goodnight, Mr Ashby.", vi: 'Tôi mang hai cây. Chào ông Ashby.' },
  { id: id('j07'), who: 'jun', text: 'Did you get the date? I lost half of it in the hiss.', vi: 'Bạn bắt được ngày không? Tôi mất nửa câu trong tiếng rè.' },
  { id: id('j08'), who: 'jun', text: "It's a recording now. Play it again, but we're leaving soon.", vi: 'Giờ nó là bản ghi rồi. Mở lại đi, nhưng mình sắp phải đi.' },
  // ── beat 3b, with Gus: the night channel, and the patrol ──
  { id: id('g01'), who: 'driver', text: "Night desk, it's the warehouse. Fifteen's locked. I'm on from ten till two.", vi: 'Tổng đài đêm, kho đây. Mười lăm khóa rồi. Tôi trực từ mười giờ tới hai giờ.' },
  { id: id('g02'), who: 'shona', text: 'Fine. And Thursday night, leave the back door open for the movers.', vi: 'Được. Và đêm thứ Năm, để cửa sau mở cho bên chuyển đồ.' },
  { id: id('g03'), who: 'driver', text: 'The back door. Got it. Anything else?', vi: 'Cửa sau. Rõ. Còn gì nữa không?' },
  { id: id('g04'), who: 'shona', text: 'Keep everybody away from the stairs. Not Gus, not the dumpling woman. Nobody.', vi: 'Không cho ai lại gần cầu thang. Gus cũng không, bà bán há cảo cũng không. Không ai hết.' },
  { id: id('g05'), who: 'gus', text: "The stairs. Twenty years I've watched that place. Never seen anyone guard stairs.", vi: 'Cầu thang. Hai mươi năm tôi canh chỗ đó. Chưa thấy ai canh cầu thang bao giờ.' },
  { id: id('g06'), who: 'scanner-desk', text: 'Unit twelve, routine patrol, Quay Street, heading west.', vi: 'Đơn vị mười hai, tuần tra thường lệ, Quay Street, đi về hướng tây.' },
  { id: id('g07'), who: 'gus', text: "That's them. Inside, quick, or you're the one they're describing.", vi: 'Họ đấy. Vào trong, nhanh, kẻo bạn thành người bị tả trên bộ đàm.' },
  { id: id('g08'), who: 'scanner-unit', text: 'Dispatch, someone loitering by the warehouses. Probably nothing. Moving on.', vi: 'Tổng đài, có người lảng vảng gần dãy kho. Chắc không có gì. Đi tiếp.' },
  { id: id('g09'), who: 'gus', text: "They don't repeat themselves on that channel. Not for anyone.", vi: 'Trên kênh đó họ không nhắc lại đâu. Không vì ai cả.' },
  // ── beat 4: back at Mei's ──
  { id: id('k01'), who: 'mei', text: 'Well? What did my dumplings buy us tonight?', vi: 'Sao? Tối nay mấy cái há cảo của bà mua được gì?' },
  { id: id('k02a'), who: 'player', text: 'The movers come Friday, half six in the morning.', vi: 'Bên chuyển đồ tới thứ Sáu, sáu rưỡi sáng.' },
  { id: id('k04b'), who: 'player', text: "And they'll use the back door, not the front.", vi: 'Và họ vào cửa sau, không phải cửa trước.' },
  { id: id('k02b'), who: 'player', text: 'The movers come Friday, half seven.', vi: 'Bên chuyển đồ tới thứ Sáu, bảy rưỡi.' },
  { id: id('k03b'), who: 'mei', text: "Half seven was me, dear. I said it to see if he'd correct me. He did.", vi: 'Bảy rưỡi là bà nói đấy cháu. Bà nói để xem hắn có sửa không. Hắn sửa.' },
  { id: id('k02c'), who: 'player', text: 'The movers come Friday, at half past five.', vi: 'Bên chuyển đồ tới thứ Sáu, năm rưỡi.' },
  { id: id('k03c'), who: 'mei', text: 'Half six is half past six, dear. Not half to.', vi: 'Half six là sáu giờ rưỡi, cháu ạ. Không phải năm rưỡi.' },
  { id: id('k04'), who: 'player', text: "And they'll use the black door at the front.", vi: 'Và họ sẽ vào cửa đen phía trước.' },
  { id: id('k05'), who: 'mei', text: 'The back, dear. Back. The black one is where he stood.', vi: 'Cửa sau, cháu. Cửa sau. Cái cửa đen là chỗ hắn đứng.' },
  { id: id('k04s'), who: 'player', text: 'And they want the side door, I think.', vi: 'Và chắc họ muốn vào cửa hông.' },
  { id: id('k05s'), who: 'mei', text: 'The back door, dear. Nobody said a word about a side.', vi: 'Cửa sau, cháu. Chẳng ai nói chữ nào về cửa hông.' },
  { id: id('k06m'), who: 'phone', text: "Box M, under the stairs. I reckon that's worth a battery.", vi: 'Thùng M, dưới cầu thang. Tôi nghĩ đáng giá một cục pin đấy.' },
  { id: id('k06j'), who: 'jun', text: "Forty thousand, and the thirteenth. We've got a number and a clock.", vi: 'Bốn mươi nghìn, và ngày mười ba. Mình có một con số và một cái đồng hồ.' },
  { id: id('k06g'), who: 'gus', text: "Ten till two, and the stairs. I'll count the steps for you.", vi: 'Mười giờ tới hai giờ, và cầu thang. Tôi sẽ đếm từng bậc cho bạn.' },
  { id: id('k06a'), who: 'mei', text: 'Just the door tonight. Next time we bring somebody to listen behind him.', vi: 'Tối nay chỉ được cái cửa. Lần sau mình rủ người nghe sau lưng hắn.' },
  // what the notes got wrong, said by whoever came
  { id: id('x01'), who: 'phone', text: "Forty, mate. Four, oh. Not fourteen. Listen to the tape again.", vi: 'Bốn mươi, bạn ơi. Bốn, không. Không phải mười bốn. Nghe lại băng đi.' },
  { id: id('x02'), who: 'phone', text: "M, not N. And the stairs, not the stores. I heard him twice.", vi: 'M, không phải N. Và cầu thang, không phải kho chứa. Tôi nghe hắn hai lần rồi.' },
  { id: id('x03'), who: 'jun', text: "Forty thousand. The hiss ate the start, but it was forty.", vi: 'Bốn mươi nghìn. Tiếng rè nuốt mất phần đầu, nhưng là bốn mươi.' },
  { id: id('x04'), who: 'jun', text: "The thirteenth. Thir-teenth. Delaney will need that date exactly.", vi: 'Ngày mười ba. Mười-ba. Bà Delaney sẽ cần đúng ngày đó.' },
  { id: id('x05'), who: 'gus', text: 'From ten till two, he said. Not ten to two. Four hours.', vi: 'Từ mười giờ tới hai giờ, hắn nói thế. Không phải hai giờ kém mười. Bốn tiếng.' },
  { id: id('x06'), who: 'gus', text: 'The stairs. Stairs. Nobody guards a store cupboard.', vi: 'Cầu thang. Cầu thang. Chẳng ai đi canh một cái kho chứa.' },
  // the last word, by grade
  { id: id('e1'), who: 'mei', text: "Six dumplings, and he never knew. That's the best sale I've made all year.", vi: 'Sáu cái há cảo, mà hắn chẳng hay biết gì. Vụ bán hời nhất năm nay của bà.' },
  { id: id('e2'), who: 'mei', text: 'We got most of it. Next time, write down who said what.', vi: 'Được gần hết. Lần sau ghi lại ai nói cái gì nhé.' },
  { id: id('e3'), who: 'mei', text: "He knows something's up. Tomorrow I'll give him seven, to confuse him.", vi: 'Hắn biết có chuyện rồi. Mai bà cho hắn bảy cái, cho hắn rối.' },
  // Bay FM, by how it ended
  { id: id('f1'), who: 'kit', text: 'A quiet night on the harbour. Only the dumpling stall was busy.', vi: 'Một đêm yên ả ở cảng. Chỉ có sạp há cảo là đông.' },
  { id: id('f2'), who: 'kit', text: 'Reports of somebody hanging about the warehouses tonight. Probably nothing.', vi: 'Có tin ai đó lảng vảng quanh dãy kho tối nay. Chắc không có gì.' },
  { id: id('f3'), who: 'kit', text: "A van has been booked for the harbour on Friday morning. Somebody's moving out.", vi: 'Có một chiếc xe được đặt tới cảng sáng thứ Sáu. Có người sắp dọn đi.' },
];

const DOOR: NoteEntry[] = [
  {
    key: 'van',
    label: 'Xe dọn kho tới lúc nào',
    line: id('15'),
    answer: 'fri630',
    options: [
      { value: 'fri630', label: 'Thứ Sáu, 6:30 sáng' },
      { value: 'fri730', label: 'Thứ Sáu, 7:30 sáng' },
      { value: 'fri530', label: 'Thứ Sáu, 5:30 sáng' },
    ],
  },
  {
    key: 'door',
    label: 'Xe vào cửa nào',
    line: id('19'),
    answer: 'back',
    options: [
      { value: 'back', label: 'Cửa sau' },
      { value: 'black', label: 'Cửa đen (cửa trước)' },
      { value: 'side', label: 'Cửa hông' },
    ],
  },
];

const TAPE: NoteEntry[] = [
  {
    key: 'floor',
    label: 'Giá sàn của công ty',
    line: id('t01'),
    answer: '40k',
    options: [
      { value: '40k', label: '40.000' },
      { value: '14k', label: '14.000' },
      { value: '4k', label: '4.000' },
    ],
  },
  {
    key: 'box',
    label: 'Băng talkback ở thùng nào',
    line: id('t03'),
    answer: 'm-stairs',
    options: [
      { value: 'm-stairs', label: 'Thùng M, dưới cầu thang' },
      { value: 'n-stairs', label: 'Thùng N, dưới cầu thang' },
      { value: 'm-stores', label: 'Thùng M, trong kho chứa' },
    ],
  },
];

const HISS: NoteEntry[] = [
  {
    key: 'floorJ',
    label: 'Giá sàn của công ty',
    line: id('j02'),
    answer: '40k',
    options: [
      { value: '40k', label: '40.000' },
      { value: '14k', label: '14.000' },
      { value: '4k', label: '4.000' },
    ],
  },
  {
    key: 'date',
    label: 'Hội đồng họp ngày nào',
    line: id('j05'),
    answer: '13',
    options: [
      { value: '13', label: 'Ngày 13' },
      { value: '30', label: 'Ngày 30' },
      { value: '3', label: 'Ngày 3' },
    ],
  },
];

const NIGHT: NoteEntry[] = [
  {
    key: 'shift',
    label: 'Người gác trực mấy giờ',
    line: id('g01'),
    answer: '10-2',
    options: [
      { value: '10-2', label: 'Từ 10 giờ tới 2 giờ' },
      { value: '1-50', label: 'Tới 1:50 ("ten to two")' },
      { value: '10-12', label: 'Từ 10 giờ tới 12 giờ' },
    ],
  },
  {
    key: 'guard',
    label: 'Không cho ai lại gần chỗ nào',
    line: id('g04'),
    answer: 'stairs',
    options: [
      { value: 'stairs', label: 'Cầu thang' },
      { value: 'stores', label: 'Kho chứa' },
      { value: 'stage', label: 'Sân khấu' },
    ],
  },
];

const VAN = (v: string) => ({ note: 'van', value: v });
const DOOR_IS = (v: string) => ({ note: 'door', value: v });

export const JOB_DUMPLINGS: JobDoc = {
  id: 'job-dumplings',
  title: 'Hộp há cảo',
  blurb: 'Tối nào Kemp cũng gọi sáu cái há cảo tới kho mười lăm. Tối nay bà Mei tự mang tới, và giữ hắn nói chuyện ở cửa.',
  level: 3,
  order: 14,
  opens: ['ct-rico-1'],
  after: 'job-second',
  from: 'mei',
  crew: {
    roles: [
      { who: 'phone', role: 'Máy ghi âm', listen: 'Max gài máy ghi âm dưới nắp hộp. Tối hôm sau bạn nghe lại cuộn băng ở chỗ ẩn (chưa có thì ở sạp Jun), tua bao nhiêu lần cũng được.', opens: { hearts: 4 }, cut: CREW_CUT.friend, with: 'ride' },
      { who: 'jun', role: 'Thợ bộ đàm', listen: 'Jun bắt điện thoại không dây của Kemp trong xe trên Quay Street: nghe qua tiếng rè, có chữ bị mất.', opens: { heard: ['ct-jun-3'] }, cut: CREW_CUT.share, with: { at: 'jun' } },
      { who: 'gus', role: 'Người gác cảng', listen: 'Gus mở kênh đêm của Bayline trong chòi: nghe tay gác kho nói chuyện, và tự né xe tuần tra.', opens: { heard: ['ct-gus-2'] }, cut: CREW_CUT.share, with: { at: 'gus' } },
    ],
  },
  lines: LINES,
  facts: [
    { id: 'van', label: 'Xe dọn kho tới lúc nào', line: id('15'), consequence: 'van' },
    { id: 'door', label: 'Xe vào cửa nào', line: id('19'), consequence: 'door' },
    { id: 'floor', label: 'Giá sàn (băng của Max)', line: id('t01'), consequence: 'floor' },
    { id: 'box', label: 'Thùng nào', line: id('t03'), consequence: 'box' },
    { id: 'floorJ', label: 'Giá sàn (qua tiếng rè)', line: id('j02'), consequence: 'floor' },
    { id: 'date', label: 'Ngày họp hội đồng', line: id('j05'), consequence: 'date' },
    { id: 'shift', label: 'Ca của người gác', line: id('g01'), consequence: 'shift' },
    { id: 'guard', label: 'Chỗ được canh', line: id('g04'), consequence: 'guard' },
  ],
  consequences: {
    van: { name: 'Ghi sai giờ xe dọn kho', rejoin: 'Bà Mei sửa lại; giờ đúng nằm trong xem lại.' },
    door: { name: 'Ghi sai cửa xe chuyển đồ vào', rejoin: 'Bà Mei sửa: cửa sau.' },
    floor: { name: 'Ghi sai giá sàn', rejoin: 'Người đi cùng nói lại đúng bốn mươi nghìn.' },
    box: { name: 'Ghi sai thùng băng', rejoin: 'Max nói lại: thùng M, dưới cầu thang.' },
    date: { name: 'Ghi sai ngày họp hội đồng', rejoin: 'Jun nói lại: ngày mười ba.' },
    shift: { name: 'Ghi sai ca của người gác', rejoin: 'Gus nói lại: từ mười giờ tới hai giờ.' },
    guard: { name: 'Ghi sai chỗ được canh', rejoin: 'Gus nói lại: cầu thang.' },
    seen: { name: 'Không vào chòi kịp: xe tuần tra thấy bạn lảng vảng', rejoin: 'Xe đi tiếp, chẳng ai hỏi gì.' },
  },
  steps: [
    // beat 1: Mei's stall; whoever came says how they will listen
    { kind: 'goto', place: 'mei', label: 'Tới sạp há cảo của bà Mei' },
    { kind: 'scene', at: 'mei', who: ['mei', 'rico'], lines: ['01', '02', '03', '04', '05'].map(id) },
    { kind: 'scene', at: 'mei', who: ['mei'], lines: [id('06m'), id('07m')], if: { crew: 'phone' } },
    { kind: 'scene', at: 'mei', who: ['mei', 'jun'], lines: ['06j', '07j', '08j', '09j'].map(id), if: { crew: 'jun' } },
    { kind: 'scene', at: 'mei', who: ['mei', 'gus'], lines: [id('06g'), id('07g')], if: { crew: 'gus' } },
    { kind: 'scene', at: 'mei', who: ['mei'], lines: [id('06a')], if: { all: [{ not: { crew: 'phone' } }, { not: { crew: 'jun' } }, { not: { crew: 'gus' } }] } },
    // beat 2: to the warehouse door
    { kind: 'goto', place: 'w15-front', label: 'Đi sau bà Mei tới cửa kho mười lăm' },
    { kind: 'scene', at: 'w15-front', who: ['mei'], lines: [id('10')] },
    // beat 3a: the door, said once
    { kind: 'scene', at: 'w15-front', who: ['mei', 'kemp', 'shona'], lines: [] },
    {
      kind: 'notebook',
      via: 'scene',
      call: ['11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'].map(id),
      entries: DOOR,
      repeat: { van: [id('15r')], door: [id('19r')] },
      patience: { after: 2, line: id('22') },
    },
    // beat 3b with Max: the tape, the next evening (the engine walks to the hideout, or Jun's stall)
    { kind: 'scene', at: 'mei', who: ['mei'], lines: [id('m01'), id('m02')], if: { crew: 'phone' } },
    { kind: 'notebook', via: 'tape', call: ['m03', 't01', 't02', 't03', 't04', 't05', 't06', 't07'].map(id), entries: TAPE, patience: { after: 3, line: id('m04') }, if: { crew: 'phone' } },
    { kind: 'scene', lines: [{ line: id('x01'), if: { note: 'floor', is: 'wrong' } }, { line: id('x02'), if: { note: 'box', is: 'wrong' } }], if: { crew: 'phone' } },
    // beat 3b with Jun: the van on Quay Street, through the hiss (two lines broken up)
    { kind: 'goto', place: 'jun', label: 'Tới xe của Jun đậu trên Quay Street', if: { crew: 'jun' } },
    { kind: 'scene', at: 'jun', who: ['jun'], lines: [id('j01')], park: [{ at: 'jun', look: 1 }], if: { crew: 'jun' } },
    { kind: 'notebook', via: 'radio', call: ['j02', 'j03', 'j04', 'j05', 'j06', 'j07'].map(id), entries: HISS, patience: { after: 2, line: id('j08') }, if: { crew: 'jun' } },
    { kind: 'scene', at: 'jun', who: ['jun'], lines: [{ line: id('x03'), if: { note: 'floorJ', is: 'wrong' } }, { line: id('x04'), if: { note: 'date', is: 'wrong' } }], if: { crew: 'jun' } },
    // beat 3b with Gus: the scanner says the patrol (g06), Gus answers it (g07, "That's them"), then the patrol drives
    // Quay Street while the learner gets to his hut, then the night channel
    { kind: 'scanner', lines: [id('g06')], if: { crew: 'gus' } },
    { kind: 'radio', lines: [id('g07')], if: { crew: 'gus' } },
    { kind: 'patrol', street: 'Quay Street', seconds: 15, seen: { consequence: 'seen', lines: [id('g08')] }, if: { crew: 'gus' } },
    { kind: 'goto', place: 'gus', label: 'Vào chòi gác của Gus', if: { crew: 'gus' } },
    { kind: 'notebook', via: 'radio', call: ['g01', 'g02', 'g03', 'g04', 'g05'].map(id), entries: NIGHT, patience: { after: 2, line: id('g09') }, if: { crew: 'gus' } },
    { kind: 'scene', at: 'gus', who: ['gus'], lines: [{ line: id('x05'), if: { note: 'shift', is: 'wrong' } }, { line: id('x06'), if: { note: 'guard', is: 'wrong' } }], if: { crew: 'gus' } },
    // beat 4: back at Mei's; the learner says what they wrote
    { kind: 'goto', place: 'mei', label: 'Quay về sạp bà Mei' },
    {
      kind: 'scene',
      at: 'mei',
      who: ['mei'],
      lines: [
        id('k01'),
        { line: id('k02a'), if: VAN('fri630') },
        { line: id('k02b'), if: VAN('fri730') },
        { line: id('k03b'), if: VAN('fri730') },
        { line: id('k02c'), if: VAN('fri530') },
        { line: id('k03c'), if: VAN('fri530') },
        { line: id('k04b'), if: DOOR_IS('back') },
        { line: id('k04'), if: DOOR_IS('black') },
        { line: id('k05'), if: DOOR_IS('black') },
        { line: id('k04s'), if: DOOR_IS('side') },
        { line: id('k05s'), if: DOOR_IS('side') },
        { line: id('k06m'), if: { crew: 'phone' } },
        { line: id('k06j'), if: { crew: 'jun' } },
        { line: id('k06g'), if: { crew: 'gus' } },
        { line: id('k06a'), if: { all: [{ not: { crew: 'phone' } }, { not: { crew: 'jun' } }, { not: { crew: 'gus' } }] } },
      ],
    },
  ],
  ending: { clean: [id('e1')], messy: [id('e2')], broken: [id('e3')] },
  news: { clean: [id('f1')], messy: [id('f2')], broken: [id('f3')] },
};
