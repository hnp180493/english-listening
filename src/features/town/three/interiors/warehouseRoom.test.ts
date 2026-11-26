// Warehouse fifteen's room (recipes/warehouse.ts; docs/town.md §32): built like the town's rooms, entered with a job's people.
import { describe, expect, it } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3, type BufferGeometry } from 'three';
import type { RoomAnchor } from './contracts';
import { PERSON_R, TALL_ASPECT, WIDE_ASPECT } from './build';
import { buildInterior, headHeight, INTERIOR_IDS, isInteriorId, OWN_ROOMS } from './rooms';

const room = buildInterior('warehouse15');

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

describe('warehouse fifteen\'s room', () => {
  it('is entered through enterOwnRoom, not one of the town\'s fourteen', () => {
    expect(isInteriorId('warehouse15')).toBe(true);
    expect(OWN_ROOMS).toContain('warehouse15');
    expect(INTERIOR_IDS).not.toContain('warehouse15');
  });

  it('builds finite geometry in a few meshes, with shelves, the stairs and crates M and N', () => {
    let meshes = 0;
    room.root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      meshes++;
      const a = (o.geometry as BufferGeometry).getAttribute('position').array;
      for (let i = 0; i < a.length; i++) expect(Number.isFinite(a[i])).toBe(true);
    });
    expect(meshes).toBeGreaterThan(2);
    expect(meshes).toBeLessThan(20);
    const what = room.blocks.map((b) => b.what);
    for (const w of ['shelf', 'stairs', 'crate M', 'crate N']) expect(what).toContain(w);
  });

  it('has room for a job\'s people: a host, the learner, a visitor and two more, apart and clear of the furniture', () => {
    const { W, D } = room.size;
    const list: [string, RoomAnchor][] = [['host', room.host], ['learner', room.guest], ['visitor', room.visitor], ...room.extras.map((a, i): [string, RoomAnchor] => [`more ${i}`, a])];
    expect(room.extras.length).toBe(2);
    for (const [who, a] of list) {
      expect(Math.abs(a.x), who).toBeLessThan(W / 2 - PERSON_R);
      expect(Math.abs(a.z), who).toBeLessThan(D / 2 - PERSON_R);
      for (const b of room.blocks) {
        const inside = a.x > b.x0 - PERSON_R && a.x < b.x1 + PERSON_R && a.z > b.z0 - PERSON_R && a.z < b.z1 + PERSON_R;
        expect(inside, `${who} inside the ${b.what}`).toBe(false);
      }
    }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) expect(Math.hypot(list[i][1].x - list[j][1].x, list[i][1].z - list[j][1].z), `${list[i][0]} and ${list[j][0]}`).toBeGreaterThan(0.45);
  });

  it('both shots show the host and the learner whole', () => {
    const pts = [room.host, room.guest].flatMap((a) => [new Vector3(a.x, 0, a.z), new Vector3(a.x, headHeight(a) + 0.1, a.z)]);
    expect(inFrame(room.shot, WIDE_ASPECT, pts)).toBe(true);
    expect(inFrame(room.shotTall, TALL_ASPECT, pts)).toBe(true);
  });

  it('night and small life run', () => {
    room.setNight(1);
    room.update(0.1);
    room.setNight(0);
  });
});
