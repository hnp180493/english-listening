// Báo cáo tiến bộ → "Nghe trong game" (docs/progress-report.md §4 "In the game"; core/town/gameEar.ts): the share of
// the things heard in Westbay's jobs and Rico's dispatch office that were acted on rightly after ONE hearing, on jobs
// and calls met for the first time, the two voices apart. Shown only once there is a count; under MIN_EAR_SAMPLE a
// row says it is too few to tell. It is never added to the dictation's or the real videos' numbers: these are lines
// written for a game and said by a machine.

import { useId } from 'react';
import { earPct, MIN_EAR_SAMPLE, type EarCount, type EarTotals } from '../../core/town/gameEar';
import { tl, tr } from '../../i18n';

function row(name: string, c: EarCount): string | null {
  if (c.n === 0) return null;
  const label = tr(name);
  const pct = earPct(c);
  return c.n < MIN_EAR_SAMPLE ? tl`${label}: ${c.ok}/${c.n} điều, còn ít, chưa nói được gì` : tl`${label}: ${pct}% (${c.ok}/${c.n} điều)`;
}

export default function GameEarCard({ totals }: { totals: EarTotals }) {
  const id = useId();
  const rows = [row('Người Westbay, giọng trình duyệt', totals.browser), row('Người thị trấn, clip Gemini', totals.clip)].filter((r): r is string => !!r);
  if (rows.length === 0) return null;
  return (
    <section className="card rep-card" aria-labelledby={id}>
      <div className="rep-head">
        <h2 id={id} className="rep-h2">
          Nghe trong game
        </h2>
      </div>
      <p className="rep-note">Điều nghe ra lần đầu trong phi vụ và văn phòng điều xe mà bạn làm đúng sau đúng 1 lần nghe (không nhắc lại, không nghe chậm).</p>
      <ul className="rep-facts">
        {rows.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="rep-note">
        Đây là lời thoại viết sẵn, đọc bằng giọng máy, không phải người thật, nên không cộng vào số của Chép chính tả hay Video thật. Người thị trấn đọc bằng giọng trình duyệt khi
        clip của họ chưa được tạo.
      </p>
    </section>
  );
}
