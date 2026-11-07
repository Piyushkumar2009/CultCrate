import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_PUBLISHER_KEY, SUPABASE_PROJECT_ID } from '@/utils/supabase/client';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const oauthError = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const rawNext = requestUrl.searchParams.get('next') || '/dashboard';
  // Only same-origin relative paths (blocks open redirects such as //evil.com or https://evil.com)
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\') ? rawNext : '/dashboard';

  // 1. Check if Supabase returned an OAuth provider error directly
  if (oauthError || errorDescription) {
    const errorRedirectUrl = new URL('/auth', requestUrl.origin);
    errorRedirectUrl.searchParams.set('error', 'true');
    errorRedirectUrl.searchParams.set(
      'error_description',
      errorDescription || oauthError || 'Google OAuth provider returned an error.'
    );
    return NextResponse.redirect(errorRedirectUrl);
  }

  // 2. Exchange authorization code for a valid Supabase session
  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_PUBLISHER_KEY;

    try {
      const response = NextResponse.redirect(new URL(next, requestUrl.origin));

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, {
                ...options,
                sameSite: 'lax',
              });
            });
          },
        },
      });

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('Supabase code exchange error:', exchangeError);
        const errorRedirectUrl = new URL('/auth', requestUrl.origin);
        errorRedirectUrl.searchParams.set('error', 'true');
        errorRedirectUrl.searchParams.set(
          'error_description',
          exchangeError.message || 'Failed to exchange authorization code for Supabase session.'
        );
        return NextResponse.redirect(errorRedirectUrl);
      }

      // Successful exchange: redirect to the dashboard
      return response;
    } catch (err: unknown) {
      console.error('Unexpected error during OAuth session verification:', err);
      const errorRedirectUrl = new URL('/auth', requestUrl.origin);
      errorRedirectUrl.searchParams.set('error', 'true');
      errorRedirectUrl.searchParams.set(
        'error_description',
        err instanceof Error ? err.message : 'Unexpected error during session verification.'
      );
      return NextResponse.redirect(errorRedirectUrl);
    }
  }

  // 3. Fallback if no code was received
  const fallbackRedirect = new URL('/auth', requestUrl.origin);
  fallbackRedirect.searchParams.set('error', 'true');
  fallbackRedirect.searchParams.set(
    'error_description',
    'No authorization code detected in callback request.'
  );
  return NextResponse.redirect(fallbackRedirect);
}
