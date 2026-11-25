// "Sạp hoa của Nora" (core/town/shiftTypes.ts): customers at Nora's flower stall on Market Street say what they want.
// The learner sets which flower, which colour and how many. Level 1 names only the answer; level 2 says it the way
// people do (half a dozen, two dozen, more words round it); level 3 has a change of mind or a sound-alike and may
// name a wrong option.

import type { Level } from '../../../core/types';
import type { ShiftDef, ShiftOrder } from '../../../core/town/shiftTypes';

type Flower = 'roses' | 'tulips' | 'sunflowers' | 'lilies' | 'daisies' | 'carnations';
type Colour = 'red' | 'white' | 'yellow' | 'pink' | 'purple' | 'mixed';
type Amount = 'n6' | 'n10' | 'n12' | 'n20' | 'n24';

const o = (n: number, level: Level, gender: 'm' | 'f', text: string, vi: string, flower: Flower, colour: Colour, amount: Amount): ShiftOrder => ({
  id: `sh-flowers-${n}`,
  level,
  gender: gender === 'm' ? 'male' : 'female',
  text,
  vi,
  answer: { flower, colour, amount },
});

const ORDERS: readonly ShiftOrder[] = [
  // ── level 1: said plainly, nothing else named ──
  o(1, 1, 'f', "A dozen yellow tulips, please. They're for my mum's birthday.", 'Cho tôi một tá tulip vàng. Để tặng sinh nhật mẹ tôi.', 'tulips', 'yellow', 'n12'),
  o(2, 1, 'm', "Can I have ten red roses, please? It's our anniversary.", 'Cho tôi mười bông hồng đỏ nhé? Hôm nay là ngày kỷ niệm của chúng tôi.', 'roses', 'red', 'n10'),
  o(3, 1, 'f', "Six white lilies, please. They're for my grandmother.", 'Cho tôi sáu bông loa kèn trắng. Để tặng bà tôi.', 'lilies', 'white', 'n6'),
  o(4, 1, 'm', "I'd like twenty pink carnations for the school concert, please.", 'Tôi lấy hai mươi bông cẩm chướng hồng cho buổi hòa nhạc ở trường.', 'carnations', 'pink', 'n20'),
  o(5, 1, 'f', 'Could I get ten sunflowers, please? Yellow ones, for my kitchen.', 'Cho tôi mười bông hướng dương nhé? Loại vàng, để trong bếp.', 'sunflowers', 'yellow', 'n10'),
  o(6, 1, 'm', 'Two dozen purple tulips, please. My sister loves purple.', 'Cho tôi hai tá tulip tím. Em gái tôi mê màu tím.', 'tulips', 'purple', 'n24'),
  o(7, 1, 'f', 'Can I have six pink roses for my daughter, please?', 'Cho tôi sáu bông hồng hồng để tặng con gái nhé?', 'roses', 'pink', 'n6'),
  o(8, 1, 'm', "Twelve white daisies, please. They're for a little wedding table.", 'Cho tôi mười hai bông cúc trắng. Để trang trí một bàn tiệc cưới nhỏ.', 'daisies', 'white', 'n12'),
  o(9, 1, 'f', "I'd like a dozen mixed carnations, please, for the office.", 'Tôi lấy một tá cẩm chướng nhiều màu, để ở văn phòng.', 'carnations', 'mixed', 'n12'),
  o(10, 1, 'm', "Twenty red tulips, please. We're having a party tonight.", 'Cho tôi hai mươi bông tulip đỏ. Tối nay chúng tôi có tiệc.', 'tulips', 'red', 'n20'),
  o(11, 1, 'f', "Could I have ten purple lilies? They're for my teacher.", 'Cho tôi mười bông loa kèn tím được không? Để tặng cô giáo tôi.', 'lilies', 'purple', 'n10'),
  o(12, 1, 'm', 'Six yellow daisies, please. My little boy wants to give them to his nan.', 'Cho tôi sáu bông cúc vàng. Thằng nhóc nhà tôi muốn tặng bà nội.', 'daisies', 'yellow', 'n6'),
  o(13, 1, 'f', 'Can I get twenty-four white roses for a wedding, please?', 'Cho tôi hai mươi bốn bông hồng trắng cho một đám cưới nhé?', 'roses', 'white', 'n24'),
  o(14, 1, 'm', 'Twenty sunflowers, please, the yellow ones. They make the house look happy.', 'Cho tôi hai mươi bông hướng dương, loại vàng. Nhìn nhà vui hẳn lên.', 'sunflowers', 'yellow', 'n20'),

  // ── level 2: said the way people say it ──
  o(15, 2, 'm', "Half a dozen red roses, please. I forgot our anniversary, so I'd better make it look good.", 'Cho tôi nửa tá hồng đỏ. Tôi quên mất ngày kỷ niệm, nên phải làm cho thật đẹp.', 'roses', 'red', 'n6'),
  o(16, 2, 'f', "Could you do two dozen pink tulips? My aunt's turning ninety and she adores them.", 'Chị bó giúp hai tá tulip hồng được không? Dì tôi sắp tròn chín mươi và dì mê loại này lắm.', 'tulips', 'pink', 'n24'),
  o(17, 2, 'm', "It's my first date in years. Is a dozen white roses too much? I'll take them anyway.", 'Lần hẹn hò đầu tiên sau bao năm. Một tá hồng trắng có quá không? Thôi kệ, tôi lấy.', 'roses', 'white', 'n12'),
  o(18, 2, 'f', "I need some lilies for the hospital, the pink ones. Ten should be enough, I think.", 'Tôi cần ít loa kèn mang vào bệnh viện, loại hồng. Chắc mười bông là đủ.', 'lilies', 'pink', 'n10'),
  o(19, 2, 'm', 'My wife says I never buy her flowers. Twenty purple carnations ought to fix that, right?', 'Vợ tôi bảo tôi chẳng bao giờ mua hoa cho cô ấy. Hai mươi bông cẩm chướng tím chắc gỡ được, nhỉ?', 'carnations', 'purple', 'n20'),
  o(20, 2, 'f', 'The kids want to brighten up their classroom. Could we get a dozen daisies in a mix of colours?', 'Bọn trẻ muốn lớp học sáng sủa hơn. Cho chúng tôi một tá cúc đủ màu được không?', 'daisies', 'mixed', 'n12'),
  o(21, 2, 'm', "Have you got any of the big yellow sunflowers? I'll take six for my neighbour who's moving away.", 'Chị còn hướng dương vàng loại to không? Tôi lấy sáu bông tặng người hàng xóm sắp chuyển đi.', 'sunflowers', 'yellow', 'n6'),
  o(22, 2, 'f', "I'm going to a dinner party and want something cheerful. Ten mixed tulips, please.", 'Tôi đi dự tiệc tối và muốn thứ gì đó tươi vui. Cho tôi mười bông tulip nhiều màu.', 'tulips', 'mixed', 'n10'),
  o(23, 2, 'm', 'Two dozen red carnations for the restaurant tables, please, one for each table.', 'Cho tôi hai tá cẩm chướng đỏ cho các bàn ở nhà hàng, mỗi bàn một bông.', 'carnations', 'red', 'n24'),
  o(24, 2, 'f', 'Could I get twenty white daisies? My sister is getting married on Saturday.', 'Cho tôi hai mươi bông cúc trắng được không? Thứ Bảy này em gái tôi cưới.', 'daisies', 'white', 'n20'),
  o(25, 2, 'm', "I'd like a dozen purple roses, please. Don't ask, it's a long story.", 'Cho tôi một tá hồng tím. Đừng hỏi, chuyện dài lắm.', 'roses', 'purple', 'n12'),
  o(26, 2, 'f', 'Half a dozen pink carnations for my nan, please. She always keeps one in her hat.', 'Cho tôi nửa tá cẩm chướng hồng tặng bà. Bà lúc nào cũng cài một bông lên mũ.', 'carnations', 'pink', 'n6'),
  o(27, 2, 'm', "It's my boss's last day. Could you put together twenty yellow lilies for her?", 'Hôm nay là ngày làm cuối của sếp tôi. Chị bó giúp hai mươi bông loa kèn vàng tặng cô ấy được không?', 'lilies', 'yellow', 'n20'),
  o(28, 2, 'f', "I'll have ten white tulips, please. My mother-in-law hates anything bright.", 'Cho tôi mười bông tulip trắng. Mẹ chồng tôi ghét mấy thứ sặc sỡ.', 'tulips', 'white', 'n10'),

  // ── level 3: a change of mind, a sound-alike, two reductions ──
  o(29, 3, 'm', "Ten red roses, please. No, wait, make that twenty. It's a big apology.", 'Cho tôi mười bông hồng đỏ. À khoan, lấy hai mươi. Đây là một lời xin lỗi lớn.', 'roses', 'red', 'n20'),
  o(30, 3, 'f', "Can I have a dozen yellow tulips? Actually, pink ones. She's had enough yellow this week.", 'Cho tôi một tá tulip vàng nhé? À thôi, lấy màu hồng. Tuần này cô ấy nhận đủ màu vàng rồi.', 'tulips', 'pink', 'n12'),
  o(31, 3, 'm', "I wanted to get some lilies, but she's allergic. Better make it carnations, two dozen, all white.", 'Tôi định mua loa kèn, nhưng cô ấy bị dị ứng. Thôi lấy cẩm chướng, hai tá, toàn màu trắng.', 'carnations', 'white', 'n24'),
  o(32, 3, 'f', 'Not sixteen, sorry, I meant six. Six purple daisies, please. My bag is tiny.', 'Không phải mười sáu, xin lỗi, ý tôi là sáu. Sáu bông cúc tím nhé. Túi tôi bé xíu.', 'daisies', 'purple', 'n6'),
  o(33, 3, 'm', "I'd like a mixed bunch of roses, a dozen. Oh, no, half a dozen. I'm going to be broke.", 'Tôi muốn một bó hồng nhiều màu, một tá. Ôi không, nửa tá thôi. Không thì tôi cháy túi mất.', 'roses', 'mixed', 'n6'),
  o(34, 3, 'f', "Sunflowers, please, the yellow ones. Twenty? Or ten? Let's say ten. I haven't got a big vase.", 'Cho tôi hướng dương, loại vàng. Hai mươi? Hay mười? Thôi mười đi. Nhà tôi không có bình to.', 'sunflowers', 'yellow', 'n10'),
  o(35, 3, 'm', "Do you want to know what she likes? Purple. So, twenty purple lilies, if you've got them.", 'Chị có muốn biết cô ấy thích gì không? Màu tím. Vậy cho tôi hai mươi bông loa kèn tím, nếu chị có.', 'lilies', 'purple', 'n20'),
  o(36, 3, 'f', "I've got to get something for my mum. Daisies, I think, a dozen, and in red if you've got any.", 'Tôi phải mua gì đó tặng mẹ. Chắc là cúc, một tá, màu đỏ nếu chị có.', 'daisies', 'red', 'n12'),
  o(37, 3, 'm', 'Two dozen white tulips. No, red. No, white. Sorry, white, final answer.', 'Hai tá tulip trắng. À không, đỏ. Không, trắng. Xin lỗi, trắng, chốt luôn.', 'tulips', 'white', 'n24'),
  o(38, 3, 'f', "Can I have twelve, no, twenty mixed carnations? It's for the whole office.", 'Cho tôi mười hai, à không, hai mươi bông cẩm chướng nhiều màu nhé? Cho cả văn phòng.', 'carnations', 'mixed', 'n20'),
  o(39, 3, 'm', "My husband wanted roses, but I think lilies are nicer. Ten pink lilies, please, and don't tell him.", 'Chồng tôi muốn hoa hồng, nhưng tôi thấy loa kèn đẹp hơn. Cho tôi mười bông loa kèn hồng, đừng nói với anh ấy nhé.', 'lilies', 'pink', 'n10'),
  o(40, 3, 'f', 'What have you got in purple? Tulips? Lovely, half a dozen of those, please.', 'Chị có hoa gì màu tím? Tulip à? Đẹp quá, cho tôi nửa tá nhé.', 'tulips', 'purple', 'n6'),
];

export const FLOWERS_SHIFT: ShiftDef = {
  id: 'flowers',
  name: 'Sạp hoa của Nora',
  at: 'nora',
  blurb: 'Khách tới sạp hoa và nói nhanh như ngoài đời: nghe xem họ muốn hoa gì, màu gì, bao nhiêu bông, rồi chọn trước khi khách hết kiên nhẫn.',
  slots: [
    {
      id: 'flower',
      label: 'Hoa',
      options: [
        { id: 'roses', label: 'Hoa hồng', hear: ['roses', 'rose'] },
        { id: 'tulips', label: 'Tulip', hear: ['tulips', 'tulip'] },
        { id: 'sunflowers', label: 'Hướng dương', hear: ['sunflowers', 'sunflower'] },
        { id: 'lilies', label: 'Loa kèn', hear: ['lilies', 'lily'] },
        { id: 'daisies', label: 'Cúc', hear: ['daisies', 'daisy'] },
        { id: 'carnations', label: 'Cẩm chướng', hear: ['carnations', 'carnation'] },
      ],
    },
    {
      id: 'colour',
      label: 'Màu',
      options: [
        { id: 'red', label: 'Đỏ', hear: ['red'] },
        { id: 'white', label: 'Trắng', hear: ['white'] },
        { id: 'yellow', label: 'Vàng', hear: ['yellow'] },
        { id: 'pink', label: 'Hồng', hear: ['pink'] },
        { id: 'purple', label: 'Tím', hear: ['purple'] },
        { id: 'mixed', label: 'Nhiều màu', hear: ['mixed', 'a mix of colours'] },
      ],
    },
    {
      id: 'amount',
      label: 'Bao nhiêu',
      options: [
        { id: 'n6', label: '6', hear: ['six', 'half a dozen'] },
        { id: 'n10', label: '10', hear: ['ten'] },
        { id: 'n12', label: '12', hear: ['twelve', 'a dozen'] },
        { id: 'n20', label: '20', hear: ['twenty'] },
        { id: 'n24', label: '24', hear: ['twenty four', 'two dozen'] },
      ],
    },
  ],
  orders: ORDERS,
};
