// "Vụ án ở thị trấn", case 3 (docs/town.md §17; contract: core/town/caseTypes.ts): every morning an unsigned note is
// on Tom's notice board (a line of a poem, a riddle, a small kind message), and Tom cannot work out who leaves them.
//
// What really happened (a kindness with a reason): Lily writes them. When she was new in town and knew nobody
// (data/stories/park.ts, park-7), she used to stop at a card Tom kept in one corner of the board: "New here? Come and
// say hello." She never dared to, but it made her feel there was room for her. Now, when she takes Pip out before her
// six o'clock running club, she pins a note in that same corner for whoever feels the way she did: lines copied from
// a poetry book she borrowed from Daniel's library corner, a riddle, a kind word. Her first note answered Tom's card:
// "New in town? So was I. It gets better." Unsigned, because a kind word needs no thanks.
//
// The clues, one a chapter: 1 the note goes up in the early morning (no new note at 5:15, there at 6:10 when Tom is
// back with his bread; Tom was at Ben's at six, so not Tom); 2 about half past five a hooded somebody at the board
// jogs off toward the park (Sam and Chip are at the station, nobody on the hill); 3 not Daniel: the lines are from a
// poetry book of his library, and the borrower is a "she"; 4 the first note says its writer was once new in town
// (Lily, heard in that chapter, says what a kind word means to a newcomer and leaves with Pip); 5 the little dog at
// the board at 5:40 was Pip, not Chip, and the notes sit where Tom's old welcome card was. Kim (a woman who runs in
// the morning) is the rival suspect until chapter 5: she starts at six and only goes round the park
// (data/stories/clinic.ts). The times never contradict each other: keep them so.
//
// Level 3, the detail that is easy to mishear: five fifteen / five fifty (1), a correction mid-sentence, farm → park
// (2), he / she (3), a correction, first ↔ second (4), Chip / Pip (5).
import type { TownCase } from '../../core/town/caseTypes';

export const CASE: TownCase = {
  id: 'case-3',
  title: 'Ai dán những tờ giấy lạ lên bảng tin?',
  level: 3,
  friend: 'board',
  chapters: [
    {
      title: 'Kỳ 1: Tờ giấy không tên',
      scene: 'Sáng sớm, Tom chỉ cho bạn một tờ giấy nhỏ viết tay ghim ở góc bảng tin: một câu thơ, không ký tên. Sáng nào cũng có một tờ mới, và anh chịu, không biết của ai.',
      testimonies: [
        {
          placeId: 'board',
          lines: [
            { text: 'I check the board at ten every night. Nothing new, ever.', vi: 'Tối nào mười giờ tôi cũng xem lại bảng tin. Chưa bao giờ có gì mới.' },
            { text: "At six I walk down to Ben's for my bread.", vi: 'Sáu giờ sáng tôi đi bộ xuống tiệm Ben mua bánh mì.' },
            { text: "I'm back by ten past six, and there it is. Every single morning.", vi: 'Sáu giờ mười tôi về tới nơi thì nó đã ở đó rồi. Sáng nào cũng vậy.' },
          ],
        },
        {
          placeId: 'square',
          lines: [
            { text: 'I start my rounds early. The plaza first, then the market street.', vi: 'Tôi đi một vòng từ sớm. Quảng trường trước, rồi tới phố chợ.' },
            { text: 'I passed the board at five fifteen, and there was no new note.', vi: 'Năm giờ mười lăm tôi đi ngang bảng tin, chưa có tờ giấy mới nào.' },
            { text: 'Not a soul around, either. Just me and my broom.', vi: 'Xung quanh cũng chẳng có ai. Chỉ có tôi với cây chổi.' },
          ],
        },
        {
          placeId: 'shop',
          lines: [
            { text: 'Tom was in here at six on the dot, same as always.', vi: 'Tom có mặt ở đây đúng sáu giờ, như mọi ngày.' },
            { text: 'He left with his loaf at about five past.', vi: 'Khoảng sáu giờ năm thì anh ấy cầm ổ bánh mì ra về.' },
            { text: "So no, he's not writing them himself. Sorry, detective.", vi: 'Nên không, anh ấy không tự viết đâu. Tiếc nhé, thám tử.' },
          ],
        },
      ],
      question: 'Sáng nay, lúc mấy giờ bảng tin vẫn chưa có tờ giấy mới?',
      options: ['5 giờ 50', '5 giờ 15', '6 giờ 10'],
      answer: 1,
      hint: 1,
      clue: 'Tờ giấy không được dán ban đêm: 5 giờ 15 sáng bảng tin chưa có gì, 6 giờ 10 Tom mua bánh mì về thì nó đã ở đó. Và Tom không tự viết: đúng 6 giờ anh đang ở tiệm Ben.',
      cliffhanger: 'Giờ đó trời còn chưa sáng hẳn. Cả thị trấn đang ngủ, vậy ai đã ra đường?',
    },
    {
      title: 'Kỳ 2: Ai dậy sớm thế?',
      scene: 'Bạn đi tìm những người dậy sớm nhất thị trấn: Max có tiệm ngay cạnh bảng tin, Sam mở bến xe từ tinh mơ, còn Zoe sáng nay lên đồi quay cảnh mặt trời mọc.',
      testimonies: [
        {
          placeId: 'phone',
          lines: [
            { text: 'I was up at half five, mate, ringing my nan back home.', vi: 'Năm rưỡi sáng tôi đã dậy rồi, gọi điện cho bà tôi ở bên nhà.' },
            { text: "Somebody was at the board with their hood up. Couldn't see a face.", vi: 'Có người đứng ở bảng tin, trùm mũ kín. Tôi không thấy mặt.' },
            { text: 'Then they jogged off toward the farm... no, sorry, toward the park.', vi: 'Rồi người đó chạy về phía nông trại... à không, nhầm, về phía công viên.' },
          ],
        },
        {
          placeId: 'station',
          lines: [
            { text: 'Chip and I open the station at half past five.', vi: 'Năm rưỡi sáng tôi với Chip mở cửa bến xe.' },
            { text: "We don't go anywhere till the first bus leaves at six.", vi: 'Tôi với nó ở yên đó cho tới khi chuyến xe đầu tiên chạy lúc sáu giờ.' },
            { text: "So I'm no help, sorry. I can't see the board from down here.", vi: 'Nên tôi chịu, xin lỗi nhé. Từ dưới này tôi không nhìn thấy bảng tin.' },
          ],
        },
        {
          placeId: 'cinema',
          lines: [
            { text: 'I was up on the hill before sunrise, filming for my short film.', vi: 'Tôi lên đồi từ trước lúc mặt trời mọc để quay cho phim ngắn của tôi.' },
            { text: "I could see lights on at Ben's shop and down at the bus station.", vi: 'Tôi thấy tiệm của Ben sáng đèn, dưới bến xe cũng sáng đèn.' },
            { text: "Nobody came up the hill, though. I'd have caught them on camera.", vi: 'Nhưng chẳng ai lên đồi cả. Có thì máy quay của tôi đã ghi lại rồi.' },
          ],
        },
      ],
      question: 'Rời bảng tin, người trùm mũ chạy về hướng nào?',
      options: ['Về phía nông trại', 'Về phía bến xe', 'Về phía công viên'],
      answer: 2,
      hint: 0,
      clue: 'Khoảng 5 rưỡi sáng, một người trùm mũ đứng ở bảng tin rồi chạy bộ về phía công viên. Giờ đó Sam và chú chó Chip đang ở bến xe, và không ai lên đồi.',
      cliffhanger: 'Một người chạy bộ lúc tinh mơ? Vậy mà cả thị trấn lại đang đoán một cái tên khác hẳn: thầy Daniel.',
    },
    {
      title: 'Kỳ 3: Có phải thầy Daniel?',
      scene: 'Ai cũng bảo người viết chắc chắn là thầy Daniel. Bạn cầm tờ giấy sáng nay, một câu thơ, tới góc thư viện của trường, rồi hỏi thêm Mia và Sarah.',
      testimonies: [
        {
          placeId: 'friend',
          lines: [
            { text: "Oh, come on, it's totally Daniel. He loves this kind of thing.", vi: 'Thôi nào, chắc chắn là thầy Daniel rồi. Thầy mê mấy trò này lắm.' },
            { text: 'He gave us a poem for homework just last week!', vi: 'Mới tuần trước thầy còn giao cho lớp mình một bài thơ làm bài tập về nhà!' },
            { text: 'And he pins the best ones up on the classroom wall.', vi: 'Bài nào hay nhất thầy còn ghim lên tường lớp nữa.' },
          ],
        },
        {
          placeId: 'school',
          lines: [
            { text: "Everyone thinks it's me. I'm flattered, but I'm afraid it isn't.", vi: 'Ai cũng nghĩ là thầy. Nghe cũng thích đấy, nhưng tiếc là không phải.' },
            { text: "I do know these lines. They're from a poetry book in my library.", vi: 'Nhưng mấy câu này thì thầy biết. Chúng nằm trong một cuốn thơ ở thư viện của thầy.' },
            { text: "I never say who borrows what. But she's just renewed it, so she must love it.", vi: 'Ai mượn sách gì thầy không bao giờ nói. Nhưng cô ấy vừa gia hạn, chắc là thích cuốn đó lắm.' },
          ],
        },
        {
          placeId: 'office',
          lines: [
            { text: "Sorry, I've only got a minute. Let me see the note.", vi: 'Xin lỗi, tôi chỉ có một phút thôi. Cho tôi xem tờ giấy nào.' },
            { text: "That's good paper. It's torn out of a proper notebook.", vi: 'Giấy tốt đấy. Xé ra từ một cuốn sổ tử tế.' },
            { text: "And it's so neat. Whoever wrote this took their time.", vi: 'Mà chữ nắn nót quá. Ai viết tờ này cũng viết rất thong thả.' },
          ],
        },
      ],
      question: 'Người đang mượn cuốn thơ của thư viện là ai?',
      options: ['Một phụ nữ', 'Một người đàn ông', 'Chính thầy Daniel'],
      answer: 0,
      hint: 1,
      clue: 'Thầy Daniel không viết. Những câu thơ được chép từ một cuốn thơ của góc thư viện, và người đang mượn cuốn đó là một phụ nữ.',
      cliffhanger: 'Một phụ nữ, ra đường lúc tinh mơ... Nhưng vì sao lại là bảng tin? Bà Grace bảo bà đã chép lại mọi tờ giấy, kể từ tờ đầu tiên.',
    },
    {
      title: 'Kỳ 4: Tờ giấy đầu tiên',
      scene: 'Bà Grace chép từng tờ giấy vào cuốn nhật ký của bà. Bạn ghé nghe bà đọc lại, rồi hỏi thêm Max và Lily, lúc ấy đang dắt chú chó Pip đi ngang.',
      testimonies: [
        {
          placeId: 'home',
          lines: [
            { text: "I copy every one into my diary, dear. I've got them all.", vi: 'Tờ nào bà cũng chép vào nhật ký, cháu ạ. Bà có đủ hết.' },
            { text: 'The first one was a riddle. No, wait, that was the second.', vi: 'Tờ đầu tiên là một câu đố. À không, khoan, đó là tờ thứ hai.' },
            { text: "The first one said, 'New in town? So was I. It gets better.'", vi: 'Tờ đầu tiên viết: “Mới đến thị trấn à? Tôi cũng từng thế. Rồi sẽ ổn thôi.”' },
          ],
        },
        {
          placeId: 'phone',
          lines: [
            { text: "Best one was last Friday's, mate. 'Call your grandma. She misses you.'", vi: 'Hay nhất là tờ thứ Sáu tuần trước. “Gọi cho bà của bạn đi. Bà nhớ bạn đấy.”' },
            { text: "I rang my nan that night. I've rung her every morning since.", vi: 'Tối đó tôi gọi cho bà tôi luôn. Từ hôm ấy sáng nào tôi cũng gọi.' },
          ],
        },
        {
          placeId: 'park',
          lines: [
            { text: "Oh, the notes? I think they're lovely. I hope Tom keeps them up.", vi: 'Ồ, mấy tờ giấy ấy à? Mình thấy dễ thương mà. Mong là Tom cứ để yên đó.' },
            { text: "When you're new somewhere, one kind word can change your whole week.", vi: 'Khi mới tới một nơi lạ, một lời tử tế có thể làm cả tuần của mình khác hẳn.' },
            { text: "Sorry, I've got to run. Pip wants his breakfast.", vi: 'Xin lỗi, mình phải chạy đây. Pip đòi ăn sáng rồi.' },
          ],
        },
      ],
      question: 'Tờ giấy đầu tiên viết gì?',
      options: ['Một câu đố', '“Mới đến thị trấn à? Tôi cũng từng thế.”', '“Gọi cho bà của bạn đi.”'],
      answer: 1,
      hint: 0,
      clue: 'Tờ đầu tiên không phải câu đố mà là một lời nhắn: “Mới đến thị trấn à? Tôi cũng từng thế. Rồi sẽ ổn thôi.” Người viết từng là người lạ ở chính thị trấn này.',
      cliffhanger: 'Từng là người mới, là phụ nữ, ra đường lúc tinh mơ... Sáng mai Emma có chuyện muốn kể: cô đã thấy người trùm mũ ở bảng tin, và người đó không đi một mình.',
    },
    {
      title: 'Kỳ 5: Người trùm mũ',
      scene: 'Sáng nay lại có một tờ giấy mới. Emma chạy sang tìm bạn và Tom, còn Kim thì đã phát ngán vì bị cả thị trấn nghi.',
      testimonies: [
        {
          placeId: 'clinic',
          lines: [
            { text: "People keep asking if it's me, because I run every morning.", vi: 'Ai cũng hỏi có phải tôi không, vì sáng nào tôi cũng chạy bộ.' },
            { text: "But I don't start till six, and I only go around the park.", vi: 'Nhưng sáu giờ tôi mới bắt đầu, mà tôi chỉ chạy quanh công viên thôi.' },
            { text: "Besides, have you seen my handwriting? Even I can't read it.", vi: 'Với lại, bạn thấy chữ tôi chưa? Đến tôi còn không đọc nổi.' },
          ],
        },
        {
          placeId: 'cafe',
          lines: [
            { text: "At twenty to six, I was at Ben's, picking up milk for the café.", vi: 'Sáu giờ kém hai mươi, tôi đang ở tiệm Ben lấy sữa cho quán.' },
            { text: 'Somebody in a hood was at the board, with a little dog.', vi: 'Có người trùm mũ đứng ở bảng tin, bên cạnh là một con chó nhỏ.' },
            { text: "I called, 'Chip!' But it wasn't Chip. It was Pip, Lily's little dog.", vi: 'Tôi gọi: “Chip!” Nhưng không phải Chip. Đó là Pip, con chó nhỏ của Lily.' },
          ],
        },
        {
          placeId: 'board',
          lines: [
            { text: "Here's the strange part. They're always pinned in the same corner.", vi: 'Lạ ở chỗ này. Tờ nào cũng được ghim đúng một góc đó.' },
            { text: "That's where my old card used to be: 'New here? Come and say hello.'", vi: 'Đó là chỗ tấm thiệp cũ của tôi từng nằm: “Mới đến à? Ghé chào một tiếng nhé.”' },
            { text: 'I took it down months ago. I thought nobody ever read it.', vi: 'Tôi gỡ nó xuống mấy tháng trước rồi. Tôi cứ tưởng chưa ai từng đọc nó.' },
          ],
        },
      ],
      question: 'Vậy ai là người dán những tờ giấy lên bảng tin?',
      options: ['Lily', 'Sam', 'Kim'],
      answer: 0,
      hint: 1,
      clue: 'Con chó nhỏ đứng cạnh người trùm mũ lúc 6 giờ kém 20 là Pip, không phải Chip của Sam. Người dán giấy là Lily, và cô luôn ghim vào đúng góc từng có tấm thiệp chào người mới của Tom.',
      cliffhanger: '',
    },
  ],
  ending:
    'Người viết là Lily: hồi mới chuyển tới, chẳng quen ai, cô vẫn hay dừng lại đọc tấm thiệp của Tom ở góc bảng tin, “Mới đến à? Ghé chào một tiếng nhé”, và nhờ nó mà thấy thị trấn này có chỗ cho mình. Giờ đã hết lạc lõng, sáng nào dắt Pip ra ngoài trước giờ chạy bộ, cô cũng ghim vào đúng góc ấy một câu thơ chép từ cuốn sách mượn của thầy Daniel, một câu đố hay một lời nhắn cho bất kỳ ai đang cô đơn như cô ngày trước; tờ đầu tiên chính là lời cô đáp lại tấm thiệp, còn tên thì cô không ký, vì lời tử tế đâu cần ai cảm ơn. Nghe xong, Tom lặng lẽ ghim tấm thiệp cũ của mình trở lại, ngay bên cạnh tờ giấy của Lily.',
};
