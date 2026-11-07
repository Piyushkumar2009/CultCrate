import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { ContactPanel } from '@/components/landing/ContactPanel';
import { PublicFooter } from '@/components/landing/PublicFooter';

export const metadata: Metadata = {
  title: 'Contact & Support | CultCrate',
  description: 'Email support, report a bug, request a feature, or follow the CultCrate developer.',
};

export default function ContactPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(239,68,68,0.12),transparent)]"
      />

      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Home
        </Link>

        <header className="mb-8 mt-8 sm:mt-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            <MessageSquare className="h-3 w-3 text-red-500" aria-hidden="true" />
            Contact
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Contact &amp; Support</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Need a hand, found a bug, or have an idea? Pick the option that fits and we&apos;ll take it from there.
          </p>
        </header>

        <ContactPanel />
      </main>

      <PublicFooter />
    </div>
  );
}
