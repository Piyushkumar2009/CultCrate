'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Film,
  Key,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Shield,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  User,
  Trash2,
  Clock,
  Info,
  Sliders,
  ArrowRight,
  UploadCloud,
  FileSpreadsheet,
  Database,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { canonicalizeUploadedCsv } from '@/lib/deduplication';
import { clearClientStorage, downloadRatingsCsv, uploadRatingsCsv } from '@/lib/vaultStorage';
import { UserNavMenu } from '@/components/UserNavMenu';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Toast Notification Interface
interface ToastState {
  type: 'success' | 'error' | 'info';
  message: string;
  id: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // User & Auth State
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Gemini API Key State
  const [apiKey, setApiKey] = useState('');
  const [originalKey, setOriginalKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  // Ratings CSV State
  const [csvChecking, setCsvChecking] = useState(true);
  const [hasStoredCsv, setHasStoredCsv] = useState(false);
  const [, setStoredCsvName] = useState<string | null>(null);
  const [storedCsvSize, setStoredCsvSize] = useState<string | null>(null);
  const [storedCsvUpdatedAt, setStoredCsvUpdatedAt] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [uploadSuccessAlert, setUploadSuccessAlert] = useState(false);

  // Toasts & Error Handling
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedError, setCopiedError] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Toast Helper
  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { type, message, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper to format byte sizes
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Check stored ratings.csv strictly in watchlists/${user.id}/ratings.csv
  const checkSupabaseStorageCsv = useCallback(async (userId: string) => {
    setCsvChecking(true);
    try {
      let foundFile = false;

      // Cache-busted download (no-store + cacheNonce) so a stale object is never reported
      const result = await downloadRatingsCsv(supabase, userId);
      if (result.status === 'found') {
        foundFile = true;
        setHasStoredCsv(true);
        setStoredCsvName('ratings.csv');
        setStoredCsvSize(formatFileSize(result.bytes));
        setStoredCsvUpdatedAt(new Date().toISOString());
      }

      if (!foundFile) {
        setHasStoredCsv(false);
        setStoredCsvName(null);
      }
    } catch (err) {
      console.warn('Storage check exception:', err);
      setHasStoredCsv(false);
    } finally {
      setCsvChecking(false);
    }
  }, [supabase]);

  // 1. Authenticate user & load profile from Supabase
  useEffect(() => {
    async function initUserAndProfile() {
      try {
        const {
          data: { user: currentUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !currentUser) {
          router.push('/auth');
          return;
        }

        setUser(currentUser);

        // Fetch user profile from Supabase 'profiles' table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, gemini_api_key, updated_at')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileError) {
          console.warn('Profile fetch warning:', profileError.message);
          if (profileError.code === 'PGRST116' || profileError.message.includes('not found')) {
            await supabase.from('profiles').insert({ id: currentUser.id, gemini_api_key: null });
          }
        } else if (profile) {
          if (profile.gemini_api_key) {
            setApiKey(profile.gemini_api_key);
            setOriginalKey(profile.gemini_api_key);
          }
          if (profile.updated_at) {
            setLastUpdatedAt(profile.updated_at);
          }
        }

        // Check storage for existing ratings.csv strictly
        await checkSupabaseStorageCsv(currentUser.id);
      } catch (err: unknown) {
        console.error('Error initializing settings profile:', err);
        setBannerError('We couldn\'t load your settings. Please refresh and try again.');
      } finally {
        setAuthLoading(false);
      }
    }

    initUserAndProfile();
  }, [supabase, router, checkSupabaseStorageCsv]);

  // Derived user details
  const letterboxdHandle =
    (user?.user_metadata?.letterboxd_username as string) ||
    user?.email?.split('@')[0] ||
    'cinephile_curator';
  const userEmail = user?.email || '';

  // 2. Save Gemini API Key to Supabase `profiles` table
  const handleSaveApiKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      showToast('error', 'Please sign in to change your settings.');
      return;
    }

    const cleanedKey = apiKey.trim();

    if (cleanedKey && !cleanedKey.startsWith('AIzaSy')) {
      showToast('info', 'Most keys start with "AIzaSy". We saved yours as entered.');
    }

    setIsSaving(true);
    setBannerError(null);

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            gemini_api_key: cleanedKey || null,
            updated_at: now,
          },
          { onConflict: 'id' }
        );

      if (error) {
        throw new Error(error.message);
      }

      setOriginalKey(cleanedKey);
      setLastUpdatedAt(now);
      setTestStatus('idle');

      if (cleanedKey) {
        showToast('success', 'Your API key is saved.');
      } else {
        showToast('info', 'Your API key was removed. CultCrate will use its built-in one.');
      }
    } catch (err: unknown) {
      console.error('Error saving API key:', err);
      setBannerError('We couldn\'t save your API key. Please try again.');
      showToast('error', 'Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Clear API Key
  const handleClearApiKey = async () => {
    if (!confirm('Remove your API key? CultCrate will use its built-in one instead.')) {
      return;
    }
    setApiKey('');
    setIsSaving(true);
    setBannerError(null);

    try {
      if (user) {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('profiles')
          .upsert({ id: user.id, gemini_api_key: null, updated_at: now }, { onConflict: 'id' });

        if (error) throw new Error(error.message);

        setOriginalKey('');
        setLastUpdatedAt(now);
        setTestStatus('idle');
        showToast('info', 'Your API key was removed.');
      }
    } catch (err: unknown) {
      console.error('Error clearing API key:', err);
      setBannerError('We could not remove your API key. Please try again.');
      showToast('error', 'Could not remove your key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Quick Key Syntax Test
  const handleTestKeyFormat = () => {
    const cleanedKey = apiKey.trim();
    if (!cleanedKey) {
      showToast('info', 'Paste your API key first.');
      return;
    }

    setIsTestingKey(true);
    setTimeout(() => {
      setIsTestingKey(false);
      if (cleanedKey.startsWith('AIzaSy') && cleanedKey.length >= 35) {
        setTestStatus('valid');
        showToast('success', 'Looks good! That key has the right format.');
      } else {
        setTestStatus('invalid');
        showToast('error', 'That doesn\'t look right. Keys usually start with "AIzaSy" and are 39 characters long.');
      }
    }, 600);
  };

  // 5. Ratings CSV Upload & Overwrite Handler strictly to watchlists/${user.id}/ratings.csv
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      showToast('error', 'Please choose the .csv file you exported from Letterboxd.');
      return;
    }

    setSelectedFile(file);
    setUploadSuccessAlert(false);
  };

  const handleUploadOrReplaceCsv = async (fileToUpload?: File) => {
    const targetFile = fileToUpload || selectedFile;
    if (!targetFile) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      return;
    }

    if (!user) {
      showToast('error', 'Please sign in to upload your ratings.');
      return;
    }

    setIsUploadingCsv(true);
    setUploadSuccessAlert(false);

    try {
      // Validate + normalize BEFORE anything is written: a malformed export can no longer
      // become the stored ratings.csv (and a zero-row file is rejected outright).
      const rawText = await targetFile.text();
      const canonical = canonicalizeUploadedCsv(rawText);
      if (!canonical.ok) {
        throw new Error(canonical.error);
      }

      const uploadResult = await uploadRatingsCsv(supabase, user.id, canonical.csv);
      if (!uploadResult.ok) {
        throw new Error(uploadResult.error);
      }
      const storedFilmCount = uploadResult.rowCount;

      // Purge all client-side cached movie lists, watched counts, and RSS merge states
      try {
        if (typeof window !== 'undefined') {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (
              key &&
              (key.includes('cultcrate') ||
                key.includes('letterboxd') ||
                key.includes('watchlist') ||
                key.includes('rss') ||
                key.includes('ratings') ||
                key.includes('count') ||
                key.includes('movie'))
            ) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        }
      } catch (cacheErr) {
        console.warn('LocalStorage cache purge notice:', cacheErr);
      }

      // Update state
      setHasStoredCsv(true);
      setStoredCsvName('ratings.csv');
      setStoredCsvSize(formatFileSize(targetFile.size));
      setStoredCsvUpdatedAt(new Date().toISOString());
      setSelectedFile(null);
      setUploadSuccessAlert(true);

      showToast('success', `Ratings updated: ${storedFilmCount} films. Head back to your dashboard to get new picks.`);

      await checkSupabaseStorageCsv(user.id);
    } catch (err: unknown) {
      console.error('CSV upload error:', err);
      const msg = err instanceof Error ? err.message : '';
      // Show validation problems with the file itself; keep infrastructure errors generic.
      const isFileProblem = /csv|column|row|empty|invalid|header|file/i.test(msg) && !/storage|bucket|supabase|policy|row-level|jwt|postgres|relation/i.test(msg);
      showToast('error', isFileProblem ? `We couldn\'t read that file: ${msg}` : 'Upload didn\'t work. Please try again.');
    } finally {
      setIsUploadingCsv(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Copy Key to Clipboard
  const handleCopyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    showToast('info', 'Copied.');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Copy Error details
  const handleCopyError = () => {
    if (!bannerError) return;
    navigator.clipboard.writeText(bannerError);
    setCopiedError(true);
    setTimeout(() => setCopiedError(false), 2000);
  };

  // Handle Logout
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    // Wipe local state only AFTER the session has been revoked
    clearClientStorage();
    router.replace('/auth');
    router.refresh();
  };

  const hasUnsavedChanges = apiKey !== originalKey;

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#090D16] flex items-center justify-center text-white font-sans p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-[#E50914] border-t-transparent animate-spin" />
            <Film className="absolute inset-0 m-auto w-5 h-5 text-[#E50914] animate-pulse" />
          </div>
          <span className="text-xs text-[#9CA3AF] uppercase tracking-widest animate-pulse">
            Loading your settings...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#090D16] text-[#F9FAFB] font-sans selection:bg-[#E50914] selection:text-white pb-24 overflow-x-hidden relative">
      {/* Background Volumetric Cinematic Glows */}
      <div className="fixed top-20 left-1/4 w-[450px] h-[450px] bg-[#E50914]/8 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-[400px] h-[400px] bg-[#4EDEAE]/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-4 right-0 left-0 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex flex-col gap-2 sm:max-w-md w-full px-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto p-4 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-xl ${
                toast.type === 'success'
                  ? 'bg-[#121620]/95 border-[#4EDEAE]/40 text-emerald-100 shadow-[0_0_20px_rgba(78,222,174,0.15)]'
                  : toast.type === 'error'
                  ? 'bg-red-950/95 border-red-500/50 text-red-100 shadow-[0_0_25px_rgba(229,9,20,0.25)]'
                  : 'bg-[#181E2C]/95 border-[#232936] text-zinc-100 shadow-xl'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#4EDEAE] shrink-0 mt-0.5" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 text-[#E50914] shrink-0 mt-0.5" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}

              <div className="flex-1 text-xs leading-relaxed font-sans">
                <span className="font-semibold block font-sans text-[11px] uppercase tracking-wider mb-0.5 opacity-80">
                  {toast.type === 'success' ? 'Done' : toast.type === 'error' ? 'Something went wrong' : 'Heads up'}
                </span>
                {toast.message}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors"
                title="Dismiss"
              >
                &times;
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header Navigation */}
      <header className="sticky top-0 z-40 bg-[#090D16]/90 backdrop-blur-xl border-b border-[#232936] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center group transition-opacity hover:opacity-90 active:scale-95"
          title="CultCrate home"
        >
          <span className="text-xl sm:text-2xl font-black tracking-tight text-white select-none">
            Cult<span className="text-[#E50914]">Crate</span>
          </span>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121620] hover:bg-[#1c2230] border border-[#232936] hover:border-[#E50914]/50 text-xs font-sans text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#E50914]" />
            <span className="hidden sm:inline">Back to dashboard</span>
            <span className="sm:hidden">Dashboard</span>
          </Link>

          <UserNavMenu
            letterboxdHandle={letterboxdHandle}
            userEmail={userEmail}
            userId={user?.id}
            isAuthenticated={Boolean(user)}
            onSignOut={handleSignOut}
          />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Error Banner for Mobile Browser Debugging */}
        {bannerError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-red-950/80 border-2 border-red-500/60 text-red-200 text-xs font-sans flex items-start justify-between gap-3 shadow-[0_0_30px_rgba(229,9,20,0.3)]"
          >
            <div className="flex items-start gap-2.5">
              <XCircle className="w-5 h-5 text-[#E50914] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-red-400 uppercase tracking-wider text-[11px] block">
                  Something needs attention
                </span>
                <p className="mt-0.5 leading-relaxed text-red-100">{bannerError}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCopyError}
                className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-red-300 hover:text-white transition-colors cursor-pointer"
                title="Copy message"
              >
                {copiedError ? <Check className="w-3.5 h-3.5 text-[#4EDEAE]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setBannerError(null)}
                className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-red-300 hover:text-white transition-colors cursor-pointer"
                title="Dismiss"
              >
                &times;
              </button>
            </div>
          </motion.div>
        )}

        {/* Global Success Notification Alert: Ratings updated */}
        <AnimatePresence>
          {uploadSuccessAlert && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 sm:p-5 rounded-2xl bg-emerald-950/80 border border-[#4EDEAE]/50 text-white shadow-[0_0_25px_rgba(78,222,174,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4EDEAE]/20 border border-[#4EDEAE]/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-[#4EDEAE]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-200">
                    Your ratings are up to date!
                  </h4>
                  <p className="text-xs text-emerald-300/80 mt-0.5">
                    Head back to your dashboard and run the AI Engine for fresh picks.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl bg-[#4EDEAE] hover:bg-[#3ec497] text-black font-sans font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <span>Back to dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => setUploadSuccessAlert(false)}
                  className="p-2 rounded-xl text-emerald-300 hover:text-white hover:bg-emerald-900/40 transition-colors"
                  title="Close notice"
                >
                  &times;
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#232936]">
          <div>
            <div className="flex items-center gap-2 text-xs font-sans text-[#E50914] mb-1">
              <Sliders className="w-3.5 h-3.5" />
              <span>SETTINGS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Settings
            </h1>
            <p className="text-sm text-[#9CA3AF] mt-1">
              Keep your film history and your AI key up to date.
            </p>
          </div>

          {/* User Status Pill */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#121620] border border-[#232936] text-xs font-sans self-start sm:self-auto">
            <div className="w-2 h-2 rounded-full bg-[#4EDEAE] animate-pulse" />
            <div className="flex flex-col text-left">
              <span className="text-white font-semibold">@{letterboxdHandle}</span>
              <span className="text-[10px] text-[#9CA3AF] truncate max-w-[180px]">{userEmail}</span>
            </div>
          </div>
        </div>

        {/* SECTION 1: RATINGS CSV MANAGEMENT */}
        <section className="p-6 sm:p-8 rounded-2xl bg-[#121620] border border-[#232936] relative overflow-hidden shadow-2xl space-y-6">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#4EDEAE] to-transparent opacity-80" />

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4EDEAE]/10 border border-[#4EDEAE]/30 flex items-center justify-center text-[#4EDEAE] shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Your film ratings</h2>
                  {csvChecking ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-sans">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Checking...
                    </span>
                  ) : hasStoredCsv ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-[#4EDEAE]/40 text-[#4EDEAE] text-[10px] font-sans font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Active &amp; synced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-sans font-medium">
                      <AlertTriangle className="w-3 h-3" /> Not added yet
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  Upload your Letterboxd export so we know what you\'ve watched and loved.
                </p>
              </div>
            </div>

            {hasStoredCsv && (
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181E2C] hover:bg-[#232936] border border-[#232936] hover:border-[#4EDEAE]/40 text-xs font-sans text-zinc-300 hover:text-white transition-colors"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#4EDEAE]" />
              </Link>
            )}
          </div>

          {/* Current CSV Storage Status Banner */}
          <div className="p-4 rounded-xl bg-[#090D16] border border-[#232936] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#181E2C] border border-[#232936] flex items-center justify-center text-zinc-400 shrink-0">
                <Database className="w-4 h-4 text-[#4EDEAE]" />
              </div>
              <div className="text-xs font-sans">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">Status</span>
                {hasStoredCsv ? (
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#4EDEAE] inline-block" />
                    Active &amp; synced
                  </span>
                ) : (
                  <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    No ratings yet. Add your Letterboxd file below.
                  </span>
                )}
              </div>
            </div>

            {/* Storage Metadata Indicators */}
            {hasStoredCsv && (
              <div className="flex items-center gap-4 text-[11px] font-sans text-zinc-400">
                {storedCsvSize && (
                  <div>
                    <span className="text-zinc-600 block text-[10px]">File size</span>
                    <span className="text-zinc-300">{storedCsvSize}</span>
                  </div>
                )}
                {storedCsvUpdatedAt && (
                  <div>
                    <span className="text-zinc-600 block text-[10px]">Last updated</span>
                    <span className="text-zinc-300">{new Date(storedCsvUpdatedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* File Input Uploader */}
          <div className="space-y-4">
            <label className="block text-xs font-sans uppercase tracking-wider text-zinc-300">
              Your Letterboxd ratings file
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelection}
              className="hidden"
              id="ratings-csv-file-input"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="group p-6 rounded-xl border-2 border-dashed border-[#232936] hover:border-[#4EDEAE]/70 bg-[#090D16]/60 hover:bg-[#090D16] transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2"
            >
              <div className="w-12 h-12 rounded-xl bg-[#181E2C] group-hover:bg-[#4EDEAE]/10 border border-[#232936] group-hover:border-[#4EDEAE]/40 flex items-center justify-center text-zinc-400 group-hover:text-[#4EDEAE] transition-all">
                <UploadCloud className="w-6 h-6" />
              </div>

              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white flex items-center justify-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#4EDEAE]" />
                    <span>{selectedFile.name}</span>
                  </p>
                  <p className="text-xs text-zinc-400 font-sans">
                    {formatFileSize(selectedFile.size)} · Ready to upload. This replaces your current ratings.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                    Tap to choose your Letterboxd ratings file
                  </p>
                  <p className="text-xs text-zinc-500 font-sans">
                    Export it from your Letterboxd account settings, then choose it here.
                  </p>
                </div>
              )}
            </div>

            {/* Action Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-zinc-400 font-sans flex items-center gap-1.5 self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5 text-[#4EDEAE]" />
                <span>Uploading replaces your current ratings.</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-sans text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleUploadOrReplaceCsv()}
                  disabled={isUploadingCsv}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#4EDEAE] hover:bg-[#3ec497] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-sans font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#4EDEAE]/20 active:scale-95 cursor-pointer"
                >
                  {isUploadingCsv ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>{selectedFile ? 'Upload this file' : 'Choose a file'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: GOOGLE GEMINI API KEY */}
        <section className="p-6 sm:p-8 rounded-2xl bg-[#121620] border border-[#232936] relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#E50914] to-transparent opacity-80" />

          <form onSubmit={handleSaveApiKey} className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E50914]/10 border border-[#E50914]/30 flex items-center justify-center text-[#E50914] shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Your AI key (optional)
                    {originalKey && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-[#4EDEAE]/40 text-[#4EDEAE] text-[10px] font-sans">
                        <CheckCircle2 className="w-3 h-3" /> Saved
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    Add your own Google Gemini key if you want. If you skip this, CultCrate uses its own.
                  </p>
                </div>
              </div>

              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181E2C] hover:bg-[#232936] border border-[#232936] text-xs font-sans text-[#9CA3AF] hover:text-white transition-colors shrink-0"
                title="Opens Google AI Studio in a new tab"
              >
                <span>Get a free key</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#E50914]" />
              </a>
            </div>

            <div className="space-y-2">
              <label htmlFor="geminiApiKey" className="block text-xs font-sans uppercase tracking-wider text-zinc-300">
                Your key <span className="text-[#E50914]">*</span>
              </label>

              <div className="relative flex items-center">
                <input
                  id="geminiApiKey"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    if (testStatus !== 'idle') setTestStatus('idle');
                  }}
                  placeholder="AIzaSy..."
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full pl-4 pr-32 py-3.5 rounded-xl bg-[#090D16] border border-[#232936] focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] text-sm text-white font-sans placeholder:text-zinc-600 transition-all outline-none"
                />

                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-[#181E2C] transition-colors cursor-pointer"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4 text-[#E50914]" /> : <Eye className="w-4 h-4" />}
                  </button>

                  {apiKey && (
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-[#181E2C] transition-colors cursor-pointer"
                      title="Copy key"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-[#4EDEAE]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleTestKeyFormat}
                    disabled={!apiKey || isTestingKey}
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-[#181E2C] transition-colors disabled:opacity-40 cursor-pointer"
                    title="Check key format"
                  >
                    {isTestingKey ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] font-sans text-[#9CA3AF] pt-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#4EDEAE]" />
                  <span>Private to your account.</span>
                </div>

                {lastUpdatedAt && (
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Clock className="w-3 h-3 text-[#E50914]" />
                    <span>Updated {new Date(lastUpdatedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {testStatus === 'valid' && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-[#4EDEAE]/30 text-[#4EDEAE] text-xs font-sans flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Looks good: that key has the right format.</span>
              </div>
            )}
            {testStatus === 'invalid' && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-sans flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#E50914]" />
                <span>Double-check your key. Google keys usually start with AIzaSy.</span>
              </div>
            )}

            <div className="p-4 rounded-xl bg-[#090D16]/60 border border-[#232936] text-xs text-zinc-400 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold font-sans text-[11px] uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-[#E50914]" />
                <span>Private &amp; secure</span>
              </div>
              <p className="leading-relaxed">
                Your key is stored securely and only you can see it when you\'re signed in.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-[#232936]">
              {originalKey ? (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  disabled={isSaving}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-500/30 text-xs font-sans text-red-300 hover:text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>Remove my key</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={isSaving || !hasUnsavedChanges}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#E50914] hover:bg-[#ff0f1b] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-zinc-700 disabled:shadow-none text-white text-xs font-sans font-bold tracking-wider uppercase transition-all shadow-lg shadow-[#E50914]/25 cursor-pointer active:scale-95"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{hasUnsavedChanges ? 'Save' : 'Saved'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* SECTION 3: ACCOUNT OVERVIEW */}
        <section className="p-6 rounded-2xl bg-[#121620] border border-[#232936] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#181E2C] border border-[#232936] flex items-center justify-center text-zinc-300">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">At a glance</h3>
              <p className="text-xs text-[#9CA3AF]">What\'s connected to your account</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-sans">
            <div className="p-3 rounded-xl bg-[#090D16] border border-[#232936]">
              <span className="text-[10px] text-zinc-500 block">Letterboxd</span>
              <span className="text-white font-semibold">@{letterboxdHandle}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#090D16] border border-[#232936]">
              <span className="text-[10px] text-zinc-500 block">Account</span>
              <span className="text-[#4EDEAE]">Connected</span>
            </div>
            <div className="p-3 rounded-xl bg-[#090D16] border border-[#232936]">
              <span className="text-[10px] text-zinc-500 block">Ratings</span>
              {csvChecking ? (
                <span className="text-zinc-400">Checking...</span>
              ) : hasStoredCsv ? (
                <span className="text-[#4EDEAE]">Active &amp; Synced</span>
              ) : (
                <span className="text-amber-300">Not added yet</span>
              )}
            </div>
            <div className="p-3 rounded-xl bg-[#090D16] border border-[#232936]">
              <span className="text-[10px] text-zinc-500 block">AI key</span>
              {originalKey ? (
                <span className="text-[#4EDEAE]">Saved</span>
              ) : (
                <span className="text-zinc-400">Using CultCrate&apos;s</span>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
