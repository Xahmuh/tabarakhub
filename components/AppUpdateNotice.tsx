import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const CHECK_INTERVAL_MS = 60_000;

export const AppUpdateNotice: React.FC = () => {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    if (import.meta.env.DEV || document.visibilityState === 'hidden') return;

    try {
      const response = await fetch(`/version.json?check=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) return;

      const payload = await response.json() as { version?: string };
      if (payload.version && payload.version !== __APP_BUILD_ID__) {
        setAvailableVersion(payload.version);
      }
    } catch {
      // A failed version check should not interrupt normal app use.
    }
  }, []);

  useEffect(() => {
    void checkForUpdate();
    const intervalId = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
    const handleResume = () => void checkForUpdate();
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [checkForUpdate]);

  if (!availableVersion || dismissedVersion === availableVersion) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,460px)] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-xl"
    >
      <p className="text-sm font-bold text-slate-800">A new version is ready.</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setDismissedVersion(availableVersion)}
          className="rounded-md px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-2 text-xs font-black text-white hover:bg-red-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh now
        </button>
      </div>
    </div>
  );
};
