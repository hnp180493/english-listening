// "Người già và trẻ con: thân Quaternius" on the admin page (`…?quat`), in the deployed app too (docs/town.md §35): every
// old person and two children as the game dresses them now (data/townQuat.ts, chars/quatBody.ts): the drawn portrait
// where there is one, the body from the front and from the side, and eight moments of one walking step. Drawn once
// into pictures (town-shot.mjs takes pictures with reduced motion; a still sheet is what is judged).

import { useEffect, useState } from 'react';
import { Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { quatFor } from '../../data/townQuat';
import { vrmFor } from '../../data/townVrm';
import { CITY_LOOKS } from '../town/city/cityLooks';
import { JOB_CAST_LOOKS } from '../town/jobs/jobCast';
import { castLook, passerLook } from '../town/three/chars/looks';
import { createPerson, type Character3DPlus } from '../town/three/chars/person';
import type { CharacterLook } from '../town/three/contracts';
import { sheetCell } from '../town/portraitSheet';
import { tl } from '../../i18n';

interface Figure {
  id: string;
  name: string;
  look: CharacterLook;
}

/** A stroll (tiles a second). */
const PACE = 0.9;

const OLD = ['home', 'mei', 'okafor', 'osei', 'adeyemi', 'frank', 'hal', 'finch', 'whitlock', 'odile', 'delaney', 'kemp'];

function figures(): Figure[] {
  const out: Figure[] = [];
  for (const id of OLD) {
    const look = id === 'home' ? castLook('home') : (CITY_LOOKS[id] ?? JOB_CAST_LOOKS[id]);
    if (look) out.push({ id, name: id === 'home' ? 'Grace' : id, look });
  }
  out.push({ id: 'kid-a', name: 'Trẻ con 1', look: passerLook(5, true) }, { id: 'kid-b', name: 'Trẻ con 2', look: passerLook(12, true) });
  return out;
}

interface Card {
  id: string;
  name: string;
  portrait: { src: string; pos: string } | null;
  front: string;
  side: string;
  walk: string[];
  note: string;
}

export default function QuatPreview() {
  const [cards, setCards] = useState<Card[]>([]);
  const [status, setStatus] = useState('Đang dựng người…');
  useEffect(() => {
    // (React's strict mode mounts twice: the first run is stopped by its cleanup, the second does the work)
    const life = { gone: false };
    const W = 180;
    const H = 260;
    const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(W, H);
    renderer.outputColorSpace = SRGBColorSpace;
    const scene = new Scene();
    scene.background = new Color('#eef0f4');
    scene.add(new HemisphereLight(0xfff6ea, 0xc9b8d8, 1.4));
    const key = new DirectionalLight(0xfff1dc, 1.7);
    key.position.set(2, 4, 3);
    scene.add(key);
    const cam = new PerspectiveCamera(30, W / H, 0.05, 40);
    const shot = (ch: Character3DPlus, from: 'front' | 'side'): string => {
      const top = ch.headTop(cam.position.clone()).y;
      const mid = top * 0.52;
      const dist = top * 2.3;
      const z = ch.root.position.z;
      if (from === 'front') cam.position.set(0, mid, z + dist);
      else cam.position.set(dist, mid, z);
      cam.lookAt(0, mid, z);
      renderer.render(scene, cam);
      return renderer.domElement.toDataURL('image/png');
    };
    void (async () => {
      const done: Card[] = [];
      for (const f of figures()) {
        if (life.gone) {
          renderer.dispose();
          return;
        }
        try {
          const ch = createPerson(f.id, f.look) as Character3DPlus;
          const who = vrmFor(f.id, ch.look, import.meta.env.BASE_URL);
          const recipe = quatFor(f.id, ch.look, who.face, who.tall);
          if (!recipe) {
            done.push({ id: f.id, name: f.name, portrait: null, front: '', side: '', walk: [], note: 'không dùng thân Quaternius' });
            continue;
          }
          // (the body's code is the game's own lazy chunk: chars/vrmPeople.ts loads it the same way)
          const { wearQuat } = await import('../town/three/chars/quatBody');
          await wearQuat(ch, recipe);
          scene.add(ch.root);
          // facing +z (the animator's heading: a quarter turn from the pivot's)
          ch.setHeading(Math.PI / 2, true);
          ch.setAction('idle');
          for (let i = 0; i < 20; i++) ch.update(1 / 20, 0);
          const front = shot(ch, 'front');
          const side = shot(ch, 'side');
          // eight moments of a walking step, from the side, at a stroll: the body really moves (the animator reads
          // the walk from how far it went)
          ch.setAction('walk');
          const at = { z: 0 };
          const step = (dt: number) => {
            at.z += PACE * dt;
            ch.root.position.set(0, 0, at.z);
            ch.update(dt, PACE);
          };
          for (let i = 0; i < 40; i++) step(1 / 40);
          const walk: string[] = [];
          for (let k = 0; k < 8; k++) {
            for (let i = 0; i < 4; i++) step(1 / 60);
            walk.push(shot(ch, 'side'));
          }
          scene.remove(ch.root);
          ch.dispose();
          const cell = sheetCell(f.id, 'neutral');
          done.push({ id: f.id, name: f.name, portrait: cell ? { src: import.meta.env.BASE_URL + cell.src, pos: `${(cell.cell % 3) * 50}% ${Math.floor(cell.cell / 3) * 50}%` } : null, front, side, walk, note: tl`${recipe.sex === 'f' ? 'nữ' : 'nam'} · ${recipe.kind} · cao ${recipe.tall.toFixed(2)}` });
        } catch (e) {
          done.push({ id: f.id, name: f.name, portrait: null, front: '', side: '', walk: [], note: String(e) });
        }
        if (!life.gone) setCards([...done]);
      }
      setStatus('');
      document.body.dataset.quatDone = '1';
      renderer.dispose();
    })();
    return () => {
      life.gone = true;
    };
  }, []);

  return (
    <div className="adm-quat" style={{ display: 'grid', gap: 12 }}>
      <p className="adm-note">Người già và trẻ con mặc thân Quaternius (CC0, như game Giang Hồ): chân dung vẽ, thân nhìn trước và ngang, tám khoảnh khắc của một bước đi.</p>
      {status && <p className="adm-note">{status}</p>}
      {cards.map((c) => (
        <section key={c.id} style={{ display: 'grid', gap: 4 }}>
          <p className="adm-note">
            <strong>{c.name}</strong> · {c.note}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-end' }}>
            {c.portrait && <div role="img" aria-label="Chân dung vẽ" style={{ width: 120, height: 120, borderRadius: 8, backgroundImage: `url(${c.portrait.src})`, backgroundSize: '300% 300%', backgroundPosition: c.portrait.pos }} />}
            {c.front && <img src={c.front} width={120} height={173} alt="Nhìn trước" />}
            {c.side && <img src={c.side} width={120} height={173} alt="Nhìn ngang" />}
          </div>
          {c.walk.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }} aria-label="Tám khoảnh khắc khi đi">
              {c.walk.map((src, i) => (
                <img key={i} src={src} width={72} height={104} alt="" />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
