import {
  ArrowUpRight,
  Bug,
  Github,
  Lightbulb,
  Mail,
} from 'lucide-react';
import {
  BUG_MAILTO,
  FEATURE_MAILTO,
  GITHUB_URL,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
} from '@/components/landing/contactLinks';

const CARD = 'rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5';
const ICON_BOX = 'flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60';

export function ContactPanel() {
  return (
    <div className="space-y-4">
      {/* a) Direct email support */}
      <section className={CARD} aria-labelledby="contact-email-title">
        <div className="flex items-start gap-4">
          <div className={ICON_BOX}>
            <Mail className="h-5 w-5 text-red-500" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="contact-email-title" className="text-base font-bold text-white">
              Email support
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Stuck on setup, your account or your data? Write to us and a real person will reply.
            </p>
            <a
              href={SUPPORT_MAILTO}
              className={`mt-4 inline-flex max-w-full items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-400 ${FOCUS}`}
            >
              <span className="truncate">{SUPPORT_EMAIL}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* b) Feedback & bug reports */}
      <section className={CARD} aria-labelledby="contact-feedback-title">
        <div className="flex items-start gap-4">
          <div className={ICON_BOX}>
            <Lightbulb className="h-5 w-5 text-red-500" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="contact-feedback-title" className="text-base font-bold text-white">
              Feedback &amp; bug reports
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Found something broken, or dreaming of a feature? Tell us. CultCrate gets better because cinephiles speak up.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a
                href={BUG_MAILTO}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white ${FOCUS}`}
              >
                <Bug className="h-4 w-4 text-red-500" aria-hidden="true" />
                Report a bug
              </a>
              <a
                href={FEATURE_MAILTO}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white ${FOCUS}`}
              >
                <Lightbulb className="h-4 w-4 text-red-500" aria-hidden="true" />
                Request a feature
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* c) Developer profile */}
      <section className={CARD} aria-labelledby="contact-github-title">
        <h2 id="contact-github-title" className="text-base font-bold text-white">
          Follow the developer
        </h2>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white ${FOCUS}`}
        >
          <span className="inline-flex items-center gap-2">
            <Github className="h-4 w-4" aria-hidden="true" />
            GitHub
          </span>
          <ArrowUpRight className="h-4 w-4 text-zinc-500" aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
