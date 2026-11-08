'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Play,
  Bookmark,
  Film,
  AlertTriangle,
  X,
  Clock,
  Share2,
  Dna,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import MovieCard, { RecommendedFilm } from '@/components/MovieCard';
import { useLetterboxdRssSync } from '@/hooks/useLetterboxdRssSync';
import { deduplicateWatchlist } from '@/lib/deduplication';
import { pickLetterboxdHandle } from '@/lib/letterboxdRss';
import { clearClientStorage, downloadRatingsCsv, withTimeout, type CsvDownloadResult } from '@/lib/vaultStorage';
import { ENGINE_REQUEST_TIMEOUT_MS, failedResponseMessage, friendlyEngineError } from '@/lib/engineErrors';
import {
  type WatchlistFilm,
  getLocalWatchlist,
  saveLocalWatchlist,
  syncWatchlistToSupabase,
} from '@/lib/watchlistStorage';
import {
  type CinematicDnaRecord,
  fetchCinematicDnaFromSupabase,
  saveCinematicDnaToSupabase,
  getLocalCinematicDna,
} from '@/lib/cinematicDnaStorage';
import {
  ENGINE_OBSCURITY_LEVEL,
  buildExclusionSet,
  collectExclusionTitles,
  deriveDnaTags,
  filterOutExcluded,
} from '@/lib/dashboardHelpers';
import { UserNavMenu } from '@/components/UserNavMenu';
import { ShareCinematicDnaModal } from '@/components/ShareCinematicDnaModal';

// ---------------------------------------------------------------------------
// Engine Run Persistence & Typed Helpers
// ---------------------------------------------------------------------------

interface PersistedEngineRun {
  userId: string;
  timestamp: number;
  films: RecommendedFilm[];
  tasteProfile?: string;
  tasteProfileSummary?: string;
  tasteDnaTags?: string[];
  obscurityLevel?: number;
  preferences?: string[];
  watchedCount?: number;
}

const LAST_RUN_STORAGE_KEY = (userId: string): string =>
  `cultcrate_engine_last_run_${userId}`;

type DashboardPhase = 'authenticating' | 'loading-vault' | 'ready' | 'error';

const AUTH_TIMEOUT_MS = 12_000;
const STORAGE_TIMEOUT_MS = 15_000;

const DEFAULT_VIBES: readonly string[] = ['🧠 Mind-Bending', '🔪 Dark Thriller', '🤯 Mind Twist'];
const DEFAULT_INDIA_STREAMING: readonly string[] = ['MUBI India', 'Prime Video India', 'Apple TV (Rent/Buy)'];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function firstText(...values: unknown[]): string {
  for (const v of values) {
    const t = asText(v);
    if (t) return t;
  }
  return '';
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).filter((s) => s.length > 0);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  return [];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Signed-out detection that does not depend on auth-js exporting its error guards. */
function isSignedOutError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403;
}

/** Turns any raw failure into a calm, plain-English message (raw details stay in the console only). */
function friendlyMessage(raw: string | null): string {
  if (!raw) return '';
  const text = raw.toLowerCase();
  if (/already on your watchlist|already in your/.test(text)) return raw;
  if (/couldn.t load your film history|couldn.t find any picks|we couldn.t/.test(text)) return raw;
  if (/quota|429|rate|busy|overload|503|unavailable/.test(text)) {
    return 'Our recommendation service is busy right now. Please try again in a minute.';
  }
  if (/key|credential|unauthori[sz]ed|401|403|forbidden|session|sign/.test(text)) {
    return 'We couldn\'t confirm your account. Try signing in again, or check your settings.';
  }
  if (/letterboxd|handle|username/.test(text)) {
    return 'We couldn\'t reach your Letterboxd. Check your username in Edit Profile and try again.';
  }
  if (/network|fetch|timeout|timed out|failed to/.test(text)) {
    return 'Something went wrong with the connection. Please try again.';
  }
  return 'Something went wrong while finding your films. Please try again.';
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Maps one untrusted AI/API film payload to the strict RecommendedFilm shape. */
function mapRecommendedFilm(f: JsonRecord, idx: number, isMasterpiece: boolean): RecommendedFilm {
  const title = firstText(f.title) || 'Untitled film';

  const streaming =
    [f.whereToWatchInIndia, f.where_to_watch_india, f.streamingPlatforms]
      .map(textList)
      .find((list) => list.length > 0) ?? [...DEFAULT_INDIA_STREAMING];

  const imdbRaw = Number(firstText(f.imdb_rating, f.imdbRating));
  const imdb = Number.isFinite(imdbRaw) && imdbRaw > 0 ? imdbRaw : 7.8;
  const yearRaw = Number(firstText(f.year));
  const advisory =
    firstText(f.content_advisory, f.contentAdvisory, f.advisory) || 'Tense and atmospheric';

  return {
    id: firstText(f.id) || `rec-${isMasterpiece ? 'm' : 'e'}-${idx}-${slugify(title === 'Untitled film' ? 'film' : title)}`,
    title,
    originalTitle: firstText(f.originalTitle) || title,
    year: Number.isFinite(yearRaw) && yearRaw > 0 ? yearRaw : 2020,
    runtime: firstText(f.runtime) || (firstText(f.runtime_mins) ? `${firstText(f.runtime_mins)} min` : '120 min'),
    country: firstText(f.country) || 'International',
    countryFlag: firstText(f.countryFlag) || '🌐',
    director: firstText(f.director) || 'Director not listed',
    imdbRating: `${firstText(f.imdb_rating, f.imdbRating) || '7.8'}`,
    letterboxdRating: firstText(f.letterboxdRating) || Math.min(5.0, imdb / 2 + 0.3).toFixed(1),
    posterUrl: '',
    matchScore: firstText(f.matchScore) || `${isMasterpiece ? (99.4 - idx * 0.5).toFixed(1) : (97.2 - idx * 0.7).toFixed(1)}%`,
    // Keep only the cohort name ("Masterpiece Cohort" / "Excellent Gem"); the numeric tier is no longer surfaced
    obscurityBadge:
      firstText(f.obscurityBadge).replace(/^Tier\s*\d+\s*(\/\/|[-:•])?\s*/i, '') ||
      (isMasterpiece ? 'Masterpiece Cohort' : 'Excellent Gem'),
    genre: textList(f.genre).length > 0 ? textList(f.genre) : undefined,
    runtime_mins: Number.isFinite(Number(firstText(f.runtime_mins))) && Number(firstText(f.runtime_mins)) > 0 ? Number(firstText(f.runtime_mins)) : undefined,
    streamingPlatforms: streaming,
    whereToWatchInIndia: streaming,
    contentAdvisory: advisory,
    advisory,
    synopsis:
      firstText(f.spoiler_free_premise, f.synopsis) || 'A standout pick based on the films you love.',
    curatorialReason: firstText(f.thematic_alignment, f.curatorialReason) || 'Fits the kind of films you rate highly.',
    trailerUrl:
      firstText(f.trailerUrl) ||
      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${firstText(f.title)} official trailer`)}`,
    letterboxdUrl: firstText(f.letterboxdUrl) || `https://letterboxd.com/film/${encodeURIComponent(slugify(firstText(f.title)))}/`,
  };
}

// ---------------------------------------------------------------------------
// Small presentational building blocks (visual only, no business logic)
// ---------------------------------------------------------------------------

const PANEL_CLASS =
  'relative rounded-2xl border border-white/[0.07] bg-[#0d111a]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_48px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl';

function Eyebrow({ children, tone = 'red' }: { children: React.ReactNode; tone?: 'red' | 'green' | 'muted' }) {
  const color = tone === 'green' ? 'text-[#4EDEAE]' : tone === 'muted' ? 'text-zinc-500' : 'text-[#E50914]';
  return (
    <span className={`cc-eyebrow block ${color}`}>{children}</span>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
  loading = false,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'green' | 'red';
  loading?: boolean;
}) {
  const valueColor = tone === 'green' ? 'text-[#4EDEAE]' : tone === 'red' ? 'text-[#ff4d56]' : 'text-white';
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3.5 py-3">
      <span className="block text-[11px] font-medium text-zinc-500">{label}</span>
      {loading ? (
        <span className="mt-2 block h-6 w-14 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <span className={`mt-1 block truncate text-xl font-semibold tracking-tight ${valueColor}`}>{value}</span>
      )}
    </div>
  );
}

function FilmCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/[0.06] bg-[#0d111a]/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-white/[0.06]" />
        <div className="h-4 w-14 rounded bg-white/[0.06]" />
      </div>
      <div className="space-y-2.5">
        <div className="h-3 w-40 rounded bg-white/[0.05]" />
        <div className="h-6 w-3/4 rounded bg-white/[0.08]" />
        <div className="h-3 w-full rounded bg-white/[0.05]" />
        <div className="h-3 w-5/6 rounded bg-white/[0.05]" />
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.05] pt-4">
        <div className="h-6 w-16 rounded bg-white/[0.06]" />
        <div className="h-7 w-24 rounded bg-white/[0.06]" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ---- Auth & hydration state machine --------------------------------------
  // authenticating -> loading-vault -> ready   (or -> error with Retry)
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [phase, setPhase] = useState<DashboardPhase>('authenticating');
  const [initError, setInitError] = useState<string | null>(null);
  const [authEpoch, setAuthEpoch] = useState<number>(0);
  const [profileUsername, setProfileUsername] = useState<string>('');
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  const currentUserIdRef = useRef<string | null>(null);
  const signingOutRef = useRef<boolean>(false);

  // ---- Storage state ---------------------------------------------------------
  const [hasSavedCsv, setHasSavedCsv] = useState<boolean>(false);
  const [uniqueMovieCount, setUniqueMovieCount] = useState<number | null>(null);
  const [vaultReadFailed, setVaultReadFailed] = useState<boolean>(false);

  const isLoading = phase === 'authenticating';
  const fetchingStatus = phase === 'authenticating' || phase === 'loading-vault';

  // ---- Silent RSS sync: inert until auth + vault load have fully resolved -----
  const {
    isSyncing: isSyncingRss,
    syncedCount: rssSyncedCount,
    username: syncedUsername,
    lastSyncedAt: rssLastSyncedAt,
    wroteStorage: rssWroteStorage,
    error: rssError,
    triggerSync,
    reset: resetRssSync,
  } = useLetterboxdRssSync({
    userId: phase === 'ready' && user ? user.id : null,
    handle: profileUsername,
  });

  // ---- Filter & curatorial tuning state ---------------------------------------
  // Obscurity selector (T1-T5) was removed from the UI; the engine still receives a fixed calibration value
  const obscurityLevel = ENGINE_OBSCURITY_LEVEL;
  const [isFamilySafe, setIsFamilySafe] = useState<boolean>(false);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([...DEFAULT_VIBES]);
  const [runtimeFilter, setRuntimeFilter] = useState<'any' | '<90' | '<=120' | '140+'>('<=120');

  // ---- Unified Recommendations & Curated Stream State -----------------------------
  const [recommendations, setRecommendations] = useState<RecommendedFilm[]>([]);
  const [hasLoadedPersistedRun, setHasLoadedPersistedRun] = useState<boolean>(false);
  const [lastRunTimestamp, setLastRunTimestamp] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'affinity' | 'year' | 'rating'>('affinity');
  const [tasteProfile, setTasteProfile] = useState<string>('');
  const [tasteProfileSummary, setTasteProfileSummary] = useState<string>('');
  const [tasteDnaTags, setTasteDnaTags] = useState<string[]>([]);

  // ---- Watchlist & trailer -------------------------------------------------------
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [activeTrailerFilm, setActiveTrailerFilm] = useState<RecommendedFilm | null>(null);
  const [isShareDnaModalOpen, setIsShareDnaModalOpen] = useState<boolean>(false);

  // ---- Visual mobile debugger state ------------------------------------------------
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [liveExecutionStep, setLiveExecutionStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // ---- Derived handles (display only; sync uses the validated profile handle) --------
  const userEmail = user?.email || '';
  const letterboxdHandle =
    profileUsername ||
    syncedUsername ||
    (typeof user?.user_metadata?.letterboxd_username === 'string' ? user.user_metadata.letterboxd_username : '') ||
    user?.email?.split('@')[0] ||
    'cinephile_curator';

  // ===========================================================================
  // CLEAN RESET: every piece of per-user state returns to its pristine value so
  // nothing from a previous session can leak into the next login.
  // ===========================================================================
  const resetDashboardState = useCallback(() => {
    currentUserIdRef.current = null;
    setUser(null);
    setProfileUsername('');
    setHasSavedCsv(false);
    setUniqueMovieCount(null);
    setVaultReadFailed(false);
    setInitError(null);
    setErrorMessage(null);
    setAiNotice(null);
    setLiveExecutionStep(null);
    setIsSynthesizing(false);
    setRecommendations([]);
    setHasLoadedPersistedRun(false);
    setLastRunTimestamp(null);
    setTasteProfile('');
    setTasteProfileSummary('');
    setTasteDnaTags([]);
    setWatchlistIds([]);
    setActiveTrailerFilm(null);
    setIsShareDnaModalOpen(false);
    resetRssSync();
  }, [resetRssSync]);

  const applyCsvResult = useCallback((result: CsvDownloadResult) => {
    if (result.status === 'found') {
      const { totalWatchedCount } = deduplicateWatchlist(result.text, null);
      setHasSavedCsv(totalWatchedCount > 0);
      setUniqueMovieCount(totalWatchedCount);
      setVaultReadFailed(false);
    } else if (result.status === 'missing') {
      setHasSavedCsv(false);
      setUniqueMovieCount(null);
      setVaultReadFailed(false);
    } else {
      // Never present a failed download as "0 films"
      setVaultReadFailed(true);
      console.warn('Ratings read failed:', result.message);
      setErrorMessage('We couldn\'t load your film history right now. Please try again.');
    }
  }, []);

  // ===========================================================================
  // AUTH-FIRST INITIALIZER
  // 1. supabase.auth.getUser() fully resolves   (nothing else runs before it)
  // 2. registered handle is read
  // 3. ratings.csv is downloaded with every cache layer bypassed
  // 4. only then does phase become 'ready', which is what arms the RSS sync
  // Every await has a timeout and the effect is cancellation-safe, so the UI can
  // neither hang forever nor apply stale results from a previous run/account.
  // ===========================================================================
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const redirectToAuth = async (): Promise<void> => {
      // Drop any stale local session first, otherwise middleware would bounce /auth -> /dashboard
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* nothing to clear */
      }
      if (!cancelled) router.replace('/auth');
    };

    const init = async (): Promise<void> => {
      setPhase('authenticating');
      setInitError(null);
      setErrorMessage(null);

      // STEP 1: resolve the authenticated user COMPLETELY
      let currentUser: SupabaseUser | null = null;
      try {
        const { data, error } = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS, 'Authentication check');
        if (cancelled) return;
        if (error) {
          if (isSignedOutError(error)) {
            await redirectToAuth();
            return;
          }
          throw error;
        }
        currentUser = data.user;
      } catch (err: unknown) {
        if (cancelled) return;
        console.error('[Dashboard] auth check failed:', err);
        setInitError(errorText(err, 'Could not verify your session.'));
        setPhase('error');
        return;
      }

      if (!currentUser) {
        await redirectToAuth();
        return;
      }

      currentUserIdRef.current = currentUser.id;
      setUser(currentUser);
      setPhase('loading-vault');

      // STEP 2: registered Letterboxd handle (select('*') so a missing column cannot error the query)
      let handle = '';
      try {
        const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
        const profile: JsonRecord = isRecord(profileRow) ? profileRow : {};
        const metadata: JsonRecord = isRecord(currentUser.user_metadata) ? currentUser.user_metadata : {};
        handle = pickLetterboxdHandle(metadata.letterboxd_username, profile.letterboxd_username);
      } catch (err: unknown) {
        console.warn('[Dashboard] profile lookup failed, continuing without handle:', err);
      }
      if (cancelled) return;
      setProfileUsername(handle);

      // STEP 3: ratings.csv from Supabase Storage (no-store + cacheNonce)
      try {
        const result = await withTimeout(
          downloadRatingsCsv(supabase, currentUser.id, { signal: controller.signal }),
          STORAGE_TIMEOUT_MS,
          'Vault download'
        );
        if (cancelled) return;
        applyCsvResult(result);
      } catch (err: unknown) {
        if (cancelled) return;
        setVaultReadFailed(true);
        console.warn('Ratings read failed:', errorText(err, 'unknown error'));
        setErrorMessage('We couldn\'t load your film history right now. Please try again.');
      }

      // STEP 4: Fetch & Restore user's Cinematic DNA and last run from database & local state
      try {
        // Fast synchronous check from local cache
        const localDna = getLocalCinematicDna(currentUser.id);
        if (localDna) {
          if (localDna.tasteProfile || localDna.tasteProfileSummary) {
            const profileStr = localDna.tasteProfile || localDna.tasteProfileSummary;
            setTasteProfile(profileStr);
            setTasteProfileSummary(profileStr);
          }
          if (Array.isArray(localDna.tasteDnaTags) && localDna.tasteDnaTags.length > 0) {
            setTasteDnaTags(localDna.tasteDnaTags);
          }
          if (localDna.timestamp) setLastRunTimestamp(localDna.timestamp);
        }

        // Fetch latest saved Cinematic DNA directly from Supabase database
        const dbDna = await fetchCinematicDnaFromSupabase(supabase, currentUser);
        if (!cancelled && dbDna) {
          if (dbDna.tasteProfile || dbDna.tasteProfileSummary) {
            const profileStr = dbDna.tasteProfile || dbDna.tasteProfileSummary;
            setTasteProfile(profileStr);
            setTasteProfileSummary(profileStr);
          }
          if (Array.isArray(dbDna.tasteDnaTags) && dbDna.tasteDnaTags.length > 0) {
            setTasteDnaTags(dbDna.tasteDnaTags);
          }
          if (dbDna.timestamp) setLastRunTimestamp(dbDna.timestamp);
          if (typeof dbDna.watchedCount === 'number' && dbDna.watchedCount > 0) {
            setUniqueMovieCount((prev) => (prev !== null ? prev : (dbDna.watchedCount as number)));
          }
        }

        // Restore the last saved recommendation batch. Source of truth is the Supabase
        // `user_recommendations` table; the user-scoped local cache is only a fallback.
        const applyRestoredRun = (films: RecommendedFilm[], timestamp?: number): void => {
          setRecommendations(films);
          if (timestamp) setLastRunTimestamp(timestamp);
          // If no DNA tags were saved, derive them from the restored batch so the DNA card is never blank
          setTasteDnaTags((prev) => (prev.length > 0 ? prev : deriveDnaTags(films)));
        };

        let restoredFromDatabase = false;
        try {
          const { data: recRow, error: recError } = await supabase
            .from('user_recommendations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (recError) {
            console.warn('[Dashboard] user_recommendations lookup failed (is the table provisioned?):', recError.message);
          } else if (recRow && Array.isArray(recRow.films) && recRow.films.length > 0) {
            if (!cancelled) applyRestoredRun(recRow.films as RecommendedFilm[], recRow.timestamp ? Number(recRow.timestamp) : undefined);
            restoredFromDatabase = true;
          }
        } catch (recErr: unknown) {
          console.warn('[Dashboard] user_recommendations lookup threw:', recErr);
        }

        if (!restoredFromDatabase && !cancelled && typeof window !== 'undefined') {
          try {
            const rawSaved = localStorage.getItem(LAST_RUN_STORAGE_KEY(currentUser.id));
            if (rawSaved) {
              const parsed = JSON.parse(rawSaved) as PersistedEngineRun;
              if (parsed && Array.isArray(parsed.films) && parsed.films.length > 0) {
                applyRestoredRun(parsed.films, parsed.timestamp);
              }
            }
          } catch (cacheErr: unknown) {
            console.warn('[Dashboard] Could not read the local recommendation cache:', cacheErr);
          }
        }
      } catch (err: unknown) {
        console.warn('[Dashboard] Could not restore Cinematic DNA from database:', err);
      } finally {
        if (!cancelled) setHasLoadedPersistedRun(true);
      }

      // STEP 5: Restore Watchlist from local state & user metadata
      if (typeof window !== 'undefined') {
        const localW = getLocalWatchlist(currentUser.id);
        const metaW = currentUser.user_metadata?.watchlist;
        if (Array.isArray(metaW) && metaW.length > 0 && localW.length === 0) {
          saveLocalWatchlist(metaW, currentUser.id);
          setWatchlistIds(metaW.map((f: any) => f.id));
        } else {
          setWatchlistIds(localW.map((f) => f.id));
        }
      }

      if (!cancelled) setPhase('ready');
    };

    void init();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [supabase, router, authEpoch, applyCsvResult]);

  // Account switches / sign-outs that happen outside this component (other tab, expiry)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // NOTE: no awaited supabase calls in here (known auth-js deadlock); only schedule state changes.
      if (signingOutRef.current) return;

      if (event === 'SIGNED_OUT') {
        resetDashboardState();
        router.replace('/auth');
        return;
      }

      const knownId = currentUserIdRef.current;
      if (event === 'SIGNED_IN' && session?.user && knownId !== null && session.user.id !== knownId) {
        resetDashboardState();
        setAuthEpoch((n) => n + 1);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, resetDashboardState]);

  // After a sync that rewrote ratings.csv, re-read it so the sidebar mirrors Storage exactly
  useEffect(() => {
    if (phase !== 'ready' || !user || !rssLastSyncedAt || !rssWroteStorage) return;
    let cancelled = false;
    const userId = user.id;

    void (async () => {
      const result = await downloadRatingsCsv(supabase, userId);
      if (!cancelled && currentUserIdRef.current === userId) applyCsvResult(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, phase, user, rssLastSyncedAt, rssWroteStorage, applyCsvResult]);

  const retryInit = useCallback(() => {
    setErrorMessage(null);
    setAuthEpoch((n) => n + 1);
  }, []);

  // Derived unique count incorporating the live RSS merge result
  const displayWatchedCount = useMemo(() => {
    if (rssSyncedCount !== null && rssSyncedCount > 0) {
      return uniqueMovieCount !== null ? Math.max(uniqueMovieCount, rssSyncedCount) : rssSyncedCount;
    }
    return uniqueMovieCount;
  }, [uniqueMovieCount, rssSyncedCount]);

  // ===========================================================================
  // SIGN OUT: revoke first (needs the refresh token), THEN wipe everything.
  // Clearing storage before signOut() destroyed the token and left the auth
  // cookie behind, the root of the "logged out but not really" deadlock.
  // ===========================================================================
  const handleSignOut = async (): Promise<void> => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setIsSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) await supabase.auth.signOut({ scope: 'local' });
    } catch (err: unknown) {
      console.warn('[Dashboard] global sign-out failed, falling back to local:', err);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* session already gone */
      }
    }

    resetDashboardState();
    clearClientStorage();
    router.replace('/auth');
    router.refresh();
  };

  // ===========================================================================
  // RUN CULTCRATE AI ENGINE
  // ===========================================================================
  const handleRunCultCrateAI = async (): Promise<void> => {
    if (!user || isSynthesizing) return; // ignore double clicks while a run is in progress
    setIsSynthesizing(true);
    // Never leave the spinner running forever: give up cleanly if the engine does not answer in time.
    const requestController = new AbortController();
    const requestTimer = setTimeout(() => requestController.abort(), ENGINE_REQUEST_TIMEOUT_MS);
    setErrorMessage(null);
    setAiNotice(null);

    try {
      const preferenceTags = [
        ...selectedVibes,
        isFamilySafe ? 'Family-Friendly / No Extreme Content' : 'Unfiltered Arthouse',
        `Runtime Aperture: ${runtimeFilter}`,
      ];

      // ---- Watchlist exclusion array -------------------------------------------------
      // Titles saved in the Screening Watchlist (local cache + Supabase account metadata) are sent
      // to the engine as its exclusion list and are ALSO filtered out of the response below.
      const metaWatchlist: Array<{ title: string }> = Array.isArray(user.user_metadata?.watchlist)
        ? (user.user_metadata.watchlist as unknown[]).filter(isRecord).map((f) => ({ title: asText(f.title) }))
        : [];
      const exclusionTitles = collectExclusionTitles(getLocalWatchlist(user.id), metaWatchlist);
      const exclusionSet = buildExclusionSet(exclusionTitles);

      // Make sure ratings.csv is fresh BEFORE the engine reads it
      setLiveExecutionStep('Checking Letterboxd for new films...');
      await triggerSync();

      setLiveExecutionStep(
        exclusionTitles.length > 0
          ? `Learning your taste (skipping ${exclusionTitles.length} ${exclusionTitles.length === 1 ? 'film' : 'films'} on your watchlist)...`
          : 'Learning your taste...'
      );
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionToken = session?.access_token;

      const response = await fetch('/api/recommendations', {
        method: 'POST',
        cache: 'no-store',
        signal: requestController.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          username: profileUsername || undefined,
          obscurityLevel,
          preferences: preferenceTags,
          blacklisted_entities: exclusionTitles,
        }),
      });

      setLiveExecutionStep('Picking your films...');

      if (!response.ok) {
        const raw = await response.text().catch(() => '');
        let serverMessage = '';
        try {
          const parsed: unknown = JSON.parse(raw);
          if (isRecord(parsed)) serverMessage = firstText(parsed.error, parsed.message);
        } catch {
          /* not JSON: a platform error page, handled below */
        }
        throw new Error(failedResponseMessage(response.status, serverMessage, raw));
      }

      const data: unknown = await response.json().catch(() => null);
      if (!isRecord(data)) {
        throw new Error('Malformed or empty JSON payload returned by CultCrate AI.');
      }

      const dedupCount = Number(data.watchedDeduplicationCount);
      if (Number.isFinite(dedupCount) && dedupCount > 0) {
        setUniqueMovieCount(dedupCount);
      }

      const summary = firstText(data.taste_profile_summary, data.tasteProfileSummary, data.tasteProfile);

      const toFilms = (raw: unknown, isMasterpiece: boolean): RecommendedFilm[] =>
        Array.isArray(raw)
          ? raw.filter(isRecord).map((f, i) => mapRecommendedFilm(f, i, isMasterpiece))
          : [];

      const masterpiece = toFilms(data.masterpiece_cohort ?? data.masterpieceCohort, true);
      const excellent = toFilms(data.excellent_cohort ?? data.excellentCohort, false);
      const returned = [...masterpiece, ...excellent];

      // Hard guarantee: nothing already in the watchlist is ever re-recommended
      const combined = filterOutExcluded(returned, exclusionSet);
      const removedCount = returned.length - combined.length;

      if (combined.length === 0) {
        setErrorMessage(
          returned.length > 0
            ? 'Everything we found is already on your watchlist. Run it again for fresh picks.'
            : 'We couldn\'t find any picks this time. Please try again.'
        );
        setLiveExecutionStep(null);
        return;
      }

      const now = Date.now();
      const freshTasteProfile = summary || tasteProfile;
      const freshTasteSummary = summary || tasteProfileSummary;
      const apiTags = textList(data.tasteDnaTags);
      // Cinematic DNA metrics come from the batch the engine actually produced
      const freshTags = apiTags.length > 0 ? apiTags : deriveDnaTags(combined);

      setRecommendations(combined);
      setLastRunTimestamp(now);
      if (summary) {
        setTasteProfile(summary);
        setTasteProfileSummary(summary);
      }
      if (freshTags.length > 0) setTasteDnaTags(freshTags);

      // Persist Cinematic DNA to Supabase (account metadata + optional tables) and local cache
      const dnaRecord: CinematicDnaRecord = {
        userId: user.id,
        letterboxdHandle,
        tasteProfile: freshTasteProfile,
        tasteProfileSummary: freshTasteSummary,
        tasteDnaTags: freshTags,
        obscurityLevel,
        preferences: preferenceTags,
        watchedCount: dedupCount || uniqueMovieCount || undefined,
        timestamp: now,
        updatedAt: new Date(now).toISOString(),
      };
      void saveCinematicDnaToSupabase(supabase, dnaRecord);

      // Persist the batch to `user_recommendations` so it is restored on the next login / device
      try {
        const { error: recSaveError } = await supabase.from('user_recommendations').upsert(
          {
            user_id: user.id,
            films: combined,
            timestamp: now,
            updated_at: new Date(now).toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (recSaveError) {
          console.warn('[Dashboard] Could not save recommendations to Supabase (is `user_recommendations` provisioned?):', recSaveError.message);
        }
      } catch (dbRecErr: unknown) {
        console.warn('[Dashboard] Failed saving recommendations to Supabase table:', dbRecErr);
      }

      // Local cache so a reload restores this exact run even if the network is slow
      if (typeof window !== 'undefined') {
        try {
          const runPayload: PersistedEngineRun = {
            userId: user.id,
            timestamp: now,
            films: combined,
            tasteProfile: freshTasteProfile,
            tasteProfileSummary: freshTasteSummary,
            tasteDnaTags: freshTags,
            obscurityLevel,
            preferences: preferenceTags,
            watchedCount: dedupCount || uniqueMovieCount || undefined,
          };
          localStorage.setItem(LAST_RUN_STORAGE_KEY(user.id), JSON.stringify(runPayload));
        } catch (storageErr: unknown) {
          console.warn('[Dashboard] Failed to persist engine run to local state:', storageErr);
        }
      }

      setAiNotice(
        `Found ${combined.length} ${combined.length === 1 ? 'pick' : 'picks'} for you, @${letterboxdHandle}` +
          (removedCount > 0 ? ` (${removedCount} already on your watchlist ${removedCount === 1 ? 'was' : 'were'} skipped)` : '') +
          '.'
      );
      setLiveExecutionStep(null);
    } catch (err: unknown) {
      console.error('Synthesis error:', err);
      setErrorMessage(friendlyEngineError(err));
      setLiveExecutionStep(null);
    } finally {
      clearTimeout(requestTimer);
      setIsSynthesizing(false);
    }
  };

  // Single, unified flat list of recommendation cards sorted by user preference
  const displayedFilms = useMemo(() => {
    const list: RecommendedFilm[] = Array.isArray(recommendations) ? [...recommendations] : [];

    const num = (v: unknown): number => {
      const n = parseFloat(String(v ?? '0'));
      return Number.isFinite(n) ? n : 0;
    };

    if (sortBy === 'affinity') {
      list.sort((a, b) => num(b.matchScore) - num(a.matchScore));
    } else if (sortBy === 'year') {
      list.sort((a, b) => num(b.year) - num(a.year));
    } else {
      list.sort((a, b) => num(b.letterboxdRating) - num(a.letterboxdRating));
    }

    return list;
  }, [recommendations, sortBy]);

  // Dynamic Cinematic DNA description derived from the user's real data & engine synthesis
  const dynamicDnaDescription = useMemo(() => {
    if (tasteProfile && tasteProfile.trim().length > 0) {
      return tasteProfile;
    }
    if (tasteProfileSummary && tasteProfileSummary.trim().length > 0) {
      return tasteProfileSummary;
    }

    const watchedDescriptor =
      displayWatchedCount !== null && displayWatchedCount > 0
        ? `${displayWatchedCount.toLocaleString()} films logged`
        : hasSavedCsv
        ? 'your Letterboxd diary is connected'
        : 'connect your Letterboxd to get started';

    return `@${letterboxdHandle}: ${watchedDescriptor}. Tap Run AI Engine and we'll turn your film history into a taste profile and a fresh set of picks.`;
  }, [
    tasteProfile,
    tasteProfileSummary,
    displayWatchedCount,
    hasSavedCsv,
    letterboxdHandle,
    selectedVibes.length,
  ]);

  // Clean, readable vector/tag chips based on real user data
  const dynamicVectorChips = useMemo(() => {
    const chips: { label: string; isHighlighted?: boolean }[] = [];

    // User profile handle
    if (letterboxdHandle) {
      chips.push({ label: `@${letterboxdHandle}`, isHighlighted: true });
    }

    // Cataloged film count
    if (displayWatchedCount !== null && displayWatchedCount > 0) {
      chips.push({ label: `${displayWatchedCount.toLocaleString()} films logged` });
    }

    // Active selected vibes
    selectedVibes.forEach((v) => {
      const cleaned = v.replace(/^[\p{Emoji}\s]+/u, '').trim();
      if (cleaned) chips.push({ label: cleaned });
    });

    // Content safety mode
    chips.push({ label: isFamilySafe ? 'Family-friendly' : 'No content limits' });

    // Runtime aperture
    if (runtimeFilter !== 'any') {
      chips.push({ label: runtimeFilter === '<90' ? 'Under 90 min' : runtimeFilter === '<=120' ? 'Up to 2 hours' : 'Long films (140+ min)' });
    }

    // Dynamic AI tags from user's engine synthesis
    if (Array.isArray(tasteDnaTags)) {
      tasteDnaTags.forEach((t) => {
        const cleanTag = t.trim().replace(/^#/, '');
        if (cleanTag && !chips.some((c) => c.label.toLowerCase() === cleanTag.toLowerCase())) {
          chips.push({ label: cleanTag });
        }
      });
    }

    return chips;
  }, [
    letterboxdHandle,
    displayWatchedCount,
    selectedVibes,
    isFamilySafe,
    runtimeFilter,
    tasteDnaTags,
  ]);

  // Cross-tab and cross-page Watchlist synchronization listener
  useEffect(() => {
    const handleWatchlistSync = () => {
      const current = getLocalWatchlist(user?.id);
      setWatchlistIds(current.map((f) => f.id));
    };

    window.addEventListener('cultcrate_watchlist_updated', handleWatchlistSync);
    window.addEventListener('storage', handleWatchlistSync);

    return () => {
      window.removeEventListener('cultcrate_watchlist_updated', handleWatchlistSync);
      window.removeEventListener('storage', handleWatchlistSync);
    };
  }, [user?.id]);

  // Real-time Cinematic DNA synchronization listener across tabs/windows
  useEffect(() => {
    const handleDnaSync = (e: Event) => {
      const rec = (e as CustomEvent)?.detail?.record as CinematicDnaRecord | undefined;
      if (rec && (!user?.id || rec.userId === user.id)) {
        if (rec.tasteProfile) setTasteProfile(rec.tasteProfile);
        if (rec.tasteProfileSummary) setTasteProfileSummary(rec.tasteProfileSummary);
        if (Array.isArray(rec.tasteDnaTags) && rec.tasteDnaTags.length > 0) setTasteDnaTags(rec.tasteDnaTags);
        if (rec.timestamp) setLastRunTimestamp(rec.timestamp);
      }
    };

    window.addEventListener('cultcrate_dna_updated', handleDnaSync);
    return () => {
      window.removeEventListener('cultcrate_dna_updated', handleDnaSync);
    };
  }, [user?.id]);

  // Real-time Letterboxd profile / username update synchronization
  useEffect(() => {
    const handleProfileSync = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail.letterboxd_username === 'string' && detail.letterboxd_username.trim()) {
        const newHandle = detail.letterboxd_username.trim();
        setProfileUsername(newHandle);
        if (typeof detail.family_safe_mode === 'boolean') {
          setIsFamilySafe(detail.family_safe_mode);
        }
        // Immediately sync the fresh Letterboxd feed & update dashboard telemetry
        void triggerSync(newHandle);
      }
    };

    window.addEventListener('cultcrate_profile_updated', handleProfileSync);
    return () => {
      window.removeEventListener('cultcrate_profile_updated', handleProfileSync);
    };
  }, [triggerSync]);

  const toggleWatchlist = useCallback(
    (id: string, filmData?: RecommendedFilm): void => {
      const currentList = getLocalWatchlist(user?.id);
      const exists = currentList.some((f) => f.id === id);
      let updated: WatchlistFilm[];
      if (exists) {
        updated = currentList.filter((f) => f.id !== id);
      } else {
        const toAdd: WatchlistFilm =
          filmData ||
          displayedFilms.find((f) => f.id === id) || {
            id,
            title: id,
            year: 2024,
            runtime: '112 min',
            country: 'Global',
            director: 'Auteur',
            imdbRating: '7.8',
            letterboxdRating: '4.0',
            matchScore: '98%',
            obscurityBadge: 'Vault Curated',
            streamingPlatforms: [],
            synopsis: '',
            curatorialReason: '',
            savedAt: Date.now(),
          };
        updated = [{ ...toAdd, savedAt: Date.now() }, ...currentList];
      }

      saveLocalWatchlist(updated, user?.id);
      setWatchlistIds(updated.map((f) => f.id));

      if (user) {
        void syncWatchlistToSupabase(supabase, updated);
      }
    },
    [user, supabase, displayedFilms]
  );

  // Could not even verify the session (network / timeout): offer a retry instead of a dead end
  if (phase === 'error' && !user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#090D16] p-5 font-sans text-white">
        <div className="flex max-w-sm flex-col items-center gap-5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E50914]/40 bg-[#E50914]/10">
            <AlertTriangle className="h-6 w-6 text-[#E50914]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold tracking-tight">We couldn&apos;t sign you in</h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              {initError ? 'Check your connection and try again.' : 'Something went wrong. Please try again.'}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={retryInit}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#E50914] px-5 py-3 text-sm font-semibold transition-colors hover:bg-[#B80710]"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try again</span>
            </button>
            <Link
              href="/auth"
              className="flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm text-zinc-300 transition-colors hover:text-white"
            >
              Sign in again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#090D16] p-5 font-sans text-white">
        <div className="flex max-w-sm flex-col items-center gap-5 text-center">
          <div className="relative flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-[#E50914] shadow-[0_0_35px_rgba(229,9,20,0.6)]">
            <Film className="h-6 w-6 text-white" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold tracking-tight text-white">Getting things ready...</h3>
            <p className="text-sm text-zinc-400">Loading your films and picks</p>
          </div>
          <div className="mt-1 h-1 w-48 overflow-hidden rounded-full border border-white/[0.06] bg-[#121620]">
            <div className="h-full w-full animate-pulse rounded-full bg-[#E50914]" />
          </div>
        </div>
      </div>
    );
  }

  const isRestoring = fetchingStatus || !hasLoadedPersistedRun;
  const vaultSynced = hasSavedCsv || (rssSyncedCount !== null && rssSyncedCount > 0);
  const lastRunLabel = lastRunTimestamp
    ? new Date(lastRunTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const friendlyError = friendlyMessage(errorMessage);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#090D16] pb-24 font-sans text-[#F9FAFB] selection:bg-[#E50914] selection:text-white">
      {/* Ambient lighting */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(229,9,20,0.15),transparent)]" />
      <div className="pointer-events-none fixed bottom-0 right-0 -z-10 h-[380px] w-full max-w-[560px] bg-[radial-gradient(closest-side,rgba(78,222,174,0.07),transparent)]" />

      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#090D16]/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-90 active:scale-95"
          title="CultCrate home"
        >
          <span className="select-none text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Cult<span className="text-[#E50914]">Crate</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/watchlist"
            className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-medium text-zinc-300 transition-all hover:border-[#4EDEAE]/50 hover:bg-white/[0.06] hover:text-white active:scale-95"
            title="Your watchlist"
            aria-label="Your watchlist"
          >
            <Bookmark className="h-4 w-4 fill-[#4EDEAE]/30 text-[#4EDEAE]" />
            <span className="hidden sm:inline">Watchlist</span>
            {watchlistIds.length > 0 && (
              <span className="rounded-full bg-[#4EDEAE]/15 px-1.5 text-[10px] font-bold leading-4 text-[#4EDEAE]">
                {watchlistIds.length}
              </span>
            )}
          </Link>

          <UserNavMenu
            letterboxdHandle={letterboxdHandle}
            userEmail={userEmail}
            userId={user?.id}
            isAuthenticated={Boolean(user)}
            watchlistCount={watchlistIds.length}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
            onProfileUpdated={(newHandle) => {
              setProfileUsername(newHandle);
              void triggerSync(newHandle);
            }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 pt-6 sm:space-y-6 sm:px-6 sm:pt-8 lg:px-8">
        {/* ===================== 1. CINEMATIC DNA ===================== */}
        <section className={`${PANEL_CLASS} overflow-hidden p-5 sm:p-7`}>
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#E50914]/[0.10] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-[#4EDEAE]/[0.06] blur-3xl" />

          <div className="relative space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E50914]/30 bg-[#E50914]/10 shadow-[0_0_20px_-6px_rgba(229,9,20,0.6)]">
                  <Dna className="h-5 w-5 text-[#E50914]" />
                </div>
                <div className="min-w-0 leading-tight">
                  <Eyebrow>Your Cinematic DNA</Eyebrow>
                  <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                    @{letterboxdHandle}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {lastRunTimestamp && (
                  <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1 text-[11px] text-zinc-400 sm:flex">
                    <Clock className="h-3 w-3 text-[#E50914]" />
                    <span>Updated {lastRunLabel}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsShareDnaModalOpen(true)}
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E50914]/40 bg-[#E50914]/10 px-3 text-xs font-semibold text-[#ff4d56] transition-all hover:bg-[#E50914] hover:text-white active:scale-95"
                  title="Share your Cinematic DNA"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            <p className="text-[15px] leading-relaxed text-zinc-200">{dynamicDnaDescription}</p>

            <div className="flex flex-wrap gap-1.5">
              {dynamicVectorChips.map((chip, idx) => (
                <span
                  key={`${chip.label}-${idx}`}
                  className={`flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                    chip.isHighlighted
                      ? 'border border-[#E50914]/40 bg-[#E50914]/10 text-[#ff4d56]'
                      : 'border border-white/[0.07] bg-black/30 text-zinc-300'
                  }`}
                >
                  <span className="truncate">{chip.label}</span>
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-5 sm:grid-cols-4">
              <StatTile
                label="Films logged"
                loading={fetchingStatus}
                value={displayWatchedCount !== null && displayWatchedCount !== undefined ? displayWatchedCount.toLocaleString() : '—'}
              />
              <StatTile label="Current picks" tone="green" loading={isRestoring} value={displayedFilms.length} />
              <StatTile label="On your watchlist" tone="red" value={watchlistIds.length} />
              <StatTile label="Last updated" value={lastRunLabel} />
            </div>
          </div>
        </section>

        {/* ===================== 2. RUN AI ENGINE ===================== */}
        <button
          type="button"
          onClick={handleRunCultCrateAI}
          disabled={isSynthesizing || fetchingStatus}
          className="group relative flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-b from-[#F40612] to-[#C20710] px-5 py-4 text-base font-bold tracking-wide text-white shadow-[0_0_40px_-6px_rgba(229,9,20,0.65),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-200 hover:shadow-[0_0_56px_-4px_rgba(229,9,20,0.9)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
        >
          {isSynthesizing ? (
            <span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold sm:text-base">
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
              <span className="truncate">{liveExecutionStep || 'Finding your next watch...'}</span>
            </span>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              <span>Run AI Engine</span>
            </>
          )}
        </button>

        {/* ===================== 3. LETTERBOXD SYNC BAR ===================== */}
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#0d111a]/70 px-3.5 py-2.5 backdrop-blur-xl"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                rssError ? 'bg-[#F59E0B]' : vaultSynced ? 'bg-[#4EDEAE]' : 'bg-zinc-600'
              } ${isSyncingRss || fetchingStatus ? 'animate-pulse' : ''}`}
            />
            <p className="min-w-0 truncate text-xs text-zinc-300 sm:text-[13px]">
              {fetchingStatus ? (
                'Checking your Letterboxd...'
              ) : isSyncingRss ? (
                'Syncing your Letterboxd diary...'
              ) : rssError ? (
                <span className="text-[#F59E0B]">Couldn&apos;t sync just now. Tap Sync to retry.</span>
              ) : vaultSynced ? (
                <>
                  <span className="font-semibold text-white">Letterboxd synced</span>
                  {displayWatchedCount !== null && displayWatchedCount !== undefined && (
                    <span className="text-zinc-400"> · {displayWatchedCount.toLocaleString()} films</span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-zinc-400">Not synced yet.</span>{' '}
                  <Link href="/settings" className="text-[#ff4d56] underline-offset-2 hover:underline">
                    Upload your ratings
                  </Link>
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void triggerSync()}
            disabled={isSyncingRss || fetchingStatus}
            className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-medium text-[#4EDEAE] transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncingRss ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

        {/* ===================== 4. RECOMMENDATIONS ===================== */}
        <section className="space-y-5 pt-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E50914]/30 bg-[#E50914]/10 shadow-[0_0_20px_-6px_rgba(229,9,20,0.6)]">
                <Film className="h-5 w-5 text-[#E50914]" />
              </div>
              <div className="leading-tight">
                <Eyebrow>Made for you</Eyebrow>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-white">Your recommendations</h2>
                  {displayedFilms.length > 0 && (
                    <span className="rounded-full border border-[#4EDEAE]/30 bg-[#4EDEAE]/10 px-2 py-0.5 text-[10px] font-semibold text-[#4EDEAE]">
                      {displayedFilms.length} {displayedFilms.length === 1 ? 'film' : 'films'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {displayedFilms.length > 1 && (
              <label className="flex items-center gap-2 text-xs">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'affinity' | 'year' | 'rating')}
                  className="h-9 cursor-pointer rounded-lg border border-white/[0.08] bg-[#0d111a] px-3 text-xs text-white focus:border-[#E50914] focus:outline-none"
                >
                  <option value="affinity">Best match</option>
                  <option value="year">Newest</option>
                  <option value="rating">Top rated</option>
                </select>
              </label>
            )}
          </div>

          {/* Friendly error */}
          {friendlyError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-[#E50914]/40 bg-[#1a080a]/90 p-4 text-red-100 shadow-[0_0_40px_-12px_rgba(229,9,20,0.5)]"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E50914]/20">
                <XCircle className="h-5 w-5 text-[#ff4d56]" />
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-white">That didn&apos;t work</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-red-200/90">{friendlyError}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={vaultReadFailed ? retryInit : handleRunCultCrateAI}
                    disabled={isSynthesizing}
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#E50914] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#B80710] disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Try again</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="flex h-9 cursor-pointer items-center rounded-lg border border-white/[0.1] bg-black/40 px-3.5 text-xs text-red-200 transition-colors hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="shrink-0 cursor-pointer rounded-lg p-1.5 text-red-300 transition-colors hover:text-white"
                aria-label="Dismiss message"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* Success notice */}
          {aiNotice && !friendlyError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#4EDEAE]/35 bg-[#4EDEAE]/[0.07] px-4 py-3 text-sm text-emerald-100"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4EDEAE]" />
                <span className="min-w-0">{aiNotice}</span>
              </div>
              <button
                onClick={() => setAiNotice(null)}
                className="shrink-0 cursor-pointer text-emerald-300 transition-colors hover:text-white"
                aria-label="Dismiss message"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* Working */}
          {isSynthesizing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative space-y-5 overflow-hidden rounded-2xl border border-[#E50914]/30 bg-gradient-to-b from-[#121620] to-[#090D16] p-8 text-center shadow-[0_0_60px_-20px_rgba(229,9,20,0.5)] sm:p-10"
            >
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full border-2 border-dashed border-[#E50914]/60" />
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E50914] shadow-[0_0_28px_#E50914]">
                  <Film className="h-4 w-4 animate-pulse text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <Eyebrow>Working on it</Eyebrow>
                <h3 className="text-xl font-semibold tracking-tight text-white">Finding films you&apos;ll love</h3>
                <p className="mx-auto max-w-md text-sm leading-relaxed text-zinc-400">
                  {liveExecutionStep || 'Looking through your history to find hidden gems.'}
                </p>
              </div>
            </motion.div>
          )}

          {/* Loading saved picks */}
          {!isSynthesizing && isRestoring && displayedFilms.length === 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FilmCardSkeleton />
              <FilmCardSkeleton />
            </div>
          )}

          {/* Cards or empty state */}
          {!isSynthesizing && (!isRestoring || displayedFilms.length > 0) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {displayedFilms.length > 0 ? (
                displayedFilms.map((film) => (
                  <MovieCard
                    key={film.id}
                    movie={{
                      title: film.title,
                      year: film.year,
                      rating: film.letterboxdRating || film.imdbRating,
                      genre: Array.isArray(film.genre) ? film.genre.join(' • ') : film.genre || 'Cult cinema',
                      reason: film.curatorialReason || film.synopsis,
                    }}
                    film={film}
                    isWatchlisted={watchlistIds.includes(film.id)}
                    onToggleWatchlist={toggleWatchlist}
                    onWatchTrailer={(f) => setActiveTrailerFilm(f)}
                  />
                ))
              ) : (
                <div className="relative col-span-full space-y-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#10141e] to-[#090D16] p-8 text-center shadow-2xl sm:p-12">
                  <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2 rounded-full bg-[#E50914]/[0.10] blur-3xl" />
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E50914]/30 bg-[#E50914]/10 shadow-[0_0_36px_-6px_rgba(229,9,20,0.5)]">
                    <Sparkles className="h-8 w-8 text-[#E50914]" />
                  </div>
                  <div className="relative mx-auto max-w-md space-y-2">
                    <h3 className="text-xl font-semibold tracking-tight text-white">No picks yet</h3>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      Tap <span className="font-semibold text-white">Run AI Engine</span> and we&apos;ll find films you haven&apos;t seen. Your picks are saved here for next time.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Trailer modal */}
      <AnimatePresence>
        {activeTrailerFilm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveTrailerFilm(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 15 }}
              className="cc-modal-scroll cc-safe-bottom relative z-10 w-full max-w-2xl rounded-t-2xl border border-white/[0.08] bg-[#0d111a] p-5 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_60px_rgba(229,9,20,0.2)] sm:rounded-2xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
                <div className="min-w-0">
                  <Eyebrow>Trailer</Eyebrow>
                  <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
                    {activeTrailerFilm.title} ({activeTrailerFilm.year})
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Directed by {activeTrailerFilm.director} · {activeTrailerFilm.runtime}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTrailerFilm(null)}
                  className="shrink-0 cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-zinc-400 transition-colors hover:text-white"
                  aria-label="Close trailer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="relative mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-neutral-900 via-zinc-950 to-black">
                <div className="relative z-10 flex flex-col items-center gap-3 p-6 text-center">
                  <a
                    href={activeTrailerFilm.trailerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E50914] text-white shadow-[0_0_32px_rgba(229,9,20,0.7)] transition-transform hover:scale-110 hover:bg-[#B80710] active:scale-95"
                    aria-label="Watch trailer on YouTube"
                  >
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </a>
                  <span className="block text-sm font-semibold text-white">Watch on YouTube</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end border-t border-white/[0.06] pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTrailerFilm(null)}
                  className="h-10 w-full cursor-pointer rounded-lg bg-white/[0.06] px-5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.1] sm:w-auto"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shareable Cinematic DNA card */}
      <ShareCinematicDnaModal
        isOpen={isShareDnaModalOpen}
        onClose={() => setIsShareDnaModalOpen(false)}
        letterboxdHandle={letterboxdHandle}
        userEmail={userEmail}
        dynamicDnaDescription={dynamicDnaDescription}
        dynamicVectorChips={dynamicVectorChips}
        displayWatchedCount={displayWatchedCount}
        lastRunTimestamp={lastRunTimestamp}
      />
    </div>
  );
}
