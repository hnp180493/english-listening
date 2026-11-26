import { describe, expect, it } from 'vitest';
import { GAME_MINUTE_MS } from './job';
import { CALLBACK_AHEAD, callbackDeadline, canCallBack, gameDayOf, goneUntil, waiting, type PhoneEntry } from './phone';
import { GAME_DAY_MS, gameMinutes } from './sky';

/** A real time at which the game's clock shows `minute` (of a day well after 1970). */
const at = (minute: number) => 9000 * GAME_DAY_MS + minute * GAME_MINUTE_MS;

describe('the phone', () => {
  it('a missed call is returned by the first full hour at least CALLBACK_AHEAD game minutes away', () => {
    for (let m = 0; m < 1440; m += 13) {
      const d = callbackDeadline(at(m));
      expect(d.minute % 60).toBe(0);
      const ahead = (d.at - at(m)) / GAME_MINUTE_MS;
      expect(ahead).toBeGreaterThanOrEqual(CALLBACK_AHEAD - 1e-6);
      expect(ahead).toBeLessThan(CALLBACK_AHEAD + 60);
      expect(Math.round(gameMinutes(d.at)) % 1440).toBe(d.minute);
    }
    expect(callbackDeadline(at(16 * 60 + 10)).minute).toBe(18 * 60);
  });

  it('after its deadline the offer is gone until the next game day', () => {
    const d = callbackDeadline(at(23 * 60));
    expect(gameDayOf(goneUntil(d.at))).toBe(gameDayOf(d.at) + 1);
    expect(goneUntil(d.at) % GAME_DAY_MS).toBe(0);
  });

  it('counts what waits: missed calls still open, voice messages not heard', () => {
    const now = at(600);
    const e = (x: Partial<PhoneEntry>): PhoneEntry => ({ id: 'a', kind: 'missed', from: 'rico', at: now, deadline: callbackDeadline(now), status: 'new', ...x });
    expect(canCallBack(e({}), now)).toBe(true);
    expect(canCallBack(e({}), now + 4 * 60 * GAME_MINUTE_MS)).toBe(false);
    expect(canCallBack(e({ status: 'returned' }), now)).toBe(false);
    expect(waiting([e({}), e({ kind: 'voicemail', deadline: undefined }), e({ kind: 'voicemail', status: 'heard' }), e({ kind: 'call', status: 'heard' })], now)).toBe(2);
  });
});
