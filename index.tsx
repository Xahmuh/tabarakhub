
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';

const staleChunkRecoveryKey = 'tabarak:stale-chunk-recovery-count';
window.setTimeout(() => {
  try { sessionStorage.removeItem(staleChunkRecoveryKey); } catch { /* storage may be unavailable */ }
}, 30_000);

// If a deployment replaces a lazy-loaded asset while a tab is still open,
// Vite emits this event when the old hashed chunk can no longer be fetched.
// Reload once so the app picks up the current index and matching asset hashes.
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  try {
    const attempts = Number(sessionStorage.getItem(staleChunkRecoveryKey) || '0');
    if (attempts >= 2) return;
    sessionStorage.setItem(staleChunkRecoveryKey, String(attempts + 1));
    sessionStorage.removeItem('tabarak_active_tab');
  } catch { /* continue with a single recovery reload */ }
  window.location.reload();
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  import.meta.env.DEV ? (
    <React.StrictMode>
      <AppErrorBoundary>
        <React.Suspense fallback={null}>
          <App />
        </React.Suspense>
      </AppErrorBoundary>
    </React.StrictMode>
  ) : (
    <AppErrorBoundary>
      <React.Suspense fallback={null}>
        <App />
      </React.Suspense>
    </AppErrorBoundary>
  )
);
