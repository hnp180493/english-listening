// "Vụ án ở thị trấn", case 2 (docs/town.md §17; contract: core/town/caseTypes.ts): Emma's grandmother's recipe
// notebook (data/stories/cafe.ts, cafe-7) is gone the day before the festival.
//
// What really happened (a mix-up, nobody is a thief): the notebook is a thin old school notebook with a blue cover and
// no name, and hardly anybody has ever seen it. On Thursday around five Emma put it on the window table. Daniel sat
// down there with thirty blue homework books and a pot of tea, then rushed back to school for his Thursday club
// (data/stories/school.ts) and swept every blue book into his bag: thirty-one of them.
//
// The clues, one a chapter: 1 where and when it was last put down (the window table, about five); 2 a red herring
// (Tom left at half past five with a notebook; Sarah had left at four); 3 Tom's is new and red, Emma's is blue, thin,
// unnamed, a school notebook; 4 one thin blue book on that table at 5:05, a pile of blue books at 5:20; 5 Daniel
// took thirty books in and counted thirty-one. Thursday's times never contradict each other: keep them so.
import type { TownCase } from '../../core/town/caseTypes';

export const CASE: TownCase = {
  id: 'case-2',
  title: 'Cuốn sổ công thức của Emma biến mất',
  level: 2,
  friend: 'cafe',
  chapters: [
    {
      title: 'Kỳ 1: Cuốn sổ không cánh mà bay',
      scene: 'Sáng thứ Sáu, một ngày trước lễ hội. Emma lục tung cả quán: cuốn sổ công thức của bà, cuốn có món bánh chanh, không thấy đâu nữa.',
      testimonies: [
        {
          placeId: 'friend',
          lines: [
            { text: 'I stopped by at lunch on Thursday for a slice of lemon cake.', vi: 'Trưa thứ Năm tôi ghé quán ăn một miếng bánh chanh.' },
            { text: 'Emma was in the kitchen, reading from a little book on the shelf.', vi: 'Emma đang ở trong bếp, đọc một cuốn sổ nhỏ để trên kệ.' },
            { text: "She wouldn't let me peek. She never lets anybody see it.", vi: 'Cô ấy không cho tôi ngó. Cuốn đó cô ấy chẳng cho ai xem bao giờ.' },
          ],
        },
        {
          placeId: 'station',
          lines: [
            { text: 'I grabbed an iced latte at the counter on Thursday, around four.', vi: 'Thứ Năm, tầm bốn giờ, tôi ghé quầy mua một ly latte đá.' },
            { text: 'There was an old book right next to the coffee machine.', vi: 'Có một cuốn sổ cũ nằm ngay cạnh máy pha cà phê.' },
            { text: "Chip gave it a sniff, but I swear he didn't touch it.", vi: 'Chip có hít hít một cái, nhưng tôi thề là nó không đụng vào.' },
          ],
        },
        {
          placeId: 'cafe',
          lines: [
            { text: 'I was baking for the festival all Thursday afternoon.', vi: 'Cả chiều thứ Năm tôi nướng bánh cho lễ hội.' },
            { text: 'Around five, I needed the counter, so I put the book on the window table.', vi: 'Khoảng năm giờ tôi cần chỗ trên quầy, nên đặt cuốn sổ sang bàn cạnh cửa sổ.' },
            { text: "It was so busy, I couldn't tell you who sat where.", vi: 'Hôm đó đông quá, tôi chẳng nhớ nổi ai ngồi chỗ nào.' },
          ],
        },
      ],
      question: 'Chiều thứ Năm, cuối cùng Emma đặt cuốn sổ ở đâu?',
      options: ['Trên kệ trong bếp', 'Trên quầy, cạnh máy pha cà phê', 'Trên bàn cạnh cửa sổ'],
      answer: 2,
      hint: 2,
      clue: 'Khoảng 5 giờ chiều thứ Năm, Emma đặt cuốn sổ lên bàn cạnh cửa sổ. Đó là chỗ cuối cùng cô nhớ đã để nó.',
      cliffhanger: 'Chiều hôm đó quán đông nghịt. Và Leo vừa nhớ ra: anh đã thấy một người vội vã rời quán, dưới nách kẹp một cuốn sổ.',
    },
    {
      title: 'Kỳ 2: Người kẹp sổ rời quán',
      scene: 'Trưa thứ Sáu, bạn đi hỏi những người đã có mặt quanh quán Emma chiều thứ Năm.',
      testimonies: [
        {
          placeId: 'square',
          lines: [
            { text: "I was sweeping the street outside Emma's on Thursday, about half past five.", vi: 'Thứ Năm, tầm năm rưỡi, tôi đang quét đường ngay trước quán Emma.' },
            { text: 'Tom came out of the cafe with a notebook under his arm.', vi: 'Tom từ trong quán đi ra, dưới nách kẹp một cuốn sổ.' },
            { text: "He was in such a hurry, he didn't even say hi.", vi: 'Anh ấy vội đến mức chẳng kịp chào tôi một câu.' },
          ],
        },
        {
          placeId: 'home',
          lines: [
            { text: "I had my tea at Emma's on Thursday, dear, till about five.", vi: 'Thứ Năm bà ngồi uống trà ở quán Emma tới khoảng năm giờ, cháu ạ.' },
            { text: 'Sarah sat by the window with a notebook, but she left at four.', vi: 'Sarah ngồi cạnh cửa sổ với một cuốn sổ, nhưng bốn giờ cô ấy đã về rồi.' },
            { text: 'Poor Emma was run off her feet, with flour up to her elbows.', vi: 'Tội nghiệp Emma, bận tối mắt tối mũi, bột dính tới tận khuỷu tay.' },
          ],
        },
        {
          placeId: 'shop',
          lines: [
            { text: "I dropped off more lemons and butter at Emma's back door at four.", vi: 'Bốn giờ tôi giao thêm chanh với bơ ở cửa sau quán Emma.' },
            { text: "I didn't even go inside. I had to get back to the shop.", vi: 'Tôi còn chẳng bước vào trong. Phải quay về tiệm ngay.' },
            { text: 'All I left with was a muffin. Emma gave it to me, I promise.', vi: 'Tôi chỉ cầm về đúng một cái bánh muffin. Emma cho đấy, thề luôn.' },
          ],
        },
      ],
      question: 'Leo thấy ai kẹp một cuốn sổ đi ra khỏi quán Emma?',
      options: ['Sarah', 'Tom', 'Ben'],
      answer: 1,
      hint: 0,
      clue: 'Khoảng 5 rưỡi chiều thứ Năm, Tom vội vã rời quán Emma, dưới nách kẹp một cuốn sổ. Sarah có ngồi cạnh cửa sổ với cuốn sổ của mình, nhưng 4 giờ đã về.',
      cliffhanger: 'Tom mê sổ tay thì cả thị trấn đều biết. Nhưng cuốn anh kẹp dưới nách hôm đó là sổ của ai?',
    },
    {
      title: 'Kỳ 3: Cuốn sổ của Tom',
      scene: 'Chiều thứ Sáu, Tom đang dán áp phích lễ hội ở bảng tin, dưới nách vẫn kẹp một cuốn sổ. Emma và bà Grace cũng vừa tới.',
      testimonies: [
        {
          placeId: 'board',
          lines: [
            { text: "This one's mine. I bought it at Ben's on Thursday.", vi: 'Cuốn này của tôi mà. Tôi mua ở tiệm Ben hôm thứ Năm.' },
            { text: "Look, it's bright red, and there's nothing in it but my festival list.", vi: 'Nhìn này, bìa đỏ chót, bên trong chỉ có mỗi danh sách việc lễ hội.' },
            { text: "I only ran into Emma's to ask about the cakes.", vi: 'Tôi chỉ chạy vào quán Emma để hỏi chuyện bánh thôi.' },
          ],
        },
        {
          placeId: 'cafe',
          lines: [
            { text: "No, that's not it. Mine's blue, and it's really thin.", vi: 'Không, không phải cuốn đó. Sổ của tôi bìa xanh dương, mỏng lắm.' },
            { text: 'Grandma wrote her recipes in an old school notebook.', vi: 'Bà tôi chép công thức vào một cuốn vở học sinh cũ.' },
            { text: "There's no name on it, and hardly anybody's ever seen it.", vi: 'Trên bìa không ghi tên, mà cũng gần như chưa ai nhìn thấy nó.' },
          ],
        },
        {
          placeId: 'home',
          lines: [
            { text: "Don't look at me, dear. My diary's green, and it never leaves my kitchen table.", vi: 'Đừng nhìn bà thế chứ cháu. Nhật ký của bà bìa xanh lá, mà nó chẳng bao giờ rời bàn bếp nhà bà.' },
            { text: "I've kept a diary since I was nine, you know.", vi: 'Bà viết nhật ký từ hồi chín tuổi đấy, cháu biết không.' },
          ],
        },
      ],
      question: 'Cuốn sổ công thức của Emma có bìa màu gì?',
      options: ['Xanh dương', 'Đỏ', 'Xanh lá'],
      answer: 0,
      hint: 1,
      clue: 'Sổ của Emma bìa xanh dương, mỏng, không ghi tên: vốn là một cuốn vở học sinh cũ, và gần như chưa ai từng thấy nó. Cuốn Tom kẹp dưới nách là sổ bìa đỏ anh mới mua ở tiệm Ben.',
      cliffhanger: 'Tom vô can. Nhưng Max vừa nhắn: chiều thứ Năm anh quay video ngay trong quán Emma, và cái bàn cạnh cửa sổ lọt vào khung hình.',
    },
    {
      title: 'Kỳ 4: Đoạn video của Max',
      scene: 'Tối thứ Sáu ở tiệm điện thoại, Max mở lại đoạn video anh quay trong quán Emma. Zoe và Kim cũng ghé xem.',
      testimonies: [
        {
          placeId: 'phone',
          lines: [
            { text: "I filmed Thursday's video at Emma's, mate. Twenty past five, it says here.", vi: 'Video hôm thứ Năm tôi quay ở quán Emma đấy bạn. Máy ghi đây này: năm giờ hai mươi.' },
            { text: "See the window table behind me? There's a big pile of blue books on it.", vi: 'Thấy cái bàn cạnh cửa sổ sau lưng tôi không? Trên đó có cả một chồng vở bìa xanh.' },
            { text: "And a pot of tea. But there's nobody in the chair.", vi: 'Với một ấm trà. Nhưng trên ghế chẳng có ai ngồi.' },
          ],
        },
        {
          placeId: 'cinema',
          lines: [
            { text: "I've watched it like ten times. You never see who's sitting there.", vi: 'Tôi xem đi xem lại cả chục lần rồi. Không lúc nào thấy được ai ngồi ở đó.' },
            { text: 'Max posted it at six, and nobody noticed a thing.', vi: 'Max đăng video lúc sáu giờ, mà chẳng ai để ý thấy gì.' },
            { text: "Whoever it is, they've got a lot of reading to do.", vi: 'Dù là ai thì người đó cũng có cả đống thứ phải đọc.' },
          ],
        },
        {
          placeId: 'clinic',
          lines: [
            { text: 'I picked up a green tea to go at five past five.', vi: 'Năm giờ năm tôi ghé mua một cốc trà xanh mang đi.' },
            { text: 'The window table was free then. Just one thin blue book on it.', vi: 'Lúc đó bàn cạnh cửa sổ còn trống. Trên bàn chỉ có đúng một cuốn sổ mỏng bìa xanh.' },
            { text: 'I nearly sat down, but I had a patient waiting.', vi: 'Tôi suýt ngồi xuống, nhưng còn bệnh nhân đang chờ.' },
          ],
        },
      ],
      question: 'Max quay được chồng vở bìa xanh trên bàn cạnh cửa sổ lúc mấy giờ?',
      options: ['5 giờ 05', '5 giờ 20', '6 giờ'],
      answer: 1,
      hint: 0,
      clue: 'Lúc 5 giờ 05, trên bàn cạnh cửa sổ chỉ có một cuốn sổ mỏng bìa xanh. Đến 5 giờ 20, chỗ đó đã là cả một chồng vở bìa xanh bên một ấm trà: có người mang rất nhiều vở tới ngồi đúng bàn ấy.',
      cliffhanger: 'Một cuốn sổ mỏng bìa xanh, rồi cả một chồng vở bìa xanh... Ai trong thị trấn hay ôm cả chồng giấy tờ tới quán Emma? Có ba cái tên cần hỏi, mà lễ hội đã sát nút.',
    },
    {
      title: 'Kỳ 5: Sáng ngày lễ hội',
      scene: 'Sáng thứ Bảy, quảng trường đã giăng cờ. Trước giờ khai hội, bạn tìm gặp ba người hay mang việc tới quán Emma: Sarah, Lily và thầy Daniel.',
      testimonies: [
        {
          placeId: 'office',
          lines: [
            { text: 'Yeah, I sat by the window on Thursday, but only till four.', vi: 'Ừ, thứ Năm tôi có ngồi cạnh cửa sổ, nhưng chỉ tới bốn giờ thôi.' },
            { text: "My notebook's black, and it went straight back to the office with me.", vi: 'Sổ của tôi bìa đen, và nó theo tôi về thẳng văn phòng.' },
          ],
        },
        {
          placeId: 'park',
          lines: [
            { text: "I did have a big pile of blue folders at Emma's.", vi: 'Đúng là tôi có mang cả chồng bìa hồ sơ màu xanh tới quán Emma.' },
            { text: 'But that was Wednesday. On Thursday I took Pip to the lake.', vi: 'Nhưng đó là hôm thứ Tư. Thứ Năm tôi dắt Pip ra hồ chơi.' },
            { text: "We didn't get home till it was dark.", vi: 'Trời tối hẳn hai đứa mới về tới nhà.' },
          ],
        },
        {
          placeId: 'school',
          lines: [
            { text: "I marked homework at Emma's on Thursday, then rushed back to school.", vi: 'Thứ Năm thầy ngồi chấm bài ở quán Emma, rồi vội chạy về trường.' },
            { text: "Funny thing, though. I took thirty books in, I'm sure of it.", vi: 'Mà có chuyện lạ lắm. Thầy mang tới đúng ba mươi cuốn vở, chắc chắn thế.' },
            { text: "This morning I counted thirty-one. Rather odd, isn't it?", vi: 'Sáng nay thầy đếm lại thì ra ba mươi mốt cuốn. Kỳ lạ nhỉ, em?' },
          ],
        },
      ],
      question: 'Ai đã vô tình mang cuốn sổ của Emma đi?',
      options: ['Thầy Daniel', 'Lily', 'Sarah'],
      answer: 0,
      hint: 2,
      clue: 'Chiều thứ Năm thầy Daniel mang 30 cuốn vở bài tập tới quán Emma, sáng nay đếm lại thành 31: cuốn thừa ra chính là sổ công thức bìa xanh của Emma.',
      cliffhanger: '',
    },
  ],
  ending:
    'Chiều thứ Năm, thầy Daniel ngồi chấm bài bên ấm trà ở bàn cạnh cửa sổ; lúc vội chạy về trường cho kịp buổi câu lạc bộ hội thoại, thầy gom luôn cuốn sổ mỏng bìa xanh của Emma vào chồng ba mươi cuốn vở bài tập, vì trông nó y hệt một cuốn vở học viên. Mở cuốn thứ ba mươi mốt ra, ngay trang đầu là công thức bánh chanh của bà Emma: thầy đỏ mặt, ôm sổ chạy thẳng tới quán. Emma kịp nướng bánh cho lễ hội, và miếng đầu tiên, kèm một tách trà mật ong, cô dành cho thầy Daniel.',
};
