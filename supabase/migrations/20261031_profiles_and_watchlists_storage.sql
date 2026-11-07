-- ==============================================================================
-- CultCrate Database & Storage Setup Migration
-- Supabase SQL Editor Compatible
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create `profiles` Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    gemini_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Profiles Table RLS Policies
-- ------------------------------------------------------------------------------
-- Only authenticated users can SELECT their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Only authenticated users can INSERT their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Only authenticated users can UPDATE their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 3. Automatic `updated_at` Timestamp Trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. Auto-Provision Profile on New User Signup (`auth.users`)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, gemini_api_key)
    VALUES (NEW.id, NULL)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 5. Supabase Storage Bucket Setup: `user_watchlists` (Private)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user_watchlists',
    'user_watchlists',
    false, -- Private bucket
    10485760, -- 10 MB maximum upload size limit
    ARRAY['text/csv', 'application/vnd.ms-excel', 'text/plain']
)
ON CONFLICT (id) DO UPDATE
SET 
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['text/csv', 'application/vnd.ms-excel', 'text/plain'];

-- ------------------------------------------------------------------------------
-- 6. Storage Row Level Security (RLS) Policies on `storage.objects`
-- Strict Path Restriction: watchlists/{user_id}/user_watchlist.csv
-- ------------------------------------------------------------------------------

-- Allow authenticated users to read/download their own watchlist file
DROP POLICY IF EXISTS "Users can view own watchlist" ON storage.objects;
CREATE POLICY "Users can view own watchlist"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'user_watchlists'
        AND (
            name = ('watchlists/' || auth.uid()::text || '/user_watchlist.csv')
            OR (
                (storage.foldername(name))[1] = 'watchlists' 
                AND (storage.foldername(name))[2] = auth.uid()::text
            )
        )
    );

-- Allow authenticated users to upload their own watchlist file
DROP POLICY IF EXISTS "Users can upload own watchlist" ON storage.objects;
CREATE POLICY "Users can upload own watchlist"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'user_watchlists'
        AND (
            name = ('watchlists/' || auth.uid()::text || '/user_watchlist.csv')
            OR (
                (storage.foldername(name))[1] = 'watchlists' 
                AND (storage.foldername(name))[2] = auth.uid()::text
            )
        )
    );

-- Allow authenticated users to overwrite/update their own watchlist file
DROP POLICY IF EXISTS "Users can update own watchlist" ON storage.objects;
CREATE POLICY "Users can update own watchlist"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'user_watchlists'
        AND (
            name = ('watchlists/' || auth.uid()::text || '/user_watchlist.csv')
            OR (
                (storage.foldername(name))[1] = 'watchlists' 
                AND (storage.foldername(name))[2] = auth.uid()::text
            )
        )
    )
    WITH CHECK (
        bucket_id = 'user_watchlists'
        AND (
            name = ('watchlists/' || auth.uid()::text || '/user_watchlist.csv')
            OR (
                (storage.foldername(name))[1] = 'watchlists' 
                AND (storage.foldername(name))[2] = auth.uid()::text
            )
        )
    );

-- Allow authenticated users to delete their own watchlist file
DROP POLICY IF EXISTS "Users can delete own watchlist" ON storage.objects;
CREATE POLICY "Users can delete own watchlist"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'user_watchlists'
        AND (
            name = ('watchlists/' || auth.uid()::text || '/user_watchlist.csv')
            OR (
                (storage.foldername(name))[1] = 'watchlists' 
                AND (storage.foldername(name))[2] = auth.uid()::text
            )
        )
    );
