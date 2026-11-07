<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a99abd9d-585e-4970-945f-07ad3e839995

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Admin Panel (`/admin`)

An admin-only area with platform stats (curator growth, recommendation activity, popular genres) and a
searchable people directory where admins can promote or remove other admins.

**Security model**
- The admin flag is `app_metadata.role = "admin"` in Supabase Auth. Users cannot edit `app_metadata`, so it cannot be self-assigned.
- Three server-enforced layers: `middleware.ts` (redirects non-admins), `app/admin/layout.tsx` (server-side check before anything renders), and every `/api/admin/*` route re-verifies the caller with Supabase Auth on each request.
- Revoking admin access takes effect on the person's very next request.
- Nobody can change their own access, so at least one admin always remains.
- The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is read only in server code, never exposed to the browser (`import 'server-only'`).

**Setup**
1. Add `SUPABASE_SERVICE_ROLE_KEY` to your server environment (see `.env.example`).
2. Run `supabase/make_first_admin.sql` once with your e-mail to create the first admin.
