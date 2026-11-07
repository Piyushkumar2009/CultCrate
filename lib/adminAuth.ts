import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/adminAnalytics';

export type AdminSession =
  | { status: 'admin'; userId: string; email: string | null }
  | { status: 'forbidden'; userId: string }
  | { status: 'anonymous' };

/**
 * Server-side role check used by the /admin layout and every /api/admin route.
 *
 * `auth.getUser()` is validated against the Supabase Auth server on every call (it does not trust the
 * cookie's embedded claims), and the admin flag lives in `app_metadata`, which users cannot edit
 * themselves. Revoking someone's admin access therefore takes effect on their very next request.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { status: 'anonymous' };
  if (!isAdminUser(user.app_metadata)) return { status: 'forbidden', userId: user.id };
  return { status: 'admin', userId: user.id, email: user.email ?? null };
}

/** Rejects cross-site POSTs (defence in depth on top of SameSite cookies). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin fetches from older browsers may omit it; cookies are SameSite=Lax
  try {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
