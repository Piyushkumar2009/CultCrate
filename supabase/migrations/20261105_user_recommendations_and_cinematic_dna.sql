-- ==============================================================================
-- CultCrate: persistence tables for the dashboard
--   * user_recommendations : the user's last generated recommendation batch
--   * cinematic_dna        : the user's last generated Cinematic DNA
--
-- ADDITIVE ONLY. Both statements use CREATE TABLE IF NOT EXISTS, so if you already created
-- these tables in your Supabase project nothing is changed or dropped. No existing table is altered.
-- Columns match exactly what the app already reads and writes.
-- Run in the Supabase SQL editor.
-- ==============================================================================

-- 1. Last recommendation batch (one row per user; the app upserts with onConflict = user_id) --------
CREATE TABLE IF NOT EXISTS public.user_recommendations (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    films      JSONB NOT NULL DEFAULT '[]'::jsonb,
    "timestamp" BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_recommendations: read own" ON public.user_recommendations;
CREATE POLICY "user_recommendations: read own"
    ON public.user_recommendations FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_recommendations: insert own" ON public.user_recommendations;
CREATE POLICY "user_recommendations: insert own"
    ON public.user_recommendations FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_recommendations: update own" ON public.user_recommendations;
CREATE POLICY "user_recommendations: update own"
    ON public.user_recommendations FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_recommendations: delete own" ON public.user_recommendations;
CREATE POLICY "user_recommendations: delete own"
    ON public.user_recommendations FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 2. Last Cinematic DNA (one row per user) -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cinematic_dna (
    user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    letterboxd_handle     TEXT,
    taste_profile         TEXT,
    taste_profile_summary TEXT,
    taste_dna_tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
    obscurity_level       INTEGER,
    preferences           JSONB NOT NULL DEFAULT '[]'::jsonb,
    watched_count         INTEGER,
    "timestamp"           BIGINT,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.cinematic_dna ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cinematic_dna: read own" ON public.cinematic_dna;
CREATE POLICY "cinematic_dna: read own"
    ON public.cinematic_dna FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cinematic_dna: insert own" ON public.cinematic_dna;
CREATE POLICY "cinematic_dna: insert own"
    ON public.cinematic_dna FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cinematic_dna: update own" ON public.cinematic_dna;
CREATE POLICY "cinematic_dna: update own"
    ON public.cinematic_dna FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cinematic_dna: delete own" ON public.cinematic_dna;
CREATE POLICY "cinematic_dna: delete own"
    ON public.cinematic_dna FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
