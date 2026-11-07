import type { RecommendedFilm } from '@/components/MovieCard';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WatchlistFilm extends RecommendedFilm {
  savedAt?: number;
}

const GUEST_WATCHLIST_KEY = 'cultcrate_guest_watchlist';
export const userWatchlistKey = (userId: string): string => `cultcrate_user_watchlist_${userId}`;

/**
 * Reads the current watchlist from localStorage for a given user (or guest).
 */
export function getLocalWatchlist(userId?: string | null): WatchlistFilm[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = userId ? userWatchlistKey(userId) : GUEST_WATCHLIST_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) {
      // If user just logged in, check if they had a guest watchlist and migrate it
      if (userId) {
        const guestRaw = localStorage.getItem(GUEST_WATCHLIST_KEY);
        if (guestRaw) {
          const parsed = JSON.parse(guestRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorage.setItem(key, guestRaw);
            return parsed;
          }
        }
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[WatchlistStorage] Failed to read localStorage:', err);
    return [];
  }
}

/**
 * Saves the watchlist to localStorage and dispatches a window event so other
 * components in the same window/tab stay instantly in sync.
 */
export function saveLocalWatchlist(films: WatchlistFilm[], userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? userWatchlistKey(userId) : GUEST_WATCHLIST_KEY;
    localStorage.setItem(key, JSON.stringify(films));
    window.dispatchEvent(
      new CustomEvent('cultcrate_watchlist_updated', {
        detail: { count: films.length, userId },
      })
    );
  } catch (err) {
    console.warn('[WatchlistStorage] Failed to save localStorage:', err);
  }
}

/**
 * Persists the user's watchlist to their Supabase user profile metadata
 * (JSONB field `raw_user_meta_data.watchlist` in `auth.users`).
 */
export async function syncWatchlistToSupabase(
  supabase: SupabaseClient,
  films: WatchlistFilm[]
): Promise<void> {
  try {
    // Keep payload clean and structured
    const lightweightFilms = films.map((f) => ({
      id: f.id,
      title: f.title,
      originalTitle: f.originalTitle || '',
      year: typeof f.year === 'number' ? f.year : parseInt(String(f.year)) || 2024,
      runtime: f.runtime || '112 min',
      country: f.country || 'Global',
      countryFlag: f.countryFlag || '',
      director: f.director || 'Visionary Auteur',
      imdbRating: String(f.imdbRating || '7.8'),
      letterboxdRating: String(f.letterboxdRating || '4.0'),
      posterUrl: f.posterUrl || '',
      matchScore: f.matchScore || '98%',
      obscurityBadge: f.obscurityBadge || 'Vault Curated',
      streamingPlatforms: f.streamingPlatforms || [],
      whereToWatchInIndia: f.whereToWatchInIndia || [],
      synopsis: f.synopsis || '',
      curatorialReason: f.curatorialReason || '',
      trailerUrl: f.trailerUrl || '',
      letterboxdUrl: f.letterboxdUrl || '',
      genre: f.genre || ['Arthouse', 'Cult Cinema'],
      savedAt: f.savedAt || Date.now(),
    }));

    await supabase.auth.updateUser({
      data: {
        watchlist: lightweightFilms,
      },
    });
  } catch (err) {
    console.warn('[WatchlistStorage] Supabase user metadata update notice:', err);
  }
}
