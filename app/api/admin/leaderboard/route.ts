import type { NextRequest } from 'next/server';
import { fail, guardAdmin, ok, routeError } from '@/lib/adminApi';
import { buildLeaderboard } from '@/lib/adminPlatformData';
import { isLeaderboardMetric, type LeaderboardResponse } from '@/lib/adminLeaderboard';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Top curators by films logged, viewing streak or recommendations. Admin-only. GET ?metric=films&limit=25 */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const metric = params.get('metric') ?? 'films';
  if (!isLeaderboardMetric(metric)) return fail({ error: 'Choose films, streak or recommendations.', code: 'bad_request' }, 400);
  const limit = Math.min(50, Math.max(1, Number.parseInt(params.get('limit') ?? '25', 10) || 25));

  try {
    return ok<LeaderboardResponse>(await buildLeaderboard(createAdminClient(), metric, limit));
  } catch (err: unknown) {
    return routeError('leaderboard', err, "We couldn't load the leaderboard. Please try again.");
  }
}
