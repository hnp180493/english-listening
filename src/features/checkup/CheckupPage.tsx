// "Kiểm tra định kỳ": a 10-minute listening check (10 dictation sentences + 4 passages) taken every ~2 weeks.
// Scoring/storage: src/core/benchmark.ts. Step machine: ./checkupModel.ts. Nothing here records practice attempts.

import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import {
  buildCheckupResult,
  clearCheckupDraft,
  loadCheckupDraft,
  nextForm,
  saveCheckupDraft,
  saveCheckupResult,
  useCheckups,
  type CheckupResult,
} from '../../core/benchmark';
import { BENCHMARK_FORMS } from '../../data/benchmark';
import CheckupIntro from './CheckupIntro';
import { beginTest, newTest, resumeDraft, type TestState } from './checkupModel';
import CheckupResultView from './CheckupResultView';
import CheckupTest from './CheckupTest';
import { useVoiceName } from './useCheckupAudio';
import '../dictation/dictation.css'; // DiffView / Meaning on the result screen
import './checkup.css';

type View = { kind: 'intro' } | { kind: 'test'; resumed: boolean } | { kind: 'result'; id: string; justFinished: boolean; saveFailed: boolean };

const SHORTCUTS = [
  { keys: ['Enter'], text: 'Nghe (lần đầu), rồi sang câu tiếp' },
  { keys: ['Esc'], text: 'Nghe lại (nếu còn lượt)' },
  { keys: ['1–4'], text: 'Chọn đáp án (phần 2)' },
];

function initial(): { test: TestState | null; view: View } {
  const test = resumeDraft(loadCheckupDraft(), BENCHMARK_FORMS);
  return { test, view: test ? { kind: 'test', resumed: true } : { kind: 'intro' } };
}

export default function CheckupPage() {
  const results = useCheckups();
  const voiceName = useVoiceName();
  const [init] = useState(initial);
  const [test, setTest] = useState<TestState | null>(init.test);
  const [view, setView] = useState<View>(init.view);
  // The just-finished result, in case storage refused it and the store does not list it.
  const [local, setLocal] = useState<CheckupResult | null>(null);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [view.kind]);

  const update = useCallback((next: TestState) => {
    setTest(next);
    saveCheckupDraft(next);
  }, []);

  const form = test ? (BENCHMARK_FORMS.find((f) => f.id === test.form) ?? null) : null;
  const upcoming = nextForm(results, BENCHMARK_FORMS);

  const start = () => {
    if (!upcoming) return;
    const now = Date.now();
    update(beginTest(newTest(upcoming.id, now, voiceName), now));
    setView({ kind: 'test', resumed: false });
  };

  const finish = (s: TestState) => {
    const f = BENCHMARK_FORMS.find((x) => x.id === s.form);
    if (!f) return;
    const result = buildCheckupResult({
      form: f,
      dictation: s.dictation,
      comprehension: s.comprehension,
      voiceName: s.voiceName ?? voiceName,
      startedAt: s.startedAt,
      now: Date.now(),
    });
    const ok = saveCheckupResult(result); // also clears the draft
    setLocal(result);
    setTest(null);
    setView({ kind: 'result', id: result.id, justFinished: true, saveFailed: !ok });
  };

  const abandon = () => {
    clearCheckupDraft();
    setTest(null);
    setView({ kind: 'intro' });
  };

  if (view.kind === 'test' && test && form) {
    return (
      <div className="stack-lg page-focus ck-page">
        <PageHeader title="Kiểm tra định kỳ" subtitle="Bài nghe 10 phút để đo tiến bộ." help={<ShortcutsHelp items={SHORTCUTS} />} />
        <CheckupTest form={form} state={test} voiceName={voiceName} resumed={view.resumed} onChange={update} onFinish={finish} onAbandon={abandon} />
      </div>
    );
  }

  if (view.kind === 'result') {
    const result = results.find((r) => r.id === view.id) ?? (local?.id === view.id ? local : null);
    if (result) {
      const list = results.some((r) => r.id === result.id) ? results : [...results, result];
      return (
        <div className="stack-lg page-focus ck-page">
          <PageHeader title="Kết quả kiểm tra" subtitle="Điểm 0–100: 60% chép chính tả, 40% nghe hiểu." />
          <CheckupResultView
            result={result}
            results={list}
            form={BENCHMARK_FORMS.find((f) => f.id === result.form) ?? null}
            justFinished={view.justFinished}
            saveFailed={view.saveFailed}
            onBack={() => setView({ kind: 'intro' })}
          />
        </div>
      );
    }
  }

  return (
    <div className="stack-lg page-focus ck-page">
      <PageHeader title="Kiểm tra định kỳ" subtitle="Bài nghe 10 phút để đo tiến bộ." />
      <CheckupIntro
        form={upcoming}
        results={results}
        voiceName={voiceName}
        onStart={start}
        onShowResult={(id) => setView({ kind: 'result', id, justFinished: false, saveFailed: false })}
      />
    </div>
  );
}
