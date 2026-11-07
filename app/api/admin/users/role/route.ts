import { NextResponse, type NextRequest } from 'next/server';
import { UUID_PATTERN, getAdminSession, isSameOrigin } from '@/lib/adminAuth';
import type { AdminApiError, AdminRoleChangeResult } from '@/lib/adminAnalytics';
import { applyRoleChange, type AdminAuthApi } from '@/lib/adminRoles';
import { AdminSetupError, createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function fail(body: AdminApiError, status: number): NextResponse<AdminApiError> {
  return NextResponse.json<AdminApiError>(body, { status, headers: NO_STORE });
}

/** Promote or revoke admin access. Strictly admin-only, enforced on the server. */
export async function POST(request: NextRequest) {
  // 1. Who is calling? Re-verified against Supabase Auth on every request.
  const session = await getAdminSession();
  if (session.status === 'anonymous') return fail({ error: 'Please sign in to continue.', code: 'signed_out' }, 401);
  if (session.status === 'forbidden') return fail({ error: "You don't have access to this action.", code: 'no_access' }, 403);

  // 2. Cross-site request protection
  if (!isSameOrigin(request)) return fail({ error: 'This request was blocked for your safety.', code: 'not_allowed' }, 403);

  // 3. Validate input
  const body: unknown = await request.json().catch(() => null);
  const userId = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).userId : undefined;
  const makeAdmin = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).makeAdmin : undefined;
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId) || typeof makeAdmin !== 'boolean') {
    return fail({ error: "We couldn't understand that request.", code: 'bad_request' }, 400);
  }

  try {
    const admin = createAdminClient();

    // 4. Decision logic lives in lib/adminRoles.ts (unit-tested): no self-changes, target must exist,
    //    other app_metadata is preserved, and the flag is written with the service key only.
    const outcome = await applyRoleChange(admin.auth.admin as unknown as AdminAuthApi, {
      callerId: session.userId,
      targetId: userId,
      makeAdmin,
    });

    switch (outcome.kind) {
      case 'self':
        return fail({ error: "You can't change your own access.", code: 'not_allowed' }, 400);
      case 'not_found':
        return fail({ error: "We couldn't find that account.", code: 'not_found' }, 404);
      case 'failed':
        throw outcome.error;
      case 'changed':
        console.info(`[admin] ${session.email ?? 'an admin'} ${makeAdmin ? 'granted' : 'revoked'} admin access.`);
        return NextResponse.json<AdminRoleChangeResult>({ ok: true, userId, role: outcome.role }, { headers: NO_STORE });
      case 'unchanged':
        return NextResponse.json<AdminRoleChangeResult>({ ok: true, userId, role: outcome.role }, { headers: NO_STORE });
    }
  } catch (err: unknown) {
    if (err instanceof AdminSetupError) {
      return fail(
        { error: 'One quick setup step is needed before access can be changed.', code: 'setup_required' },
        503
      );
    }
    console.error('[admin/role] failed:', err instanceof Error ? err.message : err);
    return fail({ error: "We couldn't update that account. Please try again.", code: 'load_failed' }, 500);
  }
}
