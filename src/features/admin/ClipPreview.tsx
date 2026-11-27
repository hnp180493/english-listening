// "Thử chuyển động dựng sẵn" on the admin page (`…?clips`), LIVE, in the deployed app too: three of the game's own
// avatars (the learner as a man, Grace, a child), each twice side by side: on the left the motion the game makes in
// code now (chars/anim.ts + vrmBody.ts), on the right a ready-made clip (Quaternius' Universal Animation Library, CC0,
// carried over by chars/vrmClips.ts). They walk along a floor with a line every tile, at the game's own paces, so a
// foot that slides shows. Nothing of it is in the game yet (the owner judges first).
//
// `…?clips&frames` draws eight frames of a cycle of each of "đi thường" and "chạy" side by side instead (for pictures:
// town-shot.mjs runs with reduced motion).

import { useEffect, useRef, useState } from 'react';
import { CanvasTexture, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, RepeatWrapping, Scene, SRGBColorSpace, WebGLRenderer, type AnimationAction, type Object3D } from 'three';
import { vrmFor } from '../../data/townVrm';
import { passerLook, profileLook } from '../town/three/chars/looks';
import { createPerson, type Character3DPlus } from '../town/three/chars/person';
import { loadClips, retarget, type ClipName, type ClipRig } from '../town/three/chars/vrmClips';
import { wearVrm } from '../town/three/chars/vrmBody';
import type { CharAction, CharacterLook } from '../town/three/contracts';
import { SEAT_TOP } from '../town/three/scene/props3d';

interface Mode {
  id: string;
  label: string;
  speed: number;
  code: CharAction;
  clip: ClipName;
}

const MODES: readonly Mode[] = [
  { id: 'idle', label: 'Đứng', speed: 0, code: 'idle', clip: 'idle' },
  { id: 'stroll', label: 'Dạo 0,7', speed: 0.7, code: 'walk', clip: 'walk' },
  { id: 'walk', label: 'Đi thường 1,6', speed: 1.6, code: 'walk', clip: 'walk' },
  { id: 'run', label: 'Chạy 2,8', speed: 2.8, code: 'run', clip: 'jog' },
  { id: 'sit', label: 'Ngồi', speed: 0, code: 'sit', clip: 'sit' },
];

/** A clip's playback rate is the game's pace over the clip's own, kept within what still looks like the clip. */
const RATE_MIN = 0.6;
const RATE_MAX = 1.6;

const FIGURES: readonly { id: string; look?: CharacterLook }[] = [
  { id: 'player-m', look: profileLook({ gender: 'male', skin: '#f1cba9', hair: 'spiky', hairColor: '#d36f4c' }) },
  { id: 'home' },
  { id: 'kid1', look: passerLook(5, true) },
];

const hash = typeof window !== 'undefined' ? window.location.hash : '';
const FRAMES = hash.includes('frames');

interface Pair {
  code: Character3DPlus;
  clip: Character3DPlus;
  rig: ClipRig;
  now: AnimationAction | null;
}

async function person(f: (typeof FIGURES)[number]): Promise<Character3DPlus> {
  const ch = (f.look ? createPerson(f.id, f.look) : createPerson(f.id)) as Character3DPlus;
  const who = vrmFor(f.id, ch.look, import.meta.env.BASE_URL);
  await wearVrm(ch, who.url, who);
  ch.setHeading(Math.PI / 2, true);
  return ch;
}

function floorTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d9d2c4';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#8a7f6c';
  g.fillRect(0, 0, 128, 6);
  g.fillStyle = '#c2b9a8';
  g.fillRect(0, 0, 3, 128);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

export default function ClipPreview() {
  const host = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>(MODES[2]);
  const [still, setStill] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [status, setStatus] = useState('Đang tải nhân vật…');
  const [rates, setRates] = useState('');
  const startStill = useRef(still);
  const api = useRef<{ setMode(m: Mode): void; setStill(s: boolean): void } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const life = { gone: false };
    const W = Math.min(1100, el.clientWidth || 900);
    const H = 460;
    const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: FRAMES });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H);
    renderer.outputColorSpace = SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new Scene();
    scene.background = new Color('#eef0f4');
    scene.add(new HemisphereLight(0xfff6ea, 0xc9b8d8, 1.15));
    const key = new DirectionalLight(0xfff1dc, 1.6);
    key.position.set(2, 4, 3);
    scene.add(key);
    const tex = floorTexture();
    tex.repeat.set(12, 400);
    const floor = new Mesh(new PlaneGeometry(12, 400), new MeshStandardMaterial({ map: tex, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(1.8, 0, 190);
    scene.add(floor);
    const cam = new PerspectiveCamera(32, W / H, 0.05, 80);
    const pairs: Pair[] = [];
    const st = { m: MODES[2], paused: startStill.current, z: 0 };
    const view = { near: -1 };
    const loop = { raf: 0 };
    const clock = { last: performance.now() };

    const rateOf = (p: Pair, md: Mode): number => {
      const native = p.rig.native[md.clip];
      return md.speed > 0 && native > 0 ? Math.min(RATE_MAX, Math.max(RATE_MIN, md.speed / native)) : 1;
    };
    const apply = (md: Mode, instant: boolean) => {
      st.m = md;
      const notes: string[] = [];
      for (const p of pairs) {
        p.code.setAction(md.code);
        p.code.setSeatHeight(SEAT_TOP);
        const next = p.rig.actions[md.clip];
        next.timeScale = rateOf(p, md);
        if (p.now !== next) {
          next.reset().setEffectiveWeight(1).play();
          if (p.now && !instant) p.now.crossFadeTo(next, 0.2, false);
          else p.now?.stop();
          p.now = next;
        }
        notes.push(`${p.rig.native[md.clip] ? p.rig.native[md.clip].toFixed(2) : '–'} → ×${next.timeScale.toFixed(2)}`);
      }
      setRates(notes.join(' · '));
    };
    const step = (dt: number) => {
      st.z += st.m.speed * dt;
      pairs.forEach((p, i) => {
        const x = i * 1.8;
        p.code.root.position.set(x, 0, st.z);
        p.clip.root.position.set(x + 0.75, 0, st.z);
        p.code.update(dt, st.m.speed);
        // the clip side: the character's own update (face, hair springs, what is worn), then the clip over its bones
        p.clip.update(dt, 0);
        p.rig.mixer.update(dt);
      });
      if (view.near >= 0) {
        // (close on one pair, three quarters from the front)
        const x = view.near * 1.8 + 0.37;
        cam.position.set(x + 1.7, 1.05, st.z + 2.1);
        cam.lookAt(x, 0.62, st.z);
      } else {
        cam.position.set(4.6, 1.9, st.z + 3.6);
        cam.lookAt(1.9, 0.6, st.z + 0.2);
      }
    };
    const frame = () => {
      loop.raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min(1 / 20, (now - clock.last) / 1000);
      clock.last = now;
      if (!st.paused) step(dt);
      renderer.render(scene, cam);
    };

    void (async () => {
      try {
        const src = await loadClips(import.meta.env.BASE_URL + 'anim/people.glb');
        for (const f of FIGURES) {
          const code = await person(f);
          const clip = await person(f);
          if (life.gone) return;
          clip.setAction('idle');
          const vrmScene = clip.root.getObjectByName('vrm')?.children[0] as Object3D | undefined;
          if (!vrmScene) throw new Error('no avatar for ' + f.id);
          const rig = retarget(src, vrmScene, clip.root.getObjectByName('vrm')!.scale.x);
          scene.add(code.root, clip.root);
          pairs.push({ code, clip, rig, now: null });
        }
        apply(st.m, true);
        setStatus('');
        if (FRAMES) {
          // eight frames of a cycle of each, for pictures: the learner's pair close, then Grace's
          const shots: [Mode, number][] = [
            [MODES[2], 0],
            [MODES[3], 0],
            [MODES[2], 1],
          ];
          for (const [md, who] of shots) {
            apply(md, true);
            view.near = who;
            for (let t = 0; t < 2; t += 1 / 60) step(1 / 60);
            const cycle = pairs[0].rig.actions[md.clip].getClip().duration / pairs[0].rig.actions[md.clip].timeScale;
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexWrap = 'wrap';
            row.style.gap = '4px';
            for (let k = 0; k < 8; k++) {
              for (let t = 0; t < cycle / 8 - 1e-6; t += 1 / 120) step(1 / 120);
              renderer.render(scene, cam);
              const c = document.createElement('canvas');
              c.width = 270;
              c.height = 300;
              // (the middle of the view, where the pair stands)
              const sw = renderer.domElement.width;
              const sh = renderer.domElement.height;
              c.getContext('2d')!.drawImage(renderer.domElement, sw * 0.3, 0, sw * 0.4, sh, 0, 0, c.width, c.height);
              row.appendChild(c);
            }
            strip.current?.appendChild(row);
          }
          view.near = -1;
          document.body.dataset.clipsDone = '1';
        }
        loop.raf = requestAnimationFrame(frame);
      } catch (e) {
        setStatus(String(e));
      }
    })();
    api.current = {
      setMode: (md) => apply(md, false),
      setStill: (s) => void (st.paused = s),
    };
    return () => {
      life.gone = true;
      cancelAnimationFrame(loop.raf);
      for (const p of pairs) {
        p.rig.mixer.stopAllAction();
        p.code.dispose();
        p.clip.dispose();
      }
      floor.geometry.dispose();
      (floor.material as MeshStandardMaterial).dispose();
      tex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="adm-clips" style={{ display: 'grid', gap: 8 }}>
      <p className="adm-note">Mỗi người hai bản: trái là chuyển động code của game, phải là clip dựng sẵn (Quaternius, CC0). Vạch trên sàn cách nhau một ô.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {MODES.map((md) => (
          <button
            key={md.id}
            type="button"
            className={md.id === mode.id ? 'btn btn-secondary' : 'btn btn-ghost'}
            onClick={() => {
              setMode(md);
              api.current?.setMode(md);
            }}
          >
            {md.label}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setStill(!still);
            api.current?.setStill(!still);
          }}
        >
          {still ? 'Phát chuyển động' : 'Dừng'}
        </button>
      </div>
      {still && <p className="adm-note">Máy đang bật giảm chuyển động nên trang đứng yên. Bấm “Phát chuyển động” để xem.</p>}
      {status && <p className="adm-note">{status}</p>}
      {rates && <p className="adm-note">Tốc độ gốc của clip (ô/giây) → tốc độ phát: {rates}</p>}
      <div ref={host} />
      <div ref={strip} style={{ display: 'grid', gap: 6 }} />
    </div>
  );
}
