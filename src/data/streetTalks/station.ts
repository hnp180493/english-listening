// station · Sam (dog Chip): street talks (contract: core/town/streetTalkTypes.ts, docs/town.md §14).
import type { StreetTalk } from '../../core/town/streetTalkTypes';

export const TALKS: readonly StreetTalk[] = [
  {
    id: 'st-station-1',
    placeId: 'station',
    level: 1,
    lines: [
      { who: 'them', text: "Morning! I'm off to the bus station. Busy day today.", vi: 'Chào buổi sáng! Tôi đang ra bến xe. Hôm nay bận lắm.' },
      { who: 'you', text: 'Morning! Is the number nine on time today?', vi: 'Chào buổi sáng! Hôm nay xe số chín có đúng giờ không?' },
      { who: 'them', text: "Not really. It's running about ten minutes late.", vi: 'Không hẳn. Xe đang trễ khoảng mười phút.' },
      { who: 'you', text: "That's okay. I'll grab a coffee while I wait.", vi: 'Không sao. Tôi đi mua ly cà phê trong lúc chờ.' },
      { who: 'them', text: "Good plan. Emma's cafe is already open.", vi: 'Ý hay đấy. Quán của Emma mở cửa rồi.' },
    ],
  },
  {
    id: 'st-station-2',
    placeId: 'station',
    level: 1,
    lines: [
      { who: 'them', text: "Hey! Do you know if it's going to rain later?", vi: 'Này! Bạn có biết lát nữa trời mưa không?' },
      { who: 'you', text: 'I think so. Look at those clouds over the hill.', vi: 'Chắc có đấy. Nhìn mấy đám mây trên đồi kìa.' },
      { who: 'them', text: 'Oh no. I left my umbrella at the bus station.', vi: 'Thôi chết. Tôi để quên ô ở bến xe rồi.' },
      { who: 'you', text: "You can borrow mine. I'm only going to the shop.", vi: 'Cầm ô của tôi đi. Tôi chỉ ra tiệm tạp hóa thôi.' },
      { who: 'them', text: "That's really kind. I'll bring it back tomorrow, I promise.", vi: 'Bạn tốt quá. Mai tôi mang trả, hứa đấy.' },
    ],
  },
  {
    id: 'st-station-3',
    placeId: 'station',
    level: 2,
    minHearts: 3,
    lines: [
      { who: 'them', text: 'Be honest with me. Is this scarf too bright?', vi: 'Nói thật đi. Cái khăn này có sặc sỡ quá không?' },
      { who: 'you', text: "It's very yellow. But it really suits you.", vi: 'Vàng chóe thật. Nhưng hợp với bạn lắm.' },
      { who: 'them', text: "Thanks. I've got about ten, but this one's my new favorite.", vi: 'Cảm ơn. Tôi có tầm mười cái, mà giờ tôi thích cái này nhất.' },
      { who: 'you', text: 'Ten scarves? You must get cold easily.', vi: 'Mười cái khăn á? Chắc bạn dễ bị lạnh lắm.' },
      { who: 'them', text: "Ha, it's not the cold. I just love them.", vi: 'Ha, không phải tại lạnh. Tôi mê khăn thôi.' },
      { who: 'you', text: 'Fair enough. Everyone needs something they love.', vi: 'Cũng phải. Ai cũng cần một thứ để mê.' },
      { who: 'them', text: 'Exactly. Next time, you can tell me yours.', vi: 'Chuẩn. Lần sau kể tôi nghe thứ bạn mê nhé.' },
    ],
  },
  {
    id: 'st-station-4',
    placeId: 'station',
    level: 2,
    fact: 'station:visiting-mom',
    lines: [
      { who: 'them', text: 'Guess what? I just booked my bus ticket home.', vi: 'Đoán xem? Tôi vừa đặt vé xe về quê.' },
      { who: 'you', text: "For your mom's birthday? That's great news.", vi: 'Cho sinh nhật mẹ bạn à? Tin vui quá.' },
      { who: 'them', text: "Yeah, she's turning sixty. I haven't seen her in three years.", vi: 'Ừ, mẹ tròn sáu mươi. Ba năm rồi tôi chưa gặp mẹ.' },
      { who: 'you', text: "She'll be so happy to see you. Are you nervous?", vi: 'Mẹ sẽ vui lắm khi gặp bạn. Bạn có hồi hộp không?' },
      { who: 'them', text: 'A bit. I still need to call her and tell her.', vi: 'Hơi hơi. Tôi vẫn phải gọi điện báo mẹ.' },
      { who: 'you', text: "Just call. She'll be glad to hear your voice.", vi: 'Cứ gọi đi. Mẹ sẽ mừng khi nghe giọng bạn.' },
      { who: 'them', text: "You're right. I'll do it tonight, before I chicken out.", vi: 'Bạn nói đúng. Tối nay tôi gọi, trước khi lại chùn bước.' },
    ],
  },
];
