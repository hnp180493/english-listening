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
];

const BY_ID: Readonly<Record<string, CityPerson>> = Object.fromEntries(CITY_PEOPLE.map((p) => [p.id, p]));

export function cityPerson(id: string): CityPerson | undefined {
  return Object.hasOwn(BY_ID, id) ? BY_ID[id] : undefined;
}
