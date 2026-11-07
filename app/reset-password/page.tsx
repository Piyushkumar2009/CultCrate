'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, XCircle } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_PUBLISHER_KEY } from '@/utils/supabase/client';

type SessionState = 'checking' | 'ready' | 'missing';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_PUBLISHER_KEY;
    return createBrowserClient(url, key);
  }, []);

  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The reset link signs the person in through /auth/callback, so a session must exist here.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setSessionState(data.user ? 'ready' : 'missing');
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords don\'t match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setDone(true);
      setTimeout(() => router.push('/dashboard'), 1800);
    } catch (err: unknown) {
      console.error('Password update error:', err);
      setError(
        err instanceof Error ? err.message : 'We couldn\'t update your password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-10 py-2.5 bg-[#090D16]/90 border border-[#232936] focus:border-[#E50914] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#E50914] transition-all font-sans';

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center relative bg-[#090D16] px-4 py-10 font-sans text-[#F9FAFB] selection:bg-[#E50914] selection:text-white overflow-x-hidden">
      <div className="pointer-events-none fixed top-1/2 left-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E50914]/15 blur-[140px]" />

      <div className="w-full max-w-[450px]">
        <Link href="/" className="mb-6 block text-center text-2xl font-black tracking-tight text-white">
          Cult<span className="text-[#E50914]">Crate</span>
        </Link>

        <div className="rounded-2xl border border-[#232936] bg-[#121620]/90 p-7 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8">
          {sessionState === 'checking' && (
            <p className="text-center text-xs text-[#9CA3AF]">Checking your reset link...</p>
          )}

          {sessionState === 'missing' && (
            <div className="space-y-4 text-center">
              <XCircle className="mx-auto h-8 w-8 text-[#E50914]" aria-hidden="true" />
              <h1 className="text-lg font-bold text-white">This reset link isn&apos;t active</h1>
              <p className="text-xs leading-relaxed text-[#9CA3AF]">
                It may have expired, or it was opened in a different browser. Request a new link from the sign-in
                page and open it in the same browser.
              </p>
              <Link
                href="/auth"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#B80710]"
              >
                Back to sign in
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}

          {sessionState === 'ready' && !done && (
            <>
              <h1 className="mb-1.5 text-xl font-bold tracking-tight text-white">Choose a new password</h1>
              <p className="mb-6 text-xs leading-relaxed text-[#9CA3AF]">
                Pick something you haven&apos;t used elsewhere. You&apos;ll be signed in right after.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="block text-[11px] font-medium text-gray-300">
                    New password
                  </label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#9CA3AF] transition-colors group-focus-within:text-[#E50914]">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Show or hide password"
                      className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3.5 text-[#9CA3AF] transition-colors hover:text-gray-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm-password" className="block text-[11px] font-medium text-gray-300">
                    Confirm new password
                  </label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#9CA3AF] transition-colors group-focus-within:text-[#E50914]">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Type it again"
                      className={inputClass}
                    />
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-500/50 bg-red-950/70 p-3 text-[11px] leading-relaxed text-red-200"
                  >
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E50914]" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-sm font-semibold tracking-wide text-white shadow-[0_0_30px_rgba(229,9,20,0.35)] transition-all duration-200 hover:bg-[#B80710] disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {isLoading ? 'Updating...' : 'Update password'}
                  {!isLoading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
              </form>
            </>
          )}

          {done && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-3.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4EDEAE]" aria-hidden="true" />
              <span>Password updated. Taking you to your dashboard...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}