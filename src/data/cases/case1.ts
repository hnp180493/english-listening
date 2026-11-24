// "Vụ án ở thị trấn", case 1 (docs/town.md §17; contract: core/town/caseTypes.ts): the wishing coins are gone from
// the plaza fountain on the Monday Leo comes to clean it (he collects them every Monday and they pay for the flowers
// round the plaza: data/streetTalks/square.ts, st-square-2).
//
// What really happened (a surprise, nobody is a thief): Kim fished the coins out at five on Monday morning, before her
// six o'clock run in the park (data/stories/clinic.ts), with a little green net from Ben's shop and a yellow bucket,
// and ran them down the main road to the clinic, next door to the school. The coins did what they always do, they
// bought flowers for the plaza: this time young sunflowers, Leo's favourite (square-4) and the flower Kim plants
// every spring, kept in pots behind the clinic. Unsigned notes ask the town to the fountain on Saturday at eight, with
// spades, behind Leo's back: a thank-you to the one who looks after the plaza and keeps nothing for himself.
//
// The clues, one a chapter: 1 five in the morning, in the dark, one person (Sam heard the splashing); 2 a wet green
// fishing net under the bench by the fountain (and Grace says what the coins are for); 3 Ben sold three such nets:
// Sam, Lily, Kim, and Sam's has been dry in Max's bag since Sunday; 4 at five thirty somebody ran a yellow bucket down
// the main road and stopped near the school, and at six Kim (park) and Lily (lake) were both where they always are, so
// neither is cleared; 5 the yellow bucket and the sunflowers are behind the clinic. Monday's times never contradict
// each other (ten the night before, five, five thirty, six, six thirty): keep them so. Kim never testifies.
import type { TownCase } from '../../core/town/caseTypes';

export const CASE: TownCase = {
  id: 'case-1',
  title: 'Ai lấy xu trong đài phun nước?',
  level: 1,
  friend: 'square',
  chapters: [
    {
      title: 'Kỳ 1: Đài phun nước cạn xu',
      scene: 'Sáng thứ Hai, Leo ra cọ đài phun nước như mọi tuần thì đứng sững lại: dưới đáy không còn một đồng xu nào. Leo nhờ bạn đi hỏi quanh quảng trường.',
      testimonies: [
        {
          placeId: 'square',
          lines: [
            { text: 'Every Monday I clean the fountain and collect the coins.', vi: 'Thứ Hai nào tôi cũng cọ đài phun nước và nhặt xu.' },
            { text: 'I walked past at ten last night, and they were all there.', vi: 'Mười giờ tối qua tôi đi ngang, xu vẫn còn nguyên.' },
            { text: 'This morning? Nothing. Not one single coin!', vi: 'Sáng nay á? Sạch trơn. Không còn một đồng nào!' },
          ],
        },
        {
          placeId: 'cafe',
          lines: [
            { text: 'I opened the café at six thirty, same as always.', vi: 'Tôi mở quán lúc sáu rưỡi, như mọi ngày.' },
            { text: "The plaza was empty. I didn't see anybody at all.", vi: 'Quảng trường vắng tanh. Tôi chẳng thấy ai cả.' },
            { text: 'But the ground by the fountain was all wet.', vi: 'Nhưng nền đất cạnh đài phun nước thì ướt nhẹp.' },
          ],
        },
        {
          placeId: 'station',
          lines: [
            { text: 'Chip and I crossed the plaza at five, on our way to the station.', vi: 'Năm giờ, tôi với Chip đi ngang quảng trường để ra bến xe.' },
            { text: 'Somebody was at the fountain. I could hear splashing.', vi: 'Có ai đó ở chỗ đài phun nước. Tôi nghe tiếng khua nước bì bõm.' },
            { text: 'It was too dark to see who it was, sorry.', vi: 'Trời tối quá nên tôi không nhìn ra là ai, tiếc thật.' },
          ],
        },
      ],
      question: 'Sam nghe thấy tiếng nước ở đài phun nước lúc mấy giờ?',
      options: ['Mười giờ tối hôm trước', 'Năm giờ sáng', 'Sáu rưỡi sáng'],
      answer: 1,
      hint: 2,
      clue: 'Khoảng năm giờ sáng thứ Hai, lúc trời còn tối, có một người khua nước ở đài phun nước. Sam nghe thấy nhưng không nhìn ra là ai.',
      cliffhanger: 'Trời tối như thế, người đó vớt cả đống xu dưới nước bằng cách nào? Ngày mai, chú chó Pip của Lily sẽ đánh hơi ra một thứ.',
    },
    {
      title: 'Kỳ 2: Thứ nằm dưới ghế đá',
      scene: 'Hôm sau, bạn quay lại quảng trường hỏi thêm: Lily đang dắt Pip đi dạo, Ben đẩy xe hàng ngang qua, còn bà Grace ngồi nghỉ chân.',
      testimonies: [
        {
          placeId: 'park',
          lines: [
            { text: 'Pip found something under the bench by the fountain.', vi: 'Pip vừa tìm thấy một thứ dưới ghế đá cạnh đài phun nước.' },
            { text: "It's a little green fishing net, and it's still wet!", vi: 'Một cái vợt cá nhỏ màu xanh, mà vẫn còn ướt nhé!' },
            { text: 'Who goes fishing in a fountain?', vi: 'Ai lại đi câu cá ở đài phun nước cơ chứ?' },
          ],
        },
        {
          placeId: 'shop',
          lines: [
            { text: 'Things fall in that fountain all the time. Ask Tom about his notebook!', vi: 'Đồ rơi xuống đài phun nước đó suốt. Cứ hỏi Tom vụ cuốn sổ mà xem!' },
            { text: "But coins don't just climb out and walk away, do they?", vi: 'Nhưng xu thì đâu tự bò lên rồi bỏ đi được, đúng không?' },
          ],
        },
        {
          placeId: 'home',
          lines: [
            { text: "Poor Leo. He's sitting over there with his old broom, looking so sad.", vi: 'Tội nghiệp Leo. Cậu ấy ngồi đằng kia, ôm cây chổi cũ, trông buồn lắm.' },
            { text: 'Those coins pay for the flowers round the plaza, you know, dear.', vi: 'Cháu biết không, chỗ xu ấy là để mua hoa trồng quanh quảng trường đấy.' },
            { text: 'He never keeps a penny for himself.', vi: 'Cậu ấy chẳng bao giờ giữ lại cho mình một xu nào.' },
          ],
        },
      ],
      question: 'Pip tìm thấy gì dưới ghế đá cạnh đài phun nước?',
      options: ['Một cái vợt cá nhỏ màu xanh', 'Cuốn sổ của Tom', 'Cây chổi cũ của Leo'],
      answer: 0,
      hint: 0,
      clue: 'Dưới ghế đá cạnh đài phun nước có một cái vợt cá nhỏ màu xanh, vẫn còn ướt. Xu đã được vớt lên bằng cái vợt này.',
      cliffhanger: 'Cái vợt trông quen lắm: hình như tiệm Ben có bán loại này. Ngày mai bạn mang nó tới tiệm, xem Ben còn nhớ đã bán cho ai.',
    },
    {
      title: 'Kỳ 3: Sổ bán hàng của Ben',
      scene: 'Bạn mang cái vợt tới tiệm Ben, rồi lần theo lời Ben đi tìm Sam và Max.',
      testimonies: [
        {
          placeId: 'shop',
          lines: [
            { text: "Yep, that's one of mine. I only sell the green ones.", vi: 'Ừ, đúng hàng tiệm tôi. Tôi chỉ bán loại màu xanh này thôi.' },
            { text: 'I sold three this month. To Sam, to Lily, and to Kim.', vi: 'Tháng này tôi bán được ba cái. Cho Sam, cho Lily và cho Kim.' },
            { text: "So, detective, who's been fishing for wishes?", vi: 'Thế nào, thám tử, ai đang đi câu điều ước đây?' },
          ],
        },
        {
          placeId: 'station',
          lines: [
            { text: 'Sure, I bought one. Max and I go fishing at the pier on Sundays.', vi: 'Ừ, tôi có mua một cái. Chủ nhật nào tôi với Max cũng ra cầu tàu câu cá.' },
            { text: "But I left my net in Max's bag last Sunday.", vi: 'Nhưng Chủ nhật vừa rồi tôi để quên vợt trong túi của Max.' },
          ],
        },
        {
          placeId: 'phone',
          lines: [
            { text: "Yeah, mate, Sam's net is right here in my shop.", vi: 'Ừ bạn ơi, vợt của Sam nằm ngay đây, trong tiệm tôi.' },
            { text: "It's been in my bag since Sunday arvo. Still dry.", vi: 'Nó nằm trong túi tôi từ chiều Chủ nhật. Vẫn khô nguyên.' },
          ],
        },
      ],
      question: 'Tháng này Ben đã bán vợt cho ba người nào?',
      options: ['Sam, Max và Kim', 'Sam, Lily và Max', 'Sam, Lily và Kim'],
      answer: 2,
      hint: 0,
      clue: 'Tháng này Ben chỉ bán ba cái vợt xanh: cho Sam, cho Lily và cho Kim. Vợt của Sam thì vẫn khô nguyên trong túi Max từ chiều Chủ nhật.',
      cliffhanger: 'Vậy là chỉ còn Lily và Kim. Nhưng cả đống xu ướt thì phải đựng vào đâu đó chứ? Ngày mai, một người ra đường từ rất sớm kể lại thứ mình thấy.',
    },
    {
      title: 'Kỳ 4: Những người dậy sớm',
      scene: 'Bạn đi tìm những người đã ra đường từ sớm sáng thứ Hai: Sarah, Tom và Mia.',
      testimonies: [
        {
          placeId: 'office',
          lines: [
            { text: 'I left for the bus station at five thirty. Early meeting in the city.', vi: 'Năm rưỡi tôi ra bến xe. Có cuộc họp sớm trên thành phố.' },
            { text: 'Somebody ran past me with a yellow bucket. I only saw their back.', vi: 'Có người xách cái xô màu vàng chạy vượt qua tôi. Tôi chỉ thấy lưng.' },
            { text: 'They ran down the main road and stopped near the school.', vi: 'Người đó chạy dọc đường lớn rồi dừng lại ở gần trường học.' },
          ],
        },
        {
          placeId: 'board',
          lines: [
            { text: 'I was in the park at six, fixing the old bench.', vi: 'Sáu giờ tôi ở công viên, đang sửa cái ghế đá cũ.' },
            { text: 'Kim ran past, same as every morning. She waved at me.', vi: 'Kim chạy bộ ngang qua, như mọi sáng. Cô ấy còn vẫy tay với tôi.' },
            { text: "No bucket, no coins. Sorry, that's all I saw.", vi: 'Không xô, không xu. Tiếc quá, tôi chỉ thấy có thế.' },
          ],
        },
        {
          placeId: 'friend',
          lines: [
            { text: 'Lily made me try her running club on Monday morning.', vi: 'Sáng thứ Hai Lily bắt mình chạy thử với câu lạc bộ của bạn ấy.' },
            { text: "Six o'clock, two laps around the lake. I nearly died!", vi: 'Sáu giờ sáng, hai vòng quanh hồ. Mình suýt xỉu!' },
            { text: "Nobody there had a bucket. I'd remember that.", vi: 'Ở đó chẳng ai xách xô cả. Có thì mình nhớ ngay.' },
          ],
        },
      ],
      question: 'Người xách xô chạy tới gần chỗ nào thì dừng lại?',
      options: ['Gần trường học', 'Gần bến xe', 'Trong công viên'],
      answer: 0,
      hint: 0,
      clue: 'Khoảng năm rưỡi sáng, một người xách cái xô màu vàng chạy dọc đường lớn rồi dừng ở gần trường học. Đến sáu giờ, Kim đã chạy bộ trong công viên còn Lily chạy quanh hồ như mọi ngày, chẳng ai xách xô.',
      cliffhanger: 'Gần trường học ư? Chẳng lẽ lại là thầy Daniel? Ngày mai, chính thầy gọi bạn lên lớp, bảo nhìn qua cửa sổ.',
    },
    {
      title: 'Kỳ 5: Nhìn từ cửa sổ lớp học',
      scene: 'Thầy Daniel gọi bạn lên phòng học. Cùng lúc đó, bà Grace và Zoe khoe với bạn mấy tờ giấy lạ không ký tên.',
      testimonies: [
        {
          placeId: 'school',
          lines: [
            { text: "It wasn't me, I'm afraid. But do look out of my classroom window.", vi: 'Tiếc là không phải thầy đâu. Nhưng em nhìn qua cửa sổ lớp thầy mà xem.' },
            { text: "There's a yellow bucket behind the clinic, by the back door.", vi: 'Có một cái xô màu vàng sau phòng khám, ngay cạnh cửa sau.' },
            { text: 'And rows of baby sunflowers in little pots. Dozens of them!', vi: 'Và từng hàng hướng dương con trong chậu nhỏ. Hàng chục chậu!' },
          ],
        },
        {
          placeId: 'home',
          lines: [
            { text: 'Somebody put a note under my door, dear. No name on it.', vi: 'Có ai đó nhét tờ giấy dưới cửa nhà bà, cháu ạ. Không ghi tên.' },
            { text: 'It says, Saturday at eight, by the fountain. Bring a spade.', vi: 'Giấy viết: tám giờ thứ Bảy, ở đài phun nước. Mang theo xẻng.' },
            { text: "A spade, at my age! I'll bring biscuits instead.", vi: 'Xẻng, ở tuổi bà! Thôi bà mang bánh quy vậy.' },
          ],
        },
        {
          placeId: 'cinema',
          lines: [
            { text: 'I got a note too. It says, come and film everything on Saturday.', vi: 'Tôi cũng nhận được giấy. Trong đó bảo thứ Bảy tới quay phim lại hết.' },
            { text: "And, like, in big letters: don't tell Leo!", vi: 'Và, kiểu, viết chữ to đùng: đừng nói với Leo!' },
          ],
        },
      ],
      question: 'Vậy ai là người đã vớt xu khỏi đài phun nước?',
      options: ['Lily', 'Kim', 'Sam'],
      answer: 1,
      hint: 0,
      clue: 'Cái xô màu vàng nằm ngay sau phòng khám của Kim, cạnh hàng chục chậu hướng dương con. Người vớt xu là Kim, và cả thị trấn được hẹn ra đài phun nước sáng thứ Bảy, giấu Leo.',
      cliffhanger: '',
    },
  ],
  ending:
    'Người vớt xu là Kim: năm giờ sáng thứ Hai, trước giờ chạy bộ, cô ra đài phun nước với cái vợt và cái xô. Xu ước nguyện xưa nay vẫn để mua hoa cho quảng trường, nên lần này Kim mua luôn loài hướng dương Leo thích nhất, ươm sẵn sau phòng khám, thay cả thị trấn cảm ơn người ngày nào cũng chăm quảng trường mà chẳng giữ lại cho mình xu nào. Sáng thứ Bảy, mọi người mang xẻng ra trồng một vòng hướng dương quanh đài phun nước, còn Leo đứng giữa, cười mà mắt đỏ hoe.',
};
