// Act III, job 3: "Sam không gọi điện" (docs/gta-story-3.md §4.3). Phone two rings: "Sam", Rico's cousin, wants the
// firm's radio channel and its word for the station. Sam hates the phone and says three words at a time on it (three.ts:
// "I hate the phone. Fine. Three words."; gta-story-3 §2.4); this Sam talks in long, easy sentences. The second way to
// tell (Mei's, docs/city.md §19): ask something only Sam knows. His dog is Chip (docs/city.md: "Sam has a dog, Chip");
// Bayline heard "Chip" on the radio for months and never learned it was a dog (chip.ts o01, o02).
//
// The real Sam is a TOWN resident: his lines are his own Gemini clips [TT] (inventory cityJobs, connected only); the
// impostor is 'sam-fake' (SCENE_VOICES, a browser voice). Until the owner generates the clips both are browser voices,
// so the words alone must carry it, and they do. Then the firm takes a new code (the notebook) and tries it out.
// Uses only steps the engine has: goto, scene, phone, intent, pick, notebook via phone, radio.

import type { NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';
import { CREW_CUT } from '../../../core/town/crew';

const id = (key: string) => `job-samcall-${key}`;

const LINES = [
  // ── beat 1: phone two ──
  { id: id('a01'), who: 'rico', text: "Partner, phone two. Says it's Sam. Sam never rings anybody. Never.", vi: 'Cộng sự, máy số hai. Bảo là Sam. Sam có bao giờ gọi cho ai đâu. Chưa bao giờ.' },
  { id: id('a02'), who: 'rico', text: "You've heard him on a phone. Three words at a time, remember?", vi: 'Bạn nghe cậu ấy nói điện thoại rồi. Mỗi lần ba chữ, nhớ không?' },
  { id: id('m01'), who: 'mei', text: "If it's urgent, it's lying, dear. Ask him something only he knows.", vi: 'Cái gì gấp là cái đó nói dối, cháu. Hỏi cậu ta một điều chỉ cậu ta biết.' },
  // ── the impostor ──
  { id: id('f01'), who: 'sam-fake', text: "Hey, it's Sam. Listen, I need a big favor from you guys tonight.", vi: 'Này, Sam đây. Nghe này, tối nay tôi cần các anh giúp một việc lớn.' },
  { id: id('f02'), who: 'sam-fake', text: "Kemp's drivers are all over my bus route, and I want to call them in.", vi: 'Tài xế của Kemp nhan nhản trên tuyến xe buýt của tôi, tôi muốn báo cho các anh.' },
  { id: id('f03'), who: 'sam-fake', text: 'So what channel are you on now, and what do you call the station?', vi: 'Vậy giờ các anh dùng kênh nào, và các anh gọi nhà ga là gì?' },
  { id: id('f04'), who: 'sam-fake', text: 'My mom says hi, by the way. Call me back on this number.', vi: 'Mà mẹ tôi gửi lời chào. Gọi lại cho tôi số này nhé.' },
  // ── is it him ──
  { id: id('q01'), who: 'rico', text: 'Well? Is that my cousin? He wants our channel and our word for the station.', vi: 'Sao? Đó là em họ tôi à? Nó hỏi kênh của mình và mã của mình cho nhà ga.' },
  { id: id('q01a'), who: 'player', text: "That's not Sam. Sam says three words on a phone, not thirty.", vi: 'Đó không phải Sam. Sam nói điện thoại ba chữ, không phải ba mươi.' },
  { id: id('q01b'), who: 'player', text: "It's Sam. Give him the channel.", vi: 'Sam đấy. Cho cậu ấy kênh đi.' },
  { id: id('q01c'), who: 'player', text: 'Ask him the name of his dog. Only Sam knows that one.', vi: 'Hỏi cậu ta tên con chó. Chỉ Sam biết thôi.' },
  { id: id('q02'), who: 'rico', text: 'Ha! Thirty words, and not one of them is Sam.', vi: 'Ha! Ba mươi chữ, mà chẳng chữ nào là Sam.' },
  { id: id('q03'), who: 'rico', text: 'Thirteen, and Chip for the station. There. Told him.', vi: 'Kênh mười ba, và "Chip" là nhà ga. Đấy. Nói rồi.' },
  { id: id('q04'), who: 'rico', text: "Quick one, Sam. What's your dog called?", vi: 'Hỏi nhanh, Sam. Con chó của cậu tên gì?' },
  { id: id('q05'), who: 'sam-fake', text: 'My dog? Uh, Buddy. Good old Buddy. So, that channel?', vi: 'Con chó á? À, Buddy. Buddy già. Vậy, kênh đó?' },
  { id: id('q06'), who: 'rico', text: 'Wrong dog, friend. Wrong cousin, too. Goodbye.', vi: 'Sai chó rồi, ông bạn. Sai cả em họ. Chào.' },
  { id: id('g01'), who: 'driver', text: "Desk, Rico's lot use Chip for the station. Somebody just told us.", vi: 'Tổng đài, bọn Rico dùng "Chip" cho nhà ga. Có người vừa báo.' },
  { id: id('g02'), who: 'rico', text: 'They know our code, partner. So, new code. Today. Now.', vi: 'Chúng biết mã của mình rồi, cộng sự. Vậy đổi mã. Hôm nay. Ngay.' },
  // ── which one is Sam ──
  { id: id('p01'), who: 'rico', text: 'I kept a few calls off phone two. Which one is really Sam?', vi: 'Tôi giữ vài cuộc gọi từ máy số hai. Cuộc nào thật là Sam?' },
  { id: id('c1'), who: 'sam-fake', text: "Hey, it's Sam. The bus is running late, sorry about that.", vi: 'Này, Sam đây. Xe buýt đang trễ, xin lỗi nhé.' },
  { id: id('c2'), who: 'station', text: 'Bus. Late. Sorry.', vi: 'Xe buýt. Trễ. Xin lỗi.' },
  { id: id('c3'), who: 'sam-fake', text: "Sam here, buddy. I'll be there in five minutes, okay?", vi: 'Sam đây, ông bạn. Năm phút nữa tôi tới, nhé?' },
  { id: id('p02'), who: 'rico', text: 'That one talks too well. My cousin never finished a sentence on a phone.', vi: 'Cuộc đó nói trơn tru quá. Em họ tôi chưa từng nói hết một câu qua điện thoại.' },
  // ── the real Sam, and a new code ──
  { id: id('r01'), who: 'station', text: "Sam. Didn't call. Promise.", vi: 'Sam đây. Không gọi. Thề.' },
  { id: id('r02'), who: 'station', text: 'Hate phones. You know.', vi: 'Ghét điện thoại. Biết mà.' },
  { id: id('n00'), who: 'rico', text: 'New code, partner. Write it down. Sam picked the word.', vi: 'Mã mới, cộng sự. Ghi lại. Sam chọn chữ.' },
  { id: id('n01'), who: 'rico', text: "From tonight we're on fourteen. Not thirteen any more. Over.", vi: 'Từ tối nay mình ở kênh mười bốn. Không còn mười ba nữa. Hết.' },
  { id: id('n02'), who: 'station', text: "New word. Biscuit. Chip's favorite.", vi: 'Chữ mới. "Biscuit". Món Chip thích.' },
  { id: id('n03'), who: 'rico', text: "Grace's stays Grace's. The hospital. Over.", vi: '"Grace\'s" vẫn là "Grace\'s". Bệnh viện. Hết.' },
  { id: id('n01r'), who: 'rico', text: 'Fourteen. One four. Over.', vi: 'Mười bốn. Một bốn. Hết.' },
  { id: id('n02r'), who: 'station', text: 'Biscuit. Like. A cookie.', vi: '"Biscuit". Như. Bánh quy.' },
  { id: id('n04'), who: 'rico', text: "Once more, then I'm putting the kettle on.", vi: 'Một lần nữa thôi, rồi tôi đi đun nước.' },
  // ── trying it out ──
  { id: id('w01'), who: 'rico', text: 'Wrong channel, partner. Nobody is on that one. Fourteen.', vi: 'Sai kênh rồi, cộng sự. Kênh đó có ai đâu. Mười bốn.' },
  { id: id('t01'), who: 'rico', text: "Car two, pick up at Biscuit, one going to Grace's. Over.", vi: 'Xe hai, đón ở "Biscuit", một người đi "Grace\'s". Hết.' },
  { id: id('w02'), who: 'rico', text: "Biscuit is the station, partner. Chip's biscuit. The station.", vi: '"Biscuit" là nhà ga, cộng sự. Bánh của Chip. Nhà ga.' },
  { id: id('o01'), who: 'okafor', text: 'Sam rang me at noon. Three numbers, three words. Same as ever.', vi: 'Sam gọi cho tôi lúc trưa. Ba con số, ba chữ. Như mọi khi.' },
  // ── the end ──
  { id: id('e01'), who: 'rico', text: 'Thirty words from my cousin? Never. You knew before I did.', vi: 'Em họ tôi nói ba mươi chữ á? Không đời nào. Bạn biết trước cả tôi.' },
  { id: id('e02'), who: 'rico', text: 'New channel, new word. Bayline can go back to guessing.', vi: 'Kênh mới, chữ mới. Bayline lại đi đoán tiếp.' },
  { id: id('e03'), who: 'rico', text: 'Not pretty, but we got there. New code by tonight.', vi: 'Không đẹp lắm, nhưng xong. Tối nay có mã mới.' },
  { id: id('e04'), who: 'rico', text: 'They had our code for an hour. Never again, partner.', vi: 'Chúng giữ mã của mình một tiếng. Không bao giờ nữa, cộng sự.' },
  { id: id('e05'), who: 'station', text: 'Nice. Ears. Thanks.', vi: 'Hay. Tai. Cảm ơn.' },
  { id: id('n1'), who: 'marcus', text: "A word to Westbay. If a caller wants your code word, he isn't your friend.", vi: 'Một lời với Westbay. Ai gọi tới mà hỏi mật mã của bạn thì không phải bạn bạn đâu.' },
];

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'channel',
    label: 'Kênh mới',
    line: id('n01'),
    answer: '14',
    options: [
      { value: '14', label: 'Mười bốn (14)' },
      { value: '40', label: 'Bốn mươi (40)' },
      { value: '4', label: 'Bốn (4)' },
    ],
  },
  {
    key: 'word',
    label: 'Chữ mới cho nhà ga',
    line: id('n02'),
    answer: 'biscuit',
    options: [
      { value: 'biscuit', label: '"Biscuit" (bánh quy)' },
      { value: 'basket', label: '"Basket" (cái giỏ)' },
      { value: 'brisket', label: '"Brisket" (thịt ức bò)' },
    ],
  },
];

export const JOB_SAMCALL: JobDoc = {
  id: 'job-samcall',
  title: 'Sam không gọi điện',
  blurb: '"Sam" gọi máy số hai, xin kênh bộ đàm và mã của hãng. Sam ghét điện thoại. Nghe ra người thật, rồi đổi mã.',
  level: 2,
  order: 25,
  opens: ['ct-rico-1'],
  after: 'job-forged',
  from: 'rico',
  lines: LINES,
  facts: [
    { id: 'trust', label: 'Có phải Sam không', line: id('q01'), consequence: 'gave', byAction: true },
    { id: 'sam', label: 'Cuộc gọi thật của Sam', line: id('p01'), consequence: 'clip', byAction: true },
    { id: 'channel', label: 'Kênh mới', line: id('n01'), consequence: 'channel' },
    { id: 'word', label: 'Chữ mới cho nhà ga', line: id('n02'), consequence: 'word' },
  ],
  consequences: {
    gave: { name: 'Bảo Rico cho kênh và mã: Bayline biết "Chip" là nhà ga', rejoin: 'Rico đổi mã ngay hôm đó.' },
    clip: { name: 'Chọn nhầm cuộc gọi: chưa nhận ra Sam thật', rejoin: 'Rico chỉ ra cuộc ba chữ.' },
    channel: { name: 'Ghi sai kênh mới: lên kênh không ai nghe', rejoin: 'Rico gọi chỉ lại kênh mười bốn.' },
    word: { name: 'Ghi sai chữ mới: không biết "Biscuit" là đâu', rejoin: 'Rico nhắc: "Biscuit" là nhà ga.' },
  },
  crew: {
    roles: [{ who: 'mei', role: 'Ngồi cạnh máy hai', listen: 'Mei nghe cùng bạn: bà nhắc cách hỏi một điều chỉ người thật trả lời được.', opens: { heard: ['ct-mei-2'] }, cut: CREW_CUT.friend, with: { at: 'gus' } }],
  },
  steps: [
    { kind: 'goto', place: 'gus', label: 'Về văn phòng cạnh chòi Gus' },
    { kind: 'scene', at: 'gus', lines: [id('a01'), { line: id('a02'), if: { past: 'job-three' } }] },
    { kind: 'phone', lines: [id('f01'), id('f02'), id('f03'), id('f04')] },
    { kind: 'scene', at: 'gus', lines: [id('m01')], if: { crew: 'mei' } },
    {
      kind: 'intent',
      who: 'rico',
      ask: [id('q01')],
      options: [
        { label: 'Không phải Sam: Sam nói ba chữ một lần', say: id('q01a'), reply: [id('q02')], flag: 'code-safe' },
        { label: 'Là Sam, cho cậu ấy kênh', say: id('q01b'), reply: [id('q03')] },
        { label: 'Hỏi tên con chó của Sam', say: id('q01c'), reply: [id('q04')], flag: 'asked-dog' },
      ],
      check: { right: [0, 2], consequence: 'gave', fact: 'trust' },
    },
    { kind: 'phone', lines: [id('q05'), id('q06')], if: { flag: 'asked-dog' } },
    { kind: 'radio', lines: [id('g01'), id('g02')], if: { hit: 'gave' } },
    { kind: 'pick', ask: [id('p01')], clips: ['c1', 'c2', 'c3'].map(id), right: 1, consequence: 'clip', fact: 'sam' },
    { kind: 'scene', at: 'gus', lines: [id('p02')], if: { hit: 'clip' } },
    { kind: 'phone', lines: [id('r01'), id('r02')] },
    {
      kind: 'notebook',
      via: 'phone',
      call: [id('n00'), id('n01'), id('n02'), id('n03')],
      entries: NOTEBOOK,
      repeat: { channel: [id('n01r')], word: [id('n02r')] },
      patience: { after: 3, line: id('n04') },
    },
    { kind: 'phone', lines: [id('w01')], if: { note: 'channel', is: 'wrong' } },
    { kind: 'radio', lines: [id('t01')] },
    { kind: 'phone', lines: [id('w02')], if: { note: 'word', is: 'wrong' } },
    { kind: 'goto', place: 'okafor', label: 'Tới nhà ga ("Biscuit")' },
    { kind: 'scene', at: 'okafor', lines: [id('o01')] },
  ],
  ending: {
    clean: [id('e01'), id('e02'), id('e05')],
    messy: [id('e03'), id('e02')],
    broken: [id('e04'), id('e02')],
  },
  news: { clean: [id('n1')], messy: [id('n1')], broken: [id('n1')] },
};
