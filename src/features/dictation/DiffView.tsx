import type { DiffUnit } from '../../core/dictation/diff';
import { Meaning } from './ResultParts';

/** The learner's answer against the original sentence (+ the meaning, when there is one), in an inset panel. */
export default function DiffView({ units, vi }: { units: DiffUnit[]; vi?: string }) {
  const typos = units.filter((u): u is Extract<DiffUnit, { kind: 'typo' }> => u.kind === 'typo');
  return (
    <div className="panel dict-diff-wrap">
      <p className="dict-diff" aria-label="So sánh câu của bạn với câu gốc">
        {units.map((u, k) => {
          switch (u.kind) {
            case 'ok':
              return (
                <span key={k} className="dict-w dict-w-ok">
                  {u.target}
                </span>
              );
            case 'typo':
              return (
                <span key={k} className="dict-w dict-w-typo" title={`Bạn gõ “${u.answer}” — lỗi chính tả nhỏ, vẫn tính đúng`}>
                  {u.target}
                </span>
              );
            case 'wrong':
              return (
                <span key={k} className="dict-w dict-w-bad">
                  <s className="dict-w-typed" aria-label={`bạn gõ ${u.answer}`}>
                    {u.answer}
                  </s>
                  <span className="dict-w-correct">{u.target}</span>
                </span>
              );
            case 'missing':
              return (
                <span key={k} className="dict-w dict-w-miss" title="Bạn bỏ sót từ này">
                  {u.target}
                </span>
              );
            case 'extra':
              return (
                <s key={k} className="dict-w dict-w-extra" title="Từ thừa — câu gốc không có">
                  {u.answer}
                </s>
              );
            case 'skip':
              return (
                <span key={k} className="dict-w dict-w-skip">
                  {u.target}
                </span>
              );
          }
        })}
      </p>
      <div className="dict-legend" aria-hidden="true">
        <span>
          <i className="dict-lg dict-lg-ok" /> đúng
        </span>
        <span>
          <i className="dict-lg dict-lg-bad" /> sai
        </span>
        <span>
          <i className="dict-lg dict-lg-miss" /> thiếu
        </span>
        <span>
          <i className="dict-lg dict-lg-extra" /> thừa
        </span>
      </div>
      {typos.length > 0 && (
        <p className="dict-typo-note">
          Lỗi chính tả nhỏ (vẫn tính đúng):{' '}
          {typos.map((t, k) => (
            <span key={k}>
              {k > 0 && ', '}
              <s>{t.answer}</s> → <b>{t.target}</b>
            </span>
          ))}
        </p>
      )}
      {vi && <Meaning vi={vi} />}
    </div>
  );
}
