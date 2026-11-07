/**
 * Letterboxd sync health. Pure helpers + one tiny writer used by /api/sync-rss.
 * (Type-only import of the Supabase client, so this module is safe to import in the browser.)
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SyncState = 'success' | 'pending' | 'failed';

export const STALE_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 300;

export interface SyncStatusRow {
  user_id: string;
  status: string | null;
  message: string | null;
  films_synced: number | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number | null;
}

export interface SyncMonitorEntry {
  userId: string;
  handle: string;
  /** The public Letterboxd page for this handle (opened in a new tab by the UI) */
  letterboxdUrl: string | null;
  state: SyncState;
  /** true when the last good sync is older than STALE_AFTER_DAYS */
  stale: boolean;
  message: string | null;
  filmsSynced: number | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
}

export interface SyncCounts {
  success: number;
  pending: number;
  failed: number;
  total: number;
}

export interface SyncMonitorResponse {
  generatedAt: string;
  entries: SyncMonitorEntry[];
  counts: SyncCounts;
  notes: string[];
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/**
 * Never synced (or reported "pending") = Pending, last attempt failed = Failed, otherwise Success.
 * A success older than STALE_AFTER_DAYS stays Success but is flagged stale.
 */
export function deriveSyncState(
  row: Pick<SyncStatusRow, 'status' | 'last_success_at'> | null | undefined,
  now: number
): { state: SyncState; stale: boolean } {
  if (!row) return { state: 'pending', stale: false };
  if (row.status === 'failed') return { state: 'failed', stale: false };
  if (row.status === 'success') {
    const last = parseTime(row.last_success_at);
    return { state: 'success', stale: last !== null && now - last > STALE_AFTER_DAYS * DAY_MS };
  }
  return { state: 'pending', stale: false };
}

export function summarizeSync(entries: ReadonlyArray<Pick<SyncMonitorEntry, 'state'>>): SyncCounts {
  const counts: SyncCounts = { success: 0, pending: 0, failed: 0, total: entries.length };
  for (const e of entries) counts[e.state] += 1;
  return counts;
}

const ATTENTION_ORDER: Record<SyncState, number> = { failed: 0, pending: 1, success: 2 };

/** Broken feeds first (longest-failing on top), then pending, then healthy ones by most recent sync. */
export function sortByAttention<T extends Pick<SyncMonitorEntry, 'state' | 'consecutiveFailures' | 'lastAttemptAt' | 'handle'>>(
  entries: ReadonlyArray<T>
): T[] {
  return [...entries].sort(
    (a, b) =>
      ATTENTION_ORDER[a.state] - ATTENTION_ORDER[b.state] ||
      b.consecutiveFailures - a.consecutiveFailures ||
      (parseTime(b.lastAttemptAt) ?? 0) - (parseTime(a.lastAttemptAt) ?? 0) ||
      a.handle.localeCompare(b.handle)
  );
}

export function buildSyncEntry(input: {
  userId: string;
  handle: string;
  row: SyncStatusRow | null | undefined;
  now: number;
}): SyncMonitorEntry {
  const { userId, handle, row, now } = input;
  const { state, stale } = deriveSyncState(row, now);
  return {
    userId,
    handle,
    letterboxdUrl: handle ? `https://letterboxd.com/${encodeURIComponent(handle)}/` : null,
    state,
    stale,
    message: row?.message ?? null,
    filmsSynced: typeof row?.films_synced === 'number' ? row.films_synced : null,
    lastAttemptAt: row?.last_attempt_at ?? null,
    lastSuccessAt: row?.last_success_at ?? null,
    consecutiveFailures: Math.max(0, Number(row?.consecutive_failures ?? 0) || 0),
  };
}

/* -------------------------------------------------------------------------- */
/*  Recording (called by /api/sync-rss with the curator's own session)         */
/* -------------------------------------------------------------------------- */

export interface SyncOutcome {
  ok: boolean;
  message?: string | null;
  filmsSynced?: number | null;
}

export interface SyncStatusUpsert {
  user_id: string;
  status: 'success' | 'failed';
  message: string | null;
  films_synced: number | null;
  last_attempt_at: string;
  last_success_at: string | null;
  consecutive_failures: number;
  updated_at: string;
}

/** Builds the row to upsert. Failures count up, a success resets the counter and keeps the old success time otherwise. */
export function nextSyncRecord(
  userId: string,
  previous: Pick<SyncStatusRow, 'last_success_at' | 'consecutive_failures' | 'films_synced'> | null | undefined,
  outcome: SyncOutcome,
  nowIso: string
): SyncStatusUpsert {
  const message = (outcome.message ?? '').toString().trim().slice(0, MAX_MESSAGE_LENGTH) || null;
  const films = typeof outcome.filmsSynced === 'number' && Number.isFinite(outcome.filmsSynced) ? Math.max(0, Math.floor(outcome.filmsSynced)) : null;
  return {
    user_id: userId,
    status: outcome.ok ? 'success' : 'failed',
    message,
    films_synced: films ?? previous?.films_synced ?? null,
    last_attempt_at: nowIso,
    last_success_at: outcome.ok ? nowIso : previous?.last_success_at ?? null,
    consecutive_failures: outcome.ok ? 0 : Math.max(0, Number(previous?.consecutive_failures ?? 0) || 0) + 1,
    updated_at: nowIso,
  };
}

/**
 * Best-effort write of the latest sync result. It must NEVER break or slow down the sync itself,
 * so every failure (missing table, RLS, network) is swallowed.
 */
export async function recordSyncOutcome(supabase: SupabaseClient, userId: string, outcome: SyncOutcome): Promise<void> {
  try {
    const { data: previous } = await supabase
      .from('letterboxd_sync_status')
      .select('last_success_at, consecutive_failures, films_synced')
      .eq('user_id', userId)
      .maybeSingle();
    const record = nextSyncRecord(userId, previous, outcome, new Date().toISOString());
    await supabase.from('letterboxd_sync_status').upsert(record, { onConflict: 'user_id' });
  } catch {
    /* monitoring is optional */
  }
}
