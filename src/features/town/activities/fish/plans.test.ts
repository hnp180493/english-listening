import { describe, expect, it } from 'vitest';
import { castOfSpecies } from '../../../../core/town/fishing';
import { FISH_SPECIES } from '../../../../data/townGame';
import { dictationAudio } from '../../../dictation/decodeCache';
import { citationText } from '../../../drill/match';
import { fishPlans } from './plans';

describe('what a fish says, and how it is played', () => {
  it('plays each kind of item the way the rest of the app plays it', () => {
    const kinds = new Set<string>();
    for (const species of FISH_SPECIES) {
      for (let seed = 0; seed < 4; seed++) {
        const cast = castOfSpecies(species.id, seed)!;
        const { item } = cast;
        const p = fishPlans(item, 1);
        kinds.add(item.kind);
        if (item.kind === 'chunk') {
          // connected ttsText at the learner's rate; careful = the written words one by one
          expect(item.play).toMatchObject({ kind: 'clip', mode: 'connected' });
          expect(p.main).toEqual({ text: item.play.kind === 'clip' ? item.play.text : '', mode: 'connected' });
          expect(p.careful).toMatchObject({ text: citationText(item.reveal.text), mode: 'careful' });
        } else if (item.kind === 'pair') {
          // mode-less, as Phân biệt âm; no careful version (it is the written words already)
          expect(p.main.mode).toBeUndefined();
          expect(p.main.text).toBe(item.reveal.text);
          expect(p.careful).toBeNull();
        } else {
          // the dictation clip, connected, as Chép chính tả
          if (item.play.kind !== 'line') throw new Error('a sentence plays as a line');
          const audio = dictationAudio(item.play.line);
          expect(p.main).toMatchObject({ text: audio.connected, mode: 'connected' });
          expect(p.careful).toMatchObject({ text: audio.careful, mode: 'careful' });
        }
      }
    }
    expect(kinds).toEqual(new Set(['chunk', 'pair', 'sentence']));
  });

  it('a sentence of level 1 plays a little slower than the learner, still connected', () => {
    const species = FISH_SPECIES.find((s) => s.pool.from === 'sentences' && s.pool.levels.includes(1) && s.pool.levels.length === 1)!;
    const cast = castOfSpecies(species.id, 1)!;
    const p = fishPlans(cast.item, 1);
    expect(p.main.mode).toBe('connected');
    expect(p.main.rate).toBeLessThan(1);
  });
});
