import type { SupabaseClient } from '@supabase/supabase-js';
import { validateGeneratedCsv } from './deduplication';

/** Private Supabase Storage bucket + per-user object path used by Dashboard, Settings and the sync route. */
export const WATCHLIST_BUCKET = 'watchlists' as const;
export const ratingsCsvPath = (userId: string): string => `${userId}/ratings.csv`;

/* -------------------------------------------------------------------------- */
/*  Download (cache-busted, error-aware)                                      */
/* -------------------------------------------------------------------------- */

export type CsvDownloadResult =
  | { status: 'found'; text: string; bytes: number }
  | { status: 'missing' }
  | { status: 'error'; message: string };

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return 'Unknown storage error';
}

function isNotFoundError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { status?: unknown; statusCode?: unknown; message?: unknown };
  const code = Number(e.status ?? e.statusCode);
  const message = typeof e.message === 'string' ? e.message : '';
  return code === 404 || /not found|does not exist/i.test(message);
}

/**
 * Downloads the user's ratings.csv BYPASSING every cache layer:
 *  - `cache: 'no-store'` skips the browser HTTP cache,
 *  - `cacheNonce` changes the URL so the Supabase CDN cannot serve a stale object.
 *
 * Returns a discriminated result so callers can tell "no file yet" apart from
 * "download failed". Treating a failed download as an empty file is what used to let the
 * sync overwrite a full history with a handful of RSS rows.
 */
export async function downloadRatingsCsv(
  supabase: SupabaseClient,
  userId: string,
  options?: { signal?: AbortSignal }
): Promise<CsvDownloadResult> {
  try {
    const { data, error } = await supabase.storage
      .from(WATCHLIST_BUCKET)
      .download(ratingsCsvPath(userId), { cacheNonce: `${Date.now()}` }, { cache: 'no-store', signal: options?.signal });

    if (error) {
      return isNotFoundError(error) ? { status: 'missing' } : { status: 'error', message: describeError(error) };
    }
    if (!data) return { status: 'missing' };

    const text = await data.text();
    return { status: 'found', text, bytes: data.size };
  } catch (err: unknown) {
    return { status: 'error', message: describeError(err) };
  }
}

/* -------------------------------------------------------------------------- */
/*  Upload (validated)                                                        */
/* -------------------------------------------------------------------------- */

export type CsvUploadResult = { ok: true; rowCount: number; bytes: number } | { ok: false; error: string };

/**
 * The ONLY function allowed to write ratings.csv. It re-validates the payload and aborts
 * before any network call if validation fails or the row count is zero.
 */
export async function uploadRatingsCsv(
  supabase: SupabaseClient,
  userId: string,
  canonicalCsv: string
): Promise<CsvUploadResult> {
  const validation = validateGeneratedCsv(canonicalCsv);
  if (!validation.valid || validation.rowCount <= 0) {
    return { ok: false, error: `Write aborted, CSV failed validation: ${validation.error ?? 'zero valid rows'}` };
  }

  try {
    const body = new Blob([canonicalCsv], { type: 'text/csv' });
    const { error } = await supabase.storage.from(WATCHLIST_BUCKET).upload(ratingsCsvPath(userId), body, {
      contentType: 'text/csv',
      upsert: true,
      cacheControl: '0',
    });
    if (error) return { ok: false, error: describeError(error) };
    return { ok: true, rowCount: validation.rowCount, bytes: body.size };
  } catch (err: unknown) {
    return { ok: false, error: describeError(err) };
  }
}

/* -------------------------------------------------------------------------- */
/*  /api/sync-rss response contract (shared by route + hook)                  */
/* -------------------------------------------------------------------------- */

export interface SyncRssResponse {
  status: 'success' | 'warning' | 'error';
  message?: string;
  error?: string;
  /** Unique films after merging stored CSV + live RSS (in-memory result) */
  uniqueCount?: number;
  /** true only when ratings.csv in Storage was actually rewritten */
  wroteStorage?: boolean;
  username?: string;
  syncedAt?: string;
}

export function isSyncRssResponse(value: unknown): value is SyncRssResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.status === 'success' || v.status === 'warning' || v.status === 'error';
}

/* -------------------------------------------------------------------------- */
/*  Client helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Rejects if `promise` has not settled within `ms`, so no UI can wait forever on the network. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Wipes every locally persisted value. Call it AFTER `supabase.auth.signOut()` has resolved:
 * clearing first removes the refresh token, so the server-side revoke can never happen and the
 * auth cookie survives, which is what produced the half-logged-out state.
 */
export function clearClientStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.clear();
  } catch {
    /* storage may be unavailable (private mode) */
  }
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
}
