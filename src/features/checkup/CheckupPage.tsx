// "Kiểm tra định kỳ": a 10-minute listening check (10 dictation sentences + 4 passages) taken every ~2 weeks.
// Scoring/storage: src/core/benchmark.ts. Step machine: ./checkupModel.ts. Nothing here records practice attempts.

import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import {
  buildCheckupResult,
  clearCheckupDraft,
  loadAbandoned,
  loadCheckupDraft,
  nextForm,
  recordAbandoned,
  saveCheckupDraft,
  saveCheckupResult,
  useCheckups,
  wasAbandoned,
  type CheckupResult,
} from '../../core/benchmark';
import { BENCHMARK_FORMS } from '../../data/benchmark';
import CheckupIntro from './CheckupIntro';
import { beginTest, newTest, noteVoice, resumeDraft, type TestState } from './checkupModel';
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
  // Latest test state for callbacks that arrive after an await (the voice that actually spoke).
  const testRef = useRef<TestState | null>(init.test);
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
    testRef.current = next;
    setTest(next);
    saveCheckupDraft(next);
  }, []);

  const voiceHeard = useCallback(
    (label: string | null) => {
      const cur = testRef.current;
      if (!cur) return;
      const next = noteVoice(cur, label);
      if (next !== cur) update(next);
    },
    [update],
  );

  const form = test ? (BENCHMARK_FORMS.find((f) => f.id === test.form) ?? null) : null;
  const [abandoned, setAbandoned] = useState(loadAbandoned);
  const upcoming = nextForm(results, BENCHMARK_FORMS, abandoned);

  const start = () => {
    if (!upcoming) return;
    const now = Date.now();
    update(beginTest(newTest(upcoming.id, now, null), now)); // the voice is recorded when it actually speaks
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
      seenBefore: wasAbandoned(abandoned, s.form, s.startedAt),
    });
    const ok = saveCheckupResult(result); // also clears the draft
    setLocal(result);
    testRef.current = null;
    setTest(null);
    setView({ kind: 'result', id: result.id, justFinished: true, saveFailed: !ok });
  };

  const abandon = () => {
    const cur = testRef.current;
    // Something was heard: this form is used up (the next start gives another form, a later result is flagged).
    const heard = cur && [...Object.values(cur.dictation), ...Object.values(cur.comprehension)].some((a) => (a?.plays ?? 0) > 0);
    if (cur && heard) {
      recordAbandoned(cur.form);
      setAbandoned(loadAbandoned());
    }
    clearCheckupDraft();
    testRef.current = null;
    setTest(null);
    setView({ kind: 'intro' });
  };

  if (view.kind === 'test' && test && form) {
    return (
      <div className="stack-lg page-focus ck-page">
        <PageHeader title="Kiểm tra định kỳ" subtitle="Bài nghe 10 phút để đo tiến bộ." help={<ShortcutsHelp items={SHORTCUTS} />} />
        <CheckupTest form={form} state={test} resumed={view.resumed} onChange={update} onVoice={voiceHeard} onFinish={finish} onAbandon={abandon} />
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
