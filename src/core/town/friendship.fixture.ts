// A small resident arc for the friendship tests (core/town/friendship*.test.ts): Emma at the café with episodes 1–2
// as today and an episode 3 that needs a heart, has a choice and a variant that remembers it. Not content: the real
// arcs are in data/stories and grow on their own. Only tests import this file.

import type { ResidentArc, StoryEpisode } from './story';

const line = (id: string, who: string, text: string, vi: string) => ({ id, who, text, vi });

export const FIXTURE_EPISODES: StoryEpisode[] = [
  {
    id: 'cafe-1',
    placeId: 'cafe',
    order: 1,
    title: 'Ly cà phê đầu tiên',
    scene: 'Bạn ghé quán.',
    level: 1,
    lines: [line('cafe-1-01', 'them', 'What can I get you?', 'Bạn dùng gì?'), line('cafe-1-02', 'you', 'A latte, please.', 'Cho tôi một ly latte.'), line('cafe-1-03', 'them', 'Hot or iced?', 'Nóng hay đá?')],
    gist: { q: 'Bạn gọi gì?', options: ['Latte', 'Trà', 'Nước cam'], answer: 0 },
    learn: ['you:latte'],
  },
  {
    id: 'cafe-2',
    placeId: 'cafe',
    order: 2,
    title: 'Như mọi khi',
    scene: 'Sáng hôm sau.',
    level: 1,
    lines: [line('cafe-2-01', 'them', 'The usual?', 'Như mọi khi hả?'), line('cafe-2-02', 'you', 'Yes, thanks.', 'Ừ, cảm ơn.')],
    gist: { q: 'Bạn gọi gì?', options: ['Như mọi khi', 'Món mới', 'Không gọi gì'], answer: 0 },
  },
  {
    id: 'cafe-3',
    placeId: 'cafe',
    order: 3,
    title: 'Buổi nhạc jazz',
    scene: 'Tối thứ Sáu ở quán.',
    level: 1,
    requires: { hearts: 1 },
    learn: ['cafe:loves-jazz'],
    lines: [
      line('cafe-3-01', 'them', "There's a jazz night on Friday.", 'Tối thứ Sáu có đêm nhạc jazz.'),
      {
        ...line('cafe-3-02', 'you', "Sounds great, I'll come.", 'Nghe hay đấy, tôi sẽ tới.'),
        choices: [
          { id: 'cafe-3-02-a', intent: 'Nhận lời', text: "Sounds great, I'll come.", vi: 'Nghe hay đấy, tôi sẽ tới.', points: 20, learn: ['you:jazz-yes'] },
          { id: 'cafe-3-02-b', intent: 'Từ chối khéo', text: "Sorry, I'm busy that night.", vi: 'Tiếc quá, tối đó tôi bận.', points: -10, learn: ['you:jazz-no'] },
        ],
      },
      {
        ...line('cafe-3-03', 'them', 'Okay, see you then.', 'Được, hẹn gặp nhé.'),
        variants: [
          { id: 'cafe-3-03-v1', if: 'you:jazz-yes', text: 'Great, I saved you a seat.', vi: 'Tuyệt, tôi giữ chỗ cho bạn rồi.' },
          { id: 'cafe-3-03-v2', if: 'you:jazz-no', text: 'No worries, maybe next time.', vi: 'Không sao, để lần sau nhé.' },
        ],
      },
    ],
    gist: { q: 'Emma rủ bạn đi đâu?', options: ['Đêm nhạc jazz', 'Đi xem phim', 'Ăn tối'], answer: 0 },
  },
];

export const FIXTURE_ARC: ResidentArc = {
  placeId: 'cafe',
  episodes: [FIXTURE_EPISODES[2]],
  facts: [
    { id: 'cafe:loves-jazz', vi: 'Emma mê nhạc jazz' },
    { id: 'cafe:loves-lemon-cake', vi: 'Emma rất thích bánh chanh', gift: { id: 'lemon-cake', taste: 'loves' } },
    { id: 'you:latte', vi: 'Bạn hay uống latte' },
    { id: 'you:jazz-yes', vi: 'Bạn nhận lời đi nghe jazz' },
    { id: 'you:jazz-no', vi: 'Bạn từ chối đêm nhạc jazz' },
  ],
  taste: { loves: ['lemon-cake'], likes: ['iced-latte'], dislikes: ['spicy-noodles'] },
  reactions: {
    loves: line('cafe-gift-loves', 'them', 'Lemon cake? You remembered!', 'Bánh chanh à? Bạn nhớ luôn!'),
    likes: line('cafe-gift-likes', 'them', 'Oh, thank you so much.', 'Ôi, cảm ơn bạn nhiều.'),
    neutral: line('cafe-gift-neutral', 'them', "That's kind of you.", 'Bạn tốt quá.'),
    dislikes: line('cafe-gift-dislikes', 'them', "Oh. I don't really eat spicy food.", 'Ồ. Tôi không ăn cay lắm.'),
  },
  greetings: [
    { ...line('cafe-hi-01', 'them', 'Hi there!', 'Chào bạn!'), tier: 0 },
    { ...line('cafe-hi-02', 'them', 'Morning! Busy day?', 'Chào buổi sáng! Hôm nay bận không?'), tier: 0 },
    { ...line('cafe-hi-03', 'them', 'Hey, my favorite customer!', 'Ê, vị khách ruột của tôi!'), tier: 3 },
    { ...line('cafe-hi-04', 'them', 'Still thinking about the jazz night?', 'Vẫn còn nhớ đêm nhạc jazz hả?'), tier: 0, if: 'you:jazz-yes' },
  ],
};
