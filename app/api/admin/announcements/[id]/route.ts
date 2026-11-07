import type { NextRequest } from 'next/server';
import { MIGRATION_HINT, fail, guardAdmin, isMissingRelation, ok, routeError } from '@/lib/adminApi';
import { UUID_PATTERN } from '@/lib/adminAuth';
import { parseAnnouncementInput, toAnnouncement } from '@/lib/adminAnnouncements';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const setupNeeded = () => fail({ error: MIGRATION_HINT, code: 'setup_required' }, 503);

/** Toggle a banner on/off and/or edit it. Body: { isActive?, message?, tone?, linkUrl?, linkLabel?, dismissible? } */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const guard = await guardAdmin(request, { mutating: true });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return fail({ error: "We couldn't understand that request.", code: 'bad_request' }, 400);

  const body: unknown = await request.json().catch(() => null);
  const parsed = parseAnnouncementInput(body, 'update');
  if (!parsed.ok) return fail({ error: parsed.error, code: 'bad_request' }, 400);
  const isActive = (body as Record<string, unknown>).isActive;
  if (isActive !== undefined && typeof isActive !== 'boolean') return fail({ error: "We couldn't understand that request.", code: 'bad_request' }, 400);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.value.message !== undefined) patch.message = parsed.value.message;
  if (parsed.value.tone !== undefined) patch.tone = parsed.value.tone;
  if (parsed.value.linkUrl !== undefined) patch.link_url = parsed.value.linkUrl;
  if (parsed.value.linkLabel !== undefined) patch.link_label = parsed.value.linkLabel;
  if (parsed.value.dismissible !== undefined) patch.dismissible = parsed.value.dismissible;
  if (isActive !== undefined) patch.is_active = isActive;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from('site_announcements').update(patch).eq('id', id).select('*').maybeSingle();
    if (error) return isMissingRelation(error) ? setupNeeded() : routeError('announcements', error, "We couldn't update the banner.");
    if (!data) return fail({ error: "We couldn't find that banner.", code: 'not_found' }, 404);
    return ok({ announcement: toAnnouncement(data) });
  } catch (err: unknown) {
    return routeError('announcements', err, "We couldn't update the banner.");
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const guard = await guardAdmin(request, { mutating: true });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return fail({ error: "We couldn't understand that request.", code: 'bad_request' }, 400);

  try {
    const { error } = await createAdminClient().from('site_announcements').delete().eq('id', id);
    if (error) return isMissingRelation(error) ? setupNeeded() : routeError('announcements', error, "We couldn't delete the banner.");
    return ok({ ok: true, id });
  } catch (err: unknown) {
    return routeError('announcements', err, "We couldn't delete the banner.");
  }
}
