import { describe, expect, it } from 'vitest';
import {
  accentLabel,
  clampRate,
  formatDateTimeVi,
  formatRate,
  goalHint,
  goalMinutes,
  goalOptions,
  isRecommendedVoice,
  listenGoalLabel,
  rateHint,
  sortVoices,
  voiceDisplayName,
} from './settingsModel';

describe('voices', () => {
  it('recognises natural voices', () => {
    expect(isRecommendedVoice('Microsoft Aria Online (Natural) - English (United States)')).toBe(true);
    expect(isRecommendedVoice('Google US English')).toBe(true);
    expect(isRecommendedVoice('Microsoft David - English (United States)')).toBe(false);
  });

  it('sorts recommended, then en-US, then name', () => {
    const v = (name: string, lang: string) => ({ name, lang, voiceURI: name });
    const sorted = sortVoices([
      v('Zira', 'en-US'),
      v('Hazel', 'en-GB'),
      v('Google UK English Female', 'en-GB'),
      v('Aria Online (Natural)', 'en-US'),
      v('Catherine', 'en-AU'),
      v('David', 'en-US'),
    ]).map((x) => x.name);
    expect(sorted).toEqual(['Aria Online (Natural)', 'Google UK English Female', 'David', 'Zira', 'Hazel', 'Catherine']);
  });

  it('shortens names and labels accents', () => {
    expect(voiceDisplayName('Microsoft Aria Online (Natural) - English (United States)')).toBe('Microsoft Aria Online (Natural)');
    expect(voiceDisplayName('Google US English')).toBe('Google US English');
    expect(accentLabel('en-US')).toBe('Mỹ');
    expect(accentLabel('en_GB')).toBe('Anh');
    expect(accentLabel('en-SG')).toBe('en-SG');
  });
});

describe('rate', () => {
  it('clamps and snaps', () => {
    expect(clampRate(1)).toBe(1);
    expect(clampRate(0.1)).toBe(0.5);
    expect(clampRate(9)).toBe(1.5);
    expect(clampRate(0.93)).toBe(0.95);
    expect(clampRate('x')).toBe(1);
  });
  it('formats Vietnamese style', () => {
    expect(formatRate(0.75)).toBe('0,75×');
    expect(formatRate(1)).toBe('1×');
    expect(rateHint(0.6)).toBe('chậm, dễ nghe');
    expect(rateHint(1)).toBe('tốc độ thường');
    expect(rateHint(1.4)).toBe('nhanh như người bản xứ');
  });
});

describe('goal + formatting', () => {
  it('estimates minutes and labels', () => {
    expect(goalMinutes(10)).toBe(5);
    expect(goalMinutes(30)).toBe(15);
    expect(goalMinutes(100)).toBe(40);
    expect(goalHint(10)).toBe('Nhẹ nhàng');
    expect(goalHint(30)).toBe('Đều đặn');
    expect(goalHint(60)).toBe('Chăm chỉ');
    expect(goalHint(100)).toBe('Tăng tốc');
  });
  it('formats dates', () => {
    expect(formatDateTimeVi(new Date(2026, 10, 6, 9, 5).getTime())).toBe('6/11/2026 lúc 09:05');
  });
});

describe('goalOptions', () => {
  it('returns the presets, plus a custom goal in order', () => {
    expect(goalOptions([15, 30, 50, 80], 30)).toEqual([15, 30, 50, 80]);
    expect(goalOptions([15, 30, 50, 80], 35)).toEqual([15, 30, 35, 50, 80]);
    expect(goalOptions([15, 30, 50, 80], Number.NaN)).toEqual([15, 30, 50, 80]);
  });
});

describe('listenGoalLabel', () => {
  it('labels the real-listening goal options', () => {
    expect(listenGoalLabel(0)).toBe('Tắt');
    expect(listenGoalLabel(15)).toBe('15 phút');
    expect(listenGoalLabel(60)).toBe('1 giờ');
    expect(listenGoalLabel(90)).toBe('1 giờ 30 phút');
    expect(listenGoalLabel(Number.NaN)).toBe('Tắt');
  });
});

describe('AI section helpers', () => {
  it('formats counts with dots', async () => {
    const { formatCountVi } = await import('./settingsModel');
    expect(formatCountVi(0)).toBe('0');
    expect(formatCountVi(999)).toBe('999');
    expect(formatCountVi(1234)).toBe('1.234');
    expect(formatCountVi(1234567)).toBe('1.234.567');
    expect(formatCountVi(Number.NaN)).toBe('0');
  });

  it('usage line hides zeros', async () => {
    const { aiUsageLine } = await import('./settingsModel');
    expect(aiUsageLine({ requests: 0, ttsChars: 0, cacheHits: 0 })).toBe('Hôm nay chưa dùng.');
    expect(aiUsageLine({ requests: 12, ttsChars: 1234, cacheHits: 0 })).toBe('Hôm nay: 12 yêu cầu'); // no character count (jargon)
    expect(aiUsageLine({ requests: 3, ttsChars: 0, cacheHits: 5 })).toBe('Hôm nay: 3 yêu cầu · 5 lần nghe lại miễn phí');
    expect(aiUsageLine({ requests: 0, ttsChars: 0, cacheHits: 0 }, 200)).toBe('Hôm nay: 0/200 yêu cầu');
  });

  it('parses the daily cap', async () => {
    const { parseDailyCap } = await import('./settingsModel');
    expect(parseDailyCap('')).toBeUndefined();
    expect(parseDailyCap(' 0 ')).toBeUndefined();
    expect(parseDailyCap('200')).toBe(200);
    expect(parseDailyCap('999999')).toBe(100000);
    expect(parseDailyCap('-3')).toBeNull();
    expect(parseDailyCap('1.5')).toBeNull();
    expect(parseDailyCap('abc')).toBeNull();
  });

  it('builds model choices: current, suggestions, listed text models', async () => {
    const { modelChoices } = await import('./settingsModel');
    expect(
      modelChoices('gemini-x', ['gemini-3.6-flash', 'gemini-x'], [
        { id: 'gemini-3.6-flash', kind: 'text' },
        { id: 'gemini-3.8-flash-tts', kind: 'tts' },
        { id: 'gemini-3.8-flash', kind: 'text' },
      ]),
    ).toEqual(['gemini-x', 'gemini-3.6-flash', 'gemini-3.8-flash']);
    expect(modelChoices('', [], [])).toEqual([]);
  });

  it('validates base URLs like the AI config does', async () => {
    const { isValidBaseUrl } = await import('./settingsModel');
    expect(isValidBaseUrl('http://localhost:11434/v1')).toBe(true);
    expect(isValidBaseUrl('https://example.com/api')).toBe(true);
    expect(isValidBaseUrl('ftp://x')).toBe(false);
    expect(isValidBaseUrl('https://u:p@x.com')).toBe(false);
    expect(isValidBaseUrl('https://x.com/?a=1')).toBe(false);
    expect(isValidBaseUrl('not a url')).toBe(false);
  });
});

describe('gemini voice styles', () => {
  it('describes every Gemini voice', async () => {
    const { geminiVoiceStyle } = await import('./settingsModel');
    const { GEMINI_VOICES } = await import('../../core/ai');
    for (const v of GEMINI_VOICES) expect(geminiVoiceStyle(v)).not.toBe('');
    expect(geminiVoiceStyle('constructor')).toBe('');
    expect(geminiVoiceStyle('Nope')).toBe('');
  });
});
