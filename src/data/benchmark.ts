import type { BenchmarkForm } from './benchmarkTypes';

/**
 * Bài "Kiểm tra định kỳ" — 6 đề song song A–F (xem docs/progress-report.md).
 *
 * - Mỗi đề: 10 câu chép chính tả (3 câu level 1, 4 câu level 2, 3 câu level 3) + 4 đoạn nghe
 *   có một câu hỏi. Các đề được cân bằng: tổng số từ (±8%) và số hiện tượng nối âm mà
 *   decode() đánh dấu (±15%) — benchmark.test.ts kiểm tra.
 * - Câu/đoạn KHÔNG trùng với bất kỳ nội dung nào khác trong app (câu luyện, chunk, bài học,
 *   cặp âm, ví dụ giải mã) để điểm kiểm tra đo khả năng nghe câu mới, không đo trí nhớ.
 * - `text` viết chính tả chuẩn ("going to", "want to"), không chữ số, không tên riêng phải đoán:
 *   người học gõ những gì nghe được, bộ chuẩn hóa chính tả chấp nhận "gonna", "I'm", "ok"…
 * - `focus` chỉ ghi hiện tượng mà decode() thật sự đánh dấu trong câu đó.
 * - Câu hỏi: tiếng Việt, 4 lựa chọn, đúng một đáp án suy ra được chỉ từ âm thanh; vị trí đáp án
 *   đúng được rải đều trong mỗi đề; khi làm bài, thứ tự lựa chọn còn được xáo theo từng lần (checkupModel optionOrder).
 */
export const BENCHMARK_FORMS: BenchmarkForm[] = [
  // ─────────────────────────────── Đề A ───────────────────────────────
  {
    id: 'A',
    sentences: [
      { id: 'bA-s01', level: 1, text: "I'll grab a coffee on my way in.", vi: 'Mình sẽ ghé mua cà phê trên đường tới.', focus: ['contraction', 'linking', 'assimilation'] },
      { id: 'bA-s02', level: 1, text: 'Could you text me the address?', vi: 'Bạn nhắn cho mình địa chỉ được không?', focus: ['reduction', 'elision', 'linking'] },
      { id: 'bA-s03', level: 1, text: "It's kind of cold out there today.", vi: 'Hôm nay ngoài trời hơi lạnh đó.', focus: ['contraction', 'reduction', 'linking'] },
      { id: 'bA-s04', level: 2, text: "We're going to leave around six if that works for you.", vi: 'Tụi mình định đi khoảng sáu giờ, nếu bạn thấy tiện.', focus: ['contraction', 'reduction', 'linking', 'elision'] },
      { id: 'bA-s05', level: 2, text: 'Did you get a chance to look at my email?', vi: 'Bạn đã kịp xem email của mình chưa?', focus: ['reduction', 'flap-t', 'weak-form', 'linking'] },
      { id: 'bA-s06', level: 2, text: "I told him I'd call back after lunch.", vi: 'Mình đã bảo anh ấy là mình sẽ gọi lại sau bữa trưa.', focus: ['h-dropping', 'contraction', 'linking'] },
      { id: 'bA-s07', level: 2, text: "There's a lot of traffic on the bridge this morning.", vi: 'Sáng nay trên cầu kẹt xe quá.', focus: ['contraction', 'reduction', 'linking'] },
      { id: 'bA-s08', level: 3, text: 'I was going to text her, but I forgot to charge my phone last night.', vi: 'Mình định nhắn cho cô ấy, nhưng tối qua quên sạc điện thoại.', focus: ['reduction', 'h-dropping', 'flap-t', 'elision'] },
      { id: 'bA-s09', level: 3, text: 'If you want to tag along, just send me a message by tomorrow afternoon.', vi: 'Nếu bạn muốn đi cùng thì cứ nhắn cho mình chậm nhất là chiều mai nhé.', focus: ['reduction', 'elision', 'linking'] },
      { id: 'bA-s10', level: 3, text: 'What are you doing this weekend? We should get together and watch a movie.', vi: 'Cuối tuần này bạn làm gì? Tụi mình nên gặp nhau xem phim đi.', focus: ['reduction', 'linking', 'elision'] },
    ],
    questions: [
      {
        id: 'bA-q1',
        lines: ["Hey, it's me. I'm running late, so go ahead and start without me.", "I'll be there in about twenty minutes."],
        question: 'Người gọi muốn bạn làm gì?',
        options: ['Chờ người gọi tới rồi mới bắt đầu', 'Cứ bắt đầu trước, không cần chờ', 'Hủy buổi hẹn hôm nay', 'Gọi lại cho người gọi'],
        answer: 1,
        why: "Câu 'go ahead and start without me' nghe như 'go-wə-head-n start without me': cứ bắt đầu, không cần chờ. 'I'll be there in about twenty minutes' chỉ báo giờ tới.",
        focus: ['linking', 'contraction'],
      },
      {
        id: 'bA-q2',
        lines: ['Attention, passengers. The train to the airport is running about ten minutes late.', 'Please stay behind the yellow line until it comes to a complete stop.'],
        question: 'Chuyến tàu đi sân bay thế nào?',
        options: ['Bị hủy', 'Đến đúng giờ', 'Trễ khoảng mười phút', 'Đổi sang sân ga khác'],
        answer: 2,
        why: "'is running about ten minutes late': 'running about' nối thành 'ru-ning-ə-bout', 'ten minutes' nghe như 'tem mi-nits'. Không có từ nào nói hủy hay đổi sân ga.",
        focus: ['linking', 'assimilation'],
      },
      {
        id: 'bA-q3',
        lines: ["So I can't make it on Saturday, I've got to work.", "But I can come on Sunday if you're still free."],
        // "maykid on": "it" after a silent-e verb cannot be glued by the generator ("id" alone is read I-D)
        say: ["So I can't maykid on Saturday, I've got to work.", "Buddai kin come on Sunday if you're still free."],
        question: 'Người nói có thể đến vào ngày nào?',
        options: ['Chủ nhật', 'Thứ bảy', 'Cả thứ bảy lẫn chủ nhật', 'Không ngày nào'],
        answer: 0,
        why: "'I can't make it on Saturday' — 'can't' nhấn, nguyên âm /æ/ mở và dài; còn 'I can come on Sunday' — 'can' đọc yếu, ngắn thành 'kən'. Vậy chỉ đến được chủ nhật.",
        focus: ['contraction', 'weak-form'],
      },
      {
        id: 'bA-q4',
        lines: ['To reset it, just hold down the power button for about ten seconds.', 'Then let it go and wait for the light to turn green.'],
        question: 'Cần giữ nút nguồn trong bao lâu?',
        options: ['Khoảng hai giây', 'Khoảng năm giây', 'Cho đến khi đèn tắt', 'Khoảng mười giây'],
        answer: 3,
        why: "'hold down the power button for about ten seconds': 'for about' nối thành 'fə-rə-bout'. Đèn chỉ được nhắc ở bước sau: thả nút rồi chờ đèn chuyển xanh, không có chuyện giữ đến khi đèn tắt.",
        focus: ['linking', 'weak-form'],
      },
    ],
  },

  // ─────────────────────────────── Đề B ───────────────────────────────
  {
    id: 'B',
    sentences: [
      { id: 'bB-s01', level: 1, text: 'Let me check my schedule for next week.', vi: 'Để mình xem lịch tuần sau đã.', focus: ['reduction', 'elision', 'weak-form'] },
      { id: 'bB-s02', level: 1, text: "I can't find my keys anywhere.", vi: 'Mình tìm chìa khóa khắp nơi mà không thấy.', focus: ['contraction', 'elision', 'linking'] },
      { id: 'bB-s03', level: 1, text: 'Do you want to split a pizza?', vi: 'Bạn có muốn chia nhau một cái pizza không?', focus: ['reduction', 'flap-t', 'weak-form'] },
      { id: 'bB-s04', level: 2, text: 'I think we got off at the wrong stop.', vi: 'Hình như tụi mình xuống nhầm trạm rồi.', focus: ['flap-t', 'linking', 'weak-form'] },
      { id: 'bB-s05', level: 2, text: 'Would you mind turning the music down a little?', vi: 'Bạn vặn nhỏ nhạc xuống một chút được không?', focus: ['reduction', 'elision', 'flap-t', 'linking'] },
      { id: 'bB-s06', level: 2, text: "She said she'd meet us out in front of the hotel.", vi: 'Cô ấy nói sẽ gặp tụi mình ở trước cửa khách sạn.', focus: ['contraction', 'flap-t', 'linking'] },
      { id: 'bB-s07', level: 2, text: 'I have to pick up a few things at the store.', vi: 'Mình phải ghé cửa hàng mua vài thứ.', focus: ['reduction', 'linking', 'weak-form'] },
      { id: 'bB-s08', level: 3, text: 'Our flight was supposed to land at nine, but it got pushed back an hour.', vi: 'Chuyến bay của tụi mình lẽ ra hạ cánh lúc chín giờ, nhưng bị lùi lại một tiếng.', focus: ['reduction', 'weak-form', 'elision', 'linking'] },
      { id: 'bB-s09', level: 3, text: "Tell her I'm running a bit late and I'll be there in ten minutes.", vi: 'Nói với cô ấy là mình hơi trễ, mười phút nữa mình tới.', focus: ['h-dropping', 'contraction', 'flap-t', 'assimilation'] },
      { id: 'bB-s10', level: 3, text: 'Where did you put the charger? I need to get it before we head out.', vi: 'Bạn để cục sạc đâu rồi? Mình phải lấy nó trước khi tụi mình ra ngoài.', focus: ['reduction', 'flap-t'] },
    ],
    questions: [
      {
        id: 'bB-q1',
        lines: ['Hi, this is a message from the clinic.', 'We need to move your appointment from Tuesday morning to Thursday afternoon.', "Give us a call back if that doesn't work for you."],
        question: 'Lịch hẹn được dời sang khi nào?',
        options: ['Sáng thứ ba', 'Chiều thứ năm', 'Đầu tuần sau', 'Giữ nguyên lịch cũ'],
        answer: 1,
        why: "'from Tuesday morning to Thursday afternoon': 'to' đọc yếu thành 'tə'. Lịch cũ là sáng thứ ba, lịch mới là chiều thứ năm: nghe kỹ 'Tues-' (âm /t/) và 'Thurs-' (âm /θ/).",
        focus: ['weak-form', 'linking'],
      },
      {
        id: 'bB-q2',
        lines: ["I was going to drive, but my car's in the shop.", "So I'm just going to take the bus and meet you there."],
        question: 'Người nói sẽ đến bằng phương tiện gì?',
        options: ['Tự lái xe', 'Đi taxi', 'Đi bộ', 'Đi xe buýt'],
        answer: 3,
        why: "'I'm just going to take the bus' (nói nhanh thường thành 'jus gonna'): người nói sẽ đi xe buýt. Xe hơi đang ở tiệm sửa ('in the shop') nên không lái được.",
        focus: ['reduction', 'elision'],
      },
      {
        id: 'bB-q3',
        lines: ['The store will be closing in fifteen minutes.', 'Please bring your items to the front and have a good night.'],
        question: 'Thông báo nói gì?',
        options: ['Cửa hàng sắp đóng cửa', 'Cửa hàng vừa mở cửa', 'Đang có chương trình giảm giá', 'Quầy thanh toán bị hỏng'],
        answer: 0,
        why: "'will be closing in fifteen minutes': 'closing in' nối thành 'clo-sing-in', nghĩa là mười lăm phút nữa đóng cửa; 'bring your items to the front' là mang hàng ra quầy.",
        focus: ['linking', 'weak-form'],
      },
      {
        id: 'bB-q4',
        lines: ['First, fill it up with water and put the filter in.', "Don't add the coffee until the water's hot, or it'll taste bitter."],
        question: 'Khi nào thì cho cà phê vào?',
        options: ['Trước khi đổ nước', 'Cùng lúc với bộ lọc', 'Khi nước đã nóng', 'Sau khi pha xong'],
        answer: 2,
        why: "'Don't add the coffee until the water's hot': 'water' có T bật nhẹ thành 'wa-der', 'until' đọc nhanh 'ən-til'.",
        focus: ['flap-t', 'contraction'],
      },
    ],
  },

  // ─────────────────────────────── Đề C ───────────────────────────────
  {
    id: 'C',
    sentences: [
      { id: 'bC-s01', level: 1, text: "I'm going to grab some lunch.", vi: 'Mình đi ăn trưa đây.', focus: ['reduction', 'weak-form'] },
      { id: 'bC-s02', level: 1, text: "I'll meet you down in the lobby.", vi: 'Mình sẽ gặp bạn ở dưới sảnh.', focus: ['contraction', 'assimilation', 'linking'] },
      { id: 'bC-s03', level: 1, text: "That's not what I ordered at all.", vi: 'Đây hoàn toàn không phải món mình gọi.', focus: ['contraction', 'flap-t', 'linking'] },
      { id: 'bC-s04', level: 2, text: 'Can I get a large green tea with no sugar?', vi: 'Cho mình một ly trà xanh cỡ lớn, không đường.', focus: ['weak-form', 'linking', 'flap-t'] },
      { id: 'bC-s05', level: 2, text: "He said he'd send it over first thing in the morning.", vi: 'Anh ấy nói sáng mai sẽ gửi qua ngay đầu giờ.', focus: ['contraction', 'linking', 'flap-t', 'elision'] },
      { id: 'bC-s06', level: 2, text: 'We ran out of milk, so I got some on the way home.', vi: 'Nhà hết sữa nên mình đã mua một ít trên đường về.', focus: ['reduction', 'linking', 'weak-form'] },
      { id: 'bC-s07', level: 2, text: 'How did you get here so fast? Did you take a cab?', vi: 'Sao bạn tới nhanh vậy? Bạn đi taxi à?', focus: ['reduction', 'linking'] },
      { id: 'bC-s08', level: 3, text: "I've been meaning to ask you about it, but I kept forgetting.", vi: 'Mình định hỏi bạn chuyện đó lâu rồi mà cứ quên hoài.', focus: ['contraction', 'flap-t', 'linking', 'elision'] },
      { id: 'bC-s09', level: 3, text: "You don't have to bring anything, but a bottle of water would be nice.", vi: 'Bạn không cần mang gì đâu, nhưng có chai nước thì tốt.', focus: ['reduction', 'flap-t', 'weak-form', 'elision'] },
      { id: 'bC-s10', level: 3, text: "I let him know we'll be a little late because of the rain.", vi: 'Mình đã báo anh ấy là tụi mình sẽ trễ một chút vì trời mưa.', focus: ['h-dropping', 'contraction', 'flap-t', 'reduction'] },
    ],
    questions: [
      {
        id: 'bC-q1',
        lines: ["Hey, it's me again. I left my jacket at your place last night.", 'Could you bring it to work tomorrow? Thanks.'],
        question: 'Người gọi nhờ bạn việc gì?',
        options: ['Mang áo khóac của người gọi đến chỗ làm', 'Giặt giúp người gọi cái áo khóac', 'Mua cho người gọi một áo khóac mới', 'Ghé nhà người gọi để lấy áo khóac'],
        answer: 0,
        why: "'I left my jacket at your place' và 'Could you bring it to work tomorrow?': 'could you' khi nói nhanh thường thành 'cudja', 'bring it' nối thành 'brin-git'.",
        focus: ['reduction', 'linking'],
      },
      {
        id: 'bC-q2',
        lines: ['We were planning to go hiking this weekend.', "But it's supposed to rain, so we'll probably just stay in and watch movies."],
        question: 'Cuối tuần này nhiều khả năng họ sẽ làm gì?',
        options: ['Đi leo núi', 'Ở nhà xem phim', 'Ra rạp xem phim', 'Đi mua sắm'],
        answer: 1,
        why: "'it's supposed to rain' (nói nhanh thường thành 'spohsta') nên bỏ leo núi; 'we'll probably just stay in and watch movies': 'stay in' nối thành 'stay-yin', nghĩa là ở nhà.",
        focus: ['reduction', 'linking', 'contraction'],
      },
      {
        id: 'bC-q3',
        lines: ["Good morning, everyone. Today's meeting has been moved to the small room on the second floor.", "We'll start at ten instead of nine thirty."],
        question: 'Cuộc họp hôm nay bắt đầu lúc mấy giờ?',
        options: ['Chín giờ', 'Chín giờ rưỡi', 'Mười giờ', 'Mười giờ rưỡi'],
        answer: 2,
        why: "'We'll start at ten instead of nine thirty': 'start at' có T bật thành 'star-dat', 'instead of' nối thành 'in-ste-dəv'. Chín giờ rưỡi là giờ cũ.",
        focus: ['flap-t', 'linking'],
      },
      {
        id: 'bC-q4',
        lines: ['When you get to the parking lot, take the elevator up to the third floor.', 'Our office is the second door on the left.'],
        question: 'Văn phòng nằm ở đâu?',
        options: ['Tầng hai, cửa đầu tiên bên phải', 'Tầng một, cạnh bãi đỗ xe', 'Tầng ba, cửa đầu tiên bên trái', 'Tầng ba, cửa thứ hai bên trái'],
        answer: 3,
        why: "'take the elevator up to the third floor' rồi 'the second door on the left': 'door on' nối thành 'doo-ron', 'elevator up' nối thành 'e-le-vay-də-rup'.",
        focus: ['linking', 'weak-form'],
      },
    ],
  },

  // ─────────────────────────────── Đề D ───────────────────────────────
  {
    id: 'D',
    sentences: [
      { id: 'bD-s01', level: 1, text: 'Give me a second to find it.', vi: 'Đợi mình chút, để mình tìm.', focus: ['reduction', 'elision', 'linking'] },
      { id: 'bD-s02', level: 1, text: 'Is it okay if I sit here?', vi: 'Mình ngồi đây được không?', focus: ['linking', 'flap-t'] },
      { id: 'bD-s03', level: 1, text: "We'll figure it out later on.", say: "We'll figurid out later on.", vi: 'Để sau tụi mình tính tiếp.', focus: ['contraction', 'flap-t', 'linking'] },
      { id: 'bD-s04', level: 2, text: "I don't know if the shops are still open.", vi: 'Mình không biết mấy cửa hàng còn mở không.', focus: ['reduction', 'linking'] },
      { id: 'bD-s05', level: 2, text: 'Could you hold the door for me for a second?', vi: 'Bạn giữ cửa giúp mình một chút được không?', focus: ['reduction', 'weak-form', 'elision'] },
      { id: 'bD-s06', level: 2, text: "They're thinking about moving out of the city next year.", vi: 'Họ đang tính chuyển ra khỏi thành phố vào năm sau.', focus: ['contraction', 'reduction', 'flap-t', 'assimilation'] },
      { id: 'bD-s07', level: 2, text: 'I asked him to call me when he gets in.', vi: 'Mình đã dặn anh ấy về tới thì gọi cho mình.', focus: ['h-dropping', 'linking'] },
      { id: 'bD-s08', level: 3, text: 'We had to wait in line for almost an hour just to get our tickets.', vi: 'Tụi mình phải xếp hàng gần một tiếng chỉ để lấy vé.', focus: ['flap-t', 'linking', 'elision', 'weak-form'] },
      { id: 'bD-s09', level: 3, text: 'What do you want to eat for dinner? I could go for some noodles.', vi: 'Tối nay bạn muốn ăn gì? Mình thì đang thèm mì.', focus: ['reduction', 'weak-form'] },
      { id: 'bD-s10', level: 3, text: "I'm not sure I can make it, but I'll let you know by tonight.", vi: 'Mình chưa chắc đi được, nhưng trong tối nay mình sẽ báo bạn.', focus: ['weak-form', 'assimilation', 'flap-t', 'contraction'] },
    ],
    questions: [
      {
        id: 'bD-q1',
        lines: ["Hi, it's about the apartment you asked about.", "It's still available, but someone's coming to see it tomorrow.", "So if you're interested, call me back tonight."],
        question: 'Người gọi khuyên bạn làm gì?',
        options: ['Gọi lại cho người đó trong tối nay', 'Đến xem căn hộ vào sáng mai', 'Chờ vài ngày rồi gọi lại', 'Gửi tiền đặt cọc qua tin nhắn'],
        answer: 0,
        why: "'So if you're interested, call me back tonight': 'if you're' đọc lướt thành 'if-yər', 'call me back' liền một hơi. Ngày mai đã có người khác đến xem.",
        focus: ['contraction', 'linking'],
      },
      {
        id: 'bD-q2',
        lines: ["I'm not going to the party after all.", "I've had a really long week and I just want to go to bed early."],
        question: 'Vì sao người nói không đi dự tiệc?',
        options: ['Phải đi làm ca tối', 'Đang bị ốm nhẹ', 'Mệt vì một tuần dài', 'Không được mời tới'],
        answer: 2,
        why: "'I've had a really long week': một tuần dài nên mệt. 'I just want to go to bed early': 'want to' khi nói nhanh thường thành 'wanna', 'just' mất /t/.",
        focus: ['reduction', 'elision', 'contraction'],
      },
      {
        id: 'bD-q3',
        lines: ['Because of the storm, all evening classes are canceled tonight.', 'Morning classes will go ahead as usual.'],
        question: 'Lớp nào bị hủy?',
        options: ['Tất cả các lớp hôm nay', 'Chỉ các lớp buổi sáng', 'Không lớp nào', 'Các lớp buổi tối hôm nay'],
        answer: 3,
        why: "'all evening classes are canceled tonight': 'classes are' nối thành 'cla-sə-zar'. Lớp buổi sáng vẫn học bình thường ('go ahead as usual').",
        focus: ['linking', 'weak-form'],
      },
      {
        id: 'bD-q4',
        lines: ["Turn left at the second light, and you'll see a gas station.", 'Our building is right behind it.'],
        question: 'Tòa nhà nằm ở đâu?',
        options: ['Ngay phía trước trạm xăng', 'Ngay phía sau trạm xăng', 'Đối diện trạm xăng', 'Cạnh đèn giao thông thứ hai'],
        answer: 1,
        why: "'Our building is right behind it': T của 'right' gần như mất, 'behind it' nối thành 'be-hain-dit'. Nghe kỹ 'behind' (phía sau), không phải 'in front of' (phía trước).",
        focus: ['linking', 'elision'],
      },
    ],
  },

  // ─────────────────────────────── Đề E ───────────────────────────────
  {
    id: 'E',
    sentences: [
      { id: 'bE-s01', level: 1, text: "Hang on, I'm almost done here.", vi: 'Chờ chút, mình sắp xong rồi.', focus: ['linking', 'elision'] },
      { id: 'bE-s02', level: 1, text: 'Did you leave the lights on in the kitchen?', vi: 'Bạn quên tắt đèn bếp à?', focus: ['reduction', 'linking'] },
      { id: 'bE-s03', level: 1, text: 'That movie was kind of long.', vi: 'Bộ phim đó hơi dài.', focus: ['reduction', 'weak-form'] },
      { id: 'bE-s04', level: 2, text: "I'll text you the details when I get home.", vi: 'Về tới nhà mình sẽ nhắn chi tiết cho bạn.', focus: ['contraction', 'assimilation', 'linking'] },
      { id: 'bE-s05', level: 2, text: 'We should have left earlier to beat the traffic.', vi: 'Lẽ ra tụi mình nên đi sớm hơn để tránh kẹt xe.', focus: ['h-dropping', 'linking', 'weak-form'] },
      { id: 'bE-s06', level: 2, text: 'Can you put it on my card and keep the receipt?', vi: 'Bạn quẹt thẻ của mình rồi giữ lại hóa đơn nhé?', focus: ['weak-form', 'flap-t', 'assimilation'] },
      { id: 'bE-s07', level: 2, text: "There's a coffee place around the corner that opens early.", vi: 'Ở góc đường có một quán cà phê mở cửa sớm.', focus: ['contraction', 'linking', 'flap-t'] },
      { id: 'bE-s08', level: 3, text: 'I have to finish this report before I can even think about dinner.', vi: 'Mình phải làm xong bản báo cáo này rồi mới nghĩ tới chuyện ăn tối được.', focus: ['reduction', 'linking', 'weak-form'] },
      { id: 'bE-s09', level: 3, text: "He wasn't at the meeting, so I'm going to fill him in later.", vi: 'Anh ấy không dự cuộc họp nên lát nữa mình sẽ kể lại cho anh ấy.', focus: ['flap-t', 'reduction', 'h-dropping', 'linking'] },
      { id: 'bE-s10', level: 3, text: 'Do you want to try that new place across the street after work?', vi: 'Tan làm bạn có muốn thử quán mới bên kia đường không?', focus: ['reduction', 'linking', 'flap-t'] },
    ],
    questions: [
      {
        id: 'bE-q1',
        lines: ['Hey, just a quick update. The restaurant was fully booked at seven.', 'So I got us a table at eight instead. See you there.'],
        question: 'Bàn được đặt lúc mấy giờ?',
        options: ['Bảy giờ', 'Tám giờ', 'Chín giờ', 'Không đặt được bàn'],
        answer: 1,
        why: "'I got us a table at eight instead': 'got us a' nối và T bật thành 'ga-də-sə', 'at eight' thành 'ə-deight'. Bảy giờ là giờ đã kín chỗ.",
        focus: ['flap-t', 'linking'],
      },
      {
        id: 'bE-q2',
        lines: ["My sister's coming to visit next week, so I'll be pretty busy.", "Let's get together the week after instead."],
        question: 'Người nói đề nghị gặp khi nào?',
        options: ['Ngay tuần này', 'Tuần sau', 'Tuần sau nữa', 'Cuối tháng'],
        answer: 2,
        why: "Tuần sau ('next week', nghe như 'nex week') bận vì có người nhà đến chơi, nên hẹn 'the week after' — tuần sau nữa. 'get together' có T bật nhẹ thành 'ge-də-ge-ther'.",
        focus: ['elision', 'flap-t'],
      },
      {
        id: 'bE-q3',
        lines: ['Hi, everyone. The pool will be closed tomorrow for cleaning.', 'It should be open again on Monday morning.'],
        question: 'Vì sao hồ bơi đóng cửa?',
        options: ['Để vệ sinh', 'Vì thời tiết xấu', 'Vì sửa máy bơm', 'Vì có giải thi đấu'],
        answer: 0,
        why: "'closed tomorrow for cleaning': 'closed' mất /d/ trước 'tomorrow', 'for' đọc yếu thành 'fər'.",
        focus: ['elision', 'weak-form'],
      },
      {
        id: 'bE-q4',
        lines: ['The cooking class on Friday is free.', "You don't have to sign up online. Just show up a few minutes early and tell them at the front desk."],
        question: 'Muốn vào lớp nấu ăn thì cần làm gì?',
        options: ['Đăng ký trên mạng trước một ngày', 'Gọi điện cho lễ tân để giữ chỗ', 'Gửi email đăng ký rồi chờ trả lời', 'Đến sớm vài phút và báo ở quầy lễ tân'],
        answer: 3,
        why: "'You don't have to sign up online' (không cần đăng ký trên mạng; 'have to' khi nói nhanh thường thành 'hafta') và 'show up a few minutes early': 'show up a' nối thành 'show-wə-pə'.",
        focus: ['reduction', 'linking'],
      },
    ],
  },

  // ─────────────────────────────── Đề F ───────────────────────────────
  {
    id: 'F',
    sentences: [
      { id: 'bF-s01', level: 1, text: 'Let me know when you get there.', vi: 'Tới nơi thì báo mình nhé.', focus: ['reduction', 'weak-form'] },
      { id: 'bF-s02', level: 1, text: "What's the best way to get downtown?", vi: 'Đi vào trung tâm thành phố bằng đường nào tiện nhất?', focus: ['contraction', 'elision', 'weak-form'] },
      { id: 'bF-s03', level: 1, text: 'Put your bag on the seat next to me.', vi: 'Để túi của bạn lên ghế cạnh mình đi.', focus: ['assimilation', 'linking', 'elision'] },
      { id: 'bF-s04', level: 2, text: "I'm going to need two more days to finish it.", vi: 'Mình sẽ cần thêm hai ngày nữa mới làm xong.', focus: ['reduction', 'linking'] },
      { id: 'bF-s05', level: 2, text: 'Did he say what time the party starts?', say: 'Diddy say what time the party starts?', vi: 'Anh ấy có nói mấy giờ bữa tiệc bắt đầu không?', focus: ['h-dropping', 'flap-t'] },
      { id: 'bF-s06', level: 2, text: "You can't park here after eight, or you'll get a ticket.", vi: 'Sau tám giờ không được đậu xe ở đây, không thì bị phạt đó.', focus: ['contraction', 'linking', 'flap-t'] },
      { id: 'bF-s07', level: 2, text: 'I tried to call you, but it went straight to voicemail.', vi: 'Mình đã gọi cho bạn, nhưng máy chuyển thẳng vào hộp thư thoại.', focus: ['flap-t', 'elision', 'weak-form'] },
      { id: 'bF-s08', level: 3, text: "It's a lot of work, but I think it's going to pay off in the end.", vi: 'Việc này nhiều lắm, nhưng mình nghĩ cuối cùng sẽ đáng công.', focus: ['contraction', 'reduction', 'flap-t', 'linking'] },
      { id: 'bF-s09', level: 3, text: 'Did you remember to turn off the oven before we left the house?', vi: 'Bạn có nhớ tắt lò trước khi tụi mình ra khỏi nhà không?', focus: ['reduction', 'linking', 'elision'] },
      { id: 'bF-s10', level: 3, text: "I'd love to help, but I've already got plans with my sister tonight.", say: "I'd love to help, buddive already got plans with my sister tonight.", vi: 'Mình rất muốn giúp, nhưng tối nay mình đã có hẹn với chị gái rồi.', focus: ['contraction', 'flap-t', 'linking'] },
    ],
    questions: [
      {
        id: 'bF-q1',
        lines: ["Hi, I'm calling about the package you ordered.", 'We tried to drop it off this afternoon, but nobody was home.', "We'll try again tomorrow between ten and noon."],
        question: 'Khi nào gói hàng được giao lại?',
        options: ['Chiều nay, ngay sau giờ làm', 'Ngày mai, từ mười giờ đến trưa', 'Chiều mai, từ một đến ba giờ', 'Tuần sau, vào buổi sáng'],
        answer: 1,
        why: "'We'll try again tomorrow between ten and noon': 'try again' nối thành 'try-yə-gen', 'ten and noon' thành 'ten-ən-noon'. Chiều nay là lần giao không có ai ở nhà.",
        focus: ['linking', 'weak-form'],
      },
      {
        id: 'bF-q2',
        lines: ["I was going to cook tonight, but I'm too tired.", "Let's just order something and eat in front of the TV."],
        question: 'Tối nay họ sẽ ăn thế nào?',
        options: ['Người nói tự nấu', 'Ra nhà hàng ăn', 'Gọi đồ ăn về nhà', 'Bỏ bữa tối'],
        answer: 2,
        why: "'I was going to cook' (nói nhanh thường thành 'gonna') nghĩa là định nấu nhưng thôi; 'Let's just order something' là gọi đồ ăn về: 'just order' nối liền thành 'jus-tor-der', 'eat in front' nối thành 'ea-din front'.",
        focus: ['reduction', 'linking'],
      },
      {
        id: 'bF-q3',
        lines: ["Attention, shoppers. Our pharmacy closes early today, at five o'clock.", 'The rest of the store is open until ten.'],
        question: 'Hôm nay quầy thuốc đóng cửa lúc mấy giờ?',
        options: ['Năm giờ', 'Mười giờ', 'Chín giờ', 'Sáu giờ'],
        answer: 0,
        why: "'Our pharmacy closes early today, at five o'clock': 'closes early' nối thành 'clo-sə-zer-ly', 'five o'clock' thành 'fai-və-clock'. Mười giờ là giờ đóng của phần còn lại của cửa hàng.",
        focus: ['linking', 'weak-form'],
      },
      {
        id: 'bF-q4',
        lines: ["If the screen freezes, don't turn it off.", "Just wait a minute, and it'll usually fix itself."],
        question: 'Khi màn hình bị đơ thì nên làm gì?',
        options: ['Tắt máy rồi bật lại ngay', 'Rút dây sạc ra rồi cắm lại', 'Gọi bộ phận kỹ thuật đến sửa', 'Chờ một chút, máy thường tự chạy lại'],
        answer: 3,
        why: "'don't turn it off' là đừng tắt máy; 'Just wait a minute': 'wait a' có T bật thành 'wai-də', 'it'll' đọc thành 'i-dəl'.",
        focus: ['flap-t', 'contraction'],
      },
    ],
  },
];
