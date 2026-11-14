import { describe, expect, it } from 'vitest';
import { WORLD_PLACES } from '../../../data/townWorld';
import { toWorld } from '../engine/iso';
import { keysToDelta } from '../engine/sim';
import { CAST, CHARACTER_IDS } from './cast';
import {
  DIRS8,
  dirFromFacing,
  dirFromScreen,
  dirFromTileVector,
  frameAt,
  frameRect,
  MIRRORED,
  portraitStyle,
  resolveDir,
  walkTime,
  type CharacterAnim,
  type Dir8,
} from './characters';
import { CHARACTER_ART, type CharacterArtData } from './characters.data';

const STEPS: [number, number, Dir8][] = [
  [1, 1, 'S'],
  [1, 0, 'SE'],
  [1, -1, 'E'],
  [0, -1, 'NE'],
  [-1, -1, 'N'],
  [-1, 0, 'NW'],
  [-1, 1, 'W'],
  [0, 1, 'SW'],
];

describe('directions', () => {
  it('maps each of the eight tile steps to its screen direction', () => {
    for (const [dx, dy, d] of STEPS) expect(dirFromTileVector(dx, dy)).toBe(d);
    expect(dirFromTileVector(0, 0)).toBeNull();
    // in between: the nearer one
    expect(dirFromTileVector(1, 0.2)).toBe('SE');
    expect(dirFromTileVector(2, 1.6)).toBe('S');
  });

  it('agrees with the iso projection when given screen vectors', () => {
    for (const [dx, dy, d] of STEPS) {
      const p = toWorld(dx, dy);
      expect(dirFromScreen(p.x, p.y)).toBe(d);
    }
    expect(dirFromScreen(10, 0)).toBe('E');
    expect(dirFromScreen(0, 10)).toBe('S');
    expect(dirFromScreen(0, 0)).toBeNull();
  });

  it('matches the keys: up walks away from the viewer, right across the screen', () => {
    const k = (up: boolean, down: boolean, left: boolean, right: boolean) => {
      const d = keysToDelta({ up, down, left, right });
      return dirFromTileVector(d.x, d.y);
    };
    expect(k(true, false, false, false)).toBe('N');
    expect(k(false, true, false, false)).toBe('S');
    expect(k(false, false, false, true)).toBe('E');
    expect(k(false, false, true, false)).toBe('W');
    expect(k(true, false, false, true)).toBe('NE');
    expect(k(false, true, true, false)).toBe('SW');
  });

  it('turns the engine facing into three-quarter front views', () => {
    expect(dirFromFacing(1)).toBe('SE');
    expect(dirFromFacing(-1)).toBe('SW');
  });
});

describe('resolveDir', () => {
  const five = ['S', 'SE', 'E', 'NE', 'N'];

  it('mirrors the three left-hand directions from the right-hand ones', () => {
    for (const d of five) expect(resolveDir(five, d as Dir8)).toEqual({ dir: d, flip: false });
    for (const [d, src] of Object.entries(MIRRORED)) expect(resolveDir(five, d as Dir8)).toEqual({ dir: src, flip: true });
  });

  it('falls back to the nearest rendered direction, preferring the face', () => {
    const two = ['SE', 'NE'];
    expect(resolveDir(two, 'SE')).toEqual({ dir: 'SE', flip: false });
    expect(resolveDir(two, 'SW')).toEqual({ dir: 'SE', flip: true });
    expect(resolveDir(two, 'NW')).toEqual({ dir: 'NE', flip: true });
    expect(resolveDir(two, 'S')).toEqual({ dir: 'SE', flip: false });
    expect(resolveDir(two, 'E')).toEqual({ dir: 'SE', flip: false });
    expect(resolveDir(two, 'W')).toEqual({ dir: 'SE', flip: true });
    expect(resolveDir(two, 'N').dir).toBe('NE');
  });

  it('always lands on a rendered direction', () => {
    for (const rendered of [five, ['SE', 'NE'], ['S'], ['NE']]) {
      for (const d of DIRS8) expect(rendered).toContain(resolveDir(rendered, d).dir);
    }
  });
});

describe('frameAt', () => {
  const loop = { frames: 8, duration: 0.8, loop: true };
  const once = { frames: 6, duration: 0.6, loop: false };

  it('wraps a loop, also for negative times', () => {
    expect(frameAt(loop, 0)).toBe(0);
    expect(frameAt(loop, 0.1)).toBe(1);
    expect(frameAt(loop, 0.79)).toBe(7);
    expect(frameAt(loop, 0.8)).toBe(0);
    expect(frameAt(loop, 1.75)).toBe(1);
    expect(frameAt(loop, -0.05)).toBe(7);
  });

  it('holds the first and last frame of a one-shot', () => {
    expect(frameAt(once, -1)).toBe(0);
    expect(frameAt(once, 0.35)).toBe(3);
    expect(frameAt(once, 0.6)).toBe(5);
    expect(frameAt(once, 9)).toBe(5);
  });
});

describe('frameRect', () => {
  // a tiny made-up manifest: 2 dirs × 2 frames of idle, then 1 dir × 3 frames of yes
  const fake = {
    res: 2,
    height: 46,
    anims: {
      idle: { frames: 2, duration: 1, loop: true, dirs: ['S', 'SE'] },
      yes: { frames: 3, duration: 0.6, loop: false, dirs: ['SE'] },
    },
    chars: Object.fromEntries(
      CHARACTER_IDS.map((id) => [id, { url: '', w: 100, h: 100, frames: Array.from({ length: 7 * 6 }, (_, i) => Math.floor(i / 6) * 10 + (i % 6)) }]),
    ),
    shadow: { url: '', w: 10, h: 5, ax: 5, ay: 2.5 },
    portraits: { url: 'p.webp', size: 192, moods: ['neutral', 'happy'], order: CHARACTER_IDS },
  } as unknown as CharacterArtData;

  it('counts frames anim → direction → frame', () => {
    expect(frameRect(fake, 'player', 'idle', 'S', 0).index).toBe(0);
    expect(frameRect(fake, 'player', 'idle', 'S', 0.5).index).toBe(1);
    expect(frameRect(fake, 'player', 'idle', 'SE', 0).index).toBe(2);
    expect(frameRect(fake, 'player', 'yes' as CharacterAnim, 'SE', 0.25).index).toBe(4 + 1);
    const r = frameRect(fake, 'player', 'idle', 'SE', 0.5);
    expect(r).toEqual({ index: 3, sx: 30, sy: 31, sw: 32, sh: 33, ax: 34, ay: 35, flip: false });
  });

  it('flips the anchor of a mirrored frame', () => {
    const r = frameRect(fake, 'player', 'idle', 'SW', 0.5);
    expect(r.flip).toBe(true);
    expect(r.index).toBe(3);
    expect(r.ax).toBe(32 - 34);
    expect(r.ay).toBe(35);
  });

  it('rejects an animation the manifest does not have', () => {
    expect(() => frameRect(fake, 'player', 'walk', 'S', 0)).toThrow();
  });
});

describe('the rendered manifest', () => {
  const total = Object.values(CHARACTER_ART.anims).reduce((s, a) => s + a.dirs.length * a.frames, 0);

  it('has every animation the game uses, idle and walk in five directions', () => {
    for (const a of ['idle', 'walk', 'yes', 'no', 'wave']) expect(CHARACTER_ART.anims[a]).toBeDefined();
    expect(CHARACTER_ART.anims.idle.dirs).toEqual(['S', 'SE', 'E', 'NE', 'N']);
    expect(CHARACTER_ART.anims.walk.dirs).toEqual(['S', 'SE', 'E', 'NE', 'N']);
    expect(CHARACTER_ART.anims.idle.loop && CHARACTER_ART.anims.walk.loop).toBe(true);
  });

  it('has a full frame list inside its atlas for every person', () => {
    for (const id of CHARACTER_IDS) {
      const c = CHARACTER_ART.chars[id];
      expect(c.frames.length).toBe(total * 6);
      for (let i = 0; i < c.frames.length; i += 6) {
        const [x, y, w, h, ax, ay] = c.frames.slice(i, i + 6);
        expect(x >= 0 && y >= 0 && x + w <= c.w && y + h <= c.h).toBe(true);
        // the feet are near the bottom of the frame (just below it when both feet are off the ground mid-step)
        expect(ax > 0 && ax < w).toBe(true);
        expect(ay > h * 0.6 && ay <= h + 4).toBe(true);
      }
    }
  });

  it('picks every frame of every animation and direction for every person', () => {
    for (const id of CHARACTER_IDS) {
      for (const anim of Object.keys(CHARACTER_ART.anims) as CharacterAnim[]) {
        const spec = CHARACTER_ART.anims[anim];
        for (const d of DIRS8) {
          for (let i = 0; i < spec.frames; i++) {
            const r = frameRect(CHARACTER_ART, id, anim, d, ((i + 0.5) / spec.frames) * spec.duration);
            expect(r.index).toBeLessThan(total);
            expect(r.sw).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('keeps the walk cycle in step with the engine phase', () => {
    const dur = CHARACTER_ART.anims.walk.duration;
    expect(walkTime(0)).toBe(0);
    expect(walkTime(Math.PI * 2)).toBeCloseTo(dur);
  });
});

describe('cast', () => {
  it('has the player and every resident, with the names of the town', () => {
    expect(CAST.player.name).toBe('Bạn');
    for (const p of WORLD_PLACES) expect(CAST[p.id].name).toBe(p.resident);
    expect(CHARACTER_IDS).toHaveLength(WORLD_PLACES.length + 1);
  });

  it('never gives two people the same look', () => {
    const looks = CHARACTER_IDS.map((id) => JSON.stringify([CAST[id].model, CAST[id].props ?? [], CAST[id].swaps ?? []]));
    expect(new Set(looks).size).toBe(looks.length);
  });
});

describe('portraitStyle', () => {
  it('points at the right cell of the portrait atlas', () => {
    const n = CHARACTER_ART.portraits.order.length;
    const col = CHARACTER_ART.portraits.order.indexOf('cafe');
    const s = portraitStyle('cafe', 'happy', 56);
    expect(s.backgroundSize).toBe(`${n * 56}px 112px`);
    expect(s.backgroundPosition).toBe(`${-col * 56}px -56px`);
    expect(portraitStyle('player', 'neutral', 96).backgroundPosition).toBe('0px 0px');
  });
});
