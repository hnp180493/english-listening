import { describe, expect, it } from 'vitest';
import {
  cleanName,
  courtStage,
  datesDone,
  emptyTownLife,
  kidAge,
  mergeTownLife,
  parseTownLife,
  partnerOf,
  TALKED_DAYS,
  withChoice,
  withKid,
  withProfile,
  withStep,
  withTalked,
  type TownLife,
} from './life';

const T = new Date(2026, 10, 22, 10).getTime();
const DAY = 86400000;
const ME = { gender: 'male' as const, name: 'Phước', skin: '#f6d3b8', hair: 'short' as const, hairColor: '#3b2a22' };

describe('town-life: the character, courtship, children (docs/town.md §15)', () => {
  it('keeps a clean character and drops a broken one', () => {
    const life = withProfile(emptyTownLife(), ME, T);
    expect(life.profile).toEqual({ ...ME, at: T });
    expect(parseTownLife(JSON.parse(JSON.stringify(life))).profile).toEqual({ ...ME, at: T });
    expect(parseTownLife({ profile: { ...ME, gender: 'x', at: T } }).profile).toBeNull();
    expect(parseTownLife({ profile: { ...ME, skin: 'red', at: T } }).profile).toBeNull();
    expect(cleanName('  Bé   <b>Na</b> {x}  ')).toBe('Bé bNa/b x');
    expect(cleanName('a'.repeat(30))).toHaveLength(16);
    expect(parseTownLife('junk')).toEqual(emptyTownLife());
  });

  it('the partner is the one courted first; the stage follows the steps', () => {
    let life = withProfile(emptyTownLife(), ME, T);
    expect(courtStage(life)).toBe('single');
    life = withStep(life, 'cafe', 'dating', T);
    expect(partnerOf(life)).toBe('cafe');
    expect(courtStage(life)).toBe('dating');
    life = withStep(withStep(life, 'cafe', 'date1', T + DAY), 'cafe', 'date2', T + 2 * DAY);
    expect(datesDone(life.court.cafe)).toBe(2);
    // a step that happened stays at its first time
    expect(withStep(life, 'cafe', 'date1', T + 9 * DAY).court.cafe.date1).toBe(T + DAY);
    life = withStep(withStep(life, 'cafe', 'engaged', T + 4 * DAY), 'cafe', 'married', T + 5 * DAY);
    expect(courtStage(life)).toBe('married');
    // another machine courted somebody else later: the first one stays the partner
    const other = withStep(emptyTownLife(), 'park', 'dating', T + DAY);
    expect(partnerOf(mergeTownLife(life, other))).toBe('cafe');
  });

  it('children grow by days; at most three', () => {
    let life = emptyTownLife();
    const a = withKid(life, 'Bin', 'boy', T)!;
    expect(a.id).toBe(`kid-${T}`);
    life = a.life;
    expect(kidAge(T, T + 6 * DAY)).toBe('baby');
    expect(kidAge(T, T + 7 * DAY)).toBe('toddler');
    expect(kidAge(T, T + 21 * DAY)).toBe('child');
    life = withKid(withKid(life, 'Na', 'girl', T + 20 * DAY)!.life, 'Su', 'girl', T + 40 * DAY)!.life;
    expect(withKid(life, 'Mi', 'girl', T + 60 * DAY)).toBeNull();
    expect(withKid(emptyTownLife(), '   ', 'girl', T)).toBeNull();
  });

  it('a choice counts once; a day\'s talks are kept for the last days only', () => {
    const c = withChoice(emptyTownLife(), 'cafe-date-2', 'cafe-date-2-a', T);
    expect(c.first).toBe(true);
    expect(withChoice(c.life, 'cafe-date-2', 'cafe-date-2-b', T + 1).first).toBe(false);
    let life = emptyTownLife();
    for (let i = 0; i < TALKED_DAYS + 5; i++) life = withTalked(life, `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, 'spouse');
    expect(Object.keys(life.talked)).toHaveLength(TALKED_DAYS);
  });
});

describe('town-life merge', () => {
  const a: TownLife = parseTownLife({
    profile: { ...ME, at: T },
    court: { cafe: { dating: T, date1: T + DAY } },
    kids: { [`kid-${T}`]: { name: 'Bin', gender: 'boy', born: T, at: T } },
    choices: { 'cafe-date-1': { o: 'cafe-date-1-a', at: T + 5 } },
    talked: { '2026-11-22': ['spouse'] },
  });
  const b: TownLife = parseTownLife({
    profile: { ...ME, name: 'Phuoc', at: T + 10 },
    court: { cafe: { dating: T + 3, date2: T + 2 * DAY } },
    kids: { [`kid-${T}`]: { name: 'Bin Bin', gender: 'boy', born: T, at: T + 1 } },
    choices: { 'cafe-date-1': { o: 'cafe-date-1-b', at: T + 2 } },
    talked: { '2026-11-22': [`kid-${T}`] },
  });

  it('newer character, first step times, newer child name, first choice, union of talks', () => {
    const m = mergeTownLife(a, b);
    expect(m.profile?.name).toBe('Phuoc');
    expect(m.court.cafe).toEqual({ dating: T, date1: T + DAY, date2: T + 2 * DAY });
    expect(m.kids[`kid-${T}`].name).toBe('Bin Bin');
    expect(m.choices['cafe-date-1'].o).toBe('cafe-date-1-b');
    expect(m.talked['2026-11-22']).toEqual([`kid-${T}`, 'spouse']);
  });

  it('is idempotent, commutative and associative', () => {
    const c = parseTownLife({ court: { park: { dating: T - 5 } }, talked: { '2026-11-21': ['spouse'] } });
    const j = (x: TownLife) => JSON.stringify(x);
    expect(j(mergeTownLife(a, a))).toBe(j(mergeTownLife(a, emptyTownLife())));
    expect(j(mergeTownLife(a, b))).toBe(j(mergeTownLife(b, a)));
    expect(j(mergeTownLife(mergeTownLife(a, b), c))).toBe(j(mergeTownLife(a, mergeTownLife(b, c))));
    // the earlier courtship anywhere is the partner
    expect(partnerOf(mergeTownLife(a, c))).toBe('park');
  });
});
