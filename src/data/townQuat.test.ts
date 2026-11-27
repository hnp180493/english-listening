import { describe, expect, it } from 'vitest';
import { quatFor } from './townQuat';
import { faceOf, vrmFor, type LookLike } from './townVrm';

const look = (o: Partial<LookLike> = {}): LookLike => ({ skin: '#f2d6c6', hair: { style: 'short', color: '#3a2c26' }, top: '#336699', bottom: '#222233', ...o });
const quat = (id: string, l: LookLike) => {
  const who = vrmFor(id, l, '/');
  return quatFor(id, l, who.face, who.tall);
};

describe('who wears a Quaternius body', () => {
  it('a young grown-up stays VRoid; the old, the older and children wear Quaternius', () => {
    expect(quat('folk1', look())).toBeNull();
    // Grace: her own entry says old; a bun, round glasses, a woman's kit, her look's pink top
    const grace = quat('home', look({ hair: { style: 'bun', color: '#d9d4ce' }, top: '#e2a3ae', extras: ['glasses', 'skirt'] }))!;
    expect(grace).toMatchObject({ sex: 'f', kind: 'old', glasses: true, top: '#e2a3ae' });
    expect(grace.bun).not.toBeNull();
    expect(grace.tall).toBeLessThan(1);
    // grey hair on anybody reads older
    expect(quat('folk2', look({ hair: { style: 'short', color: '#d0d0d0' } }))?.kind).toBe('older');
    // a child: a larger head, about 0.63 of a grown-up
    const kid = quat('folk5', look({ scale: 0.75, hair: { style: 'long', color: '#e6c272' }, extras: ['lashes'] }))!;
    expect(kid).toMatchObject({ kind: 'child', sex: 'f', hair: 'long' });
    expect(kid.head).toBeGreaterThan(1);
    expect(kid.tall).toBeGreaterThan(0.55);
    expect(kid.tall).toBeLessThan(0.7);
  });

  it("Westbay's old people keep their beards and bald heads", () => {
    const hal = quat('hal', look({ hair: { style: 'short', color: '#c9c4bd' }, extras: ['beard', 'apron:#4f7fb5'] }))!;
    expect(hal).toMatchObject({ sex: 'm', kind: 'old' });
    expect(hal.beard).not.toBeNull();
    const frank = quat('frank', look({ hair: { style: 'bald', color: '#bdb6ae' }, extras: ['beard', 'glasses'] }))!;
    expect(frank.hair).toBe('none');
    expect(faceOf('frank', look())?.age).toBe('old');
  });
});
