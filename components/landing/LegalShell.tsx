import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { PublicFooter } from '@/components/landing/PublicFooter';

interface LegalShellProps {
  badge: string;
  BadgeIcon: LucideIcon;
  title: string;
  intro: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalShell({ badge, BadgeIcon, title, intro, lastUpdated, children }: LegalShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(239,68,68,0.12),transparent)]"
      />

      <main className="relative mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Home
        </Link>

        <header className="mt-8 sm:mt-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            <BadgeIcon className="h-3 w-3 text-red-500" aria-hidden="true" />
            {badge}
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">{intro}</p>
          <p className="mt-4 font-mono text-xs text-zinc-500">Last updated: {lastUpdated}</p>
        </header>

        <div className="mt-10 space-y-4">{children}</div>

        <div className="mt-12 border-t border-zinc-800 pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Home
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

interface LegalSectionProps {
  id: string;
  number: number;
  title: string;
  Icon: LucideIcon;
  children: React.ReactNode;
}

export function LegalSection({ id, number, title, Icon, children }: LegalSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6"
    >
      <h2 className="flex items-center gap-3 text-lg font-bold text-white">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950">
          <Icon className="h-4 w-4 text-red-500" aria-hidden="true" />
        </span>
        <span>
          <span className="mr-2 font-mono text-xs font-semibold text-zinc-500">{String(number).padStart(2, '0')}</span>
          {title}
        </span>
      </h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300 [&_a]:font-semibold [&_a]:text-red-400 [&_a]:underline-offset-2 hover:[&_a]:underline [&_strong]:font-semibold [&_strong]:text-white">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
