import { describe, expect, it } from 'vitest';
import { hrefFor, isNavRoute, NAV_ROUTES, parseHash, ROUTES } from './nav';

describe('parseHash', () => {
  it('keeps a raw "?" inside a param value (decoded share link)', () => {
    expect(parseHash('#/decoder?text=Are%20you%20OK?%20I%20think%20so').params.text).toBe('Are you OK? I think so');
  });

  it('parses a route without query and the legacy form', () => {
    expect(parseHash('#/stats')).toEqual({ id: 'stats', params: {} });
    expect(parseHash('#dictation')).toEqual({ id: 'dictation', params: {} });
    expect(parseHash('#/nope?x=1').id).toBe('home');
  });

  it('knows the review route (Ôn tập), right after home in the learn group', () => {
    expect(parseHash('#/review')).toEqual({ id: 'review', params: {} });
    expect(hrefFor('review')).toBe('#/review');
    const i = ROUTES.findIndex((r) => r.id === 'review');
    expect(ROUTES[i - 1].id).toBe('home');
    expect(ROUTES[i]).toMatchObject({ label: 'Ôn tập', group: 'learn' });
    expect(parseHash('#/media?id=m1&unit=4').params).toEqual({ id: 'm1', unit: '4' });
  });

  it('round-trips hrefFor', () => {
    expect(parseHash(hrefFor('decoder', { text: 'Is it? Yes & no' }))).toEqual({
      id: 'decoder',
      params: { text: 'Is it? Yes & no' },
    });
  });
});

describe('listening log and checkup routes', () => {
  it('lists Nhật ký nghe right after Tiến độ in the track group', () => {
    const i = ROUTES.findIndex((r) => r.id === 'listening');
    expect(ROUTES[i - 1].id).toBe('stats');
    expect(ROUTES[i]).toMatchObject({ label: 'Nhật ký nghe', group: 'track', hint: 'Ghi lại giờ nghe tiếng Anh thật mỗi ngày' });
    expect(isNavRoute('listening')).toBe(true);
    expect(parseHash('#/listening')).toEqual({ id: 'listening', params: {} });
  });

  it('keeps Kiểm tra định kỳ routable but out of the navigation', () => {
    expect(parseHash('#/checkup')).toEqual({ id: 'checkup', params: {} });
    expect(ROUTES.find((r) => r.id === 'checkup')).toMatchObject({ label: 'Kiểm tra định kỳ', nav: false });
    expect(NAV_ROUTES.some((r) => r.id === 'checkup')).toBe(false);
    expect(isNavRoute('checkup')).toBe(false);
    expect(NAV_ROUTES.length).toBe(ROUTES.length - 1);
  });

  it('lists Thị trấn right after Video thật in the practice group; talk / build params travel as they are', () => {
    const i = ROUTES.findIndex((r) => r.id === 'town');
    expect(ROUTES[i - 1].id).toBe('media');
    expect(ROUTES[i]).toMatchObject({ label: 'Thị trấn', group: 'practice', hint: 'Đi quanh thị trấn, nghe người dân nói gì' });
    expect(isNavRoute('town')).toBe(true);
    expect(parseHash('#/town')).toEqual({ id: 'town', params: {} });
    expect(hrefFor('town')).toBe('#/town');
    expect(hrefFor('town', { talk: 'cafe' })).toBe('#/town?talk=cafe');
    expect(parseHash('#/town?talk=cafe')).toEqual({ id: 'town', params: { talk: 'cafe' } });
    expect(parseHash(hrefFor('town', { build: 'shop' }))).toEqual({ id: 'town', params: { build: 'shop' } });
  });

  it('parses the report view of Tiến độ', () => {
    expect(parseHash(hrefFor('stats', { view: 'report' }))).toEqual({ id: 'stats', params: { view: 'report' } });
  });
});
