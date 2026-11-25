// The people of Westbay (docs/city.md has their whole canon). Small and shared: the scenes' audio needs their sex
// (the browser voice that reads them), the panels their names. Their places on the map: data/cityWorld.ts.
//
// Nobody here is a stranger to the town: each is tied to somebody the learner already knows, by a detail the town's
// own lines already said (Sam's cousin who drives a taxi, the Italian place of Emma's birthday, Ben's dad who opened
// the shop thirty years ago, the sister who never got to read Daniel's pages…).

import type { CityPerson } from './cityTypes';

export const CITY_PEOPLE: readonly CityPerson[] = [
  // ── Ga & bến xe ──
  { id: 'rico', name: 'Rico', gender: 'male', tier: 'main', district: 'station', role: 'Tài xế taxi', tie: 'Anh họ của Sam. Nói nhiều gấp mười Sam, và là người gọi điện cho mẹ Sam hộ Sam.', town: ['station'] },
  { id: 'okafor', name: 'Mrs Okafor', gender: 'female', tier: 'known', district: 'station', role: 'Bán vé ở Ga trung tâm', tie: 'Thuộc lòng mọi giờ tàu xe. Ngày nào cũng gọi sang bến xe thị trấn đối giờ với Sam.', town: ['station'] },
  { id: 'pete', name: 'Pete', gender: 'male', tier: 'known', district: 'station', role: 'Giữ phòng đồ thất lạc', tie: 'Giữ hộ đủ thứ người thị trấn bỏ quên trên xe số 9.', town: ['station', 'home'] },
  { id: 'tess', name: 'Tess', gender: 'female', tier: 'known', district: 'station', role: 'Bán cà phê xe đẩy', tie: 'Học pha cà phê từ Emma trong một mùa hè làm ở quán.', town: ['cafe'] },
  // ── Chợ cũ ──
  { id: 'nora', name: 'Nora', gender: 'female', tier: 'main', district: 'market', role: 'Chủ tiệm hoa Sunflower Corner', tie: 'Chị gái của Leo. Vừa sinh bé Maya, và muốn em trai về thành phố.', town: ['square'] },
  { id: 'theo', name: 'Theo', gender: 'male', tier: 'known', district: 'market', role: 'Thợ máy phà, chồng Nora', tie: 'Chồng Nora, bố bé Maya. Ít nói, quý Leo như em ruột.', town: ['square'] },
  { id: 'frank', name: 'Frank', gender: 'male', tier: 'main', district: 'market', role: 'Chủ sạp truyện tranh cũ', tie: 'Bố của Ben. Ba mươi năm trước chính ông mở tiệm tạp hoá ở thị trấn.', town: ['shop'] },
  { id: 'poppy', name: 'Poppy', gender: 'female', tier: 'known', district: 'market', role: 'Thợ bánh, tiệm Twin Ovens', tie: 'Mở tiệm bánh với chị em sinh đôi Dot, hàng xóm sạp của Frank, bỏ bánh mì cho quán Gianna.', town: ['shop'] },
  { id: 'gianna', name: 'Gianna', gender: 'female', tier: 'main', district: 'market', role: 'Chủ quán Ý', tie: 'Chủ "quán Ý trên thành phố" nơi Emma ăn sinh nhật. Hồi sinh viên là khách quen quán của bà Emma.', town: ['cafe'] },
  { id: 'hal', name: 'Hal', gender: 'male', tier: 'known', district: 'market', role: 'Bán cá', tie: 'Mua cá của người câu ở thị trấn, kể cả cá bạn câu ở cầu tàu.', town: ['square'] },
  { id: 'amira', name: 'Amira', gender: 'female', tier: 'known', district: 'market', role: 'Bán gia vị', tie: 'Cung cấp gia vị cho quán Gianna, bạn học cũ của Nora.', town: ['cafe'] },
  { id: 'jonah', name: 'Jonah', gender: 'male', tier: 'known', district: 'market', role: 'Hát rong ở chợ', tie: 'Bạn cũ của Mia từ hồi hai người còn chung một ban nhạc.', town: ['friend'] },
  // ── Phố nghệ thuật ──
  { id: 'iris', name: 'Iris', gender: 'female', tier: 'main', district: 'arts', role: 'Phụ trách chương trình rạp Lumen', tie: 'Người đang giữ phim ngắn của Zoe trong chồng hồ sơ liên hoan. Thẳng tới mức phũ.', town: ['cinema'] },
  { id: 'wren', name: 'Wren', gender: 'female', tier: 'known', district: 'arts', role: 'Bán vé rạp Lumen', tie: 'Mê phim của Zoe còn hơn cả Iris.', town: ['cinema'] },
  { id: 'claire', name: 'Claire', gender: 'female', tier: 'main', district: 'arts', role: 'Biên tập viên, chủ nhà sách Harbour Press', tie: 'Chị gái của Daniel. Làm nghề đọc sách mà chưa từng được đọc một trang bản thảo của em.', town: ['school'] },
  { id: 'kit', name: 'Kit', gender: 'male', tier: 'known', district: 'arts', role: 'Kỹ thuật viên đài Bay FM', tie: 'Làm chương trình với Marcus, người bạn viết thư của Tom.', town: ['board'] },
  { id: 'bo', name: 'Bo', gender: 'male', tier: 'known', district: 'arts', role: 'Chủ quán karaoke', tie: 'Tối thứ Năm nào Mia và đồng nghiệp cũng hát ở quán anh.', town: ['friend'] },
  { id: 'dana', name: 'Dana', gender: 'female', tier: 'known', district: 'arts', role: 'Đồng nghiệp của Mia', tie: 'Làm cùng chỗ với Mia, người rủ cả nhóm đi karaoke.', town: ['friend'] },
  // ── Khu văn phòng ──
  { id: 'priya', name: 'Priya', gender: 'female', tier: 'main', district: 'office', role: 'Quản lý vận hành, trụ sở Meridian', tie: 'Ngồi chung bàn với Sarah năm đầu đi làm, rồi nhận cái ghế trên thành phố mà Sarah từ chối.', town: ['office'] },
  { id: 'vivian', name: 'Vivian', gender: 'female', tier: 'main', district: 'office', role: 'Giám đốc sáng tạo, xưởng thiết kế Loom', tie: 'Sếp của Lily, và là lý do Lily hay căng thẳng. Khó tính nhưng công bằng.', town: ['park'] },
  { id: 'whitlock', name: 'Mr Whitlock', gender: 'male', tier: 'known', district: 'office', role: 'Giám đốc Meridian', tie: 'Ký giấy tờ cho Sarah tám năm nay, sáng nào cũng đứng đọc báo ở sạp trước trụ sở.', town: ['office'] },
  { id: 'hana', name: 'Hana', gender: 'female', tier: 'known', district: 'office', role: 'Lễ tân trụ sở', tie: 'Nhớ giọng từng người gọi tới, kể cả Sarah gọi từ văn phòng thị trấn.', town: ['office'] },
  { id: 'colin', name: 'Colin', gender: 'male', tier: 'known', district: 'office', role: 'Quản lý vùng của FreshWay', tie: 'Năm mười lăm tuổi từng xếp hàng thuê cho tiệm của Frank, giờ là người cứ gọi hỏi mua tiệm.', town: ['shop'] },
  { id: 'dev', name: 'Dev', gender: 'male', tier: 'known', district: 'office', role: 'Kỹ thuật viên máy tính', tie: 'Bạn chơi game trên mạng của Max, cách nhau bốn mươi phút xe buýt mà chưa gặp lần nào.', town: ['phone'] },
  // ── Đại học & bệnh viện ──
  { id: 'osei', name: 'Dr Osei', gender: 'male', tier: 'main', district: 'campus', role: 'Bác sĩ, bệnh viện Westbay', tie: 'Người hướng dẫn Kim. Năm đầu cô suýt bỏ nghề, ba giờ sáng gọi cho ông.', town: ['clinic'] },
  { id: 'bridget', name: 'Bridget', gender: 'female', tier: 'known', district: 'campus', role: 'Điều dưỡng trưởng', tie: 'Học trò cũ của Grace từ hồi bà còn làm y tá ở London.', town: ['home'] },
  { id: 'adeyemi', name: 'Prof Adeyemi', gender: 'male', tier: 'main', district: 'campus', role: 'Giáo sư ngữ âm', tie: 'Thầy cũ của Daniel. Cả đời nghiên cứu chuyện tiếng Anh thật ra được nói thế nào.', town: ['school'] },
  { id: 'finch', name: 'Mr Finch', gender: 'male', tier: 'known', district: 'campus', role: 'Thủ thư', tie: 'Còn giữ thẻ thư viện của Daniel từ hồi anh là sinh viên.', town: ['school'] },
  { id: 'yuki', name: 'Yuki', gender: 'female', tier: 'known', district: 'campus', role: 'Du học sinh', tie: 'Cũng đang vật lộn với việc nghe tiếng Anh nói nhanh, như bạn.', town: ['school'] },
  { id: 'nell', name: 'Nell', gender: 'female', tier: 'known', district: 'campus', role: 'Dược sĩ', tie: 'Bốc thuốc theo đơn của phòng khám Kim gửi lên.', town: ['clinic'] },
  // ── Bến cảng ──
  { id: 'jun', name: 'Jun', gender: 'male', tier: 'main', district: 'harbour', role: 'Thợ sửa đồ điện tử', tie: 'Người cho Max việc làm đầu tiên khi anh mới từ Brisbane sang.', town: ['phone'] },
  { id: 'marcus', name: 'Marcus', gender: 'male', tier: 'main', district: 'harbour', role: 'Người dẫn chương trình Bay FM', tie: 'Giọng bạn đã nghe trên radio. Bạn viết thư của Tom từ hồi hai người còn nhỏ.', town: ['board'] },
  { id: 'odile', name: 'Captain Odile', gender: 'female', tier: 'known', district: 'harbour', role: 'Thuyền trưởng phà', tie: 'Sếp của Theo ở bến phà.', town: ['square'] },
  { id: 'gus', name: 'Gus', gender: 'male', tier: 'known', district: 'harbour', role: 'Gác cảng', tie: 'Trực đêm ở cảng, biết mặt mọi khách quen của Jun.', town: ['phone'] },
  { id: 'mei', name: 'Mei', gender: 'female', tier: 'known', district: 'harbour', role: 'Bán há cảo ở chợ đêm', tie: 'Học trò lớn tuổi nhất trong lớp chống lừa đảo qua điện thoại của Jun.', town: ['phone'] },
  { id: 'sol', name: 'Sol', gender: 'male', tier: 'known', district: 'harbour', role: 'Bán lồng đèn ở chợ đêm', tie: 'Lồng đèn ở lễ hội của Leo dưới thị trấn là mua của anh.', town: ['square'] },
  { id: 'fay', name: 'Fay', gender: 'female', tier: 'known', district: 'harbour', role: 'Bán vé vòng đu quay', tie: 'Bán vé vòng đu quay mà sợ độ cao. Zoe từng quay một cảnh phim ở đây.', town: ['cinema'] },
];

const BY_ID: Readonly<Record<string, CityPerson>> = Object.fromEntries(CITY_PEOPLE.map((p) => [p.id, p]));

export function cityPerson(id: string): CityPerson | undefined {
  return Object.hasOwn(BY_ID, id) ? BY_ID[id] : undefined;
}
