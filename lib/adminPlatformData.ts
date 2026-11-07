import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveHandle, deriveStatus, isAdminUser, type RawAuthUser } from '@/lib/adminAnalytics';
import { listAllUsers } from '@/lib/adminData';
import { deduplicateWatchlist } from '@/lib/deduplication';
import { downloadRatingsCsv } from '@/lib/vaultStorage';
import {
  computeStreak,
  rankCandidates,
  type LeaderboardCandidate,
  type LeaderboardMetric,
  type LeaderboardResponse,
} from '@/lib/adminLeaderboard';
import {
  buildSyncEntry,
  deriveSyncState,
  sortByAttention,
  summarizeSync,
  type SyncMonitorResponse,
  type SyncStatusRow,
} from '@/lib/adminSync';
import type { UserActivityEvent, UserDetail } from '@/lib/adminUserTypes';

const MAX_ROWS = 5000;
/** Streaks need each curator's ratings.csv, so only the busiest libraries are measured. */
export const STREAK_POOL_SIZE = 30;
const STREAK_CACHE_MS = 5 * 60 * 1000;
const STREAK_CONCURRENCY = 6;

type Row = Record<string, unknown>;

const asRows = (data: unknown): Row[] =>
  Array.isArray(data) ? data.filter((r): r is Row => typeof r === 'object' && r !== null) : [];
const asRecord = (value: unknown): Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Row) : {};
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

function filmsFromMetadata(u: RawAuthUser): number {
  const count = Number(asRecord(asRecord(u.user_metadata).cinematic_dna).watchedCount);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

async function loadProfileHandles(admin: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const res = await admin.from('profiles').select('id, letterboxd_username').limit(MAX_ROWS);
  if (!res.error) {
    for (const row of asRows(res.data)) {
      const handle = str(row.letterboxd_username);
      if (typeof row.id === 'string' && handle) map.set(row.id, handle.replace(/^@/, ''));
    }
  }
  return map;
}

/** Real Letterboxd handle only (never an e-mail prefix), because it is used to build a public link. */
function letterboxdHandleOf(u: RawAuthUser, profileHandles: ReadonlyMap<string, string>): string | null {
  const meta = str(asRecord(u.user_metadata).letterboxd_username);
  return profileHandles.get(u.id) ?? (meta ? meta.replace(/^@/, '') : null);
}

/* -------------------------------------------------------------------------- */
/*  Leaderboard                                                               */
/* -------------------------------------------------------------------------- */

const streakCache = new Map<string, { at: number; current: number }>();

async function measureStreaks(admin: SupabaseClient, userIds: ReadonlyArray<string>, now: number): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const todo: string[] = [];
  for (const id of userIds) {
    const hit = streakCache.get(id);
    if (hit && now - hit.at < STREAK_CACHE_MS) result.set(id, hit.current);
    else todo.push(id);
  }

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < todo.length) {
      const id = todo[cursor++];
      const csv = await downloadRatingsCsv(admin, id);
      if (csv.status !== 'found') continue;
      const dates = deduplicateWatchlist(csv.text, null).uniqueMovies.flatMap((m) => (m.watchedDate ? [m.watchedDate] : []));
      const { current } = computeStreak(dates, now);
      streakCache.set(id, { at: now, current });
      result.set(id, current);
    }
  };
  await Promise.all(Array.from({ length: Math.min(STREAK_CONCURRENCY, todo.length) }, worker));
  return result;
}

export async function buildLeaderboard(
  admin: SupabaseClient,
  metric: LeaderboardMetric,
  limit: number,
  now = Date.now()
): Promise<LeaderboardResponse> {
  const { users } = await listAllUsers(admin);
  const known = new Set(users.map((u) => u.id));

  const [profileHandles, dna, recs] = await Promise.all([
    loadProfileHandles(admin),
    admin.from('cinematic_dna').select('user_id, watched_count').limit(MAX_ROWS),
    admin.from('user_recommendations').select('user_id, films').limit(MAX_ROWS),
  ]);

  const films = new Map<string, number>();
  if (!dna.error) {
    for (const row of asRows(dna.data)) {
      const n = Number(row.watched_count);
      if (typeof row.user_id === 'string' && Number.isFinite(n) && n > 0) films.set(row.user_id, n);
    }
  }
  const recommendations = new Map<string, number>();
  if (!recs.error) {
    for (const row of asRows(recs.data)) {
      if (typeof row.user_id === 'string' && known.has(row.user_id) && Array.isArray(row.films)) {
        recommendations.set(row.user_id, row.films.length);
      }
    }
  }

  const candidates: LeaderboardCandidate[] = users.map((u) => ({
    userId: u.id,
    handle: deriveHandle(u, profileHandles.get(u.id)),
    role: isAdminUser(u.app_metadata) ? 'admin' : 'curator',
    filmsLogged: films.get(u.id) ?? filmsFromMetadata(u),
    currentStreak: null,
    recommendations: recommendations.get(u.id) ?? 0,
    lastSeenAt: u.last_sign_in_at ?? null,
    letterboxdHandle: letterboxdHandleOf(u, profileHandles),
  }));

  let streakCandidates = 0;
  if (metric === 'streak') {
    const pool = [...candidates].filter((c) => c.filmsLogged > 0).sort((a, b) => b.filmsLogged - a.filmsLogged).slice(0, STREAK_POOL_SIZE);
    streakCandidates = pool.length;
    const streaks = await measureStreaks(admin, pool.map((c) => c.userId), now);
    for (const c of candidates) c.currentStreak = streaks.get(c.userId) ?? null;
  } else {
    for (const c of candidates) c.currentStreak = streakCache.get(c.userId)?.current ?? null;
  }

  return { metric, generatedAt: new Date(now).toISOString(), entries: rankCandidates(candidates, metric, limit), streakCandidates };
}

/* -------------------------------------------------------------------------- */
/*  Letterboxd sync monitor                                                   */
/* -------------------------------------------------------------------------- */

export async function buildSyncMonitor(admin: SupabaseClient, now = Date.now()): Promise<SyncMonitorResponse> {
  const notes: string[] = [];
  const { users } = await listAllUsers(admin);
  const profileHandles = await loadProfileHandles(admin);

  const rows = new Map<string, SyncStatusRow>();
  const res = await admin
    .from('letterboxd_sync_status')
    .select('user_id, status, message, films_synced, last_attempt_at, last_success_at, consecutive_failures')
    .limit(MAX_ROWS);
  if (res.error) {
    notes.push("Sync history isn't being recorded yet, so every linked library shows as Pending. Run the 20261106 migration to turn it on.");
  } else {
    for (const row of asRows(res.data)) {
      if (typeof row.user_id === 'string') rows.set(row.user_id, row as unknown as SyncStatusRow);
    }
  }

  const entries = users.flatMap((u) => {
    const lb = letterboxdHandleOf(u, profileHandles);
    const row = rows.get(u.id) ?? null;
    if (!lb && !row) return []; // not linked and never synced: nothing to monitor
    return [buildSyncEntry({ userId: u.id, handle: lb ?? deriveHandle(u, null), row, now })];
  });

  const sorted = sortByAttention(entries);
  return { generatedAt: new Date(now).toISOString(), entries: sorted, counts: summarizeSync(sorted), notes };
}

/* -------------------------------------------------------------------------- */
/*  Single-user detail (drawer)                                               */
/* -------------------------------------------------------------------------- */

export async function buildUserDetail(admin: SupabaseClient, userId: string, now = Date.now()): Promise<UserDetail | null> {
  const found = await admin.auth.admin.getUserById(userId);
  if (found.error || !found.data.user) return null;
  const u = found.data.user;
  const raw: RawAuthUser = {
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
    banned_until: typeof (u as unknown as Row).banned_until === 'string' ? ((u as unknown as Row).banned_until as string) : null,
    app_metadata: asRecord(u.app_metadata),
    user_metadata: asRecord(u.user_metadata),
  };

  const [profile, dna, recs, sync, csv] = await Promise.all([
    admin.from('profiles').select('letterboxd_username').eq('id', userId).maybeSingle(),
    admin.from('cinematic_dna').select('watched_count').eq('user_id', userId).maybeSingle(),
    admin.from('user_recommendations').select('films, timestamp, updated_at').eq('user_id', userId).maybeSingle(),
    admin
      .from('letterboxd_sync_status')
      .select('user_id, status, message, films_synced, last_attempt_at, last_success_at, consecutive_failures')
      .eq('user_id', userId)
      .maybeSingle(),
    downloadRatingsCsv(admin, userId),
  ]);

  const profileHandle = str(asRecord(profile.data).letterboxd_username);
  const lbHandle = profileHandle ?? str(raw.user_metadata?.letterboxd_username);
  const cleanLb = lbHandle ? lbHandle.replace(/^@/, '') : null;

  // Films: the stored library is the source of truth, the saved Cinematic DNA count is the fallback
  const library = csv.status === 'found' ? deduplicateWatchlist(csv.text, null) : null;
  const dnaCount = Number(asRecord(dna.data).watched_count);
  const filmsLogged = Math.max(library?.totalWatchedCount ?? 0, Number.isFinite(dnaCount) ? dnaCount : 0, filmsFromMetadata(raw));

  const streak = computeStreak(
    (library?.uniqueMovies ?? []).flatMap((m) => (m.watchedDate ? [m.watchedDate] : [])),
    now
  );
  const recentFilms = (library?.uniqueMovies ?? [])
    .filter((m) => m.watchedDate)
    .sort((a, b) => (b.watchedDate ?? '').localeCompare(a.watchedDate ?? ''))
    .slice(0, 6)
    .map((m) => ({ title: m.title, year: m.year, rating: m.rating, watchedDate: m.watchedDate ?? null }));

  const recRow = asRecord(recs.data);
  const recAtRaw = Number(recRow.timestamp);
  const lastRecommendationAt = Number.isFinite(recAtRaw) && recAtRaw > 1e11
    ? new Date(recAtRaw).toISOString()
    : str(recRow.updated_at);

  const syncRow = sync.error ? null : ((sync.data as SyncStatusRow | null) ?? null);
  const derived = deriveSyncState(syncRow, now);

  const events: UserActivityEvent[] = [
    { id: 'joined', kind: 'joined', label: 'Joined CultCrate', detail: null, at: raw.created_at, tone: 'muted' },
  ];
  if (raw.last_sign_in_at) events.push({ id: 'sign_in', kind: 'sign_in', label: 'Last signed in', detail: null, at: raw.last_sign_in_at, tone: 'green' });
  if (lastRecommendationAt) {
    const n = Array.isArray(recRow.films) ? recRow.films.length : 0;
    events.push({ id: 'recs', kind: 'recommendations', label: 'Generated recommendations', detail: n ? `${n} picks` : null, at: lastRecommendationAt, tone: 'green' });
  }
  if (syncRow?.last_attempt_at) {
    events.push({
      id: 'sync',
      kind: 'sync',
      label: derived.state === 'failed' ? 'Letterboxd sync failed' : 'Letterboxd sync ran',
      detail: syncRow.message ?? null,
      at: syncRow.last_attempt_at,
      tone: derived.state === 'failed' ? 'red' : 'green',
    });
  }
  recentFilms.slice(0, 5).forEach((f, i) =>
    events.push({
      id: `film-${i}`,
      kind: 'film',
      label: `Logged ${f.title}${f.year ? ` (${f.year})` : ''}`,
      detail: f.rating > 0 ? `${f.rating.toFixed(1)} / 5` : 'Not rated',
      at: `${f.watchedDate}T00:00:00.000Z`,
      tone: 'muted',
    })
  );
  const activity = events
    .filter((e) => Number.isFinite(Date.parse(e.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 12);

  return {
    generatedAt: new Date(now).toISOString(),
    id: raw.id,
    handle: deriveHandle(raw, profileHandle),
    email: raw.email ?? 'No email on file',
    role: isAdminUser(raw.app_metadata) ? 'admin' : 'curator',
    status: deriveStatus(raw, now),
    joinedAt: raw.created_at,
    lastSeenAt: raw.last_sign_in_at ?? null,
    filmsLogged,
    recommendationsCount: Array.isArray(recRow.films) ? recRow.films.length : 0,
    lastRecommendationAt,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    letterboxd: {
      handle: cleanLb,
      state: !cleanLb && !syncRow ? 'not_linked' : derived.state,
      message: syncRow?.message ?? null,
      lastAttemptAt: syncRow?.last_attempt_at ?? null,
      lastSuccessAt: syncRow?.last_success_at ?? null,
      filmsSynced: typeof syncRow?.films_synced === 'number' ? syncRow.films_synced : null,
      consecutiveFailures: Math.max(0, Number(syncRow?.consecutive_failures ?? 0) || 0),
      url: cleanLb ? `https://letterboxd.com/${encodeURIComponent(cleanLb)}/` : null,
    },
    recentFilms,
    activity,
  };
}
