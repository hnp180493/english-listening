import { describe, expect, it } from 'vitest';
import { CHUNKS } from '../../data/chunks';
import { PAIR_SETS } from '../../data/pairs';
import { SENTENCES } from '../../data/sentences';
import { FISH_SPECIES, fishSpecies, RARITIES, RARITY, type Rarity } from '../../data/townGame';
import { decode } from '../decoder';
import { PHENOMENON_INFO } from '../phenomena';
import { dailyCount, earnedTotal, emptyTownProgress, fishRecord, noteFish, type TownProgress } from './progress';
import {
  applyCatch,
  BASE_TIME_MS,
  castOfSpecies,
  catchOutcome,
  FISH_DAILY_XU,
  fishAlbum,
  fishCaughtTotal,
  fishTip,
  fishXuLeft,
  HUYEN_THOAI_AFTER,
  NEW_SPECIES_XU,
  QUY_AFTER,
  rollCast,
  speciesPool,
  tierWeights,
  type FishCast,
} from './fishing';

const DEV = 'd-aaaa0001';
const NOW = new Date(2026, 10, 20, 12).getTime();

/** A progress with `n` catches of a thường species (so the rarer tiers open). */
function withCatches(n: number): TownProgress {
  let p = emptyTownProgress();
  for (let i = 0; i < n; i++) p = noteFish(p, 'ca-noi', true, 2000, NOW - 1000 + i);
  return p;
}

describe('the items a fish says', () => {
  it('every cast plays a shipped clip and asks a fair question: the right answer is among distinct options', () => {
    for (const species of FISH_SPECIES) {
      for (let seed = 0; seed < 12; seed++) {
        const c = castOfSpecies(species.id, seed)!;
        expect(c.species).toBe(species);
        expect(new Set(c.options).size).toBe(c.options.length);
        expect(c.answer).toBeGreaterThanOrEqual(0);
        expect(c.answer).toBeLessThan(c.options.length);
        if (c.item.kind === 'chunk') {
          const chunk = CHUNKS.find((x) => x.id === c.item.ref)!;
          expect(c.options).toHaveLength(4);
          expect(c.options[c.answer]).toBe(chunk.written);
          expect(c.item.play).toEqual({ kind: 'clip', text: chunk.ttsText, mode: 'connected' });
          expect(c.item.ask).toBe('said');
          // no wrong option sounds like the right one
          for (const o of c.options) if (o !== chunk.written) expect(CHUNKS.find((x) => x.written === o)?.spoken).not.toBe(chunk.spoken);
        } else if (c.item.kind === 'pair') {
          const [itemId, k] = c.item.ref.split('#');
          const item = PAIR_SETS.flatMap((s) => s.items).find((i) => i.id === itemId)!;
          expect([...c.options].sort()).toEqual([...item.options].sort());
          expect(c.options[c.answer]).toBe(item.options[Number(k)]);
          expect(c.item.play).toEqual({ kind: 'clip', text: item.options[Number(k)], mode: undefined });
        } else {
          const s = SENTENCES.find((x) => x.id === c.item.ref)!;
          expect(c.item.play.kind).toBe('line');
          expect(c.item.ask).toBe('meaning');
          expect(c.options).toHaveLength(3);
          expect(c.options[c.answer]).toBe(s.vi);
          expect(s.focus).toContain(species.phenomenon);
        }
      }
    }
  });

  it('a species says only items of its phenomenon; rarer species say harder things', () => {
    for (const f of FISH_SPECIES) {
      for (const e of speciesPool(f)) {
        if (e.kind === 'chunk') expect(e.chunk.phenomena[0]).toBe(f.phenomenon);
        else if (e.kind === 'pair') expect(PAIR_SETS.find((s) => s.items.some((i) => i.id === e.itemId))?.phenomenon).toBe(f.phenomenon);
        else expect(e.sentence.focus).toContain(f.phenomenon);
      }
    }
    const level = (r: Rarity) => {
      const s = FISH_SPECIES.filter((f) => f.tier === r).flatMap((f) => speciesPool(f)).filter((e) => e.kind === 'sentence');
      return s.reduce((n, e) => n + (e.kind === 'sentence' ? e.sentence.level : 0), 0) / Math.max(1, s.length);
    };
    expect(level('hiem')).toBeLessThan(level('quy'));
    expect(level('quy')).toBeLessThanOrEqual(level('huyen-thoai'));
    expect(FISH_SPECIES.filter((f) => f.tier === 'thuong').every((f) => f.pool.from === 'chunks')).toBe(true);
  });

  it('less time and fewer plays for a rarer fish', () => {
    const c = castOfSpecies('ca-noi', 1)!;
    expect(c).toMatchObject({ timeLimitMs: BASE_TIME_MS.chunk, maxPlays: 3, xu: 1 });
    const rare = castOfSpecies('rong-noi-am', 1)!;
    expect(rare.timeLimitMs).toBeLessThan(BASE_TIME_MS.sentence);
    expect(rare).toMatchObject({ maxPlays: 2, xu: 5 });
  });
});

describe('rollCast', () => {
  it('is deterministic for (progress, seed, streak)', () => {
    const p = withCatches(20);
    for (let seed = 0; seed < 20; seed++) {
      const a = rollCast(p, seed, { streak: 2 });
      const b = rollCast(p, seed, { streak: 2 });
      expect([a.species.id, a.item.ref, a.options, a.answer]).toEqual([b.species.id, b.item.ref, b.options, b.answer]);
    }
  });

  it('a new angler gets common and rare fish only; quý after QUY_AFTER catches, huyền thoại after HUYEN_THOAI_AFTER', () => {
    const tiers = (p: TownProgress) => new Set(Array.from({ length: 400 }, (_, s) => rollCast(p, s).species.tier));
    expect([...tiers(emptyTownProgress())].sort()).toEqual(['hiem', 'thuong']);
    expect(tierWeights(withCatches(QUY_AFTER)).quy).toBeGreaterThan(0);
    expect(tierWeights(withCatches(QUY_AFTER))['huyen-thoai']).toBe(0);
    expect(tiers(withCatches(HUYEN_THOAI_AFTER)).has('huyen-thoai')).toBe(true);
  });

  it('a streak of catches raises the odds of a rare fish, up to STREAK_MAX', () => {
    const p = withCatches(30);
    const share = (streak: number) => Array.from({ length: 3000 }, (_, s) => rollCast(p, s, { streak })).filter((c) => c.species.tier !== 'thuong').length / 3000;
    expect(share(5)).toBeGreaterThan(share(0) + 0.05);
    expect(tierWeights(p, 50)).toEqual(tierWeights(p, 5));
    const w = tierWeights(p, 0);
    expect(w).toEqual(Object.fromEntries(RARITIES.map((r) => [r, RARITY[r].fishWeight])));
  });

  it('a species not caught yet bites twice as often as one already caught', () => {
    // every thường species but one caught: the one left comes up more than its share
    let p = emptyTownProgress();
    const commons = FISH_SPECIES.filter((f) => f.tier === 'thuong');
    for (const f of commons.slice(1)) p = noteFish(p, f.id, true, 1000, NOW);
    const hits = Array.from({ length: 3000 }, (_, s) => rollCast(p, s)).filter((c) => c.species.tier === 'thuong');
    const left = hits.filter((c) => c.species.id === commons[0].id).length / hits.length;
    expect(left).toBeGreaterThan(1.4 / commons.length);
  });
});

describe('catchOutcome and applyCatch', () => {
  const cast = (id = 'ca-noi'): FishCast => castOfSpecies(id, 3)!;

  it('caught: right, in time and within the plays; half the xu after replays', () => {
    const c = cast();
    expect(catchOutcome(c, { correct: true, plays: 1, ms: 2000 })).toEqual({ caught: true, reason: 'caught', firstListen: true, xu: 1, ms: 2000 });
    expect(catchOutcome(cast('rong-noi-am'), { correct: true, plays: 2, ms: 100 })).toMatchObject({ caught: true, firstListen: false, xu: 3 });
    expect(catchOutcome(c, { correct: false, plays: 1, ms: 100 }).reason).toBe('wrong');
    expect(catchOutcome(c, { correct: true, plays: 1, ms: c.timeLimitMs + 1 }).reason).toBe('slow');
    expect(catchOutcome(c, { correct: true, plays: 1, ms: Number.NaN }).reason).toBe('slow');
    expect(catchOutcome(c, { correct: true, plays: c.maxPlays + 1, ms: 100 }).reason).toBe('replays');
    expect(catchOutcome(c, { correct: true, plays: 0, ms: 100 }).reason).toBe('unplayed');
  });

  it('records the species, pays the catch and the first-catch bonus, counts the day; an escape is seen, not paid', () => {
    const c = cast();
    const p0 = emptyTownProgress();
    const away = applyCatch(p0, c, catchOutcome(c, { correct: false, plays: 1, ms: 900 }), NOW, DEV);
    expect(away).toMatchObject({ xu: 0, newSpecies: false, record: { seen: 1, caught: 0 } });
    expect(earnedTotal(away.progress)).toBe(0);
    expect(away.progress.days).toEqual([]); // fishing is not a town line: the streak is not kept by it
    const got = applyCatch(away.progress, c, catchOutcome(c, { correct: true, plays: 1, ms: 1800 }), NOW, DEV);
    expect(got).toMatchObject({ xu: 1 + NEW_SPECIES_XU, newSpecies: true, capped: false, record: { seen: 2, caught: 1, firstAt: NOW, bestMs: 1800, at: NOW } });
    expect(dailyCount(got.progress, '2026-11-20', DEV)).toMatchObject({ fish: 1, fishFirst: 1, fishXu: 3 });
    const again = applyCatch(got.progress, c, catchOutcome(c, { correct: true, plays: 2, ms: 900 }), NOW + 5, DEV);
    expect(again).toMatchObject({ xu: 1, newSpecies: false, record: { caught: 2, firstAt: NOW, bestMs: 900, at: NOW + 5 } });
    expect(p0).toEqual(emptyTownProgress());
    // never played: recorded nowhere
    const guess = applyCatch(got.progress, c, catchOutcome(c, { correct: true, plays: 0, ms: 10 }), NOW, DEV);
    expect(guess.progress).toBe(got.progress);
  });

  it(`pays at most ${FISH_DAILY_XU} xu a day over every browser; casts stay unlimited`, () => {
    let p = emptyTownProgress();
    const c = cast('rong-noi-am'); // 5 xu a catch
    let paid = 0;
    for (let i = 0; i < 12; i++) {
      const dev = i % 2 ? DEV : 'd-bbbb0002';
      const r = applyCatch(p, c, catchOutcome(c, { correct: true, plays: 1, ms: 100 }), NOW + i, dev);
      p = r.progress;
      paid += r.xu;
    }
    expect(paid).toBe(FISH_DAILY_XU);
    expect(fishXuLeft(p, NOW)).toBe(0);
    expect(fishRecord(p, 'rong-noi-am')?.caught).toBe(12);
    // the next day pays again
    expect(fishXuLeft(p, NOW + 86_400_000)).toBe(FISH_DAILY_XU);
  });
});

describe('fishAlbum', () => {
  it('lists every species, thường first, with what was caught and seen', () => {
    let p = noteFish(emptyTownProgress(), 'koi-vang', true, 3000, NOW);
    p = noteFish(p, 'ca-gon', false, 0, NOW);
    p = noteFish(p, 'ca-gon', true, 2000, NOW);
    p = noteFish(p, 'ca-noi', false, 0, NOW);
    const a = fishAlbum(p);
    expect(a.total).toBe(24);
    expect(a.caught).toBe(2);
    expect(a.catches).toBe(fishCaughtTotal(p));
    expect(a.fish[0].species.tier).toBe('thuong');
    expect(a.fish.at(-1)!.species.tier).toBe('huyen-thoai');
    expect(a.byTier['huyen-thoai']).toEqual({ caught: 1, total: 2 });
    expect(a.fish.find((f) => f.species.id === 'ca-noi')).toMatchObject({ caught: false, seen: true });
    expect(a.fish.find((f) => f.species.id === 'ca-luot')).toMatchObject({ caught: false, seen: false, record: null });
  });
});

describe('fishTip: the tip comes from the item itself', () => {
  it('every pool item of every species: the tip names a phenomenon the item really has', () => {
    let n = 0;
    for (const species of FISH_SPECIES) {
      for (const entry of speciesPool(species)) {
        const tip = fishTip(species, entry);
        n += 1;
        expect(tip.text.trim().length).toBeGreaterThan(0);
        expect(tip.label).toBe(PHENOMENON_INFO[tip.phenomenon].label);
        if (entry.kind === 'pair') {
          // a minimal pair: its set's phenomenon and the item's own cue
          const set = PAIR_SETS.find((x) => x.items.some((i) => i.id === entry.itemId));
          expect(tip.phenomenon).toBe(set?.phenomenon);
          expect(tip.text).toBe(set?.items.find((i) => i.id === entry.itemId)?.cue);
        } else if (entry.kind === 'chunk') {
          // a chunk: one of its own labels, and when the text is a decoder rule, the decoder found it in these words
          expect(entry.chunk.phenomena).toContain(tip.phenomenon);
          const types = decode(entry.chunk.written).annotations.filter((a) => a.rule.trim() === tip.text).map((a) => a.type);
          if (tip.text !== PHENOMENON_INFO[tip.phenomenon].summary) expect(types).toContain(tip.phenomenon);
        } else {
          // a sentence: an annotation the decoder finds in it, with its own rule
          const found = decode(entry.sentence.text).annotations;
          expect(found.some((a) => a.type === tip.phenomenon && a.rule.trim() === tip.text), entry.sentence.text).toBe(true);
        }
      }
    }
    expect(n).toBeGreaterThan(500);
  });

  it('the cast carries the tip of its item', () => {
    for (const species of FISH_SPECIES) {
      const cast = castOfSpecies(species.id, 7);
      if (cast) expect(cast.item.tip.text.length).toBeGreaterThan(0);
    }
  });

  it('"tell them" (a reduction chunk) is not explained with gonna / wanna', () => {
    const species = fishSpecies('ca-gonna');
    if (!species) throw new Error('ca-gonna missing');
    const entry = speciesPool(species).find((e) => e.kind === 'chunk' && e.chunk.written === 'tell them');
    if (!entry) throw new Error('tell them missing');
    const tip = fishTip(species, entry);
    expect(tip.text).toMatch(/them/);
    expect(tip.text).not.toMatch(/gonna|wanna|going to|want to/i);
  });
});
