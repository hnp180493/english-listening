// "Chạy taxi cho Rico" (docs/town.md §21, owner 2026-11-26: "làm hết", the side jobs a GTA-like city has): a
// passenger gets in and SAYS where to go, in the browser's voice like everybody of the city; the learner picks the
// place among three and drives there before the clock runs out (core/town/taxi.ts). The places are Westbay's
// (data/cityWorld.ts CITY_PLACES ids); the two wrong ones (`near`) are what a careless ear would take instead: a
// sound-alike (pharmacy / ferry, Lumen / Loom, station / stage) or the place next door.
//
// Levels: 1 the place is named plainly; 2 the way people say it (a name of their own, more words round it); 3 a change
// of mind, a "not the …, the …", or no name at all (what they want there says where).

import type { TaxiFare } from '../../core/town/taxi';

export const TAXI_FARES: readonly TaxiFare[] = [
  { id: 'tx-1', level: 1, gender: 'male', text: 'Hi! Westbay Hospital, please. As quick as you can.', vi: 'Chào anh! Cho tôi tới Bệnh viện Westbay, nhanh nhất có thể nhé.', to: 'osei', near: ['nell', 'odile'] },
  { id: 'tx-2', level: 1, gender: 'female', text: 'Could you take me to the library, please?', vi: 'Anh chở tôi tới thư viện được không?', to: 'finch', near: ['pete', 'claire'] },
  { id: 'tx-3', level: 1, gender: 'male', text: "The train station, please. My train's at ten.", vi: 'Cho tôi ra ga tàu. Chuyến của tôi lúc mười giờ.', to: 'okafor', near: ['marcus', 'odile'] },
  { id: 'tx-4', level: 1, gender: 'female', text: "Twin Ovens, the bakery, please. I'm picking up a cake.", vi: 'Cho tôi tới tiệm bánh Twin Ovens. Tôi đi lấy bánh kem.', to: 'poppy', near: ['gianna', 'hal'] },
  { id: 'tx-5', level: 1, gender: 'female', text: 'Can you drop me at the Lumen cinema?', vi: 'Anh thả tôi ở rạp Lumen được không?', to: 'iris', near: ['vivian', 'bo'] },
  { id: 'tx-6', level: 1, gender: 'male', text: "The ferry, please. I can't miss the last boat.", vi: 'Cho tôi ra bến phà. Không được lỡ chuyến cuối.', to: 'odile', near: ['nell', 'fay'] },
  { id: 'tx-7', level: 2, gender: 'female', text: "I've got to get to the pharmacy before it shuts. Is that okay?", vi: 'Tôi phải tới nhà thuốc trước khi họ đóng cửa. Được không anh?', to: 'nell', near: ['odile', 'osei'] },
  { id: 'tx-8', level: 2, gender: 'male', text: "Loom, the design studio. I'm late for a meeting with Vivian.", vi: 'Tới xưởng thiết kế Loom. Tôi trễ buổi họp với Vivian rồi.', to: 'vivian', near: ['iris', 'priya'] },
  { id: 'tx-9', level: 2, gender: 'female', text: "Take me to the Bay FM stage, would you? There's a show at eight.", vi: 'Chở tôi tới sân khấu Bay FM nhé? Tám giờ có buổi diễn.', to: 'marcus', near: ['okafor', 'kit'] },
  { id: 'tx-10', level: 2, gender: 'male', text: "I'm meeting my wife at Gianna's. You know, the Italian place?", vi: 'Tôi hẹn vợ ở quán Gianna. Cái quán Ý ấy, anh biết không?', to: 'gianna', near: ['poppy', 'amira'] },
  { id: 'tx-11', level: 2, gender: 'male', text: "Can you take us to the Ferris wheel? The kids won't stop asking.", vi: 'Anh chở bọn tôi tới vòng đu quay nhé? Tụi nhỏ đòi mãi.', to: 'fay', near: ['odile', 'sol'] },
  { id: 'tx-12', level: 2, gender: 'female', text: "I need some fresh fish for tonight. Hal's stall, in the old market.", vi: 'Tôi cần ít cá tươi cho tối nay. Hàng cá của Hal, trong chợ cũ.', to: 'hal', near: ['amira', 'mei'] },
  { id: 'tx-13', level: 2, gender: 'male', text: 'Market Street, the old comic stall. My son collects them.', vi: 'Phố Chợ, cái sạp truyện tranh cũ. Con trai tôi sưu tầm truyện.', to: 'frank', near: ['claire', 'nora'] },
  { id: 'tx-14', level: 2, gender: 'female', text: 'Meridian, please. The big office at the end of Market Street.', vi: 'Tới Meridian. Cái toà văn phòng lớn cuối Phố Chợ.', to: 'priya', near: ['colin', 'gianna'] },
  { id: 'tx-15', level: 2, gender: 'male', text: "The phonetics lab at the uni. I'm helping Professor Adeyemi with a study.", vi: 'Phòng thí nghiệm ngữ âm ở trường đại học. Tôi phụ giáo sư Adeyemi làm một nghiên cứu.', to: 'adeyemi', near: ['finch', 'osei'] },
  { id: 'tx-16', level: 3, gender: 'female', text: 'Harbour Press, please. Not the harbour, the bookshop on Arts Street.', vi: 'Tới Harbour Press. Không phải bến cảng đâu, nhà sách ở Phố nghệ thuật ấy.', to: 'claire', near: ['odile', 'kit'] },
  { id: 'tx-17', level: 3, gender: 'male', text: 'Bay FM, please. The radio building, not the stage down by the water.', vi: 'Tới Bay FM. Toà nhà của đài, không phải sân khấu dưới bờ nước.', to: 'kit', near: ['marcus', 'priya'] },
  { id: 'tx-18', level: 3, gender: 'female', text: "The pharmacy, please. Oh, wait, no. They've taken my sister to the hospital.", vi: 'Cho tôi tới nhà thuốc. À khoan, không. Người ta đưa em gái tôi vào bệnh viện rồi.', to: 'osei', near: ['nell', 'odile'] },
  { id: 'tx-19', level: 3, gender: 'male', text: "I'm starving. Where can I get dumplings at the night market?", vi: 'Tôi đói lả rồi. Ở chợ đêm chỗ nào bán há cảo nhỉ?', to: 'mei', near: ['poppy', 'hal'] },
  { id: 'tx-20', level: 3, gender: 'female', text: "I left my bag on the train. Actually, take me to lost property. They'll have it.", vi: 'Tôi để quên túi trên tàu. Thôi, chở tôi tới phòng đồ thất lạc. Chắc họ giữ rồi.', to: 'pete', near: ['okafor', 'finch'] },
  { id: 'tx-21', level: 3, gender: 'male', text: "I want to buy some lanterns for my daughter's party. Where would I get those?", vi: 'Tôi muốn mua ít lồng đèn cho tiệc của con gái. Mua ở đâu nhỉ?', to: 'sol', near: ['fay', 'nora'] },
  { id: 'tx-22', level: 3, gender: 'female', text: "It's my friend's birthday, and we're singing all night. Bo's, please.", vi: 'Hôm nay sinh nhật bạn tôi, tụi tôi hát cả đêm. Cho tới quán Bo nhé.', to: 'bo', near: ['poppy', 'iris'] },
  { id: 'tx-23', level: 3, gender: 'male', text: 'My phone screen is cracked again. Is there someone at the harbour who fixes them?', vi: 'Màn hình điện thoại tôi lại nứt. Ở bến cảng có ai sửa không?', to: 'jun', near: ['dev', 'gus'] },
  { id: 'tx-24', level: 3, gender: 'female', text: 'I need flowers for an apology. A big apology. Sunflower Corner, quick.', vi: 'Tôi cần hoa để xin lỗi. Một lời xin lỗi to. Tới Sunflower Corner, nhanh lên.', to: 'nora', near: ['sol', 'amira'] },
];
