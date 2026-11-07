/**
 * Pure, dependency-free analytics helpers for the Admin Panel.
 * No database or network access lives here, so everything is unit-testable.
 */

export type AccountStatus = 'active' | 'inactive' | 'pending' | 'suspended';
export type AdminRole = 'admin' | 'curator';

export const ACTIVE_WINDOW_DAYS = 30;
export const NEW_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/* -------------------------------------------------------------------------- */
/*  Shapes shared by the server routes and the admin UI                       */
/* -------------------------------------------------------------------------- */

export interface RawAuthUser {
  id: string;
  email?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface AdminUserRow {
  /** Internal reference used only for actions. It is never rendered in the UI. */
  id: string;
  handle: string;
  email: string;
  status: AccountStatus;
  role: AdminRole;
  joinedAt: string;
  lastSeenAt: string | null;
  lastRecommendationAt: string | null;
}

export interface GrowthPoint {
  date: string;
  label: string;
  totalCurators: number;
  newCurators: number;
  seenThatDay: number;
}

export interface ActivityPoint {
  date: string;
  label: string;
  runs: number;
}

export interface DistributionSlice {
  label: string;
  count: number;
  /** Percentage of all mentions, one decimal place */
  share: number;
}

export interface AdminKpis {
  totalCurators: number;
  newThisWeek: number;
  activeThisMonth: number;
  admins: number;
  filmsLogged: number;
  recommendationRunsThisWeek: number;
  curatorsWithRecommendations: number;
  /** null when the storage listing was unavailable */
  librariesLinked: number | null;
}

export interface AdminSummary {
  generatedAt: string;
  kpis: AdminKpis;
  growth: GrowthPoint[];
  activity: ActivityPoint[];
  genres: DistributionSlice[];
  countries: DistributionSlice[];
  users: AdminUserRow[];
  /** Plain-English notes about data that could not be loaded */
  notes: string[];
  /** true when the user list was capped for performance */
  truncated: boolean;
  /** the signed-in admin's own reference, so the UI can disable self-changes */
  currentUserId: string;
}

/* -------------------------------------------------------------------------- */
/*  Roles                                                                     */
/* -------------------------------------------------------------------------- */

/** The ONLY definition of "is an admin". Stored in Supabase Auth app_metadata (service-role write only). */
export function isAdminUser(appMetadata: unknown): boolean {
  return typeof appMetadata === 'object' && appMetadata !== null && (appMetadata as Record<string, unknown>).role === 'admin';
}

/* -------------------------------------------------------------------------- */
/*  Dates                                                                     */
/* -------------------------------------------------------------------------- */

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const [, m, d] = key.split('-');
  return `${MONTHS[Number(m) - 1] ?? ''} ${Number(d)}`;
}

/** Last `days` UTC day keys ending today, oldest first. */
function lastDayKeys(now: number, days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(utcDayKey(now - i * DAY_MS));
  return keys;
}

/* -------------------------------------------------------------------------- */
/*  Users                                                                     */
/* -------------------------------------------------------------------------- */

export function deriveStatus(user: RawAuthUser, now: number): AccountStatus {
  const bannedUntil = parseTime(user.banned_until);
  if (bannedUntil !== null && bannedUntil > now) return 'suspended';
  if (!user.email_confirmed_at) return 'pending';
  const lastSeen = parseTime(user.last_sign_in_at);
  if (lastSeen !== null && now - lastSeen <= ACTIVE_WINDOW_DAYS * DAY_MS) return 'active';
  return 'inactive';
}

/** Friendly display name: Letterboxd handle first, then the e-mail name, never an ID. */
export function deriveHandle(user: RawAuthUser, profileHandle?: string | null): string {
  const meta = user.user_metadata ?? {};
  const candidates = [meta.letterboxd_username, profileHandle];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim().replace(/^@/, '');
  }
  const local = (user.email ?? '').split('@')[0]?.trim();
  return local || 'Unnamed curator';
}

export function buildUserRows(
  users: ReadonlyArray<RawAuthUser>,
  context: {
    profileHandles?: ReadonlyMap<string, string>;
    lastRecommendationAt?: ReadonlyMap<string, number>;
    now: number;
  }
): AdminUserRow[] {
  const rows = users.map<AdminUserRow>((u) => {
    const lastRun = context.lastRecommendationAt?.get(u.id);
    return {
      id: u.id,
      handle: deriveHandle(u, context.profileHandles?.get(u.id)),
      email: u.email ?? 'No email on file',
      status: deriveStatus(u, context.now),
      role: isAdminUser(u.app_metadata) ? 'admin' : 'curator',
      joinedAt: u.created_at,
      lastSeenAt: u.last_sign_in_at ?? null,
      lastRecommendationAt: typeof lastRun === 'number' ? new Date(lastRun).toISOString() : null,
    };
  });
  // Admins first, then newest members
  return rows.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return (parseTime(b.joinedAt) ?? 0) - (parseTime(a.joinedAt) ?? 0);
  });
}

/* -------------------------------------------------------------------------- */
/*  Time series                                                               */
/* -------------------------------------------------------------------------- */

export function buildGrowthSeries(users: ReadonlyArray<RawAuthUser>, now: number, days = 30): GrowthPoint[] {
  const keys = lastDayKeys(now, days);
  const created = users.map((u) => parseTime(u.created_at)).filter((t): t is number => t !== null);
  const seen = users.map((u) => parseTime(u.last_sign_in_at)).filter((t): t is number => t !== null);

  const newByDay = new Map<string, number>();
  for (const t of created) newByDay.set(utcDayKey(t), (newByDay.get(utcDayKey(t)) ?? 0) + 1);
  const seenByDay = new Map<string, number>();
  for (const t of seen) seenByDay.set(utcDayKey(t), (seenByDay.get(utcDayKey(t)) ?? 0) + 1);

  return keys.map((key) => {
    const endOfDay = Date.parse(`${key}T23:59:59.999Z`);
    return {
      date: key,
      label: dayLabel(key),
      totalCurators: created.filter((t) => t <= endOfDay).length,
      newCurators: newByDay.get(key) ?? 0,
      seenThatDay: seenByDay.get(key) ?? 0,
    };
  });
}

export function buildActivitySeries(runTimestamps: ReadonlyArray<number>, now: number, days = 30): ActivityPoint[] {
  const keys = lastDayKeys(now, days);
  const byDay = new Map<string, number>();
  for (const t of runTimestamps) {
    if (!Number.isFinite(t)) continue;
    const key = utcDayKey(t);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return keys.map((key) => ({ date: key, label: dayLabel(key), runs: byDay.get(key) ?? 0 }));
}

/* -------------------------------------------------------------------------- */
/*  Distributions                                                             */
/* -------------------------------------------------------------------------- */

interface FilmLike {
  genre?: unknown;
  country?: unknown;
}

function toLabels(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,•·/]/) : [];
  return list.map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v) => v.length > 0);
}

function aggregate(labelsPerFilm: ReadonlyArray<ReadonlyArray<string>>, topN: number): DistributionSlice[] {
  const counts = new Map<string, { label: string; count: number }>();
  let total = 0;
  for (const labels of labelsPerFilm) {
    const seenInFilm = new Set<string>();
    for (const label of labels) {
      const key = label.toLowerCase();
      if (seenInFilm.has(key)) continue;
      seenInFilm.add(key);
      const entry = counts.get(key) ?? { label, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
      total += 1;
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : 1))
    .slice(0, topN)
    .map((e) => ({ label: e.label, count: e.count, share: total > 0 ? Math.round((e.count / total) * 1000) / 10 : 0 }));
}

/** Most common genres across a set of recommended films. */
export function aggregateGenres(films: ReadonlyArray<FilmLike>, topN = 8): DistributionSlice[] {
  return aggregate(films.map((f) => toLabels(f.genre)), topN);
}

/** Most common countries across a set of recommended films (ignores generic placeholders). */
export function aggregateCountries(films: ReadonlyArray<FilmLike>, topN = 6): DistributionSlice[] {
  const generic = new Set(['international', 'global', 'unknown', '']);
  return aggregate(
    films.map((f) => toLabels(f.country).filter((c) => !generic.has(c.toLowerCase()))),
    topN
  );
}

/* -------------------------------------------------------------------------- */
/*  Headline numbers                                                          */
/* -------------------------------------------------------------------------- */

export function summarizeKpis(input: {
  users: ReadonlyArray<RawAuthUser>;
  runTimestamps: ReadonlyArray<number>;
  filmsLoggedPerCurator: ReadonlyArray<number>;
  librariesLinked: number | null;
  now: number;
}): AdminKpis {
  const { users, runTimestamps, filmsLoggedPerCurator, librariesLinked, now } = input;
  const newCutoff = now - NEW_WINDOW_DAYS * DAY_MS;
  const activeCutoff = now - ACTIVE_WINDOW_DAYS * DAY_MS;

  return {
    totalCurators: users.length,
    newThisWeek: users.filter((u) => (parseTime(u.created_at) ?? 0) >= newCutoff).length,
    activeThisMonth: users.filter((u) => (parseTime(u.last_sign_in_at) ?? 0) >= activeCutoff).length,
    admins: users.filter((u) => isAdminUser(u.app_metadata)).length,
    filmsLogged: filmsLoggedPerCurator.reduce((sum, n) => sum + (Number.isFinite(n) && n > 0 ? n : 0), 0),
    recommendationRunsThisWeek: runTimestamps.filter((t) => Number.isFinite(t) && t >= newCutoff).length,
    curatorsWithRecommendations: runTimestamps.length,
    librariesLinked,
  };
}

/* -------------------------------------------------------------------------- */
/*  API contracts                                                             */
/* -------------------------------------------------------------------------- */

export type AdminApiErrorCode =
  | 'signed_out'
  | 'no_access'
  | 'setup_required'
  | 'load_failed'
  | 'bad_request'
  | 'not_found'
  | 'not_allowed';

export interface AdminApiError {
  error: string;
  code: AdminApiErrorCode;
}

export interface AdminRoleChangeResult {
  ok: true;
  userId: string;
  role: AdminRole;
}
