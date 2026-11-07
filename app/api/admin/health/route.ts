import type { NextRequest } from 'next/server';
import { guardAdmin, ok, routeError } from '@/lib/adminApi';
import { createAdminClient } from '@/utils/supabase/admin';
import { WATCHLIST_BUCKET } from '@/lib/vaultStorage';
import type { HealthCheck, HealthResponse, HealthState } from '@/lib/adminHealth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SLOW_MS = 1500;

async function timed(id: HealthCheck['id'], label: string, probe: () => PromiseLike<{ error: unknown }>): Promise<HealthCheck> {
  const started = Date.now();
  try {
    const { error } = await probe();
    const latencyMs = Date.now() - started;
    if (error) return { id, label, state: 'down', latencyMs: null };
    return { id, label, state: latencyMs > SLOW_MS ? 'degraded' : 'operational', latencyMs };
  } catch {
    return { id, label, state: 'down', latencyMs: null };
  }
}

/** Lightweight probe of the three services the app depends on. Admin-only. */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const admin = createAdminClient();
    const checks = await Promise.all([
      timed('database', 'Database', () => admin.from('profiles').select('id', { head: true, count: 'estimated' }).limit(1)),
      timed('auth', 'Authentication', () => admin.auth.admin.listUsers({ page: 1, perPage: 1 })),
      timed('storage', 'Library storage', () => admin.storage.from(WATCHLIST_BUCKET).list('', { limit: 1 })),
    ]);
    const overall: HealthState = checks.some((c) => c.state === 'down')
      ? 'down'
      : checks.some((c) => c.state === 'degraded')
      ? 'degraded'
      : 'operational';
    return ok<HealthResponse>({ checkedAt: new Date().toISOString(), overall, checks });
  } catch (err: unknown) {
    return routeError('health', err, "We couldn't check system health.");
  }
}
