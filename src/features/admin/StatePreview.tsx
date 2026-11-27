// "Rà trạng thái nhân vật" on the admin page (dev server only): the game's own anime avatars (the same `wearVrm` and
// `vrmFor` the town uses, not a stripped body) in every state the game puts a person in, each seen from the front and
// from the side, large enough to see the hands: holding each thing (chars/props.ts), an umbrella (scene/umbrellas.ts,
// drawn as the town draws it), talking, the one-shots, seated on a street bench and in a room, on each vehicle (its
// model under them, placed as engine3d places it), each hat of the wardrobe, an outfit colour, a pet beside them. Four
// figures: the learner as a man and as a woman, an old body (Grace), a child. `town-shot.mjs` pictures run with
// reduced motion: nothing here waits for time to pass, each pose is stepped to its moment by hand.
//
// `…?states` shows the first half, `…?states2` the second (one picture each: the software renderer is slow).

import { useEffect, useRef } from 'react';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import { vrmFor } from '../../data/townVrm';
import { createPet } from '../town/three/characters';
import { HAT_IDS, passerLook, profileLook } from '../town/three/chars/looks';
import { createPerson, type Character3DPlus } from '../town/three/chars/person';
import { wearVrm } from '../town/three/chars/vrmBody';
import type { CharAction, CharacterLook } from '../town/three/contracts';
import { canvasOf, charStudio, paint } from '../town/three/offscreen';
import { buildFurniture, type FurnitureId } from '../town/three/scene/furniture';
import { SEAT_TOP } from '../town/three/scene/props3d';
import { Umbrellas } from '../town/three/scene/umbrellas';
import { poseRide, RIDES, rideLift, vehicleMesh } from '../town/three/scene/vehicles3d';

type VehicleKind = keyof typeof RIDES;

/** The four figures: the learner both ways, an old body, a child. */
const FIGURES: readonly { id: string; name: string; look?: CharacterLook }[] = [
  { id: 'player-m', name: 'Người chơi nam', look: profileLook({ gender: 'male', skin: '#f1cba9', hair: 'spiky', hairColor: '#d36f4c' }) },
  { id: 'player-f', name: 'Người chơi nữ', look: profileLook({ gender: 'female', skin: '#b47a52', hair: 'long', hairColor: '#3b2a22' }) },
  { id: 'home', name: 'Grace' },
  { id: 'kid1', name: 'Trẻ con', look: passerLook(5, true) },
];

interface State {
  name: string;
  action: CharAction;
  /** How far into the action (s), stepped by hand. */
  at: number;
  /** Walking at this pace while it is stepped (tiles/s). */
  speed?: number;
  umbrella?: boolean;
  bench?: FurnitureId;
  /** Seated in a room (its people are 1.25 × for its furniture: roomStage.ts ROOM_GROW). */
  room?: boolean;
  ride?: VehicleKind;
  hat?: string;
  outfit?: string;
  pet?: string;
  /** Framed on the head (a hat). */
  head?: boolean;
}

const STATES: readonly State[] = [
  { name: 'Đứng', action: 'idle', at: 1 },
  { name: 'Cầm cốc', action: 'drink', at: 0.9 },
  { name: 'Uống', action: 'drink', at: 1.9 },
  { name: 'Tưới cây', action: 'water', at: 2 },
  { name: 'Câu cá', action: 'fish', at: 2.5 },
  { name: 'Đọc sách', action: 'read', at: 2.2 },
  { name: 'Che ô', action: 'idle', at: 1.2, umbrella: true },
  { name: 'Che ô, đi', action: 'walk', at: 1.3, speed: 1.6, umbrella: true },
  { name: 'Nói chuyện', action: 'talk', at: 1.1 },
  { name: 'Vẫy tay', action: 'wave', at: 0.8 },
  { name: 'Reo mừng', action: 'cheer', at: 0.6 },
  { name: 'Gật đầu', action: 'yes', at: 0.45 },
  { name: 'Lắc đầu', action: 'no', at: 0.5 },
  { name: 'Ghế công viên', action: 'sit', at: 1.5, bench: 'bench-park' },
  { name: 'Ghế đá', action: 'sit', at: 1.5, bench: 'bench-stone' },
  { name: 'Ghế trong phòng', action: 'sit', at: 1.5, bench: 'bench-log', room: true },
  { name: 'Xe đạp', action: 'sit', at: 1.5, ride: 'bike' },
  { name: 'Xe máy thuê', action: 'sit', at: 1.5, ride: 'scooter' },
  { name: 'Mô tô', action: 'sit', at: 1.5, ride: 'motorbike' },
  { name: 'Ngựa', action: 'sit', at: 1.5, ride: 'horse' },
  { name: 'Ô tô', action: 'sit', at: 1.5, ride: 'car' },
  { name: 'Siêu xe', action: 'sit', at: 1.5, ride: 'sportscar' },
  { name: 'Thú cưng', action: 'idle', at: 1, pet: 'dog' },
  { name: 'Áo đỏ (Tủ đồ)', action: 'idle', at: 1, outfit: '#c8473d' },
  ...HAT_IDS.map((hat): State => ({ name: hat, action: 'idle', at: 1, hat, head: true })),
];

const HALF = Math.ceil(STATES.length / 2);

/** `…?horse`: the horse side on, eight frames of a cycle of each gait, without and with a rider (scene/horse3d.ts). */
const HORSE = typeof window !== 'undefined' && window.location.hash.includes('horse');
const HORSE_ROWS: readonly { name: string; speed: number; rider: boolean }[] = [
  { name: 'Đứng', speed: 0, rider: false },
  { name: 'Đi bước 1,0', speed: 1, rider: false },
  { name: 'Kiệu 2,4', speed: 2.4, rider: false },
  { name: 'Phi 4,4', speed: 4.4, rider: false },
  { name: 'Đi bước 1,0', speed: 1, rider: true },
  { name: 'Phi 4,4', speed: 4.4, rider: true },
];
const HW = 210;
const HH = 170;

/** One row: a horse (and its rider) stepped through a cycle, a picture every eighth of it. */
async function drawHorseRow(row: (typeof HORSE_ROWS)[number], canvases: (HTMLCanvasElement | null)[]): Promise<void> {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  const horse = vehicleMesh('horse', 0, mat)!;
  horse.rotation.y = -Math.PI / 2;
  const group = new Group();
  group.add(horse);
  let ch: Character3DPlus | null = null;
  if (row.rider) {
    const f = FIGURES[0];
    ch = createPerson(f.id, f.look) as Character3DPlus;
    const who = vrmFor(f.id, ch.look, import.meta.env.BASE_URL);
    await wearVrm(ch, who.url, who);
    ch.setHeading(Math.PI / 2, true);
    ch.ride = 'horse';
    ch.setAction('sit');
    group.add(ch.root);
  }
  const step = (t: number, dt: number) => {
    poseRide(horse, t, row.speed, false);
    if (ch) {
      ch.setSeatHeight((RIDES.horse.seatSlim ?? RIDES.horse.seat) + rideLift(horse));
      ch.update(dt, row.speed);
    }
  };
  let t = 0;
  for (; t < 2; t += 1 / 60) step(t, 1 / 60);
  // the stride of the gait at this speed (horse3d.ts GAITS): a cycle's length in time
  const stride = row.speed >= 3.2 ? 1.5 : row.speed >= 1.4 ? 0.95 : 0.55;
  const cycle = row.speed > 0 ? stride / row.speed : 4;
  const st = charStudio();
  st.scene.add(group);
  const cam = st.camera;
  cam.fov = 24;
  cam.aspect = HW / HH;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (let k = 0; k < canvases.length; k++) {
    for (const end = t + cycle / canvases.length; t < end - 1e-9; t += 1 / 240) step(t, 1 / 240);
    group.updateMatrixWorld(true);
    box.setFromObject(group, true);
    box.getCenter(mid);
    box.getSize(size);
    const span = Math.max(size.y, size.z / (HW / HH)) * 1.15;
    const dist = (span * 0.5) / Math.tan((cam.fov * Math.PI) / 360);
    // side on, a little from above
    cam.position.set(mid.x + dist, mid.y + dist * 0.1, mid.z);
    cam.near = 0.02;
    cam.far = dist * 6 + 10;
    cam.lookAt(mid);
    cam.updateProjectionMatrix();
    const out = canvasOf(HW * dpr, HH * dpr);
    const ok = paint(st, out);
    const c = canvases[k];
    const ctx = c?.getContext('2d');
    if (ok && c && ctx) {
      c.width = out.width;
      c.height = out.height;
      ctx.drawImage(out, 0, 0);
    }
  }
  st.scene.remove(group);
  ch?.dispose();
  mat.dispose();
}
const hash = typeof window !== 'undefined' ? window.location.hash : '';
const SHOWN = HORSE ? [] : hash.includes('states2') ? STATES.slice(HALF) : hash.includes('states') ? STATES.slice(0, HALF) : [];

const W = 128;
const H = 180;
const box = new Box3();
const mid = new Vector3();
const size = new Vector3();

/** One state of one figure, seen from the front and from the side. */
async function drawState(fig: (typeof FIGURES)[number], s: State, canvases: (HTMLCanvasElement | null)[]): Promise<void> {
  const ch = (fig.look ? createPerson(fig.id, fig.look) : createPerson(fig.id)) as Character3DPlus;
  const who = vrmFor(fig.id, ch.look, import.meta.env.BASE_URL);
  await wearVrm(ch, who.url, s.room ? { ...who, tall: (who.tall ?? 1) * 1.25 } : who);
  // facing +z (the front view looks from +z)
  ch.setHeading(Math.PI / 2, true);
  if (s.hat) ch.setHat(s.hat);
  if (s.outfit) ch.setOutfit(s.outfit);
  const extra: Object3D[] = [];
  const geos: { dispose(): void }[] = [];
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  if (s.bench) {
    // where the sim seats a person: the seat's middle and SEAT_FORWARD along their heading (engine3d.ts)
    const f = buildFurniture(s.bench);
    if (f.body) {
      const m = new Mesh(f.body, mat);
      m.position.set(0, 0, -0.08);
      if (s.room) m.scale.setScalar(1.25);
      extra.push(m);
      geos.push(f.body);
    }
    ch.setSeatHeight(SEAT_TOP * (s.room ? 1.25 : 1));
  }
  if (s.ride) {
    // the vehicle under its rider as engine3d.ts places it (seatOffset, seatHeight; avatars: seatSlim, seatBack, side)
    const spec = RIDES[s.ride];
    const m = vehicleMesh(s.ride, 0, mat);
    if (m) {
      const along = spec.seatAt - (spec.seatBack ?? 0);
      const side = spec.side ?? 0;
      m.position.set(side, 0, -along);
      m.rotation.y = -Math.PI / 2;
      extra.push(m);
      geos.push(m.geometry);
    }
    ch.ride = s.ride;
    ch.setSeatHeight(spec.seatSlim ?? spec.seat);
  }
  if (s.umbrella) ch.animator.umbrellaWant = true;
  ch.setAction(s.action);
  const dt = 1 / 60;
  for (let t = 0; t < s.at; t += dt) {
    if (s.speed) ch.root.position.z += s.speed * dt;
    ch.update(dt, s.speed ?? 0);
  }
  ch.root.position.set(0, 0, 0);
  const st = charStudio();
  const group = new Group();
  group.add(ch.root, ...extra);
  let umbrellas: Umbrellas | null = null;
  if (s.umbrella) {
    umbrellas = new Umbrellas();
    group.add(umbrellas.mesh);
  }
  let pet = null;
  if (s.pet) {
    pet = createPet(s.pet);
    pet.root.position.set(0.45, 0, 0.1);
    pet.setHeading(Math.PI / 2, true);
    pet.update(0.1, 0);
    group.add(pet.root);
  }
  st.scene.add(group);
  group.updateMatrixWorld(true);
  if (umbrellas) {
    umbrellas.begin();
    const at = ch.umbrella();
    if (at) umbrellas.add(at, fig.id);
    umbrellas.end();
  }
  // framed on the person (and what they sit on or ride), or on the head for a hat
  box.makeEmpty();
  if (s.head) {
    const top = ch.headTop(new Vector3());
    box.setFromCenterAndSize(new Vector3(0, top.y - 0.12, 0), new Vector3(0.36, 0.36, 0.36));
  } else {
    box.expandByObject(ch.root, true);
    for (const e of extra) box.expandByObject(e, true);
    if (pet) box.expandByObject(pet.root, true);
    if (umbrellas && umbrellas.mesh.count > 0) box.expandByPoint(ch.umbrella()!.getWorldPosition(new Vector3()).add(new Vector3(0, 0.75 * ch.headTop(new Vector3()).y, 0)));
  }
  box.getCenter(mid);
  box.getSize(size);
  const cam = st.camera;
  cam.fov = 24;
  cam.aspect = W / H;
  const span = Math.max(size.y, size.x / (W / H), size.z / (W / H)) * 1.12;
  const dist = (span * 0.5) / Math.tan((cam.fov * Math.PI) / 360);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const [k, yaw] of [Math.PI / 2 - 0.35, 0.05].entries()) {
    const c = canvases[k];
    if (!c) continue;
    cam.position.set(mid.x + Math.cos(yaw) * dist, mid.y + dist * 0.12, mid.z + Math.sin(yaw) * dist);
    cam.near = 0.02;
    cam.far = dist * 6 + 10;
    cam.lookAt(mid);
    cam.updateProjectionMatrix();
    const out = canvasOf(W * dpr, H * dpr);
    const ok = paint(st, out);
    const ctx = c.getContext('2d');
    if (ok && ctx) {
      c.width = out.width;
      c.height = out.height;
      ctx.drawImage(out, 0, 0);
    }
  }
  st.scene.remove(group);
  umbrellas?.dispose();
  pet?.dispose();
  ch.dispose();
  for (const g of geos) g.dispose();
  mat.dispose();
}

export default function StatePreview() {
  const cells = useRef<(HTMLCanvasElement | null)[]>([]);
  const horseCells = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    const live = { gone: false };
    void (async () => {
      for (let i = 0; HORSE && i < HORSE_ROWS.length && !live.gone; i++) {
        try {
          await drawHorseRow(HORSE_ROWS[i], horseCells.current.slice(i * 8, i * 8 + 8));
        } catch (e) {
          console.warn('horse', HORSE_ROWS[i].name, e);
        }
      }
      for (let i = 0; i < SHOWN.length && !live.gone; i++) {
        for (let f = 0; f < FIGURES.length && !live.gone; f++) {
          const k = (i * FIGURES.length + f) * 2;
          try {
            await drawState(FIGURES[f], SHOWN[i], [cells.current[k], cells.current[k + 1]]);
          } catch (e) {
            console.warn('state', SHOWN[i].name, FIGURES[f].id, e);
          }
        }
      }
      document.body.dataset.statesDone = '1';
    })();
    return () => {
      live.gone = true;
    };
  }, []);
  if (HORSE)
    return (
      <div className="adm-states" style={{ display: 'grid', gap: 6 }}>
        {HORSE_ROWS.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ width: 110 }}>
              {r.name}
              {r.rider ? ' · có người cưỡi' : ''}
            </span>
            {Array.from({ length: 8 }, (_, k) => (
              <canvas key={k} ref={(el) => void (horseCells.current[i * 8 + k] = el)} className="adm-pic" style={{ width: HW * 0.62, height: HH * 0.62 }} />
            ))}
          </div>
        ))}
      </div>
    );
  if (SHOWN.length === 0) return <p className="adm-note">Thêm ?states hoặc ?states2 vào địa chỉ để xem.</p>;
  return (
    <div className="adm-states">
      <div style={{ display: 'grid', gridTemplateColumns: `110px repeat(${FIGURES.length}, ${2 * W + 8}px)`, gap: 6, alignItems: 'center' }}>
        <span />
        {FIGURES.map((f) => (
          <strong key={f.id}>{f.name}</strong>
        ))}
        {SHOWN.map((s, i) => [
          <span key={s.name}>{s.name}</span>,
          ...FIGURES.map((f, j) => (
            <div key={s.name + f.id} style={{ display: 'flex', gap: 4 }}>
              {[0, 1].map((v) => (
                <canvas key={v} ref={(el) => void (cells.current[(i * FIGURES.length + j) * 2 + v] = el)} className="adm-pic" style={{ width: W, height: H }} />
              ))}
            </div>
          )),
        ])}
      </div>
    </div>
  );
}
