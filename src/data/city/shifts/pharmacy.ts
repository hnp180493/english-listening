// "Phụ quầy thuốc với Nell" (core/town/shiftTypes.ts): Nell, the pharmacist at the hospital (docs/city.md §7: she
// explains every dose twice, "twice a day, with food"), reads out how a medicine is to be taken and the learner fills
// in the label: how much, how often, when or how. Level 1 names only the answer; level 2 says it the way people do,
// with a reason; level 3 has a correction or a wrong option named ("One tablet. Not two tablets.").

import type { Level } from '../../../core/types';
import type { ShiftDef, ShiftOption, ShiftOrder } from '../../../core/town/shiftTypes';

const HOW_MUCH: readonly ShiftOption[] = [
  { id: 'tab1', label: '1 viên', hear: ['one tablet', 'a single tablet'] },
  { id: 'tab2', label: '2 viên', hear: ['two tablets'] },
  { id: 'spoon', label: '1 thìa', hear: ['one spoonful', 'a spoonful'] },
  { id: 'drops', label: '2 giọt', hear: ['two drops'] },
  { id: 'puff', label: '1 lần xịt', hear: ['one puff', 'a puff'] },
];

const HOW_OFTEN: readonly ShiftOption[] = [
  { id: 'once', label: 'Một lần mỗi ngày', hear: ['once a day', 'once daily'] },
  { id: 'twice', label: 'Hai lần mỗi ngày', hear: ['twice a day', 'twice daily'] },
  { id: 'thrice', label: 'Ba lần mỗi ngày', hear: ['three times a day'] },
  { id: 'four', label: 'Cách bốn tiếng', hear: ['every four hours'] },
  { id: 'need', label: 'Chỉ khi cần', hear: ['only when needed', 'only if needed', 'as needed'] },
];

const WHEN_HOW: readonly ShiftOption[] = [
  { id: 'food', label: 'Cùng bữa ăn', hear: ['with food'] },
  { id: 'bed', label: 'Trước khi ngủ', hear: ['before bed'] },
  { id: 'morning', label: 'Buổi sáng', hear: ['in the morning'] },
  { id: 'empty', label: 'Lúc đói', hear: ['on an empty stomach'] },
  { id: 'after', label: 'Sau bữa ăn', hear: ['after meals'] },
  { id: 'water', label: 'Uống nhiều nước', hear: ['with a full glass of water', 'with a glass of water'] },
];

type Much = 'tab1' | 'tab2' | 'spoon' | 'drops' | 'puff';
type Often = 'once' | 'twice' | 'thrice' | 'four' | 'need';
type WhenHow = 'food' | 'bed' | 'morning' | 'empty' | 'after' | 'water';

const o = (n: number, level: Level, gender: 'm' | 'f', text: string, vi: string, much: Much, often: Often, when: WhenHow): ShiftOrder => ({
  id: `sh-pharmacy-${n}`,
  level,
  gender: gender === 'm' ? 'male' : 'female',
  text,
  vi,
  answer: { much, often, when },
});

const ORDERS: readonly ShiftOrder[] = [
  // ── level 1: said plainly, nothing else named ──
  o(1, 1, 'f', 'Two tablets, twice a day, with food.', 'Hai viên, hai lần mỗi ngày, uống cùng bữa ăn.', 'tab2', 'twice', 'food'),
  o(2, 1, 'm', 'One tablet, once a day, in the morning, please.', 'Một viên, một lần mỗi ngày, vào buổi sáng nhé.', 'tab1', 'once', 'morning'),
  o(3, 1, 'f', 'Take one spoonful three times a day, after meals.', 'Uống một thìa, ba lần mỗi ngày, sau bữa ăn.', 'spoon', 'thrice', 'after'),
  o(4, 1, 'm', 'Two drops, twice a day, before bed.', 'Hai giọt, hai lần mỗi ngày, trước khi ngủ.', 'drops', 'twice', 'bed'),
  o(5, 1, 'f', 'One tablet, only when needed, with a full glass of water.', 'Một viên, chỉ khi cần, uống với một ly nước đầy.', 'tab1', 'need', 'water'),
  o(6, 1, 'm', 'Two tablets, three times a day, after meals, please.', 'Hai viên, ba lần mỗi ngày, sau bữa ăn nhé.', 'tab2', 'thrice', 'after'),
  o(7, 1, 'f', 'One puff, once a day, before bed.', 'Xịt một lần, một lần mỗi ngày, trước khi ngủ.', 'puff', 'once', 'bed'),
  o(8, 1, 'm', 'One spoonful, every four hours, with food.', 'Một thìa, cách bốn tiếng một lần, uống cùng bữa ăn.', 'spoon', 'four', 'food'),
  o(9, 1, 'f', 'Two drops, once a day, in the morning.', 'Hai giọt, một lần mỗi ngày, vào buổi sáng.', 'drops', 'once', 'morning'),
  o(10, 1, 'm', 'Two tablets, once a day, on an empty stomach.', 'Hai viên, một lần mỗi ngày, uống lúc đói.', 'tab2', 'once', 'empty'),
  o(11, 1, 'f', 'One tablet, twice a day, with food, please.', 'Một viên, hai lần mỗi ngày, uống cùng bữa ăn nhé.', 'tab1', 'twice', 'food'),
  o(12, 1, 'm', 'One spoonful, only when needed, before bed.', 'Một thìa, chỉ khi cần, trước khi ngủ.', 'spoon', 'need', 'bed'),
  o(13, 1, 'f', 'Two tablets, every four hours, with a full glass of water.', 'Hai viên, cách bốn tiếng một lần, uống với một ly nước đầy.', 'tab2', 'four', 'water'),
  o(14, 1, 'm', 'One puff, three times a day, after meals.', 'Xịt một lần, ba lần mỗi ngày, sau bữa ăn.', 'puff', 'thrice', 'after'),

  // ── level 2: said the way people say it ──
  o(15, 2, 'f', "Right, this one is for your chest. Two tablets, twice a day, and take them with food or you'll feel sick.", 'Được rồi, thuốc này trị ngực của bác. Hai viên, hai lần mỗi ngày, và uống cùng bữa ăn kẻo bị buồn nôn.', 'tab2', 'twice', 'food'),
  o(16, 2, 'm', "It's the green bottle. One spoonful three times a day, and the best time is after meals.", 'Là chai màu xanh. Một thìa, ba lần mỗi ngày, và tốt nhất là uống sau bữa ăn.', 'spoon', 'thrice', 'after'),
  o(17, 2, 'f', "For the eye infection, it's two drops once a day. Do it in the morning, before work.", 'Với chỗ nhiễm trùng ở mắt, nhỏ hai giọt, một lần mỗi ngày. Nhỏ vào buổi sáng, trước khi đi làm.', 'drops', 'once', 'morning'),
  o(18, 2, 'm', "Your inhaler is easy. One puff, only when needed, and rinse your mouth with a full glass of water afterwards.", 'Ống xịt của bác dễ dùng thôi. Xịt một lần, chỉ khi cần, rồi súc miệng với một ly nước đầy.', 'puff', 'need', 'water'),
  o(19, 2, 'f', "These are strong, so just one tablet, once a day, on an empty stomach. Don't have breakfast first, okay?", 'Thuốc này mạnh, nên chỉ một viên, một lần mỗi ngày, uống lúc đói. Đừng ăn sáng trước nhé?', 'tab1', 'once', 'empty'),
  o(20, 2, 'm', 'Dr Osei wants two tablets every four hours, with a full glass of water, even at night.', 'Bác sĩ Osei muốn bác uống hai viên cách bốn tiếng một lần, với một ly nước đầy, kể cả ban đêm.', 'tab2', 'four', 'water'),
  o(21, 2, 'f', "Hi, it's Nell at the pharmacy. The cough syrup is one spoonful, only when needed, and I'd have it before bed.", 'Chào bác, Nell ở quầy thuốc đây. Siro ho là một thìa, chỉ khi cần, và tôi khuyên bác uống trước khi ngủ.', 'spoon', 'need', 'bed'),
  o(22, 2, 'm', 'The antibiotic is one tablet twice a day, and it has to be with food. Finish the whole box.', 'Thuốc kháng sinh là một viên, hai lần mỗi ngày, và phải uống cùng bữa ăn. Uống hết cả hộp nhé.', 'tab1', 'twice', 'food'),
  o(23, 2, 'f', 'These drops go in the ear. Two drops, three times a day, after meals, so you remember them.', 'Thuốc nhỏ này dùng cho tai. Hai giọt, ba lần mỗi ngày, sau bữa ăn, cho dễ nhớ.', 'drops', 'thrice', 'after'),
  o(24, 2, 'm', "Two tablets, once a day, in the morning, and don't skip it at the weekend.", 'Hai viên, một lần mỗi ngày, vào buổi sáng, và cuối tuần cũng đừng bỏ.', 'tab2', 'once', 'morning'),
  o(25, 2, 'f', 'The pain relief is one tablet, only when needed, and after meals is best for your stomach.', 'Thuốc giảm đau là một viên, chỉ khi cần, và uống sau bữa ăn là tốt nhất cho dạ dày bác.', 'tab1', 'need', 'after'),
  o(26, 2, 'm', 'Start with one puff in the morning, then every four hours until the cough settles.', 'Bắt đầu bằng một lần xịt vào buổi sáng, rồi cách bốn tiếng một lần cho tới khi cơn ho dịu đi.', 'puff', 'four', 'morning'),
  o(27, 2, 'f', 'The syrup tastes awful, so one spoonful, twice a day, with food, and maybe a biscuit after.', 'Siro này dở lắm, nên một thìa, hai lần mỗi ngày, uống cùng bữa ăn, rồi ăn thêm cái bánh quy.', 'spoon', 'twice', 'food'),
  o(28, 2, 'm', 'Two tablets before bed, once a day, and no coffee after dinner.', 'Hai viên trước khi ngủ, một lần mỗi ngày, và đừng uống cà phê sau bữa tối.', 'tab2', 'once', 'bed'),

  // ── level 3: a correction, a wrong option named ──
  o(29, 3, 'm', 'Sorry, one tablet. Not two tablets. Three times a day, after meals.', 'Xin lỗi, một viên. Không phải hai viên. Ba lần mỗi ngày, sau bữa ăn.', 'tab1', 'thrice', 'after'),
  o(30, 3, 'f', "Two drops, no, sorry, one spoonful. It's the syrup, not the eye drops. Twice a day, with food.", 'Hai giọt, à không, xin lỗi, một thìa. Là siro, không phải thuốc nhỏ mắt. Hai lần mỗi ngày, uống cùng bữa ăn.', 'spoon', 'twice', 'food'),
  o(31, 3, 'm', 'Take it once a day. No, wait, twice a day, the doctor changed it. Two tablets, with a full glass of water.', 'Uống một lần mỗi ngày. Không, khoan, hai lần mỗi ngày, bác sĩ đã đổi rồi. Hai viên, với một ly nước đầy.', 'tab2', 'twice', 'water'),
  o(32, 3, 'f', "The label says one puff every four hours, but it's only when needed. Sorry, I misread it. In the morning.", 'Nhãn ghi xịt một lần cách bốn tiếng, nhưng thật ra là chỉ khi cần. Xin lỗi, tôi đọc nhầm. Vào buổi sáng.', 'puff', 'need', 'morning'),
  o(33, 3, 'm', "That's one tablet, before bed. Not in the morning, before bed. Once a day, remember.", 'Là một viên, trước khi ngủ. Không phải buổi sáng, là trước khi ngủ. Một lần mỗi ngày, nhớ nhé.', 'tab1', 'once', 'bed'),
  o(34, 3, 'f', 'Two tablets, three times a day, on an empty stomach. Not with food, that makes it worse.', 'Hai viên, ba lần mỗi ngày, uống lúc đói. Không uống cùng bữa ăn, vậy sẽ tệ hơn.', 'tab2', 'thrice', 'empty'),
  o(35, 3, 'm', "Sorry, two drops, not two tablets. Every four hours, I know, it's a lot, but it's for the infection. After meals.", 'Xin lỗi, hai giọt, không phải hai viên. Cách bốn tiếng một lần, tôi biết là nhiều, nhưng đây là trị nhiễm trùng. Sau bữa ăn.', 'drops', 'four', 'after'),
  o(36, 3, 'f', 'One spoonful, once a day. No, sorry, three times a day, with food. My mistake.', 'Một thìa, một lần mỗi ngày. Không, xin lỗi, ba lần mỗi ngày, uống cùng bữa ăn. Tôi nhầm.', 'spoon', 'thrice', 'food'),
  o(37, 3, 'm', "Two tablets, twice a day. Hang on, that's the old dose. It's one tablet now, twice a day, with a full glass of water.", 'Hai viên, hai lần mỗi ngày. Khoan, đó là liều cũ. Giờ là một viên, hai lần mỗi ngày, với một ly nước đầy.', 'tab1', 'twice', 'water'),
  o(38, 3, 'f', 'Is that one puff or two? One puff, only when needed, in the morning. Just the one, please.', 'Là một lần xịt hay hai? Một lần xịt, chỉ khi cần, vào buổi sáng. Chỉ một thôi nhé.', 'puff', 'need', 'morning'),
  o(39, 3, 'm', "Two tablets, only when needed, after meals. Not on an empty stomach, you'll feel sick.", 'Hai viên, chỉ khi cần, sau bữa ăn. Đừng uống lúc đói, bác sẽ buồn nôn.', 'tab2', 'need', 'after'),
  o(40, 3, 'f', 'Every four hours, not every six. One spoonful, and take it with a full glass of water, not with food.', 'Cách bốn tiếng một lần, không phải sáu tiếng. Một thìa, và uống với một ly nước đầy, không uống cùng bữa ăn.', 'spoon', 'four', 'water'),
];

export const PHARMACY_SHIFT: ShiftDef = {
  id: 'pharmacy',
  name: 'Phụ quầy thuốc với Nell',
  at: 'nell',
  blurb: 'Nell đọc cách dùng thuốc và bạn ghi lên nhãn: nghe xem liều bao nhiêu, bao lâu một lần, uống lúc nào, rồi chọn trước khi bệnh nhân hết kiên nhẫn.',
  slots: [
    { id: 'much', label: 'Liều lượng', options: HOW_MUCH },
    { id: 'often', label: 'Bao lâu một lần', options: HOW_OFTEN },
    { id: 'when', label: 'Khi nào / cách dùng', options: WHEN_HOW },
  ],
  orders: ORDERS,
};
