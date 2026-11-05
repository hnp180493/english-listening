import { useEffect, useState } from 'react';
import DecoderPage from './features/decoder/DecoderPage';
import DictationPage from './features/dictation/DictationPage';
import DrillPage from './features/drill/DrillPage';
import StatsPage from './features/stats/StatsPage';
import SettingsPanel from './features/stats/SettingsPanel';
import './App.layout.css';

type Tab = 'decoder' | 'dictation' | 'drill' | 'stats';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'decoder', label: 'Giải mã câu', hint: 'Xem câu được nói ra như thế nào' },
  { id: 'dictation', label: 'Chép chính tả', hint: 'Nghe và gõ lại từng câu' },
  { id: 'drill', label: 'Cụm từ', hint: 'Luyện các cụm hay bị nói nhanh' },
  { id: 'stats', label: 'Tiến độ', hint: 'Bạn đang yếu phần nào' },
];

function readHash(): Tab {
  const h = window.location.hash.replace('#', '') as Tab;
  return TABS.some((t) => t.id === h) ? h : 'decoder';
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readHash);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const onHash = () => setTab(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    window.location.hash = t;
    setTab(t);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo" aria-hidden="true">
            ◖◗
          </span>
          <div>
            <div className="app-title">Nghe Nối Âm</div>
            <div className="app-sub muted">Luyện tai nghe tiếng Anh bản xứ</div>
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => setSettingsOpen((v) => !v)} aria-expanded={settingsOpen}>
          ⚙ Giọng đọc
        </button>
      </header>

      {settingsOpen && (
        <div className="app-settings">
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        </div>
      )}

      <nav className="app-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={'app-tab' + (tab === t.id ? ' is-active' : '')}
            onClick={() => go(t.id)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'decoder' && <DecoderPage />}
        {tab === 'dictation' && <DictationPage />}
        {tab === 'drill' && <DrillPage />}
        {tab === 'stats' && <StatsPage onNavigate={go} />}
      </main>
    </div>
  );
}
