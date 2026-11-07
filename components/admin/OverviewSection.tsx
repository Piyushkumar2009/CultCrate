'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Activity, AlertTriangle, Clapperboard, Film, Library, ShieldCheck, Sparkles, UserPlus, Users } from 'lucide-react';
import type { AdminSummary } from '@/lib/adminAnalytics';
import { compactNumber } from '@/lib/adminFormat';
import { computeTrend } from '@/lib/adminTrends';
import { PANEL_CLASS } from './adminUi';
import KpiStatCard from './KpiStatCard';

// Charts load in the browser only, which keeps the charting library off every other page
const AdminCharts = dynamic(() => import('./AdminCharts'), {
  ssr: false,
  loading: () => <div className={`${PANEL_CLASS} h-[360px] animate-pulse`} />,
});

/** Headline KPI tiles (with week-over-week trends) and the existing analytics charts. */
export default function OverviewSection({ summary }: { summary: AdminSummary | null }) {
  const kpis = summary?.kpis;

  const series = useMemo(() => {
    if (!summary) return null;
    const newCurators = summary.growth.map((g) => g.newCurators);
    const runs = summary.activity.map((a) => a.runs);
    return { newCurators, runs, newTrend: computeTrend(newCurators), runsTrend: computeTrend(runs) };
  }, [summary]);

  const loading = !kpis;
  return (
    <div className="space-y-6">
      {summary && (summary.notes.length > 0 || summary.truncated) && (
        <div className="space-y-1.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3">
          {[...summary.notes, ...(summary.truncated ? ['You have a very large community, so only the first 5,000 curators are shown.'] : [])].map((note) => (
            <p key={note} className="flex items-start gap-2 text-xs leading-relaxed text-amber-200/90">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F59E0B]" aria-hidden="true" />
              {note}
            </p>
          ))}
        </div>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <KpiStatCard icon={Users} label="Total curators" loading={loading} value={kpis ? compactNumber(kpis.totalCurators) : ''} hint={series ? `+${series.newTrend.current} in the last 7 days` : ''} trend={series?.newTrend} spark={series?.newCurators.slice(-14)} />
        <KpiStatCard icon={UserPlus} label="New this week" tone="green" loading={loading} value={kpis ? compactNumber(kpis.newThisWeek) : ''} hint="Joined in the last 7 days" trend={series?.newTrend} spark={series?.newCurators.slice(-14)} />
        <KpiStatCard icon={Activity} label="Active this month" tone="green" loading={loading} value={kpis ? compactNumber(kpis.activeThisMonth) : ''} hint="Signed in within 30 days" />
        <KpiStatCard icon={Sparkles} label="Recommendation runs" tone="red" loading={loading} value={kpis ? compactNumber(kpis.recommendationRunsThisWeek) : ''} hint="Latest runs in the last 7 days" trend={series?.runsTrend} spark={series?.runs.slice(-14)} />
        <KpiStatCard icon={Film} label="Films logged" loading={loading} value={kpis ? compactNumber(kpis.filmsLogged) : ''} hint="Across curators’ libraries" />
        <KpiStatCard icon={Clapperboard} label="Curators with picks" loading={loading} value={kpis ? compactNumber(kpis.curatorsWithRecommendations) : ''} hint="Have generated recommendations" />
        <KpiStatCard icon={Library} label="Libraries linked" tone="green" loading={loading} value={kpis ? (kpis.librariesLinked === null ? '—' : compactNumber(kpis.librariesLinked)) : ''} hint="Letterboxd libraries connected" />
        <KpiStatCard icon={ShieldCheck} label="Admins" tone="red" loading={loading} value={kpis ? compactNumber(kpis.admins) : ''} hint="People who can use this panel" />
      </section>

      {summary && <AdminCharts growth={summary.growth} activity={summary.activity} genres={summary.genres} countries={summary.countries} />}
      {loading && <div className={`${PANEL_CLASS} h-[360px] animate-pulse`} />}
    </div>
  );
}
