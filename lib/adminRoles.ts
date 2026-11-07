import { isAdminUser, type AdminRole } from '@/lib/adminAnalytics';

/** The two Supabase Auth admin calls the role change needs (kept structural so it can be tested with a fake). */
export interface AdminAuthApi {
  getUserById(id: string): Promise<{ data: { user: { app_metadata?: Record<string, unknown> | null } | null }; error: unknown }>;
  updateUserById(id: string, attributes: { app_metadata: Record<string, unknown> }): Promise<{ error: unknown }>;
}

export type RoleChangeOutcome =
  | { kind: 'changed'; role: AdminRole }
  | { kind: 'unchanged'; role: AdminRole }
  | { kind: 'self' }
  | { kind: 'not_found' }
  | { kind: 'failed'; error: unknown };

/**
 * Grants or revokes admin access. Decision logic only (no HTTP), so the security rules are unit-tested:
 *  - nobody can change their own access (this also guarantees at least one admin always remains,
 *    because the caller is an admin and can never be the target),
 *  - the target must exist,
 *  - other app_metadata keys (such as the sign-in provider) are preserved,
 *  - re-applying the current role is a harmless no-op.
 */
export async function applyRoleChange(
  auth: AdminAuthApi,
  input: { callerId: string; targetId: string; makeAdmin: boolean }
): Promise<RoleChangeOutcome> {
  const { callerId, targetId, makeAdmin } = input;
  if (callerId === targetId) return { kind: 'self' };

  const wantedRole: AdminRole = makeAdmin ? 'admin' : 'curator';

  const { data, error } = await auth.getUserById(targetId);
  if (error || !data?.user) return { kind: 'not_found' };

  if (isAdminUser(data.user.app_metadata) === makeAdmin) return { kind: 'unchanged', role: wantedRole };

  const { error: updateError } = await auth.updateUserById(targetId, {
    app_metadata: { ...(data.user.app_metadata ?? {}), role: makeAdmin ? 'admin' : 'user' },
  });
  if (updateError) return { kind: 'failed', error: updateError };

  return { kind: 'changed', role: wantedRole };
}
