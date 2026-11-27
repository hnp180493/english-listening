import { afterAll, describe, expect, it } from 'vitest';
import type { CardId } from '../../core/review/types';
import { episodeTownLines } from '../../core/town/storyLines';
import { DISPATCH_CALLS } from '../../data/city/dispatch';
import { allJobRefs } from '../../data/city/jobs';
import { TOWN_STORIES } from '../../data/townStories';
import { addDictionary, resetDictionary, setActiveLang, tr } from '../../i18n/lang';
import ui from '../../i18n/en/ui';
import content from '../../i18n/en/content';
import town from '../../i18n/en/town';
import city from '../../i18n/en/city';
import { createResolver, dictionariesFor } from './resolve';

// Ôn tập in English mode (docs/i18n.md §4): a card of a town or Westbay line needs the town's / city's dictionary,
// which the page loads only for a session that has one; with exactly those loaded its meaning is English.

const storyCard = `talk:${episodeTownLines(TOWN_STORIES[0])[0].id}` as CardId;
const jobCard = `talk:${allJobRefs().find((r) => r.startsWith('job-'))}` as CardId;
const dispatchCard = `talk:disp-${DISPATCH_CALLS[0].id}` as CardId;
const dictationCard = 'dict:s001' as CardId;

const BUNDLES = { town, city } as const;
const resolver = createResolver({ customs: [], media: [] });

describe('Ôn tập: the dictionaries a session needs', () => {
  afterAll(() => {
    setActiveLang('vi');
    resetDictionary();
  });

  it('none for dictation alone, the town for a story line, the town and the city for a job or a dispatch call', () => {
    expect(dictionariesFor([dictationCard, 'chunk:x' as CardId])).toEqual([]);
    expect(dictionariesFor([storyCard])).toEqual(['town']);
    expect(dictionariesFor([jobCard]).sort()).toEqual(['city', 'town']);
    expect(dictionariesFor([dispatchCard]).sort()).toEqual(['city', 'town']);
    expect(dictionariesFor([dictationCard, storyCard, jobCard]).sort()).toEqual(['city', 'town']);
  });

  it.each([
    ['a town story line', storyCard],
    ['a Westbay job line', jobCard],
    ['a dispatch call', dispatchCard],
  ])('%s: with only the dictionaries it needs loaded, its meaning and its episode title are English', (_, id) => {
    const r = resolver.resolve(id);
    expect(r?.kind).toBe('talk');
    if (r?.kind !== 'talk') return;
    resetDictionary();
    for (const d of [ui, content, ...dictionariesFor([id]).map((n) => BUNDLES[n as keyof typeof BUNDLES])]) addDictionary(d);
    setActiveLang('en');
    expect(tr(r.sentence.vi)).not.toBe(r.sentence.vi);
    expect(tr(r.episodeTitle)).toMatch(/^[\x20-\x7e‘-”…–—£é]+$/);
    setActiveLang('vi');
  });
});
