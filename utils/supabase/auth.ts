import { createClient, isSupabaseConfigured } from './client';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthResult<T = User | Session | null> {
  data: T;
  error: AuthError | Error | null;
  isSimulated?: boolean;
}

/**
 * Sign in using email and password.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult<{ user: User | null; session: Session | null }>> {
  const supabase = createClient();

  if (!isSupabaseConfigured()) {
    // Graceful fallback for local development before credentials are set
    return {
      data: {
        user: {
          id: 'dev-user-id',
          email,
          user_metadata: { letterboxd_username: email.split('@')[0] },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as User,
        session: null,
      },
      error: null,
      isSimulated: true,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return {
    data: {
      user: data.user,
      session: data.session,
    },
    error,
    isSimulated: false,
  };
}

/**
 * Register a new user with email, password, and optional Letterboxd username metadata.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  letterboxdUsername?: string
): Promise<AuthResult<{ user: User | null; session: Session | null }>> {
  const supabase = createClient();

  const metadata = {
    letterboxd_username: letterboxdUsername?.trim().replace(/^@/, '') || undefined,
    registered_at: new Date().toISOString(),
    platform: 'cultcrate',
  };

  if (!isSupabaseConfigured()) {
    return {
      data: {
        user: {
          id: 'dev-new-user-id',
          email,
          user_metadata: metadata,
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as User,
        session: null,
      },
      error: null,
      isSimulated: true,
    };
  }

  const redirectUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: redirectUrl,
    },
  });

  return {
    data: {
      user: data.user,
      session: data.session,
    },
    error,
    isSimulated: false,
  };
}

/**
 * Sign in using Google OAuth via Supabase.
 */
export async function signInWithGoogle(
  redirectTo = '/auth/callback'
): Promise<AuthResult<{ url: string | null }>> {
  const supabase = createClient();

  if (!isSupabaseConfigured()) {
    return {
      data: { url: null },
      error: null,
      isSimulated: true,
    };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const finalRedirect = `${origin}${redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: finalRedirect,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  return {
    data,
    error,
    isSimulated: false,
  };
}

/**
 * Sign out the current user session.
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const supabase = createClient();
  if (!isSupabaseConfigured()) {
    return { error: null };
  }
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get the current active user.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  if (!isSupabaseConfigured()) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
