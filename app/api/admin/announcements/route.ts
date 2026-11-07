import type { NextRequest } from 'next/server';
import { MIGRATION_HINT, fail, guardAdmin, isMissingRelation, ok, routeError } from '@/lib/adminApi';
import { parseAnnouncementInput, toAnnouncement, type Announcement, type AnnouncementListResponse } from '@/lib/adminAnnouncements';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const setupNeeded = () => fail({ error: MIGRATION_HINT, code: 'setup_required' }, 503);

/** All banners, live one first. Admin-only. */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { data, error } = await createAdminClient()
      .from('site_announcements')
      .select('*')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return isMissingRelation(error) ? setupNeeded() : routeError('announcements', error, "We couldn't load announcements.");
    const announcements = (data ?? []).map(toAnnouncement).filter((a): a is Announcement => a !== null);
    return ok<AnnouncementListResponse>({ announcements });
  } catch (err: unknown) {
    return routeError('announcements', err, "We couldn't load announcements.");
  }
}

/** Create a banner. Body: { message, tone?, linkUrl?, linkLabel?, dismissible?, activate? } */
export async function POST(request: NextRequest) {
  const guard = await guardAdmin(request, { mutating: true });
  if (!guard.ok) return guard.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseAnnouncementInput(body, 'create');
  if (!parsed.ok) return fail({ error: parsed.error, code: 'bad_request' }, 400);
  const activate = typeof body === 'object' && body !== null && (body as Record<string, unknown>).activate === true;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('site_announcements')
      .insert({
        message: parsed.value.message,
        tone: parsed.value.tone,
        link_url: parsed.value.linkUrl,
        link_label: parsed.value.linkLabel,
        dismissible: parsed.value.dismissible,
        is_active: activate,
        created_by: guard.caller.userId,
      })
      .select('*')
      .single();
    if (error) return isMissingRelation(error) ? setupNeeded() : routeError('announcements', error, "We couldn't save the banner.");
    return ok({ announcement: toAnnouncement(data) }, 201);
  } catch (err: unknown) {
    return routeError('announcements', err, "We couldn't save the banner.");
  }
}
