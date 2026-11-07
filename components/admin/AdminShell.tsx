'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, LayoutDashboard, Megaphone, Menu, RefreshCw, Rss, ShieldCheck, Trophy, Users, X } from 'lucide-react';
import type { AdminSummary } from '@/lib/adminAnalytics';
import { compactNumber } from '@/lib/adminFormat';
import SystemStatus from './SystemStatus';
import { Pill } from './adminUi';

export type AdminTab = 'overview' | 'curators' | 'leaderboard' | 'sync' | 'announcements';

export const ADMIN_TABS: ReadonlyArray<{ id: AdminTab; label: string; title: string; icon: typeof Users }> = [
  { id: 'overview', label: 'Overview', title: 'Platform overview', icon: LayoutDashboard },
  { id: 'curators', label: 'Curators & Access', title: 'Curators & access', icon: Users },
  { id: 'leaderboard', label: 'Leaderboard', title: 'Community leaderboard', icon: Trophy },
  { id: 'sync', label: 'Sync Monitor', title: 'Letterboxd sync monitor', icon: Rss },
  { id: 'announcements', label: 'Announcements', title: 'Announcement banner', icon: Megaphone },
];

interface ShellProps {
  tab: AdminTab;
  onTab: (tab: AdminTab) => void;
  summary: AdminSummary | null;
  failedFeeds: number;
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}

function Nav({ tab, onTab, failedFeeds }: { tab: AdminTab; onTab: (t: AdminTab) => void; failedFeeds: number }) {
  return (
    <nav aria-label="Admin sections" className="space-y-1">
      {ADMIN_TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            aria-current={active ? 'page' : undefined}
            className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
              active ? 'border-[#E50914]/40 bg-[#E50914]/10 font-semibold text-white shadow-[0_0_20px_-8px_rgba(229,9,20,0.7)]' : 'border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            <t.icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#E50914]' : 'text-zinc-500 group-hover:text-zinc-300'}`} aria-hidden="true" />
            <span className="flex-1 truncate">{t.label}</span>
            {t.id === 'sync' && failedFeeds > 0 && (
              <span className="rounded-full bg-[#E50914] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white" aria-label={`${failedFeeds} failing feeds`}>{failedFeeds}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Link href="/dashboard" className="select-none text-xl font-extrabold tracking-tight text-white">
        Cult<span className="text-[#E50914]">Crate</span>
      </Link>
      <Pill tone="red" icon={ShieldCheck}>Admin</Pill>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="leading-tight">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className="font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

/** Sidebar navigation + sticky top header (system status, live metrics) around every admin section. */
export default function AdminShell({ tab, onTab, summary, failedFeeds, refreshing, onRefresh, children }: ShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current = ADMIN_TABS.find((t) => t.id === tab) ?? ADMIN_TABS[0];
  const kpis = summary?.kpis;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const go = (t: AdminTab): void => {
    setDrawerOpen(false);
    onTab(t);
  };

  return (
    <div className="relative min-h-screen bg-[#090D16] font-sans text-[#F9FAFB] selection:bg-[#E50914] selection:text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(229,9,20,0.13),transparent)]" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-white/[0.06] bg-[#0b0f18]/95 p-5 backdrop-blur-xl lg:flex">
        <Brand />
        <Nav tab={tab} onTab={go} failedFeeds={failedFeeds} />
        <Link href="/dashboard" className="mt-auto flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 font-mono text-xs text-zinc-300 transition-colors hover:border-[#E50914]/50 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5 text-[#E50914]" aria-hidden="true" /> Back to app
        </Link>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 32, stiffness: 320 }} className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 border-r border-white/[0.08] bg-[#0b0f18] p-5">
              <div className="flex items-center justify-between"><Brand /><button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="cursor-pointer rounded-lg border border-white/[0.08] p-1.5 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button></div>
              <Nav tab={tab} onTab={go} failedFeeds={failedFeeds} />
              <Link href="/dashboard" className="mt-auto flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 font-mono text-xs text-zinc-300"><ArrowLeft className="h-3.5 w-3.5 text-[#E50914]" aria-hidden="true" /> Back to app</Link>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#090D16]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-zinc-300 hover:text-white lg:hidden">
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">{current.title}</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-5 xl:flex" aria-label="Live metrics">
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#4EDEAE]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4EDEAE]" />Live</span>
              <Metric label="Curators" value={kpis ? compactNumber(kpis.totalCurators) : '—'} />
              <Metric label="Active 30d" value={kpis ? compactNumber(kpis.activeThisMonth) : '—'} />
              <Metric label="Films" value={kpis ? compactNumber(kpis.filmsLogged) : '—'} />
            </div>
            <SystemStatus failedFeeds={failedFeeds} />
            <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh data" className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-xs text-zinc-300 transition-all hover:border-[#4EDEAE]/50 hover:text-white active:scale-95 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 text-[#4EDEAE] ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
