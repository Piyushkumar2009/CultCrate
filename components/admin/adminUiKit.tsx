'use client';

import React from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, KeyRound, Minus, RefreshCw } from 'lucide-react';
import type { Trend } from '@/lib/adminTrends';
import type { SyncState } from '@/lib/adminSync';
import { Pill, type PillTone } from './adminUi';

/** Shared button / input styles so every admin screen looks and behaves the same. */
export const BTN_BASE =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_NEUTRAL = `${BTN_BASE} border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:text-white`;
export const BTN_GREEN = `${BTN_BASE} border-[#4EDEAE]/40 bg-[#4EDEAE]/10 text-[#4EDEAE] hover:bg-[#4EDEAE] hover:text-black`;
export const BTN_RED = `${BTN_BASE} border-[#E50914]/40 bg-[#E50914]/10 text-[#ff4d56] hover:bg-[#E50914] hover:text-white`;
export const BTN_SOLID_RED = `${BTN_BASE} border-transparent bg-[#E50914] px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_24px_-6px_rgba(229,9,20,0.7)] hover:bg-[#b80710]`;
export const INPUT_CLASS =
  'w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 font-mono text-xs text-white placeholder:text-zinc-600 focus:border-[#E50914]/60 focus:outline-none focus:ring-2 focus:ring-[#E50914]/20';

export function Avatar({ handle, size = 'md' }: { handle: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-xs';
  return (
    <span
      aria-hidden="true"
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-gradient-to-br from-[#1a1f2c] to-[#0d111a] font-mono font-bold uppercase text-zinc-300`}
    >
      {handle.slice(0, 1) || '?'}
    </span>
  );
}

export function Spinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return <RefreshCw className={`${className} animate-spin`} aria-hidden="true" />;
}

const SYNC_PILL: Record<SyncState | 'not_linked', { tone: PillTone; text: string }> = {
  success: { tone: 'green', text: 'Success' },
  pending: { tone: 'amber', text: 'Pending' },
  failed: { tone: 'red', text: 'Failed' },
  not_linked: { tone: 'muted', text: 'Not linked' },
};

export function SyncBadge({ state }: { state: SyncState | 'not_linked' }) {
  const { tone, text } = SYNC_PILL[state];
  return <Pill tone={tone}>{text}</Pill>;
}

/** Up/down arrow with the percentage. Green is good, red is bad; a missing baseline reads "New". */
export function TrendBadge({ trend }: { trend: Trend }) {
  if (trend.direction === 'flat') {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold text-zinc-500">
        <Minus className="h-3 w-3" aria-hidden="true" /> 0%
      </span>
    );
  }
  const up = trend.direction === 'up';
  const label = trend.deltaPct === null ? 'New' : `${up ? '+' : ''}${trend.deltaPct}%`;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
        up ? 'bg-[#4EDEAE]/10 text-[#4EDEAE]' : 'bg-[#E50914]/10 text-[#ff4d56]'
      }`}
      aria-label={`${up ? 'Up' : 'Down'} ${label} versus the previous 7 days`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
      {label}
    </span>
  );
}

export function Sparkline({ values, tone = 'green' }: { values: ReadonlyArray<number>; tone?: 'green' | 'red' | 'muted' }) {
  if (values.length < 2) return null;
  const w = 80;
  const h = 24;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
  const stroke = tone === 'green' ? '#4EDEAE' : tone === 'red' ? '#ff4d56' : '#71717a';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-20" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      {body && <p className="mt-1 text-xs text-zinc-500">{body}</p>}
    </div>
  );
}

export function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E50914]/40 bg-[#1a080a]/90 px-4 py-3">
      <p className="flex items-center gap-2.5 text-sm text-red-100">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#ff4d56]" aria-hidden="true" />
        {message}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={BTN_NEUTRAL}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

export function SetupNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-amber-200/90">{message}</p>
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
      ))}
    </div>
  );
}
