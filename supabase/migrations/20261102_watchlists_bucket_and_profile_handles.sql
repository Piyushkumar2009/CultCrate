-- ==============================================================================
-- CultCrate: `watchlists` bucket (ratings.csv) + Letterboxd handle columns
-- Idempotent. Run in the Supabase SQL editor.
--
-- Why: the app reads/writes  watchlists/<user_id>/ratings.csv  (Dashboard, Settings,
-- /api/sync-rss, /api/recommendations) but the original migration only provisioned the
-- `user_watchlists` bucket. Without storage policies on `watchlists`, downloads come
-- back as "Object not found" under RLS, which surfaced as "No Watchlist Found / 0 films".
-- ==============================================================================

-- 1. Private bucket -----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'watchlists',
    'watchlists',
    false,
    10485760, -- 10 MB
    ARRAY['text/csv', 'text/plain', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['text/csv', 'text/plain', 'application/vnd.ms-excel'];

-- 2. Per-user RLS: a user may only touch objects under  <their uid>/  ---------------
-- upsert:true needs INSERT + UPDATE (+ SELECT), so all four policies are created.
DROP POLICY IF EXISTS "watchlists: read own" ON storage.objects;
CREATE POLICY "watchlists: read own"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'watchlists' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "watchlists: insert own" ON storage.objects;
CREATE POLICY "watchlists: insert own"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'watchlists' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "watchlists: update own" ON storage.objects;
CREATE POLICY "watchlists: update own"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'watchlists' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'watchlists' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "watchlists: delete own" ON storage.objects;
CREATE POLICY "watchlists: delete own"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'watchlists' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Letterboxd handle columns on profiles --------------------------------------------
-- The app queries profiles.letterboxd_username, but the table never had it, so the query
-- errored silently and the code fell back to guessing a handle from the e-mail address.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS letterboxd_username TEXT,
    ADD COLUMN IF NOT EXISTS letterboxd_rss_url  TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_letterboxd_username_format;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_letterboxd_username_format
    CHECK (letterboxd_username IS NULL OR letterboxd_username ~ '^[A-Za-z0-9_-]{1,40}$');

-- Backfill from the handle captured at sign-up (auth user metadata), valid values only
UPDATE public.profiles p
SET    letterboxd_username = u.raw_user_meta_data ->> 'letterboxd_username'
FROM   auth.users u
WHERE  u.id = p.id
  AND  p.letterboxd_username IS NULL
  AND  (u.raw_user_meta_data ->> 'letterboxd_username') ~ '^[A-Za-z0-9_-]{1,40}$';
