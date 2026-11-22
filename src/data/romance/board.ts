// board · Tom: courtship, wedding and married life (contract: core/town/romanceTypes.ts).
// Builds on his arc (data/stories/board.ts): the notebook he fills every month (and dropped in the fountain), fresh
// bread at six, lemon cake, the farm's fruit baskets, the plants he kills, the poodle in a raincoat, his fear of
// public speaking, the volunteer group, and the childhood of moving every year that makes him build a place to belong.
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'board',
  courtedBy: 'female',
  confess: {
    id: 'board-confess',
    title: 'Tỏ tình trước bảng tin',
    scene: 'Sáng sớm, Tom đang ghim thông báo mới lên bảng tin, bạn cầm một bó hoa đi tới.',
    lines: [
      { who: 'them', en: "Morning! Are those for the flower show? It's not till May.", vi: 'Chào buổi sáng! Hoa cho hội hoa à? Tháng Năm mới tổ chức cơ.' },
      { who: 'you', en: "No. They're for you, Tom.", vi: 'Không. Hoa này tặng anh, Tom.' },
      { who: 'them', en: "For me? Oh. I'll try very hard not to kill them.", vi: 'Cho anh á? Ồ. Anh sẽ cố hết sức để chúng không chết.' },
      { who: 'you', en: 'Tom, I like you. More than a friend.', vi: 'Tom, em thích anh. Hơn cả bạn bè.' },
      { who: 'them', en: 'Sorry, can you say that again? I think I need to write it down.', vi: 'Xin lỗi, em nói lại được không? Chắc anh phải ghi lại mất.' },
      { who: 'you', en: "I like you. You don't need a notebook for that.", vi: 'Em thích anh. Chuyện này không cần ghi sổ đâu.' },
      { who: 'them', en: "I'm terrible at speeches, so I'll just say it.", vi: 'Anh dở khoản phát biểu lắm, nên anh nói luôn nhé.' },
      { who: 'them', en: 'I like you too. Yes. Very much yes.', vi: 'Anh cũng thích em. Có. Có, rất nhiều.' },
    ],
  },
  dates: [
    {
      id: 'board-date-1',
      title: 'Hẹn hò lần đầu: dã ngoại theo kế hoạch',
      scene: 'Sáng thứ Bảy ở cánh đồng nông trại, Tom trải khăn, bày bánh mì nóng và một giỏ trái cây.',
      lines: [
        { who: 'them', en: 'I got up at six for this bread. Very romantic, right?', vi: 'Anh dậy từ sáu giờ để mua ổ bánh mì này đấy. Lãng mạn chưa?' },
        { who: 'you', en: 'Very. And a fruit basket from the farm!', vi: 'Lãng mạn lắm. Còn có cả giỏ trái cây của nông trại!' },
        { who: 'them', en: "I made a plan for today. It's in my notebook.", vi: 'Anh lên kế hoạch cho hôm nay rồi. Ở trong sổ đây.' },
        { who: 'you', en: 'A plan for a picnic? Let me see.', vi: 'Kế hoạch cho buổi dã ngoại á? Cho em xem nào.' },
        { who: 'them', en: "Ten o'clock, eat. Ten thirty, talk. Eleven, hold hands.", vi: 'Mười giờ, ăn. Mười giờ rưỡi, nói chuyện. Mười một giờ, nắm tay.' },
        { who: 'them', en: "You know, I've never planned a date before. Only fairs.", vi: 'Em biết không, anh chưa lên kế hoạch hẹn hò bao giờ. Chỉ toàn hội chợ.' },
        { who: 'you', en: 'Well, this is better than any fair.', vi: 'Thì buổi này hay hơn mọi hội chợ.' },
        { who: 'them', en: 'Even better than the poodle in a raincoat?', vi: 'Hay hơn cả con chó xù mặc áo mưa?' },
        { who: 'you', en: 'Okay, almost as good.', vi: 'Thôi được, gần bằng.' },
      ],
      choice: {
        after: 4,
        q: 'Bạn nói gì với kế hoạch của Tom?',
        options: [
          {
            id: 'board-date-1-a',
            en: "It's almost eleven. Can we skip ahead?",
            vi: 'Sắp mười một giờ rồi. Mình nhảy cóc được không?',
            points: 20,
            reply: [{ who: 'them', en: "Skip ahead? That's not in the plan. But okay.", vi: 'Nhảy cóc á? Không có trong kế hoạch. Nhưng được thôi.' }],
          },
          {
            id: 'board-date-1-b',
            en: "That's so sweet. Let's follow the plan.",
            vi: 'Dễ thương quá. Mình làm đúng kế hoạch nhé.',
            points: 15,
            reply: [{ who: 'them', en: 'Really? Nobody ever follows my plans.', vi: 'Thật à? Chưa ai làm theo kế hoạch của anh bao giờ.' }],
          },
          {
            id: 'board-date-1-c',
            en: 'Tom, throw away the plan.',
            vi: 'Tom, vứt kế hoạch đi.',
            points: 5,
            reply: [{ who: 'them', en: "Throw it away? Okay. I'll try. It's hard.", vi: 'Vứt đi á? Được. Anh sẽ thử. Khó lắm đấy.' }],
          },
        ],
      },
    },
    {
      id: 'board-date-2',
      title: 'Hẹn hò lần hai: tập phát biểu',
      scene: 'Ở quán Emma, Tom ngồi góc trong, đọc đi đọc lại một tờ giấy, ly cà phê đã nguội.',
      lines: [
        { who: 'them', en: 'I have to give a speech on Friday. To the whole town.', vi: 'Thứ Sáu này anh phải phát biểu. Trước cả thị trấn.' },
        { who: 'you', en: "You'll be fine. Try it on me.", vi: 'Anh sẽ ổn thôi. Thử nói với em xem.' },
        { who: 'them', en: 'Okay. Um. Good evening, everyone. Um.', vi: 'Được. Ừm. Chào buổi tối mọi người. Ừm.' },
        { who: 'you', en: "Look at me, not the paper. Pretend it's just us.", vi: 'Nhìn em, đừng nhìn tờ giấy. Cứ coi như chỉ có hai mình.' },
        { who: 'them', en: 'Good evening, everyone. Thank you all for coming.', vi: 'Chào buổi tối mọi người. Cảm ơn mọi người đã đến.' },
        { who: 'you', en: 'See? That was great, Tom!', vi: 'Thấy chưa? Hay lắm đấy, Tom!' },
        { who: 'them', en: "It's easier when I look at you. Will you sit in the front row?", vi: 'Nhìn em thì dễ hơn hẳn. Em ngồi hàng ghế đầu nhé?' },
        { who: 'you', en: 'Front row, every time. I promise.', vi: 'Hàng đầu, lần nào cũng vậy. Em hứa.' },
      ],
    },
    {
      id: 'board-date-3',
      title: 'Hẹn hò lần ba: bánh chanh dưới trời sao',
      scene: 'Tối ở công viên, Tom mang theo nguyên một cái bánh chanh và hai cái nĩa.',
      lines: [
        { who: 'them', en: 'I brought a whole lemon cake. Two forks. No plates.', vi: 'Anh mang nguyên cái bánh chanh. Hai cái nĩa. Không có đĩa.' },
        { who: 'you', en: 'A whole cake? Are you going to eat all of it?', vi: 'Nguyên cái bánh? Anh định ăn hết à?' },
        { who: 'them', en: "Maybe. Don't worry, I'll leave you a corner.", vi: 'Có thể. Đừng lo, anh chừa cho em một góc.' },
        { who: 'you', en: 'Tom, how many towns did you live in as a kid?', vi: 'Tom, hồi nhỏ anh sống ở bao nhiêu thị trấn rồi?' },
        { who: 'them', en: 'Nine. Nine towns, nine schools, nine first days.', vi: 'Chín. Chín thị trấn, chín ngôi trường, chín lần ngày đầu tiên.' },
        { who: 'them', en: 'I used to keep a bag packed every summer. Just in case.', vi: 'Hè nào anh cũng xếp sẵn một túi đồ. Phòng khi phải đi.' },
        { who: 'you', en: 'And now?', vi: 'Còn bây giờ?' },
        { who: 'them', en: "Now my bag's at the back of the closet. I'm not going anywhere.", vi: 'Giờ cái túi nằm tận đáy tủ. Anh không đi đâu nữa.' },
      ],
    },
  ],
  proposal: {
    id: 'board-proposal',
    title: 'Cầu hôn trên bảng tin',
    scene: 'Bạn ghim một tờ giấy nhỏ lên bảng tin rồi đứng chờ Tom.',
    lines: [
      { who: 'them', en: "A new notice? I didn't put that up. Let me see.", vi: 'Thông báo mới à? Anh đâu có dán cái này. Để anh xem.' },
      { who: 'them', en: "Wait. It says, 'Tom, will you marry me?'", vi: "Khoan. Ở đây ghi: 'Tom, anh cưới em nhé?'" },
      { who: 'you', en: "I knew you'd read it if it was on the board.", vi: 'Em biết dán lên bảng tin là kiểu gì anh cũng đọc.' },
      { who: 'narr', vi: 'Bạn mở chiếc hộp nhỏ, bên trong là một chiếc nhẫn.' },
      { who: 'them', en: "Oh no. I'm going to cry in front of the whole street.", vi: 'Ôi không. Anh sắp khóc trước cả con phố mất rồi.' },
      { who: 'you', en: "That's okay. Is that a yes?", vi: 'Không sao đâu. Thế là đồng ý chứ?' },
      { who: 'them', en: "Yes. Yes! I'm writing it in my notebook. In big letters.", vi: 'Có. Có chứ! Anh ghi vào sổ ngay. Chữ thật to.' },
    ],
  },
  vows: {
    id: 'board-vows',
    title: 'Lễ cưới ở quảng trường',
    scene: 'Quảng trường kê kín ghế, Tom cầm một tờ giấy, tay hơi run.',
    lines: [
      { who: 'them', en: "I wrote a speech. But I'm just going to look at you.", vi: 'Anh có viết bài phát biểu. Nhưng anh sẽ chỉ nhìn em thôi.' },
      { who: 'them', en: "{name}, I moved nine times. You're the place I stay.", vi: '{name}, anh đã chuyển nhà chín lần. Em là nơi anh ở lại.' },
      { who: 'you', en: "And you'll never have to pack that bag again.", vi: 'Và anh sẽ không bao giờ phải xếp cái túi ấy nữa.' },
      { who: 'them', en: "Okay, I'm crying. Somebody pass me a tissue.", vi: 'Thôi, anh khóc rồi. Ai đưa anh tờ khăn giấy với.' },
      { who: 'you', en: "Front row, Tom. I'm right here. Always.", vi: 'Hàng ghế đầu đây, Tom. Em ở ngay đây. Luôn luôn.' },
    ],
  },
  daily: [
    {
      id: 'board-daily-1',
      title: 'Sáu giờ, bánh mì',
      scene: 'Mùi bánh mì nóng bay khắp nhà.',
      lines: [
        { who: 'them', en: "Six o'clock. Fresh bread's on the table.", vi: 'Sáu giờ rồi. Bánh mì nóng trên bàn nhé.' },
        { who: 'you', en: "You're the only man who gets up this early for bread.", vi: 'Chắc chỉ có anh dậy sớm thế này vì bánh mì.' },
        { who: 'them', en: 'And for you. But mostly the bread.', vi: 'Và vì em nữa. Nhưng chủ yếu là bánh mì.' },
      ],
    },
    {
      id: 'board-daily-2',
      title: 'Cuốn sổ mới',
      scene: 'Trên bàn có một cuốn sổ tay mới tinh, còn nguyên giấy bọc.',
      lines: [
        { who: 'you', en: 'Is that a new notebook already?', vi: 'Lại sổ mới rồi à?' },
        { who: 'them', en: "The old one's full. It's a busy month.", vi: 'Cuốn cũ kín rồi. Tháng này bận mà.' },
        { who: 'you', en: "Tom, it's the fifth.", vi: 'Tom, mới mùng năm thôi đấy.' },
      ],
    },
    {
      id: 'board-daily-3',
      title: 'Đừng đụng vào cây',
      scene: 'Bạn vừa mang về một chậu cây nhỏ, Tom đứng nhìn nó từ xa.',
      lines: [
        { who: 'you', en: "Don't touch my plant, okay?", vi: 'Đừng đụng vào cây của em nhé?' },
        { who: 'them', en: "I won't even look at it. I promise.", vi: 'Anh còn không thèm nhìn nó. Anh hứa.' },
        { who: 'you', en: "You're looking at it right now.", vi: 'Anh đang nhìn nó đấy thôi.' },
      ],
    },
    {
      id: 'board-daily-4',
      title: 'Họp tối nay',
      scene: 'Tom cầm tờ giấy ghi chú, đi đi lại lại trong phòng khách.',
      lines: [
        { who: 'them', en: 'I have to speak at the meeting tonight.', vi: 'Tối nay anh phải phát biểu ở buổi họp.' },
        { who: 'you', en: 'Front row. Just like I promised.', vi: 'Em ngồi hàng đầu. Như đã hứa.' },
        { who: 'them', en: "Then I'll be fine.", vi: 'Vậy thì anh sẽ ổn thôi.' },
      ],
    },
    {
      id: 'board-daily-5',
      title: 'Giúp bà Grace',
      scene: 'Tom cầm sẵn hai chiếc túi đi chợ.',
      lines: [
        { who: 'them', en: 'Grace needs help with her shopping. Come with me?', vi: 'Bà Grace cần người đi chợ giúp. Em đi cùng anh nhé?' },
        { who: 'you', en: 'Sure. Can we stop for lemon cake after?', vi: 'Được. Xong rồi mình ghé ăn bánh chanh nhé?' },
        { who: 'them', en: "That's always part of the plan.", vi: 'Cái đó lúc nào cũng có trong kế hoạch.' },
      ],
    },
    {
      id: 'board-daily-6',
      title: 'Bảng tin hôm nay',
      scene: 'Tom vừa đi dán thông báo về, áo dính lông mèo.',
      lines: [
        { who: 'you', en: "What's on the board today?", vi: 'Hôm nay bảng tin có gì?' },
        { who: 'them', en: 'One lost umbrella and a very angry cat. Again.', vi: 'Một cái ô thất lạc và một con mèo rất cáu. Lại nữa.' },
        { who: 'you', en: 'The same cat?', vi: 'Vẫn con mèo đó à?' },
        { who: 'them', en: 'Same cat. I think she just likes the board.', vi: 'Vẫn con đó. Chắc nó thích cái bảng tin thôi.' },
      ],
    },
    {
      id: 'board-daily-7',
      title: 'Danh sách cuối tuần',
      scene: 'Tom chìa ra một trang sổ chi chít chữ.',
      lines: [
        { who: 'them', en: 'I made a list for the weekend.', vi: 'Anh lên danh sách việc cho cuối tuần rồi.' },
        { who: 'you', en: 'Is there anything on it about resting?', vi: 'Có dòng nào ghi là nghỉ ngơi không?' },
        { who: 'them', en: 'Line ten. Rest. If there is time.', vi: 'Dòng thứ mười. Nghỉ ngơi. Nếu còn thời gian.' },
        { who: 'you', en: "Let's start with line ten.", vi: 'Mình bắt đầu từ dòng thứ mười đi.' },
      ],
    },
    {
      id: 'board-daily-8',
      title: 'Điều anh thích nhất',
      scene: 'Tối, hai người ngồi bên cửa sổ, ngoài trời yên ắng.',
      lines: [
        { who: 'them', en: 'You know what I love most about this house?', vi: 'Em biết anh thích nhất điều gì ở ngôi nhà này không?' },
        { who: 'you', en: 'The kitchen? The bread?', vi: 'Cái bếp? Bánh mì?' },
        { who: 'them', en: "That I'll still be here next year.", vi: 'Là sang năm anh vẫn còn ở đây.' },
      ],
    },
  ],
};
