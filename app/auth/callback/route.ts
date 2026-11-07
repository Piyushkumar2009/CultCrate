import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHER_KEY } from '@/utils/supabase/client';

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

/** Same-origin relative paths only (blocks open redirects such as //evil.com or https://evil.com). */
function toSafePath(raw: string | null, fallback = '/dashboard'): string {
  if (!raw) return fallback;
  return raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : fallback;
}

function redirectToAuth(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL('/auth', origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

function redirectToAuthError(origin: string, description: string): NextResponse {
  return redirectToAuth(origin, { error: 'true', error_description: description });
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { origin } = requestUrl;

  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const otpType = requestUrl.searchParams.get('type');
  const providerError = requestUrl.searchParams.get('error');
  const providerErrorCode = requestUrl.searchParams.get('error_code');
  const providerErrorDescription = requestUrl.searchParams.get('error_description');
  const next = toSafePath(requestUrl.searchParams.get('next'));

  // 1. Supabase / OAuth provider reported an error (expired link, access denied, ...)
  if (providerError || providerErrorDescription) {
    if (providerErrorCode === 'otp_expired') {
      return redirectToAuthError(
        origin,
        'This confirmation link has expired or was already used. Sign in, or sign up again to get a fresh link.'
      );
    }
    return redirectToAuthError(
      origin,
      providerErrorDescription || providerError || 'The sign-in provider returned an error.'
    );
  }

  if (!code && !tokenHash) {
    return redirectToAuthError(origin, 'No authorization code detected in callback request.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_PUBLISHER_KEY;

  try {
    // Success target; session cookies are attached to this response below.
    const response = NextResponse.redirect(new URL(next, origin));

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options, sameSite: 'lax' });
          });
        },
      },
    });

    // 2a. Email link using token_hash (works on any device or browser)
    if (tokenHash) {
      if (!isEmailOtpType(otpType)) {
        return redirectToAuthError(origin, 'This confirmation link is not valid. Please request a new one.');
      }

      const { error: otpError } = await supabase.auth.verifyOtp({
        type: otpType,
        token_hash: tokenHash,
      });

      if (otpError) {
        console.error('Supabase email verification error:', otpError);
        return redirectToAuthError(
          origin,
          otpError.message || 'This confirmation link has expired or was already used.'
        );
      }

      return response;
    }

    // 2b. PKCE code flow (default Supabase confirmation link and Google OAuth)
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code as string);

    if (exchangeError) {
      console.error('Supabase code exchange error:', exchangeError);

      // The email link was opened in a different browser/device than the one that signed up.
      // Supabase has already confirmed the email at this point, there is just no session here,
      // so send the person to sign in with a success message.
      if (/code verifier/i.test(exchangeError.message || '')) {
        return redirectToAuth(origin, { verified: 'true' });
      }

      return redirectToAuthError(
        origin,
        exchangeError.message || 'Failed to exchange authorization code for a session.'
      );
    }

    return response;
  } catch (err: unknown) {
    console.error('Unexpected error during auth callback:', err);
    return redirectToAuthError(
      origin,
      err instanceof Error ? err.message : 'Unexpected error during session verification.'
    );
  }
}