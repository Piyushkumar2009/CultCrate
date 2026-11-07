'use client';

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, KeyRound, RefreshCw, X } from 'lucide-react';
import type { AdminRole, AdminSummary, AdminUserRow } from '@/lib/adminAnalytics';
import { adminRequest } from '@/lib/adminClient';
import { useAdminResource } from '@/hooks/useAdminResource';
import type { SyncMonitorResponse } from '@/lib/adminSync';
import type { UserRef } from '@/lib/adminUserTypes';
import AdminShell, { ADMIN_TABS, type AdminTab } from '@/components/admin/AdminShell';
import OverviewSection from '@/components/admin/OverviewSection';
import CuratorsTable from '@/components/admin/CuratorsTable';
import UserDetailDrawer from '@/components/admin/UserDetailDrawer';
import LeaderboardSection from '@/components/admin/LeaderboardSection';
import SyncMonitor from '@/components/admin/SyncMonitor';
import AnnouncementManager from '@/components/admin/AnnouncementManager';
import { PANEL_CLASS } from '@/components/admin/adminUi';
import { BTN_SOLID_RED } from '@/components/admin/adminUiKit';

interface Toast {
  tone: 'green' | 'red';
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSummary(value: unknown): value is AdminSummary {
  return isRecord(value) && isRecord(value.kpis) && Array.isArray(value.users) && Array.isArray(value.growth);
}

function sortUsers(users: AdminUserRow[]): AdminUserRow[] {
  return [...users].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return Date.parse(b.joinedAt) - Date.parse(a.joinedAt);
  });
}

/* The active section lives in the URL hash (#curators), so a refresh or a shared link lands on the same screen. */
const subscribeHash = (notify: () => void): (() => void) => {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
};
const readHash = (): string => window.location.hash;
const readHashOnServer = (): string => '';

function parseTab(hash: string): AdminTab {
  const id = hash.replace(/^#/, '');
  return ADMIN_TABS.find((t) => t.id === id)?.id ?? 'overview';
}

export default function AdminPage() {
  const summary = useAdminResource<AdminSummary>('/api/admin/summary', { validate: isSummary, intervalMs: 60_000 });
  const sync = useAdminResource<SyncMonitorResponse>('/api/admin/sync-status', { intervalMs: 120_000 });
  const [toast, setToast] = useState<Toast | null>(null);
  const [mountedAt] = useState<number>(() => Date.now());
  const [selected, setSelected] = useState<{ id: string; handle: string } | null>(null);

  const hash = useSyncExternalStore(subscribeHash, readHash, readHashOnServer);
  const tab = parseTab(hash);
  const goTo = useCallback((next: AdminTab): void => {
    window.location.hash = next;
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const data = summary.data;
  const nowMs = data ? Date.parse(data.generatedAt) : mountedAt;
  const failedFeeds = sync.data?.counts.failed ?? 0;
  const closeDrawer = useCallback(() => setSelected(null), []);
  const openUser = useCallback((id: string, handle: string) => setSelected({ id, handle }), []);

  const changeAccess = useCallback(
    async (user: UserRef, makeAdmin: boolean): Promise<string | null> => {
      const res = await adminRequest('/api/admin/users/role', { method: 'POST', body: { userId: user.id, makeAdmin } });
      if (!res.ok) return res.message;

      const newRole: AdminRole = makeAdmin ? 'admin' : 'curator';
      summary.setData((prev) => {
        if (!prev) return prev;
        const changed = user.role !== newRole;
        return {
          ...prev,
          users: sortUsers(prev.users.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))),
          kpis: { ...prev.kpis, admins: Math.max(0, prev.kpis.admins + (changed ? (makeAdmin ? 1 : -1) : 0)) },
        };
      });
      setToast({ tone: 'green', text: makeAdmin ? `@${user.handle} is now an admin.` : `@${user.handle} is no longer an admin.` });
      return null;
    },
    [summary]
  );

  const deleteUser = useCallback(
    async (user: UserRef): Promise<string | null> => {
      const res = await adminRequest(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) return res.message;

      summary.setData((prev) =>
        prev ? { ...prev, users: prev.users.filter((u) => u.id !== user.id), kpis: { ...prev.kpis, totalCurators: Math.max(0, prev.kpis.totalCurators - 1) } } : prev
      );
      setToast({ tone: 'green', text: `@${user.handle}’s account was deleted.` });
      void summary.reload();
      void sync.reload();
      return null;
    },
    [summary, sync]
  );

  const refreshAll = (): void => {
    void summary.reload();
    void sync.reload();
  };

  const setupNeeded = summary.error?.code === 'setup_required' && !data;
  const loadFailed = summary.error !== null && !data && !setupNeeded;

  return (
    <AdminShell tab={tab} onTab={goTo} summary={data} failedFeeds={failedFeeds} refreshing={summary.refreshing || sync.refreshing} onRefresh={refreshAll}>
      {setupNeeded && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${PANEL_CLASS} space-y-5 border-amber-500/30 p-6 sm:p-8`}>
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10"><KeyRound className="h-5 w-5 text-[#F59E0B]" /></span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-white">One quick setup step</h2>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-400">To show platform stats and manage people, the admin panel needs a private key from your Supabase project.</p>
            </div>
          </div>
          <ol className="max-w-xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-300 marker:text-[#E50914]">
            <li>In Supabase, open <span className="font-semibold text-white">Project Settings</span>, then <span className="font-semibold text-white">API</span>.</li>
            <li>Copy the secret key labelled <span className="font-semibold text-white">service_role</span>.</li>
            <li>Add it to your app’s environment as <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-[#4EDEAE]">SUPABASE_SERVICE_ROLE_KEY</code> and restart the app.</li>
          </ol>
          <p className="max-w-xl rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-xs leading-relaxed text-amber-200/90">Keep this key private. It is only ever used on the server and is never sent to anyone’s browser.</p>
          <button type="button" onClick={refreshAll} className={BTN_SOLID_RED}><RefreshCw className="h-3.5 w-3.5" /> I’ve added it, try again</button>
        </motion.div>
      )}

      {loadFailed && summary.error && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E50914]/50 bg-[#1a080a]/90 p-5 shadow-[0_0_40px_-8px_rgba(229,9,20,0.45)]">
          <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-[#ff4d56]" /><p className="text-sm text-red-100">{summary.error.message}</p></div>
          <button type="button" onClick={() => void summary.reload()} className="flex cursor-pointer items-center gap-2 rounded-xl border border-red-500/40 bg-black/60 px-4 py-2 font-mono text-xs text-red-200 hover:bg-black hover:text-white"><RefreshCw className="h-3.5 w-3.5" /> Try again</button>
        </div>
      )}

      {!setupNeeded && !loadFailed && (
        <>
          {tab === 'overview' && <OverviewSection summary={data} />}
          {tab === 'curators' &&
            (data ? (
              <CuratorsTable users={data.users} currentUserId={data.currentUserId} nowMs={nowMs} onOpen={(u) => openUser(u.id, u.handle)} onChangeAccess={changeAccess} />
            ) : (
              <div className={`${PANEL_CLASS} h-[420px] animate-pulse`} />
            ))}
          {tab === 'leaderboard' && <LeaderboardSection onOpenUser={openUser} nowMs={nowMs} />}
          {tab === 'sync' && <SyncMonitor resource={sync} onOpenUser={openUser} nowMs={nowMs} />}
          {tab === 'announcements' && <AnnouncementManager nowMs={nowMs} />}
        </>
      )}

      <UserDetailDrawer target={selected} users={data?.users ?? []} currentUserId={data?.currentUserId ?? ''} nowMs={nowMs} onClose={closeDrawer} onChangeAccess={changeAccess} onDeleteUser={deleteUser} />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className={`fixed bottom-6 left-1/2 z-[130] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-xl border px-4 py-3 font-mono text-xs shadow-2xl backdrop-blur-xl ${
              toast.tone === 'green' ? 'border-[#4EDEAE]/40 bg-[#0b1713]/95 text-emerald-200' : 'border-[#E50914]/45 bg-[#1a080a]/95 text-red-200'
            }`}
          >
            <span className="flex items-center gap-2.5"><CheckCircle2 className={`h-4 w-4 shrink-0 ${toast.tone === 'green' ? 'text-[#4EDEAE]' : 'text-[#ff4d56]'}`} />{toast.text}</span>
            <button type="button" onClick={() => setToast(null)} className="cursor-pointer text-zinc-400 hover:text-white" aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
