'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Trend } from '@/lib/adminTrends';
import { PANEL_CLASS } from './adminUi';
import { Sparkline, TrendBadge } from './adminUiKit';

interface KpiStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'green' | 'red';
  loading?: boolean;
  /** Week-over-week change. Leave out for numbers with no honest history (shown without an arrow). */
  trend?: Trend;
  spark?: ReadonlyArray<number>;
}

/** Compact KPI tile: big number, trend arrow versus the previous 7 days, and a tiny sparkline. */
export default function KpiStatCard({ icon: Icon, label, value, hint, tone = 'default', loading = false, trend, spark }: KpiStatCardProps) {
  const valueColor = tone === 'green' ? 'text-[#4EDEAE]' : tone === 'red' ? 'text-[#ff4d56]' : 'text-white';
  const iconBox =
    tone === 'green'
      ? 'border-[#4EDEAE]/30 bg-[#4EDEAE]/10 text-[#4EDEAE]'
      : tone === 'red'
      ? 'border-[#E50914]/30 bg-[#E50914]/10 text-[#E50914]'
      : 'border-white/10 bg-white/[0.04] text-zinc-300';

  return (
    <div className={`${PANEL_CLASS} flex flex-col justify-between gap-2 p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${iconBox}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>

      {loading ? (
        <span className="block h-8 w-20 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <div className="flex items-end justify-between gap-2">
          <span className={`truncate text-2xl font-semibold tracking-tight ${valueColor}`}>{value}</span>
          {spark && <Sparkline values={spark} tone={trend?.direction === 'down' ? 'red' : trend ? 'green' : 'muted'} />}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] leading-snug text-zinc-500">{hint}</span>
        {!loading && trend && <TrendBadge trend={trend} />}
      </div>
    </div>
  );
}
