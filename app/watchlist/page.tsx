'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Film,
  Bookmark,
  Sparkles,
  ArrowLeft,
  Trash2,
  Play,
  X,
  ExternalLink,
  Radio,
  Sliders,
  Clock,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import MovieCard, { RecommendedFilm } from '@/components/MovieCard';
import {
  type WatchlistFilm,
  getLocalWatchlist,
  saveLocalWatchlist,
  syncWatchlistToSupabase,
} from '@/lib/watchlistStorage';
import { UserNavMenu } from '@/components/UserNavMenu';

export default function WatchlistPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistFilm[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'year' | 'affinity'>('recent');
  const [activeTrailerFilm, setActiveTrailerFilm] = useState<RecommendedFilm | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Initial Load: Auth check and Watchlist fetch from storage & user profile
  useEffect(() => {
    let cancelled = false;

    async function initWatchlist() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        // Secure Route Access: Unauthenticated users redirected gracefully to /auth
        if (!currentUser) {
          router.replace('/auth?redirect=/watchlist');
          return;
        }

        setUser(currentUser);

        // Fetch from local state first for instant rendering
        const local = getLocalWatchlist(currentUser.id);

        // Check if Supabase user profile metadata has saved watchlist
        const metaWatchlist = currentUser.user_metadata?.watchlist;
        if (Array.isArray(metaWatchlist) && metaWatchlist.length > 0 && local.length === 0) {
          saveLocalWatchlist(metaWatchlist, currentUser.id);
          if (!cancelled) setWatchlist(metaWatchlist);
        } else {
          if (!cancelled) setWatchlist(local);
        }
      } catch (err) {
        console.warn('[WatchlistPage] Init notice:', err);
        if (!cancelled) {
          router.replace('/auth?redirect=/watchlist');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void initWatchlist();

    // Listen for cross-tab or cross-component sync
    const handleSync = () => {
      const updated = getLocalWatchlist(user?.id);
      setWatchlist(updated);
    };

    window.addEventListener('cultcrate_watchlist_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      cancelled = true;
      window.removeEventListener('cultcrate_watchlist_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [supabase, user?.id, router]);

  // 2. Toggle removal from watchlist
  const handleToggleWatchlist = useCallback(
    (filmId: string) => {
      setWatchlist((prev) => {
        const updated = prev.filter((f) => f.id !== filmId);
        saveLocalWatchlist(updated, user?.id);

        if (user) {
          void syncWatchlistToSupabase(supabase, updated);
        }

        return updated;
      });
    },
    [user, supabase]
  );

  // 3. Clear all items with confirmation
  const handleClearAll = useCallback(() => {
    if (watchlist.length === 0) return;
    if (typeof window !== 'undefined' && !window.confirm('Remove all films from your watchlist?')) {
      return;
    }
    setWatchlist([]);
    saveLocalWatchlist([], user?.id);
    if (user) {
      void syncWatchlistToSupabase(supabase, []);
    }
  }, [watchlist.length, user, supabase]);

  // 4. Sorted and filtered films
  const displayedFilms = useMemo(() => {
    let list = [...watchlist];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.title.toLowerCase().includes(query) ||
          f.director?.toLowerCase().includes(query) ||
          (Array.isArray(f.genre) && f.genre.some((g) => g.toLowerCase().includes(query)))
      );
    }

    const num = (v: unknown): number => {
      const n = parseFloat(String(v ?? '0'));
      return Number.isFinite(n) ? n : 0;
    };

    if (sortBy === 'recent') {
      list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => num(b.letterboxdRating || b.imdbRating) - num(a.letterboxdRating || a.imdbRating));
    } else if (sortBy === 'year') {
      list.sort((a, b) => num(b.year) - num(a.year));
    } else if (sortBy === 'affinity') {
      list.sort((a, b) => num(b.matchScore) - num(a.matchScore));
    }

    return list;
  }, [watchlist, sortBy, searchQuery]);

  if (isLoading || !user) {
    return (
      <div className="min-h-[100dvh] bg-[#090D16] flex flex-col items-center justify-center font-sans text-white p-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="relative w-12 h-12 rounded-2xl bg-[#E50914] flex items-center justify-center animate-pulse shadow-[0_0_35px_rgba(229,9,20,0.6)]">
            <Bookmark className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold tracking-wider font-sans text-white uppercase">
              Loading your watchlist...
            </h3>
            <p className="text-xs text-[#9CA3AF] font-sans">
              Just a moment
            </p>
          </div>
          <div className="w-48 h-1 bg-[#121620] rounded-full overflow-hidden border border-[#232936] mt-2">
            <div className="w-full h-full bg-[#E50914] animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#090D16] text-[#F9FAFB] font-sans selection:bg-[#E50914] selection:text-white pb-24 overflow-x-hidden">
      {/* Background Volumetric Glows */}
      <div className="fixed top-20 left-1/4 w-[500px] h-[500px] bg-[#E50914]/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-1/2 -right-20 w-[400px] h-[400px] bg-[#4EDEAE]/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-[#090D16]/90 backdrop-blur-xl border-b border-[#232936] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121620] hover:bg-[#1a202c] border border-[#232936] text-xs font-sans text-[#9CA3AF] hover:text-white transition-all cursor-pointer active:scale-95"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#E50914]" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <Link
            href="/"
            className="flex items-center group transition-opacity hover:opacity-90 active:scale-95"
            title="CultCrate home"
          >
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white select-none">
              Cult<span className="text-[#E50914]">Crate</span>
            </span>
          </Link>
        </div>

        {/* Right Stats & Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E50914] hover:bg-[#B80710] text-white text-xs font-sans font-bold shadow-[0_0_15px_rgba(229,9,20,0.4)] transition-all cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Recommendations</span>
          </Link>

          <UserNavMenu
            letterboxdHandle={user?.user_metadata?.letterboxd_username || user?.email?.split('@')[0] || 'cinephile'}
            userEmail={user?.email || ''}
            userId={user?.id}
            isAuthenticated={true}
            watchlistCount={watchlist.length}
            onSignOut={async () => {
              await supabase.auth.signOut();
              window.location.href = '/auth';
            }}
            onProfileUpdated={() => {
              window.location.reload();
            }}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Banner Section */}
        <div className="rounded-2xl bg-gradient-to-r from-[#121620] via-[#121620] to-[#0d1f1a] border border-[#232936] p-6 shadow-xl relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#4EDEAE] fill-[#4EDEAE]" />
              <h1 className="font-sans text-xs text-[#4EDEAE] font-bold uppercase tracking-wider">
                Your watchlist
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-[10px] text-[#9CA3AF] bg-[#090D16] border border-[#232936] px-2 py-0.5 rounded">
                {user ? `@${(user.user_metadata?.letterboxd_username as string) || user.email?.split('@')[0]}` : 'Guest'}
              </span>
              <span className="font-sans text-[10px] text-[#4EDEAE] bg-[#4EDEAE]/10 border border-[#4EDEAE]/30 px-2 py-0.5 rounded">
                Saved to your account
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-200 leading-relaxed max-w-3xl">
            Films you\'ve saved from your recommendations. They stay on your account, so they\'ll be here on any device, and we\'ll never recommend them again.
          </p>
        </div>

        {/* Toolbar & Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl bg-[#090D16] border border-[#232936]">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, director or genre"
              className="w-full bg-[#121620] border border-[#232936] text-white text-xs rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-[#E50914] placeholder-zinc-500 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sorter and Clear Actions */}
          <div className="flex items-center gap-3 justify-between sm:justify-end">
            <div className="flex items-center gap-2 font-sans text-xs">
              <span className="text-[#9CA3AF] text-[11px] uppercase tracking-wider">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#121620] border border-[#232936] text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#E50914] cursor-pointer"
              >
                <option value="recent">Recently added</option>
                <option value="affinity">Best match</option>
                <option value="rating">Top rated</option>
                <option value="year">Newest</option>
              </select>
            </div>

            {watchlist.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="p-1.5 rounded-lg bg-[#121620] hover:bg-red-950/40 border border-[#232936] hover:border-red-600/40 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer active:scale-95 text-xs font-sans flex items-center gap-1"
                title="Clear watchlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Watchlist Movie Cards Grid */}
        {isLoading ? (
          <div className="p-12 text-center rounded-2xl bg-[#121620]/60 border border-[#232936] space-y-4">
            <Film className="w-8 h-8 text-[#E50914] animate-pulse mx-auto" />
            <p className="text-xs font-sans text-[#9CA3AF]">Loading your films...</p>
          </div>
        ) : displayedFilms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedFilms.map((film) => (
              <MovieCard
                key={film.id}
                film={film}
                movie={{
                  title: film.title,
                  year: film.year,
                  rating: film.letterboxdRating || film.imdbRating || film.rating,
                  genre: Array.isArray(film.genre) ? film.genre.join(' • ') : film.genre,
                  reason: film.curatorialReason || film.synopsis,
                }}
                isWatchlisted={true}
                onToggleWatchlist={() => handleToggleWatchlist(film.id)}
                onWatchTrailer={(f) => setActiveTrailerFilm(f)}
              />
            ))}
          </div>
        ) : (
          /* Clean Empty State Message */
          <div className="p-10 sm:p-16 text-center rounded-2xl bg-gradient-to-b from-[#121620]/90 to-[#090D16] border border-[#232936] space-y-5 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-[#4EDEAE]/10 border border-[#4EDEAE]/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(78,222,174,0.15)]">
              <Bookmark className="w-8 h-8 text-[#4EDEAE]" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {searchQuery ? 'No matching films found' : 'Your watchlist is empty'}
              </h3>
              <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                {searchQuery
                  ? `Nothing on your watchlist matches "${searchQuery}". Try a different search.`
                  : 'Tap the bookmark on any recommendation to save it here for later.'}
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#E50914] hover:bg-[#B80710] text-white font-sans text-xs uppercase tracking-wider font-bold shadow-[0_0_20px_rgba(229,9,20,0.4)] hover:shadow-[0_0_30px_rgba(229,9,20,0.6)] transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-white" />
                <span>Find films to save</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Official 4K Trailer Modal */}
      <AnimatePresence>
        {activeTrailerFilm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveTrailerFilm(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-[#121620] border border-[#232936] rounded-2xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_50px_rgba(229,9,20,0.25)] z-10"
            >
              <div className="flex items-start justify-between pb-4 border-b border-[#232936]">
                <div>
                  <span className="font-sans text-[10px] text-[#E50914] uppercase tracking-wider font-bold">
                    Trailer
                  </span>
                  <h3 className="text-xl font-bold text-white mt-0.5">
                    {activeTrailerFilm.title} ({activeTrailerFilm.year})
                  </h3>
                  <p className="text-xs text-[#9CA3AF] font-sans">
                    Directed by {activeTrailerFilm.director} • {activeTrailerFilm.runtime}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTrailerFilm(null)}
                  className="p-1.5 rounded-lg bg-[#090D16] border border-[#232936] text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-neutral-900 via-zinc-950 to-black border border-red-950/40 relative flex items-center justify-center">
                <div className="relative z-10 flex flex-col items-center gap-3 p-6 text-center">
                  <a
                    href={activeTrailerFilm.trailerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-14 h-14 rounded-full bg-[#E50914] hover:bg-[#B80710] text-white flex items-center justify-center shadow-[0_0_30px_rgba(229,9,20,0.7)] transition-transform hover:scale-110 active:scale-95"
                  >
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </a>
                  <div>
                    <span className="text-sm font-bold text-white block">
                      Watch on YouTube
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#232936] flex items-center justify-between text-xs font-sans text-[#9CA3AF]">
                <span>Opens in a new tab</span>
                <button
                  type="button"
                  onClick={() => setActiveTrailerFilm(null)}
                  className="px-4 py-1.5 rounded-lg bg-[#E50914] text-white font-semibold hover:bg-[#B80710] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
