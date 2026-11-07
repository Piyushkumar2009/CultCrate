export interface ParsedRSSEntry {
  title: string;
  /** Four-digit release year. Entries without a valid year are never emitted by the parser. */
  year?: string;
  /** Decimal string "0.5".."5.0", undefined when the entry is unrated */
  rating?: string;
  /** ISO date (YYYY-MM-DD) or '' when the feed provides no usable date. Never "today". */
  watchedDate: string;
  /** Canonical https://letterboxd.com/film/<slug>/ URL or '' */
  letterboxdUrl: string;
}

const MIN_FILM_YEAR = 1870;
const MAX_FUTURE_YEARS = 5;
const INVALID_TOKENS: ReadonlySet<string> = new Set(['', 'undefined', 'nan', 'null']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LETTERBOXD_USERNAME_RE = /^[A-Za-z0-9_-]{1,40}$/;
const FETCH_TIMEOUT_MS = 10_000;

/** True for '', 'undefined', 'NaN', 'null' (case-insensitive, trimmed) and non-strings. */
export function isInvalidToken(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  return INVALID_TOKENS.has(value.trim().toLowerCase());
}

/** True for a plausible 4-digit release year. */
export function isValidYear(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return false;
  const n = Number(value);
  return n >= MIN_FILM_YEAR && n <= new Date().getFullYear() + MAX_FUTURE_YEARS;
}

/** Returns the year when valid, otherwise ''. */
export function normalizeYear(value: unknown): string {
  const str = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  return isValidYear(str) ? str : '';
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (m, hex: string) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/&#(\d+);/g, (m, dec: string) => {
      const cp = parseInt(dec, 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // must be last to avoid double-decoding (&amp;lt; -> &lt;)
}

/**
 * Unwraps CDATA (content inside CDATA is literal and NOT entity-decoded) and decodes
 * XML entities in the remaining text. Always returns a trimmed string.
 */
export function cleanXmlText(text: string | null | undefined): string {
  if (!text) return '';
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = cdata.exec(text)) !== null) {
    out += decodeXmlEntities(text.slice(last, m.index)) + m[1];
    last = m.index + m[0].length;
  }
  out += decodeXmlEntities(text.slice(last));
  return out.trim();
}

function isHalfStep(n: number): boolean {
  return Number.isFinite(n) && n >= 0.5 && n <= 5 && Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;
}

/**
 * Numeric star parser. Accepts star glyphs (★★★★½) or numeric values ("4", "4.0", 4.5).
 * Returns null for unrated / invalid input. Valid range: 0.5 to 5.0 in 0.5 steps.
 */
export function parseStarRatingToNumber(input: string | number | undefined | null): number | null {
  if (input === undefined || input === null) return null;

  if (typeof input === 'number') {
    return isHalfStep(input) ? input : null;
  }

  const raw = input.replace(/^"|"$/g, '').trim();
  if (isInvalidToken(raw)) return null;

  if (/[★½]/.test(raw)) {
    // Only accept a pure glyph string; stray text means this is not a rating.
    if (!/^[★½\s]+$/.test(raw)) return null;
    const full = (raw.match(/★/g) ?? []).length;
    const half = (raw.match(/½/g) ?? []).length;
    if (half > 1) return null;
    const total = full + half * 0.5;
    return isHalfStep(total) ? total : null;
  }

  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const n = Number(raw);
  return isHalfStep(n) ? n : null;
}

/**
 * Converts star glyphs or numeric ratings to a decimal string ("4.0", "4.5").
 * Returns undefined for anything that is not a valid rating. Never returns 'NaN'/'undefined'.
 */
export function parseStarRating(input: string | number | undefined | null): string | undefined {
  const value = parseStarRatingToNumber(input);
  return value === null ? undefined : value.toFixed(1);
}

/**
 * Splits a raw Letterboxd RSS <title> ("Inception, 2010 - ★★★★") into clean parts.
 *
 * Deliberately conservative: it only strips what the feed format adds (a trailing
 * " - ★★★½" rating and a trailing ", YYYY" year) plus a few known review tags. It does NOT
 * strip arbitrary parentheses or bare trailing numbers, so "(500) Days of Summer",
 * "Cure (Kyua)", "Blade Runner 2049" and "1917" survive intact.
 */
export function cleanMovieTitle(rawTitle: string): { title: string; year?: string; rating?: string } {
  if (typeof rawTitle !== 'string') return { title: '' };

  const original = rawTitle.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!original) return { title: '' };

  let working = original;
  let rating: string | undefined;
  let year: string | undefined;

  // 1. Known trailing review tags
  working = working.replace(/\s*\((?:contains (?:review|spoilers)|no rating|rewatch)\)\s*$/i, '').trim();

  // 2. Trailing " - ★★★½" rating suffix (glyphs only)
  const ratingSuffix = working.match(/^(.*?)\s+[-–—]\s+([★½\s]+)$/);
  if (ratingSuffix) {
    rating = parseStarRating(ratingSuffix[2].trim());
    working = ratingSuffix[1].trim();
  }

  // 3. Trailing ", YYYY" (comma REQUIRED so "Blade Runner 2049" is not truncated)
  const yearSuffix = working.match(/^(.*\S)\s*,\s*(\d{4})$/);
  if (yearSuffix && isValidYear(yearSuffix[2])) {
    working = yearSuffix[1].trim();
    year = yearSuffix[2];
  }

  // Never return an empty title when the input had content
  if (!working) working = original;

  return { title: working, year, rating };
}

/** First matching tag's trimmed & decoded content, else ''. */
function readTag(xml: string, ...tagNames: string[]): string {
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
    const m = xml.match(re);
    if (m) return cleanXmlText(m[1]);
  }
  return '';
}

function toIsoDate(value: string): string {
  const trimmed = value.trim();
  if (ISO_DATE_RE.test(trimmed)) return trimmed;
  if (!trimmed) return '';
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function extractFilmUrl(link: string): string {
  const m = link.match(/letterboxd\.com\/(?:[^/]+\/)?film\/([^/?#]+)/i);
  return m ? `https://letterboxd.com/film/${m[1]}/` : '';
}

/**
 * Parses a Letterboxd RSS feed into clean entries (feed order, newest first).
 * Skips list items, entries without a valid title, and entries without a valid year,
 * because those cannot be deduplicated safely against the stored CSV.
 */
export function parseLetterboxdRSS(xmlContent: string): ParsedRSSEntry[] {
  const entries: ParsedRSSEntry[] = [];
  if (typeof xmlContent !== 'string' || xmlContent.length === 0) return entries;

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xmlContent)) !== null) {
    const itemXml = match[1];

    // Lists are not watched films
    const guid = readTag(itemXml, 'guid');
    const link = readTag(itemXml, 'link');
    if (/^letterboxd-list-/i.test(guid) || /letterboxd\.com\/[^/]+\/list\//i.test(link)) continue;

    let title = readTag(itemXml, 'letterboxd:filmTitle', 'filmTitle');
    let year = normalizeYear(readTag(itemXml, 'letterboxd:filmYear', 'filmYear'));
    let rating = parseStarRating(readTag(itemXml, 'letterboxd:memberRating', 'memberRating'));

    // Fall back to the composite <title> only when structured tags are missing
    if (isInvalidToken(title) || !year || !rating) {
      const fromTitle = cleanMovieTitle(readTag(itemXml, 'title'));
      if (isInvalidToken(title)) title = fromTitle.title;
      if (!year) year = normalizeYear(fromTitle.year);
      if (!rating) rating = fromTitle.rating;
    }

    title = title.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (isInvalidToken(title) || !year) continue;

    const watchedDate =
      toIsoDate(readTag(itemXml, 'letterboxd:watchedDate', 'watchedDate')) ||
      toIsoDate(readTag(itemXml, 'pubDate'));

    entries.push({
      title,
      year,
      rating: rating || undefined,
      watchedDate,
      letterboxdUrl: extractFilmUrl(link),
    });
  }

  return entries;
}

/**
 * Resolves a username (or an RSS URL) to a canonical, SSRF-safe Letterboxd RSS URL.
 * Only https://letterboxd.com/<username>/rss/ is ever produced. Returns null for anything else
 * (including email-style handles, which previously caused strangers' feeds to be imported).
 */
export function resolveLetterboxdRssUrl(usernameOrUrl: string | null | undefined): string | null {
  if (typeof usernameOrUrl !== 'string') return null;
  const input = usernameOrUrl.trim();
  if (!input) return null;

  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'letterboxd.com') return null;
      const m = url.pathname.match(/^\/([A-Za-z0-9_-]{1,40})\/rss\/?$/);
      return m ? `https://letterboxd.com/${m[1]}/rss/` : null;
    } catch {
      return null;
    }
  }

  const handle = input.replace(/^@/, '').trim();
  return LETTERBOXD_USERNAME_RE.test(handle) ? `https://letterboxd.com/${handle}/rss/` : null;
}

/**
 * Returns a valid Letterboxd handle (without "@") or ''. Used everywhere a handle is read from
 * profile rows / user metadata so that malformed values (and email prefixes) are never fetched.
 */
export function normalizeLetterboxdHandle(value: unknown): string {
  if (typeof value !== 'string') return '';
  const handle = value.trim().replace(/^@/, '').trim();
  return LETTERBOXD_USERNAME_RE.test(handle) ? handle : '';
}

/** First valid handle among the candidates, else ''. */
export function pickLetterboxdHandle(...candidates: unknown[]): string {
  for (const c of candidates) {
    const h = normalizeLetterboxdHandle(c);
    if (h) return h;
  }
  return '';
}

export type RssFetchResult =
  | { ok: true; entries: ParsedRSSEntry[]; url: string }
  | { ok: false; status: number; error: string; url: string };

/**
 * Fetches and parses a Letterboxd feed with a hard timeout. Server-side only
 * (letterboxd.com sends no CORS headers, so browsers cannot call it directly).
 * Distinguishes "failed" from "empty feed" so callers never treat an outage as "0 films".
 */
export async function fetchLetterboxdRssResult(usernameOrUrl: string): Promise<RssFetchResult> {
  const url = resolveLetterboxdRssUrl(usernameOrUrl);
  if (!url) {
    return { ok: false, status: 400, error: 'Invalid Letterboxd username or RSS URL.', url: '' };
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 CultCrate/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      return {
        ok: false,
        status: res.status === 404 ? 404 : 502,
        error: `Letterboxd RSS returned HTTP ${res.status}`,
        url,
      };
    }

    const xml = await res.text();
    return { ok: true, entries: parseLetterboxdRSS(xml), url };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network failure';
    return { ok: false, status: 502, error: `Failed to fetch Letterboxd RSS: ${message}`, url };
  }
}

/**
 * Backward-compatible wrapper used by /api/recommendations.
 * Returns [] on any failure (same contract as before).
 */
export async function fetchLetterboxdRSSFeed(usernameOrUrl: string): Promise<ParsedRSSEntry[]> {
  const result = await fetchLetterboxdRssResult(usernameOrUrl);
  if (!result.ok) {
    console.warn(`[Letterboxd RSS] ${result.error}`);
    return [];
  }
  return result.entries;
}
