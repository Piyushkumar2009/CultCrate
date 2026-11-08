/**
 * The canonical public origin of the site, used by metadata, the sitemap and robots.txt.
 * Set NEXT_PUBLIC_APP_URL in Vercel (no trailing slash). It must be the same host that Google Search Console
 * is verified for, otherwise Google ignores the sitemap URLs.
 */
const FALLBACK_SITE_URL = 'https://cultcrate.vercel.app';

function resolveSiteUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(value)) return FALLBACK_SITE_URL;

  // A localhost URL must never reach production sitemaps, canonicals or share cards.
  if (process.env.NODE_ENV === 'production' && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(value)) {
    return FALLBACK_SITE_URL;
  }

  return value;
}

export const SITE_URL: string = resolveSiteUrl(process.env.NEXT_PUBLIC_APP_URL);
