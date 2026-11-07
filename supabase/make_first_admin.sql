-- ==============================================================================
-- CultCrate: make the FIRST admin
--
-- This is NOT a schema change. It only sets a flag on one existing account.
-- The flag lives in Supabase Auth "app_metadata", which users can never edit themselves
-- (only the server's service key or this SQL editor can), so it cannot be spoofed from the app.
--
-- 1. Replace YOUR_EMAIL_HERE with the e-mail you sign in with.
-- 2. Run it in the Supabase SQL Editor.
-- 3. Open /admin. (Sign out and back in once if the "Admin Panel" menu link is not showing yet.)
--
-- After that, admins can promote or remove other admins from the panel itself.
-- ==============================================================================

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'YOUR_EMAIL_HERE';

-- Check it worked (should return one row with role = admin):
-- SELECT email, raw_app_meta_data ->> 'role' AS role FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';

-- Emergency revoke (back to a normal account):
-- UPDATE auth.users
-- SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "user"}'::jsonb
-- WHERE email = 'YOUR_EMAIL_HERE';
