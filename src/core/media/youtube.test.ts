import { describe, expect, it } from 'vitest';
import { isYouTubeId, parseYouTubeId, parseYouTubeStart } from './youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it.each([
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abc123&t=42`],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&t=95s`],
    [`https://www.youtube.com/watch?feature=share&v=${ID}`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://music.youtube.com/watch?v=${ID}&list=RD`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://youtube.com/shorts/${ID}?feature=share`],
    [`https://www.youtube.com/embed/${ID}?start=10`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://www.youtube.com/live/${ID}`],
    [`youtube.com/watch?v=${ID}`],
    [`www.youtube.com/watch?v=${ID}`],
    [`youtu.be/${ID}`],
    [`http://youtube.com/v/${ID}`],
    [`  ${ID}  `],
  ])('accepts %s', (url) => {
    expect(parseYouTubeId(url)).toBe(ID);
  });

  it.each([
    [''],
    ['   '],
    ['hello world'],
    ['https://vimeo.com/123456789'],
    ['https://www.youtube.com/watch?v=short'],
    ['https://www.youtube.com/@somechannel'],
    ['https://www.youtube.com/playlist?list=PL123'],
    ['https://evil.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ'],
    ['javascript:alert(1)'],
    ['dQw4w9WgXcQQ'],
  ])('rejects %s', (url) => {
    expect(parseYouTubeId(url)).toBeNull();
  });

  it('handles null / undefined', () => {
    expect(parseYouTubeId(null)).toBeNull();
    expect(parseYouTubeId(undefined)).toBeNull();
  });

  it('isYouTubeId validates shape', () => {
    expect(isYouTubeId(ID)).toBe(true);
    expect(isYouTubeId('a-b_c123456')).toBe(true);
    expect(isYouTubeId('abc')).toBe(false);
  });
});

describe('parseYouTubeStart', () => {
  it('reads t= in seconds and h/m/s forms', () => {
    expect(parseYouTubeStart(`https://youtu.be/${ID}?t=42`)).toBe(42);
    expect(parseYouTubeStart(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)).toBe(90);
    expect(parseYouTubeStart(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`)).toBe(3723);
    expect(parseYouTubeStart(`https://www.youtube.com/embed/${ID}?start=10`)).toBe(10);
  });
  it('returns null without a start', () => {
    expect(parseYouTubeStart(`https://youtu.be/${ID}`)).toBeNull();
    expect(parseYouTubeStart(`https://youtu.be/${ID}?t=abc`)).toBeNull();
  });
});

describe('parseYouTubeId in surrounding text', () => {
  it('finds a link inside a shared message', () => {
    expect(parseYouTubeId(`Xem video này: https://youtu.be/${ID}?si=x hay lắm`)).toBe(ID);
    expect(parseYouTubeId(`(link: www.youtube.com/watch?v=${ID}).`)).toBe(ID);
    expect(parseYouTubeId('xem https://evil.com/watch?v=dQw4w9WgXcQ nhé')).toBeNull();
  });
});
