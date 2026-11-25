// "Phụ bếp quán Gianna" (core/town/shiftTypes.ts): the waiter at Gianna's calls an order through the hatch and the
// learner sets the dish, the change and the table before the plate goes cold. Gianna's is the Italian restaurant on
// Market Street (docs/city.md §2). Level 1 names only the answer; level 2 says it the way people do, with a reason;
// level 3 has a change of mind or a sound-alike ("fifteen" / "fifty", "two" / "twelve") and may name a wrong option.

import type { Level } from '../../../core/types';
import type { ShiftDef, ShiftOption, ShiftOrder } from '../../../core/town/shiftTypes';

const DISHES: readonly ShiftOption[] = [
  { id: 'lasagne', label: 'Lasagne', hear: ['lasagne'] },
  { id: 'risotto', label: 'Risotto', hear: ['risotto'] },
  { id: 'carbonara', label: 'Carbonara', hear: ['carbonara'] },
  { id: 'margherita', label: 'Margherita', hear: ['margherita'] },
  { id: 'minestrone', label: 'Minestrone', hear: ['minestrone'] },
  { id: 'tiramisu', label: 'Tiramisu', hear: ['tiramisu'] },
];

const CHANGES: readonly ShiftOption[] = [
  { id: 'onions', label: 'Không hành', hear: ['no onions', 'without onions'] },
  { id: 'cheese', label: 'Thêm phô mai', hear: ['extra cheese', 'more cheese'] },
  { id: 'side', label: 'Sốt để riêng', hear: ['sauce on the side'] },
  { id: 'garlic', label: 'Không tỏi', hear: ['no garlic', 'without garlic'] },
  { id: 'gf', label: 'Không gluten', hear: ['gluten free'] },
  { id: 'plain', label: 'Giữ nguyên', hear: ['as it comes', 'nothing changed', 'no changes'] },
];

const TABLES: readonly ShiftOption[] = [
  { id: 't2', label: 'Bàn 2', hear: ['table two'] },
  { id: 't4', label: 'Bàn 4', hear: ['table four'] },
  { id: 't7', label: 'Bàn 7', hear: ['table seven'] },
  { id: 't9', label: 'Bàn 9', hear: ['table nine'] },
  { id: 't12', label: 'Bàn 12', hear: ['table twelve'] },
  { id: 't15', label: 'Bàn 15', hear: ['table fifteen'] },
];

type Dish = 'lasagne' | 'risotto' | 'carbonara' | 'margherita' | 'minestrone' | 'tiramisu';
type Change = 'onions' | 'cheese' | 'side' | 'garlic' | 'gf' | 'plain';
type Table = 't2' | 't4' | 't7' | 't9' | 't12' | 't15';

const o = (n: number, level: Level, gender: 'm' | 'f', text: string, vi: string, dish: Dish, change: Change, table: Table): ShiftOrder => ({
  id: `sh-kitchen-${n}`,
  level,
  gender: gender === 'm' ? 'male' : 'female',
  text,
  vi,
  answer: { dish, change, table },
});

const ORDERS: readonly ShiftOrder[] = [
  // ── level 1: said plainly, nothing else named ──
  o(1, 1, 'm', 'One risotto for table seven, no onions, please.', 'Một risotto cho bàn bảy, không hành nhé.', 'risotto', 'onions', 't7'),
  o(2, 1, 'f', 'Table four wants the lasagne with extra cheese.', 'Bàn bốn muốn lasagne thêm phô mai.', 'lasagne', 'cheese', 't4'),
  o(3, 1, 'm', 'Carbonara for table nine, sauce on the side, please.', 'Carbonara cho bàn chín, sốt để riêng nhé.', 'carbonara', 'side', 't9'),
  o(4, 1, 'f', 'One margherita for table twelve, gluten free, please.', 'Một margherita cho bàn mười hai, không gluten nhé.', 'margherita', 'gf', 't12'),
  o(5, 1, 'm', 'Minestrone for table fifteen, nothing changed, thanks.', 'Minestrone cho bàn mười lăm, giữ nguyên, cảm ơn.', 'minestrone', 'plain', 't15'),
  o(6, 1, 'f', 'Tiramisu for table two, as it comes, please.', 'Tiramisu cho bàn hai, giữ nguyên nhé.', 'tiramisu', 'plain', 't2'),
  o(7, 1, 'm', 'One lasagne for table nine, no garlic, please.', 'Một lasagne cho bàn chín, không tỏi nhé.', 'lasagne', 'garlic', 't9'),
  o(8, 1, 'f', 'Table twelve would like the risotto with extra cheese.', 'Bàn mười hai muốn risotto thêm phô mai.', 'risotto', 'cheese', 't12'),
  o(9, 1, 'm', 'The carbonara for table four, no garlic, thanks.', 'Carbonara cho bàn bốn, không tỏi, cảm ơn.', 'carbonara', 'garlic', 't4'),
  o(10, 1, 'f', 'One minestrone for table seven, gluten free, please.', 'Một minestrone cho bàn bảy, không gluten nhé.', 'minestrone', 'gf', 't7'),
  o(11, 1, 'm', 'Margherita for table fifteen, extra cheese, please.', 'Margherita cho bàn mười lăm, thêm phô mai nhé.', 'margherita', 'cheese', 't15'),
  o(12, 1, 'f', 'Table two, the tiramisu, with the sauce on the side.', 'Bàn hai, tiramisu, sốt để riêng.', 'tiramisu', 'side', 't2'),
  o(13, 1, 'm', 'One lasagne for table twelve, gluten free, please.', 'Một lasagne cho bàn mười hai, không gluten nhé.', 'lasagne', 'gf', 't12'),
  o(14, 1, 'f', 'Risotto for table four, as it comes, thanks.', 'Risotto cho bàn bốn, giữ nguyên, cảm ơn.', 'risotto', 'plain', 't4'),

  // ── level 2: said the way people say it ──
  o(15, 2, 'f', "Can I get a carbonara for table seven? The lady's allergic to onions, so no onions, please.", 'Cho một carbonara cho bàn bảy nhé? Bà khách bị dị ứng hành, nên không hành nhé.', 'carbonara', 'onions', 't7'),
  o(16, 2, 'm', 'Table nine has ordered the tiramisu. The sauce on the side, please, they like to pour it themselves.', 'Bàn chín gọi tiramisu. Sốt để riêng nhé, họ thích tự rưới.', 'tiramisu', 'side', 't9'),
  o(17, 2, 'f', "I've got a gluten free lasagne for table fifteen. Don't tell the chef, he'll cry.", 'Tôi có một lasagne không gluten cho bàn mười lăm. Đừng nói với bếp trưởng, ông ấy sẽ khóc mất.', 'lasagne', 'gf', 't15'),
  o(18, 2, 'm', "Table two is a couple on a date. They want one margherita with extra cheese, and they're sharing it.", 'Bàn hai là một cặp đang hẹn hò. Họ muốn một margherita thêm phô mai, và họ ăn chung.', 'margherita', 'cheese', 't2'),
  o(19, 2, 'f', 'Minestrone for table four, and no garlic, please. She says it gives her a headache.', 'Minestrone cho bàn bốn, và không tỏi nhé. Bà ấy nói tỏi làm bà ấy đau đầu.', 'minestrone', 'garlic', 't4'),
  o(20, 2, 'm', 'A risotto for table twelve, just as it comes. He says the chef knows best.', 'Một risotto cho bàn mười hai, cứ giữ nguyên. Ông ấy bảo bếp trưởng biết rõ nhất.', 'risotto', 'plain', 't12'),
  o(21, 2, 'f', "Hey, can you do a carbonara for table fifteen with extra cheese? It's his birthday.", 'Này, làm một carbonara cho bàn mười lăm, thêm phô mai được không? Hôm nay là sinh nhật ông ấy.', 'carbonara', 'cheese', 't15'),
  o(22, 2, 'm', "It's the vegetarian at table nine. Lasagne, gluten free, and be careful, she's very particular.", 'Là cô khách ăn chay ở bàn chín. Lasagne, không gluten, và cẩn thận nhé, cô ấy rất kỹ tính.', 'lasagne', 'gf', 't9'),
  o(23, 2, 'f', "Table seven wants the minestrone, but no onions, he says they don't agree with him.", 'Bàn bảy muốn minestrone, nhưng không hành, ông ấy nói ăn hành là không hợp.', 'minestrone', 'onions', 't7'),
  o(24, 2, 'm', "I need one margherita for table four, nothing changed. They've been waiting ages, sorry.", 'Tôi cần một margherita cho bàn bốn, giữ nguyên. Họ chờ lâu lắm rồi, xin lỗi nhé.', 'margherita', 'plain', 't4'),
  o(25, 2, 'f', "Tiramisu for table twelve, please, and it's gluten free. Can you check the biscuits?", 'Tiramisu cho bàn mười hai nhé, và phải không gluten. Anh kiểm tra phần bánh quy giúp nhé?', 'tiramisu', 'gf', 't12'),
  o(26, 2, 'm', "For table two, the risotto with the sauce on the side. She's fussy tonight.", 'Bàn hai, risotto, sốt để riêng. Tối nay bà ấy khó tính lắm.', 'risotto', 'side', 't2'),
  o(27, 2, 'f', "Table fifteen is having the lasagne, as it comes. They said they're starving.", 'Bàn mười lăm gọi lasagne, giữ nguyên. Họ nói đói rã người rồi.', 'lasagne', 'plain', 't15'),
  o(28, 2, 'm', 'Can I get a carbonara for table nine? Extra cheese, because the kids love it.', 'Cho một carbonara cho bàn chín nhé? Thêm phô mai, vì bọn trẻ mê món đó.', 'carbonara', 'cheese', 't9'),

  // ── level 3: a change of mind, a sound-alike, a wrong option named ──
  o(29, 3, 'f', 'Table fifteen. No, sorry, fifty does not exist. Fifteen. The carbonara, extra cheese, please.', 'Bàn mười lăm. Không, xin lỗi, làm gì có bàn năm mươi. Mười lăm. Carbonara, thêm phô mai nhé.', 'carbonara', 'cheese', 't15'),
  o(30, 3, 'm', 'Table seven wants the risotto, no, the lasagne, sorry. Table seven, lasagne, no garlic, please.', 'Bàn bảy muốn risotto, à không, lasagne, xin lỗi. Bàn bảy, lasagne, không tỏi nhé.', 'lasagne', 'garlic', 't7'),
  o(31, 3, 'f', 'Make that table nine, not table twelve. One margherita, sauce on the side.', 'Sửa lại là bàn chín, không phải bàn mười hai. Một margherita, sốt để riêng.', 'margherita', 'side', 't9'),
  o(32, 3, 'm', "Tiramisu for table two. Two, not twelve. And it's gluten free, so check the biscuit.", 'Tiramisu cho bàn hai. Hai, không phải mười hai. Và phải không gluten, nên kiểm tra phần bánh quy nhé.', 'tiramisu', 'gf', 't2'),
  o(33, 3, 'f', 'Table nine ordered the minestrone with extra cheese. Cancel that, they changed their minds, just as it comes.', 'Bàn chín gọi minestrone thêm phô mai. Hủy đi, họ đổi ý rồi, cứ giữ nguyên.', 'minestrone', 'plain', 't9'),
  o(34, 3, 'm', 'Margherita, table twelve. Actually the minestrone, sorry. Table twelve, minestrone, no garlic.', 'Margherita, bàn mười hai. Thật ra là minestrone, xin lỗi. Bàn mười hai, minestrone, không tỏi.', 'minestrone', 'garlic', 't12'),
  o(35, 3, 'f', "Sorry, kitchen, it's been a mad night. Table four, not fourteen. One lasagne, gluten free, please.", 'Xin lỗi bếp, tối nay loạn quá. Bàn bốn, không phải mười bốn. Một lasagne, không gluten nhé.', 'lasagne', 'gf', 't4'),
  o(36, 3, 'm', 'Sorry, I said table nine but it is table seven. They swapped seats. Risotto, extra cheese.', 'Xin lỗi, tôi nói bàn chín nhưng là bàn bảy. Họ đổi chỗ ngồi. Risotto, thêm phô mai.', 'risotto', 'cheese', 't7'),
  o(37, 3, 'f', 'Tiramisu for table twelve, sauce on the side. No, wait, they want it as it comes. Same table.', 'Tiramisu cho bàn mười hai, sốt để riêng. Không, khoan, họ muốn giữ nguyên. Vẫn bàn đó.', 'tiramisu', 'plain', 't12'),
  o(38, 3, 'm', 'I said no onions, but it is no garlic. The risotto for table two, not table four. Sorry, chef.', 'Tôi nói không hành, nhưng là không tỏi. Risotto cho bàn hai, không phải bàn bốn. Xin lỗi bếp trưởng.', 'risotto', 'garlic', 't2'),
  o(39, 3, 'f', 'Table twelve has changed to table nine. Margherita there, extra cheese, and the kids want it quickly.', 'Bàn mười hai đã chuyển sang bàn chín. Margherita ở đó, thêm phô mai, và bọn trẻ muốn có nhanh.', 'margherita', 'cheese', 't9'),
  o(40, 3, 'm', "Carbonara for table seven, no garlic, no wait, extra cheese. Yeah, extra cheese, the lady's changed her mind.", 'Carbonara cho bàn bảy, không tỏi, à khoan, thêm phô mai. Đúng rồi, thêm phô mai, bà khách đổi ý rồi.', 'carbonara', 'cheese', 't7'),
];

export const KITCHEN_SHIFT: ShiftDef = {
  id: 'kitchen',
  name: 'Phụ bếp quán Gianna',
  at: 'gianna',
  blurb: 'Phục vụ gọi món vào bếp nhanh như lúc quán đông: nghe xem món gì, thay đổi gì, bàn nào, rồi chọn trước khi đĩa nguội.',
  slots: [
    { id: 'dish', label: 'Món', options: DISHES },
    { id: 'change', label: 'Thay đổi', options: CHANGES },
    { id: 'table', label: 'Bàn', options: TABLES },
  ],
  orders: ORDERS,
};
