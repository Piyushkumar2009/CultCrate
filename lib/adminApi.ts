import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSession, isSameOrigin, type AdminSession } from '@/lib/adminAuth';
import type { AdminApiError } from '@/lib/adminAnalytics';
import { AdminSetupError } from '@/utils/supabase/admin';

export type AdminCaller = Extract<AdminSession, { status: 'admin' }>;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function fail(body: AdminApiError, status: number): NextResponse<AdminApiError> {
  return NextResponse.json<AdminApiError>(body, { status, headers: NO_STORE });
}

export function ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json<T>(data, { status, headers: NO_STORE });
}

/**
 * The single gate every /api/admin route goes through:
 *  1. the caller is re-verified against Supabase Auth and must have app_metadata.role === 'admin',
 *  2. state-changing requests must come from the same origin.
 * Routes must `return guard.response` when `guard.ok` is false, and may only create the
 * service-role client AFTER this passes.
 */
export async function guardAdmin(
  request: NextRequest | Request,
  options: { mutating?: boolean } = {}
): Promise<{ ok: true; caller: AdminCaller } | { ok: false; response: NextResponse<AdminApiError> }> {
  const session = await getAdminSession();
  if (session.status === 'anonymous') {
    return { ok: false, response: fail({ error: 'Please sign in to continue.', code: 'signed_out' }, 401) };
  }
  if (session.status === 'forbidden') {
    return { ok: false, response: fail({ error: "You don't have access to this area.", code: 'no_access' }, 403) };
  }
  if (options.mutating && !isSameOrigin(request)) {
    return { ok: false, response: fail({ error: 'This request was blocked for your safety.', code: 'not_allowed' }, 403) };
  }
  return { ok: true, caller: session };
}

/** True when Postgres/PostgREST says a table or column has not been created yet. */
export function isMissingRelation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { code?: unknown; message?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  return e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(message);
}

export const MIGRATION_HINT = 'Run the 20261106_admin_platform_controls.sql migration in Supabase to turn this on.';

/** Turns any thrown error into a friendly, non-leaky response. */
export function routeError(scope: string, err: unknown, fallback: string): NextResponse<AdminApiError> {
  if (err instanceof AdminSetupError) {
    return fail({ error: 'One quick setup step is needed: add SUPABASE_SERVICE_ROLE_KEY on the server.', code: 'setup_required' }, 503);
  }
  console.error(`[admin/${scope}] failed:`, err instanceof Error ? err.message : err);
  return fail({ error: fallback, code: 'load_failed' }, 500);
}
