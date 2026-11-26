// An answer by intent (core/town/jobDoc.ts 'intent'): the learner picks what they mean, in Vietnamese; their own
// English line is said after the pick (shown, and spoken when PLAYER_VOICE is on). Keys 1–3 too.

import { useEffect } from 'react';
import type { IntentStep } from '../../../core/town/jobDoc';

/** The answers by intent: Vietnamese intents, the learner's line said after the pick. */
export default function Intents({ step, onPick }: { step: IntentStep; onPick: (i: number) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= step.options.length) {
        e.preventDefault();
        onPick(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onPick]);
  return (
    <div className="job-intents">
      {step.options.map((o, i) => (
        <button key={o.say} type="button" className="town-reply job-intent" onClick={() => onPick(i)}>
          <span className="town-reply-key" aria-hidden="true">
            {i + 1}
          </span>
          <span className="town-reply-text">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

