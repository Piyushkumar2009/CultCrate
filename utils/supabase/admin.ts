import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './client';

/** Thrown when the server has no service key configured. Callers translate this into a friendly setup message. */
export class AdminSetupError extends Error {
  constructor() {
    super('The admin service key is not configured on the server.');
    this.name = 'AdminSetupError';
  }
}

/**
 * Privileged Supabase client (bypasses Row Level Security).
 *
 * SECURITY: this must only ever be created inside server code AFTER the caller has been verified as an
 * admin (see lib/adminAuth.ts). `import 'server-only'` makes the build fail if a client component ever
 * imports this file, and the key is read from a variable that does NOT start with NEXT_PUBLIC_, so it is
 * never shipped to the browser.
 */
export function createAdminClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) throw new AdminSetupError();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
