// "Xem thử: nhân vật mô hình thật" on the admin page (owner, 2026-11-26: "so sánh cũ mới rồi tao mới biết đường chọn
// chứ … làm 2,3 nhân vật thôi"). Three residents as they are now beside two candidates: Quaternius' Ultimate Modular
// Men / Women (2022, CC0) and pixiv's VRoid sample avatars (anime, VRM 0.0; their conditions of use allow commercial
// use and redistribution). The files sit in .assets-try and are read by the DEV server only: a TRIAL, nothing of it
// is in the game or in a build. A VRM is read with the plain GLTFLoader here (no three-vrm yet): its materials come
// out unlit and it stands with its arms lowered by hand, so the real thing would look a little better (toon shading,
// outline, expressions).

import { useEffect, useRef, useState } from 'react';
import { AnimationMixer, Box3, Color, Vector3, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { townPlace } from '../../data/town';
import { castLook } from '../town/three/chars/looks';
import { renderLook } from '../town/three/chars/lookPreview';
import { canvasOf, charStudio, paint } from '../town/three/offscreen';
import { createPerson } from '../town/three/chars/person';
import { wearVrm } from '../town/three/chars/vrmBody';
import type { CharAction } from '../town/three/contracts';
import { VRM_IDS, vrmFor } from '../../data/townVrm';
import { HAT_IDS, passerLook, profileLook } from '../town/three/chars/looks';
import type { CharacterLook } from '../town/three/contracts';

const BASE = '/.assets-try/';

/** Who is compared: a resident, the Modular body and the VRoid sample that come closest. */
const ROWS: readonly { id: string; modular: string; vroid: string }[] = [
  { id: 'cafe', modular: 'qmod/W_Casual.gltf', vroid: 'vroid/AvatarSample_A.vrm' },
  { id: 'school', modular: 'qmod/M_Suit.gltf', vroid: 'vroid/AvatarSample_C.vrm' },
  { id: 'cinema', modular: 'qmod/W_Formal.gltf', vroid: 'vroid/AvatarSample_B.vrm' },
];

const box = new Box3();
const at = new Vector3();
const loader = new GLTFLoader();
const files = new Map<string, Promise<GLTF>>();
const load = (path: string) => {
  let p = files.get(path);
  if (!p) files.set(path, (p = loader.loadAsync(BASE + path)));
  return p;
};

function eachMaterial(root: Object3D, fn: (m: MeshStandardMaterial) => void): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]) fn(m as MeshStandardMaterial);
  });
}

interface VrmJson {
  extensions?: { VRM?: { humanoid?: { humanBones?: { bone: string; node: number }[] } } };
}

/** A VRM 0.x stands in a T and looks away from +z: turned round, its arms brought down. Returns its head's height. */
async function poseVrm(g: GLTF): Promise<number | null> {
  const bones = (g.parser.json as VrmJson).extensions?.VRM?.humanoid?.humanBones;
  if (!bones) return null;
  g.scene.rotation.y = Math.PI;
  const node = async (name: string) => {
    const b = bones.find((x) => x.bone === name);
    return b ? ((await g.parser.getDependency('node', b.node)) as Object3D) : null;
  };
  const [l, r, head] = await Promise.all([node('leftUpperArm'), node('rightUpperArm'), node('head')]);
  if (l) l.rotation.z = 1.2;
  if (r) r.rotation.z = -1.2;
  g.scene.updateMatrixWorld(true);
  return head ? head.getWorldPosition(at).y : null;
}

/** One picture: the whole body, or the face close. `tint`: the resident's own skin and hair on a Quaternius body. */
async function draw(path: string, c: HTMLCanvasElement, w: number, h: number, face: boolean, tint?: { skin: string; hair: string }): Promise<void> {
  const g = await load(path);
  const root = g.scene;
  const kept = new Map<MeshStandardMaterial, Color>();
  eachMaterial(root, (m) => {
    if ('roughness' in m) {
      m.roughness = 1;
      m.metalness = 0;
    }
    if (!tint) return;
    if (m.name === 'Skin' || m.name.startsWith('Hair')) {
      kept.set(m, m.color.clone());
      m.color.set(m.name === 'Skin' ? tint.skin : tint.hair);
    }
  });
  const mixer = new AnimationMixer(root);
  // (the pack's people hold a pistol in some poses: put away)
  root.traverse((o) => {
    if (o.name === 'Pistol') o.visible = false;
  });
  const idle = g.animations.find((a) => a.name === 'Idle_Neutral') ?? g.animations.find((a) => a.name === 'Idle');
  if (idle) {
    mixer.clipAction(idle).play();
    mixer.setTime(0.3);
  }
  const headY = path.endsWith('.vrm') ? await poseVrm(g) : null;
  const st = charStudio();
  st.scene.add(root);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  const tall = box.max.y - box.min.y;
  const cam = st.camera;
  cam.aspect = w / h;
  cam.fov = 24;
  // the face: about a fifth of the body's height round the head; the body: all of it
  const mid = face ? (headY !== null ? headY + tall * 0.035 : box.min.y + tall * 0.9) : (box.max.y + box.min.y) / 2;
  const span = face ? tall * 0.24 : tall;
  const dist = (span * 0.5) / Math.tan((cam.fov * Math.PI) / 360) / 0.86;
  const yaw = Math.PI / 2 - (face ? 0.25 : 0.35);
  cam.position.set(Math.cos(yaw) * dist, mid + dist * (face ? 0.03 : 0.1), Math.sin(yaw) * dist);
  cam.near = dist * 0.05;
  cam.far = dist * 6;
  cam.lookAt(0, mid, 0);
  cam.updateProjectionMatrix();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const out = canvasOf(w * dpr, h * dpr);
  const ok = paint(st, out);
  st.scene.remove(root);
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  for (const [m, col] of kept) m.color.copy(col);
  const ctx = c.getContext('2d');
  if (!ok || !ctx) return;
  c.width = out.width;
  c.height = out.height;
  ctx.drawImage(out, 0, 0);
}

/** The avatar in the game's own actions (the code body's Animator drives it: chars/vrmBody.ts). */
interface Act {
  name: string;
  action: CharAction;
  speed: number;
  seconds: number;
  /** Seated on a vehicle (scene/vehicles3d.ts): its kind and its seat's height in tiles. */
  ride?: string;
  seat?: number;
  /** A hat of the wardrobe (chars/hats.ts). */
  hat?: string;
}

/** `…?gait` in the address: a stride and a turn of the pedals frame by frame, and each vehicle's seat. */
const GAIT = typeof window !== 'undefined' && window.location.hash.includes('gait');
const strip = (name: string, action: CharAction, speed: number, from: number, step: number, n: number, ride?: string, seat?: number): Act[] =>
  Array.from({ length: n }, (_, k) => ({ name: `${name} ${k + 1}`, action, speed, seconds: from + k * step, ride, seat }));

/** `…?worn` in the address: things held and hats of the wardrobe on an avatar. */
const WORN = typeof window !== 'undefined' && window.location.hash.includes('worn');

const ACTIONS: readonly Act[] = WORN
  ? [
      { name: 'cup', action: 'drink', speed: 0, seconds: 2.2 },
      { name: 'can', action: 'water', speed: 0, seconds: 2.2 },
      { name: 'rod', action: 'fish', speed: 0, seconds: 2.5 },
      { name: 'book', action: 'read', speed: 0, seconds: 2.2 },
      ...HAT_IDS.slice(0, 6).map((hat): Act => ({ name: hat, action: 'idle', speed: 0, seconds: 0.8, hat })),
    ]
  : GAIT
  ? [
      ...strip('Chạy', 'run', 2.8, 1.3, 0.055, 6),
      ...strip('Đi', 'walk', 1.6, 1.3, 0.09, 4),
      ...strip('Xe đạp', 'sit', 3.6, 1.0, 0.07, 6, 'bike', 0.62),
      { name: 'Xe máy', action: 'sit', speed: 0, seconds: 1, ride: 'scooter', seat: 0.56 },
      { name: 'Ngựa', action: 'sit', speed: 0, seconds: 1, ride: 'horse', seat: 0.96 },
      { name: 'Ô tô', action: 'sit', speed: 0, seconds: 1, ride: 'car', seat: 0.34 },
    ]
  : [
      { name: 'Đứng', action: 'idle', speed: 0, seconds: 1.2 },
      { name: 'Đi', action: 'walk', speed: 1.6, seconds: 1.3 },
      { name: 'Chạy', action: 'run', speed: 2.8, seconds: 1.3 },
      { name: 'Ngồi', action: 'sit', speed: 0, seconds: 1.5 },
      { name: 'Nói', action: 'talk', speed: 0, seconds: 1.1 },
      { name: 'Vẫy tay', action: 'wave', speed: 0, seconds: 0.8 },
      { name: 'Reo mừng', action: 'cheer', speed: 0, seconds: 0.7 },
    ];

async function drawAction(c: HTMLCanvasElement, a: Act, w: number, h: number, side: boolean): Promise<void> {
  const ch = createPerson('cafe');
  await wearVrm(ch, import.meta.env.BASE_URL + 'vrm/school.vrm?acts');
  ch.setHeading(Math.PI / 2, true);
  if (a.hat) ch.setHat(a.hat);
  if (a.ride) {
    ch.ride = a.ride;
    ch.setSeatHeight(a.seat ?? 0.18);
  }
  ch.setAction(a.action);
  // (the Animator plants the feet in the world: a walk shows only when the body really moves)
  for (let t = 0; t < a.seconds; t += 1 / 60) {
    if (!a.ride) ch.root.position.z += a.speed / 60;
    ch.update(1 / 60, a.speed);
  }
  ch.root.position.set(0, 0, 0);
  const st = charStudio();
  st.scene.add(ch.root);
  ch.root.updateMatrixWorld(true);
  const cam = st.camera;
  cam.aspect = w / h;
  cam.fov = 24;
  const tall = 1.7;
  const dist = (tall * 0.5) / Math.tan((cam.fov * Math.PI) / 360) / 0.86;
  const yaw = side ? 0.12 : Math.PI / 2 - 0.5;
  cam.position.set(Math.cos(yaw) * dist, 0.8 + dist * 0.12, Math.sin(yaw) * dist);
  cam.near = 0.05;
  cam.far = 30;
  cam.lookAt(0, 0.72, 0);
  cam.updateProjectionMatrix();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const out = canvasOf(w * dpr, h * dpr);
  const ok = paint(st, out);
  st.scene.remove(ch.root);
  ch.dispose();
  const ctx = c.getContext('2d');
  if (!ok || !ctx) return;
  c.width = out.width;
  c.height = out.height;
  ctx.drawImage(out, 0, 0);
}

/** Every VRoid sample fetched (`…?bases` in the address shows them all, body and face). */
const BASES = ['AvatarSample_A', 'AvatarSample_B', 'AvatarSample_C', 'HairSample_Female', 'HairSample_Male', 'Sakurada_Fumiriya', 'Sendagaya_Shibu', 'Darkness_Shibu', 'Sendagaya_Shino', 'Victoria_Rubin', 'Vita', 'Vivi'] as const;
const SHOW_BASES = typeof window !== 'undefined' && window.location.hash.includes('bases');

/** People without a file of their own, for the sheet: the learner as made, passers-by, children. */
const OTHERS: Record<string, CharacterLook> = {
  player: castLook('player'),
  'player-f': profileLook({ gender: 'female', skin: '#b47a52', hair: 'long', hairColor: '#3b2a22' }),
  'player-m': profileLook({ gender: 'male', skin: '#f1cba9', hair: 'spiky', hairColor: '#d36f4c' }),
  passer1: passerLook(3),
  passer2: passerLook(10),
  passer3: passerLook(17),
  passer4: passerLook(24),
  passer5: passerLook(31),
  kid1: passerLook(5, true),
  kid2: passerLook(12, true),
};
const CAST_IDS: readonly string[] = [...VRM_IDS, ...Object.keys(OTHERS)];

/** `…?cast` in the address: every resident in the avatar baked for them (public/vrm), body and face. */
const SHOW_CAST = typeof window !== 'undefined' && window.location.hash.includes('cast');

async function drawResident(id: string, c: HTMLCanvasElement, w: number, h: number, face: boolean): Promise<void> {
  const ch = OTHERS[id] ? createPerson(id, OTHERS[id]) : createPerson(id);
  const who = vrmFor(id, ch.look, import.meta.env.BASE_URL);
  await wearVrm(ch, who.url, who);
  ch.setHeading(Math.PI / 2, true);
  for (let t = 0; t < 0.6; t += 1 / 60) ch.update(1 / 60, 0);
  const st = charStudio();
  st.scene.add(ch.root);
  ch.root.updateMatrixWorld(true);
  const top = ch.headTop(at.set(0, 0, 0)).y;
  const cam = st.camera;
  cam.aspect = w / h;
  cam.fov = 24;
  const span = face ? top * 0.26 : top * 1.06;
  const mid = face ? top * 0.9 : top * 0.5;
  const dist = (span * 0.5) / Math.tan((cam.fov * Math.PI) / 360) / 0.9;
  const yaw = Math.PI / 2 - (face ? 0.3 : 0.4);
  cam.position.set(Math.cos(yaw) * dist, mid + dist * (face ? 0.04 : 0.1), Math.sin(yaw) * dist);
  cam.near = 0.02;
  cam.far = 30;
  cam.lookAt(0, mid, 0);
  cam.updateProjectionMatrix();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const out = canvasOf(w * dpr, h * dpr);
  const ok = paint(st, out);
  st.scene.remove(ch.root);
  ch.dispose();
  const ctx = c.getContext('2d');
  if (!ok || !ctx) return;
  c.width = out.width;
  c.height = out.height;
  ctx.drawImage(out, 0, 0);
}

/** `…?acts` in the address: only the action sheet (quicker to look at). */
const SKIP_ROWS = typeof window !== 'undefined' && /acts|bases|cast|gait|worn/.test(window.location.hash);

const W = 190;
const H = 300;
const F = 190;

type Cell = HTMLCanvasElement | null;

export default function ModelPreview() {
  // per row: [now body, now face, modular body, modular face, vroid body, vroid face]
  const cells = useRef<Cell[][]>(ROWS.map(() => []));
  const acts = useRef<Cell[]>([]);
  const bases = useRef<Cell[]>([]);
  const cast = useRef<Cell[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    const live = { gone: false };
    const put = (c: Cell, pic: HTMLCanvasElement | null) => {
      const ctx = c?.getContext('2d');
      if (!c || !pic || !ctx) return;
      c.width = pic.width;
      c.height = pic.height;
      ctx.drawImage(pic, 0, 0);
    };
    void (async () => {
      try {
        for (let i = 0; i < (SKIP_ROWS ? 0 : ROWS.length) && !live.gone; i++) {
          const row = ROWS[i];
          const look = castLook(row.id);
          const c = cells.current[i];
          put(c[0], renderLook(look, W * 2, H * 2, true));
          put(c[1], renderLook(look, F * 2, F * 2, false));
          const tint = { skin: look.skin, hair: look.hair.color };
          if (c[2]) await draw(row.modular, c[2], W, H, false, tint);
          if (c[3]) await draw(row.modular, c[3], F, F, true, tint);
          if (c[4]) await draw(row.vroid, c[4], W, H, false);
          if (c[5]) await draw(row.vroid, c[5], F, F, true);
        }
        for (let i = 0; SHOW_CAST && i < CAST_IDS.length && !live.gone; i++) {
          const body = cast.current[i * 2];
          const face = cast.current[i * 2 + 1];
          if (body) await drawResident(CAST_IDS[i], body, 150, 250, false);
          if (face) await drawResident(CAST_IDS[i], face, 170, 170, true);
        }
        for (let i = 0; SHOW_BASES && i < BASES.length && !live.gone; i++) {
          const body = bases.current[i * 2];
          const face = bases.current[i * 2 + 1];
          if (body) await draw(`vroid/${BASES[i]}.vrm`, body, 150, 230, false);
          if (face) await draw(`vroid/${BASES[i]}.vrm`, face, 150, 150, true);
        }
        for (let i = 0; i < (SHOW_BASES || SHOW_CAST ? 0 : ACTIONS.length) && !live.gone; i++) {
          const front = acts.current[i * 2];
          const side = acts.current[i * 2 + 1];
          if (front) await drawAction(front, ACTIONS[i], 150, 230, false);
          if (side) await drawAction(side, ACTIONS[i], 150, 230, true);
        }
        if (!live.gone) setNote('xong');
      } catch (e) {
        if (!live.gone) setNote(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      live.gone = true;
    };
  }, []);

  if (!import.meta.env.DEV) return <p className="adm-scene">Bản thử này chỉ chạy trên máy dev (mô hình chưa nằm trong bản build).</p>;
  const cell = (i: number, k: number, w: number, h: number) => <canvas ref={(el) => void (cells.current[i][k] = el)} className="adm-pic" style={{ width: w, height: h }} />;
  return (
    <div className="stack-md" data-models={note}>
      <p className="adm-scene">Bản thử, chưa có gì vào game. Mỗi hàng một người: bây giờ, Quaternius Modular (2022, CC0), VRoid (anime, mẫu của pixiv).</p>
      {SHOW_CAST && (
        <ul className="adm-faces">
          {CAST_IDS.map((id, i) => (
            <li key={id} className="adm-model">
              <div className="adm-look-pair">
                <canvas ref={(el) => void (cast.current[i * 2] = el)} className="adm-pic" style={{ width: 150, height: 250 }} />
                <canvas ref={(el) => void (cast.current[i * 2 + 1] = el)} className="adm-pic" style={{ width: 170, height: 170 }} />
              </div>
              <span className="adm-scene">{townPlace(id)?.resident ?? id}</span>
            </li>
          ))}
        </ul>
      )}
      {SHOW_BASES && (
        <ul className="adm-faces">
          {BASES.map((name, i) => (
            <li key={name} className="adm-model">
              <div className="adm-look-pair">
                <canvas ref={(el) => void (bases.current[i * 2] = el)} className="adm-pic" style={{ width: 150, height: 230 }} />
                <canvas ref={(el) => void (bases.current[i * 2 + 1] = el)} className="adm-pic" style={{ width: 150, height: 150 }} />
              </div>
              <span className="adm-pick-id">{name}</span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="adm-sub">Thân VRoid với động tác của game (nhìn chéo và nhìn ngang)</h3>
      <ul className="adm-faces">
        {ACTIONS.map((x, i) => (
          <li key={x.name} className="adm-model">
            <div className="adm-look-pair">
              <canvas ref={(el) => void (acts.current[i * 2] = el)} className="adm-pic" style={{ width: 150, height: 230 }} />
              <canvas ref={(el) => void (acts.current[i * 2 + 1] = el)} className="adm-pic" style={{ width: 150, height: 230 }} />
            </div>
            <span className="adm-scene">{x.name}</span>
          </li>
        ))}
      </ul>
      <div className="adm-cmp">
        <span className="adm-who">Bây giờ</span>
        <span className="adm-who">Quaternius Modular 2022</span>
        <span className="adm-who">VRoid (anime)</span>
        {ROWS.map((row, i) => (
          <div key={row.id} className="adm-cmp-row">
            {[0, 2, 4].map((k) => (
              <div key={k} className="adm-look-pair">
                {cell(i, k, W, H)}
                {cell(i, k + 1, F, F)}
              </div>
            ))}
            <span className="adm-scene">{townPlace(row.id)?.resident ?? row.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
