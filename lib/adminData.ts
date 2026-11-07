import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type AdminSummary,
  type RawAuthUser,
  aggregateCountries,
  aggregateGenres,
  buildActivitySeries,
  buildGrowthSeries,
  buildUserRows,
  summarizeKpis,
} from '@/lib/adminAnalytics';

const USERS_PER_PAGE = 1000;
const MAX_USER_PAGES = 5;
const MAX_TABLE_ROWS = 5000;
const UUID_FOLDER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? data.filter((r): r is Row => typeof r === 'object' && r !== null) : [];
}

function asRecord(value: unknown): Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Row) : {};
}

function asTimeMs(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) return c;
    if (typeof c === 'string' && c.trim()) {
      const numeric = Number(c);
      if (Number.isFinite(numeric) && numeric > 1e11) return numeric; // bigint milliseconds arrive as strings
      const parsed = Date.parse(c);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/** Every account, newest pages first-come, capped for performance. */
export async function listAllUsers(admin: SupabaseClient): Promise<{ users: RawAuthUser[]; truncated: boolean }> {
  const users: RawAuthUser[] = [];
  let truncated = false;

  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    if (error) throw error;

    for (const u of data.users) {
      const raw = u as unknown as Row;
      users.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        banned_until: typeof raw.banned_until === 'string' ? raw.banned_until : null,
        app_metadata: asRecord(u.app_metadata),
        user_metadata: asRecord(u.user_metadata),
      });
    }

    if (data.users.length < USERS_PER_PAGE) break;
    if (page === MAX_USER_PAGES) truncated = true;
  }

  return { users, truncated };
}

/**
 * Collects everything the Admin Panel shows. Uses the service-role client, so it MUST only be called
 * after getAdminSession() has confirmed the caller is an admin.
 */
export async function buildAdminSummary(admin: SupabaseClient, currentUserId: string): Promise<AdminSummary> {
  const now = Date.now();
  const notes: string[] = [];

  const { users, truncated } = await listAllUsers(admin);
  const knownIds = new Set(users.map((u) => u.id));

  // --- Letterboxd handles saved on profiles (optional column) -----------------------------------------
  const profileHandles = new Map<string, string>();
  const profiles = await admin.from('profiles').select('id, letterboxd_username').limit(MAX_TABLE_ROWS);
  if (!profiles.error) {
    for (const row of asRows(profiles.data)) {
      if (typeof row.id === 'string' && typeof row.letterboxd_username === 'string' && row.letterboxd_username.trim()) {
        profileHandles.set(row.id, row.letterboxd_username.trim());
      }
    }
  }

  // --- Latest recommendation batch per curator ------------------------------------------------------------
  const lastRecommendationAt = new Map<string, number>();
  const recommendedFilms: Array<{ genre?: unknown; country?: unknown }> = [];
  const recs = await admin.from('user_recommendations').select('user_id, films, timestamp, updated_at').limit(MAX_TABLE_ROWS);
  if (recs.error) {
    notes.push("Recommendation activity isn't available yet. Finish the database setup to turn these charts on.");
  } else {
    for (const row of asRows(recs.data)) {
      if (typeof row.user_id !== 'string' || !knownIds.has(row.user_id)) continue;
      const at = asTimeMs(row.timestamp, row.updated_at);
      if (at !== null) lastRecommendationAt.set(row.user_id, at);
      if (Array.isArray(row.films)) {
        for (const film of row.films) {
          const f = asRecord(film);
          recommendedFilms.push({ genre: f.genre, country: f.country });
        }
      }
    }
  }

  // --- Films logged per curator (table first, account metadata as fallback) ---------------------------------
  const filmsLogged = new Map<string, number>();
  const dna = await admin.from('cinematic_dna').select('user_id, watched_count').limit(MAX_TABLE_ROWS);
  if (!dna.error) {
    for (const row of asRows(dna.data)) {
      const count = Number(row.watched_count);
      if (typeof row.user_id === 'string' && Number.isFinite(count) && count > 0) filmsLogged.set(row.user_id, count);
    }
  }
  for (const u of users) {
    if (filmsLogged.has(u.id)) continue;
    const count = Number(asRecord(asRecord(u.user_metadata).cinematic_dna).watchedCount);
    if (Number.isFinite(count) && count > 0) filmsLogged.set(u.id, count);
  }

  // --- Linked Letterboxd libraries (one storage folder per curator) -----------------------------------------
  let librariesLinked: number | null = null;
  try {
    const { data, error } = await admin.storage.from('watchlists').list('', { limit: 1000 });
    if (error) throw error;
    librariesLinked = (data ?? []).filter((item) => UUID_FOLDER.test(item.name) && knownIds.has(item.name)).length;
  } catch {
    notes.push("Linked library counts aren't available right now.");
  }

  const runTimestamps = Array.from(lastRecommendationAt.values());

  return {
    generatedAt: new Date(now).toISOString(),
    kpis: summarizeKpis({
      users,
      runTimestamps,
      filmsLoggedPerCurator: Array.from(filmsLogged.values()),
      librariesLinked,
      now,
    }),
    growth: buildGrowthSeries(users, now, 30),
    activity: buildActivitySeries(runTimestamps, now, 30),
    genres: aggregateGenres(recommendedFilms, 8),
    countries: aggregateCountries(recommendedFilms, 6),
    users: buildUserRows(users, { profileHandles, lastRecommendationAt, now }),
    notes,
    truncated,
    currentUserId,
  };
}
