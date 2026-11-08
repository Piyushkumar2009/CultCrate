'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Catches anything that throws while the dashboard is rendering, so a single bad piece of data shows a retry
 * screen instead of a blank page. (Errors inside the Run AI Engine request are handled in the button itself.)
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Dashboard] render error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#090D16] px-4 font-sans text-[#F9FAFB]">
      <div role="alert" className="w-full max-w-md space-y-4 rounded-2xl border border-[#E50914]/40 bg-[#121620]/90 p-7 text-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]">
        <AlertTriangle className="mx-auto h-8 w-8 text-[#E50914]" aria-hidden="true" />
        <h1 className="text-lg font-bold text-white">Something went wrong on this page</h1>
        <p className="text-xs leading-relaxed text-[#9CA3AF]">
          Your films and picks are safe. Try again, and if it keeps happening, refresh the page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#B80710]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </div>
  );
}
