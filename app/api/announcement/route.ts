import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHER_KEY, SUPABASE_URL } from '@/utils/supabase/client';
import {
  MAX_LIVE_ANNOUNCEMENTS,
  toAnnouncement,
  toPublicAnnouncement,
  type Announcement,
  type PublicAnnouncementsResponse,
} from '@/lib/adminAnnouncements';

export const runtime = 'nodejs';

const CACHE = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' };

/**
 * PUBLIC: the live sitewide banners (newest first, at most MAX_LIVE_ANNOUNCEMENTS). Uses the anon key, so Row
 * Level Security (not this code) guarantees only active banners can ever be read. The service-role key is not used here.
 * `announcement` (the newest one) is kept alongside `announcements` for older clients.
 */
export async function GET() {
  const empty = NextResponse.json<PublicAnnouncementsResponse>({ announcements: [], announcement: null }, { headers: CACHE });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHER_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase
      .from('site_announcements')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(MAX_LIVE_ANNOUNCEMENTS);
    if (error || !data) return empty; // missing table / nothing live: show nothing, never an error to visitors
    const announcements = data
      .map(toAnnouncement)
      .filter((a): a is Announcement => a !== null)
      .map(toPublicAnnouncement);
    return NextResponse.json<PublicAnnouncementsResponse>({ announcements, announcement: announcements[0] ?? null }, { headers: CACHE });
  } catch {
    return empty;
  }
}
