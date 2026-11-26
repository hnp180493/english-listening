// "Xem thử: mặt mới" on the admin page (owner, 2026-11-26: "thấy mặt nhân vật nào nhân vật nấy y chang nhau, mày không
// làm đẹp được như stardew valley à?"). Eight residents as they are and as they would be with a face and a head shape of
// their own (chars/face.ts FACE_PRESETS, CharacterLook.head), and every face on one person. A PREVIEW: nothing here is
// applied to the town until the owner says so. Loaded lazily (three.js).

import { useEffect, useRef } from 'react';
import type { CharacterLook } from '../town/three/contracts';
import { castLook } from '../town/three/chars/looks';
import { renderLook } from '../town/three/chars/lookPreview';
import { EYE_STYLES } from '../town/three/chars/face';
import { townPlace } from '../../data/town';
import { tl } from '../../i18n';
import { renderFurniture } from '../town/three/thumbs';
import { FURNITURE_IDS, FURNITURE_NAMES, type FurnitureId } from '../town/three/scene/furniture';

/** The new face and head proposed for each (placeId). */
const PROPOSED: readonly { id: string; face: number; head: NonNullable<CharacterLook['head']>; why: string }[] = [
  { id: 'cafe', face: 4, head: 'oval', why: 'mắt dài, lông mày cong, môi đầy' },
  { id: 'friend', face: 8, head: 'round', why: 'mắt tròn xanh, tàn nhang, má hồng' },
  { id: 'home', face: 11, head: 'oval', why: 'bà cụ: nếp nhăn, lông mày bạc' },
  { id: 'shop', face: 6, head: 'wide', why: 'mắt nhỏ, lông mày rậm, ria mép, đầu bè' },
  { id: 'office', face: 14, head: 'oval', why: 'tóc đỏ: lông mày đỏ, tàn nhang, cười rộng' },
  { id: 'school', face: 9, head: 'long', why: 'mắt dài, mũi dài, đầu dài' },
  { id: 'station', face: 12, head: 'wide', why: 'mắt sắc, ria mép, nếp nhăn' },
  { id: 'phone', face: 7, head: 'round', why: 'mắt lim dim, tàn nhang' },
];

function Pic({ look, w, h, whole }: { look: CharacterLook; w: number; h: number; whole?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pic = renderLook(look, w * dpr, h * dpr, whole);
    const ctx = c.getContext('2d');
    if (!pic || !ctx) return;
    c.width = pic.width;
    c.height = pic.height;
    ctx.drawImage(pic, 0, 0);
  }, [look, w, h, whole]);
  return <canvas ref={ref} className="adm-pic" style={{ width: w, height: h }} />;
}

function Thing({ id }: { id: FurnitureId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pic = renderFurniture(id, 150 * dpr, 150 * dpr);
    const ctx = c.getContext('2d');
    if (!pic || !ctx) return;
    c.width = pic.width;
    c.height = pic.height;
    ctx.drawImage(pic, 0, 0);
  }, [id]);
  return <canvas ref={ref} className="adm-pic" style={{ width: 150, height: 150 }} />;
}

export default function LookPreview() {
  const base = castLook('cafe');
  return (
    <div className="stack-md">
      <p className="adm-scene">Bản xem thử, chưa áp vào game. Trái: mặt hiện tại. Phải: mặt mới và dáng đầu riêng.</p>
      <ul className="adm-looks">
        {PROPOSED.map((p) => {
          const old = castLook(p.id);
          const next: CharacterLook = { ...old, face: p.face, head: p.head };
          return (
            <li key={p.id} className="adm-look">
              <p className="adm-who">{townPlace(p.id)?.resident ?? p.id}</p>
              <div className="adm-look-pair">
                <Pic look={old} w={150} h={150} />
                <Pic look={next} w={150} h={150} />
              </div>
              <p className="adm-scene">{p.why}</p>
            </li>
          );
        })}
      </ul>
      <h3 className="adm-sub">{tl`Cả ${EYE_STYLES} kiểu mặt trên cùng một người`}</h3>
      <ul className="adm-faces">
        {Array.from({ length: EYE_STYLES }, (_, i) => (
          <li key={i}>
            <Pic look={{ ...base, face: i }} w={120} h={120} />
            <span className="adm-pick-id">{i}</span>
          </li>
        ))}
      </ul>
      <h3 className="adm-sub">Đồ đạc mới trên phố</h3>
      <p className="adm-scene">Đã đặt vào thị trấn và Westbay: mỗi khu một kiểu ghế, một kiểu đèn; đồ nhỏ đứng ở chỗ hợp lý. Mỗi món vẽ đúng cỡ như trong thế giới.</p>
      <ul className="adm-faces">
        {FURNITURE_IDS.map((id) => (
          <li key={id} className="adm-thing">
            <Thing id={id} />
            <span className="adm-scene">{FURNITURE_NAMES[id]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
