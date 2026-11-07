import type { NextRequest } from 'next/server';
import { fail, guardAdmin, ok, routeError } from '@/lib/adminApi';
import { UUID_PATTERN } from '@/lib/adminAuth';
import { isAdminUser } from '@/lib/adminAnalytics';
import { buildUserDetail } from '@/lib/adminPlatformData';
import { decideUserDelete } from '@/lib/adminUserDelete';
import type { AdminUserDeleteResult, UserDetail } from '@/lib/adminUserTypes';
import { WATCHLIST_BUCKET } from '@/lib/vaultStorage';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Detailed analytics for one curator (drawer). Admin-only. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return fail({ error: "We couldn't understand that request.", code: 'bad_request' }, 400);

  try {
    const detail = await buildUserDetail(createAdminClient(), id);
    if (!detail) return fail({ error: "We couldn't find that account.", code: 'not_found' }, 404);
    return ok<UserDetail>(detail);
  } catch (err: unknown) {
    return routeError('user-detail', err, "We couldn't load that curator. Please try again.");
  }
}

/**
 * Permanently deletes an account with the service-role key (`auth.admin.deleteUser`).
 * Profile, recommendations, Cinematic DNA and sync rows are removed by their ON DELETE CASCADE foreign keys;
 * the curator's stored library files are then cleaned up on a best-effort basis.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const guard = await guardAdmin(request, { mutating: true });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return fail({ error: "We couldn't understand that request.", code: 'bad_request' }, 400);

  try {
    const admin = createAdminClient();
    const target = await admin.auth.admin.getUserById(id);
    const targetUser = target.error ? null : target.data.user;

    const decision = decideUserDelete({
      callerId: guard.caller.userId,
      targetId: id,
      targetExists: targetUser !== null,
      targetIsAdmin: targetUser !== null && isAdminUser(targetUser.app_metadata),
    });
    if (!decision.allowed) return fail({ error: decision.message, code: decision.code }, decision.code === 'not_found' ? 404 : 400);

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;

    // Best-effort storage cleanup. The account is already gone, so a failure here must not fail the request.
    try {
      const { data: files } = await admin.storage.from(WATCHLIST_BUCKET).list(id, { limit: 100 });
      if (files && files.length > 0) await admin.storage.from(WATCHLIST_BUCKET).remove(files.map((f) => `${id}/${f.name}`));
    } catch (cleanupError: unknown) {
      console.warn('[admin/delete-user] storage cleanup skipped:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
    }

    console.info(`[admin] ${guard.caller.email ?? 'an admin'} deleted a curator account.`);
    return ok<AdminUserDeleteResult>({ ok: true, userId: id });
  } catch (err: unknown) {
    return routeError('delete-user', err, "We couldn't delete that account. Please try again.");
  }
}
