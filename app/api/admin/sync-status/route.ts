import type { NextRequest } from 'next/server';
import { guardAdmin, ok, routeError } from '@/lib/adminApi';
import { buildSyncMonitor } from '@/lib/adminPlatformData';
import type { SyncMonitorResponse } from '@/lib/adminSync';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Read-only health of every curator's Letterboxd RSS sync. Admin-only. */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    return ok<SyncMonitorResponse>(await buildSyncMonitor(createAdminClient()));
  } catch (err: unknown) {
    return routeError('sync-status', err, "We couldn't load sync health. Please try again.");
  }
}
