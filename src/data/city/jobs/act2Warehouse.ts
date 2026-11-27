// Act II, job 10: "Kho 15" ("Warehouse fifteen", docs/gta-story-2.md §4 job 10; the act's big job, after all four
// chains). Mrs Delaney has one hour of a lawful safety inspection of warehouse fifteen (Bayline leases it from the
// Harbour Trust): nothing leaves but what she writes in her report. Inside, among reels with their labels taken off,
// the learner has to find the talkback reel by ear and the line where the floor price is said, while Shona works the
// door and the radio fills with a boat, a police report and, at last, a false call to "warehouse fifty".
//
// As built, against the bible:
//   - it opens once job 1 and all four b-jobs are done (`after` + `afterAll`); Mrs Delaney briefs the learner at the
//     gatehouse (Gus's hut, as in Act I); she takes the learner as her assistant again after "Ba kênh"
//     (`past: 'job-channels:witness'`), and says "this time you catch it" after the hearing (`job-hearing:hit:missedIt`);
//   - warehouse fifteen is real (step `enter`, in at its black front door through the dark; `leave` at the end). A
//     "fifty" noted goes to the far end of the row ('row-end'), a "fourteen" to fourteen's door ('w14-front'); Gus
//     rings both times;
//   - the crew picks ONE to come inside: Jun (he hears the link's hiss on the right reel and points at it) or Mei (she
//     keeps Shona talking at the door and catches her lie aloud); going alone, Mrs Delaney is the only help. Outside
//     there are always Gus on the radio, Rico in the car and Marcus on air (his last night: "Tuần cuối" is done); Max
//     is on the radio too when his recorder went into the dumpling box ("Hộp há cảo" with Max:
//     `past: 'job-dumplings:crew:phone'`), four lines;
//   - the three threads at once are a `threads` step (inside / at the door / the radio): one heard at a time, a key line
//     going by on another is its consequence (Shona's lie at the door, the police report on the radio);
//   - the five unlabelled reels are a `pick` step (sound only); the talkback reel's line is a `spot` step ("Đó!" at
//     "anything over forty thousand"; too early, too late, never); the false call is answered by intent;
//   - the hour noted wrong: Mrs Delaney calls time herself (the second reel is lost); the box noted wrong: box N first
//     (news tapes, ten minutes gone). The reel and the line are always found in the end (by Mrs Delaney if not by the
//     learner), so the act ends the same: Kemp's bid stopped, Bay FM the listeners', Mrs Delaney suspended, and Kemp:
//     "Keep the tape. I have the rest."
// Max is of the town ('phone'): his four lines are clips (connected only), the browser voice until the owner makes them.

import { CREW_CUT } from '../../../core/town/crew';
import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { JOB_DEPOSITS } from '../../../core/town/fame';

const id = (key: string) => `job-warehouse-${key}`;
const NUMBER = (v: string) => ({ note: 'number', value: v });
const MAX_ON = { past: 'job-dumplings:crew:phone' };
const ALONE = { all: [{ not: { crew: 'jun' } }, { not: { crew: 'mei' } }] };

const LINES = [
  // ── beat 1: the gatehouse ──
  { id: id('a00'), who: 'delaney', text: 'You were my witness once. You can be my assistant tonight.', vi: 'Bạn từng làm nhân chứng cho tôi. Tối nay bạn làm trợ lý cho tôi được đấy.' },
  { id: id('a00b'), who: 'delaney', text: 'I need an assistant tonight. You will do. Listen carefully.', vi: 'Tối nay tôi cần một trợ lý. Bạn được đấy. Nghe cho kỹ.' },
  { id: id('a01'), who: 'delaney', text: 'A safety inspection, under the lease. Warehouse fifteen, Bayline tenant.', vi: 'Một buổi kiểm tra an toàn, theo hợp đồng thuê. Kho mười lăm, người thuê là Bayline.' },
  { id: id('a02'), who: 'delaney', text: 'We start at {time}. I will be at the black door.', vi: 'Mình bắt đầu lúc {time}. Tôi sẽ ở cửa đen.' },
  { id: id('a03'), who: 'delaney', text: 'We have an hour, not a minute more. Nothing leaves unless I write it.', vi: 'Mình có một tiếng, không hơn một phút. Không gì được mang ra trừ khi tôi ghi.' },
  { id: id('a04'), who: 'delaney', text: "The tapes we want are in box M, under the stairs.", vi: 'Băng mình cần nằm trong thùng M, dưới cầu thang.' },
  { id: id('a05'), who: 'delaney', text: 'Last time I caught it myself. This time, you catch it.', vi: 'Lần trước tôi tự bắt được. Lần này, bạn bắt nhé.' },
  { id: id('a01r'), who: 'delaney', text: 'Fifteen. One, five. Not fifty, not fourteen.', vi: 'Mười lăm. Một, năm. Không phải năm mươi, không phải mười bốn.' },
  { id: id('a03r'), who: 'delaney', text: 'One hour. I will be watching the clock. So will you.', vi: 'Một tiếng. Tôi sẽ canh đồng hồ. Bạn cũng vậy.' },
  { id: id('a04r'), who: 'delaney', text: 'M. As in Marcus. Under the stairs.', vi: 'M. Như Marcus. Dưới cầu thang.' },
  { id: id('a06'), who: 'delaney', text: 'I do not repeat myself as a rule. Tonight I made three exceptions.', vi: 'Tôi vốn không nhắc lại. Tối nay tôi phá lệ ba lần rồi.' },
  // ── beat 2: on the way ──
  { id: id('r01'), who: 'marcus', text: "Good evening, Westbay. Last night of nights. Let's make it a long one.", vi: 'Chào buổi tối, Westbay. Đêm cuối của chương trình đêm. Làm nó dài một chút.' },
  { id: id('r02'), who: 'rico', text: "I'm on Quay Street, engine running. Just in case.", vi: 'Tôi ở Quay Street, nổ máy sẵn. Phòng khi cần.' },
  { id: id('x01'), who: 'phone', text: "Recorder's still under that lid, mate. I'll listen in from the hideout.", vi: 'Máy ghi âm vẫn nằm dưới cái nắp đó. Tôi nghe từ chỗ ẩn.' },
  { id: id('b50'), who: 'gus', text: 'There is no fifty. There never was. Twenty-two is the end.', vi: 'Làm gì có kho năm mươi. Chưa bao giờ có. Hai mươi hai là hết.' },
  { id: id('b14'), who: 'gus', text: "That's fourteen. Fifteen's the black door, one along.", vi: 'Đó là kho mười bốn. Kho mười lăm là cửa đen, kế bên.' },
  { id: id('b-late'), who: 'delaney', text: "I have gone in without you. Come in quietly, and quickly.", vi: 'Tôi vào trước rồi. Vào nhẹ thôi, và nhanh lên.' },
  // ── beat 3: inside, three threads ──
  { id: id('i01'), who: 'delaney', text: 'Shelves, boxes, and not one label left. Somebody has been busy.', vi: 'Kệ, thùng, chẳng còn cái nhãn nào. Có người đã bận rộn lắm.' },
  { id: id('i02'), who: 'jun', text: "These are scanner reels. Years of them. That's the whole harbour.", vi: 'Đây là băng của máy quét. Nhiều năm. Cả bến cảng nằm ở đây.' },
  { id: id('i03'), who: 'delaney', text: "Twenty years of this city talking. I'll write that down too.", vi: 'Hai mươi năm thành phố này nói chuyện. Tôi ghi cả điều đó.' },
  { id: id('i04'), who: 'delaney', text: 'The stairs are at the back. Box M should be under them.', vi: 'Cầu thang ở phía sau. Thùng M chắc ở dưới đó.' },
  { id: id('s01'), who: 'shona', text: "The inspection's been cancelled. Her office rang me an hour ago.", vi: 'Buổi kiểm tra bị hủy rồi. Văn phòng bà ấy gọi cho tôi một tiếng trước.' },
  { id: id('s02'), who: 'shona', text: "So I'll just pop in and fetch a box. Won't be a moment.", vi: 'Vậy tôi vào lấy một thùng thôi. Một lát là xong.' },
  { id: id('m01'), who: 'mei', text: "Cancelled? Then why is she inside with a clipboard, dear?", vi: 'Hủy rồi á? Vậy sao bà ấy đang ở trong với cái kẹp hồ sơ, cháu?' },
  { id: id('m02'), who: 'mei', text: "Have a dumpling. Pork. Your boss's favourite, not prawn.", vi: 'Ăn cái há cảo đi. Nhân thịt. Món sếp cô thích, không phải tôm.' },
  { id: id('s03'), who: 'shona', text: 'Fine. I will wait out here. For now.', vi: 'Được. Tôi đứng chờ ngoài này. Tạm thời.' },
  { id: id('g01'), who: 'gus', text: "Gus. There's a boat at your water door. Lights off. The Kittiwake.", vi: 'Gus đây. Có thuyền ở cửa nước. Tắt đèn. Chiếc Kittiwake.' },
  { id: id('p01'), who: 'scanner-desk', text: 'Report of a break-in at warehouse fifteen. Unit twelve, please attend.', vi: 'Có báo đột nhập ở kho mười lăm. Xe mười hai, tới ngay.' },
  { id: id('p02'), who: 'scanner-unit', text: 'Unit twelve. On our way. Two minutes.', vi: 'Xe mười hai. Đang tới. Hai phút.' },
  { id: id('x02'), who: 'phone', text: "Kemp's on his office phone. Says the boxes go by water tonight.", vi: 'Kemp đang nói điện thoại trong văn phòng. Bảo các thùng đi đường thủy tối nay.' },
  // ── after the threads ──
  { id: id('k01'), who: 'shona', text: "Too late, dear. One box is already at the water door.", vi: 'Muộn rồi. Một thùng đã ở cửa nước.' },
  { id: id('k02'), who: 'gus', text: "I've got half of what she moved. The rest's in the bay.", vi: 'Tôi giữ được nửa số cô ta chuyển. Phần còn lại ở dưới vịnh.' },
  { id: id('k03'), who: 'scanner-unit', text: "Unit twelve at fifteen. Who's in charge in there?", vi: 'Xe mười hai tới kho mười lăm. Ai chịu trách nhiệm trong đó?' },
  { id: id('k04'), who: 'delaney', text: 'I am. Harbour Trust. Here is my letter. You may read it twice.', vi: 'Tôi. Ban quản lý cảng. Đây là thư của tôi. Anh đọc hai lần cũng được.' },
  { id: id('k05'), who: 'delaney', text: 'Police at the door? My letter is already in my hand.', vi: 'Cảnh sát tới cửa à? Thư của tôi đã ở trong tay rồi.' },
  // ── the box, the reels ──
  { id: id('n01'), who: 'delaney', text: 'Box N? These are news tapes. Ten minutes gone. M is the next one.', vi: 'Thùng N à? Đây là băng tin tức. Mất mười phút. M là thùng kế.' },
  { id: id('q01'), who: 'delaney', text: 'Five reels, no labels. Which one is the talkback?', vi: 'Năm cuộn, không nhãn. Cuộn nào là talkback?' },
  { id: id('q02'), who: 'delaney', text: 'Jun said Kit tests the link with a kettle. Listen for the kettle.', vi: 'Jun nói Kit thử đường truyền bằng cái ấm nước. Nghe xem có cái ấm không.' },
  { id: id('q03'), who: 'jun', text: "That hiss. That's our link. I'd know it anywhere.", vi: 'Tiếng rè đó. Đó là đường truyền của mình. Ở đâu tôi cũng nhận ra.' },
  { id: id('t1'), who: 'marcus', text: 'Good evening, Westbay, this is Bay FM, and this is the late show.', vi: 'Chào buổi tối, Westbay, đây là Bay FM, và đây là chương trình khuya.' },
  { id: id('t2'), who: 'baydesk', text: 'Car four, the station. Car four, the station, please.', vi: 'Xe bốn, nhà ga. Xe bốn, nhà ga nhé.' },
  { id: id('t3'), who: 'kit', text: "Testing... testing, one, two... the kettle's on.", vi: 'Thử... thử, một, hai... ấm nước đang đun.', broken: true },
  { id: id('t4'), who: 'kit', text: "Testing, testing, one, two. The kettle's off, I think.", vi: 'Thử, thử, một, hai. Ấm nước tắt rồi, chắc vậy.' },
  { id: id('t5'), who: 'caller-clear-m', text: "Hello, is this the request line? It's Mr Pryce again.", vi: 'Alô, đường dây yêu cầu bài hát phải không? Lại là ông Pryce đây.' },
  { id: id('q04'), who: 'delaney', text: "Not that one. I'll find it myself, then. Third reel. The kettle.", vi: 'Không phải cuộn đó. Vậy tôi tự tìm. Cuộn thứ ba. Cái ấm.' },
  // ── the line ──
  { id: id('l01'), who: 'kit', text: 'Studio, the stage here. Mr Ashby wants a word, off air.', vi: 'Phòng thu, sân khấu đây. Ông Ashby muốn nói một câu, ngoài sóng.' },
  { id: id('l02'), who: 'ashby', text: "Off air? Good. The board will take anything over forty thousand.", vi: 'Ngoài sóng à? Tốt. Hội đồng sẽ nhận bất cứ giá nào trên bốn mươi nghìn.' },
  { id: id('l03'), who: 'kit', text: "Understood. And now, back to the music.", vi: 'Rõ. Và giờ, trở lại với âm nhạc.' },
  { id: id('l04'), who: 'delaney', text: 'There. Forty thousand, off air, on his own tape. I have it in writing.', vi: 'Đó. Bốn mươi nghìn, ngoài sóng, trên băng của chính hắn. Tôi đã ghi lại.' },
  // ── the false call ──
  { id: id('f01'), who: 'driver', text: "Mrs Delaney? It's Gus. You're needed at warehouse fifty, right now.", vi: 'Bà Delaney à? Gus đây. Bà cần tới kho năm mươi ngay.' },
  { id: id('f02'), who: 'delaney', text: 'Warehouse fifty, Gus says. Urgent. Should I go?', vi: 'Kho năm mươi, Gus nói vậy. Gấp. Tôi có nên đi không?' },
  { id: id('f02a'), who: 'player', text: "There's no warehouse fifty. The row stops at twenty-two. It's a trap.", vi: 'Không có kho năm mươi. Dãy kho hết ở hai mươi hai. Bẫy đấy.' },
  { id: id('f02b'), who: 'player', text: "Go on, Mrs Delaney. I'll keep watch in here.", vi: 'Bà đi đi, bà Delaney. Tôi canh ở trong này.' },
  { id: id('f02c'), who: 'player', text: "Let me ring Gus back first. That didn't sound like him.", vi: 'Để tôi gọi lại cho Gus đã. Nghe không giống giọng ông ấy.' },
  { id: id('f03'), who: 'delaney', text: 'No fifty. Of course. I knew that. I wanted you to know it too.', vi: 'Không có kho năm mươi. Tất nhiên. Tôi biết. Tôi muốn bạn cũng biết.' },
  { id: id('f04'), who: 'delaney', text: "I'll be back in five minutes. Do not let anybody in.", vi: 'Năm phút nữa tôi quay lại. Đừng cho ai vào.' },
  { id: id('f05'), who: 'gus', text: "Wasn't me, Mrs Delaney. I've been on the radio all night.", vi: 'Không phải tôi đâu, bà Delaney. Cả tối tôi ngồi bộ đàm.' },
  { id: id('h01'), who: 'delaney', text: 'That is the hour. I am calling it myself, since nobody watched the clock.', vi: 'Hết một tiếng. Tôi tự gọi hết giờ, vì chẳng ai canh đồng hồ.' },
  // ── beat 4 ──
  { id: id('e01'), who: 'delaney', text: "Seal box M. And Vane's old papers. That is where the papers are.", vi: 'Niêm phong thùng M. Cả giấy tờ cũ của Vane. Giấy tờ ở đó đấy.' },
  { id: id('e02'), who: 'kemp', text: 'Keep the tape, Mrs Delaney. I have the rest.', vi: 'Cứ giữ cuộn băng đi, bà Delaney. Phần còn lại tôi có.' },
  { id: id('e03'), who: 'marcus', text: 'This is Bay FM. Your station, Westbay. Yours, as of tonight.', vi: 'Đây là Bay FM. Đài của bạn, Westbay. Của bạn, kể từ tối nay.' },
  { id: id('e05'), who: 'delaney', text: 'He will complain about me. He is allowed to. It was worth it.', vi: 'Hắn sẽ khiếu nại tôi. Hắn có quyền. Đáng mà.' },
  { id: id('e06'), who: 'gus', text: "Night show's back. No more quiet nights in my hut.", vi: 'Chương trình đêm trở lại. Hết những đêm im lặng trong chòi tôi.' },
  { id: id('e07'), who: 'phone', text: "Got all that on tape too, mate. Just in case.", vi: 'Tôi cũng thu hết vào băng rồi. Phòng khi cần.' },
  { id: id('n1'), who: 'marcus', text: "Coastline Radio has paused one bid for Bay FM while it asks questions.", vi: 'Coastline Radio tạm dừng một giá mua Bay FM để điều tra.' },
  { id: id('n2'), who: 'marcus', text: "The listeners' bid for this station stands. I can't quite believe it.", vi: 'Giá mua của thính giả cho đài này vẫn đứng. Tôi chưa tin nổi.' },
  { id: id('n3'), who: 'marcus', text: 'The Harbour Trust has suspended one of its officers. We will miss her.', vi: 'Ban quản lý cảng đình chỉ một cán bộ. Chúng tôi sẽ nhớ bà.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'number',
    label: 'Kho số',
    line: id('a01'),
    answer: '15',
    options: [
      { value: '15', label: 'Kho 15' },
      { value: '50', label: 'Kho 50' },
      { value: '14', label: 'Kho 14' },
    ],
  },
  { key: 'time', label: 'Bắt đầu lúc', line: id('a02'), answer: '', options: [] },
  {
    key: 'hour',
    label: 'Được ở trong bao lâu',
    line: id('a03'),
    answer: 'hour',
    options: [
      { value: 'hour', label: 'Một tiếng, không hơn' },
      { value: 'half', label: 'Nửa tiếng' },
      { value: 'hourhalf', label: 'Một tiếng rưỡi' },
    ],
  },
  {
    key: 'box',
    label: 'Thùng cần tìm',
    line: id('a04'),
    answer: 'M',
    options: [
      { value: 'M', label: 'Thùng M, dưới cầu thang' },
      { value: 'N', label: 'Thùng N' },
      { value: 'stores', label: 'Trong kho chứa ("the stores")' },
    ],
  },
];

export const JOB_WAREHOUSE: JobDoc = {
  id: 'job-warehouse',
  title: 'Kho 15',
  blurb: 'Một giờ kiểm tra an toàn hợp pháp ở kho mười lăm. Tìm đúng cuộn băng, đúng câu, trong khi Shona canh cửa và bộ đàm không ngớt.',
  level: 3,
  order: 19,
  opens: ['ct-rico-1'],
  after: 'job-sale',
  afterAll: ['job-crossed', 'job-dumplings', 'job-water', 'job-farewell'],
  // fame and a deposit before the big job (core/town/fame.ts, gta-plan §5 "Mở khóa"): numbers are guesses
  needs: { fame: 24, deposit: JOB_DEPOSITS['job-warehouse'] },
  from: 'delaney',
  clock: 'quarter',
  lines: LINES,
  facts: [
    { id: 'number', label: 'Kho số', line: id('a01'), consequence: 'fifty' },
    { id: 'time', label: 'Bắt đầu lúc', line: id('a02'), consequence: 'late' },
    { id: 'hour', label: 'Được ở trong bao lâu', line: id('a03'), consequence: 'clock' },
    { id: 'box', label: 'Thùng cần tìm', line: id('a04'), consequence: 'box' },
    { id: 'reel', label: 'Cuộn talkback', line: id('q01'), consequence: 'reel', byAction: true },
    { id: 'line', label: 'Câu "forty thousand"', line: id('l02'), consequence: 'line', byAction: true },
    { id: 'call', label: 'Cuộc gọi "kho năm mươi"', line: id('f01'), consequence: 'trap', byAction: true },
  ],
  consequences: {
    fifty: { name: 'Ghi sai số kho: đi nhầm về cuối dãy (hoặc kho bên cạnh), mất mười phút của một giờ', rejoin: 'Gus gọi chỉ; bạn tới cửa đen kho mười lăm.' },
    late: { name: 'Ghi giờ muộn: bà Delaney vào trước một mình, bạn lỡ đoạn đầu', rejoin: 'Bạn vào sau, nhẹ nhàng.' },
    clock: { name: 'Ghi sai thời hạn: không ai canh đồng hồ, mất cuộn thứ hai', rejoin: 'Bà Delaney tự gọi hết giờ.' },
    box: { name: 'Ghi sai thùng: mở thùng N trước, mất mười phút', rejoin: 'Thùng M ở ngay kế bên.' },
    door: { name: 'Không nghe ra lời dối của Shona ở cửa: một thùng ra tới cửa nước', rejoin: 'Gus giữ được nửa số thùng.' },
    police: { name: 'Không nghe báo đột nhập trên bộ đàm: bà Delaney chưa kịp cầm thư khi cảnh sát tới', rejoin: 'Bà đưa thư; cảnh sát đọc rồi đi.' },
    reel: { name: 'Chọn nhầm cuộn băng', rejoin: 'Bà Delaney nghe lần thứ hai và tìm ra cuộn talkback.' },
    line: { name: 'Bấm "Đó!" sai lúc câu "forty thousand"', rejoin: 'Bà Delaney ghi đúng câu khi nghe lại.' },
    trap: { name: 'Tin cuộc gọi giả: bà Delaney ra cửa, Shona chuyển một thùng ra cửa nước', rejoin: 'Gus giữ được nửa; cuộn talkback vẫn còn.' },
  },
  crew: {
    roles: [
      { who: 'jun', role: 'Vào trong: tìm băng bằng tai', listen: 'Jun vào kho với bạn: anh nghe ra tiếng rè của đường truyền trên đúng cuộn, và chỉ chỗ.', opens: { heard: ['ct-jun-3'] }, cut: CREW_CUT.share, with: { at: 'gus' } },
      { who: 'mei', role: 'Vào trong: giữ cửa', listen: 'Mei giữ Shona nói chuyện ở cửa: bạn nghe được bà bắt lời dối của cô ta.', opens: { heard: ['ct-mei-2'] }, cut: CREW_CUT.friend, with: { at: 'mei' } },
    ],
  },
  steps: [
    { kind: 'goto', place: 'gus', label: 'Về trạm gác, cạnh chòi Gus' },
    {
      kind: 'notebook',
      via: 'scene',
      call: [{ line: id('a00'), if: { past: 'job-channels:witness' } }, { line: id('a00b'), if: { not: { past: 'job-channels:witness' } } }, id('a01'), id('a02'), id('a03'), id('a04'), { line: id('a05'), if: { past: 'job-hearing:hit:missedIt' } }],
      entries: NOTEBOOK,
      repeat: { number: [id('a01r')], hour: [id('a03r')], box: [id('a04r')] },
      patience: { after: 3, line: id('a06') },
    },
    // beat 2: Bay FM's last night on the way; Rico in the car; Max listening in
    { kind: 'radio', lines: [id('r01'), id('r02'), { line: id('x01'), if: MAX_ON }] },
    { kind: 'goto', place: 'row-end', label: 'Tới kho đã ghi', if: NUMBER('50') },
    { kind: 'phone', lines: [id('b50')], if: NUMBER('50') },
    { kind: 'goto', place: 'w14-front', label: 'Tới kho đã ghi', if: NUMBER('14') },
    { kind: 'phone', lines: [id('b14')], if: NUMBER('14') },
    { kind: 'phone', lines: [id('b-late')], if: { note: 'time', is: 'late' } },
    // into warehouse fifteen by its black door, with whoever comes inside
    { kind: 'enter', door: 'front', host: 'delaney', visitor: 'jun', more: ['shona'], label: 'Tới cửa đen kho mười lăm', if: { crew: 'jun' } },
    { kind: 'enter', door: 'front', host: 'delaney', visitor: 'mei', more: ['shona'], label: 'Tới cửa đen kho mười lăm', if: { crew: 'mei' } },
    { kind: 'enter', door: 'front', host: 'delaney', more: ['shona'], label: 'Tới cửa đen kho mười lăm', if: ALONE },
    // beat 3: three threads at once
    {
      kind: 'threads',
      tracks: [
        { id: 'room', label: 'Trong kho', lines: [id('i01'), { line: id('i02'), if: { crew: 'jun' } }, id('i03'), id('i04')] },
        { id: 'door', label: 'Ở cửa', lines: [id('s01'), id('s02'), { line: id('m01'), if: { crew: 'mei' } }, { line: id('m02'), if: { crew: 'mei' } }, id('s03')], key: [id('s01')], consequence: 'door' },
        { id: 'radio', label: 'Bộ đàm', lines: [id('g01'), id('p01'), id('p02'), { line: id('x02'), if: MAX_ON }], key: [id('p01')], consequence: 'police' },
      ],
    },
    { kind: 'scene', lines: [id('k01'), id('k02')], if: { hit: 'door' } },
    { kind: 'scanner', lines: [id('k03')], if: { hit: 'police' } },
    { kind: 'scene', lines: [{ line: id('k04'), if: { hit: 'police' } }, { line: id('k05'), if: { not: { hit: 'police' } } }] },
    // the box, then the reels by sound
    { kind: 'scene', lines: [id('n01')], if: { note: 'box', is: 'wrong' } },
    {
      kind: 'pick',
      ask: [id('q01'), { line: id('q02'), if: { not: { past: 'job-link' } } }, { line: id('q03'), if: { crew: 'jun' } }],
      clips: ['t1', 't2', 't3', 't4', 't5'].map(id),
      right: 2,
      consequence: 'reel',
      fact: 'reel',
    },
    { kind: 'scene', lines: [id('q04')], if: { hit: 'reel' } },
    // the line: "Đó!" when the floor price is said
    { kind: 'spot', lines: ['l01', 'l02', 'l03'].map(id), at: id('l02'), early: 'line', late: 'line', never: 'line', fact: 'line', via: 'scene' },
    { kind: 'scene', lines: [id('l04')] },
    // the false call
    {
      kind: 'intent',
      who: 'delaney',
      ask: [id('f01'), id('f02')],
      options: [
        { label: 'Không có kho năm mươi: bẫy', say: id('f02a'), reply: [id('f03')] },
        { label: 'Bà cứ đi, tôi canh ở đây', say: id('f02b'), reply: [id('f04')] },
        { label: 'Gọi lại Gus hỏi đã', say: id('f02c'), reply: [id('f05'), id('f03')] },
      ],
      check: { right: [0, 2], consequence: 'trap', fact: 'call' },
    },
    { kind: 'scene', lines: [id('h01')], if: { note: 'hour', is: 'wrong' } },
    { kind: 'leave' },
  ],
  ending: {
    clean: [id('e01'), id('e02'), id('e03'), { line: id('e07'), if: MAX_ON }],
    messy: [id('e01'), id('e02'), id('e05'), { line: id('e07'), if: MAX_ON }],
    broken: [id('e02'), id('e05'), id('e06')],
  },
  news: { clean: [id('n1'), id('n2'), id('n3')], messy: [id('n1'), id('n2'), id('n3')], broken: [id('n1'), id('n3')] },
};
