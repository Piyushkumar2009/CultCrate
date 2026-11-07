'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAdminResource } from '@/hooks/useAdminResource';
import type { HealthResponse, HealthState } from '@/lib/adminHealth';

const LOOK: Record<HealthState, { dot: string; text: string; label: string }> = {
  operational: { dot: 'bg-[#4EDEAE] shadow-[0_0_10px_rgba(78,222,174,0.8)]', text: 'text-[#4EDEAE]', label: 'All systems operational' },
  degraded: { dot: 'bg-[#F59E0B]', text: 'text-[#F59E0B]', label: 'Degraded performance' },
  down: { dot: 'bg-[#E50914] shadow-[0_0_10px_rgba(229,9,20,0.8)]', text: 'text-[#ff4d56]', label: 'Service disruption' },
};

/** Header status pill. Probes the database, auth and storage every minute; click for the details. */
export default function SystemStatus({ failedFeeds }: { failedFeeds: number }) {
  const { data, error, loading } = useAdminResource<HealthResponse>('/api/admin/health', { intervalMs: 60_000 });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const overall: HealthState | null = data ? data.overall : error ? 'down' : null;
  const look = overall ? LOOK[overall] : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-xs text-zinc-300 transition-colors hover:border-white/20"
      >
        <span className={`h-2 w-2 rounded-full ${look ? look.dot : 'animate-pulse bg-zinc-600'}`} />
        <span className={`hidden sm:inline ${look ? look.text : 'text-zinc-500'}`}>{loading ? 'Checking…' : look?.label ?? 'Status unknown'}</span>
        <ChevronDown className="h-3 w-3 text-zinc-500" aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-72 space-y-2.5 rounded-xl border border-white/[0.1] bg-[#0d111a] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          {error && !data && <p className="text-xs text-red-200">{error.message}</p>}
          {data?.checks.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 font-mono text-xs">
              <span className="flex items-center gap-2 text-zinc-300"><span className={`h-1.5 w-1.5 rounded-full ${LOOK[c.state].dot}`} />{c.label}</span>
              <span className="text-zinc-500">{c.state === 'down' ? 'Unreachable' : c.latencyMs === null ? '—' : `${c.latencyMs} ms`}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5 font-mono text-xs">
            <span className="flex items-center gap-2 text-zinc-300"><span className={`h-1.5 w-1.5 rounded-full ${failedFeeds > 0 ? 'bg-[#F59E0B]' : 'bg-[#4EDEAE]'}`} />Letterboxd feeds</span>
            <span className={failedFeeds > 0 ? 'text-[#F59E0B]' : 'text-zinc-500'}>{failedFeeds > 0 ? `${failedFeeds} failing` : 'Healthy'}</span>
          </div>
          {data && <p className="font-mono text-[10px] text-zinc-600">Checked at {new Date(data.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
      )}
    </div>
  );
}
