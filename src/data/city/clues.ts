// Clues (docs/gta-plan.md §4.2, §17): a line the learner earned by hearing it, kept in town-jobs (core/town/jobProgress
// clues) and shown in the phone's notebook. A job step can be opened or shortened by one (Cond `clue`): a shortcut the
// learner has only if they heard it. Where each comes from: a scene heard through (a bench, a get-together: its id), Bay
// FM's live bulletin (read in it until the learner has it), or a job's step (its `clue` field).
//
// The two samples, each shortening a step of an existing job:
//   fay-heights     Fay on the Sunday ferry (city get-together `ce-ferry-2`): "Up there, no thanks." In "Nửa sáu" the
//                   learner who heard it goes straight to Mrs Delaney instead of first going to the big wheel to learn
//                   that Fay will not climb the Trust's stairs (data/city/jobs/half5.ts);
//   gate-one-call   Bay FM, Marcus: Gus's side lane opens with one call to his hut. In "Ba chữ một lần" the learner who
//                   heard it rings Gus instead of running to his gate against the clock (data/city/jobs/three.ts).
//
// Bay FM's three adverts that are clues (data/scenes/radioCalls.ts RADIO_CLUE_ADS; docs/town.md §25): heard through in
// a bulletin, the advert's clue is earned (core/town/radioStore.ts radioHeard; the clue's id is the advert's):
//   ad-twin-ovens   "Night workers, knock at the back door from five." In "Phòng ghép băng" the learner who heard it goes
//                   in by Twin Ovens' back door and hears the rehearsal a third time (data/city/jobs/act3Splice.ts);
//   ad-bo, ad-wheel earned and shown in the phone, but no job uses them yet (CLUES_NOT_USED_YET).

import type { RadioNewsItem } from '../../core/town/radio';

export interface Clue {
  id: string;
  /** Who said it. */
  who: string;
  /** What was said (the English shown in the phone's notebook) and its meaning. */
  text: string;
  vi: string;
  /** What the learner knows now, in Vietnamese (the notebook's line). */
  note: string;
  from: { scene: string } | { radio: true } | { job: string } | { ad: string };
}

export const CLUES: readonly Clue[] = [
  {
    id: 'fay-heights',
    who: 'fay',
    text: "Never. Down here on the water I'm brave. Up there, no thanks.",
    vi: 'Chưa bao giờ. Dưới nước thì tôi gan lắm. Trên cao thì thôi, xin kiếu.',
    note: 'Fay không lên chỗ cao, kể cả vòng đu quay của chính cô.',
    from: { scene: 'ce-ferry-2' },
  },
  {
    id: 'gate-one-call',
    who: 'marcus',
    text: 'And Gus at the harbour gate says one call to his hut opens the side lane.',
    vi: 'Và Gus ở cổng cảng nhắn: chỉ cần gọi một cuộc tới chòi ông là cổng phụ mở.',
    note: 'Muốn Gus mở cổng phụ thì gọi điện tới chòi ông là đủ, khỏi chạy tới.',
    from: { radio: true },
  },
  {
    id: 'ad-twin-ovens',
    who: 'marcus',
    text: 'Night workers, knock at the back door from five.',
    vi: 'Ai làm ca đêm thì gõ cửa sau từ năm giờ.',
    note: 'Tiệm Twin Ovens mở cửa sau từ năm giờ cho người làm ca đêm, trước khi cửa trước mở lúc sáu giờ.',
    from: { ad: 'ad-twin-ovens' },
  },
  {
    id: 'ad-bo',
    who: 'marcus',
    text: "At Bo's karaoke, the big room is booked from nine every Thursday.",
    vi: 'Quán karaoke của Bo: phòng lớn có người đặt từ chín giờ mỗi tối thứ Năm.',
    note: 'Tối thứ Năm, từ chín giờ, phòng lớn ở quán karaoke của Bo có người đặt.',
    from: { ad: 'ad-bo' },
  },
  {
    id: 'ad-wheel',
    who: 'marcus',
    text: 'The last ride goes at quarter to, so ask Fay for a ticket.',
    vi: 'Chuyến cuối lúc mười giờ kém mười lăm, nên hỏi Fay mua vé nhé.',
    note: 'Vòng đu quay chạy tới mười giờ tối; chuyến cuối lúc mười giờ kém mười lăm.',
    from: { ad: 'ad-wheel' },
  },
];

/** Clues that can be earned but that no job reads yet (clues.test.ts keeps this list true). */
export const CLUES_NOT_USED_YET: readonly string[] = ['ad-bo', 'ad-wheel'];

export const clueById = (id: string): Clue | undefined => CLUES.find((c) => c.id === id);

/** The clues a scene heard through gives. */
export function cluesOfScene(sceneId: string): string[] {
  return CLUES.filter((c) => 'scene' in c.from && c.from.scene === sceneId).map((c) => c.id);
}

/** Bay FM's clue items for a bulletin: the radio's clues the learner does not hold yet (each read by Marcus). */
export function radioClueNews(has: (id: string) => boolean): (RadioNewsItem & { clue: string })[] {
  return CLUES.filter((c) => 'radio' in c.from && !has(c.id)).map((c) => ({ id: `clue-${c.id}`, clue: c.id, lines: [{ text: c.text, vi: c.vi }] }));
}
