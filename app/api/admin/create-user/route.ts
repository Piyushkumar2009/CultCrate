import { type NextRequest } from 'next/server';
import { fail, guardAdmin, ok, routeError } from '@/lib/adminApi';
import { validateCreateUserInput, type CreateUserResult } from '@/lib/adminCreateUser';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Supabase reports "this email is taken" under a few different codes depending on the version. */
function isDuplicateEmail(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'email_exists' ||
    error.code === 'user_already_exists' ||
    /already (been )?registered|already exists/i.test(error.message ?? '')
  );
}

/**
 * Admin only: create an account directly, with the email already confirmed (no verification email is sent).
 *
 * Security order matters here:
 *  1. guardAdmin re-verifies the caller against Supabase Auth (role must be "admin" in app_metadata) and rejects
 *     cross-site requests. Nothing privileged is created before this passes.
 *  2. The input is validated again on the server, whatever the form already checked.
 *  3. Only then is the service-role client created, and the password is never logged or echoed back.
 */
export async function POST(request: NextRequest) {
  const guard = await guardAdmin(request, { mutating: true });
  if (!guard.ok) return guard.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = validateCreateUserInput(body);
  if (!parsed.ok) return fail({ error: parsed.error, code: 'bad_request' }, 400);

  const { email, password, letterboxdUsername } = parsed.value;

  try {
    const admin = createAdminClient();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // marks the email as verified, so no confirmation link is needed
      user_metadata: {
        // Same key the sign-up form uses; the profiles table reads it to fill in the Letterboxd handle.
        letterboxd_username: letterboxdUsername,
        platform: 'cultcrate',
        created_by_admin: true,
      },
    });

    if (error) {
      const details = error as { code?: string; message?: string };
      if (isDuplicateEmail(details)) {
        return fail({ error: 'An account with that email already exists.', code: 'bad_request' }, 409);
      }
      if (details.code === 'weak_password') {
        return fail({ error: details.message || 'That password is too weak. Try a longer one.', code: 'bad_request' }, 400);
      }
      throw error;
    }

    if (!data.user) throw new Error('Supabase returned no user after createUser.');

    console.info(`[admin] ${guard.caller.email ?? 'an admin'} created account ${data.user.id}.`);

    return ok<CreateUserResult>(
      { ok: true, user: { id: data.user.id, email: data.user.email ?? email, letterboxdUsername } },
      201
    );
  } catch (err: unknown) {
    return routeError('create-user', err, "We couldn't create that account. Please try again.");
  }
}
