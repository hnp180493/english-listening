// shop · Ben: courtship, wedding and married life (contract: core/town/romanceTypes.ts).
// Builds on his arc (data/stories/shop.ts): the jokes ("bags are free, batteries aren't", the shy kettle), the plants
// he kills, chocolate, a whole box of spicy noodles, Friday game night, his dad's thirty-year-old shop losing to the
// supermarket, his dad's comic books, and the loaf he saved for Grace and gave away.
import type { Suitor } from '../../core/town/romanceTypes';

export const SUITOR: Suitor = {
  placeId: 'shop',
  courtedBy: 'female',
  confess: {
    id: 'shop-confess',
    title: 'Tỏ tình: bó hoa không chết được',
    scene: 'Gần giờ đóng cửa, bạn bước vào tiệm Ben, giấu một bó hoa sau lưng.',
    lines: [
      { who: 'them', en: 'Hey! Last customer of the day. What can I get you?', vi: 'Chào! Khách cuối cùng trong ngày. Em cần gì nào?' },
      { who: 'you', en: 'Nothing. I brought you something. Here.', vi: 'Không cần gì cả. Em mang cái này cho anh. Đây.' },
      { who: 'them', en: 'Flowers? For me? You know I kill every plant I touch.', vi: 'Hoa á? Cho anh? Em biết cây nào qua tay anh cũng chết mà.' },
      { who: 'you', en: "They're already cut. Even you can't kill them.", vi: 'Hoa cắt sẵn rồi. Đến anh cũng không làm chết được.' },
      { who: 'them', en: 'Ha! Okay, fair. But why flowers?', vi: 'Ha! Được, hợp lý. Nhưng sao lại tặng hoa?' },
      { who: 'you', en: 'Because I like you, Ben. Not just your jokes.', vi: 'Vì em thích anh, Ben. Không chỉ mấy câu đùa của anh đâu.' },
      { who: 'them', en: "Oh. Wow. For once, I don't have a joke.", vi: 'Ồ. Trời. Lần đầu tiên anh không nghĩ ra câu đùa nào.' },
      { who: 'them', en: 'I like you too. Ever since you brought back that shy kettle.', vi: 'Anh cũng thích em. Từ hôm em mang cái ấm nhút nhát quay lại.' },
      { who: 'them', en: "So yes. Absolutely yes. And the chocolate's free now.", vi: 'Nên là có. Chắc chắn là có. Và từ giờ sô-cô-la miễn phí cho em.' },
    ],
  },
  dates: [
    {
      id: 'shop-date-1',
      title: 'Hẹn hò lần đầu: nhà hàng quầy tính tiền',
      scene: 'Tối, tiệm Ben đã đóng cửa, trên quầy tính tiền có hai bát mì và một cây nến.',
      lines: [
        { who: 'them', en: 'Welcome to the finest restaurant in town. My checkout counter.', vi: 'Chào mừng đến nhà hàng sang nhất thị trấn. Quầy tính tiền của anh.' },
        { who: 'you', en: 'Candles and noodles? Very fancy, Ben.', vi: 'Nến với mì à? Sang chảnh ghê, Ben.' },
        { who: 'them', en: "Tonight's special: my famous spicy noodles. Level one to five.", vi: 'Món đặc biệt tối nay: mì cay trứ danh của anh. Cay từ cấp một tới cấp năm.' },
        { who: 'you', en: 'So, was this shop always this cozy?', vi: 'Mà tiệm này lúc nào cũng ấm cúng thế à?' },
        { who: 'them', en: 'My parents had their first date right here, actually.', vi: 'Thật ra bố mẹ anh hẹn hò lần đầu ngay tại đây.' },
        { who: 'them', en: 'Dad made noodles on this counter. Mom said he was a terrible cook.', vi: 'Bố nấu mì trên chính cái quầy này. Mẹ bảo bố nấu dở tệ.' },
        { who: 'you', en: 'And she married him anyway?', vi: 'Thế mà mẹ vẫn lấy bố à?' },
        { who: 'them', en: 'She did. I guess terrible cooking runs in the family.', vi: 'Vẫn lấy. Chắc nấu dở là truyền thống nhà anh rồi.' },
      ],
      choice: {
        after: 2,
        q: 'Bạn chọn cay cấp mấy?',
        options: [
          {
            id: 'shop-date-1-a',
            en: 'Level five. I can handle it.',
            vi: 'Cấp năm. Em chịu được.',
            points: 15,
            reply: [{ who: 'them', en: "Oh, I like you even more now. Water's right there.", vi: 'Ồ, giờ anh còn thích em hơn. Nước ở ngay kia nhé.' }],
          },
          {
            id: 'shop-date-1-b',
            en: 'Level one, please. I want to taste the food.',
            vi: 'Cấp một thôi. Em còn muốn nếm được vị.',
            points: 10,
            reply: [{ who: 'them', en: 'A sensible woman. Level one it is.', vi: 'Một người phụ nữ biết điều. Vậy cấp một.' }],
          },
          {
            id: 'shop-date-1-c',
            en: 'Can I just have the chocolate?',
            vi: 'Cho em ăn sô-cô-la thôi được không?',
            points: 5,
            reply: [{ who: 'them', en: 'Dessert first? Bold. I respect that.', vi: 'Tráng miệng trước à? Liều đấy. Anh nể.' }],
          },
        ],
      },
    },
    {
      id: 'shop-date-2',
      title: 'Hẹn hò lần hai: con cá đầu tiên',
      scene: 'Sáng Chủ nhật ở bến câu cá, Ben vác hai cần câu và một túi sô-cô-la.',
      lines: [
        { who: 'them', en: "Okay, I've never actually caught a fish. Just so you know.", vi: 'Nói trước nhé, anh chưa câu được con cá nào bao giờ.' },
        { who: 'you', en: 'Never? Then why do you have two fishing rods?', vi: 'Chưa bao giờ? Thế sao anh có tận hai cần câu?' },
        { who: 'them', en: "They were on sale. In my own shop. I couldn't say no.", vi: 'Đang giảm giá. Ở tiệm của chính anh. Anh không cưỡng lại được.' },
        { who: 'you', en: "Wait, I think I've got something!", vi: 'Khoan, hình như em câu được gì rồi!' },
        { who: 'them', en: "No way! It's a fish! A real fish!", vi: 'Không thể nào! Cá kìa! Cá thật kìa!' },
        { who: 'you', en: "It's tiny, Ben. Let's put it back.", vi: 'Nó bé tí, Ben. Thả nó về thôi.' },
        { who: 'them', en: "Fine. But I'm telling everyone it was this big.", vi: 'Thôi được. Nhưng anh sẽ kể với mọi người là nó to cỡ này.' },
        { who: 'them', en: "Honestly, this is the first Sunday I've closed the shop in years.", vi: 'Nói thật, đây là Chủ nhật đầu tiên anh đóng cửa tiệm sau bao nhiêu năm.' },
        { who: 'you', en: "Then let's make it a habit. The shop can wait.", vi: 'Vậy mình tập thành thói quen đi. Tiệm chờ được mà.' },
      ],
    },
    {
      id: 'shop-date-3',
      title: 'Hẹn hò lần ba: cười ở rạp phim',
      scene: 'Suất chiếu tối ở rạp của Zoe, Ben giấu một thanh sô-cô-la to trong áo khoác.',
      lines: [
        { who: 'them', en: 'Shh. Zoe says no outside food. This is a chocolate mission.', vi: 'Suỵt. Zoe cấm mang đồ ăn ngoài vào. Đây là nhiệm vụ sô-cô-la.' },
        { who: 'you', en: "Ben, she can see you. She's looking right at us.", vi: 'Ben, cô ấy thấy anh rồi. Đang nhìn thẳng vào mình kìa.' },
        { who: 'them', en: "Act natural. Smile. Okay, she's gone.", vi: 'Tự nhiên vào. Cười lên. Rồi, cô ấy đi rồi.' },
        { who: 'narr', vi: 'Phim hài vừa chiếu, Ben cười to nhất rạp, kể cả lúc chẳng có gì buồn cười.' },
        { who: 'you', en: "Why are you laughing? Nobody said anything funny!", vi: 'Sao anh cười? Có ai nói gì buồn cười đâu!' },
        { who: 'them', en: 'The guy in the hat! My dad had that exact hat.', vi: 'Ông đội mũ kia kìa! Bố anh có đúng cái mũ đó.' },
        { who: 'you', en: "You're the only person in town who laughs more than me.", vi: 'Anh là người duy nhất trong thị trấn cười nhiều hơn em.' },
        { who: 'them', en: "That's why we work. You laugh at my jokes, I laugh at hats.", vi: 'Thế nên mình mới hợp. Em cười câu đùa của anh, anh cười cái mũ.' },
      ],
    },
  ],
  proposal: {
    id: 'shop-proposal',
    title: 'Cầu hôn ở tiệm của bố',
    scene: 'Sáng sớm, tiệm Ben vừa mở cửa, chưa có vị khách nào.',
    lines: [
      { who: 'them', en: "Morning! You're up early. Batteries again?", vi: 'Chào buổi sáng! Em dậy sớm thế. Lại mua pin à?' },
      { who: 'you', en: "Not today. I need something that isn't on your shelves.", vi: 'Hôm nay thì không. Em cần thứ không có trên kệ của anh.' },
      { who: 'them', en: 'Impossible. This shop has everything. Name it.', vi: 'Không thể nào. Tiệm này cái gì cũng có. Em cứ nói.' },
      { who: 'you', en: 'A husband. Ben, will you marry me?', vi: 'Một người chồng. Ben, anh cưới em nhé?' },
      { who: 'narr', vi: 'Bạn mở chiếc hộp nhỏ. Ben đứng chết trân sau quầy.' },
      { who: 'them', en: 'Is that a ring? Right here, at the counter?', vi: 'Nhẫn đấy à? Ngay tại đây, bên quầy này?' },
      { who: 'them', en: 'Where Mom and Dad had their first date. Yes. Yes, yes, yes!', vi: 'Chỗ bố mẹ anh hẹn hò lần đầu. Có. Có, có, có!' },
      { who: 'you', en: 'Is that a yes, or are you just shouting?', vi: 'Thế là đồng ý hay anh chỉ đang hét thôi?' },
      { who: 'them', en: "It's a yes. And for you, everything's free now. Except batteries.", vi: 'Là đồng ý. Và từ giờ em lấy gì cũng miễn phí. Trừ pin.' },
    ],
  },
  vows: {
    id: 'shop-vows',
    title: 'Lễ cưới ở quảng trường',
    scene: 'Quảng trường đông kín người, bà Grace ngồi ngay hàng ghế đầu.',
    lines: [
      { who: 'narr', vi: 'Ben mặc bộ vest duy nhất của mình, túi áo vẫn lấp ló một thanh sô-cô-la.' },
      { who: 'them', en: '{name}, I promise to make you laugh every day. Even with bad jokes.', vi: '{name}, anh hứa ngày nào cũng làm em cười. Kể cả bằng mấy câu đùa dở.' },
      { who: 'you', en: 'I promise to laugh. Even at the really bad ones.', vi: 'Em hứa sẽ cười. Kể cả những câu dở nhất.' },
      { who: 'them', en: 'And I promise to keep the shop open. For us, and for Dad.', vi: 'Và anh hứa giữ tiệm mở cửa. Vì hai đứa mình, và vì bố.' },
      { who: 'you', en: 'And I promise never to tell Grace about that loaf.', vi: 'Còn em hứa không bao giờ kể với bà Grace vụ ổ bánh mì.' },
    ],
  },
  daily: [
    {
      id: 'shop-daily-1',
      title: 'Tin vui buổi sáng',
      scene: 'Ben chạy từ tiệm về, tay vẫy vẫy tờ hóa đơn.',
      lines: [
        { who: 'them', en: 'Good news! We sold ten loaves before eight.', vi: 'Tin vui! Chưa tới tám giờ đã bán được mười ổ bánh mì.' },
        { who: 'you', en: "That's amazing! Even with the supermarket?", vi: 'Tuyệt quá! Có siêu thị mà vẫn bán được à?' },
        { who: 'them', en: 'People came for the bread. And to see my wife.', vi: 'Người ta đến vì bánh mì. Và để gặp vợ anh.' },
      ],
    },
    {
      id: 'shop-daily-2',
      title: 'Chậu cây số phận',
      scene: 'Chậu cây trên bậu cửa sổ trông héo hơn hôm qua.',
      lines: [
        { who: 'you', en: 'Ben, did you water my plant?', vi: 'Ben, anh tưới cây của em chưa?' },
        { who: 'them', en: 'I looked at it. Does that count?', vi: 'Anh có nhìn nó. Thế có tính không?' },
        { who: 'you', en: "It's brown, Ben.", vi: 'Nó úa nâu rồi kìa, Ben.' },
        { who: 'them', en: "It's autumn-colored. Very stylish.", vi: 'Nó đang mang màu mùa thu. Thời thượng lắm.' },
      ],
    },
    {
      id: 'shop-daily-3',
      title: 'Kẻ trộm sô-cô-la',
      scene: 'Hộp sô-cô-la trong tủ bếp trống trơn.',
      lines: [
        { who: 'you', en: 'Where did all the chocolate go?', vi: 'Sô-cô-la đi đâu hết rồi?' },
        { who: 'them', en: 'Thieves. Very hungry thieves.', vi: 'Có trộm. Một băng trộm rất đói.' },
        { who: 'you', en: "There's chocolate on your shirt.", vi: 'Áo anh dính sô-cô-la kìa.' },
        { who: 'them', en: 'Okay. One very hungry thief.', vi: 'Thôi được. Một tên trộm rất đói.' },
      ],
    },
    {
      id: 'shop-daily-4',
      title: 'Tối thứ Sáu',
      scene: 'Ben xếp ghế quanh chiếc bàn cờ trong tiệm.',
      lines: [
        { who: 'them', en: 'Game night tonight. Are you on my team?', vi: 'Tối nay chơi cờ. Em về đội anh nhé?' },
        { who: 'you', en: 'Only if you stop cheating.', vi: 'Được, nếu anh thôi ăn gian.' },
        { who: 'them', en: "I don't cheat. I just read the rules creatively.", vi: 'Anh đâu có ăn gian. Anh chỉ đọc luật một cách sáng tạo.' },
      ],
    },
    {
      id: 'shop-daily-5',
      title: 'Vị mì mới',
      scene: 'Ben ôm về một thùng giấy có mùi cay cay.',
      lines: [
        { who: 'them', en: 'A new flavor came in. Extra spicy. Want to share?', vi: 'Có vị mới về. Siêu cay. Mình ăn chung nhé?' },
        { who: 'you', en: 'Only half. You always eat my half anyway.', vi: 'Một nửa thôi. Đằng nào anh cũng ăn luôn nửa của em.' },
        { who: 'them', en: "That's love. Sharing noodles is love.", vi: 'Thế mới là yêu. Chia nhau bát mì là yêu.' },
      ],
    },
    {
      id: 'shop-daily-6',
      title: 'Em mở tiệm hôm nay',
      scene: 'Ben ngáp dài bên cửa, chùm chìa khóa tiệm lủng lẳng trên tay.',
      lines: [
        { who: 'you', en: 'Want me to open the shop today?', vi: 'Hôm nay để em mở tiệm nhé?' },
        { who: 'them', en: "Would you? Then I'll make breakfast.", vi: 'Thật à? Vậy anh làm bữa sáng.' },
        { who: 'you', en: 'Not noodles, please.', vi: 'Đừng là mì nhé.' },
        { who: 'them', en: 'Fine. Toast. Boring married-man toast.', vi: 'Thôi được. Bánh mì nướng. Bánh mì nướng của ông chồng nhạt nhẽo.' },
      ],
    },
    {
      id: 'shop-daily-7',
      title: 'Cuốn truyện của bố',
      scene: 'Ben ngồi sau quầy, lật một cuốn truyện tranh cũ đã ngả vàng.',
      lines: [
        { who: 'them', en: "I found one of Dad's old comics. Look, he wrote his name inside.", vi: 'Anh tìm được một cuốn truyện cũ của bố. Nhìn này, bố ghi tên ở trong.' },
        { who: 'you', en: "He'd be proud of you, you know.", vi: 'Bố sẽ tự hào về anh lắm, anh biết không.' },
        { who: 'them', en: "He'd be proud of us. Mostly you.", vi: 'Bố sẽ tự hào về hai đứa mình. Chủ yếu là em.' },
      ],
    },
    {
      id: 'shop-daily-8',
      title: 'Hai trăm viên pin',
      scene: 'Tối, Ben về nhà, mặt vừa mệt vừa hớn hở.',
      lines: [
        { who: 'you', en: 'Long day?', vi: 'Hôm nay dài lắm à?' },
        { who: 'them', en: 'Long day. But a guy bought two hundred batteries.', vi: 'Dài lắm. Nhưng có ông mua hai trăm viên pin.' },
        { who: 'you', en: 'Two hundred? Who needs that many?', vi: 'Hai trăm á? Ai cần nhiều thế?' },
        { who: 'them', en: "I didn't ask. I just said thank you.", vi: 'Anh không hỏi. Anh chỉ nói cảm ơn thôi.' },
      ],
    },
  ],
};
