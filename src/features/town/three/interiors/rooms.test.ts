// The rooms build without a browser (three.js geometry only): every interior gives finite geometry within budget,
// people stand inside the room and out of the furniture, host and guest talk at a natural distance facing each
// other and opened to the camera, and both shots look at their midpoint with both of them in the frame.

import { describe, expect, it } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3, type BufferGeometry } from 'three';
import type { RoomAnchor, RoomShot } from './contracts';
import { PERSON_R, TALL_ASPECT, WIDE_ASPECT, type RoomSet } from './build';
import { buildInterior, entryPath, gazePoint, headHeight, INTERIOR_IDS, isInteriorId } from './rooms';
import { RESIDENT_IDS } from '../characters';
import { episodeVisitor, TOWN_STORIES } from '../../../../data/townStories';

const rooms = new Map<string, RoomSet>(INTERIOR_IDS.map((id) => [id, buildInterior(id)]));

function finite(g: BufferGeometry): void {
  const a = g.getAttribute('position').array;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error('not finite at ' + i);
}

const people = (r: RoomSet): [string, RoomAnchor][] => [
  ['host', r.host],
  ['guest', r.guest],
  ['visitor', r.visitor],
  ...r.extras.map((a, i): [string, RoomAnchor] => [`extra ${i}`, a]),
];

const angle = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};

function inFrame(shot: RoomShot, aspect: number, pts: Vector3[]): boolean {
  const cam = new PerspectiveCamera(shot.fov, aspect, 0.05, 100);
  cam.position.set(...shot.position);
  cam.lookAt(new Vector3(...shot.target));
  cam.updateMatrixWorld(true);
  return pts.every((p) => {
    const v = p.clone().project(cam);
    return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1;
  });
}

describe('interiors', () => {
  it('has a room for every place of the town and the boarding house', () => {
    expect(INTERIOR_IDS).toHaveLength(14);
    for (const id of RESIDENT_IDS) expect(isInteriorId(id)).toBe(true);
    expect(isInteriorId('inn')).toBe(true);
    expect(isInteriorId('moon')).toBe(false);
  });

  it.each(INTERIOR_IDS)('%s builds finite geometry within budget', (id) => {
    const r = rooms.get(id)!;
    expect(r.id).toBe(id);
    let meshes = 0;
    r.root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      meshes++;
      finite(m.geometry);
    });
    expect(meshes).toBeGreaterThan(4);
    expect(r.stats.triangles).toBeLessThan(60000);
    // draw calls of the room alone (characters add 2 each); shadow passes add the casting ones
    expect(r.stats.meshes).toBeLessThanOrEqual(24);
  });

  it('builds a room fast once the shared shapes exist', () => {
    const times: number[] = [];
    for (const id of INTERIOR_IDS) {
      const r = buildInterior(id);
      times.push(r.stats.buildMs);
      r.dispose();
    }
    times.sort((a, b) => a - b);
    // the browser builds a room in 7–19 ms (harness, 2026-11-21); a loaded test run gets a wide margin, so a timing
    // test never fails by chance
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(120);
  });

  it.each(INTERIOR_IDS)('%s: people stand inside the room, out of the furniture and out of each other', (id) => {
    const r = rooms.get(id)!;
    const { W, D } = r.size;
    const list = people(r);
    for (const [who, a] of list) {
      expect(Math.abs(a.x), `${who} x`).toBeLessThan(W / 2 - PERSON_R);
      expect(Math.abs(a.z), `${who} z`).toBeLessThan(D / 2 - PERSON_R);
      expect(Number.isFinite(a.heading)).toBe(true);
      if (a.pose === 'sit') {
        expect(a.seatY, `${who} seat`).toBeGreaterThan(0.1);
        expect(a.seatY!).toBeLessThan(0.33);
        expect(r.seats.some((s) => Math.hypot(s.x - a.x, s.z - a.z) < 1e-6), `${who} on a seat`).toBe(true);
        continue;
      }
      for (const b of r.blocks) {
        const inside = a.x > b.x0 - PERSON_R && a.x < b.x1 + PERSON_R && a.z > b.z0 - PERSON_R && a.z < b.z1 + PERSON_R;
        expect(inside, `${who} at (${a.x.toFixed(2)}, ${a.z.toFixed(2)}) inside the ${b.what}`).toBe(false);
      }
    }
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [wa, a] = list[i];
        const [wb, b] = list[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${wa} and ${wb} too close`).toBeGreaterThan(0.45);
      }
  });

  it.each(INTERIOR_IDS)('%s: host and guest talk at a natural distance, facing each other, opened to the camera', (id) => {
    const r = rooms.get(id)!;
    const { host, guest, shot } = r;
    const d = Math.hypot(guest.x - host.x, guest.z - host.z);
    expect(d).toBeGreaterThan(0.85);
    expect(d).toBeLessThan(1.25);
    expect(angle(host.heading, Math.atan2(guest.z - host.z, guest.x - host.x))).toBeLessThan(1.0);
    expect(angle(guest.heading, Math.atan2(host.z - guest.z, host.x - guest.x))).toBeLessThan(1.15);
    // their fronts are towards the camera (faces, not backs)
    for (const a of [host, guest]) expect(angle(a.heading, Math.atan2(shot.position[2] - a.z, shot.position[0] - a.x))).toBeLessThan(Math.PI / 2);
  });

  it.each(INTERIOR_IDS)('%s: both shots look at the host/guest midpoint with both in the frame', (id) => {
    const r = rooms.get(id)!;
    const mx = (r.host.x + r.guest.x) / 2;
    const mz = (r.host.z + r.guest.z) / 2;
    for (const [shot, aspect] of [
      [r.shot, WIDE_ASPECT],
      [r.shotTall, TALL_ASPECT],
    ] as const) {
      expect(shot.target[0]).toBeCloseTo(mx, 6);
      expect(shot.target[2]).toBeCloseTo(mz, 6);
      expect(shot.target[1]).toBeGreaterThan(0.3);
      expect(shot.target[1]).toBeLessThan(0.7);
      expect(shot.position[1]).toBeGreaterThan(shot.target[1]);
      expect(shot.fov).toBeGreaterThan(20);
      expect(shot.fov).toBeLessThan(50);
      // the camera stands on the open side, outside the walls
      expect(shot.position[2]).toBeGreaterThan(r.size.D / 2 - 1);
      const pts = [r.host, r.guest].flatMap((a) => [new Vector3(a.x, 0.02, a.z), new Vector3(a.x, 0.8, a.z)]);
      expect(inFrame(shot, aspect, pts), aspect > 1 ? 'wide' : 'tall').toBe(true);
    }
    // the wide shot shows the room behind them: the back wall's foot is in the picture
    expect(inFrame(r.shot, WIDE_ASPECT, [new Vector3(mx, r.size.H * 0.4, -r.size.D / 2 + 0.05)])).toBe(true);
  });

  it('gaze points sit between the other head and the camera', () => {
    const r = rooms.get('cafe')!;
    const g = gazePoint(r.host, r.shot);
    expect(g[1]).toBeGreaterThan(headHeight(r.host) - 0.01);
    expect(Math.hypot(g[0] - r.host.x, g[2] - r.host.z)).toBeGreaterThan(0.2);
    expect(headHeight({ x: 0, z: 0, heading: 0, pose: 'sit', seatY: 0.18 })).toBeLessThan(0.62);
  });

  it('night, small life and dispose run without errors', () => {
    const r = buildInterior('cafe');
    for (const k of [0, 0.3, 0.7, 1]) r.setNight(k);
    for (let i = 0; i < 120; i++) r.update(1 / 60);
    expect(r.background.getHex()).not.toBe(0);
    r.update(-1);
    r.update(10);
    r.dispose();
    expect(r.root.parent).toBeNull();
  });
});

describe('a neighbour who drops in walks in (docs/town.md §7 Staging)', () => {
  it('only rooms with a clear way in have a neighbour in person', () => {
    const rooms = new Set<string>();
    for (const e of TOWN_STORIES) {
      if (!episodeVisitor(e)) continue;
      for (const s of [e.setting, e.lodgerSetting]) if (s?.kind === 'inside') rooms.add(s.room);
    }
    expect([...rooms].sort()).not.toContain('park');
    expect(rooms.size).toBeGreaterThan(0);
  });
  for (const [id, r] of rooms) {
    it(`${id}: a short way in from outside an open side, past no furniture and nobody`, () => {
      const a = r.visitor;
      // (the park, outdoors among its beds, never has a neighbour in person: checked above)
      if (id === 'park') return;
      // either side (the stage takes the left one when a panel is docked at the right), and with no side the nearer
      const ways = (['z', 'x', undefined] as const).map((side) => entryPath({ ...r, outdoor: false }, a, side));
      expect(ways[2]).not.toBeNull();
      const { W, D } = r.size;
      ways.forEach((w, side) => {
        if (!w) return;
        // from outside the room on its open side (+X or +Z), never through a back wall, to the anchor
        expect(w[0].x > W / 2 || w[0].z > D / 2).toBe(true);
        expect(w[w.length - 1]).toEqual({ x: a.x, z: a.z });
        let len = 0;
        for (let i = 1; i < w.length; i++) {
          const p = w[i - 1];
          const q = w[i];
          len += Math.hypot(q.x - p.x, q.z - p.z);
          const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.02);
          for (let k = 0; k <= n; k++) {
            const x = p.x + ((q.x - p.x) * k) / n;
            const z = p.z + ((q.z - p.z) * k) / n;
            expect(x, 'back wall').toBeGreaterThan(-W / 2 + 0.15);
            expect(z, 'back wall').toBeGreaterThan(-D / 2 + 0.15);
            for (const b of r.blocks) {
              const d = Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
              expect(d, `${b.what} at ${x.toFixed(2)},${z.toFixed(2)}`).toBeGreaterThanOrEqual(0.15);
            }
            if (Math.hypot(x - a.x, z - a.z) > 0.4) for (const o of [r.host, r.guest, ...r.extras]) expect(Math.hypot(o.x - x, o.z - z)).toBeGreaterThan(0.34);
          }
        }
        // a short entrance (about three seconds at most; a side of its own a little longer)
        expect(len).toBeLessThan(side === 2 ? 4.6 : 5.6);
      });
    });
  }
});
