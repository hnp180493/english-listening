// Meeting a resident out in the town (docs/town.md §14 "Gặp trên đường"). The owner clicked Daniel on a path and the
// talk jumped into the boarding house ("mày làm game cũng phải logic tí chứ"): somebody met in the street is talked
// to in the street, and what you see of them there says how close the two of you are and what you have learned about
// them in their episodes ("phải liên quan với nhau để chiếm tình cảm npc").
//
// One Vietnamese sentence per meeting, true anywhere in the town (no building, no room): by friendship (a stranger,
// a friend, a close friend) and, once the learner knows one of the resident's facts (data/stories), a scene built on
// it. Narration only: nothing here is spoken, so it needs no audio clip.

import type { FactId } from '../core/town/story';
import { tl } from '../i18n';

export interface StreetMeet {
  /** 0–1 hearts: polite, a little reserved. */
  stranger: readonly string[];
  /** 2–4 hearts: they stop for you. */
  friendly: readonly string[];
  /** 5+ hearts: they light up. */
  close: readonly string[];
  /** Scenes that need a fact the learner has learned (data/stories facts of this resident). */
  known: readonly { fact: FactId; scene: string }[];
}

/** Hearts from which a resident is a friend / a close friend in the street. */
export const STREET_FRIENDLY = 2;
export const STREET_CLOSE = 5;

export const STREET_MEETS: Readonly<Record<string, StreetMeet>> = {
  square: {
    stranger: ['Leo xách xô nước đi ngang, gật đầu chào bạn.', 'Leo đang nhặt rác ven đường, thấy bạn thì đứng thẳng lên.'],
    friendly: ['Leo thấy bạn từ xa đã giơ tay vẫy.', 'Leo dựng chổi vào gốc cây, có vẻ muốn tán gẫu một lúc.'],
    close: ['Leo cười toe khi thấy bạn: đúng người anh đang muốn gặp.', 'Leo khoác vai bạn, kể ngay chuyện sáng nay.'],
    known: [
      { fact: 'square:loves-sunflowers', scene: 'Leo ôm một bó hướng dương, chắc định cắm ở quảng trường.' },
      { fact: 'square:board-games', scene: 'Leo kẹp hộp cờ bàn dưới nách: tối nay lại có ván.' },
      { fact: 'square:sister-baby', scene: 'Leo đang xem ảnh cháu gái mới sinh trên điện thoại, cười tủm tỉm.' },
    ],
  },
  cafe: {
    stranger: ['Emma xách túi đồ chợ, đi vội về quán.', 'Emma tháo tạp dề, tranh thủ ra ngoài hít thở một chút.'],
    friendly: ['Emma thấy bạn liền đứng lại, tay vẫn ôm túi chanh.', 'Emma gọi với theo bạn, hỏi hôm nay đã uống gì chưa.'],
    close: ['Emma ôm chầm lấy bạn, bảo đang định nhắn bạn ghé quán.', 'Emma dúi vào tay bạn một miếng bánh còn ấm.'],
    known: [
      { fact: 'cafe:grandma-cake', scene: 'Emma ôm hộp bánh chanh làm theo công thức của bà.' },
      { fact: 'cafe:likes-plants', scene: 'Emma ôm một chậu cây nhỏ, chắc để đặt trong quán.' },
      { fact: 'cafe:sick-of-lattes', scene: 'Emma cầm ly trà, cười bảo hôm nay nhất quyết không đụng tới latte.' },
    ],
  },
  friend: {
    stranger: ['Mia đeo tai nghe đi ngang, thấy bạn thì gỡ một bên ra.', 'Mia đang chụp ảnh hàng cây ven đường.'],
    friendly: ['Mia vẫy bạn rối rít từ bên kia đường.', 'Mia khoác tay bạn, rủ đi cùng một đoạn.'],
    close: ['Mia chạy tới, kể chuyện như thể đã nhịn cả tuần.', 'Mia đưa bạn một bên tai nghe, bắt nghe cùng bài hát.'],
    known: [
      { fact: 'friend:loves-scarves', scene: 'Mia quấn một chiếc khăn mới, xoay một vòng cho bạn ngắm.' },
      { fact: 'friend:sister-wedding', scene: 'Mia lẩm nhẩm tờ giấy trong tay: bài phát biểu đám cưới chị gái.' },
      { fact: 'friend:bad-haircut', scene: 'Mia đội mũ sụp tới tận mắt, tóc vẫn chưa dài ra.' },
    ],
  },
  home: {
    stranger: ['Bà Grace đi dạo chậm rãi, gật đầu chào bạn.', 'Bà Grace dừng lại nghỉ chân, nhìn bạn hiền hậu.'],
    friendly: ['Bà Grace gọi bạn lại, hỏi dạo này ăn uống có đủ không.', 'Bà Grace khoác giỏ đi chợ, thấy bạn thì cười tươi.'],
    close: ['Bà Grace nắm tay bạn, bảo gặp bạn là bà vui cả ngày.', 'Bà Grace chỉnh lại cổ áo cho bạn như cháu trong nhà.'],
    known: [
      { fact: 'home:loves-roses', scene: 'Bà Grace cầm mấy cành hồng vừa cắt ở vườn.' },
      { fact: 'home:likes-bread', scene: 'Bà Grace ôm ổ bánh mì mới nướng, thơm cả một đoạn đường.' },
      { fact: 'home:sister-england', scene: 'Bà Grace cầm tấm bưu thiếp em gái gửi từ bên Anh.' },
    ],
  },
  shop: {
    stranger: ['Ben đẩy xe hàng đi ngang, mồ hôi nhễ nhại.', 'Ben đang dán tờ giảm giá lên cột đèn.'],
    friendly: ['Ben dừng xe hàng, hỏi bạn có cần mua gì không.', 'Ben vẫy bạn, tay cầm thanh sô-cô-la ăn dở.'],
    close: ['Ben cười to, bảo hôm nay để dành cho bạn món ngon.', 'Ben rủ bạn tối nay qua tiệm chơi cho vui.'],
    known: [
      { fact: 'shop:runs-game-night', scene: 'Ben ôm chồng hộp cờ, chuẩn bị cho tối thứ Sáu.' },
      { fact: 'shop:dads-shop', scene: 'Ben đứng nhìn tờ quảng cáo siêu thị mới, mặt đăm chiêu.' },
      { fact: 'shop:loves-spicy-noodles', scene: 'Ben xách một thùng mì cay, cười hì hì.' },
    ],
  },
  office: {
    stranger: ['Sarah đi rất nhanh, vừa đi vừa nghe điện thoại.', 'Sarah ôm cặp tài liệu, liếc đồng hồ liên tục.'],
    friendly: ['Sarah thấy bạn liền cất điện thoại, chịu đứng lại một chút.', 'Sarah cầm ly cà phê, bảo đang được nghỉ mười phút.'],
    close: ['Sarah thở phào khi gặp bạn: cuối cùng cũng có người để than.', 'Sarah kéo bạn nép vào một góc để kể chuyện.'],
    known: [
      { fact: 'office:interview', scene: 'Sarah lẩm nhẩm câu trả lời phỏng vấn, mặt căng thẳng.' },
      { fact: 'office:team-leader', scene: 'Sarah đeo thẻ trưởng nhóm mới, bước đi tự tin hẳn.' },
      { fact: 'office:loves-notebooks', scene: 'Sarah cầm cuốn sổ mới tinh, ghi chép lia lịa.' },
    ],
  },
  school: {
    stranger: ['Thầy Daniel kẹp mấy quyển sách, đi chậm rãi.', 'Thầy Daniel đang đứng đọc tấm biển chỉ đường.'],
    friendly: ['Thầy Daniel nhận ra bạn, đẩy kính lên chào.', 'Thầy Daniel hỏi bạn dạo này mỗi ngày học được bao lâu.'],
    close: ['Thầy Daniel cười hiền, bảo vừa nghĩ tới bạn thì gặp.', 'Thầy Daniel rủ bạn đi cùng một đoạn cho vui.'],
    known: [
      { fact: 'school:loves-honey', scene: 'Thầy Daniel cầm hũ mật ong vừa mua: trà tối nay có rồi.' },
      { fact: 'school:writing-a-novel', scene: 'Thầy Daniel giấu vội cuốn sổ, chắc lại đang viết tiểu thuyết.' },
      { fact: 'school:conversation-club', scene: 'Thầy Daniel ôm xấp giấy mời câu lạc bộ hội thoại tối thứ Năm.' },
    ],
  },
  station: {
    stranger: ['Sam đi ngang, tay cầm xấp vé xe.', 'Sam dắt một chú chó nhỏ đi dạo.'],
    friendly: ['Sam vẫy bạn, chú chó bên cạnh vẫy đuôi theo.', 'Sam cầm ly latte đá, bảo đang giờ nghỉ.'],
    close: ['Sam reo lên khi thấy bạn, chú chó chạy tới quấn chân bạn.', 'Sam khoe hôm nay xe nào cũng chạy đúng giờ.'],
    known: [
      { fact: 'station:dog-chip', scene: 'Chip chạy lại hít hít giày bạn, Sam cười theo sau.' },
      { fact: 'station:visiting-mom', scene: 'Sam đang xem lịch xe về quê: sắp tới sinh nhật mẹ.' },
      { fact: 'station:hates-phone-calls', scene: 'Điện thoại Sam reo, anh nhìn nó như nhìn ma.' },
    ],
  },
  clinic: {
    stranger: ['Kim mặc đồ chạy bộ, đang thở dốc.', 'Kim xách túi thuốc, đi vội.'],
    friendly: ['Kim dừng lại, nhìn bạn một lượt như đang khám bệnh.', 'Kim hỏi bạn dạo này ngủ có ngon không.'],
    close: ['Kim cười tươi, bảo nhìn sắc mặt là biết dạo này bạn ổn.', 'Kim dúi vào tay bạn một quả táo, bảo ăn cho khỏe.'],
    known: [
      { fact: 'clinic:runs-mornings', scene: 'Kim vừa chạy xong vòng công viên, má đỏ ửng.' },
      { fact: 'clinic:likes-green-tea', scene: 'Kim cầm cốc trà xanh, chắc là cốc thứ tư trong ngày.' },
      { fact: 'clinic:loves-sunflowers', scene: 'Kim cầm gói hạt giống hướng dương: sắp tới mùa trồng.' },
    ],
  },
  cinema: {
    stranger: ['Zoe cầm điện thoại quay mấy cảnh ven đường.', 'Zoe đi ngang, tay ôm hộp bỏng ngô.'],
    friendly: ['Zoe chĩa máy quay về phía bạn, ra hiệu cười một cái.', 'Zoe hỏi bạn tuần này đã xem phim gì chưa.'],
    close: ['Zoe kéo bạn lại xem đoạn phim vừa quay.', 'Zoe bảo bạn sẽ là khán giả đầu tiên của phim mới.'],
    known: [
      { fact: 'cinema:makes-films', scene: 'Zoe đang quay phim ngắn, ra hiệu bạn bước khẽ thôi.' },
      { fact: 'cinema:date-with-max', scene: 'Zoe vừa đi vừa nhắn tin, cười một mình: chắc là Max.' },
      { fact: 'cinema:loves-comics', scene: 'Zoe kẹp cuốn truyện tranh mới dưới tay.' },
    ],
  },
  phone: {
    stranger: ['Max đeo cái tai nghe to, vừa đi vừa lắc lư theo nhạc.', 'Max cầm một cái điện thoại tháo dở.'],
    friendly: ['Max gỡ tai nghe, giơ tay đập tay với bạn.', 'Max hỏi điện thoại của bạn dạo này có chạy ổn không.'],
    close: ['Max khoác vai bạn, gọi bạn là bạn thân nhất thị trấn.', 'Max rủ bạn tối nay chơi cờ bàn.'],
    known: [
      { fact: 'phone:misses-home', scene: 'Max đứng nhìn trời nắng, bảo giống bên Úc quá.' },
      { fact: 'phone:posts-videos', scene: 'Max đang quay video mẹo sửa điện thoại ngay giữa đường.' },
      { fact: 'phone:staying-in-town', scene: 'Max dang tay nhìn quanh, bảo giờ thị trấn này là nhà rồi.' },
    ],
  },
  park: {
    stranger: ['Lily ngồi buộc lại dây giày, mặt hơi buồn.', 'Lily đi một mình, mắt nhìn xuống đất.'],
    friendly: ['Lily thấy bạn liền cười, vẫy tay.', 'Lily bảo hôm nay thấy khá hơn hôm qua nhiều.'],
    close: ['Lily chạy tới ôm bạn một cái thật chặt.', 'Lily kể ngay chuyện vui sáng nay, mắt sáng rỡ.'],
    known: [
      { fact: 'park:has-dog-pip', scene: 'Pip kéo căng dây, lôi Lily về phía bạn.' },
      { fact: 'park:running-club', scene: 'Lily mặc áo câu lạc bộ chạy bộ, vừa chạy xong.' },
      { fact: 'park:stressed-at-work', scene: 'Lily ôm tập hồ sơ công việc, thở dài.' },
    ],
  },
  board: {
    stranger: ['Tom ôm cuộn áp phích, đi tìm chỗ dán.', 'Tom đang ghi gì đó vào sổ tay.'],
    friendly: ['Tom dừng lại, hỏi cuối tuần này bạn có rảnh không.', 'Tom đưa bạn tờ thông báo mới nhất.'],
    close: ['Tom vui hẳn khi gặp bạn, bảo đang cần một người tin cậy.', 'Tom kể kế hoạch mới cho bạn nghe trước tiên.'],
    known: [
      { fact: 'board:runs-volunteers', scene: 'Tom xách túi đồ đi giúp mấy cụ hàng xóm.' },
      { fact: 'board:loves-fresh-bread', scene: 'Tom cầm ổ bánh mì mới nướng, đã ăn mất một nửa.' },
      { fact: 'board:nervous-speaker', scene: 'Tom lẩm nhẩm bài nói, tay run run.' },
    ],
  },
};

const pick = <T>(list: readonly T[], seed: number): T => list[((seed % list.length) + list.length) % list.length];

/**
 * What you see when you meet the resident of `placeId` in the street: a scene built on something you know about them
 * (half the time when you know something), else one for how close you are. `seed` keeps it the same for one meeting
 * (e.g. the day and the place). Null for a place without street scenes.
 */
export function streetScene(placeId: string, hearts: number, knows: (fact: FactId) => boolean, seed: number): string | null {
  const m = STREET_MEETS[placeId];
  if (!m) return null;
  const known = m.known.filter((k) => knows(k.fact));
  if (known.length > 0 && seed % 2 === 0) return pick(known, seed >> 1).scene;
  const tier = hearts >= STREET_CLOSE ? m.close : hearts >= STREET_FRIENDLY ? m.friendly : m.stranger;
  return pick(tier, seed >> 1);
}

/**
 * Before you part, the resident asks you round to where their episode waits (`where`: "nhà trọ", "quán cà phê"…):
 * the next part of their story is told there, not in the street.
 */
export function streetInvite(resident: string, where: string, relisten: boolean): string {
  return relisten ? tl`${resident} rủ bạn lúc nào rảnh ghé ${where}, kể lại chuyện hôm trước cho nhớ.` : tl`${resident} dặn lúc nào rảnh thì ghé ${where}: có chuyện muốn kể với bạn.`;
}
