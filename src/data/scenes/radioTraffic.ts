// Bay FM's traffic, read from Westbay's streets as they are (core/town/radioTraffic.ts, docs/town.md §25, docs/gta-plan.md
// §4.5): the pieces Marcus says it with. `{S}` is a street's name (said as people say it, docs/city.md §17), `{C}` a
// compass heading. Every piece is a claim the report makes only when it is true of the streets at that moment
// (radioTraffic.test.ts checks each one against the cars). Westbay's people speak in the browser's voice: no clips.
//
// The Vietnamese is in `vi` fields, the questions in `q` and their answers in `options` / `vi`: meanings and answers of
// a comprehension check, like every radio question (docs/i18n.md §4: shown in Vietnamese in English mode for now).

import type { Compass } from '../../core/town/streets';
import type { Piece } from './radioLive';

/** Into the traffic (a filler line: a storm may break it up). */
export const TRAFFIC_LEADS: readonly Piece[] = [
  { en: 'Now, the roads of Westbay.', vi: 'Giờ là đường sá ở Westbay.' },
  { en: 'And a quick look at the traffic.', vi: 'Và điểm nhanh tình hình giao thông.' },
];

/** A street with two cars or more on it (the most of any). */
export const BUSY = {
  /** Most of them going one way. */
  heading: { en: '{S} is busy just now, mostly heading {C}.', vi: '{S} đang đông xe, phần lớn đi về hướng {C}.' },
  /** As many one way as the other. */
  bothWays: { en: '{S} is busy just now, both ways.', vi: '{S} đang đông xe, cả hai chiều.' },
  /** Two of its cars or more standing still. */
  standing: { en: '{S} is slow just now, with cars standing still.', vi: '{S} đang chậm, có xe đứng im.' },
} as const;

/** No street with two cars on it. */
export const QUIET: readonly Piece[] = [
  { en: 'The roads are quiet all over Westbay.', vi: 'Đường sá khắp Westbay đang vắng.' },
  { en: 'Hardly a car about in Westbay right now.', vi: 'Lúc này Westbay gần như chẳng có xe nào.' },
];

/** A car street with no car on it. */
export const CLEAR: readonly Piece[] = [
  { en: "{S} is clear, if you're heading that way.", vi: '{S} đang thông, nếu bạn đi đường đó.' },
  { en: 'Nothing at all on {S}.', vi: 'Trên {S} không có xe nào.' },
];

/** Wet roads: the traffic goes slower (core/town/skyRules.ts trafficPace). */
export const WET: Piece = { en: 'The roads are wet, so traffic is moving slower than usual.', vi: 'Đường ướt nên xe chạy chậm hơn thường lệ.' };

/** A police car out: on a street with a name, or not. */
export const PATROL = {
  on: { en: "And there's a police car on {S}, so take it easy.", vi: 'Và có một xe cảnh sát trên {S}, nên chạy từ từ thôi.' },
  out: { en: "And there's a police car out and about, so take it easy.", vi: 'Và có một xe cảnh sát đang chạy quanh, nên chạy từ từ thôi.' },
} as const;

export const COMPASS_WORDS: Readonly<Record<Compass, Piece>> = {
  north: { en: 'north', vi: 'bắc' },
  south: { en: 'south', vi: 'nam' },
  east: { en: 'east', vi: 'đông' },
  west: { en: 'west', vi: 'tây' },
};

/** The questions. `{S}` a street's name. */
export const TRAFFIC_Q = {
  busy: { q: 'Theo Marcus, phố nào đang đông xe?' },
  heading: { q: 'Theo Marcus, xe trên {S} đang đi về hướng nào?' },
  slow: { q: 'Theo Marcus, vì sao xe chạy chậm?' },
  patrol: { q: 'Theo Marcus, xe cảnh sát đang ở phố nào?' },
  quiet: { q: 'Theo Marcus, đường sá ở Westbay lúc này thế nào?' },
} as const;

/** The answers of the questions that are not a street (the right one first). `{C}` a heading in Vietnamese. */
export const TRAFFIC_A = {
  slow: { options: ['Đường ướt', 'Có tai nạn', 'Đèn giao thông bị hỏng'] },
  quiet: { options: ['Vắng, gần như không có xe', 'Kẹt xe khắp nơi', 'Đông xe, chạy chậm vì đèn đỏ'] },
  heading: { vi: 'Hướng {C}' },
} as const;
