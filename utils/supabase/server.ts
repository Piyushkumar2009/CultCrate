import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_PUBLISHER_KEY } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase client using Next.js 15+ cookies() pattern.
 * Supports token injection for authenticated route handlers and server actions.
 */
export async function createClient(accessToken?: string | null): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_PUBLISHER_KEY;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // May be called from Server Component where cookies cannot be set directly
        }
      },
    },
    ...(accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      : {}),
  });
}
