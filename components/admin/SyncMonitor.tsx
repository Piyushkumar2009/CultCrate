'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, ExternalLink, RefreshCw, Rss, XCircle } from 'lucide-react';
import type { AdminResource } from '@/hooks/useAdminResource';
import { compactNumber, timeAgo } from '@/lib/adminFormat';
import type { SyncMonitorResponse, SyncState } from '@/lib/adminSync';
import { PANEL_CLASS, PanelHeader } from './adminUi';
import { Avatar, BTN_NEUTRAL, EmptyState, SectionError, SetupNotice, SkeletonRows, SyncBadge } from './adminUiKit';

type Filter = 'all' | SyncState;

const CHIP: Array<{ id: Filter; label: string; icon: typeof Rss; tone: string }> = [
  { id: 'all', label: 'All feeds', icon: Rss, tone: 'text-zinc-300' },
  { id: 'failed', label: 'Failed', icon: XCircle, tone: 'text-[#ff4d56]' },
  { id: 'pending', label: 'Pending', icon: CircleDashed, tone: 'text-[#F59E0B]' },
  { id: 'success', label: 'Success', icon: CheckCircle2, tone: 'text-[#4EDEAE]' },
];

interface SyncMonitorProps {
  resource: AdminResource<SyncMonitorResponse>;
  onOpenUser: (id: string, handle: string) => void;
  nowMs: number;
}

/** Read-only view of every curator’s Letterboxd RSS sync, broken feeds first. */
export default function SyncMonitor({ resource, onOpenUser, nowMs }: SyncMonitorProps) {
  const { data, error, loading, refreshing, reload } = resource;
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => (data ? data.entries.filter((e) => filter === 'all' || e.state === filter) : []), [data, filter]);

  return (
    <div className={`${PANEL_CLASS} space-y-5 p-5 sm:p-6`}>
      <PanelHeader
        icon={Rss}
        eyebrow="Platform health"
        title="Letterboxd sync monitor"
        subtitle="The result of each curator’s latest RSS sync. Failed feeds are listed first so broken ones are easy to spot."
        right={
          <button type="button" onClick={() => void reload()} disabled={refreshing} className={BTN_NEUTRAL}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </button>
        }
      />

      {loading && <SkeletonRows rows={6} />}
      {!loading && error && !data && <SectionError message={error.message} onRetry={() => void reload()} />}

      {data && (
        <>
          {data.notes.map((note) => <SetupNotice key={note} message={note} />)}

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by sync status">
            {CHIP.map((c) => {
              const count = c.id === 'all' ? data.counts.total : data.counts[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={filter === c.id}
                  onClick={() => setFilter(c.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all ${
                    filter === c.id ? 'border-white/25 bg-white/[0.08] font-semibold text-white' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white'
                  }`}
                >
                  <c.icon className={`h-3.5 w-3.5 ${c.tone}`} aria-hidden="true" />
                  {c.label} <span className="text-zinc-500">{count}</span>
                </button>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title={data.counts.total === 0 ? 'No linked Letterboxd feeds yet' : 'No feeds in this group'}
              body={data.counts.total === 0 ? 'Feeds appear here once curators connect their Letterboxd account.' : undefined}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-left">
                <thead className="bg-black/20">
                  <tr className="border-b border-white/[0.06] font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                    <th scope="col">Curator</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="hidden md:table-cell">Last attempt</th>
                    <th scope="col" className="hidden lg:table-cell">Last success</th>
                    <th scope="col" className="hidden lg:table-cell">Films</th>
                    <th scope="col" className="hidden sm:table-cell">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.userId} onClick={() => onOpenUser(e.userId, e.handle)} className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar handle={e.handle} size="sm" />
                          <div className="min-w-0">
                            <button type="button" className="block max-w-[160px] cursor-pointer truncate text-left text-sm font-semibold text-white hover:text-[#ff4d56]" aria-label={`Open details for ${e.handle}`}>@{e.handle}</button>
                            {e.letterboxdUrl && (
                              <a href={e.letterboxdUrl} onClick={(ev) => ev.stopPropagation()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500 hover:text-[#4EDEAE]">
                                letterboxd <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <SyncBadge state={e.state} />
                          {e.state === 'failed' && e.consecutiveFailures > 1 && <span className="font-mono text-[10px] text-[#ff4d56]">{e.consecutiveFailures} in a row</span>}
                          {e.stale && <span className="font-mono text-[10px] text-[#F59E0B]">Stale</span>}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-zinc-400 md:table-cell">{timeAgo(e.lastAttemptAt, nowMs, 'Never')}</td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-zinc-400 lg:table-cell">{timeAgo(e.lastSuccessAt, nowMs, 'Never')}</td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-zinc-400 lg:table-cell">{e.filmsSynced === null ? '—' : compactNumber(e.filmsSynced)}</td>
                      <td className="hidden max-w-[260px] px-4 py-3 sm:table-cell">
                        <p className={`line-clamp-2 text-xs leading-snug ${e.state === 'failed' ? 'text-red-200' : 'text-zinc-500'}`} title={e.message ?? undefined}>
                          {e.message ?? (e.state === 'pending' ? 'Waiting for the first sync' : '—')}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
