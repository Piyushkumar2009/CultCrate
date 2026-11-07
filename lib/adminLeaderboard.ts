/**
 * Leaderboard ranking + streak maths. Pure (no database / network) so it is unit-tested.
 * Shared by the /api/admin/leaderboard route and the leaderboard UI.
 */
import type { AdminRole } from '@/lib/adminAnalytics';

export type LeaderboardMetric = 'films' | 'streak' | 'recommendations';
export type RankBadge = 'gold' | 'silver' | 'bronze';

export const LEADERBOARD_METRICS: ReadonlyArray<LeaderboardMetric> = ['films', 'streak', 'recommendations'];

export function isLeaderboardMetric(value: unknown): value is LeaderboardMetric {
  return typeof value === 'string' && (LEADERBOARD_METRICS as ReadonlyArray<string>).includes(value);
}

export interface LeaderboardCandidate {
  userId: string;
  handle: string;
  role: AdminRole;
  filmsLogged: number;
  /** null = not measured for this curator (streaks are only computed for the busiest libraries) */
  currentStreak: number | null;
  /** Films in the curator's latest recommendation batch */
  recommendations: number;
  lastSeenAt: string | null;
  letterboxdHandle: string | null;
}

export interface LeaderboardEntry extends LeaderboardCandidate {
  rank: number;
  badge: RankBadge | null;
  /** The number the list is ranked by for the chosen metric */
  value: number;
}

export interface LeaderboardResponse {
  metric: LeaderboardMetric;
  generatedAt: string;
  entries: LeaderboardEntry[];
  /** How many libraries were read to measure streaks. Streak ranking only covers these curators. */
  streakCandidates: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

function dayIndex(isoDay: string): number | null {
  const t = Date.parse(`${isoDay.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / DAY_MS) : null;
}

/**
 * Consecutive-day viewing streak from a list of watched dates ("YYYY-MM-DD", extra time parts ignored).
 * `current` counts back from today, and a streak that ended YESTERDAY is still alive (the curator
 * simply has not logged today yet). `longest` is the best run ever.
 */
export function computeStreak(dates: ReadonlyArray<string>, nowMs: number): { current: number; longest: number } {
  const days = new Set<number>();
  for (const d of dates) {
    if (typeof d !== 'string' || !ISO_DAY.test(d)) continue;
    const idx = dayIndex(d);
    if (idx !== null) days.add(idx);
  }
  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = Array.from(days).sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const today = Math.floor(nowMs / DAY_MS);
  let cursor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  let current = 0;
  while (cursor !== null && days.has(cursor)) {
    current += 1;
    cursor -= 1;
  }
  return { current, longest };
}

export function metricValue(candidate: LeaderboardCandidate, metric: LeaderboardMetric): number | null {
  switch (metric) {
    case 'films':
      return candidate.filmsLogged;
    case 'streak':
      return candidate.currentStreak;
    case 'recommendations':
      return candidate.recommendations;
  }
}

export function badgeForRank(rank: number): RankBadge | null {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null;
}

/**
 * Standard competition ranking ("1, 2, 2, 4"): curators with the same number share a rank (and badge).
 * Curators with nothing to show for the metric (0 or not measured) are left off. Ordering is fully
 * deterministic: value, then films logged, then handle, then id.
 */
export function rankCandidates(
  candidates: ReadonlyArray<LeaderboardCandidate>,
  metric: LeaderboardMetric,
  limit = 25
): LeaderboardEntry[] {
  const scored = candidates
    .map((c) => ({ c, value: metricValue(c, metric) }))
    .filter((x): x is { c: LeaderboardCandidate; value: number } => typeof x.value === 'number' && Number.isFinite(x.value) && x.value > 0)
    .sort(
      (a, b) =>
        b.value - a.value ||
        b.c.filmsLogged - a.c.filmsLogged ||
        a.c.handle.localeCompare(b.c.handle) ||
        a.c.userId.localeCompare(b.c.userId)
    );

  const entries: LeaderboardEntry[] = [];
  let rank = 0;
  let previous: number | null = null;
  scored.forEach((row, index) => {
    if (previous === null || row.value !== previous) rank = index + 1;
    previous = row.value;
    entries.push({ ...row.c, rank, badge: badgeForRank(rank), value: row.value });
  });
  return entries.slice(0, Math.max(1, Math.floor(limit)));
}
