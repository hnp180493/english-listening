// "Giao hàng cho Emma" (docs/town.md §18): what Emma says when she hands an order over the counter (contract:
// core/town/deliveryTypes.ts). Four orders for each of the twelve residents who are not behind the counter:
// 1 = level 1 (their name and where they are), 2 = level 2 (no name: their job or place), 3–4 = level 3 (no name, no
// job, no workplace: one or two things the learner knows from their stories; each fits exactly one resident, and
// order 3 always rests on their first two episodes or the first episode of their arc). Emma talks as in her arc
// (data/stories/cafe.ts; Vietnamese "tôi / bạn"). Each text names the one tile carried with the counter's wording and
// names no other tile. Ids are stable; never renumber.
import type { DeliveryOrder } from '../core/town/deliveryTypes';

export const DELIVERIES: readonly DeliveryOrder[] = [
  // square · Leo (3: square-1 / cafe-1, he sent the learner to Emma · 4: square-6 a new uncle, square-4 Tuesday board games)
  { id: 'dl-square-1', to: 'square', level: 1, item: 'black-coffee', text: "Can you run this black coffee over to Leo? He's out in the square, by the fountain.", vi: 'Bạn mang ly cà phê đen này qua cho Leo giúp tôi nhé? Anh ấy đang ở quảng trường, cạnh đài phun nước.' },
  { id: 'dl-square-2', to: 'square', level: 2, item: 'water', text: "This bottle of water's for the guy who looks after the square. He's been sweeping since nine.", vi: 'Chai nước này là của anh chàng trông coi quảng trường. Anh ấy quét dọn từ chín giờ tới giờ.' },
  { id: 'dl-square-3', to: 'square', level: 3, item: 'sandwich', text: 'The guy who sent you to me on your very first day? This sandwich is his.', vi: 'Anh chàng đã chỉ bạn tới quán tôi ngay hôm đầu tiên ấy? Cái bánh kẹp này là của anh ấy.' },
  { id: 'dl-square-4', to: 'square', level: 3, item: 'latte', text: "A latte for the new uncle. You know, the one who's obsessed with Tuesday board game night.", vi: 'Một ly latte cho ông cậu mới lên chức. Bạn biết mà, người mê tối cờ bàn thứ Ba ấy.' },

  // friend · Mia (3: friend-1 / friend-2, movie night and the late pizza · 4: friend-4 thirty scarves, friend-3 the haircut under a hat)
  { id: 'dl-friend-1', to: 'friend', level: 1, item: 'lemon-cake', text: 'Take this slice of lemon cake round to Mia, would you? Her place is right by the cafe.', vi: 'Bạn mang miếng bánh chanh này qua cho Mia giúp tôi nhé? Nhà cô ấy ngay cạnh quán thôi.' },
  { id: 'dl-friend-2', to: 'friend', level: 2, item: 'iced-tea', text: "This iced tea's for your friend in the house by the cafe. She's waiting at her window.", vi: 'Ly trà đá này là của cô bạn của bạn, ở căn nhà cạnh quán. Cô ấy đang đợi bên cửa sổ đấy.' },
  { id: 'dl-friend-3', to: 'friend', level: 3, item: 'cookie', text: "She had you over for movie night and the pizza took forever. This cookie's for her.", vi: 'Cô ấy từng rủ bạn qua nhà xem phim, còn pizza thì chờ mãi mới tới. Cái bánh quy này là của cô ấy.' },
  { id: 'dl-friend-4', to: 'friend', level: 3, item: 'muffin', text: 'One muffin for the girl with about thirty scarves. Remember the haircut she hid under a hat?', vi: 'Một cái bánh muffin cho cô nàng có chừng ba mươi cái khăn quàng. Nhớ vụ tóc cắt hỏng phải đội mũ che không?' },

  // home · Grace (3: home-1 the parcel, home-2 the kitchen light · 4: home-4 Sunday roast, home-3 roses)
  { id: 'dl-home-1', to: 'home', level: 1, item: 'tea', text: "Would you take this cup of tea to Grace? She's at home, probably out in her garden.", vi: 'Bạn mang tách trà này cho bà Grace giúp tôi được không? Bà ở nhà, chắc đang ngoài vườn.' },
  { id: 'dl-home-2', to: 'home', level: 2, item: 'muffin', text: "This muffin's for your neighbor, the sweet old lady down your street. Tell her it's still warm.", vi: 'Cái bánh muffin này là của bà hàng xóm nhà bạn, bà cụ dễ mến cùng phố ấy. Nhắn bà là bánh còn ấm nhé.' },
  { id: 'dl-home-3', to: 'home', level: 3, item: 'cookie', text: 'This cookie goes to the lady who took in your parcel. You changed her kitchen light, remember?', vi: 'Cái bánh quy này là của bà cụ đã nhận giúp bạn bưu kiện. Bạn từng thay bóng đèn bếp cho bà, nhớ không?' },
  { id: 'dl-home-4', to: 'home', level: 3, item: 'orange-juice', text: 'An orange juice for the one who does a proper Sunday roast and grows roses out front.', vi: 'Một ly nước cam cho người hay nấu bữa thịt quay Chủ nhật và trồng hoa hồng trước nhà.' },

  // shop · Ben (3: cafe-2, the van and the milk · 4: shop-4 spicy noodles by the box, shop-3 too much chocolate)
  { id: 'dl-shop-1', to: 'shop', level: 1, item: 'sandwich', text: 'Take this sandwich over to Ben at the shop, please. He never stops for lunch.', vi: 'Mang cái bánh kẹp này qua tiệm cho Ben giúp tôi nhé. Anh ấy chẳng bao giờ nghỉ ăn trưa.' },
  { id: 'dl-shop-2', to: 'shop', level: 2, item: 'black-coffee', text: "A black coffee for the guy who runs the shop. He's been unloading boxes since seven.", vi: 'Một ly cà phê đen cho anh chủ tiệm tạp hóa. Anh ấy bốc hàng từ bảy giờ sáng.' },
  { id: 'dl-shop-3', to: 'shop', level: 3, item: 'latte', text: "This latte's for the guy whose van wouldn't start the morning I ran out of milk.", vi: 'Ly latte này là của anh chàng có cái xe tải không nổ máy đúng sáng tôi hết sữa.' },
  { id: 'dl-shop-4', to: 'shop', level: 3, item: 'cookie', text: 'He orders spicy noodles by the box and eats way too much chocolate. Bring him this cookie.', vi: 'Anh ấy đặt mì cay cả thùng và ăn sô-cô-la nhiều quá mức. Mang cho anh ấy cái bánh quy này nhé.' },

  // office · Sarah (3: office-1 five minutes, office-2 the projector · 4: office-4 notebooks, office-5 the smell of spicy noodles)
  { id: 'dl-office-1', to: 'office', level: 1, item: 'lemon-cake', text: 'This slice of lemon cake is for Sarah, over at the office. She says she deserves it.', vi: 'Miếng bánh chanh này là của Sarah, bên văn phòng. Cô ấy bảo mình xứng đáng được ăn.' },
  { id: 'dl-office-2', to: 'office', level: 2, item: 'latte', text: "Can you get this latte to the woman who works at the office? She's in meetings all day.", vi: 'Bạn mang ly latte này cho cô làm ở văn phòng giúp tôi nhé? Cô ấy họp suốt cả ngày.' },
  { id: 'dl-office-3', to: 'office', level: 3, item: 'black-coffee', text: "She's only ever got five minutes, and you got her projector working. This black coffee's hers.", vi: 'Cô ấy lúc nào cũng chỉ có năm phút, và bạn từng giúp cô ấy bật được máy chiếu. Ly cà phê đen này là của cô ấy.' },
  { id: 'dl-office-4', to: 'office', level: 3, item: 'iced-tea', text: "She's got dozens of notebooks and can't stand the smell of spicy noodles. One iced tea for her.", vi: 'Cô ấy có hàng chục cuốn sổ và không chịu nổi mùi mì cay. Một ly trà đá cho cô ấy.' },

  // school · Daniel (3: school-3 "ten minutes a day", honey in his tea · 4: school-6 the novel of twelve years, no bubble tea)
  { id: 'dl-school-1', to: 'school', level: 1, item: 'tea', text: "Could you take this tea over to Daniel at the school? Careful, it's hot.", vi: 'Bạn mang tách trà này qua trường cho thầy Daniel giúp tôi nhé? Cẩn thận, nóng đấy.' },
  { id: 'dl-school-2', to: 'school', level: 2, item: 'sandwich', text: "This sandwich is for the teacher at the school. He's got an evening class and no dinner.", vi: 'Cái bánh kẹp này là của thầy giáo ở trường. Tối nay thầy có lớp mà chưa ăn gì.' },
  { id: 'dl-school-3', to: 'school', level: 3, item: 'tea', text: "He always says ten minutes a day beats three hours on Sunday. This tea's his, with honey.", vi: 'Anh ấy hay nói mỗi ngày mười phút còn hơn ba tiếng ngày Chủ nhật. Tách trà này là của anh ấy, có mật ong.' },
  { id: 'dl-school-4', to: 'school', level: 3, item: 'muffin', text: "He's been writing a novel for twelve years and can't stand bubble tea. Take him this muffin.", vi: 'Anh ấy viết một cuốn tiểu thuyết suốt mười hai năm nay và không chịu nổi trà sữa trân châu. Mang cho anh ấy cái bánh muffin này nhé.' },

  // station · Sam (3: station-2 the backpack · 4: station-3 his dog Chip, station-4 ten scarves)
  { id: 'dl-station-1', to: 'station', level: 1, item: 'iced-latte', text: "Can you take this iced latte to Sam at the bus station? He can't start his morning without one.", vi: 'Bạn mang ly latte đá này ra bến xe buýt cho Sam giúp tôi nhé? Sáng ra thiếu nó là anh ấy không làm gì nổi.' },
  { id: 'dl-station-2', to: 'station', level: 2, item: 'sandwich', text: "A sandwich for the man who sells tickets at the bus station. He's stuck there till ten.", vi: 'Một cái bánh kẹp cho anh bán vé ở bến xe buýt. Anh ấy phải ngồi đó tới mười giờ.' },
  { id: 'dl-station-3', to: 'station', level: 3, item: 'orange-juice', text: 'He found your black backpack with the laptop in it, remember? This orange juice is for him.', vi: 'Anh ấy tìm lại giúp bạn cái ba lô đen có máy tính bên trong, nhớ không? Ly nước cam này là của anh ấy.' },
  { id: 'dl-station-4', to: 'station', level: 3, item: 'iced-latte', text: 'This iced latte goes to the guy with a dog called Chip and about ten scarves.', vi: 'Ly latte đá này là của anh chàng có chú chó tên Chip và chừng mười cái khăn quàng.' },

  // clinic · Kim (3: clinic-2 "not too much coffee" while Emma kept bringing more · 4: clinic-3 "sugar in a cup", green tea)
  { id: 'dl-clinic-1', to: 'clinic', level: 1, item: 'green-tea', text: "This green tea's for Kim at the clinic. Could you run it over while it's hot?", vi: 'Ly trà xanh này là của Kim ở phòng khám. Bạn mang qua ngay lúc còn nóng giúp tôi nhé?' },
  { id: 'dl-clinic-2', to: 'clinic', level: 2, item: 'water', text: "Take this bottle of water to the doctor at the clinic. She hasn't had a break all day.", vi: 'Mang chai nước này cho cô bác sĩ ở phòng khám nhé. Cả ngày nay cô ấy chưa được nghỉ phút nào.' },
  { id: 'dl-clinic-3', to: 'clinic', level: 3, item: 'orange-juice', text: 'She told you to go easy on the coffee, and I kept sneaking you more. This orange juice is hers.', vi: 'Cô ấy dặn bạn bớt cà phê lại, còn tôi thì cứ lén mang thêm cho bạn. Ly nước cam này là của cô ấy.' },
  { id: 'dl-clinic-4', to: 'clinic', level: 3, item: 'green-tea', text: 'She says half my drinks are just sugar in a cup, so she gets a green tea.', vi: 'Cô ấy bảo nửa số đồ uống của tôi chỉ là đường đựng trong ly, nên phần cô ấy là một ly trà xanh.' },

  // cinema · Zoe (3: cinema-1 the comedy three times, no sleep after the horror film · 4: cinema-3 films on her phone, cinema-6 allergic to roses)
  { id: 'dl-cinema-1', to: 'cinema', level: 1, item: 'iced-tea', text: "Can you bring this iced tea to Zoe at the cinema? She's working the late show.", vi: 'Bạn mang ly trà đá này qua rạp phim cho Zoe giúp tôi nhé? Cô ấy đang trực suất chiếu khuya.' },
  { id: 'dl-cinema-2', to: 'cinema', level: 2, item: 'muffin', text: "A muffin for the girl who runs the cinema, please. She's had nothing but popcorn today.", vi: 'Một cái bánh muffin cho cô gái trông rạp chiếu phim nhé. Cả ngày nay cô ấy chỉ ăn mỗi bỏng ngô.' },
  { id: 'dl-cinema-3', to: 'cinema', level: 3, item: 'orange-juice', text: "She's seen that new comedy three times, and the horror one kept her up all night. An orange juice for her.", vi: 'Cô ấy xem phim hài mới tới ba lần, còn phim kinh dị thì làm cô ấy mất ngủ cả đêm. Một ly nước cam cho cô ấy.' },
  { id: 'dl-cinema-4', to: 'cinema', level: 3, item: 'water', text: "Here, a bottle of water for the girl who shoots little films on her phone. The one who's allergic to roses.", vi: 'Đây, một chai nước cho cô gái tự quay phim ngắn bằng điện thoại. Người bị dị ứng hoa hồng ấy.' },

  // phone · Max (3: phone-1 "mate", office-2 "off and on again" · 4: phone-5 heaps of headphones, phone-7 he misses the beach)
  { id: 'dl-phone-1', to: 'phone', level: 1, item: 'iced-latte', text: "This iced latte's for Max at the phone shop. It's his third today, don't ask.", vi: 'Ly latte đá này là của Max ở tiệm điện thoại. Ly thứ ba hôm nay rồi đấy, đừng hỏi.' },
  { id: 'dl-phone-2', to: 'phone', level: 2, item: 'black-coffee', text: "The guy who fixes phones could use a black coffee. He's been squinting at screens all day.", vi: 'Anh chàng sửa điện thoại chắc đang cần một ly cà phê đen. Anh ấy dán mắt vào màn hình cả ngày rồi.' },
  { id: 'dl-phone-3', to: 'phone', level: 3, item: 'iced-latte', text: 'He calls everybody mate and tells you to turn it off and on again. One iced latte for him.', vi: 'Anh ấy gọi ai cũng là "mate" và hay bảo bạn tắt đi bật lại xem. Một ly latte đá cho anh ấy.' },
  { id: 'dl-phone-4', to: 'phone', level: 3, item: 'cookie', text: "He's got heaps of headphones and he misses the beach back home. Take him this cookie, okay?", vi: 'Anh ấy có cả đống tai nghe và đang nhớ bãi biển quê nhà. Mang cho anh ấy cái bánh quy này nhé?' },

  // park · Lily (3: park-1 / park-2, the phone number at the job interview · 4: park-5 she gave up coffee, park-4 her dog Pip)
  { id: 'dl-park-1', to: 'park', level: 1, item: 'green-tea', text: "Lily's on her bench in the park. Could you bring her this green tea?", vi: 'Lily đang ngồi ở ghế đá quen trong công viên. Bạn mang ly trà xanh này cho cô ấy giúp tôi nhé?' },
  { id: 'dl-park-2', to: 'park', level: 2, item: 'iced-tea', text: "An iced tea for the young woman who's always in the park with her little dog. Off you go!", vi: 'Một ly trà đá cho cô gái lúc nào cũng ở công viên với chú chó nhỏ. Đi nhé!' },
  { id: 'dl-park-3', to: 'park', level: 3, item: 'muffin', text: 'She forgot her own phone number in a job interview and still got the job. A muffin for her.', vi: 'Cô ấy quên cả số điện thoại của mình lúc đi phỏng vấn mà vẫn được nhận. Một cái bánh muffin cho cô ấy.' },
  { id: 'dl-park-4', to: 'park', level: 3, item: 'green-tea', text: 'A green tea for the one who gave up coffee and adopted that little dog, Pip.', vi: 'Một ly trà xanh cho người đã bỏ cà phê và nhận nuôi chú chó nhỏ tên Pip.' },

  // board · Tom (3: board-1 setting up the fair, board-2 moved to Sunday · 4: board-4 fresh bread at six, board-5 afraid of public speaking)
  { id: 'dl-board-1', to: 'board', level: 1, item: 'orange-juice', text: "Would you mind taking this orange juice to Tom? He's by the notice board, as always.", vi: 'Phiền bạn mang ly nước cam này cho Tom giúp tôi nhé? Anh ấy ở chỗ bảng tin, như mọi khi.' },
  { id: 'dl-board-2', to: 'board', level: 2, item: 'latte', text: "The man who keeps the notice board ordered a latte. He's out there putting up posters again.", vi: 'Anh chàng giữ bảng tin gọi một ly latte. Anh ấy lại đang ở ngoài đó dán áp phích.' },
  { id: 'dl-board-3', to: 'board', level: 3, item: 'tea', text: 'He got you setting up the fair, then moved it to Sunday. A cup of tea for him.', vi: 'Anh ấy rủ bạn phụ dựng hội chợ rồi lại dời sang Chủ nhật. Một tách trà cho anh ấy.' },
  { id: 'dl-board-4', to: 'board', level: 3, item: 'lemon-cake', text: "He's up at six for fresh bread and terrified of speaking in public. This slice of lemon cake is his.", vi: 'Sáu giờ sáng anh ấy đã dậy mua bánh mì mới nướng, và rất sợ nói trước đám đông. Miếng bánh chanh này là của anh ấy.' },
];
