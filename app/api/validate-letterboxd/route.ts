import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const USERNAME_RE = /^[A-Za-z0-9_-]{1,40}$/;
const FORMAT_ERROR = 'Usernames can only use letters, numbers, hyphens and underscores (up to 40).';
const NOT_FOUND_ERROR = 'Letterboxd user not found';
const UNAVAILABLE_ERROR = "We couldn't reach Letterboxd to check this username right now.";

const FETCH_TIMEOUT_MS = 6_000;
const RESULT_TTL_MS = 60_000;
const RATE_LIMIT_PER_MINUTE = 40;
const MAX_TRACKED_ENTRIES = 500;

type ValidationBody =
  | { valid: true }
  | { valid: false; error: string; unavailable?: true };

interface CachedResult {
  status: number;
  body: ValidationBody;
  expiresAt: number;
}

// Best-effort, per-instance protection. Serverless instances do not share memory, which is fine here:
// this only exists so the endpoint can't be used as a high-volume proxy to letterboxd.com.
const resultCache = new Map<string, CachedResult>();
const rateWindows = new Map<string, { count: number; resetAt: number }>();

function prune<T extends { expiresAt?: number; resetAt?: number }>(map: Map<string, T>, now: number) {
  if (map.size <= MAX_TRACKED_ENTRIES) return;
  for (const [key, value] of map) {
    if ((value.expiresAt ?? value.resetAt ?? 0) <= now) map.delete(key);
  }
}

function isRateLimited(ip: string, now: number): boolean {
  prune(rateWindows, now);
  const entry = rateWindows.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateWindows.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

function respond(status: number, body: ValidationBody, cacheable = false): NextResponse<ValidationBody> {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': cacheable ? 'private, max-age=60' : 'no-store' },
  });
}

async function checkLetterboxd(username: string): Promise<{ status: number; body: ValidationBody; cacheable: boolean }> {
  try {
    const res = await fetch(`https://letterboxd.com/${username}/rss/`, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 CultCrate/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    // We only need the status code, so don't download the whole feed.
    await res.body?.cancel().catch(() => undefined);

    // Never trust a redirect that left letterboxd.com.
    const finalHost = res.url ? new URL(res.url).hostname.toLowerCase() : 'letterboxd.com';
    if (finalHost !== 'letterboxd.com') {
      return { status: 503, body: { valid: false, error: UNAVAILABLE_ERROR, unavailable: true }, cacheable: false };
    }

    if (res.status === 200) {
      // A challenge/captcha page can also answer 200, so make sure it really is a feed.
      const contentType = res.headers.get('content-type') ?? '';
      if (/xml/i.test(contentType)) {
        return { status: 200, body: { valid: true }, cacheable: true };
      }
      return { status: 503, body: { valid: false, error: UNAVAILABLE_ERROR, unavailable: true }, cacheable: false };
    }

    if (res.status === 404) {
      return { status: 404, body: { valid: false, error: NOT_FOUND_ERROR }, cacheable: true };
    }

    // 403 / 429 / 5xx: Letterboxd is blocking or down. That says nothing about the username.
    return { status: 503, body: { valid: false, error: UNAVAILABLE_ERROR, unavailable: true }, cacheable: false };
  } catch (err: unknown) {
    console.warn('[validate-letterboxd] upstream check failed:', err instanceof Error ? err.message : err);
    return { status: 503, body: { valid: false, error: UNAVAILABLE_ERROR, unavailable: true }, cacheable: false };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<ValidationBody>> {
  const now = Date.now();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip, now)) {
    return respond(429, { valid: false, error: 'Too many checks. Please wait a minute and try again.' });
  }

  // Sanitize: trim, drop a leading "@", then allow only the characters Letterboxd usernames use.
  const raw = request.nextUrl.searchParams.get('username') ?? '';
  const username = raw.trim().replace(/^@/, '').trim();

  if (!username) {
    return respond(400, { valid: false, error: 'Enter a Letterboxd username.' });
  }
  if (!USERNAME_RE.test(username)) {
    return respond(400, { valid: false, error: FORMAT_ERROR });
  }

  const cacheKey = username.toLowerCase();
  prune(resultCache, now);
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return respond(cached.status, cached.body, true);
  }

  const result = await checkLetterboxd(username);

  if (result.cacheable) {
    resultCache.set(cacheKey, { status: result.status, body: result.body, expiresAt: now + RESULT_TTL_MS });
  }

  return respond(result.status, result.body, result.cacheable);
}
