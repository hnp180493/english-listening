// "Thị trấn": the meanings of what a careless ear hears instead of a line (docs/town.md §13). Each entry is a wrong
// meaning offered next to the line's own: the Vietnamese meaning of a sentence that sounds nearly the same.
//
// - `heard` is the English a careless ear takes the line for. It is NEVER shown and never spoken (no audio is made
//   for it): it is here so the entry can be checked. It must differ from the line's text by a few words only
//   (core/town/soundAlike closeVariant), so an entry whose line was rewritten stops applying instead of offering a
//   meaning that no longer sounds like anything said.
// - `vi` is that sentence's natural Vietnamese meaning, the way the line's own `vi` is written.
// - Only where the swap is real for the ear AND changes the meaning: a pair that means the same in Vietnamese, or a
//   meaning nobody would pick because it makes no sense, is left out (the line keeps its usual wrong meanings).
//
// Lines not listed may still get one derived by rule (core/town/soundAlike: him ↔ them, -teen ↔ -ty). NO_DERIVED
// lists the lines where such a derived meaning would be absurd.
//
// Checks: core/town/soundAlike.test.ts (every key is a line of the town, every entry applies, its kind shows in the
// English, its meaning is neither the line's own nor nearly the same).

import type { SoundAlikeKind } from '../core/town/types';

export interface AuthoredSoundAlike {
  kind: SoundAlikeKind;
  /** The English a careless ear hears instead (never shown, never spoken). */
  heard: string;
  /** Its Vietnamese meaning: the wrong option. */
  vi: string;
}

const a = (kind: SoundAlikeKind, heard: string, vi: string): AuthoredSoundAlike => ({ kind, heard, vi });

export const TOWN_SOUND_ALIKES: Readonly<Record<string, readonly AuthoredSoundAlike[]>> = {
  // ───── the quick chats (data/sentences) ─────
  s005: [a('link', 'Did you eat it?', 'Bạn ăn nó chưa?')],
  s008: [a('can', "I can't do it.", 'Mình không làm được đâu.')],
  s009: [a('can', 'I can do it today.', 'Hôm nay mình làm được.')],
  s011: [a('pronoun', 'Ask him about it.', 'Hỏi anh ấy chuyện đó đi.')],
  s014: [a('want', "What won't you eat?", 'Bạn không chịu ăn món gì?')],
  s015: [a('want', "I won't go home.", 'Mình sẽ không về nhà.')],
  s016: [a('ed', 'I want to call you.', 'Mình muốn gọi cho bạn.')],
  s018: [a('d', 'I like coffee.', 'Tôi thích cà phê.')],
  s037: [a('pronoun', 'I found her keys.', 'Mình tìm thấy chìa khóa của cô ấy rồi.')],
  s057: [a('pronoun', "Tell him I'll be there in about an hour.", 'Nói với anh ấy khoảng một tiếng nữa mình tới.')],
  s066: [a('ll', 'I text you when I get home.', 'Về tới nhà là mình hay nhắn cho bạn.')],
  s073: [a('want', "This year I won't travel more.", 'Năm nay mình sẽ không đi du lịch nhiều nữa.')],
  s091: [a('want', "If you won't come with us, just let me know by Friday.", 'Nếu không đi cùng thì báo mình trước thứ Sáu nhé.')],
  s094: [a('have', "We should leave earlier. There's going to be a lot of traffic.", 'Mình nên đi sớm hơn, thể nào cũng kẹt xe cho xem.')],
  s103: [a('have', "I'm sorry, I should call you, but my phone was dead all day.", 'Xin lỗi, mình phải gọi cho bạn, mà điện thoại hết pin cả ngày.')],
  s099: [a('pronoun', 'What did you end up getting for his birthday? I still have no idea.', 'Cuối cùng bạn mua gì tặng sinh nhật anh ấy vậy? Mình vẫn chưa nghĩ ra.')],
  s105: [a('have', 'If I had known about it earlier, I would tell you.', 'Nếu mình biết sớm hơn thì mình sẽ nói với bạn.')],
  s112: [a('pronoun', "I could hear him talking next door all night, so I didn't get much sleep.", 'Cả đêm mình nghe anh ấy nhà bên cạnh nói chuyện nên chẳng ngủ được mấy.')],
  s117: [a('d', "She said she called us back, but we haven't heard from her yet.", 'Cô ấy bảo đã gọi lại rồi, mà tới giờ vẫn chưa thấy tin gì.')],
  s153: [a('ed', 'We miss the last train.', 'Tụi mình hay lỡ chuyến tàu cuối.')],
  s160: [a('pronoun', 'Have you met her sister?', 'Bạn gặp em gái cô ấy chưa?')],
  s183: [a('ed', 'We binge the whole season over the weekend.', 'Tụi mình hay cày nguyên mùa phim vào cuối tuần.')],
  s185: [a('nt', 'It was as good as I expected.', 'Phim hay đúng như mình mong đợi.')],
  s212: [a('ed', 'We stay at a really nice hotel in Bangkok.', 'Tụi mình đang ở khách sạn rất xịn ở Bangkok.')],
  s215: [a('can', 'Is it spicy? I can eat anything too hot.', 'Món này có cay không? Mình ăn cay được.')],
  s216: [a('ed', 'We order a pizza and some chicken wings.', 'Tụi mình hay gọi pizza với ít cánh gà.')],
  s218: [a('pronoun', "Why don't you invite him to the party?", 'Sao bạn không mời anh ấy đến bữa tiệc?')],
  s251: [a('nt', 'I tried to get him to watch it, but he said it was his thing.', 'Mình rủ anh ấy xem cùng, mà anh ấy bảo phim kiểu đó đúng gu anh ấy.')],
  s262: [a('d', 'I asked her to help me with my essay, and she said she looked at it.', 'Mình nhờ cô ấy giúp sửa bài luận, và cô ấy bảo đã xem qua rồi.')],
  s273: [a('can', 'I can believe he said that to me in front of everyone.', 'Mình tin là anh ấy đã nói vậy với mình trước mặt mọi người.')],
  s284: [a('want', 'I accidentally deleted all of his photos, and now he wants to talk to me.', 'Mình lỡ tay xóa hết ảnh của anh ấy, giờ anh ấy muốn nói chuyện với mình.')],

  // ───── "Chuyện ở thị trấn" (data/townStories, data/stories) ─────
  'square-2-06': [a('d', 'And Emma said she brought coffee for everyone.', 'Còn Emma nói đã mang cà phê cho mọi người rồi.')],
  'home-2-03': [a('can', "The kitchen light's gone out, and I can reach it.", 'Đèn bếp cháy rồi, mà bà với tới được.')],
  'shop-2-06': [a('pronoun', "So it's yours. Just don't tell him I gave it away.", 'Vậy ổ này của bạn. Đừng kể với ông ấy là tôi đưa người khác nhé.')],
  'shop-2-07': [a('want', 'I want to say a word. Thanks, Ben!', 'Tôi muốn nói một câu. Cảm ơn Ben!')],
  'school-2-07': [a('can', "Only five? I can't do that.", 'Có năm câu thôi ạ? Em không làm được đâu.')],
  'park-2-04': [a('nt', 'See? I told you it was that bad.', 'Thấy chưa? Mình đã bảo là tệ lắm mà.')],
  'cafe-4-03': [a('number', "Seven thirteen? Oh, you're full. What about eight?", 'Bảy giờ mười ba ạ? Ồ, kín chỗ rồi à. Thế tám giờ thì sao?')],
  'friend-6-07': [a('pronoun', 'Uh oh. What exactly did you tell him?', 'Ôi chà. Bạn đã kể gì với anh ấy thế?')],
  'cinema-6-09-v1': [a('can', "Australia, okay. Kangaroos, beaches. I can't do that.", 'Nước Úc, được. Chuột túi, bãi biển. Tôi không làm được đâu.')],
  'cinema-6-12': [a('can', "Stop it! Okay. Deep breath. I can't do this.", 'Thôi đi! Được rồi. Hít sâu. Tôi không làm được đâu.')],
};

/** Lines whose derived sound-alike (core/town/soundAlike) would be absurd: none is derived for them. */
export const NO_DERIVED: ReadonlySet<string> = new Set([
  // "My mom turns sixty" → "turns sixteen": nobody would pick it
  'station-6-03',
  // "texting them now. Sorry, guys": one person ("him") would contradict the "guys" said right after
  'friend-7-08',
]);
