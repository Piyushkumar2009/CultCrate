'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Film } from 'lucide-react';
import { ContactModal } from '@/components/landing/ContactModal';

const LINK =
  'rounded text-xs text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60';

export function PublicFooter() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <footer className="relative z-10 w-full border-t border-zinc-800 bg-zinc-950">
        <div className="flex w-full flex-col items-center justify-between gap-5 px-4 py-8 sm:px-6 md:flex-row lg:px-10">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-4 sm:text-left">
            <Link href="/" className="group flex items-center gap-2">
              <Film
                className="h-4 w-4 text-red-500 transition-transform group-hover:scale-110"
                aria-hidden="true"
              />
              <span className="text-sm font-bold text-white">
                Cult<span className="text-red-500">Crate</span>
              </span>
            </Link>
            <span aria-hidden="true" className="hidden text-zinc-700 sm:inline">
              •
            </span>
            <span className="text-xs text-zinc-500">© 2026 CultCrate. All rights reserved.</span>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/docs" className={LINK}>
              Docs
            </Link>
            <Link href="/privacy" className={LINK}>
              Privacy
            </Link>
            <Link href="/terms" className={LINK}>
              Terms
            </Link>
            <button type="button" onClick={() => setContactOpen(true)} className={LINK}>
              Contact
            </button>
          </nav>
        </div>
      </footer>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
