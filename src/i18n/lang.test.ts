import { afterEach, describe, expect, it } from 'vitest';
import { addDictionary, asIs, fillTemplate, getLang, i18nMisses, resetDictionary, sanitizeLang, setActiveLang, subscribeLang, templateKey, tl, tr } from './lang';
import { translateProps } from './translateProps';

afterEach(() => {
  setActiveLang('vi');
  resetDictionary();
});

const english = (entries: Record<string, string>) => {
  addDictionary(entries);
  setActiveLang('en');
};

describe('language state', () => {
  it('is Vietnamese until something switches it', () => {
    expect(getLang()).toBe('vi');
  });

  it('accepts only known languages', () => {
    expect(sanitizeLang('en')).toBe('en');
    expect(sanitizeLang('vi')).toBe('vi');
    expect(sanitizeLang('fr')).toBe('vi');
    expect(sanitizeLang(undefined)).toBe('vi');
  });

  it('tells subscribers about a real change only', () => {
    let calls = 0;
    const stop = subscribeLang(() => calls++);
    setActiveLang('vi');
    expect(calls).toBe(0);
    setActiveLang('en');
    setActiveLang('en');
    expect(calls).toBe(1);
    stop();
    setActiveLang('vi');
    expect(calls).toBe(1);
  });
});

describe('tr', () => {
  it('returns the Vietnamese text untouched in Vietnamese mode, even with an entry', () => {
    addDictionary({ 'Ôn tập': 'Review' });
    expect(tr('Ôn tập')).toBe('Ôn tập');
    expect(i18nMisses()).toEqual([]);
  });

  it('looks the whole string up in English mode', () => {
    english({ 'Ôn tập': 'Review' });
    expect(tr('Ôn tập')).toBe('Review');
  });

  it('keeps the spaces around a piece of JSX text', () => {
    english({ 'thẻ hôm nay': 'cards today' });
    expect(tr(' thẻ hôm nay ')).toBe(' cards today ');
  });

  it('falls back to the Vietnamese text and remembers the miss', () => {
    english({});
    expect(tr('Chưa dịch')).toBe('Chưa dịch');
    expect(i18nMisses()).toEqual(['Chưa dịch']);
  });

  it('does not count English or symbols as a miss', () => {
    english({});
    expect(tr('gonna')).toBe('gonna');
    expect(tr('café')).toBe('café');
    expect(tr('3/10')).toBe('3/10');
    expect(i18nMisses()).toEqual(['café']);
  });

  it('agrees a counted noun with the number in front of it', () => {
    english({ câu: '{#|sentence|sentences}', 'ngày liên tiếp': '{#|day|days} in a row' });
    expect(tr(' câu', 1)).toBe(' sentence');
    expect(tr(' câu', 3)).toBe(' sentences');
    expect(tr(' câu', 0)).toBe(' sentences');
    expect(tr('câu')).toBe('sentences');
    expect(tr('ngày liên tiếp', 1)).toBe('day in a row');
  });

  it('allows an empty English entry', () => {
    english({ 'Còn': '' });
    expect(tr('Còn ')).toBe(' ');
    expect(i18nMisses()).toEqual([]);
  });
});

describe('tl', () => {
  it('gives exactly the plain template literal in Vietnamese mode', () => {
    const n = 5;
    const who = 'Emma';
    addDictionary({ 'Còn {} thẻ của {}': '{0} cards' });
    expect(tl`Còn ${n} thẻ của ${who}`).toBe(`Còn ${n} thẻ của ${who}`);
    expect(tl`${n}`).toBe('5');
    expect(tl`${null} và ${undefined}`).toBe(`${null} và ${undefined}`);
  });

  it('builds its key from the fixed parts', () => {
    expect(templateKey(['Còn ', ' thẻ'])).toBe('Còn {} thẻ');
    expect(templateKey(['', ' giờ ', ' phút'])).toBe('{} giờ {} phút');
  });

  it('fills the English entry, in any order', () => {
    english({ '{} tặng {} cho bạn': 'You got {1} from {0}' });
    expect(tl`${'Leo'} tặng ${'a flower'} cho bạn`).toBe('You got a flower from Leo');
  });

  it('picks the plural form by the value', () => {
    english({ 'Còn {} thẻ': '{0} {0|card|cards} left' });
    expect(tl`Còn ${1} thẻ`).toBe('1 card left');
    expect(tl`Còn ${12} thẻ`).toBe('12 cards left');
    expect(tl`Còn ${0} thẻ`).toBe('0 cards left');
  });

  it('translates values that are Vietnamese labels', () => {
    english({ 'Mở {}': 'Open {0}', 'Ôn tập': 'Review' });
    expect(tl`Mở ${'Ôn tập'}`).toBe('Open Review');
    expect(tl`Mở ${'gonna'}`).toBe('Open gonna');
  });

  it('leaves a value marked asIs untouched in both languages', () => {
    addDictionary({ 'Chơi với {}': 'Play with {0}', Mai: 'Tomorrow' });
    expect(tl`Chơi với ${asIs('Mai')}`).toBe('Chơi với Mai');
    setActiveLang('en');
    expect(tl`Chơi với ${asIs('Mai')}`).toBe('Play with Mai');
    expect(tl`Chơi với ${'Mai'}`).toBe('Play with Tomorrow');
  });

  it('falls back to the Vietnamese sentence and remembers the miss', () => {
    english({});
    expect(tl`Còn ${3} thẻ`).toBe('Còn 3 thẻ');
    expect(i18nMisses()).toEqual(['Còn 3 thẻ']);
  });

  it('fillTemplate leaves an unknown slot empty and keeps other braces', () => {
    expect(fillTemplate('{0} of {1}', [2])).toBe('2 of ');
    expect(fillTemplate('{x} {0}', ['a'])).toBe('{x} a');
    expect(fillTemplate('{0|one|many} {1|is|are}', [1, 2])).toBe('one are');
  });
});

describe('translateProps (the JSX step)', () => {
  it('returns the same props object in Vietnamese mode', () => {
    addDictionary({ 'Lưu': 'Save' });
    const props = { children: 'Lưu', title: 'Lưu' };
    expect(translateProps(props)).toBe(props);
  });

  it('translates string children and text attributes, and nothing else', () => {
    english({ 'Lưu': 'Save', 'Tìm': 'Search' });
    const props = { children: 'Lưu', title: 'Lưu', placeholder: 'Tìm', value: 'Lưu', className: 'Lưu', 'aria-label': 'Lưu' };
    expect(translateProps(props)).toEqual({ children: 'Save', title: 'Save', placeholder: 'Search', value: 'Lưu', className: 'Lưu', 'aria-label': 'Save' });
  });

  it('walks child arrays and agrees a noun with the number before it', () => {
    english({ 'Còn': 'Left:', câu: '{#|sentence|sentences}' });
    const el = { $$typeof: Symbol.for('react.transitional.element') };
    expect(translateProps({ children: ['Còn ', 1, ' câu', el, [2, ' câu']] })).toEqual({ children: ['Left: ', 1, ' sentence', el, [2, ' sentences']] });
  });

  it('keeps the same object when nothing changes', () => {
    english({});
    const props = { children: ['gonna', 3], title: 'wanna' };
    expect(translateProps(props)).toBe(props);
  });

  it('leaves an element marked data-vi as written', () => {
    english({ 'Lưu': 'Save' });
    const props = { 'data-vi': '', children: 'Lưu' };
    expect(translateProps(props)).toBe(props);
  });
});
