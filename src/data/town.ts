// "Thị trấn": its 13 places (one per sentence topic), what is said in each, and what xu can buy.
// No audio of its own: a line is a built-in dictation sentence, so its shipped clip already exists.
// Where each thing stands in the world is not decided here (data/townWorld).

import type { TownDecoration, TownLine, TownPlace } from '../core/town/types';
import { SENTENCES } from './sentences';

const place = (id: string, name: string, topic: string, resident: string, cost: number): TownPlace => ({ id, topic, name, resident, cost });

/**
 * Three places stand from the start (cost 0, 70 lines between them). The other ten are empty lots the learner
 * builds with xu, in any order. Ids are stable: they are stored in the purchases.
 */
export const TOWN_PLACES: readonly TownPlace[] = [
  place('square', 'Quảng trường', 'Giao tiếp', 'Leo', 0),
  place('cafe', 'Quán cà phê', 'Ăn uống', 'Emma', 0),
  place('friend', 'Nhà bạn', 'Bạn bè', 'Mia', 0),
  place('home', 'Nhà', 'Gia đình', 'Grace', 20),
  place('shop', 'Cửa hàng', 'Mua sắm', 'Ben', 30),
  place('office', 'Văn phòng', 'Công việc', 'Sarah', 40),
  place('school', 'Trường học', 'Học tập', 'Daniel', 50),
  place('station', 'Bến xe', 'Du lịch', 'Sam', 60),
  place('clinic', 'Phòng khám', 'Sức khỏe', 'Kim', 70),
  place('cinema', 'Rạp phim', 'Phim ảnh & giải trí', 'Zoe', 80),
  place('phone', 'Tiệm điện thoại', 'Công nghệ', 'Max', 90),
  place('park', 'Công viên', 'Cảm xúc', 'Lily', 100),
  place('board', 'Bảng tin', 'Kế hoạch', 'Tom', 110),
];

const deco = (id: string, name: string, cost: number): TownDecoration => ({ id, name, cost });

/** Decorations, in the order the shop lists them. Ids are stable and never the id of a place. */
export const TOWN_DECORATIONS: readonly TownDecoration[] = [
  deco('lamps1', 'Đèn đường', 10),
  deco('flowers', 'Bồn hoa', 8),
  deco('benches', 'Ghế đá', 12),
  deco('blossom', 'Cây hoa anh đào', 15),
  deco('lamps2', 'Thêm đèn đường', 15),
  deco('lights', 'Dây đèn', 25),
  deco('lilies', 'Hoa súng trên hồ', 20),
  deco('stall', 'Quầy hàng rong', 30),
  deco('fountain', 'Đài phun nước lớn', 40),
  deco('balloons', 'Bóng bay', 12),
  deco('flags', 'Cờ hội', 18),
  deco('cat', 'Chú mèo', 35),
];

let byPlace: Map<string, readonly TownLine[]> | null = null;
let placeOfLine: Map<string, string> | null = null;

function build(): Map<string, readonly TownLine[]> {
  if (byPlace) return byPlace;
  const byTopic = new Map<string, TownLine[]>();
  for (const s of SENTENCES) {
    const line: TownLine = { id: s.id, text: s.text, vi: s.vi, level: s.level, sentenceId: s.id };
    if (s.say) line.say = s.say;
    const list = byTopic.get(s.topic);
    if (list) list.push(line);
    else byTopic.set(s.topic, [line]);
  }
  byPlace = new Map(TOWN_PLACES.map((p) => [p.id, byTopic.get(p.topic) ?? []]));
  return byPlace;
}

/** Everything said at a place, in sentence order (stable identity). Unknown place: none. */
export function placeLines(placeId: string): readonly TownLine[] {
  return build().get(placeId) ?? [];
}

export function townPlace(placeId: string): TownPlace | undefined {
  return TOWN_PLACES.find((p) => p.id === placeId);
}

export function townDecoration(id: string): TownDecoration | undefined {
  return TOWN_DECORATIONS.find((d) => d.id === id);
}

/** The id of the place where a line is said, if it is a line of the town. */
export function placeOfLineId(lineId: string): string | undefined {
  if (!placeOfLine) {
    placeOfLine = new Map();
    for (const [placeId, lines] of build()) for (const l of lines) placeOfLine.set(l.id, placeId);
  }
  return placeOfLine.get(lineId);
}
