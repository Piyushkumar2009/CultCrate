-- ==============================================================================
-- CultCrate: Admin platform controls
--   * site_announcements     : the sitewide banner managed from /admin
--   * letterboxd_sync_status : latest RSS sync result per curator (powers the Sync Monitor)
--
-- ADDITIVE ONLY. Nothing existing is altered or dropped. Safe to re-run.
-- Run in the Supabase SQL editor.
-- ==============================================================================

-- 1. Announcement banner ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_announcements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message      TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 280),
    tone         TEXT NOT NULL DEFAULT 'info' CHECK (tone IN ('info', 'success', 'warning', 'critical')),
    link_url     TEXT,
    link_label   TEXT,
    dismissible  BOOLEAN NOT NULL DEFAULT TRUE,
    is_active    BOOLEAN NOT NULL DEFAULT FALSE,
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- At most ONE banner can be live at a time (the admin API switches the old one off first).
CREATE UNIQUE INDEX IF NOT EXISTS site_announcements_one_active
    ON public.site_announcements ((TRUE)) WHERE is_active;

ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

-- Everyone (even signed-out visitors) may READ the live banner. Nobody can write through the public API:
-- there are deliberately no INSERT/UPDATE/DELETE policies. Only the server's service-role key can write.
DROP POLICY IF EXISTS "site_announcements: public read active" ON public.site_announcements;
CREATE POLICY "site_announcements: public read active"
    ON public.site_announcements FOR SELECT TO anon, authenticated
    USING (is_active);

-- 2. Letterboxd sync health ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.letterboxd_sync_status (
    user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('success', 'failed', 'pending')),
    message              TEXT,
    films_synced         INTEGER,
    last_attempt_at      TIMESTAMP WITH TIME ZONE,
    last_success_at      TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.letterboxd_sync_status ENABLE ROW LEVEL SECURITY;

-- A curator's own sync route records their own result (the route runs with THEIR session).
-- Admins read every row through the service-role key, which bypasses RLS.
DROP POLICY IF EXISTS "letterboxd_sync_status: read own" ON public.letterboxd_sync_status;
CREATE POLICY "letterboxd_sync_status: read own"
    ON public.letterboxd_sync_status FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "letterboxd_sync_status: insert own" ON public.letterboxd_sync_status;
CREATE POLICY "letterboxd_sync_status: insert own"
    ON public.letterboxd_sync_status FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "letterboxd_sync_status: update own" ON public.letterboxd_sync_status;
CREATE POLICY "letterboxd_sync_status: update own"
    ON public.letterboxd_sync_status FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
