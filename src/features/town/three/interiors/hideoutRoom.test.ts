// The learner's own room in Westbay (recipes/hideout.ts; docs/town.md §29): built like the town's rooms, entered alone.
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3, Mesh, type BufferGeometry } from 'three';
import { PERSON_R, TALL_ASPECT, WIDE_ASPECT } from './build';
import { buildInterior, headHeight, INTERIOR_IDS, isInteriorId, OWN_ROOMS } from './rooms';

const room = buildInterior('hideout');

function inFrame(shot: { position: [number, number, number]; target: [number, number, number]; fov: number }, aspect: number, pts: Vector3[]): boolean {
  const cam = new PerspectiveCamera(shot.fov, aspect, 0.05, 100);
  cam.position.set(...shot.position);
  cam.lookAt(new Vector3(...shot.target));
  cam.updateMatrixWorld(true);
  return pts.every((p) => {
    const v = p.clone().project(cam);
    return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1;
  });
}

describe('the hideout room', () => {
  it('is one of the learner\'s own rooms, not one of the town\'s fourteen', () => {
    expect(isInteriorId('hideout')).toBe(true);
    expect(OWN_ROOMS).toContain('hideout');
    expect(INTERIOR_IDS).not.toContain('hideout');
  });

  it('builds finite geometry in a few meshes', () => {
    let meshes = 0;
    room.root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      meshes++;
      const a = (o.geometry as BufferGeometry).getAttribute('position').array;
      for (let i = 0; i < a.length; i++) expect(Number.isFinite(a[i])).toBe(true);
    });
    expect(meshes).toBeGreaterThan(2);
    expect(meshes).toBeLessThan(20);
  });

  it('the learner and the pet stand on the floor, clear of the bed, the wardrobe, the desk and the crate', () => {
    const { W, D } = room.size;
    const g = room.guest;
    const pet = { x: g.x + Math.cos(g.heading - Math.PI / 2) * 0.32 + 0.05, z: g.z + Math.sin(g.heading - Math.PI / 2) * 0.32 + 0.22 };
    for (const [who, a] of [['learner', g], ['pet', pet]] as const) {
      expect(Math.abs(a.x), who).toBeLessThan(W / 2 - PERSON_R);
      expect(Math.abs(a.z), who).toBeLessThan(D / 2 - PERSON_R);
      for (const b of room.blocks) {
        const r = who === 'pet' ? 0.12 : PERSON_R;
        const inside = a.x > b.x0 - r && a.x < b.x1 + r && a.z > b.z0 - r && a.z < b.z1 + r;
        expect(inside, `${who} inside the ${b.what}`).toBe(false);
      }
    }
    expect(room.blocks.map((b) => b.what)).toEqual(expect.arrayContaining(['bed', 'wardrobe', 'crate']));
  });

  it('both shots show the learner whole', () => {
    const g = room.guest;
    const pts = [new Vector3(g.x, 0, g.z), new Vector3(g.x, headHeight(g) + 0.1, g.z)];
    expect(inFrame(room.shot, WIDE_ASPECT, pts)).toBe(true);
    expect(inFrame(room.shotTall, TALL_ASPECT, pts)).toBe(true);
  });

  it('night and small life run', () => {
    room.setNight(1);
    room.update(0.1);
    room.setNight(0);
    room.update(0.1);
  });
});
