import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { buildAdminSummary } from '@/lib/adminData';
import type { AdminApiError, AdminSummary } from '@/lib/adminAnalytics';
import { AdminSetupError, createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function fail(body: AdminApiError, status: number): NextResponse<AdminApiError> {
  return NextResponse.json<AdminApiError>(body, { status, headers: NO_STORE });
}

/** Platform analytics + user directory. Admin-only (checked on the server for every request). */
export async function GET() {
  const session = await getAdminSession();
  if (session.status === 'anonymous') return fail({ error: 'Please sign in to continue.', code: 'signed_out' }, 401);
  if (session.status === 'forbidden') return fail({ error: "You don't have access to this area.", code: 'no_access' }, 403);

  try {
    const admin = createAdminClient();
    const summary = await buildAdminSummary(admin, session.userId);
    return NextResponse.json<AdminSummary>(summary, { headers: NO_STORE });
  } catch (err: unknown) {
    if (err instanceof AdminSetupError) {
      return fail(
        { error: 'One quick setup step is needed before the admin data can load.', code: 'setup_required' },
        503
      );
    }
    console.error('[admin/summary] failed:', err instanceof Error ? err.message : err);
    return fail({ error: "We couldn't load the admin data. Please try again in a moment.", code: 'load_failed' }, 500);
  }
}
