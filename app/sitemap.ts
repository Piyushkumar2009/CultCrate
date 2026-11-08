import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

interface PublicRoute {
  path: string;
  /** Last real content change. Bump it when the page changes (a moving date makes Google distrust lastmod). */
  lastModified: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}

// Every page that is public and meant to be found in search. Private pages (/dashboard, /settings, /watchlist,
// /admin) and token-only pages (/reset-password, /auth/callback) are intentionally left out.
const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '/', lastModified: '2026-11-08', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/docs', lastModified: '2026-11-08', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/auth', lastModified: '2026-11-08', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/contact', lastModified: '2026-11-08', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/privacy', lastModified: '2026-11-07', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/terms', lastModified: '2026-11-07', changeFrequency: 'monthly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, lastModified, changeFrequency, priority }) => ({
    url: path === '/' ? SITE_URL : `${SITE_URL}${path}`,
    lastModified: new Date(lastModified),
    changeFrequency,
    priority,
  }));
}
