import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchLetterboxdRssResult, pickLetterboxdHandle, resolveLetterboxdRssUrl } from '@/lib/letterboxdRss';
import { buildCanonicalCsv, deduplicateWatchlist, serializeRatingsCsv } from '@/lib/deduplication';
import { downloadRatingsCsv, uploadRatingsCsv, type SyncRssResponse } from '@/lib/vaultStorage';
import { recordSyncOutcome } from '@/lib/adminSync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* -------------------------------------------------------------------------- */
/*  Per-user serialization: read-modify-write on ratings.csv must never       */
/*  interleave (auto-sync on mount + "Run AI" + manual Sync button).          */
/* -------------------------------------------------------------------------- */

const userLocks = new Map<string, Promise<void>>();

async function withUserLock<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = userLocks.get(userId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  userLocks.set(userId, tail);

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (userLocks.get(userId) === tail) userLocks.delete(userId);
  }
}

/* -------------------------------------------------------------------------- */
/*  Small typed helpers (no `any`)                                            */
/* -------------------------------------------------------------------------- */

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function reply(body: SyncRssResponse, status = 200): NextResponse<SyncRssResponse> {
  return NextResponse.json<SyncRssResponse>(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/* -------------------------------------------------------------------------- */
/*  Handler                                                                   */
/* -------------------------------------------------------------------------- */

async function handleSyncRss(req: NextRequest, dryRun: boolean): Promise<NextResponse<SyncRssResponse>> {
  try {
    // 1. Authenticate
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || null;
    const supabase = await createClient(bearerToken);

    const {
      data: { user },
      error: authError,
    } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

    if (authError || !user) {
      return reply({ status: 'error', error: 'Unauthorized: active user session required.' }, 401);
    }

    // Every outcome from here on is also recorded (best-effort) so admins can spot broken feeds.
    // A 'warning' means nothing was synced, so it counts as a failed attempt.
    const respond = async (body: SyncRssResponse, status = 200): Promise<NextResponse<SyncRssResponse>> => {
      await recordSyncOutcome(supabase, user.id, {
        ok: body.status === 'success',
        message: body.status === 'success' ? body.message : body.error ?? body.message,
        filmsSynced: body.uniqueCount ?? null,
      });
      return reply(body, status);
    };

    // 2. Resolve the Letterboxd feed. There is deliberately NO email-prefix fallback:
    //    guessing a handle imported strangers' public diaries into the user's vault.
    const body = req.method === 'POST' ? asRecord(await req.json().catch(() => ({}))) : {};
    const params = req.nextUrl.searchParams;

    const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    const profile = asRecord(profileRow);
    const metadata = asRecord(user.user_metadata);

    const explicitRssUrl = resolveLetterboxdRssUrl(asString(params.get('rss_url')) || asString(body.rss_url));
    const handle = pickLetterboxdHandle(
      params.get('username'),
      body.username,
      profile.letterboxd_username,
      metadata.letterboxd_username
    );
    const storedRssUrl = resolveLetterboxdRssUrl(asString(profile.letterboxd_rss_url) || asString(metadata.letterboxd_rss_url));
    const target = explicitRssUrl ?? (handle ? `https://letterboxd.com/${handle}/rss/` : storedRssUrl);

    if (!target) {
      return respond(
        { status: 'error', error: 'No valid Letterboxd username or RSS URL is configured. Set it in Settings.' },
        400
      );
    }

    return await withUserLock(user.id, async () => {
      // 3. Live RSS
      const rss = await fetchLetterboxdRssResult(target);
      if (!rss.ok) {
        return respond({ status: 'error', error: rss.error }, rss.status);
      }

      // 4. Stored CSV (cache-busted). A FAILED download must abort: treating it as "empty"
      //    would overwrite the whole history with the few rows in the RSS feed.
      const existing = await downloadRatingsCsv(supabase, user.id);
      if (existing.status === 'error') {
        return respond({ status: 'error', error: `Could not read ratings.csv from storage: ${existing.message}` }, 503);
      }
      const existingText = existing.status === 'found' ? existing.text : '';

      // 5. Dedupe + canonical CSV + validation
      const before = deduplicateWatchlist(existingText, null);
      const hasUnreadableData = existingText.trim().split(/\r?\n/).length > 1 && before.totalWatchedCount === 0;
      if (hasUnreadableData) {
        return respond({
          status: 'warning',
          message:
            'Stored ratings.csv has data rows but none could be read. Sync skipped to protect it. Re-upload your Letterboxd ratings.csv in Settings.',
          uniqueCount: 0,
          wroteStorage: false,
        });
      }

      const merged = buildCanonicalCsv(existingText, rss.entries);
      if (!merged.ok) {
        return respond({
          status: 'warning',
          message: `Nothing written: ${merged.error}.`,
          uniqueCount: before.totalWatchedCount,
          wroteStorage: false,
        });
      }

      // Union can only grow. A smaller result means something went wrong, so refuse to write.
      if (merged.rowCount < before.totalWatchedCount) {
        return respond({
          status: 'warning',
          message: `Write aborted: merged result (${merged.rowCount}) is smaller than the stored file (${before.totalWatchedCount}).`,
          uniqueCount: before.totalWatchedCount,
          wroteStorage: false,
        });
      }

      const unchanged = serializeRatingsCsv(before.uniqueMovies) === merged.csv;
      if (unchanged || dryRun) {
        return respond({
          status: 'success',
          message: unchanged ? 'Already up to date. No write needed.' : 'Dry run. No write performed.',
          uniqueCount: merged.rowCount,
          wroteStorage: false,
          username: handle || undefined,
          syncedAt: new Date().toISOString(),
        });
      }

      // 6. Validated write-back (uploadRatingsCsv validates again and aborts on failure)
      const upload = await uploadRatingsCsv(supabase, user.id, merged.csv);
      if (!upload.ok) {
        console.error('[Sync RSS] Storage write failed:', upload.error);
        return respond({ status: 'error', error: upload.error, uniqueCount: merged.rowCount, wroteStorage: false }, 500);
      }

      return respond({
        status: 'success',
        message: `Synced ${upload.rowCount} unique films to your vault.`,
        uniqueCount: upload.rowCount,
        wroteStorage: true,
        username: handle || undefined,
        syncedAt: new Date().toISOString(),
      });
    });
  } catch (err: unknown) {
    console.error('Unhandled failure in /api/sync-rss:', err);
    const msg = err instanceof Error ? err.message : 'Internal RSS sync error';
    return reply({ status: 'error', error: `CultCrate RSS sync failed: ${msg}` }, 500);
  }
}

/** GET is a read-only dry run: it never writes to storage. */
export async function GET(req: NextRequest) {
  return handleSyncRss(req, true);
}

export async function POST(req: NextRequest) {
  return handleSyncRss(req, false);
}
