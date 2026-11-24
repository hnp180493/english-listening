// "Phụ quầy cà phê" (docs/town.md §16): what the residents order at Emma's counter (contract: core/town/cafeTypes.ts).
// Ten orders each for the twelve residents who are not behind the counter: 1–4 level 1 (one thing, said plainly),
// 5–8 level 2 (two kinds or a number), 9–10 level 3 (a change of mind, a "no / not", an order for somebody else, or
// near sound-alikes side by side: `items` is what ends up on the tray). Only the twelve tiles are ever named as food
// or drink, and every name maps to one tile ("tea" alone = `tea`, "latte" alone = `latte`, never a bare "coffee").
// Each resident orders the way they talk in their arc (data/stories): Grace's "dear", Daniel's polite British, Max's
// "mate", Sam's iced latte, Kim's and Lily's green tea. Ids are stable; never renumber.
import type { CafeOrder } from '../core/town/cafeTypes';

export const CAFE_ORDERS: readonly CafeOrder[] = [
  // square · Leo
  { id: 'cf-square-1', placeId: 'square', level: 1, text: 'Hey! Can I get a latte, please?', vi: 'Chào! Cho tôi một ly latte nhé?', items: { latte: 1 } },
  { id: 'cf-square-2', placeId: 'square', level: 1, text: "I'll just have a sandwich today, thanks.", vi: 'Hôm nay tôi lấy một cái bánh kẹp thôi, cảm ơn.', items: { sandwich: 1 } },
  { id: 'cf-square-3', placeId: 'square', level: 1, text: 'Could I grab a bottle of water real quick?', vi: 'Cho tôi lấy nhanh một chai nước được không?', items: { water: 1 } },
  { id: 'cf-square-4', placeId: 'square', level: 1, text: "One orange juice for me, please. I'm kinda thirsty.", vi: 'Cho tôi một ly nước cam nhé. Tôi hơi khát.', items: { 'orange-juice': 1 } },
  { id: 'cf-square-5', placeId: 'square', level: 2, text: "Two lattes and a muffin, please. Tom's waiting outside.", vi: 'Hai ly latte và một cái bánh muffin nhé. Tom đang đợi ngoài kia.', items: { latte: 2, muffin: 1 } },
  { id: 'cf-square-6', placeId: 'square', level: 2, text: 'Lemme get three waters for the clean-up crew.', vi: 'Cho tôi ba chai nước cho đội dọn dẹp.', items: { water: 3 } },
  { id: 'cf-square-7', placeId: 'square', level: 2, text: "I'll have a black coffee and a cookie, thanks.", vi: 'Tôi lấy một ly cà phê đen và một cái bánh quy, cảm ơn.', items: { 'black-coffee': 1, cookie: 1 } },
  { id: 'cf-square-8', placeId: 'square', level: 2, text: 'Can I get a sandwich and a couple of orange juices?', vi: 'Cho tôi một cái bánh kẹp và hai ly nước cam được không?', items: { sandwich: 1, 'orange-juice': 2 } },
  { id: 'cf-square-9', placeId: 'square', level: 3, text: 'A latte, please. Actually, no, make that an iced latte.', vi: 'Một ly latte nhé. À mà thôi, đổi thành latte đá đi.', items: { 'iced-latte': 1 } },
  { id: 'cf-square-10', placeId: 'square', level: 3, text: 'Black coffee for me. Oh, and Sam wants an iced tea, not a tea.', vi: 'Tôi một ly cà phê đen. À, còn Sam muốn trà đá, không phải trà nóng.', items: { 'black-coffee': 1, 'iced-tea': 1 } },

  // friend · Mia
  { id: 'cf-friend-1', placeId: 'friend', level: 1, text: 'Hi! Can I have an iced tea, please?', vi: 'Chào! Cho mình một ly trà đá nhé?', items: { 'iced-tea': 1 } },
  { id: 'cf-friend-2', placeId: 'friend', level: 1, text: "Ooh, I'll take a slice of lemon cake.", vi: 'Ôi, mình lấy một miếng bánh chanh.', items: { 'lemon-cake': 1 } },
  { id: 'cf-friend-3', placeId: 'friend', level: 1, text: 'Just a cookie for me today, please.', vi: 'Hôm nay mình chỉ lấy một cái bánh quy thôi.', items: { cookie: 1 } },
  { id: 'cf-friend-4', placeId: 'friend', level: 1, text: 'Okay, I really need a latte right now.', vi: 'Thật sự là mình cần một ly latte ngay bây giờ.', items: { latte: 1 } },
  { id: 'cf-friend-5', placeId: 'friend', level: 2, text: 'An iced latte and a slice of lemon cake, please!', vi: 'Một ly latte đá và một miếng bánh chanh nhé!', items: { 'iced-latte': 1, 'lemon-cake': 1 } },
  { id: 'cf-friend-6', placeId: 'friend', level: 2, text: "Can I get two iced teas? One's for a friend.", vi: 'Cho mình hai ly trà đá nhé? Một ly cho bạn mình.', items: { 'iced-tea': 2 } },
  { id: 'cf-friend-7', placeId: 'friend', level: 2, text: "I'll have an orange juice and, um, two cookies.", vi: 'Mình lấy một ly nước cam và, ừm, hai cái bánh quy.', items: { 'orange-juice': 1, cookie: 2 } },
  { id: 'cf-friend-8', placeId: 'friend', level: 2, text: "Three slices of lemon cake, please. Don't judge me.", vi: 'Ba miếng bánh chanh nhé. Đừng có cười mình.', items: { 'lemon-cake': 3 } },
  { id: 'cf-friend-9', placeId: 'friend', level: 3, text: 'A muffin, please. No, wait, a cookie. Yeah, just the cookie.', vi: 'Một cái bánh muffin nhé. Khoan, bánh quy đi. Ừ, chỉ bánh quy thôi.', items: { cookie: 1 } },
  { id: 'cf-friend-10', placeId: 'friend', level: 3, text: 'Two lattes... no, sorry, one latte and one green tea.', vi: 'Hai ly latte... à không, xin lỗi, một latte và một trà xanh.', items: { latte: 1, 'green-tea': 1 } },

  // home · Grace
  { id: 'cf-home-1', placeId: 'home', level: 1, text: 'Morning, dear. A cup of tea, please.', vi: 'Chào cháu. Cho bà một tách trà nhé.', items: { tea: 1 } },
  { id: 'cf-home-2', placeId: 'home', level: 1, text: 'Could I have a muffin, dear? They smell lovely.', vi: 'Cho bà một cái bánh muffin nhé cháu? Thơm quá.', items: { muffin: 1 } },
  { id: 'cf-home-3', placeId: 'home', level: 1, text: 'Just a slice of lemon cake for me, please.', vi: 'Bà chỉ lấy một miếng bánh chanh thôi.', items: { 'lemon-cake': 1 } },
  { id: 'cf-home-4', placeId: 'home', level: 1, text: 'I rather fancy an orange juice today, dear.', vi: 'Hôm nay bà lại thèm một ly nước cam, cháu ạ.', items: { 'orange-juice': 1 } },
  { id: 'cf-home-5', placeId: 'home', level: 2, text: "I'll have a cup of tea and a cookie, dear.", vi: 'Cho bà một tách trà và một cái bánh quy nhé cháu.', items: { tea: 1, cookie: 1 } },
  { id: 'cf-home-6', placeId: 'home', level: 2, text: "Three muffins, please, dear. They're for the neighbors.", vi: 'Ba cái bánh muffin nhé cháu. Bà mua cho hàng xóm.', items: { muffin: 3 } },
  { id: 'cf-home-7', placeId: 'home', level: 2, text: "I'd like a sandwich and a bottle of water, please.", vi: 'Bà lấy một cái bánh kẹp và một chai nước nhé.', items: { sandwich: 1, water: 1 } },
  { id: 'cf-home-8', placeId: 'home', level: 2, text: 'Could I have two slices of lemon cake and a tea?', vi: 'Cho bà hai miếng bánh chanh và một tách trà được không?', items: { 'lemon-cake': 2, tea: 1 } },
  { id: 'cf-home-9', placeId: 'home', level: 3, text: 'Tea for two, dear, and nothing to eat today.', vi: 'Trà cho hai người nhé cháu, hôm nay bà không ăn gì.', items: { tea: 2 } },
  { id: 'cf-home-10', placeId: 'home', level: 3, text: 'A green tea... oh no, not green, dear. Just a cup of tea.', vi: 'Một tách trà xanh... ôi không, không phải trà xanh đâu cháu. Trà thường thôi.', items: { tea: 1 } },

  // shop · Ben
  { id: 'cf-shop-1', placeId: 'shop', level: 1, text: "Just a black coffee, please. It's been a long morning.", vi: 'Cho tôi một ly cà phê đen thôi. Sáng nay dài quá.', items: { 'black-coffee': 1 } },
  { id: 'cf-shop-2', placeId: 'shop', level: 1, text: "Can I get a muffin before they're all gone?", vi: 'Cho tôi một cái bánh muffin trước khi hết sạch nhé?', items: { muffin: 1 } },
  { id: 'cf-shop-3', placeId: 'shop', level: 1, text: "I'll have a sandwich, please. I skipped lunch again.", vi: 'Tôi lấy một cái bánh kẹp. Tôi lại bỏ bữa trưa rồi.', items: { sandwich: 1 } },
  { id: 'cf-shop-4', placeId: 'shop', level: 1, text: "One cookie, please. Don't tell my customers.", vi: 'Một cái bánh quy nhé. Đừng mách khách của tôi.', items: { cookie: 1 } },
  { id: 'cf-shop-5', placeId: 'shop', level: 2, text: 'A black coffee and a muffin, same as always.', vi: 'Một ly cà phê đen và một cái bánh muffin, như mọi khi.', items: { 'black-coffee': 1, muffin: 1 } },
  { id: 'cf-shop-6', placeId: 'shop', level: 2, text: "Two sandwiches, please. Yes, they're both for me.", vi: 'Hai cái bánh kẹp nhé. Ừ, cả hai đều của tôi.', items: { sandwich: 2 } },
  { id: 'cf-shop-7', placeId: 'shop', level: 2, text: "I'll take a latte and a couple of cookies.", vi: 'Tôi lấy một ly latte và hai cái bánh quy.', items: { latte: 1, cookie: 2 } },
  { id: 'cf-shop-8', placeId: 'shop', level: 2, text: 'Can I get three orange juices for game night?', vi: 'Cho tôi ba ly nước cam cho tối chơi cờ nhé?', items: { 'orange-juice': 3 } },
  { id: 'cf-shop-9', placeId: 'shop', level: 3, text: 'A cookie... no, a muffin. No! Okay, the cookie. Final answer.', vi: 'Một cái bánh quy... không, bánh muffin. Không! Thôi, bánh quy. Chốt.', items: { cookie: 1 } },
  { id: 'cf-shop-10', placeId: 'shop', level: 3, text: 'A sandwich, and no muffin today, just a bottle of water.', vi: 'Một cái bánh kẹp, hôm nay không lấy muffin, chỉ một chai nước thôi.', items: { sandwich: 1, water: 1 } },

  // office · Sarah
  { id: 'cf-office-1', placeId: 'office', level: 1, text: "Quick, a black coffee, please. I've got a meeting.", vi: 'Nhanh giúp tôi một ly cà phê đen. Tôi sắp họp.', items: { 'black-coffee': 1 } },
  { id: 'cf-office-2', placeId: 'office', level: 1, text: "Can I just grab a sandwich? I'm in a rush.", vi: 'Cho tôi lấy một cái bánh kẹp thôi nhé? Tôi đang vội.', items: { sandwich: 1 } },
  { id: 'cf-office-3', placeId: 'office', level: 1, text: 'A slice of lemon cake, please. I deserve it.', vi: 'Một miếng bánh chanh nhé. Tôi đáng được thưởng.', items: { 'lemon-cake': 1 } },
  { id: 'cf-office-4', placeId: 'office', level: 1, text: "I'll have a latte, thanks. It's been a day.", vi: 'Tôi lấy một ly latte, cảm ơn. Hôm nay mệt thật.', items: { latte: 1 } },
  { id: 'cf-office-5', placeId: 'office', level: 2, text: "Two black coffees, please. One's for my boss.", vi: 'Hai ly cà phê đen nhé. Một ly cho sếp tôi.', items: { 'black-coffee': 2 } },
  { id: 'cf-office-6', placeId: 'office', level: 2, text: "A latte and a sandwich, and I'm out of here.", vi: 'Một ly latte và một cái bánh kẹp, rồi tôi đi ngay.', items: { latte: 1, sandwich: 1 } },
  { id: 'cf-office-7', placeId: 'office', level: 2, text: 'Could I get three lattes for the team?', vi: 'Cho tôi ba ly latte cho cả nhóm được không?', items: { latte: 3 } },
  { id: 'cf-office-8', placeId: 'office', level: 2, text: 'I need a black coffee and two muffins, please.', vi: 'Tôi cần một ly cà phê đen và hai cái bánh muffin.', items: { 'black-coffee': 1, muffin: 2 } },
  { id: 'cf-office-9', placeId: 'office', level: 3, text: "A black coffee. Wait, I've had three. Make it an orange juice.", vi: 'Một ly cà phê đen. Khoan, tôi uống ba ly rồi. Đổi thành nước cam đi.', items: { 'orange-juice': 1 } },
  { id: 'cf-office-10', placeId: 'office', level: 3, text: 'Two lattes, please. One hot, and the other one an iced latte.', vi: 'Hai ly latte nhé. Một ly nóng, ly còn lại là latte đá.', items: { latte: 1, 'iced-latte': 1 } },

  // school · Daniel
  { id: 'cf-school-1', placeId: 'school', level: 1, text: 'Good afternoon. Might I have a cup of tea?', vi: 'Chào em. Cho thầy một tách trà được không?', items: { tea: 1 } },
  { id: 'cf-school-2', placeId: 'school', level: 1, text: "Could I have a sandwich, if it's no trouble?", vi: 'Cho thầy một cái bánh kẹp nhé, nếu không phiền em?', items: { sandwich: 1 } },
  { id: 'cf-school-3', placeId: 'school', level: 1, text: "I'd rather like a slice of lemon cake, please.", vi: 'Thầy muốn một miếng bánh chanh, em nhé.', items: { 'lemon-cake': 1 } },
  { id: 'cf-school-4', placeId: 'school', level: 1, text: 'Could I trouble you for a black coffee?', vi: 'Phiền em cho thầy một ly cà phê đen nhé?', items: { 'black-coffee': 1 } },
  { id: 'cf-school-5', placeId: 'school', level: 2, text: "Two teas, please. I've a student joining me.", vi: 'Cho thầy hai tách trà nhé. Có một học trò ngồi cùng thầy.', items: { tea: 2 } },
  { id: 'cf-school-6', placeId: 'school', level: 2, text: 'A tea and a muffin would be lovely, thank you.', vi: 'Một tách trà và một cái bánh muffin thì tuyệt, cảm ơn em.', items: { tea: 1, muffin: 1 } },
  { id: 'cf-school-7', placeId: 'school', level: 2, text: "I'll have a sandwich and an orange juice, please.", vi: 'Thầy lấy một cái bánh kẹp và một ly nước cam nhé.', items: { sandwich: 1, 'orange-juice': 1 } },
  { id: 'cf-school-8', placeId: 'school', level: 2, text: "Three cookies, please. They're for the conversation club.", vi: 'Ba cái bánh quy nhé. Thầy mua cho câu lạc bộ hội thoại.', items: { cookie: 3 } },
  { id: 'cf-school-9', placeId: 'school', level: 3, text: 'A nice tea, please. Not an iced tea, a nice hot one.', vi: 'Một tách trà ngon nhé. Không phải trà đá, mà trà nóng.', items: { tea: 1 } },
  { id: 'cf-school-10', placeId: 'school', level: 3, text: 'Two teas and a cookie. Sorry, make that two cookies.', vi: 'Hai tách trà và một cái bánh quy. Xin lỗi, cho thầy hai cái bánh quy.', items: { tea: 2, cookie: 2 } },

  // station · Sam
  { id: 'cf-station-1', placeId: 'station', level: 1, text: "Morning! An iced latte, please. I can't start without one.", vi: 'Chào buổi sáng! Một ly latte đá nhé. Thiếu nó tôi không bắt đầu ngày được.', items: { 'iced-latte': 1 } },
  { id: 'cf-station-2', placeId: 'station', level: 1, text: 'Can I get a muffin? I missed breakfast.', vi: 'Cho tôi một cái bánh muffin nhé? Tôi lỡ bữa sáng.', items: { muffin: 1 } },
  { id: 'cf-station-3', placeId: 'station', level: 1, text: "Just a bottle of water, please. It's hot out there.", vi: 'Cho tôi một chai nước thôi. Ngoài kia nóng quá.', items: { water: 1 } },
  { id: 'cf-station-4', placeId: 'station', level: 1, text: "I'll grab a sandwich before the next bus comes.", vi: 'Tôi lấy một cái bánh kẹp trước khi chuyến xe sau tới.', items: { sandwich: 1 } },
  { id: 'cf-station-5', placeId: 'station', level: 2, text: "An iced latte and a cookie. That's my whole break.", vi: 'Một ly latte đá và một cái bánh quy. Giờ nghỉ của tôi chỉ có thế.', items: { 'iced-latte': 1, cookie: 1 } },
  { id: 'cf-station-6', placeId: 'station', level: 2, text: 'Two black coffees for the drivers, please.', vi: 'Hai ly cà phê đen cho mấy anh tài xế nhé.', items: { 'black-coffee': 2 } },
  { id: 'cf-station-7', placeId: 'station', level: 2, text: 'Lemme get a sandwich and two waters.', vi: 'Cho tôi một cái bánh kẹp và hai chai nước.', items: { sandwich: 1, water: 2 } },
  { id: 'cf-station-8', placeId: 'station', level: 2, text: 'Can I have an iced tea and a couple of muffins?', vi: 'Cho tôi một ly trà đá và hai cái bánh muffin nhé?', items: { 'iced-tea': 1, muffin: 2 } },
  { id: 'cf-station-9', placeId: 'station', level: 3, text: 'Not a latte, an iced latte. And a water for Chip.', vi: 'Không phải latte nóng, mà latte đá. Thêm một chai nước cho Chip.', items: { 'iced-latte': 1, water: 1 } },
  { id: 'cf-station-10', placeId: 'station', level: 3, text: 'Three iced lattes... no, sorry, two. And one iced tea.', vi: 'Ba ly latte đá... à không, xin lỗi, hai thôi. Và một ly trà đá.', items: { 'iced-latte': 2, 'iced-tea': 1 } },

  // clinic · Kim
  { id: 'cf-clinic-1', placeId: 'clinic', level: 1, text: 'Hi! A green tea, please. You know me.', vi: 'Chào! Một ly trà xanh nhé. Bạn biết tôi mà.', items: { 'green-tea': 1 } },
  { id: 'cf-clinic-2', placeId: 'clinic', level: 1, text: 'Could I get a water, please? I just went running.', vi: 'Cho tôi một chai nước nhé? Tôi vừa chạy bộ xong.', items: { water: 1 } },
  { id: 'cf-clinic-3', placeId: 'clinic', level: 1, text: "One slice of lemon cake, please. I can't resist.", vi: 'Một miếng bánh chanh nhé. Tôi không cưỡng lại được.', items: { 'lemon-cake': 1 } },
  { id: 'cf-clinic-4', placeId: 'clinic', level: 1, text: 'Just an orange juice for me, thanks.', vi: 'Tôi chỉ lấy một ly nước cam thôi, cảm ơn.', items: { 'orange-juice': 1 } },
  { id: 'cf-clinic-5', placeId: 'clinic', level: 2, text: 'A green tea and a slice of lemon cake, please.', vi: 'Một ly trà xanh và một miếng bánh chanh nhé.', items: { 'green-tea': 1, 'lemon-cake': 1 } },
  { id: 'cf-clinic-6', placeId: 'clinic', level: 2, text: "Two green teas, please. I'm here for a while.", vi: 'Hai ly trà xanh nhé. Tôi ngồi đây một lúc lâu đấy.', items: { 'green-tea': 2 } },
  { id: 'cf-clinic-7', placeId: 'clinic', level: 2, text: "A muffin and a bottle of water, please. Doctor's orders.", vi: 'Một cái bánh muffin và một chai nước nhé. Lệnh của bác sĩ đấy.', items: { muffin: 1, water: 1 } },
  { id: 'cf-clinic-8', placeId: 'clinic', level: 2, text: 'Three bottles of water for the clinic, please.', vi: 'Ba chai nước cho phòng khám nhé.', items: { water: 3 } },
  { id: 'cf-clinic-9', placeId: 'clinic', level: 3, text: 'No iced latte for me, ever. Just a green tea.', vi: 'Tôi thì không bao giờ uống latte đá. Chỉ một ly trà xanh thôi.', items: { 'green-tea': 1 } },
  { id: 'cf-clinic-10', placeId: 'clinic', level: 3, text: 'A green tea for me, and an iced latte for Sam, not for me.', vi: 'Tôi một ly trà xanh, còn latte đá là cho Sam, không phải cho tôi.', items: { 'green-tea': 1, 'iced-latte': 1 } },

  // cinema · Zoe
  { id: 'cf-cinema-1', placeId: 'cinema', level: 1, text: 'Hey! One iced tea, please.', vi: 'Chào! Một ly trà đá nhé.', items: { 'iced-tea': 1 } },
  { id: 'cf-cinema-2', placeId: 'cinema', level: 1, text: 'Can I get a cookie? Like, right now?', vi: 'Cho tôi một cái bánh quy nhé? Kiểu, ngay bây giờ?', items: { cookie: 1 } },
  { id: 'cf-cinema-3', placeId: 'cinema', level: 1, text: "I'll have a latte. Long night at the cinema.", vi: 'Tôi lấy một ly latte. Tối qua ở rạp dài quá.', items: { latte: 1 } },
  { id: 'cf-cinema-4', placeId: 'cinema', level: 1, text: "Could I grab a muffin, please? I'm starving.", vi: 'Cho tôi lấy một cái bánh muffin nhé? Tôi đói lả rồi.', items: { muffin: 1 } },
  { id: 'cf-cinema-5', placeId: 'cinema', level: 2, text: 'An iced tea and a cookie, please. Movie snacks.', vi: 'Một ly trà đá và một cái bánh quy nhé. Đồ ăn xem phim.', items: { 'iced-tea': 1, cookie: 1 } },
  { id: 'cf-cinema-6', placeId: 'cinema', level: 2, text: 'Two muffins and an iced tea. Lunch of champions.', vi: 'Hai cái bánh muffin và một ly trà đá. Bữa trưa của nhà vô địch.', items: { muffin: 2, 'iced-tea': 1 } },
  { id: 'cf-cinema-7', placeId: 'cinema', level: 2, text: 'Can I get a water and two sandwiches? Max is on his way.', vi: 'Cho tôi một chai nước và hai cái bánh kẹp nhé? Max đang tới.', items: { water: 1, sandwich: 2 } },
  { id: 'cf-cinema-8', placeId: 'cinema', level: 2, text: "A latte and a slice of lemon cake. I'm editing all night.", vi: 'Một ly latte và một miếng bánh chanh. Tôi dựng phim cả đêm nay.', items: { latte: 1, 'lemon-cake': 1 } },
  { id: 'cf-cinema-9', placeId: 'cinema', level: 3, text: 'An iced tea... wait, no. An iced latte. I need to stay awake.', vi: 'Một ly trà đá... khoan, không. Latte đá đi. Tôi cần tỉnh táo.', items: { 'iced-latte': 1 } },
  { id: 'cf-cinema-10', placeId: 'cinema', level: 3, text: 'Two muffins. Actually, no, one muffin and one cookie.', vi: 'Hai cái bánh muffin. À mà thôi, một bánh muffin và một bánh quy.', items: { muffin: 1, cookie: 1 } },

  // phone · Max
  { id: 'cf-phone-1', placeId: 'phone', level: 1, text: 'Hey, mate! An iced latte, thanks.', vi: 'Chào bạn! Cho tôi một ly latte đá nhé.', items: { 'iced-latte': 1 } },
  { id: 'cf-phone-2', placeId: 'phone', level: 1, text: "Reckon I'll have a sandwich, thanks.", vi: 'Chắc tôi lấy một cái bánh kẹp, cảm ơn.', items: { sandwich: 1 } },
  { id: 'cf-phone-3', placeId: 'phone', level: 1, text: 'Can I grab a black coffee, mate? Big arvo ahead.', vi: 'Cho tôi một ly cà phê đen nhé? Chiều nay nhiều việc lắm.', items: { 'black-coffee': 1 } },
  { id: 'cf-phone-4', placeId: 'phone', level: 1, text: 'Just a water for me, thanks heaps.', vi: 'Tôi chỉ lấy một chai nước thôi, cảm ơn nhiều.', items: { water: 1 } },
  { id: 'cf-phone-5', placeId: 'phone', level: 2, text: 'Righto, an iced latte and a muffin for me.', vi: 'Được rồi, cho tôi một ly latte đá và một cái bánh muffin.', items: { 'iced-latte': 1, muffin: 1 } },
  { id: 'cf-phone-6', placeId: 'phone', level: 2, text: "Two iced lattes, mate. One's for Zoe.", vi: 'Hai ly latte đá nhé. Một ly cho Zoe.', items: { 'iced-latte': 2 } },
  { id: 'cf-phone-7', placeId: 'phone', level: 2, text: 'A black coffee and two cookies, thanks. Long day of repairs.', vi: 'Một ly cà phê đen và hai cái bánh quy, cảm ơn. Sửa máy cả ngày nay.', items: { 'black-coffee': 1, cookie: 2 } },
  { id: 'cf-phone-8', placeId: 'phone', level: 2, text: "Three muffins, thanks. They're for my video, I swear.", vi: 'Ba cái bánh muffin, cảm ơn. Để quay video đấy, thề luôn.', items: { muffin: 3 } },
  { id: 'cf-phone-9', placeId: 'phone', level: 3, text: 'A black coffee... nah, scratch that. An iced latte, thanks.', vi: 'Một ly cà phê đen... à thôi, bỏ đi. Cho tôi latte đá, cảm ơn.', items: { 'iced-latte': 1 } },
  { id: 'cf-phone-10', placeId: 'phone', level: 3, text: 'An iced latte for me, and Zoe wants an iced tea, not a latte.', vi: 'Tôi một ly latte đá, còn Zoe muốn trà đá, không phải latte.', items: { 'iced-latte': 1, 'iced-tea': 1 } },

  // park · Lily
  { id: 'cf-park-1', placeId: 'park', level: 1, text: 'Hi. Could I have a green tea, please?', vi: 'Chào bạn. Cho mình một ly trà xanh được không?', items: { 'green-tea': 1 } },
  { id: 'cf-park-2', placeId: 'park', level: 1, text: 'Just a muffin for me, please.', vi: 'Mình chỉ lấy một cái bánh muffin thôi.', items: { muffin: 1 } },
  { id: 'cf-park-3', placeId: 'park', level: 1, text: "Can I get an iced tea? It's so sunny today.", vi: 'Cho mình một ly trà đá nhé? Hôm nay nắng quá.', items: { 'iced-tea': 1 } },
  { id: 'cf-park-4', placeId: 'park', level: 1, text: "I'd love a sandwich, if that's okay.", vi: 'Mình muốn một cái bánh kẹp, nếu được.', items: { sandwich: 1 } },
  { id: 'cf-park-5', placeId: 'park', level: 2, text: 'A green tea and a cookie, please. Thank you so much.', vi: 'Một ly trà xanh và một cái bánh quy nhé. Cảm ơn bạn nhiều.', items: { 'green-tea': 1, cookie: 1 } },
  { id: 'cf-park-6', placeId: 'park', level: 2, text: "Two bottles of water, please. One's for Pip.", vi: 'Hai chai nước nhé. Một chai cho Pip.', items: { water: 2 } },
  { id: 'cf-park-7', placeId: 'park', level: 2, text: "I'll have an orange juice and a muffin, thanks.", vi: 'Mình lấy một ly nước cam và một cái bánh muffin, cảm ơn.', items: { 'orange-juice': 1, muffin: 1 } },
  { id: 'cf-park-8', placeId: 'park', level: 2, text: "Two sandwiches and a green tea, please. It's a picnic.", vi: 'Hai cái bánh kẹp và một ly trà xanh nhé. Mình đi dã ngoại.', items: { sandwich: 2, 'green-tea': 1 } },
  { id: 'cf-park-9', placeId: 'park', level: 3, text: 'A latte... oh, no, I quit. A green tea, please.', vi: 'Một ly latte... ôi không, mình bỏ rồi. Cho mình trà xanh nhé.', items: { 'green-tea': 1 } },
  { id: 'cf-park-10', placeId: 'park', level: 3, text: 'Green tea for me, and a black coffee for Tom. Not for me!', vi: 'Mình uống trà xanh, còn cà phê đen là cho Tom. Không phải cho mình đâu!', items: { 'green-tea': 1, 'black-coffee': 1 } },

  // board · Tom
  { id: 'cf-board-1', placeId: 'board', level: 1, text: 'Hi there! A slice of lemon cake, please.', vi: 'Chào bạn! Một miếng bánh chanh nhé.', items: { 'lemon-cake': 1 } },
  { id: 'cf-board-2', placeId: 'board', level: 1, text: 'Can I get a black coffee? Big meeting tonight.', vi: 'Cho tôi một ly cà phê đen nhé? Tối nay có buổi họp lớn.', items: { 'black-coffee': 1 } },
  { id: 'cf-board-3', placeId: 'board', level: 1, text: "I'll have a tea, please. Nothing fancy.", vi: 'Tôi lấy một tách trà. Không cần gì cầu kỳ.', items: { tea: 1 } },
  { id: 'cf-board-4', placeId: 'board', level: 1, text: "One sandwich, please. I've been putting up posters all day.", vi: 'Một cái bánh kẹp nhé. Tôi dán áp phích cả ngày nay.', items: { sandwich: 1 } },
  { id: 'cf-board-5', placeId: 'board', level: 2, text: 'Three teas for the volunteers, please.', vi: 'Ba tách trà cho nhóm tình nguyện nhé.', items: { tea: 3 } },
  { id: 'cf-board-6', placeId: 'board', level: 2, text: "Black coffee and some lemon cake. It's on my list.", vi: 'Cà phê đen và bánh chanh. Có ghi trong danh sách của tôi.', items: { 'black-coffee': 1, 'lemon-cake': 1 } },
  { id: 'cf-board-7', placeId: 'board', level: 2, text: "Let's see my list: two lattes and two muffins.", vi: 'Để xem danh sách nào: hai ly latte và hai cái bánh muffin.', items: { latte: 2, muffin: 2 } },
  { id: 'cf-board-8', placeId: 'board', level: 2, text: 'Could I get a couple of orange juices and a cookie?', vi: 'Cho tôi hai ly nước cam và một cái bánh quy được không?', items: { 'orange-juice': 2, cookie: 1 } },
  { id: 'cf-board-9', placeId: 'board', level: 3, text: "My list says three teas. Sorry, it's two teas and one iced tea.", vi: 'Danh sách ghi ba tách trà. Xin lỗi, là hai trà nóng và một trà đá.', items: { tea: 2, 'iced-tea': 1 } },
  { id: 'cf-board-10', placeId: 'board', level: 3, text: 'A latte for Leo, a tea for me, and no lemon cake today.', vi: 'Một ly latte cho Leo, một tách trà cho tôi, hôm nay không lấy bánh chanh.', items: { latte: 1, tea: 1 } },
];
