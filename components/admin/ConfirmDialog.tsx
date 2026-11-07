'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { BTN_NEUTRAL, INPUT_CLASS, Spinner } from './adminUiKit';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone: 'green' | 'red';
  icon: React.ReactNode;
  busy: boolean;
  error: string | null;
  /** When set, the confirm button stays disabled until this exact text is typed (for irreversible actions) */
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirmation, portaled to <body> so blurred parents can never clip it. */
export default function ConfirmDialog({ open, title, description, confirmLabel, tone, icon, busy, error, requireText, onConfirm, onCancel }: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    cancelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  const blocked = busy || (requireText !== undefined && typed.trim().toLowerCase() !== requireText.toLowerCase());
  const toneBox = tone === 'green' ? 'border-[#4EDEAE]/40 bg-[#4EDEAE]/10 text-[#4EDEAE]' : 'border-[#E50914]/40 bg-[#E50914]/10 text-[#ff4d56]';
  const toneBtn =
    tone === 'green'
      ? 'bg-[#0f9d74] shadow-[0_0_24px_-6px_rgba(78,222,174,0.7)] hover:bg-[#0c8460]'
      : 'bg-[#E50914] shadow-[0_0_24px_-6px_rgba(229,9,20,0.7)] hover:bg-[#b80710]';

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onCancel()} className="fixed inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative z-10 my-auto w-full max-w-md space-y-5 rounded-2xl border border-white/[0.08] bg-[#0d111a] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_60px_rgba(229,9,20,0.18)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneBox}`}>{icon}</span>
                <h3 id="confirm-title" className="text-lg font-semibold tracking-tight text-white">
                  {title}
                </h3>
              </div>
              <button type="button" onClick={onCancel} disabled={busy} aria-label="Close" className="cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] p-1.5 text-zinc-400 hover:text-white disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-sm leading-relaxed text-zinc-400">{description}</div>

            {requireText !== undefined && (
              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] text-zinc-500">
                  Type <span className="font-semibold text-white">{requireText}</span> to confirm
                </span>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className={INPUT_CLASS} />
              </label>
            )}

            {error && <p role="alert" className="rounded-xl border border-[#E50914]/40 bg-[#1a080a] px-3.5 py-2.5 text-xs leading-relaxed text-red-200">{error}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className={`${BTN_NEUTRAL} px-4 py-2.5 text-xs`}>
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={blocked}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-mono text-xs font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${toneBtn}`}
              >
                {busy && <Spinner />}
                {busy ? 'Working…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
