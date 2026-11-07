'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, Search, ShieldCheck, ShieldOff, Users } from 'lucide-react';
import type { AccountStatus, AdminUserRow } from '@/lib/adminAnalytics';
import { formatDate, timeAgo } from '@/lib/adminFormat';
import { PANEL_CLASS, PanelHeader, Pill, type PillTone } from './adminUi';
import { Avatar, BTN_GREEN, BTN_NEUTRAL, BTN_RED, EmptyState, INPUT_CLASS } from './adminUiKit';
import ConfirmDialog from './ConfirmDialog';

const PAGE_SIZE = 10;

type RoleFilter = 'all' | 'admins' | 'curators';
type SortKey = 'handle' | 'role' | 'joined' | 'lastSeen';
interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

const STATUS_LABEL: Record<AccountStatus, { text: string; tone: PillTone }> = {
  active: { text: 'Active', tone: 'green' },
  inactive: { text: 'Inactive', tone: 'muted' },
  pending: { text: 'Unconfirmed', tone: 'amber' },
  suspended: { text: 'Suspended', tone: 'red' },
};

const time = (iso: string | null): number => (iso ? Date.parse(iso) || 0 : 0);

function compare(a: AdminUserRow, b: AdminUserRow, key: SortKey): number {
  switch (key) {
    case 'handle':
      return a.handle.localeCompare(b.handle);
    case 'role':
      return a.role.localeCompare(b.role);
    case 'joined':
      return time(a.joinedAt) - time(b.joinedAt);
    case 'lastSeen':
      return time(a.lastSeenAt) - time(b.lastSeenAt);
  }
}

interface CuratorsTableProps {
  users: AdminUserRow[];
  currentUserId: string;
  nowMs: number;
  onOpen: (user: AdminUserRow) => void;
  /** Resolves to an error message, or null when the change worked */
  onChangeAccess: (user: AdminUserRow, makeAdmin: boolean) => Promise<string | null>;
}

export default function CuratorsTable({ users, currentUserId, nowMs, onOpen, onChangeAccess }: CuratorsTableProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<{ user: AdminUserRow; makeAdmin: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const admins = users.filter((u) => u.role === 'admin').length;
    return { all: users.length, admins, curators: users.length - admins };
  }, [users]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    const filtered = users.filter((u) => {
      if (filter === 'admins' && u.role !== 'admin') return false;
      if (filter === 'curators' && u.role !== 'curator') return false;
      return !q || u.handle.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
    if (!sort) return filtered;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => sign * compare(a, b, sort.key));
  }, [users, query, filter, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey): void => {
    setPage(0);
    setSort((prev) => (prev?.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null));
  };

  const confirm = async (): Promise<void> => {
    if (!pending) return;
    setBusy(true);
    setModalError(null);
    const error = await onChangeAccess(pending.user, pending.makeAdmin);
    setBusy(false);
    if (error) setModalError(error);
    else setPending(null);
  };

  const header = (key: SortKey, label: string, className = '') => {
    const active = sort?.key === key;
    const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
    return (
      <th scope="col" className={`pb-3 pr-4 font-semibold ${className}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => toggleSort(key)} className={`inline-flex cursor-pointer items-center gap-1 uppercase tracking-[0.14em] transition-colors hover:text-white ${active ? 'text-white' : ''}`}>
          {label}
          <Icon className="h-3 w-3" aria-hidden="true" />
        </button>
      </th>
    );
  };

  const chips: Array<{ id: RoleFilter; label: string; count: number }> = [
    { id: 'all', label: 'Everyone', count: counts.all },
    { id: 'admins', label: 'Admins', count: counts.admins },
    { id: 'curators', label: 'Curators', count: counts.curators },
  ];

  return (
    <div className={`${PANEL_CLASS} space-y-5 p-5 sm:p-6`}>
      <PanelHeader icon={Users} eyebrow="People" title="Curators & access" subtitle="Click anyone to see their activity, manage their access, or remove their account." />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="relative block w-full md:max-w-sm">
          <span className="sr-only">Search curators</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name or email"
            className={`${INPUT_CLASS} pl-10`}
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by access">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={filter === chip.id}
              onClick={() => {
                setFilter(chip.id);
                setPage(0);
              }}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all ${
                filter === chip.id
                  ? 'border-[#E50914]/50 bg-[#E50914]/10 font-semibold text-[#ff4d56] shadow-[0_0_16px_-6px_rgba(229,9,20,0.7)]'
                  : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white'
              }`}
            >
              {chip.label} <span className="ml-1 text-zinc-500">{chip.count}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No one matches that search" body="Try a different name or email, or switch the filter back to everyone." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left">
              <thead className="bg-black/20">
                <tr className="border-b border-white/[0.06] font-mono text-[10px] text-zinc-500 [&>th]:px-4 [&>th]:pt-3">
                  {header('handle', 'Curator')}
                  <th scope="col" className="hidden pb-3 pr-4 font-semibold uppercase tracking-[0.14em] sm:table-cell">Status</th>
                  {header('role', 'Access')}
                  {header('joined', 'Joined', 'hidden lg:table-cell')}
                  {header('lastSeen', 'Last seen', 'hidden md:table-cell')}
                  <th scope="col" className="pb-3 text-right font-semibold uppercase tracking-[0.14em]">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => {
                  const status = STATUS_LABEL[u.status];
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} onClick={() => onOpen(u)} className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar handle={u.handle} />
                          <div className="min-w-0">
                            <button type="button" className="block max-w-[180px] cursor-pointer truncate text-left text-sm font-semibold text-white hover:text-[#ff4d56]" aria-label={`Open details for ${u.handle}`}>
                              @{u.handle}
                            </button>
                            <p className="max-w-[180px] truncate font-mono text-[11px] text-zinc-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell"><Pill tone={status.tone}>{status.text}</Pill></td>
                      <td className="px-4 py-3">
                        {u.role === 'admin' ? <Pill tone="red" icon={ShieldCheck}>Admin</Pill> : <Pill tone="muted">Curator</Pill>}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-zinc-400 lg:table-cell">{formatDate(u.joinedAt)}</td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-zinc-400 md:table-cell">{timeAgo(u.lastSeenAt, nowMs, 'Not yet')}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {isSelf ? (
                          <span className="font-mono text-[11px] text-zinc-600">This is you</span>
                        ) : u.role === 'admin' ? (
                          <button type="button" className={BTN_RED} onClick={() => { setModalError(null); setPending({ user: u, makeAdmin: false }); }}>
                            <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" /> <span className="hidden xl:inline">Remove admin</span><span className="xl:hidden">Remove</span>
                          </button>
                        ) : (
                          <button type="button" className={BTN_GREEN} onClick={() => { setModalError(null); setPending({ user: u, makeAdmin: true }); }}>
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> <span className="hidden xl:inline">Make admin</span><span className="xl:hidden">Promote</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] text-zinc-500">
              Showing {safePage * PAGE_SIZE + 1}–{Math.min(rows.length, (safePage + 1) * PAGE_SIZE)} of {rows.length}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className={BTN_NEUTRAL}>
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
              </button>
              <span className="font-mono text-[11px] text-zinc-500">Page {safePage + 1} of {pageCount}</span>
              <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} className={BTN_NEUTRAL}>
                Next <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      {pending && (
        <ConfirmDialog
          key={`${pending.user.id}-${pending.makeAdmin}`}
          open
          tone={pending.makeAdmin ? 'green' : 'red'}
          icon={pending.makeAdmin ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
          title={pending.makeAdmin ? 'Make this person an admin?' : 'Remove admin access?'}
          description={
            pending.makeAdmin ? (
              <><span className="font-semibold text-white">@{pending.user.handle}</span> will be able to see platform stats and decide who else gets admin access.</>
            ) : (
              <><span className="font-semibold text-white">@{pending.user.handle}</span> will go back to a regular curator account and lose access to the admin panel straight away.</>
            )
          }
          confirmLabel={pending.makeAdmin ? 'Yes, make admin' : 'Yes, remove access'}
          busy={busy}
          error={modalError}
          onConfirm={() => void confirm()}
          onCancel={() => !busy && setPending(null)}
        />
      )}
    </div>
  );
}
