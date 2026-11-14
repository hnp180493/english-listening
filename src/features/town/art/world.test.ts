import { describe, expect, it } from 'vitest';
import { DECORATION_IDS, TOWN_WORLD, WORLD_PLACES, worldTrees, type DecorSpot } from '../../../data/townWorld';
import { toWorld } from '../engine/iso';
import { DIRS8 } from './characters';
import {
  catFrame,
  decorSpriteKey,
  fountainKey,
  groundRect,
  lotNature,
  lotSpriteKey,
  placeAnchor,
  placeSpriteKey,
  propSpriteKey,
  spotAnchor,
  spriteDraw,
  spriteTop,
  stringLights,
  treeKey,
} from './world';
import { WORLD_ART, type WorldArtData, type WorldSpriteKey } from './world.data';
import { tileHash, treeSpriteKey, treeVariant, TREE_VARIANTS } from './worldPick';

const KEYS = Object.keys(WORLD_ART.sprites) as WorldSpriteKey[];

describe('the manifest', () => {
  it('keeps every rect inside its atlas', () => {
    for (const layer of [WORLD_ART.sprites, WORLD_ART.lit, WORLD_ART.shadows]) {
      for (const [key, r] of Object.entries(layer)) {
        const [atlas, x, y, w, h] = r!;
        const a = WORLD_ART.atlases[atlas];
        expect(a, key).toBeDefined();
        expect(x, key).toBeGreaterThanOrEqual(0);
        expect(y, key).toBeGreaterThanOrEqual(0);
        expect(x + w, key).toBeLessThanOrEqual(a.w);
        expect(y + h, key).toBeLessThanOrEqual(a.h);
      }
    }
  });

  it('has a lit or shadow layer only for a sprite that exists', () => {
    for (const k of [...Object.keys(WORLD_ART.lit), ...Object.keys(WORLD_ART.shadows)]) expect(KEYS).toContain(k);
  });

  it('has a body and a shadow for every place, and lights in the houses', () => {
    for (const p of WORLD_PLACES) {
      const k = placeSpriteKey(p.id);
      expect(WORLD_ART.shadows[k], p.id).toBeDefined();
    }
    for (const id of ['cafe', 'friend', 'home', 'office', 'school', 'clinic', 'cinema'] as const) {
      expect(WORLD_ART.lit[placeSpriteKey(id)], id).toBeDefined();
    }
  });

  it('has both kinds of empty lot for every footprint of the layout', () => {
    for (const p of WORLD_PLACES) {
      expect(() => lotSpriteKey(p, 'site')).not.toThrow();
      expect(() => lotSpriteKey(p, 'grass')).not.toThrow();
    }
  });

  it('has the ground covering the whole grid, island edge included', () => {
    const g = groundRect();
    const n = TOWN_WORLD.size;
    for (const [tx, ty] of [[-0.9, -0.9], [n + 0.9, -0.9], [-0.9, n + 0.9], [n + 0.9, n + 0.9]]) {
      const p = toWorld(tx, ty);
      expect(p.x).toBeGreaterThanOrEqual(g.x);
      expect(p.x).toBeLessThanOrEqual(g.x + g.w);
      expect(p.y).toBeGreaterThanOrEqual(g.y);
      expect(p.y).toBeLessThanOrEqual(g.y + g.h);
    }
  });
});

describe('which sprite stands where', () => {
  it('gives every decoration spot a sprite (the cat walks instead)', () => {
    for (const id of DECORATION_IDS) {
      TOWN_WORLD.decorations[id].forEach((s, i) => {
        const k = decorSpriteKey(id, i, s);
        if (id === 'cat') expect(k).toBeNull();
        else expect(KEYS).toContain(k);
      });
    }
  });

  it('turns benches the way the layout says', () => {
    const at = (dir: DecorSpot['dir']): DecorSpot => ({ x: 0, y: 0, solid: true, dir });
    expect(decorSpriteKey('benches', 0, at('e'))).toBe('decor/bench/e');
    expect(decorSpriteKey('benches', 0, at('w'))).toBe('decor/bench/w');
    expect(decorSpriteKey('benches', 0, at(undefined))).toBe('decor/bench/s');
  });

  it('gives every tree of the layout a sprite, the variant the ground was baked with', () => {
    for (const t of worldTrees()) {
      const k = treeKey(t.kind, t.x, t.y);
      expect(k).toBe(treeSpriteKey(t.kind, t.x, t.y));
      expect(WORLD_ART.shadows[k]).toBeDefined();
    }
  });

  it('picks tree variants stably and in range', () => {
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        for (const kind of ['round', 'pine'] as const) {
          const v = treeVariant(kind, x, y);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(TREE_VARIANTS[kind]);
          expect(treeVariant(kind, x, y)).toBe(v);
        }
        const h = tileHash(x, y);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(1);
      }
    }
    // not all the same
    const seen = new Set(worldTrees().filter((t) => t.kind === 'round').map((t) => treeVariant('round', t.x, t.y)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('has the fixed props and both fountains', () => {
    expect(KEYS).toContain(propSpriteKey('terrace'));
    expect(KEYS).toContain(propSpriteKey('bus'));
    expect(fountainKey(false)).toBe('decor/fountain/0');
    expect(fountainKey(true)).toBe('decor/fountain/1');
  });

  it('anchors places at the middle of the footprint and spots by solidity', () => {
    expect(placeAnchor({ x: 3, y: 8, w: 3, d: 2 })).toEqual({ x: 4.5, y: 9 });
    expect(spotAnchor({ x: 4, y: 5, solid: true })).toEqual({ x: 4.5, y: 5.5 });
    expect(spotAnchor({ x: 4.2, y: 5.3, solid: false })).toEqual({ x: 4.2, y: 5.3 });
  });

  it('throws on a sprite that does not exist', () => {
    expect(() => lotSpriteKey({ w: 9, d: 9 }, 'site')).toThrow();
  });
});

describe('string lights', () => {
  it('ties the pavilion strings only when the square is built', () => {
    const all = stringLights(true);
    expect(all.length).toBe(WORLD_ART.strings.length);
    const without = stringLights(false);
    expect(without.every((s) => s.from !== 'square' && s.to !== 'square')).toBe(true);
    expect(without.length).toBeGreaterThan(0);
    for (const s of all) expect(KEYS).toContain(s.sprite);
  });

  it('names poles that exist in the layout', () => {
    const poles = TOWN_WORLD.decorations.lights.length;
    for (const s of WORLD_ART.strings) {
      for (const end of [s.from, s.to]) {
        if (end === 'square') continue;
        expect(Number(end.replace('pole', ''))).toBeLessThan(poles);
      }
    }
  });
});

describe('the cat', () => {
  it('has a frame for every direction, mirrored where not rendered', () => {
    for (const anim of ['walk', 'sit'] as const) {
      for (const dir of DIRS8) {
        const f = catFrame(anim, dir, 0.1);
        expect(KEYS).toContain(f.key);
        expect(f.flip).toBe(dir === 'SW' || dir === 'W' || dir === 'NW');
      }
    }
    expect(catFrame('walk', 'SW', 0).key).toBe(catFrame('walk', 'SE', 0).key);
  });

  it('loops the walk', () => {
    const d = WORLD_ART.cat.anims.walk.duration;
    expect(catFrame('walk', 'S', 0).key).toBe(catFrame('walk', 'S', d).key);
    expect(catFrame('walk', 'S', 0).key).not.toBe(catFrame('walk', 'S', d / 2).key);
  });
});

describe('drawing maths', () => {
  const data: WorldArtData = {
    ...WORLD_ART,
    atlases: [{ url: 'a', w: 100, h: 100, res: 2 }, { url: 'b', w: 100, h: 100, res: 1 }],
    sprites: { ...WORLD_ART.sprites, 'place/cafe': [0, 10, 20, 40, 60, 10, 50] },
    shadows: { ...WORLD_ART.shadows, 'place/cafe': [1, 0, 0, 30, 10, 5, 4] },
  };

  it('puts the anchor on the given point at 1 / res', () => {
    const d = spriteDraw('place/cafe', 'body', 100, 200, false, data)!;
    expect(d).toMatchObject({ atlas: 0, sx: 10, sy: 20, sw: 40, sh: 60, dw: 20, dh: 30 });
    expect(d.dx).toBe(100 - 5);
    expect(d.dy).toBe(200 - 25);
  });

  it('uses each atlas its own resolution (shadows are lower)', () => {
    const d = spriteDraw('place/cafe', 'shadow', 0, 0, false, data)!;
    expect(d).toMatchObject({ dw: 30, dh: 10, dx: -5, dy: -4 });
  });

  it('mirrors round the anchor', () => {
    const d = spriteDraw('place/cafe', 'body', 0, 0, true, data)!;
    // 30 atlas px right of the anchor become 30 px left of it
    expect(d.dx).toBe(-15);
    expect(d.flip).toBe(true);
  });

  it('returns null for a layer the sprite does not have', () => {
    expect(spriteDraw('decor/lily/0', 'shadow', 0, 0)).toBeNull();
  });

  it('knows how tall a sprite stands', () => {
    expect(spriteTop('place/cafe', data)).toBe(25);
    expect(spriteTop(placeSpriteKey('office'))).toBeGreaterThan(spriteTop(placeSpriteKey('home')));
  });

  it('places the ground with tile (0, 0) on its anchor', () => {
    const g = groundRect();
    expect(g.x).toBeCloseTo(-WORLD_ART.ground.ax / WORLD_ART.ground.res);
    expect(g.w).toBeCloseTo(WORLD_ART.ground.w / WORLD_ART.ground.res);
  });
});

describe('nature on a lot not on offer', () => {
  it('stands inside the footprint, is the same every time, and only uses sprites that exist', () => {
    for (const p of WORLD_PLACES) {
      const n = lotNature(p);
      expect(n.length, p.id).toBeGreaterThanOrEqual(3);
      expect(lotNature(p)).toEqual(n);
      for (const t of n) {
        expect(WORLD_ART.sprites[t.key], t.key).toBeDefined();
        expect(t.x).toBeGreaterThan(p.x);
        expect(t.x).toBeLessThan(p.x + p.w);
        expect(t.y).toBeGreaterThan(p.y);
        expect(t.y).toBeLessThan(p.y + p.d);
      }
    }
  });
});
