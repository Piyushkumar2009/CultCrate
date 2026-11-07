import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_ID = 'qmshfrllwgbjhemywuvq';
export const DEFAULT_SUPABASE_URL = 'https://qmshfrllwgbjhemywuvq.supabase.co';
export const DEFAULT_PUBLISHER_KEY = 'sb_publishable_M7yC5GL82MN7BgVpQnTDtQ_1CqyAooN';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_PUBLISHER_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_PUBLISHER_KEY;

let browserClient: SupabaseClient | null = null;

/**
 * Creates or retrieves the singleton browser Supabase client.
 * Configured with autoRefreshToken & detectSessionInUrl for seamless mobile session persistence.
 */
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHER_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `sb-${SUPABASE_PROJECT_ID}-auth-token`,
    },
    cookieOptions: {
      name: `sb-${SUPABASE_PROJECT_ID}-auth-token`,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      domain: '',
      path: '/',
      sameSite: 'lax',
    },
  });

  return browserClient;
}

/**
 * Pre-instantiated singleton for fast, direct client imports in React client components.
 */
export const supabase = createClient();

/**
 * Safe utility to check if Supabase has live credentials configured.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_PUBLISHER_KEY &&
    !SUPABASE_URL.includes('placeholder') &&
    !SUPABASE_PUBLISHER_KEY.includes('placeholder')
  );
}

/**
 * Helper to retrieve the current active user session with automatic refresh on mobile.
 */
export async function getSupabaseSession(): Promise<Session | null> {
  const client = createClient();
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      console.warn('Session retrieval error:', error.message);
      return null;
    }
    return session;
  } catch (err) {
    console.error('Unexpected error fetching Supabase session:', err);
    return null;
  }
}

/**
 * Helper to retrieve the authenticated user and their metadata.
 */
export async function getSupabaseUser(): Promise<User | null> {
  const client = createClient();
  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error) {
      console.warn('User retrieval error:', error.message);
      return null;
    }
    return user;
  } catch (err) {
    console.error('Unexpected error fetching Supabase user:', err);
    return null;
  }
}
