import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_PUBLISHER_KEY } from '@/utils/supabase/client';
import { isAdminUser } from '@/lib/adminAnalytics';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_PUBLISHER_KEY;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Validates the auth token securely against the Supabase Auth server
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // 1. Unauthenticated users visiting /dashboard, /vault, /settings, or /watchlist -> redirect to /auth
    if (
      !user &&
      (pathname.startsWith('/dashboard') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/vault') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/watchlist'))
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/auth';
      redirectUrl.searchParams.set('redirect', pathname);

      const redirectResponse = NextResponse.redirect(redirectUrl);
      // Persist any refreshed session cookies to the redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    }

    // 1b. Signed-in but NOT an admin -> bounced straight back to the dashboard.
    //     The role lives in app_metadata, which getUser() has just re-validated with the Auth server.
    if (user && (pathname === '/admin' || pathname.startsWith('/admin/')) && !isAdminUser(user.app_metadata)) {
      const redirectUrl = new URL('/dashboard', request.url);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    }

    // 2. Authenticated users visiting /auth or / (landing page) -> redirect directly to /dashboard
    if (user && (pathname === '/auth' || pathname === '/')) {
      const requested = request.nextUrl.searchParams.get('redirect');
      const safeTarget =
        requested !== null &&
        requested.startsWith('/') &&
        !requested.startsWith('//') &&
        !requested.startsWith('/\\') &&
        !requested.startsWith('/auth')
          ? requested
          : '/dashboard';
      const redirectUrl = new URL(safeTarget, request.url);

      const redirectResponse = NextResponse.redirect(redirectUrl);
      // Persist any refreshed session cookies to the redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    }
  } catch (error) {
    console.error('Middleware Supabase authentication error:', error);
    // In case of an unexpected error, allow the request to proceed normally
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static assets)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (e.g. /api/synthesize)
     * - auth/callback (OAuth & email verification callback)
     * - static image/font extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|api|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
