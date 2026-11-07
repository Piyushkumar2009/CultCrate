'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

/** Same glass-panel surface used on the dashboard so the admin area feels like the same product. */
export const PANEL_CLASS =
  'relative rounded-2xl border border-white/[0.07] bg-[#0d111a]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_48px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl';

export function Eyebrow({ children, tone = 'red' }: { children: React.ReactNode; tone?: 'red' | 'green' | 'muted' }) {
  const color = tone === 'green' ? 'text-[#4EDEAE]' : tone === 'muted' ? 'text-zinc-500' : 'text-[#E50914]';
  return <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.2em] ${color}`}>{children}</span>;
}

export type PillTone = 'green' | 'red' | 'amber' | 'muted';

const PILL_TONES: Record<PillTone, string> = {
  green: 'border-[#4EDEAE]/40 bg-[#4EDEAE]/10 text-[#4EDEAE] shadow-[0_0_16px_-4px_rgba(78,222,174,0.6)]',
  red: 'border-[#E50914]/45 bg-[#E50914]/10 text-[#ff4d56] shadow-[0_0_16px_-4px_rgba(229,9,20,0.65)]',
  amber: 'border-amber-500/30 bg-amber-500/10 text-[#F59E0B]',
  muted: 'border-white/10 bg-white/[0.04] text-zinc-400',
};

export function Pill({ tone, icon: Icon, children }: { tone: PillTone; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${PILL_TONES[tone]}`}
    >
      {Icon ? <Icon className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function PanelHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  right,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E50914]/30 bg-[#E50914]/10 shadow-[0_0_20px_-6px_rgba(229,9,20,0.6)]">
          <Icon className="h-4 w-4 text-[#E50914]" />
        </div>
        <div className="leading-tight">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  loading = false,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: 'default' | 'green' | 'red';
  loading?: boolean;
}) {
  const valueColor = tone === 'green' ? 'text-[#4EDEAE]' : tone === 'red' ? 'text-[#ff4d56]' : 'text-white';
  const iconBox =
    tone === 'green'
      ? 'border-[#4EDEAE]/30 bg-[#4EDEAE]/10 text-[#4EDEAE]'
      : tone === 'red'
      ? 'border-[#E50914]/30 bg-[#E50914]/10 text-[#E50914]'
      : 'border-white/10 bg-white/[0.04] text-zinc-300';

  return (
    <div className={`${PANEL_CLASS} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconBox}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {loading ? (
        <span className="mt-3 block h-8 w-20 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <span className={`mt-2 block truncate text-2xl font-semibold tracking-tight sm:text-3xl ${valueColor}`}>{value}</span>
      )}
      <span className="mt-1 block text-xs leading-snug text-zinc-500">{hint}</span>
    </div>
  );
}
