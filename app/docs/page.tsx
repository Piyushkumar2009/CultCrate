import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ExternalLink,
  FileSpreadsheet,
  Film,
  Key,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'User Setup Guide | CultCrate',
  description: 'Get your free Gemini API key and export your Letterboxd ratings so CultCrate can pick films for you.',
};

interface GuideStep {
  title: string;
  body: React.ReactNode;
}

const CODE = 'rounded-md border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-100';
const QUOTE = 'font-semibold text-white';

function Code({ children }: { children: React.ReactNode }) {
  return <code className={CODE}>{children}</code>;
}

const GEMINI_STEPS: GuideStep[] = [
  {
    title: 'Open Google AI Studio',
    body: (
      <>
        Click the <span className={QUOTE}>Open Google AI Studio</span> button above (or go to the link directly) and sign in with your Google account.
      </>
    ),
  },
  {
    title: 'Create an API key',
    body: (
      <>
        Click the <span className={QUOTE}>Create API Key</span> button.
      </>
    ),
  },
  {
    title: 'Choose a project',
    body: (
      <>
        Select <span className={QUOTE}>Create API key in new project</span>, or choose an existing Google Cloud project if you already have one.
      </>
    ),
  },
  {
    title: 'Copy your key',
    body: (
      <>
        Copy the generated key. It is a long string that starts with <Code>AIzaSy...</Code>
      </>
    ),
  },
  {
    title: 'Paste it into CultCrate',
    body: (
      <>
        Open your CultCrate <span className={QUOTE}>Account Settings</span> and paste the key into the <span className={QUOTE}>Gemini API Key</span> field
        (it sits in the <span className={QUOTE}>Your AI key (optional)</span> card), then save.
      </>
    ),
  },
];

const LETTERBOXD_STEPS: GuideStep[] = [
  {
    title: 'Open Letterboxd Data Settings',
    body: (
      <>
        Click the <span className={QUOTE}>Open Letterboxd Data Settings</span> button above to go straight to your data page (sign in if prompted).
      </>
    ),
  },
  {
    title: 'Find the export section',
    body: (
      <>
        Scroll down to the <span className={QUOTE}>Export Your Data</span> section at the bottom of the page.
      </>
    ),
  },
  {
    title: 'Download your data',
    body: (
      <>
        Click the green <span className={QUOTE}>EXPORT YOUR DATA</span> button to download your data ZIP file.
      </>
    ),
  },
  {
    title: 'Extract the ZIP',
    body: <>Extract (unzip) the downloaded file on your device.</>,
  },
  {
    title: 'Upload ratings.csv only',
    body: (
      <>
        Upload <span className={QUOTE}>only</span> the <Code>ratings.csv</Code> file in CultCrate&apos;s import section (<span className={QUOTE}>Settings → Your film ratings</span>).
      </>
    ),
  },
];

const SECTIONS = [
  { id: 'gemini-key', label: 'Step 1: Gemini API key', Icon: Key },
  { id: 'letterboxd-export', label: 'Step 2: Letterboxd export', Icon: FileSpreadsheet },
] as const;

function ActionLink({ href, children, tone }: { href: string; children: React.ReactNode; tone: 'red' | 'emerald' }) {
  const colors =
    tone === 'red'
      ? 'bg-[#E50914] text-white shadow-[0_0_24px_rgba(229,9,20,0.25)] hover:bg-[#F40612] focus-visible:ring-[#E50914]/60'
      : 'bg-[#4EDEAE] text-zinc-950 shadow-[0_0_24px_rgba(78,222,174,0.2)] hover:bg-[#6ae8c0] focus-visible:ring-[#4EDEAE]/60';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 sm:w-auto ${colors}`}
    >
      {children}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function StepList({ steps, tone }: { steps: GuideStep[]; tone: 'red' | 'emerald' }) {
  const badge =
    tone === 'red'
      ? 'border-[#E50914]/40 bg-[#E50914]/10 text-[#ff4d56]'
      : 'border-[#4EDEAE]/40 bg-[#4EDEAE]/10 text-[#4EDEAE]';
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 sm:gap-4 sm:p-5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold ${badge}`}
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white sm:text-base">
              <span className="sr-only">Step {i + 1}: </span>
              {step.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400 [overflow-wrap:anywhere]">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      {/* ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(229,9,20,0.12),transparent)]"
      />

      <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        {/* Top nav */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to CultCrate
        </Link>

        {/* Header */}
        <header className="mt-8 sm:mt-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            <BookOpen className="h-3 w-3 text-[#E50914]" aria-hidden="true" />
            Documentation
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">CultCrate User Setup Guide</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Two quick steps and you are set: get a free Gemini API key, then export your Letterboxd ratings. It takes about five minutes, and
            CultCrate does the rest.
          </p>

          {/* Quick nav */}
          <nav aria-label="Jump to a section" className="mt-6 flex flex-col gap-2 sm:flex-row">
            {SECTIONS.map(({ id, label, Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:justify-start"
              >
                <Icon className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                {label}
              </a>
            ))}
          </nav>
        </header>

        {/* Step 1 */}
        <section id="gemini-key" aria-labelledby="gemini-key-title" className="mt-12 scroll-mt-6 sm:mt-14">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E50914]/30 bg-[#E50914]/10 text-[#ff4d56]">
                <Key className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#ff4d56]">Step 1</p>
                <h2 id="gemini-key-title" className="text-xl font-bold text-white sm:text-2xl">
                  Getting your Gemini API Key
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  The key lets CultCrate&apos;s AI write your picks using your own free Google account.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <ActionLink href="https://aistudio.google.com/app/apikey" tone="red">
                Open Google AI Studio
              </ActionLink>
            </div>

            <div className="mt-6">
              <StepList steps={GEMINI_STEPS} tone="red" />
            </div>

            <p className="mt-5 flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 text-xs leading-relaxed text-zinc-400">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F59E0B]" aria-hidden="true" />
              <span>
                Treat your key like a password. Keep it private and never share it publicly. Your key starts with <Code>AIzaSy...</Code>
              </span>
            </p>
          </div>
        </section>

        {/* Step 2 */}
        <section id="letterboxd-export" aria-labelledby="letterboxd-title" className="mt-8 scroll-mt-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#4EDEAE]/30 bg-[#4EDEAE]/10 text-[#4EDEAE]">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#4EDEAE]">Step 2</p>
                <h2 id="letterboxd-title" className="text-xl font-bold text-white sm:text-2xl">
                  Exporting your Letterboxd Data
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  Your ratings tell CultCrate what you love, so every pick feels made for you.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <ActionLink href="https://letterboxd.com/settings/data/" tone="emerald">
                Open Letterboxd Data Settings
              </ActionLink>
            </div>

            <div className="mt-6">
              <StepList steps={LETTERBOXD_STEPS} tone="emerald" />
            </div>

            <div
              role="note"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3.5 text-xs leading-relaxed text-amber-100/90 sm:text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" aria-hidden="true" />
              <p>
                <span className="font-bold text-amber-200">Only upload </span>
                <Code>ratings.csv</Code>
                <span className="font-bold text-amber-200">.</span> Do <span className="font-bold text-amber-200">not</span> upload <Code>watched.csv</Code> or
                any other file from the ZIP. Only <Code>ratings.csv</Code> is needed.
              </p>
            </div>
          </div>
        </section>

        {/* Tip: mobile users whose browser hands the Letterboxd link to the app */}
        <aside
          role="note"
          aria-label="Important tip for mobile users"
          className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200"
        >
          <span aria-hidden="true">💡 </span>
          <span className="font-bold">Tip for Mobile Users:</span> If tapping the link opens the Letterboxd app instead of your browser, long-press the button
          and select <span className="font-semibold">&apos;Open in new tab&apos;</span> or enable <span className="font-semibold">&apos;Desktop site&apos;</span> in
          your browser options.
        </aside>

        {/* Done */}
        <section aria-labelledby="done-title" className="mt-8">
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#4EDEAE]/25 bg-[#4EDEAE]/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#4EDEAE]/40 bg-[#4EDEAE]/10 text-[#4EDEAE]">
                <Check className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="done-title" className="text-base font-bold text-white sm:text-lg">
                  That&apos;s it, you&apos;re ready
                </h2>
                <p className="mt-1 text-sm text-zinc-400">Head to your dashboard and CultCrate will start picking films for you.</p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:w-auto"
            >
              <Film className="h-4 w-4 text-[#E50914]" aria-hidden="true" />
              Go to dashboard
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
