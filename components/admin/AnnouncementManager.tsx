'use client';

import React, { useState } from 'react';
import { Megaphone, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { useAdminResource } from '@/hooks/useAdminResource';
import { adminRequest } from '@/lib/adminClient';
import { timeAgo } from '@/lib/adminFormat';
import {
  ANNOUNCEMENT_TONES,
  MAX_ANNOUNCEMENT_LENGTH,
  type Announcement,
  type AnnouncementListResponse,
  type AnnouncementTone,
} from '@/lib/adminAnnouncements';
import { BannerView } from '@/components/SiteAnnouncementBanner';
import { Eyebrow, PANEL_CLASS, PanelHeader, Pill } from './adminUi';
import { BTN_GREEN, BTN_NEUTRAL, BTN_SOLID_RED, EmptyState, INPUT_CLASS, SectionError, SetupNotice, SkeletonRows, Spinner } from './adminUiKit';
import ConfirmDialog from './ConfirmDialog';

const TONE_LABEL: Record<AnnouncementTone, string> = { info: 'Info', success: 'Good news', warning: 'Warning', critical: 'Critical' };

interface FormState {
  message: string;
  tone: AnnouncementTone;
  linkUrl: string;
  linkLabel: string;
  dismissible: boolean;
}
const EMPTY_FORM: FormState = { message: '', tone: 'info', linkUrl: '', linkLabel: '', dismissible: true };

export default function AnnouncementManager({ nowMs }: { nowMs: number }) {
  const { data, error, loading, reload } = useAdminResource<AnnouncementListResponse>('/api/admin/announcements');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => setForm((f) => ({ ...f, [key]: value }));
  const remaining = MAX_ANNOUNCEMENT_LENGTH - form.message.length;
  const canSave = form.message.trim().length > 0 && remaining >= 0 && !saving;

  const body = (): Record<string, unknown> => ({
    message: form.message,
    tone: form.tone,
    linkUrl: form.linkUrl.trim() || null,
    linkLabel: form.linkLabel.trim() || null,
    dismissible: form.dismissible,
  });

  const submit = async (activate: boolean): Promise<void> => {
    setSaving(true);
    setMessage(null);
    const res = editingId
      ? await adminRequest(`/api/admin/announcements/${editingId}`, { method: 'PATCH', body: body() })
      : await adminRequest('/api/admin/announcements', { method: 'POST', body: { ...body(), activate } });
    setSaving(false);
    if (!res.ok) {
      setMessage({ tone: 'error', text: res.message });
      return;
    }
    setMessage({ tone: 'ok', text: editingId ? 'Changes saved.' : activate ? 'Banner is live on the site.' : 'Draft saved.' });
    setForm(EMPTY_FORM);
    setEditingId(null);
    await reload();
  };

  const toggle = async (a: Announcement): Promise<void> => {
    setTogglingId(a.id);
    setMessage(null);
    const res = await adminRequest(`/api/admin/announcements/${a.id}`, { method: 'PATCH', body: { isActive: !a.isActive } });
    setTogglingId(null);
    if (!res.ok) setMessage({ tone: 'error', text: res.message });
    else {
      setMessage({ tone: 'ok', text: a.isActive ? 'Banner switched off.' : 'Banner is live on the site.' });
      await reload();
    }
  };

  const edit = (a: Announcement): void => {
    setEditingId(a.id);
    setForm({ message: a.message, tone: a.tone, linkUrl: a.linkUrl ?? '', linkLabel: a.linkLabel ?? '', dismissible: a.dismissible });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async (): Promise<void> => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await adminRequest(`/api/admin/announcements/${toDelete.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(res.message);
      return;
    }
    if (editingId === toDelete.id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    setToDelete(null);
    await reload();
  };

  const setup = error?.code === 'setup_required';

  return (
    <div className="space-y-6">
      <div className={`${PANEL_CLASS} space-y-5 p-5 sm:p-6`}>
        <PanelHeader icon={Megaphone} eyebrow="Platform controls" title={editingId ? 'Edit announcement' : 'Announcement banner'} subtitle="Notices shown at the top of every page. Up to 5 banners can be live at once and they rotate automatically." />

        {setup && <SetupNotice message={error.message} />}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="flex items-center justify-between font-mono text-[11px] text-zinc-500">
                Message <span className={remaining < 0 ? 'text-[#ff4d56]' : remaining < 30 ? 'text-[#F59E0B]' : ''}>{remaining}</span>
              </span>
              <textarea value={form.message} onChange={(e) => set('message', e.target.value)} rows={3} placeholder="e.g. Scheduled maintenance tonight at 11 PM UTC." className={`${INPUT_CLASS} resize-none`} />
            </label>

            <fieldset className="space-y-1.5">
              <legend className="font-mono text-[11px] text-zinc-500">Style</legend>
              <div className="flex flex-wrap gap-2">
                {ANNOUNCEMENT_TONES.map((t) => (
                  <button key={t} type="button" aria-pressed={form.tone === t} onClick={() => set('tone', t)}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all ${form.tone === t ? 'border-[#E50914]/50 bg-[#E50914]/10 font-semibold text-[#ff4d56]' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white'}`}>
                    {TONE_LABEL[t]}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] text-zinc-500">Link (optional)</span>
                <input value={form.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} placeholder="https://… or /dashboard" className={INPUT_CLASS} inputMode="url" />
              </label>
              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] text-zinc-500">Link label</span>
                <input value={form.linkLabel} onChange={(e) => set('linkLabel', e.target.value)} placeholder="Learn more" maxLength={40} className={INPUT_CLASS} />
              </label>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-zinc-300">
              <input type="checkbox" checked={form.dismissible} onChange={(e) => set('dismissible', e.target.checked)} className="h-4 w-4 accent-[#E50914]" />
              Let visitors dismiss it
            </label>

            {message && (
              <p role="status" className={`rounded-xl border px-3.5 py-2.5 text-xs ${message.tone === 'ok' ? 'border-[#4EDEAE]/30 bg-[#4EDEAE]/[0.06] text-emerald-200' : 'border-[#E50914]/40 bg-[#1a080a] text-red-200'}`}>{message.text}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {editingId ? (
                <>
                  <button type="button" disabled={!canSave} onClick={() => void submit(false)} className={BTN_SOLID_RED}>{saving ? <Spinner /> : <Pencil className="h-3.5 w-3.5" />} Save changes</button>
                  <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }} className={`${BTN_NEUTRAL} px-4 py-2.5 text-xs`}><X className="h-3.5 w-3.5" /> Cancel</button>
                </>
              ) : (
                <>
                  <button type="button" disabled={!canSave || setup} onClick={() => void submit(true)} className={BTN_SOLID_RED}>{saving ? <Spinner /> : <Send className="h-3.5 w-3.5" />} Publish now</button>
                  <button type="button" disabled={!canSave || setup} onClick={() => void submit(false)} className={`${BTN_NEUTRAL} px-4 py-2.5 text-xs`}><Plus className="h-3.5 w-3.5" /> Save as draft</button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Eyebrow tone="muted">Live preview</Eyebrow>
            <div className="rounded-xl border border-white/[0.07] bg-[#090D16] p-3">
              {form.message.trim() ? (
                <BannerView preview message={form.message.trim()} tone={form.tone} linkUrl={form.linkUrl.trim() || null} linkLabel={form.linkUrl.trim() ? form.linkLabel.trim() || 'Learn more' : null} dismissible={form.dismissible} />
              ) : (
                <p className="py-6 text-center font-mono text-[11px] text-zinc-600">Start typing to see your banner.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`${PANEL_CLASS} space-y-4 p-5 sm:p-6`}>
        <Eyebrow>All banners</Eyebrow>
        {loading && <SkeletonRows rows={3} />}
        {!loading && error && !setup && <SectionError message={error.message} onRetry={() => void reload()} />}
        {data && data.announcements.length === 0 && <EmptyState title="No banners yet" body="Create one above. Saved drafts and past banners appear here." />}
        {data && data.announcements.length > 0 && (
          <ul className="space-y-3">
            {data.announcements.map((a) => (
              <li key={a.id} className="space-y-3 rounded-xl border border-white/[0.07] bg-black/25 p-3.5">
                <BannerView preview message={a.message} tone={a.tone} linkUrl={a.linkUrl} linkLabel={a.linkLabel} dismissible={a.dismissible} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={a.isActive}
                      aria-label={a.isActive ? 'Switch banner off' : 'Switch banner on'}
                      disabled={togglingId === a.id}
                      onClick={() => void toggle(a)}
                      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors disabled:opacity-50 ${a.isActive ? 'border-[#4EDEAE]/50 bg-[#4EDEAE]/25' : 'border-white/10 bg-white/[0.06]'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${a.isActive ? 'left-[22px] bg-[#4EDEAE]' : 'left-0.5 bg-zinc-500'}`} />
                    </button>
                    {a.isActive ? <Pill tone="green">Live</Pill> : <Pill tone="muted">Off</Pill>}
                    <span className="font-mono text-[10px] text-zinc-600">Updated {timeAgo(a.updatedAt, nowMs).toLowerCase()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => edit(a)} className={BTN_NEUTRAL}><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit</button>
                    <button type="button" onClick={() => { setDeleteError(null); setToDelete(a); }} className={`${BTN_GREEN} border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:!bg-[#E50914] hover:!text-white`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toDelete && (
        <ConfirmDialog key={toDelete.id} open tone="red" icon={<Trash2 className="h-5 w-5" />} title="Delete this banner?"
          description={<>This removes the banner{toDelete.isActive ? ' from the site straight away' : ''}. It can’t be undone.</>}
          confirmLabel="Delete banner" busy={deleting} error={deleteError} onConfirm={() => void confirmDelete()} onCancel={() => !deleting && setToDelete(null)} />
      )}
    </div>
  );
}
