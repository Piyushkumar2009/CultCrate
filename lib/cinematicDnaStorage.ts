import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';

export interface CinematicDnaRecord {
  userId: string;
  letterboxdHandle: string;
  tasteProfile: string;
  tasteProfileSummary: string;
  tasteDnaTags: string[];
  obscurityLevel: number;
  preferences: string[];
  watchedCount?: number;
  timestamp: number;
  updatedAt: string;
}

const LOCAL_STORAGE_DNA_KEY = (userId: string): string => `cultcrate_cinematic_dna_${userId}`;

/**
 * Reads local cached Cinematic DNA for instant initial render before network request resolves.
 */
export function getLocalCinematicDna(userId?: string | null): CinematicDnaRecord | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DNA_KEY(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.tasteProfile === 'string' ? (parsed as CinematicDnaRecord) : null;
  } catch (err) {
    console.warn('[CinematicDna] Failed reading local DNA cache:', err);
    return null;
  }
}

/**
 * Saves Cinematic DNA to local cache and emits real-time window update event.
 */
export function saveLocalCinematicDna(record: CinematicDnaRecord): void {
  if (typeof window === 'undefined' || !record.userId) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_DNA_KEY(record.userId), JSON.stringify(record));
    window.dispatchEvent(
      new CustomEvent('cultcrate_dna_updated', {
        detail: { record },
      })
    );
  } catch (err) {
    console.warn('[CinematicDna] Failed saving local DNA cache:', err);
  }
}

/**
 * Fetches the user's latest saved Cinematic DNA directly from the Supabase database.
 * Checks multiple levels:
 * 1. Supabase `profiles` table column `cinematic_dna`
 * 2. Supabase `cinematic_dna` dedicated table (if provisioned)
 * 3. Authenticated user profile metadata (`raw_user_meta_data.cinematic_dna`)
 * 4. Fallback to cached local state
 */
export async function fetchCinematicDnaFromSupabase(
  supabase: SupabaseClient,
  currentUser: SupabaseUser
): Promise<CinematicDnaRecord | null> {
  const userId = currentUser.id;

  // 1. Check profiles table in Supabase database
  try {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileRow && profileRow.cinematic_dna) {
      const dna = profileRow.cinematic_dna as CinematicDnaRecord;
      if (dna && (dna.tasteProfile || dna.tasteProfileSummary)) {
        saveLocalCinematicDna(dna);
        return dna;
      }
    }
  } catch (err) {
    // profiles table or column might not have cinematic_dna column, proceed to next source
    console.warn('[CinematicDna] profiles lookup note:', err);
  }

  // 2. Check dedicated cinematic_dna table if present
  try {
    const { data: dnaRow } = await supabase
      .from('cinematic_dna')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dnaRow && (dnaRow.taste_profile || dnaRow.taste_profile_summary)) {
      const record: CinematicDnaRecord = {
        userId,
        letterboxdHandle: dnaRow.letterboxd_handle || currentUser.user_metadata?.letterboxd_username || '',
        tasteProfile: dnaRow.taste_profile || dnaRow.taste_profile_summary || '',
        tasteProfileSummary: dnaRow.taste_profile_summary || dnaRow.taste_profile || '',
        tasteDnaTags: Array.isArray(dnaRow.taste_dna_tags) ? dnaRow.taste_dna_tags : [],
        obscurityLevel: typeof dnaRow.obscurity_level === 'number' ? dnaRow.obscurity_level : 4,
        preferences: Array.isArray(dnaRow.preferences) ? dnaRow.preferences : [],
        watchedCount: typeof dnaRow.watched_count === 'number' ? dnaRow.watched_count : undefined,
        timestamp: dnaRow.timestamp || Date.now(),
        updatedAt: dnaRow.updated_at || new Date().toISOString(),
      };
      saveLocalCinematicDna(record);
      return record;
    }
  } catch {
    // optional table
  }

  // 3. Check Supabase authenticated user metadata (raw_user_meta_data.cinematic_dna)
  const metaDna = currentUser.user_metadata?.cinematic_dna as CinematicDnaRecord | undefined;
  if (metaDna && (metaDna.tasteProfile || metaDna.tasteProfileSummary)) {
    saveLocalCinematicDna(metaDna);
    return metaDna;
  }

  // 4. Fallback to local storage if available
  return getLocalCinematicDna(userId);
}

/**
 * Persists and overwrites the user's Cinematic DNA record directly in the Supabase database.
 * Saves to:
 * 1. Supabase User Profile Metadata (`auth.users.raw_user_meta_data.cinematic_dna`)
 * 2. Supabase `profiles` table (if available)
 * 3. Supabase `cinematic_dna` table (if available)
 * 4. Local storage cache and emits window event
 */
export async function saveCinematicDnaToSupabase(
  supabase: SupabaseClient,
  record: CinematicDnaRecord
): Promise<void> {
  // 1. Immediately cache locally & emit event so UI updates instantly
  saveLocalCinematicDna(record);

  // 2. Persist to Supabase Auth User Metadata (associated directly with the user session)
  try {
    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        cinematic_dna: record,
      },
    });
    if (metaError) console.warn('[CinematicDna] auth.updateUser metadata write failed:', metaError.message);
  } catch (err) {
    console.warn('[CinematicDna] auth.updateUser metadata write warning:', err);
  }

  // 3. Attempt to update `profiles` table in Supabase database
  try {
    await supabase
      .from('profiles')
      .update({
        cinematic_dna: record,
        updated_at: record.updatedAt,
      })
      .eq('id', record.userId);
  } catch (err) {
    console.warn('[CinematicDna] profiles table update note:', err);
  }

  // 4. Attempt to upsert to dedicated `cinematic_dna` table if it exists
  try {
    const { error: tableError } = await supabase.from('cinematic_dna').upsert(
      {
        user_id: record.userId,
        letterboxd_handle: record.letterboxdHandle,
        taste_profile: record.tasteProfile,
        taste_profile_summary: record.tasteProfileSummary,
        taste_dna_tags: record.tasteDnaTags,
        obscurity_level: record.obscurityLevel,
        preferences: record.preferences,
        watched_count: record.watchedCount,
        timestamp: record.timestamp,
        updated_at: record.updatedAt,
      },
      { onConflict: 'user_id' }
    );
    if (tableError) {
      console.warn('[CinematicDna] cinematic_dna table write failed (run the 20261105 migration):', tableError.message);
    }
  } catch {
    // optional table
  }
}
