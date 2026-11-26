// The town's clock and sky on the HUD (core/town/sky.ts: a day of the game is 48 real minutes, the weather changes by
// itself), and the weather's sound: the rain's hiss as loud as it rains, a roll of thunder after each flash (the
// engine draws the flash from the same clock). One small pill; the hour is read in fives.

import { useEffect, useState } from 'react';
import { Cloud, CloudLightning, CloudRain, Moon, Sun, type LucideIcon } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { clockLabel, SKY_NAME, strikeIn, type Sky } from '../../core/town/sky';
import { skyNow, wetSoon } from '../../core/town/skyNow';
import { rulesNow, type SkyRule } from '../../core/town/skyRules';
import { tl, tr } from '../../i18n';
import { playThunder, setRainSound } from './sfx';

const ICONS: Readonly<Record<Sky, LucideIcon>> = { clear: Sun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning };

/** The sky's rules in force (core/town/skyRules.ts), in a word or two each, and what each does (the pill's title). */
const RULE_WORD: Readonly<Record<SkyRule, string>> = { slippery: 'Đường trơn', muffled: 'Mưa át tiếng', static: 'Radio rè' };
const RULE_SAYS: Readonly<Record<SkyRule, string>> = {
  slippery: 'Đường ướt: xe phanh dài hơn, ôm cua rộng hơn.',
  muffled: 'Mưa to: nghe lỏm khó hơn một nấc.',
  static: 'Giông: radio và bộ đàm bị rè, mất vài chữ.',
};

export default function SkyChip({ sound }: { sound: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let lastStrike = 0;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const sky = skyNow(t);
      setRainSound(sky.mix.rain, sound);
      // the thunder of a flash in the second before this one, a moment after it
      const at = strikeIn(t - 1000, sky.mix.storm);
      if (at !== null && at !== lastStrike) {
        lastStrike = at;
        playThunder(sound);
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      setRainSound(0, false);
    };
  }, [sound]);
  const sky = skyNow(now);
  const night = sky.night > 0.5;
  const icon = sky.sky === 'clear' && night ? Moon : ICONS[sky.sky];
  const label = clockLabel(now);
  const name = tr(SKY_NAME[sky.sky]);
  // what the weather does to the game now (none on a dry day): a word or two after the hour
  const rules = rulesNow(sky.mix, wetSoon(now));
  const words = rules.map((r) => tr(RULE_WORD[r])).join(' · ');
  const says = rules.map((r) => tr(RULE_SAYS[r])).join(' ');
  return (
    <span className="town-pill town-sky" role="img" aria-label={words ? tl`Giờ trong thị trấn ${label}, ${name}. ${words}` : tl`Giờ trong thị trấn ${label}, ${name}`} title={tl`Giờ trong thị trấn ${label}, ${name}. Một ngày ở đây dài 48 phút.` + (says ? ` ${says}` : '')}>
      <Icon icon={icon} size={15} />
      <span className="town-sky-time">{label}</span>
      {words && <span className="town-sky-rule">{words}</span>}
    </span>
  );
}
