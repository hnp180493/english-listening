// office · Sarah: courtship, wedding and married life (contract: core/town/romanceTypes.ts Suitor).
// Builds on her arc (data/stories/office.ts): "only five minutes", the projector that said no signal and Max's "turn
// it off and on again", the coffee she owed, the team-leader interview after eight years, her dozens of notebooks, the
// Friday deadline, spicy noodles at the desk, the plant on her new desk upstairs. After her yes she says "em" and he
// says "anh".
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'office',
  courtedBy: 'male',
  confess: {
    id: 'office-confess',
    title: 'Chỉ cần một phút',
    scene: 'Cuối giờ chiều, văn phòng đã vắng, Sarah vẫn cắm cúi bên chồng giấy.',
    lines: [
      { who: 'them', en: "Hey! Sorry, I've only got five minutes.", vi: 'Này! Xin lỗi, tôi chỉ có năm phút thôi.' },
      { who: 'you', en: "That's fine. I only need one.", vi: 'Không sao. Tôi chỉ cần một phút.' },
      { who: 'you', en: 'These are for you. I like you, Sarah. I really do.', vi: 'Hoa này tặng bạn. Tôi thích bạn, Sarah. Thích thật lòng.' },
      { who: 'narr', vi: 'Sarah đặt chồng giấy xuống. Lần đầu tiên, cô không nhìn đồng hồ.' },
      { who: 'them', en: "Wow. Okay. This wasn't in my calendar.", vi: 'Trời. Được rồi. Chuyện này không có trong lịch của em.' },
      { who: 'them', en: "But I'm really glad you said it. I like you too.", vi: 'Nhưng em mừng lắm vì anh nói ra. Em cũng thích anh.' },
      { who: 'you', en: 'So, dinner? When you have more than five minutes?', vi: 'Vậy đi ăn tối nhé? Khi nào em rảnh hơn năm phút?' },
      { who: 'them', en: "For you, I'll make a whole evening. I'm writing it down now.", vi: 'Với anh, em sẽ dành nguyên một buổi tối. Em ghi vào sổ ngay đây.' },
    ],
  },
  dates: [
    {
      id: 'office-date-1',
      title: 'Hẹn hò lần đầu: công viên, không điện thoại',
      scene: 'Chiều Chủ nhật ở công viên, bạn bắt Sarah để điện thoại ở nhà.',
      lines: [
        { who: 'them', en: 'I feel weird without my phone. What if work calls?', vi: 'Không có điện thoại em thấy lạ lắm. Lỡ công ty gọi thì sao?' },
        { who: 'you', en: "Then they can wait. It's Sunday, Sarah.", vi: 'Thì để họ chờ. Chủ nhật mà, Sarah.' },
        { who: 'them', en: 'Fine. But I brought a notebook. Just in case.', vi: 'Thôi được. Nhưng em có mang sổ. Phòng khi cần.' },
        { who: 'you', en: 'A work notebook? On a date?', vi: 'Sổ công việc á? Đi hẹn hò mà?' },
        { who: 'them', en: 'Not for work. Look. I draw in it. Ducks, mostly.', vi: 'Không phải công việc. Nhìn này. Em vẽ trong đó. Chủ yếu là vịt.' },
        { who: 'narr', vi: 'Trang nào cũng kín những chú vịt nhỏ, con nào cũng thắt cà vạt.' },
        { who: 'you', en: 'These are really good. Why ducks?', vi: 'Vẽ đẹp thật. Sao lại là vịt?' },
        { who: 'them', en: "They look calm, but they're busy under the water. Like me.", vi: 'Trông chúng bình thản, nhưng dưới nước thì đạp chân liên tục. Giống em.' },
      ],
    },
    {
      id: 'office-date-2',
      title: 'Hẹn hò lần hai: thi câu cá',
      scene: 'Sáng sớm ở cầu câu bên hồ, Sarah mang theo hẳn một cuốn sổ ghi kế hoạch câu cá.',
      lines: [
        { who: 'them', en: 'I read three articles about fishing last night.', vi: 'Tối qua em đọc ba bài báo về câu cá đấy.' },
        { who: 'you', en: 'Of course you did. Any tips?', vi: 'Biết ngay mà. Có mẹo gì không?' },
        { who: 'them', en: 'Be patient. Which is, um, not my best skill.', vi: 'Kiên nhẫn. Mà cái đó, ờ, không phải thế mạnh của em.' },
        { who: 'narr', vi: 'Hai mươi phút trôi qua. Cần của bạn giật mạnh, còn cần của Sarah vẫn im lìm.' },
        { who: 'them', en: "You got one? Already? That's not fair!", vi: 'Anh câu được rồi á? Nhanh thế? Không công bằng!' },
        { who: 'narr', vi: 'Mười phút sau, Sarah kéo lên một con cá nhỏ xíu, chưa bằng bàn tay.' },
        { who: 'them', en: "Look! It's tiny, but it's mine!", vi: 'Nhìn này! Bé tí, nhưng là của em!' },
        { who: 'you', en: 'Should we put it back?', vi: 'Mình thả nó về nhé?' },
        { who: 'them', en: 'Yes. Go on, little guy. Back to work.', vi: 'Ừ. Đi đi, bé con. Quay về làm việc đi.' },
      ],
      choice: {
        after: 4,
        q: 'Sarah đang tức anh ách. Bạn nói gì?',
        options: [
          {
            id: 'office-date-2-a',
            en: 'Slow down. Breathe. The fish can hear you thinking.',
            vi: 'Chậm lại. Thở đi. Cá nghe thấy em suy nghĩ đấy.',
            points: 20,
            reply: [{ who: 'them', en: "Okay. Slow. I'm good at slow now. Sort of.", vi: 'Rồi. Chậm lại. Giờ em chậm được rồi. Kiểu thế.' }],
          },
          {
            id: 'office-date-2-b',
            en: "Here, take my rod. Let's say it's your fish.",
            vi: 'Đây, cầm cần của anh. Coi như cá của em.',
            points: 15,
            reply: [{ who: 'them', en: "No way. I'm catching my own. Watch me.", vi: 'Không đời nào. Em tự câu con của em. Xem đây.' }],
          },
          {
            id: 'office-date-2-c',
            en: "Maybe fishing just isn't your thing.",
            vi: 'Chắc câu cá không hợp với em rồi.',
            points: -5,
            reply: [{ who: 'them', en: 'Excuse me? Give me ten more minutes.', vi: 'Gì cơ? Cho em thêm mười phút.' }],
          },
        ],
      },
    },
    {
      id: 'office-date-3',
      title: 'Hẹn hò lần ba: hái dâu ngoài đồng',
      scene: 'Cuối tuần, hai người ra cánh đồng phía bắc thị trấn hái dâu.',
      lines: [
        { who: 'you', en: "You're really fast at this. Have you done it before?", vi: 'Em hái nhanh thật. Em làm việc này rồi à?' },
        { who: 'them', en: "I grew up on a farm. Didn't I tell you?", vi: 'Em lớn lên ở trang trại mà. Em chưa kể à?' },
        { who: 'you', en: 'No! I thought you were born in an office.', vi: 'Chưa! Anh tưởng em sinh ra ở văn phòng luôn.' },
        { who: 'them', en: 'Ha. My dad woke me up at five to feed the chickens.', vi: 'Ha. Bố em gọi em dậy lúc năm giờ để cho gà ăn.' },
        { who: 'them', en: "That's why I'm never late. And never relaxed.", vi: 'Thế nên em chẳng bao giờ đi muộn. Và cũng chẳng bao giờ thư thả.' },
        { who: 'you', en: 'Well, you look relaxed right now.', vi: 'Nhưng giờ trông em thư thả lắm.' },
        { who: 'them', en: "I am. Maybe it's the strawberries. Or maybe it's you.", vi: 'Đúng thế. Chắc tại dâu. Hoặc tại anh.' },
        { who: 'narr', vi: 'Sarah đút cho bạn một quả dâu, rồi bật cười.' },
      ],
    },
  ],
  proposal: {
    id: 'office-proposal',
    title: 'Cuộc họp một trang chiếu',
    scene: 'Bạn hẹn Sarah vào phòng họp lúc bảy giờ tối, máy chiếu đã bật sẵn.',
    lines: [
      { who: 'them', en: 'A meeting at seven? Who books a meeting at seven?', vi: 'Họp lúc bảy giờ tối? Ai lại đặt lịch họp giờ này?' },
      { who: 'you', en: "Me. It's a short one. Just one slide.", vi: 'Anh. Họp ngắn thôi. Có một trang chiếu.' },
      { who: 'narr', vi: 'Màn chiếu báo không có tín hiệu. Bạn tắt máy đi rồi bật lại.' },
      { who: 'them', en: 'Ha! Turn it off and on again. Max would be proud.', vi: 'Ha! Tắt đi bật lại. Max mà thấy chắc tự hào lắm.' },
      { who: 'narr', vi: 'Trên màn hình hiện lên một dòng chữ: Sarah, em lấy anh nhé?' },
      { who: 'you', en: "I don't need five minutes. Just one word.", vi: 'Anh không cần năm phút. Chỉ cần một chữ thôi.' },
      { who: 'them', en: 'Yes. Yes! Put it in my calendar. Forever.', vi: 'Có. Em đồng ý! Ghi vào lịch của em đi. Mãi mãi.' },
      { who: 'them', en: "Best meeting I've ever had.", vi: 'Cuộc họp tuyệt nhất đời em.' },
    ],
  },
  vows: {
    id: 'office-vows',
    title: 'Lời thề ở quảng trường',
    scene: 'Quảng trường buổi chiều, Sarah cầm một cuốn sổ nhỏ, bìa thắt nơ trắng.',
    lines: [
      { who: 'them', en: '{name}, I wrote my vows in my best notebook. Of course.', vi: '{name}, em viết lời thề vào cuốn sổ đẹp nhất. Tất nhiên rồi.' },
      { who: 'them', en: 'I promise to slow down, put my phone away, and listen to you.', vi: 'Em hứa sẽ sống chậm lại, cất điện thoại đi, và lắng nghe anh.' },
      { who: 'you', en: 'Sarah, I promise you all my time. Not just five minutes.', vi: 'Sarah, anh hứa dành cho em cả thời gian của anh. Không chỉ năm phút.' },
      { who: 'narr', vi: 'Cả văn phòng ngồi kín hàng ghế đầu. Hôm nay không ai ăn mì cay.' },
      { who: 'them', en: "I love you. And my phone is off. All day.", vi: 'Em yêu anh. Và điện thoại em tắt rồi. Cả ngày luôn.' },
    ],
  },
  daily: [
    {
      id: 'office-daily-1',
      title: 'Chìa khóa đâu rồi',
      scene: 'Bảy giờ sáng, Sarah chạy khắp nhà, áo khoác mới mặc một tay.',
      lines: [
        { who: 'them', en: "Have you seen my keys? I'm late!", vi: 'Anh có thấy chìa khóa của em đâu không? Em muộn rồi!' },
        { who: 'you', en: 'Your pocket. The left one.', vi: 'Trong túi em. Túi bên trái.' },
        { who: 'them', en: 'What would I do without you?', vi: 'Không có anh thì em biết làm sao?' },
      ],
    },
    {
      id: 'office-daily-2',
      title: 'Mùi mì cay',
      scene: 'Sarah vừa mở cửa nhà đã khựng lại, hít hít mũi.',
      lines: [
        { who: 'them', en: 'Why does the kitchen smell like spicy noodles?', vi: 'Sao trong bếp có mùi mì cay thế?' },
        { who: 'you', en: 'Um. Lunch. Sorry.', vi: 'Ờ. Bữa trưa. Anh xin lỗi.' },
        { who: 'them', en: "Open a window. You're lucky I love you.", vi: 'Mở cửa sổ ra đi. Anh may là em yêu anh đấy.' },
      ],
    },
    {
      id: 'office-daily-3',
      title: 'Con vịt mới',
      scene: 'Sarah lật cuốn sổ đến một trang mới, giơ lên cho bạn xem.',
      lines: [
        { who: 'them', en: 'I drew you a duck today.', vi: 'Hôm nay em vẽ cho anh một con vịt.' },
        { who: 'you', en: 'Why is it wearing my glasses?', vi: 'Sao nó lại đeo kính của anh?' },
        { who: 'them', en: "Because it's you. Obviously.", vi: 'Vì nó là anh. Rõ quá còn gì.' },
      ],
    },
    {
      id: 'office-daily-4',
      title: 'Luật của nhà mình',
      scene: 'Bữa tối, điện thoại của Sarah rung trên bàn.',
      lines: [
        { who: 'you', en: 'No phones at dinner. House rule.', vi: 'Không dùng điện thoại trong bữa tối. Luật nhà mình.' },
        { who: 'them', en: 'That was my rule.', vi: 'Luật đó là của em đặt mà.' },
        { who: 'you', en: "Then it's our rule. Pass the salt, please.", vi: 'Thì là luật của hai đứa. Đưa anh lọ muối nào.' },
      ],
    },
    {
      id: 'office-daily-5',
      title: 'Ba cuộc họp',
      scene: 'Sarah về muộn, thả túi xuống ghế rồi nằm dài ra sofa.',
      lines: [
        { who: 'you', en: 'Busy day?', vi: 'Hôm nay bận lắm à?' },
        { who: 'them', en: 'Three meetings and a projector problem.', vi: 'Ba cuộc họp và một vụ máy chiếu hỏng.' },
        { who: 'you', en: 'Did you try turning it off and on again?', vi: 'Em thử tắt đi bật lại chưa?' },
        { who: 'them', en: 'Very funny. Come here and give me a hug.', vi: 'Buồn cười ghê. Lại đây ôm em cái nào.' },
      ],
    },
    {
      id: 'office-daily-6',
      title: 'Sáng thứ Bảy',
      scene: 'Mới sáu giờ sáng thứ Bảy, Sarah đã dậy pha trà.',
      lines: [
        { who: 'you', en: "It's Saturday. Why are you up so early?", vi: 'Thứ Bảy mà. Sao em dậy sớm thế?' },
        { who: 'them', en: 'Farm habit. Go back to sleep.', vi: 'Thói quen từ hồi ở trang trại. Anh ngủ tiếp đi.' },
        { who: 'you', en: 'Only if you bring me some tea.', vi: 'Pha cho anh một cốc trà thì anh ngủ tiếp.' },
      ],
    },
    {
      id: 'office-daily-7',
      title: 'Chậu cây trên bàn làm việc',
      scene: 'Sarah gửi cho bạn ảnh chậu cây trên bàn làm việc, rồi gọi ngay sau đó.',
      lines: [
        { who: 'them', en: 'Look, my desk plant has a new leaf!', vi: 'Nhìn này, cây trên bàn làm việc của em ra lá mới!' },
        { who: 'you', en: 'Weren\'t you going to blame the job if it died?', vi: 'Chẳng phải em bảo nó mà chết thì đổ tại công việc mới à?' },
        { who: 'them', en: "It didn't die. So I'm taking the credit.", vi: 'Nó có chết đâu. Nên công là của em.' },
      ],
    },
    {
      id: 'office-daily-8',
      title: 'Cả buổi tối',
      scene: 'Tối muộn, Sarah ngồi xuống cạnh bạn, gác cuốn sổ sang một bên.',
      lines: [
        { who: 'them', en: "Can I tell you about my day? It's a long one.", vi: 'Em kể anh nghe chuyện hôm nay nhé? Dài lắm đấy.' },
        { who: 'you', en: "I've got all night. Not just five minutes.", vi: 'Anh có cả buổi tối. Không chỉ năm phút đâu.' },
        { who: 'them', en: "That's why I married you.", vi: 'Thế nên em mới lấy anh.' },
      ],
    },
  ],
};
