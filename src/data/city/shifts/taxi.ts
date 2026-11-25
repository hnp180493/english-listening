// "Tổng đài taxi của Rico" (core/town/shiftTypes.ts): callers phone the rank at Central Station and ask for a car.
// The learner sets where from, where to and when. Places and times are Westbay's canon (docs/city.md: the last bus
// back to the town is at ten fifteen). Level 1 names only the answer; level 2 says it the way people do; level 3 has
// a change of mind, a sound-alike ("fifteen" / "fifty") or two reductions, and may name a wrong option.

import type { Level } from '../../../core/types';
import type { ShiftDef, ShiftOption, ShiftOrder } from '../../../core/town/shiftTypes';

const PLACES: readonly ShiftOption[] = [
  { id: 'station', label: 'Central Station', hear: ['central station', 'the station'] },
  { id: 'lumen', label: 'Rạp Lumen', hear: ['the lumen'] },
  { id: 'giannas', label: "Gianna's", hear: ["gianna's"] },
  { id: 'market', label: 'Chợ cũ', hear: ['the old market', 'the market'] },
  { id: 'bayfm', label: 'Bay FM', hear: ['bay fm'] },
  { id: 'bookshop', label: 'Hiệu sách', hear: ['the bookshop', 'harbour press'] },
  { id: 'bos', label: "Bo's", hear: ["bo's"] },
  { id: 'seafront', label: 'Bờ biển', hear: ['the seafront', 'the promenade'] },
];

const TIMES: readonly ShiftOption[] = [
  { id: 'now', label: 'Ngay bây giờ', hear: ['right now', 'right away', 'as soon as you can', 'as soon as possible'] },
  { id: 'in10', label: '10 phút nữa', hear: ['in ten minutes', 'ten minutes'] },
  { id: 'h730', label: '7:30', hear: ['half past seven', 'seven thirty', 'half seven'] },
  { id: 'h800', label: '8:00', hear: ["eight o'clock", 'eight sharp', 'eight on the dot'] },
  { id: 'h845', label: '8:45', hear: ['quarter to nine', 'eight forty five'] },
  { id: 'h915', label: '9:15', hear: ['quarter past nine', 'nine fifteen'] },
  { id: 'h1015', label: '10:15', hear: ['ten fifteen', 'quarter past ten'] },
];

type Place = 'station' | 'lumen' | 'giannas' | 'market' | 'bayfm' | 'bookshop' | 'bos' | 'seafront';
type Time = 'now' | 'in10' | 'h730' | 'h800' | 'h845' | 'h915' | 'h1015';

const o = (n: number, level: Level, gender: 'm' | 'f', text: string, vi: string, from: Place, to: Place, when: Time): ShiftOrder => ({
  id: `sh-taxi-${n}`,
  level,
  gender: gender === 'm' ? 'male' : 'female',
  text,
  vi,
  answer: { from, to, when },
});

const ORDERS: readonly ShiftOrder[] = [
  // ── level 1: said plainly, nothing else named ──
  o(1, 1, 'f', "Hi, can you pick me up from the Lumen at half past seven? I'm going to Central Station.", 'Chào anh, đón tôi ở rạp Lumen lúc bảy rưỡi được không? Tôi đi Central Station.', 'lumen', 'station', 'h730'),
  o(2, 1, 'm', 'I need a taxi from the bookshop to Gianna\'s, right now please.', "Tôi cần một chiếc taxi từ hiệu sách tới Gianna's, ngay bây giờ nhé.", 'bookshop', 'giannas', 'now'),
  o(3, 1, 'f', "Could you send a car to Bo's at ten fifteen? I'm going to the station.", "Anh cho một xe tới Bo's lúc mười giờ mười lăm được không? Tôi ra ga.", 'bos', 'station', 'h1015'),
  o(4, 1, 'm', 'Hello, a taxi from the old market to the seafront in ten minutes, please.', 'Alô, cho một taxi từ chợ cũ ra bờ biển, mười phút nữa nhé.', 'market', 'seafront', 'in10'),
  o(5, 1, 'f', "Can I book a cab from Bay FM to the Lumen for eight o'clock?", 'Tôi đặt một xe từ Bay FM tới rạp Lumen lúc tám giờ được không?', 'bayfm', 'lumen', 'h800'),
  o(6, 1, 'm', "Hi, I'm at Central Station. Can you take me to the bookshop right away?", 'Chào anh, tôi đang ở Central Station. Chở tôi tới hiệu sách ngay được không?', 'station', 'bookshop', 'now'),
  o(7, 1, 'f', "Please pick me up at the seafront at quarter to nine and take me to Bo's.", "Đón tôi ở bờ biển lúc chín giờ kém mười lăm rồi chở tôi tới Bo's nhé.", 'seafront', 'bos', 'h845'),
  o(8, 1, 'm', "A taxi from Gianna's to the old market at quarter past nine, please.", "Cho một taxi từ Gianna's tới chợ cũ lúc chín giờ mười lăm nhé.", 'giannas', 'market', 'h915'),
  o(9, 1, 'f', "Could you pick me up from the bookshop in ten minutes? I'm going to Bay FM.", 'Mười phút nữa anh đón tôi ở hiệu sách được không? Tôi đi Bay FM.', 'bookshop', 'bayfm', 'in10'),
  o(10, 1, 'm', 'Hi, I need a car from the Lumen to the seafront at ten fifteen.', 'Chào anh, tôi cần một xe từ rạp Lumen ra bờ biển lúc mười giờ mười lăm.', 'lumen', 'seafront', 'h1015'),
  o(11, 1, 'f', 'Can you take me from the old market to Central Station at half past seven?', 'Anh chở tôi từ chợ cũ tới Central Station lúc bảy rưỡi được không?', 'market', 'station', 'h730'),
  o(12, 1, 'm', "I'm at Bo's. Can you take me to Gianna's at eight o'clock, please?", "Tôi đang ở Bo's. Tám giờ anh chở tôi tới Gianna's được không?", 'bos', 'giannas', 'h800'),
  o(13, 1, 'f', 'Hello, a cab from the station to Bay FM as soon as you can, please.', 'Alô, cho một xe từ ga tới Bay FM, càng sớm càng tốt nhé.', 'station', 'bayfm', 'now'),
  o(14, 1, 'm', 'Pick me up from the seafront at quarter past nine and take me to the old market, please.', 'Chín giờ mười lăm đón tôi ở bờ biển rồi chở tôi tới chợ cũ nhé.', 'seafront', 'market', 'h915'),

  // ── level 2: said the way people say it ──
  o(15, 2, 'f', "It's for my mum. She's at the bookshop and needs to get to the Lumen. Could you get her at seven thirty?", 'Gọi cho mẹ tôi. Bà đang ở hiệu sách và cần tới rạp Lumen. Bảy rưỡi anh đón bà được không?', 'bookshop', 'lumen', 'h730'),
  o(16, 2, 'm', "I've got a heavy bag, so can you get me from Gianna's at eight forty-five and drop me at the station?", "Tôi có cái túi nặng, nên chín giờ kém mười lăm anh đón tôi ở Gianna's rồi thả tôi ở ga được không?", 'giannas', 'station', 'h845'),
  o(17, 2, 'f', "We're just finishing dinner at Gianna's. Could you come at nine fifteen and take us down to the seafront?", "Chúng tôi sắp ăn tối xong ở Gianna's. Chín giờ mười lăm anh tới chở chúng tôi xuống bờ biển được không?", 'giannas', 'seafront', 'h915'),
  o(18, 2, 'm', 'My show at Bay FM ends at eight sharp. Can you be outside then and take me home to the old market?', 'Chương trình của tôi ở Bay FM xong đúng tám giờ. Lúc đó anh đợi ở ngoài rồi chở tôi về chợ cũ được không?', 'bayfm', 'market', 'h800'),
  o(19, 2, 'f', "Can you grab me from Bo's in ten minutes? I want to get to the bookshop before it closes.", "Mười phút nữa anh đón tôi ở Bo's được không? Tôi muốn tới hiệu sách trước khi nó đóng cửa.", 'bos', 'bookshop', 'in10'),
  o(20, 2, 'm', "I'm outside the Lumen with two tired kids. We need to get to Central Station right away.", 'Tôi đang đứng ngoài rạp Lumen với hai đứa nhỏ mệt rã. Chúng tôi cần tới Central Station ngay.', 'lumen', 'station', 'now'),
  o(21, 2, 'f', "Hi, it's Mrs Bell from the old market. Could you take me to Bo's at half seven tonight?", "Chào anh, bà Bell ở chợ cũ đây. Tối nay bảy rưỡi anh chở tôi tới Bo's được không?", 'market', 'bos', 'h730'),
  o(22, 2, 'm', "I'm on the promenade by the ice cream van. Could you run me to Bay FM at quarter to nine?", 'Tôi đang ở đường dạo bờ biển, cạnh xe kem. Chín giờ kém mười lăm anh chở tôi tới Bay FM được không?', 'seafront', 'bayfm', 'h845'),
  o(23, 2, 'f', "I've just missed the bus at Central Station. Can someone take me to Gianna's in ten minutes?", "Tôi vừa lỡ chuyến xe buýt ở Central Station. Mười phút nữa có ai chở tôi tới Gianna's được không?", 'station', 'giannas', 'in10'),
  o(24, 2, 'm', "Could you come to the bookshop at eight on the dot? I'm meeting friends at the seafront.", 'Anh tới hiệu sách đúng tám giờ được không? Tôi gặp bạn ở bờ biển.', 'bookshop', 'seafront', 'h800'),
  o(25, 2, 'f', 'My train gets into Central Station at ten fifteen. Could you meet me there and take me to the old market?', 'Tàu của tôi về Central Station lúc mười giờ mười lăm. Anh đón tôi ở đó rồi chở tới chợ cũ được không?', 'station', 'market', 'h1015'),
  o(26, 2, 'm', "We're at Bo's and we've sung far too much. Could you take us to the Lumen as soon as possible?", "Chúng tôi đang ở Bo's và hát nhiều quá rồi. Anh chở chúng tôi tới rạp Lumen càng sớm càng tốt được không?", 'bos', 'lumen', 'now'),
  o(27, 2, 'f', 'Hi, this is the studio at Bay FM. We need a car at nine fifteen to take a guest to the bookshop.', 'Chào anh, đây là phòng thu Bay FM. Chúng tôi cần một xe lúc chín giờ mười lăm để đưa một vị khách tới hiệu sách.', 'bayfm', 'bookshop', 'h915'),
  o(28, 2, 'm', "Could you collect me from the seafront at half past seven? I've got a table booked at Gianna's.", "Bảy rưỡi anh đón tôi ở bờ biển được không? Tôi đã đặt bàn ở Gianna's.", 'seafront', 'giannas', 'h730'),

  // ── level 3: a change of mind, a sound-alike, two reductions ──
  o(29, 3, 'f', "Pick me up from the station at quarter to nine. No, sorry, quarter past nine. I'm going to the Lumen.", 'Đón tôi ở ga lúc chín giờ kém mười lăm. À không, xin lỗi, chín giờ mười lăm. Tôi tới rạp Lumen.', 'station', 'lumen', 'h915'),
  o(30, 3, 'm', "I'm at Bo's and I need to get to the bookshop. Actually, no, make that the old market. Right away, please.", "Tôi đang ở Bo's và cần tới hiệu sách. À thôi, chở tôi tới chợ cũ đi. Ngay bây giờ nhé.", 'bos', 'market', 'now'),
  o(31, 3, 'f', "Gianna's to the station, please. Not in ten minutes, sorry, I mean at ten fifteen, after dessert.", "Từ Gianna's ra ga nhé. Không phải mười phút nữa đâu, xin lỗi, ý tôi là mười giờ mười lăm, sau món tráng miệng.", 'giannas', 'station', 'h1015'),
  o(32, 3, 'm', "I've got to get from Bay FM to Gianna's, and I want to leave right now. Can you do that?", "Tôi phải đi từ Bay FM tới Gianna's, và tôi muốn đi ngay bây giờ. Anh làm được không?", 'bayfm', 'giannas', 'now'),
  o(33, 3, 'f', "Was it eight o'clock? No, my husband says half past seven. From the bookshop to the seafront, please.", 'Tám giờ phải không? Không, chồng tôi bảo bảy rưỡi. Từ hiệu sách ra bờ biển nhé.', 'bookshop', 'seafront', 'h730'),
  o(34, 3, 'm', "From the old market to the Lumen, please. Oh, no, the film's been moved. Take me to Bo's instead, in ten minutes?", "Từ chợ cũ tới rạp Lumen nhé. Ôi không, phim đổi giờ rồi. Chở tôi tới Bo's thay vào đó, mười phút nữa nhé?", 'market', 'bos', 'in10'),
  o(35, 3, 'f', "Ten fifteen at the station, please. Not quarter past nine, that's the old time. I'm going home to the seafront.", 'Mười giờ mười lăm ở ga nhé. Không phải chín giờ mười lăm, đó là giờ cũ. Tôi về nhà ở bờ biển.', 'station', 'seafront', 'h1015'),
  o(36, 3, 'm', "I'm at the Lumen, no, I'm walking to the bookshop now. Get me there at quarter to nine, then on to Bay FM.", 'Tôi đang ở rạp Lumen, à không, tôi đang đi bộ tới hiệu sách. Chín giờ kém mười lăm đón tôi ở đó rồi đi tiếp tới Bay FM.', 'bookshop', 'bayfm', 'h845'),
  o(37, 3, 'f', "Did you say you could do eight? Great, eight o'clock then, from Gianna's to the old market.", "Anh bảo tám giờ được à? Tốt quá, vậy tám giờ nhé, từ Gianna's tới chợ cũ.", 'giannas', 'market', 'h800'),
  o(38, 3, 'm', "We'd like to go from the seafront to the station. Could you come at nine fifteen? Not nine fifty, nine fifteen.", 'Chúng tôi muốn đi từ bờ biển ra ga. Chín giờ mười lăm anh tới được không? Không phải chín giờ năm mươi, chín giờ mười lăm.', 'seafront', 'station', 'h915'),
  o(39, 3, 'f', "Bo's, then the bookshop. Ten fifteen, yeah? I said fifteen, not fifty. Thanks, love.", "Đón ở Bo's, rồi tới hiệu sách. Mười giờ mười lăm nhé? Tôi nói mười lăm, không phải năm mươi. Cảm ơn anh.", 'bos', 'bookshop', 'h1015'),
  o(40, 3, 'm', "Could you send someone to Central Station? Sorry, the old market, I've walked on. I'm off to Bay FM, as soon as you can.", 'Anh cho ai tới Central Station được không? Xin lỗi, chợ cũ chứ, tôi đi bộ tới đây rồi. Tôi tới Bay FM, càng sớm càng tốt.', 'market', 'bayfm', 'now'),
];

export const TAXI_SHIFT: ShiftDef = {
  id: 'taxi',
  name: 'Tổng đài taxi của Rico',
  at: 'rico',
  blurb: 'Khách gọi tới bến taxi và nói nhanh như ngoài đời: nghe xem đón ở đâu, đi đâu, lúc nào, rồi chọn trước khi khách hết kiên nhẫn.',
  slots: [
    { id: 'from', label: 'Đón ở', options: PLACES },
    { id: 'to', label: 'Đi tới', options: PLACES },
    { id: 'when', label: 'Lúc nào', options: TIMES },
  ],
  orders: ORDERS,
};
