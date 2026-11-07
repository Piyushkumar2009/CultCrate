# CultCrate Admin Panel overhaul

## Setup (2 steps)
1. Run `supabase/migrations/20261106_admin_platform_controls.sql` in the Supabase SQL editor
   (adds `site_announcements` and `letterboxd_sync_status`; additive, safe to re-run).
2. Make sure `SUPABASE_SERVICE_ROLE_KEY` is set on the server (it already is if /admin loads today).

No new npm packages. `npm test` now also runs `tests/adminPlatform.test.ts`.

## What's where
| Area | Files |
|---|---|
| Layout | `app/admin/page.tsx`, `components/admin/AdminShell.tsx`, `SystemStatus.tsx`, `OverviewSection.tsx`, `KpiStatCard.tsx` |
| Users | `CuratorsTable.tsx`, `UserDetailDrawer.tsx`, `ConfirmDialog.tsx` |
| Platform | `AnnouncementManager.tsx`, `SyncMonitor.tsx`, `components/SiteAnnouncementBanner.tsx` (mounted in `app/layout.tsx`) |
| Community | `LeaderboardSection.tsx` |
| API (admin-only) | `GET /api/admin/health`, `GET /api/admin/leaderboard?metric=`, `GET /api/admin/sync-status`, `GET+DELETE /api/admin/users/[id]`, `GET+POST /api/admin/announcements`, `PATCH+DELETE /api/admin/announcements/[id]` |
| API (public) | `GET /api/announcement` (anon key + RLS, never the service key) |
| Shared server code | `lib/adminApi.ts` (one guard for every route), `lib/adminPlatformData.ts` |
| Pure, tested logic | `lib/adminLeaderboard.ts`, `adminSync.ts`, `adminAnnouncements.ts`, `adminTrends.ts`, `adminUserDelete.ts` |
| Changed existing files | `app/api/sync-rss/route.ts` (records each sync result), `app/layout.tsx`, `lib/adminData.ts` (exports `listAllUsers`), `package.json` (test script) |
| Removed | `components/admin/AdminUserDirectory.tsx` (replaced by `CuratorsTable.tsx`) |

## Security model
- Every `/api/admin/*` route calls `guardAdmin()`: session re-validated with Supabase Auth, `app_metadata.role === 'admin'`, and a same-origin check on writes. The service-role client is created only after it passes.
- Delete user: not yourself, must exist, and an admin must be demoted first. Related rows go via `ON DELETE CASCADE`; stored library files are cleaned up best-effort.
- Banner links are limited to `https://` or same-site paths; text is stripped of control characters; RLS lets the public read only the *active* banner and nobody write.

## Data caveats
- Sync Monitor shows real data only for syncs that happen after this ships (no history existed). Linked users with no record yet show **Pending**.
- Streaks come from the `Date` column of each `ratings.csv` and are measured for the 30 busiest libraries (cached 5 min). Other curators are excluded from the streak ranking, and the UI says so.
- "Most recommendations" = films in each curator's latest batch (the app keeps one batch per user).
- KPI trends exist where there is real history (new curators, recommendation runs). "Active" and "Films logged" show no arrow because only a latest-value snapshot is stored.


## Rotating announcement bar (multiple live banners)

- Run `supabase/migrations/20261107_multiple_active_announcements.sql` once. It drops the "only one live banner" unique index (safe to re-run).
- Several banners can now be live at once. The admin API no longer switches the others off when you publish or toggle one on.
- `GET /api/announcement` returns `{ announcements: [...], announcement }`: the newest 5 live banners, plus the newest one under the old key for older clients.
- `components/SiteAnnouncementBanner.tsx` rotates every 4.5s, pauses on hover/focus/hidden tab, and has chevrons, dots, arrow-key and swipe navigation. Dismissals are stored per banner revision in localStorage.
