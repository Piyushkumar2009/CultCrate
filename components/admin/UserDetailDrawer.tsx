'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, CalendarDays, ExternalLink, Film, Flame, Rss, ShieldCheck, ShieldOff, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react';
import type { AdminRole, AdminUserRow, AccountStatus } from '@/lib/adminAnalytics';
import { adminRequest } from '@/lib/adminClient';
import { compactNumber, formatDate, timeAgo } from '@/lib/adminFormat';
import type { UserActivityEvent, UserDetail, UserRef } from '@/lib/adminUserTypes';
import { Eyebrow, Pill, type PillTone } from './adminUi';
import { Avatar, BTN_GREEN, BTN_NEUTRAL, BTN_RED, SectionError, SkeletonRows, SyncBadge } from './adminUiKit';
import ConfirmDialog from './ConfirmDialog';

const STATUS: Record<AccountStatus, { text: string; tone: PillTone }> = {
  active: { text: 'Active', tone: 'green' },
  inactive: { text: 'Inactive', tone: 'muted' },
  pending: { text: 'Unconfirmed', tone: 'amber' },
  suspended: { text: 'Suspended', tone: 'red' },
};
const DOT: Record<UserActivityEvent['tone'], string> = { green: 'bg-[#4EDEAE]', red: 'bg-[#E50914]', amber: 'bg-[#F59E0B]', muted: 'bg-zinc-600' };

interface DrawerProps {
  target: { id: string; handle: string } | null;
  users: AdminUserRow[];
  currentUserId: string;
  nowMs: number;
  onClose: () => void;
  onChangeAccess: (user: UserRef, makeAdmin: boolean) => Promise<string | null>;
  onDeleteUser: (user: UserRef) => Promise<string | null>;
}

function Tile({ icon: Icon, label, children, sub }: { icon: typeof Film; label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3.5">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        <Icon className="h-3 w-3" aria-hidden="true" /> {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight text-white">{children}</div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function DrawerBody({ target, role, currentUserId, nowMs, onClose, onChangeAccess, onDeleteUser }: {
  target: { id: string; handle: string };
  role: AdminRole | null;
  currentUserId: string;
  nowMs: number;
  onClose: () => void;
  onChangeAccess: DrawerProps['onChangeAccess'];
  onDeleteUser: DrawerProps['onDeleteUser'];
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'role' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void adminRequest<UserDetail>(`/api/admin/users/${target.id}`).then((res) => {
      if (cancelled) return;
      if (res.ok) setDetail(res.data);
      else setError(res.message);
    });
    return () => {
      cancelled = true;
    };
  }, [target.id]);

  const effectiveRole: AdminRole = role ?? detail?.role ?? 'curator';
  const isSelf = target.id === currentUserId;
  const ref: UserRef = { id: target.id, handle: detail?.handle ?? target.handle, role: effectiveRole };
  const makeAdmin = effectiveRole !== 'admin';

  const run = async (action: () => Promise<string | null>, onSuccess: () => void): Promise<void> => {
    setBusy(true);
    setDialogError(null);
    const err = await action();
    setBusy(false);
    if (err) setDialogError(err);
    else onSuccess();
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] p-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar handle={ref.handle} size="lg" />
          <div className="min-w-0">
            <Eyebrow>Curator</Eyebrow>
            <h2 id="drawer-title" className="truncate text-lg font-semibold tracking-tight text-white">@{ref.handle}</h2>
            <p className="truncate font-mono text-[11px] text-zinc-500">{detail?.email ?? ' '}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] p-1.5 text-zinc-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="flex flex-wrap gap-2">
          {effectiveRole === 'admin' ? <Pill tone="red" icon={ShieldCheck}>Admin</Pill> : <Pill tone="muted">Curator</Pill>}
          {detail && <Pill tone={STATUS[detail.status].tone}>{STATUS[detail.status].text}</Pill>}
          {isSelf && <Pill tone="muted">This is you</Pill>}
        </div>

        {error && <SectionError message={error} />}
        {!detail && !error && <SkeletonRows rows={6} />}

        {detail && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Tile icon={Film} label="Films logged" sub={detail.longestStreak > 0 ? `Best streak ${detail.longestStreak} days` : 'No dated logs yet'}>
                {compactNumber(detail.filmsLogged)}
              </Tile>
              <Tile icon={CalendarDays} label="Member since" sub={timeAgo(detail.joinedAt, nowMs)}>
                <span className="text-base">{formatDate(detail.joinedAt)}</span>
              </Tile>
              <Tile icon={Flame} label="Current streak" sub={detail.currentStreak > 0 ? 'Consecutive days logging' : 'Not on a streak'}>
                {detail.currentStreak} <span className="text-xs font-normal text-zinc-500">days</span>
              </Tile>
              <Tile icon={Sparkles} label="Latest picks" sub={detail.lastRecommendationAt ? timeAgo(detail.lastRecommendationAt, nowMs) : 'Never generated'}>
                {detail.recommendationsCount}
              </Tile>
            </div>

            <section className="space-y-3 rounded-xl border border-white/[0.07] bg-black/25 p-4" aria-label="Letterboxd sync">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500"><Rss className="h-3 w-3" aria-hidden="true" /> Letterboxd sync</span>
                <SyncBadge state={detail.letterboxd.state} />
              </div>
              {detail.letterboxd.handle ? (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-zinc-300">
                  @{detail.letterboxd.handle}
                  {detail.letterboxd.url && (
                    <a href={detail.letterboxd.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#4EDEAE] hover:underline">
                      Open profile <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </p>
              ) : (
                <p className="text-xs text-zinc-500">No Letterboxd account linked.</p>
              )}
              <dl className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                <div><dt className="text-zinc-600">Last attempt</dt><dd className="mt-0.5 text-zinc-300">{timeAgo(detail.letterboxd.lastAttemptAt, nowMs, 'Never')}</dd></div>
                <div><dt className="text-zinc-600">Last success</dt><dd className="mt-0.5 text-zinc-300">{timeAgo(detail.letterboxd.lastSuccessAt, nowMs, 'Never')}</dd></div>
              </dl>
              {detail.letterboxd.state === 'failed' && detail.letterboxd.message && (
                <p className="flex items-start gap-2 rounded-lg border border-[#E50914]/30 bg-[#E50914]/[0.06] px-3 py-2 text-xs leading-relaxed text-red-200">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff4d56]" aria-hidden="true" />
                  {detail.letterboxd.message}
                </p>
              )}
            </section>

            {detail.recentFilms.length > 0 && (
              <section aria-label="Recently logged films" className="space-y-2">
                <Eyebrow tone="muted">Recently logged</Eyebrow>
                <ul className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.07] bg-black/25">
                  {detail.recentFilms.map((f, i) => (
                    <li key={`${f.title}-${i}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span className="min-w-0 truncate text-sm text-white">{f.title}<span className="ml-1.5 font-mono text-[11px] text-zinc-500">{f.year}</span></span>
                      <span className="shrink-0 font-mono text-[11px] text-zinc-400">{f.rating > 0 ? `${f.rating.toFixed(1)}★` : '—'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-label="Recent activity" className="space-y-3">
              <span className="flex items-center gap-2"><Activity className="h-3 w-3 text-zinc-500" aria-hidden="true" /><Eyebrow tone="muted">Recent activity</Eyebrow></span>
              <ol className="space-y-3 border-l border-white/[0.08] pl-4">
                {detail.activity.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-4 ring-[#0d111a] ${DOT[ev.tone]}`} />
                    <p className="text-sm text-white">{ev.label}</p>
                    <p className="font-mono text-[11px] text-zinc-500">{timeAgo(ev.at, nowMs)}{ev.detail ? ` · ${ev.detail}` : ''}</p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>

      <div className="space-y-3 border-t border-white/[0.07] bg-black/20 p-5">
        {isSelf ? (
          <p className="text-center font-mono text-[11px] text-zinc-500">You can’t change or delete your own account here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!detail && role === null} className={makeAdmin ? `${BTN_GREEN} py-2.5` : `${BTN_RED} py-2.5`} onClick={() => { setDialogError(null); setDialog('role'); }}>
              {makeAdmin ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
              {makeAdmin ? 'Make Admin' : 'Remove Admin'}
            </button>
            <button type="button" className={`${BTN_NEUTRAL} py-2.5 hover:border-[#E50914]/50 hover:text-[#ff4d56]`} onClick={() => { setDialogError(null); setDialog('delete'); }}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete user
            </button>
          </div>
        )}
      </div>

      {dialog === 'role' && (
        <ConfirmDialog
          key="role"
          open
          tone={makeAdmin ? 'green' : 'red'}
          icon={makeAdmin ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
          title={makeAdmin ? 'Make this person an admin?' : 'Remove admin access?'}
          description={makeAdmin
            ? <><span className="font-semibold text-white">@{ref.handle}</span> will be able to see platform stats and decide who else gets admin access.</>
            : <><span className="font-semibold text-white">@{ref.handle}</span> will go back to a regular curator account and lose access to the admin panel straight away.</>}
          confirmLabel={makeAdmin ? 'Yes, make admin' : 'Yes, remove access'}
          busy={busy}
          error={dialogError}
          onConfirm={() => void run(() => onChangeAccess(ref, makeAdmin), () => setDialog(null))}
          onCancel={() => !busy && setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          key="delete"
          open
          tone="red"
          icon={<Trash2 className="h-5 w-5" />}
          title="Delete this account?"
          description={<><span className="font-semibold text-white">@{ref.handle}</span> and everything they saved on CultCrate (library, recommendations and Cinematic DNA) will be permanently removed. This can’t be undone.</>}
          confirmLabel="Delete permanently"
          requireText={ref.handle}
          busy={busy}
          error={dialogError}
          onConfirm={() => void run(() => onDeleteUser(ref), onClose)}
          onCancel={() => !busy && setDialog(null)}
        />
      )}
    </>
  );
}

/** Slide-over with a curator's full picture. Opens when a row (or leaderboard / sync entry) is clicked. */
export default function UserDetailDrawer({ target, users, currentUserId, nowMs, onClose, onChangeAccess, onDeleteUser }: DrawerProps) {
  const open = target !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !document.querySelector('[role="alertdialog"]')) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;
  const liveRole = target ? users.find((u) => u.id === target.id)?.role ?? null : null;

  return createPortal(
    <AnimatePresence>
      {target && (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0d111a] shadow-[-24px_0_60px_rgba(0,0,0,0.8)]"
          >
            <DrawerBody key={target.id} target={target} role={liveRole} currentUserId={currentUserId} nowMs={nowMs} onClose={onClose} onChangeAccess={onChangeAccess} onDeleteUser={onDeleteUser} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
