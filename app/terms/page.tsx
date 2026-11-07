import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Ban,
  Copyright,
  FileText,
  Mail,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { LegalList, LegalSection, LegalShell } from '@/components/landing/LegalShell';
import { SUPPORT_EMAIL } from '@/components/landing/contactLinks';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The ground rules for using CultCrate: your responsibilities, how we treat film and Letterboxd content, and how accounts can end.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'CultCrate',
    url: '/terms',
    title: 'Terms of Service | CultCrate',
    description:
      'The ground rules for using CultCrate: your responsibilities, our content, and how accounts can end.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CultCrate — The Ultimate Cinematic Archive',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service | CultCrate',
    description:
      'The ground rules for using CultCrate: your responsibilities, our content, and how accounts can end.',
    images: ['/og-image.png'],
  },
};

const LAST_UPDATED = 'November 7, 2026';

export default function TermsPage() {
  return (
    <LegalShell
      badge="Terms"
      BadgeIcon={FileText}
      title="Terms of Service"
      intro="These are the simple ground rules for using CultCrate. By using the app you agree to them, so please give them a quick read."
      lastUpdated={LAST_UPDATED}
    >
      <LegalSection id="acceptance" number={1} title="Acceptance of Terms" Icon={FileText}>
        <p>
          By creating an account or using CultCrate, you agree to these Terms and to our{' '}
          <Link href="/privacy">Privacy Policy</Link>. If you do not agree, please do not use the service. You must be at least
          13 years old to use CultCrate.
        </p>
      </LegalSection>

      <LegalSection id="the-service" number={2} title="What CultCrate does" Icon={Sparkles}>
        <p>
          CultCrate turns your Letterboxd ratings into a Cinematic DNA profile and curated film recommendations using AI.
          Recommendations are suggestions only. They can occasionally be inaccurate, and film details such as streaming
          availability may be out of date.
        </p>
      </LegalSection>

      <LegalSection id="responsibilities" number={3} title="User Responsibilities" Icon={UserCheck}>
        <LegalList
          items={[
            <>Give accurate sign-up details and keep your password secure. You are responsible for activity on your account.</>,
            <>Only upload Letterboxd data that belongs to you.</>,
            <>Use your own Gemini API key. You are responsible for keeping it private and for any usage or charges on your Google account.</>,
            <>Do not attack, overload, scrape, reverse engineer or otherwise misuse the service, and do not break the law while using it.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="ip" number={4} title="Intellectual Property" Icon={Copyright}>
        <p>
          <strong>CultCrate.</strong> The CultCrate name, logo, design and code are owned by CultCrate and may not be
          copied or used to suggest endorsement without permission.
        </p>
        <p>
          <strong>Third-party content.</strong> Film titles, posters, descriptions and other movie metadata belong to
          their respective owners. Letterboxd and its data belong to Letterboxd and its users, and CultCrate is not
          affiliated with or endorsed by Letterboxd. We show this material only to help you discover films.
        </p>
        <p>
          <strong>Your data.</strong> Your ratings and uploads remain yours. You give us permission to process them only
          to provide the features you ask for.
        </p>
      </LegalSection>

      <LegalSection id="liability" number={5} title="Limitation of Liability" Icon={ShieldAlert}>
        <p>
          CultCrate is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind. To the
          fullest extent allowed by law, CultCrate and its creator are not liable for indirect, incidental or
          consequential damages, loss of data, or charges from third-party services (including your Gemini usage) that
          arise from your use of the app. Our total liability for any claim will not exceed the amount you paid us for
          the service, which for a free app is zero.
        </p>
      </LegalSection>

      <LegalSection id="termination" number={6} title="Account Termination" Icon={Ban}>
        <LegalList
          items={[
            <>You can stop using CultCrate and ask us to delete your account at any time by emailing <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20CultCrate%20account`}>{SUPPORT_EMAIL}</a>.</>,
            <>We may suspend or close accounts that break these Terms, put the service at risk, or harm other users.</>,
            <>When an account is closed, your access ends and your stored data is removed as described in the Privacy Policy.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="changes" number={7} title="Changes to these Terms" Icon={RefreshCw}>
        <p>
          We may update these Terms as CultCrate grows. When we do, we will change the date at the top. Continuing to use
          the app after an update means you accept the new Terms.
        </p>
      </LegalSection>

      <LegalSection id="contact" number={8} title="Contact" Icon={Mail}>
        <p>
          Questions about these Terms? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
        <p className="flex items-center gap-2 text-zinc-500">
          <Scale className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
          Plain rules, fair play.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
