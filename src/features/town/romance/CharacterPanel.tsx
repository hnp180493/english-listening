// "Nhân vật" (docs/town.md §15): the learner makes their own character: man or woman (who they can court follows from
// it), a name the residents say in text scenes, a skin tone, a hair style and colour. The picture shows the choice at
// once; "Lưu" puts it on the player in the town (synced to the account with town-life).

import { useEffect, useMemo, useState } from 'react';
import { PLAYER_HAIR, PLAYER_HAIR_COLORS, PLAYER_SKINS, cleanName, partnerOf, type PlayerHair } from '../../../core/town/life';
import { saveProfile, useTownLife } from '../../../core/town/lifeStore';
import type { PlayerGender } from '../../../core/town/romanceTypes';
import { Portrait } from '../art';
import { playerLookKey, profileLook, setPlayerLook } from '../three/chars/looks';
import type { ActivityPanelProps } from '../activities/types';
import './romance.css';

const HAIR_LABEL: Record<PlayerHair, string> = {
  short: 'Ngắn',
  spiky: 'Dựng',
  curly: 'Xoăn',
  bob: 'Bob',
  ponytail: 'Đuôi ngựa',
  long: 'Dài',
  bun: 'Búi',
  pigtails: 'Hai bím',
  bald: 'Trọc',
};

export default function CharacterPanel({ onOpen, onReward }: ActivityPanelProps) {
  const life = useTownLife();
  const saved = life.profile;
  const [gender, setGender] = useState<PlayerGender>(saved?.gender ?? 'male');
  const [name, setName] = useState(saved?.name ?? '');
  const [skin, setSkin] = useState(saved?.skin ?? PLAYER_SKINS[1]);
  const [hair, setHair] = useState<PlayerHair>(saved?.hair ?? 'short');
  const [hairColor, setHairColor] = useState(saved?.hairColor ?? PLAYER_HAIR_COLORS[0]);
  // the picture shows the choice at once; leaving without saving puts the saved look back
  // (set while rendering: it only changes a module's look, the same for the same choice)
  const key = useMemo(() => {
    setPlayerLook(profileLook({ gender, skin, hair, hairColor }));
    return playerLookKey();
  }, [gender, skin, hair, hairColor]);
  useEffect(() => () => void setPlayerLook(saved ? profileLook(saved) : null), [saved]);
  // somebody courted already: the gender is part of that story
  const locked = !!saved && !!partnerOf(life);
  const clean = cleanName(name);
  const save = () => {
    if (!clean) return;
    saveProfile({ gender, name: clean, skin, hair, hairColor });
    onReward({ label: saved ? 'Đã đổi nhân vật' : `Chào ${clean}!` });
    if (!saved) onOpen?.('love');
  };
  return (
    <form
      className="town-love town-me"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="town-me-preview">
        <Portrait placeId="player" size={112} look={key} />
      </div>
      <div className="town-me-row" role="radiogroup" aria-label="Nam hay nữ">
        {(['male', 'female'] as const).map((g) => (
          <button key={g} type="button" role="radio" aria-checked={gender === g} disabled={locked && gender !== g} className={'btn btn-sm' + (gender === g ? ' btn-soft is-on' : ' btn-ghost')} onClick={() => setGender(g)}>
            {g === 'male' ? 'Nam' : 'Nữ'}
          </button>
        ))}
      </div>
      {locked && <p className="town-build-hint">Đang có đôi nên không đổi nam / nữ được.</p>}
      <label className="town-me-field">
        <span>Tên</span>
        <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Tên nhân vật" />
      </label>
      <fieldset className="town-me-set">
        <legend>Màu da</legend>
        <div className="town-me-swatches">
          {PLAYER_SKINS.map((c) => (
            <button key={c} type="button" className={'town-me-swatch' + (skin === c ? ' is-on' : '')} style={{ backgroundColor: c }} onClick={() => setSkin(c)} aria-label={`Màu da ${PLAYER_SKINS.indexOf(c) + 1}`} aria-pressed={skin === c} />
          ))}
        </div>
      </fieldset>
      <fieldset className="town-me-set">
        <legend>Kiểu tóc</legend>
        <div className="town-me-row is-wrap">
          {PLAYER_HAIR.map((h) => (
            <button key={h} type="button" className={'btn btn-sm' + (hair === h ? ' btn-soft is-on' : ' btn-ghost')} onClick={() => setHair(h)} aria-pressed={hair === h}>
              {HAIR_LABEL[h]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="town-me-set">
        <legend>Màu tóc</legend>
        <div className="town-me-swatches">
          {PLAYER_HAIR_COLORS.map((c) => (
            <button key={c} type="button" className={'town-me-swatch' + (hairColor === c ? ' is-on' : '')} style={{ backgroundColor: c }} onClick={() => setHairColor(c)} aria-label={`Màu tóc ${PLAYER_HAIR_COLORS.indexOf(c) + 1}`} aria-pressed={hairColor === c} />
          ))}
        </div>
      </fieldset>
      <div className="town-talk-foot">
        <button type="submit" className="btn btn-primary" disabled={!clean}>
          {saved ? 'Lưu' : 'Tạo nhân vật'}
        </button>
      </div>
    </form>
  );
}
