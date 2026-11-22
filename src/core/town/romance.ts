// The rules of "Hẹn hò, cưới, con" (docs/town.md §15), pure: what the learner can do next with a resident, and what
// finishing it changes. Friendship is the way in ("phải liên quan với nhau để chiếm tình cảm npc"): 8 hearts and a
// bouquet to confess, three dates (one a day), 10 hearts and a ring to propose, the wedding the day after, then one
// exchange a day with the spouse and with each child. Every step pays friendship points (town-progress, ./friendship).

import { KID_LINES, suitorOf } from '../../data/romance';
import { townPlace } from '../../data/town';
import { townDay } from './progress';
import { courtStage, datesDone, daysOld, kidAge, kidsOf, lastStep, MAX_KIDS, partnerOf, talkedOn, type CourtStep, type TownLife } from './life';
import type { RomanceScene } from './romanceTypes';

/** Hearts to confess, hearts to propose. */
export const CONFESS_HEARTS = 8;
export const PROPOSE_HEARTS = 10;
/** Days married before the spouse talks about a baby; days the youngest must be before another one. */
export const BABY_AFTER_DAYS = 3;
export const NEXT_BABY_DAYS = 14;

export const BOUQUET = 'bouquet';
export const RING = 'ring';

/** Friendship points each step adds (on top of a choice's own). */
export const STEP_POINTS = { confess: 50, date: 40, proposal: 60, wedding: 60, daily: 10, kid: 5, baby: 20 } as const;

export type RomanceKind = keyof typeof STEP_POINTS;

export interface RomanceStep {
  kind: RomanceKind;
  /** The one courted / the spouse (place id). */
  placeId: string;
  /** The text scene played (null for 'baby': the learner names the child, then the first baby scene plays). */
  scene: RomanceScene | null;
  /** A child's step: their id. */
  kidId?: string;
  /** Vietnamese button text ("Tỏ tình", "Hẹn hò lần 2", "Chơi với Bin"). */
  label: string;
  /** Can be done now. */
  ready: boolean;
  /** Why not yet (Vietnamese), when not ready. */
  need: string | null;
  /** The court step it records when done. */
  records?: CourtStep;
}

export interface RomanceFacts {
  hearts: number;
  /** Bouquets / rings in hand (town-progress gifts). */
  bouquets: number;
  rings: number;
}

const rotate = <T>(list: readonly T[], n: number): T | null => (list.length ? list[((n % list.length) + list.length) % list.length] : null);
const dayIndex = (now: number) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

/**
 * What the learner can do next with the resident of `placeId` (an empty list: nothing, e.g. somebody this character
 * cannot court, or no character made yet). Steps that wait say why.
 */
export function romanceSteps(life: TownLife, placeId: string, facts: RomanceFacts, now: number): RomanceStep[] {
  const profile = life.profile;
  const suitor = suitorOf(placeId);
  const name = townPlace(placeId)?.resident ?? '';
  if (!profile || !suitor || suitor.courtedBy !== profile.gender) return [];
  const partner = partnerOf(life);
  const today = townDay(now);
  const c = partner ? life.court[partner] : undefined;
  const steppedToday = !!c && townDay(lastStep(c)) === today;
  if (!partner) {
    const ready = facts.hearts >= CONFESS_HEARTS && facts.bouquets > 0;
    const need = facts.hearts < CONFESS_HEARTS ? `Cần ${CONFESS_HEARTS} tim (đang ${facts.hearts})` : facts.bouquets === 0 ? 'Cần một bó hoa (Tiệm quà)' : null;
    return [{ kind: 'confess', placeId, scene: suitor.confess, label: 'Tỏ tình', ready, need, records: 'dating' }];
  }
  if (partner !== placeId) return [];
  const stage = courtStage(life);
  const tomorrow = 'Mai hẵng tiếp: mỗi ngày một bước';
  if (stage === 'dating') {
    const n = datesDone(c);
    if (n < 3) {
      const step = (['date1', 'date2', 'date3'] as const)[n];
      return [{ kind: 'date', placeId, scene: suitor.dates[n], label: `Hẹn hò lần ${n + 1}`, ready: !steppedToday, need: steppedToday ? tomorrow : null, records: step }];
    }
    const ready = !steppedToday && facts.hearts >= PROPOSE_HEARTS && facts.rings > 0;
    const need = steppedToday ? tomorrow : facts.hearts < PROPOSE_HEARTS ? `Cần ${PROPOSE_HEARTS} tim (đang ${facts.hearts})` : facts.rings === 0 ? 'Cần một chiếc nhẫn (Tiệm quà)' : null;
    return [{ kind: 'proposal', placeId, scene: suitor.proposal, label: 'Cầu hôn', ready, need, records: 'engaged' }];
  }
  if (stage === 'engaged') {
    return [{ kind: 'wedding', placeId, scene: suitor.vows, label: 'Đám cưới', ready: !steppedToday, need: steppedToday ? 'Đám cưới vào ngày mai' : null, records: 'married' }];
  }
  // married: the day's exchange with the spouse, each child's, and maybe a baby
  const day = dayIndex(now);
  const steps: RomanceStep[] = [];
  const talked = talkedOn(life, today, 'spouse');
  steps.push({ kind: 'daily', placeId, scene: rotate(suitor.daily, day), label: `Trò chuyện với ${name}`, ready: !talked, need: talked ? 'Hôm nay đã trò chuyện rồi' : null });
  const kids = kidsOf(life);
  kids.forEach(({ id, kid }, i) => {
    const age = kidAge(kid.born, now);
    const list = KID_LINES[age];
    const done = talkedOn(life, today, id);
    steps.push({ kind: 'kid', placeId, kidId: id, scene: rotate(list, day + i * 3), label: `Chơi với ${kid.name}`, ready: !done, need: done ? `Hôm nay đã chơi với ${kid.name} rồi` : null });
  });
  const married = c?.married ?? now;
  const youngest = kids.length ? kids[kids.length - 1].kid.born : 0;
  const canBaby = kids.length < MAX_KIDS && daysOld(married, now) >= BABY_AFTER_DAYS && (!youngest || daysOld(youngest, now) >= NEXT_BABY_DAYS);
  if (canBaby) steps.push({ kind: 'baby', placeId, scene: KID_LINES.baby[0] ?? null, label: kids.length ? 'Thêm một em bé' : 'Có em bé', ready: true, need: null });
  return steps;
}

/** Replace {name} / {kid} in a line. */
export function fillLine(text: string, name: string, kid = ''): string {
  return text.replace(/\{name\}/g, name).replace(/\{kid\}/g, kid || 'con');
}

/** The relationship in a few words for the Sổ tay and the panel ("Đang hẹn hò · 2/3 buổi hẹn"). */
export function romanceStatus(life: TownLife, placeId: string): string | null {
  if (partnerOf(life) !== placeId) return null;
  const c = life.court[placeId];
  const stage = courtStage(life);
  if (stage === 'married') {
    const g = life.profile?.gender === 'male' ? 'Vợ của bạn' : 'Chồng của bạn';
    return g;
  }
  if (stage === 'engaged') return 'Đã đính hôn';
  return `Đang hẹn hò · ${datesDone(c)}/3 buổi hẹn`;
}
