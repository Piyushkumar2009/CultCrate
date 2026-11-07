'use client';

import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Eye, Film, Flame, Medal, Sparkles, Trophy } from 'lucide-react';
import { useAdminResource } from '@/hooks/useAdminResource';
import { compactNumber, timeAgo } from '@/lib/adminFormat';
import type { LeaderboardEntry, LeaderboardMetric, LeaderboardResponse, RankBadge } from '@/lib/adminLeaderboard';
import { PANEL_CLASS, PanelHeader, Pill } from './adminUi';
import { Avatar, BTN_NEUTRAL, EmptyState, SectionError, SkeletonRows } from './adminUiKit';

const METRICS: Array<{ id: LeaderboardMetric; label: string; unit: string; icon: typeof Film }> = [
  { id: 'films', label: 'Most films logged', unit: 'films', icon: Film },
  { id: 'streak', label: 'Active streaks', unit: 'day streak', icon: Flame },
  { id: 'recommendations', label: 'Most recommendations', unit: 'picks', icon: Sparkles },
];

const BADGE_STYLE: Record<RankBadge, { ring: string; text: string; bg: string; label: string }> = {
  gold: { ring: 'border-[#F59E0B]/60', text: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', label: 'Gold' },
  silver: { ring: 'border-zinc-300/50', text: 'text-zinc-200', bg: 'bg-zinc-300/10', label: 'Silver' },
  bronze: { ring: 'border-[#CD7F32]/60', text: 'text-[#d98c4a]', bg: 'bg-[#CD7F32]/10', label: 'Bronze' },
};

export function RankBadgeIcon({ rank, badge }: { rank: number; badge: RankBadge | null }) {
  if (!badge) {
    return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] font-mono text-xs font-bold text-zinc-400" aria-label={`Rank ${rank}`}>{rank}</span>;
  }
  const s = BADGE_STYLE[badge];
  const Icon = badge === 'gold' ? Trophy : Medal;
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${s.ring} ${s.bg} ${s.text}`} aria-label={`Rank ${rank}, ${s.label}`} title={`${s.label} · #${rank}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function QuickActions({ entry, onOpen }: { entry: LeaderboardEntry; onOpen: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`@${entry.handle}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked; nothing to do */
    }
  };
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onOpen} className={BTN_NEUTRAL} aria-label={`View ${entry.handle}`}>
        <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View
      </button>
      {entry.letterboxdHandle && (
        <a href={`https://letterboxd.com/${encodeURIComponent(entry.letterboxdHandle)}/`} target="_blank" rel="noopener noreferrer" className={BTN_NEUTRAL} aria-label={`Open ${entry.handle} on Letterboxd`}>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
      <button type="button" onClick={() => void copy()} className={BTN_NEUTRAL} aria-label={`Copy @${entry.handle}`}>
        {copied ? <Check className="h-3.5 w-3.5 text-[#4EDEAE]" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
    </div>
  );
}

function Stats({ entry, active }: { entry: LeaderboardEntry; active: LeaderboardMetric }) {
  const cell = (metric: LeaderboardMetric, icon: React.ReactNode, value: string, label: string) => (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] ${active === metric ? 'font-semibold text-white' : 'text-zinc-500'}`} title={label}>
      {icon}
      {value}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {cell('films', <Film className="h-3 w-3" aria-hidden="true" />, `${compactNumber(entry.filmsLogged)} films`, 'Films logged')}
      {cell('streak', <Flame className="h-3 w-3" aria-hidden="true" />, entry.currentStreak === null ? '— streak' : `${entry.currentStreak}d streak`, 'Current streak')}
      {cell('recommendations', <Sparkles className="h-3 w-3" aria-hidden="true" />, `${entry.recommendations} picks`, 'Latest recommendation batch')}
    </div>
  );
}

function PodiumCard({ entry, metric, unit, onOpen, nowMs }: { entry: LeaderboardEntry; metric: LeaderboardMetric; unit: string; onOpen: () => void; nowMs: number }) {
  const s = entry.badge ? BADGE_STYLE[entry.badge] : null;
  const order = entry.rank === 1 ? 'md:order-2' : entry.rank === 2 ? 'md:order-1' : 'md:order-3';
  return (
    <div className={`${PANEL_CLASS} ${order} space-y-4 p-5 ${s ? s.ring : ''} ${entry.rank === 1 ? 'shadow-[0_0_40px_-12px_rgba(245,158,11,0.45)]' : ''}`}>
      <div className="flex items-center justify-between">
        <RankBadgeIcon rank={entry.rank} badge={entry.badge} />
        {s && <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${s.text}`}>{s.label}</span>}
      </div>
      <div className="flex items-center gap-3">
        <Avatar handle={entry.handle} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">@{entry.handle}</p>
          <p className="font-mono text-[11px] text-zinc-500">Seen {timeAgo(entry.lastSeenAt, nowMs, 'never').toLowerCase()}</p>
        </div>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-white">
        {compactNumber(entry.value)} <span className="text-xs font-normal text-zinc-500">{unit}</span>
      </p>
      <Stats entry={entry} active={metric} />
      <QuickActions entry={entry} onOpen={onOpen} />
    </div>
  );
}

function LeaderboardList({ metric, onOpenUser, nowMs }: { metric: LeaderboardMetric; onOpenUser: (id: string, handle: string) => void; nowMs: number }) {
  const { data, error, loading, reload } = useAdminResource<LeaderboardResponse>(`/api/admin/leaderboard?metric=${metric}&limit=25`);
  const unit = METRICS.find((m) => m.id === metric)?.unit ?? '';

  if (loading) return <SkeletonRows rows={6} />;
  if (error || !data) return <SectionError message={error?.message ?? "We couldn't load the leaderboard."} onRetry={() => void reload()} />;
  if (data.entries.length === 0) {
    return <EmptyState title="Nothing to rank yet" body={metric === 'streak' ? 'No one has a live streak right now. Streaks count consecutive days with a logged film.' : 'Rankings appear as curators log films and generate recommendations.'} />;
  }

  const top = data.entries.slice(0, 3);
  const rest = data.entries.slice(3);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3 md:items-end">
        {top.map((e) => (
          <PodiumCard key={e.userId} entry={e} metric={metric} unit={unit} nowMs={nowMs} onOpen={() => onOpenUser(e.userId, e.handle)} />
        ))}
      </div>

      {rest.length > 0 && (
        <ol className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
          {rest.map((e) => (
            <li key={e.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-white/[0.02]">
              <RankBadgeIcon rank={e.rank} badge={e.badge} />
              <Avatar handle={e.handle} size="sm" />
              <div className="min-w-0 flex-1 basis-40">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">@{e.handle}{e.role === 'admin' && <Pill tone="red">Admin</Pill>}</p>
                <Stats entry={e} active={metric} />
              </div>
              <QuickActions entry={e} onOpen={() => onOpenUser(e.userId, e.handle)} />
            </li>
          ))}
        </ol>
      )}

      {metric === 'streak' && (
        <p className="font-mono text-[11px] leading-relaxed text-zinc-500">
          Streaks come from each curator’s watch dates, so they are measured for the {data.streakCandidates} busiest libraries only. A streak counts if the last log was today or yesterday.
        </p>
      )}
    </div>
  );
}

export default function LeaderboardSection({ onOpenUser, nowMs }: { onOpenUser: (id: string, handle: string) => void; nowMs: number }) {
  const [metric, setMetric] = useState<LeaderboardMetric>('films');
  return (
    <div className={`${PANEL_CLASS} space-y-5 p-5 sm:p-6`}>
      <PanelHeader icon={Trophy} eyebrow="Community" title="Leaderboard" subtitle="Your most engaged curators. Ties share a rank." />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard metric">
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={metric === m.id}
            onClick={() => setMetric(m.id)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all ${
              metric === m.id ? 'border-[#E50914]/50 bg-[#E50914]/10 font-semibold text-[#ff4d56] shadow-[0_0_16px_-6px_rgba(229,9,20,0.7)]' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white'
            }`}
          >
            <m.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {m.label}
          </button>
        ))}
      </div>
      <LeaderboardList key={metric} metric={metric} onOpenUser={onOpenUser} nowMs={nowMs} />
    </div>
  );
}
