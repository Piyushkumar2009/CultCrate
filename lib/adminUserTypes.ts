/** Shape of the detailed per-curator view returned by GET /api/admin/users/[id]. Client-safe (types only). */
import type { AccountStatus, AdminRole } from '@/lib/adminAnalytics';
import type { SyncState } from '@/lib/adminSync';

export type ActivityKind = 'joined' | 'sign_in' | 'recommendations' | 'sync' | 'film';
export type ActivityTone = 'green' | 'red' | 'amber' | 'muted';

export interface UserActivityEvent {
  id: string;
  kind: ActivityKind;
  label: string;
  detail: string | null;
  at: string;
  tone: ActivityTone;
}

export interface UserRecentFilm {
  title: string;
  year: string;
  /** 0 = watched but not rated */
  rating: number;
  watchedDate: string | null;
}

export interface UserLetterboxdInfo {
  handle: string | null;
  state: SyncState | 'not_linked';
  message: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  filmsSynced: number | null;
  consecutiveFailures: number;
  url: string | null;
}

export interface UserDetail {
  generatedAt: string;
  id: string;
  handle: string;
  email: string;
  role: AdminRole;
  status: AccountStatus;
  joinedAt: string;
  lastSeenAt: string | null;
  filmsLogged: number;
  recommendationsCount: number;
  lastRecommendationAt: string | null;
  currentStreak: number;
  longestStreak: number;
  letterboxd: UserLetterboxdInfo;
  recentFilms: UserRecentFilm[];
  activity: UserActivityEvent[];
}

export interface AdminUserDeleteResult {
  ok: true;
  userId: string;
}

/** The minimum the UI needs to act on a curator (role change / delete). Satisfied by AdminUserRow too. */
export interface UserRef {
  id: string;
  handle: string;
  role: AdminRole;
}
