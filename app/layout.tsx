import type { Metadata, Viewport } from 'next';
import './globals.css';
import SiteAnnouncementBanner from '@/components/SiteAnnouncementBanner';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cultcrate.vercel.app';
const SITE_NAME = 'CultCrate';
const DEFAULT_TITLE = 'CultCrate — The Ultimate Cinematic Archive';
const DESCRIPTION =
  'Sync your Letterboxd, uncover your Cinematic DNA, and get hand-picked cult, arthouse and hidden-gem film recommendations powered by AI.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'film recommendation engine',
    'cinephile archive',
    'Letterboxd sync',
    'Letterboxd recommendations',
    'movie tracking',
    'hidden gem movies',
    'cult films',
    'arthouse cinema',
    'AI movie recommendations',
    'Cinematic DNA',
  ],
  authors: [{ name: 'CultCrate', url: SITE_URL }],
  creator: 'CultCrate',
  publisher: 'CultCrate',
  category: 'entertainment',
  verification: {
    google: 'llcR0z1iGWL3hZYNLBFezFklRGEtYKoHVK5N_n002UU',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
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
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="bg-[#090D16] text-[#F9FAFB] min-h-[100dvh] antialiased selection:bg-[#E50914] selection:text-white overflow-x-hidden font-sans">
        <SiteAnnouncementBanner />
        {children}
      </body>
    </html>
  );
}