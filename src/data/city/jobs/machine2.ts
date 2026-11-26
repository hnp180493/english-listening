// Act I, job 1: "Máy số hai" (docs/gta-story.md §6, written there line by line; §1 for who the learner is, §2 for
// Duncan Kemp). The first night of Rico's firm in the old gatehouse by Gus's hut on Pier Road: phone two rings, a
// man books a car under "Kemp", the learner picks him up by the paper kiosk at Meridian's side and drives him to Mei's
// dumpling stall, talking on the way (the learner answers by intent); at the stall he offers to buy her pitch "at
// what it's worth", and tells the learner listening that they can come closer. Rico hears the name: Duncan Kemp, who
// owns Bayline.
//
// Lines as the bible writes them, except these (docs/gta-plan.md §13 lists them too):
//   04  "Tess, can you—" → "Tess, can you..." (a dash is not a sentence's end);
//   12  "Quarter past seven, if that's alright…" → "Say {time}, if that's alright…": the appointment is the game's
//       clock (as in M0), always a quarter past or to, so "past / to" stays the pair a careless ear mixes up;
//   12r "Quarter past. Seven fifteen." → "At {time}, please." (the time is the clock's);
//   21  "Car for Mr Kemp?" has its variants Ken / Kent as their own lines (21-ken, 21-kent);
//   24  split: "Nah, I'm waiting for the bus." + "And who's Ken, anyway?" (said only when the learner asked for Ken);
//   25a "Quarter past on the dot." → "On the dot." (the time is the clock's); 25c "…since quarter to?" → "…half an
//       hour?"; 25d "…at ten past." → "…early." (both hold for any appointment);
//   16b, 25e, 33, 43, H2, N-clean are split in two (a line is at most sixteen words);
//   52  the learner's answer "the name noted" is its own line (52-kemp / -ken / -kent); 53b has a Kent twin (53c).
// The kiosk is Mr Whitlock's (data/cityWorld.ts 'whitlock'); the old gatehouse is not on the map yet, so beat 1 is
// staged at Gus's hut next door ('gus'). Kemp is new (browser voice, core/town/sceneTypes SCENE_VOICES); he stands
// in the city by Station Avenue (features/town/jobs/jobCast.ts). Nobody of the town speaks: no clips.

import type { JobLine, NoteEntry } from '../../../core/town/job';
import type { JobDoc } from '../../../core/town/jobDoc';

const id = (key: string) => `job-m2-${key}`;

const LINES: readonly JobLine[] = [
  // ── beat 1: the gatehouse, phone two ──
  { id: id('01'), who: 'rico', text: 'Two phones. A map on the wall. Tess, look at it. Just look at it.', vi: 'Hai cái điện thoại. Một tấm bản đồ trên tường. Tess, nhìn đi. Nhìn nó mà xem.' },
  { id: id('02'), who: 'tess', text: "It's lovely, Rico. It's also a shed with a radiator.", vi: 'Đẹp lắm, anh Rico. Mà nó cũng là cái chòi có cái lò sưởi.' },
  { id: id('03'), who: 'rico', text: "It's a gatehouse. And it's ours. Well. Gus says it's ours.", vi: 'Là trạm gác. Và là của mình. À thì. Gus bảo là của mình.' },
  { id: id('04'), who: 'rico', text: "That's phone two! Phone two's ringing! Tess, can you...", vi: 'Máy số hai kìa! Máy số hai đổ chuông! Tess, em nghe giùm…' },
  { id: id('05'), who: 'tess', text: "I said I'd bring the coffee, Rico. I never said I'd answer it.", vi: 'Em bảo em mang cà phê thôi, anh Rico. Em có bảo em nghe máy đâu.' },
  { id: id('06'), who: 'rico', text: "Then it's yours. Go on. Write everything down, yeah? Everything.", vi: 'Thế thì máy của bạn. Nghe đi. Ghi hết lại nhé? Hết luôn.' },
  { id: id('07'), who: 'kemp', text: "Hi there, is that Rico's? The new lot, down at the harbour gate?", vi: 'Chào, phải chỗ của Rico không? Chỗ mới mở dưới cổng cảng ấy?' },
  { id: id('08'), who: 'player', text: "Yes, Rico's. Hello.", vi: 'Vâng, hãng của Rico đây. Xin chào.' },
  { id: id('09'), who: 'kemp', text: 'Lovely. I need a car tonight. Just me, no bags.', vi: 'Tốt quá. Tối nay tôi cần một xe. Mình tôi thôi, không hành lý.' },
  { id: id('10'), who: 'kemp', text: 'Put it down under Kemp, would you?', vi: 'Ghi tên Kemp giúp tôi nhé?' },
  { id: id('11'), who: 'kemp', text: 'Pick me up outside Meridian. Not the front, sorry, round the side. By the paper kiosk.', vi: 'Đón tôi ở Meridian. À không phải cửa trước, xin lỗi, vòng ra bên hông. Chỗ sạp báo.' },
  { id: id('12'), who: 'kemp', text: "Say {time}, if that's alright. I'll be in a navy coat.", vi: 'Tầm {time}, nếu được. Tôi mặc áo khoác xanh than.' },
  { id: id('13'), who: 'kemp', text: "And I'm off to the night market. Mei's. The dumpling stall.", vi: 'Rồi tôi ra chợ đêm. Chỗ bà Mei. Sạp há cảo.' },
  { id: id('14'), who: 'kemp', text: 'No rush, mind. I never rush anybody.', vi: 'Mà không vội đâu. Tôi chẳng bao giờ giục ai.' },
  { id: id('15'), who: 'kemp', text: "Tell Rico good luck with the new place. He'll need it.", vi: 'Nhắn Rico là chúc may mắn với chỗ mới nhé. Anh ta sẽ cần đấy.' },
  { id: id('10r'), who: 'kemp', text: 'Kemp. K, E, M, P.', vi: 'Kemp. K-E-M-P.' },
  { id: id('11r'), who: 'kemp', text: 'Meridian. Round the side, by the kiosk. Not the front.', vi: 'Meridian. Bên hông, chỗ sạp báo. Không phải cửa trước.' },
  { id: id('12r'), who: 'kemp', text: 'At {time}, please.', vi: 'Lúc {time} nhé.' },
  { id: id('13r'), who: 'kemp', text: "Mei's. The dumplings. Night market.", vi: 'Chỗ bà Mei. Há cảo. Chợ đêm.' },
  { id: id('14r'), who: 'kemp', text: "Take your time. You're new, aren't you? That's alright.", vi: 'Cứ từ từ. Bạn mới vào nghề phải không? Không sao đâu.' },
  { id: id('16'), who: 'rico', text: "Who was it? No, tell me later. The car's outside, keys are in it.", vi: 'Ai gọi thế? Thôi, kể sau. Xe ngoài kia, chìa khóa cắm sẵn.' },
  { id: id('16b'), who: 'rico', text: 'You asked him to say it again? Good.', vi: 'Bạn bảo khách nói lại à? Tốt.' },
  { id: id('16c'), who: 'rico', text: 'Nobody ever asks. They just nod and get it wrong.', vi: 'Chẳng ai chịu hỏi. Người ta cứ gật đầu rồi làm sai.' },
  { id: id('17'), who: 'tess', text: "Take a coffee. The first fare's always the strange one.", vi: 'Cầm theo ly cà phê. Khách đầu tiên bao giờ cũng là khách lạ.' },
  // ── beat 2: the car's radio, the kiosk ──
  { id: id('18'), who: 'kit', text: 'This is Bay FM traffic, brought to you by Bayline.', vi: 'Đây là bản tin giao thông Bay FM, do Bayline tài trợ.' },
  { id: id('19'), who: 'kit', text: 'Roadworks on Station Avenue all week, so give it a miss if you can.', vi: 'Đại lộ Station Avenue sửa đường cả tuần, tránh được thì tránh.' },
  { id: id('20'), who: 'kemp', text: "Bayline. Wherever you're going, we're already there.", vi: 'Bayline. Bạn đi đâu, chúng tôi đã ở đó rồi.' },
  { id: id('21'), who: 'player', text: 'Car for Mr Kemp?', vi: 'Xe cho ông Kemp phải không?' },
  { id: id('21-ken'), who: 'player', text: 'Car for Mr Ken?', vi: 'Xe cho ông Ken phải không?' },
  { id: id('21-kent'), who: 'player', text: 'Car for Mr Kent?', vi: 'Xe cho ông Kent phải không?' },
  { id: id('22'), who: 'whitlock', text: "Me? Good heavens, no. Whitlock. I'm only here for the paper.", vi: 'Tôi á? Ôi trời, không. Whitlock. Tôi chỉ ra mua tờ báo thôi.' },
  { id: id('23'), who: 'hana', text: "Not me, sorry. I'm off home. On foot, sadly.", vi: 'Không phải tôi đâu, xin lỗi. Tôi về nhà. Đi bộ, buồn thay.' },
  { id: id('24'), who: 'dev', text: "Nah, I'm waiting for the bus.", vi: 'Không, tôi đợi xe buýt.' },
  { id: id('24k'), who: 'dev', text: "And who's Ken, anyway?", vi: 'Mà Ken là ai thế?' },
  { id: id('25a'), who: 'kemp', text: 'On the dot. And you said Kemp, not Ken. People usually drop the P.', vi: 'Đúng giờ. Mà bạn gọi Kemp chứ không phải Ken. Người ta hay nuốt mất chữ P.' },
  { id: id('25b'), who: 'kemp', text: "Kemp. With a P on the end. Everybody swallows the P. Don't worry about it.", vi: 'Kemp. Có chữ P ở cuối. Ai cũng nuốt mất chữ P. Đừng lo.' },
  { id: id('25c'), who: 'kemp', text: "You've been sitting here half an hour? Rico's paying you to wait, then.", vi: 'Bạn ngồi đây nửa tiếng rồi à? Vậy là Rico trả tiền cho bạn ngồi chờ.' },
  { id: id('25c2'), who: 'rico', text: 'Where are you? I had a fare at the station, and Bayline just took it.', vi: 'Bạn đâu rồi? Có khách ở ga, mà Bayline vừa hốt mất.' },
  { id: id('25d'), who: 'kemp', text: "Half an hour late. I counted. Bayline would've been here early.", vi: 'Trễ nửa tiếng. Tôi đếm đấy. Bayline thì đã có mặt từ sớm.' },
  { id: id('25e'), who: 'kemp', text: 'I can see your car from here.', vi: 'Tôi thấy xe bạn từ đây.' },
  { id: id('25e2'), who: 'kemp', text: "I'm round the side, by the kiosk. I did say.", vi: 'Tôi ở bên hông, chỗ sạp báo. Tôi có nói rồi mà.' },
  { id: id('25f'), who: 'rico', text: 'Your fare\'s gone. He got a Bayline car. Never mind.', vi: 'Khách đi rồi. Lên xe Bayline. Kệ.' },
  { id: id('25f2'), who: 'rico', text: "Go to Mei's anyway, she rang about her lights.", vi: 'Cứ ra chỗ bà Mei, bà vừa gọi nhờ xem cái đèn.' },
  // ── in the car ──
  { id: id('26'), who: 'kemp', text: "So you're the new voice on Rico's second phone. What's he paying you?", vi: 'Vậy bạn là giọng mới ở máy số hai của Rico. Anh ta trả bạn bao nhiêu?' },
  { id: id('27a'), who: 'player', text: 'Mostly coffee, so far.', vi: 'Đến giờ thì chủ yếu bằng cà phê.' },
  { id: id('27b'), who: 'player', text: "That's between me and Rico.", vi: 'Chuyện đó là giữa tôi với Rico.' },
  { id: id('27c'), who: 'player', text: "Nothing yet. It's my first night.", vi: 'Chưa có gì. Hôm nay là tối đầu tiên.' },
  { id: id('28a'), who: 'kemp', text: "Tess's coffee? Then he's paying you well.", vi: 'Cà phê của Tess à? Vậy là anh ta trả hậu đấy.' },
  { id: id('28b'), who: 'kemp', text: 'Good answer. I like people who keep things to themselves.', vi: 'Trả lời hay. Tôi quý người biết giữ chuyện cho mình.' },
  { id: id('28c'), who: 'kemp', text: "First night. Then I'm your first fare. I'm flattered.", vi: 'Tối đầu tiên. Vậy tôi là khách đầu tiên của bạn. Hân hạnh quá.' },
  { id: id('29'), who: 'kemp', text: "Stay off the avenue, by the way. Roadworks. College Road's quicker.", vi: 'Mà nhớ tránh đại lộ nhé. Đang sửa đường. Đi College Road nhanh hơn.' },
  { id: id('30'), who: 'kemp', text: "I'll be straight with you, because I always am. I've put in for that gatehouse.", vi: 'Tôi nói thẳng nhé, vì tôi lúc nào cũng nói thẳng. Tôi đã nộp hồ sơ xin cái trạm gác đó.' },
  { id: id('31'), who: 'kemp', text: "It's not Gus's to give, you see. It belongs to the Harbour Trust.", vi: 'Bạn biết đấy, nó đâu phải của Gus mà cho. Nó thuộc về Ban quản lý cảng.' },
  { id: id('32'), who: 'kemp', text: 'They hear the bids in a fortnight. Rico can bid, I can bid. All above board.', vi: 'Hai tuần nữa họ xét hồ sơ. Rico nộp được, tôi nộp được. Đàng hoàng cả.' },
  { id: id('33'), who: 'kemp', text: 'Mrs Vane tried to take this harbour with a pen and a lie.', vi: 'Bà Vane định chiếm cái cảng này bằng một cây bút và một lời nói dối.' },
  { id: id('33b'), who: 'kemp', text: "I'm just going to buy it.", vi: 'Tôi thì chỉ định mua nó thôi.' },
  { id: id('34'), who: 'kemp', text: "And if Rico can't pay you, Bayline pays every Friday. Have a think.", vi: 'Còn nếu Rico không trả nổi, Bayline trả lương mỗi thứ Sáu. Nghĩ thử xem.' },
  { id: id('35a'), who: 'player', text: "Thanks. I'm happy where I am.", vi: 'Cảm ơn. Tôi đang ổn ở chỗ này.' },
  { id: id('35b'), who: 'player', text: "Sorry, what's Bayline?", vi: 'Xin lỗi, Bayline là gì?' },
  { id: id('35c'), who: 'player', text: "I'll think about it.", vi: 'Để tôi nghĩ đã.' },
  { id: id('36a'), who: 'kemp', text: "For now. That's fine. Everybody's happy for now.", vi: 'Lúc này thôi. Không sao. Lúc này thì ai cũng ổn.' },
  { id: id('36b'), who: 'kemp', text: "Ah. He hasn't mentioned me. That's almost sweet.", vi: 'À. Anh ta chưa nhắc tới tôi. Gần như là dễ thương.' },
  { id: id('36c'), who: 'kemp', text: "Do. I'll ask again.", vi: 'Cứ nghĩ đi. Tôi sẽ hỏi lại.' },
  { id: id('37'), who: 'fay', text: "He's not going up, is he? Not in this wind.", vi: 'Ông ấy không định lên đấy chứ? Gió thế này.' },
  { id: id('38'), who: 'kemp', text: "Mei's, I said. The dumplings. Never mind, I'll walk. I like a walk.", vi: 'Tôi bảo chỗ bà Mei. Há cảo. Thôi, tôi đi bộ. Tôi thích đi bộ.' },
  { id: id('38b'), who: 'kemp', text: "That's a stage. Lovely. I can't eat a stage. Mei's, I said.", vi: 'Đây là sân khấu. Đẹp đấy. Nhưng tôi đâu ăn được sân khấu. Tôi bảo chỗ bà Mei mà.' },
  { id: id('39'), who: 'kemp', text: 'Here we are. Keep the change. And the rest.', vi: 'Tới rồi. Giữ tiền thừa đi. Cả phần còn lại nữa.' },
  // ── beat 3: the dumpling stall ──
  { id: id('40'), who: 'kemp', text: "Six pork, please, Mrs Mei. Pork's better. Prawn is for tourists.", vi: 'Cho sáu cái nhân thịt, bà Mei. Thịt ngon hơn. Tôm là cho khách du lịch.' },
  { id: id('41'), who: 'mei', text: "That's my line. Where did you hear that?", vi: 'Câu đó là của tôi. Cậu nghe ở đâu ra thế?' },
  { id: id('42'), who: 'kemp', text: "Everybody knows your lines since the tape, Mrs Mei. You're famous.", vi: 'Từ vụ cuộn băng, ai chẳng thuộc câu của bà, bà Mei. Bà nổi tiếng rồi.' },
  { id: id('43'), who: 'kemp', text: "If you ever want to sell this pitch, I'll pay what it's worth.", vi: 'Nếu có ngày bà muốn bán chỗ này, tôi trả đúng giá của nó.' },
  { id: id('43b'), who: 'kemp', text: 'Not a penny less.', vi: 'Không bớt một xu.' },
  { id: id('44'), who: 'mei', text: 'Is it urgent?', vi: 'Có gấp không?' },
  { id: id('45'), who: 'kemp', text: "Not at all. Take a year. Take ten. I'm a patient man.", vi: 'Không hề. Bà cứ để một năm. Mười năm. Tôi là người kiên nhẫn.' },
  { id: id('46'), who: 'mei', text: "Hm. Nobody's ever said not urgent.", vi: 'Hừm. Chưa ai từng bảo là không gấp.' },
  { id: id('47'), who: 'kemp', text: "You can come closer, you know. I never say anything I wouldn't say on the radio.", vi: 'Lại gần hơn cũng được mà. Tôi chẳng bao giờ nói điều gì mà tôi không dám nói trên đài.' },
  { id: id('48'), who: 'kemp', text: "Goodnight, Mrs Mei. Goodnight, Rico's new voice.", vi: 'Chúc ngủ ngon, bà Mei. Chúc ngủ ngon, giọng mới của Rico.' },
  { id: id('49'), who: 'mei', text: 'You heard him, dear. What does he want from me?', vi: 'Cháu nghe rồi đấy. Hắn muốn gì ở bà?' },
  { id: id('49a'), who: 'player', text: 'He wants to buy your stall.', vi: 'Hắn muốn mua sạp của bà.' },
  { id: id('49b'), who: 'player', text: 'Just the dumplings, I think.', vi: 'Chắc chỉ mua há cảo thôi ạ.' },
  { id: id('49c'), who: 'player', text: 'He wants you to work for him.', vi: 'Hắn muốn bà làm cho hắn.' },
  { id: id('50a'), who: 'mei', text: "Yes. And he knew what I'd ask before I asked it.", vi: 'Đúng. Mà hắn biết bà sẽ hỏi gì trước cả khi bà hỏi.' },
  { id: id('50b'), who: 'mei', text: 'Dumplings? He wants my stall, dear. Listen with both ears.', vi: 'Há cảo á? Hắn muốn cái sạp của bà, cháu ạ. Nghe bằng cả hai tai vào.' },
  { id: id('50c'), who: 'mei', text: 'Work? At my age? No, dear. He wants my stall.', vi: 'Làm công á? Tuổi này? Không đâu cháu. Hắn muốn cái sạp của bà.' },
  { id: id('51'), who: 'mei', text: "And he knew what I'd ask before I asked it. Somebody's been listening.", vi: 'Mà hắn biết bà sẽ hỏi gì trước cả khi bà hỏi. Có kẻ đang nghe lén.' },
  // ── beat 4: Rico rings ──
  { id: id('52'), who: 'rico', text: "How'd it go? Who was he, anyway? Give me the name.", vi: 'Sao rồi? Mà khách là ai thế? Cho tôi cái tên.' },
  { id: id('52-kemp'), who: 'player', text: 'A Mr Kemp.', vi: 'Một ông tên Kemp.' },
  { id: id('52-ken'), who: 'player', text: 'A Mr Ken.', vi: 'Một ông tên Ken.' },
  { id: id('52-kent'), who: 'player', text: 'A Mr Kent.', vi: 'Một ông tên Kent.' },
  { id: id('53'), who: 'rico', text: "Kemp? Navy coat, night market? That's Duncan Kemp. He owns Bayline.", vi: 'Kemp? Áo khoác xanh than, chợ đêm? Đó là Duncan Kemp. Hắn là chủ Bayline.' },
  { id: id('53b'), who: 'rico', text: "Ken? Navy coat, night market... That's not Ken. That's Duncan Kemp. He owns Bayline.", vi: 'Ken? Áo khoác xanh than, chợ đêm… Không phải Ken đâu. Đó là Duncan Kemp. Hắn là chủ Bayline.' },
  { id: id('53c'), who: 'rico', text: "Kent? Navy coat, night market... That's not Kent. That's Duncan Kemp. He owns Bayline.", vi: 'Kent? Áo khoác xanh than, chợ đêm… Không phải Kent đâu. Đó là Duncan Kemp. Hắn là chủ Bayline.' },
  { id: id('S1'), who: 'rico', text: 'On time, right door, right name, and he tipped. Partner, he was testing us. We passed.', vi: 'Đúng giờ, đúng cửa, đúng tên, lại còn được boa. Cộng sự ơi, hắn thử mình đấy. Mình qua rồi.' },
  { id: id('S2'), who: 'rico', text: "So Kemp wants our gatehouse. Right. Then we'd better be good. Very good.", vi: 'Vậy là Kemp muốn trạm gác của mình. Được. Thế thì mình phải giỏi. Thật giỏi.' },
  { id: id('L1'), who: 'rico', text: "He'll tell the Trust about tonight, you know. Every minute of it.", vi: 'Hắn sẽ kể với Ban quản lý cảng về tối nay đấy. Từng phút một.' },
  { id: id('L2'), who: 'rico', text: "Never mind. Tomorrow, ask them to say it twice. People don't mind. Honestly.", vi: 'Thôi kệ. Mai cứ bảo khách nói lại lần nữa. Người ta không phiền đâu. Thật đấy.' },
  { id: id('H1'), who: 'rico', text: 'Our very first fare, and he went home in a Bayline car.', vi: 'Khách đầu tiên của mình, mà hắn về bằng xe Bayline.' },
  { id: id('H2'), who: 'rico', text: "That's alright. My first day, I took a bride to the wrong church.", vi: 'Không sao. Ngày đầu của tôi, tôi chở cô dâu tới nhầm nhà thờ.' },
  { id: id('H2b'), who: 'rico', text: 'She got married anyway.', vi: 'Cuối cùng cô ấy vẫn cưới.' },
  { id: id('N1'), who: 'kit', text: "And a new taxi firm's opened at the harbour gate tonight.", vi: 'Và tối nay có một hãng taxi mới mở ở cổng cảng.' },
  { id: id('N1b'), who: 'kit', text: 'Good luck to them, from all of us.', vi: 'Cả đài chúc họ may mắn.' },
  { id: id('N2'), who: 'kit', text: "Reports of a taxi going round in circles near the harbour tonight. Somebody's new.", vi: 'Tối nay có tin một chiếc taxi chạy vòng vòng gần cảng. Chắc có người mới vào nghề.' },
  { id: id('N3'), who: 'kit', text: "Bayline tells us they carried another happy customer to the night market. Bayline. We're already there.", vi: 'Bayline cho biết họ vừa chở thêm một khách hàng vui vẻ ra chợ đêm. Bayline. Chúng tôi đã ở đó rồi.' },
];

const NAME = (v: string) => ({ note: 'name', value: v });

const NOTEBOOK: NoteEntry[] = [
  {
    key: 'name',
    label: 'Tên khách',
    line: id('10'),
    answer: 'kemp',
    options: [
      { value: 'kemp', label: 'Kemp' },
      { value: 'ken', label: 'Ken' },
      { value: 'kent', label: 'Kent' },
    ],
  },
  {
    key: 'pickup',
    label: 'Đón ở đâu',
    line: id('11'),
    answer: 'kiosk',
    options: [
      { value: 'kiosk', label: 'Sạp báo bên hông Meridian' },
      { value: 'front', label: 'Cửa trước Meridian' },
      { value: 'loom', label: 'Cửa xưởng Loom bên cạnh' },
    ],
  },
  { key: 'time', label: 'Mấy giờ', line: id('12'), answer: '', options: [] },
  {
    key: 'dest',
    label: 'Đi đâu',
    line: id('13'),
    answer: 'mei',
    options: [
      { value: 'mei', label: 'Sạp há cảo của bà Mei' },
      { value: 'fay', label: 'Vòng đu quay của Fay' },
      { value: 'stage', label: 'Sân khấu Bay FM ở chợ đêm' },
    ],
  },
];

/** Gone (Kemp took a Bayline car) or dropped at the wrong stop: the learner reaches the stall after the talk began. */
const LATE_AT_STALL = { any: [{ hit: 'gone' }, { note: 'dest', is: 'wrong' as const }] };

export const JOB_MACHINE2: JobDoc = {
  id: 'job-m2',
  title: 'Máy số hai',
  blurb: 'Tối đầu tiên của hãng taxi của Rico ở trạm gác cũ. Máy số hai đổ chuông, và Tess không nghe máy giùm.',
  level: 2,
  order: 1,
  opens: ['ct-rico-1'],
  from: 'rico',
  lines: LINES,
  facts: [
    { id: 'name', label: 'Tên khách', line: id('10'), consequence: 'name' },
    { id: 'pickup', label: 'Đón ở đâu', line: id('11'), consequence: 'door', byAction: true },
    { id: 'time', label: 'Mấy giờ', line: id('12'), consequence: 'late', early: 'early' },
    { id: 'dest', label: 'Đi đâu', line: id('13'), consequence: 'wrongStop', byAction: true },
    { id: 'want', label: 'Kemp muốn gì ở bà Mei', line: id('43'), consequence: 'mei', byAction: true },
  ],
  consequences: {
    name: { name: 'Ghi sai tên khách: Kemp phải sửa "có chữ P"', rejoin: 'Kemp vẫn lên xe; Rico nói đúng tên ở cuối.' },
    door: { name: 'Chờ nhầm cửa: Kemp phải gọi điện chỉ', rejoin: 'Kemp vẫn lên xe, trễ vài phút.' },
    early: { name: 'Ghi giờ sớm: ngồi chờ nửa tiếng, Rico mất một khách ở ga vào tay Bayline', rejoin: 'Kemp vẫn tới đúng giờ hẹn.' },
    late: { name: 'Ghi giờ muộn (hoặc tới muộn): Kemp phải chờ nửa tiếng', rejoin: 'Kemp vẫn lên xe.' },
    gone: { name: 'Tới quá muộn: Kemp lên xe Bayline', rejoin: 'Bạn vẫn ra sạp bà Mei, Kemp đã ở đó.', fatal: true },
    wrongPerson: { name: 'Hỏi nhầm người ở sạp báo', rejoin: 'Người bị hỏi nhầm từ chối; Kemp vẫn đứng đó.' },
    wrongStop: { name: 'Chở nhầm chỗ: Kemp đi bộ sang trước, bạn lỡ mấy câu đầu ở sạp', rejoin: 'Cảnh ở sạp bà Mei vẫn chạy từ câu Kemp ngỏ ý mua.' },
    mei: { name: 'Trả lời sai câu hỏi của bà Mei', rejoin: 'Bà Mei mắng "nghe bằng cả hai tai", rồi vẫn nói điều bà nghĩ.' },
  },
  steps: [
    // beat 1: the gatehouse (staged at Gus's hut: the old gatehouse is not on the map yet)
    { kind: 'goto', place: 'gus', label: 'Tới trạm gác cũ của Rico, cạnh chòi gác của Gus' },
    { kind: 'scene', at: 'gus', who: ['rico', 'tess'], lines: ['01', '02', '03', '04', '05', '06'].map(id) },
    {
      kind: 'notebook',
      call: ['07', '08', '09', '10', '11', '12', '13', '14', '15'].map(id),
      entries: NOTEBOOK,
      repeat: { name: [id('10r')], pickup: [id('11r')], time: [id('12r')], dest: [id('13r')] },
      patience: { after: 3, line: id('14r') },
    },
    { kind: 'scene', at: 'gus', who: ['rico', 'tess'], lines: [id('16'), { line: id('16b'), if: { flag: 'asked' } }, { line: id('16c'), if: { flag: 'asked' } }, id('17')] },
    // beat 2: the car's radio on the way, the kiosk, the talk in the car
    { kind: 'radio', lines: ['18', '19', '20'].map(id) },
    {
      kind: 'pickup',
      entry: 'pickup',
      places: { kiosk: 'whitlock', front: 'priya', loom: 'vivian' },
      place: 'whitlock',
      wrongPlace: { lines: [id('25e'), id('25e2')], consequence: 'door' },
      gone: { after: 30, lines: [id('25f'), id('25f2')], consequence: 'gone' },
      arrive: [{ line: id('25c2'), if: { note: 'time', is: 'early' } }],
      crowd: ['whitlock', 'hana', 'dev', 'kemp'],
      passenger: 'kemp',
      ask: [{ line: id('21'), if: NAME('kemp') }, { line: id('21-ken'), if: NAME('ken') }, { line: id('21-kent'), if: NAME('kent') }],
      notMe: { whitlock: [id('22')], hana: [id('23')], dev: [id('24'), { line: id('24k'), if: NAME('ken') }] },
      wrongPerson: 'wrongPerson',
      greet: [
        { line: id('25a'), if: { all: [{ note: 'name', is: 'right' }, { note: 'time', is: 'right' }, { not: { flag: 'late' } }] } },
        { line: id('25b'), if: { note: 'name', is: 'wrong' } },
        { line: id('25c'), if: { note: 'time', is: 'early' } },
        { line: id('25d'), if: { any: [{ note: 'time', is: 'late' }, { flag: 'late' }] } },
      ],
    },
    {
      kind: 'ride',
      if: { not: { hit: 'gone' } },
      entry: 'dest',
      places: { mei: 'mei', fay: 'fay', stage: 'marcus' },
      place: 'mei',
      talk: [
        id('26'),
        {
          intent: {
            who: 'kemp',
            ask: [],
            options: [
              { label: 'Đùa cho qua', say: id('27a'), reply: [id('28a')] },
              { label: 'Không kể', say: id('27b'), reply: [id('28b')] },
              { label: 'Nói thật', say: id('27c'), reply: [id('28c')], flag: 'kemp-knows-unpaid' },
            ],
          },
        },
        id('29'),
        id('30'),
        id('31'),
        id('32'),
        id('33'),
        id('33b'),
        id('34'),
        {
          intent: {
            who: 'kemp',
            ask: [],
            options: [
              { label: 'Từ chối', say: id('35a'), reply: [id('36a')] },
              { label: 'Hỏi Bayline là ai', say: id('35b'), reply: [id('36b')] },
              { label: 'Để nghĩ đã', say: id('35c'), reply: [id('36c')], flag: 'kemp-asks-again' },
            ],
          },
        },
      ],
      arrive: { mei: [id('39')], fay: [id('37'), id('38')], stage: [id('38b')] },
      wrongStop: 'wrongStop',
    },
    { kind: 'goto', place: 'mei', label: 'Tới sạp há cảo của bà Mei', if: LATE_AT_STALL },
    // beat 3: the stall; Kemp never minds being heard (he never "notices": he knew all along)
    { kind: 'overhear', at: 'mei', who: ['kemp', 'mei'], lines: ['40', '41', '42', '43', '43b', '44', '45', '46', '47', '48'].map(id), passes: 1, from: { if: LATE_AT_STALL, index: 3 } },
    {
      kind: 'intent',
      who: 'mei',
      ask: [id('49')],
      options: [
        { label: 'Mua sạp của bà', say: id('49a'), reply: [id('50a')] },
        { label: 'Chỉ mua há cảo', say: id('49b'), reply: [id('50b'), id('51')] },
        { label: 'Rủ bà làm cho Bayline', say: id('49c'), reply: [id('50c'), id('51')] },
      ],
      check: { right: 0, consequence: 'mei', fact: 'want' },
    },
    // beat 4: Rico rings; the learner gives the name noted
    {
      kind: 'phone',
      lines: [
        id('52'),
        { line: id('52-kemp'), if: NAME('kemp') },
        { line: id('52-ken'), if: NAME('ken') },
        { line: id('52-kent'), if: NAME('kent') },
        { line: id('53'), if: NAME('kemp') },
        { line: id('53b'), if: NAME('ken') },
        { line: id('53c'), if: NAME('kent') },
      ],
    },
  ],
  ending: {
    clean: [id('S1'), id('S2')],
    messy: [id('L1'), id('L2')],
    broken: [{ line: id('H1'), if: { hit: 'gone' } }, id('H2'), id('H2b')],
  },
  news: {
    clean: [id('N1'), id('N1b')],
    messy: [id('N2')],
    broken: [{ line: id('N3'), if: { hit: 'gone' } }, { line: id('N2'), if: { not: { hit: 'gone' } } }],
  },
};
