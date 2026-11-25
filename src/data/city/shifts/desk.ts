// "Lễ tân trụ sở với Hana" (core/town/shiftTypes.ts): a caller rings Meridian's head office on Market Street and leaves
// a message with Hana at the information desk. The learner sets who it is for, what they want and when. The people are
// Westbay's canon (docs/city.md §7: Priya, Vivian, Sarah's Monday meetings, Mr Whitlock, Dev, Hana herself). Level 1
// names only the answer; level 2 says it the way people do, with a reason; level 3 has a correction ("No, not Dev.
// It's for Vivian.") or a near sound-alike, and may name a wrong option.

import type { Level } from '../../../core/types';
import type { ShiftDef, ShiftOption, ShiftOrder } from '../../../core/town/shiftTypes';

const WHO: readonly ShiftOption[] = [
  { id: 'priya', label: 'Priya', hear: ['priya'] },
  { id: 'whitlock', label: 'Mr Whitlock', hear: ['mr whitlock', 'mister whitlock'] },
  { id: 'sarah', label: 'Sarah', hear: ['sarah'] },
  { id: 'dev', label: 'Dev', hear: ['dev'] },
  { id: 'vivian', label: 'Vivian', hear: ['vivian'] },
  { id: 'hana', label: 'Hana', hear: ['hana'] },
];

const WHAT: readonly ShiftOption[] = [
  { id: 'call', label: 'Gọi lại cho tôi', hear: ['call me back', 'ring me back'] },
  { id: 'moved', label: 'Cuộc họp đã dời', hear: ['has moved', 'has been moved', 'been moved'] },
  { id: 'parcel', label: 'Có bưu kiện ở quầy', hear: ['parcel', 'package'] },
  { id: 'late', label: 'Tôi sẽ đến muộn', hear: ['running late', 'be late', 'am late'] },
  { id: 'file', label: 'Gửi tệp cho tôi', hear: ['send the file', 'send over the file'] },
];

const WHEN: readonly ShiftOption[] = [
  { id: 'b10', label: 'Trước 10:00', hear: ['before ten'] },
  { id: 'h1130', label: '11:30', hear: ['half past eleven', 'eleven thirty'] },
  { id: 'noon', label: 'Trưa 12:00', hear: ['noon', 'midday'] },
  { id: 'h215', label: '2:15', hear: ['quarter past two', 'two fifteen'] },
  { id: 'by4', label: 'Chậm nhất 4:00', hear: ['by four'] },
  { id: 'tmrw', label: 'Sáng sớm mai', hear: ['first thing tomorrow', 'first thing'] },
];

type Who = 'priya' | 'whitlock' | 'sarah' | 'dev' | 'vivian' | 'hana';
type What = 'call' | 'moved' | 'parcel' | 'late' | 'file';
type When = 'b10' | 'h1130' | 'noon' | 'h215' | 'by4' | 'tmrw';

const o = (n: number, level: Level, gender: 'm' | 'f', text: string, vi: string, who: Who, what: What, when: When): ShiftOrder => ({
  id: `sh-desk-${n}`,
  level,
  gender: gender === 'm' ? 'male' : 'female',
  text,
  vi,
  answer: { who, what, when },
});

const ORDERS: readonly ShiftOrder[] = [
  // ── level 1: said plainly, nothing else named ──
  o(1, 1, 'f', 'Hi, this is for Priya. Could she call me back before ten?', 'Chào chị, tin này gửi Priya. Chị ấy gọi lại cho tôi trước mười giờ được không?', 'priya', 'call', 'b10'),
  o(2, 1, 'm', 'Hello, can you tell Mr Whitlock the meeting has moved to half past eleven, please?', 'Alô, chị báo ông Whitlock là cuộc họp đã dời sang mười một rưỡi giúp tôi nhé.', 'whitlock', 'moved', 'h1130'),
  o(3, 1, 'f', "Good morning, this is for Sarah. There's a parcel for her at the desk, so please collect it by four.", 'Chào buổi sáng, tin này gửi Sarah. Có một bưu kiện của cô ấy ở quầy, nhờ cô ấy tới lấy chậm nhất bốn giờ.', 'sarah', 'parcel', 'by4'),
  o(4, 1, 'm', "Hi, can you tell Vivian I'm running late? I'll be there at quarter past two.", 'Chào chị, báo Vivian giúp tôi là tôi sẽ đến muộn nhé? Hai giờ mười lăm tôi tới.', 'vivian', 'late', 'h215'),
  o(5, 1, 'f', 'Hello, could you ask Dev to send the file first thing tomorrow, please?', 'Alô, anh nhờ Dev gửi tệp cho tôi vào sáng sớm mai được không?', 'dev', 'file', 'tmrw'),
  o(6, 1, 'm', "Can you tell Hana I'm running late? I should be there by noon.", 'Chị báo Hana giúp tôi là tôi sẽ đến muộn nhé? Chắc trưa tôi tới.', 'hana', 'late', 'noon'),
  o(7, 1, 'f', 'Hi, this is for Priya. The meeting has moved to quarter past two.', 'Chào chị, tin này gửi Priya. Cuộc họp đã dời sang hai giờ mười lăm.', 'priya', 'moved', 'h215'),
  o(8, 1, 'm', 'Could you ask Mr Whitlock to call me back by four, please?', 'Chị nhờ ông Whitlock gọi lại cho tôi chậm nhất bốn giờ nhé.', 'whitlock', 'call', 'by4'),
  o(9, 1, 'f', "It's for Sarah. Please send the file before ten, if she can.", 'Tin này gửi Sarah. Nếu được, cô ấy gửi tệp trước mười giờ giúp tôi.', 'sarah', 'file', 'b10'),
  o(10, 1, 'm', "Hello, tell Dev there's a parcel waiting at the desk. Noon is fine to collect it.", 'Alô, báo Dev có một bưu kiện đang chờ ở quầy. Trưa tới lấy cũng được.', 'dev', 'parcel', 'noon'),
  o(11, 1, 'f', 'Hi, please tell Vivian the meeting has moved to half past eleven.', 'Chào chị, nhờ báo Vivian là cuộc họp đã dời sang mười một rưỡi.', 'vivian', 'moved', 'h1130'),
  o(12, 1, 'm', 'This message is for Hana. Please call me back first thing tomorrow.', 'Tin này gửi Hana. Sáng sớm mai chị gọi lại cho tôi nhé.', 'hana', 'call', 'tmrw'),
  o(13, 1, 'f', "Hello, could you tell Priya I'm running late? I'll be there by four.", 'Alô, chị báo Priya giúp tôi là tôi sẽ đến muộn nhé? Chậm nhất bốn giờ tôi tới.', 'priya', 'late', 'by4'),
  o(14, 1, 'm', 'Could you ask Mr Whitlock to send the file at quarter past two?', 'Chị nhờ ông Whitlock gửi tệp lúc hai giờ mười lăm được không?', 'whitlock', 'file', 'h215'),

  // ── level 2: said the way people say it ──
  o(15, 2, 'f', "Hi, it's about the delivery. Could you tell Sarah there's a parcel at the desk for her? She can pick it up by four.", 'Chào chị, về chuyện giao hàng. Chị báo Sarah có một bưu kiện của cô ấy ở quầy nhé? Cô ấy tới lấy chậm nhất bốn giờ.', 'sarah', 'parcel', 'by4'),
  o(16, 2, 'm', "Morning. I've got a flat tyre, so I'm running late. Can you let Vivian know I'll get there at quarter past two?", 'Chào buổi sáng. Tôi bị xẹp lốp nên sẽ đến muộn. Chị báo Vivian là hai giờ mười lăm tôi mới tới được không?', 'vivian', 'late', 'h215'),
  o(17, 2, 'f', "Hello, could you pass this to Priya? The big meeting has moved to half past eleven, and the room's changed too.", 'Alô, chị chuyển giúp Priya nhé? Cuộc họp lớn đã dời sang mười một rưỡi, và phòng họp cũng đổi nữa.', 'priya', 'moved', 'h1130'),
  o(18, 2, 'm', "I'm stuck on the motorway, so could you ask Mr Whitlock to call me back at noon? I've got my phone on.", 'Tôi đang kẹt trên đường cao tốc, chị nhờ ông Whitlock gọi lại cho tôi lúc trưa được không? Điện thoại tôi vẫn mở.', 'whitlock', 'call', 'noon'),
  o(19, 2, 'f', 'Can you ask Dev to send the file to me first thing tomorrow? My email keeps bouncing.', 'Chị nhờ Dev gửi tệp cho tôi vào sáng sớm mai được không? Thư của tôi cứ bị trả lại.', 'dev', 'file', 'tmrw'),
  o(20, 2, 'm', "Please tell Hana that I'm running late. The train's been cancelled, so I won't be in till noon.", 'Nhờ báo Hana là tôi sẽ đến muộn. Chuyến tàu bị hủy nên tới trưa tôi mới vào được.', 'hana', 'late', 'noon'),
  o(21, 2, 'f', "It's for Sarah. I've got a couple of questions about her expenses, so could she call me back before ten?", 'Tin này gửi Sarah. Tôi có vài câu hỏi về chi phí của cô ấy, nên cô ấy gọi lại cho tôi trước mười giờ được không?', 'sarah', 'call', 'b10'),
  o(22, 2, 'm', "Could you tell Dev the meeting has moved? We're gonna start at quarter past two instead.", 'Chị báo Dev là cuộc họp đã dời nhé? Thay vào đó, hai giờ mười lăm mình mới bắt đầu.', 'dev', 'moved', 'h215'),
  o(23, 2, 'f', "Hello, this is for Vivian. Her parcel from the printers is waiting at the desk. Please collect it by four, or it goes back.", 'Alô, tin này gửi Vivian. Bưu kiện của cô ấy từ nhà in đang chờ ở quầy. Nhờ cô ấy tới lấy chậm nhất bốn giờ, không thì nó bị trả lại.', 'vivian', 'parcel', 'by4'),
  o(24, 2, 'm', "Hi, can you ask Mr Whitlock to send the file before ten? The client's been asking for it all week.", 'Chào chị, chị nhờ ông Whitlock gửi tệp trước mười giờ được không? Khách hàng đòi cả tuần nay rồi.', 'whitlock', 'file', 'b10'),
  o(25, 2, 'f', "Please let Priya know I'm running late. My flight landed really late, so I'll see her first thing tomorrow.", 'Nhờ báo Priya là tôi sẽ đến muộn. Chuyến bay của tôi hạ cánh rất khuya, nên sáng sớm mai tôi mới gặp chị ấy.', 'priya', 'late', 'tmrw'),
  o(26, 2, 'm', "It's for Sarah. The Monday meeting has moved to half past eleven, and the room is booked for it.", 'Tin này gửi Sarah. Cuộc họp thứ Hai đã dời sang mười một rưỡi, và phòng đã được đặt cho giờ đó.', 'sarah', 'moved', 'h1130'),
  o(27, 2, 'f', "Hello, I'm calling for Dev. There's a parcel at the desk with his name on it, so he can grab it first thing tomorrow.", 'Alô, tôi gọi cho Dev. Có một bưu kiện đề tên anh ấy đang chờ ở quầy, sáng sớm mai anh ấy tới lấy cũng được.', 'dev', 'parcel', 'tmrw'),
  o(28, 2, 'm', "Hi, could you ask Hana to call me back at quarter past two? I'm in a meeting till then.", 'Chào chị, chị nhờ Hana gọi lại cho tôi lúc hai giờ mười lăm được không? Đến lúc đó tôi còn đang họp.', 'hana', 'call', 'h215'),

  // ── level 3: a correction, a sound-alike, a wrong option named ──
  o(29, 3, 'f', "No, not Dev. It's for Vivian. Could she call me back before ten, please?", 'Không, không phải Dev. Là gửi Vivian. Cô ấy gọi lại cho tôi trước mười giờ được không?', 'vivian', 'call', 'b10'),
  o(30, 3, 'm', "Tell Mr Whitlock the meeting has moved. Actually, make that Sarah, she's the one going. It's now at quarter past two.", 'Báo ông Whitlock là cuộc họp đã dời. À thôi, báo Sarah, cô ấy mới là người đi họp. Giờ là hai giờ mười lăm.', 'sarah', 'moved', 'h215'),
  o(31, 3, 'f', "I'm running late, so tell Priya I'll be there at noon. Actually, make it by four, the roads are awful.", 'Tôi sẽ đến muộn, nên báo Priya là trưa tôi tới. À thôi, chậm nhất bốn giờ, đường xá tệ lắm.', 'priya', 'late', 'by4'),
  o(32, 3, 'm', "It's about a parcel, no, wait, the file. Could Hana send the file first thing tomorrow, not today?", 'Là về một bưu kiện, à không, về cái tệp. Hana gửi tệp vào sáng sớm mai được không, đừng hôm nay?', 'hana', 'file', 'tmrw'),
  o(33, 3, 'f', 'Please tell Dev to call me back at half past eleven. Not half past twelve, half past eleven.', 'Nhờ báo Dev gọi lại cho tôi lúc mười một rưỡi. Không phải mười hai rưỡi, là mười một rưỡi.', 'dev', 'call', 'h1130'),
  o(34, 3, 'm', 'This is for Vivian, sorry, Priya. The meeting has been moved to quarter past two, not quarter to two.', 'Tin này gửi Vivian, xin lỗi, Priya. Cuộc họp đã dời sang hai giờ mười lăm, không phải hai giờ kém mười lăm.', 'priya', 'moved', 'h215'),
  o(35, 3, 'f', "Hi, there's a parcel for Dev at the desk. Sorry, I mean for Sarah. Please collect it by four.", 'Chào chị, có một bưu kiện của Dev ở quầy. Xin lỗi, ý tôi là của Sarah. Nhờ cô ấy tới lấy chậm nhất bốn giờ.', 'sarah', 'parcel', 'by4'),
  o(36, 3, 'm', "Could Mr Whitlock call me back before ten? No, sorry, I'm in a meeting. First thing tomorrow is better.", 'Ông Whitlock gọi lại cho tôi trước mười giờ được không? À không, xin lỗi, tôi đang họp. Sáng sớm mai thì tốt hơn.', 'whitlock', 'call', 'tmrw'),
  o(37, 3, 'f', "Tell Hana I'm running late. The train's delayed, so I'll be there at noon, not at half past eleven.", 'Báo Hana là tôi sẽ đến muộn. Tàu bị trễ, nên trưa tôi mới tới, không phải mười một rưỡi.', 'hana', 'late', 'noon'),
  o(38, 3, 'm', "Is that the desk? Good. Could you ask Vivian to send the file by four? I said four, not fourteen.", 'Đó là quầy lễ tân phải không? Tốt. Chị nhờ Vivian gửi tệp chậm nhất bốn giờ nhé? Tôi nói bốn giờ, không phải mười bốn.', 'vivian', 'file', 'by4'),
  o(39, 3, 'f', "Please tell Hana the meeting has moved to quarter past two. Oh, and it's for Dev, not Hana. Sorry!", 'Nhờ báo Hana là cuộc họp đã dời sang hai giờ mười lăm. À mà, là gửi Dev, không phải Hana. Xin lỗi nhé!', 'dev', 'moved', 'h215'),
  o(40, 3, 'm', "Morning. A parcel is waiting at the desk for Hana, not Vivian. Could she come before ten? I mean first thing tomorrow.", 'Chào buổi sáng. Có một bưu kiện đang chờ ở quầy cho Hana, không phải Vivian. Cô ấy tới trước mười giờ được không? À, ý tôi là sáng sớm mai.', 'hana', 'parcel', 'tmrw'),
];

export const DESK_SHIFT: ShiftDef = {
  id: 'desk',
  name: 'Lễ tân trụ sở với Hana',
  at: 'hana',
  blurb: 'Khách gọi tới trụ sở Meridian và để lại lời nhắn: nghe xem nhắn cho ai, nhắn gì, hạn lúc nào, rồi ghi lại trước khi khách hết kiên nhẫn.',
  slots: [
    { id: 'who', label: 'Nhắn cho', options: WHO },
    { id: 'what', label: 'Nội dung', options: WHAT },
    { id: 'when', label: 'Khi nào', options: WHEN },
  ],
  orders: ORDERS,
};
