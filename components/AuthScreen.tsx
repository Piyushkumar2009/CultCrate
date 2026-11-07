'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  XCircle,
  Copy,
  Check,
  Send,
  RotateCw,
  ExternalLink,
  Sparkles,
  Inbox,
} from 'lucide-react';
import {
  SUPABASE_PROJECT_ID,
  SUPABASE_URL,
  SUPABASE_PUBLISHER_KEY,
} from '@/utils/supabase/client';
import { useLetterboxdValidation } from '@/hooks/useLetterboxdValidation';
import { LetterboxdStatusHint, letterboxdInputTone } from '@/components/LetterboxdStatusHint';

/** Where to go after authenticating: a same-origin ?redirect= path (e.g. /watchlist), else the dashboard. */
function getPostAuthTarget(): string {
  if (typeof window === 'undefined') return '/dashboard';
  const requested = new URLSearchParams(window.location.search).get('redirect');
  const safe =
    requested !== null &&
    requested.startsWith('/') &&
    !requested.startsWith('//') &&
    !requested.startsWith('/\\') &&
    !requested.startsWith('/auth');
  return safe && requested ? requested : '/dashboard';
}

export interface AuthScreenProps {
  onReturn?: () => void;
  onSuccess?: (userData: { email: string; username?: string; mode: 'signin' | 'signup' }) => void;
  initialTab?: 'signin' | 'signup';
}

export function AuthScreen({ onReturn, onSuccess, initialTab = 'signin' }: AuthScreenProps) {
  const router = useRouter();

  // Tab & Confirmation States
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [letterboxdUsername, setLetterboxdUsername] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Resend cooldown timer (seconds)
  const [resendCooldown, setResendCooldown] = useState(0);

  // Feedback & Mobile Debugging Error States
  const [isLoading, setIsLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hasError = params.get('error');
      const description = params.get('error_description');
      if (hasError) {
        return description || 'Authentication session verification failed. Please try again.';
      }
    }
    return null;
  });
  const [copiedError, setCopiedError] = useState(false);

  // Initialize Supabase Client with CultCrate credentials
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_PUBLISHER_KEY;
    return createBrowserClient(url, key);
  }, []);

  // Live Letterboxd username check (debounced 500ms), only while creating an account
  const letterboxd = useLetterboxdValidation(letterboxdUsername, { enabled: activeTab === 'signup' });

  // Cooldown countdown effect for Resend Link
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Show a success notice when the email-confirmation link sends people back with ?verified=true,
  // then remove the flag from the address bar so a refresh doesn't repeat it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      setAuthNotice('Email verified! Sign in to start exploring CultCrate.');
      setActiveTab('signin');
      params.delete('verified');
      const query = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
      );
    }
  }, []);

  const handleCopyError = () => {
    if (authError && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(authError);
      setCopiedError(true);
      setTimeout(() => setCopiedError(false), 2000);
    }
  };

  // Sign In or Sign Up Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setAuthNotice(null);
    setAuthError(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      if (!cleanEmail || !cleanPassword) {
        throw new Error('Please enter your email and password.');
      }

      if (activeTab === 'signin') {
        // --- 1. SIGN IN FLOW ---
        setAuthNotice('Signing you in...');

        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) throw error;

        const username =
          (data.user?.user_metadata?.letterboxd_username as string) ||
          cleanEmail.split('@')[0];

        setAuthNotice('Welcome back! Taking you in...');

        setTimeout(() => {
          setIsLoading(false);
          if (onSuccess) {
            onSuccess({
              email: data.user?.email || cleanEmail,
              username,
              mode: 'signin',
            });
          }
          router.push(getPostAuthTarget());
        }, 1000);
      } else {
        // --- 2. SIGN UP FLOW (Link-Based Confirmation) ---
        const cleanLetterboxd = letterboxdUsername.trim().replace(/^@/, '');

        if (!cleanLetterboxd) {
          throw new Error('Please add your Letterboxd username so we can build your Cinematic DNA.');
        }

        if (!letterboxd.canSubmit) {
          throw new Error(
            letterboxd.status === 'checking'
              ? 'Hang on, we\'re still checking that Letterboxd username.'
              : letterboxd.message || 'Please enter a valid Letterboxd username.'
          );
        }

        setAuthNotice('Creating your account...');

        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined;

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              letterboxd_username: cleanLetterboxd,
              platform: 'cultcrate',
              project_id: SUPABASE_PROJECT_ID,
              registered_at: new Date().toISOString(),
            },
            emailRedirectTo: redirectTo,
          },
        });

        if (error) throw error;

        // If session was immediately established (e.g. email confirmations disabled in backend)
        if (data.session) {
          setAuthNotice('You\'re in! Taking you to your dashboard...');
          setTimeout(() => {
            setIsLoading(false);
            if (onSuccess) {
              onSuccess({
                email: cleanEmail,
                username: cleanLetterboxd,
                mode: 'signup',
              });
            }
            router.push(getPostAuthTarget());
          }, 1000);
          return;
        }

        // Email confirmation link dispatched: Show clean high-contrast confirmation banner
        setIsLoading(false);
        setConfirmedEmail(cleanEmail);
        setConfirmationSent(true);
        setResendCooldown(60);
      }
    } catch (err: unknown) {
      console.error('CultCrate Auth Error:', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'We couldn\'t sign you in. Please check your details and try again.';

      setAuthError(message);
      setIsLoading(false);
    }
  };

  // Resend Email Confirmation Link Handler
  const handleResendLink = async () => {
    if (resendCooldown > 0 || isLoading) return;

    setIsLoading(true);
    setAuthError(null);
    setAuthNotice(`Sending a new link to ${confirmedEmail}...`);

    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: confirmedEmail,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) throw error;

      setResendCooldown(60);
      setAuthNotice(`New link sent to ${confirmedEmail}.`);
      setIsLoading(false);
    } catch (err: unknown) {
      console.error('Resend Link Error:', err);
      const message = err instanceof Error ? err.message : 'We couldn\'t resend the link. Please try again.';
      setAuthError(message);
      setIsLoading(false);
    }
  };

  // Forgot Password: email a Supabase reset link that lands on /reset-password after sign-in via the callback route
  const handleForgotPassword = async () => {
    if (isLoading) return;

    setAuthError(null);
    setAuthNotice(null);

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setAuthError('Enter your email address in the field above first, then tap "Forgot password?" again.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthError('That email address doesn\'t look right. Please check it and try again.');
      return;
    }

    setIsLoading(true);

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });

      if (error) throw error;

      setAuthNotice(
        `If an account exists for ${cleanEmail}, a password reset link is on its way. Check your inbox and spam folder.`
      );
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'We couldn\'t send the reset email. Please try again in a moment.';
      setAuthError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between relative bg-[#090D16] text-[#F9FAFB] font-sans selection:bg-[#E50914] selection:text-white overflow-x-hidden">
      {/* Subtle Film Grain Pattern Overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40 mix-blend-screen"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Ambient Cinematic Volumetric Glows */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] bg-[#E50914]/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed -top-40 -right-40 w-96 h-96 bg-[#F59E0B]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-[#E50914]/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Top Ambient Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between z-10 relative">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (onReturn) onReturn();
          }}
          className="flex items-center gap-3 group"
        >
          <span className="text-xl sm:text-2xl font-black tracking-tight text-white select-none">
            Cult<span className="text-[#E50914]">Crate</span>
          </span>
        </a>

        {/* Top Right Status Telemetry & Return Link */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 font-sans text-xs text-[#9CA3AF]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4EDEAE] animate-pulse" />
            <span className="text-gray-300">
              Secure sign-in
            </span>
          </div>

          <button
            type="button"
            onClick={onReturn}
            className="font-sans text-xs text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#232936] hover:border-[#6B7280] bg-[#121620]/60 active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Centered Glassmorphic Gateway */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10 relative">
        <div className="w-full max-w-[450px] relative">
          {/* Backlit Halo Effect */}
          <div className="absolute -inset-1 bg-gradient-to-b from-[#E50914]/25 via-[#E50914]/5 to-transparent rounded-2xl blur-xl opacity-80 pointer-events-none" />

          {/* Core Glassmorphic Auth Card */}
          <div className="relative rounded-2xl p-7 sm:p-8 bg-[#121620]/90 backdrop-blur-xl border border-[#232936] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7),0_0_50px_rgba(229,9,20,0.15)]">
            {/* Top Card Subheader & Status Index */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E50914] shadow-[0_0_8px_#E50914]" />
                <span className="font-sans text-[11px] font-semibold tracking-wider text-gray-300 uppercase">
                  {confirmationSent ? 'Check your email' : 'Welcome to CultCrate'}
                </span>
              </div>
              <span className="font-sans text-[10px] text-[#4EDEAE] bg-[#4EDEAE]/10 px-2 py-0.5 rounded border border-[#4EDEAE]/30">
                Connected
              </span>
            </div>

            {/* VIEW A: LINK-BASED CONFIRMATION SENT VIEW */}
            {confirmationSent ? (
              <motion.div
                key="confirmation-banner-view"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* High-Contrast Confirmation Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-[#121620] to-[#1c2333] border-2 border-[#4EDEAE]/40 shadow-[0_0_30px_rgba(78,222,174,0.15)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4EDEAE] via-[#F59E0B] to-[#E50914]" />
                  <div className="flex items-start gap-3.5 pt-1">
                    <div className="w-10 h-10 rounded-xl bg-[#4EDEAE]/15 border border-[#4EDEAE]/30 flex items-center justify-center text-[#4EDEAE] shrink-0 shadow-inner">
                      <Inbox className="w-5 h-5 animate-bounce" />
                    </div>
                    <div className="space-y-1">
                      <span className="font-sans text-[10px] uppercase font-bold tracking-wider text-[#4EDEAE] bg-[#4EDEAE]/10 px-1.5 py-0.5 rounded">
                        One more step
                      </span>
                      <h2 className="text-sm sm:text-base font-bold text-white leading-tight font-sans">
                        Check your inbox. We sent you a link to confirm your account.
                      </h2>
                    </div>
                  </div>
                </div>

                {/* Recipient Details & Helpful Instructions */}
                <div className="p-4 rounded-xl bg-[#090D16]/90 border border-[#232936] space-y-3">
                  <div className="flex items-center justify-between text-xs font-sans">
                    <span className="text-[#9CA3AF]">Sent to:</span>
                    <span className="text-white font-semibold truncate max-w-[200px]" title={confirmedEmail}>
                      {confirmedEmail}
                    </span>
                  </div>

                  <div className="border-t border-[#232936]/80 pt-3 space-y-2 text-xs text-[#9CA3AF] leading-relaxed">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4EDEAE] shrink-0 mt-0.5" />
                      <span>Tap the link in the email to confirm your account.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4EDEAE] shrink-0 mt-0.5" />
                      <span>Once you&apos;re confirmed, your Letterboxd diary syncs automatically.</span>
                    </div>
                    <div className="flex items-start gap-2 text-[#9CA3AF]/80 font-sans text-[11px]">
                      <span className="text-[#F59E0B]">✦</span>
                      <span>Can&apos;t find it? Look in spam or promotions.</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Sign In Now & Resend Link */}
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmationSent(false);
                      setActiveTab('signin');
                      setAuthNotice('Tapped the link? Sign in below.');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#E50914] hover:bg-[#B80710] text-white text-sm font-semibold tracking-wide transition-all duration-200 shadow-[0_0_30px_rgba(229,9,20,0.35)] hover:shadow-[0_0_40px_rgba(229,9,20,0.6)] flex items-center justify-center gap-2 group active:scale-[0.99] cursor-pointer"
                  >
                    <span>Go to sign in</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <div className="flex items-center justify-between pt-2 px-1 text-xs font-sans">
                    <button
                      type="button"
                      onClick={handleResendLink}
                      disabled={resendCooldown > 0 || isLoading}
                      className="text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend link'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmationSent(false);
                        setActiveTab('signup');
                      }}
                      className="text-[#E50914] hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Use a different email
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* VIEW B: SIGN IN / SIGN UP CREDENTIALS VIEW */
              <motion.div
                key="credentials-form-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Segmented Tab Switcher (Sign In vs Create Account) */}
                <div className="grid grid-cols-2 p-1 bg-[#090D16]/90 border border-[#232936] rounded-xl mb-6 select-none">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setAuthNotice(null);
                      setAuthError(null);
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                      activeTab === 'signin'
                        ? 'text-white bg-[#121620] shadow-sm border border-[#232936]/80'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signup');
                      setAuthNotice(null);
                      setAuthError(null);
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                      activeTab === 'signup'
                        ? 'text-white bg-[#121620] shadow-sm border border-[#232936]/80'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Dynamic Context Heading */}
                <div className="mb-6">
                  <h1 className="text-xl font-bold tracking-tight text-white mb-1.5 font-sans">
                    {activeTab === 'signin'
                      ? 'Welcome back.'
                      : 'Create your account.'}
                  </h1>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    {activeTab === 'signin'
                      ? 'Sign in to see your picks and your Cinematic DNA.'
                      : 'Takes a minute. We\'ll email you a link to confirm.'}
                  </p>
                </div>

                {/* Credentials Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Signup Field: Letterboxd Username */}
                  {activeTab === 'signup' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5"
                    >
                      <label className="block font-sans text-[11px] font-medium text-gray-300">
                        Letterboxd Username <span className="text-[#E50914]">*</span>
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF] group-focus-within:text-[#E50914] transition-colors">
                          <span className="font-sans text-xs font-bold">@</span>
                        </div>
                        <input
                          type="text"
                          required={activeTab === 'signup'}
                          value={letterboxdUsername}
                          onChange={(e) => setLetterboxdUsername(e.target.value)}
                          placeholder="e.g. cinephile_99"
                          autoCapitalize="none"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          aria-invalid={letterboxd.status === 'invalid'}
                          className={`w-full pl-9 pr-3.5 py-2.5 bg-[#090D16]/90 border ${letterboxdInputTone(
                            letterboxd.status
                          )} rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition-all font-sans`}
                        />
                      </div>
                      {letterboxd.status === 'idle' ? (
                        <p className="font-sans text-[10px] text-[#9CA3AF]">
                          We use this to read your public Letterboxd diary.
                        </p>
                      ) : (
                        <LetterboxdStatusHint status={letterboxd.status} message={letterboxd.message} />
                      )}
                    </motion.div>
                  )}

                  {/* Email Address Input */}
                  <div className="space-y-1.5">
                    <label className="block font-sans text-[11px] font-medium text-gray-300">
                      Email Address <span className="text-[#E50914]">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF] group-focus-within:text-[#E50914] transition-colors">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-[#090D16]/90 border border-[#232936] focus:border-[#E50914] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#E50914] transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Input with Show/Hide Eye Toggle */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-sans text-[11px] font-medium text-gray-300">
                        Password <span className="text-[#E50914]">*</span>
                      </label>
                      {activeTab === 'signin' && (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            void handleForgotPassword();
                          }}
                          className="font-sans text-[11px] text-[#E50914] hover:text-red-400 transition-colors"
                        >
                          Forgot password?
                        </a>
                      )}
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF] group-focus-within:text-[#E50914] transition-colors">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        className="w-full pl-10 pr-10 py-2.5 bg-[#090D16]/90 border border-[#232936] focus:border-[#E50914] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#E50914] transition-all font-sans"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Show or hide password"
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9CA3AF] hover:text-gray-200 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Device Checkbox */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-[#090D16] border-[#232936] text-[#E50914] focus:ring-[#E50914] focus:ring-offset-0 focus:ring-opacity-25 accent-[#E50914]"
                      />
                      <span className="text-xs text-gray-300">Keep me signed in on this device</span>
                    </label>
                    <span className="font-sans text-[10px] text-[#9CA3AF]">30 days</span>
                  </div>

                  {/* Primary Submit CTA Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={
                        isLoading ||
                        (activeTab === 'signup' &&
                          (letterboxd.status === 'checking' || letterboxd.status === 'invalid'))
                      }
                      className="w-full relative py-2.5 px-4 rounded-xl bg-[#E50914] hover:bg-[#B80710] text-white text-sm font-semibold tracking-wide transition-all duration-200 shadow-[0_0_30px_rgba(229,9,20,0.35)] hover:shadow-[0_0_40px_rgba(229,9,20,0.6)] flex items-center justify-center gap-2 group disabled:opacity-75 disabled:cursor-not-allowed active:scale-[0.99] cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2 font-sans text-xs">
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>
                            {activeTab === 'signin'
                              ? 'Signing in...'
                              : 'Creating your account...'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span>{activeTab === 'signin' ? 'Sign in' : 'Create account'}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Mobile-First Error Boundary Alert Box */}
            {authError && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3.5 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs font-sans flex flex-col gap-2 shadow-[0_0_20px_rgba(229,9,20,0.25)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider text-[11px]">
                    <XCircle className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span>We couldn&apos;t sign you in</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopyError}
                      className="p-1 rounded bg-black/40 hover:bg-black/60 text-red-300 hover:text-white transition-colors cursor-pointer"
                      title="Copy message"
                    >
                      {copiedError ? <Check className="w-3.5 h-3.5 text-[#4EDEAE]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthError(null)}
                      className="p-1 rounded bg-black/40 hover:bg-black/60 text-red-300 hover:text-white transition-colors cursor-pointer"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed break-words text-red-200/90 font-sans">
                  {authError}
                </p>
              </motion.div>
            )}

            {/* Success / Notice Feedback Box */}
            {authNotice && !confirmationSent && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 font-sans animate-pulse shadow-[0_0_20px_rgba(78,222,174,0.15)]"
              >
                <CheckCircle2 className="w-4 h-4 text-[#4EDEAE] shrink-0" />
                <span className="leading-snug">{authNotice}</span>
              </motion.div>
            )}
          </div>

          {/* Trust Badges & Cinephile Protocol Footer under Card */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-sans text-[11px] text-[#9CA3AF]">
            <div className="flex items-center gap-1.5 text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-[#4EDEAE]" />
              <span>Secure sign-in</span>
            </div>
            <span className="text-[#232936]">•</span>
            <div className="flex items-center gap-1.5 text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
              <span>Works with Letterboxd</span>
            </div>
            <span className="text-[#232936]">•</span>
            <div className="flex items-center gap-2">
              <a href="#" className="hover:text-gray-300 transition-colors">
                Terms
              </a>
              <span className="text-[#232936]">&amp;</span>
              <a href="#" className="hover:text-gray-300 transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Global Vault Footer */}
      <footer className="w-full border-t border-[#232936]/60 bg-[#121620]/40 backdrop-blur-md py-4 px-6 z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#9CA3AF]">
          <div className="flex items-center gap-2 font-sans text-[11px]">
            <span>© {new Date().getFullYear()} CultCrate.</span>
            <span className="text-[#232936]">|</span>
            <span className="text-gray-400">Made for people who love film.</span>
          </div>
          <div className="flex items-center gap-4 font-sans text-[11px]">
            <span className="flex items-center gap-1.5 text-gray-400">
              <span className="w-2 h-2 rounded-full bg-[#4EDEAE]" />
              All systems running
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
