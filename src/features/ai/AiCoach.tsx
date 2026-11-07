// "Nhận xét bằng AI" in the progress report: only aggregate numbers are sent (buildCoachInput), the answer is
// honesty-filtered (sanitizeCoach) and cached for the day per period + data.

import { useMemo } from 'react';
import { aiJson, useAiStatus } from '../../core/ai';
import { aiCacheKey, buildCoachInput, buildCoachPrompt, localDayKey, sanitizeCoach, type CoachComment } from '../../core/aiTasks';
import type { CheckupResult } from '../../core/benchmark';
import type { ProgressReport } from '../../core/progressReport';
import AiAction from './AiAction';
import { UNUSABLE_ANSWER } from './useAiTask';

export function CoachView({ value }: { value: CoachComment }) {
  return (
    <div className="ai-coach-body">
      {value.headline && <p className="ai-coach-head">{value.headline}</p>}
      {value.points.length > 0 && (
        <ul>
          {value.points.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {value.nextWeek.length > 0 && (
        <>
          <p className="ai-coach-sub">Tuần tới</p>
          <ol>
            {value.nextWeek.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

export default function AiCoach({
  report,
  latest,
  checkups,
}: {
  report: ProgressReport;
  latest: CheckupResult | null;
  /** All checkups: the coach gets the same trend the report's own comments use. */
  checkups: readonly CheckupResult[];
}) {
  const status = useAiStatus();
  const input = useMemo(() => buildCoachInput(report, latest?.byPhenomenon ?? null, checkups), [report, latest, checkups]);
  const provider = status.text ? `${status.text.id}/${status.text.model}` : '';
  const key = aiCacheKey('coach', { provider, day: localDayKey(report.generatedAt), input });

  const run = async (signal: AbortSignal): Promise<CoachComment> => {
    const p = buildCoachPrompt(input);
    const raw = await aiJson<unknown>({
      system: p.system,
      messages: [{ role: 'user', content: p.user }],
      maxTokens: p.maxTokens,
      reasoning: 'off',
      json: { schema: p.schema, name: p.name },
      signal,
    });
    const clean = sanitizeCoach(raw, input);
    if (!clean) throw new Error(UNUSABLE_ANSWER);
    return clean;
  };

  // no provider: nothing at all (setup lives in Cài đặt → Trợ lý AI)
  if (!status.configured) return null;
  return (
    <div className="ai-coach">
      <AiAction<CoachComment>
        label="Nhận xét bằng AI"
        busyLabel="AI đang đọc số liệu…"
        cacheKey={key}
        run={run}
        render={(v) => <CoachView value={v} />}
      />
    </div>
  );
}
