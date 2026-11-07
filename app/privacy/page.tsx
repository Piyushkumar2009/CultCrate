import type { Metadata } from 'next';
import {
  Cookie,
  Database,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { LegalList, LegalSection, LegalShell } from '@/components/landing/LegalShell';
import { SUPPORT_EMAIL } from '@/components/landing/contactLinks';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How CultCrate protects your account, Letterboxd data and Gemini API key. Your film data is never sold to third parties.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'CultCrate',
    url: '/privacy',
    title: 'Privacy Policy | CultCrate',
    description:
      'How CultCrate protects your account, Letterboxd data and Gemini API key. Your film data is never sold.',
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
    title: 'Privacy Policy | CultCrate',
    description:
      'How CultCrate protects your account, Letterboxd data and Gemini API key. Your film data is never sold.',
    images: ['/og-image.png'],
  },
};

const LAST_UPDATED = 'November 7, 2026';

export default function PrivacyPage() {
  return (
    <LegalShell
      badge="Privacy"
      BadgeIcon={ShieldCheck}
      title="Privacy Policy"
      intro="CultCrate exists to pick better films for you, not to collect your data. This page explains in plain language what we keep, why, and the control you have over it."
      lastUpdated={LAST_UPDATED}
    >
      <LegalSection id="summary" number={1} title="The short version" Icon={ShieldCheck}>
        <LegalList
          items={[
            <>We <strong>never sell</strong> your data, and we do not share it with advertisers or data brokers.</>,
            <>Your Letterboxd ratings are used only to build your analytics, Cinematic DNA and recommendations.</>,
            <>Your Gemini API key is yours. We use it only to make requests on your behalf, and you can remove it any time.</>,
            <>You can ask us to delete your account and data whenever you like.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="what-we-collect" number={2} title="What we collect" Icon={UserRound}>
        <p>We keep only what the app needs to work:</p>
        <LegalList
          items={[
            <><strong>Account details:</strong> your email address and sign-in details, handled by our authentication provider.</>,
            <><strong>Profile settings:</strong> your display name, Letterboxd username and the preferences you choose, such as obscurity level.</>,
            <><strong>Your film data:</strong> the Letterboxd ratings you upload or sync, covered in the next section.</>,
            <><strong>Results we create for you:</strong> your Cinematic DNA, recommendations and watchlist.</>,
          ]}
        />
        <p>We do not ask for payment details, and we do not collect anything about your contacts or device storage.</p>
      </LegalSection>

      <LegalSection id="letterboxd-data" number={3} title="Your Letterboxd data" Icon={FileSpreadsheet}>
        <p>
          When you upload your Letterboxd CSV export, or connect your public Letterboxd activity feed, we process that
          data securely, only to power your analytics and recommendations. <strong>It is never sold to third parties.</strong>
        </p>
        <LegalList
          items={[
            <>Your CSV is stored in a private area tied to your account. Access rules mean only you can read your own file.</>,
            <>When you run the AI engine, our servers read your ratings to work out your taste and avoid recommending films you have already seen.</>,
            <>To write recommendations, a condensed summary of your taste (such as highly rated films and patterns) is sent to Google&apos;s Gemini service. See &quot;Third-party services&quot; below.</>,
            <>Some results, like your watchlist and last engine run, are also cached in your own browser so the app feels fast.</>,
          ]}
        />
        <p>You can replace or remove your ratings from Settings whenever you want.</p>
      </LegalSection>

      <LegalSection id="gemini-key" number={4} title="How we handle your Gemini API key" Icon={KeyRound}>
        <p>
          CultCrate runs on a key you bring yourself, so you stay in charge of your own usage and costs. Here is how we
          treat it:
        </p>
        <LegalList
          items={[
            <>It is saved to your private profile, protected so that only your signed-in account can read or change it.</>,
            <>It is used on our server solely to send your recommendation requests to Gemini. It is never shown to other users.</>,
            <>It is transmitted over encrypted connections and is never sold or shared for any other purpose.</>,
            <>You can delete it at any time from Settings, and we recommend rotating it in Google AI Studio if you ever suspect it has leaked.</>,
          ]}
        />
        <p>Please never share your key with anyone, including in messages to support. We will never ask you for it.</p>
      </LegalSection>

      <LegalSection id="third-parties" number={5} title="Third-party services" Icon={Database}>
        <p>A few trusted services help CultCrate run:</p>
        <LegalList
          items={[
            <><strong>Supabase</strong> for sign-in, database and file storage.</>,
            <><strong>Google Gemini</strong> to generate your recommendations, using your own key. Google&apos;s own terms and privacy policy apply to what you send it.</>,
            <><strong>Our hosting provider</strong> to serve the website.</>,
          ]}
        />
        <p>CultCrate is an independent project and is not affiliated with, or endorsed by, Letterboxd.</p>
      </LegalSection>

      <LegalSection id="cookies" number={6} title="Cookies and local storage" Icon={Cookie}>
        <p>
          We use essential cookies to keep you signed in, and your browser&apos;s local storage to remember things like
          your watchlist and latest results. We do not use advertising or cross-site tracking cookies.
        </p>
      </LegalSection>

      <LegalSection id="your-choices" number={7} title="Your choices and deleting your data" Icon={Trash2}>
        <LegalList
          items={[
            <>Remove your Gemini key or refresh your ratings from Settings at any time.</>,
            <>Clear the data stored in your browser from Settings.</>,
            <>
              Ask us to delete your account and everything attached to it by emailing{' '}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20CultCrate%20account`}>{SUPPORT_EMAIL}</a>.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection id="children" number={8} title="Age and changes to this policy" Icon={Globe}>
        <p>
          CultCrate is not intended for children under 13. If we make meaningful changes to this policy, we will update
          the date at the top of this page.
        </p>
      </LegalSection>

      <LegalSection id="contact" number={9} title="Questions" Icon={Mail}>
        <p>
          Anything unclear about your privacy? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and a real
          person will get back to you.
        </p>
        <p className="flex items-center gap-2 text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
          Happy watching.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
