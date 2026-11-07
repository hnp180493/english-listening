import { describe, expect, it } from 'vitest';
import type { CardId } from '../../core/review/types';
import {
  currentId,
  endSession,
  isGraded,
  nextItem,
  originalDone,
  recordResult,
  remaining,
  skipItem,
  startSession,
  restoreItem,
  summarizeSession,
  wasRequeuedAt,
  type SessionResult,
} from './sessionModel';

const d1 = 'dict:s001' as CardId;
const p1 = 'pair:can-cant' as CardId;
const l1 = 'lesson:linking' as CardId;
const c1 = 'chunk:c001' as CardId;

const res = (id: CardId, grade: SessionResult['grade']): SessionResult => ({
  id,
  kind: id.split(':')[0] as SessionResult['kind'],
  grade,
  correct: grade !== 'again',
});

describe('sessionModel', () => {
  it('starts at the first item; an empty queue is already ended', () => {
    const s = startSession([p1, d1]);
    expect(currentId(s)).toBe(p1);
    expect(s.original).toBe(2);
    expect(remaining(s)).toBe(2);
    expect(startSession([]).ended).toBe(true);
    expect(currentId(startSession([]))).toBeNull();
  });

  it('records one result per position and requeues an again only once', () => {
    let s = startSession([d1, p1]);
    s = recordResult(s, 0, res(d1, 'again'));
    const twice = recordResult(s, 0, res(d1, 'good'));
    expect(twice).toBe(s);
    expect(s.results[0].grade).toBe('again');
    expect(s.queue).toEqual([d1, p1, d1]);
    expect(s.requeued).toEqual([d1]);
    expect(isGraded(s, 0)).toBe(true);
    expect(wasRequeuedAt(s, 0)).toBe(true);
    s = nextItem(nextItem(s));
    expect(currentId(s)).toBe(d1);
    s = recordResult(s, 2, res(d1, 'again'));
    expect(s.queue).toEqual([d1, p1, d1]);
    expect(wasRequeuedAt(s, 2)).toBe(false);
  });

  it('never requeues lessons', () => {
    let s = startSession([l1]);
    s = recordResult(s, 0, res(l1, 'again'));
    expect(s.queue).toEqual([l1]);
    expect(s.requeued).toEqual([]);
  });

  it('ignores results for the wrong id or position', () => {
    const s = startSession([d1]);
    expect(recordResult(s, 0, res(p1, 'good'))).toBe(s);
    expect(recordResult(s, 3, res(d1, 'good'))).toBe(s);
  });

  it('skip moves on without a result', () => {
    let s = startSession([d1, p1]);
    s = skipItem(s);
    expect(isGraded(s, 0)).toBe(false);
    expect(currentId(s)).toBe(p1);
    expect(summarizeSession(s).total).toBe(0);
  });

  it('remaining and originalDone follow the position', () => {
    let s = startSession([d1, p1, c1]);
    s = recordResult(s, 0, res(d1, 'again'));
    s = nextItem(s);
    expect(remaining(s)).toBe(3);
    expect(originalDone(s)).toBe(1);
    s = nextItem(nextItem(s));
    expect(originalDone(s)).toBe(3);
    expect(remaining(s)).toBe(1);
    s = nextItem(s);
    expect(s.ended).toBe(true);
    expect(originalDone(s)).toBe(3);
    expect(nextItem(s)).toBe(s);
  });

  it('summary counts each id once; a miss stays "Chưa nhớ" even when the requeued copy is right', () => {
    let s = startSession([d1, p1, c1]);
    s = recordResult(s, 0, res(d1, 'again'));
    s = nextItem(s);
    s = recordResult(s, 1, res(p1, 'good'));
    s = nextItem(s);
    s = recordResult(s, 2, res(c1, 'again'));
    s = nextItem(s);
    s = recordResult(s, 3, res(d1, 'hard'));
    const sum = summarizeSession(s);
    expect(sum).toEqual({
      total: 3,
      remembered: 1,
      notYet: 2,
      byKind: { dict: { total: 1, remembered: 0 }, pair: { total: 1, remembered: 1 }, chunk: { total: 1, remembered: 0 } },
    });
  });

  it('restoreItem (undo of a suspend) puts the id back right after the item on screen', () => {
    let s = startSession([d1, p1, c1]);
    s = skipItem(s); // d1 suspended → on p1
    s = restoreItem(s, d1);
    expect(s.queue).toEqual([d1, p1, d1, c1]);
    expect(s.original).toBe(4);
    expect(currentId(s)).toBe(p1);
    expect(restoreItem(s, d1)).toBe(s); // already ahead
    s = nextItem(s);
    expect(currentId(s)).toBe(d1);
    expect(remaining(s)).toBe(2);
    // past the original part (a requeued copy was suspended): stays in the extra part
    let r = startSession([d1]);
    r = recordResult(r, 0, res(d1, 'again'));
    r = nextItem(r); // on the requeued copy of d1
    r = skipItem(r); // suspended → ended
    expect(restoreItem(r, d1)).toBe(r);
    let q = startSession([d1, p1]);
    q = recordResult(q, 0, res(d1, 'again'));
    q = nextItem(nextItem(q)); // on the requeued d1 (pos 2)
    q = { ...q, queue: [...q.queue, c1] };
    q = skipItem(q);
    expect(restoreItem(q, d1)).toMatchObject({ queue: [d1, p1, d1, c1, d1], original: 2 });
  });

  it('ends early', () => {
    let s = startSession([d1, p1]);
    s = recordResult(s, 0, res(d1, 'good'));
    s = endSession(s);
    expect(s.ended).toBe(true);
    expect(currentId(s)).toBeNull();
    expect(summarizeSession(s).total).toBe(1);
    expect(endSession(s)).toBe(s);
  });
});
