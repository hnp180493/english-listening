import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_MINUTE_MS } from '../../../core/town/job';
import { GAME_DAY_MS } from '../../../core/town/sky';
import { callBack, leaveVoicemail, markHeard, missCall, offerHeld, phoneState, resetPhone } from './phoneStore';

const T = 9000 * GAME_DAY_MS + 600 * GAME_MINUTE_MS;

describe('the phone store', () => {
  beforeEach(() => resetPhone());

  it('a missed job waits on the phone, is returned in time, and rings no more', () => {
    const e = missCall('job-chip', 'rico', T);
    expect(offerHeld('job-chip', T + 1000)).toBe('waiting');
    expect(callBack(e.id, T + 1000)).toBe('ok');
    expect(offerHeld('job-chip', T + 2000)).toBe(null);
    expect(callBack(e.id, T + 3000)).toBe(null);
  });

  it('returned late, the offer is gone until the next game day; untouched past its deadline, too', () => {
    const e = missCall('job-chip', 'rico', T);
    const late = e.deadline!.at + 1000;
    expect(offerHeld('job-chip', late)).toBe('gone');
    expect(callBack(e.id, late)).toBe('late');
    expect(offerHeld('job-chip', late)).toBe('gone');
    expect(offerHeld('job-chip', (Math.floor(late / GAME_DAY_MS) + 1) * GAME_DAY_MS + 1)).toBe(null);
  });

  it('keeps voice messages, heard once played', () => {
    const v = leaveVoicemail('job-delaney', 'nell', ['job-delaney-l01'], T);
    expect(phoneState().log[0]).toMatchObject({ kind: 'voicemail', status: 'new', lines: ['job-delaney-l01'] });
    markHeard(v.id);
    expect(phoneState().log[0].status).toBe('heard');
  });
});
