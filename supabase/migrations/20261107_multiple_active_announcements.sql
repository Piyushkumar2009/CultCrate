-- ==============================================================================
-- Rotating announcement bar: allow SEVERAL banners to be live at once.
-- Removes the "only one live banner" unique index. The public API shows the newest 5 live banners.
-- Safe to re-run. Run in the Supabase SQL editor.
-- ==============================================================================
DROP INDEX IF EXISTS public.site_announcements_one_active;
