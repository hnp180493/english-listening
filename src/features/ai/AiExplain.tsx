// "Hỏi AI vì sao nghe sai": next to the rule-based explanation (dictation result, checkup per-item review).

import { useMemo } from 'react';
import { aiJson, useAiStatus } from '../../core/ai';
import { aiCacheKey, buildExplainPrompt, explainInputFrom, sanitizeExplanation, type Explanation } from '../../core/aiTasks';
import type { DiffUnit } from '../../core/dictation/diff';
import type { Annotation } from '../../core/types';
import { safeDecode } from '../dictation/decodeCache';
import AiAction from './AiAction';
import { UNUSABLE_ANSWER } from './useAiTask';

export interface AiExplainProps {
  text: string;
  typed: string;
  units: readonly DiffUnit[];
  annotations: readonly Annotation[];
  className?: string;
}

export function ExplanationView({ value }: { value: Explanation }) {
  return (
    <div className="ai-explain">
      {value.summary && <p className="ai-summary">{value.summary}</p>}
      {value.points.length > 0 && (
        <ul className="ai-points">
          {value.points.map((p, i) => (
            <li key={i} className="ai-point">
              {p.actual && (
                <p className="ai-map">
                  {p.heard ? (
                    <>
                      Bạn nghe <s lang="en">“{p.heard}”</s> → thực ra là <b lang="en">“{p.actual}”</b>
                    </>
                  ) : (
                    <>
                      Bạn bỏ sót <b lang="en">“{p.actual}”</b>
                    </>
                  )}
                </p>
              )}
              {p.why && <p className="ai-why">{p.why}</p>}
              {p.tip && (
                <p className="ai-tip">
                  <b>Mẹo:</b> {p.tip}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AiExplain({ text, typed, units, annotations, className }: AiExplainProps) {
  const status = useAiStatus();
  // the decoder result gives each mistake its spoken chunk and the whole sentence as it sounds
  const input = useMemo(() => explainInputFrom(text, typed, units, annotations, safeDecode(text)), [text, typed, units, annotations]);
  const provider = status.text ? `${status.text.id}/${status.text.model}` : '';
  const key = input.mistakes.length ? aiCacheKey('explain', { provider, input }) : null;

  const run = async (signal: AbortSignal): Promise<Explanation> => {
    const p = buildExplainPrompt(input);
    const raw = await aiJson<unknown>({
      system: p.system,
      messages: [{ role: 'user', content: p.user }],
      maxTokens: p.maxTokens,
      reasoning: 'off',
      json: { schema: p.schema, name: p.name },
      signal,
    });
    const clean = sanitizeExplanation(raw, input);
    if (!clean) throw new Error(UNUSABLE_ANSWER);
    return clean;
  };

  return (
    <AiAction<Explanation>
      label="Hỏi AI vì sao nghe sai"
      busyLabel="AI đang xem câu bạn gõ…"
      cacheKey={key}
      run={run}
      render={(v) => <ExplanationView value={v} />}
      className={className}
    />
  );
}
