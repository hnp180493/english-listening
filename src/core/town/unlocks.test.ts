import { describe, expect, it } from 'vitest';
import { placeLines } from '../../data/town';
import { ACHIEVEMENTS, FISH_SPECIES, LOOT, TOWN_PROJECTS } from '../../data/townGame';
import { TOWN_STORIES } from '../../data/townStories';
import { addFarmDay, addOwned, emptyTownProgress, mergeTownProgress, noteFish, updateEpisode, type TownProgress } from './progress';
import { achievementsUnlocked, achievementsView, goalTarget, projectDecorations, projectsDone, projectsView, reviewFacts, settleTown, townMetrics } from './unlocks';
import { availableTitles, canWear, equip, lookView, ownedItems } from './wardrobe';

const NOW = new Date(2026, 10, 20, 12).getTime();

/** `n` town lines understood, `first` of them on the first listen. */
function understood(n: number, first = 0): TownProgress {
  const lines = ['cafe', 'square', 'friend', 'home', 'shop', 'office'].flatMap((p) => placeLines(p)).slice(0, n);
  return { ...emptyTownProgress(), lines: Object.fromEntries(lines.map((l, i) => [l.id, { best: i < first ? 2 : 1, tries: 1, at: NOW }])) } as TownProgress;
}

describe('townMetrics', () => {
  it('counts listening only', () => {
    let p = understood(12, 5);
    p = updateEpisode(p, 'cafe-1', (e) => ({ ...e, stage: 3, firstGist: 2, at: NOW, okAt: NOW }));
    p = updateEpisode(p, 'cafe-2', (e) => ({ ...e, stage: 1, firstGist: 1, at: NOW, okAt: NOW }));
    p = noteFish(p, 'ca-noi', true, 1000, NOW);
    p = noteFish(p, 'ca-noi', true, 1000, NOW);
    p = noteFish(p, 'rong-noi-am', true, 1000, NOW);
    p = noteFish(p, 'ca-gon', false, 0, NOW);
    p = addFarmDay(p, '2026-11-19');
    p = { ...p, days: ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-14'] };
    const m = townMetrics(p, { mature: 7 });
    expect(m).toMatchObject({ lines: 12, first: 5, gistFirst: 1, episodes: 2, relistens: 2, fish: 3, species: 2, legendary: 1, farmDays: 1, streakBest: 3, perfect: 0, mature: 7 });
    expect(m.phenomenon.linking).toBe(2);
    expect(townMetrics(p).mature).toBeNull();
  });

  it('a line of an episode never counts as a first listen; an achievement recorded before stays', () => {
    // a best of 2 on story lines was written by builds before 2026-11-21 (step 2 counted as a first listen)
    const storyIds = TOWN_STORIES.flatMap((e) => e.lines.map((l) => l.id)).slice(0, 30);
    let p = understood(0);
    p = { ...p, lines: Object.fromEntries(storyIds.map((id) => [id, { best: 2, tries: 1, at: NOW }])) } as TownProgress;
    expect(townMetrics(p)).toMatchObject({ lines: 30, first: 0 });
    expect(achievementsUnlocked(p)).not.toContain('nghe-mot-lan');
    // recorded then: kept (never taken away), and shown as reached
    p = { ...p, unlocks: { 'nghe-mot-lan': NOW - 1000 } };
    expect(settleTown(p, NOW).progress.unlocks['nghe-mot-lan']).toBe(NOW - 1000);
    expect(achievementsView(p).find((a) => a.achievement.id === 'nghe-mot-lan')).toMatchObject({ reached: true, unlockedAt: NOW - 1000 });
  });

  it('reviewFacts counts the mature cards', () => {
    const e = (interval: number) => ({ state: { id: 'x', due: 0, interval, ease: 2.5, reps: 1, lapses: 0 } });
    expect(reviewFacts([e(0), e(20), e(21), e(90)])).toEqual({ mature: 2 });
  });
});

describe('achievements and projects', () => {
  it('reached by the metrics; the goals that need Ôn tập facts only with them', () => {
    expect(achievementsUnlocked(emptyTownProgress())).toEqual([]);
    expect(achievementsUnlocked(understood(10))).toEqual(['cau-dau-tien']);
    expect(achievementsUnlocked(emptyTownProgress(), { mature: 25 })).toEqual(['vuon-lau-nam']);
    let p = emptyTownProgress();
    for (const f of FISH_SPECIES.filter((x) => x.phenomenon === 'linking')) p = noteFish(p, f.id, true, 1000, NOW);
    expect(achievementsUnlocked(p)).toEqual(expect.arrayContaining(['me-ca-dau', 'bac-thay-noi-am', 'huyen-thoai-ben-ho']));
    expect(achievementsUnlocked(p)).not.toContain('bac-thay-am-yeu');
    // every episode heard through: "Người kể chuyện"
    let all = emptyTownProgress();
    for (const e of TOWN_STORIES) all = updateEpisode(all, e.id, (x) => ({ ...x, stage: 1, at: NOW, okAt: NOW }));
    expect(achievementsUnlocked(all)).toEqual(expect.arrayContaining(['tap-dau-tien', 'muoi-tap', 'nguoi-ke-chuyen']));
    expect(projectsDone(all)).toEqual(['du-an-le-hoi']);
  });

  it('views: value, target and 0..1 for every goal, in catalog order', () => {
    const v = achievementsView(understood(25, 5));
    expect(v.map((a) => a.achievement.id)).toEqual(ACHIEVEMENTS.map((a) => a.id));
    expect(v.find((a) => a.achievement.id === 'nam-muoi-cau')).toMatchObject({ value: 25, target: 50, progress: 0.5, reached: false, unlockedAt: null });
    const pv = projectsView(understood(100));
    expect(pv.map((x) => x.project.id)).toEqual(TOWN_PROJECTS.map((x) => x.id));
    expect(pv[0]).toMatchObject({ value: 100, target: 100, progress: 1, reached: true });
    for (const a of v) expect(a.target).toBe(goalTarget(a.achievement));
  });

  it('settleTown grants the eggs and records what is reached, once; the decorations of the projects done come with it', () => {
    let p = understood(100, 10);
    p = updateEpisode(p, 'cafe-1', (e) => ({ ...e, firstGist: 2 }));
    const s = settleTown(p, NOW);
    expect(s.granted).toEqual(['gist:cafe-1']);
    expect(s.unlocked).toEqual(['cau-dau-tien', 'nam-muoi-cau', 'nghe-y-chinh', 'du-an-den-ho']);
    expect(s.progress.unlocks).toEqual({ 'cau-dau-tien': NOW, 'du-an-den-ho': NOW, 'nam-muoi-cau': NOW, 'nghe-y-chinh': NOW });
    expect(projectDecorations(s.progress)).toEqual(['proj-lake-lights']);
    // settled again: nothing new, the same object
    const again = settleTown(s.progress, NOW + 5);
    expect(again.progress).toBe(s.progress);
    expect(again.unlocked).toEqual([]);
    // a merge with an older copy keeps the first time
    const older = settleTown(p, NOW - 1000).progress;
    expect(mergeTownProgress(s.progress, older).unlocks['cau-dau-tien']).toBe(NOW - 1000);
    // recorded stays recorded even if a later copy were to count less
    expect(achievementsView(s.progress).find((a) => a.achievement.id === 'cau-dau-tien')).toMatchObject({ reached: true, unlockedAt: NOW });
  });
});

describe('the wardrobe', () => {
  const withItems = (...ids: string[]) => ids.reduce((p, id) => addOwned(p, id, NOW), emptyTownProgress());

  it('owned items by kind; titles from levels, achievements, projects and eggs', () => {
    const p = settleTown(withItems('mu-len', 'vit', 'ao-do', 't-cu-dem'), NOW).progress;
    expect(ownedItems(p).map((i) => i.id)).toEqual(LOOT.filter((i) => ['mu-len', 'vit', 'ao-do', 't-cu-dem'].includes(i.id)).map((i) => i.id));
    expect(ownedItems(p, 'hat').map((i) => i.id)).toEqual(['mu-len']);
    expect(availableTitles(p)).toEqual([
      { id: 'level-0', name: 'Khách lạ', from: 'level' },
      { id: 't-cu-dem', name: 'Cú đêm', from: 'egg' },
    ]);
    const q = settleTown(understood(10), NOW).progress;
    expect(availableTitles(q).map((t) => t.id)).toEqual(['level-0', 'level-1', 'cau-dau-tien']);
  });

  it('equip: only what is owned, in its own slot; the look is replaced as a whole with its change time', () => {
    const p = withItems('mu-len', 'non-la', 'vit', 'ao-do');
    expect(equip(p, 'hat', 'vuong-mien', NOW)).toMatchObject({ ok: false, reason: 'not-owned' });
    expect(equip(p, 'pet', 'mu-len', NOW).ok).toBe(false); // a hat is not a pet
    expect(canWear(p, 'title', 'tai-thinh')).toBe(false);
    const a = equip(p, 'hat', 'mu-len', NOW);
    if (!a.ok) throw new Error('refused');
    expect(a.progress.look).toEqual({ hat: 'mu-len', outfit: null, pet: null, title: null, at: NOW });
    const b = equip(a.progress, 'pet', 'vit', NOW); // the same millisecond: the change time still moves on
    if (!b.ok) throw new Error('refused');
    expect(b.progress.look).toEqual({ hat: 'mu-len', outfit: null, pet: 'vit', title: null, at: NOW + 1 });
    expect(equip(b.progress, 'pet', 'vit', NOW + 5).progress).toBe(b.progress); // nothing changes
    const off = equip(b.progress, 'hat', null, NOW + 10);
    if (!off.ok) throw new Error('refused');
    expect(off.progress.look.hat).toBeNull();
    expect(lookView(b.progress)).toMatchObject({ hat: { id: 'mu-len', kind: 'hat' }, pet: { id: 'vit' }, outfit: null, title: null });
    // two machines: the look changed last wins whole (never the hat of one and the pet of the other)
    const c = equip(a.progress, 'hat', 'non-la', NOW + 20);
    if (!c.ok) throw new Error('refused');
    expect(mergeTownProgress(b.progress, c.progress).look).toEqual(c.progress.look);
  });

  it('a look that names something not owned here (synced before the item) is drawn without it', () => {
    const p = { ...emptyTownProgress(), look: { hat: 'vuong-mien', outfit: 'ao-do', pet: null, title: 'tai-thinh', at: NOW } };
    expect(lookView(p)).toEqual({ hat: null, outfit: null, pet: null, title: null });
    expect(lookView(addOwned(p, 'ao-do', NOW)).outfit).toMatchObject({ id: 'ao-do', color: '#c8473d' });
  });
});
