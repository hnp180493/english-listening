import { describe, expect, it } from 'vitest';
import { KID_VOICES, PLAYER_FEMALE, romanceAudioText, romancePlayback, romanceVoice } from './romanceAudio';
import { CAST_VOICES } from './voices';

describe('who says a scene line (owner: "mỗi người nên một giọng")', () => {
  it('the courted in their own voice, the learner by who they court, a child by their sex, narration silent', () => {
    expect(romanceVoice('them', { placeId: 'cafe' })).toBe(CAST_VOICES.cafe);
    expect(romanceVoice('you', { placeId: 'cafe' })).toBe(CAST_VOICES.player);
    expect(romanceVoice('you', { placeId: 'square' })).toBe(PLAYER_FEMALE);
    expect(romanceVoice('kid', { placeId: 'square', kid: 'boy' })).toBe(KID_VOICES.boy);
    expect(romanceVoice('narr', { placeId: 'cafe' })).toBeNull();
    // every voice is a distinct Gemini voice from the residents'
    const used = new Set(Object.values(CAST_VOICES).map((v) => v.voice));
    for (const v of [PLAYER_FEMALE, KID_VOICES.boy, KID_VOICES.girl]) expect(used.has(v.voice), v.voice).toBe(false);
  });

  it('a name called out at the start or the end is left out of the clip; one in the middle has no clip', () => {
    expect(romanceAudioText('{name}, the first day you came in, you ordered an iced latte.')).toBe('The first day you came in, you ordered an iced latte.');
    expect(romanceAudioText('I love you, {name}.')).toBe('I love you.');
    expect(romanceAudioText('Good night, {kid}!')).toBe('Good night!');
    expect(romanceAudioText('Well, {name}, here we are.')).toBe('Well, here we are.');
    expect(romanceAudioText('Tell {kid} I said hi.')).toBeNull();
    expect(romanceAudioText('{name}!')).toBeNull();
    expect(romanceAudioText('See you tomorrow.')).toBe('See you tomorrow.');
  });

  it('the playback falls back to the line as shown', () => {
    const p = romancePlayback({ who: 'them', en: 'Hi, {name}.' }, { placeId: 'park' }, 'Hi, Lan.')!;
    expect(p).toEqual({ clip: 'Hi.', fallback: 'Hi, Lan.', mode: 'connected', voice: CAST_VOICES.park });
    expect(romancePlayback({ who: 'narr', vi: 'x' } as never, { placeId: 'park' }, '')).toBeNull();
  });
});
