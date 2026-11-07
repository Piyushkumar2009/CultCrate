'use client';

import React, { useEffect, useRef } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { ContactPanel } from '@/components/landing/ContactPanel';

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactModal({ open, onClose }: ContactModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              <MessageSquare className="h-3 w-3 text-red-500" aria-hidden="true" />
              Contact
            </span>
            <h2 id="contact-modal-title" className="mt-3 text-2xl font-black tracking-tight text-white">
              We&apos;d love to hear from you
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Support, feedback or a wild feature idea. All welcome.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close contact window"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ContactPanel />
      </div>
    </div>
  );
}
