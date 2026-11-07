import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fonts.css';
import './index.css';
import { initFolderSync } from './core/folderSyncController';
import { reloadReview } from './core/review/api';
import { getSettings, reloadSettings } from './core/settings';
import { reloadStats } from './core/stats';
import { applyTheme } from './core/theme';
import App from './App';
import RootBoundary from './components/RootBoundary';

/** Runs one boot step; a failure (e.g. unreadable stored data) is logged and the app still renders. */
function safely(step: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    console.warn(`Khởi động: bỏ qua bước "${step}" do lỗi`, e);
  }
}

// Apply the saved theme before the first paint of React content.
safely('theme', () => applyTheme(getSettings().theme));

async function boot() {
  // Folder sync (OneDrive): if a folder is connected and still allowed, bring this browser's data in
  // step with the folder file before anything reads it. Never waits longer than ~1.5 s.
  try {
    await initFolderSync(1500);
  } catch {
    // sync is optional; the app works on local data
  }
  // Settings/stats were read at import time; pick up whatever the sync wrote.
  safely('settings', reloadSettings);
  safely('stats', reloadStats);
  safely('review', reloadReview);
  safely('theme', () => applyTheme(getSettings().theme));

  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <RootBoundary>
          <App />
        </RootBoundary>
      </StrictMode>,
    );
  }
}

void boot();

// Offline support: only in production builds (the dev server serves modules that must not be cached).
// Skipped for the portable single-file build opened from disk (file://), where service workers cannot run.
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline mode is optional; the app works without it.
    });
  });
}
